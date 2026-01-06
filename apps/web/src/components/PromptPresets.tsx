"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { PROMPT_PRESETS, type PromptPreset } from "@/data/prompt-presets";
import { ChevronDown, RefreshCw } from "lucide-react";
import { ImportCodeIcon } from "@/components/icons/ImportCodeIcon";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PromptPresetsProps {
  onPresetSelect: (preset: PromptPreset) => void;
  onImportClick?: () => void;
  className?: string;
}

const PAGE_SIZE = 9; // number of suggestions to display at once

export function PromptPresets({
  onPresetSelect,
  onImportClick,
  className,
}: PromptPresetsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [startIndex, setStartIndex] = useState(0);

  const visiblePresets = useMemo(() => {
    if (PROMPT_PRESETS.length === 0) return [];
    const slice: PromptPreset[] = [];
    for (let i = 0; i < Math.min(PAGE_SIZE, PROMPT_PRESETS.length); i++) {
      const idx = (startIndex + i) % PROMPT_PRESETS.length;
      slice.push(PROMPT_PRESETS[idx]);
    }
    return slice;
  }, [startIndex]);

  const featuredPresets = visiblePresets.slice(0, 3);
  const morePresets = visiblePresets.slice(3);

  const renderPreset = (
    preset: PromptPreset,
    size: "sm" | "default" = "sm",
  ) => {
    const IconComponent = preset.icon;
    return (
      <Button
        key={preset.id}
        variant="outline"
        size={size}
        onClick={() => onPresetSelect(preset)}
        className="flex h-auto w-[155px] shrink-0 items-center justify-start gap-2 rounded-full bg-white border-[#F5F5F5] px-3 py-2 text-left text-[#5F5F5D] transition-colors hover:bg-[#F0FDF4] hover:border-[#1E9A80] hover:text-[#1E9A80] dark:bg-[#313C38] dark:border-[#232D29] dark:text-white dark:hover:bg-[#313C38]/80 dark:hover:text-white"
      >
        <IconComponent className="h-4 w-4 shrink-0" />
        <div className="flex min-w-0 flex-col items-start">
          <span className="w-full truncate text-sm font-medium whitespace-nowrap">
            {preset.label}
          </span>
        </div>
      </Button>
    );
  };

  const handleRefreshIdeas = () => {
    if (PROMPT_PRESETS.length <= PAGE_SIZE) {
      return;
    }
    setStartIndex((prev) => (prev + PAGE_SIZE) % PROMPT_PRESETS.length);
  };

  return (
    <div className={`space-y-3 ${className || ""}`}>
      <div className="w-full flex justify-center">
        <div className="inline-flex flex-col items-center gap-3 w-full md:w-auto p-2 -m-2">
          {/* Desktop: Top row with featured presets, More Ideas button, and refresh button */}
          {/* Mobile: Hidden - presets shown in grid below */}
          <motion.div
            key={`top-${startIndex}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="hidden items-center gap-1.5 md:flex"
          >
            {featuredPresets.map((preset) => renderPreset(preset))}

            {morePresets.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsExpanded((prev) => !prev)}
                aria-expanded={isExpanded}
                className="w-[124px] flex items-center gap-2 h-auto py-2 px-4 text-left justify-start bg-white border-[#F5F5F5] text-[#5F5F5D] hover:bg-[#F0FDF4] hover:border-[#1E9A80] hover:text-[#1E9A80] transition-colors rounded-full dark:bg-[#313C38] dark:border-[#232D29] dark:text-white dark:hover:bg-[#313C38]/80 dark:hover:text-white"
              >
                <ChevronDown
                  className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isExpanded ? "-rotate-180" : "rotate-0"
                    }`}
                />
                <span className="text-sm font-medium">More Ideas</span>
              </Button>
            )}

            {onImportClick && (
              <Button
                variant="outline"
                size="sm"
                onClick={onImportClick}
                className="flex h-auto items-center justify-start gap-2 rounded-full bg-white border-[#F5F5F5] px-4 py-2 text-left text-[#5F5F5D] transition-colors hover:bg-[#F0FDF4] hover:border-[#1E9A80] hover:text-[#1E9A80] dark:bg-[#313C38] dark:border-[#232D29] dark:text-white dark:hover:bg-[#313C38]/80 dark:hover:text-white"
              >
                <ImportCodeIcon className="h-4 w-4 shrink-0" />
                <span className="text-sm font-medium">Import Code</span>
              </Button>
            )}

            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleRefreshIdeas}
                    className="h-10 w-12 flex items-center justify-center rounded-full bg-white border border-[#F5F5F5] text-[#5F5F5D] hover:bg-[#F0FDF4] hover:border-[#1E9A80] hover:text-[#1E9A80] transition-all hover:-translate-y-px dark:bg-[#313C38] dark:border-[#232D29] dark:text-white dark:hover:bg-[#313C38]/80 dark:hover:text-white"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="center">
                  Refresh Ideas
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </motion.div>

          {/* Mobile: 2-column grid showing first 6 presets */}
          {/* Desktop: Hidden - featured presets shown in row above */}
          <motion.div
            key={`mobile-grid-${startIndex}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-full md:hidden"
          >
            <div className="grid grid-cols-2 justify-items-center gap-2">
              {visiblePresets.slice(0, 6).map((preset) => renderPreset(preset))}
            </div>
          </motion.div>

          {/* Desktop: Expanded section - 3-column grid for more presets */}
          {/* Mobile: Hidden - all presets shown in grid above */}
          <AnimatePresence initial={false}>
            {isExpanded && morePresets.length > 0 && (
              <motion.div
                key={`more-${startIndex}`}
                initial={{ opacity: 0, height: 0, y: 6 }}
                animate={{ opacity: 1, height: "auto", y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="hidden md:block"
              >
                <div className="grid grid-cols-3 gap-x-2 gap-y-3 justify-items-center p-2 -m-2">
                  {morePresets.map((preset) => (
                    <motion.div
                      key={preset.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                    >
                      {renderPreset(preset, "default")}
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mobile: Refresh button at bottom center */}
          {/* Desktop: Hidden - refresh button in top row */}
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleRefreshIdeas}
                  className="md:hidden h-10 w-10 flex items-center justify-center rounded-full bg-white border border-[#F5F5F5] text-[#5F5F5D] hover:bg-[#F0FDF4] hover:border-[#1E9A80] hover:text-[#1E9A80] transition-all shadow-sm dark:bg-[#313C38] dark:border-[#232D29] dark:text-white dark:hover:bg-[#313C38]/80 dark:hover:text-white"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="center">
                Refresh Ideas
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}
