"use client";

import {
  useRef,
  useState,
  useEffect,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DiscussIcon } from "@/components/icons/DiscussIcon";

interface Suggestion {
  id: string;
  title: string;
  shortTitle?: string; // Short version for compact display (2-4 words)
  prompt: string;
}

interface AdvisorSuggestionsStripProps {
  suggestions: Suggestion[];
  onSuggestionClick: (prompt: string) => void;
  onExploreMore: () => void;
  onClose: () => void;
  isVisible: boolean;
  className?: string;
}

export function AdvisorSuggestionsStrip({
  suggestions,
  onSuggestionClick,
  onExploreMore,
  onClose,
  isVisible,
  className,
}: AdvisorSuggestionsStripProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  
  // Handle scroll to track if user has scrolled
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollLeft } = scrollContainerRef.current;
    setIsScrolled(scrollLeft > 0);
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      handleScroll(); // Check initial state
      container.addEventListener("scroll", handleScroll);
      return () => container.removeEventListener("scroll", handleScroll);
    }
  }, [suggestions]);

  // Convert vertical scroll to horizontal scroll when hovering over the entire section
  const handleWheelHorizontalScroll = (e: ReactWheelEvent<HTMLDivElement>) => {
    // Only intercept primarily vertical scroll gestures
    const isVerticalScroll = Math.abs(e.deltaY) > Math.abs(e.deltaX);
    const scrollContainer = scrollContainerRef.current;

    if (!isVerticalScroll || !scrollContainer) return;

    const canScrollHorizontally =
      scrollContainer.scrollWidth > scrollContainer.clientWidth;

    if (!canScrollHorizontally) return;

    e.preventDefault();
    scrollContainer.scrollLeft += e.deltaY;
  };

  if (!isVisible) return null;

  return (
    <div
      ref={sectionRef}
      onWheel={handleWheelHorizontalScroll}
      className={cn(
        "group absolute -top-20 right-0 left-0 z-0 rounded-t-2xl",
        "bg-gradient-to-b from-[#C3F3E9] to-[#ffffff] dark:from-[#0D3D35] dark:to-[#1A2421]",
        "pt-3 pb-8",
        "flex flex-col gap-3",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-[18px] w-[18px] text-[#1E9A80] dark:text-[#34D399]" />
          <span className="text-sm font-medium text-[#1C1C1C] dark:text-white">
            Advisor Suggestions
          </span>
        </div>
        <Button
          onClick={onClose}
          variant="ghost"
          size="icon"
          className="h-[18px] w-[18px] rounded bg-gradient-to-b from-white to-[#F6F7F7] p-0 shadow-[0px_0px_0px_0.75px_#DCDEDD] hover:bg-[#F6F7F7] dark:from-[#2A2A2A] dark:to-[#1F1F1F] dark:shadow-[0px_0px_0px_0.75px_#404040] dark:hover:bg-[#333333]"
          aria-label="Close suggestions"
        >
          <X className="h-3 w-3 text-[#365314] dark:text-[#86EFAC]" />
        </Button>
      </div>

      {/* Scrollable suggestions container */}
      <div className="relative">
        {/* Scrollable row with custom scrollbar via Tailwind */}
        <div
          ref={scrollContainerRef}
          className={cn(
            "flex gap-2 overflow-x-auto pr-3 pb-1",
            // Add left padding only when not scrolled
            !isScrolled && "pl-3",
            // Custom scrollbar styling - show on group hover (entire section)
            "[&::-webkit-scrollbar]:h-1",
            "[&::-webkit-scrollbar-track]:bg-transparent",
            "[&::-webkit-scrollbar-thumb]:rounded-full",
            "[&::-webkit-scrollbar-thumb]:bg-transparent",
            "group-hover:[&::-webkit-scrollbar-thumb]:bg-[#1E9A80]/20",
            "dark:group-hover:[&::-webkit-scrollbar-thumb]:bg-[#34D399]/30",
          )}
        >
          {/* Suggestion pills */}
          {suggestions.map((suggestion) => (
            <Button
              key={suggestion.id}
              onClick={() => onSuggestionClick(suggestion.prompt)}
              variant="outline"
              size="sm"
              className="h-auto flex-shrink-0 rounded-md border-[#F3F3EE] bg-white px-2.5 py-0.5 text-sm font-normal text-[#404040] hover:border-[#1E9A80]/30 dark:border-[#404040] dark:bg-[#2A2A2A] dark:text-[#E5E5E5] dark:hover:border-[#34D399]/40"
            >
              {suggestion.shortTitle || suggestion.title}
            </Button>
          ))}

          {/* Explore more button */}
          <Button
            onClick={onExploreMore}
            size="sm"
            className="h-auto flex-shrink-0 rounded-md bg-gradient-to-r from-[#8E68F7] to-[#487DF6] px-2.5 py-0.5 text-sm font-normal text-white hover:opacity-90"
          >
            Explore more with Advisor
          </Button>
        </div>
      </div>
    </div>
  );
}

// Discuss button component for the chat toolbar
export function DiscussButton({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <Button
      onClick={onClick}
      type="button"
      variant="outline"
      size="sm"
      className={cn(
        "h-[32px] rounded-full border-[#F8F8F5] bg-white px-[13px] py-[9px] shadow-[0px_1px_2px_rgba(18,26,43,0.05)] hover:border-[#1E9A80]/30 hover:bg-[#1E9A80]/5",
        "dark:border-[#404040] dark:bg-[#2A2A2A] dark:shadow-[0px_1px_2px_rgba(0,0,0,0.3)] dark:hover:border-[#34D399]/40 dark:hover:bg-[#34D399]/10",
        className,
      )}
    >
      <DiscussIcon className="h-4 w-4 text-[#6c6b6b] dark:text-[#A3A3A3]" />
      <span className="text-sm font-normal text-[#6c6b6b] dark:text-[#A3A3A3]">
        Discuss
      </span>
    </Button>
  );
}
