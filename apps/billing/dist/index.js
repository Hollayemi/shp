import { createRequire } from 'module';const require = createRequire(import.meta.url);
import {
  CREDIT_PRICING,
  checkAndProcessAutoTopUps,
  configureAutoTopUp,
  createCreditGrant,
  createPromotionalCredits,
  disableAutoTopUp,
  getAutoTopUpConfig,
  getCreditBalance,
  grantFirstDeploymentBonus,
  listCreditGrants,
  processAutoTopUp,
  syncCreditBalanceToDatabase,
  voidCreditGrant
} from "./chunk-GWSDFZSE.js";
import {
  calculateCreditsFromConvexUsageRaw
} from "./chunk-TPPBI2VM.js";
import {
  import_prisma,
  prisma
} from "./chunk-YCW3NRDP.js";
import {
  getQueueStats,
  getScheduledJobsStats,
  queueMeterEventsBatch,
  setupAutoTopUpCron,
  setupCreditsSyncCron,
  shutdownMeterEventQueue,
  startMeterEventWorker,
  startScheduledJobsWorker
} from "./chunk-4PHMEXJM.js";
import {
  CONVEX_BILLING_CONFIG,
  SHIPPER_CLOUD_CONFIG,
  init_esm_shims,
  logger,
  stripe,
  stripeConfig
} from "./chunk-BUABXYJD.js";

// src/index.ts
init_esm_shims();
import dotenv from "dotenv";
import express from "express";
import cors from "cors";

// src/middleware/auth.ts
init_esm_shims();
var SHIPPER_API_KEY = process.env.SHIPPER_API_KEY;
function validateApiKey(req, res, next) {
  const apiKey = req.headers["x-api-key"];
  if (!SHIPPER_API_KEY) {
    console.error("[Auth] SHIPPER_API_KEY not configured!");
    const response = {
      success: false,
      error: "Server configuration error"
    };
    return res.status(500).json(response);
  }
  if (!apiKey) {
    const response = {
      success: false,
      error: "Missing API key. Include 'x-api-key' header."
    };
    return res.status(401).json(response);
  }
  if (apiKey !== SHIPPER_API_KEY) {
    console.warn("[Auth] Invalid API key attempt");
    const response = {
      success: false,
      error: "Invalid API key"
    };
    return res.status(401).json(response);
  }
  next();
}

// src/routes/webhook.ts
init_esm_shims();
import { Router } from "express";
import { decryptDeployKey } from "@shipper/convex";

// src/services/convex-usage.ts
init_esm_shims();
import crypto from "crypto";
function verifyWebhookSignature(payload, signature, secret) {
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
async function getTeamOwnerBillingInfo(deploymentName) {
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
  const team = deployment?.project?.team;
  const owner = team?.members[0]?.user;
  if (!team || !owner) {
    return null;
  }
  const hasActiveSubscription = (owner.membershipTier === "PRO" || owner.membershipTier === "ENTERPRISE") && !!owner.stripeSubscriptionId;
  return {
    teamId: team.id,
    ownerId: owner.id,
    stripeCustomerId: owner.stripeCustomerId,
    hasActiveSubscription
  };
}
async function processFunctionExecutionEvent(event, teamId, stripeCustomerId) {
  const deploymentName = event.convex?.deployment_name;
  if (!deploymentName) return;
  const usage = event.usage;
  const isAction = event.function.type === "action" || event.function.type === "http_action";
  const isCachedQuery = event.function.cached === true;
  const eventTimestamp = new Date(event.timestamp);
  const dbReadBytes = usage?.database_read_bytes ?? 0;
  const dbWriteBytes = usage?.database_write_bytes ?? 0;
  const fileReadBytes = usage?.file_storage_read_bytes ?? 0;
  const fileWriteBytes = usage?.file_storage_write_bytes ?? 0;
  const vectorReadBytes = usage?.vector_storage_read_bytes ?? 0;
  const vectorWriteBytes = usage?.vector_storage_write_bytes ?? 0;
  const usageMetrics = {
    functionCalls: isCachedQuery ? BigInt(0) : BigInt(1),
    actionComputeMs: BigInt(isAction ? event.execution_time_ms : 0),
    databaseBandwidthBytes: BigInt(dbReadBytes + dbWriteBytes),
    databaseStorageBytes: BigInt(0),
    // Storage handled separately in storage events
    fileBandwidthBytes: BigInt(fileReadBytes + fileWriteBytes),
    fileStorageBytes: BigInt(0),
    // Storage handled separately
    vectorBandwidthBytes: BigInt(vectorReadBytes + vectorWriteBytes),
    vectorStorageBytes: BigInt(0)
    // Storage handled separately
  };
  const credits = calculateCreditsFromConvexUsageRaw(usageMetrics);
  const { start: periodStart, end: periodEnd } = getCurrentBillingPeriod();
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
      lastUsageAt: eventTimestamp
    }
  });
  if (isCachedQuery) {
    logger.debug(
      { deploymentName, functionPath: event.function.path },
      "Skipped cached query from function call count"
    );
  }
}
async function processStorageUsageEvent(event, teamId, stripeCustomerId) {
  const deploymentName = event.convex?.deployment_name;
  if (!deploymentName) return;
  const eventTimestamp = new Date(event.timestamp);
  await prisma.convexDeployment.update({
    where: { convexDeploymentName: deploymentName },
    data: {
      lastStorageUpdateAt: eventTimestamp,
      documentStorageBytes: event.total_document_size_bytes,
      indexStorageBytes: event.total_index_size_bytes,
      fileStorageBytes: event.total_file_storage_bytes,
      vectorStorageBytes: event.total_vector_storage_bytes,
      backupStorageBytes: event.total_backup_storage_bytes
    }
  });
  await updatePeakStorageForPeriod(teamId, event);
  logger.debug(
    { deploymentName, documentBytes: event.total_document_size_bytes },
    "Updated storage snapshot on deployment"
  );
}
async function updatePeakStorageForPeriod(teamId, event) {
  const now = /* @__PURE__ */ new Date();
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
async function processConvexWebhookEvents(events) {
  let processed = 0;
  let skipped = 0;
  const errors = [];
  const skipReasons = {
    no_deployment_name: 0,
    no_team_owner: 0,
    no_active_subscription: 0,
    unknown_topic: 0
  };
  const billingInfoCache = /* @__PURE__ */ new Map();
  for (const event of events) {
    try {
      const deploymentName = event.convex?.deployment_name;
      if (!deploymentName) {
        skipReasons.no_deployment_name++;
        skipped++;
        continue;
      }
      let ownerInfo = billingInfoCache.get(deploymentName);
      if (ownerInfo === void 0) {
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
            event,
            ownerInfo.teamId,
            ownerInfo.stripeCustomerId
          );
          processed++;
          break;
        case "current_storage_usage":
          await processStorageUsageEvent(
            event,
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
function getCurrentBillingPeriod() {
  const now = /* @__PURE__ */ new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

// src/routes/webhook.ts
var router = Router();
router.post("/convex", async (req, res) => {
  const signature = req.headers["x-webhook-signature"];
  const events = Array.isArray(req.body) ? req.body : [req.body];
  if (events.length === 0) {
    const response = {
      success: false,
      error: "No events provided"
    };
    return res.status(400).json(response);
  }
  const deploymentName = events[0]?.convex?.deployment_name;
  if (!deploymentName) {
    logger.warn("Webhook missing deployment_name");
    const response = {
      success: false,
      error: "Missing deployment identifier"
    };
    return res.status(400).json(response);
  }
  const deployment = await prisma.convexDeployment.findUnique({
    where: { convexDeploymentName: deploymentName },
    select: { webhookSecretEncrypted: true }
  });
  if (!deployment) {
    logger.warn({ deploymentName }, "Unknown deployment");
    const response = {
      success: false,
      error: "Unknown deployment"
    };
    return res.status(404).json(response);
  }
  if (!deployment.webhookSecretEncrypted) {
    logger.warn({ deploymentName }, "Webhook secret not configured for deployment");
    const response = {
      success: false,
      error: "Webhook not configured for this deployment"
    };
    return res.status(404).json(response);
  }
  let webhookSecret;
  try {
    const parts = deployment.webhookSecretEncrypted.split(":");
    if (parts.length === 4) {
      webhookSecret = decryptDeployKey(deployment.webhookSecretEncrypted);
    } else {
      logger.warn({ deploymentName }, "Webhook secret appears to be stored unencrypted (legacy format)");
      webhookSecret = deployment.webhookSecretEncrypted;
    }
  } catch (error) {
    logger.error({
      deploymentName,
      error: error instanceof Error ? error.message : String(error),
      storedValueLength: deployment.webhookSecretEncrypted.length,
      storedValuePreview: deployment.webhookSecretEncrypted.substring(0, 20) + "..."
    }, "Failed to decrypt webhook secret");
    const response = {
      success: false,
      error: "Server configuration error"
    };
    return res.status(500).json(response);
  }
  const rawBody = JSON.stringify(req.body);
  if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
    logger.warn({ deploymentName }, "Invalid webhook signature");
    const response = {
      success: false,
      error: "Invalid signature"
    };
    return res.status(401).json(response);
  }
  const firstEvent = events[0];
  const eventTimestamp = firstEvent?.timestamp;
  if (eventTimestamp) {
    const now = Date.now();
    const fiveMinutesMs = 5 * 60 * 1e3;
    if (eventTimestamp < now - fiveMinutesMs) {
      logger.warn({ eventTimestamp, now, deploymentName }, "Webhook request expired");
      const response = {
        success: false,
        error: "Request expired"
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
      deploymentName
    }, "Convex webhook processed");
    const response = {
      success: true,
      data: {
        processed: result.processed,
        skipped: result.skipped,
        skipReasons: result.skipReasons,
        errors: result.errors.length
      }
    };
    return res.json(response);
  } catch (error) {
    logger.error({ error, deploymentName }, "Convex webhook error");
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Internal error"
    };
    return res.status(500).json(response);
  }
});
router.get("/status", async (_req, res) => {
  const configuredCount = await prisma.convexDeployment.count({
    where: { webhookSecretEncrypted: { not: null } }
  });
  const response = {
    success: true,
    data: {
      configured: configuredCount > 0,
      deploymentsWithWebhook: configuredCount,
      endpoint: "/webhook/convex"
    }
  };
  return res.json(response);
});
router.post("/migrate/:deploymentName", async (req, res) => {
  const { deploymentName } = req.params;
  const apiKey = req.headers["x-api-key"];
  if (apiKey !== process.env.SHIPPER_API_KEY) {
    const response = { success: false, error: "Unauthorized" };
    return res.status(401).json(response);
  }
  try {
    const deployment = await prisma.convexDeployment.findUnique({
      where: { convexDeploymentName: deploymentName },
      select: {
        id: true,
        convexDeploymentUrl: true,
        deployKeyEncrypted: true,
        webhookSecretEncrypted: true
      }
    });
    if (!deployment) {
      const response2 = { success: false, error: "Deployment not found" };
      return res.status(404).json(response2);
    }
    const deployKey = decryptDeployKey(deployment.deployKeyEncrypted);
    const { ConvexDeploymentAPI } = await import("@shipper/convex");
    const api = new ConvexDeploymentAPI(deployment.convexDeploymentUrl, deployKey);
    const webhookSecret = await api.getWebhookSecret();
    if (!webhookSecret) {
      const response2 = {
        success: false,
        error: "No webhook sink configured in Convex for this deployment"
      };
      return res.status(404).json(response2);
    }
    const { encryptDeployKey } = await import("@shipper/convex");
    const webhookSecretEncrypted = encryptDeployKey(webhookSecret);
    await prisma.convexDeployment.update({
      where: { id: deployment.id },
      data: {
        webhookSecretEncrypted,
        webhookConfiguredAt: /* @__PURE__ */ new Date()
      }
    });
    logger.info({ deploymentName }, "Webhook secret migrated successfully");
    const response = {
      success: true,
      data: { deploymentName, migrated: true }
    };
    return res.json(response);
  } catch (error) {
    logger.error({
      deploymentName,
      error: error instanceof Error ? error.message : String(error)
    }, "Failed to migrate webhook secret");
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Migration failed"
    };
    return res.status(500).json(response);
  }
});
router.all("/convex", (_req, res) => {
  const response = {
    success: false,
    error: "Method not allowed. Use POST."
  };
  return res.status(405).json(response);
});
router.all("*", (_req, res) => {
  const response = {
    success: false,
    error: "Not found"
  };
  return res.status(404).json(response);
});
var webhook_default = router;

// src/routes/teams.ts
init_esm_shims();
import { Router as Router2 } from "express";
import { z } from "zod";

// src/services/stripe-billing.ts
init_esm_shims();

// src/services/stripe-meters.ts
init_esm_shims();
var METER_EVENT_NAMES = {
  FUNCTION_CALLS: "convex_function_calls",
  ACTION_COMPUTE: "convex_action_compute",
  DATABASE_BANDWIDTH: "convex_database_bandwidth",
  DATABASE_STORAGE: "convex_database_storage",
  FILE_BANDWIDTH: "convex_file_bandwidth",
  FILE_STORAGE: "convex_file_storage",
  VECTOR_BANDWIDTH: "convex_vector_bandwidth",
  VECTOR_STORAGE: "convex_vector_storage"
};
async function sendMeterEventsBatch(events) {
  if (!stripe) {
    logger.warn("Stripe not configured, skipping meter events batch");
    return { queued: 0, skipped: events.length, jobIds: [] };
  }
  const validEvents = events.filter((e) => e.value > 0);
  const skipped = events.length - validEvents.length;
  if (validEvents.length === 0) {
    return { queued: 0, skipped, jobIds: [] };
  }
  try {
    const jobIds = await queueMeterEventsBatch(validEvents);
    return { queued: jobIds.length, skipped, jobIds };
  } catch (error) {
    logger.error(
      { error, eventCount: validEvents.length },
      "Failed to queue meter events batch"
    );
    return { queued: 0, skipped: events.length, jobIds: [] };
  }
}
var BYTES_PER_GB = 1024 * 1024 * 1024;
var MS_PER_HOUR = 36e5;
var MB_PER_GB = 1024;
var MEMORY_MB = 128;
function convertToMeterUnits(metrics) {
  return {
    [METER_EVENT_NAMES.FUNCTION_CALLS]: Math.ceil(Number(metrics.functionCalls) / 1e3),
    [METER_EVENT_NAMES.ACTION_COMPUTE]: Math.ceil(
      MEMORY_MB / MB_PER_GB * (Number(metrics.actionComputeMs) / MS_PER_HOUR) * 1e3
    ),
    [METER_EVENT_NAMES.DATABASE_BANDWIDTH]: Math.ceil(
      Number(metrics.databaseBandwidthBytes) / (1024 * 1024)
    ),
    [METER_EVENT_NAMES.DATABASE_STORAGE]: Math.ceil(
      Number(metrics.databaseStorageBytes) / (1024 * 1024)
    ),
    [METER_EVENT_NAMES.FILE_BANDWIDTH]: Math.ceil(
      Number(metrics.fileBandwidthBytes) / (1024 * 1024)
    ),
    [METER_EVENT_NAMES.FILE_STORAGE]: Math.ceil(
      Number(metrics.fileStorageBytes) / (1024 * 1024)
    ),
    [METER_EVENT_NAMES.VECTOR_BANDWIDTH]: Math.ceil(
      Number(metrics.vectorBandwidthBytes) / (1024 * 1024)
    ),
    [METER_EVENT_NAMES.VECTOR_STORAGE]: Math.ceil(
      Number(metrics.vectorStorageBytes) / (1024 * 1024)
    )
  };
}
async function reportConvexUsageToStripe(stripeCustomerId, metrics, periodId) {
  const meterUnits = convertToMeterUnits(metrics);
  const events = Object.entries(meterUnits).map(([eventName, value]) => ({
    eventName,
    stripeCustomerId,
    value,
    idempotencyKey: `${periodId}-${eventName}`
  }));
  return sendMeterEventsBatch(events);
}

// src/services/stripe-billing.ts
var BYTES_PER_GB2 = 1024 * 1024 * 1024;
var MS_PER_HOUR2 = 36e5;
var MB_PER_GB2 = 1024;
async function createTeamCustomer(teamId, email, teamName) {
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
        source: "shipper-billing"
      }
    });
    await prisma.team.update({
      where: { id: teamId },
      data: {
        stripeCustomerId: customer.id,
        billingEmail: email
      }
    });
    logger.info({ teamId, customerId: customer.id }, "Created Stripe customer for team");
    return customer.id;
  } catch (error) {
    logger.error({ error, teamId }, "Failed to create Stripe customer");
    throw error;
  }
}
async function createTeamSubscription(teamId) {
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
      name: true
    }
  });
  if (!team) {
    throw new Error(`Team ${teamId} not found`);
  }
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
  if (team.stripeSubscriptionId) {
    logger.info({ teamId }, "Team already has a subscription");
    return team.stripeSubscriptionId;
  }
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
        type: "shipper_cloud_credits"
      }
    });
    await prisma.team.update({
      where: { id: teamId },
      data: {
        stripeSubscriptionId: subscription.id,
        billingEnabled: true
      }
    });
    logger.info({ teamId, subscriptionId: subscription.id }, "Created metered subscription for team");
    return subscription.id;
  } catch (error) {
    logger.error({ error, teamId }, "Failed to create subscription");
    throw error;
  }
}
async function reportUsageToStripe(teamId) {
  if (!stripe) {
    logger.error("Stripe not configured");
    return;
  }
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      billingEnabled: true
    }
  });
  if (!team?.stripeCustomerId || !team.billingEnabled) {
    logger.warn({ teamId }, "Team not set up for billing (no Stripe customer)");
    return;
  }
  const { start: periodStart, end: periodEnd } = getCurrentBillingPeriod();
  await aggregateUsageForPeriod(teamId, periodStart, periodEnd);
  const period = await prisma.convexUsagePeriod.findUnique({
    where: {
      teamId_periodStart_periodEnd: {
        teamId,
        periodStart,
        periodEnd
      }
    }
  });
  if (!period || period.status === "REPORTED" || period.status === "BILLED" || period.status === "PAID") {
    logger.info({ teamId, periodStart }, "Usage already reported or no usage to report");
    return;
  }
  const metrics = {
    functionCalls: period.totalFunctionCalls,
    actionComputeMs: period.totalActionComputeMs,
    databaseBandwidthBytes: period.totalDatabaseBandwidthBytes,
    databaseStorageBytes: period.peakDatabaseStorageBytes,
    fileBandwidthBytes: period.totalFileBandwidthBytes,
    fileStorageBytes: period.peakFileStorageBytes,
    vectorBandwidthBytes: period.totalVectorBandwidthBytes,
    vectorStorageBytes: period.peakVectorStorageBytes
  };
  const result = await reportConvexUsageToStripe(
    team.stripeCustomerId,
    metrics,
    period.id
  );
  logger.info(
    { teamId, periodStart, queued: result.queued, skipped: result.skipped },
    "Queued usage meter events"
  );
  await prisma.convexUsagePeriod.update({
    where: { id: period.id },
    data: {
      status: import_prisma.ConvexBillingStatus.REPORTED,
      reportedToStripeAt: /* @__PURE__ */ new Date()
    }
  });
}
async function aggregateUsageForPeriod(teamId, periodStart, periodEnd) {
  let period = await prisma.convexUsagePeriod.findUnique({
    where: {
      teamId_periodStart_periodEnd: {
        teamId,
        periodStart,
        periodEnd
      }
    }
  });
  if (!period) {
    period = await prisma.convexUsagePeriod.create({
      data: {
        teamId,
        periodStart,
        periodEnd,
        status: import_prisma.ConvexBillingStatus.PENDING
      }
    });
  }
  const deploymentMetrics = await prisma.convexDeployment.aggregate({
    where: {
      project: {
        teamId
      },
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd
    },
    _sum: {
      totalFunctionCalls: true,
      totalActionComputeMs: true,
      totalDatabaseBandwidthBytes: true,
      totalFileBandwidthBytes: true,
      totalVectorBandwidthBytes: true
    }
  });
  const totalFunctionCalls = deploymentMetrics._sum.totalFunctionCalls ?? BigInt(0);
  const totalActionComputeMs = deploymentMetrics._sum.totalActionComputeMs ?? BigInt(0);
  const totalDatabaseBandwidthBytes = deploymentMetrics._sum.totalDatabaseBandwidthBytes ?? BigInt(0);
  const totalFileBandwidthBytes = deploymentMetrics._sum.totalFileBandwidthBytes ?? BigInt(0);
  const totalVectorBandwidthBytes = deploymentMetrics._sum.totalVectorBandwidthBytes ?? BigInt(0);
  const rates = CONVEX_BILLING_CONFIG.rates;
  const functionCallsCost = Math.round(
    Number(totalFunctionCalls) / 1e6 * rates.functionCallsPerMillion
  );
  const actionComputeCost = Math.round(
    128 / MB_PER_GB2 * (Number(totalActionComputeMs) / MS_PER_HOUR2) * rates.actionComputePerGBHour
  );
  const databaseBandwidthCost = Math.round(
    Number(totalDatabaseBandwidthBytes) / BYTES_PER_GB2 * rates.databaseBandwidthPerGB
  );
  const databaseStorageCost = Math.round(
    Number(period.peakDatabaseStorageBytes) / BYTES_PER_GB2 * rates.databaseStoragePerGB
  );
  const fileBandwidthCost = Math.round(
    Number(totalFileBandwidthBytes) / BYTES_PER_GB2 * rates.fileBandwidthPerGB
  );
  const fileStorageCost = Math.round(
    Number(period.peakFileStorageBytes) / BYTES_PER_GB2 * rates.fileStoragePerGB
  );
  const vectorBandwidthCost = Math.round(
    Number(totalVectorBandwidthBytes) / BYTES_PER_GB2 * rates.vectorBandwidthPerGB
  );
  const vectorStorageCost = Math.round(
    Number(period.peakVectorStorageBytes) / BYTES_PER_GB2 * rates.vectorStoragePerGB
  );
  const totalCost = functionCallsCost + actionComputeCost + databaseBandwidthCost + databaseStorageCost + fileBandwidthCost + fileStorageCost + vectorBandwidthCost + vectorStorageCost;
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
      status: import_prisma.ConvexBillingStatus.CALCULATED
    }
  });
  logger.info({ teamId, periodStart, totalCost }, "Aggregated usage for period");
}
async function getTeamUsageSummary(teamId) {
  const { start, end } = getCurrentBillingPeriod();
  await aggregateUsageForPeriod(teamId, start, end);
  const period = await prisma.convexUsagePeriod.findUnique({
    where: {
      teamId_periodStart_periodEnd: {
        teamId,
        periodStart: start,
        periodEnd: end
      }
    }
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
      peakVectorStorageBytes: period.peakVectorStorageBytes.toString()
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
      total: period.totalCost
    },
    status: period.status
  };
}
function getShipperCloudCreditsPriceItem() {
  const priceId = SHIPPER_CLOUD_CONFIG.priceId;
  if (!priceId) {
    logger.warn("STRIPE_SHIPPER_CLOUD_CREDITS_PRICE_ID not configured");
    return null;
  }
  return { price: priceId };
}
async function subscriptionHasShipperCloudCreditsPrice(subscriptionId) {
  if (!stripe) {
    throw new Error("Stripe not configured");
  }
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price"]
  });
  const shipperCloudPriceId = SHIPPER_CLOUD_CONFIG.priceId;
  for (const item of subscription.items.data) {
    const priceId = typeof item.price === "string" ? item.price : item.price.id;
    if (priceId === shipperCloudPriceId) {
      return {
        hasMeteredPrice: true,
        existingPriceId: priceId
      };
    }
  }
  return {
    hasMeteredPrice: false,
    existingPriceId: null
  };
}
async function addShipperCloudCreditsToSubscription(subscriptionId) {
  if (!stripe) {
    return { success: false, added: false, error: "Stripe not configured" };
  }
  const priceItem = getShipperCloudCreditsPriceItem();
  if (!priceItem) {
    return { success: false, added: false, error: "Shipper Cloud Credits price not configured" };
  }
  try {
    const { hasMeteredPrice } = await subscriptionHasShipperCloudCreditsPrice(subscriptionId);
    if (hasMeteredPrice) {
      logger.info({ subscriptionId }, "Shipper Cloud Credits price already attached");
      return { success: true, added: false };
    }
    await stripe.subscriptions.update(subscriptionId, {
      items: [priceItem],
      proration_behavior: "none"
      // Metered prices don't need proration
    });
    logger.info({ subscriptionId }, "Added Shipper Cloud Credits price to subscription");
    return { success: true, added: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error, subscriptionId }, "Failed to add Shipper Cloud Credits to subscription");
    return { success: false, added: false, error: errorMessage };
  }
}
async function addConvexMeteredPricesToSubscription(subscriptionId) {
  const result = await addShipperCloudCreditsToSubscription(subscriptionId);
  return {
    success: result.success,
    addedPrices: result.added ? 1 : 0,
    skippedPrices: result.added ? 0 : 1,
    error: result.error
  };
}
async function addConvexMeteredPricesToUserSubscription(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      stripeSubscriptionId: true,
      membershipTier: true,
      email: true
    }
  });
  if (!user) {
    return {
      success: false,
      addedPrices: 0,
      skippedPrices: 0,
      error: "User not found"
    };
  }
  if (!user.stripeSubscriptionId) {
    return {
      success: false,
      addedPrices: 0,
      skippedPrices: 0,
      error: "User does not have an active subscription"
    };
  }
  if (user.membershipTier !== "PRO" && user.membershipTier !== "ENTERPRISE") {
    return {
      success: false,
      addedPrices: 0,
      skippedPrices: 0,
      error: `User is on ${user.membershipTier} tier, not eligible for metered billing`
    };
  }
  const result = await addConvexMeteredPricesToSubscription(user.stripeSubscriptionId);
  return {
    ...result,
    subscriptionId: user.stripeSubscriptionId
  };
}
async function migrateAllUsersToConvexMeteredBilling() {
  const users = await prisma.user.findMany({
    where: {
      membershipTier: { in: ["PRO", "ENTERPRISE"] },
      stripeSubscriptionId: { not: null }
    },
    select: {
      id: true,
      email: true,
      stripeSubscriptionId: true
    }
  });
  logger.info({ userCount: users.length }, "Starting migration to Convex metered billing");
  const results = {
    total: users.length,
    successful: 0,
    failed: 0,
    skipped: 0,
    errors: []
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
          error: result.error ?? "Unknown error"
        });
      }
    } catch (error) {
      results.failed++;
      results.errors.push({
        userId: user.id,
        email: user.email ?? "unknown",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  logger.info(
    {
      total: results.total,
      successful: results.successful,
      failed: results.failed,
      skipped: results.skipped
    },
    "Completed migration to Convex metered billing"
  );
  return results;
}
async function cancelTeamSubscription(teamId) {
  if (!stripe) {
    logger.error("Stripe not configured");
    return;
  }
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { stripeSubscriptionId: true }
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
        billingEnabled: false
      }
    });
    logger.info({ teamId }, "Cancelled team subscription");
  } catch (error) {
    logger.error({ error, teamId }, "Failed to cancel subscription");
    throw error;
  }
}

// src/routes/teams.ts
var router2 = Router2();
var teamIdSchema = z.object({
  teamId: z.string().min(1)
});
var enableBillingSchema = z.object({
  teamId: z.string().min(1),
  billingEmail: z.string().email()
});
router2.post("/billing/enable", async (req, res) => {
  const parsed = enableBillingSchema.safeParse(req.body);
  if (!parsed.success) {
    const response = {
      success: false,
      error: "Invalid request body"
    };
    return res.status(400).json(response);
  }
  const { teamId, billingEmail } = parsed.data;
  try {
    await prisma.team.update({
      where: { id: teamId },
      data: { billingEmail }
    });
    const subscriptionId = await createTeamSubscription(teamId);
    const response = {
      success: true,
      data: {
        teamId,
        subscriptionId,
        billingEnabled: true
      }
    };
    return res.json(response);
  } catch (error) {
    logger.error({ error, teamId }, "Failed to enable billing");
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to enable billing"
    };
    return res.status(500).json(response);
  }
});
router2.post("/billing/disable", async (req, res) => {
  const parsed = teamIdSchema.safeParse(req.body);
  if (!parsed.success) {
    const response = {
      success: false,
      error: "Invalid request body"
    };
    return res.status(400).json(response);
  }
  const { teamId } = parsed.data;
  try {
    await cancelTeamSubscription(teamId);
    const response = {
      success: true,
      data: {
        teamId,
        billingEnabled: false
      }
    };
    return res.json(response);
  } catch (error) {
    logger.error({ error, teamId }, "Failed to disable billing");
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to disable billing"
    };
    return res.status(500).json(response);
  }
});
router2.get("/:teamId/usage", async (req, res) => {
  const { teamId } = req.params;
  if (!teamId) {
    const response = {
      success: false,
      error: "Team ID required"
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
        stripeSubscriptionId: true
      }
    });
    if (!team) {
      const response2 = {
        success: false,
        error: "Team not found"
      };
      return res.status(404).json(response2);
    }
    const usage = await getTeamUsageSummary(teamId);
    const response = {
      success: true,
      data: {
        team: {
          id: team.id,
          name: team.name,
          billingEnabled: team.billingEnabled,
          hasSubscription: !!team.stripeSubscriptionId
        },
        usage
      }
    };
    return res.json(response);
  } catch (error) {
    logger.error({ error, teamId }, "Failed to get usage");
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get usage"
    };
    return res.status(500).json(response);
  }
});
router2.post("/:teamId/report-usage", async (req, res) => {
  const { teamId } = req.params;
  if (!teamId) {
    const response = {
      success: false,
      error: "Team ID required"
    };
    return res.status(400).json(response);
  }
  try {
    await reportUsageToStripe(teamId);
    const response = {
      success: true,
      data: {
        teamId,
        reported: true
      }
    };
    return res.json(response);
  } catch (error) {
    logger.error({ error, teamId }, "Failed to report usage");
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to report usage"
    };
    return res.status(500).json(response);
  }
});
router2.get("/:teamId/billing-status", async (req, res) => {
  const { teamId } = req.params;
  if (!teamId) {
    const response = {
      success: false,
      error: "Team ID required"
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
        stripeSubscriptionId: true
      }
    });
    if (!team) {
      const response2 = {
        success: false,
        error: "Team not found"
      };
      return res.status(404).json(response2);
    }
    const response = {
      success: true,
      data: {
        teamId: team.id,
        teamName: team.name,
        billingEnabled: team.billingEnabled,
        billingEmail: team.billingEmail,
        hasStripeCustomer: !!team.stripeCustomerId,
        hasSubscription: !!team.stripeSubscriptionId
      }
    };
    return res.json(response);
  } catch (error) {
    logger.error({ error, teamId }, "Failed to get billing status");
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get billing status"
    };
    return res.status(500).json(response);
  }
});
var teams_default = router2;

// src/routes/users.ts
init_esm_shims();
import { Router as Router3 } from "express";
import { z as z2 } from "zod";
var router3 = Router3();
var userIdSchema = z2.object({
  userId: z2.string().min(1)
});
var subscriptionIdSchema = z2.object({
  subscriptionId: z2.string().min(1)
});
router3.post("/:userId/add-convex-metered-prices", async (req, res) => {
  const { userId } = req.params;
  if (!userId) {
    const response = {
      success: false,
      error: "User ID required"
    };
    return res.status(400).json(response);
  }
  try {
    const result = await addConvexMeteredPricesToUserSubscription(userId);
    if (!result.success) {
      const response2 = {
        success: false,
        error: result.error ?? "Failed to add metered prices"
      };
      return res.status(400).json(response2);
    }
    const response = {
      success: true,
      data: {
        userId,
        subscriptionId: result.subscriptionId,
        addedPrices: result.addedPrices,
        skippedPrices: result.skippedPrices
      }
    };
    logger.info(
      { userId, addedPrices: result.addedPrices },
      "Added Convex metered prices to user subscription"
    );
    return res.json(response);
  } catch (error) {
    logger.error({ error, userId }, "Failed to add Convex metered prices");
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to add metered prices"
    };
    return res.status(500).json(response);
  }
});
router3.post(
  "/subscription/:subscriptionId/add-convex-metered-prices",
  async (req, res) => {
    const { subscriptionId } = req.params;
    if (!subscriptionId) {
      const response = {
        success: false,
        error: "Subscription ID required"
      };
      return res.status(400).json(response);
    }
    try {
      const result = await addConvexMeteredPricesToSubscription(subscriptionId);
      if (!result.success) {
        const response2 = {
          success: false,
          error: result.error ?? "Failed to add metered prices"
        };
        return res.status(400).json(response2);
      }
      const response = {
        success: true,
        data: {
          subscriptionId,
          addedPrices: result.addedPrices,
          skippedPrices: result.skippedPrices
        }
      };
      logger.info(
        { subscriptionId, addedPrices: result.addedPrices },
        "Added Convex metered prices to subscription"
      );
      return res.json(response);
    } catch (error) {
      logger.error({ error, subscriptionId }, "Failed to add Convex metered prices");
      const response = {
        success: false,
        error: error instanceof Error ? error.message : "Failed to add metered prices"
      };
      return res.status(500).json(response);
    }
  }
);
router3.post(
  "/subscription/:subscriptionId/add-shipper-cloud-credits",
  async (req, res) => {
    const { subscriptionId } = req.params;
    if (!subscriptionId) {
      const response = {
        success: false,
        error: "Subscription ID required"
      };
      return res.status(400).json(response);
    }
    try {
      const result = await addShipperCloudCreditsToSubscription(subscriptionId);
      if (!result.success) {
        const response2 = {
          success: false,
          error: result.error ?? "Failed to add Shipper Cloud Credits"
        };
        return res.status(400).json(response2);
      }
      const response = {
        success: true,
        data: {
          subscriptionId,
          added: result.added
        }
      };
      logger.info(
        { subscriptionId, added: result.added },
        "Added Shipper Cloud Credits to subscription"
      );
      return res.json(response);
    } catch (error) {
      logger.error({ error, subscriptionId }, "Failed to add Shipper Cloud Credits");
      const response = {
        success: false,
        error: error instanceof Error ? error.message : "Failed to add Shipper Cloud Credits"
      };
      return res.status(500).json(response);
    }
  }
);
router3.post("/migrate-to-convex-metered-billing", async (_req, res) => {
  try {
    logger.info("Starting Convex metered billing migration for all users");
    const result = await migrateAllUsersToConvexMeteredBilling();
    const response = {
      success: true,
      data: {
        total: result.total,
        successful: result.successful,
        failed: result.failed,
        skipped: result.skipped,
        errors: result.errors
      }
    };
    logger.info(
      {
        total: result.total,
        successful: result.successful,
        failed: result.failed,
        skipped: result.skipped
      },
      "Completed Convex metered billing migration"
    );
    return res.json(response);
  } catch (error) {
    logger.error({ error }, "Failed to run Convex metered billing migration");
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to run migration"
    };
    return res.status(500).json(response);
  }
});
var users_default = router3;

// src/routes/credits.ts
init_esm_shims();
import {
  Router as Router4
} from "express";
import { z as z3 } from "zod";
var router4 = Router4();
router4.get("/:userId/balance", async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await getCreditBalance(userId);
    if (!result.success) {
      const response2 = {
        success: false,
        error: result.error
      };
      return res.status(400).json(response2);
    }
    const response = {
      success: true,
      data: {
        availableCredits: result.availableCredits,
        availableBalanceCents: result.availableBalanceCents,
        centsPerCredit: CREDIT_PRICING.CENTS_PER_CREDIT
      }
    };
    return res.json(response);
  } catch (error) {
    logger.error({ error, userId }, "Failed to get credit balance");
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get balance"
    };
    return res.status(500).json(response);
  }
});
router4.post("/:userId/sync", async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await syncCreditBalanceToDatabase(userId);
    if (!result.success) {
      const response2 = {
        success: false,
        error: result.error
      };
      return res.status(400).json(response2);
    }
    const response = {
      success: true,
      data: {
        localBalance: result.localBalance,
        stripeBalance: result.stripeBalance
      }
    };
    return res.json(response);
  } catch (error) {
    logger.error({ error, userId }, "Failed to sync credit balance");
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to sync balance"
    };
    return res.status(500).json(response);
  }
});
router4.get("/:userId/grants", async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await listCreditGrants(userId);
    if (!result.success) {
      const response2 = {
        success: false,
        error: result.error
      };
      return res.status(400).json(response2);
    }
    const response = {
      success: true,
      data: { grants: result.grants }
    };
    return res.json(response);
  } catch (error) {
    logger.error({ error, userId }, "Failed to list credit grants");
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to list grants"
    };
    return res.status(500).json(response);
  }
});
var createGrantSchema = z3.object({
  credits: z3.number().min(CREDIT_PRICING.MIN_CREDITS).max(CREDIT_PRICING.MAX_CREDITS),
  category: z3.enum(["paid", "promotional"]),
  name: z3.string().optional(),
  expiresAt: z3.string().datetime().optional(),
  metadata: z3.record(z3.string(), z3.string()).optional()
});
router4.post("/:userId/grants", async (req, res) => {
  const { userId } = req.params;
  const validation = createGrantSchema.safeParse(req.body);
  if (!validation.success) {
    const response = {
      success: false,
      error: validation.error.issues[0]?.message ?? "Invalid request"
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
      expiresAt: expiresAt ? new Date(expiresAt) : void 0,
      metadata
    });
    if (!result.success) {
      const response2 = {
        success: false,
        error: result.error
      };
      return res.status(400).json(response2);
    }
    logger.info(
      { userId, credits, category, creditGrantId: result.creditGrantId },
      "Created credit grant via API"
    );
    const response = {
      success: true,
      data: {
        creditGrantId: result.creditGrantId,
        credits: result.credits,
        amountCents: result.amountCents
      }
    };
    return res.status(201).json(response);
  } catch (error) {
    logger.error({ error, userId }, "Failed to create credit grant");
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create grant"
    };
    return res.status(500).json(response);
  }
});
var promotionalGrantSchema = z3.object({
  credits: z3.number().min(1).max(CREDIT_PRICING.MAX_CREDITS),
  reason: z3.string().min(1).max(200),
  expiresAt: z3.iso.datetime().optional()
});
router4.post("/:userId/promotional", async (req, res) => {
  const { userId } = req.params;
  const validation = promotionalGrantSchema.safeParse(req.body);
  if (!validation.success) {
    const response = {
      success: false,
      error: validation.error.issues[0]?.message ?? "Invalid request"
    };
    return res.status(400).json(response);
  }
  const { credits, reason, expiresAt } = validation.data;
  try {
    const result = await createPromotionalCredits(
      userId,
      credits,
      reason,
      expiresAt ? new Date(expiresAt) : void 0
    );
    if (!result.success) {
      const response2 = {
        success: false,
        error: result.error
      };
      return res.status(400).json(response2);
    }
    logger.info(
      { userId, credits, reason, creditGrantId: result.creditGrantId },
      "Created promotional credits"
    );
    const response = {
      success: true,
      data: {
        creditGrantId: result.creditGrantId,
        credits: result.credits,
        amountCents: result.amountCents
      }
    };
    return res.status(201).json(response);
  } catch (error) {
    logger.error({ error, userId }, "Failed to create promotional credits");
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create promotional credits"
    };
    return res.status(500).json(response);
  }
});
router4.delete(
  "/:userId/grants/:grantId",
  async (req, res) => {
    const { userId, grantId } = req.params;
    try {
      const result = await voidCreditGrant(userId, grantId);
      if (!result.success) {
        const response2 = {
          success: false,
          error: result.error
        };
        return res.status(400).json(response2);
      }
      logger.info({ userId, grantId }, "Voided credit grant");
      const response = {
        success: true,
        data: { voided: true }
      };
      return res.json(response);
    } catch (error) {
      logger.error({ error, userId, grantId }, "Failed to void credit grant");
      const response = {
        success: false,
        error: error instanceof Error ? error.message : "Failed to void grant"
      };
      return res.status(500).json(response);
    }
  }
);
router4.get("/:userId/auto-top-up", async (req, res) => {
  const { userId } = req.params;
  try {
    const config = await getAutoTopUpConfig(userId);
    const response = {
      success: true,
      data: config ?? {
        enabled: false,
        configured: false
      }
    };
    return res.json(response);
  } catch (error) {
    logger.error({ error, userId }, "Failed to get auto top-up config");
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get config"
    };
    return res.status(500).json(response);
  }
});
var autoTopUpConfigSchema = z3.object({
  enabled: z3.boolean(),
  thresholdCredits: z3.number().min(0).max(1e4).optional(),
  topUpCredits: z3.number().min(CREDIT_PRICING.MIN_CREDITS).max(CREDIT_PRICING.MAX_CREDITS).optional(),
  stripePaymentMethodId: z3.string().optional(),
  maxMonthlyTopUps: z3.number().min(1).max(20).optional()
});
router4.post("/:userId/auto-top-up", async (req, res) => {
  const { userId } = req.params;
  const validation = autoTopUpConfigSchema.safeParse(req.body);
  if (!validation.success) {
    const response = {
      success: false,
      error: validation.error.issues[0]?.message ?? "Invalid request"
    };
    return res.status(400).json(response);
  }
  try {
    const result = await configureAutoTopUp({
      userId,
      ...validation.data
    });
    if (!result.success) {
      const response2 = {
        success: false,
        error: result.error
      };
      return res.status(400).json(response2);
    }
    logger.info(
      { userId, enabled: validation.data.enabled },
      "Configured auto top-up"
    );
    const response = {
      success: true,
      data: result.config
    };
    return res.json(response);
  } catch (error) {
    logger.error({ error, userId }, "Failed to configure auto top-up");
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to configure"
    };
    return res.status(500).json(response);
  }
});
router4.delete("/:userId/auto-top-up", async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await disableAutoTopUp(userId);
    if (!result.success) {
      const response2 = {
        success: false,
        error: result.error
      };
      return res.status(400).json(response2);
    }
    logger.info({ userId }, "Disabled auto top-up");
    const response = {
      success: true,
      data: { disabled: true }
    };
    return res.json(response);
  } catch (error) {
    logger.error({ error, userId }, "Failed to disable auto top-up");
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to disable"
    };
    return res.status(500).json(response);
  }
});
router4.post(
  "/:userId/auto-top-up/trigger",
  async (req, res) => {
    const { userId } = req.params;
    try {
      const result = await processAutoTopUp(userId);
      const response = {
        success: result.success,
        data: result,
        ...result.error && { error: result.error }
      };
      return res.json(response);
    } catch (error) {
      logger.error({ error, userId }, "Failed to trigger auto top-up");
      const response = {
        success: false,
        error: error instanceof Error ? error.message : "Failed to trigger"
      };
      return res.status(500).json(response);
    }
  }
);
router4.post("/auto-top-up/check-all", async (_req, res) => {
  try {
    const result = await checkAndProcessAutoTopUps();
    logger.info(
      {
        processed: result.processed,
        successful: result.successful,
        failed: result.failed,
        skipped: result.skipped
      },
      "Completed auto top-up check for all users"
    );
    const response = {
      success: true,
      data: {
        processed: result.processed,
        successful: result.successful,
        failed: result.failed,
        skipped: result.skipped
      }
    };
    return res.json(response);
  } catch (error) {
    logger.error({ error }, "Failed to check all auto top-ups");
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to check"
    };
    return res.status(500).json(response);
  }
});
var aiUsageSchema = z3.object({
  stripeCustomerId: z3.string().min(1),
  credits: z3.number().min(1),
  meterEventName: z3.string().min(1),
  idempotencyKey: z3.string().min(1),
  metadata: z3.object({
    type: z3.literal("ai_usage"),
    projectId: z3.string(),
    model: z3.string().optional(),
    endpoint: z3.string(),
    tokens: z3.number().optional(),
    costUsd: z3.number()
  })
});
router4.post("/:userId/ai-usage", async (req, res) => {
  const { userId } = req.params;
  const validation = aiUsageSchema.safeParse(req.body);
  if (!validation.success) {
    const response = {
      success: false,
      error: validation.error.issues[0]?.message ?? "Invalid request"
    };
    return res.status(400).json(response);
  }
  const {
    stripeCustomerId,
    credits,
    meterEventName,
    idempotencyKey,
    metadata
  } = validation.data;
  try {
    const { queueMeterEvent: queueMeterEvent2 } = await import("./meter-event-queue-ZPK3JRIE.js");
    const jobId = await queueMeterEvent2(
      meterEventName,
      stripeCustomerId,
      credits,
      /* @__PURE__ */ new Date(),
      idempotencyKey
    );
    logger.info(
      {
        userId,
        stripeCustomerId,
        credits,
        jobId,
        model: metadata.model,
        endpoint: metadata.endpoint,
        costUsd: metadata.costUsd
      },
      "Queued AI usage meter event"
    );
    const response = {
      success: true,
      data: {
        jobId,
        credits,
        queued: true
      }
    };
    return res.status(201).json(response);
  } catch (error) {
    logger.error(
      { error, userId, credits },
      "Failed to queue AI usage meter event"
    );
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to report AI usage"
    };
    return res.status(500).json(response);
  }
});
var firstDeploymentBonusSchema = z3.object({
  projectId: z3.string().min(1)
});
router4.post(
  "/:userId/first-deployment-bonus",
  async (req, res) => {
    const { userId } = req.params;
    const validation = firstDeploymentBonusSchema.safeParse(req.body);
    if (!validation.success) {
      const response = {
        success: false,
        error: validation.error.issues[0]?.message ?? "Invalid request"
      };
      return res.status(400).json(response);
    }
    const { projectId } = validation.data;
    try {
      const result = await grantFirstDeploymentBonus(userId, projectId);
      if (!result.success) {
        const response2 = {
          success: false,
          error: result.error
        };
        return res.status(400).json(response2);
      }
      logger.info(
        { userId, projectId, granted: result.granted, credits: result.credits },
        "First deployment bonus request processed"
      );
      const response = {
        success: true,
        data: {
          granted: result.granted,
          credits: result.credits,
          message: result.granted ? `BONUS: We've added $1 (${result.credits} credits) free Cloud credits so you can try out databases, AI in your apps, and more!` : "User already received the welcome bonus"
        }
      };
      return res.status(result.granted ? 201 : 200).json(response);
    } catch (error) {
      logger.error(
        { error, userId, projectId },
        "Failed to process first deployment bonus"
      );
      const response = {
        success: false,
        error: error instanceof Error ? error.message : "Failed to grant bonus"
      };
      return res.status(500).json(response);
    }
  }
);
var credits_default = router4;

// src/index.ts
dotenv.config();
var app = express();
var PORT = process.env.BILLING_PORT || process.env.PORT || 4004;
var ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:4000",
  process.env.WEB_APP_URL,
  process.env.API_URL
].filter(Boolean);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      if (origin.endsWith(".vercel.app")) return callback(null, true);
      if (origin.endsWith(".shipper.app") || origin === "https://shipper.app") {
        return callback(null, true);
      }
      if (process.env.NODE_ENV === "development") return callback(null, true);
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-api-key",
      "x-webhook-signature"
    ]
  })
);
app.use(express.json({ limit: "2mb" }));
app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const queueStats = await getQueueStats().catch(() => null);
    res.json({
      status: "ok",
      service: "billing",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      database: "connected",
      stripe: stripeConfig.hasValidKey ? "configured" : "not configured",
      stripeMode: stripeConfig.isLive ? "live" : "test",
      meterQueue: queueStats || "not connected"
    });
  } catch (error) {
    res.status(503).json({
      status: "error",
      service: "billing",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      database: "disconnected",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});
app.get("/queue/stats", async (_req, res) => {
  try {
    const [meterStats, scheduledStats] = await Promise.all([
      getQueueStats(),
      getScheduledJobsStats().catch(() => null)
    ]);
    res.json({
      success: true,
      data: {
        meterEvents: {
          ...meterStats,
          mode: stripeConfig.isLive ? "live" : "test",
          rateLimit: stripeConfig.isLive ? 1e3 : 10
        },
        scheduledJobs: scheduledStats
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to get queue stats"
    });
  }
});
app.use("/webhook", webhook_default);
app.use(validateApiKey);
app.use("/teams", teams_default);
app.use("/users", users_default);
app.use("/credits", credits_default);
app.use((_req, res) => {
  const response = {
    success: false,
    error: "Not found"
  };
  res.status(404).json(response);
});
async function shutdown() {
  logger.info("Shutting down billing service...");
  await shutdownMeterEventQueue();
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
app.listen(PORT, async () => {
  try {
    startMeterEventWorker();
    logger.info("Meter event queue worker started");
  } catch (error) {
    logger.warn(
      { error },
      "Failed to start meter event queue worker - events will be queued but not processed"
    );
  }
  try {
    await startScheduledJobsWorker();
    await setupAutoTopUpCron();
    await setupCreditsSyncCron();
    logger.info("Scheduled jobs worker started with auto top-up and credits sync crons");
  } catch (error) {
    logger.warn(
      { error },
      "Failed to start scheduled jobs worker - cron jobs will not run automatically"
    );
  }
  logger.info({
    msg: "Billing service started",
    port: PORT,
    url: `http://localhost:${PORT}`,
    healthCheck: `http://localhost:${PORT}/health`,
    queueStats: `http://localhost:${PORT}/queue/stats`,
    webhookEndpoint: `http://localhost:${PORT}/webhook/convex`,
    database: "connected",
    stripe: stripeConfig.hasValidKey ? `configured (${stripeConfig.isLive ? "live" : "test"})` : "not configured",
    meterEventQueue: "enabled",
    scheduledJobs: `enabled (auto top-up every 5 min, credits sync every ${process.env.NODE_ENV === "production" ? "5 min" : "1 min"})`,
    rateLimit: stripeConfig.isLive ? "1000/sec (live)" : "10/sec (test)",
    environment: process.env.NODE_ENV || "development"
  });
});
