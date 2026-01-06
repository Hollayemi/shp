"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";

type ConvexPage = "data" | "files" | "functions" | "logs" | "health" | "settings";

interface ConvexDashboardTabsProps {
  deploymentUrl: string;
  deploymentName: string;
  deployKey: string;
  activePage: ConvexPage;
}

interface IframeState {
  loaded: boolean;
  credentialsSent: boolean;
}

const CONVEX_PAGES: ConvexPage[] = ["data", "files", "functions", "logs", "health", "settings"];

/**
 * ConvexDashboardTabs - Preloads all Convex dashboard iframes and shows/hides them
 * based on the active page. This prevents reloading when switching tabs.
 */
export function ConvexDashboardTabs({
  deploymentUrl,
  deploymentName,
  deployKey,
  activePage,
}: ConvexDashboardTabsProps) {
  const iframeRefs = useRef<Map<ConvexPage, HTMLIFrameElement | null>>(new Map());
  const [iframeStates, setIframeStates] = useState<Map<ConvexPage, IframeState>>(
    () => new Map(CONVEX_PAGES.map((page) => [page, { loaded: false, credentialsSent: false }]))
  );
  const [hasVisitedConvex, setHasVisitedConvex] = useState(false);

  // Track which pages have been visited to lazy-load iframes
  const [visitedPages, setVisitedPages] = useState<Set<ConvexPage>>(new Set());

  // Mark the active page as visited
  useEffect(() => {
    if (activePage && !visitedPages.has(activePage)) {
      setVisitedPages((prev) => new Set([...prev, activePage]));
      setHasVisitedConvex(true);
    }
  }, [activePage, visitedPages]);

  // Preload other pages after initial page loads
  useEffect(() => {
    if (!hasVisitedConvex) return;

    // Preload other pages with a delay to not block the active page
    const timeout = setTimeout(() => {
      setVisitedPages(new Set(CONVEX_PAGES));
    }, 1000);

    return () => clearTimeout(timeout);
  }, [hasVisitedConvex]);

  const sendCredentials = useCallback(
    (page: ConvexPage) => {
      const iframe = iframeRefs.current.get(page);
      if (!iframe?.contentWindow) return;

      iframe.contentWindow.postMessage(
        {
          type: "dashboard-credentials",
          adminKey: deployKey,
          deploymentUrl,
          deploymentName,
          visiblePages: [],
        },
        "*"
      );

      setIframeStates((prev) => {
        const newMap = new Map(prev);
        const currentState = newMap.get(page) || { loaded: false, credentialsSent: false };
        newMap.set(page, { ...currentState, credentialsSent: true });
        return newMap;
      });

      // Mark as loaded after a short delay
      setTimeout(() => {
        setIframeStates((prev) => {
          const newMap = new Map(prev);
          const currentState = newMap.get(page) || { loaded: false, credentialsSent: false };
          newMap.set(page, { ...currentState, loaded: true });
          return newMap;
        });
      }, 500);
    },
    [deployKey, deploymentUrl, deploymentName]
  );

  // Listen for credential requests from all iframes
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type !== "dashboard-credentials-request") {
        return;
      }

      // Find which iframe sent this request and send credentials
      for (const page of CONVEX_PAGES) {
        const iframe = iframeRefs.current.get(page);
        if (iframe?.contentWindow === event.source) {
          const state = iframeStates.get(page);
          if (!state?.credentialsSent) {
            sendCredentials(page);
          }
          break;
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [iframeStates, sendCredentials]);

  // Fallback timeout for iframes that don't send credential requests
  useEffect(() => {
    const timeouts: NodeJS.Timeout[] = [];

    for (const page of CONVEX_PAGES) {
      if (visitedPages.has(page)) {
        const state = iframeStates.get(page);
        if (!state?.credentialsSent) {
          const timeout = setTimeout(() => {
            setIframeStates((prev) => {
              const newMap = new Map(prev);
              const currentState = newMap.get(page) || { loaded: false, credentialsSent: false };
              if (!currentState.loaded) {
                newMap.set(page, { ...currentState, loaded: true });
              }
              return newMap;
            });
          }, 5000);
          timeouts.push(timeout);
        }
      }
    }

    return () => timeouts.forEach((t) => clearTimeout(t));
  }, [visitedPages, iframeStates]);

  const getPageUrl = (page: ConvexPage): string => {
    // Health page uses empty string as the path
    const pagePath = page === "health" ? "" : page;
    return `https://dashboard-embedded.convex.dev/${pagePath}`;
  };

  const activeState = iframeStates.get(activePage);
  const isActiveLoading = !activeState?.loaded;

  return (
    <div className="relative h-full min-h-[500px] w-full">
      {/* Loading overlay for active page */}
      {isActiveLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-[#F3F3EE] dark:bg-[#1A2421]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-[#1E9A80]" />
            <p className="text-sm text-[#727272] dark:text-[#B8C9C3]">
              Loading Convex Dashboard...
            </p>
          </div>
        </div>
      )}

      {/* Render all visited iframes, showing only the active one */}
      {CONVEX_PAGES.map((page) => {
        const isActive = page === activePage;
        const isVisited = visitedPages.has(page);
        const state = iframeStates.get(page);

        if (!isVisited) return null;

        return (
          <iframe
            key={page}
            ref={(el) => {
              iframeRefs.current.set(page, el);
            }}
            src={getPageUrl(page)}
            allow="clipboard-write"
            className="h-full min-h-[500px] w-full rounded-lg border-0"
            style={{
              display: isActive ? "block" : "none",
              opacity: isActive && state?.loaded ? 1 : 0,
              transition: "opacity 0.3s ease-in-out",
              position: isActive ? "relative" : "absolute",
              visibility: isActive ? "visible" : "hidden",
            }}
          />
        );
      })}
    </div>
  );
}
