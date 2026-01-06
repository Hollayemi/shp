/**
 * Modal Sandbox Manager
 *
 * This file provides utilities for interacting with Modal sandboxes using the Modal SDK:
 * - creating, starting, stopping, and terminating sandboxes
 * - executing commands in sandboxes
 * - reading and writing files
 * - restoring fragments and project state
 *
 * Modal is a serverless cloud platform that runs code in containers.
 * Sandboxes provide isolated environments for running code with custom images.
 */

import { ModalClient, Sandbox, SandboxCreateParams } from "modal";
import { prisma } from "@shipper/database";
import { TRPCError } from "@trpc/server";
import { forceHttpsForDeployments } from "../utils/deployment-url.js";
import { getSnapshotImageId, hasSnapshot } from "./modal-snapshots.js";
import {
  generateMonitorScript,
  MONITOR_CONFIG,
  createViteDevServerCommand,
  getViteDevServerCommandDescription,
} from "@shipper/shared";
import type { Logger } from "pino";
import {
  logger as defaultLogger,
  createProjectLogger,
} from "../config/logger.js";
import {
  SHIPPER_IDS_PLUGIN_VERSION,
  SHIPPER_IDS_PLUGIN_CANONICAL,
  SHIPPER_IDS_PLUGIN_CANONICAL_JS,
} from "./shipper-ids-plugin-canonical.js";

/**
 * Transform Modal preview URLs (CURRENTLY DISABLED - returns original URLs)
 *
 * LEGACY: Previously converted Modal tunnel URLs to custom domain:
 * - Production: https://preview--m-{projectid}.shipper.now
 * - Development: http://preview--m-{projectid}.localhost:3003
 *
 * CURRENT: Returns original Modal URLs without transformation
 * The custom domain proxy system is no longer used.
 */
function transformModalUrlToShipperDomain(
  modalUrl: string,
  projectId: string,
): string {
  const logger = createProjectLogger(projectId);
  try {
    const url = new URL(modalUrl);

    // Check if URL is already transformed (to avoid double transformation)
    const isAlreadyTransformed =
      url.hostname.includes(`preview--m-${projectId}`) ||
      (url.hostname.includes("preview--m-") &&
        url.hostname.includes(".shipper.now"));

    if (isAlreadyTransformed) {
      logger.info({
        msg: "URL already transformed",
        modalUrl,
      });
      return modalUrl;
    }

    // DISABLED: We now use original Modal URLs directly instead of proxy transformation
    // Skip transformation if SKIP_MODAL_URL_TRANSFORM is set (for staging/preview environments)
    // Set this to "true" on Vercel preview and Railway staging where shipper.now proxy won't work
    if (process.env.SKIP_MODAL_URL_TRANSFORM === "true") {
      logger.info({
        msg: "SKIP_MODAL_URL_TRANSFORM enabled - using original Modal URL",
        originalUrl: modalUrl,
      });
      return modalUrl;
    }

    // DEFAULT BEHAVIOR: Return original Modal URLs without transformation
    // The proxy system (shipper.now domain) is no longer used
    logger.info({
      msg: "Using original Modal URL (transformation disabled by default)",
      originalUrl: modalUrl,
    });
    return modalUrl;

    // LEGACY CODE (disabled): Transform to custom domain pattern
    // Keeping this code commented for reference in case we need it again
    /*
    const useLocalhost =
      process.env.NODE_ENV === "development" ||
      process.env.MODAL_USE_LOCALHOST === "true";

    if (useLocalhost) {
      url.hostname = `preview--m-${projectId}.localhost`;
      url.port = "3003";
      url.protocol = "http:";
    } else {
      url.hostname = `preview--m-${projectId}.shipper.now`;
    }

    logger.info({
      msg: "Transformed Modal URL",
      originalUrl: modalUrl,
      transformedUrl: url.toString(),
    });
    return url.toString();
    */
  } catch (error) {
    logger.error({
      msg: "Failed to parse URL",
      modalUrl,
      error: error instanceof Error ? error.message : String(error),
    });
    return modalUrl;
  }
}

/**
 * Get the current Modal environment based on NODE_ENV
 */
function getModalEnvironment(): "main" | "dev" {
  return process.env.NODE_ENV === "development" ? "dev" : "main";
}

// Initialize Modal client
const modalClient = new ModalClient({
  tokenId: process.env.MODAL_TOKEN_ID,
  tokenSecret: process.env.MODAL_TOKEN_SECRET,
  environment: getModalEnvironment(),
});

type ModalSandboxInfo = {
  sandbox: Sandbox;
  sandboxId: string;
  sandboxUrl: string | null; // Transformed shipper.now proxy URL
  originalSandboxUrl?: string | null; // Original Modal URL (direct)
  sandboxExpiresAt?: Date | null;
  files: Map<string, { size: number; modified: number }>;
  projectId?: string;
  status: "running" | "stopped" | "terminated";
};

type ModalExecutionResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  error?: string;
};

/**
 * Inject monitoring script into Modal sandbox's index.html
 * Creates a .shipper directory with the monitoring script and imports it
 */
async function setupModalSandboxMonitoring(
  sandbox: Sandbox,
  sandboxId: string,
  projectId: string,
  logger: Logger = defaultLogger,
): Promise<void> {
  logger.info({
    msg: "Setting up monitoring for sandbox",
    sandboxId,
    projectId,
  });

  try {
    // Wait a bit for the dev server to generate index.html
    logger.info("Waiting 2 seconds for dev server to generate index.html");
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 1. Create .shipper directory with monitoring script
    logger.info({
      msg: "Generating monitor script content",
      sandboxId,
    });
    const monitorScriptContent = generateMonitorScript(
      MONITOR_CONFIG.ALLOWED_ORIGINS,
    );

    // Create .shipper directory first
    logger.info("Creating /workspace/.shipper directory");
    await sandbox.exec(["mkdir", "-p", "/workspace/.shipper"]);

    // Write monitoring script to .shipper/monitor.js
    logger.info("Writing monitor script to /workspace/.shipper/monitor.js");
    const monitorFile = await sandbox.open(
      "/workspace/.shipper/monitor.js",
      "w",
    );
    logger.info({
      msg: "Writing monitor script content",
      bytes: monitorScriptContent.length,
    });
    await monitorFile.write(new TextEncoder().encode(monitorScriptContent));
    await monitorFile.close();

    logger.info({
      msg: "Created .shipper/monitor.js",
      sandboxId,
    });

    // 2. Read the current index.html
    let htmlContent: string;
    try {
      logger.info("Opening /workspace/index.html for reading");
      const htmlFile = await sandbox.open("/workspace/index.html", "r");
      const data = await htmlFile.read();
      await htmlFile.close();
      htmlContent = new TextDecoder().decode(data);
      logger.info({
        msg: "Successfully read index.html",
        bytes: htmlContent.length,
      });
    } catch (error) {
      logger.warn({
        msg: "Failed to read index.html for monitoring injection",
        error: error instanceof Error ? error.message : String(error),
      });
      return; // Non-critical, continue without monitoring
    }

    // 3. Check if monitoring script is already injected
    if (htmlContent.includes(".shipper/monitor.js")) {
      logger.info("Monitoring script already present in index.html");
      return;
    }

    // 4. Inject the script import tag
    logger.info("Preparing to inject monitoring script");
    const scriptTag =
      '<script type="module" src="/.shipper/monitor.js"></script>';
    let modifiedHtml = htmlContent;
    let injectionLocation = "unknown";

    // Try to inject before </head> if it exists
    if (modifiedHtml.includes("</head>")) {
      modifiedHtml = modifiedHtml.replace(
        "</head>",
        `  ${scriptTag}\n  </head>`,
      );
      injectionLocation = "before </head>";
    }
    // Otherwise inject at the beginning of <body>
    else if (modifiedHtml.includes("<body")) {
      modifiedHtml = modifiedHtml.replace(
        /<body[^>]*>/,
        (match) => `${match}\n  ${scriptTag}`,
      );
      injectionLocation = "after <body>";
    }
    // Fallback: prepend to HTML
    else {
      modifiedHtml = scriptTag + "\n" + modifiedHtml;
      injectionLocation = "prepended to HTML";
    }

    logger.info({
      msg: "Script injected, writing back to file",
      injectionLocation,
    });

    // 5. Write the modified HTML back to the sandbox
    const modifiedFile = await sandbox.open("/workspace/index.html", "w");
    await modifiedFile.write(new TextEncoder().encode(modifiedHtml));
    await modifiedFile.close();

    logger.info({
      msg: "Successfully injected monitoring script into index.html",
      injectionLocation,
    });
  } catch (error) {
    logger.error({
      msg: "Error setting up monitoring (non-critical)",
      error: error instanceof Error ? error.message : String(error),
    });
    // Don't throw - monitoring is not critical for sandbox operation
  }
}

/**
 * Get sandbox information for a project
 */
export async function getSandbox(
  projectId: string,
  logger: Logger = defaultLogger,
): Promise<ModalSandboxInfo | null> {
  const projectLogger =
    logger === defaultLogger ? createProjectLogger(projectId) : logger;
  projectLogger.info({ msg: "Getting sandbox for project", projectId });

  try {
    // Check database for existing sandbox
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        sandboxId: true,
        sandboxUrl: true,
        sandboxCreatedAt: true,
        sandboxExpiresAt: true,
        importedFrom: true,
        codeImport: { select: { importedFrom: true } },
      },
    });

    // console.log(project, "project");

    if (!project) {
      projectLogger.info({ msg: "Project not found", projectId });
      return null;
    }

    // Fallback: check CodeImport if Project.importedFrom is null
    const importedFrom =
      project.importedFrom ?? project.codeImport?.importedFrom ?? null;

    projectLogger.info({
      msg: "Project sandbox details",
      sandboxId: project.sandboxId,
      sandboxUrl: project.sandboxUrl,
    });

    // If project has a sandbox, try to retrieve it
    if (project.sandboxId) {
      try {
        projectLogger.info({
          msg: "Retrieving sandbox",
          sandboxId: project.sandboxId,
        });
        const sandbox = await modalClient.sandboxes.fromId(project.sandboxId);

        // For JS-only projects, ensure we have the JS plugin (not TS) to avoid TypeScript detection
        // Detect by checking if vite.config.js exists (JS config = JS project)
        let isJavaScriptOnly = false;
        try {
          const viteJsCheck = await sandbox.exec([
            "test",
            "-f",
            "/workspace/vite.config.js",
          ]);
          isJavaScriptOnly = (await viteJsCheck.wait()) === 0;
        } catch {
          isJavaScriptOnly = false;
        }

        projectLogger.info({
          msg: "Checking project type for plugin sync",
          importedFrom,
          isJavaScriptOnly,
        });

        if (isJavaScriptOnly) {
          try {
            // Check if old .ts plugin exists
            const oldTsCheck = await sandbox.exec([
              "test",
              "-f",
              "/workspace/plugins/vite-plugin-shipper-ids.ts",
            ]);
            const hasOldTsPlugin = (await oldTsCheck.wait()) === 0;

            if (hasOldTsPlugin) {
              projectLogger.info({
                msg: "Found old .ts plugin in JS-only sandbox, replacing with .js version",
              });

              // Remove old .ts plugin and vite.config.ts
              await sandbox.exec([
                "rm",
                "-f",
                "/workspace/plugins/vite-plugin-shipper-ids.ts",
                "/workspace/vite.config.ts",
              ]);

              // Write new .js plugin
              await sandbox.exec(["mkdir", "-p", "/workspace/plugins"]);
              const pluginFile = await sandbox.open(
                "/workspace/plugins/vite-plugin-shipper-ids.js",
                "w",
              );
              await pluginFile.write(
                new TextEncoder().encode(SHIPPER_IDS_PLUGIN_CANONICAL_JS),
              );
              await pluginFile.close();

              projectLogger.info({
                msg: "Successfully replaced .ts plugin with .js for JS-only project",
              });
            }
          } catch (pluginError) {
            projectLogger.warn({
              msg: "Failed to check/replace plugin for JS-only project",
              error:
                pluginError instanceof Error
                  ? pluginError.message
                  : String(pluginError),
            });
          }
        }

        // Transform URL if it exists
        let transformedUrl = project.sandboxUrl;
        if (transformedUrl) {
          transformedUrl = transformModalUrlToShipperDomain(
            transformedUrl,
            projectId,
          );
          projectLogger.info({
            msg: "Transformed sandbox URL",
            originalUrl: project.sandboxUrl,
            transformedUrl,
          });
        } else {
          projectLogger.warn({
            msg: "No sandboxUrl in database, attempting to fetch from tunnel",
            sandboxId: project.sandboxId,
          });
          // Try to get tunnel URL from the sandbox
          try {
            const tunnels = await sandbox.tunnels();
            const tunnel5173 = tunnels[5173];
            if (tunnel5173) {
              const originalUrl = tunnel5173.url;
              transformedUrl = transformModalUrlToShipperDomain(
                originalUrl,
                projectId,
              );
              projectLogger.info({
                msg: "Fetched tunnel URL",
                originalUrl,
                transformedUrl,
              });
              // Update database with the URL
              await prisma.project.update({
                where: { id: projectId },
                data: { sandboxUrl: originalUrl },
              });
            } else {
              projectLogger.warn({
                msg: "No tunnel available on port 5173",
                sandboxId: project.sandboxId,
              });
            }
          } catch (tunnelError) {
            projectLogger.error({
              msg: "Failed to fetch tunnel URL",
              sandboxId: project.sandboxId,
              error:
                tunnelError instanceof Error
                  ? tunnelError.message
                  : String(tunnelError),
            });
          }
        }

        const sandboxInfo: ModalSandboxInfo = {
          sandbox,
          sandboxId: sandbox.sandboxId,
          sandboxUrl: transformedUrl,
          originalSandboxUrl: project.sandboxUrl, // Store original Modal URL
          sandboxExpiresAt: project.sandboxExpiresAt,
          files: new Map(),
          projectId,
          status: "running",
        };

        projectLogger.info({
          msg: "Retrieved sandbox",
          sandboxId: project.sandboxId,
          sandboxUrl: transformedUrl,
          originalSandboxUrl: project.sandboxUrl,
        });
        return sandboxInfo;
      } catch (error) {
        projectLogger.warn({
          msg: "Failed to retrieve sandbox",
          sandboxId: project.sandboxId,
          error: error instanceof Error ? error.message : String(error),
        });
        // Sandbox doesn't exist anymore, clear from database
        await prisma.project.update({
          where: { id: projectId },
          data: {
            sandboxId: null,
            sandboxUrl: null,
            sandboxCreatedAt: null,
            sandboxExpiresAt: null,
          },
        });
      }
    }

    projectLogger.info({ msg: "No sandbox found for project" });
    return null;
  } catch (error) {
    projectLogger.error({
      msg: "Error getting sandbox",
      error: error instanceof Error ? error.message : String(error),
    });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to get sandbox",
      cause: error,
    });
  }
}

/**
 * Create a new Modal sandbox
 */
type CreateSandboxOptions = {
  recoverySnapshotImageId?: string | null;
  /** Set to true for imported projects - enables bun install and vite.config patching */
  isImportedProject?: boolean;
  /** Platform the project was imported from (e.g., "BASE44", "LOVABLE") */
  importedFrom?: string | null;
};

export async function createSandbox(
  projectId: string,
  fragmentId?: string | null,
  templateName?: string,
  logger: Logger = defaultLogger,
  options: CreateSandboxOptions = {},
): Promise<ModalSandboxInfo> {
  const projectLogger =
    logger === defaultLogger ? createProjectLogger(projectId) : logger;
  const {
    recoverySnapshotImageId,
    isImportedProject = false,
    importedFrom = null,
  } = options;
  // console.log(options, "options");
  projectLogger.info({
    msg: "createSandbox called",
    projectId,
    fragmentId: fragmentId || null,
    templateName: templateName || null,
    isImportedProject,
    importedFrom,
    optionsReceived: JSON.stringify(options),
  });

  const env = getModalEnvironment();
  const hasTemplateSnapshot = !!templateName && hasSnapshot(templateName, env);
  const enableRecoveryDebug =
    process.env.RECOVERY_DEBUG === "true" ||
    (process.env.DEBUG || "").includes("sandbox-recovery");

  const logRecoveryDebug = (
    step: string,
    extra?: Record<string, unknown>,
  ): void => {
    if (!enableRecoveryDebug) return;
    projectLogger.info({
      msg: "sandbox.recovery",
      step,
      projectId,
      fragmentId: fragmentId || null,
      templateName: templateName || null,
      hasTemplateSnapshot,
      recoverySnapshotImageId: recoverySnapshotImageId || null,
      ...extra,
    });
  };

  projectLogger.info({
    msg: "Creating sandbox for project",
    projectId,
    fragmentId: fragmentId || "none",
    template: templateName || "default",
    recoverySnapshotImageId: recoverySnapshotImageId || undefined,
  });

  try {
    // Get or create Modal app - use single app for all sandboxes
    const app = await modalClient.apps.fromName("shipper-sandboxes", {
      createIfMissing: true,
    });

    projectLogger.info({
      msg: "Using Modal app",
      appName: app.name,
      appId: app.appId,
    });

    // PRIORITY 1: Check if fragment has a filesystem snapshot
    let fragmentSnapshot: { snapshotImageId: string; files: any } | null = null;
    let useFragmentSnapshot = false;

    if (fragmentId) {
      const fragment = await prisma.v2Fragment.findUnique({
        where: { id: fragmentId },
        select: { snapshotImageId: true, files: true },
      });

      if (fragment?.snapshotImageId) {
        projectLogger.info({
          msg: "Fragment has filesystem snapshot",
          fragmentId,
          snapshotImageId: fragment.snapshotImageId,
        });
        fragmentSnapshot = {
          snapshotImageId: fragment.snapshotImageId,
          files: fragment.files,
        };
        useFragmentSnapshot = true;
      }
    }

    // Select image to use (priority: fragment snapshot > template snapshot > base image)
    let image;
    let imageDescription: string;
    let skipFragmentRestoration = false;

    let selectedImageId: string | null = null;
    let usedBaseImage = false;

    if (recoverySnapshotImageId) {
      imageDescription = `recovery snapshot ${recoverySnapshotImageId}`;
      projectLogger.info({
        msg: "Using explicit recovery snapshot",
        snapshotImageId: recoverySnapshotImageId,
      });
      image = await modalClient.images.fromId(recoverySnapshotImageId);
      selectedImageId = recoverySnapshotImageId;
      skipFragmentRestoration = true;
    } else if (useFragmentSnapshot && fragmentSnapshot) {
      // PRIORITY 1: Use fragment snapshot - contains complete project state
      imageDescription = `fragment snapshot ${fragmentSnapshot.snapshotImageId}`;
      projectLogger.info({
        msg: "Using fragment snapshot",
        snapshotImageId: fragmentSnapshot.snapshotImageId,
        note: "complete filesystem state",
      });
      image = await modalClient.images.fromId(fragmentSnapshot.snapshotImageId);
      selectedImageId = fragmentSnapshot.snapshotImageId;
      skipFragmentRestoration = true; // Snapshot already contains all files
    } else if (templateName && hasTemplateSnapshot) {
      // PRIORITY 2: Use template snapshot - pre-built template
      const snapshotImageId = getSnapshotImageId(templateName, env);
      imageDescription = `template snapshot ${snapshotImageId}`;
      projectLogger.info({
        msg: "Using pre-built template snapshot",
        snapshotImageId,
        templateName,
        environment: env,
      });
      image = await modalClient.images.fromId(snapshotImageId!);
      selectedImageId = snapshotImageId ?? null;
    } else {
      // PRIORITY 3: Use base image - will need to clone from git or restore files
      const imageTag = getImageTagForTemplate();
      imageDescription = `base image ${imageTag}`;
      projectLogger.info({
        msg: "Using base image",
        imageTag,
        templateName: templateName || "none",
        note: templateName
          ? `no snapshot available for ${templateName}`
          : undefined,
      });
      image = modalClient.images.fromRegistry(imageTag);
      usedBaseImage = true;
      if (!templateName) {
        throw new Error(
          "Sandbox recovery requires a template but none was provided. Cannot proceed with bare base image.",
        );
      }
    }

    // Configure sandbox parameters
    const sandboxParams: SandboxCreateParams = {
      timeoutMs: 3600000, // 1 hour
      idleTimeoutMs: 900000, // 15 minutes idle timeout
      workdir: "/workspace",
      env: {
        NODE_ENV: "development",
        PROJECT_ID: projectId,
      },
      memoryMiB: 2048,
      cpu: 1,
      encryptedPorts: [8000, 5173], // Create tunnel for default dev server port
    };

    projectLogger.info({
      msg: "Creating sandbox",
      imageDescription,
    });
    const sandbox = await modalClient.sandboxes.create(
      app,
      image,
      sandboxParams,
    );

    projectLogger.info({
      msg: "Sandbox created",
      sandboxId: sandbox.sandboxId,
    });

    // Get tunnel URL for the sandbox (automatically created via encryptedPorts)
    let sandboxUrl: string | null = null;
    try {
      projectLogger.info({ msg: "Getting tunnel URL for sandbox" });
      // Wait a moment for tunnel to be ready
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const tunnels = await sandbox.tunnels();

      // Get tunnel for port 5173 (specified in encryptedPorts)
      const userTunnel = tunnels[5173];
      if (userTunnel) {
        // Store the original Modal URL in the database
        sandboxUrl = userTunnel.url;
        projectLogger.info({
          msg: "Tunnel URL retrieved",
          sandboxUrl,
        });
      } else {
        projectLogger.warn({
          msg: "Tunnel not available yet",
          sandboxId: sandbox.sandboxId,
        });
      }
    } catch (error) {
      projectLogger.warn({
        msg: "Could not get tunnel URL",
        sandboxId: sandbox.sandboxId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Update project with sandbox information (store original Modal URL)
    await prisma.project.update({
      where: { id: projectId },
      data: {
        sandboxId: sandbox.sandboxId,
        sandboxUrl: sandboxUrl, // Store original Modal URL
        sandboxCreatedAt: new Date(),
        sandboxExpiresAt: null, // Modal sandboxes don't have fixed expiration
      },
    });

    // Transform URL for return (but keep original in DB)
    const transformedUrl = sandboxUrl
      ? transformModalUrlToShipperDomain(sandboxUrl, projectId)
      : null;

    const sandboxInfo: ModalSandboxInfo = {
      sandbox,
      sandboxId: sandbox.sandboxId,
      sandboxUrl: transformedUrl, // Return transformed URL to caller
      originalSandboxUrl: sandboxUrl, // Store original Modal URL
      files: new Map(),
      projectId,
      status: "running",
    };

    logRecoveryDebug("selected-image", {
      sandboxId: sandbox.sandboxId,
      imageDescription,
      selectedImageId,
      usedBaseImage,
    });

    // Restore project state based on what's available
    if (skipFragmentRestoration) {
      // Using fragment snapshot - complete filesystem already loaded
      projectLogger.info({
        msg: "Fragment snapshot contains complete filesystem - skipping file restoration",
      });
    } else {
      // Template snapshots always have the necessary files preloaded
      // No need to clone from git - snapshots are the source of truth
      if (templateName && hasTemplateSnapshot) {
        projectLogger.info({
          msg: "Using template snapshot - template already loaded in sandbox",
          templateName,
          environment: env,
        });
      } else if (templateName && !hasTemplateSnapshot) {
        // This should never happen - all templates should have snapshots
        projectLogger.error({
          msg: "Template does not have a snapshot - cannot create sandbox",
          templateName,
          environment: env,
        });
        throw new Error(
          `Template "${templateName}" does not have a snapshot for environment "${env}". All templates must have pre-built snapshots.`,
        );
      }

      // Restore fragment files if available
      if (fragmentId) {
        projectLogger.info({
          msg: "Restoring fragment files",
          fragmentId,
          isImportedProject,
        });
        await restoreV2FragmentInSandbox(
          sandbox,
          fragmentId,
          projectId,
          projectLogger,
          { isImportedProject },
        );
        logRecoveryDebug("restore-fragment", {
          sandboxId: sandbox.sandboxId,
          fragmentId,
        });

        // Run bun install ONLY for imported projects
        // Normal projects already have dependencies installed from the template snapshot
        if (isImportedProject) {
          projectLogger.info({
            msg: "Installing dependencies for imported project",
          });
          try {
            // Install with normal scripts to ensure binaries like esbuild are properly set up
            const installResult = await sandbox.exec(["bun", "install"], {
              mode: "text",
              stdout: "pipe",
              stderr: "pipe",
              workdir: "/workspace",
              timeoutMs: 120000, // 2 minute timeout for bun install
            });
            const installExitCode = await installResult.wait();
            const installStderr = await installResult.stderr.readText();

            if (installExitCode === 0) {
              projectLogger.info({
                msg: "Dependencies installed successfully for imported project",
              });
            } else {
              projectLogger.warn({
                msg: "Dependency installation had errors but continuing",
                exitCode: installExitCode,
                stderr: installStderr.substring(0, 500), // First 500 chars of error
              });
              // Continue anyway - some postinstall failures are non-critical
            }

            // For Base44 projects, install common platform dependencies that may not be in package.json
            if (importedFrom === "BASE44") {
              projectLogger.info({
                msg: "Installing common Base44 platform dependencies",
              });
              const base44Deps = ["@tanstack/react-query"];
              try {
                const addResult = await sandbox.exec(
                  ["bun", "add", ...base44Deps],
                  {
                    mode: "text",
                    stdout: "pipe",
                    stderr: "pipe",
                    workdir: "/workspace",
                    timeoutMs: 60000,
                  },
                );
                const addExitCode = await addResult.wait();
                if (addExitCode === 0) {
                  projectLogger.info({
                    msg: "Base44 platform dependencies installed successfully",
                    deps: base44Deps,
                  });
                } else {
                  projectLogger.warn({
                    msg: "Some Base44 dependencies may have failed to install",
                    exitCode: addExitCode,
                  });
                }
              } catch (addError) {
                projectLogger.warn({
                  msg: "Failed to install Base44 platform dependencies",
                  error:
                    addError instanceof Error
                      ? addError.message
                      : String(addError),
                });
              }
            }
          } catch (installError) {
            projectLogger.warn({
              msg: "Failed to install dependencies for imported project",
              error:
                installError instanceof Error
                  ? installError.message
                  : String(installError),
            });
            // Don't throw - continue with sandbox creation even if install fails
          }
        } else {
          projectLogger.info({
            msg: "Skipping bun install - not an imported project",
            isImportedProject,
          });
        }
      }
    }

    // Sync shipper-ids plugin if version differs from server
    // Use .js extension for JS-only projects, .ts for TypeScript projects
    // Detect by checking if vite.config.js exists (JS config = JS project)
    let isJavaScriptOnly = false;
    try {
      const viteJsCheck = await sandbox.exec([
        "test",
        "-f",
        "/workspace/vite.config.js",
      ]);
      isJavaScriptOnly = (await viteJsCheck.wait()) === 0;
      projectLogger.info({
        msg: "Detected project type by checking for vite.config.js",
        isJavaScriptOnly,
      });
    } catch (detectError) {
      // If detection fails, assume TypeScript project
      isJavaScriptOnly = false;
      projectLogger.warn({
        msg: "Failed to detect project type, assuming TypeScript",
        error:
          detectError instanceof Error
            ? detectError.message
            : String(detectError),
      });
    }

    const SHIPPER_IDS_PLUGIN_PATH = isJavaScriptOnly
      ? "plugins/vite-plugin-shipper-ids.js"
      : "plugins/vite-plugin-shipper-ids.ts";
    const pluginContent = isJavaScriptOnly
      ? SHIPPER_IDS_PLUGIN_CANONICAL_JS
      : SHIPPER_IDS_PLUGIN_CANONICAL;

    try {
      let sandboxPluginVersion: string | null = null;
      let hasOldTsPlugin = false;

      // For JS-only projects, check if there's an old .ts plugin that needs to be removed
      if (isJavaScriptOnly) {
        try {
          const oldTsCheck = await sandbox.exec([
            "test",
            "-f",
            "/workspace/plugins/vite-plugin-shipper-ids.ts",
          ]);
          hasOldTsPlugin = (await oldTsCheck.wait()) === 0;
          if (hasOldTsPlugin) {
            projectLogger.info({
              msg: "Found old .ts plugin file for Base44 project, will remove and replace with .js",
            });
          }
        } catch {
          // Ignore errors checking for old file
        }
      }

      try {
        const pluginFile = await sandbox.open(
          `/workspace/${SHIPPER_IDS_PLUGIN_PATH}`,
          "r",
        );
        const existingContent = new TextDecoder().decode(
          await pluginFile.read(),
        );
        await pluginFile.close();
        const versionMatch = existingContent.match(
          /SHIPPER_IDS_PLUGIN_VERSION\s*=\s*["']([^"']+)["']/,
        );
        sandboxPluginVersion = versionMatch?.[1] ?? null;
      } catch (error) {
        // Plugin file doesn't exist or is unreadable
        projectLogger.debug({
          msg: "Could not read existing shipper-ids plugin version, assuming it needs to be created",
          error: error instanceof Error ? error.message : String(error),
        });
        sandboxPluginVersion = null;
      }

      projectLogger.info({
        msg: "Checking shipper-ids plugin version",
        sandboxVersion: sandboxPluginVersion,
        serverVersion: SHIPPER_IDS_PLUGIN_VERSION,
        pluginPath: SHIPPER_IDS_PLUGIN_PATH,
        isJavaScriptOnly,
        hasOldTsPlugin,
      });

      // Sync if version mismatch OR if Base44 has old .ts plugin that needs removal
      if (
        sandboxPluginVersion !== SHIPPER_IDS_PLUGIN_VERSION ||
        hasOldTsPlugin
      ) {
        projectLogger.info({
          msg: "Plugin version mismatch, syncing canonical plugin",
          sandboxVersion: sandboxPluginVersion,
          serverVersion: SHIPPER_IDS_PLUGIN_VERSION,
          pluginPath: SHIPPER_IDS_PLUGIN_PATH,
        });

        // Ensure plugins directory exists
        await sandbox.exec(["mkdir", "-p", "/workspace/plugins"]);

        // For JS-only projects, remove any existing .ts plugin file to avoid TypeScript detection
        if (isJavaScriptOnly) {
          await sandbox.exec([
            "rm",
            "-f",
            "/workspace/plugins/vite-plugin-shipper-ids.ts",
          ]);
          projectLogger.info({
            msg: "Removed old .ts plugin file for Base44 project",
          });
        }

        // Write canonical plugin (JS for Base44, TS for others)
        const pluginFile = await sandbox.open(
          `/workspace/${SHIPPER_IDS_PLUGIN_PATH}`,
          "w",
        );
        await pluginFile.write(new TextEncoder().encode(pluginContent));
        await pluginFile.close();

        projectLogger.info({
          msg: "Successfully synced shipper-ids plugin",
          version: SHIPPER_IDS_PLUGIN_VERSION,
          pluginPath: SHIPPER_IDS_PLUGIN_PATH,
        });
      } else {
        projectLogger.info({ msg: "Plugin version matches, no sync needed" });
      }
    } catch (pluginSyncError) {
      projectLogger.warn({
        msg: "Failed to sync shipper-ids plugin",
        error:
          pluginSyncError instanceof Error
            ? pluginSyncError.message
            : String(pluginSyncError),
      });
      // Don't throw - sandbox can still work without this plugin
    }

    // Patch vite.config ONLY for imported projects to add shipper-ids plugin
    // Normal projects already have this in their template
    if (isImportedProject) {
      try {
        await patchViteConfigForImport(sandbox, projectLogger);
      } catch (patchError) {
        projectLogger.warn({
          msg: "Failed to patch vite.config for imported project",
          error:
            patchError instanceof Error
              ? patchError.message
              : String(patchError),
        });
        // Don't throw - sandbox can still work without this
      }

      // Patch Base44 client to set requiresAuth: false for Base44 imports
      // This allows the app to work without Base44 authentication during migration
      if (importedFrom === "BASE44") {
        try {
          await patchBase44ClientForImport(sandbox, projectLogger);
        } catch (patchError) {
          projectLogger.warn({
            msg: "Failed to patch Base44 client for imported project",
            error:
              patchError instanceof Error
                ? patchError.message
                : String(patchError),
          });
          // Don't throw - sandbox can still work without this
        }
      }
    }

    // Start dev server if template or fragment was loaded
    // This ensures the tunnel has a server listening on port 5173
    if (fragmentId || templateName) {
      try {
        projectLogger.info({
          msg: "Starting dev server for sandbox",
          sandboxId: sandbox.sandboxId,
          isImportedProject,
        });

        // For Vite 7 + Tailwind CSS v4: Use a smart startup script that waits for optimization
        // This prevents the "Outdated Optimize Dep" 504 errors by ensuring deps are ready before serving
        // Also force Tailwind CSS rebuild by touching the CSS file to prevent stale style caching
        const devCommand = createViteDevServerCommand(5173);

        projectLogger.info({
          msg: "Executing dev server command with optimization wait and Tailwind CSS cache clear",
          command: getViteDevServerCommandDescription(),
        });

        const process = await sandbox.exec(devCommand, {
          mode: "text",
          stdout: "pipe",
          stderr: "pipe",
          workdir: "/workspace",
        });

        // Get the PID from stdout and any errors from stderr
        const pid = await process.stdout.readText();
        const stderrOutput = await process.stderr.readText();
        await process.wait();

        if (stderrOutput && stderrOutput.trim()) {
          projectLogger.warn({
            msg: "Dev server startup had stderr output",
            stderr: stderrOutput,
          });
        }

        projectLogger.info({
          msg: "Dev server started in background",
          pid: pid.trim(),
          port: 5173,
          tunnelUrl: sandboxUrl,
        });

        // For imported projects, do additional verification
        if (isImportedProject) {
          await new Promise((resolve) => setTimeout(resolve, 3000));
          try {
            // Check if vite process is running
            const checkProcess = await sandbox.exec(["ps", "aux"], {
              mode: "text",
              stdout: "pipe",
              workdir: "/workspace",
            });
            const psOutput = await checkProcess.stdout.readText();
            await checkProcess.wait();

            const isViteRunning =
              psOutput.includes("vite") || psOutput.includes("bun dev");
            const viteProcesses = psOutput
              .split("\n")
              .filter(
                (line) =>
                  line.includes("vite") ||
                  line.includes("bun") ||
                  line.includes("5173"),
              );

            projectLogger.info({
              msg: "Dev server process check for imported project",
              isViteRunning,
              processes:
                viteProcesses.length > 0
                  ? viteProcesses.join("\n")
                  : "None found",
            });

            if (!isViteRunning) {
              projectLogger.error({
                msg: "CRITICAL: Dev server not running for imported project",
              });

              // Try to read dev server logs from /tmp/vite.log
              try {
                const logsCheck = await sandbox.exec(["cat", "/tmp/vite.log"], {
                  mode: "text",
                  stdout: "pipe",
                  stderr: "pipe",
                  workdir: "/workspace",
                });
                const logs = await logsCheck.stdout.readText();
                await logsCheck.wait();
                projectLogger.error({
                  msg: "Vite dev server log content",
                  logs: logs.substring(0, 2000), // First 2000 chars
                });
              } catch (logError) {
                projectLogger.error({
                  msg: "Could not read vite log file",
                  error:
                    logError instanceof Error
                      ? logError.message
                      : String(logError),
                });
              }

              // Throw error for imported projects if dev server isn't running
              throw new Error(
                "Dev server failed to start for imported project. This usually means dependencies weren't installed correctly or there's a configuration issue.",
              );
            }
          } catch (checkError) {
            // If this is our critical dev server error, re-throw it
            if (
              checkError instanceof Error &&
              checkError.message.includes("Dev server failed to start")
            ) {
              throw checkError;
            }
            // Otherwise just log and continue
            projectLogger.warn({
              msg: "Could not verify dev server process",
              error:
                checkError instanceof Error
                  ? checkError.message
                  : String(checkError),
            });
          }
        }

        // Wait for dev server to be ready by checking if index.html exists
        // This ensures the Vite build has completed and the server is serving content
        projectLogger.info({ msg: "Waiting for dev server to be ready" });
        const maxWaitTime = 30000; // 30 seconds max wait
        const startWait = Date.now();
        let isReady = false;

        while (Date.now() - startWait < maxWaitTime && !isReady) {
          try {
            // Check if index.html has been generated
            const checkResult = await sandbox.exec([
              "test",
              "-f",
              "/workspace/index.html",
            ]);
            const exitCode = await checkResult.wait();

            if (exitCode === 0) {
              projectLogger.info({
                msg: "Dev server ready",
                waitTime: Date.now() - startWait,
              });
              isReady = true;
              break;
            }
          } catch (checkError) {
            // File doesn't exist yet, continue waiting
          }

          // Wait 1 second before checking again
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        if (!isReady) {
          projectLogger.warn({
            msg: "Dev server not ready after max wait time",
            maxWaitTime,
          });
        }
      } catch (devServerError) {
        projectLogger.warn({
          msg: "Dev server start warning (may still be running)",
          error:
            devServerError instanceof Error
              ? devServerError.message
              : String(devServerError),
        });
        // Don't throw - dev server might still start successfully
      }
    }

    projectLogger.info({
      msg: "Sandbox setup complete",
      sandboxId: sandbox.sandboxId,
    });
    return sandboxInfo;
  } catch (error) {
    // Extract detailed error information
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorDetails =
      error && typeof error === "object"
        ? JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
        : String(error);

    projectLogger.error({
      msg: "Error creating sandbox",
      projectId,
      fragmentId: fragmentId || null,
      templateName: templateName || null,
      error: errorMessage,
      errorDetails,
    });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to create sandbox: ${errorMessage}`,
      cause: error,
    });
  }
}

/**
 * Get image tag for template
 * All templates now use Bun
 */
function getImageTagForTemplate(): string {
  // All templates use Bun
  return "oven/bun:1";
}

/**
 * Terminate a Modal sandbox
 */
export async function deleteSandbox(
  sandboxId: string,
  projectId?: string,
): Promise<void> {
  const logger = projectId ? createProjectLogger(projectId) : defaultLogger;
  logger.info({ msg: "Terminating sandbox", sandboxId });

  try {
    const sandbox = await modalClient.sandboxes.fromId(sandboxId);
    await sandbox.terminate();

    // Clear sandbox info from project
    await prisma.project.updateMany({
      where: { sandboxId: sandboxId },
      data: {
        sandboxId: null,
        sandboxUrl: null,
        sandboxCreatedAt: null,
        sandboxExpiresAt: null,
      },
    });

    logger.info({ msg: "Sandbox terminated", sandboxId });
  } catch (error) {
    logger.error({
      msg: "Error terminating sandbox",
      sandboxId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to terminate sandbox",
      cause: error,
    });
  }
}

/**
 * Restore a V2 fragment in the Modal sandbox
 */
export async function restoreV2FragmentInSandbox(
  sandbox: Sandbox,
  fragmentId: string,
  projectId: string,
  logger: Logger = defaultLogger,
  options?: { isImportedProject?: boolean },
): Promise<void> {
  const projectLogger =
    logger === defaultLogger ? createProjectLogger(projectId) : logger;
  const isImportedProject = options?.isImportedProject ?? false;

  projectLogger.info({
    msg: "Restoring V2 fragment in sandbox",
    fragmentId,
    sandboxId: sandbox.sandboxId,
    isImportedProject,
  });

  try {
    // Fetch fragment from database
    const fragment = await prisma.v2Fragment.findUnique({
      where: { id: fragmentId },
      select: {
        id: true,
        title: true,
        files: true,
        projectId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!fragment) {
      throw new Error(`Fragment not found: ${fragmentId}`);
    }

    if (fragment.projectId !== projectId) {
      throw new Error(
        `Fragment ${fragmentId} does not belong to project ${projectId}`,
      );
    }

    // Parse files
    const files =
      typeof fragment.files === "string"
        ? JSON.parse(fragment.files)
        : fragment.files;

    // Use optimized restore for imported projects (parallel writes, bulk mkdir)
    if (isImportedProject) {
      await restoreFilesInSandboxOptimized(
        sandbox,
        files as { [path: string]: string },
        projectLogger,
      );
    } else {
      await restoreFilesInSandbox(
        sandbox,
        files as { [path: string]: string },
        projectLogger,
      );
    }

    projectLogger.info({ msg: "Fragment restored successfully", fragmentId });
  } catch (error) {
    projectLogger.error({
      msg: "Error restoring fragment",
      fragmentId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to restore fragment",
      cause: error,
    });
  }
}

/**
 * Restore files in the Modal sandbox
 */
export async function restoreFilesInSandbox(
  sandbox: Sandbox,
  files: { [path: string]: string },
  logger: Logger = defaultLogger,
): Promise<void> {
  logger.info({
    msg: "Restoring files in sandbox",
    fileCount: Object.keys(files).length,
    sandboxId: sandbox.sandboxId,
  });

  try {
    // Write each file to the sandbox
    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = `/workspace/${filePath}`;

      // Ensure parent directory exists
      const dirPath = fullPath.substring(0, fullPath.lastIndexOf("/"));
      if (dirPath) {
        await sandbox.exec(["mkdir", "-p", dirPath]);
      }

      // Check if content is base64 encoded (for binary files like images)
      let fileData: Uint8Array;
      if (content.startsWith("__BASE64__")) {
        // Decode base64 to binary (new format from import)
        const base64Data = content.substring("__BASE64__".length);
        const binaryString = atob(base64Data);
        fileData = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          fileData[i] = binaryString.charCodeAt(i);
        }
      } else if (content.startsWith("data:")) {
        // Extract base64 data from data URL (legacy format)
        const base64Match = content.match(/^data:[^;]+;base64,(.+)$/);
        if (base64Match) {
          const base64Data = base64Match[1];
          const binaryString = atob(base64Data);
          fileData = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            fileData[i] = binaryString.charCodeAt(i);
          }
        } else {
          // Fallback to text encoding if not valid base64 data URL
          fileData = new TextEncoder().encode(content);
        }
      } else {
        // Regular text file
        fileData = new TextEncoder().encode(content);
      }

      // Write file content
      const file = await sandbox.open(fullPath, "w");
      await file.write(fileData);
      await file.close();

      logger.debug({
        msg: "Restored file",
        filePath,
        bytes: fileData.length,
      });
    }

    logger.info({
      msg: "Files restored successfully",
      fileCount: Object.keys(files).length,
    });
  } catch (error) {
    logger.error({
      msg: "Error restoring files",
      sandboxId: sandbox.sandboxId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to restore files",
      cause: error,
    });
  }
}

/**
 * Optimized file restoration for imported projects
 * Creates all directories at once and writes files in parallel batches
 */
export async function restoreFilesInSandboxOptimized(
  sandbox: Sandbox,
  files: { [path: string]: string },
  logger: Logger = defaultLogger,
): Promise<void> {
  const fileCount = Object.keys(files).length;
  logger.info({
    msg: "Restoring files in sandbox (optimized for import)",
    fileCount,
    sandboxId: sandbox.sandboxId,
  });

  try {
    // Collect all unique directories first
    const directories = new Set<string>();
    for (const filePath of Object.keys(files)) {
      const fullPath = `/workspace/${filePath}`;
      const dirPath = fullPath.substring(0, fullPath.lastIndexOf("/"));
      if (dirPath && dirPath !== "/workspace") {
        directories.add(dirPath);
      }
    }

    // Create all directories in one command (much faster than individual mkdir calls)
    if (directories.size > 0) {
      const dirsArray = Array.from(directories);
      logger.info({
        msg: "Creating directories for import",
        count: dirsArray.length,
      });
      await sandbox.exec(["mkdir", "-p", ...dirsArray]);
    }

    // Write files in parallel batches for speed
    const BATCH_SIZE = 10;
    const fileEntries = Object.entries(files);
    let filesRestored = 0;

    for (let i = 0; i < fileEntries.length; i += BATCH_SIZE) {
      const batch = fileEntries.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async ([filePath, content]) => {
          const fullPath = `/workspace/${filePath}`;

          // Check if content is base64 encoded (for binary files like images)
          let fileData: Uint8Array;
          if (content.startsWith("__BASE64__")) {
            // Decode base64 to binary (new format from import)
            const base64Data = content.substring("__BASE64__".length);
            const binaryString = atob(base64Data);
            fileData = new Uint8Array(binaryString.length);
            for (let j = 0; j < binaryString.length; j++) {
              fileData[j] = binaryString.charCodeAt(j);
            }
          } else if (content.startsWith("data:")) {
            // Extract base64 data from data URL (legacy format)
            const base64Match = content.match(/^data:[^;]+;base64,(.+)$/);
            if (base64Match) {
              const base64Data = base64Match[1];
              const binaryString = atob(base64Data);
              fileData = new Uint8Array(binaryString.length);
              for (let j = 0; j < binaryString.length; j++) {
                fileData[j] = binaryString.charCodeAt(j);
              }
            } else {
              // Fallback to text encoding if not valid base64 data URL
              fileData = new TextEncoder().encode(content);
            }
          } else {
            // Regular text file
            fileData = new TextEncoder().encode(content);
          }

          // Write file content
          const file = await sandbox.open(fullPath, "w");
          await file.write(fileData);
          await file.close();
        }),
      );

      filesRestored += batch.length;
      logger.info({
        msg: "Import file restore progress",
        filesRestored,
        totalFiles: fileCount,
      });
    }

    logger.info({
      msg: "Files restored successfully (optimized)",
      fileCount,
    });
  } catch (error) {
    logger.error({
      msg: "Error restoring files (optimized)",
      sandboxId: sandbox.sandboxId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to restore files",
      cause: error,
    });
  }
}

/**
 * Patch vite.config for imported projects to add shipper-ids plugin
 * and ensure proper Modal sandbox configuration
 *
 * Instead of complex string manipulation, we extract key imports/plugins
 * and create a clean working config
 */
export async function patchViteConfigForImport(
  sandbox: Sandbox,
  logger: Logger = defaultLogger,
): Promise<void> {
  try {
    // Check if vite.config exists (try common extensions)
    const configFiles = ["vite.config.ts", "vite.config.js", "vite.config.mjs"];
    let viteConfigPath: string | null = null;

    for (const configFile of configFiles) {
      const checkResult = await sandbox.exec([
        "test",
        "-f",
        `/workspace/${configFile}`,
      ]);
      const exitCode = await checkResult.wait();
      if (exitCode === 0) {
        viteConfigPath = `/workspace/${configFile}`;
        logger.info({ msg: "Found Vite config", configFile });
        break;
      }
    }

    if (!viteConfigPath) {
      logger.info({ msg: "No vite.config found, skipping patch" });
      return;
    }

    // Read current config
    const file = await sandbox.open(viteConfigPath, "r");
    const data = await file.read();
    await file.close();
    let content = new TextDecoder().decode(data);

    // Check if already patched (has .modal.host, correct host, and port 5173)
    const hasModalHost =
      content.includes("'.modal.host'") || content.includes('".modal.host"');
    const hasNetworkHost =
      content.includes("host: '0.0.0.0'") ||
      content.includes('host: "0.0.0.0"') ||
      content.includes("host: '::'") ||
      content.includes('host: "::"') ||
      content.match(/host:\s*['"](?:0\.0\.0\.0|::)['"]/);
    const hasCorrectPort =
      content.includes("port: 5173") || content.match(/port:\s*5173/);

    if (hasModalHost && hasNetworkHost && hasCorrectPort) {
      logger.info({
        msg: "Vite config already patched (has .modal.host, network host, and port 5173), skipping",
      });
      return;
    }

    // Add .modal.host to allowedHosts configuration and host: '0.0.0.0'
    if (content.includes("allowedHosts:")) {
      // Check if allowedHosts is boolean (true) - common in Base44/Lovable projects
      if (content.match(/allowedHosts:\s*true/)) {
        logger.info({
          msg: "Found allowedHosts: true (boolean), adding host: 0.0.0.0",
        });
        // Replace allowedHosts: true with proper array and add host
        if (!hasNetworkHost) {
          content = content.replace(
            /allowedHosts:\s*true/,
            `host: '0.0.0.0',\n    allowedHosts: true`,
          );
        }
      } else {
        // Existing allowedHosts array - add .modal.host to it
        // Match: allowedHosts: ["...", "..."] or allowedHosts: [\n  "...",\n  "..."\n]
        const allowedHostsMatch = content.match(
          /allowedHosts:\s*\[([\s\S]*?)\]/,
        );
        if (allowedHostsMatch) {
          const existingHosts = allowedHostsMatch[1];

          // Check if it's a multi-line array (has newlines inside)
          const isMultiLine = existingHosts.includes("\n");

          let newAllowedHosts: string;
          if (isMultiLine) {
            // Multi-line: add on new line before closing bracket
            // Remove trailing whitespace/newlines, add our entries, then closing bracket
            const trimmedHosts = existingHosts.replace(/[\s,]*$/, "");
            newAllowedHosts = `allowedHosts: [${trimmedHosts},\n    ".modal.host",\n    "shipper.now",\n    ".localhost"\n  ]`;
          } else {
            // Single line: just append
            const trimmedHosts = existingHosts.trim();
            const newHosts = trimmedHosts
              ? `${trimmedHosts}, ".modal.host", "shipper.now", ".localhost"`
              : '".modal.host", "shipper.now", ".localhost"';
            newAllowedHosts = `allowedHosts: [${newHosts}]`;
          }

          content = content.replace(
            /allowedHosts:\s*\[([\s\S]*?)\]/,
            newAllowedHosts,
          );
          logger.info({
            msg: "Added .modal.host, shipper.now, and .localhost to existing allowedHosts array",
          });
        } else {
          logger.warn({
            msg: "Found allowedHosts but couldn't parse array format",
          });
          return;
        }
      }
    } else if (content.includes("server:")) {
      // Existing server block - add allowedHosts and host
      // First, add host: '0.0.0.0' if not present
      if (!hasNetworkHost) {
        content = content.replace(
          /server:\s*\{/,
          `server: {\n    host: '0.0.0.0',`,
        );
      }
      // Then add allowedHosts if not present
      if (!hasModalHost) {
        content = content.replace(
          /server:\s*\{/,
          `server: {\n    allowedHosts: [".modal.host", "shipper.now", ".localhost"],`,
        );
      }
      logger.info({
        msg: "Added host and allowedHosts to existing server block",
      });
    } else if (content.includes("export default")) {
      // No server block - add it with both host and allowedHosts
      content = content.replace(
        /export default\s+defineConfig\(\{/,
        `export default defineConfig({\n  server: {\n    host: '0.0.0.0',\n    allowedHosts: [".modal.host", "shipper.now", ".localhost"],\n  },`,
      );
      logger.info({ msg: "Added server block with host and allowedHosts" });
    } else {
      logger.warn({ msg: "Could not patch vite.config - unexpected format" });
      return;
    }

    // Fix port if it's not 5173 (common in Lovable projects that use 8080)
    if (!hasCorrectPort && content.includes("port:")) {
      // Replace any existing port with 5173
      content = content.replace(/port:\s*\d+/, "port: 5173");
      logger.info({
        msg: "Changed port to 5173 for Modal tunnel compatibility",
      });
    } else if (!hasCorrectPort && content.includes("server:")) {
      // Add port to existing server block
      content = content.replace(/server:\s*\{/, `server: {\n    port: 5173,`);
      logger.info({
        msg: "Added port: 5173 to server block",
      });
    }

    // Write patched config back
    const writeFile = await sandbox.open(viteConfigPath, "w");
    await writeFile.write(new TextEncoder().encode(content));
    await writeFile.close();

    logger.info({
      msg: "Successfully patched vite.config with host, port, and allowedHosts",
      patchedConfigPreview: content.substring(0, 500), // Log first 500 chars for debugging
    });
  } catch (error) {
    // Non-critical - log warning but don't fail
    logger.warn({
      msg: "Failed to patch vite.config (non-critical)",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Patch Base44 client to set requiresAuth: false
 * This allows the app to work without Base44 authentication during migration
 */
export async function patchBase44ClientForImport(
  sandbox: Sandbox,
  logger: Logger = defaultLogger,
): Promise<void> {
  try {
    // Check common locations for Base44 client file
    const clientFiles = [
      "src/api/base44Client.js",
      "src/lib/base44Client.js",
      "src/base44Client.js",
      "lib/base44Client.js",
    ];

    let clientPath: string | null = null;

    for (const clientFile of clientFiles) {
      const checkResult = await sandbox.exec([
        "test",
        "-f",
        `/workspace/${clientFile}`,
      ]);
      const exitCode = await checkResult.wait();
      if (exitCode === 0) {
        clientPath = `/workspace/${clientFile}`;
        logger.info({ msg: "Found Base44 client", clientFile });
        break;
      }
    }

    if (!clientPath) {
      logger.info({ msg: "No Base44 client file found, skipping patch" });
      return;
    }

    // Read current content
    const file = await sandbox.open(clientPath, "r");
    const data = await file.read();
    await file.close();
    let content = new TextDecoder().decode(data);

    // Check if requiresAuth is already false
    if (content.match(/requiresAuth:\s*false/)) {
      logger.info({ msg: "Base44 client already has requiresAuth: false" });
      return;
    }

    // Patch requiresAuth: true to requiresAuth: false
    if (content.match(/requiresAuth:\s*true/)) {
      content = content.replace(/requiresAuth:\s*true/, "requiresAuth: false");
      logger.info({
        msg: "Patched Base44 client: requiresAuth: true -> false",
      });
    } else if (content.includes("createClient(")) {
      // If requiresAuth is not present but createClient is, add it
      // Match: createClient({ ... }) and add requiresAuth: false
      logger.info({
        msg: "Base44 client has createClient but no requiresAuth, leaving as-is",
      });
      return;
    } else {
      logger.info({
        msg: "Base44 client format not recognized, skipping patch",
      });
      return;
    }

    // Write patched content back
    const writeFile = await sandbox.open(clientPath, "w");
    await writeFile.write(new TextEncoder().encode(content));
    await writeFile.close();

    logger.info({
      msg: "Successfully patched Base44 client with requiresAuth: false",
    });
  } catch (error) {
    // Non-critical - log warning but don't fail
    logger.warn({
      msg: "Failed to patch Base44 client (non-critical)",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Create a filesystem snapshot of the current sandbox state
 * Returns Modal Image ID that can be used to restore this exact state
 *
 * This captures the COMPLETE filesystem state including:
 * - All files (not just tracked ones)
 * - Build artifacts and node_modules
 * - File permissions and symlinks
 * - User-created files
 *
 * @param sandbox - Active Modal sandbox
 * @param fragmentId - Fragment to associate with this snapshot
 * @param projectId - Project ID for logging
 * @returns Modal Image ID
 */
export async function createFilesystemSnapshot(
  sandbox: Sandbox,
  fragmentId: string,
  projectId: string,
  logger: Logger = defaultLogger,
): Promise<string> {
  const projectLogger =
    logger === defaultLogger ? createProjectLogger(projectId) : logger;
  projectLogger.info({
    msg: "Creating filesystem snapshot for fragment",
    fragmentId,
    sandboxId: sandbox.sandboxId,
  });

  try {
    // Create snapshot using Modal SDK
    const snapshotImage = await sandbox.snapshotFilesystem();
    const imageId = snapshotImage.imageId;

    projectLogger.info({
      msg: "Snapshot image created",
      imageId,
    });

    // Update fragment with snapshot info
    await prisma.v2Fragment.update({
      where: { id: fragmentId },
      data: {
        snapshotImageId: imageId,
        snapshotCreatedAt: new Date(),
        snapshotProvider: "modal",
      },
    });

    projectLogger.info({
      msg: "Fragment updated with snapshot",
      fragmentId,
      imageId,
    });

    // Clean up old snapshots for this project (keep last 10)
    await cleanupOldSnapshots(projectId, 10, projectLogger);

    return imageId;
  } catch (error) {
    projectLogger.error({
      msg: "Failed to create filesystem snapshot",
      fragmentId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to create filesystem snapshot",
      cause: error,
    });
  }
}

/**
 * Clean up old snapshots for a project to manage storage costs
 * Keeps the most recent N snapshots and deletes older ones
 *
 * @param projectId - Project to clean up snapshots for
 * @param keepCount - Number of recent snapshots to keep (default: 10)
 */
export async function cleanupOldSnapshots(
  projectId: string,
  keepCount: number = 10,
  logger: Logger = defaultLogger,
): Promise<{ deleted: number; kept: number }> {
  const projectLogger =
    logger === defaultLogger ? createProjectLogger(projectId) : logger;
  projectLogger.info({
    msg: "Cleaning up old snapshots",
    keepCount,
  });

  try {
    // Get all fragments with snapshots for this project, ordered by creation date
    const fragments = await prisma.v2Fragment.findMany({
      where: {
        projectId,
        snapshotImageId: { not: null },
        snapshotProvider: "modal",
      },
      orderBy: { snapshotCreatedAt: "desc" },
      select: {
        id: true,
        snapshotImageId: true,
        snapshotCreatedAt: true,
        title: true,
      },
    });

    projectLogger.info({
      msg: "Found fragments with snapshots",
      fragmentCount: fragments.length,
    });

    // If we have fewer than or equal to keepCount, nothing to clean up
    if (fragments.length <= keepCount) {
      projectLogger.info({
        msg: "No cleanup needed",
        snapshotCount: fragments.length,
      });
      return { deleted: 0, kept: fragments.length };
    }

    // Get snapshots to delete (everything after keepCount)
    const snapshotsToDelete = fragments.slice(keepCount);

    projectLogger.info({
      msg: "Deleting old snapshots",
      deleteCount: snapshotsToDelete.length,
      keepCount,
    });

    let deletedCount = 0;

    for (const fragment of snapshotsToDelete) {
      if (!fragment.snapshotImageId) continue;

      try {
        projectLogger.info({
          msg: "Deleting snapshot",
          imageId: fragment.snapshotImageId,
          fragmentId: fragment.id,
          fragmentTitle: fragment.title,
        });

        // Delete the image from Modal
        try {
          const image = await modalClient.images.fromId(
            fragment.snapshotImageId,
          );
          await modalClient.images.delete(fragment.snapshotImageId);
          projectLogger.info({
            msg: "Deleted image",
            imageId: fragment.snapshotImageId,
          });
        } catch (imageError) {
          projectLogger.warn({
            msg: "Failed to delete image (may already be deleted)",
            imageId: fragment.snapshotImageId,
            error:
              imageError instanceof Error
                ? imageError.message
                : String(imageError),
          });
          // Continue even if image deletion fails - update DB anyway
        }

        // Clear snapshot info from fragment
        await prisma.v2Fragment.update({
          where: { id: fragment.id },
          data: {
            snapshotImageId: null,
            snapshotCreatedAt: null,
            snapshotProvider: null,
          },
        });

        deletedCount++;
        projectLogger.info({
          msg: "Cleaned up snapshot for fragment",
          fragmentId: fragment.id,
        });
      } catch (error) {
        projectLogger.error({
          msg: "Failed to clean up snapshot for fragment",
          fragmentId: fragment.id,
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue with other snapshots even if one fails
      }
    }

    projectLogger.info({
      msg: "Snapshot cleanup complete",
      deleted: deletedCount,
      kept: keepCount,
    });

    return { deleted: deletedCount, kept: keepCount };
  } catch (error) {
    projectLogger.error({
      msg: "Failed to clean up old snapshots",
      error: error instanceof Error ? error.message : String(error),
    });
    // Don't throw - cleanup failures shouldn't break the main flow
    return { deleted: 0, kept: 0 };
  }
}

/**
 * Delete a specific snapshot by image ID
 * Useful for manual cleanup or error recovery
 *
 * @param imageId - Modal Image ID to delete
 */
export async function deleteSnapshot(
  imageId: string,
  projectId?: string,
): Promise<boolean> {
  const logger = projectId ? createProjectLogger(projectId) : defaultLogger;
  logger.info({ msg: "Deleting snapshot", imageId });

  try {
    const image = await modalClient.images.fromId(imageId);
    await modalClient.images.delete(imageId);

    // Clear snapshot info from any fragments that reference this image
    await prisma.v2Fragment.updateMany({
      where: { snapshotImageId: imageId },
      data: {
        snapshotImageId: null,
        snapshotCreatedAt: null,
        snapshotProvider: null,
      },
    });

    logger.info({ msg: "Successfully deleted snapshot", imageId });
    return true;
  } catch (error) {
    logger.error({
      msg: "Failed to delete snapshot",
      imageId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * @deprecated This function is no longer used. All templates now use pre-built snapshots
 * instead of cloning from git. Snapshots are defined in modal-snapshots.ts and contain
 * all necessary files. Git cloning is slow and unnecessary.
 *
 * Clone a template from Git repository into the Modal sandbox
 * Templates are different branches in the vite-template repository
 */
export async function cloneTemplateInSandbox(
  sandbox: Sandbox,
  templateName: string,
  logger: Logger = defaultLogger,
): Promise<void> {
  logger.info({
    msg: "Cloning template in sandbox",
    templateName,
    sandboxId: sandbox.sandboxId,
  });

  try {
    const repoUrl = "https://github.com/Shipper-dot-now/vite-template";

    // Map template names to branch names
    // Default templates use the branch name directly
    // Special case: "vite" or "default" uses "main" branch
    const branchName =
      templateName === "vite" ||
      templateName === "default" ||
      templateName === "node"
        ? "main"
        : templateName.endsWith("-template")
          ? templateName
          : `${templateName}-template`;

    logger.info({
      msg: "Cloning branch from repository",
      branchName,
      repoUrl,
    });

    // Check if git is installed
    logger.info({ msg: "Checking for git installation" });
    const gitCheckResult = await sandbox.exec(["sh", "-c", "command -v git"], {
      mode: "text",
      stdout: "pipe",
      stderr: "pipe",
      workdir: "/workspace",
    });

    const gitCheckExitCode = await gitCheckResult.wait();

    // Install git if not available (base images might not have it)
    if (gitCheckExitCode !== 0) {
      logger.info({ msg: "Git not found, installing" });

      const installResult = await sandbox.exec(
        ["sh", "-c", "apt-get update && apt-get install -y git"],
        {
          mode: "text",
          stdout: "pipe",
          stderr: "pipe",
          workdir: "/workspace",
        },
      );

      const installStdout = await installResult.stdout.readText();
      const installStderr = await installResult.stderr.readText();
      const installExitCode = await installResult.wait();

      if (installExitCode !== 0) {
        logger.error({
          msg: "Failed to install git",
          error: installStderr || installStdout,
        });
        throw new Error(
          `Failed to install git: ${installStderr || installStdout}`,
        );
      }

      logger.info({ msg: "Git installed successfully" });
    } else {
      logger.info({ msg: "Git already installed" });
    }

    // Clone the specific branch using git config to bypass credential checks
    // For public repositories, we don't need authentication
    // Use GIT_ASKPASS=echo to provide empty credentials if git asks
    const cloneResult = await sandbox.exec(
      [
        "git",
        "-c",
        "credential.helper=",
        "clone",
        "--branch",
        branchName,
        "--single-branch",
        "--depth",
        "1",
        repoUrl,
        "temp-clone",
      ],
      {
        mode: "text",
        stdout: "pipe",
        stderr: "pipe",
        workdir: "/workspace",
        env: {
          GIT_TERMINAL_PROMPT: "0", // Disable credential prompting
          GIT_ASKPASS: "echo", // Return empty credentials if asked
        },
      },
    );

    const cloneStdout = await cloneResult.stdout.readText();
    const cloneStderr = await cloneResult.stderr.readText();
    const cloneExitCode = await cloneResult.wait();

    if (cloneExitCode !== 0) {
      throw new Error(
        `Failed to clone template: ${cloneStderr || cloneStdout}`,
      );
    }

    logger.info({ msg: "Template cloned successfully" });

    // Move files from temp-clone to workspace root
    await sandbox.exec(
      ["sh", "-c", "mv temp-clone/* temp-clone/.[!.]* . 2>/dev/null || true"],
      {
        mode: "text",
        stdout: "pipe",
        stderr: "pipe",
        workdir: "/workspace",
      },
    );

    // Remove temp-clone directory
    await sandbox.exec(["rm", "-rf", "temp-clone"], {
      mode: "text",
      stdout: "pipe",
      stderr: "pipe",
      workdir: "/workspace",
    });

    // Remove existing .git directory
    await sandbox.exec(["rm", "-rf", ".git"], {
      mode: "text",
      stdout: "pipe",
      stderr: "pipe",
      workdir: "/workspace",
    });

    logger.info({ msg: "Initializing fresh git repository" });

    // Initialize fresh git repository
    await sandbox.exec(["git", "init"], {
      mode: "text",
      stdout: "pipe",
      stderr: "pipe",
      workdir: "/workspace",
    });

    await sandbox.exec(["git", "config", "user.name", "Shipper AI"], {
      mode: "text",
      stdout: "pipe",
      stderr: "pipe",
      workdir: "/workspace",
    });

    await sandbox.exec(["git", "config", "user.email", "ai@shipper.dev"], {
      mode: "text",
      stdout: "pipe",
      stderr: "pipe",
      workdir: "/workspace",
    });

    await sandbox.exec(["git", "add", "."], {
      mode: "text",
      stdout: "pipe",
      stderr: "pipe",
      workdir: "/workspace",
    });

    await sandbox.exec(
      ["git", "commit", "-m", "Initial commit from template"],
      {
        mode: "text",
        stdout: "pipe",
        stderr: "pipe",
        workdir: "/workspace",
      },
    );

    await sandbox.exec(["git", "branch", "-M", "main"], {
      mode: "text",
      stdout: "pipe",
      stderr: "pipe",
      workdir: "/workspace",
    });

    logger.info({
      msg: "Template cloned and git initialized",
      templateName,
    });

    // Install dependencies with bun
    logger.info({ msg: "Installing dependencies with bun" });

    const installCommand = ["bun", "install"];

    const installResult = await sandbox.exec(installCommand, {
      mode: "text",
      stdout: "pipe",
      stderr: "pipe",
      workdir: "/workspace",
    });

    const installStdout = await installResult.stdout.readText();
    const installStderr = await installResult.stderr.readText();
    const installExitCode = await installResult.wait();

    if (installExitCode !== 0) {
      logger.warn({
        msg: "Dependency installation failed",
        error: installStderr || installStdout,
      });
      // Don't throw - continue even if installation fails
    } else {
      logger.info({ msg: "Dependencies installed successfully" });
    }

    // Update vite.config.ts with HMR WebSocket configuration
  } catch (error) {
    logger.error({
      msg: "Error cloning template",
      templateName,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to clone template",
      cause: error,
    });
  }
}

/**
 * Execute a command in the Modal sandbox
 */
export async function executeCommand(
  sandboxId: string,
  command: string,
  _options?: { timeoutMs?: number },
  logger: Logger = defaultLogger,
): Promise<ModalExecutionResult> {
  logger.info({
    msg: "Executing command in sandbox",
    sandboxId,
    command,
  });

  try {
    const sandbox = await modalClient.sandboxes.fromId(sandboxId);

    // Parse command string into array
    const commandArray = parseCommand(command);

    // Execute command
    const process = await sandbox.exec(commandArray, {
      mode: "text",
      stdout: "pipe",
      stderr: "pipe",
      workdir: "/workspace",
    });

    // Read stdout and stderr
    const [stdout, stderr] = await Promise.all([
      process.stdout.readText(),
      process.stderr.readText(),
    ]);

    // Wait for process to complete
    const exitCode = await process.wait();

    const result: ModalExecutionResult = {
      stdout,
      stderr,
      exitCode,
    };

    logger.info({
      msg: "Command executed",
      sandboxId,
      exitCode,
      stdoutLength: stdout.length,
      stderrLength: stderr.length,
    });

    return result;
  } catch (error) {
    // Extract detailed error information
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorDetails =
      error && typeof error === "object"
        ? JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
        : String(error);

    logger.error({
      msg: "Error executing command",
      sandboxId,
      command,
      error: errorMessage,
      errorDetails,
    });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to execute command: ${errorMessage}`,
      cause: error,
    });
  }
}

/**
 * Parse command string into array (simple implementation)
 */
function parseCommand(command: string): string[] {
  // Simple shell command parsing - handles quoted strings
  const args: string[] = [];
  let current = "";
  let inQuotes = false;
  let quoteChar = "";

  for (let i = 0; i < command.length; i++) {
    const char = command[i];

    if ((char === '"' || char === "'") && !inQuotes) {
      inQuotes = true;
      quoteChar = char;
    } else if (char === quoteChar && inQuotes) {
      inQuotes = false;
      quoteChar = "";
    } else if (char === " " && !inQuotes) {
      if (current) {
        args.push(current);
        current = "";
      }
    } else {
      current += char;
    }
  }

  if (current) {
    args.push(current);
  }

  return args;
}

/**
 * Read a file from the Modal sandbox
 */
export async function readFile(
  sandboxId: string,
  filePath: string,
  logger: Logger = defaultLogger,
): Promise<string> {
  logger.info({
    msg: "Reading file from sandbox",
    sandboxId,
    filePath,
  });

  try {
    const sandbox = await modalClient.sandboxes.fromId(sandboxId);
    const fullPath = `/workspace/${filePath}`;

    const file = await sandbox.open(fullPath, "r");
    const data = await file.read();
    await file.close();

    const content = new TextDecoder().decode(data);

    logger.info({
      msg: "File read",
      sandboxId,
      filePath,
      bytes: content.length,
    });
    return content;
  } catch (error) {
    logger.error({
      msg: "Error reading file",
      sandboxId,
      filePath,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to read file",
      cause: error,
    });
  }
}

/**
 * Write a file to the Modal sandbox
 */
export async function writeFile(
  sandboxId: string,
  filePath: string,
  content: string,
  logger: Logger = defaultLogger,
): Promise<void> {
  logger.info({
    msg: "Writing file to sandbox",
    sandboxId,
    filePath,
    bytes: content.length,
  });

  try {
    const sandbox = await modalClient.sandboxes.fromId(sandboxId);
    const fullPath = `/workspace/${filePath}`;

    // Ensure parent directory exists
    const dirPath = fullPath.substring(0, fullPath.lastIndexOf("/"));
    if (dirPath) {
      await sandbox.exec(["mkdir", "-p", dirPath]);
    }

    const file = await sandbox.open(fullPath, "w");
    await file.write(new TextEncoder().encode(content));
    await file.close();

    logger.info({
      msg: "File written",
      sandboxId,
      filePath,
    });
  } catch (error) {
    logger.error({
      msg: "Error writing file",
      sandboxId,
      filePath,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to write file",
      cause: error,
    });
  }
}

/**
 * List files in the Modal sandbox
 * Excludes node_modules, build artifacts, and other non-source directories
 */
export async function listFiles(
  sandboxId: string,
  logger: Logger = defaultLogger,
): Promise<Map<string, { size: number; modified: number }>> {
  logger.info({
    msg: "Listing files in sandbox",
    sandboxId,
  });

  try {
    const sandbox = await modalClient.sandboxes.fromId(sandboxId);

    // Use find command with exclusions for common non-source directories
    // Exclude: node_modules, .git, dist, build, .next, .turbo, coverage, etc.
    const process = await sandbox.exec(
      [
        "find",
        "/workspace",
        "-type",
        "f",
        "-not",
        "-path",
        "*/node_modules/*",
        "-not",
        "-path",
        "*/.git/*",
        "-not",
        "-path",
        "*/dist/*",
        "-not",
        "-path",
        "*/build/*",
        "-not",
        "-path",
        "*/.next/*",
        "-not",
        "-path",
        "*/.turbo/*",
        "-not",
        "-path",
        "*/coverage/*",
        "-not",
        "-path",
        "*/.cache/*",
        "-not",
        "-path",
        "*/tmp/*",
        "-not",
        "-path",
        "*/.DS_Store",
        "-ls",
      ],
      {
        mode: "text",
        stdout: "pipe",
        stderr: "pipe",
        workdir: "/workspace",
      },
    );

    const stdout = await process.stdout.readText();
    await process.wait();

    // Parse find output
    const files = new Map<string, { size: number; modified: number }>();
    const lines = stdout.split("\n").filter((line) => line.trim());

    for (const line of lines) {
      // Parse find -ls output: inode blocks perms links owner group size date time path
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 11) {
        const size = parseInt(parts[6], 10);
        const filePath = parts.slice(10).join(" ");

        // Remove /workspace/ prefix
        const relativePath = filePath.replace(/^\/workspace\//, "");

        // Additional filter: skip hidden files at root level, but allow .env* files
        const isHiddenFile = relativePath.startsWith(".");
        const isEnvFile = /^\.env(\..+)?$/.test(relativePath); // .env, .env.local, .env.production, etc.

        if (relativePath && (!isHiddenFile || isEnvFile)) {
          files.set(relativePath, {
            size: isNaN(size) ? 0 : size,
            modified: Date.now(),
          });
        }
      }
    }

    logger.info({
      msg: "Found source files",
      sandboxId,
      fileCount: files.size,
      note: "excluding node_modules, build artifacts",
    });
    return files;
  } catch (error) {
    logger.error({
      msg: "Error listing files - sandbox is likely terminated",
      sandboxId,
      error: error instanceof Error ? error.message : String(error),
    });
    // If we can't list files, the sandbox container is terminated/dead
    // Throw error so health check detects it and triggers recovery
    throw new Error(
      `Failed to list files - sandbox ${sandboxId} is terminated or unreachable`,
    );
  }
}

/**
 * Get sandbox status
 */
export async function getSandboxStatus(
  sandboxId: string,
  logger: Logger = defaultLogger,
): Promise<{
  sandboxId: string;
  status: string;
  sandboxUrl: string | null;
  fileCount: number;
}> {
  logger.info({
    msg: "Getting status for sandbox",
    sandboxId,
  });

  try {
    const sandbox = await modalClient.sandboxes.fromId(sandboxId);
    const files = await listFiles(sandboxId, logger);

    // Try to get tunnels
    let sandboxUrl: string | null = null;
    try {
      const tunnels = await sandbox.tunnels(5000); // 5 second timeout
      // Get first available tunnel
      const ports = Object.keys(tunnels);
      if (ports.length > 0) {
        const firstPort = parseInt(ports[0], 10);
        const originalUrl = tunnels[firstPort].url;
        // Get projectId from database to transform URL
        const project = await prisma.project.findFirst({
          where: { sandboxId },
          select: { id: true },
        });
        if (project) {
          // Transform URL for return (original is stored in DB)
          sandboxUrl = transformModalUrlToShipperDomain(
            originalUrl,
            project.id,
          );
        } else {
          sandboxUrl = originalUrl;
        }
      }
    } catch (error) {
      logger.warn({
        msg: "No tunnels available for sandbox",
        sandboxId,
      });
    }

    return {
      sandboxId: sandbox.sandboxId,
      status: "running",
      sandboxUrl,
      fileCount: files.size,
    };
  } catch (error) {
    logger.error({
      msg: "Error getting sandbox status",
      sandboxId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to get sandbox status",
      cause: error,
    });
  }
}

/**
 * Start dev server in Modal sandbox
 * Starts the dev server on port 8080 and returns the tunnel URL
 */
export async function startDevServer(
  sandboxId: string,
  _projectId: string,
  port: number = 8080,
  logger: Logger = defaultLogger,
): Promise<string> {
  logger.info({
    msg: "Starting dev server in sandbox",
    sandboxId,
    port,
  });

  try {
    const sandbox = await modalClient.sandboxes.fromId(sandboxId);

    // For Vite 7 + Tailwind CSS v4: Use a smart startup script that waits for optimization
    // This prevents the "Outdated Optimize Dep" 504 errors by ensuring deps are ready before serving
    // Also force Tailwind CSS rebuild by touching the CSS file to prevent stale style caching
    const devCommand = createViteDevServerCommand(port);

    const projectLogger =
      logger === defaultLogger ? createProjectLogger(_projectId) : logger;
    projectLogger.info({
      msg: "Executing dev server command with optimization wait and Tailwind CSS cache clear",
      command: getViteDevServerCommandDescription(port),
    });

    const process = await sandbox.exec(devCommand, {
      mode: "text",
      stdout: "pipe",
      stderr: "pipe",
      workdir: "/workspace",
    });

    // Get the PID from stdout
    const pid = await process.stdout.readText();
    await process.wait();

    projectLogger.info({
      msg: "Dev server started in background",
      pid: pid.trim(),
      port,
    });

    // Wait for server to start
    projectLogger.info({ msg: "Waiting for dev server to start" });
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Get tunnel URL (already created via encryptedPorts during sandbox creation)
    projectLogger.info({ msg: "Getting tunnel URL", port });
    const tunnels = await sandbox.tunnels();

    const devServerUrl = tunnels[port]?.url;

    if (!devServerUrl) {
      throw new Error(
        `No tunnel available for port ${port}. Available ports: ${Object.keys(tunnels).join(", ") || "none"}`,
      );
    }

    projectLogger.info({
      msg: "Dev server started successfully",
      devServerUrl,
    });

    // Update project with the original Modal dev server URL (store in DB)
    await prisma.project.update({
      where: { id: _projectId },
      data: {
        sandboxUrl: devServerUrl, // Store original Modal URL
      },
    });

    projectLogger.info({
      msg: "Dev server URL stored in database",
      devServerUrl,
    });

    // Set up monitoring after dev server is running
    // Run in background - don't block the function
    setupModalSandboxMonitoring(sandbox, sandboxId, _projectId, logger).catch(
      (error) => {
        logger.error({
          msg: "Monitoring setup failed (non-critical)",
          error: error instanceof Error ? error.message : String(error),
        });
      },
    );

    // Transform URL for return
    const transformedUrl = transformModalUrlToShipperDomain(
      devServerUrl,
      _projectId,
    );

    return transformedUrl;
  } catch (error) {
    const projectLogger =
      logger === defaultLogger ? createProjectLogger(_projectId) : logger;

    // Extract detailed error information
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorDetails =
      error && typeof error === "object"
        ? JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
        : String(error);

    projectLogger.error({
      msg: "Error starting dev server",
      sandboxId,
      projectId: _projectId,
      error: errorMessage,
      errorDetails,
    });

    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to start dev server: ${errorMessage}`,
      cause: error,
    });
  }
}

/**
 * Close Modal client (cleanup)
 */
export function closeModalClient(): void {
  defaultLogger.info({ msg: "Closing Modal client" });
  modalClient.close();
}

// ===== API Route Helpers (sandboxId-based) =====

/**
 * Restore V2 fragment by sandboxId (for API routes)
 */
export async function restoreV2FragmentById(
  sandboxId: string,
  fragmentId: string,
  projectId: string,
  logger: Logger = defaultLogger,
): Promise<void> {
  const sandbox = await modalClient.sandboxes.fromId(sandboxId);
  return restoreV2FragmentInSandbox(sandbox, fragmentId, projectId, logger);
}

/**
 * Restore files by sandboxId (for API routes)
 */
export async function restoreFilesById(
  sandboxId: string,
  files: { [path: string]: string },
  logger: Logger = defaultLogger,
): Promise<void> {
  const sandbox = await modalClient.sandboxes.fromId(sandboxId);
  return restoreFilesInSandbox(sandbox, files, logger);
}

/**
 * Find files matching a pattern (for API routes)
 */
export async function findFiles(
  sandboxId: string,
  pattern: string,
  logger: Logger = defaultLogger,
): Promise<string[]> {
  const sandbox = await modalClient.sandboxes.fromId(sandboxId);

  try {
    // Use find command to search for files matching the pattern
    const result = await sandbox.exec([
      "find",
      "/workspace",
      "-type",
      "f",
      "-name",
      pattern,
    ]);

    const output = await result.wait();

    if (output === 0) {
      const stdout = await result.stdout.readText();
      return stdout
        .split("\n")
        .filter((line: string) => line.trim())
        .map((line: string) => line.replace("/workspace/", ""));
    }

    return [];
  } catch (error) {
    logger.error({
      msg: "Error finding files",
      sandboxId,
      pattern,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
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
    return buildOutputMatch[1].trim();
  }

  return logs
    .replace(/Deployment URL: https?:\/\/[^\s]+/g, "Deployment URL: [HIDDEN]")
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
  logger: Logger = defaultLogger,
): Promise<{
  success: boolean;
  deploymentUrl?: string;
  error?: string;
  logs: string;
}> {
  const projectLogger =
    logger === defaultLogger ? createProjectLogger(projectId) : logger;

  try {
    projectLogger.info({
      msg: "Starting deployment for project",
      projectId,
    });

    const deploymentUrl = process.env.DEPLOYMENT_PLANE_URL;
    if (!deploymentUrl) {
      throw new Error(
        "DEPLOYMENT_PLANE_URL environment variable is not configured",
      );
    }

    projectLogger.info({
      msg: "Using deployment URL from env",
      deploymentUrl,
    });

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
      projectLogger.info({
        msg: "Attempting zip/curl deployment",
        appName: sanitizedAppName,
      });

      return await deployWithZipCurl(
        sandbox,
        projectId,
        sanitizedAppName,
        deploymentUrl,
        projectLogger,
      );
    } catch (zipError) {
      const errorMessage =
        zipError instanceof Error ? zipError.message : String(zipError);

      // Check if this is a build error - if so, don't fall back, return immediately
      const isBuildError =
        errorMessage.includes("Failed to build application") ||
        errorMessage.includes("error TS") ||
        errorMessage.includes("build command failed") ||
        errorMessage.includes("Build failed");

      if (isBuildError) {
        projectLogger.error({
          msg: "Build failed, not attempting fallback",
          error: errorMessage,
        });
        // Re-throw build errors immediately - don't fall back
        throw zipError;
      }

      projectLogger.warn({
        msg: "Zip/curl deployment failed, falling back to Node.js script",
        error: errorMessage,
      });

      // Fall back to Node.js script approach (only for non-build errors)
      projectLogger.info({
        msg: "Creating Node.js deployment script",
        appName: sanitizedAppName,
      });

      return await deployWithNodeScript(
        sandbox,
        projectId,
        sanitizedAppName,
        deploymentUrl,
        projectLogger,
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    projectLogger.error({
      msg: "Failed to deploy sandbox app",
      projectId,
      error: errorMessage,
    });

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
  logger: Logger,
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

  // Step 0: Remove monitoring script from index.html before building
  // The monitoring script is only needed for dev/preview, not for production builds
  logger.info({
    msg: "Removing monitoring script from index.html before build",
  });
  try {
    const indexHtmlPath = "/workspace/index.html";
    const indexHtmlFile = await sandbox.open(indexHtmlPath, "r");
    const indexHtmlData = await indexHtmlFile.read();
    await indexHtmlFile.close();
    let indexHtmlContent = new TextDecoder().decode(indexHtmlData);

    // Remove monitoring script reference if present
    if (indexHtmlContent.includes(".shipper/monitor.js")) {
      // Remove the script tag that references the monitoring script
      indexHtmlContent = indexHtmlContent.replace(
        /<script[^>]*src=["']\/\.shipper\/monitor\.js["'][^>]*><\/script>\s*/gi,
        "",
      );

      // Write the cleaned HTML back
      const cleanedHtmlFile = await sandbox.open(indexHtmlPath, "w");
      await cleanedHtmlFile.write(new TextEncoder().encode(indexHtmlContent));
      await cleanedHtmlFile.close();

      logger.info({ msg: "Removed monitoring script from index.html" });
    }
  } catch (cleanupError) {
    logger.warn({
      msg: "Failed to remove monitoring script from index.html",
      error:
        cleanupError instanceof Error
          ? cleanupError.message
          : String(cleanupError),
    });
    // Continue with build even if cleanup fails - might not have monitoring script
  }

  // Step 1: Build the application
  logger.info({ msg: "Building application" });
  const buildProcess = await sandbox.exec(
    ["sh", "-c", "cd /workspace && bun run build"],
    {
      mode: "text",
      stdout: "pipe",
      stderr: "pipe",
      workdir: "/workspace",
    },
  );

  const buildExitCode = await buildProcess.wait();
  const buildStdout = await buildProcess.stdout.readText();
  const buildStderr = await buildProcess.stderr.readText();

  if (buildExitCode !== 0) {
    // Extract detailed error information from build output
    // Combine both stdout and stderr to capture all error information
    const buildOutput =
      [buildStdout, buildStderr].filter(Boolean).join("\n") ||
      "build command failed";

    logger.error({
      msg: "Build failed",
      exitCode: buildExitCode,
      stdoutLength: buildStdout.length,
      stderrLength: buildStderr.length,
      hasTypeScriptErrors: buildOutput.includes("error TS"),
    });

    // Include full error details - especially important for TypeScript errors
    const errorMessage = buildOutput.includes("error TS")
      ? `Failed to build application - TypeScript errors:\n${buildOutput}` // TypeScript errors - include full output
      : `Failed to build application:\n${buildOutput}`;
    throw new Error(errorMessage);
  }

  logger.info({ msg: "Application built successfully" });

  // Step 2: Determine build output directory
  const detectBuildDirProcess = await sandbox.exec(
    [
      "sh",
      "-c",
      "cd /workspace && (test -d dist && echo 'dist') || (test -d build && echo 'build') || (test -d out && echo 'out') || echo '.'",
    ],
    {
      mode: "text",
      stdout: "pipe",
      stderr: "pipe",
      workdir: "/workspace",
    },
  );
  await detectBuildDirProcess.wait();
  const buildDir =
    (await detectBuildDirProcess.stdout.readText()).trim() || "dist";

  logger.info({ msg: "Using build directory", buildDir });

  // Step 3: Create zip file of build output
  const createZipProcess = await sandbox.exec(
    ["sh", "-c", `cd /workspace/${buildDir} && zip -r /tmp/${zipFileName} .`],
    {
      mode: "text",
      stdout: "pipe",
      stderr: "pipe",
      workdir: "/workspace",
    },
  );

  const zipExitCode = await createZipProcess.wait();
  const zipStderr = await createZipProcess.stderr.readText();

  if (zipExitCode !== 0) {
    throw new Error(
      `Failed to create zip file from build output: ${
        zipStderr || "zip command not available or failed"
      }`,
    );
  }

  logger.info({
    msg: "Zip file created successfully",
    buildDir,
    zipFileName,
  });

  // Step 4: Deploy using curl with enhanced error reporting
  const curlCommand = `curl -s --show-error -w "\\nHTTP_STATUS_CODE:%{http_code}" --connect-timeout 30 --max-time 120 -X POST -H "bypass-tunnel-reminder: true" -H "Authorization: Bearer ${apiKey}" -F "projectId=${projectId}" -F "name=${sanitizedAppName}" -F "app=@/tmp/${zipFileName}" "${deploymentUrl}/api/deploy"`;

  logger.info({
    msg: "Deploying via curl",
    deploymentUrl: `${deploymentUrl}/api/deploy`,
    projectId,
    appName: sanitizedAppName,
  });

  // Try deployment with retry logic
  let deployProcess;
  let deployExitCode: number = -1;
  let deployStdout: string = "";
  let deployStderr: string = "";
  let deployResult: string = "";
  let retryCount = 0;
  const maxRetries = 2;

  while (retryCount <= maxRetries) {
    if (retryCount > 0) {
      logger.info({
        msg: "Retrying deployment",
        attempt: retryCount + 1,
        maxRetries: maxRetries + 1,
      });
      // Wait a bit before retry
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    deployProcess = await sandbox.exec(["sh", "-c", curlCommand], {
      mode: "text",
      stdout: "pipe",
      stderr: "pipe",
      workdir: "/workspace",
    });

    deployExitCode = await deployProcess.wait();
    deployStdout = await deployProcess.stdout.readText();
    deployStderr = await deployProcess.stderr.readText();
    deployResult = deployStdout || deployStderr;

    // Check if we got a successful response or should retry
    if (deployExitCode === 0 && deployResult) {
      // Check for connection errors that warrant a retry
      if (
        deployResult.includes(
          '"error":"Deployment failed: Deployment validation failed: Error: closed"',
        )
      ) {
        logger.info({
          msg: "Connection closed error detected, will retry if attempts remain",
        });
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

  if (!deployProcess || deployExitCode === -1) {
    throw new Error("Deployment result is undefined");
  }

  // Step 5: Clean up temporary zip file
  try {
    await sandbox.exec(["rm", "-f", `/tmp/${zipFileName}`], {
      mode: "text",
      stdout: "pipe",
      stderr: "pipe",
      workdir: "/workspace",
    });
  } catch (cleanupError) {
    logger.warn({
      msg: "Failed to clean up zip file",
      error:
        cleanupError instanceof Error
          ? cleanupError.message
          : String(cleanupError),
    });
  }

  const logs = filterSensitiveLogs(
    [
      `Build: ${buildStdout || "Success"}`,
      `Build Directory: ${buildDir}`,
      `ZIP Creation: Success`,
      `Deployment Response: ${deployResult || "No response"}`,
    ].join("\n"),
  );

  // Extract HTTP status code if present
  let httpStatusCode: string | undefined;
  let responseText = deployResult || "";

  const statusMatch = responseText.match(/HTTP_STATUS_CODE:(\d+)/);
  if (statusMatch) {
    httpStatusCode = statusMatch[1];
    // Remove the status code from the response text
    responseText = responseText.replace(/\nHTTP_STATUS_CODE:\d+/, "");
  }

  logger.info({
    msg: "Raw deployment response",
    exitCode: deployExitCode,
    httpStatusCode,
    responseLength: responseText.length,
  });

  if (deployExitCode === 0) {
    // Try to parse deployment response for deployment URL
    let actualDeploymentUrl: string | undefined;

    try {
      const response = JSON.parse(responseText);
      // Check if the deployment was successful
      if (response.error) {
        const errorMessage = `Deployment failed: ${response.error || "Unknown error"}`;
        throw new Error(errorMessage);
      }
      actualDeploymentUrl =
        response.url || response.deploymentUrl || response.link;

      logger.info({
        msg: "Extracted deployment URL from JSON",
        deploymentUrl: response.deploymentUrl,
        url: response.url,
        link: response.link,
        actualDeploymentUrl,
      });

      if (actualDeploymentUrl) {
        actualDeploymentUrl = actualDeploymentUrl.replace(/["}'\]]+$/, "");

        // Force HTTPS for staging/production deployments
        actualDeploymentUrl = forceHttpsForDeployments(
          actualDeploymentUrl,
          "ModalSandboxManager",
        );
      }
    } catch (parseError) {
      // Check if this is a deployment failure we threw ourselves
      if (
        parseError instanceof Error &&
        parseError.message.startsWith("Deployment failed:")
      ) {
        // Re-throw deployment failures immediately
        throw parseError;
      }

      // Check if we got an HTML response (indicates deployment service issue)
      if (
        responseText.includes("<html>") ||
        responseText.includes("<!DOCTYPE")
      ) {
        logger.warn({
          msg: "Received HTML response instead of JSON - deployment service may not be running",
        });
        throw new Error(
          "Deployment service returned HTML instead of JSON response. The deployment service may not be running or accessible.",
        );
      }

      // Look for deployment URLs, but exclude static assets and ngrok landing page URLs
      const urlMatches = responseText.match(/https?:\/\/[^\s"'}<>]+/g) || [];
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

      logger.info({
        msg: "Valid deployment URLs found",
        validDeploymentUrls,
      });

      if (validDeploymentUrls.length > 0) {
        actualDeploymentUrl = validDeploymentUrls[0].replace(/["}'\]]+$/, "");

        // Force HTTPS for staging/production deployments
        actualDeploymentUrl = forceHttpsForDeployments(
          actualDeploymentUrl,
          "ModalSandboxManager",
        );

        logger.info({
          msg: "Selected deployment URL",
          actualDeploymentUrl,
        });
      }
    }

    logger.info({
      msg: "Zip/curl deployment successful",
      projectId,
      deploymentUrl: actualDeploymentUrl,
    });

    return {
      success: true,
      deploymentUrl: actualDeploymentUrl,
      logs,
    };
  } else {
    throw new Error(
      `Curl deployment failed: ${deployResult || "curl command failed"}`,
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
  logger: Logger,
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

// Global error handlers to catch any uncaught errors
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err.message);
  console.error('Stack:', err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION:', reason);
  process.exit(1);
});

async function deployApp() {
  try {
    console.log('Starting deployment process...');
    console.log('App Name:', '${sanitizedAppName}');

    const deploymentUrl = '${deploymentUrl}';
    const appName = '${sanitizedAppName}';
    const apiKey = '${apiKey}';
    
    // Step 0: Remove monitoring script from index.html before building
    // The monitoring script is only needed for dev/preview, not for production builds
    console.log('Removing monitoring script from index.html before build...');
    try {
      const indexHtmlPath = '/workspace/index.html';
      if (fs.existsSync(indexHtmlPath)) {
        let indexHtmlContent = fs.readFileSync(indexHtmlPath, 'utf8');
        
        // Remove monitoring script reference if present
        if (indexHtmlContent.includes('.shipper/monitor.js')) {
          // Remove the script tag that references the monitoring script
          // Double-escape backslashes because this code is in a template string that gets executed via node -e
          // The backslashes will be consumed during: 1) template string evaluation, 2) shell escaping, 3) node -e evaluation
          const monitorScriptRegex = /<script[^>]*src=["']\\/\\.shipper\\/monitor\\.js["'][^>]*>\\s*<\\/script>/gi;
          indexHtmlContent = indexHtmlContent.replace(monitorScriptRegex, '');
          
          // Write the cleaned HTML back
          fs.writeFileSync(indexHtmlPath, indexHtmlContent, 'utf8');
          console.log('Removed monitoring script from index.html');
        }
      }
    } catch (cleanupError) {
      console.warn('Failed to remove monitoring script from index.html:', cleanupError.message);
      // Continue with build even if cleanup fails - might not have monitoring script
    }
    
    // Build the application first
    console.log('Building application...');
    const { execSync } = require('child_process');

    try {
      // Skip TypeScript compilation during build to reduce memory usage in resource-constrained sandbox
      // Use bunx to run vite (which finds it in node_modules/.bin)
      const buildOutput = execSync('bunx vite build 2>&1', {
        cwd: '/workspace',
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
      if (require('fs').existsSync('/workspace/dist')) {
        buildDir = 'dist';
      } else if (require('fs').existsSync('/workspace/build')) {
        buildDir = 'build';
      } else if (require('fs').existsSync('/workspace/out')) {
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
    const findCommand = \`find /workspace/\${buildDir} -type f | head -500\`;
    
    console.log('Executing find command...');
    const findOutput = execSync(findCommand, { encoding: 'utf8' });
    console.log('Find command completed, processing results...');
    
    const filePaths = findOutput
      .split('\\n')
      .filter(p => p.trim() && p.startsWith('/workspace/'))
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
        const relativePath = fullPath.replace(\`/workspace/\${buildDir}/\`, '');
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
    let payload;
    try {
      payload = JSON.stringify({ projectId: '${projectId}', name: appName, files });
      console.log(\`Payload size: \${payload.length} bytes\`);
    } catch (jsonError) {
      console.error('Failed to stringify payload:', jsonError.message);
      throw new Error('Failed to create JSON payload: ' + jsonError.message);
    }

    console.log('Parsing deployment URL:', deploymentUrl);
    let url;
    try {
      url = new URL(deploymentUrl + '/api/deploy/direct');
      console.log('Parsed URL successfully:', url.href);
    } catch (urlError) {
      console.error('Failed to parse deployment URL:', urlError.message);
      throw new Error('Invalid deployment URL: ' + deploymentUrl + ' - ' + urlError.message);
    }

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
    console.log(\`Target: \${url.hostname}:\${options.port}\${url.pathname}\`);
    console.log(\`Request headers: Content-Length=\${headers['Content-Length']}\`);

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
  logger.info({
    msg: "Executing Node.js deployment script",
    appName: sanitizedAppName,
  });
  logger.info({
    msg: "Deployment URL",
    deploymentUrl: `${deploymentUrl}/api/deploy`,
  });

  // Execute deployment script directly using node -e
  // Escape single quotes in the script for shell safety
  const escapedScript = deploymentScript.replace(/'/g, "'\\''");

  const deployProcess = await sandbox.exec(
    ["sh", "-c", `node -e '${escapedScript}'`],
    {
      mode: "text",
      stdout: "pipe",
      stderr: "pipe",
      workdir: "/workspace",
    },
  );

  const deployExitCode = await deployProcess.wait();
  const deployStdout = await deployProcess.stdout.readText();
  const deployStderr = await deployProcess.stderr.readText();
  const logs =
    deployStdout || deployStderr || "No output from deployment script";

  logger.info({
    msg: "Deployment script completed",
    exitCode: deployExitCode,
    stdoutLength: deployStdout.length,
    stderrLength: deployStderr.length,
  });

  if (deployExitCode === 0) {
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
        logger.warn({
          msg: "Node.js script received HTML response - deployment service may not be running",
        });
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

    logger.info({
      msg: "Node.js deployment successful",
      projectId,
      deploymentUrl: actualDeploymentUrl,
    });

    return {
      success: true,
      deploymentUrl: actualDeploymentUrl,
      logs,
    };
  } else {
    throw new Error(
      `Node.js deployment script failed with exit code ${deployExitCode}: ${logs}`,
    );
  }
}
