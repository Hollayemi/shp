"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAtom } from "jotai";
import { Button } from "@/components/ui/button";
import {
  Zap,
  Eye,
  Code,
  Palette,
  Users,
  Target,
  Sparkles,
  ArrowDownIcon,
  FileText,
  Search,
  ArrowUp,
  CircleCheckBig,
  CircleX,
  ChevronDown,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { ADVISOR_HATS, type AdvisorHatType } from "@/lib/advisor-hats";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useChat, type UIMessage } from "@ai-sdk/react";
import { DefaultChatTransport, UIMessagePart, UIDataTypes, UITools } from "ai";
import { useTRPC } from "@/trpc/client";
import { useQueryClient } from "@tanstack/react-query";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import { Response } from "./ai-elements/response";
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from "@/components/ai-elements/reasoning";
import { Task, TaskContent, TaskItem } from "@/components/ai-elements/task";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { CaretUpMiniIcon } from "@/components/icons/CaretUpMiniIcon";
import { ShimmeringText } from "@/components/ui/shadcn-io/shimmering-text";
import { CloseExpandIcon } from "@/components/icons/CloseExpandIcon";
import { AdvisorLogo } from "@/components/AdvisorLogo";
import { cn } from "@/lib/utils";
import { SparklesIcon } from "./icons/SparklesIcon";
import { SuggestionButton } from "@/components/ui/suggestion-button";
import ThinkingBubble from "@/modules/projects/ui/components/ThinkingBubble";
import { createAdvisorChatCacheAtom } from "@/lib/hal-assistant-state";

interface Suggestion {
  id: string;
  title: string;
  description: string;
  icon: any;
  color: string;
  prompt: string;
  targetChat?: "builder" | "advisor";
  category?: string;
  dbId?: string;
}

interface HalMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  suggestions?: Suggestion[];
  messageType: "chat" | "suggestion";
}

type Message = UIMessage;

const getMessageContent = (message: UIMessage | HalMessage): string => {
  if ("parts" in message) {
    return message.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("");
  }
  return message.content;
};

interface HalSuggestionsChatProps {
  projectId: string;
  projectFiles?: { [path: string]: string } | null;
  isSandboxReady?: boolean;
  onSuggestionClick?: (prompt: string) => void;
  onClose?: () => void;
  className?: string;
  triggerSuggestions?: boolean;
  onSuggestionsTriggered?: () => void;
  onSuggestionsGenerated?: () => void;
  shouldGenerateSuggestions?: boolean;
  isMiniMenu?: boolean;
  hatType?: AdvisorHatType; // NEW: For mini popup (pinned hats)
  showTabs?: boolean; // NEW: Show tab bar (false for mini popup)
  isActive?: boolean; // NEW: Whether this tab is currently visible
  isNewProject?: boolean; // Whether this is a brand new project (no main chat messages)
}

const iconMap = {
  eye: Eye,
  zap: Zap,
  code: Code,
  palette: Palette,
  users: Users,
  target: Target,
  sparkles: Sparkles,
  "file-text": FileText,
  search: Search,
};

// Note: Suggestions are now generated via the generateSuggestions tool in the chat
// The tool returns the same structure but it's handled automatically by the AI SDK

const getMessageDate = (message: UIMessage | HalMessage): Date => {
  if ("createdAt" in message && message.createdAt instanceof Date) {
    return message.createdAt;
  }
  if ("createdAt" in message && typeof message.createdAt === "string") {
    return new Date(message.createdAt);
  }
  if ("timestamp" in message && message.timestamp instanceof Date) {
    return message.timestamp;
  }
  if ("timestamp" in message && typeof message.timestamp === "string") {
    return new Date(message.timestamp);
  }
  // Fallback - use current time for messages without timestamps
  return new Date();
};

const ScrollToBottomButton = () => {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  const handleScrollToBottom = useCallback(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  if (isAtBottom) return null;

  return (
    <Button
      className="absolute bottom-4 left-[50%] z-10 translate-x-[-50%] rounded-full"
      onClick={handleScrollToBottom}
      size="icon"
      type="button"
      variant="outline"
    >
      <ArrowDownIcon className="size-4" />
    </Button>
  );
};

// Helper function to accumulate suggestions from the last N assistant messages (excluding current)
const accumulateSuggestionsFromMessages = (
  messages: (UIMessage | HalMessage)[],
  currentMessageIndex: number,
  maxPreviousResponses: number = 12,
): any[] => {
  const messagesWithSuggestions: any[][] = [];
  let assistantResponseCount = 0;

  // Traverse backwards from the message before current to collect suggestions
  // Stop after collecting from maxPreviousResponses assistant messages
  for (let i = currentMessageIndex - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;

    // Check if it's a UIMessage with parts
    if ("parts" in msg && Array.isArray(msg.parts)) {
      const uiMsg = msg as UIMessage;
      const messageSuggestions: any[] = [];

      uiMsg.parts.forEach((part) => {
        if (part.type === "tool-generateSuggestions") {
          const suggestionPart = part as any;
          if (
            suggestionPart.output &&
            suggestionPart.output.suggestions &&
            Array.isArray(suggestionPart.output.suggestions)
          ) {
            messageSuggestions.push(...suggestionPart.output.suggestions);
          }
        }
      });

      if (messageSuggestions.length > 0) {
        // Store suggestions in order (we're traversing backwards)
        messagesWithSuggestions.unshift(messageSuggestions);
        assistantResponseCount++;

        if (assistantResponseCount >= maxPreviousResponses) {
          break;
        }
      }
    }
  }

  // Flatten in chronological order (oldest first)
  return messagesWithSuggestions.flat();
};

// Helper function to group related tool calls with better organization
const groupToolCalls = (parts: UIMessagePart<UIDataTypes, UITools>[]) => {
  const groups: Array<{
    type: "text" | "reasoning" | "tool-group";
    content: UIMessagePart<UIDataTypes, UITools>[];
    title?: string;
    isComplete?: boolean;
    showBadge?: boolean;
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
        const titleInfo = generateToolGroupTitle(currentToolGroup);
        groups.push({
          type: "tool-group",
          content: [...currentToolGroup],
          title: titleInfo.title,
          isComplete: pendingToolCalls === 0,
          showBadge: titleInfo.showBadge,
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
          const titleInfo = generateToolGroupTitle(currentToolGroup);
          groups.push({
            type: "tool-group",
            content: [...currentToolGroup],
            title: titleInfo.title,
            isComplete: pendingToolCalls === 0,
            showBadge: titleInfo.showBadge,
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
        const hasUpcomingTools = toolIndices.some((toolIndex) => toolIndex > i);
        const hasCurrentTools = currentToolGroup.some((p) =>
          p.type.startsWith("tool-"),
        );

        if (hasUpcomingTools || hasCurrentTools) {
          currentToolGroup.push(part);
        } else {
          groups.push({
            type: "reasoning",
            content: [part],
          });
        }
      }
    } else if (part.type.startsWith("tool-")) {
      // Handle generateSuggestions as its own group to preserve order
      if (part.type === "tool-generateSuggestions") {
        // Close any pending tool group before the suggestion tool
        if (currentToolGroup.length > 0) {
          const titleInfo = generateToolGroupTitle(currentToolGroup);
          groups.push({
            type: "tool-group",
            content: [...currentToolGroup],
            title: titleInfo.title,
            isComplete: pendingToolCalls === 0,
            showBadge: titleInfo.showBadge,
          });
          currentToolGroup = [];
          pendingToolCalls = 0;
        }
        // Add generateSuggestions as its own special group
        groups.push({
          type: "suggestions" as any,
          content: [part],
        });
        continue;
      }

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
        });
        currentToolGroup = [];
        pendingToolCalls = 0;
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
    });
  }

  return groups;
};

// Generate a descriptive title for a group of tool calls
const generateToolGroupTitle = (
  toolParts: UIMessagePart<UIDataTypes, UITools>[],
): { title: string; showBadge: boolean } => {
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
    let title: string;
    switch (toolName) {
      case "webSearch":
      case "web-search":
        title = "Running a Web Search";
        break;
      case "search":
        title = "Searching";
        break;
      case "readFile":
        title = "Reading file";
        break;
      case "analyze":
        title = "Analyzing";
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

export function HalSuggestionsChat({
  projectId,
  projectFiles,
  isSandboxReady = false,
  onSuggestionClick,
  onClose,
  onSuggestionsTriggered,
  onSuggestionsGenerated,
  className = "",
  triggerSuggestions = false,
  shouldGenerateSuggestions = false,
  isMiniMenu = false,
  hatType = "code", // NEW: Default hat for mini popup
  showTabs = true, // NEW: Show tabs by default (false for mini popup)
  isActive = true, // NEW: Default to active for backwards compatibility
  isNewProject = false, // Default to false (existing project) for backwards compatibility
}: HalSuggestionsChatProps) {
  const [isPinnedMenuOpen, setIsPinnedMenuOpen] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [chatInput, setChatInput] = useState("");

  // Share already-loaded messages between mini popup and full panel to avoid refetching
  const chatCacheAtom = useMemo(
    () => createAdvisorChatCacheAtom(projectId, hatType),
    [projectId, hatType],
  );
  const [chatCacheState, setChatCacheState] = useAtom(chatCacheAtom);

  // Track if we've already auto-generated suggestions for this tab to prevent repeats
  const hasAutoGeneratedRef = useRef(false);
  const preDeliverableWarningShownRef = useRef(false);

  // Get tRPC and queryClient for invalidating credits after messages
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Store hatType in a ref so customTransport can always access the latest value
  const hatTypeRef = useRef(hatType);
  useEffect(() => {
    hatTypeRef.current = hatType;
  }, [hatType]);

  // Create a custom transport that can access current state
  const customTransport = useMemo(() => {
    return new DefaultChatTransport({
      api: "/api/hal-chat",
      prepareSendMessagesRequest: ({ messages }) => {
        const lastMessage = messages[messages.length - 1];

        console.log("hatType from ref", hatTypeRef.current);

        // Detect if this is a suggestion request (FREE - 0 credits)
        // Must match the exact text from handleGenerateSuggestions
        const textPart = lastMessage.parts?.find(
          (p): p is Extract<typeof p, { type: "text" }> => p.type === "text",
        );
        const messageText = textPart?.text || "";
        const isSuggestionRequest =
          messageText ===
          "Please generate some suggestions for what I should work on next.";

        return {
          body: {
            message: lastMessage,
            projectId,
            hatType: hatTypeRef.current,
            isSuggestionRequest, // FREE if true, 0.25 credits if false
          },
        };
      },
    });
  }, [projectId]); // Only recreate when projectId changes

  // Main chat hook - handles all messages including suggestions via tools
  const {
    messages: chatMessages,
    setMessages: setChatMessages,
    sendMessage,
    status,
  } = useChat({
    transport: customTransport,
    onFinish: async (message) => {
      console.log("[HAL Chat V2] Chat message finished:", message);
      // Message is already in the chat with full parts from streaming
      setIsProcessing(false);

      // Invalidate credits query to update balance instantly
      queryClient.invalidateQueries({
        queryKey: trpc.credits.getMyCredits.queryKey(),
      });
    },
    onError: (error) => {
      console.error("[HAL Chat V2] Chat error:", error);
      toast.error("Failed to send message. Please try again.");
      setIsProcessing(false);
    },
  });

  // Track loading state manually since we don't have direct access
  // We'll consider it loading if we just sent a message
  const [isProcessing, setIsProcessing] = useState(false);
  const isLoading = isProcessing;

  // Thinking bubble state
  const [showThinkingMessage, setShowThinkingMessage] = useState(false);
  const thinkingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load all messages from database and sort by timestamp
  const loadAllMessages = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch(
        `/api/hal-chat/messages?projectId=${projectId}&hatType=${hatType}`,
      );
      if (response.ok) {
        const data = await response.json();
        console.log("[HAL Chat V2] Raw API response:", data);
        console.log(
          "[HAL Chat V2] Timeline items:",
          data.timeline?.map((item: any) => ({
            id: item.id,
            type: item.type,
            role: item.role,
            hasParts: !!item.parts,
            parts: item.parts,
          })),
        );

        const allHalMessages: HalMessage[] = [];

        // Check if messages exist in the database
        const hasMessagesInDB = data.timeline && data.timeline.length > 0;

        if (hasMessagesInDB) {
          const sortedTimeline = data.timeline.sort(
            (a: any, b: any) =>
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
          );

          for (let i = 0; i < sortedTimeline.length; i++) {
            const currentItem = sortedTimeline[i];
            const nextItem =
              i + 1 < sortedTimeline.length ? sortedTimeline[i + 1] : null;

            const mapSuggestions = (suggestions: any[] | undefined) => {
              if (!suggestions) return [];
              return suggestions.map((suggestion: any) => ({
                id: suggestion.id,
                title: suggestion.title,
                description: suggestion.description,
                icon: iconMap[suggestion.icon as keyof typeof iconMap] || (
                  <AdvisorLogo />
                ),
                color: suggestion.color,
                prompt: suggestion.prompt,
                targetChat: suggestion.targetChat || "builder",
                category: suggestion.category || "general",
                dbId: suggestion.dbId,
              }));
            };

            // Check for a greeting message followed by a suggestions block
            if (
              currentItem.type === "message" &&
              currentItem.role === "assistant" &&
              nextItem &&
              nextItem.type === "suggestions"
            ) {
              // Merge them into a single suggestion message
              allHalMessages.push({
                id: nextItem.id, // Use ID from suggestions for key
                role: "assistant",
                content: currentItem.content, // Use content from greeting message
                timestamp: new Date(
                  nextItem.timestamp || nextItem.createdAt || Date.now(),
                ),
                messageType: "suggestion",
                suggestions: mapSuggestions(nextItem.suggestions),
              });
              i++; // Skip the next item as it's been merged
            } else if (currentItem.type === "message") {
              // Regular chat message
              allHalMessages.push({
                id: currentItem.id,
                role: currentItem.role,
                content: currentItem.content,
                timestamp: new Date(
                  currentItem.timestamp || currentItem.createdAt || Date.now(),
                ),
                messageType: "chat",
              });
            } else if (currentItem.type === "suggestions") {
              // Standalone suggestions block (without a preceding greeting message)
              allHalMessages.push({
                id: currentItem.id,
                role: "assistant",
                content: "Here are some suggestions to improve your project:",
                timestamp: new Date(
                  currentItem.timestamp || currentItem.createdAt || Date.now(),
                ),
                messageType: "suggestion",
                suggestions: mapSuggestions(currentItem.suggestions),
              });
            }
          }
        }

        // Convert all messages to UIMessage format with proper timestamps
        // Note: Suggestions are now part of the regular chat flow via tools
        const chatMessagesForHook: UIMessage[] = allHalMessages.map((m) => {
          // If the message has parts from the database, use them
          const timelineItem = data.timeline.find(
            (item: any) => item.id === m.id && item.type === "message",
          );

          let messageParts = timelineItem?.parts;

          // Handle case where parts might be a single object instead of an array
          if (
            messageParts &&
            !Array.isArray(messageParts) &&
            typeof messageParts === "object"
          ) {
            console.log(
              "[HAL Chat V2] Converting single part object to array:",
              messageParts,
            );
            messageParts = [messageParts];
          }

          console.log("[HAL Chat V2] Message parts reconstruction:", {
            messageId: m.id,
            role: m.role,
            hasParts: !!messageParts,
            partsIsArray: Array.isArray(messageParts),
            partsLength: messageParts?.length,
            firstPartType: messageParts?.[0]?.type,
            fallbackContent: m.content.substring(0, 50),
          });

          // Ensure parts is a valid array with content
          let finalParts;
          if (
            messageParts &&
            Array.isArray(messageParts) &&
            messageParts.length > 0
          ) {
            finalParts = messageParts;
          } else if (m.content && m.content.trim()) {
            finalParts = [{ type: "text" as const, text: m.content }];
          } else {
            console.warn(
              "[HAL Chat V2] Message has no content or parts:",
              m.id,
            );
            finalParts = [{ type: "text" as const, text: "" }];
          }

          // Only preserve old format for messages that truly are in old format
          // (have messageType but no proper tool parts)
          const isOldFormat =
            m.messageType === "suggestion" &&
            (!messageParts ||
              !messageParts.some(
                (p: any) => p.type === "tool-generateSuggestions",
              ));

          return {
            id: m.id,
            role: m.role,
            parts: finalParts,
            createdAt: m.timestamp,
            // Preserve content, messageType and suggestions ONLY for genuinely old messages
            ...(isOldFormat && { content: m.content }),
            ...(isOldFormat && m.messageType && { messageType: m.messageType }),
            ...(isOldFormat && m.suggestions && { suggestions: m.suggestions }),
          } as any;
        });

        // Merge database messages with existing chat messages to avoid losing streamed messages
        // that may not be in the database yet
        setChatMessages((currentMessages) => {
          const existingIds = new Set(currentMessages.map((m) => m.id));

          // Check for pre-deliverable warning text to prevent duplicates by content
          const warningText =
            "Until your project is ready, I'll be able to help with research, info and suggestion based on what I can see as your initial prompt. As soon as it's delivered, I can see it, just like you, and can help you with more!";
          const hasWarningInExisting = currentMessages.some(
            (msg) =>
              msg.role === "assistant" &&
              getMessageContent(msg) === warningText,
          );

          // Filter new messages: exclude by ID and also by content (for warning message)
          const newMessages = chatMessagesForHook.filter((m) => {
            // Exclude if ID already exists
            if (existingIds.has(m.id)) {
              return false;
            }

            // Exclude if this is the warning message and it already exists in current messages
            if (
              m.role === "assistant" &&
              getMessageContent(m) === warningText &&
              hasWarningInExisting
            ) {
              console.log(
                "[HAL Chat V2] Skipping duplicate warning message (content match)",
              );
              return false;
            }

            // Exclude warning message for existing projects (even if it exists in DB from previous sessions)
            if (
              !isNewProject &&
              m.role === "assistant" &&
              getMessageContent(m) === warningText
            ) {
              console.log(
                "[HAL Chat V2] Skipping warning message for existing project",
              );
              return false;
            }

            return true;
          });

          // Combine and sort by timestamp
          const combined = [...currentMessages, ...newMessages].sort(
            (a, b) => getMessageDate(a).getTime() - getMessageDate(b).getTime(),
          );

          setChatCacheState({
            messages: combined,
            hasInitialized: true,
            lastLoadedAt: Date.now(),
          });

          console.log("[HAL Chat V2] Merging messages:", {
            existing: currentMessages.length,
            fromDB: chatMessagesForHook.length,
            new: newMessages.length,
            total: combined.length,
          });

          // Check if pre-deliverable warning exists in loaded messages and set ref immediately
          // This prevents the warning effect from adding duplicates
          // Note: warningText is already defined above
          const hasWarningInLoadedMessages = combined.some(
            (msg) =>
              msg.role === "assistant" &&
              getMessageContent(msg) === warningText,
          );
          if (hasWarningInLoadedMessages) {
            preDeliverableWarningShownRef.current = true;
            console.log(
              "[HAL Chat V2] Pre-deliverable warning found in loaded messages, setting ref to true",
            );
          }

          return combined;
        });

        console.log(
          "[HAL Chat V2] Loaded messages:",
          allHalMessages.length,
          allHalMessages.map((msg) => ({
            id: msg.id,
            role: msg.role,
            messageType: msg.messageType,
            timestamp: msg.timestamp,
            timestampType: typeof msg.timestamp,
            timestampValue: msg.timestamp?.toString(),
            content: msg.content.substring(0, 50),
          })),
        );

        // Return true if messages were found, false if empty
        return hasMessagesInDB;
      }
      // If response not ok, assume no messages
      return false;
    } catch (error) {
      console.error("[HAL Chat V2] Failed to load messages:", error);
      // On error, assume no messages
      return false;
    }
  }, [
    projectId,
    hatType,
    setChatMessages,
    setHasInitialized,
    setIsLoadingMessages,
    setChatCacheState,
  ]);

  // All messages are now in chatMessages (including suggestions via tools)
  // Filter out internal trigger messages that are only used to force suggestion generation
  // Also filter out pre-deliverable warning for existing projects or when sandbox is ready
  const allMessagesToRender = useMemo(() => {
    const INTERNAL_TRIGGER =
      "Please generate some suggestions for what I should work on next.";
    const WARNING_TEXT =
      "Until your project is ready, I'll be able to help with research, info and suggestion based on what I can see as your initial prompt. As soon as it's delivered, I can see it, just like you, and can help you with more!";

    const filtered = chatMessages.filter((msg, index) => {
      // Hide messages with internal-trigger ID prefix immediately
      if (msg.id?.startsWith("internal-trigger-")) {
        return false;
      }

      // Hide pre-deliverable warning for existing projects (always) or when sandbox is ready
      // This prevents showing warning messages that may have been saved to DB in previous sessions
      const msgContent = getMessageContent(msg);
      if (msg.role === "assistant" && msgContent === WARNING_TEXT) {
        if (!isNewProject || isSandboxReady) {
          return false;
        }
      }

      // Check if this is the internal trigger message by content
      const content = getMessageContent(msg);
      if (content !== INTERNAL_TRIGGER) return true;

      // If it matches the trigger text, check if next message has generateSuggestions tool
      // This distinguishes button-triggered messages from user-typed ones
      const nextMsg = chatMessages[index + 1];
      if (!nextMsg || nextMsg.role !== "assistant") return true;

      // Check if next message has generateSuggestions tool call
      const hasGenerateSuggestionsTool = (nextMsg as UIMessage).parts?.some(
        (part: any) => part.type === "tool-generateSuggestions",
      );

      // Hide if followed by suggestion tool (button-triggered), show if not (user-typed)
      return !hasGenerateSuggestionsTool;
    });

    return filtered;
  }, [chatMessages, isLoadingMessages, isSandboxReady, isNewProject]);

  // Determine if we are awaiting an assistant response
  const awaitingAssistantResponse = useMemo(() => {
    if (!(status === "submitted" || status === "streaming")) {
      return false;
    }
    const last = chatMessages[chatMessages.length - 1];
    if (!last) return true;
    if (last.role !== "assistant") return true;
    const parts = (last as UIMessage).parts || [];
    // Keep bubble until at least one assistant part arrives to render
    return parts.length === 0;
  }, [chatMessages, status]);

  // Show thinking bubble with a slight delay while awaiting response
  useEffect(() => {
    if (awaitingAssistantResponse) {
      if (!thinkingTimeoutRef.current && !showThinkingMessage) {
        thinkingTimeoutRef.current = setTimeout(() => {
          setShowThinkingMessage(true);
          thinkingTimeoutRef.current = null;
        }, 600);
      }
    } else {
      if (thinkingTimeoutRef.current) {
        clearTimeout(thinkingTimeoutRef.current);
        thinkingTimeoutRef.current = null;
      }
      if (showThinkingMessage) {
        setShowThinkingMessage(false);
      }
    }
  }, [awaitingAssistantResponse, showThinkingMessage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (thinkingTimeoutRef.current) {
        clearTimeout(thinkingTimeoutRef.current);
      }
    };
  }, []);

  const handleGenerateSuggestions = useCallback(async () => {
    if (isLoading) return;

    console.log(
      "[HAL Chat V2] Requesting suggestion generation via chat for hatType:",
      hatType,
    );

    // Set loading state
    setIsProcessing(true);

    // Send a message asking for suggestions - the AI will call the generateSuggestions tool
    // This message will be filtered out by allMessagesToRender, but there's a brief flash
    // before the filter runs. The message is marked with a special ID to hide it immediately.
    sendMessage({
      id: `internal-trigger-${Date.now()}`, // Special ID to identify internal triggers
      parts: [
        {
          type: "text",
          text: "Please generate some suggestions for what I should work on next.",
        },
      ],
    });
  }, [isLoading, sendMessage, hatType]);

  // Load messages only when this tab becomes active for the first time.
  // If we already have a cached transcript (e.g., from the mini popup), hydrate
  // from cache instead of refetching.
  useEffect(() => {
    if (!isActive || isLoadingMessages || hasInitialized) return;

    if (chatCacheState.hasInitialized || chatCacheState.messages.length > 0) {
      console.log(
        "[HAL Chat V2] Hydrating advisor chat from cache for hatType:",
        hatType,
      );
      setIsLoadingMessages(true);
      loadAllMessages().then(() => {
        setHasInitialized(true);
        setIsLoadingMessages(false);
      });
    }

    console.log(
      "[HAL Chat V2] Tab became active for first time, loading messages for hatType:",
      hatType,
    );
    setIsLoadingMessages(true);
    loadAllMessages().then(() => {
      setHasInitialized(true);
      setIsLoadingMessages(false);
    });
  }, [
    isActive,
    hasInitialized,
    isLoadingMessages,
    hatType,
    chatCacheState.hasInitialized,
    chatCacheState.messages,
    setChatMessages,
    loadAllMessages,
  ]);

  // Note: Pre-deliverable warning check is now done in loadAllMessages
  // to set the ref immediately when messages are loaded, preventing duplicates

  // Show pre-deliverable warning message when sandbox is not ready and chat is empty
  // Show immediately when tab becomes active (don't wait for initialization)
  // But only if it doesn't already exist in the database
  useEffect(() => {
    // Reset flag when sandbox becomes ready
    if (isSandboxReady) {
      preDeliverableWarningShownRef.current = false;
      return;
    }

    // Check if warning message already exists in chat (either loaded from DB or just added)
    const warningText =
      "Until your project is ready, I'll be able to help with research, info and suggestion based on what I can see as your initial prompt. As soon as it's delivered, I can see it, just like you, and can help you with more!";
    const hasWarningMessage = chatMessages.some(
      (msg) =>
        msg.role === "assistant" && getMessageContent(msg) === warningText,
    );

    // If this is an existing project, don't show the warning even if it doesn't exist
    // (either it was never created or was deleted - in either case, don't recreate for existing projects)
    if (!isNewProject && hasInitialized && !hasWarningMessage) {
      preDeliverableWarningShownRef.current = true;
      return;
    }

    // Show warning only for new projects after initialization completes
    // Use isNewProject prop from parent (based on main chat messages) for reliable detection
    // Only show if it's a new project and sandbox is not ready
    if (
      isActive &&
      !isSandboxReady &&
      chatMessages.length === 0 &&
      !preDeliverableWarningShownRef.current &&
      !hasWarningMessage &&
      isNewProject && // Only show for new projects (reliable prop from parent)
      hasInitialized && // Wait for initialization to complete
      !isLoadingMessages // Wait for messages to load first to check if warning exists in DB
    ) {
      const warningMessage = {
        id: `pre-deliverable-warning-${Date.now()}`,
        role: "assistant" as const,
        parts: [
          {
            type: "text" as const,
            text: warningText,
          },
        ],
      } as UIMessage;

      // Insert into UI immediately
      setChatMessages((prev) => [...prev, warningMessage]);
      preDeliverableWarningShownRef.current = true;

      // Save to database so it persists
      fetch("/api/hal-chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          role: "assistant",
          content: warningText,
          parts: warningMessage.parts,
          hatType,
        }),
      }).catch((error) => {
        console.error(
          "[HAL Chat V2] Failed to save pre-deliverable warning message:",
          error,
        );
      });
    }
  }, [
    isActive,
    hasInitialized,
    isNewProject, // Use isNewProject prop instead of isFirstTime
    isSandboxReady,
    chatMessages,
    projectId,
    hatType,
    setChatMessages,
    isLoadingMessages,
  ]);

  // Auto-generate suggestions for empty tabs after they're initialized (only once)
  // BUT: Don't auto-generate for generalist tab - it's always triggered externally on first deliverable
  useEffect(() => {
    if (
      isActive &&
      hasInitialized &&
      !isLoading &&
      chatMessages.length === 0 &&
      !hasAutoGeneratedRef.current &&
      hatType !== "generalist" // Skip generalist - it gets triggered externally
    ) {
      console.log(
        "[HAL Chat V2] Empty tab detected after initialization, auto-generating suggestions for:",
        hatType,
      );
      hasAutoGeneratedRef.current = true;
      handleGenerateSuggestions();
    }
  }, [
    isActive,
    hasInitialized,
    chatMessages.length,
    hatType,
    isLoading,
    handleGenerateSuggestions,
  ]);

  // Keep the shared cache in sync so other instances (mini/full) can reuse it.
  useEffect(() => {
    setChatCacheState((prev) => {
      const messagesChanged = prev.messages !== chatMessages;
      const initChanged = hasInitialized && !prev.hasInitialized;

      if (!messagesChanged && !initChanged) return prev;

      return {
        messages: chatMessages,
        hasInitialized: prev.hasInitialized || hasInitialized,
        lastLoadedAt: prev.lastLoadedAt ?? Date.now(),
      };
    });
  }, [chatMessages, hasInitialized, setChatCacheState]);

  // Track if we've already triggered suggestions for this delivery
  const hasTriggeredRef = useRef(false);

  // Generate suggestions when triggered - only if tab is active and initialized
  useEffect(() => {
    // Reset the trigger flag when triggerSuggestions becomes false
    if (!triggerSuggestions) {
      hasTriggeredRef.current = false;
      return;
    }

    // Prevent multiple triggers for the same delivery
    if (hasTriggeredRef.current) {
      return;
    }

    if (triggerSuggestions && !isLoading && isActive && hasInitialized) {
      console.log(
        "[HAL Chat V2] Suggestion generation triggered for hatType:",
        hatType,
        "(active and initialized)",
      );

      // Mark as triggered to prevent duplicates
      hasTriggeredRef.current = true;
      // Also mark auto-generated to prevent the auto-generate effect from firing
      // when triggerSuggestions becomes false
      hasAutoGeneratedRef.current = true;

      // Reset trigger immediately to prevent re-firing
      onSuggestionsTriggered?.();

      // Generate suggestions
      handleGenerateSuggestions();
    } else if (triggerSuggestions && (!isActive || !hasInitialized)) {
      // Clear trigger if conditions aren't met to prevent it from firing later
      console.log(
        "[HAL Chat V2] Clearing trigger - tab not ready (isActive:",
        isActive,
        "hasInitialized:",
        hasInitialized,
        ")",
      );
      hasTriggeredRef.current = true;
      // Also mark auto-generated since we're clearing the external trigger
      hasAutoGeneratedRef.current = true;
      onSuggestionsTriggered?.();
    }
  }, [
    triggerSuggestions,
    isLoading,
    isActive,
    hasInitialized,
    handleGenerateSuggestions,
    onSuggestionsTriggered,
    hatType,
  ]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isLoading) return;

    const messageToSend = chatInput;
    setChatInput("");

    console.log(
      "[HAL Chat V2] Sending regular chat message:",
      messageToSend,
      "for hatType:",
      hatType,
    );

    // Set loading state
    setIsProcessing(true);

    // Send via useChat (this will save to database automatically via the existing API)
    sendMessage({
      parts: [{ type: "text", text: messageToSend }],
    });
  };

  const handleSuggestionClick = async (suggestion: Suggestion) => {
    console.log("[HAL Chat V2] Suggestion clicked:", {
      id: suggestion.id,
      title: suggestion.title,
      dbId: suggestion.dbId,
      targetChat: suggestion.targetChat,
    });

    // If this is an advisor suggestion, send it to the HAL chat input
    if (suggestion.targetChat === "advisor") {
      console.log("[HAL Chat V2] Routing to advisor chat");
      setChatInput(suggestion.prompt);
      // Focus the chat input
      setTimeout(() => {
        const textarea = document.querySelector(
          "[data-advisor-chat-input]",
        ) as HTMLTextAreaElement;
        if (textarea) {
          textarea.focus();
          textarea.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
      return;
    }

    // Otherwise, route to main builder chat (existing behavior)
    if (!onSuggestionClick) return;
    onSuggestionClick(suggestion.prompt);
  };

  const handleDeleteAll = async () => {
    if (isLoading) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete all chat messages and suggestions? This action cannot be undone.",
    );

    if (!confirmed) return;

    try {
      const response = await fetch(
        `/api/hal-chat/delete?projectId=${projectId}`,
        {
          method: "DELETE",
        },
      );

      if (response.ok) {
        const result = await response.json();
        setChatMessages([]); // Clear chat history
        // setSuggestionMessages([]); // Clear suggestion history
        toast.success(result.message || "All messages deleted successfully");
        console.log(
          "[Advisor Delete] Successfully deleted all messages:",
          result,
        );
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to delete messages");
        console.error("[Advisor Delete] Failed to delete messages:", error);
      }
    } catch (error) {
      toast.error("Failed to delete messages");
      console.error("[Advisor Delete] Error deleting messages:", error);
    }
  };

  // Show loading state when messages are being loaded or when there are no messages yet
  // Note: allMessagesToRender is defined above, so we can use it here
  const hasMessages = allMessagesToRender.length > 0;
  // Check if pre-deliverable warning is already shown or about to be shown
  const warningText =
    "Until your project is ready, I'll be able to help with research, info and suggestion based on what I can see as your initial prompt. As soon as it's delivered, I can see it, just like you, and can help you with more!";
  const hasPreDeliverableWarning = chatMessages.some(
    (msg) => msg.role === "assistant" && getMessageContent(msg) === warningText,
  );
  // Don't show loading if we're about to show the pre-deliverable warning (only for new projects)
  const willShowPreDeliverableWarning =
    isNewProject &&
    isActive &&
    !isSandboxReady &&
    chatMessages.length === 0 &&
    !preDeliverableWarningShownRef.current &&
    hasInitialized;

  // Loading state logic:
  // - Always show loading when isLoadingMessages is true (messages are being fetched from DB)
  // - Show loading when no messages and sandbox/project not ready (unless showing warning for new projects)
  const shouldShowLoadingState =
    // Always show loading when actively loading messages from database
    isLoadingMessages ||
    // Or show loading when no messages and waiting for sandbox/project (unless showing warning)
    (!hasMessages &&
      (!isSandboxReady ||
        !projectFiles ||
        Object.keys(projectFiles).length === 0) &&
      // Don't show loading state when pre-deliverable warning is shown (only for new projects)
      !(isNewProject && hasPreDeliverableWarning && !isSandboxReady) &&
      !willShowPreDeliverableWarning);

  return (
    <>
      {/* Main Container with Border */}
      <div
        className={cn(
          "dark:bg-prj-bg-primary flex h-full flex-1 flex-col overflow-hidden bg-[#F9F3FC]",
          isMiniMenu
            ? "mb-0 rounded-none border-0"
            : showTabs
              ? "border-prj-border-primary border-b"
              : "border",
        )}
      >
        {/* Messages */}
        <StickToBottom
          className="scrollbar-hide relative min-h-0 flex-1 overflow-y-scroll"
          initial="smooth"
          resize="smooth"
          role="log"
        >
          <StickToBottom.Content
            className={cn("space-y-3", isMiniMenu ? "p-2" : "p-3")}
          >
            {shouldShowLoadingState ? (
              <div className="space-y-2">
                {/* Header floating above card - no background */}
                <div className="flex items-center gap-2 text-[#1C1C1C] dark:text-white">
                  <AdvisorLogo />
                  <span className="text-sm font-medium">Advisor</span>
                  <span className="text-sm font-medium capitalize">
                    ({hatType} hat active)
                  </span>
                </div>
                {/* Card with gradient border - shimmer placeholder */}
                <div className="rounded-2xl rounded-tl-none bg-[linear-gradient(90deg,#F4E1F2_0%,#EAD6F5_25%,#C9D7FF_50%,#B2E4F5_75%,#A8F5E1_100%)] p-[2px] dark:bg-[linear-gradient(90deg,#9067F7_0%,#6A7FF7_33%,#3E80F6_66%,#2CD4C9_100%)]">
                  <div className="rounded-xl rounded-tl-none bg-white dark:bg-[#26263D]">
                    <div className="flex flex-col gap-3 p-4">
                      <div className="space-y-4 text-[#000000] dark:text-[#B8C9C3]">
                        <div className="space-y-3">
                          {/* Shimmer placeholder for text lines */}
                          <div className="space-y-2.5">
                            <div
                              className="h-4 w-full rounded bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] dark:from-gray-700 dark:via-gray-600 dark:to-gray-700"
                              style={{
                                animation: "shimmer 1.5s ease-in-out infinite",
                              }}
                            ></div>
                            <div
                              className="h-4 w-5/6 rounded bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] dark:from-gray-700 dark:via-gray-600 dark:to-gray-700"
                              style={{
                                animation: "shimmer 1.5s ease-in-out infinite",
                              }}
                            ></div>
                            <div
                              className="h-4 w-4/6 rounded bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] dark:from-gray-700 dark:via-gray-600 dark:to-gray-700"
                              style={{
                                animation: "shimmer 1.5s ease-in-out infinite",
                              }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <style
                      dangerouslySetInnerHTML={{
                        __html: `
                        @keyframes shimmer {
                          0% {
                            background-position: -200% 0;
                          }
                          100% {
                            background-position: 200% 0;
                          }
                        }
                      `,
                      }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <>
                {allMessagesToRender.map((message, messageIndex) => {
                  const isSuggestionMessage = "messageType" in message;
                  const role = message.role as "user" | "assistant";
                  const id = message.id;

                  // Hide internal trigger messages immediately (before filter runs)
                  if (id.startsWith("internal-trigger-")) {
                    return null;
                  }

                  // Check if this is the latest message with suggestions
                  const isLatestMessageWithSuggestions = (() => {
                    if (role !== "assistant" || isSuggestionMessage)
                      return false;

                    const uiMsg = message as UIMessage;
                    const hasSuggestions = uiMsg.parts?.some(
                      (p) => p.type === "tool-generateSuggestions",
                    );

                    if (!hasSuggestions) return false;

                    // Check if there are any later assistant messages with suggestions
                    for (
                      let i = messageIndex + 1;
                      i < allMessagesToRender.length;
                      i++
                    ) {
                      const laterMsg = allMessagesToRender[i];
                      if (
                        laterMsg.role === "assistant" &&
                        "parts" in laterMsg
                      ) {
                        const laterUiMsg = laterMsg as UIMessage;
                        if (
                          laterUiMsg.parts?.some(
                            (p) => p.type === "tool-generateSuggestions",
                          )
                        ) {
                          return false; // There's a later message with suggestions
                        }
                      }
                    }

                    return true; // This is the latest
                  })();

                  // Check if previous message was also from assistant (for header display)
                  const previousMessage =
                    messageIndex > 0
                      ? allMessagesToRender[messageIndex - 1]
                      : null;
                  const previousWasAssistant =
                    previousMessage?.role === "assistant";
                  const shouldShowHeader = !previousWasAssistant;

                  // For suggestion messages, use old rendering
                  if (isSuggestionMessage) {
                    const halMsg = message as unknown as HalMessage;
                    const content = halMsg.content;
                    const suggestions = halMsg.suggestions;

                    return (
                      <div key={id} className="space-y-3">
                        {role === "user" && (
                          <div className="rounded-lg border border-[#E3D0EF] bg-[#F2E6F8] p-3 text-[#1C1C1C] shadow-[0px_1px_1px_0px_#0000001F,0px_2px_8.7px_0px_#676E760A] dark:border-purple-800 dark:bg-purple-900/20">
                            <p className="text-sm font-medium text-[#1C1C1C]">
                              <span className="mr-2 inline-flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400">
                                <AdvisorLogo />
                                Suggestion Request:
                              </span>
                              {content}
                            </p>
                          </div>
                        )}

                        {role === "assistant" && (
                          <div
                            className="space-y-2"
                            key={`${id}-assistant-response`}
                          >
                            {/* Header floating above card - no background */}
                            <div className="flex items-center gap-2 text-[#1C1C1C] dark:text-white">
                              <AdvisorLogo />
                              <span className="text-sm font-medium">
                                Advisor insight
                              </span>
                              <span className="text-sm font-medium capitalize">
                                ({hatType} hat active)
                              </span>
                            </div>
                            {/* Card with gradient border */}
                            <div className="rounded-2xl rounded-tl-none bg-[linear-gradient(90deg,#F4E1F2_0%,#EAD6F5_25%,#C9D7FF_50%,#B2E4F5_75%,#A8F5E1_100%)] p-[2px] dark:bg-[linear-gradient(90deg,#9067F7_0%,#6A7FF7_33%,#3E80F6_66%,#2CD4C9_100%)]">
                              <div className="rounded-xl rounded-tl-none bg-white dark:bg-[#26263D]">
                                <div className="flex flex-col gap-3 p-4">
                                  <div className="flex items-start gap-2">
                                    <div className="flex-1">
                                      <div className="space-y-4 text-[#000000] dark:text-[#B8C9C3]">
                                        <Response>{content}</Response>
                                      </div>
                                    </div>
                                  </div>
                                  {suggestions && suggestions.length > 0 && (
                                    <TooltipProvider delayDuration={300}>
                                      <div className="grid grid-cols-2 gap-2">
                                        {suggestions.map((suggestion) => (
                                          <Tooltip key={suggestion.id}>
                                            <TooltipTrigger asChild>
                                              <SuggestionButton
                                                onClick={() =>
                                                  handleSuggestionClick(
                                                    suggestion,
                                                  )
                                                }
                                              >
                                                <span className="text-sm font-normal break-words text-[#24292E] dark:text-[#B8C9C3]">
                                                  {suggestion.title}
                                                </span>
                                              </SuggestionButton>
                                            </TooltipTrigger>
                                            <TooltipContent
                                              side="left"
                                              sideOffset={8}
                                              hideArrow
                                              className="border-green-700 bg-green-600 text-white"
                                            >
                                              <div className="flex items-center gap-1">
                                                <span>← Add to chat</span>
                                              </div>
                                            </TooltipContent>
                                          </Tooltip>
                                        ))}
                                      </div>
                                    </TooltipProvider>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }

                  // For regular chat messages with parts, use new grouped rendering
                  const uiMessage = message as UIMessage;
                  const groups = groupToolCalls(uiMessage.parts);

                  // Check if this message has generateSuggestions and filter out follow-up text
                  const hasSuggestionTool = uiMessage.parts.some(
                    (p) => p.type === "tool-generateSuggestions",
                  );

                  // If it has suggestions, filter out text groups that come before or after
                  const filteredGroups = hasSuggestionTool
                    ? groups.filter((group, idx) => {
                        // Find the index where generateSuggestions would appear
                        const suggestionPartIdx = uiMessage.parts.findIndex(
                          (p) => p.type === "tool-generateSuggestions",
                        );

                        // Get the part index for this group's first part
                        const groupPartIdx = uiMessage.parts.findIndex(
                          (p) => p === group.content[0],
                        );

                        // Keep everything up to and including the suggestion
                        // But filter out text groups that come after
                        if (
                          group.type === "text" &&
                          groupPartIdx > suggestionPartIdx
                        ) {
                          return false; // Hide post-suggestion text
                        }
                        return true;
                      })
                    : groups;

                  return (
                    <div key={id} className="space-y-3">
                      {role === "user" && (
                        <div
                          className={`rounded-lg border border-[#E3D0EF] bg-[#F2E6F8] p-3 text-[#1C1C1C] shadow-[0px_1px_1px_0px_#0000001F,0px_2px_8.7px_0px_#676E760A] dark:border-purple-800 dark:bg-purple-900/20 dark:text-[#B8C9C3]`}
                        >
                          <p className="text-sm font-medium text-[#1C1C1C] dark:text-[#B8C9C3]">
                            {getMessageContent(uiMessage)}
                          </p>
                        </div>
                      )}

                      {role === "assistant" && (
                        <div className="space-y-3">
                          {/* Render parts in their original order - generateSuggestions now handled in filteredGroups */}
                          {uiMessage.parts.map((part, partIndex) => {
                            // Skip generateSuggestions - it's now rendered in filteredGroups to preserve order
                            if (part.type === "tool-generateSuggestions") {
                              return null;
                            }

                            // Handle text parts
                            // NOTE: Text parts are now handled by the filteredGroups rendering below
                            // This avoids duplication. Skip individual text part rendering here.
                            if (
                              part.type === "text" &&
                              (part as any).text?.trim()
                            ) {
                              return null; // Skip - will be rendered by filteredGroups
                            }

                            // Skip other part types for now (they'll be handled by filteredGroups below)
                            return null;
                          })}

                          {/* Render other grouped tools and text parts in order */}
                          {filteredGroups.map((group, groupIndex) => {
                            // Render text groups that come after tools (not handled in first loop)
                            if (group.type === "text") {
                              const part = group.content[0];
                              const textContent = (part as any).text?.trim();
                              if (!textContent) return null;

                              // Show header only on first group if previous message wasn't assistant
                              const shouldShowHeaderForGroup =
                                groupIndex === 0 && shouldShowHeader;

                              return (
                                <div
                                  className="space-y-2"
                                  key={`${id}-text-group-${groupIndex}`}
                                >
                                  {/* Header floating above card - no background */}
                                  <div className="flex items-center gap-2 text-[#1C1C1C] dark:text-white">
                                    <AdvisorLogo />
                                    <span className="text-sm font-medium">
                                      Advisor Insight
                                    </span>
                                    <span className="text-sm font-medium capitalize">
                                      ({hatType} hat active)
                                    </span>
                                  </div>
                                  {/* Card with gradient border */}
                                  <div className="rounded-2xl rounded-tl-none bg-[linear-gradient(90deg,#F4E1F2_0%,#EAD6F5_25%,#C9D7FF_50%,#B2E4F5_75%,#A8F5E1_100%)] p-[2px] dark:bg-[linear-gradient(90deg,#9067F7_0%,#6A7FF7_33%,#3E80F6_66%,#2CD4C9_100%)]">
                                    <div className="rounded-xl rounded-tl-none bg-white dark:bg-[#26263D]">
                                      <div className="flex flex-col gap-3 p-4">
                                        <div className="space-y-4 text-[#000000] dark:text-[#B8C9C3]">
                                          <Response>{textContent}</Response>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            }

                            if (group.type === "reasoning") {
                              const part = group.content[0];
                              return (
                                <div
                                  key={`${id}-reasoning-${groupIndex}`}
                                  className="overflow-hidden rounded-lg bg-gradient-to-r from-[#F4E1F2] to-[#EAD6F5] p-[2px] dark:from-[#9067F7] dark:to-[#3E80F6]"
                                >
                                  <Reasoning
                                    isStreaming={
                                      (part as any).state === "streaming"
                                    }
                                    className="overflow-hidden rounded-lg"
                                  >
                                    <ReasoningTrigger className="flex cursor-pointer items-center justify-between gap-2 bg-white px-3 py-[10px] text-[#1C1C1C] transition-colors dark:bg-[#26263D] dark:text-white" />
                                    <ReasoningContent className="bg-white px-3 py-[10px] dark:bg-[#26263D]">
                                      {(part as any).text}
                                    </ReasoningContent>
                                  </Reasoning>
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
                                  key={`${id}-toolgroup-${groupIndex}`}
                                  defaultOpen={true}
                                  className="overflow-hidden rounded-lg bg-gradient-to-r from-[#F4E1F2] to-[#EAD6F5] p-[2px] dark:from-[#9067F7] dark:to-[#3E80F6]"
                                >
                                  <CollapsibleTrigger className="group w-full">
                                    <div className="flex cursor-pointer items-center justify-between bg-white px-3 py-[10px] transition-colors dark:bg-[#26263D]">
                                      <div className="flex min-w-0 flex-1 items-center gap-2 text-[#1C1C1C] dark:text-white">
                                        <div className="truncate">
                                          {isLoading || group.showBadge ? (
                                            <ShimmeringText
                                              text={
                                                group.title || "Processing..."
                                              }
                                              duration={1}
                                              shimmeringColor="currentColor"
                                              className="text-sm font-medium"
                                            />
                                          ) : (
                                            <span className="truncate text-sm font-medium">
                                              {group.title || "Processing..."}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <ChevronDown className="h-5 w-5 text-[#1C1C1C] transition-transform group-data-[state=open]:rotate-180 dark:text-white" />
                                    </div>
                                  </CollapsibleTrigger>
                                  <TaskContent className="mt-0 space-y-[10px] bg-white px-3 py-[10px] dark:bg-[#26263D]">
                                    {group.content.map((part, i) => {
                                      // Handle reasoning parts within tool groups
                                      if (part.type === "reasoning") {
                                        return (
                                          <div
                                            key={`reasoning-${i}`}
                                            className="mb-2"
                                          >
                                            <Reasoning
                                              isStreaming={
                                                (part as any).state ===
                                                "streaming"
                                              }
                                              defaultOpen={false}
                                            >
                                              <ReasoningTrigger
                                                className="text-sm"
                                                compact
                                              />
                                              <ReasoningContent className="mt-2 text-sm">
                                                {(part as any).text}
                                              </ReasoningContent>
                                            </Reasoning>
                                          </div>
                                        );
                                      }

                                      // Type guard for tool parts
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
                                        part: UIMessagePart<
                                          UIDataTypes,
                                          UITools
                                        >,
                                      ): part is ToolPart =>
                                        part.type.startsWith("tool-");

                                      if (!isTool(part)) return null;

                                      const toolName = part.type.replace(
                                        "tool-",
                                        "",
                                      );

                                      // Skip generateSuggestions - it's already rendered in the parts loop above
                                      if (toolName === "generateSuggestions") {
                                        return null;
                                      }

                                      // Create user-friendly tool description
                                      let toolDescription = "";
                                      if (
                                        part.state === "output-available" ||
                                        part.state === "output-error"
                                      ) {
                                        switch (toolName) {
                                          case "generateSuggestions":
                                            toolDescription = `Advisor (${hatType} hat active)`;
                                            break;
                                          case "webSearch":
                                          case "web-search":
                                            toolDescription =
                                              "Searched the web";
                                            break;
                                          case "search":
                                            toolDescription =
                                              "Searched documentation";
                                            break;
                                          case "readFile":
                                            const readPath =
                                              (part.input as any)?.path ||
                                              "file";
                                            toolDescription = `Read ${readPath}`;
                                            break;
                                          case "analyze":
                                            toolDescription =
                                              "Analyzed project";
                                            break;
                                          default:
                                            toolDescription = `Completed ${toolName}`;
                                        }
                                      } else {
                                        switch (toolName) {
                                          case "generateSuggestions":
                                            toolDescription =
                                              "Generating suggestions...";
                                            break;
                                          case "webSearch":
                                          case "web-search":
                                            toolDescription =
                                              "Running a web search...";
                                            break;
                                          case "search":
                                            toolDescription = "Searching...";
                                            break;
                                          case "readFile":
                                            toolDescription = "Reading file...";
                                            break;
                                          case "analyze":
                                            toolDescription = "Analyzing...";
                                            break;
                                          default:
                                            toolDescription = `Running ${toolName}...`;
                                        }
                                      }

                                      return (
                                        <TaskItem
                                          key={`tool-${id}-${groupIndex}-${i}`}
                                          className="flex flex-col gap-1"
                                        >
                                          {part.errorText && (
                                            <div className="rounded bg-red-50 p-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
                                              {part.errorText}
                                            </div>
                                          )}

                                          <div className="flex items-center gap-2">
                                            <div className="min-w-0 flex-1">
                                              <div className="flex items-center justify-between">
                                                <span className="truncate text-sm text-[#000000] dark:text-[#FFFFFF]">
                                                  {toolDescription}
                                                </span>
                                                {part.state ===
                                                  "output-error" && (
                                                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                                    <CircleX size={12} />
                                                  </span>
                                                )}
                                                {part.state ===
                                                  "output-available" && (
                                                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                    <CircleCheckBig size={12} />
                                                  </span>
                                                )}
                                                {(part.state ===
                                                  "input-streaming" ||
                                                  part.state ===
                                                    "input-available") && (
                                                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                                    <span className="text-sm leading-none">
                                                      ⋯
                                                    </span>
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        </TaskItem>
                                      );
                                    })}
                                  </TaskContent>
                                </Task>
                              );
                            } else if ((group as any).type === "suggestions") {
                              // Render generateSuggestions in its proper position
                              const part = group.content[0];
                              const suggestionPart = part as any;

                              // Determine which suggestions to display
                              const currentSuggestions =
                                suggestionPart.output?.suggestions || [];

                              // Progressive accumulation
                              const previousSuggestions =
                                accumulateSuggestionsFromMessages(
                                  allMessagesToRender,
                                  messageIndex,
                                  3,
                                );

                              const displaySuggestions = [
                                ...previousSuggestions,
                                ...currentSuggestions,
                              ].slice(0, 16);

                              // Check if there's prior text content in this message before the suggestions
                              // If so, suppress the greeting to avoid double "Advisor insight" blocks
                              // Check the actual message parts, not just filtered groups
                              const suggestionPartIndex =
                                uiMessage.parts.findIndex(
                                  (p) => p.type === "tool-generateSuggestions",
                                );
                              const hasPriorTextInMessage = uiMessage.parts
                                .slice(0, suggestionPartIndex)
                                .some(
                                  (p) =>
                                    p.type === "text" &&
                                    (p as any).text?.trim().length > 0,
                                );

                              console.log(
                                "[HAL Suggestions] Greeting suppression check:",
                                {
                                  hasPriorText: hasPriorTextInMessage,
                                  suggestionPartIndex,
                                  totalParts: uiMessage.parts.length,
                                  partsBeforeSuggestion: uiMessage.parts
                                    .slice(0, suggestionPartIndex)
                                    .map((p) => p.type),
                                },
                              );

                              // Show header only on first group if previous message wasn't assistant
                              const shouldShowHeaderForGroup =
                                groupIndex === 0 && shouldShowHeader;

                              return (
                                <div
                                  className="space-y-2"
                                  key={`${id}-suggestions-${groupIndex}`}
                                >
                                  {/* Header floating above card - no background */}
                                  <div className="flex items-center gap-2 text-[#1C1C1C] dark:text-white">
                                    <AdvisorLogo />
                                    <span className="text-sm font-medium">
                                      Advisor insight
                                    </span>
                                    <span className="text-sm font-medium capitalize">
                                      ({hatType} hat active)
                                    </span>
                                  </div>
                                  {/* Card with gradient border */}
                                  <div className="rounded-2xl rounded-tl-none bg-[linear-gradient(90deg,#F4E1F2_0%,#EAD6F5_25%,#C9D7FF_50%,#B2E4F5_75%,#A8F5E1_100%)] p-[2px] dark:bg-[linear-gradient(90deg,#9067F7_0%,#6A7FF7_33%,#3E80F6_66%,#2CD4C9_100%)]">
                                    <div className="rounded-xl rounded-tl-none bg-white dark:bg-[#26263D]">
                                      <div className="flex flex-col gap-3 p-4">
                                        {/* Show loading while generating */}
                                        {!suggestionPart.output && (
                                          <div className="text-[#000000] dark:text-[#B8C9C3]">
                                            <ShimmeringText text="Generating suggestions..." />
                                          </div>
                                        )}

                                        {/* Show greeting and suggestions when complete */}
                                        {suggestionPart.output && (
                                          <>
                                            {/* Only show greeting if there's no prior text in this message */}
                                            {suggestionPart.output.greeting &&
                                              !hasPriorTextInMessage && (
                                                <div className="text-[#000000] dark:text-[#B8C9C3]">
                                                  <Response>
                                                    {
                                                      suggestionPart.output
                                                        .greeting
                                                    }
                                                  </Response>
                                                </div>
                                              )}
                                            {displaySuggestions.length > 0 && (
                                              <TooltipProvider
                                                delayDuration={300}
                                              >
                                                <div className="grid grid-cols-2 gap-2">
                                                  {displaySuggestions.map(
                                                    (
                                                      suggestion: any,
                                                      idx: number,
                                                    ) => {
                                                      const IconComponent =
                                                        iconMap[
                                                          suggestion.icon as keyof typeof iconMap
                                                        ] || <AdvisorLogo />;
                                                      const titleText =
                                                        suggestion.title || "";

                                                      const formattedTitle =
                                                        titleText
                                                          ? titleText
                                                              .charAt(0)
                                                              .toLowerCase() +
                                                            titleText.slice(1)
                                                          : "";
                                                      const shouldShowShortTitle =
                                                        suggestion.shortTitle &&
                                                        suggestion.shortTitle
                                                          .trim()
                                                          .toLowerCase() !==
                                                          titleText
                                                            .trim()
                                                            .toLowerCase();
                                                      return (
                                                        <Tooltip
                                                          key={`suggestion-${idx}`}
                                                        >
                                                          <TooltipTrigger
                                                            asChild
                                                          >
                                                            <SuggestionButton
                                                              onClick={() =>
                                                                handleSuggestionClick(
                                                                  {
                                                                    id:
                                                                      suggestion.id ||
                                                                      `suggestion-${idx}`,
                                                                    title:
                                                                      suggestion.title ||
                                                                      "",
                                                                    description:
                                                                      suggestion.description ||
                                                                      "",
                                                                    icon: IconComponent,
                                                                    color:
                                                                      suggestion.color ||
                                                                      "bg-gray-500",
                                                                    prompt:
                                                                      suggestion.prompt ||
                                                                      "",
                                                                    targetChat:
                                                                      suggestion.targetChat ||
                                                                      "builder",
                                                                    category:
                                                                      "general",
                                                                  },
                                                                )
                                                              }
                                                            >
                                                              <div>
                                                                {shouldShowShortTitle && (
                                                                  <span className="text-sm font-normal break-words text-[#24292E] dark:text-[#B8C9C3]">
                                                                    {
                                                                      suggestion.shortTitle
                                                                    }
                                                                    :{" "}
                                                                  </span>
                                                                )}

                                                                <span className="text-sm font-normal break-words text-[#24292E] first-letter:lowercase dark:text-[#B8C9C3]">
                                                                  {
                                                                    formattedTitle
                                                                  }
                                                                </span>
                                                              </div>
                                                            </SuggestionButton>
                                                          </TooltipTrigger>
                                                          <TooltipContent
                                                            side="left"
                                                            sideOffset={8}
                                                            hideArrow
                                                            className="border-green-700 bg-green-600 text-white"
                                                          >
                                                            <div className="flex items-center gap-1">
                                                              <span>
                                                                ← Add to chat
                                                              </span>
                                                            </div>
                                                          </TooltipContent>
                                                        </Tooltip>
                                                      );
                                                    },
                                                  )}
                                                </div>
                                              </TooltipProvider>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {allMessagesToRender[allMessagesToRender.length - 1]?.role !==
                  "assistant" && (
                  <div className="space-y-2">
                    <div className="overflow-hidden rounded-lg">
                      <div className="bg-white dark:bg-[#26263D]">
                        <ThinkingBubble />
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </StickToBottom.Content>
          <ScrollToBottomButton />
        </StickToBottom>

        {/* Input */}
        <div
          className={cn(
            "relative",
            isMiniMenu ? "mt-2 px-2 pb-2" : "mt-[10px] px-2 pb-2",
          )}
        >
          <form onSubmit={handleSendMessage} className="space-y-2">
            <div className="relative rounded-xl bg-gradient-to-r from-[rgba(0,196,204,0.3)] to-[rgba(125,42,232,0.3)] p-[1px] shadow-[0_0_0_1px_transparent,-6px_-3px_12px_0px_#00C4CC1A,6px_3px_12px_0px_#8B3DFF1A] dark:bg-none">
              <div className="relative rounded-xl bg-white dark:border dark:border-gray-700 dark:bg-[#1A2421]">
                <textarea
                  data-advisor-chat-input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask the advisor"
                  disabled={isLoading}
                  rows={2}
                  className="w-full resize-none rounded-xl border-none bg-transparent p-3 text-sm text-gray-900 placeholder-gray-500 focus:outline-none dark:text-gray-100 dark:placeholder-gray-400"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e as any);
                    }
                  }}
                />
                <div className="flex items-center justify-end p-3 pt-0">
                  <div className="flex items-center gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            onClick={handleGenerateSuggestions}
                            disabled={isLoading}
                            className="bg-prj-bg-secondary hover:text-foreground hover:bg-prj-tooltip-hover-bg hover:border-prj-tooltip-hover-border h-8 w-8 rounded-full p-0 transition-colors duration-200 hover:border"
                            size="sm"
                            variant="ghost"
                          >
                            <RefreshCw className="h-[13px] w-[13px]" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Generate more Advisor suggestions</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <Button
                      type="submit"
                      disabled={isLoading || !chatInput.trim()}
                      size="sm"
                      className="h-8 w-8 rounded-full bg-[#1E9A80] p-0"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
