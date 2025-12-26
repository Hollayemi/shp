/**
 * API Authentication Middleware
 *
 * Validates API key for all protected routes.
 * Prevents unauthorized access to Shipper API endpoints.
 */

import { Request, Response, NextFunction } from "express";
import type { ApiResponse } from "@shipper/shared";

const SHIPPER_API_KEY = process.env.SHIPPER_API_KEY;

// Use Sets for O(1) lookup performance
const SESSION_AUTH_PATHS = new Set([
  "/api/v1/chat",
  "/api/v1/upload",
  "/api/v1/user",
  "/api/v1/connectors",
]);
const CUSTOM_AUTH_PATHS = new Set(["/api/v1/domains/lookup"]);

export function validateApiKey(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // Skip auth for health check
  if (req.path === "/health") {
    return next();
  }

  // Skip API key auth for routes that use session auth instead
  for (const path of SESSION_AUTH_PATHS) {
    if (req.path.startsWith(path)) {
      return next();
    }
  }

  // Skip API key auth for routes that use their own API key validation
  if (CUSTOM_AUTH_PATHS.has(req.path)) {
    return next();
  }

  // Skip API key auth for AI proxy routes (they use project token auth instead)
  if (req.path.startsWith("/api/v1/ai")) {
    return next();
  }

  const apiKey = req.headers["x-api-key"] as string;

  if (!SHIPPER_API_KEY) {
    console.error("[Auth] SHIPPER_API_KEY not configured!");
    const response: ApiResponse = {
      success: false,
      error: "Server configuration error",
    };
    return res.status(500).json(response);
  }

  if (!apiKey) {
    const response: ApiResponse = {
      success: false,
      error: "Missing API key. Include 'x-api-key' header.",
    };
    return res.status(401).json(response);
  }

  if (apiKey !== SHIPPER_API_KEY) {
    console.warn("[Auth] Invalid API key attempt");
    const response: ApiResponse = {
      success: false,
      error: "Invalid API key",
    };
    return res.status(401).json(response);
  }

  // API key is valid, proceed
  next();
}
