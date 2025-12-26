"use client";

import { useState, useMemo } from "react";
import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import {
  RocketIcon,
  ExternalLinkIcon,
  EyeIcon,
  EyeOffIcon,
  Trash2Icon,
  SearchIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Loader2Icon,
  CheckCircleIcon,
  XCircleIcon,
  CopyIcon,
  AlertCircleIcon,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function AdminDeploymentsPage() {
  const router = useRouter();
  const trpc = useTRPC();

  // State for pagination and filters
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [publishedFilter, setPublishedFilter] = useState<"ALL" | "PUBLISHED" | "UNPUBLISHED">("ALL");
  const [deploymentToDelete, setDeploymentToDelete] = useState<string | null>(null);

  // Query for deployments
  const { data, isLoading, error, refetch } = useQuery({
    ...trpc.admin.getAllDeployments.queryOptions({
      page,
      limit: 20,
      search,
      publishedFilter,
    }),
  });

  // Mutations
  const togglePublishedMutation = useMutation(
    trpc.admin.toggleDeploymentPublished.mutationOptions({
      onSuccess: (result) => {
        toast.success(result.message);
        refetch();
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update deployment");
      },
    })
  );

  const deleteDeploymentMutation = useMutation(
    trpc.admin.deleteDeployment.mutationOptions({
      onSuccess: (result) => {
        toast.success(result.message);
        setDeploymentToDelete(null);
        refetch();
      },
      onError: (error) => {
        toast.error(error.message || "Failed to delete deployment");
      },
    })
  );

  // Handle search with debouncing
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1); // Reset to first page on search
  };

  // Handle URL copy
  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("URL copied to clipboard");
    } catch (error) {
      toast.error("Failed to copy URL");
    }
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const deployments = data?.deployments || [];
  const pagination = data?.pagination;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8">
        <AlertCircleIcon className="h-12 w-12 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Error Loading Deployments</h1>
        <p className="text-muted-foreground mb-4">{error.message}</p>
        <Button onClick={() => router.push("/admin/dashboard")}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <Link href="/admin/dashboard" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
          <ChevronLeftIcon className="h-4 w-4 mr-1" />
          Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <RocketIcon className="h-8 w-8" />
          Deployments Management
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage all deployments across the platform
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by name, app ID, project ID, or URL..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={publishedFilter} onValueChange={(value: any) => {
          setPublishedFilter(value);
          setPage(1);
        }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Deployments</SelectItem>
            <SelectItem value="PUBLISHED">Published Only</SelectItem>
            <SelectItem value="UNPUBLISHED">Unpublished Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      {pagination && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-card p-4 rounded-lg border">
            <div className="text-sm text-muted-foreground">Total Deployments</div>
            <div className="text-2xl font-bold">{pagination.totalCount}</div>
          </div>
          <div className="bg-card p-4 rounded-lg border">
            <div className="text-sm text-muted-foreground">Published</div>
            <div className="text-2xl font-bold text-green-600">
              {deployments.filter(d => d.published).length}
            </div>
          </div>
          <div className="bg-card p-4 rounded-lg border">
            <div className="text-sm text-muted-foreground">Unpublished</div>
            <div className="text-2xl font-bold text-gray-500">
              {deployments.filter(d => !d.published).length}
            </div>
          </div>
        </div>
      )}

      {/* Deployments Table */}
      <div className="bg-card rounded-lg border">
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2Icon className="h-8 w-8 animate-spin" />
          </div>
        ) : deployments.length === 0 ? (
          <div className="p-8 text-center">
            <RocketIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No deployments found</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>App Name</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>URL</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deployments.map((deployment) => (
                <TableRow key={deployment.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{deployment.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {deployment.appId}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {deployment.project ? (
                      <Link
                        href={`/projects/${deployment.project.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {deployment.project.name || "Untitled"}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {deployment.user ? (
                      <div>
                        <div className="text-sm">{deployment.user.name || "Unknown"}</div>
                        <div className="text-xs text-muted-foreground">
                          {deployment.user.email}
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {deployment.published ? (
                      <Badge variant="default" className="bg-green-500">
                        <CheckCircleIcon className="h-3 w-3 mr-1" />
                        Published
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <XCircleIcon className="h-3 w-3 mr-1" />
                        Unpublished
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {format(new Date(deployment.createdAt), "MMM d, yyyy")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(deployment.createdAt), "h:mm a")}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <span className="text-xs truncate max-w-[150px]" title={deployment.url}>
                        {deployment.url.replace(/^https?:\/\//, "")}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => handleCopyUrl(deployment.url)}
                      >
                        <CopyIcon className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {deployment.published && (
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                        >
                          <a
                            href={deployment.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="View Live"
                          >
                            <ExternalLinkIcon className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => togglePublishedMutation.mutate({ deploymentId: deployment.id })}
                        disabled={togglePublishedMutation.isPending}
                        title={deployment.published ? "Unpublish" : "Publish"}
                      >
                        {deployment.published ? (
                          <EyeOffIcon className="h-4 w-4" />
                        ) : (
                          <EyeIcon className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeploymentToDelete(deployment.id)}
                        title="Delete"
                      >
                        <Trash2Icon className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <div className="text-sm text-muted-foreground">
            Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, pagination.totalCount)} of {pagination.totalCount} deployments
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={!pagination.hasPreviousPage}
            >
              <ChevronLeftIcon className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <div className="text-sm">
              Page {page} of {pagination.totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={!pagination.hasNextPage}
            >
              Next
              <ChevronRightIcon className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deploymentToDelete} onOpenChange={() => setDeploymentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Deployment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this deployment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deploymentToDelete) {
                  deleteDeploymentMutation.mutate({ deploymentId: deploymentToDelete });
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}