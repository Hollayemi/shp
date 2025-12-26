"use client";

import { useState } from "react";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Code,
  MessageSquare,
  Eye,
  FileText,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RemixButton } from "./RemixButton";
import { TemplateLikeButton } from "./TemplateLikeButton";
import { TemplateSaveButton } from "./TemplateSaveButton";
import { TemplateMetrics } from "./TemplateMetrics";
import { TemplateChatHistory } from "./TemplateChatHistory";
import { TemplateComments } from "./TemplateComments";
import { TemplatePreviewModal } from "./TemplatePreviewModal";
import { getCategoryColor } from "../lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import Image from "next/image";
import Link from "next/link";

interface TemplateDetailDialogProps {
  templateId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function TemplateDetailDialog({
  templateId,
  isOpen,
  onClose,
}: TemplateDetailDialogProps) {
  const trpc = useTRPC();
  const [activeTab, setActiveTab] = useState("overview");
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    ...trpc.templates.getById.queryOptions({ templateId: templateId! }),
    enabled: isOpen && !!templateId,
  });

  if (!isOpen || !templateId) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-4xl p-0">
        {isLoading ? (
          <TemplateDetailSkeleton />
        ) : error ? (
          <div className="p-6">
            <DialogHeader>
              <DialogTitle>Template Not Found</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground mt-4 text-sm">
              {error.message || "This template could not be loaded"}
            </p>
          </div>
        ) : data ? (
          <>
            {/* Header */}
            <div className="border-b p-6">
              <div className="flex items-start gap-4">
                {/* Template Icon/Logo */}
                <div className="from-primary/20 to-primary/10 flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-4xl">
                  {data.logo}
                </div>

                {/* Title and Meta */}
                <div className="flex-1 space-y-2">
                  <div>
                    <div className="flex items-center gap-3">
                      <DialogTitle className="text-2xl">
                        {data.name}
                      </DialogTitle>
                      {data.featured && (
                        <Badge className="flex-shrink-0">
                          <Sparkles className="mr-1 h-3 w-3" />
                          Featured
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground mt-1 text-sm">
                      By {data.authorName}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {data.category && (
                      <Badge
                        variant="outline"
                        className={getCategoryColor(data.category.slug)}
                      >
                        {data.category.icon} {data.category.name}
                      </Badge>
                    )}
                    {data.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="flex-1"
            >
              <div className="border-b px-6">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="overview">
                    <Eye className="mr-2 h-4 w-4" />
                    Overview
                  </TabsTrigger>
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
              </div>

              <ScrollArea className="h-[50vh]">
                {/* Overview Tab */}
                <TabsContent value="overview" className="mt-0 p-6">
                  <div className="space-y-6">
                    {/* Thumbnail */}
                    {data.thumbnailUrl && (
                      <div className="relative aspect-video overflow-hidden rounded-lg border">
                        <Image
                          src={data.thumbnailUrl}
                          alt={data.name}
                          fill
                          className="object-cover"
                          unoptimized
                          onError={(e) => {
                            // Hide broken image and show fallback
                            const target = e.currentTarget;
                            target.style.display = "none";
                            const parent = target.parentElement;
                            if (parent) {
                              const fallback = parent.querySelector(
                                ".thumbnail-fallback",
                              );
                              if (fallback) {
                                (fallback as HTMLElement).style.display =
                                  "flex";
                              }
                            }
                          }}
                        />
                        {/* Fallback gradient (hidden by default) */}
                        <div className="thumbnail-fallback from-primary/20 to-primary/10 absolute inset-0 hidden h-full w-full items-center justify-center bg-gradient-to-br">
                          <span className="text-6xl opacity-90">
                            {data.logo}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Description */}
                    <div>
                      <h3 className="mb-2 font-semibold">
                        About This Template
                      </h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        {data.description}
                      </p>
                    </div>

                    {/* Metrics */}
                    <div>
                      <h3 className="mb-3 font-semibold">Template Stats</h3>
                      <TemplateMetrics
                        remixes={data.remixCount}
                        likes={data.likeCount}
                        saves={data.saveCount}
                        views={data.viewCount}
                        userLiked={data.userLiked}
                        userSaved={data.userSaved}
                        variant="detailed"
                      />
                    </div>

                    {/* Social Actions */}
                    <div className="flex gap-3">
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
                    </div>

                    {/* Demo Link */}
                    {data.demoUrl && (
                      <Button variant="outline" className="w-full" asChild>
                        <a
                          href={data.demoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          View Live Demo
                        </a>
                      </Button>
                    )}

                    {/* Related Templates */}
                    {data.relatedTemplates &&
                      data.relatedTemplates.length > 0 && (
                        <div>
                          <h3 className="mb-3 font-semibold">
                            Related Templates
                          </h3>
                          <div className="grid grid-cols-2 gap-3">
                            {data.relatedTemplates.map((related) => (
                              <button
                                key={related.id}
                                className="hover:bg-muted/50 rounded-lg border p-3 text-left transition-colors"
                                onClick={() => {
                                  // TODO: Open this template in dialog
                                  console.log("Open template:", related.id);
                                }}
                              >
                                <div className="mb-1 flex items-center gap-2">
                                  <span className="text-lg">
                                    {related.logo}
                                  </span>
                                  <span className="text-sm font-medium">
                                    {related.name}
                                  </span>
                                </div>
                                <p className="text-muted-foreground line-clamp-2 text-xs">
                                  {related.shortDescription}
                                </p>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                </TabsContent>

                {/* Preview Tab */}
                <TabsContent value="preview" className="mt-0 p-6">
                  <div className="space-y-4">
                    {/* Live Preview Section */}
                    {(data.sourceProject?.sandboxUrl ||
                      data.sourceProject?.deploymentUrl ||
                      data.demoUrl) && (
                      <div className="space-y-4">
                        <div>
                          <h3 className="mb-2 font-semibold">Live Preview</h3>
                          <p className="text-muted-foreground mb-4 text-sm">
                            Interact with the live version of this template.
                          </p>
                          <div className="flex gap-3">
                            <Button
                              onClick={() => setPreviewModalOpen(true)}
                              className="flex-1"
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              Open Preview
                            </Button>
                            {data.sourceProject?.id && (
                              <Button
                                variant="outline"
                                asChild
                                className="flex-1"
                              >
                                <Link
                                  href={
                                    data.sourceProject.deploymentUrl ||
                                    data.sourceProject.sandboxUrl ||
                                    `/projects/${data.sourceProject.id}`
                                  }
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <ExternalLink className="mr-2 h-4 w-4" />
                                  View Project
                                </Link>
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="border-t pt-4" />
                      </div>
                    )}

                    {/* File Structure Section */}
                    <div>
                      <h3 className="mb-2 font-semibold">Template Files</h3>
                      <p className="text-muted-foreground mb-4 text-sm">
                        Preview the file structure and code included in this
                        template.
                      </p>

                      {/* File Tree */}
                      <div className="bg-muted/30 rounded-lg border p-4">
                        <FileTree files={data.sourceFragment.files} />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Recipe Tab */}
                <TabsContent value="recipe" className="mt-0 p-6">
                  {data.chatHistoryVisible || data.seedPrompt ? (
                    <TemplateChatHistory
                      templateId={data.id}
                      fallbackSeedPrompt={data.seedPrompt || undefined}
                    />
                  ) : (
                    <div className="rounded-lg border border-dashed p-8 text-center">
                      <MessageSquare className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
                      <p className="text-muted-foreground text-sm">
                        Chat history is not available for this template
                      </p>
                    </div>
                  )}
                </TabsContent>

                {/* Community Tab */}
                <TabsContent value="community" className="mt-0 p-6">
                  <TemplateComments templateId={data.id} />
                </TabsContent>
              </ScrollArea>
            </Tabs>

            {/* Footer with Primary CTA */}
            <div className="border-t p-6">
              <RemixButton
                templateId={data.id}
                templateName={data.name}
                variant="large"
                onSuccess={onClose}
              />
            </div>
          </>
        ) : null}
      </DialogContent>

      {/* Preview Modal */}
      {data && (
        <TemplatePreviewModal
          isOpen={previewModalOpen}
          onClose={() => setPreviewModalOpen(false)}
          previewUrl={
            data.sourceProject?.deploymentUrl ||
            data.sourceProject?.sandboxUrl ||
            data.demoUrl
          }
          projectUrl={
            data.sourceProject?.deploymentUrl ||
            data.sourceProject?.sandboxUrl ||
            (data.sourceProject?.id
              ? `/projects/${data.sourceProject.id}`
              : undefined)
          }
          templateName={data.name}
          sourceProjectId={data.sourceProject?.id || null}
          isDeployedUrl={!!data.sourceProject?.deploymentUrl || !!data.demoUrl}
        />
      )}
    </Dialog>
  );
}

// File Tree Component (Simple readonly view)
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
      <div className="text-muted-foreground mt-3 text-xs">
        {fileList.length} file{fileList.length !== 1 ? "s" : ""} included
      </div>
    </div>
  );
}

// Loading Skeleton
function TemplateDetailSkeleton() {
  return (
    <div className="p-6">
      <div className="mb-6 flex items-start gap-4">
        <Skeleton className="h-16 w-16 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
      <Skeleton className="mb-4 h-10 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
