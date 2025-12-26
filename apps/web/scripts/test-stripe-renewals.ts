#!/usr/bin/env npx tsx

import { prisma } from "../src/lib/db";

/**
 * Test Script: Subscription Renewal & Credit Rollover
 * Tests monthly renewal scenarios and credit rollover logic
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

async function createSubscribedUser(email: string, basePlan: number, carryOver: number = 0) {
  const nextRenewal = new Date();
  nextRenewal.setMonth(nextRenewal.getMonth() + 1);

  return await prisma.user.create({
    data: {
      email,
      name: `Test User ${email}`,
      membershipTier: "PRO",
      creditBalance: basePlan + carryOver,
      basePlanCredits: basePlan,
      carryOverCredits: carryOver,
      carryOverExpiresAt: carryOver > 0 ? nextRenewal : null,
      stripeSubscriptionId: `sub_test_${Date.now()}`,
      membershipExpiresAt: nextRenewal,
      lastCreditReset: new Date(),
    },
  });
}

async function simulateUsage(userId: string, creditsUsed: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { creditBalance: true },
  });

  await prisma.user.update({
    where: { id: userId },
    data: {
      creditBalance: Math.max(0, (user?.creditBalance || 0) - creditsUsed),
    },
  });
}

async function simulateRenewal(userId: string, newBasePlan: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      creditBalance: true,
      carryOverCredits: true,
      basePlanCredits: true,
    },
  });

  const currentBalance = user?.creditBalance || 0;
  const currentCarryOver = user?.carryOverCredits || 0;

  // Calculate unused from base plan
  const unusedFromBasePlan = Math.max(0, currentBalance - currentCarryOver);

  // Unused becomes new carry-over
  const newCarryOver = unusedFromBasePlan;
  const newTotalBalance = newCarryOver + newBasePlan;

  const nextRenewal = new Date();
  nextRenewal.setMonth(nextRenewal.getMonth() + 1);

  await prisma.user.update({
    where: { id: userId },
    data: {
      basePlanCredits: newBasePlan,
      carryOverCredits: newCarryOver,
      carryOverExpiresAt: newCarryOver > 0 ? nextRenewal : null,
      creditBalance: newTotalBalance,
      membershipExpiresAt: nextRenewal,
      lastCreditReset: new Date(),
      monthlyCreditsUsed: 0,
    },
  });

  return await prisma.user.findUnique({
    where: { id: userId },
    select: {
      creditBalance: true,
      basePlanCredits: true,
      carryOverCredits: true,
      carryOverExpiresAt: true,
    },
  });
}

async function cleanupTestUser(email: string) {
  await prisma.user.deleteMany({
    where: { email },
  });
}

// Test 1: Normal renewal with partial usage
async function test1_RenewalPartialUsage() {
  const email = "renewal1@stripe-test.com";
  await cleanupTestUser(email);

  // Start with Pro 400, no carry-over
  const user = await createSubscribedUser(email, 400, 0);
  
  // Use 200 credits
  await simulateUsage(user.id, 200);
  
  // Renew
  const result = await simulateRenewal(user.id, 400);

  const expected = {
    creditBalance: 600, // 200 rolled + 400 new
    basePlanCredits: 400,
    carryOverCredits: 200, // Unused from previous cycle
  };

  const passed =
    result?.creditBalance === expected.creditBalance &&
    result?.basePlanCredits === expected.basePlanCredits &&
    result?.carryOverCredits === expected.carryOverCredits &&
    result?.carryOverExpiresAt !== null;

  await cleanupTestUser(email);

  return { passed, expected, actual: result };
}

// Test 2: Renewal with full usage (no rollover)
async function test2_RenewalFullUsage() {
  const email = "renewal2@stripe-test.com";
  await cleanupTestUser(email);

  const user = await createSubscribedUser(email, 400, 0);
  
  // Use all 400 credits
  await simulateUsage(user.id, 400);
  
  // Renew
  const result = await simulateRenewal(user.id, 400);

  const expected = {
    creditBalance: 400, // 0 rolled + 400 new
    basePlanCredits: 400,
    carryOverCredits: 0,
    carryOverExpiresAt: null,
  };

  const passed =
    result?.creditBalance === expected.creditBalance &&
    result?.basePlanCredits === expected.basePlanCredits &&
    result?.carryOverCredits === expected.carryOverCredits &&
    result?.carryOverExpiresAt === expected.carryOverExpiresAt;

  await cleanupTestUser(email);

  return { passed, expected, actual: result };
}

// Test 3: Renewal with no usage (full rollover)
async function test3_RenewalNoUsage() {
  const email = "renewal3@stripe-test.com";
  await cleanupTestUser(email);

  const user = await createSubscribedUser(email, 400, 0);
  
  // Use 0 credits
  await simulateUsage(user.id, 0);
  
  // Renew
  const result = await simulateRenewal(user.id, 400);

  const expected = {
    creditBalance: 800, // 400 rolled + 400 new
    basePlanCredits: 400,
    carryOverCredits: 400, // Full base plan rolled
  };

  const passed =
    result?.creditBalance === expected.creditBalance &&
    result?.basePlanCredits === expected.basePlanCredits &&
    result?.carryOverCredits === expected.carryOverCredits &&
    result?.carryOverExpiresAt !== null;

  await cleanupTestUser(email);

  return { passed, expected, actual: result };
}

// Test 4: Multiple renewals with rollover
async function test4_MultipleRenewals() {
  const email = "renewal4@stripe-test.com";
  await cleanupTestUser(email);

  const user = await createSubscribedUser(email, 400, 0);
  
  // Month 1: Use 200, 200 remain
  await simulateUsage(user.id, 200);
  const renewal1 = await simulateRenewal(user.id, 400);
  
  // Should have 600 (200 rolled + 400 new)
  if (renewal1?.creditBalance !== 600) {
    await cleanupTestUser(email);
    return {
      passed: false,
      expected: { month1: 600 },
      actual: { month1: renewal1?.creditBalance },
      error: "Month 1 renewal failed",
    };
  }

  // Month 2: Use 300, 300 remain (100 from carryover + 200 from base)
  await simulateUsage(user.id, 300);
  const renewal2 = await simulateRenewal(user.id, 400);
  
  // Old carryover (200) expires, unused from base (100) rolls
  // Should have 500 (100 rolled + 400 new)
  const expected = {
    creditBalance: 500,
    basePlanCredits: 400,
    carryOverCredits: 100,
  };

  const passed =
    renewal2?.creditBalance === expected.creditBalance &&
    renewal2?.basePlanCredits === expected.basePlanCredits &&
    renewal2?.carryOverCredits === expected.carryOverCredits;

  await cleanupTestUser(email);

  return { passed, expected, actual: renewal2 };
}

// Test 5: Renewal with existing carry-over expires
async function test5_CarryOverExpires() {
  const email = "renewal5@stripe-test.com";
  await cleanupTestUser(email);

  // Start with 400 base + 50 carry-over
  const user = await createSubscribedUser(email, 400, 50);
  
  // Use 250 credits (leaves 200 total: 150 from base + 50 from carryover)
  await simulateUsage(user.id, 250);
  
  // Renew
  const result = await simulateRenewal(user.id, 400);

  // Old carryover (50) expires, unused from base (150) rolls
  const expected = {
    creditBalance: 550, // 150 rolled + 400 new
    basePlanCredits: 400,
    carryOverCredits: 150, // Only unused from base plan
  };

  const passed =
    result?.creditBalance === expected.creditBalance &&
    result?.basePlanCredits === expected.basePlanCredits &&
    result?.carryOverCredits === expected.carryOverCredits;

  await cleanupTestUser(email);

  return { passed, expected, actual: result };
}

// Test 6: Renewal after using only carry-over credits
async function test6_UseOnlyCarryOver() {
  const email = "renewal6@stripe-test.com";
  await cleanupTestUser(email);

  // Start with 400 base + 100 carry-over = 500 total
  const user = await createSubscribedUser(email, 400, 100);
  
  // Use only 50 credits (all from carry-over, base untouched)
  await simulateUsage(user.id, 50);
  
  // Renew - should have 450 remaining (50 from carryover + 400 from base)
  const result = await simulateRenewal(user.id, 400);

  // Old carryover (50) expires, full base (400) rolls
  const expected = {
    creditBalance: 800, // 400 rolled + 400 new
    basePlanCredits: 400,
    carryOverCredits: 400, // Full base plan rolled
  };

  const passed =
    result?.creditBalance === expected.creditBalance &&
    result?.basePlanCredits === expected.basePlanCredits &&
    result?.carryOverCredits === expected.carryOverCredits;

  await cleanupTestUser(email);

  return { passed, expected, actual: result };
}

// Test 7: Renewal with different tier amounts
async function test7_DifferentTierRenewals() {
  const tiers = [
    { credits: 100, usage: 50, expectedRollover: 50 },
    { credits: 400, usage: 200, expectedRollover: 200 },
    { credits: 800, usage: 300, expectedRollover: 500 },
    { credits: 1200, usage: 1000, expectedRollover: 200 },
  ];

  let allPassed = true;
  const tierResults: any[] = [];

  for (const tier of tiers) {
    const email = `renewal7-${tier.credits}@stripe-test.com`;
    await cleanupTestUser(email);

    const user = await createSubscribedUser(email, tier.credits, 0);
    await simulateUsage(user.id, tier.usage);
    const result = await simulateRenewal(user.id, tier.credits);

    const expectedTotal = tier.expectedRollover + tier.credits;
    const passed =
      result?.creditBalance === expectedTotal &&
      result?.carryOverCredits === tier.expectedRollover;

    tierResults.push({
      tier: tier.credits,
      passed,
      expected: expectedTotal,
      actual: result?.creditBalance,
    });

    if (!passed) allPassed = false;

    await cleanupTestUser(email);
  }

  return {
    passed: allPassed,
    expected: tiers.map((t) => ({
      tier: t.credits,
      total: t.expectedRollover + t.credits,
    })),
    actual: tierResults,
  };
}

// Run all tests
async function runTests() {
  console.log("\n" + "=".repeat(80));
  console.log("🧪 STRIPE RENEWAL & ROLLOVER TESTS");
  console.log("=".repeat(80));

  await testScenario(
    "Test 1: Normal renewal with partial usage (200/400 used)",
    test1_RenewalPartialUsage
  );

  await testScenario(
    "Test 2: Renewal with full usage (400/400 used, no rollover)",
    test2_RenewalFullUsage
  );

  await testScenario(
    "Test 3: Renewal with no usage (0/400 used, full rollover)",
    test3_RenewalNoUsage
  );

  await testScenario(
    "Test 4: Multiple renewals with rollover chain",
    test4_MultipleRenewals
  );

  await testScenario(
    "Test 5: Renewal with existing carry-over that expires",
    test5_CarryOverExpires
  );

  await testScenario(
    "Test 6: Renewal after using only carry-over credits",
    test6_UseOnlyCarryOver
  );

  await testScenario(
    "Test 7: Different tier renewals (100, 400, 800, 1200)",
    test7_DifferentTierRenewals
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
