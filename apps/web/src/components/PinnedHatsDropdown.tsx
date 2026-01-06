// COMMENTED OUT - Pinned Hats Feature Temporarily Disabled
/*
"use client";

import { useAtom } from "jotai";
import { advisorPinnedHatsAtom } from "@/lib/hal-assistant-state";
import { ADVISOR_HATS, type AdvisorHatType } from "@/lib/advisor-hats";
import { PinnedIcon } from "@/components/icons/PinIcon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ReactNode } from "react";
import { Plus } from "lucide-react";

interface PinnedHatsDropdownProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeTabs: AdvisorHatType[];
  onOpenHat: (hatType: AdvisorHatType) => void;
  onOpenHatSelector: () => void;
  trigger: ReactNode;
  onTriggerClick?: () => void;
}

export function PinnedHatsDropdown({
  open,
  onOpenChange,
  activeTabs,
  onOpenHat,
  onOpenHatSelector,
  trigger,
  onTriggerClick,
}: PinnedHatsDropdownProps) {
  const [pinnedHats, setPinnedHats] = useAtom(advisorPinnedHatsAtom);

  console.log("[PinnedHatsDropdown] Render:", {
    open,
    pinnedHatsCount: pinnedHats.length,
    pinnedHats,
  });

  const handleTogglePin = (hatType: AdvisorHatType, e: React.MouseEvent) => {
    e.stopPropagation();
    if (pinnedHats.includes(hatType)) {
      setPinnedHats(pinnedHats.filter((h) => h !== hatType));
    } else {
      setPinnedHats([...pinnedHats, hatType]);
    }
  };

  const handleOpenPinnedHat = (hatType: AdvisorHatType) => {
    onOpenChange(false);
    onOpenHat(hatType);
  };

  const handleAddHatFromMenu = () => {
    onOpenChange(false);
    onOpenHatSelector();
  };

  const handleOpenChange = (newOpen: boolean) => {
    console.log("[PinnedHatsDropdown] handleOpenChange:", {
      newOpen,
      pinnedHatsLength: pinnedHats.length,
      willOpenSelector: newOpen && pinnedHats.length === 0,
    });

    // If trying to open but there are no pinned hats, open the selector instead
    if (newOpen && pinnedHats.length === 0) {
      onTriggerClick?.();
      return;
    }
    // Otherwise, let the dropdown open/close normally
    onOpenChange(newOpen);
  };

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      {pinnedHats.length > 0 && (
        <DropdownMenuContent
          side="bottom"
          align="end"
          className="flex w-[307px] flex-col gap-1 rounded-[16px] bg-[#FCFCF9] pt-1 pb-1.5 [box-shadow:0_1px_13.8px_1px_#1212121A] dark:bg-[#1A2421]"
        >
          {/* Pinned Hats Header *\/}
          <div className="px-1 py-0">
            <div className="overflow-hidden rounded-lg px-2 py-1.5 opacity-60">
              <div className="flex flex-col items-start justify-center gap-0.5">
                <div className="text-xs leading-[18px] font-normal tracking-[0.72px] text-[#79747E] uppercase dark:text-[#B8C9C3]">
                  Pinned Hats
                </div>
              </div>
            </div>
          </div>
          <DropdownMenuSeparator className="bg-prj-border-primary mx-1 my-0" />

          {/* Pinned Hats List *\/}
          <div className="px-1 py-0">
            <div className="flex flex-col">
              <div className="flex flex-col items-start justify-center gap-1 overflow-hidden rounded-xl">
                {pinnedHats.map((hatType) => {
                  const hat = ADVISOR_HATS[hatType];
                  const Icon = hat.icon;

                  return (
                    <DropdownMenuItem
                      key={hatType}
                      onClick={() => handleOpenPinnedHat(hatType)}
                      className="cursor-pointer rounded-xl px-2 py-2 hover:bg-transparent w-full"
                    >
                      <div className="flex w-full items-center gap-2">
                        <div className="flex items-center justify-center overflow-hidden rounded-md bg-prj-bg-secondary p-1.5">
                          <Icon className="h-4 w-4 text-[#0F172A] dark:text-[#F5F9F7]" />
                        </div>
                        <div className="flex-1 text-sm leading-5 font-normal text-[#09090B] dark:text-[#F5F9F7]">
                          {hat.name}
                        </div>
                        <button
                          onClick={(e) => handleTogglePin(hatType, e)}
                          className="flex items-center justify-center overflow-hidden rounded-md p-1.5"
                        >
                          <PinnedIcon className="h-4 w-4 text-[#0F172A] dark:text-[#F5F9F7]" />
                        </button>
                      </div>
                    </DropdownMenuItem>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Add Hat Button *\/}
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-2 bg-white px-1 py-0 dark:bg-[#1A2421]">
              <DropdownMenuItem
                onClick={handleAddHatFromMenu}
                className="flex cursor-pointer flex-col items-start justify-center gap-2 overflow-hidden rounded-lg border border-dashed border-[#E8E5DF] bg-prj-bg-secondary p-2 hover:bg-[#F3F3EE]"
              >
                <div className="flex w-full items-center justify-between">
                  <div className="flex flex-1 items-center gap-2">
                    <div className="relative h-4 w-4 overflow-hidden">
                      <Plus className="h-4 w-4 text-[#0F172A] dark:text-[#F5F9F7]" />
                    </div>
                    <div className="flex-1 text-sm leading-5 font-normal text-[#09090B] dark:text-[#F5F9F7]">
                      Add Hat
                    </div>
                  </div>
                </div>
              </DropdownMenuItem>
            </div>
          </div>
        </DropdownMenuContent>
      )}
    </DropdownMenu>
  );
}
*/

// TEMPORARY: Simplified version that just triggers the hat selector
"use client";

import type { ReactNode } from "react";
import type { AdvisorHatType } from "@/lib/advisor-hats";

interface PinnedHatsDropdownProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeTabs: AdvisorHatType[];
  onOpenHat: (hatType: AdvisorHatType) => void;
  onOpenHatSelector: () => void;
  trigger: ReactNode;
  onTriggerClick?: () => void;
}

export function PinnedHatsDropdown({
  trigger,
  onTriggerClick,
}: PinnedHatsDropdownProps) {
  return (
    <div onClick={onTriggerClick}>
      {trigger}
    </div>
  );
}
