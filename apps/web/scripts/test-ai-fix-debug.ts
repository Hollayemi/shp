#!/usr/bin/env tsx

/**
 * Debug script to test AI fix functionality
 * This script will help verify that the AI fixes are being applied correctly
 */

import { prisma } from "@/lib/db";
import { getSandbox } from "@/lib/daytona-sandbox-manager";

async function testAIFixDebug() {
  console.log("🔍 Testing AI Fix Debug...");

  // Get a project with errors
  const project = await prisma.project.findFirst({
    where: {
      sandboxId: { not: null },
    },
    include: {
      projectErrors: {
        where: {
          status: "DETECTED",
          autoFixable: true,
        },
        take: 1,
      },
    },
  });

  if (!project) {
    console.log("❌ No project with errors found");
    return;
  }

  console.log(`📁 Found project: ${project.id}`);
  console.log(`🔧 Sandbox ID: ${project.sandboxId}`);
  console.log(`❌ Errors: ${project.projectErrors.length}`);

  if (project.projectErrors.length === 0) {
    console.log("❌ No auto-fixable errors found");
    return;
  }

  const error = project.projectErrors[0];
  console.log(`🎯 Testing with error: ${error.id} (${error.errorType})`);

  // Get sandbox
  const sandboxInfo = await getSandbox(project.id);
  if (!sandboxInfo) {
    console.log("❌ No sandbox found");
    return;
  }

  const sandbox = sandboxInfo.sandbox;
  console.log(`🔧 Connected to sandbox: ${sandbox.id}`);

  // Test file writing
  const testFile = "src/test-ai-fix.ts";
  const testContent = `// AI Fix Test - ${new Date().toISOString()}
export const testAIFix = () => {
  console.log("AI Fix applied successfully!");
  return "Fixed by AI";
};`;

  try {
    console.log(`📝 Writing test file: ${testFile}`);
    const workspacePath = `/home/daytona/workspace/${testFile}`;
    await sandbox.fs.uploadFile(Buffer.from(testContent), workspacePath);
    console.log("✅ File written successfully");

    // Verify file was written
    const writtenFile = await sandbox.fs.downloadFile(workspacePath);
    const writtenContent = writtenFile.toString();
    console.log(`✅ File verified: ${writtenContent.length} chars`);

    if (writtenContent === testContent) {
      console.log("✅ File content matches");
    } else {
      console.log("❌ File content mismatch");
    }

    // Test dev server restart
    console.log("🔄 Testing dev server restart...");

    // Check if dev server is running
    const checkResult = await sandbox.process.executeCommand(
      "ps aux | grep -E '(pnpm dev|vite|node.*vite)' | grep -v grep",
      "/home/daytona/workspace"
    );
    console.log(`🔍 Dev server check: ${checkResult.result}`);

    // Kill dev server
    const killResult = await sandbox.process.executeCommand(
      "pkill -f 'pnpm dev' || true",
      "/home/daytona/workspace"
    );
    console.log(`💀 Kill result: ${killResult.result}`);

    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Start dev server
    const startResult = await sandbox.process.executeCommand(
      "cd /home/daytona/workspace && nohup pnpm dev > /dev/null 2>&1 &",
      "/home/daytona"
    );
    console.log(`🚀 Start result: ${startResult.result}`);

    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Verify dev server is running
    const verifyResult = await sandbox.process.executeCommand(
      "ps aux | grep -E '(pnpm dev|vite|node.*vite)' | grep -v grep",
      "/home/daytona/workspace"
    );
    console.log(`✅ Dev server verify: ${verifyResult.result}`);

    console.log("🎉 AI Fix debug test completed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

// Run the test
testAIFixDebug().catch(console.error);
