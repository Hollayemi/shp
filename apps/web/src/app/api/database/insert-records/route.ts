import { NextRequest, NextResponse } from "next/server";
import { validateAndCreateChatToken } from "@/lib/api-proxy-auth";

const API_BASE_URL = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export async function POST(req: NextRequest) {
  try {
    // Validate session and create chat token
    const authResult = await validateAndCreateChatToken();
    
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status || 401 }
      );
    }

    const body = await req.json();

    console.log("[Database Proxy] Forwarding insert-records request to API server:", {
      userId: authResult.userId,
      projectId: body.projectId,
      tableName: body.tableName,
      recordCount: body.records?.length,
      apiServer: API_BASE_URL,
    });

    // Forward to Express API with authentication
    const response = await fetch(`${API_BASE_URL}/api/v1/database/insert-records`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.SHIPPER_API_KEY || "",
        "x-chat-token": authResult.chatToken!,
      },
      body: JSON.stringify(body),
    });

    // Try to parse JSON, handle non-JSON responses
    let data;
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();
      console.error("[Database Proxy] Non-JSON response from API:", text);
      data = {
        success: false,
        error: text || "API server returned non-JSON response",
      };
    }

    if (!response.ok) {
      console.error("[Database Proxy] API server error:", response.status, data);
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("[Database Proxy] Insert records error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
