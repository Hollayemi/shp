/**
 * Redis-based Streak Events Subscriber for API Server
 *
 * Subscribes to Redis Pub/Sub streak events and re-emits them locally
 * for SSE endpoints to forward to connected clients.
 */

import { EventEmitter } from "events";
import { Redis } from "ioredis";
import { logger as defaultLogger } from "../config/logger.js";

const logger = defaultLogger.child({ service: "streak-redis" });

const REDIS_URL = process.env.REDIS_URL;
const STREAK_EVENTS_CHANNEL_PREFIX = "streak-events:user:";

export type StreakEvent =
  | { type: "streak_updated"; data: any }
  | { type: "streak_lost"; previousStreak: number; bestStreak: number }
  | { type: "reminder_created"; currentStreak: number; daysUntilLoss: number };

/**
 * Singleton emitter that listens to Redis Pub/Sub streak events and re-emits
 * them locally for SSE endpoints to forward to connected clients.
 */
class StreakEventsEmitter extends EventEmitter {
  private static instance: StreakEventsEmitter;
  private redisSubscriber: Redis | null = null;
  private isInitialized = false;
  private subscribedUsers = new Set<string>();

  private constructor() {
    super();
    this.setMaxListeners(1000); // Support many concurrent users
  }

  static getInstance(): StreakEventsEmitter {
    if (!StreakEventsEmitter.instance) {
      StreakEventsEmitter.instance = new StreakEventsEmitter();
    }
    return StreakEventsEmitter.instance;
  }

  private ensureInitialized() {
    if (this.isInitialized) return;

    if (!REDIS_URL) {
      logger.warn(
        "REDIS_URL not configured - SSE will not receive streak events",
      );
      this.isInitialized = true;
      return;
    }

    try {
      this.redisSubscriber = new Redis(REDIS_URL, {
        maxRetriesPerRequest: null,
        retryStrategy: (times) => Math.min(times * 50, 2000),
        lazyConnect: false,
        enableOfflineQueue: true,
      });

      this.redisSubscriber.on("connect", () => {
        logger.info("Subscriber connected to Redis");
      });

      this.redisSubscriber.on("error", (error) => {
        logger.error({ error: error.message }, "Subscriber error");
      });

      // Handle incoming Redis messages
      this.redisSubscriber.on("pmessage", (_pattern, channel, message) => {
        try {
          const event: StreakEvent = JSON.parse(message);
          const userId = channel.replace(STREAK_EVENTS_CHANNEL_PREFIX, "");

          logger.debug(
            { userId, eventType: event.type },
            "Received streak event from Redis",
          );

          // Emit locally for SSE subscribers
          const eventName = `streak:${userId}`;
          this.emit(eventName, event);
        } catch (error) {
          logger.error(
            { error: error instanceof Error ? error.message : String(error) },
            "Error processing Redis message",
          );
        }
      });

      // Subscribe to all streak event channels
      this.redisSubscriber.psubscribe(
        `${STREAK_EVENTS_CHANNEL_PREFIX}*`,
        (err) => {
          if (err) {
            logger.error({ error: err.message }, "Failed to subscribe");
          } else {
            logger.info("Subscribed to streak event channels");
          }
        },
      );

      this.isInitialized = true;
      logger.info("Initialized with Redis Pub/Sub");
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "Failed to initialize Redis",
      );
      this.isInitialized = true; // Mark as initialized to prevent retry loops
    }
  }

  /**
   * Subscribe to streak events for a specific user.
   * Returns an unsubscribe function.
   */
  onStreakEvent(
    userId: string,
    handler: (event: StreakEvent) => void,
  ): () => void {
    this.ensureInitialized();

    const eventName = `streak:${userId}`;
    this.subscribedUsers.add(userId);

    logger.debug({ userId }, "New listener for user");

    this.on(eventName, handler);

    return () => {
      this.off(eventName, handler);
      // Check if there are still listeners for this user
      if (this.listenerCount(eventName) === 0) {
        this.subscribedUsers.delete(userId);
      }
    };
  }

  /**
   * Clean up Redis connections
   */
  async cleanup(): Promise<void> {
    logger.info("Cleaning up Redis connections");
    if (this.redisSubscriber) {
      await this.redisSubscriber.quit();
      this.redisSubscriber = null;
    }
    this.isInitialized = false;
  }
}

export const streakEventsEmitter = StreakEventsEmitter.getInstance();

// Graceful shutdown
process.on("SIGTERM", async () => {
  await streakEventsEmitter.cleanup();
});

