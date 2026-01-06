/**
 * Meter Event Queue Service
 *
 * Uses BullMQ to queue Stripe meter events with rate limiting.
 * Respects different rate limits for test vs live mode:
 * - Live mode: 1000 events/second
 * - Test mode: 25 operations/second (shared with all API calls, so we use 10/sec to be safe)
 *
 * Also handles scheduled jobs like auto top-up checks.
 *
 * @see https://docs.stripe.com/billing/subscriptions/usage-based/recording-usage-api#rate-limits
 */

import { Queue, Worker, Job } from "bullmq";
import { Redis } from "ioredis";
import { stripe } from "../config/stripe.js";
import { logger } from "../config/logger.js";

/**
 * Meter event name type - string identifier for Stripe billing meters.
 * This is defined here to avoid circular dependency with stripe-meters.ts.
 */
export type MeterEventName = string;

// Rate limits per second
const RATE_LIMITS = {
  live: 1000, // 1000 events/second in live mode
  test: 10, // Conservative limit for test mode (25 total shared across all API calls)
} as const;

// Queue configuration
const QUEUE_NAME = "stripe-meter-events";

// Determine if we're in live mode based on Stripe key
function isLiveMode(): boolean {
  const stripeKey = process.env.STRIPE_SECRET_KEY || "";
  return stripeKey.startsWith("sk_live_");
}

// Get the rate limit for current mode
function getRateLimit(): number {
  return isLiveMode() ? RATE_LIMITS.live : RATE_LIMITS.test;
}

// Redis connection
let redisConnection: Redis | null = null;

function getRedisConnection(): Redis {
  if (!redisConnection) {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    redisConnection = new Redis(redisUrl, {
      maxRetriesPerRequest: null, // Required for BullMQ
      enableReadyCheck: false,
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

// Meter event job data
export interface MeterEventJobData {
  eventName: MeterEventName;
  stripeCustomerId: string;
  value: number;
  timestamp?: number; // Unix timestamp in seconds
  idempotencyKey?: string;
}

// Queue instance (singleton)
let meterEventQueue: Queue<MeterEventJobData> | null = null;

export function getMeterEventQueue(): Queue<MeterEventJobData> {
  if (!meterEventQueue) {
    const connection = getRedisConnection();
    meterEventQueue = new Queue<MeterEventJobData>(QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: "exponential",
          delay: 1000, // Start with 1 second, then 2s, 4s, 8s, 16s
        },
        removeOnComplete: {
          age: 3600, // Keep completed jobs for 1 hour
          count: 1000, // Keep last 1000 completed jobs
        },
        removeOnFail: {
          age: 86400, // Keep failed jobs for 24 hours
        },
      },
    });

    meterEventQueue.on("error", (err) => {
      logger.error({ error: err }, "Meter event queue error");
    });
  }
  return meterEventQueue;
}

// Worker instance (singleton)
let meterEventWorker: Worker<MeterEventJobData> | null = null;

/**
 * Start the meter event worker
 * Call this once when the billing service starts
 */
export function startMeterEventWorker(): Worker<MeterEventJobData> {
  if (meterEventWorker) {
    return meterEventWorker;
  }

  const connection = getRedisConnection();
  const rateLimit = getRateLimit();

  logger.info(
    {
      mode: isLiveMode() ? "live" : "test",
      rateLimit,
    },
    "Starting meter event worker"
  );

  meterEventWorker = new Worker<MeterEventJobData>(
    QUEUE_NAME,
    async (job: Job<MeterEventJobData>) => {
      const { eventName, stripeCustomerId, value, timestamp, idempotencyKey } =
        job.data;

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
        const payload: Record<string, string> = {
          stripe_customer_id: stripeCustomerId,
          value: Math.floor(value).toString(),
        };

        const options: { idempotencyKey?: string } = {};
        if (idempotencyKey) {
          options.idempotencyKey = idempotencyKey;
        }

        await stripe.billing.meterEvents.create(
          {
            event_name: eventName,
            payload,
            ...(timestamp && { timestamp }),
          },
          options
        );

        logger.debug(
          { eventName, stripeCustomerId, value, jobId: job.id },
          "Sent meter event to Stripe"
        );

        return { success: true };
      } catch (error: unknown) {
        // Extract Stripe error details
        const stripeError = error as {
          statusCode?: number;
          code?: string;
          type?: string;
          message?: string;
          raw?: { message?: string };
        };
        const errorDetails = {
          message: stripeError.message || String(error),
          code: stripeError.code,
          type: stripeError.type,
          statusCode: stripeError.statusCode,
          rawMessage: stripeError.raw?.message,
        };

        // Check for rate limit errors (429)
        if (stripeError.statusCode === 429) {
          logger.warn(
            { eventName, stripeCustomerId, jobId: job.id, ...errorDetails },
            "Rate limited by Stripe, will retry"
          );
          throw error; // Let BullMQ retry with exponential backoff
        }

        // Check for idempotency errors (already processed)
        if (
          error instanceof Error &&
          error.message.includes("idempotency")
        ) {
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
            stripeError: errorDetails,
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
        duration: 1000, // 1 second
      },
      concurrency: Math.min(rateLimit, 50), // Process up to 50 concurrent jobs (or rate limit if lower)
    }
  );

  meterEventWorker.on("completed", (job) => {
    logger.debug({ jobId: job.id }, "Meter event job completed");
  });

  meterEventWorker.on("failed", (job, err) => {
    // Extract error details for better logging
    const stripeErr = err as {
      statusCode?: number;
      code?: string;
      type?: string;
      message?: string;
    };
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
          statusCode: stripeErr.statusCode,
        },
      },
      "Meter event job failed"
    );
  });

  meterEventWorker.on("error", (err) => {
    logger.error({ error: err }, "Meter event worker error");
  });

  return meterEventWorker;
}

/**
 * Queue a meter event for processing
 * Returns immediately - event will be processed asynchronously
 */
export async function queueMeterEvent(
  eventName: MeterEventName,
  stripeCustomerId: string,
  value: number,
  timestamp?: Date,
  idempotencyKey?: string
): Promise<string> {
  const queue = getMeterEventQueue();

  const job = await queue.add(
    eventName, // Job name for easy identification
    {
      eventName,
      stripeCustomerId,
      value,
      timestamp: timestamp ? Math.floor(timestamp.getTime() / 1000) : undefined,
      idempotencyKey,
    },
    {
      // Use idempotency key as job ID to prevent duplicates
      ...(idempotencyKey && { jobId: idempotencyKey }),
    }
  );

  logger.debug(
    { eventName, stripeCustomerId, value, jobId: job.id },
    "Queued meter event"
  );

  return job.id || "unknown";
}

/**
 * Queue multiple meter events for processing
 */
export async function queueMeterEventsBatch(
  events: Array<{
    eventName: MeterEventName;
    stripeCustomerId: string;
    value: number;
    timestamp?: Date;
    idempotencyKey?: string;
  }>
): Promise<string[]> {
  const queue = getMeterEventQueue();

  const jobs = await queue.addBulk(
    events
      .filter((e) => e.value > 0)
      .map((e) => ({
        name: e.eventName,
        data: {
          eventName: e.eventName,
          stripeCustomerId: e.stripeCustomerId,
          value: e.value,
          timestamp: e.timestamp
            ? Math.floor(e.timestamp.getTime() / 1000)
            : undefined,
          idempotencyKey: e.idempotencyKey,
        },
        opts: e.idempotencyKey ? { jobId: e.idempotencyKey } : {},
      }))
  );

  const jobIds = jobs.map((j) => j.id || "unknown");

  logger.debug(
    { eventCount: jobs.length },
    "Queued meter events batch"
  );

  return jobIds;
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}> {
  const queue = getMeterEventQueue();
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
}

/**
 * Graceful shutdown
 */
export async function shutdownMeterEventQueue(): Promise<void> {
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

// ==========================================
// Scheduled Jobs Queue (for cron jobs)
// ==========================================

const SCHEDULED_QUEUE_NAME = "billing-scheduled-jobs";

interface ScheduledJobData {
  type: "auto-top-up-check" | "credits-sync";
}

let scheduledJobsQueue: Queue<ScheduledJobData> | null = null;
let scheduledJobsWorker: Worker<ScheduledJobData> | null = null;

function getScheduledJobsQueue(): Queue<ScheduledJobData> {
  if (!scheduledJobsQueue) {
    const connection = getRedisConnection();
    scheduledJobsQueue = new Queue<ScheduledJobData>(SCHEDULED_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: {
          age: 86400, // Keep completed jobs for 24 hours
          count: 100,
        },
        removeOnFail: {
          age: 604800, // Keep failed jobs for 7 days
        },
      },
    });
  }
  return scheduledJobsQueue;
}

/**
 * Start the scheduled jobs worker
 * This handles cron jobs like auto top-up checks
 */
export async function startScheduledJobsWorker(): Promise<Worker<ScheduledJobData>> {
  if (scheduledJobsWorker) {
    return scheduledJobsWorker;
  }

  const connection = getRedisConnection();

  // Dynamically import to avoid circular dependency
  const { checkAndProcessAutoTopUps } = await import("./auto-top-up.js");
  const { syncAllTeamCreditsToStripe } = await import("./stripe-credits-sync.js");

  scheduledJobsWorker = new Worker<ScheduledJobData>(
    SCHEDULED_QUEUE_NAME,
    async (job: Job<ScheduledJobData>) => {
      logger.info({ jobType: job.data.type, jobId: job.id }, "Processing scheduled job");

      switch (job.data.type) {
        case "auto-top-up-check": {
          const result = await checkAndProcessAutoTopUps();
          logger.info(
            {
              processed: result.processed,
              successful: result.successful,
              failed: result.failed,
              skipped: result.skipped,
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
              totalCredits: result.totalCredits,
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
      concurrency: 1, // Only run one scheduled job at a time
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

/**
 * Set up the auto top-up cron job
 * Runs every 5 minutes to check if any users need credit top-ups
 */
export async function setupAutoTopUpCron(): Promise<void> {
  const queue = getScheduledJobsQueue();

  // Remove any existing repeatable job with this name first
  const existingJobs = await queue.getRepeatableJobs();
  for (const job of existingJobs) {
    if (job.name === "auto-top-up-check") {
      await queue.removeRepeatableByKey(job.key);
      logger.info("Removed existing auto-top-up cron job");
    }
  }

  // Add the repeatable job - runs every 5 minutes
  await queue.add(
    "auto-top-up-check",
    { type: "auto-top-up-check" },
    {
      repeat: {
        pattern: "*/5 * * * *", // Every 5 minutes
      },
      jobId: "auto-top-up-cron", // Consistent ID for the repeatable job
    }
  );

  logger.info("Auto top-up cron job scheduled (every 5 minutes)");
}

/**
 * Set up the credits sync cron job
 * Syncs cumulative credits to Stripe periodically.
 *
 * Uses "Last" aggregation in Stripe - only the final cumulative value matters.
 * Interval: 1 minute in dev, 5 minutes in production.
 */
export async function setupCreditsSyncCron(): Promise<void> {
  const queue = getScheduledJobsQueue();
  const isProduction = process.env.NODE_ENV === "production";
  const pattern = isProduction ? "*/5 * * * *" : "* * * * *";

  // Remove any existing repeatable job with this name first
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
      jobId: "credits-sync-cron",
    }
  );

  logger.info(`Credits sync cron job scheduled (every ${isProduction ? "5 minutes" : "1 minute"})`);
}

/**
 * Get scheduled jobs queue statistics
 */
export async function getScheduledJobsStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  repeatableJobs: number;
}> {
  const queue = getScheduledJobsQueue();
  const [waiting, active, completed, failed, delayed, repeatableJobs] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
    queue.getRepeatableJobs().then((jobs) => jobs.length),
  ]);

  return { waiting, active, completed, failed, delayed, repeatableJobs };
}
