/**
 * SSE (Server-Sent Events) Routes
 *
 * Provides real-time event streaming endpoints as a self-hosted alternative to Ably.
 * Clients connect via EventSource and receive project/workspace events.
 */

import { Router, Request, Response } from "express";
import { ssePubSub } from "../services/sse-pubsub.js";
import { logger as defaultLogger } from "../config/logger.js";
import { validateSession } from "../middleware/session-auth.js";

const router: Router = Router();
const logger = defaultLogger.child({ service: "sse-routes" });

/**
 * SSE endpoint for project events
 * GET /api/sse/project/:projectId
 *
 * Clients connect with EventSource and receive real-time events for the project.
 * Requires chat token authentication.
 */
router.get(
  "/project/:projectId",
  validateSession,
  async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const userId = req.user?.id;

    if (!projectId) {
      res.status(400).json({ error: "Project ID required" });
      return;
    }

    logger.info({ projectId, userId }, "SSE client connecting to project");

    try {
      // Add client and get cleanup function
      const cleanup = await ssePubSub.addProjectClient(projectId, res, userId);

      // Handle client disconnect
      req.on("close", () => {
        cleanup();
      });

      req.on("error", (error) => {
        logger.error(
          { projectId, error: error.message },
          "SSE connection error",
        );
        cleanup();
      });
    } catch (error) {
      logger.error(
        {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        },
        "Failed to establish SSE connection",
      );
      res.status(500).json({ error: "Failed to establish SSE connection" });
    }
  },
);

/**
 * SSE endpoint for workspace events
 * GET /api/sse/workspace/:workspaceId
 *
 * Clients connect with EventSource and receive real-time events for the workspace.
 * Requires chat token authentication.
 */
router.get(
  "/workspace/:workspaceId",
  validateSession,
  async (req: Request, res: Response) => {
    const { workspaceId } = req.params;
    const userId = req.user?.id;

    if (!workspaceId) {
      res.status(400).json({ error: "Workspace ID required" });
      return;
    }

    logger.info({ workspaceId, userId }, "SSE client connecting to workspace");

    try {
      // Add client and get cleanup function
      const cleanup = await ssePubSub.addWorkspaceClient(
        workspaceId,
        res,
        userId,
      );

      // Handle client disconnect
      req.on("close", () => {
        cleanup();
      });

      req.on("error", (error) => {
        logger.error(
          { workspaceId, error: error.message },
          "SSE connection error",
        );
        cleanup();
      });
    } catch (error) {
      logger.error(
        {
          workspaceId,
          error: error instanceof Error ? error.message : String(error),
        },
        "Failed to establish SSE connection",
      );
      res.status(500).json({ error: "Failed to establish SSE connection" });
    }
  },
);

/**
 * Get SSE connection stats (admin/debug endpoint)
 * GET /api/sse/stats
 */
router.get("/stats", (_req: Request, res: Response) => {
  const stats = ssePubSub.getStats();
  res.json(stats);
});

/**
 * Publish an event to a project channel
 * POST /api/sse/publish/project/:projectId
 *
 * Used by the web app to publish advisor events through the API server.
 * Accepts either:
 * - Session authentication (for client-side calls)
 * - Internal API key via x-internal-key header (for server-to-server calls)
 */
const INTERNAL_SSE_KEY =
  process.env.INTERNAL_SSE_KEY || process.env.SHIPPER_API_KEY;

router.post(
  "/publish/project/:projectId",
  async (req: Request, res: Response) => {
    // Check for internal API key first (server-to-server)
    const internalKey = req.headers["x-internal-key"] as string;
    const hasValidInternalKey =
      INTERNAL_SSE_KEY && internalKey === INTERNAL_SSE_KEY;

    // If no internal key, require session auth
    if (!hasValidInternalKey) {
      // Run session validation manually
      return validateSession(req, res, async () => {
        await handlePublish(req, res);
      });
    }

    // Internal key is valid, proceed without session
    await handlePublish(req, res);
  },
);

async function handlePublish(req: Request, res: Response) {
  const { projectId } = req.params;
  const userId = req.user?.id || (req.body.data?.userId as string);
  const { eventType, data } = req.body;

  if (!projectId || !eventType) {
    res.status(400).json({ error: "Project ID and eventType required" });
    return;
  }

  try {
    // Import the publish functions dynamically to avoid circular deps
    const { ssePubSub } = await import("../services/sse-pubsub.js");

    await ssePubSub.publishToProject(projectId, eventType, data, userId);

    res.json({ success: true });
  } catch (error) {
    logger.error(
      {
        projectId,
        eventType,
        error: error instanceof Error ? error.message : String(error),
      },
      "Failed to publish SSE event",
    );
    res.status(500).json({ error: "Failed to publish event" });
  }
}

export default router;
