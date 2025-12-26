import {
  Router,
  Request,
  Response,
  type Router as ExpressRouter,
} from "express";
import { z } from "zod";
import type { ApiResponse } from "@shipper/shared";
import { prisma } from "@shipper/database";
import { ErrorDetector } from "../services/error-detector.js";
import { ErrorClassifier } from "../services/error-classifier.js";
import { VoltAgentService } from "../services/voltagent-service.js";
import { getSandbox } from "../services/modal-sandbox-manager.js";
import { createProjectLogger } from "../config/logger.js";

const router: ExpressRouter = Router();

// Validation schemas
const detectHybridSchema = z.object({
  projectId: z.string().uuid(),
  fragmentId: z.string().uuid().optional(),
});

const autoFixSchema = z.object({
  projectId: z.string().uuid(),
  fragmentId: z.string().uuid().optional(),
});

/**
 * POST /api/v1/daytona/errors/detect-hybrid
 * Hybrid error detection: Fragment analysis + Project build analysis
 */
router.post("/detect-hybrid", async (req: Request, res: Response) => {
  try {
    const parsed = detectHybridSchema.safeParse(req.body);
    if (!parsed.success) {
      const response: ApiResponse = {
        success: false,
        error: "Invalid request body",
      };
      return res.status(400).json(response);
    }

    const { projectId, fragmentId } = parsed.data;

    const logger = createProjectLogger(projectId);
    logger.info({ msg: "Starting hybrid error detection", fragmentId });

    // Get the fragment to analyze
    const targetFragment = fragmentId
      ? await prisma.v2Fragment.findUnique({
          where: { id: fragmentId },
          select: { id: true, title: true, files: true },
        })
      : await prisma.v2Fragment.findFirst({
          where: { projectId },
          orderBy: { createdAt: "desc" },
          select: { id: true, title: true, files: true },
        });

    if (!targetFragment || !targetFragment.files) {
      const response: ApiResponse = {
        success: false,
        error: "No fragment found with files to analyze",
      };
      return res.status(404).json(response);
    }

    const fragmentFiles = targetFragment.files as { [path: string]: string };

    // Get sandbox for hybrid analysis
    const sandboxInfo = await getSandbox(projectId);

    let detectedErrors;
    let analysisType: "hybrid" | "fragment-only";

    try {
      if (sandboxInfo) {
        // Extract sandboxId from Modal sandbox info
        const sandboxId =
          (sandboxInfo as any).sandboxId ||
          (sandboxInfo as any).sandbox?.sandboxId ||
          null;

        if (sandboxId) {
          logger.info({
            msg: "Analyzing project with Modal sandbox hybrid analysis",
            sandboxId,
          });
          // Modal: Use sandboxId for hybrid analysis with actual build validation
          detectedErrors = await ErrorDetector.analyzeProjectWithFragmentModal(
            fragmentFiles,
            sandboxId,
          );
          analysisType = "hybrid";
        } else {
          // Fallback to fragment-only if sandboxId not available
          detectedErrors = await ErrorDetector.analyzeV2Fragment(
            fragmentFiles,
          );
          analysisType = "fragment-only";
        }
      } else {
        // No sandbox available - fragment-only analysis
        detectedErrors = await ErrorDetector.analyzeV2Fragment(
          fragmentFiles,
          logger,
        );
        analysisType = "fragment-only";
      }
    } catch (error) {
      logger.error({
        msg: "Error analysis failed",
        error: error instanceof Error ? error.message : String(error),
      });
      // Return empty errors on failure
      detectedErrors = {
        buildErrors: [],
        runtimeErrors: [],
        importErrors: [],
        navigationErrors: [],
        severity: "low" as const,
        autoFixable: false,
        totalErrors: 0,
        detectedAt: new Date(),
      };
      analysisType = "fragment-only";
    }

    // Classify errors
    const classification = ErrorClassifier.categorizeErrors(detectedErrors);

    req.logger?.info({
      msg: "Error detection complete",
      totalErrors: detectedErrors.totalErrors,
      analysisType,
    });

    const response: ApiResponse = {
      success: true,
      data: {
        errors: detectedErrors,
        classification,
        fragmentId: targetFragment.id,
        fragmentTitle: targetFragment.title,
        analysisType,
        canAutoFix: detectedErrors.autoFixable,
      },
    };

    res.json(response);
  } catch (error) {
    req.logger?.error({
      msg: "Hybrid error detection failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to detect errors",
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/v1/daytona/errors/auto-fix
 * Auto-fix errors using VoltAgent
 */
router.post("/auto-fix", async (req: Request, res: Response) => {
  try {
    const parsed = autoFixSchema.safeParse(req.body);
    if (!parsed.success) {
      const response: ApiResponse = {
        success: false,
        error: "Invalid request body",
      };
      return res.status(400).json(response);
    }

    const { projectId, fragmentId } = parsed.data;

    const logger = createProjectLogger(projectId);
    logger.info({ msg: "Starting auto-fix", fragmentId });

    // Get the fragment to fix
    const targetFragment = fragmentId
      ? await prisma.v2Fragment.findUnique({
          where: { id: fragmentId },
          select: { id: true, title: true, files: true },
        })
      : await prisma.v2Fragment.findFirst({
          where: { projectId },
          orderBy: { createdAt: "desc" },
          select: { id: true, title: true, files: true },
        });

    if (!targetFragment || !targetFragment.files) {
      const response: ApiResponse = {
        success: false,
        error: "No fragment found with files to fix",
      };
      return res.status(404).json(response);
    }

    const fragmentFiles = targetFragment.files as { [path: string]: string };

    // First, detect errors
    const sandboxInfo = await getSandbox(projectId);

    let detectedErrors;
    try {
      if (sandboxInfo) {
        // Extract sandboxId from Modal sandbox info
        const sandboxId =
          (sandboxInfo as any).sandboxId ||
          (sandboxInfo as any).sandbox?.sandboxId ||
          null;

        if (sandboxId) {
          logger.info({
            msg: "Analyzing project with Modal sandbox hybrid analysis",
            sandboxId,
          });
          detectedErrors = await ErrorDetector.analyzeProjectWithFragmentModal(
            fragmentFiles,
            sandboxId,
          );
        } else {
          // Fallback to fragment-only if sandboxId not available
          detectedErrors = await ErrorDetector.analyzeV2Fragment(
            fragmentFiles,
          );
        }
      } else {
        // No sandbox available - fragment-only analysis
        detectedErrors = await ErrorDetector.analyzeV2Fragment(
          fragmentFiles,
        );
      }
    } catch (error) {
      logger.error({
        msg: "Error analysis failed",
        error: error instanceof Error ? error.message : String(error),
      });
      // Return empty errors on failure
      detectedErrors = {
        buildErrors: [],
        runtimeErrors: [],
        importErrors: [],
        navigationErrors: [],
        severity: "low" as const,
        autoFixable: false,
        totalErrors: 0,
        detectedAt: new Date(),
      };
    }

    if (detectedErrors.totalErrors === 0) {
      const response: ApiResponse = {
        success: true,
        data: {
          message: "No errors found to fix",
          totalErrors: 0,
          successfulFixes: 0,
          failedFixes: 0,
        },
      };
      return res.json(response);
    }

    // Initialize VoltAgent service
    const voltAgent = new VoltAgentService();

    // Collect all errors
    const allErrors = [
      ...detectedErrors.buildErrors,
      ...detectedErrors.importErrors,
      ...detectedErrors.navigationErrors,
    ];

    req.logger?.info({
      msg: "Processing errors with VoltAgent",
      totalErrors: allErrors.length,
    });

    // Process errors with VoltAgent
    const fixResults = [];
    let successfulFixes = 0;
    let failedFixes = 0;

    for (const error of allErrors.slice(0, 10)) {
      // Limit to 10 errors for performance
      try {
        req.logger?.info({
          msg: "Fixing error",
          errorType: error.type,
          severity: error.severity,
        });

        const errorContext = {
          id: error.id,
          type: error.type,
          details: error.details,
          severity: error.severity,
          autoFixable: error.autoFixable,
        };

        const fixResult = await voltAgent.fixError(
          errorContext,
          fragmentFiles,
          sandboxInfo?.sandbox,
        );

        if (fixResult.success) {
          successfulFixes++;
          fixResults.push({
            errorId: error.id,
            success: true,
            fixedFiles: fixResult.fixedFiles,
            strategy: fixResult.strategy,
            changes: fixResult.changes,
          });
          req.logger?.info({
            msg: "Error fixed successfully",
            errorId: error.id,
          });
        } else {
          failedFixes++;
          fixResults.push({
            errorId: error.id,
            success: false,
            reason: fixResult.reason,
          });
          req.logger?.warn({
            msg: "Failed to fix error",
            errorId: error.id,
            reason: fixResult.reason,
          });
        }
      } catch (fixError) {
        req.logger?.error({
          msg: "Error during fix attempt",
          errorId: error.id,
          error: fixError instanceof Error ? fixError.message : "Unknown error",
        });
        failedFixes++;
        fixResults.push({
          errorId: error.id,
          success: false,
          reason:
            fixError instanceof Error ? fixError.message : "Unknown error",
        });
      }
    }

    // Calculate success rate
    const successRate =
      allErrors.length > 0 ? (successfulFixes / allErrors.length) * 100 : 0;

    // Create new fragment with fixes if any were successful
    let newFragmentId = null;
    if (successfulFixes > 0) {
      const updatedFiles = { ...fragmentFiles };

      // Apply fixes
      for (const fix of fixResults.filter((r) => r.success)) {
        if (fix.fixedFiles && typeof fix.fixedFiles === "object") {
          Object.assign(updatedFiles, fix.fixedFiles);
        }
      }

      // Create new fragment
      const newFragment = await prisma.v2Fragment.create({
        data: {
          projectId,
          title: `${targetFragment.title} (Auto-fixed)`,
          files: updatedFiles,
        },
      });

      newFragmentId = newFragment.id;

      // Update project to mark this as the active fragment
      await prisma.project.update({
        where: { id: projectId },
        data: { activeFragmentId: newFragment.id },
      });

      req.logger?.info({
        msg: "Created new fragment with fixes and set as active",
        fragmentId: newFragmentId,
      });
    }

    req.logger?.info({
      msg: "Auto-fix completed",
      successfulFixes,
      totalErrors: allErrors.length,
      successRate: successRate.toFixed(1) + "%",
    });

    const response: ApiResponse = {
      success: true,
      data: {
        fixResults,
        summary: {
          totalErrors: allErrors.length,
          successfulFixes,
          failedFixes,
          successRate,
        },
        newFragmentId,
        originalFragmentId: targetFragment.id,
      },
    };

    res.json(response);
  } catch (error) {
    req.logger?.error({
      msg: "Auto-fix failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    const response: ApiResponse = {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to auto-fix errors",
    };
    res.status(500).json(response);
  }
});

export default router;
