/**
 * Cloud Billing Routes
 *
 * API endpoints for Cloud credits management:
 * - Get balance
 * - Get transaction history
 * - Create Stripe checkout for top-ups
 *
 * All endpoints require authentication and team membership.
 */

import { Router, Request, Response } from "express";
import { prisma } from "@shipper/database";
import Stripe from "stripe";
import { CloudCreditManager } from "../services/cloud-credits.js";
import { logger } from "../config/logger.js";

const router: ReturnType<typeof Router> = Router();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-06-30.basil",
});

/**
 * Middleware to validate user session and team membership
 */
async function validateTeamAccess(req: Request, res: Response, next: Function) {
  const userId = req.headers["x-user-id"] as string;
  const teamId = req.params.teamId || (req.body?.teamId as string);

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized - missing user ID" });
  }

  if (!teamId) {
    return res.status(400).json({ error: "Team ID is required" });
  }

  // Check user is a member of the team
  const membership = await prisma.teamMember.findUnique({
    where: {
      userId_teamId: { userId, teamId },
    },
    select: { role: true },
  });

  if (!membership) {
    return res.status(403).json({ error: "Not a member of this team" });
  }

  // Attach to request
  (req as any).userId = userId;
  (req as any).teamId = teamId;
  (req as any).teamRole = membership.role;

  next();
}

/**
 * GET /api/v1/cloud-billing/:teamId/balance
 * Get current Cloud credit balance for a team
 */
router.get(
  "/:teamId/balance",
  validateTeamAccess,
  async (req: Request, res: Response) => {
    try {
      const teamId = (req as any).teamId;
      const balance = await CloudCreditManager.getBalance(teamId);

      return res.json({
        balance,
        currency: "USD",
        formatted: `$${balance.toFixed(2)}`,
      });
    } catch (error) {
      logger.error({
        msg: "Failed to get Cloud balance",
        error: error instanceof Error ? error.message : String(error),
        teamId: (req as any).teamId,
      });
      return res.status(500).json({ error: "Failed to get balance" });
    }
  },
);

/**
 * GET /api/v1/cloud-billing/:teamId/transactions
 * Get transaction history for a team
 */
router.get(
  "/:teamId/transactions",
  validateTeamAccess,
  async (req: Request, res: Response) => {
    try {
      const teamId = (req as any).teamId;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const type = req.query.type as string | undefined;

      const transactions = await CloudCreditManager.getTransactionHistory(
        teamId,
        {
          limit,
          offset,
          type: type as any,
        },
      );

      return res.json({
        transactions,
        pagination: { limit, offset },
      });
    } catch (error) {
      logger.error({
        msg: "Failed to get Cloud transactions",
        error: error instanceof Error ? error.message : String(error),
        teamId: (req as any).teamId,
      });
      return res.status(500).json({ error: "Failed to get transactions" });
    }
  },
);

/**
 * POST /api/v1/cloud-billing/:teamId/checkout
 * Create a Stripe checkout session for Cloud credit top-up
 *
 * Body: { amount: number } - Amount in USD (min $5, max $500)
 */
router.post(
  "/:teamId/checkout",
  validateTeamAccess,
  async (req: Request, res: Response) => {
    try {
      const teamId = (req as any).teamId;
      const userId = (req as any).userId;
      const { amount } = req.body;

      // Validate amount
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum < 5 || amountNum > 500) {
        return res.status(400).json({
          error: "Invalid amount. Must be between $5 and $500.",
        });
      }

      // Get team info for metadata
      const team = await prisma.team.findUnique({
        where: { id: teamId },
        select: { name: true, slug: true },
      });

      if (!team) {
        return res.status(404).json({ error: "Team not found" });
      }

      // Get user email for Stripe
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });

      // Create Stripe checkout session
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        customer_email: user?.email || undefined,
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: "Cloud Credits Top-up",
                description: `Add $${amountNum.toFixed(2)} to ${team.name} Cloud balance`,
              },
              unit_amount: Math.round(amountNum * 100), // Stripe uses cents
            },
            quantity: 1,
          },
        ],
        metadata: {
          type: "cloud_credit_topup",
          teamId,
          userId,
          amount: amountNum.toString(),
        },
        success_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/${team.slug}/settings/billing?success=true&amount=${amountNum}`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/${team.slug}/settings/billing?canceled=true`,
      });

      logger.info({
        msg: "Cloud credit checkout session created",
        teamId,
        userId,
        amount: amountNum,
        sessionId: session.id,
      });

      return res.json({
        sessionId: session.id,
        url: session.url,
      });
    } catch (error) {
      logger.error({
        msg: "Failed to create Cloud checkout session",
        error: error instanceof Error ? error.message : String(error),
        teamId: (req as any).teamId,
      });
      return res
        .status(500)
        .json({ error: "Failed to create checkout session" });
    }
  },
);

/**
 * POST /api/v1/cloud-billing/webhook
 * Stripe webhook handler for Cloud credit top-ups
 */
router.post("/webhook", async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"] as string;
  const webhookSecret = process.env.STRIPE_CLOUD_WEBHOOK_SECRET;

  if (!webhookSecret) {
    logger.error({ msg: "STRIPE_CLOUD_WEBHOOK_SECRET not configured" });
    return res.status(500).json({ error: "Webhook not configured" });
  }

  let event: Stripe.Event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(
      req.body, // Must be raw body
      sig,
      webhookSecret,
    );
  } catch (err) {
    logger.error({
      msg: "Webhook signature verification failed",
      error: err instanceof Error ? err.message : String(err),
    });
    return res.status(400).json({ error: "Invalid signature" });
  }

  // Handle the event
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    // Only process cloud credit top-ups
    if (session.metadata?.type !== "cloud_credit_topup") {
      return res.json({ received: true, skipped: true });
    }

    const teamId = session.metadata.teamId;
    const amount = parseFloat(session.metadata.amount);

    if (!teamId || isNaN(amount)) {
      logger.error({
        msg: "Invalid webhook metadata",
        metadata: session.metadata,
      });
      return res.status(400).json({ error: "Invalid metadata" });
    }

    try {
      // Add credits to team
      await CloudCreditManager.addCredits(
        teamId,
        amount,
        "TOP_UP",
        `Stripe top-up - $${amount.toFixed(2)}`,
        {
          stripeSessionId: session.id,
          stripePaymentIntentId: session.payment_intent,
        },
      );

      logger.info({
        msg: "Cloud credits added via Stripe",
        teamId,
        amount,
        sessionId: session.id,
      });
    } catch (error) {
      logger.error({
        msg: "Failed to add Cloud credits from webhook",
        error: error instanceof Error ? error.message : String(error),
        teamId,
        amount,
      });
      return res.status(500).json({ error: "Failed to add credits" });
    }
  }

  return res.json({ received: true });
});

export default router;
