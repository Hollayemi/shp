/**
 * Sandbox Provider Utilities
 *
 * Helper functions for detecting and managing sandbox providers (Modal vs Daytona)
 */

import { prisma } from "@shipper/database";

/**
 * Supported sandbox providers
 */
export type SandboxProvider = "modal" | "daytona";

/**
 * Get the default provider for new projects
 *
 * @returns "modal" - New projects default to Modal
 */
export function getDefaultProvider(): SandboxProvider {
  return "modal";
}

/**
 * Get the sandbox provider for a specific project
 *
 * @param projectId - The project ID
 * @returns The provider ("modal" or "daytona"), defaults to Modal if not set
 */
export async function getSandboxProvider(
  projectId: string
): Promise<SandboxProvider> {
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { sandboxProvider: true },
    });

    // If explicitly set, use that provider
    if (
      project?.sandboxProvider === "modal" ||
      project?.sandboxProvider === "daytona"
    ) {
      return project.sandboxProvider as SandboxProvider;
    }

    // Default to Modal for new/unspecified projects
    return "modal";
  } catch (error) {
    console.warn(
      "[getSandboxProvider] Error detecting provider, defaulting to modal:",
      error
    );
    return "modal";
  }
}

/**
 * Set the sandbox provider for a project
 *
 * @param projectId - The project ID
 * @param provider - The provider to set
 */
export async function setSandboxProvider(
  projectId: string,
  provider: SandboxProvider
): Promise<void> {
  await prisma.project.update({
    where: { id: projectId },
    data: { sandboxProvider: provider },
  });
}

/**
 * Check if a provider supports a specific feature
 *
 * @param provider - The sandbox provider
 * @param feature - The feature to check
 * @returns true if the provider supports the feature
 */
export function supportsFeature(
  provider: SandboxProvider,
  feature: "git" | "snapshots" | "templates" | "autoInstall"
): boolean {
  const features: Record<SandboxProvider, Set<string>> = {
    modal: new Set(["templates", "autoInstall"]),
    daytona: new Set(["git", "snapshots", "templates"]),
  };

  return features[provider]?.has(feature) ?? false;
}

/**
 * Get provider-specific configuration
 *
 * @param provider - The sandbox provider
 * @returns Configuration object for the provider
 */
export function getProviderConfig(provider: SandboxProvider) {
  const configs = {
    modal: {
      name: "Modal",
      description: "Serverless sandbox with Git template cloning",
      workdir: "/workspace",
      defaultTemplate: "database",
      supportsGit: false,
      supportsAutoInstall: true,
      templateSource: "git-branches",
    },
    daytona: {
      name: "Daytona",
      description: "Persistent sandbox with Git workflow",
      workdir: "/home/daytona/workspace",
      defaultTemplate: "vite-template-v4",
      supportsGit: true,
      supportsAutoInstall: false,
      templateSource: "snapshots",
    },
  };

  return configs[provider];
}

/**
 * Get the workspace path for a provider
 *
 * @param provider - The sandbox provider
 * @returns The workspace path
 */
export function getWorkspacePath(provider: SandboxProvider): string {
  return provider === "modal" ? "/workspace" : "/home/daytona/workspace";
}
