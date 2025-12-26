import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkProjectAccess } from "@/helpers/checkProjectAccess";
import { ErrorStatus } from "@/lib/db";
import { daytonaAPI } from "@/lib/api/daytona-client";

export async function POST(req: Request) {
  try {
    // Check authentication
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json(
        {
          error: "Authentication required",
          message: "You must be signed in to access this resource",
        },
        { status: 401 }
      );
    }

    const {
      projectId,
      severity,
      maxFixes = 10,
      refreshSandbox = false,
    } = await req.json();

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }

    // Check project access
    const hasAccess = await checkProjectAccess(projectId, session.user.id);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Project not found or access denied" },
        { status: 404 }
      );
    }

    // Get latest fragment ID
    const latestFragment = await prisma.v2Fragment.findFirst({
      where: { projectId },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });

    if (!latestFragment) {
      return NextResponse.json(
        { error: "No fragment found for this project" },
        { status: 404 }
      );
    }

    console.log(`[AutoFix] Calling API to auto-fix errors for project ${projectId}`);

    // Use API for auto-fix (handles error detection, VoltAgent, and fragment creation)
    const apiResult = await daytonaAPI.autoFixErrors(
      projectId,
      latestFragment.id
    );

    const { fixResults, summary, newFragmentId } = apiResult;

    console.log(
      `[AutoFix] API completed: ${summary.successfulFixes}/${summary.totalErrors} errors fixed`
    );

    // If fixes were successful and we have a new fragment, restore it to the sandbox
    let sandboxRefreshed = false;
    if (newFragmentId && summary.successfulFixes > 0) {
      try {
        const sandboxInfo = await daytonaAPI.getSandbox(projectId);

        if (sandboxInfo?.sandboxId) {
          console.log(`[AutoFix] Restoring fixed fragment ${newFragmentId} to sandbox`);

          await daytonaAPI.restoreV2Fragment(
            sandboxInfo.sandboxId,
            newFragmentId,
            projectId
          );

          sandboxRefreshed = true;
          console.log(`[AutoFix] Successfully restored fixed fragment to sandbox`);
        }
      } catch (refreshError) {
        console.warn(`[AutoFix] Failed to restore fragment to sandbox:`, refreshError);
        // Don't fail the entire operation if sandbox refresh fails
      }

      // Update project's active fragment
      await prisma.project.update({
        where: { id: projectId },
        data: {
          activeFragmentId: newFragmentId,
          updatedAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      summary: {
        totalErrors: summary.totalErrors,
        successfulFixes: summary.successfulFixes,
        failedFixes: summary.failedFixes,
        successRate: summary.successRate,
      },
      fixes: fixResults,
      sandboxRefreshed,
      newFragmentId,
      message:
        summary.successfulFixes > 0
          ? `Successfully fixed ${summary.successfulFixes} out of ${
              summary.totalErrors
            } errors${sandboxRefreshed ? " and refreshed sandbox" : ""}`
          : `Could not auto-fix any of the ${summary.totalErrors} errors`,
    });
  } catch (error) {
    console.error("[AutoFix API] Error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: "Failed to process auto-fix request",
      },
      { status: 500 }
    );
  }
}
