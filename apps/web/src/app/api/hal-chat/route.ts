import { NextResponse } from "next/server";
import { after } from "next/server";
import { createResumableStreamContext } from "resumable-stream";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CreditManager } from "@/lib/credits";
import { pruneHalConversation } from "@/lib/hal-context-manager";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  smoothStream,
  stepCountIs,
  streamText,
  tool,
  UIMessage,
  type ToolSet,
  type InferUITools,
  type UIDataTypes,
} from "ai";
import {
  getPostHogCapture,
  generateSpanId,
  getEnvironmentProperties,
} from "@/lib/posthog-capture";
import { Mem0MemoryManager, type Message } from "@/lib/mem0-memory";
import { deslugifyProjectName } from "@/lib/project-namer";
import { exaWebSearchTool } from "@/lib/exa-tool";
import { stripIndents } from "@/lib/utils";
import { selectRelevantFiles } from "@/lib/analyze-project-helpers";
import { AdvisorContextBuilder } from "@/lib/advisor-context-builder";
import { ADVISOR_HATS, type AdvisorHatType } from "@/lib/advisor-hats";
import { getHalSuggestionsPrompt } from "./prompts/hal-suggestions-prompt";
import { getHalChatSystemPrompt } from "./prompts/hal-chat-system-prompt";
import { getSandbox } from "@/lib/sandbox-manager";
import { modalAPI } from "@/lib/api/modal-client";
import { z } from "zod";

const getMessageContent = (message: UIMessage): string => {
  // Try parts array first (new UIMessage structure)
  const parts = (message as any).parts;
  if (Array.isArray(parts) && parts.length > 0) {
    return parts.map((p: any) => p.text || "").join(" ");
  }
  // Fallback to content
  return (message as any).content || "";
};

// Streaming duration limit
export const maxDuration = 800;

// CORS headers for cross-origin requests
const corsHeaders = {
  "Access-Control-Allow-Origin":
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Handle OPTIONS preflight requests
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const postHog = getPostHogCapture();

const HAL_CHAT_MODEL =
  process.env.NODE_ENV === "production"
    ? "@preset/hal-chat"
    : "@preset/dev-hal-chat";

const SUGGESTION_MODEL = "google/gemini-3-flash-preview";
const ANALYSIS_MODEL = "google/gemini-3-flash-preview";

// Utility function for consistent file path normalization
function normalizeFilePath(filePath: string): string {
  return filePath.replace(/^.*\/workspace\//, "").replace(/^\.\//, "");
}

// Filter function for relevant project files
function isRelevantFile(normalizedPath: string): boolean {
  return Boolean(
    normalizedPath &&
      !normalizedPath.includes("node_modules") &&
      !normalizedPath.includes(".git") &&
      !normalizedPath.startsWith(".") &&
      (normalizedPath.endsWith(".tsx") ||
        normalizedPath.endsWith(".ts") ||
        normalizedPath.endsWith(".js") ||
        normalizedPath.endsWith(".jsx") ||
        normalizedPath.endsWith(".html") ||
        normalizedPath.endsWith(".css") ||
        normalizedPath.endsWith(".json") ||
        normalizedPath === "package.json" ||
        normalizedPath === "README.md" ||
        normalizedPath === "tsconfig.json" ||
        normalizedPath === "next.config.js" ||
        normalizedPath === "tailwind.config.js" ||
        normalizedPath === "vite.config.js" ||
        normalizedPath === "index.html" ||
        normalizedPath.includes("App.") ||
        normalizedPath.includes("main.")),
  );
}

// Prioritize files by importance (higher score = more important)
function getFileImportance(normalizedPath: string): number {
  // Critical config files
  if (normalizedPath === "package.json") return 100;
  if (normalizedPath === "README.md") return 90;

  // Main entry points
  if (normalizedPath.includes("App.tsx") || normalizedPath.includes("App.jsx"))
    return 85;
  if (
    normalizedPath.includes("main.tsx") ||
    normalizedPath.includes("main.jsx")
  )
    return 80;
  if (normalizedPath === "index.html") return 75;

  // Config files
  if (normalizedPath.includes("config")) return 70;
  if (normalizedPath === "tsconfig.json") return 65;

  // Source files in src/ or app/ directories (main code)
  if (normalizedPath.startsWith("src/") || normalizedPath.startsWith("app/")) {
    // Pages/routes are very important
    if (normalizedPath.includes("page.") || normalizedPath.includes("route."))
      return 60;
    // Components are important
    if (normalizedPath.includes("component")) return 50;
    // Other source files
    return 40;
  }

  // Styles
  if (normalizedPath.endsWith(".css")) return 30;

  // Everything else
  return 20;
}

// Enhanced project analysis functions
function analyzeProjectStructure(files: { [path: string]: string }) {
  const analysis = {
    framework: "Unknown",
    technologies: [] as string[],
    hasComponents: false,
    hasPages: false,
    hasAPI: false,
    hasStyles: false,
    hasTests: false,
    entryPoints: [] as string[],
  };

  // Analyze package.json for dependencies
  if (files["package.json"]) {
    try {
      const packageData = JSON.parse(files["package.json"]);
      const deps = {
        ...packageData.dependencies,
        ...packageData.devDependencies,
      };

      // Detect framework
      if (deps.next) analysis.framework = "Next.js";
      else if (deps.react) analysis.framework = "React";
      else if (deps.vue) analysis.framework = "Vue.js";
      else if (deps.svelte) analysis.framework = "Svelte";
      else if (deps.vite) analysis.framework = "Vite";

      // Detect technologies
      if (deps.typescript || deps["@types/node"])
        analysis.technologies.push("TypeScript");
      if (deps.tailwindcss) analysis.technologies.push("Tailwind CSS");
      if (deps.prisma) analysis.technologies.push("Prisma");
      if (deps.trpc || deps["@trpc/client"]) analysis.technologies.push("tRPC");
      if (deps.stripe) analysis.technologies.push("Stripe");
      if (deps["@auth/prisma-adapter"] || deps["next-auth"])
        analysis.technologies.push("NextAuth");
      if (deps.shadcn || deps["@radix-ui/react-slot"])
        analysis.technologies.push("shadcn/ui");
    } catch (e) {
      console.warn("Could not parse package.json");
    }
  }

  // Analyze project structure
  const filePaths = Object.keys(files);
  analysis.hasComponents = filePaths.some(
    (path) => path.includes("components") || path.includes("ui/"),
  );
  analysis.hasPages = filePaths.some(
    (path) =>
      path.includes("pages/") ||
      path.includes("app/") ||
      path.includes("routes/"),
  );
  analysis.hasAPI = filePaths.some(
    (path) => path.includes("api/") || path.includes("server/"),
  );
  analysis.hasStyles = filePaths.some(
    (path) =>
      path.endsWith(".css") ||
      path.endsWith(".scss") ||
      path.includes("styles/"),
  );
  analysis.hasTests = filePaths.some(
    (path) =>
      path.includes("test") ||
      path.includes("spec") ||
      path.endsWith(".test.ts"),
  );

  // Find entry points
  if (files["index.html"]) analysis.entryPoints.push("index.html");
  if (files["src/main.tsx"]) analysis.entryPoints.push("src/main.tsx");
  if (files["src/index.tsx"]) analysis.entryPoints.push("src/index.tsx");
  if (files["app/layout.tsx"]) analysis.entryPoints.push("app/layout.tsx");

  return analysis;
}

function getProjectInsights(files: { [path: string]: string }, analysis: any) {
  const insights = [];

  // Framework-specific insights
  if (analysis.framework === "Next.js") {
    if (!files["next.config.js"] && !files["next.config.mjs"]) {
      insights.push("Missing Next.js configuration file");
    }
  }

  // Check for common missing files
  if (!files["README.md"]) {
    insights.push("No README.md found - consider adding project documentation");
  }

  if (analysis.technologies.includes("TypeScript") && !files["tsconfig.json"]) {
    insights.push("TypeScript detected but no tsconfig.json found");
  }

  if (
    analysis.technologies.includes("Tailwind CSS") &&
    !files["tailwind.config.js"]
  ) {
    insights.push("Tailwind CSS detected but no config file found");
  }

  // Check for testing setup
  if (!analysis.hasTests && Object.keys(files).length > 5) {
    insights.push("No test files detected - consider adding tests");
  }

  return insights;
}

function analyzeProjectPurpose(files: { [path: string]: string }) {
  const features = [];
  const purpose = {
    description: "",
    mainFeatures: [] as string[],
    userTypes: [] as string[],
  };

  // Analyze README for project description
  if (files["README.md"]) {
    const readme = files["README.md"];
    // Extract first meaningful paragraph as description
    const lines = readme.split("\n").filter((line) => line.trim());
    for (const line of lines) {
      if (
        line.length > 50 &&
        !line.startsWith("#") &&
        !line.startsWith("```")
      ) {
        purpose.description =
          line.substring(0, 200) + (line.length > 200 ? "..." : "");
        break;
      }
    }
  }

  // Analyze main component files for context
  const mainFiles = ["App.tsx", "App.jsx", "src/App.tsx", "src/App.jsx"];
  let appContent = "";
  for (const fileName of mainFiles) {
    if (files[fileName]) {
      appContent = files[fileName];
      break;
    }
  }

  // Extract insights from main app component
  if (appContent) {
    // Look for component names that indicate features
    const componentMatches = appContent.match(/import\s+(\w+)\s+from/g);
    if (componentMatches) {
      componentMatches.forEach((match) => {
        const componentName = match.replace(/import\s+(\w+)\s+from/, "$1");
        if (componentName.includes("Dashboard")) features.push("Dashboard");
        if (componentName.includes("Management"))
          features.push("Management System");
        if (componentName.includes("Schedule")) features.push("Scheduling");
        if (componentName.includes("Calendar")) features.push("Calendar");
        if (componentName.includes("Profile")) features.push("User Profiles");
        if (componentName.includes("Settings")) features.push("Settings");
      });
    }

    // Look for state management patterns
    if (appContent.includes("useState") || appContent.includes("activeTab")) {
      features.push("Interactive Navigation");
    }
  }

  // Analyze all code for features
  const allCode = Object.values(files).join(" ").toLowerCase();

  // Enhanced features detection
  if (
    allCode.includes("auth") ||
    allCode.includes("login") ||
    allCode.includes("signin")
  ) {
    features.push("User Authentication");
  }
  if (
    allCode.includes("payment") ||
    allCode.includes("stripe") ||
    allCode.includes("checkout")
  ) {
    features.push("Payment Processing");
  }
  if (
    allCode.includes("database") ||
    allCode.includes("prisma") ||
    allCode.includes("mongodb")
  ) {
    features.push("Database Integration");
  }
  if (
    allCode.includes("api") ||
    allCode.includes("endpoint") ||
    allCode.includes("trpc")
  ) {
    features.push("API Integration");
  }
  if (allCode.includes("dashboard") || allCode.includes("admin")) {
    features.push("Dashboard");
  }
  if (
    allCode.includes("chat") ||
    allCode.includes("message") ||
    allCode.includes("conversation")
  ) {
    features.push("Chat/Messaging");
  }
  if (
    allCode.includes("upload") ||
    allCode.includes("file") ||
    allCode.includes("image")
  ) {
    features.push("File Management");
  }
  if (allCode.includes("search") || allCode.includes("filter")) {
    features.push("Search & Filtering");
  }
  // Domain-specific features
  if (allCode.includes("training") || allCode.includes("course")) {
    features.push("Training Management");
  }
  if (allCode.includes("cohort") || allCode.includes("class")) {
    features.push("Cohort Management");
  }
  if (allCode.includes("schedule") || allCode.includes("session")) {
    features.push("Session Scheduling");
  }
  if (allCode.includes("certificate") || allCode.includes("certified")) {
    features.push("Certification Tracking");
  }
  if (allCode.includes("progress") || allCode.includes("tracking")) {
    features.push("Progress Tracking");
  }
  if (allCode.includes("enrollment") || allCode.includes("enrolled")) {
    features.push("Student Enrollment");
  }

  purpose.mainFeatures = features;
  return purpose;
}

// Helper function to build NON-TECHNICAL project context for Advisor chat
// This version focuses on business value and user experience, hiding technical details
// Used for business/product-focused hats: generalist, design, product, marketing, sales
async function buildAdvisorProjectContext(
  projectId: string,
  prettyProjectName: string,
): Promise<string> {
  try {
    // Get project files from Daytona sandbox
    let projectFiles: { [path: string]: string } = {};
    let fileCount = 0;

    const sandboxInfo = await getSandbox(projectId);

    if (sandboxInfo) {
      // Get file contents from sandbox for analysis
      const filePaths = Array.from(sandboxInfo.files.keys())
        .filter((path) => isRelevantFile(normalizeFilePath(path)))
        .slice(0, 20); // Limit to 20 most relevant files for analysis

      // Get file contents from sandbox
      for (const filePath of filePaths) {
        try {
          const fileBuffer =
            await sandboxInfo.sandbox.fs.downloadFile(filePath);
          const content = fileBuffer.toString("utf-8");
          const normalizedPath = normalizeFilePath(filePath);
          if (normalizedPath && content.trim()) {
            projectFiles[normalizedPath] = content;
            fileCount++;
          }
        } catch (fileError) {
          console.warn(
            `[HAL Chat] Could not read file ${filePath}:`,
            fileError,
          );
        }
      }
    } else {
      // Fallback: Get files from active V2Fragment if available
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { activeFragmentId: true },
      });

      if (project?.activeFragmentId) {
        const activeFragment = await prisma.v2Fragment.findUnique({
          where: { id: project.activeFragmentId },
          select: { files: true },
        });

        if (activeFragment && activeFragment.files) {
          projectFiles = activeFragment.files as { [path: string]: string };
          fileCount = Object.keys(projectFiles).length;
        }
      }
    }

    if (fileCount === 0) {
      return `## Current Project State:\nProject: ${prettyProjectName}\nNo project files available for analysis yet.`;
    }

    // Enhanced project analysis
    const projectAnalysis = analyzeProjectStructure(projectFiles);
    const projectPurpose = analyzeProjectPurpose(projectFiles);
    const projectInsights = getProjectInsights(projectFiles, projectAnalysis);

    // Build NON-TECHNICAL context - focus on business value and user experience
    return stripIndents`
## Current Project State:

PROJECT OVERVIEW:
Name: ${prettyProjectName}
This is their real product/business, not a template.

PROJECT PURPOSE & DOMAIN:
${projectPurpose.description ? `Description: ${projectPurpose.description}` : "No description found"}
Main Features: ${projectPurpose.mainFeatures.join(", ") || "Features not clearly identified"}
Domain: ${
      projectPurpose.mainFeatures.some((f) => f.includes("Training"))
        ? "Education/Training Platform"
        : projectPurpose.mainFeatures.some(
              (f) => f.includes("E-commerce") || f.includes("Payment"),
            )
          ? "E-commerce"
          : projectPurpose.mainFeatures.some((f) => f.includes("Dashboard"))
            ? "Business Dashboard"
            : "Web Application"
    }

BUSINESS OPPORTUNITIES:
${projectInsights.length > 0 ? projectInsights.map((insight) => `- ${insight}`).join("\n") : "- Strong foundation for growth"}

IMPORTANT REMINDER:
Focus on business value and user experience. Do not mention frameworks, libraries, or technical implementation details to the user. Treat this as their unique product, not a template. And never use emdashes (—).`;
  } catch (error) {
    console.error("[HAL Chat] Error building advisor project context:", error);
    return `## Current Project State:\nProject: ${prettyProjectName}`;
  }
}

// Function to create tools with projectId, hatType, userMessage, unifiedContext, builderActivity, projectFiles, and shipperCloud status in closure
const createTools = (
  projectId: string,
  hatType: AdvisorHatType,
  userMessage: string = "",
  unifiedContext: string = "",
  builderActivity: string = "",
  projectFiles: Record<string, string> = {}, // Pass already-read files to avoid re-reading
  prettyProjectName: string = "",
  shipperCloudStatus: {
    enabled: boolean;
    hasDeployment: boolean;
  } = { enabled: false, hasDeployment: false },
) => ({
  webSearch: exaWebSearchTool,
  generateSuggestions: tool({
    description:
      "Generate personalized project suggestions based on current project state. Use this when the user asks for ideas, next steps, or what to build next.",
    inputSchema: z.object({}), // No parameters needed - all data comes from closure and messages
    execute: async (args, { messages }) => {
      // Extract previous suggestion titles to avoid repetition
      const previousSuggestionTitles: string[] = [];
      const previousGreetings: string[] = [];

      for (const m of messages) {
        if (m.role === "assistant") {
          const content =
            typeof m.content === "string"
              ? m.content
              : JSON.stringify(m.content);
          // Look for suggestion JSON in assistant messages
          if (
            content.includes('"suggestions"') &&
            content.includes('"title"')
          ) {
            try {
              const parsed = JSON.parse(content);
              if (parsed.suggestions) {
                for (const s of parsed.suggestions) {
                  if (s.title) previousSuggestionTitles.push(s.title);
                  if (s.shortTitle) previousSuggestionTitles.push(s.shortTitle);
                }
              }
              if (parsed.greeting) {
                // Just first 50 chars of greeting
                previousGreetings.push(parsed.greeting.substring(0, 50));
              }
            } catch {
              // Not JSON, skip
            }
          }
        }
      }

      // Extract conversation history (truncated for context)
      const conversationHistory = messages
        .map((m: any) => {
          const role = m.role === "user" ? "User" : "Assistant";
          const content =
            typeof m.content === "string"
              ? m.content
              : JSON.stringify(m.content);
          return `${role}: ${content.substring(0, 200)}`;
        })
        .join("\n");

      console.log("[HAL Suggestions] Tool has access to conversation:", {
        messageCount: messages.length,
        lastMessages: messages.slice(-3).map((m: any) => ({
          role: m.role,
          preview:
            typeof m.content === "string"
              ? m.content.substring(0, 100)
              : "complex content",
        })),
      });
      console.log(
        "[HAL Suggestions] Tool called for project:",
        projectId,
        "with hatType:",
        hatType,
      );

      // Use projectFiles from closure (already read by main chat)
      // This avoids duplicate file reading!
      const fileCount = Object.keys(projectFiles).length;

      console.log(
        `[HAL Suggestions] Using ${fileCount} files from closure (no re-reading!)`,
      );

      if (fileCount === 0) {
        throw new Error("No project files available for analysis");
      }

      // Get session for mem0 context
      const session = await auth();
      if (!session?.user?.id) {
        throw new Error("User not authenticated");
      }

      // Enhanced project analysis
      const projectAnalysis = analyzeProjectStructure(projectFiles);
      const projectPurpose = analyzeProjectPurpose(projectFiles);
      const projectInsights = getProjectInsights(projectFiles, projectAnalysis);

      // Extract existing feature names from file paths (compact)
      const existingFeatures = Object.keys(projectFiles)
        .filter(
          (f) =>
            f.includes("/components/") ||
            f.includes("/pages/") ||
            f.includes("/features/") ||
            f.includes("/views/"),
        )
        .map(
          (f) =>
            f
              .split("/")
              .pop()
              ?.replace(/\.(tsx?|jsx?)$/, "") || "",
        )
        .filter((name) => name.length > 2 && name.length < 30)
        .slice(0, 15);

      // Get more detailed analysis of key files
      const keyFileAnalysis = Object.entries(projectFiles)
        .filter(
          ([path]) =>
            path === "package.json" ||
            path === "index.html" ||
            path.includes("App.") ||
            path === "README.md" ||
            path.includes("main.") ||
            path.includes("config"),
        )
        .map(([path, content]) => {
          let preview = content;
          if (path === "package.json") {
            try {
              const pkg = JSON.parse(content);
              preview = JSON.stringify(
                {
                  name: pkg.name,
                  description: pkg.description,
                  dependencies: Object.keys(pkg.dependencies || {}).slice(
                    0,
                    10,
                  ),
                  devDependencies: Object.keys(pkg.devDependencies || {}).slice(
                    0,
                    5,
                  ),
                },
                null,
                2,
              );
            } catch (e) {
              preview = content.substring(0, 300);
            }
          } else if (path === "index.html") {
            const titleMatch = content.match(/<title>(.*?)<\/title>/);
            const metaMatch = content.match(
              /<meta name="description" content="(.*?)"/,
            );
            preview = `Title: ${titleMatch ? titleMatch[1] : "No title"}
Meta Description: ${metaMatch ? metaMatch[1] : "None"}
Body: ${content.includes('<div id="root">') ? "React app root detected" : "Standard HTML"}`;
          } else if (path.includes("App.")) {
            const imports = content.match(/import.*from.*;/g) || [];
            preview = `Imports: ${imports.slice(0, 5).join("\n")}

Component Structure:
${content.substring(0, 500)}${content.length > 500 ? "\n..." : ""}`;
          } else if (path.endsWith(".md")) {
            preview = content.substring(0, 600);
          } else {
            preview = content.substring(0, 400);
          }
          return `${path}:\n${preview}`;
        })
        .join("\n\n" + "=".repeat(50) + "\n\n");

      const projectContext = stripIndents`
PROJECT OVERVIEW:
Name: ${prettyProjectName}
File Count: ${fileCount}

SHIPPER CLOUD STATUS:
${shipperCloudStatus.enabled ? `✅ Shipper Cloud is ENABLED for this project
- Backend deployed: ${shipperCloudStatus.hasDeployment ? "Yes" : "Pending"}
- Features available: Real-time database, Better Auth authentication, serverless functions
- The project has access to: convex/ directory, auth-client.ts, ConvexBetterAuthProvider` : `❌ Shipper Cloud is NOT enabled
- The project does not have a backend yet
- If user needs authentication, data persistence, or real-time features, suggest enabling Shipper Cloud
- Builder can call deployToShipperCloud tool to enable it`}

PROJECT PURPOSE & DOMAIN:
${projectPurpose.description ? `Description: ${projectPurpose.description}` : "No description found"}
Main Features: ${projectPurpose.mainFeatures.join(", ") || "Features not clearly identified"}
Domain: ${
        projectPurpose.mainFeatures.some((f) => f.includes("Training"))
          ? "Education/Training Platform"
          : projectPurpose.mainFeatures.some(
                (f) => f.includes("E-commerce") || f.includes("Payment"),
              )
            ? "E-commerce"
            : projectPurpose.mainFeatures.some((f) => f.includes("Dashboard"))
              ? "Business Dashboard"
              : "Web Application"
      }

PROJECT CAPABILITIES:
- User Interface: ${projectAnalysis.hasComponents ? "Present" : "Basic"}
- Multiple Views/Pages: ${projectAnalysis.hasPages ? "Yes" : "Single page"}
- Backend Integration: ${projectAnalysis.hasAPI ? "Yes" : "Frontend only"}
- Custom Styling: ${projectAnalysis.hasStyles ? "Yes" : "Using defaults"}
- Testing: ${projectAnalysis.hasTests ? "Implemented" : "Not yet"}

BUSINESS OPPORTUNITIES:
${projectInsights.length > 0 ? projectInsights.map((insight) => `- ${insight}`).join("\n") : "- Strong foundation for growth"}

TECHNICAL CONTEXT (for your analysis only - do not mention tech details in suggestions):
${keyFileAnalysis}

IMPORTANT REMINDER:
Focus suggestions on business value and user experience. Do not mention frameworks, libraries, or technical implementation details to the user. Treat this as their unique product, not a template. And never use emdashes (—).`;

      // Build rich context from mem0 memories using the actual user message
      const mem0Context = await Mem0MemoryManager.buildContextForAI({
        userId: session.user.id,
        projectId,
        currentMessage: "Generate suggestions for project improvements",
      });

      const suggestionPrompt = getHalSuggestionsPrompt({
        hatType,
        prettyProjectName,
        projectPurposeDescription: projectPurpose.description,
        mem0Context,
        projectContext,
        unifiedContext,
        userMessage,
        conversationHistory,
        // New: explicit tracking for uniqueness
        previousSuggestionTitles,
        previousGreetings,
        existingFeatures,
      });

      try {
        const { generateObject } = await import("ai");

        const response = await generateObject({
          model: openrouter(SUGGESTION_MODEL),
          schema: z.object({
            greeting: z.string().describe("Warm, empathetic greeting"),
            suggestions: z
              .array(
                z.object({
                  id: z.string(),
                  title: z
                    .string()
                    .describe("Full descriptive title for the suggestion"),
                  shortTitle: z
                    .string()
                    .describe(
                      "Very short version (2-4 words max) for compact display",
                    ),
                  description: z.string(),
                  prompt: z.string(),
                  targetChat: z.enum(["builder", "advisor"]),
                  icon: z.string(),
                  color: z.string(),
                }),
              )
              .length(4),
          }),
          prompt: suggestionPrompt,
        });

        const result = response.object;

        // Note: Database save is handled automatically by createUIMessageStream's onFinish
        // which saves the complete UIMessage format with tool output

        // Save to mem0 for better context memory
        const suggestionsSummary = result.suggestions
          .map((s: any) => `- ${s.title}: ${s.description}`)
          .join("\n");
        const fullAssistantMessage = `${result.greeting}\n\n${suggestionsSummary}`;

        const mem0Messages: Message[] = [
          {
            role: "user",
            content: "Generate suggestions for project improvements",
          },
          { role: "assistant", content: fullAssistantMessage },
        ];

        Mem0MemoryManager.addMemory({
          userId: session.user.id,
          projectId,
          messages: mem0Messages,
          metadata: {
            projectName: prettyProjectName,
            timestamp: new Date().toISOString(),
            suggestionCount: result.suggestions.length,
          },
        }).catch((error) => {
          console.error("[HAL Suggestions] Failed to save to mem0:", error);
        });

        console.log("[HAL Suggestions] Successfully generated suggestions", {
          greeting: result.greeting,
          suggestionCount: result.suggestions.length,
        });

        return {
          greeting: result.greeting,
          suggestions: result.suggestions,
        };
      } catch (error) {
        console.error("[HAL Suggestions] Error generating suggestions:", error);
        throw new Error("Failed to generate suggestions");
      }
    },
  }),
});

// Create tools for type inference
const sampleTools = createTools("sample-id", "generalist", "", "", "", {}, "", { enabled: false, hasDeployment: false });
export type ChatTools = InferUITools<typeof sampleTools>;
export type ChatMessage = UIMessage<never, UIDataTypes, ChatTools>;

async function handler(req: Request) {
  // Auth check
  const session = await auth();
  if (!session || !session.user) {
    return NextResponse.json(
      {
        error: "Authentication required",
        message: "You must be signed in to access this resource",
      },
      { status: 401, headers: corsHeaders },
    );
  }

  // Parse request body
  const body = await req.json();
  console.log("[HAL Chat] Received request body:", {
    hasMessage: !!body.message,
    projectId: body.projectId,
    hatType: body.hatType,
    bodyKeys: Object.keys(body),
  });

  const {
    message,
    projectId,
    hatType = "generalist" as AdvisorHatType,
    isSuggestionRequest = false, // Explicitly set by frontend when "Generate Suggestions" button is clicked
  }: {
    message: UIMessage;
    projectId: string;
    hatType?: AdvisorHatType;
    isSuggestionRequest?: boolean;
  } = body;

  console.log(
    `[HAL Chat] Processing chat for hatType: ${hatType} (was ${body.hatType} in request)`,
  );

  if (!projectId) {
    return NextResponse.json(
      { error: "Project ID is required" },
      { status: 400, headers: corsHeaders },
    );
  }

  // Generate streamId for trace
  const streamId = generateId();

  try {
    // Track session start time
    const sessionStartTime = Date.now();

    // Track trace start with PostHog
    try {
      await postHog.captureAITrace({
        distinct_id: session.user.id,
        $ai_trace_id: streamId,
        $ai_span_name: "advisor_chat_session",
        $ai_input_state: { message, projectId },
        projectId,
        userRole: session.user.role || "USER",
        ...getEnvironmentProperties(),
      });
    } catch (error) {
      console.error("[PostHog] Failed to track trace start:", error);
    }

    // Verify project access and get Shipper Cloud status
    const project = await prisma.project.findFirst({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        activeFragmentId: true,
        shipperCloudEnabled: true,
        convexDeployment: {
          select: {
            convexDeploymentUrl: true,
            status: true,
          },
        },
      },
    });
    if (!project) {
      return NextResponse.json(
        { error: "Project not found or access denied" },
        { status: 404, headers: corsHeaders },
      );
    }

    // Shipper Cloud status for context
    const shipperCloudEnabled = project.shipperCloudEnabled;
    const hasConvexDeployment = !!project.convexDeployment;

    // Extract user message content for use throughout the handler
    const userMessageContent = getMessageContent(message);

    // Only use explicit button clicks for forcing tool - let AI decide for natural conversation
    // This allows AI to respond naturally to questions like "what should I do next?"
    // instead of always forcing formal suggestion generation
    const isSuggestionRequestDetected = isSuggestionRequest; // Only explicit button clicks

    if (message.role === "user") {
      // Determine credit cost: FREE for explicit suggestion button clicks, 0.25 for normal chat
      const creditCost = isSuggestionRequestDetected ? 0 : 0.25;
      const requestType = isSuggestionRequestDetected
        ? "suggestion generation (explicit button)"
        : "advisor message";

      console.log(
        `[HAL Chat] Credit cost: ${creditCost} credits for ${requestType}`,
        {
          explicitRequest: isSuggestionRequest,
          message: userMessageContent.substring(0, 100),
        },
      );

      // Only deduct credits if cost > 0
      if (creditCost > 0) {
        try {
          await CreditManager.deductCredits(
            session.user.id,
            creditCost,
            "AI_GENERATION",
            `Advisor chat message for project ${projectId}`,
            {
              projectId,
              input: userMessageContent,
              feature: "advisor-chat",
            },
          );
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          return NextResponse.json(
            {
              error: "Insufficient credits",
              message: errorMessage,
            },
            { status: 402, headers: corsHeaders },
          );
        }
      }
    }

    // Save user message to DB with full parts structure
    // Internal trigger messages will be filtered in the UI component
    await prisma.halChatMessage.create({
      data: {
        projectId,
        userId: session.user.id,
        role: message.role,
        content: getMessageContent(message),
        hatType, // Add hatType for filtering conversations by hat
        parts: (message as any).parts
          ? JSON.parse(JSON.stringify((message as any).parts))
          : undefined,
      },
    });

    // Load previous HAL chat messages for context (limit to last 10 for immediate context)
    // Filter by hatType to keep conversations separate between different hats
    // Note: Current message is NOT in database yet - it will be saved after AI responds
    const rawMessages = await prisma.halChatMessage.findMany({
      where: { projectId, hatType },
      orderBy: { createdAt: "desc" }, // Get newest first
      take: 10, // Get more messages to ensure we have history
    });

    // Reverse to chronological order (oldest to newest) for AI context
    rawMessages.reverse();

    // Load Builder chat history for context awareness
    const builderMessages = await prisma.v2Message.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: 10, // Last 10 builder messages
      select: {
        role: true,
        content: true,
        createdAt: true,
      },
    });

    // Convert to UIMessage format for model context
    // Use saved parts structure if available (preserves tool calls)
    // Fall back to content reconstruction for older messages
    const messages: UIMessage[] = rawMessages.map((m) => {
      let parts = m.parts
        ? (m.parts as any) // Use saved parts structure
        : [{ type: "text", text: m.content }]; // Fallback for old messages

      // CRITICAL: Filter out tool execution parts from history to prevent AI from getting stuck
      // Tool execution details (especially generateSuggestions) confuse the AI when it sees them
      // But KEEP tool results/output so AI knows what was generated
      if (Array.isArray(parts)) {
        parts = parts
          .map((part: any) => {
            // Keep text and reasoning as-is
            if (part.type === "text" || part.type === "reasoning") return part;

            // For tool calls, extract just the output/result if available
            if (part.type?.startsWith("tool-")) {
              // If tool has output (result), convert it to a text part for context
              if (part.output) {
                // For generateSuggestions, keep the greeting + summary of suggestions
                if (part.type === "tool-generateSuggestions") {
                  let contextText = "";

                  // Add greeting if available
                  if (part.output.greeting) {
                    contextText = part.output.greeting;
                  }

                  // Add summary of suggestions so AI knows what options were offered
                  if (
                    part.output.suggestions &&
                    Array.isArray(part.output.suggestions)
                  ) {
                    const suggestionTitles = part.output.suggestions
                      .map((s: any) => `- ${s.title}`)
                      .join("\n");
                    contextText += `\n\n[Generated ${part.output.suggestions.length} suggestions:\n${suggestionTitles}]`;
                  }

                  return { type: "text", text: contextText };
                }
              }
              return null; // Filter out tool execution details
            }
            if (part.type?.startsWith("step-")) return null;

            return part;
          })
          .filter((part: any) => part !== null); // Remove nulls

        // If filtering removed all parts, add empty text part to maintain structure
        if (parts.length === 0) {
          parts = [{ type: "text", text: m.content || "" }];
        }
      }

      return {
        id: m.id,
        role: m.role as "user" | "assistant",
        parts,
      };
    });

    const currentMessageContent = getMessageContent(message);
    const messageAlreadyExists = messages.some(
      (m) =>
        m.role === message.role &&
        getMessageContent(m) === currentMessageContent,
    );

    if (!messageAlreadyExists) {
      messages.push({
        id: generateId(),
        role: message.role as "user" | "assistant",
        parts: [{ type: "text", text: currentMessageContent }],
      });
    }

    // Build rich context from mem0 memories
    const mem0Context = await Mem0MemoryManager.buildContextForAI({
      userId: session.user.id,
      projectId,
      currentMessage: userMessageContent,
      hideMemoryAnnotations: true,
    });

    console.log("[HAL Chat] Mem0 context retrieved");

    // Create final messages for model with system prompt
    const prettyProjectName = deslugifyProjectName(project.name);

    // Get project files for context (limit to relevant files)
    // ALWAYS read files since AI might call generateSuggestions at any time
    const projectFiles: Record<string, string> = {};
    const shouldReadFiles = true; // Always read files to support dynamic suggestion generation

    if (shouldReadFiles) {
      console.log(
        `[HAL Chat] Reading project files (suggestion request: ${isSuggestionRequestDetected}, message count: ${rawMessages.length})`,
      );

      try {
        const sandboxInfo = await getSandbox(projectId);
        if (sandboxInfo) {
          const filePaths = Array.from(sandboxInfo.files.keys())
            .filter((path) => isRelevantFile(normalizeFilePath(path)))
            .sort(
              (a, b) =>
                getFileImportance(normalizeFilePath(b)) -
                getFileImportance(normalizeFilePath(a)),
            )
            .slice(0, 20); // Limit to 20 most important files

          // OPTIMIZATION: Read files in parallel instead of sequentially
          const fileReadPromises = filePaths.map(async (filePath) => {
            try {
              let content: string;

              // Use appropriate API based on provider
              if (sandboxInfo.provider === "modal") {
                content = await modalAPI.readFile(
                  sandboxInfo.sandboxId,
                  filePath,
                );
              } else {
                // Daytona (legacy)
                const fileBuffer =
                  await sandboxInfo.sandbox.fs.downloadFile(filePath);
                content = fileBuffer.toString("utf-8");
              }

              const normalizedPath = normalizeFilePath(filePath);
              if (normalizedPath && content.trim()) {
                return { path: normalizedPath, content };
              }
            } catch (error) {
              console.warn(`[HAL Chat] Could not read file ${filePath}`);
            }
            return null;
          });

          // Wait for all files to be read in parallel
          const fileResults = await Promise.all(fileReadPromises);

          // Build projectFiles object from results
          for (const result of fileResults) {
            if (result) {
              projectFiles[result.path] = result.content;
            }
          }

          console.log(
            `[HAL Chat] Read ${Object.keys(projectFiles).length} files in parallel`,
          );
        }
      } catch (error) {
        console.warn("[HAL Chat] Could not load project files:", error);
      }
    } else {
      console.log(
        `[HAL Chat] Skipping file reading for simple message (count: ${rawMessages.length})`,
      );
    }

    // Build unified flowing context (replaces isolated sections)
    console.log(`[HAL Chat] Building unified context for ${hatType} hat...`);
    const unifiedContext = AdvisorContextBuilder.buildUnifiedContext({
      projectName: prettyProjectName,
      hatType,
      conversationLength: rawMessages.length,
      mem0Memories: mem0Context,
      projectFiles,
      builderActivity:
        AdvisorContextBuilder.extractBuilderActivity(builderMessages),
    });
    console.log("[HAL Chat] Unified context built");

    // Get role-specific system prompt based on hat type
    // Keep it SHORT - no context embedded (like Builder chat)
    // This will be injected dynamically in prepareStep, not in messages array
    const systemPromptText = getHalChatSystemPrompt({
      hatType,
      prettyProjectName,
      rawMessagesLength: rawMessages.length,
      unifiedContext: "", // Don't embed context in system prompt
    });

    // Add context as a separate user message at the start (like Builder does with fragments)
    // This keeps conversation history prominent and prevents context from overwhelming the AI
    const contextMessage: UIMessage = {
      id: "context-message",
      role: "user",
      parts: [
        {
          type: "text",
          text: `[Project Context]\n${unifiedContext}\n\n---`,
        },
      ],
    };

    const prunedMessages = pruneHalConversation(messages);

    console.log("[HAL Chat] Message structure:", {
      totalMessagesFromDB: rawMessages.length,
      prunedMessagesCount: prunedMessages.length,
      finalMessagesCount: prunedMessages.length + 1, // +1 for context
      lastPrunedMessages: prunedMessages.slice(-3).map((m) => ({
        role: m.role,
        preview: getMessageContent(m).substring(0, 100),
      })),
    });

    const finalMessages = [contextMessage, ...prunedMessages];

    const builderActivity =
      AdvisorContextBuilder.extractBuilderActivity(builderMessages);
    const tools = createTools(
      projectId,
      hatType,
      userMessageContent,
      unifiedContext, // Pass unified context to tools
      builderActivity, // Pass builder activity separately for analyzeProject
      projectFiles, // Pass already-read files to avoid duplicate reading
      prettyProjectName, // Pass project name
      {
        enabled: shipperCloudEnabled,
        hasDeployment: hasConvexDeployment,
      }, // Pass Shipper Cloud status
    );

    const stream = createUIMessageStream({
      execute: async (context) => {
        const writer = context.writer;

        const convertedMessages = convertToModelMessages(finalMessages);

        console.log("[HAL Chat] Converted messages for AI:", {
          messageCount: convertedMessages.length,
          messages: convertedMessages.map((m: any) => ({
            role: m.role,
            contentPreview:
              typeof m.content === "string"
                ? m.content.substring(0, 100)
                : JSON.stringify(m.content).substring(0, 100),
          })),
        });

        const halStream = streamText({
          model: openrouter(HAL_CHAT_MODEL, {
            extraBody: {
              usage: { include: true },
              max_tokens: 8000,
            },
          }),
          messages: convertedMessages,
          tools,
          // Allow more steps for natural conversation flow with web search
          stopWhen: ({ steps }) => {
            // Check if generateSuggestions was called in any step
            const hasGeneratedSuggestions = steps.some((step) =>
              step.toolCalls?.some(
                (call) => call.toolName === "generateSuggestions",
              ),
            );

            // Stop if generateSuggestions was called (prevents duplicate calls)
            if (hasGeneratedSuggestions) {
              return true;
            }
            return steps.length >= 2;
          },
          toolChoice: isSuggestionRequestDetected
            ? { type: "tool", toolName: "generateSuggestions" }
            : "auto",
          activeTools: ["webSearch", "generateSuggestions"],
          prepareStep: async ({ stepNumber }) => {
            const systemPrompt = `${systemPromptText}`;

            return {
              system: systemPrompt,
            };
          },
          experimental_transform: smoothStream(),
          experimental_telemetry: { isEnabled: true },
          onFinish: async (result) => {
            const { response, usage, providerMetadata } = result;
            const assistantContent =
              response.messages && response.messages.length > 0
                ? typeof response.messages[0].content === "string"
                  ? response.messages[0].content
                  : Array.isArray(response.messages[0].content)
                    ? response.messages[0].content
                        .filter((part: any) => part.type === "text")
                        .map((part: any) => part.text)
                        .join("")
                    : ""
                : "";

            // Save conversation to mem0 for better context memory
            const mem0Messages: Message[] = [
              { role: "user", content: userMessageContent },
              { role: "assistant", content: assistantContent },
            ];
            Mem0MemoryManager.addMemory({
              userId: session.user.id,
              projectId,
              messages: mem0Messages,
              metadata: {
                projectName: prettyProjectName,
                timestamp: new Date().toISOString(),
              },
            }).catch((error) => {
              console.error("[HAL Chat] Failed to save to mem0:", error);
            });
            try {
              await postHog.captureAIGeneration({
                distinct_id: session.user.id,
                $ai_trace_id: streamId,
                $ai_span_id: `hal-chat-${Date.now()}`,
                $ai_span_name: "hal_chat",
                $ai_model: response.modelId,
                $ai_provider:
                  (providerMetadata as any)?.openrouter?.provider ||
                  "openrouter",
                $ai_input: convertToModelMessages(finalMessages),
                $ai_input_tokens: usage?.inputTokens || 0,
                $ai_output_choices: response.messages || [],
                $ai_output_tokens: usage?.outputTokens || 0,
                $ai_total_cost_usd:
                  (providerMetadata as any)?.openrouter?.usage?.cost || 0,
                $ai_latency: (Date.now() - sessionStartTime) / 1000,
                $ai_http_status: 200,
                $ai_base_url: "https://openrouter.ai/api/v1",
                $ai_request_url:
                  "https://openrouter.ai/api/v1/chat/completions",
                $ai_is_error: false,
                $ai_temperature: 0.7,
                $ai_max_tokens: 4000,
                projectId,
                feature: "hal-chat",
                userRole: session.user.role || "USER",
                conversationId: streamId,
                ...getEnvironmentProperties(),
              });
            } catch (error) {
              console.error(
                "[PostHog] Failed to track HAL chat generation:",
                error,
              );
            }
          },
        });

        halStream.consumeStream();
        writer.merge(
          halStream.toUIMessageStream({
            sendFinish: false,
            sendReasoning: true,
          }),
        );
        await halStream.response;
      },
      onError: (error) => {
        return error instanceof Error ? error.message : String(error);
      },
      originalMessages: finalMessages,
      onFinish: async ({ responseMessage }) => {
        // Save assistant message with UIMessage format (the format that was streamed)
        if (
          responseMessage &&
          responseMessage.parts &&
          responseMessage.parts.length > 0
        ) {
          // Extract text content for the content field
          const contentText = responseMessage.parts
            .filter((part: any) => part.type === "text")
            .map((part: any) => part.text)
            .join("");

          // Save the full UIMessage parts structure
          await prisma.halChatMessage.create({
            data: {
              projectId,
              userId: session.user.id,
              role: "assistant",
              content: contentText, // Fallback for tool-only messages
              hatType,
              parts: JSON.parse(JSON.stringify(responseMessage.parts)), // Save UIMessage format
            },
          });

          console.log(
            "[HAL Chat] Saved assistant message with UIMessage format:",
            {
              messageId: responseMessage.id,
              contentLength: contentText.length,
              partsCount: responseMessage.parts.length,
              partTypes: responseMessage.parts.map((p: any) => p.type),
            },
          );
        }
      },
    });

    const response = createUIMessageStreamResponse({
      stream,
      headers: corsHeaders,
      async consumeSseStream(context) {
        const stream = context.stream;
        const streamContext = createResumableStreamContext({
          waitUntil: after,
        });
        await streamContext.createNewResumableStream(streamId, () => stream);
      },
    });

    return response;
  } catch (error) {
    console.error("HAL Chat API Error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: "Failed to process HAL chat request",
      },
      { status: 500, headers: corsHeaders },
    );
  }
}

export const POST = handler;
