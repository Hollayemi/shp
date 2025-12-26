/**
 * Shared authentication helper for API proxy routes
 * Handles session validation and chat token creation
 */

import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { createChatToken } from "@shipper/shared";

const CHAT_TOKEN_SECRET = process.env.CHAT_TOKEN_SECRET || process.env.NEXTAUTH_SECRET;

export interface AuthResult {
  success: boolean;
  chatToken?: string;
  userId?: string;
  error?: string;
  status?: number;
}

/**
 * Validates session and creates chat token for API authentication
 */
export async function validateAndCreateChatToken(): Promise<AuthResult> {
  // Validate session
  const session = await auth();
  
  if (!session?.user?.id) {
    return {
      success: false,
      error: "Authentication required",
      status: 401,
    };
  }

  // Get session token from cookies
  const cookieStore = await cookies();
  const sessionToken =
    cookieStore.get("authjs.session-token")?.value ||
    cookieStore.get("__Secure-authjs.session-token")?.value ||
    cookieStore.get("next-auth.session-token")?.value ||
    cookieStore.get("__Secure-next-auth.session-token")?.value;

  if (!sessionToken) {
    console.error("[API Proxy Auth] No session token found in cookies");
    return {
      success: false,
      error: "No session token found",
      status: 401,
    };
  }

  // Create encrypted chat token for API authentication
  const chatToken = createChatToken(
    sessionToken,
    session.user.id,
    session.user.email!,
    CHAT_TOKEN_SECRET!
  );

  return {
    success: true,
    chatToken,
    userId: session.user.id,
  };
}
