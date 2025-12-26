import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UI_MESSAGE_STREAM_HEADERS } from "ai";
import { after } from "next/server";
import { createResumableStreamContext } from "resumable-stream";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // auth check
  const session = await auth();

  if (!session) {
    console.log("[Stream GET] Unauthorized");
    return new Response("Unauthorized", { status: 401 });
  }

  const { id: projectId } = await params;

  if (!projectId) {
    console.log("[Stream GET] Project ID is required");
    return new Response("Project ID is required", { status: 400 });
  }

  // Verify project access
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
    },
  });

  if (!project) {
    console.log("[Stream GET] Project not found or access denied");
    return new Response("Project not found or access denied", { status: 404 });
  }

  // Check build status - only allow stream resumption if actively generating or building
  // Allow: GENERATING, BUILDING
  // Reject: IDLE, READY, ERROR, INITIALIZING
  if (
    project.buildStatus !== "GENERATING" &&
    project.buildStatus !== "BUILDING"
  ) {
    console.log(
      "[Stream GET] No resumable build in progress. Current status:",
      project.buildStatus
    );
    return new Response(null, { status: 204 });
  }

  const recentStreamId = project.activeStreamId;

  if (!recentStreamId) {
    console.log("[Stream GET] No active stream found for project:", projectId);
    return new Response(null, { status: 204 });
  }

  // Check if Redis is available for resumable streams
  const redisAvailable = !!process.env.REDIS_URL;
  if (!redisAvailable) {
    console.log(
      "[Stream GET] Redis not available - stream resumption disabled",
    );
    return new Response(null, { status: 204 });
  }

  const streamContext = createResumableStreamContext({
    waitUntil: after,
  });

  console.log("[Stream GET] Resuming existing stream:", recentStreamId);

  const resumedStream = await streamContext.resumeExistingStream(
    recentStreamId,
  );

  if (!resumedStream) {
    console.log("[Stream GET] Stream not found or already completed");
    return new Response(null, { status: 204 });
  }

  return new Response(resumedStream, { headers: UI_MESSAGE_STREAM_HEADERS });
}

// DELETE route to stop the stream
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // Auth check
  const session = await auth();

  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id: projectId } = await params;

  if (!projectId) {
    return new Response("Project ID is required", { status: 400 });
  }

  // Verify project access
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
    },
  });

  if (!project) {
    return new Response("Project not found or access denied", { status: 404 });
  }

  console.log("[Stream DELETE] Canceling stream for project:", projectId);

  // Clear the active stream ID to signal cancellation
  // The onChunk callback in the main route will detect this and abort the stream
  await prisma.project.update({
    where: { id: projectId },
    data: {
      activeStreamId: null,
      buildStatus: "IDLE",
      buildStatusUpdatedAt: new Date(),
    },
  });

  console.log("[Stream DELETE] Stream cancellation signal sent");

  return new Response(null, { status: 200 });
}
