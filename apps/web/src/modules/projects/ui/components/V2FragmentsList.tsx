"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  useState,
  useEffect,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react";
import { FragmentCard } from "./fragments/FragmentCard";

interface V2FragmentsListProps {
  projectId: string;
  onLoadFragment?: (fragmentId: string, fragmentData?: any) => void;
  activeFragmentId?: string;
  onLatestFragmentChange?: (fragment: any) => void;
  onFragmentRefresh?: () => void;
  onRefreshActiveFragment?: () => void;
  isGenerationActive?: boolean;
}

export interface V2FragmentsListRef {
  refresh: () => Promise<any>;
}

export const V2FragmentsList = forwardRef<
  V2FragmentsListRef,
  V2FragmentsListProps
>(function V2FragmentsList(
  {
    projectId,
    onLoadFragment,
    activeFragmentId,
    onLatestFragmentChange,
    onFragmentRefresh,
    onRefreshActiveFragment,
    isGenerationActive = false,
  },
  ref,
) {
  const [loadingFragmentId, setLoadingFragmentId] = useState<string | null>(
    null,
  );
  const [pendingFragmentId, setPendingFragmentId] = useState<string | null>(
    null,
  );
  const [isRefetching, setIsRefetching] = useState(false);

  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const {
    data: fragments,
    isLoading,
    error,
    refetch: refetchFragments,
  } = useQuery(
    trpc.projects.getV2Fragments.queryOptions({
      projectId,
      limit: 20,
    }),
  );

  const handleRefresh = useCallback(async () => {
    console.log(
      "[V2FragmentsList] Refreshing fragments and active fragment info",
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
  }, [onRefreshActiveFragment, refetchFragments]);

  useEffect(() => {
    if (fragments && fragments.length > 0 && onLatestFragmentChange) {
      onLatestFragmentChange(fragments[0]);
    }
  }, [fragments, onLatestFragmentChange]);

  const loadFragmentMutation = useMutation(
    trpc.projects.loadV2Fragment.mutationOptions({
      onSuccess: (result: any) => {
        console.log("Fragment loaded:", result.message);
        onLoadFragment?.(result.fragment.id, result.fragment);
        setLoadingFragmentId(null);

        onFragmentRefresh?.();

        // Invalidate project query to refresh activeFragmentId for green border
        queryClient.invalidateQueries({
          queryKey: trpc.projects.getOne.queryKey({ projectId }),
        });

        queryClient.invalidateQueries({
          queryKey: trpc.projects.checkV2ProjectSandboxHealth.queryKey({
            projectId,
          }),
        });
      },
      onError: (error: any) => {
        console.error("Failed to load fragment:", error);
        setLoadingFragmentId(null);
        setPendingFragmentId(null);
      },
    }),
  );

  const handleLoadFragment = async (fragmentId: string) => {
    setLoadingFragmentId(fragmentId);
    setPendingFragmentId(fragmentId);
    await loadFragmentMutation.mutateAsync({
      fragmentId,
      projectId,
    });
  };

  useEffect(() => {
    if (activeFragmentId && pendingFragmentId === activeFragmentId) {
      setPendingFragmentId(null);
    }
  }, [activeFragmentId, pendingFragmentId]);

  // Expose refresh method to parent via ref
  useImperativeHandle(
    ref,
    () => ({
      refresh: handleRefresh,
    }),
    [handleRefresh],
  );

  const getVersionLabel = (index: number, total: number) => {
    if (index === 0) return "Most Recent Version";
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
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin dark:text-[#B8C9C3]" />
        <span className="text-muted-foreground ml-2 text-sm dark:text-[#B8C9C3]">
          {isLoading ? "Loading versions..." : "Refreshing versions..."}
        </span>
      </div>
    );
  }

  if (!fragments || fragments.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-muted-foreground text-sm dark:text-[#B8C9C3]">
          No versions yet
        </p>
        <p className="text-muted-foreground mt-1 text-xs dark:text-[#B8C9C3]">
          Version history will appear here as you make changes
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {fragments.map((fragment, index) => {
        const isActive = activeFragmentId === fragment.id;
        const isDisabled =
          loadingFragmentId !== null ||
          pendingFragmentId !== null ||
          isRefetching ||
          isGenerationActive;
        const isTransitioning = pendingFragmentId === fragment.id;
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
            isLoading={loadingFragmentId === fragment.id}
            versionLabel={getVersionLabel(index, fragments.length)}
            onRestore={
              !isActive
                ? () => !isDisabled && handleLoadFragment(fragment.id)
                : undefined
            }
            // Snapshot metadata
            hasSnapshot={!!(fragment as any).snapshotImageId}
            snapshotCreatedAt={(fragment as any).snapshotCreatedAt}
            snapshotProvider={(fragment as any).snapshotProvider}
          />
        );
      })}
    </div>
  );
});
