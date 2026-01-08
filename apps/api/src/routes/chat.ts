/**
 * Chat API Routes
 *
 * Handles AI chat requests with streaming responses.
 * Supports tool execution, fragment management, and sandbox operations.
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import type { ApiResponse } from "@shipper/shared";
import {
  calculateCreditsFromUSD,
  calculateCreditsFromUSDFirstPrompt,
} from "../utils/pricing.js";
import {
  validateSession,
  validateProjectAccess,
} from "../middleware/session-auth.js";
import {
  convertToModelMessages,
  createUIMessageStream,
  generateId,
  generateText,
  stepCountIs,
  streamText,
  type UIMessage,
  safeValidateUIMessages,
  UI_MESSAGE_STREAM_HEADERS,
  createUIMessageStreamResponse,
  smoothStream,
} from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { prisma } from "@shipper/database";
import mammoth from "mammoth";
import {
  tools,
  type ToolsContext,
  ASK_CLARIFYING_QUESTIONS_TOOL_NAME,
} from "../services/ai-tools.js";
import {
  refinePlanningPrompt,
  type PlanningQuestion,
  type PlanningAnswer,
} from "../services/planning-questions-generator.js";
import { getFullStackPrompt } from "../prompts/v2-full-stack-prompt.js";
import {
  getCodeImportContext,
  isImportedProject,
} from "../services/code-import-context.js";
import { getSandbox } from "../services/modal-sandbox-manager.js";
import { ensureSandboxRecovered } from "../services/sandbox-health.js";
import { UploadService } from "../services/upload-service.js";
import { CreditManager } from "../services/credits.js";
import {
  analyzePromptComplexity,
  type ComplexityAnalysis,
} from "../services/complexity-analyzer.js";
import { ContextManager } from "../services/context-manager.js";
import throttle from "throttleit";
import { createResumableStreamContext } from "resumable-stream/ioredis";
import { Redis } from "ioredis";
import { redisFileStreamPublisher } from "../services/redis-file-events.js";
import {
  registerChatAbort,
  finalizeOnAbort,
  finalizeOnFinish,
  abortChat,
  safeClearActiveStream,
} from "../services/chat-abort-registory.js";
import { logger, createProjectLogger } from "../config/logger.js";
import {
  createCachedSystemPromptWithImage,
  extractCacheMetrics,
  applyMessageCaching,
  createCachedSystemPrompt,
} from "../utils/prompt-caching.js";
import {
  SHIPPER_CLOUD_APPROVAL,
  executeShipperCloudDeploymentWithFiles,
  formatDeploymentSuccess,
  formatDeploymentError,
} from "../services/shipper-cloud-hitl.js";
import { ConvexDeploymentAPI, decryptDeployKey } from "@shipper/convex";
import { connectorRegistry } from "../services/connectors/index.js";
// ABLY (kept for potential rollback - currently using SSE)
// import {
//   broadcastStreamingStart,
//   broadcastStreamingStop,
//   broadcastAIChunk,
//   broadcastAIToolCall,
//   broadcastAIToolResult,
//   broadcastAIComplete,
//   broadcastAIError,
//   flushPendingChunks,
// } from "../services/ably.js";

// SSE Pub/Sub (self-hosted alternative to Ably)
import {
  ssePublishStreamingStart as broadcastStreamingStart,
  ssePublishStreamingStop as broadcastStreamingStop,
  ssePublishAIChunk as broadcastAIChunk,
  ssePublishAIToolCall as broadcastAIToolCall,
  ssePublishAIToolResult as broadcastAIToolResult,
  ssePublishAIComplete as broadcastAIComplete,
  ssePublishAIError as broadcastAIError,
  sseFlushPendingChunks as flushPendingChunks,
} from "../services/sse-pubsub.js";

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Anthropic model configuration
// First prompt: Opus 4.5 (best quality, 10% margin)
// Follow-ups: Sonnet for complex/moderate, Haiku for simple
const MODEL_OPUS = "claude-opus-4-5";
const MODEL_SONNET = "claude-sonnet-4-5";
const MODEL_HAIKU = "claude-haiku-4-5";

// Development uses Haiku for cost savings
const DEV_MODEL = "claude-haiku-4-5";

// Anthropic pricing per 1M tokens (for prompts ≤ 200K tokens)
// Opus 4.5: $5/MTok input, $25/MTok output, cache write $6.25/MTok, cache read $0.50/MTok
// Sonnet 4.5: $3/MTok input, $15/MTok output, cache write $3.75/MTok, cache read $0.30/MTok
// Haiku 4.5: $1/MTok input, $5/MTok output, cache write $1.25/MTok, cache read $0.10/MTok
const ANTHROPIC_PRICING_OPUS = {
  inputPerMillion: 5.0,
  outputPerMillion: 25.0,
  cacheWritePerMillion: 6.25, // 1.25x input price
  cacheReadPerMillion: 0.5, // 0.1x input price
};

const ANTHROPIC_PRICING_SONNET = {
  inputPerMillion: 3.0,
  outputPerMillion: 15.0,
  cacheWritePerMillion: 3.75,
  cacheReadPerMillion: 0.3,
};

const ANTHROPIC_PRICING_HAIKU = {
  inputPerMillion: 1.0,
  outputPerMillion: 5.0,
  cacheWritePerMillion: 1.25,
  cacheReadPerMillion: 0.1,
};

/**
 * Calculate USD cost from Anthropic token usage
 */
function calculateAnthropicCost(
  usage: {
    inputTokens?: number;
    outputTokens?: number;
    cacheCreationInputTokens?: number;
    cacheReadInputTokens?: number;
  },
  pricing: typeof ANTHROPIC_PRICING_HAIKU = ANTHROPIC_PRICING_HAIKU,
): number {
  const inputTokens = usage.inputTokens || 0;
  const outputTokens = usage.outputTokens || 0;
  const cacheWriteTokens = usage.cacheCreationInputTokens || 0;
  const cacheReadTokens = usage.cacheReadInputTokens || 0;

  // inputTokens from AI SDK already excludes cache reads
  // So we charge full price for inputTokens, plus discounted rate for cache reads
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillion;
  const cacheWriteCost =
    (cacheWriteTokens / 1_000_000) * pricing.cacheWritePerMillion;
  const cacheReadCost =
    (cacheReadTokens / 1_000_000) * pricing.cacheReadPerMillion;

  return inputCost + outputCost + cacheWriteCost + cacheReadCost;
}

const ABSOLUTE_MAX_STEPS = 30; // Hard limit and fallback if complexity analysis fails
const HARD_BUDGET_LIMIT_USD = 3; // $2 USD hard limit per generation to prevent runaway costs

function getMaxSteps(complexityAnalysis?: ComplexityAnalysis): number {
  return complexityAnalysis?.recommendedSteps
    ? Math.min(complexityAnalysis.recommendedSteps, ABSOLUTE_MAX_STEPS)
    : ABSOLUTE_MAX_STEPS;
}

// Global abort registry helpers are imported from the centralized service.

// Initialize Redis clients for resumable streams (using ioredis)
// OPTIMIZED: Configure Redis for better streaming performance
const redisPublisher = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      retryStrategy: (times) => Math.min(times * 50, 2000),
      // Performance optimizations
      enableOfflineQueue: true, // Queue commands when disconnected
      lazyConnect: false, // Connect immediately
      keepAlive: 30000, // Keep connection alive
      // Reduce latency with pipelining
      enableAutoPipelining: true,
      autoPipeliningIgnoredCommands: ["ping"],
    })
  : null;

const redisSubscriber = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      retryStrategy: (times) => Math.min(times * 50, 2000),
      // Performance optimizations
      enableOfflineQueue: true,
      lazyConnect: false,
      keepAlive: 30000,
    })
  : null;

// Log Redis connection status
if (redisPublisher && redisSubscriber) {
  redisPublisher.on("connect", () => {
    console.log("[Redis] Publisher connected");
  });
  redisPublisher.on("error", (error) => {
    console.error("[Redis] Publisher error:", error);
  });
  redisSubscriber.on("connect", () => {
    console.log("[Redis] Subscriber connected");
  });
  redisSubscriber.on("error", (error) => {
    console.error("[Redis] Subscriber error:", error);
  });
}

const router: Router = Router();

// Validation schemas
const chatRequestSchema = z.object({
  message: z.object({
    id: z.string().optional(),
    role: z.enum(["user", "assistant"]),
    parts: z.array(z.any()), // AI SDK UIMessage format uses parts array
    // createdAt can be a Date object from AI SDK or string, we don't use it so just accept any
    createdAt: z.union([z.string(), z.date(), z.any()]).optional(),
  }),
  projectId: z.string().uuid(),
  // Chat mode: when true, AI should ask clarifying questions before building
  // No sandbox is created until questions are answered
  chatMode: z.boolean().optional().default(false),
});

// Helper function to deslugify project names
function deslugifyProjectName(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Helper function to extract text content from UIMessage
function getMessageContent(message: UIMessage): string {
  // UIMessage has parts array, extract text from all text parts
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

/**
 * Extracts styling preset image URL from user message if styling instructions contain it.
 * Looks for imageUrl in the message content.
 * Checks both the current message and the last user message in conversation history.
 */
async function extractStylingImageUrl(
  message: UIMessage,
  prunedMessages?: UIMessage[],
  logger?: any,
): Promise<string | null> {
  // Helper function to check a message for styling images
  const checkMessageForStylingImage = async (
    msg: UIMessage,
  ): Promise<string | null> => {
    if (!Array.isArray(msg.parts)) {
      return null;
    }

    const imagePart = msg.parts.find(
      (part: any) =>
        part.type === "file" &&
        part.url?.startsWith("/") &&
        (part.mediaType?.startsWith("image/") ||
          part.mimeType?.startsWith("image/")),
    ) as any;

    if (imagePart) {
      // Convert relative URL to absolute URL for system prompt
      // For localhost URLs, convert to base64 data URI (AI providers can't fetch localhost)
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL || "https://staging.shipper.now"; // Fallback for local dev
      const absoluteUrl = `${baseUrl}${imagePart.url}`;
      // ALWAYS try to convert to base64 for internal images to ensure AI provider can access them.
      // If this fails (e.g. staging server cannot reach WEB_APP_URL), we now fail *gracefully*
      // and simply skip the styling image rather than sending an unreachable URL to the provider.
      try {
        const response = await fetch(absoluteUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");
        const mimeType =
          imagePart.mediaType || imagePart.mimeType || "image/png";
        const dataUri = `data:${mimeType};base64,${base64}`;
        console.log("dataUri", dataUri);
        console.log("absoluteUrl", absoluteUrl);
        return dataUri;
      } catch (error) {
        logger?.warn({
          msg: "Failed to convert preset styling image to base64, skipping styling image",
          url: absoluteUrl,
          error: error instanceof Error ? error.message : String(error),
        });
        // IMPORTANT:
        // Returning an unreachable or private URL here can cause the upstream provider to error.
        // Instead, we skip the styling image so the request still succeeds (just without styling).
        return null;
      }
    }

    return null;
  };

  // First, check the current message (initial user message)
  const currentMessageImage = await checkMessageForStylingImage(message);
  if (currentMessageImage) {
    return currentMessageImage;
  }

  // If not found in current message, check the last user message in conversation history
  // This handles cases where styling preset was added in a previous message
  if (prunedMessages && prunedMessages.length > 0) {
    // Find the last user message in the conversation
    for (let i = prunedMessages.length - 1; i >= 0; i--) {
      const msg = prunedMessages[i];
      if (msg.role === "user") {
        const historyImage = await checkMessageForStylingImage(msg);
        if (historyImage) {
          logger?.info({
            msg: "Found styling image in conversation history",
            messageId: msg.id,
            imageUrl: historyImage,
          });
          return historyImage;
        }
        // Only check the most recent user message to avoid confusion
        break;
      }
    }
  }

  logger?.debug({
    msg: "No styling preset image found in message or conversation history",
    messagePartsCount: Array.isArray(message.parts) ? message.parts.length : 0,
    conversationLength: prunedMessages?.length || 0,
  });

  return null;
}

/**
 * Analyze document files (PDF, DOCX, TXT, code files, etc.) using Anthropic's AI SDK
 * Anthropic supports native PDF processing and file content analysis
 */
async function analyzeDocumentsWithAnthropic(
  documentParts: any[],
  userPrompt: string,
  logger?: any,
): Promise<{ analysis: string; costUSD: number }> {
  try {
    // Prepare content parts for Anthropic
    const contentParts: any[] = [
      {
        type: "text",
        text: `You are a document analysis assistant. The user has uploaded one or more documents for you to analyze.

IMPORTANT: Your ONLY task is to analyze the document(s) provided below. Do NOT ask the user what they want to build. Do NOT respond with generic prompts about building apps. ONLY analyze the document content.

User's request: ${userPrompt}

Analyze the document(s) and provide a COMPREHENSIVE and DETAILED analysis that includes:

1. **Document Overview**: Type of document, purpose, and main subject
2. **Key Information**: Extract all important data, numbers, dates, names, and facts
3. **Structure & Sections**: Outline the document's organization and main sections
4. **Detailed Content**: Summarize each major section thoroughly
5. **Tables & Data**: Extract and format any tables, lists, or structured data
6. **Important Details**: Highlight critical information, deadlines, amounts, or requirements
7. **Context**: Explain the significance and implications of the content

Be thorough and detailed. Extract as much useful information as possible from the document(s) below.`,
      },
    ];

    // Add document parts
    logger?.info({
      msg: "Processing document parts for analysis",
      documentCount: documentParts.length,
      parts: documentParts.map((p) => ({
        type: p.type,
        name: p.name,
        mediaType: p.mediaType,
        hasUrl: !!p.url,
        urlPreview: p.url?.substring(0, 50),
      })),
    });

    for (const part of documentParts) {
      // Skip images (they're handled separately in the main chat flow)
      if (part.mediaType?.startsWith("image/")) {
        continue;
      }

      // Check file type
      const fileName = part.name?.toLowerCase() || "";
      const isPDF =
        fileName.endsWith(".pdf") || part.mediaType === "application/pdf";
      const isDOCX =
        fileName.endsWith(".docx") ||
        part.mediaType ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

      logger?.info({
        msg: "Checking document part",
        isPDF,
        isDOCX,
        name: (part as any).name,
        mediaType: part.mediaType,
        type: part.type,
      });

      if (isPDF) {
        // PDFs use file type (native Anthropic support)
        contentParts.push({
          type: "file",
          data: part.url, // URL or base64 data URI
          mediaType: "application/pdf",
        });
      } else if (isDOCX) {
        // Extract text from DOCX files using mammoth
        let docxText = "";

        logger?.info({
          msg: "Starting DOCX extraction",
          fileName: part.name,
          urlType: part.url.startsWith("data:")
            ? "data URI"
            : part.url.startsWith("http")
              ? "HTTP URL"
              : "unknown",
          urlLength: part.url?.length,
        });

        try {
          if (part.url.startsWith("data:")) {
            logger?.info({ msg: "Processing DOCX from data URI" });
            // Extract base64 content from data URI
            const base64Match = part.url.match(/^data:[^;]+;base64,(.+)$/);
            if (base64Match) {
              logger?.info({
                msg: "Base64 match found",
                base64Length: base64Match[1].length,
              });
              const buffer = Buffer.from(base64Match[1], "base64");
              logger?.info({
                msg: "Buffer created",
                bufferSize: buffer.length,
              });
              const result = await mammoth.extractRawText({ buffer });
              docxText = result.value;
              logger?.info({
                msg: "Mammoth extraction complete",
                textLength: docxText.length,
                hasMessages: !!result.messages?.length,
              });
              if (result.messages && result.messages.length > 0) {
                logger?.warn({
                  msg: "Mammoth warnings/messages",
                  messages: result.messages,
                });
              }
            } else {
              logger?.error({ msg: "No base64 match found in data URI" });
            }
          } else if (
            part.url.startsWith("http://") ||
            part.url.startsWith("https://")
          ) {
            logger?.info({ msg: "Fetching DOCX from URL", url: part.url });
            // Fetch DOCX from URL
            const response = await fetch(part.url);
            logger?.info({
              msg: "Fetch response received",
              status: response.status,
              ok: response.ok,
              contentType: response.headers.get("content-type"),
            });
            const arrayBuffer = await response.arrayBuffer();
            logger?.info({
              msg: "ArrayBuffer received",
              size: arrayBuffer.byteLength,
            });
            const buffer = Buffer.from(arrayBuffer);
            logger?.info({
              msg: "Buffer created from arrayBuffer",
              bufferSize: buffer.length,
              bufferStart: buffer.slice(0, 20).toString("hex"), // First 20 bytes in hex
              isPKZip: buffer[0] === 0x50 && buffer[1] === 0x4b, // Check for PK zip signature
            });

            // Try extracting raw text
            const result = await mammoth.extractRawText({ buffer });
            docxText = result.value;
            logger?.info({
              msg: "Mammoth extractRawText complete",
              textLength: docxText.length,
              hasMessages: !!result.messages?.length,
            });

            // If raw text is empty, try converting to HTML and stripping tags
            if (!docxText || docxText.trim().length === 0) {
              logger?.info({ msg: "Raw text empty, trying convertToHtml" });
              const htmlResult = await mammoth.convertToHtml({ buffer });
              logger?.info({
                msg: "HTML conversion complete",
                htmlLength: htmlResult.value.length,
              });
              // Strip HTML tags to get plain text
              docxText = htmlResult.value.replace(/<[^>]*>/g, "").trim();
              logger?.info({
                msg: "HTML stripped to text",
                textLength: docxText.length,
              });
            }

            if (result.messages && result.messages.length > 0) {
              logger?.warn({
                msg: "Mammoth warnings/messages",
                messages: result.messages,
              });
            }
          } else {
            logger?.error({
              msg: "Unknown URL format",
              url: part.url?.substring(0, 100),
            });
          }

          logger?.info({
            msg: "DOCX extraction result",
            hasText: !!docxText,
            textLength: docxText?.length || 0,
            trimmedLength: docxText?.trim().length || 0,
          });

          if (docxText && docxText.trim().length > 0) {
            // Limit text length to prevent overwhelming the AI (max ~50k characters)
            const maxLength = 50000;
            const originalLength = docxText.length;
            let truncatedText = docxText;
            let truncationNote = "";

            if (docxText.length > maxLength) {
              truncatedText = docxText.substring(0, maxLength);
              truncationNote = `\n\n[Note: Document truncated from ${originalLength.toLocaleString()} to ${maxLength.toLocaleString()} characters]`;
              logger?.info({
                msg: "DOCX text truncated",
                originalLength,
                truncatedLength: maxLength,
              });
            }

            logger?.info({
              msg: "Adding DOCX content to contentParts",
              textPreview: truncatedText.substring(0, 100),
            });
            contentParts.push({
              type: "text",
              text: `\n\n---\n**File: ${part.name || "document.docx"}**\n\`\`\`\n${truncatedText}\n\`\`\`${truncationNote}\n---\n`,
            });
          } else {
            logger?.warn({
              msg: "DOCX extraction returned empty content",
              fileName: part.name,
              rawTextValue: docxText,
            });
            contentParts.push({
              type: "text",
              text: `\n\n---\n**File: ${part.name || "document.docx"}**\n[Unable to extract DOCX content - file may be empty or corrupted]\n---\n`,
            });
          }
        } catch (error) {
          logger?.error({
            msg: "Failed to extract DOCX text",
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            fileName: part.name,
          });
          contentParts.push({
            type: "text",
            text: `\n\n---\n**File: ${part.name || "document.docx"}**\n[Error extracting DOCX: ${error instanceof Error ? error.message : "unknown"}]\n---\n`,
          });
        }
      } else {
        // For text/code files, extract content and pass as text
        // If it's a data URI, extract the base64 content and decode it
        let fileContent = "";

        if (part.url.startsWith("data:")) {
          // Extract base64 content from data URI
          const base64Match = part.url.match(/^data:[^;]+;base64,(.+)$/);
          if (base64Match) {
            try {
              fileContent = Buffer.from(base64Match[1], "base64").toString(
                "utf-8",
              );
            } catch (error) {
              fileContent = `[Unable to decode file content: ${part.name || "unknown"}]`;
            }
          }
        } else if (
          part.url.startsWith("http://") ||
          part.url.startsWith("https://")
        ) {
          // If it's an uploaded file (R2 URL), fetch the content
          try {
            const response = await fetch(part.url);
            if (response.ok) {
              const arrayBuffer = await response.arrayBuffer();
              fileContent = Buffer.from(arrayBuffer).toString("utf-8");
            } else {
              fileContent = `[Unable to fetch file: ${response.statusText}]`;
            }
          } catch (error) {
            fileContent = `[Error fetching file: ${error instanceof Error ? error.message : "unknown"}]`;
          }
        } else {
          // Unknown URL format
          fileContent = `[File URL: ${part.url}]`;
        }

        // Limit text length to prevent overwhelming the AI (max ~50k characters)
        const maxLength = 50000;
        const originalLength = fileContent.length;
        let truncatedContent = fileContent;
        let truncationNote = "";

        if (fileContent.length > maxLength) {
          truncatedContent = fileContent.substring(0, maxLength);
          truncationNote = `\n\n[Note: File truncated from ${originalLength.toLocaleString()} to ${maxLength.toLocaleString()} characters]`;
          logger?.info({
            msg: "File content truncated",
            fileName: part.name,
            originalLength,
            truncatedLength: maxLength,
          });
        }

        // Add as text content with file context
        contentParts.push({
          type: "text",
          text: `\n\n---\n**File: ${part.name || "document"}**\n\`\`\`\n${truncatedContent}\n\`\`\`${truncationNote}\n---\n`,
        });
      }
    }

    // Use Anthropic's Claude for document analysis with selected model
    const result = await generateText({
      model: anthropic("claude-haiku-4-5"),
      messages: [
        {
          role: "user" as const,
          content: contentParts,
        },
      ],
    });

    const analysis = result.text || "Unable to analyze documents";

    // Calculate cost from usage
    const inputTokens = result.usage?.inputTokens || 0;
    const outputTokens = result.usage?.outputTokens || 0;

    // Claude Haiku 4.5 pricing (as of Nov 2024)
    // Input: $1.00/MTok, Output: $5.00/MTok
    const inputCost = (inputTokens / 1_000_000) * 1.0;
    const outputCost = (outputTokens / 1_000_000) * 5.0;
    const costUSD = inputCost + outputCost;

    logger?.info({
      msg: "Document analysis completed via Anthropic",
      documentCount: documentParts.length,
      analysisLength: analysis.length,
      inputTokens,
      outputTokens,
      costUSD: costUSD.toFixed(6),
    });

    return { analysis, costUSD };
  } catch (error) {
    logger?.error({
      msg: "Error analyzing documents with Anthropic",
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * OPTIONS /api/v1/chat
 * Handle CORS preflight for mobile browsers
 */
router.options("/", (_req: Request, res: Response) => {
  res.status(204).end();
});

/**
 * POST /api/v1/chat
 * Main chat endpoint with streaming AI responses
 */
router.post(
  "/",
  validateSession,
  validateProjectAccess,
  async (req: Request, res: Response) => {
    const requestId = generateId();
    const startTime = Date.now();

    // Set headers early for mobile compatibility
    // This helps prevent "Load failed" errors on iOS Safari
    res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering if behind proxy
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

    try {
      // Validate request body
      const parsed = chatRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        req.logger?.warn({
          msg: "Invalid chat request body",
          requestId,
          error: parsed.error,
        });
        const response: ApiResponse = {
          success: false,
          error: "Invalid request body",
        };
        return res.status(400).json(response);
      }

      const { message: rawMessage, projectId, chatMode } = parsed.data;

      // Validate and convert to UIMessage format using AI SDK
      const validationResult = await safeValidateUIMessages({
        messages: [rawMessage],
      });

      if (!validationResult.success) {
        req.logger?.warn({
          msg: "Invalid UI message format",
          requestId,
          error: validationResult.error,
        });
        const response: ApiResponse = {
          success: false,
          error: "Invalid message format",
        };
        return res.status(400).json(response);
      }

      const message = validationResult.data[0];

      req.logger?.info({
        msg: "Chat message received",
        requestId,
        messageRole: message.role,
      });

      if (!req.user) {
        const response: ApiResponse = {
          success: false,
          error: "User not authenticated",
        };
        return res.status(401).json(response);
      }

      req.logger?.info({
        msg: "Starting chat session",
        requestId,
        userId: req.user.id,
        userEmail: req.user.email,
      });

      const userId = req.user.id;
      // Namespace stream ID with project ID for proper isolation
      const streamId = `${projectId}:${requestId}`;

      // Create abort controller and register for immediate cancellation support
      const abortController = new AbortController();
      let aborted = false;
      abortController.signal.addEventListener("abort", () => {
        aborted = true;
      });

      // Check if Redis is available for resumable streams
      const redisAvailable =
        !!process.env.REDIS_URL && !!redisPublisher && !!redisSubscriber;

      // Create resumable stream context only if Redis is available
      const streamContext = redisAvailable
        ? createResumableStreamContext({
            publisher: redisPublisher!,
            subscriber: redisSubscriber!,
            waitUntil: (promise: Promise<unknown>) => {
              // Express doesn't have `after` like Next.js,
              // but we can just let the promise resolve in the background
              promise.catch((error) => {
                req.logger?.error({
                  msg: "Background task error",
                  error: error instanceof Error ? error.message : String(error),
                });
              });
            },
          })
        : null;

      // Variables to track costs and steps across execute and onError callbacks
      let builderAnthropicCost = 0;
      let builderInputTokens = 0;
      let builderOutputTokens = 0;
      let stepCount = 0;
      let toolsContext: ToolsContext | undefined;

      // Track assistant message for incremental saving
      let assistantMessageId: string | null = null;
      const accumulatedParts: Array<{
        type: string;
        toolInvocationId?: string;
        toolName?: string;
        state?: string;
        args?: unknown;
        result?: unknown;
        text?: string;
      }> = [];

      // Create UI message stream with writer pattern for orchestration
      const stream = createUIMessageStream({
        execute: async ({ writer }) => {
          // Initialize context manager
          const contextManager = new ContextManager();

          // Load project with codeImport relation for imported projects
          const project = await prisma.project.findFirst({
            where: { id: projectId },
            include: {
              codeImport: true,
            },
          });

          // Get workspace ID for credit operations
          // This supports both new workspace-centric and legacy user-centric projects
          const workspaceId =
            await CreditManager.getWorkspaceIdFromProject(projectId);

          if (!project) {
            throw new Error("Project not found or access denied");
          }

          // Check if this is an imported project (has codeImport relation)
          const isImported = isImportedProject(project);

          const projectName = deslugifyProjectName(project.name);
          req.logger?.info({
            msg: "Working on project",
            projectName,
            streamId,
          });

          // Set activeStreamId with timestamp for freshness tracking
          await prisma.project.update({
            where: { id: projectId },
            data: {
              activeStreamId: streamId,
              activeStreamStartedAt: new Date(),
            },
          });
          // Register abort controller for this stream so DELETE can abort immediately
          registerChatAbort(streamId, abortController);

          // Extract user message content for Ably broadcast
          const userMessageContent =
            message.role === "user" ? getMessageContent(message) : undefined;

          req.logger?.info({
            msg: "Broadcasting streaming start with user message",
            messageRole: message.role,
            userMessageContent: userMessageContent?.substring(0, 100),
            hasUserMessage: !!userMessageContent,
          });

          // 🔴 ABLY: Broadcast streaming start to all project viewers (includes user message)
          broadcastStreamingStart(
            projectId,
            userId,
            undefined,
            assistantMessageId ?? undefined,
            userMessageContent, // Include user's prompt so remote users see what was asked
          ).catch((err) => {
            req.logger?.warn({
              msg: "Failed to broadcast streaming start",
              error: err,
            });
          });

          // Store complexity analysis and template
          // For imported projects, use the empty bun template
          // For new projects, use tanstack-template (the modern TanStack default)
          let selectedTemplate = isImported
            ? "shipper-empty-bun-template"
            : "tanstack-template";
          let complexityAnalysis: ComplexityAnalysis | undefined;

          // Extract message content once for reuse
          const messageContent = getMessageContent(message);

          // Analyze complexity for user messages (for model selection and template)
          if (message.role === "user") {
            try {
              const truncatedContent =
                contextManager.truncateMessage(messageContent);

              req.logger?.info({
                msg: "User message truncated",
                originalLength: messageContent.length,
                truncatedLength: truncatedContent.length,
              });

              // Determine if this is the first user message by counting existing user messages
              const existingUserMessages = await prisma.v2Message.count({
                where: {
                  projectId,
                  role: "USER",
                },
              });
              const isFirstUserMessage = existingUserMessages === 0;

              req.logger?.info({
                msg: "Analyzing prompt complexity",
                isFirstUserMessage,
                existingUserMessages,
              });

              complexityAnalysis = await analyzePromptComplexity(
                truncatedContent,
                userId,
                streamId,
                projectId,
                projectName,
                isFirstUserMessage,
              );

              // Don't override template for imported projects - they use shipper-empty-bun-template
              if (complexityAnalysis.recommendedTemplate && !isImported) {
                selectedTemplate = complexityAnalysis.recommendedTemplate;
              }

              // Add complexity analysis cost to accumulator
              const complexityCost = complexityAnalysis.openRouterCost || 0;
              builderAnthropicCost += complexityCost;

              req.logger?.info({
                msg: "Complexity analysis complete",
                complexity: complexityAnalysis.complexity,
                category: complexityAnalysis.category,
                analysisCostUSD: complexityCost,
                recommendedSteps: complexityAnalysis.recommendedSteps,
                cumulativeCostUSD: builderAnthropicCost,
                isBackendTask: complexityAnalysis.isBackendTask,
              });
            } catch (error) {
              req.logger?.error({
                msg: "Complexity analysis failed",
                error: error instanceof Error ? error.message : "Unknown error",
              });

              throw new Error(
                "AI analysis is currently unavailable. Please try again later.",
              );
            }
          }

          // PRE-PROCESS DOCUMENTS: Analyze them separately using Anthropic AI SDK
          // Documents (PDF, DOCX, TXT, code files) are kept in the saved message for UI display, but analysis is added for AI
          let documentAnalysisText = "";
          if (message.role === "user" && Array.isArray(message.parts)) {
            // Filter for all non-image files (documents, code, data files, etc.)
            // Exclude media files and archives
            const documentParts = message.parts.filter((part: any) => {
              if (part.type !== "file") return false;

              // Exclude media files
              if (part.mediaType?.startsWith("image/")) return false;
              if (part.mediaType?.startsWith("video/")) return false;
              if (part.mediaType?.startsWith("audio/")) return false;

              // Exclude archive/compressed files
              const archiveTypes = [
                "application/zip",
                "application/x-zip-compressed",
                "application/x-rar-compressed",
                "application/x-7z-compressed",
                "application/x-tar",
                "application/gzip",
                "application/x-bzip2",
              ];
              if (archiveTypes.includes(part.mediaType)) return false;

              // Exclude by file extension
              const fileName = part.name?.toLowerCase() || "";
              if (fileName.match(/\.(zip|rar|7z|tar|gz|bz2|tgz)$/))
                return false;

              return true;
            });
            if (documentParts.length > 0) {
              // Determine model for document analysis based on complexity

              try {
                // Get user's text prompt
                const userPrompt =
                  getMessageContent(message) || "Analyze this document";

                // Analyze documents using Anthropic
                const documentResult = await analyzeDocumentsWithAnthropic(
                  documentParts,
                  userPrompt,
                  req.logger,
                );

                documentAnalysisText = documentResult.analysis;

                // Track document analysis cost
                builderAnthropicCost += documentResult.costUSD;

                req.logger?.info({
                  msg: "Document analysis complete - will be added to AI context",
                  analysisLength: documentAnalysisText.length,
                  documentAnalysisCost: documentResult.costUSD.toFixed(6),
                  cumulativeCostUSD: builderAnthropicCost,
                  provider: "Anthropic",
                });
              } catch (error) {
                req.logger?.error({
                  msg: "Failed to analyze documents - proceeding without analysis",
                  error: error instanceof Error ? error.message : String(error),
                });
                // Continue without PDF analysis if it fails
              }
            }
          }

          // Save user message to database (keep original message with PDFs for UI display)
          const messageId = message.id || generateId();

          // Ensure message.parts is an array
          if (!Array.isArray(message.parts)) {
            req.logger?.error({
              msg: "Invalid message format - parts is not an array",
              messageId,
              partsType: typeof message.parts,
            });
            throw new Error("Invalid message format");
          }

          let content = JSON.stringify(message.parts);

          // For user messages, keep text and image parts (preset images are file parts)
          if (message.role === "user") {
            const relevantParts = message.parts.filter(
              (part) => part.type === "text" || part.type === "file",
            );
            content = JSON.stringify(relevantParts);

            // Log preset images being saved
            const imageParts = relevantParts.filter(
              (p: any) =>
                p.type === "file" && p.mediaType?.startsWith("image/"),
            );
            if (imageParts.length > 0) {
              req.logger?.info({
                msg: "💾 Saving preset images to database",
                imageCount: imageParts.length,
                images: imageParts.map((p: any) => ({
                  url: p.url,
                  mediaType: p.mediaType,
                  name: p.name,
                })),
              });
            }
          }

          // Use upsert to handle tool result submissions where message ID already exists
          // This happens when addToolOutput updates an existing message and re-sends it
          await prisma.v2Message.upsert({
            where: { id: messageId },
            create: {
              id: messageId,
              role: message.role === "user" ? "USER" : "ASSISTANT",
              content: content,
              projectId,
              createdAt: new Date(),
            },
            update: {
              // Update content in case tool parts were added/modified
              content: content,
            },
          });

          // Load chat history
          const rawMessages = await prisma.v2Message.findMany({
            where: { projectId },
            orderBy: { createdAt: "asc" },
          });

          // ========================================
          // Process TOOL_RESULT messages from frontend
          // ========================================
          // The frontend sends tool results as special user messages because
          // addToolResult only updates client state and doesn't persist to DB.
          // Format: [TOOL_RESULT:toolCallId:toolName]\n{jsonOutput}
          const toolResultRegex = /^\[TOOL_RESULT:([^:]+):([^\]]+)\]\n(.+)$/s;
          const lastMessage = rawMessages[rawMessages.length - 1];

          if (lastMessage?.role === "USER") {
            const match = lastMessage.content.match(toolResultRegex);
            if (match) {
              const [, toolCallId, toolName, outputJson] = match;
              req.logger?.info({
                msg: "Found TOOL_RESULT message from frontend",
                toolCallId,
                toolName,
                outputLength: outputJson.length,
              });

              // Find the assistant message with this tool call and update it
              for (const msg of rawMessages) {
                if (msg.role !== "ASSISTANT") continue;

                let parts;
                try {
                  parts = JSON.parse(msg.content);
                } catch {
                  continue;
                }

                if (!Array.isArray(parts)) continue;

                let found = false;
                for (const part of parts) {
                  const typedPart = part as {
                    type?: string;
                    toolName?: string;
                    toolCallId?: string;
                    toolInvocationId?: string;
                    output?: unknown;
                  };

                  const partToolCallId =
                    typedPart.toolCallId || typedPart.toolInvocationId;
                  if (partToolCallId === toolCallId) {
                    // Update the tool part with the output
                    typedPart.output = outputJson;
                    found = true;
                    req.logger?.info({
                      msg: "Updated assistant message with tool result",
                      messageId: msg.id,
                      toolCallId,
                      toolName,
                    });
                    break;
                  }
                }

                if (found) {
                  // Save the updated message
                  await prisma.v2Message.update({
                    where: { id: msg.id },
                    data: { content: JSON.stringify(parts) },
                  });
                  break;
                }
              }

              // Reload rawMessages to include the updated tool result
              rawMessages.length = 0;
              const reloadedMessages = await prisma.v2Message.findMany({
                where: { projectId },
                orderBy: { createdAt: "asc" },
              });
              rawMessages.push(...reloadedMessages);
            }
          }

          // ========================================
          // Auto-decline pending Shipper Cloud tool calls
          // ========================================
          // If there are any pending deployToShipperCloud tool calls without a response,
          // auto-decline them so the conversation can continue cleanly
          for (const msg of rawMessages) {
            if (msg.role !== "ASSISTANT") continue;

            let parts;
            try {
              parts = JSON.parse(msg.content);
            } catch {
              continue;
            }

            if (!Array.isArray(parts)) continue;

            let messageUpdated = false;
            for (const part of parts) {
              const typedPart = part as {
                type?: string;
                toolName?: string;
                toolCallId?: string;
                toolInvocationId?: string;
                output?: unknown;
                result?: unknown;
              };

              const isShipperCloudTool =
                typedPart.type === "tool-deployToShipperCloud" ||
                typedPart.toolName === "deployToShipperCloud";

              if (!isShipperCloudTool) continue;

              const output = typedPart.output ?? typedPart.result;

              // Check if this tool call is pending (no output, or output is pending_confirmation)
              const isPending =
                output === undefined ||
                output === null ||
                (typeof output === "object" &&
                  output !== null &&
                  "status" in output &&
                  (output as { status?: string }).status ===
                    "pending_confirmation");

              if (isPending) {
                req.logger?.info({
                  msg: "Auto-declining pending Shipper Cloud tool call",
                  toolCallId:
                    typedPart.toolCallId || typedPart.toolInvocationId,
                  messageId: msg.id,
                });

                // Mark as declined
                typedPart.output = {
                  status: "denied",
                  message: "Shipper Cloud deployment was skipped.",
                };
                typedPart.result = typedPart.output;
                messageUpdated = true;
              }
            }

            if (messageUpdated) {
              await prisma.v2Message.update({
                where: { id: msg.id },
                data: { content: JSON.stringify(parts) },
              });
              req.logger?.info({
                msg: "Updated message with auto-declined Shipper Cloud tool call",
                messageId: msg.id,
              });
            }
          }

          // ========================================
          // HITL Tool Confirmation Processing (BEFORE filtering)
          // ========================================
          // Process HITL on raw messages BEFORE tool parts are filtered out
          let hitlProcessed = false;
          let hitlDeploymentFailed = false;
          let hitlToolCallId: string | null = null;
          let hitlResultMessage: string | null = null;
          let hitlResultType:
            | "deployment"
            | "api-keys"
            | "stripe"
            | "planning"
            | null = null;

          // Store Stripe key when extracted from requestApiKeys for later use
          let extractedStripeKey: string | null = null;

          // Pre-scan message history for Stripe key from previous requestApiKeys
          for (const msg of rawMessages) {
            if (msg.role !== "ASSISTANT") continue;
            try {
              const parts = JSON.parse(msg.content);
              if (!Array.isArray(parts)) continue;
              for (const part of parts) {
                if (
                  part.toolName === "requestApiKeys" ||
                  part.type === "tool-requestApiKeys"
                ) {
                  if (typeof part.output === "string") {
                    try {
                      const out = JSON.parse(part.output);
                      // Check multiple possible key names (secretKey from ApiKeyInput, stripeSecretKey from tool)
                      const key =
                        out.keys?.secretKey ||
                        out.keys?.stripeSecretKey ||
                        out.stripeSecretKey;
                      if (key) {
                        extractedStripeKey = key;
                        req.logger?.info({
                          msg: "Pre-scan: Found Stripe key in history",
                          keyLength: key.length,
                        });
                      }
                    } catch {}
                  }
                }
              }
            } catch {}
          }

          // Debug: Log all messages to understand what we're processing
          req.logger?.info({
            msg: "HITL: Processing rawMessages",
            messageCount: rawMessages.length,
            messageRoles: rawMessages.map((m) => m.role),
          });

          for (const msg of rawMessages) {
            if (msg.role !== "ASSISTANT") continue;

            let parts;
            try {
              parts = JSON.parse(msg.content);
            } catch {
              continue;
            }

            if (!Array.isArray(parts)) continue;

            // Debug: Log tool parts found
            for (const p of parts) {
              if (p.toolName || p.type?.startsWith("tool-")) {
                req.logger?.info({
                  msg: "HITL: Found tool part",
                  toolName: p.toolName,
                  type: p.type,
                  hasOutput: !!p.output,
                  outputPreview:
                    typeof p.output === "string"
                      ? p.output.substring(0, 100)
                      : typeof p.output,
                });
              }
            }

            for (const part of parts) {
              const typedPart = part as {
                type?: string;
                toolName?: string;
                toolCallId?: string;
                toolInvocationId?: string;
                output?: unknown;
                input?: {
                  projectName?: string;
                  reason?: string;
                  provider?: string;
                };
                args?: {
                  projectName?: string;
                  reason?: string;
                  provider?: string;
                };
              };

              // Look for requestApiKeys tool parts
              const isApiKeysTool =
                typedPart.type === "tool-requestApiKeys" ||
                typedPart.toolName === "requestApiKeys";

              if (isApiKeysTool) {
                const toolCallId =
                  typedPart.toolCallId || typedPart.toolInvocationId;
                if (!toolCallId) continue;

                const output = typedPart.output;

                // Check if user submitted API keys
                if (typeof output === "string") {
                  try {
                    const parsed = JSON.parse(output);
                    // Skip if already processed (has success: true from previous processing)
                    if (parsed.success === true) {
                      continue;
                    }
                    if (parsed.confirmed && parsed.keys) {
                      const provider = (typedPart.input || typedPart.args)
                        ?.provider;

                      req.logger?.info({
                        msg: "HITL: User submitted API keys",
                        toolCallId,
                        provider,
                      });

                      // Store Stripe key for later use in Stripe HITL approval
                      // Check both secretKey (from ApiKeyInput) and stripeSecretKey (alternative name)
                      const stripeKey =
                        parsed.keys.secretKey || parsed.keys.stripeSecretKey;
                      if (provider === "stripe" && stripeKey) {
                        extractedStripeKey = stripeKey;
                        req.logger?.info({
                          msg: "HITL: Stored Stripe key for later use",
                          keyLength: stripeKey.length,
                        });
                      }

                      // Get envVarName from the tool input - AI specifies what env var to save to
                      // Cast to Record<string, any> since tool inputs have dynamic properties
                      const toolInput = (typedPart.input || typedPart.args) as
                        | Record<string, any>
                        | undefined;
                      const envVarName = toolInput?.envVarName as
                        | string
                        | undefined;
                      const fieldsConfig = toolInput?.fields as
                        | Array<{ key: string; envVarName?: string }>
                        | undefined;

                      // Set API keys in Convex env
                      let keysSetInConvex = false;
                      const envVarsSet: string[] = [];

                      try {
                        const project = await prisma.project.findUnique({
                          where: { id: projectId },
                          include: { convexDeployment: true },
                        });

                        if (project?.convexDeployment?.deployKeyEncrypted) {
                          const deployKey = decryptDeployKey(
                            project.convexDeployment.deployKeyEncrypted,
                          );
                          const deploymentApi = new ConvexDeploymentAPI(
                            project.convexDeployment.convexDeploymentUrl,
                            deployKey,
                          );

                          // Build env vars to set
                          const envVarsToSet: Record<string, string> = {};

                          // If AI specified envVarName, use it for the primary key
                          if (envVarName) {
                            // Get the first key value from parsed.keys
                            const keyValue =
                              parsed.keys.apiKey ||
                              parsed.keys.secretKey ||
                              Object.values(parsed.keys)[0];
                            if (typeof keyValue === "string" && keyValue) {
                              envVarsToSet[envVarName] = keyValue;
                            }
                          }

                          // If fields config has envVarName per field, use those
                          if (
                            Array.isArray(fieldsConfig) &&
                            fieldsConfig.length > 0
                          ) {
                            for (const field of fieldsConfig) {
                              if (field.envVarName && parsed.keys[field.key]) {
                                envVarsToSet[field.envVarName] =
                                  parsed.keys[field.key];
                              }
                            }
                          }

                          // Set all env vars if we have any
                          if (Object.keys(envVarsToSet).length > 0) {
                            const envResult =
                              await deploymentApi.setEnvironmentVariables(
                                envVarsToSet,
                              );

                            keysSetInConvex = envResult.success;
                            envVarsSet.push(...Object.keys(envVarsToSet));

                            req.logger?.info({
                              msg: "HITL: API keys set in Convex env",
                              provider,
                              envVarName,
                              envVars: Object.keys(envVarsToSet),
                              success: envResult.success,
                              projectId,
                            });
                          } else {
                            req.logger?.warn({
                              msg: "HITL: No envVarName specified, keys not saved to Convex",
                              provider,
                              hint: "AI should specify envVarName parameter in requestApiKeys",
                            });
                          }
                        }
                      } catch (envError) {
                        req.logger?.warn({
                          msg: "HITL: Failed to set API keys in Convex",
                          provider,
                          error:
                            envError instanceof Error
                              ? envError.message
                              : String(envError),
                        });
                      }

                      const nextStepMessage =
                        provider === "stripe"
                          ? "Stripe key received. IMPORTANT: You must pass stripeSecretKey to ALL Stripe execution tools. NEXT: Call stripeCreateProductAndPrice with the stripeSecretKey, then after approval call executeStripeCreateProductAndPrice with the same stripeSecretKey."
                          : keysSetInConvex
                            ? `${provider} API key(s) received and saved to Convex environment variables: ${envVarsSet.join(", ")}. You can now use these in your Convex actions.`
                            : "API keys received. Proceed with integration.";

                      hitlResultMessage = JSON.stringify({
                        success: true,
                        keys: parsed.keys,
                        // Include stripeSecretKey at top level for AI to easily access
                        stripeSecretKey: stripeKey,
                        provider,
                        keysSetInConvex,
                        envVarsSet,
                        message: nextStepMessage,
                      });
                      hitlProcessed = true;
                      hitlToolCallId = toolCallId;
                      hitlResultType = "api-keys";
                    }
                  } catch {
                    // Not JSON, ignore
                  }
                }
                continue;
              }

              // Look for Stripe HITL tool parts
              const isStripeHitlTool =
                typedPart.type === "tool-stripeListProducts" ||
                typedPart.type === "tool-stripeListPrices" ||
                typedPart.type === "tool-stripeCreateProductAndPrice" ||
                typedPart.toolName === "stripeListProducts" ||
                typedPart.toolName === "stripeListPrices" ||
                typedPart.toolName === "stripeCreateProductAndPrice";

              if (isStripeHitlTool) {
                req.logger?.info({
                  msg: "HITL: Detected Stripe HITL tool",
                  toolName: typedPart.toolName,
                  type: typedPart.type,
                });

                const toolCallId =
                  typedPart.toolCallId || typedPart.toolInvocationId;
                if (!toolCallId) {
                  req.logger?.warn({
                    msg: "HITL: Stripe tool has no toolCallId",
                  });
                  continue;
                }

                const output = typedPart.output;
                req.logger?.info({
                  msg: "HITL: Stripe tool output",
                  hasOutput: !!output,
                  outputType: typeof output,
                  outputPreview:
                    typeof output === "string"
                      ? output.substring(0, 200)
                      : "not-string",
                });

                // Parse the output - frontend now sends JSON with confirmed status and original args
                let parsedOutput: Record<string, any> | null = null;
                if (typeof output === "string") {
                  try {
                    parsedOutput = JSON.parse(output);
                  } catch {
                    // Not JSON, check for simple yes/no
                  }
                }

                // Skip if already processed (has executeNow: true from previous processing)
                if (
                  parsedOutput?.executeNow === true ||
                  parsedOutput?.success === true
                ) {
                  continue;
                }

                // Check if user approved the Stripe operation
                // Frontend sends { confirmed: true, ...originalArgs }
                const isConfirmed =
                  parsedOutput?.confirmed === true ||
                  output === "yes" ||
                  output === "confirmed" ||
                  output === SHIPPER_CLOUD_APPROVAL.YES;

                const isDenied =
                  parsedOutput?.confirmed === false ||
                  output === "no" ||
                  output === "denied" ||
                  output === SHIPPER_CLOUD_APPROVAL.NO;

                if (isConfirmed && parsedOutput) {
                  // Use stripeSecretKey from payload first, then fall back to extracted key
                  let stripeSecretKey =
                    parsedOutput.stripeSecretKey || extractedStripeKey;

                  req.logger?.info({
                    msg: "HITL: Stripe key source check",
                    fromPayload: !!parsedOutput.stripeSecretKey,
                    fromExtracted: !!extractedStripeKey,
                    hasKey: !!stripeSecretKey,
                  });

                  req.logger?.info({
                    msg: "HITL: Stripe operation approved - passing args back to AI",
                    toolCallId,
                    toolName: typedPart.toolName,
                    hasStripeSecretKey: !!stripeSecretKey,
                    parsedOutputKeys: Object.keys(parsedOutput),
                  });

                  // Pass the confirmed status and all original args back to the AI
                  // Include stripeSecretKey from history if it was missing
                  hitlResultMessage = JSON.stringify({
                    confirmed: true,
                    executeNow: true,
                    ...parsedOutput,
                    // Ensure stripeSecretKey is included (from payload or history)
                    stripeSecretKey:
                      stripeSecretKey || parsedOutput.stripeSecretKey,
                  });

                  // Log the key we're sending (partial for security)
                  const finalKey =
                    stripeSecretKey || parsedOutput.stripeSecretKey;
                  req.logger?.info({
                    msg: "HITL: Result message for AI",
                    hitlResultMessage: hitlResultMessage.substring(0, 500),
                    keyWeAreSending: finalKey
                      ? `${finalKey.substring(0, 12)}...${finalKey.substring(finalKey.length - 4)}`
                      : "NO_KEY",
                    keyLength: finalKey?.length || 0,
                  });

                  hitlProcessed = true;
                  hitlToolCallId = toolCallId;
                  hitlResultType = "stripe";
                } else if (isDenied) {
                  req.logger?.info({
                    msg: "HITL: User denied Stripe operation",
                    toolCallId,
                  });
                  hitlResultMessage = JSON.stringify({
                    confirmed: false,
                    denied: true,
                    message: "Stripe operation was denied by the user.",
                  });
                  hitlProcessed = true;
                  hitlToolCallId = toolCallId;
                  hitlResultType = "stripe";
                }
                continue;
              }

              // Look for askClarifyingQuestions tool parts (Planning Questions HITL)
              const isPlanningQuestionsTool =
                typedPart.type ===
                  `tool-${ASK_CLARIFYING_QUESTIONS_TOOL_NAME}` ||
                typedPart.toolName === ASK_CLARIFYING_QUESTIONS_TOOL_NAME;

              if (isPlanningQuestionsTool) {
                const planningToolCallId =
                  typedPart.toolCallId || typedPart.toolInvocationId;
                if (!planningToolCallId) continue;

                const output = typedPart.output;

                // Parse the output - frontend sends JSON with confirmed status and answers
                if (typeof output === "string") {
                  try {
                    const parsed = JSON.parse(output);

                    // Skip if already processed (has refinedPrompt from previous processing)
                    if (parsed.refinedPrompt || parsed.processed === true) {
                      continue;
                    }

                    // Check if user confirmed with answers
                    if (
                      parsed.confirmed &&
                      parsed.answers &&
                      Array.isArray(parsed.answers)
                    ) {
                      req.logger?.info({
                        msg: "HITL: Processing planning questions answers",
                        toolCallId: planningToolCallId,
                        answerCount: parsed.answers.length,
                      });

                      try {
                        // Process answers using refinePlanningPrompt
                        const refinedResult = await refinePlanningPrompt(
                          parsed.originalPrompt || "",
                          parsed.projectSummary || "",
                          (parsed.questions || []) as PlanningQuestion[],
                          parsed.answers as PlanningAnswer[],
                          userId,
                        );

                        // Return the processed result to the AI
                        hitlResultMessage = JSON.stringify({
                          processed: true,
                          confirmed: true,
                          refinedPrompt: refinedResult.refinedPrompt,
                          summary: refinedResult.summary,
                          keyFeatures: refinedResult.keyFeatures,
                          targetAudience: refinedResult.targetAudience,
                          designPreferences: refinedResult.designPreferences,
                          instruction:
                            "NOW GENERATE A DETAILED IMPLEMENTATION PLAN based on the refined requirements above. Use headers with emojis, organize by features, and be specific about pages and components.",
                        });

                        req.logger?.info({
                          msg: "HITL: Planning questions processed successfully",
                          toolCallId: planningToolCallId,
                          summaryLength: refinedResult.summary.length,
                          featureCount: refinedResult.keyFeatures.length,
                        });

                        hitlProcessed = true;
                        hitlToolCallId = planningToolCallId;
                        hitlResultType = "planning";
                      } catch (refineError) {
                        req.logger?.error({
                          msg: "HITL: Failed to refine planning prompt",
                          error:
                            refineError instanceof Error
                              ? refineError.message
                              : String(refineError),
                        });

                        // Fall back to simpler approach
                        hitlResultMessage = JSON.stringify({
                          processed: true,
                          confirmed: true,
                          originalPrompt: parsed.originalPrompt,
                          answers: parsed.answers,
                          projectSummary: parsed.projectSummary,
                          instruction:
                            "The user answered the planning questions. NOW GENERATE A DETAILED IMPLEMENTATION PLAN based on their answers.",
                        });
                        hitlProcessed = true;
                        hitlToolCallId = planningToolCallId;
                        hitlResultType = "planning";
                      }
                    }
                  } catch (e) {
                    // Not JSON, ignore, but log for debugging purposes
                    req.logger?.debug({
                      msg: "HITL: Planning questions output was not valid JSON, ignoring",
                      output:
                        typeof output === "string"
                          ? output.substring(0, 100)
                          : output,
                      error: e instanceof Error ? e.message : String(e),
                    });
                  }
                }
                continue;
              }

              // Look for deployToShipperCloud tool parts
              const isShipperCloudTool =
                typedPart.type === "tool-deployToShipperCloud" ||
                typedPart.toolName === "deployToShipperCloud";

              if (!isShipperCloudTool) continue;

              const toolCallId =
                typedPart.toolCallId || typedPart.toolInvocationId;
              if (!toolCallId) continue;

              const output = typedPart.output;

              // Check if this is a pending confirmation (user responded via addToolResult)
              if (output === SHIPPER_CLOUD_APPROVAL.YES) {
                req.logger?.info({
                  msg: "HITL: Processing Shipper Cloud confirmation",
                  toolCallId,
                });

                const toolInput = typedPart.input || typedPart.args;
                const projectName = toolInput?.projectName || project.name;

                try {
                  const deploymentResult =
                    await executeShipperCloudDeploymentWithFiles(
                      projectId,
                      userId,
                      projectName,
                    );
                  if (!deploymentResult.success) {
                    // Deployment returned failure (e.g., webhook setup failed)
                    hitlDeploymentFailed = true;
                    hitlResultMessage = formatDeploymentError(
                      new Error(deploymentResult.error || "Deployment failed"),
                    );
                  } else {
                    hitlResultMessage =
                      formatDeploymentSuccess(deploymentResult);
                  }
                } catch (error) {
                  req.logger?.error({
                    msg: "HITL: Deployment failed",
                    error:
                      error instanceof Error ? error.message : String(error),
                  });
                  hitlDeploymentFailed = true;
                  hitlResultMessage = formatDeploymentError(error);
                }

                hitlProcessed = true;
                hitlToolCallId = toolCallId;
                hitlResultType = "deployment";
              } else if (output === SHIPPER_CLOUD_APPROVAL.NO) {
                req.logger?.info({
                  msg: "HITL: User declined Shipper Cloud deployment",
                  toolCallId,
                });
                hitlResultMessage =
                  "Shipper Cloud deployment was cancelled by the user.";
                hitlProcessed = true;
                hitlToolCallId = toolCallId;
                hitlResultType = "deployment";
              } else if (
                output !== null &&
                typeof output === "object" &&
                ("success" in (output as Record<string, unknown>) ||
                  "error" in (output as Record<string, unknown>))
              ) {
                // Already processed in a previous request
                hitlProcessed = true;
              }
            }
          }

          // If HITL was just processed, update the message in the database with the result
          if (hitlProcessed && hitlToolCallId && hitlResultMessage) {
            for (const msg of rawMessages) {
              if (msg.role !== "ASSISTANT") continue;

              let parts;
              try {
                parts = JSON.parse(msg.content);
              } catch {
                continue;
              }

              if (!Array.isArray(parts)) continue;

              let updated = false;
              for (const part of parts) {
                const typedPart = part as {
                  type?: string;
                  toolName?: string;
                  toolCallId?: string;
                  toolInvocationId?: string;
                  output?: unknown;
                };
                const isShipperCloudTool =
                  typedPart.type === "tool-deployToShipperCloud" ||
                  typedPart.toolName === "deployToShipperCloud";
                const isApiKeysTool =
                  typedPart.type === "tool-requestApiKeys" ||
                  typedPart.toolName === "requestApiKeys";
                const isStripeHitlTool =
                  typedPart.type === "tool-stripeListProducts" ||
                  typedPart.type === "tool-stripeListPrices" ||
                  typedPart.type === "tool-stripeCreateProductAndPrice" ||
                  typedPart.toolName === "stripeListProducts" ||
                  typedPart.toolName === "stripeListPrices" ||
                  typedPart.toolName === "stripeCreateProductAndPrice";
                const isPlanningQuestionsTool =
                  typedPart.type ===
                    `tool-${ASK_CLARIFYING_QUESTIONS_TOOL_NAME}` ||
                  typedPart.toolName === ASK_CLARIFYING_QUESTIONS_TOOL_NAME;
                const partToolCallId =
                  typedPart.toolCallId || typedPart.toolInvocationId;

                if (
                  (isShipperCloudTool ||
                    isApiKeysTool ||
                    isStripeHitlTool ||
                    isPlanningQuestionsTool) &&
                  partToolCallId === hitlToolCallId
                ) {
                  // Update the output with the result
                  typedPart.output = hitlResultMessage;
                  updated = true;
                  break;
                }
              }

              if (updated) {
                await prisma.v2Message.update({
                  where: { id: msg.id },
                  data: { content: JSON.stringify(parts) },
                });
                req.logger?.info({
                  msg: "HITL: Updated message with deployment result",
                  messageId: msg.id,
                });
                break;
              }
            }
          }

          // If Shipper Cloud deployment failed, abort the stream and return error
          if (hitlDeploymentFailed && hitlResultMessage) {
            req.logger?.error({
              msg: "HITL: Shipper Cloud deployment failed, aborting stream",
              projectId,
              error: hitlResultMessage,
            });

            // Throw error to abort the stream
            throw new Error(
              `Shipper Cloud deployment failed: ${hitlResultMessage}`,
            );
          }

          // Convert database messages to UIMessage format
          const uiMessages = rawMessages.map((msg) => {
            const parsedContent = JSON.parse(msg.content);

            // parsedContent is the parts array directly
            let parts = parsedContent;

            // Log if we have image parts in loaded messages
            if (msg.role === "USER" && Array.isArray(parts)) {
              const imageParts = parts.filter(
                (p: any) =>
                  p.type === "file" && p.mediaType?.startsWith("image/"),
              );
              if (imageParts.length > 0) {
                req.logger?.info({
                  msg: "📥 Loaded preset images from database",
                  messageId: msg.id,
                  imageCount: imageParts.length,
                  images: imageParts.map((p: any) => ({
                    url: p.url,
                    mediaType: p.mediaType,
                    name: (p as any).name,
                  })),
                });
              }
            }

            // CRITICAL: Filter out UI-specific tool parts from assistant messages
            // The AI SDK's convertToModelMessages doesn't recognize custom tool part types
            // like "tool-writeFile", "tool-createOrEditFiles", etc.
            // These are UI-specific representations that shouldn't be sent to the model
            //
            // EXCEPTION: Keep "tool-invocation" parts - these are standard AI SDK format
            // and are needed for HITL (human-in-the-loop) processing
            if (msg.role === "ASSISTANT" && Array.isArray(parts)) {
              const projectLog = createProjectLogger(projectId);
              const originalPartTypes = parts.map(
                (p: { type: string }) => p.type,
              );
              const filteredOutParts: string[] = [];

              parts = parts.filter((part: { type: string }) => {
                // Filter out ALL tool-related parts (they start with "tool-" or "step-")
                // The AI SDK's convertToModelMessages has issues with custom tool formats
                // causing "tool_use ids without tool_result blocks" errors
                // HITL results are communicated via synthetic user messages instead
                if (
                  typeof part.type === "string" &&
                  (part.type.startsWith("tool-") ||
                    part.type.startsWith("step-"))
                ) {
                  filteredOutParts.push(part.type);
                  return false;
                }
                // Keep all other part types (text, file, etc.)
                return true;
              });

              // Log filtering details for debugging
              if (filteredOutParts.length > 0) {
                projectLog.debug(
                  {
                    messageId: msg.id,
                    filteredCount: filteredOutParts.length,
                    filteredTypes: filteredOutParts,
                    originalTypes: originalPartTypes,
                    remainingParts: parts.length,
                  },
                  "Filtered tool parts from assistant message for AI SDK compatibility",
                );
              }

              // If filtering removed all parts from a non-empty array, add a placeholder
              if (parts.length === 0 && originalPartTypes.length > 0) {
                projectLog.debug(
                  { messageId: msg.id, originalTypes: originalPartTypes },
                  "All parts filtered from message, adding placeholder",
                );
                parts = [{ type: "text", text: "[Previous response]" }];
              }
            }

            const message: any = {
              id: msg.id,
              role: msg.role.toLowerCase(),
              parts: parts,
              createdAt: msg.createdAt,
            };

            return message;
          }) as UIMessage[];

          // Prune conversation for AI processing
          // NOTE: Shipper Cloud HITL is now handled via the tool's execute function
          // which returns {status: "pending_confirmation"} and the user sends a new message to confirm
          let prunedMessages = contextManager.pruneConversation(uiMessages);

          // Get base URL for converting relative image URLs to absolute URLs
          const baseUrl =
            process.env.NEXT_PUBLIC_APP_URL || "https://staging.shipper.now"; // Fallback for local development

          // CRITICAL: Remove ALL document file parts from ALL messages before sending to AI SDK
          // Documents stay in the database for UI display, but AI SDK should NEVER receive them
          // (Analysis text is injected separately)
          // Also remove preset styling images (relative URLs starting with "/") - they go in system prompt, not message parts
          let totalDocumentsRemoved = 0;
          let totalPresetImagesRemoved = 0;

          prunedMessages = prunedMessages.map((msg) => {
            if (msg.role === "user") {
              const processedParts: any[] = [];

              for (const part of msg.parts) {
                // Keep text parts as-is
                if (part.type !== "file") {
                  processedParts.push(part);
                  continue;
                }

                // Process file parts
                const isImage = part.mediaType?.startsWith("image/");
                const isVideo = part.mediaType?.startsWith("video/");
                const isAudio = part.mediaType?.startsWith("audio/");

                // Handle images specially: preset images (relative URLs) go in system prompt, not message parts
                if (isImage) {
                  // Preset images have relative URLs starting with "/" - these go in system prompt
                  if (part.url?.startsWith("/")) {
                    totalPresetImagesRemoved++;
                    req.logger?.info({
                      msg: "🎨 Removing preset image from message parts (will be added to system prompt)",
                      relativeUrl: part.url,
                      mediaType: part.mediaType,
                      name: (part as any).name,
                    });
                    // Don't add to processedParts - it will be in system prompt instead
                    continue;
                  }
                  // Uploaded images (absolute URLs) can stay in message parts
                  processedParts.push(part);
                  continue;
                }

                // Keep videos and audio in message parts
                if (isVideo || isAudio) {
                  processedParts.push(part);
                  continue;
                }

                // Remove documents and archives (they're analyzed separately)
                totalDocumentsRemoved++;
                req.logger?.debug({
                  msg: "Removing document file from AI context",
                  mediaType: part.mediaType,
                  name: (part as any).name,
                });
              }

              // Log what we're sending to AI
              const uploadedImageCount = processedParts.filter(
                (p: any) =>
                  p.type === "file" && p.mediaType?.startsWith("image/"),
              ).length;

              if (uploadedImageCount > 0) {
                req.logger?.info({
                  msg: "📸 Uploaded images being sent to AI in message parts",
                  imageCount: uploadedImageCount,
                  messageId: msg.id,
                  imageUrls: processedParts
                    .filter(
                      (p: any) =>
                        p.type === "file" && p.mediaType?.startsWith("image/"),
                    )
                    .map((p: any) => p.url),
                });
              }

              return { ...msg, parts: processedParts };
            }
            return msg;
          });

          if (totalDocumentsRemoved > 0 || totalPresetImagesRemoved > 0) {
            req.logger?.info({
              msg: "Processed file parts for AI SDK",
              totalDocumentsRemoved,
              totalPresetImagesRemoved,
              note:
                totalPresetImagesRemoved > 0
                  ? "Preset images removed from message parts (will be added to system prompt)"
                  : undefined,
              messagesModified: prunedMessages.filter(
                (msg) =>
                  msg.role === "user" &&
                  msg.parts.every(
                    (p: any) =>
                      p.type !== "file" ||
                      (p.mediaType !== "application/pdf" &&
                        p.mediaType !==
                          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
                  ),
              ).length,
            });
          }

          // If we have document analysis for the CURRENT upload, inject it into the last user message
          if (documentAnalysisText && prunedMessages.length > 0) {
            const lastMessage = prunedMessages[prunedMessages.length - 1];
            if (lastMessage.role === "user") {
              // Add document analysis as text to the current message
              lastMessage.parts = [
                ...lastMessage.parts,
                {
                  type: "text" as const,
                  text: `\n\n[Document Analysis]:\n${documentAnalysisText}`,
                },
              ];

              req.logger?.info({
                msg: "Document analysis injected into AI context (all documents stripped from conversation)",
                analysisLength: documentAnalysisText.length,
                messagePartsCount: lastMessage.parts.length,
                lastMessagePreview: JSON.stringify(
                  lastMessage.parts.map((p) => ({
                    type: p.type,
                    textPreview:
                      p.type === "text" ? p.text?.substring(0, 100) : undefined,
                    hasFile: p.type === "file",
                  })),
                ),
              });
            } else {
              req.logger?.warn({
                msg: "Last message is not a user message, cannot inject document analysis",
                lastMessageRole: lastMessage.role,
              });
            }
          } else {
            req.logger?.warn({
              msg: "Cannot inject document analysis",
              hasAnalysis: !!documentAnalysisText,
              hasMessages: prunedMessages.length > 0,
            });
          }

          // Initialize fragment files
          let initialFiles: Record<string, string> = {};
          let workingFragmentId = project.activeFragmentId || undefined;

          // Create new working fragment for user messages
          if (message.role === "user") {
            // Load existing fragment files if available
            if (project.activeFragmentId) {
              req.logger?.info({
                msg: "Loading active fragment",
                fragmentId: project.activeFragmentId,
              });

              const activeFragment = await prisma.v2Fragment.findUnique({
                where: { id: project.activeFragmentId },
                select: { files: true, title: true },
              });

              if (activeFragment && activeFragment.files) {
                const files = activeFragment.files as Record<string, string>;
                // DO NOT optimize/truncate files when creating new fragments!
                // optimizeFragmentFiles is only for reducing context sent to AI,
                // NOT for persisting data (that would cause permanent data loss)
                initialFiles = files;
                req.logger?.info({
                  msg: "Fragment files loaded (unmodified)",
                  fileCount: Object.keys(files).length,
                });
              }
            }

            // Create new working fragment with "Work in progress" title
            // The AI will provide a descriptive title when it finalizes via finalizeWorkingFragment
            const timestamp = new Date().toLocaleString();
            const fragmentTitle = `Work in progress - ${timestamp}`;

            const workingFragment = await prisma.v2Fragment.create({
              data: {
                title: fragmentTitle,
                files: initialFiles,
                projectId,
              },
            });

            workingFragmentId = workingFragment.id;

            // Update project's activeFragmentId
            await prisma.project.update({
              where: { id: projectId },
              data: { activeFragmentId: workingFragment.id },
            });

            req.logger?.info({
              msg: "Working fragment created",
              fragmentId: workingFragment.id,
              fragmentTitle,
            });
          }

          // Initialize fragment files map
          const fragmentFilesMap = new Map<string, string>();
          if (workingFragmentId && Object.keys(initialFiles).length > 0) {
            Object.entries(initialFiles).forEach(([path, content]) => {
              fragmentFilesMap.set(path, content);
            });
            req.logger?.info({
              msg: "Fragment context initialized",
              fileCount: fragmentFilesMap.size,
            });
          }

          // Initialize tools context
          toolsContext = {
            projectId,
            userId,
            sandbox: null,
            sandboxId: null,
            sandboxUrl: null,
            files: new Map(),
            fragmentFiles: fragmentFilesMap,
            currentFragmentId: workingFragmentId,
            traceId: streamId,
            lspServers: new Map(),
            todos: [],
            logger: req.logger || undefined, // Pass logger from request context
            isImportedProject: isImported, // Track if this is an imported project
            hasCalledGetFiles: false, // Track if getFiles has been called (required for imports)
          };

          // In chat mode, only skip sandbox on the first message (planning phase)
          // After that, we need the sandbox for building
          const isFirstMessageInChatMode =
            chatMode &&
            !uiMessages.some((msg: UIMessage) => msg.role === "assistant");

          if (!isFirstMessageInChatMode) {
            // Ensure sandbox is available and healthy
            const fragmentIdForRecovery =
              toolsContext.currentFragmentId ||
              project.activeFragmentId ||
              null;

            const recoveryResult = await ensureSandboxRecovered(projectId, {
              fragmentId: fragmentIdForRecovery,
              templateName: selectedTemplate,
              logger: req.logger || undefined,
            });

            req.logger?.info({
              msg: "Sandbox recovery check complete",
              projectId,
              fragmentId: fragmentIdForRecovery,
              recovered: recoveryResult.recovered,
            });

            req.logger?.info("Setting up sandbox");
            const sandboxInfo = await getSandbox(projectId, req.logger);

            if (!sandboxInfo) {
              req.logger?.error({
                msg: "Sandbox unavailable after recovery",
                projectId,
                fragmentId: fragmentIdForRecovery,
              });
              throw new Error(
                "Sandbox is currently unavailable. Please retry the request in a few seconds.",
              );
            }

            // Update tools context with sandbox info
            toolsContext.sandbox = sandboxInfo.sandbox;
            toolsContext.sandboxId = sandboxInfo.sandboxId;
            toolsContext.sandboxUrl = sandboxInfo.sandboxUrl;
            toolsContext.files = sandboxInfo.files;

            // Sync any uploaded images to sandbox's public/images folder
            // This ensures user-uploaded images from chat are available in the project
            try {
              const uploadService = new UploadService();
              const syncResult =
                await uploadService.syncProjectUploadsToSandbox(
                  projectId,
                  sandboxInfo.sandboxId,
                );
              if (syncResult.synced > 0) {
                req.logger?.info({
                  msg: "Synced uploaded images to sandbox",
                  projectId,
                  synced: syncResult.synced,
                  failed: syncResult.failed,
                });
              }
            } catch (syncError) {
              // Don't fail the chat if sync fails
              req.logger?.warn({
                msg: "Failed to sync uploaded images to sandbox",
                projectId,
                error:
                  syncError instanceof Error
                    ? syncError.message
                    : String(syncError),
              });
            }
          } else {
            req.logger?.info({
              msg: "Chat mode first message - skipping sandbox setup (planning phase)",
              projectId,
            });
          }

          // Determine which model to use based on environment and complexity analysis
          // First message: Opus (best quality, 10% margin)
          // Follow-up messages use complexity analysis:
          // - advanced (major rehauls) → Opus (50% margin)
          // - complex/moderate → Sonnet (50% margin)
          // - simple → Haiku (cheapest, 50% margin)
          const userMessages = prunedMessages.filter((m) => m.role === "user");
          const isFirstUserMessage = userMessages.length === 1;

          // Determine model and pricing based on context
          let modelToUse: string;
          let pricingToUse: typeof ANTHROPIC_PRICING_HAIKU;
          let isFirstPromptPricing = false; // Track if we use 10% margin

          // Use production models if NODE_ENV is production OR USE_PRODUCTION_MODELS is set
          const useProductionModels =
            process.env.NODE_ENV === "production" ||
            process.env.USE_PRODUCTION_MODELS === "true";

          // Check if this is a HITL continuation for a backend-related tool
          const isBackendHitlContinuation =
            hitlProcessed &&
            (hitlResultType === "deployment" ||
              hitlResultType === "stripe" ||
              hitlResultType === "api-keys");

          if (!useProductionModels) {
            // Development: always use Haiku for cost savings
            modelToUse = DEV_MODEL;
            pricingToUse = ANTHROPIC_PRICING_HAIKU;
          } else if (isFirstUserMessage) {
            // First prompt: Opus with 10% margin
            modelToUse = MODEL_OPUS;
            pricingToUse = ANTHROPIC_PRICING_OPUS;
            isFirstPromptPricing = true;
          } else if (isBackendHitlContinuation) {
            // HITL continuation for backend tools (Shipper Cloud, Stripe, API keys, AI): use Opus
            modelToUse = MODEL_OPUS;
            pricingToUse = ANTHROPIC_PRICING_OPUS;
          } else if (complexityAnalysis?.isBackendTask) {
            // Backend tasks (database, auth, API, Convex): always use Opus
            modelToUse = MODEL_OPUS;
            pricingToUse = ANTHROPIC_PRICING_OPUS;
          } else if (complexityAnalysis?.category === "advanced") {
            // Major rehauls: Opus with 50% margin
            modelToUse = MODEL_OPUS;
            pricingToUse = ANTHROPIC_PRICING_OPUS;
          } else if (
            complexityAnalysis?.category === "complex" ||
            complexityAnalysis?.category === "moderate"
          ) {
            // Complex/moderate: Sonnet with 50% margin
            modelToUse = MODEL_SONNET;
            pricingToUse = ANTHROPIC_PRICING_SONNET;
          } else {
            // Simple: Haiku (cheapest) with 50% margin
            modelToUse = MODEL_HAIKU;
            pricingToUse = ANTHROPIC_PRICING_HAIKU;
          }

          req.logger?.info({
            msg: "Model selected for chat",
            model: modelToUse,
            isFirstUserMessage,
            isFirstPromptPricing,
            isBackendTask: complexityAnalysis?.isBackendTask || false,
            isBackendHitlContinuation,
            hitlResultType,
            marginApplied: isFirstPromptPricing ? "10%" : "50%",
            environment: process.env.NODE_ENV || "development",
            complexity: complexityAnalysis?.category || "unknown",
            complexityScore: complexityAnalysis?.complexity,
            cachingNote:
              "Native Anthropic prompt caching enabled - static system prompt will be cached across all steps and requests",
          });

          // Reset cost and step tracking for this execution
          builderAnthropicCost = 0;
          stepCount = 0;
          let wasCancelled = false;
          let creditsAlreadyDeducted = false; // Flag to prevent double-deduction on abort

          // Create assistant message record early for incremental saving
          // This ensures work is preserved even if the stream is interrupted
          assistantMessageId = generateId();
          await prisma.v2Message.create({
            data: {
              id: assistantMessageId,
              role: "ASSISTANT",
              content: JSON.stringify([]), // Start with empty parts
              projectId,
              createdAt: new Date(),
            },
          });

          req.logger?.info({
            msg: "Assistant message record created for incremental saving",
            messageId: assistantMessageId,
          });

          // Upfront credit check - ensure workspace has at least minimum credits before starting
          // This catches insufficient credits early and provides better UX
          if (message.role === "user") {
            // 🏢 WORKSPACE-CENTRIC: Check workspace credits
            if (!workspaceId) {
              throw new Error(
                "No workspace found for project - cannot check credits",
              );
            }
            const affordability =
              await CreditManager.canWorkspaceAffordOperation(workspaceId, 1);
            if (!affordability.canAfford) {
              req.logger?.warn({
                msg: "Insufficient credits - blocking generation",
                userId,
                workspaceId,
                projectId,
                reason: affordability.reason,
                currentBalance: affordability.currentBalance,
              });

              throw new Error(
                `Insufficient credits. ${affordability.reason}. Please purchase more credits to continue.`,
              );
            }
          }

          // Inject code import context for imported projects
          // This provides the AI with context about the imported codebase
          if (isImported) {
            const importContextMessages = getCodeImportContext(project);
            if (importContextMessages.length > 0) {
              req.logger?.info({
                msg: "Injecting code import context",
                projectId,
                framework: project.codeImport?.detectedFramework,
                fileCount: project.codeImport?.fileCount,
              });
              // Prepend import context to the beginning of the conversation
              prunedMessages = [...importContextMessages, ...prunedMessages];
            }
          }

          // If HITL was processed earlier (on raw messages), inject the result as a synthetic user message
          // This informs the AI about the result without using tool_use/tool_result
          let finalMessages = prunedMessages;
          if (hitlProcessed && hitlResultMessage) {
            // Determine the appropriate label based on what was processed
            const resultLabel =
              hitlResultType === "api-keys"
                ? "API Keys Received"
                : hitlResultType === "stripe"
                  ? "Stripe Operation Result"
                  : "Shipper Cloud Deployment Result";

            req.logger?.info({
              msg: `HITL ${hitlResultType} processed, injecting result message`,
              projectId,
              hitlResultType,
              resultPreview: hitlResultMessage.substring(0, 100),
            });

            // Add synthetic user message with the HITL result
            finalMessages = [
              ...prunedMessages,
              {
                id: generateId(),
                role: "user",
                parts: [
                  {
                    type: "text" as const,
                    text: `[System: ${resultLabel}]\n${hitlResultMessage}`,
                  },
                ],
                createdAt: new Date(),
              } as UIMessage,
            ];
          }

          // Start AI streaming
          // Convert messages to model format
          const modelMessages = convertToModelMessages(finalMessages);

          // Log image parts in messages for debugging
          const imagePartsInMessages = prunedMessages
            .flatMap((msg) =>
              msg.parts
                .filter(
                  (p: any) =>
                    p.type === "file" && p.mediaType?.startsWith("image/"),
                )
                .map((p: any) => ({
                  messageId: msg.id,
                  role: msg.role,
                  url: p.url,
                  mediaType: p.mediaType,
                  name: p.name,
                })),
            )
            .filter(Boolean);

          if (imagePartsInMessages.length > 0) {
            req.logger?.info({
              msg: "Image parts found in messages being sent to AI",
              imageCount: imagePartsInMessages.length,
              images: imagePartsInMessages,
            });
          } else {
            req.logger?.debug({
              msg: "No image parts found in messages being sent to AI",
              totalMessages: prunedMessages.length,
              messageParts: prunedMessages.map((m) => ({
                role: m.role,
                partsCount: m.parts.length,
                partTypes: m.parts.map((p: any) => p.type),
              })),
            });
          }

          // Get the static base prompt (this is large and should be cached)
          const baseSystemPrompt = getFullStackPrompt();

          // Extract styling preset image if present (before processing messages)
          const stylingImageUrl = await extractStylingImageUrl(
            message,
            prunedMessages,
            req.logger,
          );

          // Check if user attached files in their message
          const lastUserMessage = prunedMessages[prunedMessages.length - 1];
          const hasFiles =
            lastUserMessage?.role === "user" &&
            lastUserMessage.parts?.some((part: any) => part.type === "file");

          const fileContext = hasFiles
            ? `\n\nFILE ATTACHMENTS:
The user has attached ${lastUserMessage.parts.filter((p: any) => p.type === "file").length} file(s) to their message.
These files may include:
- Images (for design reference, color schemes, layouts, or visual elements)
- PDFs or DOCX documents (for specifications, requirements, or content)
- Code files (for reference implementations or examples)
- Text files (for data, configurations, or documentation)

IMPORTANT: Analyze these files to understand the user's requirements and use them to inform your implementation decisions.
DO NOT echo, quote, or reproduce the file contents in your response. Only reference what you learned from them.`
            : "";

          // Tools that modify the codebase - used for mid-build chat mode detection
          const MODIFICATION_TOOLS = [
            "createOrEditFiles",
            "quickEdit",
            "installPackages",
            "finalizeWorkingFragment",
            "createFragmentSnapshot",
            "deployToShipperCloud",
            "deployConvex",
            "scaffoldConvexSchema",
            "runConvexMutation",
            "executeStripeCreateProductAndPrice",
            "setupStripePayments",
            "enableAI",
            "generateImage",
            "executeStripeListProducts",
            "executeStripeListPrices",
            "notionWorkspace",
            "requestApiKeys",
            "stripeCreateProductAndPrice",
          ];

          // Detect if building has already started (any modification tools used in conversation)
          const hasBuildStarted = uiMessages.some((msg: UIMessage) => {
            if (msg.role === "assistant" && Array.isArray(msg.parts)) {
              return msg.parts.some(
                (part: { type?: string }) =>
                  part.type?.startsWith("tool-") &&
                  MODIFICATION_TOOLS.some(
                    (tool) => part.type === `tool-${tool}`,
                  ),
              );
            }
            return false;
          });

          // Determine chat mode type:
          // - Initial planning: chatMode ON, no builds yet -> ask questions flow
          // - Mid-build chat: chatMode ON, builds have happened -> chat only, no modifications
          const isMidBuildChat = chatMode && hasBuildStarted;

          // Chat mode instructions - different behavior based on when it's activated
          const chatModeInstructions = chatMode
            ? isMidBuildChat
              ? `

CHAT MODE - CONVERSATION ONLY:

You are in Chat Mode. The user wants to discuss, ask questions, or get help without making changes to the code.

STRICT RULES:
- You CAN read files and inspect the codebase using getFiles and readFile
- You CAN explain code, suggest improvements, and help debug
- You CANNOT create, edit, or delete any files
- You CANNOT run commands or install packages
- You CANNOT deploy or make any modifications

WHAT YOU CAN DO:
- Answer questions about the code
- Explain how specific functions or components work
- Suggest improvements or fixes (describe them in detail, but don't implement)
- Help debug by reading files and analyzing the code
- Propose implementation plans and architecture decisions
- Discuss best practices and alternatives

When the user is ready to implement changes, tell them:
"When you're ready, click the Start Building button and I'll get started!"
`
              : `

CHAT MODE - PLANNING PHASE:

STEP 1 - ASK QUESTIONS (on first message with no prior tool results):
- Call "askClarifyingQuestions" tool immediately
- Output NOTHING else - just call the tool and stop
- The user will answer via UI

STEP 2 - GENERATE PLAN (when you receive the processed tool result):
The tool result will contain a processed/refined version of the user's requirements:
{
  "processed": true,
  "refinedPrompt": "...",  // Enhanced prompt with all requirements incorporated
  "summary": "...",        // Brief summary of what will be built
  "keyFeatures": [...],    // List of key features to implement
  "targetAudience": "...", // Who will use it
  "designPreferences": "...", // Style preferences
  "instruction": "..."     // Action to take
}

When you see this result:
- Write a CONCISE plan that focuses on WHAT the user will see and do (not how it's built)
- Use a header with an emoji (e.g., "🎭 Project Name")
- Start with a brief 1-2 sentence summary of what you understood
- List the main screens/pages users will interact with
- For each screen, briefly describe what they can do there
- If there's an admin side, mention it briefly
- Keep it SHORT - aim for a quick read, not a detailed spec
- End with: "Does this look right? Let me know if you want to change anything, or click the Start Building button and I'll get started!"

IMPORTANT PLAN FORMATTING RULES:
- DO NOT mention technical details (databases, APIs, authentication systems, frameworks)
- DO NOT include "Backend Requirements" or "Technical Stack" sections
- DO NOT mention Supabase, Stripe, Convex, or any specific technologies
- Focus ONLY on the user experience - what screens exist and what users can do
- Keep it conversational and brief, like explaining the app to a friend
- The user doesn't need to know HOW it works, just WHAT it does

IMPORTANT: The answers have been pre-processed. DO NOT ask more questions - immediately write the plan!

STEP 3 - HANDLE FEEDBACK:
- If user requests changes: Update the plan and show the revised version
- If user is happy with the plan: Remind them to click the Start Building button

STEP 4 - BUILD (only after user clicks Start Building):
- Once the user clicks the Start Building button, say "Great! Starting the build now..."
- Begin creating files and building the project using your normal tools
- This is when you actually write code and create the app

IMPORTANT: Do NOT start building until the user clicks the Start Building button!
`
            : "";

          // Fetch user's connected services for AI context
          const connectedServices = await connectorRegistry.getUserPersonalConnections(userId);
          const activeConnections = await Promise.all(
            connectedServices
              .filter(c => c.status === 'ACTIVE')
              .map(async (c) => {
                // Refresh metadata for ElevenLabs to get current plan
                if (c.provider === 'ELEVENLABS') {
                  const refreshed = await connectorRegistry.refreshPersonalConnectionMetadata(
                    userId,
                    c.provider
                  );
                  if (refreshed) {
                    return {
                      provider: c.provider.toLowerCase(),
                      plan: (refreshed.metadata.subscriptionTier as string) || 'free',
                      capabilities: refreshed.capabilities,
                    };
                  }
                }
                return {
                  provider: c.provider.toLowerCase(),
                  metadata: c.metadata,
                };
              })
          );
          
          // Build connected services context for AI
          const elevenLabsConnection = activeConnections.find(s => s.provider === 'elevenlabs');
          const hasElevenLabs = !!elevenLabsConnection;
          
          let connectedServicesContext = '';
          if (activeConnections.length > 0) {
            connectedServicesContext = `\nCONNECTED_SERVICES: ${JSON.stringify(activeConnections)}`;
            if (hasElevenLabs && elevenLabsConnection) {
              const caps = elevenLabsConnection.capabilities as Record<string, unknown> | undefined;
              connectedServicesContext += `\n🔊 ElevenLabs CONNECTED (Plan: ${elevenLabsConnection.plan || 'unknown'})`;
              connectedServicesContext += `\n   → Use useConnectedService tool to activate for this project.`;
              
              if (caps) {
                connectedServicesContext += `\n\nELEVENLABS CAPABILITIES (for reference - build freely, inform user if errors occur):`;
                const features = [];
                if (caps.voiceCloning) features.push('Voice Cloning');
                if (caps.textToSpeech) features.push('Text-to-Speech');
                if (caps.realTimeSynthesis) features.push('Real-time Synthesis');
                if (caps.speechToSpeech) features.push('Speech-to-Speech');
                if (caps.aiDubbing) features.push('AI Dubbing');
                if (caps.multilingualSupport) features.push('Multilingual');
                
                if (features.length > 0) {
                  connectedServicesContext += `\n   Available: ${features.join(', ')}`;
                }
                
                connectedServicesContext += `\n   Note: Build any features you want. If API errors (403/429) occur due to plan limits, inform user they may need to upgrade.`;
              }
            }
          }

          // Combine base prompt with project context (all cached together)
          const dynamicContext = `PROJECT CONTEXT:
You are working on the project: "${projectName}"
${fileContext}
${chatModeInstructions}
Maximum steps allowed: ${getMaxSteps(complexityAnalysis)}
Budget limit: $${HARD_BUDGET_LIMIT_USD}${connectedServicesContext}`;

          // Create system prompt with or without styling image
          // If styling image exists, use createCachedSystemPromptWithImage
          // Otherwise, use regular cached system prompt
          let systemMessages: any[];
          if (stylingImageUrl) {
            req.logger?.info({
              msg: "Using styling preset image in system prompt",
              imageUrl: stylingImageUrl.substring(0, 100), // Log preview only
            });
            systemMessages = createCachedSystemPromptWithImage(
              baseSystemPrompt,
              dynamicContext,
              stylingImageUrl,
            );
          } else {
            systemMessages = createCachedSystemPrompt(
              baseSystemPrompt,
              dynamicContext,
            );
          }

          // Prepend system messages to the conversation
          const messagesWithSystem = [...systemMessages, ...modelMessages];

          // Note: Message caching is applied in prepareStep to handle inter-step caching

          // Prepare tools - exclude certain tools based on state
          const allTools = tools(toolsContext);

          // In chat mode, only allow askClarifyingQuestions on the FIRST message
          // If there are any assistant messages already, questions have been asked
          const hasAssistantMessages = uiMessages.some(
            (msg: UIMessage) => msg.role === "assistant",
          );
          const shouldExcludeQuestionsTools = chatMode && hasAssistantMessages;

          // Note: MODIFICATION_TOOLS, hasBuildStarted, and isMidBuildChat are defined earlier
          // (around line 2499) for use in chatModeInstructions

          const shouldExcludeShipperCloudTool =
            hitlProcessed || project.shipperCloudEnabled;

          // Build list of tools to exclude
          const toolsToExclude: string[] = [];
          if (shouldExcludeShipperCloudTool) {
            toolsToExclude.push("deployToShipperCloud");
          }
          if (shouldExcludeQuestionsTools) {
            toolsToExclude.push("askClarifyingQuestions");
          }
          // In chat/plan mode, exclude ALL modification tools
          // User must click the Plan button to turn it off before AI can build
          // This applies both to initial planning AND mid-build chat
          if (chatMode) {
            toolsToExclude.push(...MODIFICATION_TOOLS);
          }

          // Determine tools to use
          let chatTools: Partial<typeof allTools>;

          // On FIRST message in chat mode (no assistant messages yet), ONLY allow askClarifyingQuestions
          // This prevents the AI from using any other tools during the planning phase
          const isFirstMessageInPlanMode = chatMode && !hasAssistantMessages;
          if (isFirstMessageInPlanMode) {
            // Only include askClarifyingQuestions - exclude ALL other tools
            chatTools = {
              askClarifyingQuestions: allTools.askClarifyingQuestions,
            };
          } else if (toolsToExclude.length > 0) {
            chatTools = Object.fromEntries(
              Object.entries(allTools).filter(
                ([name]) => !toolsToExclude.includes(name),
              ),
            );
          } else {
            chatTools = allTools;
          }

          if (shouldExcludeShipperCloudTool) {
            req.logger?.info({
              msg: "Excluding deployToShipperCloud tool",
              reason: hitlProcessed ? "HITL processed" : "already enabled",
              projectId,
            });
          }

          // Throttled cancellation check (2s interval to reduce DB load)
          const throttledCancellationCheck = throttle(() => {
            prisma.project
              .findFirst({
                where: { id: projectId },
                select: { activeStreamId: true },
              })
              .then(async (p) => {
                if (!p?.activeStreamId || p.activeStreamId !== streamId) {
                  req.logger?.info({ msg: "Stream cancelled by user" });
                  wasCancelled = true;
                  await prisma.project.update({
                    where: { id: projectId },
                    data: {
                      activeStreamId: null,
                      activeStreamStartedAt: null,
                    },
                  });
                  abortController.abort();
                }
              })
              .catch((error) => {
                req.logger?.error({
                  msg: "Error checking stream status",
                  error: error instanceof Error ? error.message : String(error),
                });
              });
          }, 2000);
          if (shouldExcludeQuestionsTools) {
            req.logger?.info({
              msg: "Excluding askClarifyingQuestions tool - not first message in chat mode",
              projectId,
              chatMode,
              hasAssistantMessages,
            });
          }

          if (isFirstMessageInPlanMode) {
            req.logger?.info({
              msg: "Plan mode - first message: ONLY askClarifyingQuestions tool available",
              projectId,
              availableTools: ["askClarifyingQuestions"],
            });
          } else if (chatMode) {
            req.logger?.info({
              msg: "Plan mode active - excluding modification tools until user clicks Plan button",
              projectId,
              excludedTools: MODIFICATION_TOOLS,
              isMidBuildChat,
              hasBuildStarted,
            });
          }

          const result = streamText({
            model: anthropic(modelToUse),
            abortSignal: abortController.signal,
            experimental_transform: smoothStream({
              delayInMs: 20, // optional: defaults to 10ms
              chunking: "line", // optional: defaults to 'word'
            }),
            // 🔴 ABLY: Broadcast chunks in real-time (NOT throttled)
            onChunk: (event) => {
              // Broadcast text chunks to all project viewers immediately
              if (event.chunk.type === "text-delta" && event.chunk.text) {
                broadcastAIChunk(
                  projectId,
                  assistantMessageId || "",
                  event.chunk.text,
                  false,
                  userId, // Pass userId for client-side filtering
                ).catch(() => {});
              } else if (
                event.chunk.type === "reasoning-delta" &&
                event.chunk.text
              ) {
                // Broadcast reasoning/thinking chunks
                broadcastAIChunk(
                  projectId,
                  assistantMessageId || "",
                  event.chunk.text,
                  true, // isThinking
                  userId, // Pass userId for client-side filtering
                ).catch(() => {});
              }

              // THROTTLED: Check for stream cancellation (2s interval to reduce DB load)
              throttledCancellationCheck();
            },
            messages: messagesWithSystem,
            tools: chatTools,
            stopWhen: [
              stepCountIs(getMaxSteps(complexityAnalysis)),

              // 🛑 HITL (Human-in-the-Loop) stop condition
              // Stop immediately when a tool returns a pending status
              // This allows the user to confirm/respond before the AI continues
              ({ steps }) => {
                if (steps.length === 0) return false;
                const lastStep = steps[steps.length - 1];
                if (!lastStep.toolResults) return false;

                // List of HITL statuses that should stop generation
                const hitlPendingStatuses = [
                  "pending_confirmation", // deployToShipperCloud
                  "pending_api_keys", // requestApiKeys
                  "pending_user_input", // askClarifyingQuestions
                  "pending_approval", // Stripe HITL tools
                ];

                for (const toolResult of lastStep.toolResults) {
                  if (!toolResult) continue;
                  const output = toolResult.output as
                    | { status?: string }
                    | undefined;
                  if (
                    output?.status &&
                    hitlPendingStatuses.includes(output.status)
                  ) {
                    req.logger?.info({
                      msg: "HITL tool returned pending status - stopping generation",
                      toolName: toolResult.toolName,
                      status: output.status,
                      step: steps.length,
                    });
                    return true;
                  }
                }
                return false;
              },

              // 🎯 Budget-based stop condition
              ({ steps }) => {
                // Calculate total cost from Anthropic token usage
                const totalCost = steps.reduce((acc, step) => {
                  const anthropicMeta = (step.providerMetadata as any)
                    ?.anthropic;
                  const stepUsage = step.usage;
                  if (anthropicMeta || stepUsage) {
                    return (
                      acc +
                      calculateAnthropicCost(
                        {
                          inputTokens: stepUsage?.inputTokens,
                          outputTokens: stepUsage?.outputTokens,
                          cacheCreationInputTokens:
                            anthropicMeta?.cacheCreationInputTokens,
                          cacheReadInputTokens:
                            anthropicMeta?.cacheReadInputTokens,
                        },
                        pricingToUse,
                      )
                    );
                  }
                  return acc;
                }, 0);

                if (totalCost >= HARD_BUDGET_LIMIT_USD) {
                  req.logger?.error({
                    msg: "HARD BUDGET LIMIT EXCEEDED - Stopping generation",
                    totalCostUSD: totalCost,
                    hardLimit: HARD_BUDGET_LIMIT_USD,
                    maxSteps: getMaxSteps(complexityAnalysis),
                    step: steps.length,
                    userId,
                    projectId,
                  });
                  return true;
                }
                return false;
              },
            ],
            experimental_telemetry: { isEnabled: true },
            onStepFinish: async ({
              toolCalls,
              toolResults,
              text,
              usage,
              providerMetadata,
            }) => {
              stepCount++;

              // Log provider metadata for cache debugging
              console.log(
                "[CACHE] Step",
                stepCount,
                "metadata:",
                JSON.stringify(providerMetadata, null, 2),
              );

              // Extract Anthropic-specific metadata for cache metrics
              const anthropicMeta = (providerMetadata as any)?.anthropic;
              const anthropicUsage = anthropicMeta?.usage;

              // Calculate cost from Anthropic token usage
              // Anthropic returns snake_case in usage object
              const stepCost = calculateAnthropicCost(
                {
                  inputTokens: usage?.inputTokens,
                  outputTokens: usage?.outputTokens,
                  cacheCreationInputTokens:
                    anthropicUsage?.cache_creation_input_tokens ||
                    anthropicMeta?.cacheCreationInputTokens,
                  cacheReadInputTokens:
                    anthropicUsage?.cache_read_input_tokens ||
                    anthropicMeta?.cacheReadInputTokens,
                },
                pricingToUse,
              );

              // Get cache read tokens for accurate cumulative tracking
              const cacheReadTokens =
                anthropicUsage?.cache_read_input_tokens ||
                anthropicMeta?.cacheReadInputTokens ||
                0;

              if (stepCost > 0) {
                builderAnthropicCost += stepCost;
                // Include cache reads in cumulative input (AI SDK excludes them from inputTokens)
                builderInputTokens +=
                  (usage?.inputTokens || 0) + cacheReadTokens;
                builderOutputTokens += usage?.outputTokens || 0;
              }

              // Check if workspace can afford the CUMULATIVE cost so far
              // This ensures we stop before exceeding what the workspace can pay
              // Use correct margin: 10% for first prompt, 50% for follow-ups
              const cumulativeCredits = isFirstPromptPricing
                ? calculateCreditsFromUSDFirstPrompt(builderAnthropicCost)
                : calculateCreditsFromUSD(builderAnthropicCost);
              // 🏢 WORKSPACE-CENTRIC: Check workspace credits
              const affordability =
                await CreditManager.canWorkspaceAffordOperation(
                  workspaceId!,
                  cumulativeCredits,
                );
              if (!affordability.canAfford) {
                req.logger?.error({
                  msg: "Insufficient credits during generation - aborting and finalizing",
                  userId,
                  projectId,
                  step: stepCount,
                  cumulativeCostUSD: builderAnthropicCost,
                  cumulativeCredits,
                  currentBalance: affordability.currentBalance,
                  reason: affordability.reason,
                });

                // IMPORTANT: Deduct what workspace can afford NOW before aborting
                // onFinish may not be called when we throw, so we must finalize here
                if (
                  builderAnthropicCost > 0 &&
                  affordability.currentBalance !== undefined
                ) {
                  const minimumBalance = CreditManager.getMinimumBalance();
                  const maxAffordable = Math.max(
                    0,
                    Math.floor(
                      (affordability.currentBalance - minimumBalance) * 100,
                    ) / 100,
                  );

                  if (maxAffordable > 0 && workspaceId) {
                    try {
                      // 🏢 WORKSPACE-CENTRIC: Always deduct from workspace
                      await CreditManager.deductWorkspaceCredits(
                        workspaceId,
                        maxAffordable,
                        "AI_GENERATION",
                        `AI Generation for "${projectName}" - ABORTED (insufficient credits after ${stepCount} steps) [charged ${maxAffordable} of ${cumulativeCredits} credits]`,
                        userId,
                        {
                          projectId,
                          projectName,
                          messageId: assistantMessageId,
                          totalSteps: stepCount,
                          totalCostUSD: builderAnthropicCost,
                          creditsCharged: maxAffordable,
                          originalCreditsRequired: cumulativeCredits,
                          abortedDueToInsufficientCredits: true,
                        },
                      );

                      creditsAlreadyDeducted = true; // Prevent double-deduction in onFinish

                      req.logger?.warn({
                        msg: "Credits deducted before abort - partial charge for work completed",
                        userId,
                        workspaceId,
                        projectId,
                        step: stepCount,
                        totalCostUSD: builderAnthropicCost,
                        creditsCharged: maxAffordable,
                        creditsRequired: cumulativeCredits,
                        shortfall: cumulativeCredits - maxAffordable,
                      });
                    } catch (deductError) {
                      req.logger?.error({
                        msg: "Failed to deduct credits before abort",
                        userId,
                        workspaceId,
                        projectId,
                        error:
                          deductError instanceof Error
                            ? deductError.message
                            : "Unknown error",
                      });
                    }
                  }
                }

                abortController.abort();
                throw new Error(
                  `Insufficient credits: ${affordability.reason}`,
                );
              }

              if (stepCost > 0) {
                // Extract and log cache performance using utility
                const cacheMetrics = extractCacheMetrics(providerMetadata);
                req.logger?.info({
                  msg: "Step completed",
                  step: stepCount,
                  maxSteps: getMaxSteps(complexityAnalysis),
                  stepCostUSD: stepCost,
                  cumulativeCostUSD: builderAnthropicCost,
                  cumulativeCredits,
                  cumulativeInputTokens: builderInputTokens,
                  cumulativeOutputTokens: builderOutputTokens,
                  inputTokens: usage?.inputTokens,
                  outputTokens: usage?.outputTokens,
                  cacheRead: cacheMetrics.cacheReadTokens,
                  cacheCreated: cacheMetrics.cacheCreationTokens,
                  cacheSavings:
                    cacheMetrics.cacheSavingsPercent > 0
                      ? `~${cacheMetrics.cacheSavingsPercent}% cost reduction`
                      : "warming cache",
                });
              }

              // Accumulate text content from this step
              if (text && text.trim().length > 0) {
                accumulatedParts.push({
                  type: "text",
                  text: text,
                });
              }

              if (toolCalls) {
                for (const toolCall of toolCalls) {
                  if (!toolCall) continue;
                  req.logger?.debug({
                    msg: "Tool start",
                    toolName: toolCall.toolName,
                    toolCallId: toolCall.toolCallId,
                  });

                  // Add tool invocation to accumulated parts
                  // Use "tool-invocation" type consistently for AI SDK compatibility
                  // This matches the format expected by convertToModelMessages
                  const toolCallWithArgs = toolCall as {
                    toolCallId: string;
                    toolName: string;
                    args?: unknown;
                  };
                  accumulatedParts.push({
                    type: "tool-invocation",
                    toolInvocationId: toolCall.toolCallId,
                    toolName: toolCall.toolName,
                    state: "call",
                    args: toolCallWithArgs.args,
                  });

                  // 🔴 ABLY: Broadcast tool call to all project viewers
                  broadcastAIToolCall(
                    projectId,
                    assistantMessageId || "",
                    toolCall.toolName,
                    toolCall.toolCallId,
                    toolCallWithArgs.args as Record<string, unknown>,
                    userId,
                  ).catch(() => {});
                }
              }
              if (toolResults) {
                for (const toolResult of toolResults) {
                  if (!toolResult) continue;
                  // Check if this is a generateImage tool result with cost data
                  if (
                    toolResult.toolName === "generateImage" &&
                    toolResult.output
                  ) {
                    const imageResult = toolResult.output as {
                      totalCostUSD?: number;
                      totalGenerated?: number;
                    };
                    const imageCost = imageResult.totalCostUSD || 0;

                    if (imageCost > 0) {
                      builderAnthropicCost += imageCost;
                      req.logger?.info({
                        msg: "Image generation cost tracked",
                        step: stepCount,
                        imageCostUSD: imageCost,
                        cumulativeCostUSD: builderAnthropicCost,
                        imagesGenerated: imageResult.totalGenerated,
                      });
                    }
                  }

                  // Update the tool invocation with result
                  const existingInvocation = accumulatedParts.find(
                    (p) =>
                      p.type === "tool-invocation" &&
                      p.toolInvocationId === toolResult.toolCallId,
                  );
                  if (existingInvocation) {
                    existingInvocation.state = "result";
                    existingInvocation.result = toolResult.output;
                  } else {
                    // Add complete tool invocation if not found
                    accumulatedParts.push({
                      type: "tool-invocation",
                      toolInvocationId: toolResult.toolCallId,
                      toolName: toolResult.toolName,
                      state: "result",
                      result: toolResult.output,
                    });
                  }

                  req.logger?.debug({
                    msg: "Tool finish",
                    toolName: toolResult.toolName,
                    toolCallId: toolResult.toolCallId,
                  });

                  // 🔴 ABLY: Broadcast tool result to all project viewers
                  broadcastAIToolResult(
                    projectId,
                    assistantMessageId || "",
                    toolResult.toolCallId,
                    toolResult.output,
                    userId,
                  ).catch(() => {});
                }
              }

              // Save accumulated parts to database incrementally
              // This ensures work is preserved even if the stream is interrupted
              if (assistantMessageId && accumulatedParts.length > 0) {
                try {
                  await prisma.v2Message.update({
                    where: { id: assistantMessageId },
                    data: {
                      content: JSON.stringify(accumulatedParts),
                      updatedAt: new Date(),
                    },
                  });

                  req.logger?.debug({
                    msg: "Assistant message updated incrementally",
                    messageId: assistantMessageId,
                    step: stepCount,
                    partsCount: accumulatedParts.length,
                  });
                } catch (saveError) {
                  req.logger?.error({
                    msg: "Failed to save message incrementally",
                    error:
                      saveError instanceof Error
                        ? saveError.message
                        : String(saveError),
                    step: stepCount,
                  });
                  // Don't throw - continue processing even if save fails
                }
              }

              // Warning when approaching limit (80% threshold)
              // Budget abort is now handled by stopWhen condition
              const warningThreshold = HARD_BUDGET_LIMIT_USD * 0.8;
              const criticalThreshold = HARD_BUDGET_LIMIT_USD * 0.95; // 95% = force finalize

              if (
                builderAnthropicCost >= criticalThreshold &&
                builderAnthropicCost < HARD_BUDGET_LIMIT_USD
              ) {
                req.logger?.warn({
                  msg: "CRITICAL: Budget almost exhausted - AI should finalize NOW",
                  totalCostUSD: builderAnthropicCost,
                  hardLimit: HARD_BUDGET_LIMIT_USD,
                  percentUsed: (
                    (builderAnthropicCost / HARD_BUDGET_LIMIT_USD) *
                    100
                  ).toFixed(1),
                  step: stepCount,
                });
              } else if (
                builderAnthropicCost >= warningThreshold &&
                builderAnthropicCost < criticalThreshold
              ) {
                req.logger?.warn({
                  msg: "Approaching budget limit",
                  totalCostUSD: builderAnthropicCost,
                  hardLimit: HARD_BUDGET_LIMIT_USD,
                  percentUsed: (
                    (builderAnthropicCost / HARD_BUDGET_LIMIT_USD) *
                    100
                  ).toFixed(1),
                  step: stepCount,
                });
              }
            },
            prepareStep: async ({
              stepNumber,
              messages,
            }: {
              stepNumber: number;
              messages: any[];
            }) => {
              const currentStep = stepNumber + 1;
              const maxSteps = getMaxSteps(complexityAnalysis);
              const stepsRemaining = maxSteps - currentStep;

              // Apply cache control to messages at strategic steps (7, 14, 21)
              // Anthropic allows max 4 breakpoints - 1 for system, 3 for conversation
              applyMessageCaching(messages, {
                logger: req.logger,
                currentStep,
              });

              // Calculate current budget status
              const budgetUsedPercent =
                (builderAnthropicCost / HARD_BUDGET_LIMIT_USD) * 100;
              const budgetRemaining =
                HARD_BUDGET_LIMIT_USD - builderAnthropicCost;

              // Build urgency message based on budget
              let urgencyMessage = "";
              if (budgetUsedPercent >= 90) {
                urgencyMessage = `🚨 CRITICAL: Budget over 90% used! FINALIZE IMMEDIATELY!`;
              } else if (budgetUsedPercent >= 85) {
                urgencyMessage = `⚠️ URGENT: Budget ${budgetUsedPercent.toFixed(0)}% used ($${budgetRemaining.toFixed(2)} left) - Focus on completion!`;
              } else if (budgetUsedPercent >= 70) {
                urgencyMessage = `⏰ Budget ${budgetUsedPercent.toFixed(0)}% used ($${budgetRemaining.toFixed(2)} left) - plan to wrap up`;
              }

              // Build dynamic context message (appended, not system override)
              // Only step/budget info - file context is in the cached system prompt
              const dynamicContext = `[INTERNAL SYSTEM STATUS]
STEP: ${currentStep} of ${maxSteps} (${stepsRemaining} remaining)
BUDGET: ${budgetUsedPercent.toFixed(0)}% used
${urgencyMessage}

RULES:
1. ACT on this status - do not just read it
2. NEVER mention budget, steps, or limits to the user
3. NEVER say "I need to finalize", "due to budget", "running low on steps"
4. If budget >= 90%: IMMEDIATELY call finalizeWorkingFragment - no explanation
5. If budget >= 70%: wrap up efficiently, avoid new features
6. Your response must look normal - no hints about internal status
7. Just DO the action, do not TALK about doing it`.trim();

              // Append dynamic context as system message (preserves cache on earlier system messages)
              const updatedMessages = [
                ...messages,
                { role: "user" as const, content: dynamicContext },
              ];

              // CRITICAL: 90%+ budget - restrict tools
              if (budgetUsedPercent >= 90) {
                req.logger?.warn({
                  msg: "CRITICAL: Budget 90% exhausted - AI must finalize immediately",
                  totalCostUSD: builderAnthropicCost,
                  hardLimit: HARD_BUDGET_LIMIT_USD,
                  percentUsed: budgetUsedPercent.toFixed(1),
                  step: currentStep,
                  maxSteps,
                });

                return {
                  messages: updatedMessages,
                  activeTools: [
                    "quickEdit",
                    "finalizeWorkingFragment",
                    "getSandboxUrl",
                  ],
                };
              }

              return { messages: updatedMessages };
            },
            onFinish: async ({ providerMetadata, usage: finalUsage }) => {
              // 🔴 ABLY: Flush any pending batched chunks before completing
              flushPendingChunks(projectId, assistantMessageId || "");

              // 🔴 ABLY: Broadcast AI complete to all project viewers
              broadcastAIComplete(
                projectId,
                assistantMessageId || "",
                userId,
              ).catch(() => {});

              // Extract final cache performance metrics
              const finalCacheMetrics = extractCacheMetrics(providerMetadata);

              req.logger?.info({
                msg: "AI stream completed",
                totalSteps: stepCount,
                totalCostUSD: builderAnthropicCost,
                totalInputTokens: builderInputTokens,
                totalOutputTokens: builderOutputTokens,
                cachePerformance: {
                  tokensCreated: finalCacheMetrics.cacheCreationTokens,
                  tokensRead: finalCacheMetrics.cacheReadTokens,
                  savingsPercent: finalCacheMetrics.cacheSavingsPercent,
                  creationCostPercent:
                    finalCacheMetrics.cacheCreationCostPercent,
                },
              });

              // Deduct credits for all accumulated costs (rounded up)
              // Skip if already deducted during abort (insufficient credits scenario)
              if (creditsAlreadyDeducted) {
                req.logger?.info({
                  msg: "Skipping credit deduction in onFinish - already deducted during abort",
                  userId,
                  projectId,
                  totalCostUSD: builderAnthropicCost,
                });
              } else if (message.role === "user" && builderAnthropicCost > 0) {
                // Use 10% margin for first prompt, 50% margin for follow-ups
                const creditsToCharge = isFirstPromptPricing
                  ? calculateCreditsFromUSDFirstPrompt(builderAnthropicCost)
                  : calculateCreditsFromUSD(builderAnthropicCost);

                // Build description based on completion status
                const statusSuffix = wasCancelled ? " [CANCELLED BY USER]" : "";
                const marginNote = isFirstPromptPricing ? " [10% margin]" : "";
                const description = `AI Generation for "${projectName}" (complexity analysis + ${stepCount} builder steps + tools)${statusSuffix}${marginNote}`;

                try {
                  // 🏢 WORKSPACE-CENTRIC: Always deduct from workspace
                  if (!workspaceId) {
                    throw new Error(
                      "No workspace found for project - cannot deduct credits",
                    );
                  }

                  await CreditManager.deductWorkspaceCredits(
                    workspaceId,
                    creditsToCharge,
                    "AI_GENERATION",
                    description,
                    userId,
                    {
                      projectId,
                      projectName,
                      messageId: assistantMessageId,
                      totalSteps: stepCount,
                      totalCostUSD: builderAnthropicCost,
                      creditsCharged: creditsToCharge,
                      category: complexityAnalysis?.category,
                      wasCancelled,
                      isFirstPrompt: isFirstPromptPricing,
                      marginApplied: isFirstPromptPricing ? "10%" : "50%",
                    },
                  );

                  req.logger?.info({
                    msg: wasCancelled
                      ? "AI generation cancelled - Credits deducted for partial work (includes complexity analysis, builder steps, and image generation)"
                      : "AI generation complete - Credits deducted (includes complexity analysis, builder steps, and image generation)",
                    model: modelToUse,
                    workspaceId,
                    totalSteps: stepCount,
                    totalInputTokens: builderInputTokens,
                    totalOutputTokens: builderOutputTokens,
                    totalCostUSD: builderAnthropicCost,
                    creditsCharged: creditsToCharge,
                    wasCancelled,
                    isFirstPrompt: isFirstPromptPricing,
                    marginApplied: isFirstPromptPricing ? "10%" : "50%",
                    conversionRate: isFirstPromptPricing
                      ? "$1 = 4 credits, 1.1x markup = 4.4 credits per $1, rounded UP"
                      : "$1 = 4 credits, 2x markup = 8 credits per $1, rounded UP",
                  });
                } catch (error) {
                  const errorMessage =
                    error instanceof Error ? error.message : "Unknown error";
                  const isInsufficientCredits = errorMessage.includes(
                    "Insufficient credits",
                  );

                  if (isInsufficientCredits) {
                    // Only attempt partial deduction for insufficient credits errors
                    req.logger?.warn({
                      msg: "Insufficient credits for full deduction - attempting partial deduction",
                      userId,
                      workspaceId,
                      projectId,
                      totalCostUSD: builderAnthropicCost,
                      creditsToCharge,
                      error: errorMessage,
                    });

                    try {
                      // 🏢 WORKSPACE-CENTRIC: Check what workspace can afford
                      const affordability =
                        await CreditManager.canWorkspaceAffordOperation(
                          workspaceId!,
                          creditsToCharge,
                        );

                      if (
                        !affordability.canAfford &&
                        affordability.currentBalance !== undefined
                      ) {
                        // Calculate max they can afford while keeping minimum balance
                        const minimumBalance =
                          CreditManager.getMinimumBalance();
                        const maxAffordable = Math.max(
                          0,
                          Math.floor(
                            (affordability.currentBalance - minimumBalance) *
                              100,
                          ) / 100,
                        );

                        if (maxAffordable > 0 && workspaceId) {
                          // 🏢 WORKSPACE-CENTRIC: Always deduct from workspace
                          await CreditManager.deductWorkspaceCredits(
                            workspaceId,
                            maxAffordable,
                            "AI_GENERATION",
                            `${description} [PARTIAL - workspace could only afford ${maxAffordable} of ${creditsToCharge} credits]`,
                            userId,
                            {
                              projectId,
                              projectName,
                              totalSteps: stepCount,
                              totalCostUSD: builderAnthropicCost,
                              creditsCharged: maxAffordable,
                              originalCreditsToCharge: creditsToCharge,
                              category: complexityAnalysis?.category,
                              wasCancelled,
                              partialDeduction: true,
                            },
                          );

                          req.logger?.warn({
                            msg: "Partial credit deduction successful",
                            userId,
                            workspaceId,
                            projectId,
                            originalCreditsToCharge: creditsToCharge,
                            actualCreditsCharged: maxAffordable,
                            shortfall: creditsToCharge - maxAffordable,
                            totalCostUSD: builderAnthropicCost,
                          });
                        } else {
                          req.logger?.error({
                            msg: "CRITICAL: No workspace or credits available for partial deduction",
                            userId,
                            workspaceId,
                            projectId,
                            currentBalance: affordability.currentBalance,
                            minimumBalance,
                            totalCostUSD: builderAnthropicCost,
                            creditsToCharge,
                          });
                        }
                      }
                    } catch (fallbackError) {
                      req.logger?.error({
                        msg: "CRITICAL: Both full and partial credit deduction failed",
                        userId,
                        projectId,
                        totalCostUSD: builderAnthropicCost,
                        creditsToCharge,
                        originalError: errorMessage,
                        fallbackError:
                          fallbackError instanceof Error
                            ? fallbackError.message
                            : "Unknown error",
                      });
                    }
                  } else {
                    // For non-credit errors (database issues, etc.), just log
                    req.logger?.error({
                      msg: "CRITICAL: Credit deduction failed (non-credit error)",
                      userId,
                      projectId,
                      totalCostUSD: builderAnthropicCost,
                      creditsToCharge,
                      error: errorMessage,
                    });
                  }
                  // Don't throw - generation already completed
                }
              } else {
                req.logger?.info({
                  msg: "AI Builder generation complete - No credits deducted",
                  model: modelToUse,
                  totalSteps: stepCount,
                  reason:
                    message.role !== "user" ? "Assistant message" : "Zero cost",
                });
              }
            },
          });

          // Consume stream and merge into writer for orchestration
          result.consumeStream();

          try {
            writer.merge(
              result.toUIMessageStream({
                sendStart: false,
                sendReasoning: true,
              }),
            );
          } catch (streamError) {
            req.logger?.error({
              msg: "Error converting to UI message stream (likely validation error)",
              error:
                streamError instanceof Error
                  ? streamError.message
                  : String(streamError),
              stack:
                streamError instanceof Error ? streamError.stack : undefined,
            });
            throw streamError;
          }

          // Wait for stream to complete
          try {
            await result.response;
          } catch (responseError) {
            req.logger?.error({
              msg: "Error in stream response",
              error:
                responseError instanceof Error
                  ? responseError.message
                  : String(responseError),
              stack:
                responseError instanceof Error
                  ? responseError.stack
                  : undefined,
            });
            throw responseError;
          }
        },
        onError: (error) => {
          // Log a detailed provider error so staging issues are easy to debug
          const isError = error instanceof Error;
          // Safely extract extra fields without risking JSON cycles
          const extra: Record<string, unknown> = {};
          if (isError) {
            extra.name = error.name;
            extra.stack = error.stack;
            // Some providers attach rich info on custom properties
            const anyError = error as any;
            if (anyError.status) extra.status = anyError.status;
            if (anyError.code) extra.code = anyError.code;
            if (anyError.cause) extra.cause = anyError.cause;
            if (anyError.response) {
              extra.responseStatus = anyError.response.status;
              extra.responseStatusText = anyError.response.statusText;
            }
            if (anyError.providerMetadata) {
              extra.providerMetadata = anyError.providerMetadata;
            }
          }

          req.logger?.error({
            msg: "Stream error from provider",
            requestId,
            projectId,
            errorMessage: isError ? error.message : String(error),
            ...extra,
          });

          // 🔴 ABLY: Broadcast error and streaming stop to all project viewers
          const errorMsg = isError ? error.message : String(error);
          broadcastAIError(
            projectId,
            assistantMessageId || "",
            errorMsg,
            userId,
          ).catch(() => {});
          broadcastStreamingStop(
            projectId,
            userId,
            assistantMessageId ?? undefined,
          ).catch(() => {});

          // Ensure we clear registry and activeStreamId on error
          void finalizeOnAbort(projectId, streamId, toolsContext);
          return error instanceof Error ? error.message : String(error);
        },
        onFinish: async ({ responseMessage }) => {
          // 🔴 ABLY: Broadcast streaming stop to all project viewers
          broadcastStreamingStop(
            projectId,
            userId,
            assistantMessageId ?? undefined,
          ).catch(() => {});

          try {
            // If aborted, the message was already saved incrementally
            // Just finalize cleanup but don't delete the message
            if (aborted) {
              req.logger?.info({
                msg: "Chat stream aborted - message already saved incrementally",
                messageId: assistantMessageId,
                partsCount: accumulatedParts.length,
              });
              await finalizeOnAbort(projectId, streamId, toolsContext);
              return;
            }

            // Update assistant message with final complete content
            // The message was already created early and updated incrementally
            // Now we update it with the final responseMessage.parts from AI SDK
            const content = JSON.stringify(responseMessage.parts);

            if (
              assistantMessageId &&
              content &&
              responseMessage.parts.length > 0
            ) {
              await prisma.v2Message.update({
                where: { id: assistantMessageId },
                data: {
                  content,
                  updatedAt: new Date(),
                },
              });

              req.logger?.info({
                msg: "Assistant message finalized",
                messageId: assistantMessageId,
                partsCount: responseMessage.parts.length,
              });
            } else if (!assistantMessageId) {
              // Fallback: upsert message if somehow it wasn't created earlier
              // Use upsert to handle cases where the message ID already exists
              req.logger?.warn({
                msg: "No assistant message ID found - upserting message",
              });
              if (content && responseMessage.parts.length > 0) {
                await prisma.v2Message.upsert({
                  where: { id: responseMessage.id },
                  create: {
                    id: responseMessage.id,
                    role: "ASSISTANT",
                    content,
                    projectId,
                  },
                  update: {
                    content,
                    updatedAt: new Date(),
                  },
                });
              }
            }

            await finalizeOnFinish(projectId, streamId);

            req.logger?.info("Chat session completed");
          } catch (error) {
            req.logger?.error({
              msg: "Error in onFinish",
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        },
      });

      // Create a Web API Response with the UI message stream
      const webResponse = createUIMessageStreamResponse({ stream });

      // Extract the body stream
      const streamBody = webResponse.body;
      if (!streamBody) {
        throw new Error("Failed to create stream body");
      }

      // Set proper headers for UI message stream
      Object.entries(UI_MESSAGE_STREAM_HEADERS).forEach(([key, value]) => {
        res.setHeader(key, value);
      });

      // If Redis is available, wrap with resumable-stream
      // Otherwise, stream directly (no resumption support)
      if (streamContext) {
        req.logger?.info("Using resumable stream with Redis");

        // Convert Uint8Array stream to string stream for ioredis compatibility
        // ioredis stores strings in Redis, so we need to decode Uint8Array chunks
        // OPTIMIZED: Batch chunks to reduce Redis operations
        const textDecoder = new TextDecoder();
        const BATCH_INTERVAL_MS = 50; // Batch chunks every 50ms
        const BATCH_SIZE_BYTES = 4096; // Or when we reach 4KB

        // Create a batching transformer with proper state management
        let buffer: string[] = [];
        let bufferSize = 0;
        let timer: NodeJS.Timeout | null = null;

        const flushBuffer = (
          controller: TransformStreamDefaultController<string>,
        ) => {
          if (timer) {
            clearTimeout(timer);
            timer = null;
          }
          if (buffer.length > 0) {
            controller.enqueue(buffer.join(""));
            buffer = [];
            bufferSize = 0;
          }
        };

        const batchedStream = streamBody
          .pipeThrough(
            new TransformStream({
              transform(chunk, controller) {
                // Convert Uint8Array to string
                const text =
                  typeof chunk === "string"
                    ? chunk
                    : textDecoder.decode(chunk, { stream: true });
                controller.enqueue(text);
              },
            }),
          )
          .pipeThrough(
            new TransformStream<string, string>({
              transform(chunk, controller) {
                buffer.push(chunk);
                bufferSize += chunk.length;

                // Flush if buffer is large enough
                if (bufferSize >= BATCH_SIZE_BYTES) {
                  flushBuffer(controller);
                  return;
                }

                // Otherwise set a timer to flush
                if (!timer) {
                  timer = setTimeout(() => {
                    flushBuffer(controller);
                  }, BATCH_INTERVAL_MS);
                }
              },
              flush(controller) {
                flushBuffer(controller);
              },
            }),
          );

        const resumableStream = await streamContext.createNewResumableStream(
          streamId,
          () => batchedStream,
        );

        if (!resumableStream) {
          throw new Error("Failed to create resumable stream");
        }

        // OPTIMIZED: Use native stream piping instead of manual loop
        try {
          await resumableStream.pipeTo(
            new WritableStream({
              write(chunk) {
                res.write(chunk);
              },
              close() {
                res.end();
              },
              abort(error) {
                req.logger?.error({
                  msg: "Resumable stream aborted",
                  error: error instanceof Error ? error.message : String(error),
                });
                if (!res.headersSent) {
                  res.status(500).end();
                } else {
                  res.end();
                }
              },
            }),
          );
        } catch (error) {
          req.logger?.error({
            msg: "Resumable stream pump error",
            error: error instanceof Error ? error.message : String(error),
          });
          if (!res.headersSent) {
            res.status(500).end();
          } else {
            res.end();
          }
        }
      } else {
        // No Redis - stream directly without resumption support
        req.logger?.info("Streaming directly (no Redis, resumption disabled)");

        // OPTIMIZED: Use native stream piping
        try {
          await streamBody.pipeTo(
            new WritableStream({
              write(chunk) {
                res.write(chunk);
              },
              close() {
                res.end();
              },
              abort(error) {
                req.logger?.error({
                  msg: "Direct stream aborted",
                  error: error instanceof Error ? error.message : String(error),
                });
                if (!res.headersSent) {
                  res.status(500).end();
                } else {
                  res.end();
                }
              },
            }),
          );
        } catch (error) {
          req.logger?.error({
            msg: "Direct stream pump error",
            error: error instanceof Error ? error.message : String(error),
          });
          if (!res.headersSent) {
            res.status(500).end();
          } else {
            res.end();
          }
        }
      }
    } catch (error) {
      req.logger?.error({
        msg: "Chat request error",
        requestId,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      // If response hasn't started, send JSON error
      if (!res.headersSent) {
        const response: ApiResponse = {
          success: false,
          error:
            error instanceof Error ? error.message : "Internal server error",
        };
        return res.status(500).json(response);
      }
    }
  },
);

/**
 * GET /api/v1/chat/health
 * Health check for chat service
 */
router.get("/health", async (_req: Request, res: Response) => {
  const response: ApiResponse = {
    success: true,
    data: {
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "chat",
    },
  };
  res.json(response);
});

/**
 * GET /api/v1/chat/:projectId/stream
 * Resume an existing stream for a project
 */
router.get(
  "/:projectId/stream",
  validateSession,
  validateProjectAccess,
  async (req: Request, res: Response) => {
    const requestId = `resume-${Date.now()}`;
    req.logger?.info({
      msg: "Stream resumption request received",
      requestId,
    });

    try {
      const { projectId } = req.params;

      if (!projectId) {
        req.logger?.warn({
          msg: "Project ID is required for stream resumption",
          requestId,
        });
        return res.status(400).send("Project ID is required");
      }

      req.logger?.info({
        msg: "Stream resumption request",
        requestId,
        projectId,
        userEmail: req.user?.email || "unknown",
      });

      // Verify project access
      const project = await prisma.project.findFirst({
        where: {
          id: projectId,
        },
      });

      if (!project) {
        req.logger?.warn({
          msg: "Project not found or access denied",
          requestId,
          projectId,
        });
        return res.status(404).send("Project not found or access denied");
      }

      const recentStreamId = project.activeStreamId;

      req.logger?.info({
        msg: "Active stream ID from DB",
        requestId,
        activeStreamId: recentStreamId || "NONE",
      });

      if (!recentStreamId) {
        req.logger?.info({
          msg: "No active stream found for project",
          requestId,
          projectId,
        });
        return res.status(204).send();
      }

      // Security check: Verify stream ID belongs to this project
      // Stream IDs are namespaced as {projectId}:{requestId}
      if (!recentStreamId.startsWith(`${projectId}:`)) {
        req.logger?.error({
          msg: "Stream ID does not belong to this project",
          requestId,
          projectId,
          recentStreamId,
        });
        return res.status(403).send("Invalid stream ID for this project");
      }

      req.logger?.info({
        msg: "Stream ID validated successfully",
        requestId,
      });

      // Check if Redis is available for resumable streams
      const redisAvailable = !!process.env.REDIS_URL;
      req.logger?.debug({
        msg: "Redis availability check",
        requestId,
        redisAvailable,
        redisUrlConfigured: !!process.env.REDIS_URL,
      });

      if (!redisAvailable) {
        req.logger?.info({
          msg: "Redis not available - stream resumption disabled",
          requestId,
        });
        return res.status(204).send();
      }

      req.logger?.debug({
        msg: "Creating resumable stream context",
        requestId,
      });

      const streamContext = createResumableStreamContext({
        publisher: redisPublisher!,
        subscriber: redisSubscriber!,
        waitUntil: (promise: Promise<unknown>) => {
          // Express doesn't have `after` like Next.js,
          // but we can just let the promise resolve in the background
          promise.catch((error) => {
            req.logger?.error({
              msg: "Background task error",
              requestId,
              error: error instanceof Error ? error.message : String(error),
            });
          });
        },
      });

      req.logger?.info({
        msg: "Attempting to resume stream",
        requestId,
        recentStreamId,
      });

      const resumedStream =
        await streamContext.resumeExistingStream(recentStreamId);

      req.logger?.info({
        msg: "Stream resumption result",
        requestId,
        success: !!resumedStream,
      });

      if (!resumedStream) {
        req.logger?.info({
          msg: "Stream not found or already completed in Redis",
          requestId,
        });
        return res.status(204).send();
      }

      // Set proper headers for UI message stream (MUST match initial POST)
      Object.entries(UI_MESSAGE_STREAM_HEADERS).forEach(([key, value]) => {
        res.setHeader(key, value);
      });

      req.logger?.debug({
        msg: "Headers set, pumping resumed stream",
        requestId,
      });

      // OPTIMIZED: Use native stream piping for resumed streams
      let chunksWritten = 0;
      try {
        await resumedStream.pipeTo(
          new WritableStream({
            write(value) {
              // Log the first chunk to debug format
              if (chunksWritten === 0) {
                req.logger?.debug({
                  msg: "First chunk received",
                  requestId,
                  chunkType: typeof value,
                  chunkLength: typeof value === "string" ? value.length : 0,
                });
              }

              // Write the string chunk to response
              // Since we converted to string before storing in Redis, chunks are strings
              res.write(value);
              chunksWritten++;

              if (chunksWritten % 10 === 0) {
                req.logger?.debug({
                  msg: "Stream progress",
                  requestId,
                  chunksWritten,
                });
              }
            },
            close() {
              req.logger?.info({
                msg: "Stream complete",
                requestId,
                chunksWritten,
              });
              res.end();
            },
            abort(error) {
              req.logger?.error({
                msg: "Stream aborted",
                requestId,
                chunksWritten,
                error: error instanceof Error ? error.message : String(error),
              });
              if (!res.headersSent) {
                res.status(500).end();
              } else {
                res.end();
              }
            },
          }),
        );
      } catch (error) {
        req.logger?.error({
          msg: "Stream pump error",
          requestId,
          chunksWritten,
          error: error instanceof Error ? error.message : String(error),
        });
        if (!res.headersSent) {
          res.status(500).end();
        } else {
          res.end();
        }
      }
    } catch (error) {
      req.logger?.error({
        msg: "Stream resumption error",
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });
      if (!res.headersSent) {
        return res.status(500).send("Internal server error");
      }
    }
  },
);

/**
 * DELETE /api/v1/chat/:projectId/stream
 * Stop the stream for a project
 */
router.delete(
  "/:projectId/stream",
  validateSession,
  validateProjectAccess,
  async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;

      if (!projectId) {
        return res.status(400).send("Project ID is required");
      }

      // Verify project access
      const project = await prisma.project.findFirst({
        where: {
          id: projectId,
        },
      });

      if (!project) {
        return res.status(404).send("Project not found or access denied");
      }

      req.logger?.info({
        msg: "Canceling stream for project",
      });

      // Clear the active stream ID and timestamp to signal cancellation
      // The onChunk callback in the main route will detect this and abort the stream
      await prisma.project.update({
        where: { id: projectId },
        data: {
          activeStreamId: null,
          activeStreamStartedAt: null,
        },
      });
      // Look up active streamId for this project and abort that stream
      const projectWithStream = await prisma.project.findFirst({
        where: { id: projectId },
        select: { activeStreamId: true },
      });

      const streamId = projectWithStream?.activeStreamId || null;

      const abortedImmediately = streamId ? abortChat(streamId) : false;
      await safeClearActiveStream(projectId);

      // Broadcast streaming stop to all project viewers via SSE
      const userId = (req as any).userId || "";
      broadcastStreamingStop(projectId, userId).catch(() => {});

      req.logger?.info({
        msg: "Stream cancellation signal sent",
        abortedImmediately,
      });

      return res.status(200).send();
    } catch (error) {
      req.logger?.error({
        msg: "Stream cancellation error",
        error: error instanceof Error ? error.message : String(error),
      });
      return res.status(500).send("Internal server error");
    }
  },
);

/**
 * POST /api/v1/chat/:projectId/hitl-confirm
 * Handle HITL (Human-in-the-Loop) tool confirmations without creating new messages
 *
 * This endpoint allows the frontend to confirm/deny HITL tool invocations
 * directly, updating the existing message's tool result in-place rather than
 * sending a new user message.
 */
router.post(
  "/:projectId/hitl-confirm",
  validateSession,
  validateProjectAccess,
  async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const { toolCallId, toolName, confirmed, projectName, reason } = req.body;

      if (!projectId) {
        return res
          .status(400)
          .json({ success: false, error: "Project ID is required" });
      }

      if (!toolCallId || !toolName) {
        return res.status(400).json({
          success: false,
          error: "toolCallId and toolName are required",
        });
      }

      req.logger?.info({
        msg: "HITL confirmation request",
        projectId,
        toolCallId,
        toolName,
        confirmed,
      });

      // Only handle deployToShipperCloud for now
      if (toolName !== "deployToShipperCloud") {
        return res.status(400).json({
          success: false,
          error: `HITL confirmation not supported for tool: ${toolName}`,
        });
      }

      const userId = req.user?.id;
      if (!userId) {
        return res
          .status(401)
          .json({ success: false, error: "User not authenticated" });
      }

      // Find the message containing this tool invocation
      const messages = await prisma.v2Message.findMany({
        where: { projectId },
        orderBy: { createdAt: "desc" },
        take: 10, // Check recent messages
      });

      let targetMessage: (typeof messages)[0] | null = null;
      let targetPartIndex = -1;

      for (const msg of messages) {
        try {
          const parts = JSON.parse(msg.content) as Array<{
            type: string;
            toolCallId?: string;
            toolInvocationId?: string;
            state?: string;
          }>;

          const partIndex = parts.findIndex(
            (p) =>
              p.type === "tool-invocation" &&
              (p.toolCallId === toolCallId ||
                p.toolInvocationId === toolCallId),
          );

          if (partIndex !== -1) {
            targetMessage = msg;
            targetPartIndex = partIndex;
            break;
          }
        } catch {
          // Skip messages with invalid JSON
          continue;
        }
      }

      if (!targetMessage || targetPartIndex === -1) {
        return res.status(404).json({
          success: false,
          error: "Tool invocation not found",
        });
      }

      // Parse the message parts
      const parts = JSON.parse(targetMessage.content) as Array<{
        type: string;
        toolCallId?: string;
        toolInvocationId?: string;
        toolName?: string;
        state?: string;
        args?: unknown;
        result?: unknown;
      }>;

      if (confirmed) {
        // Execute the deployment
        req.logger?.info({
          msg: "Executing HITL deployment",
          projectId,
          projectName,
        });

        // Import and execute deployment
        const { executeShipperCloudDeploymentWithFiles } = await import(
          "../services/shipper-cloud-hitl.js"
        );

        const deployResult = await executeShipperCloudDeploymentWithFiles(
          projectId,
          userId,
          projectName || "Untitled",
        );

        // Update the tool part with the result
        parts[targetPartIndex] = {
          ...parts[targetPartIndex],
          state: "result",
          result: {
            status: deployResult.success ? "success" : "error",
            success: deployResult.success,
            message: deployResult.success
              ? deployResult.isExisting
                ? "Shipper Cloud deployment already exists. Convex Auth files have been set up."
                : "Successfully provisioned Shipper Cloud backend with Convex Auth!"
              : deployResult.error || "Deployment failed",
            deploymentUrl: deployResult.deploymentUrl,
            siteUrl: deployResult.siteUrl,
            deploymentName: deployResult.deploymentName,
            isExisting: deployResult.isExisting,
            filesCreated: deployResult.filesCreated,
            packagesInstalled: deployResult.packagesInstalled,
            packagesInstalledList: deployResult.packagesInstalledList,
            envVarsSet: deployResult.envVarsSet,
            authClientPath: deployResult.authClientPath,
            nextSteps: deployResult.success
              ? [
                  "⚠️ STOP! Your VERY NEXT action MUST be: call deployConvex tool",
                  "The convex/_generated/api types DO NOT EXIST yet - you will get import errors if you create components now!",
                  "1. IMMEDIATELY call deployConvex tool NOW (before creating ANY files)",
                  "2. WAIT for deployConvex to succeed",
                  "3. ONLY THEN: Update src/main.tsx to use ConvexAuthProvider (import from @convex-dev/auth/react)",
                  "4. ONLY THEN: Create sign-in components using useAuthActions hook from @convex-dev/auth/react",
                ]
              : undefined,
            criticalWarning: deployResult.success
              ? "🚫 DO NOT create ANY React components yet! Call deployConvex FIRST!"
              : undefined,
            error: deployResult.success ? undefined : deployResult.error,
          },
        };

        // Save the updated message
        await prisma.v2Message.update({
          where: { id: targetMessage.id },
          data: { content: JSON.stringify(parts) },
        });

        req.logger?.info({
          msg: "HITL deployment completed",
          projectId,
          success: deployResult.success,
          deploymentUrl: deployResult.deploymentUrl,
        });

        return res.json({
          success: true,
          result: parts[targetPartIndex].result,
        });
      } else {
        // User denied - update the tool part
        parts[targetPartIndex] = {
          ...parts[targetPartIndex],
          state: "result",
          result: {
            status: "denied",
            success: false,
            message: "Shipper Cloud deployment cancelled by user",
          },
        };

        // Save the updated message
        await prisma.v2Message.update({
          where: { id: targetMessage.id },
          data: { content: JSON.stringify(parts) },
        });

        req.logger?.info({
          msg: "HITL deployment denied by user",
          projectId,
        });

        return res.json({
          success: true,
          result: parts[targetPartIndex].result,
        });
      }
    } catch (error) {
      req.logger?.error({
        msg: "HITL confirmation error",
        error: error instanceof Error ? error.message : String(error),
      });
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  },
);

export default router;
