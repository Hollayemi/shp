/**
 * Chat Stream Resume Proxy
 *
 * Proxies stream resume requests to the standalone API server.
 * Uses encrypted chat token for authentication (same as main chat proxy).
 *
 * This ensures stream resumption works on mobile (iOS Safari)
 * with the same authentication flow as the initial POST request.
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

export const maxDuration = 300;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/chat-proxy/[projectId]/stream
 * Resume an existing stream for a project
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: "Project ID is required" },
        { status: 400 },
      );
    }

    // Validate session
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
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
        { success: false, error: "No session token found" },
        { status: 401 },
      );
    }

    // Create encrypted chat token (same as main chat proxy)
    const chatToken = createChatToken(
      sessionToken,
      session.user.id!,
      session.user.email!,
      CHAT_TOKEN_SECRET!,
    );

    console.log("[Chat Proxy] Resuming stream:", {
      userId: session.user.id,
      projectId,
      apiServer: API_SERVER_URL,
    });

    // Forward resume request to API server
    const response = await fetch(
      `${API_SERVER_URL}/api/v1/chat/${projectId}/stream`,
      {
        method: "GET",
        headers: {
          "x-chat-token": chatToken,
        },
      },
    );

    // Handle 204 No Content (no stream to resume)
    if (response.status === 204) {
      return new NextResponse(null, { status: 204 });
    }

    // Check if response is OK
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Chat Proxy] Resume error:", response.status, errorText);

      return NextResponse.json(
        { success: false, error: errorText || "Resume failed" },
        { status: response.status },
      );
    }

    // Stream the response back to the client
    const headers = new Headers();
    headers.set("Content-Type", "text/event-stream");
    headers.set("Cache-Control", "no-cache");
    headers.set("Connection", "keep-alive");

    return new NextResponse(response.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("[Chat Proxy] Resume error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
