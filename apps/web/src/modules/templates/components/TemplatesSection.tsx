"use client";

import { useState } from "react";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { TemplateGrid } from "./TemplateGrid";
import { TemplateDetailDialog } from "./TemplateDetailDialog";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface TemplatesSectionProps {
  variant?: "landing" | "dashboard";
  limit?: number;
  showCategories?: boolean;
  className?: string;
}

export function TemplatesSection({
  variant = "landing",
  limit = 8,
  showCategories = false,
  className,
}: TemplatesSectionProps) {
  const trpc = useTRPC();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null,
  );
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    ...trpc.templates.getFeatured.queryOptions({ limit, offset: 0 }),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const isDashboard = variant === "dashboard";

  const handleTemplateClick = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setDialogOpen(true);
  };

  return (
    <section
      className={cn(
        "w-full space-y-6",
        isDashboard ? "py-8" : "py-12",
        className
      )}
    >
      {/* Section Header */}
      <div className="space-y-3 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
          <Sparkles className="h-4 w-4" />
          From the Community
        </div>
        
        <h2
          className={cn(
            "font-bold tracking-tight",
            isDashboard ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl"
          )}
        >
          Start with a Template
        </h2>
        
        <p className="mx-auto max-w-2xl text-muted-foreground">
          Browse our curated collection of templates and customize them to your
          needs. Save time and start building faster.
        </p>
      </div>

      

      {/* Template Grid */}
      <div className="mx-auto max-w-7xl">
        <TemplateGrid
          templates={data?.templates || []}
          loading={isLoading}
          error={error?.message}
          variant={isDashboard ? "compact" : "default"}
          onTemplateClick={handleTemplateClick}
        />
      </div>

      {/* Footer - Browse All Link */}
      <div className="flex justify-center">
        <Link href="/templates">
          <Button variant="outline" size="lg">
            Browse All Templates
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
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
    </section>
  );
}

