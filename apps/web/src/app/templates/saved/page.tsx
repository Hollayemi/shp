"use client";

import { useState } from "react";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  TemplateGrid,
  TemplateDetailDialog,
  TemplateFilters,
} from "@/modules/templates/components";
import type { TemplateSortBy } from "@/modules/templates/types";
import { Bookmark, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SavedTemplatesPage() {
  const trpc = useTRPC();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const limit = 12;

  const { data, isLoading } = useQuery({
    ...trpc.templates.getMySavedTemplates.queryOptions({ limit, offset }),
    enabled: status === "authenticated" && !!session,
  });

  const templates = data?.templates || [];
  const hasMore = data?.pagination?.hasMore || false;

  // Redirect to sign in if not authenticated
  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Lock className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h2 className="mb-2 text-2xl font-bold">Sign In Required</h2>
          <p className="mb-6 text-muted-foreground">
            Please sign in to view your saved templates
          </p>
          <Button onClick={() => router.push("/auth/signin")}>
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  const handleLoadMore = () => {
    setOffset((prev) => prev + limit);
  };

  const handleTemplateClick = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-gradient-to-b from-yellow-500/5 to-transparent">
        <div className="container mx-auto px-4 py-12">
          <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border bg-yellow-500/10 px-4 py-1.5 text-sm font-medium text-yellow-600 dark:text-yellow-500">
            <Bookmark className="h-4 w-4" />
            Your Saved Templates
          </div>
          <h1 className="mb-3 text-4xl font-bold tracking-tight">
            Saved Templates
          </h1>
          <p className="text-lg text-muted-foreground">
            Templates you&apos;ve bookmarked for later
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Results Info */}
        {data && (
          <div className="mb-6 text-sm text-muted-foreground">
            <p>
              {data.pagination.total} saved template
              {data.pagination.total !== 1 ? "s" : ""}
            </p>
          </div>
        )}

        {/* Template Grid */}
        <TemplateGrid
          templates={templates}
          loading={isLoading}
          onLoadMore={hasMore ? handleLoadMore : undefined}
          hasMore={hasMore}
          onTemplateClick={handleTemplateClick}
        />

        {/* Empty State */}
        {!isLoading && templates.length === 0 && (
          <div className="rounded-lg border border-dashed p-12 text-center">
            <Bookmark className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold">No Saved Templates</h3>
            <p className="mb-6 text-muted-foreground">
              You haven&apos;t saved any templates yet. Browse templates to get started!
            </p>
            <Button onClick={() => router.push("/templates")}>
              Browse Templates
            </Button>
          </div>
        )}
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

