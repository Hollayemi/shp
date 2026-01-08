import { prisma } from "@shipper/database";
import { R2Client, type UploadType } from "./r2-client.js";
import type { Readable } from "stream";
import { getSandbox, writeFileBinary } from "./modal-sandbox-manager.js";

// Upload configs
const UPLOAD_CONFIGS: Record<
  UploadType,
  { maxSize: number; allowedMimeTypes: string[] }
> = {
  IMAGE: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/gif",
      "image/webp",
      "image/svg+xml",
      "image/avif",
    ],
  },
  DOCUMENT: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "text/markdown",
      "application/json",
      "text/javascript",
      "text/typescript",
      "text/jsx",
      "text/tsx",
      "text/css",
      "text/html",
      "text/xml",
      "application/javascript",
      "application/typescript",
      "application/x-javascript",
      "application/x-typescript",
      "text/*", // Allow all text files (code files often have text/* MIME types)
    ],
  },
  VIDEO: {
    maxSize: 100 * 1024 * 1024, // 100MB
    allowedMimeTypes: ["video/mp4", "video/webm", "video/quicktime"],
  },
  AUDIO: {
    maxSize: 50 * 1024 * 1024, // 50MB
    allowedMimeTypes: ["audio/mpeg", "audio/wav", "audio/ogg", "audio/webm"],
  },
  OTHER: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: ["*/*"],
  },
};

// Helper to determine upload type from MIME type
function getUploadTypeFromMimeType(mimeType: string): UploadType {
  if (mimeType.startsWith("image/")) return "IMAGE";
  if (mimeType.startsWith("video/")) return "VIDEO";
  if (mimeType.startsWith("audio/")) return "AUDIO";
  if (
    mimeType === "application/pdf" ||
    mimeType.includes("document") ||
    mimeType.startsWith("text/")
  ) {
    return "DOCUMENT";
  }
  return "OTHER";
}

// Helper to validate file
function validateFile(
  file: { size: number; type: string },
  uploadType: UploadType,
): { valid: boolean; error?: string } {
  const config = UPLOAD_CONFIGS[uploadType];

  if (file.size > config.maxSize) {
    return {
      valid: false,
      error: `File size exceeds ${config.maxSize / (1024 * 1024)}MB limit`,
    };
  }

  const isAllowedMimeType = config.allowedMimeTypes.some((allowed) => {
    if (allowed === "*/*") return true;
    if (allowed.endsWith("/*")) {
      return file.type.startsWith(allowed.replace("/*", ""));
    }
    return file.type === allowed;
  });

  if (!isAllowedMimeType) {
    return {
      valid: false,
      error: "File type not allowed",
    };
  }

  return { valid: true };
}

export interface PresignedUploadRequest {
  filename: string;
  mimeType: string;
  size: number;
  uploadType: UploadType;
  teamId?: string;
  projectId?: string;
  metadata?: {
    width?: number;
    height?: number;
    tags?: string[];
    description?: string;
  };
}

export interface PresignedUploadResponse {
  uploadId: string;
  presignedUrl: string;
  storageKey: string;
  expiresAt: Date;
}

export interface CompleteUploadRequest {
  uploadId: string;
}

export interface Upload {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
  uploadType: UploadType;
  width?: number;
  height?: number;
  tags: string[];
  description?: string;
  usedInProjects: string[];
  lastUsedAt?: Date;
  createdAt: Date;
}

export interface LibraryFilters {
  projectId?: string;
  uploadType?: UploadType;
  tags?: string[];
  search?: string;
  limit?: number;
  cursor?: string;
}

export interface UpdateUploadMetadata {
  uploadId: string;
  tags?: string[];
  description?: string;
}

export class UploadService {
  private r2Client: R2Client;

  constructor() {
    this.r2Client = new R2Client();
  }

  /**
   * Request presigned upload URL (Step 1 of upload flow)
   */
  async requestPresignedUpload(
    request: PresignedUploadRequest,
    userId: string,
  ): Promise<PresignedUploadResponse> {
    // Auto-detect upload type if not provided or set to OTHER
    let uploadType = request.uploadType;
    if (!uploadType || uploadType === "OTHER") {
      uploadType = getUploadTypeFromMimeType(request.mimeType);
    }

    // Validate file
    const validation = validateFile(
      {
        size: request.size,
        type: request.mimeType,
      },
      uploadType,
    );

    if (!validation.valid) {
      throw new Error(validation.error || "Invalid file");
    }

    // Validate team access if teamId provided
    if (request.teamId) {
      const teamMember = await prisma.teamMember.findFirst({
        where: { teamId: request.teamId, userId },
      });

      if (!teamMember) {
        throw new Error("Access denied to team");
      }
    }

    // Generate storage key
    const storageKey = R2Client.generateStorageKey(
      uploadType,
      userId,
      request.filename,
      request.teamId,
    );

    // Create upload record in DB (pending state)
    const upload = await prisma.upload.create({
      data: {
        filename: request.filename,
        originalName: request.filename,
        mimeType: request.mimeType,
        size: request.size,
        storageKey,
        url: this.r2Client.getPublicUrl(storageKey),
        uploadType,
        userId,
        teamId: request.teamId,
        width: request.metadata?.width,
        height: request.metadata?.height,
        tags: request.metadata?.tags || [],
        description: request.metadata?.description,
        usedInProjects: request.projectId ? [request.projectId] : [],
      },
    });

    // Generate presigned URL
    const presignedUrl = await this.r2Client.generatePresignedUploadUrl(
      storageKey,
      request.mimeType,
      3600, // 1 hour expiry
    );

    return {
      uploadId: upload.id,
      presignedUrl,
      storageKey,
      expiresAt: new Date(Date.now() + 3600 * 1000),
    };
  }

  /**
   * Complete upload (Step 2 - after client uploads to R2)
   */
  async completeUpload(
    request: CompleteUploadRequest,
    userId: string,
  ): Promise<Upload> {
    const upload = await prisma.upload.findUnique({
      where: { id: request.uploadId },
    });

    if (!upload) {
      throw new Error("Upload not found");
    }

    if (upload.userId !== userId) {
      throw new Error("Access denied");
    }

    // Verify file exists in R2
    const exists = await this.r2Client.fileExists(upload.storageKey);
    if (!exists) {
      throw new Error("File not found in storage");
    }

    // Sync images to sandbox public/images folder if associated with a project
    if (
      upload.uploadType === "IMAGE" &&
      upload.usedInProjects &&
      upload.usedInProjects.length > 0
    ) {
      const projectId = upload.usedInProjects[0];
      try {
        const sandboxInfo = await getSandbox(projectId);
        if (sandboxInfo) {
          // Download file from R2
          const { buffer } = await this.r2Client.getFileBuffer(
            upload.storageKey,
          );

          // Write to sandbox's public/images folder
          const sandboxPath = `public/images/${upload.filename}`;
          await writeFileBinary(sandboxInfo.sandboxId, sandboxPath, buffer);

          console.log(
            `[UploadService] Synced image to sandbox: ${sandboxPath}`,
          );
        }
      } catch (error) {
        // Don't fail upload if sandbox sync fails
        console.warn(
          `[UploadService] Failed to sync image to sandbox:`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    // Update upload record
    const updatedUpload = await prisma.upload.update({
      where: { id: request.uploadId },
      data: {
        updatedAt: new Date(),
      },
    });

    return this.mapToUpload(updatedUpload);
  }

  /**
   * Get user's media library with filters
   */
  async getLibrary(
    userId: string,
    filters: LibraryFilters,
  ): Promise<{ uploads: Upload[]; nextCursor?: string }> {
    const where: any = {
      userId,
      deletedAt: null,
    };

    if (filters.projectId) {
      where.usedInProjects = {
        has: filters.projectId,
      };
    }

    if (filters.uploadType) {
      where.uploadType = filters.uploadType;
    }

    if (filters.tags && filters.tags.length > 0) {
      where.tags = {
        hasSome: filters.tags,
      };
    }

    if (filters.search) {
      where.OR = [
        { filename: { contains: filters.search, mode: "insensitive" } },
        { originalName: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const limit = filters.limit || 50;
    const uploads = await prisma.upload.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit + 1, // Take one extra to determine if there's more
      ...(filters.cursor && {
        cursor: { id: filters.cursor },
        skip: 1,
      }),
    });

    const hasMore = uploads.length > limit;
    const results = hasMore ? uploads.slice(0, -1) : uploads;
    const nextCursor = hasMore ? results[results.length - 1]?.id : undefined;

    return {
      uploads: results.map((u) => this.mapToUpload(u)),
      nextCursor,
    };
  }

  /**
   * Get single upload
   */
  async getUpload(uploadId: string, userId: string): Promise<Upload> {
    const upload = await prisma.upload.findFirst({
      where: {
        id: uploadId,
        OR: [{ userId }, { team: { members: { some: { userId } } } }],
        deletedAt: null,
      },
    });

    if (!upload) {
      throw new Error("Upload not found");
    }

    return this.mapToUpload(upload);
  }

  /**
   * Get download stream for an upload (streams from R2)
   */
  async getDownloadStream(
    uploadId: string,
    userId: string,
  ): Promise<{
    stream: Readable;
    filename: string;
    mimeType: string;
    size?: number;
  }> {
    const upload = await prisma.upload.findFirst({
      where: {
        id: uploadId,
        OR: [{ userId }, { team: { members: { some: { userId } } } }],
        deletedAt: null,
      },
    });

    if (!upload) {
      throw new Error("Upload not found");
    }

    const file = await this.r2Client.getFileStream(upload.storageKey);

    return {
      stream: file.body,
      filename: upload.originalName || upload.filename,
      mimeType:
        upload.mimeType || file.contentType || "application/octet-stream",
      size: upload.size || file.contentLength,
    };
  }

  /**
   * Update upload metadata
   */
  async updateMetadata(
    request: UpdateUploadMetadata,
    userId: string,
  ): Promise<Upload> {
    const upload = await prisma.upload.findUnique({
      where: { id: request.uploadId },
    });

    if (!upload) {
      throw new Error("Upload not found");
    }

    if (upload.userId !== userId) {
      throw new Error("Access denied");
    }

    const updated = await prisma.upload.update({
      where: { id: request.uploadId },
      data: {
        tags: request.tags,
        description: request.description,
        updatedAt: new Date(),
      },
    });

    return this.mapToUpload(updated);
  }

  /**
   * Delete upload (soft delete)
   */
  async deleteUpload(uploadId: string, userId: string): Promise<void> {
    const upload = await prisma.upload.findUnique({
      where: { id: uploadId },
    });

    if (!upload) {
      throw new Error("Upload not found");
    }

    if (upload.userId !== userId) {
      throw new Error("Access denied");
    }

    // Soft delete in DB
    await prisma.upload.update({
      where: { id: uploadId },
      data: { deletedAt: new Date() },
    });

    // Delete from R2 (async, don't wait)
    this.r2Client.deleteFile(upload.storageKey).catch((err) => {
      console.error("Failed to delete file from R2:", err);
    });
  }

  /**
   * Mark upload as used in a project
   */
  async markAsUsed(
    uploadId: string,
    projectId: string,
    userId: string,
  ): Promise<void> {
    const upload = await prisma.upload.findFirst({
      where: {
        id: uploadId,
        OR: [{ userId }, { team: { members: { some: { userId } } } }],
      },
    });

    if (!upload) {
      throw new Error("Upload not found");
    }

    // Add projectId to usedInProjects if not already there
    const usedInProjects = upload.usedInProjects as string[];
    if (!usedInProjects.includes(projectId)) {
      await prisma.upload.update({
        where: { id: uploadId },
        data: {
          usedInProjects: [...usedInProjects, projectId],
          lastUsedAt: new Date(),
        },
      });
    }
  }

  /**
   * Server-side upload from base64 (for migration/backward compatibility)
   */
  async uploadFromBase64(
    base64Data: string,
    filename: string,
    mimeType: string,
    userId: string,
    teamId?: string,
  ): Promise<Upload> {
    // Decode base64
    const buffer = Buffer.from(base64Data, "base64");

    // Auto-detect upload type
    const uploadType = getUploadTypeFromMimeType(mimeType);

    // Validate size
    const config = UPLOAD_CONFIGS[uploadType];
    if (buffer.length > config.maxSize) {
      throw new Error(
        `File size exceeds ${config.maxSize / (1024 * 1024)}MB limit`,
      );
    }

    // Generate storage key
    const storageKey = R2Client.generateStorageKey(
      uploadType,
      userId,
      filename,
      teamId,
    );

    // Upload to R2
    await this.r2Client.uploadFile(storageKey, buffer, mimeType);

    // Create DB record
    const upload = await prisma.upload.create({
      data: {
        filename,
        originalName: filename,
        mimeType,
        size: buffer.length,
        storageKey,
        url: this.r2Client.getPublicUrl(storageKey),
        uploadType,
        userId,
        teamId,
        tags: [],
        usedInProjects: [],
      },
    });

    return this.mapToUpload(upload);
  }

  /**
   * Server-side upload from buffer (for AI-generated images)
   * Supports tags and project association
   */
  async uploadFromBuffer(
    buffer: Buffer,
    filename: string,
    mimeType: string,
    userId: string,
    options?: {
      teamId?: string;
      projectId?: string;
      tags?: string[];
      description?: string;
    },
  ): Promise<Upload> {
    // Auto-detect upload type
    const uploadType = getUploadTypeFromMimeType(mimeType);

    // Validate size
    const config = UPLOAD_CONFIGS[uploadType];
    if (buffer.length > config.maxSize) {
      throw new Error(
        `File size exceeds ${config.maxSize / (1024 * 1024)}MB limit`,
      );
    }

    // Generate storage key
    const storageKey = R2Client.generateStorageKey(
      uploadType,
      userId,
      filename,
      options?.teamId,
    );

    // Upload to R2
    await this.r2Client.uploadFile(storageKey, buffer, mimeType);

    // Create DB record
    const upload = await prisma.upload.create({
      data: {
        filename,
        originalName: filename,
        mimeType,
        size: buffer.length,
        storageKey,
        url: this.r2Client.getPublicUrl(storageKey),
        uploadType,
        userId,
        teamId: options?.teamId,
        tags: options?.tags || [],
        description: options?.description,
        usedInProjects: options?.projectId ? [options.projectId] : [],
      },
    });

    return this.mapToUpload(upload);
  }

  /**
   * Map Prisma model to Upload type
   */
  private mapToUpload(upload: any): Upload {
    return {
      id: upload.id,
      filename: upload.filename,
      originalName: upload.originalName,
      mimeType: upload.mimeType,
      size: upload.size,
      url: upload.url,
      thumbnailUrl: upload.thumbnailUrl || undefined,
      uploadType: upload.uploadType as UploadType,
      width: upload.width || undefined,
      height: upload.height || undefined,
      tags: upload.tags || [],
      description: upload.description || undefined,
      usedInProjects: upload.usedInProjects || [],
      lastUsedAt: upload.lastUsedAt || undefined,
      createdAt: upload.createdAt,
    };
  }

  /**
   * Sync all project-associated image uploads to the sandbox's public/images folder.
   * This is called when the sandbox is first initialized to ensure uploaded images
   * are available in the project.
   */
  async syncProjectUploadsToSandbox(
    projectId: string,
    sandboxId: string,
  ): Promise<{ synced: number; failed: number }> {
    let synced = 0;
    let failed = 0;

    try {
      // Find all image uploads associated with this project
      const uploads = await prisma.upload.findMany({
        where: {
          usedInProjects: {
            has: projectId,
          },
          uploadType: "IMAGE",
          deletedAt: null,
        },
        orderBy: { createdAt: "desc" },
      });

      console.log(
        `[UploadService] Found ${uploads.length} images to sync for project ${projectId}`,
      );

      for (const upload of uploads) {
        try {
          // Download file from R2
          const { buffer } = await this.r2Client.getFileBuffer(
            upload.storageKey,
          );

          // Write to sandbox's public/images folder
          const sandboxPath = `public/images/${upload.filename}`;
          await writeFileBinary(sandboxId, sandboxPath, buffer);

          synced++;
          console.log(`[UploadService] Synced ${upload.filename} to sandbox`);
        } catch (error) {
          failed++;
          console.warn(
            `[UploadService] Failed to sync ${upload.filename}:`,
            error instanceof Error ? error.message : String(error),
          );
        }
      }

      console.log(
        `[UploadService] Sync complete: ${synced} synced, ${failed} failed`,
      );
    } catch (error) {
      console.error(
        `[UploadService] Error syncing uploads to sandbox:`,
        error instanceof Error ? error.message : String(error),
      );
    }

    return { synced, failed };
  }
}
