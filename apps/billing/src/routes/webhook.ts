/**
 * Convex Log Stream Webhook
 *
 * Receives events from Convex log streams for usage tracking.
 * Events are validated using HMAC-SHA256 signature verification.
 * Each Convex deployment has its own webhook secret stored in the database.
 *
 * Note: Stripe webhooks are handled by Inngest in apps/web/src/inngest/stripe-handlers.ts
 */

import { Router, Request, Response, type Router as ExpressRouter } from "express";
import type { ApiResponse } from "@shipper/shared";
import { prisma } from "@shipper/database";
import { decryptDeployKey } from "@shipper/convex";
import {
  verifyWebhookSignature,
  processConvexWebhookEvents,
  type ConvexWebhookEvent,
} from "../services/convex-usage.js";
import { logger } from "../config/logger.js";

const router: ExpressRouter = Router();

/**
 * POST /webhook/convex
 * Receive Convex log stream events
 */
router.post("/convex", async (req: Request, res: Response) => {
  const signature = req.headers["x-webhook-signature"] as string;

  // Parse events to get deployment name
  const events: ConvexWebhookEvent[] = Array.isArray(req.body) ? req.body : [req.body];

  if (events.length === 0) {
    const response: ApiResponse = {
      success: false,
      error: "No events provided",
    };
    return res.status(400).json(response);
  }

  const deploymentName = events[0]?.convex?.deployment_name;
  if (!deploymentName) {
    logger.warn("Webhook missing deployment_name");
    const response: ApiResponse = {
      success: false,
      error: "Missing deployment identifier",
    };
    return res.status(400).json(response);
  }

  // Look up the webhook secret for this deployment
  const deployment = await prisma.convexDeployment.findUnique({
    where: { convexDeploymentName: deploymentName },
    select: { webhookSecretEncrypted: true },
  });

  if (!deployment) {
    logger.warn({ deploymentName }, "Unknown deployment");
    const response: ApiResponse = {
      success: false,
      error: "Unknown deployment",
    };
    return res.status(404).json(response);
  }

  if (!deployment.webhookSecretEncrypted) {
    logger.warn({ deploymentName }, "Webhook secret not configured for deployment");
    const response: ApiResponse = {
      success: false,
      error: "Webhook not configured for this deployment",
    };
    return res.status(404).json(response);
  }

  // Decrypt the webhook secret
  let webhookSecret: string;
  try {
    // Check if it looks like an encrypted value (format: salt:iv:authTag:ciphertext)
    const parts = deployment.webhookSecretEncrypted.split(":");
    if (parts.length === 4) {
      webhookSecret = decryptDeployKey(deployment.webhookSecretEncrypted);
    } else {
      // Legacy: might be stored unencrypted (plain hex string)
      logger.warn({ deploymentName }, "Webhook secret appears to be stored unencrypted (legacy format)");
      webhookSecret = deployment.webhookSecretEncrypted;
    }
  } catch (error) {
    logger.error({
      deploymentName,
      error: error instanceof Error ? error.message : String(error),
      storedValueLength: deployment.webhookSecretEncrypted.length,
      storedValuePreview: deployment.webhookSecretEncrypted.substring(0, 20) + "...",
    }, "Failed to decrypt webhook secret");
    const response: ApiResponse = {
      success: false,
      error: "Server configuration error",
    };
    return res.status(500).json(response);
  }

  // Verify signature
  const rawBody = JSON.stringify(req.body);
  if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
    logger.warn({ deploymentName }, "Invalid webhook signature");
    const response: ApiResponse = {
      success: false,
      error: "Invalid signature",
    };
    return res.status(401).json(response);
  }

  // Validate timestamp to prevent replay attacks (5 minute window)
  const firstEvent = events[0];
  const eventTimestamp = firstEvent?.timestamp;
  if (eventTimestamp) {
    const now = Date.now();
    const fiveMinutesMs = 5 * 60 * 1000;

    if (eventTimestamp < now - fiveMinutesMs) {
      logger.warn({ eventTimestamp, now, deploymentName }, "Webhook request expired");
      const response: ApiResponse = {
        success: false,
        error: "Request expired",
      };
      return res.status(403).json(response);
    }
  }

  try {
    logger.info({ eventCount: events.length, deploymentName }, "Processing Convex webhook");

    const result = await processConvexWebhookEvents(events);

    logger.info({
      processed: result.processed,
      skipped: result.skipped,
      skipReasons: result.skipReasons,
      errors: result.errors.length,
      deploymentName,
    }, "Convex webhook processed");

    const response: ApiResponse = {
      success: true,
      data: {
        processed: result.processed,
        skipped: result.skipped,
        skipReasons: result.skipReasons,
        errors: result.errors.length,
      },
    };

    return res.json(response);
  } catch (error) {
    logger.error({ error, deploymentName }, "Convex webhook error");

    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Internal error",
    };

    return res.status(500).json(response);
  }
});

/**
 * GET /webhook/status
 * Health check for webhook endpoint
 */
router.get("/status", async (_req: Request, res: Response) => {
  const configuredCount = await prisma.convexDeployment.count({
    where: { webhookSecretEncrypted: { not: null } },
  });

  const response: ApiResponse = {
    success: true,
    data: {
      configured: configuredCount > 0,
      deploymentsWithWebhook: configuredCount,
      endpoint: "/webhook/convex",
    },
  };

  return res.json(response);
});

/**
 * POST /webhook/migrate/:deploymentName
 * Fetch webhook secret from Convex and re-encrypt it properly
 * Useful for fixing deployments created before encryption was implemented
 */
router.post("/migrate/:deploymentName", async (req: Request, res: Response) => {
  const { deploymentName } = req.params;

  // Require API key for this admin endpoint
  const apiKey = req.headers["x-api-key"];
  if (apiKey !== process.env.SHIPPER_API_KEY) {
    const response: ApiResponse = { success: false, error: "Unauthorized" };
    return res.status(401).json(response);
  }

  try {
    // Find the deployment
    const deployment = await prisma.convexDeployment.findUnique({
      where: { convexDeploymentName: deploymentName },
      select: {
        id: true,
        convexDeploymentUrl: true,
        deployKeyEncrypted: true,
        webhookSecretEncrypted: true,
      },
    });

    if (!deployment) {
      const response: ApiResponse = { success: false, error: "Deployment not found" };
      return res.status(404).json(response);
    }

    // Decrypt deploy key to access Convex API
    const deployKey = decryptDeployKey(deployment.deployKeyEncrypted);

    // Import ConvexDeploymentAPI dynamically to avoid circular deps
    const { ConvexDeploymentAPI } = await import("@shipper/convex");
    const api = new ConvexDeploymentAPI(deployment.convexDeploymentUrl, deployKey);

    // Fetch the current webhook secret from Convex
    const webhookSecret = await api.getWebhookSecret();

    if (!webhookSecret) {
      const response: ApiResponse = {
        success: false,
        error: "No webhook sink configured in Convex for this deployment",
      };
      return res.status(404).json(response);
    }

    // Encrypt and update
    const { encryptDeployKey } = await import("@shipper/convex");
    const webhookSecretEncrypted = encryptDeployKey(webhookSecret);

    await prisma.convexDeployment.update({
      where: { id: deployment.id },
      data: {
        webhookSecretEncrypted,
        webhookConfiguredAt: new Date(),
      },
    });

    logger.info({ deploymentName }, "Webhook secret migrated successfully");

    const response: ApiResponse = {
      success: true,
      data: { deploymentName, migrated: true },
    };
    return res.json(response);
  } catch (error) {
    logger.error({
      deploymentName,
      error: error instanceof Error ? error.message : String(error),
    }, "Failed to migrate webhook secret");

    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Migration failed",
    };
    return res.status(500).json(response);
  }
});

/**
 * Method not allowed for /convex (only POST is supported)
 */
router.all("/convex", (_req: Request, res: Response) => {
  const response: ApiResponse = {
    success: false,
    error: "Method not allowed. Use POST.",
  };
  return res.status(405).json(response);
});

/**
 * Catch-all for unmatched webhook routes
 */
router.all("*", (_req: Request, res: Response) => {
  const response: ApiResponse = {
    success: false,
    error: "Not found",
  };
  return res.status(404).json(response);
});

export default router;
