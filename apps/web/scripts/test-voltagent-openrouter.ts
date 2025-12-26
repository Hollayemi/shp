import { config } from "dotenv";
import { VoltAgentService } from "../src/lib/voltagent-service";
import {
  createErrorFixAgent,
  createErrorClassifierAgent,
  createRepairAgent,
  createValidatorAgent,
} from "../src/lib/voltagent-agents";

// Load environment variables
config();

const testVoltAgentOpenRouter = async () => {
  console.log(
    "🧪 Testing VoltAgent with OpenRouter Claude Sonnet 4 integration..."
  );

  // Check if OPENROUTER_API_KEY is set
  if (!process.env.OPENROUTER_API_KEY) {
    console.error("❌ OPENROUTER_API_KEY environment variable is not set");
    console.log("Please set your OpenRouter API key in your .env file:");
    console.log("OPENROUTER_API_KEY=your_openrouter_api_key");
    return;
  }

  console.log("✅ OpenRouter API key found");

  try {
    // Test 1: VoltAgent Service
    console.log("\n📦 Testing VoltAgent Service...");
    const voltAgentService = new VoltAgentService();

    const testErrorResponse = await voltAgentService.errorFixAgent.generateText(
      "Analyze this TypeScript error: Property 'name' does not exist on type 'User'. Suggest a fix."
    );

    console.log(
      "✅ VoltAgent Service Response:",
      testErrorResponse.text.substring(0, 100) + "..."
    );

    // Test 2: Individual Agents
    console.log("\n🤖 Testing Individual Agents...");

    // Test Error Classifier Agent
    const classifierAgent = createErrorClassifierAgent();
    const classificationResponse = await classifierAgent.generateText(
      "Categorize this error: TypeError: Cannot read property 'map' of undefined"
    );
    console.log(
      "✅ Error Classifier Response:",
      classificationResponse.text.substring(0, 100) + "..."
    );

    // Test Repair Agent
    const repairAgent = createRepairAgent();
    const repairResponse = await repairAgent.generateText(
      "Fix this code: const items = data.map(item => item.name); // data is undefined"
    );
    console.log(
      "✅ Repair Agent Response:",
      repairResponse.text.substring(0, 100) + "..."
    );

    // Test Validator Agent
    const validatorAgent = createValidatorAgent();
    const validationResponse = await validatorAgent.generateText(
      "Is this fix valid for 'data is undefined' error: Add null check 'data?.map(item => item.name)'"
    );
    console.log(
      "✅ Validator Agent Response:",
      validationResponse.text.substring(0, 100) + "..."
    );

    console.log(
      "\n🎉 All VoltAgent + OpenRouter + Claude Sonnet 4 tests passed!"
    );
    console.log("📊 Integration is working correctly!");
  } catch (error) {
    console.error("❌ Test failed:", error);
    console.error("Check your OpenRouter API key and internet connection");
  }
};

// Run the test
testVoltAgentOpenRouter().catch(console.error);
