/**
 * Team Billing Routes
 *
 * Endpoints for managing team billing:
 * - Enable/disable billing for a team
 * - View usage and costs
 * - Manage Stripe subscription
 */

import { Router, Request, Response, type Router as ExpressRouter } from "express";
import { z } from "zod";
import type { ApiResponse } from "@shipper/shared";
import { prisma } from "@shipper/database";
import {
  createTeamSubscription,
  cancelTeamSubscription,
  getTeamUsageSummary,
  reportUsageToStripe,
} from "../services/stripe-billing.js";
import { logger } from "../config/logger.js";

const router: ExpressRouter = Router();

const teamIdSchema = z.object({
  teamId: z.string().min(1),
});

const enableBillingSchema = z.object({
  teamId: z.string().min(1),
  billingEmail: z.string().email(),
});

/**
 * POST /teams/billing/enable
 * Enable billing for a team (creates Stripe subscription)
 */
router.post("/billing/enable", async (req: Request, res: Response) => {
  const parsed = enableBillingSchema.safeParse(req.body);
  if (!parsed.success) {
    const response: ApiResponse = {
      success: false,
      error: "Invalid request body",
    };
    return res.status(400).json(response);
  }

  const { teamId, billingEmail } = parsed.data;

  try {
    // Update billing email first
    await prisma.team.update({
      where: { id: teamId },
      data: { billingEmail },
    });

    const subscriptionId = await createTeamSubscription(teamId);

    const response: ApiResponse = {
      success: true,
      data: {
        teamId,
        subscriptionId,
        billingEnabled: true,
      },
    };

    return res.json(response);
  } catch (error) {
    logger.error({ error, teamId }, "Failed to enable billing");

    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to enable billing",
    };

    return res.status(500).json(response);
  }
});

/**
 * POST /teams/billing/disable
 * Disable billing for a team (cancels Stripe subscription)
 */
router.post("/billing/disable", async (req: Request, res: Response) => {
  const parsed = teamIdSchema.safeParse(req.body);
  if (!parsed.success) {
    const response: ApiResponse = {
      success: false,
      error: "Invalid request body",
    };
    return res.status(400).json(response);
  }

  const { teamId } = parsed.data;

  try {
    await cancelTeamSubscription(teamId);

    const response: ApiResponse = {
      success: true,
      data: {
        teamId,
        billingEnabled: false,
      },
    };

    return res.json(response);
  } catch (error) {
    logger.error({ error, teamId }, "Failed to disable billing");

    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to disable billing",
    };

    return res.status(500).json(response);
  }
});

/**
 * GET /teams/:teamId/usage
 * Get current usage summary for a team
 */
router.get("/:teamId/usage", async (req: Request, res: Response) => {
  const { teamId } = req.params;

  if (!teamId) {
    const response: ApiResponse = {
      success: false,
      error: "Team ID required",
    };
    return res.status(400).json(response);
  }

  try {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        name: true,
        billingEnabled: true,
        stripeSubscriptionId: true,
      },
    });

    if (!team) {
      const response: ApiResponse = {
        success: false,
        error: "Team not found",
      };
      return res.status(404).json(response);
    }

    const usage = await getTeamUsageSummary(teamId);

    const response: ApiResponse = {
      success: true,
      data: {
        team: {
          id: team.id,
          name: team.name,
          billingEnabled: team.billingEnabled,
          hasSubscription: !!team.stripeSubscriptionId,
        },
        usage,
      },
    };

    return res.json(response);
  } catch (error) {
    logger.error({ error, teamId }, "Failed to get usage");

    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get usage",
    };

    return res.status(500).json(response);
  }
});

/**
 * POST /teams/:teamId/report-usage
 * Manually trigger usage reporting to Stripe
 */
router.post("/:teamId/report-usage", async (req: Request, res: Response) => {
  const { teamId } = req.params;

  if (!teamId) {
    const response: ApiResponse = {
      success: false,
      error: "Team ID required",
    };
    return res.status(400).json(response);
  }

  try {
    await reportUsageToStripe(teamId);

    const response: ApiResponse = {
      success: true,
      data: {
        teamId,
        reported: true,
      },
    };

    return res.json(response);
  } catch (error) {
    logger.error({ error, teamId }, "Failed to report usage");

    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to report usage",
    };

    return res.status(500).json(response);
  }
});

/**
 * GET /teams/:teamId/billing-status
 * Get billing status for a team
 */
router.get("/:teamId/billing-status", async (req: Request, res: Response) => {
  const { teamId } = req.params;

  if (!teamId) {
    const response: ApiResponse = {
      success: false,
      error: "Team ID required",
    };
    return res.status(400).json(response);
  }

  try {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        name: true,
        billingEnabled: true,
        billingEmail: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
      },
    });

    if (!team) {
      const response: ApiResponse = {
        success: false,
        error: "Team not found",
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: {
        teamId: team.id,
        teamName: team.name,
        billingEnabled: team.billingEnabled,
        billingEmail: team.billingEmail,
        hasStripeCustomer: !!team.stripeCustomerId,
        hasSubscription: !!team.stripeSubscriptionId,
      },
    };

    return res.json(response);
  } catch (error) {
    logger.error({ error, teamId }, "Failed to get billing status");

    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get billing status",
    };

    return res.status(500).json(response);
  }
});

export default router;
