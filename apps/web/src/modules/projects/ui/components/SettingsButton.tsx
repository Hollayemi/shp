"use client";

import { useAtom } from "jotai";
import { Button } from "@/components/ui/button";
import { SettingsIcon } from "@/components/icons/SettingsIcon";
import { SettingsModal } from "./SettingsModal";
import { isSettingsOpenAtom } from "@/lib/atoms/settings";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function SettingsButton() {
  const [isOpen, setIsOpen] = useAtom(isSettingsOpenAtom);

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(true)}
              className="rounded-prj-button h-[28px] w-[28px] bg-prj-bg-secondary p-0 hover:text-foreground hover:bg-prj-tooltip-hover-bg hover:border hover:border-prj-tooltip-hover-border transition-colors duration-200"
            >
              <SettingsIcon className="h-4 w-4 text-[#111827] dark:text-[#B8C9C3]" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Settings</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <SettingsModal open={isOpen} onOpenChange={setIsOpen} />
    </>
  );
}
