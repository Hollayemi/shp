/**
 * Billing Service
 *
 * Standalone service for Convex usage tracking, Stripe billing, and Shipper Cloud credits.
 *
 * Endpoints:
 *
 * Webhooks:
 * - POST /webhook/convex - Receive Convex log stream events
 * - GET /webhook/status - Webhook health check
 *
 * Teams:
 * - POST /teams/billing/enable - Enable billing for a team
 * - POST /teams/billing/disable - Disable billing for a team
 * - GET /teams/:teamId/usage - Get team usage summary
 * - GET /teams/:teamId/billing-status - Get team billing status
 * - POST /teams/:teamId/report-usage - Report usage to Stripe
 *
 * Users:
 * - POST /users/:userId/add-convex-metered-prices - Add Convex metered prices to user subscription
 * - POST /users/subscription/:subscriptionId/add-convex-metered-prices - Add metered prices by subscription ID
 * - POST /users/migrate-to-convex-metered-billing - Migrate all users to Convex metered billing
 *
 * Credits (Shipper Cloud):
 * - GET /credits/:userId/balance - Get user's credit balance
 * - POST /credits/:userId/sync - Sync credit balance from Stripe
 * - GET /credits/:userId/grants - List all credit grants
 * - POST /credits/:userId/grants - Create a credit grant
 * - POST /credits/:userId/promotional - Create promotional credits
 * - DELETE /credits/:userId/grants/:grantId - Void a credit grant
 *
 * Auto Top-Up:
 * - GET /credits/:userId/auto-top-up - Get auto top-up config
 * - POST /credits/:userId/auto-top-up - Configure auto top-up
 * - DELETE /credits/:userId/auto-top-up - Disable auto top-up
 * - POST /credits/:userId/auto-top-up/trigger - Manually trigger top-up check
 * - POST /credits/auto-top-up/check-all - Check all users (scheduled job)
 */

import dotenv from "dotenv";
dotenv.config();

import express, { Request, Response } from "express";
import cors from "cors";
import { prisma } from "@shipper/database";
import type { ApiResponse } from "@shipper/shared";
import { validateApiKey } from "./middleware/auth.js";
import { logger } from "./config/logger.js";
import { stripeConfig } from "./config/stripe.js";
import webhookRouter from "./routes/webhook.js";
import teamsRouter from "./routes/teams.js";
import usersRouter from "./routes/users.js";
import creditsRouter from "./routes/credits.js";
import {
  startMeterEventWorker,
  shutdownMeterEventQueue,
  getQueueStats,
  startScheduledJobsWorker,
  setupAutoTopUpCron,
  setupCreditsSyncCron,
  getScheduledJobsStats,
} from "./services/meter-event-queue.js";

const app = express();
const PORT = process.env.BILLING_PORT || process.env.PORT || 4004;

// CORS configuration
const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:4000",
  process.env.WEB_APP_URL,
  process.env.API_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      if (origin.endsWith(".vercel.app")) return callback(null, true);
      if (origin.endsWith(".shipper.app") || origin === "https://shipper.app") {
        return callback(null, true);
      }
      if (process.env.NODE_ENV === "development") return callback(null, true);
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-api-key",
      "x-webhook-signature",
    ],
  }),
);

app.use(express.json({ limit: "2mb" }));

// Health check endpoint (no auth required)
app.get("/health", async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const queueStats = await getQueueStats().catch(() => null);
    res.json({
      status: "ok",
      service: "billing",
      timestamp: new Date().toISOString(),
      database: "connected",
      stripe: stripeConfig.hasValidKey ? "configured" : "not configured",
      stripeMode: stripeConfig.isLive ? "live" : "test",
      meterQueue: queueStats || "not connected",
    });
  } catch (error) {
    res.status(503).json({
      status: "error",
      service: "billing",
      timestamp: new Date().toISOString(),
      database: "disconnected",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Queue stats endpoint (no auth required - useful for monitoring)
app.get("/queue/stats", async (_req: Request, res: Response) => {
  try {
    const [meterStats, scheduledStats] = await Promise.all([
      getQueueStats(),
      getScheduledJobsStats().catch(() => null),
    ]);
    res.json({
      success: true,
      data: {
        meterEvents: {
          ...meterStats,
          mode: stripeConfig.isLive ? "live" : "test",
          rateLimit: stripeConfig.isLive ? 1000 : 10,
        },
        scheduledJobs: scheduledStats,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to get queue stats",
    });
  }
});

// Webhook routes - use HMAC signature verification (registered before API key middleware)
app.use("/webhook", webhookRouter);

// API Key Authentication - only applies to routes registered after this
app.use(validateApiKey);

// Protected routes (require API key)
app.use("/teams", teamsRouter);
app.use("/users", usersRouter);
app.use("/credits", creditsRouter);

// 404 handler
app.use((_req: Request, res: Response) => {
  const response: ApiResponse = {
    success: false,
    error: "Not found",
  };
  res.status(404).json(response);
});

// Graceful shutdown
async function shutdown() {
  logger.info("Shutting down billing service...");
  await shutdownMeterEventQueue();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// Start server and workers
app.listen(PORT, async () => {
  // Start the meter event queue worker
  try {
    startMeterEventWorker();
    logger.info("Meter event queue worker started");
  } catch (error) {
    logger.warn(
      { error },
      "Failed to start meter event queue worker - events will be queued but not processed"
    );
  }

  // Start the scheduled jobs worker and set up cron jobs
  try {
    await startScheduledJobsWorker();
    await setupAutoTopUpCron();
    await setupCreditsSyncCron();
    logger.info("Scheduled jobs worker started with auto top-up and credits sync crons");
  } catch (error) {
    logger.warn(
      { error },
      "Failed to start scheduled jobs worker - cron jobs will not run automatically"
    );
  }

  logger.info({
    msg: "Billing service started",
    port: PORT,
    url: `http://localhost:${PORT}`,
    healthCheck: `http://localhost:${PORT}/health`,
    queueStats: `http://localhost:${PORT}/queue/stats`,
    webhookEndpoint: `http://localhost:${PORT}/webhook/convex`,
    database: "connected",
    stripe: stripeConfig.hasValidKey
      ? `configured (${stripeConfig.isLive ? "live" : "test"})`
      : "not configured",
    meterEventQueue: "enabled",
    scheduledJobs: `enabled (auto top-up every 5 min, credits sync every ${process.env.NODE_ENV === "production" ? "5 min" : "1 min"})`,
    rateLimit: stripeConfig.isLive ? "1000/sec (live)" : "10/sec (test)",
    environment: process.env.NODE_ENV || "development",
  });
});
