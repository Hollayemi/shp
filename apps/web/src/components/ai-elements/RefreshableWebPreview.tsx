"use client";

import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useCallback,
  useEffect,
  useState,
} from "react";
import { WebPreview, WebPreviewProps } from "./web-preview";

export interface RefreshableWebPreviewHandle {
  refresh: () => void;
  onMonitorInitialized: () => void;
  onContentLoaded: () => void;
}

export interface RefreshableWebPreviewProps extends WebPreviewProps {
  onRefreshReady?: (refresh: () => void) => void;
  onIframeLoad?: () => void;
  onMonitorInitialized?: () => void;
  onContentLoaded?: () => void;
  autoRefreshOnTimeout?: boolean; // Enable auto-refresh when content doesn't load
  contentLoadTimeout?: number; // Timeout in ms to wait for content (default: 5000)
  maxAutoRetries?: number; // Max number of auto-refresh attempts (default: 3)
}

export const RefreshableWebPreview = forwardRef<
  RefreshableWebPreviewHandle,
  RefreshableWebPreviewProps
>(
  (
    {
      onRefreshReady,
      onIframeLoad,
      onMonitorInitialized,
      onContentLoaded,
      defaultUrl,
      autoRefreshOnTimeout = true,
      contentLoadTimeout = 5000,
      maxAutoRetries = 3,
      ...props
    },
    ref,
  ) => {
    const [refreshKey, setRefreshKey] = useState(0);
    const [retryCount, setRetryCount] = useState(0);
    const [autoRetryCount, setAutoRetryCount] = useState(0);
    const refreshFunctionRef = useRef<(() => void) | null>(null);
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const contentLoadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const monitorInitializedRef = useRef(false);

  // Create a refresh function that updates the refresh key
  const handleRefresh = useCallback(() => {
    console.log("[RefreshableWebPreview] Triggering refresh");
    setRefreshKey((prev) => prev + 1);
    setRetryCount(0); // Reset retry count on manual refresh
    monitorInitializedRef.current = false; // Reset monitor state on refresh

    // Clear any pending timeouts
    if (contentLoadTimeoutRef.current) {
      clearTimeout(contentLoadTimeoutRef.current);
      contentLoadTimeoutRef.current = null;
    }
  }, []);

  // Handle monitor initialization - start waiting for content loaded
  const handleMonitorInitialized = useCallback(() => {
    console.log("[RefreshableWebPreview] Monitor initialized, waiting for content...");
    monitorInitializedRef.current = true;

    // Notify parent
    onMonitorInitialized?.();

    // Start timeout to auto-refresh if content doesn't load
    if (autoRefreshOnTimeout && autoRetryCount < maxAutoRetries) {
      if (contentLoadTimeoutRef.current) {
        clearTimeout(contentLoadTimeoutRef.current);
      }

      contentLoadTimeoutRef.current = setTimeout(() => {
        console.log(
          `[RefreshableWebPreview] Content not loaded after ${contentLoadTimeout}ms, auto-refreshing (attempt ${autoRetryCount + 1}/${maxAutoRetries})...`,
        );
        setAutoRetryCount((prev) => prev + 1);
        setRefreshKey((prev) => prev + 1);
      }, contentLoadTimeout);
    }
  }, [
    onMonitorInitialized,
    autoRefreshOnTimeout,
    autoRetryCount,
    maxAutoRetries,
    contentLoadTimeout,
  ]);

  // Handle content loaded - cancel auto-refresh timeout
  const handleContentLoadedInternal = useCallback(() => {
    console.log("[RefreshableWebPreview] Content loaded successfully");

    // Clear timeout - content loaded successfully
    if (contentLoadTimeoutRef.current) {
      clearTimeout(contentLoadTimeoutRef.current);
      contentLoadTimeoutRef.current = null;
    }

    // Reset auto-retry count on successful load
    setAutoRetryCount(0);

    // Notify parent
    onContentLoaded?.();
  }, [onContentLoaded]);

  // Check if iframe content is blank and retry if needed
  const checkIframeContent = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe || !defaultUrl) return;

    try {
      // Try to access iframe content (will fail for cross-origin)
      // For Vite dev server on same domain, we can check if it's blank
      const iframeDoc =
        iframe.contentDocument || iframe.contentWindow?.document;

      if (iframeDoc) {
        const bodyContent = iframeDoc.body?.innerText?.trim() || "";
        const hasContent =
          bodyContent.length > 0 || iframeDoc.querySelector("script");

        if (!hasContent && retryCount < 3) {
          console.log(
            `[RefreshableWebPreview] Blank page detected, retrying silently (attempt ${retryCount + 1}/3)...`,
          );
          setRetryCount((prev) => prev + 1);

          // Wait a bit for content to load, then retry
          retryTimeoutRef.current = setTimeout(() => {
            setRefreshKey((prev) => prev + 1);
          }, 2000 + retryCount * 1000); // Exponential backoff: 2s, 3s, 4s
        } else if (hasContent) {
          console.log("[RefreshableWebPreview] Content loaded successfully");
          setRetryCount(0);
        }
      }
    } catch (error) {
      // Cross-origin error is expected for external URLs, ignore
      console.log(
        "[RefreshableWebPreview] Cannot check iframe content (cross-origin)",
      );
    }
  }, [defaultUrl, retryCount]);

  // Set up iframe load listener
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      console.log("[RefreshableWebPreview] Iframe loaded");

      // Notify parent that iframe has loaded
      if (onIframeLoad) {
        onIframeLoad();
      }

      // Wait a bit for content to render, then check
      setTimeout(checkIframeContent, 1000);
    };

    iframe.addEventListener("load", handleLoad);
    return () => {
      iframe.removeEventListener("load", handleLoad);
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [checkIframeContent, onIframeLoad]);

  // Store the refresh function and notify parent
  useEffect(() => {
    refreshFunctionRef.current = handleRefresh;
    if (onRefreshReady) {
      onRefreshReady(handleRefresh);
    }
  }, [handleRefresh, onRefreshReady]);

  // Expose refresh function and monitoring handlers through ref
  useImperativeHandle(
    ref,
    () => ({
      refresh: handleRefresh,
      onMonitorInitialized: handleMonitorInitialized,
      onContentLoaded: handleContentLoadedInternal,
    }),
    [handleRefresh, handleMonitorInitialized, handleContentLoadedInternal],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (contentLoadTimeoutRef.current) {
        clearTimeout(contentLoadTimeoutRef.current);
      }
    };
  }, []);

  // Pass the refresh key to WebPreview to force refresh when it changes
  return (
    <WebPreview
      {...props}
      defaultUrl={defaultUrl}
      key={refreshKey} // Force re-mount of entire WebPreview when refresh is called
      ref={(el) => {
        // Get the iframe ref from WebPreview
        if (el) {
          const iframe = (el as any).querySelector?.("iframe");
          if (iframe) {
            iframeRef.current = iframe;
          }
        }
      }}
    />
  );
});

RefreshableWebPreview.displayName = "RefreshableWebPreview";
