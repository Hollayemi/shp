import { Daytona } from "@daytonaio/sdk";

/**
 * Daytona client configuration using defaults
 * Requires DAYTONA_API_KEY and DAYTONA_ORGANIZATION_ID environment variables
 */
export const daytonaClient = new Daytona({
  apiKey: process.env.DAYTONA_API_KEY!,
  organizationId: process.env.DAYTONA_ORGANIZATION_ID!,
  // Using defaults for all other configuration
});

/**
 * Default sandbox configuration for TypeScript/React projects
 */
export const DEFAULT_SANDBOX_CONFIG = {
  language: "typescript",
  resources: {
    cpu: 2,
    memory: 4,
    disk: 8,
  },
} as const;

/**
 * Validate Daytona environment configuration
 */
export function validateDaytonaConfig() {
  if (!process.env.DAYTONA_API_KEY) {
    throw new Error("DAYTONA_API_KEY is required for Daytona integration");
  }

  if (!process.env.DAYTONA_ORGANIZATION_ID) {
    throw new Error(
      "DAYTONA_ORGANIZATION_ID is required for Daytona integration",
    );
  }

  return {
    apiKey: process.env.DAYTONA_API_KEY,
    organizationId: process.env.DAYTONA_ORGANIZATION_ID,
    apiUrl: process.env.DAYTONA_API_URL || "https://api.daytona.io",
  };
}
