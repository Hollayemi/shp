import { createRequire } from 'module';const require = createRequire(import.meta.url);
import {
  readFileFromSandbox,
  runCommandOnSandbox
} from "./chunk-Q73ELRDT.js";
import "./chunk-IDZAZ4YU.js";
import "./chunk-TIBZDRCE.js";
import "./chunk-YMWDDMLV.js";
import {
  init_esm_shims
} from "./chunk-IXOW5DJO.js";

// src/services/validation-utils.ts
init_esm_shims();
function extractStdout(result) {
  return result.stdout || result.result || result.output || "";
}
function extractStderr(result) {
  return result.stderr || "";
}
function resolveRelativeImport(fromFile, importPath) {
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
async function getRecursiveFileList(sandbox) {
  const fileMap = /* @__PURE__ */ new Map();
  const ignoredDirectories = /* @__PURE__ */ new Set([
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
    ".npm"
  ]);
  const addDirectoryFiles = async (dirPath, workspaceDir) => {
    try {
      const fileList = await sandbox.fs.listFiles(dirPath);
      for (const file of fileList) {
        const fullPath = `${dirPath}/${file.name}`;
        if (!file.isDir) {
          const relativePath = fullPath.replace(workspaceDir + "/", "");
          if (!relativePath.startsWith(".") && !relativePath.endsWith("package-lock.json") && !relativePath.endsWith("pnpm-lock.yaml") && !relativePath.endsWith("yarn.lock")) {
            fileMap.set(relativePath, {
              size: file.size || 0,
              modified: file.modTime ? new Date(file.modTime).getTime() : Date.now()
            });
          }
        } else {
          if (!ignoredDirectories.has(file.name)) {
            await addDirectoryFiles(fullPath, workspaceDir);
          }
        }
      }
    } catch (error) {
      console.error(
        `[getRecursiveFileList] Failed to list directory ${dirPath}:`,
        error
      );
    }
  };
  try {
    const rootDir = await sandbox.getUserHomeDir();
    if (!rootDir) {
      console.error("[getRecursiveFileList] Failed to get user root directory");
      throw new Error(
        "Sandbox is not accessible - failed to get user root directory"
      );
    }
    const workspaceDir = "/home/daytona/workspace";
    try {
      await sandbox.fs.listFiles(workspaceDir);
      const fileList = await sandbox.fs.listFiles(workspaceDir);
      for (const file of fileList) {
        const fullPath = `${workspaceDir}/${file.name}`;
        if (!file.isDir) {
          const relativePath = file.name;
          if (!relativePath.startsWith(".") && !relativePath.endsWith("package-lock.json") && !relativePath.endsWith("pnpm-lock.yaml") && !relativePath.endsWith("yarn.lock")) {
            fileMap.set(relativePath, {
              size: file.size || 0,
              modified: file.modTime ? new Date(file.modTime).getTime() : Date.now()
            });
          }
        } else {
          if (!ignoredDirectories.has(file.name)) {
            await addDirectoryFiles(fullPath, workspaceDir);
          }
        }
      }
      console.log(
        `[getRecursiveFileList] Found ${fileMap.size} files in workspace`
      );
    } catch (error) {
      console.warn(
        "[getRecursiveFileList] Workspace directory not found, listing from root:",
        error
      );
      const fileList = await sandbox.fs.listFiles(rootDir);
      for (const file of fileList) {
        const fullPath = `${rootDir}/${file.name}`;
        if (!file.isDir) {
          const relativePath = file.name;
          if (!relativePath.startsWith(".") && !relativePath.endsWith("package-lock.json") && !relativePath.endsWith("pnpm-lock.yaml") && !relativePath.endsWith("yarn.lock")) {
            fileMap.set(relativePath, {
              size: file.size || 0,
              modified: file.modTime ? new Date(file.modTime).getTime() : Date.now()
            });
          }
        } else {
          if (!ignoredDirectories.has(file.name)) {
            await addDirectoryFiles(fullPath, rootDir);
          }
        }
      }
      console.log(`[getRecursiveFileList] Found ${fileMap.size} files in root`);
    }
  } catch (error) {
    console.error(
      `[getRecursiveFileList] Failed to list files from sandbox:`,
      error
    );
    throw error;
  }
  return fileMap;
}
function compareFileLists(beforeFiles, afterFiles) {
  const created = [];
  const modified = [];
  const deleted = [];
  for (const [path, afterMeta] of afterFiles) {
    const beforeMeta = beforeFiles.get(path);
    if (!beforeMeta) {
      created.push(path);
    } else if (beforeMeta.size !== afterMeta.size || beforeMeta.modified !== afterMeta.modified) {
      modified.push(path);
    }
  }
  for (const [path] of beforeFiles) {
    if (!afterFiles.has(path)) {
      deleted.push(path);
    }
  }
  return {
    created,
    modified,
    deleted,
    total: created.length + modified.length + deleted.length
  };
}
async function validateFileStructure(sandbox, validationResults, context) {
  console.log("[validateProject] Validating file structure...");
  try {
    const findResult = await runCommandOnSandbox(
      sandbox,
      `find /home/daytona/workspace -type f -not -path "*/node_modules/*" -not -path "*/.git/*" -printf "%P\\n"`,
      { timeoutMs: 5e3 }
    );
    const stdout = extractStdout(findResult);
    const filePaths = stdout ? stdout.trim().split("\n").filter((line) => line.length > 0) : [];
    console.log(
      `[validateProject] File structure find result: stdout="${stdout}", stderr="${extractStderr(
        findResult
      )}"`
    );
    console.log(
      `[validateProject] Found ${filePaths.length} files: ${filePaths.slice(0, 5).join(", ")}`
    );
    const requiredStructure = [
      "package.json",
      "src/App.tsx",
      "src/main.tsx",
      "src/index.css",
      "vite.config.ts",
      "tsconfig.json"
    ];
    const missingRequired = requiredStructure.filter(
      (path) => !filePaths.some((file) => file === path)
    );
    if (missingRequired.length > 0) {
      validationResults.fileStructure.issues.push(
        `Missing required files: ${missingRequired.join(", ")}`
      );
    }
    const expectedDirs = ["src/components", "src/lib"];
    const missingDirs = expectedDirs.filter(
      (dir) => !filePaths.some((file) => file.startsWith(dir + "/"))
    );
    if (missingDirs.length > 0) {
      validationResults.fileStructure.issues.push(
        `Missing or empty directories: ${missingDirs.join(", ")}`
      );
    }
    const libFiles = filePaths.filter((f) => f.startsWith("src/lib/"));
    const expectedLibFiles = ["src/lib/utils.ts"];
    const missingLibFiles = expectedLibFiles.filter(
      (file) => !libFiles.includes(file)
    );
    if (missingLibFiles.length > 0) {
      validationResults.fileStructure.issues.push(
        `Missing essential lib files: ${missingLibFiles.join(", ")}`
      );
    }
    validationResults.fileStructure.passed = missingRequired.length === 0;
    console.log(
      `[validateProject] File structure validation: ${validationResults.fileStructure.passed ? "PASSED" : "FAILED"}`
    );
  } catch (error) {
    validationResults.fileStructure.issues.push(
      `File structure check failed: ${error}`
    );
  }
}
async function validateFragmentCompleteness(sandbox, fragmentFiles, context) {
  console.log(
    "[validateFragmentCompleteness] Validating fragment for completeness..."
  );
  const result = {
    isComplete: true,
    missingDependencies: [],
    warnings: []
  };
  if (!fragmentFiles || fragmentFiles.size === 0) {
    result.isComplete = false;
    result.warnings.push("Fragment has no files");
    return result;
  }
  try {
    const componentMap = /* @__PURE__ */ new Map();
    for (const [filePath, content] of fragmentFiles) {
      const componentInfo = {
        exports: [],
        imports: [],
        content
      };
      const exportMatches = content.match(
        /(export\s+(function|const|interface|type|class)\s+)(\w+)/g
      );
      if (exportMatches) {
        componentInfo.exports = exportMatches.map((match) => {
          const parts = match.split(/\s+/);
          return parts[parts.length - 1];
        });
      }
      const defaultExportMatch = content.match(/export\s+default\s+(\w+)/);
      if (defaultExportMatch) {
        componentInfo.exports.push(defaultExportMatch[1]);
      }
      const lines = content.split("\n");
      let currentImport = "";
      let inImportBlock = false;
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith("import ") && !inImportBlock) {
          currentImport = trimmedLine;
          inImportBlock = !trimmedLine.includes(";") && !trimmedLine.includes(" from ");
        } else if (inImportBlock) {
          currentImport += " " + trimmedLine;
          if (trimmedLine.includes(";") || trimmedLine.includes(" from ")) {
            inImportBlock = false;
          }
        }
        if (!inImportBlock && currentImport.includes(" from ")) {
          const importMatch = currentImport.match(
            /import\s+(?:\{([^}]+)\}|(\w+))\s+from\s+['"]([\w\.\/@-]+)['"]/
          );
          if (importMatch) {
            const namedImports = importMatch[1];
            const defaultImport = importMatch[2];
            const importPath = importMatch[3];
            if (namedImports) {
              const imports = namedImports.split(",").map((imp) => imp.trim().replace(/\s+as\s+\w+/, "")).filter(
                (imp) => imp && !imp.includes("<") && !imp.includes(">")
              );
              componentInfo.imports.push(...imports);
            }
            if (defaultImport) {
              componentInfo.imports.push(defaultImport);
            }
          }
          currentImport = "";
        }
      }
      componentMap.set(filePath, componentInfo);
    }
    const allImports = /* @__PURE__ */ new Set();
    const allExports = /* @__PURE__ */ new Set();
    for (const [filePath, info] of componentMap) {
      info.imports.forEach((imp) => allImports.add(imp));
      info.exports.forEach((exp) => allExports.add(exp));
    }
    const unsatisfiedImports = Array.from(allImports).filter((imp) => {
      if (imp === "React" || imp === "useState" || imp === "useEffect" || imp.includes("Icon")) {
        return false;
      }
      return !allExports.has(imp);
    });
    const hasAppComponent = Array.from(componentMap.keys()).some(
      (path) => path.includes("App.tsx")
    );
    const hasMainEntry = Array.from(componentMap.keys()).some(
      (path) => path.includes("main.tsx")
    );
    const hasIndexHtml = Array.from(componentMap.keys()).some(
      (path) => path.includes("index.html")
    );
    const hasUtils = Array.from(componentMap.keys()).some(
      (path) => path.includes("lib/utils.ts")
    );
    if (!hasAppComponent) {
      result.missingDependencies.push(
        "src/App.tsx - Main app component missing"
      );
      result.isComplete = false;
    }
    if (!hasMainEntry) {
      result.missingDependencies.push(
        "src/main.tsx - React entry point missing"
      );
      result.isComplete = false;
    }
    if (!hasIndexHtml) {
      result.missingDependencies.push("index.html - HTML template missing");
      result.isComplete = false;
    }
    if (!hasUtils && Array.from(componentMap.values()).some(
      (info) => info.content.includes("cn(")
    )) {
      result.missingDependencies.push(
        "src/lib/utils.ts - Utils file missing but components use cn() function"
      );
      result.isComplete = false;
    }
    if (unsatisfiedImports.length > 0) {
      result.warnings.push(
        `Potentially missing components: ${unsatisfiedImports.join(", ")}`
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
async function validateComponentDependencies(sandbox, validationResults, context) {
  console.log("[validateProject] Validating component dependencies...");
  try {
    const findResult = await runCommandOnSandbox(
      sandbox,
      `find /home/daytona/workspace/src -type f \\( -name "*.ts" -o -name "*.tsx" \\) -not -path "*/node_modules/*" -printf "%p\\n"`,
      { timeoutMs: 5e3 }
    );
    const stdout = extractStdout(findResult);
    const tsFilePaths = stdout ? stdout.trim().split("\n").filter((line) => line.length > 0) : [];
    console.log(
      `[validateProject] Find command result: stdout="${stdout}", stderr="${extractStderr(
        findResult
      )}"`
    );
    console.log(
      `[validateProject] Found ${tsFilePaths.length} TypeScript files: ${tsFilePaths.slice(0, 5).join(", ")}`
    );
    const importIssues = [];
    const componentMap = /* @__PURE__ */ new Map();
    const forbiddenImports = [
      "framer-motion",
      "react-spring",
      "@radix-ui",
      "uuid",
      "nanoid",
      "lodash"
    ];
    console.log("[validateProject] Building component dependency map...");
    for (const filePath of tsFilePaths) {
      try {
        const content = await readFileFromSandbox(
          sandbox,
          filePath.replace("/home/daytona/workspace/", "")
        );
        const relativePath = filePath.replace("/home/daytona/workspace/", "");
        const componentInfo = {
          exports: [],
          imports: [],
          filePath: relativePath
        };
        const exportMatches = content.match(
          /(export\s+(function|const|interface|type|class)\s+)(\w+)/g
        );
        if (exportMatches) {
          componentInfo.exports = exportMatches.map((match) => {
            const parts = match.split(/\s+/);
            return parts[parts.length - 1];
          });
        }
        const defaultExportMatch = content.match(/export\s+default\s+(\w+)/);
        if (defaultExportMatch) {
          componentInfo.exports.push(defaultExportMatch[1]);
        }
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.startsWith("import ") && line.includes("from ")) {
            const forbiddenFound = forbiddenImports.find(
              (forbidden) => line.includes(`"${forbidden}"`) || line.includes(`'${forbidden}'`)
            );
            if (forbiddenFound) {
              importIssues.push(
                `${relativePath}: Line ${i + 1} uses forbidden import "${forbiddenFound}"`
              );
            }
            const importMatch = line.match(
              /import\s+(?:\{([^}]+)\}|(\w+))\s+from\s+['"]([\w\.\/@-]+)['"]/
            );
            if (importMatch) {
              const namedImports = importMatch[1];
              const defaultImport = importMatch[2];
              const importPath = importMatch[3];
              if (namedImports) {
                const imports = namedImports.split(",").map((imp) => imp.trim());
                componentInfo.imports.push(...imports);
              }
              if (defaultImport) {
                componentInfo.imports.push(defaultImport);
              }
              if (importPath.includes("@/lib/store")) {
                try {
                  await readFileFromSandbox(sandbox, "src/lib/store.ts");
                } catch {
                  importIssues.push(
                    `${relativePath}: Line ${i + 1} imports "@/lib/store" but src/lib/store.ts doesn't exist`
                  );
                }
              }
              if (importPath.startsWith("./") || importPath.startsWith("../")) {
                const resolvedPath = resolveRelativeImport(
                  filePath,
                  importPath
                );
                let found = false;
                for (const ext of ["", ".ts", ".tsx", ".js", ".jsx"]) {
                  try {
                    const testPath = (resolvedPath + ext).replace(
                      "/home/daytona/workspace/",
                      ""
                    );
                    await readFileFromSandbox(sandbox, testPath);
                    found = true;
                    break;
                  } catch {
                  }
                }
                if (!found) {
                  importIssues.push(
                    `${relativePath}: Line ${i + 1} imports non-existent file "${importPath}"`
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
            ""
          )}: ${error}`
        );
      }
    }
    console.log("[validateProject] Checking component dependencies...");
    const componentUsageMap = /* @__PURE__ */ new Map();
    for (const [filePath, componentInfo] of componentMap) {
      for (const importedItem of componentInfo.imports) {
        for (const [exporterPath, exporterInfo] of componentMap) {
          if (exporterPath !== filePath && exporterInfo.exports.includes(importedItem)) {
            if (!componentUsageMap.has(exporterPath)) {
              componentUsageMap.set(exporterPath, []);
            }
            componentUsageMap.get(exporterPath).push(filePath);
          }
        }
      }
    }
    const criticalComponents = ["App", "Header", "Button", "Input"];
    for (const criticalComponent of criticalComponents) {
      const exportingFiles = Array.from(componentMap.entries()).filter(
        ([_, info]) => info.exports.includes(criticalComponent)
      );
      if (exportingFiles.length === 0) {
        console.log(
          `[validateProject] Missing critical component: ${criticalComponent}`
        );
      }
    }
    validationResults.imports.issues = importIssues;
    validationResults.imports.passed = importIssues.length === 0;
    console.log(
      `[validateProject] Enhanced import validation: ${validationResults.imports.passed ? "PASSED" : "FAILED"} (${importIssues.length} issues)`
    );
    console.log(
      `[validateProject] Analyzed ${componentMap.size} files for component dependencies`
    );
  } catch (error) {
    validationResults.imports.issues.push(
      `Enhanced import validation failed: ${error}`
    );
  }
}
async function validateImports(sandbox, validationResults, context) {
  console.log("[validateProject] Validating imports...");
  try {
    const findResult = await runCommandOnSandbox(
      sandbox,
      `find /home/daytona/workspace/src -type f \\(-name "*.ts" -o -name "*.tsx" \\) -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/.next/*" -not -path "*/dist/*" -not -path "*/build/*" -not -path "*/.cache/*" -not -path "*/.tmp/*" -not -path "*/coverage/*" -not -path "*/.nyc_output/*" -not -path "*/logs/*" -not -path "*/.npm/*" -printf "%p\\n"`,
      { timeoutMs: 5e3 }
    );
    const tsFilePaths = findResult.stdout ? findResult.stdout.trim().split("\n").filter((line) => line.length > 0) : [];
    const importIssues = [];
    const forbiddenImports = [
      "framer-motion",
      "react-spring",
      "@radix-ui",
      "uuid",
      "nanoid",
      "lodash"
    ];
    for (const filePath of tsFilePaths) {
      try {
        const content = await readFileFromSandbox(
          sandbox,
          filePath.replace("/home/daytona/workspace/", "")
        );
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.startsWith("import ") && line.includes("from ")) {
            const forbiddenFound = forbiddenImports.find(
              (forbidden) => line.includes(`"${forbidden}"`) || line.includes(`'${forbidden}'`)
            );
            if (forbiddenFound) {
              importIssues.push(
                `${filePath}: Line ${i + 1} uses forbidden import "${forbiddenFound}"`
              );
            }
            if (line.includes("@/lib/store") || line.includes("from '@/lib/store'")) {
              try {
                await readFileFromSandbox(sandbox, "src/lib/store.ts");
              } catch {
                importIssues.push(
                  `${filePath}: Line ${i + 1} imports "@/lib/store" but src/lib/store.ts doesn't exist`
                );
              }
            }
            if (line.includes("from './") || line.includes('from "../')) {
              const match = line.match(/from\s+['"]([^'"]+)['"]/);
              if (match) {
                const importPath = match[1];
                const resolvedPath = resolveRelativeImport(
                  filePath,
                  importPath
                );
                try {
                  await readFileFromSandbox(
                    sandbox,
                    resolvedPath.replace("/home/daytona/workspace/", "")
                  );
                } catch {
                  let found = false;
                  for (const ext of [".ts", ".tsx", ".js", ".jsx"]) {
                    try {
                      await readFileFromSandbox(
                        sandbox,
                        (resolvedPath + ext).replace(
                          "/home/daytona/workspace/",
                          ""
                        )
                      );
                      found = true;
                      break;
                    } catch {
                    }
                  }
                  if (!found) {
                    importIssues.push(
                      `${filePath}: Line ${i + 1} imports non-existent file "${importPath}"`
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
      `[validateProject] Import validation: ${validationResults.imports.passed ? "PASSED" : "FAILED"} (${importIssues.length} issues)`
    );
  } catch (error) {
    validationResults.imports.issues.push(`Import validation failed: ${error}`);
  }
}
async function validateTypeScript(sandbox, validationResults, context) {
  console.log("[validateProject] Running TypeScript validation...");
  try {
    const tscResult = await runCommandOnSandbox(
      sandbox,
      "npx tsc --noEmit --skipLibCheck",
      {
        timeoutMs: 15e3
      }
    );
    const errors = [];
    if (tscResult.stderr) {
      const errorLines = tscResult.stderr.split("\n").filter(
        (line) => line.includes("error TS") || line.includes("Error:")
      );
      errors.push(...errorLines);
    }
    if (tscResult.stdout) {
      const errorLines = tscResult.stdout.split("\n").filter(
        (line) => line.includes("error TS") || line.includes("Error:")
      );
      errors.push(...errorLines);
    }
    validationResults.typescript.issues = errors;
    validationResults.typescript.passed = errors.length === 0;
    console.log(
      `[validateProject] TypeScript validation: ${validationResults.typescript.passed ? "PASSED" : "FAILED"} (${errors.length} errors)`
    );
  } catch (error) {
    validationResults.typescript.issues.push(
      `TypeScript check failed: ${error}`
    );
  }
}
async function validateDependencies(sandbox, validationResults, context) {
  console.log("[validateProject] Validating dependency order...");
  try {
    const dependencyIssues = [];
    try {
      await readFileFromSandbox(sandbox, "src/lib/utils.ts");
    } catch {
      dependencyIssues.push(
        "src/lib/utils.ts is missing but required for Shadcn components"
      );
    }
    const findResult = await runCommandOnSandbox(
      sandbox,
      `find /home/daytona/workspace/src/components -type f -name "*.tsx" -printf "%p\\n"`,
      { timeoutMs: 5e3 }
    );
    const componentFilePaths = findResult.stdout ? findResult.stdout.trim().split("\n").filter((line) => line.length > 0) : [];
    for (const filePath of componentFilePaths) {
      try {
        const content = await readFileFromSandbox(
          sandbox,
          filePath.replace("/home/daytona/workspace/", "")
        );
        const interfaceMatches = content.match(/interface\s+(\w+)/g);
        const importMatches = content.match(
          /import\s+{[^}]*(\w+)[^}]*}\s+from/g
        );
        if (interfaceMatches && importMatches) {
          for (const importMatch of importMatches) {
            if (importMatch.includes("from './") && !interfaceMatches.some(
              (def) => importMatch.includes(def.replace("interface ", ""))
            )) {
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
      `[validateProject] Dependency validation: ${validationResults.dependencies.passed ? "PASSED" : "FAILED"}`
    );
  } catch (error) {
    validationResults.dependencies.issues.push(
      `Dependency validation failed: ${error}`
    );
  }
}
async function validateIconContextLogic(sandbox, validationResults, context) {
  console.log("[validateProject] Validating icon context...");
  try {
    const iconIssues = [];
    const findResult = await runCommandOnSandbox(
      sandbox,
      `find /home/daytona/workspace/src -type f -name "*.tsx" -printf "%p\\n"`,
      { timeoutMs: 5e3 }
    );
    const componentFilePaths = findResult.stdout ? findResult.stdout.trim().split("\n").filter((line) => line.length > 0) : [];
    let appType = "unknown";
    try {
      const appContent = await readFileFromSandbox(sandbox, "src/App.tsx");
      if (appContent.includes("todo") || appContent.includes("task") || appContent.includes("checklist")) {
        appType = "productivity";
      } else if (appContent.includes("shop") || appContent.includes("cart") || appContent.includes("product")) {
        appType = "ecommerce";
      } else if (appContent.includes("music") || appContent.includes("audio") || appContent.includes("player")) {
        appType = "music";
      } else if (appContent.includes("social") || appContent.includes("post") || appContent.includes("message")) {
        appType = "social";
      }
    } catch {
    }
    for (const filePath of componentFilePaths) {
      try {
        const content = await readFileFromSandbox(
          sandbox,
          filePath.replace("/home/daytona/workspace/", "")
        );
        const lucideImports = content.match(
          /import\s+{([^}]+)}\s+from\s+['"]lucide-react['"]/
        );
        if (lucideImports) {
          const icons = lucideImports[1].split(",").map((icon) => icon.trim());
          if (appType === "productivity") {
            const inappropriateIcons = icons.filter(
              (icon) => ["ShoppingCart", "Music", "Play", "Pause", "CreditCard"].includes(
                icon
              )
            );
            if (inappropriateIcons.length > 0) {
              iconIssues.push(
                `${filePath}: Inappropriate icons for productivity app: ${inappropriateIcons.join(
                  ", "
                )}`
              );
            }
          } else if (appType === "ecommerce") {
            const inappropriateIcons = icons.filter(
              (icon) => ["Music", "Play", "Pause", "CheckSquare", "Calendar"].includes(
                icon
              )
            );
            if (inappropriateIcons.length > 0) {
              iconIssues.push(
                `${filePath}: Inappropriate icons for e-commerce app: ${inappropriateIcons.join(
                  ", "
                )}`
              );
            }
          } else if (appType === "music") {
            const inappropriateIcons = icons.filter(
              (icon) => [
                "ShoppingCart",
                "CheckSquare",
                "Calendar",
                "CreditCard"
              ].includes(icon)
            );
            if (inappropriateIcons.length > 0) {
              iconIssues.push(
                `${filePath}: Inappropriate icons for music app: ${inappropriateIcons.join(
                  ", "
                )}`
              );
            }
          }
        }
      } catch (error) {
      }
    }
    validationResults.iconContext.issues = iconIssues;
    validationResults.iconContext.passed = iconIssues.length === 0;
    console.log(
      `[validateProject] Icon context validation: ${validationResults.iconContext.passed ? "PASSED" : "FAILED"}`
    );
  } catch (error) {
    validationResults.iconContext.issues.push(
      `Icon context validation failed: ${error}`
    );
  }
}
async function validateBuild(sandbox, validationResults, context) {
  console.log(
    "[validateProject] Running optimized build validation (lint + TypeScript)..."
  );
  try {
    const buildErrors = [];
    console.log("[validateProject] Running ESLint check...");
    try {
      let lintCommand = "npm run lint";
      try {
        const packageJsonResult = await runCommandOnSandbox(
          sandbox,
          "cat package.json",
          {
            timeoutMs: 2e3
          }
        );
        const packageJson = JSON.parse(packageJsonResult.stdout || "{}");
        if (!packageJson.scripts?.lint) {
          console.log(
            "[validateProject] No lint script found, trying direct eslint command..."
          );
          lintCommand = "npx eslint src --ext .ts,.tsx,.js,.jsx";
        }
      } catch (packageError) {
        console.log(
          "[validateProject] Could not read package.json, using direct eslint command..."
        );
        lintCommand = "npx eslint src --ext .ts,.tsx,.js,.jsx";
      }
      const lintResult = await runCommandOnSandbox(sandbox, lintCommand, {
        timeoutMs: 3e4
      });
      const eslintErrors = [];
      if (lintResult.stdout) {
        const lines = lintResult.stdout.split("\n");
        let currentFile = "";
        for (const line of lines) {
          if (line.match(/\.(ts|tsx|js|jsx)$/)) {
            currentFile = line.trim();
          } else if (line.includes("error") && line.match(/\d+:\d+/)) {
            eslintErrors.push(
              `[ESLint] ${currentFile ? currentFile + ": " : ""}${line.trim()}`
            );
          } else if (line.includes("\u2716") && line.includes("error")) {
            eslintErrors.push(`[ESLint] ${line.trim()}`);
          }
        }
      }
      if (lintResult.stderr) {
        const errorLines = lintResult.stderr.split("\n").filter(
          (line) => line.includes("Error") && !line.includes("error")
          // Only actual errors, not lint errors
        );
        eslintErrors.push(...errorLines.map((line) => `[ESLint] ${line}`));
      }
      buildErrors.push(...eslintErrors);
      if (lintResult.exitCode !== void 0 && lintResult.exitCode > 1) {
        buildErrors.push(
          `[ESLint] Unexpected linting failure with exit code ${lintResult.exitCode}`
        );
      }
      console.log(
        `[validateProject] ESLint found ${eslintErrors.length} issues (exit code: ${lintResult.exitCode})`
      );
    } catch (lintError) {
      const errorMessage = String(lintError);
      if (errorMessage.includes("timed out")) {
        console.log(
          "[validateProject] ESLint check timed out, skipping lint check"
        );
      } else if (errorMessage.includes("eslint: not found") || errorMessage.includes("No ESLint configuration") || errorMessage.includes("Cannot find module 'eslint'")) {
        console.log(
          "[validateProject] ESLint not found or not configured, skipping lint check"
        );
      } else {
        console.log(
          "[validateProject] ESLint check failed, skipping:",
          lintError
        );
      }
    }
    console.log("[validateProject] Running TypeScript check...");
    try {
      const tscResult = await runCommandOnSandbox(
        sandbox,
        "npx tsc --noEmit --skipLibCheck",
        {
          timeoutMs: 15e3
        }
      );
      if (tscResult.stderr) {
        const errorLines = tscResult.stderr.split("\n").filter(
          (line) => line.includes("error TS") || line.includes("Error:") || line.includes("Cannot find module") || line.includes("Type error")
        );
        buildErrors.push(...errorLines.map((line) => `[TypeScript] ${line}`));
      }
      if (tscResult.stdout) {
        const errorLines = tscResult.stdout.split("\n").filter(
          (line) => line.includes("error TS") || line.includes("Error:") || line.includes("Cannot find module") || line.includes("Type error")
        );
        buildErrors.push(...errorLines.map((line) => `[TypeScript] ${line}`));
      }
      if (tscResult.exitCode !== 0 && tscResult.exitCode !== void 0) {
        if (buildErrors.filter((err) => err.includes("[TypeScript]")).length === 0) {
          buildErrors.push(
            `[TypeScript] Type checking failed with exit code ${tscResult.exitCode}`
          );
        }
      }
    } catch (tscError) {
      buildErrors.push(`[TypeScript] Type check failed: ${tscError}`);
    }
    validationResults.build.issues = buildErrors;
    validationResults.build.passed = buildErrors.length === 0;
    console.log(
      `[validateProject] Build validation: ${validationResults.build.passed ? "PASSED" : "FAILED"} (${buildErrors.length} issues found)`
    );
  } catch (error) {
    validationResults.build.issues.push(`Build validation failed: ${error}`);
    validationResults.build.passed = false;
  }
}
async function validateContentCompleteness(sandbox, validationResults, context) {
  const contentErrors = [];
  let foundGenericPlaceholders = [];
  try {
    console.log(
      "[validateProject] Starting content completeness validation..."
    );
    try {
      const appContent = await sandbox.fs.downloadFile(
        "/home/daytona/workspace/src/App.tsx"
      );
      const appString = appContent.toString();
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
        />\s*\{.*title.*\}\s*</g,
        // Template placeholders in text nodes like >{title}<
        />\s*\[.*Your.*content.*here.*\]\s*</i,
        // Bracketed placeholders in text like >[Your content here]<
        /Coming soon/i,
        /Placeholder content/i,
        /TODO:.*implement/i
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
            ", "
          )}`
        );
      }
      const hasHeading = /(<h[1-6]|<title|className.*text-[0-9]xl)/i.test(
        appString
      );
      const hasNavigation = /(<nav|<header|navigation|menu)/i.test(appString);
      if (!hasHeading) {
        contentErrors.push(
          "App.tsx should have at least one heading or title element"
        );
      }
      const genericInteractionPattern = /(>count is|>click me<|>button<)/i;
      if (genericInteractionPattern.test(appString)) {
        contentErrors.push(
          "App.tsx contains generic button/interaction text that should be contextual to the application"
        );
      }
      console.log(
        `[validateProject] App.tsx content analysis: ${contentErrors.length} issues found`
      );
    } catch (error) {
      contentErrors.push(`Could not read App.tsx: ${error}`);
    }
    try {
      const htmlContent = await sandbox.fs.downloadFile(
        "/home/daytona/workspace/index.html"
      );
      const htmlString = htmlContent.toString();
      const titleMatch = htmlString.match(/<title>(.*?)<\/title>/i);
      if (titleMatch) {
        const title = titleMatch[1];
        if (title === "Vite + React" || title === "React App" || title.includes("Vite")) {
          contentErrors.push(
            `index.html title should be updated to reflect the actual application: "${title}"`
          );
        }
      } else {
        contentErrors.push("index.html should have a descriptive title tag");
      }
    } catch (error) {
      console.warn("[validateProject] Could not read index.html:", error);
    }
    try {
      const files = await sandbox.fs.listFiles("/home/daytona/workspace/src");
      const componentFiles = files.filter(
        (file) => file.name.endsWith(".tsx") || file.name.endsWith(".jsx")
      );
      if (componentFiles.length === 1 && foundGenericPlaceholders.length > 0) {
        contentErrors.push(
          "Application appears to be using default template structure - consider adding meaningful content or components"
        );
      }
    } catch (error) {
      console.warn(
        "[validateProject] Could not analyze component structure:",
        error
      );
    }
    validationResults.contentCompleteness.issues = contentErrors;
    validationResults.contentCompleteness.passed = contentErrors.length === 0;
    console.log(
      `[validateProject] Content completeness validation: ${validationResults.contentCompleteness.passed ? "PASSED" : "FAILED"} (${contentErrors.length} issues found)`
    );
    if (contentErrors.length > 0) {
      console.log("[validateProject] Content completeness issues:");
      contentErrors.forEach((issue) => console.log(`  - ${issue}`));
    }
  } catch (error) {
    validationResults.contentCompleteness.issues.push(
      `Content completeness validation failed: ${error}`
    );
    validationResults.contentCompleteness.passed = false;
  }
}
export {
  compareFileLists,
  getRecursiveFileList,
  resolveRelativeImport,
  validateBuild,
  validateComponentDependencies,
  validateContentCompleteness,
  validateDependencies,
  validateFileStructure,
  validateFragmentCompleteness,
  validateIconContextLogic,
  validateImports,
  validateTypeScript
};
