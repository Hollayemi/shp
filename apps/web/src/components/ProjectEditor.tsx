"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
const Editor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

import {
  FolderOpen,
  Folder,
  File,
  ChevronRight,
  ChevronDown,
  X,
  Download,
  Code,
  Eye,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import PreviewFrame from "./PreviewFrame";
import EditorChat from "./EditorChat";

interface ProjectFile {
  path: string;
  content: string;
  language: string;
}

interface GeneratedProject {
  name: string;
  framework: string;
  files: ProjectFile[];
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
  description: string;
}

interface ProjectEditorProps {
  project: GeneratedProject;
  onSave?: (project: GeneratedProject) => void;
}

interface FileTreeNode {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: FileTreeNode[];
  content?: string;
  language?: string;
}

export default function ProjectEditor({ project, onSave }: ProjectEditorProps) {
  const [openTabs, setOpenTabs] = useState<ProjectFile[]>([]);
  const [activeTab, setActiveTab] = useState<string>("");
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(),
  );
  const [showCodeEditor, setShowCodeEditor] = useState(false);
  const [isEditorFullscreen, setIsEditorFullscreen] = useState(false);
  const [isPreviewFullscreen, setIsPreviewFullscreen] = useState(false);

  // Build file tree from project files
  useEffect(() => {
    const tree: FileTreeNode[] = [];
    const folderMap = new Map<string, FileTreeNode>();

    // Sort files to ensure folders come first
    const sortedFiles = [...project.files].sort((a, b) => {
      const aDepth = a.path.split("/").length;
      const bDepth = b.path.split("/").length;
      if (aDepth !== bDepth) return aDepth - bDepth;
      return a.path.localeCompare(b.path);
    });

    sortedFiles.forEach((file) => {
      const parts = file.path.split("/");
      let currentPath = "";

      parts.forEach((part, index) => {
        const parentPath = currentPath;
        currentPath = currentPath ? `${currentPath}/${part}` : part;

        if (index === parts.length - 1) {
          // This is a file
          const fileNode: FileTreeNode = {
            name: part,
            path: currentPath,
            type: "file",
            content: file.content,
            language: file.language,
          };

          if (parentPath) {
            const parent = folderMap.get(parentPath);
            if (parent) {
              parent.children = parent.children || [];
              parent.children.push(fileNode);
            }
          } else {
            tree.push(fileNode);
          }
        } else {
          // This is a folder
          if (!folderMap.has(currentPath)) {
            const folderNode: FileTreeNode = {
              name: part,
              path: currentPath,
              type: "folder",
              children: [],
            };

            folderMap.set(currentPath, folderNode);

            if (parentPath) {
              const parent = folderMap.get(parentPath);
              if (parent) {
                parent.children = parent.children || [];
                parent.children.push(folderNode);
              }
            } else {
              tree.push(folderNode);
            }
          }
        }
      });
    });

    setFileTree(tree);

    // Auto-expand common folders and open main file
    const autoExpand = new Set([
      "src",
      "src/app",
      "src/components",
      "components",
    ]);
    setExpandedFolders(autoExpand);

    // Open main file by default
    const mainFiles = [
      "src/app/page.tsx",
      "src/App.tsx",
      "src/main.tsx",
      "index.html",
    ];
    const mainFile = project.files.find((f) => mainFiles.includes(f.path));
    if (mainFile) {
      setOpenTabs([mainFile]);
      setActiveTab(mainFile.path);
      // For multi-file projects, show code editor by default
      // For single HTML files, let user choose via button
      if (project.files.length > 1) {
        setShowCodeEditor(true);
      }
    }
  }, [project]);

  const getFileIcon = (fileName: string, isFolder: boolean) => {
    if (isFolder) {
      return expandedFolders.has(fileName) ? (
        <FolderOpen className="w-4 h-4" />
      ) : (
        <Folder className="w-4 h-4" />
      );
    }
    return <File className="w-4 h-4" />;
  };

  const getLanguageFromPath = (path: string): string => {
    const ext = path.split(".").pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      ts: "typescript",
      tsx: "typescript",
      js: "javascript",
      jsx: "javascript",
      vue: "vue",
      css: "css",
      scss: "scss",
      html: "html",
      json: "json",
      md: "markdown",
      yml: "yaml",
      yaml: "yaml",
    };
    return languageMap[ext || ""] || "plaintext";
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

  const openFile = (file: FileTreeNode) => {
    if (file.type === "folder") {
      toggleFolder(file.path);
      return;
    }

    const projectFile = project.files.find((f) => f.path === file.path);
    if (!projectFile) return;

    if (!openTabs.find((tab) => tab.path === file.path)) {
      setOpenTabs((prev) => [...prev, projectFile]);
    }
    setActiveTab(file.path);
    setShowCodeEditor(true);
  };

  const closeTab = (path: string) => {
    setOpenTabs((prev) => prev.filter((tab) => tab.path !== path));
    if (activeTab === path) {
      const remainingTabs = openTabs.filter((tab) => tab.path !== path);
      setActiveTab(
        remainingTabs.length > 0
          ? remainingTabs[remainingTabs.length - 1].path
          : "",
      );
      if (remainingTabs.length === 0) {
        setShowCodeEditor(false);
      }
    }
  };

  const updateFileContent = (path: string, content: string) => {
    // Update the project files
    const updatedFiles = project.files.map((file) =>
      file.path === path ? { ...file, content } : file,
    );

    // Update open tabs
    setOpenTabs((prev) =>
      prev.map((tab) => (tab.path === path ? { ...tab, content } : tab)),
    );

    // Call onSave if provided
    if (onSave) {
      onSave({ ...project, files: updatedFiles });
    }
  };

  const handleProjectUpdate = (updatedProject: GeneratedProject) => {
    // Update the entire project when the chat modifies it
    if (onSave) {
      onSave(updatedProject);
    }

    // Update open tabs with new content
    setOpenTabs((prev) =>
      prev.map((tab) => {
        const updatedFile = updatedProject.files.find(
          (f) => f.path === tab.path,
        );
        return updatedFile ? updatedFile : tab;
      }),
    );
  };

  const downloadProject = async () => {
    try {
      // Dynamically import JSZip
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      project.files.forEach((file) => {
        zip.file(file.path, file.content);
      });

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project.name}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error creating zip file:", error);
      alert("Failed to create download. Please try again.");
    }
  };

  const renderFileTree = (nodes: FileTreeNode[], depth = 0) => {
    return nodes.map((node) => (
      <div key={node.path}>
        <div
          className={`flex items-center gap-2 px-2 py-1 hover:bg-gray-100 cursor-pointer text-sm ${
            activeTab === node.path
              ? "bg-blue-50 text-blue-600"
              : "text-gray-700"
          }`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => openFile(node)}
        >
          {node.type === "folder" && (
            <span className="text-gray-400">
              {expandedFolders.has(node.path) ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </span>
          )}
          <span className="text-gray-500">
            {getFileIcon(node.path, node.type === "folder")}
          </span>
          <span className="truncate">{node.name}</span>
        </div>
        {node.type === "folder" &&
          expandedFolders.has(node.path) &&
          node.children && (
            <div>{renderFileTree(node.children, depth + 1)}</div>
          )}
      </div>
    ));
  };

  const activeFile = openTabs.find((tab) => tab.path === activeTab);
  // Ensure activeFile is always up-to-date with current project content
  const currentActiveFile = activeFile
    ? project.files.find((f) => f.path === activeFile.path) || activeFile
    : null;

  const isSingleHTMLFile =
    project.files.length === 1 &&
    project.files[0].path === "index.html" &&
    project.files[0].language === "html";

  // Fullscreen overlay for editor
  if (isEditorFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col">
        {/* Fullscreen Editor Header */}
        <div className="bg-gray-100 border-b border-gray-200 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">
              Code Editor
            </span>
            {currentActiveFile && (
              <span className="text-sm text-gray-500">
                {currentActiveFile.path}
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditorFullscreen(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            <Minimize2 className="w-4 h-4 mr-1" />
            Exit Fullscreen
          </Button>
        </div>

        {/* Fullscreen Editor */}
        <div className="flex-1">
          {currentActiveFile ? (
            <Editor
              height="100%"
              language={getLanguageFromPath(currentActiveFile.path)}
              value={currentActiveFile.content}
              onChange={(value) =>
                updateFileContent(currentActiveFile.path, value || "")
              }
              theme="vs-light"
              options={{
                minimap: { enabled: true },
                fontSize: 16,
                lineNumbers: "on",
                roundedSelection: false,
                scrollBeyondLastLine: false,
                automaticLayout: true,
                wordWrap: "on",
                tabSize: 2,
                insertSpaces: true,
                folding: true,
                lineDecorationsWidth: 10,
                lineNumbersMinChars: 3,
              }}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              <div className="text-center">
                <File className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>Select a file to start editing</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Fullscreen overlay for preview
  if (isPreviewFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col">
        {/* Fullscreen Preview Header */}
        <div className="bg-gray-100 border-b border-gray-200 px-4 py-2 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">
            Live Preview
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsPreviewFullscreen(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            <Minimize2 className="w-4 h-4 mr-1" />
            Exit Fullscreen
          </Button>
        </div>

        {/* Fullscreen Preview */}
        <div className="flex-1 bg-white">
          <PreviewFrame project={project} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex bg-gray-50">
      {/* LEFT PANEL: AI Chat */}
      <div className="w-96 flex-shrink-0">
        <EditorChat
          project={project}
          onProjectUpdate={handleProjectUpdate}
          className="h-full"
        />
      </div>

      {/* MIDDLE PANEL: Code Editor (Retractable) */}
      {showCodeEditor && (
        <div className="flex-1 max-w-2xl bg-white border-r border-gray-200 flex flex-col">
          {/* Code Editor Header */}
          <div className="bg-gray-100 border-b border-gray-200 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Code className="w-4 h-4" />
              <span className="text-sm font-medium text-gray-700">
                Code Editor
              </span>
              {currentActiveFile && (
                <span className="text-sm text-gray-500">
                  {currentActiveFile.path}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditorFullscreen(true)}
                className="text-gray-500 hover:text-gray-700"
              >
                <Maximize2 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCodeEditor(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="flex-1 flex">
            {/* File Tree Sidebar */}
            {project.files.length > 1 && (
              <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
                <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
                  <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                    Explorer
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {renderFileTree(fileTree)}
                </div>
              </div>
            )}

            {/* Editor Section */}
            <div className="flex-1 flex flex-col">
              {/* Tabs */}
              {openTabs.length > 0 && (
                <div className="bg-gray-100 border-b border-gray-200 flex items-center">
                  <div className="flex">
                    {openTabs.map((tab) => (
                      <div
                        key={tab.path}
                        className={`flex items-center gap-2 px-3 py-2 border-r border-gray-200 cursor-pointer text-sm ${
                          activeTab === tab.path
                            ? "bg-white text-gray-900"
                            : "text-gray-600 hover:text-gray-900"
                        }`}
                        onClick={() => setActiveTab(tab.path)}
                      >
                        <File className="w-3 h-3" />
                        <span>{tab.path.split("/").pop()}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            closeTab(tab.path);
                          }}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Editor */}
              <div className="flex-1">
                {currentActiveFile ? (
                  <Editor
                    height="100%"
                    language={getLanguageFromPath(currentActiveFile.path)}
                    value={currentActiveFile.content}
                    onChange={(value) =>
                      updateFileContent(currentActiveFile.path, value || "")
                    }
                    theme="vs-light"
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      lineNumbers: "on",
                      roundedSelection: false,
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      wordWrap: "on",
                      tabSize: 2,
                      insertSpaces: true,
                      folding: true,
                      lineDecorationsWidth: 10,
                      lineNumbersMinChars: 3,
                    }}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <File className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p>Select a file to start editing</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RIGHT PANEL: Live Preview */}
      <div className="flex-1 flex flex-col bg-white">
        {/* Preview Header */}
        <div className="bg-gray-100 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Eye className="w-4 h-4" />
            <h1 className="text-lg font-semibold text-gray-900">
              {project.name}
            </h1>
            <Badge variant="outline" className="text-xs">
              {project.framework}
            </Badge>
            <span className="text-sm text-gray-500">{project.description}</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (!showCodeEditor) {
                  // When showing code editor, ensure a file is loaded
                  if (openTabs.length === 0) {
                    const mainFile = project.files[0]; // For single HTML files, just take the first one
                    if (mainFile) {
                      setOpenTabs([mainFile]);
                      setActiveTab(mainFile.path);
                    }
                  }
                }
                setShowCodeEditor(!showCodeEditor);
              }}
            >
              <Code className="w-4 h-4 mr-1" />
              {showCodeEditor ? "Hide Code" : "Show Code"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsPreviewFullscreen(true)}
              className="text-gray-500 hover:text-gray-700"
            >
              <Maximize2 className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={downloadProject}>
              <Download className="w-4 h-4 mr-1" />
              Download
            </Button>
          </div>
        </div>

        {/* Preview Content */}
        <div className="flex-1 bg-white">
          <PreviewFrame project={project} />
        </div>
      </div>
    </div>
  );
}
