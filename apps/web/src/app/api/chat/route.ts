import { getFullStackPrompt } from "@/app/api/chat/_prompts/v2-full-stack-prompt";
import { toolNames, tools, ToolsContext } from "@/lib/ai/v2-tools";
import { getSandbox, createSandbox } from "@/lib/daytona-sandbox-manager";
import {
  getSandboxProvider,
  setSandboxProvider,
  getDefaultProvider,
} from "@/lib/sandbox-provider-utils";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { loadChat, upsertMessage } from "@/lib/db/actions";
import { CreditManager } from "@/lib/credits";
import {
  analyzePromptComplexity,
  ComplexityAnalysis,
} from "@/lib/complexity-analyzer";
import { ContextManager } from "@/lib/context-manager";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { deslugifyProjectName } from "@/lib/project-namer";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  smoothStream,
  stepCountIs,
  streamText,
  UIMessage,
} from "ai";
import { NextResponse } from "next/server";
import { after } from "next/server";
import { createResumableStreamContext } from "resumable-stream";
// PostHog analytics for LLM tracking
import {
  getPostHogCapture,
  generateSpanId,
  getEnvironmentProperties,
} from "@/lib/posthog-capture";
import { Mem0MemoryManager, type Message } from "@/lib/mem0-memory";
import throttle from "throttleit";

// Allow streaming responses up to 5 minutes
export const maxDuration = 800;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

const MAX_STEPS = 30; // Increased to allow more complex tasks

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

// PostHog manual capture instance
const postHog = getPostHogCapture();

const CONTEXT_ANALYZER_MODEL =
  process.env.NODE_ENV === "production"
    ? "@preset/context-analyzer"
    : "@preset/dev-context-analyzer";

const INITIAL_FULL_STACK_DEVELOPER_MODEL =
  process.env.NODE_ENV === "production"
    ? "@preset/init-full-stack-dev"
    : "@preset/dev-init-full-stack-dev";

const FULL_STACK_DEVELOPER_MODEL =
  process.env.NODE_ENV === "production"
    ? "@preset/full-stack-devloper"
    : "@preset/dev-full-stack-devloper";

async function handler(req: Request) {
  // Check authentication first
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

  const { message, projectId }: { message: UIMessage; projectId: string } =
    await req.json();

  // Create abort controller that combines request signal with manual control
  const abortController = new AbortController();

  // Generate streamId before trace for metadata access
  const streamId = generateId();

  try {
    // Track session start time for trace latency calculation
    const sessionStartTime = Date.now();

    // with depth
    console.log("[Chat API] Incoming request");
    console.dir({ message, projectId }, { depth: null });

    // Evaluator - Operator: single orchestrator stream
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        // Set up cleanup on abort
        abortController.signal.addEventListener("abort", () => {
          console.log("[Chat API] Abort signal received, cleaning up");
          // Clear the active stream ID to prevent further processing
          prisma.project
            .update({
              where: { id: projectId },
              data: {
                activeStreamId: null,
                buildStatus: "IDLE",
                buildStatusUpdatedAt: new Date(),
              },
            })
            .catch((err) =>
              console.error(
                "[Chat API] Failed to clear activeStreamId on abort:",
                err,
              ),
            );
        });

        // Initialize context manager
        const contextManager = new ContextManager();

        // Initialize timing tracker
        const timings = {
          sessionStart: Date.now(),
          complexityAnalysis: { start: 0, end: 0 },
          creditDeduction: { start: 0, end: 0 },
          fragmentCreation: { start: 0, end: 0 },
          sandboxSetup: { start: 0, end: 0 },
          sandboxCreation: { start: 0, end: 0 },
          contextAnalyzer: { start: 0, end: 0 },
          fullStackDev: { start: 0, end: 0 },
        };

        // Validate project ID
        if (!projectId) {
          console.warn("[Chat API] Project ID is required", {
            message,
            projectId,
          });
          throw new Error("Project ID is required");
        }

        // Track trace start with PostHog after response
        after(async () => {
          try {
            await postHog.captureAITrace({
              distinct_id: session.user.id,
              $ai_trace_id: streamId,
              $ai_span_name: "chat_session",
              $ai_input_state: { message, projectId },
              projectId,
              userRole: session.user.role || "USER",
              ...getEnvironmentProperties(),
            });
          } catch (error) {
            console.error("[PostHog] Failed to track trace start:", error);
          }
        });

        // Verify project access and set to v2 messaging
        const project = await prisma.project.findFirst({
          where: {
            id: projectId,
          },
        });

        if (!project) {
          throw new Error("Project not found or access denied");
        }

        console.log("[Chat API] Project found", project);

        // Extract project name and convert slug to pretty name
        const projectSlug = project.name;
        const projectName = deslugifyProjectName(projectSlug);
        console.log(
          `[Chat API] Working on project: "${projectName}" (slug: ${projectSlug})`,
        );

        // Set activeStreamId early to handle user reconnection and cancellation
        console.log(
          "[Chat API] Updating project with active streamId:",
          streamId,
        );

        await prisma.project.update({
          where: { id: projectId },
          data: {
            activeStreamId: streamId,
            buildStatus: "GENERATING",
            buildStatusUpdatedAt: new Date(),
            buildError: null,
          },
        });

        // Store recommended template for sandbox creation
        // This will be used when creating a new sandbox in the execute function
        let selectedTemplate = "vite-template-2"; // Default template

        // Store complexity analysis for model selection
        let complexityAnalysis: ComplexityAnalysis | undefined;

        // Check and deduct credits for user messages (track this operation)
        if (message.role === "user") {
          // Track complexity analysis span start
          const complexitySpanId = `complexity-analysis-${Date.now()}`;
          timings.complexityAnalysis.start = Date.now();

          // Analyze prompt complexity to determine credit cost
          let complexityAnalysisResult;
          try {
            const messageContent = contextManager.getMessageContent(message);
            const truncatedContent =
              contextManager.truncateMessage(messageContent);

            console.log("[Chat API] Analyzing message content:", {
              originalLength: messageContent.length,
              truncatedLength: truncatedContent.length,
              wasTruncated: messageContent.length !== truncatedContent.length,
              isEmpty: !messageContent.trim(),
            });

            complexityAnalysisResult = await analyzePromptComplexity(
              truncatedContent,
              session.user.id,
              streamId,
              projectId,
              projectName,
            );

            // Store for model selection later
            complexityAnalysis = complexityAnalysisResult;

            timings.complexityAnalysis.end = Date.now();

            // Complexity analysis tracking is now handled within the analyzer function
          } catch (error) {
            timings.complexityAnalysis.end = Date.now();
            console.error("[Chat API] Complexity analysis failed:", error);

            // Complexity analysis error tracking is now handled within the analyzer function

            throw new Error(
              "AI-based complexity analysis is currently unavailable. Please try again later.",
            );
          }

          const creditCost = complexityAnalysisResult.creditCost;
          const recommendedTemplate =
            complexityAnalysisResult.recommendedTemplate;

          // Update selectedTemplate with the AI's recommendation for this message
          if (recommendedTemplate) {
            selectedTemplate = recommendedTemplate;
          }

          console.log("[Chat API] Complexity analysis result:", {
            complexity: complexityAnalysisResult.complexity,
            creditCost,
            category: complexityAnalysisResult.category,
            description: complexityAnalysisResult.description,
            adjustedForMinimumBalance:
              complexityAnalysisResult.adjustedForMinimumBalance,
            originalCreditCost: complexityAnalysisResult.originalCreditCost,
            recommendedTemplate,
            selectedTemplate,
          });

          // Track credit deduction span
          const creditSpanId = `credit-deduction-${Date.now()}`;
          timings.creditDeduction.start = Date.now();

          try {
            await CreditManager.deductCredits(
              session.user.id,
              creditCost,
              "AI_GENERATION",
              `V2 message generation for "${projectName}" - ${complexityAnalysisResult.category} task (${complexityAnalysisResult.description})`,
              {
                projectId,
                projectName,
                input: contextManager.getMessageContent(message),
                complexity: complexityAnalysisResult.complexity,
                category: complexityAnalysisResult.category,
                factors: complexityAnalysisResult.factors,
              },
            );
            timings.creditDeduction.end = Date.now();
            console.log(
              `[Chat API] Deducted ${creditCost} credits for ${complexityAnalysisResult.category} task: ${complexityAnalysisResult.description}`,
            );
            // Track credit deduction success after response
            after(async () => {
              try {
                await postHog.captureAISpan({
                  distinct_id: session.user.id,
                  $ai_trace_id: streamId,
                  $ai_span_id: creditSpanId,
                  $ai_span_name: "credit_deduction",
                  $ai_input_state: {
                    userId: session.user.id,
                    creditCost,
                    operation: "AI_GENERATION",
                    projectId,
                    complexityAnalysis,
                  },
                  $ai_output_state: {
                    success: true,
                    creditsDeducted: creditCost,
                  },
                  $ai_latency:
                    (timings.creditDeduction.end -
                      timings.creditDeduction.start) /
                    1000,
                  ...getEnvironmentProperties(),
                });
              } catch (error) {
                console.error(
                  "[PostHog] Failed to track credit deduction:",
                  error,
                );
              }
            });
          } catch (error) {
            console.error("[Chat API] Credit deduction failed:", error);

            // Track credit deduction error after response
            after(async () => {
              try {
                await postHog.captureAISpan({
                  distinct_id: session.user.id,
                  $ai_trace_id: streamId,
                  $ai_span_id: creditSpanId,
                  $ai_span_name: "credit_deduction",
                  $ai_input_state: {
                    userId: session.user.id,
                    creditCost,
                    operation: "AI_GENERATION",
                    projectId,
                    complexityAnalysis,
                  },
                  $ai_output_state: null,
                  $ai_latency:
                    (timings.creditDeduction.end -
                      timings.creditDeduction.start) /
                    1000,
                  $ai_is_error: true,
                  $ai_error:
                    error instanceof Error ? error.message : String(error),
                  ...getEnvironmentProperties(),
                });
              } catch (trackingError) {
                console.error(
                  "[PostHog] Failed to track credit deduction error:",
                  trackingError,
                );
              }
            });

            const errorMessage =
              error instanceof Error ? error.message : String(error);

            // Check if it's a minimum balance error
            if (errorMessage.includes("Minimum balance")) {
              const minimumBalance = CreditManager.getMinimumBalance();
              const adjustedMessage =
                complexityAnalysisResult.adjustedForMinimumBalance
                  ? `This ${complexityAnalysisResult.category} task was automatically adjusted to ${creditCost} credits (from ${complexityAnalysisResult.originalCreditCost}) to maintain the minimum balance of ${minimumBalance} credits, but you still don't have enough credits. Please purchase more credits to continue.`
                  : `This ${complexityAnalysisResult.category} task requires ${creditCost} credits, but you must maintain a minimum balance of ${minimumBalance} credits. Please purchase more credits to continue.`;

              throw new Error(adjustedMessage);
            }

            const insufficientMessage =
              complexityAnalysisResult.adjustedForMinimumBalance
                ? `This ${complexityAnalysisResult.category} task was automatically adjusted to ${creditCost} credits (from ${complexityAnalysisResult.originalCreditCost}) due to minimum balance requirements, but you still don't have enough credits. Please purchase more credits to continue.`
                : `This ${complexityAnalysisResult.category} task requires ${creditCost} credits. Please purchase credits to continue.`;

            throw new Error(insufficientMessage);
          }
        }

        // create or update last message in database
        await upsertMessage(message, projectId);

        // load the previous messages from the server:
        const rawMessages = await loadChat(projectId); // Load all messages to match client state

        // Prune conversation context for AI processing to prevent overflow
        const prunedMessages = contextManager.pruneConversation(rawMessages);

        // Initialize fragment files before using them
        let initialFiles = {};

        // Log context management summary (will be updated after fragment loading)
        let contextSummary = contextManager.getContextSummary(
          prunedMessages,
          initialFiles,
        );
        console.log("[Chat API] Context summary:", contextSummary);

        // Create a new working fragment at the start of the AI generation for user messages
        let workingFragmentId = project.activeFragmentId || undefined;
        if (message.role === "user") {
          // Generate smarter fragment title based on message content
          const generateFragmentTitle = (messageContent: string): string => {
            const content = messageContent.toLowerCase();

            // Extract key action words and topics
            if (content.includes("login") || content.includes("auth")) {
              return `Add authentication system - ${new Date().toLocaleTimeString()}`;
            } else if (
              content.includes("dashboard") ||
              content.includes("admin")
            ) {
              return `Create dashboard interface - ${new Date().toLocaleTimeString()}`;
            } else if (
              content.includes("cart") ||
              content.includes("shop") ||
              content.includes("ecommerce")
            ) {
              return `Build shopping cart feature - ${new Date().toLocaleTimeString()}`;
            } else if (content.includes("todo") || content.includes("task")) {
              return `Implement todo functionality - ${new Date().toLocaleTimeString()}`;
            } else if (
              content.includes("profile") ||
              content.includes("user")
            ) {
              return `Add user profile system - ${new Date().toLocaleTimeString()}`;
            } else if (
              content.includes("payment") ||
              content.includes("stripe")
            ) {
              return `Integrate payment system - ${new Date().toLocaleTimeString()}`;
            } else if (
              content.includes("theme") ||
              content.includes("design") ||
              content.includes("style")
            ) {
              return `Update theme and styling - ${new Date().toLocaleTimeString()}`;
            } else if (
              content.includes("component") ||
              content.includes("ui")
            ) {
              return `Create UI components - ${new Date().toLocaleTimeString()}`;
            } else if (
              content.includes("fix") ||
              content.includes("bug") ||
              content.includes("error")
            ) {
              return `Fix application issues - ${new Date().toLocaleTimeString()}`;
            } else {
              // Extract first few meaningful words
              const words = messageContent
                .split(" ")
                .filter(
                  (word) =>
                    word.length > 3 &&
                    ![
                      "the",
                      "and",
                      "for",
                      "with",
                      "this",
                      "that",
                      "can",
                      "you",
                      "please",
                    ].includes(word.toLowerCase()),
                )
                .slice(0, 3);

              if (words.length > 0) {
                return `${words.join(" ")} - ${new Date().toLocaleTimeString()}`;
              }
              return `Work in progress - ${new Date().toLocaleString()}`;
            }
          };

          const fragmentTitle = generateFragmentTitle(
            contextManager.getMessageContent(message),
          );

          // Get the currently active fragment's files to build upon
          if (project.activeFragmentId) {
            console.log(
              `[Chat API] Building upon active fragment ${project.activeFragmentId}`,
            );

            try {
              const activeFragment = await prisma.v2Fragment.findUnique({
                where: { id: project.activeFragmentId },
                select: { files: true, title: true, createdAt: true },
              });

              if (activeFragment && activeFragment.files) {
                // Always use the selected fragment's files directly
                // This ensures the AI builds from the exact state the user selected
                const files = activeFragment.files as {
                  [path: string]: string;
                };
                // Optimize fragment files to prevent context overflow
                initialFiles = contextManager.optimizeFragmentFiles(files);
                console.log(
                  `[Chat API] Using optimized files from selected fragment "${activeFragment.title}" (${Object.keys(files).length} original -> ${Object.keys(initialFiles).length} optimized files)`,
                );

                // Update context summary with loaded fragment files
                contextSummary = contextManager.getContextSummary(
                  prunedMessages,
                  initialFiles,
                );
                console.log(
                  "[Chat API] Updated context summary with fragment files:",
                  contextSummary,
                );
              }
            } catch (error) {
              console.error(
                `[Chat API] Failed to get active fragment files, starting with empty:`,
                error,
              );
            }
          }

          timings.fragmentCreation.start = Date.now();

          const workingFragment = await prisma.v2Fragment.create({
            data: {
              title: fragmentTitle,
              files: initialFiles, // Start with files from active fragment (builds upon current state)
              projectId,
            },
          });
          workingFragmentId = workingFragment.id;

          // Update the project's activeFragmentId to point to the new working fragment
          await prisma.project.update({
            where: { id: projectId },
            data: { activeFragmentId: workingFragment.id },
          });

          timings.fragmentCreation.end = Date.now();

          console.log(
            `[Chat API] Created working fragment ${workingFragment.id} with title "${fragmentTitle}" (${Object.keys(initialFiles).length} initial files) and updated project activeFragmentId for user message`,
          );
        }

        // Initialize fragmentFiles with the initial files from the active fragment
        const fragmentFilesMap = new Map<string, string>();
        if (workingFragmentId && Object.keys(initialFiles).length > 0) {
          // Populate fragmentFiles with initial files so AI knows the current state
          Object.entries(initialFiles).forEach(([path, content]) => {
            fragmentFilesMap.set(path, content as string);
          });
          console.log(
            `[Chat API] Initialized fragmentFiles context with ${fragmentFilesMap.size} files from active fragment`,
          );
        }

        const toolsContext: ToolsContext = {
          projectId,
          userId: session.user.id,
          sandbox: null,
          sandboxId: null,
          sandboxUrl: null,
          files: new Map<string, { size: number; modified: number }>(),
          fragmentFiles: fragmentFilesMap,
          currentFragmentId: workingFragmentId,
          traceId: streamId,
          lspServers: new Map(),
          todos: [], // Initialize empty todos array for task tracking
        };

        console.log("[Chat API] Sandbox status: loading");

        timings.sandboxSetup.start = Date.now();

        // Ensure sandbox is always available before proceeding
        let sandboxInfo: {
          sandbox: any; // Daytona sandbox instance
          sandboxUrl: string;
          sandboxExpiresAt?: Date | null;
          files: Map<string, { size: number; modified: number }>;
        } | null = await getSandbox(projectId);

        // Only create a new sandbox if one doesn't exist
        if (!sandboxInfo) {
          console.log("[Chat API] No existing sandbox found, creating new one");

          console.log("[Chat API] Sandbox status: creating");

          // Update build status to INITIALIZING during sandbox creation
          await prisma.project.update({
            where: { id: projectId },
            data: {
              buildStatus: "INITIALIZING",
              buildStatusUpdatedAt: new Date(),
            },
          });

          // Don't write sandbox creation messages - let the AI handle communicating status
          // The sandbox creation happens silently in the background

          try {
            timings.sandboxCreation.start = Date.now();

            // Detect or set the provider for this project
            let provider = await getSandboxProvider(projectId);
            if (!provider) {
              provider = getDefaultProvider(); // "modal"
              await setSandboxProvider(projectId, provider);
              console.log(`[Chat API] Set default provider for project: ${provider}`);
            } else {
              console.log(`[Chat API] Project uses provider: ${provider}`);
            }

            // Map template to provider-appropriate template
            // Modal templates: "database", "calculator", "content-sharing", etc.
            // Daytona templates: "vite-template-v4", "vite-template-2", etc.
            const templateName = provider === "modal"
              ? (selectedTemplate === "vite-template-2" || selectedTemplate === "vite-template-v4"
                  ? "database" // Default Modal template
                  : selectedTemplate) // Use as-is if it's a specific template
              : selectedTemplate; // For Daytona, use the selected template as-is

            console.log(
              `[Chat API] Creating ${provider} sandbox with template: ${templateName}`,
            );
            sandboxInfo = await createSandbox(
              projectId,
              undefined,
              templateName,
            );
            timings.sandboxCreation.end = Date.now();
            if (!sandboxInfo) {
              throw new Error("Failed to create sandbox");
            }
            console.log("[Chat API] Successfully created new sandbox", {
              sandboxId: sandboxInfo.sandbox.id,
              sandboxUrl: sandboxInfo.sandboxUrl,
              template: selectedTemplate,
            });
          } catch (error) {
            console.error("[Chat API] Failed to create sandbox:", error);
            timings.sandboxCreation.end = Date.now();
            timings.sandboxSetup.end = Date.now();
            // Sandbox creation failed - error will be thrown
            // Let the error bubble up - the AI will handle communicating the failure
            throw error;
          }
        } else {
          console.log("[Chat API] Using existing sandbox", {
            sandboxId: sandboxInfo.sandbox.id,
            sandboxUrl: sandboxInfo.sandboxUrl,
          });
        }

        timings.sandboxSetup.end = Date.now();

        // Send ready status once sandbox is available (either existing or newly created)
        console.log(
          "[Chat API] Sandbox ready with URL:",
          sandboxInfo.sandboxUrl,
        );

        // Update build status back to GENERATING now that sandbox is ready
        // Only update if we're not already at GENERATING (to avoid race conditions)
        const currentProject = await prisma.project.findUnique({
          where: { id: projectId },
          select: { buildStatus: true },
        });

        if (currentProject?.buildStatus === "INITIALIZING") {
          await prisma.project.update({
            where: { id: projectId },
            data: {
              buildStatus: "GENERATING",
              buildStatusUpdatedAt: new Date(),
            },
          });
        }

        // Update toolsContext with sandbox info - guaranteed to be non-null at this point
        toolsContext.sandbox = sandboxInfo.sandbox;
        toolsContext.sandboxId = sandboxInfo.sandbox.id; // Set sandboxId for API-based tools
        toolsContext.sandboxUrl = sandboxInfo.sandboxUrl;
        toolsContext.files = sandboxInfo.files;

        // skip analysis stream if more than 1 user message
        const userMessages = prunedMessages.filter((m) => m.role === "user");

        console.log(`[PostHog] Starting full-stack development`);
        const fsdStartTime = Date.now();
        timings.fullStackDev.start = Date.now();

        // Determine which model to use based on complexity
        // For first user message OR complex/advanced tasks: use the powerful model
        // For follow-ups with simple/moderate tasks: use the faster model
        const isFirstUserMessage = userMessages.length === 1;

        // Check if user is indicating they want to continue
        const lastUserMessage = userMessages[userMessages.length - 1];
        const messageContent = contextManager
          .getMessageContent(lastUserMessage)
          .toLowerCase();
        const isContinuationRequest =
          messageContent.includes("continue") ||
          messageContent.includes("keep going") ||
          messageContent.includes("keep working") ||
          messageContent.includes("finish") ||
          messageContent.includes("complete") ||
          messageContent.match(/^(go on|carry on|proceed|resume)$/i) !== null;

        // Use complex model for:
        // 1. First build (always)
        // 2. Complex or advanced tasks (regardless of build number)
        // 3. User requesting to continue (AI may have stopped)
        const shouldUseComplexModel =
          isFirstUserMessage ||
          complexityAnalysis?.category === "complex" ||
          complexityAnalysis?.category === "advanced" ||
          isContinuationRequest;

        const modelToUse = shouldUseComplexModel
          ? INITIAL_FULL_STACK_DEVELOPER_MODEL
          : FULL_STACK_DEVELOPER_MODEL;

        console.log(`[Chat API] Using model: ${modelToUse}`, {
          isFirstUserMessage,
          complexity: complexityAnalysis?.category || "unknown",
          isContinuationRequest,
          shouldUseComplexModel,
          reason: isFirstUserMessage
            ? "initial build"
            : isContinuationRequest
              ? "user continuation request"
              : shouldUseComplexModel
                ? `${complexityAnalysis?.category} task`
                : `${complexityAnalysis?.category || "simple"} follow-up`,
        });

        // Create the full-stack developer stream
        const fsdStream = streamText({
          model: openrouter(modelToUse, {
            extraBody: {
              usage: {
                include: true,
              },
              // max_tokens: 8000, // Limit full-stack developer response length
            },
          }),
          abortSignal: abortController.signal,
          // Check for cancellation by verifying if the stream is still active
          onChunk: throttle(async () => {
            try {
              const project = await prisma.project.findFirst({
                where: { id: projectId },
                select: { activeStreamId: true },
              });

              // If activeStreamId is null or doesn't match current stream, user cancelled
              if (
                !project?.activeStreamId ||
                project.activeStreamId !== streamId
              ) {
                console.log("[Chat API] Stream cancelled by user, aborting");
                abortController.abort();
              }
            } catch (error) {
              console.error("[Chat API] Error checking stream status:", error);
            }
          }, 1000),
          onAbort: () => {
            console.log("[Chat API] Stream aborted for project:", projectId);
            // Clean up active stream ID on abort
            prisma.project
              .update({
                where: { id: projectId },
                data: {
                  activeStreamId: null,
                  buildStatus: "IDLE",
                  buildStatusUpdatedAt: new Date(),
                },
              })
              .catch((err) =>
                console.error(
                  "[Chat API] Failed to clear activeStreamId on abort:",
                  err,
                ),
              );
          },
          messages: [...convertToModelMessages(prunedMessages)],
          stopWhen: stepCountIs(MAX_STEPS),
          tools: tools(toolsContext),
          experimental_telemetry: {
            isEnabled: true,
          },
          // Sandbox is now manually initialized above, so we don't need getOrCreateSandbox in activeTools
          prepareStep: async ({ stepNumber }) => {
            const maxSteps = MAX_STEPS;
            const currentStep = stepNumber + 1; // stepNumber is 0-indexed
            const stepsRemaining = maxSteps - currentStep;

            console.log("[Chat API] Steps", {
              stepNumber,
              currentStep,
              maxSteps,
              stepsRemaining,
            });

            // Escalating urgency messages
            let urgencyMessage = "";
            if (stepsRemaining <= 2) {
              urgencyMessage =
                "🚨 CRITICAL ALERT: FINAL STEPS! You MUST save fragment files and finalize NOW! No more exploration or testing - complete immediately!";
            } else if (stepsRemaining <= 5) {
              urgencyMessage =
                "⚠️ URGENT WARNING: Approaching step limit! Prioritize saving fragment files and ensuring there are now errors. Focus only on completion!";
            } else if (stepsRemaining <= 10) {
              urgencyMessage =
                "⏰ NOTICE: Over halfway through your step budget. Start planning to wrap up soon.";
            }

            // Get the static base prompt
            const basePrompt = getFullStackPrompt();

            const defaultObjectToReturn = {
              system: `${basePrompt}

              PROJECT CONTEXT:
              You are working on the project: "${projectName}"

              STEP BUDGET: Step ${currentStep} of ${maxSteps} (${stepsRemaining} steps remaining)
              ${urgencyMessage}`,
            };

            if (currentStep > 3) {
              if (currentStep === 4) console.log("CHANGING TOOLS");
              // array of the keys of tools
              return {
                ...defaultObjectToReturn,
                activeTools: toolNames,
              };
            } else {
              return defaultObjectToReturn;
            }
          },
          onStepFinish: async ({ toolCalls, toolResults, usage }) => {
            // Log tool execution start
            if (toolCalls && toolCalls.length > 0) {
              toolCalls.forEach((toolCall, index) => {
                console.log(
                  `[Tool Start] ${toolCall.toolName} - Call ID: ${toolCall.toolCallId}`,
                  {
                    index,
                  },
                );
              });
            }

            // Log tool execution results
            if (toolResults && toolResults.length > 0) {
              toolResults.forEach((toolResult, index) => {
                console.log(
                  `[Tool Finish] ${toolResult.toolName} - Call ID: ${toolResult.toolCallId}`,
                  {
                    index,
                  },
                );
              });
            }
          },
          onError: async (error) => {
            // Track full-stack developer error after response
            after(async () => {
              try {
                await postHog.captureAIGeneration({
                  distinct_id: session.user.id,
                  $ai_trace_id: streamId,
                  $ai_span_id: `full-stack-developer-error-${Date.now()}`,
                  $ai_span_name: "full_stack_developer",
                  $ai_model: modelToUse,
                  $ai_provider: "openrouter",
                  $ai_input: [...convertToModelMessages(prunedMessages)],
                  $ai_input_tokens: 0,
                  $ai_output_choices: [],
                  $ai_output_tokens: 0,
                  $ai_is_error: true,
                  $ai_error:
                    error instanceof Error ? error.message : String(error),
                  // Custom properties
                  projectId,
                  feature: "full-stack-developer",
                  userRole: session.user.role || "USER",
                  conversationId: streamId,
                  shouldUseComplexModel,
                  taskComplexity: complexityAnalysis?.category || "unknown",
                  ...getEnvironmentProperties(),
                });
              } catch (trackingError) {
                console.error(
                  "[PostHog] Failed to track full-stack developer error:",
                  trackingError,
                );
              }
            });
            console.error("[Chat API] Full stack developer error", error);
          },
          onFinish: async ({
            response,
            usage,
            providerMetadata,
            finishReason,
          }) => {
            // Extract the actual model used from OpenRouter response
            const actualModel = response.modelId;

            // Set timing end immediately
            timings.fullStackDev.end = Date.now();

            console.log(
              "[Chat API] Full stack developer finish reason",
              finishReason,
            );
            console.log("[Chat API] Full stack developer response:");
            console.log(response);
            // console.dir(response, { depth: null });

            console.log("[Chat API] Full stack developer provider metadata:");
            console.log(providerMetadata);
            // console.dir(providerMetadata, { depth: null });

            console.log("[Chat API] Full stack developer usage", usage);
            console.log(
              "[Chat API] Full stack developer actual model used:",
              actualModel,
            );

            // Log consolidated timing summary
            const totalSessionTime = Date.now() - timings.sessionStart;
            console.log(
              "═══════════════════════════════════════════════════════════",
            );
            console.log("[TIMING SUMMARY] Complete Session Breakdown");
            console.log(
              "═══════════════════════════════════════════════════════════",
            );
            console.log({
              "Total Session Time": {
                ms: totalSessionTime,
                seconds: (totalSessionTime / 1000).toFixed(2),
              },
              "1. Prompt Complexity Analysis": {
                ms:
                  timings.complexityAnalysis.end -
                    timings.complexityAnalysis.start || 0,
                seconds: (
                  (timings.complexityAnalysis.end -
                    timings.complexityAnalysis.start) /
                  1000
                ).toFixed(2),
                executed: timings.complexityAnalysis.start > 0,
              },
              "2. Credit Deduction": {
                ms:
                  timings.creditDeduction.end - timings.creditDeduction.start ||
                  0,
                seconds: (
                  (timings.creditDeduction.end -
                    timings.creditDeduction.start) /
                  1000
                ).toFixed(2),
                executed: timings.creditDeduction.start > 0,
              },
              "3. Fragment Creation": {
                ms:
                  timings.fragmentCreation.end -
                    timings.fragmentCreation.start || 0,
                seconds: (
                  (timings.fragmentCreation.end -
                    timings.fragmentCreation.start) /
                  1000
                ).toFixed(2),
                executed: timings.fragmentCreation.start > 0,
              },
              "4. Sandbox Setup": {
                ms: timings.sandboxSetup.end - timings.sandboxSetup.start || 0,
                seconds: (
                  (timings.sandboxSetup.end - timings.sandboxSetup.start) /
                  1000
                ).toFixed(2),
                executed: timings.sandboxSetup.start > 0,
              },
              "4a. Sandbox Creation (if new)": {
                ms:
                  timings.sandboxCreation.end - timings.sandboxCreation.start ||
                  0,
                seconds: (
                  (timings.sandboxCreation.end -
                    timings.sandboxCreation.start) /
                  1000
                ).toFixed(2),
                executed: timings.sandboxCreation.start > 0,
              },
              "5. Analysis Message (Context Analyzer)": {
                ms:
                  timings.contextAnalyzer.end - timings.contextAnalyzer.start ||
                  0,
                seconds: (
                  (timings.contextAnalyzer.end -
                    timings.contextAnalyzer.start) /
                  1000
                ).toFixed(2),
                executed: timings.contextAnalyzer.start > 0,
              },
              "6. Full Stack Development": {
                ms: timings.fullStackDev.end - timings.fullStackDev.start || 0,
                seconds: (
                  (timings.fullStackDev.end - timings.fullStackDev.start) /
                  1000
                ).toFixed(2),
                executed: timings.fullStackDev.start > 0,
              },
            });
            console.log(
              "═══════════════════════════════════════════════════════════",
            );

            // Track generation with PostHog after response
            after(async () => {
              try {
                const fsdLatency = (Date.now() - fsdStartTime) / 1000;

                await postHog.captureAIGeneration({
                  distinct_id: session.user.id,
                  $ai_trace_id: streamId,
                  $ai_span_id: `full-stack-dev-${Date.now()}`,
                  $ai_span_name: "full_stack_development",
                  $ai_model: actualModel,
                  $ai_provider:
                    (providerMetadata as any)?.openrouter?.provider ||
                    "openrouter",
                  $ai_input: convertToModelMessages(prunedMessages),
                  $ai_input_tokens: usage?.inputTokens || 0,
                  $ai_output_choices: response.messages || [],
                  $ai_output_tokens: usage?.outputTokens || 0,
                  $ai_total_cost_usd:
                    (providerMetadata as any)?.openrouter?.usage?.cost || 0,
                  $ai_latency: fsdLatency,
                  $ai_http_status: 200,
                  $ai_base_url: "https://openrouter.ai/api/v1",
                  $ai_request_url:
                    "https://openrouter.ai/api/v1/chat/completions",
                  $ai_is_error: false,
                  $ai_temperature: 0.7,
                  $ai_max_tokens: 6000,
                  // Custom properties
                  projectId,
                  feature: "full-stack-development",
                  userRole: session.user.role || "USER",
                  conversationId: streamId,
                  isFirstUserMessage,
                  modelToUse,
                  shouldUseComplexModel,
                  taskComplexity: complexityAnalysis?.category || "unknown",
                  openRouterGenerationId: response.id,
                  ...getEnvironmentProperties(),
                });
              } catch (error) {
                console.error(
                  "[PostHog] Failed to track full-stack generation:",
                  error,
                );
              }
            });
          },
          // experimental_transform: smoothStream(),
        });

        fsdStream.consumeStream();
        writer.merge(
          fsdStream.toUIMessageStream({
            sendStart: false,
            sendReasoning: true,
          }),
        );

        await fsdStream.response;
      },
      onError: (error) => {
        // Error messages are masked by default for security reasons.
        // If you want to expose the error message to the client, you can do so here:
        console.error("[Chat API] UI stream error:", error);
        return error instanceof Error ? error.message : String(error);
      },
      originalMessages: [], // Will be loaded inside the stream
      onFinish: async ({ responseMessage, messages }) => {
        console.log("[Chat API] Messages count", messages.length);

        // Calculate total session time
        const totalSessionTime = Date.now() - sessionStartTime;

        // Timing summary will be logged inside the stream where timings are available

        try {
          // Update message in database
          await upsertMessage(responseMessage, projectId);

          // Save conversation to mem0 for better context memory in advisor chat
          // This happens in the background - don't block the response
          // Note: We'll skip mem0 saving here since contextManager is not available in this scope
          // The mem0 saving can be handled inside the stream where contextManager is available

          // Mark stream as completed
          await prisma.project.update({
            where: { id: projectId },
            data: {
              activeStreamId: null,
              buildStatus: "READY",
              buildStatusUpdatedAt: new Date(),
            },
          });

          // Track trace completion with PostHog after response
          after(async () => {
            try {
              await postHog.captureAITrace({
                distinct_id: session.user.id,
                $ai_trace_id: streamId,
                $ai_span_name: "chat_session",
                $ai_input_state: { message, projectId },
                $ai_output_state: {
                  messages: messages.length,
                  completed: true,
                },
                $ai_latency: (Date.now() - sessionStartTime) / 1000,
                projectId,
                userRole: session.user.role || "USER",
                ...getEnvironmentProperties(),
              });
            } catch (error) {
              console.error(
                "[PostHog] Failed to track trace completion:",
                error,
              );
            }
          });
        } catch (error) {
          console.error("[Chat API] Failed to upsert message", error);

          // Mark stream as error
          try {
            await prisma.project.update({
              where: { id: projectId },
              data: {
                activeStreamId: null,
                buildStatus: "ERROR",
                buildStatusUpdatedAt: new Date(),
                buildError: error instanceof Error ? error.message : String(error),
              },
            });
          } catch (updateError) {
            console.error(
              "[Chat API] Failed to update project status",
              updateError,
            );
          }

          // Track trace error with PostHog after response
          after(async () => {
            try {
              await postHog.captureAITrace({
                distinct_id: session.user.id,
                $ai_trace_id: streamId,
                $ai_span_name: "chat_session",
                $ai_input_state: { message, projectId },
                $ai_output_state: null,
                $ai_latency: (Date.now() - sessionStartTime) / 1000,
                $ai_is_error: true,
                $ai_error:
                  error instanceof Error ? error.message : String(error),
                projectId,
                userRole: session.user.role || "USER",
                ...getEnvironmentProperties(),
              });
            } catch (phError) {
              console.error("[PostHog] Failed to track trace error:", phError);
            }
          });
        }
      },
    });

    const response = createUIMessageStreamResponse({
      stream,
      headers: corsHeaders,
      async consumeSseStream({ stream }) {
        // Check if Redis is available for resumable streams
        const redisAvailable = !!process.env.REDIS_URL;
        if (!redisAvailable) {
          console.log(
            "[Chat API] Redis not available - stream resumption disabled",
          );
          return;
        }

        // send the sse stream into a resumable stream sink as well:
        const streamContext = createResumableStreamContext({
          waitUntil: after,
        });
        await streamContext.createNewResumableStream(streamId, () => stream);
      },
    });

    // Manual capture doesn't require flushing - events are sent immediately
    return response;
  } catch (error) {
    // Manual capture doesn't require cleanup on error
    console.error("Chat API Error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: "Failed to process chat request",
      },
      { status: 500, headers: corsHeaders },
    );
  }
}

// Export the handler directly (PostHog tracking is now built-in)
export const POST = handler;
