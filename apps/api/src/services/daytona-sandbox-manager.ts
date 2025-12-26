/**
 * Daytona Sandbox Manager
 *
 * This file provides utilities for interacting with Daytona sandboxes:
 * - creating, starting, stopping sandboxes
 * - managing dev server sessions
 * - restoring fragments and files
 * - listing files recursively from a sandbox (with recovery attempt)
 *
 * Edit: Added retry/recovery when listing files fails due to sandbox being stopped/unavailable.
 * If a recursive file list attempt fails with a recoverable error, we attempt to start the sandbox
 * (or use the existing start helper), wait briefly, refresh the preview URL if possible, then retry once.
 */

import { Daytona, Sandbox } from "@daytonaio/sdk";
import * as path from "path";
import * as crypto from "crypto";
import { getRecursiveFileList } from "./validation-utils.js";
import { runCommandOnSandbox } from "./sandbox-compat.js";
import { prisma } from "@shipper/database";
import { TRPCError } from "@trpc/server";
import { forceHttpsForDeployments } from "../utils/deployment-url.js";
import { provisionDatabase } from "./turso-manager.js";
import { CLEAR_VITE_CACHE_COMMAND } from "@shipper/shared";

type DaytonaSandboxInfo = {
  sandbox: Sandbox; // Daytona sandbox instance
  sandboxUrl: string;
  sandboxExpiresAt?: Date | null;
  files: Map<string, { size: number; modified: number }>;
  gitRepositoryUrl?: string;
  currentBranch?: string;
  gitCommitHash?: string;
  projectId?: string; // Add project ID for git operations
  lspServers?: Map<string, any>; // LSP server instances by language
};

// Recovery modes for progressive fallback
enum RecoveryMode {
  FULL_RESTORE = "full_restore", // Restore fragment + install packages
  FILES_ONLY = "files_only", // Restore files without package installation
  MINIMAL_SANDBOX = "minimal_sandbox", // Create sandbox without fragment restoration
  EMERGENCY_FALLBACK = "emergency_fallback", // Basic sandbox with error state
}

type V2FragmentData = {
  id: string;
  title: string;
  files: { [path: string]: string };
  projectId: string;
  createdAt: Date;
  updatedAt: Date;
};

type GitRepoStatus = {
  currentBranch?: string;
  ahead?: number;
  behind?: number;
  fileStatus?: Array<{ name: string; status?: string }>;
};

/**
 * Transform Daytona preview URLs to use custom shipper.now domain
 * Converts: https://{port}-{sandbox-id}.proxy.daytona.works
 * To: https://preview--{port}-{sandbox-id}.shipper.now (or http://preview--{port}-{sandbox-id}.localhost:3003 in dev)
 */
function transformToShipperDomain(daytonaUrl: string): string {
  try {
    const url = new URL(daytonaUrl);

    // Extract port and sandbox ID from hostname pattern: {port}-{sandbox-id}.proxy.daytona.works
    const hostMatch = url.hostname.match(
      /^(\d+)-(.+?)\.proxy\.daytona\.works$/,
    );

    if (hostMatch) {
      const [, port, sandboxId] = hostMatch;
      // Transform to new domain pattern with preview prefix
      // Use localhost for development, or if DAYTONA_USE_LOCALHOST is set
      const useLocalhost =
        process.env.NODE_ENV === "development" ||
        process.env.DAYTONA_USE_LOCALHOST === "true";

      if (useLocalhost) {
        url.hostname = `preview--${port}-${sandboxId}.localhost`;
        url.port = "3003";
        url.protocol = "http:";
      } else {
        url.hostname = `preview--${port}-${sandboxId}.shipper.now`;
      }
      console.log(
        `[transformToShipperDomain] Transformed ${daytonaUrl} -> ${url.toString()}`,
      );
      return url.toString();
    }

    // If pattern doesn't match, return original URL and log warning
    console.warn(
      `[transformToShipperDomain] URL doesn't match expected Daytona pattern: ${daytonaUrl}`,
    );
    return daytonaUrl;
  } catch (error) {
    console.error(
      `[transformToShipperDomain] Failed to parse URL ${daytonaUrl}:`,
      error,
    );
    return daytonaUrl;
  }
}

// Module-level Daytona instance
const daytona = new Daytona({
  apiKey: process.env.DAYTONA_API_KEY!,
  organizationId: process.env.DAYTONA_ORGANIZATION_ID!,
  target: "us",
});

/**
 * Get or create a Daytona sandbox for a project
 * First checks database for existing sandbox ID
 */
export async function getSandbox(
  projectId: string,
): Promise<DaytonaSandboxInfo | null> {
  try {
    console.log(
      `[DaytonaSandboxManager] Getting sandbox for project ${projectId}`,
    );

    // Step 1: Check database for existing sandbox ID
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        daytonaSandboxId: true,
        sandboxUrl: true,
        sandboxExpiresAt: true,
        activeFragmentId: true,
        gitRepositoryUrl: true,
        currentBranch: true,
        gitCommitHash: true,
      },
    });

    if (!project?.daytonaSandboxId) {
      console.log(
        `[DaytonaSandboxManager] No sandbox found in database for project ${projectId}`,
      );
      return null;
    }

    console.log(
      `[DaytonaSandboxManager] Found sandbox ID in database: ${project.daytonaSandboxId}`,
    );

    // Step 2: Verify sandbox exists at Daytona level using findOne
    try {
      // Try to find the sandbox by ID - if this fails, the sandbox doesn't exist
      const sandbox = await daytona.findOne({
        id: project.daytonaSandboxId as string,
      });

      if (!sandbox) {
        console.log(
          `[DaytonaSandboxManager] Sandbox ${project.daytonaSandboxId} not found at Daytona level`,
        );
        // Clean up stale database reference
        await cleanupStaleSandboxReference(projectId);
        return null;
      }

      console.log(
        `[DaytonaSandboxManager] Successfully connected to existing sandbox ${sandbox.id}`,
      );

      // Step 3: Get fresh sandbox URL (for port 5173 - Vite default)
      let sandboxUrl: string;
      try {
        const previewInfo = await sandbox.getPreviewLink(5173);
        sandboxUrl = transformToShipperDomain(previewInfo.url);

        // Always update database with the fresh URL (only for Daytona sandboxes)
        // Check provider to ensure we don't overwrite Modal URLs
        const projectForProviderCheck = await prisma.project.findUnique({
          where: { id: projectId },
          select: { sandboxProvider: true },
        });

        // Only update if this is actually a Daytona sandbox
        if (
          projectForProviderCheck?.sandboxProvider !== "modal" &&
          project.sandboxUrl !== sandboxUrl
        ) {
          await prisma.project.update({
            where: { id: projectId },
            data: { sandboxUrl },
          });
          console.log(
            `[DaytonaSandboxManager] Updated database with fresh sandbox URL: ${sandboxUrl}`,
          );
        }
      } catch (urlError) {
        console.warn(
          `[DaytonaSandboxManager] Failed to get fresh preview URL: ${urlError}`,
        );
        // Fallback to database URL if available, otherwise use pattern
        if (project.sandboxUrl) {
          sandboxUrl = project.sandboxUrl as string;
          console.log(
            `[DaytonaSandboxManager] Using database URL as fallback: ${sandboxUrl}`,
          );
        } else {
          sandboxUrl = `https://${sandbox.id}.daytona.app:5173`; // Fallback URL pattern
          console.log(
            `[DaytonaSandboxManager] Using fallback URL pattern: ${sandboxUrl}`,
          );
        }
      }

      // Step 4: Get current file list - this will throw if sandbox is not running
      const files = await getRecursiveFileListFromSandbox(sandbox, projectId);

      const sandboxInfo: DaytonaSandboxInfo = {
        sandbox,
        sandboxUrl,
        sandboxExpiresAt: project.sandboxExpiresAt,
        files,
        gitRepositoryUrl:
          project.gitRepositoryUrl === null
            ? undefined
            : project.gitRepositoryUrl,
        currentBranch:
          project.currentBranch === null ? undefined : project.currentBranch,
        gitCommitHash:
          project.gitCommitHash === null ? undefined : project.gitCommitHash,
        projectId,
      };

      console.log(
        `[DaytonaSandboxManager] Successfully retrieved sandbox info for project ${projectId}`,
        {
          sandboxId: sandbox.id,
          sandboxUrl,
          fileCount: files.size,
        },
      );

      return sandboxInfo;
    } catch (findError) {
      const errorMessage =
        findError instanceof Error ? findError.message : String(findError);
      console.warn(
        `[DaytonaSandboxManager] Failed to connect to sandbox ${project.daytonaSandboxId}: ${errorMessage}`,
      );

      // Daytona sandboxes are persistent and long-living
      // We should be extremely conservative about removing references
      // Only cleanup in very specific cases where we're 100% certain the sandbox is permanently gone

      // For now, never automatically cleanup - let manual intervention or explicit admin actions handle cleanup
      // This ensures we don't lose sandbox references due to temporary connectivity issues,
      // sandbox being stopped/paused, network problems, or other recoverable conditions
      console.log(
        `[DaytonaSandboxManager] Keeping sandbox reference ${project.daytonaSandboxId} - Daytona sandboxes are persistent and this may be recoverable`,
      );

      // Return null to indicate connection failed, but preserve database reference for recovery
      return null;
    }
  } catch (error) {
    console.error(
      `[DaytonaSandboxManager] Error getting sandbox for project ${projectId}:`,
      error,
    );
    return null;
  }
}

/**
 * Clean up stale sandbox reference from database
 */
async function cleanupStaleSandboxReference(projectId: string): Promise<void> {
  try {
    console.log(
      `[DaytonaSandboxManager] Cleaning up stale sandbox reference for project ${projectId}`,
    );

    await prisma.project.update({
      where: { id: projectId },
      data: {
        daytonaSandboxId: null,
        sandboxUrl: null,
        sandboxCreatedAt: null,
        sandboxExpiresAt: null,
        // Keep git info as it's still valid
      },
    });

    console.log(
      `[DaytonaSandboxManager] Successfully cleaned up stale sandbox reference`,
    );
  } catch (error) {
    console.error(
      `[DaytonaSandboxManager] Failed to cleanup stale sandbox reference:`,
      error,
    );
  }
}

/**
 * Create a new Daytona sandbox for a project
 */
export async function createSandbox(
  projectId: string,
  fragmentId?: string | null,
  templateName?: string,
): Promise<DaytonaSandboxInfo> {
  return createSandboxInternal(
    projectId,
    fragmentId,
    RecoveryMode.FULL_RESTORE,
    templateName,
  );
}

async function createSandboxInternal(
  projectId: string,
  fragmentId?: string | null,
  recoveryMode: RecoveryMode = RecoveryMode.FULL_RESTORE,
  templateName?: string,
): Promise<DaytonaSandboxInfo> {
  const timings = {
    start: Date.now(),
    sandboxCreate: { start: 0, end: 0 },
    previewUrl: { start: 0, end: 0 },
    dbUpdate: { start: 0, end: 0 },
    gitInfo: { start: 0, end: 0 },
    fragmentRestore: { start: 0, end: 0 },
    fileList: { start: 0, end: 0 },
    devServer: { start: 0, end: 0 },
  };

  try {
    console.log("[DaytonaSandboxManager] Starting sandbox creation", projectId);

    // Create new Daytona sandbox from pre-built snapshot
    // Use provided template or default to vite-template
    const TEMPLATES_VERSION = "v4";
    const snapshotName =
      `${templateName}-${TEMPLATES_VERSION}` ||
      `vite-template-${TEMPLATES_VERSION}`;

    console.log("[DaytonaSandboxManager] Creating new Daytona sandbox", {
      projectId,
      originalFragmentId: fragmentId,
      template: snapshotName,
    });

    timings.sandboxCreate.start = Date.now();
    const sandbox = await daytona.create(
      {
        snapshot: snapshotName,
        autoArchiveInterval: 30, // Auto-archive after a Sandbox has been stopped for 30 minutes
        public: false,
      },
      {
        timeout: 0,
      },
    );
    timings.sandboxCreate.end = Date.now();

    console.log("[DaytonaSandboxManager] Successfully created new sandbox", {
      sandboxId: sandbox.id,
      duration: `${timings.sandboxCreate.end - timings.sandboxCreate.start}ms`,
    });

    // Get sandbox info (using available properties)
    const sandboxState = sandbox.state;
    const autoStopInterval = sandbox.autoStopInterval;

    console.log("[DaytonaSandboxManager] Got sandbox state", {
      sandboxState,
      autoStopInterval,
    });

    // Get preview URL for port 5173 (Vite default)
    timings.previewUrl.start = Date.now();
    const previewInfo = await sandbox.getPreviewLink(5173);
    const sandboxUrl = transformToShipperDomain(previewInfo.url);
    timings.previewUrl.end = Date.now();
    console.log("[DaytonaSandboxManager] Got sandbox URL:", {
      sandboxUrl,
      duration: `${timings.previewUrl.end - timings.previewUrl.start}ms`,
    });

    // Database operations are now handled below - removing old commented code

    // Update database with Daytona sandbox information (Phase 3 completed)
    console.log(
      "[DaytonaSandboxManager] Updating database with Daytona sandbox info",
    );
    timings.dbUpdate.start = Date.now();
    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: {
        daytonaSandboxId: sandbox.id,
        sandboxCreatedAt: new Date(),
        sandboxExpiresAt: null,
        sandboxUrl,
      },
    });
    timings.dbUpdate.end = Date.now();
    console.log("[DaytonaSandboxManager] Database updated successfully", {
      duration: `${timings.dbUpdate.end - timings.dbUpdate.start}ms`,
    });

    // Provision Turso database if not already done
    console.log("[DaytonaSandboxManager] Checking Turso database...");
    try {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
          tursoDatabaseUrl: true,
          tursoDatabaseToken: true,
          tursoDatabaseName: true,
        },
      });

      let tursoCredentials;

      if (project?.tursoDatabaseUrl && project?.tursoDatabaseToken) {
        // Database already provisioned during project creation
        console.log("[DaytonaSandboxManager] Using existing Turso database");
        tursoCredentials = {
          url: project.tursoDatabaseUrl,
          authToken: project.tursoDatabaseToken,
          databaseName: project.tursoDatabaseName || `project-${projectId}`,
        };
      } else {
        // Fallback: provision database now
        console.log(
          "[DaytonaSandboxManager] Provisioning Turso database (fallback)...",
        );
        tursoCredentials = await provisionDatabase(projectId);

        // Update project with credentials
        await prisma.project.update({
          where: { id: projectId },
          data: {
            tursoDatabaseName: tursoCredentials.databaseName,
            tursoDatabaseUrl: tursoCredentials.url,
            tursoDatabaseToken: tursoCredentials.authToken,
            tursoCreatedAt: new Date(),
          },
        });
      }

      // Inject credentials into sandbox environment (Vite client-visible)
      await sandbox.process.executeCommand(
        `echo "VITE_TURSO_DATABASE_URL=${tursoCredentials.url}" >> /home/daytona/workspace/.env`,
        "/home/daytona/workspace",
      );
      await sandbox.process.executeCommand(
        `echo "VITE_TURSO_AUTH_TOKEN=${tursoCredentials.authToken}" >> /home/daytona/workspace/.env`,
        "/home/daytona/workspace",
      );

      console.log(
        "[DaytonaSandboxManager] Turso credentials injected into sandbox",
        { databaseName: tursoCredentials.databaseName },
      );
    } catch (tursoError) {
      console.error(
        "[DaytonaSandboxManager] Failed to provision/inject Turso database:",
        tursoError,
      );
      // Continue without throwing - sandbox can still work without database
    }

    // Get git info from the cloned repository (already done during image build)
    let gitRepositoryUrl: string | undefined;
    let currentBranch: string | undefined;
    let gitCommitHash: string | undefined;

    console.log("[DaytonaSandboxManager] Getting git repository information");
    timings.gitInfo.start = Date.now();
    try {
      // Get current branch and commit hash from workspace
      const branchResult = await sandbox.process.executeCommand(
        "git branch --show-current",
        "/home/daytona/workspace",
      );
      currentBranch = branchResult.result?.trim() || "main";

      const commitResult = await sandbox.process.executeCommand(
        "git rev-parse HEAD",
        "/home/daytona/workspace",
      );
      gitCommitHash = commitResult.result?.trim();

      // Update project with git info
      const viteTemplateUrl =
        "https://github.com/Shipper-dot-now/vite-template";
      await prisma.project.update({
        where: { id: projectId },
        data: {
          gitRepositoryUrl: viteTemplateUrl,
          currentBranch,
          gitCommitHash,
        },
      });

      gitRepositoryUrl = viteTemplateUrl;
      timings.gitInfo.end = Date.now();
      console.log(
        "[DaytonaSandboxManager] Git repository information retrieved",
        {
          duration: `${timings.gitInfo.end - timings.gitInfo.start}ms`,
        },
      );
    } catch (error) {
      timings.gitInfo.end = Date.now();
      console.error(
        `[DaytonaSandboxManager] Failed to get git repository information:`,
        error,
      );
      // Continue anyway - this is not critical for sandbox functionality
    }

    // Apply recovery mode-specific logic
    if (
      fragmentId &&
      (recoveryMode === RecoveryMode.FULL_RESTORE ||
        recoveryMode === RecoveryMode.FILES_ONLY)
    ) {
      timings.fragmentRestore.start = Date.now();
      try {
        // Restore fragment files to sandbox
        await restoreV2FragmentInSandbox(sandbox, fragmentId, projectId);

        // Ensure project's activeFragmentId reflects what was restored
        await prisma.project.update({
          where: { id: projectId },
          data: { activeFragmentId: fragmentId },
        });
        timings.fragmentRestore.end = Date.now();
        console.log(
          `[DaytonaSandboxManager] Set activeFragmentId to ${fragmentId} (mode: ${recoveryMode})`,
          {
            duration: `${timings.fragmentRestore.end - timings.fragmentRestore.start}ms`,
          },
        );
      } catch (restoreError) {
        timings.fragmentRestore.end = Date.now();
        console.error(
          `[DaytonaSandboxManager] Fragment restoration failed in ${recoveryMode} mode:`,
          restoreError,
        );

        // If we're in FULL_RESTORE mode and restoration fails, don't throw - the sandbox is still usable
        if (recoveryMode === RecoveryMode.FULL_RESTORE) {
          console.log(
            "[DaytonaSandboxManager] Continuing with empty sandbox after restoration failure",
          );
        } else {
          throw restoreError;
        }
      }
    } else if (recoveryMode === RecoveryMode.EMERGENCY_FALLBACK) {
      console.log(
        "[DaytonaSandboxManager] Emergency fallback mode - creating minimal sandbox without fragment restoration",
      );
    }

    // Get files - use fallback empty map if sandbox is still starting up
    let files: Map<string, { size: number; modified: number }>;
    timings.fileList.start = Date.now();
    try {
      files = await getRecursiveFileListFromSandbox(sandbox, projectId);
      timings.fileList.end = Date.now();
      const fileListArray = Array.from(files.keys()).slice(0, 10); // Log only first 10 files

      console.log("[DaytonaSandboxManager] Retrieved file list from sandbox", {
        fileCount: files.size,
        fileListSample: fileListArray,
        duration: `${timings.fileList.end - timings.fileList.start}ms`,
      });
    } catch (fileListError) {
      timings.fileList.end = Date.now();
      console.warn(
        "[DaytonaSandboxManager] Could not get file list from new sandbox (normal during creation):",
        fileListError instanceof Error
          ? fileListError.message
          : String(fileListError),
      );
      // Use empty map as fallback for new sandboxes
      files = new Map();
    }

    // Start the development server as a background process in workspace
    console.log("[DaytonaSandboxManager] Starting development server...");
    timings.devServer.start = Date.now();
    try {
      const devServerSessionId = `dev-server-${projectId}`;
      await sandbox.process.createSession(devServerSessionId);

      // Change to workspace directory first
      await sandbox.process.executeSessionCommand(devServerSessionId, {
        command: "cd /home/daytona/workspace",
      });

      // Clear Vite cache and touch CSS file to force Tailwind CSS rebuild
      // This prevents stale Tailwind styles when sandbox is recreated from snapshot
      await sandbox.process.executeSessionCommand(devServerSessionId, {
        command: CLEAR_VITE_CACHE_COMMAND,
      });

      // Start the dev server in the background from workspace
      const commandResult = await sandbox.process.executeSessionCommand(
        devServerSessionId,
        {
          command: "bun dev",
          async: true,
        },
      );

      // Poll dev server until it's actually ready to serve content
      if (commandResult.cmdId) {
        console.log(
          "[DaytonaSandboxManager] Waiting for dev server to be ready...",
        );
        const maxWaitTime = 30000; // 30 seconds max wait
        const pollInterval = 2000; // Check every 2 seconds
        const startWaitTime = Date.now();
        let isReady = false;

        while (Date.now() - startWaitTime < maxWaitTime && !isReady) {
          await new Promise((resolve) => setTimeout(resolve, pollInterval));

          try {
            const logs = await sandbox.process.getSessionCommandLogs(
              devServerSessionId,
              commandResult.cmdId,
            );

            const allLogs = [logs.stdout, logs.stderr, logs.output]
              .filter(Boolean)
              .join("\n");

            // Check for Vite dev server ready indicators
            const viteReadyIndicators = [
              "ready in",
              "Local:",
              "VITE v",
              "ready",
              "localhost:5173",
            ];

            isReady = viteReadyIndicators.some((indicator) =>
              allLogs.toLowerCase().includes(indicator.toLowerCase()),
            );

            if (isReady) {
              console.log(
                "[DaytonaSandboxManager] Dev server is ready and serving content",
              );
              console.log("[DevServer Logs]:", allLogs);
              break;
            }
          } catch (logError) {
            console.warn(
              "[DaytonaSandboxManager] Could not get dev server logs during polling:",
              logError,
            );
          }
        }

        if (!isReady) {
          console.warn(
            "[DaytonaSandboxManager] Dev server did not become ready within timeout, but continuing anyway",
          );
        }
      }

      timings.devServer.end = Date.now();
      console.log(
        "[DaytonaSandboxManager] Development server started successfully",
        {
          duration: `${timings.devServer.end - timings.devServer.start}ms`,
        },
      );

      // Inject monitoring script into index.html after dev server is ready
      try {
        console.log(
          `[DaytonaSandboxManager] Injecting monitoring script for project ${projectId}`,
        );

        // Wait a bit for Vite to generate index.html
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const indexPath = "/home/daytona/workspace/index.html";

        // Use the new file-based injection method
        const { setupSandboxMonitoring } = await import(
          "./sandbox-monitor-injection.js"
        );
        await setupSandboxMonitoring(sandbox, sandbox.id, projectId);
      } catch (monitorError) {
        console.warn(
          `[DaytonaSandboxManager] Failed to inject monitoring script (non-critical):`,
          monitorError,
        );
        // Don't throw - monitoring injection failure shouldn't break sandbox creation
      }
    } catch (devServerError) {
      timings.devServer.end = Date.now();
      console.error(
        "[DaytonaSandboxManager] Failed to start development server:",
        devServerError,
      );
      // Don't throw here - the sandbox is still usable without the dev server
      // The user can manually start it later if needed
    }

    const sandboxInfoToReturn: DaytonaSandboxInfo = {
      sandbox: sandbox,
      sandboxUrl,
      sandboxExpiresAt: null, // Daytona handles expiration internally
      files,
      gitRepositoryUrl,
      currentBranch,
      gitCommitHash,
      projectId,
    };

    // Calculate total time
    const totalTime = Date.now() - timings.start;

    // Log consolidated timing summary
    console.log("═══════════════════════════════════════════════════════════");
    console.log("[SANDBOX CREATION TIMING] Complete Breakdown");
    console.log("═══════════════════════════════════════════════════════════");
    console.log({
      "Total Time": {
        ms: totalTime,
        seconds: (totalTime / 1000).toFixed(2),
      },
      "1. Sandbox Create": {
        ms: timings.sandboxCreate.end - timings.sandboxCreate.start || 0,
        seconds: (
          (timings.sandboxCreate.end - timings.sandboxCreate.start) /
          1000
        ).toFixed(2),
        executed: timings.sandboxCreate.start > 0,
      },
      "2. Preview URL": {
        ms: timings.previewUrl.end - timings.previewUrl.start || 0,
        seconds: (
          (timings.previewUrl.end - timings.previewUrl.start) /
          1000
        ).toFixed(2),
        executed: timings.previewUrl.start > 0,
      },
      "3. Database Update": {
        ms: timings.dbUpdate.end - timings.dbUpdate.start || 0,
        seconds: (
          (timings.dbUpdate.end - timings.dbUpdate.start) /
          1000
        ).toFixed(2),
        executed: timings.dbUpdate.start > 0,
      },
      "4. Git Info": {
        ms: timings.gitInfo.end - timings.gitInfo.start || 0,
        seconds: ((timings.gitInfo.end - timings.gitInfo.start) / 1000).toFixed(
          2,
        ),
        executed: timings.gitInfo.start > 0,
      },
      "5. Fragment Restore": {
        ms: timings.fragmentRestore.end - timings.fragmentRestore.start || 0,
        seconds: (
          (timings.fragmentRestore.end - timings.fragmentRestore.start) /
          1000
        ).toFixed(2),
        executed: timings.fragmentRestore.start > 0,
      },
      "6. File List": {
        ms: timings.fileList.end - timings.fileList.start || 0,
        seconds: (
          (timings.fileList.end - timings.fileList.start) /
          1000
        ).toFixed(2),
        executed: timings.fileList.start > 0,
      },
      "7. Dev Server": {
        ms: timings.devServer.end - timings.devServer.start || 0,
        seconds: (
          (timings.devServer.end - timings.devServer.start) /
          1000
        ).toFixed(2),
        executed: timings.devServer.start > 0,
      },
    });
    console.log("═══════════════════════════════════════════════════════════");

    console.log(
      "[DaytonaSandboxManager] Successfully created and configured new sandbox",
      {
        sandboxId: sandbox.id,
        sandboxUrl,
        sandboxExpiresAt: null,
        fileCount: files.size,
      },
    );

    return sandboxInfoToReturn;
  } catch (error) {
    console.error("[DaytonaSandboxManager] Failed to create new sandbox", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      projectId,
    });
    throw error;
  }
}

/**
 * Restore files to a Daytona sandbox
 */
export async function restoreFilesInSandbox(
  sandbox: Sandbox,
  files: { [path: string]: string },
): Promise<number> {
  try {
    console.log(
      `Restoring ${Object.keys(files).length} files to Daytona sandbox ${
        sandbox.id
      }`,
    );

    // Log all files being written
    console.log(
      `[FILE_TRACKING] Files being written to sandbox ${sandbox.id}:`,
    );
    Object.entries(files).forEach(([filePath, content]) => {
      console.log(`[FILE_TRACKING] - ${filePath} (${content.length} chars)`);
    });

    // Prepare files for bulk upload, prefixing with workspace
    const filesToUpload = Object.entries(files).map(([filePath, content]) => {
      // Check if content is a base64 data URL (for binary files like images)
      let buffer: Buffer;
      if (content.startsWith("data:")) {
        // Extract base64 data from data URL
        const base64Match = content.match(/^data:[^;]+;base64,(.+)$/);
        if (base64Match) {
          // Decode base64 to binary
          buffer = Buffer.from(base64Match[1], "base64");
        } else {
          // Fallback to text encoding if not valid base64 data URL
          buffer = Buffer.from(content);
        }
      } else {
        // Regular text file
        buffer = Buffer.from(content);
      }

      return {
        source: buffer,
        destination: path.join("/home/daytona/workspace", filePath),
      };
    });

    // Use uploadFiles for bulk upload as per Daytona documentation
    try {
      console.log(`[FILE_WRITE] Uploading ${filesToUpload.length} files...`);
      await sandbox.fs.uploadFiles(filesToUpload);
      console.log(`[FILE_WRITE] ✅ Successfully uploaded all files`);
      return filesToUpload.length;
    } catch (error) {
      console.error(`[FILE_WRITE] ❌ Failed to upload files:`, error);
      // If bulk upload fails, fall back to individual uploads
      console.log(`[FILE_WRITE] Falling back to individual file uploads...`);
      let restoredCount = 0;
      for (const [filePath, content] of Object.entries(files)) {
        try {
          // Check if content is a base64 data URL (for binary files like images)
          let buffer: Buffer;
          if (content.startsWith("data:")) {
            // Extract base64 data from data URL
            const base64Match = content.match(/^data:[^;]+;base64,(.+)$/);
            if (base64Match) {
              // Decode base64 to binary
              buffer = Buffer.from(base64Match[1], "base64");
            } else {
              // Fallback to text encoding if not valid base64 data URL
              buffer = Buffer.from(content);
            }
          } else {
            // Regular text file
            buffer = Buffer.from(content);
          }

          // Use absolute path consistent with bulk upload
          const fullPath = path.join("/home/daytona/workspace", filePath);
          console.log(`[FILE_WRITE] Writing ${fullPath}...`);
          await sandbox.fs.uploadFile(buffer, fullPath);
          console.log(`[FILE_WRITE] ✅ Successfully wrote ${fullPath}`);
          restoredCount++;
        } catch (individualError) {
          console.error(
            `[FILE_WRITE] ❌ Failed to restore file ${filePath}:`,
            individualError,
          );
        }
      }
      return restoredCount;
    }
  } catch (error) {
    console.error(`Failed to restore files to sandbox ${sandbox.id}:`, error);
    throw error;
  }
}

/**
 * Get recursive file list from Daytona sandbox
 *
 * NOTE: This function will attempt to start the sandbox and retry once if the reason
 * for failure looks like the sandbox is stopped/unavailable (for example "no IP address found",
 * "Sandbox is not running", "bad request: no IP address found", etc.). If a projectId is provided,
 * and we can obtain a fresh preview URL after starting, we will persist that URL to the database.
 *
 * @param sandbox Daytona Sandbox instance
 * @param projectId Optional project ID - if provided we'll update its sandboxUrl when we can refresh the preview link
 */
async function getRecursiveFileListFromSandbox(
  sandbox: Sandbox,
  projectId?: string,
): Promise<Map<string, { size: number; modified: number }>> {
  // Helper that attempts to list recursively (same logic as original)
  const attemptList = async () => {
    const files = new Map<string, { size: number; modified: number }>();

    // Directories to ignore during file listing
    const ignoredDirectories = new Set([
      "node_modules",
      ".git",
      ".next",
      "dist",
      "build",
      ".cache",
      ".tmp",
      "coverage",
      ".nyc_output",
      "logs",
    ]);

    // Get the user root directory first
    const rootDir = await sandbox.getUserRootDir();
    if (!rootDir) {
      console.error("Failed to get user root directory");
      throw new Error(
        "Sandbox is not accessible - failed to get user root directory",
      );
    }

    // Check if workspace directory exists, and if so, list from there
    const workspaceDir = "/home/daytona/workspace";
    try {
      await sandbox.fs.listFiles(workspaceDir);
      // If no error, workspace exists, list from there
      const fileList = await sandbox.fs.listFiles(workspaceDir);

      // Process files recursively from workspace
      for (const file of fileList) {
        const fullPath = path.join(workspaceDir, file.name);
        if (!file.isDir) {
          // Calculate relative path from workspace directory for consistency
          const relativePath = path.relative(workspaceDir, fullPath);
          files.set(relativePath, {
            size: file.size || 0,
            modified: file.modTime
              ? new Date(file.modTime).getTime()
              : Date.now(),
          });
        } else {
          // Skip ignored directories
          if (!ignoredDirectories.has(file.name)) {
            // Recursively list subdirectory contents
            await addDirectoryFiles(
              sandbox,
              fullPath,
              files,
              ignoredDirectories,
              workspaceDir, // Pass workspace dir for relative path calculation
            );
          }
        }
      }
    } catch (error) {
      // Workspace doesn't exist, fall back to root
      console.warn("Workspace directory not found, listing from root:", error);
      const fileList = await sandbox.fs.listFiles(rootDir);

      // Process files recursively
      for (const file of fileList) {
        const fullPath = path.join(rootDir, file.name);
        if (!file.isDir) {
          // Store relative path from root directory
          const relativePath = path.relative(rootDir, fullPath);
          files.set(relativePath, {
            size: file.size || 0,
            modified: file.modTime
              ? new Date(file.modTime).getTime()
              : Date.now(),
          });
        } else {
          // Skip ignored directories
          if (!ignoredDirectories.has(file.name)) {
            // Recursively list subdirectory contents
            await addDirectoryFiles(
              sandbox,
              fullPath,
              files,
              ignoredDirectories,
              rootDir, // Pass root dir for relative path calculation
            );
          }
        }
      }
    }

    return files;
  };

  // Attempt listing, and if recoverable error occurs, try one recovery attempt then retry.
  try {
    return await attemptList();
  } catch (firstError) {
    console.error(
      "Failed to get recursive file list (first attempt):",
      firstError,
    );

    // Derive an error message for checks
    const errMsg =
      firstError instanceof Error ? firstError.message : String(firstError);

    // Detect recoverable conditions - common SDK messages when sandbox is stopped
    const recoverableIndicators = [
      "Sandbox is not running",
      "no IP address found",
      "no ip address",
      "bad request: no IP address",
      "bad request: no IP address found",
      "Sandbox is not accessible",
      "not running",
      "not available",
    ];

    const isRecoverable = recoverableIndicators.some((indicator) =>
      errMsg.toLowerCase().includes(indicator.toLowerCase()),
    );

    if (!isRecoverable) {
      // Not a recoverable condition - rethrow to let callers decide
      throw firstError;
    }

    // Attempt a single recovery: start sandbox, wait, then retry listing once.
    try {
      console.log(
        `[DaytonaSandboxManager] Attempting recovery for sandbox ${sandbox.id} after file listing failure`,
      );

      // Prefer using our exported helper to start sandbox (which returns a Sandbox instance)
      let recoveredSandbox: Sandbox | null = null;
      try {
        recoveredSandbox = await startSandbox(sandbox.id);
        if (recoveredSandbox) {
          // Use the returned sandbox instance for subsequent operations to ensure we have the freshest object
          sandbox = recoveredSandbox;
          console.log(
            `[DaytonaSandboxManager] startSandbox returned sandbox instance for ${sandbox.id}`,
          );
        } else {
          console.warn(
            `[DaytonaSandboxManager] startSandbox did not return a sandbox instance for ${sandbox.id}`,
          );
        }
      } catch (startErr) {
        console.warn(
          `[DaytonaSandboxManager] startSandbox helper failed, attempting sandbox.start() directly:`,
          startErr,
        );
        // Last-resort: try direct start on provided object
        try {
          await (sandbox as any).start?.();
        } catch (directStartErr) {
          console.warn(
            `[DaytonaSandboxManager] Direct sandbox.start() also failed:`,
            directStartErr,
          );
        }
      }

      // Wait a longer period for the sandbox to initialize networking and services (increased wait)
      await new Promise((resolve) => setTimeout(resolve, 8000));

      // If projectId is provided, refresh preview link and persist updated URL if available
      if (projectId) {
        try {
          // Check provider to ensure we don't overwrite Modal URLs
          const projectForProviderCheck = await prisma.project.findUnique({
            where: { id: projectId },
            select: { sandboxProvider: true },
          });

          // Only update if this is actually a Daytona sandbox
          if (projectForProviderCheck?.sandboxProvider !== "modal") {
            console.log(
              `[DaytonaSandboxManager] Refreshing preview link after recovery attempt for project ${projectId}`,
            );
            const previewInfo = await sandbox.getPreviewLink(5173);
            const transformed = transformToShipperDomain(previewInfo.url);
            if (transformed) {
              try {
                await prisma.project.update({
                  where: { id: projectId },
                  data: { sandboxUrl: transformed },
                });
                console.log(
                  `[DaytonaSandboxManager] Updated project ${projectId} sandboxUrl to ${transformed}`,
                );
              } catch (dbErr) {
                console.warn(
                  `[DaytonaSandboxManager] Failed to update sandboxUrl in DB for project ${projectId}:`,
                  dbErr,
                );
              }
            }
          } else {
            console.log(
              `[DaytonaSandboxManager] Skipping sandboxUrl update for Modal sandbox project ${projectId}`,
            );
          }
        } catch (previewErr) {
          console.warn(
            `[DaytonaSandboxManager] Could not refresh preview link after starting sandbox:`,
            previewErr,
          );
        }
      }

      // Retry listing once using the (possibly) updated sandbox instance
      try {
        const filesAfterRecovery = await attemptList();
        console.log(
          `[DaytonaSandboxManager] Successfully retrieved file list after recovery, fileCount=${filesAfterRecovery.size}`,
        );
        return filesAfterRecovery;
      } catch (secondError) {
        console.error(
          `[DaytonaSandboxManager] Failed to get file list after recovery attempt:`,
          secondError,
        );

        // If second attempt fails, rethrow the original error so callers have context
        throw secondError;
      }
    } catch (recoveryError) {
      console.error(
        `[DaytonaSandboxManager] Recovery attempt failed:`,
        recoveryError,
      );
      throw firstError;
    }
  }
}

/**
 * Recursively add files from a directory
 */
async function addDirectoryFiles(
  sandbox: Sandbox,
  dirPath: string,
  files: Map<string, { size: number; modified: number }>,
  ignoredDirectories: Set<string> = new Set(),
  workspaceDir?: string,
): Promise<void> {
  try {
    const fileList = await sandbox.fs.listFiles(dirPath);

    for (const file of fileList) {
      const fullPath = path.join(dirPath, file.name);
      if (!file.isDir) {
        // Calculate relative path from workspace directory if provided
        let relativePath: string;
        if (workspaceDir) {
          relativePath = path.relative(workspaceDir, fullPath);
        } else {
          relativePath = fullPath;
        }

        files.set(relativePath, {
          size: file.size || 0,
          modified: file.modTime
            ? new Date(file.modTime).getTime()
            : Date.now(),
        });
      } else {
        // Skip ignored directories
        if (!ignoredDirectories.has(file.name)) {
          // Recursively process subdirectories
          await addDirectoryFiles(
            sandbox,
            fullPath,
            files,
            ignoredDirectories,
            workspaceDir,
          );
        }
      }
    }
  } catch (error) {
    console.error(`Failed to list directory ${dirPath}:`, error);
  }
}

/**
 * Restore V2Fragment in Daytona sandbox
 * Uses git checkout for catastrophic recovery when commit hash is available from GitFragment
 * Falls back to direct file restoration if no git commit is found
 */
export async function restoreV2FragmentInSandbox(
  sandbox: Sandbox,
  fragmentId: string,
  projectId: string,
): Promise<number> {
  try {
    console.log(
      `[DaytonaSandboxManager] Restoring V2Fragment ${fragmentId} to sandbox ${sandbox.id}`,
    );

    // Get the V2Fragment from database
    const fragment = await prisma.v2Fragment.findFirst({
      where: {
        id: fragmentId,
        projectId,
      },
    });

    if (!fragment) {
      throw new Error(
        `V2Fragment ${fragmentId} not found for project ${projectId}`,
      );
    }

    // Check if we have a git commit hash for this fragment
    // First, check if the project has a gitCommitHash that corresponds to this fragment
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { gitCommitHash: true },
    });

    // Try to find a GitFragment that matches this V2Fragment's title and project
    const gitFragment = await prisma.gitFragment.findFirst({
      where: {
        projectId,
        title: fragment.title,
      },
      orderBy: { createdAt: "desc" }, // Get the most recent one
    });

    // Check if this is an AI-fixed fragment (contains "Auto-fixed" in title)
    const isAIFixedFragment = fragment.title.includes("Auto-fixed");

    // Use git checkout for catastrophic recovery if we have a commit hash AND it's not an AI-fixed fragment
    if (gitFragment?.commitHash && !isAIFixedFragment) {
      console.log(
        `[DaytonaSandboxManager] Using git checkout for catastrophic recovery: ${gitFragment.commitHash}`,
      );

      await switchToGitCommit(sandbox, projectId, gitFragment.commitHash);

      console.log(
        `[DaytonaSandboxManager] Successfully restored to git commit ${gitFragment.commitHash} from V2Fragment ${fragmentId}`,
      );

      return 1; // Return 1 to indicate successful restoration
    } else if (project?.gitCommitHash && !isAIFixedFragment) {
      console.log(
        `[DaytonaSandboxManager] Using project's current git commit for recovery: ${project.gitCommitHash}`,
      );

      await switchToGitCommit(sandbox, projectId, project.gitCommitHash);

      console.log(
        `[DaytonaSandboxManager] Successfully restored to project's git commit ${project.gitCommitHash} from V2Fragment ${fragmentId}`,
      );

      return 1; // Return 1 to indicate successful restoration
    } else {
      if (isAIFixedFragment) {
        console.log(
          `[DaytonaSandboxManager] AI-fixed fragment detected, using direct file restoration instead of git checkout`,
        );
      }
      // Fallback to direct file restoration if no git commit is available
      console.log(
        `[DaytonaSandboxManager] No git commit available, falling back to direct file restoration`,
      );

      const files = fragment.files as { [path: string]: string };
      const fileCount = Object.keys(files).length;
      console.log(
        `[DaytonaSandboxManager] Found ${fileCount} files in fragment "${fragment.title}"`,
      );

      const restoredCount = await restoreFilesInSandbox(sandbox, files);

      console.log(
        `[DaytonaSandboxManager] Successfully restored ${restoredCount} files from V2Fragment ${fragmentId}`,
      );

      return restoredCount;
    }
  } catch (error) {
    console.error(
      `[DaytonaSandboxManager] Failed to restore V2Fragment ${fragmentId}:`,
      error,
    );
    throw error;
  }
}

/**
 * Delete a Daytona sandbox
 */
export async function deleteSandbox(sandbox: Sandbox): Promise<void> {
  try {
    console.log(`[DaytonaSandboxManager] Deleting sandbox ${sandbox.id}`);
    await sandbox.delete();
    console.log(
      `[DaytonaSandboxManager] Successfully deleted sandbox ${sandbox.id}`,
    );
  } catch (error) {
    console.error(`[DaytonaSandboxManager] Failed to delete sandbox:`, error);
    throw error;
  }
}

/**
 * Check if git repository exists in sandbox
 *
 * Returns true if `git status` runs successfully in the workspace directory.
 * This helper is used by several git-related helpers and must be present.
 */
export async function hasGitRepository(sandbox: Sandbox): Promise<boolean> {
  try {
    // Attempt a lightweight git status in the workspace to determine if git is initialized
    await sandbox.process.executeCommand("git status", "./workspace");
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Initialize git repository for a project
 */
export async function initializeGitRepository(
  sandbox: Sandbox,
  projectId: string,
): Promise<void> {
  try {
    console.log(
      `[DaytonaSandboxManager] Initializing git repository for project ${projectId}`,
    );

    // Check if git repository already exists
    const hasGit = await hasGitRepository(sandbox);
    if (hasGit) {
      console.log(
        `[DaytonaSandboxManager] Git repository already exists for project ${projectId}`,
      );
      return;
    }

    // Initialize git repository in workspace
    await sandbox.process.executeCommand("git init", "./workspace");

    // Configure git user (using default values for now)
    await sandbox.process.executeCommand(
      'git config user.name "Shipper AI"',
      "./workspace",
    );
    await sandbox.process.executeCommand(
      'git config user.email "ai@shipper.dev"',
      "./workspace",
    );

    // Create .gitignore to exclude .shipper directory (Shipper monitoring scripts)
    await sandbox.process.executeCommand(
      'echo ".shipper/" > .gitignore',
      "./workspace",
    );

    // Check if there are any files to commit
    const statusResult = await sandbox.process.executeCommand(
      "git status --porcelain",
      "./workspace",
    );
    const hasChanges =
      statusResult.result && statusResult.result.trim().length > 0;

    if (hasChanges) {
      // Create initial commit with existing files
      await sandbox.process.executeCommand("git add .", "./workspace");
      await sandbox.process.executeCommand(
        'git commit -m "Initial commit"',
        "./workspace",
      );

      // Get the initial commit hash
      const commitResult = await sandbox.process.executeCommand(
        "git rev-parse HEAD",
        "./workspace",
      );
      const initialCommitHash = commitResult.result?.trim();

      if (initialCommitHash) {
        // Update project with git repository information
        await prisma.project.update({
          where: { id: projectId },
          data: {
            gitRepositoryUrl: `daytona://${sandbox.id}`, // Daytona-specific URL scheme
            currentBranch: "main",
            gitCommitHash: initialCommitHash,
          },
        });

        // Create GitFragment record for the initial commit
        await prisma.gitFragment.create({
          data: {
            title: "Initial commit",
            commitHash: initialCommitHash,
            branch: "main",
            message: "Initial commit",
            authorEmail: "ai@shipper.dev",
            authorName: "Shipper AI",
            projectId,
          },
        });

        console.log(
          `[DaytonaSandboxManager] Git repository initialized with commit ${initialCommitHash}`,
        );
      }
    } else {
      // No files to commit, just initialize the repository
      console.log(
        `[DaytonaSandboxManager] Git repository initialized (empty directory)`,
      );

      // Still update project to indicate git is initialized
      await prisma.project.update({
        where: { id: projectId },
        data: {
          gitRepositoryUrl: `daytona://${sandbox.id}`, // Daytona-specific URL scheme
          currentBranch: "main",
          gitCommitHash: null, // No commits yet
        },
      });
    }
  } catch (error) {
    console.error(
      `[DaytonaSandboxManager] Failed to initialize git repository:`,
      error,
    );
    throw error;
  }
}

/**
 * Create a git commit from current sandbox state
 */
export async function createGitCommit(
  sandbox: Sandbox,
  projectId: string,
  message: string,
  authorEmail?: string,
  authorName?: string,
): Promise<string | null> {
  try {
    console.log(`[DaytonaSandboxManager] Creating git commit: ${message}`);

    // Check if git repository exists, initialize if not
    const hasGit = await hasGitRepository(sandbox);
    if (!hasGit) {
      console.log(
        `[DaytonaSandboxManager] Git repository not found, initializing...`,
      );
      await initializeGitRepository(sandbox, projectId);
    }

    // Add all changes except .shipper directory (Shipper monitoring scripts)
    // Use git add with pathspec to exclude .shipper
    await sandbox.process.executeCommand(
      "git add . ':!.shipper'",
      "./workspace",
    );

    // Check if there are any changes to commit
    const statusResult = await sandbox.process.executeCommand(
      "git status --porcelain",
      "./workspace",
    );
    const hasChanges =
      statusResult.result && statusResult.result.trim().length > 0;

    if (!hasChanges) {
      console.log(
        `[DaytonaSandboxManager] No changes to commit for project ${projectId}`,
      );
      // Return null to indicate no commit was made
      return null;
    }

    // Create commit
    const commitCommand = `git commit -m "${message.replace(/"/g, '\\"')}"`;
    await sandbox.process.executeCommand(commitCommand, "./workspace");

    // Get the new commit hash
    const commitResult = await sandbox.process.executeCommand(
      "git rev-parse HEAD",
      "./workspace",
    );
    const commitHash = commitResult.result?.trim();

    if (commitHash) {
      // Get current branch
      const branchResult = await sandbox.process.executeCommand(
        "git branch --show-current",
        "./workspace",
      );
      const currentBranch = branchResult.result?.trim() || "main";

      // Update project with latest commit
      await prisma.project.update({
        where: { id: projectId },
        data: {
          gitCommitHash: commitHash,
          currentBranch,
        },
      });

      // Create GitFragment record
      await prisma.gitFragment.create({
        data: {
          title: message,
          commitHash,
          branch: currentBranch,
          message,
          authorEmail: authorEmail || "ai@shipper.dev",
          authorName: authorName || "Shipper AI",
          projectId,
        },
      });

      console.log(
        `[DaytonaSandboxManager] Created git commit ${commitHash} on branch ${currentBranch}`,
      );
      return commitHash;
    }

    throw new Error("Failed to get commit hash after creating commit");
  } catch (error) {
    console.error(
      `[DaytonaSandboxManager] Failed to create git commit:`,
      error,
    );
    throw error;
  }
}

/**
 * Switch to a specific git commit (fragment)
 */
export async function switchToGitCommit(
  sandbox: Sandbox,
  projectId: string,
  commitHash: string,
): Promise<void> {
  try {
    console.log(
      `[DaytonaSandboxManager] Switching to git commit ${commitHash}`,
    );

    // Check if git repository exists, initialize if not
    const hasGit = await hasGitRepository(sandbox);
    if (!hasGit) {
      console.log(
        `[DaytonaSandboxManager] Git repository not found, initializing...`,
      );
      await initializeGitRepository(sandbox, projectId);
    }

    // Checkout the specific commit
    await sandbox.process.executeCommand(
      `git checkout ${commitHash}`,
      "./workspace",
    );

    // Update project with the new commit
    await prisma.project.update({
      where: { id: projectId },
      data: {
        gitCommitHash: commitHash,
        activeFragmentId: null, // Clear active fragment since we're using git
      },
    });

    console.log(
      `[DaytonaSandboxManager] Successfully switched to commit ${commitHash}`,
    );
  } catch (error) {
    console.error(
      `[DaytonaSandboxManager] Failed to switch to git commit ${commitHash}:`,
      error,
    );
    throw error;
  }
}

/**
 * Create a new git branch
 */
export async function createGitBranch(
  sandbox: Sandbox,
  repoPath: string,
  branchName: string,
): Promise<void> {
  try {
    await sandbox.process.executeCommand(
      `git -C ${repoPath} checkout -b ${branchName}`,
    );
  } catch (error) {
    console.error(
      `[DaytonaSandboxManager] Failed to create branch ${branchName} in ${repoPath}:`,
      error,
    );
    throw error;
  }
}

/**
 * Checkout branch, delete branch, etc...
 * (the rest of git helpers remain unchanged)
 */

/**
 * Start a stopped Daytona sandbox
 */
export async function startSandbox(sandboxId: string): Promise<Sandbox | null> {
  try {
    console.log(`[DaytonaSandboxManager] Starting sandbox ${sandboxId}`);

    // Try to find the sandbox first
    let sandbox = await daytona.findOne({ id: sandboxId });

    if (!sandbox) {
      console.log(`[DaytonaSandboxManager] Sandbox ${sandboxId} not found`);
      return null;
    }

    // Attempt to start the sandbox (idempotent if already running)
    try {
      await sandbox.start();
      console.log(
        `[DaytonaSandboxManager] start() invoked for sandbox ${sandboxId}`,
      );
    } catch (startError) {
      console.log(
        `[DaytonaSandboxManager] sandbox.start() returned an error or is not available for ${sandboxId}:`,
        startError,
      );
      // Continue - the sandbox object may still be usable, we'll verify readiness below
    }

    // Poll for sandbox readiness before returning.
    // Readiness criteria:
    //  - sandbox.getUserRootDir() returns a non-empty root path
    //  OR
    //  - sandbox.getPreviewLink(5173) returns a URL (preview available)
    //
    // We poll for a short period to allow the sandbox to come up and acquire networking.
    const startTime = Date.now();
    const timeoutMs = 30000; // total wait time (30s)
    const pollIntervalMs = 2000; // poll every 2s

    const checkReady = async (): Promise<boolean> => {
      try {
        // Prefer checking for user root dir (fast) which implies filesystem accessible
        const root = await sandbox.getUserRootDir();
        if (root) {
          console.log(
            `[DaytonaSandboxManager] Sandbox ${sandboxId} getUserRootDir() returned: ${root}`,
          );
          return true;
        }
      } catch (e) {
        // ignore - not ready yet
      }

      try {
        // Check preview link for expected port (5173) as indication that networking and preview proxy is available
        const preview = await sandbox.getPreviewLink(5173);
        if (preview && preview.url) {
          console.log(
            `[DaytonaSandboxManager] Sandbox ${sandboxId} preview link available: ${preview.url}`,
          );
          return true;
        }
      } catch (e) {
        // ignore - not ready yet
      }

      return false;
    };

    // If sandbox instance returned by daytona.findOne is stale, re-fetch inside loop
    while (Date.now() - startTime < timeoutMs) {
      try {
        // Re-fetch sandbox object to pick up updated state when possible
        try {
          sandbox = (await daytona.findOne({ id: sandboxId })) || sandbox;
        } catch (refetchErr) {
          // refetch failure is non-fatal here; use existing sandbox object
        }

        const ready = await checkReady();
        if (ready) {
          console.log(
            `[DaytonaSandboxManager] Sandbox ${sandboxId} is ready, returning sandbox instance`,
          );
          return sandbox;
        }
      } catch (loopErr) {
        console.warn(
          `[DaytonaSandboxManager] Error while polling sandbox readiness for ${sandboxId}:`,
          loopErr,
        );
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    // If we reach here the sandbox didn't become fully ready in time.
    // Return the sandbox object anyway so callers can attempt recovery/checks themselves,
    // but surface a warning so logs indicate the partial readiness.
    console.warn(
      `[DaytonaSandboxManager] Sandbox ${sandboxId} did not become fully ready within ${timeoutMs}ms - returning sandbox object for further checks`,
    );
    return sandbox;
  } catch (error) {
    console.error(
      `[DaytonaSandboxManager] Failed to start sandbox ${sandboxId}:`,
      error,
    );
    return null;
  }
}

/**
 * Start the development server for a project
 */
export async function startDevServer(
  sandbox: Sandbox,
  projectId: string,
): Promise<void> {
  try {
    console.log(
      `[DaytonaSandboxManager] Starting dev server for project ${projectId}`,
    );

    const devServerSessionId = `dev-server-${projectId}`;

    // Check if session already exists
    try {
      const existingSession =
        await sandbox.process.getSession(devServerSessionId);
      if (existingSession) {
        console.log(
          `[DaytonaSandboxManager] Dev server session already exists for project ${projectId}`,
        );
        return;
      }
    } catch (error) {
      // Session doesn't exist, continue
    }

    // Create new session and start dev server in workspace
    await sandbox.process.createSession(devServerSessionId);

    // Change to workspace directory first
    await sandbox.process.executeSessionCommand(devServerSessionId, {
      command: "cd ./workspace",
    });

    // Clear Vite cache and touch CSS file to force Tailwind CSS rebuild
    // This prevents stale Tailwind styles when sandbox is recreated from snapshot
    await sandbox.process.executeSessionCommand(devServerSessionId, {
      command: CLEAR_VITE_CACHE_COMMAND,
    });

    // Start the dev server in the background from workspace
    const commandResult = await sandbox.process.executeSessionCommand(
      devServerSessionId,
      {
        command: "bun dev",
        async: true,
      },
    );

    console.log(
      `[DaytonaSandboxManager] Dev server started successfully for project ${projectId}`,
    );

    // Get dev server logs after startup
    if (commandResult.cmdId) {
      // wait a few seconds for logs to accumulate
      await new Promise((resolve) => setTimeout(resolve, 5000));
      try {
        const logs = await sandbox.process.getSessionCommandLogs(
          devServerSessionId,
          commandResult.cmdId,
        );
        if (logs.stdout) {
          console.log(`[DevServer STDOUT]:`, logs.stdout);
        }
        if (logs.stderr) {
          console.log(`[DevServer STDERR]:`, logs.stderr);
        }
        if (logs.output) {
          console.log(`[DevServer Output]:`, logs.output);
        }
      } catch (logError) {
        console.warn(
          `[DaytonaSandboxManager] Could not get dev server logs:`,
          logError,
        );
      }
    }

    // Inject monitoring script into index.html after dev server starts
    try {
      // Use the new file-based injection method
      const { setupSandboxMonitoring } = await import(
        "./sandbox-monitor-injection.js"
      );
      await setupSandboxMonitoring(sandbox, sandbox.id, projectId);
    } catch (monitorError) {
      console.warn(
        `[DaytonaSandboxManager] Failed to inject monitoring script (non-critical):`,
        monitorError,
      );
      // Don't throw - monitoring injection failure shouldn't break dev server startup
    }
  } catch (error) {
    console.error(
      `[DaytonaSandboxManager] Failed to start dev server for project ${projectId}:`,
      error,
    );
    throw error;
  }
}

/**
 * Stop the development server for a project
 */
export async function stopDevServer(
  sandbox: Sandbox,
  projectId: string,
): Promise<void> {
  try {
    console.log(
      `[DaytonaSandboxManager] Stopping dev server for project ${projectId}`,
    );

    const devServerSessionId = `dev-server-${projectId}`;

    // Check if session exists before trying to delete
    try {
      const session = await sandbox.process.getSession(devServerSessionId);
      if (session) {
        await sandbox.process.deleteSession(devServerSessionId);
        console.log(
          `[DaytonaSandboxManager] Dev server stopped successfully for project ${projectId}`,
        );
      } else {
        console.log(
          `[DaytonaSandboxManager] No dev server session found for project ${projectId}`,
        );
      }
    } catch (error) {
      console.log(
        `[DaytonaSandboxManager] Dev server session not found or already stopped for project ${projectId}`,
      );
    }
  } catch (error) {
    console.error(
      `[DaytonaSandboxManager] Failed to stop dev server for project ${projectId}:`,
      error,
    );
    throw error;
  }
}

/**
 * Check if the development server is running for a project
 */
export async function isDevServerRunning(
  sandbox: Sandbox,
  projectId: string,
): Promise<boolean> {
  try {
    const devServerSessionId = `dev-server-${projectId}`;
    const session = await sandbox.process.getSession(devServerSessionId);

    if (!session) {
      return false;
    }

    // Check if the session has any running commands
    const hasRunningCommands = session.commands?.some(
      (cmd: any) => cmd.status === "running" || cmd.exitCode === null,
    );

    return !!hasRunningCommands;
  } catch (error) {
    console.log(
      `[DaytonaSandboxManager] Dev server not running for project ${projectId}`,
    );
    return false;
  }
}

/**
 * Get development server status for a project
 */
export async function getDevServerStatus(
  sandbox: Sandbox,
  projectId: string,
): Promise<{
  isRunning: boolean;
  sessionId: string;
  commands: any[];
}> {
  try {
    const devServerSessionId = `dev-server-${projectId}`;
    const session = await sandbox.process.getSession(devServerSessionId);

    if (!session) {
      return {
        isRunning: false,
        sessionId: devServerSessionId,
        commands: [],
      };
    }

    const isRunning = session.commands?.some(
      (cmd: any) => cmd.status === "running" || cmd.exitCode === null,
    );

    return {
      isRunning: !!isRunning,
      sessionId: devServerSessionId,
      commands: session.commands || [],
    };
  } catch (error: any) {
    // Session not found is expected when dev server hasn't been started yet
    if (error?.message?.includes("session not found")) {
      console.log(
        `[DaytonaSandboxManager] Dev server session not found for project ${projectId} (not started yet)`,
      );
    } else {
      console.log(
        `[DaytonaSandboxManager] Failed to get dev server status for project ${projectId}:`,
        error,
      );
    }
    return {
      isRunning: false,
      sessionId: `dev-server-${projectId}`,
      commands: [],
    };
  }
}

/**
 * Get preview information for a specific port
 */
export async function getPreviewInfo(
  sandbox: Sandbox,
  port: number,
): Promise<{ url: string; token?: string }> {
  try {
    console.log(
      `[DaytonaSandboxManager] Getting preview info for port ${port}`,
    );
    const previewInfo = await sandbox.getPreviewLink(port);
    return {
      url: transformToShipperDomain(previewInfo.url),
      token: previewInfo.token,
    };
  } catch (error) {
    console.error(
      `[DaytonaSandboxManager] Failed to get preview info for port ${port}:`,
      error,
    );
    throw error;
  }
}

/**
 * Get all available preview links for common development ports
 */
export async function getAllPreviewLinks(
  sandbox: Sandbox,
): Promise<Record<number, { url: string; token?: string }>> {
  const commonPorts = [3000, 3001, 5173, 5174, 8000, 8080, 9000];
  const previewLinks: Record<number, { url: string; token?: string }> = {};

  for (const port of commonPorts) {
    try {
      const previewInfo = await getPreviewInfo(sandbox, port);
      previewLinks[port] = previewInfo;
    } catch (error) {
      console.warn(
        `[DaytonaSandboxManager] Could not get preview for port ${port}:`,
        error,
      );
    }
  }

  return previewLinks;
}

/**
 * Get headers to skip the Daytona warning page
 */
export function getSkipWarningHeaders(): Record<string, string> {
  return {
    "X-Daytona-Skip-Preview-Warning": "true",
  };
}

/**
 * Ensure sandbox is running and dev server is started.
 *
 * This helper will:
 *  - call getSandbox(projectId) to obtain sandbox info
 *  - if sandbox exists, attempt to start the sandbox (idempotent)
 *  - attempt to start the project's dev server session in the sandbox
 *  - return the (possibly refreshed) Sandbox instance for further operations
 *
 * It is intentionally conservative: if any individual step fails we will still
 * return the Sandbox instance where possible so callers can attempt to fetch
 * preview info and surface errors to the client.
 */
export async function ensureSandboxRunning(
  projectId: string,
  port: number = 5173,
): Promise<Sandbox> {
  console.log("[DaytonaSandboxManager] Ensuring sandbox is running...");
  // Try to get sandbox info (this will attempt file listing and may trigger limited recovery)
  const sandboxInfo = await getSandbox(projectId);
  if (!sandboxInfo) {
    throw new Error(`No sandbox found for project ${projectId}`);
  }

  let sandbox = sandboxInfo.sandbox;

  // Attempt to start the sandbox (idempotent)
  try {
    const started = await startSandbox(sandbox.id);
    if (started) {
      // Use returned instance when available (fresh object/state)
      sandbox = started;
    }
  } catch (err) {
    // Non-fatal - we'll continue and try to start dev server / fetch preview
    console.warn(
      `[DaytonaSandboxManager] ensureSandboxRunning: startSandbox failed for ${sandbox.id}:`,
      err,
    );
  }

  // Attempt to start the dev server (best-effort)
  try {
    // Only attempt if sandbox object has process APIs available
    if (sandbox && typeof startDevServer === "function") {
      await startDevServer(sandbox, projectId);
    }
  } catch (err) {
    // Non-fatal - dev server might already be running or setup may be incomplete
    console.warn(
      `[DaytonaSandboxManager] ensureSandboxRunning: startDevServer failed for ${sandbox.id}:`,
      err,
    );
  }

  // Wait a short period for services to become available before returning
  await new Promise((resolve) => setTimeout(resolve, 1500));

  return sandbox;
}

/**
 * Get fresh preview authentication info for frontend use
 * This generates a new token for each user session
 *
 * NOTE: This version ensures the sandbox and dev server are started (best-effort)
 * before requesting preview links / tokens.
 */
export async function getPreviewAuthForSession(
  projectId: string,
  port: number = 5173,
): Promise<{
  url: string;
  authenticatedUrl: string;
  headers: Record<string, string>;
  token?: string;
}> {
  try {
    console.log(
      `[DaytonaSandboxManager] Getting fresh preview auth for project ${projectId}, port ${port}`,
    );

    // Ensure sandbox and dev server are running (best-effort)
    const sandbox = await ensureSandboxRunning(projectId, port);

    // Get fresh preview info with token (may still throw if preview not available)
    const previewInfo = await sandbox.getPreviewLink(port);

    // Transform URLs to use shipper.now domain
    const transformedUrl = transformToShipperDomain(previewInfo.url);

    // Don't expose the authentication token in the URL
    // The token should be used in headers or a separate authentication mechanism
    const authenticatedUrl = transformedUrl;

    // Get authentication headers
    const headers = await getAuthenticatedPreviewHeaders(sandbox, port);

    // Persist the latest sandbox URL to the project row (best-effort)
    // Only update if this is actually a Daytona sandbox
    try {
      if (transformedUrl) {
        const projectForProviderCheck = await prisma.project.findUnique({
          where: { id: projectId },
          select: { sandboxProvider: true },
        });

        // Only update if this is actually a Daytona sandbox
        if (projectForProviderCheck?.sandboxProvider !== "modal") {
          await prisma.project.update({
            where: { id: projectId },
            data: { sandboxUrl: transformedUrl },
          });
        } else {
          console.log(
            `[DaytonaSandboxManager] getPreviewAuthForSession: Skipping sandboxUrl update for Modal sandbox project ${projectId}`,
          );
        }
      }
    } catch (dbErr) {
      console.warn(
        `[DaytonaSandboxManager] getPreviewAuthForSession: failed to update sandboxUrl in DB for project ${projectId}:`,
        dbErr,
      );
    }

    return {
      url: transformedUrl,
      authenticatedUrl,
      headers,
      token: previewInfo.token,
    };
  } catch (error) {
    console.error(
      `[DaytonaSandboxManager] Failed to get preview auth for session:`,
      error,
    );
    throw error;
  }
}

/**
 * Get authentication headers with fresh token for preview requests
 */
export async function getPreviewAuthHeaders(
  sandbox: Sandbox,
  port: number = 5173,
): Promise<Record<string, string>> {
  try {
    const previewInfo = await sandbox.getPreviewLink(port);
    if (!previewInfo.token) {
      return {};
    }

    return {
      "X-Daytona-Preview-Token": previewInfo.token,
    };
  } catch (error) {
    console.error(
      `[DaytonaSandboxManager] Failed to get preview auth headers:`,
      error,
    );
    return {};
  }
}

/**
 * Get complete headers for authenticated preview requests (including skip warning)
 */
export async function getAuthenticatedPreviewHeaders(
  sandbox: Sandbox,
  port: number = 5173,
): Promise<Record<string, string>> {
  const authHeaders = await getPreviewAuthHeaders(sandbox, port);
  return {
    ...authHeaders,
    ...getSkipWarningHeaders(),
  };
}

/**
 * Filter sensitive information from deployment logs - only show build output
 */
function filterSensitiveLogs(logs: string): string {
  // Extract only the build output, removing sensitive deployment info
  const buildOutputMatch = logs.match(
    /Build output:\s*([\s\S]*?)(?=\n(?:Deployment|ERROR:|$))/,
  );
  if (buildOutputMatch) {
    return `Build output:\n${buildOutputMatch[1].trim()}`;
  }

  // Fallback: if no "Build output:" found, return the logs but filter sensitive info
  return logs
    .replace(/Deployment URL: https?:\/\/[^\s]+/g, "Deployment URL: [HIDDEN]")
    .replace(/App Name: [^\n\r]+/g, "App Name: [HIDDEN]")
    .replace(/Bearer [^\s"']+/gi, "Bearer [HIDDEN]")
    .replace(/Authorization: [^\n\r]+/gi, "Authorization: [HIDDEN]")
    .replace(/apiKey['":\s]+=\s*['"][^'"]+['"]/gi, "apiKey: [HIDDEN]")
    .replace(
      /DEPLOYMENT_PLANE_API_KEY['":\s]+=\s*['"][^'"]+['"]/gi,
      "DEPLOYMENT_PLANE_API_KEY: [HIDDEN]",
    )
    .replace(/https?:\/\/[^\s"']+/g, "[URL_FILTERED]");
}

/**
 * Deploy sandbox contents by trying zip/curl first, falling back to Node.js script
 */
export async function deploySandboxApp(
  sandbox: Sandbox,
  projectId: string,
  appName?: string,
): Promise<{
  success: boolean;
  deploymentUrl?: string;
  error?: string;
  logs: string;
}> {
  try {
    console.log(
      `[DaytonaSandboxManager] Starting deployment for project ${projectId}`,
    );

    const deploymentUrl = process.env.DEPLOYMENT_PLANE_URL;
    if (!deploymentUrl) {
      throw new Error(
        "DEPLOYMENT_PLANE_URL environment variable is not configured",
      );
    }

    console.log(
      `[DaytonaSandboxManager] Using deployment URL from env: ${deploymentUrl}`,
    );

    const apiKey = process.env.DEPLOYMENT_PLANE_API_KEY;
    if (!apiKey) {
      throw new Error(
        "DEPLOYMENT_PLANE_API_KEY environment variable is not configured",
      );
    }

    // Use project ID as app name if not provided, sanitized for deployment
    const sanitizedAppName = appName || `shipper-app-${projectId}`;

    // First, try the zip/curl approach
    try {
      console.log(
        `[DaytonaSandboxManager] Attempting zip/curl deployment for: ${sanitizedAppName}`,
      );

      return await deployWithZipCurl(
        sandbox,
        projectId,
        sanitizedAppName,
        deploymentUrl,
      );
    } catch (zipError) {
      console.warn(
        `[DaytonaSandboxManager] Zip/curl deployment failed, falling back to Node.js script:`,
        zipError instanceof Error ? zipError.message : String(zipError),
      );

      // Fall back to Node.js script approach
      console.log(
        `[DaytonaSandboxManager] Creating Node.js deployment script for: ${sanitizedAppName}`,
      );

      return await deployWithNodeScript(
        sandbox,
        projectId,
        sanitizedAppName,
        deploymentUrl,
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `[DaytonaSandboxManager] Failed to deploy sandbox app for project ${projectId}:`,
      errorMessage,
    );

    return {
      success: false,
      error: errorMessage,
      logs: filterSensitiveLogs(`Deployment failed: ${errorMessage}`),
    };
  }
}

/**
 * Deploy using zip and curl commands (more efficient)
 */
async function deployWithZipCurl(
  sandbox: Sandbox,
  projectId: string,
  sanitizedAppName: string,
  deploymentUrl: string,
): Promise<{
  success: boolean;
  deploymentUrl?: string;
  error?: string;
  logs: string;
}> {
  const apiKey = process.env.DEPLOYMENT_PLANE_API_KEY;
  if (!apiKey) {
    throw new Error("DEPLOYMENT_PLANE_API_KEY is required for deployment");
  }

  const zipFileName = `${sanitizedAppName}.zip`;

  // Step 1: Build the application
  console.log(`[DaytonaSandboxManager] Building application...`);
  const buildCommand = `cd /home/daytona/workspace && bun run build`;

  const buildResult = await sandbox.process.executeCommand(buildCommand);

  if (buildResult.exitCode !== 0) {
    // Extract detailed error information from build output
    const buildOutput =
      buildResult.result ||
      buildResult.artifacts?.stdout ||
      "build command failed";
    // Include full error details
    const errorMessage = buildOutput.includes("error TS")
      ? buildOutput // TypeScript errors - include full output
      : `Failed to build application:\n${buildOutput}`;
    throw new Error(errorMessage);
  }

  console.log(`[DaytonaSandboxManager] Application built successfully`);

  // Step 2: Determine build output directory
  const detectBuildDirCommand = `cd /home/daytona/workspace && (test -d dist && echo "dist") || (test -d build && echo "build") || (test -d out && echo "out") || echo "."`;

  const buildDirResult = await sandbox.process.executeCommand(
    detectBuildDirCommand,
  );
  const buildDir = buildDirResult.result?.trim() || "dist";

  console.log(`[DaytonaSandboxManager] Using build directory: ${buildDir}`);

  // Step 3: Create zip file of build output
  const createZipCommand = `cd /home/daytona/workspace/${buildDir} && zip -r /tmp/${zipFileName} .`;

  const zipResult = await sandbox.process.executeCommand(createZipCommand);

  if (zipResult.exitCode !== 0) {
    throw new Error(
      `Failed to create zip file from build output: ${
        zipResult.result || "zip command not available or failed"
      }`,
    );
  }

  console.log(
    `[DaytonaSandboxManager] Zip file created successfully from ${buildDir}`,
  );

  // Step 2: Deploy using curl with enhanced error reporting
  // Add -w to output HTTP status code, --show-error for errors, --connect-timeout and --max-time for timeouts
  const curlCommand = `curl -s --show-error -w "\\nHTTP_STATUS_CODE:%{http_code}" --connect-timeout 30 --max-time 120 -X POST -H "bypass-tunnel-reminder: true" -H "Authorization: Bearer ${apiKey}" -F "projectId=${projectId}" -F "name=${sanitizedAppName}" -F "app=@/tmp/${zipFileName}" "${deploymentUrl}/api/deploy"`;

  console.log(
    `[DaytonaSandboxManager] Deploying via curl to URL: ${deploymentUrl}/api/deploy`,
  );
  console.log(
    `[DaytonaSandboxManager] Project ID: ${projectId}, App Name: ${sanitizedAppName}`,
  );

  // Try deployment with retry logic
  let deployResult;
  let retryCount = 0;
  const maxRetries = 2;

  while (retryCount <= maxRetries) {
    if (retryCount > 0) {
      console.log(
        `[DaytonaSandboxManager] Retrying deployment (attempt ${retryCount + 1}/${maxRetries + 1})...`,
      );
      // Wait a bit before retry
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    deployResult = await sandbox.process.executeCommand(curlCommand);

    // Check if we got a successful response or should retry
    if (deployResult.exitCode === 0 && deployResult.result) {
      const result = deployResult.result;
      // Check for connection errors that warrant a retry
      if (
        result.includes(
          '"error":"Deployment failed: Deployment validation failed: Error: closed"',
        )
      ) {
        console.log(
          `[DaytonaSandboxManager] Connection closed error detected, will retry if attempts remain`,
        );
        retryCount++;
        if (retryCount > maxRetries) {
          break; // Exit loop, we've exhausted retries
        }
      } else {
        break; // Success or different error, don't retry
      }
    } else {
      break; // Non-zero exit code, don't retry
    }
  }

  // Step 3: Clean up temporary zip file
  await sandbox.process.executeCommand(`rm -f /tmp/${zipFileName}`);

  // Check if deployResult is undefined (should not happen, but TypeScript safety)
  if (!deployResult) {
    throw new Error("Deployment result is undefined");
  }

  const logs = filterSensitiveLogs(
    [
      `Build: ${buildResult.result || "Success"}`,
      `Build Directory: ${buildDir}`,
      `ZIP Creation: Success`,
      `Deployment Response: ${deployResult.result || "No response"}`,
    ].join("\n"),
  );

  // Extract HTTP status code if present
  let httpStatusCode: string | undefined;
  let responseText = deployResult.result || "";

  const statusMatch = responseText.match(/HTTP_STATUS_CODE:(\d+)/);
  if (statusMatch) {
    httpStatusCode = statusMatch[1];
    // Remove the status code from the response text
    responseText = responseText.replace(/\nHTTP_STATUS_CODE:\d+/, "");
  }

  // Add detailed logging for debugging
  console.log(`[DaytonaSandboxManager] Raw deployment response:`, {
    exitCode: deployResult.exitCode,
    httpStatusCode,
    result: responseText,
    resultLength: responseText.length || 0,
    resultType: typeof responseText,
    attempts: retryCount + 1,
  });

  if (deployResult.exitCode === 0) {
    // Try to parse deployment response for deployment URL
    let actualDeploymentUrl: string | undefined;

    try {
      // Try to extract JSON from curl output (in case curl progress info is included)
      let jsonText = responseText;
      const jsonMatch = responseText.match(/(\{.*\})/);
      if (jsonMatch) {
        jsonText = jsonMatch[1];
      }

      const response = JSON.parse(jsonText);
      console.log(`[DaytonaSandboxManager] Parsed JSON response:`, response);

      // Check if the deployment was successful
      if (response.success === false) {
        // Don't catch this error - let it propagate up
        const errorMessage = `Deployment failed: ${response.error || "Unknown error"}`;
        console.error(`[DaytonaSandboxManager] ${errorMessage}`);
        throw new Error(errorMessage);
      }

      actualDeploymentUrl =
        response.url || response.deploymentUrl || response.link;

      console.log(
        `[DaytonaSandboxManager] Extracted deployment URL from JSON:`,
        {
          url: response.url,
          deploymentUrl: response.deploymentUrl,
          link: response.link,
          actualDeploymentUrl,
        },
      );

      // Clean up any trailing quotes or brackets from the URL
      if (actualDeploymentUrl) {
        actualDeploymentUrl = actualDeploymentUrl.replace(/["}'\]]+$/, "");
        
        // Force HTTPS for staging/production deployments
        actualDeploymentUrl = forceHttpsForDeployments(actualDeploymentUrl, 'DaytonaSandboxManager');
      }
    } catch (parseError) {
      // First check if this is a deployment failure we threw ourselves
      if (
        parseError instanceof Error &&
        parseError.message.startsWith("Deployment failed:")
      ) {
        // Re-throw deployment failures immediately
        throw parseError;
      }

      console.log(
        `[DaytonaSandboxManager] JSON parse failed, trying URL extraction:`,
        parseError instanceof Error ? parseError.message : String(parseError),
      );
      // If response isn't JSON, it might be an error page or HTML
      // Check if we got an HTML response (indicates deployment service issue)
      if (
        responseText.includes("<html>") ||
        responseText.includes("<!DOCTYPE")
      ) {
        console.warn(
          "[DaytonaSandboxManager] Received HTML response instead of JSON - deployment service may not be running",
        );
        throw new Error(
          "Deployment service returned HTML instead of JSON response. The deployment service may not be running or accessible.",
        );
      }

      // Look for deployment URLs, but exclude static assets and ngrok landing page URLs
      const urlMatches = responseText.match(/https?:\/\/[^\s"'}<>]+/g) || [];
      console.log(`[DaytonaSandboxManager] Found URL matches:`, urlMatches);

      const validDeploymentUrls = urlMatches.filter((url) => {
        const lowerUrl = url.toLowerCase();
        // Exclude static assets and known non-deployment URLs
        const isValid =
          !lowerUrl.includes("/static/") &&
          !lowerUrl.includes(".woff") &&
          !lowerUrl.includes(".css") &&
          !lowerUrl.includes(".js") &&
          !lowerUrl.includes(".png") &&
          !lowerUrl.includes(".jpg") &&
          !lowerUrl.includes("cdn.ngrok.com") &&
          !lowerUrl.includes("ngrok.com/static/");

        console.log(`[DaytonaSandboxManager] URL ${url} is valid: ${isValid}`);
        return isValid;
      });

      console.log(
        `[DaytonaSandboxManager] Valid deployment URLs:`,
        validDeploymentUrls,
      );

      if (validDeploymentUrls.length > 0) {
        actualDeploymentUrl = validDeploymentUrls[0].replace(/["}'\]]+$/, "");
        
        // Force HTTPS for staging/production deployments
        actualDeploymentUrl = forceHttpsForDeployments(actualDeploymentUrl, 'DaytonaSandboxManager');
        
        console.log(
          `[DaytonaSandboxManager] Selected deployment URL:`,
          actualDeploymentUrl,
        );
      }
    }

    console.log(
      `[DaytonaSandboxManager] Zip/curl deployment successful for project ${projectId}`,
      { deploymentUrl: actualDeploymentUrl },
    );

    return {
      success: true,
      deploymentUrl: actualDeploymentUrl,
      logs,
    };
  } else {
    throw new Error(
      `Curl deployment failed: ${deployResult.result || "curl command failed"}`,
    );
  }
}

/**
 * Deploy using Node.js script (fallback when zip/curl not available)
 */
async function deployWithNodeScript(
  sandbox: Sandbox,
  projectId: string,
  sanitizedAppName: string,
  deploymentUrl: string,
): Promise<{
  success: boolean;
  deploymentUrl?: string;
  error?: string;
  logs: string;
}> {
  // Step 1: Create a Node.js deployment script inside the sandbox
  const apiKey = process.env.DEPLOYMENT_PLANE_API_KEY;
  if (!apiKey) {
    throw new Error("DEPLOYMENT_PLANE_API_KEY is required for deployment");
  }
  const deploymentScript = `
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

async function deployApp() {
  try {
    console.log('Starting deployment process...');
    console.log('App Name:', '${sanitizedAppName}');

    const deploymentUrl = '${deploymentUrl}';
    const appName = '${sanitizedAppName}';
    const apiKey = '${apiKey}';
    
    // Build the application first
    console.log('Building application...');
    const { execSync } = require('child_process');

    try {
      // Skip TypeScript compilation during build to reduce memory usage in resource-constrained sandbox
      // Use bunx to run vite (which finds it in node_modules/.bin)
      const buildOutput = execSync('bunx vite build 2>&1', {
        cwd: '/home/daytona/workspace',
        encoding: 'utf8',
        stdio: 'pipe'
      });
      console.log('Application built successfully');
      console.log('Build output:', buildOutput);
    } catch (buildError) {
      console.error('Build failed:', buildError.message);
      // Include stderr output if available
      const errorOutput = buildError.stdout || buildError.stderr || buildError.message;
      console.error('Build output:', errorOutput);
      // Escape the error output to prevent breaking the template string
      const escapedError = String(errorOutput).replace(/'/g, "\\\\'").replace(/\\n/g, "\\\\n");
      throw new Error('Failed to build application: ' + escapedError);
    }
    
    // Determine build output directory
    console.log('Determining build output directory...');
    let buildDir = 'dist'; // default
    try {
      if (require('fs').existsSync('/home/daytona/workspace/dist')) {
        buildDir = 'dist';
      } else if (require('fs').existsSync('/home/daytona/workspace/build')) {
        buildDir = 'build';
      } else if (require('fs').existsSync('/home/daytona/workspace/out')) {
        buildDir = 'out';
      } else {
        buildDir = '.'; // fallback to root if no build dir found
      }
    } catch (e) {
      console.warn('Could not detect build directory, using dist');
      buildDir = 'dist';
    }
    
    console.log('Using build directory:', buildDir);
    
    // Find all files in build output directory
    console.log('Finding files in build directory...');
    const findCommand = \`find /home/daytona/workspace/\${buildDir} -type f | head -500\`;
    
    console.log('Executing find command...');
    const findOutput = execSync(findCommand, { encoding: 'utf8' });
    console.log('Find command completed, processing results...');
    
    const filePaths = findOutput
      .split('\\n')
      .filter(p => p.trim() && p.startsWith('/home/daytona/workspace/'))
      .slice(0, 500);
    
    console.log(\`Found \${filePaths.length} files to deploy\`);
    
    if (filePaths.length === 0) {
      console.log('Find output was:', findOutput);
      throw new Error('No files found to deploy');
    }
    
    // Read all files and prepare payload
    console.log('Reading file contents...');
    const files = [];
    let readCount = 0;
    
    for (const fullPath of filePaths) {
      try {
        // Remove the build directory prefix to get the relative path for deployment
        const relativePath = fullPath.replace(\`/home/daytona/workspace/\${buildDir}/\`, '');
        if (!relativePath || relativePath === '.') continue;
        
        // Check if file is binary by extension
        const isBinary = /\\.(jpg|jpeg|png|gif|ico|svg|pdf|zip|tar|gz|mp4|mp3|woff|woff2|ttf|eot)$/i.test(relativePath);
        
        const content = fs.readFileSync(fullPath);
        files.push({
          path: relativePath,
          content: isBinary ? content.toString('base64') : content.toString('utf8'),
          encoding: isBinary ? 'base64' : 'utf8'
        });
        
        readCount++;
        if (readCount % 10 === 0) {
          console.log(\`Read \${readCount} files so far...\`);
        }
      } catch (err) {
        console.warn(\`Failed to read \${fullPath}: \${err.message}\`);
      }
    }
    
    console.log(\`Successfully read \${files.length} files\`);
    
    if (files.length === 0) {
      throw new Error('No readable files found for deployment');
    }
    
    // Send HTTP request
    console.log('Preparing HTTP request...');
    const payload = JSON.stringify({ projectId: '${projectId}', name: appName, files });
    console.log(\`Payload size: \${payload.length} bytes\`);
    
    const url = new URL(deploymentUrl + '/api/deploy/direct');
    
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
      'User-Agent': 'Shipper-Sandbox-Deployer/1.0',
      'bypass-tunnel-reminder': 'true'
    };

    // Always add Authorization header since API key is required
    headers['Authorization'] = 'Bearer ' + apiKey;

    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: headers
    };
    
    const client = url.protocol === 'https:' ? https : http;
    console.log(\`Using \${url.protocol === 'https:' ? 'HTTPS' : 'HTTP'} client\`);
    console.log(\`Request options: \${JSON.stringify(options)}\`);

    // Verify client is properly initialized
    if (!client || typeof client.request !== 'function') {
      console.error('HTTP client not properly initialized');
      throw new Error('HTTP client not properly initialized');
    }

    return new Promise((resolve, reject) => {
      console.log('Creating HTTP request...');

      let req;
      try {
        req = client.request(options, (res) => {
        try {
          // Ensure res is a valid response object with detailed error info
          if (!res) {
            console.error('ERROR: Received null or undefined response object');
            reject(new Error('HTTP client returned null/undefined response'));
            return;
          }
          if (typeof res.on !== 'function') {
            console.error('ERROR: Response object missing .on method');
            console.error('Response type:', typeof res);
            console.error('Response keys:', Object.keys(res || {}));
            reject(new Error('Invalid response object - missing .on method'));
            return;
          }

          console.log(\`Got response with status: \${res.statusCode}\`);
          let data = '';

          res.on('data', (chunk) => {
            data += chunk;
            console.log(\`Received \${chunk.length} bytes\`);
          });

          res.on('end', () => {
          console.log(\`Response complete. Total data: \${data.length} bytes\`);
          console.log(\`Response status: \${res.statusCode}\`);
          console.log(\`Response body: \${data}\`);
          
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const response = JSON.parse(data);
              let deploymentUrl = response.url || response.deploymentUrl || response.link;
              
              // Clean up any trailing quotes or brackets from the URL
              if (deploymentUrl) {
                deploymentUrl = deploymentUrl.replace(/["}'\]]+$/, '');
              }
              
              resolve({
                success: true,
                deploymentUrl: deploymentUrl,
                response: data
              });
            } catch (e) {
              console.log('Response was not JSON, trying to extract URL...');
              // Try to extract URL from text response
              const urlMatch = data.match(/https?:\\/\\/[^\\s"'}]+/);
              let deploymentUrl = urlMatch ? urlMatch[0] : undefined;
              
              // Clean up any trailing quotes or brackets from the URL
              if (deploymentUrl) {
                deploymentUrl = deploymentUrl.replace(/["}'\]]+$/, '');
              }
              
              resolve({
                success: true,
                deploymentUrl: deploymentUrl,
                response: data
              });
            }
          } else {
            reject(new Error(\`HTTP \${res.statusCode}: \${data}\`));
          }
        });
        } catch (resError) {
          console.error('ERROR in response handler:', resError.message);
          console.error('Response handler stack:', resError.stack);
          reject(new Error(\`Response handler error: \${resError.message}\`));
        }
      });
      } catch (reqError) {
        console.error('Failed to create HTTP request:', reqError.message);
        reject(new Error(\`Failed to create HTTP request: \${reqError.message}\`));
        return;
      }

      if (!req || typeof req.on !== 'function') {
        console.error('Invalid request object created');
        reject(new Error('Invalid request object created'));
        return;
      }

      req.on('error', (err) => {
        console.log('HTTP request error:', err.message);
        reject(err);
      });

      req.on('timeout', () => {
        console.log('HTTP request timed out');
        req.destroy();
        reject(new Error('Request timed out'));
      });

      // Set a 2 minute timeout for the request
      req.setTimeout(120000);

      console.log('Writing payload to request...');
      req.write(payload);
      console.log('Ending request...');
      req.end();
      console.log('Request sent, waiting for response...');
    });
    
  } catch (error) {
    console.error('Deployment failed:', error.message);
    throw error;
  }
}

deployApp()
  .then(result => {
    console.log('SUCCESS:', JSON.stringify(result));
    process.exit(0);
  })
  .catch(error => {
    console.error('ERROR:', error.message);
    process.exit(1);
  });
`;

  // Step 2: Execute the deployment script directly without writing to file
  // This avoids Buffer/uploadFile issues in Vercel's Node.js runtime
  console.log(
    `[DaytonaSandboxManager] Executing Node.js deployment script for ${sanitizedAppName}...`,
  );
  console.log(
    `[DaytonaSandboxManager] Deployment URL: ${deploymentUrl}/api/deploy`,
  );

  // Execute deployment script directly using node -e
  // Escape single quotes in the script for shell safety
  const escapedScript = deploymentScript.replace(/'/g, "'\\''");

  const deployResult = await sandbox.process.executeCommand(
    `node -e '${escapedScript}'`,
    "/home/daytona/workspace",
    undefined,
    120, // 2 minute timeout for deployment
  );
  console.log("deployResult", deployResult);

  const logs = deployResult.result || "No output from deployment script";

  if (deployResult.exitCode === 0) {
    // Try to parse deployment response from script output
    let actualDeploymentUrl: string | undefined;

    try {
      // Look for SUCCESS: JSON output in the logs
      const successMatch = logs.match(/SUCCESS: ({.*})/);
      if (successMatch) {
        const result = JSON.parse(successMatch[1]);
        actualDeploymentUrl = result.deploymentUrl;
      }
    } catch (parseError) {
      // Check if we got HTML response indicating service issues
      if (logs.includes("<html>") || logs.includes("<!DOCTYPE")) {
        console.warn(
          "[DaytonaSandboxManager] Node.js script received HTML response - deployment service may not be running",
        );
        throw new Error(
          "Deployment service returned HTML instead of JSON response. The deployment service may not be running or accessible.",
        );
      }

      // Look for deployment URLs, but exclude static assets and ngrok landing page URLs
      const urlMatches = logs.match(/https?:\/\/[^\s"'}<>]+/g) || [];
      const validDeploymentUrls = urlMatches.filter((url) => {
        const lowerUrl = url.toLowerCase();
        // Exclude static assets and known non-deployment URLs
        return (
          !lowerUrl.includes("/static/") &&
          !lowerUrl.includes(".woff") &&
          !lowerUrl.includes(".css") &&
          !lowerUrl.includes(".js") &&
          !lowerUrl.includes(".png") &&
          !lowerUrl.includes(".jpg") &&
          !lowerUrl.includes("cdn.ngrok.com") &&
          !lowerUrl.includes("ngrok.com/static/")
        );
      });

      if (validDeploymentUrls.length > 0) {
        actualDeploymentUrl = validDeploymentUrls[0];
      }
    }

    console.log(
      `[DaytonaSandboxManager] Node.js deployment successful for project ${projectId}`,
      { deploymentUrl: actualDeploymentUrl },
    );

    return {
      success: true,
      deploymentUrl: actualDeploymentUrl,
      logs,
    };
  } else {
    throw new Error(
      `Node.js deployment script failed with exit code ${deployResult.exitCode}: ${logs}`,
    );
  }
}
