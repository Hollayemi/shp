"use client";

import { TemplateCard } from "./TemplateCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { FileQuestion } from "lucide-react";

interface Template {
  id: string;
  name: string;
  shortDescription: string;
  logo: string;
  thumbnailUrl?: string | null;
  remixCount: number;
  likeCount: number;
  saveCount: number;
  authorName: string;
  category: {
    name: string;
    slug: string;
    icon: string | null;
  } | null;
  featured: boolean;
  userLiked?: boolean;
  userSaved?: boolean;
}

interface TemplateGridProps {
  templates: Template[];
  loading?: boolean;
  loadingMore?: boolean;
  error?: string | null;
  onLoadMore?: () => void;
  hasMore?: boolean;
  onTemplateClick?: (templateId: string) => void;
  variant?: "default" | "compact";
}

export function TemplateGrid({
  templates,
  loading = false,
  loadingMore = false,
  error = null,
  onLoadMore,
  hasMore = false,
  onTemplateClick,
  variant = "default",
}: TemplateGridProps) {
  // Loading state
  if (loading && templates.length === 0) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <TemplateCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <FileQuestion className="text-muted-foreground mb-4 h-12 w-12" />
        <h3 className="mb-2 text-lg font-semibold">Failed to Load Templates</h3>
        <p className="text-muted-foreground text-sm">{error}</p>
      </div>
    );
  }

  // Empty state
  if (templates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <FileQuestion className="text-muted-foreground mb-4 h-12 w-12" />
        <h3 className="mb-2 text-lg font-semibold">No Templates Found</h3>
        <p className="text-muted-foreground text-sm">
          No templates match your criteria. Try adjusting your filters.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Template Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {templates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            variant={variant}
            onClick={() => onTemplateClick?.(template.id)}
          />
        ))}
      </div>

      {/* Load More Button */}
      {hasMore && onLoadMore && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore ? "Loading..." : "Load More Templates"}
          </Button>
        </div>
      )}
    </div>
  );
}

// Loading skeleton for template cards
function TemplateCardSkeleton() {
  return (
    <div className="bg-card overflow-hidden rounded-xl border shadow-sm">
      <Skeleton className="h-40 w-full" />
      <div className="space-y-3 p-4">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-10 w-full" />
        <div className="flex gap-4">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-12" />
        </div>
      </div>
    </div>
  );
}
