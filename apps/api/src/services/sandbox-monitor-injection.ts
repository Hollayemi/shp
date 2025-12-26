/**
 * Sandbox Monitor Injection Utilities - API Server
 *
 * Handles injection of monitoring scripts into Daytona sandboxes during creation.
 * The monitoring script is placed in a .shipper directory and imported via script tag.
 */

import type { Sandbox } from "@daytonaio/sdk";
import { readFileFromSandbox, writeFileToSandbox } from "./sandbox-compat.js";
import { generateMonitorScript, MONITOR_CONFIG } from "@shipper/shared";

// Cache the monitoring script content
let MONITOR_SCRIPT_CONTENT: string | null = null;

function getMonitorScriptContent(): string {
  if (!MONITOR_SCRIPT_CONTENT) {
    MONITOR_SCRIPT_CONTENT = generateMonitorScript(MONITOR_CONFIG.ALLOWED_ORIGINS);
  }
  return MONITOR_SCRIPT_CONTENT;
}

/**
 * Inject monitoring script into a sandbox's index.html
 * Creates a .shipper directory with the monitoring script and imports it
 */
export async function injectMonitoringIntoSandbox(
  sandbox: Sandbox,
  sandboxId: string,
  options: {
    indexHtmlPath?: string;
  } = {}
): Promise<{ success: boolean; error?: string }> {
  const {
    indexHtmlPath = "index.html",
  } = options;

  try {
    // 1. Create .shipper directory with monitoring script
    console.log(
      `[SandboxMonitorInjection] Creating .shipper directory in sandbox ${sandboxId}`
    );

    const monitorScriptContent = getMonitorScriptContent();
    await writeFileToSandbox(sandbox, ".shipper/monitor.js", monitorScriptContent);

    // 2. Read the current index.html
    console.log(
      `[SandboxMonitorInjection] Reading ${indexHtmlPath} from sandbox ${sandboxId}`
    );

    let htmlContent: string;
    try {
      htmlContent = await readFileFromSandbox(sandbox, indexHtmlPath);
    } catch (error) {
      return {
        success: false,
        error: `Failed to read ${indexHtmlPath}: ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    // 3. Check if monitoring script is already injected
    if (htmlContent.includes(".shipper/monitor.js")) {
      console.log(
        `[SandboxMonitorInjection] Monitoring script already present in ${indexHtmlPath}`
      );
      return { success: true };
    }

    // 4. Inject the script import tag
    const scriptTag = '<script type="module" src="/.shipper/monitor.js"></script>';
    let modifiedHtml = htmlContent;

    // Try to inject before </head> if it exists
    if (modifiedHtml.includes("</head>")) {
      modifiedHtml = modifiedHtml.replace("</head>", `  ${scriptTag}\n  </head>`);
    }
    // Otherwise inject at the beginning of <body>
    else if (modifiedHtml.includes("<body")) {
      modifiedHtml = modifiedHtml.replace(/<body[^>]*>/, (match) => `${match}\n  ${scriptTag}`);
    }
    // Fallback: prepend to HTML
    else {
      modifiedHtml = scriptTag + '\n' + modifiedHtml;
    }

    // 5. Write the modified HTML back to the sandbox
    console.log(
      `[SandboxMonitorInjection] Writing modified ${indexHtmlPath} to sandbox ${sandboxId}`
    );

    await writeFileToSandbox(sandbox, indexHtmlPath, modifiedHtml);

    console.log(
      `[SandboxMonitorInjection] Successfully injected monitoring script into ${indexHtmlPath}`
    );

    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error(
      `[SandboxMonitorInjection] Error injecting monitoring script:`,
      error
    );
    return {
      success: false,
      error: `Unexpected error: ${errorMessage}`,
    };
  }
}

/**
 * Inject monitoring script when creating a new sandbox
 *
 * This should be called after the sandbox is created and the dev server is running
 */
export async function setupSandboxMonitoring(
  sandbox: Sandbox,
  sandboxId: string,
  projectId: string
): Promise<void> {
  console.log(
    `[SandboxMonitorInjection] Setting up monitoring for sandbox ${sandboxId} (project ${projectId})`
  );

  // Wait a bit for the dev server to generate index.html
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const result = await injectMonitoringIntoSandbox(sandbox, sandboxId);

  if (!result.success) {
    console.error(
      `[SandboxMonitorInjection] Failed to setup monitoring: ${result.error}`
    );
    // Don't throw - monitoring is not critical for sandbox operation
  } else {
    console.log(
      `[SandboxMonitorInjection] Monitoring setup complete for sandbox ${sandboxId}`
    );
  }
}

/**
 * Re-inject monitoring script (useful after sandbox restart or dev server restart)
 */
export async function reinjectMonitoring(
  sandbox: Sandbox,
  sandboxId: string
): Promise<void> {
  console.log(`[SandboxMonitorInjection] Re-injecting monitoring for sandbox ${sandboxId}`);

  // Recreate the .shipper/monitor.js file with latest content
  const monitorScriptContent = getMonitorScriptContent();
  await writeFileToSandbox(sandbox, ".shipper/monitor.js", monitorScriptContent);

  // Read the current index.html
  let htmlContent: string;
  try {
    htmlContent = await readFileFromSandbox(sandbox, "index.html");
  } catch (error) {
    console.error(
      `[SandboxMonitorInjection] Cannot re-inject: failed to read index.html`
    );
    return;
  }

  // Check if script import is already present
  if (htmlContent.includes(".shipper/monitor.js")) {
    console.log(
      `[SandboxMonitorInjection] Monitoring script import already present`
    );
    return;
  }

  // Remove old inline monitoring script if present (legacy)
  let cleanHtml = htmlContent;
  if (cleanHtml.includes("MONITOR_INITIALIZED")) {
    cleanHtml = cleanHtml.replace(
      /<script type="module">[\s\S]*?MONITOR_INITIALIZED[\s\S]*?<\/script>/,
      ""
    );
  }

  // Inject the script import tag
  const scriptTag = '<script type="module" src="/.shipper/monitor.js"></script>';
  let modifiedHtml = cleanHtml;

  // Try to inject before </head> if it exists
  if (modifiedHtml.includes("</head>")) {
    modifiedHtml = modifiedHtml.replace("</head>", `  ${scriptTag}\n  </head>`);
  }
  // Otherwise inject at the beginning of <body>
  else if (modifiedHtml.includes("<body")) {
    modifiedHtml = modifiedHtml.replace(/<body[^>]*>/, (match) => `${match}\n  ${scriptTag}`);
  }
  // Fallback: prepend to HTML
  else {
    modifiedHtml = scriptTag + '\n' + modifiedHtml;
  }

  await writeFileToSandbox(sandbox, "index.html", modifiedHtml);

  console.log(
    `[SandboxMonitorInjection] Successfully re-injected monitoring script`
  );
}
