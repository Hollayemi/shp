import { createRequire } from 'module';const require = createRequire(import.meta.url);
import {
  SHIPPER_CLOUD_CREDITS_METER
} from "./chunk-TPPBI2VM.js";
import {
  prisma
} from "./chunk-YCW3NRDP.js";
import {
  queueMeterEvent
} from "./chunk-4PHMEXJM.js";
import {
  init_esm_shims,
  logger
} from "./chunk-BUABXYJD.js";

// src/services/stripe-credits-sync.ts
init_esm_shims();
async function syncCreditsToStripe(stripeCustomerId, teamId, periodId) {
  try {
    const deployments = await prisma.convexDeployment.findMany({
      where: {
        project: {
          teamId
        }
      },
      select: {
        id: true,
        creditsUsedThisPeriod: true,
        convexDeploymentName: true
      }
    });
    const totalFractionalCredits = deployments.reduce(
      (sum, d) => sum + d.creditsUsedThisPeriod,
      0
    );
    const roundedCredits = Math.ceil(totalFractionalCredits);
    if (roundedCredits <= 0) {
      logger.debug({ teamId, stripeCustomerId }, "No credits to sync (zero usage)");
      return { success: true, credits: 0 };
    }
    const syncTimestamp = Math.floor(Date.now() / 1e3);
    const jobId = await queueMeterEvent(
      SHIPPER_CLOUD_CREDITS_METER,
      stripeCustomerId,
      roundedCredits,
      void 0,
      `${periodId}-${teamId}-${syncTimestamp}-credits-sync`
    );
    logger.info(
      {
        teamId,
        stripeCustomerId,
        fractionalCredits: totalFractionalCredits,
        roundedCredits,
        deploymentCount: deployments.length,
        jobId
      },
      "Synced credits to Stripe"
    );
    return { success: true, credits: roundedCredits, jobId: jobId || void 0 };
  } catch (error) {
    logger.error({ error, teamId, stripeCustomerId }, "Failed to sync credits to Stripe");
    return { success: false, credits: 0 };
  }
}
async function syncAllTeamCreditsToStripe() {
  const results = {
    processed: 0,
    successful: 0,
    failed: 0,
    totalCredits: 0
  };
  try {
    const now = /* @__PURE__ */ new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodId = `${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, "0")}`;
    const deploymentsWithUsage = await prisma.convexDeployment.findMany({
      where: {
        creditsUsedThisPeriod: { gt: 0 }
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
                        stripeSubscriptionId: true
                      }
                    }
                  },
                  take: 1
                }
              }
            }
          }
        }
      }
    });
    const usageByOwner = /* @__PURE__ */ new Map();
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
      const hasActiveSubscription = (owner.membershipTier === "PRO" || owner.membershipTier === "ENTERPRISE") && !!owner.stripeSubscriptionId;
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
          deploymentCount: 1
        });
      }
    }
    logger.info(
      { ownerCount: usageByOwner.size, deploymentCount: deploymentsWithUsage.length, periodId },
      "Starting credits sync for all team owners"
    );
    for (const [userId, usage] of usageByOwner) {
      results.processed++;
      const roundedCredits = Math.ceil(usage.totalCredits);
      if (roundedCredits <= 0) {
        continue;
      }
      try {
        const syncTimestamp = Math.floor(Date.now() / 1e3);
        const jobId = await queueMeterEvent(
          SHIPPER_CLOUD_CREDITS_METER,
          usage.stripeCustomerId,
          roundedCredits,
          void 0,
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
            jobId
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
        periodId
      },
      "Credits sync completed"
    );
    return results;
  } catch (error) {
    logger.error({ error }, "Failed to sync credits for all teams");
    throw error;
  }
}
async function getTeamCreditUsage(teamId) {
  const deployments = await prisma.convexDeployment.findMany({
    where: {
      project: {
        teamId
      }
    },
    select: {
      convexDeploymentName: true,
      creditsUsedThisPeriod: true
    }
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
      credits: d.creditsUsedThisPeriod
    }))
  };
}
export {
  getTeamCreditUsage,
  syncAllTeamCreditsToStripe,
  syncCreditsToStripe
};
