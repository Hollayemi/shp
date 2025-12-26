/**
 * Unified Sandbox Manager
 *
 * Provides a provider-agnostic interface for sandbox operations.
 * Automatically routes to the appropriate provider (Modal or Daytona) based on project configuration.
 */

import {
  getSandboxProvider,
  type SandboxProvider,
} from "./sandbox-provider-utils";
import { modalAPI, type ModalSandboxInfo } from "./api/modal-client";
import {
  getSandbox as getDaytonaSandbox,
  createSandbox as createDaytonaSandbox,
  createGitCommit as createDaytonaGitCommit,
  getDevServerStatus as getDaytonaDevServerStatus,
} from "./daytona-sandbox-manager";
import type { Sandbox } from "@daytonaio/sdk";

/**
 * Unified sandbox information type
 * Compatible with both Modal and Daytona
 */
export type UnifiedSandboxInfo = {
  sandboxId: string;
  sandboxUrl: string; // Transformed shipper.now proxy URL (for AI tools and external link)
  originalSandboxUrl?: string; // Original Modal URL (for iframe) - Modal only
  sandboxExpiresAt?: Date | null;
  sandbox?: any; // Daytona sandbox instance (for backward compatibility)
  files: Map<string, { size: number; modified: number }>;
  gitRepositoryUrl?: string; // Daytona only
  currentBranch?: string; // Daytona only
  gitCommitHash?: string; // Daytona only
  provider: SandboxProvider;
};

/**
 * Get sandbox information for a project
 * Automatically detects the provider and returns the appropriate sandbox info
 */
export async function getSandbox(
  projectId: string,
): Promise<UnifiedSandboxInfo | null> {
  const provider = await getSandboxProvider(projectId);

  console.log(
    `[SandboxManager] Getting sandbox for project ${projectId} using provider: ${provider}`,
  );

  if (provider === "modal") {
    const modalInfo = await modalAPI.getSandbox(projectId);

    if (!modalInfo) {
      return null;
    }

    // Get file list from Modal - this verifies the sandbox container is actually running
    // If listFiles fails, it means the sandbox record exists but the container is terminated
    const filesMap = new Map<string, { size: number; modified: number }>();
    try {
      const files = await modalAPI.listFiles(modalInfo.sandboxId);
      Object.entries(files).forEach(([path, metadata]) => {
        filesMap.set(path, metadata);
      });
    } catch (error) {
      console.error(
        "[SandboxManager] Failed to list files from Modal sandbox - container is terminated:",
        error,
      );
      // Return null to trigger sandbox recreation
      return null;
    }

    return {
      sandboxId: modalInfo.sandboxId,
      sandboxUrl: modalInfo.sandboxUrl,
      originalSandboxUrl: modalInfo.originalSandboxUrl,
      sandboxExpiresAt: modalInfo.sandboxExpiresAt,
      files: filesMap,
      provider: "modal",
    };
  } else {
    // Daytona
    const daytonaInfo = await getDaytonaSandbox(projectId);

    if (!daytonaInfo) {
      return null;
    }

    return {
      sandboxId: daytonaInfo.sandbox.id,
      sandboxUrl: daytonaInfo.sandboxUrl,
      sandboxExpiresAt: daytonaInfo.sandboxExpiresAt,
      sandbox: daytonaInfo.sandbox,
      files: daytonaInfo.files,
      gitRepositoryUrl: daytonaInfo.gitRepositoryUrl,
      currentBranch: daytonaInfo.currentBranch,
      gitCommitHash: daytonaInfo.gitCommitHash,
      provider: "daytona",
    };
  }
}

/**
 * Create a new sandbox for a project
 * Automatically uses the correct provider based on project configuration
 */
export async function createSandbox(
  projectId: string,
  fragmentId?: string | null,
  templateName?: string,
  options?: { isImportedProject?: boolean; importedFrom?: string | null },
): Promise<UnifiedSandboxInfo> {
  const provider = await getSandboxProvider(projectId);

  console.log(
    `[SandboxManager] Creating sandbox for project ${projectId} using provider: ${provider}`,
  );

  if (provider === "modal") {
    const modalInfo = await modalAPI.createSandbox(
      projectId,
      fragmentId,
      templateName,
      options,
    );

    // Get file list from Modal
    const filesMap = new Map<string, { size: number; modified: number }>();
    try {
      const files = await modalAPI.listFiles(modalInfo.sandboxId);
      Object.entries(files).forEach(([path, metadata]) => {
        filesMap.set(path, metadata);
      });
    } catch (error) {
      console.warn(
        "[SandboxManager] Failed to list files from new Modal sandbox:",
        error,
      );
    }

    return {
      sandboxId: modalInfo.sandboxId,
      sandboxUrl: modalInfo.sandboxUrl,
      originalSandboxUrl: modalInfo.originalSandboxUrl,
      sandboxExpiresAt: modalInfo.sandboxExpiresAt,
      files: filesMap,
      provider: "modal",
    };
  } else {
    // Daytona
    const daytonaInfo = await createDaytonaSandbox(
      projectId,
      fragmentId,
      templateName,
    );

    return {
      sandboxId: daytonaInfo.sandbox.id,
      sandboxUrl: daytonaInfo.sandboxUrl,
      sandboxExpiresAt: daytonaInfo.sandboxExpiresAt,
      sandbox: daytonaInfo.sandbox,
      files: daytonaInfo.files,
      gitRepositoryUrl: daytonaInfo.gitRepositoryUrl,
      currentBranch: daytonaInfo.currentBranch,
      gitCommitHash: daytonaInfo.gitCommitHash,
      provider: "daytona",
    };
  }
}

/**
 * Create a Git commit (Daytona only)
 * Throws an error if called on a Modal sandbox
 */
export async function createGitCommit(
  sandbox: Sandbox,
  projectId: string,
  message: string,
  authorName?: string,
  authorEmail?: string,
): Promise<string | null> {
  const provider = await getSandboxProvider(projectId);

  if (provider !== "daytona") {
    throw new Error("Git commits are only supported on Daytona sandboxes");
  }

  return createDaytonaGitCommit(
    sandbox,
    projectId,
    message,
    authorEmail,
    authorName,
  );
}

/**
 * Get dev server status (Daytona only)
 * Returns null for Modal sandboxes
 */
export async function getDevServerStatus(
  sandbox: Sandbox,
  projectId: string,
): Promise<{
  isRunning: boolean;
  sessionId: string;
  commands: any[];
} | null> {
  const provider = await getSandboxProvider(projectId);

  if (provider !== "daytona") {
    return null;
  }

  return getDaytonaDevServerStatus(sandbox, projectId);
}
