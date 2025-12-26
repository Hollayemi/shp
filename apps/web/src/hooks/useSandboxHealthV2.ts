import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useCallback, useState } from "react";

// Enhanced sandbox states matching the backend recovery system
type SandboxState =
  | "initializing"
  | "creating"
  | "restoring-files"
  | "installing-packages"
  | "validating"
  | "ready"
  | "failed"
  | "timeout"
  | "recovering";

type RecoveryAction =
  | "retry-full"
  | "skip-fragment"
  | "create-minimal"
  | "use-fallback";

interface SandboxHealthV2Options {
  projectId: string;
  enabled?: boolean;
  pollInterval?: number;
  onHealthChange?: (isHealthy: boolean, details: any) => void;
  onStateChange?: (state: SandboxState, details?: any) => void;
  autoRecover?: boolean; // Enable automatic sandbox recovery
  recoveryMode?: "aggressive" | "conservative" | "manual"; // Recovery strategy
  onRefresh?: () => void; // Callback when refresh is triggered
}

export function useSandboxHealthV2({
  projectId,
  enabled = true,
  pollInterval = 0, // Default to no polling - use manual refresh
  onHealthChange,
  onStateChange,
  autoRecover = true, // Default to automatic recovery
  recoveryMode = "conservative", // Default to conservative recovery
  onRefresh,
}: SandboxHealthV2Options) {
  // All hooks must be called at the top level
  const trpc = useTRPC();
  const lastHealthStatus = useRef<boolean | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);
  const [sandboxState, setSandboxState] =
    useState<SandboxState>("initializing");
  const [lastError, setLastError] = useState<string | null>(null);
  const [recoveryAttempts, setRecoveryAttempts] = useState(0);
  const [currentRecoveryMode, setCurrentRecoveryMode] =
    useState<string>("full_restore");
  const hasTriggeredRecovery = useRef(false);
  const lastRecoveryTime = useRef<number>(0);
  const [forceRefreshCount, setForceRefreshCount] = useState(0);
  // Track if we've ever had a healthy sandbox in this session
  const hadHealthySandbox = useRef(false);

  const {
    data: healthStatus,
    refetch,
    isLoading,
  } = useQuery({
    ...trpc.projects.checkV2ProjectSandboxHealth.queryOptions({ projectId }),
    enabled,
    refetchInterval: pollInterval,
    refetchIntervalInBackground: false,
    staleTime: forceRefreshCount > 0 ? 0 : 60000, // Shorter cache, bypass on force refresh
    gcTime: 300000, // Keep in cache for 5 minutes
    refetchOnWindowFocus: false, // Only refetch on focus if user was away for a long time (handled in visibility listener)
    refetchOnMount: true, // Check on mount but respect cache
    networkMode: "always",
  });

  // Automatic sandbox restart mutation (lightweight alternative to full recovery)
  const restartSandboxMutation = useMutation(
    trpc.projects.restartV2ProjectSandbox.mutationOptions({
      onMutate: () => {
        setIsRecovering(true);
      },
      onSuccess: (result) => {
        console.log("[useSandboxHealthV2] Sandbox restart successful:", result);
        setIsRecovering(false);
        hasTriggeredRecovery.current = false;
        setLastError(null);
        setRecoveryAttempts(0);
        setCurrentRecoveryMode("restart_only");
        setSandboxState("ready");
        hadHealthySandbox.current = true;

        // Trigger health check after successful restart
        setTimeout(() => {
          refetch();
        }, 3000);
      },
      onError: (error) => {
        console.error("[useSandboxHealthV2] Sandbox restart failed:", error);
        // Don't reset isRecovering here - let it fall through to full recovery
        setLastError(error instanceof Error ? error.message : String(error));
        setRecoveryAttempts((prev) => prev + 1);
        setSandboxState("failed");
      },
    }),
  );

  // Automatic sandbox recovery mutation (full recovery)
  const recoverSandboxMutation = useMutation(
    trpc.projects.recoverV2ProjectSandbox.mutationOptions({
      onMutate: () => {
        setIsRecovering(true);
      },
      onSuccess: (result) => {
        console.log(
          "[useSandboxHealthV2] Sandbox recovery successful:",
          result,
        );
        setIsRecovering(false);
        hasTriggeredRecovery.current = false;
        setLastError(null);
        setRecoveryAttempts(0);
        setCurrentRecoveryMode("full_restore");
        setSandboxState("ready");
        hadHealthySandbox.current = true; // Mark that we now have a healthy sandbox

        // Trigger health check after successful recovery - with longer delay to avoid rapid calls
        setTimeout(() => {
          refetch();
        }, 5000);
      },
      onError: (error) => {
        console.error("[useSandboxHealthV2] Sandbox recovery failed:", error);
        setIsRecovering(false);
        hasTriggeredRecovery.current = false;
        setLastError(error instanceof Error ? error.message : String(error));
        setRecoveryAttempts((prev) => prev + 1);
        setSandboxState("failed");
      },
    }),
  );

  // Memoized health check trigger with force refresh capability
  const checkHealth = useCallback(
    async (force = false) => {
      if (force) {
        console.log(
          "[useSandboxHealthV2] Force refreshing health check - bypassing cache",
        );
        setForceRefreshCount((prev) => prev + 1);
        onRefresh?.();
        // Small delay to ensure state update takes effect
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return await refetch();
    },
    [refetch, onRefresh],
  );

  // Force refresh function for external use
  const forceHealthCheck = useCallback(async () => {
    console.log("[useSandboxHealthV2] Force health check triggered");
    return await checkHealth(true);
  }, [checkHealth]);

  // State management based on health status
  useEffect(() => {
    if (!healthStatus) {
      setSandboxState("initializing");
      return;
    }

    let newState: SandboxState;

    if (isRecovering) {
      newState = "recovering";
    } else if (healthStatus.needsInitialization) {
      // Sandbox doesn't exist - needs to be created
      newState = "initializing";
    } else if (!healthStatus.hasActiveSandbox) {
      // No sandbox reference - needs initialization
      newState = "initializing";
    } else if (healthStatus.isHealthy) {
      // Sandbox exists and is healthy
      newState = "ready";
    } else if (healthStatus.needsRefresh) {
      // Sandbox exists but is unhealthy - needs recovery
      newState = "failed";
    } else {
      // Sandbox exists but status unclear - validating
      newState = "validating";
    }

    if (newState !== sandboxState) {
      setSandboxState(newState);
      onStateChange?.(newState, healthStatus);

      // Debug log state changes
      console.log(
        `[useSandboxHealthV2] State changed: ${sandboxState} -> ${newState}`,
        {
          hasActiveSandbox: healthStatus?.hasActiveSandbox,
          isHealthy: healthStatus?.isHealthy,
          needsRefresh: healthStatus?.needsRefresh,
          needsInitialization: healthStatus?.needsInitialization,
        },
      );
    }

    // Track if we've ever had a healthy sandbox (for recovery logic)
    if (healthStatus?.isHealthy && healthStatus?.hasActiveSandbox) {
      hadHealthySandbox.current = true;
    }

    // Health change notification
    if (healthStatus?.isHealthy !== lastHealthStatus.current) {
      lastHealthStatus.current = healthStatus?.isHealthy;
      onHealthChange?.(healthStatus?.isHealthy, healthStatus);
    }
  }, [healthStatus, onHealthChange, onStateChange, sandboxState, isRecovering]);

  // Enhanced automatic recovery with progressive backoff
  useEffect(() => {
    const now = Date.now();
    const timeSinceLastRecovery = now - lastRecoveryTime.current;

    // Progressive recovery cooldown based on attempts and recovery mode
    let cooldownMs = 30000; // 30s base
    if (recoveryMode === "aggressive") {
      cooldownMs = Math.min(15000 + recoveryAttempts * 10000, 60000); // 15s to 1min
    } else if (recoveryMode === "conservative") {
      cooldownMs = Math.min(60000 + recoveryAttempts * 30000, 300000); // 1min to 5min
    }

    const recoveryReady = timeSinceLastRecovery > cooldownMs;
    const maxAttempts = recoveryMode === "aggressive" ? 5 : 3;

    // Debug logging for recovery conditions
    const conditions = {
      autoRecover,
      recoveryMode,
      hasHealthStatus: !!healthStatus,
      hasActiveSandbox: healthStatus?.hasActiveSandbox,
      needsRefresh: healthStatus?.needsRefresh,
      needsInitialization: healthStatus?.needsInitialization,
      isUnhealthy: !healthStatus?.isHealthy,
      notCurrentlyRecovering: !isRecovering,
      hasNotTriggeredYet: !hasTriggeredRecovery.current,
      mutationNotPending: !recoverSandboxMutation.isPending,
      recoveryReady,
      recoveryAttempts,
      maxAttempts,
      belowMaxAttempts: recoveryAttempts < maxAttempts,
      timeSinceLastRecovery: Math.round(timeSinceLastRecovery / 1000) + "s",
      cooldownMs: Math.round(cooldownMs / 1000) + "s",
    };

    // Determine if recovery should be attempted
    const shouldRecoverActiveSandbox =
      healthStatus?.hasActiveSandbox &&
      healthStatus?.needsRefresh &&
      !healthStatus?.isHealthy &&
      !healthStatus?.needsInitialization;

    const shouldRecoverStoppedSandbox =
      healthStatus?.needsInitialization &&
      !healthStatus?.hasActiveSandbox &&
      hadHealthySandbox.current; // We previously had a working sandbox

    // New: detect if sandbox exists but is just stopped/unhealthy
    const shouldRestartSandbox =
      healthStatus?.hasActiveSandbox &&
      healthStatus?.needsRefresh &&
      !healthStatus?.isHealthy &&
      !healthStatus?.needsInitialization;

    const shouldAttemptRecovery =
      shouldRecoverActiveSandbox || shouldRecoverStoppedSandbox;
    const shouldAttemptRestart = shouldRestartSandbox;

    // First try lightweight restart for stopped/unhealthy sandbox
    if (
      autoRecover &&
      recoveryMode !== "manual" &&
      healthStatus &&
      shouldAttemptRestart &&
      !isRecovering &&
      !hasTriggeredRecovery.current &&
      !restartSandboxMutation.isPending &&
      !recoverSandboxMutation.isPending &&
      recoveryReady &&
      recoveryAttempts < 2 // Try restart first, then fall back to recovery
    ) {
      console.log(
        "[useSandboxHealthV2] Triggering sandbox restart (lightweight recovery)...",
        {
          ...conditions,
          shouldRestartSandbox,
          recoveryReason: "stopped_sandbox_restart",
        },
      );
      setSandboxState("recovering");
      hasTriggeredRecovery.current = true;
      lastRecoveryTime.current = now;
      restartSandboxMutation.mutate({ projectId });
    }
    // If restart failed or not applicable, try full recovery
    else if (
      autoRecover &&
      recoveryMode !== "manual" &&
      healthStatus &&
      (shouldAttemptRecovery ||
        (shouldAttemptRestart && recoveryAttempts >= 2)) &&
      !isRecovering &&
      !hasTriggeredRecovery.current &&
      !recoverSandboxMutation.isPending &&
      !restartSandboxMutation.isPending &&
      recoveryReady &&
      recoveryAttempts < maxAttempts
    ) {
      console.log(
        "[useSandboxHealthV2] Triggering automatic sandbox recovery...",
        {
          ...conditions,
          shouldRecoverActiveSandbox,
          shouldRecoverStoppedSandbox,
          hadHealthySandbox: hadHealthySandbox.current,
          recoveryReason: shouldRecoverActiveSandbox
            ? "active_sandbox_unhealthy"
            : "stopped_sandbox_recovery",
        },
      );
      setSandboxState("recovering");
      hasTriggeredRecovery.current = true;
      lastRecoveryTime.current = now;
      recoverSandboxMutation.mutate({ projectId });
    } else if (shouldAttemptRecovery || shouldAttemptRestart) {
      console.log(
        "[useSandboxHealthV2] Recovery/restart needed but blocked by conditions:",
        {
          ...conditions,
          shouldRecoverActiveSandbox,
          shouldRecoverStoppedSandbox,
          shouldRestartSandbox,
          hadHealthySandbox: hadHealthySandbox.current,
        },
      );
    }
  }, [
    autoRecover,
    recoveryMode,
    healthStatus,
    isRecovering,
    projectId,
    recoverSandboxMutation,
    restartSandboxMutation,
    recoveryAttempts,
  ]);

  // Additional guard to prevent multiple recoveries
  useEffect(() => {
    if (isRecovering) {
      hasTriggeredRecovery.current = true;
    }
  }, [isRecovering]);

  // Reset recovery state if restart mutation completes with error (to allow fallback to full recovery)
  useEffect(() => {
    if (restartSandboxMutation.isError && !restartSandboxMutation.isPending) {
      // Allow fallback to full recovery after restart failure
      setTimeout(() => {
        if (!recoverSandboxMutation.isPending) {
          setIsRecovering(false);
          hasTriggeredRecovery.current = false;
        }
      }, 1000);
    }
  }, [
    restartSandboxMutation.isError,
    restartSandboxMutation.isPending,
    recoverSandboxMutation.isPending,
  ]);

  // Track when page becomes hidden to detect when user returns after being away
  const pageHiddenTime = useRef<number>(0);

  // Listen for page visibility changes to trigger health checks when user returns
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Track when page becomes hidden
        pageHiddenTime.current = Date.now();
      } else if (enabled) {
        const timeAwayMs = Date.now() - pageHiddenTime.current;

        // More aggressive health checking - check if away for more than 2 minutes OR if sandbox shows as healthy but might be stale
        const shouldCheckHealth =
          timeAwayMs > 120000 && // Reduced from 5 minutes to 2 minutes
          (!healthStatus?.isHealthy ||
            healthStatus?.needsRefresh ||
            timeAwayMs > 300000); // Always check if away for 5+ minutes

        console.log(
          "[useSandboxHealthV2] Page became visible after",
          Math.round(timeAwayMs / 1000),
          "seconds",
          shouldCheckHealth
            ? "- checking sandbox health"
            : "- skipping health check (recent or confirmed healthy)",
        );

        if (shouldCheckHealth) {
          // If user was away for more than 2 minutes, reset recovery flags to allow immediate recovery
          // BUT only if no recovery is currently in progress
          if (!isRecovering && !recoverSandboxMutation.isPending) {
            console.log(
              "[useSandboxHealthV2] User was away for a while - resetting recovery flags and forcing health check",
            );
            hasTriggeredRecovery.current = false;
            lastRecoveryTime.current = 0;
            // Don't reset hadHealthySandbox - we want to remember we had a working sandbox
          }

          // Force a health check if user was away for a long time to detect stale references
          const forceCheck = timeAwayMs > 300000;
          setTimeout(() => {
            if (forceCheck) {
              console.log(
                "[useSandboxHealthV2] Forcing health check due to long absence",
              );
              checkHealth(true);
            } else {
              refetch();
            }
          }, 1000);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    enabled,
    refetch,
    isRecovering,
    recoverSandboxMutation.isPending,
    restartSandboxMutation.isPending,
    healthStatus,
  ]);

  // Recovery action handlers
  const retryWithFallback = useCallback(
    (action: RecoveryAction) => {
      console.log(`[useSandboxHealthV2] Executing recovery action: ${action}`);

      switch (action) {
        case "retry-full":
          hasTriggeredRecovery.current = false;
          setRecoveryAttempts(0);
          setCurrentRecoveryMode("full_restore");
          recoverSandboxMutation.mutate({ projectId });
          break;
        case "skip-fragment":
          hasTriggeredRecovery.current = false;
          setCurrentRecoveryMode("files_only");
          // This would need backend support for different recovery modes
          recoverSandboxMutation.mutate({ projectId });
          break;
        case "create-minimal":
          hasTriggeredRecovery.current = false;
          setCurrentRecoveryMode("minimal_sandbox");
          recoverSandboxMutation.mutate({ projectId });
          break;
        case "use-fallback":
          hasTriggeredRecovery.current = false;
          setCurrentRecoveryMode("emergency_fallback");
          recoverSandboxMutation.mutate({ projectId });
          break;
      }
    },
    [projectId, recoverSandboxMutation],
  );

  return {
    // Core sandbox state
    isHealthy: healthStatus?.isHealthy ?? false,
    needsRefresh: healthStatus?.needsRefresh ?? false,
    needsInitialization: healthStatus?.needsInitialization ?? false,
    hasActiveSandbox: healthStatus?.hasActiveSandbox ?? false,
    sandboxId: healthStatus?.sandboxId ?? null,
    sandboxUrl: healthStatus?.sandboxUrl ?? null,
    timeUntilExpiration: healthStatus?.timeUntilExpiration ?? null,
    activeFragmentId: healthStatus?.activeFragmentId ?? null,

    // Enhanced state management
    sandboxState,
    isLoading: isLoading || isRecovering,
    isRecovering,
    lastError,
    recoveryAttempts,
    currentRecoveryMode,

    // Recovery capabilities
    canRetry: recoveryAttempts < (recoveryMode === "aggressive" ? 5 : 3),
    retryWithFallback,

    // Core functions
    checkHealth,
    forceHealthCheck, // New force refresh capability
    refetch, // Keep for backward compatibility
    recoverSandbox: () => recoverSandboxMutation.mutate({ projectId }),
    restartSandbox: () => restartSandboxMutation.mutate({ projectId }),

    // Recovery mode management
    setRecoveryMode: (mode: "aggressive" | "conservative" | "manual") => {
      // This would be used to change recovery strategy dynamically
      console.log(`[useSandboxHealthV2] Recovery mode changed to: ${mode}`);
    },
  };
}
