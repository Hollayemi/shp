"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import {
  TemplateCategoryTabs,
  TemplateSearchBar,
  TemplateFilters,
  TemplateGrid,
  TemplateDetailDialog,
} from "@/modules/templates/components";
import type { TemplateSortBy } from "@/modules/templates/types";
import { Sparkles, ArrowLeft } from "lucide-react";

export default function TemplatesClient() {
  const trpc = useTRPC();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<TemplateSortBy>("popular");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null,
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [allTemplates, setAllTemplates] = useState<any[]>([]);
  const limit = 12;

  // Determine which query to use based on search
  const shouldSearch = searchQuery.trim().length > 0;

  // Calculate offset from page
  const offset = (page - 1) * limit;

  // Search query
  const searchResults = useQuery({
    ...trpc.templates.search.queryOptions({
      query: searchQuery,
      limit,
      offset,
      filters: {
        categories: selectedCategory ? [selectedCategory] : undefined,
      },
    }),
    enabled: shouldSearch,
  });

  // Browse query
  const browseResults = useQuery({
    ...trpc.templates.getByCategory.queryOptions({
      categorySlug: selectedCategory || undefined,
      sortBy,
      limit,
      offset,
    }),
    enabled: !shouldSearch,
  });

  const activeQuery = shouldSearch ? searchResults : browseResults;
  const hasMore = activeQuery.data?.pagination?.hasMore || false;
  const isLoading = activeQuery.isLoading;
  const totalCount = activeQuery.data?.pagination?.total || 0;
  const dataUpdatedAt = activeQuery.dataUpdatedAt; // Track when data was last updated

  // Reset when filters change
  useEffect(() => {
    setPage(1);
    setAllTemplates([]);
  }, [selectedCategory, searchQuery, sortBy]);

  // Update accumulated templates when data changes
  useEffect(() => {
    if (activeQuery.data?.templates) {
      const newTemplates = activeQuery.data.templates;

      if (page === 1) {
        // First page - replace all
        setAllTemplates(newTemplates);
      } else {
        // Subsequent pages - append new templates
        setAllTemplates((prev) => {
          // Create a map of existing template IDs for quick lookup
          const existingIds = new Set(prev.map((t) => t.id));
          // Filter out any duplicates from new templates
          const uniqueNewTemplates = newTemplates.filter(
            (t) => !existingIds.has(t.id),
          );
          // Append unique new templates
          return [...prev, ...uniqueNewTemplates];
        });
      }
    }
  }, [dataUpdatedAt, page, activeQuery.data?.templates]); // Use dataUpdatedAt instead of activeQuery.data

  const handleLoadMore = () => {
    setPage((prev) => prev + 1);
  };

  const handleTemplateClick = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setDialogOpen(true);
  };

  return (
    <div className="bg-background min-h-screen">
      {/* Header */}
      <div className="from-primary/5 border-b bg-gradient-to-b to-transparent">
        <div className="container mx-auto px-4 py-12">
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground mb-8 inline-flex items-center text-sm transition-colors"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
          <div className="text-center">
            <div className="bg-primary/10 text-primary mx-auto mb-4 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium">
              <Sparkles className="h-4 w-4" />
              From the Community
            </div>
            <h1 className="mb-3 text-4xl font-bold tracking-tight sm:text-5xl">
              Browse Templates
            </h1>
            <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
              Explore our curated collection of templates. Find the perfect
              starting point for your next project.
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Category Tabs */}
        <div className="mb-6">
          <TemplateCategoryTabs
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
          />
        </div>

        {/* Search and Filters */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row">
          <div className="flex-1">
            <TemplateSearchBar
              onSearch={setSearchQuery}
              loading={isLoading}
              placeholder="Search templates by name or description..."
            />
          </div>
          {!shouldSearch && (
            <TemplateFilters sortBy={sortBy} onSortChange={setSortBy} />
          )}
        </div>

        {/* Results Info */}
        {activeQuery.data && (
          <div className="text-muted-foreground mb-4 text-sm">
            {shouldSearch ? (
              <p>
                Found {totalCount} template
                {totalCount !== 1 ? "s" : ""} matching &quot;{searchQuery}&quot;
              </p>
            ) : (
              <p>
                Showing {allTemplates.length} of {totalCount} template
                {totalCount !== 1 ? "s" : ""}
                {selectedCategory && " in this category"}
              </p>
            )}
          </div>
        )}

        {/* Template Grid */}
        <TemplateGrid
          templates={allTemplates}
          loading={isLoading && page === 1}
          loadingMore={isLoading && page > 1}
          error={activeQuery.error?.message}
          onLoadMore={hasMore ? handleLoadMore : undefined}
          hasMore={hasMore}
          onTemplateClick={handleTemplateClick}
        />
      </div>

      {/* Template Detail Dialog */}
      {selectedTemplateId && (
        <TemplateDetailDialog
          templateId={selectedTemplateId}
          isOpen={dialogOpen}
          onClose={() => {
            setDialogOpen(false);
            setSelectedTemplateId(null);
          }}
        />
      )}
    </div>
  );
}
