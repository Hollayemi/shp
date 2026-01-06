import { Request, Response, NextFunction } from "express";
import { logger } from "../config/logger.js";

/**
 * Express middleware that extracts projectId from the request and attaches
 * a context-aware logger to the request object.
 *
 * The projectId can be in:
 * - URL params (e.g., /api/v1/daytona/sandbox/:projectId)
 * - Request body (e.g., { projectId: "..." })
 * - Query params (e.g., ?projectId=...)
 *
 * Usage in routes:
 *   req.logger.info("Processing request");  // Automatically includes projectId
 */
export const projectContextMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  // Extract projectId from various sources
  const projectId =
    req.params.projectId ||
    (req.body as { projectId?: string })?.projectId ||
    (req.query.projectId as string);

  // Always attach a logger to the request
  if (projectId) {
    // Create a child logger with projectId context
    req.logger = logger.child({ projectId });
    req.projectId = projectId;
  } else {
    // Use the base logger if no projectId is available
    req.logger = logger;
  }

  next();
};
