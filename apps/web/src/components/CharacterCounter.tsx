"use client";

import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Image from "next/image";
import { usePathname } from "next/navigation";

interface CharacterCounterProps {
  charCount: number;
  limit: number;
  warningThreshold: number;
  className?: string;
  variant?: "warning" | "error";
}

export function CharacterCounter({
  charCount,
  limit,
  warningThreshold,
  className,
  variant,
}: CharacterCounterProps) {
  const pathname = usePathname();
  const isEmbed = pathname?.includes("/embed");
  
  const isApproachingLimit = charCount >= warningThreshold;
  const isOverLimit = charCount > limit;
  const charsRemaining = limit - charCount;

  // Determine variant automatically if not provided
  const effectiveVariant = variant ?? (isOverLimit ? "error" : "warning");

  // Only show when approaching the warning threshold
  if (charCount < warningThreshold) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex items-center gap-1.5 px-[13px] py-[9px] rounded-full transition-all cursor-help",
              {
                "bg-[#FDE9E9]":
                  effectiveVariant === "error",
                "bg-[#FEF7EE]":
                  effectiveVariant === "warning",
              },
              className
            )}
          >
            <div
              className={cn(
                "flex items-center justify-center w-5 h-5 rounded-full"
              )}
            >
              <Info className={cn(
                "w-4 h-4",
                {
                  "text-[#A32E2E] ": effectiveVariant === "error",
                  "text-[#A35C00] ": effectiveVariant === "warning",
                }
              )} />
            </div>
            <span
              className={cn(
                "text-xs font-medium tabular-nums",
                {
                  "text-[#A32E2E]": effectiveVariant === "error",
                  "text-[#A35C00]": effectiveVariant === "warning",
                }
              )}
            >
              {charCount}/{limit}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="start"
          alignOffset={isEmbed ? 0 : -200}
          sideOffset={8}
          hideArrow
          className={cn(
            "max-w-[340px] p-0 border-[0.5px] border-[#E9E9E9] rounded-xl drop-shadow-lg text-left",
            {
              "bg-linear-to-b from-[#FCF2F2] to-white drop-shadow-[#E2645E1A]": effectiveVariant === "error",
              "bg-linear-to-b from-[#FEF7EE] to-white drop-shadow-[#A35C001A]": effectiveVariant === "warning",
            }
          )}
        >
          <div className="flex items-start gap-3 p-3">
            {
              isOverLimit ? <Image src="/icon-error.svg" alt="Error" width={30} height={30} />
                : <Image src="/warning-icon.svg" alt="Warning" width={30} height={30} />
            }

            <div className="flex-1">
              <p
                className={cn(
                  "text-sm font-semibold",
                  {
                    "text-[#A32E2E]": effectiveVariant === "error",
                    "text-[#A35C00]": effectiveVariant === "warning",
                  }
                )}
              >
                Tip
              </p>
              <div className="text-sm text-gray-900 tracking-none text-nowrap">
                {effectiveVariant === "error" ? (
                  <>
                    Character limit reached.{" "}
                    <span className="font-semibold">Please shorten <br /> your prompt</span> or
                    split it into multiple <br /> messages for better results.
                  </>
                ) : (
                  <>
                    Long prompts can reduce output quality. <br /> For best results,{" "}
                    <span className="font-semibold">
                      break your request into <br /> smaller, focused messages
                    </span>{" "}<br />
                    sent one after another.
                  </>
                )}
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Export constants for consistency
export const CHARACTER_LIMIT = 2000;
export const WARNING_THRESHOLD = 1800; // Show warning at 90% of limit

// Helper hook for character counting
export function useCharacterLimit(text: string) {
  const charCount = text?.length || 0;
  const isApproachingLimit = charCount >= WARNING_THRESHOLD;
  const isOverLimit = charCount > CHARACTER_LIMIT;
  const charsRemaining = CHARACTER_LIMIT - charCount;

  return {
    charCount,
    isApproachingLimit,
    isOverLimit,
    charsRemaining,
    limit: CHARACTER_LIMIT,
    warningThreshold: WARNING_THRESHOLD,
  };
}

