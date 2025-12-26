import {
  redisFileStreamEmitter,
  type FileCreationEvent,
} from "@/lib/redis-file-events";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// CORS headers for cross-origin requests
const corsHeaders = {
  "Access-Control-Allow-Origin":
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Handle OPTIONS preflight requests
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export const GET = async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) => {
  const { projectId } = await params;

  console.log(
    `[file-stream] SSE connection requested for project ${projectId}`,
  );

  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true },
  });

  if (!project || project.userId !== session.user.id) {
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  const encoder = new TextEncoder();
  let isClosed = false;

  const stream = new ReadableStream({
    start(controller) {
      console.log(`[file-stream] SSE stream started for project ${projectId}`);

      const sendEvent = (event: FileCreationEvent) => {
        if (isClosed) return;

        try {
          const data = JSON.stringify(event);
          const message = `data: ${data}\n\n`;
          controller.enqueue(encoder.encode(message));
          console.log(`[file-stream] Sent event for file: ${event.filePath}`);
        } catch (error) {
          console.error("[file-stream] Error sending event:", error);
        }
      };

      const unsubscribe = redisFileStreamEmitter.onFileCreation(
        projectId,
        sendEvent,
      );

      const keepAlive = setInterval(() => {
        if (isClosed) {
          clearInterval(keepAlive);
          return;
        }
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch (error) {
          clearInterval(keepAlive);
        }
      }, 30000);

      request.signal.addEventListener("abort", () => {
        console.log(
          `[file-stream] SSE connection closed for project ${projectId}`,
        );
        isClosed = true;
        clearInterval(keepAlive);
        unsubscribe();
        try {
          controller.close();
        } catch (e) {
          console.warn("[file-stream] Error closing controller:", e);
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
};
