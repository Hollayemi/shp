import {
  Router,
  Request,
  Response,
  type Router as ExpressRouter,
} from "express";
import { z } from "zod";
import type { ApiResponse } from "@shipper/shared";
import {
  getSandbox,
  createSandbox,
  deleteSandbox,
  restoreV2FragmentById,
  restoreFilesById,
  executeCommand,
  readFile,
  writeFile,
  listFiles,
  findFiles,
  createFilesystemSnapshot,
  cleanupOldSnapshots,
  deleteSnapshot,
  deploySandboxApp,
  startDevServer,
} from "../services/modal-sandbox-manager.js";
import {
  ensureSandboxRecovered,
  getSandboxHealth,
} from "../services/sandbox-health.js";

const router: ExpressRouter = Router();

// Validation schemas
const createSandboxSchema = z.object({
  projectId: z.string(),
  fragmentId: z.string().optional().nullable(),
  templateName: z.string().optional(),
  isImportedProject: z.boolean().optional(),
  importedFrom: z.string().optional().nullable(),
});

const restoreFragmentSchema = z.object({
  sandboxId: z.string(),
  fragmentId: z.string(),
  projectId: z.string(),
});

const restoreFilesSchema = z.object({
  sandboxId: z.string(),
  files: z.record(z.string(), z.string()),
});

const executeCommandSchema = z.object({
  sandboxId: z.string(),
  command: z.string(),
  timeoutMs: z.number().optional(),
});

const fileReadSchema = z.object({
  sandboxId: z.string(),
  path: z.string(),
});

const fileWriteSchema = z.object({
  sandboxId: z.string(),
  path: z.string(),
  content: z.string(),
});

const uploadMetadataImageSchema = z.object({
  projectId: z.string(),
  imageType: z.enum(["icon", "shareImage"]),
  base64Data: z.string(),
  fileExtension: z.string(),
});

const getMetadataImageSchema = z.object({
  projectId: z.string(),
  imageType: z.enum(["icon", "shareImage"]),
});

const listFilesSchema = z.object({
  sandboxId: z.string(),
});

const findFilesSchema = z.object({
  sandboxId: z.string(),
  pattern: z.string(),
});

const batchWriteSchema = z.object({
  sandboxId: z.string(),
  files: z.array(
    z.object({
      path: z.string(),
      content: z.string(),
    }),
  ),
});

// Endpoints

/**
 * GET /api/v1/modal/sandbox/:projectId/status
 * Get sandbox status WITHOUT triggering recovery (read-only health check)
 * Used by admin dashboard to check if sandbox is running
 */
router.get(
  "/sandbox/:projectId/status",
  async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;

      req.logger?.info("Getting Modal sandbox status (read-only)");

      const sandboxInfo = await getSandbox(projectId, req.logger);

      if (!sandboxInfo) {
        req.logger?.warn("Modal sandbox not found");
        const response: ApiResponse = {
          success: true,
          data: {
            isActive: false,
            status: "not_found",
            sandboxId: null,
            sandboxUrl: null,
            sandboxExpiresAt: null,
          },
        };
        return res.json(response);
      }

      // Check health but DON'T trigger recovery
      const health = await getSandboxHealth(projectId, req.logger);

      const response: ApiResponse = {
        success: true,
        data: {
          isActive: !health.broken,
          status: health.broken ? "unhealthy" : "running",
          sandboxId: sandboxInfo.sandboxId,
          sandboxUrl: sandboxInfo.sandboxUrl,
          sandboxExpiresAt: sandboxInfo.sandboxExpiresAt,
          healthReason: health.reason,
          missingFiles: health.missingFiles,
        },
      };

      res.json(response);
    } catch (error) {
      req.logger?.error({
        msg: "Error getting Modal sandbox status",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      const response: ApiResponse = {
        success: true,
        data: {
          isActive: false,
          status: "terminated",
          sandboxId: null,
          sandboxUrl: null,
          sandboxExpiresAt: null,
          error: error instanceof Error ? error.message : "Unknown error",
        },
      };
      res.json(response);
    }
  },
);

/**
 * GET /api/v1/modal/sandbox/:projectId
 * Get sandbox information for a project
 * This endpoint WILL trigger automatic recovery if sandbox is unhealthy
 */
router.get("/sandbox/:projectId", async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;

    req.logger?.info("Getting Modal sandbox for project");

    let sandboxInfo = await getSandbox(projectId, req.logger);

    if (!sandboxInfo) {
      req.logger?.warn("Modal sandbox not found");
      const response: ApiResponse = {
        success: false,
        error: "Sandbox not found",
      };
      return res.status(404).json(response);
    }

    const health = await getSandboxHealth(projectId, req.logger);

    if (health.broken) {
      req.logger?.warn({
        msg: "Modal sandbox unhealthy, triggering recovery",
        projectId,
        sandboxId: sandboxInfo.sandboxId,
        reason: health.reason,
        missingFiles: health.missingFiles,
      });

      const recovery = await ensureSandboxRecovered(projectId, {
        logger: req.logger,
      });

      req.logger?.info({
        msg: "Modal sandbox recovery attempted during project load",
        projectId,
        recovered: recovery.recovered,
        sandboxId: recovery.sandboxId,
      });

      sandboxInfo = await getSandbox(projectId, req.logger);

      if (!sandboxInfo) {
        const response: ApiResponse = {
          success: false,
          error:
            "Sandbox recovery is still in progress. Please reload in a few seconds.",
        };
        return res.status(503).json(response);
      }
    }

    req.logger?.info({
      msg: "Modal sandbox retrieved successfully",
      sandboxId: sandboxInfo.sandboxId,
    });

    const response: ApiResponse = {
      success: true,
      data: {
        sandboxId: sandboxInfo.sandboxId,
        sandboxUrl: sandboxInfo.sandboxUrl,
        originalSandboxUrl: sandboxInfo.originalSandboxUrl,
        sandboxExpiresAt: sandboxInfo.sandboxExpiresAt,
      },
    };

    res.json(response);
  } catch (error) {
    req.logger?.error({
      msg: "Error getting Modal sandbox",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/v1/modal/sandbox/start-dev-server
 * Start dev server in an existing Modal sandbox
 */
router.post(
  "/sandbox/start-dev-server",
  async (req: Request, res: Response) => {
    try {
      const validatedData = z
        .object({
          sandboxId: z.string(),
          projectId: z.string(),
          port: z.number().optional().default(8080),
        })
        .parse(req.body);

      const { sandboxId, projectId, port } = validatedData;

      req.logger?.info({
        msg: "Starting dev server in Modal sandbox",
        sandboxId,
        projectId,
        port,
      });

      const devServerUrl = await startDevServer(
        sandboxId,
        projectId,
        port,
        req.logger,
      );

      req.logger?.info({
        msg: "Dev server started successfully",
        sandboxId,
        devServerUrl,
      });

      res.json({
        success: true,
        data: { devServerUrl },
      });
    } catch (error) {
      req.logger?.error({
        msg: "Error starting dev server",
        error: error instanceof Error ? error.message : String(error),
      });

      res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to start dev server",
      });
    }
  },
);

/**
 * POST /api/v1/modal/sandbox
 * Create a new Modal sandbox
 */
router.post("/sandbox", async (req: Request, res: Response) => {
  try {
    const validatedData = createSandboxSchema.parse(req.body);
    const {
      projectId,
      fragmentId,
      templateName,
      isImportedProject,
      importedFrom,
    } = validatedData;

    console.log(validatedData)

    req.logger?.info({
      msg: "Creating Modal sandbox",
      fragmentId,
      templateName,
      isImportedProject,
      importedFrom,
    });

    const sandboxInfo = await createSandbox(
      projectId,
      fragmentId || null,
      templateName,
      req.logger,
      { isImportedProject: isImportedProject ?? false, importedFrom },
    );

    req.logger?.info({
      msg: "Modal sandbox created successfully",
      sandboxId: sandboxInfo.sandboxId,
    });

    const response: ApiResponse = {
      success: true,
      data: {
        sandboxId: sandboxInfo.sandboxId,
        sandboxUrl: sandboxInfo.sandboxUrl,
        originalSandboxUrl: sandboxInfo.originalSandboxUrl,
        sandboxExpiresAt: sandboxInfo.sandboxExpiresAt,
      },
    };

    res.json(response);
  } catch (error) {
    req.logger?.error({
      msg: "Error creating Modal sandbox",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
    res.status(500).json(response);
  }
});

/**
 * DELETE /api/v1/modal/sandbox/:sandboxId
 * Delete a Modal sandbox
 */
router.delete("/sandbox/:sandboxId", async (req: Request, res: Response) => {
  try {
    const { sandboxId } = req.params;

    req.logger?.info({ msg: "Deleting Modal sandbox", sandboxId });

    await deleteSandbox(sandboxId);

    req.logger?.info({ msg: "Modal sandbox deleted", sandboxId });

    const response: ApiResponse = {
      success: true,
    };

    res.json(response);
  } catch (error) {
    req.logger?.error({
      msg: "Error deleting Modal sandbox",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/v1/modal/fragment/restore
 * Restore a V2 fragment in the sandbox
 */
router.post("/fragment/restore", async (req: Request, res: Response) => {
  try {
    const validatedData = restoreFragmentSchema.parse(req.body);
    const { sandboxId, fragmentId, projectId } = validatedData;

    req.logger?.info({
      msg: "Restoring fragment in Modal sandbox",
      sandboxId,
      fragmentId,
    });

    await restoreV2FragmentById(sandboxId, fragmentId, projectId);

    req.logger?.info({
      msg: "Fragment restored successfully",
      sandboxId,
      fragmentId,
    });

    const response: ApiResponse = {
      success: true,
    };

    res.json(response);
  } catch (error) {
    req.logger?.error({
      msg: "Error restoring fragment",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/v1/modal/files/restore
 * Restore files in the sandbox
 */
router.post("/files/restore", async (req: Request, res: Response) => {
  try {
    const validatedData = restoreFilesSchema.parse(req.body);
    const { sandboxId, files } = validatedData;

    const fileCount = Object.keys(files).length;
    req.logger?.info({
      msg: "Restoring files in Modal sandbox",
      sandboxId,
      fileCount,
    });

    await restoreFilesById(sandboxId, files);

    req.logger?.info({
      msg: "Files restored successfully",
      sandboxId,
      fileCount,
    });

    const response: ApiResponse = {
      success: true,
    };

    res.json(response);
  } catch (error) {
    req.logger?.error({
      msg: "Error restoring files",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/v1/modal/command/execute
 * Execute a command in the sandbox
 */
router.post("/command/execute", async (req: Request, res: Response) => {
  try {
    const validatedData = executeCommandSchema.parse(req.body);
    const { sandboxId, command, timeoutMs } = validatedData;

    req.logger?.info({
      msg: "Executing command in Modal sandbox",
      sandboxId,
      command,
    });

    const result = await executeCommand(sandboxId, command, { timeoutMs });

    req.logger?.info({
      msg: "Command executed",
      sandboxId,
      exitCode: result.exitCode,
    });

    const response: ApiResponse = {
      success: true,
      data: result,
    };

    res.json(response);
  } catch (error) {
    req.logger?.error({
      msg: "Error executing command",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/v1/modal/file/read
 * Read a file from the sandbox
 */
router.post("/file/read", async (req: Request, res: Response) => {
  try {
    const validatedData = fileReadSchema.parse(req.body);
    const { sandboxId, path } = validatedData;

    req.logger?.info({
      msg: "Reading file from Modal sandbox",
      sandboxId,
      path,
    });

    const content = await readFile(sandboxId, path);

    // req.logger?.info({ msg: "File read successfully", sandboxId, path });

    const response: ApiResponse = {
      success: true,
      data: { content },
    };

    res.json(response);
  } catch (error) {
    req.logger?.error({
      msg: "Error reading file",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/v1/modal/file/write
 * Write a file to the sandbox
 */
router.post("/file/write", async (req: Request, res: Response) => {
  try {
    const validatedData = fileWriteSchema.parse(req.body);
    const { sandboxId, path, content } = validatedData;

    req.logger?.info({ msg: "Writing file to Modal sandbox", sandboxId, path });

    await writeFile(sandboxId, path, content);

    req.logger?.info({ msg: "File written successfully", sandboxId, path });

    const response: ApiResponse = {
      success: true,
    };

    res.json(response);
  } catch (error) {
    req.logger?.error({
      msg: "Error writing file",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/v1/modal/metadata/get-image
 * Get metadata image (icon or share image) from sandbox as base64 data URL
 */
router.get("/metadata/get-image", async (req: Request, res: Response) => {
  try {
    const validatedData = getMetadataImageSchema.parse(req.query);
    const { projectId, imageType } = validatedData;

    req.logger?.info({
      msg: "Getting metadata image from Modal sandbox",
      projectId,
      imageType,
    });

    // Get the Modal sandbox instance
    const sandboxInfo = await getSandbox(projectId, req.logger);
    if (!sandboxInfo) {
      throw new Error("Sandbox not found");
    }

    // Determine path based on image type and find the file
    const filePrefix = imageType === "icon" ? "favicon" : "share-image";
    const searchPattern = `${filePrefix}.*`;

    // Find files matching the pattern (findFiles uses -name which only matches filename)
    const matchingFiles = await findFiles(
      sandboxInfo.sandboxId,
      searchPattern,
      req.logger,
    );

    // Filter to only get files from the correct directory
    const targetDir = imageType === "icon" ? "public/" : "public/images/";
    const filteredFiles = matchingFiles.filter((file) => {
      const normalizedPath = file.startsWith(targetDir);
      return normalizedPath;
    });

    if (filteredFiles.length === 0) {
      const response: ApiResponse = {
        success: false,
        error: "Image not found",
      };
      return res.status(404).json(response);
    }

    // Use the first matching file
    const imageFile = filteredFiles[0];

    // Read binary data
    const fullPath = `/workspace/${imageFile}`;
    const file = await sandboxInfo.sandbox.open(fullPath, "r");
    const data = await file.read();
    await file.close();

    // Convert to base64
    const base64Data = Buffer.from(data).toString("base64");

    // Determine MIME type from file extension
    const ext = imageFile.split(".").pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml",
    };
    const mimeType = mimeTypes[ext || ""] || "application/octet-stream";
    const dataUrl = `data:${mimeType};base64,${base64Data}`;

    req.logger?.info({
      msg: "Metadata image retrieved successfully",
      projectId,
      imageType,
      file: imageFile,
      size: data.length,
    });

    const response: ApiResponse = {
      success: true,
      data: {
        dataUrl,
        mimeType,
        filename: imageFile.split("/").pop(),
      },
    };

    res.json(response);
  } catch (error) {
    req.logger?.error({
      msg: "Error getting metadata image",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/v1/modal/metadata/upload-image
 * Upload metadata images (icon/favicon or share image) to sandbox
 */
router.post("/metadata/upload-image", async (req: Request, res: Response) => {
  try {
    const validatedData = uploadMetadataImageSchema.parse(req.body);
    const { projectId, imageType, base64Data, fileExtension } = validatedData;

    req.logger?.info({
      msg: "Uploading metadata image to Modal sandbox",
      projectId,
      imageType,
    });

    // Get the Modal sandbox instance
    const sandboxInfo = await getSandbox(projectId, req.logger);
    if (!sandboxInfo) {
      throw new Error("Sandbox not found");
    }

    // Determine file path based on image type
    const filename =
      imageType === "icon"
        ? `favicon.${fileExtension}`
        : `share-image.${fileExtension}`;
    const path =
      imageType === "icon" ? `public/${filename}` : `public/images/${filename}`;

    // Convert base64 to Buffer
    const imageBuffer = Buffer.from(base64Data, "base64");

    // Ensure parent directory exists
    const dirPath = path.substring(0, path.lastIndexOf("/"));
    if (dirPath) {
      await sandboxInfo.sandbox.exec(["mkdir", "-p", `/workspace/${dirPath}`]);
    }

    // Write binary data directly as Uint8Array
    const fullPath = `/workspace/${path}`;
    const file = await sandboxInfo.sandbox.open(fullPath, "w");
    await file.write(new Uint8Array(imageBuffer));
    await file.close();

    req.logger?.info({
      msg: "Metadata image uploaded successfully",
      projectId,
      imageType,
      path,
      size: imageBuffer.length,
    });

    const response: ApiResponse = {
      success: true,
      data: {
        path,
        filename,
        url: imageType === "icon" ? `/${filename}` : `/images/${filename}`,
      },
    };

    res.json(response);
  } catch (error) {
    req.logger?.error({
      msg: "Error uploading metadata image",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/v1/modal/files/list
 * List all files in the sandbox
 */
router.post("/files/list", async (req: Request, res: Response) => {
  try {
    const validatedData = listFilesSchema.parse(req.body);
    const { sandboxId } = validatedData;

    req.logger?.info({ msg: "Listing files in Modal sandbox", sandboxId });

    const filesMap = await listFiles(sandboxId);

    // Convert Map to Object for JSON serialization
    const filesObject: Record<string, { size: number; modified: number }> = {};
    filesMap.forEach((value, key) => {
      filesObject[key] = value;
    });

    req.logger?.info({
      msg: "Files listed successfully",
      sandboxId,
      fileCount: filesMap.size,
    });

    const response: ApiResponse = {
      success: true,
      data: { files: filesObject },
    };

    res.json(response);
  } catch (error) {
    req.logger?.error({
      msg: "Error listing files",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/v1/modal/files/find
 * Find files matching a pattern in the sandbox
 */
router.post("/files/find", async (req: Request, res: Response) => {
  try {
    const validatedData = findFilesSchema.parse(req.body);
    const { sandboxId, pattern } = validatedData;

    req.logger?.info({
      msg: "Finding files in Modal sandbox",
      sandboxId,
      pattern,
    });

    const files = await findFiles(sandboxId, pattern);

    req.logger?.info({
      msg: "Files found",
      sandboxId,
      pattern,
      matchCount: files.length,
    });

    const response: ApiResponse = {
      success: true,
      data: { files },
    };

    res.json(response);
  } catch (error) {
    req.logger?.error({
      msg: "Error finding files",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/v1/modal/files/batch-write
 * Write multiple files to the sandbox in a single request
 */
router.post("/files/batch-write", async (req: Request, res: Response) => {
  try {
    const validatedData = batchWriteSchema.parse(req.body);
    const { sandboxId, files } = validatedData;

    req.logger?.info({
      msg: "Batch writing files to Modal sandbox",
      sandboxId,
      fileCount: files.length,
    });

    const results = [];

    for (const file of files) {
      try {
        await writeFile(sandboxId, file.path, file.content);
        results.push({ path: file.path, success: true });
      } catch (error) {
        results.push({
          path: file.path,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    req.logger?.info({
      msg: "Batch write completed",
      sandboxId,
      total: files.length,
      successful: successCount,
      failed: files.length - successCount,
    });

    const response: ApiResponse = {
      success: true,
      data: { results },
    };

    res.json(response);
  } catch (error) {
    req.logger?.error({
      msg: "Error batch writing files",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
    res.status(500).json(response);
  }
});

// Snapshot Management Endpoints

const createSnapshotSchema = z.object({
  sandboxId: z.string(),
  fragmentId: z.string(),
  projectId: z.string(),
});

const cleanupSnapshotsSchema = z.object({
  projectId: z.string(),
  keepCount: z.number().optional().default(10),
});

const deleteSnapshotSchema = z.object({
  imageId: z.string(),
});

const deploySandboxSchema = z.object({
  sandboxId: z.string(),
  projectId: z.string(),
  appName: z.string().optional(),
});

/**
 * POST /api/v1/modal/snapshot/create
 * Create a filesystem snapshot of the current sandbox state
 */
router.post("/snapshot/create", async (req: Request, res: Response) => {
  try {
    const parsed = createSnapshotSchema.safeParse(req.body);

    if (!parsed.success) {
      req.logger?.warn({
        msg: "Invalid snapshot request",
        error: parsed.error.message,
      });
      const response: ApiResponse = {
        success: false,
        error: parsed.error.message,
      };
      return res.status(400).json(response);
    }

    const { sandboxId, fragmentId, projectId } = parsed.data;

    req.logger?.info({
      msg: "Creating Modal snapshot",
      sandboxId,
      fragmentId,
    });

    // Get the sandbox instance
    const sandboxInfo = await getSandbox(projectId);
    if (!sandboxInfo?.sandbox) {
      req.logger?.warn("Sandbox not found for snapshot creation");
      const response: ApiResponse = {
        success: false,
        error: "Sandbox not found",
      };
      return res.status(404).json(response);
    }

    const imageId = await createFilesystemSnapshot(
      sandboxInfo.sandbox,
      fragmentId,
      projectId,
    );

    req.logger?.info({
      msg: "Modal snapshot created successfully",
      imageId,
      fragmentId,
    });

    const response: ApiResponse = {
      success: true,
      data: { imageId, fragmentId },
    };
    res.json(response);
  } catch (error) {
    req.logger?.error({
      msg: "Error creating Modal snapshot",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/v1/modal/snapshot/cleanup
 * Clean up old snapshots for a project
 */
router.post("/snapshot/cleanup", async (req: Request, res: Response) => {
  try {
    const parsed = cleanupSnapshotsSchema.safeParse(req.body);

    if (!parsed.success) {
      req.logger?.warn({
        msg: "Invalid cleanup request",
        error: parsed.error.message,
      });
      const response: ApiResponse = {
        success: false,
        error: parsed.error.message,
      };
      return res.status(400).json(response);
    }

    const { projectId, keepCount } = parsed.data;

    req.logger?.info({
      msg: "Cleaning up Modal snapshots",
      keepCount,
    });

    const result = await cleanupOldSnapshots(projectId, keepCount);

    req.logger?.info({
      msg: "Modal snapshots cleaned up",
      deleted: result.deleted,
      kept: result.kept,
    });

    const response: ApiResponse = {
      success: true,
      data: result,
    };
    res.json(response);
  } catch (error) {
    req.logger?.error({
      msg: "Error cleaning up Modal snapshots",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
    res.status(500).json(response);
  }
});

/**
 * DELETE /api/v1/modal/snapshot/:imageId
 * Delete a specific snapshot by image ID
 */
router.delete("/snapshot/:imageId", async (req: Request, res: Response) => {
  try {
    const { imageId } = req.params;

    req.logger?.info({ msg: "Deleting Modal snapshot", imageId });

    const success = await deleteSnapshot(imageId);

    if (!success) {
      req.logger?.warn({ msg: "Failed to delete Modal snapshot", imageId });
      const response: ApiResponse = {
        success: false,
        error: "Failed to delete snapshot",
      };
      return res.status(500).json(response);
    }

    req.logger?.info({ msg: "Modal snapshot deleted successfully", imageId });

    const response: ApiResponse = {
      success: true,
      data: { imageId, deleted: true },
    };
    res.json(response);
  } catch (error) {
    req.logger?.error({
      msg: "Error deleting Modal snapshot",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/v1/modal/deploy
 * Deploy sandbox contents to deployment plane
 */
router.post("/deploy", async (req: Request, res: Response) => {
  try {
    const parsed = deploySandboxSchema.safeParse(req.body);

    if (!parsed.success) {
      req.logger?.warn({
        msg: "Invalid deploy request",
        error: parsed.error.message,
      });
      const response: ApiResponse = {
        success: false,
        error: parsed.error.message,
      };
      return res.status(400).json(response);
    }

    const { sandboxId, projectId, appName } = parsed.data;

    req.logger?.info({
      msg: "Deploying Modal sandbox",
      sandboxId,
      projectId,
      appName,
    });

    // Get the sandbox instance
    const sandboxInfo = await getSandbox(projectId, req.logger);
    if (!sandboxInfo?.sandbox) {
      req.logger?.warn("Sandbox not found for deployment");
      const response: ApiResponse = {
        success: false,
        error: "Sandbox not found",
      };
      return res.status(404).json(response);
    }

    const deploymentResult = await deploySandboxApp(
      sandboxInfo.sandbox,
      projectId,
      appName,
      req.logger,
    );

    req.logger?.info({
      msg: "Modal deployment completed",
      sandboxId,
      success: deploymentResult.success,
      deploymentUrl: deploymentResult.deploymentUrl,
      hasError: !!deploymentResult.error,
    });

    // Always return 200 with the deployment result, even if success: false
    // This allows the client to properly handle build errors and other failures
    const response: ApiResponse = {
      success: true, // API call succeeded, even if deployment failed
      data: deploymentResult,
    };
    res.json(response);
  } catch (error) {
    req.logger?.error({
      msg: "Error deploying Modal sandbox",
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Return error details in a format the client can handle
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const response: ApiResponse = {
      success: true, // API call succeeded, but deployment failed
      data: {
        success: false,
        error: errorMessage,
        logs: errorMessage,
      },
    };
    res.json(response);
  }
});

// GET /sandbox/:projectId/debug - Debug sandbox state (processes, ports, logs)
router.get("/sandbox/:projectId/debug", async (req: Request, res: Response) => {
  const { projectId } = req.params;

  try {
    const sandboxInfo = await getSandbox(projectId, req.logger);
    if (!sandboxInfo) {
      res.status(404).json({ success: false, error: "Sandbox not found" });
      return;
    }

    // Check running processes
    const psResult = await executeCommand(
      sandboxInfo.sandboxId,
      'sh -c \'ps aux | grep -E "vite|bun|node" | grep -v grep || echo "(no matching processes)"\'',
    );

    // Check what's on port 5173
    const portResult = await executeCommand(
      sandboxInfo.sandboxId,
      "sh -c 'ss -tlnp | grep 5173 || echo \"(nothing on port 5173)\"'",
    );

    // Check vite.log (that's where createViteDevServerCommand writes)
    const logResult = await executeCommand(
      sandboxInfo.sandboxId,
      "sh -c 'tail -n 50 /tmp/vite.log 2>/dev/null || echo \"(no vite.log)\"'",
    );

    // Check .env file
    const envResult = await executeCommand(
      sandboxInfo.sandboxId,
      "sh -c 'cat .env 2>/dev/null || echo \"(no .env)\"'",
    );

    res.json({
      success: true,
      data: {
        sandboxId: sandboxInfo.sandboxId,
        sandboxUrl: sandboxInfo.sandboxUrl,
        processes: psResult.stdout || "(empty)",
        port5173: portResult.stdout || "(empty)",
        devLog: logResult.stdout || "(empty)",
        envFile: envResult.stdout || "(empty)",
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// GET /sandbox/:projectId/dev-logs - Read dev server logs from sandbox
router.get(
  "/sandbox/:projectId/dev-logs",
  async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const lines = parseInt(req.query.lines as string) || 100;

    req.logger?.info({ msg: "Reading dev server logs", projectId, lines });

    try {
      const sandboxInfo = await getSandbox(projectId, req.logger);
      if (!sandboxInfo) {
        res.status(404).json({ success: false, error: "Sandbox not found" });
        return;
      }

      const result = await executeCommand(
        sandboxInfo.sandboxId,
        `sh -c 'tail -n ${lines} /tmp/dev.log 2>/dev/null || echo "(no dev.log found)"'`,
      );

      res.json({
        success: true,
        data: {
          logs: result.stdout || "(empty)",
          stderr: result.stderr || "",
          exitCode: result.exitCode,
        },
      });
    } catch (error) {
      req.logger?.error({
        msg: "Error reading dev logs",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

export default router;
