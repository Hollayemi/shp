/**
 * @deprecated This file is deprecated and should not be used in new code.
 *
 * The VoltAgentService functionality has been migrated to the API server (apps/api).
 * Use the daytonaAPI client instead:
 *
 * @example
 * import { daytonaAPI } from "@/lib/api/daytona-client";
 *
 * // Auto-fix errors using VoltAgent (handled by API server)
 * const fixResult = await daytonaAPI.autoFixErrors(projectId, fragmentId);
 *
 * This file will be removed in a future update. The API server handles:
 * - Error classification using VoltAgent AI
 * - Intelligent error fixing with multiple strategies
 * - Fragment creation with fixes applied
 *
 * See apps/api/src/services/voltagent-service.ts for the current implementation.
 */

import { Agent } from "@voltagent/core";
import { openrouter } from "@openrouter/ai-sdk-provider";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

export class VoltAgentService {
  public errorFixAgent: Agent;

  constructor() {
    this.errorFixAgent = new Agent({
      name: "ErrorFixAgent",
      instructions:
        "You are an expert software engineer specializing in debugging and repairs. You analyze error logs and provide intelligent fix suggestions.",
      model: openrouter("anthropic/claude-sonnet-4", {
        extraBody: {
          max_tokens: 4000,
        },
      }),
    });
  }

  async startErrorMonitoring() {
    console.log("🔍 VoltAgent Error Monitoring started");

    const errorLogPath = join(process.cwd(), "errors.txt");

    if (!existsSync(errorLogPath)) {
      console.log("⚠️ No errors.txt file found. Creating empty file...");
      return;
    }

    try {
      const errors = await this.parseErrorLog();
      if (errors.length > 0) {
        console.log(`📊 Found ${errors.length} errors to analyze`);
        await this.processErrors(errors);
      } else {
        console.log("✅ No errors found");
      }
    } catch (error) {
      console.error("❌ Error in VoltAgent monitoring:", error);
    }
  }

  private async parseErrorLog() {
    const errorLogPath = join(process.cwd(), "errors.txt");
    const content = readFileSync(errorLogPath, "utf-8");

    const errors = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.includes("[IMPORT]") || line.includes("[ESLINT]")) {
        const error = {
          type: line.includes("[IMPORT]") ? "IMPORT" : "ESLINT",
          severity: this.extractSeverity(line),
          message: this.extractMessage(lines, i),
          file: this.extractFile(lines, i),
          line: this.extractLine(lines, i),
          autoFixable: line.includes("✅"),
        };
        errors.push(error);
      }
    }

    return errors;
  }

  private extractSeverity(line: string): string {
    if (line.includes("CRITICAL")) return "CRITICAL";
    if (line.includes("MEDIUM")) return "MEDIUM";
    if (line.includes("LOW")) return "LOW";
    return "UNKNOWN";
  }

  private extractMessage(lines: string[], startIndex: number): string {
    for (let i = startIndex + 1; i < startIndex + 10 && i < lines.length; i++) {
      if (lines[i].includes("Message:")) {
        return lines[i].replace("Message:", "").trim();
      }
    }
    return "No message found";
  }

  private extractFile(lines: string[], startIndex: number): string {
    for (let i = startIndex + 1; i < startIndex + 10 && i < lines.length; i++) {
      if (lines[i].includes("File:")) {
        return lines[i].replace("File:", "").trim();
      }
    }
    return "Unknown file";
  }

  private extractLine(lines: string[], startIndex: number): number {
    for (let i = startIndex + 1; i < startIndex + 10 && i < lines.length; i++) {
      if (lines[i].includes("Line:")) {
        const lineMatch = lines[i].match(/Line:\s*(\d+)/);
        return lineMatch ? parseInt(lineMatch[1]) : 0;
      }
    }
    return 0;
  }

  private async processErrors(errors: any[]) {
    console.log("🔧 Processing errors with VoltAgent...");

    for (const error of errors.slice(0, 5)) {
      // Limit to first 5 errors for testing
      if (error.autoFixable) {
        console.log(`🔨 Auto-fixing ${error.type} error in ${error.file}`);
        await this.autoFixError(error);
      } else {
        console.log(
          `⚠️ Manual fix required for ${error.type} error in ${error.file}`
        );
        await this.suggestFix(error);
      }
    }
  }

  private async autoFixError(error: any) {
    try {
      console.log(`   Analyzing: ${error.message}`);
      console.log(`   File: ${error.file}:${error.line}`);

      // Use VoltAgent to generate fix suggestions
      const response = await this.errorFixAgent.generateText(
        `Analyze this ${error.type} error and provide a fix:\n\nError: ${error.message}\nFile: ${error.file}\nLine: ${error.line}`
      );

      console.log(`   ✅ AI Fix Suggestion: ${response.text}`);
    } catch (error) {
      console.error("❌ Auto-fix failed:", error);
    }
  }

  private async suggestFix(error: any) {
    try {
      console.log(`   Analyzing: ${error.message}`);
      console.log(`   File: ${error.file}:${error.line}`);

      // Use VoltAgent to generate fix suggestions
      const response = await this.errorFixAgent.generateText(
        `Analyze this ${error.type} error and provide a fix:\n\nError: ${error.message}\nFile: ${error.file}\nLine: ${error.line}`
      );

      console.log(`   💡 AI Fix Suggestion: ${response.text}`);
    } catch (error) {
      console.error("❌ Fix suggestion failed:", error);
    }
  }

  async runWorkflow() {
    console.log("🚀 Starting VoltAgent Error Fix Workflow");

    const errors = await this.parseErrorLog();

    if (errors.length === 0) {
      console.log("✅ No errors to process");
      return;
    }

    console.log(`📊 Processing ${Math.min(errors.length, 5)} errors...`);

    for (const error of errors.slice(0, 5)) {
      console.log(`\n🔍 Processing ${error.type} error:`);
      console.log(`   File: ${error.file}`);
      console.log(`   Message: ${error.message}`);
      console.log(`   Severity: ${error.severity}`);
      console.log(`   Auto-fixable: ${error.autoFixable ? "Yes" : "No"}`);

      // Generate AI-powered fix suggestion
      try {
        const response = await this.errorFixAgent.generateText(
          `Provide a detailed fix for this ${error.type} error:\n\nError: ${error.message}\nFile: ${error.file}\nLine: ${error.line}\n\nProvide the fix in this format:\n1. Root cause analysis\n2. Suggested fix\n3. Additional notes`
        );
        console.log(`   🤖 AI Analysis: ${response.text}`);
      } catch (aiError) {
        console.log(`   ⚠️ AI analysis failed: ${aiError}`);
      }
    }

    console.log("\n✅ VoltAgent workflow completed");
  }

  /**
   * Fix a specific error using VoltAgent AI agents
   */
  async fixError(
    errorContext: {
      id: string;
      type: string;
      details: any;
      severity: string;
      autoFixable: boolean;
    },
    fragmentFiles: { [path: string]: string },
    sandbox?: any // Optional sandbox for fetching missing files
  ): Promise<{
    success: boolean;
    strategy?: string;
    fixedFiles?: { [path: string]: string };
    changes?: string[];
    reason?: string;
  }> {
    console.log(
      `[VoltAgent] Fixing error ${errorContext.id} of type ${errorContext.type}`
    );

    try {
      // Import the specific agents we need
      const {
        createErrorClassifierAgent,
        createRepairAgent,
        createValidatorAgent,
      } = await import("@/lib/voltagent-agents");

      // Step 1: Classify the error to determine fix strategy
      const classifierAgent = createErrorClassifierAgent();
      const classificationPrompt = `Analyze this error and categorize it:

Error Type: ${errorContext.type}
Error Details: ${JSON.stringify(errorContext.details, null, 2)}
Severity: ${errorContext.severity}

Categorize as one of: Syntax, Missing Import / Undefined Variable, Type Mismatch, API Misuse, Configuration/Environment, or Other.
Provide the category and a brief explanation.`;

      const classificationResult = await classifierAgent.generateText(
        classificationPrompt
      );
      const classification = classificationResult.text;

      console.log(`[VoltAgent] Error classification: ${classification}`);

      // Step 2: Determine fix strategy based on classification
      const strategy = this.determineFixStrategy(classification, errorContext);

      console.log(`[VoltAgent] Fix strategy: ${strategy}`);

      // Step 3: Apply fixes based on strategy
      const fixedFiles: { [path: string]: string } = {};
      const changes: string[] = [];

      switch (strategy) {
        case "import_fix":
          await this.fixImportError(
            errorContext,
            fragmentFiles,
            fixedFiles,
            changes,
            sandbox
          );
          break;
        case "syntax_fix":
          await this.fixSyntaxError(
            errorContext,
            fragmentFiles,
            fixedFiles,
            changes,
            sandbox
          );
          break;
        case "type_fix":
          await this.fixTypeError(
            errorContext,
            fragmentFiles,
            fixedFiles,
            changes,
            sandbox
          );
          break;
        case "navigation_fix":
          await this.fixNavigationError(
            errorContext,
            fragmentFiles,
            fixedFiles,
            changes,
            sandbox
          );
          break;
        default:
          return {
            success: false,
            reason: `Unsupported fix strategy: ${strategy}`,
          };
      }

      // Step 4: Validate the fixes
      const validatorAgent = createValidatorAgent();
      const validationPrompt = `Review this fix for the error:

Original Error: ${JSON.stringify(errorContext.details, null, 2)}
Strategy: ${strategy}
Changes Made: ${changes.join(", ")}

Does this fix logically resolve the root cause? Respond with 'VALID' or 'INVALID' followed by reasoning.`;

      const validationResult = await validatorAgent.generateText(
        validationPrompt
      );
      const isValid = validationResult.text.toLowerCase().includes("valid");

      if (!isValid) {
        console.log(
          `[VoltAgent] Fix validation failed: ${validationResult.text}`
        );
        return {
          success: false,
          reason: `Fix validation failed: ${validationResult.text}`,
        };
      }

      console.log(
        `[VoltAgent] Successfully fixed error ${errorContext.id} with strategy: ${strategy}`
      );

      return {
        success: true,
        strategy,
        fixedFiles,
        changes,
      };
    } catch (error) {
      console.error(`[VoltAgent] Error fixing ${errorContext.id}:`, error);
      return {
        success: false,
        reason:
          error instanceof Error ? error.message : "Unknown error during fix",
      };
    }
  }

  /**
   * Try to get file content from available sources
   */
  private async getFileContent(
    filePath: string,
    fragmentFiles: { [path: string]: string },
    sandbox?: any
  ): Promise<string | null> {
    // First, try to get from fragment files
    if (fragmentFiles[filePath]) {
      return fragmentFiles[filePath];
    }

    // If not found in fragments and we have a sandbox, try to fetch from sandbox
    if (sandbox) {
      try {
        console.log(
          `[VoltAgent] File not in fragments, attempting to fetch from sandbox: ${filePath}`
        );

        // Import the sandbox utilities dynamically to avoid circular imports
        const { readFileFromSandbox } = await import("@/lib/ai/sandbox-compat");

        // Try different possible paths in the sandbox
        const possiblePaths = [
          filePath,
          filePath.startsWith("/") ? filePath.substring(1) : filePath,
          filePath.startsWith("src/") ? filePath : `src/${filePath}`,
          filePath.replace(/^\/home\/daytona\/workspace\//, ""),
        ];

        for (const path of possiblePaths) {
          try {
            const content = await readFileFromSandbox(sandbox, path);
            if (content) {
              console.log(
                `[VoltAgent] Successfully fetched file from sandbox: ${path}`
              );
              return content;
            }
          } catch (err) {
            // Try next path
            continue;
          }
        }
      } catch (error) {
        console.warn(
          `[VoltAgent] Failed to fetch file from sandbox: ${filePath}`,
          error
        );
      }
    }

    return null;
  }

  /**
   * Determine fix strategy based on error classification
   */
  private determineFixStrategy(
    classification: string,
    errorContext: any
  ): string {
    const lowerClassification = classification.toLowerCase();

    if (
      lowerClassification.includes("import") ||
      lowerClassification.includes("undefined variable")
    ) {
      return "import_fix";
    }
    if (lowerClassification.includes("syntax")) {
      return "syntax_fix";
    }
    if (lowerClassification.includes("type")) {
      return "type_fix";
    }
    if (
      lowerClassification.includes("navigation") ||
      errorContext.type === "NAVIGATION"
    ) {
      return "navigation_fix";
    }

    // Default to syntax fix for most common issues
    return "syntax_fix";
  }

  /**
   * Fix import-related errors
   */
  private async fixImportError(
    errorContext: any,
    fragmentFiles: { [path: string]: string },
    fixedFiles: { [path: string]: string },
    changes: string[],
    sandbox?: any
  ): Promise<void> {
    const { createRepairAgent } = await import("@/lib/voltagent-agents");
    const repairAgent = createRepairAgent();

    // Find the file with the import error
    const errorFile =
      errorContext.details?.file || Object.keys(fragmentFiles)[0];
    const fileContent = await this.getFileContent(
      errorFile,
      fragmentFiles,
      sandbox
    );

    if (!fileContent) {
      throw new Error(
        `File not found: ${errorFile}. Tried fragments and sandbox.`
      );
    }

    const repairPrompt = `Fix this import error in the following code:

Error: ${JSON.stringify(errorContext.details, null, 2)}

File Content:
${fileContent}

IMPORTANT: If the error mentions "does not provide an export named 'default'", you need to add a DEFAULT export, not a named export.

For React components, use ONE of these patterns:
- Add "export default App;" at the end of the file
- OR change "function App()" to "export default function App()"

Do NOT use "export function App()" as that creates a named export, not a default export.

Respond ONLY with the corrected code, no explanations, no markdown formatting, no code blocks. Return raw TypeScript/JavaScript code only.`;

    const repairResult = await repairAgent.generateText(repairPrompt);

    // Clean up any markdown formatting that the LLM might have added
    let cleanedCode = repairResult.text.trim();

    // Remove markdown code blocks if present
    if (cleanedCode.startsWith("```")) {
      cleanedCode = cleanedCode
        .replace(/^```[a-z]*\n?/i, "")
        .replace(/\n?```$/, "");
    }

    // Remove any remaining markdown artifacts
    cleanedCode = cleanedCode.trim();

    console.log(`[VoltAgent] Generated fix for file: ${errorFile}`);
    console.log(`[VoltAgent] Fixed content length: ${cleanedCode.length}`);
    console.log(
      `[VoltAgent] Fixed content preview:`,
      cleanedCode.substring(0, 200) + "..."
    );

    fixedFiles[errorFile] = cleanedCode;
    changes.push(`Fixed import error in ${errorFile}`);
  }

  /**
   * Fix syntax-related errors
   */
  private async fixSyntaxError(
    errorContext: any,
    fragmentFiles: { [path: string]: string },
    fixedFiles: { [path: string]: string },
    changes: string[],
    sandbox?: any
  ): Promise<void> {
    const { createRepairAgent } = await import("@/lib/voltagent-agents");
    const repairAgent = createRepairAgent();

    // Find the file with the syntax error
    const errorFile =
      errorContext.details?.file || Object.keys(fragmentFiles)[0];
    const fileContent = await this.getFileContent(
      errorFile,
      fragmentFiles,
      sandbox
    );

    if (!fileContent) {
      throw new Error(
        `File not found: ${errorFile}. Tried fragments and sandbox.`
      );
    }

    const repairPrompt = `Fix this syntax error in the following code:

Error: ${JSON.stringify(errorContext.details, null, 2)}

File Content:
${fileContent}

Fix the syntax issue. Respond ONLY with the corrected code, no explanations, no markdown formatting, no code blocks. Return raw TypeScript/JavaScript code only.`;

    const repairResult = await repairAgent.generateText(repairPrompt);

    // Clean up any markdown formatting that the LLM might have added
    let cleanedCode = repairResult.text.trim();

    // Remove markdown code blocks if present
    if (cleanedCode.startsWith("```")) {
      cleanedCode = cleanedCode
        .replace(/^```[a-z]*\n?/i, "")
        .replace(/\n?```$/, "");
    }

    // Remove any remaining markdown artifacts
    cleanedCode = cleanedCode.trim();

    fixedFiles[errorFile] = cleanedCode;
    changes.push(`Fixed syntax error in ${errorFile}`);
  }

  /**
   * Fix type-related errors
   */
  private async fixTypeError(
    errorContext: any,
    fragmentFiles: { [path: string]: string },
    fixedFiles: { [path: string]: string },
    changes: string[],
    sandbox?: any
  ): Promise<void> {
    const { createRepairAgent } = await import("@/lib/voltagent-agents");
    const repairAgent = createRepairAgent();

    // Find the file with the type error
    const errorFile =
      errorContext.details?.file || Object.keys(fragmentFiles)[0];
    const fileContent = await this.getFileContent(
      errorFile,
      fragmentFiles,
      sandbox
    );

    if (!fileContent) {
      throw new Error(
        `File not found: ${errorFile}. Tried fragments and sandbox.`
      );
    }

    const repairPrompt = `Fix this TypeScript type error in the following code:

Error: ${JSON.stringify(errorContext.details, null, 2)}

File Content:
${fileContent}

Fix the type issue by adding proper types or correcting type mismatches. Respond ONLY with the corrected code, no explanations.`;

    const repairResult = await repairAgent.generateText(repairPrompt);
    fixedFiles[errorFile] = repairResult.text;
    changes.push(`Fixed type error in ${errorFile}`);
  }

  /**
   * Fix navigation-related errors
   */
  private async fixNavigationError(
    errorContext: any,
    fragmentFiles: { [path: string]: string },
    fixedFiles: { [path: string]: string },
    changes: string[],
    sandbox?: any
  ): Promise<void> {
    const { createRepairAgent } = await import("@/lib/voltagent-agents");
    const repairAgent = createRepairAgent();

    // Find files that might contain navigation issues
    const navFiles = Object.keys(fragmentFiles).filter(
      (file) =>
        file.includes("nav") ||
        file.includes("header") ||
        file.includes("menu") ||
        fragmentFiles[file].includes("href=") ||
        fragmentFiles[file].includes("to=")
    );

    const targetFile = navFiles[0] || Object.keys(fragmentFiles)[0];
    const fileContent = await this.getFileContent(
      targetFile,
      fragmentFiles,
      sandbox
    );

    if (!fileContent) {
      throw new Error(
        `File not found: ${targetFile}. Tried fragments and sandbox.`
      );
    }

    const repairPrompt = `Fix this navigation error in the following code:

Error: ${JSON.stringify(errorContext.details, null, 2)}

File Content:
${fileContent}

Fix the broken route or navigation link. Respond ONLY with the corrected code, no explanations.`;

    const repairResult = await repairAgent.generateText(repairPrompt);
    fixedFiles[targetFile] = repairResult.text;
    changes.push(`Fixed navigation error in ${targetFile}`);
  }
}
