/**
 * Chat API Proxy
 *
 * Proxies chat requests to the standalone API server.
 * Uses encrypted chat token for authentication.
 *
 * This allows the frontend to use same-origin requests which
 * works better on mobile (avoids iOS Safari streaming issues).
 */

import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createChatToken } from "@shipper/shared";

// API server URL from environment
const API_SERVER_URL =
  process.env.API_SERVER_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:4000";

const CHAT_TOKEN_SECRET =
  process.env.CHAT_TOKEN_SECRET || process.env.NEXTAUTH_SECRET;

// For streaming responses, the connection stays open as long as data flows
// The maxDuration primarily affects initial response time, not streaming duration
export const maxDuration = 300; // 5 minutes (maximum for Pro plan)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // Validate session
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required",
        },
        { status: 401 },
      );
    }

    // Get session token from cookies (NextAuth v5 uses authjs prefix)
    const cookieStore = await cookies();
    const sessionToken =
      cookieStore.get("authjs.session-token")?.value ||
      cookieStore.get("__Secure-authjs.session-token")?.value ||
      cookieStore.get("next-auth.session-token")?.value ||
      cookieStore.get("__Secure-next-auth.session-token")?.value;

    if (!sessionToken) {
      return NextResponse.json(
        {
          success: false,
          error: "No session token found",
        },
        { status: 401 },
      );
    }

    // Create encrypted chat token (same as get-chat-token route)
    const chatToken = createChatToken(
      sessionToken,
      session.user.id!,
      session.user.email!,
      CHAT_TOKEN_SECRET!,
    );

    // Parse request body
    const body = await req.json();

    console.log("[Chat Proxy] Forwarding request to API server:", {
      userId: session.user.id,
      projectId: body.projectId,
      apiServer: API_SERVER_URL,
    });

    // Forward request to API server with encrypted chat token
    const response = await fetch(`${API_SERVER_URL}/api/v1/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-chat-token": chatToken,
      },
      body: JSON.stringify(body),
    });

    // Check if response is OK
    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        "[Chat Proxy] API server error:",
        response.status,
        errorText,
      );

      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText };
      }

      return NextResponse.json(
        {
          success: false,
          error: errorData.error || "API server error",
        },
        { status: response.status },
      );
    }

    // Stream the response back to the client
    // The API server returns SSE (text/event-stream)
    const headers = new Headers();
    headers.set("Content-Type", "text/event-stream");
    headers.set("Cache-Control", "no-cache");
    headers.set("Connection", "keep-alive");

    // Return the streaming response
    return new NextResponse(response.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("[Chat Proxy] Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}

/**
 * Health check endpoint
 */
export async function GET() {
  try {
    // Check API server health
    const response = await fetch(`${API_SERVER_URL}/api/v1/chat/health`, {
      method: "GET",
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: "API server not healthy",
          apiServer: API_SERVER_URL,
        },
        { status: 503 },
      );
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      message: "Chat proxy is healthy",
      apiServer: API_SERVER_URL,
      apiHealth: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Health check failed",
        apiServer: API_SERVER_URL,
      },
      { status: 503 },
    );
  }
}
