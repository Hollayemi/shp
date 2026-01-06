"use client";
import { useState, useEffect, Fragment, useRef, useMemo } from "react";
import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  MessageSquare,
  Sparkles,
  ArrowLeft,
  User,
  Code,
  Server,
  Play,
  Terminal,
  RefreshCw,
  FileText,
  FolderOpen,
  File,
  GitBranch,
  ChevronRight,
  ChevronDown,
  Folder,
  Copy,
  Check,
  Cloud,
  Zap,
  Activity,
  Database,
  HardDrive,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Response } from "@/components/ai-elements/response";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { m } from "framer-motion";

interface AdminProjectDetailClientProps {
  projectId: string;
}

export default function AdminProjectDetailClient({
  projectId,
}: AdminProjectDetailClientProps) {
  const trpc = useTRPC();
  const searchParams = useSearchParams();
  const highlightMessageId = searchParams.get("messageId");
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("messages");
  const [showRawMessages, setShowRawMessages] = useState<{
    [key: string]: boolean;
  }>({});
  const [command, setCommand] = useState("");
  const [commandOutput, setCommandOutput] = useState("");
  const [autoRefreshLogs, setAutoRefreshLogs] = useState(false);
  const [nextRefreshIn, setNextRefreshIn] = useState(3);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileSearchQuery, setFileSearchQuery] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(["/workspace"]), // Start with root expanded
  );
  const [expandedFragments, setExpandedFragments] = useState<Set<string>>(
    new Set(),
  );
  const [selectedFragmentFile, setSelectedFragmentFile] = useState<{
    fragmentId: string;
    filePath: string;
  } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(
    new Set(),
  );

  // Copy ID to clipboard
  const formatCopyValue = (value: unknown) => {
    if (value === null || value === undefined) return "";
    if (typeof value === "string") return value;
    try {
      return JSON.stringify(value, null, 2);
    } catch (error) {
      console.error("Failed to stringify copy value:", error);
      return String(value);
    }
  };

  const copyToClipboard = (value: unknown, label: string) => {
    const text = formatCopyValue(value);
    if (!text) {
      toast.warning("Nothing to copy", {
        description: "No content available to copy",
      });
      return;
    }

    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopiedId(label);
        const preview = text.length > 180 ? `${text.slice(0, 180)}...` : text;
        toast.success("Copied to clipboard", { description: preview });
        setTimeout(() => {
          setCopiedId((prev) => (prev === label ? null : prev));
        }, 2000);
      })
      .catch((err) => {
        console.error("Failed to copy to clipboard:", err);
        toast.error("Failed to copy to clipboard.");
      });
  };

  // Toggle raw view for a specific message
  const toggleRawView = (messageId: string) => {
    setShowRawMessages((prev) => ({
      ...prev,
      [messageId]: !prev[messageId],
    }));
  };

  const toggleMessage = (messageId: string) => {
    setExpandedMessages((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  };

  // Toggle folder expansion
  const toggleFolder = (folderPath: string) => {
    setExpandedFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(folderPath)) {
        newSet.delete(folderPath);
      } else {
        newSet.add(folderPath);
      }
      return newSet;
    });
  };

  // Build file tree structure
  type FileNode = {
    name: string;
    path: string;
    isDirectory: boolean;
    children?: FileNode[];
    size?: number;
  };

  const buildFileTree = (files: Array<{ path: string; size: number }>) => {
    const root: FileNode = {
      name: "workspace",
      path: "/workspace",
      isDirectory: true,
      children: [],
    };

    files.forEach((file) => {
      const parts = file.path.split("/").filter(Boolean);
      let currentNode = root;

      parts.forEach((part, index) => {
        const isLastPart = index === parts.length - 1;
        const currentPath = "/" + parts.slice(0, index + 1).join("/");

        if (!currentNode.children) {
          currentNode.children = [];
        }

        let childNode = currentNode.children.find(
          (child) => child.name === part,
        );

        if (!childNode) {
          childNode = {
            name: part,
            path: currentPath,
            isDirectory: !isLastPart,
            children: isLastPart ? undefined : [],
            size: isLastPart ? file.size : undefined,
          };
          currentNode.children.push(childNode);
        }

        if (!isLastPart) {
          currentNode = childNode;
        }
      });
    });

    // Sort children: directories first, then files, both alphabetically
    const sortNodes = (nodes: FileNode[]) => {
      nodes.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
      nodes.forEach((node) => {
        if (node.children) {
          sortNodes(node.children);
        }
      });
    };

    if (root.children) {
      sortNodes(root.children);
    }

    return root;
  };

  // Fetch sandbox status
  const {
    data: sandboxData,
    isLoading: sandboxLoading,
    refetch: refetchSandbox,
  } = useQuery({
    ...trpc.admin.getProjectSandbox.queryOptions({ projectId }),
  });

  // Fetch dev logs
  const {
    data: logsData,
    isLoading: logsLoading,
    refetch: refetchLogs,
    dataUpdatedAt,
  } = useQuery({
    ...trpc.admin.getProjectDevLogs.queryOptions({ projectId }),
    refetchInterval: autoRefreshLogs ? 3000 : false, // Auto-refresh every 3s if enabled
  });

  // Fetch file list
  const {
    data: filesData,
    isLoading: filesLoading,
    refetch: refetchFiles,
  } = useQuery({
    ...trpc.admin.listProjectFiles.queryOptions({ projectId }),
    enabled: sandboxData?.isActive ?? false,
  });

  // Fetch file content
  const { data: fileContentData, isLoading: fileContentLoading } = useQuery({
    ...trpc.admin.readProjectFile.queryOptions({
      projectId,
      filePath: selectedFile || "",
    }),
    enabled: !!selectedFile,
  });

  // Fetch fragments
  const { data: fragmentsData, isLoading: fragmentsLoading } = useQuery({
    ...trpc.admin.getProjectFragments.queryOptions({ projectId, limit: 20 }),
  });

  // Load fragment mutation
  const loadFragmentMutation = useMutation(
    trpc.admin.loadProjectFragment.mutationOptions(),
  );

  // Countdown timer for next refresh
  useEffect(() => {
    if (!autoRefreshLogs) {
      setNextRefreshIn(3);
      return;
    }

    const interval = setInterval(() => {
      const timeSinceUpdate = Date.now() - dataUpdatedAt;
      const timeUntilNext = Math.max(
        0,
        Math.ceil((3000 - timeSinceUpdate) / 1000),
      );
      setNextRefreshIn(timeUntilNext);
    }, 100);

    return () => clearInterval(interval);
  }, [autoRefreshLogs, dataUpdatedAt]);

  // Fetch project details
  const {
    data: projectData,
    isLoading,
    error,
  } = useQuery(
    trpc.admin.getProjectDetails.queryOptions({
      projectId,
    }),
  );

  // Get messages from project data (may be undefined during loading)
  // Get messages from project data (may be undefined during loading)
  const messages = useMemo(() => projectData?.messages ?? [], [projectData]);

  // Scroll to and highlight message from URL param
  // This must be called unconditionally before any early returns
  useEffect(() => {
    if (!highlightMessageId || !messages || messages.length === 0) return;

    // First, ensure the messages tab is active
    setActiveTab("messages");

    // Expand the highlighted message
    setExpandedMessages((prev) => {
      const next = new Set(prev);
      next.add(highlightMessageId);
      return next;
    });

    // Set highlight state for visual feedback
    setHighlightedMessageId(highlightMessageId);

    // Clear highlight after animation
    const clearTimer = setTimeout(() => {
      setHighlightedMessageId(null);
    }, 3000);

    // Scroll to the message element after a short delay to let DOM render
    const scrollTimer = setTimeout(() => {
      const messageElement = messageRefs.current.get(highlightMessageId);
      if (messageElement) {
        messageElement.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100);

    return () => {
      clearTimeout(clearTimer);
      clearTimeout(scrollTimer);
    };
  }, [highlightMessageId, messages]);

  // Start sandbox and dev server mutation
  const startSandboxMutation = useMutation(
    trpc.admin.startProjectSandbox.mutationOptions(),
  );

  // Execute command mutation
  const executeCommandMutation = useMutation(
    trpc.admin.executeProjectCommand.mutationOptions(),
  );

  // Inject monitor script mutation
  const injectMonitorMutation = useMutation(
    trpc.admin.injectMonitorScript.mutationOptions(),
  );

  const handleStartSandbox = async () => {
    try {
      const data = await startSandboxMutation.mutateAsync({ projectId });
      console.log("Start sandbox result:", data);

      // Refetch both sandbox data and logs to update UI
      refetchSandbox();
      refetchLogs();

      if (data.devServerStarted) {
        toast.success("Sandbox & Dev Server Started", {
          description:
            "Both the sandbox and dev server are running successfully!",
        });
      } else {
        toast.warning("Sandbox Started", {
          description: data.message,
        });
      }
    } catch (error) {
      console.error("Error starting sandbox:", error);
      toast.error("Failed to Start Sandbox", {
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  };

  const handleExecuteCommand = async () => {
    if (!command.trim()) return;

    try {
      const data = await executeCommandMutation.mutateAsync({
        projectId,
        command,
      });
      setCommandOutput(data.result || "Command executed successfully");
      setCommand("");

      toast.success("Command Executed", {
        description: "Check the output below",
      });
    } catch (error) {
      console.error("Error executing command:", error);
      toast.error("Command Failed", {
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  };

  const handleInjectMonitor = async () => {
    try {
      const data = await injectMonitorMutation.mutateAsync({ projectId });

      if (data.alreadyInjected) {
        toast.info("Monitor Already Injected", {
          description: data.message,
        });
      } else {
        toast.success("Monitor Script Injected", {
          description: data.message,
        });
      }

      // Refetch files to update UI
      refetchFiles();
    } catch (error) {
      console.error("Error injecting monitor script:", error);
      toast.error("Failed to Inject Monitor", {
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  };

  const handleLoadFragment = async (fragmentId: string) => {
    try {
      const data = await loadFragmentMutation.mutateAsync({
        projectId,
        fragmentId,
      });

      toast.success("Fragment Loaded", {
        description: data.message,
      });

      // Refetch sandbox data and files to update UI
      refetchSandbox();
      refetchFiles();
    } catch (error) {
      console.error("Error loading fragment:", error);
      toast.error("Failed to Load Fragment", {
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  };

  // Helper to parse and detect if content is JSON with tool calls
  const parseMessageContent = (content: string) => {
    try {
      const parsed = JSON.parse(content);
      return { parsed, isJson: true };
    } catch {
      return { parsed: content, isJson: false };
    }
  };

  const truncateText = (text: string, max = 140) => {
    if (!text) return "";
    return text.length > max ? `${text.slice(0, max)}…` : text;
  };

  const getMessagePreview = (message: any, max = 140) => {
    const { parsed, isJson } = parseMessageContent(message.content);
    let text = "";

    if (isJson && Array.isArray(parsed)) {
      text = parsed
        .filter((part: any) => part?.type === "text")
        .map((part: any) => part.text || part.content || "")
        .join(" ")
        .trim();
    } else if (typeof parsed === "string") {
      text = parsed;
    } else {
      text = message.content || "";
    }

    return truncateText(text, max);
  };

  // Helper to render assistant message content
  const renderAssistantContent = (message: any, messageId: string) => {
    const { parsed, isJson } = parseMessageContent(message.content);

    if (showRawMessages[messageId]) {
      // Show raw JSON
      return (
        <pre className="max-h-96 overflow-auto rounded bg-gray-100 p-3 font-mono text-xs dark:bg-gray-800 dark:text-gray-200">
          {isJson ? JSON.stringify(parsed, null, 2) : message.content}
        </pre>
      );
    }

    // Check if it's a tool call message with the new format (type, toolCallId, state, input, output)
    if (
      isJson &&
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      parsed[0].type
    ) {
      return (
        <Accordion type="multiple" className="space-y-3">
          {parsed.map((item: any, idx: number) => {
            // Text content accordion
            if (item.type === "text") {
              return (
                <AccordionItem value={`text-${idx}`} key={`text-${idx}`}>
                  <AccordionTrigger className="gap-2 text-sm font-medium">
                    <Badge
                      variant="outline"
                      className="bg-blue-100 text-xs dark:bg-blue-900"
                    >
                      Text
                    </Badge>
                    <span className="truncate text-left text-gray-700 dark:text-gray-200">
                      {(item.text || item.content || "").toString().slice(0, 80) || "(empty)"}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="mb-2 flex justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Copy text"
                        onClick={() =>
                          copyToClipboard(
                            formatCopyValue(item.text || item.content || ""),
                            `text-${messageId}-${idx}`,
                          )
                        }
                      >
                        {copiedId === `text-${messageId}-${idx}` ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <Response>{item.text || item.content || ""}</Response>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            }

            // Tool calls -> split input/output into their own accordion items
            if (item.type && item.type.startsWith("tool-")) {
              const toolName =
                item.toolName || item.type?.replace("tool-", "") || "Unknown Tool";
              const hasOutput =
                (item.state === "output-available" && item.output) ||
                (item.state === "result" && item.result !== undefined);
              const inputData = item.input || item.args;
              const outputData = item.output || item.result;
              const stateLabel =
                item.state === "output-available" || item.state === "result"
                  ? "result"
                  : item.state;

              return (
                <Fragment key={`tool-${idx}`}>
                  {inputData && (
                    <AccordionItem value={`tool-${idx}-input`}>
                      <AccordionTrigger className="gap-2 text-sm font-medium">
                        <Badge
                          variant="outline"
                          className="bg-amber-100 text-xs dark:bg-amber-900"
                        >
                          Input
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] uppercase">
                          {toolName}
                        </Badge>
                        {(item.toolCallId || item.toolInvocationId) && (
                          <span className="font-mono text-[11px] text-gray-500 dark:text-gray-400">
                            {(item.toolCallId || item.toolInvocationId).slice(-8)}
                          </span>
                        )}
                        {stateLabel && (
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {stateLabel}
                          </Badge>
                        )}
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="mb-2 flex justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Copy input"
                            onClick={() =>
                              copyToClipboard(
                                formatCopyValue(inputData),
                                `input-${messageId}-${idx}`,
                              )
                            }
                          >
                            {copiedId === `input-${messageId}-${idx}` ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                        <pre className="max-h-60 overflow-auto rounded border border-amber-200 bg-white p-2 font-mono text-xs dark:border-amber-800 dark:bg-gray-800 dark:text-gray-200">
                          {JSON.stringify(inputData, null, 2)}
                        </pre>
                        {(inputData as { description?: string })?.description && (
                          <div className="mt-2 text-xs italic text-gray-600 dark:text-gray-400">
                            {(inputData as { description?: string }).description}
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {hasOutput && (
                    <AccordionItem value={`tool-${idx}-output`}>
                      <AccordionTrigger className="gap-2 text-sm font-medium">
                        <Badge
                          variant="outline"
                          className="bg-green-100 text-xs dark:bg-green-900"
                        >
                          Output
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] uppercase">
                          {toolName}
                        </Badge>
                        {(item.toolCallId || item.toolInvocationId) && (
                          <span className="font-mono text-[11px] text-gray-500 dark:text-gray-400">
                            {(item.toolCallId || item.toolInvocationId).slice(-8)}
                          </span>
                        )}
                        {stateLabel && (
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {stateLabel}
                          </Badge>
                        )}
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="mb-2 flex justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Copy output"
                            onClick={() =>
                              copyToClipboard(
                                formatCopyValue(outputData),
                                `output-${messageId}-${idx}`,
                              )
                            }
                          >
                            {copiedId === `output-${messageId}-${idx}` ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                        <pre className="max-h-60 overflow-auto rounded border border-green-200 bg-white p-2 font-mono text-xs dark:border-green-800 dark:bg-gray-800 dark:text-gray-200">
                          {JSON.stringify(outputData, null, 2)}
                        </pre>
                      </AccordionContent>
                    </AccordionItem>
                  )}
                </Fragment>
              );
            }

            return null;
          })}
        </Accordion>
      );
    }

    // Check if it's a tool call message with the old format (tool_calls, toolCalls)
    if (
      isJson &&
      (parsed.tool_calls || parsed.toolCalls || Array.isArray(parsed))
    ) {
      const toolCalls =
        parsed.tool_calls ||
        parsed.toolCalls ||
        (Array.isArray(parsed) ? parsed : []);

      return (
        <div className="space-y-3">
          {parsed.text && (
            <div className="prose prose-sm max-w-none">
              <Response>{parsed.text}</Response>
            </div>
          )}
          {toolCalls.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1 text-xs font-semibold text-gray-600 dark:text-gray-400">
                <Code className="h-3 w-3" />
                Tool Calls ({toolCalls.length})
              </div>
              {toolCalls.map((call: any, idx: number) => (
                <div
                  key={idx}
                  className="rounded border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="bg-amber-100 text-xs dark:bg-amber-900"
                    >
                      {call.function?.name || call.name || "Unknown Tool"}
                    </Badge>
                    {call.id && (
                      <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                        {call.id.slice(-8)}
                      </span>
                    )}
                  </div>
                  {call.function?.arguments && (
                    <div className="mt-2">
                      <div className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-400">
                        Arguments:
                      </div>
                      <pre className="max-h-60 overflow-auto rounded bg-white p-2 font-mono text-xs dark:bg-gray-800 dark:text-gray-200">
                        {typeof call.function.arguments === "string"
                          ? JSON.stringify(
                            JSON.parse(call.function.arguments),
                            null,
                            2,
                          )
                          : JSON.stringify(call.function.arguments, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    // Regular text message
    return (
      <div className="prose prose-sm max-w-none">
        <Response>{message.content}</Response>
      </div>
    );
  };

  if (error) {
    return (
      <div className="mx-auto max-w-7xl p-8">
        <div className="text-center text-red-600">
          <div className="mb-4 text-xl font-semibold">
            ❌ Error loading project
          </div>
          <div className="text-sm">{error.message}</div>
          <Link href="/admin/projects">
            <Button variant="outline" className="mt-4">
              ← Back to Projects
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl p-8">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500"></div>
          <p className="text-gray-600">Loading project details...</p>
        </div>
      </div>
    );
  }

  if (!projectData) {
    return (
      <div className="mx-auto max-w-7xl p-8">
        <div className="text-center text-gray-600">
          <div className="mb-4 text-xl font-semibold">Project not found</div>
          <Link href="/admin/projects">
            <Button variant="outline">← Back to Projects</Button>
          </Link>
        </div>
      </div>
    );
  }

  const { project, halChatMessages, suggestions, shipperCloudBilling } = projectData;

  // Debug logging
  console.log("[AdminProjectDetail] Project data:", {
    projectId,
    projectName: project.name,
    messagesCount: messages?.length || 0,
    halMessagesCount: halChatMessages?.length || 0,
    suggestionsCount: suggestions?.length || 0,
    rawMessages: messages,
  });

  console.log("[AdminProjectDetail] Sandbox data:", messages, project);
  const fromParam = searchParams?.get("from");
  const fromUserId = searchParams?.get("userId") || project.userId;
  const backHref =
    fromParam === "user" && fromUserId
      ? `/admin/dashboard/${fromUserId}`
      : "/admin/projects";
  const backLabel =
    fromParam === "user" && fromUserId
      ? "Back to User Projects"
      : "Back to Projects";

  console.log('messages', messages);
  return (
    <div className="mx-auto max-w-7xl p-8">
      {/* Header */}
      <div className="mb-6">
        <Link href={backHref}>
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {backLabel}
          </Button>
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="mb-2 text-3xl font-bold">{project.name}</h1>
            <p className="flex items-center gap-2 text-gray-600">
              Project ID: {project.id}
              <button
                onClick={() => copyToClipboard(project.id, "projectId")}
                className="rounded p-1 hover:bg-gray-200 dark:hover:bg-gray-700"
                title="Copy Project ID"
              >
                {copiedId === "projectId" ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4 text-gray-400" />
                )}
              </button>
            </p>
          </div>
          <Link href={`/admin/dashboard/${project.userId}`}>
            <Button variant="outline" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              View Owner
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-gray-600">
              <User className="h-4 w-4" />
              Owner
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">
              {project.user?.name || "Unknown"}
            </div>
            <div className="text-xs text-gray-500">
              {project.user?.email || "N/A"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-gray-600">
              <MessageSquare className="h-4 w-4" />
              Messages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {messages.length}
            </div>
            <div className="text-xs text-gray-500">Total conversations</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-gray-600">
              <Sparkles className="h-4 w-4" />
              y Chats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {halChatMessages.length}
            </div>
            <div className="text-xs text-gray-500">HAL interactions</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-gray-600">
              <Sparkles className="h-4 w-4" />
              Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {suggestions.length}
            </div>
            <div className="text-xs text-gray-500">
              {suggestions.filter((s: any) => s.clicked).length} clicked
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Shipper Cloud Billing Section */}
      {shipperCloudBilling && (
        <div className="mb-6 rounded-lg bg-white shadow">
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <div className="flex items-center gap-3">
              <Cloud className="h-5 w-5 text-cyan-600" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Shipper Cloud Billing
                </h3>
                <p className="text-sm text-gray-500">
                  {shipperCloudBilling.periodStart && shipperCloudBilling.periodEnd
                    ? `${new Date(shipperCloudBilling.periodStart).toLocaleDateString()} - ${new Date(shipperCloudBilling.periodEnd).toLocaleDateString()}`
                    : "Current billing period"}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-cyan-600">
                ${shipperCloudBilling.totalUsd}
              </div>
              <div className="text-sm text-gray-500">
                {shipperCloudBilling.totalCredits.toFixed(2)} credits
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 p-6 md:grid-cols-3 lg:grid-cols-5">
            <div className="rounded-lg bg-gray-50 p-4">
              <div className="mb-2 flex items-center gap-2">
                <Zap className="h-4 w-4 text-cyan-600" />
                <span className="text-sm font-medium text-gray-700">Function Calls</span>
              </div>
              <div className="text-lg font-semibold text-gray-900">
                {shipperCloudBilling.breakdown.functionCalls.usageFormatted}
              </div>
              <div className="text-sm text-cyan-600">
                ${shipperCloudBilling.breakdown.functionCalls.usd}
              </div>
            </div>

            <div className="rounded-lg bg-gray-50 p-4">
              <div className="mb-2 flex items-center gap-2">
                <Activity className="h-4 w-4 text-cyan-600" />
                <span className="text-sm font-medium text-gray-700">Action Compute</span>
              </div>
              <div className="text-lg font-semibold text-gray-900">
                {shipperCloudBilling.breakdown.actionCompute.usageFormatted}
              </div>
              <div className="text-sm text-cyan-600">
                ${shipperCloudBilling.breakdown.actionCompute.usd}
              </div>
            </div>

            <div className="rounded-lg bg-gray-50 p-4">
              <div className="mb-2 flex items-center gap-2">
                <Database className="h-4 w-4 text-cyan-600" />
                <span className="text-sm font-medium text-gray-700">DB Bandwidth</span>
              </div>
              <div className="text-lg font-semibold text-gray-900">
                {shipperCloudBilling.breakdown.databaseBandwidth.usageFormatted}
              </div>
              <div className="text-sm text-cyan-600">
                ${shipperCloudBilling.breakdown.databaseBandwidth.usd}
              </div>
            </div>

            <div className="rounded-lg bg-gray-50 p-4">
              <div className="mb-2 flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-cyan-600" />
                <span className="text-sm font-medium text-gray-700">File Bandwidth</span>
              </div>
              <div className="text-lg font-semibold text-gray-900">
                {shipperCloudBilling.breakdown.fileBandwidth.usageFormatted}
              </div>
              <div className="text-sm text-cyan-600">
                ${shipperCloudBilling.breakdown.fileBandwidth.usd}
              </div>
            </div>

            <div className="rounded-lg bg-gray-50 p-4">
              <div className="mb-2 flex items-center gap-2">
                <Cloud className="h-4 w-4 text-cyan-600" />
                <span className="text-sm font-medium text-gray-700">Vector Bandwidth</span>
              </div>
              <div className="text-lg font-semibold text-gray-900">
                {shipperCloudBilling.breakdown.vectorBandwidth.usageFormatted}
              </div>
              <div className="text-sm text-cyan-600">
                ${shipperCloudBilling.breakdown.vectorBandwidth.usd}
              </div>
            </div>
          </div>

          {/* Storage Section */}
          <div className="border-t border-gray-200 px-6 py-4">
            <h4 className="mb-3 text-sm font-medium text-gray-700">Storage Snapshot</h4>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
              <div className="text-sm">
                <span className="text-gray-500">Document:</span>{" "}
                <span className="font-medium">{shipperCloudBilling.storage.document}</span>
              </div>
              <div className="text-sm">
                <span className="text-gray-500">Index:</span>{" "}
                <span className="font-medium">{shipperCloudBilling.storage.index}</span>
              </div>
              <div className="text-sm">
                <span className="text-gray-500">File:</span>{" "}
                <span className="font-medium">{shipperCloudBilling.storage.file}</span>
              </div>
              <div className="text-sm">
                <span className="text-gray-500">Vector:</span>{" "}
                <span className="font-medium">{shipperCloudBilling.storage.vector}</span>
              </div>
              <div className="text-sm">
                <span className="text-gray-500">Backup:</span>{" "}
                <span className="font-medium">{shipperCloudBilling.storage.backup}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs for different data views */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="messages">
            <MessageSquare className="mr-2 h-4 w-4" />
            Messages ({messages.length})
          </TabsTrigger>
          <TabsTrigger value="advisor">
            <Sparkles className="mr-2 h-4 w-4" />
            Advisor ({halChatMessages.length})
          </TabsTrigger>
          <TabsTrigger value="suggestions">
            <Sparkles className="mr-2 h-4 w-4" />
            Suggestions ({suggestions.length})
          </TabsTrigger>
          <TabsTrigger value="fragments">
            <GitBranch className="mr-2 h-4 w-4" />
            Fragments ({fragmentsData?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="sandbox">
            <Server className="mr-2 h-4 w-4" />
            Sandbox & Dev Server
          </TabsTrigger>
        </TabsList>

        {/* Messages Tab */}
        <TabsContent value="messages" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Chat Messages</CardTitle>
              <CardDescription>
                All messages in the builder chat for this project
              </CardDescription>
            </CardHeader>
            <CardContent>
              {messages.length > 0 && (
                <div className="mb-4 flex justify-end flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setExpandedMessages(new Set(messages.map((m: any) => m.id)));
                    }}
                  >
                    Open All
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setExpandedMessages(new Set());
                    }}
                  >
                    Close All
                  </Button>
                </div>
              )}
              {messages.length === 0 ? (
                <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                  No messages yet
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message: any) => {
                    const isHighlighted = highlightedMessageId === message.id;
                    return (
                      <div
                        key={message.id}
                        ref={(el) => {
                          if (el) {
                            messageRefs.current.set(message.id, el);
                          }
                        }}
                        className={`rounded-lg border p-3 transition-all duration-500 ${isHighlighted
                            ? "ring-2 ring-yellow-400 ring-offset-2 bg-yellow-50 dark:bg-yellow-900/20"
                            : message.role === "USER"
                              ? "border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950"
                              : "border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900"
                          }`}
                      >
                        <button
                          className="flex w-full items-center justify-between text-left"
                          onClick={() => toggleMessage(message.id)}
                        >

                          <div className="flex items-center gap-2 pr-10">
                            {expandedMessages.has(message.id) ? (
                              <ChevronDown className="h-4 w-4 text-gray-500" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-gray-500" />
                            )}
                            <Badge
                              variant={
                                message.role === "USER" ? "default" : "secondary"
                              }
                            >
                              {message.role === 'USER' ? 'USER' : 'BUILDER'}
                            </Badge>
                            {message.type === "ERROR" && (
                              <Badge variant="destructive">Error</Badge>
                            )}
                            {message.role === "ASSISTANT" && (
                              <Badge variant="outline" className="text-xs">
                                {`Credits: ${Number(message.creditsUsed ?? 0).toFixed(2)}`}
                              </Badge>
                            )}

                          </div>
                          <div className={`flex-1 ml-5 min-w-0 px-2 ${message.role === "USER" ? "pl-32" : ""}`}>
                            <span className="block text-left text-xs text-gray-600 dark:text-gray-300 truncate leading-tight">
                              {getMessagePreview(message, 100)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                            {new Date(message.createdAt).toLocaleString()}
                          </div>
                        </button>

                        {expandedMessages.has(message.id) && (
                          <div className="mt-3 space-y-2">
                            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                              <span>{message.id}</span>
                              {message.role === "ASSISTANT" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleRawView(message.id)}
                                  className="h-6 px-2 text-xs"
                                >
                                  <Code className="mr-1 h-3 w-3" />
                                  {showRawMessages[message.id]
                                    ? "Formatted"
                                    : "Raw"}
                                </Button>
                              )}
                            </div>

                            {message.role === "ASSISTANT" ? (
                              renderAssistantContent(message, message.id)
                            ) : (
                              <div className="text-sm break-words whitespace-pre-wrap dark:text-gray-300">
                                {(() => {
                                  const { parsed, isJson } = parseMessageContent(
                                    message.content,
                                  );
                                  if (
                                    isJson &&
                                    Array.isArray(parsed) &&
                                    parsed.length > 0
                                  ) {
                                    // Extract text from array of content parts
                                    const textContent = parsed
                                      .filter((part: any) => part.type === "text")
                                      .map((part: any) => part.text)
                                      .join("\n\n");
                                    return textContent || message.content;
                                  }
                                  return message.content;
                                })()}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Advisor Tab */}
        <TabsContent value="advisor" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>HAL Advisor Chat</CardTitle>
              <CardDescription>
                All HAL advisor interactions for this project
              </CardDescription>
            </CardHeader>
            <CardContent>
              {halChatMessages.length === 0 ? (
                <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                  No advisor chats yet
                </div>
              ) : (
                <div className="space-y-4">
                  {halChatMessages.map((message: any) => (
                    <div
                      key={message.id}
                      className={`rounded-lg p-4 ${message.role === "user"
                          ? "border-l-4 border-purple-500 bg-purple-50 dark:bg-purple-950"
                          : message.role === "assistant"
                            ? "border-l-4 border-indigo-500 bg-indigo-50 dark:bg-indigo-950"
                            : "border-l-4 border-gray-500 bg-gray-50 dark:bg-gray-800"
                        }`}
                    >
                      <div className="mb-2 flex items-start justify-between">
                        <Badge
                          variant={
                            message.role === "user" ? "default" : "secondary"
                          }
                        >
                          {message.role}
                        </Badge>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(message.createdAt).toLocaleString()}
                          </span>
                          {message.role === "assistant" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleRawView(`hal-${message.id}`)}
                              className="h-6 px-2 text-xs"
                            >
                              <Code className="mr-1 h-3 w-3" />
                              {showRawMessages[`hal-${message.id}`]
                                ? "Formatted"
                                : "Raw"}
                            </Button>
                          )}
                        </div>
                      </div>
                      {message.role === "assistant" ? (
                        renderAssistantContent(message, `hal-${message.id}`)
                      ) : (
                        <div className="text-sm break-words whitespace-pre-wrap dark:text-gray-300">
                          {message.content}
                        </div>
                      )}
                      {message.role === "assistant" &&
                        message.parts &&
                        showRawMessages[`hal-${message.id}`] && (
                          <div className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-700">
                            <div className="mb-2 text-xs font-semibold text-gray-600 dark:text-gray-400">
                              Full Message Structure:
                            </div>
                            <pre className="max-h-60 overflow-auto rounded bg-gray-100 p-3 font-mono text-xs dark:bg-gray-800 dark:text-gray-200">
                              {JSON.stringify(message.parts, null, 2)}
                            </pre>
                          </div>
                        )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Suggestions Tab */}
        <TabsContent value="suggestions" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>HAL Suggestions</CardTitle>
              <CardDescription>
                All suggestions generated for this project
              </CardDescription>
            </CardHeader>
            <CardContent>
              {suggestions.length === 0 ? (
                <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                  No suggestions yet
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {suggestions.map((suggestion: any) => (
                    <div
                      key={suggestion.id}
                      className={`rounded-lg border-2 p-4 ${suggestion.clicked
                          ? "border-green-500 bg-green-50 dark:border-green-700 dark:bg-green-950"
                          : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
                        }`}
                    >
                      <div className="mb-2 flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{suggestion.icon}</span>
                          <Badge
                            variant={suggestion.clicked ? "default" : "outline"}
                            className={suggestion.clicked ? "bg-green-500" : ""}
                          >
                            {suggestion.targetChat}
                          </Badge>
                        </div>
                        {suggestion.clicked && (
                          <Badge variant="outline" className="text-xs">
                            ✓ Clicked
                          </Badge>
                        )}
                      </div>
                      <h4 className="mb-1 text-sm font-semibold dark:text-gray-200">
                        {suggestion.title}
                      </h4>
                      <p className="mb-2 text-xs text-gray-600 dark:text-gray-400">
                        {suggestion.description}
                      </p>
                      <details>
                        <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
                          View prompt
                        </summary>
                        <div className="mt-2 rounded bg-gray-100 p-2 text-xs dark:bg-gray-900 dark:text-gray-300">
                          {suggestion.prompt}
                        </div>
                      </details>
                      <div className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                        Created:{" "}
                        {new Date(suggestion.createdAt).toLocaleString()}
                        {suggestion.clickedAt && (
                          <>
                            <br />
                            Clicked:{" "}
                            {new Date(suggestion.clickedAt).toLocaleString()}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fragments Tab */}
        <TabsContent value="fragments" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5" />
                Project Fragments
              </CardTitle>
              <CardDescription>
                View and switch between different versions of the project
              </CardDescription>
            </CardHeader>
            <CardContent>
              {fragmentsLoading ? (
                <div className="py-8 text-center">
                  <div className="mx-auto h-6 w-6 animate-spin rounded-full border-b-2 border-blue-500"></div>
                  <p className="mt-2 text-gray-600 dark:text-gray-400">
                    Loading fragments...
                  </p>
                </div>
              ) : fragmentsData && fragmentsData.length > 0 ? (
                <div className="space-y-3">
                  {fragmentsData.map((fragment: any, index: number) => {
                    const isActive =
                      fragment.id === sandboxData?.activeFragmentId;
                    const isLatest = index === 0;
                    const isExpanded = expandedFragments.has(fragment.id);
                    const files =
                      (fragment.files as Record<string, string>) || {};
                    const fileList = Object.keys(files).sort();

                    return (
                      <div
                        key={fragment.id}
                        className={`rounded-lg border-2 ${isActive
                            ? "border-blue-500 bg-blue-50 dark:border-blue-600 dark:bg-blue-950"
                            : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
                          }`}
                      >
                        <div className="flex items-start justify-between p-4">
                          <div className="flex-1">
                            <div className="mb-2 flex items-center gap-2">
                              <button
                                onClick={() => {
                                  const newExpanded = new Set(
                                    expandedFragments,
                                  );
                                  if (isExpanded) {
                                    newExpanded.delete(fragment.id);
                                  } else {
                                    newExpanded.add(fragment.id);
                                  }
                                  setExpandedFragments(newExpanded);
                                }}
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                              >
                                {isExpanded ? (
                                  <FolderOpen className="h-4 w-4" />
                                ) : (
                                  <File className="h-4 w-4" />
                                )}
                              </button>
                              <h4 className="text-sm font-semibold dark:text-gray-200">
                                {fragment.title}
                              </h4>
                              {isLatest && (
                                <Badge variant="default" className="text-xs">
                                  Latest
                                </Badge>
                              )}
                              {isActive && (
                                <Badge
                                  variant="default"
                                  className="bg-blue-500 text-xs"
                                >
                                  Active
                                </Badge>
                              )}
                              {fragment.snapshotImageId && (
                                <Badge variant="outline" className="text-xs">
                                  Snapshot
                                </Badge>
                              )}
                              <Badge variant="secondary" className="text-xs">
                                {fileList.length} files
                              </Badge>
                            </div>
                            <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                              <div>
                                Created:{" "}
                                {new Date(fragment.createdAt).toLocaleString()}
                              </div>
                              <div className="flex items-center gap-1">
                                ID: {fragment.id}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copyToClipboard(fragment.id, `fragmentId-${fragment.id}`);
                                  }}
                                  className="rounded p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700"
                                  title="Copy Fragment ID"
                                >
                                  {copiedId === `fragmentId-${fragment.id}` ? (
                                    <Check className="h-3 w-3 text-green-500" />
                                  ) : (
                                    <Copy className="h-3 w-3 text-gray-400" />
                                  )}
                                </button>
                              </div>
                              {fragment.snapshotProvider && (
                                <div className="capitalize">
                                  Provider: {fragment.snapshotProvider}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="ml-4 flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const newExpanded = new Set(expandedFragments);
                                if (isExpanded) {
                                  newExpanded.delete(fragment.id);
                                } else {
                                  newExpanded.add(fragment.id);
                                }
                                setExpandedFragments(newExpanded);
                              }}
                            >
                              {isExpanded ? "Hide Files" : "View Files"}
                            </Button>
                            {!isActive && sandboxData?.isActive && (
                              <Button
                                size="sm"
                                onClick={() => handleLoadFragment(fragment.id)}
                                disabled={loadFragmentMutation.isPending}
                              >
                                {loadFragmentMutation.isPending ? (
                                  <>
                                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                    Loading...
                                  </>
                                ) : (
                                  "Load to Sandbox"
                                )}
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* File Tree and Content */}
                        {isExpanded && (
                          <div className="border-t border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
                            <div className="grid grid-cols-12 gap-0">
                              {/* File Tree - Left Side (4 cols) */}
                              <div className="col-span-4 border-r border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                                <div className="mb-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
                                  File Tree ({fileList.length} files)
                                </div>
                                <div className="max-h-[600px] space-y-0.5 overflow-y-auto">
                                  {fileList.map((filePath) => {
                                    const isSelected =
                                      selectedFragmentFile?.fragmentId ===
                                      fragment.id &&
                                      selectedFragmentFile?.filePath ===
                                      filePath;
                                    const fileName =
                                      filePath.split("/").pop() || filePath;
                                    const directory = filePath.substring(
                                      0,
                                      filePath.lastIndexOf("/"),
                                    );

                                    return (
                                      <button
                                        key={filePath}
                                        onClick={() => {
                                          if (isSelected) {
                                            setSelectedFragmentFile(null);
                                          } else {
                                            setSelectedFragmentFile({
                                              fragmentId: fragment.id,
                                              filePath,
                                            });
                                          }
                                        }}
                                        className={`w-full rounded px-2 py-1.5 text-left transition-colors ${isSelected
                                            ? "bg-blue-500 text-white"
                                            : "hover:bg-gray-200 dark:hover:bg-gray-700"
                                          }`}
                                      >
                                        <div className="flex items-start gap-1.5">
                                          <File
                                            className={`mt-0.5 h-3 w-3 flex-shrink-0 ${isSelected ? "text-white" : "text-gray-500 dark:text-gray-400"}`}
                                          />
                                          <div className="min-w-0 flex-1">
                                            <div
                                              className={`truncate font-mono text-xs font-medium ${isSelected ? "text-white" : "text-gray-900 dark:text-gray-200"}`}
                                            >
                                              {fileName}
                                            </div>
                                            {directory && (
                                              <div
                                                className={`truncate font-mono text-[10px] ${isSelected ? "text-blue-100" : "text-gray-500 dark:text-gray-400"}`}
                                              >
                                                {directory}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* File Content - Right Side (8 cols) */}
                              <div className="col-span-8">
                                {selectedFragmentFile?.fragmentId ===
                                  fragment.id && selectedFragmentFile ? (
                                  <div className="p-4">
                                    <div className="mb-2 flex items-center justify-between">
                                      <div className="font-mono text-xs font-semibold text-gray-700 dark:text-gray-300">
                                        {selectedFragmentFile.filePath}
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() =>
                                          setSelectedFragmentFile(null)
                                        }
                                      >
                                        Close
                                      </Button>
                                    </div>
                                    <div className="rounded border border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-800">
                                      <pre className="max-h-[600px] overflow-auto p-4 font-mono text-xs dark:text-gray-200">
                                        {files[selectedFragmentFile.filePath]}
                                      </pre>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex h-64 items-center justify-center text-gray-400 dark:text-gray-500">
                                    <div className="text-center">
                                      <FileText className="mx-auto mb-2 h-12 w-12" />
                                      <p className="text-sm">
                                        Select a file to view its contents
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                  No fragments found for this project
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sandbox & Dev Server Tab */}
        <TabsContent value="sandbox" className="mt-4">
          <div className="space-y-4">
            {/* Sandbox Status Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    Sandbox Status
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchSandbox()}
                    disabled={sandboxLoading}
                    className="text-xs"
                  >
                    <RefreshCw
                      className={`mr-1 h-3 w-3 ${sandboxLoading ? "animate-spin" : ""}`}
                    />
                    Refresh
                  </Button>
                </CardTitle>
                <CardDescription>
                  Current sandbox information for this project (read-only check)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {sandboxLoading ? (
                  <div className="py-4 text-center">
                    <div className="mx-auto h-6 w-6 animate-spin rounded-full border-b-2 border-blue-500"></div>
                  </div>
                ) : sandboxData?.isActive ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="bg-green-500">
                        Running
                      </Badge>
                      {sandboxData.sandboxStatus && (
                        <Badge variant="outline" className="capitalize">
                          {sandboxData.sandboxStatus}
                        </Badge>
                      )}
                      <span className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                        Sandbox ID: {sandboxData.sandboxId}
                        <button
                          onClick={() => copyToClipboard(sandboxData.sandboxId!, "sandboxId")}
                          className="rounded p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700"
                          title="Copy Sandbox ID"
                        >
                          {copiedId === "sandboxId" ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3 text-gray-400" />
                          )}
                        </button>
                      </span>
                    </div>
                    {sandboxData.sandboxCreatedAt && (
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Created:{" "}
                        {new Date(
                          sandboxData.sandboxCreatedAt,
                        ).toLocaleString()}
                      </div>
                    )}
                    {sandboxData.activeFragmentId && (
                      <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                        Active Fragment: {sandboxData.activeFragmentId}
                        <button
                          onClick={() => copyToClipboard(sandboxData.activeFragmentId!, "activeFragmentId")}
                          className="rounded p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700"
                          title="Copy Active Fragment ID"
                        >
                          {copiedId === "activeFragmentId" ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3 text-gray-400" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <div className="mb-2 flex items-center justify-center gap-2">
                      <Badge variant="destructive">Inactive</Badge>
                      {sandboxData?.sandboxStatus && (
                        <Badge variant="outline" className="capitalize">
                          {sandboxData.sandboxStatus}
                        </Badge>
                      )}
                    </div>
                    <div className="mb-4 text-gray-500 dark:text-gray-400">
                      {sandboxData?.sandboxStatus === "terminated"
                        ? "Sandbox has been terminated"
                        : sandboxData?.sandboxStatus === "not_found"
                          ? "Sandbox not found (may have expired)"
                          : "No active sandbox for this project"}
                    </div>
                    <p className="mb-4 text-sm text-gray-400">
                      Start a sandbox to view files, execute commands, and run
                      the dev server.
                    </p>
                    <Button
                      onClick={handleStartSandbox}
                      disabled={startSandboxMutation.isPending}
                    >
                      {startSandboxMutation.isPending ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Starting Sandbox...
                        </>
                      ) : (
                        <>
                          <Play className="mr-2 h-4 w-4" />
                          {sandboxData?.sandboxStatus === "terminated" ||
                            sandboxData?.sandboxStatus === "not_found"
                            ? "Create New Sandbox"
                            : "Start Sandbox"}
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sandbox & Dev Server Controls Card */}
            {sandboxData?.isActive && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Play className="h-5 w-5" />
                    Start Sandbox & Dev Server
                  </CardTitle>
                  <CardDescription>
                    Wake up the sandbox and start the development server
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button
                    onClick={handleStartSandbox}
                    disabled={startSandboxMutation.isPending}
                    className="w-full"
                  >
                    {startSandboxMutation.isPending ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Starting...
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Start Sandbox & Dev Server
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-gray-500">
                    This will wake up the sandbox if it is asleep and start the
                    dev server (similar to what happens when a user opens their
                    project).
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Monitor Script Injection Card */}
            {sandboxData?.isActive && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Code className="h-5 w-5" />
                    Monitor Script Injection
                  </CardTitle>
                  <CardDescription>
                    Inject the monitoring script into the sandbox HTML
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button
                    onClick={handleInjectMonitor}
                    disabled={injectMonitorMutation.isPending}
                    className="w-full"
                    variant="secondary"
                  >
                    {injectMonitorMutation.isPending ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Injecting...
                      </>
                    ) : (
                      <>
                        <Code className="mr-2 h-4 w-4" />
                        Inject Monitor Script
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-gray-500">
                    This will inject the monitoring script from
                    shipper-vite-template/.shipper/monitor.js into the sandbox&apos;s
                    index.html file. The script tracks runtime errors, network
                    requests, console output, and enables visual editing.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Command Execution Card */}
            {sandboxData?.isActive && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Terminal className="h-5 w-5" />
                    Execute Command
                  </CardTitle>
                  <CardDescription>
                    Run commands in the sandbox environment
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter command (e.g., npm run build)"
                      value={command}
                      onChange={(e) => setCommand(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleExecuteCommand();
                        }
                      }}
                      disabled={executeCommandMutation.isPending}
                    />
                    <Button
                      onClick={handleExecuteCommand}
                      disabled={
                        executeCommandMutation.isPending || !command.trim()
                      }
                    >
                      {executeCommandMutation.isPending ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        "Execute"
                      )}
                    </Button>
                  </div>
                  {commandOutput && (
                    <div className="mt-4">
                      <div className="mb-2 text-sm font-medium dark:text-gray-300">
                        Output:
                      </div>
                      <pre className="max-h-60 overflow-auto rounded bg-gray-100 p-3 font-mono text-xs dark:bg-gray-800 dark:text-gray-200">
                        {commandOutput}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Dev Server Logs Card */}
            {sandboxData?.isActive && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Terminal className="h-5 w-5" />
                        Dev Server Logs
                      </CardTitle>
                      <CardDescription>
                        Real-time logs from the development server
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-end gap-1">
                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={autoRefreshLogs}
                            onChange={(e) =>
                              setAutoRefreshLogs(e.target.checked)
                            }
                            className="rounded"
                          />
                          Auto-refresh
                        </label>
                        {autoRefreshLogs && (
                          <span className="text-muted-foreground flex items-center gap-1 text-xs">
                            {logsLoading ? (
                              <>
                                <RefreshCw className="h-3 w-3 animate-spin" />
                                Refreshing...
                              </>
                            ) : (
                              <>Next refresh in {nextRefreshIn}s</>
                            )}
                          </span>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refetchLogs()}
                        disabled={logsLoading}
                      >
                        <RefreshCw
                          className={`h-4 w-4 ${logsLoading ? "animate-spin" : ""}`}
                        />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {logsLoading ? (
                    <div className="py-4 text-center">
                      <div className="mx-auto h-6 w-6 animate-spin rounded-full border-b-2 border-blue-500"></div>
                    </div>
                  ) : logsData?.logs && logsData.logs.length > 0 ? (
                    <pre className="max-h-96 overflow-auto rounded bg-gray-900 p-4 font-mono text-xs text-green-400 dark:bg-gray-950">
                      {logsData.logs.join("\n")}
                    </pre>
                  ) : (
                    <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                      {logsData?.error || "No logs available yet"}
                      <div className="mt-2 text-xs">
                        Start the dev server to see logs
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* File Browser Card */}
            {sandboxData?.isActive && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <FolderOpen className="h-5 w-5" />
                        File Browser
                      </CardTitle>
                      <CardDescription>
                        Browse and view files in the sandbox
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {sandboxData?.sandboxProvider && (
                        <Badge variant="outline" className="capitalize">
                          {sandboxData.sandboxProvider}
                        </Badge>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refetchFiles()}
                        disabled={filesLoading}
                      >
                        <RefreshCw
                          className={`h-4 w-4 ${filesLoading ? "animate-spin" : ""}`}
                        />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {filesLoading ? (
                    <div className="py-4 text-center">
                      <div className="mx-auto h-6 w-6 animate-spin rounded-full border-b-2 border-blue-500"></div>
                    </div>
                  ) : filesData?.files && filesData.files.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {/* File Tree */}
                      <div className="space-y-2">
                        <div className="mb-2 flex items-center gap-2">
                          <Input
                            placeholder="Search files..."
                            value={fileSearchQuery}
                            onChange={(e) => setFileSearchQuery(e.target.value)}
                            className="text-sm"
                          />
                        </div>
                        <div className="max-h-96 overflow-y-auto rounded-lg border bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800">
                          {(() => {
                            const filteredFiles = fileSearchQuery
                              ? filesData.files.filter((file) =>
                                file.path
                                  .toLowerCase()
                                  .includes(fileSearchQuery.toLowerCase()),
                              )
                              : filesData.files;

                            if (filteredFiles.length === 0) {
                              return (
                                <div className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                                  No files match your search
                                </div>
                              );
                            }

                            const fileTree = buildFileTree(filteredFiles);

                            const renderTreeNode = (
                              node: FileNode,
                              depth: number = 0,
                            ): React.ReactNode => {
                              const isExpanded = expandedFolders.has(node.path);
                              const isSelected = selectedFile === node.path;

                              if (node.isDirectory) {
                                return (
                                  <div key={node.path}>
                                    <button
                                      onClick={() => toggleFolder(node.path)}
                                      className="flex w-full items-center gap-1 rounded px-2 py-1 text-left text-sm hover:bg-gray-200 dark:hover:bg-gray-700"
                                      style={{
                                        paddingLeft: `${depth * 12 + 8}px`,
                                      }}
                                    >
                                      {isExpanded ? (
                                        <ChevronDown className="h-4 w-4 flex-shrink-0 text-gray-600 dark:text-gray-400" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-600 dark:text-gray-400" />
                                      )}
                                      <Folder className="h-4 w-4 flex-shrink-0 text-blue-500 dark:text-blue-400" />
                                      <span className="font-medium text-gray-700 dark:text-gray-300">
                                        {node.name}
                                      </span>
                                    </button>
                                    {isExpanded && node.children && (
                                      <div>
                                        {node.children.map((child) =>
                                          renderTreeNode(child, depth + 1),
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              } else {
                                return (
                                  <button
                                    key={node.path}
                                    onClick={() => setSelectedFile(node.path)}
                                    className={`flex w-full items-center gap-1 rounded px-2 py-1 text-left text-sm hover:bg-gray-200 dark:hover:bg-gray-700 ${isSelected
                                        ? "bg-blue-100 dark:bg-blue-900"
                                        : ""
                                      }`}
                                    style={{
                                      paddingLeft: `${depth * 12 + 28}px`,
                                    }}
                                  >
                                    <File className="h-4 w-4 flex-shrink-0 text-gray-400 dark:text-gray-500" />
                                    <span className="flex-1 truncate text-gray-700 dark:text-gray-300">
                                      {node.name}
                                    </span>
                                    {node.size !== undefined && (
                                      <span className="text-xs text-gray-400 dark:text-gray-500">
                                        {(node.size / 1024).toFixed(1)}KB
                                      </span>
                                    )}
                                  </button>
                                );
                              }
                            };

                            return (
                              <div className="space-y-0.5">
                                {renderTreeNode(fileTree, 0)}
                              </div>
                            );
                          })()}
                        </div>
                        <p className="mt-2 text-xs text-gray-500">
                          {filesData.files.length} files total
                        </p>
                      </div>

                      {/* File Content Viewer */}
                      <div className="space-y-2">
                        {selectedFile ? (
                          <>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-gray-400" />
                                <span className="truncate text-sm font-medium">
                                  {selectedFile.split("/").pop()}
                                </span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedFile(null)}
                              >
                                Close
                              </Button>
                            </div>
                            <div className="rounded-lg border dark:border-gray-700">
                              {fileContentLoading ? (
                                <div className="py-8 text-center">
                                  <div className="mx-auto h-6 w-6 animate-spin rounded-full border-b-2 border-blue-500"></div>
                                </div>
                              ) : fileContentData?.content ? (
                                <pre className="max-h-96 overflow-auto rounded bg-gray-900 p-4 font-mono text-xs text-gray-100 dark:bg-gray-950">
                                  {fileContentData.content}
                                </pre>
                              ) : (
                                <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                                  Failed to load file content
                                </div>
                              )}
                            </div>
                          </>
                        ) : (
                          <div className="flex h-96 items-center justify-center rounded-lg border text-gray-400 dark:border-gray-700 dark:text-gray-500">
                            Select a file to view its contents
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-gray-500">
                      No files found in sandbox
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
