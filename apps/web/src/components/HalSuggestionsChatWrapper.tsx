"use client";

import { useState, useCallback, useRef } from "react";
import { useAtom } from "jotai";
import { useMemo } from "react";
import {
  createAdvisorActiveTabsAtom,
  createAdvisorCurrentTabAtom,
} from "@/lib/hal-assistant-state";
import { type AdvisorHatType } from "@/lib/advisor-hats";
import { AdvisorTabBar } from "@/components/AdvisorTabBar";
import { AdvisorHatSelector } from "@/components/AdvisorHatSelector";
import { HalSuggestionsChat } from "@/components/HalSuggestionsChat";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { AdvisorLogo } from "@/components/AdvisorLogo";
import { CloseExpandIcon } from "@/components/icons/CloseExpandIcon";
import { cn } from "@/lib/utils";
import { AddAdvisorButtonWithTooltip } from "@/components/AddAdvisorButtonWithTooltip";

interface HalSuggestionsChatWrapperProps {
  projectId: string;
  projectFiles?: { [path: string]: string } | null;
  isSandboxReady?: boolean;
  onSuggestionClick?: (prompt: string) => void;
  onClose?: () => void;
  className?: string;
  triggerSuggestions?: boolean;
  onSuggestionsTriggered?: () => void;
  onSuggestionsGenerated?: () => void;
  shouldGenerateSuggestions?: boolean;
  isMiniMenu?: boolean;
  isNewProject?: boolean; // Whether this is a brand new project (no main chat messages)
}

export function HalSuggestionsChatWrapper({
  projectId,
  projectFiles,
  isSandboxReady = false,
  onSuggestionClick,
  onClose,
  className = "",
  triggerSuggestions = false,
  onSuggestionsTriggered,
  onSuggestionsGenerated,
  shouldGenerateSuggestions = false,
  isMiniMenu = false,
  isNewProject = false, // Default to false (existing project) for backwards compatibility
}: HalSuggestionsChatWrapperProps) {
  // Create project-specific atoms (memoized to avoid recreating on every render)
  const activeTabsAtom = useMemo(
    () => createAdvisorActiveTabsAtom(projectId),
    [projectId],
  );
  const currentTabAtom = useMemo(
    () => createAdvisorCurrentTabAtom(projectId),
    [projectId],
  );

  // Tab management state
  const [activeTabs, setActiveTabs] = useAtom(activeTabsAtom);
  const [currentTab, setCurrentTab] = useAtom(currentTabAtom);
  const [isHatSelectorOpen, setIsHatSelectorOpen] = useState(false);

  // Track if suggestions have been generated for each hat type (using ref to persist)
  const suggestionsGeneratedRef = useRef<Set<AdvisorHatType>>(new Set());

  // Track which hatType should trigger suggestions
  const [triggerForHatType, setTriggerForHatType] =
    useState<AdvisorHatType | null>(null);

  console.log("currentTab", currentTab);

  // Tab management handlers
  const handleTabChange = useCallback(
    (newTab: AdvisorHatType) => {
      setCurrentTab(newTab);

      // Generate suggestions automatically when clicking a non-generalist tab
      // that hasn't had suggestions generated yet
      if (
        newTab !== "generalist" &&
        !suggestionsGeneratedRef.current.has(newTab)
      ) {
        console.log(
          `[Advisor Wrapper] Marking ${newTab} for suggestion generation`,
        );
        suggestionsGeneratedRef.current.add(newTab);
        setTriggerForHatType(newTab);
      }
    },
    [setCurrentTab],
  );

  const handleTabClose = useCallback(
    (tabToClose: AdvisorHatType) => {
      const newTabs = activeTabs.filter((t) => t !== tabToClose);
      if (newTabs.length === 0) {
        // Always keep at least one tab (generalist)
        newTabs.push("generalist");
      }
      setActiveTabs(newTabs);
      // If we closed the current tab, switch to the first remaining tab
      if (tabToClose === currentTab) {
        setCurrentTab(newTabs[0]);
      }
    },
    [activeTabs, currentTab, setActiveTabs, setCurrentTab],
  );

  const handleAddTab = useCallback(
    (hatType: AdvisorHatType) => {
      if (!activeTabs.includes(hatType)) {
        setActiveTabs([...activeTabs, hatType]);
        setCurrentTab(hatType);

        // Generate suggestions automatically when adding a non-generalist tab
        if (
          hatType !== "generalist" &&
          !suggestionsGeneratedRef.current.has(hatType)
        ) {
          console.log(
            `[Advisor Wrapper] Marking new tab ${hatType} for suggestion generation`,
          );
          suggestionsGeneratedRef.current.add(hatType);
          setTriggerForHatType(hatType);
        }
      }
    },
    [activeTabs, setActiveTabs, setCurrentTab],
  );

  return (
    <Tabs
      value={currentTab}
      onValueChange={(value) => handleTabChange(value as AdvisorHatType)}
      className={cn(
        "flex h-full flex-col",
        !isMiniMenu && "mx-2 mt-0 mb-3 gap-0 md:mx-0",
        className,
      )}
    >
      {/* Header */}
      {!isMiniMenu && (
        <div className="dark:bg-prj-bg-primary flex h-[72px] items-center gap-3 bg-[#FCFCF9] p-[20px]">
          <div className="flex h-[20px] w-[20px] items-center justify-center">
            <AdvisorLogo />
          </div>
          <div className="flex-1">
            <h3 className="text-prj-text-primary text-sm font-medium">
              {"The Advisor"}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <AddAdvisorButtonWithTooltip
              onClick={() => setIsHatSelectorOpen(true)}
              className="border-prj-border-button-outer bg-prj-gradient-button shadow-prj-button h-6 w-6 flex-shrink-0 rounded-md border-[1.5px] dark:border-[#26263D] dark:bg-none"
            />
            {onClose && (
              <Button
                size="sm"
                onClick={onClose}
                variant="ghost"
                className="text-[] hover:bg-prj-tooltip-hover-bg hover:border-prj-tooltip-hover-border hidden h-[28px] w-[28px] bg-[#F3F3EE] p-0 text-[#28303F] transition-colors duration-200 hover:border md:flex dark:bg-[#1A2421] dark:text-[#B8C9C3]"
              >
                <CloseExpandIcon />
              </Button>
            )}
          </div>
        </div>
      )}
      {/* Render mini menu as a simple standalone component */}
      {isMiniMenu ? (
        <div className="border-prj-border-primary flex flex-1 flex-col overflow-hidden rounded-none">
          <HalSuggestionsChat
            projectId={projectId}
            projectFiles={projectFiles}
            isSandboxReady={isSandboxReady}
            onSuggestionClick={onSuggestionClick}
            onClose={onClose}
            className=""
            triggerSuggestions={triggerSuggestions}
            onSuggestionsTriggered={() => {
              onSuggestionsTriggered?.();
            }}
            onSuggestionsGenerated={onSuggestionsGenerated}
            shouldGenerateSuggestions={shouldGenerateSuggestions}
            isMiniMenu={true}
            hatType="generalist"
            showTabs={false}
            isActive={true}
            isNewProject={isNewProject}
          />
        </div>
      ) : (
        /* Full tabs system for normal advisor */
        <div className="border-prj-border-primary flex flex-1 flex-col overflow-hidden rounded-2xl border">
          {/* Tab Bar */}
          <AdvisorTabBar
            activeTabs={activeTabs}
            currentTab={currentTab}
            onTabChange={handleTabChange}
            onTabClose={handleTabClose}
            onAddTab={(hatType) => {
              if (hatType) {
                handleAddTab(hatType);
              } else {
                setIsHatSelectorOpen(true);
              }
            }}
            onOpenHatSelector={() => setIsHatSelectorOpen(true)}
          />

          {/* Hat Selector Modal */}
          <AdvisorHatSelector
            open={isHatSelectorOpen}
            onClose={() => setIsHatSelectorOpen(false)}
            onSelectHat={handleAddTab}
            currentTabs={activeTabs}
          />

          {/* Render a separate component instance for each active tab */}
          {activeTabs.map((hatType) => (
            <TabsContent
              key={hatType}
              value={hatType}
              forceMount
              className="flex h-full flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
            >
              <HalSuggestionsChat
                projectId={projectId}
                projectFiles={projectFiles}
                isSandboxReady={isSandboxReady}
                onSuggestionClick={onSuggestionClick}
                onClose={onClose}
                className="h-full"
                triggerSuggestions={triggerSuggestions}
                onSuggestionsTriggered={() => {
                  onSuggestionsTriggered?.();
                  setTriggerForHatType(null);
                }}
                onSuggestionsGenerated={onSuggestionsGenerated}
                shouldGenerateSuggestions={false}
                isMiniMenu={false}
                hatType={hatType}
                showTabs={true}
                isActive={hatType === currentTab}
                isNewProject={isNewProject}
              />
            </TabsContent>
          ))}
        </div>
      )}
    </Tabs>
  );
}
