import { protectedProcedure, createTRPCRouter } from "@/trpc/init";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Octokit } from "@octokit/rest";
import JSZip from "jszip";
import { nanoid } from "nanoid";
import {
  analyzeFramework,
  type FrameworkAnalysis,
} from "@/lib/code-import/framework-analyzer";
import {
  filterIgnoredFiles,
  validateImportSize,
  normalizePath,
  stripRootDirectory,
  MAX_FILE_COUNT,
  MAX_TOTAL_SIZE_BYTES,
} from "@/lib/code-import/file-processor";

// ==========================================
// Input Schemas
// ==========================================

// Platform options for import source selection
const importedFromPlatformSchema = z.enum([
  "LOVABLE",
  "BASE44",
  "BOLT",
  "V0",
  "GENERIC_VITE",
  "OTHER",
]);

export type ImportedFromPlatform = z.infer<typeof importedFromPlatformSchema>;

const importFromGitHubSchema = z.object({
  repoUrl: z.string().url(),
  branch: z.string().optional(),
  importedFrom: importedFromPlatformSchema.default("OTHER"),
});

const importFromUploadSchema = z.object({
  // Base64 encoded file contents with paths
  files: z.record(z.string(), z.string()),
  sourceName: z.string(),
  isFolder: z.boolean().default(false),
  importedFrom: importedFromPlatformSchema.default("OTHER"),
});

const getImportStatusSchema = z.object({
  importId: z.string(),
});

const cancelImportSchema = z.object({
  importId: z.string(),
});

// ==========================================
// Helper Functions
// ==========================================

/**
 * Parse GitHub URL to extract owner, repo, and optional branch
 */
function parseGitHubUrl(url: string): {
  owner: string;
  repo: string;
  branch?: string;
} {
  // Handle various GitHub URL formats:
  // https://github.com/owner/repo
  // https://github.com/owner/repo.git
  // https://github.com/owner/repo/tree/branch
  // git@github.com:owner/repo.git

  let cleanUrl = url.trim();

  // Handle SSH URLs
  if (cleanUrl.startsWith("git@github.com:")) {
    cleanUrl = cleanUrl.replace("git@github.com:", "https://github.com/");
  }

  // Remove .git suffix
  cleanUrl = cleanUrl.replace(/\.git$/, "");

  const urlObj = new URL(cleanUrl);
  const pathParts = urlObj.pathname.split("/").filter(Boolean);

  if (pathParts.length < 2) {
    throw new Error("Invalid GitHub URL format");
  }

  const owner = pathParts[0];
  const repo = pathParts[1];
  let branch: string | undefined;

  // Check for /tree/branch format
  if (pathParts.length >= 4 && pathParts[2] === "tree") {
    branch = pathParts.slice(3).join("/");
  }

  return { owner, repo, branch };
}

/**
 * Fetch repository archive from GitHub and extract files
 */
async function fetchGitHubRepoFiles(
  owner: string,
  repo: string,
  branch: string,
  accessToken?: string,
): Promise<Record<string, string>> {
  const octokit = new Octokit({ auth: accessToken });

  // Get the tarball URL
  const { url } = await octokit.repos.downloadTarballArchive({
    owner,
    repo,
    ref: branch,
  });

  // Fetch the tarball
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download repository: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();

  // GitHub returns a gzipped tarball, we need to decompress it
  // Use pako for decompression and tar-stream for extraction
  // For simplicity, we'll use the zipball endpoint instead which JSZip can handle
  const zipResponse = await octokit.repos.downloadZipballArchive({
    owner,
    repo,
    ref: branch,
  });

  const zipArrayBuffer = await fetch(zipResponse.url).then((r) =>
    r.arrayBuffer(),
  );
  const zip = await JSZip.loadAsync(zipArrayBuffer);

  const files: Record<string, string> = {};

  // Binary file extensions that should be read as base64
  const binaryExtensions = [
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".ico",
    ".svg",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
    ".otf",
    ".pdf",
    ".zip",
    ".tar",
    ".gz",
    ".mp3",
    ".mp4",
    ".wav",
    ".ogg",
    ".webm",
  ];

  for (const [path, file] of Object.entries(zip.files)) {
    if (file.dir) continue;

    const normalizedPath = normalizePath(path);
    const ext = normalizedPath
      .substring(normalizedPath.lastIndexOf("."))
      .toLowerCase();
    const isBinary = binaryExtensions.includes(ext);

    try {
      if (isBinary) {
        // Read binary files as base64
        const base64Content = await file.async("base64");
        // Store with a prefix so we know to decode it later
        files[normalizedPath] = `__BASE64__${base64Content}`;
      } else {
        const content = await file.async("string");
        files[normalizedPath] = content;
      }
    } catch (error) {
      // If string read fails, try base64
      try {
        const base64Content = await file.async("base64");
        files[normalizedPath] = `__BASE64__${base64Content}`;
      } catch {
        console.warn(`Skipping unreadable file: ${path}`);
      }
    }
  }

  return stripRootDirectory(files);
}

/**
 * Extract files from uploaded ZIP
 */
async function extractZipFiles(
  base64Content: string,
): Promise<Record<string, string>> {
  const buffer = Buffer.from(base64Content, "base64");
  const zip = await JSZip.loadAsync(buffer);

  const files: Record<string, string> = {};

  // Binary file extensions that should be read as base64
  const binaryExtensions = [
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".ico",
    ".svg",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
    ".otf",
    ".pdf",
    ".zip",
    ".tar",
    ".gz",
    ".mp3",
    ".mp4",
    ".wav",
    ".ogg",
    ".webm",
  ];

  for (const [path, file] of Object.entries(zip.files)) {
    if (file.dir) continue;

    const normalizedPath = normalizePath(path);
    const ext = normalizedPath
      .substring(normalizedPath.lastIndexOf("."))
      .toLowerCase();
    const isBinary = binaryExtensions.includes(ext);

    try {
      if (isBinary) {
        // Read binary files as base64
        const base64Content = await file.async("base64");
        files[normalizedPath] = `__BASE64__${base64Content}`;
      } else {
        const content = await file.async("string");
        files[normalizedPath] = content;
      }
    } catch (error) {
      // If string read fails, try base64
      try {
        const base64Content = await file.async("base64");
        files[normalizedPath] = `__BASE64__${base64Content}`;
      } catch {
        console.warn(`Skipping unreadable file: ${path}`);
      }
    }
  }

  return stripRootDirectory(files);
}

/**
 * Create project and fragments from imported files
 */
async function createProjectFromImport(
  userId: string,
  files: Record<string, string>,
  analysis: FrameworkAnalysis,
  sourceName: string,
  importId: string,
  importedFrom: ImportedFromPlatform,
): Promise<string> {
  // Extract project name from source (GitHub repo name or file/folder name)
  // For GitHub: "owner/repo" -> "repo"
  // For uploads: "my-project.zip" -> "my-project" or folder name
  let projectName = sourceName;

  // If it's a GitHub URL format (owner/repo), extract just the repo name
  if (sourceName.includes("/")) {
    projectName = sourceName.split("/").pop() || sourceName;
  }

  // Remove file extensions (.zip, etc.)
  projectName = projectName.replace(/\.(zip|tar|gz|tgz)$/i, "");

  // Clean up the name - replace dashes/underscores with spaces and title case
  projectName = projectName
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  // Determine initial migration status based on platform
  const platformsNeedingMigration: ImportedFromPlatform[] = [
    "LOVABLE",
    "BASE44",
  ];
  const initialMigrationStatus = platformsNeedingMigration.includes(
    importedFrom,
  )
    ? "PENDING"
    : "NOT_NEEDED";

  // Create the project with AWAITING_SANDBOX status
  const project = await prisma.project.create({
    data: {
      name: projectName,
      subtitle: `Imported ${analysis.framework} project`,
      logo: "📦",
      userId,
      buildStatus: "AWAITING_SANDBOX",
      buildStatusUpdatedAt: new Date(),
      importedFrom: importedFrom,
      backendMigrationStatus: initialMigrationStatus,
    },
  });

  // Create a single V2Fragment with all files (V2Fragment stores all files as JSON)
  const timestamp = new Date().toISOString();
  const fragment = await prisma.v2Fragment.create({
    data: {
      projectId: project.id,
      title: `Imported project - ${timestamp}`,
      files: files, // All files as a JSON object { path: content }
    },
  });

  // Update project to set the active fragment
  await prisma.project.update({
    where: { id: project.id },
    data: { activeFragmentId: fragment.id },
  });

  // Link the import record to the project
  await prisma.codeImport.update({
    where: { id: importId },
    data: {
      projectId: project.id,
      status: "COMPLETED",
      statusMessage: "Import completed successfully",
      progress: 100,
    },
  });

  return project.id;
}

/**
 * Update import status
 */
async function updateImportStatus(
  importId: string,
  status:
    | "QUEUED"
    | "FETCHING"
    | "ANALYZING"
    | "CREATING"
    | "COMPLETED"
    | "FAILED"
    | "CANCELLED",
  statusMessage?: string,
  progress?: number,
  errorMessage?: string,
  additionalData?: {
    detectedFramework?: string;
    detectedLanguage?: string;
    fileCount?: number;
    totalSizeBytes?: number;
  },
) {
  await prisma.codeImport.update({
    where: { id: importId },
    data: {
      status,
      statusMessage,
      progress,
      errorMessage,
      ...additionalData,
    },
  });
}

// ==========================================
// Background Processing Functions
// ==========================================

/**
 * Process GitHub import in background
 */
async function processGitHubImport(
  importId: string,
  userId: string,
  owner: string,
  repo: string,
  branch: string,
  importedFrom: ImportedFromPlatform,
  accessToken?: string,
) {
  try {
    // Step 1: Fetching
    await updateImportStatus(
      importId,
      "FETCHING",
      "Downloading repository...",
      10,
    );

    const rawFiles = await fetchGitHubRepoFiles(
      owner,
      repo,
      branch,
      accessToken,
    );

    // Step 2: Filtering
    await updateImportStatus(importId, "FETCHING", "Processing files...", 30);

    const { files, stats } = filterIgnoredFiles(rawFiles);

    // Validate size
    const validation = validateImportSize(files);
    if (!validation.valid) {
      throw new Error(validation.errors.join("; "));
    }

    // Step 3: Analyzing
    await updateImportStatus(
      importId,
      "ANALYZING",
      "Detecting framework...",
      50,
    );

    const analysis = analyzeFramework(files);

    // Only allow Vite projects for now
    if (analysis.framework !== "vite") {
      throw new Error(
        `Only Vite projects are supported for import. Detected framework: ${analysis.framework}. Please ensure your project uses Vite as the build tool.`,
      );
    }

    await updateImportStatus(
      importId,
      "ANALYZING",
      `Detected ${analysis.framework} project`,
      60,
      undefined,
      {
        detectedFramework: analysis.framework,
        detectedLanguage: analysis.language,
        fileCount: stats.filteredCount,
        totalSizeBytes: stats.totalSizeBytes,
      },
    );

    // Step 4: Creating project
    await updateImportStatus(importId, "CREATING", "Creating project...", 70);

    const projectId = await createProjectFromImport(
      userId,
      files,
      analysis,
      `${owner}/${repo}`,
      importId,
      importedFrom,
    );

    console.log(
      `[CodeImport] Successfully imported ${owner}/${repo} -> Project ${projectId}`,
    );
  } catch (error) {
    console.error(`[CodeImport] Failed to import GitHub repo:`, error);
    await updateImportStatus(
      importId,
      "FAILED",
      "Import failed",
      0,
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}

/**
 * Process uploaded files import in background
 */
async function processUploadImport(
  importId: string,
  userId: string,
  rawFiles: Record<string, string>,
  sourceName: string,
  isZip: boolean,
  importedFrom: ImportedFromPlatform,
) {
  try {
    // Step 1: Extract if ZIP
    await updateImportStatus(importId, "FETCHING", "Processing files...", 10);

    let files: Record<string, string>;

    if (isZip) {
      // Assume first file is the ZIP content
      const zipContent = Object.values(rawFiles)[0];
      files = await extractZipFiles(zipContent);
    } else {
      files = rawFiles;
    }

    // Step 2: Filter
    await updateImportStatus(importId, "FETCHING", "Filtering files...", 30);

    const processed = filterIgnoredFiles(files);
    files = processed.files;

    // Validate size
    const validation = validateImportSize(files);
    if (!validation.valid) {
      throw new Error(validation.errors.join("; "));
    }

    // Step 3: Analyze
    await updateImportStatus(
      importId,
      "ANALYZING",
      "Detecting framework...",
      50,
    );

    const analysis = analyzeFramework(files);

    // Only allow Vite projects for now
    if (analysis.framework !== "vite") {
      throw new Error(
        `Only Vite projects are supported for import. Detected framework: ${analysis.framework}. Please ensure your project uses Vite as the build tool.`,
      );
    }

    await updateImportStatus(
      importId,
      "ANALYZING",
      `Detected ${analysis.framework} project`,
      60,
      undefined,
      {
        detectedFramework: analysis.framework,
        detectedLanguage: analysis.language,
        fileCount: processed.stats.filteredCount,
        totalSizeBytes: processed.stats.totalSizeBytes,
      },
    );

    // Step 4: Create project
    await updateImportStatus(importId, "CREATING", "Creating project...", 70);

    const projectId = await createProjectFromImport(
      userId,
      files,
      analysis,
      sourceName,
      importId,
      importedFrom,
    );

    console.log(
      `[CodeImport] Successfully imported ${sourceName} -> Project ${projectId}`,
    );
  } catch (error) {
    console.error(`[CodeImport] Failed to import upload:`, error);
    await updateImportStatus(
      importId,
      "FAILED",
      "Import failed",
      0,
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}

// ==========================================
// tRPC Router
// ==========================================

export const codeImportRouter = createTRPCRouter({
  /**
   * Import a project from GitHub
   */
  importFromGitHub: protectedProcedure
    .input(importFromGitHubSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      // Parse the GitHub URL
      const { owner, repo, branch: urlBranch } = parseGitHubUrl(input.repoUrl);
      const branch = input.branch || urlBranch || "main";

      // Get user's GitHub access token if available
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { githubAccessToken: true },
      });

      // Create import record
      const codeImport = await prisma.codeImport.create({
        data: {
          id: nanoid(),
          source: "GITHUB",
          sourceUrl: input.repoUrl,
          sourceName: `${owner}/${repo}`,
          sourceBranch: branch,
          importedFrom: input.importedFrom,
          userId,
          status: "QUEUED",
          statusMessage: "Import queued",
          progress: 0,
        },
      });

      // Start background processing
      setImmediate(() => {
        processGitHubImport(
          codeImport.id,
          userId,
          owner,
          repo,
          branch,
          input.importedFrom,
          user?.githubAccessToken || undefined,
        );
      });

      return {
        importId: codeImport.id,
        message: "Import started",
      };
    }),

  /**
   * Import a project from uploaded files (ZIP or folder)
   */
  importFromUpload: protectedProcedure
    .input(importFromUploadSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      // Validate file count before processing
      const fileCount = Object.keys(input.files).length;
      if (fileCount > MAX_FILE_COUNT) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Too many files (${fileCount}). Maximum allowed is ${MAX_FILE_COUNT} files.`,
        });
      }

      // Check total size
      let totalSize = 0;
      for (const content of Object.values(input.files)) {
        totalSize += content.length;
      }
      if (totalSize > MAX_TOTAL_SIZE_BYTES) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Total size exceeds maximum of ${MAX_TOTAL_SIZE_BYTES / 1024 / 1024}MB.`,
        });
      }

      // Determine if this is a ZIP file
      const isZip =
        input.sourceName.endsWith(".zip") ||
        (fileCount === 1 && Object.keys(input.files)[0].endsWith(".zip"));

      // Create import record
      const codeImport = await prisma.codeImport.create({
        data: {
          id: nanoid(),
          source: input.isFolder ? "FOLDER_UPLOAD" : "ZIP_UPLOAD",
          sourceName: input.sourceName,
          importedFrom: input.importedFrom,
          userId,
          status: "QUEUED",
          statusMessage: "Import queued",
          progress: 0,
        },
      });

      // Start background processing
      setImmediate(() => {
        processUploadImport(
          codeImport.id,
          userId,
          input.files,
          input.sourceName,
          isZip,
          input.importedFrom,
        );
      });

      return {
        importId: codeImport.id,
        message: "Import started",
      };
    }),

  /**
   * Get import status
   */
  getStatus: protectedProcedure
    .input(getImportStatusSchema)
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      const codeImport = await prisma.codeImport.findFirst({
        where: {
          id: input.importId,
          userId, // Ensure user owns this import
        },
        select: {
          id: true,
          status: true,
          statusMessage: true,
          errorMessage: true,
          progress: true,
          source: true,
          sourceName: true,
          sourceBranch: true,
          detectedFramework: true,
          detectedLanguage: true,
          fileCount: true,
          totalSizeBytes: true,
          projectId: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!codeImport) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Import not found",
        });
      }

      return codeImport;
    }),

  /**
   * List user's imports
   */
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(10),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      const imports = await prisma.codeImport.findMany({
        where: { userId },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          statusMessage: true,
          source: true,
          sourceName: true,
          detectedFramework: true,
          fileCount: true,
          projectId: true,
          createdAt: true,
        },
      });

      let nextCursor: string | undefined;
      if (imports.length > input.limit) {
        const nextItem = imports.pop();
        nextCursor = nextItem?.id;
      }

      return {
        imports,
        nextCursor,
      };
    }),

  /**
   * Cancel an in-progress import
   */
  cancelImport: protectedProcedure
    .input(cancelImportSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      const codeImport = await prisma.codeImport.findFirst({
        where: {
          id: input.importId,
          userId,
        },
      });

      if (!codeImport) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Import not found",
        });
      }

      // Can only cancel if not already completed or failed
      if (codeImport.status === "COMPLETED" || codeImport.status === "FAILED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot cancel import with status: ${codeImport.status}`,
        });
      }

      await prisma.codeImport.update({
        where: { id: input.importId },
        data: {
          status: "CANCELLED",
          statusMessage: "Import cancelled by user",
          progress: 0,
        },
      });

      return { success: true };
    }),

  /**
   * Get backend migration status for a project
   */
  getMigrationStatus: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      const project = await prisma.project.findFirst({
        where: {
          id: input.projectId,
          userId,
        },
        select: {
          id: true,
          importedFrom: true,
          backendMigrationStatus: true,
          backendMigrationStartedAt: true,
          backendMigrationCompletedAt: true,
        },
      });

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      return project;
    }),

  /**
   * Update backend migration status
   */
  updateMigrationStatus: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        status: z.enum([
          "NOT_NEEDED",
          "PENDING",
          "IN_PROGRESS",
          "COMPLETED",
          "SKIPPED",
          "FAILED",
        ]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      // Verify ownership
      const project = await prisma.project.findFirst({
        where: {
          id: input.projectId,
          userId,
        },
      });

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      const updateData: {
        backendMigrationStatus: typeof input.status;
        backendMigrationStartedAt?: Date;
        backendMigrationCompletedAt?: Date;
      } = {
        backendMigrationStatus: input.status,
      };

      // Set timestamps based on status
      if (input.status === "IN_PROGRESS") {
        updateData.backendMigrationStartedAt = new Date();
      } else if (input.status === "COMPLETED" || input.status === "FAILED") {
        updateData.backendMigrationCompletedAt = new Date();
      }

      await prisma.project.update({
        where: { id: input.projectId },
        data: updateData,
      });

      return { success: true, status: input.status };
    }),
});
