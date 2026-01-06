import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/**
 * GET /api/domains/demo-mode - Check if demo mode is enabled
 * This endpoint doesn't require authentication as it's just checking a config flag
 */
export async function GET(req: NextRequest) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/domains/demo-mode`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.SHIPPER_API_KEY || "",
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("[Domains Proxy] Check demo mode error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
