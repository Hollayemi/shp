import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const API_KEY = process.env.SHIPPER_API_KEY;

export async function POST(request: NextRequest) {
  try {
    // Check authentication and admin role
    const session = await auth();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized - not logged in" },
        { status: 401 }
      );
    }

    if (!isAdminEmail(session.user?.email)) {
      return NextResponse.json(
        { error: "Forbidden - admin access required" },
        { status: 403 }
      );
    }

    const { sandboxId, filePath } = await request.json();

    if (!sandboxId || !filePath) {
      return NextResponse.json(
        { error: "Sandbox ID and file path are required" },
        { status: 400 }
      );
    }

    console.log("[Test Modal] Reading file", { sandboxId, filePath });

    // Call API server to read file from Modal sandbox
    const readResponse = await fetch(`${API_URL}/api/v1/modal/file/read`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY || "",
      },
      body: JSON.stringify({
        sandboxId,
        path: filePath,
      }),
    });

    if (!readResponse.ok) {
      const errorData = await readResponse.json();
      throw new Error(errorData.error || "Failed to read file");
    }

    const fileResponse = await readResponse.json();
    const fileData = fileResponse.data; // Unwrap the data property

    console.log("[Test Modal] File read successfully", {
      filePath,
      contentLength: fileData.content.length,
    });

    return NextResponse.json({
      content: fileData.content,
    });
  } catch (error) {
    console.error("[Test Modal] Error reading file:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
