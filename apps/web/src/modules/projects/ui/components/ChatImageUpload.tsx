"use client";

import { cn, generateUUID } from "@/lib/utils";
import { useRef, useState } from "react";
import {
  FileThumbnailList,
  type FileAttachment,
  getFileType,
  ImageAttachment,
} from "./ImageThumbnail";
import { useFileUpload, type UploadType } from "@/hooks/useFileUpload";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

// Helper to map file type to upload type
function getUploadType(file: File): UploadType {
  if (file.type.startsWith("image/")) return "IMAGE";
  if (file.type.startsWith("video/")) return "VIDEO";
  if (file.type.startsWith("audio/")) return "AUDIO";
  if (
    file.type === "application/pdf" ||
    file.type.startsWith("text/") ||
    file.type.includes("document")
  )
    return "DOCUMENT";
  return "OTHER";
}

export type { FileAttachment, ImageAttachment };

interface ChatFileUploadProps {
  files: FileAttachment[];
  onFilesChange: (files: FileAttachment[]) => void;
  maxFiles?: number;
  maxSize?: number; // in bytes
  acceptedFileTypes?: string; // MIME types or extensions
  className?: string;
  onTriggerUpload?: () => void; // Callback to trigger file input
  children?: React.ReactNode; // Wrap around the input area
}

// Legacy interface for backwards compatibility
interface ChatImageUploadProps {
  images: ImageAttachment[];
  onImagesChange: (images: ImageAttachment[]) => void;
  maxImages?: number;
  maxSize?: number;
  className?: string;
  onTriggerUpload?: () => void;
  children?: React.ReactNode;
}

export function ChatFileUpload({
  files,
  onFilesChange,
  maxFiles = 10,
  maxSize = 10 * 1024 * 1024, // 10MB default
  acceptedFileTypes = "image/*,.pdf,.docx,.txt,.md,.json,.xml,.yaml,.yml,.csv,.js,.ts,.jsx,.tsx,.py,.java,.cpp,.c,.html,.css,.php,.rb,.go,.rs,.swift,.kt,.sql,.sh,.bat",
  className,
  onTriggerUpload,
  children,
}: ChatFileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { data: session, status } = useSession();

  // Initialize upload hook at top level (with default type, will be overridden per file)
  const { uploadFile } = useFileUpload({
    uploadType: "OTHER", // Default, will be overridden
  });

  const processFiles = async (fileList: File[]) => {
    if (fileList.length === 0) return;

    // Check if adding these files would exceed max
    if (files.length + fileList.length > maxFiles) {
      toast.error(`Maximum ${maxFiles} files allowed`);
      return;
    }

    setUploading(true);

    // Process each file
    const newFiles: FileAttachment[] = [];

    for (const file of fileList) {
      // Check file size
      if (file.size > maxSize) {
        toast.error(
          `File ${file.name} exceeds ${maxSize / (1024 * 1024)}MB limit`,
        );
        continue;
      }

      // Determine file type for UI
      const fileType = getFileType(file);

      // Determine upload type for R2
      const uploadType = getUploadType(file);

      // Generate local preview for ALL file types (for immediate display)
      let preview: string | undefined;
      try {
        preview = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            if (typeof e.target?.result === "string") {
              resolve(e.target.result);
            } else {
              reject(new Error("Failed to read file"));
            }
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      } catch (error) {
        console.error(`Failed to generate preview for ${file.name}:`, error);
      }

      // Create file attachment with loading state
      const fileId = generateUUID();
      const fileAttachment: FileAttachment = {
        id: fileId,
        file,
        preview,
        type: fileType,
        isUploading: true,
        uploadProgress: 0,
      };

      // Add file immediately with loading state
      newFiles.push(fileAttachment);
      onFilesChange([...files, ...newFiles]);

      // Upload to R2 in background with progress tracking
      try {
        const upload = await uploadFile(file, {
          uploadType, // Pass the specific type for this file
          onProgress: (progress) => {
            // Update progress in the file attachment
            fileAttachment.uploadProgress = progress;
            onFilesChange([...files, ...newFiles]);
          },
        });

        // Update with R2 URL and remove loading state
        fileAttachment.url = upload.url;
        fileAttachment.isUploading = false;
        fileAttachment.uploadProgress = 100;
        onFilesChange([...files, ...newFiles]);

        toast.success(`${file.name} uploaded successfully`);
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error);
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        toast.error(`Failed to upload ${file.name}: ${errorMessage}`);

        // Remove file from list if upload failed
        const index = newFiles.findIndex((f) => f.id === fileId);
        if (index > -1) {
          newFiles.splice(index, 1);
          onFilesChange([...files, ...newFiles]);
        }
      }
    }

    setUploading(false);
    onFilesChange([...files, ...newFiles]);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    await processFiles(selectedFiles);

    // Reset input so same file can be selected again
    if (e.target) {
      e.target.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    await processFiles(droppedFiles);
  };

  const handleRemove = (id: string) => {
    onFilesChange(files.filter((f) => f.id !== id));
  };

  // Expose trigger method via ref callback
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Call onTriggerUpload when component mounts to pass trigger function to parent
  if (onTriggerUpload && fileInputRef.current) {
    onTriggerUpload();
  }

  return (
    <div
      ref={dropZoneRef}
      className={cn("relative w-full", className)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedFileTypes}
        multiple
        onChange={handleFileChange}
        className="hidden"
      />

      {/* File thumbnails - shown at top when files exist */}
      <FileThumbnailList
        files={files}
        onRemove={handleRemove}
        size={30}
        className="mb-2"
      />

      {/* Wrapped children (the input area) */}
      {children}

      {/* Drag overlay - shows when dragging over this component */}
      {isDragging && (
        <div className="border-primary bg-primary/10 pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg border-2 border-dashed backdrop-blur-sm">
          <p className="text-primary text-sm font-medium">Drop files here</p>
        </div>
      )}
    </div>
  );
}

// Legacy component for backwards compatibility
export function ChatImageUpload({
  images,
  onImagesChange,
  maxImages = 10,
  maxSize = 10 * 1024 * 1024,
  className,
  onTriggerUpload,
  children,
}: ChatImageUploadProps) {
  return (
    <ChatFileUpload
      files={images}
      onFilesChange={onImagesChange}
      maxFiles={maxImages}
      maxSize={maxSize}
      acceptedFileTypes="image/png,image/jpeg,image/jpg,image/gif,image/webp"
      className={className}
      onTriggerUpload={onTriggerUpload}
    >
      {children}
    </ChatFileUpload>
  );
}
