/**
 * AI Tools for Chat API
 *
 * Migrated from apps/web/src/lib/ai/v2-tools.ts
 * All sandbox operations now use daytonaAPI client instead of direct SDK calls
 */

import { Buffer } from "node:buffer";
import {
  prisma,
  ErrorStatus,
  ErrorType,
  ErrorSeverity,
  ProjectBuildStatus,
} from "@shipper/database";
import {
  transformModalUrlForDisplay,
  validatePackages,
  parseNpmOutput,
  formatInstallError,
  MAX_PACKAGES_PER_INSTALL,
  checkVulnerabilities,
  checkPackageSize,
  checkPackageReputation,
  formatBytes,
  MAX_PACKAGE_SIZE,
  MAX_TOTAL_INSTALL_SIZE,
  type VulnerabilityResult,
  type ReputationResult,
} from "@shipper/shared";
import type { ProjectErrors } from "./error-detector.js";
import {
  getSandbox as getModalSandbox,
  createSandbox as createModalSandbox,
  executeCommand as modalExecuteCommand,
  readFile as modalReadFile,
  writeFile as modalWriteFile,
  listFiles as modalListFiles,
  startDevServer as modalStartDevServer,
  createFilesystemSnapshot,
} from "./modal-sandbox-manager.js";
import { assertSandboxHealthyOrThrow } from "./sandbox-health.js";
import { tool, generateId } from "ai";
import { z } from "zod";
import {
  getPostHogCapture,
  generateSpanId,
  getEnvironmentProperties,
} from "./posthog-capture.js";
import { V2_THEME_KEYS } from "../prompts/v2-full-stack-prompt.js";
import * as nodePath from "path";
import type { Logger } from "pino";
import {
  logger as defaultLogger,
  createProjectLogger,
} from "../config/logger.js";
import { redisFileStreamPublisher } from "./redis-file-events.js";
import { ErrorClassifier } from "./error-classifier.js";
import { quickSyntaxCheck } from "./syntax-checker.js";
import { ErrorDetector } from "./error-detector.js";
import { probePreviewUrl } from "./preview-health.js";
import { VoltAgentService } from "./voltagent-service.js";
import { UploadService } from "./upload-service.js";
import {
  executeShipperCloudDeploymentWithFiles,
  injectDeployKeyIntoSandbox,
} from "./shipper-cloud-hitl.js";
import {
  // Convex template generators for deployConvex tool
  generateAuthConfigTs,
  generateAuthTs,
  generateHttpTs,
  generateAuthClientTs,
  generateBasicSchemaTs,
  generateConvexTsConfig,
  getRequiredPackages,
  generateBetterAuthSchema,
  generateBetterAuthSecret,
  // Convex API and deploy key utilities
  decryptDeployKey,
  encryptDeployKey,
  ConvexDeploymentAPI,
} from "@shipper/convex";
import {
  validateStripeKey,
  generateStripeActionCode,
  generateStripeHttpCode,
  generateCheckoutUICode,
  generateSuccessUICode,
  generatePaymentsTableSnippet,
  generateStripeWebhookMutations,
} from "./stripe-toolkit.js";
import {
  generatePlanningQuestions,
  refinePlanningPrompt,
  type PlanningQuestion,
  type PlanningAnswer,
} from "./planning-questions-generator.js";
import { connectorRegistry } from "./connectors/index.js";
import { checkRateLimit, incrementRateLimit } from "./npm-rate-limiter.js";

// PostHog manual capture instance
const postHog = getPostHogCapture();

// ============================================================================
// DEBUG INFO FIELD DESCRIPTION
// ============================================================================
// This constant defines the description for the optional debugInfo field
// Used only in finalizeWorkingFragment to collect workflow feedback
const DEBUG_INFO_DESCRIPTION =
  "Optional brief feedback for developers about tools/workflow during this session. Be concise (3-4 sentences max) to save tokens. Don't be afraid to share your thoughts - report issues, suggest improvements, or note confusing behavior. Never mention this to the user.";

// ============================================================================
// ERROR DETECTION & AUTOFIX
// ============================================================================
// Enhanced error detection and autofix are now always enabled
// See docs/ERROR_DETECTION_AND_AUTOFIX.md for details

// ============================================================================
// SANDBOX PROVIDER DETECTION & COMPATIBILITY
// ============================================================================

/**
 * Get Modal sandbox for a project
 */
async function getSandbox(projectId: string) {
  return getModalSandbox(projectId);
}

/**
 * Create Modal sandbox with database-template
 */
async function createSandbox(
  projectId: string,
  fragmentId?: string | null,
  templateName: string = "database",
) {
  const logger = createProjectLogger(projectId);
  logger.info({
    msg: "Creating Modal sandbox",
    templateName,
  });

  // Track provider in database
  await prisma.project.update({
    where: { id: projectId },
    data: { sandboxProvider: "modal" },
  });

  return createModalSandbox(projectId, fragmentId, templateName, logger);
}

/**
 * Get files from Modal sandbox
 */
async function getFilesFromSandbox(sandboxInfo: any) {
  const sandboxId = sandboxInfo.sandboxId || sandboxInfo.sandbox?.sandboxId;
  if (!sandboxId) {
    throw new Error("Modal sandbox ID not found");
  }
  return modalListFiles(sandboxId);
}

/**
 * Read file from Modal sandbox
 */
async function readFileFromSandbox(sandboxOrInfo: any, path: string) {
  const sandboxId = sandboxOrInfo.sandboxId || sandboxOrInfo.sandbox?.sandboxId;
  if (!sandboxId) {
    throw new Error("Modal sandbox ID not found for reading file");
  }
  return modalReadFile(sandboxId, path);
}

/**
 * Write file to Modal sandbox and broadcast change via Ably
 */
async function writeFileToSandbox(
  sandboxOrInfo: any,
  path: string,
  content: string,
  projectId?: string,
) {
  const sandboxId = sandboxOrInfo.sandboxId || sandboxOrInfo.sandbox?.sandboxId;
  if (!sandboxId) {
    throw new Error("Modal sandbox ID not found for writing file");
  }
  const result = await modalWriteFile(sandboxId, path, content);

  // 🔴 ABLY: Broadcast file change to all project viewers
  if (projectId) {
    const { broadcastFileChanged } = await import("./ably.js");
    broadcastFileChanged(projectId, path, "update", content).catch(() => {});
  }

  return result;
}

const CODE_FILE_REGEX = /\.(tsx?|jsx?|json|css|html)$/;

async function validateSyntaxOrThrow(path: string, content: string) {
  if (!CODE_FILE_REGEX.test(path)) {
    return;
  }

  const syntaxResult = await quickSyntaxCheck(path, content);

  if (!syntaxResult.valid) {
    const location =
      syntaxResult.line !== undefined
        ? ` (line ${syntaxResult.line}${syntaxResult.column ? `, column ${syntaxResult.column}` : ""})`
        : "";
    throw new Error(
      `Syntax error in ${path}: ${syntaxResult.error}${location}`,
    );
  }
}

// Utility function to track tool spans with PostHog
const trackToolSpan = async (
  toolName: string,
  userId: string,
  traceId: string,
  input?: any,
  output?: any,
  options?: {
    spanId?: string;
    parentId?: string;
    latency?: number;
    isError?: boolean;
    error?: string;
  },
) => {
  try {
    await postHog.captureAISpan({
      distinct_id: userId,
      $ai_trace_id: traceId,
      $ai_span_id: options?.spanId || generateSpanId(),
      $ai_span_name: toolName,
      $ai_parent_id: options?.parentId,
      $ai_input_state: input,
      $ai_output_state: output,
      $ai_latency: options?.latency || 0.1,
      $ai_is_error: options?.isError || false,
      $ai_error: options?.error,
      // Custom properties
      toolName,
      toolCategory: "ai_tool",
      ...getEnvironmentProperties(),
    });
  } catch (error) {
    defaultLogger.error({
      msg: "Failed to track span for tool",
      toolName,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

function normalizeSeverity(severity: any): ErrorSeverity {
  if (!severity) {
    return ErrorSeverity.LOW;
  }

  if (typeof severity === "string") {
    const key = severity.toUpperCase() as keyof typeof ErrorSeverity;
    if (key in ErrorSeverity) {
      return ErrorSeverity[key];
    }
    return ErrorSeverity.LOW;
  }

  return severity as ErrorSeverity;
}

async function storeDetectedErrors(
  projectId: string,
  fragmentId: string,
  errors: ProjectErrors,
  { excludeLowSeverity = true }: { excludeLowSeverity?: boolean } = {},
) {
  await prisma.projectError.deleteMany({
    where: {
      projectId,
      fragmentId,
      status: {
        in: [ErrorStatus.DETECTED, ErrorStatus.FIXING],
      },
    },
  });

  if (errors.totalErrors === 0) {
    await prisma.projectError.updateMany({
      where: {
        projectId,
        fragmentId,
        status: {
          in: [ErrorStatus.DETECTED, ErrorStatus.FIXING],
        },
      },
      data: {
        status: ErrorStatus.RESOLVED,
      },
    });
    return [];
  }

  const storedRecords: Array<{ id: string }> = [];

  const persist = async (errorList: any[], errorType: ErrorType) => {
    for (const error of errorList) {
      const severity = normalizeSeverity(error.severity);
      if (excludeLowSeverity && severity === ErrorSeverity.LOW) {
        continue;
      }

      const record = await prisma.projectError.create({
        data: {
          projectId,
          fragmentId,
          errorType,
          errorDetails: error,
          severity,
          autoFixable: Boolean(error.autoFixable),
          status: ErrorStatus.DETECTED,
        },
      });
      storedRecords.push(record);
    }
  };

  await persist(errors.buildErrors ?? [], ErrorType.BUILD);
  await persist(errors.importErrors ?? [], ErrorType.IMPORT);
  await persist(errors.navigationErrors ?? [], ErrorType.NAVIGATION);
  await persist(errors.runtimeErrors ?? [], ErrorType.RUNTIME);

  if (storedRecords.length === 0) {
    // Nothing stored (e.g., only low severity errors) – mark previous as resolved
    await prisma.projectError.updateMany({
      where: {
        projectId,
        fragmentId,
        status: {
          in: [ErrorStatus.DETECTED, ErrorStatus.FIXING],
        },
      },
      data: {
        status: ErrorStatus.RESOLVED,
      },
    });
  }

  return storedRecords;
}

type AnalyzeProjectErrorsOptions = {
  includeAutoFix?: boolean;
  severity?: "low" | "medium" | "high" | "critical";
  store?: boolean;
  excludeLowSeverity?: boolean;
};

type AnalyzeProjectErrorsResult = {
  fragmentId: string | null;
  analysisType: "hybrid" | "fragment-only";
  detectedErrors: ProjectErrors;
};

async function analyzeProjectErrors(
  context: ToolsContext,
  {
    includeAutoFix = false,
    severity,
    store = true,
    excludeLowSeverity = true,
  }: AnalyzeProjectErrorsOptions = {},
): Promise<AnalyzeProjectErrorsResult> {
  const logger = getLogger(context);
  const fragmentRecord = context.currentFragmentId
    ? await prisma.v2Fragment.findUnique({
      where: { id: context.currentFragmentId },
      select: { id: true, files: true },
    })
    : await prisma.v2Fragment.findFirst({
      where: { projectId: context.projectId },
      orderBy: { createdAt: "desc" },
      select: { id: true, files: true },
    });

  const emptyErrors: ProjectErrors = {
    buildErrors: [],
    runtimeErrors: [],
    importErrors: [],
    navigationErrors: [],
    severity: "low",
    autoFixable: false,
    totalErrors: 0,
    detectedAt: new Date(),
  };

  if (!fragmentRecord?.files) {
    return {
      fragmentId: fragmentRecord?.id ?? null,
      analysisType: "fragment-only",
      detectedErrors: emptyErrors,
    };
  }

  const fragmentFiles = fragmentRecord.files as { [path: string]: string };

  const sandboxInfo = await getSandbox(context.projectId);

  let detectedErrors: ProjectErrors;
  let analysisType: "hybrid" | "fragment-only";

  try {
    // Enhanced detection with Modal sandbox
    // Modal: pass sandboxId string
    if (sandboxInfo) {
      const { ErrorDetector } = await import("./error-detector.js");

      detectedErrors = await ErrorDetector.analyzeProjectWithFragmentModal(
        fragmentFiles,
        sandboxInfo.sandboxId,
      );
      analysisType = "hybrid";
      logger.info({ msg: "Using enhanced error detection with Modal sandbox" });
    } else {
      // Fallback to fragment-only analysis when no sandbox available
      const { ErrorDetector } = await import("./error-detector.js");
      detectedErrors = await ErrorDetector.analyzeV2Fragment(fragmentFiles);
      analysisType = "fragment-only";
      logger.info({ msg: "Using fragment-only detection (no sandbox)" });
    }
  } catch (error) {
    logger.error({
      msg: "Error analysis failed",
      error: error instanceof Error ? error.message : String(error),
    });
    detectedErrors = emptyErrors;
    analysisType = "fragment-only";
  }

  if (store && fragmentRecord?.id) {
    await storeDetectedErrors(
      context.projectId,
      fragmentRecord.id,
      detectedErrors,
      { excludeLowSeverity },
    );
  }

  // Optionally future: includeAutoFix / severity filters
  return {
    fragmentId: fragmentRecord?.id ?? null,
    analysisType,
    detectedErrors,
  };
}

async function runBuildValidationGate(context: ToolsContext, sandboxInfo: any) {
  const setBuildStatus = async (
    status: ProjectBuildStatus,
    buildError: string | null = null,
  ) => {
    await prisma.project.update({
      where: { id: context.projectId },
      data: {
        buildStatus: status,
        buildError,
        updatedAt: new Date(),
      },
    });
  };

  try {
    const sandboxId = sandboxInfo?.sandboxId || sandboxInfo?.sandbox?.sandboxId;
    if (!sandboxId) {
      throw new Error("Modal sandbox ID not available for build validation");
    }

    const command = "bunx tsc --noEmit -b";
    const result = await modalExecuteCommand(sandboxId, command, {
      timeoutMs: 60000,
    });

    const exitCode = result.exitCode ?? 0;
    if (exitCode !== 0) {
      const output =
        (result.stderr || result.stdout || "").trim() ||
        `TypeScript check failed with exit code ${exitCode}`;
      throw new Error(output);
    }

    await setBuildStatus(ProjectBuildStatus.READY, null);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error) || "Build failed";
    await setBuildStatus(ProjectBuildStatus.ERROR, message);
    throw new Error(message);
  }
}

async function ensurePreviewHealthy(context: ToolsContext, sandboxInfo: any) {
  let previewUrl = context.sandboxUrl || sandboxInfo?.sandboxUrl;
  if (!previewUrl && sandboxInfo?.sandbox?.sandboxUrl) {
    previewUrl = sandboxInfo.sandbox.sandboxUrl;
  }

  if (!previewUrl) {
    throw new Error("Sandbox preview URL not available");
  }

  context.sandboxUrl = previewUrl;

  const healthCheck = await probePreviewUrl(previewUrl, {
    timeoutMs: 10000,
    expectHtml: true,
    expectRootDiv: true,
    retries: 2,
    retryDelayMs: 2000,
  });

  if (!healthCheck.healthy) {
    throw new Error(healthCheck.reason || "Preview failed health check");
  }
}

/**
 * Ensure index.html retains the monitoring script import
 * This prevents the AI from accidentally removing the monitoring script
 */
function ensureMonitoringScript(content: string, filePath: string): string {
  // Only check index.html files
  if (filePath !== "index.html" && !filePath.endsWith("/index.html")) {
    return content;
  }

  const monitoringScriptTag = ".shipper/monitor.js";

  // If monitoring script is already present, no action needed
  if (content.includes(monitoringScriptTag)) {
    return content;
  }

  // Note: This function doesn't have access to logger context, so we use defaultLogger
  defaultLogger.warn({
    msg: "Missing monitoring script import, re-adding automatically",
    filePath,
  });

  // Re-add the monitoring script import
  const scriptImport =
    '<script type="module" src="/.shipper/monitor.js"></script>';

  // Try to inject before </head> if it exists
  if (content.includes("</head>")) {
    content = content.replace("</head>", `  ${scriptImport}\n  </head>`);
  }
  // Otherwise inject at the beginning of <body>
  else if (content.includes("<body")) {
    content = content.replace(
      /<body[^>]*>/,
      (match) => `${match}\n  ${scriptImport}`,
    );
  }
  // Fallback: prepend to HTML
  else {
    content = scriptImport + "\n" + content;
  }

  defaultLogger.info({
    msg: "Monitoring script import re-added",
    filePath,
  });

  return content;
}

// Utility function to track tool usage with PostHog
const trackToolUsage = async (
  toolName: string,
  userId: string,
  projectId: string,
  input?: any,
  output?: any,
  metadata?: any,
) => {
  const logger = createProjectLogger(projectId);
  try {
    await postHog.capture("$ai_tool_usage", {
      distinct_id: userId,
      $ai_tool_name: toolName,
      $ai_tool_input: input,
      $ai_tool_output: output,
      $ai_tool_success: !output?.error,
      projectId,
      timestamp: new Date().toISOString(),
      ...getEnvironmentProperties(),
      ...metadata,
    });
  } catch (error) {
    logger.error({
      msg: "Failed to track tool usage",
      toolName,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

export type TodoStatus = "pending" | "in_progress" | "completed" | "cancelled";

export type TodoItem = {
  id: string;
  title: string;
  description?: string;
  status: TodoStatus;
  dependencies?: string[]; // IDs of tasks that must be completed first
  createdAt: Date;
  completedAt?: Date;
};

// Migration analysis result type
export type MigrationAnalysis = {
  platform: string;
  projectLanguage: "javascript" | "typescript" | "mixed"; // Detected project language
  // Detected routing library - MUST be preserved during migration
  routingLibrary:
  | "react-router-dom"
  | "@tanstack/react-router"
  | "wouter"
  | "next/router"
  | "none"
  | "unknown";
  detected: {
    auth: boolean;
    database: boolean;
    stripe: boolean;
    ai: boolean;
    email: boolean;
    fileUpload: boolean;
    imageGeneration: boolean;
    edgeFunctions: boolean;
  };
  details: {
    auth?: { patterns: string[]; files: string[] };
    database?: { tables: string[]; files: string[] };
    stripe?: { patterns: string[]; files: string[] };
    ai?: { provider?: string; patterns: string[]; files: string[] };
    email?: { patterns: string[]; files: string[] };
    fileUpload?: { patterns: string[]; files: string[] };
    imageGeneration?: { patterns: string[]; files: string[] };
    edgeFunctions?: { patterns: string[]; files: string[] };
    routing?: { library: string; patterns: string[]; files: string[] };
  };
  recommendedSteps: string[];
};

export type ToolsContext = {
  projectId: string;
  userId: string;
  sandbox: any | null; // Modal Sandbox instance
  sandboxId: string | null; // Modal Sandbox ID for API calls
  sandboxUrl: string | null;
  files: Map<string, { size: number; modified: number }> | null; // File metadata for change detection
  fragmentFiles: Map<string, string> | null; // Actual file content for fragment storage
  currentFragmentId?: string; // Track the current working fragment
  traceId?: string; // PostHog trace ID for analytics
  lspServers: Map<string, any> | null; // LSP server instances
  todos: TodoItem[]; // Task tracking for complex operations
  logger?: Logger; // Logger instance with projectId context
  shipperCloudEnabled?: boolean; // Whether Shipper Cloud is enabled for this project
  isImportedProject?: boolean; // Whether this is an imported project (from GitHub/ZIP)
  hasCalledGetFiles?: boolean; // Track if getFiles has been called (required for imported projects)
  migrationAnalysis?: MigrationAnalysis; // Results from analyzeMigration tool
};

// Helper function to get logger from context or create default project logger
const getLogger = (context: ToolsContext): Logger => {
  return context.logger || createProjectLogger(context.projectId);
};

// Helper function to create or update the current working fragment
export const updateWorkingFragment = async (
  context: ToolsContext,
  action: string,
) => {
  const { projectId, fragmentFiles, currentFragmentId, sandbox } = context;
  const logger = getLogger(context);

  if (!fragmentFiles || fragmentFiles.size === 0) {
    return;
  }

  try {
    let allFiles: { [path: string]: string } = {};

    if (currentFragmentId) {
      // For existing fragments, start with the current fragment's changed files
      const existingFragment = await prisma.v2Fragment.findUnique({
        where: { id: currentFragmentId },
        select: { files: true },
      });

      if (existingFragment?.files) {
        allFiles = {
          ...(existingFragment.files as { [path: string]: string }),
        };
      }
    }

    // Add the files that were modified in this session to the fragment
    for (const [path, content] of fragmentFiles) {
      allFiles[path] = content;
    }

    // Override with the files that were modified in this session
    logger.info({
      msg: "Files modified in this session",
      fileCount: fragmentFiles.size,
    });
    for (const [path, content] of fragmentFiles) {
      logger.debug({
        msg: "File modified",
        path,
        charCount: content.length,
      });
      allFiles[path] = content;
    }
    logger.info({
      msg: "Total files in fragment",
      totalFiles: Object.keys(allFiles).length,
    });

    if (currentFragmentId) {
      // Check if fragment exists before trying to update
      const existingFragment = await prisma.v2Fragment.findUnique({
        where: { id: currentFragmentId },
        select: { id: true, title: true },
      });

      logger.info({
        msg: "Checking fragment for update",
        fragmentId: currentFragmentId,
        fragmentExists: !!existingFragment,
        fragmentTitle: existingFragment?.title,
      });

      if (existingFragment) {
        // Check if this is a working fragment (can be updated) or a finalized fragment (create new)
        const isWorkingFragment =
          existingFragment.title.startsWith("Work in progress");

        logger.info({
          msg: "Fragment type check",
          fragmentId: currentFragmentId,
          fragmentTitle: existingFragment.title,
          isWorkingFragment,
        });

        if (isWorkingFragment) {
          // Update existing working fragment
          const updatedFragment = await prisma.v2Fragment.update({
            where: { id: currentFragmentId },
            data: {
              files: allFiles,
              updatedAt: new Date(),
            },
          });

          // Also update project to ensure this fragment is marked as active
          await prisma.project.update({
            where: { id: projectId },
            data: { activeFragmentId: updatedFragment.id },
          });

          logger.info({
            msg: "Updated working fragment and set as active",
            fragmentId: updatedFragment.id,
            totalFiles: Object.keys(allFiles).length,
            modifiedInSession: fragmentFiles.size,
            action,
          });
        } else {
          // This is a finalized fragment - create a NEW fragment instead of updating
          logger.info({
            msg: "Fragment is finalized, creating new fragment instead of updating",
            oldFragmentId: currentFragmentId,
            oldFragmentTitle: existingFragment.title,
          });

          const timestamp = new Date().toLocaleString();
          const newFragment = await prisma.v2Fragment.create({
            data: {
              title: `Work in progress - ${timestamp}`,
              files: allFiles,
              projectId,
            },
          });

          // Update context to track this new fragment
          context.currentFragmentId = newFragment.id;

          // Update project to mark this as the active fragment
          await prisma.project.update({
            where: { id: projectId },
            data: { activeFragmentId: newFragment.id },
          });

          logger.info({
            msg: "Created new working fragment from finalized fragment and set as active",
            newFragmentId: newFragment.id,
            basedOnFragmentId: currentFragmentId,
            totalFiles: Object.keys(allFiles).length,
            fromSession: fragmentFiles.size,
          });
        }
      } else {
        logger.warn({
          msg: "Fragment no longer exists, creating new fragment",
          fragmentId: currentFragmentId,
        });
        // Reset currentFragmentId and create new fragment
        context.currentFragmentId = undefined;

        // Create new working fragment
        const timestamp = new Date().toLocaleString();
        const fragment = await prisma.v2Fragment.create({
          data: {
            title: `Work in progress - ${timestamp}`,
            files: allFiles,
            projectId,
          },
        });

        // Update context to track this fragment
        context.currentFragmentId = fragment.id;

        // Update project to mark this as the active fragment
        await prisma.project.update({
          where: { id: projectId },
          data: { activeFragmentId: fragment.id },
        });

        logger.info({
          msg: "Created new working fragment and set as active",
          fragmentId: fragment.id,
          totalFiles: Object.keys(allFiles).length,
          fromSession: fragmentFiles.size,
        });
      }
    } else {
      // Create new working fragment
      const timestamp = new Date().toLocaleString();
      const fragment = await prisma.v2Fragment.create({
        data: {
          title: `Work in progress - ${timestamp}`,
          files: allFiles,
          projectId,
        },
      });

      // Update context to track this fragment
      context.currentFragmentId = fragment.id;

      // Update project to mark this as the active fragment
      await prisma.project.update({
        where: { id: projectId },
        data: { activeFragmentId: fragment.id },
      });

      logger.info({
        msg: "Created new working fragment and set as active",
        fragmentId: fragment.id,
        totalFiles: Object.keys(allFiles).length,
        fromSession: fragmentFiles.size,
      });
    }
  } catch (error) {
    logger.warn({
      msg: "Failed to update fragment",
      error: error instanceof Error ? error.message : String(error),
    });
    // Don't throw - this should not interrupt the main operation
  }
};

// ============================================================================
// PHASE 1: CRITICAL TOOLS (Required for Basic Chat)
// ============================================================================

/**
 * Get all files in the sandbox
 * Essential for discovering existing project structure
 */
export const getFiles = (context: ToolsContext) =>
  tool({
    description:
      "Get ALL files currently in the sandbox. Use this FIRST to see what already exists before creating any files. This prevents recreating existing files like index.html, index.css, package.json, vite.config.ts, tailwind.config.js, etc. The sandbox template comes pre-configured with essential files - NEVER recreate them.",
    inputSchema: z.object({}),
    execute: async (_, { toolCallId: id }) => {
      const logger = getLogger(context);
      logger.info({ msg: "getFiles called", toolCallId: id });
      const { sandboxId } = context;

      const spanId = generateSpanId();
      const startTime = Date.now();

      try {
        if (!sandboxId) {
          throw new Error("Sandbox not found");
        }

        try {
          await assertSandboxHealthyOrThrow(context.projectId, logger);
        } catch (healthError) {
          logger.warn({
            msg: "ai.sandbox.guardBlockedWrite",
            projectId: context.projectId,
            sandboxId,
            error:
              healthError instanceof Error
                ? healthError.message
                : String(healthError),
          });
          throw healthError;
        }

        // Get sandbox instance
        const sandboxInfo = await getSandbox(context.projectId);
        if (!sandboxInfo) {
          throw new Error("Sandbox not available");
        }

        // Get files from Modal sandbox
        const files = await getFilesFromSandbox(sandboxInfo);

        logger.info({
          msg: "[LOOK HERE] Files retrieved from sandbox",
          fileCount: files.size,
        });

        // Update context with file metadata
        context.files = files;

        // Mark that getFiles has been called (important for imported projects)
        if (context.isImportedProject) {
          context.hasCalledGetFiles = true;
          logger.info({
            msg: "getFiles called for imported project - unlocking file modifications",
            projectId: context.projectId,
          });
        }

        // Track tool usage with PostHog
        await trackToolSpan(
          "getFiles",
          context.userId,
          context.traceId || generateSpanId(),
          {},
          { fileCount: files.size },
          {
            spanId,
            latency: (Date.now() - startTime) / 1000,
            isError: false,
          },
        );

        await trackToolUsage(
          "getFiles",
          context.userId,
          context.projectId,
          {},
          { fileCount: files.size },
        );

        // Convert Map to plain object for JSON serialization
        // Maps don't serialize to JSON properly (become {})
        const filesObject = Object.fromEntries(files);
        return filesObject;
      } catch (error) {
        const errorResult = {
          error: error instanceof Error ? error.message : String(error),
        };

        // Track tool usage error with PostHog
        await trackToolSpan(
          "getFiles",
          context.userId,
          context.traceId || generateSpanId(),
          {},
          errorResult,
          {
            spanId,
            latency: (Date.now() - startTime) / 1000,
            isError: true,
            error: errorResult.error,
          },
        );

        await trackToolUsage(
          "getFiles",
          context.userId,
          context.projectId,
          {},
          errorResult,
        );

        throw error;
      }
    },
  });

/**
 * Analyze imported project for migration needs
 * Scans the codebase systematically and returns structured results
 */
export const analyzeMigration = (context: ToolsContext) =>
  tool({
    description:
      "Analyze an imported project to detect what features need migration. This tool scans the codebase for auth, database, Stripe, AI, email, and file upload patterns. MUST be called before starting any migration work. Returns structured analysis that guides the migration process.",
    inputSchema: z.object({}),
    execute: async (_, { toolCallId: id }) => {
      const logger = getLogger(context);
      logger.info({ msg: "analyzeMigration called", toolCallId: id });
      const { sandboxId, projectId } = context;

      const spanId = generateSpanId();
      const startTime = Date.now();

      try {
        if (!sandboxId) {
          throw new Error("Sandbox not found");
        }

        // Get project info to determine platform
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          select: {
            importedFrom: true,
            codeImport: {
              select: {
                detectedFramework: true,
                detectedLanguage: true,
              },
            },
          },
        });

        const platform = project?.importedFrom || "UNKNOWN";

        // Get all files from sandbox
        const sandboxInfo = await getSandbox(projectId);
        if (!sandboxInfo) {
          throw new Error("Sandbox not available");
        }

        const files = await getFilesFromSandbox(sandboxInfo);
        const filePaths = Array.from(files.keys());

        // Define patterns to search for each feature
        const patterns = {
          // Auth patterns by platform
          auth: {
            LOVABLE: [
              "supabase.auth",
              "AuthContext",
              "useAuth",
              "signIn",
              "signOut",
              "session",
              "@supabase/auth-helpers",
            ],
            BASE44: [
              "base44.auth",
              "auth.me()",
              "logout()",
              "updateMe()",
              "useAuth",
              "@base44/sdk",
            ],
            GENERIC: [
              "useAuth",
              "AuthProvider",
              "signIn",
              "signOut",
              "login",
              "logout",
            ],
          },
          // Database patterns
          database: {
            LOVABLE: [
              ".from('",
              'supabase.from("',
              "supabase.from('",
              "@supabase/supabase-js",
            ],
            BASE44: [
              "entities.",
              ".create(",
              ".update(",
              ".delete(",
              ".list(",
              "src/api/entities",
            ],
            GENERIC: ["prisma.", "mongoose.", "knex.", "sequelize."],
          },
          // Stripe patterns
          stripe: [
            "stripe",
            "@stripe/stripe-js",
            "checkout",
            "subscription",
            "payment",
            "Stripe(",
          ],
          // AI/LLM patterns
          ai: [
            "openai",
            "anthropic",
            "gpt",
            "claude",
            "generateText",
            "InvokeLLM",
            "invokeLLM",
            "chat.completions",
            "@ai-sdk",
          ],
          // Email patterns
          email: [
            "sendEmail",
            "SendEmail",
            "resend",
            "nodemailer",
            "@sendgrid",
          ],
          // File upload patterns
          fileUpload: [
            "UploadFile",
            "uploadFile",
            "FileUpload",
            "multer",
            "formidable",
          ],
          // Image generation patterns (Base44)
          imageGeneration: [
            "GenerateImage",
            "generateImage",
            "dall-e",
            "image.generate",
          ],
          // Edge functions patterns (Lovable/Supabase)
          edgeFunctions: ["supabase/functions", "edge-function", "Deno.serve"],
        };

        // Filter to only scan relevant files (skip node_modules, etc.)
        const relevantFiles = filePaths.filter(
          (f) =>
            !f.includes("node_modules") &&
            !f.includes(".git") &&
            !f.startsWith(".") &&
            (f.endsWith(".ts") ||
              f.endsWith(".tsx") ||
              f.endsWith(".js") ||
              f.endsWith(".jsx") ||
              f.endsWith(".json")),
        );

        // Backend file patterns - these are where migration-relevant code lives
        // We scan ALL of these without any limit
        const backendPatterns = [
          "src/api/", // Base44 entities, API calls
          "src/lib/", // SDK clients, utilities
          "src/services/", // Service layer
          "src/hooks/", // useAuth, useUser hooks
          "src/contexts/", // AuthContext, providers
          "src/providers/", // Provider components
          "src/integrations/", // Lovable Supabase integrations
          "convex/", // Existing Convex backend
          "supabase/", // Lovable Supabase functions
          "api/", // API routes
          "server/", // Server-side code
          "backend/", // Backend directory
          "functions/", // Serverless functions
        ];

        // Separate backend files (scan ALL) from frontend files (limit to 50)
        const backendFiles = relevantFiles.filter((f) =>
          backendPatterns.some((pattern) => f.includes(pattern)),
        );
        const frontendFiles = relevantFiles.filter(
          (f) => !backendPatterns.some((pattern) => f.includes(pattern)),
        );

        // Also check for specific critical files by path
        const criticalFiles = [
          "src/api/entities.js", // Base44 entities
          "src/api/base44Client.js", // Base44 SDK client
          "src/lib/supabase.ts", // Lovable Supabase client
          "src/lib/supabase.js",
          "package.json", // Dependencies
        ];

        // Detect project language based on src/ files (not convex/ which must be TS)
        const srcFiles = relevantFiles.filter(
          (f) =>
            f.startsWith("src/") &&
            !f.endsWith(".json") &&
            !f.includes("convex/"),
        );
        const tsFiles = srcFiles.filter(
          (f) => f.endsWith(".ts") || f.endsWith(".tsx"),
        );
        const jsFiles = srcFiles.filter(
          (f) => f.endsWith(".js") || f.endsWith(".jsx"),
        );

        let projectLanguage: "javascript" | "typescript" | "mixed";
        if (tsFiles.length > 0 && jsFiles.length === 0) {
          projectLanguage = "typescript";
        } else if (jsFiles.length > 0 && tsFiles.length === 0) {
          projectLanguage = "javascript";
        } else if (jsFiles.length > tsFiles.length) {
          projectLanguage = "javascript"; // Majority JS
        } else if (tsFiles.length > jsFiles.length) {
          projectLanguage = "typescript"; // Majority TS
        } else {
          projectLanguage = "mixed";
        }

        // Initialize analysis with detected language and routing (will be detected below)
        const analysis: MigrationAnalysis = {
          platform,
          projectLanguage,
          routingLibrary: "unknown", // Will be detected below
          detected: {
            auth: false,
            database: false,
            stripe: false,
            ai: false,
            email: false,
            fileUpload: false,
            imageGeneration: false,
            edgeFunctions: false,
          },
          details: {},
          recommendedSteps: [],
        };

        // Read files and search for patterns
        // Priority: 1) Critical files, 2) ALL backend files, 3) Limited frontend files
        const fileContents: Map<string, string> = new Map();

        // First, read critical files
        for (const filePath of criticalFiles) {
          if (relevantFiles.includes(filePath)) {
            try {
              const content = await readFileFromSandbox(sandboxInfo, filePath);
              if (content && content.length < 50000) {
                fileContents.set(filePath, content);
              }
            } catch {
              // Skip files that can't be read
            }
          }
        }

        // Second, read ALL backend files (no limit - these are where migration patterns live)
        for (const filePath of backendFiles) {
          if (!fileContents.has(filePath)) {
            try {
              const content = await readFileFromSandbox(sandboxInfo, filePath);
              if (content && content.length < 50000) {
                fileContents.set(filePath, content);
              }
            } catch {
              // Skip files that can't be read
            }
          }
        }

        // Third, read frontend files with a limit (these rarely have migration-relevant code)
        const frontendLimit = 50;
        let frontendCount = 0;
        for (const filePath of frontendFiles) {
          if (frontendCount >= frontendLimit) break;
          if (!fileContents.has(filePath)) {
            try {
              const content = await readFileFromSandbox(sandboxInfo, filePath);
              if (content && content.length < 50000) {
                fileContents.set(filePath, content);
                frontendCount++;
              }
            } catch {
              // Skip files that can't be read
            }
          }
        }

        logger.info({
          msg: "Migration analysis file scan",
          projectId,
          backendFilesScanned: backendFiles.length,
          frontendFilesScanned: frontendCount,
          criticalFilesFound: criticalFiles.filter((f) => fileContents.has(f)),
          totalFilesScanned: fileContents.size,
        });

        // Helper to search for patterns
        const searchPatterns = (
          patternList: string[],
        ): { found: string[]; files: string[] } => {
          const found: string[] = [];
          const matchedFiles: string[] = [];

          for (const [filePath, content] of fileContents) {
            for (const pattern of patternList) {
              if (content.includes(pattern)) {
                if (!found.includes(pattern)) found.push(pattern);
                if (!matchedFiles.includes(filePath))
                  matchedFiles.push(filePath);
              }
            }
          }

          return { found, files: matchedFiles };
        };

        // Check auth patterns
        const authPatterns =
          patterns.auth[platform as keyof typeof patterns.auth] ||
          patterns.auth.GENERIC;
        const authResult = searchPatterns(authPatterns);
        if (authResult.found.length > 0) {
          analysis.detected.auth = true;
          analysis.details.auth = {
            patterns: authResult.found,
            files: authResult.files,
          };
        }

        // Check database patterns
        const dbPatterns =
          patterns.database[platform as keyof typeof patterns.database] ||
          patterns.database.GENERIC;
        const dbResult = searchPatterns(dbPatterns);
        if (dbResult.found.length > 0) {
          analysis.detected.database = true;
          analysis.details.database = {
            tables: [], // Could extract table names from patterns
            files: dbResult.files,
          };
        }

        // Check Stripe patterns
        const stripeResult = searchPatterns(patterns.stripe);
        if (stripeResult.found.length > 0) {
          analysis.detected.stripe = true;
          analysis.details.stripe = {
            patterns: stripeResult.found,
            files: stripeResult.files,
          };
        }

        // Check AI patterns
        const aiResult = searchPatterns(patterns.ai);
        if (aiResult.found.length > 0) {
          analysis.detected.ai = true;
          // Try to detect provider
          let provider: string | undefined;
          if (
            aiResult.found.some(
              (p) => p.includes("openai") || p.includes("gpt"),
            )
          ) {
            provider = "openai";
          } else if (
            aiResult.found.some(
              (p) => p.includes("anthropic") || p.includes("claude"),
            )
          ) {
            provider = "anthropic";
          }
          analysis.details.ai = {
            provider,
            patterns: aiResult.found,
            files: aiResult.files,
          };
        }

        // Check email patterns
        const emailResult = searchPatterns(patterns.email);
        if (emailResult.found.length > 0) {
          analysis.detected.email = true;
          analysis.details.email = {
            patterns: emailResult.found,
            files: emailResult.files,
          };
        }

        // Check file upload patterns
        const uploadResult = searchPatterns(patterns.fileUpload);
        if (uploadResult.found.length > 0) {
          analysis.detected.fileUpload = true;
          analysis.details.fileUpload = {
            patterns: uploadResult.found,
            files: uploadResult.files,
          };
        }

        // Check image generation patterns (Base44)
        const imageGenResult = searchPatterns(patterns.imageGeneration);
        if (imageGenResult.found.length > 0) {
          analysis.detected.imageGeneration = true;
          analysis.details.imageGeneration = {
            patterns: imageGenResult.found,
            files: imageGenResult.files,
          };
        }

        // Check edge functions patterns (Lovable/Supabase)
        // Also check if supabase/functions directory exists
        const hasSupabaseFunctionsDir = filePaths.some((f) =>
          f.startsWith("supabase/functions/"),
        );
        const edgeFnResult = searchPatterns(patterns.edgeFunctions);
        if (edgeFnResult.found.length > 0 || hasSupabaseFunctionsDir) {
          analysis.detected.edgeFunctions = true;
          analysis.details.edgeFunctions = {
            patterns: edgeFnResult.found,
            files: hasSupabaseFunctionsDir
              ? [
                ...edgeFnResult.files,
                ...filePaths.filter((f) =>
                  f.startsWith("supabase/functions/"),
                ),
              ]
              : edgeFnResult.files,
          };
        }

        // Detect routing library - CRITICAL: must be preserved during migration
        const routingPatterns = {
          "react-router-dom": [
            "react-router-dom",
            "BrowserRouter",
            "HashRouter",
            "useNavigate",
            "useParams",
            "useLocation",
            "<Route",
            "<Routes",
          ],
          "@tanstack/react-router": [
            "@tanstack/react-router",
            "createRootRoute",
            "createRoute",
            "createRouter",
            "RouterProvider",
            "createFileRoute",
          ],
          wouter: ["wouter", "useRoute", "<Route", "useLocation"],
          "next/router": ["next/router", "useRouter", "next/navigation"],
        };

        let detectedRouter: MigrationAnalysis["routingLibrary"] = "none";
        const routerFiles: string[] = [];
        const routerPatterns: string[] = [];

        // Check package.json first for definitive answer
        const packageJson = fileContents.get("package.json");
        if (packageJson) {
          if (packageJson.includes('"react-router-dom"')) {
            detectedRouter = "react-router-dom";
            routerPatterns.push("package.json: react-router-dom");
          } else if (packageJson.includes('"@tanstack/react-router"')) {
            detectedRouter = "@tanstack/react-router";
            routerPatterns.push("package.json: @tanstack/react-router");
          } else if (packageJson.includes('"wouter"')) {
            detectedRouter = "wouter";
            routerPatterns.push("package.json: wouter");
          } else if (packageJson.includes('"next"')) {
            detectedRouter = "next/router";
            routerPatterns.push("package.json: next");
          }
        }

        // Also scan files for import patterns to confirm
        for (const [filePath, content] of fileContents) {
          for (const [router, patterns] of Object.entries(routingPatterns)) {
            for (const pattern of patterns) {
              if (content.includes(pattern)) {
                if (!routerPatterns.includes(pattern)) {
                  routerPatterns.push(pattern);
                }
                if (!routerFiles.includes(filePath)) {
                  routerFiles.push(filePath);
                }
                // Only update if we haven't detected from package.json
                if (detectedRouter === "none") {
                  detectedRouter =
                    router as MigrationAnalysis["routingLibrary"];
                }
              }
            }
          }
        }

        analysis.routingLibrary = detectedRouter;
        if (routerPatterns.length > 0) {
          analysis.details.routing = {
            library: detectedRouter,
            patterns: routerPatterns,
            files: routerFiles,
          };
        }

        logger.info({
          msg: "Routing library detected",
          projectId,
          routingLibrary: detectedRouter,
          patterns: routerPatterns.slice(0, 5), // Log first 5 patterns
        });

        // Generate recommended steps based on what was detected
        let stepNum = 1;
        if (analysis.detected.auth) {
          analysis.recommendedSteps.push(
            `${stepNum++}. MIGRATE AUTH: Follow the '🔐 CONVEX AUTH' section in system prompt`,
          );
        }
        if (analysis.detected.database) {
          analysis.recommendedSteps.push(
            `${stepNum++}. MIGRATE DATABASE: Follow the '💾 SHIPPER CLOUD - SCHEMA & QUERIES' section`,
          );
        }
        if (analysis.detected.edgeFunctions) {
          analysis.recommendedSteps.push(
            `${stepNum++}. MIGRATE EDGE FUNCTIONS: Convert Supabase edge functions to Convex actions`,
          );
        }
        if (analysis.detected.stripe) {
          analysis.recommendedSteps.push(
            `${stepNum++}. MIGRATE STRIPE: Follow the '💳 STRIPE INTEGRATION' section`,
          );
        }
        if (analysis.detected.ai) {
          analysis.recommendedSteps.push(
            `${stepNum++}. MIGRATE AI: Follow the '🤖 AI INTEGRATION' section`,
          );
        }
        if (analysis.detected.imageGeneration) {
          analysis.recommendedSteps.push(
            `${stepNum++}. MIGRATE IMAGE GENERATION: Use AI SDK with DALL-E or similar`,
          );
        }
        if (analysis.detected.email) {
          analysis.recommendedSteps.push(
            `${stepNum++}. SETUP EMAIL: Call requestApiKeys({ provider: 'resend' })`,
          );
        }
        if (analysis.detected.fileUpload) {
          analysis.recommendedSteps.push(
            `${stepNum++}. MIGRATE FILE UPLOAD: Use Convex file storage`,
          );
        }
        analysis.recommendedSteps.push(
          `${stepNum}. CLEANUP: Remove old SDK imports and dependencies`,
        );

        // Store analysis in context for subsequent tool calls
        context.migrationAnalysis = analysis;

        // Also mark getFiles as called since we've explored the codebase
        context.hasCalledGetFiles = true;

        logger.info({
          msg: "Migration analysis complete",
          projectId,
          platform,
          detected: analysis.detected,
          filesScanned: fileContents.size,
        });

        // Track tool usage
        await trackToolSpan(
          "analyzeMigration",
          context.userId,
          context.traceId || generateSpanId(),
          {},
          { platform, detected: analysis.detected },
          {
            spanId,
            latency: (Date.now() - startTime) / 1000,
            isError: false,
          },
        );

        await trackToolUsage(
          "analyzeMigration",
          context.userId,
          context.projectId,
          {},
          { platform, detected: analysis.detected },
        );

        return analysis;
      } catch (error) {
        const errorResult = {
          error: error instanceof Error ? error.message : String(error),
        };

        await trackToolSpan(
          "analyzeMigration",
          context.userId,
          context.traceId || generateSpanId(),
          {},
          errorResult,
          {
            spanId,
            latency: (Date.now() - startTime) / 1000,
            isError: true,
            error: errorResult.error,
          },
        );

        throw error;
      }
    },
  });

/**
 * Read file from sandbox with support for partial reads
 */
export const readFile = (context: ToolsContext) =>
  tool({
    description:
      "Get a file from the sandbox. Supports reading partial files with line ranges or character limits to avoid token overflow.",
    inputSchema: z.object({
      path: z.string(),
      startLine: z
        .number()
        .optional()
        .describe(
          "Starting line number (1-indexed). If provided, only reads from this line onwards",
        ),
      endLine: z
        .number()
        .optional()
        .describe(
          "Ending line number (1-indexed). If provided with startLine, only reads lines in this range",
        ),
      maxChars: z
        .number()
        .optional()
        .describe(
          "Maximum number of characters to return. If file is larger, returns truncated content with metadata",
        ),
    }),
    execute: async (
      { path, startLine, endLine, maxChars },
      { toolCallId: id },
    ) => {
      const logger = getLogger(context);
      logger.info({
        msg: "readFile called",
        path,
        startLine,
        endLine,
        maxChars,
        toolCallId: id,
      });
      const { sandboxId } = context;

      logger.info({
        msg: "Context check",
        sandboxId: sandboxId || "none",
      });

      const spanId = generateSpanId();
      const startTime = Date.now();

      try {
        if (!sandboxId) {
          logger.error({ msg: "No sandboxId in context" });
          throw new Error("Sandbox not found");
        }

        // Get sandbox instance
        const sandboxInfo = await getSandbox(context.projectId);
        if (!sandboxInfo) {
          throw new Error("Sandbox not available");
        }

        // Read file from Modal sandbox
        logger.info({
          msg: "Reading file from sandbox",
          sandboxId,
          path,
        });
        const fullContent = await readFileFromSandbox(
          sandboxInfo.sandbox,
          path,
        );
        logger.info({
          msg: "Successfully read file",
          path,
          length: fullContent.length,
        });
        const totalLines = fullContent.split("\n").length;
        const totalChars = fullContent.length;

        let fileContent = fullContent;
        let isTruncated = false;
        let truncationInfo = {};

        // Handle line-based reading
        if (startLine !== undefined || endLine !== undefined) {
          const lines = fullContent.split("\n");
          const start = startLine ? Math.max(0, startLine - 1) : 0;
          const end = endLine ? Math.min(lines.length, endLine) : lines.length;

          fileContent = lines.slice(start, end).join("\n");
          isTruncated = start > 0 || end < lines.length;
          truncationInfo = {
            requestedLines: {
              start: startLine || 1,
              end: endLine || totalLines,
            },
            totalLines,
            returnedLines: end - start,
          };
        }

        // Handle character-based limiting (applied after line filtering if both are specified)
        if (maxChars !== undefined && fileContent.length > maxChars) {
          fileContent = fileContent.substring(0, maxChars);
          isTruncated = true;
          truncationInfo = {
            ...truncationInfo,
            totalChars,
            returnedChars: maxChars,
            charLimitApplied: true,
          };
        }

        // Track file metadata for change detection
        if (!context.files) {
          context.files = new Map<string, { size: number; modified: number }>();
        }
        context.files.set(path, {
          size: fullContent.length,
          modified: Date.now(),
        });

        // Track file content for fragment creation (only if reading full file)
        if (!isTruncated) {
          if (!context.fragmentFiles) {
            context.fragmentFiles = new Map<string, string>();
          }
          context.fragmentFiles.set(path, fileContent);
        }

        const result = {
          path,
          fileSize: fullContent.length,
          returnedSize: fileContent.length,
          isTruncated,
          ...(isTruncated && { truncationInfo }),
        };

        // Track tool usage with PostHog
        await trackToolSpan(
          "readFile",
          context.userId,
          context.traceId || generateSpanId(),
          { path, startLine, endLine, maxChars },
          result,
          {
            spanId,
            latency: (Date.now() - startTime) / 1000,
            isError: false,
          },
        );

        await trackToolUsage(
          "readFile",
          context.userId,
          context.projectId,
          { path, startLine, endLine, maxChars },
          result,
        );

        // Return content with metadata if truncated
        if (isTruncated) {
          return {
            content: fileContent,
            metadata: result,
            message: `File truncated. Total size: ${totalChars} chars, ${totalLines} lines. Returned: ${fileContent.length} chars.`,
          };
        }

        return fileContent;
      } catch (error) {
        const errorResult = {
          error: error instanceof Error ? error.message : String(error),
        };

        // Track tool usage error with PostHog
        await trackToolSpan(
          "readFile",
          context.userId,
          context.traceId || generateSpanId(),
          { path, startLine, endLine, maxChars },
          errorResult,
          {
            spanId,
            latency: (Date.now() - startTime) / 1000,
            isError: true,
            error: errorResult.error,
          },
        );

        await trackToolUsage(
          "readFile",
          context.userId,
          context.projectId,
          { path, startLine, endLine, maxChars },
          errorResult,
        );
        throw error;
      }
    },
  });

/**
 * Create or edit files in the sandbox
 * Main tool for file operations - context-aware
 */
export const createOrEditFiles = (context: ToolsContext) =>
  tool({
    description:
      "Create or edit a file in the sandbox. This tool is context-aware and will read existing files from the current fragment first before editing them, ensuring consistency with the current project state.",
    inputSchema: z.object({
      path: z
        .string()
        .describe(
          "The path to the file to create or edit (relative to project root)",
        ),
      content: z.string().describe("The complete content for the file"),
      description: z
        .string()
        .describe(
          "Brief description of what this file does or what changes are being made",
        ),
    }),
    execute: async ({ path, content, description }, { toolCallId: id }) => {
      const logger = getLogger(context);
      logger.info({
        msg: "createOrEditFiles called",
        path,
        description,
        contentLength: content.length,
        toolCallId: id,
      });
      const { sandboxId, fragmentFiles, currentFragmentId } = context;

      const spanId = generateSpanId();
      const startTime = Date.now();

      try {
        if (!sandboxId) {
          throw new Error("Sandbox not found");
        }

        // 🚨 CRITICAL: For imported projects, getFiles must be called first
        // This ensures the AI understands the existing codebase before making changes
        if (context.isImportedProject && !context.hasCalledGetFiles) {
          const errorMsg =
            "⚠️ STOP: This is an imported project. You MUST call getFiles() first to understand the existing project structure before making any file changes. This is required to avoid breaking the existing codebase.";
          logger.warn({
            msg: "BLOCKED: createOrEditFiles called before getFiles on imported project",
            path,
            projectId: context.projectId,
          });
          throw new Error(errorMsg);
        }

        // 🚨 CRITICAL BLOCK: Prevent editing index.css files
        if (path.endsWith("index.css") || path.includes("/index.css")) {
          const errorMsg =
            "🚨 CRITICAL SECURITY BLOCK: Editing index.css is not allowed. These templates use Tailwind v4 which relies on index.css for all styling configuration. Modifying this file can break the entire Tailwind setup, theme system, and component styling. All styling should be done through Tailwind utility classes in components instead.";
          logger.error({ msg: "BLOCKED: index.css edit attempt", path });
          throw new Error(errorMsg);
        }

        // 🚨 CRITICAL BLOCK: Prevent editing user-uploaded metadata files
        const protectedPaths = [
          /^public\/favicon\./,
          /^public\/images\/share-image\./,
          /\/favicon\.[^\/]+$/,
          /\/share-image\.[^\/]+$/,
        ];

        const normalizedPath = path.replace(/^\/+/, ""); // Remove leading slashes
        if (protectedPaths.some((pattern) => pattern.test(normalizedPath))) {
          const errorMsg =
            "🚨 CRITICAL BLOCK: This file is user-uploaded metadata (app icon/favicon or social share image) and cannot be modified by AI. These files are configured by users through the publish settings interface for app branding and publishing. You can generate OTHER images for content, but never touch favicon.* or share-image.* files.";
          logger.error({
            msg: "BLOCKED: Protected metadata file edit attempt",
            path,
          });
          throw new Error(errorMsg);
        }

        // 🚨 CRITICAL BLOCK: Prevent creating .ts/.tsx files in JavaScript projects
        // Exception: convex/ directory MUST be TypeScript (Convex requirement)
        if (context.isImportedProject && context.migrationAnalysis) {
          const isConvexFile =
            normalizedPath.startsWith("convex/") ||
            normalizedPath.includes("/convex/");
          const isTsFile =
            normalizedPath.endsWith(".ts") || normalizedPath.endsWith(".tsx");
          const isJsFile =
            normalizedPath.endsWith(".js") || normalizedPath.endsWith(".jsx");
          const isSrcFile =
            normalizedPath.startsWith("src/") ||
            normalizedPath.includes("/src/");

          // Block creating .ts/.tsx files in src/ for JavaScript projects
          if (
            context.migrationAnalysis.projectLanguage === "javascript" &&
            isTsFile &&
            isSrcFile &&
            !isConvexFile
          ) {
            const errorMsg = `🚨 LANGUAGE MISMATCH: This is a JavaScript project. You cannot create TypeScript files (.ts/.tsx) in src/. Use .js/.jsx instead. Only convex/ files should be TypeScript.`;
            logger.warn({
              msg: "BLOCKED: TypeScript file in JavaScript project",
              path,
              projectLanguage: context.migrationAnalysis.projectLanguage,
            });
            throw new Error(errorMsg);
          }

          // Block creating .js/.jsx files in src/ for TypeScript projects
          if (
            context.migrationAnalysis.projectLanguage === "typescript" &&
            isJsFile &&
            isSrcFile
          ) {
            const errorMsg = `🚨 LANGUAGE MISMATCH: This is a TypeScript project. You cannot create JavaScript files (.js/.jsx) in src/. Use .ts/.tsx instead.`;
            logger.warn({
              msg: "BLOCKED: JavaScript file in TypeScript project",
              path,
              projectLanguage: context.migrationAnalysis.projectLanguage,
            });
            throw new Error(errorMsg);
          }

          // Block adding TypeScript type annotations to .js files
          if (isJsFile && !isConvexFile) {
            const hasTypeAnnotations =
              /:\s*(string|number|boolean|any|void|never|unknown|object)\b/.test(
                content,
              ) ||
              /^(interface|type)\s+\w+/m.test(content) ||
              /<\w+>/.test(content); // Generic types like Array<string>

            if (hasTypeAnnotations) {
              const errorMsg = `🚨 TYPE ANNOTATIONS IN JS: You are adding TypeScript type annotations to a JavaScript file (${path}). Remove type annotations like ': string', 'interface', 'type', and generics. JavaScript files cannot have TypeScript syntax.`;
              logger.warn({
                msg: "BLOCKED: TypeScript annotations in JavaScript file",
                path,
              });
              throw new Error(errorMsg);
            }
          }
        }

        // 🔍 MONITORING CHECK: Ensure index.html retains the monitoring script import
        content = ensureMonitoringScript(content, path);

        // Get sandbox instance
        const sandboxInfo = await getSandbox(context.projectId);
        if (!sandboxInfo) {
          throw new Error("Sandbox not available");
        }

        // Ensure context maps are initialized
        if (!context.fragmentFiles) {
          context.fragmentFiles = new Map<string, string>();
        }
        if (!context.files) {
          context.files = new Map<string, { size: number; modified: number }>();
        }

        // Get existing fragment files first to understand current state
        let existingFragmentFiles: { [path: string]: string } = {};
        if (currentFragmentId) {
          try {
            const existingFragment = await prisma.v2Fragment.findUnique({
              where: { id: currentFragmentId },
              select: { files: true },
            });

            if (existingFragment?.files) {
              existingFragmentFiles = existingFragment.files as {
                [path: string]: string;
              };
              logger.info({
                msg: "Found files in current fragment",
                fileCount: Object.keys(existingFragmentFiles).length,
              });
            }
          } catch (error) {
            logger.warn({
              msg: "Could not load existing fragment files",
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        // Process the file
        try {
          let existingContent = "";
          let isEdit = false;

          // First check if file exists in current fragment
          if (existingFragmentFiles[path]) {
            existingContent = existingFragmentFiles[path];
            isEdit = true;
            logger.info({
              msg: "Found file in fragment",
              path,
              charCount: existingContent.length,
            });
          } else {
            // Only check sandbox if no fragment files exist at all
            // This ensures we build purely from the selected fragment when available
            if (Object.keys(existingFragmentFiles).length === 0) {
              try {
                // Read existing file from sandbox
                existingContent = await readFileFromSandbox(
                  sandboxInfo.sandbox,
                  path,
                );
                isEdit = true;
                logger.info({
                  msg: "Found file in sandbox",
                  path,
                  charCount: existingContent.length,
                });
              } catch (error) {
                // File doesn't exist - this is a new file
                logger.info({ msg: "Creating new file", path });
              }
            } else {
              // Fragment has files but this specific file doesn't exist in fragment
              // This is a new file being added to the existing fragment
              logger.info({
                msg: "Creating new file (adding to existing fragment)",
                path,
              });
            }
          }

          // === SYNTAX VALIDATION BEFORE WRITE ===
          // Validate syntax before writing to prevent corrupted/truncated files
          if (CODE_FILE_REGEX.test(path)) {
            logger.info({ msg: "Validating file syntax before write", path });
            await validateSyntaxOrThrow(path, content);
            logger.info({ msg: "✅ Syntax validation passed", path });
          }

          // Write the file to Modal sandbox
          logger.info({
            msg: "Writing file to sandbox",
            path,
            contentLength: content.length,
          });

          await writeFileToSandbox(sandboxInfo.sandbox, path, content);

          // 🛡️ ROUTE FILE PROTECTION: TanStack Router race condition fix
          // The TanStack Router Vite plugin has a bug (github.com/TanStack/router/issues/2151)
          // where it may overwrite route files with "Hello /route!" boilerplate stubs
          // when it detects file changes during write operations.
          // This verification step detects and fixes corrupted route files.
          if (path.startsWith("src/routes/") && path.endsWith(".tsx")) {
            // Wait for file system and Vite watcher to settle
            await new Promise((resolve) => setTimeout(resolve, 200));

            try {
              const verifyContent = await readFileFromSandbox(
                sandboxInfo.sandbox,
                path,
              );
              const isCorrupted =
                verifyContent.includes('return <div>Hello "') ||
                verifyContent.includes("return <div>Hello '/") ||
                (verifyContent.includes('Hello "/') &&
                  verifyContent.length < content.length * 0.5);

              if (isCorrupted) {
                logger.warn({
                  msg: "🔄 Route file corrupted by TanStack Router plugin, re-writing",
                  path,
                  originalLength: content.length,
                  corruptedLength: verifyContent.length,
                });
                // Re-write the file
                await writeFileToSandbox(sandboxInfo.sandbox, path, content);
                // Wait again and verify once more
                await new Promise((resolve) => setTimeout(resolve, 300));
                const secondVerify = await readFileFromSandbox(
                  sandboxInfo.sandbox,
                  path,
                );
                if (
                  secondVerify.includes('return <div>Hello "') ||
                  secondVerify.includes("return <div>Hello '/")
                ) {
                  logger.error({
                    msg: "⚠️ Route file still corrupted after retry - TanStack Router may need manual intervention",
                    path,
                  });
                } else {
                  logger.info({
                    msg: "✅ Route file successfully restored",
                    path,
                  });
                }
              }
            } catch (verifyError) {
              logger.warn({
                msg: "Could not verify route file after write",
                path,
                error:
                  verifyError instanceof Error
                    ? verifyError.message
                    : String(verifyError),
              });
            }
          }

          // Track in context
          context.files.set(path, {
            size: content.length,
            modified: Date.now(),
          });
          context.fragmentFiles.set(path, content);

          logger.info({
            msg: isEdit ? "Updated file" : "Created file",
            path,
            charCount: content.length,
            description,
          });

          // Update the working fragment with the change
          await updateWorkingFragment(
            context,
            `${isEdit ? "updated" : "created"} ${path}`,
          );

          // Emit file creation event for live preview
          // Stream any React component file (.tsx/.jsx) under src/ for real-time preview
          const isReactFile = path.endsWith(".tsx") || path.endsWith(".jsx");
          const isUnderSrc = path.startsWith("src/");
          const isNotTestOrConfig =
            !path.includes(".test.") &&
            !path.includes(".spec.") &&
            !path.includes(".config.");
          if (isReactFile && isUnderSrc && isNotTestOrConfig) {
            try {
              await redisFileStreamPublisher.emitFileCreation({
                projectId: context.projectId,
                filePath: path,
                content,
                timestamp: Date.now(),
                action: isEdit ? "updated" : "created",
              });
              logger.info({
                msg: "Emitted file creation event for preview",
                path,
              });
            } catch (error) {
              logger.warn({
                msg: "Failed to emit file creation event",
                path,
                error: error instanceof Error ? error.message : String(error),
              });
              // Don't fail the whole operation if event emission fails
            }
          }

          const result = {
            success: true,
            path,
            action: isEdit ? "updated" : "created",
            description,
            size: content.length,
            message: `Successfully ${isEdit ? "updated" : "created"} ${path}`,
          };

          // Track tool usage with PostHog
          await trackToolSpan(
            "createOrEditFiles",
            context.userId,
            context.traceId || generateSpanId(),
            { path, description },
            result,
            {
              spanId,
              latency: (Date.now() - startTime) / 1000,
              isError: false,
            },
          );

          await trackToolUsage(
            "createOrEditFiles",
            context.userId,
            context.projectId,
            { path, description },
            result,
            { action: isEdit ? "edited" : "created" },
          );
          return result;
        } catch (error) {
          logger.error({
            msg: "Failed to process file",
            path,
            error: error instanceof Error ? error.message : String(error),
          });

          const result = {
            success: false,
            path,
            action: "failed",
            description,
            error: error instanceof Error ? error.message : String(error),
            message: `Failed to process ${path}: ${error instanceof Error ? error.message : String(error)
              }`,
          };

          // Track tool usage error with PostHog
          await trackToolSpan(
            "createOrEditFiles",
            context.userId,
            context.traceId || generateSpanId(),
            { path, description },
            result,
            {
              spanId,
              latency: (Date.now() - startTime) / 1000,
              isError: true,
              error: result.error,
            },
          );

          await trackToolUsage(
            "createOrEditFiles",
            context.userId,
            context.projectId,
            { path, description },
            result,
          );
          return result;
        }
      } catch (error) {
        logger.error({
          msg: "Critical error in createOrEditFiles",
          error: error instanceof Error ? error.message : String(error),
        });
        const errorResult = {
          error: error instanceof Error ? error.message : String(error),
        };

        // Track tool usage error with PostHog
        await trackToolSpan(
          "createOrEditFiles",
          context.userId,
          context.traceId || generateSpanId(),
          { path, description },
          errorResult,
          {
            spanId,
            latency: (Date.now() - startTime) / 1000,
            isError: true,
            error: errorResult.error,
          },
        );

        await trackToolUsage(
          "createOrEditFiles",
          context.userId,
          context.projectId,
          { path, description },
          errorResult,
        );
        throw error;
      }
    },
  });

/**
 * Transform Modal URL to user-facing Shipper domain
 * This is ONLY for display purposes in AI messages
 * Wrapper around shared utility with logging
 */
function transformUrlForDisplay(modalUrl: string, projectId: string): string {
  const transformedUrl = transformModalUrlForDisplay(modalUrl, projectId, {
    NODE_ENV: process.env.NODE_ENV,
    SKIP_MODAL_URL_TRANSFORM: process.env.SKIP_MODAL_URL_TRANSFORM,
    MODAL_USE_LOCALHOST: process.env.MODAL_USE_LOCALHOST,
  });

  // Log transformation for debugging
  if (transformedUrl !== modalUrl) {
    defaultLogger.info({
      msg: "URL transformed for display",
      originalUrl: modalUrl,
      transformedUrl,
      projectId,
    });
  }

  return transformedUrl;
}

/**
 * Get the sandbox preview URL
 */
export const getSandboxUrl = (context: ToolsContext) =>
  tool({
    description: "Get the sandbox url for preview and review",
    inputSchema: z.object({}),
    execute: async (_, { toolCallId: id }) => {
      const logger = getLogger(context);
      logger.info({ msg: "getSandboxUrl called", toolCallId: id });
      const spanId = generateSpanId();
      const startTime = Date.now();

      try {
        let sandboxUrl = context.sandboxUrl;

        // If URL not in context, retrieve it from the sandbox
        if (!sandboxUrl) {
          logger.info({
            msg: "URL not in context, retrieving from sandbox",
          });

          const sandboxInfo = await getSandbox(context.projectId);
          if (!sandboxInfo) {
            throw new Error("Sandbox not found");
          }

          sandboxUrl = sandboxInfo.sandboxUrl;

          // Update context with the URL
          if (sandboxUrl) {
            context.sandboxUrl = sandboxUrl;
          }
        }

        if (!sandboxUrl) {
          throw new Error(
            "Sandbox URL not available. The dev server may not be running yet. Try starting it first.",
          );
        }

        logger.info({ msg: "Sandbox URL retrieved", sandboxUrl });

        // Transform URL for display to user (AI messages only)
        const displayUrl = transformUrlForDisplay(
          sandboxUrl,
          context.projectId,
        );

        logger.info({
          msg: "URL transformed for display",
          originalUrl: sandboxUrl,
          displayUrl,
        });

        const result = {
          type: "sandbox",
          url: displayUrl,
          message: `Sandbox is available at: ${displayUrl}`,
          shouldRefreshPreview: true,
        };

        // Track tool usage with PostHog
        await trackToolSpan(
          "getSandboxUrl",
          context.userId,
          context.traceId || generateSpanId(),
          {},
          result,
          {
            spanId,
            latency: (Date.now() - startTime) / 1000,
            isError: false,
          },
        );

        await trackToolUsage(
          "getSandboxUrl",
          context.userId,
          context.projectId,
          {},
          result,
        );

        return result;
      } catch (error) {
        const errorResult = {
          error: error instanceof Error ? error.message : String(error),
        };

        // Track tool usage error with PostHog
        await trackToolSpan(
          "getSandboxUrl",
          context.userId,
          context.traceId || generateSpanId(),
          {},
          errorResult,
          {
            spanId,
            latency: (Date.now() - startTime) / 1000,
            isError: true,
            error: errorResult.error,
          },
        );

        await trackToolUsage(
          "getSandboxUrl",
          context.userId,
          context.projectId,
          {},
          errorResult,
        );

        throw error;
      }
    },
  });

/**
 * Finalize the current working fragment
 * Creates a git commit and marks the work as complete
 */
export const finalizeWorkingFragment = (context: ToolsContext) =>
  tool({
    description:
      "Finalize the current working fragment with a descriptive title when you have completed your work. This creates a git commit and updates the fragment to track the commit hash.",
    inputSchema: z.object({
      title: z
        .string()
        .describe(
          "Descriptive title for what was accomplished (e.g., 'Created login page with validation', 'Added shopping cart functionality')",
        ),
      debugInfo: z.string().optional().describe(DEBUG_INFO_DESCRIPTION),
    }),
    execute: async ({ title, debugInfo }, { toolCallId: id }) => {
      const logger = getLogger(context);
      logger.info({
        msg: "finalizeWorkingFragment called",
        title,
        toolCallId: id,
      });
      const { currentFragmentId } = context;

      const spanId = generateSpanId();
      const startTime = Date.now();

      if (debugInfo) {
        logger.info({
          msg: "Debug info provided",
          debugInfo,
        });
      }

      try {
        if (!currentFragmentId) {
          const result = {
            success: false,
            message: "No working fragment to finalize",
          };

          // Track tool usage with PostHog
          await trackToolSpan(
            "finalizeWorkingFragment",
            context.userId,
            context.traceId || generateSpanId(),
            { title },
            result,
            {
              spanId,
              latency: (Date.now() - startTime) / 1000,
              isError: false,
            },
          );

          return result;
        }

        // Get sandbox instance
        const sandboxInfo = await getSandbox(context.projectId);
        if (!sandboxInfo) {
          const result = {
            success: false,
            message: "Sandbox not available for git operations",
          };

          await trackToolSpan(
            "finalizeWorkingFragment",
            context.userId,
            context.traceId || generateSpanId(),
            { title },
            result,
            {
              spanId,
              latency: (Date.now() - startTime) / 1000,
              isError: false,
            },
          );

          return result;
        }

        try {
          // Before finalizing, ensure the fragment has the most up-to-date files
          await updateWorkingFragment(context, "finalizing fragment");

          // Check if fragment exists before trying to update
          const existingFragment = await prisma.v2Fragment.findUnique({
            where: { id: currentFragmentId },
            select: { id: true },
          });

          if (!existingFragment) {
            throw new Error(
              `Fragment ${currentFragmentId} no longer exists, cannot finalize`,
            );
          }

          // ALWAYS save the fragment title first, regardless of validation results
          // This ensures work is preserved even if validation fails
          const fragment = await prisma.v2Fragment.update({
            where: { id: currentFragmentId },
            data: {
              title,
              updatedAt: new Date(),
            },
          });

          // Update the project to mark this fragment as active
          await prisma.project.update({
            where: { id: context.projectId },
            data: {
              activeFragmentId: fragment.id,
            },
          });

          logger.info({
            msg: "Fragment saved with title (pre-validation)",
            fragmentId: fragment.id,
            title,
          });

          // === PRE-FINALIZE VALIDATION GATES ===
          // Run validation but don't block saving - collect errors to report
          logger.info({ msg: "Running pre-finalize validation gates" });
          const gates = {
            syntaxValid: false,
            buildReady: false,
            previewHealthy: false,
            noUnresolvedErrors: false,
            shipperCloudValid: false,
          };
          const validationErrors: Array<{
            gate: string;
            error: string;
            file?: string;
          }> = [];

          // Gate 1: Check syntax of all fragment files
          logger.info({ msg: "Gate 1: Checking file syntax" });
          const fragmentData = await prisma.v2Fragment.findUnique({
            where: { id: currentFragmentId },
            select: { files: true },
          });

          if (fragmentData?.files) {
            const files = fragmentData.files as { [path: string]: string };

            for (const [path, content] of Object.entries(files)) {
              if (!CODE_FILE_REGEX.test(path)) {
                continue;
              }

              try {
                await validateSyntaxOrThrow(path, content as string);
              } catch (syntaxError) {
                const message =
                  syntaxError instanceof Error
                    ? syntaxError.message
                    : String(syntaxError);
                logger.error({
                  msg: "Syntax validation failed",
                  file: path,
                  error: message,
                });
                validationErrors.push({
                  gate: "syntaxValid",
                  error: message,
                  file: path,
                });
              }
            }
          }
          gates.syntaxValid =
            validationErrors.filter((e) => e.gate === "syntaxValid").length ===
            0;
          if (gates.syntaxValid) {
            logger.info({ msg: "✅ Gate 1 passed: Syntax is valid" });
          }

          // Gate 2: Check build status
          // logger.info({ msg: "Gate 2: Checking build status" });
          // await runBuildValidationGate(context, sandboxInfo);
          // gates.buildReady = true;
          // logger.info({ msg: "✅ Gate 2 passed: Build is ready" });

          // Gate 3: Probe preview URL health
          logger.info({ msg: "Gate 3: Checking preview health" });
          try {
            // Skip health check for localhost URLs in development
            const previewUrl = context.sandboxUrl || sandboxInfo?.sandboxUrl;
            const isLocalhost =
              previewUrl &&
              (previewUrl.includes("localhost") ||
                previewUrl.includes("127.0.0.1"));
            const isDev = process.env.NODE_ENV === "development";

            if (isLocalhost && isDev) {
              logger.info({
                msg: "Skipping preview health check for localhost in dev mode",
                previewUrl,
              });
              gates.previewHealthy = true;
            } else {
              await ensurePreviewHealthy(context, sandboxInfo);
              gates.previewHealthy = true;
            }
            logger.info({ msg: "✅ Gate 3 passed: Preview is healthy" });
          } catch (previewError) {
            const reason =
              previewError instanceof Error
                ? previewError.message
                : String(previewError);
            logger.error({
              msg: "Preview health check failed",
              reason,
            });
            validationErrors.push({
              gate: "previewHealthy",
              error: `Preview unhealthy: ${reason}`,
            });
          }

          // Gate 4: Check for unresolved critical errors
          logger.info({ msg: "Gate 4: Checking for unresolved errors" });
          const errorAnalysis = await analyzeProjectErrors(context, {
            store: true,
            excludeLowSeverity: true,
          });
          const blockingErrors = [
            ...(errorAnalysis.detectedErrors.buildErrors ?? []),
            ...(errorAnalysis.detectedErrors.importErrors ?? []),
            ...(errorAnalysis.detectedErrors.navigationErrors ?? []),
            ...(errorAnalysis.detectedErrors.runtimeErrors ?? []),
          ];

          let errorDetails = "";
          if (blockingErrors.length > 0) {
            logger.error({
              msg: "Unresolved critical errors found",
              count: blockingErrors.length,
            });

            // Group errors by type for better reporting
            const errorsByType = {
              build: errorAnalysis.detectedErrors.buildErrors ?? [],
              import: errorAnalysis.detectedErrors.importErrors ?? [],
              navigation: errorAnalysis.detectedErrors.navigationErrors ?? [],
              runtime: errorAnalysis.detectedErrors.runtimeErrors ?? [],
            };

            // Create detailed error summary
            errorDetails = Object.entries(errorsByType)
              .filter(([_, errors]) => errors.length > 0)
              .map(([type, errors]) => {
                const errorList = errors
                  .slice(0, 3) // Show first 3 errors of each type
                  .map((err: unknown) => {
                    const errObj = err as {
                      message?: string;
                      file?: string;
                      line?: number;
                    };
                    const file = errObj.file ? ` in ${errObj.file}` : "";
                    const line = errObj.line ? `:${errObj.line}` : "";
                    return `  - ${errObj.message || "Unknown error"}${file}${line}`;
                  })
                  .join("\n");

                const remaining =
                  errors.length > 3
                    ? `\n  ... and ${errors.length - 3} more ${type} errors`
                    : "";
                return `${type.toUpperCase()} ERRORS (${errors.length}):\n${errorList}${remaining}`;
              })
              .join("\n\n");

            validationErrors.push({
              gate: "noUnresolvedErrors",
              error: `${blockingErrors.length} unresolved error(s) found:\n\n${errorDetails}`,
            });
          } else {
            gates.noUnresolvedErrors = true;
            logger.info({ msg: "✅ Gate 4 passed: No unresolved errors" });
          }

          // Gate 5: Check Shipper Cloud setup if enabled
          logger.info({ msg: "Gate 5: Checking Shipper Cloud setup" });
          try {
            const convexDeployment = await prisma.convexDeployment.findUnique({
              where: { projectId: context.projectId },
              select: {
                setupComplete: true,
                convexDeploymentUrl: true,
                deployKeyEncrypted: true,
                webhookSecretEncrypted: true,
                webhookConfiguredAt: true,
              },
            });

            if (convexDeployment) {
              // Project has Shipper Cloud enabled - validate setup
              const shipperCloudErrors: string[] = [];

              // Check 1: Verify setup is complete
              if (!convexDeployment.setupComplete) {
                shipperCloudErrors.push(
                  "Shipper Cloud setup is incomplete. The deployment may have been interrupted. " +
                  "Re-run the deployToShipperCloud tool to complete setup.",
                );
              }

              // Check 2: Verify webhook is configured for usage tracking
              if (
                !convexDeployment.webhookSecretEncrypted ||
                !convexDeployment.webhookConfiguredAt
              ) {
                shipperCloudErrors.push(
                  "Shipper Cloud webhook is not configured. Usage tracking and billing may not work. " +
                  "Re-run the deployToShipperCloud tool to configure the webhook.",
                );
              }

              // Check 3: Scan for forbidden convex/react auth components in fragment files
              if (fragmentData?.files) {
                const files = fragmentData.files as { [path: string]: string };
                const forbiddenImports = [
                  "AuthLoading",
                  "Authenticated",
                  "Unauthenticated",
                ];
                const forbiddenPattern = new RegExp(
                  `import\\s*{[^}]*(${forbiddenImports.join("|")})[^}]*}\\s*from\\s*['"]convex/react['"]`,
                  "g",
                );

                for (const [filePath, content] of Object.entries(files)) {
                  if (
                    typeof content === "string" &&
                    (filePath.endsWith(".tsx") || filePath.endsWith(".ts"))
                  ) {
                    const matches = content.match(forbiddenPattern);
                    if (matches) {
                      shipperCloudErrors.push(
                        `File "${filePath}" imports forbidden auth components from 'convex/react': ${matches.join(", ")}. ` +
                        "These require ConvexProviderWithAuth which is NOT used by Shipper Cloud. " +
                        "Use useSession from '@/lib/auth-client' instead.",
                      );
                    }
                  }
                }
              }

              // Check 4: Verify sandbox has required env vars in .env.local
              // If missing, AUTO-INJECT them (builder may not have deployToShipperCloud tool)
              if (sandboxInfo?.sandboxId) {
                let needsInjection = false;
                let injectionReason = "";

                try {
                  const envLocalContent = await modalReadFile(
                    sandboxInfo.sandboxId,
                    ".env.local",
                  );

                  const requiredEnvVars = [
                    "VITE_CONVEX_URL",
                    "CONVEX_DEPLOY_KEY",
                  ];
                  const missingVars: string[] = [];

                  for (const varName of requiredEnvVars) {
                    if (
                      !envLocalContent ||
                      !envLocalContent.includes(`${varName}=`)
                    ) {
                      missingVars.push(varName);
                    }
                  }

                  if (missingVars.length > 0) {
                    needsInjection = true;
                    injectionReason = `Missing env vars: ${missingVars.join(", ")}`;
                  } else {
                    // Verify VITE_CONVEX_URL matches the deployment URL
                    const urlMatch =
                      envLocalContent.match(/VITE_CONVEX_URL=(.+)/);
                    if (
                      urlMatch &&
                      urlMatch[1].trim() !==
                      convexDeployment.convexDeploymentUrl
                    ) {
                      needsInjection = true;
                      injectionReason = `Wrong VITE_CONVEX_URL: expected ${convexDeployment.convexDeploymentUrl}, found ${urlMatch[1].trim()}`;
                    }
                  }
                } catch (envReadError) {
                  // .env.local doesn't exist or can't be read
                  needsInjection = true;
                  injectionReason = ".env.local file missing or unreadable";
                }

                // Auto-inject credentials if needed
                if (needsInjection) {
                  logger.info({
                    msg: "Auto-injecting Shipper Cloud credentials into sandbox",
                    reason: injectionReason,
                    projectId: context.projectId,
                  });

                  try {
                    await injectDeployKeyIntoSandbox(
                      context.projectId,
                      convexDeployment.deployKeyEncrypted,
                      convexDeployment.convexDeploymentUrl,
                    );
                    logger.info({
                      msg: "✅ Successfully auto-injected Shipper Cloud credentials",
                      projectId: context.projectId,
                    });
                    // Don't add to errors - we fixed it!
                  } catch (injectionError) {
                    // Injection failed - report as error
                    shipperCloudErrors.push(
                      `Failed to auto-inject Convex credentials: ${injectionError instanceof Error ? injectionError.message : String(injectionError)}. ` +
                      `Sandbox needs VITE_CONVEX_URL=${convexDeployment.convexDeploymentUrl}. ` +
                      "Try restarting the sandbox or contact support.",
                    );
                  }
                }
              }

              if (shipperCloudErrors.length > 0) {
                for (const error of shipperCloudErrors) {
                  validationErrors.push({
                    gate: "shipperCloudValid",
                    error,
                  });
                }
                logger.warn({
                  msg: "Shipper Cloud validation issues found",
                  errors: shipperCloudErrors,
                });
              } else {
                gates.shipperCloudValid = true;
                logger.info({
                  msg: "✅ Gate 5 passed: Shipper Cloud setup is valid",
                });
              }
            } else {
              // No Shipper Cloud deployment - gate passes (not applicable)
              gates.shipperCloudValid = true;
              logger.info({
                msg: "✅ Gate 5 passed: Shipper Cloud not enabled (skipped)",
              });
            }
          } catch (shipperCloudError) {
            logger.warn({
              msg: "Shipper Cloud validation check failed (non-blocking)",
              error:
                shipperCloudError instanceof Error
                  ? shipperCloudError.message
                  : String(shipperCloudError),
            });
            // Don't block on Shipper Cloud check failures
            gates.shipperCloudValid = true;
          }

          // Create filesystem snapshot for Modal sandboxes
          let snapshotImageId: string | null = null;
          if (
            sandboxInfo &&
            (sandboxInfo as unknown as { sandbox: unknown }).sandbox
          ) {
            logger.info({ msg: "Creating filesystem snapshot" });
            try {
              snapshotImageId = await createFilesystemSnapshot(
                (
                  sandboxInfo as unknown as {
                    sandbox: Parameters<typeof createFilesystemSnapshot>[0];
                  }
                ).sandbox,
                fragment.id,
                context.projectId,
              );
              logger.info({
                msg: "Snapshot created successfully",
                snapshotImageId,
                fragmentId: fragment.id,
              });
            } catch (snapshotError) {
              logger.warn({
                msg: "Snapshot creation failed (non-critical)",
                error:
                  snapshotError instanceof Error
                    ? snapshotError.message
                    : String(snapshotError),
                fragmentId: fragment.id,
              });
              // Don't fail finalization if snapshot fails - it's not critical
              // The fragment files JSON is still available as fallback
            }
          }

          // Determine if all validation gates passed
          const allGatesPassed = validationErrors.length === 0;

          if (allGatesPassed) {
            logger.info({ msg: "✅ All validation gates passed", gates });
          } else {
            logger.warn({
              msg: "Fragment saved but validation errors detected",
              fragmentId: fragment.id,
              validationErrorCount: validationErrors.length,
            });
          }

          const result = {
            success: true, // Fragment was saved successfully
            fragmentId: fragment.id,
            snapshotImageId,
            title: fragment.title,
            message: snapshotImageId
              ? `Working fragment finalized as: "${title}" with filesystem snapshot ${snapshotImageId}`
              : `Working fragment finalized as: "${title}"`,
            // Include validation results so AI knows about issues
            validationPassed: allGatesPassed,
            ...(validationErrors.length > 0 && {
              validationErrors: validationErrors.map((e) => ({
                gate: e.gate,
                error: e.error,
                ...(e.file && { file: e.file }),
              })),
              validationWarning: `Fragment saved but ${validationErrors.length} validation issue(s) detected. Consider fixing these issues.`,
            }),
            ...(blockingErrors.length > 0 && {
              unresolvedCount: blockingErrors.length,
              errorsByType: {
                buildErrors:
                  errorAnalysis.detectedErrors.buildErrors?.length ?? 0,
                importErrors:
                  errorAnalysis.detectedErrors.importErrors?.length ?? 0,
                navigationErrors:
                  errorAnalysis.detectedErrors.navigationErrors?.length ?? 0,
                runtimeErrors:
                  errorAnalysis.detectedErrors.runtimeErrors?.length ?? 0,
              },
              detailedErrors: errorDetails,
            }),
          };

          // Track tool usage with PostHog
          await trackToolSpan(
            "finalizeWorkingFragment",
            context.userId,
            context.traceId || generateSpanId(),
            { title },
            result,
            {
              spanId,
              latency: (Date.now() - startTime) / 1000,
              isError: false,
            },
          );

          await trackToolUsage(
            "finalizeWorkingFragment",
            context.userId,
            context.projectId,
            { title },
            result,
          );

          return result;
        } catch (error) {
          logger.error({
            msg: "Failed to finalize fragment",
            error: error instanceof Error ? error.message : String(error),
            fragmentId: currentFragmentId,
          });
          const errorResult = {
            success: false,
            message: "Failed to finalize working fragment",
            error: error instanceof Error ? error.message : String(error),
          };

          // Track tool usage error with PostHog
          await trackToolSpan(
            "finalizeWorkingFragment",
            context.userId,
            context.traceId || generateSpanId(),
            { title },
            errorResult,
            {
              spanId,
              latency: (Date.now() - startTime) / 1000,
              isError: true,
              error: errorResult.error,
            },
          );

          await trackToolUsage(
            "finalizeWorkingFragment",
            context.userId,
            context.projectId,
            { title },
            errorResult,
          );

          return errorResult;
        }
      } catch (error) {
        const errorResult = {
          error: error instanceof Error ? error.message : String(error),
        };

        // Track critical error with PostHog
        await trackToolSpan(
          "finalizeWorkingFragment",
          context.userId,
          context.traceId || generateSpanId(),
          { title },
          errorResult,
          {
            spanId,
            latency: (Date.now() - startTime) / 1000,
            isError: true,
            error: errorResult.error,
          },
        );

        throw error;
      }
    },
  });

/**
 * Create a filesystem snapshot of the current sandbox state
 * Captures COMPLETE filesystem including build artifacts, node_modules, user files
 */
export const createFragmentSnapshot = (context: ToolsContext) =>
  tool({
    description:
      "Create a complete filesystem snapshot of the current sandbox state. This captures ALL files including build artifacts, node_modules, and user-created files (not just tracked files). Use this before major changes, when work is complete, or to preserve the current state. Only works with Modal sandboxes.",
    inputSchema: z.object({
      reason: z
        .string()
        .describe(
          "Brief explanation of why this snapshot is being created (e.g., 'before refactoring', 'completed feature', 'milestone reached')",
        ),
    }),
    execute: async ({ reason }, { toolCallId: id }) => {
      const logger = getLogger(context);
      logger.info({
        msg: "createFragmentSnapshot called",
        reason,
        toolCallId: id,
      });
      const { projectId, currentFragmentId } = context;

      const spanId = generateSpanId();
      const startTime = Date.now();

      try {
        if (!currentFragmentId) {
          const errorResult = {
            success: false,
            message: "No active fragment to snapshot",
          };

          await trackToolSpan(
            "createFragmentSnapshot",
            context.userId,
            context.traceId || generateSpanId(),
            { reason },
            errorResult,
            {
              spanId,
              latency: (Date.now() - startTime) / 1000,
              isError: true,
            },
          );

          await trackToolUsage(
            "createFragmentSnapshot",
            context.userId,
            projectId,
            { reason },
            errorResult,
          );

          return errorResult;
        }

        // Get sandbox info
        const sandboxInfo = await getSandbox(projectId);

        if (!sandboxInfo?.sandbox) {
          const errorResult = {
            success: false,
            message: "Sandbox not available",
          };

          await trackToolSpan(
            "createFragmentSnapshot",
            context.userId,
            context.traceId || generateSpanId(),
            { reason },
            errorResult,
            {
              spanId,
              latency: (Date.now() - startTime) / 1000,
              isError: true,
            },
          );

          await trackToolUsage(
            "createFragmentSnapshot",
            context.userId,
            projectId,
            { reason },
            errorResult,
          );

          return errorResult;
        }

        logger.info({
          msg: "Creating snapshot for fragment",
          fragmentId: currentFragmentId,
          reason,
        });

        // Create the snapshot
        const snapshotImageId = await createFilesystemSnapshot(
          sandboxInfo.sandbox as any, // Cast to Sandbox type
          currentFragmentId,
          projectId,
        );

        const result = {
          success: true,
          snapshotImageId,
          fragmentId: currentFragmentId,
          message: `Filesystem snapshot created successfully: ${snapshotImageId}. Complete project state preserved including all files, build artifacts, and dependencies. Future sandbox restarts will use this snapshot for instant restoration.`,
          reason,
        };

        // Track tool usage with PostHog
        await trackToolSpan(
          "createFragmentSnapshot",
          context.userId,
          context.traceId || generateSpanId(),
          { reason },
          result,
          {
            spanId,
            latency: (Date.now() - startTime) / 1000,
            isError: false,
          },
        );

        await trackToolUsage(
          "createFragmentSnapshot",
          context.userId,
          projectId,
          { reason },
          result,
        );

        logger.info({
          msg: "Snapshot created successfully",
          snapshotImageId,
          fragmentId: currentFragmentId,
        });

        return result;
      } catch (error) {
        logger.error({
          msg: "Failed to create snapshot",
          error: error instanceof Error ? error.message : String(error),
          fragmentId: currentFragmentId,
        });
        const errorResult = {
          success: false,
          message: "Failed to create filesystem snapshot",
          error: error instanceof Error ? error.message : String(error),
        };

        // Track tool usage error with PostHog
        await trackToolSpan(
          "createFragmentSnapshot",
          context.userId,
          context.traceId || generateSpanId(),
          { reason },
          errorResult,
          {
            spanId,
            latency: (Date.now() - startTime) / 1000,
            isError: true,
            error: errorResult.error,
          },
        );

        await trackToolUsage(
          "createFragmentSnapshot",
          context.userId,
          projectId,
          { reason },
          errorResult,
        );

        return errorResult;
      }
    },
  });

// ============================================================================
// PHASE 2: SANDBOX & PACKAGE MANAGEMENT
// ============================================================================

/**
 * Install npm packages in the sandbox
 * Automatically detects package manager (npm, pnpm, yarn, bun)
 * Includes package validation to block harmful or incompatible packages
 */
export const installPackages = (context: ToolsContext) =>
  tool({
    description:
      "Install npm packages in the Modal sandbox by running the appropriate package manager command (bun add, npm install, pnpm add, or yarn add). Automatically detects the package manager by checking for lock files (bun.lockb, pnpm-lock.yaml, yarn.lock, package-lock.json). Defaults to bun if no lock file is found. Use this to add dependencies that are needed for the application.",
    inputSchema: z.object({
      packages: z
        .array(z.string())
        .max(
          MAX_PACKAGES_PER_INSTALL,
          `Cannot install more than ${MAX_PACKAGES_PER_INSTALL} packages at once`,
        )
        .describe(
          "Array of package names to install (e.g., ['date-fns', 'axios']). Some packages may be blocked.",
        ),
      dev: z
        .boolean()
        .optional()
        .default(false)
        .describe("Install as dev dependencies (default: false)"),
    }),
    execute: async ({ packages, dev = false }, { toolCallId: id }) => {
      const logger = getLogger(context);
      logger.info({
        msg: "installPackages called",
        packages,
        dev,
        toolCallId: id,
      });
      const { sandboxId } = context;

      const spanId = generateSpanId();
      const startTime = Date.now();

      try {
        if (!sandboxId) {
          throw new Error("Sandbox not found");
        }

        if (!packages || packages.length === 0) {
          throw new Error("No packages specified for installation");
        }

        // 🔒 SECURITY CHECK 1: Rate limiting
        const rateLimitResult = await checkRateLimit(
          context.userId,
          context.projectId,
        );
        if (!rateLimitResult.allowed) {
          const resetMinutes = Math.ceil(
            (rateLimitResult.resetAt.getTime() - Date.now()) / 60000,
          );
          throw new Error(
            `Rate limit exceeded. You can install packages again in ${resetMinutes} minute${resetMinutes !== 1 ? "s" : ""}. ` +
              `(${rateLimitResult.limitType === "user" ? "User" : "Project"} limit: ${rateLimitResult.limit} installs per hour)`,
          );
        }

        // 🔒 SECURITY CHECK 2: Blocklist validation
        const validation = validatePackages(packages);

        if (validation.blocked.length > 0) {
          logger.warn({
            msg: "Blocked packages detected",
            blocked: validation.blocked,
            allowed: validation.allowed,
          });
          throw new Error(
            `The following packages cannot be installed: ${validation.blocked.join(", ")}. These packages are blocked because they either won't work in the sandbox environment or pose security concerns.`,
          );
        }

        // If all packages were blocked, return early
        if (validation.allowed.length === 0) {
          throw new Error("No valid packages to install after filtering");
        }

        // Log warnings for flagged packages
        if (validation.warnings.length > 0) {
          logger.info({
            msg: "Package warnings",
            warnings: validation.warnings,
          });
        }

        // 🔒 SECURITY CHECK 3: Vulnerability scanning (block CRITICAL + HIGH only)
        const vulnerabilityResults: VulnerabilityResult[] = [];
        for (const pkg of validation.allowed) {
          const vulnResult = await checkVulnerabilities(pkg);
          vulnerabilityResults.push(vulnResult);

          if (vulnResult.critical > 0 || vulnResult.high > 0) {
            logger.warn({
              msg: "Vulnerable package detected",
              package: pkg,
              critical: vulnResult.critical,
              high: vulnResult.high,
            });
            throw new Error(
              `Package "${pkg}" has ${vulnResult.critical} critical and ${vulnResult.high} high severity vulnerabilities. ` +
                `Installation blocked for security reasons. Please choose a safer alternative or use a different version.`,
            );
          }
        }

        // 🔒 SECURITY CHECK 4: Package size validation
        let totalSize = 0;
        const sizeCheckResults: Array<{ package: string; size: number }> = [];
        for (const pkg of validation.allowed) {
          const sizeCheck = await checkPackageSize(pkg);
          if (!sizeCheck.allowed) {
            throw new Error(sizeCheck.reason || `Package ${pkg} is too large`);
          }
          totalSize += sizeCheck.size;
          sizeCheckResults.push({ package: pkg, size: sizeCheck.size });
        }

        if (totalSize > MAX_TOTAL_INSTALL_SIZE) {
          throw new Error(
            `Total installation size (${formatBytes(totalSize)}) exceeds maximum allowed (${formatBytes(MAX_TOTAL_INSTALL_SIZE)}). ` +
              `Try installing fewer packages at once.`,
          );
        }

        // 🔒 SECURITY CHECK 5: Reputation checking (warnings only, never block)
        const reputationWarnings: string[] = [];
        for (const pkg of validation.allowed) {
          const reputation = await checkPackageReputation(pkg);
          if (reputation.warnings.length > 0) {
            reputationWarnings.push(
              `${pkg}: ${reputation.warnings.join(", ")}`,
            );
          }
        }

        // Get sandbox instance
        const sandboxInfo = await getSandbox(context.projectId);
        if (!sandboxInfo) {
          throw new Error("Sandbox not available");
        }

        // Modal sandboxes only have bun installed
        const packageManager = "bun";
        const packagesToInstall = validation.allowed;
        const packagesStr = packagesToInstall.join(" ");
        const installCommand = `bun add ${dev ? "-d" : ""} ${packagesStr}`;

        logger.info({
          msg: "Running install command with bun",
          command: installCommand,
          packages: packagesToInstall,
          dev,
        });

        // Execute the install command
        const result = await modalExecuteCommand(sandboxId, installCommand, {
          timeoutMs: 120000, // 2 minute timeout for package installation
        });

        // Parse the output for errors
        const parseResult = parseNpmOutput(
          result.stdout || "",
          result.stderr || "",
        );

        const exitCode = result.exitCode ?? 0;
        if (exitCode !== 0 && !parseResult.success) {
          const errorMessage =
            formatInstallError(parseResult) ||
            result.stderr ||
            result.stdout ||
            "Installation failed";
          throw new Error(errorMessage);
        }

        // Increment rate limit counter after successful installation
        await incrementRateLimit(context.userId, context.projectId);

        // Build result message
        let message = `Successfully installed ${packagesToInstall.length} package(s) using ${packageManager}`;

        // Add existing warnings to message
        if (validation.warnings.length > 0) {
          message += `\n\nWarnings:`;
          for (const warning of validation.warnings) {
            message += `\n- ${warning.package}: ${warning.message}`;
          }
        }

        // Add reputation warnings to message
        if (reputationWarnings.length > 0) {
          message += `\n\nSecurity Notices:`;
          for (const warning of reputationWarnings) {
            message += `\n- ${warning}`;
          }
        }

        const installResult = {
          success: true,
          message,
          packages: packagesToInstall,
          requestedPackages: packages,
          blockedPackages: validation.blocked,
          warnings: validation.warnings,
          dev,
          packageManager,
          stdout: result.stdout,
          // Security check results
          securityChecks: {
            vulnerabilities: vulnerabilityResults,
            packageSizes: sizeCheckResults,
            totalSize,
            totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
            reputationWarnings,
            rateLimitRemaining: rateLimitResult.remaining,
          },
        };

        // Track tool usage with PostHog (including security metrics)
        await trackToolSpan(
          "installPackages",
          context.userId,
          context.traceId || generateSpanId(),
          {
            packages,
            dev,
            packageManager,
            blockedCount: validation.blocked.length,
            warningCount: validation.warnings.length,
            // Security metrics
            totalVulnerabilities: vulnerabilityResults.reduce(
              (sum, r) => sum + r.critical + r.high + r.moderate + r.low,
              0,
            ),
            criticalVulnerabilities: vulnerabilityResults.reduce(
              (sum, r) => sum + r.critical,
              0,
            ),
            highVulnerabilities: vulnerabilityResults.reduce(
              (sum, r) => sum + r.high,
              0,
            ),
            moderateVulnerabilities: vulnerabilityResults.reduce(
              (sum, r) => sum + r.moderate,
              0,
            ),
            totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
            reputationWarningCount: reputationWarnings.length,
            rateLimitRemaining: rateLimitResult.remaining,
          },
          installResult,
          {
            spanId,
            latency: (Date.now() - startTime) / 1000,
            isError: false,
          },
        );

        await trackToolUsage(
          "installPackages",
          context.userId,
          context.projectId,
          { packages, dev, packageManager },
          installResult,
        );

        return installResult;
      } catch (error) {
        const logger = getLogger(context);
        logger.error({
          msg: "Package installation failed",
          error: error instanceof Error ? error.message : String(error),
          packages,
        });

        const errorMessage =
          error instanceof Error ? error.message : String(error);
        let userFriendlyMessage = `Failed to install packages: ${errorMessage}`;

        // Check if this is already a user-friendly error message
        if (
          errorMessage.includes("cannot be installed") ||
          errorMessage.includes("blocked") ||
          errorMessage.includes("Rate limit exceeded") ||
          errorMessage.includes("vulnerabilities") ||
          errorMessage.includes("exceeds maximum")
        ) {
          userFriendlyMessage = errorMessage;
        }

        const errorResult = {
          success: false,
          packages,
          dev,
          error: errorMessage,
          message: userFriendlyMessage,
        };

        // Track tool usage error with PostHog
        await trackToolSpan(
          "installPackages",
          context.userId,
          context.traceId || generateSpanId(),
          { packages, dev },
          errorResult,
          {
            spanId,
            latency: (Date.now() - startTime) / 1000,
            isError: true,
            error: errorResult.error,
          },
        );

        await trackToolUsage(
          "installPackages",
          context.userId,
          context.projectId,
          { packages, dev },
          errorResult,
        );

        throw error;
      }
    },
  });

/**
 * Quick text replacement in files
 * Uses manual text replacement with regex escaping and fallback to simple string replacement
 */
export const quickEdit = (context: ToolsContext) =>
  tool({
    description:
      "Make quick, precise code edits using text replacement. This tool applies ALL replacements in the array sequentially. CRITICAL: Patterns must match EXACTLY including all whitespace, attributes, and formatting. If you need to replace multiple variations (e.g., different class names or attributes), you MUST include a separate replacement for each exact pattern. Always read the file first with readFile to see all variations before creating replacements. Example: [{pattern: 'const foo = 1', replacement: 'const foo = 2', description: 'Update foo value'}, {pattern: 'const bar = 1', replacement: 'const bar = 2', description: 'Update bar value'}]",
    inputSchema: z.object({
      filePath: z
        .string()
        .describe("The path to the file to edit (relative to project root)"),
      replacements: z
        .array(
          z.object({
            pattern: z
              .string()
              .describe(
                "The EXACT text pattern to search for and replace. Must match precisely including whitespace, attributes, quotes, etc. If there are multiple variations, create separate replacements for each.",
              ),
            replacement: z
              .string()
              .describe("The new text to replace the pattern with"),
            description: z
              .string()
              .optional()
              .describe("Optional description of this specific replacement"),
          }),
        )
        .describe(
          "Array of text replacements to apply. ALL replacements will be applied sequentially. Each pattern must match EXACTLY. If replacing a symbol (e.g., Plus -> Flame), include separate replacements for: 1) the import statement, 2) each JSX usage with exact attributes/classes, 3) any other variations.",
        ),
      description: z
        .string()
        .describe("Brief description of the changes being made"),
    }),
    execute: async (
      { filePath, replacements, description },
      { toolCallId: id },
    ) => {
      const logger = getLogger(context);
      logger.info({
        msg: "quickEdit called",
        filePath,
        replacementCount: replacements.length,
        description,
        toolCallId: id,
      });
      const { sandboxId, fragmentFiles, currentFragmentId } = context;

      const spanId = generateSpanId();
      const startTime = Date.now();

      try {
        if (!sandboxId) {
          throw new Error("Sandbox not found");
        }

        // 🚨 CRITICAL BLOCK: Prevent editing index.css files
        if (filePath.endsWith("index.css") || filePath.includes("/index.css")) {
          const errorMsg =
            "🚨 CRITICAL SECURITY BLOCK: Editing index.css is not allowed. These templates use Tailwind v4 which relies on index.css for all styling configuration. Modifying this file can break the entire Tailwind setup, theme system, and component styling. All styling should be done through Tailwind utility classes in components instead.";
          logger.error({ msg: "BLOCKED: index.css edit attempt", filePath });
          throw new Error(errorMsg);
        }

        // Get sandbox instance
        const sandboxInfo = await getSandbox(context.projectId);
        if (!sandboxInfo) {
          throw new Error("Sandbox not available");
        }

        // Ensure fragmentFiles is initialized
        if (!context.fragmentFiles) {
          context.fragmentFiles = new Map<string, string>();
        }
        if (!context.files) {
          context.files = new Map<string, { size: number; modified: number }>();
        }

        let originalContent = "";

        // Get existing fragment files first to understand current state
        let existingFragmentFiles: { [path: string]: string } = {};
        if (currentFragmentId) {
          try {
            const existingFragment = await prisma.v2Fragment.findUnique({
              where: { id: currentFragmentId },
              select: { files: true },
            });

            if (existingFragment?.files) {
              existingFragmentFiles = existingFragment.files as {
                [path: string]: string;
              };
            }
          } catch (error) {
            logger.warn({
              msg: "Could not load existing fragment files",
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        // Get current file content (prefer fragment, fallback to sandbox)
        if (existingFragmentFiles[filePath]) {
          originalContent = existingFragmentFiles[filePath];
          logger.info({
            msg: "Found file in fragment",
            filePath,
            charCount: originalContent.length,
          });
        } else {
          try {
            // Read from sandbox
            originalContent = await readFileFromSandbox(
              sandboxInfo.sandbox,
              filePath,
            );
            logger.info({
              msg: "Found file in sandbox",
              filePath,
              charCount: originalContent.length,
            });
          } catch (error) {
            throw new Error(
              `File ${filePath} not found in sandbox or fragment`,
            );
          }
        }

        // Log replacement details
        logger.info({
          msg: "Applying replacements",
          filePath,
          replacementCount: replacements.length,
        });
        replacements.forEach((replacement, index) => {
          logger.info({
            msg: `Replacement ${index + 1}`,
            patternLength: replacement.pattern.length,
            replacementLength: replacement.replacement.length,
            description: replacement.description,
          });
        });

        // Apply replacements
        let editedContent = originalContent;
        let totalReplacements = 0;
        const appliedReplacements: Array<{
          pattern: string;
          replacement: string;
          applied: boolean;
        }> = [];

        try {
          // Apply manual replacements
          logger.info({ msg: "Applying manual replacements" });
          for (const replacement of replacements) {
            const { pattern, replacement: newValue } = replacement;

            // Escape regex special characters for exact text matching
            const escapedPattern = pattern.replace(
              /[.*+?^${}()|[\]\\]/g,
              "\\$&",
            );

            const patternCount = (
              editedContent.match(new RegExp(escapedPattern, "g")) || []
            ).length;

            if (patternCount === 0) {
              logger.warn({
                msg: "Pattern not found in content",
                pattern: pattern.substring(0, 50),
              });
              appliedReplacements.push({
                pattern,
                replacement: newValue,
                applied: false,
              });
              continue;
            }

            const contentBeforeReplacement = editedContent;

            try {
              editedContent = editedContent.replace(
                new RegExp(escapedPattern, "g"),
                newValue,
              );
            } catch (regexError) {
              // If regex still fails, fall back to simple string replacement
              logger.warn({
                msg: "Regex replacement failed, using simple string replace",
                error:
                  regexError instanceof Error
                    ? regexError.message
                    : String(regexError),
              });
              // Use split/join for global replacement without regex
              editedContent = editedContent.split(pattern).join(newValue);
            }

            // Check if content actually changed (not just length)
            const contentChanged = editedContent !== contentBeforeReplacement;

            if (contentChanged) {
              totalReplacements++;
              appliedReplacements.push({
                pattern,
                replacement: newValue,
                applied: true,
              });
              logger.info({
                msg: "Replacement applied",
                patternCount,
              });
            } else {
              appliedReplacements.push({
                pattern,
                replacement: newValue,
                applied: false,
              });
              logger.warn({
                msg: "Pattern found but replacement did not change content",
                pattern: pattern.substring(0, 50),
              });
            }
          }

          // 🔍 MONITORING CHECK: Ensure index.html retains the monitoring script import
          editedContent = ensureMonitoringScript(editedContent, filePath);

          await validateSyntaxOrThrow(filePath, editedContent);

          // Write the manually edited content back
          await writeFileToSandbox(
            sandboxInfo.sandbox,
            filePath,
            editedContent,
          );

          // 🛡️ ROUTE FILE PROTECTION: TanStack Router race condition fix
          // (Same protection as in createOrEditFiles)
          if (filePath.startsWith("src/routes/") && filePath.endsWith(".tsx")) {
            await new Promise((resolve) => setTimeout(resolve, 200));
            try {
              const verifyContent = await readFileFromSandbox(
                sandboxInfo.sandbox,
                filePath,
              );
              const isCorrupted =
                verifyContent.includes('return <div>Hello "') ||
                verifyContent.includes("return <div>Hello '/") ||
                (verifyContent.includes('Hello "/') &&
                  verifyContent.length < editedContent.length * 0.5);
              if (isCorrupted) {
                logger.warn({
                  msg: "🔄 Route file corrupted by TanStack Router plugin (quickEdit), re-writing",
                  filePath,
                });
                await writeFileToSandbox(
                  sandboxInfo.sandbox,
                  filePath,
                  editedContent,
                );
              }
            } catch (verifyError) {
              logger.warn({
                msg: "Could not verify route file after quickEdit",
                filePath,
                error:
                  verifyError instanceof Error
                    ? verifyError.message
                    : String(verifyError),
              });
            }
          }

          logger.info({
            msg: "Content modified",
            filePath,
            originalLength: originalContent.length,
            editedLength: editedContent.length,
            totalReplacements,
          });
        } catch (replacementError) {
          logger.error({
            msg: "Replacement failed",
            filePath,
            error:
              replacementError instanceof Error
                ? replacementError.message
                : String(replacementError),
          });
          throw replacementError;
        }

        // Validate that all replacements were applied
        const failedReplacements = appliedReplacements.filter(
          (r) => !r.applied,
        );
        const expectedReplacements = replacements.length;
        // Check that every specific replacement was applied, not just the count
        const allReplacementsApplied = appliedReplacements.every(
          (r) => r.applied,
        );

        // Detect remaining references to old symbols (e.g., Plus when it should be Flame)
        const remainingReferences: string[] = [];
        for (const replacement of replacements) {
          // Extract old symbol name from import patterns like "import { Plus }" or "<Plus" or "<Plus />"
          const importMatch = replacement.pattern.match(
            /import\s*\{\s*(\w+)\s*\}/,
          );
          const jsxMatch = replacement.pattern.match(/<(\w+)(?:\s|>|\/)/);
          const oldSymbol = importMatch?.[1] || jsxMatch?.[1];

          // Extract new symbol name from replacement to check if symbol was actually changed
          const newImportMatch = replacement.replacement.match(
            /import\s*\{\s*(\w+)\s*\}/,
          );
          const newJsxMatch =
            replacement.replacement.match(/<(\w+)(?:\s|>|\/)/);
          const newSymbol = newImportMatch?.[1] || newJsxMatch?.[1];

          // Only check for remaining references if the symbol was actually replaced (old != new)
          // This prevents false positives when the same symbol appears in both pattern and replacement
          if (oldSymbol && newSymbol && oldSymbol !== newSymbol) {
            // Escape regex special characters in the symbol name
            const escapedSymbol = oldSymbol.replace(
              /[.*+?^${}()|[\]\\]/g,
              "\\$&",
            );

            // Check if old symbol still exists in the file
            // Look for JSX usage: <OldSymbol or {OldSymbol or OldSymbol.
            const symbolPatterns = [
              new RegExp(`<${escapedSymbol}(?:\\s|>|/|\\{)`, "g"),
              new RegExp(`\\{${escapedSymbol}\\}`, "g"),
              new RegExp(`\\b${escapedSymbol}\\.`, "g"),
            ];

            for (const pattern of symbolPatterns) {
              const matches = editedContent.match(pattern);
              if (matches && matches.length > 0) {
                remainingReferences.push(
                  `Found remaining reference to '${oldSymbol}' (${matches.length} occurrence${matches.length > 1 ? "s" : ""})`,
                );
                break; // Only report once per symbol
              }
            }
          }

          // Also check if the pattern itself still exists (for non-symbol replacements)
          if (!oldSymbol) {
            const escapedPattern = replacement.pattern.replace(
              /[.*+?^${}()|[\]\\]/g,
              "\\$&",
            );
            try {
              const patternMatches = editedContent.match(
                new RegExp(escapedPattern, "g"),
              );
              if (patternMatches && patternMatches.length > 0) {
                remainingReferences.push(
                  `Pattern still found in content: "${replacement.pattern.substring(0, 30)}..."`,
                );
              }
            } catch {
              // Ignore regex errors for this check
            }
          }
        }

        // Track in context
        context.files.set(filePath, {
          size: editedContent.length,
          modified: Date.now(),
        });
        context.fragmentFiles.set(filePath, editedContent);

        // Update the working fragment
        await updateWorkingFragment(
          context,
          `Quick edited ${filePath}: ${description}`,
        );

        const wasModified = editedContent !== originalContent;

        // Build warning/error messages
        const warnings: string[] = [];
        if (!allReplacementsApplied) {
          warnings.push(
            `Only ${totalReplacements} of ${expectedReplacements} replacements were applied.`,
          );
        }
        if (failedReplacements.length > 0) {
          warnings.push(
            `${failedReplacements.length} replacement(s) failed: ${failedReplacements.map((r) => `"${r.pattern.substring(0, 30)}..."`).join(", ")}`,
          );
        }
        if (remainingReferences.length > 0) {
          warnings.push(
            `⚠️ Partial edit detected: ${remainingReferences.join("; ")}`,
          );
        }

        const result = {
          success:
            wasModified &&
            allReplacementsApplied &&
            remainingReferences.length === 0,
          filePath,
          action: wasModified ? "quick_edited" : "no_changes",
          description,
          replacementsApplied: totalReplacements,
          replacementsExpected: expectedReplacements,
          replacementsFailed: failedReplacements.length,
          originalSize: originalContent.length,
          newSize: editedContent.length,
          sizeDelta: editedContent.length - originalContent.length,
          replacements: replacements.map((r) => {
            const applied =
              appliedReplacements.find((ar) => ar.pattern === r.pattern)
                ?.applied ?? false;
            return {
              pattern:
                r.pattern.substring(0, 50) +
                (r.pattern.length > 50 ? "..." : ""),
              replacement:
                r.replacement.substring(0, 50) +
                (r.replacement.length > 50 ? "..." : ""),
              description: r.description,
              applied,
            };
          }),
          warnings: warnings.length > 0 ? warnings : undefined,
          remainingReferences:
            remainingReferences.length > 0 ? remainingReferences : undefined,
          message: wasModified
            ? allReplacementsApplied && remainingReferences.length === 0
              ? `Applied ${totalReplacements} text replacements successfully`
              : `Applied ${totalReplacements} of ${expectedReplacements} replacements${warnings.length > 0 ? ` - ${warnings.join(" ")}` : ""}`
            : `No changes made - patterns may not have been found`,
        };

        logger.info({
          msg: wasModified
            ? "Successfully applied replacements"
            : "No changes from replacements",
          filePath,
          replacementCount: replacements.length,
          replacementsApplied: totalReplacements,
          originalLength: originalContent.length,
          editedLength: editedContent.length,
        });

        // Track tool usage with PostHog
        await trackToolSpan(
          "quickEdit",
          context.userId,
          context.traceId || generateSpanId(),
          { filePath, replacementsCount: replacements.length, description },
          result,
          {
            spanId,
            latency: (Date.now() - startTime) / 1000,
            isError: false,
          },
        );

        await trackToolUsage(
          "quickEdit",
          context.userId,
          context.projectId,
          { filePath, replacementsCount: replacements.length, description },
          result,
          { wasModified },
        );

        return result;
      } catch (error) {
        logger.error({
          msg: "Failed to edit file",
          filePath,
          error: error instanceof Error ? error.message : String(error),
        });
        const errorResult = {
          error: error instanceof Error ? error.message : String(error),
        };

        // Track tool usage error with PostHog
        await trackToolSpan(
          "quickEdit",
          context.userId,
          context.traceId || generateSpanId(),
          { filePath, replacementsCount: replacements.length, description },
          errorResult,
          {
            spanId,
            latency: (Date.now() - startTime) / 1000,
            isError: true,
            error: errorResult.error,
          },
        );

        throw error;
      }
    },
  });

/**
 * Tool 13: detectErrors
 * Detect and analyze code errors (build, TypeScript, runtime)
 *
 * NOTE: This tool requires error detection service infrastructure in the API server.
 * The web app version uses tRPC to call complex error detection logic.
 * For now, this is a stub implementation that needs to be fully implemented
 * when error detection services are migrated to the API server.
 */
export const detectErrors = (context: ToolsContext) =>
  tool({
    description:
      "🚨 MANDATORY: Detect and analyze code errors, then STORE them in the database for autoFixErrors. This tool MUST be run BEFORE autoFixErrors. It identifies build errors, TypeScript issues, import problems, and runtime errors, then stores them in the projectError database table. autoFixErrors reads from this database. ALWAYS run this after making ANY code changes (initial build or edits). This is not optional - it's required for the error fix workflow.",
    inputSchema: z.object({
      includeAutoFix: z
        .boolean()
        .optional()
        .default(false)
        .describe("Include auto-fix suggestions for detected errors"),
      severity: z
        .enum(["low", "medium", "high", "critical"])
        .optional()
        .describe("Filter errors by minimum severity level"),
    }),
    execute: async (
      { includeAutoFix = false, severity },
      { toolCallId: id },
    ) => {
      const logger = getLogger(context);
      logger.info({
        msg: "detectErrors called",
        includeAutoFix,
        severity,
        toolCallId: id,
      });
      const { fragmentFiles, projectId, userId, traceId } = context;

      const spanId = generateSpanId();
      const startTime = Date.now();

      try {
        const analysis = await analyzeProjectErrors(context, {
          includeAutoFix,
          severity,
          store: true,
          excludeLowSeverity: true,
        });

        const detectedErrors = analysis.detectedErrors;
        const classification = ErrorClassifier.categorizeErrors(detectedErrors);

        const result = {
          success: true,
          errors: detectedErrors,
          classification,
          summary: {
            totalErrors: detectedErrors.totalErrors,
            severity: detectedErrors.severity || "low", // ← Add severity to summary with fallback
            autoFixable: detectedErrors.autoFixable,
            buildErrors: detectedErrors.buildErrors.length,
            importErrors: detectedErrors.importErrors.length,
            navigationErrors: detectedErrors.navigationErrors.length,
            analysisType: analysis.analysisType,
          },
          message: `Found ${detectedErrors.totalErrors} error${detectedErrors.totalErrors !== 1 ? "s" : ""} - ${detectedErrors.severity || "low"} severity`,
        };

        await trackToolSpan(
          "detectErrors",
          userId,
          traceId || generateSpanId(),
          { includeAutoFix, severity },
          result,
          {
            spanId,
            latency: (Date.now() - startTime) / 1000,
            isError: false,
          },
        );

        await trackToolUsage(
          "detectErrors",
          userId,
          projectId,
          { includeAutoFix, severity },
          result.summary,
        );

        return result;
      } catch (error) {
        logger.error({
          msg: "Error detection failed",
          error: error instanceof Error ? error.message : String(error),
        });
        const errorResult = {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          errors: null,
          summary: { totalErrors: 0, autoFixable: false },
        };

        await trackToolSpan(
          "detectErrors",
          userId,
          traceId || generateSpanId(),
          { includeAutoFix, severity },
          errorResult,
          {
            spanId,
            latency: (Date.now() - startTime) / 1000,
            isError: true,
          },
        );

        return errorResult;
      }
    },
  });

/**
 * Tool 14: autoFixErrors
 * Automatically fix errors detected by detectErrors
 *
 * NOTE: This tool requires auto-fix service infrastructure in the API server.
 * The web app version uses tRPC to call complex auto-fix logic with AI.
 * For now, this is a stub implementation that needs to be fully implemented
 * when auto-fix services are migrated to the API server.
 */
export const autoFixErrors = (context: ToolsContext) =>
  tool({
    description:
      "🚨 CRITICAL: Automatically fix errors that were detected and stored by detectErrors. MANDATORY REQUIREMENT: You MUST run detectErrors BEFORE calling this tool. detectErrors stores errors in the database, and autoFixErrors reads from that database. Calling this without detectErrors will fail.",
    inputSchema: z.object({
      severity: z
        .enum(["low", "medium", "high", "critical"])
        .optional()
        .describe("Minimum severity level of errors to fix"),
      maxFixes: z
        .number()
        .optional()
        .default(10)
        .describe("Maximum number of errors to fix in one operation"),
    }),
    execute: async ({ severity, maxFixes = 10 }, { toolCallId: id }) => {
      const logger = getLogger(context);
      logger.info({
        msg: "autoFixErrors called",
        severity,
        maxFixes,
        toolCallId: id,
      });
      const { projectId, userId, traceId, currentFragmentId } = context;

      const spanId = generateSpanId();
      const startTime = Date.now();

      try {
        // Get current fragment for auto-fix
        const targetFragment = await prisma.v2Fragment.findFirst({
          where: { projectId },
          orderBy: { createdAt: "desc" },
          select: { id: true, title: true, files: true },
        });

        if (!targetFragment || !targetFragment.files) {
          const result = {
            success: false,
            error: "No fragment found to fix",
            errorCount: 0,
            fixedCount: 0,
            message: "No fragment found with files to fix",
          };

          await trackToolUsage(
            "autoFixErrors",
            userId,
            projectId,
            { severity, maxFixes },
            { success: result.success, fixedCount: result.fixedCount },
          );

          return result;
        }

        const fragmentFiles = targetFragment.files as {
          [path: string]: string;
        };

        logger.info({
          msg: "Starting auto-fix for fragment",
          fragmentId: targetFragment.id,
        });

        // First, detect errors
        const analysis = await analyzeProjectErrors(context, {
          includeAutoFix: false,
          store: true,
          excludeLowSeverity: false,
        });
        const detectedErrors = analysis.detectedErrors;

        if (detectedErrors.totalErrors === 0) {
          const result = {
            success: true,
            errorCount: 0,
            fixedCount: 0,
            message: "No errors found to fix",
          };

          await trackToolUsage(
            "autoFixErrors",
            userId,
            projectId,
            { severity, maxFixes },
            { success: result.success, fixedCount: result.fixedCount },
          );

          return result;
        }

        const sandboxInfo = await getSandbox(projectId);

        // Initialize VoltAgent service
        const voltAgent = new VoltAgentService();

        // Collect all errors and prioritize by severity
        const allErrors = [
          ...detectedErrors.buildErrors,
          ...detectedErrors.importErrors,
          ...detectedErrors.navigationErrors,
        ];

        // Sort by severity: CRITICAL > HIGH > MEDIUM > LOW
        // Handle both ErrorSeverity enum and string values, plus undefined/null
        const severityOrder: Record<string, number> = {
          critical: 0,
          high: 1,
          medium: 2,
          low: 3,
        };

        allErrors.sort((a, b) => {
          const aSeverityStr = a.severity?.toString().toLowerCase() || "low";
          const bSeverityStr = b.severity?.toString().toLowerCase() || "low";
          const aSeverity = severityOrder[aSeverityStr] ?? 999;
          const bSeverity = severityOrder[bSeverityStr] ?? 999;
          return aSeverity - bSeverity;
        });

        logger.info({
          msg: "Processing errors with VoltAgent (sorted by severity)",
          errorCount: Math.min(allErrors.length, maxFixes),
          totalErrors: allErrors.length,
          highSeverity: allErrors.filter((e) => {
            const sev = e.severity?.toString().toLowerCase();
            return sev === "high" || sev === "critical";
          }).length,
        });

        // Process errors with VoltAgent (limit to maxFixes)
        const fixResults = [];
        let successfulFixes = 0;
        let failedFixes = 0;

        for (const error of allErrors.slice(0, maxFixes)) {
          try {
            logger.info({
              msg: "Fixing error",
              errorId: error.id,
              errorType: error.type,
              severity: error.severity,
            });

            // Construct error context with proper details structure
            const errorContext = {
              id: error.id,
              type: error.type,
              details: {
                ...error.details,
                // Import errors have file/importPath at top level, move them to details
                file: (error as any).file || error.details?.file,
                importPath:
                  (error as any).importPath || error.details?.importPath,
                // Navigation errors have route at top level
                route: (error as any).route || error.details?.route,
              },
              severity: error.severity,
              autoFixable: error.autoFixable,
            };

            const fixResult = await voltAgent.fixError(
              errorContext,
              fragmentFiles,
              sandboxInfo?.sandbox,
            );

            if (fixResult.success) {
              successfulFixes++;
              fixResults.push({
                errorId: error.id,
                success: true,
                fixedFiles: fixResult.fixedFiles,
                strategy: fixResult.strategy,
                changes: fixResult.changes,
              });
              logger.info({
                msg: "Successfully fixed error",
                errorId: error.id,
              });
            } else {
              failedFixes++;
              fixResults.push({
                errorId: error.id,
                success: false,
                reason: fixResult.reason,
              });
              logger.info({
                msg: "Failed to fix error",
                errorId: error.id,
                reason: fixResult.reason,
              });
            }
          } catch (fixError) {
            logger.error({
              msg: "Error fixing error",
              errorId: error.id,
              error:
                fixError instanceof Error ? fixError.message : String(fixError),
            });
            failedFixes++;
            fixResults.push({
              errorId: error.id,
              success: false,
              reason:
                fixError instanceof Error ? fixError.message : "Unknown error",
            });
          }
        }

        // Create new fragment with fixes if any were successful
        let newFragmentId = null;
        if (successfulFixes > 0) {
          const updatedFiles = { ...fragmentFiles };

          // Apply fixes
          for (const fix of fixResults.filter((r) => r.success)) {
            if (fix.fixedFiles && typeof fix.fixedFiles === "object") {
              Object.assign(updatedFiles, fix.fixedFiles);
            }
          }

          // Create new fragment
          const newFragment = await prisma.v2Fragment.create({
            data: {
              projectId,
              title: `${targetFragment.title} (Auto-fixed)`,
              files: updatedFiles,
            },
          });

          newFragmentId = newFragment.id;

          // Update project's active fragment
          await prisma.project.update({
            where: { id: projectId },
            data: {
              activeFragmentId: newFragment.id,
              updatedAt: new Date(),
            },
          });

          // Update context to track the new fragment
          context.currentFragmentId = newFragment.id;
          context.fragmentFiles = new Map(Object.entries(updatedFiles));

          logger.info({
            msg: "Created new fragment with fixes",
            newFragmentId,
            originalFragmentId: targetFragment.id,
          });
        }

        const successRate =
          allErrors.length > 0 ? (successfulFixes / allErrors.length) * 100 : 0;

        const result = {
          success: successfulFixes > 0,
          errorCount: allErrors.length,
          fixedCount: successfulFixes,
          failedCount: failedFixes,
          successRate: successRate.toFixed(1),
          newFragmentId,
          originalFragmentId: targetFragment.id,
          message:
            successfulFixes > 0
              ? `Successfully fixed ${successfulFixes} out of ${allErrors.length} errors (${successRate.toFixed(1)}%)`
              : `Could not auto-fix any of the ${allErrors.length} errors`,
        };

        // Track tool usage
        await trackToolSpan(
          "autoFixErrors",
          userId,
          traceId || generateSpanId(),
          { severity, maxFixes },
          result,
          {
            spanId,
            latency: (Date.now() - startTime) / 1000,
            isError: successfulFixes === 0,
          },
        );

        await trackToolUsage(
          "autoFixErrors",
          userId,
          projectId,
          { severity, maxFixes },
          { success: result.success, fixedCount: result.fixedCount },
        );

        return result;
      } catch (error) {
        logger.error({
          msg: "Auto-fix failed",
          error: error instanceof Error ? error.message : String(error),
        });
        const errorResult = {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          errorCount: 0,
          fixedCount: 0,
        };

        await trackToolSpan(
          "autoFixErrors",
          userId,
          traceId || generateSpanId(),
          { severity, maxFixes },
          errorResult,
          {
            spanId,
            latency: (Date.now() - startTime) / 1000,
            isError: true,
          },
        );

        return errorResult;
      }
    },
  });

// ============================================================================
// PHASE 5: ADVANCED FEATURES
// ============================================================================

/**
 * Tool 15: simpleMessage
 * Display a simple message in the chat window
 */
export const simpleMessage = (context: ToolsContext) =>
  tool({
    description:
      "Display a simple message in the chat window without any LLM action. Used for showing status updates like 'AutoFix Successful'.",
    inputSchema: z.object({
      message: z.string().describe("The message to display in the chat window"),
      type: z
        .enum(["success", "info", "warning", "error"])
        .optional()
        .default("success")
        .describe("The type of message for styling purposes"),
    }),
    execute: async ({ message, type = "success" }, { toolCallId: id }) => {
      const logger = getLogger(context);
      logger.info({
        msg: "simpleMessage called",
        message,
        type,
        toolCallId: id,
      });
      const { userId, traceId } = context;

      const spanId = generateSpanId();
      const startTime = Date.now();

      try {
        const result = {
          success: true,
          message,
          type,
          timestamp: new Date().toISOString(),
        };

        // Track message display
        await trackToolSpan(
          "simpleMessage",
          userId,
          traceId || generateSpanId(),
          { message, type },
          result,
          {
            spanId,
            latency: (Date.now() - startTime) / 1000,
            isError: false,
          },
        );

        await trackToolUsage(
          "simpleMessage",
          userId,
          context.projectId,
          { message, type },
          result,
        );

        return result;
      } catch (error) {
        logger.error({
          msg: "Failed to display message",
          error: error instanceof Error ? error.message : String(error),
        });
        const errorResult = {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          message,
          type,
        };

        await trackToolSpan(
          "simpleMessage",
          userId,
          traceId || generateSpanId(),
          { message, type },
          errorResult,
          {
            spanId,
            latency: (Date.now() - startTime) / 1000,
            isError: true,
          },
        );

        return errorResult;
      }
    },
  });

/**
 * Tool 16: manageTodos
 * Manage task tracking for complex operations
 */
export const manageTodos = (context: ToolsContext) =>
  tool({
    description:
      "Manage task tracking for complex operations. Create, update, or list todos to decompose large tasks into manageable steps. This helps track progress and ensures all requirements are met systematically.",
    inputSchema: z.object({
      action: z
        .enum(["create", "update", "list", "clear"])
        .describe("The action to perform on todos"),
      todos: z
        .array(
          z.object({
            id: z.string().describe("Unique identifier for the todo"),
            title: z.string().describe("Brief title of the task"),
            description: z
              .string()
              .optional()
              .describe("Detailed description of what needs to be done"),
            status: z
              .enum(["pending", "in_progress", "completed", "cancelled"])
              .describe("Current status of the task"),
            dependencies: z
              .array(z.string())
              .optional()
              .describe("IDs of tasks that must be completed first"),
          }),
        )
        .optional()
        .describe("Array of todos (required for create/update actions)"),
    }),
    execute: async ({ action, todos: inputTodos }, { toolCallId: id }) => {
      const logger = getLogger(context);
      logger.info({
        msg: "manageTodos called",
        action,
        toolCallId: id,
      });
      const { userId, traceId } = context;

      const spanId = generateSpanId();
      const startTime = Date.now();

      try {
        // Initialize todos array if not present
        if (!context.todos) {
          context.todos = [];
        }

        const result: any = { success: true, action };

        switch (action) {
          case "create":
            if (!inputTodos || inputTodos.length === 0) {
              throw new Error("Todos array is required for create action");
            }

            // Add new todos
            const newTodos = inputTodos.map((todo) => ({
              ...todo,
              createdAt: new Date(),
              completedAt: undefined,
            }));

            context.todos.push(...newTodos);

            result.todos = context.todos;
            result.message = `Created ${newTodos.length} new todo(s)`;
            logger.info({
              msg: "Created todos",
              count: newTodos.length,
              todos: newTodos.map((t) => ({
                id: t.id,
                title: t.title,
                status: t.status,
              })),
            });
            break;

          case "update":
            if (!inputTodos || inputTodos.length === 0) {
              throw new Error("Todos array is required for update action");
            }

            // Update existing todos
            let updatedCount = 0;
            for (const inputTodo of inputTodos) {
              const existingIndex = context.todos.findIndex(
                (t) => t.id === inputTodo.id,
              );
              if (existingIndex !== -1) {
                const wasCompleted =
                  context.todos[existingIndex].status === "completed";
                const isNowCompleted = inputTodo.status === "completed";

                context.todos[existingIndex] = {
                  ...context.todos[existingIndex],
                  ...inputTodo,
                  completedAt:
                    isNowCompleted && !wasCompleted
                      ? new Date()
                      : context.todos[existingIndex].completedAt,
                };
                updatedCount++;

                logger.info({
                  msg: "Updated todo",
                  todoId: inputTodo.id,
                  title: inputTodo.title,
                  status: inputTodo.status,
                });
              }
            }

            result.todos = context.todos;
            result.message = `Updated ${updatedCount} todo(s)`;
            break;

          case "list":
            result.todos = context.todos;
            result.summary = {
              total: context.todos.length,
              pending: context.todos.filter((t) => t.status === "pending")
                .length,
              in_progress: context.todos.filter(
                (t) => t.status === "in_progress",
              ).length,
              completed: context.todos.filter((t) => t.status === "completed")
                .length,
              cancelled: context.todos.filter((t) => t.status === "cancelled")
                .length,
            };
            result.message = `Retrieved ${context.todos.length} todo(s)`;
            logger.info({
              msg: "Listed todos",
              totalCount: context.todos.length,
              summary: result.summary,
            });
            break;

          case "clear":
            const clearedCount = context.todos.length;
            context.todos = [];
            result.todos = [];
            result.message = `Cleared ${clearedCount} todo(s)`;
            logger.info({
              msg: "Cleared all todos",
              clearedCount,
            });
            break;
        }

        // Track tool usage with PostHog
        await trackToolSpan(
          "manageTodos",
          userId,
          traceId || generateSpanId(),
          { action, todosCount: inputTodos?.length },
          result,
          {
            spanId,
            latency: (Date.now() - startTime) / 1000,
            isError: false,
          },
        );

        await trackToolUsage(
          "manageTodos",
          userId,
          context.projectId,
          { action, todosCount: inputTodos?.length },
          result,
        );

        return result;
      } catch (error) {
        logger.error({
          msg: "Failed to manage todos",
          error: error instanceof Error ? error.message : String(error),
        });
        const errorResult = {
          success: false,
          action,
          error: error instanceof Error ? error.message : String(error),
        };

        await trackToolSpan(
          "manageTodos",
          userId,
          traceId || generateSpanId(),
          { action },
          errorResult,
          {
            spanId,
            latency: (Date.now() - startTime) / 1000,
            isError: true,
            error: errorResult.error,
          },
        );

        return errorResult;
      }
    },
  });

/**
 * Tool 17: applyTheme
 * Apply a theme to the project
 */
export const applyTheme = (context: ToolsContext) =>
  tool({
    description: "Apply a theme to the project",
    inputSchema: z.object({
      theme: z.string().describe("The theme to apply to the project"),
    }),
    execute: async ({ theme }, { toolCallId: id }) => {
      const logger = getLogger(context);
      logger.info({
        msg: "applyTheme called",
        theme,
        toolCallId: id,
      });

      const spanId = generateSpanId();
      const startTime = Date.now();

      try {
        // Get sandbox
        const sandboxInfo = await getSandbox(context.projectId);
        if (!sandboxInfo || !sandboxInfo.sandbox) {
          throw new Error("Sandbox not found");
        }

        const themeAllowed = V2_THEME_KEYS.includes(theme);

        if (!themeAllowed) {
          const result = {
            success: false,
            error: `Theme ${theme} is not allowed. Allowed themes: ${V2_THEME_KEYS.join(", ")}`,
          };
          return result;
        }

        logger.info({ msg: "Applying theme", theme });

        // Note: Modal sandboxes don't support theme changes
        // Themes are set at template creation time and baked into the sandbox
        // This tool returns success but doesn't actually change the theme
        // To change themes, users need to create a new project with a different template

        logger.warn({
          msg: "Theme changes not supported for Modal sandboxes",
          theme,
        });

        const result = { success: true, theme };

        // Track tool usage with PostHog
        await trackToolSpan(
          "applyTheme",
          context.userId,
          context.traceId || generateSpanId(),
          { theme },
          result,
          {
            spanId,
            latency: (Date.now() - startTime) / 1000,
            isError: false,
          },
        );

        await trackToolUsage(
          "applyTheme",
          context.userId,
          context.projectId,
          { theme },
          result,
        );

        return result;
      } catch (error) {
        const errorResult = {
          error: error instanceof Error ? error.message : String(error),
        };

        // Track tool usage error with PostHog
        await trackToolSpan(
          "applyTheme",
          context.userId,
          context.traceId || generateSpanId(),
          { theme },
          errorResult,
          {
            spanId,
            latency: (Date.now() - startTime) / 1000,
            isError: true,
            error: errorResult.error,
          },
        );

        await trackToolUsage(
          "applyTheme",
          context.userId,
          context.projectId,
          { theme },
          errorResult,
        );

        throw error;
      }
    },
  });

/**
 * Tool 18: generateImage
 * Creates images from text prompts and saves them to the sandbox
 */
export const generateImage = (context: ToolsContext) =>
  tool({
    description:
      "Creates images from text prompts and saves them to the sandbox. Supports multiple images in one call. Include style descriptions in your prompts (e.g., 'watercolor style', 'anime art', 'realistic photography').",
    inputSchema: z.object({
      images: z
        .array(
          z.object({
            prompt: z
              .string()
              .describe(
                "Detailed description of the image to generate, including style (e.g., 'watercolor style landscape', 'anime character portrait', 'realistic product photo')",
              ),
            filename: z
              .string()
              .optional()
              .describe(
                "Custom filename (without extension). If not provided, auto-generates based on timestamp",
              ),
          }),
        )
        .describe(
          "Array of images to generate (supports multiple images in one call)",
        ),
    }),
    execute: async ({ images }, { toolCallId: id }) => {
      const logger = getLogger(context);
      logger.info({
        msg: "generateImage called",
        imageCount: images.length,
        toolCallId: id,
      });
      const { userId, projectId, traceId } = context;

      const spanId = generateSpanId();
      const startTime = Date.now();

      try {
        // Get sandbox
        const sandboxInfo = await getSandbox(context.projectId);
        if (!sandboxInfo || !sandboxInfo.sandbox) {
          throw new Error("Sandbox not found");
        }

        const sandbox = sandboxInfo.sandbox;

        if (!images || images.length === 0) {
          throw new Error("No images specified for generation");
        }

        // Ensure fragmentFiles and files are initialized
        if (!context.fragmentFiles) {
          context.fragmentFiles = new Map<string, string>();
        }
        if (!context.files) {
          context.files = new Map<string, { size: number; modified: number }>();
        }

        const generatedImages: Array<{
          path: string;
          filename: string;
          prompt: string;
          success: boolean;
          cost?: number;
          error?: string;
        }> = [];

        let totalImageCost = 0;

        // Ensure the images directory exists
        try {
          // Modal: Use executeCommand
          await modalExecuteCommand(
            context.sandboxId!,
            "mkdir -p /workspace/public/images",
          );
        } catch (error) {
          logger.warn({
            msg: "Could not create images directory",
            error: error instanceof Error ? error.message : String(error),
          });
        }

        // Generate all images in parallel using Promise.all
        const imagePromises = images.map(async (imageRequest, i) => {
          const timestamp = Date.now();

          // 🚨 CRITICAL BLOCK: Prevent overwriting protected metadata files
          if (imageRequest.filename) {
            const protectedFilenames = ["favicon", "share-image"];
            const baseFilename = imageRequest.filename
              .toLowerCase()
              .replace(/\.[^.]*$/, ""); // Remove extension if present
            if (protectedFilenames.includes(baseFilename)) {
              throw new Error(
                `🚨 CRITICAL BLOCK: Cannot generate image with filename "${imageRequest.filename}". The names "favicon" and "share-image" are reserved for user-uploaded metadata files configured through the publish settings. Please use a different filename for your generated image.`,
              );
            }
          }

          const filename =
            imageRequest.filename || `ai-generated-${timestamp}-${i}`;
          const filenameWithExt = `${filename}.png`;

          logger.info({
            msg: "Generating image",
            imageNumber: i + 1,
            totalImages: images.length,
            prompt: imageRequest.prompt,
          });

          try {
            // Make request to OpenRouter API using fetch
            const response = await fetch(
              "https://openrouter.ai/api/v1/chat/completions",
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: "google/gemini-2.5-flash-image-preview",
                  usage: {
                    include: true,
                  },
                  messages: [
                    {
                      role: "user",
                      content: imageRequest.prompt,
                    },
                  ],
                  modalities: ["image", "text"],
                }),
              },
            );

            if (!response.ok) {
              throw new Error(
                `OpenRouter API returned status ${response.status}: ${await response.text()}`,
              );
            }

            const data = (await response.json()) as {
              choices?: Array<{
                message?: {
                  images?: Array<{
                    image_url?: { url?: string };
                  }>;
                };
              }>;
              usage?: {
                prompt_tokens?: number;
                completion_tokens?: number;
                total_tokens?: number;
                cost?: number;
              };
            };

            // Extract image URL from response
            const imageUrl =
              data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;

            if (!imageUrl) {
              throw new Error("No image URL in response");
            }
            console.log("image metadata", data);
            // Capture cost from OpenRouter response
            const imageCost = data?.usage?.cost || 0;

            logger.info({
              msg: "Image generation cost captured",
              imageNumber: i + 1,
              costUSD: imageCost,
              promptTokens: data?.usage?.prompt_tokens,
              completionTokens: data?.usage?.completion_tokens,
            });

            // Download the image
            const imageResponse = await fetch(imageUrl);
            if (!imageResponse.ok) {
              throw new Error(
                `Failed to download image: ${imageResponse.status} ${imageResponse.statusText}`,
              );
            }

            const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
            const relativePath = `public/images/${filenameWithExt}`;

            // Save to Modal sandbox
            const modalSandbox = sandbox as any; // Modal Sandbox type
            const fullPath = `/workspace/${relativePath}`;

            // Ensure parent directory exists
            const dirPath = fullPath.substring(0, fullPath.lastIndexOf("/"));
            if (dirPath) {
              await modalSandbox.exec(["mkdir", "-p", dirPath]);
            }

            // Write binary data directly as Uint8Array
            const file = await modalSandbox.open(fullPath, "w");
            await file.write(new Uint8Array(imageBuffer));
            await file.close();

            // Track in context - images are binary, so we'll track metadata instead
            if (context.files) {
              context.files.set(relativePath, {
                size: imageBuffer.length,
                modified: Date.now(),
              });
            }

            // Store a placeholder in fragmentFiles to track that this file exists
            if (context.fragmentFiles) {
              context.fragmentFiles.set(
                relativePath,
                `[Binary image file: ${filenameWithExt}]`,
              );
            }

            // Sync to Media Library (R2 storage) with ai-generated tag
            let mediaLibraryUrl: string | undefined;
            try {
              const uploadService = new UploadService();
              const upload = await uploadService.uploadFromBuffer(
                imageBuffer,
                filenameWithExt,
                "image/png",
                userId,
                {
                  projectId,
                  tags: ["ai-generated"],
                  description: `AI-generated image: ${imageRequest.prompt.substring(0, 100)}${imageRequest.prompt.length > 100 ? "..." : ""}`,
                },
              );
              mediaLibraryUrl = upload.url;
              logger.info({
                msg: "Image synced to Media Library",
                uploadId: upload.id,
                url: upload.url,
                filename: filenameWithExt,
              });
            } catch (uploadError) {
              // Don't fail the image generation if media library sync fails
              logger.warn({
                msg: "Failed to sync image to Media Library",
                error:
                  uploadError instanceof Error
                    ? uploadError.message
                    : String(uploadError),
                filename: filenameWithExt,
              });
            }

            return {
              path: `/images/${filenameWithExt}`,
              filename: filenameWithExt,
              prompt: imageRequest.prompt,
              success: true,
              cost: imageCost,
              mediaLibraryUrl,
            };
          } catch (error) {
            logger.error({
              msg: "Failed to generate image",
              imageNumber: i + 1,
              error: error instanceof Error ? error.message : String(error),
            });
            return {
              path: "",
              filename: filenameWithExt,
              prompt: imageRequest.prompt,
              success: false,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        });

        // Wait for all images to complete
        const results = await Promise.all(imagePromises);
        generatedImages.push(...results);

        // Calculate total cost from all successful generations
        totalImageCost = generatedImages
          .filter((img) => img.success && img.cost)
          .reduce((sum, img) => sum + (img.cost || 0), 0);

        logger.info({
          msg: "Total image generation cost",
          totalCostUSD: totalImageCost,
          successfulImages: generatedImages.filter((img) => img.success).length,
        });

        // Update working fragment once after all images are generated
        const successCount = generatedImages.filter(
          (img) => img.success,
        ).length;
        if (successCount > 0) {
          await updateWorkingFragment(
            context,
            `generated ${successCount} AI image${successCount > 1 ? "s" : ""}`,
          );
        }

        const allSuccessful = generatedImages.every((img) => img.success);
        const result = {
          success: allSuccessful,
          images: generatedImages,
          totalRequested: images.length,
          totalGenerated: successCount,
          totalCostUSD: totalImageCost,
          message: allSuccessful
            ? `Successfully generated ${successCount} image${successCount > 1 ? "s" : ""}`
            : `Generated ${successCount}/${images.length} images (${images.length - successCount} failed`,
        };

        // Track tool usage with PostHog
        await trackToolSpan(
          "generateImage",
          userId,
          traceId || generateSpanId(),
          { imageCount: images.length },
          result,
          {
            spanId,
            latency: (Date.now() - startTime) / 1000,
            isError: !allSuccessful,
          },
        );

        await trackToolUsage(
          "generateImage",
          userId,
          projectId,
          { imageCount: images.length },
          result,
        );

        return result;
      } catch (error) {
        logger.error({
          msg: "Image generation failed",
          error: error instanceof Error ? error.message : String(error),
        });
        const errorResult = {
          success: false,
          images: [],
          totalRequested: images.length,
          totalGenerated: 0,
          error: error instanceof Error ? error.message : String(error),
          message: `Failed to generate images: ${error instanceof Error ? error.message : String(error)}`,
        };

        // Track tool usage error with PostHog
        await trackToolSpan(
          "generateImage",
          userId,
          traceId || generateSpanId(),
          { imageCount: images.length },
          errorResult,
          {
            spanId,
            latency: (Date.now() - startTime) / 1000,
            isError: true,
            error: errorResult.error,
          },
        );

        return errorResult;
      }
    },
  });

/**
 * Deploy to Shipper Cloud (Convex backend) - Human-in-the-Loop Tool
 *
 * This tool provisions a Convex backend for the project.
 * REQUIRES USER CONFIRMATION before executing.
 *
 * How it works (Anthropic-compatible HITL):
 * 1. AI calls this tool
 * 2. Execute function returns {status: "pending_confirmation", ...}
 * 3. Frontend sees this result and shows ShipperCloudConfirmation dialog
 * 4. User confirms/denies
 * 5. Frontend sends new message with confirmation
 * 6. AI calls this tool again with confirmed=true
 * 7. Execute function runs the actual deployment
 *
 * NOTE: Anthropic requires tool_result for every tool_use, so we can't use
 * the AI SDK's HITL pattern (no execute function). Instead, we return a
 * "pending_confirmation" result that the frontend interprets.
 */
export const deployToShipperCloud = (context: ToolsContext) =>
  tool({
    description: `Enable Shipper Cloud (Convex backend) for this project.

⚠️ REQUIRES USER CONFIRMATION - This tool asks the user to confirm before deploying.

🚫 NEVER CALL THIS TOOL ON THE FIRST USER MESSAGE! 🚫
- Always build the frontend UI FIRST with mock/placeholder data
- Show the user something tangible before offering backend infrastructure
- Only call this tool AFTER you have created the initial app and the user can see it working

This provisions a production-ready backend with:
- Real-time database with automatic sync
- Type-safe queries and mutations
- Convex Auth integration (email/password authentication)
- File storage capabilities
- Scheduled functions (cron jobs)

WHEN TO CALL THIS TOOL:
- ONLY after you have already built the frontend UI with mock data
- User explicitly asks to "connect a database" or "make it real"
- User wants to persist data after seeing the UI working
- You have shown the app working and now need real data persistence

WHEN NOT TO CALL THIS TOOL:
- On the first message (NEVER - build UI first!)
- When user describes an app idea (build the UI first instead)
- Before you have created any React components
- Before the user has seen a working preview

WORKFLOW:
1. Build the frontend UI with mock/placeholder data FIRST
2. Let user see and interact with the app
3. THEN call this tool when ready for real data persistence
4. Call this tool without confirmed=true → Returns "pending_confirmation" status
5. Wait for user to confirm in the UI
6. If user confirms, they will tell you to proceed
7. Call this tool again with confirmed=true to execute deployment
8. After deployment succeeds, call deployConvex to generate types

Do NOT:
- Call this tool on the user's first message
- Create convex/ directory or files before deployment succeeds
- Set up ConvexAuthProvider before deployment succeeds
- Skip the confirmation step`,
    inputSchema: z.object({
      projectName: z
        .string()
        .describe(
          "Name for the Shipper Cloud project (will be used as the Convex project name)",
        ),
      reason: z
        .string()
        .describe(
          "Brief explanation of why deployment is needed (shown to user in confirmation dialog)",
        ),
      confirmed: z
        .boolean()
        .optional()
        .describe(
          "Set to true ONLY after user has confirmed deployment in the UI. Do NOT set this on first call.",
        ),
    }),
    execute: async ({ projectName, reason, confirmed }) => {
      const { projectId, userId, logger } = context;

      // If not confirmed, return pending status for frontend to show confirmation dialog
      if (!confirmed) {
        logger?.info({
          msg: "Shipper Cloud deployment requested - awaiting user confirmation",
          projectId,
          projectName,
          reason,
        });

        return {
          status: "pending_confirmation",
          message: "Awaiting user confirmation to deploy to Shipper Cloud",
          projectName,
          reason,
          instructions:
            "The user will see a confirmation dialog. If they approve, tell me to proceed and I will call this tool again with confirmed=true.",
        };
      }

      // User has confirmed - execute the deployment
      logger?.info({
        msg: "User confirmed Shipper Cloud deployment - executing",
        projectId,
        projectName,
        reason,
      });

      try {
        const result = await executeShipperCloudDeploymentWithFiles(
          projectId,
          userId,
          projectName,
        );

        if (!result.success) {
          return {
            status: "error",
            success: false,
            error: result.error || "Failed to provision Shipper Cloud backend",
          };
        }

        return {
          status: "success",
          success: true,
          message: result.isExisting
            ? "Shipper Cloud deployment already exists. Convex Auth files have been set up."
            : "Successfully provisioned Shipper Cloud backend with Convex Auth!",
          deploymentUrl: result.deploymentUrl,
          siteUrl: result.siteUrl,
          deploymentName: result.deploymentName,
          isExisting: result.isExisting,
          filesCreated: result.filesCreated,
          packagesInstalled: result.packagesInstalled,
          packagesInstalledList: result.packagesInstalledList,
          envVarsSet: result.envVarsSet,
          authClientPath: result.authClientPath,
          nextSteps: [
            "⚠️ STOP! Your VERY NEXT action MUST be: call deployConvex tool",
            "The convex/_generated/api types DO NOT EXIST yet - you will get import errors if you create components now!",
            "1. IMMEDIATELY call deployConvex tool NOW (before creating ANY files)",
            "2. WAIT for deployConvex to succeed",
            "3. ONLY THEN: Update src/main.tsx to use ConvexAuthProvider (import from @convex-dev/auth/react)",
            "4. ONLY THEN: Create /signin and /signup route files with REAL forms using useAuthActions hook from @convex-dev/auth/react",
            "5. ⚠️ NEVER redirect unauth users from __root.tsx! Only redirect in PROTECTED routes",
            "6. Home page (/) should show landing page for unauth users, NOT redirect to signin!",
            "7. Use v.id('users') for userId fields that reference the auth users table",
          ],
          criticalWarning:
            "🚫 DO NOT create ANY React components yet! Call deployConvex FIRST!",
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger?.error({
          msg: "Shipper Cloud deployment failed",
          projectId,
          error: errorMessage,
        });

        return {
          status: "error",
          success: false,
          error: `Failed to deploy to Shipper Cloud: ${errorMessage}`,
        };
      }
    },
  });

/**
 * AI Provider configuration for enableAI tool
 * Uses Shipper AI Proxy - no user API keys needed!
 * All requests go through our proxy and are charged to user credits.
 *
 * Default models (cheap/fast) - used unless user explicitly requests otherwise:
 * - OpenAI: gpt-4.1-mini
 * - Anthropic: claude-3-5-haiku
 * - Google: gemini-2.0-flash-lite
 * - xAI: grok-2
 */
const AI_PROVIDER_DEFAULTS = {
  openai: {
    defaultModel: "gpt-4.1-mini",
    availableModels: ["gpt-4.1-mini", "gpt-4.1", "gpt-4o", "gpt-4o-mini"],
  },
  anthropic: {
    defaultModel: "claude-3-5-haiku",
    availableModels: ["claude-3-5-haiku", "claude-3-5-sonnet", "claude-3-opus"],
  },
  google: {
    defaultModel: "gemini-2.0-flash-lite",
    availableModels: [
      "gemini-2.0-flash-lite",
      "gemini-2.0-flash",
      "gemini-1.5-pro",
    ],
  },
  xai: {
    defaultModel: "grok-2",
    availableModels: ["grok-2", "grok-beta"],
  },
  mistral: {
    defaultModel: "mistral-large",
    availableModels: ["mistral-large", "mistral-medium"],
  },
} as const;

type AIProvider = keyof typeof AI_PROVIDER_DEFAULTS;

/**
 * Generate a secure AI proxy token for the project
 */
function generateAiProxyToken(): string {
  const crypto = require("crypto");
  return `shipper_ai_${crypto.randomBytes(32).toString("hex")}`;
}

/**
 * Generate the updated convex.config.ts with agent component
 * Note: Native Convex Auth doesn't require a config registration - only agent needs it
 */
function generateConvexConfigWithAgent(): string {
  return `/**
 * Convex App Configuration
 * Registers the Agent component for AI capabilities
 * @see https://docs.convex.dev/agents
 */
import { defineApp } from "convex/server";
import agent from "@convex-dev/agent/convex.config";

const app = defineApp();
app.use(agent);

export default app;
`;
}

/**
 * Enable AI capabilities in the user's app
 *
 * NEW: Uses Shipper AI Proxy - NO API KEY NEEDED!
 * - User's app calls our proxy endpoint
 * - We use our OpenRouter key (never exposed to users)
 * - Usage is charged to user's Shipper credits
 */
export const enableAI = (context: ToolsContext) =>
  tool({
    description: `Enable AI capabilities in this project using Shipper AI.

🚀 NO API KEY NEEDED! AI usage is automatically charged to user's Shipper Cloud credits.

The Shipper AI proxy is OpenAI-compatible and supports ALL AI features:
- Chat completions (conversations, assistants)
- Vision (analyze images)
- Embeddings (semantic search, RAG)
- Function calling (AI agents with tools)
- Image generation
- 100+ models via OpenRouter (GPT-4, Claude, Gemini, Grok, Llama, Mistral, etc.)

PREREQUISITES:
- Shipper Cloud must be deployed first (call deployToShipperCloud)

WHAT THIS TOOL DOES:
1. Generates a secure project AI token
2. Sets SHIPPER_AI_TOKEN and SHIPPER_AI_URL in Convex environment

AFTER THIS TOOL SUCCEEDS:
- Create convex/ai.ts with "use node"; at the top
- Create Convex actions that call the Shipper AI proxy using fetch()
- Use SHIPPER_AI_URL env var as base URL
- Use X-Shipper-Token header with SHIPPER_AI_TOKEN
- Call deployConvex to activate the AI actions`,
    inputSchema: z.object({
      provider: z
        .enum(["openai", "anthropic", "google", "xai", "mistral"])
        .optional()
        .default("openai")
        .describe("AI provider to use. Defaults to OpenAI (gpt-4.1-mini)."),
      model: z
        .string()
        .optional()
        .describe(
          "Specific model to use. If not provided, uses the cheap default for the provider.",
        ),
    }),
    execute: async ({ provider = "openai", model }) => {
      const { projectId, userId, logger } = context;

      // Get the default model for the provider if not specified
      const providerConfig = AI_PROVIDER_DEFAULTS[provider as AIProvider];
      const selectedModel =
        model || providerConfig?.defaultModel || "gpt-4.1-mini";

      logger?.info({
        msg: "Enabling AI capabilities (Shipper AI Proxy)",
        projectId,
        provider,
        model: selectedModel,
      });

      try {
        // Check if Shipper Cloud is deployed
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          include: { convexDeployment: true },
        });

        if (!project?.convexDeployment) {
          return {
            success: false,
            action_required: "deploy_shipper_cloud",
            error: "Shipper Cloud is not deployed yet.",
            next_step:
              "Call deployToShipperCloud tool first, wait for user confirmation, then call enableAI again with the SAME API key.",
            hint: "You already have the user's API key - save it and reuse after deployment completes.",
          };
        }

        // Get sandbox
        const sandboxInfo = await getSandbox(projectId);
        if (!sandboxInfo) {
          return {
            success: false,
            error: "No sandbox found for this project",
          };
        }

        // Step 1: Generate or get existing AI proxy token
        let aiToken = project.aiProxyToken;
        if (!aiToken) {
          aiToken = generateAiProxyToken();
          await prisma.project.update({
            where: { id: projectId },
            data: {
              aiProxyToken: aiToken,
              aiProxyTokenCreatedAt: new Date(),
              aiEnabled: true,
            },
          });
          logger?.info({ msg: "Generated new AI proxy token", projectId });
        } else {
          // Ensure aiEnabled is true
          await prisma.project.update({
            where: { id: projectId },
            data: { aiEnabled: true },
          });
        }

        // Step 2: Set the Shipper AI token in Convex environment
        logger?.info({ msg: "Setting SHIPPER_AI_TOKEN in Convex env" });
        const apiUrl = process.env.API_URL || "https://api.shipper.so";

        // Set both the token and the API URL
        await modalExecuteCommand(
          sandboxInfo.sandboxId,
          `bunx convex env set SHIPPER_AI_TOKEN "${aiToken}"`,
          { timeoutMs: 30000 },
        );
        await modalExecuteCommand(
          sandboxInfo.sandboxId,
          `bunx convex env set SHIPPER_AI_URL "${apiUrl}/api/v1/ai"`,
          { timeoutMs: 30000 },
        );

        return {
          success: true,
          provider,
          model: selectedModel,
          aiEnabled: true,
          message:
            "AI is now enabled! Environment variables SHIPPER_AI_TOKEN and SHIPPER_AI_URL are set.",
          proxyInfo: {
            baseUrl: "SHIPPER_AI_URL environment variable",
            authHeader: "X-Shipper-Token: SHIPPER_AI_TOKEN",
            endpoints: [
              "POST /chat/completions - Chat, vision, function calling",
              "POST /embeddings - Create embeddings for RAG/search",
              "POST /images/generations - Generate images",
              "GET /models - List available models",
            ],
          },
          nextSteps: [
            "Create convex/ai.ts with 'use node'; at the top",
            "Create Convex actions that call the Shipper AI proxy",
            "Use fetch() with SHIPPER_AI_URL and X-Shipper-Token header",
            "Call deployConvex to activate the AI actions",
          ],
          exampleAction: `
"use node";
import { action } from "./_generated/server";
import { v } from "convex/values";

const SHIPPER_AI_URL = process.env.SHIPPER_AI_URL!;
const SHIPPER_TOKEN = process.env.SHIPPER_AI_TOKEN!;

export const chat = action({
  args: {
    messages: v.array(v.object({
      role: v.union(v.literal("system"), v.literal("user"), v.literal("assistant")),
      content: v.string(),
    })),
  },
  handler: async (ctx, { messages }) => {
    const response = await fetch(\`\${SHIPPER_AI_URL}/chat/completions\`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shipper-Token": SHIPPER_TOKEN,
      },
      body: JSON.stringify({
        model: "${selectedModel}",
        messages,
      }),
    });
    
    if (!response.ok) throw new Error(\`AI request failed: \${response.status}\`);
    const data = await response.json();
    return { content: data.choices?.[0]?.message?.content || "" };
  },
});`,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger?.error({
          msg: "Failed to enable AI",
          projectId,
          error: errorMessage,
        });

        return {
          success: false,
          error: `Failed to enable AI: ${errorMessage}`,
        };
      }
    },
  });

/**
 * Use a personal connector that the user has already connected in Workspace Settings.
 * Automatically injects the API key into Convex environment variables.
 *
 * This is the PREFERRED method for services that support personal connectors.
 * Falls back to requestApiKeys only if the service is not connected.
 */
export const useConnectedService = (context: ToolsContext) =>
  tool({
    description: `Use a service the user has already connected in their Workspace Settings.

🚀 WHEN TO USE:
- Check CONNECTED_SERVICES in the system context FIRST
- If the service is listed, call this tool to activate it for the project
- This is PREFERRED over requestApiKeys for connected services like ElevenLabs

✅ SUPPORTED SERVICES:
- elevenlabs: Text-to-speech and voice AI (injects ELEVENLABS_API_KEY)

WHAT THIS DOES:
1. Retrieves the user's existing API key from secure storage
2. Injects it into the project's Convex environment variables
3. Returns metadata (subscription tier, limits, etc.)

PREREQUISITES:
- Shipper Cloud must be deployed first (call deployToShipperCloud)
- The service must be connected in Workspace Settings

AFTER SUCCESS:
- Create Convex actions that use process.env.ELEVENLABS_API_KEY
- The key is already set - no user interaction needed!

IF NOT CONNECTED:
- Returns error with connect instructions
- Fall back to requestApiKeys if user prefers manual entry`,
    inputSchema: z.object({
      service: z.enum(["elevenlabs"]).describe("The connected service to use"),
      envVarName: z
        .string()
        .optional()
        .describe(
          "Custom env var name (default: SERVICE_API_KEY, e.g., ELEVENLABS_API_KEY)",
        ),
    }),
    execute: async ({ service, envVarName }) => {
      const { projectId, userId, logger } = context;

      logger?.info(
        { service, projectId },
        "Attempting to use connected service",
      );

      // Get the connected service access token
      const accessToken = await connectorRegistry.getPersonalAccessToken(
        userId,
        service.toUpperCase() as any,
      );

      if (!accessToken) {
        logger?.warn({ service, userId }, "Service not connected");
        return {
          success: false,
          error: `${service} is not connected. The user needs to connect it in Workspace Settings first.`,
          action_required: "connect_service",
          fallback: `Use requestApiKeys({ provider: "${service}", envVarName: "${envVarName || service.toUpperCase() + "_API_KEY"}" }) as fallback`,
          instructions:
            "Ask the user to either: 1) Connect the service in Workspace Settings, or 2) Paste their API key directly via requestApiKeys",
        };
      }

      // Get project's Convex deployment with full details
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
          convexDeployment: {
            select: {
              convexDeploymentUrl: true,
              deployKeyEncrypted: true,
            },
          },
        },
      });

      if (
        !project?.convexDeployment?.convexDeploymentUrl ||
        !project?.convexDeployment?.deployKeyEncrypted
      ) {
        logger?.warn({ projectId }, "Shipper Cloud not deployed");
        return {
          success: false,
          error:
            "Shipper Cloud must be deployed first to use connected services.",
          action_required: "deploy_shipper_cloud",
          next_step:
            "Call deployToShipperCloud tool first, then retry useConnectedService",
        };
      }

      // Inject API key into Convex env
      const finalEnvVarName = envVarName || `${service.toUpperCase()}_API_KEY`;

      try {
        const deployKey = decryptDeployKey(
          project.convexDeployment.deployKeyEncrypted,
        );
        const convexApi = new ConvexDeploymentAPI(
          project.convexDeployment.convexDeploymentUrl,
          deployKey,
        );

        const result = await convexApi.setEnvironmentVariables({
          [finalEnvVarName]: accessToken,
        });

        if (!result.success) {
          throw new Error(result.error || "Failed to set environment variable");
        }

        logger?.info(
          { service, projectId, envVarName: finalEnvVarName },
          "Connected service activated",
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger?.error(
          { service, error: errorMessage },
          "Failed to set env var",
        );
        return {
          success: false,
          error: `Failed to inject ${service} API key: ${errorMessage}`,
        };
      }

      // Get connection metadata for context
      const connection = await connectorRegistry.getUserPersonalConnection(
        userId,
        service.toUpperCase() as any,
      );

      return {
        success: true,
        service,
        envVarName: finalEnvVarName,
        envVarSet: true,
        metadata: connection?.metadata,
        message: `${service} API key has been set as ${finalEnvVarName} in Convex environment. You can now create Convex actions that use process.env.${finalEnvVarName}`,
        next_steps: [
          `Create convex/${service}.ts with "use node"; at the top`,
          `Create Convex actions that call the ${service} API using process.env.${finalEnvVarName}`,
          "Call deployConvex() to activate the new actions",
        ],
      };
    },
  });

/**
 * Request API keys from the user via a UI input card
 *
 * This tool triggers a Human-in-the-Loop flow where the frontend displays
 * a secure input card for the user to enter their API keys.
 *
 * Supported providers: stripe, openai, anthropic, google, etc.
 */
export const requestApiKeys = (context: ToolsContext) =>
  tool({
    description: `Request API keys from the user via a secure input card in the chat.

This tool triggers a UI card where users can securely enter their API keys.
The keys are AUTOMATICALLY SAVED to Convex environment variables when the user submits.

⚠️ PREREQUISITE: This tool will FAIL if Shipper Cloud is not deployed!
For stripe/openai/anthropic/google providers, you MUST call deployToShipperCloud first AND WAIT for user confirmation.
🚫 NEVER call this tool at the same time as deployToShipperCloud! Wait for deployment to complete first.

SUPPORTED PROVIDERS:
- stripe: Requests Secret Key only (publishable key NOT needed for redirect flow)
- openai: Requests OpenAI API key
- anthropic: Requests Anthropic API key
- google: Requests Google AI API key
- custom: Use custom fields configuration

FLOW:
1. Call this tool with provider, fields, and envVarName
2. A secure input card appears in the chat
3. User enters their key and submits
4. Key is AUTOMATICALLY saved to Convex env var you specified
5. You receive confirmation: { confirmed: true, keys: {...}, keysSetInConvex: true, envVarsSet: ["RESEND_API_KEY"] }
6. Create your Convex action that uses process.env.RESEND_API_KEY (or whatever you specified)

EXAMPLES:
- Email (Resend): 
  requestApiKeys({ 
    provider: "resend", 
    envVarName: "RESEND_API_KEY",
    fields: [{ key: "apiKey", label: "Resend API Key" }],
    helpLink: { url: "https://resend.com/api-keys", text: "Get Resend API Key" }
  })

- Email (SendGrid): 
  requestApiKeys({ 
    provider: "sendgrid", 
    envVarName: "SENDGRID_API_KEY",
    fields: [{ key: "apiKey", label: "SendGrid API Key" }],
    helpLink: { url: "https://app.sendgrid.com/settings/api_keys", text: "Get SendGrid API Key" }
  })


- SMS (Twilio - multiple fields):
  requestApiKeys({ 
    provider: "twilio",
    fields: [
      { key: "accountSid", label: "Account SID", envVarName: "TWILIO_ACCOUNT_SID" },
      { key: "authToken", label: "Auth Token", envVarName: "TWILIO_AUTH_TOKEN" }
    ],
    helpLink: { url: "https://console.twilio.com", text: "Get Twilio Credentials" }
  })

FOR STRIPE - COMPLETE FLOW (FOLLOW THIS ORDER!):
1. deployToShipperCloud → WAIT for user confirmation
2. requestApiKeys({ provider: "stripe" }) → get secretKey
3. stripeCreateProductAndPrice({ stripeSecretKey, name, priceInCents, ... }) → user approves → get priceId
4. setupStripePayments({ stripeSecretKey, priceId, paymentType }) → saves key + creates files
5. deployConvex() → activates Stripe routes
6. Done! <CheckoutButton priceId="..." /> is ready to use.`,

    inputSchema: z.object({
      provider: z
        .string()
        .describe(
          "The provider/service name (e.g., 'resend', 'stripe', 'openai', 'sendgrid', 'twilio')",
        ),
      envVarName: z
        .string()
        .optional()
        .describe(
          "The Convex environment variable name to save the key as (e.g., 'RESEND_API_KEY'). Required for single-field providers.",
        ),
      title: z
        .string()
        .optional()
        .describe(
          "Custom title for the input card (defaults to 'Enter API Keys')",
        ),
      fields: z
        .array(
          z.object({
            key: z
              .string()
              .describe(
                "Unique identifier for this field (e.g., 'apiKey', 'accountSid')",
              ),
            label: z
              .string()
              .describe("Label shown in the input (e.g., 'Resend API Key')"),
            pattern: z
              .string()
              .optional()
              .describe("Regex pattern for validation"),
            errorMessage: z
              .string()
              .optional()
              .describe("Error message when validation fails"),
            envVarName: z
              .string()
              .optional()
              .describe(
                "Convex env var name for this specific field (for multi-field providers like Twilio)",
              ),
          }),
        )
        .describe(
          "REQUIRED: Array of input fields to display. Always specify at least one field with key and label.",
        ),
      helpLink: z
        .object({
          url: z.string(),
          text: z.string(),
        })
        .optional()
        .describe("Link to help users get their API keys"),
      helpTooltip: z
        .string()
        .optional()
        .describe("Tooltip text explaining what keys are needed"),
    }),
    execute: async ({
      provider,
      envVarName,
      title,
      fields,
      helpLink,
      helpTooltip,
    }) => {
      const { projectId, logger } = context;

      logger?.info({
        msg: "Requesting API keys from user",
        provider,
      });

      // Check if Shipper Cloud is deployed for providers that need it
      const providersRequiringBackend = [
        "stripe",
        "openai",
        "anthropic",
        "google",
      ];

      let project = null;
      if (providersRequiringBackend.includes(provider)) {
        project = await prisma.project.findUnique({
          where: { id: projectId },
          include: { convexDeployment: true },
        });

        if (!project?.convexDeployment) {
          return {
            success: false,
            action_required: "deploy_shipper_cloud",
            error: `${provider} integration requires Shipper Cloud backend.`,
            next_step:
              "Call deployToShipperCloud tool first and wait for user confirmation. THEN call requestApiKeys to get the keys.",
          };
        }
      }

      // For Stripe, generate a pre-filled URL with the project name and all required permissions
      let finalHelpLink = helpLink;
      if (provider === "stripe" && !helpLink) {
        // Get project name for the Stripe key name
        if (!project) {
          project = await prisma.project.findUnique({
            where: { id: projectId },
          });
        }
        const appName = encodeURIComponent(project?.name || "MyApp");
        const stripePermissions = [
          "rak_product_write",
          "rak_product_read",
          "rak_price_write",
          "rak_price_read",
          "rak_plan_write", // Legacy subscription plans
          "rak_plan_read",
          "rak_payment_link_write",
          "rak_payment_link_read",
          "rak_payment_intent_write",
          "rak_payment_intent_read",
          "rak_customer_write",
          "rak_customer_read",
          "rak_subscription_write",
          "rak_subscription_read",
          "rak_invoice_read",
          "rak_invoice_item_write",
          "rak_invoice_item_read",
          "rak_balance_read",
          "rak_refund_write",
          "rak_refund_read",
          "rak_coupon_write",
          "rak_coupon_read",
          "rak_checkout_session_write",
          "rak_checkout_session_read",
        ];
        const permissionsQuery = stripePermissions
          .map((p) => `permissions%5B%5D=${p}`)
          .join("&");
        finalHelpLink = {
          url: `https://dashboard.stripe.com/apikeys/create?name=${appName}&${permissionsQuery}`,
          text: "Create Stripe Key (1-click)",
        };
      }

      // Return pending status - frontend will show the input card
      // The actual keys will be returned via the tool result when user submits
      // Include envVarName so chat.ts knows what env var to save the key to
      return {
        status: "pending_api_keys",
        provider,
        envVarName,
        title,
        fields,
        helpLink: finalHelpLink,
        helpTooltip,
        message: `Waiting for user to enter ${provider} API keys...`,
      };
    },
  });

// ============================================================================
// PLANNING QUESTIONS HITL TOOL
// ============================================================================
// Human-in-the-loop tool for gathering user requirements before building.
// Shows interactive questions inline in chat for the user to answer.

export const ASK_CLARIFYING_QUESTIONS_TOOL_NAME = "askClarifyingQuestions";

/**
 * Ask clarifying questions to gather project requirements (HITL)
 *
 * This tool generates and presents clarifying questions to the user inline in the chat.
 * The user can select from predefined options or provide custom answers.
 *
 * How it works (Anthropic-compatible HITL):
 * 1. AI calls this tool with the user's initial prompt
 * 2. Execute function generates questions and returns {status: "pending_questions", ...}
 * 3. Frontend sees this result and shows PlanningQuestionsCard inline
 * 4. User answers the questions
 * 5. Frontend sends answers via addToolResult
 * 6. AI receives answers and can then proceed with building
 */
export const askClarifyingQuestions = (context: ToolsContext) =>
  tool({
    description: `Generate 3-5 clarifying questions to understand the user's project requirements.

CALL THIS TOOL EXACTLY ONCE PER CONVERSATION. Never call it again.

After calling this tool:
- Output NOTHING else - just call the tool and stop
- Wait for user to answer in the UI

When you receive the tool result back, it will contain pre-processed requirements:
{"processed": true, "refinedPrompt": "...", "summary": "...", "keyFeatures": [...], ...}

Use this refined information to immediately write a detailed implementation PLAN.
DO NOT ask more questions - the requirements have been processed and are ready.`,
    inputSchema: z.object({
      prompt: z
        .string()
        .describe("The user's original project description or request"),
      context: z
        .string()
        .optional()
        .describe("Additional context about the conversation or project"),
    }),
    execute: async ({ prompt, context: additionalContext }) => {
      const { projectId, userId, logger, traceId } = context;

      logger?.info({
        msg: "Planning HITL: Generating clarifying questions",
        projectId,
        promptLength: prompt.length,
      });

      try {
        // Generate questions using the planning questions service
        const result = await generatePlanningQuestions(prompt, userId, traceId);

        logger?.info({
          msg: "Planning HITL: Questions generated",
          projectId,
          sessionId: result.sessionId,
          questionCount: result.questions.length,
        });

        // Return pending status - frontend will show the questions card
        // IMPORTANT: The instructions field tells the AI to STOP and wait
        return {
          status: "pending_user_input",
          toolName: ASK_CLARIFYING_QUESTIONS_TOOL_NAME,
          sessionId: result.sessionId,
          projectSummary: result.projectSummary,
          questions: result.questions,
          originalPrompt: prompt,
          instructions:
            "STOP HERE. Do not output anything else. The user is now answering the questions in the UI. You will receive their answers in a new message. Do not generate a plan yet - wait for the answers first.",
        };
      } catch (error) {
        logger?.error({
          msg: "Planning HITL: Error generating questions",
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });

        // Return error but still allow the conversation to continue
        return {
          status: "error",
          error:
            "Failed to generate clarifying questions. Proceeding with original prompt.",
          originalPrompt: prompt,
        };
      }
    },
  });

/**
 * Process the user's answers to planning questions and generate refined prompt
 * This is called internally when the user submits their answers
 */
export async function processPlanningAnswers(
  originalPrompt: string,
  projectSummary: string,
  questions: PlanningQuestion[],
  answers: PlanningAnswer[],
  userId?: string,
  traceId?: string,
): Promise<{
  refinedPrompt: string;
  summary: string;
  keyFeatures: string[];
  targetAudience?: string;
  designPreferences?: string;
}> {
  return refinePlanningPrompt(
    originalPrompt,
    projectSummary,
    questions,
    answers,
    userId,
    traceId,
  );
}

/**
 * Setup Stripe payments with automatic code generation
 *
 * This is the RECOMMENDED tool for adding payments. It:
 * 1. Validates Stripe keys
 * 2. Optionally creates products/prices using Stripe toolkit
 * 3. Generates correct convex/stripe.ts code
 * 4. Generates checkout UI code
 * 5. Deploys everything
 *
 * The AI just needs to specify what kind of payments the user wants.
 */
export const setupStripePayments = (context: ToolsContext) =>
  tool({
    description: `Setup Stripe payments with code generation. REQUIRES priceId from stripeCreateProductAndPrice HITL tool.

⚠️ PREREQUISITES (IN ORDER):
1. deployToShipperCloud → wait for confirmation
2. requestApiKeys({ provider: "stripe" }) → get secret key
3. stripeCreateProductAndPrice({ stripeSecretKey, name, priceInCents, ... }) → user approves → get priceId
4. THIS TOOL: setupStripePayments({ stripeSecretKey, priceId, ... }) → creates files
5. deployConvex() → REQUIRED to activate routes!

WHAT THIS TOOL DOES:
- Validates priceId format (must start with price_)
- Installs stripe package
- Sets STRIPE_SECRET_KEY in Convex env
- Generates convex/stripe.ts, convex/http.ts, convex/stripeWebhook.ts
- Generates CheckoutButton component and success page

⚠️ This tool does NOT create Stripe products - use stripeCreateProductAndPrice HITL tool first!`,
    inputSchema: z.object({
      stripeSecretKey: z
        .string()
        .describe("User's Stripe Secret Key (sk_test_* or sk_live_*)"),
      priceId: z
        .string()
        .describe(
          "The Stripe price ID (format: price_xxx). Get this from stripeCreateProductAndPrice HITL tool.",
        ),
      paymentType: z
        .enum(["one_time", "subscription"])
        .describe("Type of payment: one_time or subscription"),
      successRoute: z
        .string()
        .default("/checkout/success")
        .describe("Route to redirect after successful payment"),
      cancelRoute: z
        .string()
        .default("/")
        .describe("Route to redirect if payment is cancelled"),
    }),
    execute: async ({
      stripeSecretKey,
      priceId,
      paymentType,
      successRoute,
      cancelRoute,
    }) => {
      const { projectId, logger } = context;

      logger?.info({
        msg: "Setting up Stripe payments",
        projectId,
        paymentType,
        priceId,
      });

      try {
        // Step 1: Validate priceId format
        if (!priceId || !priceId.startsWith("price_")) {
          return {
            success: false,
            error: "Invalid priceId. Must start with 'price_'",
            hint: "Call stripeCreateProductAndPrice HITL tool first to create a product and get the priceId",
          };
        }

        // Step 2: Validate secret key (only key needed for redirect flow)
        const keyValidation = await validateStripeKey(stripeSecretKey);
        if (!keyValidation.valid) {
          return {
            success: false,
            error: keyValidation.error || "Invalid Stripe secret key",
          };
        }

        // Step 3: Check Shipper Cloud is deployed
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          include: { convexDeployment: true },
        });

        if (!project?.convexDeployment) {
          return {
            success: false,
            action_required: "deploy_shipper_cloud",
            error: "Shipper Cloud must be deployed first",
            next_step:
              "Call deployToShipperCloud, wait for confirmation, then call setupStripePayments again",
          };
        }

        // Step 4: Get sandbox
        const sandboxInfo = await getSandbox(projectId);
        if (!sandboxInfo) {
          return {
            success: false,
            error: "No sandbox found for this project",
          };
        }

        // Note: Product/price should already be created via stripeCreateProductAndPrice HITL tool
        // This tool just sets up the code and env vars
        // Step 5: Install Stripe package (only server-side SDK needed for redirect flow)
        logger?.info({ msg: "Installing Stripe package" });
        const installResult = await modalExecuteCommand(
          sandboxInfo.sandboxId,
          "bun add stripe",
          { timeoutMs: 60000 },
        );

        if (installResult.exitCode !== 0) {
          logger?.warn({
            msg: "Package installation had issues",
            stderr: installResult.stderr,
          });
        }

        // Step 6: Set environment variables
        logger?.info({ msg: "Setting Stripe environment variables" });

        // Set secret key in Convex env using the API directly (more reliable than CLI)
        // This is the same pattern used for JWT keys in shipper-cloud-hitl.ts
        let secretKeySet = false;
        try {
          const deployKey = decryptDeployKey(
            project.convexDeployment!.deployKeyEncrypted,
          );
          const deploymentApi = new ConvexDeploymentAPI(
            project.convexDeployment!.convexDeploymentUrl,
            deployKey,
          );

          const envResult = await deploymentApi.setEnvironmentVariables({
            STRIPE_SECRET_KEY: stripeSecretKey,
          });

          secretKeySet = envResult.success;
          if (envResult.success) {
            logger?.info({ msg: "STRIPE_SECRET_KEY set via Convex API" });
          } else {
            logger?.warn({
              msg: "Failed to set STRIPE_SECRET_KEY via Convex API",
              error: envResult.error,
            });
          }
        } catch (envError) {
          logger?.warn({
            msg: "Failed to set STRIPE_SECRET_KEY via Convex API",
            error:
              envError instanceof Error ? envError.message : String(envError),
          });
        }

        // Note: Publishable key is NOT needed for redirect flow
        // It's only needed for client-side Stripe.js / Elements

        // Check if env var setting failed
        if (!secretKeySet) {
          logger?.error({
            msg: "STRIPE_SECRET_KEY was NOT set - Stripe actions will fail!",
            projectId,
          });
          return {
            success: false,
            error:
              "Failed to set STRIPE_SECRET_KEY environment variable. Please try again.",
          };
        }

        // Step 7: Ensure convex directory exists and generate files
        // Same pattern as shipper-cloud-hitl.ts
        await modalExecuteCommand(
          sandboxInfo.sandboxId,
          "mkdir -p convex src/components src/routes/checkout",
        );

        logger?.info({ msg: "Generating Stripe action code" });

        const stripeMode =
          paymentType === "subscription" ? "subscription" : "payment";

        const stripeActionCode = generateStripeActionCode({
          featureType: "checkout_session",
          mode: stripeMode,
        });

        await modalWriteFile(
          sandboxInfo.sandboxId,
          "convex/stripe.ts",
          stripeActionCode,
        );

        if (context.fragmentFiles) {
          context.fragmentFiles.set("convex/stripe.ts", stripeActionCode);
        }

        // Step 8: Generate and write convex/http.ts with Stripe checkout route
        logger?.info({ msg: "Generating Stripe HTTP routes" });

        // Success URL uses window.location.origin (set at runtime in the generated code)
        // We'll use a placeholder that gets replaced with the actual app URL
        const stripeHttpCode = generateStripeHttpCode({
          mode: stripeMode,
          successUrl: successRoute, // Will be relative path like /checkout/success
          cancelUrl: cancelRoute || "/",
        });

        await modalWriteFile(
          sandboxInfo.sandboxId,
          "convex/http.ts",
          stripeHttpCode,
        );

        if (context.fragmentFiles) {
          context.fragmentFiles.set("convex/http.ts", stripeHttpCode);
        }

        // Step 8b: Generate webhook mutation handlers
        logger?.info({ msg: "Generating webhook mutation handlers" });

        const webhookMutationsCode = generateStripeWebhookMutations();

        await modalWriteFile(
          sandboxInfo.sandboxId,
          "convex/stripeWebhook.ts",
          webhookMutationsCode,
        );

        if (context.fragmentFiles) {
          context.fragmentFiles.set(
            "convex/stripeWebhook.ts",
            webhookMutationsCode,
          );
        }

        // Step 9: Generate checkout button component
        logger?.info({ msg: "Generating checkout button component" });

        const checkoutButtonCode = generateCheckoutUICode();

        // Directory already created in Step 7
        await modalWriteFile(
          sandboxInfo.sandboxId,
          "src/components/CheckoutButton.tsx",
          checkoutButtonCode,
        );

        if (context.fragmentFiles) {
          context.fragmentFiles.set(
            "src/components/CheckoutButton.tsx",
            checkoutButtonCode,
          );
        }

        // Step 10: Generate and write success page
        logger?.info({ msg: "Generating success page" });

        // Directory already created in Step 7
        const successCode = generateSuccessUICode({
          returnRoute: cancelRoute || "/",
        });

        // Write the success page file
        await modalWriteFile(
          sandboxInfo.sandboxId,
          "src/routes/checkout/success.tsx",
          successCode,
        );

        // 🛡️ ROUTE FILE PROTECTION: TanStack Router race condition fix
        // Same pattern as createOrEditFiles - wait, verify, re-write if corrupted
        await new Promise((resolve) => setTimeout(resolve, 300));

        try {
          const verifyResult = await modalExecuteCommand(
            sandboxInfo.sandboxId,
            "cat src/routes/checkout/success.tsx",
            { timeoutMs: 5000 },
          );
          const verifyContent = verifyResult.stdout || "";
          const isCorrupted =
            verifyContent.includes('return <div>Hello "') ||
            verifyContent.includes("return <div>Hello '/") ||
            (verifyContent.includes('Hello "/') &&
              verifyContent.length < successCode.length * 0.5);

          if (isCorrupted) {
            logger?.warn({
              msg: "🔄 Route file corrupted by TanStack Router plugin, re-writing",
              path: "src/routes/checkout/success.tsx",
            });
            await modalWriteFile(
              sandboxInfo.sandboxId,
              "src/routes/checkout/success.tsx",
              successCode,
            );
            await new Promise((resolve) => setTimeout(resolve, 300));
          }
        } catch (verifyError) {
          logger?.warn({
            msg: "Could not verify route file",
            error:
              verifyError instanceof Error
                ? verifyError.message
                : String(verifyError),
          });
        }

        if (context.fragmentFiles) {
          context.fragmentFiles.set(
            "src/routes/checkout/success.tsx",
            successCode,
          );
        }

        // Note: Deploy is NOT done here - AI should call deployConvex tool after this
        // This keeps setupStripePayments focused on file generation

        const isTestMode = stripeSecretKey.startsWith("sk_test_");

        return {
          success: true,
          paymentType,
          priceId,
          mode: isTestMode ? "test" : "live",
          filesCreated: [
            "convex/stripe.ts",
            "convex/http.ts",
            "convex/stripeWebhook.ts",
            "src/components/CheckoutButton.tsx",
            "src/routes/checkout/success.tsx",
          ],
          envVarsSet: ["STRIPE_SECRET_KEY (Convex env)"],
          important:
            "⚠️ You MUST call deployConvex now to activate the Stripe routes!",
          checkoutButtonUsage: `import { CheckoutButton } from "./components/CheckoutButton";\n\n<CheckoutButton priceId="${priceId}" label="${paymentType === "subscription" ? "Subscribe Now" : "Buy Now"}" />`,
          webhookInfo: {
            url: "Add to Stripe Dashboard -> Developers -> Webhooks",
            endpoint: "/stripe/webhook (on your Convex site URL)",
            events: [
              "checkout.session.completed",
              "customer.subscription.created",
              "customer.subscription.updated",
              "customer.subscription.deleted",
            ],
            note: "Webhooks are optional but recommended for tracking payments",
          },
          schemaNote: generatePaymentsTableSnippet(),
          nextSteps: [
            "⚠️ CALL deployConvex NOW to activate Stripe routes!",
            `Then use <CheckoutButton priceId="${priceId}" /> in your pricing page`,
            "Button opens Stripe Checkout in a new tab",
            "After payment, user is redirected to /checkout/success",
            isTestMode
              ? "Test with card: 4242 4242 4242 4242"
              : "⚠️ LIVE MODE - real charges!",
          ],
          testCard: isTestMode
            ? {
              number: "4242 4242 4242 4242",
              expiry: "Any future date",
              cvc: "Any 3 digits",
            }
            : null,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger?.error({
          msg: "Failed to setup Stripe payments",
          projectId,
          error: errorMessage,
        });

        return {
          success: false,
          error: `Failed to setup Stripe: ${errorMessage}`,
        };
      }
    },
  });

/**
 * Execute a Convex query to read data from the database
 *
 * This tool allows the AI to read data from the Convex backend
 * by executing query functions defined in convex/queries.ts or similar files.
 *
 * IMPORTANT: Queries are read-only and cannot modify data.
 */
export const runConvexQuery = (context: ToolsContext) =>
  tool({
    description: `Execute a Convex query to READ data from the database.

Use this tool to fetch data from the Convex backend. Queries are read-only.

WHEN TO USE:
- Fetch all records from a table (e.g., api.queries.getAllTasks)
- Get a specific record by ID (e.g., api.queries.getTask with args: {id: "..."})
- Search or filter data (e.g., api.queries.searchTasks with args: {query: "..."})

ARGUMENTS FORMAT:
- functionPath: The path to the query function (e.g., "queries:getAllTasks" or "queries:getTask")
- args: Optional object with arguments to pass to the query

EXAMPLES:
- Get all tasks: functionPath="queries:getAllTasks", args={}
- Get task by ID: functionPath="queries:getTask", args={id: "abc123"}
- List by user: functionPath="queries:getByUser", args={userId: "user123"}

NOTE: The function path format is "filename:functionName" where filename is relative to convex/ folder.`,
    inputSchema: z.object({
      functionPath: z
        .string()
        .describe(
          "Path to the Convex query function (e.g., 'queries:getAllTasks' or 'tasks:list')",
        ),
      args: z
        .record(z.string(), z.unknown())
        .optional()
        .default({})
        .describe("Arguments to pass to the query function as a JSON object"),
    }),
    execute: async ({ functionPath, args }) => {
      const { projectId, logger } = context;

      logger?.info({
        msg: "Executing Convex query",
        projectId,
        functionPath,
        args,
      });

      try {
        // Get the Convex deployment for this project
        const deployment = await prisma.convexDeployment.findUnique({
          where: { projectId },
          select: {
            convexDeploymentUrl: true,
            deployKeyEncrypted: true,
            status: true,
          },
        });

        if (!deployment) {
          return {
            success: false,
            error:
              "No Convex deployment found for this project. Call deployToShipperCloud first to provision a backend.",
          };
        }

        if (deployment.status !== "ACTIVE") {
          return {
            success: false,
            error: `Convex deployment is not active (status: ${deployment.status})`,
          };
        }

        // Decrypt the deploy key
        const deployKey = decryptDeployKey(deployment.deployKeyEncrypted);

        // Execute the query via Convex HTTP API
        const response = await fetch(
          `${deployment.convexDeploymentUrl}/api/query`,
          {
            method: "POST",
            headers: {
              Authorization: `Convex ${deployKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              path: functionPath,
              args: args || {},
              format: "json",
            }),
          },
        );

        if (!response.ok) {
          const errorText = await response.text();
          logger?.error({
            msg: "Convex query failed",
            projectId,
            functionPath,
            status: response.status,
            error: errorText,
          });

          return {
            success: false,
            error: `Query failed (${response.status}): ${errorText}`,
          };
        }

        const result = (await response.json()) as { value?: unknown };

        logger?.info({
          msg: "Convex query succeeded",
          projectId,
          functionPath,
          resultType: typeof result,
          isArray: Array.isArray(result.value),
          resultCount: Array.isArray(result.value)
            ? result.value.length
            : undefined,
        });

        // Convex returns { value: ... } wrapper
        return {
          success: true,
          data: result.value ?? result,
          functionPath,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger?.error({
          msg: "Convex query error",
          projectId,
          functionPath,
          error: errorMessage,
        });

        return {
          success: false,
          error: `Failed to execute query: ${errorMessage}`,
        };
      }
    },
  });

/**
 * Execute a Convex mutation to modify data in the database
 *
 * This tool allows the AI to create, update, or delete data in the Convex backend
 * by executing mutation functions defined in convex/mutations.ts or similar files.
 *
 * IMPORTANT: Mutations modify data and should be used carefully.
 */
export const runConvexMutation = (context: ToolsContext) =>
  tool({
    description: `Execute a Convex mutation to CREATE, UPDATE, or DELETE data.

Use this tool to modify data in the Convex backend. Mutations can insert, update, or delete records.

WHEN TO USE:
- Create a new record (e.g., api.mutations.createTask with args: {title: "..."})
- Update an existing record (e.g., api.mutations.updateTask with args: {id: "...", title: "..."})
- Delete a record (e.g., api.mutations.deleteTask with args: {id: "..."})
- Perform any write operation on the database

ARGUMENTS FORMAT:
- functionPath: The path to the mutation function (e.g., "mutations:createTask")
- args: Object with arguments to pass to the mutation

EXAMPLES:
- Create task: functionPath="mutations:createTask", args={title: "Buy groceries", completed: false}
- Update task: functionPath="mutations:updateTask", args={id: "abc123", completed: true}
- Delete task: functionPath="mutations:deleteTask", args={id: "abc123"}

NOTE: The function path format is "filename:functionName" where filename is relative to convex/ folder.

⚠️ WARNING: Mutations modify data permanently. Make sure you understand what the mutation does before executing.`,
    inputSchema: z.object({
      functionPath: z
        .string()
        .describe(
          "Path to the Convex mutation function (e.g., 'mutations:createTask' or 'tasks:create')",
        ),
      args: z
        .record(z.string(), z.unknown())
        .describe(
          "Arguments to pass to the mutation function as a JSON object",
        ),
    }),
    execute: async ({ functionPath, args }) => {
      const { projectId, logger } = context;

      logger?.info({
        msg: "Executing Convex mutation",
        projectId,
        functionPath,
        args,
      });

      try {
        // Get the Convex deployment for this project
        const deployment = await prisma.convexDeployment.findUnique({
          where: { projectId },
          select: {
            convexDeploymentUrl: true,
            deployKeyEncrypted: true,
            status: true,
          },
        });

        if (!deployment) {
          return {
            success: false,
            error:
              "No Convex deployment found for this project. Call deployToShipperCloud first to provision a backend.",
          };
        }

        if (deployment.status !== "ACTIVE") {
          return {
            success: false,
            error: `Convex deployment is not active (status: ${deployment.status})`,
          };
        }

        // Decrypt the deploy key
        const deployKey = decryptDeployKey(deployment.deployKeyEncrypted);

        // Execute the mutation via Convex HTTP API
        const response = await fetch(
          `${deployment.convexDeploymentUrl}/api/mutation`,
          {
            method: "POST",
            headers: {
              Authorization: `Convex ${deployKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              path: functionPath,
              args: args || {},
              format: "json",
            }),
          },
        );

        if (!response.ok) {
          const errorText = await response.text();
          logger?.error({
            msg: "Convex mutation failed",
            projectId,
            functionPath,
            status: response.status,
            error: errorText,
          });

          return {
            success: false,
            error: `Mutation failed (${response.status}): ${errorText}`,
          };
        }

        const result = (await response.json()) as { value?: unknown };

        logger?.info({
          msg: "Convex mutation succeeded",
          projectId,
          functionPath,
          result,
        });

        // Convex returns { value: ... } wrapper
        return {
          success: true,
          data: result.value ?? result,
          functionPath,
          message: `Successfully executed mutation: ${functionPath}`,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger?.error({
          msg: "Convex mutation error",
          projectId,
          functionPath,
          error: errorMessage,
        });

        return {
          success: false,
          error: `Failed to execute mutation: ${errorMessage}`,
        };
      }
    },
  });

/**
 * List available Convex functions in the project
 *
 * This tool introspects the Convex deployment to show what queries,
 * mutations, and actions are available to call.
 */
export const listConvexFunctions = (context: ToolsContext) =>
  tool({
    description: `List all available Convex functions (queries, mutations, actions) in the project.

Use this tool to discover what Convex functions are available before calling runConvexQuery or runConvexMutation.

This helps you understand:
- What queries are available to read data
- What mutations are available to modify data
- What arguments each function expects

WHEN TO USE:
- Before calling runConvexQuery or runConvexMutation for the first time
- When you need to find the correct function path
- To understand the schema and available operations`,
    inputSchema: z.object({}),
    execute: async () => {
      const { projectId, logger, sandboxId } = context;

      logger?.info({
        msg: "Listing Convex functions",
        projectId,
      });

      try {
        // Get the Convex deployment for this project
        const deployment = await prisma.convexDeployment.findUnique({
          where: { projectId },
          select: {
            convexDeploymentUrl: true,
            status: true,
          },
        });

        if (!deployment) {
          return {
            success: false,
            error:
              "No Convex deployment found for this project. Call deployToShipperCloud first to provision a backend.",
          };
        }

        // Read the convex files from sandbox to understand available functions
        if (!sandboxId) {
          return {
            success: false,
            error:
              "Sandbox not available. Cannot read Convex function definitions.",
          };
        }

        // Read common convex file locations
        const convexFiles: Array<{
          path: string;
          content: string;
          functions: string[];
        }> = [];
        const filesToCheck = [
          "convex/queries.ts",
          "convex/mutations.ts",
          "convex/actions.ts",
          "convex/tasks.ts",
          "convex/users.ts",
          "convex/schema.ts",
        ];

        for (const filePath of filesToCheck) {
          try {
            const content = await modalReadFile(sandboxId, filePath);
            if (content) {
              // Extract exported function names using regex
              const exportMatches =
                content.match(/export\s+const\s+(\w+)\s*=/g) || [];
              const functions = exportMatches
                .map((match) => {
                  const nameMatch = match.match(/export\s+const\s+(\w+)/);
                  return nameMatch ? nameMatch[1] : "";
                })
                .filter(Boolean);

              convexFiles.push({
                path: filePath,
                content:
                  content.substring(0, 500) +
                  (content.length > 500 ? "..." : ""),
                functions,
              });
            }
          } catch {
            // File doesn't exist, skip it
          }
        }

        if (convexFiles.length === 0) {
          return {
            success: false,
            error:
              "No Convex function files found. Make sure convex/ directory exists with queries.ts, mutations.ts, etc.",
          };
        }

        // Format the response
        const functionList = convexFiles.map((file) => {
          const fileName = file.path.replace("convex/", "").replace(".ts", "");
          return {
            file: file.path,
            functions: file.functions.map((fn) => `${fileName}:${fn}`),
          };
        });

        logger?.info({
          msg: "Listed Convex functions",
          projectId,
          fileCount: convexFiles.length,
          totalFunctions: functionList.reduce(
            (acc, f) => acc + f.functions.length,
            0,
          ),
        });

        return {
          success: true,
          deploymentUrl: deployment.convexDeploymentUrl,
          files: functionList,
          usage: {
            queryExample:
              "runConvexQuery with functionPath='queries:getAllTasks'",
            mutationExample:
              "runConvexMutation with functionPath='mutations:createTask', args={...}",
          },
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger?.error({
          msg: "Error listing Convex functions",
          projectId,
          error: errorMessage,
        });

        return {
          success: false,
          error: `Failed to list Convex functions: ${errorMessage}`,
        };
      }
    },
  });

/**
 * Migrate existing deployment to support admin API key if needed.
 *
 * This checks if the deployment is missing adminApiKeyEncrypted and if so:
 * 1. Updates auth templates with apiKey plugin
 * 2. Redeploys to Convex
 * 3. Creates service admin user and API key
 * 4. Saves to database
 *
 * @param projectId - The Shipper project ID
 * @param sandboxId - The sandbox ID for file operations
 * @param logger - Optional logger instance
 */
async function migrateAdminApiKeyIfNeeded(
  projectId: string,
  sandboxId: string,
  logger?: Logger,
): Promise<void> {
  // Check if project has a Convex deployment that needs migration
  const deployment = await prisma.convexDeployment.findUnique({
    where: { projectId },
    select: {
      adminApiKeyEncrypted: true,
      adminUserId: true,
      convexDeploymentUrl: true,
    },
  });

  // No deployment or already has admin API key - nothing to do
  if (!deployment || deployment.adminApiKeyEncrypted) {
    return;
  }

  logger?.info({
    msg: "Migrating existing deployment to support admin API key",
    projectId,
  });

  const siteUrl = deployment.convexDeploymentUrl.replace(
    ".convex.cloud",
    ".convex.site",
  );

  try {
    // Step 1: Update auth templates with apiKey plugin
    logger?.info({
      msg: "Updating auth templates with apiKey plugin",
      projectId,
    });

    await modalWriteFile(sandboxId, "convex/auth.ts", generateAuthTs());
    await modalWriteFile(
      sandboxId,
      "convex/betterAuth/schema.ts",
      generateBetterAuthSchema(),
    );

    // Step 2: Redeploy to Convex (already done by the main deploy, but we need
    // to ensure the new schema is deployed if templates were just updated)
    logger?.info({ msg: "Redeploying with updated auth templates", projectId });

    await modalExecuteCommand(
      sandboxId,
      "rm -rf .convex node_modules/.convex convex/_generated",
    );

    const deployResult = await modalExecuteCommand(
      sandboxId,
      "bunx convex deploy --yes",
      { timeoutMs: 120000 },
    );

    if (deployResult.exitCode !== 0) {
      logger?.warn({
        msg: "Redeploy for admin API key migration failed",
        projectId,
        stderr: deployResult.stderr?.slice(-500),
      });
      return;
    }

    // Step 3: Create service admin user and API key
    logger?.info({ msg: "Creating service admin and API key", projectId });

    // Pass existing admin info (if any) to avoid creating duplicates
    const existingAdmin = deployment.adminApiKeyEncrypted
      ? {
          userId: deployment.adminUserId,
          apiKey: decryptDeployKey(deployment.adminApiKeyEncrypted),
        }
      : undefined;

    const adminResult = await createServiceAdminAndApiKey(
      siteUrl,
      logger,
      existingAdmin,
    );
    logger?.info({ msg: "Admin result", projectId, adminResult });

    if (!adminResult.success || !adminResult.apiKey || !adminResult.userId) {
      logger?.warn({
        msg: "Failed to create service admin during migration",
        projectId,
        error: adminResult.error,
      });
      return;
    }

    // Step 4: Save to database
    const adminApiKeyEncrypted = encryptDeployKey(adminResult.apiKey);

    await prisma.convexDeployment.update({
      where: { projectId },
      data: {
        adminApiKeyEncrypted,
        adminUserId: adminResult.userId,
      },
    });

    logger?.info({
      msg: "Admin API key migration completed successfully",
      projectId,
      adminUserId: adminResult.userId,
    });
  } catch (error) {
    logger?.error({
      msg: "Error during admin API key migration",
      projectId,
      error: error instanceof Error ? error.message : String(error),
    });
    // Don't throw - migration is non-fatal
  }
}

/**
 * Create a service admin user and generate an API key for admin operations.
 *
 * @param siteUrl - The Convex site URL (*.convex.site)
 * @param logger - Optional logger instance
 * @returns Object with success status, userId, and apiKey
 */
async function createServiceAdminAndApiKey(
  siteUrl: string,
  logger?: Logger,
  existingAdmin?: { userId?: string | null; apiKey?: string | null },
): Promise<{
  success: boolean;
  userId?: string;
  apiKey?: string;
  error?: string;
}> {
  // If admin already exists, return existing credentials
  if (existingAdmin?.userId && existingAdmin?.apiKey) {
    logger?.info({
      msg: "Using existing service admin",
      userId: existingAdmin.userId,
    });
    return {
      success: true,
      userId: existingAdmin.userId,
      apiKey: existingAdmin.apiKey,
    };
  }

  const serviceAdminEmail = `service-admin-${Date.now()}@shipper.internal`;
  const serviceAdminPassword = generateBetterAuthSecret();

  try {
    // Step 1: Create the service admin user
    logger?.info({ msg: "Creating service admin user" });

    const signUpResponse = await fetch(`${siteUrl}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: serviceAdminEmail,
        password: serviceAdminPassword,
        name: "Shipper Service Admin",
      }),
    });

    if (!signUpResponse.ok) {
      const errorData = await signUpResponse.json().catch(() => ({}));
      const errorMessage =
        (errorData as { message?: string }).message ||
        `HTTP ${signUpResponse.status}`;
      return {
        success: false,
        error: `Failed to create service admin: ${errorMessage}`,
      };
    }

    const signUpResult = (await signUpResponse.json()) as {
      user?: { id: string };
      token?: string;
    };
    const userId = signUpResult.user?.id;

    if (!userId) {
      return {
        success: false,
        error: "Sign-up succeeded but no user ID returned",
      };
    }

    logger?.info({ msg: "Service admin user created", userId });

    // Step 2: Sign in to get session token
    const signInResponse = await fetch(`${siteUrl}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: serviceAdminEmail,
        password: serviceAdminPassword,
      }),
    });

    let sessionToken: string | undefined;
    if (signInResponse.ok) {
      const setCookieHeader = signInResponse.headers.get("set-cookie");
      if (setCookieHeader) {
        const tokenMatch = setCookieHeader.match(
          /better-auth\.session_token=([^;]+)/,
        );
        sessionToken = tokenMatch?.[1];
      }
    }

    // Step 3: Create API key
    logger?.info({ msg: "Creating API key for service admin" });

    // For server-side API key creation, always pass userId directly
    // Don't rely on session cookies - they don't work in server-to-server calls
    const apiKeyResponse = await fetch(`${siteUrl}/api/auth/api-key/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "shipper-admin-key",
        userId, // Always pass userId for server-side creation
      }),
    });

    if (!apiKeyResponse.ok) {
      const errorData = await apiKeyResponse.json().catch(() => ({}));
      const errorMessage =
        (errorData as { message?: string }).message ||
        `HTTP ${apiKeyResponse.status}`;
      return {
        success: false,
        error: `Failed to create API key: ${errorMessage}`,
        userId,
      };
    }

    const apiKeyResult = (await apiKeyResponse.json()) as {
      key?: string;
      apiKey?: string;
    };
    const apiKey = apiKeyResult.key || apiKeyResult.apiKey;

    if (!apiKey) {
      return {
        success: false,
        error: "API key creation succeeded but no key returned",
        userId,
      };
    }

    logger?.info({ msg: "API key created successfully" });

    return { success: true, userId, apiKey };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMsg };
  }
}

/**
 * Deploy Convex schema and functions to the PRODUCTION backend
 *
 * This tool runs `bunx convex deploy --yes` to push convex/ files
 * to the Shipper Cloud backend.
 *
 * IMPORTANT: Uses `convex deploy` (not `convex dev`) because:
 * - We provision a PRODUCTION deployment via Management API
 * - `convex dev` targets development deployments
 * - `convex deploy` targets production deployments
 * - Non-technical users don't need separate dev/prod environments
 */
export const deployConvex = (context: ToolsContext) =>
  tool({
    description: `Deploy Convex schema and functions to the Shipper Cloud PRODUCTION backend.

⚠️⚠️⚠️ CRITICAL ORDER: Call scaffoldConvexSchema BEFORE this tool! ⚠️⚠️⚠️

CORRECT ORDER:
1. deployToShipperCloud - provisions backend
2. scaffoldConvexSchema - generates schema.ts, queries.ts, mutations.ts
3. deployConvex (THIS TOOL) - deploys and generates types
4. Create React components

🚫 DO NOT call this tool immediately after deployToShipperCloud!
🚫 DO NOT call this tool before scaffoldConvexSchema!

This runs \`bunx convex deploy --yes\` which:
- Clears Convex cache to fix bundling issues
- Validates your schema and functions
- Deploys them to the PRODUCTION Convex backend
- Generates TypeScript types in convex/_generated/

⚠️ SCHEMA CONSTRAINTS - To avoid "NoImportModuleInSchema" errors:
- schema.ts can ONLY import from "convex/server" and "convex/values"
- schema.ts CANNOT import from auth.ts, queries.ts, or any other convex file
- If you get this error, check schema.ts imports

WHEN TO CALL:
- AFTER scaffoldConvexSchema has created the convex files
- After manually modifying schema.ts, queries.ts, or mutations.ts
- After adding new queries or mutations`,
    inputSchema: z.object({
      reason: z
        .string()
        .optional()
        .describe("Brief description of what changes are being deployed"),
    }),
    execute: async ({ reason }) => {
      const { projectId, logger } = context;

      logger?.info({
        msg: "Deploying Convex schema",
        projectId,
        reason,
      });

      try {
        // Get the sandbox for this project
        const sandbox = await getModalSandbox(projectId);
        if (!sandbox) {
          return {
            success: false,
            error:
              "No active sandbox found. Please ensure the project has a running sandbox.",
          };
        }

        // Clear Convex cache before deploying to fix potential bundling issues
        // This helps resolve "NoImportModuleInSchema" errors caused by stale bundles
        logger?.info({
          msg: "Clearing Convex cache before deploy",
          projectId,
        });
        await modalExecuteCommand(
          sandbox.sandboxId,
          "rm -rf .convex node_modules/.convex convex/_generated",
        );

        // Run convex deploy to push to PRODUCTION deployment
        // IMPORTANT: We use `deploy` not `dev` because:
        // - We created a PRODUCTION deployment via Management API
        // - `convex dev` targets development deployments
        // - `convex deploy` targets production deployments
        // - The CONVEX_DEPLOY_KEY is a production key (format: prod:deployment|token)
        const result = await modalExecuteCommand(
          sandbox.sandboxId,
          "bunx convex deploy --yes",
          { timeoutMs: 120000 },
        );

        // Combine stdout and stderr for full output
        const output = [result.stdout, result.stderr]
          .filter(Boolean)
          .join("\n");

        if (result.exitCode !== 0) {
          logger?.error({
            msg: "Convex deploy failed",
            projectId,
            exitCode: result.exitCode,
            stdout: result.stdout,
            stderr: result.stderr,
          });

          return {
            success: false,
            error:
              result.stderr ||
              result.stdout ||
              `Convex deploy failed with exit code ${result.exitCode}`,
            exitCode: result.exitCode,
            output,
          };
        }

        logger?.info({
          msg: "Convex deploy succeeded",
          projectId,
        });

        // Kill any existing vite process and clear cache to avoid "Outdated Optimize Dep" errors
        // The convex deploy command can cause Vite's dependency cache to become stale
        try {
          logger?.info({
            msg: "Killing vite and clearing cache after convex deploy",
            projectId,
          });

          // Kill existing vite process forcefully
          await modalExecuteCommand(
            sandbox.sandboxId,
            "pkill -9 -f vite || true",
          );

          // Clear Vite's dependency optimization cache and temp files
          await modalExecuteCommand(
            sandbox.sandboxId,
            "rm -rf node_modules/.vite node_modules/.tmp",
          );

          // Wait a moment for process to fully terminate
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // Restart dev server
          logger?.info({
            msg: "Restarting dev server after convex deploy",
            projectId,
          });
          await modalStartDevServer(sandbox.sandboxId, projectId, 5173);
        } catch (restartError) {
          logger?.warn({
            msg: "Failed to restart dev server after convex deploy",
            projectId,
            error:
              restartError instanceof Error
                ? restartError.message
                : String(restartError),
          });
        }

        // Add VITE_CONVEX_SITE_URL and SITE_URL to .env.local
        // convex deploy creates .env.local with CONVEX_DEPLOYMENT and VITE_CONVEX_URL
        // We need to add:
        // - VITE_CONVEX_SITE_URL (same as VITE_CONVEX_URL but .convex.site instead of .convex.cloud)
        // - SITE_URL (local dev server URL)
        try {
          // Read VITE_CONVEX_URL from .env.local
          const envResult = await modalExecuteCommand(
            sandbox.sandboxId,
            "grep VITE_CONVEX_URL .env.local | head -1",
          );

          if (envResult.stdout) {
            const match = envResult.stdout.match(/VITE_CONVEX_URL=(.+)/);
            if (match && match[1]) {
              const cloudUrl = match[1].trim();
              const siteUrl = cloudUrl.replace(".convex.cloud", ".convex.site");

              // Append missing env vars to .env.local
              const envVarsToAdd: string[] = [];

              // Check and add VITE_CONVEX_SITE_URL
              const siteUrlCheck = await modalExecuteCommand(
                sandbox.sandboxId,
                "grep -q VITE_CONVEX_SITE_URL .env.local && echo 'exists' || echo 'missing'",
              );
              if (siteUrlCheck.stdout?.trim() === "missing") {
                envVarsToAdd.push(`VITE_CONVEX_SITE_URL=${siteUrl}`);
              }

              // Check and add SITE_URL (used by crossDomain plugin)
              // CORS for Modal sandboxes is handled by *.modal.host wildcard in trustedOrigins
              const localSiteUrlCheck = await modalExecuteCommand(
                sandbox.sandboxId,
                "grep -q '^SITE_URL=' .env.local && echo 'exists' || echo 'missing'",
              );
              if (localSiteUrlCheck.stdout?.trim() === "missing") {
                envVarsToAdd.push("SITE_URL=http://localhost:5173");
              }

              // Append all missing env vars
              if (envVarsToAdd.length > 0) {
                await modalExecuteCommand(
                  sandbox.sandboxId,
                  `echo "${envVarsToAdd.join("\n")}" >> .env.local`,
                );

                logger?.info({
                  msg: "Added env vars to .env.local",
                  projectId,
                  added: envVarsToAdd,
                });
              }
            }
          }
        } catch (envError) {
          logger?.warn({
            msg: "Failed to add env vars to .env.local",
            projectId,
            error:
              envError instanceof Error ? envError.message : String(envError),
          });
        }

        // Check if admin API key migration is needed for existing deployments
        // This enables Better Auth admin operations (like removeUser) via API key
        try {
          await migrateAdminApiKeyIfNeeded(
            projectId,
            sandbox.sandboxId,
            logger,
          );
        } catch (migrationError) {
          logger?.warn({
            msg: "Admin API key migration warning (non-fatal)",
            projectId,
            error:
              migrationError instanceof Error
                ? migrationError.message
                : String(migrationError),
          });
        }

        return {
          success: true,
          message: "Successfully synced Convex schema and functions!",
          output,
          nextSteps: [
            "TypeScript types have been generated in convex/_generated/",
            "Import { api } from 'convex/_generated/api' in your components",
            "Use useQuery(api.queries.yourQuery) and useMutation(api.mutations.yourMutation)",
          ],
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger?.error({
          msg: "Convex deploy error",
          projectId,
          error: errorMessage,
        });

        return {
          success: false,
          error: `Failed to deploy Convex: ${errorMessage}`,
        };
      }
    },
  });

// ============================================================================
// STRIPE HITL TOOLS
// ============================================================================
// Human-in-the-loop tools for Stripe operations.
// These show the user what's being done in their Stripe account.

/**
 * List products in user's Stripe account (HITL)
 * Shows user what products exist before creating new ones
 */
export const stripeListProducts = (context: ToolsContext) =>
  tool({
    description: `Request to list existing products in the user's Stripe account (HITL approval required).

🛑 STOP! After calling this tool, you MUST WAIT for the user to click "Allow" before doing anything else!
Do NOT call executeStripeListProducts until you receive { confirmed: true, ... } from the user.

FLOW:
1. Call this tool → user sees approval card → 🛑 STOP AND WAIT!
2. User clicks "Allow" → you receive { confirmed: true, stripeSecretKey, limit } in the NEXT message
3. ONLY THEN call executeStripeListProducts with stripeSecretKey from step 2`,
    inputSchema: z.object({
      stripeSecretKey: z
        .string()
        .describe("The user's Stripe Secret Key (from requestApiKeys)"),
      limit: z
        .number()
        .optional()
        .default(10)
        .describe("Maximum number of products to list (default 10)"),
    }),
    execute: async ({ stripeSecretKey, limit }) => {
      const { projectId, logger } = context;

      logger?.info({
        msg: "Stripe HITL: List products requested",
        projectId,
      });

      // Return pending status - frontend will show approval card
      return {
        status: "pending_approval",
        toolName: "stripeListProducts",
        action: "List Stripe Products",
        description: `View up to ${limit} products in your Stripe account`,
        stripeSecretKey, // Pass through for execution after approval
        limit,
      };
    },
  });

/**
 * List prices for a product in user's Stripe account (HITL)
 */
export const stripeListPrices = (context: ToolsContext) =>
  tool({
    description: `Request to list prices for a specific product in the user's Stripe account (HITL approval required).

This is a HITL tool - user must approve before the operation can proceed.

FLOW:
1. Call this tool → user sees approval card
2. User clicks "Allow" → you receive { confirmed: true, stripeSecretKey, productId, limit }
3. Call executeStripeListPrices with the same args → get actual price list

Use this to find existing prices before creating new ones.`,
    inputSchema: z.object({
      stripeSecretKey: z.string().describe("The user's Stripe Secret Key"),
      productId: z.string().describe("The Stripe product ID (prod_xxx)"),
      limit: z
        .number()
        .optional()
        .default(10)
        .describe("Maximum number of prices to list"),
    }),
    execute: async ({ stripeSecretKey, productId, limit }) => {
      const { projectId, logger } = context;

      logger?.info({
        msg: "Stripe HITL: List prices requested",
        projectId,
        productId,
      });

      return {
        status: "pending_approval",
        toolName: "stripeListPrices",
        action: "List Stripe Prices",
        description: `View prices for product ${productId}`,
        stripeSecretKey,
        productId,
        limit,
      };
    },
  });

/**
 * Create a product and price in user's Stripe account (HITL)
 * This is the main HITL tool - shows user exactly what will be created
 */
export const stripeCreateProductAndPrice = (context: ToolsContext) =>
  tool({
    description: `Request to create a new product and price in the user's Stripe account (HITL approval required).

🛑 STOP! After calling this tool, you MUST WAIT for the user to click "Allow" before doing anything else!
Do NOT call executeStripeCreateProductAndPrice until you receive { confirmed: true, ... } from the user.

⚠️ PREREQUISITES:
1. deployToShipperCloud must be confirmed
2. requestApiKeys({ provider: "stripe" }) must be called first to get stripeSecretKey

FLOW:
1. Call this tool → user sees approval card → 🛑 STOP AND WAIT!
2. User clicks "Allow" → you receive { confirmed: true, stripeSecretKey, ... } in the NEXT message
3. ONLY THEN call executeStripeCreateProductAndPrice with stripeSecretKey from step 2`,
    inputSchema: z.object({
      stripeSecretKey: z.string().describe("The user's Stripe Secret Key"),
      name: z
        .string()
        .describe("Product name (e.g., 'Pro Plan', 'Premium Access')"),
      description: z.string().optional().describe("Product description"),
      priceInCents: z
        .number()
        .describe("Price in cents (e.g., 2900 for $29.00)"),
      currency: z
        .string()
        .optional()
        .default("usd")
        .describe("Currency code (default: usd)"),
      isSubscription: z
        .boolean()
        .optional()
        .default(false)
        .describe("Whether this is a recurring subscription"),
      billingInterval: z
        .enum(["month", "year", "week", "day"])
        .optional()
        .describe("Billing interval for subscriptions"),
    }),
    execute: async ({
      stripeSecretKey,
      name,
      description,
      priceInCents,
      currency,
      isSubscription,
      billingInterval,
    }) => {
      const { projectId, logger } = context;

      const priceDisplay = `${(priceInCents / 100).toFixed(2)} ${currency.toUpperCase()}`;

      logger?.info({
        msg: "Stripe HITL: Create product and price requested",
        projectId,
        name,
        priceDisplay,
        isSubscription,
      });

      // Return pending status with all details for the approval card
      return {
        status: "pending_approval",
        toolName: "stripeCreateProductAndPrice",
        action: "Create Stripe Product And Price",
        details: {
          name,
          description: description || "No description",
          price: priceDisplay,
          type: isSubscription
            ? `Subscription (${billingInterval || "month"})`
            : "One-time payment",
        },
        // Pass through for execution after approval
        stripeSecretKey,
        name,
        description,
        priceInCents,
        currency,
        isSubscription,
        billingInterval,
      };
    },
  });

// ============================================================================
// STRIPE EXECUTION TOOLS
// ============================================================================
// These tools execute Stripe operations after user approval from HITL tools.
// The AI calls these after receiving { confirmed: true, ...args } from HITL.

/**
 * Execute Stripe list products operation after user approval
 */
export const executeStripeListProducts = (context: ToolsContext) =>
  tool({
    description: `Execute the Stripe list products operation after user approval.

⚠️ ONLY call this after stripeListProducts returns { confirmed: true, ... }
You must pass the stripeSecretKey from the requestApiKeys result.`,
    inputSchema: z.object({
      stripeSecretKey: z
        .string()
        .describe("The Stripe Secret Key from requestApiKeys result"),
      limit: z
        .number()
        .optional()
        .default(10)
        .describe("Maximum number of products to list"),
    }),
    execute: async ({ stripeSecretKey, limit }) => {
      const { logger } = context;

      try {
        if (!stripeSecretKey) {
          return {
            success: false,
            error:
              "stripeSecretKey is required. Use the key from the requestApiKeys result.",
          };
        }

        const Stripe = (await import("stripe")).default;
        const stripe = new Stripe(stripeSecretKey);

        const result = await stripe.products.list({
          limit: limit || 10,
          active: true,
        });

        logger?.info({
          msg: "Stripe list products executed",
          count: result.data.length,
        });

        return {
          success: true,
          action: "List Products",
          products: result.data.map((p) => ({
            id: p.id,
            name: p.name,
            description: p.description,
            active: p.active,
          })),
        };
      } catch (error) {
        logger?.error({
          msg: "Stripe list products failed",
          error: error instanceof Error ? error.message : String(error),
        });
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });

/**
 * Execute Stripe list prices operation after user approval
 */
export const executeStripeListPrices = (context: ToolsContext) =>
  tool({
    description: `Execute the Stripe list prices operation after user approval.

⚠️ ONLY call this after stripeListPrices returns { confirmed: true, ... }
You must pass the stripeSecretKey from the requestApiKeys result.`,
    inputSchema: z.object({
      stripeSecretKey: z
        .string()
        .describe("The Stripe Secret Key from requestApiKeys result"),
      productId: z
        .string()
        .optional()
        .describe("Optional product ID to filter prices"),
      limit: z
        .number()
        .optional()
        .default(10)
        .describe("Maximum number of prices to list"),
    }),
    execute: async ({ stripeSecretKey, productId, limit }) => {
      const { logger } = context;

      try {
        if (!stripeSecretKey) {
          return {
            success: false,
            error:
              "stripeSecretKey is required. Use the key from the requestApiKeys result.",
          };
        }

        const Stripe = (await import("stripe")).default;
        const stripe = new Stripe(stripeSecretKey);

        const listParams: { limit: number; active: boolean; product?: string } =
        {
          limit: limit || 10,
          active: true,
        };
        if (productId) {
          listParams.product = productId;
        }

        const result = await stripe.prices.list(listParams);

        logger?.info({
          msg: "Stripe list prices executed",
          count: result.data.length,
        });

        return {
          success: true,
          action: "List Prices",
          prices: result.data.map((p) => ({
            id: p.id,
            product: p.product,
            unit_amount: p.unit_amount,
            currency: p.currency,
            recurring: p.recurring,
          })),
        };
      } catch (error) {
        logger?.error({
          msg: "Stripe list prices failed",
          error: error instanceof Error ? error.message : String(error),
        });
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });

/**
 * Execute Stripe create product and price operation after user approval
 */
export const executeStripeCreateProductAndPrice = (context: ToolsContext) =>
  tool({
    description: `Execute the Stripe create product and price operation after user approval.

🛑 NEVER call this immediately after stripeCreateProductAndPrice!
You must WAIT for the user to click "Allow" first.

⚠️ ONLY call this when you receive { confirmed: true, stripeSecretKey, ... } from the user's approval.
The approval result contains the stripeSecretKey - extract it and pass it here.

After this succeeds, use the returned priceId in setupStripePayments.`,
    inputSchema: z.object({
      stripeSecretKey: z
        .string()
        .describe("The Stripe Secret Key from requestApiKeys result"),
      name: z.string().describe("Product name"),
      description: z.string().optional().describe("Product description"),
      priceInCents: z.number().describe("Price in cents"),
      currency: z.string().optional().default("usd").describe("Currency code"),
      isSubscription: z
        .boolean()
        .optional()
        .default(false)
        .describe("Whether this is a subscription"),
      billingInterval: z
        .enum(["month", "year", "week", "day"])
        .optional()
        .describe("Billing interval for subscriptions"),
    }),
    execute: async ({
      stripeSecretKey,
      name,
      description,
      priceInCents,
      currency,
      isSubscription,
      billingInterval,
    }) => {
      const { logger } = context;

      try {
        // Log the key AI passed (partial for security)
        logger?.info({
          msg: "executeStripeCreateProductAndPrice called",
          keyReceived: stripeSecretKey
            ? `${stripeSecretKey.substring(0, 12)}...${stripeSecretKey.substring(stripeSecretKey.length - 4)}`
            : "NO_KEY",
          keyLength: stripeSecretKey?.length || 0,
        });

        if (!stripeSecretKey) {
          return {
            success: false,
            error:
              "stripeSecretKey is required. Use the key from the requestApiKeys result.",
          };
        }

        const Stripe = (await import("stripe")).default;
        const stripe = new Stripe(stripeSecretKey);

        // Create product
        logger?.info({ msg: "Creating Stripe product", name });
        const product = await stripe.products.create({
          name,
          description: description || undefined,
        });

        // Create price
        logger?.info({
          msg: "Creating Stripe price",
          productId: product.id,
          priceInCents,
        });

        const priceParams: {
          product: string;
          unit_amount: number;
          currency: string;
          recurring?: { interval: "month" | "year" | "week" | "day" };
        } = {
          product: product.id,
          unit_amount: priceInCents,
          currency: currency || "usd",
        };

        if (isSubscription && billingInterval) {
          priceParams.recurring = { interval: billingInterval };
        }

        const price = await stripe.prices.create(priceParams);

        logger?.info({
          msg: "Stripe product and price created",
          productId: product.id,
          priceId: price.id,
        });

        const priceDisplay = `${(priceInCents / 100).toFixed(2)} ${(currency || "usd").toUpperCase()}`;

        return {
          success: true,
          action: "Create Stripe Product And Price",
          productId: product.id,
          priceId: price.id,
          name,
          price: priceDisplay,
          message: `Created product "${name}" with price ${price.id}. Use this priceId when calling setupStripePayments.`,
        };
      } catch (error) {
        logger?.error({
          msg: "Stripe create product and price failed",
          error: error instanceof Error ? error.message : String(error),
        });
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });

/**
 * Scaffold Convex schema, queries, and mutations based on table definitions.
 * This tool generates boilerplate code to reduce AI token usage and ensure consistency.
 */
export const scaffoldConvexSchema = (context: ToolsContext) =>
  tool({
    description: `Generate Convex schema, queries, and mutations from table definitions.

⚠️⚠️⚠️ CALL THIS IMMEDIATELY AFTER deployToShipperCloud! ⚠️⚠️⚠️

CORRECT ORDER:
1. deployToShipperCloud - provisions backend ✓
2. scaffoldConvexSchema (THIS TOOL) - generates schema, queries, mutations
3. deployConvex - deploys and generates types
4. Create React components

This tool scaffolds complete Convex boilerplate code based on your table definitions.
It generates:
1. convex/schema.ts - Table definitions with proper types and indexes
2. convex/queries.ts - List and get queries for each table
3. convex/mutations.ts - Create, update, and delete mutations for each table

The generated code follows best practices:
- Uses Doc<"tableName"> types for type safety
- Includes proper indexes for common query patterns
- Implements user-scoped queries/mutations with getAuthUserId
- Handles authentication checks correctly (returns null in queries, throws in mutations)

🚫 DO NOT call deployConvex before this tool!
✅ After this tool succeeds, call deployConvex to sync with backend.`,
    inputSchema: z.object({
      tables: z
        .array(
          z.object({
            name: z
              .string()
              .describe(
                "Table name in camelCase (e.g., 'todos', 'products', 'messages')",
              ),
            fields: z
              .array(
                z.object({
                  name: z.string().describe("Field name"),
                  type: z
                    .enum([
                      "string",
                      "number",
                      "boolean",
                      "id",
                      "array",
                      "optional_string",
                      "optional_number",
                      "optional_boolean",
                    ])
                    .describe("Field type"),
                  refTable: z
                    .string()
                    .optional()
                    .describe(
                      "For 'id' type: the table being referenced (e.g., 'users', 'products')",
                    ),
                  arrayType: z
                    .enum(["string", "number", "id"])
                    .optional()
                    .describe("For 'array' type: the type of array elements"),
                  arrayRefTable: z
                    .string()
                    .optional()
                    .describe("For array of ids: the table being referenced"),
                }),
              )
              .describe(
                "Fields for the table (excluding _id and _creationTime)",
              ),
            userScoped: z
              .boolean()
              .default(true)
              .describe(
                "If true, adds userId field and scopes queries/mutations to authenticated user",
              ),
            indexes: z
              .array(z.string())
              .optional()
              .describe(
                "Additional fields to create indexes on (e.g., ['category', 'status'])",
              ),
          }),
        )
        .describe("Array of table definitions to scaffold"),
    }),
    execute: async ({ tables }) => {
      const { projectId, sandboxId, logger } = context;

      logger?.info({
        msg: "scaffoldConvexSchema called",
        projectId,
        tableCount: tables.length,
        tableNames: tables.map((t) => t.name),
      });

      try {
        if (!sandboxId) {
          throw new Error("Sandbox not found");
        }

        const sandboxInfo = await getSandbox(projectId);
        if (!sandboxInfo) {
          throw new Error("Sandbox not available");
        }

        // Generate schema.ts
        const schemaContent = generateSchemaFile(tables);

        // Generate queries.ts
        const queriesContent = generateQueriesFile(tables);

        // Generate mutations.ts
        const mutationsContent = generateMutationsFile(tables);

        // Write all files
        const filesToWrite = [
          { path: "convex/schema.ts", content: schemaContent },
          { path: "convex/queries.ts", content: queriesContent },
          { path: "convex/mutations.ts", content: mutationsContent },
        ];

        const results: string[] = [];

        for (const file of filesToWrite) {
          try {
            await writeFileToSandbox(sandboxInfo, file.path, file.content);
            results.push(`✓ Created ${file.path}`);

            // Update context maps
            if (context.fragmentFiles) {
              context.fragmentFiles.set(file.path, file.content);
            }
            if (context.files) {
              context.files.set(file.path, {
                size: file.content.length,
                modified: Date.now(),
              });
            }
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            results.push(`✗ Failed to create ${file.path}: ${errMsg}`);
          }
        }

        // Generate list of created functions for the AI to use
        const generatedFunctions = tables.map((t) => {
          const singular = t.name.endsWith("s") ? t.name.slice(0, -1) : t.name;
          const capitalSingular =
            singular.charAt(0).toUpperCase() + singular.slice(1);
          const capitalPlural =
            t.name.charAt(0).toUpperCase() + t.name.slice(1);

          const queries = t.userScoped
            ? [
              `list${capitalPlural}`,
              `getMy${capitalPlural}`,
              `get${capitalSingular}`,
            ]
            : [`list${capitalPlural}`, `get${capitalSingular}`];

          const mutations = [
            `create${capitalSingular}`,
            `update${capitalSingular}`,
            `delete${capitalSingular}`,
          ];

          return {
            table: t.name,
            queries: queries.map((q) => `api.queries.${q}`),
            mutations: mutations.map((m) => `api.mutations.${m}`),
          };
        });

        return {
          success: true,
          message: `Scaffolded Convex schema with ${tables.length} table(s)`,
          filesCreated: results,
          tables: tables.map((t) => t.name),
          generatedFunctions,
          usage: generatedFunctions.map((f) => ({
            table: f.table,
            example: `const ${f.table} = useQuery(${f.queries[0]}); // List all ${f.table}`,
          })),
          nextSteps: [
            "Call deployConvex NOW to sync schema with backend",
            "Then use the generated functions in your components:",
            ...generatedFunctions.flatMap((f) => [
              `  - ${f.queries.join(", ")}`,
              `  - ${f.mutations.join(", ")}`,
            ]),
          ],
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger?.error({
          msg: "scaffoldConvexSchema error",
          projectId,
          error: errorMessage,
        });

        return {
          success: false,
          error: `Failed to scaffold Convex schema: ${errorMessage}`,
        };
      }
    },
  });

/**
 * Generate convex/schema.ts content
 */
function generateSchemaFile(
  tables: Array<{
    name: string;
    fields: Array<{
      name: string;
      type: string;
      refTable?: string;
      arrayType?: string;
      arrayRefTable?: string;
    }>;
    userScoped: boolean;
    indexes?: string[];
  }>,
): string {
  // Note: Better Auth tables are managed by the @convex-dev/better-auth component
  // They should NOT be imported or defined in schema.ts
  const imports = [
    'import { defineSchema, defineTable } from "convex/server";',
    'import { v } from "convex/values";',
  ];

  const tableDefinitions = tables.map((table) => {
    const fields: string[] = [];

    // Add userId if user-scoped (use v.string() for Better Auth user IDs)
    if (table.userScoped) {
      fields.push("    userId: v.string(),");
    }

    // Add table fields (excluding userId if userScoped since it's already added)
    for (const field of table.fields) {
      // Skip userId if userScoped is true to avoid duplicate
      if (table.userScoped && field.name === "userId") {
        continue;
      }
      const fieldDef = generateFieldDefinition(field);
      fields.push(`    ${field.name}: ${fieldDef},`);
    }

    // Generate indexes
    const indexes: string[] = [];
    const usedIndexNames = new Set<string>();
    const usedIndexFields = new Set<string>();

    if (table.userScoped) {
      indexes.push(`    .index("by_user", ["userId"])`);
      usedIndexNames.add("by_user");
      usedIndexNames.add("by_userId"); // Prevent duplicate if someone names it this way
      usedIndexFields.add("userId");
    }
    if (table.indexes) {
      for (const indexField of table.indexes) {
        // Skip if this field already has an index (e.g., userId when userScoped is true)
        if (usedIndexFields.has(indexField)) {
          continue;
        }
        const indexName = `by_${indexField}`;
        // Skip if index name would be duplicate
        if (usedIndexNames.has(indexName)) {
          continue;
        }
        indexes.push(`    .index("${indexName}", ["${indexField}"])`);
        usedIndexNames.add(indexName);
        usedIndexFields.add(indexField);
      }
    }

    const indexString = indexes.length > 0 ? `\n${indexes.join("\n")}` : "";

    return `  ${table.name}: defineTable({
${fields.join("\n")}
  })${indexString},`;
  });

  // Note: Better Auth tables are managed by the component automatically
  // We no longer include authTables spread (it was for the old @convex-dev/auth package)
  const schemaComment =
    "  // Better Auth tables (user, session, account, verification) are managed\n  // automatically by the @convex-dev/better-auth component.\n";

  return `${imports.join("\n")}

export default defineSchema({
${schemaComment}
  // Application tables
${tableDefinitions.join("\n\n")}
});
`;
}

/**
 * Generate field definition for schema
 */
function generateFieldDefinition(field: {
  name: string;
  type: string;
  refTable?: string;
  arrayType?: string;
  arrayRefTable?: string;
}): string {
  switch (field.type) {
    case "string":
      return "v.string()";
    case "number":
      return "v.number()";
    case "boolean":
      return "v.boolean()";
    case "optional_string":
      return "v.optional(v.string())";
    case "optional_number":
      return "v.optional(v.number())";
    case "optional_boolean":
      return "v.optional(v.boolean())";
    case "id":
      return `v.id("${field.refTable || "unknown"}")`;
    case "array":
      if (field.arrayType === "id" && field.arrayRefTable) {
        return `v.array(v.id("${field.arrayRefTable}"))`;
      } else if (field.arrayType === "string") {
        return "v.array(v.string())";
      } else if (field.arrayType === "number") {
        return "v.array(v.number())";
      }
      return "v.array(v.string())";
    default:
      return "v.string()";
  }
}

/**
 * Generate convex/queries.ts content
 */
function generateQueriesFile(
  tables: Array<{
    name: string;
    fields: Array<{ name: string; type: string; refTable?: string }>;
    userScoped: boolean;
  }>,
): string {
  const queries: string[] = [];

  for (const table of tables) {
    const singularName = table.name.endsWith("s")
      ? table.name.slice(0, -1)
      : table.name;
    const capitalName =
      singularName.charAt(0).toUpperCase() + singularName.slice(1);
    const capitalPlural =
      table.name.charAt(0).toUpperCase() + table.name.slice(1);

    if (table.userScoped) {
      // User-scoped list query - provide both naming conventions
      queries.push(`// List all ${table.name} for the authenticated user
// Available as: api.queries.list${capitalPlural} OR api.queries.getMy${capitalPlural}
export const list${capitalPlural} = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx) as BetterAuthUser | null;
    if (!user) return [];

    return await ctx.db
      .query("${table.name}")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .collect();
  },
});

// Alias for list${capitalPlural} - use whichever name you prefer
export const getMy${capitalPlural} = list${capitalPlural};`);

      // User-scoped get by ID query
      queries.push(`// Get a single ${singularName} by ID (only if owned by user)
export const get${capitalName} = query({
  args: { id: v.id("${table.name}") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx) as BetterAuthUser | null;
    if (!user) return null;

    const item = await ctx.db.get(args.id);
    if (!item || item.userId !== user._id) return null;
    return item;
  },
});`);
    } else {
      // Public list query
      queries.push(`// List all ${table.name}
export const list${capitalPlural} = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("${table.name}").collect();
  },
});`);

      // Public get by ID query
      queries.push(`// Get a single ${singularName} by ID
export const get${capitalName} = query({
  args: { id: v.id("${table.name}") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});`);
    }
  }

  const hasUserScoped = tables.some((t) => t.userScoped);

  // Add BetterAuthUser type for proper TypeScript inference
  const userTypeDefinition = hasUserScoped
    ? `
// Type for Better Auth user (for TypeScript)
interface BetterAuthUser {
  _id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  emailVerified?: boolean;
  createdAt: number;
  updatedAt: number;
}
`
    : "";

  return `import { query } from "./_generated/server";
import { v } from "convex/values";
${hasUserScoped ? 'import { authComponent } from "./auth";\n' : ""}${userTypeDefinition}
${queries.join("\n\n")}
`;
}

/**
 * Generate convex/mutations.ts content
 */
function generateMutationsFile(
  tables: Array<{
    name: string;
    fields: Array<{
      name: string;
      type: string;
      refTable?: string;
      arrayType?: string;
      arrayRefTable?: string;
    }>;
    userScoped: boolean;
  }>,
): string {
  const mutations: string[] = [];

  for (const table of tables) {
    const singularName = table.name.endsWith("s")
      ? table.name.slice(0, -1)
      : table.name;
    const capitalName =
      singularName.charAt(0).toUpperCase() + singularName.slice(1);

    // Filter out userId from fields if userScoped (userId comes from auth, not args)
    const fieldsForArgs = table.userScoped
      ? table.fields.filter((f) => f.name !== "userId")
      : table.fields;

    // Generate args for create mutation (exclude optional handling for simplicity)
    const createArgs = fieldsForArgs.map((f) => {
      const argType = generateArgType(f);
      return `    ${f.name}: ${argType},`;
    });

    // Generate insert object
    const insertFields = table.userScoped ? ["      userId,"] : [];
    insertFields.push(
      ...fieldsForArgs.map((f) => `      ${f.name}: args.${f.name},`),
    );

    if (table.userScoped) {
      // Create mutation (user-scoped)
      mutations.push(`// Create a new ${singularName}
export const create${capitalName} = mutation({
  args: {
${createArgs.join("\n")}
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx) as BetterAuthUser | null;
    if (!user) throw new Error("Not authenticated");

    return await ctx.db.insert("${table.name}", {
      userId: user._id,
${fieldsForArgs.map((f) => `      ${f.name}: args.${f.name},`).join("\n")}
    });
  },
});`);

      // Update mutation (user-scoped) - use fieldsForArgs to exclude userId
      const updateArgs = fieldsForArgs.map((f) => {
        const argType = generateArgType(f);
        // Make all fields optional for update
        return `    ${f.name}: v.optional(${argType}),`;
      });

      mutations.push(`// Update a ${singularName} (only if owned by user)
export const update${capitalName} = mutation({
  args: {
    id: v.id("${table.name}"),
${updateArgs.join("\n")}
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx) as BetterAuthUser | null;
    if (!user) throw new Error("Not authenticated");

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== user._id) {
      throw new Error("Not found or not authorized");
    }

    const { id, ...updates } = args;
    // Filter out undefined values
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    await ctx.db.patch(args.id, cleanUpdates);
    return args.id;
  },
});`);

      // Delete mutation (user-scoped)
      mutations.push(`// Delete a ${singularName} (only if owned by user)
export const delete${capitalName} = mutation({
  args: { id: v.id("${table.name}") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx) as BetterAuthUser | null;
    if (!user) throw new Error("Not authenticated");

    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== user._id) {
      throw new Error("Not found or not authorized");
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});`);
    } else {
      // Public create mutation
      mutations.push(`// Create a new ${singularName}
export const create${capitalName} = mutation({
  args: {
${createArgs.join("\n")}
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("${table.name}", {
${table.fields.map((f) => `      ${f.name}: args.${f.name},`).join("\n")}
    });
  },
});`);

      // Public update mutation
      const updateArgs = table.fields.map((f) => {
        const argType = generateArgType(f);
        return `    ${f.name}: v.optional(${argType}),`;
      });

      mutations.push(`// Update a ${singularName}
export const update${capitalName} = mutation({
  args: {
    id: v.id("${table.name}"),
${updateArgs.join("\n")}
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    await ctx.db.patch(args.id, cleanUpdates);
    return args.id;
  },
});`);

      // Public delete mutation
      mutations.push(`// Delete a ${singularName}
export const delete${capitalName} = mutation({
  args: { id: v.id("${table.name}") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return args.id;
  },
});`);
    }
  }

  const hasUserScoped = tables.some((t) => t.userScoped);

  // Add BetterAuthUser type for proper TypeScript inference
  const userTypeDefinition = hasUserScoped
    ? `
// Type for Better Auth user (for TypeScript)
interface BetterAuthUser {
  _id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  emailVerified?: boolean;
  createdAt: number;
  updatedAt: number;
}
`
    : "";

  return `import { mutation } from "./_generated/server";
import { v } from "convex/values";
${hasUserScoped ? 'import { authComponent } from "./auth";\n' : ""}${userTypeDefinition}
${mutations.join("\n\n")}
`;
}

/**
 * Generate Convex validator type from field definition
 */
function generateArgType(field: {
  type: string;
  refTable?: string;
  arrayType?: string;
  arrayRefTable?: string;
}): string {
  switch (field.type) {
    case "string":
      return "v.string()";
    case "number":
      return "v.number()";
    case "boolean":
      return "v.boolean()";
    case "optional_string":
      return "v.optional(v.string())";
    case "optional_number":
      return "v.optional(v.number())";
    case "optional_boolean":
      return "v.optional(v.boolean())";
    case "id":
      return `v.id("${field.refTable || "unknown"}")`;
    case "array":
      if (field.arrayType === "id" && field.arrayRefTable) {
        return `v.array(v.id("${field.arrayRefTable}"))`;
      } else if (field.arrayType === "string") {
        return "v.array(v.string())";
      } else if (field.arrayType === "number") {
        return "v.array(v.number())";
      }
      return "v.array(v.string())";
    default:
      return "v.string()";
  }
}

export {
  analyzeProjectErrors,
  ensurePreviewHealthy,
  runBuildValidationGate,
  validateSyntaxOrThrow,
};

// =============================================================================
// Tool: fetchFromConnector
// Fetch data from user's connected personal connectors (Notion, Linear, etc.)
// =============================================================================

/**
 * Fetch data from user's connected personal connectors
 * This tool allows the AI to read from Notion, Linear, Jira, etc.
 */
export const fetchFromConnector = (context: ToolsContext) =>
  tool({
    description: `Fetch data from user's connected tools (Notion, Linear, Jira, Miro).

Use this when user references:
- "my Notion doc" / "from Notion" / "the Notion page"
- "my Linear issue" / "the ticket"
- "my Jira ticket" / "the story"
- "my Miro board" / "the wireframe"

This tool reads the user's actual data to understand requirements.
If the user hasn't connected the tool, it will return instructions to connect.`,

    inputSchema: z.object({
      provider: z
        .enum(["linear", "atlassian", "miro", "n8n"])
        .describe(
          "Which tool to fetch from (use notionWorkspace tool for Notion)",
        ),
      resourceType: z
        .enum(["search", "fetch", "pages", "databases"])
        .describe(
          "Type of operation: 'search' to find resources, 'fetch' to get specific content by URL, 'pages' to list pages, 'databases' to list databases",
        ),
      query: z
        .string()
        .optional()
        .describe(
          "Search query, page title, or URL to fetch. For 'fetch' type, provide the full URL.",
        ),
    }),

    execute: async ({ provider, resourceType, query }) => {
      const { userId, logger } = context;

      logger?.info({
        msg: "Fetching from connector",
        provider,
        resourceType,
        query,
      });

      // Get connector definition
      const connector = connectorRegistry.getPersonalConnector(
        provider.toUpperCase() as any,
      );

      if (!connector) {
        return {
          success: false,
          error: `Unknown connector: ${provider}`,
          message: `The connector "${provider}" is not yet supported.`,
        };
      }

      // Check if user has this provider connected
      logger?.info({
        msg: "Looking up connector access token",
        userId,
        provider: provider.toUpperCase(),
      });

      const accessToken = await connectorRegistry.getPersonalAccessToken(
        userId,
        provider.toUpperCase() as any,
      );

      logger?.info({
        msg: "Access token lookup result",
        userId,
        provider: provider.toUpperCase(),
        hasToken: !!accessToken,
      });

      if (!accessToken) {
        return {
          success: false,
          error: `${connector.name} is not connected`,
          action_required: "connect_connector",
          provider,
          message: `Please connect your ${connector.name} account in Settings → Connectors to use this feature.`,
          connectUrl: `/settings/connectors`,
        };
      }

      try {
        // Fetch resources using the connector
        const resources = await connector.fetchResources(accessToken, {
          resourceType,
          query: query || undefined,
        });

        logger?.info({
          msg: "Connector fetch successful",
          provider,
          resourceCount: resources.length,
        });

        return {
          success: true,
          provider,
          resourceType,
          resources,
          count: resources.length,
          message:
            resources.length > 0
              ? `Found ${resources.length} result(s) from ${connector.name}`
              : `No results found in ${connector.name} for "${query}"`,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger?.error({
          msg: "Connector fetch failed",
          provider,
          error: errorMessage,
        });

        return {
          success: false,
          error: errorMessage,
          provider,
          message: `Failed to fetch from ${connector.name}: ${errorMessage}`,
        };
      }
    },
  });

/**
 * Notion Workspace Tool - Full MCP capabilities
 *
 * Allows AI to interact with user's Notion workspace:
 * - Search pages and databases
 * - Read page content
 * - Create new pages
 * - Update existing pages
 * - Create and query databases
 * - Add comments
 * - And more...
 */
export const notionWorkspace = (context: ToolsContext) =>
  tool({
    description: `Interact with user's Notion workspace. USE THIS FOR ALL NOTION OPERATIONS.

ACTIONS:
- list_pages: Show all accessible pages (use when user says "check my pages", "what's in my Notion")
- search: Find pages by keyword (extract query from user's words, NOT project name)
- fetch: Get full content of a specific page
- create_page: Create a new page
- update_page: Update existing page
- create_database: Create a database
- query_database: Query database entries
- add_comment/get_comments: Manage comments
- duplicate_page/move_pages: Organize pages

IMPORTANT: The 'query' param must come from USER'S WORDS, not the project name!
Example: User says "find my PRD" → query: "PRD"
Example: User says "check my pages" → action: "list_pages" (no query)`,

    inputSchema: z.object({
      action: z
        .enum([
          "search",
          "list_pages",
          "fetch",
          "create_page",
          "update_page",
          "create_database",
          "query_database",
          "add_comment",
          "get_comments",
          "duplicate_page",
          "move_pages",
        ])
        .describe(
          "The action to perform: 'search' to find by keyword, 'list_pages' to list all accessible pages, 'fetch' to get full page content",
        ),
      // Search params
      query: z.string().optional().describe("Search query (for search action)"),
      // Fetch/Update params
      pageId: z
        .string()
        .optional()
        .describe(
          "Page or database ID (for fetch, update, comments, duplicate)",
        ),
      pageUrl: z
        .string()
        .optional()
        .describe("Notion page URL (alternative to pageId for fetch)"),
      // Create page params
      parentId: z
        .string()
        .optional()
        .describe(
          "Parent page or database ID (for create_page, create_database)",
        ),
      title: z.string().optional().describe("Title for new page or database"),
      content: z
        .string()
        .optional()
        .describe("Markdown content for page (create or update)"),
      // Database params
      databaseId: z
        .string()
        .optional()
        .describe("Database ID (for query_database)"),
      properties: z
        .record(z.string(), z.unknown())
        .optional()
        .describe(
          "Properties schema (for create_database) or filter (for query)",
        ),
      filter: z
        .record(z.string(), z.unknown())
        .optional()
        .describe("Filter criteria for database query"),
      sorts: z
        .array(
          z.object({
            property: z.string(),
            direction: z.enum(["ascending", "descending"]),
          }),
        )
        .optional()
        .describe("Sort criteria for database query"),
      // Comment params
      comment: z.string().optional().describe("Comment text (for add_comment)"),
      // Move params
      pageIds: z
        .array(z.string())
        .optional()
        .describe("Page IDs to move (for move_pages)"),
      newParentId: z
        .string()
        .optional()
        .describe("New parent ID (for move_pages, duplicate_page)"),
    }),

    execute: async (params) => {
      const { userId, logger } = context;
      const { action } = params;

      logger?.info({ msg: "Notion workspace action", action, params });

      // Get access token
      const accessToken = await connectorRegistry.getPersonalAccessToken(
        userId,
        "NOTION" as any,
      );

      if (!accessToken) {
        return {
          success: false,
          error: "Notion is not connected",
          action_required: "connect_connector",
          provider: "notion",
          message:
            "Please connect your Notion account in Settings → Connectors to use this feature.",
          connectUrl: "/settings/connectors",
        };
      }

      try {
        // Import MCP functions dynamically to avoid circular deps
        const {
          notionMCPSearch,
          notionMCPFetch,
          notionMCPCreatePages,
          notionMCPUpdatePage,
          notionMCPCreateDatabase,
          notionMCPQueryDatabase,
          notionMCPCreateComment,
          notionMCPGetComments,
          notionMCPDuplicatePage,
          notionMCPMovePages,
        } = await import("./connectors/mcp-client.js");

        let result;

        switch (action) {
          case "search": {
            const searchQuery = params.query || "*";
            result = await notionMCPSearch(accessToken, searchQuery);
            break;
          }

          case "list_pages": {
            // List all accessible pages - use wildcard search
            result = await notionMCPSearch(accessToken, "page");
            break;
          }

          case "fetch": {
            const id = params.pageId || params.pageUrl;
            if (!id) {
              return {
                success: false,
                error: "pageId or pageUrl is required for fetch",
              };
            }
            result = await notionMCPFetch(accessToken, id);
            break;
          }

          case "create_page": {
            if (!params.parentId || !params.title) {
              return {
                success: false,
                error: "parentId and title are required for create_page",
              };
            }
            result = await notionMCPCreatePages(
              accessToken,
              params.parentId,
              params.title,
              params.content,
            );
            break;
          }

          case "update_page": {
            if (!params.pageId) {
              return {
                success: false,
                error: "pageId is required for update_page",
              };
            }
            result = await notionMCPUpdatePage(
              accessToken,
              params.pageId,
              params.properties,
              params.content,
            );
            break;
          }

          case "create_database": {
            if (!params.parentId || !params.title || !params.properties) {
              return {
                success: false,
                error:
                  "parentId, title, and properties are required for create_database",
              };
            }
            result = await notionMCPCreateDatabase(
              accessToken,
              params.parentId,
              params.title,
              params.properties,
            );
            break;
          }

          case "query_database": {
            if (!params.databaseId) {
              return {
                success: false,
                error: "databaseId is required for query_database",
              };
            }
            result = await notionMCPQueryDatabase(
              accessToken,
              params.databaseId,
              params.filter,
              params.sorts,
            );
            break;
          }

          case "add_comment": {
            if (!params.pageId || !params.comment) {
              return {
                success: false,
                error: "pageId and comment are required for add_comment",
              };
            }
            result = await notionMCPCreateComment(
              accessToken,
              params.pageId,
              params.comment,
            );
            break;
          }

          case "get_comments": {
            if (!params.pageId) {
              return {
                success: false,
                error: "pageId is required for get_comments",
              };
            }
            result = await notionMCPGetComments(accessToken, params.pageId);
            break;
          }

          case "duplicate_page": {
            if (!params.pageId) {
              return {
                success: false,
                error: "pageId is required for duplicate_page",
              };
            }
            result = await notionMCPDuplicatePage(
              accessToken,
              params.pageId,
              params.newParentId,
            );
            break;
          }

          case "move_pages": {
            if (!params.pageIds || !params.newParentId) {
              return {
                success: false,
                error: "pageIds and newParentId are required for move_pages",
              };
            }
            result = await notionMCPMovePages(
              accessToken,
              params.pageIds,
              params.newParentId,
            );
            break;
          }

          default:
            return { success: false, error: `Unknown action: ${action}` };
        }

        if (!result.success) {
          return {
            success: false,
            error: result.error,
            message: `Notion ${action} failed: ${result.error}`,
          };
        }

        return {
          success: true,
          action,
          content: result.content,
          message: `Notion ${action} completed successfully`,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger?.error({
          msg: "Notion workspace error",
          action,
          error: errorMessage,
        });
        return {
          success: false,
          error: errorMessage,
          message: `Notion ${action} failed: ${errorMessage}`,
        };
      }
    },
  });

/**
 * Atlassian Workspace Tool - Direct REST API calls to Jira + Confluence
 * No MCP needed - uses standard OAuth + REST API
 */
export const atlassianWorkspace = (context: ToolsContext) =>
  tool({
    description: `Interact with user's Atlassian workspace (Jira + Confluence). Direct REST API access.
  
  ACTIONS:
  - list_projects: List all Jira projects
  - search_issues: Search Jira issues by JQL query
  - get_issue: Get specific issue details by key (e.g., "PROJ-123")
  - search_pages: Search Confluence pages
  - get_page: Get specific Confluence page
  
  IMPORTANT: Extract query from USER'S WORDS!
  Example: User says "list my projects" → action: "list_projects"
  Example: User says "find bug tickets" → action: "search_issues", query: "bug"`,

    inputSchema: z.object({
      action: z
        .enum([
          "list_projects",
          "search_issues",
          "get_issue",
          "search_pages",
          "get_page",
        ])
        .describe("The action to perform"),
      query: z
        .string()
        .optional()
        .describe("Search query (for search actions)"),
      issueKey: z
        .string()
        .optional()
        .describe("Issue key like 'PROJ-123' (for get_issue)"),
      pageId: z
        .string()
        .optional()
        .describe("Page ID (for get_page)"),
      limit: z.number().optional().default(50),
    }),

    execute: async (params) => {
      const { userId, logger } = context;
      const { action, query, issueKey, pageId, limit } = params;

      logger?.info({ msg: "Atlassian action", action, params });

      // Get access token
      const accessToken = await connectorRegistry.getPersonalAccessToken(
        userId,
        "ATLASSIAN" as any,
      );

      if (!accessToken) {
        return {
          success: false,
          error: "Atlassian is not connected",
          action_required: "connect_connector",
          provider: "atlassian",
          message:
            "Please connect Atlassian in Settings → Connectors",
          connectUrl: "/settings/connectors",
        };
      }

      try {
        // Step 1: Get accessible sites (cloud IDs)
        const sitesResponse = await fetch(
          "https://api.atlassian.com/oauth/token/accessible-resources",
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: "application/json",
            },
          },
        );

        if (!sitesResponse.ok) {
          const error = await sitesResponse.text();
          return {
            success: false,
            error: `Failed to get Atlassian sites: ${error}`,
          };
        }

        const sites = (await sitesResponse.json()) as Array<{
          id: string;
          url: string;
          name: string;
        }>;

        if (sites.length === 0) {
          return {
            success: false,
            error: "No accessible Atlassian sites found",
          };
        }

        const cloudId = sites[0].id;
        const siteName = sites[0].name;

        logger?.info({
          msg: "Using Atlassian site",
          cloudId,
          siteName,
        });

        // Step 2: Execute the requested action
        let result;

        switch (action) {
          case "list_projects": {
            // List all Jira projects
            const response = await fetch(
              `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/project`,
              {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  Accept: "application/json",
                },
              },
            );

            if (!response.ok) {
              const error = await response.text();
              return {
                success: false,
                error: `Failed to list projects: ${error}`,
              };
            }

            const projects = (await response.json()) as Array<{
              id: string;
              key: string;
              name: string;
            }>;
            result = {
              projects,
              count: projects.length,
            };
            break;
          }

          case "search_issues": {
            // Search Jira issues
            const jql = query
              ? `text ~ "${query}" ORDER BY updated DESC`
              : "ORDER BY updated DESC";

            const response = await fetch(
              `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/search`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  Accept: "application/json",
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  jql,
                  maxResults: limit,
                  fields: [
                    "summary",
                    "description",
                    "status",
                    "priority",
                    "assignee",
                    "created",
                    "updated",
                    "project",
                  ],
                }),
              },
            );

            if (!response.ok) {
              const error = await response.text();
              return {
                success: false,
                error: `Failed to search issues: ${error}`,
              };
            }

            const data = await response.json() as any;
            result = {
              issues: data.issues,
              total: data.total,
              count: data.issues.length,
            };
            break;
          }

          case "get_issue": {
            if (!issueKey) {
              return {
                success: false,
                error: "issueKey is required for get_issue",
              };
            }

            const response = await fetch(
              `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue/${issueKey}`,
              {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  Accept: "application/json",
                },
              },
            );

            if (!response.ok) {
              const error = await response.text();
              return {
                success: false,
                error: `Failed to get issue: ${error}`,
              };
            }

            result = await response.json();
            break;
          }

          case "search_pages": {
            // Search Confluence pages
            const cql = query
              ? `text ~ "${query}" AND type=page ORDER BY lastmodified DESC`
              : "type=page ORDER BY lastmodified DESC";

            const urlParams = new URLSearchParams({
              cql,
              limit: limit.toString(),
              expand: "body.storage,version",
            });

            const response = await fetch(
              `https://api.atlassian.com/ex/confluence/${cloudId}/rest/api/content/search?${urlParams}`,
              {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  Accept: "application/json",
                },
              },
            );

            if (!response.ok) {
              const error = await response.text();
              return {
                success: false,
                error: `Failed to search pages: ${error}`,
              };
            }

            const data = await response.json() as any;
            result = {
              pages: data.results,
              count: data.results.length,
            };
            break;
          }

          case "get_page": {
            if (!pageId) {
              return {
                success: false,
                error: "pageId is required for get_page",
              };
            }

            const response = await fetch(
              `https://api.atlassian.com/ex/confluence/${cloudId}/rest/api/content/${pageId}?expand=body.storage,version`,
              {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  Accept: "application/json",
                },
              },
            );

            if (!response.ok) {
              const error = await response.text();
              return {
                success: false,
                error: `Failed to get page: ${error}`,
              };
            }

            result = await response.json();
            break;
          }

          default:
            return {
              success: false,
              error: `Unknown action: ${action}`,
            };
        }

        return {
          success: true,
          action,
          site: siteName,
          cloudId,
          data: result,
          message: `Successfully executed ${action}`,
        };
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : String(error);
        logger?.error({
          msg: "Atlassian action failed",
          action,
          error: errorMsg,
        });

        return {
          success: false,
          error: errorMsg,
        };
      }
    },
  });

export const tools = (context: ToolsContext) => ({
  getFiles: getFiles(context),
  readFile: readFile(context),
  createOrEditFiles: createOrEditFiles(context),
  // Migration analysis for imported projects - scans codebase systematically
  analyzeMigration: analyzeMigration(context),
  getSandboxUrl: getSandboxUrl(context),
  finalizeWorkingFragment: finalizeWorkingFragment(context),
  createFragmentSnapshot: createFragmentSnapshot(context),
  installPackages: installPackages(context),
  quickEdit: quickEdit(context),
  // detectErrors and autoFixErrors removed - error detection now happens in finalizeWorkingFragment Gate 4
  // simpleMessage: simpleMessage(context),
  manageTodos: manageTodos(context),
  generateImage: generateImage(context),
  // Planning questions HITL - ask clarifying questions before building
  askClarifyingQuestions: askClarifyingQuestions(context),
  // Shipper Cloud (Convex) deployment with auth - executes immediately
  deployToShipperCloud: deployToShipperCloud(context),
  // Enable AI capabilities with Convex Agent component
  enableAI: enableAI(context),
  // Use connected services from Workspace Settings (preferred over requestApiKeys)
  useConnectedService: useConnectedService(context),
  // Request API keys from user via UI card (HITL) - fallback when service not connected
  requestApiKeys: requestApiKeys(context),
  // Setup Stripe payments with automatic code generation
  setupStripePayments: setupStripePayments(context),
  // Deploy Convex schema/functions to backend
  deployConvex: deployConvex(context),
  // Scaffold Convex schema, queries, and mutations from table definitions
  scaffoldConvexSchema: scaffoldConvexSchema(context),
  // Convex data operations - query and mutate data in the database
  runConvexQuery: runConvexQuery(context),
  runConvexMutation: runConvexMutation(context),
  listConvexFunctions: listConvexFunctions(context),
  // Stripe HITL tools - user sees and approves each operation
  stripeListProducts: stripeListProducts(context),
  stripeListPrices: stripeListPrices(context),
  stripeCreateProductAndPrice: stripeCreateProductAndPrice(context),
  // Stripe execution tools - called after user approval from HITL
  executeStripeListProducts: executeStripeListProducts(context),
  executeStripeListPrices: executeStripeListPrices(context),
  executeStripeCreateProductAndPrice:
    executeStripeCreateProductAndPrice(context),
  // Fetch from connected personal connectors (Notion, Linear, Jira, etc.)
  fetchFromConnector: fetchFromConnector(context),
  // Full Notion workspace capabilities (search, create, update, etc.)
  notionWorkspace: notionWorkspace(context),

  // Full Atlassian workspace capabilities (Jira + Confluence)
  atlassianWorkspace: atlassianWorkspace(context),
});

export const toolNames = Object.keys(tools({} as ToolsContext));

// Export sandbox management functions for use in other services
export {
  getSandbox,
  createSandbox,
  getFilesFromSandbox,
  readFileFromSandbox,
  writeFileToSandbox,
};
