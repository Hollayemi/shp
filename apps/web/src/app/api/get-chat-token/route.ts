/**
 * Get Chat Token API
 *
 * Generates an encrypted token for authenticating with the API server.
 * This allows direct browser → API server communication without cross-origin cookie issues.
 */

import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createChatToken } from "@shipper/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHAT_TOKEN_SECRET =
  process.env.CHAT_TOKEN_SECRET || process.env.NEXTAUTH_SECRET;

if (!CHAT_TOKEN_SECRET) {
  console.error("[GetChatToken] CHAT_TOKEN_SECRET not configured!");
}

export async function GET(_req: NextRequest) {
  try {
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

    // Create encrypted chat token
    const chatToken = createChatToken(
      sessionToken,
      session.user.id!,
      session.user.email!,
      CHAT_TOKEN_SECRET!,
    );

    return NextResponse.json(
      {
        success: true,
        data: { token: chatToken },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[GetChatToken] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate chat token",
      },
      { status: 500 },
    );
  }
}
