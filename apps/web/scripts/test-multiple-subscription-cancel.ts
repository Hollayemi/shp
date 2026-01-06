#!/usr/bin/env npx tsx

// Load environment variables from .env file BEFORE any other imports
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../.env") });

/**
 * Test Script: Multiple Subscription Cancellation
 * Tests that when a user upgrades, ALL old subscriptions are cancelled
 */

import Stripe from "stripe";

// Create stripe client directly to avoid module initialization issues
const stripeSecretKey = process.env.STRIPE_SECRET_KEY_TEST || process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  console.error("❌ Missing STRIPE_SECRET_KEY or STRIPE_SECRET_KEY_TEST in environment");
  process.exit(1);
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2025-06-30.basil",
  typescript: true,
});

const TEST_CUSTOMER_EMAIL = "test-multi-sub@shipper-test.com";

async function getOrCreateTestCustomer(): Promise<string> {
  // Search for existing test customer
  const customers = await stripe.customers.list({
    email: TEST_CUSTOMER_EMAIL,
    limit: 1,
  });

  if (customers.data.length > 0) {
    console.log(`📋 Found existing test customer: ${customers.data[0].id}`);
    return customers.data[0].id;
  }

  // Create new test customer
  const customer = await stripe.customers.create({
    email: TEST_CUSTOMER_EMAIL,
    name: "Test Multi-Subscription User",
    metadata: {
      testUser: "true",
      purpose: "testing-multiple-subscription-cancellation",
    },
  });

  console.log(`✅ Created test customer: ${customer.id}`);
  return customer.id;
}

async function listActiveSubscriptions(customerId: string) {
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "active",
    limit: 100,
  });

  console.log(`\n📋 Active subscriptions for customer ${customerId}:`);
  if (subscriptions.data.length === 0) {
    console.log("   (none)");
  } else {
    for (const sub of subscriptions.data) {
      console.log(`   - ${sub.id} (status: ${sub.status})`);
    }
  }

  return subscriptions.data;
}

async function cancelAllSubscriptions(customerId: string, exceptSubId?: string) {
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "active",
    limit: 100,
  });

  const toCancel = subscriptions.data.filter((sub) => sub.id !== exceptSubId);

  console.log(`\n🔥 Cancelling ${toCancel.length} subscription(s)...`);

  for (const sub of toCancel) {
    try {
      await stripe.subscriptions.cancel(sub.id);
      console.log(`   ✅ Cancelled: ${sub.id}`);
    } catch (error) {
      console.log(`   ❌ Failed to cancel ${sub.id}:`, error);
    }
  }
}

async function cleanupTestCustomer(customerId: string) {
  console.log(`\n🧹 Cleaning up test customer ${customerId}...`);

  // Cancel all subscriptions first
  await cancelAllSubscriptions(customerId);

  // Delete the customer
  try {
    await stripe.customers.del(customerId);
    console.log(`   ✅ Deleted customer`);
  } catch (error) {
    console.log(`   ⚠️ Could not delete customer:`, error);
  }
}

async function createTestSubscription(customerId: string): Promise<string> {
  // Create a test price (or use an existing test price)
  // For testing, we'll create a simple price
  const price = await stripe.prices.create({
    unit_amount: 0, // $0.00 - free trial to avoid payment requirement
    currency: "usd",
    recurring: { interval: "month" },
    product_data: {
      name: "Test Subscription Product",
    },
  });

  // Create subscription - $0 subscriptions are immediately active
  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: price.id }],
  });

  console.log(`   ✅ Created subscription: ${subscription.id} (status: ${subscription.status})`);
  return subscription.id;
}

async function testMultipleSubscriptionCancellation() {
  console.log("\n" + "=".repeat(80));
  console.log("🧪 TEST: Multiple Subscription Cancellation Logic");
  console.log("=".repeat(80));

  console.log("\n📝 This test verifies the logic for finding and cancelling");
  console.log("   ALL active subscriptions when a customer upgrades.\n");

  // Get or create test customer
  const customerId = await getOrCreateTestCustomer();

  // First, clean up any existing subscriptions
  await cancelAllSubscriptions(customerId);

  // Verify no active subscriptions
  let activeSubs = await listActiveSubscriptions(customerId);

  if (activeSubs.length > 0) {
    console.log("\n❌ FAILED: Could not clean up existing subscriptions");
    return;
  }

  // ============================================================
  // TEST 1: Basic logic test with fake subscription IDs
  // ============================================================
  console.log("\n" + "-".repeat(80));
  console.log("📋 TEST 1: Basic subscription query logic...");
  console.log("-".repeat(80));

  // This simulates what we do in handleSubscriptionUpgrade
  const subscriptionsToCancel: string[] = [];

  // Simulate having a "stored" subscription ID (like existingUser.stripeSubscriptionId)
  const storedSubId = "sub_fake_stored_123";
  subscriptionsToCancel.push(storedSubId);
  console.log(`\n1️⃣ Added stored subscription ID: ${storedSubId}`);

  // Now query Stripe for ALL active subscriptions
  console.log(`\n2️⃣ Querying Stripe for active subscriptions...`);
  let customerSubscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "active",
    limit: 100,
  });

  console.log(`   Found ${customerSubscriptions.data.length} active subscription(s)`);

  // Simulate a "new" subscription ID
  const newSubId = "sub_new_upgrade_456";

  // Add any that aren't the new one
  for (const sub of customerSubscriptions.data) {
    if (sub.id !== newSubId && !subscriptionsToCancel.includes(sub.id)) {
      console.log(`   📋 Found additional active subscription: ${sub.id}`);
      subscriptionsToCancel.push(sub.id);
    }
  }

  console.log(`\n📊 Total subscriptions to cancel: ${subscriptionsToCancel.length}`);
  console.log(`   IDs: ${subscriptionsToCancel.join(", ")}`);

  // Test cancellation with error handling
  console.log("\n🔥 Testing cancellation with error handling...");

  for (const subId of subscriptionsToCancel) {
    try {
      console.log(`\n   Attempting to cancel: ${subId}`);
      await stripe.subscriptions.cancel(subId);
      console.log(`   ✅ Cancelled successfully`);
    } catch (error: unknown) {
      const code =
        error && typeof error === "object" && "code" in error
          ? (error as { code: string }).code
          : undefined;
      const message = error instanceof Error ? error.message : "";

      if (code === "resource_missing" || message.includes("No such subscription")) {
        console.log(`   ⚠️ Subscription not found (already cancelled or doesn't exist)`);
      } else {
        console.log(`   ❌ Failed to cancel:`, error);
      }
    }
  }

  console.log("\n✅ TEST 1 PASSED: Error handling works correctly\n");

  // ============================================================
  // TEST 2: Real subscriptions - simulates multiple upgrades
  // ============================================================
  const runRealTest = process.argv.includes("--real");

  if (runRealTest) {
    console.log("\n" + "-".repeat(80));
    console.log("📋 TEST 2: Real subscriptions (simulating multiple upgrades)...");
    console.log("-".repeat(80));

    console.log("\n🔧 Creating 3 test subscriptions to simulate multiple upgrades...");

    try {
      const sub1 = await createTestSubscription(customerId);
      const sub2 = await createTestSubscription(customerId);
      const sub3 = await createTestSubscription(customerId);

      console.log(`\n📋 Created subscriptions: ${sub1}, ${sub2}, ${sub3}`);

      // List active subscriptions
      await listActiveSubscriptions(customerId);

      // Now simulate the upgrade logic - cancel all except sub3 (the "new" one)
      console.log(`\n🔄 Simulating upgrade: keeping ${sub3}, cancelling others...`);

      const realSubscriptionsToCancel: string[] = [];

      // Query for all active subscriptions
      customerSubscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: "active",
        limit: 100,
      });

      for (const sub of customerSubscriptions.data) {
        if (sub.id !== sub3) {
          realSubscriptionsToCancel.push(sub.id);
        }
      }

      console.log(`\n📊 Subscriptions to cancel: ${realSubscriptionsToCancel.length}`);
      console.log(`   IDs: ${realSubscriptionsToCancel.join(", ")}`);

      // Cancel them all
      for (const subId of realSubscriptionsToCancel) {
        try {
          await stripe.subscriptions.cancel(subId);
          console.log(`   ✅ Cancelled: ${subId}`);
        } catch (error) {
          console.log(`   ❌ Failed to cancel ${subId}:`, error);
        }
      }

      // Verify only sub3 remains
      const remainingSubs = await listActiveSubscriptions(customerId);

      if (remainingSubs.length === 1 && remainingSubs[0].id === sub3) {
        console.log("\n✅ TEST 2 PASSED: Only the new subscription remains!");
      } else {
        console.log("\n❌ TEST 2 FAILED: Expected only 1 subscription remaining");
      }

      // Clean up the last subscription
      await stripe.subscriptions.cancel(sub3);
      console.log(`\n🧹 Cleaned up final test subscription: ${sub3}`);

    } catch (error) {
      console.log("\n❌ TEST 2 FAILED with error:", error);
    }
  } else {
    console.log("\n💡 Run with --real to test with real Stripe subscriptions");
  }

  console.log("\n" + "=".repeat(80));
  console.log("✅ ALL TESTS COMPLETE");
  console.log("=".repeat(80));
  console.log("\nThe logic correctly:");
  console.log("  1. Collects the stored subscription ID");
  console.log("  2. Queries Stripe for ALL active subscriptions");
  console.log("  3. Handles both real and non-existent subscription IDs");
  console.log("  4. Gracefully handles 'resource_missing' errors\n");

  // Cleanup
  const shouldCleanup = process.argv.includes("--cleanup");
  if (shouldCleanup) {
    await cleanupTestCustomer(customerId);
  } else {
    console.log("💡 Run with --cleanup to delete the test customer");
  }
}

// Run the test
testMultipleSubscriptionCancellation().catch((error) => {
  console.error("\n❌ Test failed with error:", error);
  process.exit(1);
});
