"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Heart,
  Bookmark,
  RefreshCw,
  Sparkles,
  Eye,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatNumber,
  getCategoryColor,
  getGradientForTemplate,
} from "../lib/utils";
import { TemplatePreviewModal } from "./TemplatePreviewModal";
import Image from "next/image";
import Link from "next/link";

// Helper to check if image URL is valid
function isValidImageUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  try {
    const parsed = new URL(url);
    // Only allow https URLs
    if (parsed.protocol !== "https:") return false;
    // Allow all https URLs - next/image will handle domain validation
    // If domain is not in next.config.js, it will show an error which we handle
    return true;
  } catch {
    return false;
  }
}

interface TemplateCardProps {
  template: {
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
    sourceProject?: {
      id: string;
      sandboxUrl: string | null;
      deploymentUrl: string | null;
    } | null;
    demoUrl?: string | null;
  };
  onClick?: () => void;
  variant?: "default" | "compact" | "featured";
}

export function TemplateCard({
  template,
  onClick,
  variant = "default",
}: TemplateCardProps) {
  const isCompact = variant === "compact";
  const isFeatured = template.featured || variant === "featured";
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const router = useRouter();
  const trpc = useTRPC();
  const { data: session } = useSession();

  const hasPreview =
    template.sourceProject?.deploymentUrl ||
    template.sourceProject?.sandboxUrl ||
    template.demoUrl;

  // Remix mutation
  const remixMutation = useMutation(
    trpc.templates.remix.mutationOptions({
      onMutate: () => {
        toast.loading("Remixing template...", { id: "remix" });
      },
      onSuccess: (data) => {
        toast.dismiss("remix");
        toast.success(`${template.name} added to your workspace!`);

        // Redirect after a brief delay
        setTimeout(() => {
          router.push(data.redirectUrl);
        }, 500);
      },
      onError: (error) => {
        toast.dismiss("remix");

        // Check error message content for different scenarios
        const errorMessage = error.message.toLowerCase();

        if (
          errorMessage.includes("unauthorized") ||
          errorMessage.includes("logged in")
        ) {
          toast.error("Please sign in to remix this template", {
            action: {
              label: "Sign In",
              onClick: () => router.push("/auth/signin"),
            },
          });
        } else if (
          errorMessage.includes("insufficient credits") ||
          errorMessage.includes("payment")
        ) {
          toast.error("Insufficient credits to remix this template", {
            action: {
              label: "Add Credits",
              onClick: () => router.push("/pricing"),
            },
          });
        } else {
          toast.error(`Failed to remix: ${error.message}`);
        }
      },
    }),
  );

  const handleRemix = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!session) {
      toast.error("Please sign in to remix templates", {
        action: {
          label: "Sign In",
          onClick: () => router.push("/auth/signin"),
        },
      });
      return;
    }

    remixMutation.mutate({ templateId: template.id });
  };

  const handlePreview = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPreviewModalOpen(true);
  };

  return (
    <Card
      className={cn(
        "group relative cursor-pointer overflow-hidden pt-0 transition-all hover:shadow-lg",
        isFeatured &&
          "border-primary/50 from-primary/5 bg-gradient-to-br to-transparent",
        "hover:-translate-y-1",
      )}
      onClick={onClick}
    >
      {/* Featured Badge */}
      {isFeatured && (
        <div className="absolute top-2 right-2 z-10">
          <Badge className="bg-primary/90 text-white backdrop-blur-sm">
            <Sparkles className="mr-1 h-3 w-3" />
            Featured
          </Badge>
        </div>
      )}

      {/* Thumbnail or Gradient Background */}
      <div className="relative h-40 w-full overflow-hidden bg-gradient-to-br">
        {template.thumbnailUrl && isValidImageUrl(template.thumbnailUrl) ? (
          <>
            <Image
              src={template.thumbnailUrl}
              alt={template.name}
              fill
              className="object-cover transition-transform group-hover:scale-105"
              unoptimized
              onError={(e) => {
                // Hide broken image and show gradient fallback
                const target = e.currentTarget;
                target.style.display = "none";
                const parent = target.parentElement;
                if (parent) {
                  const fallback = parent.querySelector(".thumbnail-fallback");
                  if (fallback) {
                    (fallback as HTMLElement).style.display = "flex";
                  }
                }
              }}
            />
            {/* Fallback gradient (hidden by default, shown on error) */}
            <div
              className={cn(
                "thumbnail-fallback absolute inset-0 hidden h-full w-full bg-gradient-to-br",
                getGradientForTemplate(template.id),
              )}
            >
              <div className="flex h-full items-center justify-center">
                <span className="text-6xl opacity-90">{template.logo}</span>
              </div>
            </div>
          </>
        ) : (
          /* No thumbnail URL - show gradient */
          <div
            className={cn(
              "h-full w-full bg-gradient-to-br",
              getGradientForTemplate(template.id),
            )}
          >
            <div className="flex h-full items-center justify-center">
              <span className="text-6xl opacity-90">{template.logo}</span>
            </div>
          </div>
        )}
      </div>

      <CardContent className="space-y-3 p-4">
        {/* Title and Category */}
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-1 leading-tight font-semibold">
              {template.logo} {template.name}
            </h3>
          </div>

          {/* Category and Author */}
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            {template.category && (
              <>
                <Badge
                  variant="outline"
                  className={getCategoryColor(template.category.slug)}
                >
                  {template.category.icon} {template.category.name}
                </Badge>
                <span>•</span>
              </>
            )}
            <span>By {template.authorName}</span>
          </div>
        </div>

        {/* Description */}
        {!isCompact && (
          <p className="text-muted-foreground line-clamp-2 text-sm">
            {template.shortDescription}
          </p>
        )}

        {/* Metrics */}
        <div className="text-muted-foreground flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <RefreshCw className="h-3.5 w-3.5" />
            <span>{formatNumber(template.remixCount)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Heart
              className={cn(
                "h-3.5 w-3.5",
                template.userLiked && "fill-red-500 text-red-500",
              )}
            />
            <span>{formatNumber(template.likeCount)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Bookmark
              className={cn(
                "h-3.5 w-3.5",
                template.userSaved && "fill-yellow-500 text-yellow-500",
              )}
            />
            <span>{formatNumber(template.saveCount)}</span>
          </div>
        </div>

        {/* Action Buttons */}
        {!isCompact && (
          <div className="flex gap-2">
            {hasPreview && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={handlePreview}
              >
                <Eye className="z-10 mr-2 h-4 w-4" />
                Preview
              </Button>
            )}
            <Button
              className={hasPreview ? "flex-1" : "w-full"}
              variant="default"
              onClick={handleRemix}
              disabled={remixMutation.isPending}
            >
              <RefreshCw
                className={cn(
                  "z-10 mr-2 h-4 w-4",
                  remixMutation.isPending && "animate-spin",
                )}
              />
              {remixMutation.isPending ? "Remixing..." : "Remix"}
            </Button>
          </div>
        )}
      </CardContent>

      {/* Preview Modal */}
      {hasPreview && (
        <TemplatePreviewModal
          isOpen={previewModalOpen}
          onClose={() => setPreviewModalOpen(false)}
          previewUrl={
            template.sourceProject?.deploymentUrl ||
            template.sourceProject?.sandboxUrl ||
            template.demoUrl ||
            null
          }
          projectUrl={
            template.sourceProject?.id
              ? `/projects/${template.sourceProject.id}`
              : undefined
          }
          templateName={template.name}
          sourceProjectId={template.sourceProject?.id || null}
          isDeployedUrl={
            !!template.sourceProject?.deploymentUrl || !!template.demoUrl
          }
        />
      )}
    </Card>
  );
}
