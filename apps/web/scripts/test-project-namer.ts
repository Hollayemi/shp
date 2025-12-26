#!/usr/bin/env tsx

// Load environment variables from .env file
import { config } from "dotenv";
config();

import {
  generateProjectMetadata,
  generateSlugFromName,
} from "../src/lib/project-namer";

// Test cases with various project descriptions
const testCases = [
  "Build an eSignature platform",
  "Create a task management app with drag and drop",
  "Weather forecast application with location tracking",
  "Recipe sharing platform for home cooks",
  "Build a modern SaaS dashboard for analytics",
  "Create a real-time chat application",
  "E-commerce store for handmade crafts",
  "Fitness tracking app with workout plans",
  "Build a booking system for restaurants",
  "Create a portfolio website builder",
];

async function testProjectNamer() {
  console.log("🧪 Testing AI Project Namer\n");
  console.log("═══════════════════════════════════════════════════════════\n");

  if (!process.env.OPENROUTER_API_KEY) {
    console.error("❌ OPENROUTER_API_KEY not found in environment variables");
    console.error(
      "   Please add it to your .env file: OPENROUTER_API_KEY=your-key-here",
    );
    process.exit(1);
  }

  console.log("✅ OpenRouter API key found");
  console.log(`📝 Testing ${testCases.length} project descriptions\n`);
  console.log("═══════════════════════════════════════════════════════════\n");

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < testCases.length; i++) {
    const description = testCases[i];
    console.log(`\n[${i + 1}/${testCases.length}] Testing: "${description}"`);
    console.log("─────────────────────────────────────────────────────────");

    try {
      const startTime = Date.now();
      const metadata = await generateProjectMetadata(description);
      const duration = Date.now() - startTime;

      const slug = generateSlugFromName(metadata.name);

      console.log("✅ Generated successfully!");
      console.log(`   ${metadata.logo}  Name:     ${metadata.name}`);
      console.log(`   📝  Subtitle: ${metadata.subtitle}`);
      console.log(`   🔗  Slug:     ${slug}`);
      console.log(`   ⏱️   Duration: ${duration}ms`);

      // Validate the output
      if (!metadata.name || metadata.name.trim().length === 0) {
        console.warn("   ⚠️  Warning: Empty name generated");
      }
      if (!metadata.subtitle || metadata.subtitle.trim().length === 0) {
        console.warn("   ⚠️  Warning: Empty subtitle generated");
      }
      if (!metadata.logo || metadata.logo.trim().length === 0) {
        console.warn("   ⚠️  Warning: Empty logo generated");
      }

      successCount++;
    } catch (error) {
      console.error("❌ Failed to generate metadata");
      console.error(
        `   Error: ${error instanceof Error ? error.message : String(error)}`,
      );
      errorCount++;
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("📊 Test Summary");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`✅ Successful: ${successCount}/${testCases.length}`);
  console.log(`❌ Failed:     ${errorCount}/${testCases.length}`);
  console.log(
    `📈 Success Rate: ${((successCount / testCases.length) * 100).toFixed(1)}%`,
  );
  console.log("═══════════════════════════════════════════════════════════\n");

  if (errorCount > 0) {
    console.log("⚠️  Some tests failed. Please check the errors above.");
    process.exit(1);
  } else {
    console.log("🎉 All tests passed!");
    console.log("\n💡 Usage in your code:");
    console.log('   import { generateProjectMetadata } from "@/lib/ai/project-namer";');
    console.log('   const metadata = await generateProjectMetadata("your project description");');
    console.log(
      "   // Returns: { name: string, subtitle: string, logo: string }",
    );
    console.log("\n✨ The project namer is ready for production!");
  }
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n\n👋 Test interrupted by user");
  process.exit(0);
});

testProjectNamer().catch((error) => {
  console.error("\n❌ Unexpected error:", error);
  process.exit(1);
});

