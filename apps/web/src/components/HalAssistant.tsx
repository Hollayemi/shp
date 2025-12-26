"use client";

import { useState, useEffect, useMemo } from "react";
import { useAtom } from "jotai";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { X } from "lucide-react";
import {
  halAssistantOpenAtom,
  halAssistantMiniPopupOpenAtom,
  halAssistantHasNewDeliverableAtom,
  setHalAssistantHasNewDeliverableAtom,
  createAdvisorCurrentTabAtom,
  // advisorPinnedHatsAtom, // COMMENTED OUT - not using pinned hats
} from "@/lib/hal-assistant-state";
import { HalSuggestionsChat } from "./HalSuggestionsChat";
import { AdvisorLogo } from "./AdvisorLogo";
import { ExpandMiniIcon } from "./icons/ExpandMiniIcon";
import { ADVISOR_HATS, type AdvisorHatType } from "@/lib/advisor-hats";
import { cn } from "@/lib/utils";
import { HalSuggestionsChatWrapper } from "./HalSuggestionsChatWrapper";

interface HalAssistantProps {
  className?: string;
  projectId?: string;
  projectFiles?: { [path: string]: string } | null;
  isSandboxReady?: boolean;
  hasNewDeliverable?: boolean;
  onSuggestionClick?: (prompt: string) => void;
  // External control props to override modal behavior
  isControlledExternally?: boolean;
  onToggle?: () => void;
  isOpen?: boolean;
  onExpand?: () => void;
  // Callback to notify parent that deliverable has been viewed
  onDeliverableViewed?: () => void;
}

export function HalAssistant({
  className = "",
  projectId,
  projectFiles,
  isSandboxReady = false,
  hasNewDeliverable = false,
  onSuggestionClick,
  isControlledExternally = false,
  onToggle,
  isOpen: externalIsOpen,
  onExpand,
  onDeliverableViewed,
}: HalAssistantProps) {
  // Use mini popup atom for the dropdown, not the full panel atom
  const [isMiniPopupOpen, setIsMiniPopupOpen] = useAtom(
    halAssistantMiniPopupOpenAtom,
  );
  const [isFullPanelOpen, setIsFullPanelOpen] = useAtom(halAssistantOpenAtom);
  const [hasInteractedWithHal, setHasInteractedWithHal] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [, setHasNewDeliverable] = useAtom(
    setHalAssistantHasNewDeliverableAtom,
  );
  const currentTabAtom = useMemo(
    () => createAdvisorCurrentTabAtom(projectId || "default"),
    [projectId],
  );
  const [, setCurrentTab] = useAtom(currentTabAtom);

  // COMMENTED OUT: Pinned hats state
  // const [pinnedHats] = useAtom(advisorPinnedHatsAtom);
  // const [selectedPinnedHat, setSelectedPinnedHat] =
  //   useState<AdvisorHatType>("generalist");

  // Sync hasNewDeliverable with Jotai state and notification
  useEffect(() => {
    setHasNewDeliverable(hasNewDeliverable);
    if (hasNewDeliverable && !hasInteractedWithHal) {
      setShowNotification(true);
    }
  }, [hasNewDeliverable, setHasNewDeliverable, hasInteractedWithHal]);

  // Ensure mini popup and full panel are never open at the same time
  useEffect(() => {
    if (isFullPanelOpen && isMiniPopupOpen) {
      setIsMiniPopupOpen(false);
    }
  }, [isFullPanelOpen, isMiniPopupOpen, setIsMiniPopupOpen]);

  const handleClick = () => {
    if (isControlledExternally && onToggle) {
      onToggle();
      // Clear notification on interaction
      setShowNotification(false);
      setHasInteractedWithHal(true);
      // Notify parent that deliverable has been viewed
      if (hasNewDeliverable && onDeliverableViewed) {
        onDeliverableViewed();
      }
      return;
    }

    // If full panel is open, close it instead of toggling mini popup
    if (isFullPanelOpen) {
      setIsFullPanelOpen(false);
      // Clear notification on interaction
      setShowNotification(false);
      setHasInteractedWithHal(true);
      // Notify parent that deliverable has been viewed
      if (hasNewDeliverable && onDeliverableViewed) {
        onDeliverableViewed();
      }
      return;
    }

    // Toggle mini popup only (not the full panel)
    const newOpenState = !isMiniPopupOpen;
    setIsMiniPopupOpen(newOpenState);

    // Mark as interacted and clear notification when user opens HAL
    if (newOpenState) {
      setHasInteractedWithHal(true);
      setShowNotification(false);
      // Notify parent that deliverable has been viewed
      if (hasNewDeliverable && onDeliverableViewed) {
        onDeliverableViewed();
      }
    }
  };

  // Handle dropdown open/close change
  const handleDropdownOpenChange = (open: boolean) => {
    setIsMiniPopupOpen(open);

    // When dropdown opens, clear notification
    if (open) {
      setHasInteractedWithHal(true);
      setShowNotification(false);
      // Notify parent that deliverable has been viewed
      if (hasNewDeliverable && onDeliverableViewed) {
        onDeliverableViewed();
      }
    }
  };

  return (
    <div className="relative h-[29px]">
      <DropdownMenu
        open={!isControlledExternally && isMiniPopupOpen}
        onOpenChange={handleDropdownOpenChange}
      >
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  onClick={handleClick}
                  variant="ghost"
                  className={`dark:bg-prj-bg-secondary dark:hover:bg-prj-bg-secondary relative flex h-[29px] w-[91px] items-center justify-center gap-1 rounded-[8px] border bg-[#F3F3EE] py-0 transition-all duration-300 hover:bg-[#eaeae6] ${hasNewDeliverable ? "animate-premium-border" : "border-[rgba(191,141,249,0.10)] hover:border-[#E808FC]"}`}
                  aria-label="Open Advisor"
                >
                  {hasNewDeliverable && (
                    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[8px]">
                      <div className="animate-premium-shine absolute -bottom-[50%] -left-[50%] h-[200%] w-[200%] opacity-95">
                        {/* Main whitish shine layer */}
                        <div className="absolute inset-0 bg-[linear-gradient(75deg,transparent_40%,rgba(255,255,255,0.85)_48%,rgba(255,255,255,0.95)_50%,rgba(255,255,255,0.85)_52%,transparent_60%)] mix-blend-overlay" />
                        {/* Subtle shimmer layer */}
                        <div className="absolute inset-0 bg-[linear-gradient(75deg,transparent_42%,rgba(248,248,255,0.6)_49%,rgba(255,255,255,0.7)_50%,rgba(248,248,255,0.6)_51%,transparent_58%)]" />
                        {/* Soft glow layer */}
                        <div className="absolute inset-0 bg-[linear-gradient(75deg,transparent_45%,rgba(255,255,255,0.3)_50%,transparent_55%)] blur-[2px]" />
                      </div>
                    </div>
                  )}

                  <AdvisorLogo className="relative z-10" />
                  <span className="relative z-10 text-sm font-medium text-[#45227A] dark:text-purple-300">
                    Advisor
                  </span>
                  {hasNewDeliverable && (
                    <div className="absolute top-[-6.5px] right-[-3.5px] z-20 flex h-[13px] w-[13px] flex-col items-center justify-center gap-[4px] rounded-full bg-[#B20C0C] px-[4.5px] py-[1.5px] [box-shadow:0_1px_2.5px_0_rgba(103,110,118,0.08)]">
                      <span className="text-[9px] leading-none font-semibold text-white">
                        1
                      </span>
                    </div>
                  )}
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            {/* <TooltipContent>
              <p>The Advisor</p>
            </TooltipContent> */}
          </Tooltip>
        </TooltipProvider>

        {/* Mini Chat Popup - DropdownMenu */}
        {!isControlledExternally && (
          <DropdownMenuContent
            align="end"
            className="max-h-[500px] w-[400px] rounded-[16px] p-0"
            sideOffset={8}
          >
            <div className="dark:bg-prj-bg-primary flex flex-col bg-white">
              {/* Mini header with expand button */}
              <div className="border-[rgba(0, 0, 0, 0.04)] flex items-center justify-between border-b px-4 py-3">
                <div className="flex items-center gap-2">
                  <AdvisorLogo />
                  <span className="text-prj-text-primary text-sm font-medium">
                    Shipper Advisor
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {onExpand && (
                    <Button
                      onClick={() => {
                        setIsMiniPopupOpen(false); // Close mini popup
                        setCurrentTab("generalist"); // Ensure generalist is active when expanding
                        onExpand(); // Open full panel
                        // Notify parent that deliverable has been viewed when expanding
                        if (hasNewDeliverable && onDeliverableViewed) {
                          onDeliverableViewed();
                        }
                      }}
                      variant="ghost"
                      className="flex h-5 w-5 items-center justify-center rounded-[5px] border-t-[1.25px] border-t-white bg-[linear-gradient(180deg,#FFF_0%,#F6F7F7_100%)] p-2 shadow-[0_1.667px_3.333px_0_rgba(198,210,207,0.15),0_0_0_0.833px_#DCDEDD] hover:opacity-90 dark:border-t-[#2A2A2A] dark:bg-[linear-gradient(180deg,#2A2A2A_0%,#1F1F1F_100%)] dark:shadow-[0_1.667px_3.333px_0_rgba(0,0,0,0.3),0_0_0_0.833px_#3A3A3A]"
                      title="Expand to full view"
                      size="icon"
                    >
                      <ExpandMiniIcon className="flex-no-shrink h-[7.5px] w-[7.5px] fill-current" />
                    </Button>
                  )}
                  <Button
                    onClick={() => setIsMiniPopupOpen(false)}
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 rounded-[5px] border-t-[1.25px] border-t-white bg-[linear-gradient(180deg,#FFF_0%,#F6F7F7_100%)] p-0 shadow-[0_1.667px_3.333px_0_rgba(198,210,207,0.15),0_0_0_0.833px_#DCDEDD] hover:opacity-90 dark:border-t-[#2A2A2A] dark:bg-[linear-gradient(180deg,#2A2A2A_0%,#1F1F1F_100%)] dark:shadow-[0_1.667px_3.333px_0_rgba(0,0,0,0.3),0_0_0_0.833px_#3A3A3A]"
                    title="Close"
                  >
                    <X className="h-[6.67px] w-[6.67px]" />
                  </Button>
                </div>
              </div>

              {/* COMMENTED OUT: Pinned hats tabs (mini version) */}
              {/* {pinnedHats.length > 1 && (
                <div className="border-prj-border-primary scrollbar-hide flex items-center gap-1 overflow-x-auto border-b px-2">
                  {pinnedHats.map((hatType) => {
                    const hat = ADVISOR_HATS[hatType];
                    const Icon = hat.icon;
                    const isActive = hatType === selectedPinnedHat;

                    return (
                      <button
                        key={hatType}
                        onClick={() => setSelectedPinnedHat(hatType)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-t-lg px-2 py-1.5 text-xs font-medium transition-colors",
                          "min-w-0 flex-shrink-0 whitespace-nowrap",
                          isActive
                            ? "dark:bg-prj-bg-secondary text-prj-text-primary bg-[#F9F3FC]"
                            : "text-prj-text-secondary hover:text-prj-text-primary hover:bg-prj-bg-hover bg-transparent",
                        )}
                      >
                        <Icon className="h-3 w-3 flex-shrink-0" />
                        <span className="max-w-[80px] truncate">
                          {hat.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )} */}

              {/* Chat content */}
              <div className="min-h-0 flex-1 flex-col overflow-hidden">
                <HalSuggestionsChatWrapper
                  projectId={projectId || ""}
                  projectFiles={projectFiles}
                  isSandboxReady={isSandboxReady}
                  onSuggestionClick={onSuggestionClick}
                  onClose={() => setIsMiniPopupOpen(false)}
                  triggerSuggestions={hasNewDeliverable}
                  onSuggestionsTriggered={() => setHasNewDeliverable(false)}
                  className="h-[440px]"
                  isMiniMenu={true}
                />
              </div>
            </div>
          </DropdownMenuContent>
        )}
      </DropdownMenu>
    </div>
  );
}
