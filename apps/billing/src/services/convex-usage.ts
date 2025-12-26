/**
 * Convex Usage Tracking Service
 *
 * Processes Convex log stream webhook events and tracks usage per team.
 * Used for billing teams based on their Convex resource consumption.
 *
 * Usage is accumulated locally with full precision (no rounding).
 * A separate sync job periodically sends the cumulative total to Stripe
 * using "Last" aggregation, with rounding applied only at sync time.
 *
 * This approach prevents overcharging from per-event rounding.
 */

import { prisma } from "@shipper/database";
import crypto from "crypto";
import { logger } from "../config/logger.js";
import {
  calculateCreditsFromConvexUsageRaw,
} from "./shipper-cloud-credits.js";
import type { ConvexUsageMetrics } from "./stripe-meters.js";

// Types for Convex log stream events
interface ConvexLogEvent {
  topic: string;
  timestamp: number;
  convex?: {
    deployment_name: string;
    deployment_type: string;
    project_name: string;
    project_slug: string;
  };
}

interface FunctionExecutionEvent extends ConvexLogEvent {
  topic: "function_execution";
  function: {
    type: "query" | "mutation" | "action" | "http_action";
    path: string;
    cached?: boolean;
    request_id: string;
  };
  execution_time_ms: number;
  status: "success" | "failure";
  usage?: {
    database_read_bytes: number;
    database_write_bytes: number;
    database_read_documents?: number;
    file_storage_read_bytes: number;
    file_storage_write_bytes: number;
    vector_storage_read_bytes: number;
    vector_storage_write_bytes: number;
    memory_used_mb?: number;
  };
}

interface StorageUsageEvent extends ConvexLogEvent {
  topic: "current_storage_usage";
  total_document_size_bytes: number;
  total_index_size_bytes: number;
  total_vector_storage_bytes: number;
  total_file_storage_bytes: number;
  total_backup_storage_bytes: number;
}

export type ConvexWebhookEvent = FunctionExecutionEvent | StorageUsageEvent | ConvexLogEvent;

/**
 * Verify the HMAC signature from Convex webhook
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  if (!signature || !signature.startsWith("sha256=")) {
    return false;
  }

  const expectedSignature = signature.replace("sha256=", "");
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload);
  const computedSignature = hmac.digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, "hex"),
      Buffer.from(computedSignature, "hex")
    );
  } catch {
    return false;
  }
}

// Real-time meter events are DISABLED to prevent overcharging from per-event rounding.
// Credits are accumulated locally with full precision, then synced to Stripe periodically.
// See: syncCreditsToStripe() in stripe-credits-sync.ts

interface TeamOwnerBillingInfo {
  teamId: string;
  ownerId: string;
  stripeCustomerId: string | null;
  hasActiveSubscription: boolean;
}

/**
 * Look up which team owns a Convex deployment and get the team owner's billing info.
 * Convex usage is billed to the team owner's user subscription.
 */
async function getTeamOwnerBillingInfo(deploymentName: string): Promise<TeamOwnerBillingInfo | null> {
  const deployment = await prisma.convexDeployment.findUnique({
    where: { convexDeploymentName: deploymentName },
    include: {
      project: {
        select: {
          teamId: true,
          team: {
            select: {
              id: true,
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

  const team = deployment?.project?.team;
  const owner = team?.members[0]?.user;

  if (!team || !owner) {
    return null;
  }

  // User has an active subscription if they're PRO or ENTERPRISE with a Stripe subscription
  const hasActiveSubscription =
    (owner.membershipTier === "PRO" || owner.membershipTier === "ENTERPRISE") &&
    !!owner.stripeSubscriptionId;

  return {
    teamId: team.id,
    ownerId: owner.id,
    stripeCustomerId: owner.stripeCustomerId,
    hasActiveSubscription,
  };
}

/**
 * Process a function_execution event
 * Updates aggregated usage on the ConvexDeployment instead of creating individual records
 */
async function processFunctionExecutionEvent(
  event: FunctionExecutionEvent,
  teamId: string,
  stripeCustomerId?: string | null
): Promise<void> {
  const deploymentName = event.convex?.deployment_name;
  if (!deploymentName) return;

  const usage = event.usage;
  const isAction = event.function.type === "action" || event.function.type === "http_action";
  const isCachedQuery = event.function.cached === true;
  const eventTimestamp = new Date(event.timestamp);

  // Calculate bandwidth totals
  const dbReadBytes = usage?.database_read_bytes ?? 0;
  const dbWriteBytes = usage?.database_write_bytes ?? 0;
  const fileReadBytes = usage?.file_storage_read_bytes ?? 0;
  const fileWriteBytes = usage?.file_storage_write_bytes ?? 0;
  const vectorReadBytes = usage?.vector_storage_read_bytes ?? 0;
  const vectorWriteBytes = usage?.vector_storage_write_bytes ?? 0;

  // Cached queries don't count as billable function calls per Convex pricing
  // See: https://docs.convex.dev/production/integrations/log-streams
  const usageMetrics: ConvexUsageMetrics = {
    functionCalls: isCachedQuery ? BigInt(0) : BigInt(1),
    actionComputeMs: BigInt(isAction ? event.execution_time_ms : 0),
    databaseBandwidthBytes: BigInt(dbReadBytes + dbWriteBytes),
    databaseStorageBytes: BigInt(0), // Storage handled separately in storage events
    fileBandwidthBytes: BigInt(fileReadBytes + fileWriteBytes),
    fileStorageBytes: BigInt(0), // Storage handled separately
    vectorBandwidthBytes: BigInt(vectorReadBytes + vectorWriteBytes),
    vectorStorageBytes: BigInt(0), // Storage handled separately
  };

  // Calculate credits WITHOUT rounding - we accumulate fractional credits locally
  // and only round when syncing to Stripe (prevents overcharging)
  const credits = calculateCreditsFromConvexUsageRaw(usageMetrics);

  // Get current billing period
  const { start: periodStart, end: periodEnd } = getCurrentBillingPeriod();

  // Update aggregated usage on the deployment
  // Atomically increment counters and update period bounds
  await prisma.convexDeployment.update({
    where: { convexDeploymentName: deploymentName },
    data: {
      // Reset counters if we're in a new billing period
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      // Increment usage counters (cached queries don't count as function calls)
      totalFunctionCalls: { increment: isCachedQuery ? 0 : 1 },
      totalActionComputeMs: { increment: isAction ? event.execution_time_ms : 0 },
      totalDatabaseBandwidthBytes: { increment: dbReadBytes + dbWriteBytes },
      totalFileBandwidthBytes: { increment: fileReadBytes + fileWriteBytes },
      totalVectorBandwidthBytes: { increment: vectorReadBytes + vectorWriteBytes },
      // Track fractional credits (no rounding) - synced to Stripe periodically
      creditsUsedThisPeriod: { increment: credits },
      lastUsageAt: eventTimestamp,
    },
  });

  // NOTE: Real-time meter events are DISABLED to prevent overcharging.
  // Credits are synced to Stripe periodically via syncCreditsToStripe() with Last aggregation.
  // This ensures rounding only happens once per sync, not per event.

  if (isCachedQuery) {
    logger.debug(
      { deploymentName, functionPath: event.function.path },
      "Skipped cached query from function call count"
    );
  }
}

/**
 * Process a current_storage_usage event
 * Updates storage snapshot values on the ConvexDeployment (last known values, not cumulative)
 */
async function processStorageUsageEvent(
  event: StorageUsageEvent,
  teamId: string,
  stripeCustomerId?: string | null
): Promise<void> {
  const deploymentName = event.convex?.deployment_name;
  if (!deploymentName) return;

  const eventTimestamp = new Date(event.timestamp);

  // Update storage snapshot on the deployment (these are last known values, not cumulative)
  await prisma.convexDeployment.update({
    where: { convexDeploymentName: deploymentName },
    data: {
      lastStorageUpdateAt: eventTimestamp,
      documentStorageBytes: event.total_document_size_bytes,
      indexStorageBytes: event.total_index_size_bytes,
      fileStorageBytes: event.total_file_storage_bytes,
      vectorStorageBytes: event.total_vector_storage_bytes,
      backupStorageBytes: event.total_backup_storage_bytes,
    },
  });

  // Update peak storage in current billing period (for ConvexUsagePeriod)
  await updatePeakStorageForPeriod(teamId, event);

  // Note: Storage billing is typically based on peak usage per period
  // We don't send meter events for storage snapshots - the ConvexUsagePeriod
  // tracks peak values and billing is calculated at the end of the period
  // This prevents double-billing for storage that's just being measured
  logger.debug(
    { deploymentName, documentBytes: event.total_document_size_bytes },
    "Updated storage snapshot on deployment"
  );
}

/**
 * Update peak storage values in the current billing period
 */
async function updatePeakStorageForPeriod(
  teamId: string,
  event: StorageUsageEvent
): Promise<void> {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const databaseStorageBytes = BigInt(event.total_document_size_bytes + event.total_index_size_bytes);
  const fileStorageBytes = BigInt(event.total_file_storage_bytes + event.total_backup_storage_bytes);
  const vectorStorageBytes = BigInt(event.total_vector_storage_bytes);

  await prisma.$executeRaw`
    INSERT INTO convex_usage_periods (
      id, "teamId", "periodStart", "periodEnd",
      "peakDatabaseStorageBytes", "peakFileStorageBytes", "peakVectorStorageBytes",
      status, "createdAt", "updatedAt"
    ) VALUES (
      ${crypto.randomUUID()}, ${teamId}, ${periodStart}, ${periodEnd},
      ${databaseStorageBytes}, ${fileStorageBytes}, ${vectorStorageBytes},
      'PENDING', NOW(), NOW()
    )
    ON CONFLICT ("teamId", "periodStart", "periodEnd") DO UPDATE SET
      "peakDatabaseStorageBytes" = GREATEST(convex_usage_periods."peakDatabaseStorageBytes", ${databaseStorageBytes}),
      "peakFileStorageBytes" = GREATEST(convex_usage_periods."peakFileStorageBytes", ${fileStorageBytes}),
      "peakVectorStorageBytes" = GREATEST(convex_usage_periods."peakVectorStorageBytes", ${vectorStorageBytes}),
      "updatedAt" = NOW()
  `;
}

// Skip reasons for better logging
type SkipReason = "no_deployment_name" | "no_team_owner" | "no_active_subscription" | "unknown_topic";

/**
 * Process incoming webhook events from Convex log stream.
 * Usage is billed to the team owner's user subscription.
 */
export async function processConvexWebhookEvents(
  events: ConvexWebhookEvent[]
): Promise<{ processed: number; skipped: number; errors: string[]; skipReasons: Record<SkipReason, number> }> {
  let processed = 0;
  let skipped = 0;
  const errors: string[] = [];
  const skipReasons: Record<SkipReason, number> = {
    no_deployment_name: 0,
    no_team_owner: 0,
    no_active_subscription: 0,
    unknown_topic: 0,
  };

  // Cache for team owner billing info to reduce DB lookups (keyed by deployment name)
  const billingInfoCache = new Map<string, TeamOwnerBillingInfo | null>();

  for (const event of events) {
    try {
      const deploymentName = event.convex?.deployment_name;
      if (!deploymentName) {
        skipReasons.no_deployment_name++;
        skipped++;
        continue;
      }

      // Get cached or fetch team owner billing info
      let ownerInfo = billingInfoCache.get(deploymentName);
      if (ownerInfo === undefined) {
        ownerInfo = await getTeamOwnerBillingInfo(deploymentName);
        billingInfoCache.set(deploymentName, ownerInfo);
      }

      if (!ownerInfo) {
        logger.info({ deploymentName }, "Skipped: no team/owner found for deployment");
        skipReasons.no_team_owner++;
        skipped++;
        continue;
      }

      if (!ownerInfo.hasActiveSubscription) {
        logger.info(
          { deploymentName, teamId: ownerInfo.teamId, ownerId: ownerInfo.ownerId },
          "Skipped: team owner does not have active subscription"
        );
        skipReasons.no_active_subscription++;
        skipped++;
        continue;
      }

      switch (event.topic) {
        case "function_execution":
          await processFunctionExecutionEvent(
            event as FunctionExecutionEvent,
            ownerInfo.teamId,
            ownerInfo.stripeCustomerId
          );
          processed++;
          break;
        case "current_storage_usage":
          await processStorageUsageEvent(
            event as StorageUsageEvent,
            ownerInfo.teamId,
            ownerInfo.stripeCustomerId
          );
          processed++;
          break;
        default:
          logger.info({ deploymentName, topic: event.topic }, "Skipped: unknown event topic");
          skipReasons.unknown_topic++;
          skipped++;
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`Failed to process event: ${msg}`);
      logger.error({ error, event }, "Failed to process Convex event");
    }
  }

  return { processed, skipped, errors, skipReasons };
}

/**
 * Get current billing period for a team
 */
export function getCurrentBillingPeriod(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}
