import { createRequire } from 'module';const require = createRequire(import.meta.url);
import {
  logger
} from "./chunk-TIBZDRCE.js";
import {
  init_esm_shims
} from "./chunk-IXOW5DJO.js";

// src/services/connectors/mcp-client.ts
init_esm_shims();
function parseSSEResponse(text) {
  const lines = text.split("\n");
  let jsonData = "";
  for (const line of lines) {
    if (line.startsWith("data: ")) {
      jsonData += line.slice(6);
    }
  }
  if (!jsonData) {
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
var mcpSessionIds = /* @__PURE__ */ new Map();
function getMcpSessionId(userId, serverUrl) {
  return mcpSessionIds.get(`${userId}:${serverUrl}`) || null;
}
function setMcpSessionId(userId, serverUrl, sessionId) {
  mcpSessionIds.set(`${userId}:${serverUrl}`, sessionId);
}
function clearMcpSessionId(userId, serverUrl) {
  mcpSessionIds.delete(`${userId}:${serverUrl}`);
}
async function callMCPToolViaHTTP(serverUrl, accessToken, toolName, args, userId) {
  const userKey = userId || accessToken.substring(0, 32);
  try {
    let mcpSessionId = getMcpSessionId(userKey, serverUrl);
    if (!mcpSessionId) {
      const initResponse = await fetch(serverUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          Authorization: `Bearer ${accessToken}`
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
              version: "1.0.0"
            }
          }
        })
      });
      if (!initResponse.ok) {
        const errorText = await initResponse.text();
        throw new Error(
          `MCP initialize failed: ${initResponse.status} ${errorText}`
        );
      }
      const newSessionId = initResponse.headers.get("mcp-session-id");
      if (newSessionId) {
        mcpSessionId = newSessionId;
        setMcpSessionId(userKey, serverUrl, newSessionId);
      }
      const contentType2 = initResponse.headers.get("content-type") || "";
      let initData;
      if (contentType2.includes("text/event-stream")) {
        const text = await initResponse.text();
        initData = parseSSEResponse(text);
      } else {
        initData = await initResponse.json();
      }
      logger.info(
        { initData, sessionId: mcpSessionId },
        "MCP session initialized"
      );
    }
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${accessToken}`
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
          arguments: args
        }
      })
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`MCP tool call failed: ${response.status} ${errorText}`);
    }
    const contentType = response.headers.get("content-type") || "";
    let data;
    if (contentType.includes("text/event-stream")) {
      const text = await response.text();
      data = parseSSEResponse(text);
    } else {
      data = await response.json();
    }
    if (data.error) {
      return {
        success: false,
        error: data.error.message
      };
    }
    return {
      success: true,
      content: data.result?.content
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ error, toolName, args }, "MCP HTTP tool call failed");
    clearMcpSessionId(userKey, serverUrl);
    return {
      success: false,
      error: message
    };
  }
}
var NOTION_MCP_URL = "https://mcp.notion.com/mcp";
async function notionMCPSearch(accessToken, query) {
  return callMCPToolViaHTTP(NOTION_MCP_URL, accessToken, "notion-search", {
    query
  });
}
async function notionMCPFetch(accessToken, pageIdOrUrl) {
  let pageId = pageIdOrUrl;
  if (pageIdOrUrl.includes("notion.so")) {
    const match = pageIdOrUrl.match(/([a-f0-9]{32})(?:\?|$)/i) || pageIdOrUrl.match(/-([a-f0-9]{32})(?:\?|$)/i) || pageIdOrUrl.match(/([a-f0-9-]{36})(?:\?|$)/i);
    if (match) {
      pageId = match[1].replace(/-/g, "");
    }
  }
  return callMCPToolViaHTTP(NOTION_MCP_URL, accessToken, "notion-fetch", {
    id: pageId
  });
}
async function notionMCPGetSelf(accessToken) {
  return callMCPToolViaHTTP(NOTION_MCP_URL, accessToken, "notion-get-self", {});
}
async function notionMCPGetComments(accessToken, pageId) {
  return callMCPToolViaHTTP(
    NOTION_MCP_URL,
    accessToken,
    "notion-get-comments",
    { page_id: pageId }
  );
}
async function notionMCPCreatePages(accessToken, parentId, title, content) {
  return callMCPToolViaHTTP(
    NOTION_MCP_URL,
    accessToken,
    "notion-create-pages",
    {
      parent_id: parentId,
      title,
      content
    }
  );
}
async function notionMCPUpdatePage(accessToken, pageId, properties, content) {
  return callMCPToolViaHTTP(NOTION_MCP_URL, accessToken, "notion-update-page", {
    page_id: pageId,
    properties,
    content
  });
}
async function notionMCPMovePages(accessToken, pageIds, newParentId) {
  return callMCPToolViaHTTP(NOTION_MCP_URL, accessToken, "notion-move-pages", {
    page_ids: pageIds,
    new_parent_id: newParentId
  });
}
async function notionMCPDuplicatePage(accessToken, pageId, newParentId) {
  return callMCPToolViaHTTP(
    NOTION_MCP_URL,
    accessToken,
    "notion-duplicate-page",
    {
      page_id: pageId,
      new_parent_id: newParentId
    }
  );
}
async function notionMCPCreateDatabase(accessToken, parentId, title, properties) {
  return callMCPToolViaHTTP(
    NOTION_MCP_URL,
    accessToken,
    "notion-create-database",
    {
      parent_id: parentId,
      title,
      properties
    }
  );
}
async function notionMCPUpdateDatabase(accessToken, databaseId, title, properties) {
  return callMCPToolViaHTTP(
    NOTION_MCP_URL,
    accessToken,
    "notion-update-database",
    {
      database_id: databaseId,
      title,
      properties
    }
  );
}
async function notionMCPQueryDatabase(accessToken, databaseId, filter, sorts) {
  return callMCPToolViaHTTP(
    NOTION_MCP_URL,
    accessToken,
    "notion-query-data-sources",
    {
      database_id: databaseId,
      filter,
      sorts
    }
  );
}
async function notionMCPCreateComment(accessToken, pageId, content) {
  return callMCPToolViaHTTP(
    NOTION_MCP_URL,
    accessToken,
    "notion-create-comment",
    {
      page_id: pageId,
      content
    }
  );
}
async function notionMCPGetTeams(accessToken) {
  return callMCPToolViaHTTP(
    NOTION_MCP_URL,
    accessToken,
    "notion-get-teams",
    {}
  );
}
async function notionMCPGetUsers(accessToken) {
  return callMCPToolViaHTTP(
    NOTION_MCP_URL,
    accessToken,
    "notion-get-users",
    {}
  );
}
async function notionMCPGetUser(accessToken, userId) {
  return callMCPToolViaHTTP(NOTION_MCP_URL, accessToken, "notion-get-user", {
    user_id: userId
  });
}

export {
  notionMCPSearch,
  notionMCPFetch,
  notionMCPGetSelf,
  notionMCPGetComments,
  notionMCPCreatePages,
  notionMCPUpdatePage,
  notionMCPMovePages,
  notionMCPDuplicatePage,
  notionMCPCreateDatabase,
  notionMCPUpdateDatabase,
  notionMCPQueryDatabase,
  notionMCPCreateComment,
  notionMCPGetTeams,
  notionMCPGetUsers,
  notionMCPGetUser
};
