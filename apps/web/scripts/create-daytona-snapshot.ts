#!/usr/bin/env tsx
/**
 * Create Daytona Snapshot Script
 *
 * This script creates a reusable Daytona snapshot with a specified template repository
 * and all necessary dependencies pre-installed. The script clones a specific branch,
 * removes the existing git history, and initializes a fresh git repository as 'main'.
 *
 * The snapshot is deployed to both API keys simultaneously for redundancy.
 *
 * Usage:
 *   # Create snapshot with interactive template selection
 *   npx tsx scripts/create-daytona-snapshot.ts
 *
 *   # Create snapshot from a specific template (skip interactive menu)
 *   npx tsx scripts/create-daytona-snapshot.ts --branch=calculator-template
 *
 *   # Create snapshot with version (auto-generates name from template)
 *   npx tsx scripts/create-daytona-snapshot.ts --branch=content-sharing-template --version=v3
 *
 *   # Use a different repository
 *   npx tsx scripts/create-daytona-snapshot.ts --repo=https://github.com/org/repo --branch=develop --version=v2
 *
 * Options:
 *   --branch=<name>   Template branch to use (if not specified, shows interactive menu)
 *   --name=<name>     Custom snapshot name (default: auto-generated from template)
 *   --version=<ver>   Version suffix to append (e.g., v3, 1.0, beta)
 *   --repo=<url>      Repository URL (default: https://github.com/Shipper-dot-now/vite-template)
 *
 * Environment Variables Required:
 *   DAYTONA_API_KEY_1       Primary Daytona API key
 *   DAYTONA_API_KEY_2       Secondary Daytona API key
 *   GITHUB_APP_ID           GitHub App ID for authentication
 *   GITHUB_APP_PRIVATE_KEY  GitHub App private key
 */

import { Daytona, Image } from "@daytonaio/sdk";
import * as crypto from "crypto";
import * as dotenv from "dotenv";
import * as readline from "readline";

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
 * Generate JWT for GitHub App authentication
 */
function generateGitHubAppJWT(appId: string, privateKey: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now - 60,
    exp: now + 540,
    iss: appId,
  };

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString(
    "base64url",
  );
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );

  const message = `${encodedHeader}.${encodedPayload}`;

  const sign = crypto.createSign("RSA-SHA256");
  sign.update(message);
  const signature = sign.sign(privateKey.replace(/\\n/g, "\n"), "base64url");

  return `${message}.${signature}`;
}

/**
 * Get GitHub App installation token for a repository
 */
async function getGitHubAppInstallationToken(repoUrl: string): Promise<string> {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

  if (!appId || !privateKey) {
    throw new Error("GitHub App credentials not configured");
  }

  const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+?)(\.git)?$/);
  if (!match) {
    throw new Error("Invalid GitHub repository URL");
  }
  const [, owner, repo] = match;

  const jwt = generateGitHubAppJWT(appId, privateKey);

  const installResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/installation`,
    {
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github.v3+json",
      },
    },
  );

  if (!installResponse.ok) {
    const errorText = await installResponse.text();
    throw new Error(
      `Failed to get installation for ${owner}/${repo}: ${installResponse.status} ${installResponse.statusText} - ${errorText}`,
    );
  }

  const installData = (await installResponse.json()) as { id: number };
  const installationId = installData.id;

  const tokenResponse = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github.v3+json",
      },
    },
  );

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(
      `Failed to get installation token: ${tokenResponse.status} ${tokenResponse.statusText} - ${errorText}`,
    );
  }

  const tokenData = (await tokenResponse.json()) as { token: string };
  return tokenData.token;
}

/**
 * Get all branches from a GitHub repository
 */
async function getRepositoryBranches(repoUrl: string): Promise<string[]> {
  const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+?)(\.git)?$/);
  if (!match) {
    throw new Error("Invalid GitHub repository URL");
  }
  const [, owner, repo] = match;

  const token = await getGitHubAppInstallationToken(repoUrl);

  const branchesResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/branches`,
    {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    },
  );

  if (!branchesResponse.ok) {
    const errorText = await branchesResponse.text();
    throw new Error(
      `Failed to get branches for ${owner}/${repo}: ${branchesResponse.status} ${branchesResponse.statusText} - ${errorText}`,
    );
  }

  const branchesData = (await branchesResponse.json()) as Array<{
    name: string;
  }>;
  return branchesData
    .map((branch) => branch.name)
    .filter((name) => name !== "dev");
}

/**
 * Interactive template selection menu
 */
async function selectBranch(
  repoUrl: string,
  version?: string,
): Promise<string> {
  console.log(`${colors.cyan}Fetching available templates...${colors.reset}`);

  const branches = await getRepositoryBranches(repoUrl);

  if (branches.length === 0) {
    throw new Error("No templates found (excluding dev)");
  }

  console.log(`\n${colors.bold}Available templates:${colors.reset}`);
  branches.forEach((branch, index) => {
    // Convert branch name to readable template name
    const templateName = branch
      .replace(/-template$/, "")
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    // Generate the snapshot name that will be created
    const baseName = branch === "main" ? "vite-template" : `vite-${branch}`;
    const snapshotName = version ? `${baseName}-${version}` : baseName;

    console.log(
      `${colors.cyan}${index + 1}.${colors.reset} ${templateName} ${colors.dim}→ ${colors.green}${snapshotName}${colors.reset}`,
    );
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve, reject) => {
    rl.question(
      `\n${colors.yellow}Select a template (1-${branches.length}): ${colors.reset}`,
      (answer) => {
        rl.close();

        const selection = parseInt(answer.trim());

        if (isNaN(selection) || selection < 1 || selection > branches.length) {
          reject(new Error("Invalid selection"));
          return;
        }

        const selectedBranch = branches[selection - 1];
        const templateName = selectedBranch
          .replace(/-template$/, "")
          .split("-")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");

        const baseName =
          selectedBranch === "main"
            ? "vite-template"
            : `vite-${selectedBranch}`;
        const snapshotName = version ? `${baseName}-${version}` : baseName;

        console.log(
          `${colors.green}Selected template: ${templateName} → ${snapshotName}${colors.reset}\n`,
        );
        resolve(selectedBranch);
      },
    );
  });
}

/**
 * Render the TUI
 */
function renderTUI(
  apiKey1State: ApiKeyState,
  apiKey2State: ApiKeyState,
  config: { snapshotName: string; branch: string; repoUrl: string },
  isFirstRender: boolean,
) {
  // Move cursor to top-left and clear from cursor to end of screen
  if (!isFirstRender) {
    process.stdout.write("\x1b[H\x1b[J");
  }

  // Header
  console.log(`${colors.bold}🚀 Daytona Snapshot Creation${colors.reset}`);
  console.log(`Snapshot: ${colors.cyan}${config.snapshotName}${colors.reset}`);
  console.log(`Repository: ${colors.cyan}${config.repoUrl}${colors.reset}`);
  console.log(`Branch: ${colors.cyan}${config.branch}${colors.reset}`);
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
    `${colors.dim}Press Ctrl+C to cancel (snapshots may continue in background)${colors.reset}`,
  );
}

/**
 * Create snapshot for a single API key with state updates
 */
async function createSnapshotForApiKey(
  apiKey: string,
  apiKeyName: string,
  options: {
    snapshotName: string;
    branch?: string;
    repoUrl?: string;
  },
  updateState: (log: string) => void,
): Promise<void> {
  const {
    snapshotName,
    branch = "main",
    repoUrl = "https://github.com/Shipper-dot-now/vite-template",
  } = options;

  try {
    updateState("Initializing Daytona client...");
    const daytona = new Daytona({
      apiKey,
    });

    updateState("Getting GitHub App installation token...");
    const token = await getGitHubAppInstallationToken(repoUrl);

    const authenticatedUrl = repoUrl.replace(
      "https://",
      `https://x-access-token:${token}@`,
    );

    updateState("Building Docker image...");
    const image = Image.base("oven/bun:1")
      .runCommands("apt-get update && apt-get install -y git zip curl")
      .runCommands(
        "groupadd -r daytona && useradd -r -g daytona -m daytona",
        "mkdir -p /home/daytona/workspace",
        "mkdir -p /home/daytona/.bun",
        "chown -R daytona:daytona /home/daytona",
      )
      .dockerfileCommands(["USER daytona"])
      .env({
        AUTHENTICATED_REPO_URL: authenticatedUrl,
        BRANCH_NAME: branch,
        BUN_INSTALL_CACHE_DIR: "/home/daytona/.bun/install/cache",
      })
      .runCommands(
        `git clone --branch $BRANCH_NAME --single-branch $AUTHENTICATED_REPO_URL /home/daytona/workspace`,
      )
      .workdir("/home/daytona/workspace")
      .runCommands(
        "rm -rf .git",
        "git init",
        'git config user.name "Shipper AI"',
        'git config user.email "ai@shipper.dev"',
        "git add .",
        'git commit -m "Initial commit from template"',
        "git branch -M main",
      )
      .runCommands("bun install")
      .runCommands(
        "chmod 755 /home/daytona/workspace",
        "chmod -R 755 /home/daytona/workspace/node_modules 2>/dev/null || true",
      )
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
      },
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
      "Error: Both DAYTONA_API_KEY_1 and DAYTONA_API_KEY_2 environment variables are required",
    );
    process.exit(1);
  }

  if (!process.env.GITHUB_APP_ID || !process.env.GITHUB_APP_PRIVATE_KEY) {
    console.error(
      "Error: GitHub App credentials (GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY) are required",
    );
    process.exit(1);
  }

  // Parse command-line arguments
  const args = process.argv.slice(2);
  const branchArg = args.find((arg) => arg.startsWith("--branch="));
  const snapshotNameArg = args.find((arg) => arg.startsWith("--name="));
  const versionArg = args.find((arg) => arg.startsWith("--version="));
  const repoUrlArg = args.find((arg) => arg.startsWith("--repo="));

  const repoUrl =
    repoUrlArg?.split("=")[1] ||
    "https://github.com/Shipper-dot-now/vite-template";

  // Get version first so we can show it in the menu
  const version = versionArg?.split("=")[1] || "v3";

  // Determine branch - use interactive menu if not specified
  let branch: string;
  if (branchArg) {
    branch = branchArg.split("=")[1];
  } else {
    console.log(`${colors.bold}📋 Template Selection${colors.reset}`);
    console.log(`Repository: ${colors.cyan}${repoUrl}${colors.reset}`);
    if (version) {
      console.log(`Version: ${colors.cyan}${version}${colors.reset}`);
    }
    console.log("");
    branch = await selectBranch(repoUrl, version);
  }

  // Generate snapshot name based on template branch
  let baseName: string;
  if (snapshotNameArg) {
    baseName = snapshotNameArg.split("=")[1];
  } else {
    // Convert branch name to snapshot name format
    if (branch === "main") {
      baseName = "vite-template";
    } else {
      baseName = `vite-${branch}`;
    }
  }

  const snapshotName = version ? `${baseName}-${version}` : baseName;

  const snapshotOptions = {
    snapshotName,
    branch,
    repoUrl,
  };

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
    renderTUI(apiKey1State, apiKey2State, snapshotOptions, isFirstRender);
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
    createSnapshotForApiKey(
      DAYTONA_API_KEY_1,
      "API_KEY_1",
      snapshotOptions,
      updateApiKey1,
    )
      .then(() => {
        apiKey1State.status = "success";
      })
      .catch((err) => {
        apiKey1State.status = "error";
        apiKey1State.error = err.message;
        throw err;
      }),
    createSnapshotForApiKey(
      DAYTONA_API_KEY_2,
      "API_KEY_2",
      snapshotOptions,
      updateApiKey2,
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
  renderTUI(apiKey1State, apiKey2State, snapshotOptions, false);

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

  console.log("\nThe snapshot includes:");
  console.log("  • Bun runtime with built-in package manager");
  console.log("  • Git repository cloned to /home/daytona/workspace");
  console.log("  • Fresh git history initialized as main branch");
  console.log("  • All dependencies installed with bun");
  console.log("  • Package installation permissions configured for AI");
  console.log("  • Proper user permissions and cache directories");

  // Exit with error if any failed
  const anyFailed = results.some((result) => result.status === "rejected");
  if (anyFailed) {
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("\n❌ Failed to create Daytona snapshots:");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
