/**
 * Shared Redis Client for API Server
 * Provides a singleton Redis client for general-purpose operations
 */

import { Redis } from "ioredis";
import { logger as defaultLogger } from "../config/logger.js";

const logger = defaultLogger.child({ service: "redis-client" });

const REDIS_URL = process.env.REDIS_URL;

let redisClient: Redis | null = null;

/**
 * Get or create the shared Redis client
 * Returns null if REDIS_URL is not configured
 */
export function getRedisClient(): Redis | null {
  if (redisClient) {
    return redisClient;
  }

  if (!REDIS_URL) {
    logger.warn("REDIS_URL not configured - Redis operations will be disabled");
    return null;
  }

  try {
    redisClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) {
          logger.error("Max Redis retries reached, giving up");
          return null;
        }
        return Math.min(times * 50, 2000);
      },
      lazyConnect: false,
      enableOfflineQueue: true,
    });

    redisClient.on("connect", () => {
      logger.info("Redis client connected");
    });

    redisClient.on("error", (error) => {
      logger.error({ error: error.message }, "Redis client error");
    });

    redisClient.on("close", () => {
      logger.warn("Redis client connection closed");
    });

    return redisClient;
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Failed to create Redis client"
    );
    return null;
  }
}

/**
 * Close the Redis client connection
 * Should be called on application shutdown
 */
export async function closeRedisClient(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info("Redis client closed");
  }
}
