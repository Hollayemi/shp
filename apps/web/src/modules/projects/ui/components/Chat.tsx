"use client";

import {
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import {
  CharacterCounter,
  useCharacterLimit,
} from "@/components/CharacterCounter";
import PricingModal from "@/components/PricingModal";
import {
  showInsufficientCreditsToast,
  showNeedPaidPlanToast,
} from "@/components/toast-notifications";
import { Button } from "@/components/ui/button";
import { useAudioFeedback } from "@/hooks/useAudioFeedback";
import { setSandboxPreviewUrlAtom } from "@/lib/sandbox-preview-state";
import { cn, generateUUID } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import { UIMessage, useChat } from "@ai-sdk/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DefaultChatTransport } from "ai";
import { useAtom, useSetAtom } from "jotai";
import { ArrowDownIcon, Plus, ImageIcon } from "lucide-react";
import { visualEditingModeAtom } from "@/lib/visual-editor/state";
import { usePathname, useSearchParams } from "next/navigation";
import { useRouter } from "nextjs-toploader/app";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { MigrationHitlCard } from "@/components/MigrationHitlCard";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import { useDebounceCallback } from "usehooks-ts";
import { ChatMessage } from "./ChatMessage";
import { SandboxLoadingBanner } from "./SandboxLoadingBanner";
import { ChatFileUpload, type FileAttachment } from "./ChatImageUpload";
import {
  AdvisorSuggestionsStrip,
  DiscussButton,
} from "./AdvisorSuggestionsStrip";
import { VoiceInput } from "@/components/VoiceInput";

// Track active Chat component instances per project to prevent duplicate stream connections
// This prevents React StrictMode and navigation from creating multiple concurrent stream consumers
const activeChatInstances = new Map<string, string>(); // projectId -> instanceId

// Track if user is navigating away to prevent reconnection attempts
let isNavigatingAway = false;

// Clear stale entries on browser navigation (back/forward buttons)
// This ensures navigation doesn't leave stale instance IDs that block resumption
if (typeof window !== "undefined") {
  // Detect when user is navigating away
  window.addEventListener("beforeunload", () => {
    isNavigatingAway = true;
    console.log("[Chat] beforeunload - marking navigation away");
  });

  // Detect page hide (navigation, tab close, etc)
  window.addEventListener("pagehide", () => {
    isNavigatingAway = true;
    console.log("[Chat] pagehide - marking navigation away");
  });

  window.addEventListener("pageshow", (event) => {
    // Always reset flag on pageshow, regardless of navigation type
    // This prevents the flag from staying true forever after first navigation
    isNavigatingAway = false;
    console.log("[Chat] pageshow - reset isNavigatingAway flag");

    // If this is a back/forward navigation (persisted state), clear stale entries
    // This allows the new instance to properly register and resume
    if (event.persisted) {
      console.log(
        "[Chat] Browser navigation detected (pageshow with persisted) - clearing stale instance entries",
      );
      activeChatInstances.clear();
    }
  });
}
const filterOutThinkingPlaceholder = (messages: UIMessage[]) => {
  return messages.filter(
    (message) =>
      !(message.metadata && (message.metadata as any).isThinkingPlaceholder),
  );
};
// ScrollToBottomButton component using useStickToBottomContext
const ScrollToBottomButton = ({
  hasSuggestionsStrip,
}: {
  hasSuggestionsStrip?: boolean;
}) => {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  const handleScrollToBottom = useCallback(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  if (isAtBottom) return null;

  return (
    <Button
      className={cn(
        "absolute left-[50%] z-30 translate-x-[-50%] rounded-full",
        hasSuggestionsStrip ? "bottom-24" : "bottom-4", // Adjust position when suggestions strip is visible
      )}
      onClick={handleScrollToBottom}
      size="icon"
      type="button"
      variant="outline"
    >
      <ArrowDownIcon className="size-4" />
    </Button>
  );
};

// Auto-scroll when advisor strip becomes visible
const AdvisorStripAutoScroll = ({
  showAdvisorStrip,
}: {
  showAdvisorStrip: boolean;
}) => {
  const { scrollToBottom } = useStickToBottomContext();
  const prevShowStripRef = useRef(false);

  useEffect(() => {
    // Scroll to bottom when strip becomes visible
    if (showAdvisorStrip && !prevShowStripRef.current) {
      // Small delay to let the margin change take effect
      setTimeout(() => {
        scrollToBottom();
      }, 50);
    }
    prevShowStripRef.current = showAdvisorStrip;
  }, [showAdvisorStrip, scrollToBottom]);

  return null;
};

export default function Chat({
  id,
  userId,
  projectId,
  onFragmentCreated,
  onGenerationStateChange,
  onGenerationComplete,
  onSendMessageReady,
  onCodingComplete,
  initialMessages,
  initialPrompt,
  sandboxReady = false,
  shouldResume = false,
  buildStatus,
  sandboxStatus,
  isRecovering = false,
  isWaitingForContent = false,
  isFetchingPreviewAuth = false,
  isCodingComplete = false,
  isManualRefresh = false,
  uiState,
  advisorSuggestions = [],
  isLoadingSuggestions = false,
  onToggleAdvisor,
  shipperCloudEnabled = false,
  onOpenCloudCreditsModal,
  isFirstImportLoading = false,
  migrationCard,
}: {
  id?: string | undefined;
  userId: string;
  projectId: string;
  onFragmentCreated?: () => void;
  onGenerationStateChange?: (isGenerating: boolean) => void;
  onGenerationComplete?: () => void;
  onSendMessageReady?: (
    sendMessageFn: (message: {
      parts: Array<{ type: "text"; text: string }>;
    }) => void,
  ) => void;
  onCodingComplete?: (completed: boolean) => void;
  initialMessages: UIMessage[];
  /** Initial prompt to prefill the textarea (e.g., from imported project) */
  initialPrompt?: string;
  sandboxReady?: boolean;
  shouldResume?: boolean;
  buildStatus?:
    | "IDLE"
    | "INITIALIZING"
    | "GENERATING"
    | "BUILDING"
    | "READY"
    | "ERROR"
    | "AWAITING_SANDBOX";
  sandboxStatus?: "ready" | "building" | "needs-attention" | "failed" | "draft";
  isRecovering?: boolean;
  isWaitingForContent?: boolean;
  isFetchingPreviewAuth?: boolean;
  isCodingComplete?: boolean;
  isManualRefresh?: boolean;
  uiState?:
    | "recovering"
    | "newProject"
    | "loadingFragment"
    | "generating"
    | "checkingHealth"
    | "needsRefresh"
    | "needsInitialization"
    | "sandboxNotReady"
    | "noPreview"
    | "refreshing"
    | "awaitingSandbox"
    | "waitingForContent"
    | "ready";
  advisorSuggestions?: Array<{
    id: string;
    title: string;
    shortTitle?: string;
    prompt: string;
  }>;
  isLoadingSuggestions?: boolean;
  onToggleAdvisor?: () => void;
  /** Whether Shipper Cloud is already enabled for this project */
  shipperCloudEnabled?: boolean;
  /** Callback to open the Cloud Credits modal */
  onOpenCloudCreditsModal?: () => void;
  /** Whether this is a first-time import loading (shows placeholder and disables chat) */
  isFirstImportLoading?: boolean;
  /** Migration card props - shown when imported project needs backend migration */
  migrationCard?: {
    show: boolean;
    platform: "LOVABLE" | "BASE44";
    onApprove: () => void;
    onSkip: () => void;
  };
}) {
  const [input, setInput] = useState(initialPrompt || "");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [seedPromptSent, setSeedPromptSent] = useState(false);
  const [hasConsumedInitialPrompt, setHasConsumedInitialPrompt] =
    useState(false);
  const [showSandboxConnected, setShowSandboxConnected] = useState(false);
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [userMessageStatuses, setUserMessageStatuses] = useState<{
    [messageId: string]: "setting-up" | "ready";
  }>({});
  const [attachedImages, setAttachedImages] = useState<FileAttachment[]>([]);
  const fileInputTriggerRef = useRef<(() => void) | null>(null);
  const [showThinkingMessage, setShowThinkingMessage] = useState(false);
  const [showAdvisorStrip, setShowAdvisorStrip] = useState(false);
  const [hasDismissedStrip, setHasDismissedStrip] = useState(false);

  // Voice input state
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [isVoiceProcessing, setIsVoiceProcessing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [voiceFrequencyData, setVoiceFrequencyData] = useState<number[]>([]);
  const initialVoiceTextRef = useRef(""); // Store text before recording starts

  const chatTokenRef = useRef<string | null>(null);
  const chatTokenFetchedRef = useRef(false);

  // Track processed tool calls to prevent duplicate triggers
  const processedToolCallIds = useRef<Set<string>>(new Set());
  const thinkingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Audio feedback
  const {
    playKeysTapping,
    startThinkingLoop,
    stopThinkingLoop,
    stopStreamingAudio,
    playChime,
  } = useAudioFeedback();
  const hasPlayedKeysTappingRef = useRef(false);
  const hasStartedThinkingLoopRef = useRef(false);

  // Track if deployToShipperCloud was called during this generation
  // Used to skip advisor suggestions when deployment was triggered
  const deployToShipperCloudCalledRef = useRef(false);

  // Use refs to avoid re-renders when callbacks change
  const onFragmentCreatedRef = useRef(onFragmentCreated);
  const onGenerationStateChangeRef = useRef(onGenerationStateChange);
  const onGenerationCompleteRef = useRef(onGenerationComplete);
  const onSendMessageReadyRef = useRef(onSendMessageReady);
  const onCodingCompleteRef = useRef(onCodingComplete);

  // Jotai atom setter for sandbox preview URL
  const setSandboxPreviewUrl = useSetAtom(setSandboxPreviewUrlAtom);

  // Visual editing mode state
  const [visualEditingMode, setVisualEditingMode] = useAtom(
    visualEditingModeAtom,
  );

  // Toggle visual editing mode
  const toggleVisualEditingMode = useCallback(() => {
    const newMode = !visualEditingMode;
    setVisualEditingMode(newMode);

    // Get the preview iframe and send message to toggle visual editor
    const iframe = document.querySelector(
      'iframe[title="Preview"]',
    ) as HTMLIFrameElement;

    console.log(
      "[Chat] Toggle visual editing mode:",
      newMode,
      "iframe:",
      iframe,
    );

    if (iframe?.contentWindow) {
      const message = {
        type: newMode ? "ENABLE_VISUAL_EDIT" : "DISABLE_VISUAL_EDIT",
      };
      console.log("[Chat] Sending message to iframe:", message);
      iframe.contentWindow.postMessage(message, "*");
    } else {
      console.warn("[Chat] Preview iframe not found or not ready");
      toast.error("Preview not ready. Please wait for the preview to load.");
    }
  }, [visualEditingMode, setVisualEditingMode]);

  // Update refs when callbacks change
  useEffect(() => {
    onFragmentCreatedRef.current = onFragmentCreated;
    onGenerationStateChangeRef.current = onGenerationStateChange;
    onGenerationCompleteRef.current = onGenerationComplete;
    onSendMessageReadyRef.current = onSendMessageReady;
    onCodingCompleteRef.current = onCodingComplete;
  }, [
    onFragmentCreated,
    onGenerationStateChange,
    onGenerationComplete,
    onSendMessageReady,
    onCodingComplete,
  ]);

  const queryClient = useQueryClient();
  const trpc = useTRPC();

  // Get user's credit balance
  const { data: credits, isLoading: isLoadingCredits } = useQuery(
    trpc.credits.getMyCredits.queryOptions(),
  );

  // Check if user has never paid (for showing appropriate toast)
  const { data: hasNeverPaidData, isLoading: isLoadingNeverPaid } = useQuery(
    trpc.credits.hasNeverPaid.queryOptions(),
  );

  // Debounced fragment refresh function using usehooks-ts
  const debouncedFragmentRefresh = useDebounceCallback(
    async () => {
      try {
        console.log("Debounced fragment refresh triggered");

        // Use refetchQueries with more specific targeting
        await queryClient.refetchQueries({
          queryKey: trpc.projects.getV2Fragments.queryKey({
            projectId,
            limit: 20,
          }),
          type: "active",
        });

        // Note: onFragmentCreated callback removed to prevent cascading loop
        // The callback should only be triggered by actual fragment creation events,
        // not by query refreshes
      } catch (error) {
        // Ignore cancelled errors during rapid updates
        if (error instanceof Error && error.name !== "CancelledError") {
          console.error("Fragment refresh error:", error);
        }
      }
    },
    500, // 500ms debounce delay
  );

  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const seedPromptParam = searchParams.get("seed");
  const promptParam = searchParams.get("prompt");

  // Clear the prompt URL param after consuming it (to prevent it persisting on refresh)
  useEffect(() => {
    if (initialPrompt && !hasConsumedInitialPrompt && promptParam) {
      setHasConsumedInitialPrompt(true);
      // Remove the prompt param from URL without triggering navigation
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.delete("prompt");
      const newUrl = newParams.toString()
        ? `${pathname}?${newParams.toString()}`
        : pathname;
      router.replace(newUrl, { scroll: false });
    }
  }, [
    initialPrompt,
    hasConsumedInitialPrompt,
    promptParam,
    pathname,
    searchParams,
    router,
  ]);

  // Fetch chat token once on mount for direct API calls (bypasses Vercel proxy)
  useEffect(() => {
    if (chatTokenFetchedRef.current) return;
    chatTokenFetchedRef.current = true;

    fetch("/api/get-chat-token")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data?.token) {
          chatTokenRef.current = data.data.token;
          console.log("[Chat] Chat token fetched for direct API calls");
        } else {
          console.error("[Chat] Failed to get chat token:", data.error);
        }
      })
      .catch((err) => {
        console.error("[Chat] Failed to fetch chat token:", err);
      });
  }, []);

  // Track shouldResume prop changes to debug resumption issues
  const previousShouldResumeRef = useRef(shouldResume);
  useEffect(() => {
    if (previousShouldResumeRef.current !== shouldResume) {
      console.log("[Chat] 🔄 shouldResume prop changed:", {
        previous: previousShouldResumeRef.current,
        current: shouldResume,
        projectId,
      });
      previousShouldResumeRef.current = shouldResume;
    }
  }, [shouldResume, projectId]);

  // Check for insufficient credits with proper null safety
  // During loading, treat as having sufficient credits to avoid blocking UI
  const hasInsufficientCredits =
    !isLoadingCredits &&
    credits !== undefined &&
    credits.user !== undefined &&
    credits.user.creditBalance < 1;

  // Determine if user is a "free user" who has never paid
  // Uses the hasNeverPaid procedure which checks actual transaction history
  const isFreeUser = hasNeverPaidData?.hasNeverPaid ?? false;

  // Character count tracking using reusable hook
  const {
    charCount,
    isApproachingLimit,
    isOverLimit,
    charsRemaining,
    limit,
    warningThreshold,
  } = useCharacterLimit(input);

  // Determine if this is an existing project
  const isExistingProject = useMemo(() => {
    return initialMessages.length > 0;
  }, [initialMessages.length]);

  // Debug logging for initial messages
  // Debug logging for initial messages - only log when messages actually change
  const prevInitialMessagesRef = useRef<string>("");
  // Track if the user explicitly stopped the generation to avoid running post-finish side-effects
  const userStoppedRef = useRef(false);
  useEffect(() => {
    const currentIds = initialMessages.map((m) => m.id).join(",");
    if (prevInitialMessagesRef.current !== currentIds) {
      console.log("[Chat] Initial messages updated:", {
        count: initialMessages.length,
        shouldResume,
        firstMessage: initialMessages[0]
          ? {
              role: initialMessages[0].role,
              id: initialMessages[0].id,
              contentPreview:
                initialMessages[0].parts?.[0]?.type === "text"
                  ? (initialMessages[0].parts[0] as any).text?.substring(0, 50)
                  : "non-text",
            }
          : "none",
        lastMessage: initialMessages[initialMessages.length - 1]
          ? {
              role: initialMessages[initialMessages.length - 1].role,
              id: initialMessages[initialMessages.length - 1].id,
            }
          : "none",
      });
      prevInitialMessagesRef.current = currentIds;
    }
  }, [initialMessages, shouldResume]);

  // Create a unique instance ID for this component
  const instanceId = useRef(generateUUID());

  // Track if this instance can resume
  const [canResume, setCanResume] = useState(false);

  // Register this instance and determine if it can resume
  // CRITICAL: Use useLayoutEffect to run synchronously before paint
  // CRITICAL: Only run on mount/unmount - DO NOT re-run when shouldResume changes
  useLayoutEffect(() => {
    const currentInstance = activeChatInstances.get(projectId);

    console.log("[Chat] Registration check:", {
      instanceId: instanceId.current.substring(0, 8),
      projectId,
      shouldResume,
      currentInstance: currentInstance?.substring(0, 8),
      canTakeOwnership: !currentInstance,
    });

    if (!currentInstance) {
      // No instance owns this project - take ownership
      activeChatInstances.set(projectId, instanceId.current);
      setCanResume(true);
      console.log("[Chat] ✅ Registered instance - WILL RESUME");
    } else if (currentInstance === instanceId.current) {
      // We already own this project (shouldn't happen but handle it)
      setCanResume(true);
      console.log("[Chat] ✅ Already registered - WILL RESUME");
    } else {
      // Another instance owns this project - don't resume
      setCanResume(false);
      console.log("[Chat] ❌ Another instance active - BLOCKING RESUME");
    }

    // Cleanup: Remove ownership on unmount ONLY
    return () => {
      if (activeChatInstances.get(projectId) === instanceId.current) {
        console.log("[Chat] 🧹 Cleanup - releasing ownership:", {
          projectId,
          instanceId: instanceId.current.substring(0, 8),
          isNavigatingAway,
        });
        activeChatInstances.delete(projectId);
      }
    };
  }, [projectId]); // ✅ REMOVED shouldResume from dependencies - only react to projectId changes

  // Additional cleanup: Release ownership immediately when user navigates away
  // This prevents the stream from trying to reconnect during navigation
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isNavigatingAway) {
        // User is navigating away and page is hidden - release ownership immediately
        if (activeChatInstances.get(projectId) === instanceId.current) {
          console.log(
            "[Chat] 🚫 Navigation detected - immediately releasing ownership:",
            {
              projectId,
              instanceId: instanceId.current.substring(0, 8),
            },
          );
          activeChatInstances.delete(projectId);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [projectId]);

  // DISABLED: Re-evaluation of resume can cause reconnection issues
  // The initial registration in useLayoutEffect is sufficient
  // If shouldResume changes mid-stream, we should NOT attempt to reconnect
  // as this causes duplicate streams and breaks the active connection
  //
  // useEffect(() => {
  //   if (shouldResume && !canResume) {
  //     const currentInstance = activeChatInstances.get(projectId);
  //     if (!currentInstance) {
  //       console.log(
  //         "[Chat] 🔄 Re-evaluating resume after shouldResume change - taking ownership",
  //       );
  //       activeChatInstances.set(projectId, instanceId.current);
  //       setCanResume(true);
  //     } else if (currentInstance === instanceId.current) {
  //       console.log(
  //         "[Chat] 🔄 Re-evaluating resume after shouldResume change - already own",
  //       );
  //       setCanResume(true);
  //     }
  //   }
  // }, [shouldResume, canResume, projectId]);

  // Resume only if we own this project AND user is not navigating away
  // Safe to update normally since we removed the projectData refetch in handleSubmit
  // that was causing mid-stream shouldResume changes (the root cause of duplicates)
  // IMPORTANT: Never attempt resume if user is navigating away - this breaks the connection
  const enableResume = shouldResume && canResume && !isNavigatingAway;

  // Prevent auto-resume if user previously aborted on this project (persists across reloads)
  const abortedFlagKey = useMemo(
    () => `chat-aborted:${projectId}`,
    [projectId],
  );

  const apiServerUrl =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  // Initialize chat with optimized settings
  const { sendMessage, messages, status, addToolResult, stop, setMessages } =
    useChat({
      id, // use the provided chat ID
      experimental_throttle: 100,
      transport: new DefaultChatTransport({
        api: `${apiServerUrl}/api/v1/chat`,
        prepareSendMessagesRequest: ({ messages }) => {
          // send only the last message and chat id
          // we will then fetch message history (for our chatId) on server
          // and append this message for the full context to send to the model
          const lastMessage = messages[messages.length - 1];
          return {
            body: {
              message: lastMessage,
              projectId,
            },
          };
        },
        // Configure stream resumption (direct to API server)
        prepareReconnectToStreamRequest: () => {
          return {
            api: `${apiServerUrl}/api/v1/chat/${projectId}/stream`,
          };
        },
        // Custom fetch with x-chat-token header for authentication
        fetch: async (input, init) => {
          // Read from ref to get latest token value (avoids closure stale state)
          const token = chatTokenRef.current;

          console.log("[Chat] Direct API fetch:", {
            url: input,
            method: init?.method,
            hasToken: !!token,
            tokenValue: token ? `${token.substring(0, 20)}...` : "null",
          });

          // If no token available, try to fetch it now (fallback for race condition)
          if (!token) {
            console.warn("[Chat] No token available, attempting to fetch...");
            try {
              const tokenRes = await fetch("/api/get-chat-token");
              const tokenData = await tokenRes.json();
              if (tokenData.success && tokenData.data?.token) {
                chatTokenRef.current = tokenData.data.token;
                console.log("[Chat] Token fetched on-demand successfully");
              } else {
                console.error(
                  "[Chat] On-demand token fetch failed:",
                  tokenData.error,
                );
              }
            } catch (err) {
              console.error("[Chat] On-demand token fetch error:", err);
            }
          }

          // Build headers with chat token for authentication
          const headers = new Headers(init?.headers);
          const finalToken = chatTokenRef.current;
          if (finalToken) {
            headers.set("x-chat-token", finalToken);
          } else {
            console.error(
              "[Chat] CRITICAL: No auth token available for API request!",
            );
          }
          headers.set("Content-Type", "application/json");

          const response = await fetch(input, {
            ...init,
            headers,
            credentials: "include", // Include cookies as fallback
          });

          console.log("[Chat] Response:", {
            status: response.status,
            ok: response.ok,
          });

          return response;
        },
      }),
      resume: enableResume,
      // Remove onData since we're now using text messages for sandbox status
      onError: (error) => {
        console.error("[Chat] Stream error:", error);

        // Detect network errors (including iOS Safari "Load failed")
        const errorMsg = error.message?.toLowerCase() || "";
        const isLoadFailed =
          error instanceof TypeError && error.message === "Load failed";
        const isNetworkError =
          isLoadFailed || // iOS Safari specific error
          errorMsg.includes("networkerror") ||
          errorMsg.includes("network error") ||
          errorMsg.includes("econnrefused") ||
          errorMsg.includes("enotfound") ||
          errorMsg.includes("net::err_") ||
          !navigator.onLine; // Browser reports offline

        if (isNetworkError) {
          toast.error(
            "Network error - please reload the page and retry when your internet connection improves",
            { duration: 8000 },
          );
          return;
        }

        // Show specific error for insufficient credits
        if (
          error.message?.includes("PAYMENT_REQUIRED") ||
          error.message?.includes("Insufficient credits") ||
          error.message?.includes("Minimum balance")
        ) {
          const isMinimumBalance = error.message?.includes("Minimum balance");

          // Try to parse the error message to extract just the "message" field
          let description =
            "You've run out of credits.\nUpgrade your plan or purchase more credits to continue\nbuilding amazing projects.";

          if (isMinimumBalance) {
            description =
              "Upgrade your plan or purchase more credits to continue\nbuilding amazing projects.";
          }

          // Show different toast based on whether user is free or paid
          if (isFreeUser) {
            // Free user who never paid
            showNeedPaidPlanToast({
              onUpgrade: () => setIsPricingModalOpen(true),
            });
          } else {
            // Paid user who ran out of credits
            showInsufficientCreditsToast({
              onUpgrade: () => setIsPricingModalOpen(true),
              title: "Insufficient Credits",
              description,
            });
          }
        } else {
          toast.error(
            error.message || "An error occurred while processing your message",
          );
        }
      },
      onFinish: async () => {
        // If the user pressed Stop, skip post-finish refresh and callbacks
        if (userStoppedRef.current) {
          userStoppedRef.current = false;
          return;
        }
        // When AI generation finishes, refresh fragments and project data
        // This ensures we pick up any new fragments and updated activeFragmentId
        console.log(
          "[Chat] AI generation finished - refreshing fragments and project data",
        );

        // Sandbox status will automatically hide when status changes to "ready"
        // due to the conditional rendering based on status

        try {
          // Use debounced refresh to update fragments list
          debouncedFragmentRefresh();

          // CRITICAL: Use invalidateQueries instead of refetchQueries to avoid triggering Suspense
          // The parent uses useSuspenseQuery, so refetchQueries would suspend and remount Chat
          queryClient.invalidateQueries({
            queryKey: trpc.messages.getManyV2.queryKey({ projectId }),
          });

          queryClient.invalidateQueries({
            queryKey: trpc.projects.getOne.queryKey({ projectId }),
          });

          // Trigger fragment creation callback to notify parent components
          if (onFragmentCreatedRef.current) {
            console.log(
              "[Chat] Triggering onFragmentCreated callback after generation finish",
            );
            onFragmentCreatedRef.current();
          }

          // Trigger HAL suggestions after generation completes
          // Skip if deployToShipperCloud was called - no need for suggestions after deployment
          if (deployToShipperCloudCalledRef.current) {
            console.log(
              "[Chat] Skipping advisor suggestions - deployToShipperCloud was used",
            );
            deployToShipperCloudCalledRef.current = false; // Reset for next generation
          } else if (onGenerationCompleteRef.current) {
            console.log(
              "[Chat] Triggering onGenerationComplete callback for HAL suggestions",
            );
            onGenerationCompleteRef.current();
          }
        } catch (error) {
          if (error instanceof Error && error.name !== "CancelledError") {
            console.error(
              "[Chat] Error refreshing data after generation finish:",
              error,
            );
          }
        }
      },
      onToolCall: ({ toolCall }) => {
        console.log("tool call", toolCall);

        // Track deployToShipperCloud calls to skip advisor suggestions after deployment
        if (toolCall.toolName === "deployToShipperCloud") {
          console.log(
            "[Chat] deployToShipperCloud tool called - will skip advisor suggestions",
          );
          deployToShipperCloudCalledRef.current = true;
        }

        // Handle getSandboxUrl tool calls that need special processing
        if (toolCall.toolName === "getSandboxUrl") {
          // Note: toolCall.input is empty for getSandboxUrl since it takes no parameters
          // The actual URL will be in the tool output when the tool execution completes
          console.log(
            "[Chat] getSandboxUrl tool called - URL will be available in tool output",
          );
        }
      },
    });
  // Small helper to stop generation and notify API
  const stopGeneration = useCallback(async () => {
    try {
      userStoppedRef.current = true;
      if (typeof window !== "undefined") {
        sessionStorage.setItem(abortedFlagKey, "1");
      }

      // Immediately notify parent that generation stopped and coding is NOT complete
      onGenerationStateChangeRef.current?.(false);
      onCodingCompleteRef.current?.(false);

      // Clear all user message loading states
      setUserMessageStatuses((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((key) => {
          if (updated[key] === "setting-up") {
            updated[key] = "ready";
          }
        });
        return updated;
      });

      stop();

      // Fire-and-forget DELETE to server to cancel stream
      const tokenResponse = await fetch("/api/get-chat-token");
      const tokenData = await tokenResponse.json();
      const token = tokenData.data?.token || "";
      const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      await fetch(`${base}/api/v1/chat/${projectId}/stream`, {
        method: "DELETE",
        headers: { "x-chat-token": token },
      });
    } catch (error) {
      console.error("[Chat] Failed to stop generation", error);
    }
  }, [abortedFlagKey, projectId, stop]);
  // Track the initial status to prevent cleanup on mount
  const initialStatusRef = useRef(status);

  // Calculate generation state
  const isGenerating = status === "streaming" || status === "submitted";

  // Compute sandbox loading banner visibility and status
  const sandboxLoadingState = useMemo(() => {
    // NEVER show banner when AI is actively responding
    if (isGenerating) {
      return { show: false, status: "initializing" as const };
    }

    // Only show for existing projects
    if (!isExistingProject) {
      return { show: false, status: "initializing" as const };
    }

    // Scenario 1: Coding just completed - show "Coding is done!" banner
    // This appears after AI finishes streaming and before content loads
    // Show whenever isCodingComplete is true (regardless of hasActualContent from previous state)
    if (isCodingComplete) {
      return { show: true, status: "coding-complete" as const };
    }

    // Scenario 2: Sandbox is recovering (only when uiState allows banner)
    if (isRecovering && uiState === "waitingForContent") {
      return { show: true, status: "recovering" as const };
    }

    // Scenario 3: "Project is waking up" - only show when:
    // - uiState is "waitingForContent" or "awaitingSandbox" (preview loading animation finished)
    // - Sandbox is initializing/waking up
    // - Not during coding complete phase
    const shouldShowWakingUp =
      (uiState === "waitingForContent" || uiState === "awaitingSandbox") &&
      !isCodingComplete &&
      (buildStatus === "INITIALIZING" ||
        buildStatus === "AWAITING_SANDBOX" ||
        isWaitingForContent ||
        isFetchingPreviewAuth ||
        (!sandboxReady &&
          (sandboxStatus === "building" ||
            sandboxStatus === "needs-attention")));

    if (shouldShowWakingUp) {
      return { show: true, status: "initializing" as const };
    }

    // Default: hide banner
    return { show: false, status: "initializing" as const };
  }, [
    isGenerating,
    isExistingProject,
    isCodingComplete,
    isRecovering,
    buildStatus,
    sandboxReady,
    sandboxStatus,
    isWaitingForContent,
    isFetchingPreviewAuth,
    uiState,
  ]);

  // Additional cleanup: Release ownership when stream completes
  // This provides defense-in-depth in case component doesn't unmount
  // Only release if status actually transitioned to ready (not already ready on mount)
  useEffect(() => {
    // Don't release if we started with ready/error status (navigation case)
    if (
      status === initialStatusRef.current &&
      (status === "ready" || status === "error")
    ) {
      console.log(
        "[Chat] Skipping cleanup - status was already ready/error on mount",
      );
      return;
    }

    if (
      (status === "ready" || status === "error") &&
      activeChatInstances.get(projectId) === instanceId.current
    ) {
      console.log("[Chat] Stream ended - releasing ownership:", {
        projectId,
        status,
        instanceId: instanceId.current.substring(0, 8),
      });
      activeChatInstances.delete(projectId);
    }
  }, [status, projectId]);

  // Track if we're currently resuming to prevent message sync from interfering
  const isResumingRef = useRef(false);

  // Track previous enableResume to detect when it changes from false to true
  const previousEnableResumeRef = useRef(enableResume);

  // Track when we're resuming based on enableResume and status
  useEffect(() => {
    if (enableResume && status !== "ready") {
      // Mark that we're in resume mode
      isResumingRef.current = true;
      console.log("[Chat] Resume mode active - protecting message sync");
    } else if (status === "ready") {
      // Clear resume mode when stream ends
      isResumingRef.current = false;
      console.log("[Chat] Resume mode cleared - stream ended");
    }
  }, [enableResume, status]);

  // Log when enableResume changes to help debug resumption issues
  // This helps identify when shouldResume becomes true after projectData loads
  useEffect(() => {
    const previousEnableResume = previousEnableResumeRef.current;
    previousEnableResumeRef.current = enableResume;

    if (previousEnableResume !== enableResume) {
      console.log("[Chat] 🔄 enableResume changed:", {
        previous: previousEnableResume,
        current: enableResume,
        shouldResume,
        canResume,
        status,
        messagesCount: messages.length,
      });

      // If enableResume changed from false to true, log additional info
      if (!previousEnableResume && enableResume) {
        console.log(
          "[Chat] ✅ Resumption enabled - useChat should attempt to resume stream",
        );
      }
    }
  }, [enableResume, shouldResume, canResume, status, messages.length]);

  // Debug logging for status changes
  useEffect(() => {
    console.log("[Chat] Status changed:", status, {
      enableResume,
      messagesCount: messages.length,
    });
  }, [status]);

  // Throttled debug logging for messages from useChat
  // Only log occasionally during streaming to avoid console spam
  useEffect(() => {
    // Only log on status changes or significant message count changes
    // Don't log on every chunk during streaming
    if (status !== "streaming") {
      console.log("[Chat] Messages updated:", {
        count: messages.length,
        status,
        enableResume,
        lastMessage: messages[messages.length - 1]
          ? {
              role: messages[messages.length - 1].role,
              id: messages[messages.length - 1].id,
              partsCount: messages[messages.length - 1].parts.length,
            }
          : "none",
      });
    }
  }, [messages.length, status, enableResume]); // Use messages.length instead of messages

  // Track if we've synced on mount to prevent race conditions
  const hasSyncedOnMount = useRef(false);
  const lastSyncedIdsRef = useRef<string>("");

  // Reset sync guards when navigating between projects
  useEffect(() => {
    hasSyncedOnMount.current = false;
    lastSyncedIdsRef.current = "";
  }, [projectId]);

  // Sync initialMessages to useChat messages when they change and we're not generating
  // Handles browser navigation, Fast Refresh, and stream resumption edge cases
  useEffect(() => {
    const initialIds = initialMessages.map((m) => m.id).join(",");
    const currentIds = messages.map((m) => m.id).join(",");

    // Debug: Check for duplicate IDs in messages array
    const messageIds = messages.map((m) => m.id);
    const uniqueMessageIds = new Set(messageIds);
    if (messageIds.length !== uniqueMessageIds.size) {
      console.error("[Chat] ⚠️ DUPLICATE MESSAGE IDS DETECTED!", {
        totalMessages: messageIds.length,
        uniqueMessages: uniqueMessageIds.size,
        duplicates: messageIds.filter(
          (id, index) => messageIds.indexOf(id) !== index,
        ),
        allIds: messageIds,
      });
    }

    // Initial mount (or Fast Refresh first pass)
    if (!hasSyncedOnMount.current) {
      if (initialMessages.length > 0 && messages.length === 0) {
        console.log("[Chat] Syncing initialMessages on mount", {
          initialCount: initialMessages.length,
        });
        setMessages(initialMessages);
        lastSyncedIdsRef.current = initialIds;
      }

      // Mark mount sync complete even if there were no messages
      hasSyncedOnMount.current = true;
      return;
    }

    // Fast Refresh recovery: messages cleared but new initialMessages available
    if (
      messages.length === 0 &&
      initialMessages.length > 0 &&
      lastSyncedIdsRef.current !== initialIds
    ) {
      console.log("[Chat] Re-syncing after environment reload", {
        initialCount: initialMessages.length,
      });
      setMessages(initialMessages);
      lastSyncedIdsRef.current = initialIds;
      return;
    }

    if (status !== "ready") {
      return;
    }

    if (isResumingRef.current) {
      console.log("[Chat] Skipping sync - currently resuming stream");
      return;
    }

    if (initialIds && initialIds !== currentIds) {
      if (initialMessages.length >= messages.length) {
        console.log("[Chat] Syncing initialMessages to useChat messages", {
          initialCount: initialMessages.length,
          currentCount: messages.length,
        });
        setMessages(initialMessages);
        lastSyncedIdsRef.current = initialIds;
      } else {
        console.log("[Chat] Skipping sync - initialMessages appears stale", {
          initialCount: initialMessages.length,
          currentCount: messages.length,
        });
      }
    }
  }, [initialMessages, messages, status, setMessages]);
  // Track generation state and notify parent component
  // Only notify when generation actually starts (submitted) or stops (ready)
  useEffect(() => {
    if (status === "submitted") {
      // Generation started - reset coding complete state
      onGenerationStateChangeRef.current?.(true);
      onCodingCompleteRef.current?.(false);

      // Reset deploy tool tracking for new generation
      deployToShipperCloudCalledRef.current = false;

      // Find the last user message
      const lastUserMessage = messages
        .slice()
        .reverse()
        .find((m) => m.role === "user");

      if (lastUserMessage && !userMessageStatuses[lastUserMessage.id]) {
        setUserMessageStatuses((prev) => ({
          ...prev,
          [lastUserMessage.id]: "setting-up",
        }));
      }
    } else if (status === "ready") {
      // Generation stopped
      onGenerationStateChangeRef.current?.(false);

      // Only signal coding complete if user didn't manually stop
      // If user stopped, we already handled this in stopGeneration
      if (!userStoppedRef.current) {
        // Signal that coding is complete immediately after streaming ends
        // This will show "Coding is done!" banner while waiting for content to load
        onCodingCompleteRef.current?.(true);
      }

      // Stop all audio when AI finishes responding
      stopStreamingAudio();

      // Play chime only if AI was responding (keys tapping was played)
      // Don't play chime if user manually stopped
      if (hasPlayedKeysTappingRef.current && !userStoppedRef.current) {
        playChime();
      }

      // Reset audio state
      hasPlayedKeysTappingRef.current = false;
      hasStartedThinkingLoopRef.current = false;
    }
  }, [status, stopStreamingAudio, playChime]);

  // Handle streaming status separately for user message status updates and audio
  useEffect(() => {
    if (status === "streaming") {
      // Play keys tapping once when streaming begins
      if (!hasPlayedKeysTappingRef.current) {
        playKeysTapping();
        hasPlayedKeysTappingRef.current = true;
      }

      // Check if there are any tool calls in the messages
      const hasToolCalls = messages.some((message) => {
        if (message.role === "assistant" && message.parts) {
          return message.parts.some((part) => part.type.startsWith("tool-"));
        }
        return false;
      });

      // Start thinking loop when tool calls begin
      if (hasToolCalls && !hasStartedThinkingLoopRef.current) {
        startThinkingLoop();
        hasStartedThinkingLoopRef.current = true;
      }

      const lastUserMessage = messages
        .slice()
        .reverse()
        .find((m) => m.role === "user");

      if (
        lastUserMessage &&
        userMessageStatuses[lastUserMessage.id] === "setting-up"
      ) {
        setUserMessageStatuses((prev) => ({
          ...prev,
          [lastUserMessage.id]: "ready",
        }));
      }
    }
  }, [
    status,
    messages,
    userMessageStatuses,
    playKeysTapping,
    startThinkingLoop,
  ]);

  // Trigger initial generation if seed prompt is provided
  useEffect(() => {
    const seed = seedPromptParam?.trim();
    if (!projectId || !seed || seed.length === 0) return;
    if (status !== "ready") return;
    if (initialMessages?.length !== 0) return;
    if (shouldResume) return;
    if (!hasSyncedOnMount.current) return;
    console.log("projectId", projectId);
    console.log("seed", seed);
    console.log("status", status);
    console.log("initialMessages", initialMessages);

    const dedupeKey = `seedSent:${projectId}:${seed}`;

    // If we've already sent this seed for this project in this tab, skip
    // UNLESS we're resuming a stream (in which case the connection was lost and seed might need re-sending)
    // But if we're resuming AND have messages, don't re-send (stream already has them)
    try {
      if (typeof window !== "undefined" && sessionStorage.getItem(dedupeKey)) {
        // If we're resuming a stream but have no messages, allow re-sending the seed
        // This handles the case where navigation broke the connection before seed was processed
        if (enableResume && messages.length === 0) {
          console.log(
            "[Chat] Resuming stream with no messages - clearing seed dedupe to allow re-send",
          );
          sessionStorage.removeItem(dedupeKey);
          // Continue to send the seed below
        } else {
          // Already sent and either not resuming, or resuming with messages
          setSeedPromptSent(true);

          // Ensure the seed param is removed from URL
          const nextParams = new URLSearchParams(searchParams.toString());
          if (nextParams.has("seed")) {
            nextParams.delete("seed");
            const nextUrl = `${pathname}${
              nextParams.size ? `?${nextParams.toString()}` : ""
            }`;
            router.replace(nextUrl);
          }
          return;
        }
      }
    } catch {}

    console.log("[Chat] Sending seed prompt", seed);

    // Check for stored files from GenerativeChatInput
    let storedFiles: Array<{ url: string; type: string; name?: string }> = [];
    try {
      // Try new format first (files), then fall back to old format (images)
      const fileKey = `project-${projectId}-files`;
      const imageKey = `project-${projectId}-images`;
      const storedData =
        sessionStorage.getItem(fileKey) || sessionStorage.getItem(imageKey);
      if (storedData) {
        storedFiles = JSON.parse(storedData);
        // Clean up after reading
        sessionStorage.removeItem(fileKey);
        sessionStorage.removeItem(imageKey);
        console.log("[Chat] Found stored files:", storedFiles.length);
      }
    } catch (error) {
      console.error("[Chat] Failed to retrieve stored files:", error);
    }

    // Build message parts with text and any stored files
    const parts = [
      { type: "text" as const, text: seed },
      ...storedFiles.map((file) => ({
        type: "file" as const,
        mediaType: file.type || "application/octet-stream",
        url: file.url || "",
        name: file.name,
      })),
    ];

    sendMessage({ parts });
    setSeedPromptSent(true);

    try {
      if (typeof window !== "undefined") {
        sessionStorage.setItem(dedupeKey, "1");
      }
    } catch {}

    // Remove the seed param to prevent duplicate send in React Strict Mode
    try {
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.delete("seed");
      const nextUrl = `${pathname}${
        nextParams.size ? `?${nextParams.toString()}` : ""
      }`;
      router.replace(nextUrl);
    } catch (err) {
      // Fallback if router is unavailable for any reason
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("seed");
        window.history.replaceState({}, "", url.toString());
      } catch {}
    }
  }, [
    seedPromptParam,
    sendMessage,
    seedPromptSent,
    status,
    projectId,
    enableResume,
    pathname,
    searchParams,
    router,
    messages.length,
  ]);

  // Trigger error detection when project loads (after sandbox is ready)

  // Watch for fragment-related tool calls and refresh fragments list
  // Only process tool completions when streaming is finished (status is ready)
  useEffect(() => {
    // Only check for tool completions when not actively streaming
    if (status !== "ready") {
      return;
    }

    const lastMessage = messages[messages.length - 1];
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
        debouncedFragmentRefresh();

        // Also trigger fragment creation callback to load the new fragment
        if (onFragmentCreatedRef.current) {
          console.log("[Chat] Triggering onFragmentCreated callback");
          onFragmentCreatedRef.current();
        }
      }
    }
  }, [messages, debouncedFragmentRefresh, status]);

  useEffect(() => {
    if (status !== "ready") {
      return;
    }

    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === "assistant") {
      for (const part of lastMessage.parts) {
        if (
          part.type === "tool-getSandboxUrl" &&
          part.state === "output-available"
        ) {
          const toolCallId = (part as any).toolCallId;
          const output = (part as any).output;
          const shouldRefresh = output?.shouldRefreshPreview && output?.url;

          if (
            toolCallId &&
            shouldRefresh &&
            !processedToolCallIds.current.has(toolCallId)
          ) {
            processedToolCallIds.current.add(toolCallId);
            console.log(
              "[Chat] getSandboxUrl tool completed - updating sandbox preview atom",
            );

            setSandboxPreviewUrl({
              url: output.url,
              authenticatedUrl: output.authenticatedUrl,
              token: output.token,
              timestamp: Date.now(),
              shouldRefresh: true,
            });
          }
        }
      }
    }
  }, [messages, status, setSandboxPreviewUrl]);

  useEffect(() => {
    if (status === "ready") {
      inputRef?.current?.focus();
    }
  }, [status]);

  // Clear processed tool calls when messages are reset/cleared
  useEffect(() => {
    if (messages.length === 0) {
      processedToolCallIds.current.clear();
    }
  }, [messages.length]);

  // Provide sendMessage function to parent component
  useEffect(() => {
    if (onSendMessageReadyRef.current && sendMessage) {
      onSendMessageReadyRef.current(sendMessage);
    }
  }, [sendMessage]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      // If AI is currently generating, stop it instead of submitting
      if (status === "submitted" || status === "streaming") {
        // Stop the client-side stream
        stop();

        // Also send DELETE request to notify server to cancel the stream
        (async () => {
          try {
            // Get chat token for authentication
            const tokenResponse = await fetch("/api/get-chat-token");
            const tokenData = await tokenResponse.json();
            const token = tokenData.data?.token || "";

            await fetch(
              `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/v1/chat/${projectId}/stream`,
              {
                method: "DELETE",
                headers: {
                  "x-chat-token": token,
                },
              },
            );
          } catch (error) {
            console.error(
              "[Chat] Failed to send stop signal to server:",
              error,
            );
          }
        })();
        return;
      }

      if (input.trim() || attachedImages.length > 0) {
        // Check if any files are still uploading
        const hasUploadingFiles = attachedImages.some(
          (file) => file.isUploading,
        );
        if (hasUploadingFiles) {
          toast.error("Please wait for files to finish uploading");
          return;
        }

        // Check credits before sending message
        if (hasInsufficientCredits) {
          // Show different toast based on whether user is free or paid
          if (isFreeUser) {
            // Free user who never upgraded
            showNeedPaidPlanToast({
              onUpgrade: () => setIsPricingModalOpen(true),
            });
          } else {
            // Paid user who ran out of credits
            showInsufficientCreditsToast({
              onUpgrade: () => setIsPricingModalOpen(true),
            });
          }
          return;
        }

        // Build message parts with text and files
        // Map unsupported MIME types to supported ones for AI SDK
        const mapMimeType = (mimeType: string): string => {
          // AI SDK supported types: image/*, application/pdf, text/*, audio/*, video/*
          if (
            mimeType.startsWith("image/") ||
            mimeType.startsWith("audio/") ||
            mimeType.startsWith("video/")
          ) {
            return mimeType;
          }
          if (mimeType === "application/pdf") {
            return mimeType;
          }
          // Preserve DOCX MIME type for document analysis
          if (
            mimeType ===
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          ) {
            return mimeType;
          }
          if (mimeType.startsWith("text/")) {
            return mimeType;
          }
          // For other unsupported types, use octet-stream
          return "application/octet-stream";
        };

        sendMessage({
          parts: [
            // Add text part if present
            ...(input.trim() ? [{ type: "text" as const, text: input }] : []),
            // Add file parts (images, PDFs, DOCX, code files, etc.)
            ...attachedImages.map((fileAttachment) => ({
              type: "file" as const,
              mediaType: mapMimeType(
                fileAttachment.file.type || "application/octet-stream",
              ),
              url: fileAttachment.url || fileAttachment.preview || "", // Use R2 URL if uploaded, fallback to preview
              name: fileAttachment.file.name, // Include filename for non-image files
            })),
          ],
        });
        setInput("");
        setAttachedImages([]);

        // Refresh credit balance after sending message
        queryClient.invalidateQueries({
          queryKey: ["credits", "getMyCredits"],
        });

        // REMOVED: Refetching projectData after message causes shouldResume prop to change mid-stream
        // This triggers duplicate stream connections. The data will be refreshed in onFinish instead.
      }
    },
    [
      input,
      attachedImages,
      sendMessage,
      hasInsufficientCredits,
      queryClient,
      status,
      stop,
      debouncedFragmentRefresh,
      projectId,
      trpc.projects.getOne,
    ],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);
    },
    [],
  );

  // Memoize the last user message index calculation to avoid recalculating on every render
  const lastUserMessageIndex = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        return i;
      }
    }
    return -1;
  }, [messages]);

  const thinkingMessage = useMemo<UIMessage>(() => {
    const lastUserMessageId =
      lastUserMessageIndex >= 0
        ? messages[lastUserMessageIndex]?.id
        : undefined;

    return {
      id: `thinking-placeholder-${lastUserMessageId ?? "default"}`,
      role: "assistant",
      parts: [],
      metadata: {
        isThinkingPlaceholder: true,
      },
    };
  }, [messages, lastUserMessageIndex]);

  const displayedMessages = useMemo(() => {
    // Filter out hidden system messages (used for migration triggers, etc.)
    const filterHiddenMessages = (msgs: typeof messages) =>
      msgs.filter((msg) => {
        if (msg.role !== "user") return true;
        const textPart = msg.parts?.find((p) => p.type === "text") as
          | { type: "text"; text: string }
          | undefined;
        return !textPart?.text?.startsWith("[SYSTEM_HIDDEN]");
      });

    const filteredMessages = filterHiddenMessages(messages);

    if (!showThinkingMessage) {
      return filterOutThinkingPlaceholder(filteredMessages);
    }

    return [...filterOutThinkingPlaceholder(filteredMessages), thinkingMessage];
  }, [messages, showThinkingMessage, thinkingMessage]);

  const awaitingAssistantResponse = useMemo(() => {
    if (!(status === "submitted" || status === "streaming")) {
      return false;
    }

    const lastMessage = messages[messages.length - 1];
    return !lastMessage || lastMessage.role !== "assistant";
  }, [messages, status]);

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

  useEffect(() => {
    return () => {
      if (thinkingTimeoutRef.current) {
        clearTimeout(thinkingTimeoutRef.current);
      }
    };
  }, []);

  // Show sandbox loading state only when user has not stopped the stream
  const showSandboxLoadingState =
    sandboxLoadingState.show && !!userStoppedRef.current;

  // Reset dismissed state when loading finishes (new checkpoint completed)
  const prevIsLoadingRef = useRef(isLoadingSuggestions);
  useEffect(() => {
    // When loading finishes (was loading, now not loading), reset dismissed state
    // This means new suggestions have arrived from a checkpoint
    if (
      prevIsLoadingRef.current &&
      !isLoadingSuggestions &&
      advisorSuggestions.length > 0
    ) {
      console.log(
        "[Chat] Suggestions loading finished, resetting dismissed state",
      );
      setHasDismissedStrip(false);
    }
    prevIsLoadingRef.current = isLoadingSuggestions;
  }, [isLoadingSuggestions, advisorSuggestions.length]);

  // Show advisor suggestions strip when suggestions are loaded (not loading)
  useEffect(() => {
    console.log("[Chat] Advisor strip visibility check:", {
      isLoadingSuggestions,
      suggestionsCount: advisorSuggestions.length,
      showAdvisorStrip,
      hasDismissedStrip,
    });
    if (
      !isLoadingSuggestions &&
      advisorSuggestions.length > 0 &&
      !showAdvisorStrip &&
      !hasDismissedStrip // Don't show if user dismissed it
    ) {
      console.log("[Chat] Showing advisor strip");
      setShowAdvisorStrip(true);
    }
    // Hide strip if suggestions are loading
    if (isLoadingSuggestions && showAdvisorStrip) {
      setShowAdvisorStrip(false);
    }
  }, [
    isLoadingSuggestions,
    advisorSuggestions.length,
    showAdvisorStrip,
    hasDismissedStrip,
  ]);

  // Handle suggestion click - send to builder chat
  const handleSuggestionClick = useCallback((prompt: string) => {
    setInput(prompt);
    // Focus the input
    inputRef.current?.focus();
  }, []);

  // Handle closing the advisor strip
  const handleCloseAdvisorStrip = useCallback(() => {
    setShowAdvisorStrip(false);
    setHasDismissedStrip(true); // Mark as dismissed to prevent reappearing
  }, []);

  // Note: StickToBottom component handles auto-scrolling internally
  // Manual scroll is not needed as the component will automatically stick to bottom
  // console.log(
  //   "showSandboxLoadingState",
  //   showSandboxLoadingState,
  //   userStoppedRef.current,
  // );
  return (
    <div className="min-h-0 flex-1">
      <div className="flex size-full h-full min-h-0 flex-col">
        <StickToBottom
          className="bg-prj-bg-primary scrollbar-hide relative min-h-0 flex-1 overflow-y-scroll px-0 pt-[18px]"
          initial="smooth"
          resize="smooth"
          role="log"
        >
          <StickToBottom.Content
            className={cn(
              "flex flex-col gap-[18px] px-[18px] pt-2 transition-all duration-200",
              showSandboxLoadingState && isExistingProject
                ? "mb-[40px]" // Add space when banner is visible to prevent overlap
                : showAdvisorStrip
                  ? "mb-[100px]" // Add space when suggestions strip is visible (~100px for strip + padding)
                  : "mb-[18px]",
            )}
          >
            {/* Migration HITL Card - shown when imported project needs backend migration */}
            {migrationCard?.show && (
              <div className="flex w-full justify-end">
                <MigrationHitlCard
                  platform={migrationCard.platform}
                  onApprove={migrationCard.onApprove}
                  onSkip={migrationCard.onSkip}
                />
              </div>
            )}

            {displayedMessages.map((message, messageIndex) => {
              const previousMessage = displayedMessages[messageIndex - 1];
              const shouldShowAssistantHeader =
                message.role === "assistant" &&
                previousMessage?.role === "user";

              return (
                <ChatMessage
                  key={`message-${message.id}`}
                  projectId={projectId}
                  message={message}
                  messageIndex={messageIndex}
                  lastUserMessageIndex={lastUserMessageIndex}
                  messages={displayedMessages}
                  shouldShowAssistantHeader={shouldShowAssistantHeader}
                  isStreaming={isGenerating}
                  onAddToolResult={addToolResult}
                  onSendMessage={(msg?: string) => {
                    if (msg) {
                      // Send a new message with content (for HITL confirmations)
                      // sendMessage expects {parts: [...]} format
                      sendMessage({
                        parts: [{ type: "text" as const, text: msg }],
                      });
                    } else {
                      // Send without content (legacy behavior)
                      sendMessage();
                    }
                  }}
                  shipperCloudEnabled={shipperCloudEnabled}
                  onOpenCloudCreditsModal={onOpenCloudCreditsModal}
                />
              );
            })}
          </StickToBottom.Content>
          <ScrollToBottomButton
            hasSuggestionsStrip={
              showAdvisorStrip && advisorSuggestions.length > 0
            }
          />
          <AdvisorStripAutoScroll showAdvisorStrip={showAdvisorStrip} />
        </StickToBottom>

        {/* Sandbox Loading Banner - shows when sandbox is initializing/building/recovering */}
        <SandboxLoadingBanner
          status={sandboxLoadingState.status}
          isExistingProject={isExistingProject}
          show={showSandboxLoadingState}
        />

        {/* Input container with Advisor Suggestions Strip positioned above */}
        <div
          className={cn(
            "relative z-10 mx-[18px] mb-4 flex-shrink-0 transition-all duration-200 ease-in-out",
            showSandboxLoadingState && isExistingProject && "-mt-[18px]",
          )}
        >
          {/* Advisor Suggestions Strip - shows after each checkpoint when preview loads */}
          <AdvisorSuggestionsStrip
            suggestions={advisorSuggestions}
            onSuggestionClick={handleSuggestionClick}
            onExploreMore={onToggleAdvisor || (() => {})}
            onClose={handleCloseAdvisorStrip}
            isVisible={showAdvisorStrip}
          />
          <PromptInput
            onSubmit={handleSubmit}
            className={cn(
              "relative z-10 transition-colors dark:border-[#2A3833] dark:bg-[#1A2421] dark:text-[#B8C9C3]",
              showSandboxLoadingState && isExistingProject
                ? "rounded-t-[16px] rounded-b-[16px]"
                : "",
              isOverLimit
                ? "border-red-500 focus-within:border-red-500 focus-within:ring-red-500/50"
                : isApproachingLimit
                  ? "border-orange-500 focus-within:border-orange-500 focus-within:ring-orange-500/50"
                  : "",
            )}
          >
            <ChatFileUpload
              files={attachedImages}
              onFilesChange={setAttachedImages}
              maxFiles={10}
              maxSize={10 * 1024 * 1024}
              onTriggerUpload={() => {
                // Store reference to trigger function
                const fileInput = document.querySelector(
                  'input[type="file"]',
                ) as HTMLInputElement;
                if (fileInput) {
                  fileInputTriggerRef.current = () => fileInput.click();
                }
              }}
            >
              <PromptInputTextarea
                data-chat-input
                placeholder={
                  isFirstImportLoading
                    ? "Loading your imported project..."
                    : hasInsufficientCredits
                      ? "Insufficient credits - Please purchase credits to continue"
                      : "Describe what you want to build..."
                }
                onChange={(e) => setInput(e.target.value)}
                value={input}
                disabled={hasInsufficientCredits || isFirstImportLoading}
                shouldPreventSubmit={
                  status === "submitted" || status === "streaming"
                }
              />
            </ChatFileUpload>
            <PromptInputToolbar className="mt-2 flex items-center justify-between gap-2">
              {/* Left side - conditionally show waveform or toolbar buttons */}
              {isVoiceRecording ? (
                <div className="flex flex-1 items-center gap-3">
                  {/* Waveform visualization */}
                  <div className="flex h-8 flex-1 items-center gap-[3px] rounded-full bg-[#1E9A80]/10 px-3 dark:bg-[#34D399]/10">
                    {voiceFrequencyData.slice(0, 30).map((value, i) => {
                      const height = Math.max(3, (value / 100) * 20);
                      return (
                        <div
                          key={i}
                          className="w-[2px] flex-shrink-0 rounded-full bg-[#1E9A80] transition-all duration-75 dark:bg-[#34D399]"
                          style={{
                            height: `${height}px`,
                          }}
                        />
                      );
                    })}
                  </div>
                  <span className="text-muted-foreground text-xs">
                    Recording...
                  </span>
                </div>
              ) : (
                <PromptInputTools className="flex items-center gap-2">
                  {/* File upload button (leading plus icon) */}
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-[32px] w-[32px] rounded-full border-[#F8F8F5] bg-white px-0 py-0 text-sm font-normal text-[#6C6B6B] shadow-[0px_1px_2px_rgba(18,26,43,0.05)] hover:border-[#1E9A80]/30 hover:bg-[#1E9A80]/5 dark:border-[#404040] dark:bg-[#2A2A2A] dark:text-[#A3A3A3] dark:shadow-[0px_1px_2px_rgba(0,0,0,0.3)] dark:hover:border-[#34D399]/40 dark:hover:bg-[#34D399]/10"
                    onClick={() => {
                      if (fileInputTriggerRef.current) {
                        fileInputTriggerRef.current();
                      }
                    }}
                    title="Attach files"
                  >
                    <Plus className="h-4 w-4 text-[#6c6b6b] dark:text-[#A3A3A3]" />
                  </Button>

                  {/* Visual editing toggle button */}
                  <Button
                    onClick={toggleVisualEditingMode}
                    variant="outline"
                    size="sm"
                    disabled={!sandboxReady || status === "submitted"}
                    className={cn(
                      "h-[32px] rounded-full border-[#F8F8F5] bg-white px-[13px] py-[9px] text-sm font-normal text-[#6C6B6B] shadow-[0px_1px_2px_rgba(18,26,43,0.05)] hover:border-[#1E9A80]/30 hover:bg-[#1E9A80]/5 dark:border-[#404040] dark:bg-[#2A2A2A] dark:text-[#A3A3A3] dark:shadow-[0px_1px_2px_rgba(0,0,0,0.3)] dark:hover:border-[#34D399]/40 dark:hover:bg-[#34D399]/10",
                      visualEditingMode &&
                        "border-[#1E9A80] bg-[#1E9A80]/5 text-[#145C4A] dark:border-[#34D399] dark:bg-[#34D399]/10 dark:text-[#BBF7D0]",
                    )}
                    type="button"
                  >
                    <img
                      src="/brush-4.svg"
                      alt="Paintbrush"
                      className="h-4 w-4"
                    />
                    <span>
                      {visualEditingMode ? "Exit Visual Edit" : "Visual Edit"}
                    </span>
                  </Button>

                  {/* Character counter */}
                  <CharacterCounter
                    charCount={charCount}
                    limit={2000}
                    warningThreshold={1800}
                  />

                  {hasInsufficientCredits && (
                    <div className="flex items-center gap-1 text-xs text-red-500">
                      <span>⚠️ Insufficient credits</span>
                      <button
                        onClick={() => setIsPricingModalOpen(true)}
                        className="text-blue-500 hover:underline"
                      >
                        Buy credits
                      </button>
                    </div>
                  )}
                </PromptInputTools>
              )}

              {/* Right side - DiscussButton, VoiceInput (Record), then Send button */}
              <div className="flex items-center gap-1.5">
                {!isVoiceRecording && (
                  <>
                    <DiscussButton onClick={onToggleAdvisor || (() => {})} />
                  </>
                )}

                <VoiceInput
                  onTranscript={(text) => {
                    const currentInput = input || "";
                    const newInput = currentInput
                      ? `${currentInput} ${text}`.trim()
                      : text;
                    setInput(newInput);

                    setTimeout(() => {
                      if (inputRef.current) {
                        inputRef.current.selectionStart = newInput.length;
                        inputRef.current.selectionEnd = newInput.length;
                        inputRef.current.focus();
                      }
                    }, 0);
                  }}
                  onLiveTranscript={(liveText) => {
                    const currentInput = initialVoiceTextRef.current;
                    const newInput = currentInput
                      ? `${currentInput} ${liveText}`.trim()
                      : liveText;
                    setInput(newInput);
                  }}
                  isAuthenticated={!!userId}
                  isPaidUser={
                    // While loading credits, treat as paid to avoid flash of "upgrade" message
                    isLoadingCredits ||
                    credits?.user?.membershipTier === "PRO" ||
                    credits?.user?.membershipTier === "ENTERPRISE"
                  }
                  onUpgradeClick={() => setIsPricingModalOpen(true)}
                  onAuthRequired={() => {
                    toast.error("Please sign in to use voice input");
                  }}
                  disabled={
                    hasInsufficientCredits ||
                    isOverLimit ||
                    isFirstImportLoading
                  }
                  onRecordingStateChange={(
                    recording,
                    processing,
                    level,
                    frequencyData,
                  ) => {
                    if (recording && !isVoiceRecording) {
                      initialVoiceTextRef.current = input || "";
                    }
                    setIsVoiceRecording(recording);
                    setIsVoiceProcessing(processing);
                    setAudioLevel(level || 0);
                    setVoiceFrequencyData(frequencyData || []);
                  }}
                  className="h-7 w-7"
                />

                {!isVoiceRecording && (
                  <PromptInputSubmit
                    disabled={
                      status === "submitted" || status === "streaming"
                        ? false
                        : (!input && attachedImages.length === 0) ||
                          hasInsufficientCredits ||
                          isOverLimit ||
                          isFirstImportLoading
                    }
                    status={status}
                    onStop={stopGeneration}
                    title={
                      isOverLimit
                        ? `Character limit exceeded (${charCount}/${limit})`
                        : hasInsufficientCredits
                          ? "Insufficient credits - 1 credit required per message"
                          : status === "submitted" || status === "streaming"
                            ? "Stop generation"
                            : "Send message"
                    }
                  />
                )}
              </div>
            </PromptInputToolbar>
          </PromptInput>
        </div>
      </div>

      <PricingModal
        isOpen={isPricingModalOpen}
        onClose={() => setIsPricingModalOpen(false)}
      />
    </div>
  );
}

// <Message from={message.role} key={message.id}>
//   <MessageContent>
//     {message.parts.map((part, i) => {
//       switch (part.type) {
//         case "text":
//           return (
//             <Response key={`${message.id}-${i}`}>
//               {part.text}
//             </Response>
//           );
//         case "reasoning":
//           return (
//             <Reasoning
//               key={`${message.id}-${i}`}
//               className="w-full"
//               isStreaming={status === "streaming"}
//             >
//               <ReasoningTrigger />
//               <ReasoningContent>{part.text}</ReasoningContent>
//             </Reasoning>
//           );
//       }
//     })}
//   </MessageContent>
// </Message>
