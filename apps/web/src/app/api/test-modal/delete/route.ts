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

    const { sandboxId } = await request.json();

    if (!sandboxId) {
      return NextResponse.json(
        { error: "Sandbox ID is required" },
        { status: 400 }
      );
    }

    console.log("[Test Modal] Deleting sandbox", { sandboxId });

    // Call API server to delete Modal sandbox
    const deleteResponse = await fetch(
      `${API_URL}/api/v1/modal/sandbox/${sandboxId}`,
      {
        method: "DELETE",
        headers: {
          "x-api-key": API_KEY || "",
        },
      }
    );

    if (!deleteResponse.ok) {
      const errorData = await deleteResponse.json();
      throw new Error(errorData.error || "Failed to delete sandbox");
    }

    console.log("[Test Modal] Sandbox deleted successfully", { sandboxId });

    // Also delete the test project from database
    try {
      const { prisma } = await import("@shipper/database");

      // Find project with this sandboxId
      const project = await prisma.project.findFirst({
        where: { sandboxId },
        select: { id: true },
      });

      if (project?.id.startsWith("test-")) {
        await prisma.project.delete({
          where: { id: project.id },
        });
        console.log("[Test Modal] Test project deleted from database", {
          projectId: project.id,
        });
      }
    } catch (dbError) {
      console.error("[Test Modal] Failed to delete test project:", dbError);
      // Don't fail the request if DB cleanup fails
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Test Modal] Error deleting sandbox:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
