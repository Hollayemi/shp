import { createRequire } from 'module';const require = createRequire(import.meta.url);
import {
  init_esm_shims,
  logger,
  stripe
} from "./chunk-BUABXYJD.js";

// src/services/meter-event-queue.ts
init_esm_shims();
import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
var RATE_LIMITS = {
  live: 1e3,
  // 1000 events/second in live mode
  test: 10
  // Conservative limit for test mode (25 total shared across all API calls)
};
var QUEUE_NAME = "stripe-meter-events";
function isLiveMode() {
  const stripeKey = process.env.STRIPE_SECRET_KEY || "";
  return stripeKey.startsWith("sk_live_");
}
function getRateLimit() {
  return isLiveMode() ? RATE_LIMITS.live : RATE_LIMITS.test;
}
var redisConnection = null;
function getRedisConnection() {
  if (!redisConnection) {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    redisConnection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      // Required for BullMQ
      enableReadyCheck: false
    });
    redisConnection.on("error", (err) => {
      logger.error({ error: err }, "Redis connection error");
    });
    redisConnection.on("connect", () => {
      logger.info("Redis connected for meter event queue");
    });
  }
  return redisConnection;
}
var meterEventQueue = null;
function getMeterEventQueue() {
  if (!meterEventQueue) {
    const connection = getRedisConnection();
    meterEventQueue = new Queue(QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: "exponential",
          delay: 1e3
          // Start with 1 second, then 2s, 4s, 8s, 16s
        },
        removeOnComplete: {
          age: 3600,
          // Keep completed jobs for 1 hour
          count: 1e3
          // Keep last 1000 completed jobs
        },
        removeOnFail: {
          age: 86400
          // Keep failed jobs for 24 hours
        }
      }
    });
    meterEventQueue.on("error", (err) => {
      logger.error({ error: err }, "Meter event queue error");
    });
  }
  return meterEventQueue;
}
var meterEventWorker = null;
function startMeterEventWorker() {
  if (meterEventWorker) {
    return meterEventWorker;
  }
  const connection = getRedisConnection();
  const rateLimit = getRateLimit();
  logger.info(
    {
      mode: isLiveMode() ? "live" : "test",
      rateLimit
    },
    "Starting meter event worker"
  );
  meterEventWorker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { eventName, stripeCustomerId, value, timestamp, idempotencyKey } = job.data;
      if (!stripe) {
        throw new Error("Stripe not configured");
      }
      if (value <= 0) {
        logger.debug(
          { eventName, value, jobId: job.id },
          "Skipping meter event with non-positive value"
        );
        return { skipped: true, reason: "non-positive value" };
      }
      try {
        const payload = {
          stripe_customer_id: stripeCustomerId,
          value: Math.floor(value).toString()
        };
        const options = {};
        if (idempotencyKey) {
          options.idempotencyKey = idempotencyKey;
        }
        await stripe.billing.meterEvents.create(
          {
            event_name: eventName,
            payload,
            ...timestamp && { timestamp }
          },
          options
        );
        logger.debug(
          { eventName, stripeCustomerId, value, jobId: job.id },
          "Sent meter event to Stripe"
        );
        return { success: true };
      } catch (error) {
        const stripeError = error;
        const errorDetails = {
          message: stripeError.message || String(error),
          code: stripeError.code,
          type: stripeError.type,
          statusCode: stripeError.statusCode,
          rawMessage: stripeError.raw?.message
        };
        if (stripeError.statusCode === 429) {
          logger.warn(
            { eventName, stripeCustomerId, jobId: job.id, ...errorDetails },
            "Rate limited by Stripe, will retry"
          );
          throw error;
        }
        if (error instanceof Error && error.message.includes("idempotency")) {
          logger.debug(
            { eventName, stripeCustomerId, idempotencyKey, jobId: job.id },
            "Meter event already processed (idempotency)"
          );
          return { skipped: true, reason: "idempotency" };
        }
        logger.error(
          {
            err: error,
            eventName,
            stripeCustomerId,
            value,
            jobId: job.id,
            stripeError: errorDetails
          },
          "Failed to send meter event to Stripe"
        );
        throw error;
      }
    },
    {
      connection,
      // Rate limiting: process N jobs per second
      limiter: {
        max: rateLimit,
        duration: 1e3
        // 1 second
      },
      concurrency: Math.min(rateLimit, 50)
      // Process up to 50 concurrent jobs (or rate limit if lower)
    }
  );
  meterEventWorker.on("completed", (job) => {
    logger.debug({ jobId: job.id }, "Meter event job completed");
  });
  meterEventWorker.on("failed", (job, err) => {
    const stripeErr = err;
    logger.error(
      {
        jobId: job?.id,
        err,
        attempts: job?.attemptsMade,
        jobData: job?.data,
        stripeError: {
          message: stripeErr.message,
          code: stripeErr.code,
          type: stripeErr.type,
          statusCode: stripeErr.statusCode
        }
      },
      "Meter event job failed"
    );
  });
  meterEventWorker.on("error", (err) => {
    logger.error({ error: err }, "Meter event worker error");
  });
  return meterEventWorker;
}
async function queueMeterEvent(eventName, stripeCustomerId, value, timestamp, idempotencyKey) {
  const queue = getMeterEventQueue();
  const job = await queue.add(
    eventName,
    // Job name for easy identification
    {
      eventName,
      stripeCustomerId,
      value,
      timestamp: timestamp ? Math.floor(timestamp.getTime() / 1e3) : void 0,
      idempotencyKey
    },
    {
      // Use idempotency key as job ID to prevent duplicates
      ...idempotencyKey && { jobId: idempotencyKey }
    }
  );
  logger.debug(
    { eventName, stripeCustomerId, value, jobId: job.id },
    "Queued meter event"
  );
  return job.id || "unknown";
}
async function queueMeterEventsBatch(events) {
  const queue = getMeterEventQueue();
  const jobs = await queue.addBulk(
    events.filter((e) => e.value > 0).map((e) => ({
      name: e.eventName,
      data: {
        eventName: e.eventName,
        stripeCustomerId: e.stripeCustomerId,
        value: e.value,
        timestamp: e.timestamp ? Math.floor(e.timestamp.getTime() / 1e3) : void 0,
        idempotencyKey: e.idempotencyKey
      },
      opts: e.idempotencyKey ? { jobId: e.idempotencyKey } : {}
    }))
  );
  const jobIds = jobs.map((j) => j.id || "unknown");
  logger.debug(
    { eventCount: jobs.length },
    "Queued meter events batch"
  );
  return jobIds;
}
async function getQueueStats() {
  const queue = getMeterEventQueue();
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount()
  ]);
  return { waiting, active, completed, failed, delayed };
}
async function shutdownMeterEventQueue() {
  logger.info("Shutting down meter event queue...");
  if (meterEventWorker) {
    await meterEventWorker.close();
    meterEventWorker = null;
  }
  if (meterEventQueue) {
    await meterEventQueue.close();
    meterEventQueue = null;
  }
  if (scheduledJobsWorker) {
    await scheduledJobsWorker.close();
    scheduledJobsWorker = null;
  }
  if (scheduledJobsQueue) {
    await scheduledJobsQueue.close();
    scheduledJobsQueue = null;
  }
  if (redisConnection) {
    await redisConnection.quit();
    redisConnection = null;
  }
  logger.info("Meter event queue shutdown complete");
}
var SCHEDULED_QUEUE_NAME = "billing-scheduled-jobs";
var scheduledJobsQueue = null;
var scheduledJobsWorker = null;
function getScheduledJobsQueue() {
  if (!scheduledJobsQueue) {
    const connection = getRedisConnection();
    scheduledJobsQueue = new Queue(SCHEDULED_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5e3
        },
        removeOnComplete: {
          age: 86400,
          // Keep completed jobs for 24 hours
          count: 100
        },
        removeOnFail: {
          age: 604800
          // Keep failed jobs for 7 days
        }
      }
    });
  }
  return scheduledJobsQueue;
}
async function startScheduledJobsWorker() {
  if (scheduledJobsWorker) {
    return scheduledJobsWorker;
  }
  const connection = getRedisConnection();
  const { checkAndProcessAutoTopUps } = await import("./auto-top-up-C7FCEKNZ.js");
  const { syncAllTeamCreditsToStripe } = await import("./stripe-credits-sync-HN5VNKCY.js");
  scheduledJobsWorker = new Worker(
    SCHEDULED_QUEUE_NAME,
    async (job) => {
      logger.info({ jobType: job.data.type, jobId: job.id }, "Processing scheduled job");
      switch (job.data.type) {
        case "auto-top-up-check": {
          const result = await checkAndProcessAutoTopUps();
          logger.info(
            {
              processed: result.processed,
              successful: result.successful,
              failed: result.failed,
              skipped: result.skipped
            },
            "Auto top-up check completed"
          );
          return result;
        }
        case "credits-sync": {
          const result = await syncAllTeamCreditsToStripe();
          logger.info(
            {
              processed: result.processed,
              successful: result.successful,
              failed: result.failed,
              totalCredits: result.totalCredits
            },
            "Credits sync completed"
          );
          return result;
        }
        default:
          logger.warn({ jobType: job.data.type }, "Unknown scheduled job type");
          return { skipped: true, reason: "unknown job type" };
      }
    },
    {
      connection,
      concurrency: 1
      // Only run one scheduled job at a time
    }
  );
  scheduledJobsWorker.on("completed", (job) => {
    logger.debug({ jobId: job.id, jobType: job.data.type }, "Scheduled job completed");
  });
  scheduledJobsWorker.on("failed", (job, err) => {
    logger.error(
      { jobId: job?.id, jobType: job?.data.type, error: err },
      "Scheduled job failed"
    );
  });
  logger.info("Scheduled jobs worker started");
  return scheduledJobsWorker;
}
async function setupAutoTopUpCron() {
  const queue = getScheduledJobsQueue();
  const existingJobs = await queue.getRepeatableJobs();
  for (const job of existingJobs) {
    if (job.name === "auto-top-up-check") {
      await queue.removeRepeatableByKey(job.key);
      logger.info("Removed existing auto-top-up cron job");
    }
  }
  await queue.add(
    "auto-top-up-check",
    { type: "auto-top-up-check" },
    {
      repeat: {
        pattern: "*/5 * * * *"
        // Every 5 minutes
      },
      jobId: "auto-top-up-cron"
      // Consistent ID for the repeatable job
    }
  );
  logger.info("Auto top-up cron job scheduled (every 5 minutes)");
}
async function setupCreditsSyncCron() {
  const queue = getScheduledJobsQueue();
  const isProduction = process.env.NODE_ENV === "production";
  const pattern = isProduction ? "*/5 * * * *" : "* * * * *";
  const existingJobs = await queue.getRepeatableJobs();
  for (const job of existingJobs) {
    if (job.name === "credits-sync") {
      await queue.removeRepeatableByKey(job.key);
      logger.info("Removed existing credits-sync cron job");
    }
  }
  await queue.add(
    "credits-sync",
    { type: "credits-sync" },
    {
      repeat: { pattern },
      jobId: "credits-sync-cron"
    }
  );
  logger.info(`Credits sync cron job scheduled (every ${isProduction ? "5 minutes" : "1 minute"})`);
}
async function getScheduledJobsStats() {
  const queue = getScheduledJobsQueue();
  const [waiting, active, completed, failed, delayed, repeatableJobs] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
    queue.getRepeatableJobs().then((jobs) => jobs.length)
  ]);
  return { waiting, active, completed, failed, delayed, repeatableJobs };
}

export {
  getMeterEventQueue,
  startMeterEventWorker,
  queueMeterEvent,
  queueMeterEventsBatch,
  getQueueStats,
  shutdownMeterEventQueue,
  startScheduledJobsWorker,
  setupAutoTopUpCron,
  setupCreditsSyncCron,
  getScheduledJobsStats
};
