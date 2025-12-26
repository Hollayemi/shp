import { protectedProcedure, createTRPCRouter } from "@/trpc/init";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";
import { CreditManager } from "@/lib/credits";
import {
  getPostHogCapture,
  generateSpanId,
  generateTraceId,
  getEnvironmentProperties,
} from "@/lib/posthog-capture";
import { IMAGE_STYLE_ANALYZER_PROMPT } from "../prompts/image-style-analyzer";
import { PROMPT_ENHANCER_PROMPT } from "../prompts/prompt-enhancer";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const postHog = getPostHogCapture();

export const promptsRouter = createTRPCRouter({
  analyzeStyleImage: protectedProcedure
    .input(
      z.object({
        imageUrl: z.string().url(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { imageUrl } = input;
      const startTime = Date.now();
      const traceId = generateTraceId();
      const spanId = generateSpanId();

      // Validate image URL format
      // const validExtensions = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
      // const urlLower = imageUrl.toLowerCase();
      // const isValidImage = validExtensions.some((ext) =>
      //   urlLower.includes(ext)
      // );

      // if (!isValidImage) {
      //   throw new TRPCError({
      //     code: "BAD_REQUEST",
      //     message: "Invalid image URL format. Please provide a valid image URL.",
      //   });
      // }

      // Check and deduct credits for image analysis (1 credit per analysis)
      const creditCost = 1;
      try {
        await CreditManager.deductCredits(
          ctx.user.id,
          creditCost,
          "AI_GENERATION",
          `Image style analysis: "${imageUrl.substring(0, 50)}..."`,
          { imageUrl: imageUrl.substring(0, 100) }
        );
      } catch (error) {
        throw new TRPCError({
          code: "PAYMENT_REQUIRED",
          message:
            "Insufficient credits. Please purchase credits to analyze image styles.",
        });
      }

      console.log("[PromptsRouter] Analyzing image:", imageUrl);

      try {
        // Use AI to analyze the image and extract styling instructions
        const response = await generateText({
          model: openrouter("google/gemini-3-flash-preview"),
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: IMAGE_STYLE_ANALYZER_PROMPT,
                },
                {
                  type: "image",
                  image: imageUrl,
                },
              ],
            },
          ],
        });

        const { text: stylePrompt, usage } = response;
        const latency = (Date.now() - startTime) / 1000;

        console.log("[PromptsRouter] Generated style prompt:", stylePrompt);

        // Ensure the prompt doesn't exceed 850 characters
        let finalPrompt = stylePrompt.trim();
        if (finalPrompt.length > 850) {
          console.warn(
            `[PromptsRouter] Prompt exceeded 850 chars (${finalPrompt.length}), truncating...`
          );
          // Truncate at last complete sentence within 850 chars
          finalPrompt = finalPrompt.substring(0, 850);
          const lastPeriod = finalPrompt.lastIndexOf(".");
          if (lastPeriod > 600) {
            // Only truncate at sentence if we have enough content
            finalPrompt = finalPrompt.substring(0, lastPeriod + 1);
          }
        }

        console.log(
          `[PromptsRouter] Final prompt length: ${finalPrompt.length} chars`
        );

        // Track successful image style analysis
        if (ctx.user.id && traceId) {
          try {
            await postHog.captureAIGeneration({
              distinct_id: ctx.user.id,
              $ai_trace_id: traceId,
              $ai_span_id: spanId,
              $ai_span_name: "image_style_analysis",
              $ai_model: "google/gemini-3-flash-preview",
              $ai_provider: "openrouter",
              $ai_input: [
                {
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text: `Analyze image style: ${imageUrl.substring(0, 100)}`,
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
                      text: finalPrompt,
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
              // Custom properties
              image_url: imageUrl.substring(0, 100),
              style_prompt_length: finalPrompt.length,
              feature: "image-style-analysis",
              openRouterGenerationId: (response as any).id,
              ...getEnvironmentProperties(),
            });
          } catch (trackingError) {
            console.error(
              "[PostHog] Failed to track image style analysis:",
              trackingError,
            );
          }
        }

        return {
          stylePrompt: finalPrompt,
          imageUrl,
        };
      } catch (error) {
        console.error("[PromptsRouter] Error analyzing image:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to analyze image style",
        });
      }
    }),

  enhancePrompt: protectedProcedure
    .input(
      z.object({
        prompt: z.string().min(5, "Prompt must be at least 5 characters"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { prompt } = input;
      const startTime = Date.now();
      const traceId = generateTraceId();
      const spanId = generateSpanId();

      // Validate prompt length
      if (prompt.length > 2000) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Prompt is too long. Maximum 2000 characters allowed.",
        });
      }

      // Check and deduct credits for prompt enhancement (1 credit per enhancement)
      const creditCost = 1;
      try {
        await CreditManager.deductCredits(
          ctx.user.id,
          creditCost,
          "AI_GENERATION",
          `Prompt enhancement: "${prompt.substring(0, 50)}..."`,
          { originalPrompt: prompt.substring(0, 100) }
        );
      } catch (error) {
        throw new TRPCError({
          code: "PAYMENT_REQUIRED",
          message:
            "Insufficient credits. Please purchase credits to enhance prompts.",
        });
      }

      console.log("[PromptsRouter] Enhancing prompt:", prompt.substring(0, 100));

      try {
        // Use AI to enhance the prompt
        const response = await generateText({
          model: openrouter("google/gemini-3-flash-preview"),
          messages: [
            {
              role: "system",
              content: PROMPT_ENHANCER_PROMPT,
            },
            {
              role: "user",
              content: prompt,
            },
          ],
        });

        const { text: enhancedPrompt, usage } = response;
        const latency = (Date.now() - startTime) / 1000;

        console.log("[PromptsRouter] Generated enhanced prompt:", enhancedPrompt.substring(0, 100));

        // Remove bold formatting (**text**)
        let finalPrompt = enhancedPrompt.trim().replace(/\*\*([^*]+)\*\*/g, '$1');
        if (finalPrompt.length > 2000) {
          console.warn(
            `[PromptsRouter] Enhanced prompt exceeded 2000 chars (${finalPrompt.length}), truncating...`
          );
          // Truncate at last complete sentence within 2000 chars
          finalPrompt = finalPrompt.substring(0, 2000);
          const lastPeriod = finalPrompt.lastIndexOf(".");
          if (lastPeriod > 1500) {
            finalPrompt = finalPrompt.substring(0, lastPeriod + 1);
          }
        }

        console.log(
          `[PromptsRouter] Final enhanced prompt length: ${finalPrompt.length} chars`
        );

        // Track successful prompt enhancement
        if (ctx.user.id && traceId) {
          try {
            await postHog.captureAIGeneration({
              distinct_id: ctx.user.id,
              $ai_trace_id: traceId,
              $ai_span_id: spanId,
              $ai_span_name: "prompt_enhancement",
              $ai_model: "google/gemini-3-flash-preview",
              $ai_provider: "openrouter",
              $ai_input: [
                {
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text: prompt.substring(0, 200),
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
                      text: finalPrompt.substring(0, 200),
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
              // Custom properties
              original_prompt_length: prompt.length,
              enhanced_prompt_length: finalPrompt.length,
              feature: "prompt-enhancement",
              openRouterGenerationId: (response as any).id,
              ...getEnvironmentProperties(),
            });
          } catch (trackingError) {
            console.error(
              "[PostHog] Failed to track prompt enhancement:",
              trackingError,
            );
          }
        }

        return {
          enhancedPrompt: finalPrompt,
          originalPrompt: prompt,
        };
      } catch (error) {
        console.error("[PromptsRouter] Error enhancing prompt:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to enhance prompt",
        });
      }
    }),
});
