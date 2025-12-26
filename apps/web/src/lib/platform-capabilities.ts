/**
 * Platform Capabilities
 * Defines all available features in the Builder that the Advisor can suggest
 */

export const BUILDER_CAPABILITIES = {
  aiImageGeneration: {
    name: "AI Image Generation",
    description: "Generate custom images using Replicate Flux AI model",
    costCredits: true,
    suggestWhen: [
      "user mentions placeholder images",
      "user needs custom graphics or visuals",
      "user wants branded imagery",
      "user mentions stock photos or generic images",
      "project has empty image placeholders",
    ],
    example:
      "Replace those placeholder images with AI-generated ones that match your brand. The Builder can create custom images - just describe the style you want (e.g., 'watercolor style', 'modern minimalist', 'realistic photography').",
  },

  codeGeneration: {
    name: "Full-Stack Code Generation",
    description:
      "Build complete features with AI-powered code generation in live sandbox",
    costCredits: true,
    suggestWhen: [
      "user wants to add a feature",
      "user needs functionality built",
      "user describes a user flow or interaction",
      "user mentions adding pages or components",
    ],
    example:
      "The Builder can create that feature for you. Just describe what you want it to do and how users should interact with it.",
  },
} as const;

/**
 * Build capabilities context for system prompt
 */
export function buildCapabilitiesContext(): string {
  const capabilities = Object.entries(BUILDER_CAPABILITIES);

  return `
## PLATFORM CAPABILITIES YOU CAN SUGGEST:

The Builder has these powerful features available:

${capabilities
  .map(
    ([_, cap]) => `
**${cap.name}:**
- ${cap.description}
- ${cap.costCredits ? "Costs credits (explain the value to justify the cost)" : "Free to use"}
- Suggest when: ${cap.suggestWhen.join(", ")}
- Example: "${cap.example}"
`,
  )
  .join("")}

**How to suggest these naturally:**
1. DON'T say: "Use the Full-Stack Code Generation feature" or "I'll generate images for you"
2. DO: Call the generateSuggestions tool to create actionable suggestion cards
3. ALWAYS route to Builder - YOU (Advisor) cannot execute these, only the Builder can
4. Focus on the OUTCOME and TIME SAVED, not the feature name
5. If it costs credits, mention the value in the suggestion description

**When user asks for features or shows interest:**
- ❌ WRONG: "I'll generate some custom hero images for you" (Advisor can't do this!)
- ❌ WRONG: "Want me to create a Builder task to generate custom hero images?" (Just asking, not doing)
- ✅ CORRECT: [Call generateSuggestions tool silently]
  Result: Suggestion card appears with title "Generate custom hero images" and detailed Builder prompt

**How generateSuggestions works:**
- When user asks about a feature or picks a suggestion, call generateSuggestions
- The tool creates 1-4 clickable suggestion cards
- Each card has a detailed prompt that pre-fills the Builder chat when clicked
- User clicks card → Builder opens with full prompt → Builder executes

**CRITICAL:** You (Advisor) are for ADVICE and SUGGESTIONS only. The Builder executes.
- DON'T say "I'll do it" or "Let me generate..." - you can't execute
- DON'T just talk about creating tasks - actually call generateSuggestions to create actionable cards
- DO call generateSuggestions when user shows interest in building something
`.trim();
}
