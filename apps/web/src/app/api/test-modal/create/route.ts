import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
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

    const { template } = await request.json();

    if (!template) {
      return NextResponse.json(
        { error: "Template is required" },
        { status: 400 }
      );
    }

    // Create a test project ID
    const testProjectId = `test-${nanoid(10)}`;

    console.log("[Test Modal] Creating test project in database", {
      projectId: testProjectId,
    });

    // Create a temporary project record in the database
    // The Modal sandbox manager needs this to store sandbox metadata
    const { prisma } = await import("@shipper/database");
    await prisma.project.create({
      data: {
        id: testProjectId,
        name: `Test Modal Sandbox - ${template}`,
        userId: session.user.id,
        messagingVersion: 2,
      },
    });

    console.log("[Test Modal] Creating sandbox", {
      template,
      projectId: testProjectId,
    });

    // Call API server to create Modal sandbox
    const createResponse = await fetch(`${API_URL}/api/v1/modal/sandbox`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY || "",
      },
      body: JSON.stringify({
        projectId: testProjectId,
        templateName: template,
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error("[Test Modal] API error response:", {
        status: createResponse.status,
        statusText: createResponse.statusText,
        body: errorText,
      });
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        throw new Error(`Failed to create sandbox: ${createResponse.status} ${errorText}`);
      }
      throw new Error(errorData.error || "Failed to create sandbox");
    }

    const sandboxResponse = await createResponse.json();
    const sandboxData = sandboxResponse.data; // Unwrap the data property

    console.log("[Test Modal] Sandbox created", {
      sandboxId: sandboxData.sandboxId,
    });

    // List files in the sandbox
    const listResponse = await fetch(`${API_URL}/api/v1/modal/files/list`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY || "",
      },
      body: JSON.stringify({
        sandboxId: sandboxData.sandboxId,
      }),
    });

    if (!listResponse.ok) {
      const errorData = await listResponse.json();
      throw new Error(errorData.error || "Failed to list files");
    }

    const filesResponse = await listResponse.json();
    const filesData = filesResponse.data; // Unwrap the data property

    console.log("[Test Modal] Files listed", {
      fileCount: Object.keys(filesData.files).length,
    });

    return NextResponse.json({
      sandboxId: sandboxData.sandboxId,
      sandboxUrl: sandboxData.sandboxUrl,
      files: filesData.files,
      status: "running",
      projectId: testProjectId,
    });
  } catch (error) {
    console.error("[Test Modal] Error creating sandbox:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
