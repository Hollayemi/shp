"use client";

import { useState, useEffect } from "react";
import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
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
import { ArrowLeft, Plus, X } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";

export default function EditTemplateClient() {
  const params = useParams();
  const trpc = useTRPC();
  const router = useRouter();
  const templateId = params.templateId as string;

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [featured, setFeatured] = useState(false);
  const [published, setPublished] = useState(true);
  const [price, setPrice] = useState(0);

  // Fetch template
  const { data: template, isLoading } = useQuery(
    trpc.templates.getById.queryOptions({ templateId })
  );

  // Fetch categories
  const { data: categoriesData } = useQuery(
    trpc.templates.getCategories.queryOptions()
  );

  // Populate form when template loads
  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description);
      setShortDescription(template.shortDescription);
      setCategoryId(template.categoryId || "");
      setTags(template.tags);
      setThumbnailUrl(template.thumbnailUrl || "");
      setFeatured(template.featured);
      setPublished(template.published);
      setPrice(template.price || 0);
    }
  }, [template]);

  // Update mutation
  const updateMutation = useMutation(
    trpc.templates.update.mutationOptions({
      onSuccess: () => {
        toast.success("Template updated successfully!");
        router.push("/admin/templates");
      },
      onError: (error) => {
        toast.error(`Failed to update template: ${error.message}`);
      },
    })
  );

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

    updateMutation.mutate({
      templateId,
      name,
      description,
      shortDescription,
      categoryId: categoryId || undefined,
      tags,
      thumbnailUrl: thumbnailUrl || undefined,
      featured,
      published,
      price,
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-4xl p-8">
        <Skeleton className="mb-8 h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="container mx-auto max-w-4xl p-8 text-center">
        <h1 className="text-2xl font-bold">Template Not Found</h1>
        <Button className="mt-4" onClick={() => router.push("/admin/templates")}>
          Back to Templates
        </Button>
      </div>
    );
  }

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
        <h1 className="text-3xl font-bold">Edit Template</h1>
        <p className="text-muted-foreground">{template.name}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
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
                required
              />
            </div>

            <div>
              <Label htmlFor="shortDesc">Short Description * (max 200 chars)</Label>
              <Input
                id="shortDesc"
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                maxLength={200}
                required
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {shortDescription.length}/200
              </p>
            </div>

            <div>
              <Label htmlFor="description">Full Description *</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                required
              />
            </div>

            <div>
              <Label htmlFor="category">Category *</Label>
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
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
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
                      className="ml-1 rounded-full hover:bg-background"
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
                <p className="text-xs text-muted-foreground">
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
                <p className="text-xs text-muted-foreground">
                  Make visible to public
                </p>
              </div>
              <Switch
                id="published"
                checked={published}
                onCheckedChange={setPublished}
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
              <p className="mt-1 text-xs text-muted-foreground">
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
            disabled={updateMutation.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "Updating..." : "Update Template"}
          </Button>
        </div>
      </form>
    </div>
  );
}

