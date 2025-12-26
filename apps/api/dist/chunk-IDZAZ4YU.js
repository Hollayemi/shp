import { createRequire } from 'module';const require = createRequire(import.meta.url);
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

// src/services/modal-sandbox-manager.ts
init_esm_shims();
import { ModalClient } from "modal";
import { TRPCError } from "@trpc/server";

// src/utils/deployment-url.ts
init_esm_shims();
function forceHttpsForDeployments(deploymentUrl, context) {
  const originalUrl = deploymentUrl;
  if (deploymentUrl.startsWith("http://") && (deploymentUrl.includes(".deploy-staging.shipper.now") || deploymentUrl.includes(".deploy.shipper.now"))) {
    const convertedUrl = deploymentUrl.replace("http://", "https://");
    console.log(`[${context}] Converted deployment URL from HTTP to HTTPS:`, {
      originalUrl,
      convertedUrl
    });
    return convertedUrl;
  }
  return deploymentUrl;
}

// src/services/modal-snapshots.ts
init_esm_shims();
var MODAL_SNAPSHOTS = {
  // Example entries (update with actual image IDs after running create-modal-snapshot.ts):
  // "calculator-template": {
  //   imageId: "im-xxxxxxxxxxxxxx",
  //   description: "Calculator template",
  //   createdAt: "2025-01-29",
  //   version: "v1",
  // },
  // "database-vite-todo-template": {
  //   imageId: "im-xxxxxxxxxxxxxx",
  //   description: "Database Vite Todo template",
  //   createdAt: "2025-01-29",
  //   version: "v1",
  // },
  // "vite-template": {
  //   imageId: "im-xxxxxxxxxxxxxx", // Main/production environment
  //   devImageId: "im-yyyyyyyyyyyyyy", // Development environment (optional)
  //   description: "Base Vite + React template (main branch)",
  //   createdAt: "2025-01-29",
  //   version: "v1",
  // },
  "database-vite-template": {
    imageId: "im-BtQaOaga9rKaqJEQ06TJBP",
    devImageId: "im-oOBbQUYV31mU1DAf7YvKug",
    description: "database-vite-template template",
    createdAt: "2025-11-26",
    version: "v12"
  },
  "database-vite-todo-template": {
    imageId: "im-WX5emDijDwwnj7Csp9yVCl",
    devImageId: "im-r8do7zgmgsfQ6NAnZ16oeD",
    description: "database-todo-template template",
    createdAt: "2025-11-26",
    version: "v12"
  },
  "database-vite-calculator-template": {
    imageId: "im-dCKhTNXCYzwmrd7a0dEzXr",
    devImageId: "im-lxSoOCM2qJ0khoFFmdWtFG",
    description: "database-calculator-template template",
    createdAt: "2025-11-26",
    version: "v12"
  },
  "database-vite-content-sharing-template": {
    imageId: "im-qA61sJrU8vEVk9pqFOa2rG",
    devImageId: "im-VNaAvOwLiaRFuUJTbJGRhl",
    description: "database-content-sharing-template template",
    createdAt: "2025-11-26",
    version: "v12"
  },
  "database-vite-landing-page-template": {
    imageId: "im-3R2HBe39WKlLcTvUMsAwwq",
    devImageId: "im-O3dBPWUERCMx1CffqIw6vL",
    description: "database-landing-page-template template",
    createdAt: "2025-11-26",
    version: "v12"
  },
  "database-vite-tracker-template": {
    imageId: "im-bcowjZ8dSXzGSxX6nyyvQJ",
    devImageId: "im-2ipi7zguRIrnWUod2KsjQ1",
    description: "database-tracker-template template",
    createdAt: "2025-11-26",
    version: "v12"
  },
  // TanStack Templates (TanStack Start + Convex backend)
  "tanstack-template": {
    imageId: "im-5KUREocgh08oG0OXAFxAwH",
    devImageId: "im-p8X7Nediv8nUXPe2v3EKnU",
    description: "tanstack-template template",
    createdAt: "2025-12-05",
    version: "v1"
  },
  "tanstack-todo-template": {
    imageId: "im-cScxJkjQTbp3QD3LbB4EwJ",
    devImageId: "im-jyEJb0yi6NObfhCNan9ga3",
    description: "tanstack-todo-template template",
    createdAt: "2025-12-05",
    version: "v1"
  },
  "tanstack-calculator-template": {
    imageId: "im-nwUjizbPWbH7ONCQVErJXJ",
    devImageId: "im-vvnTwOZK0NNBzXJKk9PZYu",
    description: "tanstack-calculator-template template",
    createdAt: "2025-12-05",
    version: "v1"
  },
  "tanstack-content-sharing-template": {
    imageId: "im-PXz9n5Z6igigrNZA0CNHTD",
    devImageId: "im-iX59tOxvtbABTPlJ2FMUCp",
    description: "tanstack-content-sharing-template template",
    createdAt: "2025-12-05",
    version: "v1"
  },
  "tanstack-landing-page-template": {
    imageId: "im-dzuOmn2e7ZoRKEUfyzlvMw",
    devImageId: "im-zNxCC2V0RJ0cby2sBVYsY2",
    description: "tanstack-landing-page-template template",
    createdAt: "2025-12-05",
    version: "v1"
  },
  "tanstack-tracker-template": {
    imageId: "im-6ukJpIxQCaLeX7bW9goiEZ",
    devImageId: "im-ylYTUtMayhIBKwVuF3eEJX",
    description: "tanstack-tracker-template template",
    createdAt: "2025-12-05",
    version: "v1"
  },
  // Empty template for imported projects (no pre-configured files)
  // This template starts with a minimal setup for imported codebases
  "shipper-empty-bun-template": {
    imageId: "im-2Lo0DsRhOsNtTlYZ67qfGc",
    devImageId: "im-rhJUt02flMOGZFpc2CZI1p",
    description: "Empty template for imported projects",
    createdAt: "2025-12-13",
    version: "v1"
  }
};
function getSnapshotImageId(templateName, environment = "main") {
  const snapshot = MODAL_SNAPSHOTS[templateName];
  if (!snapshot) {
    return null;
  }
  if (environment === "dev" && snapshot.devImageId) {
    return snapshot.devImageId;
  }
  return snapshot.imageId || null;
}
function hasSnapshot(templateName, environment = "main") {
  const snapshot = MODAL_SNAPSHOTS[templateName];
  if (!snapshot) {
    return false;
  }
  if (environment === "dev") {
    return !!snapshot.devImageId;
  }
  return !!snapshot.imageId;
}

// src/services/modal-sandbox-manager.ts
import {
  generateMonitorScript,
  MONITOR_CONFIG,
  createViteDevServerCommand,
  getViteDevServerCommandDescription
} from "@shipper/shared";

// src/services/shipper-ids-plugin-canonical.ts
init_esm_shims();
var SHIPPER_IDS_PLUGIN_VERSION = "2025-11-25";
var SHIPPER_IDS_PLUGIN_CANONICAL_JS = `// shipper-ids-plugin-version: 2025-11-25
// NOTE: Keep this version in sync with the API's expected version
export const SHIPPER_IDS_PLUGIN_VERSION = "2025-11-25";

import { parse } from "@babel/parser";
import _traverse from "@babel/traverse";
import _generate from "@babel/generator";
import * as t from "@babel/types";
import path from "path";

// Handle default exports for CommonJS modules
const traverse = _traverse.default || _traverse;
const generate = _generate.default || _generate;

export function shipperIdsPlugin() {
  let root = "";

  return {
    name: "vite-plugin-shipper-ids",
    enforce: "pre",

    configResolved(config) {
      root = config.root;
    },

    transform(code, id) {
      // Only process in dev mode
      if (process.env.NODE_ENV !== "development") {
        return null;
      }

      // Only process JSX files
      if (!/\\.jsx$/.test(id)) {
        return null;
      }

      try {
        // Parse and transform
        const ast = parse(code, {
          sourceType: "module",
          plugins: ["jsx"],
        });

        let hasChanges = false;

        // Get relative path from src directory
        const relativePath = path.relative(path.join(root, "src"), id);
        const sourceFile = relativePath.replace(/\\.jsx$/, "");

        traverse(ast, {
          JSXElement(nodePath) {
            const openingElement = nodePath.node.openingElement;
            const elementName = openingElement.name;

            // Check if this is a custom component (PascalCase) or native element
            const isCustomComponent =
              t.isJSXIdentifier(elementName) &&
              /^[A-Z]/.test(elementName.name);

            // For custom components: always add ID (tracks usage site)
            // For native elements: only add ID if element has className
            if (!isCustomComponent) {
              const hasClassName = openingElement.attributes.some(
                (attr) =>
                  t.isJSXAttribute(attr) &&
                  t.isJSXIdentifier(attr.name) &&
                  attr.name.name === "className"
              );

              if (!hasClassName) return;
            }

            // Check if already has data-shipper-id
            const hasId = openingElement.attributes.some(
              (attr) =>
                t.isJSXAttribute(attr) &&
                t.isJSXIdentifier(attr.name) &&
                attr.name.name === "data-shipper-id"
            );

            if (hasId) return;

            // Skip elements with spread attributes
            const hasSpread = openingElement.attributes.some(
              (attr) => t.isJSXSpreadAttribute(attr)
            );

            if (hasSpread) return;

            // Generate stable ID based on location
            const loc = openingElement.loc;
            if (!loc) return;

            const shipperId = \`\${sourceFile}:\${loc.start.line}:\${loc.start.column}\`;

            // Add data-shipper-id attribute
            openingElement.attributes.push(
              t.jsxAttribute(
                t.jsxIdentifier("data-shipper-id"),
                t.stringLiteral(shipperId)
              )
            );

            hasChanges = true;
          },
        });

        if (!hasChanges) return null;

        const output = generate(ast, {}, code);
        return {
          code: output.code,
          map: output.map,
        };
      } catch (error) {
        console.error(
          "[shipper-ids-plugin] Error transforming file:",
          id,
          error
        );
        return null;
      }
    },
  };
}
`;
var SHIPPER_IDS_PLUGIN_CANONICAL = `// shipper-ids-plugin-version: 2025-11-25
// NOTE: Keep this version in sync with the API's expected version in \`ai-tools.ts\`
export const SHIPPER_IDS_PLUGIN_VERSION = "2025-11-25";

import { Plugin } from "vite";
import { parse } from "@babel/parser";
import _traverse, { NodePath } from "@babel/traverse";
import _generate from "@babel/generator";
import * as t from "@babel/types";
import path from "path";

// Handle default exports for CommonJS modules
type TraverseModule = typeof _traverse & { default?: typeof _traverse };
type GenerateModule = typeof _generate & { default?: typeof _generate };

const traverse = (((_traverse as TraverseModule).default || _traverse) as typeof _traverse);
const generate = (((_generate as GenerateModule).default || _generate) as typeof _generate);

export function shipperIdsPlugin(): Plugin {
  let root = "";

  return {
    name: "vite-plugin-shipper-ids",
    enforce: "pre",

    configResolved(config) {
      root = config.root;
    },

    transform(code, id) {
      // Only process in dev mode
      if (process.env.NODE_ENV !== "development") {
        return null;
      }

      // Only process JSX/TSX files
      if (!/\\.[jt]sx$/.test(id)) {
        return null;
      }

      try {
        // Parse and transform
        const ast = parse(code, {
          sourceType: "module",
          plugins: ["jsx", "typescript"],
        });

        let hasChanges = false;

        // Get relative path from src directory
        const relativePath = path.relative(path.join(root, "src"), id);
        const sourceFile = relativePath.replace(/\\.[jt]sx$/, "");

        traverse(ast, {
          JSXElement(path: NodePath<t.JSXElement>) {
            const { openingElement } = path.node;
            const elementName = openingElement.name;

            // Check if this is a custom component (PascalCase) or native element
            const isCustomComponent =
              t.isJSXIdentifier(elementName) &&
              /^[A-Z]/.test(elementName.name);

            // For custom components: always add ID (tracks usage site)
            // For native elements: only add ID if element has className
            if (!isCustomComponent) {
              const hasClassName = openingElement.attributes.some(
                (attr: t.JSXAttribute | t.JSXSpreadAttribute) =>
                  t.isJSXAttribute(attr) &&
                  t.isJSXIdentifier(attr.name) &&
                  attr.name.name === "className"
              );

              if (!hasClassName) return;
            }

            // Check if already has data-shipper-id
            const hasId = openingElement.attributes.some(
              (attr: t.JSXAttribute | t.JSXSpreadAttribute) =>
                t.isJSXAttribute(attr) &&
                t.isJSXIdentifier(attr.name) &&
                attr.name.name === "data-shipper-id"
            );

            if (hasId) return;

            // Skip elements with spread attributes - they pass through props from parent
            // (e.g., <Comp {...props} /> in wrapper components)
            const hasSpread = openingElement.attributes.some(
              (attr: t.JSXAttribute | t.JSXSpreadAttribute) =>
                t.isJSXSpreadAttribute(attr)
            );

            if (hasSpread) return;

            // Generate stable ID based on location with full relative path
            const loc = openingElement.loc;
            if (!loc) return;

            const shipperId = \`\${sourceFile}:\${loc.start.line}:\${loc.start.column}\`;

            // Add data-shipper-id attribute
            openingElement.attributes.push(
              t.jsxAttribute(
                t.jsxIdentifier("data-shipper-id"),
                t.stringLiteral(shipperId)
              )
            );

            hasChanges = true;
          },
        });

        if (!hasChanges) return null;

        const output = generate(ast, {}, code);
        return {
          code: output.code,
          map: output.map,
        };
      } catch (error) {
        console.error(
          "[shipper-ids-plugin] Error transforming file:",
          id,
          error
        );
        return null;
      }
    },
  };
}
`;

// src/services/modal-sandbox-manager.ts
function transformModalUrlToShipperDomain(modalUrl, projectId) {
  const logger2 = createProjectLogger(projectId);
  try {
    const url = new URL(modalUrl);
    const isAlreadyTransformed = url.hostname.includes(`preview--m-${projectId}`) || url.hostname.includes("preview--m-") && url.hostname.includes(".shipper.now");
    if (isAlreadyTransformed) {
      logger2.info({
        msg: "URL already transformed",
        modalUrl
      });
      return modalUrl;
    }
    if (process.env.SKIP_MODAL_URL_TRANSFORM === "true") {
      logger2.info({
        msg: "SKIP_MODAL_URL_TRANSFORM enabled - using original Modal URL",
        originalUrl: modalUrl
      });
      return modalUrl;
    }
    logger2.info({
      msg: "Using original Modal URL (transformation disabled by default)",
      originalUrl: modalUrl
    });
    return modalUrl;
  } catch (error) {
    logger2.error({
      msg: "Failed to parse URL",
      modalUrl,
      error: error instanceof Error ? error.message : String(error)
    });
    return modalUrl;
  }
}
function getModalEnvironment() {
  return process.env.NODE_ENV === "development" ? "dev" : "main";
}
var modalClient = new ModalClient({
  tokenId: process.env.MODAL_TOKEN_ID,
  tokenSecret: process.env.MODAL_TOKEN_SECRET,
  environment: getModalEnvironment()
});
async function setupModalSandboxMonitoring(sandbox, sandboxId, projectId, logger2 = logger) {
  logger2.info({
    msg: "Setting up monitoring for sandbox",
    sandboxId,
    projectId
  });
  try {
    logger2.info("Waiting 2 seconds for dev server to generate index.html");
    await new Promise((resolve) => setTimeout(resolve, 2e3));
    logger2.info({
      msg: "Generating monitor script content",
      sandboxId
    });
    const monitorScriptContent = generateMonitorScript(
      MONITOR_CONFIG.ALLOWED_ORIGINS
    );
    logger2.info("Creating /workspace/.shipper directory");
    await sandbox.exec(["mkdir", "-p", "/workspace/.shipper"]);
    logger2.info("Writing monitor script to /workspace/.shipper/monitor.js");
    const monitorFile = await sandbox.open(
      "/workspace/.shipper/monitor.js",
      "w"
    );
    logger2.info({
      msg: "Writing monitor script content",
      bytes: monitorScriptContent.length
    });
    await monitorFile.write(new TextEncoder().encode(monitorScriptContent));
    await monitorFile.close();
    logger2.info({
      msg: "Created .shipper/monitor.js",
      sandboxId
    });
    let htmlContent;
    try {
      logger2.info("Opening /workspace/index.html for reading");
      const htmlFile = await sandbox.open("/workspace/index.html", "r");
      const data = await htmlFile.read();
      await htmlFile.close();
      htmlContent = new TextDecoder().decode(data);
      logger2.info({
        msg: "Successfully read index.html",
        bytes: htmlContent.length
      });
    } catch (error) {
      logger2.warn({
        msg: "Failed to read index.html for monitoring injection",
        error: error instanceof Error ? error.message : String(error)
      });
      return;
    }
    if (htmlContent.includes(".shipper/monitor.js")) {
      logger2.info("Monitoring script already present in index.html");
      return;
    }
    logger2.info("Preparing to inject monitoring script");
    const scriptTag = '<script type="module" src="/.shipper/monitor.js"></script>';
    let modifiedHtml = htmlContent;
    let injectionLocation = "unknown";
    if (modifiedHtml.includes("</head>")) {
      modifiedHtml = modifiedHtml.replace(
        "</head>",
        `  ${scriptTag}
  </head>`
      );
      injectionLocation = "before </head>";
    } else if (modifiedHtml.includes("<body")) {
      modifiedHtml = modifiedHtml.replace(
        /<body[^>]*>/,
        (match) => `${match}
  ${scriptTag}`
      );
      injectionLocation = "after <body>";
    } else {
      modifiedHtml = scriptTag + "\n" + modifiedHtml;
      injectionLocation = "prepended to HTML";
    }
    logger2.info({
      msg: "Script injected, writing back to file",
      injectionLocation
    });
    const modifiedFile = await sandbox.open("/workspace/index.html", "w");
    await modifiedFile.write(new TextEncoder().encode(modifiedHtml));
    await modifiedFile.close();
    logger2.info({
      msg: "Successfully injected monitoring script into index.html",
      injectionLocation
    });
  } catch (error) {
    logger2.error({
      msg: "Error setting up monitoring (non-critical)",
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
async function getSandbox(projectId, logger2 = logger) {
  const projectLogger = logger2 === logger ? createProjectLogger(projectId) : logger2;
  projectLogger.info({ msg: "Getting sandbox for project", projectId });
  try {
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
        codeImport: { select: { importedFrom: true } }
      }
    });
    if (!project) {
      projectLogger.info({ msg: "Project not found", projectId });
      return null;
    }
    const importedFrom = project.importedFrom ?? project.codeImport?.importedFrom ?? null;
    projectLogger.info({
      msg: "Project sandbox details",
      sandboxId: project.sandboxId,
      sandboxUrl: project.sandboxUrl
    });
    if (project.sandboxId) {
      try {
        projectLogger.info({
          msg: "Retrieving sandbox",
          sandboxId: project.sandboxId
        });
        const sandbox = await modalClient.sandboxes.fromId(project.sandboxId);
        let isJavaScriptOnly = false;
        try {
          const viteJsCheck = await sandbox.exec([
            "test",
            "-f",
            "/workspace/vite.config.js"
          ]);
          isJavaScriptOnly = await viteJsCheck.wait() === 0;
        } catch {
          isJavaScriptOnly = false;
        }
        projectLogger.info({
          msg: "Checking project type for plugin sync",
          importedFrom,
          isJavaScriptOnly
        });
        if (isJavaScriptOnly) {
          try {
            const oldTsCheck = await sandbox.exec([
              "test",
              "-f",
              "/workspace/plugins/vite-plugin-shipper-ids.ts"
            ]);
            const hasOldTsPlugin = await oldTsCheck.wait() === 0;
            if (hasOldTsPlugin) {
              projectLogger.info({
                msg: "Found old .ts plugin in JS-only sandbox, replacing with .js version"
              });
              await sandbox.exec([
                "rm",
                "-f",
                "/workspace/plugins/vite-plugin-shipper-ids.ts",
                "/workspace/vite.config.ts"
              ]);
              await sandbox.exec(["mkdir", "-p", "/workspace/plugins"]);
              const pluginFile = await sandbox.open(
                "/workspace/plugins/vite-plugin-shipper-ids.js",
                "w"
              );
              await pluginFile.write(
                new TextEncoder().encode(SHIPPER_IDS_PLUGIN_CANONICAL_JS)
              );
              await pluginFile.close();
              projectLogger.info({
                msg: "Successfully replaced .ts plugin with .js for JS-only project"
              });
            }
          } catch (pluginError) {
            projectLogger.warn({
              msg: "Failed to check/replace plugin for JS-only project",
              error: pluginError instanceof Error ? pluginError.message : String(pluginError)
            });
          }
        }
        let transformedUrl = project.sandboxUrl;
        if (transformedUrl) {
          transformedUrl = transformModalUrlToShipperDomain(
            transformedUrl,
            projectId
          );
          projectLogger.info({
            msg: "Transformed sandbox URL",
            originalUrl: project.sandboxUrl,
            transformedUrl
          });
        } else {
          projectLogger.warn({
            msg: "No sandboxUrl in database, attempting to fetch from tunnel",
            sandboxId: project.sandboxId
          });
          try {
            const tunnels = await sandbox.tunnels();
            const tunnel5173 = tunnels[5173];
            if (tunnel5173) {
              const originalUrl = tunnel5173.url;
              transformedUrl = transformModalUrlToShipperDomain(
                originalUrl,
                projectId
              );
              projectLogger.info({
                msg: "Fetched tunnel URL",
                originalUrl,
                transformedUrl
              });
              await prisma.project.update({
                where: { id: projectId },
                data: { sandboxUrl: originalUrl }
              });
            } else {
              projectLogger.warn({
                msg: "No tunnel available on port 5173",
                sandboxId: project.sandboxId
              });
            }
          } catch (tunnelError) {
            projectLogger.error({
              msg: "Failed to fetch tunnel URL",
              sandboxId: project.sandboxId,
              error: tunnelError instanceof Error ? tunnelError.message : String(tunnelError)
            });
          }
        }
        const sandboxInfo = {
          sandbox,
          sandboxId: sandbox.sandboxId,
          sandboxUrl: transformedUrl,
          originalSandboxUrl: project.sandboxUrl,
          // Store original Modal URL
          sandboxExpiresAt: project.sandboxExpiresAt,
          files: /* @__PURE__ */ new Map(),
          projectId,
          status: "running"
        };
        projectLogger.info({
          msg: "Retrieved sandbox",
          sandboxId: project.sandboxId,
          sandboxUrl: transformedUrl,
          originalSandboxUrl: project.sandboxUrl
        });
        return sandboxInfo;
      } catch (error) {
        projectLogger.warn({
          msg: "Failed to retrieve sandbox",
          sandboxId: project.sandboxId,
          error: error instanceof Error ? error.message : String(error)
        });
        await prisma.project.update({
          where: { id: projectId },
          data: {
            sandboxId: null,
            sandboxUrl: null,
            sandboxCreatedAt: null,
            sandboxExpiresAt: null
          }
        });
      }
    }
    projectLogger.info({ msg: "No sandbox found for project" });
    return null;
  } catch (error) {
    projectLogger.error({
      msg: "Error getting sandbox",
      error: error instanceof Error ? error.message : String(error)
    });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to get sandbox",
      cause: error
    });
  }
}
async function createSandbox(projectId, fragmentId, templateName, logger2 = logger, options = {}) {
  const projectLogger = logger2 === logger ? createProjectLogger(projectId) : logger2;
  const {
    recoverySnapshotImageId,
    isImportedProject = false,
    importedFrom = null
  } = options;
  projectLogger.info({
    msg: "createSandbox called",
    projectId,
    fragmentId: fragmentId || null,
    templateName: templateName || null,
    isImportedProject,
    importedFrom,
    optionsReceived: JSON.stringify(options)
  });
  const env = getModalEnvironment();
  const hasTemplateSnapshot = !!templateName && hasSnapshot(templateName, env);
  const enableRecoveryDebug = process.env.RECOVERY_DEBUG === "true" || (process.env.DEBUG || "").includes("sandbox-recovery");
  const logRecoveryDebug = (step, extra) => {
    if (!enableRecoveryDebug) return;
    projectLogger.info({
      msg: "sandbox.recovery",
      step,
      projectId,
      fragmentId: fragmentId || null,
      templateName: templateName || null,
      hasTemplateSnapshot,
      recoverySnapshotImageId: recoverySnapshotImageId || null,
      ...extra
    });
  };
  projectLogger.info({
    msg: "Creating sandbox for project",
    projectId,
    fragmentId: fragmentId || "none",
    template: templateName || "default",
    recoverySnapshotImageId: recoverySnapshotImageId || void 0
  });
  try {
    const app = await modalClient.apps.fromName("shipper-sandboxes", {
      createIfMissing: true
    });
    projectLogger.info({
      msg: "Using Modal app",
      appName: app.name,
      appId: app.appId
    });
    let fragmentSnapshot = null;
    let useFragmentSnapshot = false;
    if (fragmentId) {
      const fragment = await prisma.v2Fragment.findUnique({
        where: { id: fragmentId },
        select: { snapshotImageId: true, files: true }
      });
      if (fragment?.snapshotImageId) {
        projectLogger.info({
          msg: "Fragment has filesystem snapshot",
          fragmentId,
          snapshotImageId: fragment.snapshotImageId
        });
        fragmentSnapshot = {
          snapshotImageId: fragment.snapshotImageId,
          files: fragment.files
        };
        useFragmentSnapshot = true;
      }
    }
    let image;
    let imageDescription;
    let skipFragmentRestoration = false;
    let selectedImageId = null;
    let usedBaseImage = false;
    if (recoverySnapshotImageId) {
      imageDescription = `recovery snapshot ${recoverySnapshotImageId}`;
      projectLogger.info({
        msg: "Using explicit recovery snapshot",
        snapshotImageId: recoverySnapshotImageId
      });
      image = await modalClient.images.fromId(recoverySnapshotImageId);
      selectedImageId = recoverySnapshotImageId;
      skipFragmentRestoration = true;
    } else if (useFragmentSnapshot && fragmentSnapshot) {
      imageDescription = `fragment snapshot ${fragmentSnapshot.snapshotImageId}`;
      projectLogger.info({
        msg: "Using fragment snapshot",
        snapshotImageId: fragmentSnapshot.snapshotImageId,
        note: "complete filesystem state"
      });
      image = await modalClient.images.fromId(fragmentSnapshot.snapshotImageId);
      selectedImageId = fragmentSnapshot.snapshotImageId;
      skipFragmentRestoration = true;
    } else if (templateName && hasTemplateSnapshot) {
      const snapshotImageId = getSnapshotImageId(templateName, env);
      imageDescription = `template snapshot ${snapshotImageId}`;
      projectLogger.info({
        msg: "Using pre-built template snapshot",
        snapshotImageId,
        templateName,
        environment: env
      });
      image = await modalClient.images.fromId(snapshotImageId);
      selectedImageId = snapshotImageId ?? null;
    } else {
      const imageTag = getImageTagForTemplate();
      imageDescription = `base image ${imageTag}`;
      projectLogger.info({
        msg: "Using base image",
        imageTag,
        templateName: templateName || "none",
        note: templateName ? `no snapshot available for ${templateName}` : void 0
      });
      image = modalClient.images.fromRegistry(imageTag);
      usedBaseImage = true;
      if (!templateName) {
        throw new Error(
          "Sandbox recovery requires a template but none was provided. Cannot proceed with bare base image."
        );
      }
    }
    const sandboxParams = {
      timeoutMs: 36e5,
      // 1 hour
      idleTimeoutMs: 9e5,
      // 15 minutes idle timeout
      workdir: "/workspace",
      env: {
        NODE_ENV: "development",
        PROJECT_ID: projectId
      },
      memoryMiB: 2048,
      cpu: 1,
      encryptedPorts: [8e3, 5173]
      // Create tunnel for default dev server port
    };
    projectLogger.info({
      msg: "Creating sandbox",
      imageDescription
    });
    const sandbox = await modalClient.sandboxes.create(
      app,
      image,
      sandboxParams
    );
    projectLogger.info({
      msg: "Sandbox created",
      sandboxId: sandbox.sandboxId
    });
    let sandboxUrl = null;
    try {
      projectLogger.info({ msg: "Getting tunnel URL for sandbox" });
      await new Promise((resolve) => setTimeout(resolve, 2e3));
      const tunnels = await sandbox.tunnels();
      const userTunnel = tunnels[5173];
      if (userTunnel) {
        sandboxUrl = userTunnel.url;
        projectLogger.info({
          msg: "Tunnel URL retrieved",
          sandboxUrl
        });
      } else {
        projectLogger.warn({
          msg: "Tunnel not available yet",
          sandboxId: sandbox.sandboxId
        });
      }
    } catch (error) {
      projectLogger.warn({
        msg: "Could not get tunnel URL",
        sandboxId: sandbox.sandboxId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
    await prisma.project.update({
      where: { id: projectId },
      data: {
        sandboxId: sandbox.sandboxId,
        sandboxUrl,
        // Store original Modal URL
        sandboxCreatedAt: /* @__PURE__ */ new Date(),
        sandboxExpiresAt: null
        // Modal sandboxes don't have fixed expiration
      }
    });
    const transformedUrl = sandboxUrl ? transformModalUrlToShipperDomain(sandboxUrl, projectId) : null;
    const sandboxInfo = {
      sandbox,
      sandboxId: sandbox.sandboxId,
      sandboxUrl: transformedUrl,
      // Return transformed URL to caller
      originalSandboxUrl: sandboxUrl,
      // Store original Modal URL
      files: /* @__PURE__ */ new Map(),
      projectId,
      status: "running"
    };
    logRecoveryDebug("selected-image", {
      sandboxId: sandbox.sandboxId,
      imageDescription,
      selectedImageId,
      usedBaseImage
    });
    if (skipFragmentRestoration) {
      projectLogger.info({
        msg: "Fragment snapshot contains complete filesystem - skipping file restoration"
      });
    } else {
      if (templateName && hasTemplateSnapshot) {
        projectLogger.info({
          msg: "Using template snapshot - template already loaded in sandbox",
          templateName,
          environment: env
        });
      } else if (templateName && !hasTemplateSnapshot) {
        projectLogger.error({
          msg: "Template does not have a snapshot - cannot create sandbox",
          templateName,
          environment: env
        });
        throw new Error(
          `Template "${templateName}" does not have a snapshot for environment "${env}". All templates must have pre-built snapshots.`
        );
      }
      if (fragmentId) {
        projectLogger.info({
          msg: "Restoring fragment files",
          fragmentId,
          isImportedProject
        });
        await restoreV2FragmentInSandbox(
          sandbox,
          fragmentId,
          projectId,
          projectLogger,
          { isImportedProject }
        );
        logRecoveryDebug("restore-fragment", {
          sandboxId: sandbox.sandboxId,
          fragmentId
        });
        if (isImportedProject) {
          projectLogger.info({
            msg: "Installing dependencies for imported project"
          });
          try {
            const installResult = await sandbox.exec(["bun", "install"], {
              mode: "text",
              stdout: "pipe",
              stderr: "pipe",
              workdir: "/workspace",
              timeoutMs: 12e4
              // 2 minute timeout for bun install
            });
            const installExitCode = await installResult.wait();
            const installStderr = await installResult.stderr.readText();
            if (installExitCode === 0) {
              projectLogger.info({
                msg: "Dependencies installed successfully for imported project"
              });
            } else {
              projectLogger.warn({
                msg: "Dependency installation had errors but continuing",
                exitCode: installExitCode,
                stderr: installStderr.substring(0, 500)
                // First 500 chars of error
              });
            }
            if (importedFrom === "BASE44") {
              projectLogger.info({
                msg: "Installing common Base44 platform dependencies"
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
                    timeoutMs: 6e4
                  }
                );
                const addExitCode = await addResult.wait();
                if (addExitCode === 0) {
                  projectLogger.info({
                    msg: "Base44 platform dependencies installed successfully",
                    deps: base44Deps
                  });
                } else {
                  projectLogger.warn({
                    msg: "Some Base44 dependencies may have failed to install",
                    exitCode: addExitCode
                  });
                }
              } catch (addError) {
                projectLogger.warn({
                  msg: "Failed to install Base44 platform dependencies",
                  error: addError instanceof Error ? addError.message : String(addError)
                });
              }
            }
          } catch (installError) {
            projectLogger.warn({
              msg: "Failed to install dependencies for imported project",
              error: installError instanceof Error ? installError.message : String(installError)
            });
          }
        } else {
          projectLogger.info({
            msg: "Skipping bun install - not an imported project",
            isImportedProject
          });
        }
      }
    }
    let isJavaScriptOnly = false;
    try {
      const viteJsCheck = await sandbox.exec([
        "test",
        "-f",
        "/workspace/vite.config.js"
      ]);
      isJavaScriptOnly = await viteJsCheck.wait() === 0;
      projectLogger.info({
        msg: "Detected project type by checking for vite.config.js",
        isJavaScriptOnly
      });
    } catch (detectError) {
      isJavaScriptOnly = false;
      projectLogger.warn({
        msg: "Failed to detect project type, assuming TypeScript",
        error: detectError instanceof Error ? detectError.message : String(detectError)
      });
    }
    const SHIPPER_IDS_PLUGIN_PATH = isJavaScriptOnly ? "plugins/vite-plugin-shipper-ids.js" : "plugins/vite-plugin-shipper-ids.ts";
    const pluginContent = isJavaScriptOnly ? SHIPPER_IDS_PLUGIN_CANONICAL_JS : SHIPPER_IDS_PLUGIN_CANONICAL;
    try {
      let sandboxPluginVersion = null;
      let hasOldTsPlugin = false;
      if (isJavaScriptOnly) {
        try {
          const oldTsCheck = await sandbox.exec([
            "test",
            "-f",
            "/workspace/plugins/vite-plugin-shipper-ids.ts"
          ]);
          hasOldTsPlugin = await oldTsCheck.wait() === 0;
          if (hasOldTsPlugin) {
            projectLogger.info({
              msg: "Found old .ts plugin file for Base44 project, will remove and replace with .js"
            });
          }
        } catch {
        }
      }
      try {
        const pluginFile = await sandbox.open(
          `/workspace/${SHIPPER_IDS_PLUGIN_PATH}`,
          "r"
        );
        const existingContent = new TextDecoder().decode(
          await pluginFile.read()
        );
        await pluginFile.close();
        const versionMatch = existingContent.match(
          /SHIPPER_IDS_PLUGIN_VERSION\s*=\s*["']([^"']+)["']/
        );
        sandboxPluginVersion = versionMatch?.[1] ?? null;
      } catch (error) {
        projectLogger.debug({
          msg: "Could not read existing shipper-ids plugin version, assuming it needs to be created",
          error: error instanceof Error ? error.message : String(error)
        });
        sandboxPluginVersion = null;
      }
      projectLogger.info({
        msg: "Checking shipper-ids plugin version",
        sandboxVersion: sandboxPluginVersion,
        serverVersion: SHIPPER_IDS_PLUGIN_VERSION,
        pluginPath: SHIPPER_IDS_PLUGIN_PATH,
        isJavaScriptOnly,
        hasOldTsPlugin
      });
      if (sandboxPluginVersion !== SHIPPER_IDS_PLUGIN_VERSION || hasOldTsPlugin) {
        projectLogger.info({
          msg: "Plugin version mismatch, syncing canonical plugin",
          sandboxVersion: sandboxPluginVersion,
          serverVersion: SHIPPER_IDS_PLUGIN_VERSION,
          pluginPath: SHIPPER_IDS_PLUGIN_PATH
        });
        await sandbox.exec(["mkdir", "-p", "/workspace/plugins"]);
        if (isJavaScriptOnly) {
          await sandbox.exec([
            "rm",
            "-f",
            "/workspace/plugins/vite-plugin-shipper-ids.ts"
          ]);
          projectLogger.info({
            msg: "Removed old .ts plugin file for Base44 project"
          });
        }
        const pluginFile = await sandbox.open(
          `/workspace/${SHIPPER_IDS_PLUGIN_PATH}`,
          "w"
        );
        await pluginFile.write(new TextEncoder().encode(pluginContent));
        await pluginFile.close();
        projectLogger.info({
          msg: "Successfully synced shipper-ids plugin",
          version: SHIPPER_IDS_PLUGIN_VERSION,
          pluginPath: SHIPPER_IDS_PLUGIN_PATH
        });
      } else {
        projectLogger.info({ msg: "Plugin version matches, no sync needed" });
      }
    } catch (pluginSyncError) {
      projectLogger.warn({
        msg: "Failed to sync shipper-ids plugin",
        error: pluginSyncError instanceof Error ? pluginSyncError.message : String(pluginSyncError)
      });
    }
    if (isImportedProject) {
      try {
        await patchViteConfigForImport(sandbox, projectLogger);
      } catch (patchError) {
        projectLogger.warn({
          msg: "Failed to patch vite.config for imported project",
          error: patchError instanceof Error ? patchError.message : String(patchError)
        });
      }
      if (importedFrom === "BASE44") {
        try {
          await patchBase44ClientForImport(sandbox, projectLogger);
        } catch (patchError) {
          projectLogger.warn({
            msg: "Failed to patch Base44 client for imported project",
            error: patchError instanceof Error ? patchError.message : String(patchError)
          });
        }
      }
    }
    if (fragmentId || templateName) {
      try {
        projectLogger.info({
          msg: "Starting dev server for sandbox",
          sandboxId: sandbox.sandboxId,
          isImportedProject
        });
        const devCommand = createViteDevServerCommand(5173);
        projectLogger.info({
          msg: "Executing dev server command with optimization wait and Tailwind CSS cache clear",
          command: getViteDevServerCommandDescription()
        });
        const process2 = await sandbox.exec(devCommand, {
          mode: "text",
          stdout: "pipe",
          stderr: "pipe",
          workdir: "/workspace"
        });
        const pid = await process2.stdout.readText();
        const stderrOutput = await process2.stderr.readText();
        await process2.wait();
        if (stderrOutput && stderrOutput.trim()) {
          projectLogger.warn({
            msg: "Dev server startup had stderr output",
            stderr: stderrOutput
          });
        }
        projectLogger.info({
          msg: "Dev server started in background",
          pid: pid.trim(),
          port: 5173,
          tunnelUrl: sandboxUrl
        });
        if (isImportedProject) {
          await new Promise((resolve) => setTimeout(resolve, 3e3));
          try {
            const checkProcess = await sandbox.exec(["ps", "aux"], {
              mode: "text",
              stdout: "pipe",
              workdir: "/workspace"
            });
            const psOutput = await checkProcess.stdout.readText();
            await checkProcess.wait();
            const isViteRunning = psOutput.includes("vite") || psOutput.includes("bun dev");
            const viteProcesses = psOutput.split("\n").filter(
              (line) => line.includes("vite") || line.includes("bun") || line.includes("5173")
            );
            projectLogger.info({
              msg: "Dev server process check for imported project",
              isViteRunning,
              processes: viteProcesses.length > 0 ? viteProcesses.join("\n") : "None found"
            });
            if (!isViteRunning) {
              projectLogger.error({
                msg: "CRITICAL: Dev server not running for imported project"
              });
              try {
                const logsCheck = await sandbox.exec(["cat", "/tmp/vite.log"], {
                  mode: "text",
                  stdout: "pipe",
                  stderr: "pipe",
                  workdir: "/workspace"
                });
                const logs = await logsCheck.stdout.readText();
                await logsCheck.wait();
                projectLogger.error({
                  msg: "Vite dev server log content",
                  logs: logs.substring(0, 2e3)
                  // First 2000 chars
                });
              } catch (logError) {
                projectLogger.error({
                  msg: "Could not read vite log file",
                  error: logError instanceof Error ? logError.message : String(logError)
                });
              }
              throw new Error(
                "Dev server failed to start for imported project. This usually means dependencies weren't installed correctly or there's a configuration issue."
              );
            }
          } catch (checkError) {
            if (checkError instanceof Error && checkError.message.includes("Dev server failed to start")) {
              throw checkError;
            }
            projectLogger.warn({
              msg: "Could not verify dev server process",
              error: checkError instanceof Error ? checkError.message : String(checkError)
            });
          }
        }
        projectLogger.info({ msg: "Waiting for dev server to be ready" });
        const maxWaitTime = 3e4;
        const startWait = Date.now();
        let isReady = false;
        while (Date.now() - startWait < maxWaitTime && !isReady) {
          try {
            const checkResult = await sandbox.exec([
              "test",
              "-f",
              "/workspace/index.html"
            ]);
            const exitCode = await checkResult.wait();
            if (exitCode === 0) {
              projectLogger.info({
                msg: "Dev server ready",
                waitTime: Date.now() - startWait
              });
              isReady = true;
              break;
            }
          } catch (checkError) {
          }
          await new Promise((resolve) => setTimeout(resolve, 1e3));
        }
        if (!isReady) {
          projectLogger.warn({
            msg: "Dev server not ready after max wait time",
            maxWaitTime
          });
        }
      } catch (devServerError) {
        projectLogger.warn({
          msg: "Dev server start warning (may still be running)",
          error: devServerError instanceof Error ? devServerError.message : String(devServerError)
        });
      }
    }
    projectLogger.info({
      msg: "Sandbox setup complete",
      sandboxId: sandbox.sandboxId
    });
    return sandboxInfo;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorDetails = error && typeof error === "object" ? JSON.stringify(error, Object.getOwnPropertyNames(error), 2) : String(error);
    projectLogger.error({
      msg: "Error creating sandbox",
      projectId,
      fragmentId: fragmentId || null,
      templateName: templateName || null,
      error: errorMessage,
      errorDetails
    });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to create sandbox: ${errorMessage}`,
      cause: error
    });
  }
}
function getImageTagForTemplate() {
  return "oven/bun:1";
}
async function deleteSandbox(sandboxId, projectId) {
  const logger2 = projectId ? createProjectLogger(projectId) : logger;
  logger2.info({ msg: "Terminating sandbox", sandboxId });
  try {
    const sandbox = await modalClient.sandboxes.fromId(sandboxId);
    await sandbox.terminate();
    await prisma.project.updateMany({
      where: { sandboxId },
      data: {
        sandboxId: null,
        sandboxUrl: null,
        sandboxCreatedAt: null,
        sandboxExpiresAt: null
      }
    });
    logger2.info({ msg: "Sandbox terminated", sandboxId });
  } catch (error) {
    logger2.error({
      msg: "Error terminating sandbox",
      sandboxId,
      error: error instanceof Error ? error.message : String(error)
    });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to terminate sandbox",
      cause: error
    });
  }
}
async function restoreV2FragmentInSandbox(sandbox, fragmentId, projectId, logger2 = logger, options) {
  const projectLogger = logger2 === logger ? createProjectLogger(projectId) : logger2;
  const isImportedProject = options?.isImportedProject ?? false;
  projectLogger.info({
    msg: "Restoring V2 fragment in sandbox",
    fragmentId,
    sandboxId: sandbox.sandboxId,
    isImportedProject
  });
  try {
    const fragment = await prisma.v2Fragment.findUnique({
      where: { id: fragmentId },
      select: {
        id: true,
        title: true,
        files: true,
        projectId: true,
        createdAt: true,
        updatedAt: true
      }
    });
    if (!fragment) {
      throw new Error(`Fragment not found: ${fragmentId}`);
    }
    if (fragment.projectId !== projectId) {
      throw new Error(
        `Fragment ${fragmentId} does not belong to project ${projectId}`
      );
    }
    const files = typeof fragment.files === "string" ? JSON.parse(fragment.files) : fragment.files;
    if (isImportedProject) {
      await restoreFilesInSandboxOptimized(
        sandbox,
        files,
        projectLogger
      );
    } else {
      await restoreFilesInSandbox(
        sandbox,
        files,
        projectLogger
      );
    }
    projectLogger.info({ msg: "Fragment restored successfully", fragmentId });
  } catch (error) {
    projectLogger.error({
      msg: "Error restoring fragment",
      fragmentId,
      error: error instanceof Error ? error.message : String(error)
    });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to restore fragment",
      cause: error
    });
  }
}
async function restoreFilesInSandbox(sandbox, files, logger2 = logger) {
  logger2.info({
    msg: "Restoring files in sandbox",
    fileCount: Object.keys(files).length,
    sandboxId: sandbox.sandboxId
  });
  try {
    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = `/workspace/${filePath}`;
      const dirPath = fullPath.substring(0, fullPath.lastIndexOf("/"));
      if (dirPath) {
        await sandbox.exec(["mkdir", "-p", dirPath]);
      }
      let fileData;
      if (content.startsWith("__BASE64__")) {
        const base64Data = content.substring("__BASE64__".length);
        const binaryString = atob(base64Data);
        fileData = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          fileData[i] = binaryString.charCodeAt(i);
        }
      } else if (content.startsWith("data:")) {
        const base64Match = content.match(/^data:[^;]+;base64,(.+)$/);
        if (base64Match) {
          const base64Data = base64Match[1];
          const binaryString = atob(base64Data);
          fileData = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            fileData[i] = binaryString.charCodeAt(i);
          }
        } else {
          fileData = new TextEncoder().encode(content);
        }
      } else {
        fileData = new TextEncoder().encode(content);
      }
      const file = await sandbox.open(fullPath, "w");
      await file.write(fileData);
      await file.close();
      logger2.debug({
        msg: "Restored file",
        filePath,
        bytes: fileData.length
      });
    }
    logger2.info({
      msg: "Files restored successfully",
      fileCount: Object.keys(files).length
    });
  } catch (error) {
    logger2.error({
      msg: "Error restoring files",
      sandboxId: sandbox.sandboxId,
      error: error instanceof Error ? error.message : String(error)
    });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to restore files",
      cause: error
    });
  }
}
async function restoreFilesInSandboxOptimized(sandbox, files, logger2 = logger) {
  const fileCount = Object.keys(files).length;
  logger2.info({
    msg: "Restoring files in sandbox (optimized for import)",
    fileCount,
    sandboxId: sandbox.sandboxId
  });
  try {
    const directories = /* @__PURE__ */ new Set();
    for (const filePath of Object.keys(files)) {
      const fullPath = `/workspace/${filePath}`;
      const dirPath = fullPath.substring(0, fullPath.lastIndexOf("/"));
      if (dirPath && dirPath !== "/workspace") {
        directories.add(dirPath);
      }
    }
    if (directories.size > 0) {
      const dirsArray = Array.from(directories);
      logger2.info({
        msg: "Creating directories for import",
        count: dirsArray.length
      });
      await sandbox.exec(["mkdir", "-p", ...dirsArray]);
    }
    const BATCH_SIZE = 10;
    const fileEntries = Object.entries(files);
    let filesRestored = 0;
    for (let i = 0; i < fileEntries.length; i += BATCH_SIZE) {
      const batch = fileEntries.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async ([filePath, content]) => {
          const fullPath = `/workspace/${filePath}`;
          let fileData;
          if (content.startsWith("__BASE64__")) {
            const base64Data = content.substring("__BASE64__".length);
            const binaryString = atob(base64Data);
            fileData = new Uint8Array(binaryString.length);
            for (let j = 0; j < binaryString.length; j++) {
              fileData[j] = binaryString.charCodeAt(j);
            }
          } else if (content.startsWith("data:")) {
            const base64Match = content.match(/^data:[^;]+;base64,(.+)$/);
            if (base64Match) {
              const base64Data = base64Match[1];
              const binaryString = atob(base64Data);
              fileData = new Uint8Array(binaryString.length);
              for (let j = 0; j < binaryString.length; j++) {
                fileData[j] = binaryString.charCodeAt(j);
              }
            } else {
              fileData = new TextEncoder().encode(content);
            }
          } else {
            fileData = new TextEncoder().encode(content);
          }
          const file = await sandbox.open(fullPath, "w");
          await file.write(fileData);
          await file.close();
        })
      );
      filesRestored += batch.length;
      logger2.info({
        msg: "Import file restore progress",
        filesRestored,
        totalFiles: fileCount
      });
    }
    logger2.info({
      msg: "Files restored successfully (optimized)",
      fileCount
    });
  } catch (error) {
    logger2.error({
      msg: "Error restoring files (optimized)",
      sandboxId: sandbox.sandboxId,
      error: error instanceof Error ? error.message : String(error)
    });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to restore files",
      cause: error
    });
  }
}
async function patchViteConfigForImport(sandbox, logger2 = logger) {
  try {
    const configFiles = ["vite.config.ts", "vite.config.js", "vite.config.mjs"];
    let viteConfigPath = null;
    for (const configFile of configFiles) {
      const checkResult = await sandbox.exec([
        "test",
        "-f",
        `/workspace/${configFile}`
      ]);
      const exitCode = await checkResult.wait();
      if (exitCode === 0) {
        viteConfigPath = `/workspace/${configFile}`;
        logger2.info({ msg: "Found Vite config", configFile });
        break;
      }
    }
    if (!viteConfigPath) {
      logger2.info({ msg: "No vite.config found, skipping patch" });
      return;
    }
    const file = await sandbox.open(viteConfigPath, "r");
    const data = await file.read();
    await file.close();
    let content = new TextDecoder().decode(data);
    const hasModalHost = content.includes("'.modal.host'") || content.includes('".modal.host"');
    const hasNetworkHost = content.includes("host: '0.0.0.0'") || content.includes('host: "0.0.0.0"') || content.includes("host: '::'") || content.includes('host: "::"') || content.match(/host:\s*['"](?:0\.0\.0\.0|::)['"]/);
    const hasCorrectPort = content.includes("port: 5173") || content.match(/port:\s*5173/);
    if (hasModalHost && hasNetworkHost && hasCorrectPort) {
      logger2.info({
        msg: "Vite config already patched (has .modal.host, network host, and port 5173), skipping"
      });
      return;
    }
    if (content.includes("allowedHosts:")) {
      if (content.match(/allowedHosts:\s*true/)) {
        logger2.info({
          msg: "Found allowedHosts: true (boolean), adding host: 0.0.0.0"
        });
        if (!hasNetworkHost) {
          content = content.replace(
            /allowedHosts:\s*true/,
            `host: '0.0.0.0',
    allowedHosts: true`
          );
        }
      } else {
        const allowedHostsMatch = content.match(
          /allowedHosts:\s*\[([\s\S]*?)\]/
        );
        if (allowedHostsMatch) {
          const existingHosts = allowedHostsMatch[1];
          const isMultiLine = existingHosts.includes("\n");
          let newAllowedHosts;
          if (isMultiLine) {
            const trimmedHosts = existingHosts.replace(/[\s,]*$/, "");
            newAllowedHosts = `allowedHosts: [${trimmedHosts},
    ".modal.host",
    "shipper.now",
    ".localhost"
  ]`;
          } else {
            const trimmedHosts = existingHosts.trim();
            const newHosts = trimmedHosts ? `${trimmedHosts}, ".modal.host", "shipper.now", ".localhost"` : '".modal.host", "shipper.now", ".localhost"';
            newAllowedHosts = `allowedHosts: [${newHosts}]`;
          }
          content = content.replace(
            /allowedHosts:\s*\[([\s\S]*?)\]/,
            newAllowedHosts
          );
          logger2.info({
            msg: "Added .modal.host, shipper.now, and .localhost to existing allowedHosts array"
          });
        } else {
          logger2.warn({
            msg: "Found allowedHosts but couldn't parse array format"
          });
          return;
        }
      }
    } else if (content.includes("server:")) {
      if (!hasNetworkHost) {
        content = content.replace(
          /server:\s*\{/,
          `server: {
    host: '0.0.0.0',`
        );
      }
      if (!hasModalHost) {
        content = content.replace(
          /server:\s*\{/,
          `server: {
    allowedHosts: [".modal.host", "shipper.now", ".localhost"],`
        );
      }
      logger2.info({
        msg: "Added host and allowedHosts to existing server block"
      });
    } else if (content.includes("export default")) {
      content = content.replace(
        /export default\s+defineConfig\(\{/,
        `export default defineConfig({
  server: {
    host: '0.0.0.0',
    allowedHosts: [".modal.host", "shipper.now", ".localhost"],
  },`
      );
      logger2.info({ msg: "Added server block with host and allowedHosts" });
    } else {
      logger2.warn({ msg: "Could not patch vite.config - unexpected format" });
      return;
    }
    if (!hasCorrectPort && content.includes("port:")) {
      content = content.replace(/port:\s*\d+/, "port: 5173");
      logger2.info({
        msg: "Changed port to 5173 for Modal tunnel compatibility"
      });
    } else if (!hasCorrectPort && content.includes("server:")) {
      content = content.replace(/server:\s*\{/, `server: {
    port: 5173,`);
      logger2.info({
        msg: "Added port: 5173 to server block"
      });
    }
    const writeFile2 = await sandbox.open(viteConfigPath, "w");
    await writeFile2.write(new TextEncoder().encode(content));
    await writeFile2.close();
    logger2.info({
      msg: "Successfully patched vite.config with host, port, and allowedHosts",
      patchedConfigPreview: content.substring(0, 500)
      // Log first 500 chars for debugging
    });
  } catch (error) {
    logger2.warn({
      msg: "Failed to patch vite.config (non-critical)",
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
async function patchBase44ClientForImport(sandbox, logger2 = logger) {
  try {
    const clientFiles = [
      "src/api/base44Client.js",
      "src/lib/base44Client.js",
      "src/base44Client.js",
      "lib/base44Client.js"
    ];
    let clientPath = null;
    for (const clientFile of clientFiles) {
      const checkResult = await sandbox.exec([
        "test",
        "-f",
        `/workspace/${clientFile}`
      ]);
      const exitCode = await checkResult.wait();
      if (exitCode === 0) {
        clientPath = `/workspace/${clientFile}`;
        logger2.info({ msg: "Found Base44 client", clientFile });
        break;
      }
    }
    if (!clientPath) {
      logger2.info({ msg: "No Base44 client file found, skipping patch" });
      return;
    }
    const file = await sandbox.open(clientPath, "r");
    const data = await file.read();
    await file.close();
    let content = new TextDecoder().decode(data);
    if (content.match(/requiresAuth:\s*false/)) {
      logger2.info({ msg: "Base44 client already has requiresAuth: false" });
      return;
    }
    if (content.match(/requiresAuth:\s*true/)) {
      content = content.replace(/requiresAuth:\s*true/, "requiresAuth: false");
      logger2.info({
        msg: "Patched Base44 client: requiresAuth: true -> false"
      });
    } else if (content.includes("createClient(")) {
      logger2.info({
        msg: "Base44 client has createClient but no requiresAuth, leaving as-is"
      });
      return;
    } else {
      logger2.info({
        msg: "Base44 client format not recognized, skipping patch"
      });
      return;
    }
    const writeFile2 = await sandbox.open(clientPath, "w");
    await writeFile2.write(new TextEncoder().encode(content));
    await writeFile2.close();
    logger2.info({
      msg: "Successfully patched Base44 client with requiresAuth: false"
    });
  } catch (error) {
    logger2.warn({
      msg: "Failed to patch Base44 client (non-critical)",
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
async function createFilesystemSnapshot(sandbox, fragmentId, projectId, logger2 = logger) {
  const projectLogger = logger2 === logger ? createProjectLogger(projectId) : logger2;
  projectLogger.info({
    msg: "Creating filesystem snapshot for fragment",
    fragmentId,
    sandboxId: sandbox.sandboxId
  });
  try {
    const snapshotImage = await sandbox.snapshotFilesystem();
    const imageId = snapshotImage.imageId;
    projectLogger.info({
      msg: "Snapshot image created",
      imageId
    });
    await prisma.v2Fragment.update({
      where: { id: fragmentId },
      data: {
        snapshotImageId: imageId,
        snapshotCreatedAt: /* @__PURE__ */ new Date(),
        snapshotProvider: "modal"
      }
    });
    projectLogger.info({
      msg: "Fragment updated with snapshot",
      fragmentId,
      imageId
    });
    await cleanupOldSnapshots(projectId, 10, projectLogger);
    return imageId;
  } catch (error) {
    projectLogger.error({
      msg: "Failed to create filesystem snapshot",
      fragmentId,
      error: error instanceof Error ? error.message : String(error)
    });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to create filesystem snapshot",
      cause: error
    });
  }
}
async function cleanupOldSnapshots(projectId, keepCount = 10, logger2 = logger) {
  const projectLogger = logger2 === logger ? createProjectLogger(projectId) : logger2;
  projectLogger.info({
    msg: "Cleaning up old snapshots",
    keepCount
  });
  try {
    const fragments = await prisma.v2Fragment.findMany({
      where: {
        projectId,
        snapshotImageId: { not: null },
        snapshotProvider: "modal"
      },
      orderBy: { snapshotCreatedAt: "desc" },
      select: {
        id: true,
        snapshotImageId: true,
        snapshotCreatedAt: true,
        title: true
      }
    });
    projectLogger.info({
      msg: "Found fragments with snapshots",
      fragmentCount: fragments.length
    });
    if (fragments.length <= keepCount) {
      projectLogger.info({
        msg: "No cleanup needed",
        snapshotCount: fragments.length
      });
      return { deleted: 0, kept: fragments.length };
    }
    const snapshotsToDelete = fragments.slice(keepCount);
    projectLogger.info({
      msg: "Deleting old snapshots",
      deleteCount: snapshotsToDelete.length,
      keepCount
    });
    let deletedCount = 0;
    for (const fragment of snapshotsToDelete) {
      if (!fragment.snapshotImageId) continue;
      try {
        projectLogger.info({
          msg: "Deleting snapshot",
          imageId: fragment.snapshotImageId,
          fragmentId: fragment.id,
          fragmentTitle: fragment.title
        });
        try {
          const image = await modalClient.images.fromId(
            fragment.snapshotImageId
          );
          await modalClient.images.delete(fragment.snapshotImageId);
          projectLogger.info({
            msg: "Deleted image",
            imageId: fragment.snapshotImageId
          });
        } catch (imageError) {
          projectLogger.warn({
            msg: "Failed to delete image (may already be deleted)",
            imageId: fragment.snapshotImageId,
            error: imageError instanceof Error ? imageError.message : String(imageError)
          });
        }
        await prisma.v2Fragment.update({
          where: { id: fragment.id },
          data: {
            snapshotImageId: null,
            snapshotCreatedAt: null,
            snapshotProvider: null
          }
        });
        deletedCount++;
        projectLogger.info({
          msg: "Cleaned up snapshot for fragment",
          fragmentId: fragment.id
        });
      } catch (error) {
        projectLogger.error({
          msg: "Failed to clean up snapshot for fragment",
          fragmentId: fragment.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    projectLogger.info({
      msg: "Snapshot cleanup complete",
      deleted: deletedCount,
      kept: keepCount
    });
    return { deleted: deletedCount, kept: keepCount };
  } catch (error) {
    projectLogger.error({
      msg: "Failed to clean up old snapshots",
      error: error instanceof Error ? error.message : String(error)
    });
    return { deleted: 0, kept: 0 };
  }
}
async function deleteSnapshot(imageId, projectId) {
  const logger2 = projectId ? createProjectLogger(projectId) : logger;
  logger2.info({ msg: "Deleting snapshot", imageId });
  try {
    const image = await modalClient.images.fromId(imageId);
    await modalClient.images.delete(imageId);
    await prisma.v2Fragment.updateMany({
      where: { snapshotImageId: imageId },
      data: {
        snapshotImageId: null,
        snapshotCreatedAt: null,
        snapshotProvider: null
      }
    });
    logger2.info({ msg: "Successfully deleted snapshot", imageId });
    return true;
  } catch (error) {
    logger2.error({
      msg: "Failed to delete snapshot",
      imageId,
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
}
async function cloneTemplateInSandbox(sandbox, templateName, logger2 = logger) {
  logger2.info({
    msg: "Cloning template in sandbox",
    templateName,
    sandboxId: sandbox.sandboxId
  });
  try {
    const repoUrl = "https://github.com/Shipper-dot-now/vite-template";
    const branchName = templateName === "vite" || templateName === "default" || templateName === "node" ? "main" : templateName.endsWith("-template") ? templateName : `${templateName}-template`;
    logger2.info({
      msg: "Cloning branch from repository",
      branchName,
      repoUrl
    });
    logger2.info({ msg: "Checking for git installation" });
    const gitCheckResult = await sandbox.exec(["sh", "-c", "command -v git"], {
      mode: "text",
      stdout: "pipe",
      stderr: "pipe",
      workdir: "/workspace"
    });
    const gitCheckExitCode = await gitCheckResult.wait();
    if (gitCheckExitCode !== 0) {
      logger2.info({ msg: "Git not found, installing" });
      const installResult2 = await sandbox.exec(
        ["sh", "-c", "apt-get update && apt-get install -y git"],
        {
          mode: "text",
          stdout: "pipe",
          stderr: "pipe",
          workdir: "/workspace"
        }
      );
      const installStdout2 = await installResult2.stdout.readText();
      const installStderr2 = await installResult2.stderr.readText();
      const installExitCode2 = await installResult2.wait();
      if (installExitCode2 !== 0) {
        logger2.error({
          msg: "Failed to install git",
          error: installStderr2 || installStdout2
        });
        throw new Error(
          `Failed to install git: ${installStderr2 || installStdout2}`
        );
      }
      logger2.info({ msg: "Git installed successfully" });
    } else {
      logger2.info({ msg: "Git already installed" });
    }
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
        "temp-clone"
      ],
      {
        mode: "text",
        stdout: "pipe",
        stderr: "pipe",
        workdir: "/workspace",
        env: {
          GIT_TERMINAL_PROMPT: "0",
          // Disable credential prompting
          GIT_ASKPASS: "echo"
          // Return empty credentials if asked
        }
      }
    );
    const cloneStdout = await cloneResult.stdout.readText();
    const cloneStderr = await cloneResult.stderr.readText();
    const cloneExitCode = await cloneResult.wait();
    if (cloneExitCode !== 0) {
      throw new Error(
        `Failed to clone template: ${cloneStderr || cloneStdout}`
      );
    }
    logger2.info({ msg: "Template cloned successfully" });
    await sandbox.exec(
      ["sh", "-c", "mv temp-clone/* temp-clone/.[!.]* . 2>/dev/null || true"],
      {
        mode: "text",
        stdout: "pipe",
        stderr: "pipe",
        workdir: "/workspace"
      }
    );
    await sandbox.exec(["rm", "-rf", "temp-clone"], {
      mode: "text",
      stdout: "pipe",
      stderr: "pipe",
      workdir: "/workspace"
    });
    await sandbox.exec(["rm", "-rf", ".git"], {
      mode: "text",
      stdout: "pipe",
      stderr: "pipe",
      workdir: "/workspace"
    });
    logger2.info({ msg: "Initializing fresh git repository" });
    await sandbox.exec(["git", "init"], {
      mode: "text",
      stdout: "pipe",
      stderr: "pipe",
      workdir: "/workspace"
    });
    await sandbox.exec(["git", "config", "user.name", "Shipper AI"], {
      mode: "text",
      stdout: "pipe",
      stderr: "pipe",
      workdir: "/workspace"
    });
    await sandbox.exec(["git", "config", "user.email", "ai@shipper.dev"], {
      mode: "text",
      stdout: "pipe",
      stderr: "pipe",
      workdir: "/workspace"
    });
    await sandbox.exec(["git", "add", "."], {
      mode: "text",
      stdout: "pipe",
      stderr: "pipe",
      workdir: "/workspace"
    });
    await sandbox.exec(
      ["git", "commit", "-m", "Initial commit from template"],
      {
        mode: "text",
        stdout: "pipe",
        stderr: "pipe",
        workdir: "/workspace"
      }
    );
    await sandbox.exec(["git", "branch", "-M", "main"], {
      mode: "text",
      stdout: "pipe",
      stderr: "pipe",
      workdir: "/workspace"
    });
    logger2.info({
      msg: "Template cloned and git initialized",
      templateName
    });
    logger2.info({ msg: "Installing dependencies with bun" });
    const installCommand = ["bun", "install"];
    const installResult = await sandbox.exec(installCommand, {
      mode: "text",
      stdout: "pipe",
      stderr: "pipe",
      workdir: "/workspace"
    });
    const installStdout = await installResult.stdout.readText();
    const installStderr = await installResult.stderr.readText();
    const installExitCode = await installResult.wait();
    if (installExitCode !== 0) {
      logger2.warn({
        msg: "Dependency installation failed",
        error: installStderr || installStdout
      });
    } else {
      logger2.info({ msg: "Dependencies installed successfully" });
    }
  } catch (error) {
    logger2.error({
      msg: "Error cloning template",
      templateName,
      error: error instanceof Error ? error.message : String(error)
    });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to clone template",
      cause: error
    });
  }
}
async function executeCommand(sandboxId, command, _options, logger2 = logger) {
  logger2.info({
    msg: "Executing command in sandbox",
    sandboxId,
    command
  });
  try {
    const sandbox = await modalClient.sandboxes.fromId(sandboxId);
    const commandArray = parseCommand(command);
    const process2 = await sandbox.exec(commandArray, {
      mode: "text",
      stdout: "pipe",
      stderr: "pipe",
      workdir: "/workspace"
    });
    const [stdout, stderr] = await Promise.all([
      process2.stdout.readText(),
      process2.stderr.readText()
    ]);
    const exitCode = await process2.wait();
    const result = {
      stdout,
      stderr,
      exitCode
    };
    logger2.info({
      msg: "Command executed",
      sandboxId,
      exitCode,
      stdoutLength: stdout.length,
      stderrLength: stderr.length
    });
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorDetails = error && typeof error === "object" ? JSON.stringify(error, Object.getOwnPropertyNames(error), 2) : String(error);
    logger2.error({
      msg: "Error executing command",
      sandboxId,
      command,
      error: errorMessage,
      errorDetails
    });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to execute command: ${errorMessage}`,
      cause: error
    });
  }
}
function parseCommand(command) {
  const args = [];
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
async function readFile(sandboxId, filePath, logger2 = logger) {
  logger2.info({
    msg: "Reading file from sandbox",
    sandboxId,
    filePath
  });
  try {
    const sandbox = await modalClient.sandboxes.fromId(sandboxId);
    const fullPath = `/workspace/${filePath}`;
    const file = await sandbox.open(fullPath, "r");
    const data = await file.read();
    await file.close();
    const content = new TextDecoder().decode(data);
    logger2.info({
      msg: "File read",
      sandboxId,
      filePath,
      bytes: content.length
    });
    return content;
  } catch (error) {
    logger2.error({
      msg: "Error reading file",
      sandboxId,
      filePath,
      error: error instanceof Error ? error.message : String(error)
    });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to read file",
      cause: error
    });
  }
}
async function writeFile(sandboxId, filePath, content, logger2 = logger) {
  logger2.info({
    msg: "Writing file to sandbox",
    sandboxId,
    filePath,
    bytes: content.length
  });
  try {
    const sandbox = await modalClient.sandboxes.fromId(sandboxId);
    const fullPath = `/workspace/${filePath}`;
    const dirPath = fullPath.substring(0, fullPath.lastIndexOf("/"));
    if (dirPath) {
      await sandbox.exec(["mkdir", "-p", dirPath]);
    }
    const file = await sandbox.open(fullPath, "w");
    await file.write(new TextEncoder().encode(content));
    await file.close();
    logger2.info({
      msg: "File written",
      sandboxId,
      filePath
    });
  } catch (error) {
    logger2.error({
      msg: "Error writing file",
      sandboxId,
      filePath,
      error: error instanceof Error ? error.message : String(error)
    });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to write file",
      cause: error
    });
  }
}
async function listFiles(sandboxId, logger2 = logger) {
  logger2.info({
    msg: "Listing files in sandbox",
    sandboxId
  });
  try {
    const sandbox = await modalClient.sandboxes.fromId(sandboxId);
    const process2 = await sandbox.exec(
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
        "-ls"
      ],
      {
        mode: "text",
        stdout: "pipe",
        stderr: "pipe",
        workdir: "/workspace"
      }
    );
    const stdout = await process2.stdout.readText();
    await process2.wait();
    const files = /* @__PURE__ */ new Map();
    const lines = stdout.split("\n").filter((line) => line.trim());
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 11) {
        const size = parseInt(parts[6], 10);
        const filePath = parts.slice(10).join(" ");
        const relativePath = filePath.replace(/^\/workspace\//, "");
        const isHiddenFile = relativePath.startsWith(".");
        const isEnvFile = /^\.env(\..+)?$/.test(relativePath);
        if (relativePath && (!isHiddenFile || isEnvFile)) {
          files.set(relativePath, {
            size: isNaN(size) ? 0 : size,
            modified: Date.now()
          });
        }
      }
    }
    logger2.info({
      msg: "Found source files",
      sandboxId,
      fileCount: files.size,
      note: "excluding node_modules, build artifacts"
    });
    return files;
  } catch (error) {
    logger2.error({
      msg: "Error listing files - sandbox is likely terminated",
      sandboxId,
      error: error instanceof Error ? error.message : String(error)
    });
    throw new Error(
      `Failed to list files - sandbox ${sandboxId} is terminated or unreachable`
    );
  }
}
async function getSandboxStatus(sandboxId, logger2 = logger) {
  logger2.info({
    msg: "Getting status for sandbox",
    sandboxId
  });
  try {
    const sandbox = await modalClient.sandboxes.fromId(sandboxId);
    const files = await listFiles(sandboxId, logger2);
    let sandboxUrl = null;
    try {
      const tunnels = await sandbox.tunnels(5e3);
      const ports = Object.keys(tunnels);
      if (ports.length > 0) {
        const firstPort = parseInt(ports[0], 10);
        const originalUrl = tunnels[firstPort].url;
        const project = await prisma.project.findFirst({
          where: { sandboxId },
          select: { id: true }
        });
        if (project) {
          sandboxUrl = transformModalUrlToShipperDomain(
            originalUrl,
            project.id
          );
        } else {
          sandboxUrl = originalUrl;
        }
      }
    } catch (error) {
      logger2.warn({
        msg: "No tunnels available for sandbox",
        sandboxId
      });
    }
    return {
      sandboxId: sandbox.sandboxId,
      status: "running",
      sandboxUrl,
      fileCount: files.size
    };
  } catch (error) {
    logger2.error({
      msg: "Error getting sandbox status",
      sandboxId,
      error: error instanceof Error ? error.message : String(error)
    });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to get sandbox status",
      cause: error
    });
  }
}
async function startDevServer(sandboxId, _projectId, port = 8080, logger2 = logger) {
  logger2.info({
    msg: "Starting dev server in sandbox",
    sandboxId,
    port
  });
  try {
    const sandbox = await modalClient.sandboxes.fromId(sandboxId);
    const devCommand = createViteDevServerCommand(port);
    const projectLogger = logger2 === logger ? createProjectLogger(_projectId) : logger2;
    projectLogger.info({
      msg: "Executing dev server command with optimization wait and Tailwind CSS cache clear",
      command: getViteDevServerCommandDescription(port)
    });
    const process2 = await sandbox.exec(devCommand, {
      mode: "text",
      stdout: "pipe",
      stderr: "pipe",
      workdir: "/workspace"
    });
    const pid = await process2.stdout.readText();
    await process2.wait();
    projectLogger.info({
      msg: "Dev server started in background",
      pid: pid.trim(),
      port
    });
    projectLogger.info({ msg: "Waiting for dev server to start" });
    await new Promise((resolve) => setTimeout(resolve, 5e3));
    projectLogger.info({ msg: "Getting tunnel URL", port });
    const tunnels = await sandbox.tunnels();
    const devServerUrl = tunnels[port]?.url;
    if (!devServerUrl) {
      throw new Error(
        `No tunnel available for port ${port}. Available ports: ${Object.keys(tunnels).join(", ") || "none"}`
      );
    }
    projectLogger.info({
      msg: "Dev server started successfully",
      devServerUrl
    });
    await prisma.project.update({
      where: { id: _projectId },
      data: {
        sandboxUrl: devServerUrl
        // Store original Modal URL
      }
    });
    projectLogger.info({
      msg: "Dev server URL stored in database",
      devServerUrl
    });
    setupModalSandboxMonitoring(sandbox, sandboxId, _projectId, logger2).catch(
      (error) => {
        logger2.error({
          msg: "Monitoring setup failed (non-critical)",
          error: error instanceof Error ? error.message : String(error)
        });
      }
    );
    const transformedUrl = transformModalUrlToShipperDomain(
      devServerUrl,
      _projectId
    );
    return transformedUrl;
  } catch (error) {
    const projectLogger = logger2 === logger ? createProjectLogger(_projectId) : logger2;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorDetails = error && typeof error === "object" ? JSON.stringify(error, Object.getOwnPropertyNames(error), 2) : String(error);
    projectLogger.error({
      msg: "Error starting dev server",
      sandboxId,
      projectId: _projectId,
      error: errorMessage,
      errorDetails
    });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to start dev server: ${errorMessage}`,
      cause: error
    });
  }
}
function closeModalClient() {
  logger.info({ msg: "Closing Modal client" });
  modalClient.close();
}
async function restoreV2FragmentById(sandboxId, fragmentId, projectId, logger2 = logger) {
  const sandbox = await modalClient.sandboxes.fromId(sandboxId);
  return restoreV2FragmentInSandbox(sandbox, fragmentId, projectId, logger2);
}
async function restoreFilesById(sandboxId, files, logger2 = logger) {
  const sandbox = await modalClient.sandboxes.fromId(sandboxId);
  return restoreFilesInSandbox(sandbox, files, logger2);
}
async function findFiles(sandboxId, pattern, logger2 = logger) {
  const sandbox = await modalClient.sandboxes.fromId(sandboxId);
  try {
    const result = await sandbox.exec([
      "find",
      "/workspace",
      "-type",
      "f",
      "-name",
      pattern
    ]);
    const output = await result.wait();
    if (output === 0) {
      const stdout = await result.stdout.readText();
      return stdout.split("\n").filter((line) => line.trim()).map((line) => line.replace("/workspace/", ""));
    }
    return [];
  } catch (error) {
    logger2.error({
      msg: "Error finding files",
      sandboxId,
      pattern,
      error: error instanceof Error ? error.message : String(error)
    });
    return [];
  }
}
function filterSensitiveLogs(logs) {
  const buildOutputMatch = logs.match(
    /Build output:\s*([\s\S]*?)(?=\n(?:Deployment|ERROR:|$))/
  );
  if (buildOutputMatch) {
    return buildOutputMatch[1].trim();
  }
  return logs.replace(/Deployment URL: https?:\/\/[^\s]+/g, "Deployment URL: [HIDDEN]").replace(
    /DEPLOYMENT_PLANE_API_KEY['":\s]+=\s*['"][^'"]+['"]/gi,
    "DEPLOYMENT_PLANE_API_KEY: [HIDDEN]"
  ).replace(/https?:\/\/[^\s"']+/g, "[URL_FILTERED]");
}
async function deploySandboxApp(sandbox, projectId, appName, logger2 = logger) {
  const projectLogger = logger2 === logger ? createProjectLogger(projectId) : logger2;
  try {
    projectLogger.info({
      msg: "Starting deployment for project",
      projectId
    });
    const deploymentUrl = process.env.DEPLOYMENT_PLANE_URL;
    if (!deploymentUrl) {
      throw new Error(
        "DEPLOYMENT_PLANE_URL environment variable is not configured"
      );
    }
    projectLogger.info({
      msg: "Using deployment URL from env",
      deploymentUrl
    });
    const apiKey = process.env.DEPLOYMENT_PLANE_API_KEY;
    if (!apiKey) {
      throw new Error(
        "DEPLOYMENT_PLANE_API_KEY environment variable is not configured"
      );
    }
    const sanitizedAppName = appName || `shipper-app-${projectId}`;
    try {
      projectLogger.info({
        msg: "Attempting zip/curl deployment",
        appName: sanitizedAppName
      });
      return await deployWithZipCurl(
        sandbox,
        projectId,
        sanitizedAppName,
        deploymentUrl,
        projectLogger
      );
    } catch (zipError) {
      const errorMessage = zipError instanceof Error ? zipError.message : String(zipError);
      const isBuildError = errorMessage.includes("Failed to build application") || errorMessage.includes("error TS") || errorMessage.includes("build command failed") || errorMessage.includes("Build failed");
      if (isBuildError) {
        projectLogger.error({
          msg: "Build failed, not attempting fallback",
          error: errorMessage
        });
        throw zipError;
      }
      projectLogger.warn({
        msg: "Zip/curl deployment failed, falling back to Node.js script",
        error: errorMessage
      });
      projectLogger.info({
        msg: "Creating Node.js deployment script",
        appName: sanitizedAppName
      });
      return await deployWithNodeScript(
        sandbox,
        projectId,
        sanitizedAppName,
        deploymentUrl,
        projectLogger
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    projectLogger.error({
      msg: "Failed to deploy sandbox app",
      projectId,
      error: errorMessage
    });
    return {
      success: false,
      error: errorMessage,
      logs: filterSensitiveLogs(`Deployment failed: ${errorMessage}`)
    };
  }
}
async function deployWithZipCurl(sandbox, projectId, sanitizedAppName, deploymentUrl, logger2) {
  const apiKey = process.env.DEPLOYMENT_PLANE_API_KEY;
  if (!apiKey) {
    throw new Error("DEPLOYMENT_PLANE_API_KEY is required for deployment");
  }
  const zipFileName = `${sanitizedAppName}.zip`;
  logger2.info({
    msg: "Removing monitoring script from index.html before build"
  });
  try {
    const indexHtmlPath = "/workspace/index.html";
    const indexHtmlFile = await sandbox.open(indexHtmlPath, "r");
    const indexHtmlData = await indexHtmlFile.read();
    await indexHtmlFile.close();
    let indexHtmlContent = new TextDecoder().decode(indexHtmlData);
    if (indexHtmlContent.includes(".shipper/monitor.js")) {
      indexHtmlContent = indexHtmlContent.replace(
        /<script[^>]*src=["']\/\.shipper\/monitor\.js["'][^>]*><\/script>\s*/gi,
        ""
      );
      const cleanedHtmlFile = await sandbox.open(indexHtmlPath, "w");
      await cleanedHtmlFile.write(new TextEncoder().encode(indexHtmlContent));
      await cleanedHtmlFile.close();
      logger2.info({ msg: "Removed monitoring script from index.html" });
    }
  } catch (cleanupError) {
    logger2.warn({
      msg: "Failed to remove monitoring script from index.html",
      error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
    });
  }
  logger2.info({ msg: "Building application" });
  const buildProcess = await sandbox.exec(
    ["sh", "-c", "cd /workspace && bun run build"],
    {
      mode: "text",
      stdout: "pipe",
      stderr: "pipe",
      workdir: "/workspace"
    }
  );
  const buildExitCode = await buildProcess.wait();
  const buildStdout = await buildProcess.stdout.readText();
  const buildStderr = await buildProcess.stderr.readText();
  if (buildExitCode !== 0) {
    const buildOutput = [buildStdout, buildStderr].filter(Boolean).join("\n") || "build command failed";
    logger2.error({
      msg: "Build failed",
      exitCode: buildExitCode,
      stdoutLength: buildStdout.length,
      stderrLength: buildStderr.length,
      hasTypeScriptErrors: buildOutput.includes("error TS")
    });
    const errorMessage = buildOutput.includes("error TS") ? `Failed to build application - TypeScript errors:
${buildOutput}` : `Failed to build application:
${buildOutput}`;
    throw new Error(errorMessage);
  }
  logger2.info({ msg: "Application built successfully" });
  const detectBuildDirProcess = await sandbox.exec(
    [
      "sh",
      "-c",
      "cd /workspace && (test -d dist && echo 'dist') || (test -d build && echo 'build') || (test -d out && echo 'out') || echo '.'"
    ],
    {
      mode: "text",
      stdout: "pipe",
      stderr: "pipe",
      workdir: "/workspace"
    }
  );
  await detectBuildDirProcess.wait();
  const buildDir = (await detectBuildDirProcess.stdout.readText()).trim() || "dist";
  logger2.info({ msg: "Using build directory", buildDir });
  const createZipProcess = await sandbox.exec(
    ["sh", "-c", `cd /workspace/${buildDir} && zip -r /tmp/${zipFileName} .`],
    {
      mode: "text",
      stdout: "pipe",
      stderr: "pipe",
      workdir: "/workspace"
    }
  );
  const zipExitCode = await createZipProcess.wait();
  const zipStderr = await createZipProcess.stderr.readText();
  if (zipExitCode !== 0) {
    throw new Error(
      `Failed to create zip file from build output: ${zipStderr || "zip command not available or failed"}`
    );
  }
  logger2.info({
    msg: "Zip file created successfully",
    buildDir,
    zipFileName
  });
  const curlCommand = `curl -s --show-error -w "\\nHTTP_STATUS_CODE:%{http_code}" --connect-timeout 30 --max-time 120 -X POST -H "bypass-tunnel-reminder: true" -H "Authorization: Bearer ${apiKey}" -F "projectId=${projectId}" -F "name=${sanitizedAppName}" -F "app=@/tmp/${zipFileName}" "${deploymentUrl}/api/deploy"`;
  logger2.info({
    msg: "Deploying via curl",
    deploymentUrl: `${deploymentUrl}/api/deploy`,
    projectId,
    appName: sanitizedAppName
  });
  let deployProcess;
  let deployExitCode = -1;
  let deployStdout = "";
  let deployStderr = "";
  let deployResult = "";
  let retryCount = 0;
  const maxRetries = 2;
  while (retryCount <= maxRetries) {
    if (retryCount > 0) {
      logger2.info({
        msg: "Retrying deployment",
        attempt: retryCount + 1,
        maxRetries: maxRetries + 1
      });
      await new Promise((resolve) => setTimeout(resolve, 2e3));
    }
    deployProcess = await sandbox.exec(["sh", "-c", curlCommand], {
      mode: "text",
      stdout: "pipe",
      stderr: "pipe",
      workdir: "/workspace"
    });
    deployExitCode = await deployProcess.wait();
    deployStdout = await deployProcess.stdout.readText();
    deployStderr = await deployProcess.stderr.readText();
    deployResult = deployStdout || deployStderr;
    if (deployExitCode === 0 && deployResult) {
      if (deployResult.includes(
        '"error":"Deployment failed: Deployment validation failed: Error: closed"'
      )) {
        logger2.info({
          msg: "Connection closed error detected, will retry if attempts remain"
        });
        retryCount++;
        if (retryCount > maxRetries) {
          break;
        }
      } else {
        break;
      }
    } else {
      break;
    }
  }
  if (!deployProcess || deployExitCode === -1) {
    throw new Error("Deployment result is undefined");
  }
  try {
    await sandbox.exec(["rm", "-f", `/tmp/${zipFileName}`], {
      mode: "text",
      stdout: "pipe",
      stderr: "pipe",
      workdir: "/workspace"
    });
  } catch (cleanupError) {
    logger2.warn({
      msg: "Failed to clean up zip file",
      error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
    });
  }
  const logs = filterSensitiveLogs(
    [
      `Build: ${buildStdout || "Success"}`,
      `Build Directory: ${buildDir}`,
      `ZIP Creation: Success`,
      `Deployment Response: ${deployResult || "No response"}`
    ].join("\n")
  );
  let httpStatusCode;
  let responseText = deployResult || "";
  const statusMatch = responseText.match(/HTTP_STATUS_CODE:(\d+)/);
  if (statusMatch) {
    httpStatusCode = statusMatch[1];
    responseText = responseText.replace(/\nHTTP_STATUS_CODE:\d+/, "");
  }
  logger2.info({
    msg: "Raw deployment response",
    exitCode: deployExitCode,
    httpStatusCode,
    responseLength: responseText.length
  });
  if (deployExitCode === 0) {
    let actualDeploymentUrl;
    try {
      const response = JSON.parse(responseText);
      if (response.error) {
        const errorMessage = `Deployment failed: ${response.error || "Unknown error"}`;
        throw new Error(errorMessage);
      }
      actualDeploymentUrl = response.url || response.deploymentUrl || response.link;
      logger2.info({
        msg: "Extracted deployment URL from JSON",
        deploymentUrl: response.deploymentUrl,
        url: response.url,
        link: response.link,
        actualDeploymentUrl
      });
      if (actualDeploymentUrl) {
        actualDeploymentUrl = actualDeploymentUrl.replace(/["}'\]]+$/, "");
        actualDeploymentUrl = forceHttpsForDeployments(
          actualDeploymentUrl,
          "ModalSandboxManager"
        );
      }
    } catch (parseError) {
      if (parseError instanceof Error && parseError.message.startsWith("Deployment failed:")) {
        throw parseError;
      }
      if (responseText.includes("<html>") || responseText.includes("<!DOCTYPE")) {
        logger2.warn({
          msg: "Received HTML response instead of JSON - deployment service may not be running"
        });
        throw new Error(
          "Deployment service returned HTML instead of JSON response. The deployment service may not be running or accessible."
        );
      }
      const urlMatches = responseText.match(/https?:\/\/[^\s"'}<>]+/g) || [];
      const validDeploymentUrls = urlMatches.filter((url) => {
        const lowerUrl = url.toLowerCase();
        return !lowerUrl.includes("/static/") && !lowerUrl.includes(".woff") && !lowerUrl.includes(".css") && !lowerUrl.includes(".js") && !lowerUrl.includes(".png") && !lowerUrl.includes(".jpg") && !lowerUrl.includes("cdn.ngrok.com") && !lowerUrl.includes("ngrok.com/static/");
      });
      logger2.info({
        msg: "Valid deployment URLs found",
        validDeploymentUrls
      });
      if (validDeploymentUrls.length > 0) {
        actualDeploymentUrl = validDeploymentUrls[0].replace(/["}'\]]+$/, "");
        actualDeploymentUrl = forceHttpsForDeployments(
          actualDeploymentUrl,
          "ModalSandboxManager"
        );
        logger2.info({
          msg: "Selected deployment URL",
          actualDeploymentUrl
        });
      }
    }
    logger2.info({
      msg: "Zip/curl deployment successful",
      projectId,
      deploymentUrl: actualDeploymentUrl
    });
    return {
      success: true,
      deploymentUrl: actualDeploymentUrl,
      logs
    };
  } else {
    throw new Error(
      `Curl deployment failed: ${deployResult || "curl command failed"}`
    );
  }
}
async function deployWithNodeScript(sandbox, projectId, sanitizedAppName, deploymentUrl, logger2) {
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
                deploymentUrl = deploymentUrl.replace(/["}']]+$/, '');
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
                deploymentUrl = deploymentUrl.replace(/["}']]+$/, '');
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
  logger2.info({
    msg: "Executing Node.js deployment script",
    appName: sanitizedAppName
  });
  logger2.info({
    msg: "Deployment URL",
    deploymentUrl: `${deploymentUrl}/api/deploy`
  });
  const escapedScript = deploymentScript.replace(/'/g, "'\\''");
  const deployProcess = await sandbox.exec(
    ["sh", "-c", `node -e '${escapedScript}'`],
    {
      mode: "text",
      stdout: "pipe",
      stderr: "pipe",
      workdir: "/workspace"
    }
  );
  const deployExitCode = await deployProcess.wait();
  const deployStdout = await deployProcess.stdout.readText();
  const deployStderr = await deployProcess.stderr.readText();
  const logs = deployStdout || deployStderr || "No output from deployment script";
  logger2.info({
    msg: "Deployment script completed",
    exitCode: deployExitCode,
    stdoutLength: deployStdout.length,
    stderrLength: deployStderr.length
  });
  if (deployExitCode === 0) {
    let actualDeploymentUrl;
    try {
      const successMatch = logs.match(/SUCCESS: ({.*})/);
      if (successMatch) {
        const result = JSON.parse(successMatch[1]);
        actualDeploymentUrl = result.deploymentUrl;
      }
    } catch (parseError) {
      if (logs.includes("<html>") || logs.includes("<!DOCTYPE")) {
        logger2.warn({
          msg: "Node.js script received HTML response - deployment service may not be running"
        });
        throw new Error(
          "Deployment service returned HTML instead of JSON response. The deployment service may not be running or accessible."
        );
      }
      const urlMatches = logs.match(/https?:\/\/[^\s"'}<>]+/g) || [];
      const validDeploymentUrls = urlMatches.filter((url) => {
        const lowerUrl = url.toLowerCase();
        return !lowerUrl.includes("/static/") && !lowerUrl.includes(".woff") && !lowerUrl.includes(".css") && !lowerUrl.includes(".js") && !lowerUrl.includes(".png") && !lowerUrl.includes(".jpg") && !lowerUrl.includes("cdn.ngrok.com") && !lowerUrl.includes("ngrok.com/static/");
      });
      if (validDeploymentUrls.length > 0) {
        actualDeploymentUrl = validDeploymentUrls[0];
      }
    }
    logger2.info({
      msg: "Node.js deployment successful",
      projectId,
      deploymentUrl: actualDeploymentUrl
    });
    return {
      success: true,
      deploymentUrl: actualDeploymentUrl,
      logs
    };
  } else {
    throw new Error(
      `Node.js deployment script failed with exit code ${deployExitCode}: ${logs}`
    );
  }
}

export {
  forceHttpsForDeployments,
  hasSnapshot,
  getSandbox,
  createSandbox,
  deleteSandbox,
  restoreV2FragmentInSandbox,
  restoreFilesInSandbox,
  restoreFilesInSandboxOptimized,
  patchViteConfigForImport,
  patchBase44ClientForImport,
  createFilesystemSnapshot,
  cleanupOldSnapshots,
  deleteSnapshot,
  cloneTemplateInSandbox,
  executeCommand,
  readFile,
  writeFile,
  listFiles,
  getSandboxStatus,
  startDevServer,
  closeModalClient,
  restoreV2FragmentById,
  restoreFilesById,
  findFiles,
  deploySandboxApp
};
