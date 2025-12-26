"use client";

import { useState } from "react";
import { Session } from "next-auth";
import { useRouter } from "nextjs-toploader/app";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Trash2,
  MessageCircleMore,
  Plus,
  FileText,
  PencilLine,
  Minus,
} from "lucide-react";
import { toast } from "sonner";
import { usePaginatedProjects } from "@/hooks/usePaginatedProjects";
import { deslugifyProjectName } from "@/lib/project-namer";
import { NoCreditsPrompt } from "@/components/NoCreditsPrompt";

interface Project {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    messages: number;
    v2Messages?: number;
  };
  subtitle?: string;
  logo?: string;
}

interface OptimizedProjectsGridProps {
  session: Session;
  initialProjects: Project[];
  hasActiveSubscription: boolean;
  isAdmin: boolean;
}

const OptimizedProjectsGrid = ({
  session,
  initialProjects,
  hasActiveSubscription,
  isAdmin,
}: OptimizedProjectsGridProps) => {
  const EMOJIS = [
    "🦊",
    "🏀",
    "🌟",
    "🚀",
    "🎨",
    "💡",
    "📱",
    "🌈",
    "🔥",
    "✨",
    "🐙",
    "🧩",
  ];

  const getEmojiForProject = (id: string) => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
    }
    return EMOJIS[hash % EMOJIS.length];
  };

  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(
    new Set(),
  );
  const router = useRouter();
  const trpc = useTRPC();

  // Get user credits
  const { data: creditsData } = useQuery(
    trpc.projects.getUserCredits.queryOptions(),
  );

  // Check if user has credit balance
  const hasCreditBalance = (creditsData?.creditBalance ?? 0) > 0;

  const {
    allLoadedProjects,
    isLoadingMore,
    hasMoreProjects,
    isRebuilding,
    rebuildSkeletons,
    projectsPerPage,
    handleShowMore,
    rebuildPages,
    updateProjectsAfterDeletion,
  } = usePaginatedProjects({
    initialProjects,
    projectsPerPage: 6,
  });

  const [showAll, setShowAll] = useState(false);
  const visibleProjects = showAll
    ? allLoadedProjects
    : allLoadedProjects.slice(0, 6);

  // Create skeleton cards for loading state with dynamic count
  const renderSkeletonCards = (count: number) =>
    Array.from({ length: count }, (_, i) => (
      <Card key={`skeleton-${i}`} className="animate-pulse opacity-60">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="mr-4 h-4 flex-1 rounded bg-[#E5E3E0] dark:bg-[#3D4A45]"></div>
          <div className="h-5 w-5 rounded bg-[#E5E3E0] dark:bg-[#3D4A45]"></div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-xs">
            <div className="h-3 w-20 rounded bg-[#E5E3E0] dark:bg-[#3D4A45]"></div>
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded bg-[#E5E3E0] dark:bg-[#3D4A45]"></div>
              <div className="h-3 w-4 rounded bg-[#E5E3E0] dark:bg-[#3D4A45]"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    ));

  // Delete project mutation
  const deleteProjectMutation = useMutation(
    trpc.projects.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Project deleted successfully");
        // No broad invalidation here; we'll refetch precise pages below
      },
      onError: (error) => {
        toast.error(`Failed to delete project: ${error.message}`);
      },
    }),
  );

  const handleProjectSelection = (projectId: string) => {
    const newSelection = new Set(selectedProjects);
    if (newSelection.has(projectId)) {
      newSelection.delete(projectId);
    } else {
      newSelection.add(projectId);
    }
    setSelectedProjects(newSelection);
  };

  // const handleProjectClick = (projectId: string) => {
  //   router.push(`/projects/${projectId}`);
  // };

  const handleDeleteSelected = async () => {
    if (selectedProjects.size === 0) return;

    const confirmDelete = window.confirm(
      `Are you sure you want to delete ${selectedProjects.size} project(s)? This action cannot be undone.`,
    );

    if (!confirmDelete) return;

    const idsToDelete = Array.from(selectedProjects);

    // Optimistically remove from local state immediately
    updateProjectsAfterDeletion(idsToDelete);
    setSelectedProjects(new Set());

    // Delete projects in parallel
    await Promise.all(
      idsToDelete.map(async (projectId) => {
        try {
          await deleteProjectMutation.mutateAsync({ projectId });
        } catch (error) {
          console.error(`Failed to delete project ${projectId}:`, error);
          toast.error(`Failed to delete project`);
        }
      }),
    );

    // Regardless of success/failure, rebuild from server truth
    await rebuildPages();
  };

  const formatDate = (date: string | Date) => {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  };

  // Don't show anything if no projects at all (new user)
  if (!initialProjects || initialProjects.length === 0) {
    return null;
  }

  // Only show NoCreditsPrompt if user has projects but no active subscription
  // Exception: Admins and users with credit balance can still access
  // (This means they had a subscription before but it expired)
  if (
    !hasActiveSubscription &&
    !isAdmin &&
    !hasCreditBalance &&
    initialProjects.length > 0
  ) {
    return (
      <NoCreditsPrompt
        variant="section"
        description="Please renew your subscription to view and access your projects."
      />
    );
  }

  return (
    <>
      <div className="mt-3 space-y-6 bg-white dark:bg-background px-4 md:px-16 py-12 rounded-3xl">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="inline-flex h-7 w-[89px] items-center justify-center gap-2 rounded-md border border-gray-300 dark:border-[#232D29] bg-white dark:bg-[#313C38] text-xs font-medium text-gray-500 dark:text-gray-200">
            <FileText className="h-3.5 w-3.5" />
            Projects
          </div>
          <div className="flex w-full flex-col items-center gap-3">
            <h2 className="text-center text-3xl font-semibold text-[#111625] dark:text-white md:text-4xl">
              Your Projects
            </h2>
            {selectedProjects.size > 0 && (
              <Button
                variant="destructive"
                onClick={handleDeleteSelected}
                disabled={deleteProjectMutation.isPending}
                className="flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Delete {selectedProjects.size} project
                {selectedProjects.size > 1 ? "s" : ""}
              </Button>
            )}
          </div>
        </div>

        {/* Projects Grid */}
        <div
          key={showAll ? "expanded" : "collapsed"}
          className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
          style={{
            animation: showAll
              ? "fadeIn 240ms ease"
              : "fadeCollapse 220ms ease",
          }}
        >
          {visibleProjects.map((project) => {
            const messageCount =
              project._count.messages + (project._count.v2Messages || 0);
            const emoji = getEmojiForProject(project.id);
            const displayLogo = (project as any).logo || emoji;
            const subtitle =
              (project as any).subtitle ||
              "Bring your idea to life with Shipper.";

            return (
              <Card
                key={project.id}
                className={`flex h-[146px] cursor-pointer flex-col gap-1 rounded-[16px] border border-transparent bg-[#F3F3EE] p-2 dark:bg-[#313C38] shadow-none transition-transform duration-200 hover:-translate-y-px ${selectedProjects.has(project.id)
                  ? "ring-2 ring-blue-500 ring-offset-2 dark:ring-emerald-400 dark:ring-offset-slate-950"
                  : "ring-offset-0"
                  }`}
                style={{ animation: "fadeIn 240ms ease" }}
                onClick={() => router.push(`/projects/${project.id}`)}
              >
                {/* Header: 8px padding, gap-4 (16px) - matches Figma "Notification Setting Header" */}
                <CardHeader className="flex flex-1 flex-row items-start justify-between gap-4 p-2">
                  {/* Emoji + Text container: gap-3 (12px) */}
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    {/* Emoji: 32x32 */}
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center text-xl">
                      {displayLogo}
                    </div>
                    {/* Text container: gap-0.5 (2px) */}
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      {/* Title: font-medium (500), 16px, line-height 24px, #141414 */}
                      <CardTitle className="truncate text-base font-medium leading-6 text-[#141414] dark:text-white">
                        {deslugifyProjectName(project.name) ||
                          "Untitled Project"}
                      </CardTitle>
                      {/* Description: font-normal (400), 14px, line-height 20px, #727272 */}
                      <p
                        className="line-clamp-2 text-sm font-normal leading-5 text-[#727272] dark:text-gray-300"
                        title={subtitle}
                      >
                        {subtitle}
                      </p>
                    </div>
                  </div>
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-transparent transition-colors hover:border-gray-300"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleProjectSelection(project.id);
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedProjects.has(project.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleProjectSelection(project.id);
                      }}
                      className="h-4 w-4"
                    />
                  </div>
                </CardHeader>
                {/* Inner card: no extra padding (card already has p-2) */}
                <CardContent className="mt-auto p-0">
                  {/* Inner card: 44px height, 12px padding, 12px radius, shadow */}
                  <div
                    className="flex h-[44px] items-center justify-between rounded-[12px] bg-white px-3 text-sm dark:bg-[#111816]"
                    style={{ boxShadow: "0px 1px 1.5px rgba(44, 54, 53, 0.025)" }}
                  >
                    {/* Left side: gap-1.5 (6px) */}
                    <div className="flex items-center gap-1.5 text-[#727272] dark:text-gray-400">
                      <PencilLine className="h-4 w-4" />
                      <span className="text-sm font-normal leading-5 text-[#727272] dark:text-gray-300">
                        Edited {formatDate(project.updatedAt)}
                      </span>
                    </div>
                    {/* Right side: gap-1.5 (6px) */}
                    <div className="flex items-center gap-1.5 text-[#727272] dark:text-gray-200">
                      <MessageCircleMore className="h-4 w-4" />
                      <span className="text-sm font-normal leading-5">{messageCount}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Deletion-refill skeletons: exactly as many as needed to fill the grid */}
          {isRebuilding &&
            rebuildSkeletons > 0 &&
            renderSkeletonCards(rebuildSkeletons)}

          {/* Loading skeleton cards when showing more pages */}
          {isLoadingMore && renderSkeletonCards(projectsPerPage)}
        </div>

        {/* Show More Button */}
        {(allLoadedProjects.length > 6 || hasMoreProjects) && (
          <div className="mt-6 flex justify-center">
            <Button
              variant="outline"
              onClick={() => {
                if (showAll) {
                  setShowAll(false);
                } else {
                  handleShowMore();
                  setShowAll(true);
                }
              }}
              disabled={isLoadingMore}
              className="flex h-9 w-[190px] items-center gap-2 rounded-lg border border-[#1E9A80] dark:border-emerald-400 bg-white dark:bg-background text-[#1E9A80] dark:text-emerald-300 shadow-none transition-all hover:bg-[#F8F6F3] dark:hover:bg-slate-800"
            >
              {isLoadingMore ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#1E9A80]/60 border-t-[#1E9A80]"></div>
                  Loading...
                </>
              ) : (
                <>
                  {showAll ? (
                    <>
                      <Minus className="h-5 w-5" />
                      Show fewer Projects
                    </>
                  ) : (
                    <>
                      <Plus className="h-5 w-5" />
                      Show more Projects
                    </>
                  )}
                </>
              )}
            </Button>
          </div>
        )}
      </div>
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fadeCollapse {
          from {
            opacity: 0.9;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
};

export default OptimizedProjectsGrid;
