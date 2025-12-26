import { Buffer } from "node:buffer";
import { Readable } from "node:stream";
import { prisma } from "@/lib/db";
import {
  getSandbox,
  createSandbox,
  createGitCommit,
  getDevServerStatus,
} from "@/lib/daytona-sandbox-manager";
import { runPlaywrightRuntimeCheck } from "@/lib/ai/daytona-playwright-manager";
import {
  InferToolInput,
  InferToolOutput,
  tool,
  UIMessage,
  UIMessageStreamWriter,
} from "ai";
import { z } from "zod";
import {
  compareFileLists,
  validateFileStructure,
  validateImports,
  validateComponentDependencies,
  validateTypeScript,
  validateDependencies,
  validateIconContextLogic,
  validateBuild,
  validateFragmentCompleteness,
  validateContentCompleteness,
} from "./validation-utils";
import { type ProjectErrors, type RuntimeError } from "@/lib/error-detector";
// NOTE: This file is only used by the webapp's /api/chat route (legacy).
// The main AI chat is now handled by apps/api which uses Redis-based file streaming.
import { redisFileStreamEmitter } from "@/lib/redis-file-events";
import { daytonaAPI } from "@/lib/api/daytona-client";
// Helper function to detect runtime errors using Playwright in remote Daytona sandbox
async function detectRuntimeErrorsWithPlaywright(
  sandbox: any,
  projectId: string,
  sandboxUrl: string | null,
  maxRetries: number = 3,
): Promise<RuntimeError[]> {
  try {
    console.log(
      `[detectErrors] Starting runtime error detection for project ${projectId} (max retries: ${maxRetries})`,
    );

    // Get the sandbox URL
    if (!sandboxUrl) {
      console.warn(
        "[detectErrors] No sandbox URL available for runtime detection",
      );
      return [];
    }

    console.log(`[detectErrors] Checking sandbox URL: ${sandboxUrl}`);

    console.log(
      `[detectErrors] Running Playwright checks in remote Daytona sandbox...`,
    );

    // Pass URL and sandbox - sandbox is used only in production for auth
    const checkResult = await runPlaywrightRuntimeCheck(
      sandboxUrl,
      sandbox,
      maxRetries,
    );

    if (!checkResult.success) {
      console.warn(
        "[detectErrors] Playwright check failed (will continue with static analysis only):",
        checkResult.error,
      );
      // Return empty array instead of throwing - static error detection can still work
      return [];
    }

    console.log(
      `[detectErrors] Detected ${checkResult.totalErrors} runtime errors from remote sandbox`,
    );

    // Return the errors from the remote check
    return checkResult.errors || [];
  } catch (error) {
    console.warn(
      `[detectErrors] Runtime error detection failed (will continue with static analysis only):`,
      error instanceof Error ? error.message : String(error),
    );
    // Return empty array instead of throwing - static error detection can still work
    return [];
  }
}
// All sandbox operations now use daytonaAPI instead of direct sandbox access

// (helpers are implemented in ./sandbox-compat.ts)
import { V2_THEME_KEYS } from "@/app/api/chat/_prompts/v2-full-stack-prompt";
// PostHog analytics for AI tool usage tracking
// AST imports removed - now using Daytona's native replaceInFiles
import {
  getPostHogCapture,
  generateSpanId,
  getEnvironmentProperties,
} from "@/lib/posthog-capture";

// LSP imports from Daytona SDK
import { LspLanguageId } from "@daytonaio/sdk";
import * as nodePath from "path";
import fs from "fs";

// AST editing functions removed - now using Daytona's native replaceInFiles

// PostHog manual capture instance
const postHog = getPostHogCapture();

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
    console.error(`[PostHog] Failed to track span for ${toolName}:`, error);
  }
};

// Utility function to track tool usage with PostHog
const trackToolUsage = async (
  toolName: string,
  userId: string,
  projectId: string,
  input?: any,
  output?: any,
  metadata?: any,
) => {
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
    console.error(
      `[PostHog] Failed to track tool usage for ${toolName}:`,
      error,
    );
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

export type ToolsContext = {
  projectId: string;
  userId: string;
  sandbox: import("@daytonaio/sdk").Sandbox | null; // Daytona sandbox instance (DEPRECATED - use sandboxId + API)
  sandboxId: string | null; // Sandbox ID for API calls
  sandboxUrl: string | null;
  files: Map<string, { size: number; modified: number }> | null; // File metadata for change detection
  fragmentFiles: Map<string, string> | null; // Actual file content for fragment storage
  currentFragmentId?: string; // Track the current working fragment
  traceId?: string; // PostHog trace ID for analytics
  lspServers: Map<string, any> | null; // LSP server instances
  todos: TodoItem[]; // Task tracking for complex operations
};

// Helper function to create or update the current working fragment
const updateWorkingFragment = async (context: ToolsContext, action: string) => {
  const { projectId, fragmentFiles, currentFragmentId, sandbox } = context;

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
    console.log(`[updateWorkingFragment] Files modified in this session:`);
    for (const [path, content] of fragmentFiles) {
      console.log(
        `[updateWorkingFragment] - ${path} (${content.length} chars)`,
      );
      allFiles[path] = content;
    }
    console.log(
      `[updateWorkingFragment] Total files in fragment: ${
        Object.keys(allFiles).length
      }`,
    );

    // Validate fragment completeness before saving
    // if (sandbox && fragmentFiles.size > 0) {
    //   try {
    //     const validationResult = await validateFragmentCompleteness(
    //       sandbox,
    //       fragmentFiles,
    //       context,
    //     );

    //     if (!validationResult.isComplete) {
    //       console.log(
    //         `[updateWorkingFragment] Fragment completeness validation FAILED:`,
    //       );
    //       validationResult.missingDependencies.forEach((dep) =>
    //         console.log(`[updateWorkingFragment] - Missing: ${dep}`),
    //       );
    //     } else {
    //       console.log(
    //         `[updateWorkingFragment] Fragment completeness validation PASSED`,
    //       );
    //     }

    //     if (validationResult.warnings.length > 0) {
    //       console.log(`[updateWorkingFragment] Fragment validation warnings:`);
    //       validationResult.warnings.forEach((warning) =>
    //         console.log(`[updateWorkingFragment] - Warning: ${warning}`),
    //       );
    //     }
    //   } catch (validationError) {
    //     console.warn(
    //       `[updateWorkingFragment] Fragment validation failed:`,
    //       validationError,
    //     );
    //   }
    // }

    if (currentFragmentId) {
      // Check if fragment exists before trying to update
      const existingFragment = await prisma.v2Fragment.findUnique({
        where: { id: currentFragmentId },
        select: { id: true },
      });

      if (existingFragment) {
        // Update existing fragment
        const updatedFragment = await prisma.v2Fragment.update({
          where: { id: currentFragmentId },
          data: {
            files: allFiles,
            updatedAt: new Date(),
          },
        });

        console.log(
          `[updateWorkingFragment] Updated fragment ${
            updatedFragment.id
          } with ${Object.keys(allFiles).length} total files (${
            fragmentFiles.size
          } modified in session) (${action})`,
        );
      } else {
        console.warn(
          `[updateWorkingFragment] Fragment ${currentFragmentId} no longer exists, creating new fragment`,
        );
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

        console.log(
          `[updateWorkingFragment] Created new working fragment ${
            fragment.id
          } with ${Object.keys(allFiles).length} total files (${
            fragmentFiles.size
          } from session)`,
        );
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

      console.log(
        `[updateWorkingFragment] Created new working fragment ${
          fragment.id
        } with ${Object.keys(allFiles).length} total files (${
          fragmentFiles.size
        } from session)`,
      );
    }
  } catch (error) {
    console.error(
      "[updateWorkingFragment] CRITICAL: Failed to update fragment:",
      error,
    );
    console.error(
      "[updateWorkingFragment] This means file changes may not be persisted to the database!",
    );
    // Don't throw - this should not interrupt the main operation, but log as error for visibility
  }
};

export const getOrCreateSandboxTool = (context: ToolsContext) =>
  tool({
    description:
      "Get or create a sandbox where the code will be written and updated. This tool first tries to get an existing sandbox, and only creates a new one if none exists.",
    inputSchema: z.object({
      forceNew: z
        .boolean()
        .optional()
        .describe(
          "Force creation of a new sandbox even if one exists (default: false)",
        ),
    }),
    execute: async (input, { toolCallId: id }) => {
      const { projectId } = context;
      const { forceNew = false } = input;

      console.log("[getOrCreateSandboxTool] Input:", input);

      const spanId = generateSpanId();
      const startTime = Date.now();

      try {
        console.log("[createSandboxTool] Getting or creating sandbox", {
          projectId,
          forceNew,
        });

        // First, try to get an existing sandbox if not forcing new
        if (!forceNew) {
          const existingSandbox = await getSandbox(projectId);
          if (existingSandbox) {
            console.log(
              "[createSandboxTool] Found existing sandbox, reusing it",
            );

            // add sandbox info to context
            context.sandbox = existingSandbox.sandbox;
            context.sandboxId = existingSandbox.sandbox.id;
            context.sandboxUrl = existingSandbox.sandboxUrl;
            context.files = existingSandbox.files;

            // Initialize fragmentFiles if not already present
            if (!context.fragmentFiles) {
              context.fragmentFiles = new Map();
            }

            const result = {
              success: true,
              sandboxId: existingSandbox.sandbox.id,
              sandboxUrl: existingSandbox.sandboxUrl,
              sandboxExpiresAt: existingSandbox.sandboxExpiresAt,
              fileCount: existingSandbox.files.size,
              isNewSandbox: false,
              message: "Using existing sandbox",
            };

            // Track tool usage with PostHog
            await trackToolSpan(
              "getOrCreateSandbox",
              context.userId,
              context.traceId || generateSpanId(),
              input,
              result,
              {
                spanId,
                latency: (Date.now() - startTime) / 1000,
                isError: false,
              },
            );

            await trackToolUsage(
              "getOrCreateSandbox",
              context.userId,
              context.projectId,
              input,
              result,
              { action: "reused_existing" },
            );
            return result;
          }
        }

        // No existing sandbox found or forcing new - create one
        console.log("[createSandboxTool] Creating new sandbox");
        const sandboxInfo = await createSandbox(projectId);

        // add sandbox info to context
        context.sandbox = sandboxInfo.sandbox;
        context.sandboxId = sandboxInfo.sandbox.id;
        context.sandboxUrl = sandboxInfo.sandboxUrl;
        context.files = sandboxInfo.files;
        context.fragmentFiles = new Map(); // Initialize empty fragment files
        context.lspServers = new Map(); // Initialize empty LSP servers map

        const result = {
          success: true,
          sandboxId: sandboxInfo.sandbox.id,
          sandboxUrl: sandboxInfo.sandboxUrl,
          sandboxExpiresAt: sandboxInfo.sandboxExpiresAt,
          fileCount: sandboxInfo.files.size,
          isNewSandbox: true,
          message: "Created new sandbox",
        };

        // Track tool usage with PostHog
        await trackToolSpan(
          "getOrCreateSandbox",
          context.userId,
          context.traceId || generateSpanId(),
          input,
          result,
          {
            spanId,
            latency: (Date.now() - startTime) / 1000,
            isError: false,
          },
        );

        await trackToolUsage(
          "getOrCreateSandbox",
          context.userId,
          context.projectId,
          input,
          result,
          { action: "created_new" },
        );
        return result;
      } catch (error) {
        console.error("[createSandboxTool] Error:", error);
        const errorResult = {
          error: error instanceof Error ? error.message : String(error),
        };

        // Track tool usage error with PostHog
        await trackToolSpan(
          "getOrCreateSandbox",
          context.userId,
          context.traceId || generateSpanId(),
          input,
          errorResult,
          {
            spanId,
            latency: (Date.now() - startTime) / 1000,
            isError: true,
            error: errorResult.error,
          },
        );

        await trackToolUsage(
          "getOrCreateSandbox",
          context.userId,
          context.projectId,
          input,
          errorResult,
          { action: "error" },
        );
        throw error;
      }
    },
  });

// types used in our db schema
export type createSandboxInput = InferToolInput<
  ReturnType<typeof getOrCreateSandboxTool>
>;
export type createSandboxOutput = InferToolOutput<
  ReturnType<typeof getOrCreateSandboxTool>
>;

export const getSandboxTool = (context: ToolsContext) =>
  tool({
    description: "Get the sandbox",
    inputSchema: z.object({}),
    execute: async (_, { toolCallId: id }) => {
      console.log("[getSandboxTool] Input: (no parameters)");
      const { projectId } = context;

      const spanId = generateSpanId();
      const startTime = Date.now();

      try {
        const sandboxInfo = await getSandbox(projectId);

        if (!sandboxInfo) {
          throw new Error("Sandbox not found");
        }

        context.sandbox = sandboxInfo.sandbox;
        context.sandboxId = sandboxInfo.sandbox.id;
        context.sandboxUrl = sandboxInfo.sandboxUrl;
        context.files = sandboxInfo.files;

        // Initialize fragmentFiles if not already present
        if (!context.fragmentFiles) {
          context.fragmentFiles = new Map();
        }

        // Initialize lspServers if not already present
        if (!context.lspServers) {
          context.lspServers = new Map<LspLanguageId, any>();
        }

        // Track tool usage with PostHog
        await trackToolSpan(
          "getSandbox",
          context.userId,
          context.traceId || generateSpanId(),
          {},
          { success: true, sandboxId: sandboxInfo.sandbox.id },
          {
            spanId,
            latency: (Date.now() - startTime) / 1000,
            isError: false,
          },
        );

        await trackToolUsage(
          "getSandbox",
          context.userId,
          context.projectId,
          {},
          { success: true, sandboxId: sandboxInfo.sandbox.id },
        );
        return sandboxInfo;
      } catch (error) {
        const errorResult = {
          error: error instanceof Error ? error.message : String(error),
        };

        // Track tool usage error with PostHog
        await trackToolSpan(
          "getSandbox",
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
          "getSandbox",
          context.userId,
          context.projectId,
          {},
          errorResult,
        );
        throw error;
      }
    },
  });

export type getSandboxInput = InferToolInput<ReturnType<typeof getSandboxTool>>;
export type getSandboxOutput = InferToolOutput<
  ReturnType<typeof getSandboxTool>
>;

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
      console.log(
        "[readFile] Input: path =",
        path,
        "startLine =",
        startLine,
        "endLine =",
        endLine,
        "maxChars =",
        maxChars,
      );
      const { sandboxId } = context;

      console.log(
        `[readFile] Context check - sandboxId: ${sandboxId}, sandbox: ${context.sandbox ? "exists" : "null"}`,
      );

      const spanId = generateSpanId();
      const startTime = Date.now();

      try {
        if (!sandboxId) {
          console.error(`[readFile] No sandboxId in context! Full context:`, {
            sandboxId: context.sandboxId,
            hasSandbox: !!context.sandbox,
            sandboxUrl: context.sandboxUrl,
          });
          throw new Error("Sandbox not found");
        }

        // Read file from sandbox via API
        console.log(
          `[readFile] Calling daytonaAPI.readFile for sandboxId: ${sandboxId}, path: ${path}`,
        );
        const fullContent = await daytonaAPI.readFile(sandboxId, path);
        console.log(
          `[readFile] Successfully read file, length: ${fullContent.length}`,
        );
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

export type readFileInput = InferToolInput<ReturnType<typeof readFile>>;
export type readFileOutput = InferToolOutput<ReturnType<typeof readFile>>;

export const findFiles = (context: ToolsContext) =>
  tool({
    description: "Find files in the sandbox matching a text pattern",
    inputSchema: z.object({
      pattern: z.string().describe("The text pattern to search for"),
    }),
    execute: async ({ pattern }, { toolCallId: id }) => {
      console.log("[findFiles] Input: pattern =", pattern);
      const { sandboxId } = context;

      if (!sandboxId) {
        throw new Error("Sandbox not found");
      }

      const foundFiles = await daytonaAPI.findFiles(sandboxId, pattern);
      return foundFiles;
    },
  });

export type findFilesInput = InferToolInput<ReturnType<typeof findFiles>>;
export type findFilesOutput = InferToolOutput<ReturnType<typeof findFiles>>;

export const writeFile = (context: ToolsContext) =>
  tool({
    description: "Write a file to the sandbox",
    inputSchema: z.object({
      name: z.string().describe("The name of the file to write"),
      path: z
        .string()
        .describe(
          "The path to the file to write. This should be a relative path from the root of the project.",
        ),
      content: z.string().describe("The content to write to the file"),
    }),
    execute: async ({ path, content }, { toolCallId: id }) => {
      console.log(
        "[writeFile] Input: path =",
        path,
        "content length =",
        content.length,
      );
      const { sandboxId } = context;

      const spanId = generateSpanId();
      const startTime = Date.now();

      try {
        if (!sandboxId) {
          throw new Error("Sandbox not found");
        }

        // Write file to sandbox via API
        await daytonaAPI.writeFile(sandboxId, path, content);

        // CRITICAL FIX: Verify the file was actually written to the sandbox
        console.log(
          `[writeFile] Verifying file ${path} was written to sandbox...`,
        );
        let verificationAttempts = 0;
        const maxVerificationAttempts = 3;
        let fileExists = false;

        while (verificationAttempts < maxVerificationAttempts && !fileExists) {
          try {
            const writtenContent = await daytonaAPI.readFile(sandboxId, path);
            if (writtenContent === content) {
              fileExists = true;
              console.log(
                `[writeFile] ✅ File ${path} verified in sandbox (${writtenContent.length} chars)`,
              );
            } else {
              console.warn(
                `[writeFile] ⚠️ File ${path} exists but content mismatch (expected ${content.length}, got ${writtenContent.length} chars)`,
              );
            }
          } catch (readError) {
            console.warn(
              `[writeFile] ⚠️ File ${path} verification attempt ${verificationAttempts + 1} failed:`,
              readError,
            );
          }

          verificationAttempts++;
          if (!fileExists && verificationAttempts < maxVerificationAttempts) {
            // Wait briefly before retry
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }

        if (!fileExists) {
          throw new Error(
            `Failed to verify file ${path} was written to sandbox after ${maxVerificationAttempts} attempts`,
          );
        }

        // Track file metadata for change detection
        if (!context.files) {
          context.files = new Map<string, { size: number; modified: number }>();
        }
        context.files.set(path, { size: content.length, modified: Date.now() });

        // Track file content for fragment creation
        if (!context.fragmentFiles) {
          context.fragmentFiles = new Map<string, string>();
        }
        context.fragmentFiles.set(path, content);

        // Update the working fragment incrementally
        await updateWorkingFragment(context, `wrote ${path}`);

        const result = { path, success: true, size: content.length };

        // Track tool usage with PostHog
        await trackToolSpan(
          "writeFile",
          context.userId,
          context.traceId || generateSpanId(),
          { path, contentLength: content.length },
          result,
          {
            spanId,
            latency: (Date.now() - startTime) / 1000,
            isError: false,
          },
        );

        await trackToolUsage(
          "writeFile",
          context.userId,
          context.projectId,
          { path, contentLength: content.length },
          result,
        );
        return result;
      } catch (error) {
        const errorResult = {
          error: error instanceof Error ? error.message : String(error),
        };

        // Track tool usage error with PostHog
        await trackToolSpan(
          "writeFile",
          context.userId,
          context.traceId || generateSpanId(),
          { path, contentLength: content.length },
          errorResult,
          {
            spanId,
            latency: (Date.now() - startTime) / 1000,
            isError: true,
            error: errorResult.error,
          },
        );

        await trackToolUsage(
          "writeFile",
          context.userId,
          context.projectId,
          { path },
          errorResult,
        );
        throw error;
      }
    },
  });

export type writeFileInput = InferToolInput<ReturnType<typeof writeFile>>;
export type writeFileOutput = InferToolOutput<ReturnType<typeof writeFile>>;

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
      console.log(
        "[createOrEditFiles] Input: path =",
        path,
        "description =",
        description,
        "content length =",
        content.length,
      );
      const { sandboxId, fragmentFiles, currentFragmentId } = context;

      const spanId = generateSpanId();
      const startTime = Date.now();

      try {
        if (!sandboxId) {
          throw new Error("Sandbox not found");
        }

        // 🚨 CRITICAL BLOCK: Prevent editing index.css files
        if (path.endsWith("index.css") || path.includes("/index.css")) {
          const errorMsg =
            "🚨 CRITICAL SECURITY BLOCK: Editing index.css is not allowed. These templates use Tailwind v4 which relies on index.css for all styling configuration. Modifying this file can break the entire Tailwind setup, theme system, and component styling. All styling should be done through Tailwind utility classes in components instead.";
          console.error(`[createOrEditFiles] BLOCKED: ${errorMsg}`);
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
          console.error(`[createOrEditFiles] BLOCKED: ${errorMsg}`, path);
          throw new Error(errorMsg);
        }

        const modifiedFiles = new Map<string, string>();

        // Ensure fragmentFiles is initialized
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
              console.log(
                `[createOrEditFiles] Found ${
                  Object.keys(existingFragmentFiles).length
                } files in current fragment`,
              );
            }
          } catch (error) {
            console.warn(
              "[createOrEditFiles] Could not load existing fragment files:",
              error,
            );
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
            console.log(
              `[createOrEditFiles] Found ${path} in fragment (${existingContent.length} chars)`,
            );
          } else {
            // Only check sandbox if no fragment files exist at all
            // This ensures we build purely from the selected fragment when available
            if (Object.keys(existingFragmentFiles).length === 0) {
              try {
                // Read existing file from sandbox via API
                existingContent = await daytonaAPI.readFile(sandboxId, path);
                isEdit = true;
                console.log(
                  `[createOrEditFiles] Found ${path} in sandbox (${existingContent.length} chars)`,
                );
              } catch (error) {
                // File doesn't exist - this is a new file
                console.log(`[createOrEditFiles] Creating new file: ${path}`);
              }
            } else {
              // Fragment has files but this specific file doesn't exist in fragment
              // This is a new file being added to the existing fragment
              console.log(
                `[createOrEditFiles] Creating new file: ${path} (adding to existing fragment)`,
              );
            }
          }

          // Write the file to sandbox via API
          console.log(
            `[createOrEditFiles] Writing file ${path} (${content.length} chars) via API`,
          );

          // Write file via API (handles all fallback logic internally)
          await daytonaAPI.writeFile(sandboxId, path, content);

          // CRITICAL FIX: Verify the file was actually written to the sandbox
          console.log(
            `[createOrEditFiles] Verifying file ${path} was written to sandbox...`,
          );
          let verificationAttempts = 0;
          const maxVerificationAttempts = 3;
          let fileExists = false;

          while (
            verificationAttempts < maxVerificationAttempts &&
            !fileExists
          ) {
            try {
              const writtenContent = await daytonaAPI.readFile(sandboxId, path);
              if (writtenContent === content) {
                fileExists = true;
                console.log(
                  `[createOrEditFiles] ✅ File ${path} verified in sandbox (${writtenContent.length} chars)`,
                );
              } else {
                console.warn(
                  `[createOrEditFiles] ⚠️ File ${path} exists but content mismatch (expected ${content.length}, got ${writtenContent.length} chars)`,
                );
              }
            } catch (readError) {
              console.warn(
                `[createOrEditFiles] ⚠️ File ${path} verification attempt ${verificationAttempts + 1} failed:`,
                readError,
              );
            }

            verificationAttempts++;
            if (!fileExists && verificationAttempts < maxVerificationAttempts) {
              // Wait briefly before retry
              await new Promise((resolve) => setTimeout(resolve, 500));
            }
          }

          if (!fileExists) {
            throw new Error(
              `Failed to verify file ${path} was written to sandbox after ${maxVerificationAttempts} attempts`,
            );
          }

          // Track in context
          context.files.set(path, {
            size: content.length,
            modified: Date.now(),
          });
          context.fragmentFiles.set(path, content);
          modifiedFiles.set(path, content);

          console.log(
            `[createOrEditFiles] ${isEdit ? "Updated" : "Created"} ${path} (${
              content.length
            } chars) - ${description}`,
          );

          // Update the working fragment with the change
          await updateWorkingFragment(
            context,
            `${isEdit ? "updated" : "created"} ${path}`,
          );

          // Emit file creation event for React components (for real-time UI streaming)
          // Only stream files that are in the root of src/components/ and are tsx files
          // AND only for the first generation (when there are no existing fragments)
          if (
            path.endsWith(".tsx") &&
            path.startsWith("src/components/") &&
            !path.includes("/", 16)
          ) {
            // Check if this is the first generation by counting existing fragments
            const existingFragmentCount = await prisma.v2Fragment.count({
              where: { projectId: context.projectId },
            });

            // Only stream for first generation (no existing fragments)
            if (existingFragmentCount === 0) {
              redisFileStreamEmitter.emitFileCreation({
                projectId: context.projectId,
                filePath: path,
                content,
                timestamp: Date.now(),
                action: isEdit ? "updated" : "created",
              });
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
          console.error(
            `[createOrEditFiles] Failed to process ${path}:`,
            error,
          );

          const result = {
            success: false,
            path,
            action: "failed",
            description,
            error: error instanceof Error ? error.message : String(error),
            message: `Failed to process ${path}: ${
              error instanceof Error ? error.message : String(error)
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
        console.error("[createOrEditFiles] Critical error:", error);
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

export type createOrEditFilesInput = InferToolInput<
  ReturnType<typeof createOrEditFiles>
>;
export type createOrEditFilesOutput = InferToolOutput<
  ReturnType<typeof createOrEditFiles>
>;

// export const runCommand = (context: ToolsContext) =>
//   tool({
//     description:
//       "Run a command in the sandbox, only to install dependencies or run the project, do not use this to run any other command not related to the project",
//     inputSchema: z.object({
//       command: z
//         .string()
//         .describe(
//           "The command to run in the sandbox. This should be a command that is related to the project."
//         ),
//     }),
//     execute: async ({ command }, { toolCallId: id }) => {
//       const { sandbox } = context;

//       if (!sandbox) {
//         throw new Error("Sandbox not found");
//       }

//       // TODO: check if command is related to the project and safe

//       const startTime = Date.now();
//       console.log(
//         `[runCommand] Starting execution at ${startTime}: ${command}`
//       );

//       // Get file listing before command execution
//       console.log(`[runCommand] Getting file listing before command...`);
//       const beforeFiles = await getRecursiveFileList(sandbox);
//       const beforeTime = Date.now();
//       console.log(
//         `[runCommand] Before listing complete at +${
//           beforeTime - startTime
//         }ms (${beforeFiles.size} files)`
//       );

//       // Execute the command
//       let result;
//       try {
//         const commandStartTime = Date.now();
//         console.log(
//           `[runCommand] Command starting at +${
//             commandStartTime - startTime
//           }ms: ${command}`
//         );

//         result = await sandbox.commands.run(command);

//         const commandEndTime = Date.now();
//         console.log(
//           `[runCommand] Command completed at +${
//             commandEndTime - startTime
//           }ms (took ${commandEndTime - commandStartTime}ms)`
//         );
//       } catch (error) {
//         console.error(`[runCommand] Command failed:`, error);
//         throw error;
//       }

//       // Wait a moment for filesystem changes to settle
//       await new Promise((resolve) => setTimeout(resolve, 1000));

//       // Get file listing after command execution
//       console.log(`[runCommand] Getting file listing after command...`);
//       const afterFiles = await getRecursiveFileList(sandbox);
//       const afterTime = Date.now();
//       console.log(
//         `[runCommand] After listing complete at +${afterTime - startTime}ms (${
//           afterFiles.size
//         } files)`
//       );

//       // Compare before and after to detect changes
//       const fileChanges = compareFileLists(beforeFiles, afterFiles);
//       const analysisTime = Date.now();
//       console.log(
//         `[runCommand] File comparison complete at +${
//           analysisTime - startTime
//         }ms`
//       );

//       // Process the detected changes
//       const processingTime = Date.now();
//       if (fileChanges.total > 0) {
//         console.log(
//           `[runCommand] Processing ${fileChanges.total} file changes at +${
//             processingTime - startTime
//           }ms:`,
//           {
//             created: fileChanges.created.length,
//             modified: fileChanges.modified.length,
//             deleted: fileChanges.deleted.length,
//           }
//         );

//         if (!context.files) {
//           context.files = new Map<string, { size: number; modified: number }>();
//         }
//         if (!context.fragmentFiles) {
//           context.fragmentFiles = new Map<string, string>();
//         }

//         // Read content of created and modified files
//         const filesToRead = [
//           ...fileChanges.created,
//           ...fileChanges.modified,
//         ].filter((relativePath) => {
//           // Filter out unwanted files
//           return (
//             !relativePath.includes("node_modules/") &&
//             !relativePath.includes(".npm/") &&
//             !relativePath.startsWith(".") &&
//             !relativePath.endsWith("package-lock.json") &&
//             !relativePath.endsWith("pnpm-lock.yaml") &&
//             !relativePath.endsWith("yarn.lock") &&
//             !relativePath.includes(".cache/")
//           );
//         });

//         for (const relativePath of filesToRead) {
//           try {
//             const content = await sandbox.files.read(relativePath);
//             // Track metadata for change detection
//             context.files.set(relativePath, {
//               size: content.length,
//               modified: Date.now(),
//             });
//             // Track content for fragment storage
//             context.fragmentFiles.set(relativePath, content);
//             console.log(`[runCommand] Tracked file: ${relativePath}`);
//           } catch (error) {
//             // Skip directories and other unreadable files silently
//             if (
//               error instanceof Error &&
//               error.message.includes("is a directory")
//             ) {
//               continue;
//             }
//             console.warn(
//               `[runCommand] Could not read file ${relativePath}:`,
//               error
//             );
//           }
//         }

//         // Remove deleted files from both tracking maps
//         for (const relativePath of fileChanges.deleted) {
//           if (context.files && context.files.has(relativePath)) {
//             context.files.delete(relativePath);
//             console.log(
//               `[runCommand] Removed deleted file metadata: ${relativePath}`
//             );
//           }
//           if (
//             context.fragmentFiles &&
//             context.fragmentFiles.has(relativePath)
//           ) {
//             context.fragmentFiles.delete(relativePath);
//             console.log(
//               `[runCommand] Removed deleted file content: ${relativePath}`
//             );
//           }
//         }

//         // Update the working fragment with the changes
//         await updateWorkingFragment(context, `ran command: ${command}`);

//         const fragmentUpdateTime = Date.now();
//         console.log(
//           `[runCommand] Fragment updated at +${
//             fragmentUpdateTime - startTime
//           }ms`
//         );
//       } else {
//         console.log(`[runCommand] No files changed during command execution`);
//       }

//       const totalTime = Date.now();
//       console.log(
//         `[runCommand] Total execution time: ${totalTime - startTime}ms`
//       );

//       return {
//         success: true,
//         command,
//         fileChanges: {
//           created: fileChanges.created,
//           modified: fileChanges.modified,
//           deleted: fileChanges.deleted,
//           total: fileChanges.total,
//         },
//         stdout: result.stdout,
//         stderr: result.stderr,
//       };
//     },
//   });

// export type runCommandInput = InferToolInput<ReturnType<typeof runCommand>>;
// export type runCommandOutput = InferToolOutput<ReturnType<typeof runCommand>>;

export const applyTheme = (context: ToolsContext) => {
  return tool({
    description: "Apply a theme to the project",
    inputSchema: z.object({
      theme: z.string().describe("The theme to apply to the project"),
    }),
    execute: async ({ theme }, { toolCallId: id }) => {
      console.log("[applyTheme] Input: theme =", theme);
      const { sandboxId } = context;

      const spanId = generateSpanId();
      const startTime = Date.now();

      try {
        if (!sandboxId) {
          throw new Error("Sandbox not found");
        }

        const themeAllowed = V2_THEME_KEYS.includes(theme);

        if (!themeAllowed) {
          const result = {
            success: false,
            error: `Theme ${theme} is not allowed`,
          };
          return result;
        }

        console.log(`[applyTheme] Applying theme via API: ${theme}`);

        // Apply theme via API (handles shadcn installation and CSS reading)
        const apiResult = await daytonaAPI.applyTheme(sandboxId, theme);

        console.log(`[applyTheme] Theme applied successfully: ${theme}`);

        // Update fragment files with new CSS content
        if (context.fragmentFiles) {
          context.fragmentFiles.set("src/index.css", apiResult.cssContent);
        }

        // update the working fragment
        await updateWorkingFragment(context, `applied theme: ${theme}`);

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
};

export type applyThemeInput = InferToolInput<ReturnType<typeof applyTheme>>;
export type applyThemeOutput = InferToolOutput<ReturnType<typeof applyTheme>>;

export const getSandboxUrl = (context: ToolsContext) =>
  tool({
    description: "Get the sandbox url for preview and review",
    inputSchema: z.object({}),
    execute: async (_, { toolCallId: id }) => {
      console.log("[getSandboxUrl] Input: (no parameters)");
      console.log("[getSandboxUrl] sandbox url", context.sandboxUrl);
      const spanId = generateSpanId();
      const startTime = Date.now();

      try {
        if (!context.sandboxUrl) {
          throw new Error("Sandbox url not found");
        }

        console.log("[getSandboxUrl] sandbox url", context.sandboxUrl);

        const result = {
          type: "sandbox",
          url: context.sandboxUrl,
          message: `Sandbox is available at: ${context.sandboxUrl}`,
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

export type getSandboxUrlInput = InferToolInput<
  ReturnType<typeof getSandboxUrl>
>;
export type getSandboxUrlOutput = InferToolOutput<
  ReturnType<typeof getSandboxUrl>
>;

export const getFiles = (context: ToolsContext) =>
  tool({
    description:
      "Get ALL files currently in the sandbox. Use this FIRST to see what already exists before creating any files. This prevents recreating existing files like index.html, index.css, package.json, vite.config.ts, tailwind.config.js, etc. The sandbox template comes pre-configured with essential files - NEVER recreate them.",
    inputSchema: z.object({}),
    execute: async (_, { toolCallId: id }) => {
      console.log("[getFiles] Input: (no parameters)");
      const { sandboxId } = context;

      const spanId = generateSpanId();
      const startTime = Date.now();

      try {
        if (!sandboxId) {
          throw new Error("Sandbox not found");
        }

        // Get files from sandbox via API
        const filesObject = await daytonaAPI.listFiles(sandboxId);

        // Convert object to Map for consistency with existing code
        const files = new Map<string, { size: number; modified: number }>();
        Object.entries(filesObject).forEach(([path, metadata]) => {
          files.set(path, metadata);
        });

        context.files = files;

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

        return files;
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
export type getFilesInput = InferToolInput<ReturnType<typeof getFiles>>;
export type getFilesOutput = InferToolOutput<ReturnType<typeof getFiles>>;

export const validateProject = (context: ToolsContext) =>
  tool({
    description:
      "Validate the project structure, dependencies, imports, and check development server logs. Runs comprehensive lint and TypeScript checks and shows compilation errors (does NOT start dev server)",
    inputSchema: z.object({
      skipBuildCheck: z
        .boolean()
        .optional()
        .describe(
          "Skip the lint and TypeScript validation checks (default: true)",
        ),
      validateIconContext: z
        .boolean()
        .optional()
        .describe("Validate that icons match the app context (default: true)"),
      showLogs: z
        .boolean()
        .optional()
        .default(true)
        .describe(
          "Include development server logs and compilation errors in output (default: true)",
        ),
      checkContentCompleteness: z
        .boolean()
        .optional()
        .default(true)
        .describe(
          "Validate that the front page shows proper content, not just placeholder text (default: true)",
        ),
    }),
    execute: async (
      {
        skipBuildCheck = true,
        validateIconContext = true,
        showLogs = true,
        checkContentCompleteness = true,
      },
      { toolCallId: id },
    ) => {
      console.log(
        "[validateProject] Input: skipBuildCheck =",
        skipBuildCheck,
        "validateIconContext =",
        validateIconContext,
        "showLogs =",
        showLogs,
        "checkContentCompleteness =",
        checkContentCompleteness,
      );
      const { sandboxId, sandbox } = context;

      const spanId = generateSpanId();
      const startTime = Date.now();

      try {
        if (!sandboxId) {
          const result = {
            success: false,
            error: "Sandbox not found",
            validationResults: {},
            logs: "",
          };
          return result;
        }

        const validationResults = {
          fileStructure: { passed: false, issues: [] as string[] },
          imports: { passed: false, issues: [] as string[] },
          typescript: { passed: false, issues: [] as string[] },
          dependencies: { passed: false, issues: [] as string[] },
          iconContext: { passed: false, issues: [] as string[] },
          build: { passed: false, issues: [] as string[] },
          contentCompleteness: { passed: false, issues: [] as string[] },
        };

        let devServerLogs = "";
        let devServerRunning = false;

        try {
          console.log(
            "[validateProject] Starting comprehensive project validation...",
          );

          // Get development server logs and check for errors first
          if (showLogs) {
            try {
              // Check if there's a dev server running via API
              const processCheckResult = await daytonaAPI.executeCommand(
                sandboxId,
                "pgrep -f 'vite\\|npm.*dev\\|pnpm.*dev' || echo 'No dev server found'",
              );

              if (
                processCheckResult.stdout &&
                !processCheckResult.stdout.includes("No dev server found")
              ) {
                devServerRunning = true;
              }

              // Get logs from multiple sources
              const logSources = [];

              // 1. Run lint check to get immediate feedback via API
              try {
                console.log("[validateProject] Running lint check...");
                const lintResult = await daytonaAPI.executeCommand(
                  sandboxId,
                  "npm run lint",
                  { timeoutMs: 10000 },
                );

                const lintOutput =
                  (lintResult.stdout || "") + (lintResult.stderr || "");
                if (lintOutput && lintOutput.trim()) {
                  logSources.push({
                    source: "eslint check",
                    content: lintOutput,
                  });
                }
              } catch (error) {
                // Try direct eslint if npm script fails
                try {
                  const eslintResult = await daytonaAPI.executeCommand(
                    sandboxId,
                    "npx eslint src --ext .ts,.tsx,.js,.jsx",
                    { timeoutMs: 10000 },
                  );

                  const eslintOutput =
                    (eslintResult.stdout || "") + (eslintResult.stderr || "");
                  if (eslintOutput && eslintOutput.trim()) {
                    logSources.push({
                      source: "eslint direct",
                      content: eslintOutput,
                    });
                  }
                } catch (eslintError) {
                  logSources.push({
                    source: "lint check error",
                    content:
                      error instanceof Error ? error.message : String(error),
                  });
                }
              }

              // 2. Run TypeScript check for compilation errors via API
              try {
                const tscResult = await daytonaAPI.executeCommand(
                  sandboxId,
                  "npx tsc --noEmit --skipLibCheck",
                  { timeoutMs: 15000 },
                );

                const tscOutput =
                  (tscResult.stdout || "") + (tscResult.stderr || "");
                if (tscOutput && tscOutput.trim()) {
                  logSources.push({
                    source: "TypeScript check",
                    content: tscOutput,
                  });
                }
              } catch (error) {
                logSources.push({
                  source: "typescript check error",
                  content:
                    error instanceof Error ? error.message : String(error),
                });
              }

              // Attempt to fetch Daytona dev-server session logs (if sandbox object available)
              // Note: This feature requires direct sandbox access for session management
              // which hasn't been migrated to the API yet. It's optional.
              if (sandbox) {
                try {
                  // Use helper to get session and command info
                  const devStatus = await getDevServerStatus(
                    sandbox,
                    context.projectId,
                  );
                  if (
                    devStatus &&
                    devStatus.commands &&
                    devStatus.commands.length > 0
                  ) {
                    const sessionId = devStatus.sessionId;
                    const collected: string[] = [];

                    for (const cmd of devStatus.commands) {
                      try {
                        // Some command entries may not have a cmdId; skip if missing
                        const cmdId = cmd.cmdId || cmd.id || cmd.commandId;
                        if (!cmdId) continue;

                        // Attempt to read logs for each command in the dev server session
                        const logs =
                          await sandbox.process.getSessionCommandLogs(
                            sessionId,
                            cmdId,
                          );

                        const stdout = logs && logs.stdout ? logs.stdout : "";
                        const stderr = logs && logs.stderr ? logs.stderr : "";
                        const output = logs && logs.output ? logs.output : "";

                        if (stdout || stderr || output) {
                          const header = `Command: ${
                            cmd.command || cmd.name || cmdId
                          }`;
                          collected.push(
                            `${header}\n\nSTDOUT:\n${stdout}\n\nSTDERR:\n${stderr}\n\nOUTPUT:\n${output}`,
                          );
                        }
                      } catch (sessionErr) {
                        // If per-command logs fail, continue collecting other sources
                        console.warn(
                          "[validateProject] Failed to fetch session command logs:",
                          sessionErr,
                        );
                        continue;
                      }
                    }

                    if (collected.length > 0) {
                      logSources.push({
                        source: "daytona dev server session logs",
                        content: `Session: ${sessionId}\n\n${collected.join(
                          "\n\n---\n\n",
                        )}`,
                      });
                    }
                  }
                } catch (error) {
                  // Non-fatal: continue using other log sources
                  console.warn(
                    "[validateProject] Could not retrieve Daytona session logs:",
                    error,
                  );
                }
              } // End of if (sandbox) block for session logs

              // Combine all log sources
              devServerLogs = logSources
                .map(
                  (source) =>
                    `=== ${source.source.toUpperCase()} ===\n${source.content}`,
                )
                .join("\n\n");

              // If no logs found, provide helpful information
              if (!devServerLogs || devServerLogs.trim() === "") {
                devServerLogs = `No development logs found.\n\nStatus:\n- Dev server running: ${devServerRunning}`;
              }
            } catch (error) {
              devServerLogs = `Failed to get development logs: ${
                error instanceof Error ? error.message : String(error)
              }`;
            }
          }

          // Call the validation functions (requires sandbox object for advanced checks)
          // Note: These validation utilities haven't been migrated to use API yet
          if (sandbox) {
            await validateFileStructure(sandbox, validationResults, context);
            await validateComponentDependencies(
              sandbox,
              validationResults,
              context,
            );
            await validateTypeScript(sandbox, validationResults, context);
            await validateDependencies(sandbox, validationResults, context);

            if (validateIconContext) {
              await validateIconContextLogic(
                sandbox,
                validationResults,
                context,
              );
            } else {
              validationResults.iconContext.passed = true;
            }

            if (checkContentCompleteness) {
              await validateContentCompleteness(
                sandbox,
                validationResults,
                context,
              );
            } else {
              validationResults.contentCompleteness.passed = true;
            }

            if (!skipBuildCheck) {
              await validateBuild(sandbox, validationResults, context);
            } else {
              validationResults.build.passed = true;
            }
          } else {
            // Skip advanced validations if sandbox object not available
            console.warn(
              "[validateProject] Sandbox object not available, skipping advanced validation checks",
            );
            validationResults.fileStructure.passed = true;
            validationResults.imports.passed = true;
            validationResults.typescript.passed = true;
            validationResults.dependencies.passed = true;
            validationResults.iconContext.passed = true;
            validationResults.contentCompleteness.passed = true;
            validationResults.build.passed = true;
          }

          // Determine overall success
          const overallSuccess = Object.values(validationResults).every(
            (result) => result.passed,
          );

          console.log(
            `[validateProject] Overall validation: ${
              overallSuccess ? "PASSED" : "FAILED"
            }`,
          );

          const result = {
            success: overallSuccess,
            validationResults,
            logs: devServerLogs,
            devServerRunning,
            summary: {
              totalChecks: Object.keys(validationResults).length,
              passedChecks: Object.values(validationResults).filter(
                (r) => r.passed,
              ).length,
              totalIssues: Object.values(validationResults).reduce(
                (sum, r) => sum + r.issues.length,
                0,
              ),
            },
            timestamp: new Date().toISOString(),
          };

          // Track tool usage with PostHog
          await trackToolSpan(
            "validateProject",
            context.userId,
            context.traceId || generateSpanId(),
            {
              skipBuildCheck,
              validateIconContext,
              showLogs,
              checkContentCompleteness,
            },
            result,
            {
              spanId,
              latency: (Date.now() - startTime) / 1000,
              isError: false,
            },
          );

          await trackToolUsage(
            "validateProject",
            context.userId,
            context.projectId,
            {
              skipBuildCheck,
              validateIconContext,
              showLogs,
              checkContentCompleteness,
            },
            result,
            { overallSuccess },
          );

          return result;
        } catch (error) {
          console.error("[validateProject] Validation process failed:", error);
          const errorResult = {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            validationResults,
            logs: devServerLogs,
            devServerRunning: false,
            summary: {
              totalChecks: Object.keys(validationResults).length,
              passedChecks: Object.values(validationResults).filter(
                (r) => r.passed,
              ).length,
              totalIssues: Object.values(validationResults).reduce(
                (sum, r) => sum + r.issues.length,
                0,
              ),
            },
            timestamp: new Date().toISOString(),
          };

          // Track tool usage error with PostHog
          await trackToolSpan(
            "validateProject",
            context.userId,
            context.traceId || generateSpanId(),
            {
              skipBuildCheck,
              validateIconContext,
              showLogs,
              checkContentCompleteness,
            },
            errorResult,
            {
              spanId,
              latency: (Date.now() - startTime) / 1000,
              isError: true,
              error: errorResult.error,
            },
          );

          await trackToolUsage(
            "validateProject",
            context.userId,
            context.projectId,
            {
              skipBuildCheck,
              validateIconContext,
              showLogs,
              checkContentCompleteness,
            },
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
          "validateProject",
          context.userId,
          context.traceId || generateSpanId(),
          {
            skipBuildCheck,
            validateIconContext,
            showLogs,
            checkContentCompleteness,
          },
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

export type validateProjectInput = InferToolInput<
  ReturnType<typeof validateProject>
>;
export type validateProjectOutput = InferToolOutput<
  ReturnType<typeof validateProject>
>;

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
      console.log(
        "[detectErrors] Input: includeAutoFix =",
        includeAutoFix,
        "severity =",
        severity,
      );
      const { sandbox, fragmentFiles, projectId, userId, traceId } = context;

      const spanId = generateSpanId();
      const startTime = Date.now();

      try {
        if (!fragmentFiles || fragmentFiles.size === 0) {
          const result = {
            success: false,
            error: "No fragment files available for error detection",
            errors: null,
            summary: { totalErrors: 0, autoFixable: false },
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
              isError: true,
            },
          );

          return result;
        }

        console.log(
          `[detectErrors] Analyzing ${fragmentFiles.size} files for errors via API...`,
        );

        // Call the error detection API using tRPC
        const { auth } = await import("@/lib/auth");
        const { appRouter } = await import("@/trpc/routers/_app");

        const session = await auth();
        if (!session?.user?.id) {
          throw new Error("Authentication required");
        }

        const caller = appRouter.createCaller({
          session,
          userId: session.user.id,
        });

        // Call the detect procedure which uses the API
        const apiResult = await caller.errors.detect({
          projectId,
          forceRefresh: true,
        });

        const detectedErrors: ProjectErrors = apiResult.errors;

        // Track counts before filtering for logging
        const totalBeforeFilter = detectedErrors.totalErrors;

        // Log all detected errors before filtering
        if (detectedErrors.buildErrors.length > 0) {
          console.log(
            `[detectErrors] Build errors (before filtering):`,
            JSON.stringify(
              detectedErrors.buildErrors.map((e) => ({
                type: e.type,
                severity: e.severity,
                message: e.message,
                file: e.file,
                line: e.line,
              })),
              null,
              2,
            ),
          );
        }
        if (detectedErrors.importErrors.length > 0) {
          console.log(
            `[detectErrors] Import errors (before filtering):`,
            JSON.stringify(
              detectedErrors.importErrors.map((e) => ({
                type: e.type,
                severity: e.severity,
                message: e.message,
                file: e.file,
                importPath: e.importPath,
              })),
              null,
              2,
            ),
          );
        }
        if (detectedErrors.navigationErrors.length > 0) {
          console.log(
            `[detectErrors] Navigation errors (before filtering):`,
            JSON.stringify(
              detectedErrors.navigationErrors.map((e) => ({
                type: e.type,
                severity: e.severity,
                message: e.message,
                route: e.route,
                file: e.file,
              })),
              null,
              2,
            ),
          );
        }

        // Filter out LOW severity errors immediately (before UI display and storage)
        // This ensures UI shows only errors that will be stored in database
        const filterLowSeverity = (errors: any[]) =>
          errors.filter((e) => e.severity !== "LOW");

        detectedErrors.buildErrors = filterLowSeverity(
          detectedErrors.buildErrors,
        );
        detectedErrors.importErrors = filterLowSeverity(
          detectedErrors.importErrors,
        );
        detectedErrors.navigationErrors = filterLowSeverity(
          detectedErrors.navigationErrors,
        );

        // Recalculate total after filtering
        detectedErrors.totalErrors =
          detectedErrors.buildErrors.length +
          detectedErrors.importErrors.length +
          detectedErrors.navigationErrors.length;

        const filteredOutCount = totalBeforeFilter - detectedErrors.totalErrors;
        if (filteredOutCount > 0) {
          console.log(
            `[detectErrors] Filtered out ${filteredOutCount} LOW severity errors`,
          );
        }

        // Log remaining errors after filtering
        if (detectedErrors.totalErrors > 0) {
          console.log(
            `[detectErrors] Errors after filtering (${detectedErrors.totalErrors} total):`,
          );
          if (detectedErrors.buildErrors.length > 0) {
            console.log(
              `  - Build errors: ${detectedErrors.buildErrors.length}`,
            );
          }
          if (detectedErrors.importErrors.length > 0) {
            console.log(
              `  - Import errors: ${detectedErrors.importErrors.length}`,
            );
          }
          if (detectedErrors.navigationErrors.length > 0) {
            console.log(
              `  - Navigation errors: ${detectedErrors.navigationErrors.length}`,
            );
          }
        }

        // Also detect runtime errors using Playwright if sandbox is available
        if (sandbox) {
          try {
            console.log(
              "[detectErrors] Detecting runtime errors with Playwright...",
            );
            const runtimeErrors = await detectRuntimeErrorsWithPlaywright(
              sandbox,
              projectId,
              context.sandboxUrl,
            );

            // Filter out LOW severity runtime errors too
            const filteredRuntimeErrors = runtimeErrors.filter(
              (e) => e.severity !== "LOW",
            );

            detectedErrors.runtimeErrors = filteredRuntimeErrors;
            detectedErrors.totalErrors += filteredRuntimeErrors.length;

            // Update auto-fixable status if runtime errors are auto-fixable
            if (filteredRuntimeErrors.some((error) => error.autoFixable)) {
              detectedErrors.autoFixable = true;
            }

            console.log(
              `[detectErrors] Found ${
                filteredRuntimeErrors.length
              } runtime errors (${
                runtimeErrors.length - filteredRuntimeErrors.length
              } LOW severity filtered out)`,
            );
          } catch (runtimeError) {
            const errorMessage =
              runtimeError instanceof Error
                ? runtimeError.message
                : String(runtimeError);

            console.error(
              "[detectErrors] Runtime error detection failed:",
              errorMessage,
            );

            // Store the infrastructure error to include in final message
            // We'll add it to userMessage later in the response
            (detectedErrors as any).runtimeCheckError = errorMessage;

            // Continue with fragment-only analysis (build/type errors can still be detected)
          }
        }

        // Filter by severity if specified
        let filteredErrors = detectedErrors;
        if (severity) {
          const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
          const minSeverityLevel = severityOrder[severity];

          filteredErrors = {
            ...detectedErrors,
            buildErrors: detectedErrors.buildErrors.filter(
              (e) =>
                severityOrder[
                  e.severity.toLowerCase() as keyof typeof severityOrder
                ] >= minSeverityLevel,
            ),
            importErrors: detectedErrors.importErrors.filter(
              (e) =>
                severityOrder[
                  e.severity.toLowerCase() as keyof typeof severityOrder
                ] >= minSeverityLevel,
            ),
            navigationErrors: detectedErrors.navigationErrors.filter(
              (e) =>
                severityOrder[
                  e.severity.toLowerCase() as keyof typeof severityOrder
                ] >= minSeverityLevel,
            ),
            runtimeErrors: detectedErrors.runtimeErrors.filter(
              (e) =>
                severityOrder[
                  e.severity.toLowerCase() as keyof typeof severityOrder
                ] >= minSeverityLevel,
            ),
          };

          // Recalculate totals
          filteredErrors.totalErrors =
            filteredErrors.buildErrors.length +
            filteredErrors.importErrors.length +
            filteredErrors.navigationErrors.length +
            filteredErrors.runtimeErrors.length;
        }

        // Store errors in database for persistence
        if (filteredErrors.totalErrors > 0) {
          try {
            // Use the same pattern as the API route to store errors directly
            const { auth } = await import("@/lib/auth");
            const { appRouter } = await import("@/trpc/routers/_app");

            const session = await auth();
            if (session?.user?.id) {
              const caller = appRouter.createCaller({
                session,
                userId: session.user.id,
              });

              await caller.errors.storeErrors({
                projectId,
                errors: filteredErrors,
                fragmentId: context.currentFragmentId,
              });
            }
          } catch (dbError) {
            console.warn(
              "[detectErrors] Failed to store errors in database:",
              dbError,
            );
          }
        }

        // Count critical and high severity errors
        const criticalHighErrors =
          filteredErrors.buildErrors.filter(
            (e) => e.severity === "CRITICAL" || e.severity === "HIGH",
          ).length +
          filteredErrors.importErrors.filter(
            (e) => e.severity === "CRITICAL" || e.severity === "HIGH",
          ).length +
          filteredErrors.navigationErrors.filter(
            (e) => e.severity === "CRITICAL" || e.severity === "HIGH",
          ).length +
          filteredErrors.runtimeErrors.filter(
            (e) => e.severity === "CRITICAL" || e.severity === "HIGH",
          ).length;

        // Build user message with runtime check error if present
        let userMessage =
          criticalHighErrors > 0
            ? `Found ${criticalHighErrors} Critical or High Severity Errors\n\nThese will be fixed without using your credit`
            : "No critical or high severity errors found";

        // Add runtime check infrastructure error to user message if it exists
        const runtimeCheckError = (detectedErrors as any).runtimeCheckError;
        if (runtimeCheckError) {
          userMessage += `\n\n⚠️ **Runtime Check Infrastructure Error**: ${runtimeCheckError}\n\nThe Playwright runtime checker encountered an infrastructure issue. Runtime errors could not be detected. Build and type errors are still available above.`;
        }

        const result = {
          success: true,
          errors: filteredErrors,
          summary: {
            totalErrors: filteredErrors.totalErrors,
            autoFixable: filteredErrors.autoFixable,
            severity: filteredErrors.severity,
            buildErrors: filteredErrors.buildErrors.length,
            importErrors: filteredErrors.importErrors.length,
            navigationErrors: filteredErrors.navigationErrors.length,
            runtimeErrors: filteredErrors.runtimeErrors.length,
          },
          userMessage,
          autoFixSuggestions:
            includeAutoFix && filteredErrors.autoFixable
              ? "These errors can be automatically resolved using AI."
              : null,
          timestamp: new Date().toISOString(),
        };

        // Track successful detection
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
        console.error("[detectErrors] Error detection failed:", error);
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

export type detectErrorsInput = InferToolInput<ReturnType<typeof detectErrors>>;
export type detectErrorsOutput = InferToolOutput<
  ReturnType<typeof detectErrors>
>;

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
      console.log(
        "[autoFixErrors] Input: severity =",
        severity,
        "maxFixes =",
        maxFixes,
      );
      const { projectId, userId, traceId, currentFragmentId } = context;

      const spanId = generateSpanId();
      const startTime = Date.now();

      try {
        console.log(
          `[autoFixErrors] Starting background auto-fix process for project ${projectId}...`,
        );

        // 🚨 CRITICAL PRE-CHECK: Verify errors exist in database before attempting to fix
        // This ensures detectErrors was called first to populate the database
        console.log(
          `[autoFixErrors] Pre-check: Verifying errors exist in database for project ${projectId}...`,
        );

        if (!currentFragmentId) {
          const errorMsg =
            "No fragment ID available. Cannot verify errors without a fragment.";
          console.error(`[autoFixErrors] ${errorMsg}`);
          return {
            success: false,
            error: errorMsg,
            errorCount: 0,
            fixedCount: 0,
            userMessage:
              "⚠️ Auto-fix failed: No fragment available. Please ensure you have made code changes before running auto-fix.",
          };
        }

        // Check if errors exist in database for current fragment
        const existingErrors = await prisma.projectError.findMany({
          where: {
            projectId,
            fragmentId: currentFragmentId,
            severity: {
              in: ["CRITICAL", "MEDIUM"] as any[],
            },
            status: {
              in: ["DETECTED", "FIXING"] as any[],
            },
          },
          take: 1, // Just check if at least one exists
        });

        if (existingErrors.length === 0) {
          const errorMsg =
            "No errors found in database. You must run detectErrors BEFORE autoFixErrors. detectErrors stores errors in the database, which autoFixErrors then reads and fixes.";
          console.error(`[autoFixErrors] ${errorMsg}`);
          return {
            success: false,
            error: errorMsg,
            errorCount: 0,
            fixedCount: 0,
            userMessage:
              "⚠️ Auto-fix failed: No errors found in database.\n\nYou MUST run detectErrors first!\n\ndetectErrors analyzes your code and stores errors in the database.\nautoFixErrors reads those stored errors and fixes them.\n\nPlease run detectErrors, then try autoFixErrors again.",
          };
        }

        console.log(
          `[autoFixErrors] Pre-check passed: Found errors in database, proceeding with auto-fix...`,
        );

        // Call the auto-fix API using tRPC
        const { auth } = await import("@/lib/auth");
        const { appRouter } = await import("@/trpc/routers/_app");

        const session = await auth();
        if (!session?.user?.id) {
          return { success: false, error: "Authentication required" };
        }

        const caller = appRouter.createCaller({
          session,
          userId: session.user.id,
        });

        const fixResult = await caller.errors.startAutoFix({
          projectId,
        });

        const result = {
          success: fixResult.session.status === "COMPLETED",
          errorCount: fixResult.summary?.totalErrors || 0,
          fixedCount: fixResult.summary?.successfulFixes || 0,
          timestamp: new Date().toISOString(),
          // Don't include detailed fixes in response to avoid LLM context pollution
          fixes: null,
          userMessage:
            fixResult.session.status === "COMPLETED"
              ? "Successfully auto fixed Critical and High Severity Errors"
              : "Auto-fix failed to complete",
        };

        console.log(
          `[autoFixErrors] Background auto-fix complete: ${
            result.success
              ? `${result.fixedCount} errors fixed`
              : "Auto-fix failed"
          }`,
        );

        // Track successful auto-fix
        await trackToolSpan(
          "autoFixErrors",
          userId,
          traceId || generateSpanId(),
          { severity, maxFixes },
          result,
          {
            spanId,
            latency: (Date.now() - startTime) / 1000,
            isError: !result.success,
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
        console.error("[autoFixErrors] Background auto-fix failed:", error);
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

export type autoFixErrorsInput = InferToolInput<
  ReturnType<typeof autoFixErrors>
>;
export type autoFixErrorsOutput = InferToolOutput<
  ReturnType<typeof autoFixErrors>
>;

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
      console.log("[simpleMessage] Input: message =", message, "type =", type);
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
        console.error("[simpleMessage] Failed to display message:", error);
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

export type simpleMessageInput = InferToolInput<
  ReturnType<typeof simpleMessage>
>;
export type simpleMessageOutput = InferToolOutput<
  ReturnType<typeof simpleMessage>
>;

export const installPackages = (context: ToolsContext) =>
  tool({
    description:
      "Install npm packages in the sandbox. Use this to add dependencies that are needed for the application. Automatically detects the package manager (npm, pnpm, yarn, bun) and uses the appropriate command.",
    inputSchema: z.object({
      packages: z
        .array(z.string())
        .describe(
          "Array of package names to install (e.g., ['react-router-dom', 'axios'])",
        ),
      dev: z
        .boolean()
        .optional()
        .default(false)
        .describe("Install as dev dependencies (default: false)"),
    }),
    execute: async ({ packages, dev = false }, { toolCallId: id }) => {
      console.log(
        "[installPackages] Input: packages =",
        packages,
        "dev =",
        dev,
      );
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

        console.log(
          `[installPackages] Installing ${packages.length} packages via API...`,
        );

        // Install packages via API (handles package manager detection automatically)
        const result = await daytonaAPI.installPackages(
          sandboxId,
          packages,
          dev,
        );

        console.log(
          `[installPackages] Installed using ${result.packageManager}: ${result.command}`,
        );

        // Update the working fragment to track the package installation
        await updateWorkingFragment(
          context,
          `installed packages: ${packages.join(", ")}${dev ? " (dev)" : ""}`,
        );

        const installResult = {
          success: true,
          packages: result.packages,
          dev,
          packageManager: result.packageManager,
          command: result.command,
          message: `Successfully installed ${packages.length} package${packages.length > 1 ? "s" : ""} using ${result.packageManager}`,
          output: result.output,
        };

        // Track tool usage with PostHog
        await trackToolSpan(
          "installPackages",
          context.userId,
          context.traceId || generateSpanId(),
          { packages, dev, packageManager: result.packageManager },
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
          { packages, dev, packageManager: result.packageManager },
          installResult,
        );

        return installResult;
      } catch (error) {
        console.error("[installPackages] Package installation failed:", error);
        const errorResult = {
          success: false,
          packages,
          dev,
          error: error instanceof Error ? error.message : String(error),
          message: `Failed to install packages: ${error instanceof Error ? error.message : String(error)}`,
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

export type installPackagesInput = InferToolInput<
  ReturnType<typeof installPackages>
>;
export type installPackagesOutput = InferToolOutput<
  ReturnType<typeof installPackages>
>;

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
      console.log("[generateImage] Input: images count =", images.length);
      const { sandboxId, userId, projectId, traceId } = context;

      const spanId = generateSpanId();
      const startTime = Date.now();

      try {
        if (!sandboxId) {
          throw new Error("Sandbox not found");
        }

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
          error?: string;
        }> = [];

        // Ensure the images directory exists
        try {
          await daytonaAPI.executeCommand(
            sandboxId,
            "mkdir -p /home/daytona/workspace/public/images",
          );
        } catch (error) {
          console.warn(
            "[generateImage] Could not create images directory:",
            error,
          );
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

          console.log(
            `[generateImage] Generating image ${i + 1}/${images.length}: "${imageRequest.prompt}"`,
          );

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

            const data = await response.json();

            // Extract image URL from response
            const imageUrl =
              data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;

            if (!imageUrl) {
              throw new Error("No image URL in response");
            }

            // Download the image
            const imageResponse = await fetch(imageUrl);
            if (!imageResponse.ok) {
              throw new Error(
                `Failed to download image: ${imageResponse.status} ${imageResponse.statusText}`,
              );
            }

            const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
            const relativePath = `public/images/${filenameWithExt}`;

            // Save to sandbox via API (encode as base64 for transmission, decode in sandbox)
            const base64Image = imageBuffer.toString("base64");

            // Use executeCommand to write base64 and decode
            await daytonaAPI.executeCommand(
              sandboxId,
              `echo "${base64Image}" | base64 -d > /home/daytona/workspace/${relativePath}`,
            );

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

            return {
              path: `/images/${filenameWithExt}`,
              filename: filenameWithExt,
              prompt: imageRequest.prompt,
              success: true,
            };
          } catch (error) {
            console.error(
              `[generateImage] Failed to generate image ${i + 1}:`,
              error,
            );
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
          message: allSuccessful
            ? `Successfully generated ${successCount} image${successCount > 1 ? "s" : ""}`
            : `Generated ${successCount}/${images.length} images (${images.length - successCount} failed)`,
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
        console.error("[generateImage] Image generation failed:", error);
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

        await trackToolUsage(
          "generateImage",
          userId,
          projectId,
          { imageCount: images.length },
          errorResult,
        );

        throw error;
      }
    },
  });

export type generateImageInput = InferToolInput<
  ReturnType<typeof generateImage>
>;
export type generateImageOutput = InferToolOutput<
  ReturnType<typeof generateImage>
>;

export const quickEdit = (context: ToolsContext) =>
  tool({
    description:
      "Make quick, precise code edits using Daytona's native text replacement. This tool can replace specific text patterns in files efficiently. Example: [{pattern: 'const foo = 1', replacement: 'const foo = 2', description: 'Update foo value'}]",
    inputSchema: z.object({
      filePath: z
        .string()
        .describe("The path to the file to edit (relative to project root)"),
      replacements: z
        .array(
          z.object({
            pattern: z
              .string()
              .describe("The exact text pattern to search for and replace"),
            replacement: z
              .string()
              .describe("The new text to replace the pattern with"),
            description: z
              .string()
              .optional()
              .describe("Optional description of this specific replacement"),
          }),
        )
        .describe("Array of text replacements to apply"),
      description: z
        .string()
        .describe("Brief description of the changes being made"),
    }),
    execute: async (
      { filePath, replacements, description },
      { toolCallId: id },
    ) => {
      console.log(
        "[quickEdit] Input: filePath =",
        filePath,
        "replacements count =",
        replacements.length,
        "description =",
        description,
      );
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
          console.error(`[quickEdit] BLOCKED: ${errorMsg}`);
          throw new Error(errorMsg);
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
            console.warn(
              "[quickEdit] Could not load existing fragment files:",
              error,
            );
          }
        }

        // Get current file content (prefer fragment, fallback to sandbox via API)
        if (existingFragmentFiles[filePath]) {
          originalContent = existingFragmentFiles[filePath];
          console.log(
            `[quickEdit] Found ${filePath} in fragment (${originalContent.length} chars)`,
          );
        } else {
          try {
            // Read from sandbox via API
            originalContent = await daytonaAPI.readFile(sandboxId, filePath);
            console.log(
              `[quickEdit] Found ${filePath} in sandbox (${originalContent.length} chars)`,
            );
          } catch (error) {
            throw new Error(
              `File ${filePath} not found in sandbox or fragment`,
            );
          }
        }

        // Log replacement details
        console.log(
          `[quickEdit] Applying ${replacements.length} replacements to ${filePath}`,
        );
        replacements.forEach((replacement, index) => {
          console.log(`[quickEdit] Replacement ${index + 1}:`, {
            patternLength: replacement.pattern.length,
            replacementLength: replacement.replacement.length,
            description: replacement.description,
          });
        });

        // Apply replacements via API
        let editedContent = originalContent;
        let totalReplacements = 0;

        try {
          // Prepare replacements for API call
          const apiReplacements = replacements.map((r) => ({
            path: filePath,
            oldValue: r.pattern,
            newValue: r.replacement,
          }));

          // Apply all replacements via API
          console.log(`[quickEdit] Applying replacements via API...`);
          const results = await daytonaAPI.replaceInFiles(
            sandboxId,
            apiReplacements,
          );

          // Count successful replacements
          totalReplacements = results.filter((r) => r.success).length;

          // Re-read the file to get updated content
          editedContent = await daytonaAPI.readFile(sandboxId, filePath);

          console.log(
            `[quickEdit] Content modified: ${originalContent.length} -> ${editedContent.length} chars (${totalReplacements} successful replacements)`,
          );
        } catch (replacementError) {
          console.error(
            `[quickEdit] API replacement failed for ${filePath}, falling back to manual:`,
            replacementError,
          );

          // Fallback to manual replacement
          for (const replacement of replacements) {
            const { pattern, replacement: newValue } = replacement;
            const beforeLength = editedContent.length;
            editedContent = editedContent.replace(
              new RegExp(pattern, "g"),
              newValue,
            );
            const afterLength = editedContent.length;

            if (afterLength !== beforeLength) {
              totalReplacements++;
              console.log(`[quickEdit] Manual replacement applied for pattern`);
            }
          }

          // Write the manually edited content back via API
          await daytonaAPI.writeFile(sandboxId, filePath, editedContent);
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
        const result = {
          success: wasModified,
          filePath,
          action: wasModified ? "quick_edited" : "no_changes",
          description,
          replacementsApplied: totalReplacements,
          originalSize: originalContent.length,
          newSize: editedContent.length,
          sizeDelta: editedContent.length - originalContent.length,
          replacements: replacements.map((r) => ({
            pattern:
              r.pattern.substring(0, 50) + (r.pattern.length > 50 ? "..." : ""),
            replacement:
              r.replacement.substring(0, 50) +
              (r.replacement.length > 50 ? "..." : ""),
            description: r.description,
          })),
          message: wasModified
            ? `Applied ${totalReplacements} text replacements successfully`
            : `No changes made - patterns may not have been found`,
        };

        console.log(
          `[quickEdit] ${
            wasModified ? "Successfully applied" : "No changes from"
          } ${replacements.length} replacements to ${filePath} (${
            originalContent.length
          } -> ${editedContent.length} chars)`,
        );

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
        console.error(`[quickEdit] Failed to edit ${filePath}:`, error);
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

export type quickEditInput = InferToolInput<ReturnType<typeof quickEdit>>;
export type quickEditOutput = InferToolOutput<ReturnType<typeof quickEdit>>;

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
    }),
    execute: async ({ title }, { toolCallId: id }) => {
      console.log("[finalizeWorkingFragment] Input: title =", title);
      const { currentFragmentId, sandbox } = context;

      const spanId = generateSpanId();
      const startTime = Date.now();

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

        if (!sandbox) {
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

          // Create a git commit with the current changes
          const commitHash = await createGitCommit(
            sandbox,
            context.projectId,
            title,
            "Shipper AI",
            "ai@shipper.dev",
          );

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

          // Update the V2Fragment title (keeping for backward compatibility)
          const fragment = await prisma.v2Fragment.update({
            where: { id: currentFragmentId },
            data: {
              title,
              updatedAt: new Date(),
            },
          });

          // Update the project to mark this fragment as active
          // Only update gitCommitHash if a commit was actually created
          const projectUpdateData: any = {
            activeFragmentId: fragment.id,
          };
          if (commitHash) {
            projectUpdateData.gitCommitHash = commitHash;
          }

          await prisma.project.update({
            where: { id: context.projectId },
            data: projectUpdateData,
          });

          console.log(
            `[finalizeWorkingFragment] Finalized fragment ${fragment.id} with title: "${title}"`,
          );

          if (commitHash) {
            console.log(
              `[finalizeWorkingFragment] Created git commit ${commitHash} for fragment`,
            );
          } else {
            console.log(
              `[finalizeWorkingFragment] No changes to commit for fragment`,
            );
          }

          console.log(
            `[finalizeWorkingFragment] Updated project activeFragmentId to ${
              fragment.id
            }${commitHash ? ` and gitCommitHash to ${commitHash}` : ""}`,
          );

          const result = {
            success: true,
            fragmentId: fragment.id,
            gitFragmentId: null, // GitFragments are created by createGitCommit function
            commitHash,
            title: fragment.title,
            message: commitHash
              ? `Working fragment finalized as: "${title}" with git commit ${commitHash}`
              : `Working fragment finalized as: "${title}" (no changes to commit)`,
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
          console.error(
            "[finalizeWorkingFragment] Failed to finalize fragment:",
            error,
          );
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

export type finalizeWorkingFragmentInput = InferToolInput<
  ReturnType<typeof finalizeWorkingFragment>
>;
export type finalizeWorkingFragmentOutput = InferToolOutput<
  ReturnType<typeof finalizeWorkingFragment>
>;

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
      console.log("[manageTodos] Input: action =", action);
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
            console.log(
              `[manageTodos] Created ${newTodos.length} todos:`,
              newTodos.map((t) => `${t.id}: ${t.title} [${t.status}]`),
            );
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

                console.log(
                  `[manageTodos] Updated todo ${inputTodo.id}: ${inputTodo.title} -> ${inputTodo.status}`,
                );
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
            console.log(
              `[manageTodos] Listed todos: ${context.todos.length} total`,
              result.summary,
            );
            break;

          case "clear":
            const clearedCount = context.todos.length;
            context.todos = [];
            result.todos = [];
            result.message = `Cleared ${clearedCount} todo(s)`;
            console.log(`[manageTodos] Cleared all todos (${clearedCount})`);
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
        console.error("[manageTodos] Failed:", error);
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

export type manageTodosInput = InferToolInput<ReturnType<typeof manageTodos>>;
export type manageTodosOutput = InferToolOutput<ReturnType<typeof manageTodos>>;

export const tools = (context: ToolsContext) => ({
  // getOrCreateSandbox: getOrCreateSandboxTool(context), // Disabled: sandbox is now manually initialized in chat API route
  // findFiles: findFiles(context), // this seems to break the context window for some reason
  readFile: readFile(context),
  // writeFile: writeFile(context), // Disabled: use createOrEditFiles instead for context awareness
  createOrEditFiles: createOrEditFiles(context),
  quickEdit: quickEdit(context),
  installPackages: installPackages(context),
  generateImage: generateImage(context),
  // runCommand: runCommand(context),
  // applyTheme: applyTheme(context),
  getSandboxUrl: getSandboxUrl(context),
  getFiles: getFiles(context),
  // validateProject: validateProject(context),
  // validateProject: detectErrors(context),
  detectErrors: detectErrors(context), // Now uses remote Daytona Playwright sandbox
  autoFixErrors: autoFixErrors(context),

  manageTodos: manageTodos(context),
  simpleMessage: simpleMessage(context),
  finalizeWorkingFragment: finalizeWorkingFragment(context),
});

export const toolNames = Object.keys(tools({} as ToolsContext)) as Array<
  keyof ReturnType<typeof tools>
>;
