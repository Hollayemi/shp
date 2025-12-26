"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ImageAttachment {
  id: string;
  file: File;
  preview: string; // base64 data URL
  size: number;
}

interface ImageAttachmentItemProps {
  image: ImageAttachment;
  onRemove: (id: string) => void;
  className?: string;
}

export function ImageAttachmentItem({
  image,
  onRemove,
  className,
}: ImageAttachmentItemProps) {
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      className={cn(
        "group relative flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted",
        className,
      )}
    >
      <img
        src={image.preview}
        alt={image.file.name}
        className="h-full w-full object-cover"
      />
      <Button
        type="button"
        variant="destructive"
        size="icon"
        className="absolute right-1 top-1 h-5 w-5 opacity-0 transition-opacity group-hover:opacity-100"
        onClick={() => onRemove(image.id)}
      >
        <X className="h-3 w-3" />
      </Button>
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5 text-center text-white text-xs opacity-0 transition-opacity group-hover:opacity-100">
        {formatSize(image.size)}
      </div>
    </div>
  );
}

interface ImageAttachmentListProps {
  images: ImageAttachment[];
  onRemove: (id: string) => void;
  className?: string;
}

export function ImageAttachmentList({
  images,
  onRemove,
  className,
}: ImageAttachmentListProps) {
  if (images.length === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap gap-2 rounded-lg border bg-muted/30 p-2",
        className,
      )}
    >
      {images.map((image) => (
        <ImageAttachmentItem
          key={image.id}
          image={image}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}
