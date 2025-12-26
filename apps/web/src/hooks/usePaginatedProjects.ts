"use client";

import { useState, useMemo, useEffect } from "react";
import { useTRPC } from "@/trpc/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface Project {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    messages: number;
    v2Messages?: number;
  };
}

interface UsePaginatedProjectsOptions {
  initialProjects: Project[];
  projectsPerPage?: number;
}

export const usePaginatedProjects = ({
  initialProjects,
  projectsPerPage = 6,
}: UsePaginatedProjectsOptions) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [allLoadedProjects, setAllLoadedProjects] =
    useState<Project[]>(initialProjects);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [rebuildSkeletons, setRebuildSkeletons] = useState(0);

  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Load additional projects when showing more
  const { data: additionalProjects, isLoading: isLoadingMore } = useQuery({
    ...trpc.projects.getMany.queryOptions({
      limit: projectsPerPage,
      offset: (currentPage - 1) * projectsPerPage,
    }),
    enabled: currentPage > 1,
  });

  // Update accumulated projects when new data arrives
  useEffect(() => {
    if (currentPage > 1 && additionalProjects) {
      setAllLoadedProjects((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const newProjects = additionalProjects.filter(
          (p) => !existingIds.has(p.id)
        );
        return [...prev, ...newProjects];
      });
    }
  }, [additionalProjects, currentPage]);

  // Check if there might be more projects
  const hasMoreProjects = useMemo(() => {
    if (currentPage === 1) {
      return initialProjects.length === projectsPerPage;
    }
    return additionalProjects && additionalProjects.length === projectsPerPage;
  }, [
    currentPage,
    initialProjects.length,
    additionalProjects,
    projectsPerPage,
  ]);

  const handleShowMore = () => {
    setCurrentPage((prev) => prev + 1);
  };

  // Rebuild the grid by refetching pages 1..currentPage and replacing local state
  const rebuildPages = async () => {
    try {
      const pagePromises = Array.from({ length: currentPage }, (_, idx) =>
        queryClient.fetchQuery(
          trpc.projects.getMany.queryOptions({
            limit: projectsPerPage,
            offset: idx * projectsPerPage,
          })
        )
      );

      const pages = await Promise.all(pagePromises);
      const flat = pages.flat();

      // Ensure uniqueness by id and preserve order
      const seen = new Set<string>();
      const uniqueOrdered: Project[] = [];
      for (const p of flat) {
        if (!seen.has(p.id)) {
          seen.add(p.id);
          uniqueOrdered.push(p as Project);
        }
      }

      setAllLoadedProjects(uniqueOrdered);
    } finally {
      setIsRebuilding(false);
      setRebuildSkeletons(0);
    }
  };

  const updateProjectsAfterDeletion = (deletedIds: string[]) => {
    const afterOptimistic = allLoadedProjects.filter(
      (p) => !deletedIds.includes(p.id)
    );
    setAllLoadedProjects(afterOptimistic);

    // Show skeletons equal to how many we expect to refill
    const targetCount = currentPage * projectsPerPage;
    const needed = Math.max(0, targetCount - afterOptimistic.length);
    if (needed > 0) {
      setIsRebuilding(true);
      setRebuildSkeletons(needed);
    }
  };

  return {
    allLoadedProjects,
    currentPage,
    isLoadingMore,
    hasMoreProjects,
    isRebuilding,
    rebuildSkeletons,
    projectsPerPage,
    handleShowMore,
    rebuildPages,
    updateProjectsAfterDeletion,
  };
};
