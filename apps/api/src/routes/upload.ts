import { Router, Request, Response } from "express";
import { z } from "zod";
import type { ApiResponse } from "@shipper/shared";
import { UploadService } from "../services/upload-service.js";
import { validateSession } from "../middleware/session-auth.js";

const router: Router = Router();
const uploadService = new UploadService();

// Apply session validation to all upload routes
router.use(validateSession);

// Validation schemas
const presignedUploadSchema = z.object({
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  size: z.number().positive(),
  uploadType: z.enum(["IMAGE", "DOCUMENT", "VIDEO", "AUDIO", "OTHER"]),
  teamId: z.string().optional(),
  projectId: z.string().optional(),
  metadata: z
    .object({
      width: z.number().optional(),
      height: z.number().optional(),
      tags: z.array(z.string()).optional(),
      description: z.string().optional(),
    })
    .optional(),
});

const completeUploadSchema = z.object({
  uploadId: z.string(),
});

const libraryFiltersSchema = z.object({
  projectId: z.string().optional(),
  uploadType: z
    .enum(["IMAGE", "DOCUMENT", "VIDEO", "AUDIO", "OTHER"])
    .optional(),
  tags: z.array(z.string()).optional(),
  search: z.string().optional(),
  limit: z.number().min(1).max(100).optional(),
  cursor: z.string().optional(),
});

const updateMetadataSchema = z.object({
  uploadId: z.string(),
  tags: z.array(z.string()).optional(),
  description: z.string().optional(),
});

/**
 * POST /api/v1/upload/request-presigned
 * Request presigned upload URL
 */
router.post("/request-presigned", async (req: Request, res: Response) => {
  try {
    const parsed = presignedUploadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request body",
        details: parsed.error.issues,
      });
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    const result = await uploadService.requestPresignedUpload(
      parsed.data,
      req.user.id,
    );

    req.logger?.info(
      { uploadId: result.uploadId, filename: parsed.data.filename },
      "Presigned upload requested",
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    req.logger?.error({ error }, "Error requesting presigned upload");
    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to request upload",
    });
  }
});

/**
 * POST /api/v1/upload/complete
 * Complete upload after client uploads to R2
 */
router.post("/complete", async (req: Request, res: Response) => {
  try {
    const parsed = completeUploadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request body",
      });
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    const result = await uploadService.completeUpload(parsed.data, req.user.id);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    req.logger?.error({ error }, "Error completing upload");
    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to complete upload",
    });
  }
});

/**
 * GET /api/v1/upload/library
 * Get user's media library
 */
router.get("/library", async (req: Request, res: Response) => {
  try {
    const parsed = libraryFiltersSchema.safeParse({
      projectId: req.query.projectId,
      uploadType: req.query.uploadType,
      tags: req.query.tags ? JSON.parse(req.query.tags as string) : undefined,
      search: req.query.search,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      cursor: req.query.cursor,
    });

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid query parameters",
      });
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    const result = await uploadService.getLibrary(req.user.id, parsed.data);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    req.logger?.error({ error }, "Error getting library");
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to get library",
    });
  }
});

/**
 * GET /api/v1/upload/:uploadId/download
 * Download an upload (streams from R2, or redirects to public URL as fallback)
 */
router.get("/:uploadId/download", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    // First, get the upload record to verify access
    const upload = await uploadService.getUpload(
      req.params.uploadId,
      req.user.id,
    );

    if (!upload) {
      return res.status(404).json({
        success: false,
        error: "Upload not found",
      });
    }

    // Try streaming from R2, fallback to redirect if R2 streaming fails
    try {
      const { stream, filename, mimeType, size } =
        await uploadService.getDownloadStream(req.params.uploadId, req.user.id);

      // Build Content-Disposition header with proper filename encoding
      const encodedFilename = encodeURIComponent(filename).replace(
        /['()]/g,
        escape,
      );
      res.setHeader("Content-Type", mimeType || "application/octet-stream");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`,
      );
      res.setHeader("Cache-Control", "private, max-age=0, must-revalidate");
      if (typeof size === "number" && Number.isFinite(size)) {
        res.setHeader("Content-Length", String(size));
      }

      // If the client aborts, stop reading from storage.
      req.on("aborted", () => {
        try {
          stream.destroy();
        } catch {
          // ignore
        }
      });

      stream.on("error", (error) => {
        req.logger?.error({ error }, "Error streaming download");
        if (!res.headersSent) {
          // Fallback: redirect to public URL
          if (upload.url) {
            return res.redirect(upload.url);
          }
          res
            .status(500)
            .json({ success: false, error: "Failed to download file" });
        } else {
          res.end();
        }
      });

      stream.pipe(res);
    } catch (streamError) {
      // R2 streaming failed - fallback to redirect if we have a public URL
      req.logger?.warn(
        { error: streamError },
        "R2 streaming failed, trying redirect fallback",
      );

      if (upload.url) {
        return res.redirect(upload.url);
      }

      throw streamError;
    }
  } catch (error) {
    req.logger?.error({ error }, "Error downloading upload");
    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to download upload",
    });
  }
});

/**
 * GET /api/v1/upload/:uploadId
 * Get single upload
 */
router.get("/:uploadId", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    const result = await uploadService.getUpload(
      req.params.uploadId,
      req.user.id,
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    req.logger?.error({ error }, "Error getting upload");
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to get upload",
    });
  }
});

/**
 * PATCH /api/v1/upload/metadata
 * Update upload metadata
 */
router.patch("/metadata", async (req: Request, res: Response) => {
  try {
    const parsed = updateMetadataSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request body",
      });
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    const result = await uploadService.updateMetadata(parsed.data, req.user.id);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    req.logger?.error({ error }, "Error updating metadata");
    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update metadata",
    });
  }
});

/**
 * DELETE /api/v1/upload/:uploadId
 * Delete upload
 */
router.delete("/:uploadId", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    await uploadService.deleteUpload(req.params.uploadId, req.user.id);

    res.json({
      success: true,
    });
  } catch (error) {
    req.logger?.error({ error }, "Error deleting upload");
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete upload",
    });
  }
});

/**
 * POST /api/v1/upload/mark-used
 * Mark upload as used in a project
 */
router.post("/mark-used", async (req: Request, res: Response) => {
  try {
    const { uploadId, projectId } = req.body;
    if (!uploadId || !projectId) {
      return res.status(400).json({
        success: false,
        error: "uploadId and projectId are required",
      });
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    await uploadService.markAsUsed(uploadId, projectId, req.user.id);

    res.json({
      success: true,
    });
  } catch (error) {
    req.logger?.error({ error }, "Error marking upload as used");
    res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to mark upload as used",
    });
  }
});

export default router;
