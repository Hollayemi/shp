"use client";

import { Fragment, memo, useState, useCallback } from "react";
import { UIMessage, UIMessagePart, UIDataTypes, UITools } from "ai";
import { CollapsibleTrigger } from "@/components/ui/collapsible";
import { CaretUpMiniIcon } from "@/components/icons/CaretUpMiniIcon";
import { ShimmeringText } from "@/components/ui/shadcn-io/shimmering-text";
import { Message, MessageContent } from "@/components/ai-elements/message";
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
import {
  SiReact,
  SiTypescript,
  SiJavascript,
  SiCss,
  SiHtml5,
  SiJson,
  SiMarkdown,
} from "@icons-pack/react-simple-icons";
import {
  AlertTriangle,
  CheckCircle,
  CircleCheckBig,
  CircleX,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { File as FileIcon, FileCode } from "lucide-react";
import { getFileExtension } from "./ImageThumbnail";
import { PreviewViewIcon } from "@/components/icons/PreviewViewIcon";
import {
  TaskInProgressIcon,
  TaskCompleteIcon,
  TaskErrorIcon,
} from "@/components/icons/TaskStatusIcons";
import { GeneratedImageIcon } from "@/components/icons/GeneratedImageIcon";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { ThinkingBubble } from "./ThinkingBubble";
import {
  ShipperCloudConfirmation,
  ShipperCloudDeploying,
  ShipperCloudSuccess,
  ShipperCloudDenied,
  SHIPPER_CLOUD_APPROVAL,
  SHIPPER_CLOUD_TOOL_NAME,
} from "@/components/ShipperCloudConfirmation";
import {
  ApiKeyInput,
  ApiKeySuccess,
  REQUEST_API_KEYS_TOOL_NAME,
  STRIPE_KEY_CONFIG,
} from "@/components/ApiKeyInput";
import {
  StripeHitlCard,
  StripeHitlProcessing,
  StripeHitlSuccess,
  StripeHitlDenied,
  isStripeHitlTool,
} from "@/components/StripeHitlCard";

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
const groupToolCalls = (
  parts: UIMessagePart<UIDataTypes, UITools>[],
  messageRole?: "user" | "assistant" | "system",
) => {
  const groups: Array<{
    type:
    | "text"
    | "reasoning"
    | "tool-group"
    | "file"
    | "user-content"
    | "shipper-cloud"
    | "api-keys"
    | "stripe-hitl";
    content: UIMessagePart<UIDataTypes, UITools>[];
    title?: string;
    isComplete?: boolean;
    showBadge?: boolean;
    editCount?: number;
  }> = [];

  // console.log(parts)

  let firstReasoningFound = false;
  let currentToolGroup: UIMessagePart<UIDataTypes, UITools>[] = [];
  let pendingToolCalls = 0;

  // For user messages, combine text and images into a single group
  if (messageRole === "user") {
    const textParts = parts.filter((p) => p.type === "text");
    const fileParts = parts.filter((p) => p.type === "file");

    if (textParts.length > 0 || fileParts.length > 0) {
      groups.push({
        type: "user-content",
        content: [...fileParts, ...textParts], // Images first, then text
      });
    }
    return groups;
  }

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
        const titleInfo = generateToolGroupTitle(currentToolGroup);
        groups.push({
          type: "tool-group",
          content: [...currentToolGroup],
          title: titleInfo.title,
          isComplete: pendingToolCalls === 0,
          showBadge: titleInfo.showBadge,
          editCount: titleInfo.editCount,
        });
        currentToolGroup = [];
        pendingToolCalls = 0;
      }

      groups.push({
        type: "text",
        content: [part],
      });
    } else if (part.type === "file") {
      // Close any pending tool group before file
      if (currentToolGroup.length > 0) {
        const titleInfo = generateToolGroupTitle(currentToolGroup);
        groups.push({
          type: "tool-group",
          content: [...currentToolGroup],
          title: titleInfo.title,
          isComplete: pendingToolCalls === 0,
          showBadge: titleInfo.showBadge,
          editCount: titleInfo.editCount,
        });
        currentToolGroup = [];
        pendingToolCalls = 0;
      }

      groups.push({
        type: "file",
        content: [part],
      });
    } else if (part.type === "reasoning") {
      // First reasoning always gets its own group
      if (!firstReasoningFound) {
        // Close any pending tool group
        if (currentToolGroup.length > 0) {
          const titleInfo = generateToolGroupTitle(currentToolGroup);
          groups.push({
            type: "tool-group",
            content: [...currentToolGroup],
            title: titleInfo.title,
            isComplete: pendingToolCalls === 0,
            showBadge: titleInfo.showBadge,
            editCount: titleInfo.editCount,
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
      // Check if this is a Shipper Cloud, API Keys, or Stripe HITL tool - they get their own standalone groups
      const toolPart = part as any;
      const toolName = toolPart.toolName || part.type.replace("tool-", "");
      const isShipperCloudTool = toolName === SHIPPER_CLOUD_TOOL_NAME;
      const isApiKeysTool = toolName === REQUEST_API_KEYS_TOOL_NAME;
      const isStripeHitlTool =
        toolName === "stripeListProducts" ||
        toolName === "stripeListPrices" ||
        toolName === "stripeCreateProductAndPrice";

      if (isShipperCloudTool || isApiKeysTool || isStripeHitlTool) {
        // Close any pending tool group before standalone tools
        if (currentToolGroup.length > 0) {
          const titleInfo = generateToolGroupTitle(currentToolGroup);
          groups.push({
            type: "tool-group",
            content: [...currentToolGroup],
            title: titleInfo.title,
            isComplete: pendingToolCalls === 0,
            showBadge: titleInfo.showBadge,
            editCount: titleInfo.editCount,
          });
          currentToolGroup = [];
          pendingToolCalls = 0;
        }

        // Create standalone group based on tool type
        groups.push({
          type: isShipperCloudTool
            ? "shipper-cloud"
            : isApiKeysTool
              ? "api-keys"
              : "stripe-hitl",
          content: [part],
        });
      } else {
        // Add to current tool group (normal tools)
        currentToolGroup.push(part);

        // Track pending tool calls
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
          const titleInfo = generateToolGroupTitle(currentToolGroup);
          groups.push({
            type: "tool-group",
            content: [...currentToolGroup],
            title: titleInfo.title,
            isComplete: pendingToolCalls === 0,
            showBadge: titleInfo.showBadge,
            editCount: titleInfo.editCount,
          });
          currentToolGroup = [];
          pendingToolCalls = 0;
        }
      }
    }
  }

  // Close any remaining tool group
  if (currentToolGroup.length > 0) {
    const titleInfo = generateToolGroupTitle(currentToolGroup);
    groups.push({
      type: "tool-group",
      content: [...currentToolGroup],
      title: titleInfo.title,
      isComplete: pendingToolCalls === 0,
      showBadge: titleInfo.showBadge,
      editCount: titleInfo.editCount,
    });
  }

  return groups;
};

// Generate a descriptive title for a group of tool calls
const generateToolGroupTitle = (
  toolParts: UIMessagePart<UIDataTypes, UITools>[],
): { title: string; showBadge: boolean; editCount?: number } => {
  // Find the current active part (streaming or most recent)
  const activePart =
    toolParts.find(
      (part) =>
        (part as any).state === "streaming" ||
        (part as any).state === "input-streaming" ||
        (part as any).state === "input-available",
    ) || toolParts[toolParts.length - 1];

  // Check if all edits are complete for createOrEditFiles/quickEdit
  const editTools = toolParts.filter(
    (part) =>
      part.type === "tool-createOrEditFiles" || part.type === "tool-quickEdit",
  );

  if (editTools.length > 0) {
    const completedEdits = editTools.filter(
      (part) =>
        (part as any).state === "output-available" ||
        (part as any).state === "output-error",
    ).length;

    const totalEdits = editTools.length;
    const allEditsComplete = completedEdits === totalEdits;

    // If all edits are complete, show count WITHOUT badge
    if (allEditsComplete) {
      const successfulEdits = editTools.filter(
        (part) => (part as any).state === "output-available",
      ).length;
      return {
        title: `${successfulEdits} edit${successfulEdits !== 1 ? "s" : ""} made`,
        showBadge: false,
      };
    }

    // Otherwise, show current file being edited WITH badge
    const activeEditPart =
      editTools.find(
        (part) =>
          (part as any).state === "input-streaming" ||
          (part as any).state === "input-available",
      ) || editTools[editTools.length - 1];

    if (activeEditPart) {
      const fileName =
        (activeEditPart as any).input?.path ||
        (activeEditPart as any).output?.path ||
        "file";
      return {
        title: `Editing | ${fileName}`,
        showBadge: true,
        editCount: completedEdits,
      };
    }
  }

  // Check if this is a generateImage tool
  const imageTools = toolParts.filter(
    (part) => part.type === "tool-generateImage",
  );

  if (imageTools.length > 0) {
    const completedImages = imageTools.filter(
      (part) =>
        (part as any).state === "output-available" ||
        (part as any).state === "output-error",
    );

    const allImagesComplete = completedImages.length === imageTools.length;

    if (allImagesComplete) {
      // Show completed state without prompt in title
      const lastImagePart = completedImages[completedImages.length - 1];
      const output = (lastImagePart as any).output;

      if (output?.images && output.images.length > 1) {
        const successfulImages = output.images.filter(
          (img: any) => img.success,
        );
        return {
          title: `Generated ${successfulImages.length} image${successfulImages.length !== 1 ? "s" : ""}`,
          showBadge: false,
        };
      }

      return {
        title: "Generated image",
        showBadge: false,
      };
    } else {
      // Show in-progress state without prompt in title
      const activeImagePart =
        imageTools.find(
          (part) =>
            (part as any).state === "input-streaming" ||
            (part as any).state === "input-available",
        ) || imageTools[imageTools.length - 1];

      if (activeImagePart) {
        const input = (activeImagePart as any).input;
        if (input?.images && input.images.length > 1) {
          return {
            title: `Generating ${input.images.length} images`,
            showBadge: true,
          };
        }
      }

      return {
        title: "Generating image",
        showBadge: true,
      };
    }
  }

  if (activePart?.type.startsWith("tool-")) {
    const toolName = activePart.type.replace("tool-", "");
    let title: string;
    switch (toolName) {
      case "writeFile":
        title = "Writing file";
        break;
      case "createOrEditFiles":
      case "quickEdit":
        // Fallback for edge cases
        title = "Making code edits";
        break;
      case "readFile":
        title = "Reading file";
        break;
      case "runCommand":
        title = "Running command";
        break;
      case "validateProject":
        title = "Validating project";
        break;
      case "getSandboxUrl":
        title = "Getting sandbox URL";
        break;
      case "finalizeWorkingFragment":
        title = "Finalizing changes";
        break;
      case "detectErrors":
        title = "Error detection";
        break;
      case "autoFixErrors":
        title = "Auto-fixing errors";
        break;
      case "generateImage":
        // Extract the prompt/description from the input
        const imagePrompt =
          (activePart as any).input?.prompt ||
          (activePart as any).input?.description ||
          (activePart as any).output?.alt ||
          "Generating image";
        title = `Image generation | ${imagePrompt}`;
        break;
      default:
        title = `Running ${toolName}`;
    }
    return { title, showBadge: false };
  }

  // Fallback to counting completed actions
  const completedTools = toolParts.filter(
    (part) =>
      part.type.startsWith("tool-") &&
      (part as any).state === "output-available",
  ).length;

  if (completedTools > 0) {
    return {
      title: `Completed ${completedTools} action${completedTools > 1 ? "s" : ""}`,
      showBadge: false,
    };
  }

  return { title: "Processing", showBadge: false };
};

// Type for tool result handler (from useChat's addToolResult)
// The AI SDK expects: tool, toolCallId, and output (not result)
type AddToolResultHandler = (args: {
  tool: string;
  toolCallId: string;
  output: unknown;
}) => void;

// Type for send message handler (from useChat)
// Can optionally accept a message string for HITL confirmations
type SendMessageHandler = (message?: string) => void;

// Memoized message component to prevent re-renders
export const ChatMessage = memo(
  function ChatMessage({
    projectId,
    message,
    messageIndex,
    lastUserMessageIndex,
    messages,
    shouldShowAssistantHeader,
    isStreaming = false,
    onAddToolResult,
    onSendMessage,
    shipperCloudEnabled = false,
    onOpenCloudCreditsModal,
  }: {
    /** Project ID for HITL API calls */
    projectId: string;
    message: UIMessage;
    messageIndex: number;
    lastUserMessageIndex: number;
    messages: UIMessage[];
    shouldShowAssistantHeader: boolean;
    /** Whether the AI is currently streaming a response */
    isStreaming?: boolean;
    /** Handler to add tool result for HITL interactions */
    onAddToolResult?: AddToolResultHandler;
    /** Handler to send message after adding tool result */
    onSendMessage?: SendMessageHandler;
    /** Whether Shipper Cloud is already enabled for this project */
    shipperCloudEnabled?: boolean;
    /** Callback to open the Cloud Credits modal */
    onOpenCloudCreditsModal?: () => void;
  }) {
    // Track HITL confirmation status for each tool call (for immediate UI feedback)
    // Maps toolCallId -> { status: 'idle' | 'confirming' | 'denied' }
    const [hitlStatus, setHitlStatus] = useState<
      Record<string, { status: string }>
    >({});

    // Function to handle HITL confirmation using addToolResult + sendMessage pattern
    // This triggers the AI to continue after processing the confirmation on the backend
    const handleHitlConfirm = useCallback(
      (
        toolCallId: string,
        toolName: string,
        confirmed: boolean,
        data?: Record<string, unknown>,
      ) => {
        // Set status immediately for UI feedback
        setHitlStatus((prev) => ({
          ...prev,
          [toolCallId]: { status: confirmed ? "confirming" : "denying" },
        }));

        // Use AI SDK pattern: addToolResult sets the output, sendMessage triggers continuation
        if (onAddToolResult) {
          // Determine output based on tool type
          let output: string;

          // Debug: Log what we're sending
          const isStripe = isStripeHitlTool(toolName);
          console.log("[HITL] handleHitlConfirm called", {
            toolName,
            toolCallId,
            confirmed,
            data,
            isStripeHitl: isStripe,
          });

          if (toolName === REQUEST_API_KEYS_TOOL_NAME && data) {
            // For API keys tool, include the keys in the output
            output = JSON.stringify({ confirmed, keys: data });
          } else if (isStripe) {
            // For Stripe HITL tools, ALWAYS pass back confirmed status and original args
            // Even if data is empty, we need to send the confirmed flag
            output = JSON.stringify({ confirmed, ...(data || {}) });
            console.log("[HITL] Stripe HITL output:", output);
          } else {
            // Default: simple yes/no (for Shipper Cloud deployment)
            output = confirmed
              ? SHIPPER_CLOUD_APPROVAL.YES
              : SHIPPER_CLOUD_APPROVAL.NO;
          }

          onAddToolResult({
            tool: toolName,
            toolCallId,
            output,
          });
        }

        // Trigger AI continuation - backend will process the confirmation
        if (onSendMessage) {
          onSendMessage();
        }
      },
      [onAddToolResult, onSendMessage],
    );

    const isThinkingPlaceholder = Boolean(
      (message as any)?.metadata?.isThinkingPlaceholder,
    );
    // console.log(messages)
    // console.log(message)
    if (isThinkingPlaceholder) {
      return (
        <Fragment key={`message-${message.id}`}>
          <div>
            <div className="flex flex-col gap-[14px]">
              <Message
                from={message.role}
                isFirstAssistantResponse={shouldShowAssistantHeader}
              >
                <ThinkingBubble />
              </Message>
            </div>
          </div>
        </Fragment>
      );
    }

    const groups = groupToolCalls(message.parts, message.role);

    const isLastUserMessage =
      message.role === "user" && messageIndex === lastUserMessageIndex;

    const previousMessage = messages[messageIndex - 1];
    const assistantMessage = messages[messageIndex + 1];
    const assistantHasContent =
      assistantMessage?.role === "assistant" &&
      assistantMessage.parts.length > 0;

    return (
      <Fragment key={`message-${message.id}`}>
        <div>
          <div className="flex flex-col gap-[14px]">
            {groups.map((group, groupIndex) => {
              if (group.type === "user-content") {
                // Render user message with files at top and text below
                const fileParts = group.content.filter(
                  (p) => p.type === "file",
                );
                const textParts = group.content.filter(
                  (p) => p.type === "text",
                );

                return (
                  <Message
                    key={`message-${message.id}-user-content-${groupIndex}`}
                    from={message.role}
                  >
                    <MessageContent>
                      {/* Files at the top */}
                      {fileParts.length > 0 && (
                        <div className="mb-3 flex flex-wrap gap-2">
                          {fileParts.map((filePart: any, idx) => {
                            const isImage =
                              filePart.mediaType?.startsWith("image/");
                            const fileName = filePart.name || "file";
                            const extension = getFileExtension(fileName)
                              .replace(".", "")
                              .toUpperCase();

                            if (isImage && filePart.url) {
                              // Show image preview
                              return (
                                <div
                                  key={idx}
                                  className="overflow-hidden rounded-lg border"
                                >
                                  <img
                                    src={filePart.url}
                                    alt={fileName}
                                    className="h-[30px] w-[30px] object-cover"
                                  />
                                </div>
                              );
                            } else {
                              // Show file icon with extension and name
                              return (
                                <div
                                  key={idx}
                                  className="bg-muted flex items-center gap-2 rounded-lg border px-3 py-2"
                                  title={fileName}
                                >
                                  <div className="flex flex-col items-center justify-center">
                                    <FileText className="text-muted-foreground h-4 w-4" />
                                    {extension && (
                                      <span className="text-muted-foreground text-[8px] font-medium">
                                        {extension}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            }
                          })}
                        </div>
                      )}
                      {/* Text content below files */}
                      {textParts.map((textPart: any, idx) => (
                        <Response key={idx}>{textPart.text}</Response>
                      ))}
                    </MessageContent>
                  </Message>
                );
              } else if (group.type === "text") {
                const part = group.content[0];

                return (
                  <Message
                    key={`message-${message.id}-text-${groupIndex}`}
                    from={message.role}
                    isFirstAssistantResponse={
                      shouldShowAssistantHeader && groupIndex === 0
                    }
                  >
                    <MessageContent>
                      <Response>{(part as any).text}</Response>
                    </MessageContent>
                  </Message>
                );
              } else if (group.type === "file") {
                const part = group.content[0] as any;

                return (
                  <Message
                    key={`message-${message.id}-file-${groupIndex}`}
                    from={message.role}
                  >
                    <MessageContent>
                      <div className="flex flex-wrap gap-2">
                        {group.content.map((filePart: any, idx) => (
                          <div
                            key={idx}
                            className="overflow-hidden rounded-lg border"
                          >
                            <img
                              src={filePart.url}
                              alt="Attached image"
                              className="max-h-64 max-w-full object-contain"
                            />
                          </div>
                        ))}
                      </div>
                    </MessageContent>
                  </Message>
                );
              } else if (group.type === "reasoning") {
                const part = group.content[0];
                return (
                  <Reasoning
                    key={`message-${message.id}-reasoning-${groupIndex}`}
                    // instead of isStreaming, we can use group.isComplete to determine if reasoning is done
                    isStreaming={(part as any).state === "streaming"}
                    className={cn(
                      "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 data-[state=closed]:animate-out data-[state=open]:animate-in overflow-hidden rounded-lg border-none",
                      "[box-shadow:0px_2px_5px_0px_#676E7614,0px_1px_1px_0px_#0000001F]",
                      shouldShowAssistantHeader && groupIndex === 0 && "pt-3",
                    )}
                  >
                    <ReasoningTrigger className="bg-prj-bg-secondary text-muted-foreground hover:text-foreground flex cursor-pointer items-center justify-between gap-2 rounded-t-lg px-3 py-[10px] dark:text-[#F5F9F7]" />
                    <ReasoningContent className="px-3 py-[10px]">
                      {(part as any).text}
                    </ReasoningContent>
                  </Reasoning>
                );
              } else if (group.type === "shipper-cloud") {
                // Render Shipper Cloud tool standalone (not in a tool group)
                const part = group.content[0] as any;
                const toolCallId =
                  part.toolCallId || part.toolInvocationId || "";
                const input = (part.input || part.args) as
                  | {
                    projectName?: string;
                    reason?: string;
                    requestedFeatures?: string[];
                  }
                  | undefined;
                const result = (part.result || part.output) as
                  | {
                    status?: string;
                    success?: boolean;
                    deploymentUrl?: string;
                    projectName?: string;
                    requestedFeatures?: string[];
                  }
                  | string
                  | undefined;
                const parsedResult =
                  typeof result === "string"
                    ? (() => {
                      try {
                        return JSON.parse(result);
                      } catch {
                        return { message: result };
                      }
                    })()
                    : result;

                // Check local HITL status
                const localStatus = hitlStatus[toolCallId];

                // Determine what to render based on status
                const projectName =
                  parsedResult?.projectName || input?.projectName || "Untitled";
                const requestedFeatures =
                  parsedResult?.requestedFeatures ||
                  input?.requestedFeatures ||
                  [];

                // Show deploying state when confirming
                if (localStatus?.status === "confirming") {
                  return (
                    <div
                      key={`shipper-cloud-${message.id}-${groupIndex}`}
                      className="my-2"
                    >
                      <ShipperCloudDeploying projectName={projectName} />
                    </div>
                  );
                }

                // Show denied state
                if (
                  localStatus?.status === "denied" ||
                  localStatus?.status === "denying"
                ) {
                  return (
                    <div
                      key={`shipper-cloud-${message.id}-${groupIndex}`}
                      className="my-2"
                    >
                      <ShipperCloudDenied />
                    </div>
                  );
                }

                // Show confirmation dialog when pending
                if (
                  parsedResult?.status === "pending_confirmation" ||
                  part.state === "call" ||
                  part.state === "input-available"
                ) {
                  return (
                    <div
                      key={`shipper-cloud-${message.id}-${groupIndex}`}
                      className="my-2"
                    >
                      <ShipperCloudConfirmation
                        requestedFeatures={requestedFeatures}
                        isLoading={isStreaming}
                        isAlreadyEnabled={shipperCloudEnabled}
                        onOpenCloudCreditsModal={onOpenCloudCreditsModal}
                        onConfirm={async () => {
                          handleHitlConfirm(
                            toolCallId,
                            SHIPPER_CLOUD_TOOL_NAME,
                            true,
                          );
                        }}
                        onDeny={async () => {
                          handleHitlConfirm(
                            toolCallId,
                            SHIPPER_CLOUD_TOOL_NAME,
                            false,
                          );
                        }}
                      />
                    </div>
                  );
                }

                // Show deploying state while streaming
                if (
                  part.state === "partial-call" ||
                  part.state === "streaming"
                ) {
                  return (
                    <div
                      key={`shipper-cloud-${message.id}-${groupIndex}`}
                      className="my-2"
                    >
                      <ShipperCloudDeploying projectName={projectName} />
                    </div>
                  );
                }

                // Show result state (success or denied)
                if (
                  part.state === "result" ||
                  part.state === "output-available" ||
                  part.state === "output-error"
                ) {
                  const isDenied =
                    (typeof result === "string" &&
                      result.includes("cancelled by user")) ||
                    parsedResult?.status === "denied";

                  if (isDenied) {
                    return (
                      <div
                        key={`shipper-cloud-${message.id}-${groupIndex}`}
                        className="my-2"
                      >
                        <ShipperCloudDenied />
                      </div>
                    );
                  }

                  return (
                    <div
                      key={`shipper-cloud-${message.id}-${groupIndex}`}
                      className="my-2"
                    >
                      <ShipperCloudSuccess
                        projectName={projectName}
                        deploymentUrl={parsedResult?.deploymentUrl}
                      />
                    </div>
                  );
                }

                // Fallback - show confirmation
                return (
                  <div
                    key={`shipper-cloud-${message.id}-${groupIndex}`}
                    className="my-2"
                  >
                    <ShipperCloudConfirmation
                      requestedFeatures={requestedFeatures}
                      isLoading={isStreaming}
                      isAlreadyEnabled={shipperCloudEnabled}
                      onOpenCloudCreditsModal={onOpenCloudCreditsModal}
                      onConfirm={async () => {
                        handleHitlConfirm(
                          toolCallId,
                          SHIPPER_CLOUD_TOOL_NAME,
                          true,
                        );
                      }}
                      onDeny={async () => {
                        handleHitlConfirm(
                          toolCallId,
                          SHIPPER_CLOUD_TOOL_NAME,
                          false,
                        );
                      }}
                    />
                  </div>
                );
              } else if (group.type === "api-keys") {
                // Render API Keys input standalone
                const part = group.content[0] as any;
                const toolCallId =
                  part.toolCallId || part.toolInvocationId || "";
                const input = (part.input || part.args) as
                  | {
                    provider?: string;
                    title?: string;
                    fields?: Array<{
                      key: string;
                      label: string;
                      pattern?: string;
                      errorMessage?: string;
                    }>;
                    helpLink?: { url: string; text: string };
                    helpTooltip?: string;
                  }
                  | undefined;
                const result = (part.result || part.output) as
                  | {
                    status?: string;
                    success?: boolean;
                  }
                  | string
                  | undefined;
                const parsedResult =
                  typeof result === "string"
                    ? (() => {
                      try {
                        return JSON.parse(result);
                      } catch {
                        return { message: result };
                      }
                    })()
                    : result;

                // Check local HITL status
                const localStatus = hitlStatus[toolCallId];

                // Show success state
                if (
                  parsedResult?.success ||
                  localStatus?.status === "confirmed"
                ) {
                  return (
                    <div
                      key={`api-keys-${message.id}-${groupIndex}`}
                      className="my-2"
                    >
                      <ApiKeySuccess
                        title={
                          input?.title
                            ? `${input.title} configured!`
                            : "API keys configured!"
                        }
                      />
                    </div>
                  );
                }

                // Show loading/submitting state
                if (localStatus?.status === "confirming") {
                  return (
                    <div
                      key={`api-keys-${message.id}-${groupIndex}`}
                      className="my-2"
                    >
                      <ApiKeyInput
                        title={input?.title || "Enter API Keys"}
                        fields={
                          input?.fields?.map((f) => ({
                            ...f,
                            pattern: f.pattern
                              ? new RegExp(f.pattern)
                              : undefined,
                          })) || STRIPE_KEY_CONFIG.fields
                        }
                        helpLink={input?.helpLink || STRIPE_KEY_CONFIG.helpLink}
                        helpTooltip={
                          input?.helpTooltip || STRIPE_KEY_CONFIG.helpTooltip
                        }
                        onSubmit={async () => { }}
                        isLoading={true}
                      />
                    </div>
                  );
                }

                // Show input form when pending or streaming
                if (
                  parsedResult?.status === "pending_api_keys" ||
                  part.state === "call" ||
                  part.state === "input-available" ||
                  part.state === "partial-call" ||
                  part.state === "streaming"
                ) {
                  // Determine config based on provider
                  const provider = input?.provider || "stripe";
                  const config =
                    provider === "stripe"
                      ? STRIPE_KEY_CONFIG
                      : {
                        title: input?.title || "Enter API Keys",
                        fields:
                          input?.fields?.map((f) => ({
                            ...f,
                            pattern: f.pattern
                              ? new RegExp(f.pattern)
                              : undefined,
                          })) || [{ key: "apiKey", label: "API Key" }],
                        helpLink: input?.helpLink,
                        helpTooltip: input?.helpTooltip,
                      };

                  return (
                    <div
                      key={`api-keys-${message.id}-${groupIndex}`}
                      className="my-2"
                    >
                      <ApiKeyInput
                        title={config.title}
                        fields={config.fields}
                        helpLink={config.helpLink}
                        helpTooltip={config.helpTooltip}
                        onSubmit={async (keys) => {
                          handleHitlConfirm(
                            toolCallId,
                            REQUEST_API_KEYS_TOOL_NAME,
                            true,
                            keys,
                          );
                        }}
                        isLoading={isStreaming}
                      />
                    </div>
                  );
                }

                // Fallback - show input form
                return (
                  <div
                    key={`api-keys-${message.id}-${groupIndex}`}
                    className="my-2"
                  >
                    <ApiKeyInput
                      title={input?.title || STRIPE_KEY_CONFIG.title}
                      fields={
                        input?.fields?.map((f) => ({
                          ...f,
                          pattern: f.pattern
                            ? new RegExp(f.pattern)
                            : undefined,
                        })) || STRIPE_KEY_CONFIG.fields
                      }
                      helpLink={input?.helpLink || STRIPE_KEY_CONFIG.helpLink}
                      helpTooltip={
                        input?.helpTooltip || STRIPE_KEY_CONFIG.helpTooltip
                      }
                      onSubmit={async (keys) => {
                        handleHitlConfirm(
                          toolCallId,
                          REQUEST_API_KEYS_TOOL_NAME,
                          true,
                          keys,
                        );
                      }}
                      isLoading={isStreaming}
                    />
                  </div>
                );
              } else if (group.type === "stripe-hitl") {
                // Render Stripe HITL approval card using themed components
                const part = group.content[0] as any;
                const toolCallId =
                  part.toolCallId || part.toolInvocationId || "";
                // Extract toolName from part.toolName OR from part.type (e.g., "tool-stripeCreateProductAndPrice" -> "stripeCreateProductAndPrice")
                const toolName =
                  part.toolName ||
                  (part.type?.startsWith("tool-")
                    ? part.type.replace("tool-", "")
                    : "");
                const input = (part.input || part.args) as
                  | Record<string, any>
                  | undefined;
                const result = (part.result || part.output) as any;
                const parsedResult =
                  typeof result === "string"
                    ? (() => {
                      try {
                        return JSON.parse(result);
                      } catch {
                        return { message: result };
                      }
                    })()
                    : result;

                const localStatus = hitlStatus[toolCallId];
                const action =
                  parsedResult?.action || input?.name || "Stripe Operation";
                const details = parsedResult?.details || {};
                // Merge input args with parsed result to get all tool args
                // The tool returns the args in its result for HITL pass-through
                const toolArgs = { ...input, ...parsedResult };

                // Show success state
                if (
                  parsedResult?.success ||
                  parsedResult?.productId ||
                  parsedResult?.products ||
                  localStatus?.status === "confirmed"
                ) {
                  return (
                    <div
                      key={`stripe-hitl-${message.id}-${groupIndex}`}
                      className="my-2"
                    >
                      <StripeHitlSuccess
                        action={action}
                        productId={parsedResult?.productId}
                        priceId={parsedResult?.priceId}
                      />
                    </div>
                  );
                }

                // Show denied state
                if (
                  localStatus?.status === "denied" ||
                  localStatus?.status === "denying"
                ) {
                  return (
                    <div
                      key={`stripe-hitl-${message.id}-${groupIndex}`}
                      className="my-2"
                    >
                      <StripeHitlDenied />
                    </div>
                  );
                }

                // Show loading state
                if (localStatus?.status === "confirming") {
                  return (
                    <div
                      key={`stripe-hitl-${message.id}-${groupIndex}`}
                      className="my-2"
                    >
                      <StripeHitlProcessing action={action} />
                    </div>
                  );
                }

                // Show approval card
                if (
                  parsedResult?.status === "pending_approval" ||
                  part.state === "call" ||
                  part.state === "input-available" ||
                  part.state === "partial-call" ||
                  part.state === "streaming"
                ) {
                  return (
                    <div
                      key={`stripe-hitl-${message.id}-${groupIndex}`}
                      className="my-2"
                    >
                      <StripeHitlCard
                        action={action}
                        description={parsedResult?.description}
                        details={details}
                        toolArgs={toolArgs}
                        onConfirm={(args) =>
                          handleHitlConfirm(toolCallId, toolName, true, args)
                        }
                        onDeny={() =>
                          handleHitlConfirm(toolCallId, toolName, false)
                        }
                        isLoading={isStreaming}
                      />
                    </div>
                  );
                }

                // Fallback - show approval card
                return (
                  <div
                    key={`stripe-hitl-${message.id}-${groupIndex}`}
                    className="my-2"
                  >
                    <StripeHitlCard
                      action={action}
                      details={details}
                      toolArgs={toolArgs}
                      onConfirm={(args) =>
                        handleHitlConfirm(toolCallId, toolName, true, args)
                      }
                      onDeny={() =>
                        handleHitlConfirm(toolCallId, toolName, false)
                      }
                      isLoading={isStreaming}
                    />
                  </div>
                );
              } else if (group.type === "tool-group") {
                const isLoading =
                  !group.isComplete &&
                  group.content.some(
                    (part) =>
                      (part as any).state === "streaming" ||
                      (part as any).state === "input-streaming" ||
                      (part as any).state === "input-available",
                  );

                return (
                  <Task
                    key={`message-${message.id}-toolgroup-${groupIndex}`}
                    defaultOpen={isLoading || group.showBadge}
                    className="rounded-lg border bg-white dark:bg-gray-900"
                  >
                    <TaskTrigger
                      title={group.title || "Processing..."}
                      loading={isLoading || group.showBadge}
                      badge={
                        group.showBadge &&
                          group.editCount !== undefined &&
                          group.editCount > 0 ? (
                          <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-[#F6FDF9] px-2 py-0.5 text-xs font-medium text-[#065F46]">
                            <span className="h-1 w-1 rounded-full bg-[#059669]"></span>
                            {group.editCount} edit
                            {group.editCount !== 1 ? "s" : ""} made
                          </span>
                        ) : undefined
                      }
                    />
                    <TaskContent className="mt-0 space-y-[10px] px-3 py-[10px]">
                      {group.content.map((part, i) => {
                        // Handle reasoning parts within tool groups
                        // if (part.type === "reasoning") {
                        //     return (
                        //         <div key={`reasoning-${i}`} className="mb-2">
                        //             <Reasoning
                        //                 isStreaming={
                        //                     (part as any).state === "streaming"
                        //                 }
                        //                 defaultOpen={false}
                        //             >
                        //                 <ReasoningTrigger
                        //                     className="text-sm"
                        //                     compact
                        //                 />
                        //                 <ReasoningContent className="text-sm mt-2">
                        //                     {(part as any).text}
                        //                 </ReasoningContent>
                        //             </Reasoning>
                        //         </div>
                        //     );
                        // }

                        // Type guard to ensure we have a tool part
                        // Supports both formats:
                        // 1. tool-invocation format: { type: "tool-invocation", toolName, toolInvocationId, args }
                        // 2. tool-{name} format: { type: "tool-createOrEditFiles", toolCallId, input }
                        type ToolPart = UIMessagePart<UIDataTypes, UITools> & {
                          type: `tool-${string}`;
                          toolCallId?: string;
                          toolInvocationId?: string; // Alternative ID field
                          toolName?: string; // For tool-invocation format
                          state:
                          | "partial-call" // Still streaming args
                          | "call" // HITL initial state (no execute function)
                          | "input-streaming"
                          | "input-available"
                          | "output-available"
                          | "output-error";
                          input?: unknown;
                          args?: unknown; // Alternative to input
                          output?: unknown;
                          result?: unknown; // Alternative to output
                          errorText?: string;
                        };

                        const isTool = (
                          part: UIMessagePart<UIDataTypes, UITools>,
                        ): part is ToolPart => part.type.startsWith("tool-");

                        if (!isTool(part)) return null;

                        // Get the actual tool name - either from toolName property (tool-invocation format)
                        // or extracted from the type (tool-{name} format)
                        const toolName =
                          (part as ToolPart).toolName ||
                          part.type.replace("tool-", "");

                        // Note: Shipper Cloud tools are handled in their own "shipper-cloud" group type
                        // (see groupToolCalls function), so they won't appear here in tool-group

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
                              toolDescription = "Validated project structure";
                              break;
                            case "getSandboxUrl":
                              toolDescription = "Retrieved sandbox URL";
                              break;
                            case "finalizeWorkingFragment":
                              toolDescription = "Finalized changes";
                              break;
                            case "detectErrors":
                              const errorSummary = (part.output as any)
                                ?.summary;
                              if (errorSummary?.totalErrors > 0) {
                                toolDescription = `Found ${errorSummary.totalErrors
                                  } error${errorSummary.totalErrors !== 1 ? "s" : ""
                                  } (${errorSummary.severity} severity)`;
                              } else {
                                toolDescription = "Fix With AI";
                              }
                              break;
                            case "autoFixErrors":
                              const fixSummary = (part.output as any)?.summary;
                              if (fixSummary?.successfulFixes > 0) {
                                toolDescription = `Fixed ${fixSummary.successfulFixes}/${fixSummary.totalErrors} errors`;
                              } else {
                                toolDescription = "Auto-fix completed";
                              }
                              break;
                            case "generateImage": {
                              const output = part.output as any;
                              if (output?.images && output.images.length > 0) {
                                // Show all images with their prompts
                                const imageDescriptions = output.images
                                  .map((img: any) => {
                                    const displayPrompt =
                                      img.prompt.length > 50
                                        ? img.prompt.substring(0, 50) + "..."
                                        : img.prompt;
                                    return `Generated image | ${displayPrompt}`;
                                  })
                                  .join("\n");
                                toolDescription = imageDescriptions;
                              } else {
                                toolDescription = "Generated image";
                              }
                              break;
                            }
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
                                toolDescription = "Installing components...";
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
                            case "detectErrors":
                              toolDescription = "Scanning for errors...";
                              break;
                            case "autoFixErrors":
                              toolDescription = "Fixing errors with AI...";
                              break;
                            case "generateImage": {
                              if (part.state === "input-available") {
                                const input = part.input as any;
                                if (input?.images && input.images.length > 0) {
                                  const firstPrompt = input.images[0].prompt;
                                  const displayPrompt =
                                    firstPrompt.length > 50
                                      ? firstPrompt.substring(0, 50) + "..."
                                      : firstPrompt;
                                  toolDescription = `Generating image | ${displayPrompt}`;
                                } else {
                                  toolDescription = "Generating image...";
                                }
                              } else {
                                toolDescription = "Generating image...";
                              }
                              break;
                            }
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
                            (part.output as any)?.url) ||
                          (part.type === "tool-generateImage" &&
                            part.output &&
                            (part.output as any)?.images) ||
                          (part.type === "tool-detectErrors" &&
                            part.output &&
                            (part.output as any)?.success) ||
                          (part.type === "tool-autoFixErrors" &&
                            part.output &&
                            (part.output as any)?.success);

                        const isRunning =
                          part.state === "input-streaming" ||
                          part.state === "input-available";

                        return (
                          <TaskItem
                            key={`tool-${message.id}-${groupIndex}-${i}`}
                            className="flex flex-col gap-1 dark:text-[#B8C9C3]"
                            isRunning={isRunning}
                          >
                            {/* Only show the main tool description if there's no special output */}
                            {!hasSpecialOutput && (
                              <>
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex min-w-0 flex-1 items-center gap-3">
                                    <div className="flex-shrink-0">
                                      {(part.state === "input-streaming" ||
                                        part.state === "input-available") && (
                                          <TaskInProgressIcon />
                                        )}
                                      {part.state === "output-available" && (
                                        <TaskCompleteIcon />
                                      )}
                                      {part.state === "output-error" &&
                                        part.errorText && (
                                          <InfoTooltip
                                            variant="error"
                                            content={part.errorText}
                                            title="Error"
                                            side="top"
                                            align="start"
                                            maxWidth="500px"
                                            contentClassName="text-xs"
                                            trigger={
                                              <button
                                                type="button"
                                                className="cursor-help"
                                              >
                                                <TaskErrorIcon />
                                              </button>
                                            }
                                          />
                                        )}
                                      {part.state === "output-error" &&
                                        !part.errorText && <TaskErrorIcon />}
                                    </div>
                                    <span className="truncate text-xs font-medium text-[#1C1C1C] dark:text-[#F5F9F7]">
                                      {toolDescription}
                                    </span>
                                  </div>
                                  <span className="flex-shrink-0 text-xs font-medium text-[#008000] dark:text-[#16A34A]">
                                    {part.state === "output-available" &&
                                      "Complete"}
                                    {(part.state === "input-streaming" ||
                                      part.state === "input-available") && (
                                        <span className="text-[#78270D] dark:text-[#D4A574]">
                                          In Progress...
                                        </span>
                                      )}
                                  </span>
                                </div>
                              </>
                            )}

                            {part.type === "tool-generateImage" &&
                              part.output &&
                              (part.output as any)?.images && (
                                <div className="flex flex-col gap-6">
                                  {(part.output as any).images.map(
                                    (img: any, idx: number) => {
                                      const displayPrompt =
                                        img.prompt.length > 50
                                          ? img.prompt.substring(0, 50) + "..."
                                          : img.prompt;
                                      return (
                                        <div
                                          key={idx}
                                          className="flex items-center justify-between gap-3"
                                        >
                                          <div className="flex min-w-0 flex-1 items-center gap-3">
                                            <div className="flex-shrink-0">
                                              {img.success ? (
                                                <span className="text-[#1C1C1C] dark:text-[#F5F9F7]">
                                                  <GeneratedImageIcon
                                                    size={16}
                                                  />
                                                </span>
                                              ) : (
                                                <TaskErrorIcon />
                                              )}
                                            </div>
                                            <span className="truncate text-xs font-medium text-[#1C1C1C] dark:text-[#F5F9F7]">
                                              Generated image | {displayPrompt}
                                            </span>
                                          </div>
                                          <span className="flex-shrink-0 text-xs font-medium text-[#008000] dark:text-[#16A34A]">
                                            {img.success ? (
                                              "Complete"
                                            ) : (
                                              <span className="text-red-600 dark:text-red-400">
                                                Failed
                                              </span>
                                            )}
                                          </span>
                                        </div>
                                      );
                                    },
                                  )}
                                </div>
                              )}

                            {/* Show special output for createOrEditFiles */}
                            {part.type === "tool-createOrEditFiles" &&
                              part.output &&
                              (part.output as any)?.success && (
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex min-w-0 flex-1 items-center gap-3">
                                      <div className="flex-shrink-0">
                                        {(part.state === "input-streaming" ||
                                          part.state === "input-available") && (
                                            <TaskInProgressIcon />
                                          )}
                                        {part.state === "output-available" && (
                                          <TaskCompleteIcon />
                                        )}
                                        {part.state === "output-error" &&
                                          part.errorText && (
                                            <InfoTooltip
                                              variant="error"
                                              content={part.errorText}
                                              title="Error"
                                              side="top"
                                              align="start"
                                              maxWidth="500px"
                                              contentClassName="text-xs"
                                              trigger={
                                                <button
                                                  type="button"
                                                  className="cursor-help"
                                                >
                                                  <TaskErrorIcon />
                                                </button>
                                              }
                                            />
                                          )}
                                        {part.state === "output-error" &&
                                          !part.errorText && <TaskErrorIcon />}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1">
                                          <p className="truncate text-xs font-medium text-[#1C1C1C] dark:text-[#F5F9F7]">
                                            {(part.output as any).action ===
                                              "created"
                                              ? "Created"
                                              : "Updated"}
                                            : {(part.output as any).path}
                                          </p>
                                          {(() => {
                                            const filePath = (
                                              part.output as any
                                            ).path;
                                            const {
                                              component: IconComponent,
                                              color,
                                            } = getFileIcon(filePath);
                                            return (
                                              <IconComponent
                                                className="h-3 w-3 flex-shrink-0"
                                                style={{ color }}
                                              />
                                            );
                                          })()}
                                        </div>
                                        {(part.output as any).description && (
                                          <p className="mt-0.5 text-xs font-normal text-[#7D7D7D] dark:text-[#B8C9C3]">
                                            {(part.output as any).description}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    <span className="flex-shrink-0 text-xs font-medium text-[#008000] dark:text-[#16A34A]">
                                      {part.state === "output-available" &&
                                        "Complete"}
                                      {(part.state === "input-streaming" ||
                                        part.state === "input-available") && (
                                          <span className="text-[#78270D] dark:text-[#D4A574]">
                                            Editing...
                                          </span>
                                        )}
                                    </span>
                                  </div>
                                </div>
                              )}

                            {/* Show special output for detectErrors */}
                            {part.type === "tool-detectErrors" &&
                              part.output &&
                              (part.output as any)?.success && (
                                <div className="space-y-2">
                                  {/* Error Summary */}
                                  <div className="flex w-full items-center gap-2">
                                    <div className="flex-shrink-0">
                                      {(() => {
                                        const summary = (part.output as any)
                                          .summary;
                                        const totalErrors =
                                          summary?.totalErrors || 0;
                                        if (totalErrors === 0) {
                                          return <TaskCompleteIcon />;
                                        } else {
                                          return (
                                            <AlertTriangle className="h-3 w-3 text-orange-500" />
                                          );
                                        }
                                      })()}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-xs font-medium text-[#000000] dark:text-[#B8C9C3]">
                                        {(() => {
                                          const summary = (part.output as any)
                                            .summary;
                                          const totalErrors =
                                            summary?.totalErrors || 0;
                                          if (totalErrors === 0) {
                                            return "No errors detected";
                                          } else {
                                            return `🔍 Found ${totalErrors} error${totalErrors !== 1 ? "s" : ""
                                              } - ${summary.severity} severity`;
                                          }
                                        })()}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Error Details */}
                                  {(() => {
                                    const errors = (part.output as any).errors;
                                    const summary = (part.output as any)
                                      .summary;
                                    if (!errors || summary?.totalErrors === 0)
                                      return null;

                                    return (
                                      <div className="space-y-1 pl-5">
                                        {summary.buildErrors > 0 && (
                                          <div className="text-xs text-red-600 dark:text-red-400">
                                            🔴 {summary.buildErrors} build error
                                            {summary.buildErrors !== 1
                                              ? "s"
                                              : ""}
                                          </div>
                                        )}
                                        {summary.importErrors > 0 && (
                                          <div className="text-xs text-orange-600 dark:text-orange-400">
                                            🟠 {summary.importErrors} import
                                            error
                                            {summary.importErrors !== 1
                                              ? "s"
                                              : ""}
                                          </div>
                                        )}
                                        {summary.navigationErrors > 0 && (
                                          <div className="text-xs text-yellow-600 dark:text-yellow-400">
                                            🟡 {summary.navigationErrors}{" "}
                                            navigation error
                                            {summary.navigationErrors !== 1
                                              ? "s"
                                              : ""}
                                          </div>
                                        )}
                                        {summary.runtimeErrors > 0 && (
                                          <div className="text-xs text-blue-600 dark:text-blue-400">
                                            🔵 {summary.runtimeErrors} runtime
                                            error
                                            {summary.runtimeErrors !== 1
                                              ? "s"
                                              : ""}
                                          </div>
                                        )}
                                        {summary.autoFixable && (
                                          <div className="mt-1 text-xs text-green-600 dark:text-green-400">
                                            ⚡ Auto-fixable with AI{" "}
                                            <span className="text-gray-500 dark:text-gray-400">
                                              (We will not charge you for these
                                              fixes)
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
                              )}

                            {/* Show special output for autoFixErrors */}
                            {part.type === "tool-autoFixErrors" &&
                              part.output &&
                              (part.output as any)?.success && (
                                <div className="space-y-2">
                                  {/* Fix Summary */}
                                  <div className="flex w-full items-center gap-2">
                                    <div className="flex-shrink-0">
                                      {(() => {
                                        const summary = (part.output as any)
                                          .summary;
                                        const successfulFixes =
                                          summary?.successfulFixes || 0;
                                        if (successfulFixes > 0) {
                                          return (
                                            <CheckCircle className="h-3 w-3 text-green-500" />
                                          );
                                        } else {
                                          return (
                                            <AlertTriangle className="h-3 w-3 text-orange-500" />
                                          );
                                        }
                                      })()}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-xs font-medium text-[#000000] dark:text-[#B8C9C3]">
                                        {(part.output as any).message}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Fix Details */}
                                  {(() => {
                                    const summary = (part.output as any)
                                      .summary;
                                    const successfulFixes =
                                      summary?.successfulFixes || 0;
                                    const failedFixes =
                                      summary?.failedFixes || 0;

                                    if (
                                      successfulFixes === 0 &&
                                      failedFixes === 0
                                    )
                                      return null;

                                    return (
                                      <div className="space-y-1 pl-5">
                                        {successfulFixes > 0 && (
                                          <div className="text-xs text-green-600 dark:text-green-400">
                                            ✅ {successfulFixes} error
                                            {successfulFixes !== 1
                                              ? "s"
                                              : ""}{" "}
                                            fixed successfully
                                          </div>
                                        )}
                                        {failedFixes > 0 && (
                                          <div className="text-xs text-red-600 dark:text-red-400">
                                            ❌ {failedFixes} error
                                            {failedFixes !== 1 ? "s" : ""} could
                                            not be fixed automatically
                                          </div>
                                        )}
                                        {summary?.successRate && (
                                          <div className="text-xs text-blue-600 dark:text-blue-400">
                                            📊{" "}
                                            {(
                                              summary.successRate * 100
                                            ).toFixed(1)}
                                            % success rate
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
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
                <Task
                  defaultOpen={true}
                  className="rounded-lg border bg-white dark:bg-[#1A2421]"
                >
                  <TaskTrigger title="Live Preview" />
                  <TaskContent className="mt-0 space-y-2 bg-white px-3 py-[10px] dark:bg-[#1A2421]">
                    <div>
                      <p className="text-sm text-[#8F8F8F] dark:text-[#8F8F8F]">
                        Preview URL
                      </p>
                      <a
                        href={sandboxPart.output.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center justify-between gap-2 rounded-lg transition-colors duration-200"
                      >
                        <span className="text-prj-text-primary truncate text-sm">
                          {sandboxPart.output.url.replace(/^https?:\/\//, "")}
                        </span>
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#1E9A80]">
                          <PreviewViewIcon className="text-white" />
                        </div>
                      </a>
                    </div>
                  </TaskContent>
                </Task>
              );
            })()}
          </div>
        </div>
      </Fragment>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison function for memo
    // Return true if props are equal (don't re-render)
    // Note: onAddToolResult and onSendMessage are callback refs and should not trigger re-renders
    return (
      prevProps.message === nextProps.message &&
      prevProps.messageIndex === nextProps.messageIndex &&
      prevProps.lastUserMessageIndex === nextProps.lastUserMessageIndex &&
      prevProps.shouldShowAssistantHeader ===
      nextProps.shouldShowAssistantHeader &&
      prevProps.messages.length === nextProps.messages.length
    );
  },
);
