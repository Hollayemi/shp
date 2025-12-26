#!/usr/bin/env node

import { VoltAgentService } from "../src/lib/voltagent-service";

async function testVoltAgent() {
  console.log("🧪 Testing VoltAgent Integration");

  try {
    const voltAgentService = new VoltAgentService();

    console.log("✅ VoltAgent service created successfully");

    // Test error monitoring
    console.log("🔍 Testing error monitoring...");
    await voltAgentService.startErrorMonitoring();

    console.log("✅ Error monitoring test completed");

    // Test workflow
    console.log("🔄 Testing workflow...");
    await voltAgentService.runWorkflow();

    console.log("✅ Workflow test completed");

    console.log("\n🎉 VoltAgent integration test passed!");
    console.log("\n📋 Available commands:");
    console.log("  pnpm dev:voltagent     - Start development with VoltAgent");
    console.log("  pnpm voltagent:workflow - Run error fix workflow");
    console.log("  pnpm voltagent:monitor   - Start error monitoring");
  } catch (error) {
    console.error("❌ VoltAgent test failed:", error);
    process.exit(1);
  }
}

testVoltAgent();
