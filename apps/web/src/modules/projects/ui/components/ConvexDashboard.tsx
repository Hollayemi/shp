"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

interface ConvexDashboardProps {
  deploymentUrl: string;
  deploymentName: string;
  deployKey: string;
  visiblePages?: Array<
    | "health"
    | "data"
    | "functions"
    | "files"
    | "schedules"
    | "logs"
    | "history"
    | "settings"
  >;
  defaultPage?: string;
}

export function ConvexDashboard({
  deploymentUrl,
  deploymentName,
  deployKey,
  visiblePages,
  defaultPage = "data",
}: ConvexDashboardProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [credentialsSent, setCredentialsSent] = useState(false);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Wait for the iframe to send a dashboard-credentials-request message
      // This ensures we don't send credentials until the iframe is ready
      if (event.data?.type !== "dashboard-credentials-request") {
        return;
      }

      iframeRef.current?.contentWindow?.postMessage(
        {
          type: "dashboard-credentials",
          adminKey: deployKey,
          deploymentUrl,
          deploymentName,
          visiblePages,
        },
        "*",
      );

      setCredentialsSent(true);

      // Add a small delay before showing the iframe to avoid flashing login screen
      setTimeout(() => {
        setIsLoading(false);
      }, 500);
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [deploymentUrl, deployKey, deploymentName, visiblePages]);

  // Fallback timeout in case credentials request never comes
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!credentialsSent) {
        setIsLoading(false);
      }
    }, 5000);

    return () => clearTimeout(timeout);
  }, [credentialsSent]);

  return (
    <div className="relative h-full min-h-[500px] w-full">
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-[#F3F3EE] dark:bg-[#1A2421]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-[#1E9A80]" />
            <p className="text-sm text-[#727272] dark:text-[#B8C9C3]">
              Loading Convex Dashboard...
            </p>
          </div>
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={`https://dashboard-embedded.convex.dev/${defaultPage}`}
        allow="clipboard-write"
        className="h-full min-h-[500px] w-full rounded-lg border-0"
        style={{
          opacity: isLoading ? 0 : 1,
          transition: "opacity 0.3s ease-in-out",
        }}
      />
    </div>
  );
}
