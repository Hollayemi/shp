import dotenv from "dotenv";

// Load environment variables
dotenv.config();

import express, { Request, Response } from "express";
import cors from "cors";
import { prisma } from "@shipper/database";
import { formatDate, type ApiResponse } from "@shipper/shared";
import daytonaRouter from "./routes/daytona.js";
import modalRouter from "./routes/modal.js";
import convexRouter from "./routes/convex.js";
import errorsRouter from "./routes/errors.js";
import chatRouter from "./routes/chat.js";
import uploadRouter from "./routes/upload.js";
import domainsRouter from "./routes/domains.js";
import domainsDnsRouter from "./routes/domains-dns.js";
import databaseRouter from "./routes/database.js";
import aiProxyRouter from "./routes/ai-proxy.js";
import shipperCloudAdminRouter from "./routes/shipper-cloud-admin.js";
import connectorsRouter from "./routes/connectors.js";
import { validateApiKey } from "./middleware/auth.js";
import { logger } from "./config/logger.js";
import { requestLogger } from "./middleware/request-logger.js";
import { projectContextMiddleware } from "./middleware/project-context.js";

const app = express();
const PORT = process.env.PORT || 4000;

// CORS configuration for web app access
const ALLOWED_ORIGINS = [
  "http://localhost:3000", // Development
  "http://localhost:3001", // Alternative development port
  process.env.WEB_APP_URL, // Production (e.g., https://shipper.app)
  process.env.NEXT_PUBLIC_APP_URL, // Alternative production URL
].filter(Boolean);

// Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      // Check exact matches
      if (ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }

      // Allow Vercel preview deployments (staging)
      if (origin.endsWith(".vercel.app")) {
        return callback(null, true);
      }

      // Allow Railway preview deployments
      if (origin.endsWith(".up.railway.app")) {
        return callback(null, true);
      }

      // Allow shipper domains (subdomains of shipper.app)
      if (origin.endsWith(".shipper.app") || origin === "https://shipper.app") {
        return callback(null, true);
      }

      // In development, be more permissive
      if (process.env.NODE_ENV === "development") {
        return callback(null, true);
      }

      callback(new Error("Not allowed by CORS"));
    },
    credentials: true, // Allow cookies to be sent
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-api-key",
      "x-chat-token",
    ],
  }),
);
app.use(express.json({ limit: "2mb" }));

// Request logging
app.use(requestLogger);

// Project context (adds req.logger with projectId)
app.use(projectContextMiddleware);

// API Key Authentication
// Note: Health check endpoint is excluded in the middleware
app.use(validateApiKey);

// Health check endpoint
app.get("/health", async (_req: Request, res: Response) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: "ok",
      timestamp: formatDate(new Date()),
      database: "connected",
    });
  } catch (error) {
    res.status(503).json({
      status: "error",
      timestamp: formatDate(new Date()),
      database: "disconnected",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// API routes
app.get("/api/hello", (_req: Request, res: Response) => {
  const response: ApiResponse<{ message: string }> = {
    success: true,
    data: { message: "Hello from the Shipper API!" },
  };
  res.json(response);
});

// Daytona routes
app.use("/api/v1/daytona", daytonaRouter);

// Modal routes
app.use("/api/v1/modal", modalRouter);

// Convex (Shipper Cloud) routes
app.use("/api/v1/convex", convexRouter);

// Error detection and auto-fix routes
app.use("/api/v1/daytona/errors", errorsRouter);

// Chat routes (with session authentication)
app.use("/api/v1/chat", chatRouter);

// Upload routes
app.use("/api/v1/upload", uploadRouter);

// Domain routes
app.use("/api/v1/domains", domainsRouter);
app.use("/api/v1/domains-dns", domainsDnsRouter);

// Database routes
app.use("/api/v1/database", databaseRouter);

// AI Proxy routes (uses its own token-based auth, not API key)
// This endpoint is called by user's deployed apps to access AI
app.use("/api/v1/ai", aiProxyRouter);

// Shipper Cloud admin routes (for admin dashboard)
app.use("/api/v1/shipper-cloud", shipperCloudAdminRouter);

// Connector routes (OAuth flows, connection management)
app.use("/api/v1/connectors", connectorsRouter);

// Example endpoint using shared types
app.get("/api/v1/projects", async (_req: Request, res: Response) => {
  try {
    // Example: fetch projects from database
    // const projects = await prisma.project.findMany();

    const response: ApiResponse = {
      success: true,
      data: {
        projects: [],
        message: "Projects endpoint - ready for implementation",
      },
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch projects",
    };
    res.status(500).json(response);
  }
});

// 404 handler
app.use((_req: Request, res: Response) => {
  const response: ApiResponse = {
    success: false,
    error: "Not found",
  };
  res.status(404).json(response);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM signal received: closing HTTP server");
  await prisma.$disconnect();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  logger.info({
    msg: "API server started successfully",
    port: PORT,
    url: `http://localhost:${PORT}`,
    healthCheck: `http://localhost:${PORT}/health`,
    database: "connected",
    environment: process.env.NODE_ENV || "development",
  });
});
