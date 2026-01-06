import type { Sandbox } from "@daytonaio/sdk";

/**
 * Context for AI tools and validation functions
 */
export type ToolsContext = {
  projectId: string;
  userId: string;
  sandbox: Sandbox | null; // Daytona sandbox instance
  sandboxUrl: string | null;
  files: Map<string, { size: number; modified: number }> | null; // File metadata for change detection
};
