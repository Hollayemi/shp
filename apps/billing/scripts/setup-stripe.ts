/**
 * Setup Stripe Billing Meters, Products, and Prices
 *
 * Creates all required Stripe resources for Shipper Cloud billing.
 * Run once to set up, then copy the output to your .env file.
 *
 * Usage: pnpm tsx scripts/setup-stripe.ts
 */

import Stripe from "stripe";
import "dotenv/config";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

// Map event names to env var suffixes (matching stripe.ts config)
const ENV_KEY_MAP: Record<string, string> = {
  convex_function_calls: "FUNCTION_CALLS",
  convex_action_compute: "ACTION_COMPUTE",
  convex_database_bandwidth: "DB_BANDWIDTH",
  convex_database_storage: "DB_STORAGE",
  convex_file_bandwidth: "FILE_BANDWIDTH",
  convex_file_storage: "FILE_STORAGE",
  convex_vector_bandwidth: "VECTOR_BANDWIDTH",
  convex_vector_storage: "VECTOR_STORAGE",
};

// Meter configurations
const METERS = [
  {
    name: "Function Calls",
    eventName: "convex_function_calls",
    aggregation: "sum" as const,
    pricePerUnit: 0.003, // $0.003 per 1000 calls
  },
  {
    name: "Action Compute",
    eventName: "convex_action_compute",
    aggregation: "sum" as const,
    pricePerUnit: 0.00000045, // per ms
  },
  {
    name: "Database Bandwidth",
    eventName: "convex_database_bandwidth",
    aggregation: "sum" as const,
    pricePerUnit: 0.00029, // per MB
  },
  {
    name: "Database Storage",
    eventName: "convex_database_storage",
    aggregation: "max" as const,
    pricePerUnit: 0.00029, // per MB
  },
  {
    name: "File Bandwidth",
    eventName: "convex_file_bandwidth",
    aggregation: "sum" as const,
    pricePerUnit: 0.00044, // per MB
  },
  {
    name: "File Storage",
    eventName: "convex_file_storage",
    aggregation: "max" as const,
    pricePerUnit: 0.000044, // per MB
  },
  {
    name: "Vector Bandwidth",
    eventName: "convex_vector_bandwidth",
    aggregation: "sum" as const,
    pricePerUnit: 0.00015, // per MB
  },
  {
    name: "Vector Storage",
    eventName: "convex_vector_storage",
    aggregation: "max" as const,
    pricePerUnit: 0.00073, // per MB
  },
];

async function main() {
  console.log("=== Stripe Billing Setup ===\n");

  const envVars: Record<string, string> = {};

  // Check for existing meters
  console.log("Checking existing meters...");
  const existingMeters = await stripe.billing.meters.list({ limit: 100 });
  const metersByEventName = new Map(
    existingMeters.data.map((m) => [m.event_name, m])
  );

  for (const config of METERS) {
    console.log(`\n--- ${config.name} ---`);

    // 1. Create or get meter
    let meter = metersByEventName.get(config.eventName);
    if (meter) {
      console.log(`  Meter exists: ${meter.id}`);
    } else {
      console.log(`  Creating meter...`);
      meter = await stripe.billing.meters.create({
        display_name: config.name,
        event_name: config.eventName,
        default_aggregation: { formula: config.aggregation },
        customer_mapping: {
          type: "by_id",
          event_payload_key: "stripe_customer_id",
        },
        value_settings: {
          event_payload_key: "value",
        },
      });
      console.log(`  ✓ Created meter: ${meter.id}`);
    }

    // Store meter ID
    const envKeySuffix = ENV_KEY_MAP[config.eventName];
    const meterEnvKey = `STRIPE_METER_${envKeySuffix}_ID`;
    envVars[meterEnvKey] = meter.id;

    // 2. Create product
    console.log(`  Creating product...`);
    const product = await stripe.products.create({
      name: config.name,
      description: `Shipper Cloud - ${config.name}`,
      metadata: {
        type: "shipper_cloud_usage",
        meter_event_name: config.eventName,
      },
    });
    console.log(`  ✓ Created product: ${product.id}`);

    // 3. Create price linked to meter
    console.log(`  Creating price...`);
    const price = await stripe.prices.create({
      product: product.id,
      currency: "usd",
      billing_scheme: "per_unit",
      recurring: {
        interval: "month",
        usage_type: "metered",
        meter: meter.id,
      },
      unit_amount_decimal: (config.pricePerUnit * 100).toFixed(10), // Convert to cents
    });
    console.log(`  ✓ Created price: ${price.id}`);

    // Store price ID
    const priceEnvKey = `STRIPE_CONVEX_${envKeySuffix}_PRICE_ID`;
    envVars[priceEnvKey] = price.id;
  }

  // Output environment variables
  console.log("\n\n=== Environment Variables ===");
  console.log("Copy these to your .env file:\n");
  console.log("# Stripe Billing Meters");
  for (const [key, value] of Object.entries(envVars)) {
    if (key.includes("METER")) {
      console.log(`${key}=${value}`);
    }
  }
  console.log("\n# Stripe Prices");
  for (const [key, value] of Object.entries(envVars)) {
    if (key.includes("PRICE")) {
      console.log(`${key}=${value}`);
    }
  }

  console.log("\n=== Setup Complete ===");
}

main().catch(console.error);
