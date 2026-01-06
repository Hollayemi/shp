"use client";

// Fragment loading timing constants
const AUTO_LOAD_DELAY_MS = 500;
const MANUAL_LOAD_COOLDOWN_MS = 1500; // Reduced from 5000ms for better UX

// Track which streams we've already checked for resume to prevent HMR from triggering resume
// This persists across HMR reloads in development
const checkedStreamIds = new Set<string>();

import {
  WebPreviewBody,
  WebPreviewConsole,
  WebPreviewNavigation,
  WebPreviewNavigationButton,
  WebPreviewUrl,
} from "@/components/ai-elements/web-preview";
import {
  RefreshableWebPreview,
  RefreshableWebPreviewHandle,
} from "@/components/ai-elements/RefreshableWebPreview";
import LoadingSpinner from "@/components/LoadingSpinner";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  ExternalLinkIcon,
  RefreshCwIcon,
  GitBranchIcon,
  RocketIcon,
  ArrowLeftIcon,
  SearchIcon,
  CodeIcon,
  Monitor,
  Tablet,
  Smartphone,
} from "lucide-react";
import { Session } from "next-auth";
import Link from "next/link";
import {
  Suspense,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { toast } from "sonner";
import { halAssistantOpenAtom } from "@/lib/hal-assistant-state";
import {
  projectIsBuildingAtom,
  showToastAtom,
} from "@/lib/state/notificationAtoms";
import {
  sandboxPreviewUrlAtom,
  setSandboxPreviewUrlAtom,
} from "@/lib/sandbox-preview-state";
import { HalSuggestionsChatWrapper } from "@/components/HalSuggestionsChatWrapper";

import Chat from "@/modules/projects/ui/components/Chat";
import {
  useSuspenseQuery,
  useMutation,
  useQueryClient,
  useQuery,
} from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import {
  V2FragmentsList,
  V2FragmentsListRef,
} from "../components/V2FragmentsList";
import {
  GitFragmentsList,
  GitFragmentsListRef,
} from "../components/GitFragmentsList";
import { DeployMenu } from "../components/DeployMenu";

import { FileExplorer } from "@/components/code-view/FileExplorer";
import { MigrationHitlCard } from "@/components/MigrationHitlCard";
import { useSandboxStateV3 } from "@/hooks/useSandboxStateV3";
import { useSandboxHealthV2 } from "@/hooks/useSandboxHealthV2";
import {
  CodeBlock,
  CodeBlockCopyButton,
} from "@/components/ai-elements/code-block";
import { ProjectHeader } from "../components/ProjectHeader";
import { GitHubIntegration } from "../components/GitHubIntegration";
import { SandboxStatus } from "@/components/ui/sandbox-status-card";
import { PreviewLoadingAnimation } from "../components/PreviewLoadingAnimation";
import { MobileBottomTabs } from "../components/MobileBottomTabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import RefreshIcon from "@/components/icons/RefreshIcon";
import { LinkIcon } from "@/components/icons/LinkIcon";
import { RotateRightIcon } from "@/components/icons/RotateRightIcon";
import { RotateLeftIcon } from "@/components/icons/RotateLeftIcon";
import { CodeViewIcon } from "@/components/icons/CodeViewIcon";
import { PreviewViewIcon } from "@/components/icons/PreviewViewIcon";
import { HalAssistant } from "@/components/HalAssistant";
import {
  PreviewSizeSelector,
  PreviewSize,
  getPreviewWidth,
} from "../components/PreviewSizeSelector";
import { VisualEditingPanel } from "../components/VisualEditingPanel";
import {
  selectedElementAtom,
  visualEditingModeAtom,
} from "@/lib/visual-editor/state";
import type {
  ElementInfo,
  StyleChangeRequest,
  TextChangeRequest,
  TextContentChangeRequest,
} from "@/lib/visual-editor/types";
import { FileCreationPreview } from "../components/FileCreationPreview";
import { useFileCycling } from "@/hooks/useFileCycling";
import { HelpMenu } from "../components/HelpMenu";
import { ExportCodeButton } from "../components/ExportCodeButton";
import { SandboxMonitor } from "@/components/ai-elements/SandboxMonitor";
import type {
  RuntimeErrorEvent,
  NetworkRequestEvent,
  ConsoleOutputEvent,
  ContentLoadedEvent,
} from "@shipper/shared";
import { SettingsButton } from "@/modules/projects/ui/components/SettingsButton";
import { CloudCreditsModal } from "@/components/CloudCreditsModal";
import { PreviewErrorScreen } from "../components/PreviewErrorScreen";

// Render component to HTML using the render API
const renderComponentToHtml = async (
  content: string,
  filePath: string,
): Promise<string | null> => {
  try {
    console.log("Sending to render API:", {
      filePath,
      contentLength: content.length,
    });

    const response = await fetch("/api/render-wireframe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content,
        filePath,
      }),
    });

    if (!response.ok) {
      throw new Error(`Render API error: ${response.status}`);
    }

    const result = await response.json();
    return result.html;
  } catch (error) {
    console.error("Error rendering component:", error);
    return null;
  }
};

interface ProjectViewV3Props {
  projectId: string;
  session: Session;
  seed?: string;
  initialPrompt?: string;
}

export const ProjectViewV3 = ({
  projectId,
  session,
  seed,
  initialPrompt,
}: ProjectViewV3Props) => {
  const showToast = useSetAtom(showToastAtom);
  const setProjectIsBuilding = useSetAtom(projectIsBuildingAtom);
  const [tabState, setTabState] = useState<"preview" | "code">("preview");
  const [sandboxUrl, setSandboxUrl] = useState<string>("");
  const [loadedFragment, setLoadedFragment] = useState<{
    id: string;
    title: string;
    files: { [path: string]: string };
    commitHash?: string;
  } | null>(null);
  const [codeViewMode, setCodeViewMode] = useState<"fragment" | "all">("all");
  const [hasCompletedFirstGeneration, setHasCompletedFirstGeneration] =
    useState(false);
  const [isLoadingFirstFragment, setIsLoadingFirstFragment] = useState(false);
  // Preview refresh key no longer needed - preview updates in real-time
  const refreshablePreviewRef = useRef<RefreshableWebPreviewHandle | null>(
    null,
  );

  // State for tracking manual refresh operations
  const [isManuallyRefreshing, setIsManuallyRefreshing] = useState(false);

  // State for deployment
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentResult, setDeploymentResult] = useState<{
    success: boolean;
    deploymentUrl?: string;
    error?: string;
    logs?: string;
    buildFailed?: boolean;
  } | null>(null);

  // HAL Assistant state
  const [isHalPanelVisible, setIsHalPanelVisible] =
    useAtom(halAssistantOpenAtom);
  const [triggerHalSuggestions, setTriggerHalSuggestions] = useState(false);
  const [hasNewSuggestions, setHasNewSuggestions] = useState(false);
  const [latestAdvisorSuggestions, setLatestAdvisorSuggestions] = useState<
    Array<{ id: string; title: string; shortTitle?: string; prompt: string }>
  >([]);
  const [hasFetchedInitialSuggestions, setHasFetchedInitialSuggestions] =
    useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  // Visual editing state
  const [selectedElement, setSelectedElement] = useAtom(selectedElementAtom);
  const [visualEditingMode, setVisualEditingMode] = useAtom(
    visualEditingModeAtom,
  );

  // Reset visual editing state on navigation (projectId change)
  useEffect(() => {
    console.log("[V3ProjectView] Resetting visual editing state on navigation");
    setVisualEditingMode(false);
    setSelectedElement(null);
  }, [projectId, setVisualEditingMode, setSelectedElement]);

  // Clear selected element when visual editing mode is disabled
  useEffect(() => {
    if (!visualEditingMode && selectedElement) {
      setSelectedElement(null);
    }
  }, [visualEditingMode, selectedElement, setSelectedElement]);

  // Clear selected element when visual editing mode is enabled (so panel doesn't show immediately)
  const prevVisualEditingModeRef = useRef<boolean | undefined>(undefined);
  const isFirstMountRef = useRef(true);
  useEffect(() => {
    // Clear selectedElement when:
    // 1. Visual editing mode transitions from false to true (user restarts visual edit), OR
    // 2. On first mount, if visual editing mode is enabled and selectedElement exists (stale state)
    if (visualEditingMode) {
      if (
        prevVisualEditingModeRef.current === false ||
        (isFirstMountRef.current && selectedElement)
      ) {
        setSelectedElement(null);
      }
    }
    prevVisualEditingModeRef.current = visualEditingMode;
    isFirstMountRef.current = false;
  }, [visualEditingMode, selectedElement, setSelectedElement]);

  // Exit visual editing mode when switching to code view
  useEffect(() => {
    if (tabState === "code" && visualEditingMode) {
      setVisualEditingMode(false);
      setSelectedElement(null);

      // Send message to iframe to disable visual editing
      const iframe = document.querySelector(
        'iframe[title="Preview"]',
      ) as HTMLIFrameElement;

      if (iframe?.contentWindow) {
        iframe.contentWindow.postMessage({ type: "DISABLE_VISUAL_EDIT" }, "*");
      }
    }
  }, [tabState, visualEditingMode, setVisualEditingMode, setSelectedElement]);

  // Cleanup: reset visual editing state on unmount
  useEffect(() => {
    return () => {
      setVisualEditingMode(false);
      setSelectedElement(null);
    };
  }, [setVisualEditingMode, setSelectedElement]);

  // Sandbox preview URL from Jotai atom
  const sandboxPreviewUrlFromAtom = useAtomValue(sandboxPreviewUrlAtom);
  const setSandboxPreviewUrl = useSetAtom(setSandboxPreviewUrlAtom);

  // Reset preview URL on mount/navigation to prevent showing stale preview
  useEffect(() => {
    console.log("[V3ProjectView] Resetting sandbox preview URL on navigation");
    setSandboxPreviewUrl(null);
  }, [projectId, setSandboxPreviewUrl]); // Reset when projectId changes

  // State for authenticated preview URL (proxy URL for AI tools and external link)
  const [authenticatedPreviewUrl, setAuthenticatedPreviewUrl] =
    useState<string>("");

  // State for base preview URL (without authentication)
  const [basePreviewUrl, setBasePreviewUrl] = useState<string>("");

  // State for original Modal URL (direct URL for iframe)
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState<string>("");

  // File cycling state - persists across component remounts
  const {
    queuedFiles,
    displayedFile,
    displayedHtml,
    addFileToQueue,
    resetCycling,
    goToNext,
    goToPrevious,
    goToIndex,
  } = useFileCycling(projectId);

  // SSE connection for file streaming - managed at parent level to prevent remounting
  const eventSourceRef = useRef<EventSource | null>(null);
  const [hasStartedStreaming, setHasStartedStreaming] = useState(false);

  // State to track if files are being streamed (independent of Chat generation state)
  const [isStreamingFiles, setIsStreamingFiles] = useState(false);

  // State to track if generation is active - will be updated by Chat component
  const [isGenerationActive, setIsGenerationActive] = useState(false);
  const [isCodingComplete, setIsCodingComplete] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isSidebarHidden, setIsSidebarHidden] = useState(false);

  // Refs for fragment lists to trigger refresh imperatively
  const gitFragmentsListRef = useRef<GitFragmentsListRef>(null);
  const v2FragmentsListRef = useRef<V2FragmentsListRef>(null);

  // Ref to store Chat sendMessage function for visual editing
  const sendMessageToChatRef = useRef<
    ((message: { parts: Array<{ type: "text"; text: string }> }) => void) | null
  >(null);

  // Mobile view state - controls which section is visible on mobile
  const [mobileActiveSection, setMobileActiveSection] = useState<
    "preview" | "assistant" | "chat"
  >("chat");

  // Preview size state for responsive preview
  const [previewSize, setPreviewSize] = useState<PreviewSize>("desktop");

  // Calculate available viewport height for mobile
  const [viewportHeight, setViewportHeight] = useState<number>(0);

  // Sandbox monitoring state
  const [sandboxErrors, setSandboxErrors] = useState<
    RuntimeErrorEvent["data"][]
  >([]);
  const [visibleErrors, setVisibleErrors] = useState<
    RuntimeErrorEvent["data"][]
  >([]); // Errors currently shown in notifications
  const [hasActiveErrors, setHasActiveErrors] = useState(false); // Track if we have active errors to stop auto-refresh
  const [consoleLogs, setConsoleLogs] = useState<
    Array<{
      level: "log" | "warn" | "error";
      message: string;
      timestamp: Date;
    }>
  >([]);
  const [hasActualContent, setHasActualContent] = useState(false);
  const [isWaitingForContent, setIsWaitingForContent] = useState(false);
  const [showMigrationCard, setShowMigrationCard] = useState(false);
  const [hasDismissedMigrationCard, setHasDismissedMigrationCard] =
    useState(false);
  // Track first-time import loading state (only shows "Loading your imported project" on first import)
  const [isFirstImportLoading, setIsFirstImportLoading] = useState(false);

  // Track refresh requests to prevent multiple simultaneous refreshes
  const isRefreshingRef = useRef(false);
  const lastRefreshTimeRef = useRef(0);

  useEffect(() => {
    const updateHeight = () => {
      setViewportHeight(window.innerHeight);
    };

    // Set initial height
    updateHeight();

    // Update on resize and orientation change
    window.addEventListener("resize", updateHeight);
    window.addEventListener("orientationchange", updateHeight);

    return () => {
      window.removeEventListener("resize", updateHeight);
      window.removeEventListener("orientationchange", updateHeight);
    };
  }, []);

  // Initialize trpc and queryClient early so they can be used in effects
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // SSE connection effect - only create once and manage at parent level
  useEffect(() => {
    console.log(
      "[V3ProjectView] Setting up SSE connection for project:",
      projectId,
    );

    const eventSource = new EventSource(
      `/api/projects/${projectId}/file-stream`,
    );
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log("[V3ProjectView] ✅ SSE connection opened successfully");
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log(
          "[V3ProjectView] 📥 Received file event:",
          data.filePath,
          data.action,
        );

        // Handle stream completion signal
        if (data.action === "stream-complete") {
          console.log(
            "[V3ProjectView] ✅ Stream complete signal received - clearing streaming state and refreshing project data",
          );
          setIsStreamingFiles(false);
          setHasStartedStreaming(false);

          // Invalidate project data to clear activeStreamId and show preview
          // This is crucial for HMR scenarios where Chat isn't connected to the stream
          queryClient.invalidateQueries({
            queryKey: trpc.projects.getOne.queryKey({ projectId }),
          });
          queryClient.invalidateQueries({
            queryKey: trpc.messages.getManyV2.queryKey({ projectId }),
          });

          return;
        }

        if (!hasStartedStreaming) {
          console.log(
            "[V3ProjectView] First file received - notifying streaming start",
          );
          setHasStartedStreaming(true);
          // Only show wireframe preview for first generation
          if (!hasCompletedFirstGeneration) {
            setIsStreamingFiles(true);
          }
        }

        // Create render promise and add to queue
        const renderPromise = renderComponentToHtml(
          data.content,
          data.filePath,
        );
        addFileToQueue(data, renderPromise);
      } catch (error) {
        console.error("[V3ProjectView] Error parsing SSE data:", error);
      }
    };

    eventSource.onerror = (error) => {
      console.error("[V3ProjectView] SSE connection error:", error);
    };

    return () => {
      console.log("[V3ProjectView] Cleaning up SSE connection");
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [
    projectId,
    hasStartedStreaming,
    addFileToQueue,
    queryClient,
    trpc,
    hasCompletedFirstGeneration,
  ]);

  // Debounce state for fragment refresh
  const fragmentRefreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isExecutingFragmentRefresh = useRef(false);

  // Mutation for applying direct visual edits
  const applyDirectEditMutation = useMutation(
    trpc.projects.applyDirectVisualEdit.mutationOptions(),
  );

  const applyBatchedEditsMutation = useMutation(
    trpc.projects.applyBatchedVisualEdits.mutationOptions(),
  );

  // V3 Sandbox state hook with automatic recovery
  const sandbox = useSandboxStateV3({
    projectId,
    enabled: !!projectId,
    autoRecover: true,
    recoveryStrategy: "progressive",
    onStateChange: useCallback((state: any) => {
      console.log("[V3ProjectView] Sandbox state change:", state);

      // Update sandbox URL when healthy
      if (state?.status === "healthy" && state?.sandboxUrl) {
        console.log(
          "[V3ProjectView] Setting sandbox URL from state:",
          state.sandboxUrl,
        );
        setSandboxUrl(state.sandboxUrl);
      } else if (state?.status === "failed" || state?.status === "expired") {
        // Only clear URL on failed/expired, not during recovery
        console.log(
          "[V3ProjectView] Clearing sandbox URL - status:",
          state?.status,
        );
        setSandboxUrl("");
      }
      // Don't clear URL during "recovering" or "initializing" - keep old URL until new one is ready
    }, []),
  });

  // Sandbox health hook for idle timer
  const sandboxHealth = useSandboxHealthV2({
    projectId,
    enabled: true,
    pollInterval: 30000, // Check every 30 seconds
    autoRecover: false, // Let the main sandbox hook handle recovery
  });

  // Map sandbox state to SandboxStatus for UI
  const getSandboxStatus = useCallback((): SandboxStatus | undefined => {
    if (!sandbox.state) return undefined;

    switch (sandbox.state.status) {
      case "healthy":
        return "ready";
      case "initializing":
      case "recovering":
        return "building";
      case "unhealthy":
      case "expired":
        return "needs-attention";
      case "failed":
        return "failed";
      default:
        return undefined;
    }
  }, [sandbox.state]);

  const sandboxStatus = getSandboxStatus();

  // State for authenticated preview token
  const [authenticatedPreviewToken, setAuthenticatedPreviewToken] =
    useState<string>("");

  // Track if we're fetching preview auth
  const [isFetchingPreviewAuth, setIsFetchingPreviewAuth] = useState(false);

  // Cloud Credits Modal state
  const [isCloudCreditsModalOpen, setIsCloudCreditsModalOpen] = useState(false);

  // Function to get fresh authentication for preview
  const getFreshPreviewAuth = useCallback(async () => {
    setIsFetchingPreviewAuth(true);
    try {
      console.log("[V3ProjectView] Getting fresh preview authentication");
      const authInfo = await queryClient.fetchQuery(
        trpc.projects.getAuthenticatedPreviewUrl.queryOptions({
          projectId,
          port: 5173,
        }),
      );
      setAuthenticatedPreviewUrl(authInfo.authenticatedUrl);
      setBasePreviewUrl(authInfo.url);
      setOriginalPreviewUrl(authInfo.originalUrl || authInfo.authenticatedUrl); // Use original URL for iframe, fallback to authenticated
      setAuthenticatedPreviewToken(authInfo.token || "");
      console.log(
        "[V3ProjectView] Got fresh authenticated preview URL and token",
        {
          hasToken: !!authInfo.token,
          tokenLength: authInfo.token?.length || 0,
          authenticatedUrl: authInfo.authenticatedUrl,
          baseUrl: authInfo.url,
          originalUrl: authInfo.originalUrl,
        },
      );
    } catch (error) {
      console.error("[V3ProjectView] Failed to get fresh preview auth:", error);
      // Fallback to regular URL if auth fails
      setAuthenticatedPreviewUrl(sandbox.sandboxUrl || sandboxUrl);
      setAuthenticatedPreviewToken("");
      setBasePreviewUrl(sandbox.sandboxUrl || sandboxUrl);
    } finally {
      setIsFetchingPreviewAuth(false);
    }
  }, [
    projectId,
    sandbox.sandboxUrl,
    sandboxUrl,
    trpc.projects.getAuthenticatedPreviewUrl,
    queryClient,
  ]);

  // Track refresh count for debugging
  const refreshCountRef = useRef(0);

  // Function to refresh preview when fragments change
  const refreshPreview = useCallback(
    async (options: { skipHealthCheck?: boolean } = {}) => {
      // Prevent multiple simultaneous refreshes
      const now = Date.now();
      const timeSinceLastRefresh = now - lastRefreshTimeRef.current;

      if (isRefreshingRef.current) {
        console.log("[V3ProjectView] Refresh already in progress, skipping");
        return;
      }

      // Debounce rapid refresh requests (500ms cooldown)
      if (timeSinceLastRefresh < 500) {
        console.log(
          `[V3ProjectView] Refresh called too soon (${timeSinceLastRefresh}ms ago), debouncing`,
        );
        return;
      }

      isRefreshingRef.current = true;
      lastRefreshTimeRef.current = now;

      refreshCountRef.current += 1;
      console.log(
        `[V3ProjectView] 🔄 PREVIEW REFRESH #${refreshCountRef.current} triggered`,
        new Error().stack?.split("\n")[2]?.trim(),
        options.skipHealthCheck ? "(quick refresh - no loading states)" : "",
      );

      try {
        // Trigger a quick health check first (unless skipped for AI edits)
        let healthResult = null;
        if (!options.skipHealthCheck) {
          try {
            healthResult = await sandbox.actions.checkHealth();
            console.log("[V3ProjectView] Health check result:", healthResult);
          } catch (e) {
            console.warn(
              "[V3ProjectView] Health check during refresh failed:",
              e,
            );
          }
        }

        // If not healthy, attempt a recovery
        // Use fresh health result if available, otherwise fall back to state
        const needsRecovery = healthResult
          ? !healthResult.isHealthy &&
          (healthResult.needsRefresh || healthResult.hasActiveSandbox)
          : !sandbox.isHealthy && sandbox.canRecover;

        if (needsRecovery) {
          // ONLY show loading states when actually recovering
          console.log(
            "[V3ProjectView] Sandbox not healthy - showing loading screen and attempting recovery",
            { healthResult, sandboxState: sandbox.state },
          );
          setIsManuallyRefreshing(true);
          setIsWaitingForContent(true);
          setHasActualContent(false);

          try {
            await sandbox.actions.recover();

            // Wait a moment for recovery to complete and state to update
            await new Promise((resolve) => setTimeout(resolve, 2000));

            // Re-check health after recovery
            const postRecoveryHealth = await sandbox.actions.checkHealth();
            console.log(
              "[V3ProjectView] Post-recovery health check:",
              postRecoveryHealth,
            );

            if (!postRecoveryHealth?.isHealthy) {
              throw new Error(
                "Sandbox recovery completed but sandbox is still not healthy",
              );
            }

            // Explicitly update sandbox URL from health check result
            if (postRecoveryHealth?.sandboxUrl) {
              console.log(
                "[V3ProjectView] Updating sandbox URL after recovery:",
                postRecoveryHealth.sandboxUrl,
              );
              setSandboxUrl(postRecoveryHealth.sandboxUrl);
            }
          } catch (error) {
            console.error(
              "[V3ProjectView] Sandbox recovery during refresh failed:",
              error,
            );
            // Don't continue if recovery failed
            setIsWaitingForContent(false);
            setIsManuallyRefreshing(false);
            isRefreshingRef.current = false;
            return;
          }
        } else {
          // Sandbox is healthy - just refresh the iframe, no loading screen needed
          console.log(
            "[V3ProjectView] Sandbox is healthy - quick iframe refresh",
          );
        }

        // Get fresh authentication for the new session (after ensuring sandbox)
        // This is optional - if it fails, we can still use the base sandbox URL
        try {
          await getFreshPreviewAuth();
        } catch (authError) {
          console.warn(
            "[V3ProjectView] Failed to get fresh auth, using base sandbox URL:",
            authError,
          );
          // Clear waiting state so preview can still show with base URL
          setIsWaitingForContent(false);
          setIsManuallyRefreshing(false);
          isRefreshingRef.current = false;
        }

        // Also trigger the RefreshableWebPreview refresh if available
        refreshablePreviewRef.current?.refresh();

        // Invalidate authenticated preview URL cache to ensure fresh data
        queryClient.invalidateQueries({
          queryKey: trpc.projects.getAuthenticatedPreviewUrl.queryKey({
            projectId,
            port: 5173,
          }),
        });

        // Set timeout only if we're actually waiting for content (i.e., during recovery)
        if (needsRecovery) {
          // Wait for content to load after recovery (will be notified by CONTENT_LOADED event)
          // Timeout after 10 seconds if content doesn't load
          setTimeout(() => {
            console.warn(
              "[V3ProjectView] Content load timeout after 10s - assuming content is ready",
            );
            setIsWaitingForContent(false);
            setIsManuallyRefreshing(false);
            setHasActualContent(true); // Assume content is ready after timeout
            isRefreshingRef.current = false;
          }, 10000);
        } else {
          // Sandbox was healthy - no need to wait, just clear the refresh lock
          isRefreshingRef.current = false;
        }
      } catch (error) {
        console.error("[V3ProjectView] Refresh preview error:", error);
        // Clear any loading states that might have been set
        setIsManuallyRefreshing(false);
        setIsWaitingForContent(false);
        isRefreshingRef.current = false;
      }
    },
    [
      sandbox.actions,
      sandbox.isHealthy,
      sandbox.canRecover,
      getFreshPreviewAuth,
      queryClient,
      trpc.projects.getAuthenticatedPreviewUrl,
      projectId,
      hasActualContent,
    ],
  );

  const { data: initialMessages } = useSuspenseQuery({
    ...trpc.messages.getManyV2.queryOptions({ projectId }),
    refetchOnWindowFocus: false, // CRITICAL: Prevent refetch that causes Chat remount
    refetchOnReconnect: false, // CRITICAL: Prevent refetch that causes Chat remount
  });

  // Check if there's an active generation from the messages
  const hasActiveGeneration = useMemo(() => {
    if (!initialMessages || initialMessages.length === 0) return false;
    return initialMessages.some(
      (message: any) =>
        message.role === "assistant" && message.status === "streaming",
    );
  }, [initialMessages]);

  // Get project data with git information - use Suspense query like v4
  // CRITICAL: Must be available synchronously when Chat mounts to prevent shouldResume from changing mid-stream
  const { data: projectData } = useSuspenseQuery({
    ...trpc.projects.getOne.queryOptions({ projectId }),
    refetchOnWindowFocus: false, // Match v4: prevent unexpected refetches
    refetchOnReconnect: false, // Match v4: prevent unexpected refetches
  });

  // Pre-fetch cloud credits so the cache is warm for ShipperCloudConfirmation
  useQuery({
    ...trpc.credits.getCloudCredits.queryOptions(),
    refetchOnWindowFocus: false,
  });

  // Detect if resume should be attempted - ONLY on initial mount, never changes after
  // This prevents HMR from triggering resume attempts
  const [shouldResumeStream] = useState(() => {
    // Only calculate resume decision once on mount
    if (!projectData?.activeStreamId) {
      console.log("[V3ProjectView] No activeStreamId - not resuming");
      return false;
    }

    // Check if we've already processed this stream (prevents HMR from re-triggering resume)
    if (checkedStreamIds.has(projectData.activeStreamId)) {
      console.log(
        `[V3ProjectView] Stream ${projectData.activeStreamId} already checked - not resuming again (HMR protection)`,
      );
      return false;
    }

    // Mark this stream as checked so we never try to resume it again
    checkedStreamIds.add(projectData.activeStreamId);

    // Check navigation type - only resume on refresh, not on navigation
    if (typeof window !== "undefined") {
      const navEntries = performance.getEntriesByType(
        "navigation",
      ) as PerformanceNavigationTiming[];
      if (navEntries.length > 0) {
        const navType = navEntries[0].type;
        if (navType !== "reload") {
          console.log(
            `[V3ProjectView] Navigation type is '${navType}' (not reload) - not resuming`,
          );
          return false;
        }
      }
    }

    // Check if stream has timestamp - if not, don't resume (old stream format)
    const streamStartedAt = projectData.activeStreamStartedAt;
    if (!streamStartedAt) {
      console.log(
        "[V3ProjectView] No stream timestamp - not resuming (old stream)",
      );
      return false;
    }

    // Only resume if stream started within the last 5 minutes
    const ageMs = Date.now() - new Date(streamStartedAt).getTime();
    const maxAgeMs = 5 * 60 * 1000; // 5 minutes

    if (ageMs > maxAgeMs) {
      console.log(
        `[V3ProjectView] Stream too old (${Math.round(ageMs / 1000)}s) - not resuming`,
      );
      return false;
    }

    console.log(
      `[V3ProjectView] ✅ Initial mount: Stream is fresh (${Math.round(ageMs / 1000)}s old) and page was refreshed - will attempt resume`,
    );
    return true;
  });

  // Get Git fragments
  const { data: gitFragments } = useQuery(
    trpc.projects.getGitFragments.queryOptions({
      projectId,
      limit: 20,
    }),
  );

  // Use state to track latest fragment from fragment lists
  const [latestFragmentFromList, setLatestFragmentFromList] =
    useState<any>(null);

  // Get all sandbox files with content - use query to avoid blocking UI, enabling after health check completes
  const queryEnabled = Boolean(sandbox.sandboxId) && sandbox.isHealthy;

  const {
    data: sandboxFiles,
    refetch: refetchSandboxFiles,
    isLoading: isLoadingSandboxFiles,
    error: sandboxFilesError,
  } = useQuery({
    ...trpc.projects.getAllSandboxFiles.queryOptions({ projectId }),
    // Only fetch after sandbox is confirmed healthy and not recovering
    enabled: queryEnabled && !!projectId,
    // Retry less aggressively since sandbox might not exist yet
    retry: (failureCount: number, error: any) => {
      // Don't retry if it's a permission or not found error
      if (
        error?.data?.code === "FORBIDDEN" ||
        error?.data?.code === "NOT_FOUND"
      ) {
        return false;
      }
      return failureCount < 2;
    },
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Function to normalize file paths for display - memoized to prevent re-renders
  const normalizeFilePaths = useCallback(
    (files: { [path: string]: string }) => {
      const normalizedFiles: { [path: string]: string } = {};

      // System files and directories to exclude from display
      const excludePatterns = [
        /^\.bash/, // .bashrc, .bash_logout, etc.
        /^\.profile$/, // .profile
        /^\.wh\./, // .wh.vite-app and similar whiteout files
        /^\/home\/daytona\/\.[^\/]*$/, // Hidden files in daytona home directory
        /^\/home\/user\/\.[^\/]*$/, // Hidden files in user home directory (legacy)
      ];

      Object.entries(files).forEach(([filePath, content]) => {
        // Remove workspace prefixes to show files relative to project root
        const normalizedPath = filePath
          .replace(/^\/home\/daytona\/workspace\//, "") // New Daytona workspace path
          .replace(/^\/home\/user\//, "") // Legacy user path
          .replace(/^\.\//, ""); // Relative path prefix

        // Skip system files that shouldn't be shown in the project tree
        const shouldExclude = excludePatterns.some(
          (pattern) => pattern.test(filePath) || pattern.test(normalizedPath),
        );

        if (!shouldExclude && normalizedPath && normalizedPath !== ".") {
          normalizedFiles[normalizedPath] = content;
        }
      });

      return normalizedFiles;
    },
    [],
  );

  // V2 Fragment loading mutation
  const loadV2FragmentMutation = useMutation(
    trpc.projects.loadV2Fragment.mutationOptions({
      onSuccess: (result: any) => {
        console.log("[V3ProjectView] Fragment loaded:", result.message);
        if (result.fragment?.files) {
          setLoadedFragment({
            id: result.fragment.id,
            title: result.fragment.title,
            files: normalizeFilePaths(result.fragment.files),
          });
        }
        setIsLoadingFirstFragment(false);
      },
      onError: (error: any) => {
        console.error("[V3ProjectView] Failed to load fragment:", error);
        setIsLoadingFirstFragment(false);
      },
    }),
  );

  // Git commit switching mutation
  const switchToGitCommitMutation = useMutation(
    trpc.projects.switchToGitCommit.mutationOptions({
      onSuccess: (result: any) => {
        console.log("[V3ProjectView] Switched to git commit:", result.message);
        // For git fragments, we don't have direct file access, so we mark it differently
        setLoadedFragment({
          id: result.commitHash,
          title: result.fragmentTitle,
          files: {}, // Git fragments don't expose files directly
          commitHash: result.commitHash,
        });
        setIsLoadingFirstFragment(false);
      },
      onError: (error: any) => {
        console.error("[V3ProjectView] Failed to switch to git commit:", error);
        setIsLoadingFirstFragment(false);
      },
    }),
  );

  // Deployment mutation
  const deployAppMutation = useMutation(
    trpc.projects.deployApp.mutationOptions({
      onMutate: () => {
        setIsDeploying(true);
        setDeploymentResult(null);
      },
      onSuccess: (result: any) => {
        console.log("[V3ProjectView] Deployment result:", result);
        if (result.success) {
          setDeploymentResult({
            success: true,
            deploymentUrl: result.deploymentUrl,
            logs: result.logs,
          });
          // Update project cache to reflect deployed state so UI shows "Update" when code changes
          try {
            const deployedRefToStore =
              projectData?.gitCommitHash ||
              loadedFragment?.id ||
              latestFragmentFromList?.id ||
              null;

            queryClient.setQueryData(
              trpc.projects.getOne.queryKey({ projectId }),
              (old: any) => {
                if (!old) return old;
                return {
                  ...old,
                  deploymentUrl: result.deploymentUrl,
                  deployedAt: new Date().toISOString(),
                  deployedRef: deployedRefToStore,
                };
              },
            );
            // Invalidate specific queries but exclude Suspense queries (projectData, messages)
            // to avoid triggering Suspense and remounting Chat
            queryClient.invalidateQueries({
              predicate: (query) => {
                const key = query.queryKey;
                if (!Array.isArray(key)) return false;

                // Exclude projectData and messages which use Suspense
                const isProjectData = key.some(
                  (k) =>
                    typeof k === "object" &&
                    k !== null &&
                    "procedure" in k &&
                    k.procedure === "getOne",
                );
                const isMessages = key.some(
                  (k) =>
                    typeof k === "object" &&
                    k !== null &&
                    "procedure" in k &&
                    k.procedure === "getManyV2",
                );

                if (isProjectData || isMessages) return false;

                // Invalidate other project-related queries
                return key.some(
                  (k) =>
                    typeof k === "object" &&
                    k !== null &&
                    (k as any).projectId === projectId,
                );
              },
            });
          } catch (e) {
            console.warn(
              "[V3ProjectView] Failed to update project cache after deploy:",
              e,
            );
          }
        } else {
          // Handle build failures that are returned as "success" from mutation but with success: false
          // Prioritize error over message since error contains detailed build information
          const errorMessage =
            result.error || result.message || "Deployment failed";
          setDeploymentResult({
            success: false,
            error: errorMessage,
            logs: result.logs || errorMessage, // Use error as logs if logs not provided
            buildFailed: result.buildFailed,
          });
        }
        setIsDeploying(false);
      },
      onError: (error: any) => {
        console.error("[V3ProjectView] Failed to deploy app:", error);
        setDeploymentResult({
          success: false,
          error: error.message || "Deployment failed",
        });
        setIsDeploying(false);
      },
    }),
  );

  // Find the latest fragment across both systems
  const latestFragment = useMemo(() => {
    return latestFragmentFromList;
  }, [latestFragmentFromList]);

  // Debounced function to handle fragment refresh
  const debouncedFragmentRefresh = useCallback(async () => {
    // Prevent multiple simultaneous fragment refreshes
    if (isExecutingFragmentRefresh.current) {
      console.log(
        "[V3ProjectView] Fragment refresh already in progress, skipping",
      );
      return;
    }

    isExecutingFragmentRefresh.current = true;
    console.log("[V3ProjectView] Debounced fragment refresh executing");

    try {
      // Refresh sandbox files
      await refetchSandboxFiles();

      // Refresh the fragment list UI so the new fragment appears
      v2FragmentsListRef.current?.refresh();

      console.log(
        "[V3ProjectView] Fragment refresh complete - files and fragment list refreshed",
      );
    } catch (error) {
      console.error("[V3ProjectView] Debounced fragment refresh error:", error);
    } finally {
      setTimeout(() => setIsLoadingFirstFragment(false), 2000);
      isExecutingFragmentRefresh.current = false;
    }
  }, [refetchSandboxFiles, setIsLoadingFirstFragment]);

  // Check if this is a brand new project (no existing messages and not imported)
  // Imported projects are treated as existing projects even if they have no messages
  const isNewProject = useMemo(() => {
    return initialMessages.length === 0 && !projectData?.codeImport;
  }, [initialMessages, projectData?.codeImport]);

  // Determine if this is a first-time import (imported project with no messages yet)
  // This is used to show "Loading your imported project" and disable chat only on first import
  const isFirstTimeImport = useMemo(() => {
    return !!projectData?.codeImport && initialMessages.length === 0;
  }, [projectData?.codeImport, initialMessages.length]);

  // Set isFirstImportLoading on mount if this is a first-time import
  useEffect(() => {
    if (isFirstTimeImport && !hasActualContent) {
      setIsFirstImportLoading(true);
    }
  }, [isFirstTimeImport, hasActualContent]);

  // Clear isFirstImportLoading once content has loaded (first import complete)
  useEffect(() => {
    if (isFirstImportLoading && hasActualContent) {
      console.log(
        "[V3ProjectView] First import complete - content loaded, enabling chat",
      );
      setIsFirstImportLoading(false);
    }
  }, [isFirstImportLoading, hasActualContent]);

  // Compute stable UI state to prevent flashing
  const uiState = useMemo(():
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
    | "waitingForContent"
    | "awaitingSandbox"
    | "ready" => {
    // Build status takes priority - check if sandbox is initializing or AI is generating/building
    const buildStatus = projectData?.buildStatus;
    const activeStreamId = projectData?.activeStreamId;

    // Check if there's an active stream (even if buildStatus hasn't updated yet)
    // This handles the case when navigating back during an active generation
    const hasActiveStream = Boolean(activeStreamId);

    // Handle AWAITING_SANDBOX for imported projects
    if (buildStatus === "AWAITING_SANDBOX") {
      console.log(
        "[V3ProjectView] Build status indicates imported project awaiting sandbox:",
        buildStatus,
      );
      return "awaitingSandbox";
    }

    if (buildStatus === "INITIALIZING") {
      console.log(
        "[V3ProjectView] Build status indicates sandbox initialization:",
        buildStatus,
      );
      return "generating"; // Use "generating" state but with different message
    }
    if (
      buildStatus === "GENERATING" ||
      buildStatus === "BUILDING" ||
      hasActiveStream
    ) {
      console.log(
        "[V3ProjectView] Build status indicates generation in progress:",
        buildStatus,
        "or activeStreamId:",
        activeStreamId,
      );
      return "generating";
    }

    // Generation states take priority over everything
    if (isLoadingFirstFragment) return "loadingFragment";
    if (
      (isGenerationActive ||
        hasActiveGeneration ||
        isStreamingFiles ||
        hasActiveStream) &&
      !hasCompletedFirstGeneration
    )
      return "generating";

    // Recovery state takes priority over manual refresh to show proper progress
    if (sandbox.isRecovering) return "recovering";

    // Waiting for content after refresh/generation
    if (isWaitingForContent) return "waitingForContent";

    // Manual refresh takes priority over other states (but not generation or recovery)
    if (isManuallyRefreshing && !isGenerationActive && !hasActiveGeneration) {
      return "refreshing";
    }

    // Only show preview when build status is READY (or legacy IDLE state)
    // This prevents showing preview during reconnection while AI is still building
    if (buildStatus === "READY" || buildStatus === "IDLE") {
      // Use precise sandbox state for better state detection
      if (sandbox.isHealthy && sandbox.sandboxUrl && hasActualContent)
        return "ready";
      if (sandbox.isHealthy && sandbox.sandboxUrl && !hasActualContent)
        return "waitingForContent";

      // If buildStatus is READY but sandbox isn't ready yet, wait for it
      if (sandbox.isLoading) return "checkingHealth";
      if (sandbox.sandboxId && !sandbox.isHealthy) return "waitingForContent";
    }

    if (sandbox.hasFailed) return "needsRefresh";
    if (sandbox.needsInitialization) {
      // Only show needsInitialization if generation is not active and we haven't completed first generation
      if (
        !isGenerationActive &&
        !hasActiveGeneration &&
        !hasCompletedFirstGeneration
      ) {
        return "needsInitialization";
      }
    }

    // Health loading state
    if (sandbox.isLoading) return "checkingHealth";

    // Fallback states
    if (sandbox.isExpired) return "needsRefresh";
    if (sandbox.sandboxId) return "sandboxNotReady";
    return isNewProject ? "newProject" : "noPreview";
  }, [
    projectData?.buildStatus,
    projectData?.activeStreamId,
    isManuallyRefreshing,
    sandbox.isRecovering,
    sandbox.isHealthy,
    sandbox.sandboxUrl,
    sandbox.hasFailed,
    sandbox.needsInitialization,
    sandbox.isLoading,
    sandbox.isExpired,
    sandbox.sandboxId,
    isLoadingFirstFragment,
    isGenerationActive,
    hasActiveGeneration,
    isStreamingFiles,
    hasCompletedFirstGeneration,
    isNewProject,
    isWaitingForContent,
    hasActualContent,
  ]);

  // Publish whether the current project is actively building/generating.
  // This is used by NotificationsRoot to only trigger the opt-in prompt at the right time.
  useEffect(() => {
    setProjectIsBuilding(
      uiState === "generating" || uiState === "loadingFragment",
    );
  }, [uiState, setProjectIsBuilding]);

  // Ensure we don't leak a stale "building" signal when leaving the project page.
  useEffect(() => {
    return () => setProjectIsBuilding(false);
  }, [setProjectIsBuilding]);

  // Memoize sandboxReady to prevent unnecessary Chat re-renders
  const sandboxReady = useMemo(
    () => Boolean((sandbox.sandboxUrl || sandboxUrl) && sandbox.isHealthy),
    [sandbox.sandboxUrl, sandbox.isHealthy, sandboxUrl],
  );

  // Deployment UI helpers: detect if a project has been deployed (persisted on the
  // Project record) and whether the current project state (git commit or latest
  // fragment) differs from the deployed reference. We read typed fields from
  // `projectData` (added via Prisma migration): `deploymentUrl`, `deployedAt`, `deployedRef`.

  const currentRef =
    projectData?.gitCommitHash ||
    latestFragmentFromList?.commitHash ||
    latestFragmentFromList?.id ||
    loadedFragment?.id ||
    null;

  const deployedRef = projectData?.deployedRef ?? null;
  const isDeployed = Boolean(projectData?.deploymentUrl);
  const needsUpdate = Boolean(
    isDeployed && deployedRef && currentRef && deployedRef !== currentRef,
  );

  // Handle HAL suggestion clicks
  const handleSuggestionClick = useCallback((prompt: string) => {
    console.log("[V3ProjectView] HAL suggestion:", prompt);

    // Populate the suggestion prompt in the main chat input
    const chatInput = document.querySelector(
      "[data-chat-input]",
    ) as HTMLTextAreaElement;

    if (chatInput) {
      // For React controlled components, we need to trigger the onChange event properly
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value",
      )?.set;

      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(chatInput, prompt);
      }

      // Trigger React's synthetic event
      const inputEvent = new Event("input", {
        bubbles: true,
      });
      chatInput.dispatchEvent(inputEvent);

      // Focus the chat input so user can review and send
      chatInput.focus();

      // Add a subtle visual pulse to the chat input to draw attention
      chatInput.classList.add("ring-2", "ring-green-500", "ring-offset-2");
      setTimeout(() => {
        chatInput.classList.remove("ring-2", "ring-green-500", "ring-offset-2");
      }, 2000);
    }

    // Keep HAL panel open so users can see other suggestions
  }, []);

  // Reset HAL suggestions trigger
  const handleSuggestionsTriggered = useCallback(() => {
    console.log("[V3ProjectView] Resetting HAL suggestions trigger");
    setTriggerHalSuggestions(false);
    // Don't clear indicator here - it should stay until user opens panel
  }, []);

  // Fetch latest suggestions from HAL messages endpoint
  const fetchLatestSuggestions = useCallback(async () => {
    try {
      console.log("[V3ProjectView] Fetching latest suggestions...");
      const response = await fetch(
        `/api/hal-chat/messages?projectId=${projectId}&hatType=generalist&limit=8`,
      );
      if (response.ok) {
        const data = await response.json();
        console.log("[V3ProjectView] HAL messages response:", {
          hasTimeline: !!data.timeline,
          timelineLength: data.timeline?.length,
        });

        // Collect ALL builder-targeted suggestions with timestamps
        const allBuilderSuggestions: Array<{
          id: string;
          title: string;
          prompt: string;
          timestamp: Date;
        }> = [];

        if (data.timeline && data.timeline.length > 0) {
          for (const item of data.timeline) {
            const itemTimestamp = item.timestamp
              ? new Date(item.timestamp)
              : item.createdAt
                ? new Date(item.createdAt)
                : new Date();

            // Check for message with tool-generateSuggestions part
            if (
              item.type === "message" &&
              item.parts &&
              Array.isArray(item.parts)
            ) {
              for (const part of item.parts) {
                if (
                  part.type === "tool-generateSuggestions" ||
                  part.toolName === "generateSuggestions"
                ) {
                  const output = part.output || part.result;
                  if (
                    output?.suggestions &&
                    Array.isArray(output.suggestions)
                  ) {
                    // Filter to only include builder-targeted suggestions
                    const builderSuggestions = output.suggestions
                      .filter((s: any) => s.targetChat === "builder")
                      .map((s: any) => ({
                        id: s.id || crypto.randomUUID(),
                        title: s.title,
                        shortTitle: s.shortTitle,
                        prompt: s.prompt,
                        timestamp: itemTimestamp,
                      }));
                    allBuilderSuggestions.push(...builderSuggestions);
                  }
                }
              }
            }

            // Check for old-format suggestions (separate timeline item)
            if (
              item.type === "suggestions" &&
              item.suggestions &&
              Array.isArray(item.suggestions)
            ) {
              // Filter to only include builder-targeted suggestions
              const builderSuggestions = item.suggestions
                .filter((s: any) => s.targetChat === "builder")
                .map((s: any) => ({
                  id: s.id || s.suggestionId || crypto.randomUUID(),
                  title: s.title,
                  shortTitle: s.shortTitle,
                  prompt: s.prompt,
                  timestamp: itemTimestamp,
                }));
              allBuilderSuggestions.push(...builderSuggestions);
            }
          }
        }

        // Sort by timestamp (newest first), take latest 8 (latest first)
        const latest8 = allBuilderSuggestions
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
          .slice(0, 8)
          .map(({ timestamp, ...rest }) => rest); // Remove timestamp before storing

        console.log(
          "[V3ProjectView] Collected suggestions:",
          allBuilderSuggestions.length,
          "builder-targeted, showing latest 8 (latest first):",
          latest8.length,
        );

        if (latest8.length > 0) {
          setLatestAdvisorSuggestions(latest8);
          setIsLoadingSuggestions(false); // Clear loading state when suggestions are loaded
          return latest8;
        } else {
          setIsLoadingSuggestions(false); // Clear loading state even if no suggestions found
        }
      } else {
        console.error(
          "[V3ProjectView] Failed to fetch messages:",
          response.status,
        );
        setIsLoadingSuggestions(false); // Clear loading state on error
      }
    } catch (error) {
      console.error("[V3ProjectView] Error fetching suggestions:", error);
      setIsLoadingSuggestions(false); // Clear loading state on error
    }
    return [];
  }, [projectId]);

  // Handle when suggestions are actually generated and ready
  const handleSuggestionsGenerated = useCallback(
    async (
      suggestions?: Array<{
        id: string;
        title: string;
        shortTitle?: string;
        prompt: string;
        targetChat?: string;
      }>,
    ) => {
      console.log(
        "[V3ProjectView] Suggestions generated - fetching from API",
        suggestions?.length,
      );
      // If suggestions provided directly, filter to only builder-targeted ones
      if (suggestions && suggestions.length > 0) {
        const builderSuggestions = suggestions.filter(
          (s) => s.targetChat === "builder" || !s.targetChat, // Default to builder if not specified
        );
        if (builderSuggestions.length > 0) {
          setLatestAdvisorSuggestions(builderSuggestions);
          setHasNewSuggestions(true);
        }
        setIsLoadingSuggestions(false); // Clear loading state when suggestions are received
      } else {
        // Otherwise fetch from API (for HAL panel generation or background generation)
        const fetchedSuggestions = await fetchLatestSuggestions();
        if (fetchedSuggestions && fetchedSuggestions.length > 0) {
          setHasNewSuggestions(true);
        }
        // Loading state is cleared in fetchLatestSuggestions
      }
    },
    [fetchLatestSuggestions],
  );

  // Handle toggling the advisor panel from the suggestions strip or discuss button
  const handleToggleAdvisor = useCallback(() => {
    console.log("[V3ProjectView] Toggling advisor panel");
    setIsHalPanelVisible((prev) => !prev);
  }, [setIsHalPanelVisible]);

  // Fetch existing suggestions on mount (in case there are already suggestions in the database)
  useEffect(() => {
    if (!hasFetchedInitialSuggestions && sandboxReady) {
      setHasFetchedInitialSuggestions(true);
      fetchLatestSuggestions();
    }
  }, [hasFetchedInitialSuggestions, sandboxReady, fetchLatestSuggestions]);

  // Auto-reset is handled by the HalSuggestionsChat component via onSuggestionsTriggered callback

  // Toggle HAL panel
  const handleToggleHalPanel = useCallback(() => {
    setIsHalPanelVisible(!isHalPanelVisible);
    // Clear new suggestions indicator when panel is opened
    if (!isHalPanelVisible) {
      setHasNewSuggestions(false);
    }
  }, [isHalPanelVisible, setIsHalPanelVisible]);

  // Normalized project files for HAL
  const normalizedProjectFiles = useMemo(() => {
    if (!sandboxFiles || sandboxFiles.size === 0) return null;

    const files: { [path: string]: string } = {};
    sandboxFiles.forEach((filePath) => {
      files[filePath] = ""; // HAL doesn't need actual content, just paths
    });
    return files;
  }, [sandboxFiles]);
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (fragmentRefreshTimeoutRef.current) {
        clearTimeout(fragmentRefreshTimeoutRef.current);
      }
    };
  }, []);

  // Reset state when project changes
  useEffect(() => {
    console.log("[V3ProjectView] Project changed, resetting state:", projectId);
    setLoadedFragment(null);
    setSandboxUrl("");
    setAuthenticatedPreviewUrl("");
    setAuthenticatedPreviewToken("");
    setBasePreviewUrl("");
    setHasCompletedFirstGeneration(false);
    setIsGenerationActive(false);
    setIsLoadingFirstFragment(false);
    setIsManuallyRefreshing(false);
    setIsStreamingFiles(false);
    setHasStartedStreaming(false);
    setIsCodingComplete(false);

    // Only invalidate project-related queries
    queryClient.invalidateQueries({
      predicate: (query) => {
        const queryKey = query.queryKey;
        return (
          Array.isArray(queryKey) &&
          queryKey.some(
            (key) =>
              typeof key === "object" &&
              key !== null &&
              "projectId" in key &&
              (key as any).projectId === projectId,
          )
        );
      },
    });
  }, [projectId, queryClient]);

  // Set sandbox URL from health check and clear stale URLs
  useEffect(() => {
    if (sandbox.sandboxUrl) {
      setSandboxUrl(sandbox.sandboxUrl);
      setIsLoadingFirstFragment(false);
    } else {
      // Clear stale sandbox URL when health check indicates no URL
      setSandboxUrl("");
    }
  }, [sandbox.sandboxUrl]);

  // Get fresh authentication when sandbox URL is available
  useEffect(() => {
    const currentUrl = sandbox.sandboxUrl || sandboxUrl;

    if (currentUrl && uiState === "ready") {
      console.log(
        "[V3ProjectView] Sandbox URL available, getting fresh authentication",
      );
      getFreshPreviewAuth();

      // Set hasActualContent to true if we're in ready state
      // This handles the case where content is already loaded
      if (!hasActualContent) {
        console.log(
          "[V3ProjectView] Setting hasActualContent to true for ready state",
        );
        setHasActualContent(true);
      }
    }
  }, [
    sandbox.sandboxUrl,
    sandbox.isHealthy,
    sandboxUrl,
    uiState,
    getFreshPreviewAuth,
    hasActualContent,
    isWaitingForContent,
  ]);

  // Clear manual refresh state when sandbox becomes healthy
  useEffect(() => {
    if (
      isManuallyRefreshing &&
      sandbox.isHealthy &&
      (sandbox.sandboxUrl || sandboxUrl)
    ) {
      console.log(
        "[V3ProjectView] Sandbox is healthy after refresh, clearing refresh state",
      );
      setIsManuallyRefreshing(false);
    }
  }, [isManuallyRefreshing, sandbox.isHealthy, sandbox.sandboxUrl, sandboxUrl]);

  // Mark first generation as complete when buildStatus becomes READY
  useEffect(() => {
    const buildStatus = projectData?.buildStatus;
    if (buildStatus === "READY" && !hasCompletedFirstGeneration) {
      console.log(
        "[V3ProjectView] Build status is READY - marking first generation as complete",
      );
      setHasCompletedFirstGeneration(true);
    }
  }, [projectData?.buildStatus, hasCompletedFirstGeneration]);

  // Track if we've triggered import sandbox creation to prevent duplicate calls
  const hasTriggeredImportSandboxRef = useRef(false);

  // Initialize sandbox for imported projects with AWAITING_SANDBOX status
  const initializeImportedSandbox = useMutation(
    trpc.projects.initializeImportedProjectSandbox.mutationOptions({
      onSuccess: (data) => {
        console.log(
          "[V3ProjectView] Imported project sandbox initialized:",
          data,
        );
        // Refetch project data to get updated buildStatus
        queryClient.invalidateQueries({
          queryKey: trpc.projects.getOne.queryKey({ projectId }),
        });
        // Invalidate health check query so useSandboxStateV3 refetches and gets the new sandbox info
        // This is critical for imported projects - without this, the UI stays stuck at "noPreview"
        // because sandbox.isHealthy remains false (stale data from before sandbox was created)
        queryClient.invalidateQueries({
          queryKey: trpc.projects.checkV2ProjectSandboxHealth.queryKey({
            projectId,
          }),
        });
      },
      onError: (error) => {
        console.error(
          "[V3ProjectView] Failed to initialize imported project sandbox:",
          error,
        );
        toast.error("Failed to initialize sandbox", {
          description: error.message,
        });
        // Reset the flag so user can retry
        hasTriggeredImportSandboxRef.current = false;
      },
    }),
  );

  // Auto-trigger sandbox creation for imported projects
  useEffect(() => {
    const buildStatus = projectData?.buildStatus;

    if (
      buildStatus === "AWAITING_SANDBOX" &&
      !hasTriggeredImportSandboxRef.current &&
      !initializeImportedSandbox.isPending
    ) {
      console.log(
        "[V3ProjectView] Detected imported project awaiting sandbox - triggering initialization",
      );
      hasTriggeredImportSandboxRef.current = true;
      initializeImportedSandbox.mutate({ projectId });
    }

    // Reset the flag when buildStatus changes away from AWAITING_SANDBOX
    if (
      buildStatus !== "AWAITING_SANDBOX" &&
      hasTriggeredImportSandboxRef.current
    ) {
      hasTriggeredImportSandboxRef.current = false;
    }
  }, [projectData?.buildStatus, projectId, initializeImportedSandbox]);

  // Sync isGenerationActive with activeStreamId when navigating back during active generation
  // This ensures the UI state is correct immediately on mount
  useEffect(() => {
    const activeStreamId = projectData?.activeStreamId;
    const buildStatus = projectData?.buildStatus;
    const isCurrentlyGenerating = Boolean(
      activeStreamId ||
      buildStatus === "GENERATING" ||
      buildStatus === "BUILDING" ||
      buildStatus === "INITIALIZING",
    );

    if (isCurrentlyGenerating && !isGenerationActive) {
      console.log(
        "[V3ProjectView] Detected active generation on mount/navigation - syncing isGenerationActive",
      );
      setIsGenerationActive(true);
    }
  }, [
    projectData?.activeStreamId,
    projectData?.buildStatus,
    isGenerationActive,
  ]);

  // For existing projects, mark first generation as complete only if no generation is currently active
  useEffect(() => {
    if (
      !isNewProject &&
      !hasCompletedFirstGeneration &&
      !isGenerationActive &&
      !hasActiveGeneration &&
      !projectData?.activeStreamId
    ) {
      setHasCompletedFirstGeneration(true);
    }
  }, [
    isNewProject,
    hasCompletedFirstGeneration,
    isGenerationActive,
    hasActiveGeneration,
    projectData?.activeStreamId,
  ]);

  // For imported projects, set hasActualContent to true once sandbox is healthy
  // This is because imported projects already have content, they just need the sandbox to be ready
  useEffect(() => {
    if (
      projectData?.codeImport &&
      sandbox.isHealthy &&
      sandbox.sandboxUrl &&
      !hasActualContent
    ) {
      console.log(
        "[V3ProjectView] Imported project with healthy sandbox - setting hasActualContent to true",
      );
      setHasActualContent(true);
    }
  }, [
    projectData?.codeImport,
    sandbox.isHealthy,
    sandbox.sandboxUrl,
    hasActualContent,
  ]);

  // Show migration HITL card when preview loads for imported projects that need migration
  useEffect(() => {
    const needsMigration =
      projectData?.importedFrom &&
      (projectData.importedFrom === "LOVABLE" ||
        projectData.importedFrom === "BASE44") &&
      (projectData?.backendMigrationStatus === "PENDING" ||
        projectData?.backendMigrationStatus === "FAILED");

    if (
      hasActualContent &&
      needsMigration &&
      !hasDismissedMigrationCard &&
      !showMigrationCard
    ) {
      console.log(
        "[V3ProjectView] Preview loaded for imported project with PENDING migration - showing migration card",
      );
      setShowMigrationCard(true);
    }
  }, [
    hasActualContent,
    projectData?.importedFrom,
    projectData?.backendMigrationStatus,
    hasDismissedMigrationCard,
    showMigrationCard,
  ]);

  // Mutation to update migration status
  const updateMigrationStatus = useMutation(
    trpc.codeImport.updateMigrationStatus.mutationOptions(),
  );

  // Handle migration approval - update status and send message to AI
  const handleMigrationApprove = useCallback(() => {
    if (!projectData?.importedFrom) return;

    setShowMigrationCard(false);
    setHasDismissedMigrationCard(true);

    // Update migration status to IN_PROGRESS
    updateMigrationStatus.mutate({
      projectId,
      status: "IN_PROGRESS",
    });

    // Simple trigger message - AI already has full instructions in system prompt
    const migrationPrompt = `[SYSTEM_HIDDEN] Start migration`;

    // Small delay to ensure chat is ready, then send
    setTimeout(() => {
      if (sendMessageToChatRef.current) {
        console.log("[V3ProjectView] Sending migration trigger to AI");
        sendMessageToChatRef.current({
          parts: [{ type: "text", text: migrationPrompt }],
        });
      } else {
        console.error("[V3ProjectView] sendMessageToChatRef not ready");
        toast.error("Failed to start migration. Please try again.");
      }
    }, 100);
  }, [projectData?.importedFrom, projectId, updateMigrationStatus]);

  // Handle migration skip - update status to SKIPPED
  const handleMigrationSkip = useCallback(() => {
    setShowMigrationCard(false);
    setHasDismissedMigrationCard(true);

    updateMigrationStatus.mutate({
      projectId,
      status: "SKIPPED",
    });
  }, [projectId, updateMigrationStatus]);

  // Store refreshPreview in a ref to avoid effect re-triggering
  const refreshPreviewRef = useRef(refreshPreview);
  useEffect(() => {
    refreshPreviewRef.current = refreshPreview;
  }, [refreshPreview]);

  // Watch for sandbox preview URL updates from Chat via Jotai atom
  // Track last processed timestamp to prevent duplicate triggers
  const lastProcessedTimestampRef = useRef<number>(0);

  useEffect(() => {
    if (
      sandboxPreviewUrlFromAtom?.shouldRefresh &&
      sandboxPreviewUrlFromAtom.timestamp !== lastProcessedTimestampRef.current
    ) {
      lastProcessedTimestampRef.current = sandboxPreviewUrlFromAtom.timestamp;

      // Only trigger refresh if we're not already in a refresh cycle
      // The fragment finalization handler already triggers a refresh, so we can skip this
      if (!isRefreshingRef.current) {
        console.log(
          "[V3ProjectView] Sandbox preview URL atom changed, triggering refresh",
        );
        refreshPreviewRef.current();
      } else {
        console.log(
          "[V3ProjectView] Refresh already in progress from atom change, skipping",
        );
      }
    }
  }, [sandboxPreviewUrlFromAtom]);

  // Reset file cycling and streaming state when UI becomes ready (sandbox is healthy)
  useEffect(() => {
    if (uiState === "ready") {
      console.log(
        "[V3ProjectView] UI state is ready, resetting file cycling and streaming state",
      );
      resetCycling();
      setIsStreamingFiles(false);
      setHasStartedStreaming(false);
    }
  }, [uiState, resetCycling]);

  // Handle generation completion for HAL suggestions
  const handleGenerationComplete = useCallback(async () => {
    console.log(
      "[V3ProjectView] AI generation complete - preview will refresh via debounced fragment update",
    );

    // Global completion toast: fires on every completed generation.
    showToast({
      title: "Finished working on shipper.now",
      message: "Your changes are done.",
    });

    // If HAL panel is open, trigger streaming generation for real-time feedback
    if (isHalPanelVisible) {
      setTriggerHalSuggestions(true);
      setIsLoadingSuggestions(true); // Track loading state for HAL panel generation
    } else {
      // If HAL panel is closed, generate suggestions in background and show indicator
      setIsLoadingSuggestions(true); // Track loading state for background generation
      try {
        // Use same endpoint as HalSuggestionsChat with message pattern
        const response = await fetch("/api/hal-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            hatType: "generalist",
            isSuggestionRequest: true, // FREE - no credits charged for proactive suggestions
            message: {
              id: `suggestion-${Date.now()}`,
              role: "user",
              parts: [
                {
                  type: "text",
                  text: "Please generate some suggestions for what I should work on next.",
                },
              ],
            },
          }),
        });

        if (response.ok && response.body) {
          // Consume the stream to completion
          const reader = response.body.getReader();
          const decoder = new TextDecoder();

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              // Just consume the stream, don't process it
              decoder.decode(value);
            }

            // Stream finished - now fetch and store the suggestions
            console.log(
              "[V3ProjectView] Background suggestion generation completed - fetching suggestions",
            );

            // Fetch the latest suggestions from the HAL chat
            const suggestions = await fetchLatestSuggestions();
            if (suggestions && suggestions.length > 0) {
              setHasNewSuggestions(true);
            }

            // Invalidate credits query to ensure balance is up-to-date
            // (Background suggestions are FREE, but this ensures consistency)
            queryClient.invalidateQueries({
              queryKey: trpc.credits.getMyCredits.queryKey(),
            });
          } finally {
            reader.releaseLock();
          }
        } else {
          console.error(
            "[V3ProjectView] Failed to generate background suggestions:",
            response.status,
          );
        }
      } catch (error) {
        console.error(
          "[V3ProjectView] Error generating background suggestions:",
          error,
        );
      }
    }
  }, [
    projectId,
    isHalPanelVisible,
    refreshPreview,
    fetchLatestSuggestions,
    showToast,
  ]);

  // Chat callbacks - defined outside JSX to prevent remounts
  const handleChatGenerationStateChange = useCallback(
    (isGenerating: boolean) => {
      console.log(
        "[V3ProjectView] Chat generation state changed:",
        isGenerating,
      );
      setIsGenerationActive(isGenerating);
    },
    [],
  );

  const handleChatCodingComplete = useCallback((completed: boolean) => {
    console.log("[V3ProjectView] Coding complete state changed:", completed);
    setIsCodingComplete(completed);
  }, []);

  const handleChatSendMessageReady = useCallback(
    (
      sendMessageFn: (message: {
        parts: Array<{ type: "text"; text: string }>;
      }) => void,
    ) => {
      console.log("[V3ProjectView] Chat sendMessage function ready");

      // Store the function for use by visual editing
      sendMessageToChatRef.current = sendMessageFn;
    },
    [],
  );

  const handleChatFragmentCreated = useCallback(async () => {
    console.log(
      "[V3ProjectView] Fragment created - relying on HMR for preview updates with fallback refresh",
    );

    // Mark generation as complete
    setHasCompletedFirstGeneration(true);

    // Show loading for new projects
    if (isNewProject && !loadedFragment) {
      setIsLoadingFirstFragment(true);
    }

    // Clear any existing timeout
    if (fragmentRefreshTimeoutRef.current) {
      clearTimeout(fragmentRefreshTimeoutRef.current);
    }

    // HMR will handle preview updates automatically in most cases
    setHasActualContent(true);
    setIsWaitingForContent(false);
    setIsCodingComplete(false);

    // REMOVED: Preview refresh that was causing visible iframe remount
    // HMR handles updates automatically, and the iframe remount is jarring
    // If needed, the user can manually refresh using the refresh button
    console.log(
      "[V3ProjectView] Fragment finalized - relying on HMR for preview updates",
    );

    // Schedule debounced refresh for fragment list only
    fragmentRefreshTimeoutRef.current = setTimeout(() => {
      console.log("[V3ProjectView] Debounced fragment refresh triggered");
      debouncedFragmentRefresh();

      // Error detection now handled automatically by AI chat tools
    }, 500); // 500ms debounce
  }, [isNewProject, loadedFragment, debouncedFragmentRefresh]);

  // Visual editing handlers
  const handleStyleChange = useCallback(
    async (styleChange: StyleChangeRequest) => {
      if (styleChange.isLive) {
        // Send live update to iframe
        const iframe = document.querySelector(
          'iframe[title="Preview"]',
        ) as HTMLIFrameElement;
        iframe?.contentWindow?.postMessage(
          {
            type: "APPLY_STYLE",
            payload: {
              selector: styleChange.elementInfo.selector,
              xpath: styleChange.elementInfo.xpath,
              shipperId: styleChange.elementInfo.shipperId,
              changes: styleChange.changes,
            },
          },
          "*",
        );
      } else {
        // Direct edit - apply changes directly to sandbox file
        const { elementInfo, changes } = styleChange;

        // Try to auto-detect file path from component name or selector
        const detectedFilePath = await detectComponentFile(elementInfo);

        if (detectedFilePath) {
          try {
            // Apply direct visual edit via tRPC endpoint
            // Include textContent if provided (for combined style+text mutations)
            await applyDirectEditMutation.mutateAsync({
              projectId,
              filePath: detectedFilePath,
              selector: elementInfo.selector,
              elementInfo: {
                componentName: elementInfo.componentName,
                textContent: elementInfo.textContent,
                currentClasses: elementInfo.currentStyles.tailwindClasses,
                shipperId: elementInfo.shipperId,
                isRepeated: elementInfo.isRepeated,
                instanceIndex: elementInfo.instanceIndex ?? undefined,
                totalInstances: elementInfo.totalInstances ?? undefined,
              },
              styleChanges: changes,
              textChanges: styleChange.textContent, // Include text content if provided
            });

            console.log(
              "[handleStyleChange] Direct visual edit applied successfully",
            );

            // Show success message to user
            toast.success("Visual changes applied successfully!");

            // Refresh preview to show changes immediately
            console.log(
              "[handleStyleChange] Triggering preview refresh to show changes",
            );
            // Wait longer to ensure HMR picks up the file change
            setTimeout(() => {
              console.log("[handleStyleChange] Executing preview refresh");
              refreshablePreviewRef.current?.refresh();
            }, 1500); // Longer delay to ensure Vite HMR picks up the change

            return;
          } catch (error) {
            console.error(
              "[handleStyleChange] Failed to apply direct edit:",
              error,
            );
            toast.error("Failed to apply visual changes. Please try again.");
            return;
          }
        } else {
          toast.error("Could not detect component file for visual edit.");
          return;
        }
      }
    },
    [projectId, trpc],
  );

  const handleTextContentChange = useCallback(
    async (textChange: TextContentChangeRequest) => {
      if (textChange.isLive) {
        // Send live update to iframe
        const iframe = document.querySelector(
          'iframe[title="Preview"]',
        ) as HTMLIFrameElement;
        iframe?.contentWindow?.postMessage(
          {
            type: "APPLY_TEXT",
            payload: {
              selector: textChange.elementInfo.selector,
              xpath: textChange.elementInfo.xpath,
              shipperId: textChange.elementInfo.shipperId,
              textContent: textChange.textContent,
            },
          },
          "*",
        );
      } else {
        // Finalized text change - apply directly to sandbox file
        const { elementInfo, textContent } = textChange;

        // Try to auto-detect file path from component name or selector
        const detectedFilePath = await detectComponentFile(elementInfo);

        if (detectedFilePath) {
          try {
            // Apply direct visual edit via tRPC endpoint
            await applyDirectEditMutation.mutateAsync({
              projectId,
              filePath: detectedFilePath,
              selector: elementInfo.selector,
              elementInfo: {
                componentName: elementInfo.componentName,
                textContent: elementInfo.textContent,
                currentClasses: elementInfo.currentStyles.tailwindClasses,
                shipperId: elementInfo.shipperId,
                isRepeated: elementInfo.isRepeated,
                instanceIndex: elementInfo.instanceIndex ?? undefined,
                totalInstances: elementInfo.totalInstances ?? undefined,
              },
              styleChanges: {},
              textChanges: textContent,
            });

            console.log(
              "[handleTextContentChange] Direct visual edit applied successfully",
            );

            // Show success message to user
            toast.success("Text changes applied successfully!");

            // Refresh preview to show changes immediately
            console.log(
              "[handleTextContentChange] Triggering preview refresh to show changes",
            );
            // Wait longer to ensure HMR picks up the file change
            setTimeout(() => {
              console.log(
                "[handleTextContentChange] Executing preview refresh",
              );
              refreshablePreviewRef.current?.refresh();
            }, 1500); // Longer delay to ensure Vite HMR picks up the change

            return;
          } catch (error) {
            console.error(
              "[handleTextContentChange] Failed to apply direct edit:",
              error,
            );
            toast.error("Failed to apply text changes. Please try again.");
            return;
          }
        } else {
          toast.error("Could not detect component file for visual edit.");
          return;
        }
      }
    },
    [projectId, trpc],
  );

  // Helper function to detect which file contains the component
  async function detectComponentFile(
    elementInfo: ElementInfo,
  ): Promise<string | null> {
    try {
      console.log("[detectComponentFile] Starting detection for element:", {
        shipperId: elementInfo.shipperId,
        componentName: elementInfo.componentName,
        hasLoadedFragment: !!loadedFragment?.id,
      });

      // Strategy 0: Use path from shipper ID (most reliable!)
      if (elementInfo.shipperId) {
        // NEW Shipper ID format: "components/TaskStats:47:6" or "components/TaskStats:47:6:usage:45:5"
        // The shipper ID always points to where the element is in the code (usage site for components)
        // OLD format: "TaskStats.tsx:47:6"
        const shipperIdParts = elementInfo.shipperId.split(":");
        const pathOrFilename = shipperIdParts[0];

        console.log(
          "[detectComponentFile] Extracted path/filename from shipper ID:",
          pathOrFilename,
        );

        // Check if this is a path (contains /) or just a filename
        const isFullPath = pathOrFilename.includes("/");

        if (isFullPath) {
          // New format with full path - can use directly!
          const filePath = `src/${pathOrFilename}.tsx`; // Add src/ prefix and .tsx extension
          console.log(
            "[detectComponentFile] Using full path from shipper ID:",
            filePath,
          );
          return filePath;
        }

        // Just a filename without path (e.g., "App" from "App:149:10")
        // This is the new format for root-level files
        // Try common locations
        console.log(
          "[detectComponentFile] Filename without path detected, trying common locations",
        );

        // Filename without path extension - add .tsx and try common paths
        const filename = pathOrFilename;
        // Add extension if not present (do this once for the whole function)
        const filenameWithExt =
          filename.endsWith(".tsx") || filename.endsWith(".jsx")
            ? filename
            : `${filename}.tsx`;
        console.log(
          "[detectComponentFile] Filename to locate:",
          filename,
          "with extension:",
          filenameWithExt,
        );

        // Check if shipper-id includes usage information (indicates element is inside .map() or similar)
        const usageIndex = shipperIdParts.indexOf("usage");
        if (usageIndex !== -1 && usageIndex + 2 < shipperIdParts.length) {
          // Format: filename:line:col:usage:mapLine:mapCol
          // The usage location is in the same file (where the .map() call is)
          console.log(
            "[detectComponentFile] Found usage info in shipper-id, using current file:",
            filename,
          );
          // The filename already points to the usage site, so we can use it directly
          // But we need to find the full path, not just the filename
        }

        // For repeated elements, check if we have usage info in shipper-id
        if (elementInfo.isRepeated) {
          console.log("[detectComponentFile] Repeated element detected");

          // If shipper-id includes usage info, the filename already points to the usage site
          if (usageIndex !== -1) {
            console.log(
              "[detectComponentFile] Usage info found in shipper-id, searching for file:",
              filename,
            );

            if (loadedFragment?.id) {
              // Query the fragment files to find the full path
              const fragment = await queryClient.fetchQuery(
                trpc.projects.getV2Fragment.queryOptions({
                  projectId,
                  fragmentId: loadedFragment.id,
                }),
              );

              if (fragment?.files) {
                const files = fragment.files as Record<string, string>;

                // Search for the file that matches the filename from shipper-id
                for (const filePath of Object.keys(files)) {
                  if (filePath.endsWith(filename)) {
                    console.log(
                      "[detectComponentFile] Found usage site file from shipper-id:",
                      filePath,
                    );
                    return filePath;
                  }
                }
              }
            }

            // Fallback: try common paths, prefer root for App/main files
            const isRootFile = filename === "App" || filename === "main";
            const primaryPath = isRootFile
              ? `src/${filenameWithExt}`
              : `src/components/${filenameWithExt}`;
            console.log(
              "[detectComponentFile] Using fallback path for usage site:",
              primaryPath,
            );
            return primaryPath;
          }

          // If no usage info in shipper-id, try to find usage site by searching
          console.log(
            "[detectComponentFile] No usage info in shipper-id, searching for usage site",
          );

          if (loadedFragment?.id) {
            // Query the fragment files
            const fragment = await queryClient.fetchQuery(
              trpc.projects.getV2Fragment.queryOptions({
                projectId,
                fragmentId: loadedFragment.id,
              }),
            );

            if (fragment?.files) {
              const files = fragment.files as Record<string, string>;

              // Search for files that import or use this component
              // Use the actual component name from elementInfo (e.g., "CardContent") not the filename
              const actualComponentName =
                elementInfo.componentName ||
                filename.replace(/\.(tsx|jsx)$/, "");
              const componentBaseName =
                actualComponentName.split("/").pop() || actualComponentName;

              console.log(
                "[detectComponentFile] Searching for usage of component:",
                {
                  filename,
                  actualComponentName,
                  componentBaseName,
                  elementComponentName: elementInfo.componentName,
                },
              );

              for (const [filePath, content] of Object.entries(files)) {
                // Skip the component definition file itself
                if (filePath.endsWith(filename)) continue;

                // Check if this file imports from the component file
                // For card.tsx, we look for: from './ui/card' or from '@/components/ui/card'
                const fileBaseName = filename.replace(/\.(tsx|jsx)$/, "");
                const hasImportFromFile =
                  content.includes(`from './${filename}'`) ||
                  content.includes(`from '../ui/${filename}'`) ||
                  content.includes(`from './ui/${filename}'`) ||
                  content.includes(`from './ui/${fileBaseName}'`) ||
                  content.includes(`from '@/components/ui/${fileBaseName}'`);

                // Check if this file uses ANY component from that file in a .map()
                // For card.tsx, this could be <Card, <CardContent, <CardHeader, etc.
                // So we search for the import and .map() together
                const hasMapUsage = content.includes(`.map(`);

                console.log(
                  `[detectComponentFile] Checking file ${filePath}:`,
                  {
                    hasImportFromFile,
                    hasMapUsage,
                    componentBaseName,
                    searchPattern: `<${componentBaseName}`,
                  },
                );

                if (hasImportFromFile && hasMapUsage) {
                  console.log(
                    "[detectComponentFile] ✓ Found usage site for repeated element:",
                    {
                      filePath,
                      fileBaseName,
                      componentBaseName,
                      hasImportFromFile: true,
                      hasMapUsage: true,
                    },
                  );
                  return filePath;
                }
              }

              console.log(
                "[detectComponentFile] No usage site found in fragment files",
              );
            }
          }

          // If no usage site found, fall through to component definition
          console.log(
            "[detectComponentFile] No usage site found, using component definition",
          );
        }

        // Use the loadedFragment if available
        if (!loadedFragment?.id) {
          console.warn(
            "[detectComponentFile] No loaded fragment, using filename-based heuristic",
          );
          // For root-level files like App.tsx, prefer src/ directory
          // For other files, prefer src/components/
          const isRootFile = filename === "App" || filename === "main";
          const primaryPath = isRootFile
            ? `src/${filenameWithExt}`
            : `src/components/${filenameWithExt}`;
          console.log(
            "[detectComponentFile] Detected as",
            isRootFile ? "root file" : "component file",
            "- using path:",
            primaryPath,
          );
          return primaryPath;
        }

        // Query the fragment files - use trpc client with await
        const fragment = await queryClient.fetchQuery(
          trpc.projects.getV2Fragment.queryOptions({
            projectId,
            fragmentId: loadedFragment.id,
          }),
        );

        if (!fragment?.files) {
          console.warn("[detectComponentFile] Fragment has no files");
          const isRootFile = filename === "App" || filename === "main";
          return isRootFile
            ? `src/${filenameWithExt}`
            : `src/components/${filenameWithExt}`;
        }

        const files = fragment.files as Record<string, string>;
        console.log(
          "[detectComponentFile] Fragment has",
          Object.keys(files).length,
          "files",
        );

        // Search for this filename in all fragment files
        for (const filePath of Object.keys(files)) {
          if (filePath.endsWith(filename)) {
            console.log("[detectComponentFile] Found file:", filePath);
            return filePath;
          }
        }

        console.log(
          "[detectComponentFile] Shipper ID filename not found in fragment files:",
          Object.keys(files),
        );
        console.log("[detectComponentFile] Falling back to heuristic path");
        const isRootFile = filename === "App" || filename === "main";
        return isRootFile
          ? `src/${filenameWithExt}`
          : `src/components/${filenameWithExt}`;
      }

      // Fallback if no shipper ID
      if (!loadedFragment?.id) {
        console.warn(
          "[detectComponentFile] No loaded fragment and no shipper ID",
        );
        return "src/App.tsx";
      }

      // Query the fragment files - use trpc client with await
      const fragment = await queryClient.fetchQuery(
        trpc.projects.getV2Fragment.queryOptions({
          projectId,
          fragmentId: loadedFragment.id,
        }),
      );

      if (!fragment?.files) {
        return "src/App.tsx";
      }

      const files = fragment.files as Record<string, string>;

      // Strategy 1: Use component name if available
      if (elementInfo.componentName) {
        const possiblePaths = [
          `src/components/${elementInfo.componentName}.tsx`,
          `src/components/${elementInfo.componentName}.jsx`,
          `src/${elementInfo.componentName}.tsx`,
          `src/${elementInfo.componentName}.jsx`,
        ];

        // Check if any of these files exist in the fragment
        for (const path of possiblePaths) {
          if (files[path]) {
            return path;
          }
        }
      }

      // Strategy 2: Search for className matches in files
      const currentClasses =
        elementInfo.currentStyles.tailwindClasses.join(" ");
      if (currentClasses) {
        for (const [filePath, content] of Object.entries(files)) {
          if (
            (filePath.endsWith(".tsx") || filePath.endsWith(".jsx")) &&
            content.includes(currentClasses)
          ) {
            return filePath;
          }
        }
      }

      // Strategy 3: Fallback to App.tsx if it exists
      if (files["src/App.tsx"]) return "src/App.tsx";
      if (files["src/App.jsx"]) return "src/App.jsx";
      if (files["src/main.tsx"]) return "src/main.tsx";
      if (files["src/main.jsx"]) return "src/main.jsx";

      // Strategy 4: Return first .tsx/.jsx file in src/
      const srcFiles = Object.keys(files).filter(
        (path) =>
          path.startsWith("src/") &&
          (path.endsWith(".tsx") || path.endsWith(".jsx")),
      );

      if (srcFiles.length > 0) {
        return srcFiles[0];
      }

      // Last resort
      return "src/App.tsx";
    } catch (error) {
      console.error("[detectComponentFile] Error detecting file:", error);
      // Fallback to App.tsx on error
      return "src/App.tsx";
    }
  }

  const handleTextPrompt = useCallback((textChange: TextChangeRequest) => {
    const { elementInfo, prompt } = textChange;

    // Build a simple, focused message for the AI
    let message = `${prompt}\n\n`;

    // Add precise element location using shipper ID
    if (elementInfo.shipperId) {
      const [filename, line] = elementInfo.shipperId.split(":");
      message += `File: ${filename}, Line: ${line}`;
    } else {
      // Fallback to selector if no shipper ID
      message += `Element: ${elementInfo.selector}`;
    }

    if (elementInfo.currentStyles.tailwindClasses.length > 0) {
      message += `\nCurrent classes: ${elementInfo.currentStyles.tailwindClasses.join(" ")}`;
    }

    if (sendMessageToChatRef.current) {
      sendMessageToChatRef.current({
        parts: [{ type: "text", text: message }],
      });
    }
  }, []);

  // PostMessage listener for visual editing events
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { type, payload } = event.data;

      if (type === "VISUAL_EDIT_READY") {
        console.log("[Visual Editor] Ready");
        toast.success("Visual editing mode enabled");
      } else if (type === "ELEMENT_SELECTED") {
        setSelectedElement(payload);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [setSelectedElement]);

  // Define all fragment callbacks at top level to avoid conditional hook calls
  const handleGitLatestFragmentChange = useCallback((fragment: any) => {
    setLatestFragmentFromList(fragment);
  }, []);

  const handleGitRefreshActiveFragment = useCallback(() => {
    console.log(
      "[V3ProjectView] Refreshing active fragment info for git fragments list",
    );
    sandbox.actions.checkHealth();
  }, [sandbox.actions]);

  const handleSwitchToCommit = useCallback(
    (commitHash: string, fragmentData: any) => {
      console.log(
        "[V3ProjectView] Git commit switched from fragments list:",
        commitHash,
      );

      // Mark that we've completed at least one generation
      setHasCompletedFirstGeneration(true);

      // Set the loaded fragment data for code view
      if (fragmentData) {
        setLoadedFragment({
          id: commitHash,
          title: fragmentData.title,
          files: {}, // Git fragments don't expose files directly
          commitHash: commitHash,
        });
      }

      // Git switching will update sandbox state automatically
    },
    [],
  );

  const handleV2LatestFragmentChange = useCallback((fragment: any) => {
    setLatestFragmentFromList(fragment);
  }, []);

  const handleV2RefreshActiveFragment = useCallback(() => {
    console.log(
      "[V3ProjectView] Refreshing active fragment info for fragments list",
    );
    sandbox.actions.checkHealth();
  }, [sandbox.actions]);

  const handleV2LoadFragment = useCallback(
    (fragmentId: string, fragmentData: any) => {
      console.log(
        "[V3ProjectView] Fragment loaded from above chat:",
        fragmentId,
      );

      // Mark that we've completed at least one generation
      setHasCompletedFirstGeneration(true);

      // Set the loaded fragment data for code view
      if (fragmentData?.files) {
        setLoadedFragment({
          id: fragmentData.id,
          title: fragmentData.title,
          files: normalizeFilePaths(fragmentData.files),
        });
      }

      // Fragment loading will update sandbox state automatically
    },
    [normalizeFilePaths],
  );

  // Handle deployment
  const handleDeploy = useCallback(
    (subdomain?: string) => {
      if (!projectId) return;

      console.log(
        "[v3-project-view] handleDeploy called with subdomain:",
        subdomain,
      );

      deployAppMutation.mutate({
        projectId,
        subdomain,
        appName: projectData?.name || undefined,
      });
    },
    [projectId, projectData?.name, deployAppMutation],
  );

  // Sandbox monitoring event handlers
  const handleSandboxError = useCallback((error: RuntimeErrorEvent["data"]) => {
    console.error("[V3ProjectView] Sandbox runtime error:", error);

    // Add to error history (keep last 10)
    setSandboxErrors((prev) => [error, ...prev.slice(0, 9)]);

    // Add to visible error stack (don't auto-hide)
    setVisibleErrors((prev) => {
      // Check if this exact error is already visible to avoid duplicates
      const isDuplicate = prev.some(
        (e) =>
          e.message === error.message &&
          e.filename === error.filename &&
          e.lineno === error.lineno,
      );
      if (isDuplicate) return prev;
      return [error, ...prev];
    });

    // Mark that we have active errors (stops auto-refresh)
    setHasActiveErrors(true);

    // Add error to console logs
    const errorLog = {
      level: "error" as const,
      message: `${error.message}${error.filename ? ` at ${error.filename}:${error.lineno}` : ""}`,
      timestamp: new Date(),
    };
    setConsoleLogs((prev) => [errorLog, ...prev].slice(0, 100));
  }, []);

  const handleNetworkRequest = useCallback(
    (request: NetworkRequestEvent["data"]) => {
      console.log("[V3ProjectView] Sandbox network request:", {
        url: request.url,
        method: request.method,
        status: request.status,
        duration: request.duration,
      });

      // Track failed requests
      if (request.error || (request.status && request.status >= 400)) {
        console.warn("[V3ProjectView] Network request failed:", request);
      }
    },
    [],
  );

  const handleConsoleOutput = useCallback(
    (output: ConsoleOutputEvent["data"]) => {
      // Add to console logs state for WebPreviewConsole
      const newLogs = output.messages.map((msg) => ({
        level:
          msg.level === "warning"
            ? ("warn" as const)
            : msg.level === "error"
              ? ("error" as const)
              : ("log" as const),
        message: msg.message,
        timestamp: new Date(msg.logged_at),
      }));

      setConsoleLogs((prev) => [...newLogs, ...prev].slice(0, 100)); // Keep last 100 logs

      // Elevate ALL console.error messages to visible error notifications
      // Frameworks like Convex handle errors internally and log to console.error
      // rather than throwing globally, so we need to catch these
      output.messages.forEach((msg) => {
        if (msg.level === "error") {
          console.warn(
            "[V3ProjectView] Console error detected, elevating to visible notification:",
            msg.message,
          );

          // Create a RuntimeErrorEvent-like object for the visible errors
          const errorData = {
            message: msg.message,
            filename: "console.error",
            lineno: 0,
            colno: 0,
            stack: undefined,
            blankScreen: false,
          };

          // Add to visible errors (with deduplication)
          setVisibleErrors((prev) => {
            const isDuplicate = prev.some((e) => e.message === msg.message);
            if (isDuplicate) return prev;
            return [errorData, ...prev.slice(0, 4)]; // Keep max 5 errors
          });

          setHasActiveErrors(true);
          setSandboxErrors((prev) => [errorData, ...prev.slice(0, 9)]);
        }
      });

      // Also log to parent console for debugging
      output.messages.forEach((msg) => {
        const logFn =
          msg.level === "error"
            ? console.error
            : msg.level === "warning"
              ? console.warn
              : console.log;
        logFn(`[Sandbox Console] ${msg.message}`);
      });
    },
    [],
  );

  const handleUrlChange = useCallback((url: string) => {
    console.log("[V3ProjectView] Sandbox URL changed:", url);
  }, []);

  // Handle monitor initialization
  const handleMonitorInitialized = useCallback(() => {
    console.log("[V3ProjectView] Monitor initialized");

    // Notify RefreshableWebPreview that monitor is initialized
    refreshablePreviewRef.current?.onMonitorInitialized();
  }, []);

  const handleContentLoaded = useCallback(
    (data: ContentLoadedEvent["data"]) => {
      console.log("[V3ProjectView] Content loaded:", data);

      if (data.hasContent) {
        setHasActualContent(true);
        setIsWaitingForContent(false);

        // Clear coding complete state now that content has loaded
        // This will hide the "Coding is done!" banner
        setIsCodingComplete(false);

        // Notify RefreshableWebPreview that content loaded
        refreshablePreviewRef.current?.onContentLoaded();

        // Clear refreshing state after content is confirmed
        setTimeout(() => {
          setIsManuallyRefreshing(false);
          isRefreshingRef.current = false;
        }, 500);

        // Clear visible errors on successful content load (app is working)
        setVisibleErrors([]);
        setHasActiveErrors(false);
      }
    },
    [],
  );
  console.log("[V3ProjectView] hasActualContent:", hasActualContent);
  console.log("[V3ProjectView] isWaitingForContent:", isWaitingForContent);

  // Handler to dismiss individual errors
  const handleDismissError = useCallback((errorIndex: number) => {
    setVisibleErrors((prev) => {
      const newErrors = prev.filter((_, index) => index !== errorIndex);
      // If no more visible errors, clear the active errors flag
      if (newErrors.length === 0) {
        setHasActiveErrors(false);
      }
      return newErrors;
    });
  }, []);

  return (
    <div
      className="bg-prj-bg-primary flex flex-col pb-2 md:h-screen md:pb-0"
      style={{ height: viewportHeight > 0 ? `${viewportHeight}px` : "100vh" }}
    >
      <ProjectHeader
        projectId={projectId}
        session={session}
        projectFiles={normalizedProjectFiles}
        isSandboxReady={sandboxReady}
        sandboxStatus={sandboxStatus}
        sandboxFiles={sandboxFiles}
        onSuggestionClick={handleSuggestionClick}
        onToggleHalPanel={handleToggleHalPanel}
        isHalPanelOpen={isHalPanelVisible}
        hasNewSuggestions={hasNewSuggestions}
        onHistoryClick={() => setIsHistoryModalOpen(true)}
        onToggleSidebar={() => setIsSidebarHidden(!isSidebarHidden)}
        isSidebarHidden={isSidebarHidden}
        mobileActiveSection={mobileActiveSection}
        onMobileSectionChange={setMobileActiveSection}
        tabState={tabState}
      />
      <ResizablePanelGroup
        direction="horizontal"
        id="project-view-v3-panels"
        className="relative flex-1"
      >
        <ResizablePanel
          id="chat-panel"
          order={1}
          defaultSize={isSidebarHidden ? 20 : 30}
          minSize={isSidebarHidden ? 20 : 30}
          maxSize={isSidebarHidden ? 20 : 100}
          className={`flex min-h-0 flex-col transition-all duration-100 ease-in-out ${mobileActiveSection !== "chat" ? "hidden md:flex" : "flex"}`}
        >
          <ProjectHeader
            projectId={projectId}
            session={session}
            projectFiles={normalizedProjectFiles}
            isSandboxReady={sandboxReady}
            sandboxStatus={sandboxStatus}
            sandboxFiles={sandboxFiles}
            onSuggestionClick={handleSuggestionClick}
            onToggleHalPanel={handleToggleHalPanel}
            isHalPanelOpen={isHalPanelVisible}
            hasNewSuggestions={hasNewSuggestions}
            onHistoryClick={() => {
              setIsHistoryModalOpen(true);
              // Trigger refresh when modal opens
              setTimeout(() => {
                gitFragmentsListRef.current?.refresh();
                v2FragmentsListRef.current?.refresh();
              }, 0);
            }}
            onToggleSidebar={() => setIsSidebarHidden(!isSidebarHidden)}
            isSidebarHidden={isSidebarHidden}
            mobileActiveSection={mobileActiveSection}
            onMobileSectionChange={setMobileActiveSection}
            tabState={tabState}
            hideOnMobile={true}
          />

          <Dialog
            open={isHistoryModalOpen}
            onOpenChange={setIsHistoryModalOpen}
          >
            <DialogContent
              className="rounded-prj-dialog md:rounded-prj-dialog rounded-t-prj-dialog data-[state=closed]:slide-out-to-right md:data-[state=closed]:slide-out-to-right data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-right md:data-[state=open]:slide-in-from-right data-[state=open]:slide-in-from-bottom shadow-prj-dialog top-4 right-0 left-0 h-[calc(100vh-5rem)] !max-w-full translate-x-0 translate-y-0 overflow-y-scroll rounded-b-none p-0 md:right-4 md:left-auto md:h-[calc(100vh-2rem)] md:!max-w-[440px]"
              showCloseButton={false}
            >
              <div className="flex h-full flex-col">
                {/* Header */}
                <div className="border-prj-border-secondary flex items-center justify-between border-b p-4 dark:border-[#26263D] dark:bg-[#1A2421]">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="border-prj-border-button-outer bg-prj-gradient-button shadow-prj-button h-6 w-6 rounded-md border border-[1.5px] dark:border-[#26263D] dark:bg-none"
                      onClick={() => setIsHistoryModalOpen(false)}
                    >
                      <ArrowLeftIcon className="h-4 w-4 dark:text-[#B8C9C3]" />
                    </Button>
                    <h2 className="text-prj-text-heading text-[16px] font-semibold dark:text-[#F5F9F7]">
                      Version History
                    </h2>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="hidden h-8 w-8 rounded-full md:flex dark:text-[#B8C9C3]"
                  >
                    <SearchIcon className="h-4 w-4" />
                  </Button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-4 py-4 pb-20 md:px-5 md:py-5 md:pb-5 dark:bg-[#1A2421]">
                  {gitFragments && gitFragments.length > 0 ? (
                    <GitFragmentsList
                      ref={gitFragmentsListRef}
                      projectId={projectId}
                      activeCommitHash={projectData?.gitCommitHash || undefined}
                      isGenerationActive={isGenerationActive}
                      onLatestFragmentChange={handleGitLatestFragmentChange}
                      onFragmentRefresh={refreshPreview}
                      onRefreshActiveFragment={handleGitRefreshActiveFragment}
                      onSwitchToCommit={handleSwitchToCommit}
                    />
                  ) : (
                    <V2FragmentsList
                      ref={v2FragmentsListRef}
                      projectId={projectId}
                      activeFragmentId={
                        loadedFragment?.id ||
                        projectData?.activeFragmentId ||
                        undefined
                      }
                      isGenerationActive={isGenerationActive}
                      onLatestFragmentChange={handleV2LatestFragmentChange}
                      onFragmentRefresh={refreshPreview}
                      onRefreshActiveFragment={handleV2RefreshActiveFragment}
                      onLoadFragment={handleV2LoadFragment}
                    />
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Suspense fallback={<LoadingSpinner />}>
            <Chat
              key={`chat-${projectId}`}
              id={projectId}
              projectId={projectId}
              userId={session.user.id}
              shouldResume={shouldResumeStream}
              buildStatus={projectData?.buildStatus}
              sandboxStatus={sandboxStatus}
              sandboxReady={sandboxReady}
              isRecovering={sandbox.isRecovering}
              isWaitingForContent={isWaitingForContent}
              isFetchingPreviewAuth={isFetchingPreviewAuth}
              isCodingComplete={isCodingComplete}
              uiState={uiState}
              onGenerationStateChange={useCallback((isGenerating: boolean) => {
                console.log(
                  "[V3ProjectView] Chat generation state changed:",
                  isGenerating,
                );
                setIsGenerationActive(isGenerating);
              }, [])}
              onGenerationComplete={handleGenerationComplete}
              onSendMessageReady={handleChatSendMessageReady}
              onFragmentCreated={handleChatFragmentCreated}
              onCodingComplete={handleChatCodingComplete}
              initialMessages={initialMessages}
              initialPrompt={initialPrompt}
              advisorSuggestions={latestAdvisorSuggestions}
              isLoadingSuggestions={isLoadingSuggestions}
              onToggleAdvisor={handleToggleAdvisor}
              migrationCard={
                showMigrationCard &&
                projectData?.importedFrom &&
                (projectData.importedFrom === "LOVABLE" ||
                  projectData.importedFrom === "BASE44")
                  ? {
                      show: true,
                      platform: projectData.importedFrom,
                      onApprove: handleMigrationApprove,
                      onSkip: handleMigrationSkip,
                    }
                  : undefined
              }
              shipperCloudEnabled={projectData?.shipperCloudEnabled ?? false}
              onOpenCloudCreditsModal={() => setIsCloudCreditsModalOpen(true)}
            />
          </Suspense>
        </ResizablePanel>
        {!isSidebarHidden && (
          <ResizableHandle
            withHandle
            className="mt-[84px] mb-6 hidden cursor-col-resize transition-all duration-200 md:block"
          />
        )}

        {/* HAL Assistant Panel */}
        {isHalPanelVisible && (
          <>
            <ResizablePanel
              id="hal-panel"
              order={2}
              defaultSize={isSidebarHidden ? 0 : 30}
              minSize={isSidebarHidden ? 0 : 30}
              maxSize={isSidebarHidden ? 0 : 35}
              className={`flex min-h-0 flex-col ${mobileActiveSection !== "assistant" ? "hidden md:flex" : "flex"}`}
            >
              <HalSuggestionsChatWrapper
                projectId={projectId}
                projectFiles={normalizedProjectFiles}
                isSandboxReady={sandboxReady}
                onSuggestionClick={handleSuggestionClick}
                onClose={() => setIsHalPanelVisible(false)}
                triggerSuggestions={triggerHalSuggestions}
                onSuggestionsTriggered={handleSuggestionsTriggered}
                onSuggestionsGenerated={handleSuggestionsGenerated}
                className="h-full"
                shouldGenerateSuggestions={false}
                isNewProject={isNewProject}
              />
            </ResizablePanel>
            <ResizableHandle
              withHandle
              className="mt-[84px] mb-6 hidden cursor-col-resize transition-all duration-200 md:block"
            />
            {/* 12px spacer panel to allow two consecutive handles */}
            <ResizablePanel
              id="hal-spacer"
              order={3}
              defaultSize={1}
              minSize={1}
              maxSize={1}
              className="hidden w-[12px] max-w-[12px] min-w-[12px] md:block"
            >
              <div className="h-full w-[12px]" />
            </ResizablePanel>
            <ResizableHandle
              withHandle
              className="mt-[84px] mb-6 hidden cursor-col-resize transition-all duration-200 md:block"
            />
          </>
        )}

        <ResizablePanel
          id="preview-panel"
          order={isHalPanelVisible ? 4 : 2}
          defaultSize={isHalPanelVisible ? 45 : 70}
          minSize={isHalPanelVisible ? 35 : 50}
          className={`flex min-h-0 flex-col rounded-md ${mobileActiveSection !== "preview" ? "hidden md:flex" : "flex"
            }`}
        >
          <Tabs
            defaultValue="preview"
            className="flex h-full flex-col gap-y-0"
            value={tabState}
            onValueChange={(value) => {
              setTabState(value as "code" | "preview");
            }}
          >
            <div
              className={`flex h-[72px] items-center justify-between py-4 pr-4 pl-4 transition-all duration-100 ease-in-out md:pr-6 md:pl-0 dark:text-[#B8C9C3] ${isSidebarHidden ? "pl-0" : "pr-6"}`}
            >
              {/* Left side - Refresh and Open in new tab */}
              <div className="flex items-center gap-1 md:gap-2">
                <SettingsButton />
                <WebPreviewNavigation>
                  <HelpMenu />
                  <WebPreviewNavigationButton
                    tooltip="Refresh page"
                    onClick={() => refreshPreview({ skipHealthCheck: false })}
                    disabled={isManuallyRefreshing}
                  >
                    <RefreshIcon />
                  </WebPreviewNavigationButton>
                  {/* <WebPreviewUrl /> */}
                  <WebPreviewNavigationButton
                    tooltip="Open in new tab"
                    onClick={() => {
                      // Use authenticatedPreviewUrl which comes from the server
                      // and is already transformed to the shipper.now domain
                      const urlToOpen =
                        authenticatedPreviewUrl ||
                        sandbox.sandboxUrl ||
                        sandboxUrl;
                      window.open(urlToOpen, "_blank");
                    }}
                  >
                    <LinkIcon />
                  </WebPreviewNavigationButton>
                </WebPreviewNavigation>

                {/* Preview size selector */}
                <PreviewSizeSelector
                  selectedSize={previewSize}
                  onSizeChange={setPreviewSize}
                  className="hidden md:flex"
                />
              </div>

              {/* Right side - Tab switcher and actions */}

              <div className="flex items-center gap-1 md:gap-2">
                <TabsList className="bg-prj-bg-secondary h-[28px] w-[52px] rounded-md p-[2px] shadow-sm">
                  <TabsTrigger
                    className="data-[state=active]:bg-prj-bg-active rounded-[6px] p-[4px] transition-all duration-100 data-[state=active]:shadow-sm dark:data-[state=active]:bg-black"
                    value="code"
                  >
                    <CodeViewIcon
                      className="transition-opacity dark:text-[#B8C9C3]"
                      size={12}
                    />
                  </TabsTrigger>
                  <TabsTrigger
                    className="data-[state=active]:bg-prj-bg-active rounded-[6px] px-[4px] transition-all duration-100 data-[state=active]:shadow-sm dark:data-[state=active]:bg-black"
                    value="preview"
                  >
                    <PreviewViewIcon
                      className="transition-opacity dark:text-[#B8C9C3]"
                      size={12}
                    />
                  </TabsTrigger>
                </TabsList>
                {/* <Button
                  size="sm"
                  onClick={() => setIsHistoryModalOpen(true)}
                  className="flex-1 bg-[#F3F3EE] text-[#1C1C1C] rounded-md gap-2"
                >
                  <RotateLeftIcon />
                  <span>Version History</span>
                </Button> */}
                <GitHubIntegration
                  projectId={projectId}
                  sandboxFiles={sandboxFiles}
                />
                <div className="hidden md:flex">
                  <HalAssistant
                    projectId={projectId}
                    projectFiles={normalizedProjectFiles}
                    isSandboxReady={sandboxReady}
                    hasNewDeliverable={hasNewSuggestions || false}
                    onSuggestionClick={handleSuggestionClick}
                    isControlledExternally={false}
                    // onToggle={handleToggleHalPanel}
                    // isOpen={isHalPanelVisible}
                    onExpand={() => setIsHalPanelVisible(true)}
                    onDeliverableViewed={() => setHasNewSuggestions(false)}
                  />
                </div>
                <DeployMenu
                  projectId={projectId}
                  isDeploying={isDeploying}
                  isDeployed={isDeployed}
                  deploymentUrl={projectData?.deploymentUrl || undefined}
                  deployedAt={
                    projectData?.deployedAt
                      ? new Date(projectData.deployedAt)
                      : undefined
                  }
                  needsUpdate={needsUpdate}
                  onDeploy={handleDeploy}
                  sandboxReady={sandboxReady}
                />
              </div>
            </div>

            <div
              className={`flex-1 overflow-hidden ${isSidebarHidden ? "absolute top-[72px] left-0 h-[calc(100vh-72px)] w-screen" : "border-prj-border-primary mx-2 mb-3 rounded-2xl border md:mr-3 md:ml-0"}`}
            >
              <TabsContent value="preview" className="h-full">
                {/* Deployment Result Notification */}
                {deploymentResult && (
                  <div
                    className={`mb-4 rounded-lg border p-3 ${deploymentResult.success
                      ? "bg-prj-bg-success border-prj-border-success text-prj-text-success"
                      : "bg-prj-bg-error border-prj-border-error text-prj-text-error"
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        {deploymentResult.success ? (
                          <RocketIcon className="mr-2 h-4 w-4" />
                        ) : (
                          <span className="mr-2">⚠️</span>
                        )}
                        <span className="font-medium">
                          {deploymentResult.success
                            ? "Deployment Successful!"
                            : "Deployment Failed"}
                        </span>
                      </div>
                      <button
                        onClick={() => setDeploymentResult(null)}
                        className="text-sm opacity-70 hover:opacity-100"
                      >
                        ✕
                      </button>
                    </div>
                    {deploymentResult.success &&
                      deploymentResult.deploymentUrl && (
                        <div className="mt-2">
                          <a
                            href={deploymentResult.deploymentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm underline hover:no-underline"
                          >
                            View deployed app: {deploymentResult.deploymentUrl}
                          </a>
                        </div>
                      )}
                    {!deploymentResult.success && deploymentResult.error && (
                      <>
                        <div className="mt-2 text-sm">
                          {deploymentResult.buildFailed &&
                            deploymentResult.error.length > 200
                            ? "Build failed with errors. See details below."
                            : deploymentResult.error}
                        </div>
                        {deploymentResult.buildFailed &&
                          deploymentResult.logs && (
                            <div className="mt-3">
                              <details
                                className="text-xs"
                                open={deploymentResult.error.length > 200}
                              >
                                <summary className="cursor-pointer hover:underline">
                                  {deploymentResult.error.length > 200
                                    ? "View build errors and logs"
                                    : "View build logs"}
                                </summary>
                                <div className="mt-2 max-h-60 overflow-y-auto">
                                  <CodeBlock
                                    code={deploymentResult.logs}
                                    language="bash"
                                    className="text-xs"
                                  >
                                    <CodeBlockCopyButton />
                                  </CodeBlock>
                                </div>
                              </details>
                              <Button
                                size="sm"
                                variant="outline"
                                className="mt-2 h-7 text-xs"
                                onClick={() => {
                                  // Send build error to chat
                                  const chatInput = document.querySelector(
                                    "[data-chat-input]",
                                  ) as HTMLTextAreaElement;
                                  if (chatInput) {
                                    const errorMessage = `The deployment failed with build errors. Can you help fix these TypeScript errors?\n\n\`\`\`\n${deploymentResult.logs}\n\`\`\``;

                                    // For React controlled components, we need to trigger the onChange event properly
                                    const nativeInputValueSetter =
                                      Object.getOwnPropertyDescriptor(
                                        window.HTMLTextAreaElement.prototype,
                                        "value",
                                      )?.set;

                                    if (nativeInputValueSetter) {
                                      nativeInputValueSetter.call(
                                        chatInput,
                                        errorMessage,
                                      );
                                    }

                                    // Trigger React's synthetic event
                                    const inputEvent = new Event("input", {
                                      bubbles: true,
                                    });
                                    chatInput.dispatchEvent(inputEvent);

                                    // Clear the deployment result
                                    setDeploymentResult(null);

                                    // Focus the chat input
                                    chatInput.focus();

                                    // Find and click the submit button after a brief delay
                                    setTimeout(() => {
                                      const form = chatInput.closest("form");
                                      if (form) {
                                        const submitButton = form.querySelector(
                                          'button[type="submit"]',
                                        );
                                        if (
                                          submitButton instanceof
                                          HTMLButtonElement
                                        ) {
                                          submitButton.click();
                                        }
                                      }
                                    }, 200);
                                  }
                                }}
                              >
                                Send error to AI for help
                              </Button>
                            </div>
                          )}
                      </>
                    )}
                  </div>
                )}
                {isStreamingFiles ? (
                  <FileCreationPreview
                    projectId={projectId}
                    queuedFiles={queuedFiles}
                    displayedFile={displayedFile}
                    displayedHtml={displayedHtml}
                    onAddFileToQueue={addFileToQueue}
                    uiState={uiState}
                    onGoToNext={goToNext}
                    onGoToPrevious={goToPrevious}
                    onGoToIndex={goToIndex}
                  />
                ) : visibleErrors.length > 0 ? (
                  <div className="bg-prj-bg-secondary relative flex h-full w-full items-start justify-center overflow-auto">
                    <div
                      className="h-full w-full transition-all duration-300 ease-in-out"
                      style={{
                        width: getPreviewWidth(previewSize),
                        maxWidth: "100%",
                      }}
                    >
                      <PreviewErrorScreen
                        onRefresh={() =>
                          refreshPreview({ skipHealthCheck: false })
                        }
                        isRefreshing={isManuallyRefreshing}
                      />
                    </div>
                  </div>
                ) : uiState === "ready" || uiState === "waitingForContent" ? (
                  <div className="bg-prj-bg-secondary relative flex h-full w-full items-start justify-center overflow-auto">
                    <div
                      className="h-full transition-all duration-300 ease-in-out"
                      style={{
                        width: getPreviewWidth(previewSize),
                        maxWidth: "100%",
                      }}
                    >
                      {/* Persistent loading background behind iframe */}
                      <div className="absolute inset-0 z-0 flex flex-col items-center justify-center gap-4 bg-white dark:bg-[#1A2421]">
                        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600 dark:border-gray-700 dark:border-t-blue-500"></div>
                        <div className="text-center">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Loading your app...
                          </p>
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Please wait while your application loads
                          </p>
                        </div>
                      </div>

                      {/* Iframe will render on top with higher z-index */}
                      <RefreshableWebPreview
                        ref={refreshablePreviewRef}
                        defaultUrl={
                          originalPreviewUrl ||
                          authenticatedPreviewUrl ||
                          sandbox.sandboxUrl ||
                          sandboxUrl
                        }
                        className={`relative z-10 h-full ${isSidebarHidden ? "[&>div]:border-0" : ""} ${previewSize !== "desktop" ? "shadow-lg" : ""}`}
                        autoRefreshOnTimeout={!hasActiveErrors}
                        contentLoadTimeout={10000}
                      >
                        {/* <>
                        <WebPreviewUrl />
                      </> */}
                        <WebPreviewBody />
                        {/* <WebPreviewConsole /> */}
                      </RefreshableWebPreview>
                    </div>

                    {/* Loading overlay when waiting for content */}
                    {uiState === "waitingForContent" && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 dark:bg-black/80">
                        <PreviewLoadingAnimation
                          title={
                            projectData?.buildStatus === "INITIALIZING"
                              ? "Initializing Sandbox"
                              : projectData?.buildStatus === "BUILDING"
                                ? "Building Application"
                                : "Loading App Content"
                          }
                          subtitle={
                            projectData?.buildStatus === "INITIALIZING"
                              ? "Setting up your development environment. This takes about 15-30 seconds..."
                              : projectData?.buildStatus === "BUILDING"
                                ? "Running build commands and compiling your app. This may take a moment..."
                                : "Waiting for your app to fully load and render. This ensures HMR is complete and React is ready..."
                          }
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  (() => {
                    let title = "";
                    let subtitle: React.ReactNode = "";
                    const buildStatus = projectData?.buildStatus;

                    switch (uiState) {
                      case "refreshing":
                        title = "Refreshing Preview";
                        subtitle =
                          "Restarting your sandbox and server to ensure the latest changes are reflected...";
                        break;
                      case "recovering":
                        title = sandbox.recoveryProgress
                          ? `Restoring Expired Sandbox — ${sandbox.recoveryProgress.stage}`
                          : "Restoring Expired Sandbox";
                        subtitle = sandbox.recoveryProgress ? (
                          <div>
                            <div className="font-medium">
                              {sandbox.recoveryProgress.message}
                            </div>
                            <div className="text-muted-foreground mt-1 text-sm">
                              {sandbox.recoveryProgress.progress != null
                                ? `${sandbox.recoveryProgress.progress}% — ${sandbox.recoveryProgress.stage}`
                                : sandbox.recoveryProgress.stage}
                            </div>
                          </div>
                        ) : (
                          "Your sandbox has expired. Automatically creating a new one and restoring your latest code..."
                        );
                        break;
                      case "loadingFragment":
                        title = "Loading Preview";
                        subtitle =
                          "Setting up your app and loading the preview...";
                        break;
                      case "awaitingSandbox":
                        title = "Setting Up Imported Project";
                        subtitle =
                          "Creating sandbox and restoring your imported files. This takes about 15-30 seconds...";
                        break;
                      case "generating":
                        // Use buildStatus to show more specific messages
                        if (buildStatus === "INITIALIZING") {
                          title = "Setting Up Development Environment";
                          subtitle =
                            "Creating your sandbox and initializing the workspace. This takes about 15-30 seconds...";
                        } else if (buildStatus === "BUILDING") {
                          title = "Building Your Application";
                          subtitle =
                            "Running build commands and preparing your app. Preview will be ready shortly...";
                        } else if (buildStatus === "GENERATING") {
                          title = "AI Generating Code";
                          subtitle =
                            "The AI is writing code and creating files for your app. This may take a moment...";
                        } else {
                          // Fallback for legacy states
                          title = "AI Generating Code";
                          subtitle =
                            "The AI is currently generating code and building your app. Preview will be ready once generation completes...";
                        }
                        break;
                      case "checkingHealth":
                        title = "Checking Sandbox Status";
                        subtitle = "Verifying that your sandbox is running...";
                        break;
                      case "needsRefresh":
                        title = "Sandbox Expired - Recovering";
                        subtitle =
                          "Your sandbox has expired and needs to be recovered. This will happen automatically...";
                        break;
                      case "needsInitialization":
                        title = "Sandbox Not Initialized";
                        subtitle =
                          "The sandbox needs to be initialized. This will happen automatically when you start a conversation.";
                        break;
                      case "sandboxNotReady":
                        title = "Sandbox Not Ready";
                        subtitle =
                          "The sandbox is starting up. This may take a moment...";
                        break;
                      case "newProject":
                        title = "Preview Coming Soon";
                        subtitle =
                          "Your app preview will appear here once the AI finishes building your first version.";
                        break;
                      case "noPreview":
                        title = "No Preview Available";
                        subtitle =
                          "Start a conversation to create your application and see the preview here.";
                        break;
                    }

                    // Handle ERROR state separately if buildStatus indicates an error
                    if (buildStatus === "ERROR") {
                      title = "Build Error";
                      subtitle = projectData?.buildError
                        ? `Something went wrong: ${projectData.buildError}`
                        : "An error occurred during build. Please try again or contact support.";
                    }

                    return (
                      <PreviewLoadingAnimation
                        title={title}
                        subtitle={subtitle}
                      />
                    );
                  })()
                )}
              </TabsContent>

              <TabsContent value="code" className="h-full p-0">
                {loadV2FragmentMutation.isPending ||
                  switchToGitCommitMutation.isPending ||
                  isLoadingSandboxFiles ? (
                  <div className="flex h-full items-center justify-center">
                    <div className="space-y-4 text-center">
                      <div className="border-primary mx-auto h-8 w-8 animate-spin rounded-full border-b-2"></div>
                      <div className="text-muted-foreground text-sm">
                        {loadV2FragmentMutation.isPending
                          ? "Loading fragment..."
                          : switchToGitCommitMutation.isPending
                            ? "Switching to fragment..."
                            : "Loading project files..."}
                      </div>
                    </div>
                  </div>
                ) : sandboxFiles && sandboxFiles.size > 0 ? (
                  <div className="flex h-full flex-col">
                    <div className="bg-sidebar flex items-center justify-between border-b px-4 py-2">
                      <div className="flex items-center gap-2">
                        <CodeIcon className="h-4 w-4" />
                        <span className="text-sm font-medium">
                          {codeViewMode === "fragment" && loadedFragment
                            ? `${loadedFragment.title}`
                            : "Project Files"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {loadedFragment && (
                          <Button
                            variant={
                              codeViewMode === "fragment"
                                ? "default"
                                : "outline"
                            }
                            size="sm"
                            onClick={() => setCodeViewMode("fragment")}
                            className="h-7 text-xs"
                            disabled={
                              !loadedFragment.files ||
                              Object.keys(loadedFragment.files).length === 0
                            } // Some fragments don't expose files directly
                          >
                            Fragment
                          </Button>
                        )}
                        <ExportCodeButton
                          projectId={projectId}
                          sandboxFiles={sandboxFiles}
                          sandboxReady={sandboxReady}
                        />
                        {codeViewMode === "fragment" && loadedFragment && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setLoadedFragment(null);
                              setCodeViewMode("all");
                            }}
                            className="h-6 w-6 p-0"
                          >
                            ✕
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="min-h-0 flex-1">
                      <FileExplorer
                        projectId={projectId}
                        files={(() => {
                          let files: Set<string>;

                          if (
                            codeViewMode === "fragment" &&
                            loadedFragment?.files
                          ) {
                            // Convert V2 fragment files object to Set
                            files = new Set(Object.keys(loadedFragment.files));
                          } else {
                            // sandboxFiles is now a Set<string> of file paths
                            files = sandboxFiles || new Set();
                          }

                          // Filter out excluded files and directories
                          const excludedPaths = [
                            "src/database/",
                            "src/repositories/",
                            "src/entities/index.ts",
                            "src/components/UserExample.tsx",
                          ];

                          const filteredFiles = new Set<string>();
                          for (const filePath of files) {
                            const shouldExclude = excludedPaths.some(
                              (excludedPath) => {
                                if (excludedPath.endsWith("/")) {
                                  // Directory exclusion - check if file starts with this path
                                  return filePath.startsWith(excludedPath);
                                } else {
                                  // File exclusion - exact match
                                  return filePath === excludedPath;
                                }
                              },
                            );

                            if (!shouldExclude) {
                              filteredFiles.add(filePath);
                            }
                          }

                          return filteredFiles;
                        })()}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-muted-foreground flex h-full items-center justify-center p-2">
                    <div className="text-center">
                      <div className="mb-4 flex items-center justify-center">
                        <CodeIcon className="h-12 w-12 opacity-50" />
                      </div>
                      <h3 className="mb-2 text-lg font-semibold">Code View</h3>
                      <p className="mb-4">
                        {sandboxFilesError
                          ? "Failed to load project files. The sandbox will automatically recover and files will load shortly."
                          : !latestFragment
                            ? "No fragments available yet. Start a conversation to create your first project files."
                            : "Project files will appear here once your sandbox is ready."}
                      </p>
                      {isLoadingSandboxFiles && (
                        <div className="text-muted-foreground text-xs">
                          Loading project files...
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </TabsContent>
            </div>
          </Tabs>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Mobile Bottom Tabs */}
      <MobileBottomTabs
        activeTab={mobileActiveSection}
        onTabChange={(tab) => {
          setMobileActiveSection(tab);
          // Open HAL panel if switching to assistant
          if (tab === "assistant" && !isHalPanelVisible) {
            setIsHalPanelVisible(true);
          }
        }}
      />

      {/* Sandbox Monitoring */}
      <SandboxMonitor
        onMonitorInitialized={handleMonitorInitialized}
        onError={handleSandboxError}
        onNetworkRequest={handleNetworkRequest}
        onConsoleOutput={handleConsoleOutput}
        onUrlChange={handleUrlChange}
        onContentLoaded={handleContentLoaded}
        showDebugUI={false} // Set to true to enable debug panel
      />

      {/* Error Notification Stack */}
      {visibleErrors.length > 0 && (
        <div className="fixed right-4 bottom-20 z-[10000] flex max-h-[60vh] w-full max-w-md flex-col gap-3 overflow-y-auto md:bottom-4">
          {visibleErrors.map((error, index) => (
            <div
              key={`error-${index}-${error.message}-${error.lineno || 0}`}
              className="animate-in slide-in-from-bottom-5 rounded-lg border-2 border-red-200 bg-red-50 p-4 shadow-lg dark:border-red-800 dark:bg-red-950"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                    <h3 className="font-semibold text-red-900 dark:text-red-100">
                      {error.blankScreen
                        ? "App Failed to Load"
                        : "Runtime Error"}
                      {visibleErrors.length > 1 && (
                        <span className="ml-2 text-xs font-normal text-red-700 dark:text-red-300">
                          ({index + 1} of {visibleErrors.length})
                        </span>
                      )}
                    </h3>
                  </div>
                  <p className="mb-3 font-mono text-sm text-red-800 dark:text-red-200">
                    {error.message}
                  </p>
                  {error.filename && (
                    <p className="mb-3 text-xs text-red-600 dark:text-red-400">
                      {error.filename}:{error.lineno}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 border-red-300 bg-white text-xs hover:bg-red-50 dark:border-red-700 dark:bg-red-900 dark:hover:bg-red-800"
                      onClick={() => {
                        // Send error to chat
                        const chatInput = document.querySelector(
                          "[data-chat-input]",
                        ) as HTMLTextAreaElement;
                        if (chatInput) {
                          const errorMessage = `I'm getting this error in my app:\n\n\`\`\`\n${error.message}\n${error.stack ? `\n${error.stack.slice(0, 500)}` : ""}\n\`\`\`\n\nPlease fix this error and verify the fix is working correctly.`;

                          const nativeInputValueSetter =
                            Object.getOwnPropertyDescriptor(
                              window.HTMLTextAreaElement.prototype,
                              "value",
                            )?.set;

                          if (nativeInputValueSetter) {
                            nativeInputValueSetter.call(
                              chatInput,
                              errorMessage,
                            );
                          }

                          const inputEvent = new Event("input", {
                            bubbles: true,
                          });
                          chatInput.dispatchEvent(inputEvent);
                          chatInput.focus();

                          // Dismiss this error after sending to AI
                          handleDismissError(index);
                        }
                      }}
                    >
                      Ask AI to Fix
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      onClick={() => handleDismissError(index)}
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
                <button
                  onClick={() => handleDismissError(index)}
                  className="text-red-500 transition-colors hover:text-red-700 dark:text-red-400 dark:hover:text-red-200"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Visual editing panel - only show when preview tab is active */}
      {tabState === "preview" && visualEditingMode && selectedElement && (
        <VisualEditingPanel
          element={selectedElement}
          projectId={projectId}
          onClose={() => setSelectedElement(null)}
          onStyleChange={handleStyleChange}
          onTextContentChange={handleTextContentChange}
          onTextPrompt={handleTextPrompt}
          onFragmentRefresh={() => {
            // Refresh the preview when undo is performed
            // Use refreshPreview which handles sandbox state and recovery properly
            refreshPreview({ skipHealthCheck: true });
          }}
          onBatchedChanges={async (changes) => {
            // Apply all changes in a single request
            try {
              await applyBatchedEditsMutation.mutateAsync({
                projectId,
                edits: changes,
              });

              console.log(
                "[handleBatchedChanges] All changes applied successfully",
              );
              toast.success(
                `Applied ${changes.length} visual changes successfully!`,
              );

              // Refresh preview
              setTimeout(() => {
                refreshablePreviewRef.current?.refresh();
              }, 1500);
            } catch (error) {
              console.error(
                "[handleBatchedChanges] Failed to apply batched changes:",
                error,
              );
              toast.error(
                "Failed to apply some visual changes. Please try again.",
              );
            }
          }}
          onExitVisualEdit={() => {
            // Disable visual editing mode
            setVisualEditingMode(false);
            setSelectedElement(null);

            // Send message to iframe to disable visual editing
            const iframe = document.querySelector(
              'iframe[title="Preview"]',
            ) as HTMLIFrameElement;

            if (iframe?.contentWindow) {
              iframe.contentWindow.postMessage(
                { type: "DISABLE_VISUAL_EDIT" },
                "*",
              );
            }
          }}
          resolveFilePath={detectComponentFile}
        />
      )}

      {/* Cloud Credits Modal for Shipper Cloud */}
      {isCloudCreditsModalOpen && (
        <CloudCreditsModal
          isOpen={isCloudCreditsModalOpen}
          onClose={() => setIsCloudCreditsModalOpen(false)}
        />
      )}
    </div>
  );
};
