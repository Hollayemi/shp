import { Router, Request, Response } from 'express';
import { z } from 'zod';
import type { ApiResponse } from '@shipper/shared';
import { UploadService } from '../services/upload-service.js';
import { validateSession } from '../middleware/session-auth.js';

const router: Router = Router();
const uploadService = new UploadService();

// Apply session validation to all upload routes
router.use(validateSession);

// Validation schemas
const presignedUploadSchema = z.object({
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  size: z.number().positive(),
  uploadType: z.enum(['IMAGE', 'DOCUMENT', 'VIDEO', 'AUDIO', 'OTHER']),
  teamId: z.string().optional(),
  metadata: z.object({
    width: z.number().optional(),
    height: z.number().optional(),
    tags: z.array(z.string()).optional(),
    description: z.string().optional(),
  }).optional(),
});

const completeUploadSchema = z.object({
  uploadId: z.string(),
});

const libraryFiltersSchema = z.object({
  uploadType: z.enum(['IMAGE', 'DOCUMENT', 'VIDEO', 'AUDIO', 'OTHER']).optional(),
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
router.post('/request-presigned', async (req: Request, res: Response) => {
  try {
    const parsed = presignedUploadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: parsed.error.issues,
      });
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const result = await uploadService.requestPresignedUpload(parsed.data, req.user.id);

    req.logger?.info({ uploadId: result.uploadId, filename: parsed.data.filename }, 'Presigned upload requested');

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    req.logger?.error({ error }, 'Error requesting presigned upload');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to request upload',
    });
  }
});

/**
 * POST /api/v1/upload/complete
 * Complete upload after client uploads to R2
 */
router.post('/complete', async (req: Request, res: Response) => {
  try {
    const parsed = completeUploadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
      });
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const result = await uploadService.completeUpload(parsed.data, req.user.id);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    req.logger?.error({ error }, 'Error completing upload');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to complete upload',
    });
  }
});

/**
 * GET /api/v1/upload/library
 * Get user's media library
 */
router.get('/library', async (req: Request, res: Response) => {
  try {
    const parsed = libraryFiltersSchema.safeParse({
      uploadType: req.query.uploadType,
      tags: req.query.tags ? JSON.parse(req.query.tags as string) : undefined,
      search: req.query.search,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      cursor: req.query.cursor,
    });

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
      });
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const result = await uploadService.getLibrary(req.user.id, parsed.data);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    req.logger?.error({ error }, 'Error getting library');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get library',
    });
  }
});

/**
 * GET /api/v1/upload/:uploadId
 * Get single upload
 */
router.get('/:uploadId', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const result = await uploadService.getUpload(req.params.uploadId, req.user.id);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    req.logger?.error({ error }, 'Error getting upload');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get upload',
    });
  }
});

/**
 * PATCH /api/v1/upload/metadata
 * Update upload metadata
 */
router.patch('/metadata', async (req: Request, res: Response) => {
  try {
    const parsed = updateMetadataSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
      });
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const result = await uploadService.updateMetadata(parsed.data, req.user.id);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    req.logger?.error({ error }, 'Error updating metadata');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update metadata',
    });
  }
});

/**
 * DELETE /api/v1/upload/:uploadId
 * Delete upload
 */
router.delete('/:uploadId', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    await uploadService.deleteUpload(req.params.uploadId, req.user.id);

    res.json({
      success: true,
    });
  } catch (error) {
    req.logger?.error({ error }, 'Error deleting upload');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete upload',
    });
  }
});

/**
 * POST /api/v1/upload/mark-used
 * Mark upload as used in a project
 */
router.post('/mark-used', async (req: Request, res: Response) => {
  try {
    const { uploadId, projectId } = req.body;
    if (!uploadId || !projectId) {
      return res.status(400).json({
        success: false,
        error: 'uploadId and projectId are required',
      });
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    await uploadService.markAsUsed(uploadId, projectId, req.user.id);

    res.json({
      success: true,
    });
  } catch (error) {
    req.logger?.error({ error }, 'Error marking upload as used');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to mark upload as used',
    });
  }
});

export default router;
