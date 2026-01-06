"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import {
  RemixButton,
  TemplateLikeButton,
  TemplateSaveButton,
  TemplateMetrics,
  TemplateChatHistory,
  TemplateComments,
  TemplateGrid,
} from "@/modules/templates/components";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Code,
  MessageSquare,
  Eye,
  FileText,
  ExternalLink,
  Sparkles,
  ArrowLeft,
} from "lucide-react";
import { getCategoryColor } from "@/modules/templates/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import Image from "next/image";
import Link from "next/link";

export default function TemplateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const trpc = useTRPC();
  const slug = params.slug as string;

  // We need to fetch by slug, but our API uses ID
  // For now, let's fetch all and find by slug (not ideal, but works)
  // TODO: Add getBySlug endpoint for better SEO
  const { data: templates } = useQuery(
    trpc.templates.getByCategory.queryOptions({
      limit: 100,
      offset: 0,
    }),
  );

  const template = templates?.templates.find((t) => t.slug === slug);
  const templateId = template?.id;

  const { data, isLoading, error } = useQuery({
    ...trpc.templates.getById.queryOptions({ templateId: templateId! }),
    enabled: !!templateId,
  });

  if (isLoading || !templateId) {
    return <TemplateDetailSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="mb-2 text-2xl font-bold">Template Not Found</h2>
          <p className="text-muted-foreground mb-6">
            This template doesn&apos;t exist or has been removed
          </p>
          <Button onClick={() => router.push("/templates")}>
            Browse All Templates
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen pb-12">
      {/* Back Button */}
      <div className="bg-card/50 border-b">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>
      </div>

      {/* Header */}
      <div className="from-primary/5 border-b bg-gradient-to-b to-transparent">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            {/* Thumbnail */}
            {data.thumbnailUrl ? (
              <div className="relative aspect-video w-full overflow-hidden rounded-lg border sm:w-80">
                <Image
                  src={data.thumbnailUrl}
                  alt={data.name}
                  fill
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="from-primary/20 to-primary/5 flex aspect-video w-full items-center justify-center rounded-lg border bg-gradient-to-br text-8xl sm:w-80">
                {data.logo}
              </div>
            )}

            {/* Info */}
            <div className="flex-1 space-y-4">
              <div className="space-y-2">
                {data.featured && (
                  <Badge className="mb-2">
                    <Sparkles className="mr-1 h-3 w-3" />
                    Featured
                  </Badge>
                )}
                <h1 className="text-3xl font-bold">{data.name}</h1>
                <p className="text-muted-foreground text-lg">
                  {data.description}
                </p>

                {/* Author and Category */}
                <div className="flex flex-wrap items-center gap-2">
                  {data.category && (
                    <Badge
                      variant="outline"
                      className={getCategoryColor(data.category.slug)}
                    >
                      {data.category.icon} {data.category.name}
                    </Badge>
                  )}
                  {data.tags.slice(0, 5).map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  <span className="text-muted-foreground text-sm">
                    By {data.authorName}
                  </span>
                </div>
              </div>

              {/* Metrics */}
              <TemplateMetrics
                remixes={data.remixCount}
                likes={data.likeCount}
                saves={data.saveCount}
                views={data.viewCount}
                variant="default"
                showLabels
              />

              {/* Actions */}
              <div className="flex flex-wrap gap-3">
                <RemixButton
                  templateId={data.id}
                  templateName={data.name}
                  variant="large"
                  className="flex-1 sm:flex-none"
                />
                <TemplateLikeButton
                  templateId={data.id}
                  initialLiked={data.userLiked}
                  initialCount={data.likeCount}
                />
                <TemplateSaveButton
                  templateId={data.id}
                  initialSaved={data.userSaved}
                  initialCount={data.saveCount}
                />
                {data.demoUrl && (
                  <Button variant="outline" asChild>
                    <a
                      href={data.demoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Live Demo
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Tabs */}
      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="preview" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="preview">
              <Code className="mr-2 h-4 w-4" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="recipe">
              <MessageSquare className="mr-2 h-4 w-4" />
              Recipe
            </TabsTrigger>
            <TabsTrigger value="community">
              <MessageSquare className="mr-2 h-4 w-4" />
              Community
            </TabsTrigger>
          </TabsList>

          {/* Preview Tab */}
          <TabsContent value="preview" className="space-y-6">
            <div>
              <h2 className="mb-4 text-2xl font-semibold">Template Files</h2>
              <div className="bg-muted/30 rounded-lg border p-6">
                <FileTree files={data.sourceFragment.files} />
              </div>
            </div>
          </TabsContent>

          {/* Recipe Tab */}
          <TabsContent value="recipe">
            {data.chatHistoryVisible || data.seedPrompt ? (
              <TemplateChatHistory
                templateId={data.id}
                fallbackSeedPrompt={data.seedPrompt || undefined}
              />
            ) : (
              <div className="rounded-lg border border-dashed p-12 text-center">
                <MessageSquare className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
                <p className="text-muted-foreground text-sm">
                  Chat history is not available for this template
                </p>
              </div>
            )}
          </TabsContent>

          {/* Community Tab */}
          <TabsContent value="community">
            <TemplateComments templateId={data.id} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Related Templates */}
      {data.relatedTemplates && data.relatedTemplates.length > 0 && (
        <div className="container mx-auto px-4 py-8">
          <h2 className="mb-6 text-2xl font-semibold">Related Templates</h2>
          <TemplateGrid
            templates={data.relatedTemplates as any}
            loading={false}
            variant="compact"
          />
        </div>
      )}
    </div>
  );
}

// File Tree Component
function FileTree({ files }: { files: any }) {
  if (!files || typeof files !== "object") {
    return <p className="text-muted-foreground text-sm">No files to preview</p>;
  }

  const fileList = Object.keys(files);

  if (fileList.length === 0) {
    return <p className="text-muted-foreground text-sm">No files to preview</p>;
  }

  return (
    <div className="space-y-1">
      {fileList.map((filePath) => (
        <div
          key={filePath}
          className="hover:bg-background flex items-center gap-2 rounded px-2 py-1.5 text-sm"
        >
          <FileText className="text-muted-foreground h-4 w-4" />
          <span className="font-mono text-xs">{filePath}</span>
        </div>
      ))}
      <div className="text-muted-foreground mt-4 border-t pt-4 text-sm">
        {fileList.length} file{fileList.length !== 1 ? "s" : ""} included in
        this template
      </div>
    </div>
  );
}

// Loading Skeleton
function TemplateDetailSkeleton() {
  return (
    <div className="bg-background min-h-screen">
      <div className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Skeleton className="h-10 w-24" />
        </div>
      </div>
      <div className="container mx-auto px-4 py-8">
        <div className="flex gap-6">
          <Skeleton className="h-60 w-80" />
          <div className="flex-1 space-y-4">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
