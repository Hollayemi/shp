import { z } from 'zod';
export declare const UploadTypeSchema: z.ZodEnum<{
    IMAGE: "IMAGE";
    DOCUMENT: "DOCUMENT";
    VIDEO: "VIDEO";
    AUDIO: "AUDIO";
    OTHER: "OTHER";
}>;
export type UploadType = z.infer<typeof UploadTypeSchema>;
export declare const UploadMetadataSchema: z.ZodObject<{
    width: z.ZodOptional<z.ZodNumber>;
    height: z.ZodOptional<z.ZodNumber>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
    description: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type UploadMetadata = z.infer<typeof UploadMetadataSchema>;
export declare const PresignedUploadRequestSchema: z.ZodObject<{
    filename: z.ZodString;
    mimeType: z.ZodString;
    size: z.ZodNumber;
    uploadType: z.ZodEnum<{
        IMAGE: "IMAGE";
        DOCUMENT: "DOCUMENT";
        VIDEO: "VIDEO";
        AUDIO: "AUDIO";
        OTHER: "OTHER";
    }>;
    teamId: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodObject<{
        width: z.ZodOptional<z.ZodNumber>;
        height: z.ZodOptional<z.ZodNumber>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
        description: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type PresignedUploadRequest = z.infer<typeof PresignedUploadRequestSchema>;
export declare const PresignedUploadResponseSchema: z.ZodObject<{
    uploadId: z.ZodString;
    presignedUrl: z.ZodString;
    storageKey: z.ZodString;
    expiresAt: z.ZodDate;
}, z.core.$strip>;
export type PresignedUploadResponse = z.infer<typeof PresignedUploadResponseSchema>;
export declare const CompleteUploadRequestSchema: z.ZodObject<{
    uploadId: z.ZodString;
}, z.core.$strip>;
export type CompleteUploadRequest = z.infer<typeof CompleteUploadRequestSchema>;
export declare const UploadSchema: z.ZodObject<{
    id: z.ZodString;
    filename: z.ZodString;
    originalName: z.ZodString;
    mimeType: z.ZodString;
    size: z.ZodNumber;
    url: z.ZodString;
    thumbnailUrl: z.ZodOptional<z.ZodString>;
    uploadType: z.ZodEnum<{
        IMAGE: "IMAGE";
        DOCUMENT: "DOCUMENT";
        VIDEO: "VIDEO";
        AUDIO: "AUDIO";
        OTHER: "OTHER";
    }>;
    width: z.ZodOptional<z.ZodNumber>;
    height: z.ZodOptional<z.ZodNumber>;
    tags: z.ZodArray<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    usedInProjects: z.ZodArray<z.ZodString>;
    lastUsedAt: z.ZodOptional<z.ZodDate>;
    createdAt: z.ZodDate;
}, z.core.$strip>;
export type Upload = z.infer<typeof UploadSchema>;
export declare const LibraryFiltersSchema: z.ZodObject<{
    uploadType: z.ZodOptional<z.ZodEnum<{
        IMAGE: "IMAGE";
        DOCUMENT: "DOCUMENT";
        VIDEO: "VIDEO";
        AUDIO: "AUDIO";
        OTHER: "OTHER";
    }>>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
    search: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
    cursor: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type LibraryFilters = z.infer<typeof LibraryFiltersSchema>;
export declare const UpdateUploadMetadataSchema: z.ZodObject<{
    uploadId: z.ZodString;
    tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
    description: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type UpdateUploadMetadata = z.infer<typeof UpdateUploadMetadataSchema>;
//# sourceMappingURL=types.d.ts.map