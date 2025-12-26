#!/usr/bin/env tsx
/**
 * Create Playwright Snapshot Script
 *
 * This script creates a reusable Daytona snapshot with Playwright and all necessary
 * dependencies pre-installed for runtime error detection.
 *
 * The snapshot is deployed to both API keys simultaneously for redundancy.
 *
 * Usage:
 *   # Create snapshot with default name
 *   npx tsx scripts/create-playwright-snapshot.ts
 *
 *   # Create snapshot with custom name
 *   npx tsx scripts/create-playwright-snapshot.ts --name=playwright-checker-v2
 *
 * Options:
 *   --name=<name>    Snapshot name (default: playwright-checker-v1)
 *
 * Environment Variables Required:
 *   DAYTONA_API_KEY_1       Primary Daytona API key
 *   DAYTONA_API_KEY_2       Secondary Daytona API key
 */

import { Daytona, Image } from "@daytonaio/sdk";
import * as dotenv from "dotenv";
import { readFileSync } from "fs";
import { join } from "path";

// Load environment variables
dotenv.config();

// Get both API keys from environment
const DAYTONA_API_KEY_1 = process.env.DAYTONA_API_KEY_1;
const DAYTONA_API_KEY_2 = process.env.DAYTONA_API_KEY_2;

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
};

type LogEntry = {
  message: string;
  timestamp: number;
};

type ApiKeyState = {
  status: "pending" | "running" | "success" | "error";
  logs: LogEntry[];
  error?: string;
};

/**
 * Render the TUI
 */
function renderTUI(
  apiKey1State: ApiKeyState,
  apiKey2State: ApiKeyState,
  snapshotName: string,
  isFirstRender: boolean
) {
  // Move cursor to top-left and clear from cursor to end of screen
  if (!isFirstRender) {
    process.stdout.write("\x1b[H\x1b[J");
  }

  // Header
  console.log(
    `${colors.bold}🎭 Playwright Snapshot Creation${colors.reset}`
  );
  console.log(`Snapshot: ${colors.cyan}${snapshotName}${colors.reset}`);
  console.log("");

  // Column headers
  const statusColor1 =
    apiKey1State.status === "success"
      ? colors.green
      : apiKey1State.status === "error"
        ? colors.red
        : apiKey1State.status === "running"
          ? colors.yellow
          : colors.dim;

  const statusColor2 =
    apiKey2State.status === "success"
      ? colors.green
      : apiKey2State.status === "error"
        ? colors.red
        : apiKey2State.status === "running"
          ? colors.yellow
          : colors.dim;

  const colWidth = Math.floor((process.stdout.columns || 80) / 2) - 4;

  console.log(
    `${colors.cyan}${colors.bold}API KEY 1${colors.reset} - ${statusColor1}${apiKey1State.status.toUpperCase()}${colors.reset}`.padEnd(
      colWidth + 20
    ) +
      "│ " +
      `${colors.magenta}${colors.bold}API KEY 2${colors.reset} - ${statusColor2}${apiKey2State.status.toUpperCase()}${colors.reset}`
  );
  console.log("─".repeat(colWidth) + "┼" + "─".repeat(colWidth));

  // Logs (show last 15 lines)
  const maxLines = 15;
  const logs1 = apiKey1State.logs.slice(-maxLines);
  const logs2 = apiKey2State.logs.slice(-maxLines);
  const maxLogCount = Math.max(logs1.length, logs2.length);

  for (let i = 0; i < maxLogCount; i++) {
    const log1 = logs1[i]?.message || "";
    const log2 = logs2[i]?.message || "";

    // Truncate logs to fit column width
    const truncatedLog1 = log1.substring(0, colWidth - 2);
    const truncatedLog2 = log2.substring(0, colWidth - 2);

    console.log(
      `${colors.cyan}${truncatedLog1}${colors.reset}`.padEnd(colWidth + 10) +
        " │ " +
        `${colors.magenta}${truncatedLog2}${colors.reset}`
    );
  }

  console.log("");

  // Errors
  if (apiKey1State.error || apiKey2State.error) {
    console.log("─".repeat(process.stdout.columns || 80));
    if (apiKey1State.error) {
      console.log(
        `${colors.red}API KEY 1 Error: ${apiKey1State.error}${colors.reset}`
      );
    }
    if (apiKey2State.error) {
      console.log(
        `${colors.red}API KEY 2 Error: ${apiKey2State.error}${colors.reset}`
      );
    }
  }

  console.log(
    `${colors.dim}Press Ctrl+C to cancel (snapshots may continue in background)${colors.reset}`
  );
}

/**
 * Create snapshot for a single API key with state updates
 */
async function createSnapshotForApiKey(
  apiKey: string,
  snapshotName: string,
  updateState: (log: string) => void
): Promise<void> {
  try {
    updateState("Initializing Daytona client...");
    const daytona = new Daytona({
      apiKey,
    });

    updateState("Reading playwright-runtime-checker script...");
    const scriptPath = join(
      process.cwd(),
      "src/lib/ai/playwright-runtime-checker.ts"
    );
    const scriptContent = readFileSync(scriptPath, "utf-8");

    // Base64 encode the script content for safe transmission
    const scriptContentBase64 = Buffer.from(scriptContent).toString("base64");

    updateState("Building declarative Playwright image...");

    // Create tsconfig content
    const tsconfigContent = JSON.stringify(
      {
        compilerOptions: {
          target: "ES2020",
          module: "commonjs",
          moduleResolution: "node",
          esModuleInterop: true,
          skipLibCheck: true,
          strict: false,
          resolveJsonModule: true,
          outDir: "./dist",
        },
        include: ["*.ts"],
        exclude: ["node_modules"],
      },
      null,
      2
    );
    const tsconfigBase64 = Buffer.from(tsconfigContent).toString("base64");

    // Create declarative image with all Playwright dependencies
    const image = Image.base("node:22-slim")
      // Install pnpm globally (as root)
      .runCommands("npm install -g pnpm@9")
      // Install Playwright system dependencies as root (requires root for apt-get)
      .runCommands(
        "mkdir -p /tmp/playwright-setup",
        "cd /tmp/playwright-setup && pnpm init && pnpm add playwright@1.48.2"
      )
      // Install ONLY system dependencies for Chromium (not browsers yet)
      .runCommands(
        "cd /tmp/playwright-setup && pnpm exec playwright install-deps chromium"
      )
      // Clean up temporary setup directory
      .runCommands("rm -rf /tmp/playwright-setup")
      // Create daytona user
      .runCommands(
        "groupadd -r daytona && useradd -r -g daytona -m daytona",
        "mkdir -p /home/daytona/playwright-checker",
        "chown -R daytona:daytona /home/daytona"
      )
      .dockerfileCommands(["USER daytona"])
      .workdir("/home/daytona/playwright-checker")
      // Initialize pnpm project as daytona user
      .runCommands("pnpm init")
      // Install Playwright, TypeScript, and @types/node
      .runCommands(
        "pnpm add playwright@1.48.2 typescript@5.7.2 @types/node@22.10.2"
      )
      // Install Chromium browser as daytona user (goes to /home/daytona/.cache/)
      .runCommands("pnpm exec playwright install chromium")
      // Create runtime checker script from base64
      .runCommands(
        `echo '${scriptContentBase64}' | base64 -d > playwright-runtime-checker.ts`
      )
      // Create tsconfig.json from base64
      .runCommands(
        `echo '${tsconfigBase64}' | base64 -d > tsconfig.json`
      )
      // Compile TypeScript
      .runCommands("npx tsc")
      // Set entrypoint to keep container running
      .entrypoint(["sleep", "infinity"]);

    updateState(`Creating snapshot: ${snapshotName}...`);

    await daytona.snapshot.create(
      {
        name: snapshotName,
        image,
        resources: {
          cpu: 1,
          memory: 1,
          disk: 3,
        },
      },
      {
        onLogs: (log) => {
          const cleanLog = log.replace(/^\[.*?\]\s*/, "").trim();
          if (cleanLog) {
            updateState(cleanLog);
          }
        },
      }
    );

    updateState(`✅ Successfully created snapshot: ${snapshotName}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    updateState(`❌ Error: ${errorMessage}`);
    throw error;
  }
}

async function main() {
  // Validate environment variables
  if (!DAYTONA_API_KEY_1 || !DAYTONA_API_KEY_2) {
    console.error(
      "Error: Both DAYTONA_API_KEY_1 and DAYTONA_API_KEY_2 environment variables are required"
    );
    process.exit(1);
  }

  // Parse command-line arguments
  const args = process.argv.slice(2);
  const snapshotNameArg = args.find((arg) => arg.startsWith("--name="));
  const snapshotName =
    snapshotNameArg?.split("=")[1] || "playwright-checker-v1";

  // State for both API keys
  const apiKey1State: ApiKeyState = {
    status: "running",
    logs: [],
  };

  const apiKey2State: ApiKeyState = {
    status: "running",
    logs: [],
  };

  // Track first render
  let isFirstRender = true;

  // Render interval
  const renderInterval = setInterval(() => {
    renderTUI(apiKey1State, apiKey2State, snapshotName, isFirstRender);
    isFirstRender = false;
  }, 100);

  const updateApiKey1 = (message: string) => {
    apiKey1State.logs.push({ message, timestamp: Date.now() });
    // Keep only last 50 logs to prevent memory issues
    if (apiKey1State.logs.length > 50) {
      apiKey1State.logs.shift();
    }
  };

  const updateApiKey2 = (message: string) => {
    apiKey2State.logs.push({ message, timestamp: Date.now() });
    // Keep only last 50 logs to prevent memory issues
    if (apiKey2State.logs.length > 50) {
      apiKey2State.logs.shift();
    }
  };

  // Create snapshots in parallel for both API keys
  const results = await Promise.allSettled([
    createSnapshotForApiKey(DAYTONA_API_KEY_1, snapshotName, updateApiKey1)
      .then(() => {
        apiKey1State.status = "success";
      })
      .catch((err) => {
        apiKey1State.status = "error";
        apiKey1State.error = err.message;
        throw err;
      }),
    createSnapshotForApiKey(DAYTONA_API_KEY_2, snapshotName, updateApiKey2)
      .then(() => {
        apiKey2State.status = "success";
      })
      .catch((err) => {
        apiKey2State.status = "error";
        apiKey2State.error = err.message;
        throw err;
      }),
  ]);

  // Clear interval and render final state
  clearInterval(renderInterval);
  renderTUI(apiKey1State, apiKey2State, snapshotName, false);

  // Print summary
  console.log("\n📊 Summary:");
  console.log("=".repeat(80));

  results.forEach((result, index) => {
    const apiKeyName = index === 0 ? "API_KEY_1" : "API_KEY_2";
    if (result.status === "fulfilled") {
      console.log(`✅ ${apiKeyName}: Success`);
    } else {
      console.log(`❌ ${apiKeyName}: Failed - ${result.reason}`);
    }
  });

  console.log("\nThe Playwright snapshot includes:");
  console.log("  • Node.js 22 (slim)");
  console.log("  • Playwright 1.48.2 with Chromium browser");
  console.log("  • TypeScript 5.7.2 and @types/node");
  console.log("  • Pre-compiled playwright-runtime-checker.js");
  console.log("  • All system dependencies for headless Chromium");
  console.log("  • Proper user permissions configured");
  console.log(
    `\n💡 Use this snapshot by passing: snapshot: "${snapshotName}" to daytona.create()`
  );

  // Exit with error if any failed
  const anyFailed = results.some((result) => result.status === "rejected");
  if (anyFailed) {
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("\n❌ Failed to create Playwright snapshots:");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
