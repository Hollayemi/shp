import { z } from 'zod';

// Upload types matching Prisma enum
export const UploadTypeSchema = z.enum([
  'IMAGE',
  'DOCUMENT',
  'VIDEO',
  'AUDIO',
  'OTHER',
]);

export type UploadType = z.infer<typeof UploadTypeSchema>;

// Upload metadata
export const UploadMetadataSchema = z.object({
  width: z.number().optional(),
  height: z.number().optional(),
  tags: z.array(z.string()).optional(),
  description: z.string().optional(),
});

export type UploadMetadata = z.infer<typeof UploadMetadataSchema>;

// Presigned upload request
export const PresignedUploadRequestSchema = z.object({
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  size: z.number().positive(),
  uploadType: UploadTypeSchema,
  teamId: z.string().optional(),
  metadata: UploadMetadataSchema.optional(),
});

export type PresignedUploadRequest = z.infer<typeof PresignedUploadRequestSchema>;

// Presigned upload response
export const PresignedUploadResponseSchema = z.object({
  uploadId: z.string(),
  presignedUrl: z.string().url(),
  storageKey: z.string(),
  expiresAt: z.date(),
});

export type PresignedUploadResponse = z.infer<typeof PresignedUploadResponseSchema>;

// Upload completion
export const CompleteUploadRequestSchema = z.object({
  uploadId: z.string(),
});

export type CompleteUploadRequest = z.infer<typeof CompleteUploadRequestSchema>;

// Upload response
export const UploadSchema = z.object({
  id: z.string(),
  filename: z.string(),
  originalName: z.string(),
  mimeType: z.string(),
  size: z.number(),
  url: z.string(),
  thumbnailUrl: z.string().optional(),
  uploadType: UploadTypeSchema,
  width: z.number().optional(),
  height: z.number().optional(),
  tags: z.array(z.string()),
  description: z.string().optional(),
  usedInProjects: z.array(z.string()),
  lastUsedAt: z.date().optional(),
  createdAt: z.date(),
});

export type Upload = z.infer<typeof UploadSchema>;

// Library query filters
export const LibraryFiltersSchema = z.object({
  uploadType: UploadTypeSchema.optional(),
  tags: z.array(z.string()).optional(),
  search: z.string().optional(),
  limit: z.number().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

export type LibraryFilters = z.infer<typeof LibraryFiltersSchema>;

// Update upload metadata
export const UpdateUploadMetadataSchema = z.object({
  uploadId: z.string(),
  tags: z.array(z.string()).optional(),
  description: z.string().optional(),
});

export type UpdateUploadMetadata = z.infer<typeof UpdateUploadMetadataSchema>;
