/**
 * Setup Stripe Shipper Cloud Credits Meter
 *
 * Creates the unified meter, product, and price for Shipper Cloud Credits billing.
 * All Convex usage is converted to credits and billed via this single meter.
 *
 * Usage: pnpm tsx scripts/setup-shipper-cloud-credits-meter.ts
 *
 * Credit Pricing:
 * - 1 credit = 1 cent ($0.01)
 * - $1 = 100 credits
 * - $5 = 500 credits
 *
 * The meter event reports whole credits. At invoice time:
 * - Stripe calculates total credits used
 * - Stripe Credit Grants (pre-paid credits) are applied first
 * - Any overage is charged at $0.01 per credit
 */

import Stripe from "stripe";
import "dotenv/config";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
  console.error("Missing STRIPE_SECRET_KEY environment variable");
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2025-02-24.acacia",
});

const SHIPPER_CLOUD_CREDITS_METER_NAME = "shipper_cloud_credits";

async function main() {
  console.log("=== Shipper Cloud Credits Meter Setup ===\n");

  // Check for existing meter
  console.log("Checking for existing meters...");
  const existingMeters = await stripe.billing.meters.list({ limit: 100 });
  let meter = existingMeters.data.find(
    (m) => m.event_name === SHIPPER_CLOUD_CREDITS_METER_NAME
  );

  if (meter) {
    console.log(`✓ Meter already exists: ${meter.id}`);
    console.log(`  Event name: ${meter.event_name}`);
    console.log(`  Display name: ${meter.display_name}`);
  } else {
    console.log("Creating Shipper Cloud Credits meter...");
    meter = await stripe.billing.meters.create({
      display_name: "Shipper Cloud Credits",
      event_name: SHIPPER_CLOUD_CREDITS_METER_NAME,
      default_aggregation: { formula: "sum" },
      customer_mapping: {
        type: "by_id",
        event_payload_key: "stripe_customer_id",
      },
      value_settings: {
        event_payload_key: "value",
      },
    });
    console.log(`✓ Created meter: ${meter.id}`);
  }

  // Check for existing product
  console.log("\nChecking for existing product...");
  const existingProducts = await stripe.products.search({
    query: `metadata['type']:'shipper_cloud_credits'`,
    limit: 1,
  });

  let product = existingProducts.data[0];

  if (product) {
    console.log(`✓ Product already exists: ${product.id}`);
    console.log(`  Name: ${product.name}`);
  } else {
    console.log("Creating Shipper Cloud Credits product...");
    product = await stripe.products.create({
      name: "Shipper Cloud Credits",
      description:
        "Credits for Shipper Cloud usage (database, functions, storage). 1 credit = 1 cent.",
      metadata: {
        type: "shipper_cloud_credits",
        meter_event_name: SHIPPER_CLOUD_CREDITS_METER_NAME,
      },
    });
    console.log(`✓ Created product: ${product.id}`);
  }

  // Check for existing price linked to meter
  console.log("\nChecking for existing price...");
  const existingPrices = await stripe.prices.list({
    product: product.id,
    limit: 10,
  });

  // Find a price linked to our meter
  let price = existingPrices.data.find(
    (p) =>
      p.recurring?.meter === meter.id &&
      p.unit_amount === 1 && // 1 cent per credit
      p.currency === "usd" &&
      p.active
  );

  if (price) {
    console.log(`✓ Price already exists: ${price.id}`);
    console.log(`  Unit amount: ${price.unit_amount} cents`);
    console.log(`  Meter: ${price.recurring?.meter}`);
  } else {
    console.log("Creating Shipper Cloud Credits price...");
    // Price: $0.01 per credit (1 cent)
    price = await stripe.prices.create({
      product: product.id,
      currency: "usd",
      billing_scheme: "per_unit",
      unit_amount: 1, // 1 cent per credit
      recurring: {
        interval: "month",
        usage_type: "metered",
        meter: meter.id,
      },
      metadata: {
        type: "shipper_cloud_credits",
      },
    });
    console.log(`✓ Created price: ${price.id}`);
  }

  // Output environment variables
  console.log("\n\n=== Environment Variables ===");
  console.log("Copy these to your apps/billing/.env file:\n");
  console.log("# Shipper Cloud Credits (Unified Meter)");
  console.log(`STRIPE_SHIPPER_CLOUD_CREDITS_METER_ID=${meter.id}`);
  console.log(`STRIPE_SHIPPER_CLOUD_CREDITS_PRICE_ID=${price.id}`);
  console.log(`STRIPE_SHIPPER_CLOUD_CREDITS_PRODUCT_ID=${product.id}`);

  console.log("\n\n=== Setup Complete ===");
  console.log("\nNext steps:");
  console.log(
    "1. Add the environment variables above to your apps/billing/.env file"
  );
  console.log(
    "2. When users purchase credits, create a Stripe Credit Grant linked to this meter"
  );
  console.log(
    "3. Create a subscription with this price for users who enable Shipper Cloud"
  );
  console.log("\nCredit Grant example (in webapp Stripe handlers):");
  console.log(`  stripe.billing.creditGrants.create({
    customer: stripeCustomerId,
    name: "Shipper Cloud Credits Purchase",
    category: "paid",
    applicability_config: {
      scope: {
        price_type: "metered",
      },
    },
    amount: {
      type: "monetary",
      value: {
        currency: "usd",
        amount: credits, // 1 credit = 1 cent, so 500 credits = 500 cents = $5
      },
    },
    metadata: { ... },
  });`);
}

main().catch((error) => {
  console.error("Setup failed:", error);
  process.exit(1);
});
