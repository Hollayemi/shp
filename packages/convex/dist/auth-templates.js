/**
 * Better Auth Template Generators for Convex
 *
 * Generates the necessary files for setting up Better Auth with Convex.
 * Based on the official Better Auth + Convex integration:
 * https://www.better-auth.com/docs/integrations/convex
 * https://convex-better-auth.netlify.app/
 *
 * @packageDocumentation
 */
import { randomBytes } from "crypto";
/**
 * Generate a random secret for BETTER_AUTH_SECRET
 * This is used for encryption and generating hashes
 */
export function generateBetterAuthSecret() {
    return randomBytes(32).toString("base64");
}
/** @deprecated Use generateBetterAuthSecret instead */
export function generateConvexAuthSecret() {
    return generateBetterAuthSecret();
}
/**
 * Generate the convex/convex.config.ts file
 *
 * This file registers the Better Auth LOCAL component with Convex.
 * Uses local install for plugins that require schema changes (like admin plugin).
 * @see https://convex-better-auth.netlify.app/features/local-install
 */
export function generateConvexConfigTs() {
    return `/**
 * Convex App Configuration
 * Uses LOCAL Better Auth component for admin plugin support
 * @see https://convex-better-auth.netlify.app/features/local-install
 */
import { defineApp } from "convex/server";
import betterAuth from "./betterAuth/convex.config";

const app = defineApp();
app.use(betterAuth);

export default app;
`;
}
/**
 * Generate the convex/betterAuth/convex.config.ts file
 *
 * Local component definition for Better Auth.
 * Required for plugins that need schema changes (admin, organization, etc.)
 */
export function generateBetterAuthComponentConfig() {
    return `/**
 * Better Auth Local Component Definition
 * @see https://convex-better-auth.netlify.app/features/local-install
 */
import { defineComponent } from "convex/server";

const component = defineComponent("betterAuth");

export default component;
`;
}
/**
 * Generate the convex/betterAuth/auth.ts file
 *
 * Static auth export for schema generation.
 * Run: cd convex/betterAuth && npx @better-auth/cli generate -y
 */
export function generateBetterAuthStaticExport() {
    return `/**
 * Static Auth Export for Schema Generation
 * Run: npx @better-auth/cli generate -y
 * @see https://convex-better-auth.netlify.app/features/local-install
 */
import { createAuth } from "../auth";
import { getStaticAuth } from "@convex-dev/better-auth";

export const auth = getStaticAuth(createAuth);
`;
}
/**
 * Generate the convex/betterAuth/adapter.ts file
 *
 * Adapter functions for Better Auth local install.
 */
export function generateBetterAuthAdapter() {
    return `/**
 * Better Auth Adapter Functions
 * @see https://convex-better-auth.netlify.app/features/local-install
 */
import { createApi } from "@convex-dev/better-auth";
import schema from "./schema";
import { createAuth } from "../auth";

export const {
  create,
  findOne,
  findMany,
  updateOne,
  updateMany,
  deleteOne,
  deleteMany,
} = createApi(schema, createAuth);
`;
}
/**
 * Generate the convex/betterAuth/schema.ts file
 *
 * Manual schema generation for Better Auth with admin plugin.
 * This replaces the CLI-generated schema since the CLI doesn't work
 * in the Convex deployment context (no database adapter available).
 *
 * Schema includes all tables required by Better Auth:
 * - users (with admin plugin fields: role, banned, banReason, banExpires)
 * - sessions
 * - accounts
 * - verifications
 */
export function generateBetterAuthSchema() {
    return `/**
 * Better Auth Schema for Convex (Local Install)
 * Complete schema with all tables required by Better Auth and plugins.
 *
 * IMPORTANT: Table names MUST be singular to match Better Auth's internal model names.
 *
 * Includes tables for:
 * - Core: user, session, account, verification
 * - Plugins: twoFactor, passkey, oauth*, jwks, rateLimit
 * - Admin plugin fields on user table
 *
 * @see https://convex-better-auth.netlify.app/features/local-install
 */
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const schema = defineSchema({
  // ============================================================================
  // CORE TABLES
  // ============================================================================

  user: defineTable({
    name: v.string(),
    email: v.string(),
    emailVerified: v.boolean(),
    image: v.optional(v.union(v.null(), v.string())),
    createdAt: v.number(),
    updatedAt: v.number(),
    // Optional fields from various plugins
    twoFactorEnabled: v.optional(v.union(v.null(), v.boolean())),
    isAnonymous: v.optional(v.union(v.null(), v.boolean())),
    username: v.optional(v.union(v.null(), v.string())),
    displayUsername: v.optional(v.union(v.null(), v.string())),
    phoneNumber: v.optional(v.union(v.null(), v.string())),
    phoneNumberVerified: v.optional(v.union(v.null(), v.boolean())),
    userId: v.optional(v.union(v.null(), v.string())),
    // Admin plugin fields
    role: v.optional(v.union(v.null(), v.string())),
    banned: v.optional(v.union(v.null(), v.boolean())),
    banReason: v.optional(v.union(v.null(), v.string())),
    banExpires: v.optional(v.union(v.null(), v.number())),
  })
    .index("email_name", ["email", "name"])
    .index("name", ["name"])
    .index("userId", ["userId"])
    .index("username", ["username"])
    .index("phoneNumber", ["phoneNumber"]),

  session: defineTable({
    expiresAt: v.number(),
    token: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    ipAddress: v.optional(v.union(v.null(), v.string())),
    userAgent: v.optional(v.union(v.null(), v.string())),
    userId: v.string(),
  })
    .index("expiresAt", ["expiresAt"])
    .index("expiresAt_userId", ["expiresAt", "userId"])
    .index("token", ["token"])
    .index("userId", ["userId"]),

  account: defineTable({
    accountId: v.string(),
    providerId: v.string(),
    userId: v.string(),
    accessToken: v.optional(v.union(v.null(), v.string())),
    refreshToken: v.optional(v.union(v.null(), v.string())),
    idToken: v.optional(v.union(v.null(), v.string())),
    accessTokenExpiresAt: v.optional(v.union(v.null(), v.number())),
    refreshTokenExpiresAt: v.optional(v.union(v.null(), v.number())),
    scope: v.optional(v.union(v.null(), v.string())),
    password: v.optional(v.union(v.null(), v.string())),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("accountId", ["accountId"])
    .index("accountId_providerId", ["accountId", "providerId"])
    .index("providerId_userId", ["providerId", "userId"])
    .index("userId", ["userId"]),

  verification: defineTable({
    identifier: v.string(),
    value: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("expiresAt", ["expiresAt"])
    .index("identifier", ["identifier"]),

  // ============================================================================
  // PLUGIN TABLES
  // ============================================================================

  twoFactor: defineTable({
    secret: v.string(),
    backupCodes: v.string(),
    userId: v.string(),
  }).index("userId", ["userId"]),

  passkey: defineTable({
    name: v.optional(v.union(v.null(), v.string())),
    publicKey: v.string(),
    userId: v.string(),
    credentialID: v.string(),
    counter: v.number(),
    deviceType: v.string(),
    backedUp: v.boolean(),
    transports: v.optional(v.union(v.null(), v.string())),
    createdAt: v.optional(v.union(v.null(), v.number())),
    aaguid: v.optional(v.union(v.null(), v.string())),
  })
    .index("credentialID", ["credentialID"])
    .index("userId", ["userId"]),

  oauthApplication: defineTable({
    name: v.optional(v.union(v.null(), v.string())),
    icon: v.optional(v.union(v.null(), v.string())),
    metadata: v.optional(v.union(v.null(), v.string())),
    clientId: v.optional(v.union(v.null(), v.string())),
    clientSecret: v.optional(v.union(v.null(), v.string())),
    redirectURLs: v.optional(v.union(v.null(), v.string())),
    type: v.optional(v.union(v.null(), v.string())),
    disabled: v.optional(v.union(v.null(), v.boolean())),
    userId: v.optional(v.union(v.null(), v.string())),
    createdAt: v.optional(v.union(v.null(), v.number())),
    updatedAt: v.optional(v.union(v.null(), v.number())),
  })
    .index("clientId", ["clientId"])
    .index("userId", ["userId"]),

  oauthAccessToken: defineTable({
    accessToken: v.optional(v.union(v.null(), v.string())),
    refreshToken: v.optional(v.union(v.null(), v.string())),
    accessTokenExpiresAt: v.optional(v.union(v.null(), v.number())),
    refreshTokenExpiresAt: v.optional(v.union(v.null(), v.number())),
    clientId: v.optional(v.union(v.null(), v.string())),
    userId: v.optional(v.union(v.null(), v.string())),
    scopes: v.optional(v.union(v.null(), v.string())),
    createdAt: v.optional(v.union(v.null(), v.number())),
    updatedAt: v.optional(v.union(v.null(), v.number())),
  })
    .index("accessToken", ["accessToken"])
    .index("refreshToken", ["refreshToken"])
    .index("clientId", ["clientId"])
    .index("userId", ["userId"]),

  oauthConsent: defineTable({
    clientId: v.optional(v.union(v.null(), v.string())),
    userId: v.optional(v.union(v.null(), v.string())),
    scopes: v.optional(v.union(v.null(), v.string())),
    createdAt: v.optional(v.union(v.null(), v.number())),
    updatedAt: v.optional(v.union(v.null(), v.number())),
    consentGiven: v.optional(v.union(v.null(), v.boolean())),
  })
    .index("clientId_userId", ["clientId", "userId"])
    .index("userId", ["userId"]),

  jwks: defineTable({
    publicKey: v.string(),
    privateKey: v.string(),
    createdAt: v.number(),
  }),

  rateLimit: defineTable({
    key: v.optional(v.union(v.null(), v.string())),
    count: v.optional(v.union(v.null(), v.number())),
    lastRequest: v.optional(v.union(v.null(), v.number())),
  }).index("key", ["key"]),
});

export default schema;
`;
}
/**
 * Generate the convex/auth.config.ts file
 *
 * This file configures Better Auth as the authentication provider.
 */
export function generateAuthConfigTs() {
    return `/**
 * Better Auth Provider Configuration
 * @see https://convex-better-auth.netlify.app/
 */
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
`;
}
/**
 * Generate the convex/auth.ts file
 *
 * This is the main auth setup file for Better Auth with Convex.
 * Includes user queries for settings panel and admin dashboard.
 */
/**
 * Generate auth.ts Phase 1 (for schema generation)
 *
 * This version does NOT import the local schema because it doesn't exist yet.
 * The CLI uses this to generate the schema. After schema generation,
 * we replace this with the full version that imports the local schema.
 */
export function generateAuthTsPhase1() {
    return `/**
 * Better Auth Setup for Convex (Phase 1 - Schema Generation)
 * This file will be replaced after schema generation with the local install version.
 * @see https://convex-better-auth.netlify.app/features/local-install
 */
import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { admin } from "better-auth/plugins";
import { components } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { v } from "convex/values";
import { betterAuth } from "better-auth";

const siteUrl = process.env.SITE_URL || "";

// Create the Better Auth component client (default mode for schema generation)
// This will be replaced with local schema version after CLI generates schema
export const authComponent = createClient<DataModel>(components.betterAuth);

// Static trusted origins for CORS
const staticOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
];

function getTrustedOrigins(request: Request): string[] {
  const origins = [...staticOrigins];
  if (siteUrl) origins.push(siteUrl);

  // Helper to check and add dynamic preview URLs (Modal and Shipper)
  const addDynamicOrigin = (url: string | null) => {
    if (!url) return;

    // Check for Modal preview URLs or Shipper deployed URLs
    const isDynamicUrl = url.includes(".w.modal.host") || url.includes(".shipper.now");
    if (!isDynamicUrl) return;

    try {
      const parsed = new URL(url);
      origins.push(parsed.origin);
    } catch {
      // If it's just an origin without path, add directly
      if (url.startsWith("http")) {
        origins.push(url.split("/").slice(0, 3).join("/"));
      }
    }
  };

  // Check origin header
  addDynamicOrigin(request.headers.get("origin"));

  // Check referer header (fallback for some auth flows)
  addDynamicOrigin(request.headers.get("referer"));

  // For callback URL validation, also check URL params and common body patterns
  try {
    const url = new URL(request.url);
    addDynamicOrigin(url.searchParams.get("callbackURL"));
    addDynamicOrigin(url.searchParams.get("callback"));
    addDynamicOrigin(url.searchParams.get("redirectTo"));
  } catch {}

  return [...new Set(origins)]; // Deduplicate
}

/**
 * Create Better Auth instance.
 * Compatible with @convex-dev/better-auth@0.9.x
 */
export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: getTrustedOrigins,
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    // User configuration with admin plugin fields
    user: {
      additionalFields: {
        name: { type: "string", required: false },
        role: { type: "string", required: false, defaultValue: "user" },
        banned: { type: "boolean", required: false, defaultValue: false },
        banReason: { type: "string", required: false },
        banExpires: { type: "number", required: false },
      },
    },
    plugins: [
      crossDomain({ siteUrl }),
      convex(),
      admin(),
    ],
  });
};

// Minimal exports for schema generation
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) return null;
    return {
      id: user._id,
      email: user.email,
      name: user.name ?? null,
      image: user.image ?? null,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  },
});
`;
}
/**
 * Generate auth.ts Phase 2 (for deployment with Local Install)
 *
 * This version DOES import the local schema for admin plugin support.
 * Only use after schema has been generated by the CLI.
 */
export function generateAuthTs() {
    return `/**
 * Better Auth Setup for Convex (Local Install)
 * Uses local schema for admin plugin support
 * @see https://convex-better-auth.netlify.app/features/local-install
 */
import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { admin } from "better-auth/plugins";
import { components } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { v } from "convex/values";
import { betterAuth } from "better-auth";
import authSchema from "./betterAuth/schema";

const siteUrl = process.env.SITE_URL || "";

// Create the Better Auth component client with LOCAL schema
// This enables admin plugin and other plugins that require schema changes
export const authComponent = createClient<DataModel, typeof authSchema>(
  components.betterAuth,
  {
    local: {
      schema: authSchema,
    },
  }
);

// Static trusted origins for CORS
const staticOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
];

/**
 * Get trusted origins array for Better Auth CORS
 * Includes: static origins, SITE_URL, and Modal preview URLs (*.w.modal.host)
 */
function getTrustedOrigins(request: Request): string[] {
  const origins = [...staticOrigins];
  if (siteUrl) origins.push(siteUrl);

  // Helper to check and add dynamic preview URLs (Modal and Shipper)
  const addDynamicOrigin = (url: string | null) => {
    if (!url) return;

    // Check for Modal preview URLs or Shipper deployed URLs
    const isDynamicUrl = url.includes(".w.modal.host") || url.includes(".shipper.now");
    if (!isDynamicUrl) return;

    try {
      const parsed = new URL(url);
      origins.push(parsed.origin);
    } catch {
      // If it's just an origin without path, add directly
      if (url.startsWith("http")) {
        origins.push(url.split("/").slice(0, 3).join("/"));
      }
    }
  };

  // Check origin header
  addDynamicOrigin(request.headers.get("origin"));

  // Check referer header (fallback for some auth flows)
  addDynamicOrigin(request.headers.get("referer"));

  // For callback URL validation, also check URL params and common body patterns
  try {
    const url = new URL(request.url);
    addDynamicOrigin(url.searchParams.get("callbackURL"));
    addDynamicOrigin(url.searchParams.get("callback"));
    addDynamicOrigin(url.searchParams.get("redirectTo"));
  } catch {}

  return [...new Set(origins)]; // Deduplicate
}

/**
 * Create Better Auth instance.
 * Returns a configured betterAuth instance for use with Convex.
 * Compatible with @convex-dev/better-auth@0.9.x
 */
export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: getTrustedOrigins,
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    // User configuration with admin plugin fields
    user: {
      additionalFields: {
        name: {
          type: "string",
          required: false,
        },
        // Admin plugin required fields
        role: {
          type: "string",
          required: false,
          defaultValue: "user",
        },
        banned: {
          type: "boolean",
          required: false,
          defaultValue: false,
        },
        banReason: {
          type: "string",
          required: false,
        },
        banExpires: {
          type: "number",
          required: false,
        },
      },
    },
    plugins: [
      crossDomain({ siteUrl }),
      convex(),
      admin(),
    ],
  });
};

// ============================================================================
// USER TYPE - Define explicit type for Better Auth user
// ============================================================================

/**
 * Better Auth user type with admin plugin fields.
 * This provides type safety for user queries.
 */
interface BetterAuthUser {
  _id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  emailVerified?: boolean;
  createdAt: number;
  updatedAt: number;
  // Admin plugin fields
  role?: string;
  banned?: boolean;
  banReason?: string;
  banExpires?: number;
}

// ============================================================================
// USER QUERIES - For settings panel and general use
// ============================================================================

/**
 * Get the current authenticated user
 */
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx) as BetterAuthUser | null;
    if (!user) return null;

    return {
      id: user._id,
      _id: user._id, // Alias for compatibility - use either id or _id
      email: user.email,
      name: user.name ?? null,
      image: user.image ?? null,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  },
});

/**
 * Get user by email address
 *
 * This is the recommended way to look up other users.
 * Email lookups use an index and avoid ID format issues.
 */
export const getUserByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const user = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "user",
      where: [{ field: "email", value: email }],
    }) as BetterAuthUser | null;
    if (!user) return null;

    return {
      id: user._id,
      email: user.email,
      name: user.name ?? null,
      image: user.image ?? null,
      createdAt: user.createdAt,
    };
  },
});

/**
 * List all users (for admin dashboard)
 *
 * Uses the Better Auth component's findMany to query users.
 */
export const listAllUsers = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 100 }) => {
    // Use the component's findMany to query users
    const result = await ctx.runQuery(components.betterAuth.adapter.findMany, {
      model: "user",
      sortBy: {
        field: "createdAt",
        direction: "desc",
      },
      paginationOpts: { numItems: limit, cursor: null },
    });

    return result.page.map((user: any) => ({
      id: user._id,
      email: user.email,
      name: user.name ?? null,
      image: user.image ?? null,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      role: user.role ?? "user",
      banned: user.banned ?? false,
    }));
  },
});
`;
}
/**
 * Generate the convex/http.ts file for auth routes
 *
 * This file sets up HTTP routes for Better Auth.
 */
export function generateHttpTs() {
    return `/**
 * Convex HTTP Routes
 * Required for Better Auth route handling
 * @see https://convex-better-auth.netlify.app/
 */
import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";

const http = httpRouter();

// Register Better Auth routes with CORS enabled for client-side frameworks
authComponent.registerRoutes(http, createAuth, { cors: true });

export default http;
`;
}
/**
 * Generate the src/lib/auth-client.ts file
 *
 * This file provides the Better Auth React client with proper error handling.
 */
export function generateAuthClientTs() {
    return `/**
 * Better Auth Client for React
 * @see https://convex-better-auth.netlify.app/
 */
import { createAuthClient } from "better-auth/react";
import {
  convexClient,
  crossDomainClient,
} from "@convex-dev/better-auth/client/plugins";

/**
 * Better Auth client instance
 * Use this for all authentication operations
 */
export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_CONVEX_SITE_URL,
  plugins: [convexClient(), crossDomainClient()],
});

// Re-export hooks for convenience
export const { useSession, signIn, signUp, signOut } = authClient;

/**
 * Error code type from Better Auth
 * Use authClient.$ERROR_CODES for the full list of error codes
 */
export type AuthErrorCode = keyof typeof authClient.$ERROR_CODES;

/**
 * Authentication error type with typed error codes
 */
export interface AuthError {
  message: string;
  code?: AuthErrorCode | string;
}

/**
 * Map of error codes to user-friendly messages
 * Extend this object to add custom translations
 */
export const errorMessages: Partial<Record<AuthErrorCode | string, string>> = {
  USER_NOT_FOUND: "No account found with this email",
  INVALID_PASSWORD: "Invalid password",
  USER_ALREADY_EXISTS: "An account with this email already exists",
  INVALID_EMAIL: "Please enter a valid email address",
  PASSWORD_TOO_SHORT: "Password must be at least 8 characters",
  PASSWORD_TOO_LONG: "Password is too long",
  INVALID_EMAIL_OR_PASSWORD: "Invalid email or password",
  EMAIL_NOT_VERIFIED: "Please verify your email before signing in",
  TOO_MANY_REQUESTS: "Too many attempts. Please try again later",
};

/**
 * Get a user-friendly error message from an error code
 */
export function getErrorMessage(code: string | undefined): string {
  if (!code) return "An unexpected error occurred";
  return errorMessages[code] ?? code.replace(/_/g, " ").toLowerCase();
}

/**
 * Parse error from Better Auth response
 */
export function parseAuthError(error: unknown): AuthError {
  if (error && typeof error === "object") {
    const err = error as { code?: string; message?: string };
    return {
      message: err.message ?? getErrorMessage(err.code),
      code: err.code,
    };
  }

  if (error instanceof Error) {
    return { message: error.message };
  }

  return { message: "An unexpected error occurred" };
}

// ============================================================================
// SIGN IN / SIGN UP HELPERS
// ============================================================================

export interface SignInResult {
  success: boolean;
  error?: AuthError;
}

/**
 * Sign in with email and password
 * Returns { success, error } instead of throwing
 * Uses current origin for callback to avoid localhost redirects
 */
export async function signInWithEmail(
  email: string,
  password: string
): Promise<SignInResult> {
  const { error } = await authClient.signIn.email({
    email,
    password,
    callbackURL: window.location.origin,
  });

  if (error) {
    return {
      success: false,
      error: {
        message: getErrorMessage(error.code),
        code: error.code,
      },
    };
  }

  return { success: true };
}

/**
 * Sign up with email and password
 * Returns { success, error } instead of throwing
 * Uses current origin for callback to avoid localhost redirects
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  name?: string
): Promise<SignInResult> {
  const { error } = await authClient.signUp.email({
    email,
    password,
    name: name ?? "",
    callbackURL: window.location.origin,
  });

  if (error) {
    return {
      success: false,
      error: {
        message: getErrorMessage(error.code),
        code: error.code,
      },
    };
  }

  return { success: true };
}

/**
 * Sign out the current user
 */
export async function signOutUser(): Promise<SignInResult> {
  const { error } = await authClient.signOut();

  if (error) {
    return {
      success: false,
      error: parseAuthError(error),
    };
  }

  return { success: true };
}
`;
}
/**
 * Generate the convex/schema.ts file
 *
 * Schema file for Better Auth with Convex.
 * Note: Better Auth tables are managed by the component.
 */
export function generateBasicSchemaTs() {
    return `/**
 * Convex Database Schema
 * Better Auth tables are managed by the @convex-dev/better-auth component.
 * Add your custom application tables here.
 * @see https://convex-better-auth.netlify.app/
 */
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Better Auth tables (user, session, account, verification) are
  // automatically managed by the @convex-dev/better-auth component.
  // You don't need to define them here.

  // Add your custom tables below:
  // Example: User-scoped table
  // todos: defineTable({
  //   userId: v.string(), // References user._id from getAuthUser()
  //   title: v.string(),
  //   completed: v.boolean(),
  //   createdAt: v.number(),
  // }).index("by_user", ["userId"]), // Required for user-scoped queries
});
`;
}
/**
 * Generate the React provider wrapper for Vite projects
 *
 * This sets up ConvexBetterAuthProvider for authentication in React apps.
 */
export function generateMainTsxWithAuth() {
    return `import React from "react";
import ReactDOM from "react-dom/client";
import { ConvexReactClient } from "convex/react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { authClient } from "@/lib/auth-client";
import App from "./App";
import "./index.css";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConvexBetterAuthProvider client={convex} authClient={authClient}>
      <App />
    </ConvexBetterAuthProvider>
  </React.StrictMode>
);
`;
}
/**
 * Generate the convex tsconfig.json with required settings
 */
export function generateConvexTsConfig() {
    return `{
  "compilerOptions": {
    "target": "ESNext",
    "lib": ["ES2021", "DOM"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true
  },
  "include": ["./**/*"],
  "exclude": ["node_modules", "_generated"]
}
`;
}
/**
 * Get the list of required npm packages for Better Auth with Convex
 */
export function getRequiredPackages() {
    return [
        "@convex-dev/better-auth@0.9.1", // Pinned to 0.9.x for compatibility
        "better-auth@1.3.34", // Pinned version for compatibility
    ];
}
/**
 * Get environment variables needed for Better Auth
 */
export function getRequiredEnvVars() {
    return {
        // These are set in Convex via `npx convex env set`
        convexEnvVars: {
            BETTER_AUTH_SECRET: "[generated-secret]",
            SITE_URL: "http://localhost:5173",
            // OAuth providers (optional - uncomment as needed)
            // GITHUB_CLIENT_ID: "your-github-client-id",
            // GITHUB_CLIENT_SECRET: "your-github-client-secret",
            // GOOGLE_CLIENT_ID: "your-google-client-id",
            // GOOGLE_CLIENT_SECRET: "your-google-client-secret",
        },
        // These go in the local .env.local file
        localEnvVars: {
            VITE_CONVEX_URL: "https://[deployment].convex.cloud",
            VITE_CONVEX_SITE_URL: "https://[deployment].convex.site",
        },
    };
}
/**
 * @deprecated Better Auth uses BETTER_AUTH_SECRET instead of JWT keys
 * This function is kept for backwards compatibility but returns a simple secret
 */
export async function generateConvexAuthJWTKeys() {
    // Better Auth doesn't need JWT keys, but we keep this for backwards compatibility
    // The shipper-cloud-hitl.ts will need to be updated to use BETTER_AUTH_SECRET
    const secret = generateBetterAuthSecret();
    return {
        JWT_PRIVATE_KEY: secret,
        JWKS: JSON.stringify({ secret }),
    };
}
/** @deprecated Use generateBasicSchemaTs instead */
export function generateBasicSchemaWithAuthTs() {
    return generateBasicSchemaTs();
}
/** @deprecated Use generateBasicSchemaTs instead */
export function generateSchemaWithAuthTs(_existingTables) {
    return generateBasicSchemaTs();
}
/** @deprecated Users are managed by Better Auth component */
export function generateUsersTs() {
    return `// Users are managed by Better Auth via the @convex-dev/better-auth component
// Use authComponent.getAuthUser(ctx) to get the current user
export {};
`;
}
//# sourceMappingURL=auth-templates.js.map