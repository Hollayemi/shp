/**
 * Planning Questions Generator Service
 *
 * Generates clarifying questions based on user prompts to help refine project requirements
 * before the actual build process begins. This powers the "Chat Mode" feature.
 */

import { generateObject } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import { nanoid } from "nanoid";
import {
  getPostHogCapture,
  generateSpanId,
  getEnvironmentProperties,
} from "./posthog-capture.js";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

// Schema for a single planning question option
const questionOptionSchema = z.object({
  id: z.string().describe("Unique identifier for this option"),
  label: z.string().describe("Short label for the option (1-5 words)"),
  description: z.string().optional().describe("Longer description explaining the option"),
});

// Schema for a single planning question
const planningQuestionSchema = z.object({
  id: z.string().describe("Unique identifier for this question"),
  question: z.string().describe("The question to ask the user"),
  category: z.enum(["features", "design", "technical", "audience", "scope"])
    .describe("Category of the question"),
  questionType: z.enum(["single", "multiple"])
    .describe("Whether the user can select one or multiple options"),
  options: z.array(questionOptionSchema)
    .min(2)
    .max(4)
    .describe("2-4 predefined answer options"),
  allowCustomAnswer: z.boolean().default(true)
    .describe("Whether the user can type a custom answer"),
  required: z.boolean().default(false)
    .describe("Whether this question must be answered"),
});

// Schema for the complete AI response
const planningQuestionsResponseSchema = z.object({
  projectSummary: z.string().describe("Brief summary of what the user wants to build"),
  questions: z.array(planningQuestionSchema)
    .min(3)
    .max(6)
    .describe("3-6 clarifying questions to help refine the project requirements"),
});

export interface PlanningQuestionOption {
  id: string;
  label: string;
  description?: string;
}

export interface PlanningQuestion {
  id: string;
  question: string;
  category: "features" | "design" | "technical" | "audience" | "scope";
  questionType: "single" | "multiple";
  options: PlanningQuestionOption[];
  allowCustomAnswer: boolean;
  required: boolean;
}

export interface GeneratePlanningQuestionsResult {
  sessionId: string;
  projectSummary: string;
  questions: PlanningQuestion[];
  openRouterCost?: number;
}

export interface PlanningAnswer {
  questionId: string;
  selectedOptions: string[];
  customAnswer?: string;
}

export interface RefinedPromptResult {
  refinedPrompt: string;
  summary: string;
  keyFeatures: string[];
  targetAudience?: string;
  designPreferences?: string;
}

/**
 * Generate clarifying questions based on the user's initial prompt
 */
export async function generatePlanningQuestions(
  prompt: string,
  userId?: string,
  traceId?: string,
): Promise<GeneratePlanningQuestionsResult> {
  const postHog = getPostHogCapture();
  const startTime = Date.now();
  const spanId = generateSpanId();
  const sessionId = nanoid();

  try {
    const response = await generateObject({
      model: openrouter("google/gemini-3-flash-preview", {
        extraBody: {
          usage: { include: true },
          user: userId || "anonymous",
        },
      }),
      schema: planningQuestionsResponseSchema,
      experimental_telemetry: { isEnabled: true },
      prompt: `You are a friendly product advisor helping someone plan their app. Your users are NOT technical - they are entrepreneurs, small business owners, and creators who have an idea but don't know coding terms.

User's idea: "${prompt}"

Generate 3-5 simple questions to understand what they want to build.

CRITICAL - USE SIMPLE LANGUAGE:
- Write like you're talking to a friend, not a developer
- NO technical jargon: avoid words like "dynamic data", "authentication", "API", "backend", "database", "integration", "schema", "endpoint"
- Instead of "authentication" ask "Do users need to sign in?"
- Instead of "dynamic data" ask "Will the content change over time or stay the same?"
- Instead of "API integration" ask "Do you need to connect to other services like payments or email?"

GOOD QUESTION EXAMPLES:
- "Who will be using this?" → "Just me", "My team", "Customers/public"
- "Do people need to create accounts?" → "No, anyone can use it", "Yes, users should sign in"
- "How should it look?" → "Simple and clean", "Bold and colorful", "Professional and elegant"
- "What's most important to include first?" → list 3-4 key features as options
- "Will you need to accept payments?" → "No", "Yes, one-time purchases", "Yes, subscriptions"

BAD QUESTIONS TO AVOID:
- "Does it need to handle dynamic data?" ❌
- "What authentication method?" ❌
- "Do you need a REST API?" ❌
- "What database structure?" ❌
- Any question a non-technical person wouldn't understand ❌

Your task:
1. Briefly summarize what you think they want (1-2 sentences, simple language)
2. Generate 3-5 questions that help clarify their vision
3. Each question should have 2-4 simple answer options
4. Focus on: who uses it, what it does, how it looks, what's most important`,
    });

    const { object, usage, providerMetadata } = response;
    const latency = (Date.now() - startTime) / 1000;
    const metadata = providerMetadata as { openrouter?: { usage?: { cost?: number } } } | undefined;
    const openRouterCost = metadata?.openrouter?.usage?.cost ?? 0;

    // Track successful generation
    if (userId && traceId) {
      try {
        await postHog.captureAIGeneration({
          distinct_id: userId,
          $ai_trace_id: traceId,
          $ai_span_id: spanId,
          $ai_span_name: "planning_questions_generation",
          $ai_model: "google/gemini-3-flash-preview",
          $ai_provider: "openrouter",
          $ai_input: [{ role: "user" as const, content: [{ type: "text" as const, text: `Generate planning questions: ${prompt}` }] }],
          $ai_output_choices: [{ role: "assistant" as const, content: [{ type: "text" as const, text: JSON.stringify(object) }] }],
          $ai_input_tokens: (usage as { inputTokens?: number })?.inputTokens ?? 0,
          $ai_output_tokens: (usage as { outputTokens?: number })?.outputTokens ?? 0,
          $ai_total_cost_usd: openRouterCost,
          $ai_latency: latency,
          $ai_http_status: 200,
          $ai_is_error: false,
          feature: "planning-questions",
          ...getEnvironmentProperties(),
        });
      } catch (trackingError) {
        console.error("[PostHog] Failed to track planning questions generation:", trackingError);
      }
    }

    // Map AI response to our format with generated IDs
    const questions: PlanningQuestion[] = object.questions.map((q, index) => ({
      id: q.id || `q-${index + 1}`,
      question: q.question,
      category: q.category,
      questionType: q.questionType,
      options: q.options.map((opt, optIndex) => ({
        id: opt.id || `opt-${index + 1}-${optIndex + 1}`,
        label: opt.label,
        description: opt.description,
      })),
      allowCustomAnswer: q.allowCustomAnswer ?? true,
      required: q.required ?? false,
    }));

    return {
      sessionId,
      projectSummary: object.projectSummary,
      questions,
      openRouterCost,
    };
  } catch (error) {
    console.error("[PlanningQuestions] Error generating questions:", error);

    const latency = (Date.now() - startTime) / 1000;

    // Track error
    if (userId && traceId) {
      try {
        await postHog.captureAIGeneration({
          distinct_id: userId,
          $ai_trace_id: traceId,
          $ai_span_id: spanId,
          $ai_span_name: "planning_questions_generation",
          $ai_model: "google/gemini-3-flash-preview",
          $ai_provider: "openrouter",
          $ai_input: [{ role: "user", content: [{ type: "text", text: `Generate planning questions: ${prompt}` }] }],
          $ai_output_choices: [],
          $ai_latency: latency,
          $ai_http_status: 500,
          $ai_is_error: true,
          $ai_error: error instanceof Error ? error.message : String(error),
          feature: "planning-questions",
          ...getEnvironmentProperties(),
        });
      } catch (trackingError) {
        console.error("[PostHog] Failed to track planning questions error:", trackingError);
      }
    }

    // Return fallback questions for common scenarios
    return generateFallbackQuestions(prompt, sessionId);
  }
}

/**
 * Generate a refined prompt based on the user's answers to planning questions
 */
export async function refinePlanningPrompt(
  originalPrompt: string,
  projectSummary: string,
  questions: PlanningQuestion[],
  answers: PlanningAnswer[],
  userId?: string,
  traceId?: string,
): Promise<RefinedPromptResult> {
  const postHog = getPostHogCapture();
  const startTime = Date.now();
  const spanId = generateSpanId();

  // Build context from questions and answers
  const qaContext = questions.map(q => {
    const answer = answers.find(a => a.questionId === q.id);
    if (!answer) return null;

    const selectedLabels = q.options
      .filter(opt => answer.selectedOptions.includes(opt.id))
      .map(opt => opt.label);

    const answerText = answer.customAnswer
      ? answer.customAnswer
      : selectedLabels.join(", ");

    return `Q: ${q.question}\nA: ${answerText}`;
  }).filter(Boolean).join("\n\n");

  const refinedPromptSchema = z.object({
    refinedPrompt: z.string().describe("Enhanced version of the original prompt with all clarifications incorporated"),
    summary: z.string().describe("Brief summary of what will be built"),
    keyFeatures: z.array(z.string()).describe("List of key features to implement"),
    targetAudience: z.string().optional().describe("Target audience for the app"),
    designPreferences: z.string().optional().describe("Design style preferences"),
  });

  try {
    const response = await generateObject({
      model: openrouter("google/gemini-3-flash-preview", {
        extraBody: {
          usage: { include: true },
          user: userId || "anonymous",
        },
      }),
      schema: refinedPromptSchema,
      experimental_telemetry: { isEnabled: true },
      prompt: `Based on the user's original request and their answers to clarifying questions, create an enhanced project description.

ORIGINAL REQUEST:
"${originalPrompt}"

PROJECT UNDERSTANDING:
${projectSummary}

CLARIFYING QUESTIONS & ANSWERS:
${qaContext}

Create:
1. A refined, detailed prompt that incorporates all the clarifications
2. A brief summary (1-2 sentences) of what will be built
3. A list of key features to implement
4. Target audience (if discussed)
5. Design preferences (if discussed)

The refined prompt should be clear, specific, and actionable for a developer to implement.
Keep the user's original intent while adding the specific details from their answers.`,
    });

    const { object, usage, providerMetadata } = response;
    const latency = (Date.now() - startTime) / 1000;
    const metadata = providerMetadata as { openrouter?: { usage?: { cost?: number } } } | undefined;
    const openRouterCost = metadata?.openrouter?.usage?.cost ?? 0;

    // Track successful refinement
    if (userId && traceId) {
      try {
        await postHog.captureAIGeneration({
          distinct_id: userId,
          $ai_trace_id: traceId,
          $ai_span_id: spanId,
          $ai_span_name: "planning_prompt_refinement",
          $ai_model: "google/gemini-3-flash-preview",
          $ai_provider: "openrouter",
          $ai_input: [{ role: "user" as const, content: [{ type: "text" as const, text: "Refine planning prompt" }] }],
          $ai_output_choices: [{ role: "assistant" as const, content: [{ type: "text" as const, text: JSON.stringify(object) }] }],
          $ai_input_tokens: (usage as { inputTokens?: number })?.inputTokens ?? 0,
          $ai_output_tokens: (usage as { outputTokens?: number })?.outputTokens ?? 0,
          $ai_total_cost_usd: openRouterCost,
          $ai_latency: latency,
          $ai_http_status: 200,
          $ai_is_error: false,
          feature: "planning-refinement",
          ...getEnvironmentProperties(),
        });
      } catch (trackingError) {
        console.error("[PostHog] Failed to track prompt refinement:", trackingError);
      }
    }

    return {
      refinedPrompt: object.refinedPrompt,
      summary: object.summary,
      keyFeatures: object.keyFeatures,
      targetAudience: object.targetAudience,
      designPreferences: object.designPreferences,
    };
  } catch (error) {
    console.error("[PlanningQuestions] Error refining prompt:", error);

    // Fallback: combine original prompt with answers
    const fallbackFeatures: string[] = [];
    answers.forEach(answer => {
      const q = questions.find(q => q.id === answer.questionId);
      if (q && answer.selectedOptions.length > 0) {
        const selectedLabels = q.options
          .filter(opt => answer.selectedOptions.includes(opt.id))
          .map(opt => opt.label);
        fallbackFeatures.push(...selectedLabels);
      }
      if (answer.customAnswer) {
        fallbackFeatures.push(answer.customAnswer);
      }
    });

    return {
      refinedPrompt: `${originalPrompt}\n\nAdditional requirements:\n${fallbackFeatures.map(f => `- ${f}`).join("\n")}`,
      summary: projectSummary,
      keyFeatures: fallbackFeatures,
    };
  }
}

/**
 * Generate fallback questions when AI generation fails
 */
function generateFallbackQuestions(prompt: string, sessionId: string): GeneratePlanningQuestionsResult {
  const promptLower = prompt.toLowerCase();

  // Detect project type hints
  const isLandingPage = promptLower.includes("landing") || promptLower.includes("marketing");
  const isDashboard = promptLower.includes("dashboard") || promptLower.includes("admin");
  const isEcommerce = promptLower.includes("shop") || promptLower.includes("store") || promptLower.includes("ecommerce");

  const questions: PlanningQuestion[] = [
    {
      id: "q-audience",
      question: "Who will be using this app?",
      category: "audience",
      questionType: "single",
      options: [
        { id: "opt-1-1", label: "Just me", description: "Personal project for your own use" },
        { id: "opt-1-2", label: "Small team", description: "Internal tool for a team or company" },
        { id: "opt-1-3", label: "Public users", description: "Customer-facing application" },
      ],
      allowCustomAnswer: true,
      required: true,
    },
    {
      id: "q-auth",
      question: "What kind of user authentication do you need?",
      category: "technical",
      questionType: "single",
      options: [
        { id: "opt-2-1", label: "None needed", description: "Public access, no login required" },
        { id: "opt-2-2", label: "Simple login", description: "Basic email/password authentication" },
        { id: "opt-2-3", label: "Social login", description: "Sign in with Google, GitHub, etc." },
        { id: "opt-2-4", label: "Full auth system", description: "Roles, permissions, teams" },
      ],
      allowCustomAnswer: true,
      required: false,
    },
    {
      id: "q-design",
      question: "What design style are you looking for?",
      category: "design",
      questionType: "single",
      options: [
        { id: "opt-3-1", label: "Minimal & clean", description: "Simple, lots of white space" },
        { id: "opt-3-2", label: "Modern & colorful", description: "Vibrant, contemporary design" },
        { id: "opt-3-3", label: "Professional", description: "Corporate, business-appropriate" },
        { id: "opt-3-4", label: "Dark mode", description: "Dark theme by default" },
      ],
      allowCustomAnswer: true,
      required: false,
    },
    {
      id: "q-scope",
      question: "What's your goal for the first version?",
      category: "scope",
      questionType: "single",
      options: [
        { id: "opt-4-1", label: "MVP - Core features only", description: "Get something working fast" },
        { id: "opt-4-2", label: "Feature-complete", description: "All planned features included" },
        { id: "opt-4-3", label: "Prototype", description: "Visual demo, limited functionality" },
      ],
      allowCustomAnswer: true,
      required: false,
    },
  ];

  // Add context-specific questions
  if (isDashboard || isEcommerce) {
    questions.splice(2, 0, {
      id: "q-data",
      question: "What data do you need to manage?",
      category: "features",
      questionType: "multiple",
      options: [
        { id: "opt-data-1", label: "Users/Customers" },
        { id: "opt-data-2", label: "Products/Items" },
        { id: "opt-data-3", label: "Orders/Transactions" },
        { id: "opt-data-4", label: "Analytics/Reports" },
      ],
      allowCustomAnswer: true,
      required: false,
    });
  }

  return {
    sessionId,
    projectSummary: `Building a project based on: "${prompt.slice(0, 100)}${prompt.length > 100 ? "..." : ""}"`,
    questions: questions.slice(0, 5), // Max 5 fallback questions
  };
}
