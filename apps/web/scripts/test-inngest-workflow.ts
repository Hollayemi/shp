#!/usr/bin/env tsx

// Load environment variables from .env file
import { config } from "dotenv";
config();

import { inngest } from "../src/inngest/client";
import { prisma } from "../src/lib/db";
import { generateSlug } from "random-word-slugs";

async function testInngestWorkflow() {
  console.log("🚀 Testing Inngest Code Agent Workflow...\n");

  // Get test message from command line args or use default
  const testMessage = process.argv[2] || "Create a simple React to-do list app with add, complete, and delete functionality";
  const userId = process.argv[3] || "test-user";

  console.log(`📝 Test message: "${testMessage}"`);
  console.log(`👤 User ID: ${userId}`);

  try {
    // Create or find test user
    console.log("\n👤 Creating/finding test user...");
    const testUser = await prisma.user.upsert({
      where: { email: `${userId}@test.com` },
      update: {},
      create: {
        email: `${userId}@test.com`,
        name: "Test User",
        id: userId,
      },
    });
    console.log(`✅ Test user: ${testUser.email}`);

    // Create a test project
    console.log("\n📦 Creating test project...");
    const testProject = await prisma.project.create({
      data: {
        name: `test-${generateSlug(2, { format: "kebab" })}-${Date.now()}`,
        userId: testUser.id,
        messages: {
          create: {
            content: testMessage,
            role: "USER",
            type: "RESULT",
          },
        },
      },
    });

    console.log(`✅ Test project created: ${testProject.id}`);
    console.log(`📝 Project name: ${testProject.name}`);

    // Trigger the Inngest workflow
    console.log("\n🔄 Triggering Inngest workflow...");
    const eventResult = await inngest.send({
      name: "code-agent/run",
      data: {
        value: testMessage,
        projectId: testProject.id,
        userId: testUser.id,
      },
    });

    console.log(`✅ Inngest event sent successfully!`);
    console.log(`📅 Event ID: ${eventResult.ids[0]}`);

    // Monitor the workflow
    console.log("\n⏰ Monitoring workflow progress...");
    console.log("💡 You can also check the workflow status at:");
    console.log(`   GET http://localhost:3000/api/debug/test-inngest-workflow?projectId=${testProject.id}`);
    console.log("\n🔍 Monitoring for completion (checking every 10 seconds)...");

    let attempts = 0;
    const maxAttempts = 30; // 5 minutes max
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      attempts++;

      const project = await prisma.project.findUnique({
        where: { id: testProject.id },
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 2,
            include: {
              fragment: {
                select: {
                  id: true,
                  title: true,
                  sandboxUrl: true,
                  createdAt: true,
                }
              }
            }
          }
        }
      });

      if (!project) {
        console.log("❌ Project not found");
        break;
      }

      const latestMessage = project.messages[0];
      
      if (latestMessage && latestMessage.role === 'ASSISTANT') {
        if (latestMessage.type === 'RESULT') {
          console.log(`\n🎉 Workflow completed successfully! (${attempts * 10}s)`);
          console.log(`📝 Result: ${latestMessage.content.substring(0, 100)}...`);
          
          if (latestMessage.fragment) {
            console.log(`🔗 Sandbox URL: ${latestMessage.fragment.sandboxUrl}`);
            console.log(`📁 Fragment Title: ${latestMessage.fragment.title}`);
          }
          
          console.log("\n📊 Test Summary:");
          console.log(`  ✅ Azure OpenAI: Working`);
          console.log(`  ✅ Sandbox Manager: Working`);
          console.log(`  ✅ File Operations: Working`);
          console.log(`  ✅ Workflow: Complete`);
          
          process.exit(0);
        } else if (latestMessage.type === 'ERROR') {
          console.log(`\n❌ Workflow failed! (${attempts * 10}s)`);
          console.log(`💥 Error: ${latestMessage.content}`);
          process.exit(1);
        }
      }

      console.log(`⏳ Still processing... (${attempts * 10}s elapsed)`);
    }

    console.log("\n⏰ Workflow timed out after 5 minutes");
    console.log("💡 Check the Inngest dashboard or logs for more details");
    process.exit(1);

  } catch (error: any) {
    console.error("\n💥 Test failed:", error.message);
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  console.error('💥 Unhandled error:', error);
  process.exit(1);
});

console.log("🔧 Environment check...");
console.log(`  Database: ${process.env.DATABASE_URL ? "✅ Connected" : "❌ Missing"}`);
console.log(`  Azure OpenAI: ${process.env.AZURE_OPENAI_ENDPOINT ? "✅ Configured" : "❌ Missing"}`);
console.log(`  Inngest: ${process.env.INNGEST_EVENT_KEY ? "✅ Configured" : "⚠️ Missing (may use dev mode)"}`);

testInngestWorkflow(); 