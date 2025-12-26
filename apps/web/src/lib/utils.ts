import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { TreeItem } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generate a UUID that works in all contexts (including non-secure HTTP).
 * Uses crypto.randomUUID() when available (secure contexts), falls back to
 * a custom implementation for non-secure contexts (e.g., HTTP on IP address).
 */
export function generateUUID(): string {
  // crypto.randomUUID() requires a secure context (HTTPS or localhost)
  // It will be undefined when accessed via HTTP on an IP address
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  // Fallback for non-secure contexts
  // Generate a v4-like UUID using Math.random()
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Filter out build folders and other unnecessary directories
 */
export function shouldExcludeFile(filePath: string): boolean {
  const excludedPatterns = [
    /^\.git\//,
    /^\.next\//,
    /^\.vercel\//,
    /^\.turbo\//,
    /^build\//,
    /^dist\//,
    /^out\//,
    /^coverage\//,
    /^\.nyc_output\//,
    /^node_modules\//,
    /^\.DS_Store$/,
    // Note: .env files are intentionally NOT excluded - users need to see and edit them
    /\.log$/,
    /\.tmp$/,
    /\.temp$/,
    /^__pycache__\//,
    /\.pyc$/,
    /^\.pytest_cache\//,
    /^venv\//,
    /^env\//,
    /^\.venv\//,
  ];

  return excludedPatterns.some((pattern) => pattern.test(filePath));
}

/**
 * Convert file paths to tree structure, excluding build folders
 */
export function convertFilesToTreeItems(files: {
  [path: string]: string;
}): TreeItem[] {
  interface TreeNode {
    [key: string]: TreeNode | null;
  }

  const tree: TreeNode = {};

  const sortedPaths = Object.keys(files)
    .filter((path) => !shouldExcludeFile(path))
    .sort();

  for (const path of sortedPaths) {
    const parts = path.split("/");
    let currentNode: TreeNode = tree;

    // Process all parts except the last one (filename)
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!currentNode[part]) {
        currentNode[part] = {};
      }
      currentNode = currentNode[part] as TreeNode;
    }

    // Add the filename as null to indicate it's a file
    const fileName = parts[parts.length - 1];
    currentNode[fileName] = null;
  }

  function convertNode(node: TreeNode, name?: string): TreeItem | TreeItem[] {
    const entries = Object.entries(node);

    if (entries.length === 0) {
      return name || "";
    }

    // Sort entries: folders first, then files, both alphabetically
    entries.sort(([keyA, valueA], [keyB, valueB]) => {
      // Folders (non-null values) come before files (null values)
      if (valueA !== null && valueB === null) return -1;
      if (valueA === null && valueB !== null) return 1;
      // Both are files or both are folders - sort alphabetically
      return keyA.localeCompare(keyB);
    });

    const children: TreeItem[] = [];

    for (const [key, value] of entries) {
      if (value === null) {
        // This means this is a file
        children.push(key);
      } else {
        // This is a folder
        const subTree = convertNode(value, key);
        if (Array.isArray(subTree)) {
          children.push([key, ...subTree]);
        } else {
          children.push(key, subTree);
        }
      }
    }

    return children;
  }

  const result = convertNode(tree);
  return Array.isArray(result) ? result : [result];
}

/**
 * Removes common leading whitespace from all lines in a string.
 * Useful for template literals with indentation.
 *
 * @example
 * const text = stripIndent`
 *   Hello
 *     World
 * `;
 * // Returns: "Hello\n  World"
 */
export function stripIndents(
  strings: TemplateStringsArray | string,
  ...values: unknown[]
): string {
  // Handle both template literal and regular string usage
  let text: string;
  if (typeof strings === "string") {
    text = strings;
  } else {
    text = strings.reduce((acc, str, i) => acc + str + (values[i] ?? ""), "");
  }

  // Split into lines
  const lines = text.split("\n");

  // Remove leading/trailing empty lines
  while (lines.length > 0 && lines[0].trim() === "") {
    lines.shift();
  }
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
    lines.pop();
  }

  // Find minimum indentation (ignoring empty lines)
  const minIndent = lines.reduce((min, line) => {
    if (line.trim() === "") return min;
    const indent = line.match(/^[ \t]*/)?.[0].length ?? 0;
    return Math.min(min, indent);
  }, Infinity);

  // Remove the common indentation from all lines
  const dedented = lines.map((line) => {
    if (line.trim() === "") return "";
    return line.slice(minIndent);
  });

  return dedented.join("\n");
}
