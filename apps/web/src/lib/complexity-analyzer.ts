import { generateObject } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import { CreditManager } from "./credits";
import {
  getPostHogCapture,
  generateSpanId,
  getEnvironmentProperties,
} from "./posthog-capture";

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
  recommendedTemplate: z
    .enum([
      // "vite-template",
      // "vite-todo-template",
      // "vite-landing-page-template",
      // "vite-tracker-template",
      // "vite-calculator-template",
      // "vite-content-sharing-template",
      "vite-database-template",
    ])
    .optional()
    .describe("Recommended template/snapshot based on task type."),
});

export async function analyzePromptComplexity(
  prompt: string,
  userId?: string,
  traceId?: string,
  projectId?: string,
  projectName?: string,
): Promise<ComplexityAnalysis> {
  const postHog = getPostHogCapture();
  const startTime = Date.now();
  const spanId = generateSpanId();

  try {
    const { object, usage, response } = await generateObject({
      model: openrouter("google/gemini-3-flash-preview", {
        extraBody: {
          usage: {
            include: true,
          },
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
TEMPORARY OVERRIDE: Always use "vite-database-template" for all tasks during testing phase.

IMPORTANT:
- If the task is unclear, empty, or no specific task is provided, assign a complexity of at least 1 (never 0) and categorize as "simple"
- Always provide a meaningful description even for unclear tasks
- Never assign a complexity of 0 - the minimum should be 1 for any interaction
- TEMPORARY: Always select "vite-database-template" regardless of task content`,
    });

    const latency = (Date.now() - startTime) / 1000;

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
          $ai_total_cost_usd: (response as any)?.usage?.cost || 0,
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
          openRouterGenerationId: response.id,
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

    // Calculate credit cost based on complexity using decimal pricing
    // Ensure minimum cost is always 0.5 credits to prevent bypass of minimum balance
    let creditCost: number;

    // Normalize the prompt and check for empty/unclear tasks
    const normalizedPrompt = prompt?.trim() || "";

    // Handle zero complexity or empty tasks explicitly
    if (
      object.complexity <= 0 ||
      normalizedPrompt.length < 3 ||
      object.description?.toLowerCase().includes("did not provide") ||
      object.description?.toLowerCase().includes("no task") ||
      object.factors?.some((f) => f.toLowerCase().includes("no task"))
    ) {
      creditCost = 1.0; // Minimum cost for any task, including no task provided or very short requests
      object.complexity = Math.max(1, object.complexity); // Override complexity to prevent 0 values
      object.description = object.description?.includes("did not provide")
        ? "General assistance request"
        : object.description || "Basic task";

      // Add factor if not already present
      if (!object.factors.some((f) => f.includes("Minimum"))) {
        object.factors.push(
          "Minimum complexity and cost applied for unclear or minimal task",
        );
      }
    } else if (object.complexity <= 1) {
      creditCost = 1.0; // Very simple tasks like "make button gray"
    } else if (object.complexity <= 2) {
      creditCost = 1.2; // Simple tasks like "remove footer"
    } else if (object.complexity <= 4) {
      creditCost = 1.5; // Moderate tasks like "add authentication"
    } else if (object.complexity <= 6) {
      creditCost = 2.0; // Complex tasks like "landing page with images"
    } else if (object.complexity <= 8) {
      creditCost =
        Math.round((2.0 + (object.complexity - 6) * 0.5) * 100) / 100; // 2.5-3.0 credits
    } else {
      creditCost =
        Math.round((3.0 + (object.complexity - 8) * 0.75) * 100) / 100; // 3.75+ credits for advanced
    }

    // Final safety check - never allow less than 1 credit cost
    creditCost = Math.max(1.0, creditCost);

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

    return {
      complexity: Math.round(object.complexity * 10) / 10,
      description: object.description,
      creditCost: finalCreditCost,
      category: object.category,
      factors: object.factors,
      adjustedForMinimumBalance,
      originalCreditCost,
      recommendedTemplate: "vite-database-template", // TEMPORARY OVERRIDE: Always use vite-database-template
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

    // Fallback to simple analysis - ensure minimum cost
    let fallbackCost = 1.0; // Always use minimum cost for fallback
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
      description: "Basic task (fallback analysis)",
      creditCost: Math.max(1.0, fallbackCost), // Ensure minimum cost
      category: "simple",
      factors: ["Fallback analysis due to AI error", "Minimum cost applied"],
      adjustedForMinimumBalance,
      originalCreditCost,
      recommendedTemplate: "vite-database-template", // TEMPORARY OVERRIDE: Always use vite-database-template
    };
  }
}
