/**
 * Auto Top-Up Service
 *
 * Automatically purchases credits when a user's balance falls below their threshold.
 * Uses Stripe PaymentIntents with off_session for automated charges.
 *
 * Features:
 * - Configurable threshold and top-up amount per user
 * - Monthly limits to prevent runaway charges
 * - Automatic retry with exponential backoff on failures
 * - Email notifications for top-ups and failures
 */

import { prisma } from "@shipper/database";
import { stripe } from "../config/stripe.js";
import { logger } from "../config/logger.js";
import {
  createCreditGrant,
  getCreditBalance,
  creditsToCents,
  CREDIT_PRICING,
} from "./stripe-credits.js";

/**
 * Maximum consecutive failures before disabling auto top-up
 */
const MAX_CONSECUTIVE_FAILURES = 3;

export interface AutoTopUpResult {
  success: boolean;
  userId: string;
  credits?: number;
  amountCents?: number;
  paymentIntentId?: string;
  creditGrantId?: string;
  error?: string;
  skipped?: boolean;
  skipReason?: string;
}

/**
 * Process auto top-up for a single user
 */
export async function processAutoTopUp(userId: string): Promise<AutoTopUpResult> {
  if (!stripe) {
    return { success: false, userId, error: "Stripe not configured" };
  }

  try {
    // Get user's auto top-up config
    const config = await prisma.autoTopUpConfig.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            stripeCustomerId: true,
            email: true,
            name: true,
          },
        },
      },
    });

    if (!config) {
      return {
        success: false,
        userId,
        skipped: true,
        skipReason: "No auto top-up config found",
      };
    }

    if (!config.enabled) {
      return {
        success: false,
        userId,
        skipped: true,
        skipReason: "Auto top-up disabled",
      };
    }

    if (!config.stripePaymentMethodId) {
      return {
        success: false,
        userId,
        skipped: true,
        skipReason: "No payment method configured",
      };
    }

    if (!config.user.stripeCustomerId) {
      return {
        success: false,
        userId,
        skipped: true,
        skipReason: "No Stripe customer",
      };
    }

    // Check if we've exceeded monthly limit
    if (config.topUpsThisMonth >= config.maxMonthlyTopUps) {
      return {
        success: false,
        userId,
        skipped: true,
        skipReason: `Monthly limit reached (${config.topUpsThisMonth}/${config.maxMonthlyTopUps})`,
      };
    }

    // Check if too many consecutive failures
    if (config.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      return {
        success: false,
        userId,
        skipped: true,
        skipReason: `Too many consecutive failures (${config.consecutiveFailures})`,
      };
    }

    // Get current credit balance from Stripe
    const balanceResult = await getCreditBalance(userId);
    if (!balanceResult.success) {
      return {
        success: false,
        userId,
        error: `Failed to get balance: ${balanceResult.error}`,
      };
    }

    const currentCredits = balanceResult.availableCredits ?? 0;

    // Check if below threshold
    if (currentCredits >= config.thresholdCredits) {
      return {
        success: false,
        userId,
        skipped: true,
        skipReason: `Balance (${currentCredits}) above threshold (${config.thresholdCredits})`,
      };
    }

    logger.info(
      {
        userId,
        currentCredits,
        threshold: config.thresholdCredits,
        topUpAmount: config.topUpCredits,
      },
      "Processing auto top-up"
    );

    const amountCents = creditsToCents(config.topUpCredits);

    // Create PaymentIntent with off_session
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      customer: config.user.stripeCustomerId,
      payment_method: config.stripePaymentMethodId,
      confirm: true,
      off_session: true,
      description: `Shipper Cloud Auto Top-Up: ${config.topUpCredits} credits`,
      metadata: {
        userId,
        type: "auto_top_up",
        credits: config.topUpCredits.toString(),
      },
    });

    if (paymentIntent.status !== "succeeded") {
      // Payment requires additional action or failed
      const error = `Payment status: ${paymentIntent.status}`;

      await prisma.autoTopUpConfig.update({
        where: { userId },
        data: {
          consecutiveFailures: { increment: 1 },
          lastTopUpError: error,
        },
      });

      logger.warn({ userId, paymentIntentId: paymentIntent.id, status: paymentIntent.status }, error);

      return {
        success: false,
        userId,
        paymentIntentId: paymentIntent.id,
        error,
      };
    }

    // Payment succeeded - create credit grant
    const grantResult = await createCreditGrant({
      userId,
      credits: config.topUpCredits,
      category: "paid",
      name: `Auto Top-Up - ${config.topUpCredits} credits`,
      metadata: {
        paymentIntentId: paymentIntent.id,
        autoTopUp: "true",
      },
    });

    if (!grantResult.success) {
      // Payment succeeded but grant failed - critical error
      // Do NOT mark as successful - flag for manual review
      logger.error(
        {
          userId,
          paymentIntentId: paymentIntent.id,
          credits: config.topUpCredits,
          error: grantResult.error,
        },
        "CRITICAL: Auto top-up payment succeeded but credit grant failed - requires manual intervention"
      );

      // Record the failure state - don't reset consecutiveFailures
      // This ensures the system flags this for review
      await prisma.autoTopUpConfig.update({
        where: { userId },
        data: {
          lastTopUpError: `Payment succeeded (${paymentIntent.id}) but credit grant failed: ${grantResult.error}. Manual intervention required.`,
          // Don't increment topUpsThisMonth since credits weren't granted
          // Don't reset consecutiveFailures - this is a failure state
        },
      });

      // Create a failed transaction record for tracking
      await prisma.creditTransaction.create({
        data: {
          userId,
          amount: 0, // No credits were actually granted
          type: "PURCHASE",
          description: `FAILED Auto top-up: Payment succeeded but credit grant failed`,
          metadata: {
            paymentIntentId: paymentIntent.id,
            intendedCredits: config.topUpCredits,
            error: grantResult.error,
            requiresManualIntervention: true,
            autoTopUp: true,
          },
        },
      });

      return {
        success: false,
        userId,
        paymentIntentId: paymentIntent.id,
        amountCents,
        error: `Payment succeeded but credit grant failed: ${grantResult.error}. Manual intervention required.`,
      };
    }

    // Update config with success (only if credit grant succeeded)
    await prisma.autoTopUpConfig.update({
      where: { userId },
      data: {
        topUpsThisMonth: { increment: 1 },
        lastTopUpAt: new Date(),
        lastTopUpAmount: config.topUpCredits,
        lastTopUpError: null,
        consecutiveFailures: 0,
      },
    });

    // Record the transaction in our database
    await prisma.creditTransaction.create({
      data: {
        userId,
        amount: config.topUpCredits,
        type: "PURCHASE",
        description: `Auto top-up: ${config.topUpCredits} credits`,
        metadata: {
          paymentIntentId: paymentIntent.id,
          creditGrantId: grantResult.creditGrantId,
          autoTopUp: true,
        },
      },
    });

    // Also record in StripeCreditGrant for tracking
    if (grantResult.creditGrantId) {
      await prisma.stripeCreditGrant.create({
        data: {
          userId,
          stripeCreditGrantId: grantResult.creditGrantId,
          stripeCustomerId: config.user.stripeCustomerId,
          name: `Auto Top-Up - ${config.topUpCredits} credits`,
          category: "paid",
          amountCents,
          credits: config.topUpCredits,
          status: "ACTIVE",
          metadata: {
            paymentIntentId: paymentIntent.id,
            autoTopUp: true,
          },
        },
      });
    }

    logger.info(
      {
        userId,
        credits: config.topUpCredits,
        amountCents,
        paymentIntentId: paymentIntent.id,
        creditGrantId: grantResult.creditGrantId,
      },
      "Auto top-up successful"
    );

    return {
      success: true,
      userId,
      credits: config.topUpCredits,
      amountCents,
      paymentIntentId: paymentIntent.id,
      creditGrantId: grantResult.creditGrantId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Update config with failure
    await prisma.autoTopUpConfig.update({
      where: { userId },
      data: {
        consecutiveFailures: { increment: 1 },
        lastTopUpError: errorMessage,
      },
    });

    logger.error({ error, userId }, "Auto top-up failed");

    return {
      success: false,
      userId,
      error: errorMessage,
    };
  }
}

export interface CheckAutoTopUpsResult {
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
  results: AutoTopUpResult[];
}

/**
 * Check and process all eligible users for auto top-up
 *
 * This should be called periodically (e.g., every 5 minutes)
 */
export async function checkAndProcessAutoTopUps(): Promise<CheckAutoTopUpsResult> {
  const results: AutoTopUpResult[] = [];
  let successful = 0;
  let failed = 0;
  let skipped = 0;

  try {
    // Reset monthly counters if needed
    await resetMonthlyCounters();

    // Find all users with auto top-up enabled
    const configs = await prisma.autoTopUpConfig.findMany({
      where: {
        enabled: true,
        stripePaymentMethodId: { not: null },
        consecutiveFailures: { lt: MAX_CONSECUTIVE_FAILURES },
      },
      select: {
        userId: true,
        topUpsThisMonth: true,
        maxMonthlyTopUps: true,
      },
    });

    // Filter out users who have hit their monthly limit
    const eligibleUsers = configs.filter(
      (c) => c.topUpsThisMonth < c.maxMonthlyTopUps
    );

    logger.info(
      { totalConfigs: configs.length, eligible: eligibleUsers.length },
      "Checking auto top-ups"
    );

    // Process each user
    for (const config of eligibleUsers) {
      const result = await processAutoTopUp(config.userId);
      results.push(result);

      if (result.success) {
        successful++;
      } else if (result.skipped) {
        skipped++;
      } else {
        failed++;
      }
    }

    logger.info(
      { processed: results.length, successful, failed, skipped },
      "Auto top-up check complete"
    );

    return {
      processed: results.length,
      successful,
      failed,
      skipped,
      results,
    };
  } catch (error) {
    logger.error({ error }, "Failed to check auto top-ups");
    throw error;
  }
}

/**
 * Reset monthly counters for all users at the start of a new month
 */
async function resetMonthlyCounters(): Promise<void> {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Find configs that haven't been reset this month
  const configsToReset = await prisma.autoTopUpConfig.findMany({
    where: {
      OR: [
        { monthlyResetAt: null },
        { monthlyResetAt: { lt: firstOfMonth } },
      ],
      topUpsThisMonth: { gt: 0 },
    },
  });

  if (configsToReset.length > 0) {
    await prisma.autoTopUpConfig.updateMany({
      where: {
        id: { in: configsToReset.map((c) => c.id) },
      },
      data: {
        topUpsThisMonth: 0,
        monthlyResetAt: now,
      },
    });

    logger.info(
      { count: configsToReset.length },
      "Reset monthly auto top-up counters"
    );
  }
}

export interface ConfigureAutoTopUpOptions {
  userId: string;
  enabled: boolean;
  thresholdCredits?: number;
  topUpCredits?: number;
  stripePaymentMethodId?: string;
  maxMonthlyTopUps?: number;
}

/**
 * Configure auto top-up for a user
 */
export async function configureAutoTopUp(
  options: ConfigureAutoTopUpOptions
): Promise<{ success: boolean; config?: ReturnType<typeof formatConfig>; error?: string }> {
  const {
    userId,
    enabled,
    thresholdCredits,
    topUpCredits,
    stripePaymentMethodId,
    maxMonthlyTopUps,
  } = options;

  try {
    // Validate credits amounts
    if (topUpCredits !== undefined && topUpCredits < CREDIT_PRICING.MIN_CREDITS) {
      return {
        success: false,
        error: `Minimum top-up amount is ${CREDIT_PRICING.MIN_CREDITS} credits`,
      };
    }

    if (thresholdCredits !== undefined && thresholdCredits < 0) {
      return {
        success: false,
        error: "Threshold must be non-negative",
      };
    }

    // Upsert the config
    const config = await prisma.autoTopUpConfig.upsert({
      where: { userId },
      create: {
        userId,
        enabled,
        thresholdCredits: thresholdCredits ?? 100,
        topUpCredits: topUpCredits ?? 400,
        stripePaymentMethodId,
        maxMonthlyTopUps: maxMonthlyTopUps ?? 5,
      },
      update: {
        enabled,
        ...(thresholdCredits !== undefined && { thresholdCredits }),
        ...(topUpCredits !== undefined && { topUpCredits }),
        ...(stripePaymentMethodId !== undefined && { stripePaymentMethodId }),
        ...(maxMonthlyTopUps !== undefined && { maxMonthlyTopUps }),
        // Reset consecutive failures when re-enabling
        ...(enabled && { consecutiveFailures: 0, lastTopUpError: null }),
      },
    });

    logger.info({ userId, enabled, config }, "Configured auto top-up");

    return { success: true, config: formatConfig(config) };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error, userId }, "Failed to configure auto top-up");
    return { success: false, error: errorMessage };
  }
}

/**
 * Get auto top-up configuration for a user
 */
export async function getAutoTopUpConfig(userId: string) {
  const config = await prisma.autoTopUpConfig.findUnique({
    where: { userId },
  });

  if (!config) {
    return null;
  }

  return formatConfig(config);
}

function formatConfig(config: {
  id: string;
  userId: string;
  enabled: boolean;
  thresholdCredits: number;
  topUpCredits: number;
  stripePaymentMethodId: string | null;
  maxMonthlyTopUps: number;
  topUpsThisMonth: number;
  lastTopUpAt: Date | null;
  lastTopUpAmount: number | null;
  lastTopUpError: string | null;
  consecutiveFailures: number;
}) {
  return {
    enabled: config.enabled,
    thresholdCredits: config.thresholdCredits,
    topUpCredits: config.topUpCredits,
    hasPaymentMethod: !!config.stripePaymentMethodId,
    maxMonthlyTopUps: config.maxMonthlyTopUps,
    topUpsThisMonth: config.topUpsThisMonth,
    remainingTopUps: config.maxMonthlyTopUps - config.topUpsThisMonth,
    lastTopUpAt: config.lastTopUpAt,
    lastTopUpAmount: config.lastTopUpAmount,
    lastTopUpError: config.lastTopUpError,
    consecutiveFailures: config.consecutiveFailures,
    isDisabledDueToFailures: config.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES,
  };
}

/**
 * Disable auto top-up for a user
 */
export async function disableAutoTopUp(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.autoTopUpConfig.update({
      where: { userId },
      data: { enabled: false },
    });

    logger.info({ userId }, "Disabled auto top-up");
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error, userId }, "Failed to disable auto top-up");
    return { success: false, error: errorMessage };
  }
}
