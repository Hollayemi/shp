import { prisma } from "@shipper/database";
import type { Prisma } from "@shipper/database";
import type { Logger } from "pino";
import {
  createFilesystemSnapshot,
  createSandbox,
  deleteSandbox,
  listFiles,
} from "./modal-sandbox-manager.js";
import { hasSnapshot } from "./modal-snapshots.js";
import { logger as defaultLogger } from "../config/logger.js";

// Core patterns required for all projects
const CORE_FILE_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  { label: "package.json", regex: /^package\.json$/i },
  {
    label: "vite.config",
    regex: /^vite\.config\.(js|ts|mjs|cjs)$/i,
  },
  {
    label: "app entry",
    // Support various entry point patterns:
    // - src/main.jsx, src/app.jsx, src/index.jsx (standard Vite)
    // - main.jsx (root level, some platforms)
    // - src/App.jsx (capital A, common pattern)
    regex: /^(src\/)?(main|app|index|App)\.(t|j)sx?$/i,
  },
];

// tsconfig or jsconfig - accept either one
const CONFIG_PATTERN = {
  label: "tsconfig/jsconfig",
  regex: /^(tsconfig|jsconfig)(\.[^.]+)?\.json$/i,
};

// Pattern to detect TypeScript SOURCE files (not config files)
// Only matches .ts/.tsx files in src/ directory - config files like vite.config.ts don't count
const TYPESCRIPT_SOURCE_FILE_PATTERN = /^src\/.*\.(ts|tsx)$/i;

export type SandboxHealthStatus = {
  broken: boolean;
  sandboxId: string | null;
  reason?: string;
  missingFiles?: string[];
};

type EnsureOptions = {
  fragmentId?: string | null;
  templateName?: string;
  logger?: Logger;
};

type RecoverySnapshotSelection = {
  fragmentId: string | null;
  snapshotImageId: string | null;
  templateName?: string | null;
  sandboxId?: string | null;
  sandboxUrl?: string | null;
};

type TemplateResolutionSource =
  | "project"
  | "fragment"
  | "heuristic"
  | "fallback"
  | "override";

type TemplateResolution = {
  templateName: string;
  source: TemplateResolutionSource;
  hasSnapshot: boolean;
};

type FragmentCandidate = {
  id: string;
  files: Prisma.JsonValue | null;
  createdAt: Date;
};

const FALLBACK_MODAL_TEMPLATE = "database-vite-template";

const TEMPLATE_KEYWORD_MAP: Array<{
  template: string;
  keywords: string[];
}> = [
  {
    template: "database-vite-todo-template",
    keywords: ["todo", "task", "tasks"],
  },
  {
    template: "database-vite-calculator-template",
    keywords: ["calculator"],
  },
  {
    template: "database-vite-content-sharing-template",
    keywords: ["content", "share", "sharing"],
  },
  {
    template: "database-vite-landing-page-template",
    keywords: ["landing", "marketing", "hero"],
  },
  {
    template: "database-vite-tracker-template",
    keywords: ["tracker", "tracking", "habit", "budget"],
  },
];

const enableRecoveryDebug =
  process.env.RECOVERY_DEBUG === "true" ||
  (process.env.DEBUG || "").includes("sandbox-recovery");

function logRecoveryEvent(
  logger: Logger,
  payload: Record<string, unknown>,
): void {
  if (!enableRecoveryDebug) return;
  (logger ?? defaultLogger).info({
    msg: "sandbox.recovery",
    ...payload,
  });
}

function getModalEnvironment(): "main" | "dev" {
  return process.env.NODE_ENV === "development" ? "dev" : "main";
}

function ensureRecord(value: unknown): Record<string, string> | null {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Record<string, string>;
    } catch {
      return null;
    }
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, string>;
  }

  return null;
}

function inferTemplateFromFiles(files: Record<string, string>): string | null {
  const fileNamesText = Object.keys(files).join(" ").toLowerCase();

  const packageJsonRaw = files["package.json"];
  let packageText = "";
  if (packageJsonRaw) {
    try {
      const pkg = JSON.parse(packageJsonRaw);
      const dependencyNames = Object.keys({
        ...(pkg.dependencies || {}),
        ...(pkg.devDependencies || {}),
      }).join(" ");
      packageText =
        `${pkg.name || ""} ${pkg.description || ""} ${dependencyNames}`.toLowerCase();
    } catch {
      packageText = packageJsonRaw.toLowerCase();
    }
  }

  const readmeText = (files["README.md"] || "").toLowerCase();

  const combinedText = `${fileNamesText} ${packageText} ${readmeText}`;

  for (const mapping of TEMPLATE_KEYWORD_MAP) {
    if (mapping.keywords.some((keyword) => combinedText.includes(keyword))) {
      return mapping.template;
    }
  }

  return null;
}

function logTemplateResolution(
  logger: Logger,
  projectId: string,
  resolution: TemplateResolution,
): void {
  logger.info({
    msg: "ai.sandbox.templateResolved",
    projectId,
    templateName: resolution.templateName,
    templateSource: resolution.source,
    hasSnapshot: resolution.hasSnapshot,
  });
}

async function resolveProjectTemplate(
  projectId: string,
  logger: Logger,
): Promise<TemplateResolution> {
  const env = getModalEnvironment();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      activeFragmentId: true,
    },
  });

  const fragmentCandidates: FragmentCandidate[] = [];

  if (project?.activeFragmentId) {
    const activeFragment = await prisma.v2Fragment.findUnique({
      where: { id: project.activeFragmentId },
      select: { id: true, files: true, createdAt: true },
    });
    if (activeFragment) {
      fragmentCandidates.push(activeFragment);
    }
  }

  const fallbackFragment = await prisma.v2Fragment.findFirst({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    select: { id: true, files: true, createdAt: true },
  });

  if (
    fallbackFragment &&
    !fragmentCandidates.some((fragment) => fragment.id === fallbackFragment.id)
  ) {
    fragmentCandidates.push(fallbackFragment);
  }

  for (const fragment of fragmentCandidates) {
    const files = ensureRecord(fragment.files);
    if (!files) continue;
    const inferredTemplate = inferTemplateFromFiles(files);
    if (inferredTemplate) {
      const hasKnownSnapshot = hasSnapshot(inferredTemplate, env);
      const source: TemplateResolutionSource =
        project?.activeFragmentId === fragment.id ? "fragment" : "heuristic";
      const resolution: TemplateResolution = {
        templateName: inferredTemplate,
        source,
        hasSnapshot: hasKnownSnapshot,
      };
      logTemplateResolution(logger, projectId, resolution);
      return resolution;
    }
  }

  const fallbackResolution: TemplateResolution = {
    templateName: FALLBACK_MODAL_TEMPLATE,
    source: "fallback",
    hasSnapshot: hasSnapshot(FALLBACK_MODAL_TEMPLATE, env),
  };

  logTemplateResolution(logger, projectId, fallbackResolution);
  return fallbackResolution;
}

async function ensureFragmentForRecovery(
  projectId: string,
  preferredFragmentId: string | null,
  logger: Logger,
): Promise<string | null> {
  if (preferredFragmentId) {
    const exists = await prisma.v2Fragment.findUnique({
      where: { id: preferredFragmentId },
      select: { id: true },
    });
    if (exists) {
      return preferredFragmentId;
    }
    logger.warn({
      msg: "ai.sandbox.fragmentMissingForRecovery",
      projectId,
      fragmentId: preferredFragmentId,
    });
  }

  const fallback = await prisma.v2Fragment.findFirst({
    where: { projectId },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });

  if (!fallback) {
    logger.error({
      msg: "ai.sandbox.noFragmentsAvailable",
      projectId,
    });
    return null;
  }

  logger.info({
    msg: "ai.sandbox.fragmentSelectedForRecovery",
    projectId,
    fragmentId: fallback.id,
  });

  return fallback.id;
}

async function findRecoverySnapshot(
  projectId: string,
  startingFragmentId: string | null,
  logger: Logger,
  templateNameOverride?: string,
): Promise<RecoverySnapshotSelection> {
  if (startingFragmentId) {
    const activeFragment = await prisma.v2Fragment.findUnique({
      where: { id: startingFragmentId },
      select: {
        id: true,
        snapshotImageId: true,
        createdAt: true,
      },
    });

    if (activeFragment?.snapshotImageId) {
      logger.info({
        msg: "ai.sandbox.recoverySnapshotSelected",
        projectId,
        fragmentId: activeFragment.id,
        snapshotImageId: activeFragment.snapshotImageId,
        source: "active-fragment",
      });
      return {
        fragmentId: activeFragment.id,
        snapshotImageId: activeFragment.snapshotImageId,
      };
    }

    logger.info({
      msg: "ai.sandbox.recoverySnapshotSearch",
      projectId,
      fragmentId: startingFragmentId,
      reason: "active-fragment-missing-snapshot",
    });

    const fallbackFragment = await prisma.v2Fragment.findFirst({
      where: {
        projectId,
        snapshotImageId: { not: null },
        createdAt: activeFragment?.createdAt
          ? { lte: activeFragment.createdAt }
          : undefined,
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, snapshotImageId: true },
    });

    if (fallbackFragment?.snapshotImageId) {
      logger.info({
        msg: "ai.sandbox.recoverySnapshotSelected",
        projectId,
        fragmentId: fallbackFragment.id,
        snapshotImageId: fallbackFragment.snapshotImageId,
        source: "fallback-fragment",
      });
      return {
        fragmentId: fallbackFragment.id,
        snapshotImageId: fallbackFragment.snapshotImageId,
      };
    }
  }

  const latestSnapshot = await prisma.v2Fragment.findFirst({
    where: {
      projectId,
      snapshotImageId: { not: null },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, snapshotImageId: true },
  });

  if (latestSnapshot?.snapshotImageId) {
    logger.info({
      msg: "ai.sandbox.recoverySnapshotSelected",
      projectId,
      fragmentId: latestSnapshot.id,
      snapshotImageId: latestSnapshot.snapshotImageId,
      source: "latest-snapshot",
    });
    return {
      fragmentId: latestSnapshot.id,
      snapshotImageId: latestSnapshot.snapshotImageId,
    };
  }

  logger.warn({
    msg: "ai.sandbox.noSnapshotsFound",
    projectId,
  });

  const fragmentForRecovery = await ensureFragmentForRecovery(
    projectId,
    startingFragmentId,
    logger,
  );

  const templateName = templateNameOverride ?? FALLBACK_MODAL_TEMPLATE;

  if (!fragmentForRecovery) {
    return {
      fragmentId: null,
      snapshotImageId: null,
      templateName,
    };
  }

  try {
    logger.info({
      msg: "ai.sandbox.bootstrapFromTemplate",
      projectId,
      fragmentId: fragmentForRecovery,
      templateName,
    });

    const sandboxInfo = await createSandbox(
      projectId,
      fragmentForRecovery,
      templateName,
      logger,
    );

    const snapshotImageId = await createFilesystemSnapshot(
      sandboxInfo.sandbox,
      fragmentForRecovery,
      projectId,
      logger,
    );

    logger.info({
      msg: "ai.sandbox.templateSnapshotCreated",
      projectId,
      fragmentId: fragmentForRecovery,
      snapshotImageId,
      templateName,
      sandboxId: sandboxInfo.sandboxId,
    });

    return {
      fragmentId: fragmentForRecovery,
      snapshotImageId,
      templateName,
      sandboxId: sandboxInfo.sandboxId,
      sandboxUrl: sandboxInfo.sandboxUrl,
    };
  } catch (error) {
    logger.error({
      msg: "ai.sandbox.templateBootstrapFailed",
      projectId,
      fragmentId: fragmentForRecovery,
      templateName,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      fragmentId: fragmentForRecovery,
      snapshotImageId: null,
      templateName,
    };
  }
}

export async function getSandboxHealth(
  projectId: string,
  logger: Logger = defaultLogger,
): Promise<SandboxHealthStatus> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      sandboxId: true,
      sandboxProvider: true,
      buildStatus: true,
      importedFrom: true,
      codeImport: { select: { importedFrom: true } },
    },
  });

  if (!project?.sandboxId) {
    // Check if this is a brand new project that has never had a generation
    // by checking if there are any fragments
    const fragmentCount = await prisma.v2Fragment.count({
      where: { projectId },
    });

    // If no fragments exist, this is a brand new project - don't treat as "broken"
    // Recovery should not be triggered for projects that haven't been generated yet
    if (fragmentCount === 0) {
      logger.info({
        msg: "ai.sandbox.newProjectNoSandbox",
        projectId,
        reason: "brand-new-project-no-fragments",
      });
      return {
        broken: false, // Changed from true - brand new projects aren't "broken"
        sandboxId: null,
        reason: "new-project-no-generation-yet",
      };
    }

    // If fragments exist but no sandbox, then it's actually broken and needs recovery
    return {
      broken: true,
      sandboxId: null,
      reason: "missing-sandbox",
    };
  }

  if (project.sandboxProvider && project.sandboxProvider !== "modal") {
    return {
      broken: false,
      sandboxId: project.sandboxId,
      reason: "non-modal-provider",
    };
  }

  try {
    const files = await listFiles(project.sandboxId, logger);
    const paths = Array.from(files.keys());

    // console.log(project, "project");

    // Fallback: check CodeImport if Project.importedFrom is null
    const importedFrom =
      project.importedFrom ?? project.codeImport?.importedFrom ?? null;

    // Check if project has any TypeScript SOURCE files (in src/ directory)
    // Config files like vite.config.ts don't count - only actual app code
    const hasTypeScriptSourceFiles = paths.some((path) =>
      TYPESCRIPT_SOURCE_FILE_PATTERN.test(path),
    );

    // Build the list of required patterns based on project type
    // Require tsconfig/jsconfig if there are TypeScript source files
    const requiredPatterns = [...CORE_FILE_PATTERNS];
    if (hasTypeScriptSourceFiles) {
      requiredPatterns.push(CONFIG_PATTERN);
    }

    if (enableRecoveryDebug) {
      logger.info({
        msg: "sandbox.recovery",
        step: "list-files",
        projectId,
        sandboxId: project.sandboxId,
        workingDir: "/workspace",
        fileSample: paths.slice(0, 50),
        criticalPatterns: requiredPatterns.map((pattern) => pattern.label),
        hasTypeScriptSourceFiles,
        importedFrom,
      });
    }

    const missing = requiredPatterns
      .filter(({ regex }) => !paths.some((path) => regex.test(path)))
      .map(({ label }) => label);

    if (missing.length > 0) {
      logger.warn({
        msg: "ai.sandbox.detectedBroken",
        projectId,
        sandboxId: project.sandboxId,
        missing,
        hasTypeScriptSourceFiles,
        importedFrom,
      });
      return {
        broken: true,
        sandboxId: project.sandboxId,
        reason: "missing-critical-files",
        missingFiles: missing,
      };
    }

    return {
      broken: false,
      sandboxId: project.sandboxId,
    };
  } catch (error) {
    logger.error({
      msg: "ai.sandbox.detectedBroken",
      projectId,
      sandboxId: project.sandboxId,
      reason: "list-files-failed",
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      broken: true,
      sandboxId: project.sandboxId,
      reason: "list-files-failed",
    };
  }
}

export async function ensureSandboxRecovered(
  projectId: string,
  options: EnsureOptions = {},
): Promise<{ recovered: boolean; sandboxId: string | null }> {
  const logger = options.logger ?? defaultLogger;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      sandboxId: true,
      sandboxProvider: true,
      activeFragmentId: true,
      importedFrom: true,
      codeImport: { select: { id: true, importedFrom: true } }, // Check if this is an imported project
    },
  });

  // Determine if this is an imported project and where from
  const isImportedProject = !!project?.codeImport;
  const importedFrom =
    project?.importedFrom ?? project?.codeImport?.importedFrom ?? null;

  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const templateResolution = await resolveProjectTemplate(projectId, logger);
  const previousSandboxId = project.sandboxId ?? null;
  logRecoveryEvent(logger, {
    step: "recovery-start",
    projectId,
    previousSandboxId,
    templateName: templateResolution.templateName,
    templateSource: templateResolution.source,
    templateHasSnapshot: templateResolution.hasSnapshot,
  });

  if (project.sandboxProvider && project.sandboxProvider !== "modal") {
    return {
      recovered: false,
      sandboxId: project.sandboxId,
    };
  }

  const health = await getSandboxHealth(projectId, logger);
  if (!health.broken) {
    // Log if this is a brand new project (not a recovery scenario)
    if (health.reason === "new-project-no-generation-yet") {
      logger.info({
        msg: "ai.sandbox.skippingRecoveryForNewProject",
        projectId,
        reason: "brand-new-project-awaiting-first-generation",
      });
    }
    return {
      recovered: false,
      sandboxId: health.sandboxId,
    };
  }

  const fragmentId = options.fragmentId ?? project.activeFragmentId ?? null;
  const recoverySnapshot = await findRecoverySnapshot(
    projectId,
    fragmentId,
    logger,
    options.templateName ?? templateResolution.templateName,
  );
  const fragmentForRecovery =
    recoverySnapshot.fragmentId ??
    fragmentId ??
    project.activeFragmentId ??
    null;
  let templateForRecovery =
    options.templateName ??
    recoverySnapshot.templateName ??
    templateResolution.templateName;
  let templateSource: TemplateResolutionSource = options.templateName
    ? "override"
    : templateResolution.source;

  const templateHasSnapshot = hasSnapshot(
    templateForRecovery,
    getModalEnvironment(),
  );

  logger.info({
    msg: "ai.sandbox.recoveryStarted",
    projectId,
    sandboxId: project.sandboxId,
    fragmentId: fragmentForRecovery,
    templateName: templateForRecovery,
    templateSource,
    templateHasSnapshot,
    reason: health.reason,
    missingFiles: health.missingFiles,
    recoverySnapshotImageId: recoverySnapshot.snapshotImageId ?? undefined,
  });

  let sandboxId: string | null = recoverySnapshot.sandboxId ?? null;

  if (!sandboxId) {
    const createdSandbox = await createSandbox(
      projectId,
      fragmentForRecovery,
      templateForRecovery,
      logger,
      {
        recoverySnapshotImageId: recoverySnapshot.snapshotImageId ?? undefined,
        isImportedProject,
        importedFrom,
      },
    );
    sandboxId = createdSandbox.sandboxId;
  } else {
    logger.info({
      msg: "ai.sandbox.reusingTemplateBootstrap",
      projectId,
      sandboxId,
      fragmentId: fragmentForRecovery,
    });
  }

  await prisma.project.update({
    where: { id: projectId },
    data: {
      activeFragmentId: fragmentForRecovery ?? project.activeFragmentId,
      buildStatus: "READY",
      buildStatusUpdatedAt: new Date(),
      buildError: null,
    },
  });

  logRecoveryEvent(logger, {
    step: "before-verify",
    projectId,
    sandboxId,
    templateName: templateForRecovery,
    templateSource,
    templateHasSnapshot,
  });

  const verification = await getSandboxHealth(projectId, logger);

  if (verification.broken) {
    logger.error({
      msg: "ai.sandbox.recoveryVerificationFailed",
      projectId,
      sandboxId,
      reason: verification.reason,
      missingFiles: verification.missingFiles,
    });
    logRecoveryEvent(logger, {
      step: "verify-failed",
      projectId,
      sandboxId,
      missingFiles: verification.missingFiles || [],
    });
    throw new Error(
      "Sandbox recovery failed verification. Critical files still missing.",
    );
  } else {
    logger.info({
      msg: "ai.sandbox.recoveryFinished",
      projectId,
      sandboxId,
      fragmentId: fragmentForRecovery,
      templateName: templateForRecovery,
    });
    logRecoveryEvent(logger, {
      step: "verify-success",
      projectId,
      sandboxId,
    });
  }

  if (previousSandboxId && sandboxId && previousSandboxId !== sandboxId) {
    const stillReferenced = await prisma.project.findFirst({
      where: { sandboxId: previousSandboxId },
      select: { id: true },
    });

    if (!stillReferenced) {
      try {
        await deleteSandbox(previousSandboxId, projectId);
        logger.info({
          msg: "ai.sandbox.cleanedUpOldSandbox",
          projectId,
          sandboxId: previousSandboxId,
        });
      } catch (cleanupError) {
        logger.warn({
          msg: "ai.sandbox.cleanupFailed",
          projectId,
          sandboxId: previousSandboxId,
          error:
            cleanupError instanceof Error
              ? cleanupError.message
              : String(cleanupError),
        });
      }
    } else {
      logger.info({
        msg: "ai.sandbox.cleanupSkippedActiveReference",
        projectId,
        sandboxId: previousSandboxId,
        referencedByProjectId: stillReferenced.id,
      });
    }
  }

  return {
    recovered: true,
    sandboxId,
  };
}

export async function assertSandboxHealthyOrThrow(
  projectId: string,
  logger: Logger = defaultLogger,
): Promise<void> {
  const health = await getSandboxHealth(projectId, logger);

  if (health.broken) {
    throw new Error(
      "Sandbox is currently unavailable. Recovery is in progress. Please retry in a few seconds.",
    );
  }
}
