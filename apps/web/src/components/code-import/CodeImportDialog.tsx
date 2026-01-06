"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  FolderOpen,
  Loader2,
  CheckCircle2,
  XCircle,
  FileCode,
  AlertCircle,
  X,
  ChevronDown,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ImportedFromPlatform } from "@/modules/code-import/server/procedures";
import { ImportCodeIcon } from "@/components/icons/ImportCodeIcon";
import { GithubTabIcon } from "@/components/icons/GithubTabIcon";
import { UploadTabIcon } from "@/components/icons/UploadTabIcon";
import { InfoCircleIcon } from "@/components/icons/InfoCircleIcon";
import { UploadDropzoneIcon } from "@/components/icons/UploadDropzoneIcon";
import { SelectChevronIcon } from "@/components/icons/SelectChevronIcon";

interface CodeImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: (projectId: string, initialPrompt?: string) => void;
}

type ImportStatus = "idle" | "importing" | "success" | "error";

export function CodeImportDialog({
  open,
  onOpenChange,
  onImportComplete,
}: CodeImportDialogProps) {
  const trpc = useTRPC();

  // Platform options for the dropdown
  const platformOptions: {
    value: ImportedFromPlatform;
    label: string;
    description: string;
    icon: React.ReactNode;
  }[] = [
    {
      value: "LOVABLE",
      label: "Lovable",
      description: "Supabase backend",
      icon: (
        <div className="h-7 w-7 rounded bg-gradient-to-br from-purple-500 to-pink-500" />
      ),
    },
    {
      value: "BASE44",
      label: "Base44",
      description: "Entity-based backend",
      icon: <div className="h-7 w-7 rounded bg-blue-500" />,
    },
    {
      value: "GENERIC_VITE",
      label: "Generic Vite/React",
      description: "No backend",
      icon: (
        <div className="h-7 w-7 rounded bg-gradient-to-br from-yellow-400 to-orange-500" />
      ),
    },
    {
      value: "OTHER",
      label: "Other",
      description: "Manual setup",
      icon: <div className="h-7 w-7 rounded bg-gray-400" />,
    },
  ];

  // State
  const [activeTab, setActiveTab] = useState<"github" | "upload">("github");
  const [githubUrl, setGithubUrl] = useState("");
  const [branch, setBranch] = useState("");
  const [importedFrom, setImportedFrom] = useState<
    ImportedFromPlatform | undefined
  >(undefined);
  const [importId, setImportId] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<ImportStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [initialPrompt, setInitialPrompt] = useState("");
  const [completedProjectId, setCompletedProjectId] = useState<string | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const promptInputRef = useRef<HTMLTextAreaElement>(null);

  // Reusable platform selector
  const renderPlatformSelector = (id: string) => (
    <div className="flex flex-col gap-1">
      <Label
        htmlFor={id}
        className="text-sm font-medium text-[#14201F] dark:text-[#14201F]"
      >
        Original Platform
      </Label>
      <Select
        value={importedFrom}
        onValueChange={(value) =>
          setImportedFrom(value as ImportedFromPlatform)
        }
      >
        <SelectTrigger
          id={id}
          className="h-auto w-full rounded-lg border-[#F2F2F2] bg-white px-2 py-2 text-sm shadow-[0px_1px_1.5px_rgba(44,54,53,0.03)] focus:ring-0 dark:border-[#F2F2F2] dark:bg-white [&>span]:text-[#898F8F] dark:[&>span]:text-[#898F8F] [&>svg]:hidden [&[data-state=open]>span]:text-[#14201F] dark:[&[data-state=open]>span]:text-[#14201F]"
        >
          <SelectValue placeholder="Select platform...">
            {importedFrom
              ? platformOptions.find((opt) => opt.value === importedFrom)?.label
              : "Select platform..."}
          </SelectValue>
          <SelectChevronIcon />
        </SelectTrigger>
        <SelectContent className="w-[284px] rounded-xl border-0 bg-white p-1 shadow-[0_1px_13.8px_1px_rgba(18,18,18,0.10)] dark:bg-white">
          {platformOptions.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              textValue={option.label}
              className="cursor-pointer rounded-lg p-1.5 transition-colors hover:bg-[#F9F9F9] focus:bg-[#F9F9F9] data-[state=checked]:bg-[#F0FDF4]"
            >
              <div className="flex items-center gap-2">
                {/* {option.icon} */}
                <div className="flex flex-col">
                  <span className="text-sm leading-5 font-medium text-[#09090B]">
                    {option.label}
                  </span>
                  {/* <span className="text-[13px] leading-[18px] text-[#8B8B8B]">
                    {option.description}
                  </span> */}
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex items-center gap-1.5">
        <InfoCircleIcon className="h-4 w-4 text-[#8B8B8B]" />
        <span className="text-xs text-[#8B8B8B] dark:text-[#8B8B8B]">
          Helps us migrate your backend correctly
        </span>
      </div>
    </div>
  );

  // Mutations
  const importFromGitHub = useMutation(
    trpc.codeImport.importFromGitHub.mutationOptions({
      onSuccess: (data) => {
        setImportId(data.importId);
        setImportStatus("importing");
      },
      onError: (error) => {
        console.error(
          "[CodeImportDialog] Failed to start GitHub import",
          error,
        );
        setImportStatus("error");
        setErrorMessage("An error occurred.");
        toast.error("An error occurred.");
      },
    }),
  );

  const importFromUpload = useMutation(
    trpc.codeImport.importFromUpload.mutationOptions({
      onSuccess: (data) => {
        setImportId(data.importId);
        setImportStatus("importing");
      },
      onError: (error) => {
        console.error(
          "[CodeImportDialog] Failed to start upload import",
          error,
        );
        setImportStatus("error");
        setErrorMessage("An error occurred.");
        toast.error("An error occurred.");
      },
    }),
  );

  // Poll import status
  const { data: statusData } = useQuery({
    ...trpc.codeImport.getStatus.queryOptions({ importId: importId! }),
    enabled: !!importId && importStatus === "importing",
    refetchInterval: 1000, // Poll every second
  });

  // Handle status updates
  useEffect(() => {
    if (!statusData) return;

    if (statusData.status === "COMPLETED" && statusData.projectId) {
      setImportStatus("success");
      setCompletedProjectId(statusData.projectId);
      toast.success("Import completed!", {
        description: `Imported ${statusData.fileCount} files`,
      });
      // Focus the prompt input after a short delay
      setTimeout(() => {
        promptInputRef.current?.focus();
      }, 100);
    } else if (statusData.status === "FAILED") {
      console.error("[CodeImportDialog] Import failed", {
        importId,
        errorMessage: statusData.errorMessage,
      });
      setImportStatus("error");
      setErrorMessage("An error occurred.");
      toast.error("An error occurred.");
    }
  }, [importId, statusData]);

  // Handlers
  const handleClose = useCallback(() => {
    if (importStatus === "importing") {
      // Could add cancel confirmation here
    }
    setImportStatus("idle");
    setImportId(null);
    setGithubUrl("");
    setBranch("");
    setImportedFrom(undefined);
    setErrorMessage(null);
    setInitialPrompt("");
    setCompletedProjectId(null);
    onOpenChange(false);
  }, [importStatus, onOpenChange]);

  // Handle continue to project
  const handleContinueToProject = useCallback(() => {
    if (completedProjectId) {
      onImportComplete?.(completedProjectId, initialPrompt.trim() || undefined);
      handleClose();
    }
  }, [completedProjectId, initialPrompt, onImportComplete, handleClose]);

  const handleGitHubImport = useCallback(() => {
    if (!githubUrl.trim()) {
      toast.error("Please enter a GitHub URL");
      return;
    }

    if (!importedFrom) {
      toast.error("Please select the original platform");
      return;
    }

    // Basic URL validation
    try {
      const url = new URL(githubUrl);
      if (!url.hostname.includes("github.com")) {
        toast.error("Please enter a valid GitHub URL");
        return;
      }
    } catch {
      toast.error("Please enter a valid URL");
      return;
    }

    setImportStatus("importing");
    importFromGitHub.mutate({
      repoUrl: githubUrl.trim(),
      branch: branch.trim() || undefined,
      importedFrom,
    });
  }, [githubUrl, branch, importedFrom, importFromGitHub]);

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);

      if (fileArray.length === 0) {
        toast.error("No files selected");
        return;
      }

      // Check if it's a single ZIP file
      const isZip =
        fileArray.length === 1 && fileArray[0].name.endsWith(".zip");

      // Convert files to base64
      const filesMap: Record<string, string> = {};

      try {
        for (const file of fileArray) {
          // Get relative path (for folder uploads) or just filename
          const path = (file as any).webkitRelativePath || file.name;

          // Skip if path contains node_modules or other ignored patterns
          if (
            path.includes("node_modules") ||
            path.includes(".git/") ||
            path.includes("dist/") ||
            path.includes(".next/")
          ) {
            continue;
          }

          const content = await readFileAsBase64OrText(file, isZip);
          if (content !== null) {
            filesMap[path] = content;
          }
        }

        if (Object.keys(filesMap).length === 0) {
          toast.error("No valid files found");
          return;
        }

        // Determine source name
        let sourceName = "Uploaded files";
        if (isZip) {
          sourceName = fileArray[0].name;
        } else if (fileArray.length > 0) {
          // Try to get folder name from path
          const firstPath = (fileArray[0] as any).webkitRelativePath;
          if (firstPath) {
            sourceName = firstPath.split("/")[0];
          }
        }

        if (!importedFrom) {
          toast.error("Please select the original platform first");
          return;
        }

        setImportStatus("importing");
        importFromUpload.mutate({
          files: filesMap,
          sourceName,
          isFolder: !isZip && fileArray.length > 1,
          importedFrom,
        });
      } catch (error) {
        console.error("[CodeImportDialog] Error processing files", error);
        toast.error("An error occurred.");
      }
    },
    [importFromUpload, importedFrom],
  );

  const readFileAsBase64OrText = (
    file: File,
    asBase64: boolean,
  ): Promise<string | null> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (asBase64) {
          // For ZIP files, we need base64
          const result = reader.result as string;
          // Remove data URL prefix
          const base64 = result.split(",")[1];
          resolve(base64);
        } else {
          resolve(reader.result as string);
        }
      };
      reader.onerror = () => {
        console.warn(`Failed to read file: ${file.name}`);
        resolve(null);
      };

      if (asBase64) {
        reader.readAsDataURL(file);
      } else {
        reader.readAsText(file);
      }
    });
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const items = e.dataTransfer.items;
      const files: File[] = [];

      // Handle folder drops
      const processEntry = async (entry: FileSystemEntry): Promise<File[]> => {
        const results: File[] = [];

        if (entry.isFile) {
          const fileEntry = entry as FileSystemFileEntry;
          const file = await new Promise<File>((resolve) => {
            fileEntry.file(resolve);
          });
          // Preserve the full path
          Object.defineProperty(file, "webkitRelativePath", {
            value: entry.fullPath.slice(1), // Remove leading slash
            writable: false,
          });
          results.push(file);
        } else if (entry.isDirectory) {
          const dirEntry = entry as FileSystemDirectoryEntry;
          const reader = dirEntry.createReader();
          const entries = await new Promise<FileSystemEntry[]>((resolve) => {
            reader.readEntries(resolve);
          });
          for (const childEntry of entries) {
            const childFiles = await processEntry(childEntry);
            results.push(...childFiles);
          }
        }

        return results;
      };

      // Process dropped items
      (async () => {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const entry = item.webkitGetAsEntry?.();
          if (entry) {
            const entryFiles = await processEntry(entry);
            files.push(...entryFiles);
          }
        }

        if (files.length > 0) {
          processFiles(files);
        }
      })();
    },
    [processFiles],
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        processFiles(e.target.files);
      }
    },
    [processFiles],
  );

  // Render progress or status
  const renderProgress = () => {
    if (importStatus === "idle") return null;

    const progress = statusData?.progress || 0;
    const statusMessage = statusData?.statusMessage || "Starting import...";

    return (
      <div className="mt-6 space-y-4">
        <div className="flex items-center gap-3">
          {importStatus === "importing" && (
            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
          )}
          {importStatus === "success" && (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          )}
          {importStatus === "error" && (
            <XCircle className="h-5 w-5 text-red-500" />
          )}
          <span className="text-sm font-medium">
            {importStatus === "success"
              ? "Import completed!"
              : importStatus === "error"
                ? "Import failed"
                : statusMessage}
          </span>
        </div>

        {importStatus === "importing" && (
          <Progress value={progress} className="h-2" />
        )}

        {statusData?.detectedFramework && importStatus !== "error" && (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <FileCode className="h-4 w-4" />
            <span>
              Detected: <strong>{statusData.detectedFramework}</strong>
              {statusData.fileCount && ` • ${statusData.fileCount} files`}
            </span>
          </div>
        )}

        {/* Success state: Show prompt input */}
        {importStatus === "success" && (
          <div className="space-y-3 pt-2">
            <Label htmlFor="initial-prompt">
              What would you like to do with this project?
            </Label>
            <Textarea
              ref={promptInputRef}
              id="initial-prompt"
              placeholder="e.g., Add a dark mode toggle, Fix the login page styling, Add user authentication..."
              value={initialPrompt}
              onChange={(e) => setInitialPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleContinueToProject();
                }
              }}
              className="min-h-[80px] resize-none"
            />
            <div className="flex gap-2">
              <Button onClick={handleContinueToProject} className="flex-1">
                Continue to Project
              </Button>
              <Button variant="outline" onClick={handleContinueToProject}>
                Skip
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              Press Enter to continue, or skip to explore the project first
            </p>
          </div>
        )}

        {importStatus === "error" && errorMessage && (
          <div className="flex items-start gap-2 rounded-md bg-red-500/10 p-3 text-sm text-red-500">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {importStatus === "error" && (
          <Button
            variant="outline"
            onClick={() => {
              setImportStatus("idle");
              setImportId(null);
              setErrorMessage(null);
            }}
          >
            Try Again
          </Button>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="gap-0 overflow-hidden rounded-2xl border-0 bg-white p-0 shadow-[0px_1px_3px_rgba(0,0,0,0.05)] sm:max-w-[483px] dark:bg-white"
        showCloseButton={false}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-[#E8E5DF] p-4 dark:border-[#E8E5DF]">
          <div className="flex flex-1 items-start gap-3">
            <div className="flex items-center justify-center rounded-[9px] bg-[#F3F3EE] p-[9px] dark:bg-[#F3F3EE]">
              <ImportCodeIcon className="h-6 w-6 text-[#1C1C1C]" />
            </div>
            <div className="flex flex-1 flex-col gap-0.5">
              <h2 className="text-base font-semibold text-[#141414] dark:text-[#141414]">
                Import Code
              </h2>
              <p className="text-sm leading-5 text-[#525252] dark:text-[#525252]">
                Import an existing codebase from GitHub or
                <br />
                upload files directly
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="flex h-6 w-6 items-center justify-center rounded-md border border-[#DCDEDD] bg-[#FCFCF9] hover:bg-[#F3F3EE] dark:border-[#DCDEDD] dark:bg-[#FCFCF9] dark:hover:bg-[#F3F3EE]"
          >
            <X className="h-4 w-4 text-[#1C1C1C]" />
          </button>
        </div>

        {importStatus === "idle" ? (
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as "github" | "upload")}
            className="gap-0"
          >
            {/* Tabs */}
            <TabsList className="grid h-auto w-full grid-cols-2 rounded-none border-b border-[#F3F3EE] bg-transparent p-0 dark:border-[#F3F3EE] dark:bg-transparent">
              <TabsTrigger
                value="github"
                className={cn(
                  "flex items-center justify-center gap-2 rounded-none border-b-2 border-transparent px-3.5 py-3 text-sm font-medium transition-colors hover:bg-[#FAFAFA] data-[state=active]:border-b-[#1E9A80] data-[state=active]:bg-[#F0FDF4] data-[state=active]:text-[#1E9A80] data-[state=active]:shadow-none data-[state=inactive]:text-[#8B8B8B] dark:hover:bg-[#FAFAFA] dark:data-[state=active]:border-b-[#1E9A80] dark:data-[state=active]:bg-[#F0FDF4] dark:data-[state=active]:text-[#1E9A80] dark:data-[state=inactive]:text-[#8B8B8B]",
                )}
              >
                <GithubTabIcon active={activeTab === "github"} />
                Github
              </TabsTrigger>
              <TabsTrigger
                value="upload"
                className={cn(
                  "flex items-center justify-center gap-2 rounded-none border-b-2 border-transparent px-3.5 py-3 text-sm font-medium transition-colors hover:bg-[#FAFAFA] data-[state=active]:border-b-[#1E9A80] data-[state=active]:bg-[#F0FDF4] data-[state=active]:text-[#1E9A80] data-[state=active]:shadow-none data-[state=inactive]:text-[#8B8B8B] dark:hover:bg-[#FAFAFA] dark:data-[state=active]:border-b-[#1E9A80] dark:data-[state=active]:bg-[#F0FDF4] dark:data-[state=active]:text-[#1E9A80] dark:data-[state=inactive]:text-[#8B8B8B]",
                )}
              >
                <UploadTabIcon active={activeTab === "upload"} />
                Upload
              </TabsTrigger>
            </TabsList>

            {/* Content */}
            <TabsContent value="github" className="mt-0">
              <div className="flex flex-col gap-4 px-4 pt-4 pb-6">
                <div className="flex flex-col gap-3 rounded-xl p-2">
                  {/* Repository URL */}
                  <div className="flex flex-col gap-1">
                    <Label
                      htmlFor="github-url"
                      className="text-sm font-medium text-[#14201F] dark:text-[#14201F]"
                    >
                      Repository URL
                    </Label>
                    <div className="flex overflow-hidden rounded-lg border border-[#F2F2F2] bg-white shadow-[0px_1px_1.5px_rgba(44,54,53,0.03)] dark:border-[#F2F2F2] dark:bg-white">
                      <div className="my-1 ml-1 flex items-center rounded-[4px] bg-[#F3F3EE] px-1.5 py-1 dark:bg-[#F3F3EE]">
                        <span className="text-sm text-[#14201F] dark:text-[#14201F]">
                          https://
                        </span>
                      </div>
                      <Input
                        id="github-url"
                        placeholder="github.com/owner/repo"
                        value={githubUrl.replace(/^https?:\/\//, "")}
                        onChange={(e) =>
                          setGithubUrl(
                            `https://${e.target.value.replace(/^https?:\/\//, "")}`,
                          )
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleGitHubImport();
                        }}
                        className="flex-1 border-0 bg-white text-sm text-[#14201F] shadow-none placeholder:text-[#898F8F] focus-visible:ring-0 dark:bg-white dark:text-[#14201F] dark:placeholder:text-[#898F8F] [&:-webkit-autofill]:bg-white [&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_white] [&:-webkit-autofill]:[-webkit-text-fill-color:#14201F]"
                      />
                    </div>
                  </div>

                  {/* Branch */}
                  <div className="flex flex-col gap-1">
                    <Label
                      htmlFor="branch"
                      className="text-sm font-medium text-[#14201F] dark:text-[#14201F]"
                    >
                      Branch (optional)
                    </Label>
                    <div className="overflow-hidden rounded-lg border border-[#F2F2F2] bg-white shadow-[0px_1px_1.5px_rgba(44,54,53,0.03)] dark:border-[#F2F2F2] dark:bg-white">
                      <Input
                        id="branch"
                        placeholder="main"
                        value={branch}
                        onChange={(e) => setBranch(e.target.value)}
                        className="border-0 bg-white text-sm text-[#14201F] shadow-none placeholder:text-[#898F8F] focus-visible:ring-0 dark:bg-white dark:text-[#14201F] dark:placeholder:text-[#898F8F] [&:-webkit-autofill]:bg-white [&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_white] [&:-webkit-autofill]:[-webkit-text-fill-color:#14201F]"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <InfoCircleIcon className="h-4 w-4 text-[#8B8B8B]" />
                      <span className="text-xs text-[#8B8B8B]">
                        Leave empty to use the default branch
                      </span>
                    </div>
                  </div>

                  {/* Original Platform */}
                  {renderPlatformSelector("platform")}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="upload" className="mt-0">
              <div className="flex flex-col gap-4 px-4 pt-4 pb-6">
                {/* Drop zone */}
                <div
                  className={cn(
                    "relative flex h-[208px] cursor-pointer flex-col items-center justify-center rounded-[10px] border border-dashed border-[#E8E5DF] bg-[#FCFCF9] px-6 py-16 transition-colors dark:border-[#E8E5DF] dark:bg-[#FCFCF9]",
                    isDragging &&
                      "border-[#1E9A80] bg-[#F0FDF4] dark:border-[#1E9A80] dark:bg-[#F0FDF4]",
                  )}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="flex flex-col items-center gap-4">
                    <UploadDropzoneIcon className="h-6 w-6 text-[#525252]" />
                    <div className="text-center">
                      <span className="text-sm text-[#525252] dark:text-[#525252]">
                        Drag folder or click to upload .zip
                      </span>
                      <br />
                      <span className="text-sm font-semibold text-[#1E9A80] dark:text-[#1E9A80]">
                        Supports folders .zip
                      </span>
                    </div>
                  </div>
                </div>

                {/* Hidden file inputs */}
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  multiple
                  accept=".zip,.tar.gz,.js,.jsx,.ts,.tsx,.json,.html,.css,.md,.txt,.yaml,.yml,.env,.gitignore"
                  onChange={handleFileInputChange}
                />
                <input
                  ref={folderInputRef}
                  type="file"
                  className="hidden"
                  {...({ webkitdirectory: "true" } as any)}
                  onChange={handleFileInputChange}
                />

                {/* Platform selector */}
                {renderPlatformSelector("platform-upload")}
              </div>
            </TabsContent>

            {/* Footer */}
            <div className="border-t border-[#E8E5DF] p-4 dark:border-[#E8E5DF]">
              <Button
                onClick={
                  activeTab === "github"
                    ? handleGitHubImport
                    : () => fileInputRef.current?.click()
                }
                disabled={
                  activeTab === "github"
                    ? !githubUrl.trim() ||
                      !importedFrom ||
                      importFromGitHub.isPending
                    : !importedFrom
                }
                className="w-full rounded-lg bg-[#1E9A80] py-2 text-base font-medium text-white hover:bg-[#1A8A72] dark:bg-[#1E9A80] dark:text-white dark:hover:bg-[#1A8A72]"
              >
                {importFromGitHub.isPending || importFromUpload.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : activeTab === "github" ? (
                  "Import from Github"
                ) : (
                  "Upload and Import"
                )}
              </Button>
            </div>
          </Tabs>
        ) : (
          <div className="p-4">{renderProgress()}</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
