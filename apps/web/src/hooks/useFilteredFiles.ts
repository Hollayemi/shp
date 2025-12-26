import { useMemo } from "react";
import { filterFilePaths } from "@/lib/file-filter-utils";

/**
 * Hook to filter sandbox files for export/push operations
 * Uses the already-loaded sandboxFiles to avoid re-fetching
 */
export function useFilteredFiles(sandboxFiles: Set<string> | undefined) {
  return useMemo(() => {
    if (!sandboxFiles || sandboxFiles.size === 0) {
      return [];
    }
    
    // Filter out unwanted files (node_modules, .git, etc.)
    return filterFilePaths(sandboxFiles);
  }, [sandboxFiles]);
}
