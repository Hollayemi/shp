/**
 * Prompt Caching Utilities for Anthropic Claude (Direct API)
 *
 * Implements cache breakpoint placement for optimal prompt caching.
 * Anthropic caches content UP TO each cache_control breakpoint.
 *
 * Key principles:
 * 1. Cache stable prefixes, not changing content (don't cache the last message)
 * 2. Place breakpoints at strategic intervals for long conversations
 * 3. Tool definitions can also be cached (they don't change between calls)
 * 4. System prompts should be split: static (cached) + dynamic (not cached)
 *
 * Token requirements (minimum cacheable prompt length):
 * - Claude 3.5 Haiku: 2048 tokens
 * - Claude 3.7 Sonnet, Claude 3.5 Sonnet, Claude 3 Opus: 1024 tokens
 * - Maximum 4 cache breakpoints per request
 *
 * @see https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
 */

import type { Logger } from "pino";

export interface CacheOptions {
  /** Minimum estimated tokens for caching to be worthwhile */
  minTokenEstimate?: number;
  /** Logger instance for debugging */
  logger?: Logger;
}

export interface CacheStats {
  breakpointsApplied: number;
  breakpointIndices: number[];
  estimatedTokens: number;
  messageCount: number;
}

interface ContentPart {
  type: string;
  text?: string;
  source?: {
    type: "url" | "base64";
    url?: string;
    media_type?: string;
    data?: string;
  };
  cache_control?: { type: "ephemeral" };
  [key: string]: unknown;
}

// Flexible interface to work with AI SDK's various ModelMessage types
interface ModelMessage {
  role: string;
  content: string | unknown[];
  [key: string]: unknown;
}

/**
 * Estimates token count from message content.
 * Uses rough approximation of 4 characters per token.
 */
function estimateTokens(content: string | ContentPart[]): number {
  const text = typeof content === "string" ? content : JSON.stringify(content);
  return Math.ceil(text.length / 4);
}

/**
 * Provider options for Anthropic cache control.
 * This is the format required by the AI SDK for direct Anthropic API.
 */
const ANTHROPIC_CACHE_CONTROL = {
  anthropic: {
    cacheControl: { type: "ephemeral" },
  },
};

/**
 * Adds cache_control to a single message using providerOptions.
 * This approach works with AI SDK + OpenRouter by using the providerOptions
 * wrapper instead of raw cache_control properties.
 *
 * For array content: adds providerOptions to the last content part
 * For string content: adds providerOptions to the message itself
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addCacheControlToMessage(message: any): void {
  if (!message) return;

  // If content is an array, add providerOptions to the last content part
  if (Array.isArray(message.content) && message.content.length > 0) {
    const lastContent = message.content[message.content.length - 1];
    if (lastContent && typeof lastContent === "object") {
      lastContent.providerOptions = {
        ...lastContent.providerOptions,
        ...ANTHROPIC_CACHE_CONTROL,
      };
      return;
    }
  }

  // For string content or fallback: add providerOptions to the message itself
  message.providerOptions = {
    ...message.providerOptions,
    ...ANTHROPIC_CACHE_CONTROL,
  };
}

/**
 * Calculates optimal breakpoint positions for a conversation.
 *
 * Strategy:
 * - System prompt is cached separately via createCachedSystemPrompt
 * - Cache the last 2 non-system messages (before current user input)
 * - This makes the cache "move forward" as conversation grows
 */
function calculateBreakpoints(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages: any[],
): number[] {
  // Find non-system message indices
  const nonSystemIndices: number[] = [];
  messages.forEach((msg, idx) => {
    if (msg.role !== "system") {
      nonSystemIndices.push(idx);
    }
  });

  // Get last 2 non-system messages (excluding the very last one which is current input)
  // slice(-3, -1) gets 2nd-to-last and 3rd-to-last
  return nonSystemIndices
    .slice(-3, -1)
    .filter((i) => i >= 0 && i < messages.length - 1);
}

/**
 * Applies cache control breakpoints to messages for direct Anthropic API.
 *
 * Strategy: Step-based fixed breakpoints (max 4 total):
 * 1. System prompt - always cached (handled separately, counts as 1)
 * 2. Step 7 - cache all messages up to this point
 * 3. Step 14 - cache all messages up to this point
 * 4. Step 21 - cache all messages up to this point
 *
 * Breakpoints are added once and never moved, maximizing cache reads.
 *
 * IMPORTANT: This modifies messages in place.
 */
export function applyMessageCaching(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages: any[],
  options: { logger?: any; currentStep?: number } = {},
): CacheStats {
  const { logger, currentStep = 1 } = options;
  const messageCount = messages.length;

  const stats: CacheStats = {
    breakpointsApplied: 0,
    breakpointIndices: [],
    estimatedTokens: 0,
    messageCount,
  };

  if (messageCount < 2) {
    return stats;
  }

  // 1. Always cache first user message (caches system + first user with 1 breakpoint)
  // Anthropic caches everything UP TO the breakpoint
  let firstUserIndex = -1;
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role === "user") {
      firstUserIndex = i;
      break;
    }
  }

  if (
    firstUserIndex >= 0 &&
    !messages[firstUserIndex].providerOptions?.anthropic?.cacheControl
  ) {
    addCacheControlToMessage(messages[firstUserIndex]);
    stats.breakpointsApplied++;
    stats.breakpointIndices.push(firstUserIndex);

    logger?.debug({
      msg: "Cache breakpoint added on first user message",
      targetIndex: firstUserIndex,
      currentStep,
    });
  }

  // 2. Strategic steps for additional breakpoints
  // Steps 7, 14, 21 = up to 3 more breakpoints (4 total max)
  const CACHE_STEPS = [7, 14];

  // Find the last non-system message index (we cache UP TO this point)
  // Don't cache the very last message (current input)
  const lastCacheableIndex = messageCount - 2;
  if (lastCacheableIndex < 0) {
    return stats;
  }

  // Count existing non-system breakpoints
  let existingBreakpoints = 0;
  for (const msg of messages) {
    if (msg.providerOptions?.anthropic?.cacheControl && msg.role !== "system") {
      existingBreakpoints++;
    }
  }

  // Determine which step breakpoints should exist
  for (const cacheStep of CACHE_STEPS) {
    // Max 4 breakpoints total (including first user message)
    if (existingBreakpoints >= 4) break;

    // If we're exactly at this cache step, add a breakpoint
    if (currentStep === cacheStep) {
      const targetIndex = lastCacheableIndex;
      // Don't add if it's the same as first user message
      if (targetIndex > firstUserIndex && messages[targetIndex]) {
        addCacheControlToMessage(messages[targetIndex]);
        stats.breakpointsApplied++;
        stats.breakpointIndices.push(targetIndex);
        existingBreakpoints++;

        logger?.info({
          msg: `Cache breakpoint added at step ${cacheStep}`,
          targetIndex,
          currentStep,
          messageCount,
        });
      }
    }
  }

  stats.estimatedTokens = messages.reduce(
    (sum, msg) => sum + estimateTokens(msg.content),
    0,
  );

  if (stats.breakpointsApplied > 0) {
    logger?.info({
      msg: "Prompt caching configured",
      breakpointsApplied: stats.breakpointsApplied,
      breakpointIndices: stats.breakpointIndices,
      estimatedTokens: stats.estimatedTokens,
      messageCount: stats.messageCount,
      currentStep,
    });
  }

  return stats;
}

/**
 * Creates system messages with cache control for Anthropic.
 * Returns an array of system messages - the static part is cached, dynamic is not.
 *
 * For direct Anthropic API, cache control on system prompts is achieved by
 * passing multiple system messages at the head of the messages array with
 * providerOptions on the cached parts.
 *
 * The static part should contain:
 * - Core instructions that never change
 * - Tool usage guidelines
 * - Response format requirements
 *
 * The dynamic part should contain:
 * - Current step/budget information
 * - Project-specific context
 * - Session-specific data
 *
 * @param staticPrompt - The unchanging base system prompt (will be cached)
 * @param dynamicContext - Context that changes each request/step (not cached)
 * @returns Array of system messages with cache control
 *
 * @example
 * ```typescript
 * const systemMessages = createCachedSystemPrompt(
 *   getFullStackPrompt(),
 *   `Project: ${projectName}\nStep ${step} of ${maxSteps}`
 * );
 * // Prepend to messages array before streamText
 * ```
 */
export function createCachedSystemPrompt(
  staticPrompt: string,
  dynamicContext: string,
): Array<{ role: "system"; content: string; providerOptions?: any }> {
  return [
    {
      role: "system" as const,
      content: staticPrompt,
      providerOptions: ANTHROPIC_CACHE_CONTROL,
    },
    {
      role: "system" as const,
      content: dynamicContext,
    },
  ];
}

/**
 * Creates a simple combined system prompt string.
 * Use this when you don't need caching on the system prompt.
 *
 * @param staticPrompt - The base system prompt
 * @param dynamicContext - Additional context
 * @returns Combined system prompt string
 */
export function createSimpleSystemPrompt(
  staticPrompt: string,
  dynamicContext: string,
): string {
  return `${staticPrompt}\n\n${dynamicContext}`;
}

/**
 * Creates a cached system prompt with a reference image for styling presets.
 * The image is cached along with the static prompt for maximum cost efficiency.
 *
 * Cache structure:
 * 1. Static prompt (cached)
 * 2. Reference image (cached)
 * 3. Dynamic context (not cached)
 *
 * @param staticPrompt - The unchanging base system prompt
 * @param dynamicContext - Context that changes each request/step
 * @param imageUrl - Absolute public URL to the preset reference image or base64 data URI
 * @returns System messages array compatible with AI SDK
 */
export function createCachedSystemPromptWithImage(
  staticPrompt: string,
  dynamicContext: string,
  imageUrl: string,
): Array<{ role: "system"; content: any; providerOptions?: any }> {
  // Support both absolute URLs and data: URIs from extractStylingImageUrl
  let imageSource: any = {
    type: "url",
    url: imageUrl,
  };

  // If we were given a data URI, convert it into a proper base64 image source
  if (imageUrl.startsWith("data:")) {
    const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      const [, mediaType, data] = match;
      imageSource = {
        type: "base64",
        media_type: mediaType,
        data,
      };
    }
  }

  // Return system messages compatible with AI SDK format
  // First message: static prompt (cached)
  // Second message: image (cached)
  // Third message: dynamic context (not cached)
  return [
    {
      role: "system" as const,
      content: staticPrompt,
      providerOptions: ANTHROPIC_CACHE_CONTROL,
    },
    {
      role: "system" as const,
      content: [
        {
          type: "image",
          source: imageSource,
        },
      ],
      providerOptions: ANTHROPIC_CACHE_CONTROL, // Cache this image!
    },
    {
      role: "system" as const,
      content: `\n\nStyling Reference (Inspiration-Only):\nThe image above is a visual reference, NOT a template to copy.\nUse it only for high-level inspiration — mood, color palette, tone, density, and overall vibe.\n\nCRITICAL RULES:\n- The user's written request is PRIMARY. The content, information architecture, and feature set MUST be driven by what the user describes.\n- Do NOT clone or closely replicate the layout, structure, navigation, or specific UI components from the reference image.\n- Support ANY experience type the user asks for (e.g. marketing site, SaaS app, dashboard, portfolio, landing page, internal tool, etc.).\n- Apply the reference image ONLY as a loose visual direction layered on top of the user's requirements.\n- Only mirror specific layouts or patterns from the reference if the user explicitly asks for that.\n\n${dynamicContext}`,
    },
  ];
}

/**
 * Adds cache_control to tool definitions for Anthropic caching.
 * Since tool definitions don't change between calls, caching them
 * saves tokens on every request.
 *
 * IMPORTANT: This should be called once when preparing tools,
 * as it modifies the tools object.
 *
 * The cache_control is added to the last tool's description
 * to cache the entire tools block.
 *
 * @param tools - The tools object from ai-tools.ts
 * @returns The same tools object with cache_control added
 *
 * @example
 * ```typescript
 * const cachedTools = applyCacheToTools(tools(toolsContext));
 * // Use cachedTools in streamText()
 * ```
 */
export function applyCacheToTools<T extends Record<string, unknown>>(
  toolsObj: T,
): T {
  const toolNames = Object.keys(toolsObj);
  if (toolNames.length === 0) return toolsObj;

  // Get the last tool to add cache_control
  const lastToolName = toolNames[toolNames.length - 1];
  const lastTool = toolsObj[lastToolName] as any;

  // Add cache_control marker to the tool
  // The AI SDK will pass this through to the API
  if (lastTool && typeof lastTool === "object") {
    // Create a wrapper that adds cache_control to the tool definition
    // This is passed through OpenRouter to Anthropic
    (lastTool as any).cache_control = { type: "ephemeral" };
  }

  return toolsObj;
}

/**
 * Extracts cache performance metrics from provider metadata.
 * Works with both OpenRouter and direct Anthropic responses.
 *
 * @param providerMetadata - The providerMetadata from AI SDK response
 * @returns Cache performance statistics
 */
export function extractCacheMetrics(providerMetadata: unknown): {
  cacheCreationTokens: number;
  cacheReadTokens: number;
  cacheSavingsPercent: number;
  cacheCreationCostPercent: number;
  inputTokens: number;
} {
  const metadata = providerMetadata as any;
  const anthropicMeta = metadata?.anthropic;
  const anthropicUsage = anthropicMeta?.usage;

  // Anthropic returns snake_case in usage object, camelCase at top level
  const cacheCreationTokens =
    anthropicUsage?.cache_creation_input_tokens ||
    anthropicMeta?.cacheCreationInputTokens ||
    0;

  const cacheReadTokens =
    anthropicUsage?.cache_read_input_tokens ||
    anthropicMeta?.cacheReadInputTokens ||
    0;

  const inputTokens =
    anthropicUsage?.input_tokens || metadata?.usage?.promptTokens || 1;

  // Calculate true net cost savings percentage
  // Pricing: inputTokens = 1x, cacheRead = 0.1x, cacheCreation = 1.25x
  const totalTokens = inputTokens + cacheReadTokens + cacheCreationTokens;

  // Cost without caching (all tokens at 1x)
  const costWithoutCache = totalTokens * 1.0;

  // Cost with caching
  const costWithCache =
    inputTokens * 1.0 + cacheReadTokens * 0.1 + cacheCreationTokens * 1.25;

  // Net savings percentage (can be negative if creation cost > read savings)
  const cacheSavingsPercent =
    costWithoutCache > 0
      ? Math.round(
          ((costWithoutCache - costWithCache) / costWithoutCache) * 100,
        )
      : 0;

  // Extra cost from cache creation as percentage of total
  const cacheCreationCostPercent =
    totalTokens > 0
      ? Math.round(((cacheCreationTokens * 0.25) / totalTokens) * 100)
      : 0;

  return {
    cacheCreationTokens,
    cacheReadTokens,
    cacheSavingsPercent,
    cacheCreationCostPercent,
    inputTokens,
  };
}

/**
 * Logs comprehensive cache performance for debugging.
 * Use this in onStepFinish and onFinish callbacks.
 */
export function logCachePerformance(
  logger: Logger | undefined,
  stepNumber: number,
  providerMetadata: unknown,
  usage?: { inputTokens?: number; outputTokens?: number },
): void {
  if (!logger) return;

  const metrics = extractCacheMetrics(providerMetadata);

  logger.info({
    msg: "Cache performance",
    step: stepNumber,
    cacheCreated: metrics.cacheCreationTokens,
    cacheRead: metrics.cacheReadTokens,
    inputTokens: metrics.inputTokens,
    outputTokens: usage?.outputTokens || 0,
    cacheSavings:
      metrics.cacheSavingsPercent > 0
        ? `~${metrics.cacheSavingsPercent}% cost reduction`
        : "none (cache warming or tokens below minimum)",
    note:
      metrics.cacheCreationTokens === 0 && metrics.cacheReadTokens === 0
        ? "No cache activity - ensure model is Anthropic Claude and content exceeds 1024 tokens"
        : undefined,
  });
}
