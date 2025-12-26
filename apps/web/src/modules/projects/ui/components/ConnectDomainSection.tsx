"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Globe, ChevronDown, ChevronUp } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { createCustomDomain } from "@/lib/api/domains";

interface ConnectDomainSectionProps {
  projectId: string;
  onDomainConnected: () => void;
}

export function ConnectDomainSection({ projectId, onDomainConnected }: ConnectDomainSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customDomain, setCustomDomain] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  // Auto-clear error after 5 seconds
  useEffect(() => {
    if (connectError) {
      const timerId = setTimeout(() => {
        setConnectError(null);
      }, 5000);

      return () => clearTimeout(timerId);
    }
  }, [connectError]);

  const showError = (message: string) => {
    setConnectError(message);
  };

  const handleConnectDomain = async () => {
    if (!customDomain.trim()) {
      showError("Please enter a domain name");
      return;
    }

    // Basic domain validation
    const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i;
    if (!domainRegex.test(customDomain)) {
      showError("Please enter a valid domain (e.g., example.com)");
      return;
    }

    setIsConnecting(true);
    setConnectError(null);

    try {
      console.log("[Domains] Connecting domain:", customDomain);

      const result = await createCustomDomain(projectId, customDomain);

      if (result.success) {
        console.log("[Domains] Domain connected successfully");
        setCustomDomain("");
        setIsOpen(false);
        onDomainConnected();
      } else {
        showError(result.error || "Failed to connect domain");
      }
    } catch (error) {
      console.error("[Domains] Error connecting domain:", error);
      showError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="p-2 bg-[#F3F3EE] dark:bg-[#1A2421] rounded-2xl">
        <div className="flex items-center justify-between p-2 gap-4">
          <CollapsibleTrigger asChild>
            <button className="flex-1 flex items-center gap-2">
              <div className="flex-1 text-left flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-[#0D9488]" />
                  <h3 className="font-medium text-[#141414] dark:text-[#F5F9F7] leading-6">
                    Connect a Domain You Already Own
                  </h3>
                </div>
                <p className="text-sm text-[#727272] dark:text-[#8A9A94] leading-5">
                  Connect your existing domain to this project
                </p>
              </div>
            </button>
          </CollapsibleTrigger>

          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-7 h-7 bg-[#E6E6DB] dark:bg-[#0F1613] rounded-md flex items-center justify-center">
              {isOpen ? (
                <ChevronUp className="h-5 w-5 text-[#28303F] dark:text-[#B8C9C3]" />
              ) : (
                <ChevronDown className="h-5 w-5 text-[#28303F] dark:text-[#B8C9C3]" />
              )}
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent>
          <div className="p-2 bg-white dark:bg-[#0F1613] rounded-2xl border border-[#E5E5E5] dark:border-[#26263D]">
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium text-[#141414] dark:text-[#F5F9F7]">
                  Enter your domain name
                </p>

                <div className="relative flex items-center group">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none z-10">
                    <span className="bg-[#F3F3EE] dark:bg-[#26263D] text-[#727272] dark:text-[#8A9A94] px-2 py-1.5 rounded-md text-sm font-medium border border-transparent group-hover:border-[#E5E5E5] dark:group-hover:border-[#26263D] transition-colors">
                      https://
                    </span>
                  </div>
                  <Input
                    type="text"
                    placeholder="my-app.com"
                    value={customDomain}
                    onChange={(e) => setCustomDomain(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleConnectDomain();
                      }
                    }}
                    className="w-full pl-[5.25rem] h-11 bg-white dark:bg-[#0F1613] transition-all"
                  />
                </div>
              </div>

              {connectError && (
                <div className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-3">
                  <p className="text-xs text-red-700 dark:text-red-300">{connectError}</p>
                </div>
              )}

              <Button
                onClick={handleConnectDomain}
                disabled={isConnecting || !customDomain.trim()}
                className="w-full h-11 bg-[#0D9488] hover:bg-[#0D9488]/90 text-white disabled:opacity-50 font-medium text-[15px]"
              >
                {isConnecting ? "Connecting..." : "Connect Domain"}
              </Button>

              <p className="text-xs text-[#727272] dark:text-[#8A9A94] text-center pt-1">
                You&apos;ll receive DNS instructions after connecting
              </p>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
