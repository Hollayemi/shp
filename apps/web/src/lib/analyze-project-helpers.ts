/**
 * Helper functions for project analysis
 */

/**
 * Select relevant files based on query intent
 * Focuses on app-specific code, not boilerplate/template files
 */
export function selectRelevantFiles(
  allFiles: string[],
  query: string,
): string[] {
  const queryLower = query.toLowerCase();

  // Always include priority files
  const priority = ["package.json", "README.md"];

  // Files to EXCLUDE (boilerplate/template files that don't show app features)
  const excludePatterns = [
    "components/ui/", // shadcn/ui components
    "lib/utils", // utility functions
    "node_modules/",
    ".next/",
    "dist/",
    ".git/",
    "public/",
    "styles/globals",
    "tailwind.config",
    "next.config",
    "postcss.config",
    "tsconfig",
  ];

  // Query-specific patterns
  const patterns: Record<string, string[]> = {
    auth: ["auth", "login", "signup", "session", "middleware"],
    payment: ["payment", "checkout", "stripe", "pricing"],
    profile: ["profile", "user", "account", "settings"],
    dashboard: ["dashboard", "home", "overview"],
    database: ["prisma", "schema", "model", "db"],
    api: ["api", "route", "endpoint"],
    feature: ["app", "page", "component"],
  };

  // Detect query intent
  let relevantPatterns: string[] = [];
  for (const [key, keywords] of Object.entries(patterns)) {
    if (keywords.some((kw) => queryLower.includes(kw))) {
      relevantPatterns.push(...keywords);
    }
  }

  // Default to app-specific files (not generic components)
  if (relevantPatterns.length === 0) {
    relevantPatterns = ["app", "page", "layout"];
  }

  // Filter files
  const selected = allFiles.filter((file) => {
    const fileLower = file.toLowerCase();

    // Exclude boilerplate/template files
    if (excludePatterns.some((p) => fileLower.includes(p))) {
      return false;
    }

    // Priority files
    if (priority.some((p) => fileLower.includes(p))) return true;

    // Pattern matches
    if (relevantPatterns.some((p) => fileLower.includes(p))) return true;

    // Main app files (pages, layouts, app-specific components)
    if (fileLower.includes("src/app/") || fileLower.includes("src/pages/")) {
      return true;
    }

    // Prisma schema (shows data model)
    if (fileLower.includes("prisma/schema")) {
      return true;
    }

    // API routes
    if (fileLower.includes("/api/") && fileLower.includes("route")) {
      return true;
    }

    return false;
  });

  return selected;
}
