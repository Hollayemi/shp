/**
 * Modal Snapshot Image IDs
 *
 * This file maps template names to their pre-built Modal snapshot image IDs.
 * Snapshots are created using apps/api/scripts/create-modal-snapshot.ts
 *
 * Using snapshots is much faster than cloning from git every time,
 * and avoids git credential issues.
 *
 * Snapshot names match the full template branch names (e.g., "calculator-template", "database-vite-todo-template")
 * The "main" branch is mapped to "vite-template"
 *
 * To create/update snapshots:
 * 1. Run: npx tsx apps/api/scripts/create-modal-snapshot.ts --template=<template-name> --environment=<env>
 *    Example: npx tsx apps/api/scripts/create-modal-snapshot.ts --template=calculator --environment=main
 *    Example: npx tsx apps/api/scripts/create-modal-snapshot.ts --template=calculator --environment=dev
 *    Example: npx tsx apps/api/scripts/create-modal-snapshot.ts --template=calculator --environment=both
 * 2. Copy the snapshot configuration from the output (it will show separate entries for each environment)
 * 3. Add/update the mapping below with imageId for main and devImageId for dev
 */

export interface SnapshotInfo {
  imageId: string; // Main/production environment image ID
  devImageId?: string; // Development environment image ID (optional)
  description: string;
  createdAt: string;
  version: string;
  environment?: "main" | "dev"; // Deprecated: use imageId/devImageId instead
}

/**
 * Map of template names to their Modal snapshot image IDs
 */
export const MODAL_SNAPSHOTS: Record<string, SnapshotInfo> = {
  // Example entries (update with actual image IDs after running create-modal-snapshot.ts):

  // "calculator-template": {
  //   imageId: "im-xxxxxxxxxxxxxx",
  //   description: "Calculator template",
  //   createdAt: "2025-01-29",
  //   version: "v1",
  // },

  // "database-vite-todo-template": {
  //   imageId: "im-xxxxxxxxxxxxxx",
  //   description: "Database Vite Todo template",
  //   createdAt: "2025-01-29",
  //   version: "v1",
  // },

  // "vite-template": {
  //   imageId: "im-xxxxxxxxxxxxxx", // Main/production environment
  //   devImageId: "im-yyyyyyyyyyyyyy", // Development environment (optional)
  //   description: "Base Vite + React template (main branch)",
  //   createdAt: "2025-01-29",
  //   version: "v1",
  // },
  "database-vite-template": {
    imageId: "im-BtQaOaga9rKaqJEQ06TJBP",
    devImageId: "im-oOBbQUYV31mU1DAf7YvKug",
    description: "database-vite-template template",
    createdAt: "2025-11-26",
    version: "v12",
  },
  "database-vite-todo-template": {
    imageId: "im-WX5emDijDwwnj7Csp9yVCl",
    devImageId: "im-r8do7zgmgsfQ6NAnZ16oeD",
    description: "database-todo-template template",
    createdAt: "2025-11-26",
    version: "v12",
  },
  "database-vite-calculator-template": {
    imageId: "im-dCKhTNXCYzwmrd7a0dEzXr",
    devImageId: "im-lxSoOCM2qJ0khoFFmdWtFG",
    description: "database-calculator-template template",
    createdAt: "2025-11-26",
    version: "v12",
  },
  "database-vite-content-sharing-template": {
    imageId: "im-qA61sJrU8vEVk9pqFOa2rG",
    devImageId: "im-VNaAvOwLiaRFuUJTbJGRhl",
    description: "database-content-sharing-template template",
    createdAt: "2025-11-26",
    version: "v12",
  },
  "database-vite-landing-page-template": {
    imageId: "im-3R2HBe39WKlLcTvUMsAwwq",
    devImageId: "im-O3dBPWUERCMx1CffqIw6vL",
    description: "database-landing-page-template template",
    createdAt: "2025-11-26",
    version: "v12",
  },
  "database-vite-tracker-template": {
    imageId: "im-bcowjZ8dSXzGSxX6nyyvQJ",
    devImageId: "im-2ipi7zguRIrnWUod2KsjQ1",
    description: "database-tracker-template template",
    createdAt: "2025-11-26",
    version: "v12",
  },

  // TanStack Templates (TanStack Start + Convex backend)
  "tanstack-template": {
    imageId: "im-5KUREocgh08oG0OXAFxAwH",
    devImageId: "im-p8X7Nediv8nUXPe2v3EKnU",
    description: "tanstack-template template",
    createdAt: "2025-12-05",
    version: "v1",
  },
  "tanstack-todo-template": {
    imageId: "im-cScxJkjQTbp3QD3LbB4EwJ",
    devImageId: "im-jyEJb0yi6NObfhCNan9ga3",
    description: "tanstack-todo-template template",
    createdAt: "2025-12-05",
    version: "v1",
  },
  "tanstack-calculator-template": {
    imageId: "im-nwUjizbPWbH7ONCQVErJXJ",
    devImageId: "im-vvnTwOZK0NNBzXJKk9PZYu",
    description: "tanstack-calculator-template template",
    createdAt: "2025-12-05",
    version: "v1",
  },
  "tanstack-content-sharing-template": {
    imageId: "im-PXz9n5Z6igigrNZA0CNHTD",
    devImageId: "im-iX59tOxvtbABTPlJ2FMUCp",
    description: "tanstack-content-sharing-template template",
    createdAt: "2025-12-05",
    version: "v1",
  },
  "tanstack-landing-page-template": {
    imageId: "im-dzuOmn2e7ZoRKEUfyzlvMw",
    devImageId: "im-zNxCC2V0RJ0cby2sBVYsY2",
    description: "tanstack-landing-page-template template",
    createdAt: "2025-12-05",
    version: "v1",
  },
  "tanstack-tracker-template": {
    imageId: "im-6ukJpIxQCaLeX7bW9goiEZ",
    devImageId: "im-ylYTUtMayhIBKwVuF3eEJX",
    description: "tanstack-tracker-template template",
    createdAt: "2025-12-05",
    version: "v1",
  },

  // Empty template for imported projects (no pre-configured files)
  // This template starts with a minimal setup for imported codebases
  "shipper-empty-bun-template": {
    imageId: "im-2Lo0DsRhOsNtTlYZ67qfGc",
    devImageId: "im-rhJUt02flMOGZFpc2CZI1p",
    description: "Empty template for imported projects",
    createdAt: "2025-12-13",
    version: "v1",
  },
};

/**
 * Get snapshot image ID for a template in a specific environment
 * Returns null if no snapshot exists for the requested environment
 *
 * @param templateName - Template name to get snapshot for
 * @param environment - Environment to get image ID for ("main" or "dev"), defaults to "main"
 * @returns Image ID string or null if not found
 */
export function getSnapshotImageId(
  templateName: string,
  environment: "main" | "dev" = "main",
): string | null {
  const snapshot = MODAL_SNAPSHOTS[templateName];
  if (!snapshot) {
    return null;
  }

  // Use environment-specific image ID if available
  if (environment === "dev" && snapshot.devImageId) {
    return snapshot.devImageId;
  }

  // Default to main image ID (backward compatible)
  return snapshot.imageId || null;
}

/**
 * Check if a template has a pre-built snapshot for a specific environment
 *
 * @param templateName - Template name to check
 * @param environment - Environment to check ("main" or "dev"), defaults to "main"
 * @returns True if snapshot exists for the requested environment
 */
export function hasSnapshot(
  templateName: string,
  environment: "main" | "dev" = "main",
): boolean {
  const snapshot = MODAL_SNAPSHOTS[templateName];
  if (!snapshot) {
    return false;
  }

  // Check for environment-specific snapshot
  if (environment === "dev") {
    return !!snapshot.devImageId;
  }

  // Main environment always checks for imageId
  return !!snapshot.imageId;
}

/**
 * Get all available snapshot template names
 */
export function getAvailableSnapshots(): string[] {
  return Object.keys(MODAL_SNAPSHOTS);
}
