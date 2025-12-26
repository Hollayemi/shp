"use client";

import { cn } from "@/lib/utils";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { BuildModeTooltip } from "./BuildModeTooltip";
import { BuildModeIcon } from "./icons/BuildModeIcon";
// import { DeepBuildModeIcon } from "./icons/DeepBuildModeIcon";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

interface BuildModeToggleWithTooltipProps {
    isDeepMode: boolean;
    onToggle: (isDeepMode: boolean) => void;
    disabled?: boolean;
}

export function BuildModeToggleWithTooltip({
    isDeepMode,
    onToggle,
    disabled = false,
}: BuildModeToggleWithTooltipProps) {
    return (
        <TooltipProvider>
            <div className={cn(
                "inline-flex items-center gap-1 p-1 bg-[#EAF1F1] dark:bg-[#313C38] rounded-full border border-transparent",
                disabled && "opacity-50 cursor-not-allowed"
            )}>
                {/* Build Mode Button with Tooltip */}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            type="button"
                            onClick={() => !disabled && onToggle(false)}
                            disabled={disabled}
                            className={cn(
                                "w-[28px] h-[28px] rounded-full flex items-center justify-center transition-all bg-white dark:bg-[#111816]",
                                !isDeepMode
                                    ? "border-[0.5px] border-[#1E9A80]"
                                    : "bg-white/10 border-0",
                                disabled && "cursor-not-allowed"
                            )}
                        >
                            <BuildModeIcon isActive={true} />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent
                        side="bottom"
                        align="start"
                        className="p-0 bg-transparent border-0 shadow-none"
                        hideArrow
                        alignOffset={-5}
                    >
                        <BuildModeTooltip mode="build" />
                        <TooltipPrimitive.Arrow className="TooltipArrow" />
                    </TooltipContent>
                </Tooltip>

                {/* Deep Build Mode Button with Tooltip */}
                {/* <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            type="button"
                            onClick={() => !disabled && onToggle(true)}
                            disabled={disabled}
                            className={cn(
                                "w-[28px] h-[28px] rounded-full flex items-center justify-center transition-all",
                                isDeepMode 
                                    ? "bg-white border-[0.5px] border-[#1E9A80]" 
                                    : "bg-white/10 border-0",
                                disabled && "cursor-not-allowed"
                            )}
                        >
                            <DeepBuildModeIcon isActive={isDeepMode} />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent
                        side="bottom"
                        align="start"
                        className="p-0 bg-transparent border-0 shadow-none"
                        hideArrow
                        alignOffset={-5}
                    >
                        <BuildModeTooltip mode="deep" />
                        <TooltipPrimitive.Arrow className="TooltipArrow" />
                    </TooltipContent>
                </Tooltip> */}
            </div>
        </TooltipProvider>
    );
}
