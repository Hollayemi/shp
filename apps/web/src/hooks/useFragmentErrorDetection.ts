import { useState, useCallback, useRef } from "react";
import type { ProjectErrors } from "@/lib/error-detector";

export interface FragmentErrorDetectionOptions {
  projectId: string;
  onErrorsDetected?: (errors: ProjectErrors) => void;
  onErrorResolved?: (errorId: string) => void;
}

export interface FragmentErrorDetectionState {
  errors: ProjectErrors | null;
  isDetecting: boolean;
  lastCheck: Date | null;
  errorCount: number;
  fragmentId: string | null;
}

export interface UseFragmentErrorDetectionReturn
  extends FragmentErrorDetectionState {
  triggerDetection: () => Promise<void>;
  clearErrors: () => void;
  acknowledgeError: (errorId: string) => void;
}

/**
 * Hook for fragment-based error detection
 * Triggers error detection only after fragment generation (not on interval)
 */
export function useFragmentErrorDetection({
  projectId,
  onErrorsDetected,
  onErrorResolved,
}: FragmentErrorDetectionOptions): UseFragmentErrorDetectionReturn {
  const [state, setState] = useState<FragmentErrorDetectionState>({
    errors: null,
    isDetecting: false,
    lastCheck: null,
    errorCount: 0,
    fragmentId: null,
  });

  const abortControllerRef = useRef<AbortController | undefined>(undefined);

  /**
   * Trigger error detection manually (called after fragment generation)
   */
  const triggerDetection = useCallback(async () => {
    if (state.isDetecting) return;

    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    setState((prev) => ({ ...prev, isDetecting: true }));

    try {
      console.log(
        "[FragmentErrorDetection] Triggering error detection after fragment generation..."
      );

      // Call server-side error detection
      const response = await fetch(`/api/errors/detect/${projectId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: abortControllerRef.current.signal,
      });

      if (response.ok) {
        const result = await response.json();

        if (result.success) {
          const detectedErrors: ProjectErrors = result.errors;

          setState((prev) => ({
            ...prev,
            errors: detectedErrors,
            lastCheck: new Date(),
            errorCount: detectedErrors.totalErrors,
            fragmentId: result.fragmentId || null,
          }));

          onErrorsDetected?.(detectedErrors);

          console.log(
            `[FragmentErrorDetection] Detected ${detectedErrors.totalErrors} errors in fragment ${result.fragmentId}`
          );
        } else {
          console.warn(
            "[FragmentErrorDetection] Error detection failed:",
            result.error
          );
        }
      } else {
        console.warn(
          "[FragmentErrorDetection] Error detection request failed:",
          response.status
        );
      }
    } catch (error: any) {
      // Don't log error if request was aborted (component unmounted)
      if (error.name !== "AbortError") {
        console.error(
          "[FragmentErrorDetection] Error detection failed:",
          error
        );
      }
    } finally {
      // Only update loading state if component is still mounted
      if (!abortControllerRef.current?.signal.aborted) {
        setState((prev) => ({ ...prev, isDetecting: false }));
      }
    }
  }, [projectId, state.isDetecting, onErrorsDetected]);

  /**
   * Clear all errors
   */
  const clearErrors = useCallback(() => {
    setState((prev) => ({
      ...prev,
      errors: null,
      errorCount: 0,
      fragmentId: null,
    }));
  }, []);

  /**
   * Acknowledge an error (mark as seen/resolved)
   */
  const acknowledgeError = useCallback(
    (errorId: string) => {
      setState((prev) => {
        if (!prev.errors) return prev;

        // Remove error from all categories
        const updatedErrors = {
          ...prev.errors,
          buildErrors: prev.errors.buildErrors.filter((e) => e.id !== errorId),
          importErrors: prev.errors.importErrors.filter(
            (e) => e.id !== errorId
          ),
          navigationErrors: prev.errors.navigationErrors.filter(
            (e) => e.id !== errorId
          ),
        };

        // Update total count
        updatedErrors.totalErrors =
          updatedErrors.buildErrors.length +
          updatedErrors.importErrors.length +
          updatedErrors.navigationErrors.length;

        return {
          ...prev,
          errors: updatedErrors,
          errorCount: updatedErrors.totalErrors,
        };
      });

      onErrorResolved?.(errorId);
    },
    [onErrorResolved]
  );

  return {
    ...state,
    triggerDetection,
    clearErrors,
    acknowledgeError,
  };
}
