/**
 * Shipper Cloud Credits Service
 *
 * Unified credit system that converts all Convex usage to a single
 * "Shipper Cloud Credits" meter. This simplifies billing for users -
 * they see one line item instead of 8 separate usage types.
 *
 * Flow:
 * 1. Convex usage events come in (function calls, bandwidth, storage, etc.)
 * 2. We convert usage to credits using defined rates
 * 3. Send single meter event to "shipper_cloud_credits" meter
 * 4. Stripe Credit Grants apply to this meter at invoice time
 *
 * Credit Pricing (Simple 1:1 cents):
 * - 1 credit = 1 cent ($0.01)
 * - $1 = 100 credits
 * - All Convex usage is converted to credits at our defined rates
 */

import { stripe } from "../config/stripe.js";
import { logger } from "../config/logger.js";
import { queueMeterEvent } from "./meter-event-queue.js";
import type { ConvexUsageMetrics } from "./stripe-meters.js";

/**
 * The unified meter event name - must match what's configured in Stripe
 * Can be overridden via SHIPPER_CLOUD_CREDITS_METER_NAME env var for migration
 */
export const SHIPPER_CLOUD_CREDITS_METER =
  process.env.SHIPPER_CLOUD_CREDITS_METER_NAME || "shipper_cloud_credits_dec_v2";

/**
 * Credit pricing configuration
 * Simple pricing: 1 credit = 1 cent ($0.01)
 */
export const CREDIT_PRICING = {
  /** Cents per credit - 1 cent = 1 credit */
  CENTS_PER_CREDIT: 1,
  /** Credits per dollar - $1 = 100 credits */
  CREDITS_PER_DOLLAR: 100,
} as const;

/**
 * Convex usage to credits conversion rates
 *
 * These rates determine how much each type of Convex usage costs in credits.
 * Rates are based on Convex's pricing with a 50% margin (pass-through + 50%).
 *
 * Convex Base Pricing (for reference):
 * - Function calls: $2.00 per million (we charge $3.00)
 * - Action compute: $0.30 per GB-hour (we charge $0.45)
 * - Database storage: $0.20/GB/month (we charge $0.30)
 * - Database bandwidth: $0.20/GB (we charge $0.30)
 * - File storage: $0.03/GB/month (we charge $0.045)
 * - File bandwidth: $0.30/GB (we charge $0.45)
 * - Vector storage: $0.50/GB/month (we charge $0.75)
 * - Vector bandwidth: $0.10/GB (we charge $0.15)
 *
 * With 1 credit = 1 cent, the rates below are in credits (cents).
 */
export const CONVEX_TO_CREDITS_RATES = {
  /**
   * Function calls: 300 credits per million calls
   * (Convex: $2/million, we charge $3/million = 300 cents = 300 credits)
   */
  functionCallsPerMillion: 300,

  /**
   * Action compute: 45 credits per GB-hour
   * (Convex: $0.30/GB-hr, we charge $0.45/GB-hr = 45 cents = 45 credits)
   */
  actionComputePerGBHour: 45,

  /**
   * Database storage: 30 credits per GB/month
   * (Convex: $0.20/GB/mo, we charge $0.30/GB/mo = 30 cents = 30 credits)
   */
  databaseStoragePerGBMonth: 30,

  /**
   * Database bandwidth: 30 credits per GB
   * (Convex: $0.20/GB, we charge $0.30/GB = 30 cents = 30 credits)
   */
  databaseBandwidthPerGB: 30,

  /**
   * File storage: 4.5 credits per GB/month
   * (Convex: $0.03/GB/mo, we charge $0.045/GB/mo = 4.5 cents = 4.5 credits)
   */
  fileStoragePerGBMonth: 4.5,

  /**
   * File bandwidth: 45 credits per GB
   * (Convex: $0.30/GB, we charge $0.45/GB = 45 cents = 45 credits)
   */
  fileBandwidthPerGB: 45,

  /**
   * Vector storage: 75 credits per GB/month
   * (Convex: $0.50/GB/mo, we charge $0.75/GB/mo = 75 cents = 75 credits)
   */
  vectorStoragePerGBMonth: 75,

  /**
   * Vector bandwidth: 15 credits per GB
   * (Convex: $0.10/GB, we charge $0.15/GB = 15 cents = 15 credits)
   */
  vectorBandwidthPerGB: 15,
} as const;

const BYTES_PER_GB = 1024 * 1024 * 1024;
const MS_PER_HOUR = 3600000;
const MB_PER_GB = 1024;
const MEMORY_MB = 128; // Assumed average memory for Convex actions

/**
 * Calculate total credits from Convex usage metrics (raw, no rounding)
 *
 * Use this for accumulating credits over time. Only round when syncing to Stripe.
 *
 * @param metrics - Raw Convex usage metrics
 * @returns Total credits consumed as a fractional number (no rounding)
 */
export function calculateCreditsFromConvexUsageRaw(metrics: ConvexUsageMetrics): number {
  const rates = CONVEX_TO_CREDITS_RATES;

  let totalCredits = 0;

  // Function calls (per million)
  const functionCallCredits =
    (Number(metrics.functionCalls) / 1_000_000) * rates.functionCallsPerMillion;
  totalCredits += functionCallCredits;

  // Action compute (convert ms to GB-hours)
  // GB-hours = (memory_MB / 1024) * (time_ms / 3600000)
  const gbHours = (MEMORY_MB / MB_PER_GB) * (Number(metrics.actionComputeMs) / MS_PER_HOUR);
  const actionComputeCredits = gbHours * rates.actionComputePerGBHour;
  totalCredits += actionComputeCredits;

  // Database bandwidth (per GB)
  const dbBandwidthCredits =
    (Number(metrics.databaseBandwidthBytes) / BYTES_PER_GB) * rates.databaseBandwidthPerGB;
  totalCredits += dbBandwidthCredits;

  // Database storage (per GB, prorated for billing period)
  const dbStorageCredits =
    (Number(metrics.databaseStorageBytes) / BYTES_PER_GB) * rates.databaseStoragePerGBMonth;
  totalCredits += dbStorageCredits;

  // File bandwidth (per GB)
  const fileBandwidthCredits =
    (Number(metrics.fileBandwidthBytes) / BYTES_PER_GB) * rates.fileBandwidthPerGB;
  totalCredits += fileBandwidthCredits;

  // File storage (per GB, prorated for billing period)
  const fileStorageCredits =
    (Number(metrics.fileStorageBytes) / BYTES_PER_GB) * rates.fileStoragePerGBMonth;
  totalCredits += fileStorageCredits;

  // Vector bandwidth (per GB)
  const vectorBandwidthCredits =
    (Number(metrics.vectorBandwidthBytes) / BYTES_PER_GB) * rates.vectorBandwidthPerGB;
  totalCredits += vectorBandwidthCredits;

  // Vector storage (per GB, prorated for billing period)
  const vectorStorageCredits =
    (Number(metrics.vectorStorageBytes) / BYTES_PER_GB) * rates.vectorStoragePerGBMonth;
  totalCredits += vectorStorageCredits;

  return totalCredits;
}

/**
 * Calculate total credits from Convex usage metrics (rounded for billing)
 *
 * @param metrics - Raw Convex usage metrics
 * @returns Total credits consumed (rounded UP to whole number, minimum 1 if any usage)
 */
export function calculateCreditsFromConvexUsage(metrics: ConvexUsageMetrics): number {
  const totalCredits = calculateCreditsFromConvexUsageRaw(metrics);

  // Always round UP to whole number
  // If any usage occurred, charge at least 1 credit
  if (totalCredits > 0 && totalCredits < 1) {
    return 1;
  }

  return Math.ceil(totalCredits);
}

/**
 * Get detailed credit breakdown from Convex usage
 * Useful for displaying to users
 */
export function getCreditsBreakdown(metrics: ConvexUsageMetrics): {
  functionCalls: { usage: number; credits: number };
  actionCompute: { usage: number; unit: string; credits: number };
  databaseBandwidth: { usage: number; unit: string; credits: number };
  databaseStorage: { usage: number; unit: string; credits: number };
  fileBandwidth: { usage: number; unit: string; credits: number };
  fileStorage: { usage: number; unit: string; credits: number };
  vectorBandwidth: { usage: number; unit: string; credits: number };
  vectorStorage: { usage: number; unit: string; credits: number };
  total: number;
} {
  const rates = CONVEX_TO_CREDITS_RATES;

  const functionCalls = Number(metrics.functionCalls);
  const gbHours = (MEMORY_MB / MB_PER_GB) * (Number(metrics.actionComputeMs) / MS_PER_HOUR);
  const dbBandwidthGB = Number(metrics.databaseBandwidthBytes) / BYTES_PER_GB;
  const dbStorageGB = Number(metrics.databaseStorageBytes) / BYTES_PER_GB;
  const fileBandwidthGB = Number(metrics.fileBandwidthBytes) / BYTES_PER_GB;
  const fileStorageGB = Number(metrics.fileStorageBytes) / BYTES_PER_GB;
  const vectorBandwidthGB = Number(metrics.vectorBandwidthBytes) / BYTES_PER_GB;
  const vectorStorageGB = Number(metrics.vectorStorageBytes) / BYTES_PER_GB;

  const breakdown = {
    functionCalls: {
      usage: functionCalls,
      credits: (functionCalls / 1_000_000) * rates.functionCallsPerMillion,
    },
    actionCompute: {
      usage: gbHours,
      unit: "GB-hours",
      credits: gbHours * rates.actionComputePerGBHour,
    },
    databaseBandwidth: {
      usage: dbBandwidthGB,
      unit: "GB",
      credits: dbBandwidthGB * rates.databaseBandwidthPerGB,
    },
    databaseStorage: {
      usage: dbStorageGB,
      unit: "GB",
      credits: dbStorageGB * rates.databaseStoragePerGBMonth,
    },
    fileBandwidth: {
      usage: fileBandwidthGB,
      unit: "GB",
      credits: fileBandwidthGB * rates.fileBandwidthPerGB,
    },
    fileStorage: {
      usage: fileStorageGB,
      unit: "GB",
      credits: fileStorageGB * rates.fileStoragePerGBMonth,
    },
    vectorBandwidth: {
      usage: vectorBandwidthGB,
      unit: "GB",
      credits: vectorBandwidthGB * rates.vectorBandwidthPerGB,
    },
    vectorStorage: {
      usage: vectorStorageGB,
      unit: "GB",
      credits: vectorStorageGB * rates.vectorStoragePerGBMonth,
    },
    total: 0,
  };

  breakdown.total = Math.ceil(
    breakdown.functionCalls.credits +
      breakdown.actionCompute.credits +
      breakdown.databaseBandwidth.credits +
      breakdown.databaseStorage.credits +
      breakdown.fileBandwidth.credits +
      breakdown.fileStorage.credits +
      breakdown.vectorBandwidth.credits +
      breakdown.vectorStorage.credits
  );

  return breakdown;
}

/**
 * Send Shipper Cloud Credits usage to Stripe
 *
 * This converts Convex usage to credits and sends a single meter event
 * to the unified "shipper_cloud_credits" meter.
 *
 * @param stripeCustomerId - The Stripe customer ID
 * @param metrics - Raw Convex usage metrics
 * @param idempotencyKey - Unique key to prevent duplicate charges
 * @returns Job ID if queued successfully, false if skipped
 */
export async function reportCreditsUsageToStripe(
  stripeCustomerId: string,
  metrics: ConvexUsageMetrics,
  idempotencyKey: string
): Promise<string | false> {
  if (!stripe) {
    logger.warn("Stripe not configured, skipping credits usage report");
    return false;
  }

  const credits = calculateCreditsFromConvexUsage(metrics);

  if (credits <= 0) {
    logger.debug({ stripeCustomerId }, "No credits to report (zero usage)");
    return false;
  }

  try {
    const jobId = await queueMeterEvent(
      SHIPPER_CLOUD_CREDITS_METER,
      stripeCustomerId,
      credits,
      undefined,
      idempotencyKey
    );

    logger.info(
      { stripeCustomerId, credits, jobId, idempotencyKey },
      "Queued Shipper Cloud Credits meter event"
    );

    return jobId;
  } catch (error) {
    logger.error(
      { error, stripeCustomerId, credits },
      "Failed to queue Shipper Cloud Credits meter event"
    );
    return false;
  }
}

/**
 * Convert credits to USD for display
 */
export function creditsToUSD(credits: number): number {
  return credits * (CREDIT_PRICING.CENTS_PER_CREDIT / 100);
}

/**
 * Convert USD to credits
 */
export function usdToCredits(usd: number): number {
  return Math.floor(usd * CREDIT_PRICING.CREDITS_PER_DOLLAR);
}
