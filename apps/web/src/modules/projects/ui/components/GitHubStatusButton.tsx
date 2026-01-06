"use client";

import { useState } from "react";
import { Github, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";

interface GitHubStatusButtonProps {
  projectId: string;
  onOpenModal: () => void;
  className?: string;
}

export function GitHubStatusButton({
  projectId,
  onOpenModal,
  className,
}: GitHubStatusButtonProps) {
  const trpc = useTRPC();

  // Get GitHub connection status
  const { data: status, isLoading } = useQuery(
    trpc.projects.getGithubConnectionStatus.queryOptions({ projectId })
  );

  const getStatusIcon = () => {
    // Always show GitHub icon, with optional badge
    const baseIcon = (
      <Github 
        className={cn(
          "h-4 w-4",
          isLoading && "opacity-50"
        )} 
      />
    );

    // Add checkmark badge when connected
    if (status?.isConnected) {
      return (
        <div className="relative">
          {baseIcon}
          <CheckCircle2 className="absolute -bottom-1 -right-1 h-2.5 w-2.5 text-green-600 dark:text-green-400 bg-prj-bg-primary rounded-full" />
        </div>
      );
    }

    // Add error badge when error
    if (status?.status === "error") {
      return (
        <div className="relative">
          {baseIcon}
          <AlertCircle className="absolute -bottom-1 -right-1 h-1.5 w-1.5 text-red-600 dark:text-red-400 bg-prj-bg-primary rounded-full" />
        </div>
      );
    }

    return baseIcon;
  };

  const getTooltipText = () => {
    if (isLoading) return "Loading...";
    if (!status?.hasGithubAuth) return "Connect GitHub";
    if (status.isConnected) return `Connected: ${status.repoOwner}/${status.repoName}`;
    if (status.status === "error") return "Connection error";
    return "Connect repository";
  };

  const getButtonVariant = (): "ghost" => {
    return "ghost";
  };

  return (
    <Button
      variant={getButtonVariant()}
      size="icon"
      onClick={onOpenModal}
      disabled={isLoading}
      className={cn(
        "h-7 w-7 bg-prj-bg-secondary dark:text-[#B8C9C3] hover:bg-prj-tooltip-hover-bg hover:border hover:border-prj-tooltip-hover-border transition-colors duration-200",
        status?.isConnected && "text-prj-text-title",
        status?.status === "error" && "text-red-600 dark:text-red-400",
        className
      )}
      title={getTooltipText()}
    >
      {getStatusIcon()}
    </Button>
  );
}
