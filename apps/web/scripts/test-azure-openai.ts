#!/usr/bin/env tsx

// Load environment variables from .env file
import { config } from "dotenv";
config();

import { testAzureOpenAIConnection } from "../src/helpers/createAzureOpenAIModel";

async function main() {
  console.log("🧪 Testing Azure OpenAI Connection...\n");
  
  // Get deployment name from command line args
  const deploymentName = process.argv[2] || "gpt-4o-mini";
  
  console.log(`📡 Testing deployment: ${deploymentName}`);
  console.log("🔍 Checking environment variables...");
  
  // Check environment variables
  const requiredEnvVars = [
    "AZURE_OPENAI_ENDPOINT",
    "AZURE_OPENAI_API_KEY",
  ];
  
  const optionalEnvVars = [
    "AZURE_OPENAI_DEPLOYMENT_NAME",
    "AZURE_OPENAI_API_VERSION",
  ];
  
  console.log("\n📋 Environment Configuration:");
  requiredEnvVars.forEach(envVar => {
    const value = process.env[envVar];
    console.log(`  ${envVar}: ${value ? "✅ Set" : "❌ Missing"}`);
    if (value && envVar === "AZURE_OPENAI_ENDPOINT") {
      console.log(`    Value: ${value}`);
    }
  });
  
  optionalEnvVars.forEach(envVar => {
    const value = process.env[envVar];
    console.log(`  ${envVar}: ${value || "⚠️ Using default"}`);
    if (value) {
      console.log(`    Value: ${value}`);
    }
  });
  
  console.log("\n🚀 Running connection test...");
  
  try {
    const result = await testAzureOpenAIConnection(deploymentName);
    
    console.log("\n📊 Test Results:");
    console.log(`  Success: ${result.success ? "✅" : "❌"}`);
    console.log(`  Deployment: ${result.config.deployment}`);
    console.log(`  Endpoint: ${result.config.endpoint || "❌ Not set"}`);
    console.log(`  Has API Key: ${result.config.hasApiKey ? "✅" : "❌"}`);
    
    if (result.success) {
      console.log(`  AI Response: "${result.response}"`);
      console.log("\n🎉 Azure OpenAI connection is working perfectly!");
    } else {
      console.log(`  Error: ${result.error}`);
      console.log("\n💡 Troubleshooting tips:");
      console.log("  1. Check your AZURE_OPENAI_ENDPOINT is correct");
      console.log("  2. Verify your AZURE_OPENAI_API_KEY is valid");
      console.log("  3. Ensure the deployment name exists in your Azure OpenAI resource");
      console.log("  4. Check your Azure OpenAI resource is active and not suspended");
    }
    
    process.exit(result.success ? 0 : 1);
  } catch (error: any) {
    console.error("\n💥 Unexpected error:", error.message);
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  console.error('💥 Unhandled error:', error);
  process.exit(1);
});

main(); 