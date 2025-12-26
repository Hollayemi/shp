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
import { ReactNode } from "react";

type TooltipVariant = "info" | "warning" | "error" | "success";

interface InfoTooltipProps {
  /**
   * Content to display in the tooltip
   */
  content: ReactNode;
  /**
   * Visual variant of the tooltip
   */
  variant?: TooltipVariant;
  /**
   * Icon to display (defaults to Info icon)
   */
  icon?: ReactNode;
  /**
   * Image source for custom icon (overrides icon prop)
   */
  imageSrc?: string;
  /**
   * Image alt text
   */
  imageAlt?: string;
  /**
   * Tooltip title
   */
  title?: string;
  /**
   * Tooltip side position
   */
  side?: "top" | "right" | "bottom" | "left";
  /**
   * Tooltip alignment
   */
  align?: "start" | "center" | "end";
  /**
   * Alignment offset
   */
  alignOffset?: number;
  /**
   * Side offset
   */
  sideOffset?: number;
  /**
   * Max width of tooltip content
   */
  maxWidth?: string;
  /**
   * Custom trigger element (if not provided, uses default icon button)
   */
  trigger?: ReactNode;
  /**
   * Additional className for trigger button
   */
  triggerClassName?: string;
  /**
   * Additional className for tooltip content
   */
  contentClassName?: string;
  /**
   * Hide arrow
   */
  hideArrow?: boolean;
}

const variantStyles = {
  info: {
    trigger: "bg-blue-50 hover:bg-blue-100",
    icon: "text-blue-600",
    content: "bg-gradient-to-b from-blue-50 to-white",
    border: "border-blue-200",
    title: "text-blue-900",
  },
  warning: {
    trigger: "bg-[#FEF7EE] hover:bg-[#FEF0E0]",
    icon: "text-[#A35C00]",
    content: "bg-gradient-to-b from-[#FEF7EE] to-white",
    border: "border-[#E9E9E9]",
    title: "text-[#A35C00]",
  },
  error: {
    trigger: "bg-[#FDE9E9] hover:bg-[#FCD5D5]",
    icon: "text-[#A32E2E]",
    content: "bg-gradient-to-b from-[#FCF2F2] to-white",
    border: "border-[#E9E9E9]",
    title: "text-[#A32E2E]",
  },
  success: {
    trigger: "bg-green-50 hover:bg-green-100",
    icon: "text-green-600",
    content: "bg-gradient-to-b from-green-50 to-white",
    border: "border-green-200",
    title: "text-green-900",
  },
};

export function InfoTooltip({
  content,
  variant = "info",
  icon,
  imageSrc,
  imageAlt = "Info",
  title = "Tip",
  side = "bottom",
  align = "start",
  alignOffset = 0,
  sideOffset = 8,
  maxWidth = "340px",
  trigger,
  triggerClassName,
  contentClassName,
  hideArrow = true,
}: InfoTooltipProps) {
  const styles = variantStyles[variant];

  const defaultTrigger = (
    <button
      type="button"
      className={cn(
        "flex items-center justify-center w-5 h-5 rounded-full transition-colors cursor-help",
        styles.trigger,
        triggerClassName
      )}
    >
      {icon || <Info className={cn("w-4 h-4", styles.icon)} />}
    </button>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {trigger || defaultTrigger}
        </TooltipTrigger>
        <TooltipContent
          side={side}
          align={align}
          alignOffset={alignOffset}
          sideOffset={sideOffset}
          hideArrow={hideArrow}
          className={cn(
            "p-0 border-[0.5px] rounded-xl drop-shadow-lg",
            styles.content,
            styles.border,
            contentClassName
          )}
          style={{ maxWidth }}
        >
          <div className="flex items-start gap-3 p-3">
            {imageSrc && (
              <Image
                src={imageSrc}
                alt={imageAlt}
                width={30}
                height={30}
                className="flex-shrink-0"
              />
            )}

            <div className="flex-1 text-left">
              {title && (
                <p className={cn("text-sm font-semibold mb-1", styles.title)}>
                  {title}
                </p>
              )}
              <div className="text-gray-900 leading-relaxed">
                {content}
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
