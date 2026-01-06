/**
 * File Processor for Code Import
 * Handles file filtering, sanitization, and validation
 */

// Files and directories to always ignore
const IGNORED_PATTERNS = [
  // Dependencies
  "node_modules",
  "vendor",
  ".pnp",
  ".yarn/cache",
  ".yarn/unplugged",
  
  // Build outputs
  "dist",
  "build",
  ".next",
  ".nuxt",
  ".output",
  ".svelte-kit",
  ".vercel",
  ".netlify",
  "out",
  ".cache",
  ".parcel-cache",
  ".turbo",
  
  // Version control
  ".git",
  ".svn",
  ".hg",
  
  // IDE and editor
  ".idea",
  ".vscode",
  ".vs",
  "*.swp",
  "*.swo",
  ".DS_Store",
  "Thumbs.db",
  
  // Lock files (we don't need these for import)
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lockb",
  
  // Environment files with secrets
  ".env.local",
  ".env.*.local",
  ".env.production",
  
  // Coverage and test outputs
  "coverage",
  ".nyc_output",
  
  // Logs
  "*.log",
  "npm-debug.log*",
  "yarn-debug.log*",
  "yarn-error.log*",
  
  // Misc
  ".terraform",
  "__pycache__",
  "*.pyc",
];

// File extensions that are binary but we NOW support via base64 encoding
// These are no longer filtered out - they're stored as __BASE64__ prefixed strings
const SUPPORTED_BINARY_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".svg",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".otf",
];

// File extensions that are truly unsupported (too large, security concerns, etc.)
const BINARY_EXTENSIONS = [
  ".pdf",
  ".zip",
  ".tar",
  ".gz",
  ".rar",
  ".7z",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".mp3",
  ".mp4",
  ".wav",
  ".avi",
  ".mov",
  ".webm",
  ".ogg",
  ".flac",
  ".db",
  ".sqlite",
  ".sqlite3",
];

// Maximum limits
export const MAX_FILE_COUNT = 500;
export const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024; // 1MB per file
export const MAX_TOTAL_SIZE_BYTES = 50 * 1024 * 1024; // 50MB total

export interface FileValidationResult {
  valid: boolean;
  fileCount: number;
  totalSizeBytes: number;
  errors: string[];
  warnings: string[];
}

export interface ProcessedFiles {
  files: Record<string, string>;
  stats: {
    originalCount: number;
    filteredCount: number;
    totalSizeBytes: number;
    skippedFiles: string[];
    skippedBinaryFiles: string[];
  };
}

/**
 * Check if a file path should be ignored
 */
export function shouldIgnoreFile(filePath: string): boolean {
  const normalizedPath = filePath.replace(/\\/g, "/");
  const pathParts = normalizedPath.split("/");
  const fileName = pathParts[pathParts.length - 1];

  // Check against ignored patterns
  for (const pattern of IGNORED_PATTERNS) {
    // Exact match for directories
    if (pathParts.includes(pattern.replace(/\*/g, ""))) {
      return true;
    }

    // Glob pattern matching
    if (pattern.includes("*")) {
      const regex = new RegExp(
        "^" + pattern.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$",
      );
      if (regex.test(fileName)) {
        return true;
      }
    }

    // Direct match
    if (fileName === pattern || normalizedPath.includes(`/${pattern}/`)) {
      return true;
    }
  }

  // Check for binary extensions
  const ext = fileName.substring(fileName.lastIndexOf(".")).toLowerCase();
  if (BINARY_EXTENSIONS.includes(ext)) {
    return true;
  }

  // Skip hidden files (except important config files)
  const allowedHiddenFiles = [
    ".env",
    ".env.example",
    ".gitignore",
    ".npmrc",
    ".nvmrc",
    ".prettierrc",
    ".prettierrc.json",
    ".prettierrc.js",
    ".eslintrc",
    ".eslintrc.json",
    ".eslintrc.js",
    ".editorconfig",
    ".babelrc",
    ".browserslistrc",
  ];
  if (
    fileName.startsWith(".") &&
    !allowedHiddenFiles.includes(fileName) &&
    !fileName.startsWith(".env")
  ) {
    return true;
  }

  return false;
}

/**
 * Sanitize file content - remove null bytes and control characters
 * Skip sanitization for base64 encoded binary files
 */
export function sanitizeFileContent(content: string): string {
  // Don't sanitize base64 encoded content (binary files)
  if (content.startsWith("__BASE64__")) {
    return content;
  }

  // Remove null bytes
  let sanitized = content.replace(/\0/g, "");

  // Remove other control characters except newlines, tabs, and carriage returns
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  return sanitized;
}

/**
 * Validate import size constraints
 */
export function validateImportSize(
  files: Record<string, string>,
): FileValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const fileCount = Object.keys(files).length;
  let totalSizeBytes = 0;

  for (const [path, content] of Object.entries(files)) {
    const sizeBytes = new TextEncoder().encode(content).length;
    totalSizeBytes += sizeBytes;

    if (sizeBytes > MAX_FILE_SIZE_BYTES) {
      errors.push(
        `File "${path}" exceeds maximum size of ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB`,
      );
    }
  }

  if (fileCount > MAX_FILE_COUNT) {
    errors.push(
      `Too many files (${fileCount}). Maximum allowed is ${MAX_FILE_COUNT} files.`,
    );
  }

  if (totalSizeBytes > MAX_TOTAL_SIZE_BYTES) {
    errors.push(
      `Total size (${(totalSizeBytes / 1024 / 1024).toFixed(2)}MB) exceeds maximum of ${MAX_TOTAL_SIZE_BYTES / 1024 / 1024}MB.`,
    );
  }

  if (fileCount > MAX_FILE_COUNT * 0.8) {
    warnings.push(
      `Approaching file limit: ${fileCount}/${MAX_FILE_COUNT} files.`,
    );
  }

  if (totalSizeBytes > MAX_TOTAL_SIZE_BYTES * 0.8) {
    warnings.push(
      `Approaching size limit: ${(totalSizeBytes / 1024 / 1024).toFixed(2)}MB/${MAX_TOTAL_SIZE_BYTES / 1024 / 1024}MB.`,
    );
  }

  return {
    valid: errors.length === 0,
    fileCount,
    totalSizeBytes,
    errors,
    warnings,
  };
}

/**
 * Filter and process files for import
 */
export function filterIgnoredFiles(
  files: Record<string, string>,
): ProcessedFiles {
  const filteredFiles: Record<string, string> = {};
  const skippedFiles: string[] = [];
  const skippedBinaryFiles: string[] = [];
  let totalSizeBytes = 0;

  for (const [path, content] of Object.entries(files)) {
    if (shouldIgnoreFile(path)) {
      // Track binary files separately for user warning
      const ext = path.substring(path.lastIndexOf(".")).toLowerCase();
      if (BINARY_EXTENSIONS.includes(ext)) {
        skippedBinaryFiles.push(path);
      }
      skippedFiles.push(path);
      continue;
    }

    // Sanitize content
    const sanitizedContent = sanitizeFileContent(content);
    filteredFiles[path] = sanitizedContent;
    totalSizeBytes += new TextEncoder().encode(sanitizedContent).length;
  }

  return {
    files: filteredFiles,
    stats: {
      originalCount: Object.keys(files).length,
      filteredCount: Object.keys(filteredFiles).length,
      totalSizeBytes,
      skippedFiles,
      skippedBinaryFiles,
    },
  };
}

/**
 * Normalize file paths - remove leading slashes and ensure consistent format
 */
export function normalizePath(filePath: string): string {
  return filePath
    .replace(/\\/g, "/") // Convert backslashes to forward slashes
    .replace(/^\/+/, "") // Remove leading slashes
    .replace(/\/+/g, "/"); // Remove duplicate slashes
}

/**
 * Strip common root directory from file paths
 * (e.g., when extracting from a GitHub tarball that has a root folder)
 */
export function stripRootDirectory(
  files: Record<string, string>,
): Record<string, string> {
  const paths = Object.keys(files);
  if (paths.length === 0) return files;

  // Find common root directory
  const firstPath = paths[0];
  const firstParts = firstPath.split("/");

  // Check if all files share the same root directory
  if (firstParts.length > 1) {
    const potentialRoot = firstParts[0];
    const allShareRoot = paths.every((p) => p.startsWith(`${potentialRoot}/`));

    if (allShareRoot) {
      const result: Record<string, string> = {};
      const rootPrefix = `${potentialRoot}/`;
      for (const [path, content] of Object.entries(files)) {
        const newPath = path.substring(rootPrefix.length);
        if (newPath) {
          result[newPath] = content;
        }
      }
      return result;
    }
  }

  return files;
}


