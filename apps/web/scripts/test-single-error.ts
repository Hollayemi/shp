#!/usr/bin/env node

import { config } from "dotenv";
import { VoltAgentService } from "../src/lib/voltagent-service";

// Load environment variables from .env file
config();

async function testSingleError() {
  console.log("🧪 Testing VoltAgent with Single Error");

  try {
    const voltAgentService = new VoltAgentService();

    console.log("✅ VoltAgent service created successfully");

    // Test with a single error from the error log
    console.log("🔍 Processing single error...");

    // Create a mock error for testing
    const testError = {
      type: "IMPORT",
      severity: "MEDIUM",
      message: "Potentially missing import: @/components/ui/button",
      file: "src/components/Calculator.tsx",
      line: 1,
      autoFixable: false,
    };

    console.log(`\n📝 Test Error:`);
    console.log(`   Type: ${testError.type}`);
    console.log(`   Severity: ${testError.severity}`);
    console.log(`   Message: ${testError.message}`);
    console.log(`   File: ${testError.file}`);
    console.log(`   Line: ${testError.line}`);

    // Test the AI-powered fix suggestion
    console.log("\n🤖 Testing AI Fix Generation...");

    const response = await voltAgentService.errorFixAgent.generateText(
      `Analyze this ${testError.type} error and provide a fix:

Error: ${testError.message}
File: ${testError.file}
Line: ${testError.line}

Please provide:
1. Root cause analysis
2. Suggested fix
3. Additional notes`
    );

    console.log("\n✨ AI Response:");
    console.log(response.text);

    console.log("\n🎉 Single error test completed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error);

    if (error instanceof Error && error.message?.includes("API key")) {
      console.log(
        "\n💡 Make sure your OPENAI_API_KEY environment variable is set correctly."
      );
    }
  }
}

testSingleError();
