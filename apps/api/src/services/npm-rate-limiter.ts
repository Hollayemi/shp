/**
 * NPM Package Installation Rate Limiter
 * Prevents abuse by limiting install frequency per user/project
 */

import { getRedisClient } from "./redis-client.js";
import { logger as defaultLogger } from "../config/logger.js";
import {
  RATE_LIMIT_PER_USER_HOURLY,
  RATE_LIMIT_PER_PROJECT_HOURLY,
} from "@shipper/shared";

const logger = defaultLogger.child({ service: "npm-rate-limiter" });

const RATE_LIMIT_WINDOW = 3600; // 1 hour in seconds

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  limit: number;
  limitType?: "user" | "project";
}

/**
 * Check if user/project has exceeded rate limits
 *
 * @param userId - User ID
 * @param projectId - Project ID
 * @returns Rate limit result with allowed flag and remaining count
 *
 * @example
 * ```typescript
 * const rateLimitResult = await checkRateLimit(userId, projectId);
 * if (!rateLimitResult.allowed) {
 *   throw new Error(`Rate limit exceeded. Try again in ${resetMinutes} minutes.`);
 * }
 * ```
 */
export async function checkRateLimit(
  userId: string,
  projectId: string
): Promise<RateLimitResult> {
  const redis = getRedisClient();

  // If Redis is not available, fail open (allow the request)
  if (!redis) {
    logger.warn("Redis not available, skipping rate limit check");
    return {
      allowed: true,
      remaining: RATE_LIMIT_PER_USER_HOURLY,
      resetAt: new Date(Date.now() + RATE_LIMIT_WINDOW * 1000),
      limit: RATE_LIMIT_PER_USER_HOURLY,
    };
  }

  const userKey = `npm-install:user:${userId}`;
  const projectKey = `npm-install:project:${projectId}`;

  try {
    // Check user limit
    const userCount = await redis.get(userKey);
    const userCountNum = userCount ? parseInt(userCount, 10) : 0;

    if (userCountNum >= RATE_LIMIT_PER_USER_HOURLY) {
      const ttl = await redis.ttl(userKey);
      logger.info(
        {
          userId,
          currentCount: userCountNum,
          limit: RATE_LIMIT_PER_USER_HOURLY,
          resetIn: ttl,
        },
        "User rate limit exceeded"
      );

      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(Date.now() + ttl * 1000),
        limit: RATE_LIMIT_PER_USER_HOURLY,
        limitType: "user",
      };
    }

    // Check project limit
    const projectCount = await redis.get(projectKey);
    const projectCountNum = projectCount ? parseInt(projectCount, 10) : 0;

    if (projectCountNum >= RATE_LIMIT_PER_PROJECT_HOURLY) {
      const ttl = await redis.ttl(projectKey);
      logger.info(
        {
          projectId,
          currentCount: projectCountNum,
          limit: RATE_LIMIT_PER_PROJECT_HOURLY,
          resetIn: ttl,
        },
        "Project rate limit exceeded"
      );

      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(Date.now() + ttl * 1000),
        limit: RATE_LIMIT_PER_PROJECT_HOURLY,
        limitType: "project",
      };
    }

    // Calculate remaining as minimum of user and project limits
    const remaining = Math.min(
      RATE_LIMIT_PER_USER_HOURLY - userCountNum,
      RATE_LIMIT_PER_PROJECT_HOURLY - projectCountNum
    );

    return {
      allowed: true,
      remaining,
      resetAt: new Date(Date.now() + RATE_LIMIT_WINDOW * 1000),
      limit: RATE_LIMIT_PER_USER_HOURLY,
    };
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        userId,
        projectId,
      },
      "Rate limit check failed"
    );

    // Fail open - allow on Redis errors
    return {
      allowed: true,
      remaining: RATE_LIMIT_PER_USER_HOURLY,
      resetAt: new Date(Date.now() + RATE_LIMIT_WINDOW * 1000),
      limit: RATE_LIMIT_PER_USER_HOURLY,
    };
  }
}

/**
 * Increment rate limit counters after successful installation
 *
 * @param userId - User ID
 * @param projectId - Project ID
 *
 * @example
 * ```typescript
 * // After successful package installation
 * await incrementRateLimit(userId, projectId);
 * ```
 */
export async function incrementRateLimit(
  userId: string,
  projectId: string
): Promise<void> {
  const redis = getRedisClient();

  // If Redis is not available, skip increment
  if (!redis) {
    logger.warn("Redis not available, skipping rate limit increment");
    return;
  }

  const userKey = `npm-install:user:${userId}`;
  const projectKey = `npm-install:project:${projectId}`;

  try {
    // Increment user counter
    const userCount = await redis.incr(userKey);
    if (userCount === 1) {
      // Set expiration on first increment
      await redis.expire(userKey, RATE_LIMIT_WINDOW);
    }

    // Increment project counter
    const projectCount = await redis.incr(projectKey);
    if (projectCount === 1) {
      // Set expiration on first increment
      await redis.expire(projectKey, RATE_LIMIT_WINDOW);
    }

    logger.debug(
      {
        userId,
        projectId,
        userCount,
        projectCount,
      },
      "Rate limit counters incremented"
    );
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        userId,
        projectId,
      },
      "Rate limit increment failed"
    );
    // Non-fatal - continue even if increment fails
  }
}

/**
 * Reset rate limits for a user (admin function)
 *
 * @param userId - User ID to reset
 */
export async function resetUserRateLimit(userId: string): Promise<void> {
  const redis = getRedisClient();

  if (!redis) {
    logger.warn("Redis not available, cannot reset rate limit");
    return;
  }

  const userKey = `npm-install:user:${userId}`;

  try {
    await redis.del(userKey);
    logger.info({ userId }, "User rate limit reset");
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        userId,
      },
      "Failed to reset user rate limit"
    );
  }
}

/**
 * Reset rate limits for a project (admin function)
 *
 * @param projectId - Project ID to reset
 */
export async function resetProjectRateLimit(projectId: string): Promise<void> {
  const redis = getRedisClient();

  if (!redis) {
    logger.warn("Redis not available, cannot reset rate limit");
    return;
  }

  const projectKey = `npm-install:project:${projectId}`;

  try {
    await redis.del(projectKey);
    logger.info({ projectId }, "Project rate limit reset");
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        projectId,
      },
      "Failed to reset project rate limit"
    );
  }
}
