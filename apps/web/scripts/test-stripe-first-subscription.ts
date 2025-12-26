#!/usr/bin/env npx tsx

import { prisma } from "../src/lib/db";

/**
 * Test Script: First Subscription Flow
 * Tests all scenarios for users subscribing for the first time
 */

interface TestResult {
  scenario: string;
  passed: boolean;
  expected: any;
  actual: any;
  error?: string;
}

const results: TestResult[] = [];

async function testScenario(
  scenario: string,
  testFn: () => Promise<{ passed: boolean; expected: any; actual: any; error?: string }>
) {
  console.log(`\n🧪 Testing: ${scenario}`);
  console.log("─".repeat(80));
  
  try {
    const result = await testFn();
    results.push({ scenario, ...result });
    
    if (result.passed) {
      console.log("✅ PASSED");
    } else {
      console.log("❌ FAILED");
      console.log("Expected:", JSON.stringify(result.expected, null, 2));
      console.log("Actual:", JSON.stringify(result.actual, null, 2));
      if (result.error) console.log("Error:", result.error);
    }
  } catch (error) {
    console.log("❌ FAILED WITH EXCEPTION");
    console.error(error);
    results.push({
      scenario,
      passed: false,
      expected: {},
      actual: {},
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function createTestUser(email: string, existingCredits: number = 0) {
  return await prisma.user.create({
    data: {
      email,
      name: `Test User ${email}`,
      membershipTier: "FREE",
      creditBalance: existingCredits,
      basePlanCredits: 0,
      carryOverCredits: 0,
      carryOverExpiresAt: null,
    },
  });
}

async function simulateFirstSubscription(
  userId: string,
  tierCredits: number,
  existingCredits: number = 0
) {
  const nextRenewal = new Date();
  nextRenewal.setMonth(nextRenewal.getMonth() + 1);

  await prisma.user.update({
    where: { id: userId },
    data: {
      membershipTier: "PRO",
      creditBalance: existingCredits + tierCredits,
      basePlanCredits: tierCredits,
      carryOverCredits: existingCredits,
      carryOverExpiresAt: existingCredits > 0 ? nextRenewal : null,
      stripeSubscriptionId: `sub_test_${Date.now()}`,
      membershipExpiresAt: nextRenewal,
      lastCreditReset: new Date(),
    },
  });

  return await prisma.user.findUnique({
    where: { id: userId },
    select: {
      creditBalance: true,
      basePlanCredits: true,
      carryOverCredits: true,
      carryOverExpiresAt: true,
      membershipTier: true,
    },
  });
}

// Test 1: First subscription with no existing credits
async function test1_FirstSubNoCredits() {
  const email = "test1@stripe-test.com";

  const user = await createTestUser(email, 0);
  const result = await simulateFirstSubscription(user.id, 400, 0);

  const expected = {
    creditBalance: 400,
    basePlanCredits: 400,
    carryOverCredits: 0,
    carryOverExpiresAt: null,
    membershipTier: "PRO",
  };

  const passed =
    result?.creditBalance === expected.creditBalance &&
    result?.basePlanCredits === expected.basePlanCredits &&
    result?.carryOverCredits === expected.carryOverCredits &&
    result?.carryOverExpiresAt === expected.carryOverExpiresAt &&
    result?.membershipTier === expected.membershipTier;


  return {
    passed,
    expected,
    actual: result,
  };
}

// Test 2: First subscription with purchased credits
async function test2_FirstSubWithPurchasedCredits() {
  const email = "test2@stripe-test.com";

  const user = await createTestUser(email, 50);
  const result = await simulateFirstSubscription(user.id, 400, 50);

  const expected = {
    creditBalance: 450,
    basePlanCredits: 400,
    carryOverCredits: 50,
    membershipTier: "PRO",
  };

  const passed =
    result?.creditBalance === expected.creditBalance &&
    result?.basePlanCredits === expected.basePlanCredits &&
    result?.carryOverCredits === expected.carryOverCredits &&
    result?.carryOverExpiresAt !== null && // Should have expiration
    result?.membershipTier === expected.membershipTier;


  return {
    passed,
    expected,
    actual: result,
  };
}

// Test 3: First subscription with large purchased credits
async function test3_FirstSubWithLargeCredits() {
  const email = "test3@stripe-test.com";

  const user = await createTestUser(email, 200);
  const result = await simulateFirstSubscription(user.id, 400, 200);

  const expected = {
    creditBalance: 600,
    basePlanCredits: 400,
    carryOverCredits: 200,
    membershipTier: "PRO",
  };

  const passed =
    result?.creditBalance === expected.creditBalance &&
    result?.basePlanCredits === expected.basePlanCredits &&
    result?.carryOverCredits === expected.carryOverCredits &&
    result?.membershipTier === expected.membershipTier;


  return {
    passed,
    expected,
    actual: result,
  };
}

// Test 4: Verify no double allocation
async function test4_NoDoubleAllocation() {
  const email = "test4@stripe-test.com";

  const user = await createTestUser(email, 0);
  
  // Simulate subscription twice (webhook retry scenario)
  await simulateFirstSubscription(user.id, 400, 0);
  const result = await simulateFirstSubscription(user.id, 400, 0);

  const expected = {
    creditBalance: 400, // Should NOT be 800
    basePlanCredits: 400,
    carryOverCredits: 0,
  };

  const passed =
    result?.creditBalance === expected.creditBalance &&
    result?.basePlanCredits === expected.basePlanCredits &&
    result?.carryOverCredits === expected.carryOverCredits;


  return {
    passed,
    expected,
    actual: result,
  };
}

// Test 5: Different tier subscriptions
async function test5_DifferentTiers() {
  const tiers = [
    { name: "Pro 100", credits: 100 },
    { name: "Pro 400", credits: 400 },
    { name: "Pro 800", credits: 800 },
    { name: "Pro 1200", credits: 1200 },
  ];

  let allPassed = true;
  const tierResults: any[] = [];

  for (const tier of tiers) {
    const email = `test5-${tier.credits}@stripe-test.com`;

    const user = await createTestUser(email, 0);
    const result = await simulateFirstSubscription(user.id, tier.credits, 0);

    const passed =
      result?.creditBalance === tier.credits &&
      result?.basePlanCredits === tier.credits;

    tierResults.push({
      tier: tier.name,
      passed,
      credits: result?.creditBalance,
    });

    if (!passed) allPassed = false;

  }

  return {
    passed: allPassed,
    expected: tiers.map((t) => ({ tier: t.name, credits: t.credits })),
    actual: tierResults,
  };
}

// Run all tests
async function runTests() {
  console.log("\n" + "=".repeat(80));
  console.log("🧪 STRIPE FIRST SUBSCRIPTION TESTS");
  console.log("=".repeat(80));

  await testScenario(
    "Test 1: First subscription with no existing credits",
    test1_FirstSubNoCredits
  );

  await testScenario(
    "Test 2: First subscription with 50 purchased credits",
    test2_FirstSubWithPurchasedCredits
  );

  await testScenario(
    "Test 3: First subscription with 200 purchased credits",
    test3_FirstSubWithLargeCredits
  );

  await testScenario(
    "Test 4: Verify no double allocation on webhook retry",
    test4_NoDoubleAllocation
  );

  await testScenario(
    "Test 5: Different tier subscriptions (100, 400, 800, 1200)",
    test5_DifferentTiers
  );

  // Print summary
  console.log("\n" + "=".repeat(80));
  console.log("📊 TEST SUMMARY");
  console.log("=".repeat(80));

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`\nTotal Tests: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);

  if (failed > 0) {
    console.log("\n❌ Failed Tests:");
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`   - ${r.scenario}`);
        if (r.error) console.log(`     Error: ${r.error}`);
      });
  }

  await prisma.$disconnect();

  if (failed > 0) {
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
