import { createRequire } from 'module';const require = createRequire(import.meta.url);
import {
  ErrorClassifier,
  VoltAgentService,
  connectorRegistry,
  encrypt,
  encryptCredentials,
  ensureSandboxRecovered,
  generateSpanId,
  getEnvironmentProperties,
  getFullStackPrompt,
  getNotionAuthUrlAsync,
  getPostHogCapture,
  getSandboxHealth,
  redisFileStreamPublisher,
  tools
} from "./chunk-PNGA2VSX.js";
import "./chunk-36RZ7HXC.js";
import {
  CloudflareSaaSService,
  createCloudflareService
} from "./chunk-HZ6DVTH4.js";
import {
  ErrorDetector
} from "./chunk-PX6JQF4A.js";
import {
  readFileFromSandbox,
  runCommandOnSandbox,
  writeFileToSandbox
} from "./chunk-Q73ELRDT.js";
import {
  SHIPPER_CLOUD_APPROVAL,
  executeShipperCloudDeploymentWithFiles,
  formatDeploymentError,
  formatDeploymentSuccess,
  injectDeployKeyIntoSandbox
} from "./chunk-KVFOHPGT.js";
import {
  cleanupOldSnapshots,
  createFilesystemSnapshot,
  createSandbox,
  deleteSandbox,
  deleteSnapshot,
  deploySandboxApp,
  executeCommand,
  findFiles,
  forceHttpsForDeployments,
  getSandbox,
  listFiles,
  readFile,
  restoreFilesById,
  restoreV2FragmentById,
  startDevServer,
  writeFile
} from "./chunk-IDZAZ4YU.js";
import {
  createProjectLogger,
  logger
} from "./chunk-TIBZDRCE.js";
import {
  prisma
} from "./chunk-YMWDDMLV.js";
import {
  init_esm_shims
} from "./chunk-IXOW5DJO.js";

// src/index.ts
init_esm_shims();
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { formatDate } from "@shipper/shared";

// src/routes/daytona.ts
init_esm_shims();
import {
  Router
} from "express";
import { z } from "zod";

// src/services/daytona-sandbox-manager.ts
init_esm_shims();
import { Daytona } from "@daytonaio/sdk";
import * as path from "path";

// src/services/turso-manager.ts
init_esm_shims();
import { createClient } from "@libsql/client";
var getTursoCredentials = () => {
  const TURSO_API_TOKEN = process.env.TURSO_API_TOKEN;
  const TURSO_ORG_NAME = process.env.TURSO_ORG_NAME;
  const TURSO_DB_GROUP = process.env.TURSO_DB_GROUP || "projects";
  logger.debug({
    msg: "Environment check",
    hasToken: !!TURSO_API_TOKEN,
    tokenLength: TURSO_API_TOKEN?.length,
    tokenPrefix: TURSO_API_TOKEN?.substring(0, 10) + "...",
    orgName: TURSO_ORG_NAME,
    dbGroup: TURSO_DB_GROUP
  });
  if (!TURSO_API_TOKEN || !TURSO_ORG_NAME || !TURSO_DB_GROUP) {
    const missing = [];
    if (!TURSO_API_TOKEN) missing.push("TURSO_API_TOKEN");
    if (!TURSO_ORG_NAME) missing.push("TURSO_ORG_NAME");
    if (!TURSO_DB_GROUP) missing.push("TURSO_DB_GROUP");
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
  return { TURSO_API_TOKEN, TURSO_ORG_NAME, TURSO_DB_GROUP };
};
var TURSO_API_BASE = "https://api.turso.tech/v1";
var provisionDatabase = async (projectId) => {
  const logger3 = createProjectLogger(projectId);
  const { TURSO_API_TOKEN, TURSO_ORG_NAME, TURSO_DB_GROUP } = getTursoCredentials();
  const databaseName = `project-${projectId.toLowerCase()}`;
  logger3.info({
    msg: "Provisioning database",
    databaseName,
    orgName: TURSO_ORG_NAME,
    dbGroup: TURSO_DB_GROUP
  });
  try {
    const createUrl = `${TURSO_API_BASE}/organizations/${TURSO_ORG_NAME}/databases`;
    logger3.info({ msg: "Creating database", createUrl });
    const createResponse = await fetch(createUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TURSO_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: databaseName,
        group: TURSO_DB_GROUP
      })
    });
    logger3.info({
      msg: "Create database response",
      status: createResponse.status,
      statusText: createResponse.statusText,
      ok: createResponse.ok
    });
    if (!createResponse.ok) {
      const error = await createResponse.text();
      logger3.error({
        msg: "Create database failed",
        status: createResponse.status,
        statusText: createResponse.statusText,
        error
      });
      throw new Error(`Failed to create Turso database: ${error}`);
    }
    const createResult = await createResponse.json();
    logger3.info({
      msg: "Database created successfully",
      hostname: createResult.database?.Hostname
    });
    const tokenUrl = `${TURSO_API_BASE}/organizations/${TURSO_ORG_NAME}/databases/${databaseName}/auth/tokens?expiration=never&authorization=full-access`;
    logger3.info({ msg: "Generating auth token", tokenUrl });
    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TURSO_API_TOKEN}`
      }
    });
    logger3.info({
      msg: "Token generation response",
      status: tokenResponse.status,
      statusText: tokenResponse.statusText,
      ok: tokenResponse.ok
    });
    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      logger3.error({
        msg: "Token generation failed",
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        error
      });
      throw new Error(`Failed to generate auth token: ${error}`);
    }
    const tokenResult = await tokenResponse.json();
    logger3.info({
      msg: "Token generated successfully",
      hasJwt: !!tokenResult.jwt,
      jwtLength: tokenResult.jwt?.length
    });
    const url = `libsql://${createResult.database.Hostname}`;
    logger3.info({
      msg: "Database provisioned successfully",
      databaseName,
      url
    });
    return {
      databaseName,
      url,
      authToken: tokenResult.jwt
      // Use 'jwt' field from response
    };
  } catch (error) {
    logger3.error({
      msg: "Error provisioning Turso database",
      databaseName,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : void 0
    });
    throw error;
  }
};

// src/services/daytona-sandbox-manager.ts
import { CLEAR_VITE_CACHE_COMMAND } from "@shipper/shared";
function transformToShipperDomain(daytonaUrl) {
  try {
    const url = new URL(daytonaUrl);
    const hostMatch = url.hostname.match(
      /^(\d+)-(.+?)\.proxy\.daytona\.works$/
    );
    if (hostMatch) {
      const [, port, sandboxId] = hostMatch;
      const useLocalhost = process.env.NODE_ENV === "development" || process.env.DAYTONA_USE_LOCALHOST === "true";
      if (useLocalhost) {
        url.hostname = `preview--${port}-${sandboxId}.localhost`;
        url.port = "3003";
        url.protocol = "http:";
      } else {
        url.hostname = `preview--${port}-${sandboxId}.shipper.now`;
      }
      console.log(
        `[transformToShipperDomain] Transformed ${daytonaUrl} -> ${url.toString()}`
      );
      return url.toString();
    }
    console.warn(
      `[transformToShipperDomain] URL doesn't match expected Daytona pattern: ${daytonaUrl}`
    );
    return daytonaUrl;
  } catch (error) {
    console.error(
      `[transformToShipperDomain] Failed to parse URL ${daytonaUrl}:`,
      error
    );
    return daytonaUrl;
  }
}
var daytona = new Daytona({
  apiKey: process.env.DAYTONA_API_KEY,
  organizationId: process.env.DAYTONA_ORGANIZATION_ID,
  target: "us"
});
async function getSandbox2(projectId) {
  try {
    console.log(
      `[DaytonaSandboxManager] Getting sandbox for project ${projectId}`
    );
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        daytonaSandboxId: true,
        sandboxUrl: true,
        sandboxExpiresAt: true,
        activeFragmentId: true,
        gitRepositoryUrl: true,
        currentBranch: true,
        gitCommitHash: true
      }
    });
    if (!project?.daytonaSandboxId) {
      console.log(
        `[DaytonaSandboxManager] No sandbox found in database for project ${projectId}`
      );
      return null;
    }
    console.log(
      `[DaytonaSandboxManager] Found sandbox ID in database: ${project.daytonaSandboxId}`
    );
    try {
      const sandbox = await daytona.findOne({
        id: project.daytonaSandboxId
      });
      if (!sandbox) {
        console.log(
          `[DaytonaSandboxManager] Sandbox ${project.daytonaSandboxId} not found at Daytona level`
        );
        await cleanupStaleSandboxReference(projectId);
        return null;
      }
      console.log(
        `[DaytonaSandboxManager] Successfully connected to existing sandbox ${sandbox.id}`
      );
      let sandboxUrl;
      try {
        const previewInfo = await sandbox.getPreviewLink(5173);
        sandboxUrl = transformToShipperDomain(previewInfo.url);
        const projectForProviderCheck = await prisma.project.findUnique({
          where: { id: projectId },
          select: { sandboxProvider: true }
        });
        if (projectForProviderCheck?.sandboxProvider !== "modal" && project.sandboxUrl !== sandboxUrl) {
          await prisma.project.update({
            where: { id: projectId },
            data: { sandboxUrl }
          });
          console.log(
            `[DaytonaSandboxManager] Updated database with fresh sandbox URL: ${sandboxUrl}`
          );
        }
      } catch (urlError) {
        console.warn(
          `[DaytonaSandboxManager] Failed to get fresh preview URL: ${urlError}`
        );
        if (project.sandboxUrl) {
          sandboxUrl = project.sandboxUrl;
          console.log(
            `[DaytonaSandboxManager] Using database URL as fallback: ${sandboxUrl}`
          );
        } else {
          sandboxUrl = `https://${sandbox.id}.daytona.app:5173`;
          console.log(
            `[DaytonaSandboxManager] Using fallback URL pattern: ${sandboxUrl}`
          );
        }
      }
      const files = await getRecursiveFileListFromSandbox(sandbox, projectId);
      const sandboxInfo = {
        sandbox,
        sandboxUrl,
        sandboxExpiresAt: project.sandboxExpiresAt,
        files,
        gitRepositoryUrl: project.gitRepositoryUrl === null ? void 0 : project.gitRepositoryUrl,
        currentBranch: project.currentBranch === null ? void 0 : project.currentBranch,
        gitCommitHash: project.gitCommitHash === null ? void 0 : project.gitCommitHash,
        projectId
      };
      console.log(
        `[DaytonaSandboxManager] Successfully retrieved sandbox info for project ${projectId}`,
        {
          sandboxId: sandbox.id,
          sandboxUrl,
          fileCount: files.size
        }
      );
      return sandboxInfo;
    } catch (findError) {
      const errorMessage = findError instanceof Error ? findError.message : String(findError);
      console.warn(
        `[DaytonaSandboxManager] Failed to connect to sandbox ${project.daytonaSandboxId}: ${errorMessage}`
      );
      console.log(
        `[DaytonaSandboxManager] Keeping sandbox reference ${project.daytonaSandboxId} - Daytona sandboxes are persistent and this may be recoverable`
      );
      return null;
    }
  } catch (error) {
    console.error(
      `[DaytonaSandboxManager] Error getting sandbox for project ${projectId}:`,
      error
    );
    return null;
  }
}
async function cleanupStaleSandboxReference(projectId) {
  try {
    console.log(
      `[DaytonaSandboxManager] Cleaning up stale sandbox reference for project ${projectId}`
    );
    await prisma.project.update({
      where: { id: projectId },
      data: {
        daytonaSandboxId: null,
        sandboxUrl: null,
        sandboxCreatedAt: null,
        sandboxExpiresAt: null
        // Keep git info as it's still valid
      }
    });
    console.log(
      `[DaytonaSandboxManager] Successfully cleaned up stale sandbox reference`
    );
  } catch (error) {
    console.error(
      `[DaytonaSandboxManager] Failed to cleanup stale sandbox reference:`,
      error
    );
  }
}
async function createSandbox2(projectId, fragmentId, templateName) {
  return createSandboxInternal(
    projectId,
    fragmentId,
    "full_restore" /* FULL_RESTORE */,
    templateName
  );
}
async function createSandboxInternal(projectId, fragmentId, recoveryMode = "full_restore" /* FULL_RESTORE */, templateName) {
  const timings = {
    start: Date.now(),
    sandboxCreate: { start: 0, end: 0 },
    previewUrl: { start: 0, end: 0 },
    dbUpdate: { start: 0, end: 0 },
    gitInfo: { start: 0, end: 0 },
    fragmentRestore: { start: 0, end: 0 },
    fileList: { start: 0, end: 0 },
    devServer: { start: 0, end: 0 }
  };
  try {
    console.log("[DaytonaSandboxManager] Starting sandbox creation", projectId);
    const TEMPLATES_VERSION = "v4";
    const snapshotName = `${templateName}-${TEMPLATES_VERSION}` || `vite-template-${TEMPLATES_VERSION}`;
    console.log("[DaytonaSandboxManager] Creating new Daytona sandbox", {
      projectId,
      originalFragmentId: fragmentId,
      template: snapshotName
    });
    timings.sandboxCreate.start = Date.now();
    const sandbox = await daytona.create(
      {
        snapshot: snapshotName,
        autoArchiveInterval: 30,
        // Auto-archive after a Sandbox has been stopped for 30 minutes
        public: false
      },
      {
        timeout: 0
      }
    );
    timings.sandboxCreate.end = Date.now();
    console.log("[DaytonaSandboxManager] Successfully created new sandbox", {
      sandboxId: sandbox.id,
      duration: `${timings.sandboxCreate.end - timings.sandboxCreate.start}ms`
    });
    const sandboxState = sandbox.state;
    const autoStopInterval = sandbox.autoStopInterval;
    console.log("[DaytonaSandboxManager] Got sandbox state", {
      sandboxState,
      autoStopInterval
    });
    timings.previewUrl.start = Date.now();
    const previewInfo = await sandbox.getPreviewLink(5173);
    const sandboxUrl = transformToShipperDomain(previewInfo.url);
    timings.previewUrl.end = Date.now();
    console.log("[DaytonaSandboxManager] Got sandbox URL:", {
      sandboxUrl,
      duration: `${timings.previewUrl.end - timings.previewUrl.start}ms`
    });
    console.log(
      "[DaytonaSandboxManager] Updating database with Daytona sandbox info"
    );
    timings.dbUpdate.start = Date.now();
    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: {
        daytonaSandboxId: sandbox.id,
        sandboxCreatedAt: /* @__PURE__ */ new Date(),
        sandboxExpiresAt: null,
        sandboxUrl
      }
    });
    timings.dbUpdate.end = Date.now();
    console.log("[DaytonaSandboxManager] Database updated successfully", {
      duration: `${timings.dbUpdate.end - timings.dbUpdate.start}ms`
    });
    console.log("[DaytonaSandboxManager] Checking Turso database...");
    try {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
          tursoDatabaseUrl: true,
          tursoDatabaseToken: true,
          tursoDatabaseName: true
        }
      });
      let tursoCredentials;
      if (project?.tursoDatabaseUrl && project?.tursoDatabaseToken) {
        console.log("[DaytonaSandboxManager] Using existing Turso database");
        tursoCredentials = {
          url: project.tursoDatabaseUrl,
          authToken: project.tursoDatabaseToken,
          databaseName: project.tursoDatabaseName || `project-${projectId}`
        };
      } else {
        console.log(
          "[DaytonaSandboxManager] Provisioning Turso database (fallback)..."
        );
        tursoCredentials = await provisionDatabase(projectId);
        await prisma.project.update({
          where: { id: projectId },
          data: {
            tursoDatabaseName: tursoCredentials.databaseName,
            tursoDatabaseUrl: tursoCredentials.url,
            tursoDatabaseToken: tursoCredentials.authToken,
            tursoCreatedAt: /* @__PURE__ */ new Date()
          }
        });
      }
      await sandbox.process.executeCommand(
        `echo "VITE_TURSO_DATABASE_URL=${tursoCredentials.url}" >> /home/daytona/workspace/.env`,
        "/home/daytona/workspace"
      );
      await sandbox.process.executeCommand(
        `echo "VITE_TURSO_AUTH_TOKEN=${tursoCredentials.authToken}" >> /home/daytona/workspace/.env`,
        "/home/daytona/workspace"
      );
      console.log(
        "[DaytonaSandboxManager] Turso credentials injected into sandbox",
        { databaseName: tursoCredentials.databaseName }
      );
    } catch (tursoError) {
      console.error(
        "[DaytonaSandboxManager] Failed to provision/inject Turso database:",
        tursoError
      );
    }
    let gitRepositoryUrl;
    let currentBranch;
    let gitCommitHash;
    console.log("[DaytonaSandboxManager] Getting git repository information");
    timings.gitInfo.start = Date.now();
    try {
      const branchResult = await sandbox.process.executeCommand(
        "git branch --show-current",
        "/home/daytona/workspace"
      );
      currentBranch = branchResult.result?.trim() || "main";
      const commitResult = await sandbox.process.executeCommand(
        "git rev-parse HEAD",
        "/home/daytona/workspace"
      );
      gitCommitHash = commitResult.result?.trim();
      const viteTemplateUrl = "https://github.com/Shipper-dot-now/vite-template";
      await prisma.project.update({
        where: { id: projectId },
        data: {
          gitRepositoryUrl: viteTemplateUrl,
          currentBranch,
          gitCommitHash
        }
      });
      gitRepositoryUrl = viteTemplateUrl;
      timings.gitInfo.end = Date.now();
      console.log(
        "[DaytonaSandboxManager] Git repository information retrieved",
        {
          duration: `${timings.gitInfo.end - timings.gitInfo.start}ms`
        }
      );
    } catch (error) {
      timings.gitInfo.end = Date.now();
      console.error(
        `[DaytonaSandboxManager] Failed to get git repository information:`,
        error
      );
    }
    if (fragmentId && (recoveryMode === "full_restore" /* FULL_RESTORE */ || recoveryMode === "files_only" /* FILES_ONLY */)) {
      timings.fragmentRestore.start = Date.now();
      try {
        await restoreV2FragmentInSandbox(sandbox, fragmentId, projectId);
        await prisma.project.update({
          where: { id: projectId },
          data: { activeFragmentId: fragmentId }
        });
        timings.fragmentRestore.end = Date.now();
        console.log(
          `[DaytonaSandboxManager] Set activeFragmentId to ${fragmentId} (mode: ${recoveryMode})`,
          {
            duration: `${timings.fragmentRestore.end - timings.fragmentRestore.start}ms`
          }
        );
      } catch (restoreError) {
        timings.fragmentRestore.end = Date.now();
        console.error(
          `[DaytonaSandboxManager] Fragment restoration failed in ${recoveryMode} mode:`,
          restoreError
        );
        if (recoveryMode === "full_restore" /* FULL_RESTORE */) {
          console.log(
            "[DaytonaSandboxManager] Continuing with empty sandbox after restoration failure"
          );
        } else {
          throw restoreError;
        }
      }
    } else if (recoveryMode === "emergency_fallback" /* EMERGENCY_FALLBACK */) {
      console.log(
        "[DaytonaSandboxManager] Emergency fallback mode - creating minimal sandbox without fragment restoration"
      );
    }
    let files;
    timings.fileList.start = Date.now();
    try {
      files = await getRecursiveFileListFromSandbox(sandbox, projectId);
      timings.fileList.end = Date.now();
      const fileListArray = Array.from(files.keys()).slice(0, 10);
      console.log("[DaytonaSandboxManager] Retrieved file list from sandbox", {
        fileCount: files.size,
        fileListSample: fileListArray,
        duration: `${timings.fileList.end - timings.fileList.start}ms`
      });
    } catch (fileListError) {
      timings.fileList.end = Date.now();
      console.warn(
        "[DaytonaSandboxManager] Could not get file list from new sandbox (normal during creation):",
        fileListError instanceof Error ? fileListError.message : String(fileListError)
      );
      files = /* @__PURE__ */ new Map();
    }
    console.log("[DaytonaSandboxManager] Starting development server...");
    timings.devServer.start = Date.now();
    try {
      const devServerSessionId = `dev-server-${projectId}`;
      await sandbox.process.createSession(devServerSessionId);
      await sandbox.process.executeSessionCommand(devServerSessionId, {
        command: "cd /home/daytona/workspace"
      });
      await sandbox.process.executeSessionCommand(devServerSessionId, {
        command: CLEAR_VITE_CACHE_COMMAND
      });
      const commandResult = await sandbox.process.executeSessionCommand(
        devServerSessionId,
        {
          command: "bun dev",
          async: true
        }
      );
      if (commandResult.cmdId) {
        console.log(
          "[DaytonaSandboxManager] Waiting for dev server to be ready..."
        );
        const maxWaitTime = 3e4;
        const pollInterval = 2e3;
        const startWaitTime = Date.now();
        let isReady = false;
        while (Date.now() - startWaitTime < maxWaitTime && !isReady) {
          await new Promise((resolve) => setTimeout(resolve, pollInterval));
          try {
            const logs = await sandbox.process.getSessionCommandLogs(
              devServerSessionId,
              commandResult.cmdId
            );
            const allLogs = [logs.stdout, logs.stderr, logs.output].filter(Boolean).join("\n");
            const viteReadyIndicators = [
              "ready in",
              "Local:",
              "VITE v",
              "ready",
              "localhost:5173"
            ];
            isReady = viteReadyIndicators.some(
              (indicator) => allLogs.toLowerCase().includes(indicator.toLowerCase())
            );
            if (isReady) {
              console.log(
                "[DaytonaSandboxManager] Dev server is ready and serving content"
              );
              console.log("[DevServer Logs]:", allLogs);
              break;
            }
          } catch (logError) {
            console.warn(
              "[DaytonaSandboxManager] Could not get dev server logs during polling:",
              logError
            );
          }
        }
        if (!isReady) {
          console.warn(
            "[DaytonaSandboxManager] Dev server did not become ready within timeout, but continuing anyway"
          );
        }
      }
      timings.devServer.end = Date.now();
      console.log(
        "[DaytonaSandboxManager] Development server started successfully",
        {
          duration: `${timings.devServer.end - timings.devServer.start}ms`
        }
      );
      try {
        console.log(
          `[DaytonaSandboxManager] Injecting monitoring script for project ${projectId}`
        );
        await new Promise((resolve) => setTimeout(resolve, 2e3));
        const indexPath = "/home/daytona/workspace/index.html";
        const { setupSandboxMonitoring } = await import("./sandbox-monitor-injection-OVEPRTNF.js");
        await setupSandboxMonitoring(sandbox, sandbox.id, projectId);
      } catch (monitorError) {
        console.warn(
          `[DaytonaSandboxManager] Failed to inject monitoring script (non-critical):`,
          monitorError
        );
      }
    } catch (devServerError) {
      timings.devServer.end = Date.now();
      console.error(
        "[DaytonaSandboxManager] Failed to start development server:",
        devServerError
      );
    }
    const sandboxInfoToReturn = {
      sandbox,
      sandboxUrl,
      sandboxExpiresAt: null,
      // Daytona handles expiration internally
      files,
      gitRepositoryUrl,
      currentBranch,
      gitCommitHash,
      projectId
    };
    const totalTime = Date.now() - timings.start;
    console.log("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
    console.log("[SANDBOX CREATION TIMING] Complete Breakdown");
    console.log("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
    console.log({
      "Total Time": {
        ms: totalTime,
        seconds: (totalTime / 1e3).toFixed(2)
      },
      "1. Sandbox Create": {
        ms: timings.sandboxCreate.end - timings.sandboxCreate.start || 0,
        seconds: ((timings.sandboxCreate.end - timings.sandboxCreate.start) / 1e3).toFixed(2),
        executed: timings.sandboxCreate.start > 0
      },
      "2. Preview URL": {
        ms: timings.previewUrl.end - timings.previewUrl.start || 0,
        seconds: ((timings.previewUrl.end - timings.previewUrl.start) / 1e3).toFixed(2),
        executed: timings.previewUrl.start > 0
      },
      "3. Database Update": {
        ms: timings.dbUpdate.end - timings.dbUpdate.start || 0,
        seconds: ((timings.dbUpdate.end - timings.dbUpdate.start) / 1e3).toFixed(2),
        executed: timings.dbUpdate.start > 0
      },
      "4. Git Info": {
        ms: timings.gitInfo.end - timings.gitInfo.start || 0,
        seconds: ((timings.gitInfo.end - timings.gitInfo.start) / 1e3).toFixed(
          2
        ),
        executed: timings.gitInfo.start > 0
      },
      "5. Fragment Restore": {
        ms: timings.fragmentRestore.end - timings.fragmentRestore.start || 0,
        seconds: ((timings.fragmentRestore.end - timings.fragmentRestore.start) / 1e3).toFixed(2),
        executed: timings.fragmentRestore.start > 0
      },
      "6. File List": {
        ms: timings.fileList.end - timings.fileList.start || 0,
        seconds: ((timings.fileList.end - timings.fileList.start) / 1e3).toFixed(2),
        executed: timings.fileList.start > 0
      },
      "7. Dev Server": {
        ms: timings.devServer.end - timings.devServer.start || 0,
        seconds: ((timings.devServer.end - timings.devServer.start) / 1e3).toFixed(2),
        executed: timings.devServer.start > 0
      }
    });
    console.log("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
    console.log(
      "[DaytonaSandboxManager] Successfully created and configured new sandbox",
      {
        sandboxId: sandbox.id,
        sandboxUrl,
        sandboxExpiresAt: null,
        fileCount: files.size
      }
    );
    return sandboxInfoToReturn;
  } catch (error) {
    console.error("[DaytonaSandboxManager] Failed to create new sandbox", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : void 0,
      projectId
    });
    throw error;
  }
}
async function restoreFilesInSandbox(sandbox, files) {
  try {
    console.log(
      `Restoring ${Object.keys(files).length} files to Daytona sandbox ${sandbox.id}`
    );
    console.log(
      `[FILE_TRACKING] Files being written to sandbox ${sandbox.id}:`
    );
    Object.entries(files).forEach(([filePath, content]) => {
      console.log(`[FILE_TRACKING] - ${filePath} (${content.length} chars)`);
    });
    const filesToUpload = Object.entries(files).map(([filePath, content]) => {
      let buffer;
      if (content.startsWith("data:")) {
        const base64Match = content.match(/^data:[^;]+;base64,(.+)$/);
        if (base64Match) {
          buffer = Buffer.from(base64Match[1], "base64");
        } else {
          buffer = Buffer.from(content);
        }
      } else {
        buffer = Buffer.from(content);
      }
      return {
        source: buffer,
        destination: path.join("/home/daytona/workspace", filePath)
      };
    });
    try {
      console.log(`[FILE_WRITE] Uploading ${filesToUpload.length} files...`);
      await sandbox.fs.uploadFiles(filesToUpload);
      console.log(`[FILE_WRITE] \u2705 Successfully uploaded all files`);
      return filesToUpload.length;
    } catch (error) {
      console.error(`[FILE_WRITE] \u274C Failed to upload files:`, error);
      console.log(`[FILE_WRITE] Falling back to individual file uploads...`);
      let restoredCount = 0;
      for (const [filePath, content] of Object.entries(files)) {
        try {
          let buffer;
          if (content.startsWith("data:")) {
            const base64Match = content.match(/^data:[^;]+;base64,(.+)$/);
            if (base64Match) {
              buffer = Buffer.from(base64Match[1], "base64");
            } else {
              buffer = Buffer.from(content);
            }
          } else {
            buffer = Buffer.from(content);
          }
          const fullPath = path.join("/home/daytona/workspace", filePath);
          console.log(`[FILE_WRITE] Writing ${fullPath}...`);
          await sandbox.fs.uploadFile(buffer, fullPath);
          console.log(`[FILE_WRITE] \u2705 Successfully wrote ${fullPath}`);
          restoredCount++;
        } catch (individualError) {
          console.error(
            `[FILE_WRITE] \u274C Failed to restore file ${filePath}:`,
            individualError
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
async function getRecursiveFileListFromSandbox(sandbox, projectId) {
  const attemptList = async () => {
    const files = /* @__PURE__ */ new Map();
    const ignoredDirectories = /* @__PURE__ */ new Set([
      "node_modules",
      ".git",
      ".next",
      "dist",
      "build",
      ".cache",
      ".tmp",
      "coverage",
      ".nyc_output",
      "logs"
    ]);
    const rootDir = await sandbox.getUserRootDir();
    if (!rootDir) {
      console.error("Failed to get user root directory");
      throw new Error(
        "Sandbox is not accessible - failed to get user root directory"
      );
    }
    const workspaceDir = "/home/daytona/workspace";
    try {
      await sandbox.fs.listFiles(workspaceDir);
      const fileList = await sandbox.fs.listFiles(workspaceDir);
      for (const file of fileList) {
        const fullPath = path.join(workspaceDir, file.name);
        if (!file.isDir) {
          const relativePath = path.relative(workspaceDir, fullPath);
          files.set(relativePath, {
            size: file.size || 0,
            modified: file.modTime ? new Date(file.modTime).getTime() : Date.now()
          });
        } else {
          if (!ignoredDirectories.has(file.name)) {
            await addDirectoryFiles(
              sandbox,
              fullPath,
              files,
              ignoredDirectories,
              workspaceDir
              // Pass workspace dir for relative path calculation
            );
          }
        }
      }
    } catch (error) {
      console.warn("Workspace directory not found, listing from root:", error);
      const fileList = await sandbox.fs.listFiles(rootDir);
      for (const file of fileList) {
        const fullPath = path.join(rootDir, file.name);
        if (!file.isDir) {
          const relativePath = path.relative(rootDir, fullPath);
          files.set(relativePath, {
            size: file.size || 0,
            modified: file.modTime ? new Date(file.modTime).getTime() : Date.now()
          });
        } else {
          if (!ignoredDirectories.has(file.name)) {
            await addDirectoryFiles(
              sandbox,
              fullPath,
              files,
              ignoredDirectories,
              rootDir
              // Pass root dir for relative path calculation
            );
          }
        }
      }
    }
    return files;
  };
  try {
    return await attemptList();
  } catch (firstError) {
    console.error(
      "Failed to get recursive file list (first attempt):",
      firstError
    );
    const errMsg = firstError instanceof Error ? firstError.message : String(firstError);
    const recoverableIndicators = [
      "Sandbox is not running",
      "no IP address found",
      "no ip address",
      "bad request: no IP address",
      "bad request: no IP address found",
      "Sandbox is not accessible",
      "not running",
      "not available"
    ];
    const isRecoverable = recoverableIndicators.some(
      (indicator) => errMsg.toLowerCase().includes(indicator.toLowerCase())
    );
    if (!isRecoverable) {
      throw firstError;
    }
    try {
      console.log(
        `[DaytonaSandboxManager] Attempting recovery for sandbox ${sandbox.id} after file listing failure`
      );
      let recoveredSandbox = null;
      try {
        recoveredSandbox = await startSandbox(sandbox.id);
        if (recoveredSandbox) {
          sandbox = recoveredSandbox;
          console.log(
            `[DaytonaSandboxManager] startSandbox returned sandbox instance for ${sandbox.id}`
          );
        } else {
          console.warn(
            `[DaytonaSandboxManager] startSandbox did not return a sandbox instance for ${sandbox.id}`
          );
        }
      } catch (startErr) {
        console.warn(
          `[DaytonaSandboxManager] startSandbox helper failed, attempting sandbox.start() directly:`,
          startErr
        );
        try {
          await sandbox.start?.();
        } catch (directStartErr) {
          console.warn(
            `[DaytonaSandboxManager] Direct sandbox.start() also failed:`,
            directStartErr
          );
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 8e3));
      if (projectId) {
        try {
          const projectForProviderCheck = await prisma.project.findUnique({
            where: { id: projectId },
            select: { sandboxProvider: true }
          });
          if (projectForProviderCheck?.sandboxProvider !== "modal") {
            console.log(
              `[DaytonaSandboxManager] Refreshing preview link after recovery attempt for project ${projectId}`
            );
            const previewInfo = await sandbox.getPreviewLink(5173);
            const transformed = transformToShipperDomain(previewInfo.url);
            if (transformed) {
              try {
                await prisma.project.update({
                  where: { id: projectId },
                  data: { sandboxUrl: transformed }
                });
                console.log(
                  `[DaytonaSandboxManager] Updated project ${projectId} sandboxUrl to ${transformed}`
                );
              } catch (dbErr) {
                console.warn(
                  `[DaytonaSandboxManager] Failed to update sandboxUrl in DB for project ${projectId}:`,
                  dbErr
                );
              }
            }
          } else {
            console.log(
              `[DaytonaSandboxManager] Skipping sandboxUrl update for Modal sandbox project ${projectId}`
            );
          }
        } catch (previewErr) {
          console.warn(
            `[DaytonaSandboxManager] Could not refresh preview link after starting sandbox:`,
            previewErr
          );
        }
      }
      try {
        const filesAfterRecovery = await attemptList();
        console.log(
          `[DaytonaSandboxManager] Successfully retrieved file list after recovery, fileCount=${filesAfterRecovery.size}`
        );
        return filesAfterRecovery;
      } catch (secondError) {
        console.error(
          `[DaytonaSandboxManager] Failed to get file list after recovery attempt:`,
          secondError
        );
        throw secondError;
      }
    } catch (recoveryError) {
      console.error(
        `[DaytonaSandboxManager] Recovery attempt failed:`,
        recoveryError
      );
      throw firstError;
    }
  }
}
async function addDirectoryFiles(sandbox, dirPath, files, ignoredDirectories = /* @__PURE__ */ new Set(), workspaceDir) {
  try {
    const fileList = await sandbox.fs.listFiles(dirPath);
    for (const file of fileList) {
      const fullPath = path.join(dirPath, file.name);
      if (!file.isDir) {
        let relativePath;
        if (workspaceDir) {
          relativePath = path.relative(workspaceDir, fullPath);
        } else {
          relativePath = fullPath;
        }
        files.set(relativePath, {
          size: file.size || 0,
          modified: file.modTime ? new Date(file.modTime).getTime() : Date.now()
        });
      } else {
        if (!ignoredDirectories.has(file.name)) {
          await addDirectoryFiles(
            sandbox,
            fullPath,
            files,
            ignoredDirectories,
            workspaceDir
          );
        }
      }
    }
  } catch (error) {
    console.error(`Failed to list directory ${dirPath}:`, error);
  }
}
async function restoreV2FragmentInSandbox(sandbox, fragmentId, projectId) {
  try {
    console.log(
      `[DaytonaSandboxManager] Restoring V2Fragment ${fragmentId} to sandbox ${sandbox.id}`
    );
    const fragment = await prisma.v2Fragment.findFirst({
      where: {
        id: fragmentId,
        projectId
      }
    });
    if (!fragment) {
      throw new Error(
        `V2Fragment ${fragmentId} not found for project ${projectId}`
      );
    }
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { gitCommitHash: true }
    });
    const gitFragment = await prisma.gitFragment.findFirst({
      where: {
        projectId,
        title: fragment.title
      },
      orderBy: { createdAt: "desc" }
      // Get the most recent one
    });
    const isAIFixedFragment = fragment.title.includes("Auto-fixed");
    if (gitFragment?.commitHash && !isAIFixedFragment) {
      console.log(
        `[DaytonaSandboxManager] Using git checkout for catastrophic recovery: ${gitFragment.commitHash}`
      );
      await switchToGitCommit(sandbox, projectId, gitFragment.commitHash);
      console.log(
        `[DaytonaSandboxManager] Successfully restored to git commit ${gitFragment.commitHash} from V2Fragment ${fragmentId}`
      );
      return 1;
    } else if (project?.gitCommitHash && !isAIFixedFragment) {
      console.log(
        `[DaytonaSandboxManager] Using project's current git commit for recovery: ${project.gitCommitHash}`
      );
      await switchToGitCommit(sandbox, projectId, project.gitCommitHash);
      console.log(
        `[DaytonaSandboxManager] Successfully restored to project's git commit ${project.gitCommitHash} from V2Fragment ${fragmentId}`
      );
      return 1;
    } else {
      if (isAIFixedFragment) {
        console.log(
          `[DaytonaSandboxManager] AI-fixed fragment detected, using direct file restoration instead of git checkout`
        );
      }
      console.log(
        `[DaytonaSandboxManager] No git commit available, falling back to direct file restoration`
      );
      const files = fragment.files;
      const fileCount = Object.keys(files).length;
      console.log(
        `[DaytonaSandboxManager] Found ${fileCount} files in fragment "${fragment.title}"`
      );
      const restoredCount = await restoreFilesInSandbox(sandbox, files);
      console.log(
        `[DaytonaSandboxManager] Successfully restored ${restoredCount} files from V2Fragment ${fragmentId}`
      );
      return restoredCount;
    }
  } catch (error) {
    console.error(
      `[DaytonaSandboxManager] Failed to restore V2Fragment ${fragmentId}:`,
      error
    );
    throw error;
  }
}
async function hasGitRepository(sandbox) {
  try {
    await sandbox.process.executeCommand("git status", "./workspace");
    return true;
  } catch (error) {
    return false;
  }
}
async function initializeGitRepository(sandbox, projectId) {
  try {
    console.log(
      `[DaytonaSandboxManager] Initializing git repository for project ${projectId}`
    );
    const hasGit = await hasGitRepository(sandbox);
    if (hasGit) {
      console.log(
        `[DaytonaSandboxManager] Git repository already exists for project ${projectId}`
      );
      return;
    }
    await sandbox.process.executeCommand("git init", "./workspace");
    await sandbox.process.executeCommand(
      'git config user.name "Shipper AI"',
      "./workspace"
    );
    await sandbox.process.executeCommand(
      'git config user.email "ai@shipper.dev"',
      "./workspace"
    );
    await sandbox.process.executeCommand(
      'echo ".shipper/" > .gitignore',
      "./workspace"
    );
    const statusResult = await sandbox.process.executeCommand(
      "git status --porcelain",
      "./workspace"
    );
    const hasChanges = statusResult.result && statusResult.result.trim().length > 0;
    if (hasChanges) {
      await sandbox.process.executeCommand("git add .", "./workspace");
      await sandbox.process.executeCommand(
        'git commit -m "Initial commit"',
        "./workspace"
      );
      const commitResult = await sandbox.process.executeCommand(
        "git rev-parse HEAD",
        "./workspace"
      );
      const initialCommitHash = commitResult.result?.trim();
      if (initialCommitHash) {
        await prisma.project.update({
          where: { id: projectId },
          data: {
            gitRepositoryUrl: `daytona://${sandbox.id}`,
            // Daytona-specific URL scheme
            currentBranch: "main",
            gitCommitHash: initialCommitHash
          }
        });
        await prisma.gitFragment.create({
          data: {
            title: "Initial commit",
            commitHash: initialCommitHash,
            branch: "main",
            message: "Initial commit",
            authorEmail: "ai@shipper.dev",
            authorName: "Shipper AI",
            projectId
          }
        });
        console.log(
          `[DaytonaSandboxManager] Git repository initialized with commit ${initialCommitHash}`
        );
      }
    } else {
      console.log(
        `[DaytonaSandboxManager] Git repository initialized (empty directory)`
      );
      await prisma.project.update({
        where: { id: projectId },
        data: {
          gitRepositoryUrl: `daytona://${sandbox.id}`,
          // Daytona-specific URL scheme
          currentBranch: "main",
          gitCommitHash: null
          // No commits yet
        }
      });
    }
  } catch (error) {
    console.error(
      `[DaytonaSandboxManager] Failed to initialize git repository:`,
      error
    );
    throw error;
  }
}
async function createGitCommit(sandbox, projectId, message, authorEmail, authorName) {
  try {
    console.log(`[DaytonaSandboxManager] Creating git commit: ${message}`);
    const hasGit = await hasGitRepository(sandbox);
    if (!hasGit) {
      console.log(
        `[DaytonaSandboxManager] Git repository not found, initializing...`
      );
      await initializeGitRepository(sandbox, projectId);
    }
    await sandbox.process.executeCommand(
      "git add . ':!.shipper'",
      "./workspace"
    );
    const statusResult = await sandbox.process.executeCommand(
      "git status --porcelain",
      "./workspace"
    );
    const hasChanges = statusResult.result && statusResult.result.trim().length > 0;
    if (!hasChanges) {
      console.log(
        `[DaytonaSandboxManager] No changes to commit for project ${projectId}`
      );
      return null;
    }
    const commitCommand = `git commit -m "${message.replace(/"/g, '\\"')}"`;
    await sandbox.process.executeCommand(commitCommand, "./workspace");
    const commitResult = await sandbox.process.executeCommand(
      "git rev-parse HEAD",
      "./workspace"
    );
    const commitHash = commitResult.result?.trim();
    if (commitHash) {
      const branchResult = await sandbox.process.executeCommand(
        "git branch --show-current",
        "./workspace"
      );
      const currentBranch = branchResult.result?.trim() || "main";
      await prisma.project.update({
        where: { id: projectId },
        data: {
          gitCommitHash: commitHash,
          currentBranch
        }
      });
      await prisma.gitFragment.create({
        data: {
          title: message,
          commitHash,
          branch: currentBranch,
          message,
          authorEmail: authorEmail || "ai@shipper.dev",
          authorName: authorName || "Shipper AI",
          projectId
        }
      });
      console.log(
        `[DaytonaSandboxManager] Created git commit ${commitHash} on branch ${currentBranch}`
      );
      return commitHash;
    }
    throw new Error("Failed to get commit hash after creating commit");
  } catch (error) {
    console.error(
      `[DaytonaSandboxManager] Failed to create git commit:`,
      error
    );
    throw error;
  }
}
async function switchToGitCommit(sandbox, projectId, commitHash) {
  try {
    console.log(
      `[DaytonaSandboxManager] Switching to git commit ${commitHash}`
    );
    const hasGit = await hasGitRepository(sandbox);
    if (!hasGit) {
      console.log(
        `[DaytonaSandboxManager] Git repository not found, initializing...`
      );
      await initializeGitRepository(sandbox, projectId);
    }
    await sandbox.process.executeCommand(
      `git checkout ${commitHash}`,
      "./workspace"
    );
    await prisma.project.update({
      where: { id: projectId },
      data: {
        gitCommitHash: commitHash,
        activeFragmentId: null
        // Clear active fragment since we're using git
      }
    });
    console.log(
      `[DaytonaSandboxManager] Successfully switched to commit ${commitHash}`
    );
  } catch (error) {
    console.error(
      `[DaytonaSandboxManager] Failed to switch to git commit ${commitHash}:`,
      error
    );
    throw error;
  }
}
async function startSandbox(sandboxId) {
  try {
    console.log(`[DaytonaSandboxManager] Starting sandbox ${sandboxId}`);
    let sandbox = await daytona.findOne({ id: sandboxId });
    if (!sandbox) {
      console.log(`[DaytonaSandboxManager] Sandbox ${sandboxId} not found`);
      return null;
    }
    try {
      await sandbox.start();
      console.log(
        `[DaytonaSandboxManager] start() invoked for sandbox ${sandboxId}`
      );
    } catch (startError) {
      console.log(
        `[DaytonaSandboxManager] sandbox.start() returned an error or is not available for ${sandboxId}:`,
        startError
      );
    }
    const startTime = Date.now();
    const timeoutMs = 3e4;
    const pollIntervalMs = 2e3;
    const checkReady = async () => {
      try {
        const root = await sandbox.getUserRootDir();
        if (root) {
          console.log(
            `[DaytonaSandboxManager] Sandbox ${sandboxId} getUserRootDir() returned: ${root}`
          );
          return true;
        }
      } catch (e) {
      }
      try {
        const preview = await sandbox.getPreviewLink(5173);
        if (preview && preview.url) {
          console.log(
            `[DaytonaSandboxManager] Sandbox ${sandboxId} preview link available: ${preview.url}`
          );
          return true;
        }
      } catch (e) {
      }
      return false;
    };
    while (Date.now() - startTime < timeoutMs) {
      try {
        try {
          sandbox = await daytona.findOne({ id: sandboxId }) || sandbox;
        } catch (refetchErr) {
        }
        const ready = await checkReady();
        if (ready) {
          console.log(
            `[DaytonaSandboxManager] Sandbox ${sandboxId} is ready, returning sandbox instance`
          );
          return sandbox;
        }
      } catch (loopErr) {
        console.warn(
          `[DaytonaSandboxManager] Error while polling sandbox readiness for ${sandboxId}:`,
          loopErr
        );
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
    console.warn(
      `[DaytonaSandboxManager] Sandbox ${sandboxId} did not become fully ready within ${timeoutMs}ms - returning sandbox object for further checks`
    );
    return sandbox;
  } catch (error) {
    console.error(
      `[DaytonaSandboxManager] Failed to start sandbox ${sandboxId}:`,
      error
    );
    return null;
  }
}
async function startDevServer2(sandbox, projectId) {
  try {
    console.log(
      `[DaytonaSandboxManager] Starting dev server for project ${projectId}`
    );
    const devServerSessionId = `dev-server-${projectId}`;
    try {
      const existingSession = await sandbox.process.getSession(devServerSessionId);
      if (existingSession) {
        console.log(
          `[DaytonaSandboxManager] Dev server session already exists for project ${projectId}`
        );
        return;
      }
    } catch (error) {
    }
    await sandbox.process.createSession(devServerSessionId);
    await sandbox.process.executeSessionCommand(devServerSessionId, {
      command: "cd ./workspace"
    });
    await sandbox.process.executeSessionCommand(devServerSessionId, {
      command: CLEAR_VITE_CACHE_COMMAND
    });
    const commandResult = await sandbox.process.executeSessionCommand(
      devServerSessionId,
      {
        command: "bun dev",
        async: true
      }
    );
    console.log(
      `[DaytonaSandboxManager] Dev server started successfully for project ${projectId}`
    );
    if (commandResult.cmdId) {
      await new Promise((resolve) => setTimeout(resolve, 5e3));
      try {
        const logs = await sandbox.process.getSessionCommandLogs(
          devServerSessionId,
          commandResult.cmdId
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
          logError
        );
      }
    }
    try {
      const { setupSandboxMonitoring } = await import("./sandbox-monitor-injection-OVEPRTNF.js");
      await setupSandboxMonitoring(sandbox, sandbox.id, projectId);
    } catch (monitorError) {
      console.warn(
        `[DaytonaSandboxManager] Failed to inject monitoring script (non-critical):`,
        monitorError
      );
    }
  } catch (error) {
    console.error(
      `[DaytonaSandboxManager] Failed to start dev server for project ${projectId}:`,
      error
    );
    throw error;
  }
}

// src/services/daytona-playwright-manager.ts
init_esm_shims();
import { Daytona as Daytona2 } from "@daytonaio/sdk";
import { spawn } from "child_process";
import * as path2 from "path";
var daytona2 = new Daytona2({
  apiKey: process.env.DAYTONA_API_KEY,
  organizationId: process.env.DAYTONA_ORGANIZATION_ID,
  target: "us"
});
var PLAYWRIGHT_SNAPSHOT_NAME = "playwright-checker-v1";
var playwrightSandbox = null;
var sandboxInitialized = false;
async function getOrCreatePlaywrightSandbox() {
  if (playwrightSandbox && sandboxInitialized) {
    console.log("[PlaywrightManager] Checking existing Playwright sandbox...");
    const sandboxId = playwrightSandbox.id;
    try {
      const freshSandbox = await daytona2.findOne({ id: sandboxId });
      if (!freshSandbox) {
        console.log(
          `[PlaywrightManager] Sandbox ${sandboxId} no longer exists`
        );
        playwrightSandbox = null;
        sandboxInitialized = false;
      } else {
        playwrightSandbox = freshSandbox;
        console.log(`[PlaywrightManager] Sandbox state: ${freshSandbox.state}`);
        try {
          await playwrightSandbox.fs.listFiles("/home/daytona");
          console.log(
            "[PlaywrightManager] Reusing existing Playwright sandbox"
          );
          return playwrightSandbox;
        } catch (accessError) {
          const errorMsg = accessError instanceof Error ? accessError.message : String(accessError);
          console.log(
            `[PlaywrightManager] Sandbox not accessible: ${errorMsg}`
          );
          const isRecoverableError = errorMsg.toLowerCase().includes("not running") || errorMsg.toLowerCase().includes("no ip address") || errorMsg.toLowerCase().includes("connection refused");
          if (isRecoverableError) {
            console.log(
              "[PlaywrightManager] Attempting to start existing sandbox..."
            );
            try {
              await playwrightSandbox.start();
              console.log(
                "[PlaywrightManager] Successfully started existing sandbox"
              );
              await new Promise((resolve) => setTimeout(resolve, 3e3));
              await playwrightSandbox.fs.listFiles("/home/daytona");
              console.log("[PlaywrightManager] Sandbox is now accessible");
              return playwrightSandbox;
            } catch (startError) {
              console.warn(
                "[PlaywrightManager] Failed to start existing sandbox:",
                startError
              );
            }
          }
          console.log("[PlaywrightManager] Will create new sandbox");
          playwrightSandbox = null;
          sandboxInitialized = false;
        }
      }
    } catch (findError) {
      console.warn(
        "[PlaywrightManager] Failed to fetch existing sandbox:",
        findError
      );
      playwrightSandbox = null;
      sandboxInitialized = false;
    }
  }
  console.log(
    `[PlaywrightManager] Creating new Playwright sandbox from snapshot: ${PLAYWRIGHT_SNAPSHOT_NAME}`
  );
  try {
    playwrightSandbox = await daytona2.create({
      snapshot: PLAYWRIGHT_SNAPSHOT_NAME,
      autoDeleteInterval: 15,
      // Auto-delete after 30 minutes of being created
      public: false,
      networkAllowList: "188.114.96.3/32,188.114.97.3/32"
    });
    console.log(`[PlaywrightManager] Created sandbox: ${playwrightSandbox.id}`);
    console.log(
      "[PlaywrightManager] Sandbox ready with pre-installed Playwright environment"
    );
    sandboxInitialized = true;
    return playwrightSandbox;
  } catch (error) {
    console.error("[PlaywrightManager] Error creating sandbox:", error);
    throw new Error(
      `Failed to create Playwright sandbox. Ensure the snapshot "${PLAYWRIGHT_SNAPSHOT_NAME}" exists. Run: npx tsx scripts/create-playwright-snapshot.ts`
    );
  }
}
async function runLocalPlaywrightCheck(targetUrl, maxRetries = 3) {
  return new Promise((resolve) => {
    console.log(
      `[PlaywrightManager] Running Playwright locally for: ${targetUrl}`
    );
    const scriptPath = path2.join(
      process.cwd(),
      "src",
      "lib",
      "ai",
      "playwright-runtime-checker.ts"
    );
    console.log(`[PlaywrightManager] Script path: ${scriptPath}`);
    const args = [scriptPath, targetUrl, maxRetries.toString(), "{}"];
    console.log(`[PlaywrightManager] Running: npx tsx ${args.join(" ")}`);
    const child = spawn("npx", ["tsx", ...args], {
      cwd: process.cwd(),
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"]
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
        `[PlaywrightManager] Local Playwright check completed with code ${code}`
      );
      try {
        const resultsMarker = "=== RESULTS ===";
        const resultsIndex = stdout.indexOf(resultsMarker);
        if (resultsIndex === -1) {
          console.error(
            "[PlaywrightManager] Could not find results marker in output"
          );
          console.error("[PlaywrightManager] Full output:", stdout);
          resolve({
            success: false,
            errors: [],
            totalErrors: 0,
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            error: "Could not find results marker in Playwright output"
          });
          return;
        }
        const jsonOutput = stdout.substring(resultsIndex + resultsMarker.length).trim();
        const parsedResult = JSON.parse(jsonOutput);
        if (!parsedResult.success) {
          console.error(
            `[PlaywrightManager] Playwright check failed: ${parsedResult.error}`
          );
        } else {
          console.log(
            `[PlaywrightManager] Found ${parsedResult.totalErrors} runtime errors`
          );
        }
        resolve(parsedResult);
      } catch (error) {
        console.error(
          "[PlaywrightManager] Error parsing Playwright output:",
          error
        );
        resolve({
          success: false,
          errors: [],
          totalErrors: 0,
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });
    child.on("error", (error) => {
      console.error(
        "[PlaywrightManager] Error spawning Playwright process:",
        error
      );
      resolve({
        success: false,
        errors: [],
        totalErrors: 0,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        error: error.message
      });
    });
  });
}
async function runPlaywrightRuntimeCheck(targetUrl, targetSandbox, maxRetries = 3) {
  try {
    console.log(`[PlaywrightManager] Running runtime check for: ${targetUrl}`);
    const isLocalhost = targetUrl.includes("localhost") || targetUrl.includes("127.0.0.1");
    if (isLocalhost && process.env.NODE_ENV !== "production") {
      console.log(
        `[PlaywrightManager] Detected localhost URL in dev mode - running Playwright locally`
      );
      return await runLocalPlaywrightCheck(targetUrl, maxRetries);
    }
    console.log(
      `[PlaywrightManager] Running Playwright in remote sandbox for: ${targetUrl}`
    );
    const sandbox = await getOrCreatePlaywrightSandbox();
    console.log("[PlaywrightManager] Executing Playwright checker...");
    const authHeadersJson = JSON.stringify({});
    const result = await runCommandOnSandbox(
      sandbox,
      `cd /home/daytona/playwright-checker && node dist/playwright-runtime-checker.js "${targetUrl}" ${maxRetries} '${authHeadersJson}'`,
      {
        onStdout: (line) => console.log(`[Playwright] ${line}`),
        onStderr: (line) => console.error(`[Playwright Error] ${line}`)
      }
    );
    console.log("[PlaywrightManager] Playwright check complete");
    const stdout = result.stdout || result.result || result.output || "";
    const resultsMarker = "=== RESULTS ===";
    const resultsIndex = stdout.indexOf(resultsMarker);
    if (resultsIndex === -1) {
      console.error(
        "[PlaywrightManager] Could not find results marker in output"
      );
      console.error("[PlaywrightManager] Full output:", stdout);
      throw new Error("Could not find results marker in Playwright output");
    }
    const jsonOutput = stdout.substring(resultsIndex + resultsMarker.length).trim();
    const parsedResult = JSON.parse(jsonOutput);
    if (!parsedResult.success) {
      console.error(
        `[PlaywrightManager] Playwright check failed: ${parsedResult.error}`
      );
    } else {
      console.log(
        `[PlaywrightManager] Found ${parsedResult.totalErrors} runtime errors`
      );
    }
    return parsedResult;
  } catch (error) {
    console.error("[PlaywrightManager] Error running Playwright check:", error);
    return {
      success: false,
      errors: [],
      totalErrors: 0,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
async function cleanupPlaywrightSandbox() {
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
        error
      );
    }
  }
}
async function getPlaywrightSandboxStatus() {
  if (!playwrightSandbox) {
    return { exists: false, initialized: false };
  }
  return {
    exists: true,
    initialized: sandboxInitialized,
    id: playwrightSandbox.id
  };
}

// src/services/daytona.ts
init_esm_shims();
import { Daytona as Daytona3 } from "@daytonaio/sdk";
var daytonaClient = new Daytona3({
  apiKey: process.env.DAYTONA_API_KEY,
  organizationId: process.env.DAYTONA_ORGANIZATION_ID
  // Using defaults for all other configuration
});

// src/routes/daytona.ts
var router = Router();
var createSandboxSchema = z.object({
  projectId: z.string(),
  fragmentId: z.string().optional().nullable(),
  templateName: z.string().optional()
});
var startSandboxSchema = z.object({
  sandboxId: z.string()
});
var startDevServerSchema = z.object({
  projectId: z.string(),
  sandboxId: z.string()
});
var restoreFragmentSchema = z.object({
  sandboxId: z.string(),
  fragmentId: z.string(),
  projectId: z.string()
});
var createGitCommitSchema = z.object({
  sandboxId: z.string(),
  projectId: z.string(),
  message: z.string(),
  email: z.string(),
  name: z.string()
});
var switchGitCommitSchema = z.object({
  sandboxId: z.string(),
  projectId: z.string(),
  commitHash: z.string()
});
var restoreFilesSchema = z.object({
  sandboxId: z.string(),
  files: z.record(z.string(), z.string())
});
var executeCommandSchema = z.object({
  sandboxId: z.string(),
  command: z.string(),
  timeoutMs: z.number().optional()
});
var readFileSchema = z.object({
  sandboxId: z.string(),
  path: z.string()
});
var writeFileSchema = z.object({
  sandboxId: z.string(),
  path: z.string(),
  content: z.string()
});
var uploadMetadataImageSchema = z.object({
  projectId: z.string(),
  imageType: z.enum(["icon", "shareImage"]),
  base64Data: z.string(),
  fileExtension: z.string()
});
var getMetadataImageSchema = z.object({
  projectId: z.string(),
  imageType: z.enum(["icon", "shareImage"])
});
var playwrightCheckSchema = z.object({
  targetUrl: z.string(),
  sandboxId: z.string().optional(),
  maxRetries: z.number().optional()
});
router.get("/sandbox/:projectId", async (req, res) => {
  const startTime = Date.now();
  const { projectId } = req.params;
  req.logger?.info("Getting sandbox information");
  try {
    const sandboxInfo = await getSandbox2(projectId);
    if (!sandboxInfo) {
      req.logger?.warn("Sandbox not found");
      const response2 = {
        success: false,
        error: "Sandbox not found"
      };
      return res.status(404).json(response2);
    }
    const elapsed = Date.now() - startTime;
    req.logger?.info({
      msg: "Sandbox retrieved successfully",
      sandboxId: sandboxInfo.sandbox.id,
      duration: `${elapsed}ms`
    });
    const response = {
      success: true,
      data: {
        sandboxId: sandboxInfo.sandbox.id,
        sandboxUrl: sandboxInfo.sandboxUrl,
        sandboxExpiresAt: sandboxInfo.sandboxExpiresAt,
        gitRepositoryUrl: sandboxInfo.gitRepositoryUrl,
        currentBranch: sandboxInfo.currentBranch,
        gitCommitHash: sandboxInfo.gitCommitHash
      }
    };
    res.json(response);
  } catch (error) {
    const elapsed = Date.now() - startTime;
    req.logger?.error({
      msg: "Failed to get sandbox",
      error: error instanceof Error ? error.message : "Unknown error",
      duration: `${elapsed}ms`
    });
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get sandbox"
    };
    res.status(500).json(response);
  }
});
router.post("/sandbox", async (req, res) => {
  const startTime = Date.now();
  console.log(
    `[API] POST /api/v1/daytona/sandbox - Starting (projectId: ${req.body.projectId})...`
  );
  try {
    const parsed = createSandboxSchema.safeParse(req.body);
    if (!parsed.success) {
      console.log(
        `[API] POST /api/v1/daytona/sandbox - Invalid request body (400)`
      );
      const response2 = {
        success: false,
        error: "Invalid request body"
      };
      return res.status(400).json(response2);
    }
    const { projectId, fragmentId, templateName } = parsed.data;
    console.log(
      `[API] POST /api/v1/daytona/sandbox - Creating sandbox (projectId: ${projectId}, fragmentId: ${fragmentId || "none"}, template: ${templateName || "default"})...`
    );
    const sandboxInfo = await createSandbox2(
      projectId,
      fragmentId,
      templateName
    );
    const elapsed = Date.now() - startTime;
    console.log(
      `[API] POST /api/v1/daytona/sandbox - Success (sandboxId: ${sandboxInfo.sandbox.id}, ${elapsed}ms)`
    );
    const response = {
      success: true,
      data: {
        sandboxId: sandboxInfo.sandbox.id,
        sandboxUrl: sandboxInfo.sandboxUrl,
        sandboxExpiresAt: sandboxInfo.sandboxExpiresAt,
        gitRepositoryUrl: sandboxInfo.gitRepositoryUrl,
        currentBranch: sandboxInfo.currentBranch,
        gitCommitHash: sandboxInfo.gitCommitHash
      }
    };
    res.json(response);
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(
      `[API] POST /api/v1/daytona/sandbox - Error (${elapsed}ms):`,
      error
    );
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create sandbox"
    };
    res.status(500).json(response);
  }
});
router.post("/sandbox/start", async (req, res) => {
  try {
    const parsed = startSandboxSchema.safeParse(req.body);
    if (!parsed.success) {
      const response2 = {
        success: false,
        error: "Invalid request body"
      };
      return res.status(400).json(response2);
    }
    const { sandboxId } = parsed.data;
    await startSandbox(sandboxId);
    const response = {
      success: true,
      data: { message: "Sandbox started successfully" }
    };
    res.json(response);
  } catch (error) {
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to start sandbox"
    };
    res.status(500).json(response);
  }
});
router.post("/sandbox/dev-server", async (req, res) => {
  try {
    const parsed = startDevServerSchema.safeParse(req.body);
    if (!parsed.success) {
      const response2 = {
        success: false,
        error: "Invalid request body"
      };
      return res.status(400).json(response2);
    }
    const { projectId, sandboxId } = parsed.data;
    const sandbox = await daytonaClient.findOne({ id: sandboxId });
    if (!sandbox) {
      const response2 = {
        success: false,
        error: "Sandbox not found"
      };
      return res.status(404).json(response2);
    }
    await startDevServer2(sandbox, projectId);
    const response = {
      success: true,
      data: { message: "Dev server started successfully" }
    };
    res.json(response);
  } catch (error) {
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to start dev server"
    };
    res.status(500).json(response);
  }
});
router.delete("/sandbox/:sandboxId", async (req, res) => {
  try {
    const { sandboxId } = req.params;
    const sandbox = await daytonaClient.findOne({ id: sandboxId });
    if (!sandbox) {
      const response2 = {
        success: false,
        error: "Sandbox not found"
      };
      return res.status(404).json(response2);
    }
    await daytonaClient.delete(sandbox);
    const response = {
      success: true,
      data: { message: "Sandbox deleted successfully" }
    };
    res.json(response);
  } catch (error) {
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete sandbox"
    };
    res.status(500).json(response);
  }
});
router.post("/fragment/restore", async (req, res) => {
  try {
    const parsed = restoreFragmentSchema.safeParse(req.body);
    if (!parsed.success) {
      const response2 = {
        success: false,
        error: "Invalid request body"
      };
      return res.status(400).json(response2);
    }
    const { sandboxId, fragmentId, projectId } = parsed.data;
    const sandbox = await daytonaClient.findOne({ id: sandboxId });
    if (!sandbox) {
      const response2 = {
        success: false,
        error: "Sandbox not found"
      };
      return res.status(404).json(response2);
    }
    await restoreV2FragmentInSandbox(sandbox, fragmentId, projectId);
    const response = {
      success: true,
      data: { message: "Fragment restored successfully" }
    };
    res.json(response);
  } catch (error) {
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to restore fragment"
    };
    res.status(500).json(response);
  }
});
router.post("/git/commit", async (req, res) => {
  try {
    const parsed = createGitCommitSchema.safeParse(req.body);
    if (!parsed.success) {
      const response2 = {
        success: false,
        error: "Invalid request body"
      };
      return res.status(400).json(response2);
    }
    const { sandboxId, projectId, message, email, name } = parsed.data;
    const sandbox = await daytonaClient.findOne({ id: sandboxId });
    if (!sandbox) {
      const response2 = {
        success: false,
        error: "Sandbox not found"
      };
      return res.status(404).json(response2);
    }
    const commitHash = await createGitCommit(
      sandbox,
      projectId,
      message,
      email,
      name
    );
    const response = {
      success: true,
      data: { commitHash }
    };
    res.json(response);
  } catch (error) {
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create git commit"
    };
    res.status(500).json(response);
  }
});
router.post("/git/switch", async (req, res) => {
  try {
    const parsed = switchGitCommitSchema.safeParse(req.body);
    if (!parsed.success) {
      const response2 = {
        success: false,
        error: "Invalid request body"
      };
      return res.status(400).json(response2);
    }
    const { sandboxId, projectId, commitHash } = parsed.data;
    const sandbox = await daytonaClient.findOne({ id: sandboxId });
    if (!sandbox) {
      const response2 = {
        success: false,
        error: "Sandbox not found"
      };
      return res.status(404).json(response2);
    }
    await switchToGitCommit(sandbox, projectId, commitHash);
    const response = {
      success: true,
      data: { message: "Switched to commit successfully" }
    };
    res.json(response);
  } catch (error) {
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to switch git commit"
    };
    res.status(500).json(response);
  }
});
router.post("/files/restore", async (req, res) => {
  try {
    const parsed = restoreFilesSchema.safeParse(req.body);
    if (!parsed.success) {
      const response2 = {
        success: false,
        error: "Invalid request body"
      };
      return res.status(400).json(response2);
    }
    const { sandboxId, files } = parsed.data;
    const sandbox = await daytonaClient.findOne({ id: sandboxId });
    if (!sandbox) {
      const response2 = {
        success: false,
        error: "Sandbox not found"
      };
      return res.status(404).json(response2);
    }
    await restoreFilesInSandbox(sandbox, files);
    const response = {
      success: true,
      data: { message: "Files restored successfully" }
    };
    res.json(response);
  } catch (error) {
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to restore files"
    };
    res.status(500).json(response);
  }
});
router.post("/command/execute", async (req, res) => {
  const startTime = Date.now();
  const command = req.body.command;
  const sandboxId = req.body.sandboxId;
  console.log(
    `[API] POST /api/v1/daytona/command/execute - Starting (sandboxId: ${sandboxId}, command: ${command?.substring(0, 50)}${command?.length > 50 ? "..." : ""})...`
  );
  try {
    const parsed = executeCommandSchema.safeParse(req.body);
    if (!parsed.success) {
      console.log(
        `[API] POST /api/v1/daytona/command/execute - Invalid request body (400)`
      );
      const response2 = {
        success: false,
        error: "Invalid request body"
      };
      return res.status(400).json(response2);
    }
    const { sandboxId: sandboxId2, command: command2, timeoutMs } = parsed.data;
    const sandbox = await daytonaClient.findOne({ id: sandboxId2 });
    if (!sandbox) {
      console.log(
        `[API] POST /api/v1/daytona/command/execute - Sandbox not found (404, sandboxId: ${sandboxId2})`
      );
      const response2 = {
        success: false,
        error: "Sandbox not found"
      };
      return res.status(404).json(response2);
    }
    const result = await runCommandOnSandbox(sandbox, command2, { timeoutMs });
    const elapsed = Date.now() - startTime;
    console.log(
      `[API] POST /api/v1/daytona/command/execute - Success (sandboxId: ${sandboxId2}, exitCode: ${result.exitCode}, ${elapsed}ms)`
    );
    const response = {
      success: true,
      data: result
    };
    res.json(response);
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(
      `[API] POST /api/v1/daytona/command/execute - Error (sandboxId: ${sandboxId}, ${elapsed}ms):`,
      error
    );
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to execute command"
    };
    res.status(500).json(response);
  }
});
router.post("/file/read", async (req, res) => {
  const startTime = Date.now();
  const { sandboxId, path: filePath } = req.body;
  console.log(
    `[API] POST /api/v1/daytona/file/read - Starting (sandboxId: ${sandboxId}, path: ${filePath})...`
  );
  try {
    const parsed = readFileSchema.safeParse(req.body);
    if (!parsed.success) {
      console.log(
        `[API] POST /api/v1/daytona/file/read - Invalid request body (400)`
      );
      const response2 = {
        success: false,
        error: "Invalid request body"
      };
      return res.status(400).json(response2);
    }
    const { sandboxId: sandboxId2, path: filePath2 } = parsed.data;
    const sandbox = await daytonaClient.findOne({ id: sandboxId2 });
    if (!sandbox) {
      console.log(
        `[API] POST /api/v1/daytona/file/read - Sandbox not found (404, sandboxId: ${sandboxId2})`
      );
      const response2 = {
        success: false,
        error: "Sandbox not found"
      };
      return res.status(404).json(response2);
    }
    const content = await readFileFromSandbox(sandbox, filePath2);
    const elapsed = Date.now() - startTime;
    console.log(
      `[API] POST /api/v1/daytona/file/read - Success (sandboxId: ${sandboxId2}, path: ${filePath2}, size: ${content.length} chars, ${elapsed}ms)`
    );
    const response = {
      success: true,
      data: { content }
    };
    res.json(response);
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(
      `[API] POST /api/v1/daytona/file/read - Error (sandboxId: ${sandboxId}, path: ${filePath}, ${elapsed}ms):`,
      error
    );
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to read file"
    };
    res.status(500).json(response);
  }
});
router.post("/file/write", async (req, res) => {
  const startTime = Date.now();
  const { sandboxId, path: filePath, content } = req.body;
  console.log(
    `[API] POST /api/v1/daytona/file/write - Starting (sandboxId: ${sandboxId}, path: ${filePath}, size: ${content?.length || 0} chars)...`
  );
  try {
    const parsed = writeFileSchema.safeParse(req.body);
    if (!parsed.success) {
      console.log(
        `[API] POST /api/v1/daytona/file/write - Invalid request body (400)`
      );
      const response2 = {
        success: false,
        error: "Invalid request body"
      };
      return res.status(400).json(response2);
    }
    const { sandboxId: sandboxId2, path: filePath2, content: content2 } = parsed.data;
    const sandbox = await daytonaClient.findOne({ id: sandboxId2 });
    if (!sandbox) {
      console.log(
        `[API] POST /api/v1/daytona/file/write - Sandbox not found (404, sandboxId: ${sandboxId2})`
      );
      const response2 = {
        success: false,
        error: "Sandbox not found"
      };
      return res.status(404).json(response2);
    }
    await writeFileToSandbox(sandbox, filePath2, content2);
    const elapsed = Date.now() - startTime;
    console.log(
      `[API] POST /api/v1/daytona/file/write - Success (sandboxId: ${sandboxId2}, path: ${filePath2}, size: ${content2.length} chars, ${elapsed}ms)`
    );
    const response = {
      success: true,
      data: { message: "File written successfully" }
    };
    res.json(response);
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(
      `[API] POST /api/v1/daytona/file/write - Error (sandboxId: ${sandboxId}, path: ${filePath}, ${elapsed}ms):`,
      error
    );
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to write file"
    };
    res.status(500).json(response);
  }
});
router.get("/metadata/get-image", async (req, res) => {
  const startTime = Date.now();
  const { projectId, imageType } = req.query;
  console.log(
    `[API] GET /api/v1/daytona/metadata/get-image - Starting (projectId: ${projectId}, imageType: ${imageType})...`
  );
  try {
    const parsed = getMetadataImageSchema.safeParse(req.query);
    if (!parsed.success) {
      console.log(
        `[API] GET /api/v1/daytona/metadata/get-image - Invalid query params (400)`
      );
      const response2 = {
        success: false,
        error: "Invalid query parameters"
      };
      return res.status(400).json(response2);
    }
    const { projectId: projectId2, imageType: imageType2 } = parsed.data;
    const sandboxInfo = await getSandbox2(projectId2);
    if (!sandboxInfo) {
      console.log(
        `[API] GET /api/v1/daytona/metadata/get-image - Sandbox not found (404, projectId: ${projectId2})`
      );
      const response2 = {
        success: false,
        error: "Sandbox not found"
      };
      return res.status(404).json(response2);
    }
    const sandbox = sandboxInfo.sandbox;
    const filePrefix = imageType2 === "icon" ? "favicon" : "share-image";
    const searchDir = imageType2 === "icon" ? "public" : "public/images";
    const workspacePath = "/home/daytona/workspace";
    const lsCommand = `ls ${workspacePath}/${searchDir}/${filePrefix}.* 2>/dev/null || echo "NOT_FOUND"`;
    const lsResult = await runCommandOnSandbox(sandbox, lsCommand);
    const output = lsResult.output || lsResult.result || "";
    if (output.trim() === "NOT_FOUND" || !output.trim()) {
      console.log(
        `[API] GET /api/v1/daytona/metadata/get-image - Image not found (404, projectId: ${projectId2}, imageType: ${imageType2})`
      );
      const response2 = {
        success: false,
        error: "Image not found"
      };
      return res.status(404).json(response2);
    }
    const fullPath = output.trim().split("\n")[0];
    const relativePath = fullPath.replace(`${workspacePath}/`, "");
    const fileBuffer = await sandbox.fs.downloadFile(fullPath);
    const base64Data = fileBuffer.toString("base64");
    const ext = fullPath.split(".").pop()?.toLowerCase();
    const mimeTypes = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml"
    };
    const mimeType = mimeTypes[ext || ""] || "application/octet-stream";
    const dataUrl = `data:${mimeType};base64,${base64Data}`;
    const elapsed = Date.now() - startTime;
    console.log(
      `[API] GET /api/v1/daytona/metadata/get-image - Success (projectId: ${projectId2}, imageType: ${imageType2}, file: ${relativePath}, size: ${fileBuffer.length} bytes, ${elapsed}ms)`
    );
    const response = {
      success: true,
      data: {
        dataUrl,
        mimeType,
        filename: fullPath.split("/").pop()
      }
    };
    res.json(response);
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(
      `[API] GET /api/v1/daytona/metadata/get-image - Error (projectId: ${projectId}, imageType: ${imageType}, ${elapsed}ms):`,
      error
    );
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get metadata image"
    };
    res.status(500).json(response);
  }
});
router.post("/metadata/upload-image", async (req, res) => {
  const startTime = Date.now();
  const { projectId, imageType } = req.body;
  console.log(
    `[API] POST /api/v1/daytona/metadata/upload-image - Starting (projectId: ${projectId}, imageType: ${imageType})...`
  );
  try {
    const parsed = uploadMetadataImageSchema.safeParse(req.body);
    if (!parsed.success) {
      console.log(
        `[API] POST /api/v1/daytona/metadata/upload-image - Invalid request body (400)`
      );
      const response2 = {
        success: false,
        error: "Invalid request body"
      };
      return res.status(400).json(response2);
    }
    const { projectId: projectId2, imageType: imageType2, base64Data, fileExtension } = parsed.data;
    const sandboxInfo = await getSandbox2(projectId2);
    if (!sandboxInfo) {
      console.log(
        `[API] POST /api/v1/daytona/metadata/upload-image - Sandbox not found (404, projectId: ${projectId2})`
      );
      const response2 = {
        success: false,
        error: "Sandbox not found"
      };
      return res.status(404).json(response2);
    }
    const sandbox = sandboxInfo.sandbox;
    const filename = imageType2 === "icon" ? `favicon.${fileExtension}` : `share-image.${fileExtension}`;
    const filePath = imageType2 === "icon" ? `public/${filename}` : `public/images/${filename}`;
    const imageBuffer = Buffer.from(base64Data, "base64");
    const dirPath = filePath.substring(0, filePath.lastIndexOf("/"));
    if (dirPath) {
      await runCommandOnSandbox(
        sandbox,
        `mkdir -p /home/daytona/workspace/${dirPath}`
      );
    }
    const workspacePath = "/home/daytona/workspace";
    const fullPath = `${workspacePath}/${filePath}`;
    await sandbox.fs.uploadFile(imageBuffer, fullPath);
    const elapsed = Date.now() - startTime;
    console.log(
      `[API] POST /api/v1/daytona/metadata/upload-image - Success (projectId: ${projectId2}, imageType: ${imageType2}, path: ${filePath}, size: ${imageBuffer.length} bytes, ${elapsed}ms)`
    );
    const response = {
      success: true,
      data: {
        path: filePath,
        filename,
        url: imageType2 === "icon" ? `/${filename}` : `/images/${filename}`
      }
    };
    res.json(response);
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(
      `[API] POST /api/v1/daytona/metadata/upload-image - Error (projectId: ${projectId}, imageType: ${imageType}, ${elapsed}ms):`,
      error
    );
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to upload metadata image"
    };
    res.status(500).json(response);
  }
});
router.post("/playwright/check", async (req, res) => {
  try {
    const parsed = playwrightCheckSchema.safeParse(req.body);
    if (!parsed.success) {
      const response2 = {
        success: false,
        error: "Invalid request body"
      };
      return res.status(400).json(response2);
    }
    const { targetUrl, sandboxId, maxRetries } = parsed.data;
    let targetSandbox = void 0;
    if (sandboxId) {
      targetSandbox = await daytonaClient.findOne({ id: sandboxId });
    }
    const result = await runPlaywrightRuntimeCheck(
      targetUrl,
      targetSandbox || void 0,
      maxRetries
    );
    const response = {
      success: true,
      data: result
    };
    res.json(response);
  } catch (error) {
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to run Playwright check"
    };
    res.status(500).json(response);
  }
});
router.delete("/playwright/cleanup", async (_req, res) => {
  try {
    await cleanupPlaywrightSandbox();
    const response = {
      success: true,
      data: { message: "Playwright sandbox cleaned up successfully" }
    };
    res.json(response);
  } catch (error) {
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to cleanup Playwright sandbox"
    };
    res.status(500).json(response);
  }
});
router.get("/playwright/status", async (_req, res) => {
  try {
    const status = await getPlaywrightSandboxStatus();
    const response = {
      success: true,
      data: status
    };
    res.json(response);
  } catch (error) {
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get Playwright sandbox status"
    };
    res.status(500).json(response);
  }
});
var listFilesSchema = z.object({
  sandboxId: z.string()
});
var findFilesSchema = z.object({
  sandboxId: z.string(),
  pattern: z.string()
});
var batchWriteFilesSchema = z.object({
  sandboxId: z.string(),
  files: z.array(
    z.object({
      path: z.string(),
      content: z.string()
    })
  )
});
var replaceInFilesSchema = z.object({
  sandboxId: z.string(),
  replacements: z.array(
    z.object({
      path: z.string(),
      oldValue: z.string(),
      newValue: z.string()
    })
  )
});
var installPackagesSchema = z.object({
  sandboxId: z.string(),
  packages: z.array(z.string()),
  dev: z.boolean().optional()
});
var applyThemeSchema = z.object({
  sandboxId: z.string(),
  theme: z.string()
});
router.post("/files/list", async (req, res) => {
  const startTime = Date.now();
  const { sandboxId } = req.body;
  console.log(
    `[API] POST /api/v1/daytona/files/list - Starting (sandboxId: ${sandboxId})...`
  );
  try {
    const parsed = listFilesSchema.safeParse(req.body);
    if (!parsed.success) {
      console.log(
        `[API] POST /api/v1/daytona/files/list - Invalid request body (400)`
      );
      const response2 = {
        success: false,
        error: "Invalid request body"
      };
      return res.status(400).json(response2);
    }
    const { sandboxId: sandboxId2 } = parsed.data;
    const sandbox = await daytonaClient.findOne({ id: sandboxId2 });
    if (!sandbox) {
      console.log(
        `[API] POST /api/v1/daytona/files/list - Sandbox not found (404, sandboxId: ${sandboxId2})`
      );
      const response2 = {
        success: false,
        error: "Sandbox not found"
      };
      return res.status(404).json(response2);
    }
    const { getRecursiveFileList } = await import("./validation-utils-6N65EFIH.js");
    const files = await getRecursiveFileList(sandbox);
    const filesObject = {};
    files.forEach((metadata, path3) => {
      filesObject[path3] = metadata;
    });
    const elapsed = Date.now() - startTime;
    console.log(
      `[API] POST /api/v1/daytona/files/list - Success (sandboxId: ${sandboxId2}, fileCount: ${files.size}, ${elapsed}ms)`
    );
    const response = {
      success: true,
      data: { files: filesObject }
    };
    res.json(response);
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(
      `[API] POST /api/v1/daytona/files/list - Error (sandboxId: ${sandboxId}, ${elapsed}ms):`,
      error
    );
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to list files"
    };
    res.status(500).json(response);
  }
});
router.post("/files/find", async (req, res) => {
  try {
    const parsed = findFilesSchema.safeParse(req.body);
    if (!parsed.success) {
      const response2 = {
        success: false,
        error: "Invalid request body"
      };
      return res.status(400).json(response2);
    }
    const { sandboxId, pattern } = parsed.data;
    const sandbox = await daytonaClient.findOne({ id: sandboxId });
    if (!sandbox) {
      const response2 = {
        success: false,
        error: "Sandbox not found"
      };
      return res.status(404).json(response2);
    }
    const path3 = "/home/daytona/workspace";
    const matches = await (sandbox.fs?.findFiles(path3, pattern) || Promise.resolve([]));
    const foundFiles = matches.map(
      (match) => match.path || match.toString()
    );
    const response = {
      success: true,
      data: { files: foundFiles }
    };
    res.json(response);
  } catch (error) {
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to find files"
    };
    res.status(500).json(response);
  }
});
router.post("/files/batch-write", async (req, res) => {
  try {
    const parsed = batchWriteFilesSchema.safeParse(req.body);
    if (!parsed.success) {
      const response2 = {
        success: false,
        error: "Invalid request body"
      };
      return res.status(400).json(response2);
    }
    const { sandboxId, files } = parsed.data;
    const sandbox = await daytonaClient.findOne({ id: sandboxId });
    if (!sandbox) {
      const response2 = {
        success: false,
        error: "Sandbox not found"
      };
      return res.status(404).json(response2);
    }
    const results = [];
    for (const file of files) {
      try {
        await writeFileToSandbox(sandbox, file.path, file.content);
        results.push({ path: file.path, success: true });
      } catch (error) {
        results.push({
          path: file.path,
          success: false,
          error: error instanceof Error ? error.message : "Failed to write file"
        });
      }
    }
    const response = {
      success: true,
      data: { results }
    };
    res.json(response);
  } catch (error) {
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to batch write files"
    };
    res.status(500).json(response);
  }
});
router.post("/files/replace", async (req, res) => {
  try {
    const parsed = replaceInFilesSchema.safeParse(req.body);
    if (!parsed.success) {
      const response2 = {
        success: false,
        error: "Invalid request body"
      };
      return res.status(400).json(response2);
    }
    const { sandboxId, replacements } = parsed.data;
    const sandbox = await daytonaClient.findOne({ id: sandboxId });
    if (!sandbox) {
      const response2 = {
        success: false,
        error: "Sandbox not found"
      };
      return res.status(404).json(response2);
    }
    const results = [];
    for (const replacement of replacements) {
      try {
        const workspacePath = `/home/daytona/workspace/${replacement.path}`;
        if (sandbox.fs && typeof sandbox.fs.replaceInFiles === "function") {
          await sandbox.fs.replaceInFiles(
            [workspacePath],
            replacement.oldValue,
            replacement.newValue
          );
        } else {
          const content = await readFileFromSandbox(sandbox, replacement.path);
          const newContent = content.replace(
            new RegExp(replacement.oldValue, "g"),
            replacement.newValue
          );
          await writeFileToSandbox(sandbox, replacement.path, newContent);
        }
        results.push({ path: replacement.path, success: true });
      } catch (error) {
        results.push({
          path: replacement.path,
          success: false,
          error: error instanceof Error ? error.message : "Failed to replace in file"
        });
      }
    }
    const response = {
      success: true,
      data: { results }
    };
    res.json(response);
  } catch (error) {
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to replace in files"
    };
    res.status(500).json(response);
  }
});
router.post("/packages/install", async (req, res) => {
  const startTime = Date.now();
  const { sandboxId, packages } = req.body;
  console.log(
    `[API] POST /api/v1/daytona/packages/install - Starting (sandboxId: ${sandboxId}, packages: ${packages?.join(", ")})...`
  );
  try {
    const parsed = installPackagesSchema.safeParse(req.body);
    if (!parsed.success) {
      console.log(
        `[API] POST /api/v1/daytona/packages/install - Invalid request body (400)`
      );
      const response2 = {
        success: false,
        error: "Invalid request body"
      };
      return res.status(400).json(response2);
    }
    const { sandboxId: sandboxId2, packages: packages2, dev = false } = parsed.data;
    const sandbox = await daytonaClient.findOne({ id: sandboxId2 });
    if (!sandbox) {
      console.log(
        `[API] POST /api/v1/daytona/packages/install - Sandbox not found (404, sandboxId: ${sandboxId2})`
      );
      const response2 = {
        success: false,
        error: "Sandbox not found"
      };
      return res.status(404).json(response2);
    }
    let packageManager = "npm";
    try {
      const workspacePath = "/home/daytona/workspace";
      try {
        await sandbox.fs.downloadFile(`${workspacePath}/bun.lockb`);
        packageManager = "bun";
      } catch {
        try {
          await sandbox.fs.downloadFile(`${workspacePath}/pnpm-lock.yaml`);
          packageManager = "pnpm";
        } catch {
          try {
            await sandbox.fs.downloadFile(`${workspacePath}/yarn.lock`);
            packageManager = "yarn";
          } catch {
            packageManager = "npm";
          }
        }
      }
    } catch (error) {
      console.log(
        "[installPackages] Could not detect package manager, using npm"
      );
    }
    let installCommand;
    const packagesStr = packages2.join(" ");
    switch (packageManager) {
      case "bun":
        installCommand = `bun add ${dev ? "-d" : ""} ${packagesStr}`;
        break;
      case "pnpm":
        installCommand = `pnpm add ${dev ? "-D" : ""} ${packagesStr}`;
        break;
      case "yarn":
        installCommand = `yarn add ${dev ? "-D" : ""} ${packagesStr}`;
        break;
      default:
        installCommand = `npm install ${dev ? "--save-dev" : ""} ${packagesStr}`;
    }
    console.log(
      `[API] POST /api/v1/daytona/packages/install - Running: ${installCommand}`
    );
    const result = await runCommandOnSandbox(sandbox, installCommand, {
      timeoutMs: 6e4
      // 60 second timeout for package installation
    });
    const elapsed = Date.now() - startTime;
    console.log(
      `[API] POST /api/v1/daytona/packages/install - Success (sandboxId: ${sandboxId2}, packageManager: ${packageManager}, count: ${packages2.length}, ${elapsed}ms)`
    );
    const response = {
      success: true,
      data: {
        packageManager,
        command: installCommand,
        output: result.stdout || result.result,
        packages: packages2
      }
    };
    res.json(response);
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(
      `[API] POST /api/v1/daytona/packages/install - Error (sandboxId: ${sandboxId}, ${elapsed}ms):`,
      error
    );
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to install packages"
    };
    res.status(500).json(response);
  }
});
router.post("/theme/apply", async (req, res) => {
  const startTime = Date.now();
  const { sandboxId, theme } = req.body;
  console.log(
    `[API] POST /api/v1/daytona/theme/apply - Starting (sandboxId: ${sandboxId}, theme: ${theme})...`
  );
  try {
    const parsed = applyThemeSchema.safeParse(req.body);
    if (!parsed.success) {
      console.log(
        `[API] POST /api/v1/daytona/theme/apply - Invalid request body (400)`
      );
      const response2 = {
        success: false,
        error: "Invalid request body"
      };
      return res.status(400).json(response2);
    }
    const { sandboxId: sandboxId2, theme: theme2 } = parsed.data;
    const sandbox = await daytonaClient.findOne({ id: sandboxId2 });
    if (!sandbox) {
      console.log(
        `[API] POST /api/v1/daytona/theme/apply - Sandbox not found (404, sandboxId: ${sandboxId2})`
      );
      const response2 = {
        success: false,
        error: "Sandbox not found"
      };
      return res.status(404).json(response2);
    }
    const validThemes = [
      "default",
      "new-york",
      "blue",
      "green",
      "orange",
      "red",
      "rose",
      "slate",
      "stone",
      "gray",
      "neutral",
      "zinc",
      "violet",
      "yellow"
    ];
    if (!validThemes.includes(theme2)) {
      console.log(
        `[API] POST /api/v1/daytona/theme/apply - Invalid theme (400, theme: ${theme2})`
      );
      const response2 = {
        success: false,
        error: `Invalid theme: ${theme2}. Valid themes: ${validThemes.join(", ")}`
      };
      return res.status(400).json(response2);
    }
    const themeCommand = `npx -y shadcn@latest add https://tweakcn.com/r/themes/${theme2}.json --yes`;
    console.log(
      `[API] POST /api/v1/daytona/theme/apply - Running: ${themeCommand}`
    );
    const result = await runCommandOnSandbox(sandbox, themeCommand, {
      timeoutMs: 12e4
      // 2 minute timeout for theme installation
    });
    const cssContent = await readFileFromSandbox(sandbox, "src/index.css");
    const elapsed = Date.now() - startTime;
    console.log(
      `[API] POST /api/v1/daytona/theme/apply - Success (sandboxId: ${sandboxId2}, theme: ${theme2}, ${elapsed}ms)`
    );
    const response = {
      success: true,
      data: {
        theme: theme2,
        output: result.stdout || result.result,
        cssContent
      }
    };
    res.json(response);
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(
      `[API] POST /api/v1/daytona/theme/apply - Error (sandboxId: ${sandboxId}, theme: ${theme}, ${elapsed}ms):`,
      error
    );
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to apply theme"
    };
    res.status(500).json(response);
  }
});
var daytona_default = router;

// src/routes/modal.ts
init_esm_shims();
import {
  Router as Router2
} from "express";
import { z as z2 } from "zod";
var router2 = Router2();
var createSandboxSchema2 = z2.object({
  projectId: z2.string(),
  fragmentId: z2.string().optional().nullable(),
  templateName: z2.string().optional(),
  isImportedProject: z2.boolean().optional(),
  importedFrom: z2.string().optional().nullable()
});
var restoreFragmentSchema2 = z2.object({
  sandboxId: z2.string(),
  fragmentId: z2.string(),
  projectId: z2.string()
});
var restoreFilesSchema2 = z2.object({
  sandboxId: z2.string(),
  files: z2.record(z2.string(), z2.string())
});
var executeCommandSchema2 = z2.object({
  sandboxId: z2.string(),
  command: z2.string(),
  timeoutMs: z2.number().optional()
});
var fileReadSchema = z2.object({
  sandboxId: z2.string(),
  path: z2.string()
});
var fileWriteSchema = z2.object({
  sandboxId: z2.string(),
  path: z2.string(),
  content: z2.string()
});
var uploadMetadataImageSchema2 = z2.object({
  projectId: z2.string(),
  imageType: z2.enum(["icon", "shareImage"]),
  base64Data: z2.string(),
  fileExtension: z2.string()
});
var getMetadataImageSchema2 = z2.object({
  projectId: z2.string(),
  imageType: z2.enum(["icon", "shareImage"])
});
var listFilesSchema2 = z2.object({
  sandboxId: z2.string()
});
var findFilesSchema2 = z2.object({
  sandboxId: z2.string(),
  pattern: z2.string()
});
var batchWriteSchema = z2.object({
  sandboxId: z2.string(),
  files: z2.array(
    z2.object({
      path: z2.string(),
      content: z2.string()
    })
  )
});
router2.get(
  "/sandbox/:projectId/status",
  async (req, res) => {
    try {
      const { projectId } = req.params;
      req.logger?.info("Getting Modal sandbox status (read-only)");
      const sandboxInfo = await getSandbox(projectId, req.logger);
      if (!sandboxInfo) {
        req.logger?.warn("Modal sandbox not found");
        const response2 = {
          success: true,
          data: {
            isActive: false,
            status: "not_found",
            sandboxId: null,
            sandboxUrl: null,
            sandboxExpiresAt: null
          }
        };
        return res.json(response2);
      }
      const health = await getSandboxHealth(projectId, req.logger);
      const response = {
        success: true,
        data: {
          isActive: !health.broken,
          status: health.broken ? "unhealthy" : "running",
          sandboxId: sandboxInfo.sandboxId,
          sandboxUrl: sandboxInfo.sandboxUrl,
          sandboxExpiresAt: sandboxInfo.sandboxExpiresAt,
          healthReason: health.reason,
          missingFiles: health.missingFiles
        }
      };
      res.json(response);
    } catch (error) {
      req.logger?.error({
        msg: "Error getting Modal sandbox status",
        error: error instanceof Error ? error.message : "Unknown error"
      });
      const response = {
        success: true,
        data: {
          isActive: false,
          status: "terminated",
          sandboxId: null,
          sandboxUrl: null,
          sandboxExpiresAt: null,
          error: error instanceof Error ? error.message : "Unknown error"
        }
      };
      res.json(response);
    }
  }
);
router2.get("/sandbox/:projectId", async (req, res) => {
  try {
    const { projectId } = req.params;
    req.logger?.info("Getting Modal sandbox for project");
    let sandboxInfo = await getSandbox(projectId, req.logger);
    if (!sandboxInfo) {
      req.logger?.warn("Modal sandbox not found");
      const response2 = {
        success: false,
        error: "Sandbox not found"
      };
      return res.status(404).json(response2);
    }
    const health = await getSandboxHealth(projectId, req.logger);
    if (health.broken) {
      req.logger?.warn({
        msg: "Modal sandbox unhealthy, triggering recovery",
        projectId,
        sandboxId: sandboxInfo.sandboxId,
        reason: health.reason,
        missingFiles: health.missingFiles
      });
      const recovery = await ensureSandboxRecovered(projectId, {
        logger: req.logger
      });
      req.logger?.info({
        msg: "Modal sandbox recovery attempted during project load",
        projectId,
        recovered: recovery.recovered,
        sandboxId: recovery.sandboxId
      });
      sandboxInfo = await getSandbox(projectId, req.logger);
      if (!sandboxInfo) {
        const response2 = {
          success: false,
          error: "Sandbox recovery is still in progress. Please reload in a few seconds."
        };
        return res.status(503).json(response2);
      }
    }
    req.logger?.info({
      msg: "Modal sandbox retrieved successfully",
      sandboxId: sandboxInfo.sandboxId
    });
    const response = {
      success: true,
      data: {
        sandboxId: sandboxInfo.sandboxId,
        sandboxUrl: sandboxInfo.sandboxUrl,
        originalSandboxUrl: sandboxInfo.originalSandboxUrl,
        sandboxExpiresAt: sandboxInfo.sandboxExpiresAt
      }
    };
    res.json(response);
  } catch (error) {
    req.logger?.error({
      msg: "Error getting Modal sandbox",
      error: error instanceof Error ? error.message : "Unknown error"
    });
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
    res.status(500).json(response);
  }
});
router2.post(
  "/sandbox/start-dev-server",
  async (req, res) => {
    try {
      const validatedData = z2.object({
        sandboxId: z2.string(),
        projectId: z2.string(),
        port: z2.number().optional().default(8080)
      }).parse(req.body);
      const { sandboxId, projectId, port } = validatedData;
      req.logger?.info({
        msg: "Starting dev server in Modal sandbox",
        sandboxId,
        projectId,
        port
      });
      const devServerUrl = await startDevServer(
        sandboxId,
        projectId,
        port,
        req.logger
      );
      req.logger?.info({
        msg: "Dev server started successfully",
        sandboxId,
        devServerUrl
      });
      res.json({
        success: true,
        data: { devServerUrl }
      });
    } catch (error) {
      req.logger?.error({
        msg: "Error starting dev server",
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to start dev server"
      });
    }
  }
);
router2.post("/sandbox", async (req, res) => {
  try {
    const validatedData = createSandboxSchema2.parse(req.body);
    const {
      projectId,
      fragmentId,
      templateName,
      isImportedProject: isImportedProject2,
      importedFrom
    } = validatedData;
    console.log(validatedData);
    req.logger?.info({
      msg: "Creating Modal sandbox",
      fragmentId,
      templateName,
      isImportedProject: isImportedProject2,
      importedFrom
    });
    const sandboxInfo = await createSandbox(
      projectId,
      fragmentId || null,
      templateName,
      req.logger,
      { isImportedProject: isImportedProject2 ?? false, importedFrom }
    );
    req.logger?.info({
      msg: "Modal sandbox created successfully",
      sandboxId: sandboxInfo.sandboxId
    });
    const response = {
      success: true,
      data: {
        sandboxId: sandboxInfo.sandboxId,
        sandboxUrl: sandboxInfo.sandboxUrl,
        originalSandboxUrl: sandboxInfo.originalSandboxUrl,
        sandboxExpiresAt: sandboxInfo.sandboxExpiresAt
      }
    };
    res.json(response);
  } catch (error) {
    req.logger?.error({
      msg: "Error creating Modal sandbox",
      error: error instanceof Error ? error.message : "Unknown error"
    });
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
    res.status(500).json(response);
  }
});
router2.delete("/sandbox/:sandboxId", async (req, res) => {
  try {
    const { sandboxId } = req.params;
    req.logger?.info({ msg: "Deleting Modal sandbox", sandboxId });
    await deleteSandbox(sandboxId);
    req.logger?.info({ msg: "Modal sandbox deleted", sandboxId });
    const response = {
      success: true
    };
    res.json(response);
  } catch (error) {
    req.logger?.error({
      msg: "Error deleting Modal sandbox",
      error: error instanceof Error ? error.message : "Unknown error"
    });
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
    res.status(500).json(response);
  }
});
router2.post("/fragment/restore", async (req, res) => {
  try {
    const validatedData = restoreFragmentSchema2.parse(req.body);
    const { sandboxId, fragmentId, projectId } = validatedData;
    req.logger?.info({
      msg: "Restoring fragment in Modal sandbox",
      sandboxId,
      fragmentId
    });
    await restoreV2FragmentById(sandboxId, fragmentId, projectId);
    req.logger?.info({
      msg: "Fragment restored successfully",
      sandboxId,
      fragmentId
    });
    const response = {
      success: true
    };
    res.json(response);
  } catch (error) {
    req.logger?.error({
      msg: "Error restoring fragment",
      error: error instanceof Error ? error.message : "Unknown error"
    });
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
    res.status(500).json(response);
  }
});
router2.post("/files/restore", async (req, res) => {
  try {
    const validatedData = restoreFilesSchema2.parse(req.body);
    const { sandboxId, files } = validatedData;
    const fileCount = Object.keys(files).length;
    req.logger?.info({
      msg: "Restoring files in Modal sandbox",
      sandboxId,
      fileCount
    });
    await restoreFilesById(sandboxId, files);
    req.logger?.info({
      msg: "Files restored successfully",
      sandboxId,
      fileCount
    });
    const response = {
      success: true
    };
    res.json(response);
  } catch (error) {
    req.logger?.error({
      msg: "Error restoring files",
      error: error instanceof Error ? error.message : "Unknown error"
    });
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
    res.status(500).json(response);
  }
});
router2.post("/command/execute", async (req, res) => {
  try {
    const validatedData = executeCommandSchema2.parse(req.body);
    const { sandboxId, command, timeoutMs } = validatedData;
    req.logger?.info({
      msg: "Executing command in Modal sandbox",
      sandboxId,
      command
    });
    const result = await executeCommand(sandboxId, command, { timeoutMs });
    req.logger?.info({
      msg: "Command executed",
      sandboxId,
      exitCode: result.exitCode
    });
    const response = {
      success: true,
      data: result
    };
    res.json(response);
  } catch (error) {
    req.logger?.error({
      msg: "Error executing command",
      error: error instanceof Error ? error.message : "Unknown error"
    });
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
    res.status(500).json(response);
  }
});
router2.post("/file/read", async (req, res) => {
  try {
    const validatedData = fileReadSchema.parse(req.body);
    const { sandboxId, path: path3 } = validatedData;
    req.logger?.info({
      msg: "Reading file from Modal sandbox",
      sandboxId,
      path: path3
    });
    const content = await readFile(sandboxId, path3);
    const response = {
      success: true,
      data: { content }
    };
    res.json(response);
  } catch (error) {
    req.logger?.error({
      msg: "Error reading file",
      error: error instanceof Error ? error.message : "Unknown error"
    });
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
    res.status(500).json(response);
  }
});
router2.post("/file/write", async (req, res) => {
  try {
    const validatedData = fileWriteSchema.parse(req.body);
    const { sandboxId, path: path3, content } = validatedData;
    req.logger?.info({ msg: "Writing file to Modal sandbox", sandboxId, path: path3 });
    await writeFile(sandboxId, path3, content);
    req.logger?.info({ msg: "File written successfully", sandboxId, path: path3 });
    const response = {
      success: true
    };
    res.json(response);
  } catch (error) {
    req.logger?.error({
      msg: "Error writing file",
      error: error instanceof Error ? error.message : "Unknown error"
    });
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
    res.status(500).json(response);
  }
});
router2.get("/metadata/get-image", async (req, res) => {
  try {
    const validatedData = getMetadataImageSchema2.parse(req.query);
    const { projectId, imageType } = validatedData;
    req.logger?.info({
      msg: "Getting metadata image from Modal sandbox",
      projectId,
      imageType
    });
    const sandboxInfo = await getSandbox(projectId, req.logger);
    if (!sandboxInfo) {
      throw new Error("Sandbox not found");
    }
    const filePrefix = imageType === "icon" ? "favicon" : "share-image";
    const searchPattern = `${filePrefix}.*`;
    const matchingFiles = await findFiles(
      sandboxInfo.sandboxId,
      searchPattern,
      req.logger
    );
    const targetDir = imageType === "icon" ? "public/" : "public/images/";
    const filteredFiles = matchingFiles.filter((file2) => {
      const normalizedPath = file2.startsWith(targetDir);
      return normalizedPath;
    });
    if (filteredFiles.length === 0) {
      const response2 = {
        success: false,
        error: "Image not found"
      };
      return res.status(404).json(response2);
    }
    const imageFile = filteredFiles[0];
    const fullPath = `/workspace/${imageFile}`;
    const file = await sandboxInfo.sandbox.open(fullPath, "r");
    const data = await file.read();
    await file.close();
    const base64Data = Buffer.from(data).toString("base64");
    const ext = imageFile.split(".").pop()?.toLowerCase();
    const mimeTypes = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml"
    };
    const mimeType = mimeTypes[ext || ""] || "application/octet-stream";
    const dataUrl = `data:${mimeType};base64,${base64Data}`;
    req.logger?.info({
      msg: "Metadata image retrieved successfully",
      projectId,
      imageType,
      file: imageFile,
      size: data.length
    });
    const response = {
      success: true,
      data: {
        dataUrl,
        mimeType,
        filename: imageFile.split("/").pop()
      }
    };
    res.json(response);
  } catch (error) {
    req.logger?.error({
      msg: "Error getting metadata image",
      error: error instanceof Error ? error.message : "Unknown error"
    });
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
    res.status(500).json(response);
  }
});
router2.post("/metadata/upload-image", async (req, res) => {
  try {
    const validatedData = uploadMetadataImageSchema2.parse(req.body);
    const { projectId, imageType, base64Data, fileExtension } = validatedData;
    req.logger?.info({
      msg: "Uploading metadata image to Modal sandbox",
      projectId,
      imageType
    });
    const sandboxInfo = await getSandbox(projectId, req.logger);
    if (!sandboxInfo) {
      throw new Error("Sandbox not found");
    }
    const filename = imageType === "icon" ? `favicon.${fileExtension}` : `share-image.${fileExtension}`;
    const path3 = imageType === "icon" ? `public/${filename}` : `public/images/${filename}`;
    const imageBuffer = Buffer.from(base64Data, "base64");
    const dirPath = path3.substring(0, path3.lastIndexOf("/"));
    if (dirPath) {
      await sandboxInfo.sandbox.exec(["mkdir", "-p", `/workspace/${dirPath}`]);
    }
    const fullPath = `/workspace/${path3}`;
    const file = await sandboxInfo.sandbox.open(fullPath, "w");
    await file.write(new Uint8Array(imageBuffer));
    await file.close();
    req.logger?.info({
      msg: "Metadata image uploaded successfully",
      projectId,
      imageType,
      path: path3,
      size: imageBuffer.length
    });
    const response = {
      success: true,
      data: {
        path: path3,
        filename,
        url: imageType === "icon" ? `/${filename}` : `/images/${filename}`
      }
    };
    res.json(response);
  } catch (error) {
    req.logger?.error({
      msg: "Error uploading metadata image",
      error: error instanceof Error ? error.message : "Unknown error"
    });
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
    res.status(500).json(response);
  }
});
router2.post("/files/list", async (req, res) => {
  try {
    const validatedData = listFilesSchema2.parse(req.body);
    const { sandboxId } = validatedData;
    req.logger?.info({ msg: "Listing files in Modal sandbox", sandboxId });
    const filesMap = await listFiles(sandboxId);
    const filesObject = {};
    filesMap.forEach((value, key) => {
      filesObject[key] = value;
    });
    req.logger?.info({
      msg: "Files listed successfully",
      sandboxId,
      fileCount: filesMap.size
    });
    const response = {
      success: true,
      data: { files: filesObject }
    };
    res.json(response);
  } catch (error) {
    req.logger?.error({
      msg: "Error listing files",
      error: error instanceof Error ? error.message : "Unknown error"
    });
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
    res.status(500).json(response);
  }
});
router2.post("/files/find", async (req, res) => {
  try {
    const validatedData = findFilesSchema2.parse(req.body);
    const { sandboxId, pattern } = validatedData;
    req.logger?.info({
      msg: "Finding files in Modal sandbox",
      sandboxId,
      pattern
    });
    const files = await findFiles(sandboxId, pattern);
    req.logger?.info({
      msg: "Files found",
      sandboxId,
      pattern,
      matchCount: files.length
    });
    const response = {
      success: true,
      data: { files }
    };
    res.json(response);
  } catch (error) {
    req.logger?.error({
      msg: "Error finding files",
      error: error instanceof Error ? error.message : "Unknown error"
    });
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
    res.status(500).json(response);
  }
});
router2.post("/files/batch-write", async (req, res) => {
  try {
    const validatedData = batchWriteSchema.parse(req.body);
    const { sandboxId, files } = validatedData;
    req.logger?.info({
      msg: "Batch writing files to Modal sandbox",
      sandboxId,
      fileCount: files.length
    });
    const results = [];
    for (const file of files) {
      try {
        await writeFile(sandboxId, file.path, file.content);
        results.push({ path: file.path, success: true });
      } catch (error) {
        results.push({
          path: file.path,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
    const successCount = results.filter((r) => r.success).length;
    req.logger?.info({
      msg: "Batch write completed",
      sandboxId,
      total: files.length,
      successful: successCount,
      failed: files.length - successCount
    });
    const response = {
      success: true,
      data: { results }
    };
    res.json(response);
  } catch (error) {
    req.logger?.error({
      msg: "Error batch writing files",
      error: error instanceof Error ? error.message : "Unknown error"
    });
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
    res.status(500).json(response);
  }
});
var createSnapshotSchema = z2.object({
  sandboxId: z2.string(),
  fragmentId: z2.string(),
  projectId: z2.string()
});
var cleanupSnapshotsSchema = z2.object({
  projectId: z2.string(),
  keepCount: z2.number().optional().default(10)
});
var deleteSnapshotSchema = z2.object({
  imageId: z2.string()
});
var deploySandboxSchema = z2.object({
  sandboxId: z2.string(),
  projectId: z2.string(),
  appName: z2.string().optional()
});
router2.post("/snapshot/create", async (req, res) => {
  try {
    const parsed = createSnapshotSchema.safeParse(req.body);
    if (!parsed.success) {
      req.logger?.warn({
        msg: "Invalid snapshot request",
        error: parsed.error.message
      });
      const response2 = {
        success: false,
        error: parsed.error.message
      };
      return res.status(400).json(response2);
    }
    const { sandboxId, fragmentId, projectId } = parsed.data;
    req.logger?.info({
      msg: "Creating Modal snapshot",
      sandboxId,
      fragmentId
    });
    const sandboxInfo = await getSandbox(projectId);
    if (!sandboxInfo?.sandbox) {
      req.logger?.warn("Sandbox not found for snapshot creation");
      const response2 = {
        success: false,
        error: "Sandbox not found"
      };
      return res.status(404).json(response2);
    }
    const imageId = await createFilesystemSnapshot(
      sandboxInfo.sandbox,
      fragmentId,
      projectId
    );
    req.logger?.info({
      msg: "Modal snapshot created successfully",
      imageId,
      fragmentId
    });
    const response = {
      success: true,
      data: { imageId, fragmentId }
    };
    res.json(response);
  } catch (error) {
    req.logger?.error({
      msg: "Error creating Modal snapshot",
      error: error instanceof Error ? error.message : "Unknown error"
    });
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
    res.status(500).json(response);
  }
});
router2.post("/snapshot/cleanup", async (req, res) => {
  try {
    const parsed = cleanupSnapshotsSchema.safeParse(req.body);
    if (!parsed.success) {
      req.logger?.warn({
        msg: "Invalid cleanup request",
        error: parsed.error.message
      });
      const response2 = {
        success: false,
        error: parsed.error.message
      };
      return res.status(400).json(response2);
    }
    const { projectId, keepCount } = parsed.data;
    req.logger?.info({
      msg: "Cleaning up Modal snapshots",
      keepCount
    });
    const result = await cleanupOldSnapshots(projectId, keepCount);
    req.logger?.info({
      msg: "Modal snapshots cleaned up",
      deleted: result.deleted,
      kept: result.kept
    });
    const response = {
      success: true,
      data: result
    };
    res.json(response);
  } catch (error) {
    req.logger?.error({
      msg: "Error cleaning up Modal snapshots",
      error: error instanceof Error ? error.message : "Unknown error"
    });
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
    res.status(500).json(response);
  }
});
router2.delete("/snapshot/:imageId", async (req, res) => {
  try {
    const { imageId } = req.params;
    req.logger?.info({ msg: "Deleting Modal snapshot", imageId });
    const success = await deleteSnapshot(imageId);
    if (!success) {
      req.logger?.warn({ msg: "Failed to delete Modal snapshot", imageId });
      const response2 = {
        success: false,
        error: "Failed to delete snapshot"
      };
      return res.status(500).json(response2);
    }
    req.logger?.info({ msg: "Modal snapshot deleted successfully", imageId });
    const response = {
      success: true,
      data: { imageId, deleted: true }
    };
    res.json(response);
  } catch (error) {
    req.logger?.error({
      msg: "Error deleting Modal snapshot",
      error: error instanceof Error ? error.message : "Unknown error"
    });
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
    res.status(500).json(response);
  }
});
router2.post("/deploy", async (req, res) => {
  try {
    const parsed = deploySandboxSchema.safeParse(req.body);
    if (!parsed.success) {
      req.logger?.warn({
        msg: "Invalid deploy request",
        error: parsed.error.message
      });
      const response2 = {
        success: false,
        error: parsed.error.message
      };
      return res.status(400).json(response2);
    }
    const { sandboxId, projectId, appName } = parsed.data;
    req.logger?.info({
      msg: "Deploying Modal sandbox",
      sandboxId,
      projectId,
      appName
    });
    const sandboxInfo = await getSandbox(projectId, req.logger);
    if (!sandboxInfo?.sandbox) {
      req.logger?.warn("Sandbox not found for deployment");
      const response2 = {
        success: false,
        error: "Sandbox not found"
      };
      return res.status(404).json(response2);
    }
    const deploymentResult = await deploySandboxApp(
      sandboxInfo.sandbox,
      projectId,
      appName,
      req.logger
    );
    req.logger?.info({
      msg: "Modal deployment completed",
      sandboxId,
      success: deploymentResult.success,
      deploymentUrl: deploymentResult.deploymentUrl,
      hasError: !!deploymentResult.error
    });
    const response = {
      success: true,
      // API call succeeded, even if deployment failed
      data: deploymentResult
    };
    res.json(response);
  } catch (error) {
    req.logger?.error({
      msg: "Error deploying Modal sandbox",
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : void 0
    });
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const response = {
      success: true,
      // API call succeeded, but deployment failed
      data: {
        success: false,
        error: errorMessage,
        logs: errorMessage
      }
    };
    res.json(response);
  }
});
router2.get("/sandbox/:projectId/debug", async (req, res) => {
  const { projectId } = req.params;
  try {
    const sandboxInfo = await getSandbox(projectId, req.logger);
    if (!sandboxInfo) {
      res.status(404).json({ success: false, error: "Sandbox not found" });
      return;
    }
    const psResult = await executeCommand(
      sandboxInfo.sandboxId,
      `sh -c 'ps aux | grep -E "vite|bun|node" | grep -v grep || echo "(no matching processes)"'`
    );
    const portResult = await executeCommand(
      sandboxInfo.sandboxId,
      `sh -c 'ss -tlnp | grep 5173 || echo "(nothing on port 5173)"'`
    );
    const logResult = await executeCommand(
      sandboxInfo.sandboxId,
      `sh -c 'tail -n 50 /tmp/vite.log 2>/dev/null || echo "(no vite.log)"'`
    );
    const envResult = await executeCommand(
      sandboxInfo.sandboxId,
      `sh -c 'cat .env 2>/dev/null || echo "(no .env)"'`
    );
    res.json({
      success: true,
      data: {
        sandboxId: sandboxInfo.sandboxId,
        sandboxUrl: sandboxInfo.sandboxUrl,
        processes: psResult.stdout || "(empty)",
        port5173: portResult.stdout || "(empty)",
        devLog: logResult.stdout || "(empty)",
        envFile: envResult.stdout || "(empty)"
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});
router2.get(
  "/sandbox/:projectId/dev-logs",
  async (req, res) => {
    const { projectId } = req.params;
    const lines = parseInt(req.query.lines) || 100;
    req.logger?.info({ msg: "Reading dev server logs", projectId, lines });
    try {
      const sandboxInfo = await getSandbox(projectId, req.logger);
      if (!sandboxInfo) {
        res.status(404).json({ success: false, error: "Sandbox not found" });
        return;
      }
      const result = await executeCommand(
        sandboxInfo.sandboxId,
        `sh -c 'tail -n ${lines} /tmp/dev.log 2>/dev/null || echo "(no dev.log found)"'`
      );
      res.json({
        success: true,
        data: {
          logs: result.stdout || "(empty)",
          stderr: result.stderr || "",
          exitCode: result.exitCode
        }
      });
    } catch (error) {
      req.logger?.error({
        msg: "Error reading dev logs",
        error: error instanceof Error ? error.message : "Unknown error"
      });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }
);
var modal_default = router2;

// src/routes/convex.ts
init_esm_shims();
import {
  Router as Router3
} from "express";
import { z as z3 } from "zod";
import { decryptDeployKey } from "@shipper/convex";
var router3 = Router3();
var deploySchema = z3.object({
  projectId: z3.string(),
  environment: z3.enum(["development", "production"]).optional()
});
router3.post("/deploy", async (req, res) => {
  const parsed = deploySchema.safeParse(req.body);
  if (!parsed.success) {
    const response = {
      success: false,
      error: "Invalid request body"
    };
    return res.status(400).json(response);
  }
  const { projectId, environment = "production" } = parsed.data;
  try {
    req.logger?.info({ msg: "Starting Convex deploy", projectId, environment });
    const sandboxInfo = await getSandbox(projectId, req.logger);
    if (!sandboxInfo || !sandboxInfo.sandboxId) {
      const response2 = {
        success: false,
        error: "No active Modal sandbox found for this project. Convex deploy requires a Modal sandbox."
      };
      return res.status(400).json(response2);
    }
    let command;
    if (environment === "production") {
      const convexDeployment = await prisma.convexDeployment.findUnique({
        where: { projectId }
      });
      if (!convexDeployment) {
        req.logger?.warn({
          msg: "No ConvexDeployment found for project - cannot deploy to production",
          projectId
        });
        const response2 = {
          success: false,
          error: "No Convex deployment found for this project. The project may not have Shipper Cloud enabled."
        };
        return res.status(400).json(response2);
      }
      if (!convexDeployment.deployKeyEncrypted) {
        req.logger?.error({
          msg: "ConvexDeployment has no deploy key",
          projectId
        });
        const response2 = {
          success: false,
          error: "Convex deployment is missing deploy key. Please contact support."
        };
        return res.status(500).json(response2);
      }
      let deployKey;
      try {
        deployKey = decryptDeployKey(convexDeployment.deployKeyEncrypted);
        req.logger?.info({
          msg: "Successfully decrypted deploy key",
          projectId
        });
      } catch (decryptError) {
        req.logger?.error({
          msg: "Failed to decrypt deploy key",
          projectId,
          error: decryptError instanceof Error ? decryptError.message : String(decryptError)
        });
        const response2 = {
          success: false,
          error: "Failed to decrypt Convex deploy key. Please contact support."
        };
        return res.status(500).json(response2);
      }
      command = `sh -c 'CONVEX_DEPLOY_KEY="${deployKey}" bunx convex deploy --yes'`;
      req.logger?.info({
        msg: "Executing production Convex deploy",
        sandboxId: sandboxInfo.sandboxId
      });
    } else {
      command = "bunx convex deploy --yes";
      req.logger?.info({
        msg: "Executing development Convex deploy (using prod deployment)",
        sandboxId: sandboxInfo.sandboxId
      });
    }
    const result = await executeCommand(
      sandboxInfo.sandboxId,
      command,
      void 0,
      req.logger
    );
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
    if (result.exitCode !== 0) {
      req.logger?.error({
        msg: "Convex deploy failed",
        projectId,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr
      });
      if (environment === "production") {
        await prisma.convexDeployment.update({
          where: { projectId },
          data: {
            status: "ERROR",
            lastDeployError: result.stderr || result.stdout || `Exit code ${result.exitCode}`
          }
        }).catch(
          (e) => req.logger?.warn({
            msg: "Failed to update ConvexDeployment status",
            error: e
          })
        );
      }
      const response2 = {
        success: false,
        error: result.stderr || result.stdout || `Convex deploy failed with exit code ${result.exitCode}`,
        data: { exitCode: result.exitCode, output }
      };
      return res.status(500).json(response2);
    }
    if (environment === "production") {
      await prisma.convexDeployment.update({
        where: { projectId },
        data: {
          status: "ACTIVE",
          lastDeployedAt: /* @__PURE__ */ new Date(),
          lastDeployError: null
        }
      }).catch(
        (e) => req.logger?.warn({
          msg: "Failed to update ConvexDeployment status",
          error: e
        })
      );
    }
    req.logger?.info({
      msg: "Convex deploy succeeded",
      projectId,
      environment
    });
    const response = {
      success: true,
      data: { output, environment }
    };
    return res.json(response);
  } catch (error) {
    req.logger?.error({
      msg: "Convex deploy error",
      error: error instanceof Error ? error.message : String(error)
    });
    const response = {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
    return res.status(500).json(response);
  }
});
var convex_default = router3;

// src/routes/errors.ts
init_esm_shims();
import {
  Router as Router4
} from "express";
import { z as z4 } from "zod";
var router4 = Router4();
var detectHybridSchema = z4.object({
  projectId: z4.string().uuid(),
  fragmentId: z4.string().uuid().optional()
});
var autoFixSchema = z4.object({
  projectId: z4.string().uuid(),
  fragmentId: z4.string().uuid().optional()
});
router4.post("/detect-hybrid", async (req, res) => {
  try {
    const parsed = detectHybridSchema.safeParse(req.body);
    if (!parsed.success) {
      const response2 = {
        success: false,
        error: "Invalid request body"
      };
      return res.status(400).json(response2);
    }
    const { projectId, fragmentId } = parsed.data;
    const logger3 = createProjectLogger(projectId);
    logger3.info({ msg: "Starting hybrid error detection", fragmentId });
    const targetFragment = fragmentId ? await prisma.v2Fragment.findUnique({
      where: { id: fragmentId },
      select: { id: true, title: true, files: true }
    }) : await prisma.v2Fragment.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, files: true }
    });
    if (!targetFragment || !targetFragment.files) {
      const response2 = {
        success: false,
        error: "No fragment found with files to analyze"
      };
      return res.status(404).json(response2);
    }
    const fragmentFiles = targetFragment.files;
    const sandboxInfo = await getSandbox(projectId);
    let detectedErrors;
    let analysisType;
    try {
      if (sandboxInfo) {
        const sandboxId = sandboxInfo.sandboxId || sandboxInfo.sandbox?.sandboxId || null;
        if (sandboxId) {
          logger3.info({
            msg: "Analyzing project with Modal sandbox hybrid analysis",
            sandboxId
          });
          detectedErrors = await ErrorDetector.analyzeProjectWithFragmentModal(
            fragmentFiles,
            sandboxId
          );
          analysisType = "hybrid";
        } else {
          detectedErrors = await ErrorDetector.analyzeV2Fragment(
            fragmentFiles
          );
          analysisType = "fragment-only";
        }
      } else {
        detectedErrors = await ErrorDetector.analyzeV2Fragment(
          fragmentFiles,
          logger3
        );
        analysisType = "fragment-only";
      }
    } catch (error) {
      logger3.error({
        msg: "Error analysis failed",
        error: error instanceof Error ? error.message : String(error)
      });
      detectedErrors = {
        buildErrors: [],
        runtimeErrors: [],
        importErrors: [],
        navigationErrors: [],
        severity: "low",
        autoFixable: false,
        totalErrors: 0,
        detectedAt: /* @__PURE__ */ new Date()
      };
      analysisType = "fragment-only";
    }
    const classification = ErrorClassifier.categorizeErrors(detectedErrors);
    req.logger?.info({
      msg: "Error detection complete",
      totalErrors: detectedErrors.totalErrors,
      analysisType
    });
    const response = {
      success: true,
      data: {
        errors: detectedErrors,
        classification,
        fragmentId: targetFragment.id,
        fragmentTitle: targetFragment.title,
        analysisType,
        canAutoFix: detectedErrors.autoFixable
      }
    };
    res.json(response);
  } catch (error) {
    req.logger?.error({
      msg: "Hybrid error detection failed",
      error: error instanceof Error ? error.message : "Unknown error"
    });
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to detect errors"
    };
    res.status(500).json(response);
  }
});
router4.post("/auto-fix", async (req, res) => {
  try {
    const parsed = autoFixSchema.safeParse(req.body);
    if (!parsed.success) {
      const response2 = {
        success: false,
        error: "Invalid request body"
      };
      return res.status(400).json(response2);
    }
    const { projectId, fragmentId } = parsed.data;
    const logger3 = createProjectLogger(projectId);
    logger3.info({ msg: "Starting auto-fix", fragmentId });
    const targetFragment = fragmentId ? await prisma.v2Fragment.findUnique({
      where: { id: fragmentId },
      select: { id: true, title: true, files: true }
    }) : await prisma.v2Fragment.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, files: true }
    });
    if (!targetFragment || !targetFragment.files) {
      const response2 = {
        success: false,
        error: "No fragment found with files to fix"
      };
      return res.status(404).json(response2);
    }
    const fragmentFiles = targetFragment.files;
    const sandboxInfo = await getSandbox(projectId);
    let detectedErrors;
    try {
      if (sandboxInfo) {
        const sandboxId = sandboxInfo.sandboxId || sandboxInfo.sandbox?.sandboxId || null;
        if (sandboxId) {
          logger3.info({
            msg: "Analyzing project with Modal sandbox hybrid analysis",
            sandboxId
          });
          detectedErrors = await ErrorDetector.analyzeProjectWithFragmentModal(
            fragmentFiles,
            sandboxId
          );
        } else {
          detectedErrors = await ErrorDetector.analyzeV2Fragment(
            fragmentFiles
          );
        }
      } else {
        detectedErrors = await ErrorDetector.analyzeV2Fragment(
          fragmentFiles
        );
      }
    } catch (error) {
      logger3.error({
        msg: "Error analysis failed",
        error: error instanceof Error ? error.message : String(error)
      });
      detectedErrors = {
        buildErrors: [],
        runtimeErrors: [],
        importErrors: [],
        navigationErrors: [],
        severity: "low",
        autoFixable: false,
        totalErrors: 0,
        detectedAt: /* @__PURE__ */ new Date()
      };
    }
    if (detectedErrors.totalErrors === 0) {
      const response2 = {
        success: true,
        data: {
          message: "No errors found to fix",
          totalErrors: 0,
          successfulFixes: 0,
          failedFixes: 0
        }
      };
      return res.json(response2);
    }
    const voltAgent = new VoltAgentService();
    const allErrors = [
      ...detectedErrors.buildErrors,
      ...detectedErrors.importErrors,
      ...detectedErrors.navigationErrors
    ];
    req.logger?.info({
      msg: "Processing errors with VoltAgent",
      totalErrors: allErrors.length
    });
    const fixResults = [];
    let successfulFixes = 0;
    let failedFixes = 0;
    for (const error of allErrors.slice(0, 10)) {
      try {
        req.logger?.info({
          msg: "Fixing error",
          errorType: error.type,
          severity: error.severity
        });
        const errorContext = {
          id: error.id,
          type: error.type,
          details: error.details,
          severity: error.severity,
          autoFixable: error.autoFixable
        };
        const fixResult = await voltAgent.fixError(
          errorContext,
          fragmentFiles,
          sandboxInfo?.sandbox
        );
        if (fixResult.success) {
          successfulFixes++;
          fixResults.push({
            errorId: error.id,
            success: true,
            fixedFiles: fixResult.fixedFiles,
            strategy: fixResult.strategy,
            changes: fixResult.changes
          });
          req.logger?.info({
            msg: "Error fixed successfully",
            errorId: error.id
          });
        } else {
          failedFixes++;
          fixResults.push({
            errorId: error.id,
            success: false,
            reason: fixResult.reason
          });
          req.logger?.warn({
            msg: "Failed to fix error",
            errorId: error.id,
            reason: fixResult.reason
          });
        }
      } catch (fixError) {
        req.logger?.error({
          msg: "Error during fix attempt",
          errorId: error.id,
          error: fixError instanceof Error ? fixError.message : "Unknown error"
        });
        failedFixes++;
        fixResults.push({
          errorId: error.id,
          success: false,
          reason: fixError instanceof Error ? fixError.message : "Unknown error"
        });
      }
    }
    const successRate = allErrors.length > 0 ? successfulFixes / allErrors.length * 100 : 0;
    let newFragmentId = null;
    if (successfulFixes > 0) {
      const updatedFiles = { ...fragmentFiles };
      for (const fix of fixResults.filter((r) => r.success)) {
        if (fix.fixedFiles && typeof fix.fixedFiles === "object") {
          Object.assign(updatedFiles, fix.fixedFiles);
        }
      }
      const newFragment = await prisma.v2Fragment.create({
        data: {
          projectId,
          title: `${targetFragment.title} (Auto-fixed)`,
          files: updatedFiles
        }
      });
      newFragmentId = newFragment.id;
      await prisma.project.update({
        where: { id: projectId },
        data: { activeFragmentId: newFragment.id }
      });
      req.logger?.info({
        msg: "Created new fragment with fixes and set as active",
        fragmentId: newFragmentId
      });
    }
    req.logger?.info({
      msg: "Auto-fix completed",
      successfulFixes,
      totalErrors: allErrors.length,
      successRate: successRate.toFixed(1) + "%"
    });
    const response = {
      success: true,
      data: {
        fixResults,
        summary: {
          totalErrors: allErrors.length,
          successfulFixes,
          failedFixes,
          successRate
        },
        newFragmentId,
        originalFragmentId: targetFragment.id
      }
    };
    res.json(response);
  } catch (error) {
    req.logger?.error({
      msg: "Auto-fix failed",
      error: error instanceof Error ? error.message : "Unknown error"
    });
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to auto-fix errors"
    };
    res.status(500).json(response);
  }
});
var errors_default = router4;

// src/routes/chat.ts
init_esm_shims();
import { Router as Router5 } from "express";
import { z as z6 } from "zod";

// src/utils/pricing.ts
init_esm_shims();
var PRICING = {
  /** $25 USD = 100 credits, so $1 USD = 4 credits */
  USD_TO_CREDITS: 4,
  /** 2x markup on costs (100% profit margin) - default for most operations */
  MARKUP_MULTIPLIER: 2,
  /** 1.1x markup (10% margin) - used for first prompt with Opus */
  FIRST_PROMPT_MARKUP_MULTIPLIER: 1.1,
  /** Minimum credits to charge for any operation */
  MIN_CREDITS: 1,
  /** Combined multiplier: USD_TO_CREDITS * MARKUP_MULTIPLIER = 8 */
  TOTAL_MULTIPLIER: 8,
  // 4 * 2
  /** Combined multiplier for first prompt: USD_TO_CREDITS * 1.1 = 4.4 */
  FIRST_PROMPT_MULTIPLIER: 4.4
  // 4 * 1.1
};
function calculateCreditsFromUSD(costUSD) {
  const rawCredits = costUSD * PRICING.TOTAL_MULTIPLIER;
  const roundedUp = Math.ceil(rawCredits);
  return Math.max(PRICING.MIN_CREDITS, roundedUp);
}
function calculateCreditsFromUSDFirstPrompt(costUSD) {
  const rawCredits = costUSD * PRICING.FIRST_PROMPT_MULTIPLIER;
  const roundedUp = Math.ceil(rawCredits);
  return Math.max(PRICING.MIN_CREDITS, roundedUp);
}

// src/middleware/session-auth.ts
init_esm_shims();
import { decryptChatToken } from "@shipper/shared";
var CHAT_TOKEN_SECRET = process.env.CHAT_TOKEN_SECRET || process.env.NEXTAUTH_SECRET;
function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(";").map((cookie) => {
      const [key, ...v] = cookie.trim().split("=");
      return [key, v.join("=")];
    })
  );
}
async function validateSession(req, res, next) {
  try {
    let sessionToken;
    let userId;
    let userEmail;
    const chatToken = req.headers["x-chat-token"];
    if (chatToken && CHAT_TOKEN_SECRET) {
      const payload = decryptChatToken(chatToken, CHAT_TOKEN_SECRET);
      if (payload) {
        sessionToken = payload.sessionToken;
        userId = payload.userId;
        userEmail = payload.email;
        console.log(
          "[SessionAuth] Using encrypted chat token for user:",
          userEmail
        );
      }
    }
    if (!sessionToken) {
      const cookies = parseCookies(req.headers.cookie);
      sessionToken = cookies["next-auth.session-token"] || cookies["__Secure-next-auth.session-token"];
    }
    if (!sessionToken) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        sessionToken = authHeader.substring(7);
      }
    }
    if (!sessionToken) {
      const response = {
        success: false,
        error: "Missing session token. Please sign in."
      };
      return res.status(401).json(response);
    }
    if (userId && userEmail) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          creditBalance: true,
          membershipTier: true
        }
      });
      if (!user) {
        const response = {
          success: false,
          error: "User not found"
        };
        return res.status(401).json(response);
      }
      req.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      };
      req.session = {
        sessionToken,
        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3)
        // 30 days from now
      };
    } else {
      const session = await prisma.session.findUnique({
        where: { sessionToken },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              creditBalance: true,
              membershipTier: true
            }
          }
        }
      });
      if (!session) {
        const response = {
          success: false,
          error: "Invalid session token"
        };
        return res.status(401).json(response);
      }
      if (session.expires < /* @__PURE__ */ new Date()) {
        const response = {
          success: false,
          error: "Session expired. Please sign in again."
        };
        return res.status(401).json(response);
      }
      req.user = {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: session.user.role
      };
      req.session = {
        sessionToken: session.sessionToken,
        expires: session.expires
      };
    }
    console.log(`[SessionAuth] Validated session for user: ${req.user.email}`);
    next();
  } catch (error) {
    console.error("[SessionAuth] Session validation error:", error);
    const errorMsg = (error instanceof Error ? error.message : String(error)).toLowerCase();
    const isNetworkError = errorMsg.includes("econnrefused") || errorMsg.includes("enotfound") || errorMsg.includes("etimedout") || errorMsg.includes("connection") || errorMsg.includes("network");
    const response = {
      success: false,
      error: isNetworkError ? "Network error - please reload the page and retry when your internet connection improves" : "Failed to validate session"
    };
    return res.status(500).json(response);
  }
}
async function validateProjectAccess(req, res, next) {
  try {
    if (!req.user) {
      const response = {
        success: false,
        error: "User not authenticated"
      };
      return res.status(401).json(response);
    }
    const projectId = req.body.projectId || req.params.projectId;
    if (!projectId) {
      const response = {
        success: false,
        error: "Missing projectId"
      };
      return res.status(400).json(response);
    }
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          // Direct ownership (legacy personal projects)
          { userId: req.user.id },
          // Team membership access
          {
            team: {
              members: {
                some: {
                  userId: req.user.id
                }
              }
            }
          }
        ]
      },
      select: {
        id: true,
        name: true,
        userId: true,
        teamId: true,
        team: {
          select: {
            id: true,
            name: true,
            members: {
              where: { userId: req.user.id },
              select: { role: true }
            }
          }
        }
      }
    });
    if (!project) {
      const response = {
        success: false,
        error: "Project not found or access denied"
      };
      return res.status(404).json(response);
    }
    req.project = project;
    console.log(
      `[ProjectAccess] Validated access for user ${req.user.email} to project ${projectId}`
    );
    next();
  } catch (error) {
    console.error("[ProjectAccess] Validation error:", error);
    const response = {
      success: false,
      error: "Failed to validate project access"
    };
    return res.status(500).json(response);
  }
}

// src/routes/chat.ts
import {
  convertToModelMessages,
  createUIMessageStream,
  generateId,
  generateText,
  stepCountIs,
  streamText,
  safeValidateUIMessages,
  UI_MESSAGE_STREAM_HEADERS,
  createUIMessageStreamResponse,
  smoothStream
} from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import mammoth from "mammoth";

// src/services/code-import-context.ts
init_esm_shims();
function getFrameworkGuidelines(framework) {
  const guidelines = {
    vite: `This is a Vite project. Key guidelines:
- Use import.meta.env for environment variables
- Static assets go in the public/ directory
- Check vite.config.ts/js for existing plugins and configuration
- HMR is available for fast development feedback`,
    unknown: `Framework not detected. Key guidelines:
- Explore the file structure to understand the architecture
- Check package.json for dependencies and scripts
- Follow existing patterns and conventions`
  };
  return guidelines[framework.toLowerCase()] || guidelines.unknown;
}
function getMigrationInstructions(platform) {
  const instructions = {
    LOVABLE: `### Lovable (Supabase) Migration - ONLY MIGRATE WHAT WAS DETECTED

This project was built with Lovable and uses Supabase for backend.

## \u{1F6AB} NEVER DO THESE (Common Mistakes):
- \u274C Migrate features that weren't detected in Step 1
- \u274C Delete the entire convex/ directory and recreate it
- \u274C Keep both old Supabase code AND new Convex code for the same feature
- \u274C Skip the detection step and assume what features exist

## Migration Steps

#### Step 1: CALL getFiles() FIRST (MANDATORY)
**You MUST call getFiles() before ANY file modifications.** The system will block your edits if you skip this.

Then scan the codebase and LIST what you find. Only migrate what you detect:
- **Auth**: \`supabase.auth\`, \`AuthContext\`, \`useAuth\`, \`signIn\`, \`signOut\`, \`session\`
- **Database**: \`.from('table_name')\`, \`supabase.from\`, SQL queries
- **Edge Functions**: \`supabase/functions/\` directory
- **Stripe**: \`stripe\`, \`@stripe/stripe-js\`, \`checkout\`, \`subscription\`, \`payment\`
- **AI/LLM**: \`openai\`, \`anthropic\`, \`gpt\`, \`claude\`, \`generateText\`, \`chat\`, \`completion\`
- **Email**: \`sendEmail\`, \`resend\`, \`nodemailer\`

**After scanning, state: "Detected: [list features found]. Will migrate: [same list]. Will NOT migrate: [features not found]."**

#### Step 2: Auth Migration (if auth detected)
- Follow the "\u{1F680} SHIPPER CLOUD" section - use deployToShipperCloud tool first, then scaffoldConvexSchema

#### Step 3: Database Migration (if database detected)
- Follow the "\u{1F680} SHIPPER CLOUD" section - use scaffoldConvexSchema tool to create tables

#### Step 4: Stripe Integration (ONLY if Stripe detected)
- Skip if not detected in Step 1
- Follow the "## \u{1F4B3} STRIPE INTEGRATION (Payments)" section

#### Step 5: AI/LLM Integration (ONLY if AI detected)
- Skip if not detected in Step 1
- Follow the "\u{1F916} AI INTEGRATION" section - use enableAI tool

#### Step 6: Cleanup (DO THIS LAST)
- Remove @supabase/supabase-js from package.json
- Delete supabase/ directory if it exists
- Remove unused Supabase imports
- Do NOT remove anything that wasn't migrated

**CRITICAL**: Only migrate features you detected in Step 1. Do NOT migrate features that don't exist in the codebase.`,
    BASE44: `### Base44 Migration - ONLY MIGRATE WHAT WAS DETECTED

This project was built with Base44 and uses the @base44/sdk.

## \u26A0\uFE0F CRITICAL: Location-Based Language Rules
\`\`\`
src/           \u2192 JavaScript ONLY (.js, .jsx) - NEVER change these to TypeScript
convex/        \u2192 TypeScript ONLY (.ts) - Convex REQUIRES this
config files   \u2192 Keep original extension (usually .js)
\`\`\`

## \u{1F6AB} NEVER DO THESE (Common Mistakes That Break Everything):
- \u274C Create \`convex/schema.js\` - ONLY \`convex/schema.ts\` is valid
- \u274C Keep both schema.js AND schema.ts - delete the .js, keep .ts
- \u274C Convert src/ files to TypeScript - they MUST stay .js/.jsx
- \u274C Add TypeScript syntax (types, interfaces) to .js files
- \u274C Delete and recreate the entire convex/ directory
- \u274C Change file extensions to "fix" errors
- \u274C Migrate features that weren't detected in Step 1
- \u274C Import \`Id\` or \`Doc\` from \`convex/_generated/dataModel\` in .js/.jsx files - THESE ARE TYPESCRIPT TYPES AND DON'T EXIST IN JS

## \u{1F6D1}\u{1F6D1}\u{1F6D1} CRITICAL: DO NOT CREATE src/api/entities.js \u{1F6D1}\u{1F6D1}\u{1F6D1}

**THIS IS THE #1 CAUSE OF BROKEN BASE44 MIGRATIONS!**

The AI keeps making this mistake:
\`\`\`javascript
// \u274C WRONG - src/api/entities.js with bare import (WILL BREAK!)
import { api } from "convex/_generated/api";  // ERROR: Cannot resolve bare specifier
\`\`\`

**THE FIX IS SIMPLE: DO NOT CREATE THIS FILE AT ALL!**

- DELETE \`src/api/entities.js\` entirely - do NOT replace it
- DELETE \`src/api/base44Client.js\` entirely - do NOT replace it  
- Components import Convex DIRECTLY where they need it (see below)

## \u2705 CORRECT Convex Import Pattern for JavaScript:

**In src/pages/*.jsx or src/components/*.jsx (2 levels deep):**
\`\`\`javascript
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";  // \u2705 RELATIVE PATH with correct depth!

function MyComponent() {
  const posts = useQuery(api.posts.list);
  const createPost = useMutation(api.posts.create);
}
\`\`\`

**In src/App.jsx (1 level deep):**
\`\`\`javascript
import { api } from "../convex/_generated/api";  // \u2705 One less ../
\`\`\`

**IMPORT PATH RULES:**
- \`src/App.jsx\` \u2192 \`"../convex/_generated/api"\` (1 level up)
- \`src/pages/*.jsx\` \u2192 \`"../../convex/_generated/api"\` (2 levels up)
- \`src/components/*.jsx\` \u2192 \`"../../convex/_generated/api"\` (2 levels up)
- \`src/components/ui/*.jsx\` \u2192 \`"../../../convex/_generated/api"\` (3 levels up)

**NEVER use bare specifier \`"convex/_generated/api"\`** - it only works in TypeScript projects with proper tsconfig paths!

## Migration Steps

#### Step 1: CALL getFiles() FIRST (MANDATORY)
**You MUST call getFiles() before ANY file modifications.** The system will block your edits if you skip this.

Then scan the codebase and LIST what you find. Only migrate what you detect:
- **Auth**: \`base44.auth\`, \`auth.me()\`, \`logout()\`, \`updateMe()\`, \`useAuth\`
- **Entities**: \`src/api/entities.js\`, \`entities.\`, \`.create(\`, \`.update(\`, \`.delete(\`, \`.list(\`
- **AI/LLM**: \`InvokeLLM\`, \`invokeLLM\`, \`generateText\`, \`chat\`, \`completion\`
- **Email**: \`SendEmail\`, \`sendEmail\`
- **File Upload**: \`UploadFile\`, \`uploadFile\`
- **Image Gen**: \`GenerateImage\`, \`generateImage\`
- **Stripe**: \`stripe\`, \`payment\`, \`checkout\`, \`subscription\`

**After scanning, state: "Detected: [list features found]. Will migrate: [same list]. Will NOT migrate: [features not found]."**

#### Step 2: Auth Migration (if auth detected)
- Follow the "\uFFFD SHIPPER CLOUD" section - use deployToShipperCloud tool first, then scaffoldConvexSchema

#### Step 3: Entity/Database Migration (if entities detected)
- Follow the "\uFFFD SHIPPER CLOUD" section - use scaffoldConvexSchema tool to create tables
- convex/ files MUST be .ts (TypeScript) - this is required by Convex
- src/ files MUST stay .js/.jsx - do NOT convert them
- **\u{1F6D1} DELETE \`src/api/entities.js\` and \`src/api/base44Client.js\` - DO NOT REPLACE THEM!**
- Update each component file to import Convex directly with RELATIVE path:
  \`import { api } from "../../convex/_generated/api";\` (adjust ../ count based on file depth)

#### Step 4: AI/LLM Integration (ONLY if InvokeLLM detected)
- Skip if not detected in Step 1
- Follow the "\u{1F916} AI INTEGRATION" section - use enableAI tool

#### Step 5: Stripe Integration (ONLY if payments detected)
- Skip if not detected in Step 1
- Follow the "## \u{1F4B3} STRIPE INTEGRATION (Payments)" section

#### Step 6: File Upload (ONLY if UploadFile detected)
- Skip if not detected in Step 1
- Use Convex file storage

#### Step 7: Cleanup (DO THIS LAST)
- Remove @base44/sdk from package.json
- Delete src/api/base44Client.js if no longer needed
- Remove unused Base44 imports
- Do NOT remove anything that wasn't migrated

**CRITICAL**: Only migrate features you detected in Step 1. Do NOT migrate features that don't exist in the codebase.`,
    BOLT: `### Bolt Migration - ONLY MIGRATE WHAT WAS DETECTED

This project was built with Bolt. Analyze the codebase to identify backend integrations.

## \u{1F6AB} NEVER DO THESE (Common Mistakes):
- \u274C Migrate features that weren't detected in Step 1
- \u274C Delete the entire convex/ directory and recreate it
- \u274C Skip the detection step and assume what features exist

## Migration Steps

#### Step 1: SCAN & DETECT (REQUIRED FIRST - DO NOT SKIP)
Scan the codebase and LIST what you find. Only migrate what you detect:
- **Auth**: Authentication patterns, session management
- **Database**: Data fetching, storage patterns
- **Stripe**: \`stripe\`, \`@stripe/stripe-js\`, \`checkout\`, \`subscription\`, \`payment\`
- **AI/LLM**: \`openai\`, \`anthropic\`, \`generateText\`, \`chat\`, \`completion\`

**After scanning, state: "Detected: [list features found]. Will migrate: [same list]. Will NOT migrate: [features not found]."**

Then follow the corresponding system prompt sections for each detected feature.

**CRITICAL**: Only migrate features you detected in Step 1. Do NOT migrate features that don't exist in the codebase.`,
    V0: `### V0 Migration - ONLY MIGRATE WHAT WAS DETECTED

This project was built with V0. V0 projects are typically frontend-only UI components.

## \u{1F6AB} NEVER DO THESE (Common Mistakes):
- \u274C Migrate features that weren't detected in Step 1
- \u274C Assume backend features exist when they don't
- \u274C Skip the detection step

## Migration Steps

#### Step 1: SCAN & DETECT (REQUIRED FIRST - DO NOT SKIP)
Scan the codebase and LIST what you find. V0 projects often have minimal backend:
- **Auth**: Check for any authentication patterns
- **Database**: Check for any data persistence
- **API calls**: Check for external API integrations

**After scanning, state: "Detected: [list features found]. Will migrate: [same list]. Will NOT migrate: [features not found]."**

If no backend features detected, no migration is needed - just integrate with Shipper's backend as needed.

**CRITICAL**: Only migrate features you detected in Step 1. Do NOT migrate features that don't exist in the codebase.`,
    GENERIC_VITE: `No backend migration needed - this is a standard Vite/React project.`,
    OTHER: `Backend structure unknown. Analyze the codebase to determine if migration is needed.`
  };
  return instructions[platform] || instructions.OTHER;
}
function getCodeImportContext(project) {
  if (!project.codeImport) {
    return [];
  }
  const { codeImport } = project;
  const framework = codeImport.detectedFramework || "unknown";
  const language = codeImport.detectedLanguage || "unknown";
  const fileCount = codeImport.fileCount || 0;
  const importedFrom = project.importedFrom;
  const migrationStatus = project.backendMigrationStatus;
  let contextMessage = `## IMPORTED PROJECT CONTEXT

This project was imported from an existing codebase. Important guidelines:

### Source Information
- **Source**: ${codeImport.source} (${codeImport.sourceName})${codeImport.sourceBranch ? ` - Branch: ${codeImport.sourceBranch}` : ""}
- **Framework**: ${framework}
- **Language**: ${language}
- **Files**: ${fileCount} files imported
- **Original Platform**: ${importedFrom || "Unknown"}
- **Backend Migration Status**: ${migrationStatus || "Unknown"}
${importedFrom === "BASE44" ? `
### \u26A0\uFE0F JAVASCRIPT PROJECT WITH TYPESCRIPT BACKEND
**CRITICAL**: This Base44 project uses JavaScript for frontend, but Convex REQUIRES TypeScript.

**LOCATION-BASED RULES (NEVER BREAK THESE):**
- \`src/\` directory \u2192 JavaScript ONLY (.js, .jsx) - NEVER change to .ts/.tsx
- \`convex/\` directory \u2192 TypeScript ONLY (.ts) - This is a Convex requirement
- Config files (vite.config.js, etc.) \u2192 Keep as JavaScript
- NEVER mix .js and .ts files in the same directory

**This is normal and works fine** - Convex compiles separately from your app.

### \u{1F6AB} NEVER DO THESE (Common Mistakes):
- \u274C Create \`convex/schema.js\` - ONLY \`convex/schema.ts\` is valid
- \u274C Keep both schema.js AND schema.ts - pick ONE (the .ts version)
- \u274C Convert src/ files to TypeScript - they MUST stay .js/.jsx
- \u274C Add TypeScript syntax to .js files (no type annotations, interfaces, generics)
- \u274C Delete and recreate the entire convex/ directory
- \u274C Change file extensions to "fix" TypeScript errors
- \u274C Create placeholder files like "actual schema in schema.js"
- \u274C Migrate features that weren't detected in the scan
` : ""}
### Critical Instructions

1. **EXPLORE FIRST**: Before making any changes, you MUST call getFiles() to understand the existing project structure. This is mandatory for imported projects.

2. **RESPECT EXISTING ARCHITECTURE**: This is not a fresh template. The project has an established:
   - File structure and organization
   - Naming conventions
   - Component patterns
   - State management approach
   - Routing configuration

3. **PRESERVE ROUTING LIBRARY - NEVER CHANGE IT**
   - **NEVER** import from \`@tanstack/react-router\` unless the project already uses it
   - **NEVER** change \`useNavigate\` imports to a different router
   - If project uses \`react-router-dom\` \u2192 keep using \`react-router-dom\`
   - If project uses \`wouter\` \u2192 keep using \`wouter\`
   - Call \`analyzeMigration()\` to detect which router the project uses

4. **\u26A0\uFE0F CONVEX IMPORT PATHS - COUNT THE DIRECTORY DEPTH \u26A0\uFE0F**
   When writing imports from \`convex/_generated/api\`, you MUST count the exact directory depth:
   
   **Formula**: Count folders after \`src/\` + 1 = number of \`../\` needed
   
   - \`src/App.tsx\` \u2192 1 level \u2192 \`import { api } from "../convex/_generated/api"\`
   - \`src/components/Header.tsx\` \u2192 2 levels \u2192 \`import { api } from "../../convex/_generated/api"\`
   - \`src/components/landing/Header.jsx\` \u2192 3 levels \u2192 \`import { api } from "../../../convex/_generated/api"\`
   - \`src/components/ui/buttons/Submit.tsx\` \u2192 4 levels \u2192 \`import { api } from "../../../../convex/_generated/api"\`
   
   **VERIFY BEFORE WRITING**: Count the slashes in the file path after \`src/\`, add 1, that's your \`../\` count.

5. **FOLLOW EXISTING PATTERNS**: When adding new features:
   - Match the existing code style
   - Use the same libraries and patterns already in use
   - Place new files in appropriate existing directories
   - Follow the established naming conventions

6. **DO NOT ASSUME TEMPLATE STRUCTURE**: This project may have a completely different structure than the default Shipper template. Do not assume:
   - Default file locations
   - Default dependencies
   - Default configuration
   - Default routing library (TanStack Router is ONLY for Shipper templates!)

### Framework Guidelines
${getFrameworkGuidelines(framework)}

### Before Any Modifications
1. Call getFiles() to see the complete file structure
2. Read key configuration files (package.json, config files)
3. Understand the existing component/module organization
4. Identify the entry points and routing structure`;
  if (importedFrom && (importedFrom === "LOVABLE" || importedFrom === "BASE44") && (migrationStatus === "PENDING" || migrationStatus === "IN_PROGRESS")) {
    const platformName = importedFrom === "LOVABLE" ? "Lovable (Supabase)" : "Base44";
    contextMessage += `

---

## \u{1F504} BACKEND MIGRATION AVAILABLE

This project was imported from **${platformName}** and may need backend migration to work with Shipper's backend (Convex + Better Auth).

${getMigrationInstructions(importedFrom)}

### When user says "Start migration" or similar:

**Step 1: CALL analyzeMigration() (MANDATORY)**
Call the \`analyzeMigration\` tool FIRST. This tool will:
- Scan the entire codebase automatically
- Detect auth, database, Stripe, AI, email, and file upload patterns
- Return a structured analysis with exactly what needs migration
- Provide recommended steps in order

**DO NOT manually search for patterns - the tool does this for you!**

**Step 2: REPORT THE ANALYSIS (BRIEFLY)**
After calling analyzeMigration(), briefly report:
"Detected: [list features where detected is true]. Migrating in order: [analysis.recommendedSteps]"
Do NOT mention routing library preservation - just silently respect it.

**Step 3: MIGRATE ONLY DETECTED FEATURES**
Follow the recommendedSteps from the analysis in order:
- Auth (if detected): Use deployToShipperCloud tool, then scaffoldConvexSchema
- Database/Entities (if detected): Use scaffoldConvexSchema tool to create tables
- Stripe (if detected): Follow "## \u{1F4B3} STRIPE INTEGRATION (Payments)" section
- AI/LLM (if detected): Use enableAI tool (see "\u{1F916} AI INTEGRATION" section)
- Email (if detected): Call requestApiKeys({ provider: "resend" })
- **SKIP features where analysis.detected.[feature] is false**

**Step 4: CLEANUP**
- Remove old SDK imports and dependencies
- Only clean up what was migrated

## \u{1F6AB} NEVER DO THESE:
- \u274C Skip calling analyzeMigration() and manually search for patterns
- \u274C Create convex/schema.js (only .ts is valid)
- \u274C Keep both .js and .ts versions of the same file
- \u274C Convert src/ files from .js to .ts
- \u274C Migrate features where analysis.detected.[feature] is false
- \u274C Delete the entire convex/ directory and recreate it
- \u274C **CHANGE THE ROUTING LIBRARY** - Use the SAME router the project already uses!
- \u274C Import from \`@tanstack/react-router\` if the project uses \`react-router-dom\`
- \u274C Add TanStack Router imports to imported projects

**CRITICAL**: Only migrate what analyzeMigration() detected. Do NOT invent features to migrate.
**CRITICAL**: PRESERVE the routing library! Check \`analysis.routingLibrary\` and use THAT router.`;
  }
  return [
    {
      id: "code-import-context",
      role: "system",
      parts: [{ type: "text", text: contextMessage }],
      createdAt: /* @__PURE__ */ new Date()
    }
  ];
}
function isImportedProject(project) {
  return !!project.codeImport;
}

// src/services/credits.ts
init_esm_shims();
var MINIMUM_CREDIT_BALANCE = 0.5;
var CreditManager = class {
  static async getUserCredits(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        creditBalance: true,
        membershipTier: true,
        membershipExpiresAt: true,
        lastCreditReset: true,
        monthlyCreditsUsed: true
      }
    });
    if (!user) throw new Error("User not found");
    await this.allocateMonthlyCredits(userId, user);
    return user.creditBalance;
  }
  static async deductCredits(userId, amount, type, description, metadata) {
    if (amount === 0) {
      console.warn(
        `[CreditManager] Attempted to deduct 0 credits for user ${userId}. Skipping deduction.`
      );
      return true;
    }
    if (amount < 0) {
      throw new Error(
        `[CreditManager] Attempted to deduct a negative amount (${amount}) for user ${userId}. This is not allowed.`
      );
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        creditBalance: true,
        carryOverCredits: true,
        basePlanCredits: true,
        carryOverExpiresAt: true
      }
    });
    if (!user) {
      throw new Error("User not found");
    }
    const now = /* @__PURE__ */ new Date();
    const carryOverExpired = user.carryOverExpiresAt && new Date(user.carryOverExpiresAt) <= now;
    if (carryOverExpired && user.carryOverCredits > 0) {
      console.log(
        `\u23F0 Carry-over credits expired for user ${userId}, auto-clearing ${user.carryOverCredits} credits`
      );
      const expiredAmount = user.carryOverCredits;
      await prisma.user.update({
        where: { id: userId },
        data: {
          carryOverCredits: 0,
          carryOverExpiresAt: null,
          creditBalance: { decrement: expiredAmount }
        }
      });
      user.carryOverCredits = 0;
      user.creditBalance -= expiredAmount;
    }
    if (user.creditBalance < amount) {
      throw new Error("Insufficient credits");
    }
    const balanceAfterDeduction = user.creditBalance - amount;
    if (balanceAfterDeduction < MINIMUM_CREDIT_BALANCE) {
      throw new Error(
        `Insufficient credits. Minimum balance of ${MINIMUM_CREDIT_BALANCE} credits must be maintained`
      );
    }
    const currentCarryOver = user.carryOverCredits || 0;
    const currentBasePlan = user.basePlanCredits || 0;
    let carryOverDeducted = 0;
    let basePlanDeducted = 0;
    if (currentCarryOver > 0) {
      carryOverDeducted = Math.min(amount, currentCarryOver);
      const remaining = amount - carryOverDeducted;
      if (remaining > 0) {
        basePlanDeducted = remaining;
      }
    } else {
      basePlanDeducted = amount;
    }
    const newCarryOver = currentCarryOver - carryOverDeducted;
    const newBasePlan = currentBasePlan - basePlanDeducted;
    console.log(`\u{1F4B3} Credit deduction for user ${userId}:`);
    console.log(`  Amount: ${amount}`);
    console.log(`  From carry-over: ${carryOverDeducted}`);
    console.log(`  From base plan: ${basePlanDeducted}`);
    console.log(`  New carry-over: ${newCarryOver}`);
    console.log(`  New base plan: ${newBasePlan}`);
    await prisma.$transaction([
      // Deduct credits with smart allocation
      prisma.user.update({
        where: { id: userId },
        data: {
          creditBalance: { decrement: amount },
          carryOverCredits: newCarryOver,
          basePlanCredits: newBasePlan,
          lifetimeCreditsUsed: { increment: amount },
          monthlyCreditsUsed: { increment: amount }
        }
      }),
      // Log transaction with breakdown
      prisma.creditTransaction.create({
        data: {
          userId,
          amount: -amount,
          type,
          description,
          metadata: {
            ...metadata,
            carryOverDeducted,
            basePlanDeducted,
            newCarryOver,
            newBasePlan
          }
        }
      })
    ]);
    return true;
  }
  static async canAffordOperation(userId, amount) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { creditBalance: true }
    });
    if (!user) {
      return { canAfford: false, reason: "User not found" };
    }
    if (user.creditBalance < amount) {
      return {
        canAfford: false,
        reason: "Insufficient credits",
        currentBalance: user.creditBalance
      };
    }
    const balanceAfterDeduction = user.creditBalance - amount;
    if (balanceAfterDeduction < MINIMUM_CREDIT_BALANCE) {
      return {
        canAfford: false,
        reason: `Minimum balance of ${MINIMUM_CREDIT_BALANCE} credits must be maintained`,
        currentBalance: user.creditBalance,
        requiredAmount: amount,
        minimumBalance: MINIMUM_CREDIT_BALANCE
      };
    }
    return {
      canAfford: true,
      currentBalance: user.creditBalance,
      balanceAfterOperation: balanceAfterDeduction
    };
  }
  static getMinimumBalance() {
    return MINIMUM_CREDIT_BALANCE;
  }
  static async addCredits(userId, amount, type, description, metadata) {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { creditBalance: { increment: amount } }
      }),
      prisma.creditTransaction.create({
        data: {
          userId,
          amount,
          type,
          description,
          metadata
        }
      })
    ]);
  }
  static async allocateMonthlyCredits(userId, user) {
    const now = /* @__PURE__ */ new Date();
    const lastReset = user.lastCreditReset ? new Date(user.lastCreditReset) : null;
    const shouldReset = !lastReset || now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear();
    if (shouldReset && user.membershipExpiresAt && new Date(user.membershipExpiresAt) > now) {
      if (user.membershipTier === "PRO") {
        const defaultProCredits = 400;
        await this.addCredits(
          userId,
          defaultProCredits,
          "MONTHLY_ALLOCATION",
          `Monthly Pro credit allocation (${defaultProCredits} credits)`
        );
        await prisma.user.update({
          where: { id: userId },
          data: {
            lastCreditReset: now,
            monthlyCreditsUsed: 0
            // Reset monthly usage
          }
        });
      }
    }
  }
};

// src/services/complexity-analyzer.ts
init_esm_shims();
import { generateObject } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z as z5 } from "zod";
var openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY
});
var complexitySchema = z5.object({
  complexity: z5.number().min(0).max(10).describe("Complexity score from 0-10 based on task difficulty"),
  description: z5.string().describe("Brief description of what type of task this is"),
  category: z5.enum(["simple", "moderate", "complex", "advanced"]).describe("Task complexity category"),
  factors: z5.array(z5.string()).describe("List of factors that contribute to the complexity"),
  reasoning: z5.string().describe("Explanation of why this complexity score was assigned"),
  isBackendTask: z5.boolean().describe(
    "True if the task involves backend work like database operations, authentication, API endpoints, Convex functions, schema changes, server-side logic, Stripe/payment integration, or AI/LLM integration. False for pure frontend/UI tasks."
  ),
  recommendedTemplate: z5.enum([
    "database-vite-template",
    "database-vite-todo-template",
    "database-vite-landing-page-template",
    "database-vite-tracker-template",
    "database-vite-calculator-template",
    "tanstack-template",
    "tanstack-todo-template",
    "tanstack-landing-page-template",
    "tanstack-tracker-template",
    "tanstack-calculator-template",
    "tanstack-content-sharing-template"
  ]).optional().describe(
    "Recommended template/snapshot based on task type. Use tanstack-* templates for modern TanStack Start apps with Convex backend. Use database-vite-* templates for Vite apps with Turso database."
  )
});
async function analyzePromptComplexity(prompt, userId, traceId, projectId, projectName, isFirstMessage) {
  const postHog = getPostHogCapture();
  const startTime = Date.now();
  const spanId = generateSpanId();
  try {
    const response = await generateObject({
      model: openrouter("google/gemini-3-flash-preview", {
        extraBody: {
          usage: {
            include: true
          },
          user: userId || "anonymous"
        }
      }),
      schema: complexitySchema,
      experimental_telemetry: {
        isEnabled: true
      },
      prompt: `Analyze the complexity of this coding task and determine appropriate credit cost and template:
${projectName ? `
Project: "${projectName}"
` : ""}
Task: "${prompt}"

Consider these examples for reference:
- "Make the button gray" = Simple (1.00 credits) - basic styling changes
- "Remove the footer" = Simple (1.20 credits) - component removal
- "Add authentication" = Moderate (1.50 credits) - system integration
- "Build a landing page with images" = Complex (2.00 credits) - full page creation

Rate the complexity (0-10 scale) considering:
- Simple tasks (0-2): Basic styling, text changes, simple component modifications
- Moderate tasks (3-5): Component creation, basic functionality, simple integrations
- Complex tasks (6-8): Full pages, system integrations, advanced components
- Advanced tasks (9-10): Complete applications, complex algorithms, multiple system integration

Provide specific factors that contribute to the complexity.

TEMPLATE SELECTION:
Choose the most appropriate template based on the task. TanStack templates are preferred for modern apps with Convex backend:

TanStack Templates (Modern - TanStack Start + Convex backend):
- Use "tanstack-template" (PREFERRED DEFAULT) for general applications, dashboards, SaaS apps
- Use "tanstack-todo-template" for todo lists, task management, checklists
- Use "tanstack-landing-page-template" for marketing pages, landing pages
- Use "tanstack-tracker-template" for tracking applications (habits, expenses, time, etc.)
- Use "tanstack-calculator-template" for calculator applications
- Use "tanstack-content-sharing-template" for content sharing, social features, file sharing

Legacy Vite Templates (Vite + Turso database):
- Use "database-vite-template" for legacy Vite applications
- Use "database-vite-todo-template" for legacy todo apps
- Use "database-vite-tracker-template" for legacy tracker apps
- Use "database-vite-calculator-template" for legacy calculator apps
- Use "database-vite-landing-page-template" for legacy landing pages

IMPORTANT:
- If the task is unclear, empty, or no specific task is provided, assign a complexity of at least 1 (never 0) and categorize as "simple"
- Always provide a meaningful description even for unclear tasks
- Never assign a complexity of 0 - the minimum should be 1 for any interaction
- For template selection, default to "tanstack-template" (the modern TanStack template) unless there's a specific reason to use a different template`
    });
    const { object, usage, providerMetadata } = response;
    const latency = (Date.now() - startTime) / 1e3;
    const openRouterCost = providerMetadata?.openrouter?.usage?.cost || 0;
    console.log("[ComplexityAnalyzer] Provider metadata:", providerMetadata);
    console.log("[ComplexityAnalyzer] OpenRouter cost:", openRouterCost);
    if (userId && traceId) {
      try {
        await postHog.captureAIGeneration({
          distinct_id: userId,
          $ai_trace_id: traceId,
          $ai_span_id: spanId,
          $ai_span_name: "complexity_analysis",
          $ai_model: "google/gemini-3-flash-preview",
          $ai_provider: "openrouter",
          $ai_input: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Analyze complexity: ${prompt}`
                }
              ]
            }
          ],
          $ai_output_choices: [
            {
              role: "assistant",
              content: [
                {
                  type: "text",
                  text: JSON.stringify(object)
                }
              ]
            }
          ],
          $ai_input_tokens: usage?.inputTokens || 0,
          $ai_output_tokens: usage?.outputTokens || 0,
          $ai_total_cost_usd: openRouterCost,
          $ai_latency: latency,
          $ai_http_status: 200,
          $ai_base_url: "https://openrouter.ai/api/v1",
          $ai_request_url: "https://openrouter.ai/api/v1/chat/completions",
          $ai_is_error: false,
          $ai_temperature: 0.7,
          // Custom properties
          complexity: object.complexity,
          category: object.category,
          feature: "complexity-analysis",
          openRouterGenerationId: response.id,
          ...projectId && { projectId },
          ...projectName && { projectName },
          ...getEnvironmentProperties()
        });
      } catch (trackingError) {
        console.error(
          "[PostHog] Failed to track complexity analysis generation:",
          trackingError
        );
      }
    }
    let creditCost;
    const normalizedPrompt = prompt?.trim() || "";
    if (isFirstMessage) {
      creditCost = 4;
      if (object.complexity <= 0 || normalizedPrompt.length < 3 || object.description?.toLowerCase().includes("did not provide") || object.description?.toLowerCase().includes("no task") || object.factors?.some((f) => f.toLowerCase().includes("no task"))) {
        object.complexity = Math.max(1, object.complexity);
        object.description = object.description?.includes("did not provide") ? "Initial project setup" : object.description || "Basic project initialization";
        if (!object.factors.some((f) => f.includes("Initial"))) {
          object.factors.push("Initial build - standard cost applied");
        }
      }
    } else {
      if (object.complexity <= 0 || normalizedPrompt.length < 3 || object.description?.toLowerCase().includes("did not provide") || object.description?.toLowerCase().includes("no task") || object.factors?.some((f) => f.toLowerCase().includes("no task"))) {
        creditCost = 1.5;
        object.complexity = Math.max(1, object.complexity);
        object.description = object.description?.includes("did not provide") ? "General assistance request" : object.description || "Basic task";
        if (!object.factors.some((f) => f.includes("Minimum"))) {
          object.factors.push(
            "Minimum follow-up cost applied for unclear or minimal task"
          );
        }
      } else if (object.complexity <= 2) {
        creditCost = 1.5;
      } else if (object.complexity <= 3) {
        creditCost = 2;
      } else if (object.complexity <= 4) {
        creditCost = 3;
      } else if (object.complexity <= 5) {
        creditCost = 5;
      } else if (object.complexity <= 6) {
        creditCost = 8;
      } else if (object.complexity <= 7) {
        creditCost = 10;
      } else if (object.complexity <= 8) {
        creditCost = 12;
      } else {
        creditCost = 15;
      }
      creditCost = Math.max(1.5, creditCost);
    }
    let finalCreditCost = creditCost;
    let adjustedForMinimumBalance = false;
    let originalCreditCost;
    if (userId) {
      const affordabilityCheck = await CreditManager.canAffordOperation(
        userId,
        creditCost
      );
      if (!affordabilityCheck.canAfford && affordabilityCheck.reason?.includes("Minimum balance")) {
        const currentBalance = affordabilityCheck.currentBalance || 0;
        const minimumBalance = CreditManager.getMinimumBalance();
        const maxAffordable = Math.max(0, currentBalance - minimumBalance);
        if (maxAffordable > 0) {
          originalCreditCost = creditCost;
          finalCreditCost = Math.round(maxAffordable * 100) / 100;
          adjustedForMinimumBalance = true;
          object.factors.push(
            `Credit cost adjusted from ${originalCreditCost} to ${finalCreditCost} due to minimum balance requirement`
          );
        }
      }
    }
    console.log("[ComplexityAnalyzer] Cost from OpenRouter:");
    console.log("  - Input tokens:", usage?.inputTokens);
    console.log("  - Output tokens:", usage?.outputTokens);
    console.log("  - Reasoning tokens:", usage?.reasoningTokens);
    console.log("  - Actual cost from provider:", openRouterCost);
    console.log("  - Provider metadata:", JSON.stringify(providerMetadata));
    let recommendedSteps;
    switch (object.category) {
      case "simple":
        recommendedSteps = 30;
        break;
      case "moderate":
        recommendedSteps = 30;
        break;
      case "complex":
        recommendedSteps = 30;
        break;
      case "advanced":
        recommendedSteps = 30;
        break;
      default:
        recommendedSteps = 30;
    }
    return {
      complexity: Math.round(object.complexity * 10) / 10,
      description: object.description,
      creditCost: finalCreditCost,
      category: object.category,
      factors: object.factors,
      adjustedForMinimumBalance,
      originalCreditCost,
      recommendedTemplate: object.recommendedTemplate || "tanstack-template",
      // Default to modern TanStack template
      openRouterCost,
      // Return actual cost for billing calculation
      recommendedSteps,
      // Dynamic step allocation
      isBackendTask: object.isBackendTask
      // Backend tasks use Opus
    };
  } catch (error) {
    console.error("Error analyzing prompt complexity:", error);
    const latency = (Date.now() - startTime) / 1e3;
    if (userId && traceId) {
      try {
        await postHog.captureAIGeneration({
          distinct_id: userId,
          $ai_trace_id: traceId,
          $ai_span_id: spanId,
          $ai_span_name: "complexity_analysis",
          $ai_model: "google/gemini-3-flash-preview",
          $ai_provider: "openrouter",
          $ai_input: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Analyze complexity: ${prompt}`
                }
              ]
            }
          ],
          $ai_output_choices: [],
          $ai_input_tokens: 0,
          $ai_output_tokens: 0,
          $ai_latency: latency,
          $ai_http_status: 500,
          $ai_base_url: "https://openrouter.ai/api/v1",
          $ai_request_url: "https://openrouter.ai/api/v1/chat/completions",
          $ai_is_error: true,
          $ai_error: error instanceof Error ? error.message : String(error),
          // Custom properties
          feature: "complexity-analysis",
          ...projectId && { projectId },
          ...projectName && { projectName },
          ...getEnvironmentProperties()
        });
      } catch (trackingError) {
        console.error(
          "[PostHog] Failed to track complexity analysis error:",
          trackingError
        );
      }
    }
    let fallbackCost = isFirstMessage ? 4 : 1.5;
    let adjustedForMinimumBalance = false;
    let originalCreditCost;
    if (userId) {
      try {
        const affordabilityCheck = await CreditManager.canAffordOperation(
          userId,
          fallbackCost
        );
        if (!affordabilityCheck.canAfford && affordabilityCheck.reason?.includes("Minimum balance")) {
          const currentBalance = affordabilityCheck.currentBalance || 0;
          const minimumBalance = CreditManager.getMinimumBalance();
          const maxAffordable = Math.max(0, currentBalance - minimumBalance);
          if (maxAffordable > 0) {
            originalCreditCost = fallbackCost;
            fallbackCost = Math.round(maxAffordable * 100) / 100;
            adjustedForMinimumBalance = true;
          }
        }
      } catch (creditCheckError) {
        console.error("Error checking credits in fallback:", creditCheckError);
      }
    }
    return {
      complexity: 1,
      // Ensure minimum complexity of 1
      description: isFirstMessage ? "Initial project setup (fallback analysis)" : "Basic task (fallback analysis)",
      creditCost: Math.max(isFirstMessage ? 4 : 1.5, fallbackCost),
      // Ensure minimum cost based on message type
      category: "simple",
      factors: [
        "Fallback analysis due to AI error",
        isFirstMessage ? "Initial build - standard cost applied" : "Minimum follow-up cost applied"
      ],
      adjustedForMinimumBalance,
      originalCreditCost,
      recommendedTemplate: "tanstack-template",
      // Default to modern TanStack template for fallback
      openRouterCost: 0,
      // No cost data available in fallback
      recommendedSteps: 12
      // Default to simple task steps in fallback
    };
  }
}

// src/services/context-manager.ts
init_esm_shims();
var DEFAULT_CONTEXT_LIMITS = {
  maxMessageLength: 8e3,
  // Max chars per message
  maxContextMessages: 15,
  // Max messages to keep in context
  maxFragmentFileSize: 1e4,
  // Max chars per fragment file
  maxTotalFragmentSize: 5e4,
  // Max total fragment content
  maxResponseLength: 15e3
  // Max response length
};
var ContextManager = class {
  constructor(limits = DEFAULT_CONTEXT_LIMITS) {
    this.limits = limits;
  }
  /**
   * Truncate a message if it exceeds limits
   */
  truncateMessage(content) {
    if (content.length <= this.limits.maxMessageLength) {
      return content;
    }
    const truncated = content.substring(0, this.limits.maxMessageLength - 100);
    return `${truncated}...

[Message truncated - ${content.length - truncated.length} characters omitted]`;
  }
  /**
   * Extract text content from UIMessage safely
   */
  getMessageContent(message) {
    const parts = message.parts;
    if (Array.isArray(parts)) {
      return parts.filter((item) => item.type === "text").map((item) => item.text).join(" ");
    }
    const content = message.content;
    if (typeof content === "string") {
      return content;
    } else if (Array.isArray(content)) {
      return content.filter((item) => item.type === "text").map((item) => item.text).join(" ");
    }
    return JSON.stringify(content || "");
  }
  /**
   * Prune conversation to keep only the most recent messages
   */
  pruneConversation(messages) {
    if (messages.length <= this.limits.maxContextMessages) {
      return messages;
    }
    const firstMessage = messages[0];
    const recentMessages = messages.slice(-this.limits.maxContextMessages + 1);
    if (firstMessage?.role === "system" || firstMessage?.role === "assistant" && messages.length > this.limits.maxContextMessages) {
      return [firstMessage, ...recentMessages];
    }
    return recentMessages;
  }
  /**
   * Optimize fragment files for context
   */
  optimizeFragmentFiles(files) {
    const optimized = {};
    let totalSize = 0;
    const fileEntries = Object.entries(files).sort(([pathA], [pathB]) => {
      const importanceA = this.getFileImportance(pathA);
      const importanceB = this.getFileImportance(pathB);
      return importanceB - importanceA;
    });
    for (const [path3, content] of fileEntries) {
      if (totalSize >= this.limits.maxTotalFragmentSize) {
        console.log(
          `[ContextManager] Fragment size limit reached, omitting ${Object.keys(files).length - Object.keys(optimized).length} files`
        );
        break;
      }
      let optimizedContent = content;
      if (content.length > this.limits.maxFragmentFileSize) {
        optimizedContent = this.truncateFile(path3, content);
      }
      optimized[path3] = optimizedContent;
      totalSize += optimizedContent.length;
    }
    return optimized;
  }
  /**
   * Get file importance score for prioritization
   */
  getFileImportance(path3) {
    const filename = path3.toLowerCase();
    if (filename.includes("app.tsx") || filename.includes("app.jsx"))
      return 100;
    if (filename.includes("main.tsx") || filename.includes("main.jsx"))
      return 90;
    if (filename.includes("index.html")) return 85;
    if (filename.includes("package.json")) return 80;
    if (filename.includes("component")) return 60;
    if (filename.endsWith(".tsx") || filename.endsWith(".jsx")) return 50;
    if (filename.endsWith(".ts") || filename.endsWith(".js")) return 40;
    if (filename.endsWith(".css") || filename.endsWith(".scss")) return 30;
    if (filename.includes("test") || filename.includes("spec")) return 10;
    if (filename.includes(".d.ts")) return 5;
    return 20;
  }
  /**
   * Truncate file content intelligently
   */
  truncateFile(path3, content) {
    const maxSize = this.limits.maxFragmentFileSize;
    if (content.length <= maxSize) {
      return content;
    }
    if (path3.endsWith(".json")) {
      return this.truncateJSON(content, maxSize);
    } else if (path3.endsWith(".tsx") || path3.endsWith(".jsx") || path3.endsWith(".ts") || path3.endsWith(".js")) {
      return this.truncateCode(content, maxSize);
    } else {
      const truncated = content.substring(0, maxSize - 200);
      return `${truncated}

/* File truncated - ${content.length - truncated.length} characters omitted */`;
    }
  }
  /**
   * Truncate JSON while trying to keep structure
   */
  truncateJSON(content, maxSize) {
    try {
      const parsed = JSON.parse(content);
      const truncated = JSON.stringify(parsed, null, 2).substring(
        0,
        maxSize - 100
      );
      return `${truncated}
/* JSON truncated */`;
    } catch {
      return content.substring(0, maxSize - 100) + "\n/* Invalid JSON truncated */";
    }
  }
  /**
   * Truncate code while preserving imports and key functions
   */
  truncateCode(content, maxSize) {
    const lines = content.split("\n");
    const importLines = lines.filter(
      (line) => line.trim().startsWith("import")
    );
    const exportLines = lines.filter(
      (line) => line.trim().startsWith("export")
    );
    const headerFooterSize = [...importLines, ...exportLines].join("\n").length;
    const availableSize = maxSize - headerFooterSize - 200;
    if (availableSize > 0) {
      const otherLines = lines.filter(
        (line) => !line.trim().startsWith("import") && !line.trim().startsWith("export")
      );
      const truncatedContent = otherLines.join("\n").substring(0, availableSize);
      return [
        ...importLines,
        "",
        truncatedContent,
        "",
        "/* Code truncated */",
        "",
        ...exportLines.slice(0, 3)
        // Keep some key exports
      ].join("\n");
    }
    return content.substring(0, maxSize - 100) + "\n/* Code truncated */";
  }
  /**
   * Chunk response if too large
   */
  chunkResponse(content) {
    if (content.length <= this.limits.maxResponseLength) {
      return [content];
    }
    const chunks = [];
    let currentChunk = "";
    const lines = content.split("\n");
    for (const line of lines) {
      if (currentChunk.length + line.length + 1 > this.limits.maxResponseLength) {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
          currentChunk = line;
        } else {
          chunks.push(
            line.substring(0, this.limits.maxResponseLength - 50) + "..."
          );
          currentChunk = line.substring(this.limits.maxResponseLength - 50);
        }
      } else {
        currentChunk += (currentChunk ? "\n" : "") + line;
      }
    }
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    return chunks;
  }
  /**
   * Get context summary for debugging
   */
  getContextSummary(messages, fragmentFiles) {
    const totalMessageChars = messages.reduce(
      (sum, msg) => sum + this.getMessageContent(msg).length,
      0
    );
    const totalFragmentChars = Object.values(fragmentFiles).reduce(
      (sum, content) => sum + content.length,
      0
    );
    return {
      messageCount: messages.length,
      totalMessageChars,
      fragmentFileCount: Object.keys(fragmentFiles).length,
      totalFragmentChars,
      limits: this.limits,
      withinLimits: {
        messages: messages.length <= this.limits.maxContextMessages,
        messageSize: totalMessageChars <= this.limits.maxMessageLength * messages.length,
        fragmentSize: totalFragmentChars <= this.limits.maxTotalFragmentSize
      }
    };
  }
};

// src/routes/chat.ts
import throttle from "throttleit";
import { createResumableStreamContext } from "resumable-stream/ioredis";
import { Redis } from "ioredis";

// src/services/chat-abort-registory.ts
init_esm_shims();
var STALE_CONTROLLER_TIMEOUT = 30 * 60 * 1e3;
var MAX_CONTROLLERS_WARNING = 100;
function getChatAbortRegistry() {
  if (!globalThis.__chat_abort_registry__) {
    globalThis.__chat_abort_registry__ = {
      controllers: /* @__PURE__ */ new Map(),
      timestamps: /* @__PURE__ */ new Map()
    };
  }
  return globalThis.__chat_abort_registry__;
}
function registerChatAbort(streamId, controller) {
  const registry = getChatAbortRegistry();
  registry.controllers.set(streamId, controller);
  registry.timestamps.set(streamId, Date.now());
  if (registry.controllers.size > MAX_CONTROLLERS_WARNING) {
    logger?.warn({
      msg: "Chat abort registry has grown large",
      size: registry.controllers.size,
      hint: "Check for memory leaks or stuck streams"
    });
  }
}
function abortChat(streamId) {
  const registry = getChatAbortRegistry();
  const ctrl = registry.controllers.get(streamId);
  if (!ctrl) return false;
  registry.controllers.delete(streamId);
  registry.timestamps.delete(streamId);
  try {
    ctrl.abort();
    return true;
  } catch (error) {
    logger?.warn({
      msg: "Failed to abort chat stream",
      streamId,
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
}
function clearChatAbort(streamId) {
  const registry = getChatAbortRegistry();
  registry.controllers.delete(streamId);
  registry.timestamps.delete(streamId);
}
async function safeClearActiveStream(projectId) {
  try {
    await prisma.project.update({
      where: { id: projectId },
      data: { activeStreamId: null, activeStreamStartedAt: null }
    });
  } catch (error) {
    logger?.warn({
      msg: "Failed to clear active stream",
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
function safeClearAbort(streamId) {
  try {
    clearChatAbort(streamId);
  } catch (error) {
    logger?.warn({
      msg: "Failed to clear abort signal",
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
async function finalizeOnAbort(projectId, streamId, toolsContext) {
  if (toolsContext?.fragmentFiles && toolsContext.fragmentFiles.size > 0) {
    try {
      logger?.info({
        msg: "Saving in-progress fragment files before abort",
        fileCount: toolsContext.fragmentFiles.size,
        fragmentId: toolsContext.currentFragmentId
      });
      const { updateWorkingFragment } = await import("./ai-tools-NDMU66BM.js");
      await updateWorkingFragment(toolsContext, "aborted - saving progress");
      logger?.info({
        msg: "Fragment files saved successfully on abort",
        fragmentId: toolsContext.currentFragmentId
      });
    } catch (error) {
      logger?.error({
        msg: "Failed to save fragment on abort",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  await safeClearActiveStream(projectId);
  safeClearAbort(streamId);
}
async function finalizeOnFinish(projectId, streamId) {
  await safeClearActiveStream(projectId);
  safeClearAbort(streamId);
  try {
    await redisFileStreamPublisher.emitStreamComplete(projectId);
  } catch (error) {
    logger?.warn({
      msg: "Failed to emit stream complete signal",
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

// src/utils/prompt-caching.ts
init_esm_shims();
function estimateTokens(content) {
  const text = typeof content === "string" ? content : JSON.stringify(content);
  return Math.ceil(text.length / 4);
}
var ANTHROPIC_CACHE_CONTROL = {
  anthropic: {
    cacheControl: { type: "ephemeral" }
  }
};
function addCacheControlToMessage(message) {
  if (!message) return;
  if (Array.isArray(message.content) && message.content.length > 0) {
    const lastContent = message.content[message.content.length - 1];
    if (lastContent && typeof lastContent === "object") {
      lastContent.providerOptions = {
        ...lastContent.providerOptions,
        ...ANTHROPIC_CACHE_CONTROL
      };
      return;
    }
  }
  message.providerOptions = {
    ...message.providerOptions,
    ...ANTHROPIC_CACHE_CONTROL
  };
}
function applyMessageCaching(messages, options = {}) {
  const { logger: logger3, currentStep = 1 } = options;
  const messageCount = messages.length;
  const stats = {
    breakpointsApplied: 0,
    breakpointIndices: [],
    estimatedTokens: 0,
    messageCount
  };
  if (messageCount < 2) {
    return stats;
  }
  let firstUserIndex = -1;
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role === "user") {
      firstUserIndex = i;
      break;
    }
  }
  if (firstUserIndex >= 0 && !messages[firstUserIndex].providerOptions?.anthropic?.cacheControl) {
    addCacheControlToMessage(messages[firstUserIndex]);
    stats.breakpointsApplied++;
    stats.breakpointIndices.push(firstUserIndex);
    logger3?.debug({
      msg: "Cache breakpoint added on first user message",
      targetIndex: firstUserIndex,
      currentStep
    });
  }
  const CACHE_STEPS = [7, 14];
  const lastCacheableIndex = messageCount - 2;
  if (lastCacheableIndex < 0) {
    return stats;
  }
  let existingBreakpoints = 0;
  for (const msg of messages) {
    if (msg.providerOptions?.anthropic?.cacheControl && msg.role !== "system") {
      existingBreakpoints++;
    }
  }
  for (const cacheStep of CACHE_STEPS) {
    if (existingBreakpoints >= 4) break;
    if (currentStep === cacheStep) {
      const targetIndex = lastCacheableIndex;
      if (targetIndex > firstUserIndex && messages[targetIndex]) {
        addCacheControlToMessage(messages[targetIndex]);
        stats.breakpointsApplied++;
        stats.breakpointIndices.push(targetIndex);
        existingBreakpoints++;
        logger3?.info({
          msg: `Cache breakpoint added at step ${cacheStep}`,
          targetIndex,
          currentStep,
          messageCount
        });
      }
    }
  }
  stats.estimatedTokens = messages.reduce(
    (sum, msg) => sum + estimateTokens(msg.content),
    0
  );
  if (stats.breakpointsApplied > 0) {
    logger3?.info({
      msg: "Prompt caching configured",
      breakpointsApplied: stats.breakpointsApplied,
      breakpointIndices: stats.breakpointIndices,
      estimatedTokens: stats.estimatedTokens,
      messageCount: stats.messageCount,
      currentStep
    });
  }
  return stats;
}
function createCachedSystemPrompt(staticPrompt, dynamicContext) {
  return [
    {
      role: "system",
      content: staticPrompt,
      providerOptions: ANTHROPIC_CACHE_CONTROL
    },
    {
      role: "system",
      content: dynamicContext
    }
  ];
}
function createCachedSystemPromptWithImage(staticPrompt, dynamicContext, imageUrl) {
  let imageSource = {
    type: "url",
    url: imageUrl
  };
  if (imageUrl.startsWith("data:")) {
    const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      const [, mediaType, data] = match;
      imageSource = {
        type: "base64",
        media_type: mediaType,
        data
      };
    }
  }
  return [
    {
      role: "system",
      content: staticPrompt,
      providerOptions: ANTHROPIC_CACHE_CONTROL
    },
    {
      role: "system",
      content: [
        {
          type: "image",
          source: imageSource
        }
      ],
      providerOptions: ANTHROPIC_CACHE_CONTROL
      // Cache this image!
    },
    {
      role: "system",
      content: `

Styling Reference (Inspiration-Only):
The image above is a visual reference, NOT a template to copy.
Use it only for high-level inspiration \u2014 mood, color palette, tone, density, and overall vibe.

CRITICAL RULES:
- The user's written request is PRIMARY. The content, information architecture, and feature set MUST be driven by what the user describes.
- Do NOT clone or closely replicate the layout, structure, navigation, or specific UI components from the reference image.
- Support ANY experience type the user asks for (e.g. marketing site, SaaS app, dashboard, portfolio, landing page, internal tool, etc.).
- Apply the reference image ONLY as a loose visual direction layered on top of the user's requirements.
- Only mirror specific layouts or patterns from the reference if the user explicitly asks for that.

${dynamicContext}`
    }
  ];
}
function extractCacheMetrics(providerMetadata) {
  const metadata = providerMetadata;
  const anthropicMeta = metadata?.anthropic;
  const anthropicUsage = anthropicMeta?.usage;
  const cacheCreationTokens = anthropicUsage?.cache_creation_input_tokens || anthropicMeta?.cacheCreationInputTokens || 0;
  const cacheReadTokens = anthropicUsage?.cache_read_input_tokens || anthropicMeta?.cacheReadInputTokens || 0;
  const inputTokens = anthropicUsage?.input_tokens || metadata?.usage?.promptTokens || 1;
  const totalTokens = inputTokens + cacheReadTokens + cacheCreationTokens;
  const costWithoutCache = totalTokens * 1;
  const costWithCache = inputTokens * 1 + cacheReadTokens * 0.1 + cacheCreationTokens * 1.25;
  const cacheSavingsPercent = costWithoutCache > 0 ? Math.round(
    (costWithoutCache - costWithCache) / costWithoutCache * 100
  ) : 0;
  const cacheCreationCostPercent = totalTokens > 0 ? Math.round(cacheCreationTokens * 0.25 / totalTokens * 100) : 0;
  return {
    cacheCreationTokens,
    cacheReadTokens,
    cacheSavingsPercent,
    cacheCreationCostPercent,
    inputTokens
  };
}

// src/routes/chat.ts
import { ConvexDeploymentAPI, decryptDeployKey as decryptDeployKey2 } from "@shipper/convex";
var anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});
var MODEL_OPUS = "claude-opus-4-5";
var MODEL_SONNET = "claude-sonnet-4-5";
var MODEL_HAIKU = "claude-haiku-4-5";
var DEV_MODEL = "claude-haiku-4-5";
var ANTHROPIC_PRICING_OPUS = {
  inputPerMillion: 5,
  outputPerMillion: 25,
  cacheWritePerMillion: 6.25,
  // 1.25x input price
  cacheReadPerMillion: 0.5
  // 0.1x input price
};
var ANTHROPIC_PRICING_SONNET = {
  inputPerMillion: 3,
  outputPerMillion: 15,
  cacheWritePerMillion: 3.75,
  cacheReadPerMillion: 0.3
};
var ANTHROPIC_PRICING_HAIKU = {
  inputPerMillion: 1,
  outputPerMillion: 5,
  cacheWritePerMillion: 1.25,
  cacheReadPerMillion: 0.1
};
function calculateAnthropicCost(usage, pricing = ANTHROPIC_PRICING_HAIKU) {
  const inputTokens = usage.inputTokens || 0;
  const outputTokens = usage.outputTokens || 0;
  const cacheWriteTokens = usage.cacheCreationInputTokens || 0;
  const cacheReadTokens = usage.cacheReadInputTokens || 0;
  const inputCost = inputTokens / 1e6 * pricing.inputPerMillion;
  const outputCost = outputTokens / 1e6 * pricing.outputPerMillion;
  const cacheWriteCost = cacheWriteTokens / 1e6 * pricing.cacheWritePerMillion;
  const cacheReadCost = cacheReadTokens / 1e6 * pricing.cacheReadPerMillion;
  return inputCost + outputCost + cacheWriteCost + cacheReadCost;
}
var ABSOLUTE_MAX_STEPS = 30;
var HARD_BUDGET_LIMIT_USD = 3;
function getMaxSteps(complexityAnalysis) {
  return complexityAnalysis?.recommendedSteps ? Math.min(complexityAnalysis.recommendedSteps, ABSOLUTE_MAX_STEPS) : ABSOLUTE_MAX_STEPS;
}
var redisPublisher = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  retryStrategy: (times) => Math.min(times * 50, 2e3),
  // Performance optimizations
  enableOfflineQueue: true,
  // Queue commands when disconnected
  lazyConnect: false,
  // Connect immediately
  keepAlive: 3e4,
  // Keep connection alive
  // Reduce latency with pipelining
  enableAutoPipelining: true,
  autoPipeliningIgnoredCommands: ["ping"]
}) : null;
var redisSubscriber = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  retryStrategy: (times) => Math.min(times * 50, 2e3),
  // Performance optimizations
  enableOfflineQueue: true,
  lazyConnect: false,
  keepAlive: 3e4
}) : null;
if (redisPublisher && redisSubscriber) {
  redisPublisher.on("connect", () => {
    console.log("[Redis] Publisher connected");
  });
  redisPublisher.on("error", (error) => {
    console.error("[Redis] Publisher error:", error);
  });
  redisSubscriber.on("connect", () => {
    console.log("[Redis] Subscriber connected");
  });
  redisSubscriber.on("error", (error) => {
    console.error("[Redis] Subscriber error:", error);
  });
}
var router5 = Router5();
var chatRequestSchema = z6.object({
  message: z6.object({
    id: z6.string().optional(),
    role: z6.enum(["user", "assistant"]),
    parts: z6.array(z6.any()),
    // AI SDK UIMessage format uses parts array
    // createdAt can be a Date object from AI SDK or string, we don't use it so just accept any
    createdAt: z6.union([z6.string(), z6.date(), z6.any()]).optional()
  }),
  projectId: z6.string().uuid()
});
function deslugifyProjectName(slug) {
  return slug.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}
function getMessageContent(message) {
  return message.parts.filter((part) => part.type === "text").map((part) => part.text).join("\n");
}
async function extractStylingImageUrl(message, prunedMessages, logger3) {
  const checkMessageForStylingImage = async (msg) => {
    if (!Array.isArray(msg.parts)) {
      return null;
    }
    const imagePart = msg.parts.find(
      (part) => part.type === "file" && part.url?.startsWith("/") && (part.mediaType?.startsWith("image/") || part.mimeType?.startsWith("image/"))
    );
    if (imagePart) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://staging.shipper.now";
      const absoluteUrl = `${baseUrl}${imagePart.url}`;
      try {
        const response = await fetch(absoluteUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");
        const mimeType = imagePart.mediaType || imagePart.mimeType || "image/png";
        const dataUri = `data:${mimeType};base64,${base64}`;
        console.log("dataUri", dataUri);
        console.log("absoluteUrl", absoluteUrl);
        return dataUri;
      } catch (error) {
        logger3?.warn({
          msg: "Failed to convert preset styling image to base64, skipping styling image",
          url: absoluteUrl,
          error: error instanceof Error ? error.message : String(error)
        });
        return null;
      }
    }
    return null;
  };
  const currentMessageImage = await checkMessageForStylingImage(message);
  if (currentMessageImage) {
    return currentMessageImage;
  }
  if (prunedMessages && prunedMessages.length > 0) {
    for (let i = prunedMessages.length - 1; i >= 0; i--) {
      const msg = prunedMessages[i];
      if (msg.role === "user") {
        const historyImage = await checkMessageForStylingImage(msg);
        if (historyImage) {
          logger3?.info({
            msg: "Found styling image in conversation history",
            messageId: msg.id,
            imageUrl: historyImage
          });
          return historyImage;
        }
        break;
      }
    }
  }
  logger3?.debug({
    msg: "No styling preset image found in message or conversation history",
    messagePartsCount: Array.isArray(message.parts) ? message.parts.length : 0,
    conversationLength: prunedMessages?.length || 0
  });
  return null;
}
async function analyzeDocumentsWithAnthropic(documentParts, userPrompt, logger3) {
  try {
    const contentParts = [
      {
        type: "text",
        text: `You are a document analysis assistant. The user has uploaded one or more documents for you to analyze.

IMPORTANT: Your ONLY task is to analyze the document(s) provided below. Do NOT ask the user what they want to build. Do NOT respond with generic prompts about building apps. ONLY analyze the document content.

User's request: ${userPrompt}

Analyze the document(s) and provide a COMPREHENSIVE and DETAILED analysis that includes:

1. **Document Overview**: Type of document, purpose, and main subject
2. **Key Information**: Extract all important data, numbers, dates, names, and facts
3. **Structure & Sections**: Outline the document's organization and main sections
4. **Detailed Content**: Summarize each major section thoroughly
5. **Tables & Data**: Extract and format any tables, lists, or structured data
6. **Important Details**: Highlight critical information, deadlines, amounts, or requirements
7. **Context**: Explain the significance and implications of the content

Be thorough and detailed. Extract as much useful information as possible from the document(s) below.`
      }
    ];
    logger3?.info({
      msg: "Processing document parts for analysis",
      documentCount: documentParts.length,
      parts: documentParts.map((p) => ({
        type: p.type,
        name: p.name,
        mediaType: p.mediaType,
        hasUrl: !!p.url,
        urlPreview: p.url?.substring(0, 50)
      }))
    });
    for (const part of documentParts) {
      if (part.mediaType?.startsWith("image/")) {
        continue;
      }
      const fileName = part.name?.toLowerCase() || "";
      const isPDF = fileName.endsWith(".pdf") || part.mediaType === "application/pdf";
      const isDOCX = fileName.endsWith(".docx") || part.mediaType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      logger3?.info({
        msg: "Checking document part",
        isPDF,
        isDOCX,
        name: part.name,
        mediaType: part.mediaType,
        type: part.type
      });
      if (isPDF) {
        contentParts.push({
          type: "file",
          data: part.url,
          // URL or base64 data URI
          mediaType: "application/pdf"
        });
      } else if (isDOCX) {
        let docxText = "";
        logger3?.info({
          msg: "Starting DOCX extraction",
          fileName: part.name,
          urlType: part.url.startsWith("data:") ? "data URI" : part.url.startsWith("http") ? "HTTP URL" : "unknown",
          urlLength: part.url?.length
        });
        try {
          if (part.url.startsWith("data:")) {
            logger3?.info({ msg: "Processing DOCX from data URI" });
            const base64Match = part.url.match(/^data:[^;]+;base64,(.+)$/);
            if (base64Match) {
              logger3?.info({
                msg: "Base64 match found",
                base64Length: base64Match[1].length
              });
              const buffer = Buffer.from(base64Match[1], "base64");
              logger3?.info({
                msg: "Buffer created",
                bufferSize: buffer.length
              });
              const result2 = await mammoth.extractRawText({ buffer });
              docxText = result2.value;
              logger3?.info({
                msg: "Mammoth extraction complete",
                textLength: docxText.length,
                hasMessages: !!result2.messages?.length
              });
              if (result2.messages && result2.messages.length > 0) {
                logger3?.warn({
                  msg: "Mammoth warnings/messages",
                  messages: result2.messages
                });
              }
            } else {
              logger3?.error({ msg: "No base64 match found in data URI" });
            }
          } else if (part.url.startsWith("http://") || part.url.startsWith("https://")) {
            logger3?.info({ msg: "Fetching DOCX from URL", url: part.url });
            const response = await fetch(part.url);
            logger3?.info({
              msg: "Fetch response received",
              status: response.status,
              ok: response.ok,
              contentType: response.headers.get("content-type")
            });
            const arrayBuffer = await response.arrayBuffer();
            logger3?.info({
              msg: "ArrayBuffer received",
              size: arrayBuffer.byteLength
            });
            const buffer = Buffer.from(arrayBuffer);
            logger3?.info({
              msg: "Buffer created from arrayBuffer",
              bufferSize: buffer.length,
              bufferStart: buffer.slice(0, 20).toString("hex"),
              // First 20 bytes in hex
              isPKZip: buffer[0] === 80 && buffer[1] === 75
              // Check for PK zip signature
            });
            const result2 = await mammoth.extractRawText({ buffer });
            docxText = result2.value;
            logger3?.info({
              msg: "Mammoth extractRawText complete",
              textLength: docxText.length,
              hasMessages: !!result2.messages?.length
            });
            if (!docxText || docxText.trim().length === 0) {
              logger3?.info({ msg: "Raw text empty, trying convertToHtml" });
              const htmlResult = await mammoth.convertToHtml({ buffer });
              logger3?.info({
                msg: "HTML conversion complete",
                htmlLength: htmlResult.value.length
              });
              docxText = htmlResult.value.replace(/<[^>]*>/g, "").trim();
              logger3?.info({
                msg: "HTML stripped to text",
                textLength: docxText.length
              });
            }
            if (result2.messages && result2.messages.length > 0) {
              logger3?.warn({
                msg: "Mammoth warnings/messages",
                messages: result2.messages
              });
            }
          } else {
            logger3?.error({
              msg: "Unknown URL format",
              url: part.url?.substring(0, 100)
            });
          }
          logger3?.info({
            msg: "DOCX extraction result",
            hasText: !!docxText,
            textLength: docxText?.length || 0,
            trimmedLength: docxText?.trim().length || 0
          });
          if (docxText && docxText.trim().length > 0) {
            const maxLength = 5e4;
            const originalLength = docxText.length;
            let truncatedText = docxText;
            let truncationNote = "";
            if (docxText.length > maxLength) {
              truncatedText = docxText.substring(0, maxLength);
              truncationNote = `

[Note: Document truncated from ${originalLength.toLocaleString()} to ${maxLength.toLocaleString()} characters]`;
              logger3?.info({
                msg: "DOCX text truncated",
                originalLength,
                truncatedLength: maxLength
              });
            }
            logger3?.info({
              msg: "Adding DOCX content to contentParts",
              textPreview: truncatedText.substring(0, 100)
            });
            contentParts.push({
              type: "text",
              text: `

---
**File: ${part.name || "document.docx"}**
\`\`\`
${truncatedText}
\`\`\`${truncationNote}
---
`
            });
          } else {
            logger3?.warn({
              msg: "DOCX extraction returned empty content",
              fileName: part.name,
              rawTextValue: docxText
            });
            contentParts.push({
              type: "text",
              text: `

---
**File: ${part.name || "document.docx"}**
[Unable to extract DOCX content - file may be empty or corrupted]
---
`
            });
          }
        } catch (error) {
          logger3?.error({
            msg: "Failed to extract DOCX text",
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : void 0,
            fileName: part.name
          });
          contentParts.push({
            type: "text",
            text: `

---
**File: ${part.name || "document.docx"}**
[Error extracting DOCX: ${error instanceof Error ? error.message : "unknown"}]
---
`
          });
        }
      } else {
        let fileContent = "";
        if (part.url.startsWith("data:")) {
          const base64Match = part.url.match(/^data:[^;]+;base64,(.+)$/);
          if (base64Match) {
            try {
              fileContent = Buffer.from(base64Match[1], "base64").toString(
                "utf-8"
              );
            } catch (error) {
              fileContent = `[Unable to decode file content: ${part.name || "unknown"}]`;
            }
          }
        } else if (part.url.startsWith("http://") || part.url.startsWith("https://")) {
          try {
            const response = await fetch(part.url);
            if (response.ok) {
              const arrayBuffer = await response.arrayBuffer();
              fileContent = Buffer.from(arrayBuffer).toString("utf-8");
            } else {
              fileContent = `[Unable to fetch file: ${response.statusText}]`;
            }
          } catch (error) {
            fileContent = `[Error fetching file: ${error instanceof Error ? error.message : "unknown"}]`;
          }
        } else {
          fileContent = `[File URL: ${part.url}]`;
        }
        const maxLength = 5e4;
        const originalLength = fileContent.length;
        let truncatedContent = fileContent;
        let truncationNote = "";
        if (fileContent.length > maxLength) {
          truncatedContent = fileContent.substring(0, maxLength);
          truncationNote = `

[Note: File truncated from ${originalLength.toLocaleString()} to ${maxLength.toLocaleString()} characters]`;
          logger3?.info({
            msg: "File content truncated",
            fileName: part.name,
            originalLength,
            truncatedLength: maxLength
          });
        }
        contentParts.push({
          type: "text",
          text: `

---
**File: ${part.name || "document"}**
\`\`\`
${truncatedContent}
\`\`\`${truncationNote}
---
`
        });
      }
    }
    const result = await generateText({
      model: anthropic("claude-haiku-4-5"),
      messages: [
        {
          role: "user",
          content: contentParts
        }
      ]
    });
    const analysis = result.text || "Unable to analyze documents";
    const inputTokens = result.usage?.inputTokens || 0;
    const outputTokens = result.usage?.outputTokens || 0;
    const inputCost = inputTokens / 1e6 * 1;
    const outputCost = outputTokens / 1e6 * 5;
    const costUSD = inputCost + outputCost;
    logger3?.info({
      msg: "Document analysis completed via Anthropic",
      documentCount: documentParts.length,
      analysisLength: analysis.length,
      inputTokens,
      outputTokens,
      costUSD: costUSD.toFixed(6)
    });
    return { analysis, costUSD };
  } catch (error) {
    logger3?.error({
      msg: "Error analyzing documents with Anthropic",
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}
router5.options("/", (_req, res) => {
  res.status(204).end();
});
router5.post(
  "/",
  validateSession,
  validateProjectAccess,
  async (req, res) => {
    const requestId = generateId();
    const startTime = Date.now();
    res.setHeader("X-Accel-Buffering", "no");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    try {
      const parsed = chatRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        req.logger?.warn({
          msg: "Invalid chat request body",
          requestId,
          error: parsed.error
        });
        const response = {
          success: false,
          error: "Invalid request body"
        };
        return res.status(400).json(response);
      }
      const { message: rawMessage, projectId } = parsed.data;
      const validationResult = await safeValidateUIMessages({
        messages: [rawMessage]
      });
      if (!validationResult.success) {
        req.logger?.warn({
          msg: "Invalid UI message format",
          requestId,
          error: validationResult.error
        });
        const response = {
          success: false,
          error: "Invalid message format"
        };
        return res.status(400).json(response);
      }
      const message = validationResult.data[0];
      req.logger?.info({
        msg: "Chat message received",
        requestId,
        messageRole: message.role
      });
      if (!req.user) {
        const response = {
          success: false,
          error: "User not authenticated"
        };
        return res.status(401).json(response);
      }
      req.logger?.info({
        msg: "Starting chat session",
        requestId,
        userId: req.user.id,
        userEmail: req.user.email
      });
      const userId = req.user.id;
      const streamId = `${projectId}:${requestId}`;
      const abortController = new AbortController();
      let aborted = false;
      abortController.signal.addEventListener("abort", () => {
        aborted = true;
      });
      const redisAvailable = !!process.env.REDIS_URL && !!redisPublisher && !!redisSubscriber;
      const streamContext = redisAvailable ? createResumableStreamContext({
        publisher: redisPublisher,
        subscriber: redisSubscriber,
        waitUntil: (promise) => {
          promise.catch((error) => {
            req.logger?.error({
              msg: "Background task error",
              error: error instanceof Error ? error.message : String(error)
            });
          });
        }
      }) : null;
      let builderAnthropicCost = 0;
      let builderInputTokens = 0;
      let builderOutputTokens = 0;
      let stepCount = 0;
      let toolsContext;
      let assistantMessageId = null;
      const accumulatedParts = [];
      const stream = createUIMessageStream({
        execute: async ({ writer }) => {
          const contextManager = new ContextManager();
          const project = await prisma.project.findFirst({
            where: { id: projectId },
            include: {
              codeImport: true
            }
          });
          if (!project) {
            throw new Error("Project not found or access denied");
          }
          const isImported = isImportedProject(project);
          const projectName = deslugifyProjectName(project.name);
          req.logger?.info({
            msg: "Working on project",
            projectName,
            streamId
          });
          await prisma.project.update({
            where: { id: projectId },
            data: {
              activeStreamId: streamId,
              activeStreamStartedAt: /* @__PURE__ */ new Date()
            }
          });
          registerChatAbort(streamId, abortController);
          let selectedTemplate = isImported ? "shipper-empty-bun-template" : "vite-database-template";
          let complexityAnalysis;
          const messageContent = getMessageContent(message);
          if (message.role === "user") {
            try {
              const truncatedContent = contextManager.truncateMessage(messageContent);
              req.logger?.info({
                msg: "User message truncated",
                originalLength: messageContent.length,
                truncatedLength: truncatedContent.length
              });
              const existingUserMessages = await prisma.v2Message.count({
                where: {
                  projectId,
                  role: "USER"
                }
              });
              const isFirstUserMessage2 = existingUserMessages === 0;
              req.logger?.info({
                msg: "Analyzing prompt complexity",
                isFirstUserMessage: isFirstUserMessage2,
                existingUserMessages
              });
              complexityAnalysis = await analyzePromptComplexity(
                truncatedContent,
                userId,
                streamId,
                projectId,
                projectName,
                isFirstUserMessage2
              );
              if (complexityAnalysis.recommendedTemplate && !isImported) {
                selectedTemplate = complexityAnalysis.recommendedTemplate;
              }
              const complexityCost = complexityAnalysis.openRouterCost || 0;
              builderAnthropicCost += complexityCost;
              req.logger?.info({
                msg: "Complexity analysis complete",
                complexity: complexityAnalysis.complexity,
                category: complexityAnalysis.category,
                analysisCostUSD: complexityCost,
                recommendedSteps: complexityAnalysis.recommendedSteps,
                cumulativeCostUSD: builderAnthropicCost,
                isBackendTask: complexityAnalysis.isBackendTask
              });
            } catch (error) {
              req.logger?.error({
                msg: "Complexity analysis failed",
                error: error instanceof Error ? error.message : "Unknown error"
              });
              throw new Error(
                "AI analysis is currently unavailable. Please try again later."
              );
            }
          }
          let documentAnalysisText = "";
          if (message.role === "user" && Array.isArray(message.parts)) {
            const documentParts = message.parts.filter((part) => {
              if (part.type !== "file") return false;
              if (part.mediaType?.startsWith("image/")) return false;
              if (part.mediaType?.startsWith("video/")) return false;
              if (part.mediaType?.startsWith("audio/")) return false;
              const archiveTypes = [
                "application/zip",
                "application/x-zip-compressed",
                "application/x-rar-compressed",
                "application/x-7z-compressed",
                "application/x-tar",
                "application/gzip",
                "application/x-bzip2"
              ];
              if (archiveTypes.includes(part.mediaType)) return false;
              const fileName = part.name?.toLowerCase() || "";
              if (fileName.match(/\.(zip|rar|7z|tar|gz|bz2|tgz)$/))
                return false;
              return true;
            });
            if (documentParts.length > 0) {
              try {
                const userPrompt = getMessageContent(message) || "Analyze this document";
                const documentResult = await analyzeDocumentsWithAnthropic(
                  documentParts,
                  userPrompt,
                  req.logger
                );
                documentAnalysisText = documentResult.analysis;
                builderAnthropicCost += documentResult.costUSD;
                req.logger?.info({
                  msg: "Document analysis complete - will be added to AI context",
                  analysisLength: documentAnalysisText.length,
                  documentAnalysisCost: documentResult.costUSD.toFixed(6),
                  cumulativeCostUSD: builderAnthropicCost,
                  provider: "Anthropic"
                });
              } catch (error) {
                req.logger?.error({
                  msg: "Failed to analyze documents - proceeding without analysis",
                  error: error instanceof Error ? error.message : String(error)
                });
              }
            }
          }
          const messageId = message.id || generateId();
          if (!Array.isArray(message.parts)) {
            req.logger?.error({
              msg: "Invalid message format - parts is not an array",
              messageId,
              partsType: typeof message.parts
            });
            throw new Error("Invalid message format");
          }
          let content = JSON.stringify(message.parts);
          if (message.role === "user") {
            const relevantParts = message.parts.filter(
              (part) => part.type === "text" || part.type === "file"
            );
            content = JSON.stringify(relevantParts);
            const imageParts = relevantParts.filter(
              (p) => p.type === "file" && p.mediaType?.startsWith("image/")
            );
            if (imageParts.length > 0) {
              req.logger?.info({
                msg: "\u{1F4BE} Saving preset images to database",
                imageCount: imageParts.length,
                images: imageParts.map((p) => ({
                  url: p.url,
                  mediaType: p.mediaType,
                  name: p.name
                }))
              });
            }
          }
          await prisma.v2Message.upsert({
            where: { id: messageId },
            create: {
              id: messageId,
              role: message.role === "user" ? "USER" : "ASSISTANT",
              content,
              projectId,
              createdAt: /* @__PURE__ */ new Date()
            },
            update: {
              // Update content in case tool parts were added/modified
              content
            }
          });
          const rawMessages = await prisma.v2Message.findMany({
            where: { projectId },
            orderBy: { createdAt: "asc" }
          });
          for (const msg of rawMessages) {
            if (msg.role !== "ASSISTANT") continue;
            let parts;
            try {
              parts = JSON.parse(msg.content);
            } catch {
              continue;
            }
            if (!Array.isArray(parts)) continue;
            let messageUpdated = false;
            for (const part of parts) {
              const typedPart = part;
              const isShipperCloudTool = typedPart.type === "tool-deployToShipperCloud" || typedPart.toolName === "deployToShipperCloud";
              if (!isShipperCloudTool) continue;
              const output = typedPart.output ?? typedPart.result;
              const isPending = output === void 0 || output === null || typeof output === "object" && output !== null && "status" in output && output.status === "pending_confirmation";
              if (isPending) {
                req.logger?.info({
                  msg: "Auto-declining pending Shipper Cloud tool call",
                  toolCallId: typedPart.toolCallId || typedPart.toolInvocationId,
                  messageId: msg.id
                });
                typedPart.output = {
                  status: "denied",
                  message: "Shipper Cloud deployment was skipped."
                };
                typedPart.result = typedPart.output;
                messageUpdated = true;
              }
            }
            if (messageUpdated) {
              await prisma.v2Message.update({
                where: { id: msg.id },
                data: { content: JSON.stringify(parts) }
              });
              req.logger?.info({
                msg: "Updated message with auto-declined Shipper Cloud tool call",
                messageId: msg.id
              });
            }
          }
          let hitlProcessed = false;
          let hitlDeploymentFailed = false;
          let hitlToolCallId = null;
          let hitlResultMessage = null;
          let hitlResultType = null;
          let extractedStripeKey = null;
          for (const msg of rawMessages) {
            if (msg.role !== "ASSISTANT") continue;
            try {
              const parts = JSON.parse(msg.content);
              if (!Array.isArray(parts)) continue;
              for (const part of parts) {
                if (part.toolName === "requestApiKeys" || part.type === "tool-requestApiKeys") {
                  if (typeof part.output === "string") {
                    try {
                      const out = JSON.parse(part.output);
                      const key = out.keys?.secretKey || out.keys?.stripeSecretKey || out.stripeSecretKey;
                      if (key) {
                        extractedStripeKey = key;
                        req.logger?.info({
                          msg: "Pre-scan: Found Stripe key in history",
                          keyLength: key.length
                        });
                      }
                    } catch {
                    }
                  }
                }
              }
            } catch {
            }
          }
          req.logger?.info({
            msg: "HITL: Processing rawMessages",
            messageCount: rawMessages.length,
            messageRoles: rawMessages.map((m) => m.role)
          });
          for (const msg of rawMessages) {
            if (msg.role !== "ASSISTANT") continue;
            let parts;
            try {
              parts = JSON.parse(msg.content);
            } catch {
              continue;
            }
            if (!Array.isArray(parts)) continue;
            for (const p of parts) {
              if (p.toolName || p.type?.startsWith("tool-")) {
                req.logger?.info({
                  msg: "HITL: Found tool part",
                  toolName: p.toolName,
                  type: p.type,
                  hasOutput: !!p.output,
                  outputPreview: typeof p.output === "string" ? p.output.substring(0, 100) : typeof p.output
                });
              }
            }
            for (const part of parts) {
              const typedPart = part;
              const isApiKeysTool = typedPart.type === "tool-requestApiKeys" || typedPart.toolName === "requestApiKeys";
              if (isApiKeysTool) {
                const toolCallId2 = typedPart.toolCallId || typedPart.toolInvocationId;
                if (!toolCallId2) continue;
                const output2 = typedPart.output;
                if (typeof output2 === "string") {
                  try {
                    const parsed2 = JSON.parse(output2);
                    if (parsed2.success === true) {
                      continue;
                    }
                    if (parsed2.confirmed && parsed2.keys) {
                      const provider = (typedPart.input || typedPart.args)?.provider;
                      req.logger?.info({
                        msg: "HITL: User submitted API keys",
                        toolCallId: toolCallId2,
                        provider
                      });
                      const stripeKey = parsed2.keys.secretKey || parsed2.keys.stripeSecretKey;
                      if (provider === "stripe" && stripeKey) {
                        extractedStripeKey = stripeKey;
                        req.logger?.info({
                          msg: "HITL: Stored Stripe key for later use",
                          keyLength: stripeKey.length
                        });
                      }
                      const toolInput = typedPart.input || typedPart.args;
                      const envVarName = toolInput?.envVarName;
                      const fieldsConfig = toolInput?.fields;
                      let keysSetInConvex = false;
                      const envVarsSet = [];
                      try {
                        const project2 = await prisma.project.findUnique({
                          where: { id: projectId },
                          include: { convexDeployment: true }
                        });
                        if (project2?.convexDeployment?.deployKeyEncrypted) {
                          const deployKey = decryptDeployKey2(
                            project2.convexDeployment.deployKeyEncrypted
                          );
                          const deploymentApi = new ConvexDeploymentAPI(
                            project2.convexDeployment.convexDeploymentUrl,
                            deployKey
                          );
                          const envVarsToSet = {};
                          if (envVarName) {
                            const keyValue = parsed2.keys.apiKey || parsed2.keys.secretKey || Object.values(parsed2.keys)[0];
                            if (typeof keyValue === "string" && keyValue) {
                              envVarsToSet[envVarName] = keyValue;
                            }
                          }
                          if (Array.isArray(fieldsConfig) && fieldsConfig.length > 0) {
                            for (const field of fieldsConfig) {
                              if (field.envVarName && parsed2.keys[field.key]) {
                                envVarsToSet[field.envVarName] = parsed2.keys[field.key];
                              }
                            }
                          }
                          if (Object.keys(envVarsToSet).length > 0) {
                            const envResult = await deploymentApi.setEnvironmentVariables(
                              envVarsToSet
                            );
                            keysSetInConvex = envResult.success;
                            envVarsSet.push(...Object.keys(envVarsToSet));
                            req.logger?.info({
                              msg: "HITL: API keys set in Convex env",
                              provider,
                              envVarName,
                              envVars: Object.keys(envVarsToSet),
                              success: envResult.success,
                              projectId
                            });
                          } else {
                            req.logger?.warn({
                              msg: "HITL: No envVarName specified, keys not saved to Convex",
                              provider,
                              hint: "AI should specify envVarName parameter in requestApiKeys"
                            });
                          }
                        }
                      } catch (envError) {
                        req.logger?.warn({
                          msg: "HITL: Failed to set API keys in Convex",
                          provider,
                          error: envError instanceof Error ? envError.message : String(envError)
                        });
                      }
                      const nextStepMessage = provider === "stripe" ? "Stripe key received. IMPORTANT: You must pass stripeSecretKey to ALL Stripe execution tools. NEXT: Call stripeCreateProductAndPrice with the stripeSecretKey, then after approval call executeStripeCreateProductAndPrice with the same stripeSecretKey." : keysSetInConvex ? `${provider} API key(s) received and saved to Convex environment variables: ${envVarsSet.join(", ")}. You can now use these in your Convex actions.` : "API keys received. Proceed with integration.";
                      hitlResultMessage = JSON.stringify({
                        success: true,
                        keys: parsed2.keys,
                        // Include stripeSecretKey at top level for AI to easily access
                        stripeSecretKey: stripeKey,
                        provider,
                        keysSetInConvex,
                        envVarsSet,
                        message: nextStepMessage
                      });
                      hitlProcessed = true;
                      hitlToolCallId = toolCallId2;
                      hitlResultType = "api-keys";
                    }
                  } catch {
                  }
                }
                continue;
              }
              const isStripeHitlTool = typedPart.type === "tool-stripeListProducts" || typedPart.type === "tool-stripeListPrices" || typedPart.type === "tool-stripeCreateProductAndPrice" || typedPart.toolName === "stripeListProducts" || typedPart.toolName === "stripeListPrices" || typedPart.toolName === "stripeCreateProductAndPrice";
              if (isStripeHitlTool) {
                req.logger?.info({
                  msg: "HITL: Detected Stripe HITL tool",
                  toolName: typedPart.toolName,
                  type: typedPart.type
                });
                const toolCallId2 = typedPart.toolCallId || typedPart.toolInvocationId;
                if (!toolCallId2) {
                  req.logger?.warn({
                    msg: "HITL: Stripe tool has no toolCallId"
                  });
                  continue;
                }
                const output2 = typedPart.output;
                req.logger?.info({
                  msg: "HITL: Stripe tool output",
                  hasOutput: !!output2,
                  outputType: typeof output2,
                  outputPreview: typeof output2 === "string" ? output2.substring(0, 200) : "not-string"
                });
                let parsedOutput = null;
                if (typeof output2 === "string") {
                  try {
                    parsedOutput = JSON.parse(output2);
                  } catch {
                  }
                }
                if (parsedOutput?.executeNow === true || parsedOutput?.success === true) {
                  continue;
                }
                const isConfirmed = parsedOutput?.confirmed === true || output2 === "yes" || output2 === "confirmed" || output2 === SHIPPER_CLOUD_APPROVAL.YES;
                const isDenied = parsedOutput?.confirmed === false || output2 === "no" || output2 === "denied" || output2 === SHIPPER_CLOUD_APPROVAL.NO;
                if (isConfirmed && parsedOutput) {
                  let stripeSecretKey = parsedOutput.stripeSecretKey || extractedStripeKey;
                  req.logger?.info({
                    msg: "HITL: Stripe key source check",
                    fromPayload: !!parsedOutput.stripeSecretKey,
                    fromExtracted: !!extractedStripeKey,
                    hasKey: !!stripeSecretKey
                  });
                  req.logger?.info({
                    msg: "HITL: Stripe operation approved - passing args back to AI",
                    toolCallId: toolCallId2,
                    toolName: typedPart.toolName,
                    hasStripeSecretKey: !!stripeSecretKey,
                    parsedOutputKeys: Object.keys(parsedOutput)
                  });
                  hitlResultMessage = JSON.stringify({
                    confirmed: true,
                    executeNow: true,
                    ...parsedOutput,
                    // Ensure stripeSecretKey is included (from payload or history)
                    stripeSecretKey: stripeSecretKey || parsedOutput.stripeSecretKey
                  });
                  const finalKey = stripeSecretKey || parsedOutput.stripeSecretKey;
                  req.logger?.info({
                    msg: "HITL: Result message for AI",
                    hitlResultMessage: hitlResultMessage.substring(0, 500),
                    keyWeAreSending: finalKey ? `${finalKey.substring(0, 12)}...${finalKey.substring(finalKey.length - 4)}` : "NO_KEY",
                    keyLength: finalKey?.length || 0
                  });
                  hitlProcessed = true;
                  hitlToolCallId = toolCallId2;
                  hitlResultType = "stripe";
                } else if (isDenied) {
                  req.logger?.info({
                    msg: "HITL: User denied Stripe operation",
                    toolCallId: toolCallId2
                  });
                  hitlResultMessage = JSON.stringify({
                    confirmed: false,
                    denied: true,
                    message: "Stripe operation was denied by the user."
                  });
                  hitlProcessed = true;
                  hitlToolCallId = toolCallId2;
                  hitlResultType = "stripe";
                }
                continue;
              }
              const isShipperCloudTool = typedPart.type === "tool-deployToShipperCloud" || typedPart.toolName === "deployToShipperCloud";
              if (!isShipperCloudTool) continue;
              const toolCallId = typedPart.toolCallId || typedPart.toolInvocationId;
              if (!toolCallId) continue;
              const output = typedPart.output;
              if (output === SHIPPER_CLOUD_APPROVAL.YES) {
                req.logger?.info({
                  msg: "HITL: Processing Shipper Cloud confirmation",
                  toolCallId
                });
                const toolInput = typedPart.input || typedPart.args;
                const projectName2 = toolInput?.projectName || project.name;
                try {
                  const deploymentResult = await executeShipperCloudDeploymentWithFiles(
                    projectId,
                    userId,
                    projectName2
                  );
                  if (!deploymentResult.success) {
                    hitlDeploymentFailed = true;
                    hitlResultMessage = formatDeploymentError(
                      new Error(deploymentResult.error || "Deployment failed")
                    );
                  } else {
                    hitlResultMessage = formatDeploymentSuccess(deploymentResult);
                  }
                } catch (error) {
                  req.logger?.error({
                    msg: "HITL: Deployment failed",
                    error: error instanceof Error ? error.message : String(error)
                  });
                  hitlDeploymentFailed = true;
                  hitlResultMessage = formatDeploymentError(error);
                }
                hitlProcessed = true;
                hitlToolCallId = toolCallId;
                hitlResultType = "deployment";
              } else if (output === SHIPPER_CLOUD_APPROVAL.NO) {
                req.logger?.info({
                  msg: "HITL: User declined Shipper Cloud deployment",
                  toolCallId
                });
                hitlResultMessage = "Shipper Cloud deployment was cancelled by the user.";
                hitlProcessed = true;
                hitlToolCallId = toolCallId;
                hitlResultType = "deployment";
              } else if (output !== null && typeof output === "object" && ("success" in output || "error" in output)) {
                hitlProcessed = true;
              }
            }
          }
          if (hitlProcessed && hitlToolCallId && hitlResultMessage) {
            for (const msg of rawMessages) {
              if (msg.role !== "ASSISTANT") continue;
              let parts;
              try {
                parts = JSON.parse(msg.content);
              } catch {
                continue;
              }
              if (!Array.isArray(parts)) continue;
              let updated = false;
              for (const part of parts) {
                const typedPart = part;
                const isShipperCloudTool = typedPart.type === "tool-deployToShipperCloud" || typedPart.toolName === "deployToShipperCloud";
                const isApiKeysTool = typedPart.type === "tool-requestApiKeys" || typedPart.toolName === "requestApiKeys";
                const isStripeHitlTool = typedPart.type === "tool-stripeListProducts" || typedPart.type === "tool-stripeListPrices" || typedPart.type === "tool-stripeCreateProductAndPrice" || typedPart.toolName === "stripeListProducts" || typedPart.toolName === "stripeListPrices" || typedPart.toolName === "stripeCreateProductAndPrice";
                const partToolCallId = typedPart.toolCallId || typedPart.toolInvocationId;
                if ((isShipperCloudTool || isApiKeysTool || isStripeHitlTool) && partToolCallId === hitlToolCallId) {
                  typedPart.output = hitlResultMessage;
                  updated = true;
                  break;
                }
              }
              if (updated) {
                await prisma.v2Message.update({
                  where: { id: msg.id },
                  data: { content: JSON.stringify(parts) }
                });
                req.logger?.info({
                  msg: "HITL: Updated message with deployment result",
                  messageId: msg.id
                });
                break;
              }
            }
          }
          if (hitlDeploymentFailed && hitlResultMessage) {
            req.logger?.error({
              msg: "HITL: Shipper Cloud deployment failed, aborting stream",
              projectId,
              error: hitlResultMessage
            });
            throw new Error(
              `Shipper Cloud deployment failed: ${hitlResultMessage}`
            );
          }
          const uiMessages = rawMessages.map((msg) => {
            const parsedContent = JSON.parse(msg.content);
            let parts = parsedContent;
            if (msg.role === "USER" && Array.isArray(parts)) {
              const imageParts = parts.filter(
                (p) => p.type === "file" && p.mediaType?.startsWith("image/")
              );
              if (imageParts.length > 0) {
                req.logger?.info({
                  msg: "\u{1F4E5} Loaded preset images from database",
                  messageId: msg.id,
                  imageCount: imageParts.length,
                  images: imageParts.map((p) => ({
                    url: p.url,
                    mediaType: p.mediaType,
                    name: p.name
                  }))
                });
              }
            }
            if (msg.role === "ASSISTANT" && Array.isArray(parts)) {
              const projectLog = createProjectLogger(projectId);
              const originalPartTypes = parts.map(
                (p) => p.type
              );
              const filteredOutParts = [];
              parts = parts.filter((part) => {
                if (typeof part.type === "string" && (part.type.startsWith("tool-") || part.type.startsWith("step-"))) {
                  filteredOutParts.push(part.type);
                  return false;
                }
                return true;
              });
              if (filteredOutParts.length > 0) {
                projectLog.debug(
                  {
                    messageId: msg.id,
                    filteredCount: filteredOutParts.length,
                    filteredTypes: filteredOutParts,
                    originalTypes: originalPartTypes,
                    remainingParts: parts.length
                  },
                  "Filtered tool parts from assistant message for AI SDK compatibility"
                );
              }
              if (parts.length === 0 && originalPartTypes.length > 0) {
                projectLog.debug(
                  { messageId: msg.id, originalTypes: originalPartTypes },
                  "All parts filtered from message, adding placeholder"
                );
                parts = [{ type: "text", text: "[Previous response]" }];
              }
            }
            const message2 = {
              id: msg.id,
              role: msg.role.toLowerCase(),
              parts,
              createdAt: msg.createdAt
            };
            return message2;
          });
          let prunedMessages = contextManager.pruneConversation(uiMessages);
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://staging.shipper.now";
          let totalDocumentsRemoved = 0;
          let totalPresetImagesRemoved = 0;
          prunedMessages = prunedMessages.map((msg) => {
            if (msg.role === "user") {
              const processedParts = [];
              for (const part of msg.parts) {
                if (part.type !== "file") {
                  processedParts.push(part);
                  continue;
                }
                const isImage = part.mediaType?.startsWith("image/");
                const isVideo = part.mediaType?.startsWith("video/");
                const isAudio = part.mediaType?.startsWith("audio/");
                if (isImage) {
                  if (part.url?.startsWith("/")) {
                    totalPresetImagesRemoved++;
                    req.logger?.info({
                      msg: "\u{1F3A8} Removing preset image from message parts (will be added to system prompt)",
                      relativeUrl: part.url,
                      mediaType: part.mediaType,
                      name: part.name
                    });
                    continue;
                  }
                  processedParts.push(part);
                  continue;
                }
                if (isVideo || isAudio) {
                  processedParts.push(part);
                  continue;
                }
                totalDocumentsRemoved++;
                req.logger?.debug({
                  msg: "Removing document file from AI context",
                  mediaType: part.mediaType,
                  name: part.name
                });
              }
              const uploadedImageCount = processedParts.filter(
                (p) => p.type === "file" && p.mediaType?.startsWith("image/")
              ).length;
              if (uploadedImageCount > 0) {
                req.logger?.info({
                  msg: "\u{1F4F8} Uploaded images being sent to AI in message parts",
                  imageCount: uploadedImageCount,
                  messageId: msg.id,
                  imageUrls: processedParts.filter(
                    (p) => p.type === "file" && p.mediaType?.startsWith("image/")
                  ).map((p) => p.url)
                });
              }
              return { ...msg, parts: processedParts };
            }
            return msg;
          });
          if (totalDocumentsRemoved > 0 || totalPresetImagesRemoved > 0) {
            req.logger?.info({
              msg: "Processed file parts for AI SDK",
              totalDocumentsRemoved,
              totalPresetImagesRemoved,
              note: totalPresetImagesRemoved > 0 ? "Preset images removed from message parts (will be added to system prompt)" : void 0,
              messagesModified: prunedMessages.filter(
                (msg) => msg.role === "user" && msg.parts.every(
                  (p) => p.type !== "file" || p.mediaType !== "application/pdf" && p.mediaType !== "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                )
              ).length
            });
          }
          if (documentAnalysisText && prunedMessages.length > 0) {
            const lastMessage = prunedMessages[prunedMessages.length - 1];
            if (lastMessage.role === "user") {
              lastMessage.parts = [
                ...lastMessage.parts,
                {
                  type: "text",
                  text: `

[Document Analysis]:
${documentAnalysisText}`
                }
              ];
              req.logger?.info({
                msg: "Document analysis injected into AI context (all documents stripped from conversation)",
                analysisLength: documentAnalysisText.length,
                messagePartsCount: lastMessage.parts.length,
                lastMessagePreview: JSON.stringify(
                  lastMessage.parts.map((p) => ({
                    type: p.type,
                    textPreview: p.type === "text" ? p.text?.substring(0, 100) : void 0,
                    hasFile: p.type === "file"
                  }))
                )
              });
            } else {
              req.logger?.warn({
                msg: "Last message is not a user message, cannot inject document analysis",
                lastMessageRole: lastMessage.role
              });
            }
          } else {
            req.logger?.warn({
              msg: "Cannot inject document analysis",
              hasAnalysis: !!documentAnalysisText,
              hasMessages: prunedMessages.length > 0
            });
          }
          let initialFiles = {};
          let workingFragmentId = project.activeFragmentId || void 0;
          if (message.role === "user") {
            if (project.activeFragmentId) {
              req.logger?.info({
                msg: "Loading active fragment",
                fragmentId: project.activeFragmentId
              });
              const activeFragment = await prisma.v2Fragment.findUnique({
                where: { id: project.activeFragmentId },
                select: { files: true, title: true }
              });
              if (activeFragment && activeFragment.files) {
                const files = activeFragment.files;
                initialFiles = files;
                req.logger?.info({
                  msg: "Fragment files loaded (unmodified)",
                  fileCount: Object.keys(files).length
                });
              }
            }
            const timestamp = (/* @__PURE__ */ new Date()).toLocaleString();
            const fragmentTitle = `Work in progress - ${timestamp}`;
            const workingFragment = await prisma.v2Fragment.create({
              data: {
                title: fragmentTitle,
                files: initialFiles,
                projectId
              }
            });
            workingFragmentId = workingFragment.id;
            await prisma.project.update({
              where: { id: projectId },
              data: { activeFragmentId: workingFragment.id }
            });
            req.logger?.info({
              msg: "Working fragment created",
              fragmentId: workingFragment.id,
              fragmentTitle
            });
          }
          const fragmentFilesMap = /* @__PURE__ */ new Map();
          if (workingFragmentId && Object.keys(initialFiles).length > 0) {
            Object.entries(initialFiles).forEach(([path3, content2]) => {
              fragmentFilesMap.set(path3, content2);
            });
            req.logger?.info({
              msg: "Fragment context initialized",
              fileCount: fragmentFilesMap.size
            });
          }
          toolsContext = {
            projectId,
            userId,
            sandbox: null,
            sandboxId: null,
            sandboxUrl: null,
            files: /* @__PURE__ */ new Map(),
            fragmentFiles: fragmentFilesMap,
            currentFragmentId: workingFragmentId,
            traceId: streamId,
            lspServers: /* @__PURE__ */ new Map(),
            todos: [],
            logger: req.logger || void 0,
            // Pass logger from request context
            isImportedProject: isImported,
            // Track if this is an imported project
            hasCalledGetFiles: false
            // Track if getFiles has been called (required for imports)
          };
          const fragmentIdForRecovery = toolsContext.currentFragmentId || project.activeFragmentId || null;
          const recoveryResult = await ensureSandboxRecovered(projectId, {
            fragmentId: fragmentIdForRecovery,
            templateName: selectedTemplate,
            logger: req.logger || void 0
          });
          req.logger?.info({
            msg: "Sandbox recovery check complete",
            projectId,
            fragmentId: fragmentIdForRecovery,
            recovered: recoveryResult.recovered
          });
          req.logger?.info("Setting up sandbox");
          const sandboxInfo = await getSandbox(projectId, req.logger);
          if (!sandboxInfo) {
            req.logger?.error({
              msg: "Sandbox unavailable after recovery",
              projectId,
              fragmentId: fragmentIdForRecovery
            });
            throw new Error(
              "Sandbox is currently unavailable. Please retry the request in a few seconds."
            );
          }
          toolsContext.sandbox = sandboxInfo.sandbox;
          toolsContext.sandboxId = sandboxInfo.sandboxId;
          toolsContext.sandboxUrl = sandboxInfo.sandboxUrl;
          toolsContext.files = sandboxInfo.files;
          const userMessages = prunedMessages.filter((m) => m.role === "user");
          const isFirstUserMessage = userMessages.length === 1;
          let modelToUse;
          let pricingToUse;
          let isFirstPromptPricing = false;
          const useProductionModels = process.env.NODE_ENV === "production" || process.env.USE_PRODUCTION_MODELS === "true";
          const isBackendHitlContinuation = hitlProcessed && (hitlResultType === "deployment" || hitlResultType === "stripe" || hitlResultType === "api-keys" || hitlResultType === "enableAI");
          if (!useProductionModels) {
            modelToUse = DEV_MODEL;
            pricingToUse = ANTHROPIC_PRICING_HAIKU;
          } else if (isFirstUserMessage) {
            modelToUse = MODEL_OPUS;
            pricingToUse = ANTHROPIC_PRICING_OPUS;
            isFirstPromptPricing = true;
          } else if (isBackendHitlContinuation) {
            modelToUse = MODEL_OPUS;
            pricingToUse = ANTHROPIC_PRICING_OPUS;
          } else if (complexityAnalysis?.isBackendTask) {
            modelToUse = MODEL_OPUS;
            pricingToUse = ANTHROPIC_PRICING_OPUS;
          } else if (complexityAnalysis?.category === "advanced") {
            modelToUse = MODEL_OPUS;
            pricingToUse = ANTHROPIC_PRICING_OPUS;
          } else if (complexityAnalysis?.category === "complex" || complexityAnalysis?.category === "moderate") {
            modelToUse = MODEL_SONNET;
            pricingToUse = ANTHROPIC_PRICING_SONNET;
          } else {
            modelToUse = MODEL_HAIKU;
            pricingToUse = ANTHROPIC_PRICING_HAIKU;
          }
          req.logger?.info({
            msg: "Model selected for chat",
            model: modelToUse,
            isFirstUserMessage,
            isFirstPromptPricing,
            isBackendTask: complexityAnalysis?.isBackendTask || false,
            isBackendHitlContinuation,
            hitlResultType,
            marginApplied: isFirstPromptPricing ? "10%" : "50%",
            environment: process.env.NODE_ENV || "development",
            complexity: complexityAnalysis?.category || "unknown",
            complexityScore: complexityAnalysis?.complexity,
            cachingNote: "Native Anthropic prompt caching enabled - static system prompt will be cached across all steps and requests"
          });
          builderAnthropicCost = 0;
          stepCount = 0;
          let wasCancelled = false;
          let creditsAlreadyDeducted = false;
          assistantMessageId = generateId();
          await prisma.v2Message.create({
            data: {
              id: assistantMessageId,
              role: "ASSISTANT",
              content: JSON.stringify([]),
              // Start with empty parts
              projectId,
              createdAt: /* @__PURE__ */ new Date()
            }
          });
          req.logger?.info({
            msg: "Assistant message record created for incremental saving",
            messageId: assistantMessageId
          });
          if (message.role === "user") {
            const affordability = await CreditManager.canAffordOperation(
              userId,
              1
            );
            if (!affordability.canAfford) {
              req.logger?.warn({
                msg: "Insufficient credits - blocking generation",
                userId,
                projectId,
                reason: affordability.reason,
                currentBalance: affordability.currentBalance
              });
              throw new Error(
                `Insufficient credits. ${affordability.reason}. Please purchase more credits to continue.`
              );
            }
          }
          if (isImported) {
            const importContextMessages = getCodeImportContext(project);
            if (importContextMessages.length > 0) {
              req.logger?.info({
                msg: "Injecting code import context",
                projectId,
                framework: project.codeImport?.detectedFramework,
                fileCount: project.codeImport?.fileCount
              });
              prunedMessages = [...importContextMessages, ...prunedMessages];
            }
          }
          let finalMessages = prunedMessages;
          if (hitlProcessed && hitlResultMessage) {
            const resultLabel = hitlResultType === "api-keys" ? "API Keys Received" : hitlResultType === "stripe" ? "Stripe Operation Result" : "Shipper Cloud Deployment Result";
            req.logger?.info({
              msg: `HITL ${hitlResultType} processed, injecting result message`,
              projectId,
              hitlResultType,
              resultPreview: hitlResultMessage.substring(0, 100)
            });
            finalMessages = [
              ...prunedMessages,
              {
                id: generateId(),
                role: "user",
                parts: [
                  {
                    type: "text",
                    text: `[System: ${resultLabel}]
${hitlResultMessage}`
                  }
                ],
                createdAt: /* @__PURE__ */ new Date()
              }
            ];
          }
          const modelMessages = convertToModelMessages(finalMessages);
          const imagePartsInMessages = prunedMessages.flatMap(
            (msg) => msg.parts.filter(
              (p) => p.type === "file" && p.mediaType?.startsWith("image/")
            ).map((p) => ({
              messageId: msg.id,
              role: msg.role,
              url: p.url,
              mediaType: p.mediaType,
              name: p.name
            }))
          ).filter(Boolean);
          if (imagePartsInMessages.length > 0) {
            req.logger?.info({
              msg: "Image parts found in messages being sent to AI",
              imageCount: imagePartsInMessages.length,
              images: imagePartsInMessages
            });
          } else {
            req.logger?.debug({
              msg: "No image parts found in messages being sent to AI",
              totalMessages: prunedMessages.length,
              messageParts: prunedMessages.map((m) => ({
                role: m.role,
                partsCount: m.parts.length,
                partTypes: m.parts.map((p) => p.type)
              }))
            });
          }
          const baseSystemPrompt = getFullStackPrompt();
          const stylingImageUrl = await extractStylingImageUrl(
            message,
            prunedMessages,
            req.logger
          );
          const lastUserMessage = prunedMessages[prunedMessages.length - 1];
          const hasFiles = lastUserMessage?.role === "user" && lastUserMessage.parts?.some((part) => part.type === "file");
          const fileContext = hasFiles ? `

FILE ATTACHMENTS:
The user has attached ${lastUserMessage.parts.filter((p) => p.type === "file").length} file(s) to their message.
These files may include:
- Images (for design reference, color schemes, layouts, or visual elements)
- PDFs or DOCX documents (for specifications, requirements, or content)
- Code files (for reference implementations or examples)
- Text files (for data, configurations, or documentation)

IMPORTANT: Analyze these files to understand the user's requirements and use them to inform your implementation decisions.
DO NOT echo, quote, or reproduce the file contents in your response. Only reference what you learned from them.` : "";
          const dynamicContext = `PROJECT CONTEXT:
You are working on the project: "${projectName}"
${fileContext}

Maximum steps allowed: ${getMaxSteps(complexityAnalysis)}
Budget limit: $${HARD_BUDGET_LIMIT_USD}`;
          let systemMessages;
          if (stylingImageUrl) {
            req.logger?.info({
              msg: "Using styling preset image in system prompt",
              imageUrl: stylingImageUrl.substring(0, 100)
              // Log preview only
            });
            systemMessages = createCachedSystemPromptWithImage(
              baseSystemPrompt,
              dynamicContext,
              stylingImageUrl
            );
          } else {
            systemMessages = createCachedSystemPrompt(
              baseSystemPrompt,
              dynamicContext
            );
          }
          const messagesWithSystem = [...systemMessages, ...modelMessages];
          const allTools = tools(toolsContext);
          const shouldExcludeShipperCloudTool = hitlProcessed || project.shipperCloudEnabled;
          const chatTools = shouldExcludeShipperCloudTool ? Object.fromEntries(
            Object.entries(allTools).filter(
              ([name]) => name !== "deployToShipperCloud"
            )
          ) : allTools;
          if (shouldExcludeShipperCloudTool) {
            req.logger?.info({
              msg: "Excluding deployToShipperCloud tool",
              reason: hitlProcessed ? "HITL processed" : "already enabled",
              projectId
            });
          }
          const result = streamText({
            model: anthropic(modelToUse),
            abortSignal: abortController.signal,
            experimental_transform: smoothStream({
              delayInMs: 20,
              // optional: defaults to 10ms
              chunking: "line"
              // optional: defaults to 'word'
            }),
            // OPTIMIZED: Non-blocking stream cancellation check
            // Use fire-and-forget pattern to avoid blocking stream processing
            onChunk: throttle(() => {
              prisma.project.findFirst({
                where: { id: projectId },
                select: { activeStreamId: true }
              }).then(async (p) => {
                if (!p?.activeStreamId || p.activeStreamId !== streamId) {
                  req.logger?.info({ msg: "Stream cancelled by user" });
                  wasCancelled = true;
                  await prisma.project.update({
                    where: { id: projectId },
                    data: {
                      activeStreamId: null,
                      activeStreamStartedAt: null
                    }
                  });
                  abortController.abort();
                }
              }).catch((error) => {
                req.logger?.error({
                  msg: "Error checking stream status",
                  error: error instanceof Error ? error.message : String(error)
                });
              });
            }, 2e3),
            // Increased to 2s to reduce DB load
            messages: messagesWithSystem,
            tools: chatTools,
            stopWhen: [
              stepCountIs(getMaxSteps(complexityAnalysis)),
              // 🛑 HITL (Human-in-the-Loop) stop condition
              // Stop immediately when a tool returns pending_confirmation
              // This allows the user to confirm before the AI continues
              ({ steps }) => {
                if (steps.length === 0) return false;
                const lastStep = steps[steps.length - 1];
                if (!lastStep.toolResults) return false;
                for (const toolResult of lastStep.toolResults) {
                  const output = toolResult.output;
                  if (output?.status === "pending_confirmation") {
                    req.logger?.info({
                      msg: "HITL tool returned pending_confirmation - stopping generation",
                      toolName: toolResult.toolName,
                      step: steps.length
                    });
                    return true;
                  }
                }
                return false;
              },
              // 🎯 Budget-based stop condition
              ({ steps }) => {
                const totalCost = steps.reduce((acc, step) => {
                  const anthropicMeta = step.providerMetadata?.anthropic;
                  const stepUsage = step.usage;
                  if (anthropicMeta || stepUsage) {
                    return acc + calculateAnthropicCost(
                      {
                        inputTokens: stepUsage?.inputTokens,
                        outputTokens: stepUsage?.outputTokens,
                        cacheCreationInputTokens: anthropicMeta?.cacheCreationInputTokens,
                        cacheReadInputTokens: anthropicMeta?.cacheReadInputTokens
                      },
                      pricingToUse
                    );
                  }
                  return acc;
                }, 0);
                if (totalCost >= HARD_BUDGET_LIMIT_USD) {
                  req.logger?.error({
                    msg: "HARD BUDGET LIMIT EXCEEDED - Stopping generation",
                    totalCostUSD: totalCost,
                    hardLimit: HARD_BUDGET_LIMIT_USD,
                    maxSteps: getMaxSteps(complexityAnalysis),
                    step: steps.length,
                    userId,
                    projectId
                  });
                  return true;
                }
                return false;
              }
            ],
            experimental_telemetry: { isEnabled: true },
            onStepFinish: async ({
              toolCalls,
              toolResults,
              text,
              usage,
              providerMetadata
            }) => {
              stepCount++;
              console.log(
                "[CACHE] Step",
                stepCount,
                "metadata:",
                JSON.stringify(providerMetadata, null, 2)
              );
              const anthropicMeta = providerMetadata?.anthropic;
              const anthropicUsage = anthropicMeta?.usage;
              const stepCost = calculateAnthropicCost(
                {
                  inputTokens: usage?.inputTokens,
                  outputTokens: usage?.outputTokens,
                  cacheCreationInputTokens: anthropicUsage?.cache_creation_input_tokens || anthropicMeta?.cacheCreationInputTokens,
                  cacheReadInputTokens: anthropicUsage?.cache_read_input_tokens || anthropicMeta?.cacheReadInputTokens
                },
                pricingToUse
              );
              const cacheReadTokens = anthropicUsage?.cache_read_input_tokens || anthropicMeta?.cacheReadInputTokens || 0;
              if (stepCost > 0) {
                builderAnthropicCost += stepCost;
                builderInputTokens += (usage?.inputTokens || 0) + cacheReadTokens;
                builderOutputTokens += usage?.outputTokens || 0;
              }
              const cumulativeCredits = isFirstPromptPricing ? calculateCreditsFromUSDFirstPrompt(builderAnthropicCost) : calculateCreditsFromUSD(builderAnthropicCost);
              const affordability = await CreditManager.canAffordOperation(
                userId,
                cumulativeCredits
              );
              if (!affordability.canAfford) {
                req.logger?.error({
                  msg: "Insufficient credits during generation - aborting and finalizing",
                  userId,
                  projectId,
                  step: stepCount,
                  cumulativeCostUSD: builderAnthropicCost,
                  cumulativeCredits,
                  currentBalance: affordability.currentBalance,
                  reason: affordability.reason
                });
                if (builderAnthropicCost > 0 && affordability.currentBalance !== void 0) {
                  const minimumBalance = CreditManager.getMinimumBalance();
                  const maxAffordable = Math.max(
                    0,
                    Math.floor(
                      (affordability.currentBalance - minimumBalance) * 100
                    ) / 100
                  );
                  if (maxAffordable > 0) {
                    try {
                      await CreditManager.deductCredits(
                        userId,
                        maxAffordable,
                        "AI_GENERATION",
                        `AI Generation for "${projectName}" - ABORTED (insufficient credits after ${stepCount} steps) [charged ${maxAffordable} of ${cumulativeCredits} credits]`,
                        {
                          projectId,
                          projectName,
                          messageId: assistantMessageId,
                          totalSteps: stepCount,
                          totalCostUSD: builderAnthropicCost,
                          creditsCharged: maxAffordable,
                          originalCreditsRequired: cumulativeCredits,
                          abortedDueToInsufficientCredits: true
                        }
                      );
                      creditsAlreadyDeducted = true;
                      req.logger?.warn({
                        msg: "Credits deducted before abort - partial charge for work completed",
                        userId,
                        projectId,
                        step: stepCount,
                        totalCostUSD: builderAnthropicCost,
                        creditsCharged: maxAffordable,
                        creditsRequired: cumulativeCredits,
                        shortfall: cumulativeCredits - maxAffordable
                      });
                    } catch (deductError) {
                      req.logger?.error({
                        msg: "Failed to deduct credits before abort",
                        userId,
                        projectId,
                        error: deductError instanceof Error ? deductError.message : "Unknown error"
                      });
                    }
                  }
                }
                abortController.abort();
                throw new Error(
                  `Insufficient credits: ${affordability.reason}`
                );
              }
              if (stepCost > 0) {
                const cacheMetrics = extractCacheMetrics(providerMetadata);
                req.logger?.info({
                  msg: "Step completed",
                  step: stepCount,
                  maxSteps: getMaxSteps(complexityAnalysis),
                  stepCostUSD: stepCost,
                  cumulativeCostUSD: builderAnthropicCost,
                  cumulativeCredits,
                  cumulativeInputTokens: builderInputTokens,
                  cumulativeOutputTokens: builderOutputTokens,
                  inputTokens: usage?.inputTokens,
                  outputTokens: usage?.outputTokens,
                  cacheRead: cacheMetrics.cacheReadTokens,
                  cacheCreated: cacheMetrics.cacheCreationTokens,
                  cacheSavings: cacheMetrics.cacheSavingsPercent > 0 ? `~${cacheMetrics.cacheSavingsPercent}% cost reduction` : "warming cache"
                });
              }
              if (text && text.trim().length > 0) {
                accumulatedParts.push({
                  type: "text",
                  text
                });
              }
              if (toolCalls) {
                for (const toolCall of toolCalls) {
                  req.logger?.debug({
                    msg: "Tool start",
                    toolName: toolCall.toolName,
                    toolCallId: toolCall.toolCallId
                  });
                  const toolCallWithArgs = toolCall;
                  accumulatedParts.push({
                    type: "tool-invocation",
                    toolInvocationId: toolCall.toolCallId,
                    toolName: toolCall.toolName,
                    state: "call",
                    args: toolCallWithArgs.args
                  });
                }
              }
              if (toolResults) {
                for (const toolResult of toolResults) {
                  if (toolResult.toolName === "generateImage" && toolResult.output) {
                    const imageResult = toolResult.output;
                    const imageCost = imageResult.totalCostUSD || 0;
                    if (imageCost > 0) {
                      builderAnthropicCost += imageCost;
                      req.logger?.info({
                        msg: "Image generation cost tracked",
                        step: stepCount,
                        imageCostUSD: imageCost,
                        cumulativeCostUSD: builderAnthropicCost,
                        imagesGenerated: imageResult.totalGenerated
                      });
                    }
                  }
                  const existingInvocation = accumulatedParts.find(
                    (p) => p.type === "tool-invocation" && p.toolInvocationId === toolResult.toolCallId
                  );
                  if (existingInvocation) {
                    existingInvocation.state = "result";
                    existingInvocation.result = toolResult.output;
                  } else {
                    accumulatedParts.push({
                      type: "tool-invocation",
                      toolInvocationId: toolResult.toolCallId,
                      toolName: toolResult.toolName,
                      state: "result",
                      result: toolResult.output
                    });
                  }
                  req.logger?.debug({
                    msg: "Tool finish",
                    toolName: toolResult.toolName,
                    toolCallId: toolResult.toolCallId
                  });
                }
              }
              if (assistantMessageId && accumulatedParts.length > 0) {
                try {
                  await prisma.v2Message.update({
                    where: { id: assistantMessageId },
                    data: {
                      content: JSON.stringify(accumulatedParts),
                      updatedAt: /* @__PURE__ */ new Date()
                    }
                  });
                  req.logger?.debug({
                    msg: "Assistant message updated incrementally",
                    messageId: assistantMessageId,
                    step: stepCount,
                    partsCount: accumulatedParts.length
                  });
                } catch (saveError) {
                  req.logger?.error({
                    msg: "Failed to save message incrementally",
                    error: saveError instanceof Error ? saveError.message : String(saveError),
                    step: stepCount
                  });
                }
              }
              const warningThreshold = HARD_BUDGET_LIMIT_USD * 0.8;
              const criticalThreshold = HARD_BUDGET_LIMIT_USD * 0.95;
              if (builderAnthropicCost >= criticalThreshold && builderAnthropicCost < HARD_BUDGET_LIMIT_USD) {
                req.logger?.warn({
                  msg: "CRITICAL: Budget almost exhausted - AI should finalize NOW",
                  totalCostUSD: builderAnthropicCost,
                  hardLimit: HARD_BUDGET_LIMIT_USD,
                  percentUsed: (builderAnthropicCost / HARD_BUDGET_LIMIT_USD * 100).toFixed(1),
                  step: stepCount
                });
              } else if (builderAnthropicCost >= warningThreshold && builderAnthropicCost < criticalThreshold) {
                req.logger?.warn({
                  msg: "Approaching budget limit",
                  totalCostUSD: builderAnthropicCost,
                  hardLimit: HARD_BUDGET_LIMIT_USD,
                  percentUsed: (builderAnthropicCost / HARD_BUDGET_LIMIT_USD * 100).toFixed(1),
                  step: stepCount
                });
              }
            },
            prepareStep: async ({
              stepNumber,
              messages
            }) => {
              const currentStep = stepNumber + 1;
              const maxSteps = getMaxSteps(complexityAnalysis);
              const stepsRemaining = maxSteps - currentStep;
              applyMessageCaching(messages, {
                logger: req.logger,
                currentStep
              });
              const budgetUsedPercent = builderAnthropicCost / HARD_BUDGET_LIMIT_USD * 100;
              const budgetRemaining = HARD_BUDGET_LIMIT_USD - builderAnthropicCost;
              let urgencyMessage = "";
              if (budgetUsedPercent >= 90) {
                urgencyMessage = `\u{1F6A8} CRITICAL: Budget over 90% used! FINALIZE IMMEDIATELY!`;
              } else if (budgetUsedPercent >= 85) {
                urgencyMessage = `\u26A0\uFE0F URGENT: Budget ${budgetUsedPercent.toFixed(0)}% used ($${budgetRemaining.toFixed(2)} left) - Focus on completion!`;
              } else if (budgetUsedPercent >= 70) {
                urgencyMessage = `\u23F0 Budget ${budgetUsedPercent.toFixed(0)}% used ($${budgetRemaining.toFixed(2)} left) - plan to wrap up`;
              }
              const dynamicContext2 = `[INTERNAL SYSTEM STATUS]
STEP: ${currentStep} of ${maxSteps} (${stepsRemaining} remaining)
BUDGET: ${budgetUsedPercent.toFixed(0)}% used
${urgencyMessage}

RULES:
1. ACT on this status - do not just read it
2. NEVER mention budget, steps, or limits to the user
3. NEVER say "I need to finalize", "due to budget", "running low on steps"
4. If budget >= 90%: IMMEDIATELY call finalizeWorkingFragment - no explanation
5. If budget >= 70%: wrap up efficiently, avoid new features
6. Your response must look normal - no hints about internal status
7. Just DO the action, do not TALK about doing it`.trim();
              const updatedMessages = [
                ...messages,
                { role: "user", content: dynamicContext2 }
              ];
              if (budgetUsedPercent >= 90) {
                req.logger?.warn({
                  msg: "CRITICAL: Budget 90% exhausted - AI must finalize immediately",
                  totalCostUSD: builderAnthropicCost,
                  hardLimit: HARD_BUDGET_LIMIT_USD,
                  percentUsed: budgetUsedPercent.toFixed(1),
                  step: currentStep,
                  maxSteps
                });
                return {
                  messages: updatedMessages,
                  activeTools: [
                    "quickEdit",
                    "finalizeWorkingFragment",
                    "getSandboxUrl"
                  ]
                };
              }
              return { messages: updatedMessages };
            },
            onFinish: async ({ providerMetadata, usage: finalUsage }) => {
              const finalCacheMetrics = extractCacheMetrics(providerMetadata);
              req.logger?.info({
                msg: "AI stream completed",
                totalSteps: stepCount,
                totalCostUSD: builderAnthropicCost,
                totalInputTokens: builderInputTokens,
                totalOutputTokens: builderOutputTokens,
                cachePerformance: {
                  tokensCreated: finalCacheMetrics.cacheCreationTokens,
                  tokensRead: finalCacheMetrics.cacheReadTokens,
                  savingsPercent: finalCacheMetrics.cacheSavingsPercent,
                  creationCostPercent: finalCacheMetrics.cacheCreationCostPercent
                }
              });
              if (creditsAlreadyDeducted) {
                req.logger?.info({
                  msg: "Skipping credit deduction in onFinish - already deducted during abort",
                  userId,
                  projectId,
                  totalCostUSD: builderAnthropicCost
                });
              } else if (message.role === "user" && builderAnthropicCost > 0) {
                const creditsToCharge = isFirstPromptPricing ? calculateCreditsFromUSDFirstPrompt(builderAnthropicCost) : calculateCreditsFromUSD(builderAnthropicCost);
                const statusSuffix = wasCancelled ? " [CANCELLED BY USER]" : "";
                const marginNote = isFirstPromptPricing ? " [10% margin]" : "";
                const description = `AI Generation for "${projectName}" (complexity analysis + ${stepCount} builder steps + tools)${statusSuffix}${marginNote}`;
                try {
                  await CreditManager.deductCredits(
                    userId,
                    creditsToCharge,
                    "AI_GENERATION",
                    description,
                    {
                      projectId,
                      projectName,
                      messageId: assistantMessageId,
                      totalSteps: stepCount,
                      totalCostUSD: builderAnthropicCost,
                      creditsCharged: creditsToCharge,
                      category: complexityAnalysis?.category,
                      wasCancelled,
                      isFirstPrompt: isFirstPromptPricing,
                      marginApplied: isFirstPromptPricing ? "10%" : "50%"
                    }
                  );
                  req.logger?.info({
                    msg: wasCancelled ? "AI generation cancelled - Credits deducted for partial work (includes complexity analysis, builder steps, and image generation)" : "AI generation complete - Credits deducted (includes complexity analysis, builder steps, and image generation)",
                    model: modelToUse,
                    totalSteps: stepCount,
                    totalInputTokens: builderInputTokens,
                    totalOutputTokens: builderOutputTokens,
                    totalCostUSD: builderAnthropicCost,
                    creditsCharged: creditsToCharge,
                    wasCancelled,
                    isFirstPrompt: isFirstPromptPricing,
                    marginApplied: isFirstPromptPricing ? "10%" : "50%",
                    conversionRate: isFirstPromptPricing ? "$1 = 4 credits, 1.1x markup = 4.4 credits per $1, rounded UP" : "$1 = 4 credits, 2x markup = 8 credits per $1, rounded UP"
                  });
                } catch (error) {
                  const errorMessage = error instanceof Error ? error.message : "Unknown error";
                  const isInsufficientCredits = errorMessage.includes(
                    "Insufficient credits"
                  );
                  if (isInsufficientCredits) {
                    req.logger?.warn({
                      msg: "Insufficient credits for full deduction - attempting partial deduction",
                      userId,
                      projectId,
                      totalCostUSD: builderAnthropicCost,
                      creditsToCharge,
                      error: errorMessage
                    });
                    try {
                      const affordability = await CreditManager.canAffordOperation(
                        userId,
                        creditsToCharge
                      );
                      if (!affordability.canAfford && affordability.currentBalance !== void 0) {
                        const minimumBalance = CreditManager.getMinimumBalance();
                        const maxAffordable = Math.max(
                          0,
                          Math.floor(
                            (affordability.currentBalance - minimumBalance) * 100
                          ) / 100
                        );
                        if (maxAffordable > 0) {
                          await CreditManager.deductCredits(
                            userId,
                            maxAffordable,
                            "AI_GENERATION",
                            `${description} [PARTIAL - user could only afford ${maxAffordable} of ${creditsToCharge} credits]`,
                            {
                              projectId,
                              projectName,
                              totalSteps: stepCount,
                              totalCostUSD: builderAnthropicCost,
                              creditsCharged: maxAffordable,
                              originalCreditsToCharge: creditsToCharge,
                              category: complexityAnalysis?.category,
                              wasCancelled,
                              partialDeduction: true
                            }
                          );
                          req.logger?.warn({
                            msg: "Partial credit deduction successful",
                            userId,
                            projectId,
                            originalCreditsToCharge: creditsToCharge,
                            actualCreditsCharged: maxAffordable,
                            shortfall: creditsToCharge - maxAffordable,
                            totalCostUSD: builderAnthropicCost
                          });
                        } else {
                          req.logger?.error({
                            msg: "CRITICAL: User has no credits available for partial deduction",
                            userId,
                            projectId,
                            currentBalance: affordability.currentBalance,
                            minimumBalance,
                            totalCostUSD: builderAnthropicCost,
                            creditsToCharge
                          });
                        }
                      }
                    } catch (fallbackError) {
                      req.logger?.error({
                        msg: "CRITICAL: Both full and partial credit deduction failed",
                        userId,
                        projectId,
                        totalCostUSD: builderAnthropicCost,
                        creditsToCharge,
                        originalError: errorMessage,
                        fallbackError: fallbackError instanceof Error ? fallbackError.message : "Unknown error"
                      });
                    }
                  } else {
                    req.logger?.error({
                      msg: "CRITICAL: Credit deduction failed (non-credit error)",
                      userId,
                      projectId,
                      totalCostUSD: builderAnthropicCost,
                      creditsToCharge,
                      error: errorMessage
                    });
                  }
                }
              } else {
                req.logger?.info({
                  msg: "AI Builder generation complete - No credits deducted",
                  model: modelToUse,
                  totalSteps: stepCount,
                  reason: message.role !== "user" ? "Assistant message" : "Zero cost"
                });
              }
            }
          });
          result.consumeStream();
          try {
            writer.merge(
              result.toUIMessageStream({
                sendStart: false,
                sendReasoning: true
              })
            );
          } catch (streamError) {
            req.logger?.error({
              msg: "Error converting to UI message stream (likely validation error)",
              error: streamError instanceof Error ? streamError.message : String(streamError),
              stack: streamError instanceof Error ? streamError.stack : void 0
            });
            throw streamError;
          }
          try {
            await result.response;
          } catch (responseError) {
            req.logger?.error({
              msg: "Error in stream response",
              error: responseError instanceof Error ? responseError.message : String(responseError),
              stack: responseError instanceof Error ? responseError.stack : void 0
            });
            throw responseError;
          }
        },
        onError: (error) => {
          const isError = error instanceof Error;
          const extra = {};
          if (isError) {
            extra.name = error.name;
            extra.stack = error.stack;
            const anyError = error;
            if (anyError.status) extra.status = anyError.status;
            if (anyError.code) extra.code = anyError.code;
            if (anyError.cause) extra.cause = anyError.cause;
            if (anyError.response) {
              extra.responseStatus = anyError.response.status;
              extra.responseStatusText = anyError.response.statusText;
            }
            if (anyError.providerMetadata) {
              extra.providerMetadata = anyError.providerMetadata;
            }
          }
          req.logger?.error({
            msg: "Stream error from provider",
            requestId,
            projectId,
            errorMessage: isError ? error.message : String(error),
            ...extra
          });
          void finalizeOnAbort(projectId, streamId, toolsContext);
          return error instanceof Error ? error.message : String(error);
        },
        onFinish: async ({ responseMessage }) => {
          try {
            if (aborted) {
              req.logger?.info({
                msg: "Chat stream aborted - message already saved incrementally",
                messageId: assistantMessageId,
                partsCount: accumulatedParts.length
              });
              await finalizeOnAbort(projectId, streamId, toolsContext);
              return;
            }
            const content = JSON.stringify(responseMessage.parts);
            if (assistantMessageId && content && responseMessage.parts.length > 0) {
              await prisma.v2Message.update({
                where: { id: assistantMessageId },
                data: {
                  content,
                  updatedAt: /* @__PURE__ */ new Date()
                }
              });
              req.logger?.info({
                msg: "Assistant message finalized",
                messageId: assistantMessageId,
                partsCount: responseMessage.parts.length
              });
            } else if (!assistantMessageId) {
              req.logger?.warn({
                msg: "No assistant message ID found - upserting message"
              });
              if (content && responseMessage.parts.length > 0) {
                await prisma.v2Message.upsert({
                  where: { id: responseMessage.id },
                  create: {
                    id: responseMessage.id,
                    role: "ASSISTANT",
                    content,
                    projectId
                  },
                  update: {
                    content,
                    updatedAt: /* @__PURE__ */ new Date()
                  }
                });
              }
            }
            await finalizeOnFinish(projectId, streamId);
            req.logger?.info("Chat session completed");
          } catch (error) {
            req.logger?.error({
              msg: "Error in onFinish",
              error: error instanceof Error ? error.message : "Unknown error"
            });
          }
        }
      });
      const webResponse = createUIMessageStreamResponse({ stream });
      const streamBody = webResponse.body;
      if (!streamBody) {
        throw new Error("Failed to create stream body");
      }
      Object.entries(UI_MESSAGE_STREAM_HEADERS).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
      if (streamContext) {
        req.logger?.info("Using resumable stream with Redis");
        const textDecoder = new TextDecoder();
        const BATCH_INTERVAL_MS = 50;
        const BATCH_SIZE_BYTES = 4096;
        let buffer = [];
        let bufferSize = 0;
        let timer = null;
        const flushBuffer = (controller) => {
          if (timer) {
            clearTimeout(timer);
            timer = null;
          }
          if (buffer.length > 0) {
            controller.enqueue(buffer.join(""));
            buffer = [];
            bufferSize = 0;
          }
        };
        const batchedStream = streamBody.pipeThrough(
          new TransformStream({
            transform(chunk, controller) {
              const text = typeof chunk === "string" ? chunk : textDecoder.decode(chunk, { stream: true });
              controller.enqueue(text);
            }
          })
        ).pipeThrough(
          new TransformStream({
            transform(chunk, controller) {
              buffer.push(chunk);
              bufferSize += chunk.length;
              if (bufferSize >= BATCH_SIZE_BYTES) {
                flushBuffer(controller);
                return;
              }
              if (!timer) {
                timer = setTimeout(() => {
                  flushBuffer(controller);
                }, BATCH_INTERVAL_MS);
              }
            },
            flush(controller) {
              flushBuffer(controller);
            }
          })
        );
        const resumableStream = await streamContext.createNewResumableStream(
          streamId,
          () => batchedStream
        );
        if (!resumableStream) {
          throw new Error("Failed to create resumable stream");
        }
        try {
          await resumableStream.pipeTo(
            new WritableStream({
              write(chunk) {
                res.write(chunk);
              },
              close() {
                res.end();
              },
              abort(error) {
                req.logger?.error({
                  msg: "Resumable stream aborted",
                  error: error instanceof Error ? error.message : String(error)
                });
                if (!res.headersSent) {
                  res.status(500).end();
                } else {
                  res.end();
                }
              }
            })
          );
        } catch (error) {
          req.logger?.error({
            msg: "Resumable stream pump error",
            error: error instanceof Error ? error.message : String(error)
          });
          if (!res.headersSent) {
            res.status(500).end();
          } else {
            res.end();
          }
        }
      } else {
        req.logger?.info("Streaming directly (no Redis, resumption disabled)");
        try {
          await streamBody.pipeTo(
            new WritableStream({
              write(chunk) {
                res.write(chunk);
              },
              close() {
                res.end();
              },
              abort(error) {
                req.logger?.error({
                  msg: "Direct stream aborted",
                  error: error instanceof Error ? error.message : String(error)
                });
                if (!res.headersSent) {
                  res.status(500).end();
                } else {
                  res.end();
                }
              }
            })
          );
        } catch (error) {
          req.logger?.error({
            msg: "Direct stream pump error",
            error: error instanceof Error ? error.message : String(error)
          });
          if (!res.headersSent) {
            res.status(500).end();
          } else {
            res.end();
          }
        }
      }
    } catch (error) {
      req.logger?.error({
        msg: "Chat request error",
        requestId,
        error: error instanceof Error ? error.message : "Unknown error"
      });
      if (!res.headersSent) {
        const response = {
          success: false,
          error: error instanceof Error ? error.message : "Internal server error"
        };
        return res.status(500).json(response);
      }
    }
  }
);
router5.get("/health", async (_req, res) => {
  const response = {
    success: true,
    data: {
      status: "ok",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      service: "chat"
    }
  };
  res.json(response);
});
router5.get(
  "/:projectId/stream",
  validateSession,
  validateProjectAccess,
  async (req, res) => {
    const requestId = `resume-${Date.now()}`;
    req.logger?.info({
      msg: "Stream resumption request received",
      requestId
    });
    try {
      const { projectId } = req.params;
      if (!projectId) {
        req.logger?.warn({
          msg: "Project ID is required for stream resumption",
          requestId
        });
        return res.status(400).send("Project ID is required");
      }
      req.logger?.info({
        msg: "Stream resumption request",
        requestId,
        projectId,
        userEmail: req.user?.email || "unknown"
      });
      const project = await prisma.project.findFirst({
        where: {
          id: projectId
        }
      });
      if (!project) {
        req.logger?.warn({
          msg: "Project not found or access denied",
          requestId,
          projectId
        });
        return res.status(404).send("Project not found or access denied");
      }
      const recentStreamId = project.activeStreamId;
      req.logger?.info({
        msg: "Active stream ID from DB",
        requestId,
        activeStreamId: recentStreamId || "NONE"
      });
      if (!recentStreamId) {
        req.logger?.info({
          msg: "No active stream found for project",
          requestId,
          projectId
        });
        return res.status(204).send();
      }
      if (!recentStreamId.startsWith(`${projectId}:`)) {
        req.logger?.error({
          msg: "Stream ID does not belong to this project",
          requestId,
          projectId,
          recentStreamId
        });
        return res.status(403).send("Invalid stream ID for this project");
      }
      req.logger?.info({
        msg: "Stream ID validated successfully",
        requestId
      });
      const redisAvailable = !!process.env.REDIS_URL;
      req.logger?.debug({
        msg: "Redis availability check",
        requestId,
        redisAvailable,
        redisUrlConfigured: !!process.env.REDIS_URL
      });
      if (!redisAvailable) {
        req.logger?.info({
          msg: "Redis not available - stream resumption disabled",
          requestId
        });
        return res.status(204).send();
      }
      req.logger?.debug({
        msg: "Creating resumable stream context",
        requestId
      });
      const streamContext = createResumableStreamContext({
        publisher: redisPublisher,
        subscriber: redisSubscriber,
        waitUntil: (promise) => {
          promise.catch((error) => {
            req.logger?.error({
              msg: "Background task error",
              requestId,
              error: error instanceof Error ? error.message : String(error)
            });
          });
        }
      });
      req.logger?.info({
        msg: "Attempting to resume stream",
        requestId,
        recentStreamId
      });
      const resumedStream = await streamContext.resumeExistingStream(recentStreamId);
      req.logger?.info({
        msg: "Stream resumption result",
        requestId,
        success: !!resumedStream
      });
      if (!resumedStream) {
        req.logger?.info({
          msg: "Stream not found or already completed in Redis",
          requestId
        });
        return res.status(204).send();
      }
      Object.entries(UI_MESSAGE_STREAM_HEADERS).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
      req.logger?.debug({
        msg: "Headers set, pumping resumed stream",
        requestId
      });
      let chunksWritten = 0;
      try {
        await resumedStream.pipeTo(
          new WritableStream({
            write(value) {
              if (chunksWritten === 0) {
                req.logger?.debug({
                  msg: "First chunk received",
                  requestId,
                  chunkType: typeof value,
                  chunkLength: typeof value === "string" ? value.length : 0
                });
              }
              res.write(value);
              chunksWritten++;
              if (chunksWritten % 10 === 0) {
                req.logger?.debug({
                  msg: "Stream progress",
                  requestId,
                  chunksWritten
                });
              }
            },
            close() {
              req.logger?.info({
                msg: "Stream complete",
                requestId,
                chunksWritten
              });
              res.end();
            },
            abort(error) {
              req.logger?.error({
                msg: "Stream aborted",
                requestId,
                chunksWritten,
                error: error instanceof Error ? error.message : String(error)
              });
              if (!res.headersSent) {
                res.status(500).end();
              } else {
                res.end();
              }
            }
          })
        );
      } catch (error) {
        req.logger?.error({
          msg: "Stream pump error",
          requestId,
          chunksWritten,
          error: error instanceof Error ? error.message : String(error)
        });
        if (!res.headersSent) {
          res.status(500).end();
        } else {
          res.end();
        }
      }
    } catch (error) {
      req.logger?.error({
        msg: "Stream resumption error",
        requestId,
        error: error instanceof Error ? error.message : String(error)
      });
      if (!res.headersSent) {
        return res.status(500).send("Internal server error");
      }
    }
  }
);
router5.delete(
  "/:projectId/stream",
  validateSession,
  validateProjectAccess,
  async (req, res) => {
    try {
      const { projectId } = req.params;
      if (!projectId) {
        return res.status(400).send("Project ID is required");
      }
      const project = await prisma.project.findFirst({
        where: {
          id: projectId
        }
      });
      if (!project) {
        return res.status(404).send("Project not found or access denied");
      }
      req.logger?.info({
        msg: "Canceling stream for project"
      });
      await prisma.project.update({
        where: { id: projectId },
        data: {
          activeStreamId: null,
          activeStreamStartedAt: null
        }
      });
      const projectWithStream = await prisma.project.findFirst({
        where: { id: projectId },
        select: { activeStreamId: true }
      });
      const streamId = projectWithStream?.activeStreamId || null;
      const abortedImmediately = streamId ? abortChat(streamId) : false;
      await safeClearActiveStream(projectId);
      req.logger?.info({
        msg: "Stream cancellation signal sent",
        abortedImmediately
      });
      return res.status(200).send();
    } catch (error) {
      req.logger?.error({
        msg: "Stream cancellation error",
        error: error instanceof Error ? error.message : String(error)
      });
      return res.status(500).send("Internal server error");
    }
  }
);
router5.post(
  "/:projectId/hitl-confirm",
  validateSession,
  validateProjectAccess,
  async (req, res) => {
    try {
      const { projectId } = req.params;
      const { toolCallId, toolName, confirmed, projectName, reason } = req.body;
      if (!projectId) {
        return res.status(400).json({ success: false, error: "Project ID is required" });
      }
      if (!toolCallId || !toolName) {
        return res.status(400).json({
          success: false,
          error: "toolCallId and toolName are required"
        });
      }
      req.logger?.info({
        msg: "HITL confirmation request",
        projectId,
        toolCallId,
        toolName,
        confirmed
      });
      if (toolName !== "deployToShipperCloud") {
        return res.status(400).json({
          success: false,
          error: `HITL confirmation not supported for tool: ${toolName}`
        });
      }
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: "User not authenticated" });
      }
      const messages = await prisma.v2Message.findMany({
        where: { projectId },
        orderBy: { createdAt: "desc" },
        take: 10
        // Check recent messages
      });
      let targetMessage = null;
      let targetPartIndex = -1;
      for (const msg of messages) {
        try {
          const parts2 = JSON.parse(msg.content);
          const partIndex = parts2.findIndex(
            (p) => p.type === "tool-invocation" && (p.toolCallId === toolCallId || p.toolInvocationId === toolCallId)
          );
          if (partIndex !== -1) {
            targetMessage = msg;
            targetPartIndex = partIndex;
            break;
          }
        } catch {
          continue;
        }
      }
      if (!targetMessage || targetPartIndex === -1) {
        return res.status(404).json({
          success: false,
          error: "Tool invocation not found"
        });
      }
      const parts = JSON.parse(targetMessage.content);
      if (confirmed) {
        req.logger?.info({
          msg: "Executing HITL deployment",
          projectId,
          projectName
        });
        const { executeShipperCloudDeploymentWithFiles: executeShipperCloudDeploymentWithFiles2 } = await import("./shipper-cloud-hitl-HGBJAUBP.js");
        const deployResult = await executeShipperCloudDeploymentWithFiles2(
          projectId,
          userId,
          projectName || "Untitled"
        );
        parts[targetPartIndex] = {
          ...parts[targetPartIndex],
          state: "result",
          result: {
            status: deployResult.success ? "success" : "error",
            success: deployResult.success,
            message: deployResult.success ? deployResult.isExisting ? "Shipper Cloud deployment already exists. Convex Auth files have been set up." : "Successfully provisioned Shipper Cloud backend with Convex Auth!" : deployResult.error || "Deployment failed",
            deploymentUrl: deployResult.deploymentUrl,
            siteUrl: deployResult.siteUrl,
            deploymentName: deployResult.deploymentName,
            isExisting: deployResult.isExisting,
            filesCreated: deployResult.filesCreated,
            packagesInstalled: deployResult.packagesInstalled,
            packagesInstalledList: deployResult.packagesInstalledList,
            envVarsSet: deployResult.envVarsSet,
            authClientPath: deployResult.authClientPath,
            nextSteps: deployResult.success ? [
              "\u26A0\uFE0F STOP! Your VERY NEXT action MUST be: call deployConvex tool",
              "The convex/_generated/api types DO NOT EXIST yet - you will get import errors if you create components now!",
              "1. IMMEDIATELY call deployConvex tool NOW (before creating ANY files)",
              "2. WAIT for deployConvex to succeed",
              "3. ONLY THEN: Update src/main.tsx to use ConvexAuthProvider (import from @convex-dev/auth/react)",
              "4. ONLY THEN: Create sign-in components using useAuthActions hook from @convex-dev/auth/react"
            ] : void 0,
            criticalWarning: deployResult.success ? "\u{1F6AB} DO NOT create ANY React components yet! Call deployConvex FIRST!" : void 0,
            error: deployResult.success ? void 0 : deployResult.error
          }
        };
        await prisma.v2Message.update({
          where: { id: targetMessage.id },
          data: { content: JSON.stringify(parts) }
        });
        req.logger?.info({
          msg: "HITL deployment completed",
          projectId,
          success: deployResult.success,
          deploymentUrl: deployResult.deploymentUrl
        });
        return res.json({
          success: true,
          result: parts[targetPartIndex].result
        });
      } else {
        parts[targetPartIndex] = {
          ...parts[targetPartIndex],
          state: "result",
          result: {
            status: "denied",
            success: false,
            message: "Shipper Cloud deployment cancelled by user"
          }
        };
        await prisma.v2Message.update({
          where: { id: targetMessage.id },
          data: { content: JSON.stringify(parts) }
        });
        req.logger?.info({
          msg: "HITL deployment denied by user",
          projectId
        });
        return res.json({
          success: true,
          result: parts[targetPartIndex].result
        });
      }
    } catch (error) {
      req.logger?.error({
        msg: "HITL confirmation error",
        error: error instanceof Error ? error.message : String(error)
      });
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error"
      });
    }
  }
);
var chat_default = router5;

// src/routes/upload.ts
init_esm_shims();
import { Router as Router6 } from "express";
import { z as z7 } from "zod";

// src/services/upload-service.ts
init_esm_shims();

// src/services/r2-client.ts
init_esm_shims();
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
var R2_CONFIG = {
  BUCKET_NAME: process.env.CLOUDFLARE_R2_BUCKET_NAME || "shipper-uploads",
  PUBLIC_URL: process.env.CLOUDFLARE_R2_PUBLIC_URL || "",
  ACCOUNT_ID: process.env.CLOUDFLARE_R2_ACCOUNT_ID || "",
  ACCESS_KEY_ID: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || "",
  SECRET_ACCESS_KEY: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || "",
  REGION: "auto"
  // R2 uses 'auto' region
};
var R2Client = class {
  constructor() {
    this.client = new S3Client({
      region: R2_CONFIG.REGION,
      endpoint: `https://${R2_CONFIG.ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_CONFIG.ACCESS_KEY_ID,
        secretAccessKey: R2_CONFIG.SECRET_ACCESS_KEY
      }
    });
    this.bucket = R2_CONFIG.BUCKET_NAME;
  }
  /**
   * Generate presigned URL for direct client upload
   */
  async generatePresignedUploadUrl(key, mimeType, expiresIn = 3600) {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: mimeType
    });
    return getSignedUrl(this.client, command, { expiresIn });
  }
  /**
   * Upload file directly (server-side)
   */
  async uploadFile(key, body, mimeType, metadata) {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: mimeType,
      Metadata: metadata
    });
    await this.client.send(command);
  }
  /**
   * Delete file
   */
  async deleteFile(key) {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key
    });
    await this.client.send(command);
  }
  /**
   * Check if file exists
   */
  async fileExists(key) {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key
      });
      await this.client.send(command);
      return true;
    } catch {
      return false;
    }
  }
  /**
   * Get public URL for file
   */
  getPublicUrl(key) {
    return `${R2_CONFIG.PUBLIC_URL}/${key}`;
  }
  /**
   * Generate storage key with organization
   * Format: {type}/users/{userId}/{timestamp}-{randomId}-{filename}
   * Or: {type}/teams/{teamId}/{timestamp}-{randomId}-{filename}
   */
  static generateStorageKey(uploadType, userId, filename, teamId) {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const sanitized = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
    const parts = [uploadType.toLowerCase()];
    if (teamId) {
      parts.push("teams", teamId);
    } else {
      parts.push("users", userId);
    }
    parts.push(`${timestamp}-${randomId}-${sanitized}`);
    return parts.join("/");
  }
};

// src/services/upload-service.ts
var UPLOAD_CONFIGS = {
  IMAGE: {
    maxSize: 10 * 1024 * 1024,
    // 10MB
    allowedMimeTypes: [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/gif",
      "image/webp",
      "image/svg+xml"
    ]
  },
  DOCUMENT: {
    maxSize: 10 * 1024 * 1024,
    // 10MB
    allowedMimeTypes: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "text/markdown",
      "application/json",
      "text/javascript",
      "text/typescript",
      "text/jsx",
      "text/tsx",
      "text/css",
      "text/html",
      "text/xml",
      "application/javascript",
      "application/typescript",
      "application/x-javascript",
      "application/x-typescript",
      "text/*"
      // Allow all text files (code files often have text/* MIME types)
    ]
  },
  VIDEO: {
    maxSize: 100 * 1024 * 1024,
    // 100MB
    allowedMimeTypes: ["video/mp4", "video/webm", "video/quicktime"]
  },
  AUDIO: {
    maxSize: 50 * 1024 * 1024,
    // 50MB
    allowedMimeTypes: ["audio/mpeg", "audio/wav", "audio/ogg", "audio/webm"]
  },
  OTHER: {
    maxSize: 10 * 1024 * 1024,
    // 10MB
    allowedMimeTypes: ["*/*"]
  }
};
function getUploadTypeFromMimeType(mimeType) {
  if (mimeType.startsWith("image/")) return "IMAGE";
  if (mimeType.startsWith("video/")) return "VIDEO";
  if (mimeType.startsWith("audio/")) return "AUDIO";
  if (mimeType === "application/pdf" || mimeType.includes("document") || mimeType.startsWith("text/")) {
    return "DOCUMENT";
  }
  return "OTHER";
}
function validateFile(file, uploadType) {
  const config = UPLOAD_CONFIGS[uploadType];
  if (file.size > config.maxSize) {
    return {
      valid: false,
      error: `File size exceeds ${config.maxSize / (1024 * 1024)}MB limit`
    };
  }
  const isAllowedMimeType = config.allowedMimeTypes.some((allowed) => {
    if (allowed === "*/*") return true;
    if (allowed.endsWith("/*")) {
      return file.type.startsWith(allowed.replace("/*", ""));
    }
    return file.type === allowed;
  });
  if (!isAllowedMimeType) {
    return {
      valid: false,
      error: "File type not allowed"
    };
  }
  return { valid: true };
}
var UploadService = class {
  constructor() {
    this.r2Client = new R2Client();
  }
  /**
   * Request presigned upload URL (Step 1 of upload flow)
   */
  async requestPresignedUpload(request, userId) {
    let uploadType = request.uploadType;
    if (!uploadType || uploadType === "OTHER") {
      uploadType = getUploadTypeFromMimeType(request.mimeType);
    }
    const validation = validateFile(
      {
        size: request.size,
        type: request.mimeType
      },
      uploadType
    );
    if (!validation.valid) {
      throw new Error(validation.error || "Invalid file");
    }
    if (request.teamId) {
      const teamMember = await prisma.teamMember.findFirst({
        where: { teamId: request.teamId, userId }
      });
      if (!teamMember) {
        throw new Error("Access denied to team");
      }
    }
    const storageKey = R2Client.generateStorageKey(
      uploadType,
      userId,
      request.filename,
      request.teamId
    );
    const upload = await prisma.upload.create({
      data: {
        filename: request.filename,
        originalName: request.filename,
        mimeType: request.mimeType,
        size: request.size,
        storageKey,
        url: this.r2Client.getPublicUrl(storageKey),
        uploadType,
        userId,
        teamId: request.teamId,
        width: request.metadata?.width,
        height: request.metadata?.height,
        tags: request.metadata?.tags || [],
        description: request.metadata?.description,
        usedInProjects: []
      }
    });
    const presignedUrl = await this.r2Client.generatePresignedUploadUrl(
      storageKey,
      request.mimeType,
      3600
      // 1 hour expiry
    );
    return {
      uploadId: upload.id,
      presignedUrl,
      storageKey,
      expiresAt: new Date(Date.now() + 3600 * 1e3)
    };
  }
  /**
   * Complete upload (Step 2 - after client uploads to R2)
   */
  async completeUpload(request, userId) {
    const upload = await prisma.upload.findUnique({
      where: { id: request.uploadId }
    });
    if (!upload) {
      throw new Error("Upload not found");
    }
    if (upload.userId !== userId) {
      throw new Error("Access denied");
    }
    const exists = await this.r2Client.fileExists(upload.storageKey);
    if (!exists) {
      throw new Error("File not found in storage");
    }
    const updatedUpload = await prisma.upload.update({
      where: { id: request.uploadId },
      data: {
        updatedAt: /* @__PURE__ */ new Date()
      }
    });
    return this.mapToUpload(updatedUpload);
  }
  /**
   * Get user's media library with filters
   */
  async getLibrary(userId, filters) {
    const where = {
      userId,
      deletedAt: null
    };
    if (filters.uploadType) {
      where.uploadType = filters.uploadType;
    }
    if (filters.tags && filters.tags.length > 0) {
      where.tags = {
        hasSome: filters.tags
      };
    }
    if (filters.search) {
      where.OR = [
        { filename: { contains: filters.search, mode: "insensitive" } },
        { originalName: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } }
      ];
    }
    const limit = filters.limit || 50;
    const uploads = await prisma.upload.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      // Take one extra to determine if there's more
      ...filters.cursor && {
        cursor: { id: filters.cursor },
        skip: 1
      }
    });
    const hasMore = uploads.length > limit;
    const results = hasMore ? uploads.slice(0, -1) : uploads;
    const nextCursor = hasMore ? results[results.length - 1]?.id : void 0;
    return {
      uploads: results.map((u) => this.mapToUpload(u)),
      nextCursor
    };
  }
  /**
   * Get single upload
   */
  async getUpload(uploadId, userId) {
    const upload = await prisma.upload.findFirst({
      where: {
        id: uploadId,
        OR: [{ userId }, { team: { members: { some: { userId } } } }],
        deletedAt: null
      }
    });
    if (!upload) {
      throw new Error("Upload not found");
    }
    return this.mapToUpload(upload);
  }
  /**
   * Update upload metadata
   */
  async updateMetadata(request, userId) {
    const upload = await prisma.upload.findUnique({
      where: { id: request.uploadId }
    });
    if (!upload) {
      throw new Error("Upload not found");
    }
    if (upload.userId !== userId) {
      throw new Error("Access denied");
    }
    const updated = await prisma.upload.update({
      where: { id: request.uploadId },
      data: {
        tags: request.tags,
        description: request.description,
        updatedAt: /* @__PURE__ */ new Date()
      }
    });
    return this.mapToUpload(updated);
  }
  /**
   * Delete upload (soft delete)
   */
  async deleteUpload(uploadId, userId) {
    const upload = await prisma.upload.findUnique({
      where: { id: uploadId }
    });
    if (!upload) {
      throw new Error("Upload not found");
    }
    if (upload.userId !== userId) {
      throw new Error("Access denied");
    }
    await prisma.upload.update({
      where: { id: uploadId },
      data: { deletedAt: /* @__PURE__ */ new Date() }
    });
    this.r2Client.deleteFile(upload.storageKey).catch((err) => {
      console.error("Failed to delete file from R2:", err);
    });
  }
  /**
   * Mark upload as used in a project
   */
  async markAsUsed(uploadId, projectId, userId) {
    const upload = await prisma.upload.findFirst({
      where: {
        id: uploadId,
        OR: [{ userId }, { team: { members: { some: { userId } } } }]
      }
    });
    if (!upload) {
      throw new Error("Upload not found");
    }
    const usedInProjects = upload.usedInProjects;
    if (!usedInProjects.includes(projectId)) {
      await prisma.upload.update({
        where: { id: uploadId },
        data: {
          usedInProjects: [...usedInProjects, projectId],
          lastUsedAt: /* @__PURE__ */ new Date()
        }
      });
    }
  }
  /**
   * Server-side upload from base64 (for migration/backward compatibility)
   */
  async uploadFromBase64(base64Data, filename, mimeType, userId, teamId) {
    const buffer = Buffer.from(base64Data, "base64");
    const uploadType = getUploadTypeFromMimeType(mimeType);
    const config = UPLOAD_CONFIGS[uploadType];
    if (buffer.length > config.maxSize) {
      throw new Error(
        `File size exceeds ${config.maxSize / (1024 * 1024)}MB limit`
      );
    }
    const storageKey = R2Client.generateStorageKey(
      uploadType,
      userId,
      filename,
      teamId
    );
    await this.r2Client.uploadFile(storageKey, buffer, mimeType);
    const upload = await prisma.upload.create({
      data: {
        filename,
        originalName: filename,
        mimeType,
        size: buffer.length,
        storageKey,
        url: this.r2Client.getPublicUrl(storageKey),
        uploadType,
        userId,
        teamId,
        tags: [],
        usedInProjects: []
      }
    });
    return this.mapToUpload(upload);
  }
  /**
   * Map Prisma model to Upload type
   */
  mapToUpload(upload) {
    return {
      id: upload.id,
      filename: upload.filename,
      originalName: upload.originalName,
      mimeType: upload.mimeType,
      size: upload.size,
      url: upload.url,
      thumbnailUrl: upload.thumbnailUrl || void 0,
      uploadType: upload.uploadType,
      width: upload.width || void 0,
      height: upload.height || void 0,
      tags: upload.tags || [],
      description: upload.description || void 0,
      usedInProjects: upload.usedInProjects || [],
      lastUsedAt: upload.lastUsedAt || void 0,
      createdAt: upload.createdAt
    };
  }
};

// src/routes/upload.ts
var router6 = Router6();
var uploadService = new UploadService();
router6.use(validateSession);
var presignedUploadSchema = z7.object({
  filename: z7.string().min(1),
  mimeType: z7.string().min(1),
  size: z7.number().positive(),
  uploadType: z7.enum(["IMAGE", "DOCUMENT", "VIDEO", "AUDIO", "OTHER"]),
  teamId: z7.string().optional(),
  metadata: z7.object({
    width: z7.number().optional(),
    height: z7.number().optional(),
    tags: z7.array(z7.string()).optional(),
    description: z7.string().optional()
  }).optional()
});
var completeUploadSchema = z7.object({
  uploadId: z7.string()
});
var libraryFiltersSchema = z7.object({
  uploadType: z7.enum(["IMAGE", "DOCUMENT", "VIDEO", "AUDIO", "OTHER"]).optional(),
  tags: z7.array(z7.string()).optional(),
  search: z7.string().optional(),
  limit: z7.number().min(1).max(100).optional(),
  cursor: z7.string().optional()
});
var updateMetadataSchema = z7.object({
  uploadId: z7.string(),
  tags: z7.array(z7.string()).optional(),
  description: z7.string().optional()
});
router6.post("/request-presigned", async (req, res) => {
  try {
    const parsed = presignedUploadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request body",
        details: parsed.error.issues
      });
    }
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized"
      });
    }
    const result = await uploadService.requestPresignedUpload(parsed.data, req.user.id);
    req.logger?.info({ uploadId: result.uploadId, filename: parsed.data.filename }, "Presigned upload requested");
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    req.logger?.error({ error }, "Error requesting presigned upload");
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to request upload"
    });
  }
});
router6.post("/complete", async (req, res) => {
  try {
    const parsed = completeUploadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request body"
      });
    }
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized"
      });
    }
    const result = await uploadService.completeUpload(parsed.data, req.user.id);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    req.logger?.error({ error }, "Error completing upload");
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to complete upload"
    });
  }
});
router6.get("/library", async (req, res) => {
  try {
    const parsed = libraryFiltersSchema.safeParse({
      uploadType: req.query.uploadType,
      tags: req.query.tags ? JSON.parse(req.query.tags) : void 0,
      search: req.query.search,
      limit: req.query.limit ? parseInt(req.query.limit) : void 0,
      cursor: req.query.cursor
    });
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid query parameters"
      });
    }
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized"
      });
    }
    const result = await uploadService.getLibrary(req.user.id, parsed.data);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    req.logger?.error({ error }, "Error getting library");
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to get library"
    });
  }
});
router6.get("/:uploadId", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized"
      });
    }
    const result = await uploadService.getUpload(req.params.uploadId, req.user.id);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    req.logger?.error({ error }, "Error getting upload");
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to get upload"
    });
  }
});
router6.patch("/metadata", async (req, res) => {
  try {
    const parsed = updateMetadataSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request body"
      });
    }
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized"
      });
    }
    const result = await uploadService.updateMetadata(parsed.data, req.user.id);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    req.logger?.error({ error }, "Error updating metadata");
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to update metadata"
    });
  }
});
router6.delete("/:uploadId", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized"
      });
    }
    await uploadService.deleteUpload(req.params.uploadId, req.user.id);
    res.json({
      success: true
    });
  } catch (error) {
    req.logger?.error({ error }, "Error deleting upload");
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete upload"
    });
  }
});
router6.post("/mark-used", async (req, res) => {
  try {
    const { uploadId, projectId } = req.body;
    if (!uploadId || !projectId) {
      return res.status(400).json({
        success: false,
        error: "uploadId and projectId are required"
      });
    }
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized"
      });
    }
    await uploadService.markAsUsed(uploadId, projectId, req.user.id);
    res.json({
      success: true
    });
  } catch (error) {
    req.logger?.error({ error }, "Error marking upload as used");
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to mark upload as used"
    });
  }
});
var upload_default = router6;

// src/routes/domains.ts
init_esm_shims();
import { Router as Router7 } from "express";
import { timingSafeEqual } from "crypto";
var router7 = Router7();
router7.get("/lookup", async (req, res) => {
  try {
    const apiKey = req.headers["x-api-key"];
    const workerApiKey = process.env.WORKER_API_KEY;
    if (!workerApiKey) {
      console.error("[Domains] WORKER_API_KEY not configured!");
      return res.status(500).json({ error: "Server configuration error" });
    }
    let isAuthorized = false;
    if (apiKey && typeof apiKey === "string") {
      const expectedKeyBuffer = Buffer.from(workerApiKey);
      const providedKeyBuffer = Buffer.from(apiKey);
      if (expectedKeyBuffer.length === providedKeyBuffer.length) {
        isAuthorized = timingSafeEqual(expectedKeyBuffer, providedKeyBuffer);
      }
    }
    if (!isAuthorized) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const { domain } = req.query;
    if (!domain || typeof domain !== "string") {
      return res.status(400).json({ error: "Missing domain parameter" });
    }
    const customDomain = await prisma.customDomain.findFirst({
      where: {
        domain,
        isPrimary: true,
        status: "ACTIVE"
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            deploymentUrl: true,
            paymentStatus: true,
            gracePeriodEnds: true
          }
        }
      }
    });
    if (!customDomain) {
      return res.status(404).json({
        error: "Domain not found or not active",
        domain
      });
    }
    const deploymentUrl = forceHttpsForDeployments(
      customDomain.project.deploymentUrl || "",
      "DomainsAPI"
    );
    return res.json({
      success: true,
      domain: customDomain.domain,
      project: {
        id: customDomain.project.id,
        name: customDomain.project.name,
        deploymentUrl,
        paymentStatus: customDomain.project.paymentStatus,
        gracePeriodEnds: customDomain.project.gracePeriodEnds
      }
    });
  } catch (error) {
    console.error("[Domains] Error looking up domain:", error);
    return res.status(500).json({ error: "Failed to lookup domain" });
  }
});
router7.get("/metadata/:projectId", async (req, res) => {
  try {
    const apiKey = req.headers["x-api-key"];
    const workerApiKey = process.env.WORKER_API_KEY;
    if (!workerApiKey) {
      console.error("[Domains] WORKER_API_KEY not configured!");
      return res.status(500).json({ error: "Server configuration error" });
    }
    let isAuthorized = false;
    if (apiKey && typeof apiKey === "string") {
      const expectedKeyBuffer = Buffer.from(workerApiKey);
      const providedKeyBuffer = Buffer.from(apiKey);
      if (expectedKeyBuffer.length === providedKeyBuffer.length) {
        isAuthorized = timingSafeEqual(expectedKeyBuffer, providedKeyBuffer);
      }
    }
    if (!isAuthorized) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const { projectId } = req.params;
    if (!projectId) {
      return res.status(400).json({ error: "Missing projectId parameter" });
    }
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        subtitle: true,
        deploymentUrl: true,
        sandboxId: true,
        daytonaSandboxId: true,
        sandboxProvider: true
      }
    });
    if (!project) {
      return res.status(404).json({
        error: "Project not found",
        projectId
      });
    }
    let title = project.name || "Shipper App";
    let description = project.subtitle || `${project.name} - Built with Shipper`;
    let iconUrl = null;
    let shareImageUrl = null;
    const provider = project.sandboxProvider || "modal";
    const sandboxId = provider === "modal" ? project.sandboxId : project.daytonaSandboxId;
    if (sandboxId && provider === "modal") {
      try {
        const { readFile: readFile2 } = await import("./modal-sandbox-manager-SIPEPTEV.js");
        const htmlContent = await readFile2(sandboxId, "index.html");
        const titleMatch = htmlContent.match(/<title>(.*?)<\/title>/);
        const iconMatch = htmlContent.match(
          /<link[^>]*rel=["']icon["'][^>]*href=["']([^"']*)["']/
        );
        const descriptionMatch = htmlContent.match(
          /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/
        );
        const ogImageMatch = htmlContent.match(
          /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["']/
        );
        if (titleMatch && titleMatch[1]) {
          title = titleMatch[1];
        }
        if (descriptionMatch && descriptionMatch[1]) {
          description = descriptionMatch[1];
        }
      } catch (error) {
        console.warn("[Domains] Failed to read metadata from sandbox:", error);
      }
    }
    const response = {
      success: true,
      projectId: project.id,
      projectName: project.name,
      deploymentUrl: project.deploymentUrl,
      metadata: {
        title,
        description,
        iconUrl,
        shareImageUrl,
        // Additional SEO metadata
        ogTitle: title,
        ogDescription: description,
        ogImage: shareImageUrl,
        twitterTitle: title,
        twitterDescription: description,
        twitterImage: shareImageUrl
      }
    };
    return res.json(response);
  } catch (error) {
    console.error("[Domains] Error fetching project metadata:", error);
    return res.status(500).json({ error: "Failed to fetch project metadata" });
  }
});
router7.post("/", async (req, res) => {
  try {
    const { projectId, domain } = req.body;
    if (!projectId || !domain) {
      return res.status(400).json({ error: "Missing required fields: projectId, domain" });
    }
    if (!CloudflareSaaSService.isValidDomain(domain)) {
      return res.status(400).json({ error: "Invalid domain format" });
    }
    const prohibitedDomains = ["example.com", "example.net", "example.org", "test.com", "localhost"];
    const domainLower = domain.toLowerCase();
    for (const prohibited of prohibitedDomains) {
      if (domainLower === prohibited || domainLower.endsWith(`.${prohibited}`)) {
        return res.status(400).json({
          error: `Domain "${domain}" is not allowed. Please use a real domain you own.`
        });
      }
    }
    if (domainLower.includes("localhost") || /^\d+\.\d+\.\d+\.\d+$/.test(domain)) {
      return res.status(400).json({
        error: "Cannot use localhost or IP addresses. Please use a real domain name."
      });
    }
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    const existingDomain = await prisma.customDomain.findUnique({
      where: { domain }
    });
    if (existingDomain) {
      return res.status(409).json({ error: "Domain already in use" });
    }
    let cfHostname;
    try {
      const cloudflare = createCloudflareService();
      cfHostname = await cloudflare.createCustomHostname(domain, projectId);
    } catch (cloudflareError) {
      console.error("[Domains] Cloudflare API error:", cloudflareError);
      let errorMessage = "Failed to create custom domain";
      if (cloudflareError.message) {
        const msg = cloudflareError.message.toLowerCase();
        if (msg.includes("example.com") || msg.includes("example.net") || msg.includes("example.org")) {
          errorMessage = "Cannot use example domains. Please use a real domain you own.";
        } else if (msg.includes("already exists") || msg.includes("duplicate")) {
          errorMessage = "This domain is already registered with Cloudflare.";
        } else if (msg.includes("invalid") || msg.includes("malformed")) {
          errorMessage = "Invalid domain format. Please check your domain name.";
        } else if (msg.includes("rate limit")) {
          errorMessage = "Too many requests. Please try again in a few minutes.";
        } else if (msg.includes("unauthorized") || msg.includes("forbidden")) {
          errorMessage = "Cloudflare authentication error. Please contact support.";
        } else {
          errorMessage = cloudflareError.message;
        }
      }
      return res.status(400).json({ error: errorMessage });
    }
    let txtName;
    let txtValue;
    if (cfHostname.ownership_verification?.name && cfHostname.ownership_verification?.value) {
      txtName = cfHostname.ownership_verification.name;
      txtValue = cfHostname.ownership_verification.value;
    } else if (cfHostname.ssl.validation_records && cfHostname.ssl.validation_records.length > 0) {
      const txtRecord = cfHostname.ssl.validation_records.find((r) => r.txt_name && r.txt_value);
      if (txtRecord) {
        txtName = txtRecord.txt_name;
        txtValue = txtRecord.txt_value;
      }
    }
    console.log("[Domains] Cloudflare response:", {
      hostname: cfHostname.hostname,
      status: cfHostname.status,
      sslStatus: cfHostname.ssl.status,
      sslMethod: cfHostname.ssl.method,
      ownershipVerification: cfHostname.ownership_verification,
      validationRecords: cfHostname.ssl.validation_records,
      txtName,
      txtValue
    });
    const customDomain = await prisma.customDomain.create({
      data: {
        projectId,
        domain,
        cloudflareHostnameId: cfHostname.id,
        status: CloudflareSaaSService.mapCloudflareStatus(cfHostname.status),
        sslStatus: CloudflareSaaSService.mapSSLStatus(cfHostname.ssl.status),
        cnameTarget: CloudflareSaaSService.getCnameTarget(cfHostname),
        txtName,
        txtValue,
        verificationErrors: cfHostname.verification_errors || [],
        lastCheckedAt: /* @__PURE__ */ new Date()
      }
    });
    console.log(`[Domains] Created custom domain ${domain} for project ${projectId}`);
    return res.status(201).json({
      success: true,
      domain: {
        id: customDomain.id,
        domain: customDomain.domain,
        status: customDomain.status,
        sslStatus: customDomain.sslStatus,
        cnameTarget: customDomain.cnameTarget,
        txtName: customDomain.txtName,
        txtValue: customDomain.txtValue,
        verificationErrors: customDomain.verificationErrors,
        isPrimary: customDomain.isPrimary,
        createdAt: customDomain.createdAt
      }
    });
  } catch (error) {
    console.error("[Domains] Error creating custom domain:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: `Failed to create custom domain: ${errorMessage}` });
  }
});
router7.get("/:projectId", async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    const domains = await prisma.customDomain.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" }
    });
    return res.json({
      success: true,
      domains: domains.map((d) => ({
        id: d.id,
        domain: d.domain,
        status: d.status,
        sslStatus: d.sslStatus,
        cnameTarget: d.cnameTarget,
        txtName: d.txtName,
        txtValue: d.txtValue,
        verificationErrors: d.verificationErrors,
        isPrimary: d.isPrimary,
        createdAt: d.createdAt,
        verifiedAt: d.verifiedAt,
        lastCheckedAt: d.lastCheckedAt
      }))
    });
  } catch (error) {
    console.error("[Domains] Error listing domains:", error);
    return res.status(500).json({ error: "Failed to list domains" });
  }
});
router7.get("/status/:domainId", async (req, res) => {
  try {
    const { domainId } = req.params;
    const domain = await prisma.customDomain.findUnique({
      where: { id: domainId }
    });
    if (!domain) {
      return res.status(404).json({ error: "Domain not found" });
    }
    if (domain.cloudflareHostnameId) {
      const cloudflare = createCloudflareService();
      const cfHostname = await cloudflare.getCustomHostname(domain.cloudflareHostnameId);
      let txtName = domain.txtName || void 0;
      let txtValue = domain.txtValue || void 0;
      if (cfHostname.ownership_verification?.name && cfHostname.ownership_verification?.value) {
        txtName = cfHostname.ownership_verification.name;
        txtValue = cfHostname.ownership_verification.value;
      } else if (cfHostname.ssl.validation_records && cfHostname.ssl.validation_records.length > 0) {
        const txtRecord = cfHostname.ssl.validation_records.find((r) => r.txt_name && r.txt_value);
        if (txtRecord) {
          txtName = txtRecord.txt_name;
          txtValue = txtRecord.txt_value;
        }
      }
      console.log("[Domains] Status check - Cloudflare response:", {
        hostname: cfHostname.hostname,
        status: cfHostname.status,
        sslStatus: cfHostname.ssl.status,
        sslMethod: cfHostname.ssl.method,
        ownershipVerification: cfHostname.ownership_verification,
        validationRecords: cfHostname.ssl.validation_records,
        txtName,
        txtValue
      });
      const updatedDomain = await prisma.customDomain.update({
        where: { id: domainId },
        data: {
          status: CloudflareSaaSService.mapCloudflareStatus(cfHostname.status),
          sslStatus: CloudflareSaaSService.mapSSLStatus(cfHostname.ssl.status),
          txtName,
          txtValue,
          verificationErrors: cfHostname.verification_errors || [],
          lastCheckedAt: /* @__PURE__ */ new Date(),
          verifiedAt: cfHostname.status === "active" && !domain.verifiedAt ? /* @__PURE__ */ new Date() : domain.verifiedAt
        }
      });
      return res.json({
        success: true,
        domain: {
          id: updatedDomain.id,
          domain: updatedDomain.domain,
          status: updatedDomain.status,
          sslStatus: updatedDomain.sslStatus,
          cnameTarget: updatedDomain.cnameTarget,
          txtName: updatedDomain.txtName,
          txtValue: updatedDomain.txtValue,
          verificationErrors: updatedDomain.verificationErrors,
          isPrimary: updatedDomain.isPrimary,
          verifiedAt: updatedDomain.verifiedAt,
          lastCheckedAt: updatedDomain.lastCheckedAt
        }
      });
    }
    return res.json({
      success: true,
      domain: {
        id: domain.id,
        domain: domain.domain,
        status: domain.status,
        sslStatus: domain.sslStatus,
        cnameTarget: domain.cnameTarget,
        txtName: domain.txtName,
        txtValue: domain.txtValue,
        verificationErrors: domain.verificationErrors,
        isPrimary: domain.isPrimary,
        verifiedAt: domain.verifiedAt,
        lastCheckedAt: domain.lastCheckedAt
      }
    });
  } catch (error) {
    console.error("[Domains] Error checking domain status:", error);
    return res.status(500).json({ error: "Failed to check domain status" });
  }
});
router7.post("/:domainId/set-primary", async (req, res) => {
  try {
    const { domainId } = req.params;
    const domain = await prisma.customDomain.findUnique({
      where: { id: domainId }
    });
    if (!domain) {
      return res.status(404).json({ error: "Domain not found" });
    }
    if (domain.status !== "ACTIVE") {
      return res.status(400).json({
        error: "Only verified domains can be set as primary. Please wait for domain verification."
      });
    }
    await prisma.customDomain.updateMany({
      where: {
        projectId: domain.projectId,
        isPrimary: true
      },
      data: { isPrimary: false }
    });
    const updatedDomain = await prisma.customDomain.update({
      where: { id: domainId },
      data: { isPrimary: true }
    });
    console.log(`[Domains] Set ${domain.domain} as primary for project ${domain.projectId}`);
    return res.json({
      success: true,
      domain: {
        id: updatedDomain.id,
        domain: updatedDomain.domain,
        isPrimary: updatedDomain.isPrimary
      }
    });
  } catch (error) {
    console.error("[Domains] Error setting primary domain:", error);
    return res.status(500).json({ error: "Failed to set primary domain" });
  }
});
router7.post("/cleanup", async (req, res) => {
  try {
    const apiKey = req.headers["x-api-key"];
    if (!apiKey || apiKey !== process.env.SHIPPER_API_KEY) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const { fullDomainCleanup } = await import("./domain-cleanup-5GWYDH55.js");
    const result = await fullDomainCleanup();
    return res.json({
      success: true,
      message: "Domain cleanup completed",
      result
    });
  } catch (error) {
    console.error("[Domains] Error during cleanup:", error);
    return res.status(500).json({ error: "Failed to cleanup domains" });
  }
});
router7.post("/unset-primary/:projectId", async (req, res) => {
  try {
    const apiKey = req.headers["x-api-key"];
    if (!apiKey || apiKey !== process.env.SHIPPER_API_KEY) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const { projectId } = req.params;
    await prisma.customDomain.updateMany({
      where: {
        projectId,
        isPrimary: true
      },
      data: { isPrimary: false }
    });
    console.log(`[Domains] Unset all primary domains for project ${projectId}`);
    return res.json({
      success: true,
      message: "All custom domains unset as primary. Shipper subdomain is now primary."
    });
  } catch (error) {
    console.error("[Domains] Error unsetting primary domain:", error);
    return res.status(500).json({ error: "Failed to unset primary domain" });
  }
});
router7.delete("/:domainId", async (req, res) => {
  try {
    const { domainId } = req.params;
    const domain = await prisma.customDomain.findUnique({
      where: { id: domainId }
    });
    if (!domain) {
      return res.status(404).json({ error: "Domain not found" });
    }
    if (domain.cloudflareHostnameId) {
      try {
        console.log(`[Domains] Deleting from Cloudflare: ${domain.domain} (${domain.cloudflareHostnameId})`);
        const cloudflare = createCloudflareService();
        await cloudflare.deleteCustomHostname(domain.cloudflareHostnameId);
        console.log(`[Domains] Successfully deleted from Cloudflare: ${domain.domain}`);
      } catch (error) {
        console.error(`[Domains] CRITICAL: Failed to delete ${domain.domain} from Cloudflare:`, error);
        return res.status(500).json({
          error: `Failed to delete domain from Cloudflare: ${error instanceof Error ? error.message : "Unknown error"}`,
          details: "Domain deletion aborted to prevent orphaned records. Please try again or contact support."
        });
      }
    } else {
      console.log(`[Domains] No Cloudflare hostname ID for ${domain.domain}, skipping Cloudflare deletion`);
    }
    await prisma.customDomain.delete({
      where: { id: domainId }
    });
    console.log(`[Domains] Successfully deleted custom domain ${domain.domain} from both Cloudflare and database`);
    return res.json({
      success: true,
      message: "Domain deleted successfully"
    });
  } catch (error) {
    console.error("[Domains] Error deleting domain:", error);
    return res.status(500).json({ error: "Failed to delete domain" });
  }
});
var domains_default = router7;

// src/routes/domains-dns.ts
init_esm_shims();
import { Router as Router8 } from "express";
import dns from "dns/promises";
var router8 = Router8();
var TARGET_HOST = process.env.CLOUDFLARE_FALLBACK_ORIGIN || process.env.DEPLOYMENT_PLANE_URL?.replace("https://", "").replace("http://", "").split(":")[0] || "shipper.now";
console.log("[Domains DNS] Using target host:", TARGET_HOST);
console.log("[Domains DNS] Target host for verification:", TARGET_HOST);
async function verifyDNS(domain) {
  try {
    try {
      const cnameRecords = await dns.resolveCname(domain);
      console.log(`[Domains DNS] CNAME records for ${domain}:`, cnameRecords);
      if (cnameRecords.some((record) => record.includes(TARGET_HOST) || record.includes("shipper.now"))) {
        return { verified: true, type: "CNAME" };
      }
    } catch (error) {
      console.log(`[Domains DNS] No CNAME found for ${domain}, trying A record`);
    }
    try {
      const aRecords = await dns.resolve4(domain);
      console.log(`[Domains DNS] A records for ${domain}:`, aRecords);
      const targetIPs = await dns.resolve4(TARGET_HOST);
      console.log(`[Domains DNS] Target IPs for ${TARGET_HOST}:`, targetIPs);
      if (aRecords.some((ip) => targetIPs.includes(ip))) {
        return { verified: true, type: "A" };
      }
    } catch (error) {
      console.log(`[Domains DNS] No A record found for ${domain}`);
    }
    return {
      verified: false,
      error: "Domain not pointing to our servers. Please check your DNS configuration."
    };
  } catch (error) {
    console.error(`[Domains DNS] Error verifying ${domain}:`, error);
    return {
      verified: false,
      error: "DNS lookup failed. Domain may not exist or DNS not propagated yet."
    };
  }
}
function isValidDomain(domain) {
  const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i;
  return domainRegex.test(domain);
}
router8.get("/lookup", async (req, res) => {
  try {
    const { domain } = req.query;
    if (!domain || typeof domain !== "string") {
      return res.status(400).json({ error: "Missing domain parameter" });
    }
    const customDomain = await prisma.customDomain.findFirst({
      where: {
        domain,
        isPrimary: true,
        status: "ACTIVE"
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            deploymentUrl: true
          }
        }
      }
    });
    if (!customDomain) {
      return res.status(404).json({
        error: "Domain not found or not active",
        domain
      });
    }
    return res.json({
      success: true,
      domain: customDomain.domain,
      project: {
        id: customDomain.project.id,
        name: customDomain.project.name,
        deploymentUrl: customDomain.project.deploymentUrl
      }
    });
  } catch (error) {
    console.error("[Domains DNS] Error looking up domain:", error);
    return res.status(500).json({ error: "Failed to lookup domain" });
  }
});
router8.post("/", async (req, res) => {
  try {
    const { projectId, domain } = req.body;
    if (!projectId || !domain) {
      return res.status(400).json({ error: "Missing required fields: projectId, domain" });
    }
    if (!isValidDomain(domain)) {
      return res.status(400).json({ error: "Invalid domain format" });
    }
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    const existingDomain = await prisma.customDomain.findUnique({
      where: { domain }
    });
    if (existingDomain) {
      return res.status(409).json({ error: "Domain already in use" });
    }
    const customDomain = await prisma.customDomain.create({
      data: {
        projectId,
        domain,
        status: "PENDING_VALIDATION",
        sslStatus: "PENDING",
        cnameTarget: TARGET_HOST,
        verificationErrors: [],
        lastCheckedAt: /* @__PURE__ */ new Date()
      }
    });
    console.log(`[Domains DNS] Created custom domain ${domain} for project ${projectId}`);
    return res.status(201).json({
      success: true,
      domain: {
        id: customDomain.id,
        domain: customDomain.domain,
        status: customDomain.status,
        sslStatus: customDomain.sslStatus,
        cnameTarget: customDomain.cnameTarget,
        createdAt: customDomain.createdAt,
        dnsInstructions: {
          type: "CNAME",
          name: domain.split(".")[0],
          // subdomain part
          value: TARGET_HOST,
          ttl: 3600,
          alternativeType: "A",
          alternativeValue: "Get IP from: dig +short " + TARGET_HOST
        }
      }
    });
  } catch (error) {
    console.error("[Domains DNS] Error creating custom domain:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: `Failed to create custom domain: ${errorMessage}` });
  }
});
router8.get("/:projectId", async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    const domains = await prisma.customDomain.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" }
    });
    return res.json({
      success: true,
      domains: domains.map((d) => ({
        id: d.id,
        domain: d.domain,
        status: d.status,
        sslStatus: d.sslStatus,
        cnameTarget: d.cnameTarget,
        verificationErrors: d.verificationErrors,
        isPrimary: d.isPrimary,
        createdAt: d.createdAt,
        verifiedAt: d.verifiedAt,
        lastCheckedAt: d.lastCheckedAt
      }))
    });
  } catch (error) {
    console.error("[Domains DNS] Error listing domains:", error);
    return res.status(500).json({ error: "Failed to list domains" });
  }
});
router8.post("/:domainId/verify", async (req, res) => {
  try {
    const { domainId } = req.params;
    const domain = await prisma.customDomain.findUnique({
      where: { id: domainId }
    });
    if (!domain) {
      return res.status(404).json({ error: "Domain not found" });
    }
    const verification = await verifyDNS(domain.domain);
    const updatedDomain = await prisma.customDomain.update({
      where: { id: domainId },
      data: {
        status: verification.verified ? "ACTIVE" : "PENDING_VALIDATION",
        sslStatus: verification.verified ? "ACTIVE" : "PENDING",
        verificationErrors: verification.error ? [verification.error] : [],
        lastCheckedAt: /* @__PURE__ */ new Date(),
        verifiedAt: verification.verified && !domain.verifiedAt ? /* @__PURE__ */ new Date() : domain.verifiedAt
      }
    });
    console.log(`[Domains DNS] Verified ${domain.domain}: ${verification.verified ? "SUCCESS" : "FAILED"}`);
    return res.json({
      success: true,
      verified: verification.verified,
      dnsType: verification.type,
      domain: {
        id: updatedDomain.id,
        domain: updatedDomain.domain,
        status: updatedDomain.status,
        sslStatus: updatedDomain.sslStatus,
        verifiedAt: updatedDomain.verifiedAt,
        verificationErrors: updatedDomain.verificationErrors
      }
    });
  } catch (error) {
    console.error("[Domains DNS] Error verifying domain:", error);
    return res.status(500).json({ error: "Failed to verify domain" });
  }
});
router8.get("/status/:domainId", async (req, res) => {
  try {
    const { domainId } = req.params;
    const domain = await prisma.customDomain.findUnique({
      where: { id: domainId }
    });
    if (!domain) {
      return res.status(404).json({ error: "Domain not found" });
    }
    return res.json({
      success: true,
      domain: {
        id: domain.id,
        domain: domain.domain,
        status: domain.status,
        sslStatus: domain.sslStatus,
        cnameTarget: domain.cnameTarget,
        verificationErrors: domain.verificationErrors,
        isPrimary: domain.isPrimary,
        verifiedAt: domain.verifiedAt,
        lastCheckedAt: domain.lastCheckedAt
      }
    });
  } catch (error) {
    console.error("[Domains DNS] Error checking domain status:", error);
    return res.status(500).json({ error: "Failed to check domain status" });
  }
});
router8.post("/:domainId/set-primary", async (req, res) => {
  try {
    const { domainId } = req.params;
    const domain = await prisma.customDomain.findUnique({
      where: { id: domainId }
    });
    if (!domain) {
      return res.status(404).json({ error: "Domain not found" });
    }
    if (domain.status !== "ACTIVE") {
      return res.status(400).json({
        error: "Only verified domains can be set as primary. Please verify DNS configuration first."
      });
    }
    await prisma.customDomain.updateMany({
      where: {
        projectId: domain.projectId,
        isPrimary: true
      },
      data: { isPrimary: false }
    });
    const updatedDomain = await prisma.customDomain.update({
      where: { id: domainId },
      data: { isPrimary: true }
    });
    console.log(`[Domains DNS] Set ${domain.domain} as primary for project ${domain.projectId}`);
    return res.json({
      success: true,
      domain: {
        id: updatedDomain.id,
        domain: updatedDomain.domain,
        isPrimary: updatedDomain.isPrimary
      }
    });
  } catch (error) {
    console.error("[Domains DNS] Error setting primary domain:", error);
    return res.status(500).json({ error: "Failed to set primary domain" });
  }
});
router8.delete("/:domainId", async (req, res) => {
  try {
    const { domainId } = req.params;
    const domain = await prisma.customDomain.findUnique({
      where: { id: domainId }
    });
    if (!domain) {
      return res.status(404).json({ error: "Domain not found" });
    }
    await prisma.customDomain.delete({
      where: { id: domainId }
    });
    console.log(`[Domains DNS] Deleted custom domain ${domain.domain}`);
    return res.json({
      success: true,
      message: "Domain deleted successfully"
    });
  } catch (error) {
    console.error("[Domains DNS] Error deleting domain:", error);
    return res.status(500).json({ error: "Failed to delete domain" });
  }
});
var domains_dns_default = router8;

// src/routes/database.ts
init_esm_shims();
import { Router as Router9 } from "express";
import { createClient as createClient2 } from "@libsql/client";
import { createOpenRouter as createOpenRouter2 } from "@openrouter/ai-sdk-provider";
import { generateText as generateText2 } from "ai";
var router9 = Router9();
router9.use(validateSession);
var openrouter2 = createOpenRouter2({
  apiKey: process.env.OPENROUTER_API_KEY
});
router9.post(
  "/generate-records",
  validateProjectAccess,
  async (req, res) => {
    try {
      const { tableName, recordCount, dataDescription, projectId } = req.body;
      if (!tableName || !recordCount) {
        const response2 = {
          success: false,
          error: "Table name and record count are required"
        };
        return res.status(400).json(response2);
      }
      if (recordCount > 500) {
        const response2 = {
          success: false,
          error: "Maximum 500 records allowed per generation"
        };
        return res.status(400).json(response2);
      }
      if (recordCount >= 250) {
        console.log(
          `[Database] Large record generation requested: ${recordCount} records`
        );
      }
      const result = await generateDatabaseRecords({
        tableName,
        recordCount,
        dataDescription,
        projectId
      });
      const response = {
        success: true,
        data: {
          records: result.records,
          creditsUsed: result.creditsUsed,
          complexity: result.complexity
        }
      };
      res.json(response);
    } catch (error) {
      console.error("[Database] Generate records error:", error);
      const response = {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate records"
      };
      res.status(500).json(response);
    }
  }
);
router9.post(
  "/insert-records",
  validateProjectAccess,
  async (req, res) => {
    try {
      const { projectId, tableName, records } = req.body;
      if (!projectId || !tableName || !records || !Array.isArray(records)) {
        const response2 = {
          success: false,
          error: "Project ID, table name, and records array are required"
        };
        return res.status(400).json(response2);
      }
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          tursoDatabaseUrl: true,
          tursoDatabaseToken: true
        }
      });
      if (!project) {
        const response2 = {
          success: false,
          error: "Project not found"
        };
        return res.status(404).json(response2);
      }
      if (!project.tursoDatabaseUrl || !project.tursoDatabaseToken) {
        const response2 = {
          success: false,
          error: "Project does not have a Turso database"
        };
        return res.status(400).json(response2);
      }
      const turso = createClient2({
        url: project.tursoDatabaseUrl,
        authToken: project.tursoDatabaseToken
      });
      const tablesResult = await turso.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
      );
      const validTables = tablesResult.rows.map((row) => row.name);
      if (!validTables.includes(tableName)) {
        const response2 = {
          success: false,
          error: `Table '${tableName}' does not exist in this database`
        };
        return res.status(400).json(response2);
      }
      let insertedCount = 0;
      const errors = [];
      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const columns = Object.keys(record);
        const values = Object.values(record);
        const placeholders = columns.map(() => "?").join(", ");
        const insertQuery = `INSERT INTO "${tableName}" (${columns.map((c) => `"${c}"`).join(", ")}) VALUES (${placeholders})`;
        try {
          await turso.execute(insertQuery, values);
          insertedCount++;
        } catch (error) {
          const errorMsg = error?.message || String(error);
          console.error(
            `[Database] Failed to insert record ${i + 1}/${records.length}:`,
            record,
            errorMsg
          );
          errors.push(`Record ${i + 1}: ${errorMsg}`);
          if (insertedCount === 0 && errorMsg.includes("no column named")) {
            throw new Error(errorMsg);
          }
          if (insertedCount === 0 && i >= 2 && errors.every((e) => e.includes("UNIQUE constraint"))) {
            throw new Error(
              `All records have UNIQUE constraint failures. This usually means IDs are already in use. ${errorMsg}`
            );
          }
        }
      }
      if (insertedCount === 0 && errors.length > 0) {
        if (errors[0].includes("UNIQUE constraint")) {
          throw new Error(
            `Failed to insert records due to duplicate IDs. The AI may have generated IDs that already exist in the table. Try deleting existing records first or regenerating with different data.`
          );
        }
        throw new Error(`Failed to insert any records: ${errors[0]}`);
      }
      const response = {
        success: true,
        data: {
          insertedCount,
          totalRecords: records.length,
          errors: errors.length > 0 ? errors : void 0
        }
      };
      res.json(response);
    } catch (error) {
      console.error("[Database] Insert records error:", error);
      const response = {
        success: false,
        error: error instanceof Error ? error.message : "Failed to insert records"
      };
      res.status(500).json(response);
    }
  }
);
async function generateDatabaseRecords(params) {
  const complexity = params.dataDescription.length > 50 ? "complex" : "simple";
  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    select: {
      name: true,
      tursoDatabaseUrl: true,
      tursoDatabaseToken: true
    }
  });
  if (!project?.tursoDatabaseUrl || !project?.tursoDatabaseToken) {
    throw new Error("Project does not have a database");
  }
  const turso = createClient2({
    url: project.tursoDatabaseUrl,
    authToken: project.tursoDatabaseToken
  });
  const schemaResult = await turso.execute(
    `PRAGMA table_info("${params.tableName}")`
  );
  const columns = schemaResult.rows.map((row) => ({
    name: row.name,
    type: row.type,
    notNull: row.notnull === 1,
    defaultValue: row.dflt_value,
    primaryKey: row.pk === 1
  }));
  let maxId = 0;
  const primaryKeyColumn = columns.find((col) => col.primaryKey);
  if (primaryKeyColumn) {
    try {
      const maxIdResult = await turso.execute(
        `SELECT MAX("${primaryKeyColumn.name}") as max_id FROM "${params.tableName}"`
      );
      console.log(
        "[generateDatabaseRecords] Max ID query result:",
        JSON.stringify(maxIdResult.rows)
      );
      const firstRow = maxIdResult.rows[0];
      let maxIdValue;
      if (Array.isArray(firstRow)) {
        maxIdValue = firstRow[0];
      } else if (firstRow && typeof firstRow === "object") {
        maxIdValue = firstRow.max_id || firstRow[0];
      }
      maxId = maxIdValue ? Number(maxIdValue) : 0;
      console.log(
        `[generateDatabaseRecords] Current max ID for ${params.tableName}: ${maxId}, will start from ${maxId + 1}`
      );
    } catch (error) {
      console.log(
        "[generateDatabaseRecords] Could not get max ID, starting from 0:",
        error
      );
    }
  }
  const columnInfo = columns.map(
    (col) => `${col.name} (${col.type}${col.primaryKey ? ", PRIMARY KEY" : ""}${col.notNull ? ", NOT NULL" : ""})`
  ).join("\n");
  const projectContext = project ? `Project: ${project.name}` : "";
  const startId = maxId + 1;
  const endId = maxId + params.recordCount;
  const prompt = `You are a JSON data generator for a real application. Generate EXACTLY ${params.recordCount} realistic sample records.

${projectContext}

Table Name: ${params.tableName}
Table Schema (MUST USE THESE EXACT COLUMN NAMES):
${columnInfo}

Data Requirements: ${params.dataDescription || "Generate realistic sample data that fits the project context"}

CONTEXT AWARENESS:
- Look at the project name/description above to understand what this app does
- Generate data that would actually be used in THIS specific application
- Make the data realistic and relevant to the app's purpose
- For TEXT columns, use simple readable strings (e.g., "London, UK - See Big Ben and ride London Eye")
- Only use JSON format for columns explicitly typed as JSON/JSONB
- If a column is named "data" but typed as TEXT, use simple descriptive text, NOT JSON
- Use realistic names, emails, and content that fit the app's domain

CRITICAL RULES:
1. Return ONLY a valid JSON array - NO explanations, NO markdown, NO conversation
2. Generate ALL ${params.recordCount} records in a single response
3. Use ONLY the column names from the schema above - DO NOT invent new columns
4. Each record must have realistic, varied data that fits the project context
5. Use proper data types matching the schema (INTEGER for numbers, TEXT for strings, etc.)
6. For PRIMARY KEY columns, generate unique sequential IDs starting from ${startId} to ${endId}
7. For timestamp/date columns, use ISO format: "2024-01-15T10:30:00Z" (no milliseconds)
8. For JSON columns, create valid JSON objects/arrays as strings that match the app's purpose
9. IMPORTANT: The table already has ${maxId} records, so start IDs at ${startId}
10. Make data diverse and realistic - vary the content, don't repeat patterns

Output format (return ONLY this, nothing else):
[
  {column1: value1, column2: value2, ...},
  {column1: value1, column2: value2, ...}
]`;
  const { text } = await generateText2({
    model: openrouter2("google/gemini-2.5-flash"),
    prompt,
    temperature: 0.7
  });
  let records;
  try {
    let cleanedText = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const jsonArrayMatch = cleanedText.match(/\[[\s\S]*\]/);
    if (jsonArrayMatch) {
      cleanedText = jsonArrayMatch[0];
    }
    records = JSON.parse(cleanedText);
    if (!Array.isArray(records)) {
      throw new Error("Response is not an array");
    }
    records = records.slice(0, params.recordCount);
    if (primaryKeyColumn) {
      const pkName = primaryKeyColumn.name;
      let currentId = startId;
      let needsFixing = false;
      for (const record of records) {
        if (record[pkName] !== currentId) {
          needsFixing = true;
          break;
        }
        currentId++;
      }
      if (needsFixing) {
        console.log(
          `[generateDatabaseRecords] AI didn't respect ID range, fixing IDs from ${startId} to ${endId}`
        );
        currentId = startId;
        for (const record of records) {
          record[pkName] = currentId;
          currentId++;
        }
      }
    }
  } catch (parseError) {
    console.error(
      "[generateDatabaseRecords] Failed to parse AI response:",
      parseError
    );
    console.error("[generateDatabaseRecords] AI response:", text);
    throw new Error(
      "Failed to parse generated data. The AI returned invalid JSON."
    );
  }
  const creditsUsed = 0.25;
  return {
    records,
    creditsUsed,
    complexity
  };
}
var database_default = router9;

// src/routes/ai-proxy.ts
init_esm_shims();
import {
  Router as Router10
} from "express";
var BILLING_SERVICE_URL = process.env.BILLING_SERVICE_URL || process.env.BILLING_WEBHOOK_URL?.replace("/webhook/convex", "");
var BILLING_API_KEY = process.env.BILLING_API_KEY || process.env.SHIPPER_API_KEY;
var SHIPPER_CLOUD_CREDITS_METER = "shipper_cloud_credits";
var AI_USAGE_MARKUP = 2;
function usdToCloudCredits(usdCost) {
  const costWithMarkup = usdCost * AI_USAGE_MARKUP;
  const credits = costWithMarkup * 100;
  return Math.max(1, Math.round(credits * 1e4) / 1e4);
}
var router10 = Router10();
var OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
async function validateProjectToken(token) {
  logger.info({
    msg: "Validating AI proxy token",
    tokenPrefix: token?.substring(0, 20)
  });
  if (!token || !token.startsWith("shipper_ai_")) {
    logger.warn({
      msg: "Invalid token format",
      hasToken: !!token,
      prefix: token?.substring(0, 15)
    });
    return null;
  }
  const project = await prisma.project.findFirst({
    where: {
      aiProxyToken: token,
      aiEnabled: true
    },
    select: {
      id: true,
      name: true,
      userId: true,
      teamId: true,
      team: {
        select: {
          members: {
            where: { role: "OWNER" },
            select: { userId: true },
            take: 1
          }
        }
      }
    }
  });
  if (!project) {
    logger.warn({
      msg: "No project found for token",
      tokenPrefix: token.substring(0, 20)
    });
    const disabledProject = await prisma.project.findFirst({
      where: { aiProxyToken: token },
      select: { id: true, aiEnabled: true }
    });
    if (disabledProject) {
      logger.warn({
        msg: "Project found but AI disabled",
        projectId: disabledProject.id,
        aiEnabled: disabledProject.aiEnabled
      });
    }
    return null;
  }
  logger.info({
    msg: "Project found",
    projectId: project.id,
    hasUserId: !!project.userId,
    hasTeam: !!project.team
  });
  const teamOwnerId = project.team?.members?.[0]?.userId;
  const userId = project.userId || teamOwnerId;
  if (!userId) {
    logger.warn({ msg: "No userId found", projectId: project.id, teamOwnerId });
    return null;
  }
  return {
    projectId: project.id,
    projectName: project.name,
    userId
  };
}
function extractCost(headers, body) {
  const costHeader = headers.get("x-openrouter-cost");
  if (costHeader) {
    return parseFloat(costHeader);
  }
  if (body?.usage?.cost) {
    return body.usage.cost;
  }
  if (body?.usage?.total_tokens) {
    return body.usage.total_tokens / 1e3 * 1e-3;
  }
  return 0;
}
async function checkCloudCreditBalance(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      stripeCustomerId: true,
      cloudCreditBalance: true
    }
  });
  if (!user) {
    return { hasCredits: false, balance: 0 };
  }
  return {
    hasCredits: (user.cloudCreditBalance ?? 0) > 0,
    balance: user.cloudCreditBalance ?? 0,
    stripeCustomerId: user.stripeCustomerId ?? void 0
  };
}
async function reportAIUsageToStripeMeter(userId, stripeCustomerId, credits, metadata) {
  if (credits <= 0) {
    return true;
  }
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        cloudCreditBalance: { decrement: credits },
        cloudLifetimeCreditsUsed: { increment: credits }
      }
    });
    await prisma.cloudCreditTransaction.create({
      data: {
        userId,
        amount: -credits,
        type: "USAGE",
        description: `AI usage: ${metadata.model || "unknown"} - ${metadata.tokens || 0} tokens`,
        metadata: {
          projectId: metadata.projectId,
          model: metadata.model,
          endpoint: metadata.endpoint,
          tokens: metadata.tokens,
          costUsd: metadata.costUsd
        }
      }
    });
    logger.info({
      msg: "Deducted AI usage from Cloud credits",
      userId,
      credits,
      costUsd: metadata.costUsd,
      model: metadata.model
    });
    if (stripeCustomerId && BILLING_SERVICE_URL && BILLING_API_KEY) {
      const idempotencyKey = `ai-${metadata.projectId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      fetch(`${BILLING_SERVICE_URL}/credits/${userId}/ai-usage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": BILLING_API_KEY
        },
        body: JSON.stringify({
          stripeCustomerId,
          credits,
          meterEventName: SHIPPER_CLOUD_CREDITS_METER,
          idempotencyKey,
          metadata: { type: "ai_usage", ...metadata }
        })
      }).catch((err) => {
        logger.warn({
          msg: "Failed to report AI usage to Stripe meter (non-blocking)",
          error: err instanceof Error ? err.message : String(err)
        });
      });
    }
    return true;
  } catch (error) {
    logger.error({
      msg: "Error deducting AI usage credits",
      error: error instanceof Error ? error.message : String(error),
      userId,
      credits
    });
    return false;
  }
}
async function authMiddleware(req, res, next) {
  const token = req.headers["x-shipper-token"];
  logger.info({
    msg: "AI proxy auth middleware",
    hasToken: !!token,
    tokenPrefix: token?.substring(0, 20),
    headers: Object.keys(req.headers)
  });
  if (!token) {
    logger.warn({ msg: "Missing X-Shipper-Token header" });
    return res.status(401).json({
      error: {
        message: "Missing X-Shipper-Token header",
        type: "authentication_error",
        code: "missing_token"
      }
    });
  }
  const projectInfo = await validateProjectToken(token);
  if (!projectInfo) {
    logger.warn({
      msg: "validateProjectToken returned null",
      tokenPrefix: token.substring(0, 20)
    });
    return res.status(401).json({
      error: {
        message: "Invalid or disabled AI token",
        type: "authentication_error",
        code: "invalid_token"
      }
    });
  }
  const creditCheck = await checkCloudCreditBalance(projectInfo.userId);
  if (!creditCheck.hasCredits) {
    return res.status(402).json({
      error: {
        message: "Insufficient Cloud credits. Please add more credits to continue using AI features in your app.",
        type: "billing_error",
        code: "insufficient_credits",
        balance: creditCheck.balance
      }
    });
  }
  req.projectInfo = {
    ...projectInfo,
    stripeCustomerId: creditCheck.stripeCustomerId
  };
  next();
}
async function proxyToOpenRouter(req, res, endpoint) {
  const startTime = Date.now();
  const projectInfo = req.projectInfo;
  try {
    const openRouterUrl = `${OPENROUTER_BASE_URL}${endpoint}`;
    const isStreaming = req.body?.stream === true;
    logger.info({
      msg: "AI proxy request",
      projectId: projectInfo.projectId,
      userId: projectInfo.userId,
      endpoint,
      model: req.body?.model,
      stream: isStreaming
    });
    const openRouterResponse = await fetch(openRouterUrl, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": process.env.API_URL || "https://api.shipper.so",
        "X-Title": `Shipper App: ${projectInfo.projectName}`
      },
      body: JSON.stringify(req.body)
    });
    if (isStreaming && openRouterResponse.body) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      const reader = openRouterResponse.body.getReader();
      const decoder = new TextDecoder();
      let totalContent = "";
      let usage = null;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          res.write(chunk);
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ") && line !== "data: [DONE]") {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.usage) {
                  usage = data.usage;
                }
                if (data.choices?.[0]?.delta?.content) {
                  totalContent += data.choices[0].delta.content;
                }
              } catch {
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
      res.end();
      const cost2 = extractCost(openRouterResponse.headers, { usage });
      const credits2 = usdToCloudCredits(cost2);
      if (credits2 > 0) {
        reportAIUsageToStripeMeter(
          projectInfo.userId,
          projectInfo.stripeCustomerId,
          credits2,
          {
            projectId: projectInfo.projectId,
            model: req.body?.model,
            endpoint,
            tokens: usage?.total_tokens,
            costUsd: cost2
          }
        ).catch((error) => {
          logger.error({
            msg: "Failed to report AI usage to Stripe meter",
            error: error instanceof Error ? error.message : String(error),
            projectId: projectInfo.projectId
          });
        });
      }
      logger.info({
        msg: "AI proxy stream completed",
        projectId: projectInfo.projectId,
        endpoint,
        model: req.body?.model,
        cost: cost2,
        credits: credits2,
        durationMs: Date.now() - startTime
      });
      return;
    }
    const responseBody = await openRouterResponse.json();
    const cost = extractCost(openRouterResponse.headers, responseBody);
    const credits = usdToCloudCredits(cost);
    if (credits > 0) {
      reportAIUsageToStripeMeter(
        projectInfo.userId,
        projectInfo.stripeCustomerId,
        credits,
        {
          projectId: projectInfo.projectId,
          model: req.body?.model,
          endpoint,
          tokens: responseBody?.usage?.total_tokens,
          costUsd: cost
        }
      ).catch((error) => {
        logger.error({
          msg: "Failed to report AI usage to Stripe meter",
          error: error instanceof Error ? error.message : String(error),
          projectId: projectInfo.projectId
        });
      });
    }
    logger.info({
      msg: "AI proxy request completed",
      projectId: projectInfo.projectId,
      endpoint,
      model: req.body?.model,
      tokens: responseBody?.usage?.total_tokens,
      cost,
      credits,
      durationMs: Date.now() - startTime
    });
    return res.status(openRouterResponse.status).json(responseBody);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({
      msg: "AI proxy error",
      error: errorMessage,
      stack: error instanceof Error ? error.stack : void 0,
      projectId: projectInfo.projectId,
      endpoint
    });
    return res.status(500).json({
      error: {
        message: "AI request failed",
        type: "api_error",
        code: "proxy_error",
        details: errorMessage
      }
    });
  }
}
router10.use(authMiddleware);
router10.post(
  "/chat/completions",
  (req, res) => proxyToOpenRouter(req, res, "/chat/completions")
);
router10.post(
  "/completions",
  (req, res) => proxyToOpenRouter(req, res, "/completions")
);
router10.post(
  "/embeddings",
  (req, res) => proxyToOpenRouter(req, res, "/embeddings")
);
router10.post(
  "/images/generations",
  (req, res) => proxyToOpenRouter(req, res, "/images/generations")
);
router10.get("/models", async (req, res) => {
  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/models`, {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`
      }
    });
    const data = await response.json();
    return res.json(data);
  } catch (error) {
    return res.status(500).json({
      error: {
        message: "Failed to fetch models",
        type: "api_error"
      }
    });
  }
});
router10.all("/*", (req, res) => {
  const endpoint = req.path;
  return proxyToOpenRouter(req, res, endpoint);
});
var ai_proxy_default = router10;

// src/routes/shipper-cloud-admin.ts
init_esm_shims();
import { Router as Router11 } from "express";
var router11 = Router11();
router11.post("/inject-credentials", async (req, res) => {
  try {
    const { projectId, deployKeyEncrypted, deploymentUrl } = req.body;
    if (!projectId || !deployKeyEncrypted || !deploymentUrl) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: projectId, deployKeyEncrypted, deploymentUrl"
      });
    }
    logger.info({
      msg: "Admin: Injecting Shipper Cloud credentials",
      projectId,
      deploymentUrl
    });
    const result = await injectDeployKeyIntoSandbox(projectId, deployKeyEncrypted, deploymentUrl);
    if (!result.success) {
      logger.warn({
        msg: "Admin: Could not inject Shipper Cloud credentials",
        projectId,
        reason: result.message
      });
      return res.status(400).json({
        success: false,
        error: result.message
      });
    }
    logger.info({
      msg: "Admin: Successfully injected Shipper Cloud credentials",
      projectId
    });
    return res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error({
      msg: "Admin: Failed to inject Shipper Cloud credentials",
      error: errorMsg
    });
    return res.status(500).json({
      success: false,
      error: errorMsg
    });
  }
});
var shipper_cloud_admin_default = router11;

// src/routes/connectors.ts
init_esm_shims();
import { Router as Router12 } from "express";
import { z as z8 } from "zod";
import jwt from "jsonwebtoken";
var router12 = Router12();
var OAUTH_STATE_SECRET = process.env.SECRETS_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET || "fallback-secret-change-in-production";
function generateState(userId, provider) {
  const payload = { userId, provider };
  return jwt.sign(payload, OAUTH_STATE_SECRET, { expiresIn: "10m" });
}
function validateState(state) {
  try {
    const decoded = Buffer.from(state, "base64").toString();
    const parsed = JSON.parse(decoded);
    if (parsed.originalState) {
      try {
        const payload = jwt.verify(
          parsed.originalState,
          OAUTH_STATE_SECRET
        );
        return {
          userId: payload.userId,
          provider: payload.provider,
          codeVerifier: parsed.codeVerifier
        };
      } catch (jwtError) {
        logger.warn({ error: jwtError }, "Invalid JWT in PKCE state");
        return null;
      }
    }
  } catch (e) {
  }
  try {
    const payload = jwt.verify(state, OAUTH_STATE_SECRET);
    return { userId: payload.userId, provider: payload.provider };
  } catch (jwtError) {
    logger.warn({ error: jwtError }, "Invalid OAuth state JWT");
    return null;
  }
}
router12.get("/", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];
    const teamId = req.headers["x-team-id"];
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const state = await connectorRegistry.getConnectorState(userId, teamId);
    res.json({
      success: true,
      data: state
    });
  } catch (error) {
    logger.error({ error }, "Failed to list connectors");
    res.status(500).json({ error: "Failed to list connectors" });
  }
});
router12.get("/:provider/auth", async (req, res) => {
  try {
    const { provider } = req.params;
    const userId = req.headers["x-user-id"];
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const connector = connectorRegistry.getPersonalConnector(
      provider.toUpperCase()
    );
    if (!connector) {
      return res.status(404).json({ error: `Unknown connector: ${provider}` });
    }
    const state = generateState(userId, provider.toUpperCase());
    const redirectUri = getRedirectUri(provider);
    let authUrl;
    if (provider.toLowerCase() === "notion") {
      authUrl = await getNotionAuthUrlAsync(redirectUri, state);
    } else {
      authUrl = connector.getAuthUrl(redirectUri, state);
    }
    res.json({
      success: true,
      authUrl
    });
  } catch (error) {
    logger.error({ error }, "Failed to initiate OAuth");
    res.status(500).json({ error: "Failed to initiate OAuth" });
  }
});
router12.get("/:provider/callback", async (req, res) => {
  try {
    const { provider } = req.params;
    const { code, state, error: oauthError } = req.query;
    const isProxied = !!req.headers["x-user-id"];
    const sendError = (errorMsg) => {
      if (isProxied) {
        return res.status(400).json({ error: errorMsg });
      }
      return res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>Connection Error</title></head>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'connector-error', error: '${errorMsg}' }, '*');
              }
              window.close();
            </script>
            <p>Error: ${errorMsg}. You can close this window.</p>
          </body>
        </html>
      `);
    };
    if (oauthError) {
      logger.warn({ provider, error: oauthError }, "OAuth error from provider");
      return sendError(String(oauthError));
    }
    if (!code || !state) {
      return sendError("missing_params");
    }
    const stateData = validateState(state);
    if (!stateData) {
      return sendError("invalid_state");
    }
    const { userId } = stateData;
    const connector = connectorRegistry.getPersonalConnector(
      provider.toUpperCase()
    );
    if (!connector) {
      return sendError("unknown_connector");
    }
    const redirectUri = getRedirectUri(provider);
    const tokens = await connector.handleCallback(
      code,
      redirectUri,
      state
    );
    await prisma.personalConnector.upsert({
      where: {
        userId_provider_customUrl: {
          userId,
          provider: provider.toUpperCase(),
          customUrl: ""
        }
      },
      create: {
        userId,
        provider: provider.toUpperCase(),
        accessToken: encrypt(tokens.accessToken),
        refreshToken: tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
        expiresAt: tokens.expiresAt,
        metadata: tokens.metadata,
        status: "ACTIVE"
      },
      update: {
        accessToken: encrypt(tokens.accessToken),
        refreshToken: tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
        expiresAt: tokens.expiresAt,
        metadata: tokens.metadata,
        status: "ACTIVE",
        errorMessage: null
      }
    });
    logger.info(
      { userId, provider, isProxied },
      "Personal connector connected"
    );
    if (isProxied) {
      return res.json({ success: true, provider: provider.toLowerCase() });
    }
    res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>Connected!</title></head>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'connector-connected', provider: '${provider.toLowerCase()}' }, '*');
            }
            window.close();
          </script>
          <p>Connected successfully! You can close this window.</p>
        </body>
      </html>
    `);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error, errorMessage }, "OAuth callback failed");
    if (req.headers["x-user-id"]) {
      return res.status(500).json({ error: errorMessage });
    }
    const safeErrorMessage = errorMessage.replace(/'/g, "\\'").replace(/\n/g, " ");
    res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>Connection Failed</title></head>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'connector-error', error: '${safeErrorMessage}' }, '*');
            }
            window.close();
          </script>
          <p>Connection failed: ${safeErrorMessage}</p>
        </body>
      </html>
    `);
  }
});
router12.get("/:provider/status", async (req, res) => {
  try {
    const { provider } = req.params;
    const userId = req.headers["x-user-id"];
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const connection = await connectorRegistry.getUserPersonalConnection(
      userId,
      provider.toUpperCase()
    );
    res.json({
      success: true,
      connected: !!connection,
      connection
    });
  } catch (error) {
    logger.error({ error }, "Failed to get connector status");
    res.status(500).json({ error: "Failed to get connector status" });
  }
});
router12.delete("/:provider", async (req, res) => {
  try {
    const { provider } = req.params;
    const userId = req.headers["x-user-id"];
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    await prisma.personalConnector.deleteMany({
      where: {
        userId,
        provider: provider.toUpperCase()
      }
    });
    logger.info({ userId, provider }, "Personal connector disconnected");
    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, "Failed to disconnect connector");
    res.status(500).json({ error: "Failed to disconnect connector" });
  }
});
router12.post("/:provider/resources", async (req, res) => {
  try {
    const { provider } = req.params;
    const userId = req.headers["x-user-id"];
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const schema = z8.object({
      resourceType: z8.string(),
      query: z8.string().optional(),
      limit: z8.number().optional()
    });
    const body = schema.parse(req.body);
    const connector = connectorRegistry.getPersonalConnector(
      provider.toUpperCase()
    );
    if (!connector) {
      return res.status(404).json({ error: `Unknown connector: ${provider}` });
    }
    const accessToken = await connectorRegistry.getPersonalAccessToken(
      userId,
      provider.toUpperCase()
    );
    if (!accessToken) {
      return res.status(401).json({
        error: "Not connected",
        action_required: "connect",
        provider
      });
    }
    const resources = await connector.fetchResources(accessToken, {
      resourceType: body.resourceType,
      query: body.query,
      limit: body.limit
    });
    await prisma.personalConnector.updateMany({
      where: {
        userId,
        provider: provider.toUpperCase()
      },
      data: { lastUsedAt: /* @__PURE__ */ new Date() }
    });
    res.json({
      success: true,
      resources,
      count: resources.length
    });
  } catch (error) {
    logger.error({ error }, "Failed to fetch resources");
    res.status(500).json({ error: "Failed to fetch resources" });
  }
});
router12.post("/shared", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];
    const teamId = req.headers["x-team-id"];
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const schema = z8.object({
      connectorType: z8.string(),
      credentials: z8.record(z8.string(), z8.string()),
      name: z8.string().optional(),
      projectId: z8.string().optional()
    });
    const body = schema.parse(req.body);
    const connector = connectorRegistry.getSharedConnector(
      body.connectorType
    );
    if (!connector) {
      return res.status(404).json({ error: `Unknown connector: ${body.connectorType}` });
    }
    const validation = await connector.validateCredentials(
      body.credentials
    );
    if (!validation.valid) {
      return res.status(400).json({
        error: "Invalid credentials",
        details: validation.error
      });
    }
    const scope = body.projectId ? { projectId: body.projectId, teamId: null } : { teamId: teamId || null, projectId: null };
    if (!scope.teamId && !scope.projectId) {
      return res.status(400).json({
        error: "Either teamId or projectId is required"
      });
    }
    await prisma.sharedConnector.upsert({
      where: scope.teamId ? {
        teamId_connectorType: {
          teamId: scope.teamId,
          connectorType: body.connectorType
        }
      } : {
        projectId_connectorType: {
          projectId: scope.projectId,
          connectorType: body.connectorType
        }
      },
      create: {
        ...scope,
        connectorType: body.connectorType,
        name: body.name,
        credentials: encryptCredentials(
          body.credentials
        ),
        createdById: userId,
        status: "ACTIVE"
      },
      update: {
        name: body.name,
        credentials: encryptCredentials(
          body.credentials
        ),
        status: "ACTIVE",
        errorMessage: null
      }
    });
    logger.info(
      { userId, connectorType: body.connectorType, scope },
      "Shared connector configured"
    );
    res.json({
      success: true,
      setupInstructions: connector.getSetupInstructions(
        body.credentials
      )
    });
  } catch (error) {
    logger.error({ error }, "Failed to configure shared connector");
    res.status(500).json({ error: "Failed to configure shared connector" });
  }
});
router12.delete("/shared/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.headers["x-user-id"];
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    await prisma.sharedConnector.delete({
      where: { id }
    });
    logger.info({ userId, connectorId: id }, "Shared connector removed");
    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, "Failed to remove shared connector");
    res.status(500).json({ error: "Failed to remove shared connector" });
  }
});
function getRedirectUri(provider) {
  const webappUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.WEBAPP_URL || "http://localhost:3000";
  return `${webappUrl}/api/connectors/${provider.toLowerCase()}/callback`;
}
var connectors_default = router12;

// src/middleware/auth.ts
init_esm_shims();
var SHIPPER_API_KEY = process.env.SHIPPER_API_KEY;
var SESSION_AUTH_PATHS = /* @__PURE__ */ new Set([
  "/api/v1/chat",
  "/api/v1/upload",
  "/api/v1/user",
  "/api/v1/connectors"
]);
var CUSTOM_AUTH_PATHS = /* @__PURE__ */ new Set(["/api/v1/domains/lookup"]);
function validateApiKey(req, res, next) {
  if (req.path === "/health") {
    return next();
  }
  for (const path3 of SESSION_AUTH_PATHS) {
    if (req.path.startsWith(path3)) {
      return next();
    }
  }
  if (CUSTOM_AUTH_PATHS.has(req.path)) {
    return next();
  }
  if (req.path.startsWith("/api/v1/ai")) {
    return next();
  }
  const apiKey = req.headers["x-api-key"];
  if (!SHIPPER_API_KEY) {
    console.error("[Auth] SHIPPER_API_KEY not configured!");
    const response = {
      success: false,
      error: "Server configuration error"
    };
    return res.status(500).json(response);
  }
  if (!apiKey) {
    const response = {
      success: false,
      error: "Missing API key. Include 'x-api-key' header."
    };
    return res.status(401).json(response);
  }
  if (apiKey !== SHIPPER_API_KEY) {
    console.warn("[Auth] Invalid API key attempt");
    const response = {
      success: false,
      error: "Invalid API key"
    };
    return res.status(401).json(response);
  }
  next();
}

// src/middleware/request-logger.ts
init_esm_shims();
var requestLogger = (req, res, next) => {
  const isDevelopment = process.env.NODE_ENV !== "production";
  if (!isDevelopment) {
    next();
    return;
  }
  const startTime = Date.now();
  logger.info({
    type: "request",
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get("user-agent")
  });
  res.on("finish", () => {
    const duration = Date.now() - startTime;
    const logLevel = res.statusCode >= 400 ? "error" : "info";
    logger[logLevel]({
      type: "response",
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`
    });
  });
  next();
};

// src/middleware/project-context.ts
init_esm_shims();
var projectContextMiddleware = (req, _res, next) => {
  const projectId = req.params.projectId || req.body?.projectId || req.query.projectId;
  if (projectId) {
    req.logger = logger.child({ projectId });
    req.projectId = projectId;
  } else {
    req.logger = logger;
  }
  next();
};

// src/index.ts
dotenv.config();
var app = express();
var PORT = process.env.PORT || 4e3;
var ALLOWED_ORIGINS = [
  "http://localhost:3000",
  // Development
  "http://localhost:3001",
  // Alternative development port
  process.env.WEB_APP_URL,
  // Production (e.g., https://shipper.app)
  process.env.NEXT_PUBLIC_APP_URL
  // Alternative production URL
].filter(Boolean);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      if (origin.endsWith(".vercel.app")) {
        return callback(null, true);
      }
      if (origin.endsWith(".up.railway.app")) {
        return callback(null, true);
      }
      if (origin.endsWith(".shipper.app") || origin === "https://shipper.app") {
        return callback(null, true);
      }
      if (process.env.NODE_ENV === "development") {
        return callback(null, true);
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    // Allow cookies to be sent
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-api-key",
      "x-chat-token"
    ]
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(requestLogger);
app.use(projectContextMiddleware);
app.use(validateApiKey);
app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: "ok",
      timestamp: formatDate(/* @__PURE__ */ new Date()),
      database: "connected"
    });
  } catch (error) {
    res.status(503).json({
      status: "error",
      timestamp: formatDate(/* @__PURE__ */ new Date()),
      database: "disconnected",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});
app.get("/api/hello", (_req, res) => {
  const response = {
    success: true,
    data: { message: "Hello from the Shipper API!" }
  };
  res.json(response);
});
app.use("/api/v1/daytona", daytona_default);
app.use("/api/v1/modal", modal_default);
app.use("/api/v1/convex", convex_default);
app.use("/api/v1/daytona/errors", errors_default);
app.use("/api/v1/chat", chat_default);
app.use("/api/v1/upload", upload_default);
app.use("/api/v1/domains", domains_default);
app.use("/api/v1/domains-dns", domains_dns_default);
app.use("/api/v1/database", database_default);
app.use("/api/v1/ai", ai_proxy_default);
app.use("/api/v1/shipper-cloud", shipper_cloud_admin_default);
app.use("/api/v1/connectors", connectors_default);
app.get("/api/v1/projects", async (_req, res) => {
  try {
    const response = {
      success: true,
      data: {
        projects: [],
        message: "Projects endpoint - ready for implementation"
      }
    };
    res.json(response);
  } catch (error) {
    const response = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch projects"
    };
    res.status(500).json(response);
  }
});
app.use((_req, res) => {
  const response = {
    success: false,
    error: "Not found"
  };
  res.status(404).json(response);
});
process.on("SIGTERM", async () => {
  logger.info("SIGTERM signal received: closing HTTP server");
  await prisma.$disconnect();
  process.exit(0);
});
app.listen(PORT, () => {
  logger.info({
    msg: "API server started successfully",
    port: PORT,
    url: `http://localhost:${PORT}`,
    healthCheck: `http://localhost:${PORT}/health`,
    database: "connected",
    environment: process.env.NODE_ENV || "development"
  });
});
