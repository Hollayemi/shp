"use client";

// COMMENTED OUT: useState - not using pinned menu state
// import { useState } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import type { AdvisorHatType } from "@/lib/advisor-hats";
import { ADVISOR_HATS } from "@/lib/advisor-hats";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddAdvisorButtonWithTooltip } from "@/components/AddAdvisorButtonWithTooltip";
// COMMENTED OUT: PinnedHatsDropdown - not using pinned hats feature
// import { PinnedHatsDropdown } from "@/components/PinnedHatsDropdown";

interface AdvisorTabBarProps {
  activeTabs: AdvisorHatType[];
  currentTab: AdvisorHatType;
  onTabChange: (tab: AdvisorHatType) => void;
  onTabClose: (tab: AdvisorHatType) => void;
  onAddTab: (hatType?: AdvisorHatType) => void;
  onOpenHatSelector?: () => void;
}

export function AdvisorTabBar({
  activeTabs,
  currentTab,
  onTabChange,
  onTabClose,
  onAddTab,
  onOpenHatSelector,
}: AdvisorTabBarProps) {
  // COMMENTED OUT: Pinned menu state - not using pinned hats feature
  // const [isPinnedMenuOpen, setIsPinnedMenuOpen] = useState(false);

  // COMMENTED OUT: handleOpenPinnedHat - not using pinned hats feature
  // const handleOpenPinnedHat = (hatType: AdvisorHatType) => {
  //   if (!activeTabs.includes(hatType)) {
  //     onAddTab(hatType);
  //   } else {
  //     onTabChange(hatType);
  //   }
  // };

  return (
    <>
      <div className="border-prj-border-primary scrollbar-hide dark:bg-prj-bg-primary flex items-center justify-start gap-[7.43px] overflow-x-auto bg-white p-2 border-b">
        <TabsList className="h-auto justify-start gap-[7.43px] bg-transparent p-0">
          {activeTabs.map((hatType) => {
            const hat = ADVISOR_HATS[hatType];
            const Icon = hat.icon;
            const isActive = hatType === currentTab;

            return (
              <Tooltip key={hatType}>
                <TooltipTrigger asChild>
                  <TabsTrigger
                    value={hatType}
                    onClick={() => onTabChange(hatType)}
                    className={cn(
                      "flex min-w-0 flex-shrink-0 items-center justify-center gap-1.5 overflow-hidden whitespace-nowrap",
                      "pt-[4px] pr-[6px] pb-[4px] pl-[4px]",
                      "dark:bg-prj-bg-secondary rounded-[5.57px] bg-white",
                      "shadow-[0px_0.9285714030265808px_1.8571428060531616px_-0.9285714030265808px_rgba(18,26,43,0.06)] dark:shadow-[0px_0.9285714030265808px_1.8571428060531616px_-0.9285714030265808px_rgba(0,0,0,0.3)]",
                      "max-w-fit border",
                      isActive
                        ? "border-[#9067F7]"
                        : "border-prj-border-primary dark:border-[#26263D]",
                      "group relative transition-all",
                    )}
                  >
                    <div className="relative flex h-[14px] w-[14px] flex-shrink-0 items-center justify-center">
                      <Icon className="h-[14px] w-[14px] text-[#0F172A] dark:text-[#F5F9F7]" />
                    </div>
                    <span className="text-xs leading-[16.80px] font-normal text-[#09090B] dark:text-[#F5F9F7]">
                      {hat.name}
                    </span>
                    {activeTabs.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onTabClose(hatType);
                        }}
                        className={cn(
                          "relative flex h-[6px] w-[6px] flex-shrink-0 items-center justify-center overflow-hidden bg-transparent",
                          "opacity-0 transition-opacity group-hover:opacity-100",
                          isActive && "opacity-100",
                        )}
                      >
                        <X className="pointer-events-none h-[6px] w-[6px] text-[#111827] dark:text-[#F5F9F7]" />
                      </button>
                    )}
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-medium">{hat.name}</p>
                  <p className="text-prj-text-secondary text-xs">
                    {hat.description}
                  </p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </TabsList>

        {/* COMMENTED OUT: PinnedHatsDropdown - replaced with direct button */}
        {/* <Tooltip>
          <PinnedHatsDropdown
            open={isPinnedMenuOpen}
            onOpenChange={setIsPinnedMenuOpen}
            activeTabs={activeTabs}
            onOpenHat={handleOpenPinnedHat}
            onOpenHatSelector={() => {
              setIsPinnedMenuOpen(false);
              onOpenHatSelector?.();
            }}
            onTriggerClick={() => {
              setIsPinnedMenuOpen(false);
              onOpenHatSelector?.();
            }}
            trigger={
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="border-prj-border-button-outer bg-prj-gradient-button shadow-prj-button h-6 w-6 flex-shrink-0 rounded-md border-[1.5px] dark:border-[#26263D] dark:bg-none"
                >
                  <Plus className="h-4 w-4 dark:text-[#B8C9C3]" />
                </Button>
              </TooltipTrigger>
            }
          />
          <TooltipContent>
            <p>Add new advisor hat</p>
          </TooltipContent>
        </Tooltip> */}

        {/* Add new advisor button with tooltip */}
        <AddAdvisorButtonWithTooltip
          onClick={() => onOpenHatSelector?.()}
          className="border-prj-border-button-outer bg-prj-gradient-button shadow-prj-button h-6 w-6 flex-shrink-0 rounded-md border-[1.5px] dark:border-[#26263D] dark:bg-none"
        />
      </div>
    </>
  );
}
