"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Plus } from "lucide-react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

interface AddAdvisorButtonWithTooltipProps {
  onClick: () => void;
  className?: string;
}

export function AddAdvisorButtonWithTooltip({
  onClick,
  className,
}: AddAdvisorButtonWithTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClick}
            className={className}
          >
            <Plus className="h-4 w-4 dark:text-[#B8C9C3]" />
          </Button>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="end"
          className="p-0 bg-transparent border-0 shadow-none"
          hideArrow
          alignOffset={-10}
        >
          <div className="flex w-[310px] flex-col items-start bg-[#0A0E0D] p-3 rounded-xl shadow-[0px_1px_13.8px_1px_rgba(18,18,18,0.10)] max-w-[274px]">
            <div className="flex flex-col items-start justify-center gap-0.5">
              <div className="text-sm font-semibold leading-5 text-[#F5F9F7]">
                Add another Advisor
              </div>
              <div className="self-stretch text-xs font-normal leading-[18px] text-[#B8C9C3] text-left">
                Open multiple conversations, each with a different Advisor. Get specialized, focused help for: design, code, product, etc.
              </div>
            </div>
          </div>
          <TooltipPrimitive.Arrow className="fill-[#0A0E0D]" />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
