/**
 * Session Authentication Middleware
 *
 * Validates NextAuth session tokens for chat and other user-specific endpoints.
 * Extracts user information and validates project access.
 */

import { Request, Response, NextFunction } from "express";
import type { ApiResponse } from "@shipper/shared";
import { decryptChatToken } from "@shipper/shared";
import { prisma } from "@shipper/database";

const CHAT_TOKEN_SECRET =
  process.env.CHAT_TOKEN_SECRET || process.env.NEXTAUTH_SECRET;

// Extend Express Request type to include user and session data
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string | null;
        role: string;
      };
      session?: {
        sessionToken: string;
        expires: Date;
      };
    }
  }
}

/**
 * Helper function to parse cookies from Cookie header
 */
function parseCookies(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(";").map((cookie) => {
      const [key, ...v] = cookie.trim().split("=");
      return [key, v.join("=")];
    }),
  );
}

/**
 * Validate NextAuth session token from multiple sources
 *
 * Supports three authentication methods:
 * 1. Encrypted chat token in x-chat-token header (for direct browser requests)
 * 2. Cookies (for same-origin requests)
 * 3. Authorization header with format: "Bearer <sessionToken>" (for proxy requests)
 */
export async function validateSession(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    let sessionToken: string | undefined;
    let userId: string | undefined;
    let userEmail: string | undefined;

    // Method 1: Try encrypted chat token header (preferred for direct browser calls)
    const chatToken = req.headers["x-chat-token"] as string;
    if (chatToken && CHAT_TOKEN_SECRET) {
      const payload = decryptChatToken(chatToken, CHAT_TOKEN_SECRET);
      if (payload) {
        sessionToken = payload.sessionToken;
        userId = payload.userId;
        userEmail = payload.email;
        console.log(
          "[SessionAuth] Using encrypted chat token for user:",
          userEmail,
        );
      }
    }

    // Method 2: Try to get session token from cookies (same-origin requests)
    if (!sessionToken) {
      const cookies = parseCookies(req.headers.cookie);
      sessionToken =
        cookies["next-auth.session-token"] ||
        cookies["__Secure-next-auth.session-token"];
    }

    // Method 3: Fall back to Authorization header (proxy or programmatic requests)
    if (!sessionToken) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        sessionToken = authHeader.substring(7); // Remove "Bearer " prefix
      }
    }

    // If no session token found in any location
    if (!sessionToken) {
      const response: ApiResponse = {
        success: false,
        error: "Missing session token. Please sign in.",
      };
      return res.status(401).json(response);
    }

    // If we have userId and email from encrypted chat token, use that directly
    // (NextAuth v5 uses JWT strategy, so sessions aren't in database)
    if (userId && userEmail) {
      // Validate user exists in database
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          creditBalance: true,
          membershipTier: true,
        },
      });

      if (!user) {
        const response: ApiResponse = {
          success: false,
          error: "User not found",
        };
        return res.status(401).json(response);
      }

      // Attach user data to request object
      req.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      };

      req.session = {
        sessionToken,
        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      };
    } else {
      // Fallback: try to validate session token against database (for database session strategy)
      const session = await prisma.session.findUnique({
        where: { sessionToken },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              creditBalance: true,
              membershipTier: true,
            },
          },
        },
      });

      if (!session) {
        const response: ApiResponse = {
          success: false,
          error: "Invalid session token",
        };
        return res.status(401).json(response);
      }

      // Check if session is expired
      if (session.expires < new Date()) {
        const response: ApiResponse = {
          success: false,
          error: "Session expired. Please sign in again.",
        };
        return res.status(401).json(response);
      }

      // Attach user data to request object
      req.user = {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: session.user.role,
      };

      req.session = {
        sessionToken: session.sessionToken,
        expires: session.expires,
      };
    }

    console.log(`[SessionAuth] Validated session for user: ${req.user.email}`);
    next();
  } catch (error) {
    console.error("[SessionAuth] Session validation error:", error);

    // Detect network/database connection errors
    const errorMsg = (
      error instanceof Error ? error.message : String(error)
    ).toLowerCase();
    const isNetworkError =
      errorMsg.includes("econnrefused") ||
      errorMsg.includes("enotfound") ||
      errorMsg.includes("etimedout") ||
      errorMsg.includes("connection") ||
      errorMsg.includes("network");

    const response: ApiResponse = {
      success: false,
      error: isNetworkError
        ? "Network error - please reload the page and retry when your internet connection improves"
        : "Failed to validate session",
    };
    return res.status(500).json(response);
  }
}

/**
 * Validate user has access to a specific project
 * Should be used after validateSession middleware
 */
export async function validateProjectAccess(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) {
      const response: ApiResponse = {
        success: false,
        error: "User not authenticated",
      };
      return res.status(401).json(response);
    }

    // Extract projectId from body or params
    const projectId = req.body.projectId || req.params.projectId;

    if (!projectId) {
      const response: ApiResponse = {
        success: false,
        error: "Missing projectId",
      };
      return res.status(400).json(response);
    }

    // Check if user owns the project directly or has access through team
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          // Direct ownership (legacy personal projects)
          { userId: req.user.id },
          // Team membership access
          {
            team: {
              members: {
                some: {
                  userId: req.user.id,
                },
              },
            },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        userId: true,
        teamId: true,
        team: {
          select: {
            id: true,
            name: true,
            members: {
              where: { userId: req.user.id },
              select: { role: true },
            },
          },
        },
      },
    });

    if (!project) {
      const response: ApiResponse = {
        success: false,
        error: "Project not found or access denied",
      };
      return res.status(404).json(response);
    }

    // Attach project data to request for downstream use
    (req as any).project = project;

    console.log(
      `[ProjectAccess] Validated access for user ${req.user.email} to project ${projectId}`,
    );
    next();
  } catch (error) {
    console.error("[ProjectAccess] Validation error:", error);
    const response: ApiResponse = {
      success: false,
      error: "Failed to validate project access",
    };
    return res.status(500).json(response);
  }
}
