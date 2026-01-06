#!/usr/bin/env tsx
/**
 * Delete Daytona Snapshot Script
 *
 * This script safely deletes Daytona snapshots from both API keys with interactive
 * selection and multiple confirmation steps to prevent accidental deletions.
 *
 * Usage:
 *   # Interactive deletion
 *   npx tsx scripts/delete-daytona-snapshot.ts
 *
 *   # Dry run - shows what would be deleted without actually deleting
 *   npx tsx scripts/delete-daytona-snapshot.ts --dry-run
 *
 * Options:
 *   --dry-run    Show what would be deleted without actually deleting
 *
 * Environment Variables Required:
 *   DAYTONA_API_KEY_1       Primary Daytona API key
 *   DAYTONA_API_KEY_2       Secondary Daytona API key
 */

import { Daytona } from "@daytonaio/sdk";
import * as dotenv from "dotenv";
import * as readline from "readline";

// Load environment variables from project root
dotenv.config({ path: "../../.env" });

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

type SnapshotInfo = {
  name: string;
  status: string;
  createdAt?: string;
  resources?: {
    cpu: number;
    memory: number;
    disk: number;
  };
};

/**
 * Format snapshot name to human-readable format
 */
function formatSnapshotName(snapshotName: string): string {
  // Convert vite-calculator-template-v3 -> Calculator Template v3
  return snapshotName
    .replace(/^vite-/, "")
    .replace(/-template$/, "")
    .split("-")
    .map((word, index) => {
      // Handle version numbers (v3, v4, etc.)
      if (word.match(/^v\d+$/)) {
        return word.toUpperCase();
      }
      // Capitalize first letter of each word
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

/**
 * List snapshots from both API keys and merge them
 */
async function listSnapshotsForBothKeys(): Promise<{
  snapshots: SnapshotInfo[];
  apiKey1Snapshots: SnapshotInfo[];
  apiKey2Snapshots: SnapshotInfo[];
}> {
  const daytona1 = new Daytona({ apiKey: DAYTONA_API_KEY_1! });
  const daytona2 = new Daytona({ apiKey: DAYTONA_API_KEY_2! });

  const [response1, response2] = await Promise.all([
    daytona1.snapshot.list(),
    daytona2.snapshot.list(),
  ]);

  // Handle different response formats - suppress TypeScript errors for SDK compatibility
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const snapshots1 = Array.isArray(response1)
    ? response1
    : (response1 as any)?.items ||
      (response1 as any)?.snapshots ||
      (response1 as any)?.data ||
      [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const snapshots2 = Array.isArray(response2)
    ? response2
    : (response2 as any)?.items ||
      (response2 as any)?.snapshots ||
      (response2 as any)?.data ||
      [];

  // Merge snapshots, preferring data from API key 1 if duplicates exist
  const snapshotMap = new Map<string, SnapshotInfo>();

  snapshots2.forEach((snapshot: any) => {
    snapshotMap.set(snapshot.name, {
      name: snapshot.name,
      status: snapshot.status || "Unknown",
      createdAt: snapshot.createdAt,
      resources: snapshot.resources,
    });
  });

  snapshots1.forEach((snapshot: any) => {
    snapshotMap.set(snapshot.name, {
      name: snapshot.name,
      status: snapshot.status || "Unknown",
      createdAt: snapshot.createdAt,
      resources: snapshot.resources,
    });
  });

  return {
    snapshots: Array.from(snapshotMap.values()),
    apiKey1Snapshots: snapshots1,
    apiKey2Snapshots: snapshots2,
  };
}

/**
 * Interactive snapshot selection menu
 */
async function selectSnapshotToDelete(
  snapshots: SnapshotInfo[],
): Promise<SnapshotInfo> {
  if (snapshots.length === 0) {
    throw new Error("No snapshots found to delete");
  }

  console.log(`\n${colors.bold}Available snapshots:${colors.reset}`);
  snapshots.forEach((snapshot, index) => {
    const readableName = formatSnapshotName(snapshot.name);
    const statusColor =
      snapshot.status === "ready"
        ? colors.green
        : snapshot.status === "creating"
          ? colors.yellow
          : snapshot.status === "error"
            ? colors.red
            : colors.dim;

    console.log(
      `${colors.cyan}${index + 1}.${colors.reset} ${readableName} ${colors.dim}(${snapshot.name})${colors.reset} - ${statusColor}${snapshot.status}${colors.reset}`,
    );
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve, reject) => {
    rl.question(
      `\n${colors.yellow}Select a snapshot to delete (1-${snapshots.length}): ${colors.reset}`,
      (answer) => {
        rl.close();

        const selection = parseInt(answer.trim());

        if (isNaN(selection) || selection < 1 || selection > snapshots.length) {
          reject(new Error("Invalid selection"));
          return;
        }

        const selectedSnapshot = snapshots[selection - 1];
        const readableName = formatSnapshotName(selectedSnapshot.name);

        console.log(
          `${colors.green}Selected snapshot: ${readableName}${colors.reset}\n`,
        );
        resolve(selectedSnapshot);
      },
    );
  });
}

/**
 * Double confirmation flow
 */
async function confirmDeletion(snapshot: SnapshotInfo): Promise<boolean> {
  const readableName = formatSnapshotName(snapshot.name);

  console.log(
    `${colors.red}${colors.bold}⚠️  WARNING: You are about to delete: ${readableName}${colors.reset}`,
  );
  console.log(`${colors.dim}Snapshot name: ${snapshot.name}${colors.reset}`);
  console.log(
    `${colors.red}This will delete from BOTH API keys${colors.reset}`,
  );

  if (snapshot.status) {
    console.log(`${colors.dim}Status: ${snapshot.status}${colors.reset}`);
  }

  if (snapshot.createdAt) {
    console.log(
      `${colors.dim}Created: ${new Date(snapshot.createdAt).toLocaleString()}${colors.reset}`,
    );
  }

  console.log("");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // First confirmation: yes/no
  const firstConfirm = await new Promise<string>((resolve) => {
    rl.question(
      `${colors.yellow}Are you sure you want to delete this snapshot? (yes/no): ${colors.reset}`,
      (answer) => {
        resolve(answer.trim().toLowerCase());
      },
    );
  });

  if (firstConfirm !== "yes") {
    rl.close();
    console.log(`${colors.green}Deletion cancelled.${colors.reset}`);
    return false;
  }

  // Second confirmation: type exact name
  const secondConfirm = await new Promise<string>((resolve) => {
    rl.question(
      `${colors.red}Type the snapshot name exactly to confirm: ${colors.reset}`,
      (answer) => {
        resolve(answer.trim());
      },
    );
  });

  rl.close();

  if (secondConfirm !== snapshot.name) {
    console.log(
      `${colors.red}Name mismatch. Deletion cancelled.${colors.reset}`,
    );
    console.log(`${colors.dim}Expected: ${snapshot.name}${colors.reset}`);
    console.log(`${colors.dim}Received: ${secondConfirm}${colors.reset}`);
    return false;
  }

  console.log(
    `${colors.green}Confirmation successful. Proceeding with deletion...${colors.reset}\n`,
  );
  return true;
}

/**
 * Delete snapshot for a single API key with state updates
 */
async function deleteSnapshotForApiKey(
  apiKey: string,
  apiKeyName: string,
  snapshotName: string,
  updateState: (log: string) => void,
  dryRun: boolean = false,
): Promise<void> {
  try {
    updateState("Initializing Daytona client...");

    if (dryRun) {
      updateState(`[DRY RUN] Would get snapshot: ${snapshotName}...`);
      await new Promise((resolve) => setTimeout(resolve, 500));
      updateState(`[DRY RUN] Would delete snapshot: ${snapshotName}...`);
      // Simulate delay for realistic dry run experience
      await new Promise((resolve) => setTimeout(resolve, 1000));
      updateState(
        `[DRY RUN] ✅ Would successfully delete snapshot: ${snapshotName}`,
      );
      return;
    }

    const daytona = new Daytona({ apiKey });

    updateState(`Getting snapshot: ${snapshotName}...`);

    // First get the snapshot object by name
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const snapshot = await daytona.snapshot.get(snapshotName as any);

    updateState(`Deleting snapshot: ${snapshotName}...`);

    // Now delete using the snapshot object
    await daytona.snapshot.delete(snapshot);

    updateState(`✅ Successfully deleted snapshot: ${snapshotName}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    updateState(`❌ Error: ${errorMessage}`);
    throw error;
  }
}

/**
 * Render the TUI for deletion progress
 */
function renderTUI(
  apiKey1State: ApiKeyState,
  apiKey2State: ApiKeyState,
  snapshotName: string,
  isFirstRender: boolean,
  dryRun: boolean = false,
) {
  // Move cursor to top-left and clear from cursor to end of screen
  if (!isFirstRender) {
    process.stdout.write("\x1b[H\x1b[J");
  }

  // Header
  const headerText = dryRun
    ? "🔍 Daytona Snapshot Deletion (DRY RUN)"
    : "🗑️  Daytona Snapshot Deletion";
  console.log(`${colors.bold}${headerText}${colors.reset}`);
  console.log(
    `Snapshot: ${colors.cyan}${formatSnapshotName(snapshotName)}${colors.reset}`,
  );
  console.log(`Technical name: ${colors.dim}${snapshotName}${colors.reset}`);

  if (dryRun) {
    console.log(
      `${colors.yellow}${colors.bold}⚠️  DRY RUN MODE - No actual deletions will occur${colors.reset}`,
    );
  }

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
      colWidth + 20,
    ) +
      "│ " +
      `${colors.magenta}${colors.bold}API KEY 2${colors.reset} - ${statusColor2}${apiKey2State.status.toUpperCase()}${colors.reset}`,
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
        `${colors.magenta}${truncatedLog2}${colors.reset}`,
    );
  }

  console.log("");

  // Errors
  if (apiKey1State.error || apiKey2State.error) {
    console.log("─".repeat(process.stdout.columns || 80));
    if (apiKey1State.error) {
      console.log(
        `${colors.red}API KEY 1 Error: ${apiKey1State.error}${colors.reset}`,
      );
    }
    if (apiKey2State.error) {
      console.log(
        `${colors.red}API KEY 2 Error: ${apiKey2State.error}${colors.reset}`,
      );
    }
  }

  console.log(
    `${colors.dim}Press Ctrl+C to cancel (deletion may continue in background)${colors.reset}`,
  );
}

async function main() {
  // Parse command-line arguments
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  // Validate environment variables
  if (!DAYTONA_API_KEY_1 || !DAYTONA_API_KEY_2) {
    console.error(
      "Error: Both DAYTONA_API_KEY_1 and DAYTONA_API_KEY_2 environment variables are required",
    );
    process.exit(1);
  }

  try {
    const fetchMessage = dryRun
      ? `${colors.bold}🔍 [DRY RUN] Fetching snapshots from both API keys...${colors.reset}`
      : `${colors.bold}🔍 Fetching snapshots from both API keys...${colors.reset}`;

    console.log(fetchMessage);

    // List snapshots from both API keys
    const { snapshots, apiKey1Snapshots, apiKey2Snapshots } =
      await listSnapshotsForBothKeys();

    if (snapshots.length === 0) {
      console.log(
        `${colors.yellow}No snapshots found to delete.${colors.reset}`,
      );
      return;
    }

    console.log(
      `${colors.green}Found ${snapshots.length} snapshot(s) across both API keys${colors.reset}`,
    );

    // Interactive selection
    const selectedSnapshot = await selectSnapshotToDelete(snapshots);

    // Double confirmation (skip in dry run mode)
    if (!dryRun) {
      const confirmed = await confirmDeletion(selectedSnapshot);
      if (!confirmed) {
        return;
      }
    } else {
      console.log(
        `${colors.yellow}[DRY RUN] Skipping confirmation prompts${colors.reset}\n`,
      );
    }

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
      renderTUI(
        apiKey1State,
        apiKey2State,
        selectedSnapshot.name,
        isFirstRender,
        dryRun,
      );
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

    // Delete snapshots in parallel for both API keys
    const results = await Promise.allSettled([
      deleteSnapshotForApiKey(
        DAYTONA_API_KEY_1,
        "API_KEY_1",
        selectedSnapshot.name,
        updateApiKey1,
        dryRun,
      )
        .then(() => {
          apiKey1State.status = "success";
        })
        .catch((err) => {
          apiKey1State.status = "error";
          apiKey1State.error = err.message;
          throw err;
        }),
      deleteSnapshotForApiKey(
        DAYTONA_API_KEY_2,
        "API_KEY_2",
        selectedSnapshot.name,
        updateApiKey2,
        dryRun,
      )
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
    renderTUI(apiKey1State, apiKey2State, selectedSnapshot.name, false, dryRun);

    // Print summary
    const summaryTitle = dryRun ? "📊 Dry Run Summary:" : "📊 Summary:";
    console.log(`\n${summaryTitle}`);
    console.log("=".repeat(80));

    results.forEach((result, index) => {
      const apiKeyName = index === 0 ? "API_KEY_1" : "API_KEY_2";
      if (result.status === "fulfilled") {
        const successMessage = dryRun ? "Would succeed" : "Success";
        console.log(`✅ ${apiKeyName}: ${successMessage}`);
      } else {
        console.log(`❌ ${apiKeyName}: Failed - ${result.reason}`);
      }
    });

    const readableName = formatSnapshotName(selectedSnapshot.name);
    const finalMessage = dryRun
      ? `Snapshot "${readableName}" dry run completed. No actual deletions occurred.`
      : `Snapshot "${readableName}" deletion completed.`;

    console.log(`\n${finalMessage}`);

    // Exit with error if any failed
    const anyFailed = results.some((result) => result.status === "rejected");
    if (anyFailed) {
      process.exit(1);
    }
  } catch (error) {
    console.error(`${colors.red}❌ Error:${colors.reset}`);
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("\n❌ Failed to delete Daytona snapshot:");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
