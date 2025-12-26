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
  startSandbox,
  startDevServer,
  restoreV2FragmentInSandbox,
  createGitCommit,
  switchToGitCommit,
  restoreFilesInSandbox,
} from "../services/daytona-sandbox-manager.js";
import {
  runPlaywrightRuntimeCheck,
  cleanupPlaywrightSandbox,
  getPlaywrightSandboxStatus,
} from "../services/daytona-playwright-manager.js";
import {
  runCommandOnSandbox,
  readFileFromSandbox,
  writeFileToSandbox,
} from "../services/sandbox-compat.js";
import { daytonaClient } from "../services/daytona.js";

const router: ExpressRouter = Router();

// Validation schemas
const createSandboxSchema = z.object({
  projectId: z.string(),
  fragmentId: z.string().optional().nullable(),
  templateName: z.string().optional(),
});

const startSandboxSchema = z.object({
  sandboxId: z.string(),
});

const startDevServerSchema = z.object({
  projectId: z.string(),
  sandboxId: z.string(),
});

const restoreFragmentSchema = z.object({
  sandboxId: z.string(),
  fragmentId: z.string(),
  projectId: z.string(),
});

const createGitCommitSchema = z.object({
  sandboxId: z.string(),
  projectId: z.string(),
  message: z.string(),
  email: z.string(),
  name: z.string(),
});

const switchGitCommitSchema = z.object({
  sandboxId: z.string(),
  projectId: z.string(),
  commitHash: z.string(),
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

const readFileSchema = z.object({
  sandboxId: z.string(),
  path: z.string(),
});

const writeFileSchema = z.object({
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

const playwrightCheckSchema = z.object({
  targetUrl: z.string(),
  sandboxId: z.string().optional(),
  maxRetries: z.number().optional(),
});

// Sandbox Management Endpoints

/**
 * GET /api/v1/daytona/sandbox/:projectId
 * Get sandbox information for a project
 */
router.get("/sandbox/:projectId", async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { projectId } = req.params;

  // Use req.logger which automatically includes projectId
  req.logger?.info("Getting sandbox information");

  try {
    const sandboxInfo = await getSandbox(projectId);

    if (!sandboxInfo) {
      req.logger?.warn("Sandbox not found");
      const response: ApiResponse = {
        success: false,
        error: "Sandbox not found",
      };
      return res.status(404).json(response);
    }

    const elapsed = Date.now() - startTime;
    req.logger?.info({
      msg: "Sandbox retrieved successfully",
      sandboxId: sandboxInfo.sandbox.id,
      duration: `${elapsed}ms`,
    });

    const response: ApiResponse = {
      success: true,
      data: {
        sandboxId: sandboxInfo.sandbox.id,
        sandboxUrl: sandboxInfo.sandboxUrl,
        sandboxExpiresAt: sandboxInfo.sandboxExpiresAt,
        gitRepositoryUrl: sandboxInfo.gitRepositoryUrl,
        currentBranch: sandboxInfo.currentBranch,
        gitCommitHash: sandboxInfo.gitCommitHash,
      },
    };
    res.json(response);
  } catch (error) {
    const elapsed = Date.now() - startTime;
    req.logger?.error({
      msg: "Failed to get sandbox",
      error: error instanceof Error ? error.message : "Unknown error",
      duration: `${elapsed}ms`,
    });
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get sandbox",
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/v1/daytona/sandbox
 * Create a new sandbox
 */
router.post("/sandbox", async (req: Request, res: Response) => {
  const startTime = Date.now();
  console.log(
    `[API] POST /api/v1/daytona/sandbox - Starting (projectId: ${req.body.projectId})...`,
  );

  try {
    const parsed = createSandboxSchema.safeParse(req.body);
    if (!parsed.success) {
      console.log(
        `[API] POST /api/v1/daytona/sandbox - Invalid request body (400)`,
      );
      const response: ApiResponse = {
        success: false,
        error: "Invalid request body",
      };
      return res.status(400).json(response);
    }

    const { projectId, fragmentId, templateName } = parsed.data;
    console.log(
      `[API] POST /api/v1/daytona/sandbox - Creating sandbox (projectId: ${projectId}, fragmentId: ${fragmentId || "none"}, template: ${templateName || "default"})...`,
    );

    const sandboxInfo = await createSandbox(
      projectId,
      fragmentId,
      templateName,
    );

    const elapsed = Date.now() - startTime;
    console.log(
      `[API] POST /api/v1/daytona/sandbox - Success (sandboxId: ${sandboxInfo.sandbox.id}, ${elapsed}ms)`,
    );

    const response: ApiResponse = {
      success: true,
      data: {
        sandboxId: sandboxInfo.sandbox.id,
        sandboxUrl: sandboxInfo.sandboxUrl,
        sandboxExpiresAt: sandboxInfo.sandboxExpiresAt,
        gitRepositoryUrl: sandboxInfo.gitRepositoryUrl,
        currentBranch: sandboxInfo.currentBranch,
        gitCommitHash: sandboxInfo.gitCommitHash,
      },
    };
    res.json(response);
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(
      `[API] POST /api/v1/daytona/sandbox - Error (${elapsed}ms):`,
      error,
    );
    const response: ApiResponse = {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to create sandbox",
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/v1/daytona/sandbox/start
 * Start a sandbox
 */
router.post("/sandbox/start", async (req: Request, res: Response) => {
  try {
    const parsed = startSandboxSchema.safeParse(req.body);
    if (!parsed.success) {
      const response: ApiResponse = {
        success: false,
        error: "Invalid request body",
      };
      return res.status(400).json(response);
    }

    const { sandboxId } = parsed.data;
    await startSandbox(sandboxId);

    const response: ApiResponse = {
      success: true,
      data: { message: "Sandbox started successfully" },
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to start sandbox",
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/v1/daytona/sandbox/dev-server
 * Start dev server in sandbox
 */
router.post("/sandbox/dev-server", async (req: Request, res: Response) => {
  try {
    const parsed = startDevServerSchema.safeParse(req.body);
    if (!parsed.success) {
      const response: ApiResponse = {
        success: false,
        error: "Invalid request body",
      };
      return res.status(400).json(response);
    }

    const { projectId, sandboxId } = parsed.data;
    const sandbox = await daytonaClient.findOne({ id: sandboxId });

    if (!sandbox) {
      const response: ApiResponse = {
        success: false,
        error: "Sandbox not found",
      };
      return res.status(404).json(response);
    }

    await startDevServer(sandbox, projectId);

    const response: ApiResponse = {
      success: true,
      data: { message: "Dev server started successfully" },
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to start dev server",
    };
    res.status(500).json(response);
  }
});

/**
 * DELETE /api/v1/daytona/sandbox/:sandboxId
 * Delete a sandbox
 */
router.delete("/sandbox/:sandboxId", async (req: Request, res: Response) => {
  try {
    const { sandboxId } = req.params;
    const sandbox = await daytonaClient.findOne({ id: sandboxId });

    if (!sandbox) {
      const response: ApiResponse = {
        success: false,
        error: "Sandbox not found",
      };
      return res.status(404).json(response);
    }

    await daytonaClient.delete(sandbox);

    const response: ApiResponse = {
      success: true,
      data: { message: "Sandbox deleted successfully" },
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to delete sandbox",
    };
    res.status(500).json(response);
  }
});

// Fragment & Git Operations

/**
 * POST /api/v1/daytona/fragment/restore
 * Restore a V2 fragment in sandbox
 */
router.post("/fragment/restore", async (req: Request, res: Response) => {
  try {
    const parsed = restoreFragmentSchema.safeParse(req.body);
    if (!parsed.success) {
      const response: ApiResponse = {
        success: false,
        error: "Invalid request body",
      };
      return res.status(400).json(response);
    }

    const { sandboxId, fragmentId, projectId } = parsed.data;
    const sandbox = await daytonaClient.findOne({ id: sandboxId });

    if (!sandbox) {
      const response: ApiResponse = {
        success: false,
        error: "Sandbox not found",
      };
      return res.status(404).json(response);
    }

    await restoreV2FragmentInSandbox(sandbox, fragmentId, projectId);

    const response: ApiResponse = {
      success: true,
      data: { message: "Fragment restored successfully" },
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to restore fragment",
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/v1/daytona/git/commit
 * Create a git commit
 */
router.post("/git/commit", async (req: Request, res: Response) => {
  try {
    const parsed = createGitCommitSchema.safeParse(req.body);
    if (!parsed.success) {
      const response: ApiResponse = {
        success: false,
        error: "Invalid request body",
      };
      return res.status(400).json(response);
    }

    const { sandboxId, projectId, message, email, name } = parsed.data;
    const sandbox = await daytonaClient.findOne({ id: sandboxId });

    if (!sandbox) {
      const response: ApiResponse = {
        success: false,
        error: "Sandbox not found",
      };
      return res.status(404).json(response);
    }

    const commitHash = await createGitCommit(
      sandbox,
      projectId,
      message,
      email,
      name,
    );

    const response: ApiResponse = {
      success: true,
      data: { commitHash },
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to create git commit",
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/v1/daytona/git/switch
 * Switch to a git commit
 */
router.post("/git/switch", async (req: Request, res: Response) => {
  try {
    const parsed = switchGitCommitSchema.safeParse(req.body);
    if (!parsed.success) {
      const response: ApiResponse = {
        success: false,
        error: "Invalid request body",
      };
      return res.status(400).json(response);
    }

    const { sandboxId, projectId, commitHash } = parsed.data;
    const sandbox = await daytonaClient.findOne({ id: sandboxId });

    if (!sandbox) {
      const response: ApiResponse = {
        success: false,
        error: "Sandbox not found",
      };
      return res.status(404).json(response);
    }

    await switchToGitCommit(sandbox, projectId, commitHash);

    const response: ApiResponse = {
      success: true,
      data: { message: "Switched to commit successfully" },
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to switch git commit",
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/v1/daytona/files/restore
 * Restore files in sandbox
 */
router.post("/files/restore", async (req: Request, res: Response) => {
  try {
    const parsed = restoreFilesSchema.safeParse(req.body);
    if (!parsed.success) {
      const response: ApiResponse = {
        success: false,
        error: "Invalid request body",
      };
      return res.status(400).json(response);
    }

    const { sandboxId, files } = parsed.data;
    const sandbox = await daytonaClient.findOne({ id: sandboxId });

    if (!sandbox) {
      const response: ApiResponse = {
        success: false,
        error: "Sandbox not found",
      };
      return res.status(404).json(response);
    }

    await restoreFilesInSandbox(sandbox, files as { [path: string]: string });

    const response: ApiResponse = {
      success: true,
      data: { message: "Files restored successfully" },
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to restore files",
    };
    res.status(500).json(response);
  }
});

// File Operations

/**
 * POST /api/v1/daytona/command/execute
 * Execute a command in sandbox
 */
router.post("/command/execute", async (req: Request, res: Response) => {
  const startTime = Date.now();
  const command = req.body.command;
  const sandboxId = req.body.sandboxId;
  console.log(
    `[API] POST /api/v1/daytona/command/execute - Starting (sandboxId: ${sandboxId}, command: ${command?.substring(0, 50)}${command?.length > 50 ? "..." : ""})...`,
  );

  try {
    const parsed = executeCommandSchema.safeParse(req.body);
    if (!parsed.success) {
      console.log(
        `[API] POST /api/v1/daytona/command/execute - Invalid request body (400)`,
      );
      const response: ApiResponse = {
        success: false,
        error: "Invalid request body",
      };
      return res.status(400).json(response);
    }

    const { sandboxId, command, timeoutMs } = parsed.data;
    const sandbox = await daytonaClient.findOne({ id: sandboxId });

    if (!sandbox) {
      console.log(
        `[API] POST /api/v1/daytona/command/execute - Sandbox not found (404, sandboxId: ${sandboxId})`,
      );
      const response: ApiResponse = {
        success: false,
        error: "Sandbox not found",
      };
      return res.status(404).json(response);
    }

    const result = await runCommandOnSandbox(sandbox, command, { timeoutMs });

    const elapsed = Date.now() - startTime;
    console.log(
      `[API] POST /api/v1/daytona/command/execute - Success (sandboxId: ${sandboxId}, exitCode: ${result.exitCode}, ${elapsed}ms)`,
    );

    const response: ApiResponse = {
      success: true,
      data: result,
    };
    res.json(response);
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(
      `[API] POST /api/v1/daytona/command/execute - Error (sandboxId: ${sandboxId}, ${elapsed}ms):`,
      error,
    );
    const response: ApiResponse = {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to execute command",
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/v1/daytona/file/read
 * Read a file from sandbox
 */
router.post("/file/read", async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { sandboxId, path: filePath } = req.body;
  console.log(
    `[API] POST /api/v1/daytona/file/read - Starting (sandboxId: ${sandboxId}, path: ${filePath})...`,
  );

  try {
    const parsed = readFileSchema.safeParse(req.body);
    if (!parsed.success) {
      console.log(
        `[API] POST /api/v1/daytona/file/read - Invalid request body (400)`,
      );
      const response: ApiResponse = {
        success: false,
        error: "Invalid request body",
      };
      return res.status(400).json(response);
    }

    const { sandboxId, path: filePath } = parsed.data;
    const sandbox = await daytonaClient.findOne({ id: sandboxId });

    if (!sandbox) {
      console.log(
        `[API] POST /api/v1/daytona/file/read - Sandbox not found (404, sandboxId: ${sandboxId})`,
      );
      const response: ApiResponse = {
        success: false,
        error: "Sandbox not found",
      };
      return res.status(404).json(response);
    }

    const content = await readFileFromSandbox(sandbox, filePath);

    const elapsed = Date.now() - startTime;
    console.log(
      `[API] POST /api/v1/daytona/file/read - Success (sandboxId: ${sandboxId}, path: ${filePath}, size: ${content.length} chars, ${elapsed}ms)`,
    );

    const response: ApiResponse = {
      success: true,
      data: { content },
    };
    res.json(response);
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(
      `[API] POST /api/v1/daytona/file/read - Error (sandboxId: ${sandboxId}, path: ${filePath}, ${elapsed}ms):`,
      error,
    );
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to read file",
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/v1/daytona/file/write
 * Write a file to sandbox
 */
router.post("/file/write", async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { sandboxId, path: filePath, content } = req.body;
  console.log(
    `[API] POST /api/v1/daytona/file/write - Starting (sandboxId: ${sandboxId}, path: ${filePath}, size: ${content?.length || 0} chars)...`,
  );

  try {
    const parsed = writeFileSchema.safeParse(req.body);
    if (!parsed.success) {
      console.log(
        `[API] POST /api/v1/daytona/file/write - Invalid request body (400)`,
      );
      const response: ApiResponse = {
        success: false,
        error: "Invalid request body",
      };
      return res.status(400).json(response);
    }

    const { sandboxId, path: filePath, content } = parsed.data;
    const sandbox = await daytonaClient.findOne({ id: sandboxId });

    if (!sandbox) {
      console.log(
        `[API] POST /api/v1/daytona/file/write - Sandbox not found (404, sandboxId: ${sandboxId})`,
      );
      const response: ApiResponse = {
        success: false,
        error: "Sandbox not found",
      };
      return res.status(404).json(response);
    }

    await writeFileToSandbox(sandbox, filePath, content);

    const elapsed = Date.now() - startTime;
    console.log(
      `[API] POST /api/v1/daytona/file/write - Success (sandboxId: ${sandboxId}, path: ${filePath}, size: ${content.length} chars, ${elapsed}ms)`,
    );

    const response: ApiResponse = {
      success: true,
      data: { message: "File written successfully" },
    };
    res.json(response);
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(
      `[API] POST /api/v1/daytona/file/write - Error (sandboxId: ${sandboxId}, path: ${filePath}, ${elapsed}ms):`,
      error,
    );
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to write file",
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/v1/daytona/metadata/get-image
 * Get metadata image (icon or share image) from sandbox as base64 data URL
 */
router.get("/metadata/get-image", async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { projectId, imageType } = req.query;
  console.log(
    `[API] GET /api/v1/daytona/metadata/get-image - Starting (projectId: ${projectId}, imageType: ${imageType})...`,
  );

  try {
    const parsed = getMetadataImageSchema.safeParse(req.query);
    if (!parsed.success) {
      console.log(
        `[API] GET /api/v1/daytona/metadata/get-image - Invalid query params (400)`,
      );
      const response: ApiResponse = {
        success: false,
        error: "Invalid query parameters",
      };
      return res.status(400).json(response);
    }

    const { projectId, imageType } = parsed.data;
    const sandboxInfo = await getSandbox(projectId);

    if (!sandboxInfo) {
      console.log(
        `[API] GET /api/v1/daytona/metadata/get-image - Sandbox not found (404, projectId: ${projectId})`,
      );
      const response: ApiResponse = {
        success: false,
        error: "Sandbox not found",
      };
      return res.status(404).json(response);
    }

    const sandbox = sandboxInfo.sandbox;

    // Determine path based on image type
    const filePrefix = imageType === "icon" ? "favicon" : "share-image";
    const searchDir = imageType === "icon" ? "public" : "public/images";
    const workspacePath = "/home/daytona/workspace";

    // List files to find the image
    const lsCommand = `ls ${workspacePath}/${searchDir}/${filePrefix}.* 2>/dev/null || echo "NOT_FOUND"`;
    const lsResult = await runCommandOnSandbox(sandbox, lsCommand);

    const output = lsResult.output || lsResult.result || "";
    if (output.trim() === "NOT_FOUND" || !output.trim()) {
      console.log(
        `[API] GET /api/v1/daytona/metadata/get-image - Image not found (404, projectId: ${projectId}, imageType: ${imageType})`,
      );
      const response: ApiResponse = {
        success: false,
        error: "Image not found",
      };
      return res.status(404).json(response);
    }

    // Get the first matching file
    const fullPath = output.trim().split("\n")[0];
    const relativePath = fullPath.replace(`${workspacePath}/`, "");

    // Read binary file from sandbox
    const fileBuffer = await sandbox.fs.downloadFile(fullPath);

    // Convert to base64
    const base64Data = fileBuffer.toString("base64");

    // Determine MIME type from file extension
    const ext = fullPath.split(".").pop()?.toLowerCase();
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

    const elapsed = Date.now() - startTime;
    console.log(
      `[API] GET /api/v1/daytona/metadata/get-image - Success (projectId: ${projectId}, imageType: ${imageType}, file: ${relativePath}, size: ${fileBuffer.length} bytes, ${elapsed}ms)`,
    );

    const response: ApiResponse = {
      success: true,
      data: {
        dataUrl,
        mimeType,
        filename: fullPath.split("/").pop(),
      },
    };
    res.json(response);
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(
      `[API] GET /api/v1/daytona/metadata/get-image - Error (projectId: ${projectId}, imageType: ${imageType}, ${elapsed}ms):`,
      error,
    );
    const response: ApiResponse = {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to get metadata image",
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/v1/daytona/metadata/upload-image
 * Upload metadata images (icon/favicon or share image) to sandbox
 */
router.post("/metadata/upload-image", async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { projectId, imageType } = req.body;
  console.log(
    `[API] POST /api/v1/daytona/metadata/upload-image - Starting (projectId: ${projectId}, imageType: ${imageType})...`,
  );

  try {
    const parsed = uploadMetadataImageSchema.safeParse(req.body);
    if (!parsed.success) {
      console.log(
        `[API] POST /api/v1/daytona/metadata/upload-image - Invalid request body (400)`,
      );
      const response: ApiResponse = {
        success: false,
        error: "Invalid request body",
      };
      return res.status(400).json(response);
    }

    const { projectId, imageType, base64Data, fileExtension } = parsed.data;
    const sandboxInfo = await getSandbox(projectId);

    if (!sandboxInfo) {
      console.log(
        `[API] POST /api/v1/daytona/metadata/upload-image - Sandbox not found (404, projectId: ${projectId})`,
      );
      const response: ApiResponse = {
        success: false,
        error: "Sandbox not found",
      };
      return res.status(404).json(response);
    }

    const sandbox = sandboxInfo.sandbox;

    // Determine file path based on image type
    const filename =
      imageType === "icon"
        ? `favicon.${fileExtension}`
        : `share-image.${fileExtension}`;
    const filePath =
      imageType === "icon"
        ? `public/${filename}`
        : `public/images/${filename}`;

    // Convert base64 to Buffer
    const imageBuffer = Buffer.from(base64Data, "base64");

    // Ensure directory exists
    const dirPath = filePath.substring(0, filePath.lastIndexOf("/"));
    if (dirPath) {
      await runCommandOnSandbox(
        sandbox,
        `mkdir -p /home/daytona/workspace/${dirPath}`,
      );
    }

    // Use Daytona's uploadFile API to write the image directly (Buffer overload)
    const workspacePath = "/home/daytona/workspace";
    const fullPath = `${workspacePath}/${filePath}`;
    await sandbox.fs.uploadFile(imageBuffer, fullPath);

    const elapsed = Date.now() - startTime;
    console.log(
      `[API] POST /api/v1/daytona/metadata/upload-image - Success (projectId: ${projectId}, imageType: ${imageType}, path: ${filePath}, size: ${imageBuffer.length} bytes, ${elapsed}ms)`,
    );

    const response: ApiResponse = {
      success: true,
      data: {
        path: filePath,
        filename,
        url: imageType === "icon" ? `/${filename}` : `/images/${filename}`,
      },
    };
    res.json(response);
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(
      `[API] POST /api/v1/daytona/metadata/upload-image - Error (projectId: ${projectId}, imageType: ${imageType}, ${elapsed}ms):`,
      error,
    );
    const response: ApiResponse = {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to upload metadata image",
    };
    res.status(500).json(response);
  }
});

// Playwright Operations

/**
 * POST /api/v1/daytona/playwright/check
 * Run Playwright runtime check
 */
router.post("/playwright/check", async (req: Request, res: Response) => {
  try {
    const parsed = playwrightCheckSchema.safeParse(req.body);
    if (!parsed.success) {
      const response: ApiResponse = {
        success: false,
        error: "Invalid request body",
      };
      return res.status(400).json(response);
    }

    const { targetUrl, sandboxId, maxRetries } = parsed.data;
    let targetSandbox: any = undefined;

    if (sandboxId) {
      targetSandbox = await daytonaClient.findOne({ id: sandboxId });
    }

    const result = await runPlaywrightRuntimeCheck(
      targetUrl,
      targetSandbox || undefined,
      maxRetries,
    );

    const response: ApiResponse = {
      success: true,
      data: result,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to run Playwright check",
    };
    res.status(500).json(response);
  }
});

/**
 * DELETE /api/v1/daytona/playwright/cleanup
 * Cleanup Playwright sandbox
 */
router.delete("/playwright/cleanup", async (_req: Request, res: Response) => {
  try {
    await cleanupPlaywrightSandbox();

    const response: ApiResponse = {
      success: true,
      data: { message: "Playwright sandbox cleaned up successfully" },
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to cleanup Playwright sandbox",
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/v1/daytona/playwright/status
 * Get Playwright sandbox status
 */
router.get("/playwright/status", async (_req: Request, res: Response) => {
  try {
    const status = await getPlaywrightSandboxStatus();

    const response: ApiResponse = {
      success: true,
      data: status,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to get Playwright sandbox status",
    };
    res.status(500).json(response);
  }
});

// Additional File Operations

const listFilesSchema = z.object({
  sandboxId: z.string(),
});

const findFilesSchema = z.object({
  sandboxId: z.string(),
  pattern: z.string(),
});

const batchWriteFilesSchema = z.object({
  sandboxId: z.string(),
  files: z.array(
    z.object({
      path: z.string(),
      content: z.string(),
    }),
  ),
});

const replaceInFilesSchema = z.object({
  sandboxId: z.string(),
  replacements: z.array(
    z.object({
      path: z.string(),
      oldValue: z.string(),
      newValue: z.string(),
    }),
  ),
});

const installPackagesSchema = z.object({
  sandboxId: z.string(),
  packages: z.array(z.string()),
  dev: z.boolean().optional(),
});

const applyThemeSchema = z.object({
  sandboxId: z.string(),
  theme: z.string(),
});

/**
 * POST /api/v1/daytona/files/list
 * List all files in sandbox
 */
router.post("/files/list", async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { sandboxId } = req.body;
  console.log(
    `[API] POST /api/v1/daytona/files/list - Starting (sandboxId: ${sandboxId})...`,
  );

  try {
    const parsed = listFilesSchema.safeParse(req.body);
    if (!parsed.success) {
      console.log(
        `[API] POST /api/v1/daytona/files/list - Invalid request body (400)`,
      );
      const response: ApiResponse = {
        success: false,
        error: "Invalid request body",
      };
      return res.status(400).json(response);
    }

    const { sandboxId } = parsed.data;
    const sandbox = await daytonaClient.findOne({ id: sandboxId });

    if (!sandbox) {
      console.log(
        `[API] POST /api/v1/daytona/files/list - Sandbox not found (404, sandboxId: ${sandboxId})`,
      );
      const response: ApiResponse = {
        success: false,
        error: "Sandbox not found",
      };
      return res.status(404).json(response);
    }

    // Import validation utils for file listing
    const { getRecursiveFileList } = await import(
      "../services/validation-utils.js"
    );
    const files = await getRecursiveFileList(sandbox);

    // Convert Map to plain object for JSON serialization
    const filesObject: Record<string, { size: number; modified: number }> = {};
    files.forEach((metadata, path) => {
      filesObject[path] = metadata;
    });

    const elapsed = Date.now() - startTime;
    console.log(
      `[API] POST /api/v1/daytona/files/list - Success (sandboxId: ${sandboxId}, fileCount: ${files.size}, ${elapsed}ms)`,
    );

    const response: ApiResponse = {
      success: true,
      data: { files: filesObject },
    };
    res.json(response);
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(
      `[API] POST /api/v1/daytona/files/list - Error (sandboxId: ${sandboxId}, ${elapsed}ms):`,
      error,
    );
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to list files",
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/v1/daytona/files/find
 * Find files matching a pattern
 */
router.post("/files/find", async (req: Request, res: Response) => {
  try {
    const parsed = findFilesSchema.safeParse(req.body);
    if (!parsed.success) {
      const response: ApiResponse = {
        success: false,
        error: "Invalid request body",
      };
      return res.status(400).json(response);
    }

    const { sandboxId, pattern } = parsed.data;
    const sandbox = await daytonaClient.findOne({ id: sandboxId });

    if (!sandbox) {
      const response: ApiResponse = {
        success: false,
        error: "Sandbox not found",
      };
      return res.status(404).json(response);
    }

    const path = "/home/daytona/workspace";
    const matches = await (sandbox.fs?.findFiles(path, pattern) ||
      Promise.resolve([]));
    const foundFiles = matches.map(
      (match: any) => match.path || match.toString(),
    );

    const response: ApiResponse = {
      success: true,
      data: { files: foundFiles },
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to find files",
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/v1/daytona/files/batch-write
 * Write multiple files to sandbox
 */
router.post("/files/batch-write", async (req: Request, res: Response) => {
  try {
    const parsed = batchWriteFilesSchema.safeParse(req.body);
    if (!parsed.success) {
      const response: ApiResponse = {
        success: false,
        error: "Invalid request body",
      };
      return res.status(400).json(response);
    }

    const { sandboxId, files } = parsed.data;
    const sandbox = await daytonaClient.findOne({ id: sandboxId });

    if (!sandbox) {
      const response: ApiResponse = {
        success: false,
        error: "Sandbox not found",
      };
      return res.status(404).json(response);
    }

    const results: Array<{ path: string; success: boolean; error?: string }> =
      [];

    for (const file of files) {
      try {
        await writeFileToSandbox(sandbox, file.path, file.content);
        results.push({ path: file.path, success: true });
      } catch (error) {
        results.push({
          path: file.path,
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to write file",
        });
      }
    }

    const response: ApiResponse = {
      success: true,
      data: { results },
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to batch write files",
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/v1/daytona/files/replace
 * Find and replace text in files
 */
router.post("/files/replace", async (req: Request, res: Response) => {
  try {
    const parsed = replaceInFilesSchema.safeParse(req.body);
    if (!parsed.success) {
      const response: ApiResponse = {
        success: false,
        error: "Invalid request body",
      };
      return res.status(400).json(response);
    }

    const { sandboxId, replacements } = parsed.data;
    const sandbox = await daytonaClient.findOne({ id: sandboxId });

    if (!sandbox) {
      const response: ApiResponse = {
        success: false,
        error: "Sandbox not found",
      };
      return res.status(404).json(response);
    }

    const results: Array<{ path: string; success: boolean; error?: string }> =
      [];

    for (const replacement of replacements) {
      try {
        const workspacePath = `/home/daytona/workspace/${replacement.path}`;

        // Use sandbox.fs.replaceInFiles if available (Daytona native method)
        if (sandbox.fs && typeof sandbox.fs.replaceInFiles === "function") {
          await sandbox.fs.replaceInFiles(
            [workspacePath],
            replacement.oldValue,
            replacement.newValue,
          );
        } else {
          // Fallback: read, replace, write
          const content = await readFileFromSandbox(sandbox, replacement.path);
          const newContent = content.replace(
            new RegExp(replacement.oldValue, "g"),
            replacement.newValue,
          );
          await writeFileToSandbox(sandbox, replacement.path, newContent);
        }

        results.push({ path: replacement.path, success: true });
      } catch (error) {
        results.push({
          path: replacement.path,
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to replace in file",
        });
      }
    }

    const response: ApiResponse = {
      success: true,
      data: { results },
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to replace in files",
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/v1/daytona/packages/install
 * Install npm packages in sandbox
 */
router.post("/packages/install", async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { sandboxId, packages } = req.body;
  console.log(
    `[API] POST /api/v1/daytona/packages/install - Starting (sandboxId: ${sandboxId}, packages: ${packages?.join(", ")})...`,
  );

  try {
    const parsed = installPackagesSchema.safeParse(req.body);
    if (!parsed.success) {
      console.log(
        `[API] POST /api/v1/daytona/packages/install - Invalid request body (400)`,
      );
      const response: ApiResponse = {
        success: false,
        error: "Invalid request body",
      };
      return res.status(400).json(response);
    }

    const { sandboxId, packages, dev = false } = parsed.data;
    const sandbox = await daytonaClient.findOne({ id: sandboxId });

    if (!sandbox) {
      console.log(
        `[API] POST /api/v1/daytona/packages/install - Sandbox not found (404, sandboxId: ${sandboxId})`,
      );
      const response: ApiResponse = {
        success: false,
        error: "Sandbox not found",
      };
      return res.status(404).json(response);
    }

    // Detect package manager by checking for lock files
    let packageManager = "npm";
    try {
      const workspacePath = "/home/daytona/workspace";

      // Check for bun.lockb
      try {
        await sandbox.fs.downloadFile(`${workspacePath}/bun.lockb`);
        packageManager = "bun";
      } catch {
        // Check for pnpm-lock.yaml
        try {
          await sandbox.fs.downloadFile(`${workspacePath}/pnpm-lock.yaml`);
          packageManager = "pnpm";
        } catch {
          // Check for yarn.lock
          try {
            await sandbox.fs.downloadFile(`${workspacePath}/yarn.lock`);
            packageManager = "yarn";
          } catch {
            // Default to npm
            packageManager = "npm";
          }
        }
      }
    } catch (error) {
      console.log(
        "[installPackages] Could not detect package manager, using npm",
      );
    }

    // Build install command based on package manager
    let installCommand: string;
    const packagesStr = packages.join(" ");

    switch (packageManager) {
      case "bun":
        installCommand = `bun add ${dev ? "-d" : ""} ${packagesStr}`;
        break;
      case "pnpm":
        installCommand = `pnpm add ${dev ? "-D" : ""} ${packagesStr}`;
        break;
      case "yarn":
        installCommand = `yarn add ${dev ? "-D" : ""} ${packagesStr}`;
        break;
      default:
        installCommand = `npm install ${dev ? "--save-dev" : ""} ${packagesStr}`;
    }

    console.log(
      `[API] POST /api/v1/daytona/packages/install - Running: ${installCommand}`,
    );
    const result = await runCommandOnSandbox(sandbox, installCommand, {
      timeoutMs: 60000, // 60 second timeout for package installation
    });

    const elapsed = Date.now() - startTime;
    console.log(
      `[API] POST /api/v1/daytona/packages/install - Success (sandboxId: ${sandboxId}, packageManager: ${packageManager}, count: ${packages.length}, ${elapsed}ms)`,
    );

    const response: ApiResponse = {
      success: true,
      data: {
        packageManager,
        command: installCommand,
        output: result.stdout || result.result,
        packages,
      },
    };
    res.json(response);
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(
      `[API] POST /api/v1/daytona/packages/install - Error (sandboxId: ${sandboxId}, ${elapsed}ms):`,
      error,
    );
    const response: ApiResponse = {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to install packages",
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/v1/daytona/theme/apply
 * Apply shadcn theme to sandbox
 */
router.post("/theme/apply", async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { sandboxId, theme } = req.body;
  console.log(
    `[API] POST /api/v1/daytona/theme/apply - Starting (sandboxId: ${sandboxId}, theme: ${theme})...`,
  );

  try {
    const parsed = applyThemeSchema.safeParse(req.body);
    if (!parsed.success) {
      console.log(
        `[API] POST /api/v1/daytona/theme/apply - Invalid request body (400)`,
      );
      const response: ApiResponse = {
        success: false,
        error: "Invalid request body",
      };
      return res.status(400).json(response);
    }

    const { sandboxId, theme } = parsed.data;
    const sandbox = await daytonaClient.findOne({ id: sandboxId });

    if (!sandbox) {
      console.log(
        `[API] POST /api/v1/daytona/theme/apply - Sandbox not found (404, sandboxId: ${sandboxId})`,
      );
      const response: ApiResponse = {
        success: false,
        error: "Sandbox not found",
      };
      return res.status(404).json(response);
    }

    // Valid theme keys (from V2_THEME_KEYS in webapp)
    const validThemes = [
      "default",
      "new-york",
      "blue",
      "green",
      "orange",
      "red",
      "rose",
      "slate",
      "stone",
      "gray",
      "neutral",
      "zinc",
      "violet",
      "yellow",
    ];

    if (!validThemes.includes(theme)) {
      console.log(
        `[API] POST /api/v1/daytona/theme/apply - Invalid theme (400, theme: ${theme})`,
      );
      const response: ApiResponse = {
        success: false,
        error: `Invalid theme: ${theme}. Valid themes: ${validThemes.join(", ")}`,
      };
      return res.status(400).json(response);
    }

    // Run shadcn theme installation
    const themeCommand = `npx -y shadcn@latest add https://tweakcn.com/r/themes/${theme}.json --yes`;
    console.log(
      `[API] POST /api/v1/daytona/theme/apply - Running: ${themeCommand}`,
    );

    const result = await runCommandOnSandbox(sandbox, themeCommand, {
      timeoutMs: 120000, // 2 minute timeout for theme installation
    });

    // Read the updated CSS file
    const cssContent = await readFileFromSandbox(sandbox, "src/index.css");

    const elapsed = Date.now() - startTime;
    console.log(
      `[API] POST /api/v1/daytona/theme/apply - Success (sandboxId: ${sandboxId}, theme: ${theme}, ${elapsed}ms)`,
    );

    const response: ApiResponse = {
      success: true,
      data: {
        theme,
        output: result.stdout || result.result,
        cssContent,
      },
    };
    res.json(response);
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(
      `[API] POST /api/v1/daytona/theme/apply - Error (sandboxId: ${sandboxId}, theme: ${theme}, ${elapsed}ms):`,
      error,
    );
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to apply theme",
    };
    res.status(500).json(response);
  }
});

export default router;
