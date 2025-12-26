#!/usr/bin/env node

/**
 * Standalone Playwright runtime error detection script
 * This script runs in a Daytona sandbox to check for runtime errors
 * in a target application URL.
 *
 * Usage: node playwright-runtime-checker.ts <targetUrl> [maxRetries]
 */

import { chromium } from "playwright";

interface ErrorData {
  message: string;
  type: string;
  stack?: string;
  timestamp: string;
}

interface RuntimeError {
  id: string;
  type: "RUNTIME";
  message: string;
  url: string; // file path
  line: number;
  column: number;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  autoFixable: boolean;
  details: {
    errorType: string;
    timestamp: string;
    stack?: string;
    file: string;
  };
}

// Function to wait for Vite dependencies to be ready
async function waitForViteDependencies(page: any): Promise<void> {
  try {
    // Wait for Vite client connection message or successful module load
    await Promise.race([
      // Option 1: Wait for Vite client connection message in console
      page
        .waitForFunction(
          () => {
            // Check if Vite client is connected (look for window.__vite_plugin_react_preamble_installed__)
            return (
              (window as any).__vite_plugin_react_preamble_installed__ === true
            );
          },
          { timeout: 15000 },
        )
        .catch(() => null),

      // Option 2: Wait for the root element to be rendered (indicates app loaded)
      page
        .waitForSelector("#root:not(:empty)", { timeout: 15000 })
        .catch(() => null),

      // Option 3: Wait for console message indicating Vite is ready
      new Promise((resolve) => {
        const handler = (msg: any) => {
          const text = msg.text();
          if (
            text.includes("connected") ||
            text.includes("Vite") ||
            text.includes("ready in")
          ) {
            page.off("console", handler);
            resolve(true);
          }
        };
        page.on("console", handler);
        setTimeout(() => {
          page.off("console", handler);
          resolve(false);
        }, 15000);
      }),
    ]);

    console.log(`[detectErrors] Vite dependencies appear to be ready`);
  } catch (error) {
    console.warn(
      `[detectErrors] Timeout waiting for Vite dependencies:`,
      error,
    );
    // Continue anyway - some errors might still be detectable
  }
}

// Helper function to check if page has actual content rendered
async function checkPageHasContent(page: any): Promise<boolean> {
  try {
    // Check if #root has actual content (not empty)
    const hasRootContent = await page.evaluate(() => {
      const root = document.querySelector("#root");
      if (!root) return false;

      // Check if root has text content or child elements
      const hasText = (root.textContent || "").trim().length > 0;
      const hasChildren = root.children.length > 0;

      return hasText || hasChildren;
    });

    if (hasRootContent) {
      console.log("[detectErrors] Page has content in #root");
      return true;
    }

    // Fallback: check if body has meaningful content
    const hasBodyContent = await page.evaluate(() => {
      const body = document.body;
      const textContent = (body.textContent || "").trim();

      // Ignore common loading/error messages
      const ignoredTexts = ["loading", "error", "failed to fetch"];
      const hasIgnoredText = ignoredTexts.some((text) =>
        textContent.toLowerCase().includes(text),
      );

      return textContent.length > 20 && !hasIgnoredText;
    });

    if (hasBodyContent) {
      console.log("[detectErrors] Page has content in body");
      return true;
    }

    return false;
  } catch (error) {
    console.warn("[detectErrors] Error checking page content:", error);
    return false;
  }
}

// Helper function to determine runtime error severity
function determineRuntimeErrorSeverity(message: string): "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" {
  const criticalPatterns = [
    /Cannot read propert/i,
    /Cannot access/i,
    /ReferenceError/i,
    /TypeError/i,
    /Maximum call stack/i,
    /Cannot find module/i,
    /Module not found/i,
    /Failed to resolve/i,
    /Cannot resolve/i,
    /does not provide an export named/i,
    /does not provide an export/i,
    /has no exported member/i,
    /Cannot import/i,
    /Import error/i,
    /Export.*not found/i,
    /Uncaught SyntaxError/i,
  ];

  const highPatterns = [
    /Failed to fetch/i,
    /Network error/i,
    /Connection refused/i,
    /Timeout/i,
  ];

  if (criticalPatterns.some((pattern) => pattern.test(message))) {
    return "CRITICAL";
  }

  if (highPatterns.some((pattern) => pattern.test(message))) {
    return "HIGH";
  }

  return "MEDIUM";
}

// Helper function to determine if runtime error is auto-fixable
function isRuntimeErrorAutoFixable(message: string): boolean {
  const autoFixablePatterns = [
    /Cannot read propert/i,
    /Cannot access/i,
    /Module not found/i,
    /Failed to fetch/i,
    /Cannot find module/i,
    /Failed to resolve/i,
    /Cannot resolve/i,
    /does not provide an export named/i,
    /does not provide an export/i,
    /has no exported member/i,
    /Cannot import/i,
    /Import error/i,
    /Export.*not found/i,
    /Uncaught SyntaxError/i,
  ];

  return autoFixablePatterns.some((pattern) => pattern.test(message));
}

// Main detection function
async function detectRuntimeErrors(
  sandboxUrl: string,
  maxRetries: number = 3,
  authHeaders: Record<string, string> = {},
): Promise<RuntimeError[]> {
  const runtimeErrors: RuntimeError[] = [];

  try {
    console.log(
      `[detectErrors] Starting runtime error detection for URL ${sandboxUrl} (max retries: ${maxRetries})`,
    );

    if (Object.keys(authHeaders).length > 0) {
      console.log(
        `[detectErrors] Using authentication headers:`,
        Object.keys(authHeaders),
      );
    }

    console.log(`[detectErrors] Checking sandbox URL: ${sandboxUrl}`);

    // Use a headless browser to check for runtime errors
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      extraHTTPHeaders: authHeaders, // Add auth headers to all requests
    });
    const page = await context.newPage();

    // Set up console error monitoring
    const consoleErrors: ErrorData[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const errorData: ErrorData = {
          message: msg.text(),
          type: "console",
          timestamp: new Date().toISOString(),
        };
        consoleErrors.push(errorData);
        console.log(
          "[detectErrors] Console error captured:",
          errorData.message,
        );
      }
    });

    // Set up page error monitoring
    page.on("pageerror", (error) => {
      const errorData: ErrorData = {
        message: error.message,
        type: "page",
        stack: error.stack,
        timestamp: new Date().toISOString(),
      };
      consoleErrors.push(errorData);
      console.log("[detectErrors] Page error captured:", {
        message: error.message,
        stack: error.stack?.substring(0, 150),
      });
    });

    // Retry logic to ensure content is actually showing
    let hasContent = false;
    let attempt = 0;

    while (!hasContent && attempt < maxRetries) {
      attempt++;
      console.log(
        `[detectErrors] Attempt ${attempt}/${maxRetries} to load content...`,
      );

      try {
        // Navigate to the sandbox URL
        await page.goto(sandboxUrl, {
          waitUntil: "networkidle",
          timeout: 10000,
        });

        // Wait for Vite dependency optimization to complete
        console.log(
          `[detectErrors] Waiting for Vite dependencies to be ready...`,
        );
        await waitForViteDependencies(page);

        // Wait a bit more for content to render
        await page.waitForTimeout(2000);

        // Check if page has actual content
        hasContent = await checkPageHasContent(page);

        if (hasContent) {
          console.log(
            `[detectErrors] ✓ Content successfully rendered on attempt ${attempt}`,
          );
        } else {
          console.log(
            `[detectErrors] ✗ No content detected on attempt ${attempt}`,
          );

          if (attempt < maxRetries) {
            console.log(`[detectErrors] Waiting 2s before retry...`);
            await page.waitForTimeout(2000);

            // Reload the page for next attempt
            await page.reload({ waitUntil: "networkidle", timeout: 10000 });
          }
        }
      } catch (navigationError) {
        const errorMessage =
          navigationError instanceof Error
            ? navigationError.message
            : String(navigationError);
        const errorStack =
          navigationError instanceof Error ? navigationError.stack : undefined;

        console.log(`[detectErrors] Navigation error on attempt ${attempt}:`, {
          message: errorMessage,
          stack: errorStack?.substring(0, 150),
        });

        // Navigation errors are often runtime errors we want to catch
        const navError: ErrorData = {
          message: errorMessage,
          type: "navigation",
          stack: errorStack,
          timestamp: new Date().toISOString(),
        };
        consoleErrors.push(navError);
        console.log("[detectErrors] Navigation error added to console errors");

        if (attempt < maxRetries) {
          console.log(`[detectErrors] Retrying after navigation error...`);
          await page.waitForTimeout(2000);
        }
      }
    }

    // Report final status
    if (!hasContent) {
      console.warn(
        `[detectErrors] ⚠ Failed to detect content after ${maxRetries} attempts`,
      );
      const contentError: ErrorData = {
        message: `Page failed to render content after ${maxRetries} attempts`,
        type: "content-check",
        timestamp: new Date().toISOString(),
      };
      consoleErrors.push(contentError);
      console.log("[detectErrors] Content check error added:", contentError);
    } else {
      console.log(
        `[detectErrors] ✓ Content successfully detected with ${consoleErrors.length} errors captured so far`,
      );
    }

    // Process detected errors
    console.log(
      `[detectErrors] Processing ${consoleErrors.length} console errors...`,
    );
    for (const error of consoleErrors) {
      // Try to parse file information from the error message or stack
      let file = "/src/App.tsx";
      let line = 1;
      let column = 1;

      // Look for file patterns in the error message
      const fileMatch = error.message.match(
        /([^\/\s]+\.(tsx?|jsx?|js|ts)):(\d+)/,
      );
      if (fileMatch) {
        file = `/src/${fileMatch[1]}`;
        line = parseInt(fileMatch[3]) || 1;
      }

      // Look for stack trace information
      if (error.stack) {
        const stackMatch = error.stack.match(
          /at\s+.*?\(([^)]+\.(tsx?|jsx?|js|ts)):(\d+):(\d+)\)/,
        );
        if (stackMatch) {
          file = stackMatch[1];
          line = parseInt(stackMatch[3]) || 1;
          column = parseInt(stackMatch[4]) || 1;
        }
      }

      const runtimeError: RuntimeError = {
        id: `runtime_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: "RUNTIME",
        message: error.message,
        url: file, // Use url field for file path
        line,
        column,
        severity: determineRuntimeErrorSeverity(error.message),
        autoFixable: isRuntimeErrorAutoFixable(error.message),
        details: {
          errorType: error.type,
          timestamp: error.timestamp,
          stack: error.stack,
          file, // Store file path in details
        },
      };

      // Log each runtime error with full details
      console.log(`[detectErrors] Runtime Error ${runtimeErrors.length + 1}:`, {
        id: runtimeError.id,
        severity: runtimeError.severity,
        file,
        line,
        column,
        type: error.type,
        message: error.message,
        autoFixable: runtimeError.autoFixable,
        stack: error.stack ? error.stack.substring(0, 200) : undefined,
      });

      runtimeErrors.push(runtimeError);
    }

    await browser.close();

    console.log(
      `[detectErrors] Detected ${runtimeErrors.length} runtime errors`,
    );

    // Log summary of all runtime errors by severity
    if (runtimeErrors.length > 0) {
      const errorsBySeverity = runtimeErrors.reduce(
        (acc, err) => {
          acc[err.severity] = (acc[err.severity] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );
      console.log(
        "[detectErrors] Runtime errors by severity:",
        errorsBySeverity,
      );

      // Log critical errors separately for visibility
      const criticalErrors = runtimeErrors.filter(
        (err) => err.severity === "CRITICAL",
      );
      if (criticalErrors.length > 0) {
        console.log(
          `[detectErrors] ⚠️  ${criticalErrors.length} CRITICAL runtime errors:`,
        );
        criticalErrors.forEach((err) => {
          console.log(`  - ${err.url}:${err.line} - ${err.message}`);
        });
      }
    }
  } catch (error) {
    console.error(`[detectErrors] Error during runtime detection:`, error);
    // Re-throw setup/infrastructure errors so they bubble up
    throw error;
  }

  return runtimeErrors;
}

// Main execution
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error(
      "Usage: node playwright-runtime-checker.ts <targetUrl> [maxRetries] [authHeadersJson]",
    );
    process.exit(1);
  }

  const targetUrl = args[0];
  const maxRetries = args[1] ? parseInt(args[1]) : 3;
  const authHeaders = args[2] ? JSON.parse(args[2]) : {};

  console.log(`Starting Playwright runtime detection for ${targetUrl}`);

  try {
    const errors = await detectRuntimeErrors(targetUrl, maxRetries, authHeaders);

    // Output results as JSON
    console.log("\n=== RESULTS ===");
    console.log(JSON.stringify({
      success: true,
      errors,
      totalErrors: errors.length,
      timestamp: new Date().toISOString(),
    }, null, 2));
  } catch (error) {
    // Infrastructure/setup errors (browser not installed, network issues, etc.)
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error("Infrastructure error during Playwright check:", errorMessage);

    console.log("\n=== RESULTS ===");
    console.log(JSON.stringify({
      success: false,
      errors: [],
      totalErrors: 0,
      error: errorMessage,
      errorType: "INFRASTRUCTURE",
      stack: errorStack,
      timestamp: new Date().toISOString(),
    }, null, 2));
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    console.log(JSON.stringify({
      success: false,
      errors: [],
      totalErrors: 0,
      error: error instanceof Error ? error.message : String(error),
      errorType: "FATAL",
      timestamp: new Date().toISOString(),
    }, null, 2));
    process.exit(1);
  });
}

export { detectRuntimeErrors };
export type { RuntimeError };
