/**
 * @deprecated This file is deprecated and should not be used in new code.
 *
 * The ErrorDetector functionality has been migrated to the API server (apps/api).
 * Use the daytonaAPI client instead:
 *
 * @example
 * import { daytonaAPI } from "@/lib/api/daytona-client";
 *
 * // Detect errors
 * const result = await daytonaAPI.detectHybridErrors(projectId, fragmentId);
 *
 * // Auto-fix errors
 * const fixResult = await daytonaAPI.autoFixErrors(projectId, fragmentId);
 *
 * This file will be removed in a future update. The API server provides:
 * - /api/v1/daytona/errors/detect-hybrid - Hybrid error detection
 * - /api/v1/daytona/errors/auto-fix - Auto-fix errors with VoltAgent
 */

import type { Sandbox } from "@daytonaio/sdk";
import {
  runCommandOnSandbox,
  type DaytonaExecutionResult,
} from "./ai/sandbox-compat";
import { ErrorType, ErrorSeverity, ErrorStatus } from "@/lib/db";
import { validateEslintOutput } from "@shipper/shared";

// Error interfaces based on the implementation ticket
export interface BuildError {
  id: string;
  type: ErrorType;
  message: string;
  file?: string;
  line?: number;
  column?: number;
  severity: ErrorSeverity;
  autoFixable: boolean;
  details: Record<string, any>;
}

export interface RuntimeError {
  id: string;
  type: ErrorType;
  message: string;
  stack?: string;
  url?: string;
  line?: number;
  column?: number;
  severity: ErrorSeverity;
  autoFixable: boolean;
  details: Record<string, any>;
}

export interface ImportError {
  id: string;
  type: ErrorType;
  message: string;
  file: string;
  importPath: string;
  severity: ErrorSeverity;
  autoFixable: boolean;
  details: Record<string, any>;
}

export interface NavigationError {
  id: string;
  type: ErrorType;
  message: string;
  route: string;
  file?: string;
  severity: ErrorSeverity;
  autoFixable: boolean;
  details: Record<string, any>;
}

export type ProjectError =
  | BuildError
  | RuntimeError
  | ImportError
  | NavigationError;

export interface ProjectErrors {
  buildErrors: BuildError[];
  runtimeErrors: RuntimeError[];
  importErrors: ImportError[];
  navigationErrors: NavigationError[];
  severity: "low" | "medium" | "high" | "critical";
  autoFixable: boolean;
  totalErrors: number;
  detectedAt: Date;
}

export class ErrorDetector {
  private static generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Main entry point for error detection
   * Analyzes V2Fragment files only (not entire sandbox)
   */
  static async analyzeV2Fragment(fragmentFiles: {
    [path: string]: string;
  }): Promise<ProjectErrors> {
    console.log(
      `[ErrorDetector] Starting V2Fragment analysis for ${
        Object.keys(fragmentFiles).length
      } files...`
    );

    const startTime = Date.now();
    const errors: ProjectErrors = {
      buildErrors: [],
      runtimeErrors: [],
      importErrors: [],
      navigationErrors: [],
      severity: "low",
      autoFixable: true,
      totalErrors: 0,
      detectedAt: new Date(),
    };

    try {
      // Run all error detection methods in parallel for efficiency
      const [buildErrors, importErrors, navigationErrors] = await Promise.all([
        this.detectBuildErrorsFromFiles(fragmentFiles),
        this.detectImportErrorsFromFiles(fragmentFiles),
        this.detectNavigationErrorsFromFiles(fragmentFiles),
      ]);

      errors.buildErrors = buildErrors;
      errors.importErrors = importErrors;
      errors.navigationErrors = navigationErrors;

      // Runtime errors are detected differently (from iframe console)
      // This would be called from the frontend monitoring hook

      // Calculate overall severity and auto-fixability
      errors.totalErrors =
        buildErrors.length + importErrors.length + navigationErrors.length;

      errors.severity = this.calculateOverallSeverity(errors);
      errors.autoFixable = this.calculateAutoFixability(errors);

      const duration = Date.now() - startTime;
      console.log(
        `[ErrorDetector] V2Fragment analysis complete: ${errors.totalErrors} errors found in ${duration}ms`
      );

      return errors;
    } catch (error) {
      console.error("[ErrorDetector] Error during V2Fragment analysis:", error);

      // Return minimal error structure on failure
      return {
        buildErrors: [],
        runtimeErrors: [],
        importErrors: [],
        navigationErrors: [],
        severity: "low",
        autoFixable: false,
        totalErrors: 0,
        detectedAt: new Date(),
      };
    }
  }

  /**
   * Hybrid error detection: Fragment analysis + Project build analysis
   * This combines quick fragment analysis with full project build checking
   */
  static async analyzeProjectWithFragment(
    fragmentFiles: { [path: string]: string },
    sandbox: Sandbox
  ): Promise<ProjectErrors> {
    console.log(
      `[ErrorDetector] Starting hybrid analysis: fragment + project build`
    );

    const startTime = Date.now();
    const errors: ProjectErrors = {
      buildErrors: [],
      runtimeErrors: [],
      importErrors: [],
      navigationErrors: [],
      severity: "low",
      autoFixable: true,
      totalErrors: 0,
      detectedAt: new Date(),
    };

    try {
      // Phase 1: Quick fragment analysis (fast, pattern-based)
      console.log("[ErrorDetector] Phase 1: Fragment pattern analysis...");
      const [fragmentBuildErrors, fragmentImportErrors, fragmentNavErrors] =
        await Promise.all([
          this.detectBuildErrorsFromFiles(fragmentFiles),
          this.detectImportErrorsFromFiles(fragmentFiles),
          this.detectNavigationErrorsFromFiles(fragmentFiles),
        ]);

      // Phase 2: Full project build analysis (slower, comprehensive)
      console.log("[ErrorDetector] Phase 2: Project build analysis...");
      const [projectBuildErrors, projectImportErrors, projectNavErrors] =
        await Promise.all([
          this.detectBuildErrorsFromProject(sandbox),
          this.detectImportErrorsFromProject(sandbox),
          this.detectNavigationErrorsFromProject(sandbox),
        ]);

      // Combine results, prioritizing project build errors (more accurate)
      errors.buildErrors = [...projectBuildErrors, ...fragmentBuildErrors];
      errors.importErrors = [...projectImportErrors, ...fragmentImportErrors];
      errors.navigationErrors = [...projectNavErrors, ...fragmentNavErrors];

      // Remove duplicates based on file path and error message
      errors.buildErrors = this.deduplicateErrors(errors.buildErrors);
      errors.importErrors = this.deduplicateErrors(errors.importErrors);
      errors.navigationErrors = this.deduplicateErrors(errors.navigationErrors);

      // Calculate overall metrics
      errors.totalErrors =
        errors.buildErrors.length +
        errors.importErrors.length +
        errors.navigationErrors.length;

      errors.severity = this.calculateOverallSeverity(errors);
      errors.autoFixable = this.calculateAutoFixability(errors);

      const duration = Date.now() - startTime;
      console.log(
        `[ErrorDetector] Hybrid analysis complete: ${errors.totalErrors} errors found in ${duration}ms`
      );

      return errors;
    } catch (error) {
      console.error("[ErrorDetector] Hybrid analysis failed:", error);

      // Fallback to fragment-only analysis if project analysis fails
      console.log("[ErrorDetector] Falling back to fragment-only analysis...");
      return this.analyzeV2Fragment(fragmentFiles);
    }
  }

  /**
   * Detects build/compilation errors from full project build
   */
  private static async detectBuildErrorsFromProject(
    sandbox: Sandbox
  ): Promise<BuildError[]> {
    const errors: BuildError[] = [];

    try {
      console.log(
        "[ErrorDetector] Detecting build errors from project build..."
      );

      // Check for TypeScript compilation errors
      const tscResult = await runCommandOnSandbox(
        sandbox,
        "npx tsc --noEmit --skipLibCheck",
        { timeoutMs: 15000 }
      );

      if (tscResult.stderr || tscResult.exitCode !== 0) {
        const tsErrors = this.parseTypeScriptErrorsFromContent(
          "compiler",
          tscResult.stderr || ""
        );
        errors.push(...tsErrors);
      }

      // Check for ESLint errors
      try {
        const lintResult = await runCommandOnSandbox(
          sandbox,
          "npx eslint src --ext .ts,.tsx,.js,.jsx --format=json",
          { timeoutMs: 30000 }
        );

        const validEslintJson = validateEslintOutput(
          lintResult.exitCode,
          lintResult.stdout
        );

        if (validEslintJson) {
          const eslintErrors = this.parseESLintErrors(validEslintJson);
          errors.push(...eslintErrors);
        } else if (lintResult.stdout) {
          console.log(
            "[ErrorDetector] ESLint returned non-JSON output, skipping..."
          );
        } else if (lintResult.exitCode !== 0 && lintResult.exitCode !== 1) {
          console.log(
            `[ErrorDetector] ESLint command failed with exit code ${lintResult.exitCode}, skipping...`
          );
        }
      } catch (lintError: any) {
        // ESLint might not be configured or timed out, that's okay
        const errorMessage = String(lintError);
        if (errorMessage.includes("timed out")) {
          console.log("[ErrorDetector] ESLint check timed out, skipping...");
        } else if (
          errorMessage.includes("eslint: not found") ||
          errorMessage.includes("npx: not found") ||
          errorMessage.includes("No ESLint configuration") ||
          errorMessage.includes("Cannot find module 'eslint'")
        ) {
          console.log("[ErrorDetector] ESLint not configured, skipping...");
        } else {
          console.log("[ErrorDetector] ESLint check skipped:", lintError);
        }
      }

      console.log(
        `[ErrorDetector] Found ${errors.length} build errors from project build`
      );
      return errors;
    } catch (error) {
      console.error(
        "[ErrorDetector] Project build error detection failed:",
        error
      );
      return [];
    }
  }

  /**
   * Detects import/dependency errors from full project
   */
  private static async detectImportErrorsFromProject(
    sandbox: Sandbox
  ): Promise<ImportError[]> {
    const errors: ImportError[] = [];

    try {
      console.log("[ErrorDetector] Detecting import errors from project...");

      // Get list of all TypeScript/JavaScript files
      const findResult = await runCommandOnSandbox(
        sandbox,
        "find src -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' | head -20",
        { timeoutMs: 5000 }
      );

      if (!findResult.stdout) {
        return errors;
      }

      const files = findResult.stdout.trim().split("\n").filter(Boolean);

      for (const file of files) {
        try {
          const fileContent = await runCommandOnSandbox(
            sandbox,
            `cat "${file}"`,
            { timeoutMs: 3000 }
          );

          if (fileContent.stdout) {
            const importErrors = this.analyzeFileImports(
              file,
              fileContent.stdout
            );
            errors.push(...importErrors);
          }
        } catch (fileError) {
          // Skip files that can't be read
          console.warn(`[ErrorDetector] Could not read ${file}:`, fileError);
        }
      }

      console.log(
        `[ErrorDetector] Found ${errors.length} import errors from project`
      );
      return errors;
    } catch (error) {
      console.error(
        "[ErrorDetector] Project import error detection failed:",
        error
      );
      return [];
    }
  }

  /**
   * Detects navigation/routing errors from full project
   */
  private static async detectNavigationErrorsFromProject(
    sandbox: Sandbox
  ): Promise<NavigationError[]> {
    const errors: NavigationError[] = [];

    try {
      console.log(
        "[ErrorDetector] Detecting navigation errors from project..."
      );

      // Check for broken navigation links in components
      const findResult = await runCommandOnSandbox(
        sandbox,
        "find src -name '*.tsx' -o -name '*.ts' | grep -E '(Header|Nav|Sidebar|Menu)' | head -10",
        { timeoutMs: 5000 }
      );

      if (findResult.stdout) {
        const navFiles = findResult.stdout.trim().split("\n").filter(Boolean);

        for (const file of navFiles) {
          try {
            const fileContent = await runCommandOnSandbox(
              sandbox,
              `cat "${file}"`,
              { timeoutMs: 3000 }
            );

            if (fileContent.stdout) {
              const navErrors = this.analyzeNavigationLinks(
                file,
                fileContent.stdout
              );
              errors.push(...navErrors);
            }
          } catch (fileError) {
            console.warn(
              `[ErrorDetector] Could not analyze navigation file ${file}:`,
              fileError
            );
          }
        }
      }

      console.log(
        `[ErrorDetector] Found ${errors.length} navigation errors from project`
      );
      return errors;
    } catch (error) {
      console.error(
        "[ErrorDetector] Project navigation error detection failed:",
        error
      );
      return [];
    }
  }

  /**
   * Remove duplicate errors based on file path and error message
   */
  private static deduplicateErrors<T>(errors: T[]): T[] {
    const seen = new Set<string>();
    return errors.filter((error) => {
      const key = `${(error as any).file || "unknown"}:${
        (error as any).message
      }`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Detects build/compilation errors from V2Fragment files
   */
  private static async detectBuildErrorsFromFiles(fragmentFiles: {
    [path: string]: string;
  }): Promise<BuildError[]> {
    const errors: BuildError[] = [];

    try {
      console.log(
        "[ErrorDetector] Detecting build errors from V2Fragment files..."
      );

      // Filter to only TypeScript/JavaScript files
      const codeFiles = Object.entries(fragmentFiles).filter(([path]) =>
        /\.(ts|tsx|js|jsx)$/.test(path)
      );

      console.log(
        `[ErrorDetector] Analyzing ${codeFiles.length} code files for build errors`
      );

      for (const [filePath, content] of codeFiles) {
        // Check for TypeScript compilation errors in file content
        const tsErrors = this.parseTypeScriptErrorsFromContent(
          filePath,
          content
        );
        errors.push(...tsErrors);

        // Check for ESLint-style errors in file content
        const eslintErrors = this.parseESLintErrorsFromContent(
          filePath,
          content
        );
        errors.push(...eslintErrors);
      }

      console.log(
        `[ErrorDetector] Found ${errors.length} build errors in V2Fragment files`
      );
      return errors;
    } catch (error) {
      console.error(
        "[ErrorDetector] Build error detection from files failed:",
        error
      );
      return [];
    }
  }

  /**
   * Detects import/dependency errors from V2Fragment files
   */
  private static async detectImportErrorsFromFiles(fragmentFiles: {
    [path: string]: string;
  }): Promise<ImportError[]> {
    const errors: ImportError[] = [];

    try {
      console.log(
        "[ErrorDetector] Detecting import errors from V2Fragment files..."
      );

      // Filter to only TypeScript/JavaScript files
      const codeFiles = Object.entries(fragmentFiles).filter(([path]) =>
        /\.(ts|tsx|js|jsx)$/.test(path)
      );

      console.log(
        `[ErrorDetector] Analyzing ${codeFiles.length} code files for import errors`
      );

      for (const [filePath, content] of codeFiles) {
        const importErrors = this.analyzeFileImports(filePath, content);
        errors.push(...importErrors);
      }

      console.log(
        `[ErrorDetector] Found ${errors.length} import errors in V2Fragment files`
      );
      return errors;
    } catch (error) {
      console.error(
        "[ErrorDetector] Import error detection from files failed:",
        error
      );
      return [];
    }
  }

  /**
   * Detects navigation/routing errors from V2Fragment files
   */
  private static async detectNavigationErrorsFromFiles(fragmentFiles: {
    [path: string]: string;
  }): Promise<NavigationError[]> {
    const errors: NavigationError[] = [];

    try {
      console.log(
        "[ErrorDetector] Detecting navigation errors from V2Fragment files..."
      );

      // Filter to only TypeScript/JavaScript files (especially components)
      const codeFiles = Object.entries(fragmentFiles).filter(([path]) =>
        /\.(ts|tsx|js|jsx)$/.test(path)
      );

      console.log(
        `[ErrorDetector] Analyzing ${codeFiles.length} code files for navigation errors`
      );

      for (const [filePath, content] of codeFiles) {
        const navErrors = this.analyzeNavigationLinks(filePath, content);
        errors.push(...navErrors);
      }

      console.log(
        `[ErrorDetector] Found ${errors.length} navigation errors in V2Fragment files`
      );
      return errors;
    } catch (error) {
      console.error(
        "[ErrorDetector] Navigation error detection from files failed:",
        error
      );
      return [];
    }
  }

  /**
   * Parse TypeScript compilation errors from file content
   */
  private static parseTypeScriptErrorsFromContent(
    filePath: string,
    content: string
  ): BuildError[] {
    const errors: BuildError[] = [];

    // Check for common TypeScript errors in file content
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Skip Fast Refresh warnings entirely - these are not errors
      if (
        line.includes(
          "Fast refresh only works when a file only exports components"
        )
      ) {
        continue;
      }

      // Check for common TypeScript error patterns
      if (this.hasTypeScriptErrorPattern(line)) {
        errors.push({
          id: this.generateErrorId(),
          type: ErrorType.TYPE_SCRIPT,
          message: `Potential TypeScript error: ${line.trim()}`,
          file: filePath,
          line: lineNumber,
          column: 1,
          severity: ErrorSeverity.LOW, // Pattern-based detection = LOW severity
          autoFixable: true,
          details: {
            errorCode: "TS_CONTENT_ANALYSIS",
            originalLine: line.trim(),
            analysisType: "content_pattern",
          },
        });
      }
    }

    return errors;
  }

  /**
   * Parse ESLint-style errors from file content
   */
  private static parseESLintErrorsFromContent(
    filePath: string,
    content: string
  ): BuildError[] {
    const errors: BuildError[] = [];

    // Check for common ESLint violations in file content
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Skip Fast Refresh warnings entirely - these are not ESLint violations
      if (
        line.includes(
          "Fast refresh only works when a file only exports components"
        )
      ) {
        continue;
      }

      // Check for common ESLint violations
      if (this.hasESLintViolationPattern(line)) {
        errors.push({
          id: this.generateErrorId(),
          type: ErrorType.ESLINT,
          message: `Potential ESLint violation: ${line.trim()}`,
          file: filePath,
          line: lineNumber,
          column: 1,
          severity: ErrorSeverity.LOW, // Pattern-based detection = LOW severity
          autoFixable: true,
          details: {
            ruleId: "content_analysis",
            originalLine: line.trim(),
            analysisType: "content_pattern",
          },
        });
      }
    }

    return errors;
  }

  /**
   * Check if line has TypeScript error patterns
   */
  private static hasTypeScriptErrorPattern(line: string): boolean {
    // Only flag truly problematic TypeScript patterns
    const patterns = [
      /@ts-ignore/, // TypeScript ignore comments (usually indicate type issues)
      /as\s+any/, // Type assertions to any (can hide type issues)
    ];

    // Additional context-aware checks
    const trimmedLine = line.trim();

    // Don't flag patterns in comments
    if (
      trimmedLine.startsWith("//") ||
      trimmedLine.startsWith("*") ||
      trimmedLine.startsWith("/*")
    ) {
      return false;
    }

    // Don't flag console.log as a TypeScript error (it's a linting issue, not a TS error)
    // Don't flag var as a TypeScript error (it's a linting issue, not a TS error)
    // Don't flag 'any' type usage as it's sometimes necessary

    return patterns.some((pattern) => pattern.test(line));
  }

  /**
   * Check if line has ESLint violation patterns
   */
  private static hasESLintViolationPattern(line: string): boolean {
    // Only flag truly problematic patterns, not common legitimate code
    const patterns = [
      /var\s+\w+/, // Use of 'var' (but allow in specific contexts)
      /==\s*[^=]/, // Use of == instead of === (but allow in specific contexts)
      /!=\s*[^=]/, // Use of != instead of !== (but allow in specific contexts)
      /\s+$/, // Trailing whitespace
    ];

    // Additional context-aware checks
    const trimmedLine = line.trim();

    // Don't flag var in comments or strings
    if (
      trimmedLine.startsWith("//") ||
      trimmedLine.startsWith("*") ||
      trimmedLine.startsWith("/*")
    ) {
      return false;
    }

    // Don't flag == or != in comments or strings
    if (trimmedLine.includes("//") || trimmedLine.includes("/*")) {
      return false;
    }

    // Don't flag console.log in development/debugging contexts
    if (
      trimmedLine.includes("console.log") &&
      (trimmedLine.includes("debug") ||
        trimmedLine.includes("development") ||
        trimmedLine.includes("TODO"))
    ) {
      return false;
    }

    return patterns.some((pattern) => pattern.test(line));
  }

  /**
   * Parse ESLint errors from JSON output (legacy method - kept for compatibility)
   */
  private static parseESLintErrors(jsonOutput: string): BuildError[] {
    const errors: BuildError[] = [];

    try {
      const eslintResults = JSON.parse(jsonOutput);

      for (const result of eslintResults) {
        for (const message of result.messages) {
          // Skip Fast Refresh warnings - these are not ESLint errors
          if (
            message.message.includes(
              "Fast refresh only works when a file only exports components"
            )
          ) {
            continue;
          }

          if (message.severity === 2) {
            // Error level
            errors.push({
              id: this.generateErrorId(),
              type: ErrorType.ESLINT,
              message: message.message,
              file: result.filePath,
              line: message.line,
              column: message.column,
              severity: this.determineSeverityFromESLintRule(message.ruleId),
              autoFixable: message.fix !== undefined,
              details: {
                ruleId: message.ruleId,
                severity: message.severity,
                fix: message.fix,
              },
            });
          }
        }
      }
    } catch (parseError) {
      console.warn(
        "[ErrorDetector] Could not parse ESLint JSON output:",
        parseError
      );
    }

    return errors;
  }

  /**
   * Analyze file imports for missing dependencies
   */
  private static analyzeFileImports(
    filePath: string,
    content: string
  ): ImportError[] {
    const errors: ImportError[] = [];

    // Match import statements
    const importRegex = /import\s+(?:.*?\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];

      // Check for common problematic import patterns
      if (this.isProblematicImport(importPath)) {
        errors.push({
          id: this.generateErrorId(),
          type: ErrorType.IMPORT,
          message: `Potentially missing import: ${importPath}`,
          file: filePath,
          importPath,
          severity: ErrorSeverity.LOW, // Pattern-based detection = LOW severity
          autoFixable: true,
          details: {
            importStatement: match[0],
            line: content.substring(0, match.index).split("\n").length,
          },
        });
      }
    }

    // Check for missing exports that are commonly imported
    const missingExportErrors = this.detectMissingExports(filePath, content);
    errors.push(...missingExportErrors);

    return errors;
  }

  /**
   * Detect missing exports that are commonly imported
   */
  private static detectMissingExports(
    filePath: string,
    content: string
  ): ImportError[] {
    const errors: ImportError[] = [];

    // Check for default export patterns first
    const hasDefaultExport = /export\s+default\s+/.test(content);

    // If file has a default export, no need to check for missing named exports
    // for main components like App, Main, etc. as they can use default export
    if (hasDefaultExport) {
      return errors;
    }

    // Check for common patterns where exports are missing
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Check for function/component declarations that should be exported
      const functionMatch = line.match(
        /^(export\s+)?(function|const|let|var)\s+([A-Z][a-zA-Z0-9]*)/
      );
      if (functionMatch) {
        const isExported = functionMatch[1]?.includes("export");
        const componentName = functionMatch[3];

        // If it's a React component (starts with capital letter) and not exported
        if (componentName && !isExported && /^[A-Z]/.test(componentName)) {
          // Check if this looks like a main component (App, Main, etc.)
          if (["App", "Main", "Home", "Index"].includes(componentName)) {
            errors.push({
              id: this.generateErrorId(),
              type: ErrorType.IMPORT,
              message: `Missing export for ${componentName} component`,
              file: filePath,
              importPath: componentName,
              severity: ErrorSeverity.HIGH,
              autoFixable: true,
              details: {
                componentName,
                line: lineNumber,
                suggestion: `Add 'export default ${componentName}' or 'export { ${componentName} }'`,
                originalLine: line.trim(),
              },
            });
          }
        }
      }
    }

    // Special case: Check if this is App.tsx and has no default export
    if (filePath.includes("App.tsx") || filePath.includes("App.jsx")) {
      const hasAppComponent =
        content.includes("function App") || content.includes("const App");

      if (hasAppComponent && !hasDefaultExport) {
        errors.push({
          id: this.generateErrorId(),
          type: ErrorType.IMPORT,
          message: "Missing export default for App component",
          file: filePath,
          importPath: "App",
          severity: ErrorSeverity.CRITICAL,
          autoFixable: true,
          details: {
            componentName: "App",
            suggestion: "Add export default App at the end of the file",
            issue:
              "App component is not exported, causing import errors in main.tsx",
          },
        });
      }
    }

    return errors;
  }

  /**
   * Analyze navigation links for broken routes
   */
  private static analyzeNavigationLinks(
    filePath: string,
    content: string
  ): NavigationError[] {
    const errors: NavigationError[] = [];

    // Match common navigation patterns
    const linkRegex = /href=['"]([^'"]+)['"]|to=['"]([^'"]+)['"]/g;
    let match;

    while ((match = linkRegex.exec(content)) !== null) {
      const route = match[1] || match[2];

      // Check for potentially broken routes
      if (this.isProblematicRoute(route)) {
        errors.push({
          id: this.generateErrorId(),
          type: ErrorType.NAVIGATION,
          message: `Potentially broken route: ${route}`,
          route,
          file: filePath,
          severity: ErrorSeverity.LOW, // Pattern-based detection = LOW severity
          autoFixable: true,
          details: {
            linkAttribute: match[1] ? "href" : "to",
            line: content.substring(0, match.index).split("\n").length,
          },
        });
      }
    }

    return errors;
  }

  /**
   * Helper methods for error classification
   */
  private static isProblematicImport(importPath: string): boolean {
    // Check for imports that commonly cause issues
    const problematicPatterns = [
      /^@\/lib\/store$/, // Missing store file
      /^@\/lib\/types$/, // Missing types file
      /^framer-motion$/, // Forbidden dependency
      /^react-spring$/, // Forbidden dependency
      // Only flag UI components that are likely missing (not all UI components)
      /^@\/components\/ui\/[a-z-]+$/, // Missing specific UI components (but not all)
    ];

    // Additional checks for truly problematic imports
    const definitelyProblematic = [
      /^@\/lib\/store$/, // Store file that doesn't exist
      /^@\/lib\/types$/, // Types file that doesn't exist
      /^framer-motion$/, // Forbidden animation library
      /^react-spring$/, // Forbidden animation library
    ];

    // Only flag as problematic if it matches definitely problematic patterns
    // or if it's a UI component import that's likely to be missing
    return (
      definitelyProblematic.some((pattern) => pattern.test(importPath)) ||
      (importPath.startsWith("@/components/ui/") &&
        !importPath.includes("button") &&
        !importPath.includes("dialog") &&
        !importPath.includes("input") &&
        !importPath.includes("card") &&
        !importPath.includes("badge") &&
        !importPath.includes("alert") &&
        !importPath.includes("form") &&
        !importPath.includes("table") &&
        !importPath.includes("select") &&
        !importPath.includes("textarea") &&
        !importPath.includes("checkbox") &&
        !importPath.includes("radio") &&
        !importPath.includes("switch") &&
        !importPath.includes("slider") &&
        !importPath.includes("tabs") &&
        !importPath.includes("accordion") &&
        !importPath.includes("carousel") &&
        !importPath.includes("calendar") &&
        !importPath.includes("command") &&
        !importPath.includes("popover") &&
        !importPath.includes("tooltip") &&
        !importPath.includes("dropdown") &&
        !importPath.includes("navigation") &&
        !importPath.includes("sidebar") &&
        !importPath.includes("toggle") &&
        !importPath.includes("separator") &&
        !importPath.includes("scroll-area") &&
        !importPath.includes("sheet") &&
        !importPath.includes("skeleton") &&
        !importPath.includes("avatar") &&
        !importPath.includes("progress") &&
        !importPath.includes("spinner") &&
        !importPath.includes("toast") &&
        !importPath.includes("sonner"))
    );
  }

  private static isProblematicRoute(route: string): boolean {
    // Check for routes that might be missing pages
    return route.startsWith("/") && !route.includes("#") && route !== "/";
  }

  private static determineSeverityFromTypeScriptError(
    errorCode: string
  ): ErrorSeverity {
    const criticalErrors = ["TS2307", "TS2339", "TS2345"]; // Module not found, property doesn't exist, type errors
    const highErrors = ["TS2304", "TS2322"]; // Cannot find name, type assignment errors

    if (criticalErrors.includes(errorCode)) return ErrorSeverity.CRITICAL;
    if (highErrors.includes(errorCode)) return ErrorSeverity.HIGH;
    return ErrorSeverity.MEDIUM;
  }

  private static determineSeverityFromESLintRule(
    ruleId: string | undefined
  ): ErrorSeverity {
    if (!ruleId) return ErrorSeverity.LOW;

    const criticalRules = [
      "no-undef",
      "no-unused-vars",
      "react-hooks/exhaustive-deps",
    ];
    const highRules = [
      "prefer-const",
      "no-var",
      "@typescript-eslint/no-explicit-any",
    ];

    if (criticalRules.some((rule) => ruleId.includes(rule)))
      return ErrorSeverity.CRITICAL;
    if (highRules.some((rule) => ruleId.includes(rule)))
      return ErrorSeverity.HIGH;
    return ErrorSeverity.MEDIUM;
  }

  private static isTypeScriptErrorAutoFixable(errorCode: string): boolean {
    const autoFixableErrors = [
      "TS2304", // Cannot find name (can add imports)
      "TS2307", // Module not found (can create missing files)
      "TS2339", // Property doesn't exist (can fix property names)
    ];

    return autoFixableErrors.includes(errorCode);
  }

  private static calculateOverallSeverity(
    errors: ProjectErrors
  ): "low" | "medium" | "high" | "critical" {
    const allErrors = [
      ...errors.buildErrors,
      ...errors.importErrors,
      ...errors.navigationErrors,
    ];

    if (allErrors.some((e) => e.severity === ErrorSeverity.CRITICAL))
      return "critical";
    if (allErrors.some((e) => e.severity === ErrorSeverity.HIGH)) return "high";
    if (allErrors.some((e) => e.severity === ErrorSeverity.MEDIUM))
      return "medium";
    return "low";
  }

  private static calculateAutoFixability(errors: ProjectErrors): boolean {
    const allErrors = [
      ...errors.buildErrors,
      ...errors.importErrors,
      ...errors.navigationErrors,
    ];

    // If any error is auto-fixable, the overall project is considered auto-fixable
    return allErrors.some((e) => e.autoFixable);
  }
}
