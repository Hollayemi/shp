#!/usr/bin/env node

import { VoltAgentService } from "../src/lib/voltagent-service";
import { spawn } from "child_process";
import { watch } from "fs";
import { join } from "path";

const voltAgentService = new VoltAgentService();

async function startVoltAgentDev() {
  console.log("🚀 Starting VoltAgent Development Environment");

  // Start VoltAgent error monitoring
  await voltAgentService.startErrorMonitoring();

  // Watch for changes in errors.txt
  const errorLogPath = join(process.cwd(), "errors.txt");

  if (require("fs").existsSync(errorLogPath)) {
    console.log("👀 Watching errors.txt for changes...");

    watch(errorLogPath, async (eventType) => {
      if (eventType === "change") {
        console.log("📝 Error log changed, running VoltAgent workflow...");
        await voltAgentService.runWorkflow();
      }
    });
  }

  // Start Next.js development server
  console.log("🔧 Starting Next.js development server...");

  const nextDev = spawn("pnpm", ["dev"], {
    stdio: "inherit",
    shell: true,
  });

  nextDev.on("error", (error) => {
    console.error("❌ Failed to start Next.js dev server:", error);
  });

  nextDev.on("close", (code) => {
    console.log(`📊 Next.js dev server exited with code ${code}`);
  });

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n🛑 Shutting down VoltAgent development environment...");
    nextDev.kill();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.log("\n🛑 Shutting down VoltAgent development environment...");
    nextDev.kill();
    process.exit(0);
  });
}

// Run the development environment
startVoltAgentDev().catch((error) => {
  console.error("❌ Failed to start VoltAgent development environment:", error);
  process.exit(1);
});
