"use client";

import { useState, type ReactElement } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Trash2, FolderTree } from "lucide-react";

interface FileMetadata {
  size: number;
  modified: number;
}

interface SandboxInfo {
  sandboxId: string;
  sandboxUrl: string | null;
  files: Record<string, FileMetadata>;
  status: string;
}

const TEMPLATES = [
  {
    value: "database-vite-template",
    label: "Database Vite Template",
  },
  {
    value: "database-vite-todo-template",
    label: "Database Vite Todo Template",
  },
  {
    value: "database-vite-calculator-template",
    label: "Database Vite Calculator Template",
  },
  {
    value: "database-vite-content-sharing-template",
    label: "Database Vite Content Sharing Template",
  },
  {
    value: "database-vite-landing-page-template",
    label: "Database Vite Landing Page Template",
  },
  {
    value: "database-vite-tracker-template",
    label: "Database Vite Tracker Template",
  },
];

export default function TestModalClient() {
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [sandboxInfo, setSandboxInfo] = useState<SandboxInfo | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set()
  );
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState(false);

  const createSandbox = async () => {
    if (!selectedTemplate) {
      setError("Please select a template");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/test-modal/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: selectedTemplate }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create sandbox");
      }

      const data = await response.json();
      setSandboxInfo(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsCreating(false);
    }
  };

  const deleteSandbox = async () => {
    if (!sandboxInfo?.sandboxId) return;

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch("/api/test-modal/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sandboxId: sandboxInfo.sandboxId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete sandbox");
      }

      setSandboxInfo(null);
      setSelectedFile(null);
      setFileContent(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsDeleting(false);
    }
  };

  const loadFileContent = async (filePath: string) => {
    if (!sandboxInfo?.sandboxId) return;

    setIsLoadingFile(true);
    setSelectedFile(filePath);
    setFileContent(null);

    try {
      const response = await fetch("/api/test-modal/read-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sandboxId: sandboxInfo.sandboxId,
          filePath,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to read file");
      }

      const data = await response.json();
      setFileContent(data.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setSelectedFile(null);
    } finally {
      setIsLoadingFile(false);
    }
  };

  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const buildFileTree = (files: Record<string, FileMetadata>) => {
    const tree: Record<string, any> = {};

    Object.keys(files)
      .sort()
      .forEach((filePath) => {
        const parts = filePath.split("/");
        let current = tree;

        parts.forEach((part, index) => {
          if (!current[part]) {
            current[part] =
              index === parts.length - 1
                ? { __file: true, ...files[filePath] }
                : {};
          }
          current = current[part];
        });
      });

    return tree;
  };

  const renderTree = (
    tree: Record<string, any>,
    prefix: string = "",
    depth: number = 0
  ): ReactElement[] => {
    return Object.keys(tree).map((key) => {
      const value = tree[key];
      const isFile = value.__file;
      const currentPath = prefix ? `${prefix}/${key}` : key;

      if (isFile) {
        const sizeInKB = (value.size / 1024).toFixed(2);
        const isSelected = selectedFile === currentPath;
        return (
          <div
            key={currentPath}
            className={`flex items-center gap-2 py-1 text-sm font-mono cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950 rounded ${
              isSelected ? "bg-blue-100 dark:bg-blue-900" : ""
            }`}
            style={{ paddingLeft: `${depth * 20}px` }}
            onClick={() => loadFileContent(currentPath)}
          >
            <span className="text-blue-500 dark:text-blue-400">📄</span>
            <span className="text-gray-700 dark:text-gray-300">{key}</span>
            <span className="text-gray-400 dark:text-gray-500 text-xs">({sizeInKB} KB)</span>
          </div>
        );
      } else {
        const isExpanded = expandedFolders.has(currentPath);
        return (
          <div key={currentPath}>
            <div
              className="flex items-center gap-2 py-1 text-sm font-mono cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
              style={{ paddingLeft: `${depth * 20}px` }}
              onClick={() => toggleFolder(currentPath)}
            >
              <span className="text-yellow-500 dark:text-yellow-400">
                {isExpanded ? "📂" : "📁"}
              </span>
              <span className="text-gray-800 dark:text-gray-200 font-semibold">{key}</span>
            </div>
            {isExpanded && (
              <div>{renderTree(value, currentPath, depth + 1)}</div>
            )}
          </div>
        );
      }
    });
  };

  return (
    <div className="container mx-auto p-8 max-w-6xl">
      <div className="mb-4">
        <span className="text-sm text-gray-500">Admin Only</span>
      </div>
      <h1 className="text-3xl font-bold mb-8">Modal Sandbox Test</h1>

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 p-4 rounded mb-4">
          {error}
        </div>
      )}

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Create Sandbox</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATES.map((template) => (
                  <SelectItem key={template.value} value={template.value}>
                    {template.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              onClick={createSandbox}
              disabled={isCreating || !selectedTemplate || !!sandboxInfo}
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Sandbox"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {sandboxInfo && (
        <>
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Sandbox Info</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 font-mono text-sm">
                <div>
                  <span className="font-semibold">Sandbox ID:</span>{" "}
                  {sandboxInfo.sandboxId}
                </div>
                <div>
                  <span className="font-semibold">Status:</span>{" "}
                  {sandboxInfo.status}
                </div>
                {sandboxInfo.sandboxUrl && (
                  <div>
                    <span className="font-semibold">URL:</span>{" "}
                    <a
                      href={sandboxInfo.sandboxUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      {sandboxInfo.sandboxUrl}
                    </a>
                  </div>
                )}
                <div>
                  <span className="font-semibold">Total Files:</span>{" "}
                  {Object.keys(sandboxInfo.files).length}
                </div>
              </div>

              <Button
                onClick={deleteSandbox}
                disabled={isDeleting}
                variant="destructive"
                className="mt-4"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Sandbox
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderTree className="h-5 w-5" />
                  File Tree ({Object.keys(sandboxInfo.files).length} files)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded border border-gray-200 dark:border-gray-700 max-h-[600px] overflow-auto">
                  {Object.keys(sandboxInfo.files).length > 0 ? (
                    renderTree(buildFileTree(sandboxInfo.files))
                  ) : (
                    <div className="text-gray-500 dark:text-gray-400 text-center py-8">
                      No files found in sandbox
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  File Preview
                  {selectedFile && (
                    <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                      {selectedFile}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded border border-gray-200 dark:border-gray-700 max-h-[600px] overflow-auto">
                  {isLoadingFile ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-gray-400 dark:text-gray-500" />
                    </div>
                  ) : fileContent ? (
                    <pre className="text-xs font-mono whitespace-pre-wrap text-gray-900 dark:text-gray-100">
                      {fileContent}
                    </pre>
                  ) : (
                    <div className="text-gray-500 dark:text-gray-400 text-center py-8">
                      Click a file to preview
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
