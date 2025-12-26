import { NextRequest, NextResponse } from "next/server";
import { validateAndCreateChatToken } from "@/lib/api-proxy-auth";

const API_BASE_URL = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/**
 * GET /api/domains/status/[domainId] - Check domain verification status
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ domainId: string }> }
) {
  try {
    const authResult = await validateAndCreateChatToken();
    
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status || 401 }
      );
    }

    const { domainId } = await params;

    const response = await fetch(`${API_BASE_URL}/api/v1/domains/status/${domainId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.SHIPPER_API_KEY || "",
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("[Domains Proxy] Check status error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
