/**
 * Connector Routes
 *
 * API routes for managing personal and shared connectors.
 * Handles OAuth flows, connection management, and resource fetching.
 */

import { Router } from "express";
import { prisma } from "@shipper/database";
import { z } from "zod";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import {
  connectorRegistry,
  encrypt,
  decrypt,
  encryptCredentials,
} from "../services/connectors/index.js";
import { getNotionAuthUrlAsync } from "../services/connectors/personal/notion.js";
import { logger } from "../config/logger.js";
import type { PersonalConnectorProvider } from "@shipper/database";

const router: ReturnType<typeof Router> = Router();

// =============================================================================
// State Management (for OAuth CSRF protection)
// =============================================================================

// JWT secret for signing OAuth state tokens (stateless approach)
// This eliminates the need for in-memory or database state storage
const OAUTH_STATE_SECRET =
  process.env.SECRETS_ENCRYPTION_KEY ||
  process.env.NEXTAUTH_SECRET ||
  "fallback-secret-change-in-production";

interface OAuthStatePayload {
  userId: string;
  provider: string;
  codeVerifier?: string;
}

/**
 * Generate a signed JWT token containing OAuth state
 * This is stateless - no server-side storage needed
 */
function generateState(userId: string, provider: string): string {
  const payload: OAuthStatePayload = { userId, provider };
  return jwt.sign(payload, OAUTH_STATE_SECRET, { expiresIn: "10m" });
}

/**
 * Validate and decode OAuth state from JWT
 * Returns null if invalid, expired, or tampered
 */
function validateState(
  state: string,
): { userId: string; provider: string; codeVerifier?: string } | null {
  // First, try to parse as base64-encoded PKCE state (from Notion DCR flow)
  try {
    const decoded = Buffer.from(state, "base64").toString();
    const parsed = JSON.parse(decoded);
    if (parsed.originalState) {
      // This is a PKCE-wrapped state - the originalState is our JWT
      try {
        const payload = jwt.verify(
          parsed.originalState,
          OAUTH_STATE_SECRET,
        ) as OAuthStatePayload;
        return {
          userId: payload.userId,
          provider: payload.provider,
          codeVerifier: parsed.codeVerifier,
        };
      } catch (jwtError) {
        logger.warn({ error: jwtError }, "Invalid JWT in PKCE state");
        return null;
      }
    }
  } catch (e) {
    // Not a PKCE state, try as raw JWT
  }

  // Try as raw JWT state
  try {
    const payload = jwt.verify(state, OAUTH_STATE_SECRET) as OAuthStatePayload;
    return { userId: payload.userId, provider: payload.provider };
  } catch (jwtError) {
    logger.warn({ error: jwtError }, "Invalid OAuth state JWT");
    return null;
  }
}

// =============================================================================
// List Available Connectors
// =============================================================================

/**
 * GET /api/v1/connectors
 * List all available connectors and user's connection status
 */
router.get("/", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] as string;
    const teamId = req.headers["x-team-id"] as string | undefined;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const state = await connectorRegistry.getConnectorState(userId, teamId);

    res.json({
      success: true,
      data: state,
    });
  } catch (error) {
    logger.error({ error }, "Failed to list connectors");
    res.status(500).json({ error: "Failed to list connectors" });
  }
});

// =============================================================================
// Personal Connector OAuth Flow
// =============================================================================

/**
 * GET /api/v1/connectors/:provider/auth
 * Initiate OAuth flow for a personal connector
 */
router.get("/:provider/auth", async (req, res) => {
  try {
    const { provider } = req.params;
    const userId = req.headers["x-user-id"] as string;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const connector = connectorRegistry.getPersonalConnector(
      provider.toUpperCase() as PersonalConnectorProvider,
    );

    if (!connector) {
      return res.status(404).json({ error: `Unknown connector: ${provider}` });
    }

    const state = generateState(userId, provider.toUpperCase());
    const redirectUri = getRedirectUri(provider);

    // Use async version for Notion to support DCR
    let authUrl: string;
    if (provider.toLowerCase() === "notion") {
      authUrl = await getNotionAuthUrlAsync(redirectUri, state);
    } else {
      authUrl = connector.getAuthUrl(redirectUri, state);
    }

    res.json({
      success: true,
      authUrl,
    });
  } catch (error) {
    logger.error({ error }, "Failed to initiate OAuth");
    res.status(500).json({ error: "Failed to initiate OAuth" });
  }
});

/**
 * GET /api/v1/connectors/:provider/callback
 * Handle OAuth callback
 *
 * Can be called directly by OAuth provider OR proxied through webapp.
 * When proxied (x-user-id header present), returns JSON instead of HTML.
 */
router.get("/:provider/callback", async (req, res) => {
  try {
    const { provider } = req.params;
    const { code, state, error: oauthError } = req.query;

    // Check if this is a proxied request from webapp
    const isProxied = !!req.headers["x-user-id"];

    // Helper to send error (HTML for direct, JSON for proxied)
    const sendError = (errorMsg: string) => {
      if (isProxied) {
        return res.status(400).json({ error: errorMsg });
      }
      return res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>Connection Error</title></head>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'connector-error', error: '${errorMsg}' }, '*');
              }
              window.close();
            </script>
            <p>Error: ${errorMsg}. You can close this window.</p>
          </body>
        </html>
      `);
    };

    // Handle OAuth errors
    if (oauthError) {
      logger.warn({ provider, error: oauthError }, "OAuth error from provider");
      return sendError(String(oauthError));
    }

    if (!code || !state) {
      return sendError("missing_params");
    }

    // Validate state
    const stateData = validateState(state as string);
    if (!stateData) {
      return sendError("invalid_state");
    }

    const { userId } = stateData;

    const connector = connectorRegistry.getPersonalConnector(
      provider.toUpperCase() as PersonalConnectorProvider,
    );

    if (!connector) {
      return sendError("unknown_connector");
    }

    // Exchange code for tokens (pass state for PKCE code verifier)
    const redirectUri = getRedirectUri(provider);
    const tokens = await connector.handleCallback(
      code as string,
      redirectUri,
      state as string,
    );

    // Store connection
    await prisma.personalConnector.upsert({
      where: {
        userId_provider_customUrl: {
          userId,
          provider: provider.toUpperCase() as PersonalConnectorProvider,
          customUrl: "",
        },
      },
      create: {
        userId,
        provider: provider.toUpperCase() as PersonalConnectorProvider,
        accessToken: encrypt(tokens.accessToken),
        refreshToken: tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
        expiresAt: tokens.expiresAt,
        metadata: tokens.metadata as object | undefined,
        status: "ACTIVE",
      },
      update: {
        accessToken: encrypt(tokens.accessToken),
        refreshToken: tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
        expiresAt: tokens.expiresAt,
        metadata: tokens.metadata as object | undefined,
        status: "ACTIVE",
        errorMessage: null,
      },
    });

    logger.info(
      { userId, provider, isProxied },
      "Personal connector connected",
    );

    // Return JSON for proxied requests, HTML for direct OAuth callbacks
    if (isProxied) {
      return res.json({ success: true, provider: provider.toLowerCase() });
    }

    // Return HTML that closes the popup and notifies the parent window
    res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>Connected!</title></head>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'connector-connected', provider: '${provider.toLowerCase()}' }, '*');
            }
            window.close();
          </script>
          <p>Connected successfully! You can close this window.</p>
        </body>
      </html>
    `);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error, errorMessage }, "OAuth callback failed");

    // Return JSON for proxied requests, HTML for direct OAuth callbacks
    if (req.headers["x-user-id"]) {
      return res.status(500).json({ error: errorMessage });
    }

    // Return HTML that closes the popup with error
    const safeErrorMessage = errorMessage
      .replace(/'/g, "\\'")
      .replace(/\n/g, " ");
    res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>Connection Failed</title></head>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'connector-error', error: '${safeErrorMessage}' }, '*');
            }
            window.close();
          </script>
          <p>Connection failed: ${safeErrorMessage}</p>
        </body>
      </html>
    `);
  }
});

// =============================================================================
// Personal Connector Management
// =============================================================================

/**
 * GET /api/v1/connectors/:provider/status
 * Get connection status for a personal connector
 */
router.get("/:provider/status", async (req, res) => {
  try {
    const { provider } = req.params;
    const userId = req.headers["x-user-id"] as string;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const connection = await connectorRegistry.getUserPersonalConnection(
      userId,
      provider.toUpperCase() as PersonalConnectorProvider,
    );

    res.json({
      success: true,
      connected: !!connection,
      connection,
    });
  } catch (error) {
    logger.error({ error }, "Failed to get connector status");
    res.status(500).json({ error: "Failed to get connector status" });
  }
});

/**
 * DELETE /api/v1/connectors/:provider
 * Disconnect a personal connector
 */
router.delete("/:provider", async (req, res) => {
  try {
    const { provider } = req.params;
    const userId = req.headers["x-user-id"] as string;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    await prisma.personalConnector.deleteMany({
      where: {
        userId,
        provider: provider.toUpperCase() as PersonalConnectorProvider,
      },
    });

    logger.info({ userId, provider }, "Personal connector disconnected");

    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, "Failed to disconnect connector");
    res.status(500).json({ error: "Failed to disconnect connector" });
  }
});

// =============================================================================
// Resource Fetching (for AI tools)
// =============================================================================

/**
 * POST /api/v1/connectors/:provider/resources
 * Fetch resources from a personal connector
 */
router.post("/:provider/resources", async (req, res) => {
  try {
    const { provider } = req.params;
    const userId = req.headers["x-user-id"] as string;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const schema = z.object({
      resourceType: z.string(),
      query: z.string().optional(),
      limit: z.number().optional(),
    });

    const body = schema.parse(req.body);

    const connector = connectorRegistry.getPersonalConnector(
      provider.toUpperCase() as PersonalConnectorProvider,
    );

    if (!connector) {
      return res.status(404).json({ error: `Unknown connector: ${provider}` });
    }

    // Get access token
    const accessToken = await connectorRegistry.getPersonalAccessToken(
      userId,
      provider.toUpperCase() as PersonalConnectorProvider,
    );

    if (!accessToken) {
      return res.status(401).json({
        error: "Not connected",
        action_required: "connect",
        provider,
      });
    }

    // Fetch resources
    const resources = await connector.fetchResources(accessToken, {
      resourceType: body.resourceType,
      query: body.query,
      limit: body.limit,
    });

    // Update last used
    await prisma.personalConnector.updateMany({
      where: {
        userId,
        provider: provider.toUpperCase() as PersonalConnectorProvider,
      },
      data: { lastUsedAt: new Date() },
    });

    res.json({
      success: true,
      resources,
      count: resources.length,
    });
  } catch (error) {
    logger.error({ error }, "Failed to fetch resources");
    res.status(500).json({ error: "Failed to fetch resources" });
  }
});

// =============================================================================
// Shared Connector Management
// =============================================================================

/**
 * POST /api/v1/connectors/shared
 * Configure a shared connector for a team or project
 */
router.post("/shared", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] as string;
    const teamId = req.headers["x-team-id"] as string | undefined;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const schema = z.object({
      connectorType: z.string(),
      credentials: z.record(z.string(), z.string()),
      name: z.string().optional(),
      projectId: z.string().optional(),
    });

    const body = schema.parse(req.body);

    const connector = connectorRegistry.getSharedConnector(
      body.connectorType as any,
    );

    if (!connector) {
      return res
        .status(404)
        .json({ error: `Unknown connector: ${body.connectorType}` });
    }

    // Validate credentials
    const validation = await connector.validateCredentials(
      body.credentials as Record<string, string>,
    );
    if (!validation.valid) {
      return res.status(400).json({
        error: "Invalid credentials",
        details: validation.error,
      });
    }

    // Determine scope (team or project)
    const scope = body.projectId
      ? { projectId: body.projectId, teamId: null }
      : { teamId: teamId || null, projectId: null };

    if (!scope.teamId && !scope.projectId) {
      return res.status(400).json({
        error: "Either teamId or projectId is required",
      });
    }

    // Store connection
    await prisma.sharedConnector.upsert({
      where: scope.teamId
        ? {
            teamId_connectorType: {
              teamId: scope.teamId,
              connectorType: body.connectorType as any,
            },
          }
        : {
            projectId_connectorType: {
              projectId: scope.projectId!,
              connectorType: body.connectorType as any,
            },
          },
      create: {
        ...scope,
        connectorType: body.connectorType as any,
        name: body.name,
        credentials: encryptCredentials(
          body.credentials as Record<string, string>,
        ),
        createdById: userId,
        status: "ACTIVE",
      },
      update: {
        name: body.name,
        credentials: encryptCredentials(
          body.credentials as Record<string, string>,
        ),
        status: "ACTIVE",
        errorMessage: null,
      },
    });

    logger.info(
      { userId, connectorType: body.connectorType, scope },
      "Shared connector configured",
    );

    res.json({
      success: true,
      setupInstructions: connector.getSetupInstructions(
        body.credentials as Record<string, string>,
      ),
    });
  } catch (error) {
    logger.error({ error }, "Failed to configure shared connector");
    res.status(500).json({ error: "Failed to configure shared connector" });
  }
});

/**
 * DELETE /api/v1/connectors/shared/:id
 * Remove a shared connector
 */
router.delete("/shared/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.headers["x-user-id"] as string;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    await prisma.sharedConnector.delete({
      where: { id },
    });

    logger.info({ userId, connectorId: id }, "Shared connector removed");

    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, "Failed to remove shared connector");
    res.status(500).json({ error: "Failed to remove shared connector" });
  }
});

// =============================================================================
// Helper Functions
// =============================================================================

function getRedirectUri(provider: string): string {
  // Use webapp URL for OAuth redirects to hide the API server URL from users
  // The webapp has a proxy route that forwards callbacks to the API
  const webappUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.WEBAPP_URL ||
    "http://localhost:3000";
  return `${webappUrl}/api/connectors/${provider.toLowerCase()}/callback`;
}

function getWebAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.WEBAPP_URL ||
    "http://localhost:3000"
  );
}

export default router;