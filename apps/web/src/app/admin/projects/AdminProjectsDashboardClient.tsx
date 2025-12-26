"use client";
import { useState, useEffect, useMemo } from "react";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { MessageSquare, Sparkles, Users, FolderOpen,Gem } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

interface ProjectData {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  user: {
    name: string | null;
    email: string;
  };
  _count: {
    messages: number;
    halChatMessages: number;
  };
  stats?: {
    transactions: {
      creditsUsed: number;
    };
  };
 
  latestMessage?: {
    content: string;
    createdAt: Date;
  };
}

export default function AdminProjectsDashboardClient() {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "messages" | "advisor">(
    "recent",
  );
  const trpc = useTRPC();

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset to first page when sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [sortBy]);

  // Fetch projects with pagination
  const {
    data: projectsData,
    refetch: fetchProjects,
    isLoading,
    error,
  } = useQuery(
    trpc.admin.getAllProjects.queryOptions({
      page: currentPage,
      limit: 20,
      search: debouncedSearch || undefined,
      sortBy,
    }),
  );

  // Fetch stats
  const {
    data: statsData,
    refetch: fetchStats,
    isLoading: statsLoading,
  } = useQuery(trpc.admin.getProjectStats.queryOptions());

  if (error) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="text-center text-red-600">
          <div className="text-xl font-semibold mb-4">
            ❌ Error loading projects
          </div>
          <div className="text-sm">{error.message}</div>
          <button
            onClick={() => fetchProjects()}
            className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            🔄 Retry
          </button>
        </div>
      </div>
    );
  }

  const projects = (projectsData?.projects || []) as ProjectData[];
  const stats = statsData;
  console.log("Projects Data:", projectsData);
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">📁 Projects Dashboard</h1>
            <p className="text-gray-600">
              View all projects, messages, and advisor interactions
            </p>
          </div>
          <Link href="/admin/dashboard">
            <Button variant="outline" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              User Dashboard
            </Button>
          </Link>
        </div>
        <div className="mt-4 flex gap-4 items-center flex-wrap">
          <div className="flex-1 min-w-[300px]">
            <Input
              type="text"
              placeholder="Search projects by name, user, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="min-w-[180px]">
            <Select value={sortBy} onValueChange={(val: any) => setSortBy(val)}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Recently Updated</SelectItem>
                <SelectItem value="messages">Most Messages</SelectItem>
                <SelectItem value="advisor">Most Advisor Chats</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <button
            onClick={() => {
              fetchProjects();
              fetchStats();
            }}
            className="bg-blue-500 text-black px-4 py-2 rounded hover:bg-blue-600 text-sm"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 dark:bg-blue-950/50 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
          <h3 className="font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            Total Projects
          </h3>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {statsLoading ? (
              <div className="animate-pulse bg-blue-200 dark:bg-blue-800 h-8 w-16 rounded"></div>
            ) : (
              stats?.totalProjects || 0
            )}
          </div>
        </div>
        <div className="bg-green-50 dark:bg-green-950/50 p-4 rounded-lg border border-green-200 dark:border-green-800">
          <h3 className="font-semibold text-green-800 dark:text-green-300 flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Total Messages
          </h3>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {statsLoading ? (
              <div className="animate-pulse bg-green-200 dark:bg-green-800 h-8 w-16 rounded"></div>
            ) : (
              stats?.totalMessages || 0
            )}
          </div>
        </div>
        <div className="bg-purple-50 dark:bg-purple-950/50 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
          <h3 className="font-semibold text-purple-800 dark:text-purple-300 flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Advisor Chats
          </h3>
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {statsLoading ? (
              <div className="animate-pulse bg-purple-200 dark:bg-purple-800 h-8 w-16 rounded"></div>
            ) : (
              stats?.totalHalMessages || 0
            )}
          </div>
        </div>
        <div className="bg-orange-50 dark:bg-orange-950/50 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
          <h3 className="font-semibold text-orange-800 dark:text-orange-300 flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Suggestions
          </h3>
          <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
            {statsLoading ? (
              <div className="animate-pulse bg-orange-200 dark:bg-orange-800 h-8 w-16 rounded"></div>
            ) : (
              stats?.totalSuggestions || 0
            )}
          </div>
        </div>
      </div>

      {/* Projects Table */}
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow border border-gray-200 dark:border-gray-800 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">
              Loading projects...
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Project
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Owner
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Credits
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Messages
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Advisor
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Last Update
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {projects.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <div className="text-gray-500 dark:text-gray-400">
                        <div className="text-lg font-medium mb-2">
                          No projects found
                        </div>
                        <div className="text-sm">
                          {debouncedSearch
                            ? `No projects match the search: "${debouncedSearch}"`
                            : "No projects in the system yet"}
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  projects.map((project: ProjectData) => (
                    <tr
                      key={project.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            {project.name}
                          </div>
                          <div className="text-xs text-gray-400 dark:text-gray-500">
                            ID: {project.id.slice(-8)}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {project.user.name || "Unknown"}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {project.user.email}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className="flex items-center gap-1 w-fit"
                        >
                        <Gem className="w-3 h-3" /> {project?.stats?.transactions?.creditsUsed || 0}
                          
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className="flex items-center gap-1 w-fit"
                        >
                          <MessageSquare className="h-3 w-3" />
                          {project._count.messages}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className="flex items-center gap-1 w-fit"
                        >
                          <Sparkles className="h-3 w-3" />
                          {project._count.halChatMessages}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(project.updatedAt).toLocaleDateString()}
                    </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Link
                            href={`/admin/projects/${project.id}`}
                          >
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs"
                            >
                              View Details
                            </Button>
                          </Link>
                          <Link
                            href={`/admin/dashboard/${project.userId}`}
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs"
                            >
                              View Owner
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {!isLoading && projectsData && projectsData.totalPages > 1 && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Showing {(currentPage - 1) * 20 + 1} to{" "}
                {Math.min(currentPage * 20, projectsData.total)} of{" "}
                {projectsData.total} projects
                {debouncedSearch && (
                  <span className="ml-2 text-blue-600 dark:text-blue-400">
                    (search: &quot;{debouncedSearch}&quot;)
                  </span>
                )}
              </div>
              <Pagination>
                <PaginationContent>
                  {projectsData.hasPreviousPage && (
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setCurrentPage(currentPage - 1);
                        }}
                      />
                    </PaginationItem>
                  )}

                  {/* Page numbers */}
                  {Array.from(
                    { length: Math.min(5, projectsData.totalPages) },
                    (_, i) => {
                      let pageNumber;
                      if (projectsData.totalPages <= 5) {
                        pageNumber = i + 1;
                      } else {
                        if (currentPage <= 3) {
                          pageNumber = i + 1;
                        } else if (currentPage >= projectsData.totalPages - 2) {
                          pageNumber = projectsData.totalPages - 4 + i;
                        } else {
                          pageNumber = currentPage - 2 + i;
                        }
                      }

                      return (
                        <PaginationItem key={pageNumber}>
                          <PaginationLink
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              setCurrentPage(pageNumber);
                            }}
                            isActive={currentPage === pageNumber}
                          >
                            {pageNumber}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    },
                  )}

                  {projectsData.totalPages > 5 &&
                    currentPage < projectsData.totalPages - 2 && (
                      <>
                        <PaginationItem>
                          <PaginationEllipsis />
                        </PaginationItem>
                        <PaginationItem>
                          <PaginationLink
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              setCurrentPage(projectsData.totalPages);
                            }}
                          >
                            {projectsData.totalPages}
                          </PaginationLink>
                        </PaginationItem>
                      </>
                    )}

                  {projectsData.hasNextPage && (
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setCurrentPage(currentPage + 1);
                        }}
                      />
                    </PaginationItem>
                  )}
                </PaginationContent>
              </Pagination>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
