"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LoaderIcon } from "lucide-react";
import { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from "react";
import { FragmentCard } from "./fragments/FragmentCard";

interface GitFragmentsListProps {
  projectId: string;
  onSwitchToCommit?: (commitHash: string, fragmentData?: any) => void;
  activeCommitHash?: string;
  onLatestFragmentChange?: (fragment: any) => void;
  onFragmentRefresh?: () => void;
  onRefreshActiveFragment?: () => void;
  isGenerationActive?: boolean;
}

export interface GitFragmentsListRef {
  refresh: () => Promise<any>;
}

export const GitFragmentsList = forwardRef<GitFragmentsListRef, GitFragmentsListProps>(
  function GitFragmentsList(
    {
      projectId,
      onSwitchToCommit,
      activeCommitHash,
      onLatestFragmentChange,
      onFragmentRefresh,
      onRefreshActiveFragment,
      isGenerationActive = false,
    },
    ref
  ) {
  const [loadingCommitHash, setLoadingCommitHash] = useState<string | null>(
    null,
  );
  const [pendingCommitHash, setPendingCommitHash] = useState<string | null>(
    null,
  );
  const [isRefetching, setIsRefetching] = useState(false);

  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const {
    data: gitFragments,
    isLoading,
    error,
    refetch: refetchFragments,
  } = useQuery(
    trpc.projects.getGitFragments.queryOptions({
      projectId,
      limit: 20,
    }),
  );

  const handleRefresh = useCallback(
    async () => {
      console.log(
        "[GitFragmentsList] Refreshing fragments and active fragment info",
      );
      setIsRefetching(true);
      try {
        const result = await refetchFragments();
        if (onRefreshActiveFragment) {
          onRefreshActiveFragment();
        }
        // Return the latest fragment from the refetched data
        const latestFragment = result.data?.[0] || null;
        return latestFragment;
      } finally {
        setIsRefetching(false);
      }
    },
    [onRefreshActiveFragment, refetchFragments],
  );

  useEffect(() => {
    if (gitFragments && gitFragments.length > 0 && onLatestFragmentChange) {
      onLatestFragmentChange(gitFragments[0]);
    }
  }, [gitFragments, onLatestFragmentChange]);

  const switchToCommitMutation = useMutation(
    trpc.projects.switchToGitCommit.mutationOptions({
      onSuccess: (result: any) => {
        console.log("Switched to git commit:", result.message);
        onSwitchToCommit?.(result.commitHash, {
          commitHash: result.commitHash,
          title: result.fragmentTitle,
        });
        setLoadingCommitHash(null);

        onFragmentRefresh?.();

        queryClient.invalidateQueries({
          queryKey: trpc.projects.checkV2ProjectSandboxHealth.queryKey({
            projectId,
          }),
        });
      },
      onError: (error: any) => {
        console.error("Failed to switch to git commit:", error);
        setLoadingCommitHash(null);
        setPendingCommitHash(null);
      },
    }),
  );

  const handleSwitchToCommit = async (commitHash: string) => {
    setLoadingCommitHash(commitHash);
    setPendingCommitHash(commitHash);
    await switchToCommitMutation.mutateAsync({
      commitHash,
      projectId,
    });
  };

  useEffect(() => {
    if (activeCommitHash && pendingCommitHash === activeCommitHash) {
      setPendingCommitHash(null);
    }
  }, [activeCommitHash, pendingCommitHash]);

  // Expose refresh method to parent via ref
  useImperativeHandle(ref, () => ({
    refresh: handleRefresh,
  }), [handleRefresh]);

  const getVersionLabel = (index: number, total: number) => {
    if (index === 0) return "Current Version";
    return `Version ${total - index}`;
  };

  if (error) {
    return (
      <div className="p-4 text-sm text-red-600 dark:text-red-400">
        Failed to load fragments: {error.message}
      </div>
    );
  }

  if (isLoading || isRefetching) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoaderIcon className="h-5 w-5 animate-spin text-muted-foreground dark:text-[#B8C9C3]" />
        <span className="ml-2 text-sm text-muted-foreground dark:text-[#B8C9C3]">
          {isLoading ? "Loading versions..." : "Refreshing versions..."}
        </span>
      </div>
    );
  }

  if (!gitFragments || gitFragments.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-muted-foreground dark:text-[#B8C9C3]">No versions yet</p>
        <p className="text-xs text-muted-foreground dark:text-[#B8C9C3] mt-1">
          Version history will appear here as you make changes
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {gitFragments.map((fragment, index) => {
        const isActive = activeCommitHash === fragment.commitHash;
        const isDisabled =
          loadingCommitHash !== null ||
          pendingCommitHash !== null ||
          isRefetching ||
          isGenerationActive;
        const isTransitioning =
          pendingCommitHash === fragment.commitHash;
        const isCurrentVersion = index === 0;

        return (
          <FragmentCard
            key={fragment.id}
            title={fragment.title}
            createdAt={fragment.createdAt}
            isCurrentVersion={isCurrentVersion}
            isActive={isActive}
            isTransitioning={isTransitioning}
            isDisabled={isDisabled}
            isLoading={loadingCommitHash === fragment.commitHash}
            versionLabel={getVersionLabel(index, gitFragments.length)}
            onRestore={
              !isCurrentVersion
                ? () => !isDisabled && handleSwitchToCommit(fragment.commitHash)
                : undefined
            }
          />
        );
      })}
    </div>
  );
});