/**
 * Redis-based File Stream Events
 *
 * Enables cross-process file event broadcasting for live preview functionality.
 * Uses Redis Pub/Sub to allow the API server to emit file events that the webapp
 * SSE endpoint can forward to frontend clients.
 */

import { EventEmitter } from "events";
import Redis from "ioredis";

export type FileCreationEvent = {
  projectId: string;
  filePath: string;
  content: string;
  timestamp: number;
  action: "created" | "updated" | "stream-complete";
};

const REDIS_CHANNEL_PREFIX = "file-events:";

class RedisFileStreamEmitter extends EventEmitter {
  private static instance: RedisFileStreamEmitter;
  private redisPublisher: Redis | null = null;
  private redisSubscriber: Redis | null = null;
  private localBuffer: Map<string, FileCreationEvent[]> = new Map();
  private readonly BUFFER_SIZE = 50;
  private readonly BUFFER_TTL_MS = 60000; // 1 minute
  private isInitialized = false;

  private constructor() {
    super();
    this.setMaxListeners(100);
    this.initialize();
    this.startCleanupInterval();
  }

  static getInstance(): RedisFileStreamEmitter {
    if (!RedisFileStreamEmitter.instance) {
      RedisFileStreamEmitter.instance = new RedisFileStreamEmitter();
    }
    return RedisFileStreamEmitter.instance;
  }

  private initialize() {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      console.warn("[RedisFileStreamEmitter] REDIS_URL not configured - falling back to local-only mode");
      this.isInitialized = true;
      return;
    }

    try {
      // Create publisher for emitting events
      this.redisPublisher = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        retryStrategy: (times) => Math.min(times * 50, 2000),
        lazyConnect: false,
        enableOfflineQueue: true,
      });

      // Create subscriber for receiving events
      this.redisSubscriber = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        retryStrategy: (times) => Math.min(times * 50, 2000),
        lazyConnect: false,
        enableOfflineQueue: true,
      });

      this.redisPublisher.on("connect", () => {
        console.log("[RedisFileStreamEmitter] Publisher connected");
      });

      this.redisPublisher.on("error", (error) => {
        console.error("[RedisFileStreamEmitter] Publisher error:", error);
      });

      this.redisSubscriber.on("connect", () => {
        console.log("[RedisFileStreamEmitter] Subscriber connected");
      });

      this.redisSubscriber.on("error", (error) => {
        console.error("[RedisFileStreamEmitter] Subscriber error:", error);
      });

      // Subscribe to pattern for all project channels
      this.redisSubscriber.psubscribe(`${REDIS_CHANNEL_PREFIX}*`, (err) => {
        if (err) {
          console.error("[RedisFileStreamEmitter] Failed to subscribe:", err);
        } else {
          console.log("[RedisFileStreamEmitter] Subscribed to file event channels");
        }
      });

      // Handle incoming Redis messages
      this.redisSubscriber.on("pmessage", (_pattern, channel, message) => {
        try {
          const event: FileCreationEvent = JSON.parse(message);
          const projectId = channel.replace(REDIS_CHANNEL_PREFIX, "");

          console.log(`[RedisFileStreamEmitter] Received Redis event for ${projectId}:`, {
            filePath: event.filePath,
            action: event.action,
          });

          // Buffer the event
          this.bufferEvent(projectId, event);

          // Emit locally for SSE subscribers
          const eventName = `file:${projectId}`;
          this.emit(eventName, event);
        } catch (error) {
          console.error("[RedisFileStreamEmitter] Error processing Redis message:", error);
        }
      });

      this.isInitialized = true;
      console.log("[RedisFileStreamEmitter] Initialized with Redis Pub/Sub");
    } catch (error) {
      console.error("[RedisFileStreamEmitter] Failed to initialize Redis:", error);
      this.isInitialized = true; // Continue in local-only mode
    }
  }

  private startCleanupInterval() {
    setInterval(() => {
      const now = Date.now();
      for (const [projectId, events] of this.localBuffer.entries()) {
        const validEvents = events.filter(
          (event) => now - event.timestamp < this.BUFFER_TTL_MS,
        );
        if (validEvents.length === 0) {
          this.localBuffer.delete(projectId);
        } else if (validEvents.length !== events.length) {
          this.localBuffer.set(projectId, validEvents);
        }
      }
    }, 30000);
  }

  private bufferEvent(projectId: string, event: FileCreationEvent) {
    if (!this.localBuffer.has(projectId)) {
      this.localBuffer.set(projectId, []);
    }

    const buffer = this.localBuffer.get(projectId)!;
    buffer.push(event);

    if (buffer.length > this.BUFFER_SIZE) {
      buffer.shift();
    }
  }

  /**
   * Emit a file creation/update event.
   * Publishes to Redis if available, otherwise emits locally only.
   */
  async emitFileCreation(event: FileCreationEvent): Promise<void> {
    const channel = `${REDIS_CHANNEL_PREFIX}${event.projectId}`;

    console.log(`[RedisFileStreamEmitter] Emitting to channel ${channel}:`, {
      filePath: event.filePath,
      action: event.action,
    });

    // Buffer locally
    this.bufferEvent(event.projectId, event);

    if (this.redisPublisher && this.isInitialized) {
      try {
        // Publish to Redis for cross-process communication
        await this.redisPublisher.publish(channel, JSON.stringify(event));
        console.log(`[RedisFileStreamEmitter] Published to Redis: ${channel}`);
      } catch (error) {
        console.error("[RedisFileStreamEmitter] Failed to publish to Redis:", error);
        // Fall back to local emission
        const eventName = `file:${event.projectId}`;
        this.emit(eventName, event);
      }
    } else {
      // Local-only mode - emit directly
      const eventName = `file:${event.projectId}`;
      this.emit(eventName, event);
      console.log(`[RedisFileStreamEmitter] Emitted locally (no Redis): ${eventName}`);
    }
  }

  /**
   * Subscribe to file events for a specific project.
   * Returns buffered events immediately and listens for new events.
   */
  onFileCreation(
    projectId: string,
    handler: (event: FileCreationEvent) => void,
  ): () => void {
    const eventName = `file:${projectId}`;

    // Replay buffered events
    const bufferedEvents = this.localBuffer.get(projectId) || [];
    console.log(
      `[RedisFileStreamEmitter] New listener for ${projectId}, replaying ${bufferedEvents.length} buffered events`,
    );

    setImmediate(() => {
      bufferedEvents.forEach((event) => {
        console.log(
          `[RedisFileStreamEmitter] Replaying buffered event: ${event.filePath}`,
        );
        handler(event);
      });
    });

    // Subscribe to new events
    this.on(eventName, handler);

    return () => {
      this.off(eventName, handler);
    };
  }

  /**
   * Clean up Redis connections
   */
  async cleanup(): Promise<void> {
    console.log("[RedisFileStreamEmitter] Cleaning up Redis connections");

    if (this.redisSubscriber) {
      await this.redisSubscriber.quit();
    }

    if (this.redisPublisher) {
      await this.redisPublisher.quit();
    }
  }
}

export const redisFileStreamEmitter = RedisFileStreamEmitter.getInstance();

// Graceful shutdown
if (typeof process !== "undefined") {
  process.on("SIGTERM", async () => {
    await redisFileStreamEmitter.cleanup();
  });
}
