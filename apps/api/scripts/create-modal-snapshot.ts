#!/usr/bin/env tsx
/**
 * Create Modal Snapshot Script
 *
 * This script creates a reusable Modal snapshot (filesystem image) with a specified
 * template repository and all necessary dependencies pre-installed. The snapshot
 * can then be used to quickly create sandboxes without cloning from git each time.
 *
 * Usage:
 *   # Create snapshot with interactive template selection
 *   npx tsx scripts/create-modal-snapshot.ts
 *
 *   # Create snapshot from a specific template (skip interactive menu)
 *   npx tsx scripts/create-modal-snapshot.ts --template=calculator
 *
 *   # Create multiple snapshots at once (comma-separated)
 *   npx tsx scripts/create-modal-snapshot.ts --template=calculator,database,vite
 *
 *   # Create snapshot with version
 *   npx tsx scripts/create-modal-snapshot.ts --template=database --version=v2
 *
 *   # Use a different repository
 *   npx tsx scripts/create-modal-snapshot.ts --repo=https://github.com/org/repo --template=vite --version=v1
 *
 *   # Deploy to specific environment
 *   npx tsx scripts/create-modal-snapshot.ts --template=calculator --environment=dev
 *   npx tsx scripts/create-modal-snapshot.ts --template=calculator --environment=main
 *   npx tsx scripts/create-modal-snapshot.ts --template=calculator --environment=both
 *
 * Options:
 *   --template=<name> Template name(s) to use (e.g., calculator, database, vite)
 *                     Comma-separated for multiple: calculator,database,vite
 *                     If not specified, shows interactive menu (supports "all")
 *   --name=<name>     Custom snapshot name (default: same as template)
 *   --version=<ver>   Version suffix to append (e.g., v1, v2, beta)
 *   --repo=<url>      Repository URL (default: https://github.com/Shipper-dot-now/vite-template)
 *   --base-image=<img> Base container image (auto-detected from template, or specify custom)
 *   --environment=<env> Environment to deploy to: main, dev, or both
 *                       If not specified, shows interactive menu
 *
 * Environment Variables Required:
 *   MODAL_TOKEN_ID          Modal token ID
 *   MODAL_TOKEN_SECRET      Modal token secret
 *   GITHUB_APP_ID           GitHub App ID for authentication
 *   GITHUB_APP_PRIVATE_KEY  GitHub App private key
 *
 * Environment Variables Optional:
 *   MODAL_IMAGE_BUILDER_VERSION  Image builder version to use (e.g., "v2")
 *                                 If not set, Modal will use the default/legacy version
 *                                 See https://modal.com/settings/image-config for details
 */

import { ModalClient } from "modal";
import * as crypto from "crypto";
import * as dotenv from "dotenv";
import * as readline from "readline";

// Load environment variables
dotenv.config();

// Get Modal credentials from environment
const MODAL_TOKEN_ID = process.env.MODAL_TOKEN_ID;
const MODAL_TOKEN_SECRET = process.env.MODAL_TOKEN_SECRET;

// Get GitHub App credentials from environment
const GITHUB_APP_ID = process.env.GITHUB_APP_ID;
const GITHUB_APP_PRIVATE_KEY = process.env.GITHUB_APP_PRIVATE_KEY;

// Get optional Modal image builder version
const MODAL_IMAGE_BUILDER_VERSION = process.env.MODAL_IMAGE_BUILDER_VERSION;

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

/**
 * Generate GitHub App JWT for authentication
 */
function generateGitHubAppJWT(appId: string, privateKey: string): string {
  const now = Math.floor(Date.now() / 1000);

  const payload = {
    iat: now - 60, // Backdate by 60 seconds to account for clock skew
    exp: now + 5 * 60, // JWT expires in 5 minutes (safer than 10)
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
  const appId = GITHUB_APP_ID;
  const privateKey = GITHUB_APP_PRIVATE_KEY;

  if (!appId || !privateKey) {
    throw new Error(
      "GitHub App credentials not configured (GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY required)",
    );
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

  console.log(
    `${colors.dim}Fetching branches from ${owner}/${repo}...${colors.reset}`,
  );

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

  const branches = branchesData
    .map((branch) => branch.name)
    .filter((name) => name !== "dev"); // Filter out dev branch

  console.log(
    `${colors.green}✓ Found ${branches.length} templates${colors.reset}\n`,
  );
  return branches;
}

// Parse command line arguments
function parseArgs(): {
  templates?: string[];
  name?: string;
  version?: string;
  repo?: string;
  baseImage?: string;
  environments?: ("main" | "dev")[];
} {
  const args = process.argv.slice(2);
  const parsed: Record<string, string> = {};

  for (const arg of args) {
    if (arg.startsWith("--")) {
      const [key, value] = arg.slice(2).split("=");
      if (key && value) {
        parsed[key] = value;
      }
    }
  }

  let environments: ("main" | "dev")[] | undefined;
  if (parsed.environment) {
    const envInput = parsed.environment.toLowerCase();
    if (envInput === "both") {
      environments = ["main", "dev"];
    } else if (envInput === "main") {
      environments = ["main"];
    } else if (envInput === "dev") {
      environments = ["dev"];
    }
  }

  return {
    templates: parsed.template
      ? parsed.template.split(",").map((t) => t.trim())
      : undefined,
    name: parsed.name,
    version: parsed.version,
    repo: parsed.repo,
    baseImage: parsed.baseImage,
    environments,
  };
}

/**
 * Get base Docker image for a template (matches modal-sandbox-manager.ts)
 * All templates now use Bun
 */
function getImageTagForTemplate(templateName?: string): string {
  // All templates use Bun
  return "oven/bun:1";
}

/**
 * Map template names to branch names (matches modal-sandbox-manager.ts)
 *
 * IMPORTANT: This function handles the inverse operation of the template name extraction
 * in selectTemplate(). It must correctly reconstruct branch names from template names.
 *
 * Template name extraction logic in selectTemplate():
 * - branch === "main" → template = "vite"
 * - branch.endsWith("-template") → template = branch without "-template"
 * - otherwise → template = branch (as-is)
 *
 * This function reverses that:
 * - template === "vite" → branch = "main"
 * - template + "-template" exists → branch = template + "-template"
 * - otherwise → branch = template (as-is, for branches without -template suffix)
 */
function getTemplateBranch(
  templateName: string,
  allBranches?: string[],
): string {
  // "vite", "default", or "node" maps to "main" branch
  if (
    templateName === "vite" ||
    templateName === "default" ||
    templateName === "node"
  ) {
    return "main";
  }

  // If the template name already ends with "-template", use as-is
  if (templateName.endsWith("-template")) {
    return templateName;
  }

  // If we have the list of all branches, check if adding "-template" creates a valid branch
  if (allBranches) {
    const withTemplateSuffix = `${templateName}-template`;
    if (allBranches.includes(withTemplateSuffix)) {
      return withTemplateSuffix;
    }
    // If the template name itself is a branch, use it as-is
    if (allBranches.includes(templateName)) {
      return templateName;
    }
  }

  // Default: append "-template" for backward compatibility
  return `${templateName}-template`;
}

/**
 * Interactive environment selection menu
 */
async function selectEnvironments(): Promise<("main" | "dev")[]> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve, reject) => {
    rl.question(
      `\n${colors.yellow}Select environment(s) to deploy to (main, dev, or both): ${colors.reset}`,
      (answer) => {
        rl.close();

        const input = answer.trim().toLowerCase();

        if (input === "both") {
          resolve(["main", "dev"]);
          return;
        }

        if (input === "main") {
          resolve(["main"]);
          return;
        }

        if (input === "dev") {
          resolve(["dev"]);
          return;
        }

        reject(
          new Error(
            `Invalid environment selection: ${input}. Must be "main", "dev", or "both"`,
          ),
        );
      },
    );
  });
}

/**
 * Interactive template selection menu
 * Returns array of objects with both template name and actual branch name
 */
async function selectTemplate(
  repoUrl: string,
  version?: string,
): Promise<Array<{ template: string; branch: string }>> {
  const branches = await getRepositoryBranches(repoUrl);

  if (branches.length === 0) {
    throw new Error("No templates found (excluding dev)");
  }

  console.log(
    `${colors.cyan}${colors.bright}Available Templates:${colors.reset}\n`,
  );

  branches.forEach((branch, index) => {
    // Convert branch name to template name for display and detection
    const template =
      branch === "main" ? "vite" : branch.replace(/-template$/, "");

    // Convert to readable display name
    const displayName = template
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    // Generate the snapshot name that will be created (uses branch name)
    const snapshotName = generateSnapshotName(branch, version);

    // Get the base image that will be used
    const baseImage = getImageTagForTemplate(template);

    console.log(
      `${colors.bright}${index + 1}.${colors.reset} ${colors.green}${displayName}${colors.reset} ${colors.dim}(${baseImage})${colors.reset} ${colors.dim}→ ${colors.cyan}${snapshotName}${colors.reset}`,
    );
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve, reject) => {
    rl.question(
      `\n${colors.yellow}Select templates (comma-separated, e.g., "1,2,3" or "all" for all templates): ${colors.reset}`,
      (answer) => {
        rl.close();

        const input = answer.trim().toLowerCase();

        // Handle "all" selection
        if (input === "all") {
          const allTemplates = branches.map((branch) => ({
            template:
              branch === "main" ? "vite" : branch.replace(/-template$/, ""),
            branch: branch,
          }));
          resolve(allTemplates);
          return;
        }

        // Parse comma-separated selections
        const selections = input
          .split(",")
          .map((s) => parseInt(s.trim()))
          .filter((n) => !isNaN(n));

        if (selections.length === 0) {
          reject(new Error("No valid selections"));
          return;
        }

        // Validate all selections are within range
        const invalid = selections.filter((n) => n < 1 || n > branches.length);
        if (invalid.length > 0) {
          reject(new Error(`Invalid selections: ${invalid.join(", ")}`));
          return;
        }

        // Convert selections to template/branch pairs
        const selectedTemplates = selections.map((selection) => {
          const selectedBranch = branches[selection - 1];
          return {
            template:
              selectedBranch === "main"
                ? "vite"
                : selectedBranch.replace(/-template$/, ""),
            branch: selectedBranch,
          };
        });

        resolve(selectedTemplates);
      },
    );
  });
}

/**
 * Generate snapshot name from branch name
 * Snapshot name matches the branch name exactly (with optional version suffix)
 */
function generateSnapshotName(branch: string, version?: string): string {
  // Snapshot name is the branch name (optionally with version)
  // For "main" branch, use "vite-template" to match production convention
  let baseName = branch;
  if (branch === "main") {
    baseName = "vite-template";
  }

  const name = version ? `${baseName}-${version}` : baseName;
  return name;
}

/**
 * Format error for display with full details
 */
function formatError(error: unknown): string {
  if (error instanceof Error) {
    let message = error.message || "Unknown error";

    // Try to extract additional error details
    const errorObj = error as any;

    // First, log all properties of the error object for debugging
    const allProps: string[] = [];
    try {
      // Get all own properties
      const ownProps = Object.getOwnPropertyNames(errorObj);
      // Get all enumerable properties
      const enumProps = Object.keys(errorObj);
      // Combine and deduplicate
      const allPropertyNames = [...new Set([...ownProps, ...enumProps])];

      for (const prop of allPropertyNames) {
        if (prop === "message" || prop === "stack" || prop === "name") {
          continue; // Already handled
        }

        try {
          const value = errorObj[prop];
          if (value !== undefined && value !== null) {
            let valueStr: string;
            if (typeof value === "string") {
              valueStr = value;
            } else if (typeof value === "object") {
              try {
                valueStr = JSON.stringify(value, null, 2);
              } catch {
                valueStr = String(value);
              }
            } else {
              valueStr = String(value);
            }

            // Only include non-empty values
            if (valueStr.trim()) {
              allProps.push(`  ${prop}: ${valueStr}`);
            }
          }
        } catch {
          // Skip properties that can't be accessed
        }
      }
    } catch {
      // If we can't enumerate properties, continue with standard checks
    }

    // Check for common error properties
    if (errorObj.cause) {
      message += `\n  Cause: ${formatError(errorObj.cause)}`;
    }

    if (errorObj.status) {
      message += `\n  Status: ${errorObj.status}`;
    }

    if (errorObj.statusText) {
      message += `\n  Status Text: ${errorObj.statusText}`;
    }

    if (errorObj.response) {
      try {
        const responseText =
          typeof errorObj.response === "string"
            ? errorObj.response
            : JSON.stringify(errorObj.response, null, 2);
        message += `\n  Response: ${responseText}`;
      } catch {
        message += `\n  Response: [Unable to stringify]`;
      }
    }

    if (errorObj.details) {
      try {
        const detailsText =
          typeof errorObj.details === "string"
            ? errorObj.details
            : JSON.stringify(errorObj.details, null, 2);
        message += `\n  Details: ${detailsText}`;
      } catch {
        message += `\n  Details: [Unable to stringify]`;
      }
    }

    // Check for Modal-specific error properties
    if (errorObj.error) {
      try {
        const errorText =
          typeof errorObj.error === "string"
            ? errorObj.error
            : JSON.stringify(errorObj.error, null, 2);
        message += `\n  Error: ${errorText}`;
      } catch {
        message += `\n  Error: [Unable to stringify]`;
      }
    }

    if (errorObj.exception) {
      try {
        const exceptionText =
          typeof errorObj.exception === "string"
            ? errorObj.exception
            : JSON.stringify(errorObj.exception, null, 2);
        message += `\n  Exception: ${exceptionText}`;
      } catch {
        message += `\n  Exception: [Unable to stringify]`;
      }
    }

    // Add all other properties found
    if (allProps.length > 0) {
      message += `\n\n  Additional Properties:\n${allProps.join("\n")}`;
    }

    // Include stack trace for debugging
    if (error.stack) {
      message += `\n\n  Stack Trace:\n${error.stack
        .split("\n")
        .slice(0, 15)
        .map((line) => `    ${line}`)
        .join("\n")}`;
    }

    // If message is empty or just whitespace, try to stringify the whole error
    if (!message.trim() || message === "Unknown error") {
      try {
        const errorString = JSON.stringify(
          errorObj,
          Object.getOwnPropertyNames(errorObj),
          2,
        );
        message = `Error object: ${errorString}`;
      } catch {
        message = `Error: ${String(error)}`;
      }
    }

    return message;
  }

  // For non-Error objects, try to stringify
  try {
    return JSON.stringify(error, null, 2);
  } catch {
    return String(error);
  }
}

/**
 * Process a single snapshot creation
 */
async function processSnapshot(
  modal: any,
  app: any,
  template: string,
  branch: string,
  authenticatedUrl: string,
  environment: "main" | "dev",
  args: { version?: string; baseImage?: string; name?: string },
): Promise<{
  success: boolean;
  template: string;
  snapshotName: string;
  environment: "main" | "dev";
  imageId?: string;
  error?: string;
}> {
  try {
    // Branch name is now passed directly from the selection

    // Get base image for template (can be overridden)
    const baseImage = args.baseImage || getImageTagForTemplate(template);

    // Generate snapshot name (default to branch name)
    const snapshotName =
      args.name || generateSnapshotName(branch, args.version);

    console.log(
      `\n${colors.cyan}${colors.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`,
    );
    console.log(
      `${colors.bright}Processing: ${colors.green}${template}${colors.reset} ${colors.dim}[${environment}]${colors.reset}`,
    );
    console.log(
      `${colors.cyan}${colors.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`,
    );

    console.log(`${colors.bright}Configuration:${colors.reset}`);
    console.log(
      `  Environment: ${colors.magenta}${colors.bright}${environment}${colors.reset}`,
    );
    console.log(`  Template: ${colors.cyan}${template}${colors.reset}`);
    console.log(`  Branch: ${colors.cyan}${branch}${colors.reset}`);
    console.log(`  Base Image: ${colors.cyan}${baseImage}${colors.reset}`);
    if (MODAL_IMAGE_BUILDER_VERSION) {
      console.log(
        `  Image Builder Version: ${colors.cyan}${MODAL_IMAGE_BUILDER_VERSION}${colors.reset}`,
      );
    } else {
      console.log(
        `  Image Builder Version: ${colors.yellow}${colors.dim}legacy (set MODAL_IMAGE_BUILDER_VERSION to upgrade)${colors.reset}`,
      );
    }
    console.log(
      `  Snapshot Name: ${colors.green}${colors.bright}${snapshotName}${colors.reset}\n`,
    );

    // Build image with all dependencies and template code (using Dockerfile syntax)
    console.log(
      `${colors.blue}Building image from base: ${baseImage}...${colors.reset}`,
    );

    let image = modal.images
      .fromRegistry(baseImage)
      .dockerfileCommands(["RUN apt-get update && apt-get install -y git"])
      .dockerfileCommands(["RUN mkdir -p /workspace"])
      .dockerfileCommands([
        `ENV AUTHENTICATED_REPO_URL=${authenticatedUrl}`,
        `ENV BRANCH_NAME=${branch}`,
      ])
      .dockerfileCommands([
        `RUN git clone --branch "$BRANCH_NAME" --single-branch --depth 1 "$AUTHENTICATED_REPO_URL" /workspace`,
      ])
      .dockerfileCommands(["WORKDIR /workspace"])
      .dockerfileCommands([
        "RUN rm -rf .git",
        "RUN git init",
        'RUN git config user.name "Shipper AI"',
        'RUN git config user.email "ai@shipper.dev"',
        "RUN git add .",
        'RUN git commit -m "Initial commit from template"',
        "RUN git branch -M main",
      ]);

    // Add package installation step (always use bun install)
    console.log(
      `${colors.blue}Installing dependencies with bun...${colors.reset}`,
    );
    image = image.dockerfileCommands(["RUN bun install"]);
    console.log(`${colors.green}✓ Will use bun install${colors.reset}`);

    // Configure Vite to prevent "outdated optimize dep" errors with Vite 7
    // The issue: Vite 7 dynamically discovers dependencies, causing re-optimization during runtime
    // Solution: Patch vite.config.ts to add optimizeDeps.entries for comprehensive dependency discovery
    console.log(
      `${colors.blue}Patching Vite config to add dependency entry points...${colors.reset}`,
    );
    image = image.dockerfileCommands([
      // Clear any existing cache
      "RUN rm -rf node_modules/.vite .vite",
      // Patch vite.config.ts to add entries field to optimizeDeps (only if not already present)
      // This tells Vite to scan ALL source files upfront instead of lazy discovery
      // Use grep to check if entries already exists, only add if missing
      `RUN grep -q 'entries:' vite.config.ts || sed -i '/optimizeDeps: {/a\\    entries: ["index.html", "src/**/*.{ts,tsx,js,jsx}"],' vite.config.ts`,
    ]);
    console.log(
      `${colors.green}✓ Vite config patched with comprehensive dependency entries${colors.reset}`,
    );

    console.log(
      `${colors.green}✓ Image build configuration complete${colors.reset}\n`,
    );

    // Create sandbox from built image
    console.log(
      `${colors.blue}Creating sandbox from built image...${colors.reset}`,
    );

    let sandbox;
    try {
      sandbox = await modal.sandboxes.create(app, image, {
        workdir: "/workspace",
        env: {
          NODE_ENV: "development",
        },
        memoryMiB: 2048,
        cpu: 1,
      });
      console.log(
        `${colors.green}✓ Sandbox created: ${sandbox.sandboxId}${colors.reset}\n`,
      );
    } catch (error) {
      console.error(
        `${colors.red}${colors.bright}Failed to create sandbox:${colors.reset}`,
      );

      // Debug: Log raw error object structure
      if (error instanceof Error) {
        const errorObj = error as any;
        console.error(
          `${colors.yellow}Debug - Error object keys: ${Object.keys(errorObj).join(", ")}${colors.reset}`,
        );
        console.error(
          `${colors.yellow}Debug - Error object own properties: ${Object.getOwnPropertyNames(errorObj).join(", ")}${colors.reset}`,
        );
      }

      console.error(`${colors.red}${formatError(error)}${colors.reset}\n`);
      throw error;
    }

    try {
      // Verify the image build was successful by checking workspace contents
      console.log(
        `${colors.blue}Verifying workspace contents...${colors.reset}`,
      );
      const lsResult = await sandbox.exec(["ls", "-la", "/workspace"], {
        mode: "text",
        stdout: "pipe",
        stderr: "pipe",
      });

      const lsStdout = await lsResult.stdout.readText();
      await lsResult.wait();

      console.log(`${colors.dim}${lsStdout}${colors.reset}`);

      // Check if package.json exists
      const hasPackageJson = lsStdout.includes("package.json");
      if (hasPackageJson) {
        console.log(
          `${colors.green}✓ Workspace verified (found package.json)${colors.reset}\n`,
        );
      } else {
        console.log(
          `${colors.yellow}⚠ Warning: package.json not found in workspace${colors.reset}\n`,
        );
      }

      // Verify git repository
      console.log(`${colors.blue}Verifying git repository...${colors.reset}`);
      const gitStatusResult = await sandbox.exec(["git", "status"], {
        mode: "text",
        stdout: "pipe",
        stderr: "pipe",
        workdir: "/workspace",
      });

      const gitExitCode = await gitStatusResult.wait();
      if (gitExitCode === 0) {
        console.log(
          `${colors.green}✓ Git repository verified${colors.reset}\n`,
        );
      } else {
        console.log(
          `${colors.yellow}⚠ Warning: Git repository verification failed${colors.reset}\n`,
        );
      }

      // Create filesystem snapshot
      console.log(
        `${colors.blue}Creating filesystem snapshot...${colors.reset}`,
      );
      const snapshotImage = await sandbox.snapshotFilesystem();
      console.log(
        `${colors.green}✓ Snapshot created with Image ID: ${colors.bright}${snapshotImage.imageId}${colors.reset}\n`,
      );

      // Terminate sandbox
      console.log(`${colors.blue}Terminating sandbox...${colors.reset}`);
      await sandbox.terminate();
      console.log(`${colors.green}✓ Sandbox terminated${colors.reset}\n`);

      // Success summary
      console.log(
        `${colors.green}${colors.bright}✓ Snapshot Created Successfully!${colors.reset}`,
      );
      console.log(`  Template: ${colors.cyan}${template}${colors.reset}`);
      console.log(`  Branch: ${colors.cyan}${branch}${colors.reset}`);
      console.log(
        `  Snapshot Name: ${colors.cyan}${snapshotName}${colors.reset}`,
      );
      console.log(
        `  Image ID: ${colors.cyan}${snapshotImage.imageId}${colors.reset}\n`,
      );

      return {
        success: true,
        template,
        snapshotName,
        environment,
        imageId: snapshotImage.imageId,
      };
    } catch (error) {
      // Clean up sandbox on error
      console.error(
        `${colors.red}${colors.bright}Error during snapshot creation:${colors.reset}`,
      );
      console.error(`${colors.red}${formatError(error)}${colors.reset}\n`);
      console.log(`${colors.blue}Cleaning up sandbox...${colors.reset}`);
      try {
        await sandbox.terminate();
      } catch (terminateError) {
        console.error(
          `${colors.yellow}Warning: Failed to terminate sandbox: ${terminateError}${colors.reset}`,
        );
      }
      throw error;
    }
  } catch (error) {
    const errorMessage = formatError(error);
    console.error(
      `\n${colors.red}${colors.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`,
    );
    console.error(
      `${colors.red}${colors.bright}Failed to create snapshot for ${template} [${environment}]:${colors.reset}`,
    );
    console.error(
      `${colors.red}${colors.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`,
    );
    console.error(`${colors.red}${errorMessage}${colors.reset}\n`);

    // If it's an image build error, suggest checking Modal dashboard
    if (error instanceof Error && error.message.includes("Image build")) {
      console.error(
        `${colors.yellow}${colors.bright}Tip: Check Modal dashboard for detailed build logs:${colors.reset}`,
      );
      console.error(
        `${colors.dim}  https://modal.com/apps/${environment === "dev" ? "dev" : "main"}/shipper-templates${colors.reset}\n`,
      );
    }

    return {
      success: false,
      template,
      snapshotName: "",
      environment,
      error: errorMessage,
    };
  }
}

async function main() {
  console.log(
    `${colors.cyan}${colors.bright}╔═══════════════════════════════════════╗${colors.reset}`,
  );
  console.log(
    `${colors.cyan}${colors.bright}║  Modal Snapshot Creation Script      ║${colors.reset}`,
  );
  console.log(
    `${colors.cyan}${colors.bright}╚═══════════════════════════════════════╝${colors.reset}\n`,
  );

  // Validate environment variables
  const missingVars: string[] = [];

  if (!MODAL_TOKEN_ID) missingVars.push("MODAL_TOKEN_ID");
  if (!MODAL_TOKEN_SECRET) missingVars.push("MODAL_TOKEN_SECRET");
  if (!GITHUB_APP_ID) missingVars.push("GITHUB_APP_ID");
  if (!GITHUB_APP_PRIVATE_KEY) missingVars.push("GITHUB_APP_PRIVATE_KEY");

  if (missingVars.length > 0) {
    console.error(
      `${colors.red}Error: Missing required environment variables:${colors.reset}`,
    );
    missingVars.forEach((varName) => {
      console.error(`${colors.yellow}  - ${varName}${colors.reset}`);
    });
    console.error(
      `\n${colors.dim}Modal credentials: https://modal.com/settings/tokens${colors.reset}`,
    );
    console.error(
      `${colors.dim}GitHub App: Configure in your GitHub organization settings${colors.reset}`,
    );
    process.exit(1);
  }

  // Parse command line arguments
  const args = parseArgs();
  const repoUrl =
    args.repo || "https://github.com/Shipper-dot-now/vite-template";

  // Get all branches from repository for branch name resolution
  const allBranches = await getRepositoryBranches(repoUrl);

  // Get template names and their corresponding branches
  let templateData: Array<{ template: string; branch: string }>;
  if (args.templates && args.templates.length > 0) {
    // Convert template names to template/branch pairs using getTemplateBranch
    templateData = args.templates.map((templateName) => ({
      template: templateName,
      branch: getTemplateBranch(templateName, allBranches),
    }));
    console.log(
      `${colors.green}Using templates:${colors.reset} ${colors.bright}${templateData.map((t) => t.template).join(", ")}${colors.reset}\n`,
    );
  } else {
    templateData = await selectTemplate(repoUrl, args.version);
    console.log();
  }

  // Get environments to deploy to
  let environments: ("main" | "dev")[];
  if (args.environments && args.environments.length > 0) {
    environments = args.environments;
    console.log(
      `${colors.green}Using environments:${colors.reset} ${colors.bright}${environments.join(", ")}${colors.reset}\n`,
    );
  } else {
    environments = await selectEnvironments();
    console.log();
  }

  console.log(`${colors.bright}Summary:${colors.reset}`);
  console.log(`  Repository: ${colors.cyan}${repoUrl}${colors.reset}`);
  console.log(
    `  Environments: ${colors.magenta}${environments.join(", ")}${colors.reset}`,
  );
  console.log(
    `  Templates to process: ${colors.cyan}${templateData.length}${colors.reset}`,
  );
  console.log(
    `  Templates: ${colors.cyan}${templateData.map((t) => `${t.template} (${t.branch})`).join(", ")}${colors.reset}\n`,
  );
  if (MODAL_IMAGE_BUILDER_VERSION) {
    console.log(
      `  Image Builder: ${colors.cyan}${MODAL_IMAGE_BUILDER_VERSION}${colors.reset}\n`,
    );
  } else {
    console.log(
      `  Image Builder: ${colors.yellow}${colors.dim}legacy${colors.reset} ${colors.dim}(set MODAL_IMAGE_BUILDER_VERSION env var to upgrade)${colors.reset}\n`,
    );
  }

  try {
    // Get GitHub App installation token (reused for all templates and environments)
    console.log(
      `${colors.blue}Getting GitHub App installation token...${colors.reset}`,
    );
    const token = await getGitHubAppInstallationToken(repoUrl);
    const authenticatedUrl = repoUrl.replace(
      "https://",
      `https://x-access-token:${token}@`,
    );
    console.log(`${colors.green}✓ Token obtained${colors.reset}\n`);

    // Process each environment
    const results = [];
    for (const environment of environments) {
      console.log(
        `\n${colors.magenta}${colors.bright}═══════════════════════════════════════════════════════════════${colors.reset}`,
      );
      console.log(
        `${colors.magenta}${colors.bright}Processing Environment: ${environment.toUpperCase()}${colors.reset}`,
      );
      console.log(
        `${colors.magenta}${colors.bright}═══════════════════════════════════════════════════════════════${colors.reset}\n`,
      );

      // Initialize Modal client for this environment
      console.log(
        `${colors.blue}Initializing Modal client for ${environment} environment...${colors.reset}`,
      );
      const modal = new ModalClient({
        tokenId: MODAL_TOKEN_ID,
        tokenSecret: MODAL_TOKEN_SECRET,
        environment: environment,
      });

      // Create or get app in this environment
      console.log(
        `${colors.blue}Creating Modal app in ${environment} environment...${colors.reset}`,
      );
      const app = await modal.apps.fromName("shipper-templates", {
        createIfMissing: true,
      });
      console.log(
        `${colors.green}✓ App created/found in ${environment} environment${colors.reset}\n`,
      );

      // Process each template in this environment
      for (let i = 0; i < templateData.length; i++) {
        const { template, branch } = templateData[i];
        console.log(
          `${colors.cyan}${colors.bright}[${i + 1}/${templateData.length}] Processing template: ${template} (branch: ${branch}) [${environment}]${colors.reset}`,
        );

        const result = await processSnapshot(
          modal,
          app,
          template,
          branch,
          authenticatedUrl,
          environment,
          args,
        );
        results.push(result);
      }
    }

    // Display final summary
    console.log(
      `\n${colors.cyan}${colors.bright}╔═══════════════════════════════════════╗${colors.reset}`,
    );
    console.log(
      `${colors.cyan}${colors.bright}║  Snapshot Creation Summary            ║${colors.reset}`,
    );
    console.log(
      `${colors.cyan}${colors.bright}╚═══════════════════════════════════════╝${colors.reset}\n`,
    );

    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    console.log(`${colors.bright}Results:${colors.reset}`);
    console.log(`  Total: ${colors.cyan}${results.length}${colors.reset}`);
    console.log(
      `  Successful: ${colors.green}${successful.length}${colors.reset}`,
    );
    console.log(`  Failed: ${colors.red}${failed.length}${colors.reset}\n`);

    if (successful.length > 0) {
      console.log(
        `${colors.green}${colors.bright}Successful Snapshots:${colors.reset}`,
      );
      successful.forEach((result) => {
        console.log(
          `  ${colors.green}✓${colors.reset} ${colors.cyan}${result.template}${colors.reset} ${colors.dim}[${result.environment}]${colors.reset}`,
        );
        console.log(
          `    Snapshot: ${colors.dim}${result.snapshotName}${colors.reset}`,
        );
        console.log(
          `    Image ID: ${colors.dim}${result.imageId}${colors.reset}`,
        );
      });
      console.log();
    }

    if (failed.length > 0) {
      console.log(
        `${colors.red}${colors.bright}Failed Snapshots:${colors.reset}`,
      );
      failed.forEach((result) => {
        console.log(
          `  ${colors.red}✗${colors.reset} ${colors.cyan}${result.template}${colors.reset} ${colors.dim}[${result.environment}]${colors.reset}`,
        );
        // Display multi-line error with proper indentation
        const errorLines = (result.error || "Unknown error").split("\n");
        errorLines.forEach((line, index) => {
          if (index === 0) {
            console.log(`    ${colors.red}Error: ${line}${colors.reset}`);
          } else {
            console.log(`    ${colors.red}${line}${colors.reset}`);
          }
        });
      });
      console.log();
    }

    if (successful.length > 0) {
      console.log(`${colors.yellow}${colors.bright}Next Steps:${colors.reset}`);
      console.log(
        `${colors.dim}Update apps/api/src/services/modal-snapshots.ts with:${colors.reset}\n`,
      );

      // Group by template name to merge main and dev entries
      const byTemplate = successful.reduce(
        (acc, result) => {
          const key = result.snapshotName;
          if (!acc[key]) {
            acc[key] = {
              template: result.template,
              snapshotName: result.snapshotName,
              main: null as { imageId: string } | null,
              dev: null as { imageId: string } | null,
            };
          }
          if (result.environment === "main") {
            acc[key].main = { imageId: result.imageId! };
          } else if (result.environment === "dev") {
            acc[key].dev = { imageId: result.imageId! };
          }
          return acc;
        },
        {} as Record<
          string,
          {
            template: string;
            snapshotName: string;
            main: { imageId: string } | null;
            dev: { imageId: string } | null;
          }
        >,
      );

      Object.values(byTemplate).forEach((templateData) => {
        const branch = getTemplateBranch(templateData.template);
        const hasMain = templateData.main !== null;
        const hasDev = templateData.dev !== null;

        // Build the output with imageId (main/production) and optional devImageId (dev)
        // If only dev exists, use it as imageId (fallback scenario)
        const mainImageId =
          templateData.main?.imageId || templateData.dev?.imageId;

        if (!mainImageId) {
          console.log(
            `${colors.yellow}⚠ Warning: No image ID found for ${templateData.snapshotName}${colors.reset}`,
          );
          return;
        }

        let output = `${colors.dim}  "${templateData.snapshotName}": {
    imageId: "${mainImageId}",${colors.reset}`;

        // Only add devImageId if it's different from main (when both exist)
        if (hasDev && templateData.dev && hasMain && templateData.main) {
          output += `\n${colors.dim}    devImageId: "${templateData.dev.imageId}",${colors.reset}`;
        } else if (hasDev && !hasMain) {
          // Only dev exists - add a comment
          output += `\n${colors.dim}    // Note: Only dev environment deployed, add main imageId when available${colors.reset}`;
        }

        output += `\n${colors.dim}    description: "${branch} template",
    createdAt: "${new Date().toISOString().split("T")[0]}",
    version: "${args.version || "v1"}",
  },${colors.reset}`;

        console.log(output);
        console.log();
      });
    }

    if (failed.length > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error(
      `${colors.red}${colors.bright}Failed to create snapshots:${colors.reset}`,
    );
    console.error(`${colors.red}${formatError(error)}${colors.reset}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(
    `${colors.red}${colors.bright}Unexpected error:${colors.reset}`,
  );
  console.error(`${colors.red}${formatError(error)}${colors.reset}`);
  process.exit(1);
});
