/**
 * Shipper Cloud Human-in-the-Loop (HITL) Processing
 *
 * Handles the confirmation flow for deploying to Shipper Cloud (Convex).
 * When the AI calls deployToShipperCloud, it doesn't have an execute function,
 * so the frontend shows a confirmation dialog. The user's response is sent back
 * via addToolOutput() and processed here.
 *
 * @see https://ai-sdk.dev/cookbook/next/human-in-the-loop
 */

import type { UIMessage, UIMessageStreamWriter } from "ai";
import { isToolUIPart, getToolName } from "ai";
import { prisma } from "@shipper/database";
import {
  ShipperCloudDeploymentService,
  ConvexDeploymentAPI,
  decryptDeployKey,
  encryptDeployKey,
  type ProvisionResult,
  // Better Auth template generators for file creation
  generateBetterAuthSecret,
  generateConvexConfigTs,
  generateAuthConfigTs,
  generateAuthTs,
  generateHttpTs,
  generateAuthClientTs,
  generateBasicSchemaTs,
  generateConvexTsConfig,
  getRequiredPackages,
  // Local Install generators (for admin plugin support)
  generateBetterAuthComponentConfig,
  generateBetterAuthStaticExport,
  generateBetterAuthAdapter,
  generateBetterAuthSchema, // Manual schema (CLI doesn't work in Convex context)
} from "@shipper/convex";
import {
  getSandbox,
  executeCommand,
  writeFile as modalWriteFile,
  startDevServer as modalStartDevServer,
} from "./modal-sandbox-manager.js";
import { createProjectLogger, logger as rootLogger } from "../config/logger.js";

/**
 * Grant $1 welcome bonus Cloud credits on first Shipper Cloud deployment.
 * Calls the billing service API to grant the bonus.
 *
 * NOTE: Currently unused - will be enabled when AI feature is ready.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function grantFirstDeploymentBonus(
  userId: string,
  projectId: string,
): Promise<{
  success: boolean;
  granted?: boolean;
  credits?: number;
  error?: string;
}> {
  const billingServiceUrl =
    process.env.BILLING_SERVICE_URL ||
    process.env.BILLING_WEBHOOK_URL?.replace("/webhook/convex", "");

  if (!billingServiceUrl) {
    rootLogger.warn(
      { userId, projectId },
      "BILLING_SERVICE_URL not configured - skipping welcome bonus",
    );
    return { success: true, granted: false };
  }

  const billingApiKey =
    process.env.BILLING_API_KEY || process.env.SHIPPER_API_KEY;
  if (!billingApiKey) {
    rootLogger.warn(
      { userId, projectId },
      "BILLING_API_KEY not configured - skipping welcome bonus",
    );
    return { success: true, granted: false };
  }

  try {
    const response = await fetch(
      `${billingServiceUrl}/credits/${userId}/first-deployment-bonus`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": billingApiKey,
        },
        body: JSON.stringify({ projectId }),
      },
    );

    const result = (await response.json()) as {
      success: boolean;
      error?: string;
      data?: { granted?: boolean; credits?: number; message?: string };
    };

    if (!response.ok || !result.success) {
      rootLogger.error(
        { userId, projectId, error: result.error, status: response.status },
        "Failed to grant welcome bonus",
      );
      return { success: false, error: result.error || "Failed to grant bonus" };
    }

    return {
      success: true,
      granted: result.data?.granted ?? false,
      credits: result.data?.credits,
    };
  } catch (error) {
    rootLogger.error(
      {
        userId,
        projectId,
        error: error instanceof Error ? error.message : String(error),
      },
      "Error calling billing service to grant welcome bonus",
    );
    // Don't fail deployment for bonus issues
    return { success: true, granted: false };
  }
}

/**
 * Add Convex metered prices to a user's subscription when Shipper Cloud is activated.
 * This enables usage-based billing for Convex resources.
 */
async function addConvexMeteredPricesToUserSubscription(
  userId: string,
  projectId: string,
): Promise<{ success: boolean; error?: string }> {
  const billingServiceUrl =
    process.env.BILLING_SERVICE_URL ||
    process.env.BILLING_WEBHOOK_URL?.replace("/webhook/convex", "");

  if (!billingServiceUrl) {
    rootLogger.warn(
      { userId, projectId },
      "BILLING_SERVICE_URL not configured - skipping metered price setup",
    );
    return { success: true }; // Don't fail deployment, just skip
  }

  const billingApiKey =
    process.env.BILLING_API_KEY || process.env.SHIPPER_API_KEY;
  if (!billingApiKey) {
    rootLogger.warn(
      { userId, projectId },
      "BILLING_API_KEY not configured - skipping metered price setup",
    );
    return { success: true }; // Don't fail deployment, just skip
  }

  try {
    const response = await fetch(
      `${billingServiceUrl}/users/${userId}/add-convex-metered-prices`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": billingApiKey,
        },
      },
    );

    const result = (await response.json()) as {
      success: boolean;
      error?: string;
      data?: { addedPrices?: number; skippedPrices?: number };
    };

    if (!response.ok || !result.success) {
      rootLogger.error(
        { userId, projectId, error: result.error, status: response.status },
        "Failed to add Convex metered prices to user subscription",
      );
      return {
        success: false,
        error: result.error || "Failed to add metered prices",
      };
    }

    rootLogger.info(
      {
        userId,
        projectId,
        addedPrices: result.data?.addedPrices,
        skippedPrices: result.data?.skippedPrices,
      },
      "Added Convex metered prices to user subscription",
    );

    return { success: true };
  } catch (error) {
    rootLogger.error(
      {
        userId,
        projectId,
        error: error instanceof Error ? error.message : String(error),
      },
      "Error calling billing service to add metered prices",
    );
    // Don't fail deployment for billing setup issues
    return { success: true };
  }
}

// Approval constants shared with frontend
export const SHIPPER_CLOUD_APPROVAL = {
  YES: "Yes, deploy to Shipper Cloud",
  NO: "No, cancel deployment",
} as const;

// Tool name constant
export const SHIPPER_CLOUD_TOOL_NAME = "deployToShipperCloud";

interface ShipperCloudToolInput {
  projectName: string;
  reason: string;
}

// Tool part type that extends the AI SDK's format
// Handles both AI SDK v5 format (args) and our format (input)
interface ToolPart {
  type: string;
  toolCallId?: string;
  toolInvocationId?: string; // Legacy format
  state: string;
  input?: ShipperCloudToolInput;
  args?: ShipperCloudToolInput; // AI SDK v5 format
  output?: string;
}

/**
 * Deployment result type that extends ProvisionResult with isExisting flag
 */
export interface DeploymentResult {
  success: boolean;
  deploymentUrl?: string;
  deploymentName?: string;
  error?: string;
  isExisting?: boolean;
  /** True if setup was interrupted and needs to be re-run (files, packages, env vars) */
  needsSetup?: boolean;
  /** True if existing deployment needs admin API key migration (auth templates update + API key creation) */
  needsAdminApiKey?: boolean;
  deployment?: ProvisionResult["deployment"];
}

/**
 * Process Shipper Cloud deployment confirmations from tool invocations.
 *
 * This function checks the last message for deployToShipperCloud tool invocations
 * that have received a user response (YES/NO). If confirmed, it triggers the actual
 * Convex deployment and updates the tool result.
 *
 * @param messages - The conversation messages
 * @param writer - The UIMessageStream writer for sending results back to client
 * @param projectId - The Shipper project ID
 * @param userId - The user ID
 * @returns The processed messages with updated tool results
 */
export async function processShipperCloudConfirmation(
  messages: UIMessage[],
  _writer: UIMessageStreamWriter,
  projectId: string,
  userId: string,
): Promise<{
  messages: UIMessage[];
  wasProcessed: boolean;
  resultMessage?: string;
}> {
  const logger = createProjectLogger(projectId, {
    service: "ShipperCloudHITL",
  });

  if (messages.length === 0) {
    return { messages, wasProcessed: false };
  }

  const lastMessage = messages[messages.length - 1];
  const parts = lastMessage.parts;

  if (!parts || !Array.isArray(parts)) {
    return { messages, wasProcessed: false };
  }

  let wasProcessed = false;
  let resultMessage: string | undefined;

  // Following AI SDK HITL pattern - process the last message's parts
  // See: https://ai-sdk.dev/cookbook/next/human-in-the-loop
  //
  // NOTE: AI SDK v5 uses type-specific tool parts (tool-{toolName}) instead of generic "tool-invocation"
  // We need to handle both formats for compatibility
  const processedParts = await Promise.all(
    parts.map(async (part) => {
      // Check for tool parts - handle both formats:
      // 1. AI SDK v5: type: "tool-deployToShipperCloud" (type-specific)
      // 2. Legacy: type: "tool-invocation" with toolName property
      const partType = (part as { type?: string }).type || "";
      const isToolPart = isToolUIPart(part) || partType.startsWith("tool-");

      if (!isToolPart) {
        return part;
      }

      // Get tool name - handle both formats
      // AI SDK v5 format: type: "tool-deployToShipperCloud" → extract "deployToShipperCloud"
      // Legacy format: type: "tool-invocation" with toolName property
      let toolName: string;
      if (partType.startsWith("tool-") && partType !== "tool-invocation") {
        // AI SDK v5 format: extract from type
        toolName = partType.replace("tool-", "");
      } else if (isToolUIPart(part)) {
        // Legacy format: use getToolName helper (only safe to call on verified tool parts)
        toolName = getToolName(part);
      } else {
        // Fallback: try to get toolName from the part directly
        toolName = (part as { toolName?: string }).toolName || "";
      }

      // Cast to our tool part type to access properties
      const toolPart = part as unknown as ToolPart;

      // Debug: Log tool info
      logger.debug({ toolName, state: toolPart.state, partType }, "Found tool");

      // Only process deployToShipperCloud tool
      if (toolName !== SHIPPER_CLOUD_TOOL_NAME) {
        return part;
      }

      // Check for states that indicate the tool has a result/output
      // - "output-available" - our UI state name
      // - "result" - AI SDK state after addToolResult
      // - Also check output value since state names can vary across SDK versions
      const hasResult =
        toolPart.state === "output-available" ||
        toolPart.state === "result" ||
        (toolPart.output && typeof toolPart.output === "string");

      if (!hasResult) {
        logger.debug({ state: toolPart.state }, "Tool has no result yet");
        return part;
      }

      // Get input from either 'input' or 'args' (AI SDK v5 uses 'args')
      const toolInput = toolPart.input || toolPart.args;
      const toolCallIdResolved =
        toolPart.toolCallId || toolPart.toolInvocationId;

      // Debug: Log processing details
      logger.debug(
        {
          output: toolPart.output?.substring?.(0, 50),
          hasInput: !!toolInput,
          toolCallId: toolCallIdResolved,
          inputSource: toolPart.input
            ? "input"
            : toolPart.args
              ? "args"
              : "none",
        },
        "deployToShipperCloud output-available",
      );

      // Skip if no input (shouldn't happen)
      if (!toolInput) {
        logger.debug("No input found, skipping");
        return part;
      }

      // Check the output value (set by frontend via addToolOutput)
      // Skip if output is not one of our approval values (could be already processed)
      if (
        toolPart.output !== SHIPPER_CLOUD_APPROVAL.YES &&
        toolPart.output !== SHIPPER_CLOUD_APPROVAL.NO
      ) {
        // This is likely a previously processed confirmation with deployment result
        logger.debug(
          { output: toolPart.output?.substring?.(0, 30) },
          "Output is not approval value, skipping",
        );
        return part;
      }

      let result: string;

      if (toolPart.output === SHIPPER_CLOUD_APPROVAL.YES) {
        // User confirmed - execute the FULL deployment with file creation
        logger.info(
          { projectName: toolInput.projectName },
          "User confirmed deployment",
        );

        try {
          const deploymentResult = await executeShipperCloudDeploymentWithFiles(
            projectId,
            userId,
            toolInput.projectName,
          );

          result = formatDeploymentSuccess(deploymentResult);
          resultMessage = result;
          wasProcessed = true;
        } catch (error) {
          logger.error({ error }, "Deployment failed");
          result = formatDeploymentError(error);
          resultMessage = result;
          wasProcessed = true;
        }
      } else if (toolPart.output === SHIPPER_CLOUD_APPROVAL.NO) {
        // User declined
        logger.info(
          { projectName: toolInput.projectName },
          "User declined deployment",
        );
        result = "Error: User denied access to Shipper Cloud deployment";
        resultMessage = result;
        wasProcessed = true;
      } else {
        // Unrecognized response - return original part
        return part;
      }

      // Return updated part with the actual result
      // Note: Tool parts are filtered out before sending to AI, but the result is saved to DB
      // and injected as a synthetic user message in chat.ts
      return {
        ...part,
        state: "result",
        output: result,
      };
    }),
  );

  // Return processed messages - cast to avoid type issues with generics
  const processedMessages = [
    ...messages.slice(0, -1),
    { ...lastMessage, parts: processedParts },
  ] as UIMessage[];

  // If we processed a confirmation, persist the updated message to the database
  // This ensures subsequent requests see the deployment result, not just the user's "Yes" response
  if (wasProcessed && lastMessage.id) {
    try {
      await prisma.v2Message.update({
        where: { id: lastMessage.id },
        data: {
          content: JSON.stringify(processedParts),
        },
      });
      logger.info(
        { messageId: lastMessage.id },
        "Updated message with deployment result",
      );
    } catch (error) {
      logger.error(
        { error },
        "Failed to persist deployment result to database",
      );
      // Don't throw - the in-memory update is still valid for this request
    }
  }

  return { messages: processedMessages, wasProcessed, resultMessage };
}

/**
 * Extended deployment result with file creation information
 */
export interface FullDeploymentResult extends DeploymentResult {
  siteUrl?: string;
  filesCreated?: string[];
  packagesInstalled?: boolean;
  packagesInstalledList?: string[];
  convexDeployed?: boolean;
  envVarsSet?: boolean;
  authClientPath?: string;
}

/**
 * Execute the full Shipper Cloud deployment including file creation
 * This is the main entry point called by HITL processing after user confirms
 */
export async function executeShipperCloudDeploymentWithFiles(
  projectId: string,
  userId: string,
  projectName: string,
): Promise<FullDeploymentResult> {
  const logger = createProjectLogger(projectId, {
    service: "ShipperCloudHITL",
  });
  logger.info({ projectName }, "Starting full deployment");

  // First, provision the Convex backend
  const baseResult = await executeShipperCloudDeployment(
    projectId,
    userId,
    projectName,
  );

  if (!baseResult.success) {
    return baseResult;
  }

  // If existing deployment with setup already complete, skip setup steps
  // Note: Admin API key migration happens in deployConvex tool if needed
  if (baseResult.isExisting && !baseResult.needsSetup) {
    logger.info(
      "Existing deployment with setup complete - skipping setup steps",
    );
    const deploymentUrl = baseResult.deploymentUrl!;
    const siteUrl = deploymentUrl.replace(".convex.cloud", ".convex.site");
    return {
      success: true,
      deploymentUrl,
      deploymentName: baseResult.deploymentName!,
      siteUrl,
      isExisting: true,
      filesCreated: [],
      packagesInstalled: true,
      packagesInstalledList: [],
      convexDeployed: true,
      envVarsSet: true,
      authClientPath: "src/lib/auth-client.ts",
    };
  }

  // Get sandbox for file setup
  const sandboxInfo = await getSandbox(projectId);
  if (!sandboxInfo) {
    return {
      ...baseResult,
      success: false,
      error:
        "No active sandbox found. Please ensure the project has a running sandbox.",
    };
  }

  const deploymentUrl = baseResult.deploymentUrl!;
  const deploymentName = baseResult.deploymentName!;
  const siteUrl = deploymentUrl.replace(".convex.cloud", ".convex.site");

  // Create convex/ directory and Better Auth boilerplate files
  // Using LOCAL INSTALL pattern for admin plugin support
  // @see https://convex-better-auth.netlify.app/features/local-install
  //
  // All files are created upfront including the schema (manually generated).
  // We don't use the CLI because it requires a database adapter that only
  // works at Convex runtime.
  const filesToCreate: Array<{ path: string; content: string }> = [
    // Main convex files
    { path: "convex/convex.config.ts", content: generateConvexConfigTs() },
    { path: "convex/auth.config.ts", content: generateAuthConfigTs() },
    { path: "convex/auth.ts", content: generateAuthTs() }, // Uses local schema
    { path: "convex/http.ts", content: generateHttpTs() },
    { path: "convex/schema.ts", content: generateBasicSchemaTs() },
    { path: "convex/tsconfig.json", content: generateConvexTsConfig() },
    // Local install files for admin plugin
    {
      path: "convex/betterAuth/convex.config.ts",
      content: generateBetterAuthComponentConfig(),
    },
    {
      path: "convex/betterAuth/auth.ts",
      content: generateBetterAuthStaticExport(),
    },
    {
      path: "convex/betterAuth/schema.ts",
      content: generateBetterAuthSchema(),
    }, // Manual schema
    {
      path: "convex/betterAuth/adapter.ts",
      content: generateBetterAuthAdapter(),
    },
    // Client-side auth
    { path: "src/lib/auth-client.ts", content: generateAuthClientTs() },
  ];

  // Ensure directories exist (including betterAuth subdirectory)
  await executeCommand(
    sandboxInfo.sandboxId,
    "mkdir -p convex/betterAuth src/lib",
  );

  // Write initial files (before schema generation)
  const writeResults: string[] = [];
  for (const file of filesToCreate) {
    try {
      await modalWriteFile(sandboxInfo.sandboxId, file.path, file.content);
      writeResults.push(`✓ Created ${file.path}`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      writeResults.push(`✗ Failed to create ${file.path}: ${errMsg}`);
    }
  }

  // Install Convex and Convex Auth packages
  const packages = getRequiredPackages();
  const installCmd = `bun add convex@1.30.0 ${packages.join(" ")}`;

  logger.info({ installCmd }, "Installing packages");

  const installResult = await executeCommand(
    sandboxInfo.sandboxId,
    installCmd,
    {
      timeoutMs: 120000, // 2 minute timeout
    },
  );
  const installSuccess = installResult.exitCode === 0;

  // IMPORTANT: Set up Better Auth environment variables BEFORE deploying
  // auth.ts uses process.env.SITE_URL and process.env.BETTER_AUTH_SECRET at runtime
  // These must be set on the Convex deployment before the code can work properly
  let envVarsSet = false;
  try {
    // Generate a secure secret for Better Auth
    const betterAuthSecret = generateBetterAuthSecret();
    logger.info("Generated secret for Better Auth");

    // Get the deploy key to authenticate with Convex API
    // Use baseResult.deployment if available (new deployment), otherwise fetch from DB
    let deployKeyEncrypted: string;
    let convexDeploymentUrl: string;

    if (baseResult.deployment?.deployKeyEncrypted) {
      deployKeyEncrypted = baseResult.deployment.deployKeyEncrypted;
      convexDeploymentUrl = baseResult.deployment.convexDeploymentUrl;
    } else {
      const existingDeployment = await prisma.convexDeployment.findUnique({
        where: { projectId },
        select: { deployKeyEncrypted: true, convexDeploymentUrl: true },
      });

      if (!existingDeployment) {
        logger.error("No deployment found - cannot set environment variables");
        throw new Error("Deployment not found");
      }
      deployKeyEncrypted = existingDeployment.deployKeyEncrypted;
      convexDeploymentUrl = existingDeployment.convexDeploymentUrl;
    }

    const deployKey = decryptDeployKey(deployKeyEncrypted);
    const deploymentApi = new ConvexDeploymentAPI(
      convexDeploymentUrl,
      deployKey,
    );

    // Use the Convex API to set environment variables
    // BETTER_AUTH_SECRET - used for encryption and hashing
    // SITE_URL - used by crossDomain plugin for CORS
    const envResult = await deploymentApi.setEnvironmentVariables({
      BETTER_AUTH_SECRET: betterAuthSecret,
      SITE_URL: "http://localhost:5173", // Will be updated when deployed to production
    });

    logger.info(
      {
        success: envResult.success,
        error: envResult.error,
      },
      "Better Auth environment variables set via API",
    );

    envVarsSet = envResult.success;

    if (!envResult.success) {
      logger.error(
        { error: envResult.error },
        "Failed to set Better Auth env vars via API",
      );
    }
  } catch (envError) {
    logger.error({ error: envError }, "Failed to set Better Auth env vars");
  }

  // NOW deploy auth files to Convex (after env vars are set)
  // This ensures the trustedOrigins function can access SITE_URL
  // and BETTER_AUTH_SECRET is available for session handling
  logger.info("Deploying auth files to Convex...");
  let convexDeploySuccess = false;
  try {
    // Clear any existing Convex cache to ensure clean deploy
    await executeCommand(
      sandboxInfo.sandboxId,
      "rm -rf .convex node_modules/.convex convex/_generated",
    );

    // Run convex deploy to push auth.ts, http.ts, etc. to Convex
    // This makes the trustedOrigins CORS configuration active
    const deployResult = await executeCommand(
      sandboxInfo.sandboxId,
      "bunx convex deploy --yes",
      { timeoutMs: 120000 }, // 2 minute timeout
    );

    convexDeploySuccess = deployResult.exitCode === 0;
    if (convexDeploySuccess) {
      logger.info("Convex auth files deployed successfully");
    } else {
      logger.warn(
        {
          stdout: deployResult.stdout?.slice(-500),
          stderr: deployResult.stderr?.slice(-500),
        },
        "Convex deploy had issues - auth may require manual deployment",
      );
    }
  } catch (deployError) {
    logger.warn(
      { error: deployError },
      "Failed to deploy Convex auth files - auth may require manual deployment",
    );
  }

  // Create service admin user and API key for admin operations
  // This is done after convex deploy so Better Auth endpoints are available
  let adminApiKeyEncrypted: string | undefined;
  let adminUserId: string | undefined;

  if (convexDeploySuccess) {
    try {
      // Fetch existing admin credentials from database to avoid creating duplicates
      const existingDeployment = await prisma.convexDeployment.findUnique({
        where: { projectId },
        select: { adminUserId: true, adminApiKeyEncrypted: true },
      });

      const existingAdmin = existingDeployment?.adminApiKeyEncrypted
        ? {
            userId: existingDeployment.adminUserId,
            apiKey: decryptDeployKey(existingDeployment.adminApiKeyEncrypted),
          }
        : undefined;

      logger.info("Creating service admin user and API key...");
      const adminResult = await createServiceAdminAndApiKey(siteUrl, logger, existingAdmin);

      if (adminResult.success && adminResult.apiKey && adminResult.userId) {
        adminApiKeyEncrypted = encryptDeployKey(adminResult.apiKey);
        adminUserId = adminResult.userId;
        logger.info(
          { userId: adminUserId },
          "Service admin and API key created successfully",
        );
      } else {
        logger.warn(
          { error: adminResult.error },
          "Failed to create service admin - admin operations will use mutation fallback",
        );
      }
    } catch (adminError) {
      logger.warn(
        { error: adminError },
        "Error creating service admin - admin operations will use mutation fallback",
      );
    }
  }

  // Restart dev server
  try {
    logger.info("Restarting dev server...");
    await executeCommand(sandboxInfo.sandboxId, "pkill -9 -f vite || true");
    await executeCommand(
      sandboxInfo.sandboxId,
      "rm -rf node_modules/.vite node_modules/.tmp",
    );
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await modalStartDevServer(sandboxInfo.sandboxId, projectId, 5173);
  } catch (restartError) {
    logger.warn({ error: restartError }, "Dev server restart warning");
  }

  // Mark setup as complete in the database and store admin API key
  // This ensures that if the user interrupts deployment mid-way,
  // we know to re-run the setup steps on the next attempt
  try {
    await prisma.convexDeployment.update({
      where: { projectId },
      data: {
        setupComplete: true,
        setupCompletedAt: new Date(),
        // Store admin API key for admin operations (if created)
        ...(adminApiKeyEncrypted && { adminApiKeyEncrypted }),
        ...(adminUserId && { adminUserId }),
      },
    });
    logger.info("Setup marked as complete");
  } catch (updateError) {
    logger.error({ error: updateError }, "Failed to mark setup as complete");
    // Don't fail the deployment if we can't update the flag
    // The setup was successful, we just couldn't record it
  }

  return {
    success: true,
    deploymentUrl,
    deploymentName,
    siteUrl,
    isExisting: baseResult.isExisting,
    filesCreated: writeResults,
    packagesInstalled: installSuccess,
    packagesInstalledList: ["convex@1.30.0", ...packages],
    convexDeployed: convexDeploySuccess,
    envVarsSet,
    authClientPath: "src/lib/auth-client.ts",
  };
}

/**
 * Execute the actual Shipper Cloud (Convex) deployment (base provisioning only)
 * This handles Convex backend provisioning without file creation
 */
export async function executeShipperCloudDeployment(
  projectId: string,
  _userId: string,
  projectName: string,
): Promise<DeploymentResult> {
  const logger = createProjectLogger(projectId, {
    service: "ShipperCloudHITL",
  });

  // Check if project already has a Convex deployment
  const existingDeployment = await prisma.convexDeployment.findUnique({
    where: { projectId },
  });

  if (existingDeployment) {
    // Inject deploy key and URL into sandbox for existing deployment
    await injectDeployKeyIntoSandbox(
      projectId,
      existingDeployment.deployKeyEncrypted,
      existingDeployment.convexDeploymentUrl,
    );

    // Check if setup was completed - if not, the deployment was interrupted
    // and we need to re-run setup (files, packages, env vars, convex deploy)
    const needsSetup = !existingDeployment.setupComplete;
    if (needsSetup) {
      logger.info(
        "Existing deployment found but setup incomplete - will re-run setup",
      );
    }

    // Check if admin API key is missing - if so, we need to update auth templates
    // and create the service admin + API key for admin operations
    const needsAdminApiKey = !existingDeployment.adminApiKeyEncrypted;
    if (needsAdminApiKey && !needsSetup) {
      logger.info(
        "Existing deployment missing admin API key - will migrate to new auth templates",
      );
    }

    return {
      success: true,
      deploymentUrl: existingDeployment.convexDeploymentUrl,
      deploymentName: existingDeployment.convexDeploymentName,
      isExisting: true,
      needsSetup,
      needsAdminApiKey,
    };
  }

  // Create new Convex deployment using the service
  const deploymentService = new ShipperCloudDeploymentService();
  const isDev = process.env.NODE_ENV === "development";
  const convexProjectName = isDev ? `dev-${projectName}` : projectName;
  const result = await deploymentService.provisionBackend(
    projectId,
    convexProjectName,
  );

  if (!result.success || !result.deployment) {
    return {
      success: false,
      error: result.error || "Failed to provision Shipper Cloud backend",
    };
  }

  // Configure webhook BEFORE saving to database
  // This ensures we don't have orphaned records if webhook setup fails
  const billingWebhookUrl = process.env.BILLING_WEBHOOK_URL;
  let webhookSecretEncrypted: string | undefined;

  if (billingWebhookUrl) {
    const deployKey = decryptDeployKey(result.deployment.deployKeyEncrypted);
    const deploymentApi = new ConvexDeploymentAPI(
      result.deployment.convexDeploymentUrl,
      deployKey,
    );

    const webhookResult = await deploymentApi.createWebhookLogStream({
      url: billingWebhookUrl,
      format: "json",
    });

    logger.info({ webhookResult }, "Webhook log stream creation result");

    if (!webhookResult.success || !webhookResult.webhookSecret) {
      logger.error(
        { error: webhookResult.error },
        "Failed to configure webhook for usage tracking - rolling back deployment",
      );

      // Rollback: Delete the Convex deployment since we can't track usage
      try {
        await deploymentApi.deleteLogStream("webhook");
      } catch (deleteError) {
        logger.warn(
          { error: deleteError },
          "Failed to cleanup webhook during rollback",
        );
      }

      return {
        success: false,
        error: `Failed to configure usage tracking webhook: ${webhookResult.error || "No webhook secret returned"}. Deployment was not saved.`,
      };
    }

    webhookSecretEncrypted = encryptDeployKey(webhookResult.webhookSecret);
    logger.info("Webhook configured for usage tracking");
  }

  // Save deployment to database only after all setup succeeds
  // This is atomic - either all records are created or none
  await prisma.$transaction([
    prisma.convexDeployment.create({
      data: {
        projectId,
        convexProjectId: String(result.deployment.convexProjectId),
        convexDeploymentName: result.deployment.convexDeploymentName,
        convexDeploymentUrl: result.deployment.convexDeploymentUrl,
        deployKeyEncrypted: result.deployment.deployKeyEncrypted,
        status: "ACTIVE",
        ...(webhookSecretEncrypted && {
          webhookSecretEncrypted,
          webhookConfiguredAt: new Date(),
        }),
      },
    }),
    prisma.project.update({
      where: { id: projectId },
      data: { shipperCloudEnabled: true },
    }),
  ]);

  // Add Convex metered prices to the team owner's subscription for usage-based billing
  // This enables billing for function calls, storage, bandwidth, etc.
  // Also grant the $1 welcome bonus on first deployment
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        teamId: true,
        userId: true, // For user-level projects
        team: {
          select: {
            members: {
              where: { role: "OWNER" },
              select: { userId: true },
              take: 1,
            },
          },
        },
      },
    });

    // Determine the user to credit: team owner or direct project owner
    const userToCredit = project?.team?.members[0]?.userId || project?.userId;

    if (userToCredit) {
      // TODO: Enable when AI feature is ready
      // Grant $1 welcome bonus - reserved for future AI feature activation
      // const bonusResult = await grantFirstDeploymentBonus(userToCredit, projectId);
      // if (bonusResult.success && bonusResult.granted) {
      //   logger.info(
      //     { projectId, userId: userToCredit, credits: bonusResult.credits },
      //     "Granted $1 Cloud credits welcome bonus"
      //   );
      // }

      // Add metered prices for ongoing usage billing
      const billingResult = await addConvexMeteredPricesToUserSubscription(
        userToCredit,
        projectId,
      );
      if (!billingResult.success) {
        logger.warn(
          { projectId, userId: userToCredit, error: billingResult.error },
          "Failed to add metered prices - usage will be tracked but not billed until prices are added",
        );
      }
    } else {
      logger.warn(
        { projectId },
        "No user found for project - skipping billing setup",
      );
    }
  } catch (billingError) {
    // Don't fail deployment for billing issues
    logger.warn(
      {
        projectId,
        error:
          billingError instanceof Error
            ? billingError.message
            : String(billingError),
      },
      "Error during billing setup - deployment succeeded but billing may need manual setup",
    );
  }

  // Inject deploy key and URL into sandbox
  await injectDeployKeyIntoSandbox(
    projectId,
    result.deployment.deployKeyEncrypted,
    result.deployment.convexDeploymentUrl,
  );

  return {
    success: true,
    deploymentUrl: result.deploymentUrl,
    deploymentName: result.deploymentName,
    deployment: result.deployment,
  };
}

/**
 * Inject the Convex deploy key and URL into the sandbox environment
 * This allows the AI to run `bunx convex dev` without exposing the key
 * and provides VITE_CONVEX_URL for the React client
 *
 * Exported for use by Gate 5 validation to auto-fix missing credentials
 */
export type InjectDeployKeyResult = {
  success: boolean;
  message: string;
  error?: string;
};

export async function injectDeployKeyIntoSandbox(
  projectId: string,
  encryptedDeployKey: string,
  deploymentUrl: string,
  options: { throwOnError?: boolean } = {},
): Promise<InjectDeployKeyResult> {
  const { throwOnError = false } = options;
  const logger = createProjectLogger(projectId, {
    service: "ShipperCloudHITL",
  });

  try {
    // Decrypt the deploy key (reads secret from CONVEX_DEPLOY_KEY_ENCRYPTION_SECRET env var)
    const deployKey = decryptDeployKey(encryptedDeployKey);

    // Get the sandbox for this project
    const sandboxInfo = await getSandbox(projectId);

    if (!sandboxInfo) {
      const message = "No sandbox found for project";
      logger.warn(`Cannot inject deploy key: ${message}`);
      if (throwOnError) {
        throw new Error(message);
      }
      return { success: false, message, error: message };
    }

    // Check if sandbox is expired
    if (
      sandboxInfo.sandboxExpiresAt &&
      new Date() > sandboxInfo.sandboxExpiresAt
    ) {
      const message = "Sandbox has expired. Please restart the sandbox first.";
      logger.warn(`Cannot inject deploy key: ${message}`);
      if (throwOnError) {
        throw new Error(message);
      }
      return { success: false, message, error: message };
    }

    // Check if sandbox is in a running state
    if (sandboxInfo.status !== "running") {
      const message = `Sandbox is not running (status: ${sandboxInfo.status}). Please restart the sandbox first.`;
      logger.warn(`Cannot inject deploy key: ${message}`);
      if (throwOnError) {
        throw new Error(message);
      }
      return { success: false, message, error: message };
    }

    // Inject the deploy key and URLs into .env.local (single source of truth for env vars)
    // CONVEX_DEPLOY_KEY - used by convex CLI for deployments
    // VITE_CONVEX_URL - used by ConvexReactClient in the frontend
    // VITE_CONVEX_SITE_URL - used by Convex Auth (derived from deploymentUrl)
    // SITE_URL - used by crossDomain plugin (CORS handled by *.modal.host wildcard in trustedOrigins)
    //
    // First remove any existing Convex-related vars to prevent duplicates,
    // then append fresh values. This is idempotent and preserves user-added vars.
    const siteUrl = deploymentUrl.replace(".convex.cloud", ".convex.site");
    const envCommand = `sh -c '
      touch /workspace/.env.local && \
      grep -v "^CONVEX_DEPLOY_KEY=\\|^VITE_CONVEX_URL=\\|^VITE_CONVEX_SITE_URL=\\|^SITE_URL=" /workspace/.env.local > /workspace/.env.local.tmp 2>/dev/null || true && \
      mv /workspace/.env.local.tmp /workspace/.env.local && \
      echo "CONVEX_DEPLOY_KEY=${deployKey}" >> /workspace/.env.local && \
      echo "VITE_CONVEX_URL=${deploymentUrl}" >> /workspace/.env.local && \
      echo "VITE_CONVEX_SITE_URL=${siteUrl}" >> /workspace/.env.local && \
      echo "SITE_URL=http://localhost:5173" >> /workspace/.env.local
    '`;
    await executeCommand(sandboxInfo.sandboxId, envCommand);

    logger.info("Deploy key and URL injected into sandbox");
    return { success: true, message: "Credentials injected successfully" };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    // Check for specific Modal sandbox errors
    const isSandboxCompleted = errorMsg.includes("has already completed");
    const isSandboxExpired = errorMsg.includes("expired") || isSandboxCompleted;

    const userMessage = isSandboxExpired
      ? "Sandbox is no longer active. Please restart the sandbox first."
      : `Failed to inject credentials: ${errorMsg}`;

    logger.error({ error }, "Failed to inject deploy key");

    if (throwOnError) {
      throw new Error(userMessage);
    }
    return { success: false, message: userMessage, error: errorMsg };
  }
}

/**
 * Format successful deployment result for the AI
 * Returns a JSON string so Anthropic can parse it properly as tool output
 */
export function formatDeploymentSuccess(result: FullDeploymentResult): string {
  // Return JSON format for better AI parsing
  const response = {
    success: true,
    message: result.isExisting
      ? "Shipper Cloud deployment already exists. Better Auth files have been set up."
      : "Successfully provisioned Shipper Cloud backend with Better Auth!",
    deploymentUrl: result.deploymentUrl,
    siteUrl: result.siteUrl,
    deploymentName: result.deploymentName,
    isExisting: result.isExisting,
    filesCreated: result.filesCreated,
    packagesInstalled: result.packagesInstalled,
    packagesInstalledList: result.packagesInstalledList,
    convexDeployed: result.convexDeployed,
    envVarsSet: result.envVarsSet,
    authClientPath: result.authClientPath,
    nextSteps: [
      "⚠️ STOP! Follow this EXACT order:",
      result.convexDeployed
        ? "✅ Base auth already deployed - CORS is configured for Modal URLs"
        : "⚠️ Auth deployment may have failed - run deployConvex if you see CORS errors",
      "1. IMMEDIATELY call scaffoldConvexSchema tool with your table definitions",
      "2. THEN call deployConvex tool to sync your schema and generate types",
      "3. ONLY AFTER deployConvex succeeds: Update src/main.tsx with ConvexBetterAuthProvider (see mainTsxExample below)",
      "4. Create /signin and /signup routes with REAL forms using signInWithEmail/signUpWithEmail from src/lib/auth-client.ts",
      "5. Use the GENERATED function names: api.queries.listTodos, api.mutations.createTodo, etc.",
      "6. Always use todo._id (not todo.id) when calling mutations - _id is typed as Id<'todos'>",
      "7. ⚠️ Update mutations use FLAT args - see mutationExamples below!",
      "8. ⚠️ NEVER redirect from __root.tsx! Only redirect in PROTECTED routes",
      "9. Home page (/) should show content for unauth users, NOT just redirect to signin!",
      "🚨🚨🚨 CRITICAL: NEVER use AuthLoading/Authenticated/Unauthenticated from 'convex/react' - see authComponentWarning below!",
      "🚨🚨🚨 CRITICAL: Auth-required queries THROW 'Unauthenticated' if called without session - use 'skip' pattern! See queryExamples below!",
    ],
    mainTsxExample: `import { ConvexReactClient } from 'convex/react'
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react'
import { authClient } from '@/lib/auth-client'

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL)

// CRITICAL: authClient prop is REQUIRED!
<ConvexBetterAuthProvider client={convex} authClient={authClient}>
  {/* your app */}
</ConvexBetterAuthProvider>`,
    criticalWarning:
      "🚫 DO NOT create React components yet! Call scaffoldConvexSchema THEN deployConvex FIRST!",
    mutationExamples: {
      description:
        "⚠️⚠️⚠️ CRITICAL: Update mutations use FLAT args, NOT nested 'updates' object!",
      correct: [
        "// ✅ CORRECT - flat args at top level:",
        "await updateTodo({ id: todo._id, title: 'New title', completed: true });",
        "await updateTodo({ id: todo._id, completed: !todo.completed });",
        "await deleteTodo({ id: todo._id });",
      ],
      wrong: [
        "// 🚫 WRONG - 'updates' property does not exist:",
        "await updateTodo({ id: todo._id, updates: { title: 'New' } }); // ❌ ERROR!",
        "// 🚫 WRONG - using 'id' instead of '_id':",
        "await updateTodo({ id: todo.id, title: 'New' }); // ❌ 'id' doesn't exist, use '_id'!",
        "// 🚫 WRONG - converting _id to string:",
        "await deleteTodo({ id: String(todo._id) }); // ❌ string is not Id<'todos'>!",
      ],
      note: "The scaffolded updateTodo mutation accepts: { id: Id<'todos'>, title?: string, completed?: boolean, ... } - all fields are FLAT at the args level, not nested in an 'updates' object!",
    },
    queryExamples: {
      title:
        "🚨🚨🚨 CRITICAL: Auth-Required Queries THROW if Called Without Session! 🚨🚨🚨",
      problem:
        "Convex queries that use getAuthUser(ctx) will throw 'Unauthenticated' error if called before the user has a valid session. You MUST use the 'skip' pattern to conditionally skip queries.",
      errorYouWillSee: "Uncaught Error: Unauthenticated at getAuthUser",
      correct: [
        "// ✅ CORRECT - Check session FIRST, then conditionally execute query:",
        "function TodoList() {",
        "  const { data: session, isPending } = useSession();",
        "  // Pass 'skip' as second arg when no session - this prevents the query from running!",
        "  const todos = useQuery(api.queries.listTodos, session ? {} : 'skip');",
        "",
        "  if (isPending) return <LoadingSpinner />;",
        "  if (!session) return <Navigate to='/signin' />;",
        "",
        "  return <div>{todos?.map(todo => <TodoItem key={todo._id} todo={todo} />)}</div>;",
        "}",
      ],
      wrong: [
        "// 🚫 WRONG - Query runs immediately before session check!",
        "function TodoList() {",
        "  const todos = useQuery(api.queries.listTodos);  // ❌ THROWS 'Unauthenticated'!",
        "  const { data: session } = useSession();",
        "  // ...",
        "}",
        "",
        "// 🚫 WRONG - No skip pattern, query runs even when not authenticated!",
        "function TodoList() {",
        "  const { data: session } = useSession();",
        "  const todos = useQuery(api.queries.listTodos);  // ❌ Still runs without session!",
        "  if (!session) return <Navigate to='/signin' />;",
        "  // ...",
        "}",
      ],
      keyRules: [
        "1. ALWAYS call useSession() BEFORE any useQuery that requires auth",
        "2. ALWAYS use the 'skip' pattern: useQuery(api.queries.foo, session ? {} : 'skip')",
        "3. The 'skip' string tells Convex to NOT execute the query at all",
        "4. For queries with args: useQuery(api.queries.foo, session ? { userId: session.user.id } : 'skip')",
        "5. NEVER assume the query will wait for auth - it runs immediately on mount!",
      ],
      fullExample: `// ✅ COMPLETE PATTERN for protected pages with auth-required queries:
import { useSession } from '@/lib/auth-client';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Navigate } from '@tanstack/react-router';

function ProtectedTodoPage() {
  // 1. FIRST: Get session state
  const { data: session, isPending } = useSession();

  // 2. SECOND: Conditionally run queries with 'skip' pattern
  const todos = useQuery(api.queries.listTodos, session ? {} : 'skip');
  const userStats = useQuery(api.queries.getUserStats, session ? {} : 'skip');

  // 3. THIRD: Handle loading state
  if (isPending) {
    return <div>Loading...</div>;
  }

  // 4. FOURTH: Redirect if not authenticated
  if (!session) {
    return <Navigate to="/signin" />;
  }

  // 5. NOW safe to render - queries have valid session
  return (
    <div>
      <h1>Welcome, {session.user.name}</h1>
      {todos?.map(todo => <TodoItem key={todo._id} todo={todo} />)}
    </div>
  );
}`,
    },
    importantReminders: [
      "⚠️ ConvexBetterAuthProvider REQUIRES both client AND authClient props!",
      "Import authClient from src/lib/auth-client.ts and pass it: <ConvexBetterAuthProvider client={convex} authClient={authClient}>",
      "Better Auth client exports: useSession, signIn, signUp, signOut from src/lib/auth-client.ts",
      "Use signInWithEmail(email, password) for typed error handling (returns { success, error })",
      "🚨 Use todo._id for mutations, NOT todo.id (which doesn't exist) - _id is typed as Id<'todos'>",
      "🚨 Update mutations use FLAT args: updateTodo({ id: todo._id, completed: true }) NOT updateTodo({ id, updates: {...} })",
      "Don't create custom Todo interfaces - use Doc<'todos'> from convex/_generated/dataModel",
      "🚨🚨🚨 Auth queries THROW 'Unauthenticated' - ALWAYS use: useQuery(api.queries.foo, session ? {} : 'skip')",
      "🚨 Call useSession() BEFORE useQuery in components - queries run immediately on mount, they don't wait for auth!",
    ],
    // CRITICAL WARNING: convex/react auth components are NOT compatible with Better Auth
    authComponentWarning: {
      title: "🚨🚨🚨 CRITICAL: DO NOT USE convex/react AUTH COMPONENTS! 🚨🚨🚨",
      problem:
        "Shipper Cloud uses Better Auth, NOT Convex Auth. The following components from 'convex/react' require ConvexProviderWithAuth (which we don't use) and WILL CRASH YOUR APP:",
      forbiddenImports: [
        "import { AuthLoading } from 'convex/react'     // ❌ WILL CRASH",
        "import { Authenticated } from 'convex/react'   // ❌ WILL CRASH",
        "import { Unauthenticated } from 'convex/react' // ❌ WILL CRASH",
      ],
      errorYouWillSee:
        "Could not find `ConvexProviderWithAuth` (or `ConvexProviderWithClerk` or `ConvexProviderWithAuth0`) as an ancestor component.",
      correctAlternatives: {
        description:
          "Use Better Auth's useSession hook instead for ALL auth state handling:",
        imports: "import { useSession } from '@/lib/auth-client'",
        usage: [
          "const { data: session, isPending } = useSession();",
          "",
          "// Loading state (replaces AuthLoading):",
          "if (isPending) return <LoadingSpinner />;",
          "",
          "// Authenticated check (replaces Authenticated):",
          "if (session) return <ProtectedContent />;",
          "",
          "// Unauthenticated check (replaces Unauthenticated):",
          "if (!session) return <Navigate to='/signin' />;",
        ],
        fullExample: `// ✅ CORRECT Pattern with Better Auth:
import { useSession } from '@/lib/auth-client';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Navigate } from '@tanstack/react-router';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  // 1. FIRST: Get session state
  const { data: session, isPending } = useSession();

  // 2. SECOND: Conditionally run auth-required queries with 'skip' pattern
  // ⚠️ CRITICAL: Without 'skip', query throws 'Unauthenticated' error!
  const userData = useQuery(api.queries.getUserData, session ? {} : 'skip');

  // 3. Handle loading state
  if (isPending) {
    return <div>Loading...</div>;
  }

  // 4. Redirect if not authenticated
  if (!session) {
    return <Navigate to="/signin" />;
  }

  // 5. NOW safe to render with authenticated data
  return <>{children}</>;
}`,
      },
      recovery: {
        title: "If you see the ConvexProviderWithAuth error:",
        steps: [
          "1. Search your codebase for: AuthLoading, Authenticated, Unauthenticated",
          "2. Remove ALL imports of these from 'convex/react'",
          "3. Replace with useSession from '@/lib/auth-client'",
          "4. Update your components to use session.isPending and session.data",
          "5. Restart your dev server",
        ],
      },
      unauthenticatedRecovery: {
        title: "If you see 'Uncaught Error: Unauthenticated at getAuthUser':",
        problem:
          "A Convex query using getAuthUser is being called before the user is authenticated.",
        steps: [
          "1. Find the component that's calling the failing query",
          "2. Add useSession() BEFORE the useQuery call",
          "3. Add the 'skip' pattern: useQuery(api.queries.foo, session ? {} : 'skip')",
          "4. Ensure the component handles isPending and !session states before rendering",
          "5. The order MUST be: useSession → useQuery with skip → isPending check → !session check → render",
        ],
        example:
          "const { data: session } = useSession();\nconst data = useQuery(api.queries.myQuery, session ? {} : 'skip');",
      },
    },
  };

  return JSON.stringify(response);
}

/**
 * Format deployment error for the AI
 * Returns a JSON string for consistency
 */
export function formatDeploymentError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  const response = {
    success: false,
    error: message,
    message: `Failed to deploy to Shipper Cloud: ${message}`,
    troubleshooting: [
      "Check if the Convex configuration is correct",
      "Verify the convex/ directory contains valid schema and functions",
      "Try again or contact support if the issue persists",
    ],
  };

  return JSON.stringify(response);
}

/**
 * Check if a message contains a pending Shipper Cloud confirmation
 */
export function hasPendingShipperCloudConfirmation(
  messages: UIMessage[],
): boolean {
  if (messages.length === 0) return false;

  const lastMessage = messages[messages.length - 1];
  const parts = lastMessage.parts;

  if (!parts || !Array.isArray(parts)) return false;

  return parts.some((part) => {
    if (!isToolUIPart(part)) return false;
    const toolName = getToolName(part);
    return (
      toolName === SHIPPER_CLOUD_TOOL_NAME && part.state === "input-available"
    );
  });
}

/**
 * Create a service admin user and generate an API key for admin operations.
 *
 * This creates a special "service-admin" user that is used for server-side
 * admin operations like removeUser, without requiring a user session.
 *
 * @param siteUrl - The Convex site URL (*.convex.site)
 * @param logger - Logger instance for this project
 * @returns Object with success status, userId, and apiKey
 */
async function createServiceAdminAndApiKey(
  siteUrl: string,
  logger: ReturnType<typeof createProjectLogger>,
  existingAdmin?: { userId?: string | null; apiKey?: string | null },
): Promise<{
  success: boolean;
  userId?: string;
  apiKey?: string;
  error?: string;
}> {
  // If admin already exists, return existing credentials
  if (existingAdmin?.userId && existingAdmin?.apiKey) {
    logger.info({ userId: existingAdmin.userId }, "Using existing service admin");
    return {
      success: true,
      userId: existingAdmin.userId,
      apiKey: existingAdmin.apiKey,
    };
  }

  const serviceAdminEmail = `service-admin-${Date.now()}@shipper.internal`;
  const serviceAdminPassword = generateBetterAuthSecret();

  try {
    // Step 1: Create the service admin user via Better Auth sign-up
    logger.info("Creating service admin user...");

    const signUpResponse = await fetch(`${siteUrl}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: serviceAdminEmail,
        password: serviceAdminPassword,
        name: "Shipper Service Admin",
      }),
    });

    if (!signUpResponse.ok) {
      const errorData = await signUpResponse.json().catch(() => ({}));
      const errorMessage =
        (errorData as { message?: string }).message ||
        `HTTP ${signUpResponse.status}`;
      return {
        success: false,
        error: `Failed to create service admin: ${errorMessage}`,
      };
    }

    const signUpResult = (await signUpResponse.json()) as {
      user?: { id: string };
      token?: string;
    };
    const userId = signUpResult.user?.id;

    if (!userId) {
      return {
        success: false,
        error: "Sign-up succeeded but no user ID returned",
      };
    }

    logger.info({ userId }, "Service admin user created");

    // Step 2: Sign in to get session token
    const signInResponse = await fetch(`${siteUrl}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: serviceAdminEmail,
        password: serviceAdminPassword,
      }),
    });

    let sessionToken: string | undefined;
    if (signInResponse.ok) {
      const setCookieHeader = signInResponse.headers.get("set-cookie");
      if (setCookieHeader) {
        const tokenMatch = setCookieHeader.match(
          /better-auth\.session_token=([^;]+)/,
        );
        sessionToken = tokenMatch?.[1];
      }
    }

    // Step 3: Create API key for the service admin
    logger.info("Creating API key for service admin...");

    // For server-side API key creation, always pass userId directly
    // Don't rely on session cookies - they don't work in server-to-server calls
    const apiKeyResponse = await fetch(`${siteUrl}/api/auth/api-key/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "shipper-admin-key",
        userId, // Always pass userId for server-side creation
      }),
    });

    if (!apiKeyResponse.ok) {
      const errorData = await apiKeyResponse.json().catch(() => ({}));
      const errorMessage =
        (errorData as { message?: string }).message ||
        `HTTP ${apiKeyResponse.status}`;
      return {
        success: false,
        error: `Failed to create API key: ${errorMessage}`,
        userId,
      };
    }

    const apiKeyResult = (await apiKeyResponse.json()) as {
      key?: string;
      apiKey?: string;
    };
    const apiKey = apiKeyResult.key || apiKeyResult.apiKey;

    if (!apiKey) {
      return {
        success: false,
        error: "API key creation succeeded but no key returned",
        userId,
      };
    }

    logger.info("API key created successfully");

    return { success: true, userId, apiKey };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMsg };
  }
}
