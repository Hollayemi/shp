/**
 * AI Proxy Route
 *
 * This endpoint proxies AI requests from user-deployed apps through our API.
 * It uses our OpenRouter API key (never exposed to users) and charges Cloud credits.
 *
 * Security:
 * - Users authenticate with a project-specific token (not an API key)
 * - Our OpenRouter key is only used server-side
 * - All usage is tracked and charged to the project owner's Cloud credits
 *
 * Billing Flow:
 * 1. User's deployed app calls POST /api/v1/ai/chat with X-Shipper-Token header
 * 2. We validate the token and look up the project/user
 * 3. Check if user has sufficient Cloud credits (via Stripe Credit Balance)
 * 4. Forward request to OpenRouter using OUR key
 * 5. Extract cost from OpenRouter response
 * 6. Report usage to Stripe meter (shipper_cloud_credits) via billing service
 * 7. Return response to user's app
 *
 * This integrates AI usage with the same billing system as Convex usage,
 * so users see one unified credit balance for all Cloud features.
 */

import {
  Router,
  Request,
  Response,
  type Router as ExpressRouter,
} from "express";
import { prisma } from "@shipper/database";
import { logger } from "../config/logger.js";

// Billing service configuration
const BILLING_SERVICE_URL =
  process.env.BILLING_SERVICE_URL ||
  process.env.BILLING_WEBHOOK_URL?.replace("/webhook/convex", "");
const BILLING_API_KEY =
  process.env.BILLING_API_KEY || process.env.SHIPPER_API_KEY;

// Shipper Cloud Credits meter name (must match Stripe configuration)
const SHIPPER_CLOUD_CREDITS_METER = "shipper_cloud_credits";

/**
 * AI usage markup (100% margin, same as Builder credits)
 * Pass-through cost × 2 = 2x multiplier
 */
const AI_USAGE_MARKUP = 2.0;

/**
 * Convert USD cost to Cloud credits with markup
 * 1 credit = 1 cent ($0.01)
 * So $1 = 100 credits
 *
 * We apply a 2x markup on AI costs (100% margin, same as Builder)
 * Minimum 1 credit per operation
 */
function usdToCloudCredits(usdCost: number): number {
  // Apply 2x markup (100% margin)
  const costWithMarkup = usdCost * AI_USAGE_MARKUP;
  // Convert USD to cents (1 credit = 1 cent)
  // $1 = 100 cents = 100 credits
  const credits = costWithMarkup * 100;
  // Minimum 1 credit per operation
  return Math.max(1, Math.round(credits * 10000) / 10000);
}

const router: ExpressRouter = Router();

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

/**
 * Validate project token and return project + user info
 */
async function validateProjectToken(token: string) {
  logger.info({
    msg: "Validating AI proxy token",
    tokenPrefix: token?.substring(0, 20),
  });

  if (!token || !token.startsWith("shipper_ai_")) {
    logger.warn({
      msg: "Invalid token format",
      hasToken: !!token,
      prefix: token?.substring(0, 15),
    });
    return null;
  }

  const project = await prisma.project.findFirst({
    where: {
      aiProxyToken: token,
      aiEnabled: true,
    },
    select: {
      id: true,
      name: true,
      userId: true,
      teamId: true,
      team: {
        select: {
          members: {
            where: { role: "OWNER" },
            select: { userId: true },
            take: 1,
          },
        },
      },
    },
  });

  if (!project) {
    logger.warn({
      msg: "No project found for token",
      tokenPrefix: token.substring(0, 20),
    });
    // Check if token exists but aiEnabled is false
    const disabledProject = await prisma.project.findFirst({
      where: { aiProxyToken: token },
      select: { id: true, aiEnabled: true },
    });
    if (disabledProject) {
      logger.warn({
        msg: "Project found but AI disabled",
        projectId: disabledProject.id,
        aiEnabled: disabledProject.aiEnabled,
      });
    }
    return null;
  }

  logger.info({
    msg: "Project found",
    projectId: project.id,
    hasUserId: !!project.userId,
    hasTeam: !!project.team,
  });

  // Get the user ID (either direct owner or team owner)
  const teamOwnerId = project.team?.members?.[0]?.userId;
  const userId = project.userId || teamOwnerId;
  if (!userId) {
    logger.warn({ msg: "No userId found", projectId: project.id, teamOwnerId });
    return null;
  }

  // 🏢 WORKSPACE-CENTRIC: Include teamId for credit operations
  if (!project.teamId) {
    logger.warn({ msg: "No teamId found", projectId: project.id });
    return null;
  }

  return {
    projectId: project.id,
    projectName: project.name,
    userId,
    teamId: project.teamId,
  };
}

/**
 * Extract cost from OpenRouter response headers or body
 */
function extractCost(headers: Headers, body: any): number {
  // Try to get cost from headers first (OpenRouter sometimes includes this)
  const costHeader = headers.get("x-openrouter-cost");
  if (costHeader) {
    return parseFloat(costHeader);
  }

  // For non-streaming responses, cost might be in the body
  if (body?.usage?.cost) {
    return body.usage.cost;
  }

  // Estimate based on tokens if no cost provided
  // This is a fallback - OpenRouter usually provides cost
  if (body?.usage?.total_tokens) {
    // Rough estimate: $0.001 per 1K tokens (very conservative)
    return (body.usage.total_tokens / 1000) * 0.001;
  }

  return 0;
}

/**
 * Check if workspace has sufficient Cloud credits
 * Uses local database as the source of truth for balance
 * 🏢 WORKSPACE-CENTRIC: Check workspace's cloud credit balance
 */
async function checkWorkspaceCloudCreditBalance(teamId: string): Promise<{
  hasCredits: boolean;
  balance: number;
  stripeCustomerId?: string;
}> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      stripeCustomerId: true,
      cloudCreditBalance: true,
    },
  });

  if (!team) {
    return { hasCredits: false, balance: 0 };
  }

  return {
    hasCredits: (team.cloudCreditBalance ?? 0) > 0,
    balance: team.cloudCreditBalance ?? 0,
    stripeCustomerId: team.stripeCustomerId ?? undefined,
  };
}

/**
 * Report AI usage and deduct from workspace Cloud credit balance
 * 🏢 WORKSPACE-CENTRIC: Deduct from workspace, not user
 */
async function reportWorkspaceAIUsage(
  teamId: string,
  userId: string,
  stripeCustomerId: string | undefined,
  credits: number,
  metadata: {
    projectId: string;
    model?: string;
    endpoint: string;
    tokens?: number;
    costUsd: number;
  },
): Promise<boolean> {
  if (credits <= 0) {
    return true; // Nothing to report
  }

  try {
    // Deduct credits from workspace (primary source of truth for balance)
    await prisma.team.update({
      where: { id: teamId },
      data: {
        cloudCreditBalance: { decrement: credits },
      },
    });

    // Log the transaction against the workspace
    await prisma.cloudCreditTransaction.create({
      data: {
        teamId,
        userId, // Track who triggered the usage
        amount: -credits,
        type: "USAGE",
        description: `AI usage: ${metadata.model || "unknown"} - ${metadata.tokens || 0} tokens`,
        metadata: {
          projectId: metadata.projectId,
          model: metadata.model,
          endpoint: metadata.endpoint,
          tokens: metadata.tokens,
          costUsd: metadata.costUsd,
        },
      },
    });

    logger.info({
      msg: "Deducted AI usage from workspace Cloud credits",
      teamId,
      userId,
      credits,
      costUsd: metadata.costUsd,
      model: metadata.model,
    });

    // Also report to Stripe meter for billing reconciliation (async, don't block)
    if (stripeCustomerId && BILLING_SERVICE_URL && BILLING_API_KEY) {
      const idempotencyKey = `ai-${metadata.projectId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      fetch(`${BILLING_SERVICE_URL}/credits/${userId}/ai-usage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": BILLING_API_KEY,
        },
        body: JSON.stringify({
          stripeCustomerId,
          credits,
          meterEventName: SHIPPER_CLOUD_CREDITS_METER,
          idempotencyKey,
          metadata: { type: "ai_usage", ...metadata },
        }),
      }).catch((err) => {
        logger.warn({
          msg: "Failed to report AI usage to Stripe meter (non-blocking)",
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }

    return true;
  } catch (error) {
    logger.error({
      msg: "Error deducting AI usage credits",
      error: error instanceof Error ? error.message : String(error),
      userId,
      credits,
    });
    return false;
  }
}

/**
 * Middleware to validate token for all AI proxy routes
 */
async function authMiddleware(req: Request, res: Response, next: Function) {
  const token = req.headers["x-shipper-token"] as string;

  logger.info({
    msg: "AI proxy auth middleware",
    hasToken: !!token,
    tokenPrefix: token?.substring(0, 20),
    headers: Object.keys(req.headers),
  });

  if (!token) {
    logger.warn({ msg: "Missing X-Shipper-Token header" });
    return res.status(401).json({
      error: {
        message: "Missing X-Shipper-Token header",
        type: "authentication_error",
        code: "missing_token",
      },
    });
  }

  const projectInfo = await validateProjectToken(token);
  if (!projectInfo) {
    logger.warn({
      msg: "validateProjectToken returned null",
      tokenPrefix: token.substring(0, 20),
    });
    return res.status(401).json({
      error: {
        message: "Invalid or disabled AI token",
        type: "authentication_error",
        code: "invalid_token",
      },
    });
  }

  // 🏢 WORKSPACE-CENTRIC: Check workspace has Cloud credits
  const creditCheck = await checkWorkspaceCloudCreditBalance(
    projectInfo.teamId,
  );
  if (!creditCheck.hasCredits) {
    return res.status(402).json({
      error: {
        message:
          "Insufficient Cloud credits. Please add more credits to continue using AI features in your app.",
        type: "billing_error",
        code: "insufficient_credits",
        balance: creditCheck.balance,
      },
    });
  }

  // Attach project info and Stripe customer ID to request
  (req as any).projectInfo = {
    ...projectInfo,
    stripeCustomerId: creditCheck.stripeCustomerId,
  };
  next();
}

/**
 * Transparent proxy handler - forwards any request to OpenRouter
 */
async function proxyToOpenRouter(
  req: Request,
  res: Response,
  endpoint: string,
) {
  const startTime = Date.now();
  const projectInfo = (req as any).projectInfo;

  try {
    const openRouterUrl = `${OPENROUTER_BASE_URL}${endpoint}`;
    const isStreaming = req.body?.stream === true;

    logger.info({
      msg: "AI proxy request",
      projectId: projectInfo.projectId,
      userId: projectInfo.userId,
      endpoint,
      model: req.body?.model,
      stream: isStreaming,
    });

    // Forward request to OpenRouter
    const openRouterResponse = await fetch(openRouterUrl, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": process.env.API_URL || "https://api.shipper.so",
        "X-Title": `Shipper App: ${projectInfo.projectName}`,
      },
      body: JSON.stringify(req.body),
    });

    // Handle streaming responses
    if (isStreaming && openRouterResponse.body) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const reader = openRouterResponse.body.getReader();
      const decoder = new TextDecoder();
      let totalContent = "";
      let usage: any = null;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          res.write(chunk);

          // Try to extract usage from the final chunk
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ") && line !== "data: [DONE]") {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.usage) {
                  usage = data.usage;
                }
                if (data.choices?.[0]?.delta?.content) {
                  totalContent += data.choices[0].delta.content;
                }
              } catch {
                // Ignore parse errors for partial chunks
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      res.end();

      // Report usage to Stripe meter (Cloud credits) after streaming completes
      const cost = extractCost(openRouterResponse.headers, { usage });
      const credits = usdToCloudCredits(cost);

      if (credits > 0) {
        // 🏢 WORKSPACE-CENTRIC: Report usage to workspace
        reportWorkspaceAIUsage(
          projectInfo.teamId,
          projectInfo.userId,
          projectInfo.stripeCustomerId,
          credits,
          {
            projectId: projectInfo.projectId,
            model: req.body?.model,
            endpoint,
            tokens: usage?.total_tokens,
            costUsd: cost,
          },
        ).catch((error: Error) => {
          logger.error({
            msg: "Failed to report AI usage to workspace",
            error: error instanceof Error ? error.message : String(error),
            projectId: projectInfo.projectId,
            teamId: projectInfo.teamId,
          });
        });
      }

      logger.info({
        msg: "AI proxy stream completed",
        projectId: projectInfo.projectId,
        endpoint,
        model: req.body?.model,
        cost,
        credits,
        durationMs: Date.now() - startTime,
      });

      return;
    }

    // Handle non-streaming responses
    const responseBody = (await openRouterResponse.json()) as {
      usage?: { total_tokens?: number; cost?: number };
      [key: string]: any;
    };

    // Extract cost and report to Stripe meter (Cloud credits)
    const cost = extractCost(openRouterResponse.headers, responseBody);
    const credits = usdToCloudCredits(cost);

    if (credits > 0) {
      // 🏢 WORKSPACE-CENTRIC: Report usage to workspace
      reportWorkspaceAIUsage(
        projectInfo.teamId,
        projectInfo.userId,
        projectInfo.stripeCustomerId,
        credits,
        {
          projectId: projectInfo.projectId,
          model: req.body?.model,
          endpoint,
          tokens: responseBody?.usage?.total_tokens,
          costUsd: cost,
        },
      ).catch((error: Error) => {
        logger.error({
          msg: "Failed to report AI usage to workspace",
          error: error instanceof Error ? error.message : String(error),
          projectId: projectInfo.projectId,
          teamId: projectInfo.teamId,
        });
      });
    }

    logger.info({
      msg: "AI proxy request completed",
      projectId: projectInfo.projectId,
      endpoint,
      model: req.body?.model,
      tokens: responseBody?.usage?.total_tokens,
      cost,
      credits,
      durationMs: Date.now() - startTime,
    });

    // Return response with same status code
    return res.status(openRouterResponse.status).json(responseBody);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({
      msg: "AI proxy error",
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      projectId: projectInfo.projectId,
      endpoint,
    });

    return res.status(500).json({
      error: {
        message: "AI request failed",
        type: "api_error",
        code: "proxy_error",
        details: errorMessage,
      },
    });
  }
}

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * POST /api/v1/ai/chat/completions
 * OpenAI-compatible chat completions endpoint
 */
router.post("/chat/completions", (req, res) =>
  proxyToOpenRouter(req, res, "/chat/completions"),
);

/**
 * POST /api/v1/ai/completions
 * Legacy completions endpoint
 */
router.post("/completions", (req, res) =>
  proxyToOpenRouter(req, res, "/completions"),
);

/**
 * POST /api/v1/ai/embeddings
 * Embeddings endpoint for vector search, RAG, etc.
 */
router.post("/embeddings", (req, res) =>
  proxyToOpenRouter(req, res, "/embeddings"),
);

/**
 * POST /api/v1/ai/images/generations
 * Image generation endpoint (DALL-E, etc.)
 */
router.post("/images/generations", (req, res) =>
  proxyToOpenRouter(req, res, "/images/generations"),
);

/**
 * GET /api/v1/ai/models
 * List available models from OpenRouter
 */
router.get("/models", async (req, res) => {
  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/models`, {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
    });
    const data = await response.json();
    return res.json(data);
  } catch (error) {
    return res.status(500).json({
      error: {
        message: "Failed to fetch models",
        type: "api_error",
      },
    });
  }
});

/**
 * Catch-all for any other OpenRouter endpoints
 * This ensures forward compatibility with new OpenRouter features
 */
router.all("/*", (req, res) => {
  const endpoint = req.path;
  return proxyToOpenRouter(req, res, endpoint);
});

export default router;
