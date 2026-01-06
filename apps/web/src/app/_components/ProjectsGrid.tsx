"use client";

import Image from "next/image";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Project } from "@/lib/db";

const ProjectsGrid = () => {
  const { data: session, status } = useSession();
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Only fetch projects when session is authenticated
  const { data: projects, isLoading: projectsLoading } = useQuery({
    ...trpc.projects.getMany.queryOptions({
      limit: 50,
      offset: 0
    }),
    enabled: status === "authenticated" && !!session
  });

  // Delete project mutation
  const deleteProjectMutation = useMutation(
    trpc.projects.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Project deleted successfully");
        queryClient.invalidateQueries(
          trpc.projects.getMany.queryOptions({
            limit: 50,
            offset: 0
          })
        );
        setSelectedProjects(new Set());
      },
      onError: (error) => {
        toast.error(`Failed to delete project: ${error.message}`);
      }
    })
  );

  // Show loading while session is being determined or projects are loading
  if (status === "loading" || !session || projectsLoading) {
    return <LoadingSpinner />;
  }

  const handleProjectSelection = (projectId: string) => {
    const newSelection = new Set(selectedProjects);
    if (newSelection.has(projectId)) {
      newSelection.delete(projectId);
    } else {
      newSelection.add(projectId);
    }
    setSelectedProjects(newSelection);
  };

  const handleProjectClick = (projectId: string) => {
    router.push(`/projects/${projectId}`);
  };

  const handleDeleteSelected = async () => {
    if (selectedProjects.size === 0) return;

    const confirmDelete = window.confirm(
      `Are you sure you want to delete ${selectedProjects.size} project(s)? This action cannot be undone.`
    );

    if (!confirmDelete) return;

    // Delete projects one by one
    // Delete projects in parallel
    const deletionPromises = Array.from(selectedProjects).map(projectId =>
      deleteProjectMutation.mutateAsync({ projectId })
        .catch(error => {
          console.error(`Failed to delete project ${projectId}:`, error);
          toast.error(`Failed to delete project: ${error.message}`);
          return null;
        })
    );

    await Promise.all(deletionPromises);
  };

  const formatDate = (date: string | Date) => {
    return format(new Date(date), 'MMM d, yyyy');
  };

  return (
    <div className="space-y-6 mt-4">
      {/* Header with delete button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Projects</h2>
          <p className="text-gray-600">
            {projects?.length || 0} project(s) found
          </p>
        </div>

        {selectedProjects.size > 0 && (
          <Button
            variant="destructive"
            onClick={handleDeleteSelected}
            disabled={deleteProjectMutation.isPending}
            className="flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete {selectedProjects.size} selected
          </Button>
        )}
      </div>

      {/* Projects Grid */}
      {projects && projects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 ">
          {projects.map((project: Project) => (
            <Card
              key={project.id}
              className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${selectedProjects.has(project.id)
                  ? 'ring-2 ring-blue-500 bg-blue-50'
                  : 'hover:shadow-md'
                }`}
              onClick={() => handleProjectClick(project.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {(project as any).logo && (
                      <div className="w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center">
                        {(project as any).logo.startsWith("data:image") ? (
                          <Image
                            src={(project as any).logo}
                            alt={`${project.name} logo`}
                            width={48}
                            height={48}
                            className="object-cover"
                          />
                        ) : (
                          <span className="text-2xl">{(project as any).logo}</span>
                        )}
                      </div>
                    )}
                    <div className="flex flex-col min-w-0 flex-1">
                      <CardTitle className="text-lg font-semibold truncate" title={project.name}>
                        {project.name}
                      </CardTitle>
                      {(project as any).subtitle && (
                        <p className="text-sm text-muted-foreground truncate mt-1">
                          {(project as any).subtitle}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-1 flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={selectedProjects.has(project.id)}
                      onChange={() => handleProjectSelection(project.id)}
                      className="w-4 h-4 text-blue-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleProjectSelection(project.id);
                      }}
                    />
                  </div>
                </div>

                {(project as any).team && (
                  <Badge variant={(project as any).team.isPersonal ? "secondary" : "default"} className="w-fit mt-2">
                    {(project as any).team.name}
                  </Badge>
                )}
              </CardHeader>

              <CardContent className="pt-0">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <MessageSquare className="w-4 h-4" />
                    <span>{(project as any)._count?.messages || 0} messages</span>
                  </div>
                  <span>{formatDate(project.updatedAt)}</span>
                </div>

                <div className="mt-3 text-xs text-gray-500">
                  Created: {formatDate(project.createdAt)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <div className="text-gray-400">
            <MessageSquare className="w-16 h-16 mx-auto" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-medium text-gray-900">No projects found</h3>
            <p className="text-gray-500">Create your first project to get started</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectsGrid;