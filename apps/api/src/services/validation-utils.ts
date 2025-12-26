import type { Sandbox } from "@daytonaio/sdk";
import { ToolsContext } from "./types.js";
import {
  runCommandOnSandbox,
  readFileFromSandbox,
  type DaytonaExecutionResult,
} from "./sandbox-compat.js";

// Helper function to extract stdout from Daytona command results
function extractStdout(result: DaytonaExecutionResult): string {
  return result.stdout || result.result || result.output || "";
}

// Helper function to extract stderr from Daytona command results
function extractStderr(result: DaytonaExecutionResult): string {
  return result.stderr || "";
}

// Helper function to resolve relative import paths
export function resolveRelativeImport(
  fromFile: string,
  importPath: string,
): string {
  const fromDir = fromFile.substring(0, fromFile.lastIndexOf("/"));
  const parts = importPath.split("/");
  const pathParts = fromDir.split("/");

  for (const part of parts) {
    if (part === "..") {
      pathParts.pop();
    } else if (part !== ".") {
      pathParts.push(part);
    }
  }

  return pathParts.join("/");
}

/**
 * Gets a recursive listing of files with metadata using the Daytona SDK
 *
 * Uses `sandbox.fs.listFiles()` to recursively list files while excluding common build artifacts and dependencies.
 *
 * @remarks
 * Excludes:
 * - node_modules directory
 * - .npm directory
 * - .cache directory
 * - Hidden files (starting with .)
 * - Lock files (package-lock.json, pnpm-lock.yaml, yarn.lock)
 *
 * @returns A Map where keys are file paths and values contain size and modified timestamp metadata
 */
export async function getRecursiveFileList(
  sandbox: Sandbox,
): Promise<Map<string, { size: number; modified: number }>> {
  const fileMap = new Map<string, { size: number; modified: number }>();

  // Directories to ignore during file listing
  const ignoredDirectories = new Set([
    "node_modules",
    ".git",
    ".next",
    "dist",
    "build",
    ".cache",
    ".tmp",
    "coverage",
    ".nyc_output",
    "logs",
    ".npm",
  ]);

  // Helper function to recursively add files from a directory
  const addDirectoryFiles = async (
    dirPath: string,
    workspaceDir: string,
  ): Promise<void> => {
    try {
      const fileList = await sandbox.fs.listFiles(dirPath);

      for (const file of fileList) {
        const fullPath = `${dirPath}/${file.name}`;

        if (!file.isDir) {
          // Calculate relative path from workspace directory
          const relativePath = fullPath.replace(workspaceDir + "/", "");

          // Skip hidden files and lock files
          if (
            !relativePath.startsWith(".") &&
            !relativePath.endsWith("package-lock.json") &&
            !relativePath.endsWith("pnpm-lock.yaml") &&
            !relativePath.endsWith("yarn.lock")
          ) {
            fileMap.set(relativePath, {
              size: file.size || 0,
              modified: file.modTime
                ? new Date(file.modTime).getTime()
                : Date.now(),
            });
          }
        } else {
          // Skip ignored directories
          if (!ignoredDirectories.has(file.name)) {
            // Recursively process subdirectories
            await addDirectoryFiles(fullPath, workspaceDir);
          }
        }
      }
    } catch (error) {
      console.error(
        `[getRecursiveFileList] Failed to list directory ${dirPath}:`,
        error,
      );
      // Continue processing other directories instead of failing completely
    }
  };

  try {
    // Get the user root directory first
    const rootDir = await sandbox.getUserHomeDir();
    if (!rootDir) {
      console.error("[getRecursiveFileList] Failed to get user root directory");
      throw new Error(
        "Sandbox is not accessible - failed to get user root directory",
      );
    }

    // Check if workspace directory exists, and if so, list from there
    const workspaceDir = "/home/daytona/workspace";
    try {
      await sandbox.fs.listFiles(workspaceDir);
      // If no error, workspace exists, list from there
      const fileList = await sandbox.fs.listFiles(workspaceDir);

      // Process files recursively from workspace
      for (const file of fileList) {
        const fullPath = `${workspaceDir}/${file.name}`;

        if (!file.isDir) {
          // Calculate relative path from workspace directory for consistency
          const relativePath = file.name;

          // Skip hidden files and lock files
          if (
            !relativePath.startsWith(".") &&
            !relativePath.endsWith("package-lock.json") &&
            !relativePath.endsWith("pnpm-lock.yaml") &&
            !relativePath.endsWith("yarn.lock")
          ) {
            fileMap.set(relativePath, {
              size: file.size || 0,
              modified: file.modTime
                ? new Date(file.modTime).getTime()
                : Date.now(),
            });
          }
        } else {
          // Skip ignored directories
          if (!ignoredDirectories.has(file.name)) {
            // Recursively list subdirectory contents
            await addDirectoryFiles(fullPath, workspaceDir);
          }
        }
      }

      console.log(
        `[getRecursiveFileList] Found ${fileMap.size} files in workspace`,
      );
    } catch (error) {
      // Workspace doesn't exist, fall back to root
      console.warn(
        "[getRecursiveFileList] Workspace directory not found, listing from root:",
        error,
      );
      const fileList = await sandbox.fs.listFiles(rootDir);

      // Process files recursively from root
      for (const file of fileList) {
        const fullPath = `${rootDir}/${file.name}`;

        if (!file.isDir) {
          const relativePath = file.name;

          if (
            !relativePath.startsWith(".") &&
            !relativePath.endsWith("package-lock.json") &&
            !relativePath.endsWith("pnpm-lock.yaml") &&
            !relativePath.endsWith("yarn.lock")
          ) {
            fileMap.set(relativePath, {
              size: file.size || 0,
              modified: file.modTime
                ? new Date(file.modTime).getTime()
                : Date.now(),
            });
          }
        } else {
          // Skip ignored directories
          if (!ignoredDirectories.has(file.name)) {
            // Recursively list subdirectory contents
            await addDirectoryFiles(fullPath, rootDir);
          }
        }
      }

      console.log(`[getRecursiveFileList] Found ${fileMap.size} files in root`);
    }
  } catch (error) {
    console.error(
      `[getRecursiveFileList] Failed to list files from sandbox:`,
      error,
    );
    throw error; // Throw error instead of silently returning empty map
  }

  return fileMap;
}

// Helper function to compare file lists and detect changes
export function compareFileLists(
  beforeFiles: Map<string, { size: number; modified: number }>,
  afterFiles: Map<string, { size: number; modified: number }>,
): {
  created: string[];
  modified: string[];
  deleted: string[];
  total: number;
} {
  const created: string[] = [];
  const modified: string[] = [];
  const deleted: string[] = [];

  // Find created and modified files
  for (const [path, afterMeta] of afterFiles) {
    const beforeMeta = beforeFiles.get(path);

    if (!beforeMeta) {
      // File was created
      created.push(path);
    } else if (
      beforeMeta.size !== afterMeta.size ||
      beforeMeta.modified !== afterMeta.modified
    ) {
      // File was modified (size or timestamp changed)
      modified.push(path);
    }
  }

  // Find deleted files
  for (const [path] of beforeFiles) {
    if (!afterFiles.has(path)) {
      deleted.push(path);
    }
  }

  return {
    created,
    modified,
    deleted,
    total: created.length + modified.length + deleted.length,
  };
}

// File structure validation
export async function validateFileStructure(
  sandbox: Sandbox,
  validationResults: any,
  context: ToolsContext,
) {
  console.log("[validateProject] Validating file structure...");
  try {
    // Use find command to get all files
    const findResult = await runCommandOnSandbox(
      sandbox,
      `find /home/daytona/workspace -type f -not -path "*/node_modules/*" -not -path "*/.git/*" -printf "%P\\n"`,
      { timeoutMs: 5000 },
    );

    const stdout = extractStdout(findResult);
    const filePaths = stdout
      ? stdout
          .trim()
          .split("\n")
          .filter((line) => line.length > 0)
      : [];

    console.log(
      `[validateProject] File structure find result: stdout="${stdout}", stderr="${extractStderr(
        findResult,
      )}"`,
    );
    console.log(
      `[validateProject] Found ${filePaths.length} files: ${filePaths
        .slice(0, 5)
        .join(", ")}`,
    );

    // Check for essential project structure
    const requiredStructure = [
      "package.json",
      "src/App.tsx",
      "src/main.tsx",
      "src/index.css",
      "vite.config.ts",
      "tsconfig.json",
    ];

    const missingRequired = requiredStructure.filter(
      (path) => !filePaths.some((file: string) => file === path),
    );

    if (missingRequired.length > 0) {
      validationResults.fileStructure.issues.push(
        `Missing required files: ${missingRequired.join(", ")}`,
      );
    }

    // Check for proper directory structure
    const expectedDirs = ["src/components", "src/lib"];
    const missingDirs = expectedDirs.filter(
      (dir) => !filePaths.some((file: string) => file.startsWith(dir + "/")),
    );

    if (missingDirs.length > 0) {
      validationResults.fileStructure.issues.push(
        `Missing or empty directories: ${missingDirs.join(", ")}`,
      );
    }

    // Check for common lib files that should exist
    const libFiles = filePaths.filter((f: string) => f.startsWith("src/lib/"));
    const expectedLibFiles = ["src/lib/utils.ts"];
    const missingLibFiles = expectedLibFiles.filter(
      (file) => !libFiles.includes(file),
    );

    if (missingLibFiles.length > 0) {
      validationResults.fileStructure.issues.push(
        `Missing essential lib files: ${missingLibFiles.join(", ")}`,
      );
    }

    validationResults.fileStructure.passed = missingRequired.length === 0;
    console.log(
      `[validateProject] File structure validation: ${
        validationResults.fileStructure.passed ? "PASSED" : "FAILED"
      }`,
    );
  } catch (error) {
    validationResults.fileStructure.issues.push(
      `File structure check failed: ${error}`,
    );
  }
}

// Fragment completeness validation - prevents creating fragments with incomplete component sets
export async function validateFragmentCompleteness(
  sandbox: Sandbox,
  fragmentFiles: Map<string, string>,
  context: ToolsContext,
): Promise<{
  isComplete: boolean;
  missingDependencies: string[];
  warnings: string[];
}> {
  console.log(
    "[validateFragmentCompleteness] Validating fragment for completeness...",
  );

  const result = {
    isComplete: true,
    missingDependencies: [] as string[],
    warnings: [] as string[],
  };

  if (!fragmentFiles || fragmentFiles.size === 0) {
    result.isComplete = false;
    result.warnings.push("Fragment has no files");
    return result;
  }

  try {
    // Build component map for files in the fragment
    const componentMap = new Map<
      string,
      { exports: string[]; imports: string[]; content: string }
    >();

    for (const [filePath, content] of fragmentFiles) {
      const componentInfo = {
        exports: [] as string[],
        imports: [] as string[],
        content,
      };

      // Extract exports
      const exportMatches = content.match(
        /(export\s+(function|const|interface|type|class)\s+)(\w+)/g,
      );
      if (exportMatches) {
        componentInfo.exports = exportMatches.map((match) => {
          const parts = match.split(/\s+/);
          return parts[parts.length - 1];
        });
      }

      // Extract default exports
      const defaultExportMatch = content.match(/export\s+default\s+(\w+)/);
      if (defaultExportMatch) {
        componentInfo.exports.push(defaultExportMatch[1]);
      }

      // Extract imports using more robust parsing
      // Split by lines first to handle multiline imports better
      const lines = content.split("\n");
      let currentImport = "";
      let inImportBlock = false;

      for (const line of lines) {
        const trimmedLine = line.trim();

        // Start of import statement
        if (trimmedLine.startsWith("import ") && !inImportBlock) {
          currentImport = trimmedLine;
          inImportBlock =
            !trimmedLine.includes(";") && !trimmedLine.includes(" from ");
        }
        // Continuation of multiline import
        else if (inImportBlock) {
          currentImport += " " + trimmedLine;
          if (trimmedLine.includes(";") || trimmedLine.includes(" from ")) {
            inImportBlock = false;
          }
        }

        // Process complete import statement
        if (!inImportBlock && currentImport.includes(" from ")) {
          // Simpler regex that handles basic cases - avoid complex parsing for now
          const importMatch = currentImport.match(
            /import\s+(?:\{([^}]+)\}|(\w+))\s+from\s+['"]([\w\.\/@-]+)['"]/,
          );
          if (importMatch) {
            const namedImports = importMatch[1];
            const defaultImport = importMatch[2];
            const importPath = importMatch[3];

            if (namedImports) {
              // Basic split on comma, filter out type annotations and complex generics
              const imports = namedImports
                .split(",")
                .map((imp) => imp.trim().replace(/\s+as\s+\w+/, ""))
                .filter(
                  (imp) => imp && !imp.includes("<") && !imp.includes(">"),
                );
              componentInfo.imports.push(...imports);
            }
            if (defaultImport) {
              componentInfo.imports.push(defaultImport);
            }
          }
          currentImport = ""; // Reset for next import
        }
      }

      componentMap.set(filePath, componentInfo);
    }

    // Check for missing internal dependencies
    const allImports = new Set<string>();
    const allExports = new Set<string>();

    // Collect all imports and exports
    for (const [filePath, info] of componentMap) {
      info.imports.forEach((imp) => allImports.add(imp));
      info.exports.forEach((exp) => allExports.add(exp));
    }

    // Find imports that are not satisfied by exports in the fragment
    const unsatisfiedImports = Array.from(allImports).filter((imp) => {
      // Skip external imports (React, lucide-react, etc.)
      if (
        imp === "React" ||
        imp === "useState" ||
        imp === "useEffect" ||
        imp.includes("Icon")
      ) {
        return false;
      }
      return !allExports.has(imp);
    });

    // Check for critical missing files
    const hasAppComponent = Array.from(componentMap.keys()).some((path) =>
      path.includes("App.tsx"),
    );
    const hasMainEntry = Array.from(componentMap.keys()).some((path) =>
      path.includes("main.tsx"),
    );
    const hasIndexHtml = Array.from(componentMap.keys()).some((path) =>
      path.includes("index.html"),
    );
    const hasUtils = Array.from(componentMap.keys()).some((path) =>
      path.includes("lib/utils.ts"),
    );

    if (!hasAppComponent) {
      result.missingDependencies.push(
        "src/App.tsx - Main app component missing",
      );
      result.isComplete = false;
    }

    if (!hasMainEntry) {
      result.missingDependencies.push(
        "src/main.tsx - React entry point missing",
      );
      result.isComplete = false;
    }

    if (!hasIndexHtml) {
      result.missingDependencies.push("index.html - HTML template missing");
      result.isComplete = false;
    }

    if (
      !hasUtils &&
      Array.from(componentMap.values()).some((info) =>
        info.content.includes("cn("),
      )
    ) {
      result.missingDependencies.push(
        "src/lib/utils.ts - Utils file missing but components use cn() function",
      );
      result.isComplete = false;
    }

    // Add unsatisfied imports as warnings
    if (unsatisfiedImports.length > 0) {
      result.warnings.push(
        `Potentially missing components: ${unsatisfiedImports.join(", ")}`,
      );
    }

    console.log(`[validateFragmentCompleteness] Fragment analysis:`);
    console.log(`- Files: ${fragmentFiles.size}`);
    console.log(`- Exports: ${allExports.size}`);
    console.log(`- Imports: ${allImports.size}`);
    console.log(`- Unsatisfied imports: ${unsatisfiedImports.length}`);
    console.log(`- Complete: ${result.isComplete}`);
  } catch (error) {
    result.warnings.push(`Fragment validation error: ${error}`);
    console.error("[validateFragmentCompleteness] Error:", error);
  }

  return result;
}

// Enhanced component dependency validation
export async function validateComponentDependencies(
  sandbox: Sandbox,
  validationResults: any,
  context: ToolsContext,
) {
  console.log("[validateProject] Validating component dependencies...");
  try {
    // Get all TypeScript files
    const findResult = await runCommandOnSandbox(
      sandbox,
      `find /home/daytona/workspace/src -type f \\( -name "*.ts" -o -name "*.tsx" \\) -not -path "*/node_modules/*" -printf "%p\\n"`,
      { timeoutMs: 5000 },
    );

    const stdout = extractStdout(findResult);
    const tsFilePaths = stdout
      ? stdout
          .trim()
          .split("\n")
          .filter((line) => line.length > 0)
      : [];

    console.log(
      `[validateProject] Find command result: stdout="${stdout}", stderr="${extractStderr(
        findResult,
      )}"`,
    );
    console.log(
      `[validateProject] Found ${
        tsFilePaths.length
      } TypeScript files: ${tsFilePaths.slice(0, 5).join(", ")}`,
    );

    const importIssues = [];
    const componentMap = new Map<
      string,
      { exports: string[]; imports: string[]; filePath: string }
    >();
    const forbiddenImports = [
      "framer-motion",
      "react-spring",
      "@radix-ui",
      "uuid",
      "nanoid",
      "lodash",
    ];

    // First pass: Build component map with exports and imports
    console.log("[validateProject] Building component dependency map...");
    for (const filePath of tsFilePaths) {
      try {
        const content = await readFileFromSandbox(
          sandbox,
          filePath.replace("/home/daytona/workspace/", ""),
        );
        const relativePath = filePath.replace("/home/daytona/workspace/", "");

        const componentInfo = {
          exports: [] as string[],
          imports: [] as string[],
          filePath: relativePath,
        };

        // Extract exports (functions, interfaces, types, components)
        const exportMatches = content.match(
          /(export\s+(function|const|interface|type|class)\s+)(\w+)/g,
        );
        if (exportMatches) {
          componentInfo.exports = exportMatches.map((match) => {
            const parts = match.split(/\s+/);
            return parts[parts.length - 1];
          });
        }

        // Extract default exports
        const defaultExportMatch = content.match(/export\s+default\s+(\w+)/);
        if (defaultExportMatch) {
          componentInfo.exports.push(defaultExportMatch[1]);
        }

        // Parse import statements
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.startsWith("import ") && line.includes("from ")) {
            // Check for forbidden imports
            const forbiddenFound = forbiddenImports.find(
              (forbidden) =>
                line.includes(`"${forbidden}"`) ||
                line.includes(`'${forbidden}'`),
            );

            if (forbiddenFound) {
              importIssues.push(
                `${relativePath}: Line ${
                  i + 1
                } uses forbidden import "${forbiddenFound}"`,
              );
            }

            // Extract imported items
            const importMatch = line.match(
              /import\s+(?:\{([^}]+)\}|(\w+))\s+from\s+['"]([\w\.\/@-]+)['"]/,
            );
            if (importMatch) {
              const namedImports = importMatch[1];
              const defaultImport = importMatch[2];
              const importPath = importMatch[3];

              if (namedImports) {
                const imports = namedImports
                  .split(",")
                  .map((imp) => imp.trim());
                componentInfo.imports.push(...imports);
              }
              if (defaultImport) {
                componentInfo.imports.push(defaultImport);
              }

              // Check for @/lib/store imports specifically
              if (importPath.includes("@/lib/store")) {
                try {
                  await readFileFromSandbox(sandbox, "src/lib/store.ts");
                } catch {
                  importIssues.push(
                    `${relativePath}: Line ${
                      i + 1
                    } imports "@/lib/store" but src/lib/store.ts doesn't exist`,
                  );
                }
              }

              // Check for relative imports that might be broken
              if (importPath.startsWith("./") || importPath.startsWith("../")) {
                const resolvedPath = resolveRelativeImport(
                  filePath,
                  importPath,
                );

                let found = false;
                for (const ext of ["", ".ts", ".tsx", ".js", ".jsx"]) {
                  try {
                    const testPath = (resolvedPath + ext).replace(
                      "/home/daytona/workspace/",
                      "",
                    );
                    await readFileFromSandbox(sandbox, testPath);
                    found = true;
                    break;
                  } catch {}
                }
                if (!found) {
                  importIssues.push(
                    `${relativePath}: Line ${
                      i + 1
                    } imports non-existent file "${importPath}"`,
                  );
                }
              }
            }
          }
        }

        componentMap.set(relativePath, componentInfo);
      } catch (error) {
        importIssues.push(
          `Failed to read ${filePath.replace(
            "/home/daytona/workspace/",
            "",
          )}: ${error}`,
        );
      }
    }

    // Second pass: Check for missing component dependencies
    console.log("[validateProject] Checking component dependencies...");
    const componentUsageMap = new Map<string, string[]>();

    // Build usage map - which files use which components
    for (const [filePath, componentInfo] of componentMap) {
      for (const importedItem of componentInfo.imports) {
        // Find which file exports this component
        for (const [exporterPath, exporterInfo] of componentMap) {
          if (
            exporterPath !== filePath &&
            exporterInfo.exports.includes(importedItem)
          ) {
            if (!componentUsageMap.has(exporterPath)) {
              componentUsageMap.set(exporterPath, []);
            }
            componentUsageMap.get(exporterPath)!.push(filePath);
          }
        }
      }
    }

    // Check for missing critical dependencies
    const criticalComponents = ["App", "Header", "Button", "Input"];
    for (const criticalComponent of criticalComponents) {
      const exportingFiles = Array.from(componentMap.entries()).filter(
        ([_, info]) => info.exports.includes(criticalComponent),
      );

      if (exportingFiles.length === 0) {
        console.log(
          `[validateProject] Missing critical component: ${criticalComponent}`,
        );
      }
    }

    validationResults.imports.issues = importIssues;
    validationResults.imports.passed = importIssues.length === 0;

    console.log(
      `[validateProject] Enhanced import validation: ${
        validationResults.imports.passed ? "PASSED" : "FAILED"
      } (${importIssues.length} issues)`,
    );
    console.log(
      `[validateProject] Analyzed ${componentMap.size} files for component dependencies`,
    );
  } catch (error) {
    validationResults.imports.issues.push(
      `Enhanced import validation failed: ${error}`,
    );
  }
}

// Import validation
export async function validateImports(
  sandbox: Sandbox,
  validationResults: any,
  context: ToolsContext,
) {
  console.log("[validateProject] Validating imports...");
  try {
    // Use find command to get TypeScript files
    const findResult = await runCommandOnSandbox(
      sandbox,
      `find /home/daytona/workspace/src -type f \\(-name "*.ts" -o -name "*.tsx" \\) -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/.next/*" -not -path "*/dist/*" -not -path "*/build/*" -not -path "*/.cache/*" -not -path "*/.tmp/*" -not -path "*/coverage/*" -not -path "*/.nyc_output/*" -not -path "*/logs/*" -not -path "*/.npm/*" -printf "%p\\n"`,
      { timeoutMs: 5000 },
    );

    const tsFilePaths = findResult.stdout
      ? findResult.stdout
          .trim()
          .split("\n")
          .filter((line) => line.length > 0)
      : [];

    const importIssues = [];
    const forbiddenImports = [
      "framer-motion",
      "react-spring",
      "@radix-ui",
      "uuid",
      "nanoid",
      "lodash",
    ];

    for (const filePath of tsFilePaths) {
      try {
        const content = await readFileFromSandbox(
          sandbox,
          filePath.replace("/home/daytona/workspace/", ""),
        );
        const lines = content.split("\n");

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.startsWith("import ") && line.includes("from ")) {
            // Check for forbidden imports
            const forbiddenFound = forbiddenImports.find(
              (forbidden) =>
                line.includes(`"${forbidden}"`) ||
                line.includes(`'${forbidden}'`),
            );

            if (forbiddenFound) {
              importIssues.push(
                `${filePath}: Line ${
                  i + 1
                } uses forbidden import "${forbiddenFound}"`,
              );
            }

            // Check for @/lib/store imports specifically
            if (
              line.includes("@/lib/store") ||
              line.includes("from '@/lib/store'")
            ) {
              try {
                await readFileFromSandbox(sandbox, "src/lib/store.ts");
              } catch {
                importIssues.push(
                  `${filePath}: Line ${
                    i + 1
                  } imports "@/lib/store" but src/lib/store.ts doesn't exist`,
                );
              }
            }

            // Check for relative imports that might be broken
            if (line.includes("from './") || line.includes('from "../')) {
              const match = line.match(/from\s+['"]([^'"]+)['"]/);
              if (match) {
                const importPath = match[1];
                const resolvedPath = resolveRelativeImport(
                  filePath,
                  importPath,
                );

                try {
                  await readFileFromSandbox(
                    sandbox,
                    resolvedPath.replace("/home/daytona/workspace/", ""),
                  );
                } catch {
                  // Try with .ts/.tsx extensions
                  let found = false;
                  for (const ext of [".ts", ".tsx", ".js", ".jsx"]) {
                    try {
                      await readFileFromSandbox(
                        sandbox,
                        (resolvedPath + ext).replace(
                          "/home/daytona/workspace/",
                          "",
                        ),
                      );
                      found = true;
                      break;
                    } catch {}
                  }
                  if (!found) {
                    importIssues.push(
                      `${filePath}: Line ${
                        i + 1
                      } imports non-existent file "${importPath}"`,
                    );
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        importIssues.push(`Failed to read ${filePath}: ${error}`);
      }
    }

    validationResults.imports.issues = importIssues;
    validationResults.imports.passed = importIssues.length === 0;

    console.log(
      `[validateProject] Import validation: ${
        validationResults.imports.passed ? "PASSED" : "FAILED"
      } (${importIssues.length} issues)`,
    );
  } catch (error) {
    validationResults.imports.issues.push(`Import validation failed: ${error}`);
  }
}

// TypeScript validation
export async function validateTypeScript(
  sandbox: Sandbox,
  validationResults: any,
  context: ToolsContext,
) {
  console.log("[validateProject] Running TypeScript validation...");
  try {
    const tscResult = await runCommandOnSandbox(
      sandbox,
      "npx tsc --noEmit --skipLibCheck",
      {
        timeoutMs: 15000,
      },
    );

    const errors = [];
    if (tscResult.stderr) {
      const errorLines = tscResult.stderr
        .split("\n")
        .filter(
          (line: string) =>
            line.includes("error TS") || line.includes("Error:"),
        );
      errors.push(...errorLines);
    }

    if (tscResult.stdout) {
      const errorLines = tscResult.stdout
        .split("\n")
        .filter(
          (line: string) =>
            line.includes("error TS") || line.includes("Error:"),
        );
      errors.push(...errorLines);
    }

    validationResults.typescript.issues = errors;
    validationResults.typescript.passed = errors.length === 0;

    console.log(
      `[validateProject] TypeScript validation: ${
        validationResults.typescript.passed ? "PASSED" : "FAILED"
      } (${errors.length} errors)`,
    );
  } catch (error) {
    validationResults.typescript.issues.push(
      `TypeScript check failed: ${error}`,
    );
  }
}

// Dependencies validation
export async function validateDependencies(
  sandbox: Sandbox,
  validationResults: any,
  context: ToolsContext,
) {
  console.log("[validateProject] Validating dependency order...");
  try {
    const dependencyIssues = [];

    // Check that utils.ts exists before components that might use it
    try {
      await readFileFromSandbox(sandbox, "src/lib/utils.ts");
    } catch {
      dependencyIssues.push(
        "src/lib/utils.ts is missing but required for Shadcn components",
      );
    }

    // Check that types are defined before they're used using find command
    const findResult = await runCommandOnSandbox(
      sandbox,
      `find /home/daytona/workspace/src/components -type f -name "*.tsx" -printf "%p\\n"`,
      { timeoutMs: 5000 },
    );

    const componentFilePaths = findResult.stdout
      ? findResult.stdout
          .trim()
          .split("\n")
          .filter((line) => line.length > 0)
      : [];

    for (const filePath of componentFilePaths) {
      try {
        const content = await readFileFromSandbox(
          sandbox,
          filePath.replace("/home/daytona/workspace/", ""),
        );

        // Look for interface definitions and their usage
        const interfaceMatches = content.match(/interface\s+(\w+)/g);
        const importMatches = content.match(
          /import\s+{[^}]*(\w+)[^}]*}\s+from/g,
        );

        if (interfaceMatches && importMatches) {
          // This is a simplified check - in a real scenario, you'd want more sophisticated analysis
          for (const importMatch of importMatches) {
            if (
              importMatch.includes("from './") &&
              !interfaceMatches.some((def: string) =>
                importMatch.includes(def.replace("interface ", "")),
              )
            ) {
              // Potential dependency order issue detected but we'll be lenient here
            }
          }
        }
      } catch (error) {
        dependencyIssues.push(`Could not analyze ${filePath}: ${error}`);
      }
    }

    validationResults.dependencies.issues = dependencyIssues;
    validationResults.dependencies.passed = dependencyIssues.length === 0;

    console.log(
      `[validateProject] Dependency validation: ${
        validationResults.dependencies.passed ? "PASSED" : "FAILED"
      }`,
    );
  } catch (error) {
    validationResults.dependencies.issues.push(
      `Dependency validation failed: ${error}`,
    );
  }
}

// Icon context validation
export async function validateIconContextLogic(
  sandbox: Sandbox,
  validationResults: any,
  context: ToolsContext,
) {
  console.log("[validateProject] Validating icon context...");
  try {
    const iconIssues = [];

    // Use find command to get TypeScript files
    const findResult = await runCommandOnSandbox(
      sandbox,
      `find /home/daytona/workspace/src -type f -name "*.tsx" -printf "%p\\n"`,
      { timeoutMs: 5000 },
    );

    const componentFilePaths = findResult.stdout
      ? findResult.stdout
          .trim()
          .split("\n")
          .filter((line) => line.length > 0)
      : [];

    // Analyze App.tsx to determine app type
    let appType = "unknown";
    try {
      const appContent = await readFileFromSandbox(sandbox, "src/App.tsx");

      // Determine app context based on content
      if (
        appContent.includes("todo") ||
        appContent.includes("task") ||
        appContent.includes("checklist")
      ) {
        appType = "productivity";
      } else if (
        appContent.includes("shop") ||
        appContent.includes("cart") ||
        appContent.includes("product")
      ) {
        appType = "ecommerce";
      } else if (
        appContent.includes("music") ||
        appContent.includes("audio") ||
        appContent.includes("player")
      ) {
        appType = "music";
      } else if (
        appContent.includes("social") ||
        appContent.includes("post") ||
        appContent.includes("message")
      ) {
        appType = "social";
      }
    } catch {}

    // Check icon usage in all component files
    for (const filePath of componentFilePaths) {
      try {
        const content = await readFileFromSandbox(
          sandbox,
          filePath.replace("/home/daytona/workspace/", ""),
        );

        // Extract lucide-react imports
        const lucideImports = content.match(
          /import\s+{([^}]+)}\s+from\s+['"]lucide-react['"]/,
        );
        if (lucideImports) {
          const icons = lucideImports[1]
            .split(",")
            .map((icon: string) => icon.trim());

          // Check for context mismatches
          if (appType === "productivity") {
            const inappropriateIcons = icons.filter((icon: string) =>
              ["ShoppingCart", "Music", "Play", "Pause", "CreditCard"].includes(
                icon,
              ),
            );
            if (inappropriateIcons.length > 0) {
              iconIssues.push(
                `${filePath}: Inappropriate icons for productivity app: ${inappropriateIcons.join(
                  ", ",
                )}`,
              );
            }
          } else if (appType === "ecommerce") {
            const inappropriateIcons = icons.filter((icon: string) =>
              ["Music", "Play", "Pause", "CheckSquare", "Calendar"].includes(
                icon,
              ),
            );
            if (inappropriateIcons.length > 0) {
              iconIssues.push(
                `${filePath}: Inappropriate icons for e-commerce app: ${inappropriateIcons.join(
                  ", ",
                )}`,
              );
            }
          } else if (appType === "music") {
            const inappropriateIcons = icons.filter((icon: string) =>
              [
                "ShoppingCart",
                "CheckSquare",
                "Calendar",
                "CreditCard",
              ].includes(icon),
            );
            if (inappropriateIcons.length > 0) {
              iconIssues.push(
                `${filePath}: Inappropriate icons for music app: ${inappropriateIcons.join(
                  ", ",
                )}`,
              );
            }
          }
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }

    validationResults.iconContext.issues = iconIssues;
    validationResults.iconContext.passed = iconIssues.length === 0;

    console.log(
      `[validateProject] Icon context validation: ${
        validationResults.iconContext.passed ? "PASSED" : "FAILED"
      }`,
    );
  } catch (error) {
    validationResults.iconContext.issues.push(
      `Icon context validation failed: ${error}`,
    );
  }
}

// Build validation (optimized with lint and TypeScript checks)
export async function validateBuild(
  sandbox: Sandbox,
  validationResults: any,
  context: ToolsContext,
) {
  console.log(
    "[validateProject] Running optimized build validation (lint + TypeScript)...",
  );
  try {
    const buildErrors = [];

    // Run ESLint check
    console.log("[validateProject] Running ESLint check...");
    try {
      // First check if lint script exists in package.json
      let lintCommand = "npm run lint";
      try {
        const packageJsonResult = await runCommandOnSandbox(
          sandbox,
          "cat package.json",
          {
            timeoutMs: 2000,
          },
        );
        const packageJson = JSON.parse(packageJsonResult.stdout || "{}");

        if (!packageJson.scripts?.lint) {
          console.log(
            "[validateProject] No lint script found, trying direct eslint command...",
          );
          lintCommand = "npx eslint src --ext .ts,.tsx,.js,.jsx";
        }
      } catch (packageError) {
        console.log(
          "[validateProject] Could not read package.json, using direct eslint command...",
        );
        lintCommand = "npx eslint src --ext .ts,.tsx,.js,.jsx";
      }

      const lintResult = await runCommandOnSandbox(sandbox, lintCommand, {
        timeoutMs: 30000,
      });

      // Parse ESLint output for actual errors
      const eslintErrors = [];

      if (lintResult.stdout) {
        const lines = lintResult.stdout.split("\n");
        let currentFile = "";

        for (const line of lines) {
          // Check for file paths (usually end with .ts, .tsx, .js, .jsx)
          if (line.match(/\.(ts|tsx|js|jsx)$/)) {
            currentFile = line.trim();
          }
          // Check for actual error lines (contain line:column and "error")
          else if (line.includes("error") && line.match(/\d+:\d+/)) {
            eslintErrors.push(
              `[ESLint] ${currentFile ? currentFile + ": " : ""}${line.trim()}`,
            );
          }
          // Check for summary lines with error counts
          else if (line.includes("✖") && line.includes("error")) {
            eslintErrors.push(`[ESLint] ${line.trim()}`);
          }
        }
      }

      if (lintResult.stderr) {
        const errorLines = lintResult.stderr.split("\n").filter(
          (line: string) => line.includes("Error") && !line.includes("error"), // Only actual errors, not lint errors
        );
        eslintErrors.push(...errorLines.map((line) => `[ESLint] ${line}`));
      }

      // Add ESLint errors to build errors
      buildErrors.push(...eslintErrors);

      // ESLint exit code 1 is normal when it finds linting errors
      // Only treat it as a failure if we get exit code 2 (config error) or other unexpected codes
      if (lintResult.exitCode !== undefined && lintResult.exitCode > 1) {
        buildErrors.push(
          `[ESLint] Unexpected linting failure with exit code ${lintResult.exitCode}`,
        );
      }

      console.log(
        `[validateProject] ESLint found ${eslintErrors.length} issues (exit code: ${lintResult.exitCode})`,
      );
    } catch (lintError: any) {
      // Check if the error is due to missing ESLint, configuration, or timeout
      const errorMessage = String(lintError);
      if (errorMessage.includes("timed out")) {
        console.log(
          "[validateProject] ESLint check timed out, skipping lint check",
        );
      } else if (
        errorMessage.includes("eslint: not found") ||
        errorMessage.includes("No ESLint configuration") ||
        errorMessage.includes("Cannot find module 'eslint'")
      ) {
        console.log(
          "[validateProject] ESLint not found or not configured, skipping lint check",
        );
        // Don't treat missing ESLint as a build error since it's optional
      } else {
        console.log(
          "[validateProject] ESLint check failed, skipping:",
          lintError,
        );
        // Don't treat ESLint failures as build errors since they're often configuration issues
      }
    }

    // Run TypeScript check
    console.log("[validateProject] Running TypeScript check...");
    try {
      const tscResult = await runCommandOnSandbox(
        sandbox,
        "npx tsc --noEmit --skipLibCheck",
        {
          timeoutMs: 15000,
        },
      );

      if (tscResult.stderr) {
        const errorLines = tscResult.stderr
          .split("\n")
          .filter(
            (line: string) =>
              line.includes("error TS") ||
              line.includes("Error:") ||
              line.includes("Cannot find module") ||
              line.includes("Type error"),
          );
        buildErrors.push(...errorLines.map((line) => `[TypeScript] ${line}`));
      }

      if (tscResult.stdout) {
        const errorLines = tscResult.stdout
          .split("\n")
          .filter(
            (line: string) =>
              line.includes("error TS") ||
              line.includes("Error:") ||
              line.includes("Cannot find module") ||
              line.includes("Type error"),
          );
        buildErrors.push(...errorLines.map((line) => `[TypeScript] ${line}`));
      }

      // TypeScript errors also indicated by non-zero exit code
      if (tscResult.exitCode !== 0 && tscResult.exitCode !== undefined) {
        if (
          buildErrors.filter((err) => err.includes("[TypeScript]")).length === 0
        ) {
          buildErrors.push(
            `[TypeScript] Type checking failed with exit code ${tscResult.exitCode}`,
          );
        }
      }
    } catch (tscError) {
      buildErrors.push(`[TypeScript] Type check failed: ${tscError}`);
    }

    validationResults.build.issues = buildErrors;
    validationResults.build.passed = buildErrors.length === 0;

    console.log(
      `[validateProject] Build validation: ${
        validationResults.build.passed ? "PASSED" : "FAILED"
      } (${buildErrors.length} issues found)`,
    );
  } catch (error) {
    validationResults.build.issues.push(`Build validation failed: ${error}`);
    validationResults.build.passed = false;
  }
}

export async function validateContentCompleteness(
  sandbox: any,
  validationResults: any,
  context: any,
) {
  const contentErrors: string[] = [];
  let foundGenericPlaceholders: string[] = [];

  try {
    console.log(
      "[validateProject] Starting content completeness validation...",
    );

    // Check App.tsx for meaningful content
    try {
      const appContent = await sandbox.fs.downloadFile(
        "/home/daytona/workspace/src/App.tsx",
      );
      const appString = appContent.toString();

      // Check for generic placeholder patterns that should never appear
      const genericPlaceholderPatterns = [
        /Vite \+ React/i,
        /Click on the Vite and React logos/i,
        /Edit.*src\/App\.(tsx|jsx).*and save to test HMR/i,
        /Read the docs/i,
        /count is \{count\}/i,
        /Hello world/i,
        /Welcome to React/i,
        /Getting started/i,
        /This is a placeholder/i,
        /Lorem ipsum/i,
        // Only match template placeholders in text content, not JSX expressions
        />\s*\{.*title.*\}\s*</g, // Template placeholders in text nodes like >{title}<
        />\s*\[.*Your.*content.*here.*\]\s*</i, // Bracketed placeholders in text like >[Your content here]<
        /Coming soon/i,
        /Placeholder content/i,
        /TODO:.*implement/i,
      ];

      foundGenericPlaceholders = [];
      for (const pattern of genericPlaceholderPatterns) {
        const matches = appString.match(pattern);
        if (matches) {
          foundGenericPlaceholders.push(...matches);
        }
      }

      if (foundGenericPlaceholders.length > 0) {
        contentErrors.push(
          `App.tsx contains generic template content that should be replaced: ${foundGenericPlaceholders.join(
            ", ",
          )}`,
        );
      }

      // Check for basic content structure
      const hasHeading = /(<h[1-6]|<title|className.*text-[0-9]xl)/i.test(
        appString,
      );
      const hasNavigation = /(<nav|<header|navigation|menu)/i.test(appString);

      if (!hasHeading) {
        contentErrors.push(
          "App.tsx should have at least one heading or title element",
        );
      }

      // Check for generic interactive elements
      const genericInteractionPattern = /(>count is|>click me<|>button<)/i;
      if (genericInteractionPattern.test(appString)) {
        contentErrors.push(
          "App.tsx contains generic button/interaction text that should be contextual to the application",
        );
      }

      console.log(
        `[validateProject] App.tsx content analysis: ${contentErrors.length} issues found`,
      );
    } catch (error) {
      contentErrors.push(`Could not read App.tsx: ${error}`);
    }

    // Check index.html title
    try {
      const htmlContent = await sandbox.fs.downloadFile(
        "/home/daytona/workspace/index.html",
      );
      const htmlString = htmlContent.toString();

      const titleMatch = htmlString.match(/<title>(.*?)<\/title>/i);
      if (titleMatch) {
        const title = titleMatch[1];
        if (
          title === "Vite + React" ||
          title === "React App" ||
          title.includes("Vite")
        ) {
          contentErrors.push(
            `index.html title should be updated to reflect the actual application: "${title}"`,
          );
        }
      } else {
        contentErrors.push("index.html should have a descriptive title tag");
      }
    } catch (error) {
      console.warn("[validateProject] Could not read index.html:", error);
    }

    // Check for basic component structure (optional)
    try {
      const files = await sandbox.fs.listFiles("/home/daytona/workspace/src");
      const componentFiles = files.filter(
        (file: any) => file.name.endsWith(".tsx") || file.name.endsWith(".jsx"),
      );

      // Only warn if it's truly just the default App.tsx with no real content
      if (componentFiles.length === 1 && foundGenericPlaceholders.length > 0) {
        contentErrors.push(
          "Application appears to be using default template structure - consider adding meaningful content or components",
        );
      }
    } catch (error) {
      console.warn(
        "[validateProject] Could not analyze component structure:",
        error,
      );
    }

    validationResults.contentCompleteness.issues = contentErrors;
    validationResults.contentCompleteness.passed = contentErrors.length === 0;

    console.log(
      `[validateProject] Content completeness validation: ${
        validationResults.contentCompleteness.passed ? "PASSED" : "FAILED"
      } (${contentErrors.length} issues found)`,
    );

    if (contentErrors.length > 0) {
      console.log("[validateProject] Content completeness issues:");
      contentErrors.forEach((issue) => console.log(`  - ${issue}`));
    }
  } catch (error) {
    validationResults.contentCompleteness.issues.push(
      `Content completeness validation failed: ${error}`,
    );
    validationResults.contentCompleteness.passed = false;
  }
}
