/**
 * Stripe Billing Meters Service
 *
 * Uses Stripe's new Billing Meters API for usage-based billing.
 * This replaces the legacy `subscriptionItems.createUsageRecord` API.
 *
 * Events are queued via BullMQ with rate limiting to respect Stripe's limits:
 * - Live mode: 1000 events/second
 * - Test mode: 25 operations/second (shared, so we use 10/sec)
 *
 * @see https://docs.stripe.com/billing/subscriptions/usage-based
 * @see https://docs.stripe.com/api/billing/meter
 */

import { stripe } from "../config/stripe.js";
import { logger } from "../config/logger.js";
import { queueMeterEvent, queueMeterEventsBatch } from "./meter-event-queue.js";

/**
 * Meter event names - these must match what's configured in Stripe
 */
export const METER_EVENT_NAMES = {
  FUNCTION_CALLS: "convex_function_calls",
  ACTION_COMPUTE: "convex_action_compute",
  DATABASE_BANDWIDTH: "convex_database_bandwidth",
  DATABASE_STORAGE: "convex_database_storage",
  FILE_BANDWIDTH: "convex_file_bandwidth",
  FILE_STORAGE: "convex_file_storage",
  VECTOR_BANDWIDTH: "convex_vector_bandwidth",
  VECTOR_STORAGE: "convex_vector_storage",
} as const;

export type MeterEventName = (typeof METER_EVENT_NAMES)[keyof typeof METER_EVENT_NAMES];

/**
 * Send a meter event to Stripe via the rate-limited queue
 *
 * Events are queued and processed asynchronously with rate limiting.
 * This function returns immediately after queueing.
 *
 * @param eventName - The event name configured on the meter
 * @param stripeCustomerId - The Stripe customer ID
 * @param value - The usage value (must be a positive integer)
 * @param timestamp - Optional timestamp (defaults to now, must be within 35 days past to 5 min future)
 * @param idempotencyKey - Optional idempotency key to prevent duplicate events
 * @returns Job ID if queued successfully, false if skipped
 */
export async function sendMeterEvent(
  eventName: MeterEventName,
  stripeCustomerId: string,
  value: number,
  timestamp?: Date,
  idempotencyKey?: string
): Promise<string | false> {
  if (!stripe) {
    logger.warn("Stripe not configured, skipping meter event");
    return false;
  }

  if (value <= 0) {
    logger.debug({ eventName, value }, "Skipping meter event with non-positive value");
    return false;
  }

  try {
    const jobId = await queueMeterEvent(
      eventName,
      stripeCustomerId,
      value,
      timestamp,
      idempotencyKey
    );

    logger.debug(
      { eventName, stripeCustomerId, value, jobId },
      "Queued meter event"
    );
    return jobId;
  } catch (error) {
    logger.error(
      { error, eventName, stripeCustomerId, value },
      "Failed to queue meter event"
    );
    return false;
  }
}

/**
 * Send multiple meter events in batch via the rate-limited queue
 *
 * Events are queued efficiently using BullMQ's addBulk.
 * Returns job IDs for all queued events.
 */
export async function sendMeterEventsBatch(
  events: Array<{
    eventName: MeterEventName;
    stripeCustomerId: string;
    value: number;
    timestamp?: Date;
    idempotencyKey?: string;
  }>
): Promise<{ queued: number; skipped: number; jobIds: string[] }> {
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

/**
 * Report Convex usage as meter events
 *
 * This is the main function to report usage after aggregating
 * from the ConvexUsagePeriod.
 */
export interface ConvexUsageMetrics {
  functionCalls: bigint;
  actionComputeMs: bigint;
  databaseBandwidthBytes: bigint;
  databaseStorageBytes: bigint;
  fileBandwidthBytes: bigint;
  fileStorageBytes: bigint;
  vectorBandwidthBytes: bigint;
  vectorStorageBytes: bigint;
}

const BYTES_PER_GB = 1024 * 1024 * 1024;
const MS_PER_HOUR = 3600000;
const MB_PER_GB = 1024;
const MEMORY_MB = 128; // Assumed average memory for actions

/**
 * Convert raw Convex usage metrics to Stripe meter units
 *
 * Stripe meters expect whole numbers, so we convert:
 * - Function calls: per 1,000 calls
 * - Action compute: GB-hours * 1000 (3 decimal precision)
 * - Bandwidth: MB (megabytes)
 * - Storage: MB (megabytes)
 */
export function convertToMeterUnits(metrics: ConvexUsageMetrics): Record<MeterEventName, number> {
  return {
    [METER_EVENT_NAMES.FUNCTION_CALLS]: Math.ceil(Number(metrics.functionCalls) / 1000),
    [METER_EVENT_NAMES.ACTION_COMPUTE]: Math.ceil(
      (MEMORY_MB / MB_PER_GB) * (Number(metrics.actionComputeMs) / MS_PER_HOUR) * 1000
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
    ),
  };
}

/**
 * Report aggregated usage metrics to Stripe via the queue
 */
export async function reportConvexUsageToStripe(
  stripeCustomerId: string,
  metrics: ConvexUsageMetrics,
  periodId: string
): Promise<{ queued: number; skipped: number; jobIds: string[] }> {
  const meterUnits = convertToMeterUnits(metrics);

  const events = Object.entries(meterUnits).map(([eventName, value]) => ({
    eventName: eventName as MeterEventName,
    stripeCustomerId,
    value,
    idempotencyKey: `${periodId}-${eventName}`,
  }));

  return sendMeterEventsBatch(events);
}

/**
 * List all meters configured in Stripe
 * Useful for debugging and setup verification
 */
export async function listMeters(): Promise<
  Array<{ id: string; displayName: string; eventName: string; status: string }> | null
> {
  if (!stripe) {
    logger.warn("Stripe not configured");
    return null;
  }

  try {
    const meters = await stripe.billing.meters.list({ limit: 100 });
    return meters.data.map((m) => ({
      id: m.id,
      displayName: m.display_name,
      eventName: m.event_name,
      status: m.status,
    }));
  } catch (error) {
    logger.error({ error }, "Failed to list meters");
    return null;
  }
}

/**
 * Get meter event summaries for a customer
 * Useful for displaying usage to customers
 */
export async function getMeterEventSummaries(
  meterId: string,
  stripeCustomerId: string,
  startTime: Date,
  endTime: Date
): Promise<Array<{ aggregatedValue: number; startTime: Date; endTime: Date }> | null> {
  if (!stripe) {
    logger.warn("Stripe not configured");
    return null;
  }

  try {
    const summaries = await stripe.billing.meters.listEventSummaries(meterId, {
      customer: stripeCustomerId,
      start_time: Math.floor(startTime.getTime() / 1000),
      end_time: Math.floor(endTime.getTime() / 1000),
    });

    return summaries.data.map((s) => ({
      aggregatedValue: s.aggregated_value,
      startTime: new Date(s.start_time * 1000),
      endTime: new Date(s.end_time * 1000),
    }));
  } catch (error) {
    logger.error({ error, meterId, stripeCustomerId }, "Failed to get meter summaries");
    return null;
  }
}
