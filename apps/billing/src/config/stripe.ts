/**
 * Stripe Configuration for Billing Service
 *
 * Handles Stripe client initialization for team metered billing.
 * Uses the new Billing Meters API (replaces legacy usage records).
 *
 * @see https://docs.stripe.com/billing/subscriptions/usage-based
 */

// Load env vars BEFORE reading them (ES modules hoist imports)
import dotenv from "dotenv";
import { resolve } from "path";
import Stripe from "stripe";

// Load .env from the billing app root (works for both src and dist)
// process.cwd() is apps/billing when running via pnpm dev:billing
dotenv.config({ path: resolve(process.cwd(), ".env") });

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.warn("[Stripe] Missing STRIPE_SECRET_KEY environment variable");
}

export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: "2025-02-24.acacia",
      typescript: true,
    })
  : null;

export const stripeConfig = {
  isLive: stripeSecretKey?.startsWith("sk_live") ?? false,
  hasValidKey: !!stripeSecretKey,
};

/**
 * Shipper Cloud Credits - Unified metered billing configuration
 *
 * All Convex usage is converted to credits and billed via a single meter.
 * This simplifies billing for users - they see one line item.
 *
 * Setup via script: pnpm tsx scripts/setup-shipper-cloud-credits-meter.ts
 *
 * Credit Pricing (Simple 1:1):
 * - 1 credit = 1 cent ($0.01)
 * - $1 = 100 credits
 * - $5 = 500 credits
 *
 * The meter reports whole credits. Stripe Credit Grants are applied at invoice time.
 *
 * @see https://docs.stripe.com/billing/subscriptions/usage-based/billing-credits
 */
export const SHIPPER_CLOUD_CONFIG = {
  // Unified meter ID
  meterId: process.env.STRIPE_SHIPPER_CLOUD_CREDITS_METER_ID,

  // Unified price ID (linked to the meter)
  priceId: process.env.STRIPE_SHIPPER_CLOUD_CREDITS_PRICE_ID,

  // Product ID for Shipper Cloud Credits
  productId: process.env.STRIPE_SHIPPER_CLOUD_CREDITS_PRODUCT_ID,

  // Pricing - 1 credit = 1 cent
  pricing: {
    /** Cents per credit ($0.01) */
    centsPerCredit: 1,
    /** Credits per dollar (100 credits = $1) */
    creditsPerDollar: 100,
  },
};

/**
 * Legacy: Convex usage metered billing configuration
 *
 * @deprecated Use SHIPPER_CLOUD_CONFIG instead. Individual meters are kept
 * for backward compatibility and detailed usage tracking, but billing now
 * goes through the unified shipper_cloud_credits meter.
 */
export const CONVEX_BILLING_CONFIG = {
  // Meter IDs - created in Stripe Dashboard (Billing > Meters)
  meters: {
    functionCalls: process.env.STRIPE_METER_FUNCTION_CALLS_ID,
    actionCompute: process.env.STRIPE_METER_ACTION_COMPUTE_ID,
    databaseBandwidth: process.env.STRIPE_METER_DB_BANDWIDTH_ID,
    databaseStorage: process.env.STRIPE_METER_DB_STORAGE_ID,
    fileBandwidth: process.env.STRIPE_METER_FILE_BANDWIDTH_ID,
    fileStorage: process.env.STRIPE_METER_FILE_STORAGE_ID,
    vectorBandwidth: process.env.STRIPE_METER_VECTOR_BANDWIDTH_ID,
    vectorStorage: process.env.STRIPE_METER_VECTOR_STORAGE_ID,
  },

  // Price IDs - each linked to its own product and meter
  prices: {
    functionCalls: process.env.STRIPE_CONVEX_FUNCTION_CALLS_PRICE_ID,
    actionCompute: process.env.STRIPE_CONVEX_ACTION_COMPUTE_PRICE_ID,
    databaseBandwidth: process.env.STRIPE_CONVEX_DB_BANDWIDTH_PRICE_ID,
    databaseStorage: process.env.STRIPE_CONVEX_DB_STORAGE_PRICE_ID,
    fileBandwidth: process.env.STRIPE_CONVEX_FILE_BANDWIDTH_PRICE_ID,
    fileStorage: process.env.STRIPE_CONVEX_FILE_STORAGE_PRICE_ID,
    vectorBandwidth: process.env.STRIPE_CONVEX_VECTOR_BANDWIDTH_PRICE_ID,
    vectorStorage: process.env.STRIPE_CONVEX_VECTOR_STORAGE_PRICE_ID,
  },

  // Pricing rates (in cents) - for cost calculation display
  // These are Shipper Cloud rates (50% margin over Convex)
  rates: {
    functionCallsPerMillion: 300, // $3.00
    actionComputePerGBHour: 45, // $0.45
    databaseStoragePerGB: 30, // $0.30/month
    databaseBandwidthPerGB: 30, // $0.30
    fileStoragePerGB: 4.5, // $0.045/month
    fileBandwidthPerGB: 45, // $0.45
    vectorStoragePerGB: 75, // $0.75/month
    vectorBandwidthPerGB: 15, // $0.15
  },
};
