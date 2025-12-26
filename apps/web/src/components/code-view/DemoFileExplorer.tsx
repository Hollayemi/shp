import { CopyIcon } from "lucide-react";
import { useState, useCallback, useMemo } from "react";

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
import { getFilesForDemoStep } from "@/data/demo-file-data";

function getLanguageFromExtension(filename: string): string {
  const extension = filename.split(".").pop()?.toLowerCase();
  return extension || "text";
}

interface DemoFileExplorerProps {
  demoStep?: number;
}

export const DemoFileExplorer = ({ demoStep = 0 }: DemoFileExplorerProps) => {
  const [expanded, setExpanded] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  // Get demo files for current step
  const demoFiles = useMemo(() => {
    return getFilesForDemoStep(demoStep);
  }, [demoStep]);

  // Convert demo files to tree format
  const treeData = useMemo(() => {
    const result = convertFilesToTreeItems(demoFiles);
    // Only log when we actually have files to show
    if (Object.keys(demoFiles || {}).length > 0) {
      console.log(
        "[DemoFileExplorer] Tree built with",
        Object.keys(demoFiles).length,
        "files for step",
        demoStep,
      );
    }
    return result;
  }, [demoFiles, demoStep]);

  const handleSelect = useCallback(
    (path: string) => {
      // Check if file exists in the demo files
      const fileExists = demoFiles[path] !== undefined;

      if (fileExists) {
        setSelectedFile(path);
      }
    },
    [demoFiles],
  );

  const getDisplayContent = () => {
    if (selectedFile && demoFiles[selectedFile]) {
      return demoFiles[selectedFile];
    }
    return null;
  };

  const canCopyContent = () => {
    return selectedFile && demoFiles[selectedFile];
  };

  return (
    <ResizablePanelGroup
      direction="horizontal"
      className="min-h-0"
      id="demo-file-explorer-panels"
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
      <ResizableHandle className="hover:bg-primary transition-colors" />
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
              {getDisplayContent() ? (
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
