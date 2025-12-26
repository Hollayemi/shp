/**
 * User Billing Routes
 *
 * Endpoints for managing user subscription metered billing:
 * - Add Convex metered prices to user subscription
 * - Migrate all users to metered billing
 */

import { Router, Request, Response, type Router as ExpressRouter } from "express";
import { z } from "zod";
import type { ApiResponse } from "@shipper/shared";
import {
  addConvexMeteredPricesToUserSubscription,
  addConvexMeteredPricesToSubscription,
  addShipperCloudCreditsToSubscription,
  migrateAllUsersToConvexMeteredBilling,
} from "../services/stripe-billing.js";
import { logger } from "../config/logger.js";

const router: ExpressRouter = Router();

const userIdSchema = z.object({
  userId: z.string().min(1),
});

const subscriptionIdSchema = z.object({
  subscriptionId: z.string().min(1),
});

/**
 * POST /users/:userId/add-convex-metered-prices
 * Add Convex metered prices to a user's subscription
 */
router.post("/:userId/add-convex-metered-prices", async (req: Request, res: Response) => {
  const { userId } = req.params;

  if (!userId) {
    const response: ApiResponse = {
      success: false,
      error: "User ID required",
    };
    return res.status(400).json(response);
  }

  try {
    const result = await addConvexMeteredPricesToUserSubscription(userId);

    if (!result.success) {
      const response: ApiResponse = {
        success: false,
        error: result.error ?? "Failed to add metered prices",
      };
      return res.status(400).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: {
        userId,
        subscriptionId: result.subscriptionId,
        addedPrices: result.addedPrices,
        skippedPrices: result.skippedPrices,
      },
    };

    logger.info(
      { userId, addedPrices: result.addedPrices },
      "Added Convex metered prices to user subscription"
    );

    return res.json(response);
  } catch (error) {
    logger.error({ error, userId }, "Failed to add Convex metered prices");

    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to add metered prices",
    };

    return res.status(500).json(response);
  }
});

/**
 * POST /users/subscription/:subscriptionId/add-convex-metered-prices
 * Add Convex metered prices to a subscription by subscription ID
 */
router.post(
  "/subscription/:subscriptionId/add-convex-metered-prices",
  async (req: Request, res: Response) => {
    const { subscriptionId } = req.params;

    if (!subscriptionId) {
      const response: ApiResponse = {
        success: false,
        error: "Subscription ID required",
      };
      return res.status(400).json(response);
    }

    try {
      const result = await addConvexMeteredPricesToSubscription(subscriptionId);

      if (!result.success) {
        const response: ApiResponse = {
          success: false,
          error: result.error ?? "Failed to add metered prices",
        };
        return res.status(400).json(response);
      }

      const response: ApiResponse = {
        success: true,
        data: {
          subscriptionId,
          addedPrices: result.addedPrices,
          skippedPrices: result.skippedPrices,
        },
      };

      logger.info(
        { subscriptionId, addedPrices: result.addedPrices },
        "Added Convex metered prices to subscription"
      );

      return res.json(response);
    } catch (error) {
      logger.error({ error, subscriptionId }, "Failed to add Convex metered prices");

      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : "Failed to add metered prices",
      };

      return res.status(500).json(response);
    }
  }
);

/**
 * POST /users/subscription/:subscriptionId/add-shipper-cloud-credits
 * Add Shipper Cloud Credits price to a subscription (new unified meter)
 */
router.post(
  "/subscription/:subscriptionId/add-shipper-cloud-credits",
  async (req: Request, res: Response) => {
    const { subscriptionId } = req.params;

    if (!subscriptionId) {
      const response: ApiResponse = {
        success: false,
        error: "Subscription ID required",
      };
      return res.status(400).json(response);
    }

    try {
      const result = await addShipperCloudCreditsToSubscription(subscriptionId);

      if (!result.success) {
        const response: ApiResponse = {
          success: false,
          error: result.error ?? "Failed to add Shipper Cloud Credits",
        };
        return res.status(400).json(response);
      }

      const response: ApiResponse = {
        success: true,
        data: {
          subscriptionId,
          added: result.added,
        },
      };

      logger.info(
        { subscriptionId, added: result.added },
        "Added Shipper Cloud Credits to subscription"
      );

      return res.json(response);
    } catch (error) {
      logger.error({ error, subscriptionId }, "Failed to add Shipper Cloud Credits");

      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : "Failed to add Shipper Cloud Credits",
      };

      return res.status(500).json(response);
    }
  }
);

/**
 * POST /users/migrate-to-convex-metered-billing
 * @deprecated Use /subscription/:subscriptionId/add-shipper-cloud-credits instead
 * Migrate all existing PRO/ENTERPRISE users to have Convex metered prices
 * This is a one-time migration endpoint
 */
router.post("/migrate-to-convex-metered-billing", async (_req: Request, res: Response) => {
  try {
    logger.info("Starting Convex metered billing migration for all users");

    const result = await migrateAllUsersToConvexMeteredBilling();

    const response: ApiResponse = {
      success: true,
      data: {
        total: result.total,
        successful: result.successful,
        failed: result.failed,
        skipped: result.skipped,
        errors: result.errors,
      },
    };

    logger.info(
      {
        total: result.total,
        successful: result.successful,
        failed: result.failed,
        skipped: result.skipped,
      },
      "Completed Convex metered billing migration"
    );

    return res.json(response);
  } catch (error) {
    logger.error({ error }, "Failed to run Convex metered billing migration");

    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to run migration",
    };

    return res.status(500).json(response);
  }
});

export default router;
