"use client";

import { useState, useEffect } from "react";
import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Plus, X, Edit, Trash2, Settings } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function CreateTemplateClient() {
  const trpc = useTRPC();
  const router = useRouter();

  // Form state
  const [sourceProjectId, setSourceProjectId] = useState("");
  const [sourceFragmentId, setSourceFragmentId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [featured, setFeatured] = useState(false);
  const [published, setPublished] = useState(true);
  const [includeChatHistory, setIncludeChatHistory] = useState(true);
  const [price, setPrice] = useState(0);

  // Create category dialog state
  const [createCategoryDialogOpen, setCreateCategoryDialogOpen] =
    useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategorySlug, setNewCategorySlug] = useState("");
  const [newCategoryDescription, setNewCategoryDescription] = useState("");
  const [newCategoryIcon, setNewCategoryIcon] = useState("");
  const [newCategoryOrder, setNewCategoryOrder] = useState(0);

  // Manage categories dialog state
  const [manageCategoriesDialogOpen, setManageCategoriesDialogOpen] =
    useState(false);

  // Edit category dialog state
  const [editCategoryDialogOpen, setEditCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [editCategoryName, setEditCategoryName] = useState("");
  const [editCategorySlug, setEditCategorySlug] = useState("");
  const [editCategoryDescription, setEditCategoryDescription] = useState("");
  const [editCategoryIcon, setEditCategoryIcon] = useState("");
  const [editCategoryOrder, setEditCategoryOrder] = useState(0);

  // Delete category dialog state
  const [deleteCategoryDialogOpen, setDeleteCategoryDialogOpen] =
    useState(false);
  const [deletingCategory, setDeletingCategory] = useState<any>(null);
  const [reassignToCategoryId, setReassignToCategoryId] = useState("");

  // Fetch categories
  const {
    data: categoriesData,
    error: categoriesError,
    refetch: refetchCategories,
  } = useQuery(trpc.templates.getCategories.queryOptions());

  // Fetch all projects (admin can see all projects)
  const {
    data: projectsData,
    error: projectsError,
    isLoading: projectsLoading,
    refetch: refetchProjects,
  } = useQuery(trpc.admin.getAllProjects.queryOptions({ page: 1, limit: 100 }));

  // Debug logging
  useEffect(() => {
    if (projectsError) {
      console.error("Projects query error:", projectsError);
      toast.error(`Failed to load projects: ${projectsError.message}`);
    }
    if (projectsData) {
      console.log("Projects data received:", projectsData);
    }
  }, [projectsData, projectsError]);

  // Fetch fragments for selected project (admin can access any project's fragments)
  const { data: fragmentsData } = useQuery({
    ...trpc.admin.getProjectFragments.queryOptions({
      projectId: sourceProjectId,
    }),
    enabled: !!sourceProjectId,
  });

  // Create mutation
  const createMutation = useMutation(
    trpc.templates.create.mutationOptions({
      onSuccess: (data) => {
        toast.success("Template created successfully!");
        router.push("/admin/templates");
      },
      onError: (error) => {
        toast.error(`Failed to create template: ${error.message}`);
      },
    }),
  );

  // Create category mutation
  const createCategoryMutation = useMutation(
    trpc.admin.createCategory.mutationOptions({
      onSuccess: (data) => {
        toast.success(data.message);
        setCreateCategoryDialogOpen(false);
        // Reset form
        setNewCategoryName("");
        setNewCategorySlug("");
        setNewCategoryDescription("");
        setNewCategoryIcon("");
        setNewCategoryOrder(0);
        // Refresh categories and select the new one
        refetchCategories().then(() => {
          if (data.category) {
            setCategoryId(data.category.id);
          }
        });
      },
      onError: (error) => {
        toast.error(`Failed to create category: ${error.message}`);
      },
    }),
  );

  // Update category mutation
  const updateCategoryMutation = useMutation(
    trpc.admin.updateCategory.mutationOptions({
      onSuccess: (data) => {
        toast.success(data.message);
        setEditCategoryDialogOpen(false);
        setEditingCategory(null);
        refetchCategories();
      },
      onError: (error) => {
        toast.error(`Failed to update category: ${error.message}`);
      },
    }),
  );

  // Delete category mutation
  const deleteCategoryMutation = useMutation(
    trpc.admin.deleteCategory.mutationOptions({
      onSuccess: (data) => {
        toast.success(data.message);
        setDeleteCategoryDialogOpen(false);
        setDeletingCategory(null);
        setReassignToCategoryId("");
        // If deleted category was selected, clear selection
        if (categoryId === deletingCategory?.id) {
          setCategoryId("");
        }
        refetchCategories();
      },
      onError: (error) => {
        toast.error(`Failed to delete category: ${error.message}`);
      },
    }),
  );

  // Auto-generate slug from name (create)
  useEffect(() => {
    if (newCategoryName && !newCategorySlug) {
      const slug = newCategoryName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      setNewCategorySlug(slug);
    }
  }, [newCategoryName, newCategorySlug]);

  // Auto-generate slug from name (edit) - only if user hasn't manually edited it
  useEffect(() => {
    if (editCategoryDialogOpen && editCategoryName && editingCategory) {
      // Only auto-generate if slug matches the original (user hasn't edited it)
      const originalSlug = editingCategory.slug;
      const autoSlug = editCategoryName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      
      // If current slug is empty or matches what would be auto-generated from original name, update it
      if (!editCategorySlug || editCategorySlug === originalSlug) {
        setEditCategorySlug(autoSlug);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editCategoryName, editCategoryDialogOpen, editingCategory]);

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) {
      toast.error("Category name is required");
      return;
    }
    const slug = newCategorySlug.trim();
    const description = newCategoryDescription.trim();
    const icon = newCategoryIcon.trim();
    createCategoryMutation.mutate({
      name: newCategoryName.trim(),
      ...(slug && { slug }),
      ...(description && { description }),
      ...(icon && { icon }),
      order: newCategoryOrder,
    });
  };

  const handleEditCategory = (category: any) => {
    setEditingCategory(category);
    setEditCategoryName(category.name);
    setEditCategorySlug(category.slug);
    setEditCategoryDescription(category.description || "");
    setEditCategoryIcon(category.icon || "");
    setEditCategoryOrder(category.order || 0);
    setEditCategoryDialogOpen(true);
  };

  const handleUpdateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCategoryName.trim() || !editingCategory) {
      toast.error("Category name is required");
      return;
    }
    const slug = editCategorySlug.trim();
    const description = editCategoryDescription.trim();
    const icon = editCategoryIcon.trim();
    updateCategoryMutation.mutate({
      id: editingCategory.id,
      name: editCategoryName.trim(),
      ...(slug && { slug }),
      ...(description && { description }),
      ...(icon && { icon }),
      order: editCategoryOrder,
    });
  };

  const handleDeleteCategory = (category: any) => {
    setDeletingCategory(category);
    setReassignToCategoryId("");
    setDeleteCategoryDialogOpen(true);
  };

  const confirmDeleteCategory = () => {
    if (!deletingCategory) return;

    // If category has templates, require reassignment
    if (deletingCategory.templateCount > 0 && !reassignToCategoryId) {
      toast.error("Please select a category to reassign templates to");
      return;
    }

    deleteCategoryMutation.mutate({
      id: deletingCategory.id,
      ...(reassignToCategoryId && { reassignToCategoryId }),
    });
  };

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag("");
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!sourceProjectId || !sourceFragmentId || !categoryId) {
      toast.error("Please fill in all required fields");
      return;
    }

    createMutation.mutate({
      sourceProjectId,
      sourceFragmentId,
      name,
      description,
      shortDescription,
      categoryId,
      tags,
      thumbnailUrl: thumbnailUrl || undefined,
      featured,
      published,
      includeChatHistory,
      price,
    });
  };

  // Auto-fill from selected project
  const handleProjectSelect = (projectId: string) => {
    setSourceProjectId(projectId);
    const project = projectsData?.projects.find((p) => p.id === projectId);
    if (project) {
      setName(project.name || "");
      setDescription(project.subtitle || "");
      setShortDescription(project.subtitle || "");
    }
  };

  return (
    <div className="container mx-auto max-w-4xl p-8">
      {/* Header */}
      <div className="mb-8">
        <Link href="/admin/templates">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Templates
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Create Template</h1>
        <p className="text-muted-foreground">
          Promote a project to a community template
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Source Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Source Project</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label htmlFor="project">Project *</Label>
                {projectsError && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => refetchProjects()}
                  >
                    Retry
                  </Button>
                )}
              </div>
              <Select
                value={sourceProjectId}
                onValueChange={handleProjectSelect}
                disabled={projectsLoading || !!projectsError}
              >
                <SelectTrigger id="project">
                  <SelectValue
                    placeholder={
                      projectsLoading
                        ? "Loading projects..."
                        : projectsError
                          ? "Error loading projects"
                          : "Select a project"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {projectsError ? (
                    <SelectItem value="__error__" disabled>
                      Error: {projectsError.message}
                    </SelectItem>
                  ) : projectsLoading ? (
                    <SelectItem value="__loading__" disabled>
                      Loading projects...
                    </SelectItem>
                  ) : projectsData?.projects &&
                    projectsData.projects.length > 0 ? (
                    projectsData.projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}{" "}
                        {project.user &&
                          `(${project.user.name || project.user.email})`}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="__empty__" disabled>
                      No projects found
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              {projectsError && (
                <p className="mt-1 text-sm text-red-600">
                  {projectsError.message}
                </p>
              )}
            </div>

            {sourceProjectId && (
              <div>
                <Label htmlFor="fragment">Fragment/Version *</Label>
                <Select
                  value={sourceFragmentId}
                  onValueChange={setSourceFragmentId}
                >
                  <SelectTrigger id="fragment">
                    <SelectValue placeholder="Select a fragment" />
                  </SelectTrigger>
                  <SelectContent>
                    {fragmentsData?.map((fragment: any) => (
                      <SelectItem key={fragment.id} value={fragment.id}>
                        {fragment.title} (
                        {new Date(fragment.createdAt).toLocaleDateString()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Template Info */}
        <Card>
          <CardHeader>
            <CardTitle>Template Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Template Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Modern SaaS Landing Page"
                required
              />
            </div>

            <div>
              <Label htmlFor="shortDesc">
                Short Description * (max 200 chars)
              </Label>
              <Input
                id="shortDesc"
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                placeholder="Clean, conversion-optimized landing page"
                maxLength={200}
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Full Description *</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detailed description of what this template does..."
                rows={4}
                required
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label htmlFor="category">Category *</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setManageCategoriesDialogOpen(true)}
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    Manage
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCreateCategoryDialogOpen(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    New Category
                  </Button>
                </div>
              </div>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categoriesData?.categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="tags">Tags</Label>
              <div className="flex gap-2">
                <Input
                  id="tags"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) =>
                    e.key === "Enter" && (e.preventDefault(), addTag())
                  }
                  placeholder="Add a tag and press Enter"
                />
                <Button type="button" variant="outline" onClick={addTag}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="hover:bg-background ml-1 rounded-full"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="thumbnail">Thumbnail URL (optional)</Label>
              <Input
                id="thumbnail"
                type="url"
                value={thumbnailUrl}
                onChange={(e) => setThumbnailUrl(e.target.value)}
                placeholder="https://example.com/image.png"
              />
            </div>
          </CardContent>
        </Card>

        {/* Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Template Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="featured">Featured Template</Label>
                <p className="text-muted-foreground text-xs">
                  Show on homepage as featured
                </p>
              </div>
              <Switch
                id="featured"
                checked={featured}
                onCheckedChange={setFeatured}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="published">Published</Label>
                <p className="text-muted-foreground text-xs">
                  Make visible to public
                </p>
              </div>
              <Switch
                id="published"
                checked={published}
                onCheckedChange={setPublished}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="chatHistory">Include Chat History</Label>
                <p className="text-muted-foreground text-xs">
                  Show the conversation that created this
                </p>
              </div>
              <Switch
                id="chatHistory"
                checked={includeChatHistory}
                onCheckedChange={setIncludeChatHistory}
              />
            </div>

            <div>
              <Label htmlFor="price">Price (credits)</Label>
              <Input
                id="price"
                type="number"
                min="0"
                value={price}
                onChange={(e) => setPrice(parseInt(e.target.value) || 0)}
                placeholder="0 for free"
              />
              <p className="text-muted-foreground mt-1 text-xs">
                Set to 0 for free templates
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/admin/templates")}
            disabled={createMutation.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Creating..." : "Create Template"}
          </Button>
        </div>
      </form>

      {/* Create Category Dialog */}
      <Dialog
        open={createCategoryDialogOpen}
        onOpenChange={setCreateCategoryDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Category</DialogTitle>
            <DialogDescription>
              Add a new template category to organize templates.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateCategory} className="space-y-4">
            <div>
              <Label htmlFor="newCategoryName">Category Name *</Label>
              <Input
                id="newCategoryName"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="e.g., Landing Pages"
                required
              />
            </div>
            <div>
              <Label htmlFor="newCategorySlug">Slug *</Label>
              <Input
                id="newCategorySlug"
                value={newCategorySlug}
                onChange={(e) => setNewCategorySlug(e.target.value)}
                placeholder="e.g., landing-pages"
                required
              />
              <p className="text-muted-foreground mt-1 text-xs">
                URL-friendly identifier (auto-generated from name)
              </p>
            </div>

            <div>
              <Label htmlFor="newCategoryIcon">Icon (optional)</Label>
              <Input
                id="newCategoryIcon"
                value={newCategoryIcon}
                onChange={(e) => setNewCategoryIcon(e.target.value)}
                placeholder="e.g., 🏠"
                maxLength={2}
              />
              <p className="text-muted-foreground mt-1 text-xs">
                Emoji or icon to display (max 2 characters)
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateCategoryDialogOpen(false)}
                disabled={createCategoryMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createCategoryMutation.isPending}>
                {createCategoryMutation.isPending
                  ? "Creating..."
                  : "Create Category"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Manage Categories Dialog */}
      <Dialog
        open={manageCategoriesDialogOpen}
        onOpenChange={setManageCategoriesDialogOpen}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Categories</DialogTitle>
            <DialogDescription>
              Edit or delete template categories. Categories with templates
              require reassignment before deletion.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {categoriesData?.categories.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center">
                No categories found
              </p>
            ) : (
              categoriesData?.categories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{cat.icon || "📁"}</span>
                    <div>
                      <div className="font-medium">{cat.name}</div>
                      <div className="text-muted-foreground text-xs">
                        {cat.slug} • {cat.templateCount || 0} template
                        {(cat.templateCount || 0) !== 1 ? "s" : ""}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditCategory(cat)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteCategory(cat)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setManageCategoriesDialogOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Category Dialog */}
      <Dialog
        open={editCategoryDialogOpen}
        onOpenChange={(open) => {
          setEditCategoryDialogOpen(open);
          if (!open) {
            setEditingCategory(null);
            setEditCategoryName("");
            setEditCategorySlug("");
            setEditCategoryDescription("");
            setEditCategoryIcon("");
            setEditCategoryOrder(0);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
            <DialogDescription>
              {editingCategory?.templateCount > 0 && (
                <span className="text-amber-600">
                  ⚠️ This category has {editingCategory.templateCount} template
                  {(editingCategory.templateCount || 0) !== 1 ? "s" : ""}.
                  Changing the slug may affect template URLs.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateCategory} className="space-y-4">
            <div>
              <Label htmlFor="editCategoryName">Category Name *</Label>
              <Input
                id="editCategoryName"
                value={editCategoryName}
                onChange={(e) => setEditCategoryName(e.target.value)}
                placeholder="e.g., Landing Pages"
                required
              />
            </div>
            <div>
              <Label htmlFor="editCategorySlug">Slug *</Label>
              <Input
                id="editCategorySlug"
                value={editCategorySlug}
                onChange={(e) => setEditCategorySlug(e.target.value)}
                placeholder="e.g., landing-pages"
                required
              />
              <p className="text-muted-foreground mt-1 text-xs">
                URL-friendly identifier
              </p>
            </div>

            <div>
              <Label htmlFor="editCategoryIcon">Icon (optional)</Label>
              <Input
                id="editCategoryIcon"
                value={editCategoryIcon}
                onChange={(e) => setEditCategoryIcon(e.target.value)}
                placeholder="e.g., 🏠"
                maxLength={2}
              />
              <p className="text-muted-foreground mt-1 text-xs">
                Emoji or icon to display (max 2 characters)
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditCategoryDialogOpen(false)}
                disabled={updateCategoryMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateCategoryMutation.isPending}
              >
                {updateCategoryMutation.isPending
                  ? "Updating..."
                  : "Update Category"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Category Dialog */}
      <Dialog
        open={deleteCategoryDialogOpen}
        onOpenChange={setDeleteCategoryDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Category</DialogTitle>
            <DialogDescription>
              {deletingCategory?.templateCount > 0 ? (
                <div className="space-y-2">
                  <p className="text-amber-600">
                    ⚠️ This category has {deletingCategory.templateCount}{" "}
                    template
                    {(deletingCategory.templateCount || 0) !== 1 ? "s" : ""}.
                    You must reassign them to another category before deleting.
                  </p>
                  <div className="mt-4">
                    <Label htmlFor="reassignCategory">
                      Reassign templates to:
                    </Label>
                    <Select
                      value={reassignToCategoryId}
                      onValueChange={setReassignToCategoryId}
                    >
                      <SelectTrigger id="reassignCategory">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categoriesData?.categories
                          .filter((cat) => cat.id !== deletingCategory?.id)
                          .map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.icon} {cat.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <p>
                  Are you sure you want to delete &quot;{deletingCategory?.name}&quot;?
                  This action cannot be undone.
                </p>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDeleteCategoryDialogOpen(false);
                setDeletingCategory(null);
                setReassignToCategoryId("");
              }}
              disabled={deleteCategoryMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDeleteCategory}
              disabled={deleteCategoryMutation.isPending}
            >
              {deleteCategoryMutation.isPending
                ? "Deleting..."
                : "Delete Category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
