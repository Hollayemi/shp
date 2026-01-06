/**
 * MCP Client Service
 *
 * Connects to MCP servers (like Notion's hosted server at https://mcp.notion.com/mcp)
 * using Streamable HTTP transport (recommended by Notion).
 *
 * This service handles:
 * - Creating MCP client connections via HTTP
 * - Calling MCP tools (notion-search, notion-fetch, etc.)
 * - Managing connection lifecycle
 *
 * @see https://modelcontextprotocol.io/docs
 * @see https://www.notion.so/help/mcp
 */

import { logger } from "../../config/logger.js";

/**
 * Parse Server-Sent Events (SSE) response format
 * SSE format: "event: message\ndata: {json}\n\n"
 */
function parseSSEResponse(text: string): any {
  const lines = text.split("\n");
  let jsonData = "";

  for (const line of lines) {
    if (line.startsWith("data: ")) {
      jsonData += line.slice(6);
    }
  }

  if (!jsonData) {
    // Try to find any JSON in the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonData = jsonMatch[0];
    }
  }

  if (!jsonData) {
    throw new Error(`Could not parse SSE response: ${text.substring(0, 200)}`);
  }

  return JSON.parse(jsonData);
}

/**
 * MCP Tool call result
 */
export interface MCPToolResult {
  success: boolean;
  content?: unknown;
  error?: string;
}

/**
 * Available Notion MCP tools based on their documentation
 */
export type NotionMCPTool =
  | "notion-search"
  | "notion-fetch"
  | "notion-create-pages"
  | "notion-update-page"
  | "notion-move-pages"
  | "notion-duplicate-page"
  | "notion-create-database"
  | "notion-update-database"
  | "notion-query-data-sources"
  | "notion-create-comment"
  | "notion-get-comments"
  | "notion-get-teams"
  | "notion-get-users"
  | "notion-get-user"
  | "notion-get-self";

// Session IDs for maintaining MCP session state per user
// Key: `${userId}:${serverUrl}`, Value: session ID
const mcpSessionIds = new Map<string, string>();

/**
 * Get MCP session ID for a specific user and server
 */
function getMcpSessionId(userId: string, serverUrl: string): string | null {
  return mcpSessionIds.get(`${userId}:${serverUrl}`) || null;
}

/**
 * Set MCP session ID for a specific user and server
 */
function setMcpSessionId(
  userId: string,
  serverUrl: string,
  sessionId: string,
): void {
  mcpSessionIds.set(`${userId}:${serverUrl}`, sessionId);
}

/**
 * Clear MCP session ID for a specific user and server
 */
function clearMcpSessionId(userId: string, serverUrl: string): void {
  mcpSessionIds.delete(`${userId}:${serverUrl}`);
}

/**
 * Call an MCP tool using Streamable HTTP transport (recommended by Notion)
 *
 * This uses direct HTTP POST requests to the MCP server URL.
 * The access token is passed via Authorization header.
 */
async function callMCPToolViaHTTP(
  serverUrl: string,
  accessToken: string,
  toolName: string,
  args: Record<string, unknown>,
  userId?: string,
): Promise<MCPToolResult> {
  // Use a hash of the access token as user identifier if userId not provided
  const userKey = userId || accessToken.substring(0, 32);

  try {
    // First, initialize the session if needed
    let mcpSessionId = getMcpSessionId(userKey, serverUrl);
    if (!mcpSessionId) {
      const initResponse = await fetch(serverUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: {
              name: "shipper-builder",
              version: "1.0.0",
            },
          },
        }),
      });

      if (!initResponse.ok) {
        const errorText = await initResponse.text();
        throw new Error(
          `MCP initialize failed: ${initResponse.status} ${errorText}`,
        );
      }

      // Get session ID from response header
      const newSessionId = initResponse.headers.get("mcp-session-id");
      if (newSessionId) {
        mcpSessionId = newSessionId;
        setMcpSessionId(userKey, serverUrl, newSessionId);
      }

      // Handle SSE or JSON response
      const contentType = initResponse.headers.get("content-type") || "";
      let initData;
      if (contentType.includes("text/event-stream")) {
        // Parse SSE response
        const text = await initResponse.text();
        initData = parseSSEResponse(text);
      } else {
        initData = await initResponse.json();
      }
      logger.info(
        { initData, sessionId: mcpSessionId },
        "MCP session initialized",
      );
    }

    // Now call the tool
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${accessToken}`,
    };

    if (mcpSessionId) {
      headers["mcp-session-id"] = mcpSessionId;
    }

    const response = await fetch(serverUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: toolName,
          arguments: args,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`MCP tool call failed: ${response.status} ${errorText}`);
    }

    // Handle SSE or JSON response
    const contentType = response.headers.get("content-type") || "";
    type MCPResponse = {
      jsonrpc: string;
      id: number;
      result?: { content: unknown };
      error?: { code: number; message: string };
    };

    let data: MCPResponse;
    if (contentType.includes("text/event-stream")) {
      const text = await response.text();
      data = parseSSEResponse(text) as MCPResponse;
    } else {
      data = (await response.json()) as MCPResponse;
    }

    if (data.error) {
      return {
        success: false,
        error: data.error.message,
      };
    }

    return {
      success: true,
      content: data.result?.content,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ error, toolName, args }, "MCP HTTP tool call failed");

    // Reset session on error
    clearMcpSessionId(userKey, serverUrl);

    return {
      success: false,
      error: message,
    };
  }
}

// =============================================================================
// Notion-specific MCP helpers (using Streamable HTTP)
// =============================================================================

const NOTION_MCP_URL = "https://mcp.notion.com/mcp";

/**
 * Search Notion workspace using MCP
 *
 * Uses the notion-search tool which searches across Notion workspace
 * and connected tools (Slack, Google Drive, Jira) if Notion AI is enabled.
 */
export async function notionMCPSearch(
  accessToken: string,
  query: string,
): Promise<MCPToolResult> {
  return callMCPToolViaHTTP(NOTION_MCP_URL, accessToken, "notion-search", {
    query,
  });
}

/**
 * Fetch a Notion page by ID or URL using MCP
 *
 * Uses the notion-fetch tool to retrieve content from a specific page or database.
 * The tool expects a page/database ID, not a URL.
 */
export async function notionMCPFetch(
  accessToken: string,
  pageIdOrUrl: string,
): Promise<MCPToolResult> {
  // Extract page ID from URL if needed
  // Notion URLs look like: https://www.notion.so/Page-Title-abc123def456
  // The ID is the last part after the last hyphen (32 hex chars)
  let pageId = pageIdOrUrl;

  if (pageIdOrUrl.includes("notion.so")) {
    // Extract ID from URL
    const match =
      pageIdOrUrl.match(/([a-f0-9]{32})(?:\?|$)/i) ||
      pageIdOrUrl.match(/-([a-f0-9]{32})(?:\?|$)/i) ||
      pageIdOrUrl.match(/([a-f0-9-]{36})(?:\?|$)/i);
    if (match) {
      pageId = match[1].replace(/-/g, "");
    }
  }

  return callMCPToolViaHTTP(NOTION_MCP_URL, accessToken, "notion-fetch", {
    id: pageId,
  });
}

/**
 * Get user's own info from Notion MCP
 */
export async function notionMCPGetSelf(
  accessToken: string,
): Promise<MCPToolResult> {
  return callMCPToolViaHTTP(NOTION_MCP_URL, accessToken, "notion-get-self", {});
}

/**
 * Get comments on a Notion page
 */
export async function notionMCPGetComments(
  accessToken: string,
  pageId: string,
): Promise<MCPToolResult> {
  return callMCPToolViaHTTP(
    NOTION_MCP_URL,
    accessToken,
    "notion-get-comments",
    { page_id: pageId },
  );
}

/**
 * Create new pages in Notion
 * @param parentId - Parent page or database ID
 * @param title - Page title
 * @param content - Optional markdown content
 */
export async function notionMCPCreatePages(
  accessToken: string,
  parentId: string,
  title: string,
  content?: string,
): Promise<MCPToolResult> {
  return callMCPToolViaHTTP(
    NOTION_MCP_URL,
    accessToken,
    "notion-create-pages",
    {
      parent_id: parentId,
      title,
      content,
    },
  );
}

/**
 * Update a Notion page
 * @param pageId - Page ID to update
 * @param properties - Properties to update (title, etc.)
 * @param content - Optional new content
 */
export async function notionMCPUpdatePage(
  accessToken: string,
  pageId: string,
  properties?: Record<string, unknown>,
  content?: string,
): Promise<MCPToolResult> {
  return callMCPToolViaHTTP(NOTION_MCP_URL, accessToken, "notion-update-page", {
    page_id: pageId,
    properties,
    content,
  });
}

/**
 * Move pages to a new parent
 * @param pageIds - Array of page IDs to move
 * @param newParentId - New parent page or database ID
 */
export async function notionMCPMovePages(
  accessToken: string,
  pageIds: string[],
  newParentId: string,
): Promise<MCPToolResult> {
  return callMCPToolViaHTTP(NOTION_MCP_URL, accessToken, "notion-move-pages", {
    page_ids: pageIds,
    new_parent_id: newParentId,
  });
}

/**
 * Duplicate a Notion page
 * @param pageId - Page ID to duplicate
 * @param newParentId - Optional new parent for the duplicate
 */
export async function notionMCPDuplicatePage(
  accessToken: string,
  pageId: string,
  newParentId?: string,
): Promise<MCPToolResult> {
  return callMCPToolViaHTTP(
    NOTION_MCP_URL,
    accessToken,
    "notion-duplicate-page",
    {
      page_id: pageId,
      new_parent_id: newParentId,
    },
  );
}

/**
 * Create a new database in Notion
 * @param parentId - Parent page ID
 * @param title - Database title
 * @param properties - Database schema/properties
 */
export async function notionMCPCreateDatabase(
  accessToken: string,
  parentId: string,
  title: string,
  properties: Record<string, unknown>,
): Promise<MCPToolResult> {
  return callMCPToolViaHTTP(
    NOTION_MCP_URL,
    accessToken,
    "notion-create-database",
    {
      parent_id: parentId,
      title,
      properties,
    },
  );
}

/**
 * Update a database schema
 * @param databaseId - Database ID to update
 * @param title - Optional new title
 * @param properties - Properties to add/update
 */
export async function notionMCPUpdateDatabase(
  accessToken: string,
  databaseId: string,
  title?: string,
  properties?: Record<string, unknown>,
): Promise<MCPToolResult> {
  return callMCPToolViaHTTP(
    NOTION_MCP_URL,
    accessToken,
    "notion-update-database",
    {
      database_id: databaseId,
      title,
      properties,
    },
  );
}

/**
 * Query database entries
 * @param databaseId - Database ID to query
 * @param filter - Optional filter criteria
 * @param sorts - Optional sort criteria
 */
export async function notionMCPQueryDatabase(
  accessToken: string,
  databaseId: string,
  filter?: Record<string, unknown>,
  sorts?: Array<{ property: string; direction: "ascending" | "descending" }>,
): Promise<MCPToolResult> {
  return callMCPToolViaHTTP(
    NOTION_MCP_URL,
    accessToken,
    "notion-query-data-sources",
    {
      database_id: databaseId,
      filter,
      sorts,
    },
  );
}

/**
 * Create a comment on a Notion page
 * @param pageId - Page ID to comment on
 * @param content - Comment content
 */
export async function notionMCPCreateComment(
  accessToken: string,
  pageId: string,
  content: string,
): Promise<MCPToolResult> {
  return callMCPToolViaHTTP(
    NOTION_MCP_URL,
    accessToken,
    "notion-create-comment",
    {
      page_id: pageId,
      content,
    },
  );
}

/**
 * Get workspace teams
 */
export async function notionMCPGetTeams(
  accessToken: string,
): Promise<MCPToolResult> {
  return callMCPToolViaHTTP(
    NOTION_MCP_URL,
    accessToken,
    "notion-get-teams",
    {},
  );
}

/**
 * Get workspace users
 */
export async function notionMCPGetUsers(
  accessToken: string,
): Promise<MCPToolResult> {
  return callMCPToolViaHTTP(
    NOTION_MCP_URL,
    accessToken,
    "notion-get-users",
    {},
  );
}

/**
 * Get a specific user by ID
 */
export async function notionMCPGetUser(
  accessToken: string,
  userId: string,
): Promise<MCPToolResult> {
  return callMCPToolViaHTTP(NOTION_MCP_URL, accessToken, "notion-get-user", {
    user_id: userId,
  });
}
