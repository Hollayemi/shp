"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateUploadMetadataSchema = exports.LibraryFiltersSchema = exports.UploadSchema = exports.CompleteUploadRequestSchema = exports.PresignedUploadResponseSchema = exports.PresignedUploadRequestSchema = exports.UploadMetadataSchema = exports.UploadTypeSchema = void 0;
const zod_1 = require("zod");
// Upload types matching Prisma enum
exports.UploadTypeSchema = zod_1.z.enum([
    'IMAGE',
    'DOCUMENT',
    'VIDEO',
    'AUDIO',
    'OTHER',
]);
// Upload metadata
exports.UploadMetadataSchema = zod_1.z.object({
    width: zod_1.z.number().optional(),
    height: zod_1.z.number().optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
    description: zod_1.z.string().optional(),
});
// Presigned upload request
exports.PresignedUploadRequestSchema = zod_1.z.object({
    filename: zod_1.z.string().min(1),
    mimeType: zod_1.z.string().min(1),
    size: zod_1.z.number().positive(),
    uploadType: exports.UploadTypeSchema,
    teamId: zod_1.z.string().optional(),
    metadata: exports.UploadMetadataSchema.optional(),
});
// Presigned upload response
exports.PresignedUploadResponseSchema = zod_1.z.object({
    uploadId: zod_1.z.string(),
    presignedUrl: zod_1.z.string().url(),
    storageKey: zod_1.z.string(),
    expiresAt: zod_1.z.date(),
});
// Upload completion
exports.CompleteUploadRequestSchema = zod_1.z.object({
    uploadId: zod_1.z.string(),
});
// Upload response
exports.UploadSchema = zod_1.z.object({
    id: zod_1.z.string(),
    filename: zod_1.z.string(),
    originalName: zod_1.z.string(),
    mimeType: zod_1.z.string(),
    size: zod_1.z.number(),
    url: zod_1.z.string(),
    thumbnailUrl: zod_1.z.string().optional(),
    uploadType: exports.UploadTypeSchema,
    width: zod_1.z.number().optional(),
    height: zod_1.z.number().optional(),
    tags: zod_1.z.array(zod_1.z.string()),
    description: zod_1.z.string().optional(),
    usedInProjects: zod_1.z.array(zod_1.z.string()),
    lastUsedAt: zod_1.z.date().optional(),
    createdAt: zod_1.z.date(),
});
// Library query filters
exports.LibraryFiltersSchema = zod_1.z.object({
    uploadType: exports.UploadTypeSchema.optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
    search: zod_1.z.string().optional(),
    limit: zod_1.z.number().min(1).max(100).default(50),
    cursor: zod_1.z.string().optional(),
});
// Update upload metadata
exports.UpdateUploadMetadataSchema = zod_1.z.object({
    uploadId: zod_1.z.string(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
    description: zod_1.z.string().optional(),
});
//# sourceMappingURL=types.js.map