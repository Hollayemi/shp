import { CopyIcon } from "lucide-react";
import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { Hint } from "@/components/Hint";
import { Button } from "@/components/ui/button";
import { CodeView } from "./index";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { convertFilesToTreeItems } from "@/lib/utils";
import { TreeView } from "@/modules/projects/ui/components/TreeView";
import { useTRPC } from "@/trpc/client";

type FilesAsSet = Set<string>;
type FilesWithContent = { [path: string]: string };

function getLanguageFromExtension(filename: string): string {
  const extension = filename.split(".").pop()?.toLowerCase();
  return extension || "text";
}

interface FileExplorerProps {
  projectId?: string;
  files?: FilesAsSet | FilesWithContent; // Either file paths (Set) or legacy files with content (object)
}

export const FileExplorer = ({ projectId, files }: FileExplorerProps) => {
  const [expanded, setExpanded] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);

  const trpc = useTRPC();

  // Determine if this is legacy mode (files has content) or new mode (files are just paths)
  const isLegacyMode =
    files && !(files instanceof Set) && typeof files === "object";

  // Convert files to object for tree building
  const filesObject = useMemo(() => {
    if (!files) return {};

    const workspacePrefix = "/home/daytona/workspace/";

    const filterAndNormalizePaths = (
      inputFiles: FilesWithContent | FilesAsSet
    ) => {
      const filteredObj: { [path: string]: string } = {};

      // Patterns to exclude from file tree
      const excludePatterns = [
        /^\.shipper\//,  // .shipper directory (Shipper monitoring)
        /^\.git\//,      // .git directory
      ];

      const shouldExclude = (path: string) => {
        return excludePatterns.some(pattern => pattern.test(path));
      };

      if (isLegacyMode) {
        // Legacy mode: files already contains content
        const filesWithContent = inputFiles as FilesWithContent;
        Object.entries(filesWithContent).forEach(([path, content]) => {
          // Handle both absolute paths (legacy) and relative paths (new format)
          let relativePath = path;
          if (path.startsWith(workspacePrefix)) {
            relativePath = path.substring(workspacePrefix.length);
          }
          // Also handle paths that might start with "./"
          relativePath = relativePath.replace(/^\.\//, "");

          if (relativePath && relativePath !== "." && !shouldExclude(relativePath)) {
            // Skip empty paths, root directory, and excluded patterns
            filteredObj[relativePath] = content;
          }
        });
      } else {
        // New mode: files is a Set of paths (now already relative from daytona-sandbox-manager)
        (inputFiles as FilesAsSet).forEach((path) => {
          // Handle both absolute paths (for backward compatibility) and relative paths (new format)
          let relativePath = path;
          if (path.startsWith(workspacePrefix)) {
            relativePath = path.substring(workspacePrefix.length);
          }
          // Also handle paths that might start with "./"
          relativePath = relativePath.replace(/^\.\//, "");

          if (relativePath && relativePath !== "." && !shouldExclude(relativePath)) {
            // Skip empty paths, root directory, and excluded patterns
            filteredObj[relativePath] = ""; // Empty content, will be loaded on demand
          }
        });
      }

      return filteredObj;
    };

    if (isLegacyMode) {
      // Legacy mode: files already contains content
      return filterAndNormalizePaths(files as FilesWithContent);
    } else {
      // New mode: files is a Set of paths, convert to empty content object
      return filterAndNormalizePaths(files as FilesAsSet);
    }
  }, [files, isLegacyMode]);

  const treeData = useMemo(() => {
    const result = convertFilesToTreeItems(filesObject);
    // Only log when we actually have files to show
    if (Object.keys(filesObject || {}).length > 0) {
      console.log(
        "[FileExplorer] Tree built with",
        Object.keys(filesObject).length,
        "files"
      );
    }
    return result;
  }, [filesObject]);

  // File content loading query
  const { data: fileContentData, isLoading: fileContentLoading } = useQuery({
    ...trpc.projects.getSandboxFileContent.queryOptions({
      projectId: projectId || "",
      filePath: selectedFile || "",
    }),
    enabled: !!projectId && !!selectedFile && !isLegacyMode,
  });

  const handleSelect = useCallback(
    (path: string) => {
      // Check if file exists in the filtered filesObject
      const fileExists = filesObject[path] !== undefined;

      if (fileExists) {
        setSelectedFile(path);

        if (isLegacyMode) {
          // Legacy mode: content is already available in filesObject
          setFileContent(filesObject[path]);
        }
        // New mode: content will be fetched automatically by the query when selectedFile changes
      }
    },
    [filesObject, isLegacyMode]
  );

  const getDisplayContent = () => {
    if (isLegacyMode && selectedFile) {
      return filesObject[selectedFile];
    }
    return fileContentData?.content || null;
  };

  const canCopyContent = () => {
    return (
      (isLegacyMode && selectedFile && filesObject[selectedFile]) ||
      (!isLegacyMode && fileContentData?.content)
    );
  };

  return (
    <ResizablePanelGroup
      direction="horizontal"
      className="min-h-0"
      id="file-explorer-panels"
    >
      <ResizablePanel
        minSize={30}
        defaultSize={30}
        className="bg-sidebar min-h-0 flex flex-col overflow-hidden"
      >
        <TreeView
          data={treeData}
          value={selectedFile || ""}
          onSelect={handleSelect}
          expandedItems={expanded}
          onExpandedChange={setExpanded}
        />
      </ResizablePanel>
      <ResizableHandle className="hover:bg-transparent transition-colors" />
      <ResizablePanel minSize={50} defaultSize={70}>
        {selectedFile ? (
          <div className="flex flex-col h-full w-full">
            <div className="border-b bg-sidebar px-4 py-2 flex justify-between items-center">
              <span className="text-sm font-medium truncate">
                {selectedFile}
              </span>
              {canCopyContent() && (
                <Hint content="Copy to clipboard">
                  <Button
                    variant="outline"
                    size="icon"
                    className="ml-auto"
                    disabled={false}
                    onClick={() => {
                      const content = getDisplayContent() || "";
                      navigator.clipboard.writeText(content);
                    }}
                  >
                    <CopyIcon />
                  </Button>
                </Hint>
              )}
            </div>
            <div className="flex-1 overflow-auto">
              {fileContentLoading && selectedFile && !isLegacyMode ? (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <p>Loading file content...</p>
                </div>
              ) : getDisplayContent() ? (
                <CodeView
                  code={getDisplayContent()!}
                  language={getLanguageFromExtension(selectedFile)}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <p>No content available</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <p>Select a file to view its content</p>
          </div>
        )}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
};
