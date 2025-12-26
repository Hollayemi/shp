/**
 * Authentication Middleware for Billing Service
 *
 * API key authentication for protected routes.
 * Note: Webhook endpoints bypass this middleware entirely (registered before it in index.ts)
 * and use HMAC signature verification instead.
 */

import { Request, Response, NextFunction } from "express";
import type { ApiResponse } from "@shipper/shared";

const SHIPPER_API_KEY = process.env.SHIPPER_API_KEY;

export function validateApiKey(req: Request, res: Response, next: NextFunction) {
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

  next();
}
