import { Daytona } from "@daytonaio/sdk";

/**
 * Lazy Daytona client wrapper
 * Avoid constructing the real SDK client at module import time to prevent
 * build-time failures when environment variables are missing or the SDK
 * performs startup validation.
 */
let _daytonaInstance: Daytona | null | undefined;
function initDaytona(): Daytona | null {
  if (_daytonaInstance !== undefined) return _daytonaInstance;
  try {
    if (process.env.DAYTONA_API_KEY) {
      _daytonaInstance = new Daytona({ apiKey: process.env.DAYTONA_API_KEY });
      return _daytonaInstance;
    }
    _daytonaInstance = null;
    return null;
  } catch (err) {
    console.error("[daytona] Failed to initialize Daytona SDK:", err);
    _daytonaInstance = null;
    return null;
  }
}

export const daytonaClient: Daytona = new Proxy(
  {},
  {
    get(_, prop: string | symbol) {
      const d = initDaytona();
      if (!d) {
        throw new Error("Daytona client not initialized (missing DAYTONA_API_KEY)");
      }
       
      const value = (d as any)[prop as any];
      if (typeof value === "function") {
        return value.bind(d);
      }
      return value;
    },
  },
) as unknown as Daytona;

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

  return {
    apiKey: process.env.DAYTONA_API_KEY,
    apiUrl: process.env.DAYTONA_API_URL || "https://api.daytona.io",
  };
}
