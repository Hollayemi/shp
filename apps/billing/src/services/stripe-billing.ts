/**
 * Stripe Billing Service
 *
 * Handles team billing operations:
 * - Creating Stripe customers for teams
 * - Managing metered billing subscriptions
 * - Reporting usage to Stripe via Billing Meters
 * - Calculating and displaying costs
 *
 * Uses the new Stripe Billing Meters API instead of legacy usage records.
 * @see https://docs.stripe.com/billing/subscriptions/usage-based
 */

import { prisma, ConvexBillingStatus } from "@shipper/database";
import { stripe, CONVEX_BILLING_CONFIG, SHIPPER_CLOUD_CONFIG } from "../config/stripe.js";
import { logger } from "../config/logger.js";
import { getCurrentBillingPeriod } from "./convex-usage.js";
import {
  reportConvexUsageToStripe,
  type ConvexUsageMetrics,
} from "./stripe-meters.js";
import { calculateCreditsFromConvexUsage } from "./shipper-cloud-credits.js";

const BYTES_PER_GB = 1024 * 1024 * 1024;
const MS_PER_HOUR = 3600000;
const MB_PER_GB = 1024;

/**
 * Create a Stripe customer for a team
 */
export async function createTeamCustomer(
  teamId: string,
  email: string,
  teamName: string
): Promise<string | null> {
  if (!stripe) {
    logger.error("Stripe not configured");
    return null;
  }

  try {
    const customer = await stripe.customers.create({
      email,
      name: teamName,
      metadata: {
        teamId,
        source: "shipper-billing",
      },
    });

    await prisma.team.update({
      where: { id: teamId },
      data: {
        stripeCustomerId: customer.id,
        billingEmail: email,
      },
    });

    logger.info({ teamId, customerId: customer.id }, "Created Stripe customer for team");
    return customer.id;
  } catch (error) {
    logger.error({ error, teamId }, "Failed to create Stripe customer");
    throw error;
  }
}

/**
 * Create a metered billing subscription for a team
 */
export async function createTeamSubscription(teamId: string): Promise<string | null> {
  if (!stripe) {
    logger.error("Stripe not configured");
    return null;
  }

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      billingEmail: true,
      name: true,
    },
  });

  if (!team) {
    throw new Error(`Team ${teamId} not found`);
  }

  // Create customer if not exists
  let customerId = team.stripeCustomerId;
  if (!customerId) {
    if (!team.billingEmail) {
      throw new Error("Team must have a billing email to create subscription");
    }
    customerId = await createTeamCustomer(teamId, team.billingEmail, team.name);
    if (!customerId) {
      throw new Error("Failed to create Stripe customer");
    }
  }

  // Check if subscription already exists
  if (team.stripeSubscriptionId) {
    logger.info({ teamId }, "Team already has a subscription");
    return team.stripeSubscriptionId;
  }

  // Use the unified Shipper Cloud Credits price
  const shipperCloudPriceId = SHIPPER_CLOUD_CONFIG.priceId;

  if (!shipperCloudPriceId) {
    throw new Error("Shipper Cloud Credits price not configured - set STRIPE_SHIPPER_CLOUD_CREDITS_PRICE_ID");
  }

  try {
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: shipperCloudPriceId }],
      metadata: {
        teamId,
        type: "shipper_cloud_credits",
      },
    });

    await prisma.team.update({
      where: { id: teamId },
      data: {
        stripeSubscriptionId: subscription.id,
        billingEnabled: true,
      },
    });

    logger.info({ teamId, subscriptionId: subscription.id }, "Created metered subscription for team");
    return subscription.id;
  } catch (error) {
    logger.error({ error, teamId }, "Failed to create subscription");
    throw error;
  }
}

/**
 * Report usage to Stripe for a team's billing period
 *
 * Uses Stripe Billing Meters API to send meter events.
 * Meter events are processed asynchronously and aggregated by Stripe.
 */
export async function reportUsageToStripe(teamId: string): Promise<void> {
  if (!stripe) {
    logger.error("Stripe not configured");
    return;
  }

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      billingEnabled: true,
    },
  });

  if (!team?.stripeCustomerId || !team.billingEnabled) {
    logger.warn({ teamId }, "Team not set up for billing (no Stripe customer)");
    return;
  }

  const { start: periodStart, end: periodEnd } = getCurrentBillingPeriod();

  // First, aggregate usage if not done
  await aggregateUsageForPeriod(teamId, periodStart, periodEnd);

  // Get the aggregated period
  const period = await prisma.convexUsagePeriod.findUnique({
    where: {
      teamId_periodStart_periodEnd: {
        teamId,
        periodStart,
        periodEnd,
      },
    },
  });

  if (!period || period.status === "REPORTED" || period.status === "BILLED" || period.status === "PAID") {
    logger.info({ teamId, periodStart }, "Usage already reported or no usage to report");
    return;
  }

  // Build metrics object from the aggregated period
  const metrics: ConvexUsageMetrics = {
    functionCalls: period.totalFunctionCalls,
    actionComputeMs: period.totalActionComputeMs,
    databaseBandwidthBytes: period.totalDatabaseBandwidthBytes,
    databaseStorageBytes: period.peakDatabaseStorageBytes,
    fileBandwidthBytes: period.totalFileBandwidthBytes,
    fileStorageBytes: period.peakFileStorageBytes,
    vectorBandwidthBytes: period.totalVectorBandwidthBytes,
    vectorStorageBytes: period.peakVectorStorageBytes,
  };

  // Queue meter events for Stripe (processed asynchronously with rate limiting)
  const result = await reportConvexUsageToStripe(
    team.stripeCustomerId,
    metrics,
    period.id
  );

  logger.info(
    { teamId, periodStart, queued: result.queued, skipped: result.skipped },
    "Queued usage meter events"
  );

  // Mark period as reported
  await prisma.convexUsagePeriod.update({
    where: { id: period.id },
    data: {
      status: ConvexBillingStatus.REPORTED,
      reportedToStripeAt: new Date(),
    },
  });
}

/**
 * Aggregate usage for a team's billing period and calculate costs
 */
export async function aggregateUsageForPeriod(
  teamId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<void> {
  // Get or create the usage period
  let period = await prisma.convexUsagePeriod.findUnique({
    where: {
      teamId_periodStart_periodEnd: {
        teamId,
        periodStart,
        periodEnd,
      },
    },
  });

  if (!period) {
    period = await prisma.convexUsagePeriod.create({
      data: {
        teamId,
        periodStart,
        periodEnd,
        status: ConvexBillingStatus.PENDING,
      },
    });
  }

  // Aggregate usage from all ConvexDeployments that belong to projects in this team
  // and have usage within the current billing period
  const deploymentMetrics = await prisma.convexDeployment.aggregate({
    where: {
      project: {
        teamId,
      },
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
    },
    _sum: {
      totalFunctionCalls: true,
      totalActionComputeMs: true,
      totalDatabaseBandwidthBytes: true,
      totalFileBandwidthBytes: true,
      totalVectorBandwidthBytes: true,
    },
  });

  const totalFunctionCalls = deploymentMetrics._sum.totalFunctionCalls ?? BigInt(0);
  const totalActionComputeMs = deploymentMetrics._sum.totalActionComputeMs ?? BigInt(0);
  const totalDatabaseBandwidthBytes = deploymentMetrics._sum.totalDatabaseBandwidthBytes ?? BigInt(0);
  const totalFileBandwidthBytes = deploymentMetrics._sum.totalFileBandwidthBytes ?? BigInt(0);
  const totalVectorBandwidthBytes = deploymentMetrics._sum.totalVectorBandwidthBytes ?? BigInt(0);

  // Calculate costs
  const rates = CONVEX_BILLING_CONFIG.rates;

  const functionCallsCost = Math.round(
    (Number(totalFunctionCalls) / 1_000_000) * rates.functionCallsPerMillion
  );
  const actionComputeCost = Math.round(
    ((128 / MB_PER_GB) * (Number(totalActionComputeMs) / MS_PER_HOUR)) * rates.actionComputePerGBHour
  );
  const databaseBandwidthCost = Math.round(
    (Number(totalDatabaseBandwidthBytes) / BYTES_PER_GB) * rates.databaseBandwidthPerGB
  );
  const databaseStorageCost = Math.round(
    (Number(period.peakDatabaseStorageBytes) / BYTES_PER_GB) * rates.databaseStoragePerGB
  );
  const fileBandwidthCost = Math.round(
    (Number(totalFileBandwidthBytes) / BYTES_PER_GB) * rates.fileBandwidthPerGB
  );
  const fileStorageCost = Math.round(
    (Number(period.peakFileStorageBytes) / BYTES_PER_GB) * rates.fileStoragePerGB
  );
  const vectorBandwidthCost = Math.round(
    (Number(totalVectorBandwidthBytes) / BYTES_PER_GB) * rates.vectorBandwidthPerGB
  );
  const vectorStorageCost = Math.round(
    (Number(period.peakVectorStorageBytes) / BYTES_PER_GB) * rates.vectorStoragePerGB
  );

  const totalCost =
    functionCallsCost +
    actionComputeCost +
    databaseBandwidthCost +
    databaseStorageCost +
    fileBandwidthCost +
    fileStorageCost +
    vectorBandwidthCost +
    vectorStorageCost;

  // Update the period
  await prisma.convexUsagePeriod.update({
    where: { id: period.id },
    data: {
      totalFunctionCalls,
      totalActionComputeMs,
      totalDatabaseBandwidthBytes,
      totalFileBandwidthBytes,
      totalVectorBandwidthBytes,
      functionCallsCost,
      actionComputeCost,
      databaseBandwidthCost,
      databaseStorageCost,
      fileBandwidthCost,
      fileStorageCost,
      vectorBandwidthCost,
      vectorStorageCost,
      totalCost,
      status: ConvexBillingStatus.CALCULATED,
    },
  });

  logger.info({ teamId, periodStart, totalCost }, "Aggregated usage for period");
}

/**
 * Get usage summary for a team
 */
export async function getTeamUsageSummary(teamId: string) {
  const { start, end } = getCurrentBillingPeriod();

  // Ensure we have latest aggregation
  await aggregateUsageForPeriod(teamId, start, end);

  const period = await prisma.convexUsagePeriod.findUnique({
    where: {
      teamId_periodStart_periodEnd: {
        teamId,
        periodStart: start,
        periodEnd: end,
      },
    },
  });

  if (!period) {
    return null;
  }

  return {
    period: { start, end },
    usage: {
      functionCalls: period.totalFunctionCalls.toString(),
      actionComputeMs: period.totalActionComputeMs.toString(),
      databaseBandwidthBytes: period.totalDatabaseBandwidthBytes.toString(),
      fileBandwidthBytes: period.totalFileBandwidthBytes.toString(),
      vectorBandwidthBytes: period.totalVectorBandwidthBytes.toString(),
      peakDatabaseStorageBytes: period.peakDatabaseStorageBytes.toString(),
      peakFileStorageBytes: period.peakFileStorageBytes.toString(),
      peakVectorStorageBytes: period.peakVectorStorageBytes.toString(),
    },
    costs: {
      functionCalls: period.functionCallsCost,
      actionCompute: period.actionComputeCost,
      databaseBandwidth: period.databaseBandwidthCost,
      databaseStorage: period.databaseStorageCost,
      fileBandwidth: period.fileBandwidthCost,
      fileStorage: period.fileStorageCost,
      vectorBandwidth: period.vectorBandwidthCost,
      vectorStorage: period.vectorStorageCost,
      total: period.totalCost,
    },
    status: period.status,
  };
}

/**
 * Get the Shipper Cloud Credits price item to add to a subscription
 * Now uses a single unified meter instead of 8 separate meters
 */
function getShipperCloudCreditsPriceItem(): { price: string } | null {
  const priceId = SHIPPER_CLOUD_CONFIG.priceId;
  if (!priceId) {
    logger.warn("STRIPE_SHIPPER_CLOUD_CREDITS_PRICE_ID not configured");
    return null;
  }
  return { price: priceId };
}

/**
 * @deprecated Use getShipperCloudCreditsPriceItem() instead
 * Legacy function kept for backwards compatibility during migration
 */
function getConvexMeteredPriceItems(): Array<{ price: string }> {
  const item = getShipperCloudCreditsPriceItem();
  return item ? [item] : [];
}

/**
 * Check if a subscription already has Shipper Cloud Credits price attached
 */
async function subscriptionHasShipperCloudCreditsPrice(
  subscriptionId: string
): Promise<{ hasMeteredPrice: boolean; existingPriceId: string | null }> {
  if (!stripe) {
    throw new Error("Stripe not configured");
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price"],
  });

  const shipperCloudPriceId = SHIPPER_CLOUD_CONFIG.priceId;

  for (const item of subscription.items.data) {
    const priceId = typeof item.price === "string" ? item.price : item.price.id;
    if (priceId === shipperCloudPriceId) {
      return {
        hasMeteredPrice: true,
        existingPriceId: priceId,
      };
    }
  }

  return {
    hasMeteredPrice: false,
    existingPriceId: null,
  };
}

/**
 * @deprecated Use subscriptionHasShipperCloudCreditsPrice() instead
 */
async function subscriptionHasConvexMeteredPrices(
  subscriptionId: string
): Promise<{ hasMeteredPrices: boolean; existingPriceIds: string[] }> {
  const result = await subscriptionHasShipperCloudCreditsPrice(subscriptionId);
  return {
    hasMeteredPrices: result.hasMeteredPrice,
    existingPriceIds: result.existingPriceId ? [result.existingPriceId] : [],
  };
}

/**
 * Add Shipper Cloud Credits metered price to an existing subscription.
 * This enables usage-based billing for Shipper Cloud (Convex) resources.
 *
 * Uses a single unified meter instead of 8 separate meters.
 * All Convex usage is converted to credits: 1 credit = 1 cent ($0.01)
 *
 * @param subscriptionId - The Stripe subscription ID to update
 * @returns Object with success status and details
 */
export async function addShipperCloudCreditsToSubscription(
  subscriptionId: string
): Promise<{
  success: boolean;
  added: boolean;
  error?: string;
}> {
  if (!stripe) {
    return { success: false, added: false, error: "Stripe not configured" };
  }

  const priceItem = getShipperCloudCreditsPriceItem();
  if (!priceItem) {
    return { success: false, added: false, error: "Shipper Cloud Credits price not configured" };
  }

  try {
    // Check if already attached
    const { hasMeteredPrice } = await subscriptionHasShipperCloudCreditsPrice(subscriptionId);

    if (hasMeteredPrice) {
      logger.info({ subscriptionId }, "Shipper Cloud Credits price already attached");
      return { success: true, added: false };
    }

    // Add the Shipper Cloud Credits price to the subscription
    await stripe.subscriptions.update(subscriptionId, {
      items: [priceItem],
      proration_behavior: "none", // Metered prices don't need proration
    });

    logger.info({ subscriptionId }, "Added Shipper Cloud Credits price to subscription");

    return { success: true, added: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error, subscriptionId }, "Failed to add Shipper Cloud Credits to subscription");
    return { success: false, added: false, error: errorMessage };
  }
}

/**
 * @deprecated Use addShipperCloudCreditsToSubscription() instead
 * Legacy function for backwards compatibility
 */
export async function addConvexMeteredPricesToSubscription(
  subscriptionId: string
): Promise<{
  success: boolean;
  addedPrices: number;
  skippedPrices: number;
  error?: string;
}> {
  const result = await addShipperCloudCreditsToSubscription(subscriptionId);
  return {
    success: result.success,
    addedPrices: result.added ? 1 : 0,
    skippedPrices: result.added ? 0 : 1,
    error: result.error,
  };
}

/**
 * Add Convex metered prices to a user's subscription by user ID.
 * Looks up the user's active subscription and adds metered prices.
 *
 * @param userId - The user ID to add metered prices for
 * @returns Object with success status and details
 */
export async function addConvexMeteredPricesToUserSubscription(
  userId: string
): Promise<{
  success: boolean;
  subscriptionId?: string;
  addedPrices: number;
  skippedPrices: number;
  error?: string;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      stripeSubscriptionId: true,
      membershipTier: true,
      email: true,
    },
  });

  if (!user) {
    return {
      success: false,
      addedPrices: 0,
      skippedPrices: 0,
      error: "User not found",
    };
  }

  if (!user.stripeSubscriptionId) {
    return {
      success: false,
      addedPrices: 0,
      skippedPrices: 0,
      error: "User does not have an active subscription",
    };
  }

  if (user.membershipTier !== "PRO" && user.membershipTier !== "ENTERPRISE") {
    return {
      success: false,
      addedPrices: 0,
      skippedPrices: 0,
      error: `User is on ${user.membershipTier} tier, not eligible for metered billing`,
    };
  }

  const result = await addConvexMeteredPricesToSubscription(user.stripeSubscriptionId);

  return {
    ...result,
    subscriptionId: user.stripeSubscriptionId,
  };
}

/**
 * Migrate all existing PRO/ENTERPRISE users to have Convex metered prices.
 * This is a one-time migration to add metered prices to existing subscriptions.
 *
 * @returns Migration results
 */
export async function migrateAllUsersToConvexMeteredBilling(): Promise<{
  total: number;
  successful: number;
  failed: number;
  skipped: number;
  errors: Array<{ userId: string; email: string; error: string }>;
}> {
  const users = await prisma.user.findMany({
    where: {
      membershipTier: { in: ["PRO", "ENTERPRISE"] },
      stripeSubscriptionId: { not: null },
    },
    select: {
      id: true,
      email: true,
      stripeSubscriptionId: true,
    },
  });

  logger.info({ userCount: users.length }, "Starting migration to Convex metered billing");

  const results = {
    total: users.length,
    successful: 0,
    failed: 0,
    skipped: 0,
    errors: [] as Array<{ userId: string; email: string; error: string }>,
  };

  for (const user of users) {
    if (!user.stripeSubscriptionId) {
      results.skipped++;
      continue;
    }

    try {
      const result = await addConvexMeteredPricesToSubscription(user.stripeSubscriptionId);

      if (result.success) {
        if (result.addedPrices > 0) {
          results.successful++;
          logger.info(
            { userId: user.id, email: user.email, addedPrices: result.addedPrices },
            "Added metered prices to user subscription"
          );
        } else {
          results.skipped++;
          logger.debug(
            { userId: user.id, email: user.email },
            "User already has all metered prices"
          );
        }
      } else {
        results.failed++;
        results.errors.push({
          userId: user.id,
          email: user.email ?? "unknown",
          error: result.error ?? "Unknown error",
        });
      }
    } catch (error) {
      results.failed++;
      results.errors.push({
        userId: user.id,
        email: user.email ?? "unknown",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info(
    {
      total: results.total,
      successful: results.successful,
      failed: results.failed,
      skipped: results.skipped,
    },
    "Completed migration to Convex metered billing"
  );

  return results;
}

/**
 * Cancel a team's billing subscription
 */
export async function cancelTeamSubscription(teamId: string): Promise<void> {
  if (!stripe) {
    logger.error("Stripe not configured");
    return;
  }

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { stripeSubscriptionId: true },
  });

  if (!team?.stripeSubscriptionId) {
    logger.warn({ teamId }, "No subscription to cancel");
    return;
  }

  try {
    await stripe.subscriptions.cancel(team.stripeSubscriptionId);

    await prisma.team.update({
      where: { id: teamId },
      data: {
        stripeSubscriptionId: null,
        billingEnabled: false,
      },
    });

    logger.info({ teamId }, "Cancelled team subscription");
  } catch (error) {
    logger.error({ error, teamId }, "Failed to cancel subscription");
    throw error;
  }
}
