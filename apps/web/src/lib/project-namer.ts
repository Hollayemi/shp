import { generateObject } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import {
  getPostHogCapture,
  generateSpanId,
  generateTraceId,
  getEnvironmentProperties,
} from "@/lib/posthog-capture";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const postHog = getPostHogCapture();

// Schema for AI-generated project metadata with multiple candidates
const projectMetadataSchema = z.object({
  candidates: z
    .array(
      z.object({
        name: z
          .string()
          .describe(
            "A human-sounding, professional brand or product name (1–3 words, natural, authentic, and easy to remember).",
          ),
      }),
    )
    .length(5)
    .describe(
      "Generate 5 distinct, creative name options that are all different from each other and from any tried names.",
    ),
  subtitle: z
    .string()
    .describe(
      "A concise tagline (6–12 words) that clearly explains what the project does and its main benefit.",
    ),
  emoji: z
    .string()
    .describe(
      "A single emoji that best represents the project's purpose, category, or tone.",
    ),
});

export type ProjectMetadata = {
  name: string;
  subtitle: string;
  logo: string; // emoji
  openRouterCost?: number; // Optional cost from OpenRouter API
  alternativeNames?: string[]; // Other generated names that weren't used
};

/**
 * Generates a natural, brand-ready project name, subtitle, and emoji from user description.
 * Now generates 5 name candidates to reduce retry costs.
 */
export async function generateProjectMetadata(
  projectDescription: string,
  userId?: string,
  options?: {
    triedNames?: string[];
    keepSubtitle?: string;
    keepEmoji?: string;
    existingNamesChecker?: (name: string) => Promise<boolean>; // Function to check if name exists
    abortSignal?: AbortSignal;
  },
): Promise<ProjectMetadata> {
  const startTime = Date.now();
  const traceId = generateTraceId();
  const spanId = generateSpanId();

  try {
    // Build the prompt with optional constraints
    const triedNamesSection = options?.triedNames?.length
      ? `\n\nNAMES ALREADY TRIED (DO NOT USE THESE):
${options.triedNames.map((name) => `- ${name}`).join("\n")}

You MUST generate a completely different name that is distinct from the ones listed above.`
      : "";

    const subtitleConstraint = options?.keepSubtitle
      ? `\n\nREQUIRED SUBTITLE (USE EXACTLY THIS):
"${options.keepSubtitle}"`
      : "";

    const emojiConstraint = options?.keepEmoji
      ? `\n\nREQUIRED EMOJI (USE EXACTLY THIS):
"${options.keepEmoji}"`
      : "";

    const response = await generateObject({
      model: openrouter("google/gemini-3-flash-preview", {
        extraBody: { 
          temperature: 0.85, // Higher creativity to reduce conflicts
          usage: { include: true }, // Enable OpenRouter cost tracking
        },
      }),
      schema: projectMetadataSchema,
      prompt: `
You are a world-class naming strategist at a top creative agency.
Generate 5 DISTINCT, creative brand names along with ONE subtitle and emoji for the project below.

PROJECT BRIEF:
"${projectDescription}"
${triedNamesSection}
${subtitleConstraint}
${emojiConstraint}

OUTPUT (JSON ONLY):
{
  "candidates": [
    {"name": "First unique name option"},
    {"name": "Second unique name option"},
    {"name": "Third unique name option"},
    {"name": "Fourth unique name option"},
    {"name": "Fifth unique name option"}
  ],
  "subtitle": "6-12 words in natural language that states the value",
  "emoji": "One emoji that best symbolizes the domain or benefit"
}

HOW TO THINK (DO NOT OUTPUT THIS SECTION):
1) Generate 5 completely different name candidates that all fit the brief.
2) Make each name DISTINCT - vary the style, length, and approach.
3) Ensure at least one meaningful root/synonym from the brief informs the names or subtitle.
4) Mix different approaches: single words, two-word combos, metaphors, etc.


NAME RULES (CRITICAL):
- Generate 5 COMPLETELY DIFFERENT names - vary style, length, and approach.
- Ground names in the brief with relevant roots, synonyms, or on-brief metaphors.
- Tasteful human mashups are encouraged (e.g., Brightline, Riverstone, Harborlight, Northwind, Copper Spoon, Echo Valley, Field Guide, Paper Harbor).
- Single invented words must read like real brands (Notion, Figma, Loom, Asana)—no random syllable soup.
- Title Case for names. No punctuation or hyphens.
- Do not reuse any example name verbatim.
- IMPORTANT: Be HIGHLY creative and specific. Each name should be distinctive and unique.
- Mix approaches: try single words, two-word combos, metaphors, domain-specific terms, etc.

SUBTITLE RULES:
- 6–12 words; confident landing‑page tone.
- Include a domain keyword or polished synonym from the brief.
- Sentence case; no buzzword soup or filler.

EMOJI RULES:
- Exactly one emoji.
- Choose the clearest iconic symbol for the category (✍️ write/sign, 🧭 navigate/plan, 🛒 shop, 🎧 music, 🌿 wellness, 📚 learning, 💬 chat, 💰 finance, 📝 notes, 📦 logistics, 🧪 science, 🧰 tools).
- Keep professional unless the brief implies playful.

DO NOT:
- Use formulaic tech mashups (TaskFlow, DataHub, QuickCloud, SyncPro).
- Spam prefixes/suffixes (Smart-, Insta-, -ify, -hub, -pro) unless it truly reads like an established brand.
- Include "app", "AI", "GPT", "bot" in the name.
- Drift into metaphors unrelated to the brief.

SELF‑CHECK BEFORE OUTPUT:
- Is the name clearly tied to the brief’s domain or benefit?
- Would a human confidently present this on a pitch deck?
- Does the subtitle communicate value immediately?

REFERENCE OUTPUTS (DO NOT COPY NAMES):
Input: "Collaborative whiteboard for remote teams"
Output: { 
  "candidates": [
    {"name": "Canvas North"},
    {"name": "Whiteboard Sync"},
    {"name": "Ideaflow"},
    {"name": "Sketch Together"},
    {"name": "Boardroom Live"}
  ],
  "subtitle": "Map ideas together on a shared visual workspace", 
  "emoji": "🧠" 
}

Input: "Plant care assistant with reminders"
Output: { 
  "candidates": [
    {"name": "Verdant"},
    {"name": "Green Keeper"},
    {"name": "Bloomwise"},
    {"name": "Plant Pulse"},
    {"name": "Leaf Watch"}
  ],
  "subtitle": "Keep every plant thriving with timely reminders", 
  "emoji": "🌿" 
}

Now produce the brand‑ready JSON for:
"${projectDescription}"

Return ONLY valid JSON with keys: candidates (array of 5 name objects), subtitle, emoji.
      `,
      abortSignal: options?.abortSignal,
    });

    const { object, usage, response: aiResponse, providerMetadata } = response;
    const latency = (Date.now() - startTime) / 1000;

    // Extract OpenRouter cost from provider metadata
    const openRouterCost = (providerMetadata as any)?.openrouter?.usage?.cost || 0;

    console.log("[ProjectNamer] Generated metadata:", object);
    console.log("[ProjectNamer] Generated candidates:", object.candidates.map(c => c.name));
    console.log("[ProjectNamer] Usage:");
    console.log("  - Input tokens:", usage?.inputTokens);
    console.log("  - Output tokens:", usage?.outputTokens);
    console.log("  - Reasoning tokens:", usage?.reasoningTokens);
    console.log("  - Cost from OpenRouter:", openRouterCost);
    console.log("[ProjectNamer] Provider metadata:", JSON.stringify(providerMetadata));

    // If a checker function is provided, find the first available name
    let selectedName = object.candidates[0].name;
    const alternativeNames: string[] = [];

    if (options?.existingNamesChecker) {
      for (const candidate of object.candidates) {
        const exists = await options.existingNamesChecker(candidate.name);
        if (!exists) {
          selectedName = candidate.name;
          console.log(`[ProjectNamer] Selected available name: ${selectedName}`);
          // Store the other names as alternatives
          object.candidates.forEach(c => {
            if (c.name !== selectedName) {
              alternativeNames.push(c.name);
            }
          });
          break;
        } else {
          console.log(`[ProjectNamer] Name already exists: ${candidate.name}`);
        }
      }
    } else {
      // No checker provided, use first candidate
      object.candidates.slice(1).forEach(c => alternativeNames.push(c.name));
    }

    // Track successful project naming generation
    if (userId && traceId) {
      try {
        await postHog.captureAIGeneration({
          distinct_id: userId,
          $ai_trace_id: traceId,
          $ai_span_id: spanId,
          $ai_span_name: "project_naming",
          $ai_model: "google/gemini-3-flash-preview",
          $ai_provider: "openrouter",
          $ai_input: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Generate project name: ${projectDescription}`,
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
          $ai_temperature: 0.85,
          // Custom properties
          project_name: selectedName,
          candidates_generated: object.candidates.map(c => c.name),
          project_subtitle: object.subtitle,
          project_emoji: object.emoji,
          feature: "project-naming",
          openRouterGenerationId: aiResponse.id,
          ...getEnvironmentProperties(),
        });
      } catch (trackingError) {
        console.error(
          "[PostHog] Failed to track project naming generation:",
          trackingError,
        );
      }
    }

    return {
      name: selectedName,
      subtitle: object.subtitle,
      logo: object.emoji,
      openRouterCost,
      alternativeNames,
    };
  } catch (error) {
    console.error("[ProjectNamer] Error generating metadata:", error);

    // --- Fallback ---
    const fallbackName = projectDescription
      .split(" ")
      .slice(0, 2)
      .map(
        (word: string) =>
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
      )
      .join("");

    let fallbackEmoji = "📱";
    const desc = projectDescription.toLowerCase();
    if (desc.includes("task") || desc.includes("todo")) fallbackEmoji = "✅";
    else if (desc.includes("chat") || desc.includes("message"))
      fallbackEmoji = "💬";
    else if (desc.includes("shop") || desc.includes("commerce"))
      fallbackEmoji = "🛒";
    else if (desc.includes("fitness") || desc.includes("workout"))
      fallbackEmoji = "💪";
    else if (desc.includes("recipe") || desc.includes("food"))
      fallbackEmoji = "👨‍🍳";
    else if (desc.includes("weather")) fallbackEmoji = "⛅";
    else if (desc.includes("finance") || desc.includes("money"))
      fallbackEmoji = "💰";
    else if (desc.includes("video") || desc.includes("meeting"))
      fallbackEmoji = "📹";
    else if (desc.includes("note") || desc.includes("write"))
      fallbackEmoji = "📝";

    return {
      name: fallbackName || "MyProject",
      subtitle: projectDescription.slice(0, 50),
      logo: fallbackEmoji,
      openRouterCost: 0, // No cost for fallback
    };
  }
}

/**
 * Converts project name into a clean, kebab-case slug.
 */
export function generateSlugFromName(projectName: string): string {
  return projectName
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function deslugifyProjectName(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
