import Ably from "ably";
import { logger as defaultLogger } from "../config/logger.js";

const logger = defaultLogger.child({ service: "ably" });

// Singleton Ably client for server-side publishing
let ablyClient: Ably.Rest | null = null;

function getAblyClient(): Ably.Rest | null {
  if (!process.env.ABLY_API_KEY) {
    logger.warn("ABLY_API_KEY not configured, real-time sync disabled");
    return null;
  }

  if (!ablyClient) {
    ablyClient = new Ably.Rest({ key: process.env.ABLY_API_KEY });
    logger.info("Server client initialized");
  }

  return ablyClient;
}

// Channel naming conventions
export const CHANNELS = {
  project: (projectId: string) => `project:${projectId}`,
  workspace: (workspaceId: string) => `workspace:${workspaceId}`,
} as const;

// Event types for type safety
export type AblyEventType =
  // AI Streaming events
  | "ai:chunk" // AI response chunk
  | "ai:thinking" // AI thinking/reasoning
  | "ai:tool-call" // Tool being called
  | "ai:tool-result" // Tool result
  | "ai:complete" // AI response complete
  | "ai:error" // AI error
  // Chat state events
  | "chat:streaming-start" // Someone started a prompt
  | "chat:streaming-stop" // Streaming stopped (complete or cancelled)
  | "chat:message-added" // New message added
  | "chat:typing" // User is typing
  // Sandbox events
  | "sandbox:file-changed" // File was created/modified
  | "sandbox:file-deleted" // File was deleted
  | "sandbox:terminal-output" // Terminal output line
  | "sandbox:preview-reload" // Preview should reload
  | "sandbox:status" // Sandbox status change (creating, ready, error)
  // Presence events
  | "presence:join" // User joined project
  | "presence:leave"; // User left project

export interface AblyEvent<T = unknown> {
  type: AblyEventType;
  data: T;
  userId?: string;
  timestamp: number;
}

// Event data types
export interface AIChunkData {
  messageId: string;
  chunk: string;
  isThinking?: boolean;
}

export interface AIToolCallData {
  messageId: string;
  toolName: string;
  toolCallId: string;
  args?: Record<string, unknown>;
}

export interface AIToolResultData {
  messageId: string;
  toolCallId: string;
  result: unknown;
}

export interface ChatStreamingData {
  messageId?: string;
  userId: string;
  userName?: string;
  userMessage?: string; // The user's prompt that triggered the stream
}

export interface FileChangedData {
  path: string;
  content?: string; // Optional - may be too large
  action: "create" | "update" | "delete";
}

export interface TerminalOutputData {
  line: string;
  stream: "stdout" | "stderr";
}

export interface SandboxStatusData {
  status: "creating" | "ready" | "error" | "stopped";
  tunnelUrl?: string;
  error?: string;
}

export interface PresenceData {
  userId: string;
  userName?: string;
  userImage?: string;
}

/**
 * Publish an event to a project channel
 * All users viewing this project will receive the event
 */
export async function publishToProject<T>(
  projectId: string,
  eventType: AblyEventType,
  data: T,
  userId?: string,
): Promise<boolean> {
  const client = getAblyClient();
  if (!client) return false;

  try {
    const channel = client.channels.get(CHANNELS.project(projectId));
    const event: AblyEvent<T> = {
      type: eventType,
      data,
      userId,
      timestamp: Date.now(),
    };

    // Fire-and-forget: don't await to reduce latency
    channel.publish(eventType, event);
    logger.debug(
      { projectId, eventType, userId },
      "Published event to project",
    );
    return true;
  } catch (error) {
    logger.error(
      {
        projectId,
        eventType,
        error: error instanceof Error ? error.message : String(error),
      },
      "Failed to publish event to project",
    );
    return false;
  }
}

/**
 * Publish an event to a workspace channel
 * All users in this workspace will receive the event
 */
export async function publishToWorkspace<T>(
  workspaceId: string,
  eventType: AblyEventType,
  data: T,
  userId?: string,
): Promise<boolean> {
  const client = getAblyClient();
  if (!client) return false;

  try {
    const channel = client.channels.get(CHANNELS.workspace(workspaceId));
    const event: AblyEvent<T> = {
      type: eventType,
      data,
      userId,
      timestamp: Date.now(),
    };

    // Fire-and-forget: don't await to reduce latency
    channel.publish(eventType, event);
    logger.debug(
      { workspaceId, eventType, userId },
      "Published event to workspace",
    );
    return true;
  } catch (error) {
    logger.error(
      {
        workspaceId,
        eventType,
        error: error instanceof Error ? error.message : String(error),
      },
      "Failed to publish event to workspace",
    );
    return false;
  }
}

// Convenience functions for common events

/**
 * Chunk batching system to reduce Ably message count
 * Batches chunks per project/message and flushes every 100ms
 * Reduces messages by 50-80% (100 chunks → ~10 messages)
 */
interface ChunkBatch {
  chunks: string[];
  isThinking: boolean;
  userId?: string;
  timeout: NodeJS.Timeout;
}

const chunkBatches = new Map<string, ChunkBatch>();
const BATCH_INTERVAL_MS = 100; // Flush every 100ms

function flushChunkBatch(key: string, projectId: string, messageId: string) {
  const batch = chunkBatches.get(key);
  if (!batch || batch.chunks.length === 0) {
    chunkBatches.delete(key);
    return;
  }

  // Combine all chunks into one message
  const combinedChunk = batch.chunks.join("");

  publishToProject<AIChunkData>(
    projectId,
    batch.isThinking ? "ai:thinking" : "ai:chunk",
    {
      messageId,
      chunk: combinedChunk,
      isThinking: batch.isThinking,
    },
    batch.userId,
  );

  chunkBatches.delete(key);
}

export async function broadcastAIChunk(
  projectId: string,
  messageId: string,
  chunk: string,
  isThinking = false,
  userId?: string,
) {
  const key = `${projectId}:${messageId}:${isThinking}`;

  let batch = chunkBatches.get(key);

  if (!batch) {
    // Create new batch with flush timeout
    batch = {
      chunks: [],
      isThinking,
      userId,
      timeout: setTimeout(
        () => flushChunkBatch(key, projectId, messageId),
        BATCH_INTERVAL_MS,
      ),
    };
    chunkBatches.set(key, batch);
  }

  batch.chunks.push(chunk);
  return true;
}

/**
 * Force flush all pending chunks for a message (call on stream complete)
 */
export function flushPendingChunks(projectId: string, messageId: string) {
  // Flush both thinking and non-thinking batches
  for (const isThinking of [false, true]) {
    const key = `${projectId}:${messageId}:${isThinking}`;
    const batch = chunkBatches.get(key);
    if (batch) {
      clearTimeout(batch.timeout);
      flushChunkBatch(key, projectId, messageId);
    }
  }
}

export async function broadcastAIToolCall(
  projectId: string,
  messageId: string,
  toolName: string,
  toolCallId: string,
  args?: Record<string, unknown>,
  userId?: string,
) {
  return publishToProject<AIToolCallData>(
    projectId,
    "ai:tool-call",
    {
      messageId,
      toolName,
      toolCallId,
      args,
    },
    userId,
  );
}

export async function broadcastAIToolResult(
  projectId: string,
  messageId: string,
  toolCallId: string,
  result: unknown,
  userId?: string,
) {
  return publishToProject<AIToolResultData>(
    projectId,
    "ai:tool-result",
    {
      messageId,
      toolCallId,
      result,
    },
    userId,
  );
}

export async function broadcastAIComplete(
  projectId: string,
  messageId: string,
  userId?: string,
) {
  return publishToProject(projectId, "ai:complete", { messageId }, userId);
}

export async function broadcastAIError(
  projectId: string,
  messageId: string,
  error: string,
  userId?: string,
) {
  return publishToProject(projectId, "ai:error", { messageId, error }, userId);
}

export async function broadcastStreamingStart(
  projectId: string,
  userId: string,
  userName?: string,
  messageId?: string,
  userMessage?: string,
) {
  return publishToProject<ChatStreamingData>(
    projectId,
    "chat:streaming-start",
    {
      messageId,
      userId,
      userName,
      userMessage,
    },
    userId, // Pass userId to event envelope for client-side filtering
  );
}

export async function broadcastStreamingStop(
  projectId: string,
  userId: string,
  messageId?: string,
) {
  return publishToProject<ChatStreamingData>(
    projectId,
    "chat:streaming-stop",
    {
      messageId,
      userId,
    },
    userId, // Pass userId to event envelope for client-side filtering
  );
}

export async function broadcastFileChanged(
  projectId: string,
  path: string,
  action: "create" | "update" | "delete",
  content?: string,
) {
  return publishToProject<FileChangedData>(projectId, "sandbox:file-changed", {
    path,
    action,
    content: content?.length && content.length < 50000 ? content : undefined, // Don't send huge files
  });
}

export async function broadcastTerminalOutput(
  projectId: string,
  line: string,
  stream: "stdout" | "stderr" = "stdout",
) {
  return publishToProject<TerminalOutputData>(
    projectId,
    "sandbox:terminal-output",
    {
      line,
      stream,
    },
  );
}

export async function broadcastPreviewReload(projectId: string) {
  return publishToProject(projectId, "sandbox:preview-reload", {});
}

export async function broadcastSandboxStatus(
  projectId: string,
  status: SandboxStatusData["status"],
  tunnelUrl?: string,
  error?: string,
) {
  return publishToProject<SandboxStatusData>(projectId, "sandbox:status", {
    status,
    tunnelUrl,
    error,
  });
}
