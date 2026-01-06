import {
  runPlaywrightRuntimeCheck,
  cleanupPlaywrightSandbox,
  getPlaywrightSandboxStatus,
} from "../src/lib/ai/daytona-playwright-manager";

async function testPlaywrightManager() {
  console.log("Testing Playwright Manager...");

  try {
    // Check initial status
    console.log("\n1. Checking initial sandbox status...");
    const initialStatus = await getPlaywrightSandboxStatus();
    console.log("✅ Initial status:", initialStatus);

    // Test running Playwright checks on a test URL
    // Using a simple test URL - you can replace this with an actual sandbox URL
    const testUrl = "https://example.com";
    console.log(`\n2. Running Playwright runtime check on ${testUrl}...`);

    // New signature: runPlaywrightRuntimeCheck(url, sandbox?, maxRetries)
    // No sandbox = production mode (uses URL directly)
    const result = await runPlaywrightRuntimeCheck(testUrl, undefined, 2);

    console.log("✅ Playwright check completed:");
    console.log("  Success:", result.success);
    console.log("  Total errors:", result.totalErrors);
    console.log("  Timestamp:", result.timestamp);

    if (result.errors && result.errors.length > 0) {
      console.log("\n  Detected errors:");
      result.errors.forEach((error, index) => {
        console.log(`    ${index + 1}. [${error.severity}] ${error.message}`);
        console.log(`       File: ${error.url}:${error.line}:${error.column}`);
        console.log(`       Auto-fixable: ${error.autoFixable}`);
      });
    }

    if (result.error) {
      console.log("  Error:", result.error);
    }

    // Check final status
    console.log("\n3. Checking final sandbox status...");
    const finalStatus = await getPlaywrightSandboxStatus();
    console.log("✅ Final status:", finalStatus);

    // Clean up (optional - sandbox can be reused)
    console.log("\n4. Cleaning up Playwright sandbox...");
    await cleanupPlaywrightSandbox();
    console.log("✅ Sandbox cleaned up");

    console.log("\n🎉 Playwright Manager tests passed!");
  } catch (error) {
    console.error("\n❌ Playwright Manager test failed:", error);
    throw error;
  }
}

// Run the test
testPlaywrightManager().catch(console.error);
