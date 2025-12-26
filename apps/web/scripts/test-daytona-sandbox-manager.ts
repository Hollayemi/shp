import {
  createSandbox,
  restoreFilesInSandbox,
  deleteSandbox,
} from "../src/lib/daytona-sandbox-manager";

async function testDaytonaSandboxManager() {
  console.log("Testing DaytonaSandboxManager...");

  try {
    // Test creating a sandbox without database operations first
    console.log("Creating sandbox...");
    const sandboxInfo = await createSandbox("test-project-id");

    console.log("✅ Sandbox created successfully:", {
      id: sandboxInfo.sandbox.id,
      url: sandboxInfo.sandboxUrl,
      fileCount: sandboxInfo.files.size,
    });

    // Test file operations
    console.log("Testing file operations...");
    await restoreFilesInSandbox(sandboxInfo.sandbox, {
      "test.txt": "Hello from Daytona!",
      "package.json": '{"name": "test"}',
    });
    console.log("✅ Files restored successfully");

    // Test command execution
    console.log("Testing command execution...");
    const result = await sandboxInfo.sandbox.process.executeCommand("ls -la");
    console.log("✅ Command executed:", result);

    // Clean up
    console.log("Cleaning up...");
    await deleteSandbox(sandboxInfo.sandbox);
    console.log("✅ Sandbox deleted successfully");

    console.log("🎉 DaytonaSandboxManager tests passed!");
  } catch (error) {
    console.error("❌ DaytonaSandboxManager test failed:", error);
    throw error;
  }
}

// Run the test
testDaytonaSandboxManager().catch(console.error);
