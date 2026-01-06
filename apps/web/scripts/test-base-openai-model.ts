#!/usr/bin/env tsx

// Load environment variables from .env file
import { config } from "dotenv";
config();

import { createAgent, openai } from "@inngest/agent-kit";

async function testBaseOpenAIModel() {
  console.log("🧪 Testing Base OpenAI Model...\n");

  try {
    console.log("🔧 Creating base OpenAI model...");
    const model = openai({
      model: "gpt-4o-mini",
      apiKey: process.env.OPENAI_API_KEY || "test-key",
      defaultParameters: {
        temperature: 0.1,
      },
    });

    console.log("✅ Base OpenAI model created");
    console.log(`📝 Model format: ${model.format}`);
    console.log(`🔗 Model URL: ${model.url}`);

    console.log("\n🤖 Creating agent with base OpenAI model...");
    const agent = createAgent({
      name: "test-agent",
      description: "A test agent",
      system: "You are a helpful assistant. Reply with exactly: 'Hello from OpenAI!'",
      model: model,
    });

    console.log("✅ Agent created successfully");

    console.log("\n📡 Testing agent run...");
    const result = await agent.run("Say hello");
    
    console.log("✅ Agent run completed!");
    console.log(`📤 Output: ${JSON.stringify(result.output, null, 2)}`);
    
    console.log("\n🎉 Base OpenAI model is working with agent-kit!");
    
  } catch (error: any) {
    console.error("❌ Base OpenAI model test failed:", error.message);
    console.error("📋 Error details:", error.stack);
    process.exit(1);
  }
}

testBaseOpenAIModel(); 