import { NextRequest, NextResponse } from "next/server";
import { validateAndCreateChatToken } from "@/lib/api-proxy-auth";

const API_BASE_URL = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/**
 * POST /api/domains/unset-primary/[projectId] - Unset all primary domains for a project
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    // Check authentication
    const authResult = await validateAndCreateChatToken();
    
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status || 401 }
      );
    }

    const { projectId } = await params;

    const response = await fetch(`${API_BASE_URL}/api/v1/domains/unset-primary/${projectId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.SHIPPER_API_KEY || "",
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: data.error || "Failed to unset primary domain" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("[Domains Proxy] Error unsetting primary domain:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
