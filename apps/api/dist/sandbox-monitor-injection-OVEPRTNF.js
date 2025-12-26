import { createRequire } from 'module';const require = createRequire(import.meta.url);
import {
  readFileFromSandbox,
  writeFileToSandbox
} from "./chunk-Q73ELRDT.js";
import "./chunk-IDZAZ4YU.js";
import "./chunk-TIBZDRCE.js";
import "./chunk-YMWDDMLV.js";
import {
  init_esm_shims
} from "./chunk-IXOW5DJO.js";

// src/services/sandbox-monitor-injection.ts
init_esm_shims();
import { generateMonitorScript, MONITOR_CONFIG } from "@shipper/shared";
var MONITOR_SCRIPT_CONTENT = null;
function getMonitorScriptContent() {
  if (!MONITOR_SCRIPT_CONTENT) {
    MONITOR_SCRIPT_CONTENT = generateMonitorScript(MONITOR_CONFIG.ALLOWED_ORIGINS);
  }
  return MONITOR_SCRIPT_CONTENT;
}
async function injectMonitoringIntoSandbox(sandbox, sandboxId, options = {}) {
  const {
    indexHtmlPath = "index.html"
  } = options;
  try {
    console.log(
      `[SandboxMonitorInjection] Creating .shipper directory in sandbox ${sandboxId}`
    );
    const monitorScriptContent = getMonitorScriptContent();
    await writeFileToSandbox(sandbox, ".shipper/monitor.js", monitorScriptContent);
    console.log(
      `[SandboxMonitorInjection] Reading ${indexHtmlPath} from sandbox ${sandboxId}`
    );
    let htmlContent;
    try {
      htmlContent = await readFileFromSandbox(sandbox, indexHtmlPath);
    } catch (error) {
      return {
        success: false,
        error: `Failed to read ${indexHtmlPath}: ${error instanceof Error ? error.message : String(error)}`
      };
    }
    if (htmlContent.includes(".shipper/monitor.js")) {
      console.log(
        `[SandboxMonitorInjection] Monitoring script already present in ${indexHtmlPath}`
      );
      return { success: true };
    }
    const scriptTag = '<script type="module" src="/.shipper/monitor.js"></script>';
    let modifiedHtml = htmlContent;
    if (modifiedHtml.includes("</head>")) {
      modifiedHtml = modifiedHtml.replace("</head>", `  ${scriptTag}
  </head>`);
    } else if (modifiedHtml.includes("<body")) {
      modifiedHtml = modifiedHtml.replace(/<body[^>]*>/, (match) => `${match}
  ${scriptTag}`);
    } else {
      modifiedHtml = scriptTag + "\n" + modifiedHtml;
    }
    console.log(
      `[SandboxMonitorInjection] Writing modified ${indexHtmlPath} to sandbox ${sandboxId}`
    );
    await writeFileToSandbox(sandbox, indexHtmlPath, modifiedHtml);
    console.log(
      `[SandboxMonitorInjection] Successfully injected monitoring script into ${indexHtmlPath}`
    );
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `[SandboxMonitorInjection] Error injecting monitoring script:`,
      error
    );
    return {
      success: false,
      error: `Unexpected error: ${errorMessage}`
    };
  }
}
async function setupSandboxMonitoring(sandbox, sandboxId, projectId) {
  console.log(
    `[SandboxMonitorInjection] Setting up monitoring for sandbox ${sandboxId} (project ${projectId})`
  );
  await new Promise((resolve) => setTimeout(resolve, 2e3));
  const result = await injectMonitoringIntoSandbox(sandbox, sandboxId);
  if (!result.success) {
    console.error(
      `[SandboxMonitorInjection] Failed to setup monitoring: ${result.error}`
    );
  } else {
    console.log(
      `[SandboxMonitorInjection] Monitoring setup complete for sandbox ${sandboxId}`
    );
  }
}
async function reinjectMonitoring(sandbox, sandboxId) {
  console.log(`[SandboxMonitorInjection] Re-injecting monitoring for sandbox ${sandboxId}`);
  const monitorScriptContent = getMonitorScriptContent();
  await writeFileToSandbox(sandbox, ".shipper/monitor.js", monitorScriptContent);
  let htmlContent;
  try {
    htmlContent = await readFileFromSandbox(sandbox, "index.html");
  } catch (error) {
    console.error(
      `[SandboxMonitorInjection] Cannot re-inject: failed to read index.html`
    );
    return;
  }
  if (htmlContent.includes(".shipper/monitor.js")) {
    console.log(
      `[SandboxMonitorInjection] Monitoring script import already present`
    );
    return;
  }
  let cleanHtml = htmlContent;
  if (cleanHtml.includes("MONITOR_INITIALIZED")) {
    cleanHtml = cleanHtml.replace(
      /<script type="module">[\s\S]*?MONITOR_INITIALIZED[\s\S]*?<\/script>/,
      ""
    );
  }
  const scriptTag = '<script type="module" src="/.shipper/monitor.js"></script>';
  let modifiedHtml = cleanHtml;
  if (modifiedHtml.includes("</head>")) {
    modifiedHtml = modifiedHtml.replace("</head>", `  ${scriptTag}
  </head>`);
  } else if (modifiedHtml.includes("<body")) {
    modifiedHtml = modifiedHtml.replace(/<body[^>]*>/, (match) => `${match}
  ${scriptTag}`);
  } else {
    modifiedHtml = scriptTag + "\n" + modifiedHtml;
  }
  await writeFileToSandbox(sandbox, "index.html", modifiedHtml);
  console.log(
    `[SandboxMonitorInjection] Successfully re-injected monitoring script`
  );
}
export {
  injectMonitoringIntoSandbox,
  reinjectMonitoring,
  setupSandboxMonitoring
};
