import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { prisma } from "@/lib/db";
import { daytonaAPI } from "@/lib/api/daytona-client";
import { ErrorType, ErrorSeverity, ErrorStatus, AutoFixStatus } from "@/lib/db";
import { ErrorClassifier } from "@/lib/error-classifier";
import { CLEAR_VITE_CACHE_COMMAND } from "@shipper/shared";

export const errorsRouter = createTRPCRouter({
  /**
   * Detect errors in a project
   */
  detect: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        forceRefresh: z.boolean().optional().default(false),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { projectId, forceRefresh } = input;
      const userId = ctx.user.id;

      console.log(`[ErrorsAPI] Detecting errors for project ${projectId}`);

      try {
        // Check if user has access to project
        const project = await prisma.project.findFirst({
          where: {
            id: projectId,
            OR: [
              { userId }, // Personal project
              { team: { members: { some: { userId } } } }, // Team project
            ],
          },
        });

        if (!project) {
          throw new Error("Project not found or access denied");
        }

        // Get the latest V2Fragment for error detection
        const latestFragment = await prisma.v2Fragment.findFirst({
          where: { projectId },
          orderBy: { createdAt: "desc" },
          select: { id: true, title: true, files: true },
        });

        if (!latestFragment || !latestFragment.files) {
          // Return empty results if no fragment found
          return {
            success: true,
            errors: {
              buildErrors: [],
              runtimeErrors: [],
              importErrors: [],
              navigationErrors: [],
              severity: "low" as const,
              autoFixable: false,
              totalErrors: 0,
              detectedAt: new Date(),
            },
            classification: {
              categories: {
                quickFix: [],
                mediumFix: [],
                complexFix: [],
                unfixable: [],
              },
              strategies: [],
              overallComplexity: "simple" as const,
              estimatedFixTime: 0,
              successConfidence: 1.0,
              recommendedApproach: "auto-fix" as const,
            },
            storedErrors: [],
            autoFixSession: null,
            canAutoFix: false,
            fragmentId: null,
            fragmentTitle: null,
          };
        }

        console.log(
          `[ErrorsAPI] Analyzing V2Fragment ${latestFragment.id} with ${
            Object.keys(latestFragment.files as { [path: string]: string })
              .length
          } files using API hybrid approach`,
        );

        // Use API for hybrid error detection (fragment + project build)
        // The API handles sandbox availability and fallback automatically
        const apiResult = await daytonaAPI.detectHybridErrors(
          projectId,
          latestFragment.id,
        );

        const detectedErrors = apiResult.errors;
        const classification = apiResult.classification;
        const analysisType = apiResult.analysisType;

        // Store errors in database with fragment link (excluding LOW severity)
        const storedErrors = await storeProjectErrors(
          projectId,
          detectedErrors,
          latestFragment.id,
          true, // excludeLowSeverity
        );

        // Create auto-fix session if errors are auto-fixable
        let autoFixSession = null;
        if (detectedErrors.autoFixable && detectedErrors.totalErrors > 0) {
          autoFixSession = await createAutoFixSession(
            projectId,
            userId,
            storedErrors,
          );
        }

        console.log(
          `[ErrorsAPI] Detected ${detectedErrors.totalErrors} errors for project ${projectId}`,
        );

        return {
          success: true,
          errors: detectedErrors,
          classification,
          storedErrors,
          autoFixSession,
          canAutoFix: detectedErrors.autoFixable,
          fragmentId: latestFragment.id,
          fragmentTitle: latestFragment.title,
          analysisType,
        };
      } catch (error) {
        console.error("[ErrorsAPI] Error detection failed:", error);
        throw new Error(
          `Error detection failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        );
      }
    }),

  /**
   * Get current errors for a project
   */
  getProjectErrors: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { projectId } = input;
      const userId = ctx.user.id;

      try {
        // Check project access
        const project = await prisma.project.findFirst({
          where: {
            id: projectId,
            OR: [{ userId }, { team: { members: { some: { userId } } } }],
          },
        });

        if (!project) {
          throw new Error("Project not found or access denied");
        }

        // Get the latest V2Fragment for context
        const latestFragment = await prisma.v2Fragment.findFirst({
          where: { projectId },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        });

        // Get recent errors - prioritize those from the current fragment and exclude LOW priority
        const errors = await prisma.projectError.findMany({
          where: {
            projectId,
            status: {
              in: [ErrorStatus.DETECTED, ErrorStatus.FIXING],
            },
            severity: {
              not: ErrorSeverity.LOW, // Exclude LOW priority errors from the display
            },
          },
          orderBy: [
            { severity: "desc" }, // Critical first, then medium
            { detectedAt: "desc" },
          ],
          take: 50,
        });

        // Get active auto-fix sessions
        const activeSessions = await prisma.autoFixSession.findMany({
          where: {
            projectId,
            status: {
              in: [AutoFixStatus.STARTED, AutoFixStatus.IN_PROGRESS],
            },
          },
          orderBy: {
            startedAt: "desc",
          },
          take: 5,
        });

        return {
          errors,
          activeSessions,
          totalErrors: errors.length,
        };
      } catch (error) {
        console.error("[ErrorsAPI] Failed to get project errors:", error);
        throw new Error(
          `Failed to get project errors: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        );
      }
    }),

  /**
   * Get error classification for a project
   */
  getErrorClassification: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { projectId } = input;
      const userId = ctx.user.id;

      try {
        // Check project access
        const project = await prisma.project.findFirst({
          where: {
            id: projectId,
            OR: [{ userId }, { team: { members: { some: { userId } } } }],
          },
        });

        if (!project) {
          throw new Error("Project not found or access denied");
        }

        // Get recent errors and classify them
        const errors = await prisma.projectError.findMany({
          where: {
            projectId,
            status: ErrorStatus.DETECTED,
          },
          orderBy: {
            detectedAt: "desc",
          },
        });

        // Convert to ProjectErrors format for classification
        const projectErrors = convertToProjectErrors(errors);
        const classification = ErrorClassifier.categorizeErrors(projectErrors);

        return {
          classification,
          errorCount: errors.length,
          lastUpdated: errors[0]?.detectedAt || null,
        };
      } catch (error) {
        console.error("[ErrorsAPI] Failed to get error classification:", error);
        throw new Error(
          `Failed to get error classification: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        );
      }
    }),

  /**
   * Acknowledge/resolve an error
   */
  acknowledgeError: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        errorId: z.string(),
        action: z.enum(["resolved", "ignored"]),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { projectId, errorId, action } = input;
      const userId = ctx.user.id;

      try {
        // Check project access
        const project = await prisma.project.findFirst({
          where: {
            id: projectId,
            OR: [{ userId }, { team: { members: { some: { userId } } } }],
          },
        });

        if (!project) {
          throw new Error("Project not found or access denied");
        }

        // Update error status
        const updatedError = await prisma.projectError.update({
          where: {
            id: errorId,
            projectId,
          },
          data: {
            status:
              action === "resolved"
                ? ErrorStatus.RESOLVED
                : ErrorStatus.IGNORED,
            resolvedAt: action === "resolved" ? new Date() : null,
          },
        });

        console.log(
          `[ErrorsAPI] Error ${errorId} ${action} for project ${projectId}`,
        );

        return {
          success: true,
          error: updatedError,
        };
      } catch (error) {
        console.error("[ErrorsAPI] Failed to acknowledge error:", error);
        throw new Error(
          `Failed to acknowledge error: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        );
      }
    }),

  /**
   * Get auto-fix session status
   */
  getAutoFixSession: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        sessionId: z.string().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { projectId, sessionId } = input;
      const userId = ctx.user.id;

      try {
        // Check project access
        const project = await prisma.project.findFirst({
          where: {
            id: projectId,
            OR: [{ userId }, { team: { members: { some: { userId } } } }],
          },
        });

        if (!project) {
          throw new Error("Project not found or access denied");
        }

        // Get auto-fix session
        const session = await prisma.autoFixSession.findFirst({
          where: {
            id: sessionId,
            projectId,
            userId,
          },
          include: {
            projectErrors: true,
          },
        });

        if (!session) {
          throw new Error("Auto-fix session not found");
        }

        return {
          session,
        };
      } catch (error) {
        console.error("[ErrorsAPI] Failed to get auto-fix session:", error);
        throw new Error(
          `Failed to get auto-fix session: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        );
      }
    }),

  /**
   * Start auto-fix workflow with VoltAgent
   */
  startAutoFix: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { projectId } = input;
      const userId = ctx.user.id;

      console.log(`[ErrorsAPI] Starting auto-fix for project ${projectId}`);

      try {
        // Check project access
        const project = await prisma.project.findFirst({
          where: {
            id: projectId,
            OR: [{ userId }, { team: { members: { some: { userId } } } }],
          },
        });

        if (!project) {
          throw new Error("Project not found or access denied");
        }

        // Get the latest V2Fragment for the project
        const latestFragment = await prisma.v2Fragment.findFirst({
          where: { projectId },
          orderBy: { createdAt: "desc" },
          select: { id: true, title: true, files: true },
        });

        if (!latestFragment || !latestFragment.files) {
          throw new Error("No fragment found with files to fix");
        }

        // Use API for auto-fix (handles error detection, VoltAgent, and fragment creation)
        console.log(
          `[ErrorsAPI] Calling API to auto-fix errors for project ${projectId}`,
        );

        const apiResult = await daytonaAPI.autoFixErrors(
          projectId,
          latestFragment.id,
        );

        const { fixResults, summary, newFragmentId } = apiResult;

        // Create auto-fix session for tracking
        const autoFixSession = await prisma.autoFixSession.create({
          data: {
            projectId,
            userId,
            errorsDetected: [],
            fixesApplied: fixResults.filter((r) => r.success),
            status: AutoFixStatus.COMPLETED,
            totalErrors: summary.totalErrors,
            successfulFixes: summary.successfulFixes,
            failedFixes: summary.failedFixes,
            successRate: summary.successRate,
            completedAt: new Date(),
          },
        });

        console.log(
          `[ErrorsAPI] Auto-fix completed: ${summary.successfulFixes}/${summary.totalErrors} errors fixed (${summary.successRate.toFixed(1)}%)`,
        );

        // If fixes were successful and we have a new fragment, restore it to the sandbox
        if (newFragmentId && summary.successfulFixes > 0) {
          const { getSandbox } = await import("@/lib/daytona-sandbox-manager");
          const sandboxInfo = await getSandbox(projectId);

          if (sandboxInfo?.sandbox) {
            console.log(
              `[ErrorsAPI] Restoring fixed fragment ${newFragmentId} to sandbox`,
            );

            const { restoreV2FragmentInSandbox } = await import(
              "@/lib/daytona-sandbox-manager"
            );

            await restoreV2FragmentInSandbox(
              sandboxInfo.sandbox,
              newFragmentId,
              projectId,
            );

            console.log(
              `[ErrorsAPI] Successfully restored fixed fragment to sandbox`,
            );
          } else {
            console.warn(
              `[ErrorsAPI] No sandbox available to restore fixed fragment`,
            );
          }

          // Update project's active fragment
          await prisma.project.update({
            where: { id: projectId },
            data: { activeFragmentId: newFragmentId },
          });
        }

        return {
          session: autoFixSession,
          fixResults,
          summary,
          newFragmentId,
        };
      } catch (error) {
        console.error("[ErrorsAPI] Auto-fix failed:", error);

        // Update session status to failed if session was created
        const failedSessions = await prisma.autoFixSession.findMany({
          where: {
            projectId,
            userId,
            status: AutoFixStatus.IN_PROGRESS,
          },
          orderBy: {
            startedAt: "desc",
          },
          take: 1,
        });

        if (failedSessions.length > 0) {
          await prisma.autoFixSession.update({
            where: { id: failedSessions[0].id },
            data: {
              status: AutoFixStatus.FAILED,
              completedAt: new Date(),
            },
          });
        }

        throw new Error(
          `Auto-fix failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        );
      }
    }),

  /**
   * Store detected errors for a project
   */
  storeErrors: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        errors: z.any(), // ProjectErrors object
        fragmentId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { projectId, errors, fragmentId } = input;
      const userId = ctx.user.id;

      try {
        // Check project access
        const project = await prisma.project.findFirst({
          where: {
            id: projectId,
            OR: [{ userId }, { team: { members: { some: { userId } } } }],
          },
        });

        if (!project) {
          throw new Error("Project not found or access denied");
        }

        // If no fragmentId provided, get the latest one
        const targetFragmentId =
          fragmentId ||
          (
            await prisma.v2Fragment.findFirst({
              where: { projectId },
              orderBy: { createdAt: "desc" },
              select: { id: true },
            })
          )?.id;

        if (!targetFragmentId) {
          throw new Error("No fragment found for error storage");
        }

        // Store errors in database with fragment link (excluding LOW severity)
        const storedErrors = await storeProjectErrors(
          projectId,
          errors,
          targetFragmentId,
          true, // excludeLowSeverity
        );

        // Create auto-fix session if errors are auto-fixable
        let autoFixSession = null;
        if (errors.autoFixable && errors.totalErrors > 0) {
          autoFixSession = await createAutoFixSession(
            projectId,
            userId,
            storedErrors,
          );
        }

        return {
          storedErrors,
          autoFixSession,
        };
      } catch (error) {
        console.error("[ErrorsAPI] Error storing errors:", error);
        throw new Error(
          `Error storage failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        );
      }
    }),

  /**
   * Store runtime errors detected from iframe monitoring
   */
  storeRuntimeErrors: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        runtimeErrors: z.array(z.any()), // Array of RuntimeError objects
        fragmentId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { projectId, runtimeErrors, fragmentId } = input;
      const userId = ctx.user.id;

      try {
        // Check project access
        const project = await prisma.project.findFirst({
          where: {
            id: projectId,
            OR: [{ userId }, { team: { members: { some: { userId } } } }],
          },
        });

        if (!project) {
          throw new Error("Project not found or access denied");
        }

        // If no fragmentId provided, get the latest one
        const targetFragmentId =
          fragmentId ||
          (
            await prisma.v2Fragment.findFirst({
              where: { projectId },
              orderBy: { createdAt: "desc" },
              select: { id: true },
            })
          )?.id;

        if (!targetFragmentId) {
          throw new Error("No fragment found for runtime error storage");
        }

        // Store runtime errors in database (excluding LOW severity)
        const storedErrors = await storeProjectErrors(
          projectId,
          {
            runtimeErrors,
            buildErrors: [],
            importErrors: [],
            navigationErrors: [],
          },
          targetFragmentId,
          true, // excludeLowSeverity
        );

        console.log(
          `[ErrorsAPI] Stored ${storedErrors.length} runtime errors for project ${projectId}`,
        );

        return {
          storedErrors,
          success: true,
        };
      } catch (error) {
        console.error("[ErrorsAPI] Error storing runtime errors:", error);
        throw new Error(
          `Runtime error storage failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        );
      }
    }),
});

/**
 * Helper function to store project errors in database
 */
async function storeProjectErrors(
  projectId: string,
  errors: any,
  fragmentId: string,
  excludeLowSeverity: boolean = true,
): Promise<any[]> {
  const storedErrors: any[] = [];

  // First, clear any existing errors for this fragment to prevent duplicates
  console.log(
    `[storeProjectErrors] Clearing existing errors for fragment ${fragmentId}`,
  );
  await prisma.projectError.deleteMany({
    where: {
      projectId,
      fragmentId,
      status: {
        in: [ErrorStatus.DETECTED, ErrorStatus.FIXING], // Only clear unresolved errors
      },
    },
  });

  // Helper function to store errors of a specific type
  const storeErrorsOfType = async (errorList: any[], errorType: any) => {
    for (const error of errorList) {
      // Skip LOW severity errors if flag is set
      if (excludeLowSeverity && error.severity === ErrorSeverity.LOW) {
        console.log(
          `[storeProjectErrors] Skipping LOW severity error: ${error.message}`,
        );
        continue;
      }

      const stored = await prisma.projectError.create({
        data: {
          projectId,
          fragmentId,
          errorType,
          errorDetails: error,
          severity: error.severity,
          autoFixable: error.autoFixable,
          status: ErrorStatus.DETECTED,
        },
      });
      storedErrors.push(stored);
    }
  };

  // Store each type of error
  await storeErrorsOfType(errors.buildErrors, ErrorType.BUILD);
  await storeErrorsOfType(errors.importErrors, ErrorType.IMPORT);
  await storeErrorsOfType(errors.navigationErrors, ErrorType.NAVIGATION);
  await storeErrorsOfType(errors.runtimeErrors, ErrorType.RUNTIME);

  const totalErrorsBeforeFilter =
    errors.buildErrors.length +
    errors.importErrors.length +
    errors.navigationErrors.length +
    errors.runtimeErrors.length;

  console.log(
    `[storeProjectErrors] Stored ${storedErrors.length} errors for fragment ${fragmentId}` +
      (excludeLowSeverity
        ? ` (excluded LOW severity, ${
            totalErrorsBeforeFilter - storedErrors.length
          } filtered out)`
        : ""),
  );
  return storedErrors;
}

/**
 * Helper function to create auto-fix session
 */
async function createAutoFixSession(
  projectId: string,
  userId: string,
  errors: any[],
) {
  const session = await prisma.autoFixSession.create({
    data: {
      projectId,
      userId,
      errorsDetected: errors.map((e) => e.id),
      fixesApplied: [],
      status: AutoFixStatus.STARTED,
      totalErrors: errors.length,
    },
  });

  return session;
}

/**
 * Helper function to apply fixes to the sandbox
 */
async function applyFixesToSandbox(projectId: string, successfulFixes: any[]) {
  try {
    console.log(
      `[ErrorsAPI] Applying ${successfulFixes.length} fixes to sandbox for project ${projectId}`,
    );

    // Get the project's sandbox information with retry logic
    let project = null;
    let retryCount = 0;
    const maxRetries = 3;

    while (!project && retryCount < maxRetries) {
      try {
        project = await prisma.project.findUnique({
          where: { id: projectId },
          select: { sandboxId: true },
        });

        if (project) {
          console.log(
            `[ErrorsAPI] Project query successful on attempt ${
              retryCount + 1
            }:`,
            project,
          );
          break;
        }
      } catch (error) {
        console.warn(
          `[ErrorsAPI] Project query attempt ${retryCount + 1} failed:`,
          error,
        );
      }

      retryCount++;
      if (retryCount < maxRetries) {
        console.log(`[ErrorsAPI] Retrying project query in 500ms...`);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    if (!project?.sandboxId) {
      console.warn(
        `[ErrorsAPI] No sandbox found for project ${projectId} after ${maxRetries} attempts`,
      );
      return;
    }

    // Collect all fixed files from successful fixes
    const allFixedFiles: { [path: string]: string } = {};

    for (const fix of successfulFixes) {
      if (fix.fixedFiles && typeof fix.fixedFiles === "object") {
        for (const [filePath, newContent] of Object.entries(fix.fixedFiles)) {
          allFixedFiles[filePath as string] = newContent as string;
          console.log(`[ErrorsAPI] Prepared fix for sandbox file: ${filePath}`);
        }
      }
    }

    // Apply all fixes to the sandbox using Daytona sandbox manager
    if (Object.keys(allFixedFiles).length > 0) {
      const { getSandbox } = await import("@/lib/daytona-sandbox-manager");

      console.log(
        `[ErrorsAPI] Attempting to get sandbox for project ${projectId}`,
      );

      // Retry logic for sandbox connection
      let sandboxInfo = null;
      let retryCount = 0;
      const maxRetries = 3;

      while (!sandboxInfo && retryCount < maxRetries) {
        try {
          sandboxInfo = await getSandbox(projectId);
          if (sandboxInfo) {
            console.log(
              `[ErrorsAPI] Successfully got sandbox on attempt ${
                retryCount + 1
              }`,
            );
            break;
          }
        } catch (error) {
          console.warn(
            `[ErrorsAPI] Attempt ${retryCount + 1} failed to get sandbox:`,
            error,
          );
        }

        retryCount++;
        if (retryCount < maxRetries) {
          console.log(`[ErrorsAPI] Retrying sandbox connection in 1 second...`);
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      if (!sandboxInfo) {
        console.error(
          `[ErrorsAPI] Failed to get sandbox for project ${projectId} after ${maxRetries} attempts`,
        );
        throw new Error("Sandbox not found");
      }

      console.log(
        `[ErrorsAPI] Successfully got sandbox ${sandboxInfo.sandbox.id} for project ${projectId}`,
      );
      const sandbox = sandboxInfo.sandbox;

      // Write files directly to sandbox using Daytona API
      let updatedFiles = 0;
      for (const [filePath, content] of Object.entries(allFixedFiles)) {
        try {
          const workspacePath = `/home/daytona/workspace/${filePath}`;
          console.log(
            `[ErrorsAPI] Writing fix to sandbox: ${filePath} -> ${workspacePath} (${content.length} chars)`,
          );
          await sandbox.fs.uploadFile(Buffer.from(content), workspacePath);
          updatedFiles++;
          console.log(
            `[ErrorsAPI] ✅ Successfully wrote fix to sandbox: ${filePath}`,
          );

          // Verify the file was written by reading it back
          try {
            const writtenFile = await sandbox.fs.downloadFile(workspacePath);
            const writtenContent = writtenFile.toString();
            console.log(
              `[ErrorsAPI] ✅ Verified file written: ${filePath} (${writtenContent.length} chars)`,
            );
            if (writtenContent !== content) {
              console.warn(
                `[ErrorsAPI] ⚠️ File content mismatch for ${filePath}`,
              );
            }
          } catch (verifyError) {
            console.error(
              `[ErrorsAPI] ❌ Failed to verify file ${filePath}:`,
              verifyError,
            );
          }
        } catch (error) {
          console.error(
            `[ErrorsAPI] ❌ Failed to write fix to sandbox ${filePath}:`,
            error,
          );
        }
      }

      const result = { success: true, updatedFiles };

      if (result.success) {
        console.log(
          `[ErrorsAPI] Successfully applied ${result.updatedFiles} fixes to sandbox ${project.sandboxId}`,
        );

        // Trigger a dev server restart to ensure changes are picked up
        try {
          // Use the same sandbox instance we already have

          // Restart the dev server to pick up the changes
          console.log(`[ErrorsAPI] Restarting dev server to pick up AI fixes`);

          // Check if dev server is running before killing
          try {
            const checkResult = await sandbox.process.executeCommand(
              "ps aux | grep -E '(bun dev|vite|node.*vite)' | grep -v grep",
              "/home/daytona/workspace",
            );
            console.log(`[ErrorsAPI] Dev server check: ${checkResult.result}`);
          } catch (e) {
            console.log(`[ErrorsAPI] Dev server check failed:`, e);
          }

          // Kill existing dev server processes
          const killCommands = [
            "pkill -f 'bun dev' || true",
            "pkill -f 'vite' || true",
            "pkill -f 'node.*vite' || true",
          ];

          for (const cmd of killCommands) {
            try {
              const killResult = await sandbox.process.executeCommand(
                cmd,
                "/home/daytona/workspace",
              );
              console.log(
                `[ErrorsAPI] Kill command '${cmd}' result: ${killResult.result}`,
              );
            } catch (e) {
              console.log(`[ErrorsAPI] Kill command '${cmd}' failed:`, e);
            }
          }

          await new Promise((resolve) => setTimeout(resolve, 2000));

          // Start new dev server using the same method as DaytonaSandboxManager
          try {
            const devServerSessionId = `dev-server-${projectId}`;

            // Delete existing session if it exists
            try {
              await sandbox.process.deleteSession(devServerSessionId);
              console.log(
                `[ErrorsAPI] Deleted existing dev server session: ${devServerSessionId}`,
              );
            } catch (e) {
              console.log(`[ErrorsAPI] No existing session to delete:`, e);
            }

            // Create new session
            await sandbox.process.createSession(devServerSessionId);
            console.log(
              `[ErrorsAPI] Created new dev server session: ${devServerSessionId}`,
            );

            // Change to workspace directory
            await sandbox.process.executeSessionCommand(devServerSessionId, {
              command: "cd /home/daytona/workspace",
            });

            // Clear Vite cache and touch CSS file to force Tailwind CSS rebuild
            // This prevents stale Tailwind styles when sandbox is recreated from snapshot
            await sandbox.process.executeSessionCommand(devServerSessionId, {
              command: CLEAR_VITE_CACHE_COMMAND,
            });

            // Start the dev server in the background
            const startResult = await sandbox.process.executeSessionCommand(
              devServerSessionId,
              {
                command: "bun dev",
                async: true,
              },
            );
            console.log(
              `[ErrorsAPI] Start dev server result: ${JSON.stringify(
                startResult,
              )}`,
            );
          } catch (sessionError) {
            console.error(
              `[ErrorsAPI] Failed to start dev server with session:`,
              sessionError,
            );

            // Fallback to simple command
            const startResult = await sandbox.process.executeCommand(
              "cd /home/daytona/workspace && nohup bun dev > /dev/null 2>&1 &",
              "/home/daytona",
            );
            console.log(
              `[ErrorsAPI] Fallback start dev server result: ${startResult.result}`,
            );
          }

          await new Promise((resolve) => setTimeout(resolve, 5000));

          // Verify dev server is running
          try {
            const verifyResult = await sandbox.process.executeCommand(
              "ps aux | grep -E '(bun dev|vite|node.*vite)' | grep -v grep",
              "/home/daytona/workspace",
            );
            console.log(
              `[ErrorsAPI] Dev server verify: ${verifyResult.result}`,
            );
          } catch (e) {
            console.log(`[ErrorsAPI] Dev server verify failed:`, e);
          }

          console.log(`[ErrorsAPI] Dev server restart completed`);
        } catch (restartError) {
          console.warn(
            `[ErrorsAPI] Failed to restart dev server:`,
            restartError,
          );
          // Don't throw - the files are still updated, just might need manual refresh
        }
      } else {
        console.error(
          `[ErrorsAPI] Failed to apply fixes to sandbox: ${JSON.stringify(
            result,
          )}`,
        );
        throw new Error(`Failed to update sandbox files: ${result}`);
      }
    } else {
      console.log(`[ErrorsAPI] No files to update in sandbox`);
    }
  } catch (error) {
    console.error("[ErrorsAPI] Failed to apply fixes to sandbox:", error);
    throw error;
  }
}

/**
 * Helper function to apply fixes to a V2Fragment
 */
async function applyFixesToFragment(
  projectId: string,
  latestFragment: any,
  successfulFixes: any[],
) {
  try {
    console.log(
      `[ErrorsAPI] Applying ${successfulFixes.length} fixes to fragment ${latestFragment.id}`,
    );

    // Create a new fragment with the fixed files
    const originalFiles = latestFragment.files as { [path: string]: string };
    const updatedFiles = { ...originalFiles };

    // Apply each fix to the files
    for (const fix of successfulFixes) {
      if (fix.fixedFiles && typeof fix.fixedFiles === "object") {
        console.log(
          `[ErrorsAPI] Fix contains files:`,
          Object.keys(fix.fixedFiles),
        );
        for (const [filePath, newContent] of Object.entries(fix.fixedFiles)) {
          // Normalize file path to handle duplicates (remove absolute prefixes)
          const normalizedPath = filePath
            .replace(/^\/home\/daytona\/workspace\//, "")
            .replace(/^\//, "");

          // Update ALL variations of this file path to prevent duplicates
          const pathVariations = [
            normalizedPath, // src/App.tsx
            `/${normalizedPath}`, // /src/App.tsx
            `/home/daytona/workspace/${normalizedPath}`, // /home/daytona/workspace/src/App.tsx
          ];

          for (const pathVariation of pathVariations) {
            if (updatedFiles[pathVariation] !== undefined) {
              updatedFiles[pathVariation] = newContent as string;
              console.log(
                `[ErrorsAPI] Updated path variation: ${pathVariation}`,
              );
            }
          }

          // Also ensure the normalized path exists
          updatedFiles[normalizedPath] = newContent as string;

          console.log(
            `[ErrorsAPI] Applied fix to file: ${filePath} -> ${normalizedPath} (${
              (newContent as string).length
            } chars)`,
          );
          console.log(
            `[ErrorsAPI] File content preview:`,
            (newContent as string).substring(0, 200) + "...",
          );
        }
      }
    }

    console.log(
      `[ErrorsAPI] Fragment files before update:`,
      Object.keys(originalFiles),
    );
    console.log(
      `[ErrorsAPI] Fragment files after update:`,
      Object.keys(updatedFiles),
    );

    // Create a new V2Fragment with the fixed files
    const newFragment = await prisma.v2Fragment.create({
      data: {
        projectId,
        title: `${latestFragment.title} (Auto-fixed)`,
        files: updatedFiles,
      },
    });

    console.log(
      `[ErrorsAPI] Created new fragment ${newFragment.id} with fixes applied`,
    );

    // Update the project to use the new fragment as the active one
    await prisma.project.update({
      where: { id: projectId },
      data: { activeFragmentId: newFragment.id },
    });

    console.log(
      `[ErrorsAPI] Updated project ${projectId} to use new active fragment ${newFragment.id}`,
    );

    return newFragment;
  } catch (error) {
    console.error("[ErrorsAPI] Failed to apply fixes to fragment:", error);
    throw error;
  }
}

/**
 * Helper function to convert database errors to ProjectErrors format
 */
function convertToProjectErrors(dbErrors: any[]) {
  const projectErrors = {
    buildErrors: [] as any[],
    runtimeErrors: [] as any[],
    importErrors: [] as any[],
    navigationErrors: [] as any[],
    severity: "low" as const,
    autoFixable: true,
    totalErrors: dbErrors.length,
    detectedAt: new Date(),
  };

  for (const dbError of dbErrors) {
    const error = dbError.errorDetails;

    switch (dbError.errorType) {
      case ErrorType.BUILD:
      case ErrorType.TYPE_SCRIPT:
      case ErrorType.ESLINT:
        projectErrors.buildErrors.push(error);
        break;
      case ErrorType.RUNTIME:
        projectErrors.runtimeErrors.push(error);
        break;
      case ErrorType.IMPORT:
        projectErrors.importErrors.push(error);
        break;
      case ErrorType.NAVIGATION:
        projectErrors.navigationErrors.push(error);
        break;
    }
  }

  return projectErrors;
}
