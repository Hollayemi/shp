/**
 * SSE Pub/Sub Service
 *
 * Self-hosted alternative to Ably for real-time events.
 * Uses Redis pub/sub for multi-instance scaling.
 * Keeps Ably code intact - both can run in parallel.
 *
 * Architecture:
 * - Server publishes events to Redis channels
 * - SSE endpoint subscribes to Redis and forwards to connected clients
 * - Clients connect via EventSource to receive events
 */

import { Redis } from "ioredis";
import { Response } from "express";
import { logger as defaultLogger } from "../config/logger.js";
import type { FileCreationEvent } from "@shipper/shared";
import { subscribeToFileEvents } from "./redis-file-events.js";

const logger = defaultLogger.child({ service: "sse-pubsub" });

// Channel prefixes
const CHANNEL_PREFIX = {
  project: "sse:project:",
  workspace: "sse:workspace:",
  fileEvents: "file-events:",
} as const;

// Event types (same as Ably for compatibility)
export type SSEEventType =
  // AI Streaming events
  | "ai:chunk"
  | "ai:thinking"
  | "ai:tool-call"
  | "ai:tool-result"
  | "ai:complete"
  | "ai:error"
  // Chat state events
  | "chat:streaming-start"
  | "chat:streaming-stop"
  | "chat:message-added"
  | "chat:typing"
  // Sandbox events
  | "sandbox:file-changed"
  | "sandbox:file-deleted"
  | "sandbox:terminal-output"
  | "sandbox:preview-reload"
  | "sandbox:status"
  // File stream events (real-time file creation during AI generation)
  | "file:created"
  | "file:updated"
  | "file:stream-complete"
  // Presence events
  | "presence:join"
  | "presence:leave"
  // Advisor events
  | "advisor:chunk"
  | "advisor:thinking"
  | "advisor:complete"
  | "advisor:streaming-start"
  | "advisor:streaming-stop"
  | "advisor:tool-call"
  | "advisor:tool-result";

export interface SSEEvent<T = unknown> {
  type: SSEEventType;
  data: T;
  userId?: string;
  timestamp: number;
}

// Connected SSE clients per channel
interface SSEClient {
  res: Response;
  userId?: string;
  connectedAt: number;
}

class SSEPubSubService {
  private static instance: SSEPubSubService;
  private redisPublisher: Redis | null = null;
  private redisSubscriber: Redis | null = null;
  private fileEventSubscriber: Redis | null = null; // Separate subscriber for file-events pattern
  private isInitialized = false;
  private clients = new Map<string, Set<SSEClient>>(); // channel -> clients
  private fileStreamClients = new Map<string, Set<SSEClient>>(); // projectId -> file stream clients
  private fileEventBuffers = new Map<string, FileCreationEvent[]>(); // projectId -> buffered events
  private readonly FILE_BUFFER_SIZE = 50;
  private readonly FILE_BUFFER_TTL_MS = 60000; // 1 minute
  private subscribedChannels = new Set<string>();

  private constructor() {
    this.initialize();
    this.startFileEventCleanup();
  }

  static getInstance(): SSEPubSubService {
    if (!SSEPubSubService.instance) {
      SSEPubSubService.instance = new SSEPubSubService();
    }
    return SSEPubSubService.instance;
  }

  private initialize() {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      logger.warn(
        "REDIS_URL not configured - SSE pub/sub will use in-memory only (single instance)",
      );
      this.isInitialized = true;
      return;
    }

    try {
      // Publisher for sending events
      this.redisPublisher = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        retryStrategy: (times: number) => Math.min(times * 50, 2000),
        lazyConnect: false,
        enableOfflineQueue: true,
      });

      // Subscriber for receiving events (separate connection required for pub/sub)
      this.redisSubscriber = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        retryStrategy: (times: number) => Math.min(times * 50, 2000),
        lazyConnect: false,
      });

      this.redisPublisher.on("connect", () => {
        logger.info("Redis publisher connected for SSE");
        this.isInitialized = true;
      });

      this.redisSubscriber.on("connect", () => {
        logger.info("Redis subscriber connected for SSE");
      });

      // Handle incoming messages from Redis
      this.redisSubscriber.on("message", (channel: string, message: string) => {
        this.handleRedisMessage(channel, message);
      });

      this.redisPublisher.on("error", (error: Error) => {
        logger.error({ error: error.message }, "Redis publisher error");
      });

      this.redisSubscriber.on("error", (error: Error) => {
        logger.error({ error: error.message }, "Redis subscriber error");
      });

      // Create separate subscriber for file-events pattern (uses psubscribe)
      this.fileEventSubscriber = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        retryStrategy: (times: number) => Math.min(times * 50, 2000),
        lazyConnect: false,
      });

      this.fileEventSubscriber.on("connect", () => {
        logger.info("Redis file event subscriber connected for SSE");
      });

      this.fileEventSubscriber.on("error", (error: Error) => {
        logger.error({ error: error.message }, "Redis file event subscriber error");
      });

      // Subscribe to file-events pattern for all projects
      this.fileEventSubscriber.psubscribe(`${CHANNEL_PREFIX.fileEvents}*`, (err) => {
        if (err) {
          logger.error({ error: err.message }, "Failed to subscribe to file-events pattern");
        } else {
          logger.info("Subscribed to file-events pattern");
        }
      });

      // Handle file event messages from Redis
      this.fileEventSubscriber.on("pmessage", (_pattern: string, channel: string, message: string) => {
        this.handleFileEventMessage(channel, message);
      });

      logger.info("SSE pub/sub service initializing with Redis");
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "Failed to initialize SSE pub/sub Redis",
      );
      this.isInitialized = true; // Continue without Redis (in-memory only)
    }
  }

  /**
   * Start cleanup interval for file event buffers
   */
  private startFileEventCleanup() {
    setInterval(() => {
      const now = Date.now();
      for (const [projectId, events] of this.fileEventBuffers.entries()) {
        const validEvents = events.filter(
          (event) => now - event.timestamp < this.FILE_BUFFER_TTL_MS,
        );
        if (validEvents.length === 0) {
          this.fileEventBuffers.delete(projectId);
        } else if (validEvents.length !== events.length) {
          this.fileEventBuffers.set(projectId, validEvents);
        }
      }
    }, 30000);
  }

  /**
   * Buffer a file event for replay to new clients
   */
  private bufferFileEvent(projectId: string, event: FileCreationEvent) {
    if (!this.fileEventBuffers.has(projectId)) {
      this.fileEventBuffers.set(projectId, []);
    }

    const buffer = this.fileEventBuffers.get(projectId)!;
    buffer.push(event);

    if (buffer.length > this.FILE_BUFFER_SIZE) {
      buffer.shift();
    }
  }

  /**
   * Handle file event message from Redis and forward to file stream clients
   */
  private handleFileEventMessage(channel: string, message: string) {
    try {
      const projectId = channel.replace(CHANNEL_PREFIX.fileEvents, "");
      const event: FileCreationEvent = JSON.parse(message);

      logger.debug(
        { projectId, filePath: event.filePath, action: event.action },
        "Received file event from Redis",
      );

      // Buffer the event
      this.bufferFileEvent(projectId, event);

      // Forward to file stream clients for this project
      const clients = this.fileStreamClients.get(projectId);
      if (!clients || clients.size === 0) {
        logger.debug({ projectId }, "No file stream clients connected");
        return;
      }

      // Convert to SSE format
      const eventData = `data: ${JSON.stringify(event)}\n\n`;

      for (const client of clients) {
        try {
          client.res.write(eventData);
          logger.debug({ projectId, filePath: event.filePath }, "Sent file event to client");
        } catch (error) {
          // Client disconnected, remove from set
          clients.delete(client);
          logger.debug({ projectId }, "Removed disconnected file stream client");
        }
      }
    } catch (error) {
      logger.error(
        {
          channel,
          error: error instanceof Error ? error.message : String(error),
        },
        "Failed to handle file event message",
      );
    }
  }

  /**
   * Handle message received from Redis and forward to connected SSE clients
   */
  private handleRedisMessage(channel: string, message: string) {
    const clients = this.clients.get(channel);
    if (!clients || clients.size === 0) return;

    try {
      const event = JSON.parse(message) as SSEEvent;
      this.sendToClients(channel, event);
    } catch (error) {
      logger.error(
        {
          channel,
          error: error instanceof Error ? error.message : String(error),
        },
        "Failed to parse Redis message",
      );
    }
  }

  /**
   * Send event to all connected SSE clients on a channel
   */
  private sendToClients(channel: string, event: SSEEvent) {
    const clients = this.clients.get(channel);
    if (!clients) return;

    const eventData = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;

    for (const client of clients) {
      try {
        // Don't send events to the user who triggered them (they already have local state)
        if (event.userId && client.userId === event.userId) {
          continue;
        }

        client.res.write(eventData);
      } catch (error) {
        // Client disconnected, remove from set
        clients.delete(client);
        logger.debug({ channel }, "Removed disconnected SSE client");
      }
    }
  }

  /**
   * Subscribe a Redis channel (called when first client connects to a channel)
   */
  private async subscribeToChannel(channel: string) {
    if (this.subscribedChannels.has(channel)) return;

    if (this.redisSubscriber) {
      try {
        await this.redisSubscriber.subscribe(channel);
        this.subscribedChannels.add(channel);
        logger.debug({ channel }, "Subscribed to Redis channel");
      } catch (error) {
        logger.error(
          {
            channel,
            error: error instanceof Error ? error.message : String(error),
          },
          "Failed to subscribe to Redis channel",
        );
      }
    }
  }

  /**
   * Unsubscribe from Redis channel (called when last client disconnects)
   */
  private async unsubscribeFromChannel(channel: string) {
    if (!this.subscribedChannels.has(channel)) return;

    if (this.redisSubscriber) {
      try {
        await this.redisSubscriber.unsubscribe(channel);
        this.subscribedChannels.delete(channel);
        logger.debug({ channel }, "Unsubscribed from Redis channel");
      } catch (error) {
        logger.error(
          {
            channel,
            error: error instanceof Error ? error.message : String(error),
          },
          "Failed to unsubscribe from Redis channel",
        );
      }
    }
  }

  // ============================================
  // PUBLIC API
  // ============================================

  /**
   * Add an SSE client connection for a project channel
   */
  async addProjectClient(
    projectId: string,
    res: Response,
    userId?: string,
  ): Promise<() => void> {
    const channel = `${CHANNEL_PREFIX.project}${projectId}`;
    return this.addClient(channel, res, userId);
  }

  /**
   * Add an SSE client connection for a workspace channel
   */
  async addWorkspaceClient(
    workspaceId: string,
    res: Response,
    userId?: string,
  ): Promise<() => void> {
    const channel = `${CHANNEL_PREFIX.workspace}${workspaceId}`;
    return this.addClient(channel, res, userId);
  }

  /**
   * Add an SSE client connection for file stream events
   * This is a separate stream specifically for real-time file creation events during AI generation
   */
  async addFileStreamClient(
    projectId: string,
    res: Response,
    userId?: string,
  ): Promise<() => void> {
    // Set up SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering
    res.flushHeaders();

    // Send initial connection confirmation (important for EventSource.onopen to work correctly)
    res.write(`data: ${JSON.stringify({ type: "connected", projectId, timestamp: Date.now() })}\n\n`);

    const client: SSEClient = {
      res,
      userId,
      connectedAt: Date.now(),
    };

    // Add to file stream clients map
    if (!this.fileStreamClients.has(projectId)) {
      this.fileStreamClients.set(projectId, new Set());
    }
    this.fileStreamClients.get(projectId)!.add(client);

    const clientCount = this.fileStreamClients.get(projectId)?.size || 0;
    logger.info({ projectId, userId, clientCount }, "File stream client connected");

    // Subscribe to in-memory file events (fallback when Redis is not available)
    const unsubscribeInMemory = subscribeToFileEvents(projectId, (event) => {
      try {
        const eventData = `data: ${JSON.stringify(event)}\n\n`;
        res.write(eventData);
        logger.debug({ projectId, filePath: event.filePath }, "Sent in-memory file event to client");
      } catch (error) {
        logger.warn({ projectId }, "Failed to send in-memory file event to client");
      }
    });

    // Replay buffered events to new client
    const bufferedEvents = this.fileEventBuffers.get(projectId) || [];
    if (bufferedEvents.length > 0) {
      logger.info(
        { projectId, count: bufferedEvents.length },
        "Replaying buffered file events to new client",
      );

      // Replay in next tick to ensure client is ready
      setImmediate(() => {
        for (const event of bufferedEvents) {
          try {
            const eventData = `data: ${JSON.stringify(event)}\n\n`;
            res.write(eventData);
            logger.debug({ projectId, filePath: event.filePath }, "Replayed buffered file event");
          } catch (error) {
            logger.warn({ projectId }, "Failed to replay buffered event");
            break;
          }
        }
      });
    }

    // Keep-alive ping every 30 seconds
    const pingInterval = setInterval(() => {
      try {
        res.write(`: keepalive\n\n`);
      } catch {
        clearInterval(pingInterval);
      }
    }, 30000);

    // Return cleanup function
    return () => {
      clearInterval(pingInterval);
      unsubscribeInMemory(); // Clean up in-memory subscription
      const clients = this.fileStreamClients.get(projectId);
      if (clients) {
        clients.delete(client);
        if (clients.size === 0) {
          this.fileStreamClients.delete(projectId);
        }
      }
      logger.info({ projectId, userId }, "File stream client disconnected");
    };
  }

  /**
   * Add an SSE client to a channel
   * Returns cleanup function to call on disconnect
   */
  private async addClient(
    channel: string,
    res: Response,
    userId?: string,
  ): Promise<() => void> {
    // Set up SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering
    res.flushHeaders();

    // Send initial connection event
    res.write(
      `event: connected\ndata: ${JSON.stringify({ channel, timestamp: Date.now() })}\n\n`,
    );

    const client: SSEClient = {
      res,
      userId,
      connectedAt: Date.now(),
    };

    // Add to clients map
    if (!this.clients.has(channel)) {
      this.clients.set(channel, new Set());
    }
    this.clients.get(channel)!.add(client);

    // Subscribe to Redis channel if first client
    await this.subscribeToChannel(channel);

    const clientCount = this.clients.get(channel)?.size || 0;
    logger.info({ channel, userId, clientCount }, "SSE client connected");

    // Keep-alive ping every 30 seconds
    const pingInterval = setInterval(() => {
      try {
        res.write(`: ping\n\n`);
      } catch {
        clearInterval(pingInterval);
      }
    }, 30000);

    // Return cleanup function
    return () => {
      clearInterval(pingInterval);
      const clients = this.clients.get(channel);
      if (clients) {
        clients.delete(client);
        if (clients.size === 0) {
          this.clients.delete(channel);
          this.unsubscribeFromChannel(channel);
        }
      }
      logger.info({ channel, userId }, "SSE client disconnected");
    };
  }

  /**
   * Publish event to a project channel
   */
  async publishToProject<T>(
    projectId: string,
    eventType: SSEEventType,
    data: T,
    userId?: string,
  ): Promise<boolean> {
    const channel = `${CHANNEL_PREFIX.project}${projectId}`;
    return this.publish(channel, eventType, data, userId);
  }

  /**
   * Publish event to a workspace channel
   */
  async publishToWorkspace<T>(
    workspaceId: string,
    eventType: SSEEventType,
    data: T,
    userId?: string,
  ): Promise<boolean> {
    const channel = `${CHANNEL_PREFIX.workspace}${workspaceId}`;
    return this.publish(channel, eventType, data, userId);
  }

  /**
   * Publish event to a channel
   */
  private async publish<T>(
    channel: string,
    eventType: SSEEventType,
    data: T,
    userId?: string,
  ): Promise<boolean> {
    const event: SSEEvent<T> = {
      type: eventType,
      data,
      userId,
      timestamp: Date.now(),
    };

    const message = JSON.stringify(event);

    // If Redis is available, publish to Redis (for multi-instance)
    // Redis will handle delivery to all instances including this one
    if (this.redisPublisher && this.isInitialized) {
      try {
        await this.redisPublisher.publish(channel, message);
        logger.debug(
          { channel, eventType, userId },
          "Published event to Redis",
        );
        // Don't also deliver locally - Redis subscription will handle it
        return true;
      } catch (error) {
        logger.error(
          {
            channel,
            eventType,
            error: error instanceof Error ? error.message : String(error),
          },
          "Failed to publish to Redis, falling back to local",
        );
        // Fall through to local delivery only on Redis failure
      }
    }

    // Only deliver locally if Redis is not available or failed
    this.sendToClients(channel, event);

    return true;
  }

  /**
   * Get connection stats
   */
  getStats() {
    const stats: Record<string, number> = {};
    for (const [channel, clients] of this.clients) {
      stats[channel] = clients.size;
    }

    const fileStreamStats: Record<string, number> = {};
    for (const [projectId, clients] of this.fileStreamClients) {
      fileStreamStats[projectId] = clients.size;
    }

    return {
      totalChannels: this.clients.size,
      totalClients: Array.from(this.clients.values()).reduce(
        (sum, set) => sum + set.size,
        0,
      ),
      channels: stats,
      fileStreamClients: {
        totalProjects: this.fileStreamClients.size,
        totalClients: Array.from(this.fileStreamClients.values()).reduce(
          (sum, set) => sum + set.size,
          0,
        ),
        projects: fileStreamStats,
      },
      redisConnected: this.redisPublisher?.status === "ready",
      fileEventSubscriberConnected: this.fileEventSubscriber?.status === "ready",
    };
  }

  /**
   * Cleanup on shutdown
   */
  async cleanup() {
    logger.info("Cleaning up SSE pub/sub service");

    // Close all client connections
    for (const [channel, clients] of this.clients) {
      for (const client of clients) {
        try {
          client.res.end();
        } catch {
          // Ignore errors on cleanup
        }
      }
      clients.clear();
    }
    this.clients.clear();

    // Close file stream client connections
    for (const [projectId, clients] of this.fileStreamClients) {
      for (const client of clients) {
        try {
          client.res.end();
        } catch {
          // Ignore errors on cleanup
        }
      }
      clients.clear();
    }
    this.fileStreamClients.clear();
    this.fileEventBuffers.clear();

    // Close Redis connections
    if (this.redisPublisher) {
      await this.redisPublisher.quit();
    }
    if (this.redisSubscriber) {
      await this.redisSubscriber.quit();
    }
    if (this.fileEventSubscriber) {
      await this.fileEventSubscriber.quit();
    }
  }
}

// Export singleton instance
export const ssePubSub = SSEPubSubService.getInstance();

// Graceful shutdown
process.on("SIGTERM", async () => {
  await ssePubSub.cleanup();
});

// ============================================
// CONVENIENCE BROADCAST FUNCTIONS
// (Mirror the Ably API for easy switching)
// ============================================

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
  userMessage?: string;
}

export interface FileChangedData {
  path: string;
  content?: string;
  action: "create" | "update" | "delete";
}

export interface SandboxStatusData {
  status: "creating" | "ready" | "error" | "stopped";
  tunnelUrl?: string;
  error?: string;
}

// Chunk batching for efficiency (same as Ably implementation)
interface ChunkBatch {
  chunks: string[];
  isThinking: boolean;
  userId?: string;
  timeout: NodeJS.Timeout;
}

const chunkBatches = new Map<string, ChunkBatch>();
const BATCH_INTERVAL_MS = 100;

function flushSSEChunkBatch(key: string, projectId: string, messageId: string) {
  const batch = chunkBatches.get(key);
  if (!batch || batch.chunks.length === 0) {
    chunkBatches.delete(key);
    return;
  }

  const combinedChunk = batch.chunks.join("");

  ssePubSub.publishToProject<AIChunkData>(
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

export async function ssePublishAIChunk(
  projectId: string,
  messageId: string,
  chunk: string,
  isThinking = false,
  userId?: string,
) {
  const key = `sse:${projectId}:${messageId}:${isThinking}`;

  let batch = chunkBatches.get(key);

  if (!batch) {
    batch = {
      chunks: [],
      isThinking,
      userId,
      timeout: setTimeout(
        () => flushSSEChunkBatch(key, projectId, messageId),
        BATCH_INTERVAL_MS,
      ),
    };
    chunkBatches.set(key, batch);
  }

  batch.chunks.push(chunk);
  return true;
}

export function sseFlushPendingChunks(projectId: string, messageId: string) {
  for (const isThinking of [false, true]) {
    const key = `sse:${projectId}:${messageId}:${isThinking}`;
    const batch = chunkBatches.get(key);
    if (batch) {
      clearTimeout(batch.timeout);
      flushSSEChunkBatch(key, projectId, messageId);
    }
  }
}

export async function ssePublishAIToolCall(
  projectId: string,
  messageId: string,
  toolName: string,
  toolCallId: string,
  args?: Record<string, unknown>,
  userId?: string,
) {
  return ssePubSub.publishToProject<AIToolCallData>(
    projectId,
    "ai:tool-call",
    { messageId, toolName, toolCallId, args },
    userId,
  );
}

export async function ssePublishAIToolResult(
  projectId: string,
  messageId: string,
  toolCallId: string,
  result: unknown,
  userId?: string,
) {
  return ssePubSub.publishToProject<AIToolResultData>(
    projectId,
    "ai:tool-result",
    { messageId, toolCallId, result },
    userId,
  );
}

export async function ssePublishAIComplete(
  projectId: string,
  messageId: string,
  userId?: string,
) {
  sseFlushPendingChunks(projectId, messageId);
  return ssePubSub.publishToProject(
    projectId,
    "ai:complete",
    { messageId },
    userId,
  );
}

export async function ssePublishAIError(
  projectId: string,
  messageId: string,
  error: string,
  userId?: string,
) {
  return ssePubSub.publishToProject(
    projectId,
    "ai:error",
    { messageId, error },
    userId,
  );
}

export async function ssePublishStreamingStart(
  projectId: string,
  userId: string,
  userName?: string,
  messageId?: string,
  userMessage?: string,
) {
  return ssePubSub.publishToProject<ChatStreamingData>(
    projectId,
    "chat:streaming-start",
    { messageId, userId, userName, userMessage },
    userId,
  );
}

export async function ssePublishStreamingStop(
  projectId: string,
  userId: string,
  messageId?: string,
) {
  return ssePubSub.publishToProject<ChatStreamingData>(
    projectId,
    "chat:streaming-stop",
    { messageId, userId },
    userId,
  );
}

export async function ssePublishFileChanged(
  projectId: string,
  path: string,
  action: "create" | "update" | "delete",
  content?: string,
) {
  return ssePubSub.publishToProject<FileChangedData>(
    projectId,
    "sandbox:file-changed",
    {
      path,
      action,
      content: content?.length && content.length < 50000 ? content : undefined,
    },
  );
}

export async function ssePublishPreviewReload(projectId: string) {
  return ssePubSub.publishToProject(projectId, "sandbox:preview-reload", {});
}

export async function ssePublishSandboxStatus(
  projectId: string,
  status: SandboxStatusData["status"],
  tunnelUrl?: string,
  error?: string,
) {
  return ssePubSub.publishToProject<SandboxStatusData>(
    projectId,
    "sandbox:status",
    {
      status,
      tunnelUrl,
      error,
    },
  );
}

// ============================================
// ADVISOR BROADCAST FUNCTIONS
// ============================================

// Advisor chunk batching (same pattern as builder)
const advisorChunkBatches = new Map<string, ChunkBatch>();

function flushAdvisorChunkBatch(
  key: string,
  projectId: string,
  messageId: string,
) {
  const batch = advisorChunkBatches.get(key);
  if (!batch || batch.chunks.length === 0) {
    advisorChunkBatches.delete(key);
    return;
  }

  const combinedChunk = batch.chunks.join("");

  ssePubSub.publishToProject<AIChunkData>(
    projectId,
    batch.isThinking ? "advisor:thinking" : "advisor:chunk",
    {
      messageId,
      chunk: combinedChunk,
      isThinking: batch.isThinking,
    },
    batch.userId,
  );

  advisorChunkBatches.delete(key);
}

export async function ssePublishAdvisorChunk(
  projectId: string,
  messageId: string,
  chunk: string,
  isThinking = false,
  userId?: string,
) {
  const key = `sse:advisor:${projectId}:${messageId}:${isThinking}`;

  let batch = advisorChunkBatches.get(key);

  if (!batch) {
    batch = {
      chunks: [],
      isThinking,
      userId,
      timeout: setTimeout(
        () => flushAdvisorChunkBatch(key, projectId, messageId),
        BATCH_INTERVAL_MS,
      ),
    };
    advisorChunkBatches.set(key, batch);
  }

  batch.chunks.push(chunk);
  return true;
}

export function sseFlushPendingAdvisorChunks(
  projectId: string,
  messageId: string,
) {
  for (const isThinking of [false, true]) {
    const key = `sse:advisor:${projectId}:${messageId}:${isThinking}`;
    const batch = advisorChunkBatches.get(key);
    if (batch) {
      clearTimeout(batch.timeout);
      flushAdvisorChunkBatch(key, projectId, messageId);
    }
  }
}

export async function ssePublishAdvisorStreamingStart(
  projectId: string,
  userId: string,
  userName?: string,
  messageId?: string,
  userMessage?: string,
) {
  return ssePubSub.publishToProject<ChatStreamingData>(
    projectId,
    "advisor:streaming-start",
    { messageId, userId, userName, userMessage },
    userId,
  );
}

export async function ssePublishAdvisorStreamingStop(
  projectId: string,
  userId: string,
  messageId?: string,
) {
  return ssePubSub.publishToProject<ChatStreamingData>(
    projectId,
    "advisor:streaming-stop",
    { messageId, userId },
    userId,
  );
}

export async function ssePublishAdvisorComplete(
  projectId: string,
  messageId: string,
  userId?: string,
) {
  sseFlushPendingAdvisorChunks(projectId, messageId);
  return ssePubSub.publishToProject(
    projectId,
    "advisor:complete",
    { messageId },
    userId,
  );
}
