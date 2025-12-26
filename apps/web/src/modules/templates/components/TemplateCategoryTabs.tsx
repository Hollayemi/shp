"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface TemplateCategoryTabsProps {
  selectedCategory?: string | null;
  onCategoryChange: (categorySlug: string | null) => void;
  className?: string;
}

export function TemplateCategoryTabs({
  selectedCategory = null,
  onCategoryChange,
  className,
}: TemplateCategoryTabsProps) {
  const trpc = useTRPC();

  const { data, isLoading } = useQuery({
    ...trpc.templates.getCategories.queryOptions(),
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
  });

  if (isLoading) {
    return (
      <div className={cn("flex gap-2 overflow-x-auto", className)}>
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 flex-shrink-0" />
        ))}
      </div>
    );
  }

  if (!data?.categories) {
    return null;
  }

  const categories = data.categories;
  const activeCategory = selectedCategory || "all";

  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <Tabs
        value={activeCategory}
        onValueChange={(value) =>
          onCategoryChange(value === "all" ? null : value)
        }
      >
        <TabsList className="inline-flex w-auto">
          {/* All Tab */}
          <TabsTrigger value="all" className="flex-shrink-0">
            All Templates
          </TabsTrigger>

          {/* Category Tabs */}
          {categories.map((category) => (
            <TabsTrigger
              key={category.id}
              value={category.slug}
              className="flex-shrink-0"
            >
              {category.icon && <span className="mr-1.5">{category.icon}</span>}
              {category.name}
              {category.templateCount > 0 && (
                <span className="bg-primary/20 ml-1.5 rounded-full px-1.5 py-0.5 text-xs">
                  {category.templateCount}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
