"use client";

import { X, File as FileIcon, FileText, FileCode, FileImage, Loader2 } from "lucide-react";

export interface FileAttachment {
  id: string;
  file: File;
  preview?: string;
  type: 'image' | 'pdf' | 'text' | 'code' | 'docx' | 'other';
  isUploading?: boolean;
  uploadProgress?: number;
  url?: string; // R2 URL after successful upload
}

// Helper to determine file type
function getFileType(file: File): FileAttachment['type'] {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type === 'application/pdf') return 'pdf';
  if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  if (file.type.startsWith('text/')) return 'text';
  
  // Check for code files by extension
  const ext = file.name.split('.').pop()?.toLowerCase();
  const codeExtensions = ['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'css', 'html', 'json', 'xml', 'yaml', 'yml', 'md', 'sh', 'go', 'rs', 'swift', 'kt'];
  if (ext && codeExtensions.includes(ext)) return 'code';
  if (ext === 'docx') return 'docx';
  
  return 'other';
}

// Helper to get file icon
function getFileIcon(type: FileAttachment['type']) {
  switch (type) {
    case 'image': return FileImage;
    case 'pdf': return FileText;
    case 'docx': return FileText;
    case 'text': return FileText;
    case 'code': return FileCode;
    default: return FileIcon;
  }
}

// Helper to get file extension
function getFileExtension(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext ? `.${ext}` : '';
}

export { getFileType, getFileIcon, getFileExtension };

// Legacy export for backwards compatibility
export type ImageAttachment = FileAttachment;

interface FileThumbnailProps {
  file: FileAttachment;
  onRemove: (id: string) => void;
  size?: number;
}

export function FileThumbnail({ 
  file, 
  onRemove,
  size = 30 
}: FileThumbnailProps) {
  const Icon = getFileIcon(file.type);
  const extension = getFileExtension(file.file.name);
  const isUploading = file.isUploading ?? false;
  const progress = file.uploadProgress ?? 0;
  
  return (
    <div
      className="group relative flex-shrink-0 overflow-hidden rounded border bg-muted"
      style={{ height: `${size}px`, width: `${size}px` }}
      title={`${file.file.name}${isUploading ? ' (uploading...)' : ''}`}
    >
      {file.type === 'image' && file.preview ? (
        <img
          src={file.preview}
          alt={file.file.name}
          className={`h-full w-full object-cover ${isUploading ? 'opacity-50' : ''}`}
        />
      ) : (
        <div className={`flex h-full w-full flex-col items-center justify-center bg-muted p-1 ${isUploading ? 'opacity-50' : ''}`}>
          <Icon className="h-3 w-3 text-muted-foreground" />
          {extension && (
            <span className="mt-0.5 text-[6px] font-medium text-muted-foreground uppercase">
              {extension.replace('.', '')}
            </span>
          )}
        </div>
      )}
      
      {/* Loading overlay */}
      {isUploading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-[2px]">
          <Loader2 className="h-4 w-4 animate-spin text-white" />
        </div>
      )}
      
      {/* Remove button (only show when not uploading) */}
      {!isUploading && (
        <button
          type="button"
          onClick={() => onRemove(file.id)}
          className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100"
        >
          <X className="h-3 w-3 text-white" />
        </button>
      )}
    </div>
  );
}

// Legacy export
export const ImageThumbnail = FileThumbnail;

interface FileThumbnailListProps {
  files: FileAttachment[];
  onRemove: (id: string) => void;
  size?: number;
  className?: string;
}

export function FileThumbnailList({ 
  files, 
  onRemove,
  size = 30,
  className = ""
}: FileThumbnailListProps) {
  if (files.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {files.map((file) => (
        <FileThumbnail
          key={file.id}
          file={file}
          onRemove={onRemove}
          size={size}
        />
      ))}
    </div>
  );
}

// Legacy export
export const ImageThumbnailList = FileThumbnailList;
