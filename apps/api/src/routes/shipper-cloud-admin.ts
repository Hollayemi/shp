/**
 * Shipper Cloud Admin Routes
 *
 * Admin endpoints for managing Shipper Cloud (Convex) deployments
 */

import { Router, type Request, type Response } from "express";
import { injectDeployKeyIntoSandbox } from "../services/shipper-cloud-hitl.js";
import { logger } from "../config/logger.js";

const router: Router = Router();

/**
 * POST /api/v1/shipper-cloud/inject-credentials
 *
 * Inject Convex credentials into a project's sandbox
 * Used by admin dashboard to fix missing credentials
 */
router.post("/inject-credentials", async (req: Request, res: Response) => {
  try {
    const { projectId, deployKeyEncrypted, deploymentUrl } = req.body;

    if (!projectId || !deployKeyEncrypted || !deploymentUrl) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: projectId, deployKeyEncrypted, deploymentUrl",
      });
    }

    logger.info({
      msg: "Admin: Injecting Shipper Cloud credentials",
      projectId,
      deploymentUrl,
    });

    const result = await injectDeployKeyIntoSandbox(projectId, deployKeyEncrypted, deploymentUrl);

    if (!result.success) {
      logger.warn({
        msg: "Admin: Could not inject Shipper Cloud credentials",
        projectId,
        reason: result.message,
      });

      return res.status(400).json({
        success: false,
        error: result.message,
      });
    }

    logger.info({
      msg: "Admin: Successfully injected Shipper Cloud credentials",
      projectId,
    });

    return res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error({
      msg: "Admin: Failed to inject Shipper Cloud credentials",
      error: errorMsg,
    });

    return res.status(500).json({
      success: false,
      error: errorMsg,
    });
  }
});

export default router;
