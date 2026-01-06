import { useState, useEffect, useCallback, useRef } from "react";
import type { ProjectErrors, RuntimeError } from "@/lib/error-detector";
import { ErrorType, ErrorSeverity } from "@/lib/db";

export interface ErrorMonitoringOptions {
  projectId: string;
  enabled?: boolean;
  onErrorsDetected?: (errors: ProjectErrors) => void;
  onErrorResolved?: (errorId: string) => void;
  onNewError?: (error: RuntimeError) => void;
}

export interface ErrorMonitoringState {
  errors: ProjectErrors | null;
  isMonitoring: boolean;
  lastCheck: Date | null;
  errorCount: number;
  runtimeErrors: RuntimeError[];
  isDetecting: boolean;
}

export interface UseErrorMonitoringReturn extends ErrorMonitoringState {
  startMonitoring: () => void;
  stopMonitoring: () => void;
  triggerDetection: () => Promise<void>;
  clearErrors: () => void;
  acknowledgeError: (errorId: string) => void;
}

/**
 * Hook for error monitoring in project fragments
 * Monitors iframe console errors and triggers detection after fragment generation
 */
export function useErrorMonitoring({
  projectId,
  enabled = true,
  onErrorsDetected,
  onErrorResolved,
  onNewError,
}: ErrorMonitoringOptions): UseErrorMonitoringReturn {
  const [state, setState] = useState<ErrorMonitoringState>({
    errors: null,
    isMonitoring: false,
    lastCheck: null,
    errorCount: 0,
    runtimeErrors: [],
    isDetecting: false,
  });

  const iframeRef = useRef<HTMLIFrameElement | undefined>(undefined);
  const consoleErrorsRef = useRef<RuntimeError[]>([]);
  const abortControllerRef = useRef<AbortController | undefined>(undefined);

  /**
   * Generate unique error ID
   */
  const generateErrorId = useCallback((): string => {
    return `runtime_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  /**
   * Parse console error into RuntimeError format
   */
  const parseConsoleError = useCallback(
    (error: ErrorEvent | PromiseRejectionEvent): RuntimeError => {
      let message = "";
      let stack = "";
      let url = "";
      let line = 0;
      let column = 0;

      if ("message" in error) {
        message = error.message;
        stack = error.error?.stack || "";
        url = error.filename || "";
        line = error.lineno || 0;
        column = error.colno || 0;
      } else if ("reason" in error) {
        message = String(error.reason);
        stack = error.reason?.stack || "";
      }

      return {
        id: generateErrorId(),
        type: ErrorType.RUNTIME,
        message,
        stack,
        url,
        line,
        column,
        severity: determineRuntimeErrorSeverity(message),
        autoFixable: isRuntimeErrorAutoFixable(message),
        details: {
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href,
        },
      };
    },
    [generateErrorId]
  );

  /**
   * Determine severity of runtime error
   */
  const determineRuntimeErrorSeverity = useCallback(
    (message: string): ErrorSeverity => {
      const criticalPatterns = [
        /Cannot read propert/i,
        /Cannot access/i,
        /ReferenceError/i,
        /TypeError/i,
        /Maximum call stack/i,
        /Cannot find module/i,
        /Module not found/i,
        /Failed to resolve/i,
        /Cannot resolve/i,
        /does not provide an export named/i,
        /does not provide an export/i,
        /has no exported member/i,
        /Cannot import/i,
        /Import error/i,
        /Export.*not found/i,
        /Uncaught SyntaxError/i,
      ];

      const highPatterns = [
        /Module not found/i,
        /Failed to fetch/i,
        /Network error/i,
        /Timeout/i,
      ];

      if (criticalPatterns.some((pattern) => pattern.test(message))) {
        return ErrorSeverity.CRITICAL;
      }

      if (highPatterns.some((pattern) => pattern.test(message))) {
        return ErrorSeverity.HIGH;
      }

      return ErrorSeverity.MEDIUM;
    },
    []
  );

  /**
   * Determine if runtime error is auto-fixable
   */
  const isRuntimeErrorAutoFixable = useCallback((message: string): boolean => {
    const autoFixablePatterns = [
      /Cannot read propert/i,
      /Cannot access/i,
      /Module not found/i,
      /Failed to fetch/i,
      /Cannot find module/i,
      /Failed to resolve/i,
      /Cannot resolve/i,
      /does not provide an export named/i,
      /does not provide an export/i,
      /has no exported member/i,
      /Cannot import/i,
      /Import error/i,
      /Export.*not found/i,
      /Uncaught SyntaxError/i,
    ];

    return autoFixablePatterns.some((pattern) => pattern.test(message));
  }, []);

  /**
   * Setup iframe error monitoring
   */
  const setupIframeMonitoring = useCallback(
    (iframe: HTMLIFrameElement) => {
      if (!iframe || !iframe.contentWindow) return;

      try {
        // Monitor console errors in iframe
        const iframeWindow = iframe.contentWindow as any;

        // Override console.error in iframe to capture errors
        const originalConsoleError = iframeWindow.console.error;
        iframeWindow.console.error = (...args: any[]) => {
          const errorMessage = args.join(" ");
          const runtimeError = parseConsoleError({
            message: errorMessage,
            error: new Error(errorMessage),
          } as any);

          consoleErrorsRef.current.push(runtimeError);
          onNewError?.(runtimeError);

          // Call original console.error
          originalConsoleError.apply(iframeWindow.console, args);
        };

        // Monitor unhandled errors in iframe
        iframeWindow.addEventListener("error", (event: ErrorEvent) => {
          console.log("[ErrorMonitoring] Caught iframe error:", event);
          const runtimeError = parseConsoleError(event);
          consoleErrorsRef.current.push(runtimeError);
          onNewError?.(runtimeError);
        });

        // Monitor unhandled promise rejections in iframe
        iframeWindow.addEventListener(
          "unhandledrejection",
          (event: PromiseRejectionEvent) => {
            console.log(
              "[ErrorMonitoring] Caught iframe promise rejection:",
              event
            );
            const runtimeError = parseConsoleError(event);
            consoleErrorsRef.current.push(runtimeError);
            onNewError?.(runtimeError);
          }
        );

        // Monitor module loading errors specifically
        iframeWindow.addEventListener("error", (event: ErrorEvent) => {
          // Check if this is a module loading error
          if (
            event.message &&
            (event.message.includes("does not provide an export") ||
              event.message.includes("Cannot find module") ||
              event.message.includes("Module not found") ||
              event.message.includes("Failed to resolve") ||
              event.message.includes("Uncaught SyntaxError"))
          ) {
            console.log(
              "[ErrorMonitoring] Caught module loading error:",
              event
            );
            const runtimeError = parseConsoleError(event);
            runtimeError.severity = ErrorSeverity.CRITICAL;
            runtimeError.autoFixable = true;
            consoleErrorsRef.current.push(runtimeError);
            onNewError?.(runtimeError);
          }
        });

        console.log("[ErrorMonitoring] Iframe error monitoring setup complete");
      } catch (error) {
        console.warn(
          "[ErrorMonitoring] Could not setup iframe monitoring:",
          error
        );
      }
    },
    [parseConsoleError, onNewError]
  );

  /**
   * Trigger error detection manually
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
      console.log("[ErrorMonitoring] Triggering manual error detection...");

      // Call server-side error detection
      const response = await fetch(`/api/errors/detect/${projectId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: abortControllerRef.current.signal,
      });

      if (response.ok) {
        const detectedErrors: ProjectErrors = await response.json();

        setState((prev) => ({
          ...prev,
          errors: detectedErrors,
          lastCheck: new Date(),
          errorCount: detectedErrors.totalErrors,
        }));

        onErrorsDetected?.(detectedErrors);
      } else {
        console.warn(
          "[ErrorMonitoring] Error detection request failed:",
          response.status
        );
      }
    } catch (error: any) {
      // Don't log error if request was aborted (component unmounted)
      if (error.name !== "AbortError") {
        console.error("[ErrorMonitoring] Error detection failed:", error);
      }
    } finally {
      // Only update loading state if component is still mounted
      if (!abortControllerRef.current?.signal.aborted) {
        setState((prev) => ({ ...prev, isDetecting: false }));
      }
    }
  }, [projectId, state.isDetecting, onErrorsDetected]);

  /**
   * Start monitoring (iframe only, no interval)
   */
  const startMonitoring = useCallback(() => {
    if (state.isMonitoring) return;

    console.log("[ErrorMonitoring] Starting iframe error monitoring...");

    setState((prev) => ({ ...prev, isMonitoring: true }));

    // Setup iframe monitoring if iframe is available
    const iframe = document.querySelector(
      'iframe[src*="localhost:1234"]'
    ) as HTMLIFrameElement;
    if (iframe) {
      iframeRef.current = iframe;
      setupIframeMonitoring(iframe);
    }
  }, [state.isMonitoring, setupIframeMonitoring]);

  /**
   * Stop monitoring
   */
  const stopMonitoring = useCallback(() => {
    if (!state.isMonitoring) return;

    console.log("[ErrorMonitoring] Stopping error monitoring...");

    setState((prev) => ({ ...prev, isMonitoring: false }));

    // Abort any ongoing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = undefined;
    }

    iframeRef.current = undefined;
    consoleErrorsRef.current = [];
  }, [state.isMonitoring]);

  /**
   * Clear all errors
   */
  const clearErrors = useCallback(() => {
    setState((prev) => ({
      ...prev,
      errors: null,
      errorCount: 0,
      runtimeErrors: [],
    }));

    consoleErrorsRef.current = [];
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

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      stopMonitoring();
    };
  }, [stopMonitoring]);

  /**
   * Auto-start monitoring when enabled
   */
  useEffect(() => {
    if (enabled && projectId) {
      startMonitoring();
    } else {
      stopMonitoring();
    }
  }, [enabled, projectId, startMonitoring, stopMonitoring]);

  /**
   * Update runtime errors from console monitoring
   */
  useEffect(() => {
    if (consoleErrorsRef.current.length > 0) {
      setState((prev) => ({
        ...prev,
        runtimeErrors: [...consoleErrorsRef.current],
      }));
    }
  }, [consoleErrorsRef.current.length]);

  return {
    ...state,
    startMonitoring,
    stopMonitoring,
    triggerDetection,
    clearErrors,
    acknowledgeError,
  };
}

/**
 * Hook for monitoring iframe-specific errors
 */
export function useIframeErrorMonitoring(
  iframeRef: React.RefObject<HTMLIFrameElement>
) {
  const [iframeErrors, setIframeErrors] = useState<RuntimeError[]>([]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentWindow) return;

    const handleError = (event: ErrorEvent) => {
      const runtimeError: RuntimeError = {
        id: `iframe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: ErrorType.RUNTIME,
        message: event.message,
        stack: event.error?.stack || "",
        url: event.filename || "",
        line: event.lineno || 0,
        column: event.colno || 0,
        severity: ErrorSeverity.MEDIUM,
        autoFixable: true,
        details: {
          timestamp: new Date().toISOString(),
          source: "iframe",
        },
      };

      setIframeErrors((prev) => [...prev, runtimeError]);
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const runtimeError: RuntimeError = {
        id: `iframe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: ErrorType.RUNTIME,
        message: String(event.reason),
        stack: event.reason?.stack || "",
        severity: ErrorSeverity.MEDIUM,
        autoFixable: true,
        details: {
          timestamp: new Date().toISOString(),
          source: "iframe",
          type: "unhandledRejection",
        },
      };

      setIframeErrors((prev) => [...prev, runtimeError]);
    };

    try {
      iframe.contentWindow.addEventListener("error", handleError);
      iframe.contentWindow.addEventListener(
        "unhandledrejection",
        handleRejection
      );

      return () => {
        iframe.contentWindow?.removeEventListener("error", handleError);
        iframe.contentWindow?.removeEventListener(
          "unhandledrejection",
          handleRejection
        );
      };
    } catch (error) {
      console.warn(
        "[IframeErrorMonitoring] Could not setup iframe error monitoring:",
        error
      );
    }
  }, [iframeRef]);

  return iframeErrors;
}
