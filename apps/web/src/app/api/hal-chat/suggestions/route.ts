import { streamObject } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { getSandbox } from "@/lib/daytona-sandbox-manager";
import { deslugifyProjectName } from "@/lib/project-namer";
import { Mem0MemoryManager, type Message } from "@/lib/mem0-memory";
import { stripIndents } from "@/lib/utils";
import { ADVISOR_HATS, type AdvisorHatType } from "@/lib/advisor-hats";

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
        normalizedPath === "index.html"),
  );
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

// OpenRouter configuration
const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const SUGGESTION_MODEL = "google/gemini-3-flash-preview";

// Schema for HAL suggestion response
const halSuggestionSchema = z.object({
  greeting: z
    .string()
    .describe(
      "Warm, empathetic greeting that sounds like you remember the user and their project. Reference something specific about their journey if possible.",
    ),
  suggestions: z
    .array(
      z.object({
        id: z.string().describe("Unique identifier for the suggestion"),
        title: z
          .string()
          .describe(
            "User-focused title with format: 'Help [users/visitors] [do something] by adding [specific feature]' (e.g., 'Help visitors contact you by adding a lead capture', 'Help users sign in easily by adding authentication').",
          ),
        description: z
          .string()
          .describe(
            "Brief explanation of the user benefit or next step in their journey",
          ),
        prompt: z
          .string()
          .describe(
            "The prompt to send when clicked. For builder suggestions: directive feature description (WHAT to build, not HOW). For advisor suggestions: detailed research question or discussion prompt.",
          ),
        targetChat: z
          .enum(["builder", "advisor"])
          .describe(
            "Where to send the prompt: 'builder' for main code generation chat, 'advisor' for research/advisory chat with the Advisor",
          ),
        icon: z
          .enum([
            "eye",
            "zap",
            "search",
            "file-text",
            "palette",
            "code",
            "users",
            "target",
          ])
          .describe("Icon identifier"),
        color: z
          .enum([
            "bg-purple-500",
            "bg-orange-500",
            "bg-blue-500",
            "bg-green-500",
            "bg-red-500",
            "bg-yellow-500",
          ])
          .describe("Background color class"),
      }),
    )
    .length(4)
    .describe(
      "Exactly 4 empathetic suggestions that anticipate the next logical steps in the user's project journey",
    ),
});

export async function POST(request: Request) {
  try {
    // Import auth here to avoid circular dependency issues
    const { auth } = await import("@/lib/auth");

    // Auth check
    const session = await auth();
    if (!session || !session.user) {
      return Response.json(
        {
          error: "Authentication required",
          message: "You must be signed in to access this resource",
        },
        { status: 401 },
      );
    }

    const body = await request.json();
    const projectId = body.projectId;
    const hatType: AdvisorHatType = body.hatType || 'generalist';

    if (!projectId) {
      return Response.json(
        { error: "Project ID is required" },
        { status: 400 },
      );
    }

    // Verify project access and get Shipper Cloud status
    const project = await prisma.project.findFirst({
      where: { id: projectId },
      include: {
        convexDeployment: {
          select: {
            convexDeploymentUrl: true,
            status: true,
          },
        },
      },
    });
    if (!project) {
      return Response.json(
        { error: "Project not found or access denied" },
        { status: 404 },
      );
    }

    // Shipper Cloud status
    const shipperCloudEnabled = project.shipperCloudEnabled;
    const hasConvexDeployment = !!project.convexDeployment;

    // Use pretty version of project name for AI prompts
    const prettyProjectName = deslugifyProjectName(project.name);

    // Get project files from Daytona sandbox
    let projectFiles: { [path: string]: string } = {};
    let fileCount = 0;

    try {
      console.log(
        "[HAL Suggestions] Getting sandbox info for project",
        projectId,
      );
      const sandboxInfo = await getSandbox(projectId);

      if (sandboxInfo) {
        console.log(
          "[HAL Suggestions] Found sandbox with",
          sandboxInfo.files.size,
          "files",
        );

        // Get file contents from sandbox for analysis
        const filePaths = Array.from(sandboxInfo.files.keys())
          .filter((path) => isRelevantFile(normalizeFilePath(path)))
          .slice(0, 20); // Limit to 20 most relevant files for analysis

        console.log(
          "[HAL Suggestions] Analyzing files:",
          filePaths.map((p) => normalizeFilePath(p)),
        );

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
              `[HAL Suggestions] Could not read file ${filePath}:`,
              fileError,
            );
          }
        }

        console.log(
          "[HAL Suggestions] Successfully read",
          fileCount,
          "files from sandbox",
        );
      } else {
        console.log(
          "[HAL Suggestions] No sandbox found, trying to get project files from database",
        );

        // Fallback: Get files from active V2Fragment if available
        if (project.activeFragmentId) {
          const activeFragment = await prisma.v2Fragment.findUnique({
            where: { id: project.activeFragmentId },
            select: { files: true, title: true },
          });

          if (activeFragment && activeFragment.files) {
            projectFiles = activeFragment.files as { [path: string]: string };
            fileCount = Object.keys(projectFiles).length;
            console.log(
              "[HAL Suggestions] Using",
              fileCount,
              "files from active V2Fragment",
            );
          }
        }
      }
    } catch (error) {
      console.error("[HAL Suggestions] Error getting project files:", error);

      // Final fallback: Get files from active V2Fragment
      if (project.activeFragmentId) {
        try {
          const activeFragment = await prisma.v2Fragment.findUnique({
            where: { id: project.activeFragmentId },
            select: { files: true, title: true },
          });

          if (activeFragment && activeFragment.files) {
            projectFiles = activeFragment.files as { [path: string]: string };
            fileCount = Object.keys(projectFiles).length;
            console.log(
              "[HAL Suggestions] Fallback: Using",
              fileCount,
              "files from active V2Fragment",
            );
          }
        } catch (fragmentError) {
          console.error(
            "[HAL Suggestions] Could not get fallback fragment files:",
            fragmentError,
          );
        }
      }
    }

    if (fileCount === 0) {
      console.warn("[HAL Suggestions] No project files available for analysis");
      return Response.json(
        { error: "No project files available for analysis" },
        { status: 404 },
      );
    }

    // Enhanced project analysis
    const projectAnalysis = analyzeProjectStructure(projectFiles);
    const projectPurpose = analyzeProjectPurpose(projectFiles);
    const projectInsights = getProjectInsights(projectFiles, projectAnalysis);

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
          // Show essential parts of package.json
          try {
            const pkg = JSON.parse(content);
            preview = JSON.stringify(
              {
                name: pkg.name,
                description: pkg.description,
                dependencies: Object.keys(pkg.dependencies || {}).slice(0, 10),
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
          // Extract title and key meta information
          const titleMatch = content.match(/<title>(.*?)<\/title>/);
          const metaMatch = content.match(
            /<meta name="description" content="(.*?)"/,
          );
          preview = `Title: ${titleMatch ? titleMatch[1] : "No title"}
Meta Description: ${metaMatch ? metaMatch[1] : "None"}
Body: ${content.includes('<div id="root">') ? "React app root detected" : "Standard HTML"}`;
        } else if (path.includes("App.")) {
          // Show component structure and imports
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
${shipperCloudEnabled ? `✅ Shipper Cloud is ENABLED for this project
- Backend deployed: ${hasConvexDeployment ? "Yes" : "Pending"}
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

    // Build rich context from mem0 memories
    const mem0Context = await Mem0MemoryManager.buildContextForAI({
      userId: session.user.id,
      projectId,
      currentMessage: "Generate suggestions for project improvements",
    });

    // Stream the suggestion generation
    try {
      const hatConfig = ADVISOR_HATS[hatType];
      const result = streamObject({
        model: openrouter(SUGGESTION_MODEL),
        schema: halSuggestionSchema,
        prompt: `You are ${hatConfig.name} — an empathetic AI mentor helping users build "${prettyProjectName}"${projectPurpose.description ? ` (${projectPurpose.description})` : ""}.

YOUR SPECIALIZATION:
${hatConfig.systemPromptAddition}

Focus all your suggestions on your area of expertise: ${hatConfig.description}

YOUR CORE MISSION:
You're not a technical assistant. You're a mentor who:
- **Remembers the journey**: You know what they've built, what they're working toward, and what matters to them
- **Thinks one step ahead**: You anticipate the next logical move in their project journey, not basics
- **Speaks with empathy**: You understand their goals and talk like someone who genuinely gets what they're trying to achieve
- **Focuses on their users**: Every suggestion should be about making their app better for the people using it

NOTE: Users can also chat with you directly in the Advisor panel for more personalized help, market research, competitor analysis, or any questions about their project. In chat mode, you have access to real-time web search to research current trends, competitor features, pricing strategies, and technical patterns.

${mem0Context ? `\nCONVERSATION HISTORY & CONTEXT:\n${mem0Context}\n\nUse this context to inform your suggestions. Reference what they've already done or discussed. Don't suggest things they've already built or rejected.` : ""}

CURRENT PROJECT STATE:
${projectContext}

HOW TO CREATE SUGGESTIONS:

1. **Think About Where They Are Now**
   - What stage is this project at? (Early prototype? Adding features? Preparing to launch? Growing?)
   - What have they already built or discussed in past conversations?
   - What would naturally come next in their journey?

2. **Mix Builder and Advisor Suggestions**
   - Provide a balanced mix of actionable build suggestions AND strategic advisor conversations
   - Builder suggestions (targetChat: "builder"): Concrete features to add to the app
   - Advisor suggestions (targetChat: "advisor"): Research, strategy, market analysis, business decisions
   
3. **Be a Mentor, Not a Feature List Generator**
   - DON'T suggest generic improvements ("Add authentication", "Improve mobile experience")
   - DO suggest the next logical step based on where they are ("Now that you have X working, let's help users Y")
   - Reference their actual project context: "I noticed you're building ${prettyProjectName}..."

4. **Focus on THEIR Users, Not Code**
   - Every suggestion should be about the people using their app or the business
   - Talk about user problems and business opportunities, not technical solutions
   - Example: "Help users find what they need faster" not "Add search functionality"
   - Example: "Research what competitors charge" not "Add pricing page"

5. **Anticipate the Next Move**
   - If they just built core features → suggest market research or early user acquisition
   - If they have users → suggest engagement strategies or feature validation
   - If they're growing → suggest competitive analysis or monetization research
   - Always think: "What would a smart founder do next?"

6. **Shipper Cloud Awareness**
   - Check the SHIPPER CLOUD STATUS in project context
   - If NOT enabled and they need auth/database/backend → suggest enabling Shipper Cloud
   - If ENABLED → suggest features that leverage it (user accounts, saved data, real-time sync)
   - Never suggest external auth services (Auth0, Clerk) or databases (Supabase, Firebase) when Shipper Cloud can do it
   - For builder prompts, mention that Shipper Cloud provides the backend - no need to specify implementation details

GREETING INSTRUCTIONS:
- Sound like you remember them and their project
- Reference something specific if possible (from conversation memory or project context)
- Feel warm and encouraging, not robotic
- Example: "Hey! ${prettyProjectName} is really coming together..." NOT "I've analyzed your project"
- NO technical terminology in the greeting

TITLE WRITING (what users see in the UI):
✅ GOOD titles (benefit + specific feature):
- "Help visitors contact you by adding a lead capture"
- "Help users sign in easily by adding authentication"
- "Help users find content by adding search"
- "Help customers complete purchases by adding payment checkout"
- "Help users track progress by adding a dashboard"
- "Help users stay updated by adding email notifications"

❌ BAD titles (too vague or doesn't say what's added):
- "Make it easier for users to sign in" (doesn't say what's being added)
- "Help visitors contact you" (doesn't say HOW - what feature?)
- "Improve user experience" (way too vague)
- "Add OAuth2 authentication with JWT" (too technical)
- "Implement NextAuth.js integration" (too technical)

SUGGESTION STRUCTURE (4 parts):
Each suggestion has 4 fields that serve different purposes:

1. **title** (shown to user in UI):
   - Lead with user benefit or action
   - Builder suggestions: "Help [users] [do something] by adding [feature]"
   - Advisor suggestions: "Research [topic]" or "Explore [opportunity]"
   - Examples: "Help visitors contact you by adding a lead capture", "Research competitor pricing strategies", "Explore monetization options"

2. **description** (shown to user in UI):
   - Brief explanation of benefit or what will be discussed
   - Example (builder): "Add multiple login options so users can choose their preferred method"
   - Example (advisor): "Analyze what similar products charge and how they structure their pricing tiers"

3. **targetChat** (routing decision):
   - "builder": Sends prompt to main code generation chat (for building features)
   - "advisor": Sends prompt to Advisor chat (for research, strategy, market analysis)
   
4. **prompt** (the actual prompt sent - NOT shown to user):
   
   FOR BUILDER SUGGESTIONS (targetChat: "builder"):
   - CRITICAL: Describe WHAT to build, NEVER HOW to build it
   - Start with action verbs: "Build", "Add", "Implement", "Create"
   - Focus ONLY on: functionality, behavior, user experience, data needs
   - Example: "Build a lead capture form that collects visitor names and email addresses. Include input validation to ensure emails are properly formatted. When submitted, save the data and show a success message. Handle errors gracefully with clear messages. Include a loading state while processing."
   
   FOR ADVISOR SUGGESTIONS (targetChat: "advisor"):
   - Write as a detailed research or discussion prompt
   - Be specific about what to research or analyze
   - Frame as a conversation starter, not a code request
   - Example: "I want to understand the competitive landscape for ${prettyProjectName}. Can you research what similar products exist, what features they offer, how they position themselves, and what their pricing looks like? Help me identify opportunities to differentiate."
   - Example: "Let's explore monetization strategies for this type of product. What are common pricing models in this space? What do users expect to pay for? Should we do freemium, subscription, one-time purchase, or something else?"

WHEN TO USE ADVISOR SUGGESTIONS:
Use targetChat: "advisor" for suggestions about:
- Market research and competitive analysis
- Pricing strategy and monetization decisions
- User research and validation
- Product positioning and marketing
- Strategic business decisions
- Feature prioritization discussions
- Growth and acquisition strategies

Aim for AT LEAST 1-2 advisor suggestions in each set of 4 suggestions.

STRICT RULES - NEVER INCLUDE:
❌ NO package names (react-hook-form, zod, axios, NextAuth, etc.)
❌ NO library names (Radix UI, shadcn/ui, Tailwind, etc.)
❌ NO file paths (src/components/Form.tsx, /api/endpoint, etc.)
❌ NO component names (AlertDialog, Card, Button, etc.)
❌ NO specific technologies (tRPC, Prisma, etc.)
❌ NO implementation details about "using X" or "with Y"

ALWAYS INCLUDE:
✅ What the feature does for users
✅ Required inputs and outputs
✅ Expected behaviors and interactions
✅ Data validation requirements
✅ States: loading, success, error, empty
✅ Edge cases and error scenarios
✅ User feedback and messages

GOOD EXAMPLES:
✅ "Build a lead capture form that collects visitor names and email addresses. Validate that the email field contains a valid email format. When the user submits, save the information and display a success message. If saving fails, show an error message. Show a loading indicator while processing the submission."

✅ "Create a user dashboard showing key account metrics and recent activity. Display total number of projects, active users, and revenue for the current month. List the 5 most recent activities with timestamps. Include quick action buttons for creating new projects and inviting team members. Show loading states while fetching data and friendly error messages if data fails to load."

✅ "Add a search feature that lets users find items by typing keywords. Automatically search after the user stops typing for a moment to avoid too many searches. Display matching results below the search box. Allow users to navigate results with arrow keys and select with Enter. Show 'No results found' when nothing matches. Clear results when the search box is emptied."

✅ (When Shipper Cloud enabled): "Add user authentication with sign up and sign in pages. The sign up page should collect email and password, validate inputs, and create a new account. The sign in page should authenticate existing users. After successful authentication, redirect to the dashboard. Show clear error messages for invalid credentials or existing accounts. Include a 'Forgot Password' link placeholder."

✅ (When Shipper Cloud NOT enabled): "Enable Shipper Cloud to add a backend with user authentication and database. This will let you save user data, add sign-in functionality, and build features that require persistent storage."

BAD EXAMPLES (DO NOT WRITE LIKE THIS):
❌ "Create a form component at src/components/LeadForm.tsx using react-hook-form and zod for validation. Use Radix UI Input components styled with Tailwind CSS."
(Reason: Mentions file paths, packages, libraries, and styling frameworks)

❌ "Build a dashboard with shadcn/ui Card components. Fetch data using tRPC from /api/dashboard endpoint. Use Skeleton components for loading states."
(Reason: Specifies UI library, data fetching library, specific components)

❌ "Implement search with debounced input using React hooks. Display results in a Radix UI Popover component."
(Reason: Mentions implementation approach and specific UI component)

REMEMBER: Describe the feature requirements and user experience. Let the builder AI figure out the best way to implement it with the existing tech stack.`,
        onFinish: async (result) => {
          // Handle case where result is undefined due to API errors (e.g., quota exceeded)
          if (!result || !result.object) {
            console.error(
              "[HAL Suggestions] No result object received - possible API quota or error",
            );
            return;
          }
          if (result.object) {
            // Save the suggestion message to database with current timestamp
            console.log(
              "[HAL Suggestions] Generated suggestions successfully",
              {
                suggestions: result.object.suggestions,
              },
            );
            try {
              const dbSuggestions = result.object.suggestions.map(
                (suggestion) => ({
                  id:
                    suggestion.id ||
                    `suggestion-${Date.now()}-${Math.random()}`,
                  title: suggestion.title || "Untitled Suggestion",
                  description: suggestion.description || "",
                  icon: suggestion.icon || "sparkles",
                  color: suggestion.color || "bg-gray-500",
                  prompt: suggestion.prompt || "",
                  targetChat: suggestion.targetChat || "builder",
                  category: "general",
                }),
              );

              // Use the authenticated user's ID from the session
              const userId = session.user.id;

              await prisma.halChatMessage.create({
                data: {
                  projectId,
                  userId,
                  role: "assistant",
                  content:
                    result.object?.greeting ||
                    `Hello! I've analyzed "${prettyProjectName}"${projectPurpose.description ? ` (${projectPurpose.description})` : ""} and here are some tailored suggestions:`,
                  hatType, // Add hatType for filtering suggestions by hat
                  suggestions: {
                    create: dbSuggestions.map((suggestion) => ({
                      suggestionId: suggestion.id,
                      title: suggestion.title,
                      description: suggestion.description,
                      icon: suggestion.icon,
                      color: suggestion.color,
                      prompt: suggestion.prompt,
                      targetChat: suggestion.targetChat,
                      hatType, // Add hatType to each suggestion
                    })),
                  },
                },
              });

              console.log(
                "[HAL Suggestions] Saved suggestion message to database",
              );

              // Save suggestions to mem0 for better context memory
              // This happens in the background - don't block the response
              const suggestionsSummary = result.object.suggestions
                .map((s) => `- ${s.title}: ${s.description}`)
                .join("\n");
              const assistantContent =
                result.object?.greeting ||
                `Hello! I've analyzed "${prettyProjectName}" and here are some tailored suggestions:`;
              const fullAssistantMessage = `${assistantContent}\n\n${suggestionsSummary}`;

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
                  suggestionCount: result.object.suggestions.length,
                },
              }).catch((error) => {
                console.error(
                  "[HAL Suggestions] Failed to save to mem0:",
                  error,
                );
              });
            } catch (error) {
              console.error(
                "[HAL Suggestions] Failed to save to database:",
                error,
              );
            }
          }
        },
      });

      return result.toTextStreamResponse();
    } catch (streamError) {
      console.error("[HAL Suggestions] StreamObject Error:", streamError);
      return Response.json(
        { error: "Failed to generate suggestions" },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("[HAL Suggestions] Error:", error);
    return Response.json(
      { error: "Failed to generate suggestions" },
      { status: 500 },
    );
  }
}
