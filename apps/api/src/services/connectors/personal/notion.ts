/**
 * Notion Personal Connector
 *
 * Connects to Notion's official MCP server to fetch user's pages and databases.
 * This brings context INTO the AI builder - users can say "build from my Notion doc"
 * and the AI will fetch and read the actual content.
 *
 * Notion hosts their own MCP server at https://mcp.notion.com/mcp
 * We handle OAuth to get the user's access token, then use that token
 * to authenticate with Notion's MCP server.
 *
 * Available MCP Tools:
 * - notion-search: Search across workspace and connected tools
 * - notion-fetch: Retrieve content from a page/database by URL
 * - notion-create-pages: Create new pages
 * - notion-update-page: Update page properties/content
 * - notion-get-comments: Get comments on a page
 * - notion-get-self: Get bot user info
 *
 * @see https://developers.notion.com/docs/authorization
 * @see https://www.notion.so/help/mcp (Notion MCP docs)
 */

import crypto from "crypto";
import type {
  PersonalConnectorDefinition,
  TokenResponse,
  ResourceQuery,
  Resource,
} from "../types.js";
import {
  notionMCPSearch,
  notionMCPFetch,
  notionMCPGetSelf,
} from "../mcp-client.js";

/**
 * Generate PKCE code verifier (random string)
 */
function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * Generate PKCE code challenge from verifier (S256)
 */
function generateCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

// Environment variables (fallback if DCR not available)
const NOTION_CLIENT_ID = process.env.NOTION_CLIENT_ID || "";
const NOTION_CLIENT_SECRET = process.env.NOTION_CLIENT_SECRET || "";
// Redirect URI now goes through webapp to hide API server URL from users
const NOTION_REDIRECT_URI =
  process.env.NOTION_REDIRECT_URI ||
  "http://localhost:3000/api/connectors/notion/callback";

// Notion MCP server URL - we use Dynamic Client Registration (DCR)
// to connect without pre-registration, giving full workspace access
const NOTION_MCP_SERVER_URL = "https://mcp.notion.com/mcp";

// Cache for DCR credentials per redirect URI
// Key: redirectUri, Value: DCR credentials
// This is still in-memory but keyed by redirectUri, which is consistent per deployment
// DCR credentials are tied to the redirect URI and rarely change
const dcrCredentialsCache = new Map<
  string,
  {
    clientId: string;
    clientSecret?: string;
    authorizationEndpoint: string;
    tokenEndpoint: string;
    cachedAt: number;
  }
>();

// DCR credentials cache TTL: 24 hours (they don't change often)
const DCR_CACHE_TTL = 24 * 60 * 60 * 1000;

/**
 * Discover OAuth endpoints from MCP server metadata
 */
async function discoverOAuthEndpoints(): Promise<{
  authorizationEndpoint: string;
  tokenEndpoint: string;
  registrationEndpoint?: string;
}> {
  // First, try to get OAuth metadata from the MCP server
  // The MCP server should return a 401 with WWW-Authenticate header pointing to OAuth metadata
  const response = await fetch(NOTION_MCP_SERVER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "initialize", id: 1 }),
  });

  if (response.status === 401) {
    // Look for OAuth metadata URL in WWW-Authenticate header
    const wwwAuth = response.headers.get("WWW-Authenticate");
    if (wwwAuth) {
      const match = wwwAuth.match(/resource_metadata="([^"]+)"/);
      if (match) {
        const metadataUrl = match[1];
        const metadataResponse = await fetch(metadataUrl);
        const metadata = (await metadataResponse.json()) as {
          authorization_endpoint: string;
          token_endpoint: string;
          registration_endpoint?: string;
        };
        return {
          authorizationEndpoint: metadata.authorization_endpoint,
          tokenEndpoint: metadata.token_endpoint,
          registrationEndpoint: metadata.registration_endpoint,
        };
      }
    }
  }

  // Fallback to well-known OAuth metadata endpoint
  const wellKnownUrl = new URL(NOTION_MCP_SERVER_URL);
  wellKnownUrl.pathname = "/.well-known/oauth-authorization-server";

  try {
    const metadataResponse = await fetch(wellKnownUrl.toString());
    if (metadataResponse.ok) {
      const metadata = (await metadataResponse.json()) as {
        authorization_endpoint: string;
        token_endpoint: string;
        registration_endpoint?: string;
      };
      return {
        authorizationEndpoint: metadata.authorization_endpoint,
        tokenEndpoint: metadata.token_endpoint,
        registrationEndpoint: metadata.registration_endpoint,
      };
    }
  } catch (e) {
    // Ignore and use defaults
  }

  // Default Notion MCP OAuth endpoints
  return {
    authorizationEndpoint: "https://mcp.notion.com/oauth/authorize",
    tokenEndpoint: "https://mcp.notion.com/oauth/token",
    registrationEndpoint: "https://mcp.notion.com/oauth/register",
  };
}

/**
 * Register as a dynamic OAuth client with the MCP server
 */
async function registerDynamicClient(
  registrationEndpoint: string,
  redirectUri: string,
): Promise<{ clientId: string; clientSecret?: string }> {
  const response = await fetch(registrationEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "Shipper Builder",
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "client_secret_basic",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DCR registration failed: ${error}`);
  }

  const data = (await response.json()) as {
    client_id: string;
    client_secret?: string;
  };
  return {
    clientId: data.client_id,
    clientSecret: data.client_secret,
  };
}

/**
 * Get or create DCR credentials
 */
async function getDCRCredentials(redirectUri: string): Promise<{
  clientId: string;
  clientSecret?: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
}> {
  // Check cache first (keyed by redirectUri)
  const cached = dcrCredentialsCache.get(redirectUri);
  if (cached && Date.now() - cached.cachedAt < DCR_CACHE_TTL) {
    return cached;
  }

  const endpoints = await discoverOAuthEndpoints();

  let dcrCredentials: {
    clientId: string;
    clientSecret?: string;
    authorizationEndpoint: string;
    tokenEndpoint: string;
    cachedAt: number;
  };

  if (endpoints.registrationEndpoint) {
    const credentials = await registerDynamicClient(
      endpoints.registrationEndpoint,
      redirectUri,
    );
    dcrCredentials = {
      ...credentials,
      authorizationEndpoint: endpoints.authorizationEndpoint,
      tokenEndpoint: endpoints.tokenEndpoint,
      cachedAt: Date.now(),
    };
  } else {
    // No DCR endpoint, fall back to standard Notion OAuth
    dcrCredentials = {
      clientId: process.env.NOTION_CLIENT_ID || "",
      clientSecret: process.env.NOTION_CLIENT_SECRET,
      authorizationEndpoint: "https://api.notion.com/v1/oauth/authorize",
      tokenEndpoint: "https://api.notion.com/v1/oauth/token",
      cachedAt: Date.now(),
    };
  }

  // Store in cache
  dcrCredentialsCache.set(redirectUri, dcrCredentials);
  return dcrCredentials;
}

/**
 * Notion connector implementation
 */
export const notionConnector: PersonalConnectorDefinition = {
  id: "NOTION",
  name: "Notion",
  description:
    "Access your Notion pages and databases to bring context into your builds",
  icon: "/icons/notion.svg",

  auth: {
    type: "mcp",
    authUrl: "https://mcp.notion.com/oauth/authorize", // Will be discovered via DCR
    tokenUrl: "https://mcp.notion.com/oauth/token", // Will be discovered via DCR
    mcpServerUrl: NOTION_MCP_SERVER_URL,
    scopes: [],
  },

  capabilities: {
    read: ["pages", "databases", "blocks", "comments"],
    write: [], // Read-only for now
  },

  /**
   * Generate OAuth authorization URL for Notion MCP
   * Uses Dynamic Client Registration (DCR) for full workspace access
   */
  getAuthUrl(redirectUri: string, state: string): string {
    // For now, we need to call getDCRCredentials async, but getAuthUrl is sync
    // So we'll use the fallback and let the route handler call the async version
    // The route will call getAuthUrlAsync instead
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    // Store code verifier in state for PKCE
    const stateWithPKCE = JSON.stringify({
      originalState: state,
      codeVerifier,
    });

    const params = new URLSearchParams({
      client_id: NOTION_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      owner: "user",
      state: Buffer.from(stateWithPKCE).toString("base64"),
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    // Use standard Notion OAuth as fallback (DCR will be attempted in async version)
    return `https://api.notion.com/v1/oauth/authorize?${params.toString()}`;
  },

  /**
   * Exchange authorization code for access token
   */
  async handleCallback(
    code: string,
    redirectUri: string,
    stateParam?: string,
  ): Promise<TokenResponse> {
    // Try to get DCR credentials first
    let clientId = NOTION_CLIENT_ID;
    let clientSecret = NOTION_CLIENT_SECRET;
    let tokenUrl = "https://api.notion.com/v1/oauth/token";
    let codeVerifier: string | undefined;

    // Parse state to get code verifier for PKCE
    if (stateParam) {
      try {
        const stateData = JSON.parse(
          Buffer.from(stateParam, "base64").toString(),
        );
        codeVerifier = stateData.codeVerifier;
      } catch (e) {
        // State might not be our format
      }
    }

    // Try DCR credentials
    let usingDCR = false;
    try {
      const dcrCreds = await getDCRCredentials(redirectUri);
      clientId = dcrCreds.clientId;
      clientSecret = dcrCreds.clientSecret || "";
      tokenUrl = dcrCreds.tokenEndpoint;
      usingDCR = true;
      console.log("[Notion] Using DCR credentials:", {
        clientId: clientId.substring(0, 20) + "...",
        tokenUrl,
      });
    } catch (e) {
      console.log(
        "[Notion] DCR failed, using standard OAuth:",
        e instanceof Error ? e.message : String(e),
      );
      // Fall back to standard credentials
    }

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
      "base64",
    );

    const body: Record<string, string> = {
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    };

    if (codeVerifier) {
      body.code_verifier = codeVerifier;
    }

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(body).toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Notion OAuth failed: ${error}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      token_type: string;
      refresh_token?: string;
      expires_in?: number;
      bot_id?: string;
      workspace_id?: string;
      workspace_name?: string;
      workspace_icon?: string;
      owner?: {
        type: string;
        user?: {
          id: string;
          name?: string;
          avatar_url?: string;
          person?: { email?: string };
        };
      };
    };

    // Calculate expiration time if provided
    const expiresAt = data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : undefined;

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt,
      metadata: {
        workspaceId: data.workspace_id,
        workspaceName: data.workspace_name,
        workspaceIcon: data.workspace_icon,
        botId: data.bot_id,
        ownerType: data.owner?.type,
        userName: data.owner?.user?.name,
        userEmail: data.owner?.user?.person?.email,
        userAvatar: data.owner?.user?.avatar_url,
        usingDCR,
        // Store DCR credentials for refresh
        dcrClientId: usingDCR ? clientId : undefined,
        dcrClientSecret: usingDCR ? clientSecret : undefined,
        dcrTokenUrl: usingDCR ? tokenUrl : undefined,
      },
    };
  },

  /**
   * Fetch resources from Notion
   *
   * Uses Notion's MCP server for search and fetch operations.
   * Falls back to REST API for basic operations if MCP fails.
   */
  async fetchResources(
    accessToken: string,
    query: ResourceQuery,
  ): Promise<Resource[]> {
    // Handle search operations
    if (
      query.resourceType === "search" ||
      query.resourceType === "mcp-search"
    ) {
      const result = await notionMCPSearch(accessToken, query.query || "*");
      if (result.success && result.content) {
        return parseMCPSearchResult(result.content);
      }
      throw new Error(
        `MCP search failed: ${result.error || "No content returned"}`,
      );
    }

    // Handle fetch operations (by URL)
    if (query.resourceType === "fetch" && query.query?.startsWith("http")) {
      const result = await notionMCPFetch(accessToken, query.query);
      if (result.success && result.content) {
        return [parseMCPFetchResult(result.content)];
      }
      throw new Error(
        `MCP fetch failed: ${result.error || "No content returned"}`,
      );
    }

    // Default: search with provided query or list all pages
    const searchQuery =
      query.query && query.query.trim() !== "" ? query.query : "*";
    const result = await notionMCPSearch(accessToken, searchQuery);
    if (result.success && result.content) {
      return parseMCPSearchResult(result.content);
    }

    throw new Error(
      `Notion MCP request failed: ${result.error || "No content returned"}`,
    );
  },

  /**
   * Validate that the connection is still working
   * Uses MCP get-self to verify the connection
   */
  async validateConnection(accessToken: string): Promise<boolean> {
    try {
      const mcpResult = await notionMCPGetSelf(accessToken);
      console.log("[Notion] validateConnection MCP result:", mcpResult.success);
      return mcpResult.success;
    } catch (error) {
      console.error("[Notion] validateConnection error:", error);
      return false;
    }
  },

  /**
   * Refresh an expired access token using the refresh token
   * DCR tokens typically expire after 1 hour
   */
  async refreshToken(
    refreshToken: string,
    metadata?: Record<string, unknown>,
  ): Promise<TokenResponse> {
    // Get DCR credentials from metadata (stored during initial auth)
    const clientId = metadata?.dcrClientId as string;
    const clientSecret = metadata?.dcrClientSecret as string;
    const tokenUrl =
      (metadata?.dcrTokenUrl as string) || "https://mcp.notion.com/oauth/token";

    if (!clientId || !clientSecret) {
      throw new Error(
        "Missing DCR credentials for token refresh. Please reconnect Notion.",
      );
    }

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
      "base64",
    );

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }).toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token refresh failed: ${error}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };

    const expiresAt = data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : undefined;

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken, // Keep old refresh token if not provided
      expiresAt,
      metadata: {
        ...metadata,
        lastRefreshedAt: new Date().toISOString(),
      },
    };
  },
};

// =============================================================================
// MCP Result Parsers
// =============================================================================

/**
 * Parse MCP search result into Resource array
 */
function parseMCPSearchResult(content: unknown): Resource[] {
  if (!content) {
    return [];
  }

  // MCP returns content as an array of objects with type and text
  // e.g., [{ type: "text", text: "..." }]
  if (Array.isArray(content)) {
    if (content.length === 0) {
      return [];
    }

    // Check if it's MCP format (array of {type, text} objects)
    const firstItem = content[0];
    if (
      firstItem &&
      firstItem.type === "text" &&
      typeof firstItem.text === "string"
    ) {
      return [
        {
          id: "mcp-search-result",
          type: "search-result",
          name: "Notion Search Results",
          description: "Results from Notion MCP search",
          url: "",
          content: firstItem.text,
          metadata: {},
        },
      ];
    }

    // Map as regular items
    return content.map((item: any, index: number) => ({
      id: item.id || `item-${index}`,
      type: item.object || item.type || "page",
      name: item.title || item.name || "Untitled",
      description: item.description || "",
      url: item.url || "",
      content:
        typeof item.content === "string" ? item.content : JSON.stringify(item),
      metadata: {
        createdTime: item.created_time,
        lastEditedTime: item.last_edited_time,
      },
    }));
  }

  // If content is not an array, wrap it
  const item = content as any;
  return [
    {
      id: item.id || "single-result",
      type: item.object || item.type || "unknown",
      name: item.title || item.name || "Untitled",
      description: item.description || "",
      url: item.url || "",
      content: typeof item === "string" ? item : JSON.stringify(item),
      metadata: {},
    },
  ];
}

/**
 * Parse MCP fetch result into a Resource
 */
function parseMCPFetchResult(content: unknown): Resource {
  const item = content as any;
  return {
    id: item.id || "",
    type: item.object || "page",
    name: item.title || item.name || "Untitled",
    description: item.description || "",
    url: item.url || "",
    content:
      typeof item.content === "string"
        ? item.content
        : JSON.stringify(item.content),
    metadata: item.metadata || {},
  };
}

// =============================================================================
// Async Auth URL Generator (for DCR support)
// =============================================================================

/**
 * Generate OAuth authorization URL for Notion MCP using DCR
 * This async version properly discovers OAuth endpoints and registers dynamically
 */
export async function getNotionAuthUrlAsync(
  redirectUri: string,
  state: string,
): Promise<string> {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  // Store code verifier in state for PKCE
  const stateWithPKCE = JSON.stringify({
    originalState: state,
    codeVerifier,
  });

  try {
    // Try to get DCR credentials
    const dcrCreds = await getDCRCredentials(redirectUri);

    const params = new URLSearchParams({
      client_id: dcrCreds.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      state: Buffer.from(stateWithPKCE).toString("base64"),
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    return `${dcrCreds.authorizationEndpoint}?${params.toString()}`;
  } catch (e) {
    // Fall back to standard Notion OAuth
    const params = new URLSearchParams({
      client_id: NOTION_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      owner: "user",
      state: Buffer.from(stateWithPKCE).toString("base64"),
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    return `https://api.notion.com/v1/oauth/authorize?${params.toString()}`;
  }
}
