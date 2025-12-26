"use client";

import { useEffect, useState, useCallback } from "react";
import {
  MonitorEvent,
  RuntimeErrorEvent,
  NetworkRequestEvent,
  ConsoleOutputEvent,
  ContentLoadedEvent,
  MONITOR_CONFIG,
} from "@shipper/shared";

export interface SandboxMonitorProps {
  /** Called when monitoring is initialized */
  onMonitorInitialized?: () => void;
  /** Called when a runtime error is detected */
  onError?: (error: RuntimeErrorEvent["data"]) => void;
  /** Called when a network request is made */
  onNetworkRequest?: (request: NetworkRequestEvent["data"]) => void;
  /** Called when console output is received */
  onConsoleOutput?: (output: ConsoleOutputEvent["data"]) => void;
  /** Called when URL changes */
  onUrlChange?: (url: string) => void;
  /** Called when content has loaded */
  onContentLoaded?: (data: ContentLoadedEvent["data"]) => void;
  /** Show debug UI for monitoring events */
  showDebugUI?: boolean;
}

interface MonitorLog {
  id: string;
  timestamp: string;
  type: string;
  data: unknown;
}

/**
 * SandboxMonitor Component
 *
 * Receives and processes monitoring events from the sandbox iframe via postMessage
 */
export function SandboxMonitor({
  onMonitorInitialized,
  onError,
  onNetworkRequest,
  onConsoleOutput,
  onUrlChange,
  onContentLoaded,
  showDebugUI = false,
}: SandboxMonitorProps) {
  const [logs, setLogs] = useState<MonitorLog[]>([]);
  const [errors, setErrors] = useState<RuntimeErrorEvent["data"][]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      // When using direct Modal URLs (staging/preview), monitoring script won't be injected
      // Skip message processing but monitoring will work via other mechanisms
      if (process.env.NEXT_PUBLIC_SKIP_MODAL_URL_TRANSFORM === "true") {
        return;
      }

      // Log ALL messages for debugging (even rejected ones)
      console.log("[SandboxMonitor] Raw message received:", {
        origin: event.origin,
        data: event.data,
        allowedOrigins: MONITOR_CONFIG.ALLOWED_ORIGINS,
      });

      // Validate origin - allow localhost and preview domains
      const isAllowedOrigin =
        MONITOR_CONFIG.ALLOWED_ORIGINS.includes(event.origin) ||
        event.origin.startsWith("http://localhost:") ||
        event.origin.startsWith("https://localhost:") ||
        event.origin.startsWith("http://preview--") ||
        event.origin.startsWith("https://preview--") ||
        event.origin.includes("localhost:3003") || // Daytona preview port
        event.origin.includes(".shipper.now") || // Shipper preview domains
        event.origin.includes(".modal.host"); // Direct Modal URLs

      if (!isAllowedOrigin) {
        console.warn(
          "[SandboxMonitor] Message rejected - origin not allowed:",
          event.origin,
        );
        return;
      }
      console.log("[SandboxMonitor] Message accepted:", event.data);

      const message = event.data as MonitorEvent;
      if (!message?.type) {
        console.warn("[SandboxMonitor] Message missing type field:", message);
        return;
      }

      // Add to logs for debug UI
      if (showDebugUI) {
        setLogs((prev) => [
          {
            id: `${Date.now()}-${Math.random()}`,
            timestamp: new Date().toISOString(),
            type: message.type,
            data: message.data,
          },
          ...prev.slice(0, 99), // Keep last 100 logs
        ]);
      }

      // Handle specific event types
      switch (message.type) {
        case "MONITOR_INITIALIZED":
          setIsConnected(true);
          console.log("[SandboxMonitor] Monitoring initialized");
          onMonitorInitialized?.();
          break;

        case "RUNTIME_ERROR":
        case "UNHANDLED_PROMISE_REJECTION": {
          const errorData = message.data as RuntimeErrorEvent["data"];
          setErrors((prev) => [errorData, ...prev.slice(0, 49)]);
          onError?.(errorData);
          console.error("[SandboxMonitor] Runtime error:", errorData);
          break;
        }

        case "NETWORK_REQUEST": {
          const requestData = message.data as NetworkRequestEvent["data"];
          onNetworkRequest?.(requestData);
          break;
        }

        case "CONSOLE_OUTPUT": {
          const outputData = message.data as ConsoleOutputEvent["data"];
          onConsoleOutput?.(outputData);
          break;
        }

        case "URL_CHANGED": {
          const urlData = message.data as { url: string };
          onUrlChange?.(urlData.url);
          break;
        }

        case "CONTENT_LOADED": {
          const contentData = message.data as ContentLoadedEvent["data"];
          console.log("[SandboxMonitor] Content loaded:", contentData);
          onContentLoaded?.(contentData);
          break;
        }

        case "BLANK_SCREEN_DETECTED": {
          console.warn("[SandboxMonitor] Blank screen detected:", message.data);
          break;
        }
      }
    },
    [
      onMonitorInitialized,
      onError,
      onNetworkRequest,
      onConsoleOutput,
      onUrlChange,
      onContentLoaded,
      showDebugUI,
    ],
  );

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  // When using direct Modal URLs, simulate monitoring events since the script won't be injected
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SKIP_MODAL_URL_TRANSFORM === "true") {
      console.log(
        "[SandboxMonitor] Direct Modal URL mode - simulating monitor initialization and content loaded",
      );

      // Simulate monitor initialization
      if (onMonitorInitialized) {
        onMonitorInitialized();
      }

      // Simulate content loaded after a short delay to allow iframe to load
      const timer = setTimeout(() => {
        if (onContentLoaded) {
          onContentLoaded({
            hasContent: true,
            rootElementExists: true,
            rootHasChildren: true,
            hmrComplete: true,
            reactReady: true,
          });
        }
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [onMonitorInitialized, onContentLoaded]);

  if (!showDebugUI) {
    return null;
  }

  return (
    <div className="fixed right-4 bottom-4 z-[9999] max-h-96 w-96 overflow-hidden rounded-lg bg-black/90 text-white shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-700 bg-gray-800 px-4 py-2">
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full ${
              isConnected ? "bg-green-500" : "bg-red-500"
            }`}
          />
          <span className="text-sm font-semibold">Sandbox Monitor</span>
        </div>
        <div className="flex items-center gap-2">
          {errors.length > 0 && (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">
              {errors.length} error{errors.length !== 1 ? "s" : ""}
            </span>
          )}
          <button
            onClick={() => setLogs([])}
            className="text-xs text-gray-400 hover:text-white"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Logs */}
      <div className="max-h-80 space-y-1 overflow-y-auto p-2 font-mono text-xs">
        {logs.length === 0 ? (
          <div className="py-8 text-center text-gray-500">
            Waiting for events...
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className={`rounded border-l-2 p-2 ${getLogColor(log.type)}`}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="font-semibold">{log.type}</span>
                <span className="text-xs text-gray-500">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <pre className="max-h-32 overflow-y-auto text-xs break-words whitespace-pre-wrap text-gray-300">
                {JSON.stringify(log.data, null, 2)}
              </pre>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function getLogColor(type: string): string {
  switch (type) {
    case "RUNTIME_ERROR":
    case "UNHANDLED_PROMISE_REJECTION":
      return "border-red-500 bg-red-950/20";
    case "NETWORK_REQUEST":
      return "border-blue-500 bg-blue-950/20";
    case "CONSOLE_OUTPUT":
      return "border-yellow-500 bg-yellow-950/20";
    case "URL_CHANGED":
      return "border-purple-500 bg-purple-950/20";
    default:
      return "border-gray-500 bg-gray-950/20";
  }
}
