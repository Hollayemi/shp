/**
 * Utility functions for filtering files during export/push operations
 */

/**
 * Determine if a file path should be skipped during export/push
 */
export function shouldSkipFile(filePath: string): boolean {
  const skipPatterns = [
    "node_modules",
    ".git",
    "dist",
    "build",
    ".next",
    ".cache",
    ".turbo",
    "coverage",
    ".DS_Store",
    ".env.local",
    ".env.development.local",
    ".env.production.local",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    ".vscode",
    ".idea",
    "*.log",
    ".npm",
    ".yarn",
    ".pnpm",
    "tmp",
    "temp",
    ".vercel",
    ".netlify",
  ];

  // Check if any part of the path matches skip patterns
  const pathParts = filePath.split("/");

  return skipPatterns.some((pattern) => {
    if (pattern.includes("*")) {
      // Simple wildcard matching
      const regex = new RegExp("^" + pattern.replace("*", ".*") + "$");
      return pathParts.some((part) => regex.test(part));
    }
    // Check if any path part matches the pattern
    return pathParts.some(
      (part) => part === pattern || part.startsWith(pattern),
    );
  });
}

/**
 * Filter a set of file paths to remove unwanted files
 */
export function filterFilePaths(filePaths: Set<string> | string[]): string[] {
  const paths = Array.isArray(filePaths) ? filePaths : Array.from(filePaths);
  return paths.filter((path) => !shouldSkipFile(path));
}
