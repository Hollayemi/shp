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
    console.log(`\n[VoltAgent] ============================================`);
    console.log(`[VoltAgent] Fixing error ${errorContext.id}`);
    console.log(`[VoltAgent]   Type: ${errorContext.type}`);
    console.log(`[VoltAgent]   Severity: ${errorContext.severity}`);
    console.log(`[VoltAgent]   Details:`, errorContext.details);

    try {
      // Import the specific agents we need
      const {
        createErrorClassifierAgent,
        createRepairAgent,
        createValidatorAgent,
      } = await import("./voltagent-agents.js");

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
            sandbox,
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

      // Step 4: Validate the fixes (REAL validation, not just LLM opinion)
      console.log(`[VoltAgent] Validating fix...`);
      console.log(`[VoltAgent]   Changes: ${changes.length} changes made`);
      console.log(`[VoltAgent]   Fixed files: ${Object.keys(fixedFiles).length} files`);
      
      // STEP 4: Verify changes were actually applied (diff check)
      const fixedFile = Object.keys(fixedFiles)[0];
      const fixedContent = fixedFiles[fixedFile];
      const originalContent = await this.getFileContent(fixedFile, fragmentFiles, sandbox);
      
      if (originalContent) {
        const changesApplied = this.verifyChangesApplied(
          originalContent,
          fixedContent,
          errorContext
        );
        
        if (!changesApplied.hasChanges) {
          console.log(`[VoltAgent]   ❌ Validation FAILED: No meaningful changes detected`);
          console.log(`[VoltAgent]   Reason: ${changesApplied.reason}`);
          return {
            success: false,
            reason: `LLM did not make meaningful changes. ${changesApplied.reason}`,
          };
        }
        
        console.log(`[VoltAgent]   ✅ Diff check passed: ${changesApplied.description}`);
      }
      
      // STEP 5: LLM-based validation (for all error types)
      // Ask AI if the fix logically resolves the error
      console.log(`[VoltAgent]   Running LLM validation...`);
      
      const validatorAgent = createValidatorAgent();
      const validationPrompt = `Review this fix for the error:

Original Error: ${JSON.stringify(errorContext.details, null, 2)}
Strategy: ${strategy}
Changes Made: ${changes.join(", ")}

Does this fix logically resolve the root cause? Respond with 'VALID' or 'INVALID' followed by reasoning.`;

      const validationResult = await validatorAgent.generateText(
        validationPrompt
      );
      const isValid = validationResult.text.toLowerCase().includes("valid") && 
                      !validationResult.text.toLowerCase().includes("invalid");

      console.log(`[VoltAgent]   LLM validation result: ${validationResult.text.substring(0, 200)}`);
      console.log(`[VoltAgent]   Is valid: ${isValid}`);

      if (!isValid) {
        console.log(
          `[VoltAgent]   ❌ LLM validation failed: ${validationResult.text}`
        );
        return {
          success: false,
          reason: `Fix validation failed: ${validationResult.text}`,
        };
      }
      
      console.log(`[VoltAgent]   ✅ LLM validation passed`);

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
        const { readFileFromSandbox } = await import("./sandbox-compat.js");

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
   * Verify that meaningful changes were actually applied for IMPORT errors only
   * For other error types, we skip validation to avoid interfering with their fix logic
   */
  private verifyChangesApplied(
    originalContent: string,
    fixedContent: string,
    errorContext: any
  ): { hasChanges: boolean; reason: string; description: string } {
    // ONLY validate import errors - skip other error types
    const errorTypeStr = errorContext.type?.toString().toUpperCase();
    if (errorTypeStr !== 'IMPORT') {
      console.log(`[VoltAgent]   Skipping change verification for non-import error (type: ${errorTypeStr})`);
      return {
        hasChanges: true,  // Assume changes are valid for non-import errors
        reason: '',
        description: 'Validation skipped (not an import error)'
      };
    }

    console.log(`[VoltAgent]   Validating import error fix...`);

    // 1. Check if content is identical
    if (originalContent === fixedContent) {
      return {
        hasChanges: false,
        reason: 'Content is identical to original',
        description: ''
      };
    }

    // 2. Normalize whitespace and check again (ignore formatting-only changes)
    const normalizeWhitespace = (str: string) => str.replace(/\s+/g, ' ').trim();
    const originalNormalized = normalizeWhitespace(originalContent);
    const fixedNormalized = normalizeWhitespace(fixedContent);
    
    if (originalNormalized === fixedNormalized) {
      return {
        hasChanges: false,
        reason: 'Only whitespace/formatting changes detected',
        description: ''
      };
    }

    // 3. Verify the specific import was changed
    const originalImport = errorContext.details?.importPath;
    
    if (originalImport) {
      // Check if the problematic import still exists unchanged
      const importRegex = new RegExp(`from\\s+['"]${originalImport.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`, 'g');
      const stillHasOldImport = importRegex.test(fixedContent);
      
      if (stillHasOldImport) {
        return {
          hasChanges: false,
          reason: `Problematic import '${originalImport}' was not changed`,
          description: ''
        };
      }
    }

    // 4. Calculate diff stats
    const originalLines = originalContent.split('\n');
    const fixedLines = fixedContent.split('\n');
    const linesChanged = Math.abs(originalLines.length - fixedLines.length);
    
    let changedLineCount = 0;
    const maxLines = Math.max(originalLines.length, fixedLines.length);
    for (let i = 0; i < maxLines; i++) {
      if (originalLines[i] !== fixedLines[i]) {
        changedLineCount++;
      }
    }

    return {
      hasChanges: true,
      reason: '',
      description: `${changedLineCount} lines modified, ${linesChanged} lines added/removed`
    };
  }

  /**
   * Determine fix strategy based on error classification
   */
  private determineFixStrategy(
    classification: string,
    errorContext: any
  ): string {
    const lowerClassification = classification.toLowerCase();

    // Check error type first (most reliable)
    // Handle both ErrorType enum and string values
    const errorTypeStr = errorContext.type?.toString().toUpperCase();
    
    if (errorTypeStr === "NAVIGATION") {
      return "navigation_fix";
    }
    if (errorTypeStr === "IMPORT") {
      return "import_fix";
    }

    // Then check classification text
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
      lowerClassification.includes("api misuse") // ← Add this
    ) {
      return "navigation_fix";
    }

    // Default to syntax fix for most common issues
    return "syntax_fix";
  }

  /**
   * Fix import-related errors using LLM
   */
  private async fixImportError(
    errorContext: any,
    fragmentFiles: { [path: string]: string },
    fixedFiles: { [path: string]: string },
    changes: string[],
    sandbox?: any
  ): Promise<void> {
    const errorFile = errorContext.details?.file || Object.keys(fragmentFiles)[0];
    const importPath = errorContext.details?.importPath;
    const reason = errorContext.details?.reason;
    const suggestion = errorContext.details?.suggestion;
    
    console.log(`[AutoFix] Fixing import error with LLM: ${reason || 'unknown'}`);
    console.log(`[AutoFix]   File: ${errorFile}`);
    console.log(`[AutoFix]   Import: ${importPath}`);
    console.log(`[AutoFix]   Suggestion: ${suggestion || 'none'}`);

    // Always use LLM for import fixes (no deterministic assumptions)
    await this.fixImportErrorWithLLM(errorContext, fragmentFiles, fixedFiles, changes, sandbox);
  }

  /**
   * Fallback LLM-based import error fixing (original implementation)
   */
  private async fixImportErrorWithLLM(
    errorContext: any,
    fragmentFiles: { [path: string]: string },
    fixedFiles: { [path: string]: string },
    changes: string[],
    sandbox?: any
  ): Promise<void> {
    const { createRepairAgent } = await import("./voltagent-agents.js");
    const repairAgent = createRepairAgent();

    const errorFile = errorContext.details?.file || Object.keys(fragmentFiles)[0];
    const fileContent = await this.getFileContent(errorFile, fragmentFiles, sandbox);

    if (!fileContent) {
      throw new Error(`File not found: ${errorFile}. Tried fragments and sandbox.`);
    }

    console.log(`[AutoFix]   Using LLM to fix import in: ${errorFile}`);

    // Build context-aware prompt with enhanced detection data
    const importPath = errorContext.details?.importPath;
    const reason = errorContext.details?.reason;
    const suggestion = errorContext.details?.suggestion;
    const candidates = errorContext.details?.candidates;
    
    // Build smart context (keep it concise for cost)
    let contextHints = '';
    
    if (reason === 'unresolved' && suggestion) {
      contextHints += `\nSuggested fix: ${suggestion}`;
    }
    
    if (candidates && candidates.length > 0 && candidates.length <= 5) {
      // Only show candidates if there aren't too many (cost control)
      contextHints += `\nAttempted paths (not found): ${candidates.slice(0, 5).join(', ')}`;
    }
    
    if (importPath?.startsWith('@/')) {
      contextHints += `\nNote: This project uses '@/' alias for 'src/' directory`;
    }

    const repairPrompt = `Fix this import error:

Import: ${importPath || 'unknown'}
Error: ${reason || errorContext.details?.message || 'unresolved'}${contextHints}

File: ${errorFile}
\`\`\`
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
    changes.push(`Fixed import error in ${errorFile} (LLM)`);
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
    const { createRepairAgent } = await import("./voltagent-agents.js");
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
    const { createRepairAgent } = await import("./voltagent-agents.js");
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
    const { createRepairAgent } = await import("./voltagent-agents.js");
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
