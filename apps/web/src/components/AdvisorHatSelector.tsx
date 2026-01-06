"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { AdvisorHatType } from "@/lib/advisor-hats";
import { getAllHats } from "@/lib/advisor-hats";
import { cn } from "@/lib/utils";
import { ArrowLeft, ChevronLeft, Plus, X } from "lucide-react";
import { useAtom } from "jotai";
import { advisorPinnedHatsAtom } from "@/lib/hal-assistant-state";
import { PinIcon, PinnedIcon } from "@/components/icons/PinIcon";

interface AdvisorHatSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelectHat: (hatType: AdvisorHatType) => void;
  currentTabs: AdvisorHatType[];
}

export function AdvisorHatSelector({
  open,
  onClose,
  onSelectHat,
  currentTabs,
}: AdvisorHatSelectorProps) {
  const allHats = getAllHats();
  const [pinnedHats, setPinnedHats] = useAtom(advisorPinnedHatsAtom);

  const togglePin = (hatType: AdvisorHatType, e: React.MouseEvent) => {
    e.stopPropagation();
    if (pinnedHats.includes(hatType)) {
      setPinnedHats(pinnedHats.filter((h) => h !== hatType));
    } else {
      setPinnedHats([...pinnedHats, hatType]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="rounded-prj-dialog md:rounded-prj-dialog rounded-t-prj-dialog data-[state=closed]:slide-out-to-right md:data-[state=closed]:slide-out-to-right data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-right md:data-[state=open]:slide-in-from-right data-[state=open]:slide-in-from-bottom shadow-prj-dialog top-4 right-0 left-0 h-[calc(100vh-5rem)] !max-w-full translate-x-0 translate-y-0 overflow-y-scroll rounded-b-none p-0 md:right-4 md:left-auto md:h-[calc(100vh-2rem)] md:!max-w-[440px]"
        showCloseButton={false}
      >
        <div className="flex h-full flex-col bg-white dark:bg-[#1A2421]">
          {/* Header */}
          <div className="border-prj-border-secondary flex items-center justify-between border-b p-4 dark:border-[#26263D] dark:bg-[#1A2421]">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="border-prj-border-button-outer bg-prj-gradient-button shadow-prj-button h-6 w-6 rounded-md border border-[1.5px] dark:border-[#26263D] dark:bg-none"
                onClick={onClose}
              >
                <ChevronLeft className="h-4 w-4 dark:text-[#B8C9C3]" />
              </Button>
              <h2 className="text-prj-text-heading text-[16px] font-semibold dark:text-[#F5F9F7]">
                All Available Hats
              </h2>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="border-prj-border-button-outer bg-prj-gradient-button shadow-prj-button h-6 w-6 rounded-md border border-[1.5px] dark:border-[#26263D] dark:bg-none"
              onClick={onClose}
            >
              <X className="pointer-events-none h-4 w-4 shrink-0" />
              <span className="sr-only">Close</span>
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex flex-col gap-[12px]">
              {allHats.map((hat) => {
                const Icon = hat.icon;
                const isAlreadyOpen = currentTabs.includes(hat.id);
                const isPinned = pinnedHats.includes(hat.id);

                return (
                  <div
                    key={hat.id}
                    className="flex items-center gap-4 rounded-[12px] border border-[#E7E9E9] bg-[#F3F3EE] p-[4px] shadow-[0px_1px_3px_rgba(0,0,0,0.05),0_0_0_2px_#FFF_inset] dark:bg-[#1A2421] dark:shadow-[0px_1px_3px_rgba(0,0,0,0.05),0_0_0_2px_#1A2421_inset]"
                  >
                    <div className="flex w-full items-center gap-4 rounded-lg border border-[#E7E9E9] bg-white p-2 shadow-[0px_1px_3px_rgba(0,0,0,0.05)] dark:bg-[#1A2421]">
                      <button
                        onClick={() => {
                          if (!isAlreadyOpen) {
                            onSelectHat(hat.id);
                            onClose();
                          }
                        }}
                        disabled={isAlreadyOpen}
                        className={cn(
                          "flex flex-1 items-center gap-2 text-left",
                          !isAlreadyOpen && "cursor-pointer",
                        )}
                      >
                        {/* Icon Container */}
                        <div className="bg-prj-bg-secondary flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-[6.86px] p-[6.86px]">
                          <Icon className="h-[18px] w-[18px] text-[#0F172A] dark:text-[#F5F9F7]" />
                        </div>

                        {/* Text Content */}
                        <div className="flex min-w-[174px] flex-1 flex-col">
                          <div className="text-sm leading-[21px] font-medium text-[#14201F] dark:text-[#F5F9F7]">
                            {hat.name}
                          </div>
                          <div className="text-sm leading-[21px] font-normal text-[#666E6D] dark:text-[#B8C9C3]">
                            {hat.description}
                          </div>
                        </div>
                      </button>

                      {/* Pin Button */}
                      {/* <button
                        onClick={(e) => togglePin(hat.id, e)}
                        className="flex flex-shrink-0 items-center justify-center overflow-hidden rounded-md p-1.5"
                      >
                        {isPinned ? (
                          <PinnedIcon className="h-4 w-4 text-[#0F172A] dark:text-[#F5F9F7]" />
                        ) : (
                          <PinIcon className="h-4 w-4 text-[#0F172A] dark:text-[#F5F9F7]" />
                        )}
                      </button> */}
                    </div>
                  </div>
                );
              })}

              {/* Request New Advisor Section */}
              <div className="relative flex flex-col gap-0">
                <a
                  href="https://tally.so/r/mOpxRR"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 rounded-[12px] border border-dashed border-[#E7E9E9] p-[2px] shadow-[0px_1px_3px_rgba(0,0,0,0.05),0_0_0_2px_#FFF_inset] dark:bg-[#1A2421] dark:shadow-[0px_1px_3px_rgba(0,0,0,0.05),0_0_0_2px_#1A2421_inset]"
                >
                  <div className="flex w-full items-center gap-4 rounded-[8px] bg-[#F3F3EE] p-2 shadow-[0px_1px_3px_rgba(0,0,0,0.05)] dark:bg-[#1A2421]">
                    <div className="dark:bg-prj-bg-secondary flex flex-shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#ffffff] p-1.5">
                      <Plus className="h-4 w-4 text-[#0F172A] dark:text-[#F5F9F7]" />
                    </div>
                    <div className="flex flex-1 items-center gap-2">
                      {/* Icon Container */}

                      {/* Text Content */}
                      <div className="flex min-w-[174px] flex-1 flex-col">
                        <div className="text-sm leading-[21px] font-medium text-[#14201F] dark:text-[#F5F9F7]">
                          Request New Advisor
                        </div>
                        <div className="text-sm leading-[21px] font-normal text-[#585B5A] dark:text-[#B8C9C3]">
                          Help us build the advisor you&apos;re missing
                        </div>
                      </div>
                    </div>
                  </div>
                </a>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
