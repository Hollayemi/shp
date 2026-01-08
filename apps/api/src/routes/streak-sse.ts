/**
 * SSE (Server-Sent Events) Route for Streak Events
 *
 * Provides real-time streak event streaming endpoint.
 * Clients connect via EventSource and receive streak updates (streak_updated,
 * streak_lost, reminder_created) in real-time.
 */

import { Router, Request, Response } from "express";
import { streakEventsEmitter, type StreakEvent } from "../services/streak-redis.js";
import { logger as defaultLogger } from "../config/logger.js";
import { validateSession } from "../middleware/session-auth.js";

const router: Router = Router();
const logger = defaultLogger.child({ service: "streak-sse" });

/**
 * SSE endpoint for streak events
 * GET /api/sse/streak
 *
 * Clients connect with EventSource and receive real-time streak events.
 * Requires session authentication (via query param token or cookies).
 */
router.get("/", validateSession, async (req: Request, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    logger.warn("SSE connection attempted without user ID");
    return res.status(401).json({ error: "Unauthorized" });
  }

  logger.info({ userId }, "SSE connection requested for streak events");

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  // CORS headers
  const origin = req.headers.origin;
  const allowedOrigins = [
    process.env.WEB_APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    "http://localhost:3000",
    "http://localhost:3001",
  ].filter(Boolean);

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }

  // Send initial connection confirmation
  try {
    const connectEvent = JSON.stringify({ type: "connected", userId });
    res.write(`data: ${connectEvent}\n\n`);
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Error sending connect event",
    );
  }

  let isClosed = false;

  const sendEvent = (event: StreakEvent) => {
    if (isClosed) return;

    try {
      const data = JSON.stringify(event);
      const message = `data: ${data}\n\n`;
      res.write(message);
      logger.debug({ userId, eventType: event.type }, "Sent event to user");
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "Error sending event",
      );
    }
  };

  // Subscribe to streak events for this user
  const unsubscribe = streakEventsEmitter.onStreakEvent(userId, sendEvent);

  // Keep-alive heartbeat every 30 seconds
  const keepAlive = setInterval(() => {
    if (isClosed) {
      clearInterval(keepAlive);
      return;
    }
    try {
      res.write(": keepalive\n\n");
    } catch (error) {
      clearInterval(keepAlive);
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "Error sending keepalive",
      );
    }
  }, 30000);

  // Handle client disconnect
  req.on("close", () => {
    logger.info({ userId }, "SSE connection closed");
    isClosed = true;
    clearInterval(keepAlive);
    unsubscribe();
    res.end();
  });

  req.on("error", (error) => {
    logger.error(
      { userId, error: error.message },
      "SSE connection error",
    );
    isClosed = true;
    clearInterval(keepAlive);
    unsubscribe();
    res.end();
  });
});

export default router;

