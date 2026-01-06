import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { daytonaAPI } from "@/lib/api/daytona-client";
import { appRouter } from "@/trpc/routers/_app";
import { ErrorType, ErrorSeverity } from "@/lib/db";

// Function to wait for Vite dependencies to be ready
async function waitForViteDependencies(page: any): Promise<void> {
  try {
    // Wait for Vite client connection message or successful module load
    await Promise.race([
      // Option 1: Wait for Vite client connection message in console
      page.waitForFunction(
        () => {
          // Check if Vite client is connected (look for window.__vite_plugin_react_preamble_installed__)
          return (window as any).__vite_plugin_react_preamble_installed__ === true;
        },
        { timeout: 15000 }
      ).catch(() => null),

      // Option 2: Wait for the root element to be rendered (indicates app loaded)
      page.waitForSelector('#root:not(:empty)', { timeout: 15000 }).catch(() => null),

      // Option 3: Wait for console message indicating Vite is ready
      new Promise((resolve) => {
        const handler = (msg: any) => {
          const text = msg.text();
          if (
            text.includes('connected') ||
            text.includes('Vite') ||
            text.includes('ready in')
          ) {
            page.off('console', handler);
            resolve(true);
          }
        };
        page.on('console', handler);
        setTimeout(() => {
          page.off('console', handler);
          resolve(false);
        }, 15000);
      })
    ]);

    console.log(`[ErrorDetectionAPI] Vite dependencies appear to be ready`);
  } catch (error) {
    console.warn(`[ErrorDetectionAPI] Timeout waiting for Vite dependencies:`, error);
    // Continue anyway - some errors might still be detectable
  }
}

// Function to detect runtime errors by running the application
async function detectRuntimeErrors(
  sandboxInfo: any,
  projectId: string
): Promise<any[]> {
  const runtimeErrors: any[] = [];

  try {
    console.log(
      `[ErrorDetectionAPI] Starting runtime error detection for project ${projectId}`
    );

    // Get the project's preview URL
    const previewUrl = sandboxInfo.sandboxUrl;
    console.log(`[ErrorDetectionAPI] Checking preview URL: ${previewUrl}`);

    // Use a headless browser to check for runtime errors
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Set up console error monitoring
    const consoleErrors: any[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push({
          message: msg.text(),
          type: "console",
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Set up page error monitoring
    page.on("pageerror", (error) => {
      consoleErrors.push({
        message: error.message,
        type: "page",
        stack: error.stack,
        timestamp: new Date().toISOString(),
      });
    });

    // Navigate to the preview URL and wait for potential errors
    try {
      await page.goto(previewUrl, {
        waitUntil: "networkidle",
        timeout: 10000,
      });

      // Wait for Vite dependency optimization to complete
      console.log(`[ErrorDetectionAPI] Waiting for Vite dependencies to be ready...`);
      await waitForViteDependencies(page);

      // Wait a bit more for any async errors
      await page.waitForTimeout(2000);
    } catch (navigationError) {
      const errorMessage =
        navigationError instanceof Error
          ? navigationError.message
          : String(navigationError);
      console.log(
        `[ErrorDetectionAPI] Navigation error (expected): ${errorMessage}`
      );
      // Navigation errors are often runtime errors we want to catch
      consoleErrors.push({
        message: errorMessage,
        type: "navigation",
        timestamp: new Date().toISOString(),
      });
    }

    // Process detected errors
    for (const error of consoleErrors) {
      // Try to parse file information from the error message or stack
      let file = "/src/App.tsx";
      let line = 1;
      let column = 1;

      // Look for file patterns in the error message
      const fileMatch = error.message.match(
        /([^\/\s]+\.(tsx?|jsx?|js|ts)):(\d+)/
      );
      if (fileMatch) {
        file = `/src/${fileMatch[1]}`;
        line = parseInt(fileMatch[3]) || 1;
      }

      // Look for stack trace information
      if (error.stack) {
        const stackMatch = error.stack.match(
          /at\s+.*?\(([^)]+\.(tsx?|jsx?|js|ts)):(\d+):(\d+)\)/
        );
        if (stackMatch) {
          file = stackMatch[1];
          line = parseInt(stackMatch[3]) || 1;
          column = parseInt(stackMatch[4]) || 1;
        }
      }

      const runtimeError = {
        message: error.message,
        file,
        line,
        column,
        severity: determineRuntimeErrorSeverity(error.message),
        autoFixable: isRuntimeErrorAutoFixable(error.message),
        type: "RUNTIME",
        timestamp: error.timestamp,
      };

      runtimeErrors.push(runtimeError);
    }

    await browser.close();

    console.log(
      `[ErrorDetectionAPI] Detected ${runtimeErrors.length} runtime errors`
    );
  } catch (error) {
    console.error(`[ErrorDetectionAPI] Error during runtime detection:`, error);
  }

  return runtimeErrors;
}

// Helper function to determine runtime error severity
function determineRuntimeErrorSeverity(message: string): ErrorSeverity {
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
    return ErrorSeverity.CRITICAL;
  }

  if (highPatterns.some((pattern) => pattern.test(message))) {
    return ErrorSeverity.HIGH;
  }

  return ErrorSeverity.MEDIUM;
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = await params;
    const userId = session.user.id;

    console.log(
      `[ErrorDetectionAPI] Detecting errors for project ${projectId}`
    );

    // Check if user has access to project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { userId }, // Personal project
          { team: { members: { some: { userId } } } }, // Team project
        ],
      },
      select: {
        id: true,
        activeFragmentId: true,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found or access denied" },
        { status: 404 }
      );
    }

    // Get the latest V2Fragment for error detection
    // First try to get the active fragment, then fall back to latest
    let latestFragment = null;

    // Check if project has an active fragment
    if (project.activeFragmentId) {
      latestFragment = await prisma.v2Fragment.findUnique({
        where: { id: project.activeFragmentId },
        select: { id: true, title: true, files: true },
      });

      if (latestFragment) {
        console.log(
          `[ErrorDetectionAPI] Using active fragment ${project.activeFragmentId}: "${latestFragment.title}"`
        );
      }
    }

    // Fall back to latest fragment if no active fragment found
    if (!latestFragment) {
      latestFragment = await prisma.v2Fragment.findFirst({
        where: { projectId },
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, files: true },
      });

      if (latestFragment) {
        console.log(
          `[ErrorDetectionAPI] Using latest fragment ${latestFragment.id}: "${latestFragment.title}"`
        );
      }
    }

    if (!latestFragment || !latestFragment.files) {
      return NextResponse.json({
        success: true,
        errors: {
          buildErrors: [],
          runtimeErrors: [],
          importErrors: [],
          navigationErrors: [],
          severity: "low",
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
          overallComplexity: "simple",
          estimatedFixTime: 0,
          successConfidence: 1.0,
          recommendedApproach: "auto-fix",
        },
        storedErrors: [],
        autoFixSession: null,
        canAutoFix: false,
        detectedAt: new Date().toISOString(),
        message: "No V2Fragment found for analysis",
      });
    }

    console.log(
      `[ErrorDetectionAPI] Analyzing V2Fragment ${latestFragment.id} with ${
        Object.keys(latestFragment.files as { [path: string]: string }).length
      } files using hybrid approach`
    );

    // Use API for hybrid error detection (fragment + project build)
    // The API handles sandbox availability and fallback automatically
    console.log(`[ErrorDetectionAPI] Calling API for hybrid error detection`);

    const apiResult = await daytonaAPI.detectHybridErrors(
      projectId,
      latestFragment.id
    );

    const detectedErrors = apiResult.errors;
    let classification = apiResult.classification;
    const analysisType = apiResult.analysisType;

    // Also detect runtime errors by running the application
    // (This still needs sandbox URL, so get it from API)
    const sandboxInfo = await daytonaAPI.getSandbox(projectId);
    if (sandboxInfo?.sandboxUrl) {
      console.log(
        `[ErrorDetectionAPI] Detecting runtime errors for project ${projectId}`
      );
      const runtimeErrors = await detectRuntimeErrors(sandboxInfo, projectId);

      // Add runtime errors to detected errors
      detectedErrors.runtimeErrors = runtimeErrors;
      detectedErrors.totalErrors += runtimeErrors.length;

      // Update auto-fixable status if runtime errors are auto-fixable
      if (runtimeErrors.some((error) => error.autoFixable)) {
        detectedErrors.autoFixable = true;
      }

      // Re-classify with runtime errors included
      const { ErrorClassifier } = await import("@/lib/error-classifier");
      classification = ErrorClassifier.categorizeErrors(detectedErrors);
    }

    // Use tRPC to store errors and create auto-fix session
    const caller = appRouter.createCaller({
      session,
      userId: userId,
    });
    const result = await caller.errors.storeErrors({
      projectId,
      errors: detectedErrors,
      fragmentId: latestFragment.id,
    });

    console.log(
      `[ErrorDetectionAPI] Detected ${detectedErrors.totalErrors} errors in V2Fragment ${latestFragment.id}`
    );

    return NextResponse.json({
      success: true,
      errors: detectedErrors,
      classification,
      storedErrors: result.storedErrors,
      autoFixSession: result.autoFixSession,
      canAutoFix: detectedErrors.autoFixable,
      detectedAt: new Date().toISOString(),
      fragmentId: latestFragment.id,
      fragmentTitle: latestFragment.title,
      analysisType,
      runtimeErrorsDetected: detectedErrors.runtimeErrors?.length || 0,
    });
  } catch (error) {
    console.error("[ErrorDetectionAPI] Error detection failed:", error);
    return NextResponse.json(
      {
        error: "Error detection failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
