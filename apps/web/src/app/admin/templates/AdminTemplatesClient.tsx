"use client";

import { useState, useEffect } from "react";
import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import {
  Sparkles,
  Eye,
  EyeOff,
  Trash2,
  Edit,
  Plus,
  RefreshCw,
  Search,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { formatNumber } from "@/modules/templates/lib/utils";
import Link from "next/link";

export default function AdminTemplatesClient() {
  const trpc = useTRPC();
  const [filter, setFilter] = useState<
    "all" | "published" | "unpublished" | "featured"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);
  const ITEMS_PER_PAGE = 20;

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1); // Reset to first page when search changes
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset to first page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  // Fetch templates
  const { data, isLoading, refetch } = useQuery(
    trpc.templates.getAllAdmin.queryOptions({
      limit: ITEMS_PER_PAGE,
      offset: (currentPage - 1) * ITEMS_PER_PAGE,
      filter,
      search: debouncedSearch || undefined,
    }),
  );

  // Delete mutation
  const deleteMutation = useMutation(
    trpc.templates.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Template deleted successfully");
        refetch();
        setDeleteDialogOpen(false);
        setTemplateToDelete(null);
      },
      onError: (error) => {
        toast.error(`Failed to delete: ${error.message}`);
      },
    }),
  );

  // Toggle featured mutation
  const toggleFeaturedMutation = useMutation(
    trpc.templates.setFeatured.mutationOptions({
      onSuccess: () => {
        toast.success("Featured status updated");
        refetch();
      },
      onError: (error) => {
        toast.error(`Failed to update: ${error.message}`);
      },
    }),
  );

  // Toggle published mutation
  const togglePublishedMutation = useMutation(
    trpc.templates.setPublished.mutationOptions({
      onSuccess: () => {
        toast.success("Published status updated");
        refetch();
      },
      onError: (error) => {
        toast.error(`Failed to update: ${error.message}`);
      },
    }),
  );

  const templates = data?.templates || [];
  const totalCount = data?.pagination.total || 0;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const handleDelete = (templateId: string) => {
    setTemplateToDelete(templateId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (templateToDelete) {
      deleteMutation.mutate({ templateId: templateToDelete });
    }
  };

  return (
    <div className="container mx-auto p-8">
      <div className="mb-6">
        <Button
          variant="ghost"
          asChild
          className="pl-0 hover:bg-transparent text-muted-foreground hover:text-foreground"
        >
          <Link href="/admin/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
      </div>

      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Template Management</h1>
          <p className="text-muted-foreground">
            Manage community templates and promotions
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/templates/create">
            <Plus className="mr-2 h-4 w-4" />
            Create Template
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-4">
        <div className="relative min-w-[200px] flex-1">
          <Search className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={filter} onValueChange={(value: any) => setFilter(value)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Templates</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="unpublished">Unpublished</SelectItem>
            <SelectItem value="featured">Featured</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-card rounded-lg border p-4">
          <p className="text-muted-foreground text-sm">Total Templates</p>
          <p className="text-2xl font-bold">{totalCount}</p>
        </div>
        {/* Note: These stats might be inaccurate if we only have one page of data. 
            The original code calculated them from `templates` which was just one page (limit 50).
            Ideally the backend should return these stats. 
            For now, I'll keep it as is, but acknowledge it only counts the current page's items for status counts.
            Actually, `totalCount` comes from backend now. 
            But "Published" and "Featured" counts below are derived from `templates` array, so they are only for the current page.
            This is a limitation of the current backend API, but I'll leave it as is to minimize scope creep unless requested.
        */}
        <div className="bg-card rounded-lg border p-4">
          <p className="text-muted-foreground text-sm">Published (Page)</p>
          <p className="text-2xl font-bold">
            {templates.filter((t) => t.published).length}
          </p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <p className="text-muted-foreground text-sm">Featured (Page)</p>
          <p className="text-2xl font-bold">
            {templates.filter((t) => t.featured).length}
          </p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <p className="text-muted-foreground text-sm">Remixes (Page)</p>
          <p className="text-2xl font-bold">
            {templates.reduce((sum, t) => sum + t.remixCount, 0)}
          </p>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="text-muted-foreground h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="bg-card rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Remixes</TableHead>
                <TableHead className="text-center">Likes</TableHead>
                <TableHead className="text-center">Views</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-muted-foreground py-8 text-center"
                  >
                    No templates found
                  </TableCell>
                </TableRow>
              ) : (
                templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{template.logo}</span>
                        <div>
                          <div className="font-medium">{template.name}</div>
                          <div className="text-muted-foreground line-clamp-1 text-xs">
                            {template.shortDescription}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {template.category && (
                        <Badge variant="outline">
                          {template.category.icon} {template.category.name}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {template.published ? (
                          <Badge variant="default" className="text-xs">
                            Published
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Draft
                          </Badge>
                        )}
                        {template.featured && (
                          <Badge className="bg-yellow-500 text-xs text-white">
                            <Sparkles className="mr-1 h-3 w-3" />
                            Featured
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(template.remixCount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(template.likeCount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(template.viewCount || 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {/* Toggle Featured */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            toggleFeaturedMutation.mutate({
                              templateId: template.id,
                              featured: !template.featured,
                            })
                          }
                          disabled={toggleFeaturedMutation.isPending}
                          title={template.featured ? "Unfeature" : "Feature"}
                        >
                          <Sparkles
                            className={`h-4 w-4 ${
                              template.featured
                                ? "fill-yellow-500 text-yellow-500"
                                : ""
                            }`}
                          />
                        </Button>

                        {/* Toggle Published */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            togglePublishedMutation.mutate({
                              templateId: template.id,
                              published: !template.published,
                            })
                          }
                          disabled={togglePublishedMutation.isPending}
                          title={template.published ? "Unpublish" : "Publish"}
                        >
                          {template.published ? (
                            <Eye className="h-4 w-4" />
                          ) : (
                            <EyeOff className="h-4 w-4" />
                          )}
                        </Button>

                        {/* Edit */}
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/admin/templates/${template.id}/edit`}>
                            <Edit className="h-4 w-4" />
                          </Link>
                        </Button>

                        {/* Delete */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(template.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination Controls */}
      {!isLoading && totalPages > 1 && (
        <div className="border-t border-gray-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm text-gray-600">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
              {Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} of{" "}
              {totalCount} templates
            </div>
            <Pagination>
              <PaginationContent>
                {currentPage > 1 && (
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
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNumber;
                  if (totalPages <= 5) {
                    pageNumber = i + 1;
                  } else {
                    // Smart pagination logic
                    if (currentPage <= 3) {
                      pageNumber = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNumber = totalPages - 4 + i;
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
                })}

                {totalPages > 5 && currentPage < totalPages - 2 && (
                  <>
                    <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationLink
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setCurrentPage(totalPages);
                        }}
                      >
                        {totalPages}
                      </PaginationLink>
                    </PaginationItem>
                  </>
                )}

                {currentPage < totalPages && (
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template?</DialogTitle>
            <DialogDescription>
              This will permanently delete the template and all associated data
              (likes, comments, saves). This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
