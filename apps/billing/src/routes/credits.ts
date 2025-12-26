/**
 * Credits Routes
 *
 * Endpoints for managing Shipper Cloud credits:
 * - Get credit balance
 * - Create credit grants (admin/webhook)
 * - List credit grants
 * - Configure auto top-up
 * - Trigger manual top-up
 */

import {
  Router,
  Request,
  Response,
  type Router as ExpressRouter,
} from "express";
import { z } from "zod";
import type { ApiResponse } from "@shipper/shared";
import { logger } from "../config/logger.js";
import {
  getCreditBalance,
  createCreditGrant,
  createPromotionalCredits,
  listCreditGrants,
  voidCreditGrant,
  syncCreditBalanceToDatabase,
  grantFirstDeploymentBonus,
  CREDIT_PRICING,
} from "../services/stripe-credits.js";
import {
  configureAutoTopUp,
  getAutoTopUpConfig,
  disableAutoTopUp,
  processAutoTopUp,
  checkAndProcessAutoTopUps,
} from "../services/auto-top-up.js";

const router: ExpressRouter = Router();

// ==========================================
// Credit Balance & Grants
// ==========================================

/**
 * GET /credits/:userId/balance
 * Get a user's credit balance
 */
router.get("/:userId/balance", async (req: Request, res: Response) => {
  const { userId } = req.params;

  try {
    const result = await getCreditBalance(userId);

    if (!result.success) {
      const response: ApiResponse = {
        success: false,
        error: result.error,
      };
      return res.status(400).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: {
        availableCredits: result.availableCredits,
        availableBalanceCents: result.availableBalanceCents,
        centsPerCredit: CREDIT_PRICING.CENTS_PER_CREDIT,
      },
    };

    return res.json(response);
  } catch (error) {
    logger.error({ error, userId }, "Failed to get credit balance");
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get balance",
    };
    return res.status(500).json(response);
  }
});

/**
 * POST /credits/:userId/sync
 * Sync credit balance from Stripe to local database
 */
router.post("/:userId/sync", async (req: Request, res: Response) => {
  const { userId } = req.params;

  try {
    const result = await syncCreditBalanceToDatabase(userId);

    if (!result.success) {
      const response: ApiResponse = {
        success: false,
        error: result.error,
      };
      return res.status(400).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: {
        localBalance: result.localBalance,
        stripeBalance: result.stripeBalance,
      },
    };

    return res.json(response);
  } catch (error) {
    logger.error({ error, userId }, "Failed to sync credit balance");
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to sync balance",
    };
    return res.status(500).json(response);
  }
});

/**
 * GET /credits/:userId/grants
 * List all credit grants for a user
 */
router.get("/:userId/grants", async (req: Request, res: Response) => {
  const { userId } = req.params;

  try {
    const result = await listCreditGrants(userId);

    if (!result.success) {
      const response: ApiResponse = {
        success: false,
        error: result.error,
      };
      return res.status(400).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: { grants: result.grants },
    };

    return res.json(response);
  } catch (error) {
    logger.error({ error, userId }, "Failed to list credit grants");
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to list grants",
    };
    return res.status(500).json(response);
  }
});

const createGrantSchema = z.object({
  credits: z
    .number()
    .min(CREDIT_PRICING.MIN_CREDITS)
    .max(CREDIT_PRICING.MAX_CREDITS),
  category: z.enum(["paid", "promotional"]),
  name: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

/**
 * POST /credits/:userId/grants
 * Create a credit grant for a user (admin/internal only)
 */
router.post("/:userId/grants", async (req: Request, res: Response) => {
  const { userId } = req.params;

  const validation = createGrantSchema.safeParse(req.body);
  if (!validation.success) {
    const response: ApiResponse = {
      success: false,
      error: validation.error.issues[0]?.message ?? "Invalid request",
    };
    return res.status(400).json(response);
  }

  const { credits, category, name, expiresAt, metadata } = validation.data;

  try {
    const result = await createCreditGrant({
      userId,
      credits,
      category,
      name,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      metadata,
    });

    if (!result.success) {
      const response: ApiResponse = {
        success: false,
        error: result.error,
      };
      return res.status(400).json(response);
    }

    logger.info(
      { userId, credits, category, creditGrantId: result.creditGrantId },
      "Created credit grant via API",
    );

    const response: ApiResponse = {
      success: true,
      data: {
        creditGrantId: result.creditGrantId,
        credits: result.credits,
        amountCents: result.amountCents,
      },
    };

    return res.status(201).json(response);
  } catch (error) {
    logger.error({ error, userId }, "Failed to create credit grant");
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create grant",
    };
    return res.status(500).json(response);
  }
});

const promotionalGrantSchema = z.object({
  credits: z.number().min(1).max(CREDIT_PRICING.MAX_CREDITS),
  reason: z.string().min(1).max(200),
  expiresAt: z.iso.datetime().optional(),
});

/**
 * POST /credits/:userId/promotional
 * Create promotional credits (bonuses, refunds, etc.)
 */
router.post("/:userId/promotional", async (req: Request, res: Response) => {
  const { userId } = req.params;

  const validation = promotionalGrantSchema.safeParse(req.body);
  if (!validation.success) {
    const response: ApiResponse = {
      success: false,
      error: validation.error.issues[0]?.message ?? "Invalid request",
    };
    return res.status(400).json(response);
  }

  const { credits, reason, expiresAt } = validation.data;

  try {
    const result = await createPromotionalCredits(
      userId,
      credits,
      reason,
      expiresAt ? new Date(expiresAt) : undefined,
    );

    if (!result.success) {
      const response: ApiResponse = {
        success: false,
        error: result.error,
      };
      return res.status(400).json(response);
    }

    logger.info(
      { userId, credits, reason, creditGrantId: result.creditGrantId },
      "Created promotional credits",
    );

    const response: ApiResponse = {
      success: true,
      data: {
        creditGrantId: result.creditGrantId,
        credits: result.credits,
        amountCents: result.amountCents,
      },
    };

    return res.status(201).json(response);
  } catch (error) {
    logger.error({ error, userId }, "Failed to create promotional credits");
    const response: ApiResponse = {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to create promotional credits",
    };
    return res.status(500).json(response);
  }
});

/**
 * DELETE /credits/:userId/grants/:grantId
 * Void a credit grant (before it's applied)
 */
router.delete(
  "/:userId/grants/:grantId",
  async (req: Request, res: Response) => {
    const { userId, grantId } = req.params;

    try {
      const result = await voidCreditGrant(userId, grantId);

      if (!result.success) {
        const response: ApiResponse = {
          success: false,
          error: result.error,
        };
        return res.status(400).json(response);
      }

      logger.info({ userId, grantId }, "Voided credit grant");

      const response: ApiResponse = {
        success: true,
        data: { voided: true },
      };

      return res.json(response);
    } catch (error) {
      logger.error({ error, userId, grantId }, "Failed to void credit grant");
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : "Failed to void grant",
      };
      return res.status(500).json(response);
    }
  },
);

// ==========================================
// Auto Top-Up Configuration
// ==========================================

/**
 * GET /credits/:userId/auto-top-up
 * Get auto top-up configuration for a user
 */
router.get("/:userId/auto-top-up", async (req: Request, res: Response) => {
  const { userId } = req.params;

  try {
    const config = await getAutoTopUpConfig(userId);

    const response: ApiResponse = {
      success: true,
      data: config ?? {
        enabled: false,
        configured: false,
      },
    };

    return res.json(response);
  } catch (error) {
    logger.error({ error, userId }, "Failed to get auto top-up config");
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get config",
    };
    return res.status(500).json(response);
  }
});

const autoTopUpConfigSchema = z.object({
  enabled: z.boolean(),
  thresholdCredits: z.number().min(0).max(10000).optional(),
  topUpCredits: z
    .number()
    .min(CREDIT_PRICING.MIN_CREDITS)
    .max(CREDIT_PRICING.MAX_CREDITS)
    .optional(),
  stripePaymentMethodId: z.string().optional(),
  maxMonthlyTopUps: z.number().min(1).max(20).optional(),
});

/**
 * POST /credits/:userId/auto-top-up
 * Configure auto top-up for a user
 */
router.post("/:userId/auto-top-up", async (req: Request, res: Response) => {
  const { userId } = req.params;

  const validation = autoTopUpConfigSchema.safeParse(req.body);
  if (!validation.success) {
    const response: ApiResponse = {
      success: false,
      error: validation.error.issues[0]?.message ?? "Invalid request",
    };
    return res.status(400).json(response);
  }

  try {
    const result = await configureAutoTopUp({
      userId,
      ...validation.data,
    });

    if (!result.success) {
      const response: ApiResponse = {
        success: false,
        error: result.error,
      };
      return res.status(400).json(response);
    }

    logger.info(
      { userId, enabled: validation.data.enabled },
      "Configured auto top-up",
    );

    const response: ApiResponse = {
      success: true,
      data: result.config,
    };

    return res.json(response);
  } catch (error) {
    logger.error({ error, userId }, "Failed to configure auto top-up");
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to configure",
    };
    return res.status(500).json(response);
  }
});

/**
 * DELETE /credits/:userId/auto-top-up
 * Disable auto top-up for a user
 */
router.delete("/:userId/auto-top-up", async (req: Request, res: Response) => {
  const { userId } = req.params;

  try {
    const result = await disableAutoTopUp(userId);

    if (!result.success) {
      const response: ApiResponse = {
        success: false,
        error: result.error,
      };
      return res.status(400).json(response);
    }

    logger.info({ userId }, "Disabled auto top-up");

    const response: ApiResponse = {
      success: true,
      data: { disabled: true },
    };

    return res.json(response);
  } catch (error) {
    logger.error({ error, userId }, "Failed to disable auto top-up");
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to disable",
    };
    return res.status(500).json(response);
  }
});

/**
 * POST /credits/:userId/auto-top-up/trigger
 * Manually trigger auto top-up check for a user
 */
router.post(
  "/:userId/auto-top-up/trigger",
  async (req: Request, res: Response) => {
    const { userId } = req.params;

    try {
      const result = await processAutoTopUp(userId);

      const response: ApiResponse = {
        success: result.success,
        data: result,
        ...(result.error && { error: result.error }),
      };

      return res.json(response);
    } catch (error) {
      logger.error({ error, userId }, "Failed to trigger auto top-up");
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : "Failed to trigger",
      };
      return res.status(500).json(response);
    }
  },
);

// ==========================================
// Admin/System Endpoints
// ==========================================

/**
 * POST /credits/auto-top-up/check-all
 * Run auto top-up check for all eligible users (scheduled job)
 */
router.post("/auto-top-up/check-all", async (_req: Request, res: Response) => {
  try {
    const result = await checkAndProcessAutoTopUps();

    logger.info(
      {
        processed: result.processed,
        successful: result.successful,
        failed: result.failed,
        skipped: result.skipped,
      },
      "Completed auto top-up check for all users",
    );

    const response: ApiResponse = {
      success: true,
      data: {
        processed: result.processed,
        successful: result.successful,
        failed: result.failed,
        skipped: result.skipped,
      },
    };

    return res.json(response);
  } catch (error) {
    logger.error({ error }, "Failed to check all auto top-ups");
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to check",
    };
    return res.status(500).json(response);
  }
});

// ==========================================
// AI Usage Reporting (for AI Proxy)
// ==========================================

const aiUsageSchema = z.object({
  stripeCustomerId: z.string().min(1),
  credits: z.number().min(1),
  meterEventName: z.string().min(1),
  idempotencyKey: z.string().min(1),
  metadata: z.object({
    type: z.literal("ai_usage"),
    projectId: z.string(),
    model: z.string().optional(),
    endpoint: z.string(),
    tokens: z.number().optional(),
    costUsd: z.number(),
  }),
});

/**
 * POST /credits/:userId/ai-usage
 * Report AI usage to Stripe meter for Cloud credits billing
 *
 * This endpoint is called by the AI proxy after each AI request
 * to report usage to the unified shipper_cloud_credits meter.
 */
router.post("/:userId/ai-usage", async (req: Request, res: Response) => {
  const { userId } = req.params;

  const validation = aiUsageSchema.safeParse(req.body);
  if (!validation.success) {
    const response: ApiResponse = {
      success: false,
      error: validation.error.issues[0]?.message ?? "Invalid request",
    };
    return res.status(400).json(response);
  }

  const {
    stripeCustomerId,
    credits,
    meterEventName,
    idempotencyKey,
    metadata,
  } = validation.data;

  try {
    // Import queueMeterEvent dynamically to avoid circular dependency
    const { queueMeterEvent } = await import(
      "../services/meter-event-queue.js"
    );

    // Queue the meter event for Stripe
    const jobId = await queueMeterEvent(
      meterEventName,
      stripeCustomerId,
      credits,
      new Date(),
      idempotencyKey,
    );

    logger.info(
      {
        userId,
        stripeCustomerId,
        credits,
        jobId,
        model: metadata.model,
        endpoint: metadata.endpoint,
        costUsd: metadata.costUsd,
      },
      "Queued AI usage meter event",
    );

    const response: ApiResponse = {
      success: true,
      data: {
        jobId,
        credits,
        queued: true,
      },
    };

    return res.status(201).json(response);
  } catch (error) {
    logger.error(
      { error, userId, credits },
      "Failed to queue AI usage meter event",
    );
    const response: ApiResponse = {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to report AI usage",
    };
    return res.status(500).json(response);
  }
});

// ==========================================
// Shipper Cloud First Deployment Bonus
// ==========================================

const firstDeploymentBonusSchema = z.object({
  projectId: z.string().min(1),
});

/**
 * POST /credits/:userId/first-deployment-bonus
 * Grant $1 bonus Cloud credits on first Shipper Cloud deployment
 *
 * Returns:
 * - granted: true if bonus was granted
 * - granted: false if user already received bonus (idempotent)
 */
router.post(
  "/:userId/first-deployment-bonus",
  async (req: Request, res: Response) => {
    const { userId } = req.params;

    const validation = firstDeploymentBonusSchema.safeParse(req.body);
    if (!validation.success) {
      const response: ApiResponse = {
        success: false,
        error: validation.error.issues[0]?.message ?? "Invalid request",
      };
      return res.status(400).json(response);
    }

    const { projectId } = validation.data;

    try {
      const result = await grantFirstDeploymentBonus(userId, projectId);

      if (!result.success) {
        const response: ApiResponse = {
          success: false,
          error: result.error,
        };
        return res.status(400).json(response);
      }

      logger.info(
        { userId, projectId, granted: result.granted, credits: result.credits },
        "First deployment bonus request processed",
      );

      const response: ApiResponse = {
        success: true,
        data: {
          granted: result.granted,
          credits: result.credits,
          message: result.granted
            ? `BONUS: We've added $1 (${result.credits} credits) free Cloud credits so you can try out databases, AI in your apps, and more!`
            : "User already received the welcome bonus",
        },
      };

      return res.status(result.granted ? 201 : 200).json(response);
    } catch (error) {
      logger.error(
        { error, userId, projectId },
        "Failed to process first deployment bonus",
      );
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : "Failed to grant bonus",
      };
      return res.status(500).json(response);
    }
  },
);

export default router;
