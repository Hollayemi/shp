"use client";

import { useState } from "react";
import { GitHubStatusButton } from "./GitHubStatusButton";
import { GitHubConnectionModal } from "./GitHubConnectionModal";
import { PushToGitHubDialog } from "./PushToGitHubDialog";

interface GitHubIntegrationProps {
  projectId: string;
  className?: string;
  sandboxFiles?: Set<string>; // Pre-loaded sandbox files
}

/**
 * Consolidated GitHub integration component that handles all modals internally
 */
export function GitHubIntegration({ projectId, className, sandboxFiles }: GitHubIntegrationProps) {
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);
  const [isPushDialogOpen, setIsPushDialogOpen] = useState(false);

  return (
    <>
      <GitHubStatusButton
        projectId={projectId}
        onOpenModal={() => setIsConnectionModalOpen(true)}
        className={className}
      />

      <GitHubConnectionModal
        projectId={projectId}
        open={isConnectionModalOpen}
        onOpenChange={setIsConnectionModalOpen}
        onOpenPushDialog={() => setIsPushDialogOpen(true)}
      />

      <PushToGitHubDialog
        projectId={projectId}
        open={isPushDialogOpen}
        onOpenChange={setIsPushDialogOpen}
        sandboxFiles={sandboxFiles}
      />
    </>
  );
}
