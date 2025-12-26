#!/usr/bin/env tsx

// Load environment variables from .env file
import { config } from "dotenv";
config();

// DEPRECATED: E2B SandboxManager no longer exists
// import { SandboxManager } from "../src/lib/sandbox-manager";

async function testSandboxManager() {
  console.log("🧪 Testing SandboxManager...\n");
  console.log("⚠️ DEPRECATED: This test is for the old E2B SandboxManager.");
  console.log("Use the new provider-aware sandbox manager instead.\n");
  return;

  // try {
  //   console.log("📦 Creating sandbox...");
  //
  //   const sandboxInfo = await SandboxManager.getOrCreateSandbox({
  //     userId: "test-user",
  //     projectId: "test-project",
  //     files: {
  //       "test.txt": "Hello world",
  //     },
  //   });
  //
  //   console.log("✅ Sandbox created successfully!");
  //   console.log(`📦 Sandbox ID: ${sandboxInfo.sandboxId}`);
  //   console.log(`🔗 Sandbox URL: ${sandboxInfo.sandboxUrl}`);
  //
  //   // Test file operations
  //   console.log("\n📝 Testing file operations...");
  //
  //   const fileResult = await SandboxManager.updateSandboxFiles(sandboxInfo.sandboxId, {
  //     "package.json": JSON.stringify({
  //       name: "test-project",
  //       version: "1.0.0",
  //       main: "index.js"
  //     }, null, 2),
  //     "index.js": "console.log('Hello from test project!');"
  //   });
  //
  //   console.log(`✅ File operations successful! Updated ${fileResult.updatedFiles} files`);
  //
  //   // Test sandbox status
  //   console.log("\n🔍 Testing sandbox status...");
  //
  //   const status = await SandboxManager.getSandboxStatus("test-user");
  //   console.log(`✅ Sandbox status: ${JSON.stringify(status, null, 2)}`);
  //
  //   console.log("\n🎉 All SandboxManager tests passed!");
  //
  // } catch (error: any) {
  //   console.error("❌ SandboxManager test failed:", error.message);
  //   console.error("Stack trace:", error.stack);
  //   process.exit(1);
  // }
}

testSandboxManager(); 