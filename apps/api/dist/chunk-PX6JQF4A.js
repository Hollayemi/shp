import { createRequire } from 'module';const require = createRequire(import.meta.url);
import {
  readFileFromSandbox,
  runCommandOnSandbox
} from "./chunk-Q73ELRDT.js";
import {
  executeCommand
} from "./chunk-IDZAZ4YU.js";
import {
  logger,
  logger_default
} from "./chunk-TIBZDRCE.js";
import {
  import_prisma
} from "./chunk-YMWDDMLV.js";
import {
  init_esm_shims
} from "./chunk-IXOW5DJO.js";

// src/services/error-detector.ts
init_esm_shims();
var tsconfigCache = null;
async function readTsconfig(sandbox) {
  if (tsconfigCache && Date.now() - tsconfigCache.timestamp < 3e5) {
    console.log("[Resolver] Using cached tsconfig");
    return tsconfigCache.config || {};
  }
  if (!sandbox) {
    console.log("[Resolver] No sandbox, skipping tsconfig");
    return {};
  }
  try {
    console.log("[Resolver] Reading tsconfig.json from sandbox...");
    const content = await readFileFromSandbox(sandbox, "tsconfig.json");
    const tsconfig = JSON.parse(content);
    const config = tsconfig.compilerOptions || {};
    tsconfigCache = { config, timestamp: Date.now() };
    console.log("[Resolver] Tsconfig loaded and cached:", config.paths ? "has paths" : "no paths");
    return config;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.log("[Resolver] Failed to read tsconfig.json (using defaults):", errorMessage);
    tsconfigCache = { config: {}, timestamp: Date.now() };
    return {};
  }
}
async function resolveImportPath(specifier, fromFile, sandbox, fileTree) {
  const candidates = [];
  console.log(`[Resolver] Resolving '${specifier}' from ${fromFile}`);
  console.log(`[Resolver] FileTree available: ${!!fileTree}, size: ${fileTree?.size || 0}`);
  if (!specifier.startsWith("./") && !specifier.startsWith("../") && !specifier.startsWith("@/")) {
    console.log(`[Resolver]   Bare specifier, skipping file resolution`);
    return { resolved: null, candidates: [] };
  }
  if (sandbox) {
    const tsconfig = await readTsconfig(sandbox);
    if (tsconfig.paths) {
      for (const [pattern, replacements] of Object.entries(tsconfig.paths)) {
        const patternRegex = new RegExp("^" + pattern.replace("*", "(.*)") + "$");
        const match = specifier.match(patternRegex);
        if (match) {
          console.log(`[Resolver]   Tsconfig alias match: ${pattern}`);
          for (const replacement of replacements) {
            const resolvedPath = replacement.replace("*", match[1] || "");
            let fullPath = resolvedPath;
            if (tsconfig.baseUrl) {
              const cleanPath = resolvedPath.replace(/^\.\//, "");
              fullPath = tsconfig.baseUrl === "." ? cleanPath : `${tsconfig.baseUrl}/${cleanPath}`;
            }
            console.log(`[Resolver]   Alias match: ${specifier} \u2192 ${fullPath}.*`);
            console.log(`[Resolver]   (baseUrl: ${tsconfig.baseUrl}, replacement: ${replacement}, resolved: ${resolvedPath})`);
            const extensions = [".ts", ".tsx", ".js", ".jsx"];
            for (const ext of extensions) {
              const candidate = `${fullPath}${ext}`;
              candidates.push(candidate);
              console.log(`[Resolver]   Trying: ${candidate}`);
              if (fileTree) {
                const exists = fileTree.has(candidate);
                console.log(`[Resolver]   Checking in cache: ${candidate} \u2192 ${exists ? "EXISTS" : "NOT FOUND"}`);
                if (exists) {
                  console.log(`[Resolver]   \u2705 Found (cached): ${candidate}`);
                  return { resolved: candidate, candidates };
                }
              } else {
                try {
                  await readFileFromSandbox(sandbox, candidate);
                  console.log(`[Resolver]   \u2705 Found: ${candidate}`);
                  return { resolved: candidate, candidates };
                } catch {
                }
              }
            }
            const indexCandidates = [`${fullPath}/index.ts`, `${fullPath}/index.tsx`];
            for (const candidate of indexCandidates) {
              candidates.push(candidate);
              console.log(`[Resolver]   Trying: ${candidate}`);
              if (fileTree) {
                if (fileTree.has(candidate)) {
                  console.log(`[Resolver]   \u2705 Found (cached): ${candidate}`);
                  return { resolved: candidate, candidates };
                }
              } else {
                try {
                  await readFileFromSandbox(sandbox, candidate);
                  console.log(`[Resolver]   \u2705 Found: ${candidate}`);
                  return { resolved: candidate, candidates };
                } catch {
                }
              }
            }
          }
        }
      }
    }
  }
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    const fromDir = fromFile.substring(0, fromFile.lastIndexOf("/")) || "";
    const parts = fromDir.split("/").filter((p) => p && p !== ".");
    const importParts = specifier.split("/").filter((p) => p && p !== ".");
    let upCount = 0;
    for (const part of importParts) {
      if (part === "..") upCount++;
      else break;
    }
    const resolvedParts = parts.slice(0, parts.length - upCount);
    const remainingImport = importParts.slice(upCount).join("/");
    const basePath = resolvedParts.length > 0 ? resolvedParts.join("/") + "/" + remainingImport : remainingImport;
    const extensions = [".ts", ".tsx", ".js", ".jsx"];
    for (const ext of extensions) {
      const candidate = `${basePath}${ext}`;
      candidates.push(candidate);
      console.log(`[Resolver]   Trying: ${candidate}`);
      if (fileTree) {
        if (fileTree.has(candidate)) {
          console.log(`[Resolver]   Found (cached): ${candidate}`);
          return { resolved: candidate, candidates };
        }
      } else if (sandbox) {
        try {
          await readFileFromSandbox(sandbox, candidate);
          console.log(`[Resolver]   Found: ${candidate}`);
          return { resolved: candidate, candidates };
        } catch {
        }
      }
    }
  }
  console.log(`[Resolver]   \u274C NOT FOUND. Tried: ${candidates.join(", ")}`);
  return { resolved: null, candidates };
}
var ErrorDetector = class {
  static generateErrorId() {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  /**
   * Main entry point for error detection
   * Analyzes V2Fragment files only (not entire sandbox)
   */
  static async analyzeV2Fragment(fragmentFiles, logger2 = logger) {
    logger2.info({
      msg: "Starting V2Fragment analysis",
      fileCount: Object.keys(fragmentFiles).length
    });
    const startTime = Date.now();
    const errors = {
      buildErrors: [],
      runtimeErrors: [],
      importErrors: [],
      navigationErrors: [],
      severity: "low",
      autoFixable: true,
      totalErrors: 0,
      detectedAt: /* @__PURE__ */ new Date()
    };
    try {
      const [buildErrors, importErrors, navigationErrors] = await Promise.all([
        this.detectBuildErrorsFromFiles(fragmentFiles, logger2),
        this.detectImportErrorsFromFiles(fragmentFiles, logger2),
        this.detectNavigationErrorsFromFiles(fragmentFiles, logger2)
      ]);
      errors.buildErrors = buildErrors;
      errors.importErrors = importErrors;
      errors.navigationErrors = navigationErrors;
      errors.totalErrors = buildErrors.length + importErrors.length + navigationErrors.length;
      errors.severity = this.calculateOverallSeverity(errors);
      errors.autoFixable = this.calculateAutoFixability(errors);
      const duration = Date.now() - startTime;
      logger2.info({
        msg: "V2Fragment analysis complete",
        totalErrors: errors.totalErrors,
        durationMs: duration
      });
      return errors;
    } catch (error) {
      logger2.error({
        msg: "Error during V2Fragment analysis",
        error: error instanceof Error ? error.message : String(error)
      });
      return {
        buildErrors: [],
        runtimeErrors: [],
        importErrors: [],
        navigationErrors: [],
        severity: "low",
        autoFixable: false,
        totalErrors: 0,
        detectedAt: /* @__PURE__ */ new Date()
      };
    }
  }
  /**
   * Hybrid error detection: Fragment analysis + Project build analysis
   * This combines quick fragment analysis with full project build checking
   * @param sandbox - Modal sandboxId string
   */
  static async analyzeProjectWithFragmentModal(fragmentFiles, sandbox) {
    console.log(
      `[ErrorDetector] Starting hybrid analysis: fragment + project build`
    );
    console.log(`[ErrorDetector] Sandbox type:`, typeof sandbox);
    console.log(`[ErrorDetector] Sandbox value:`, typeof sandbox === "string" ? sandbox : "Sandbox object");
    const startTime = Date.now();
    const errors = {
      buildErrors: [],
      runtimeErrors: [],
      importErrors: [],
      navigationErrors: [],
      severity: "low",
      autoFixable: true,
      totalErrors: 0,
      detectedAt: /* @__PURE__ */ new Date()
    };
    try {
      console.log("[ErrorDetector] Phase 2: Project build analysis...");
      console.log("[ErrorDetector] Calling detectBuildErrorsFromProject...");
      console.log("[ErrorDetector] Calling detectImportErrorsFromProject...");
      console.log("[ErrorDetector] Calling detectNavigationErrorsFromProject...");
      const [projectBuildErrors, projectImportErrors, projectNavErrors] = await Promise.all([
        this.detectBuildErrorsFromProject(sandbox),
        this.detectImportErrorsFromProject(sandbox),
        this.detectNavigationErrorsFromProject(sandbox)
      ]);
      console.log("[ErrorDetector] Phase 2 complete:");
      console.log(`[ErrorDetector]   Build errors: ${projectBuildErrors.length}`);
      console.log(`[ErrorDetector]   Import errors: ${projectImportErrors.length}`);
      console.log(`[ErrorDetector]   Navigation errors: ${projectNavErrors.length}`);
      errors.buildErrors = projectBuildErrors;
      errors.importErrors = [];
      errors.navigationErrors = [];
      errors.totalErrors = errors.buildErrors.length + errors.importErrors.length + errors.navigationErrors.length;
      errors.severity = this.calculateOverallSeverity(errors);
      errors.autoFixable = this.calculateAutoFixability(errors);
      const duration = Date.now() - startTime;
      logger_default.info({
        msg: "Modal hybrid analysis complete",
        totalErrors: errors.totalErrors,
        durationMs: duration
      });
      return errors;
    } catch (error) {
      logger_default.error({
        msg: "Modal hybrid analysis failed",
        error: error instanceof Error ? error.message : String(error)
      });
      logger_default.info({
        msg: "Falling back to fragment-only analysis"
      });
      return this.analyzeV2Fragment(fragmentFiles, logger_default);
    }
  }
  /**
   * Detects build/compilation errors from full project build
   * @param sandbox - Modal sandboxId string
   */
  static async detectBuildErrorsFromProject(sandbox) {
    const errors = [];
    try {
      logger_default.info({
        msg: "Detecting build errors from Modal project build",
        sandbox
      });
      const tscResult = await executeCommand(
        sandbox,
        "bunx tsc -b --noEmit",
        {
          timeoutMs: 6e4
        }
      );
      logger_default.info({
        msg: "TypeScript compilation result",
        result: tscResult
      });
      if (tscResult.stderr || tscResult.exitCode !== 0) {
        const tsErrors = this.parseTypeScriptCompilerOutput(
          tscResult.stderr || tscResult.stdout || ""
        );
        errors.push(...tsErrors);
      }
      logger_default.info({
        msg: "Found build errors from Modal project build",
        errorCount: errors.length
      });
      return errors;
    } catch (error) {
      logger_default.error({
        msg: "Modal project build error detection failed",
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }
  /**
   * Detects import/dependency errors from full project
   * @param sandbox - Modal sandboxId string
   * 
   * OPTIMIZATION: Uses batched command execution to minimize sandbox round-trips
   * Instead of: find (1 cmd) + cat file1 + cat file2 + ... + cat fileN (N cmds) = N+1 commands
   * We do: ONE bash loop that outputs all files with delimiters = 1 command total!
   * This is critical for Modal sandboxes which have command execution limits.
   * 
   * OPTIMIZATION 2: Also gets full file tree upfront for import resolution caching
   */
  static async detectImportErrorsFromProject(sandbox) {
    const errors = [];
    try {
      console.log("[ErrorDetector] Detecting import errors from project (batched mode)...");
      console.log("[ErrorDetector] Fetching file tree for import resolution cache...");
      const fileTreeCommand = `bash -c 'find src -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \\) 2>/dev/null'`;
      const fileTreeResult = await runCommandOnSandbox(sandbox, fileTreeCommand, { timeoutMs: 1e4 });
      const fileTree = new Set(
        fileTreeResult.stdout ? fileTreeResult.stdout.trim().split("\n").filter(Boolean) : []
      );
      console.log(`[ErrorDetector] Cached ${fileTree.size} files for import resolution (O(1) lookups)`);
      const sampleFiles = Array.from(fileTree).slice(0, 10);
      console.log(`[ErrorDetector] Sample cached files:`, sampleFiles);
      const scanLimit = " | head -100";
      const delimiter = "___FILE_SEPARATOR___";
      const endDelimiter = "___END_FILE___";
      const batchCommand = `bash -c 'for file in $(
        (find src -maxdepth 1 -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \\) ! -name "*.test.*" ! -name "*.spec.*" ! -name "*.stories.*" ! -name "*.d.ts" 2>/dev/null;
         find src/pages -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \\) ! -name "*.test.*" ! -name "*.spec.*" ! -name "*.stories.*" ! -name "*.d.ts" 2>/dev/null;
         find src/components -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \\) ! -name "*.test.*" ! -name "*.spec.*" ! -name "*.stories.*" ! -name "*.d.ts" ! -path "*/components/ui/*" 2>/dev/null;
         find src/api src/routes -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \\) ! -name "*.test.*" ! -name "*.spec.*" ! -name "*.d.ts" 2>/dev/null;
         find src/hooks -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \\) ! -name "*.test.*" ! -name "*.spec.*" ! -name "*.d.ts" 2>/dev/null;
         find src/lib -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \\) ! -name "*.test.*" ! -name "*.spec.*" ! -name "*.d.ts" 2>/dev/null;
         find src/utils -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \\) ! -name "*.test.*" ! -name "*.spec.*" ! -name "*.d.ts" 2>/dev/null;
         find src -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \\) ! -name "*.test.*" ! -name "*.spec.*" ! -name "*.stories.*" ! -name "*.mock.*" ! -name "*.d.ts" ! -path "*/test/*" ! -path "*/tests/*" ! -path "*/__tests__/*" ! -path "*/__mocks__/*" ! -path "*/mocks/*" ! -path "*/components/ui/*" ! -path "*/shadcn/*" 2>/dev/null) | awk '"'"'!seen[$0]++'"'"'${scanLimit}
      ); do echo "${delimiter}"; echo "$file"; cat "$file" 2>/dev/null || echo "ERROR_READING_FILE"; echo "${endDelimiter}"; done'`;
      console.log(`[ErrorDetector] Scan mode: PRIORITY (root\u2192pages\u2192components\u2192api\u2192hooks\u2192lib\u2192utils\u2192rest, 100 max)`);
      console.log(`[ErrorDetector] Executing batched file read command...`);
      const batchResult = await runCommandOnSandbox(
        sandbox,
        batchCommand,
        { timeoutMs: 3e4 }
        // Longer timeout for batch operation
      );
      console.log(`[ErrorDetector] Batch command completed`);
      console.log(`[ErrorDetector]   Exit code: ${batchResult.exitCode}`);
      console.log(`[ErrorDetector]   Stdout length: ${batchResult.stdout?.length || 0}`);
      console.log(`[ErrorDetector]   Stderr length: ${batchResult.stderr?.length || 0}`);
      if (batchResult.stderr) {
        console.error(`[ErrorDetector] Batch command stderr:`, batchResult.stderr.substring(0, 500));
      }
      if (!batchResult.stdout) {
        console.warn(`[ErrorDetector] No stdout from batch command, returning empty errors`);
        if (batchResult.exitCode !== 0) {
          console.error(`[ErrorDetector] Command failed with exit code ${batchResult.exitCode}`);
        }
        return errors;
      }
      const output = batchResult.stdout;
      const fileBlocks = output.split(delimiter).slice(1);
      console.log(`[ErrorDetector] Scanning ${fileBlocks.length} files for import errors`);
      for (const block of fileBlocks) {
        const endFileIndex = block.indexOf(endDelimiter);
        if (endFileIndex === -1) continue;
        const content = block.substring(0, endFileIndex);
        const firstNewline = content.indexOf("\n");
        if (firstNewline === -1) continue;
        const secondNewline = content.indexOf("\n", firstNewline + 1);
        const filePath = content.substring(firstNewline + 1, secondNewline !== -1 ? secondNewline : content.length).trim();
        if (!filePath) continue;
        const fileContent = secondNewline !== -1 ? content.substring(secondNewline + 1) : "";
        if (!fileContent.trim() || fileContent.trim() === "ERROR_READING_FILE") {
          console.warn(`[ErrorDetector] Could not read ${filePath}`);
          continue;
        }
        console.log(`[ErrorDetector]   Analyzing: ${filePath}`);
        try {
          const importErrors = await this.analyzeFileImports(
            filePath,
            fileContent,
            sandbox,
            fileTree
            // Pass the cached file tree
          );
          errors.push(...importErrors);
        } catch (fileError) {
          console.warn(`[ErrorDetector] Error analyzing ${filePath}:`, fileError);
        }
      }
      console.log(
        `[ErrorDetector] Found ${errors.length} import errors from ${fileBlocks.length} files`
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
  static async detectNavigationErrorsFromProject(sandbox) {
    const errors = [];
    try {
      console.log(
        "[ErrorDetector] Detecting navigation errors from project..."
      );
      const findResult = await runCommandOnSandbox(
        sandbox,
        "find src -name '*.tsx' -o -name '*.ts' | grep -E '(Header|Nav|Sidebar|Menu)' | head -10",
        { timeoutMs: 5e3 }
      );
      if (findResult.stdout) {
        const navFiles = findResult.stdout.trim().split("\n").filter(Boolean);
        for (const file of navFiles) {
          try {
            const fileContent = await runCommandOnSandbox(
              sandbox,
              `cat "${file}"`,
              { timeoutMs: 3e3 }
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
  static deduplicateErrors(errors) {
    const seen = /* @__PURE__ */ new Set();
    return errors.filter((error) => {
      const key = `${error.file || "unknown"}:${error.message}`;
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
  static async detectBuildErrorsFromFiles(fragmentFiles, logger2 = logger) {
    const errors = [];
    try {
      logger2.info({
        msg: "Detecting build errors from V2Fragment files"
      });
      const codeFiles = Object.entries(fragmentFiles).filter(
        ([path]) => /\.(ts|tsx|js|jsx)$/.test(path)
      );
      logger2.info({
        msg: "Analyzing code files for build errors",
        codeFileCount: codeFiles.length
      });
      for (const [filePath, content] of codeFiles) {
        const tsErrors = this.parseTypeScriptErrorsFromContent(
          filePath,
          content
        );
        errors.push(...tsErrors);
      }
      logger2.info({
        msg: "Found build errors in V2Fragment files",
        errorCount: errors.length
      });
      return errors;
    } catch (error) {
      logger2.error({
        msg: "Build error detection from files failed",
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }
  /**
   * Detects import/dependency errors from V2Fragment files
   */
  static async detectImportErrorsFromFiles(fragmentFiles, logger2 = logger) {
    const errors = [];
    try {
      logger2.info({
        msg: "Detecting import errors from V2Fragment files"
      });
      const codeFiles = Object.entries(fragmentFiles).filter(
        ([path]) => /\.(ts|tsx|js|jsx)$/.test(path)
      );
      logger2.info({
        msg: "Analyzing code files for import errors",
        codeFileCount: codeFiles.length
      });
      for (const [filePath, content] of codeFiles) {
        const importErrors = await this.analyzeFileImports(filePath, content, null);
        errors.push(...importErrors);
      }
      logger2.info({
        msg: "Found import errors in V2Fragment files",
        errorCount: errors.length
      });
      return errors;
    } catch (error) {
      logger2.error({
        msg: "Import error detection from files failed",
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }
  /**
   * Detects navigation/routing errors from V2Fragment files
   */
  static async detectNavigationErrorsFromFiles(fragmentFiles, logger2 = logger) {
    const errors = [];
    try {
      logger2.info({
        msg: "Detecting navigation errors from V2Fragment files"
      });
      const codeFiles = Object.entries(fragmentFiles).filter(
        ([path]) => /\.(ts|tsx|js|jsx)$/.test(path)
      );
      logger2.info({
        msg: "Analyzing code files for navigation errors",
        codeFileCount: codeFiles.length
      });
      for (const [filePath, content] of codeFiles) {
        const navErrors = this.analyzeNavigationLinks(filePath, content);
        errors.push(...navErrors);
      }
      logger2.info({
        msg: "Found navigation errors in V2Fragment files",
        errorCount: errors.length
      });
      return errors;
    } catch (error) {
      logger2.error({
        msg: "Navigation error detection from files failed",
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }
  /**
   * Parse TypeScript compiler output (from tsc command)
   * Parses format: src/file.tsx(line,col): error TS####: message
   */
  static parseTypeScriptCompilerOutput(output) {
    const errors = [];
    if (!output || output.trim() === "") {
      return errors;
    }
    const lines = output.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const errorMatch = line.match(
        /^(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)$/
      );
      if (errorMatch) {
        const [, file, lineNum, colNum, errorCode, message] = errorMatch;
        let fullMessage = message;
        let j = i + 1;
        while (j < lines.length && !lines[j].match(/^.+?\(\d+,\d+\):/)) {
          const continuationLine = lines[j].trim();
          if (continuationLine) {
            fullMessage += " " + continuationLine;
          }
          j++;
        }
        errors.push({
          id: this.generateErrorId(),
          type: import_prisma.ErrorType.TYPE_SCRIPT,
          message: fullMessage,
          file,
          line: parseInt(lineNum, 10),
          column: parseInt(colNum, 10),
          severity: this.determineSeverityFromTypeScriptError(errorCode),
          autoFixable: this.isTypeScriptErrorAutoFixable(errorCode),
          details: {
            errorCode,
            compilerOutput: line,
            analysisType: "tsc_compiler"
          }
        });
        i = j - 1;
      }
    }
    return errors;
  }
  /**
   * Parse TypeScript compilation errors from file content
   */
  static parseTypeScriptErrorsFromContent(filePath, content) {
    const errors = [];
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;
      if (line.includes(
        "Fast refresh only works when a file only exports components"
      )) {
        continue;
      }
      if (this.hasTypeScriptErrorPattern(line)) {
        errors.push({
          id: this.generateErrorId(),
          type: import_prisma.ErrorType.TYPE_SCRIPT,
          message: `Potential TypeScript error: ${line.trim()}`,
          file: filePath,
          line: lineNumber,
          column: 1,
          severity: import_prisma.ErrorSeverity.LOW,
          // Pattern-based detection = LOW severity
          autoFixable: true,
          details: {
            errorCode: "TS_CONTENT_ANALYSIS",
            originalLine: line.trim(),
            analysisType: "content_pattern"
          }
        });
      }
    }
    return errors;
  }
  /**
   * Parse ESLint-style errors from file content
   */
  static parseESLintErrorsFromContent(filePath, content) {
    const errors = [];
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;
      if (line.includes(
        "Fast refresh only works when a file only exports components"
      )) {
        continue;
      }
      if (this.hasESLintViolationPattern(line)) {
        errors.push({
          id: this.generateErrorId(),
          type: import_prisma.ErrorType.ESLINT,
          message: `Potential ESLint violation: ${line.trim()}`,
          file: filePath,
          line: lineNumber,
          column: 1,
          severity: import_prisma.ErrorSeverity.LOW,
          // Pattern-based detection = LOW severity
          autoFixable: true,
          details: {
            ruleId: "content_analysis",
            originalLine: line.trim(),
            analysisType: "content_pattern"
          }
        });
      }
    }
    return errors;
  }
  /**
   * Check if line has TypeScript error patterns
   */
  static hasTypeScriptErrorPattern(line) {
    const patterns = [
      /@ts-ignore/,
      // TypeScript ignore comments (usually indicate type issues)
      /as\s+any/
      // Type assertions to any (can hide type issues)
    ];
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith("//") || trimmedLine.startsWith("*") || trimmedLine.startsWith("/*")) {
      return false;
    }
    return patterns.some((pattern) => pattern.test(line));
  }
  /**
   * Check if line has ESLint violation patterns
   */
  static hasESLintViolationPattern(line) {
    const patterns = [
      /var\s+\w+/,
      // Use of 'var' (but allow in specific contexts)
      /==\s*[^=]/,
      // Use of == instead of === (but allow in specific contexts)
      /!=\s*[^=]/,
      // Use of != instead of !== (but allow in specific contexts)
      /\s+$/
      // Trailing whitespace
    ];
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith("//") || trimmedLine.startsWith("*") || trimmedLine.startsWith("/*")) {
      return false;
    }
    if (trimmedLine.includes("//") || trimmedLine.includes("/*")) {
      return false;
    }
    if (trimmedLine.includes("console.log") && (trimmedLine.includes("debug") || trimmedLine.includes("development") || trimmedLine.includes("TODO"))) {
      return false;
    }
    return patterns.some((pattern) => pattern.test(line));
  }
  /**
   * Parse ESLint errors from JSON output (legacy method - kept for compatibility)
   */
  static parseESLintErrors(jsonOutput) {
    const errors = [];
    try {
      const eslintResults = JSON.parse(jsonOutput);
      for (const result of eslintResults) {
        for (const message of result.messages) {
          if (message.message.includes(
            "Fast refresh only works when a file only exports components"
          )) {
            continue;
          }
          if (message.severity === 2) {
            errors.push({
              id: this.generateErrorId(),
              type: import_prisma.ErrorType.ESLINT,
              message: message.message,
              file: result.filePath,
              line: message.line,
              column: message.column,
              severity: this.determineSeverityFromESLintRule(message.ruleId),
              autoFixable: message.fix !== void 0,
              details: {
                ruleId: message.ruleId,
                severity: message.severity,
                fix: message.fix
              }
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
   * Enhanced to detect unresolved imports using tsconfig-aware resolution
   * @param sandbox - Modal sandboxId string, or null for fragment-only analysis
   * @param fileTree - Optional cached set of all file paths for fast existence checks
   * 
   * PUBLIC: Exposed for validation in VoltAgent
   */
  static async analyzeFileImports(filePath, content, sandbox = null, fileTree) {
    const errors = [];
    const importRegex = /import\s+(?:(\w+)|{([^}]+)}|\*\s+as\s+\w+)?\s*(?:from\s+)?['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const defaultImport = match[1];
      const namedImports = match[2];
      const importPath = match[3];
      const importType = defaultImport ? "default" : namedImports ? "named" : "namespace";
      const assetExtensions = [".css", ".scss", ".sass", ".less", ".svg", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".woff", ".woff2", ".ttf", ".eot"];
      if (assetExtensions.some((ext) => importPath.endsWith(ext))) {
        continue;
      }
      if (!importPath.startsWith("./") && !importPath.startsWith("../") && !importPath.startsWith("@/")) {
        const isBuiltin = ["fs", "path", "http", "https", "crypto", "stream", "events", "util", "os"].includes(importPath.split("/")[0]);
        if (!isBuiltin) {
          console.log(`[ErrorDetector]   Bare import: ${importPath} (potential npm package)`);
        }
        continue;
      }
      if (sandbox) {
        const { resolved, candidates } = await resolveImportPath(importPath, filePath, sandbox, fileTree);
        if (!resolved) {
          console.log(`[ErrorDetector] UNRESOLVED IMPORT: ${importPath} in ${filePath}`);
          console.log(`[ErrorDetector]   Tried: ${candidates.join(", ")}`);
          let smartSuggestion = null;
          if (fileTree && candidates.length > 0) {
            const baseName = candidates[0].split("/").pop()?.replace(/\.(ts|tsx|js|jsx)$/, "");
            if (baseName) {
              const similarFiles = Array.from(fileTree).filter(
                (f) => f.includes(baseName) || f.toLowerCase().includes(baseName.toLowerCase())
              );
              if (similarFiles.length > 0) {
                const bestMatch = similarFiles[0];
                smartSuggestion = bestMatch.replace(/\.(ts|tsx|js|jsx)$/, "");
                console.log(`[ErrorDetector]   Smart suggestion: ${smartSuggestion}`);
              }
            }
          }
          errors.push({
            id: this.generateErrorId(),
            type: import_prisma.ErrorType.IMPORT,
            message: `Cannot find module '${importPath}'`,
            file: filePath,
            importPath,
            severity: import_prisma.ErrorSeverity.HIGH,
            // Unresolved file = HIGH severity
            autoFixable: true,
            details: {
              importType,
              reason: "unresolved",
              importStatement: match[0],
              line: content.substring(0, match.index).split("\n").length,
              candidates: candidates.join(", "),
              suggestion: smartSuggestion || (candidates.length > 0 ? candidates[0].replace(/\.(ts|tsx|js|jsx)$/, "") : "Fix import path or create missing file")
            }
          });
        }
      } else {
        if (this.isProblematicImport(importPath)) {
          errors.push({
            id: this.generateErrorId(),
            type: import_prisma.ErrorType.IMPORT,
            message: `Potentially missing import: ${importPath}`,
            file: filePath,
            importPath,
            severity: import_prisma.ErrorSeverity.LOW,
            // Pattern-based detection = LOW severity
            autoFixable: true,
            details: {
              importStatement: match[0],
              line: content.substring(0, match.index).split("\n").length
            }
          });
        }
      }
    }
    const missingExportErrors = this.detectMissingExports(filePath, content);
    errors.push(...missingExportErrors);
    return errors;
  }
  /**
   * Detect missing exports that are commonly imported
   */
  static detectMissingExports(filePath, content) {
    const errors = [];
    const hasDefaultExport = /export\s+default\s+/.test(content);
    if (hasDefaultExport) {
      return errors;
    }
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;
      const functionMatch = line.match(
        /^(export\s+)?(function|const|let|var)\s+([A-Z][a-zA-Z0-9]*)/
      );
      if (functionMatch) {
        const isExported = functionMatch[1]?.includes("export");
        const componentName = functionMatch[3];
        if (componentName && !isExported && /^[A-Z]/.test(componentName)) {
          if (["App", "Main", "Home", "Index"].includes(componentName)) {
            errors.push({
              id: this.generateErrorId(),
              type: import_prisma.ErrorType.IMPORT,
              message: `Missing export for ${componentName} component`,
              file: filePath,
              importPath: componentName,
              severity: import_prisma.ErrorSeverity.HIGH,
              autoFixable: true,
              details: {
                componentName,
                line: lineNumber,
                suggestion: `Add 'export default ${componentName}' or 'export { ${componentName} }'`,
                originalLine: line.trim()
              }
            });
          }
        }
      }
    }
    if (filePath.includes("App.tsx") || filePath.includes("App.jsx")) {
      const hasAppComponent = content.includes("function App") || content.includes("const App");
      if (hasAppComponent && !hasDefaultExport) {
        errors.push({
          id: this.generateErrorId(),
          type: import_prisma.ErrorType.IMPORT,
          message: "Missing export default for App component",
          file: filePath,
          importPath: "App",
          severity: import_prisma.ErrorSeverity.CRITICAL,
          autoFixable: true,
          details: {
            componentName: "App",
            suggestion: "Add export default App at the end of the file",
            issue: "App component is not exported, causing import errors in main.tsx"
          }
        });
      }
    }
    return errors;
  }
  /**
   * Analyze navigation links for broken routes
   */
  static analyzeNavigationLinks(filePath, content) {
    const errors = [];
    const linkRegex = /href=['"]([^'"]+)['"]|to=['"]([^'"]+)['"]/g;
    let match;
    while ((match = linkRegex.exec(content)) !== null) {
      const route = match[1] || match[2];
      if (this.isProblematicRoute(route)) {
        errors.push({
          id: this.generateErrorId(),
          type: import_prisma.ErrorType.NAVIGATION,
          message: `Potentially broken route: ${route}`,
          route,
          file: filePath,
          severity: import_prisma.ErrorSeverity.LOW,
          // Pattern-based detection = LOW severity
          autoFixable: true,
          details: {
            linkAttribute: match[1] ? "href" : "to",
            line: content.substring(0, match.index).split("\n").length
          }
        });
      }
    }
    return errors;
  }
  /**
   * Helper methods for error classification
   */
  static isProblematicImport(importPath) {
    const problematicPatterns = [
      /^@\/lib\/store$/,
      // Missing store file
      /^@\/lib\/types$/,
      // Missing types file
      /^framer-motion$/,
      // Forbidden dependency
      /^react-spring$/,
      // Forbidden dependency
      // Only flag UI components that are likely missing (not all UI components)
      /^@\/components\/ui\/[a-z-]+$/
      // Missing specific UI components (but not all)
    ];
    const definitelyProblematic = [
      /^@\/lib\/store$/,
      // Store file that doesn't exist
      /^@\/lib\/types$/,
      // Types file that doesn't exist
      /^framer-motion$/,
      // Forbidden animation library
      /^react-spring$/
      // Forbidden animation library
    ];
    return definitelyProblematic.some((pattern) => pattern.test(importPath)) || importPath.startsWith("@/components/ui/") && !importPath.includes("button") && !importPath.includes("dialog") && !importPath.includes("input") && !importPath.includes("card") && !importPath.includes("badge") && !importPath.includes("alert") && !importPath.includes("form") && !importPath.includes("table") && !importPath.includes("select") && !importPath.includes("textarea") && !importPath.includes("checkbox") && !importPath.includes("radio") && !importPath.includes("switch") && !importPath.includes("slider") && !importPath.includes("tabs") && !importPath.includes("accordion") && !importPath.includes("carousel") && !importPath.includes("calendar") && !importPath.includes("command") && !importPath.includes("popover") && !importPath.includes("tooltip") && !importPath.includes("dropdown") && !importPath.includes("navigation") && !importPath.includes("sidebar") && !importPath.includes("toggle") && !importPath.includes("separator") && !importPath.includes("scroll-area") && !importPath.includes("sheet") && !importPath.includes("skeleton") && !importPath.includes("avatar") && !importPath.includes("progress") && !importPath.includes("spinner") && !importPath.includes("toast") && !importPath.includes("sonner");
  }
  static isProblematicRoute(route) {
    return route.startsWith("/") && !route.includes("#") && route !== "/";
  }
  static determineSeverityFromTypeScriptError(errorCode) {
    const criticalErrors = ["TS2307", "TS2339", "TS2345"];
    const highErrors = ["TS2304", "TS2322"];
    if (criticalErrors.includes(errorCode)) return import_prisma.ErrorSeverity.CRITICAL;
    if (highErrors.includes(errorCode)) return import_prisma.ErrorSeverity.HIGH;
    return import_prisma.ErrorSeverity.MEDIUM;
  }
  static determineSeverityFromESLintRule(ruleId) {
    if (!ruleId) return import_prisma.ErrorSeverity.LOW;
    const criticalRules = [
      "no-undef",
      "no-unused-vars",
      "react-hooks/exhaustive-deps"
    ];
    const highRules = [
      "prefer-const",
      "no-var",
      "@typescript-eslint/no-explicit-any"
    ];
    if (criticalRules.some((rule) => ruleId.includes(rule)))
      return import_prisma.ErrorSeverity.CRITICAL;
    if (highRules.some((rule) => ruleId.includes(rule)))
      return import_prisma.ErrorSeverity.HIGH;
    return import_prisma.ErrorSeverity.MEDIUM;
  }
  static isTypeScriptErrorAutoFixable(errorCode) {
    const autoFixableErrors = [
      "TS2304",
      // Cannot find name (can add imports)
      "TS2307",
      // Module not found (can create missing files)
      "TS2339"
      // Property doesn't exist (can fix property names)
    ];
    return autoFixableErrors.includes(errorCode);
  }
  static calculateOverallSeverity(errors) {
    const allErrors = [
      ...errors.buildErrors,
      ...errors.importErrors,
      ...errors.navigationErrors
    ];
    if (allErrors.length === 0) {
      return "low";
    }
    const errorsWithoutSeverity = allErrors.filter((e) => !e.severity);
    if (errorsWithoutSeverity.length > 0) {
      console.warn(`[ErrorDetector] \u26A0\uFE0F  Found ${errorsWithoutSeverity.length} errors without severity:`);
      errorsWithoutSeverity.slice(0, 3).forEach((e) => {
        console.warn(`  - ${e.type}: ${e.message} (file: ${e.file || "unknown"})`);
      });
    }
    for (const error of allErrors) {
      const severityStr = error.severity?.toString().toUpperCase();
      if (severityStr === "CRITICAL") return "critical";
    }
    for (const error of allErrors) {
      const severityStr = error.severity?.toString().toUpperCase();
      if (severityStr === "HIGH") return "high";
    }
    for (const error of allErrors) {
      const severityStr = error.severity?.toString().toUpperCase();
      if (severityStr === "MEDIUM") return "medium";
    }
    for (const error of allErrors) {
      const severityStr = error.severity?.toString().toUpperCase();
      if (severityStr === "LOW") return "low";
    }
    console.warn(`[ErrorDetector] \u26A0\uFE0F  All ${allErrors.length} errors have undefined severity, defaulting to 'low'`);
    return "low";
  }
  static calculateAutoFixability(errors) {
    const allErrors = [
      ...errors.buildErrors,
      ...errors.importErrors,
      ...errors.navigationErrors
    ];
    return allErrors.some((e) => e.autoFixable);
  }
};

export {
  ErrorDetector
};
