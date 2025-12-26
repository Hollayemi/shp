import { ErrorType, ErrorSeverity, ErrorStatus } from "@shipper/database";
import { validateEslintOutput } from "@shipper/shared";
import { readFileFromSandbox, runCommandOnSandbox } from "./sandbox-compat.js";
import { executeCommand } from "./modal-sandbox-manager.js";
import type { Logger } from "pino";
import logger, { logger as defaultLogger } from "../config/logger.js";

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

// ============================================================================
// HELPER: Tsconfig-aware Import Resolver
// ============================================================================

interface TsConfig {
  baseUrl?: string;
  paths?: Record<string, string[]>;
}

let tsconfigCache: { config: TsConfig | null; timestamp: number } | null = null;

async function readTsconfig(sandbox: string | null): Promise<TsConfig> {
  // Cache for 5 minutes
  if (tsconfigCache && Date.now() - tsconfigCache.timestamp < 300000) {
    console.log('[Resolver] Using cached tsconfig');
    return tsconfigCache.config || {};
  }

  if (!sandbox) {
    console.log('[Resolver] No sandbox, skipping tsconfig');
    return {};
  }

  try {
    console.log('[Resolver] Reading tsconfig.json from sandbox...');
    const content = await readFileFromSandbox(sandbox, 'tsconfig.json');
    const tsconfig = JSON.parse(content);
    const config = tsconfig.compilerOptions || {};
    
    tsconfigCache = { config, timestamp: Date.now() };
    console.log('[Resolver] Tsconfig loaded and cached:', config.paths ? 'has paths' : 'no paths');
    return config;
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.log('[Resolver] Failed to read tsconfig.json (using defaults):', errorMessage);
    tsconfigCache = { config: {}, timestamp: Date.now() };
    return {};
  }
}

async function resolveImportPath(
  specifier: string,
  fromFile: string,
  sandbox: string | null,
  fileTree?: Set<string>
): Promise<{ resolved: string | null; candidates: string[] }> {
  const candidates: string[] = [];
  
  console.log(`[Resolver] Resolving '${specifier}' from ${fromFile}`);
  console.log(`[Resolver] FileTree available: ${!!fileTree}, size: ${fileTree?.size || 0}`);

  // Skip bare specifiers (npm packages)
  if (!specifier.startsWith('./') && !specifier.startsWith('../') && !specifier.startsWith('@/')) {
    console.log(`[Resolver]   Bare specifier, skipping file resolution`);
    return { resolved: null, candidates: [] };
  }

  // If tsconfig resolver enabled, try alias resolution
  if (sandbox) {
    const tsconfig = await readTsconfig(sandbox);
    
    // Handle path aliases
    if (tsconfig.paths) {
      for (const [pattern, replacements] of Object.entries(tsconfig.paths)) {
        const patternRegex = new RegExp('^' + pattern.replace('*', '(.*)') + '$');
        const match = specifier.match(patternRegex);
        
        if (match) {
          console.log(`[Resolver]   Tsconfig alias match: ${pattern}`);
          
          for (const replacement of replacements) {
            const resolvedPath = replacement.replace('*', match[1] || '');
            
            // Build full path: handle baseUrl correctly
            // If replacement already starts with ./ or ../, it's relative to baseUrl
            // Otherwise, it's relative to project root
            let fullPath = resolvedPath;
            if (tsconfig.baseUrl) {
              // Remove leading ./ from resolvedPath if present
              const cleanPath = resolvedPath.replace(/^\.\//, '');
              // If baseUrl is ".", just use the clean path
              // Otherwise, join baseUrl with the path
              fullPath = tsconfig.baseUrl === '.' ? cleanPath : `${tsconfig.baseUrl}/${cleanPath}`;
            }
            
            console.log(`[Resolver]   Alias match: ${specifier} → ${fullPath}.*`);
            console.log(`[Resolver]   (baseUrl: ${tsconfig.baseUrl}, replacement: ${replacement}, resolved: ${resolvedPath})`);
            
            // Try common extensions
            const extensions = ['.ts', '.tsx', '.js', '.jsx'];
            for (const ext of extensions) {
              const candidate = `${fullPath}${ext}`;
              candidates.push(candidate);
              console.log(`[Resolver]   Trying: ${candidate}`);
              
              // Use fileTree cache if available (FAST), otherwise read file (SLOW)
              if (fileTree) {
                const exists = fileTree.has(candidate);
                console.log(`[Resolver]   Checking in cache: ${candidate} → ${exists ? 'EXISTS' : 'NOT FOUND'}`);
                if (exists) {
                  console.log(`[Resolver]   ✅ Found (cached): ${candidate}`);
                  return { resolved: candidate, candidates };
                }
              } else {
                try {
                  await readFileFromSandbox(sandbox, candidate);
                  console.log(`[Resolver]   ✅ Found: ${candidate}`);
                  return { resolved: candidate, candidates };
                } catch {
                  // File doesn't exist, continue
                }
              }
            }
            
            // Try directory imports (index files)
            const indexCandidates = [`${fullPath}/index.ts`, `${fullPath}/index.tsx`];
            for (const candidate of indexCandidates) {
              candidates.push(candidate);
              console.log(`[Resolver]   Trying: ${candidate}`);
              
              if (fileTree) {
                if (fileTree.has(candidate)) {
                  console.log(`[Resolver]   ✅ Found (cached): ${candidate}`);
                  return { resolved: candidate, candidates };
                }
              } else {
                try {
                  await readFileFromSandbox(sandbox, candidate);
                  console.log(`[Resolver]   ✅ Found: ${candidate}`);
                  return { resolved: candidate, candidates };
                } catch {
                  // File doesn't exist, continue
                }
              }
            }
          }
        }
      }
    }
  }

  // Resolve relative paths
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    const fromDir = fromFile.substring(0, fromFile.lastIndexOf('/')) || '';
    const parts = fromDir.split('/').filter(p => p && p !== '.');
    const importParts = specifier.split('/').filter(p => p && p !== '.');
    
    let upCount = 0;
    for (const part of importParts) {
      if (part === '..') upCount++;
      else break;
    }
    
    const resolvedParts = parts.slice(0, parts.length - upCount);
    const remainingImport = importParts.slice(upCount).join('/');
    const basePath = resolvedParts.length > 0 
      ? resolvedParts.join('/') + '/' + remainingImport
      : remainingImport;
    
    const extensions = ['.ts', '.tsx', '.js', '.jsx'];
    for (const ext of extensions) {
      const candidate = `${basePath}${ext}`;
      candidates.push(candidate);
      console.log(`[Resolver]   Trying: ${candidate}`);
      
      // Use fileTree cache if available (FAST), otherwise read file (SLOW)
      if (fileTree) {
        if (fileTree.has(candidate)) {
          console.log(`[Resolver]   Found (cached): ${candidate}`);
          return { resolved: candidate, candidates };
        }
      } else if (sandbox) {
        // Only try to read from sandbox if sandbox is available
        try {
          await readFileFromSandbox(sandbox, candidate);
          console.log(`[Resolver]   Found: ${candidate}`);
          return { resolved: candidate, candidates };
        } catch {
          // File doesn't exist, continue
        }
      }
      // If no fileTree and no sandbox, we can't verify - skip this candidate
    }
  }

  console.log(`[Resolver]   ❌ NOT FOUND. Tried: ${candidates.join(', ')}`);
  return { resolved: null, candidates };
}

export class ErrorDetector {
  private static generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Main entry point for error detection
   * Analyzes V2Fragment files only (not entire sandbox)
   */
  static async analyzeV2Fragment(
    fragmentFiles: {
      [path: string]: string;
    },
    logger: Logger = defaultLogger,
  ): Promise<ProjectErrors> {
    logger.info({
      msg: "Starting V2Fragment analysis",
      fileCount: Object.keys(fragmentFiles).length,
    });

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
        this.detectBuildErrorsFromFiles(fragmentFiles, logger),
        this.detectImportErrorsFromFiles(fragmentFiles, logger),
        this.detectNavigationErrorsFromFiles(fragmentFiles, logger),
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
      logger.info({
        msg: "V2Fragment analysis complete",
        totalErrors: errors.totalErrors,
        durationMs: duration,
      });

      return errors;
    } catch (error) {
      logger.error({
        msg: "Error during V2Fragment analysis",
        error: error instanceof Error ? error.message : String(error),
      });

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
   * @param sandbox - Modal sandboxId string
   */
  static async analyzeProjectWithFragmentModal(
    fragmentFiles: { [path: string]: string },
    sandbox: string
  ): Promise<ProjectErrors> {
    console.log(
      `[ErrorDetector] Starting hybrid analysis: fragment + project build`
    );
    console.log(`[ErrorDetector] Sandbox type:`, typeof sandbox);
    console.log(`[ErrorDetector] Sandbox value:`, typeof sandbox === 'string' ? sandbox : 'Sandbox object');

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
      // console.log("[ErrorDetector] Phase 1: Fragment pattern analysis...");
      // const [fragmentBuildErrors, fragmentImportErrors, fragmentNavErrors] =
      //   await Promise.all([
      //     this.detectBuildErrorsFromFiles(fragmentFiles),
      //     this.detectImportErrorsFromFiles(fragmentFiles),
      //     this.detectNavigationErrorsFromFiles(fragmentFiles),
      //   ]);

      // Phase 2: Full project build analysis (slower, comprehensive)
      console.log("[ErrorDetector] Phase 2: Project build analysis...");
      console.log("[ErrorDetector] Calling detectBuildErrorsFromProject...");
      console.log("[ErrorDetector] Calling detectImportErrorsFromProject...");
      console.log("[ErrorDetector] Calling detectNavigationErrorsFromProject...");
      
      const [projectBuildErrors, projectImportErrors, projectNavErrors] =
        await Promise.all([
          this.detectBuildErrorsFromProject(sandbox),
          this.detectImportErrorsFromProject(sandbox),
          this.detectNavigationErrorsFromProject(sandbox),
        ]);
      
      console.log("[ErrorDetector] Phase 2 complete:");
      console.log(`[ErrorDetector]   Build errors: ${projectBuildErrors.length}`);
      console.log(`[ErrorDetector]   Import errors: ${projectImportErrors.length}`);
      console.log(`[ErrorDetector]   Navigation errors: ${projectNavErrors.length}`);

      // Use only project build errors (TypeScript catches everything)
      errors.buildErrors = projectBuildErrors;
      errors.importErrors = [];
      errors.navigationErrors = [];

      // Remove duplicates based on file path and error message
      // errors.buildErrors = this.deduplicateErrors(errors.buildErrors);
      // errors.importErrors = this.deduplicateErrors(errors.importErrors);
      // errors.navigationErrors = this.deduplicateErrors(errors.navigationErrors);

      // Calculate overall metrics
      errors.totalErrors =
        errors.buildErrors.length +
        errors.importErrors.length +
        errors.navigationErrors.length;

      errors.severity = this.calculateOverallSeverity(errors);
      errors.autoFixable = this.calculateAutoFixability(errors);

      const duration = Date.now() - startTime;
      logger.info({
        msg: "Modal hybrid analysis complete",
        totalErrors: errors.totalErrors,
        durationMs: duration,
      });

      return errors;
    } catch (error) {
      logger.error({
        msg: "Modal hybrid analysis failed",
        error: error instanceof Error ? error.message : String(error),
      });

      // Fallback to fragment-only analysis if project analysis fails
      logger.info({
        msg: "Falling back to fragment-only analysis",
      });
      return this.analyzeV2Fragment(fragmentFiles, logger);
    }
  }

  /**
   * Detects build/compilation errors from full project build
   * @param sandbox - Modal sandboxId string
   */
  private static async detectBuildErrorsFromProject(
    sandbox: string
  ): Promise<BuildError[]> {
    const errors: BuildError[] = [];

    try {
      logger.info({
        msg: "Detecting build errors from Modal project build",
        sandbox,
      });

      // Check for TypeScript compilation errors using bunx (Modal uses bun)
      const tscResult = await executeCommand(
        sandbox,
        "bunx tsc -b --noEmit",
        {
          timeoutMs: 60000,
        },
      );

      logger.info({
        msg: "TypeScript compilation result",
        result: tscResult,
      });

      if (tscResult.stderr || tscResult.exitCode !== 0) {
        const tsErrors = this.parseTypeScriptCompilerOutput(
          tscResult.stderr || tscResult.stdout || "",
        );
        errors.push(...tsErrors);
      }

      logger.info({
        msg: "Found build errors from Modal project build",
        errorCount: errors.length,
      });
      return errors;
    } catch (error) {
      logger.error({
        msg: "Modal project build error detection failed",
        error: error instanceof Error ? error.message : String(error),
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
  private static async detectImportErrorsFromProject(
    sandbox: string
  ): Promise<ImportError[]> {
    const errors: ImportError[] = [];

    try {
      console.log("[ErrorDetector] Detecting import errors from project (batched mode)...");

      // STEP 1: Get full file tree for import resolution (cache all file paths)
      // This eliminates 600+ individual file reads (100ms each) → 1 command (1 second)
      // Speed improvement: ~60 seconds → ~1 second for import resolution!
      console.log("[ErrorDetector] Fetching file tree for import resolution cache...");
      const fileTreeCommand = `bash -c 'find src -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \\) 2>/dev/null'`;
      const fileTreeResult = await runCommandOnSandbox(sandbox, fileTreeCommand, { timeoutMs: 10000 });
      
      const fileTree = new Set<string>(
        fileTreeResult.stdout ? fileTreeResult.stdout.trim().split('\n').filter(Boolean) : []
      );
      console.log(`[ErrorDetector] Cached ${fileTree.size} files for import resolution (O(1) lookups)`);
      
      // DEBUG: Show first 10 files in cache
      const sampleFiles = Array.from(fileTree).slice(0, 10);
      console.log(`[ErrorDetector] Sample cached files:`, sampleFiles);

      // STEP 2: Get all files and their contents in ONE command
      // SYNCHRONIZATION GUARANTEE: Bash for-loop is sequential - each iteration
      // completes before the next starts. Output order is guaranteed.
      // PRIORITY ORDER: Root → Pages → Components → API → Hooks → Lib → Utils → Everything Else
      // SCAN LIMIT: 100 files max, excluding tests/stories/mocks/shadcn
      const scanLimit = ' | head -100';
      const delimiter = '___FILE_SEPARATOR___';
      const endDelimiter = '___END_FILE___';
      // Wrap in bash -c for Modal's simple command parser
      // Priority scan: check critical directories first, then catch-all for remaining files
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
      
      console.log(`[ErrorDetector] Scan mode: PRIORITY (root→pages→components→api→hooks→lib→utils→rest, 100 max)`);
      console.log(`[ErrorDetector] Executing batched file read command...`);
      
      const batchResult = await runCommandOnSandbox(
        sandbox,
        batchCommand,
        { timeoutMs: 30000 } // Longer timeout for batch operation
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

      // Parse batched output with safer delimiters
      const output = batchResult.stdout;
      const fileBlocks = output.split(delimiter).slice(1); // Skip empty first element
      
      console.log(`[ErrorDetector] Scanning ${fileBlocks.length} files for import errors`);

      for (const block of fileBlocks) {
        const endFileIndex = block.indexOf(endDelimiter);
        if (endFileIndex === -1) continue;
        
        // Extract everything before the end delimiter
        const content = block.substring(0, endFileIndex);
        const firstNewline = content.indexOf('\n');
        if (firstNewline === -1) continue;
        
        // First line (after initial newline) is the file path
        const secondNewline = content.indexOf('\n', firstNewline + 1);
        const filePath = content.substring(firstNewline + 1, secondNewline !== -1 ? secondNewline : content.length).trim();
        if (!filePath) continue;
        
        // Everything after the file path line is the content
        const fileContent = secondNewline !== -1 ? content.substring(secondNewline + 1) : '';
        
        if (!fileContent.trim() || fileContent.trim() === 'ERROR_READING_FILE') {
          console.warn(`[ErrorDetector] Could not read ${filePath}`);
          continue;
        }
        
        console.log(`[ErrorDetector]   Analyzing: ${filePath}`);
        
        try {
          const importErrors = await this.analyzeFileImports(
            filePath,
            fileContent,
            sandbox,
         
            fileTree  // Pass the cached file tree
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
  private static async detectNavigationErrorsFromProject(
    sandbox: string
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
  private static async detectBuildErrorsFromFiles(
    fragmentFiles: {
      [path: string]: string;
    },
    logger: Logger = defaultLogger,
  ): Promise<BuildError[]> {
    const errors: BuildError[] = [];

    try {
      logger.info({
        msg: "Detecting build errors from V2Fragment files",
      });

      // Filter to only TypeScript/JavaScript files
      const codeFiles = Object.entries(fragmentFiles).filter(([path]) =>
        /\.(ts|tsx|js|jsx)$/.test(path),
      );

      logger.info({
        msg: "Analyzing code files for build errors",
        codeFileCount: codeFiles.length,
      });

      for (const [filePath, content] of codeFiles) {
        // Check for TypeScript compilation errors in file content
        const tsErrors = this.parseTypeScriptErrorsFromContent(
          filePath,
          content,
        );
        errors.push(...tsErrors);
      }

      logger.info({
        msg: "Found build errors in V2Fragment files",
        errorCount: errors.length,
      });
      return errors;
    } catch (error) {
      logger.error({
        msg: "Build error detection from files failed",
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Detects import/dependency errors from V2Fragment files
   */
  private static async detectImportErrorsFromFiles(
    fragmentFiles: {
      [path: string]: string;
    },
    logger: Logger = defaultLogger,
  ): Promise<ImportError[]> {
    const errors: ImportError[] = [];

    try {
      logger.info({
        msg: "Detecting import errors from V2Fragment files",
      });

      // Filter to only TypeScript/JavaScript files
      const codeFiles = Object.entries(fragmentFiles).filter(([path]) =>
        /\.(ts|tsx|js|jsx)$/.test(path),
      );

      logger.info({
        msg: "Analyzing code files for import errors",
        codeFileCount: codeFiles.length,
      });

      for (const [filePath, content] of codeFiles) {
        const importErrors = await this.analyzeFileImports(filePath, content, null);
        errors.push(...importErrors);
      }

      logger.info({
        msg: "Found import errors in V2Fragment files",
        errorCount: errors.length,
      });
      return errors;
    } catch (error) {
      logger.error({
        msg: "Import error detection from files failed",
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Detects navigation/routing errors from V2Fragment files
   */
  private static async detectNavigationErrorsFromFiles(
    fragmentFiles: {
      [path: string]: string;
    },
    logger: Logger = defaultLogger,
  ): Promise<NavigationError[]> {
    const errors: NavigationError[] = [];

    try {
      logger.info({
        msg: "Detecting navigation errors from V2Fragment files",
      });

      // Filter to only TypeScript/JavaScript files (especially components)
      const codeFiles = Object.entries(fragmentFiles).filter(([path]) =>
        /\.(ts|tsx|js|jsx)$/.test(path),
      );

      logger.info({
        msg: "Analyzing code files for navigation errors",
        codeFileCount: codeFiles.length,
      });

      for (const [filePath, content] of codeFiles) {
        const navErrors = this.analyzeNavigationLinks(filePath, content);
        errors.push(...navErrors);
      }

      logger.info({
        msg: "Found navigation errors in V2Fragment files",
        errorCount: errors.length,
      });
      return errors;
    } catch (error) {
      logger.error({
        msg: "Navigation error detection from files failed",
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Parse TypeScript compiler output (from tsc command)
   * Parses format: src/file.tsx(line,col): error TS####: message
   */
  private static parseTypeScriptCompilerOutput(output: string): BuildError[] {
    const errors: BuildError[] = [];

    if (!output || output.trim() === "") {
      return errors;
    }

    const lines = output.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip empty lines
      if (!line) continue;

      // Parse TypeScript error format: file(line,col): error TS####: message
      const errorMatch = line.match(
        /^(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)$/,
      );

      if (errorMatch) {
        const [, file, lineNum, colNum, errorCode, message] = errorMatch;

        // Collect continuation lines (multi-line error messages)
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
          type: ErrorType.TYPE_SCRIPT,
          message: fullMessage,
          file,
          line: parseInt(lineNum, 10),
          column: parseInt(colNum, 10),
          severity: this.determineSeverityFromTypeScriptError(errorCode),
          autoFixable: this.isTypeScriptErrorAutoFixable(errorCode),
          details: {
            errorCode,
            compilerOutput: line,
            analysisType: "tsc_compiler",
          },
        });

        // Skip the continuation lines we already processed
        i = j - 1;
      }
    }

    return errors;
  }

  /**
   * Parse TypeScript compilation errors from file content
   */
  private static parseTypeScriptErrorsFromContent(
    filePath: string,
    content: string,
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
          "Fast refresh only works when a file only exports components",
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
    content: string,
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
          "Fast refresh only works when a file only exports components",
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
              "Fast refresh only works when a file only exports components",
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
        parseError,
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
  public static async analyzeFileImports(
    filePath: string,
    content: string,
    sandbox: string | null = null,
    fileTree?: Set<string>
  ): Promise<ImportError[]> {
    const errors: ImportError[] = [];

    // Match import statements (including default and named imports)
    const importRegex = /import\s+(?:(\w+)|{([^}]+)}|\*\s+as\s+\w+)?\s*(?:from\s+)?['"]([^'"]+)['"]/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const defaultImport = match[1];
      const namedImports = match[2];
      const importPath = match[3];
      const importType = defaultImport ? 'default' : (namedImports ? 'named' : 'namespace');

      // Skip non-code imports (CSS, images, etc.)
      const assetExtensions = ['.css', '.scss', '.sass', '.less', '.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.woff', '.woff2', '.ttf', '.eot'];
      if (assetExtensions.some(ext => importPath.endsWith(ext))) {
        continue; // Skip asset imports
      }

      // Skip node built-ins and external packages for file resolution
      if (!importPath.startsWith('./') && !importPath.startsWith('../') && !importPath.startsWith('@/')) {
        // Check if it's a missing package (not in node built-ins)
        const isBuiltin = ['fs', 'path', 'http', 'https', 'crypto', 'stream', 'events', 'util', 'os'].includes(importPath.split('/')[0]);
        
        if (!isBuiltin) {
          // This could be a missing npm package - check package.json if we have sandbox
          // For now, just log it as potential missing package
          console.log(`[ErrorDetector]   Bare import: ${importPath} (potential npm package)`);
        }
        continue;
      }

      // ENHANCED: Use tsconfig-aware resolver if available
      if (sandbox) {
        const { resolved, candidates } = await resolveImportPath(importPath, filePath, sandbox, fileTree);
        
        if (!resolved) {
          // FILE NOT FOUND - emit ImportError with HIGH severity
          console.log(`[ErrorDetector] UNRESOLVED IMPORT: ${importPath} in ${filePath}`);
          console.log(`[ErrorDetector]   Tried: ${candidates.join(', ')}`);
          
          // Smart suggestion: find closest match in fileTree if available
          let smartSuggestion = null;
          if (fileTree && candidates.length > 0) {
            // Look for files with similar names
            const baseName = candidates[0].split('/').pop()?.replace(/\.(ts|tsx|js|jsx)$/, '');
            if (baseName) {
              const similarFiles = Array.from(fileTree).filter(f => 
                f.includes(baseName) || f.toLowerCase().includes(baseName.toLowerCase())
              );
              
              if (similarFiles.length > 0) {
                // Convert file path back to import path (remove extension)
                // Keep it flexible - suggest the actual file path without forcing @/ alias
                const bestMatch = similarFiles[0];
                smartSuggestion = bestMatch.replace(/\.(ts|tsx|js|jsx)$/, '');
                console.log(`[ErrorDetector]   Smart suggestion: ${smartSuggestion}`);
              }
            }
          }
          
          errors.push({
            id: this.generateErrorId(),
            type: ErrorType.IMPORT,
            message: `Cannot find module '${importPath}'`,
            file: filePath,
            importPath,
            severity: ErrorSeverity.HIGH, // Unresolved file = HIGH severity
            autoFixable: true,
            details: {
              importType,
              reason: 'unresolved',
              importStatement: match[0],
              line: content.substring(0, match.index).split("\n").length,
              candidates: candidates.join(', '),
              suggestion: smartSuggestion || (candidates.length > 0 
                ? candidates[0].replace(/\.(ts|tsx|js|jsx)$/, '')
                : 'Fix import path or create missing file'),
            },
          });
        }
      } else {
        // FALLBACK: Check for common problematic import patterns (existing behavior)
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
    content: string,
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
        /^(export\s+)?(function|const|let|var)\s+([A-Z][a-zA-Z0-9]*)/,
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
    content: string,
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
    errorCode: string,
  ): ErrorSeverity {
    const criticalErrors = ["TS2307", "TS2339", "TS2345"]; // Module not found, property doesn't exist, type errors
    const highErrors = ["TS2304", "TS2322"]; // Cannot find name, type assignment errors

    if (criticalErrors.includes(errorCode)) return ErrorSeverity.CRITICAL;
    if (highErrors.includes(errorCode)) return ErrorSeverity.HIGH;
    return ErrorSeverity.MEDIUM;
  }

  private static determineSeverityFromESLintRule(
    ruleId: string | undefined,
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
    errors: ProjectErrors,
  ): "low" | "medium" | "high" | "critical" {
    const allErrors = [
      ...errors.buildErrors,
      ...errors.importErrors,
      ...errors.navigationErrors,
    ];

    // Handle empty errors
    if (allErrors.length === 0) {
      return "low";
    }

    // Debug: Check for errors without severity
    const errorsWithoutSeverity = allErrors.filter(e => !e.severity);
    if (errorsWithoutSeverity.length > 0) {
      console.warn(`[ErrorDetector] ⚠️  Found ${errorsWithoutSeverity.length} errors without severity:`);
      errorsWithoutSeverity.slice(0, 3).forEach(e => {
        console.warn(`  - ${e.type}: ${e.message} (file: ${(e as any).file || 'unknown'})`);
      });
    }

    // Check for highest severity (handle both enum and string values)
    for (const error of allErrors) {
      const severityStr = error.severity?.toString().toUpperCase();
      if (severityStr === 'CRITICAL') return "critical";
    }
    
    for (const error of allErrors) {
      const severityStr = error.severity?.toString().toUpperCase();
      if (severityStr === 'HIGH') return "high";
    }
    
    for (const error of allErrors) {
      const severityStr = error.severity?.toString().toUpperCase();
      if (severityStr === 'MEDIUM') return "medium";
    }
    
    for (const error of allErrors) {
      const severityStr = error.severity?.toString().toUpperCase();
      if (severityStr === 'LOW') return "low";
    }
    
    // If we get here, all errors have undefined severity - default to low
    console.warn(`[ErrorDetector] ⚠️  All ${allErrors.length} errors have undefined severity, defaulting to 'low'`);
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
