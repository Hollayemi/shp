#!/usr/bin/env tsx

// Load environment variables from .env file
import { config } from "dotenv";
config();

import { createAgent } from "@inngest/agent-kit";
import { createAzureOpenAIModel } from "../src/helpers/createAzureOpenAIModel";

async function testAzureModelDirect() {
  console.log("🧪 Testing Azure OpenAI Model Direct Usage...\n");

  try {
    console.log("🔧 Creating Azure OpenAI model...");
    const model = createAzureOpenAIModel("gpt-4o-mini");
    
    console.log("✅ Model created successfully");
    console.log(`📝 Model format: ${model.format}`);
    console.log(`🔗 Model URL: ${model.url}`);
    console.log(`📋 Model headers: ${JSON.stringify(model.headers, null, 2)}`);

    console.log("\n🤖 Creating agent with Azure model...");
    const agent = createAgent({
      name: "test-agent",
      description: "A test agent",
      system: "You are a helpful assistant. Reply with exactly: 'Hello from Azure OpenAI!'",
      model: model,
    });

    console.log("✅ Agent created successfully");

    console.log("\n📡 Testing agent run...");
    const result = await agent.run("Say hello");
    
    console.log("✅ Agent run completed!");
    console.log(`📤 Output: ${JSON.stringify(result.output, null, 2)}`);
    
    console.log("\n🎉 Azure OpenAI model is working with agent-kit!");
    
  } catch (error: any) {
    console.error("❌ Direct model test failed:", error.message);
    console.error("📋 Error details:", error.stack);
    
    // Try to extract more specific error information
    if (error.cause) {
      console.error("📋 Error cause:", error.cause);
    }
    
    if (error.response) {
      console.error("📋 Response error:", error.response);
    }
    
    process.exit(1);
  }
}

testAzureModelDirect(); 