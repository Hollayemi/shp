#!/usr/bin/env tsx
/**
 * Migrate Existing Subscriptions to Convex Metered Billing
 *
 * This script adds Convex metered prices to all existing PRO/ENTERPRISE
 * user subscriptions. Run this once to enable usage-based billing for
 * existing subscribers.
 *
 * Usage: pnpm tsx scripts/migrate-to-convex-metered-billing.ts
 */

import "dotenv/config";
import { migrateAllUsersToConvexMeteredBilling } from "../src/services/stripe-billing.js";
import { prisma } from "@shipper/database";

async function main() {
  console.log("=== Convex Metered Billing Migration ===\n");

  // Verify Stripe configuration
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("Error: STRIPE_SECRET_KEY is not configured");
    process.exit(1);
  }

  const isLive = process.env.STRIPE_SECRET_KEY.startsWith("sk_live_");
  console.log(`Stripe mode: ${isLive ? "LIVE" : "TEST"}\n`);

  // Check for configured metered prices
  const priceEnvVars = [
    "STRIPE_CONVEX_FUNCTION_CALLS_PRICE_ID",
    "STRIPE_CONVEX_ACTION_COMPUTE_PRICE_ID",
    "STRIPE_CONVEX_DB_BANDWIDTH_PRICE_ID",
    "STRIPE_CONVEX_DB_STORAGE_PRICE_ID",
    "STRIPE_CONVEX_FILE_BANDWIDTH_PRICE_ID",
    "STRIPE_CONVEX_FILE_STORAGE_PRICE_ID",
    "STRIPE_CONVEX_VECTOR_BANDWIDTH_PRICE_ID",
    "STRIPE_CONVEX_VECTOR_STORAGE_PRICE_ID",
  ];

  console.log("Checking metered price configuration:");
  const configuredPrices = priceEnvVars.filter((v) => !!process.env[v]);
  const missingPrices = priceEnvVars.filter((v) => !process.env[v]);

  console.log(`  ✓ Configured: ${configuredPrices.length}`);
  if (missingPrices.length > 0) {
    console.log(`  ⚠ Missing: ${missingPrices.length}`);
    missingPrices.forEach((v) => console.log(`    - ${v}`));
  }

  if (configuredPrices.length === 0) {
    console.error("\nError: No metered prices configured. Run setup-stripe.ts first.");
    process.exit(1);
  }

  console.log("");

  // Count users to migrate
  const eligibleUsers = await prisma.user.count({
    where: {
      membershipTier: { in: ["PRO", "ENTERPRISE"] },
      stripeSubscriptionId: { not: null },
    },
  });

  console.log(`Found ${eligibleUsers} PRO/ENTERPRISE users with subscriptions\n`);

  if (eligibleUsers === 0) {
    console.log("No users to migrate. Exiting.");
    process.exit(0);
  }

  // Confirm before proceeding in live mode
  if (isLive) {
    console.log("⚠️  WARNING: You are about to modify LIVE subscriptions!");
    console.log("    This will add metered prices to all eligible subscriptions.");
    console.log("    Press Ctrl+C within 5 seconds to abort...\n");
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  console.log("Starting migration...\n");

  const result = await migrateAllUsersToConvexMeteredBilling();

  console.log("\n=== Migration Complete ===\n");
  console.log(`Total users:    ${result.total}`);
  console.log(`Successful:     ${result.successful}`);
  console.log(`Skipped:        ${result.skipped} (already have metered prices)`);
  console.log(`Failed:         ${result.failed}`);

  if (result.errors.length > 0) {
    console.log("\nErrors:");
    result.errors.forEach((e) => {
      console.log(`  - ${e.email}: ${e.error}`);
    });
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
