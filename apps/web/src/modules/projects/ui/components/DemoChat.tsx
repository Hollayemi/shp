"use client";

import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import { Button } from "@/components/ui/button";
import { ArrowDownIcon } from "lucide-react";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from "@/components/ai-elements/reasoning";
import { Response } from "@/components/ai-elements/response";
import {
  Task,
  TaskTrigger,
  TaskContent,
  TaskItem,
  TaskItemFile,
} from "@/components/ai-elements/task";
import { UIMessage } from "@ai-sdk/react";
import { UIMessagePart, UIDataTypes, UITools } from "ai";
import {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
  Fragment,
} from "react";
import {
  SiReact,
  SiTypescript,
  SiJavascript,
  SiCss,
  SiHtml5,
  SiJson,
  SiMarkdown,
} from "@icons-pack/react-simple-icons";
import { useSearchParams, usePathname } from "next/navigation";
import {
  AlertCircle,
  CheckCircle,
  Loader2,
  CircleCheckBig,
  CircleX,
  FileText,
  ChevronDown,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
// Removed static import - messages now come from props
// Reusable sandbox status components
const SandboxStatusCard = ({
  icon,
  text,
  variant,
}: {
  icon: React.ReactNode;
  text: string;
  variant: "setup" | "connected";
}) => {
  const styles = {
    setup:
      "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
    connected:
      "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
  };

  const textStyles = {
    setup: "text-blue-900 dark:text-blue-100",
    connected: "text-green-900 dark:text-green-100",
  };

  return (
    <div
      className={`flex items-center gap-2 p-2 rounded-lg border text-sm ${styles[variant]}`}
    >
      {icon}
      <span className={`text-sm font-medium ${textStyles[variant]}`}>
        {text}
      </span>
    </div>
  );
};

// ScrollToBottomButton component using useStickToBottomContext
const ScrollToBottomButton = () => {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  const handleScrollToBottom = useCallback(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  if (isAtBottom) return null;

  return (
    <Button
      className="absolute bottom-4 left-[50%] translate-x-[-50%] rounded-full"
      onClick={handleScrollToBottom}
      size="icon"
      type="button"
      variant="outline"
    >
      <ArrowDownIcon className="size-4" />
    </Button>
  );
};

const iconMap: Record<
  string,
  { component: React.ComponentType<any>; color: string }
> = {
  tsx: { component: SiReact, color: "#3B82F6" },
  ts: { component: SiTypescript, color: "#3178C6" },
  js: { component: SiJavascript, color: "#F7DF1E" },
  jsx: { component: SiReact, color: "#3B82F6" },
  css: { component: SiCss, color: "#1572B6" },
  html: { component: SiHtml5, color: "#E34F26" },
  json: { component: SiJson, color: "#000000" },
  md: { component: SiMarkdown, color: "#000000" },
};

const getFileIcon = (filePath: string) => {
  const extension = filePath.split(".").pop()?.toLowerCase();
  if (extension && iconMap[extension]) {
    return iconMap[extension];
  }
  // Default icon if no match
  return { component: FileText, color: "#6B7280" };
};

// Helper function to group related tool calls with better organization
const groupToolCalls = (parts: UIMessagePart<UIDataTypes, UITools>[]) => {
  const groups: Array<{
    type: "text" | "reasoning" | "tool-group";
    content: UIMessagePart<UIDataTypes, UITools>[];
    title?: string;
    isComplete?: boolean;
  }> = [];

  let firstReasoningFound = false;
  let currentToolGroup: UIMessagePart<UIDataTypes, UITools>[] = [];
  let pendingToolCalls = 0;

  // First pass: identify all tool calls and reasoning
  const toolIndices = parts
    .map((part, index) => (part.type.startsWith("tool-") ? index : -1))
    .filter((index) => index !== -1);

  const reasoningIndices = parts
    .map((part, index) => (part.type === "reasoning" ? index : -1))
    .filter((index) => index !== -1);

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    if (part.type === "text") {
      // Close any pending tool group before text
      if (currentToolGroup.length > 0) {
        groups.push({
          type: "tool-group",
          content: [...currentToolGroup],
          title: generateToolGroupTitle(currentToolGroup),
          isComplete: pendingToolCalls === 0,
        });
        currentToolGroup = [];
        pendingToolCalls = 0;
      }

      groups.push({
        type: "text",
        content: [part],
      });
    } else if (part.type === "reasoning") {
      // First reasoning always gets its own group
      if (!firstReasoningFound) {
        // Close any pending tool group
        if (currentToolGroup.length > 0) {
          groups.push({
            type: "tool-group",
            content: [...currentToolGroup],
            title: generateToolGroupTitle(currentToolGroup),
            isComplete: pendingToolCalls === 0,
          });
          currentToolGroup = [];
          pendingToolCalls = 0;
        }

        groups.push({
          type: "reasoning",
          content: [part],
        });
        firstReasoningFound = true;
      } else {
        // Subsequent reasoning gets included in tool groups
        // Check if there are upcoming tool calls OR if we already have tools in current group
        const hasUpcomingTools = toolIndices.some((toolIndex) => toolIndex > i);
        const hasCurrentTools = currentToolGroup.some((p) =>
          p.type.startsWith("tool-"),
        );

        if (hasUpcomingTools || hasCurrentTools) {
          // Add reasoning to current tool group (will be part of the consolidated group)
          currentToolGroup.push(part);
        } else {
          // No tools in current group and no more tools coming, make standalone reasoning
          groups.push({
            type: "reasoning",
            content: [part],
          });
        }
      }
    } else if (part.type.startsWith("tool-")) {
      // Add to current tool group
      currentToolGroup.push(part);

      // Track pending tool calls
      const toolPart = part as any;
      if (
        toolPart.state === "input-streaming" ||
        toolPart.state === "input-available"
      ) {
        pendingToolCalls++;
      } else if (
        toolPart.state === "output-available" ||
        toolPart.state === "output-error"
      ) {
        pendingToolCalls = Math.max(0, pendingToolCalls - 1);
      }

      // Check if we should close this tool group
      // Only close if: next part is text, or we're at the end
      // Don't close for reasoning since it should be included in the group
      const nextPart = parts[i + 1];
      const shouldClose = !nextPart || nextPart.type === "text";

      if (shouldClose && currentToolGroup.length > 0) {
        groups.push({
          type: "tool-group",
          content: [...currentToolGroup],
          title: generateToolGroupTitle(currentToolGroup),
          isComplete: pendingToolCalls === 0,
        });
        currentToolGroup = [];
        pendingToolCalls = 0;
      }
    }
  }

  // Close any remaining tool group
  if (currentToolGroup.length > 0) {
    groups.push({
      type: "tool-group",
      content: [...currentToolGroup],
      title: generateToolGroupTitle(currentToolGroup),
      isComplete: pendingToolCalls === 0,
    });
  }

  return groups;
};

// Helper function to group messages into step groups based on role transitions
type StepGroup = {
  userMessages: UIMessage[];
  assistantMessages: UIMessage[];
};

const groupMessagesIntoStepGroups = (messages: UIMessage[]): StepGroup[] => {
  if (!messages || messages.length === 0) return [];

  const groups: StepGroup[] = [];
  let currentGroup: StepGroup = { userMessages: [], assistantMessages: [] };
  let expectingUser = true; // Start expecting user messages

  for (const message of messages) {
    if (message.role === "user") {
      // If we were collecting assistant messages and now see a user message,
      // finish the current group and start a new one
      if (!expectingUser && currentGroup.assistantMessages.length > 0) {
        groups.push(currentGroup);
        currentGroup = { userMessages: [], assistantMessages: [] };
      }
      currentGroup.userMessages.push(message);
      expectingUser = true;
    } else if (message.role === "assistant") {
      currentGroup.assistantMessages.push(message);
      expectingUser = false;
    }
  }
  // Don't forget the last group
  if (currentGroup.userMessages.length > 0 || currentGroup.assistantMessages.length > 0) {
    groups.push(currentGroup);
  }
  return groups;
};

// Generate a descriptive title for a group of tool calls
const generateToolGroupTitle = (
  toolParts: UIMessagePart<UIDataTypes, UITools>[],
) => {
  // Find the current active part (streaming or most recent)
  const activePart =
    toolParts.find(
      (part) =>
        (part as any).state === "streaming" ||
        (part as any).state === "input-streaming" ||
        (part as any).state === "input-available",
    ) || toolParts[toolParts.length - 1];

  if (activePart?.type.startsWith("tool-")) {
    const toolName = activePart.type.replace("tool-", "");
    switch (toolName) {
      case "writeFile":
        return "Writing file";
      case "createOrEditFiles":
        return "Making code edits";
      case "quickEdit":
        return "Making code edits";
      case "readFile":
        return "Reading file";
      case "runCommand":
        return "Running command";
      case "validateProject":
        return "Validating project";
      case "getSandboxUrl":
        return "Getting sandbox URL";
      case "finalizeWorkingFragment":
        return "Finalizing changes";
      default:
        return `Running ${toolName}`;
    }
  }

  // Fallback to counting completed actions
  const completedTools = toolParts.filter(
    (part) =>
      part.type.startsWith("tool-") &&
      (part as any).state === "output-available",
  ).length;

  if (completedTools > 0) {
    return `Completed ${completedTools} action${completedTools > 1 ? "s" : ""}`;
  }

  return "Processing";
};

export default function DemoChat({
  onFragmentCreated,
  onGenerationStateChange,
  sandboxReady,
  demoStep = 0,
  onDemoStepChange,
  isSimulating = false,
  initialMessages, // New prop for real project messages
  allMessages, // Full messages array for button logic
  demoType,
  demoTypeSelect,
  showDemo,
  handleStartBuilding,

}: {
  id?: string | undefined;
  userId?: string;
  projectId: string;
  onFragmentCreated?: () => void;
  onGenerationStateChange?: (isGenerating: boolean) => void;
  sandboxReady?: boolean;
  demoStep?: number; // Now represents step group index
  onDemoStepChange?: (stepGroup: number) => void; // Now takes step group index
  isSimulating?: boolean;
  initialMessages?: UIMessage[]; // Optional prop for demo messages
  allMessages?: UIMessage[]; // Full messages array for button logic
  demoType?: string;
  demoTypeSelect: (demoType: string) => void;
  showDemo?: boolean;
  handleStartBuilding?: () => void;
}) {

  // Track processed tool calls to prevent duplicate triggers
  const processedToolCallIds = useRef<Set<string>>(new Set());

  // Use refs to avoid re-renders when callbacks change
  const onFragmentCreatedRef = useRef(onFragmentCreated);
  const onGenerationStateChangeRef = useRef(onGenerationStateChange);

  // Update refs when callbacks change
  useEffect(() => {
    onFragmentCreatedRef.current = onFragmentCreated;
    onGenerationStateChangeRef.current = onGenerationStateChange;
  }, [onFragmentCreated, onGenerationStateChange]);

  const searchParams = useSearchParams();

  useEffect(() => {
    // Only check for tool completions when not actively streaming

    const lastMessage = initialMessages?.[initialMessages.length - 1];
    if (lastMessage?.role === "assistant") {
      let hasFragmentChanges = false;

      for (const part of lastMessage.parts) {
        // Check for fragment-related tools
        if (
          (part.type === "tool-writeFile" ||
            part.type === "tool-createOrEditFiles" ||
            part.type === "tool-finalizeWorkingFragment") &&
          part.state === "output-available"
        ) {
          // Only process each tool call once using toolCallId
          const toolCallId = (part as any).toolCallId;
          if (toolCallId && !processedToolCallIds.current.has(toolCallId)) {
            processedToolCallIds.current.add(toolCallId);
            hasFragmentChanges = true;

            console.log(
              "[Chat] Fragment tool completed:",
              part.type,
              "ID:",
              toolCallId,
            );
          }
        }
      }

      // Only trigger updates if we detected new fragment changes
      if (hasFragmentChanges) {
        console.log(
          "[Chat] Triggering fragment updates due to tool completions",
        );

        // Use debounced refresh to update fragments list

        // Also trigger fragment creation callback to load the new fragment
        if (onFragmentCreatedRef.current) {
          console.log("[Chat] Triggering onFragmentCreated callback");
          onFragmentCreatedRef.current();
        }
      }
    }
  }, [initialMessages]);



  // Memoize step groups and related calculations
  const stepGroups = useMemo(() => {
    return groupMessagesIntoStepGroups(allMessages || []);
  }, [allMessages]);

  const displayedStepGroups = useMemo(() => {
    return groupMessagesIntoStepGroups(initialMessages || []);
  }, [initialMessages]);

  // Memoize the last user message index calculation to avoid recalculating on every render
  const lastUserMessageIndex = useMemo(() => {
    if (!initialMessages || initialMessages.length === 0) return -1;
    for (let i = initialMessages.length - 1; i >= 0; i--) {
      if (initialMessages[i]?.role === "user") {
        return i;
      }
    }
    return -1;
  }, [initialMessages]);

  // // If demo type selected but not started, show start button
  // if (!showDemo) {
  //   return (
  //     <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
  //       <div className="max-w-2xl w-full text-center">
  //         <h1 className="text-4xl font-bold text-gray-900 mb-4">
  //           {demoType === "TODO_APP" && "Todo App Demo"}
  //           {demoType === "AIRBNB_CLONE" && "Airbnb Clone Demo"}
  //           {demoType === "SPOTIFY_CLONE" && "Spotify Clone Demo"}
  //         </h1>
  //         <p className="text-xl text-gray-600 mb-8">
  //           Ready to see AI build your application step by step?
  //         </p>
  //         <div className="space-y-4">
  //           <Button
  //             size="lg"
  //             className="text-lg px-8 py-4"
  //             onClick={handleStartBuilding}
  //           >
  //             🚀 Start Building
  //           </Button>
  //           <div>
  //             <Button
  //               variant="ghost"
  //               onClick={() => demoTypeSelect("")}
  //               className="text-gray-600"
  //             >
  //               ← Back to Demo Selection
  //             </Button>
  //           </div>
  //         </div>
  //       </div>
  //     </div>
  //   );
  // }
  if (!demoType) {
    return (
      <div className="flex flex-col gap-2 pt-2">
        {["TODO_APP", "AIRBNB_CLONE", "VACATION_APP", "SPOTIFY_CLONE"].map((demoType) => (
          <div key={demoType} className="flex justify-end gap-2 max-w-full">
            <Button
              key={demoType}
              onClick={() => demoTypeSelect(demoType)}
              className="text-left justify-end h-auto p-3 whitespace-normal w-fit"
              variant="outline"
              disabled={isSimulating}
            >
              {demoType === "TODO_APP" && "To do list app"}
              {demoType === "AIRBNB_CLONE" && "Platform for real estate listings (Airbnb-like)"}
              {demoType === "SPOTIFY_CLONE" && "Spotify-like app"}
              {demoType === "VACATION_APP" && "Internal app: employee vacation tracker"}
            </Button>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-hidden">
      <div className="flex flex-col h-[75vh] md:h-full min-h-0 overflow-hidden size-full">
        <StickToBottom
          className="flex-1 min-h-0 relative mt-4 mx-4"
          initial="smooth"
          resize="smooth"
          role="log"
        >
          <StickToBottom.Content className="flex flex-col gap-4 mb-8 pt-2">
            {initialMessages?.map((message, messageIndex) => {
              if (!message) return null;
              const groups = groupToolCalls(message.parts);
              console.log(groups);
              console.log(message.parts);

              const isLastUserMessage =
                message.role === "user" &&
                messageIndex === lastUserMessageIndex;

              // Check if there's an assistant message after this user message with any content
              const assistantMessage = initialMessages?.[messageIndex + 1];
              const assistantHasContent =
                assistantMessage?.role === "assistant" &&
                assistantMessage.parts.length > 0;

              return (
                <Fragment key={`message-${message.id}`}>
                  {groups.map((group, groupIndex) => {
                    if (group.type === "text") {
                      const part = group.content[0];
                      const isStreaming = (part as any).state === "streaming";

                      return (
                        <Message
                          key={`message-${message.id}-text-${groupIndex}`}
                          from={message.role}
                        >
                          <MessageContent>
                            <Response>
                              {(part as any).text}

                            </Response>
                          </MessageContent>
                        </Message>
                      );
                    } else if (group.type === "reasoning") {
                      const part = group.content[0];
                      const isStreaming = (part as any).state === "streaming";
                      return (
                        <Reasoning
                          key={`message-${message.id}-reasoning-${groupIndex}`}
                          // instead of isStreaming, we can use group.isComplete to determine if reasoning is done
                          isStreaming={(part as any).state === "streaming"}
                          className={cn(
                            'data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 data-[state=closed]:animate-out data-[state=open]:animate-in border-none overflow-hidden rounded-lg',
                            '[box-shadow:0px_2px_5px_0px_#676E7614,0px_1px_1px_0px_#0000001F] max-w-sm',
                          )}
                          defaultOpen={false}
                        >
                          <ReasoningTrigger className="flex cursor-pointer justify-between items-center gap-2 bg-prj-bg-secondary text-muted-foreground hover:text-foreground rounded-t-lg px-3 py-[10px]" />
                          <ReasoningContent className="px-3 py-[10px]">
                            {(part as any).text}
                          </ReasoningContent>
                        </Reasoning>
                      );
                    } else if (group.type === "tool-group") {
                      return (
                        <Task
                          key={`message-${message.id}-toolgroup-${groupIndex}`}
                          defaultOpen={false}
                          className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 max-w-sm"
                        >
                          <TaskTrigger
                            title={group.title || "Processing..."}
                            className="text-xs px-3 py-2"
                            loading={
                              !group.isComplete &&
                              group.content.some(
                                (part) =>
                                  (part as any).state === "streaming" ||
                                  (part as any).state === "input-streaming" ||
                                  (part as any).state === "input-available",
                              )
                            }
                          />
                          <TaskContent className="p-2 space-y-1 mt-0">
                            {group.content.map((part, i) => {
                              // Handle reasoning parts within tool groups
                              if (part.type === "reasoning") {
                                return (
                                  <div key={`reasoning-${i}`} className="mb-2">
                                    <Reasoning
                                      isStreaming={
                                        (part as any).state === "streaming"
                                      }
                                      defaultOpen={false}
                                    >
                                      <ReasoningTrigger
                                        className="text-xs"
                                        compact
                                      />
                                      <ReasoningContent className="text-xs mt-2">
                                        {(part as any).text}
                                      </ReasoningContent>
                                    </Reasoning>

                                  </div>
                                );
                              }

                              // Type guard to ensure we have a tool part
                              type ToolPart = UIMessagePart<
                                UIDataTypes,
                                UITools
                              > & {
                                type: `tool-${string}`;
                                toolCallId: string;
                                state:
                                | "input-streaming"
                                | "input-available"
                                | "output-available"
                                | "output-error";
                                input: unknown;
                                output?: unknown;
                                errorText?: string;
                              };

                              const isTool = (
                                part: UIMessagePart<UIDataTypes, UITools>,
                              ): part is ToolPart =>
                                part.type.startsWith("tool-");

                              if (!isTool(part)) return null;

                              const toolName = part.type.replace("tool-", "");

                              // Create a more user-friendly tool description
                              let toolDescription = "";
                              if (
                                part.state === "output-available" ||
                                part.state === "output-error"
                              ) {
                                switch (toolName) {
                                  case "writeFile": {
                                    const filePath =
                                      (part.input as any)?.path || "file";
                                    toolDescription = `Wrote ${filePath}`;
                                    break;
                                  }
                                  case "createOrEditFiles": {
                                    const filePath =
                                      (part.input as any)?.path || "file";
                                    toolDescription = `Updated ${filePath}`;
                                    break;
                                  }
                                  case "quickEdit": {
                                    const filePath =
                                      (part.input as any)?.filePath || "file";
                                    toolDescription = `Made code edits to ${filePath}`;
                                    break;
                                  }
                                  case "readFile": {
                                    const readPath =
                                      (part.input as any)?.path || "file";
                                    toolDescription = `Read ${readPath}`;
                                    break;
                                  }
                                  case "runCommand": {
                                    const command =
                                      (part.input as any)?.command || "command";
                                    // Check if it's a theme installation command
                                    if (
                                      command.includes("shadcn") &&
                                      command.includes("themes/")
                                    ) {
                                      toolDescription = "Applied theme";
                                    } else if (
                                      command.includes("shadcn") &&
                                      command.includes("add")
                                    ) {
                                      toolDescription = "Installed components";
                                    } else {
                                      toolDescription = `Ran: ${command}`;
                                    }
                                    break;
                                  }
                                  case "validateProject":
                                    toolDescription =
                                      "Validated project structure";
                                    break;
                                  case "getSandboxUrl":
                                    toolDescription = "Retrieved sandbox URL";
                                    break;
                                  case "finalizeWorkingFragment":
                                    toolDescription = "Finalized changes";
                                    break;
                                  default:
                                    toolDescription = `Completed ${toolName}`;
                                }
                              } else {
                                switch (toolName) {
                                  case "writeFile": {
                                    if (part.state === "input-available") {
                                      toolDescription = `Writing file ${(part.input as any).name
                                        }...`;
                                    } else {
                                      toolDescription = "Writing file...";
                                    }
                                    break;
                                  }
                                  case "createOrEditFiles": {
                                    if (part.state === "input-available") {
                                      const filePath =
                                        (part.input as any)?.path || "file";
                                      toolDescription = `Updating ${filePath}...`;
                                    } else {
                                      toolDescription = "Updating file...";
                                    }
                                    break;
                                  }
                                  case "quickEdit": {
                                    if (part.state === "input-available") {
                                      const filePath =
                                        (part.input as any)?.filePath || "file";
                                      toolDescription = `Making code edits to ${filePath}...`;
                                    } else {
                                      toolDescription = "Making code edits...";
                                    }
                                    break;
                                  }
                                  case "readFile":
                                    toolDescription = "Reading file...";
                                    break;
                                  case "runCommand": {
                                    const command =
                                      (part.input as any)?.command || "command";
                                    // Check if it's a theme installation command
                                    if (
                                      command.includes("shadcn") &&
                                      command.includes("themes/")
                                    ) {
                                      toolDescription = "Applying theme...";
                                    } else if (
                                      command.includes("shadcn") &&
                                      command.includes("add")
                                    ) {
                                      toolDescription =
                                        "Installing components...";
                                    } else {
                                      toolDescription = "Running command...";
                                    }
                                    break;
                                  }
                                  case "validateProject":
                                    toolDescription = "Validating project...";
                                    break;
                                  case "getSandboxUrl":
                                    toolDescription = "Getting sandbox URL...";
                                    break;
                                  case "finalizeWorkingFragment":
                                    toolDescription = "Finalizing changes...";
                                    break;
                                  default:
                                    toolDescription = `Running ${toolName}...`;
                                }
                              }

                              // Check if this tool has special output handling
                              const hasSpecialOutput =
                                (part.type === "tool-createOrEditFiles" &&
                                  part.output &&
                                  (part.output as any)?.success) ||
                                (part.type === "tool-getSandboxUrl" &&
                                  part.output &&
                                  (part.output as any)?.url);

                              return (
                                <TaskItem
                                  key={`tool-${message.id}-${groupIndex}-${i}`}
                                  className="flex flex-col gap-1"
                                >
                                  {/* Show error details if present and no special output */}
                                  {part.errorText && !hasSpecialOutput && (
                                    <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded text-red-700 dark:text-red-300 text-xs">
                                      {part.errorText}
                                    </div>
                                  )}

                                  {/* Only show the main tool description if there's no special output */}
                                  {!hasSpecialOutput && (
                                    <>
                                      <div className="flex items-center gap-2">
                                        <div className="flex-shrink-0">
                                          <SiReact className="w-3 h-3 text-blue-500" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center justify-between">
                                            <span className="text-xs text-gray-900 dark:text-gray-100 truncate">
                                              {toolDescription}
                                            </span>
                                            {part.state === "output-error" && (
                                              <span className="flex items-center justify-center w-4 h-4 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                                <CircleX size="12" />
                                              </span>
                                            )}
                                            {part.state ===
                                              "output-available" && (
                                                <span className="flex items-center justify-center w-4 h-4 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                  <CircleCheckBig size="12" />
                                                </span>
                                              )}
                                            {(part.state ===
                                              "input-streaming" ||
                                              part.state ===
                                              "input-available") && (
                                                <span className="flex items-center justify-center w-4 h-4 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                                  <span className="text-xs leading-none">
                                                    ⋯
                                                  </span>
                                                </span>
                                              )}
                                          </div>
                                        </div>
                                      </div>
                                    </>
                                  )}

                                  {/* Show special output for createOrEditFiles */}
                                  {part.type === "tool-createOrEditFiles" &&
                                    part.output &&
                                    (part.output as any)?.success && (
                                      <div className="flex items-center gap-2 w-full">
                                        <div className="flex-shrink-0">
                                          {(() => {
                                            const {
                                              component: IconComponent,
                                              color,
                                            } = getFileIcon(
                                              (part.output as any).path || "",
                                            );
                                            return (
                                              <IconComponent
                                                className="w-3 h-3"
                                                style={{ color }}
                                              />
                                            );
                                          })()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center justify-between">
                                            <p className="text-xs text-gray-900 dark:text-gray-100 truncate">
                                              {(part.output as any).action ===
                                                "created"
                                                ? "Created"
                                                : "Updated"}
                                              : {(part.output as any).path}
                                            </p>
                                            {/* Show status badge for special output */}
                                            {part.state === "output-error" && (
                                              <span className="flex items-center justify-center w-4 h-4 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                                <CircleX size="12" />
                                              </span>
                                            )}
                                            {part.state ===
                                              "output-available" && (
                                                <span className="flex items-center justify-center w-4 h-4 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                  <CircleCheckBig size="12" />
                                                </span>
                                              )}
                                            {(part.state ===
                                              "input-streaming" ||
                                              part.state ===
                                              "input-available") && (
                                                <span className="flex items-center justify-center w-4 h-4 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                                  <span className="text-xs leading-none">
                                                    ⋯
                                                  </span>
                                                </span>
                                              )}
                                          </div>
                                          {(part.output as any).description && (
                                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5 text-xs">
                                              {(part.output as any).description}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                </TaskItem>
                              );
                            })}
                          </TaskContent>
                        </Task>
                      );
                    }
                    return null;
                  })}

                  {/* Show sandbox preview URL after text content */}
                  {(() => {
                    // Find the last tool-group index
                    const lastToolGroupIndex = groups
                      .map((group, index) =>
                        group.type === "tool-group" ? index : -1,
                      )
                      .filter((index) => index !== -1)
                      .pop();

                    // Find if there's any text group after the last tool-group
                    const hasTextAfterTools =
                      lastToolGroupIndex !== undefined &&
                      groups
                        .slice(lastToolGroupIndex + 1)
                        .some((group) => group.type === "text");

                    if (!hasTextAfterTools) return null;
                    const sandboxGroup = groups.find(
                      (group) =>
                        group.type === "tool-group" &&
                        group.isComplete &&
                        group.content.some((part) => {
                          const toolPart = part as any;
                          return (
                            toolPart.type === "tool-getSandboxUrl" &&
                            toolPart.output &&
                            toolPart.output.url
                          );
                        }),
                    );

                    if (!sandboxGroup) return null;

                    const sandboxPart = sandboxGroup.content.find((part) => {
                      const toolPart = part as any;
                      return (
                        toolPart.type === "tool-getSandboxUrl" &&
                        toolPart.output &&
                        toolPart.output.url
                      );
                    }) as any;

                    if (!sandboxPart?.output?.url) return null;

                    return (
                      <>
                        {/* <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                          🌐 Sandbox Preview URL
                        </p>
                        <a
                          href={sandboxPart.output.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium"
                        >
                          Preview →
                        </a> */}
                      </>
                    );
                  })()}

                  {/* Show sandbox status after last user message */}
                  {isLastUserMessage && (
                    <div className="">
                      <SandboxStatusCard
                        icon={
                          <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                        }
                        text="✅ Sandbox connected"
                        variant="connected"
                      />
                    </div>
                  )}
                </Fragment>
              );
            })}

            {/* Show demo action buttons inline after the last message */}
            {(() => {
              // Don't show buttons if currently simulating
              if (isSimulating) {
                return null;
              }

              console.log("demoStep (stepGroup)", demoStep);
              console.log("stepGroups", stepGroups);
              console.log("displayedStepGroups", displayedStepGroups);

              // Check if there are more step groups to show
              const nextStepGroupIndex = displayedStepGroups.length;
              const nextStepGroup = stepGroups[nextStepGroupIndex];

              if (!nextStepGroup) {
                return (
                  <div className="text-center text-muted-foreground p-4">
                    <span>🎉 Demo completed!.</span>
                  </div>
                );
              }

              // Create button text from the first user message in the next step group
              const firstUserMessage = nextStepGroup.userMessages[0];
              if (!firstUserMessage || !firstUserMessage.parts[0] || firstUserMessage.parts[0].type !== "text") {
                return null;
              }

              const buttonText = firstUserMessage.parts[0].text;

              // If there are multiple user messages in the group, show count
              const userMessageCount = nextStepGroup.userMessages.length;
              const displayText = userMessageCount > 1
                ? `${buttonText} (+${userMessageCount - 1} more messages)`
                : buttonText;

              return (
                <div className="flex justify-end gap-2 max-w-full">
                  <div className="flex flex-col gap-2">
                    <Button
                      key={`stepgroup-${nextStepGroupIndex}`}
                      onClick={() => onDemoStepChange?.(nextStepGroupIndex)}
                      className="text-left justify-end h-auto p-3 whitespace-normal w-fit"
                      variant="outline"
                      disabled={isSimulating}
                    >
                      {displayText}
                    </Button>
                  </div>
                </div>
              );
            })()}

            {/*{status === "submitted" && <Loader />}*/}
          </StickToBottom.Content>
          <ScrollToBottomButton />
        </StickToBottom>

        <div className="flex-shrink-0 mx-4 mb-4">
          <PromptInput onSubmit={() => { }} className="">
            <PromptInputTextarea
              data-chat-input
              placeholder="This is a demo. Usually you'd write instructions here, for Shipper AI to build your app. But for now, use the buttons above - it's as if you typed these instructions."
              onChange={() => { }}
              value=""
              disabled={true}
              className="text-xs md:text-sm cursor-not-allowed opacity-60"
            />
            <PromptInputToolbar>
              <PromptInputTools>
              </PromptInputTools>
              <PromptInputSubmit
                disabled={true}
                status="ready"
                title="Demo mode - use action buttons to continue"
                className="cursor-not-allowed opacity-60"
              />
            </PromptInputToolbar>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}