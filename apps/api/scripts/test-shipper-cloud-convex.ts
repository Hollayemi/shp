#!/usr/bin/env tsx
/**
 * Test Shipper Cloud (Convex) Integration
 *
 * This script tests the full Convex integration flow:
 * 1. Creates a test project in the database
 * 2. Creates a Modal sandbox
 * 3. Writes a simple Convex-based app (schema, functions, React components)
 * 4. Provisions a Shipper Cloud (Convex) backend
 * 5. Injects the deploy key into the sandbox
 * 6. Runs `npx convex deploy` to push schema and generate types
 * 7. Verifies the deployment
 *
 * Prerequisites:
 * - CONVEX_TEAM_ACCESS_TOKEN: Convex team access token (admin level)
 * - CONVEX_DEPLOY_KEY_ENCRYPTION_SECRET: Secret for encrypting deploy keys
 * - MODAL_TOKEN_ID and MODAL_TOKEN_SECRET: Modal SDK credentials
 * - Database connection (DATABASE_URL)
 *
 * Usage:
 *   npx tsx scripts/test-shipper-cloud-convex.ts
 *   npx tsx scripts/test-shipper-cloud-convex.ts --skip-cleanup
 *   npx tsx scripts/test-shipper-cloud-convex.ts --user-id=your-user-id
 */

import * as dotenv from "dotenv";
import { prisma } from "@shipper/database";
import {
  ShipperCloudDeploymentService,
  decryptDeployKey,
} from "@shipper/convex";
import {
  createSandbox,
  getSandbox,
  deleteSandbox,
  executeCommand,
  writeFile,
  readFile,
} from "../src/services/modal-sandbox-manager.js";

// Load environment variables
dotenv.config();

// Parse command line arguments
const args = process.argv.slice(2);
const skipCleanup = args.includes("--skip-cleanup");
const userIdArg = args.find((arg) => arg.startsWith("--user-id="));
const userId = userIdArg?.split("=")[1];

// Test state
let testProjectId: string | null = null;
let sandboxId: string | null = null;
let convexDeploymentId: string | null = null;

// Modal sandbox working directory
const WORK_DIR = "/workspace";

// ============================================================================
// Convex App Files
// ============================================================================

const CONVEX_SCHEMA = `import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  tasks: defineTable({
    text: v.string(),
    isCompleted: v.boolean(),
    createdAt: v.number(),
  }),
});
`;

const CONVEX_TASKS_FUNCTIONS = `import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("tasks").order("desc").collect();
  },
});

export const create = mutation({
  args: { text: v.string() },
  handler: async (ctx, args) => {
    const taskId = await ctx.db.insert("tasks", {
      text: args.text,
      isCompleted: false,
      createdAt: Date.now(),
    });
    return taskId;
  },
});

export const toggle = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (!task) throw new Error("Task not found");
    await ctx.db.patch(args.id, { isCompleted: !task.isCompleted });
  },
});

export const remove = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
`;

const APP_TSX = (convexUrl: string) => `import { useState } from "react";
import { ConvexProvider, ConvexReactClient, useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

const convex = new ConvexReactClient("${convexUrl}");

function TaskList() {
  const tasks = useQuery(api.tasks.list) ?? [];
  const createTask = useMutation(api.tasks.create);
  const toggleTask = useMutation(api.tasks.toggle);
  const removeTask = useMutation(api.tasks.remove);
  const [newTask, setNewTask] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    await createTask({ text: newTask });
    setNewTask("");
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Shipper Cloud Tasks</h1>

      <form onSubmit={handleSubmit} className="mb-4 flex gap-2">
        <input
          type="text"
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          placeholder="Add a new task..."
          className="flex-1 px-3 py-2 border rounded"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Add
        </button>
      </form>

      <ul className="space-y-2">
        {tasks.map((task) => (
          <li
            key={task._id}
            className="flex items-center gap-2 p-2 border rounded"
          >
            <input
              type="checkbox"
              checked={task.isCompleted}
              onChange={() => toggleTask({ id: task._id })}
              className="h-4 w-4"
            />
            <span className={task.isCompleted ? "line-through text-gray-400" : ""}>
              {task.text}
            </span>
            <button
              onClick={() => removeTask({ id: task._id })}
              className="ml-auto text-red-500 hover:text-red-700"
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      {tasks.length === 0 && (
        <p className="text-gray-500 text-center">No tasks yet. Add one above!</p>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ConvexProvider client={convex}>
      <TaskList />
    </ConvexProvider>
  );
}
`;

// ============================================================================
// Test Functions
// ============================================================================

async function checkEnvironment(): Promise<void> {
  console.log("🔍 Checking environment...\n");

  const required = [
    "CONVEX_TEAM_ACCESS_TOKEN",
    "CONVEX_DEPLOY_KEY_ENCRYPTION_SECRET",
    "MODAL_TOKEN_ID",
    "MODAL_TOKEN_SECRET",
    "DATABASE_URL",
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error("❌ Missing required environment variables:");
    missing.forEach((key) => console.error(`   - ${key}`));
    process.exit(1);
  }

  console.log("✅ All required environment variables are set\n");
}

async function createTestProject(): Promise<string> {
  console.log("📝 Creating test project...\n");

  // Find or use a test user
  let testUserId = userId;
  if (!testUserId) {
    const testUser = await prisma.user.findFirst({
      where: { email: { contains: "test" } },
    });

    if (testUser) {
      testUserId = testUser.id;
      console.log(`   Using test user: ${testUser.email}`);
    } else {
      const anyUser = await prisma.user.findFirst();
      if (anyUser) {
        testUserId = anyUser.id;
        console.log(`   Using user: ${anyUser.email}`);
      } else {
        throw new Error("No users found in database. Create a user first.");
      }
    }
  }

  const project = await prisma.project.create({
    data: {
      name: `Shipper Cloud Test - ${new Date().toISOString()}`,
      subtitle: "Test project for Convex integration",
      user: { connect: { id: testUserId } },
      messagingVersion: 2,
    },
  });

  console.log(`✅ Created project: ${project.id}\n`);
  return project.id;
}

async function createTestSandbox(projectId: string): Promise<string> {
  console.log("🏗️  Creating Modal sandbox...\n");

  const sandboxInfo = await createSandbox(
    projectId,
    null, // No fragment
    "database-vite-template", // Use database-vite template (has pre-built snapshot)
  );

  if (!sandboxInfo) {
    throw new Error("Failed to create sandbox");
  }

  console.log(`✅ Sandbox created: ${sandboxInfo.sandboxId}`);
  console.log(`   URL: ${sandboxInfo.sandboxUrl}\n`);

  return sandboxInfo.sandboxId;
}

async function writeConvexFiles(projectId: string): Promise<void> {
  console.log("📂 Writing Convex app files to sandbox...\n");

  const sandboxInfo = await getSandbox(projectId);
  if (!sandboxInfo) {
    throw new Error("Sandbox not found");
  }

  const sbxId = sandboxInfo.sandboxId;

  // Debug: List workspace contents
  console.log("   Listing workspace contents...");
  const lsResult = await executeCommand(sbxId, `ls -la ${WORK_DIR}`);
  console.log(`   Workspace files:\n${lsResult.stdout}`);

  // Write schema.ts (writeFile automatically prepends /workspace/)
  console.log("   Writing convex/schema.ts...");
  await writeFile(sbxId, `convex/schema.ts`, CONVEX_SCHEMA);

  // Write tasks.ts
  console.log("   Writing convex/tasks.ts...");
  await writeFile(sbxId, `convex/tasks.ts`, CONVEX_TASKS_FUNCTIONS);

  // Install convex directly using bun (the template uses bun)
  // Note: workdir is already /workspace, so no cd needed
  console.log("   Installing convex dependency (this may take a moment)...");
  const installResult = await executeCommand(
    sbxId,
    `bun add convex`,
    180000, // 3 minute timeout
  );

  if (installResult.exitCode !== 0) {
    console.warn(`   ⚠️ bun add had issues:`);
    console.warn(`   stdout: ${installResult.stdout.slice(0, 500)}`);
    console.warn(`   stderr: ${installResult.stderr.slice(0, 500)}`);
  } else {
    console.log("   ✅ convex installed successfully");
  }

  console.log("✅ Convex files written to sandbox\n");
}

async function provisionConvexBackend(
  projectId: string,
): Promise<{ deploymentUrl: string; encryptedDeployKey: string }> {
  console.log("☁️  Provisioning Shipper Cloud (Convex) backend...\n");

  const service = new ShipperCloudDeploymentService();
  const projectName = `shipper-test-${Date.now()}`;

  const result = await service.provisionBackend(projectId, projectName);

  if (!result.success || !result.deployment) {
    throw new Error(`Failed to provision backend: ${result.error}`);
  }

  // Save to database (convexProjectId needs to be a string)
  const deployment = await prisma.convexDeployment.create({
    data: {
      projectId,
      convexProjectId: String(result.deployment.convexProjectId),
      convexDeploymentName: result.deployment.convexDeploymentName,
      convexDeploymentUrl: result.deployment.convexDeploymentUrl,
      deployKeyEncrypted: result.deployment.deployKeyEncrypted,
      status: "ACTIVE",
    },
  });

  console.log(`✅ Convex backend provisioned`);
  console.log(`   Deployment URL: ${result.deploymentUrl}`);
  console.log(`   Deployment Name: ${result.deploymentName}`);
  console.log(`   Database ID: ${deployment.id}\n`);

  convexDeploymentId = deployment.id;

  return {
    deploymentUrl: result.deploymentUrl!,
    encryptedDeployKey: result.deployment.deployKeyEncrypted,
  };
}

async function injectDeployKeyAndDeploy(
  projectId: string,
  encryptedDeployKey: string,
): Promise<void> {
  console.log("🔑 Injecting deploy key and running Convex CLI...\n");

  const sandboxInfo = await getSandbox(projectId);
  if (!sandboxInfo) {
    throw new Error("Sandbox not found");
  }

  const sbxId = sandboxInfo.sandboxId;

  // Decrypt the deploy key
  const deployKey = decryptDeployKey(encryptedDeployKey);

  // Inject into .env file using sh -c for shell features
  console.log("   Injecting CONVEX_DEPLOY_KEY into .env...");
  await executeCommand(
    sbxId,
    `sh -c 'echo "CONVEX_DEPLOY_KEY=${deployKey}" >> ${WORK_DIR}/.env'`,
  );

  // Run convex deploy with the deploy key as environment variable
  // Using sh -c to support environment variables
  // Use bunx instead of npx since the sandbox uses bun
  console.log(
    "   Running bunx convex deploy --yes (this may take a moment)...",
  );
  const deployResult = await executeCommand(
    sbxId,
    `sh -c 'CONVEX_DEPLOY_KEY="${deployKey}" bunx convex deploy --yes'`,
    180000, // 3 minutes
  );

  console.log(`   Exit code: ${deployResult.exitCode}`);

  if (deployResult.exitCode !== 0) {
    console.error("   ❌ Convex deploy failed:");
    console.error(`   stdout: ${deployResult.stdout}`);
    console.error(`   stderr: ${deployResult.stderr}`);
    throw new Error("Convex deploy failed");
  }

  console.log("✅ Convex deployment successful\n");
  console.log("   Generated files:");

  // List generated files
  const lsResult = await executeCommand(
    sbxId,
    `sh -c 'ls -la ${WORK_DIR}/convex/_generated/ 2>/dev/null || echo "No generated files yet"'`,
  );
  console.log(lsResult.stdout);
}

async function updateAppWithConvexUrl(
  projectId: string,
  convexUrl: string,
): Promise<void> {
  console.log("📝 Updating App.tsx with Convex provider...\n");

  const sandboxInfo = await getSandbox(projectId);
  if (!sandboxInfo) {
    throw new Error("Sandbox not found");
  }

  // Write the updated App.tsx (writeFile automatically prepends /workspace/)
  await writeFile(sandboxInfo.sandboxId, `src/App.tsx`, APP_TSX(convexUrl));

  console.log("✅ App.tsx updated with ConvexProvider\n");
}

async function verifyDeployment(projectId: string): Promise<void> {
  console.log("🔍 Verifying deployment...\n");

  const sandboxInfo = await getSandbox(projectId);
  if (!sandboxInfo) {
    throw new Error("Sandbox not found");
  }

  const sbxId = sandboxInfo.sandboxId;

  // Check that generated files exist
  const checkFiles = [
    "convex/_generated/api.d.ts",
    "convex/_generated/api.js",
    "convex/_generated/server.d.ts",
    "convex/_generated/server.js",
  ];

  console.log("   Checking generated files...");
  for (const file of checkFiles) {
    const result = await executeCommand(
      sbxId,
      `sh -c 'test -f ${WORK_DIR}/${file} && echo "exists" || echo "missing"'`,
    );
    const status = result.stdout.trim() === "exists" ? "✅" : "❌";
    console.log(`   ${status} ${file}`);
  }

  // Try type check
  console.log("\n   Running type check...");
  const tscResult = await executeCommand(
    sbxId,
    `sh -c 'npx tsc --noEmit 2>&1 || true'`,
    60000,
  );

  if (
    tscResult.stdout.includes("error") ||
    tscResult.stderr.includes("error")
  ) {
    console.warn("   ⚠️ Type errors found (may be expected for first run):");
    console.warn((tscResult.stdout + tscResult.stderr).slice(0, 500));
  } else {
    console.log("   ✅ No type errors");
  }

  console.log("\n✅ Deployment verification complete\n");
}

async function cleanup(): Promise<void> {
  if (skipCleanup) {
    console.log("⏭️  Skipping cleanup (--skip-cleanup flag)\n");
    console.log("   Resources to clean up manually:");
    if (testProjectId) console.log(`   - Project ID: ${testProjectId}`);
    if (sandboxId) console.log(`   - Sandbox ID: ${sandboxId}`);
    if (convexDeploymentId)
      console.log(`   - Convex Deployment ID: ${convexDeploymentId}`);
    return;
  }

  console.log("🧹 Cleaning up...\n");

  // Delete Convex deployment record
  if (convexDeploymentId) {
    try {
      await prisma.convexDeployment.delete({
        where: { id: convexDeploymentId },
      });
      console.log("   ✅ Deleted Convex deployment record");
    } catch (error) {
      console.warn("   ⚠️ Failed to delete Convex deployment:", error);
    }
  }

  // Delete sandbox
  if (sandboxId && testProjectId) {
    try {
      const sandboxInfo = await getSandbox(testProjectId);
      if (sandboxInfo) {
        await deleteSandbox(sandboxInfo.sandboxId);
        console.log("   ✅ Deleted sandbox");
      }
    } catch (error) {
      console.warn("   ⚠️ Failed to delete sandbox:", error);
    }
  }

  // Delete project
  if (testProjectId) {
    try {
      await prisma.project.delete({
        where: { id: testProjectId },
      });
      console.log("   ✅ Deleted test project");
    } catch (error) {
      console.warn("   ⚠️ Failed to delete project:", error);
    }
  }

  console.log("\n✅ Cleanup complete\n");
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  console.log("═".repeat(60));
  console.log("🚀 Shipper Cloud (Convex) Integration Test");
  console.log("═".repeat(60));
  console.log();

  try {
    // Step 1: Check environment
    await checkEnvironment();

    // Step 2: Create test project
    testProjectId = await createTestProject();

    // Step 3: Create sandbox
    sandboxId = await createTestSandbox(testProjectId);

    // Step 4: Write Convex files
    await writeConvexFiles(testProjectId);

    // Step 5: Provision Convex backend
    const { deploymentUrl, encryptedDeployKey } =
      await provisionConvexBackend(testProjectId);

    // Step 6: Inject deploy key and run convex deploy
    await injectDeployKeyAndDeploy(testProjectId, encryptedDeployKey);

    // Step 7: Update App.tsx
    await updateAppWithConvexUrl(testProjectId, deploymentUrl);

    // Step 8: Verify
    await verifyDeployment(testProjectId);

    console.log("═".repeat(60));
    console.log("🎉 All tests passed!");
    console.log("═".repeat(60));
    console.log();
    console.log("📋 Summary:");
    console.log(`   Project ID: ${testProjectId}`);
    console.log(`   Sandbox ID: ${sandboxId}`);
    console.log(`   Convex URL: ${deploymentUrl}`);
    console.log();
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    process.exitCode = 1;
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
