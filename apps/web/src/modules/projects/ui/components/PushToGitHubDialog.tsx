"use client";

import { useState } from "react";
import { Loader2, Upload, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useFilteredFiles } from "@/hooks/useFilteredFiles";

interface PushToGitHubDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  sandboxFiles?: Set<string>; // Pre-loaded sandbox files
}

export function PushToGitHubDialog({
  projectId,
  open,
  onOpenChange,
  onSuccess,
  sandboxFiles,
}: PushToGitHubDialogProps) {
  const [commitMessage, setCommitMessage] = useState("");
  const [commitUrl, setCommitUrl] = useState<string | null>(null);

  const trpc = useTRPC();
  
  // Filter sandbox files for push (removes node_modules, .git, etc.)
  const filteredFiles = useFilteredFiles(sandboxFiles);

  const pushMutation = useMutation(
    trpc.projects.pushToGithub.mutationOptions({
      onSuccess: (data) => {
        setCommitUrl(data.commitUrl || null);
        toast.success(data.message || "Successfully pushed to GitHub!");
        onSuccess?.();
      },
      onError: (error) => {
        toast.error(error.message || "Failed to push to GitHub");
      },
    })
  );

  const handlePush = () => {
    if (filteredFiles.length === 0) {
      toast.error("No files available to push");
      return;
    }
    
    pushMutation.mutate({
      projectId,
      commitMessage: commitMessage.trim() || undefined,
      filePaths: filteredFiles,
    });
  };

  const handleClose = () => {
    if (!pushMutation.isPending) {
      setCommitMessage("");
      setCommitUrl(null);
      onOpenChange(false);
    }
  };

  // Success state
  if (pushMutation.isSuccess && commitUrl) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[500px] bg-prj-bg-primary border-prj-border-primary">
          <DialogHeader>
            <DialogTitle className="text-prj-text-title dark:text-[#F5F9F7]">Push Successful!</DialogTitle>
            <DialogDescription className="text-prj-text-secondary">
              Your code has been pushed to GitHub
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4 py-6">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-50 dark:bg-green-900/20">
              <Upload className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-sm text-center text-prj-text-secondary">
              Your changes have been committed and pushed to your GitHub repository
            </p>
            <Button
              asChild
              variant="outline"
              className="gap-2"
            >
              <a href={commitUrl} target="_blank" rel="noopener noreferrer">
                View Commit
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleClose}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Push form
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] bg-prj-bg-primary border-prj-border-primary">
        <DialogHeader>
          <DialogTitle className="text-prj-text-title dark:text-[#F5F9F7]">Push to GitHub</DialogTitle>
          <DialogDescription className="text-prj-text-secondary">
            Push your project files to the connected GitHub repository
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="commit-message" className="text-prj-text-title dark:text-[#F5F9F7]">
              Commit Message (Optional)
            </Label>
            <Input
              id="commit-message"
              placeholder="Update from Shipper"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              disabled={pushMutation.isPending}
              className="bg-prj-bg-secondary border-prj-border-primary text-prj-text-title"
            />
            <p className="text-xs text-prj-text-secondary">
              Leave empty to use default message with timestamp
            </p>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={pushMutation.isPending}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handlePush}
              disabled={pushMutation.isPending}
              className="flex-1 gap-2"
            >
              {pushMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Pushing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Push to GitHub
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
