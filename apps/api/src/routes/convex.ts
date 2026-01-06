import {
  Router,
  Request,
  Response,
  type Router as ExpressRouter,
} from "express";
import { z } from "zod";
import type { ApiResponse } from "@shipper/shared";
import { prisma } from "@shipper/database";
import { decryptDeployKey } from "@shipper/convex";
import {
  getSandbox,
  executeCommand,
} from "../services/modal-sandbox-manager.js";

const router: ExpressRouter = Router();

const deploySchema = z.object({
  projectId: z.string(),
  environment: z.enum(["development", "production"]).optional(),
});

/**
 * POST /api/v1/convex/deploy
 * Deploy Convex for the given project inside its Modal sandbox.
 * Body: { projectId, environment?: 'production' | 'development' }
 *
 * IMPORTANT: We use a SINGLE production deployment for both sandbox preview and published app.
 * - Production: runs 'bunx convex deploy --yes' with CONVEX_DEPLOY_KEY from ConvexDeployment
 * - Development: runs 'bunx convex deploy --yes' using CONVEX_DEPLOY_KEY from .env.local
 *
 * We use `convex deploy` (not `convex dev`) because we only provision production deployments.
 * `convex dev` targets development deployments which don't exist in our setup.
 */
router.post("/deploy", async (req: Request, res: Response) => {
  const parsed = deploySchema.safeParse(req.body);
  if (!parsed.success) {
    const response: ApiResponse = {
      success: false,
      error: "Invalid request body",
    };
    return res.status(400).json(response);
  }

  const { projectId, environment = "production" } = parsed.data;

  try {
    req.logger?.info({ msg: "Starting Convex deploy", projectId, environment });

    const sandboxInfo = await getSandbox(projectId, req.logger);
    if (!sandboxInfo || !sandboxInfo.sandboxId) {
      const response: ApiResponse = {
        success: false,
        error:
          "No active Modal sandbox found for this project. Convex deploy requires a Modal sandbox.",
      };
      return res.status(400).json(response);
    }

    // For production deployment, we need to look up the ConvexDeployment record
    // and use the stored deploy key to authenticate with Convex
    let command: string;

    if (environment === "production") {
      // Look up the ConvexDeployment for this project
      const convexDeployment = await prisma.convexDeployment.findUnique({
        where: { projectId },
      });

      if (!convexDeployment) {
        req.logger?.warn({
          msg: "No ConvexDeployment found for project - cannot deploy to production",
          projectId,
        });
        const response: ApiResponse = {
          success: false,
          error:
            "No Convex deployment found for this project. The project may not have Shipper Cloud enabled.",
        };
        return res.status(400).json(response);
      }

      if (!convexDeployment.deployKeyEncrypted) {
        req.logger?.error({
          msg: "ConvexDeployment has no deploy key",
          projectId,
        });
        const response: ApiResponse = {
          success: false,
          error:
            "Convex deployment is missing deploy key. Please contact support.",
        };
        return res.status(500).json(response);
      }

      // Decrypt the deploy key
      let deployKey: string;
      try {
        deployKey = decryptDeployKey(convexDeployment.deployKeyEncrypted);
        req.logger?.info({
          msg: "Successfully decrypted deploy key",
          projectId,
        });
      } catch (decryptError) {
        req.logger?.error({
          msg: "Failed to decrypt deploy key",
          projectId,
          error:
            decryptError instanceof Error
              ? decryptError.message
              : String(decryptError),
        });
        const response: ApiResponse = {
          success: false,
          error: "Failed to decrypt Convex deploy key. Please contact support.",
        };
        return res.status(500).json(response);
      }

      // Use sh -c to run the command with inline environment variable
      // The sandbox doesn't parse VAR=value syntax without a shell
      command = `sh -c 'CONVEX_DEPLOY_KEY="${deployKey}" bunx convex deploy --yes'`;
      req.logger?.info({
        msg: "Executing production Convex deploy",
        sandboxId: sandboxInfo.sandboxId,
      });
    } else {
      // For development, we run 'bunx convex deploy --yes' using the deploy key from .env.local
      // We use `deploy` not `dev` because we only have a production deployment (no dev deployment exists)
      // The CONVEX_DEPLOY_KEY was injected into .env.local by deployToShipperCloud
      command = "bunx convex deploy --yes";
      req.logger?.info({
        msg: "Executing development Convex deploy (using prod deployment)",
        sandboxId: sandboxInfo.sandboxId,
      });
    }

    const result = await executeCommand(
      sandboxInfo.sandboxId,
      command,
      undefined,
      req.logger,
    );

    const output = [result.stdout, result.stderr].filter(Boolean).join("\n");

    if (result.exitCode !== 0) {
      req.logger?.error({
        msg: "Convex deploy failed",
        projectId,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
      });

      // Update ConvexDeployment status if production deploy failed
      if (environment === "production") {
        await prisma.convexDeployment
          .update({
            where: { projectId },
            data: {
              status: "ERROR",
              lastDeployError:
                result.stderr ||
                result.stdout ||
                `Exit code ${result.exitCode}`,
            },
          })
          .catch((e) =>
            req.logger?.warn({
              msg: "Failed to update ConvexDeployment status",
              error: e,
            }),
          );
      }

      const response: ApiResponse = {
        success: false,
        error:
          result.stderr ||
          result.stdout ||
          `Convex deploy failed with exit code ${result.exitCode}`,
        data: { exitCode: result.exitCode, output },
      } as ApiResponse & { data: { exitCode: number; output: string } };
      return res.status(500).json(response);
    }

    // Update ConvexDeployment status on successful production deploy
    if (environment === "production") {
      await prisma.convexDeployment
        .update({
          where: { projectId },
          data: {
            status: "ACTIVE",
            lastDeployedAt: new Date(),
            lastDeployError: null,
          },
        })
        .catch((e) =>
          req.logger?.warn({
            msg: "Failed to update ConvexDeployment status",
            error: e,
          }),
        );
    }

    req.logger?.info({
      msg: "Convex deploy succeeded",
      projectId,
      environment,
    });

    const response: ApiResponse = {
      success: true,
      data: { output, environment },
    };

    return res.json(response);
  } catch (error) {
    req.logger?.error({
      msg: "Convex deploy error",
      error: error instanceof Error ? error.message : String(error),
    });
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
    return res.status(500).json(response);
  }
});

export default router;
