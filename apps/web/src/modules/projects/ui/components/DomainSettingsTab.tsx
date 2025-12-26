"use client";

import { useState, useEffect } from "react";
import { ExternalLink, Globe } from "lucide-react";
import { DomainList } from "./DomainList";
import { BuyDomainSection } from "./BuyDomainSection";
import { ConnectDomainSection } from "./ConnectDomainSection";
import { createCustomDomain } from "@/lib/api/domains";
import { toast } from "sonner";

interface DomainSettingsTabProps {
  projectId: string;
  deploymentUrl?: string;
}

export function DomainSettingsTab({
  projectId,
  deploymentUrl,
}: DomainSettingsTabProps) {
  const [refreshDomains, setRefreshDomains] = useState(0);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoModeChecked, setDemoModeChecked] = useState(false);

  // Check if we're in demo mode
  useEffect(() => {
    const checkDemoMode = async () => {
      try {
        const response = await fetch('/api/domains/demo-mode');
        if (response.ok) {
          const data = await response.json();
          setIsDemoMode(data.demoMode || false);
        }
      } catch (error) {
        console.error('[Domains] Error checking demo mode:', error);
      } finally {
        setDemoModeChecked(true);
      }
    };
    checkDemoMode();
  }, []);

  // Handle domain purchased through Entri
  const handleDomainPurchased = async (domain: string) => {
    console.log("[Domains] Connecting purchased domain:", domain);

    try {
      const result = await createCustomDomain(projectId, domain);

      if (result.success) {
        console.log("[Domains] Purchased domain connected successfully");
        
        // Show success toast with next steps
        toast.success(
          `🎉 ${domain} purchased successfully! One more step to activate...`,
          {
            description: "Add the TXT verification record below to complete setup",
            duration: 8000,
          }
        );
        
        // Refresh domain list - this will show the new domain with DNS instructions
        setRefreshDomains(prev => prev + 1);
        
        // Scroll to the domain list after a brief delay
        setTimeout(() => {
          const domainListElement = document.querySelector('[data-domain-list]');
          if (domainListElement) {
            domainListElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }, 500);
      } else {
        console.error("[Domains] Failed to connect purchased domain:", result.error);
        toast.error(
          `Domain purchased but connection failed: ${result.error}`,
          {
            description: "You can manually connect it from the 'Connect Domain' section",
            duration: 10000,
          }
        );
      }
    } catch (error) {
      console.error("[Domains] Error connecting purchased domain:", error);
      toast.error(
        "Domain purchased but connection failed",
        {
          description: "You can manually connect it from the 'Connect Domain' section",
          duration: 10000,
        }
      );
    }
  };

  // Handle domain connected manually
  const handleDomainConnected = () => {
    setRefreshDomains(prev => prev + 1);
  };

  return (
    <div className="flex flex-col gap-4">

      {/* Demo Mode Banner */}
      {isDemoMode && demoModeChecked && (
        <div className="rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-4">
          <div className="flex items-start gap-3">
            <div className="text-2xl">🎭</div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
                Demo Mode Active
              </h4>
              <p className="text-xs text-blue-700 dark:text-blue-300 mb-2">
                You&apos;re testing the domain connection flow without Cloudflare credentials.
              </p>
              <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1 list-disc list-inside">
                <li>Domains will show as &quot;Pending&quot; initially</li>
                <li>After 10 seconds, refresh to see them become &quot;Active&quot;</li>
                <li>DNS instructions are simulated</li>
                <li>Set up real Cloudflare credentials to connect actual domains</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Current Deployment URL */}
      {deploymentUrl && (
        <div className="rounded-2xl bg-[#F3F3EE] p-4 dark:bg-[#1A2421] mb-2">
          <p className="text-xs text-[#727272] dark:text-[#8A9A94] mb-1">
            Current Deployment URL
          </p>
          <a
            href={deploymentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-[#0D9488] hover:underline flex items-center gap-1"
          >
            {deploymentUrl}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}

      {/* Buy a New Domain */}
      <BuyDomainSection
        projectId={projectId}
        onDomainPurchased={handleDomainPurchased}
      />

      {/* Connect Existing Domain */}
      <ConnectDomainSection
        projectId={projectId}
        onDomainConnected={handleDomainConnected}
      />

      {/* Connected Domains List */}
      <div className="mt-2 rounded-2xl bg-white p-4 dark:bg-[#0F1613]" data-domain-list>
        <div className="text-xs leading-[18px] font-medium text-[#14201F] dark:text-[#F5F9F7] mb-3">
          Connected Domains
        </div>

        <DomainList key={refreshDomains} projectId={projectId} />
      </div>
    </div>
  );
}
