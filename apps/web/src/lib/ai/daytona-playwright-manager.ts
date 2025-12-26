/**
 * Daytona Playwright Sandbox Manager
 *
 * This file manages a dedicated Daytona sandbox for running Playwright runtime checks.
 * The sandbox is reused across multiple checks to avoid creation overhead.
 *
 * ## Architecture: Declarative Snapshot Approach
 *
 * This manager uses Daytona's declarative builder to create a pre-built snapshot with
 * all Playwright dependencies installed. This provides significant benefits over the
 * previous imperative approach:
 *
 * **Benefits:**
 * - ⚡ Faster sandbox creation (~3s vs ~30s)
 * - 🛡️ More reliable (no network/installation failures during runtime)
 * - 📦 Version control (snapshot names track versions)
 * - 🔄 Consistent environment (exact same setup every time)
 * - 💾 Lower resource usage (no repeated installations)
 *
 * **Snapshot Contents:**
 * - Node.js 22 (slim)
 * - Playwright 1.48.2 with Chromium browser
 * - TypeScript 5.7.2 and @types/node
 * - Pre-compiled playwright-runtime-checker.js
 * - All system dependencies for headless Chromium
 *
 * **Creating/Updating the Snapshot:**
 * ```bash
 * npx tsx scripts/create-playwright-snapshot.ts
 * npx tsx scripts/create-playwright-snapshot.ts --name=playwright-checker-v2
 * ```
 *
 * **Version Management:**
 * To update to a new snapshot version, change PLAYWRIGHT_SNAPSHOT_NAME below.
 */

import { Daytona, Sandbox } from "@daytonaio/sdk";
import { runCommandOnSandbox } from "./sandbox-compat";
import { spawn } from "node:child_process";
import * as path from "node:path";

const daytona = new Daytona({
  apiKey: process.env.DAYTONA_API_KEY!,
  target: "us",
});

// Snapshot name for Playwright checker environment
const PLAYWRIGHT_SNAPSHOT_NAME = "playwright-checker-v1";

// Singleton Playwright sandbox instance
let playwrightSandbox: Sandbox | null = null;
let sandboxInitialized = false;

interface RuntimeError {
  id: string;
  type: "RUNTIME";
  message: string;
  url: string; // file path
  line: number;
  column: number;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  autoFixable: boolean;
  details: {
    errorType: string;
    timestamp: string;
    stack?: string;
    file: string;
  };
}

interface PlaywrightCheckResult {
  success: boolean;
  errors: RuntimeError[];
  totalErrors: number;
  timestamp: string;
  error?: string;
}

/**
 * Get or create the Playwright sandbox using the pre-built snapshot
 */
async function getOrCreatePlaywrightSandbox(): Promise<Sandbox> {
  if (playwrightSandbox && sandboxInitialized) {
    console.log("[PlaywrightManager] Checking existing Playwright sandbox...");
    const sandboxId = playwrightSandbox.id;

    try {
      // Re-fetch the sandbox to get the latest state
      const freshSandbox = await daytona.findOne({ id: sandboxId });

      if (!freshSandbox) {
        console.log(
          `[PlaywrightManager] Sandbox ${sandboxId} no longer exists`,
        );
        playwrightSandbox = null;
        sandboxInitialized = false;
        // Fall through to create new
      } else {
        // Update our reference with the fresh instance
        playwrightSandbox = freshSandbox;
        console.log(`[PlaywrightManager] Sandbox state: ${freshSandbox.state}`);

        // Verify the sandbox is accessible
        try {
          await playwrightSandbox.fs.listFiles("/home/daytona");
          console.log(
            "[PlaywrightManager] Reusing existing Playwright sandbox",
          );
          return playwrightSandbox;
        } catch (accessError) {
          const errorMsg =
            accessError instanceof Error
              ? accessError.message
              : String(accessError);
          console.log(
            `[PlaywrightManager] Sandbox not accessible: ${errorMsg}`,
          );

          // Check if sandbox is stopped and can be restarted
          // Common error messages when sandbox is not running
          const isRecoverableError =
            errorMsg.toLowerCase().includes("not running") ||
            errorMsg.toLowerCase().includes("no ip address") ||
            errorMsg.toLowerCase().includes("connection refused");

          if (isRecoverableError) {
            console.log(
              "[PlaywrightManager] Attempting to start existing sandbox...",
            );

            try {
              await playwrightSandbox.start();
              console.log(
                "[PlaywrightManager] Successfully started existing sandbox",
              );

              // Wait for sandbox to fully initialize
              await new Promise((resolve) => setTimeout(resolve, 3000));

              // Verify it's now accessible
              await playwrightSandbox.fs.listFiles("/home/daytona");
              console.log("[PlaywrightManager] Sandbox is now accessible");
              return playwrightSandbox;
            } catch (startError) {
              console.warn(
                "[PlaywrightManager] Failed to start existing sandbox:",
                startError,
              );
              // Fall through to create a new one
            }
          }

          // If we can't reuse or restart, reset and create new
          console.log("[PlaywrightManager] Will create new sandbox");
          playwrightSandbox = null;
          sandboxInitialized = false;
        }
      }
    } catch (findError) {
      console.warn(
        "[PlaywrightManager] Failed to fetch existing sandbox:",
        findError,
      );
      playwrightSandbox = null;
      sandboxInitialized = false;
      // Fall through to create new
    }
  }

  console.log(
    `[PlaywrightManager] Creating new Playwright sandbox from snapshot: ${PLAYWRIGHT_SNAPSHOT_NAME}`,
  );

  try {
    // Create a new sandbox from the pre-built Playwright snapshot
    playwrightSandbox = await daytona.create({
      snapshot: PLAYWRIGHT_SNAPSHOT_NAME,
      autoDeleteInterval: 15, // Auto-delete after 30 minutes of being created
      public: false,
      networkAllowList: "188.114.96.3/32,188.114.97.3/32",
    });

    console.log(`[PlaywrightManager] Created sandbox: ${playwrightSandbox.id}`);
    console.log(
      "[PlaywrightManager] Sandbox ready with pre-installed Playwright environment",
    );

    sandboxInitialized = true;
    return playwrightSandbox;
  } catch (error) {
    console.error("[PlaywrightManager] Error creating sandbox:", error);
    throw new Error(
      `Failed to create Playwright sandbox. Ensure the snapshot "${PLAYWRIGHT_SNAPSHOT_NAME}" exists. ` +
        `Run: npx tsx scripts/create-playwright-snapshot.ts`,
    );
  }
}

/**
 * Run Playwright locally (for development mode with localhost URLs)
 *
 * @param targetUrl - URL to check (should be localhost in dev)
 * @param maxRetries - Number of retry attempts
 */
async function runLocalPlaywrightCheck(
  targetUrl: string,
  maxRetries: number = 3,
): Promise<PlaywrightCheckResult> {
  return new Promise((resolve) => {
    console.log(
      `[PlaywrightManager] Running Playwright locally for: ${targetUrl}`,
    );

    // Path to the playwright runtime checker script
    const scriptPath = path.join(
      process.cwd(),
      "src",
      "lib",
      "ai",
      "playwright-runtime-checker.ts",
    );

    console.log(`[PlaywrightManager] Script path: ${scriptPath}`);

    // Run the script using npx tsx
    const args = [scriptPath, targetUrl, maxRetries.toString(), "{}"];
    console.log(`[PlaywrightManager] Running: npx tsx ${args.join(" ")}`);

    const child = spawn("npx", ["tsx", ...args], {
      cwd: process.cwd(),
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      const output = data.toString();
      stdout += output;
      console.log(`[Playwright Local] ${output.trim()}`);
    });

    child.stderr?.on("data", (data) => {
      const output = data.toString();
      stderr += output;
      console.error(`[Playwright Local Error] ${output.trim()}`);
    });

    child.on("close", (code) => {
      console.log(
        `[PlaywrightManager] Local Playwright check completed with code ${code}`,
      );

      try {
        // Parse the JSON output from the script
        const resultsMarker = "=== RESULTS ===";
        const resultsIndex = stdout.indexOf(resultsMarker);

        if (resultsIndex === -1) {
          console.error(
            "[PlaywrightManager] Could not find results marker in output",
          );
          console.error("[PlaywrightManager] Full output:", stdout);
          resolve({
            success: false,
            errors: [],
            totalErrors: 0,
            timestamp: new Date().toISOString(),
            error: "Could not find results marker in Playwright output",
          });
          return;
        }

        const jsonOutput = stdout
          .substring(resultsIndex + resultsMarker.length)
          .trim();
        const parsedResult: PlaywrightCheckResult = JSON.parse(jsonOutput);

        if (!parsedResult.success) {
          console.error(
            `[PlaywrightManager] Playwright check failed: ${parsedResult.error}`,
          );
        } else {
          console.log(
            `[PlaywrightManager] Found ${parsedResult.totalErrors} runtime errors`,
          );
        }

        resolve(parsedResult);
      } catch (error) {
        console.error(
          "[PlaywrightManager] Error parsing Playwright output:",
          error,
        );
        resolve({
          success: false,
          errors: [],
          totalErrors: 0,
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    child.on("error", (error) => {
      console.error(
        "[PlaywrightManager] Error spawning Playwright process:",
        error,
      );
      resolve({
        success: false,
        errors: [],
        totalErrors: 0,
        timestamp: new Date().toISOString(),
        error: error.message,
      });
    });
  });
}

/**
 * Run Playwright runtime checks on a target URL
 *
 * @param targetUrl - URL to check (localhost URLs run locally in dev, others run in remote sandbox)
 * @param targetSandbox - Unused (kept for backward compatibility)
 * @param maxRetries - Number of retry attempts
 */
export async function runPlaywrightRuntimeCheck(
  targetUrl: string,
  targetSandbox?: Sandbox,
  maxRetries: number = 3,
): Promise<PlaywrightCheckResult> {
  try {
    console.log(`[PlaywrightManager] Running runtime check for: ${targetUrl}`);

    // Check if the URL is localhost - if so, run locally in dev mode
    const isLocalhost =
      targetUrl.includes("localhost") || targetUrl.includes("127.0.0.1");

    if (isLocalhost && process.env.NODE_ENV !== "production") {
      console.log(
        `[PlaywrightManager] Detected localhost URL in dev mode - running Playwright locally`,
      );
      return await runLocalPlaywrightCheck(targetUrl, maxRetries);
    }

    // For non-localhost URLs, run in remote Daytona sandbox
    console.log(
      `[PlaywrightManager] Running Playwright in remote sandbox for: ${targetUrl}`,
    );

    const sandbox = await getOrCreatePlaywrightSandbox();

    // Execute the Playwright checker script
    console.log("[PlaywrightManager] Executing Playwright checker...");

    // No auth headers needed - the URL should be publicly accessible
    const authHeadersJson = JSON.stringify({});

    const result = await runCommandOnSandbox(
      sandbox,
      `cd /home/daytona/playwright-checker && node dist/playwright-runtime-checker.js "${targetUrl}" ${maxRetries} '${authHeadersJson}'`,
      {
        onStdout: (line) => console.log(`[Playwright] ${line}`),
        onStderr: (line) => console.error(`[Playwright Error] ${line}`),
      },
    );

    console.log("[PlaywrightManager] Playwright check complete");

    // Parse the JSON output from the script
    // The script outputs "=== RESULTS ===" followed by the JSON
    // Daytona may put output in stdout, result, or output fields
    const stdout = result.stdout || result.result || result.output || "";
    const resultsMarker = "=== RESULTS ===";
    const resultsIndex = stdout.indexOf(resultsMarker);

    if (resultsIndex === -1) {
      console.error(
        "[PlaywrightManager] Could not find results marker in output",
      );
      console.error("[PlaywrightManager] Full output:", stdout);
      throw new Error("Could not find results marker in Playwright output");
    }

    const jsonOutput = stdout
      .substring(resultsIndex + resultsMarker.length)
      .trim();
    const parsedResult: PlaywrightCheckResult = JSON.parse(jsonOutput);

    if (!parsedResult.success) {
      console.error(
        `[PlaywrightManager] Playwright check failed: ${parsedResult.error}`,
      );
    } else {
      console.log(
        `[PlaywrightManager] Found ${parsedResult.totalErrors} runtime errors`,
      );
    }

    return parsedResult;
  } catch (error) {
    console.error("[PlaywrightManager] Error running Playwright check:", error);

    return {
      success: false,
      errors: [],
      totalErrors: 0,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Cleanup the Playwright sandbox
 */
export async function cleanupPlaywrightSandbox(): Promise<void> {
  if (playwrightSandbox) {
    try {
      console.log("[PlaywrightManager] Stopping Playwright sandbox...");
      await playwrightSandbox.stop();
      playwrightSandbox = null;
      sandboxInitialized = false;
      console.log("[PlaywrightManager] Playwright sandbox stopped");
    } catch (error) {
      console.error(
        "[PlaywrightManager] Error stopping Playwright sandbox:",
        error,
      );
    }
  }
}

/**
 * Get the current Playwright sandbox status
 */
export async function getPlaywrightSandboxStatus(): Promise<{
  exists: boolean;
  initialized: boolean;
  id?: string;
}> {
  if (!playwrightSandbox) {
    return { exists: false, initialized: false };
  }

  return {
    exists: true,
    initialized: sandboxInitialized,
    id: playwrightSandbox.id,
  };
}
