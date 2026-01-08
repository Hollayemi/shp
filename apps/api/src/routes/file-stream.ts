/**
 * File Stream SSE Routes
 *
 * Provides real-time file creation event streaming during AI generation.
 * Clients connect via EventSource and receive file events as they're created.
 */

import { Router, Request, Response } from "express";
import { prisma } from "@shipper/database";
import { ssePubSub } from "../services/sse-pubsub.js";
import { logger as defaultLogger } from "../config/logger.js";
import { validateSession } from "../middleware/session-auth.js";

const router: Router = Router();
const logger = defaultLogger.child({ service: "file-stream-routes" });

// Admin email check (matches webapp behavior)
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").filter(Boolean);
function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

/**
 * SSE endpoint for file stream events
 * GET /api/sse/file-stream/:projectId
 *
 * Clients connect with EventSource and receive real-time file creation events.
 * Requires session authentication and project access verification.
 */
router.get(
  "/:projectId",
  validateSession,
  async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const userId = req.user?.id;
    const userEmail = req.user?.email;

    if (!projectId) {
      res.status(400).json({ error: "Project ID required" });
      return;
    }

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    logger.info({ projectId, userId }, "File stream SSE client connecting");

    try {
      // Verify project exists and user has access
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { userId: true, teamId: true },
      });

      if (!project) {
        res.status(403).json({ error: "Project not found" });
        return;
      }

      // Check access: owner, team member, or admin
      let hasAccess = project.userId === userId;

      // Check team membership if not owner
      if (!hasAccess && project.teamId) {
        const membership = await prisma.teamMember.findUnique({
          where: {
            userId_teamId: {
              userId,
              teamId: project.teamId,
            },
          },
        });
        hasAccess = !!membership;
      }

      // Check admin access
      if (!hasAccess && isAdminEmail(userEmail)) {
        hasAccess = true;
      }

      if (!hasAccess) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      // Add client and get cleanup function
      const cleanup = await ssePubSub.addFileStreamClient(projectId, res, userId);

      // Handle client disconnect
      req.on("close", () => {
        cleanup();
      });

      req.on("error", (error) => {
        logger.error(
          { projectId, error: error.message },
          "File stream SSE connection error",
        );
        cleanup();
      });
    } catch (error) {
      logger.error(
        {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        },
        "Failed to establish file stream SSE connection",
      );
      res.status(500).json({ error: "Failed to establish SSE connection" });
    }
  },
);

export default router;
