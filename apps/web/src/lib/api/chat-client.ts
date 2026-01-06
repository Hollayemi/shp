/**
 * Chat API Client
 *
 * Provides a client for communicating with the standalone API server's chat endpoint.
 * Handles authentication, streaming, and error handling.
 */

import { getSession } from "next-auth/react";

// Get API URL from environment variables
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/**
 * Custom fetch function that adds authentication headers
 * to requests sent to the API server.
 */
export async function createAuthenticatedFetch() {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    // Get session token from NextAuth
    const session = await getSession();

    if (!session?.user) {
      throw new Error("Not authenticated");
    }

    // Construct headers with authentication
    const headers = new Headers(init?.headers);

    // Add session token for authentication
    // The API server middleware will validate this token
    if (session.user.id) {
      headers.set("x-user-id", session.user.id);
    }

    if (session.user.email) {
      headers.set("x-user-email", session.user.email);
    }

    // Add session token (the API middleware expects this)
    // In a production setup, you'd pass the full JWT or session token
    // For now, we'll use a simplified approach
    headers.set("Authorization", `Bearer ${session.user.id}`);

    // Determine the URL to call
    let url: string;
    if (typeof input === "string") {
      // If it's a relative URL, prepend the API base URL
      if (input.startsWith("/")) {
        url = `${API_BASE_URL}${input}`;
      } else {
        url = input;
      }
    } else if (input instanceof URL) {
      url = input.toString();
    } else {
      // input is Request
      url = input.url;
    }

    // Make the authenticated request
    return fetch(url, {
      ...init,
      headers,
      credentials: "include",
    });
  };
}

/**
 * Chat client configuration for Vercel AI SDK
 */
export const chatConfig = {
  /**
   * API endpoint for chat requests
   * This will be transformed to the full API server URL by the authenticated fetch
   */
  api: "/api/v1/chat",

  /**
   * Headers to include with each request
   */
  headers: {
    "Content-Type": "application/json",
  },

  /**
   * Credentials mode for cross-origin requests
   */
  credentials: "include" as RequestCredentials,
};

/**
 * Create a custom fetch function for the Vercel AI SDK
 * that automatically adds authentication headers.
 *
 * Usage in chat component:
 * ```typescript
 * const { fetch: authenticatedFetch } = useChatClient();
 *
 * useChat({
 *   api: "/api/v1/chat",
 *   fetch: authenticatedFetch,
 *   // ... other options
 * });
 * ```
 */
export function useChatClient() {
  return {
    /**
     * Get an authenticated fetch function
     */
    getAuthenticatedFetch: createAuthenticatedFetch,

    /**
     * Chat configuration
     */
    config: chatConfig,

    /**
     * API base URL
     */
    apiUrl: API_BASE_URL,
  };
}

/**
 * Direct API call helper for chat requests (non-streaming)
 * Useful for testing or non-streaming use cases.
 */
export async function sendChatMessage(params: {
  message: {
    id?: string;
    role: "user" | "assistant";
    content: string;
    createdAt?: string;
  };
  projectId: string;
}) {
  const session = await getSession();

  if (!session?.user) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(`${API_BASE_URL}/api/v1/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": session.user.id,
      "x-user-email": session.user.email || "",
      Authorization: `Bearer ${session.user.id}`,
    },
    body: JSON.stringify(params),
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Unknown error" }));
    throw new Error(error.message || "Chat request failed");
  }

  return response;
}

/**
 * Health check for the chat API
 */
export async function checkChatHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/chat/health`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return { healthy: false, error: "API not responding" };
    }

    const data = await response.json();
    return { healthy: true, data };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
