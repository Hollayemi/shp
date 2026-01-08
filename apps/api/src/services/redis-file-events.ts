/**
 * Redis-based File Stream Events for API Server
 *
 * Publishes file creation/update events to Redis for cross-process communication.
 * The webapp SSE endpoint subscribes to these events and forwards them to frontend clients.
 *
 * Falls back to in-memory pub/sub when Redis is not configured (single-instance mode).
 */

import { Redis } from "ioredis";
import { logger as defaultLogger } from "../config/logger.js";

export type FileCreationEvent = {
  projectId: string;
  filePath: string;
  content: string;
  timestamp: number;
  action: "created" | "updated" | "stream-complete";
};

const REDIS_CHANNEL_PREFIX = "file-events:";

// In-memory event listeners for when Redis is not available
type FileEventListener = (event: FileCreationEvent) => void;
const inMemoryListeners = new Map<string, Set<FileEventListener>>();

/**
 * Subscribe to file events for a project (in-memory fallback)
 */
export function subscribeToFileEvents(
  projectId: string,
  listener: FileEventListener,
): () => void {
  if (!inMemoryListeners.has(projectId)) {
    inMemoryListeners.set(projectId, new Set());
  }
  inMemoryListeners.get(projectId)!.add(listener);

  defaultLogger.debug({
    msg: "Added in-memory file event listener",
    service: "redis-file-events",
    projectId,
    listenerCount: inMemoryListeners.get(projectId)!.size,
  });

  // Return unsubscribe function
  return () => {
    const listeners = inMemoryListeners.get(projectId);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        inMemoryListeners.delete(projectId);
      }
    }
  };
}

class RedisFileStreamPublisher {
  private static instance: RedisFileStreamPublisher;
  private redisPublisher: Redis | null = null;
  private isInitialized = false;
  private publishQueue: Array<{ channel: string; message: string }> = [];
  private isProcessingQueue = false;

  private constructor() {
    this.initialize();
  }

  static getInstance(): RedisFileStreamPublisher {
    if (!RedisFileStreamPublisher.instance) {
      RedisFileStreamPublisher.instance = new RedisFileStreamPublisher();
    }
    return RedisFileStreamPublisher.instance;
  }

  private initialize() {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      defaultLogger.warn({
        msg: "REDIS_URL not configured - file streaming disabled",
        service: "redis-file-events",
      });
      this.isInitialized = true;
      return;
    }

    try {
      this.redisPublisher = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        retryStrategy: (times: number) => Math.min(times * 50, 2000),
        lazyConnect: false,
        enableOfflineQueue: true,
        enableAutoPipelining: true,
      });

      this.redisPublisher.on("connect", () => {
        defaultLogger.info({
          msg: "Redis publisher connected for file streaming",
          service: "redis-file-events",
        });
        this.isInitialized = true;
        // Process any queued messages
        this.processQueue();
      });

      this.redisPublisher.on("error", (error: Error) => {
        defaultLogger.error({
          msg: "Redis publisher error",
          service: "redis-file-events",
          error: error.message,
        });
      });

      defaultLogger.info({
        msg: "Initializing Redis file stream publisher",
        service: "redis-file-events",
      });
    } catch (error) {
      defaultLogger.error({
        msg: "Failed to initialize Redis publisher",
        service: "redis-file-events",
        error: error instanceof Error ? error.message : String(error),
      });
      this.isInitialized = true; // Continue without Redis
    }
  }

  private async processQueue() {
    if (this.isProcessingQueue || this.publishQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.publishQueue.length > 0) {
      const item = this.publishQueue.shift();
      if (item && this.redisPublisher && this.isInitialized) {
        try {
          await this.redisPublisher.publish(item.channel, item.message);
        } catch (error) {
          defaultLogger.error({
            msg: "Failed to publish queued message",
            service: "redis-file-events",
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Emit a file creation/update event to Redis.
   * Events are queued if Redis is not yet connected.
   */
  async emitFileCreation(event: FileCreationEvent): Promise<void> {
    const channel = `${REDIS_CHANNEL_PREFIX}${event.projectId}`;
    const message = JSON.stringify(event);

    defaultLogger.debug({
      msg: "Emitting file creation event",
      service: "redis-file-events",
      channel,
      filePath: event.filePath,
      action: event.action,
    });

    // Fallback to in-memory pub/sub when Redis is not available
    if (!this.redisPublisher) {
      defaultLogger.info({
        msg: "Redis not available - using in-memory pub/sub",
        service: "redis-file-events",
        filePath: event.filePath,
        projectId: event.projectId,
      });

      // Notify in-memory listeners directly
      const listeners = inMemoryListeners.get(event.projectId);
      if (listeners && listeners.size > 0) {
        for (const listener of listeners) {
          try {
            listener(event);
          } catch (err) {
            defaultLogger.error({
              msg: "Error in in-memory file event listener",
              service: "redis-file-events",
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
        defaultLogger.debug({
          msg: "Delivered file event to in-memory listeners",
          service: "redis-file-events",
          listenerCount: listeners.size,
        });
      } else {
        defaultLogger.debug({
          msg: "No in-memory listeners for project",
          service: "redis-file-events",
          projectId: event.projectId,
        });
      }
      return;
    }

    if (!this.isInitialized) {
      // Queue the message until Redis is ready
      this.publishQueue.push({ channel, message });
      defaultLogger.debug({
        msg: "Redis not ready - queued file event",
        service: "redis-file-events",
        queueSize: this.publishQueue.length,
      });
      return;
    }

    try {
      await this.redisPublisher.publish(channel, message);
      defaultLogger.debug({
        msg: "Published file event to Redis",
        service: "redis-file-events",
        channel,
      });
    } catch (error) {
      defaultLogger.error({
        msg: "Failed to publish file event to Redis",
        service: "redis-file-events",
        error: error instanceof Error ? error.message : String(error),
        channel,
      });
    }
  }

  /**
   * Signal that file streaming is complete for a project.
   * This allows the frontend to clear loading states.
   */
  async emitStreamComplete(projectId: string): Promise<void> {
    await this.emitFileCreation({
      projectId,
      filePath: "",
      content: "",
      timestamp: Date.now(),
      action: "stream-complete",
    });

    defaultLogger.info({
      msg: "Emitted stream complete signal",
      service: "redis-file-events",
      projectId,
    });
  }

  /**
   * Clean up Redis connection
   */
  async cleanup(): Promise<void> {
    defaultLogger.info({
      msg: "Cleaning up Redis file stream publisher",
      service: "redis-file-events",
    });

    if (this.redisPublisher) {
      await this.redisPublisher.quit();
    }
  }
}

export const redisFileStreamPublisher = RedisFileStreamPublisher.getInstance();

// Graceful shutdown
process.on("SIGTERM", async () => {
  await redisFileStreamPublisher.cleanup();
});
