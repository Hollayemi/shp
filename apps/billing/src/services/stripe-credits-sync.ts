/**
 * Stripe Credits Sync Service
 *
 * Periodically syncs cumulative credit usage to Stripe using "Last" aggregation.
 *
 * This approach prevents overcharging from per-event rounding:
 * - Each Convex event accumulates fractional credits in the database
 * - Rounding only happens once when syncing to Stripe
 * - Stripe meter uses "Last" aggregation to take the final cumulative value
 *
 * Example:
 * - 1000 function calls, each costing 0.3 credits
 * - Old way (Sum + per-event rounding): 1000 × ceil(0.3) = 1000 credits
 * - New way (Last + cumulative): ceil(1000 × 0.3) = 300 credits
 */

import { prisma } from "@shipper/database";
import { logger } from "../config/logger.js";
import { queueMeterEvent } from "./meter-event-queue.js";
import { SHIPPER_CLOUD_CREDITS_METER } from "./shipper-cloud-credits.js";

/**
 * Sync credits to Stripe for a specific team/user
 *
 * Sends the cumulative credit usage to Stripe with "Last" aggregation.
 * Credits are rounded up only at this point, preventing per-event overcharging.
 */
export async function syncCreditsToStripe(
  stripeCustomerId: string,
  teamId: string,
  periodId: string
): Promise<{ success: boolean; credits: number; jobId?: string }> {
  try {
    // Get all deployments for this team and sum their credits
    const deployments = await prisma.convexDeployment.findMany({
      where: {
        project: {
          teamId,
        },
      },
      select: {
        id: true,
        creditsUsedThisPeriod: true,
        convexDeploymentName: true,
      },
    });

    // Sum all fractional credits across deployments
    const totalFractionalCredits = deployments.reduce(
      (sum, d) => sum + d.creditsUsedThisPeriod,
      0
    );

    // Round up only now, at sync time
    const roundedCredits = Math.ceil(totalFractionalCredits);

    if (roundedCredits <= 0) {
      logger.debug({ teamId, stripeCustomerId }, "No credits to sync (zero usage)");
      return { success: true, credits: 0 };
    }

    // Send to Stripe with idempotency key based on period and timestamp
    // Using "Last" aggregation, Stripe will use this value as the total
    // Include timestamp to ensure each sync attempt gets a unique BullMQ job ID
    const syncTimestamp = Math.floor(Date.now() / 1000);
    const jobId = await queueMeterEvent(
      SHIPPER_CLOUD_CREDITS_METER,
      stripeCustomerId,
      roundedCredits,
      undefined,
      `${periodId}-${teamId}-${syncTimestamp}-credits-sync`
    );

    logger.info(
      {
        teamId,
        stripeCustomerId,
        fractionalCredits: totalFractionalCredits,
        roundedCredits,
        deploymentCount: deployments.length,
        jobId,
      },
      "Synced credits to Stripe"
    );

    return { success: true, credits: roundedCredits, jobId: jobId || undefined };
  } catch (error) {
    logger.error({ error, teamId, stripeCustomerId }, "Failed to sync credits to Stripe");
    return { success: false, credits: 0 };
  }
}

/**
 * Sync credits for all users with active Convex usage
 *
 * Billing is on the USER (team owner), not the team directly.
 * This matches how convex-usage.ts sends real-time events.
 */
export async function syncAllTeamCreditsToStripe(): Promise<{
  processed: number;
  successful: number;
  failed: number;
  totalCredits: number;
}> {
  const results = {
    processed: 0,
    successful: 0,
    failed: 0,
    totalCredits: 0,
  };

  try {
    // Get current billing period
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodId = `${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, "0")}`;

    // Find all deployments with usage, grouped by team owner
    // Billing is on the USER (team owner), not the team
    const deploymentsWithUsage = await prisma.convexDeployment.findMany({
      where: {
        creditsUsedThisPeriod: { gt: 0 },
      },
      select: {
        id: true,
        creditsUsedThisPeriod: true,
        convexDeploymentName: true,
        project: {
          select: {
            teamId: true,
            team: {
              select: {
                id: true,
                name: true,
                members: {
                  where: { role: "OWNER" },
                  select: {
                    user: {
                      select: {
                        id: true,
                        stripeCustomerId: true,
                        membershipTier: true,
                        stripeSubscriptionId: true,
                      },
                    },
                  },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    // Group deployments by team owner (user with stripeCustomerId)
    const usageByOwner = new Map<string, {
      stripeCustomerId: string;
      teamId: string;
      teamName: string;
      totalCredits: number;
      deploymentCount: number;
    }>();

    for (const deployment of deploymentsWithUsage) {
      const team = deployment.project?.team;
      const owner = team?.members[0]?.user;

      if (!team || !owner?.stripeCustomerId) {
        logger.debug(
          { deploymentName: deployment.convexDeploymentName, teamId: team?.id },
          "Skipping deployment - no team or owner has no stripeCustomerId"
        );
        continue;
      }

      // Check if user has active subscription (PRO or ENTERPRISE with subscription)
      const hasActiveSubscription =
        (owner.membershipTier === "PRO" || owner.membershipTier === "ENTERPRISE") &&
        !!owner.stripeSubscriptionId;

      if (!hasActiveSubscription) {
        logger.debug(
          { deploymentName: deployment.convexDeploymentName, userId: owner.id },
          "Skipping deployment - owner has no active subscription"
        );
        continue;
      }

      const existing = usageByOwner.get(owner.id);
      if (existing) {
        existing.totalCredits += deployment.creditsUsedThisPeriod;
        existing.deploymentCount++;
      } else {
        usageByOwner.set(owner.id, {
          stripeCustomerId: owner.stripeCustomerId,
          teamId: team.id,
          teamName: team.name,
          totalCredits: deployment.creditsUsedThisPeriod,
          deploymentCount: 1,
        });
      }
    }

    logger.info(
      { ownerCount: usageByOwner.size, deploymentCount: deploymentsWithUsage.length, periodId },
      "Starting credits sync for all team owners"
    );

    for (const [userId, usage] of usageByOwner) {
      results.processed++;

      // Round up only at sync time
      const roundedCredits = Math.ceil(usage.totalCredits);

      if (roundedCredits <= 0) {
        continue;
      }

      try {
        // Include timestamp to ensure each sync attempt gets a unique BullMQ job ID
        const syncTimestamp = Math.floor(Date.now() / 1000);
        const jobId = await queueMeterEvent(
          SHIPPER_CLOUD_CREDITS_METER,
          usage.stripeCustomerId,
          roundedCredits,
          undefined,
          `${periodId}-${userId}-${syncTimestamp}-credits-sync`
        );

        logger.info(
          {
            userId,
            teamId: usage.teamId,
            teamName: usage.teamName,
            stripeCustomerId: usage.stripeCustomerId,
            fractionalCredits: usage.totalCredits,
            roundedCredits,
            deploymentCount: usage.deploymentCount,
            jobId,
          },
          "Synced credits to Stripe for team owner"
        );

        results.successful++;
        results.totalCredits += roundedCredits;
      } catch (error) {
        logger.error({ error, userId, teamId: usage.teamId }, "Failed to sync credits");
        results.failed++;
      }
    }

    logger.info(
      {
        processed: results.processed,
        successful: results.successful,
        failed: results.failed,
        totalCredits: results.totalCredits,
        periodId,
      },
      "Credits sync completed"
    );

    return results;
  } catch (error) {
    logger.error({ error }, "Failed to sync credits for all teams");
    throw error;
  }
}

/**
 * Get the current credit usage for a team (for display purposes)
 *
 * Returns both fractional (actual) and rounded (billable) credits.
 */
export async function getTeamCreditUsage(teamId: string): Promise<{
  fractionalCredits: number;
  roundedCredits: number;
  deploymentBreakdown: Array<{
    deploymentName: string;
    credits: number;
  }>;
}> {
  const deployments = await prisma.convexDeployment.findMany({
    where: {
      project: {
        teamId,
      },
    },
    select: {
      convexDeploymentName: true,
      creditsUsedThisPeriod: true,
    },
  });

  const fractionalCredits = deployments.reduce(
    (sum, d) => sum + d.creditsUsedThisPeriod,
    0
  );

  return {
    fractionalCredits,
    roundedCredits: Math.ceil(fractionalCredits),
    deploymentBreakdown: deployments.map((d) => ({
      deploymentName: d.convexDeploymentName,
      credits: d.creditsUsedThisPeriod,
    })),
  };
}
