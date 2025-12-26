"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, RefreshCw, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery } from "@tanstack/react-query";

interface TemplatePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  previewUrl: string | null;
  projectUrl?: string | null;
  templateName: string;
  sourceProjectId?: string | null; // Project ID for sandbox recovery
  isDeployedUrl?: boolean; // True if previewUrl is a deployment URL (not sandbox)
}

export function TemplatePreviewModal({
  isOpen,
  onClose,
  previewUrl,
  projectUrl,
  templateName,
  sourceProjectId,
  isDeployedUrl = false,
}: TemplatePreviewModalProps) {
  const trpc = useTRPC();
  const [iframeKey, setIframeKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [sandboxWokenUp, setSandboxWokenUp] = useState(false);
  const [recoveredSandboxUrl, setRecoveredSandboxUrl] = useState<string | null>(null);

  // Check sandbox health if we have a project ID and it's a sandbox URL (not deployed)
  const shouldCheckHealth = isOpen && !!sourceProjectId && !isDeployedUrl && !!previewUrl;
  
  const {
    data: healthStatus,
    isLoading: isCheckingHealth,
    refetch: refetchHealth,
  } = useQuery({
    ...trpc.projects.checkV2ProjectSandboxHealth.queryOptions({ 
      projectId: sourceProjectId || "" 
    }),
    enabled: shouldCheckHealth,
    staleTime: 0, // Always check fresh when modal opens
    retry: false,
  });

  // Sandbox recovery mutation
  const recoverMutation = useMutation(
    trpc.projects.recoverV2ProjectSandbox.mutationOptions({
      onSuccess: (result) => {
        console.log("[TemplatePreviewModal] Sandbox recovered:", result);
        setSandboxWokenUp(true);
        setRecoveredSandboxUrl(result.sandboxUrl || previewUrl);
        setIframeKey((k) => k + 1);
        setIsLoading(true);
        setHasError(false);
        // Refetch health after recovery
        setTimeout(() => refetchHealth(), 1000);
      },
      onError: (error) => {
        console.error("[TemplatePreviewModal] Sandbox recovery failed:", error);
        setHasError(true);
      },
    })
  );

  // Determine if sandbox is sleeping (needs recovery)
  const isSandboxSleeping = shouldCheckHealth && 
    !isCheckingHealth && 
    healthStatus && 
    !healthStatus.isHealthy && 
    !sandboxWokenUp;

  // Reset state when modal opens/closes or URL changes
  useEffect(() => {
    if (isOpen) {
      setSandboxWokenUp(false);
      setRecoveredSandboxUrl(null);
      setHasError(false);
      
      if (previewUrl && (isDeployedUrl || !sourceProjectId)) {
        // For deployed URLs or when no project ID, load immediately
        setIsLoading(true);
        setIframeKey((k) => k + 1);
      }
    }
  }, [isOpen, previewUrl, isDeployedUrl, sourceProjectId]);

  // When health check completes and sandbox is healthy, load the preview
  useEffect(() => {
    if (shouldCheckHealth && healthStatus?.isHealthy && !sandboxWokenUp) {
      setIsLoading(true);
      setIframeKey((k) => k + 1);
    }
  }, [shouldCheckHealth, healthStatus?.isHealthy, sandboxWokenUp]);

  // Auto-wake up sandbox when it's sleeping (no user action needed)
  useEffect(() => {
    if (isSandboxSleeping && sourceProjectId && !recoverMutation.isPending) {
      console.log("[TemplatePreviewModal] Sandbox sleeping, auto-waking up...");
      recoverMutation.mutate({ projectId: sourceProjectId });
    }
  }, [isSandboxSleeping, sourceProjectId, recoverMutation]);

  const handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIframeKey((k) => k + 1);
    setIsLoading(true);
    setHasError(false);
  };

  const handleWakeUpSandbox = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (sourceProjectId) {
      recoverMutation.mutate({ projectId: sourceProjectId });
    }
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  if (!previewUrl && !projectUrl) {
    return null;
  }

  // Use recovered URL if available, otherwise use original
  const urlToPreview = recoveredSandboxUrl || previewUrl || projectUrl;
  
  // Determine if we should show the iframe
  const shouldShowIframe = isDeployedUrl || 
    !sourceProjectId || 
    (healthStatus?.isHealthy) || 
    sandboxWokenUp;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="max-h-[95vh] max-w-[95vw] p-0 sm:max-w-6xl"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader className="border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">{templateName} - Preview</DialogTitle>
            <div className="flex items-center gap-2">
              {urlToPreview && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isLoading}
                >
                  <RefreshCw
                    className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")}
                  />
                  Refresh
                </Button>
              )}
              {projectUrl && (
                <Button
                  variant="default"
                  size="sm"
                  asChild
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(projectUrl, "_blank", "noopener,noreferrer");
                  }}
                >
                  <a
                    href={projectUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View Project
                  </a>
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0"
              >
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="relative flex-1 overflow-hidden">
          {/* Checking sandbox health or waking up sandbox */}
          {(isCheckingHealth || isSandboxSleeping || recoverMutation.isPending) && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted/80">
              <div className="text-center">
                <RefreshCw className="mx-auto mb-3 h-10 w-10 animate-spin text-primary" />
                <h3 className="mb-2 text-lg font-semibold">
                  {isCheckingHealth ? "Checking preview..." : "Starting preview..."}
                </h3>
                <p className="text-sm text-muted-foreground">
                  This may take 15-30 seconds. Please wait...
                </p>
              </div>
            </div>
          )}

          {/* Loading iframe */}
          {isLoading && shouldShowIframe && !isCheckingHealth && !isSandboxSleeping && !recoverMutation.isPending && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted/50">
              <div className="text-center">
                <RefreshCw className="mx-auto mb-2 h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading preview...</p>
              </div>
            </div>
          )}

          {/* Error state */}
          {hasError && !isSandboxSleeping && !recoverMutation.isPending && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted/50">
              <div className="text-center">
                <AlertCircle className="mx-auto mb-2 h-8 w-8 text-destructive" />
                <p className="mb-2 text-sm font-medium">Failed to load preview</p>
                <p className="mb-4 text-xs text-muted-foreground">
                  The preview URL may be unavailable or expired
                </p>
                <div className="flex flex-col gap-2 items-center">
                  {sourceProjectId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleWakeUpSandbox}
                      disabled={recoverMutation.isPending}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Try Waking Up Sandbox
                    </Button>
                  )}
                  {projectUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      onClick={(e) => e.stopPropagation()}
                    >
                      <a
                        href={projectUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open Project Directly
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Iframe - only show when sandbox is ready */}
          {urlToPreview && shouldShowIframe && (
            <iframe
              key={iframeKey}
              src={urlToPreview}
              className={cn(
                "h-[calc(95vh-120px)] w-full border-0 transition-opacity",
                (isLoading || isSandboxSleeping || recoverMutation.isPending) && "opacity-0",
                !isLoading && !hasError && !isSandboxSleeping && !recoverMutation.isPending && "opacity-100",
              )}
              title={`${templateName} Preview`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              onLoad={handleIframeLoad}
              onError={handleIframeError}
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

