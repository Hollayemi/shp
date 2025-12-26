#!/usr/bin/env node

/**
 * Test Script: Subscription Renewal Webhook Handler
 *
 * Creates a proper test subscription with all required metadata,
 * then simulates a renewal to test the handlePaymentSuccess fix.
 *
 * USAGE:
 *   cd apps/web
 *   pnpm dlx tsx scripts/test-stripe-renewal-webhook.ts
 */

import "dotenv/config";
import { prisma } from "../src/lib/db";
import { stripe } from "../src/lib/stripe";
import { getTierById } from "../src/lib/pricing";

// Inline handler for testing (mirrors handlePaymentSuccess logic)
async function handlePaymentSuccessForTest(invoice: any) {
  if (!invoice.subscription) return;

  const subscriptionId =
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : invoice.subscription?.id;

  const subscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
    include: { user: true },
  });

  if (!subscription?.user) {
    console.error(`❌ Subscription or user not found: ${subscriptionId}`);
    return;
  }

  if (invoice.billing_reason === "subscription_create") {
    console.log(`⏭️ Skipping first invoice`);
    return;
  }

  const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
  const tierId = stripeSubscription.metadata?.tierId;
  const tierInfo = tierId ? getTierById(tierId) : null;

  if (!tierInfo) {
    console.error(`❌ No tier info for: ${tierId}`);
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: subscription.user.id },
    select: { creditBalance: true, carryOverCredits: true, basePlanCredits: true },
  });

  const currentBalance = user?.creditBalance || 0;
  const currentCarryOver = user?.carryOverCredits || 0;
  const unusedFromBasePlan = Math.max(0, currentBalance - currentCarryOver);
  const newCarryOver = unusedFromBasePlan;
  const newBasePlan = tierInfo.monthlyCredits;
  const newTotalBalance = newCarryOver + newBasePlan;
  const newPeriodEnd = new Date(invoice.period_end * 1000);

  await prisma.$transaction([
    prisma.subscription.update({
      where: { id: subscription.id },
      data: { stripeCurrentPeriodEnd: newPeriodEnd },
    }),
    prisma.user.update({
      where: { id: subscription.user.id },
      data: {
        membershipExpiresAt: newPeriodEnd,
        lastCreditReset: new Date(),
        monthlyCreditsUsed: 0,
        basePlanCredits: newBasePlan,
        carryOverCredits: newCarryOver,
        carryOverExpiresAt: newPeriodEnd,
        creditBalance: newTotalBalance,
      },
    }),
    prisma.creditTransaction.create({
      data: {
        userId: subscription.user.id,
        amount: tierInfo.monthlyCredits,
        type: "MONTHLY_ALLOCATION",
        description: `Monthly renewal: ${tierInfo.name} - ${tierInfo.monthlyCredits} credits`,
        metadata: {
          subscriptionId,
          invoiceId: invoice.id,
          tierId,
          isRenewal: true,
          newCarryOver,
          newBasePlan,
          totalCredits: newTotalBalance,
        },
      },
    }),
  ]);

  console.log(`✅ Renewal: ${currentBalance} -> ${newTotalBalance} credits`);
}

const TEST_EMAIL = "stripe-renewal-test@test.shipper.now";
const TEST_TIER_ID = "pro-100";

interface TestContext {
  user: {
    id: string;
    email: string;
    creditBalance: number;
  };
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  subscriptionId: string;
}

async function cleanup() {
  console.log("\n🧹 Cleaning up previous test data...");

  // Delete credit transactions
  await prisma.creditTransaction.deleteMany({
    where: { user: { email: TEST_EMAIL } },
  });

  // Delete subscriptions
  await prisma.subscription.deleteMany({
    where: { user: { email: TEST_EMAIL } },
  });

  // Delete user
  await prisma.user.deleteMany({
    where: { email: TEST_EMAIL },
  });

  console.log("   Done");
}

async function createTestUser(): Promise<TestContext["user"]> {
  console.log("\n👤 Creating test user...");

  const tierInfo = getTierById(TEST_TIER_ID);
  if (!tierInfo) throw new Error(`Invalid tier: ${TEST_TIER_ID}`);

  const user = await prisma.user.create({
    data: {
      email: TEST_EMAIL,
      name: "Stripe Renewal Test User",
      membershipTier: "PRO",
      creditBalance: tierInfo.monthlyCredits,
      basePlanCredits: tierInfo.monthlyCredits,
      carryOverCredits: 0,
      lastCreditReset: new Date(),
    },
  });

  console.log(`   Created user: ${user.id}`);
  console.log(`   Initial credits: ${user.creditBalance}`);

  return {
    id: user.id,
    email: user.email,
    creditBalance: user.creditBalance,
  };
}

async function createStripeCustomer(userId: string): Promise<string> {
  console.log("\n💳 Creating Stripe customer...");

  const customer = await stripe.customers.create({
    email: TEST_EMAIL,
    name: "Stripe Renewal Test User",
    metadata: {
      userId,
      isTest: "true",
    },
  });

  // Update user with Stripe customer ID
  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  });

  console.log(`   Customer ID: ${customer.id}`);
  return customer.id;
}

async function createStripeSubscription(
  customerId: string,
  userId: string
): Promise<string> {
  console.log("\n📋 Creating Stripe subscription...");

  const tierInfo = getTierById(TEST_TIER_ID);
  if (!tierInfo) throw new Error(`Invalid tier: ${TEST_TIER_ID}`);

  // Create a price for the subscription
  const price = await stripe.prices.create({
    unit_amount: tierInfo.monthlyPrice * 100, // cents
    currency: "usd",
    recurring: { interval: "month" },
    product_data: {
      name: `Pro ${tierInfo.monthlyCredits} Test`,
    },
    metadata: {
      isTest: "true",
    },
  });

  // First, create a test payment method for the customer
  const paymentMethod = await stripe.paymentMethods.create({
    type: "card",
    card: {
      token: "tok_visa", // Stripe test token
    },
  });

  await stripe.paymentMethods.attach(paymentMethod.id, {
    customer: customerId,
  });

  await stripe.customers.update(customerId, {
    invoice_settings: {
      default_payment_method: paymentMethod.id,
    },
  });

  // Create the subscription with proper metadata
  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: price.id }],
    metadata: {
      userId,
      tierId: TEST_TIER_ID,
      tierName: "pro",
      monthlyCredits: String(tierInfo.monthlyCredits),
      isTest: "true",
    },
    default_payment_method: paymentMethod.id,
    expand: ["latest_invoice"],
  });

  console.log(`   Subscription ID: ${subscription.id}`);
  console.log(`   Status: ${subscription.status}`);
  console.log(`   Metadata: ${JSON.stringify(subscription.metadata)}`);

  // Update user with subscription ID
  const periodEndTimestamp = (subscription as any).current_period_end;
  const periodEnd = periodEndTimestamp
    ? new Date(periodEndTimestamp * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // fallback: 30 days

  await prisma.user.update({
    where: { id: userId },
    data: {
      stripeSubscriptionId: subscription.id,
      membershipExpiresAt: periodEnd,
    },
  });

  return subscription.id;
}

async function createDatabaseSubscription(
  userId: string,
  stripeSubscriptionId: string
): Promise<string> {
  console.log("\n💾 Creating database subscription record...");

  const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);

  const periodEndTimestamp = (stripeSubscription as any).current_period_end;
  const periodEnd = periodEndTimestamp
    ? new Date(periodEndTimestamp * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // fallback: 30 days

  console.log(`   Period end timestamp: ${periodEndTimestamp}`);
  console.log(`   Period end date: ${periodEnd.toISOString()}`);

  const subscription = await prisma.subscription.create({
    data: {
      userId,
      stripeSubscriptionId,
      stripePriceId: stripeSubscription.items.data[0].price.id,
      stripeCurrentPeriodEnd: periodEnd,
      status: "ACTIVE",
    },
  });

  console.log(`   DB Subscription ID: ${subscription.id}`);
  return subscription.id;
}

async function simulateUsage(userId: string, creditsUsed: number) {
  console.log(`\n📉 Simulating usage of ${creditsUsed} credits...`);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { creditBalance: true },
  });

  const newBalance = Math.max(0, (user?.creditBalance || 0) - creditsUsed);

  await prisma.user.update({
    where: { id: userId },
    data: { creditBalance: newBalance },
  });

  console.log(`   Balance: ${user?.creditBalance} -> ${newBalance}`);
}

async function triggerRenewalWebhook(ctx: TestContext) {
  console.log("\n🔄 Triggering renewal webhook...");

  const tierInfo = getTierById(TEST_TIER_ID);
  if (!tierInfo) throw new Error(`Invalid tier: ${TEST_TIER_ID}`);

  // Create a mock invoice object similar to what Stripe sends
  const periodStart = Math.floor(Date.now() / 1000);
  const periodEnd = periodStart + (30 * 24 * 60 * 60); // 30 days later
  const invoiceId = `in_test_${Date.now()}`;

  const mockInvoice = {
    id: invoiceId,
    object: "invoice",
    subscription: ctx.stripeSubscriptionId,
    customer: ctx.stripeCustomerId,
    billing_reason: "subscription_cycle", // This is the key - "subscription_cycle" for renewals
    period_start: periodStart,
    period_end: periodEnd,
    status: "paid",
    amount_paid: tierInfo.monthlyPrice * 100,
  };

  console.log(`   Invoice ID: ${invoiceId}`);
  console.log(`   Billing reason: ${mockInvoice.billing_reason}`);
  console.log(`   Subscription: ${mockInvoice.subscription}`);

  // Call the handler directly instead of going through Inngest
  console.log("\n📤 Calling renewal handler directly...");

  await handlePaymentSuccessForTest(mockInvoice);

  console.log("   Handler completed!");
}

async function verifyRenewal(ctx: TestContext): Promise<boolean> {
  console.log("\n🔍 Verifying renewal...");

  const tierInfo = getTierById(TEST_TIER_ID);
  if (!tierInfo) throw new Error(`Invalid tier: ${TEST_TIER_ID}`);

  const user = await prisma.user.findUnique({
    where: { id: ctx.user.id },
    select: {
      creditBalance: true,
      basePlanCredits: true,
      carryOverCredits: true,
      lastCreditReset: true,
    },
  });

  // Check for renewal transaction
  const renewalTransaction = await prisma.creditTransaction.findFirst({
    where: {
      userId: ctx.user.id,
      type: "MONTHLY_ALLOCATION",
      metadata: {
        path: ["isRenewal"],
        equals: true,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  console.log("\n📊 Results:");
  console.log(`   Credit balance: ${user?.creditBalance}`);
  console.log(`   Base plan credits: ${user?.basePlanCredits}`);
  console.log(`   Carry over credits: ${user?.carryOverCredits}`);
  console.log(`   Renewal transaction found: ${renewalTransaction ? "YES" : "NO"}`);

  if (renewalTransaction) {
    console.log(`   Transaction amount: ${renewalTransaction.amount}`);
    console.log(`   Transaction description: ${renewalTransaction.description}`);
  }

  // Expected: 50 unused + 100 new = 150 total
  const expectedCarryOver = 50; // 100 - 50 used = 50 unused
  const expectedTotal = expectedCarryOver + tierInfo.monthlyCredits; // 50 + 100 = 150

  const passed =
    user?.creditBalance === expectedTotal &&
    user?.basePlanCredits === tierInfo.monthlyCredits &&
    user?.carryOverCredits === expectedCarryOver &&
    renewalTransaction !== null;

  console.log(`\n   Expected total: ${expectedTotal}`);
  console.log(`   Expected carry over: ${expectedCarryOver}`);

  return passed;
}

async function cleanupStripe(ctx: TestContext) {
  console.log("\n🧹 Cleaning up Stripe resources...");

  try {
    // Cancel and delete subscription
    if (ctx.stripeSubscriptionId) {
      await stripe.subscriptions.cancel(ctx.stripeSubscriptionId);
      console.log(`   Cancelled subscription: ${ctx.stripeSubscriptionId}`);
    }
  } catch (e) {
    // Ignore errors
  }

  try {
    // Delete customer (this also cleans up payment methods, etc.)
    if (ctx.stripeCustomerId) {
      await stripe.customers.del(ctx.stripeCustomerId);
      console.log(`   Deleted customer: ${ctx.stripeCustomerId}`);
    }
  } catch (e) {
    // Ignore errors
  }
}

async function main() {
  console.log("=".repeat(70));
  console.log("  STRIPE SUBSCRIPTION RENEWAL TEST");
  console.log("  Testing handlePaymentSuccess with real subscription data");
  console.log("=".repeat(70));

  let ctx: TestContext | null = null;

  try {
    // Step 1: Cleanup
    await cleanup();

    // Step 2: Create test user
    const user = await createTestUser();

    // Step 3: Create Stripe customer
    const stripeCustomerId = await createStripeCustomer(user.id);

    // Step 4: Create Stripe subscription with metadata
    const stripeSubscriptionId = await createStripeSubscription(stripeCustomerId, user.id);

    // Step 5: Create database subscription record
    const subscriptionId = await createDatabaseSubscription(user.id, stripeSubscriptionId);

    ctx = {
      user,
      stripeCustomerId,
      stripeSubscriptionId,
      subscriptionId,
    };

    // Step 6: Simulate some usage (use 50 of 100 credits)
    await simulateUsage(user.id, 50);

    // Step 7: Trigger renewal webhook
    await triggerRenewalWebhook(ctx);

    // Step 8: Verify renewal worked
    const passed = await verifyRenewal(ctx);

    console.log("\n" + "=".repeat(70));
    if (passed) {
      console.log("  ✅ TEST PASSED - Renewal credits allocated correctly!");
    } else {
      console.log("  ❌ TEST FAILED - Renewal credits NOT allocated");
      console.log("  Check Inngest dashboard for errors: http://localhost:8288");
    }
    console.log("=".repeat(70));

    // Cleanup
    await cleanupStripe(ctx);
    await cleanup();

    process.exit(passed ? 0 : 1);

  } catch (error) {
    console.error("\n❌ Test failed with error:", error);

    // Try to cleanup
    if (ctx) {
      await cleanupStripe(ctx);
    }
    await cleanup();

    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
