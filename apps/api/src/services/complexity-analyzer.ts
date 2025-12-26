import { generateObject } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import { CreditManager } from "./credits.js";
import {
  getPostHogCapture,
  generateSpanId,
  getEnvironmentProperties,
} from "./posthog-capture.js";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export interface ComplexityAnalysis {
  complexity: number; // 0-10 scale
  description: string;
  creditCost: number; // now supports decimals as requested
  category: "simple" | "moderate" | "complex" | "advanced";
  factors: string[];
  adjustedForMinimumBalance?: boolean;
  originalCreditCost?: number;
  recommendedTemplate?: string; // Template/snapshot to use for sandbox creation
  openRouterCost?: number; // Actual cost from OpenRouter for this analysis
  recommendedSteps: number; // Recommended max steps based on complexity
  isBackendTask?: boolean; // Whether this involves backend/database/auth work
}

const complexitySchema = z.object({
  complexity: z
    .number()
    .min(0)
    .max(10)
    .describe("Complexity score from 0-10 based on task difficulty"),
  description: z
    .string()
    .describe("Brief description of what type of task this is"),
  category: z
    .enum(["simple", "moderate", "complex", "advanced"])
    .describe("Task complexity category"),
  factors: z
    .array(z.string())
    .describe("List of factors that contribute to the complexity"),
  reasoning: z
    .string()
    .describe("Explanation of why this complexity score was assigned"),
  isBackendTask: z
    .boolean()
    .describe(
      "True if the task involves backend work like database operations, authentication, API endpoints, Convex functions, schema changes, server-side logic, Stripe/payment integration, or AI/LLM integration. False for pure frontend/UI tasks.",
    ),
  recommendedTemplate: z
    .enum([
      "database-vite-template",
      "database-vite-todo-template",
      "database-vite-landing-page-template",
      "database-vite-tracker-template",
      "database-vite-calculator-template",
      "tanstack-template",
      "tanstack-todo-template",
      "tanstack-landing-page-template",
      "tanstack-tracker-template",
      "tanstack-calculator-template",
      "tanstack-content-sharing-template",
    ])
    .optional()
    .describe(
      "Recommended template/snapshot based on task type. Use tanstack-* templates for modern TanStack Start apps with Convex backend. Use database-vite-* templates for Vite apps with Turso database.",
    ),
});

export async function analyzePromptComplexity(
  prompt: string,
  userId?: string,
  traceId?: string,
  projectId?: string,
  projectName?: string,
  isFirstMessage?: boolean,
): Promise<ComplexityAnalysis> {
  const postHog = getPostHogCapture();
  const startTime = Date.now();
  const spanId = generateSpanId();

  try {
    const response = await generateObject({
      model: openrouter("google/gemini-3-flash-preview", {
        extraBody: {
          usage: {
            include: true,
          },
          user: userId || "anonymous",
        },
      }),
      schema: complexitySchema,
      experimental_telemetry: {
        isEnabled: true,
      },
      prompt: `Analyze the complexity of this coding task and determine appropriate credit cost and template:
${projectName ? `\nProject: "${projectName}"\n` : ""}
Task: "${prompt}"

Consider these examples for reference:
- "Make the button gray" = Simple (1.00 credits) - basic styling changes
- "Remove the footer" = Simple (1.20 credits) - component removal
- "Add authentication" = Moderate (1.50 credits) - system integration
- "Build a landing page with images" = Complex (2.00 credits) - full page creation

Rate the complexity (0-10 scale) considering:
- Simple tasks (0-2): Basic styling, text changes, simple component modifications
- Moderate tasks (3-5): Component creation, basic functionality, simple integrations
- Complex tasks (6-8): Full pages, system integrations, advanced components
- Advanced tasks (9-10): Complete applications, complex algorithms, multiple system integration

Provide specific factors that contribute to the complexity.

TEMPLATE SELECTION:
Choose the most appropriate template based on the task. TanStack templates are preferred for modern apps with Convex backend:

TanStack Templates (Modern - TanStack Start + Convex backend):
- Use "tanstack-template" (PREFERRED DEFAULT) for general applications, dashboards, SaaS apps
- Use "tanstack-todo-template" for todo lists, task management, checklists
- Use "tanstack-landing-page-template" for marketing pages, landing pages
- Use "tanstack-tracker-template" for tracking applications (habits, expenses, time, etc.)
- Use "tanstack-calculator-template" for calculator applications
- Use "tanstack-content-sharing-template" for content sharing, social features, file sharing

Legacy Vite Templates (Vite + Turso database):
- Use "database-vite-template" for legacy Vite applications
- Use "database-vite-todo-template" for legacy todo apps
- Use "database-vite-tracker-template" for legacy tracker apps
- Use "database-vite-calculator-template" for legacy calculator apps
- Use "database-vite-landing-page-template" for legacy landing pages

IMPORTANT:
- If the task is unclear, empty, or no specific task is provided, assign a complexity of at least 1 (never 0) and categorize as "simple"
- Always provide a meaningful description even for unclear tasks
- Never assign a complexity of 0 - the minimum should be 1 for any interaction
- For template selection, default to "tanstack-template" (the modern TanStack template) unless there's a specific reason to use a different template`,
    });

    const { object, usage, providerMetadata } = response;
    const latency = (Date.now() - startTime) / 1000;

    // Get actual cost from OpenRouter provider metadata
    const openRouterCost =
      (providerMetadata as any)?.openrouter?.usage?.cost || 0;
    console.log("[ComplexityAnalyzer] Provider metadata:", providerMetadata);
    console.log("[ComplexityAnalyzer] OpenRouter cost:", openRouterCost);

    // Track successful complexity analysis generation
    if (userId && traceId) {
      try {
        await postHog.captureAIGeneration({
          distinct_id: userId,
          $ai_trace_id: traceId,
          $ai_span_id: spanId,
          $ai_span_name: "complexity_analysis",
          $ai_model: "google/gemini-3-flash-preview",
          $ai_provider: "openrouter",
          $ai_input: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Analyze complexity: ${prompt}`,
                },
              ],
            },
          ],
          $ai_output_choices: [
            {
              role: "assistant",
              content: [
                {
                  type: "text",
                  text: JSON.stringify(object),
                },
              ],
            },
          ],
          $ai_input_tokens: usage?.inputTokens || 0,
          $ai_output_tokens: usage?.outputTokens || 0,
          $ai_total_cost_usd: openRouterCost,
          $ai_latency: latency,
          $ai_http_status: 200,
          $ai_base_url: "https://openrouter.ai/api/v1",
          $ai_request_url: "https://openrouter.ai/api/v1/chat/completions",
          $ai_is_error: false,
          $ai_temperature: 0.7,
          // Custom properties
          complexity: object.complexity,
          category: object.category,
          feature: "complexity-analysis",
          openRouterGenerationId: (response as any).id,
          ...(projectId && { projectId }),
          ...(projectName && { projectName }),
          ...getEnvironmentProperties(),
        });
      } catch (trackingError) {
        console.error(
          "[PostHog] Failed to track complexity analysis generation:",
          trackingError,
        );
      }
    }

    // Calculate credit cost based on complexity and whether it's the first message
    let creditCost: number;

    // Normalize the prompt and check for empty/unclear tasks
    const normalizedPrompt = prompt?.trim() || "";

    // First message (initial build) always costs 4 credits
    if (isFirstMessage) {
      creditCost = 4.0;

      // Handle zero complexity or empty tasks for first message
      if (
        object.complexity <= 0 ||
        normalizedPrompt.length < 3 ||
        object.description?.toLowerCase().includes("did not provide") ||
        object.description?.toLowerCase().includes("no task") ||
        object.factors?.some((f) => f.toLowerCase().includes("no task"))
      ) {
        object.complexity = Math.max(1, object.complexity);
        object.description = object.description?.includes("did not provide")
          ? "Initial project setup"
          : object.description || "Basic project initialization";

        if (!object.factors.some((f) => f.includes("Initial"))) {
          object.factors.push("Initial build - standard cost applied");
        }
      }
    } else {
      // Follow-up messages: 1.5-15 credits based on complexity

      // Handle zero complexity or empty tasks
      if (
        object.complexity <= 0 ||
        normalizedPrompt.length < 3 ||
        object.description?.toLowerCase().includes("did not provide") ||
        object.description?.toLowerCase().includes("no task") ||
        object.factors?.some((f) => f.toLowerCase().includes("no task"))
      ) {
        creditCost = 1.5; // Minimum cost for follow-up tasks
        object.complexity = Math.max(1, object.complexity);
        object.description = object.description?.includes("did not provide")
          ? "General assistance request"
          : object.description || "Basic task";

        if (!object.factors.some((f) => f.includes("Minimum"))) {
          object.factors.push(
            "Minimum follow-up cost applied for unclear or minimal task",
          );
        }
      } else if (object.complexity <= 2) {
        creditCost = 1.5; // Simple tasks (minimum follow-up cost)
      } else if (object.complexity <= 3) {
        creditCost = 2.0; // Simple to moderate
      } else if (object.complexity <= 4) {
        creditCost = 3.0; // Moderate tasks
      } else if (object.complexity <= 5) {
        creditCost = 5.0; // Upper moderate
      } else if (object.complexity <= 6) {
        creditCost = 8.0; // Complex tasks
      } else if (object.complexity <= 7) {
        creditCost = 10.0; // Upper complex
      } else if (object.complexity <= 8) {
        creditCost = 12.0; // Very complex
      } else {
        creditCost = 15.0; // Advanced tasks (maximum follow-up cost)
      }

      // Final safety check for follow-ups - never allow less than 1.5 credits
      creditCost = Math.max(1.5, creditCost);
    }

    let finalCreditCost = creditCost;
    let adjustedForMinimumBalance = false;
    let originalCreditCost: number | undefined;

    // If userId is provided, check if operation would violate minimum balance
    if (userId) {
      const affordabilityCheck = await CreditManager.canAffordOperation(
        userId,
        creditCost,
      );

      if (
        !affordabilityCheck.canAfford &&
        affordabilityCheck.reason?.includes("Minimum balance")
      ) {
        // User can't afford this operation due to minimum balance requirement
        // Calculate the maximum they can actually spend
        const currentBalance = affordabilityCheck.currentBalance || 0;
        const minimumBalance = CreditManager.getMinimumBalance();
        const maxAffordable = Math.max(0, currentBalance - minimumBalance);

        if (maxAffordable > 0) {
          originalCreditCost = creditCost;
          finalCreditCost = Math.round(maxAffordable * 100) / 100; // Round to 2 decimal places
          adjustedForMinimumBalance = true;

          // Add a factor explaining the adjustment
          object.factors.push(
            `Credit cost adjusted from ${originalCreditCost} to ${finalCreditCost} due to minimum balance requirement`,
          );
        }
      }
    }

    console.log("[ComplexityAnalyzer] Cost from OpenRouter:");
    console.log("  - Input tokens:", usage?.inputTokens);
    console.log("  - Output tokens:", usage?.outputTokens);
    console.log("  - Reasoning tokens:", usage?.reasoningTokens);
    console.log("  - Actual cost from provider:", openRouterCost);
    console.log("  - Provider metadata:", JSON.stringify(providerMetadata));

    // Calculate recommended steps based on complexity category
    let recommendedSteps: number;
    switch (object.category) {
      case "simple":
        recommendedSteps = 30;
        break;
      case "moderate":
        recommendedSteps = 30;
        break;
      case "complex":
        recommendedSteps = 30;
        break;
      case "advanced":
        recommendedSteps = 30;
        break;
      default:
        recommendedSteps = 30; // Default to moderate
    }

    return {
      complexity: Math.round(object.complexity * 10) / 10,
      description: object.description,
      creditCost: finalCreditCost,
      category: object.category,
      factors: object.factors,
      adjustedForMinimumBalance,
      originalCreditCost,
      recommendedTemplate: object.recommendedTemplate || "tanstack-template", // Default to modern TanStack template
      openRouterCost, // Return actual cost for billing calculation
      recommendedSteps, // Dynamic step allocation
      isBackendTask: object.isBackendTask, // Backend tasks use Opus
    };
  } catch (error) {
    console.error("Error analyzing prompt complexity:", error);

    const latency = (Date.now() - startTime) / 1000;

    // Track complexity analysis error
    if (userId && traceId) {
      try {
        await postHog.captureAIGeneration({
          distinct_id: userId,
          $ai_trace_id: traceId,
          $ai_span_id: spanId,
          $ai_span_name: "complexity_analysis",
          $ai_model: "google/gemini-3-flash-preview",
          $ai_provider: "openrouter",
          $ai_input: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Analyze complexity: ${prompt}`,
                },
              ],
            },
          ],
          $ai_output_choices: [],
          $ai_input_tokens: 0,
          $ai_output_tokens: 0,
          $ai_latency: latency,
          $ai_http_status: 500,
          $ai_base_url: "https://openrouter.ai/api/v1",
          $ai_request_url: "https://openrouter.ai/api/v1/chat/completions",
          $ai_is_error: true,
          $ai_error: error instanceof Error ? error.message : String(error),
          // Custom properties
          feature: "complexity-analysis",
          ...(projectId && { projectId }),
          ...(projectName && { projectName }),
          ...getEnvironmentProperties(),
        });
      } catch (trackingError) {
        console.error(
          "[PostHog] Failed to track complexity analysis error:",
          trackingError,
        );
      }
    }

    // Fallback to simple analysis - respect first message pricing
    let fallbackCost = isFirstMessage ? 4.0 : 1.5; // First message: 4 credits, Follow-up: 1.5 credits minimum
    let adjustedForMinimumBalance = false;
    let originalCreditCost: number | undefined;

    // Even in fallback, check minimum balance if userId provided
    if (userId) {
      try {
        const affordabilityCheck = await CreditManager.canAffordOperation(
          userId,
          fallbackCost,
        );

        if (
          !affordabilityCheck.canAfford &&
          affordabilityCheck.reason?.includes("Minimum balance")
        ) {
          const currentBalance = affordabilityCheck.currentBalance || 0;
          const minimumBalance = CreditManager.getMinimumBalance();
          const maxAffordable = Math.max(0, currentBalance - minimumBalance);

          if (maxAffordable > 0) {
            originalCreditCost = fallbackCost;
            fallbackCost = Math.round(maxAffordable * 100) / 100;
            adjustedForMinimumBalance = true;
          }
        }
      } catch (creditCheckError) {
        console.error("Error checking credits in fallback:", creditCheckError);
      }
    }

    return {
      complexity: 1.0, // Ensure minimum complexity of 1
      description: isFirstMessage
        ? "Initial project setup (fallback analysis)"
        : "Basic task (fallback analysis)",
      creditCost: Math.max(isFirstMessage ? 4.0 : 1.5, fallbackCost), // Ensure minimum cost based on message type
      category: "simple",
      factors: [
        "Fallback analysis due to AI error",
        isFirstMessage
          ? "Initial build - standard cost applied"
          : "Minimum follow-up cost applied",
      ],
      adjustedForMinimumBalance,
      originalCreditCost,
      recommendedTemplate: "tanstack-template", // Default to modern TanStack template for fallback
      openRouterCost: 0, // No cost data available in fallback
      recommendedSteps: 12, // Default to simple task steps in fallback
    };
  }
}
