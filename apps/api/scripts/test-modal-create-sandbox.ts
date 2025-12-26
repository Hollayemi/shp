#!/usr/bin/env tsx
/**
 * Test Modal Sandbox Creation
 *
 * Quick test script to create a test project and Modal sandbox
 *
 * Usage:
 *   npx tsx scripts/test-modal-create-sandbox.ts
 *   npx tsx scripts/test-modal-create-sandbox.ts --template=vite-template
 *   npx tsx scripts/test-modal-create-sandbox.ts --project-id=existing-id
 *   npx tsx scripts/test-modal-create-sandbox.ts --user-id=your-user-id
 */

import * as dotenv from "dotenv";
import { prisma } from "@shipper/database";

// Load environment variables
dotenv.config();

const API_URL = process.env.API_URL || "http://localhost:4000";
const API_KEY = process.env.SHIPPER_API_KEY;

if (!API_KEY) {
  console.error("❌ Error: SHIPPER_API_KEY environment variable is required");
  process.exit(1);
}

// Parse command line arguments
const args = process.argv.slice(2);
const templateArg = args.find((arg) => arg.startsWith("--template="));
const projectIdArg = args.find((arg) => arg.startsWith("--project-id="));
const userIdArg = args.find((arg) => arg.startsWith("--user-id="));

const templateName = templateArg?.split("=")[1] || "vite-template";
const existingProjectId = projectIdArg?.split("=")[1];
const userId = userIdArg?.split("=")[1];

async function createTestProject(): Promise<string> {
  console.log("📝 Creating test project in database...");

  // Find or use a test user
  let testUserId = userId;
  if (!testUserId) {
    const testUser = await prisma.user.findFirst({
      where: {
        email: { contains: "test" },
      },
    });

    if (testUser) {
      testUserId = testUser.id;
      console.log(`   Using existing test user: ${testUser.email}`);
    } else {
      // Find any user to use for testing
      const anyUser = await prisma.user.findFirst();
      if (anyUser) {
        testUserId = anyUser.id;
        console.log(`   Using user: ${anyUser.email}`);
      } else {
        throw new Error("No users found in database. Create a user first.");
      }
    }
  }

  // Create a test project
  const project = await prisma.project.create({
    data: {
      name: `Modal Test Project - ${new Date().toISOString()}`,
      description: "Test project created by test-modal-create-sandbox.ts",
      userId: testUserId,
      messagingVersion: 2,
      visibility: "PRIVATE",
    },
  });

  console.log(`✅ Test project created: ${project.id}\n`);
  return project.id;
}

async function testCreateSandbox() {
  console.log("🧪 Testing Modal Sandbox Creation");
  console.log("================================\n");
  console.log(`API URL: ${API_URL}`);
  console.log(`Template: ${templateName}\n`);

  let projectId: string | undefined;

  try {
    if (existingProjectId) {
      console.log(`Using existing project: ${existingProjectId}\n`);
      projectId = existingProjectId;
    } else {
      projectId = await createTestProject();
    }
    console.log("📤 Sending request to create sandbox...");

    const response = await fetch(`${API_URL}/api/v1/modal/sandbox`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify({
        projectId,
        templateName,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`❌ Request failed with status ${response.status}`);
      console.error("Response:", JSON.stringify(data, null, 2));
      process.exit(1);
    }

    console.log("\n✅ Sandbox created successfully!\n");
    console.log("📋 Sandbox Details:");
    console.log("─".repeat(50));
    console.log(`Sandbox ID: ${data.data.sandboxId}`);
    console.log(`Sandbox URL: ${data.data.sandboxUrl || "Not available"}`);
    console.log(`Expires At: ${data.data.sandboxExpiresAt || "Not set"}`);
    console.log("─".repeat(50));

    console.log("\n💡 Next Steps:");
    console.log("1. Test executing a command:");
    console.log(`   curl -X POST ${API_URL}/api/v1/modal/command/execute \\`);
    console.log(`     -H "Content-Type: application/json" \\`);
    console.log(`     -H "x-api-key: YOUR_API_KEY" \\`);
    console.log(
      `     -d '{"sandboxId": "${data.data.sandboxId}", "command": "ls -la"}'`,
    );

    console.log("\n2. Test reading a file:");
    console.log(`   curl -X POST ${API_URL}/api/v1/modal/file/read \\`);
    console.log(`     -H "Content-Type: application/json" \\`);
    console.log(`     -H "x-api-key: YOUR_API_KEY" \\`);
    console.log(
      `     -d '{"sandboxId": "${data.data.sandboxId}", "path": "package.json"}'`,
    );

    console.log("\n3. Clean up when done:");
    console.log(
      `   curl -X DELETE ${API_URL}/api/v1/modal/sandbox/${data.data.sandboxId} \\`,
    );
    console.log(`     -H "x-api-key: YOUR_API_KEY"`);

    if (!existingProjectId) {
      console.log("\n4. Delete test project:");
      console.log(`   Project ID: ${projectId}`);
      console.log("   (Project will remain in database for inspection)");
    }
  } catch (error) {
    console.error(
      "\n❌ Error:",
      error instanceof Error ? error.message : String(error),
    );

    // Cleanup project if we created it
    if (!existingProjectId && projectId) {
      console.log("\n🧹 Cleaning up test project...");
      try {
        await prisma.project.delete({
          where: { id: projectId },
        });
        console.log("✅ Test project deleted");
      } catch (cleanupError) {
        console.error("⚠️ Failed to cleanup test project:", cleanupError);
      }
    }

    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testCreateSandbox().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
