import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { useReducer } from "react";

/**
 * Unified Sandbox State Management Hook V3
 *
 * This hook replaces the complex state management in useSandboxHealthV2
 * with a simpler, more predictable state machine approach.
 *
 * Key improvements:
 * - Single source of truth for sandbox state
 * - Predictable state transitions
 * - Simplified recovery logic
 * - Better performance through smart caching
 * - Cleaner error handling
 */

// Unified sandbox state machine
type SandboxState =
  | { status: "initializing"; message: "Checking sandbox status" }
  | {
      status: "healthy";
      sandboxUrl: string;
      sandboxId: string;
      lastCheck: Date;
    }
  | {
      status: "unhealthy";
      sandboxId: string;
      canRecover: boolean;
      error?: string;
    }
  | { status: "recovering"; progress: RecoveryProgress; attempt: number }
  | { status: "failed"; error: string; canRetry: boolean; lastAttempt?: Date }
  | { status: "expired"; sandboxId: string; canRecover: boolean };

interface RecoveryProgress {
  stage: "preparing" | "creating" | "restoring" | "validating" | "finalizing";
  progress: number; // 0-100
  message: string;
  estimatedTimeRemaining?: number;
}

// Action types for state machine
type SandboxAction =
  | {
      type: "HEALTH_CHECK_SUCCESS";
      payload: { sandboxId: string; sandboxUrl: string };
    }
  | {
      type: "HEALTH_CHECK_FAILED";
      payload: { error?: string; canRecover: boolean };
    }
  | { type: "RECOVERY_STARTED"; payload: { attempt: number } }
  | { type: "RECOVERY_PROGRESS"; payload: RecoveryProgress }
  | {
      type: "RECOVERY_SUCCESS";
      payload: { sandboxId: string; sandboxUrl: string };
    }
  | { type: "RECOVERY_FAILED"; payload: { error: string; canRetry: boolean } }
  | { type: "SANDBOX_EXPIRED"; payload: { sandboxId: string } }
  | { type: "RESET" };

// State machine reducer
function sandboxStateReducer(
  state: SandboxState,
  action: SandboxAction,
): SandboxState {
  switch (action.type) {
    case "HEALTH_CHECK_SUCCESS":
      return {
        status: "healthy",
        sandboxUrl: action.payload.sandboxUrl,
        sandboxId: action.payload.sandboxId,
        lastCheck: new Date(),
      };

    case "HEALTH_CHECK_FAILED":
      if (state.status === "healthy") {
        return {
          status: "unhealthy",
          sandboxId: state.sandboxId,
          canRecover: action.payload.canRecover,
          error: action.payload.error,
        };
      }
      return state;

    case "RECOVERY_STARTED":
      return {
        status: "recovering",
        progress: {
          stage: "preparing",
          progress: 0,
          message: "Preparing sandbox recovery...",
        },
        attempt: action.payload.attempt,
      };

    case "RECOVERY_PROGRESS":
      if (state.status === "recovering") {
        return {
          ...state,
          progress: action.payload,
        };
      }
      return state;

    case "RECOVERY_SUCCESS":
      return {
        status: "healthy",
        sandboxUrl: action.payload.sandboxUrl,
        sandboxId: action.payload.sandboxId,
        lastCheck: new Date(),
      };

    case "RECOVERY_FAILED":
      return {
        status: "failed",
        error: action.payload.error,
        canRetry: action.payload.canRetry,
        lastAttempt: new Date(),
      };

    case "SANDBOX_EXPIRED":
      return {
        status: "expired",
        sandboxId: action.payload.sandboxId,
        canRecover: true,
      };

    case "RESET":
      return {
        status: "initializing",
        message: "Checking sandbox status",
      };

    default:
      return state;
  }
}

// Configuration options
interface UseSandboxStateOptions {
  projectId: string;
  enabled?: boolean;
  autoRecover?: boolean;
  recoveryStrategy?: "immediate" | "progressive" | "manual";
  maxRecoveryAttempts?: number;
  onStateChange?: (state: SandboxState) => void;
  onError?: (error: string) => void;
}

// Recovery strategy configuration
const RECOVERY_STRATEGIES = {
  immediate: { baseDelay: 1000, maxAttempts: 3, backoffMultiplier: 1 },
  progressive: { baseDelay: 5000, maxAttempts: 5, backoffMultiplier: 2 },
  manual: { baseDelay: 0, maxAttempts: 0, backoffMultiplier: 1 },
} as const;

export function useSandboxStateV3({
  projectId,
  enabled = true,
  autoRecover = true,
  recoveryStrategy = "progressive",
  maxRecoveryAttempts,
  onStateChange,
  onError,
}: UseSandboxStateOptions) {
  const trpc = useTRPC();

  // Initialize state machine
  const [state, dispatch] = useReducer(sandboxStateReducer, {
    status: "initializing",
    message: "Checking sandbox status",
  });

  // Recovery tracking
  const recoveryAttempts = useRef(0);
  const lastHealthCheck = useRef<Date>(new Date());
  const recoveryInProgress = useRef(false);
  // Track if we've ever had a healthy sandbox (prevents recovery on brand new projects)
  const hadHealthySandbox = useRef(false);

  // Get recovery configuration
  const recoveryConfig = useMemo(() => {
    const baseConfig = RECOVERY_STRATEGIES[recoveryStrategy];
    return {
      ...baseConfig,
      maxAttempts: maxRecoveryAttempts ?? baseConfig.maxAttempts,
    };
  }, [recoveryStrategy, maxRecoveryAttempts]);

  // Health check query with smart caching
  const {
    data: healthStatus,
    refetch: refetchHealth,
    isLoading: isHealthLoading,
    error: healthError,
  } = useQuery({
    ...trpc.projects.checkV2ProjectSandboxHealth.queryOptions({ projectId }),
    enabled: enabled && !!projectId,
    staleTime: 30000, // Cache for 30 seconds
    gcTime: 300000, // Keep in cache for 5 minutes
    refetchInterval: false, // No automatic polling - manual trigger only
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    retry: (failureCount, error) => {
      // Only retry on network errors, not application errors
      return failureCount < 2 && !error?.data?.code;
    },
  });

  // Recovery mutation
  const recoveryMutation = useMutation(
    trpc.projects.recoverV2ProjectSandbox.mutationOptions({
      onMutate: () => {
        recoveryInProgress.current = true;
        dispatch({
          type: "RECOVERY_STARTED",
          payload: { attempt: recoveryAttempts.current + 1 },
        });
      },
      onSuccess: (result) => {
        recoveryInProgress.current = false;
        recoveryAttempts.current = 0;
        // Mark that we now have a healthy sandbox after successful recovery
        hadHealthySandbox.current = true;
        dispatch({
          type: "RECOVERY_SUCCESS",
          payload: {
            sandboxId: result.sandboxId || "",
            sandboxUrl: result.sandboxUrl || "",
          },
        });
      },
      onError: (error) => {
        recoveryInProgress.current = false;
        recoveryAttempts.current++;
        const canRetry = recoveryAttempts.current < recoveryConfig.maxAttempts;
        const errorMessage =
          error instanceof Error ? error.message : "Recovery failed";

        dispatch({
          type: "RECOVERY_FAILED",
          payload: {
            error: errorMessage,
            canRetry,
          },
        });
        onError?.(errorMessage);
      },
    }),
  );

  // Process health check results
  useEffect(() => {
    if (!healthStatus) return;

    lastHealthCheck.current = new Date();

    if (healthStatus.needsInitialization) {
      dispatch({ type: "RESET" });
      return;
    }

    if (
      healthStatus.isHealthy &&
      healthStatus.sandboxUrl &&
      healthStatus.sandboxId
    ) {
      // Mark that we've had a healthy sandbox
      hadHealthySandbox.current = true;

      dispatch({
        type: "HEALTH_CHECK_SUCCESS",
        payload: {
          sandboxId: healthStatus.sandboxId,
          sandboxUrl: healthStatus.sandboxUrl,
        },
      });
      return;
    }

    if (healthStatus.needsRefresh && healthStatus.sandboxId) {
      dispatch({
        type: "SANDBOX_EXPIRED",
        payload: { sandboxId: healthStatus.sandboxId },
      });
      return;
    }

    if (!healthStatus.isHealthy) {
      dispatch({
        type: "HEALTH_CHECK_FAILED",
        payload: {
          canRecover: healthStatus.hasActiveSandbox,
          error: "Sandbox is not responding",
        },
      });
    }
  }, [healthStatus]);

  // Handle health check errors
  useEffect(() => {
    if (healthError) {
      const errorMessage =
        healthError instanceof Error
          ? healthError.message
          : "Health check failed";
      dispatch({
        type: "HEALTH_CHECK_FAILED",
        payload: {
          canRecover: false,
          error: errorMessage,
        },
      });
      onError?.(errorMessage);
    }
  }, [healthError, onError]);

  // Automatic recovery logic
  useEffect(() => {
    if (
      !autoRecover ||
      recoveryInProgress.current ||
      recoveryStrategy === "manual"
    ) {
      return;
    }

    // IMPORTANT: Only attempt recovery if we've previously had a healthy sandbox
    // This prevents recovery attempts on brand new projects that haven't been generated yet
    if (!hadHealthySandbox.current) {
      console.log(
        "[useSandboxStateV3] Skipping recovery - project has never had a healthy sandbox (brand new project)",
      );
      return;
    }

    const shouldRecover =
      (state.status === "unhealthy" && state.canRecover) ||
      (state.status === "expired" && state.canRecover) ||
      (state.status === "failed" && state.canRetry);

    if (
      shouldRecover &&
      recoveryAttempts.current < recoveryConfig.maxAttempts
    ) {
      const delay =
        recoveryConfig.baseDelay *
        Math.pow(recoveryConfig.backoffMultiplier, recoveryAttempts.current);

      console.log(
        `[useSandboxStateV3] Scheduling recovery attempt ${recoveryAttempts.current + 1} in ${delay}ms`,
      );

      const timeoutId = setTimeout(() => {
        if (!recoveryInProgress.current) {
          recoveryMutation.mutate({ projectId });
        }
      }, delay);

      return () => clearTimeout(timeoutId);
    }
  }, [
    state,
    autoRecover,
    recoveryStrategy,
    recoveryConfig,
    recoveryMutation,
    projectId,
  ]);

  // State change notification
  useEffect(() => {
    onStateChange?.(state);
  }, [state, onStateChange]);

  // Manual actions
  const actions = useMemo(
    () => ({
      // Trigger immediate health check
      checkHealth: async () => {
        console.log("[useSandboxStateV3] Manual health check triggered");
        const result = await refetchHealth();
        return result.data;
      },

      // Force recovery
      recover: async () => {
        if (recoveryInProgress.current) {
          console.warn("[useSandboxStateV3] Recovery already in progress");
          return;
        }

        console.log("[useSandboxStateV3] Manual recovery triggered");
        return recoveryMutation.mutateAsync({ projectId });
      },

      // Reset state
      reset: () => {
        console.log("[useSandboxStateV3] State reset");
        recoveryAttempts.current = 0;
        recoveryInProgress.current = false;
        dispatch({ type: "RESET" });
      },

      // Cancel recovery
      cancelRecovery: () => {
        if (recoveryInProgress.current) {
          console.log("[useSandboxStateV3] Recovery cancelled");
          recoveryInProgress.current = false;
          // Note: Can't actually cancel the mutation, but we can ignore the result
        }
      },
    }),
    [refetchHealth, recoveryMutation, projectId],
  );

  // Computed properties for easier consumption
  const computed = useMemo(
    () => ({
      // Simple status checks
      isHealthy: state.status === "healthy",
      isRecovering: state.status === "recovering",
      needsInitialization: state.status === "initializing",
      hasFailed: state.status === "failed",
      isExpired: state.status === "expired",

      // URLs and IDs
      sandboxUrl: state.status === "healthy" ? state.sandboxUrl : null,
      sandboxId:
        state.status === "healthy"
          ? state.sandboxId
          : state.status === "unhealthy"
            ? state.sandboxId
            : state.status === "expired"
              ? state.sandboxId
              : null,

      // Loading states
      isLoading: isHealthLoading || state.status === "recovering",

      // Error information
      error:
        state.status === "failed"
          ? state.error
          : state.status === "unhealthy"
            ? state.error
            : null,

      // Recovery information
      canRecover:
        (state.status === "unhealthy" && state.canRecover) ||
        (state.status === "expired" && state.canRecover) ||
        (state.status === "failed" && state.canRetry),

      recoveryAttempts: recoveryAttempts.current,
      maxRecoveryAttempts: recoveryConfig.maxAttempts,

      // Progress information
      recoveryProgress: state.status === "recovering" ? state.progress : null,

      // UI display helpers
      statusMessage:
        state.status === "initializing"
          ? state.message
          : state.status === "healthy"
            ? "Sandbox is running"
            : state.status === "unhealthy"
              ? `Sandbox is unhealthy${state.error ? `: ${state.error}` : ""}`
              : state.status === "recovering"
                ? state.progress.message
                : state.status === "failed"
                  ? `Recovery failed: ${state.error}`
                  : state.status === "expired"
                    ? "Sandbox has expired"
                    : "Unknown status",

      // Determine if user action is needed
      needsUserAction: state.status === "failed" && !state.canRetry,
    }),
    [state, isHealthLoading, recoveryConfig.maxAttempts],
  );

  return {
    // Core state
    state,

    // Computed properties
    ...computed,

    // Actions
    actions,

    // Legacy compatibility (for gradual migration)
    refetch: actions.checkHealth,
    recoverSandbox: actions.recover,
  };
}

// Utility hook for UI components that just need simple status
export function useSandboxStatus(projectId: string) {
  const { isHealthy, isLoading, statusMessage, sandboxUrl } = useSandboxStateV3(
    {
      projectId,
      autoRecover: true,
      recoveryStrategy: "progressive",
    },
  );

  return {
    isHealthy,
    isLoading,
    statusMessage,
    sandboxUrl,
  };
}

// Hook for components that need full control
export function useSandboxControl(
  projectId: string,
  options?: Partial<UseSandboxStateOptions>,
) {
  return useSandboxStateV3({
    projectId,
    autoRecover: false,
    recoveryStrategy: "manual",
    ...options,
  });
}
