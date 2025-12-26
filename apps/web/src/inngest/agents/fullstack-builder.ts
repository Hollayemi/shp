import {
  createAgent,
  createTool,
  createNetwork,
  createState,
} from "@inngest/agent-kit";
import { z } from "zod";
import { createAzureOpenAIModel } from "@/helpers/createAzureOpenAIModel";
import { CONTEXT_ANALYZER_PROMPT } from "@/lib/prompts";
import { MultiAgentState } from "@/inngest/multi-agent-workflow";
import { MOTHER_FUCKING_PROMPT } from "@/lib/prompts";
import { SandboxManager } from "@/lib/sandbox-manager";
import {
  getThemeCSS,
  getThemeList,
  BEAUTIFUL_UI_THEMES,
} from "@/lib/ui-system/theme-generator";

export const fullStackBuilder = createAgent<MultiAgentState>({
  name: "full-stack-builder",
  description:
    "Creates complete functional applications with working components",
  system: MOTHER_FUCKING_PROMPT,
  model: createAzureOpenAIModel("gpt-4.1"),
  tools: [
    createTool({
      name: "readFiles",
      description:
        "Read existing files to understand current project structure",
      parameters: z.object({
        paths: z.array(z.string()),
      }),
      handler: async ({ paths }, { network }) => {
        const results: Record<string, string> = {};

        for (const path of paths) {
          try {
            if (network.state.data.files && network.state.data.files[path]) {
              results[path] = network.state.data.files[path];
            } else {
              results[path] = "File not found in project state";
            }
          } catch (error) {
            results[path] = `Error reading file: ${error}`;
          }
        }

        return `📁 Read ${Object.keys(results).length} files:\n${Object.entries(
          results,
        )
          .map(([path, content]) => `${path}: ${content.length} chars`)
          .join("\n")}`;
      },
    }),
    createTool({
      name: "updateProjectChecklist",
      description: "Update the shared project checklist for agent coordination",
      parameters: z.object({
        completed: z.array(z.string()).optional(),
        remaining: z.array(z.string()).optional(),
        notes: z.array(z.string()).optional(),
        action: z
          .enum(["add_completed", "add_remaining", "add_note", "set_all"])
          .default("set_all"),
      }),
      handler: async ({ completed, remaining, notes, action }, { network }) => {
        if (!network.state.data.projectChecklist) {
          network.state.data.projectChecklist = {
            completed: [],
            remaining: [],
            notes: [],
          };
        }

        const checklist = network.state.data.projectChecklist;

        switch (action) {
          case "add_completed":
            if (completed) checklist.completed.push(...completed);
            break;
          case "add_remaining":
            if (remaining) checklist.remaining.push(...remaining);
            break;
          case "add_note":
            if (notes) checklist.notes.push(...notes);
            break;
          case "set_all":
          default:
            if (completed) checklist.completed = completed;
            if (remaining) checklist.remaining = remaining;
            if (notes) checklist.notes = notes;
            break;
        }

        return `✅ Project checklist updated: ${checklist.completed.length} completed, ${checklist.remaining.length} remaining`;
      },
    }),
    createTool({
      name: "createOrEditFiles",
      description: "Create or edit a file in the sandbox",
      parameters: z.object({
        path: z.string(),
        content: z.string(),
        description: z.string().optional(),
      }),
      handler: async ({ path, content, description }, { network }) => {
        console.log(
          `[fullStackBuilder] 🔥 createOrEditFiles called for file: ${path}`,
        );

        const currentSandboxId = network.state.data.sandboxId;
        console.log(`[fullStackBuilder] Sandbox ID:`, currentSandboxId);

        // Ensure files object exists
        if (!network.state.data.files) {
          network.state.data.files = {};
        }

        // Update state
        console.log(
          `[fullStackBuilder] Adding file to state: ${path} (${content.length} chars)`,
        );
        network.state.data.files[path] = content;

        console.log(
          `[fullStackBuilder] State now has ${
            Object.keys(network.state.data.files).length
          } files`,
        );

        try {
          // Update sandbox
          const filesToUpdate = { [path]: content };
          console.log(
            `[fullStackBuilder] Calling SandboxManager.updateSandboxFiles...`,
          );

          let result = await SandboxManager.updateSandboxFiles(
            currentSandboxId,
            filesToUpdate,
          );

          console.log(`[fullStackBuilder] SandboxManager result:`, result);

          // Handle sandbox recreation if needed
          if (!result.success && result.needsRecreation) {
            console.log(
              `[fullStackBuilder] 🔄 Sandbox needs recreation, attempting to create new one...`,
            );

            // Try to get project information from the network state
            const projectId = network.state.data.projectId;
            if (!projectId) {
              throw new Error("No project ID available for sandbox recreation");
            }

            console.log(
              `[fullStackBuilder] 🔄 Creating new sandbox to replace ${currentSandboxId}...`,
            );

            try {
              // Create a new sandbox with current files
              const newSandboxInfo = await SandboxManager.getOrCreateSandbox({
                userId: network.state.data.userId || "system", // Get userId from state
                projectId: projectId,
                files: network.state.data.files || {},
                forceNew: true, // Force creation of new sandbox
              });

              // Update the network state with the new sandbox info
              network.state.data.sandboxId = newSandboxInfo.sandboxId;
              network.state.data.sandboxUrl = newSandboxInfo.sandboxUrl;

              console.log(
                `[fullStackBuilder] ✅ Created new sandbox ${newSandboxInfo.sandboxId}`,
              );

              // Try updating files again with the new sandbox
              result = await SandboxManager.updateSandboxFiles(
                newSandboxInfo.sandboxId,
                filesToUpdate,
              );

              if (!result.success) {
                throw new Error(
                  `Failed to update files in new sandbox: ${JSON.stringify(
                    result,
                  )}`,
                );
              }
            } catch (recreationError) {
              console.error(
                `[fullStackBuilder] 🚨 Failed to recreate sandbox:`,
                recreationError,
              );
              throw new Error(`Failed to recreate sandbox: ${recreationError}`);
            }
          }

          if (!result.success) {
            console.error(
              `[fullStackBuilder] 🚨 Sandbox update failed:`,
              result,
            );
            throw new Error(
              `Failed to update file in sandbox: ${JSON.stringify(result)}`,
            );
          }

          console.log(
            `[fullStackBuilder] ✅ Successfully created/updated file: ${path}`,
          );

          return `Successfully created/updated file: ${path}${description ? ` - ${description}` : ""}`;
        } catch (error) {
          console.error(`[fullStackBuilder] Error updating file:`, error);
          throw error;
        }
      },
    }),
    createTool({
      name: "smartThemeSelector",
      description:
        "Select best theme based on project analysis with improved semantic scoring",
      parameters: z.object({
        userRequest: z.string().describe("User's project description"),
        showReasoning: z
          .boolean()
          .default(true)
          .describe("Show selection reasoning"),
      }),
      handler: async ({ userRequest, showReasoning }, { network }) => {
        try {
          const request = userRequest.toLowerCase();
          const themes = Object.values(BEAUTIFUL_UI_THEMES);

          const scored = themes.map((theme) => {
            let score = 0;
            const reasons: string[] = [];

            // 1. PROJECT TYPE MATCHING (Reduced weight: 20 pts max)
            if (theme.projectTypes) {
              const projectMatches = theme.projectTypes.filter((type) =>
                request.includes(type.toLowerCase()),
              );
              if (projectMatches.length > 0) {
                score += projectMatches.length * 15;
                reasons.push(`✅ Project type: ${projectMatches.join(", ")}`);
              }
            }

            // 2. STYLE/PERSONALITY MATCHING (Higher weight: 25 pts max)
            if (theme.personality) {
              const personalityMatches = theme.personality.filter((trait) =>
                request.includes(trait.toLowerCase()),
              );
              if (personalityMatches.length > 0) {
                score += personalityMatches.length * 20; // Increased!
                reasons.push(
                  `✅ Style match: ${personalityMatches.join(", ")}`,
                );
              }
            }

            // 3. TAG MATCHING (15 pts max)
            if (theme.tags) {
              const tagMatches = theme.tags.filter((tag) =>
                request.includes(tag.toLowerCase()),
              );
              if (tagMatches.length > 0) {
                score += tagMatches.length * 10;
                reasons.push(`✅ Tags: ${tagMatches.join(", ")}`);
              }
            }

            // 4. SMART COMBINATION BONUS (10 pts max)
            // Just check if style words + project words both match
            const hasStyleMatch = theme.personality?.some((trait) =>
              request.includes(trait.toLowerCase()),
            );
            const hasProjectMatch = theme.projectTypes?.some((type) =>
              request.includes(type.toLowerCase()),
            );

            // If user wants style + project combo, but theme only matches style, give bonus
            if (
              hasStyleMatch &&
              !hasProjectMatch &&
              request.split(" ").length > 1
            ) {
              score += 15; // Bonus for style-first requests
              reasons.push(`🌟 Style-focused match`);
            }

            // 5. DESCRIPTION MATCHING (5 pts max)
            const descWords = theme.description.toLowerCase().split(" ");
            const requestWords = request.split(" ");
            const commonWords = descWords.filter(
              (word) => requestWords.includes(word) && word.length > 3,
            );
            if (commonWords.length > 0) {
              score += Math.min(commonWords.length * 2, 5);
              reasons.push(`📝 Description: ${commonWords.join(", ")}`);
            }

            return { theme, score, reasons };
          });

          // Sort by score
          scored.sort((a, b) => b.score - a.score);

          if (scored[0].score === 0) {
            const availableThemes = themes
              .map((t) => `• ${t.name}: ${t.description}`)
              .join("\n");

            return `❌ No themes matched "${userRequest}". Available themes:\n${availableThemes}`;
          }

          // Select best theme
          const best = scored[0];
          const selected = best.theme;

          // Store in network state
          network.state.data.designSystem = {
            selectedTheme: selected,
            css: getThemeCSS(selected.name),
            selectionScore: best.score,
            selectionReasons: best.reasons,
          };

          if (showReasoning) {
            const alternatives = scored
              .slice(1, 3)
              .filter((alt) => alt.score > 0);

            return `🎨 THEME SELECTED: ${selected.name}

        **Match Score**: ${best.score}/100

        **Selection Reasoning**:
        ${best.reasons.join("\n")}

        **Theme Details**:
        - Description: ${selected.description}
        - Best for: ${selected.projectTypes?.join(", ") || "General use"}
        - Style: ${selected.personality?.join(", ") || "Various styles"}

        ${
          alternatives.length > 0
            ? `**Alternative Options**:
        ${alternatives
          .map(
            (alt) =>
              `• ${alt.theme.name} (${alt.score}) - ${alt.theme.description}`,
          )
          .join("\n")}`
            : ""
        }

        ✅ Theme CSS generated and ready for implementation!`;
          }

          return `✅ Selected ${selected.name} theme (score: ${best.score})`;
        } catch (error) {
          return `❌ Theme selection error: ${
            error instanceof Error ? error.message : "Unknown error"
          }`;
        }
      },
    }),
    createTool({
      name: "getAvailableThemes",
      description:
        "Get a list of all available themes with descriptions and tags",
      parameters: z.object({}),
      handler: async ({}) => {
        const themes = getThemeList();
        return `📋 Available themes:\n${themes
          .map(
            (t) => `• ${t.name}: ${t.description} (Tags: ${t.tags.join(", ")})`,
          )
          .join("\n")}`;
      },
    }),
    createTool({
      name: "getDesignSystemCSS",
      description:
        "Get the exact CSS from the design system that should be used for src/index.css",
      parameters: z.object({}),
      handler: async ({}, { network }) => {
        const designSystem = network.state.data.designSystem;
        if (!designSystem || !designSystem.css) {
          return "❌ No design system CSS found. Please call themeGenerator first.";
        }

        return `✅ Design System CSS (${designSystem.css.length} characters):\n\n${designSystem.css}`;
      },
    }),
    createTool({
      name: "markBuildComplete",
      description: "Mark build as complete - MANDATORY to call",
      parameters: z.object({
        summary: z.string(),
        fileCount: z.number(),
      }),
      handler: async ({ summary, fileCount }, { network }) => {
        network.state.data.buildComplete = true;
        console.log(`[Builder] ✅ BUILD COMPLETE - ${fileCount} files`);
        return `✅ Build phase complete: ${summary}`;
      },
    }),
  ],
});
