"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TemplateSortBy } from "../types";

interface TemplateFiltersProps {
  sortBy: TemplateSortBy;
  onSortChange: (sort: TemplateSortBy) => void;
  selectedTags?: string[];
  onTagRemove?: (tag: string) => void;
  className?: string;
}

export function TemplateFilters({
  sortBy,
  onSortChange,
  selectedTags = [],
  onTagRemove,
  className,
}: TemplateFiltersProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-4", className)}>
      {/* Sort Dropdown */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Sort by:</span>
        <Select value={sortBy} onValueChange={(value) => onSortChange(value as TemplateSortBy)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="popular">Most Popular</SelectItem>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="trending">Trending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Selected Tags */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Filters:</span>
          {selectedTags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="gap-1 pr-1"
            >
              {tag}
              {onTagRemove && (
                <button
                  onClick={() => onTagRemove(tag)}
                  className="rounded-full p-0.5 hover:bg-background"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

