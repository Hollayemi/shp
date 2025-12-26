#!/usr/bin/env npx tsx

import { prisma } from "../src/lib/db";

/**
 * Test Script: Mid-Cycle Upgrades
 * Tests upgrade scenarios and credit preservation logic
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

async function createSubscribedUser(
  email: string,
  basePlan: number,
  carryOver: number = 0
) {
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

async function simulateUpgrade(userId: string, newBasePlan: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      creditBalance: true,
      basePlanCredits: true,
      carryOverCredits: true,
    },
  });

  const currentBalance = user?.creditBalance || 0;
  
  // All current balance becomes carry-over (expires at next renewal)
  const leftoverCredits = currentBalance;
  const newTotalCredits = leftoverCredits + newBasePlan;

  const nextRenewal = new Date();
  nextRenewal.setMonth(nextRenewal.getMonth() + 1);

  await prisma.user.update({
    where: { id: userId },
    data: {
      basePlanCredits: newBasePlan,
      carryOverCredits: leftoverCredits,
      carryOverExpiresAt: nextRenewal,
      creditBalance: newTotalCredits,
      membershipExpiresAt: nextRenewal,
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

async function simulateRenewal(userId: string, basePlan: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      creditBalance: true,
      carryOverCredits: true,
    },
  });

  const currentBalance = user?.creditBalance || 0;
  const currentCarryOver = user?.carryOverCredits || 0;

  // Calculate unused from base plan
  const unusedFromBasePlan = Math.max(0, currentBalance - currentCarryOver);

  // Unused becomes new carry-over
  const newCarryOver = unusedFromBasePlan;
  const newTotalBalance = newCarryOver + basePlan;

  const nextRenewal = new Date();
  nextRenewal.setMonth(nextRenewal.getMonth() + 1);

  await prisma.user.update({
    where: { id: userId },
    data: {
      basePlanCredits: basePlan,
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

// Test 1: Simple upgrade (Pro 100 → Pro 400)
async function test1_SimpleUpgrade() {
  const email = "upgrade1@stripe-test.com";
  await cleanupTestUser(email);

  // Start with Pro 100
  const user = await createSubscribedUser(email, 100, 0);
  
  // Use 50 credits, 50 remain
  await simulateUsage(user.id, 50);
  
  // Upgrade to Pro 400
  const result = await simulateUpgrade(user.id, 400);

  const expected = {
    creditBalance: 450, // 50 leftover + 400 new
    basePlanCredits: 400,
    carryOverCredits: 50, // From old plan
  };

  const passed =
    result?.creditBalance === expected.creditBalance &&
    result?.basePlanCredits === expected.basePlanCredits &&
    result?.carryOverCredits === expected.carryOverCredits &&
    result?.carryOverExpiresAt !== null;

  await cleanupTestUser(email);

  return { passed, expected, actual: result };
}

// Test 2: Upgrade with full credits remaining
async function test2_UpgradeFullCredits() {
  const email = "upgrade2@stripe-test.com";
  await cleanupTestUser(email);

  // Start with Pro 100, use 0 credits
  const user = await createSubscribedUser(email, 100, 0);
  
  // Upgrade to Pro 400 with all 100 credits remaining
  const result = await simulateUpgrade(user.id, 400);

  const expected = {
    creditBalance: 500, // 100 leftover + 400 new
    basePlanCredits: 400,
    carryOverCredits: 100,
  };

  const passed =
    result?.creditBalance === expected.creditBalance &&
    result?.basePlanCredits === expected.basePlanCredits &&
    result?.carryOverCredits === expected.carryOverCredits;

  await cleanupTestUser(email);

  return { passed, expected, actual: result };
}

// Test 3: Upgrade then renewal (verify carry-over expires)
async function test3_UpgradeThenRenewal() {
  const email = "upgrade3@stripe-test.com";
  await cleanupTestUser(email);

  // Start with Pro 100
  const user = await createSubscribedUser(email, 100, 0);
  
  // Use 50, 50 remain
  await simulateUsage(user.id, 50);
  
  // Upgrade to Pro 400 (50 + 400 = 450)
  await simulateUpgrade(user.id, 400);
  
  // Use 250 more (200 remain: 150 from base + 50 from carryover)
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

// Test 4: Multiple upgrades in same cycle
async function test4_MultipleUpgrades() {
  const email = "upgrade4@stripe-test.com";
  await cleanupTestUser(email);

  // Start with Pro 100
  const user = await createSubscribedUser(email, 100, 0);
  
  // Use 30, 70 remain
  await simulateUsage(user.id, 30);
  
  // Upgrade to Pro 400 (70 + 400 = 470)
  await simulateUpgrade(user.id, 400);
  
  // Use 100, 370 remain
  await simulateUsage(user.id, 100);
  
  // Upgrade to Pro 800 (370 + 800 = 1170)
  const result = await simulateUpgrade(user.id, 800);

  const expected = {
    creditBalance: 1170, // 370 leftover + 800 new
    basePlanCredits: 800,
    carryOverCredits: 370, // All previous balance
  };

  const passed =
    result?.creditBalance === expected.creditBalance &&
    result?.basePlanCredits === expected.basePlanCredits &&
    result?.carryOverCredits === expected.carryOverCredits;

  await cleanupTestUser(email);

  return { passed, expected, actual: result };
}

// Test 5: Upgrade with existing carry-over
async function test5_UpgradeWithCarryOver() {
  const email = "upgrade5@stripe-test.com";
  await cleanupTestUser(email);

  // Start with Pro 100 + 50 carry-over = 150 total
  const user = await createSubscribedUser(email, 100, 50);
  
  // Use 30, 120 remain (20 from carryover + 100 from base)
  await simulateUsage(user.id, 30);
  
  // Upgrade to Pro 400
  const result = await simulateUpgrade(user.id, 400);

  const expected = {
    creditBalance: 520, // 120 leftover + 400 new
    basePlanCredits: 400,
    carryOverCredits: 120, // All remaining balance
  };

  const passed =
    result?.creditBalance === expected.creditBalance &&
    result?.basePlanCredits === expected.basePlanCredits &&
    result?.carryOverCredits === expected.carryOverCredits;

  await cleanupTestUser(email);

  return { passed, expected, actual: result };
}

// Test 6: Upgrade with zero credits remaining
async function test6_UpgradeZeroCredits() {
  const email = "upgrade6@stripe-test.com";
  await cleanupTestUser(email);

  // Start with Pro 100
  const user = await createSubscribedUser(email, 100, 0);
  
  // Use all 100 credits
  await simulateUsage(user.id, 100);
  
  // Upgrade to Pro 400
  const result = await simulateUpgrade(user.id, 400);

  const expected = {
    creditBalance: 400, // 0 leftover + 400 new
    basePlanCredits: 400,
    carryOverCredits: 0,
  };

  const passed =
    result?.creditBalance === expected.creditBalance &&
    result?.basePlanCredits === expected.basePlanCredits &&
    result?.carryOverCredits === expected.carryOverCredits;

  await cleanupTestUser(email);

  return { passed, expected, actual: result };
}

// Test 7: All upgrade paths
async function test7_AllUpgradePaths() {
  const upgradePaths = [
    { from: 100, to: 400, usage: 50 },
    { from: 100, to: 800, usage: 30 },
    { from: 400, to: 800, usage: 200 },
    { from: 400, to: 1200, usage: 100 },
    { from: 800, to: 1200, usage: 500 },
  ];

  let allPassed = true;
  const pathResults: any[] = [];

  for (const path of upgradePaths) {
    const email = `upgrade7-${path.from}-${path.to}@stripe-test.com`;
    await cleanupTestUser(email);

    const user = await createSubscribedUser(email, path.from, 0);
    await simulateUsage(user.id, path.usage);
    const result = await simulateUpgrade(user.id, path.to);

    const expectedLeftover = path.from - path.usage;
    const expectedTotal = expectedLeftover + path.to;
    const passed =
      result?.creditBalance === expectedTotal &&
      result?.carryOverCredits === expectedLeftover;

    pathResults.push({
      path: `${path.from} → ${path.to}`,
      passed,
      expected: expectedTotal,
      actual: result?.creditBalance,
    });

    if (!passed) allPassed = false;

    await cleanupTestUser(email);
  }

  return {
    passed: allPassed,
    expected: upgradePaths.map((p) => ({
      path: `${p.from} → ${p.to}`,
      total: p.from - p.usage + p.to,
    })),
    actual: pathResults,
  };
}

// Test 8: Upgrade preserves purchased credits
async function test8_UpgradePreservesPurchased() {
  const email = "upgrade8@stripe-test.com";
  await cleanupTestUser(email);

  // Start with Pro 100 + 200 purchased credits = 300 total
  const user = await createSubscribedUser(email, 100, 200);
  
  // Use 50 (from purchased), 250 remain
  await simulateUsage(user.id, 50);
  
  // Upgrade to Pro 400
  const result = await simulateUpgrade(user.id, 400);

  const expected = {
    creditBalance: 650, // 250 leftover + 400 new
    basePlanCredits: 400,
    carryOverCredits: 250, // Preserved purchased + base
  };

  const passed =
    result?.creditBalance === expected.creditBalance &&
    result?.basePlanCredits === expected.basePlanCredits &&
    result?.carryOverCredits === expected.carryOverCredits;

  await cleanupTestUser(email);

  return { passed, expected, actual: result };
}

// Run all tests
async function runTests() {
  console.log("\n" + "=".repeat(80));
  console.log("🧪 STRIPE UPGRADE TESTS");
  console.log("=".repeat(80));

  await testScenario(
    "Test 1: Simple upgrade (Pro 100 → Pro 400)",
    test1_SimpleUpgrade
  );

  await testScenario(
    "Test 2: Upgrade with full credits remaining",
    test2_UpgradeFullCredits
  );

  await testScenario(
    "Test 3: Upgrade then renewal (verify carry-over expires)",
    test3_UpgradeThenRenewal
  );

  await testScenario(
    "Test 4: Multiple upgrades in same cycle",
    test4_MultipleUpgrades
  );

  await testScenario(
    "Test 5: Upgrade with existing carry-over",
    test5_UpgradeWithCarryOver
  );

  await testScenario(
    "Test 6: Upgrade with zero credits remaining",
    test6_UpgradeZeroCredits
  );

  await testScenario(
    "Test 7: All upgrade paths (100→400, 400→800, etc.)",
    test7_AllUpgradePaths
  );

  await testScenario(
    "Test 8: Upgrade preserves purchased credits",
    test8_UpgradePreservesPurchased
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
