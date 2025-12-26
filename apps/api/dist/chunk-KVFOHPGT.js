import { createRequire } from 'module';const require = createRequire(import.meta.url);
import {
  executeCommand,
  getSandbox,
  startDevServer,
  writeFile
} from "./chunk-IDZAZ4YU.js";
import {
  createProjectLogger,
  logger
} from "./chunk-TIBZDRCE.js";
import {
  prisma
} from "./chunk-YMWDDMLV.js";
import {
  init_esm_shims
} from "./chunk-IXOW5DJO.js";

// src/services/shipper-cloud-hitl.ts
init_esm_shims();
import { isToolUIPart, getToolName } from "ai";
import {
  ShipperCloudDeploymentService,
  ConvexDeploymentAPI,
  decryptDeployKey,
  encryptDeployKey,
  generateBetterAuthSecret,
  generateConvexConfigTs,
  generateAuthConfigTs,
  generateAuthTs,
  generateHttpTs,
  generateAuthClientTs,
  generateBasicSchemaTs,
  generateConvexTsConfig,
  getRequiredPackages,
  generateBetterAuthComponentConfig,
  generateBetterAuthStaticExport,
  generateBetterAuthAdapter,
  generateBetterAuthSchema
} from "@shipper/convex";
async function addConvexMeteredPricesToUserSubscription(userId, projectId) {
  const billingServiceUrl = process.env.BILLING_SERVICE_URL || process.env.BILLING_WEBHOOK_URL?.replace("/webhook/convex", "");
  if (!billingServiceUrl) {
    logger.warn(
      { userId, projectId },
      "BILLING_SERVICE_URL not configured - skipping metered price setup"
    );
    return { success: true };
  }
  const billingApiKey = process.env.BILLING_API_KEY || process.env.SHIPPER_API_KEY;
  if (!billingApiKey) {
    logger.warn(
      { userId, projectId },
      "BILLING_API_KEY not configured - skipping metered price setup"
    );
    return { success: true };
  }
  try {
    const response = await fetch(
      `${billingServiceUrl}/users/${userId}/add-convex-metered-prices`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": billingApiKey
        }
      }
    );
    const result = await response.json();
    if (!response.ok || !result.success) {
      logger.error(
        { userId, projectId, error: result.error, status: response.status },
        "Failed to add Convex metered prices to user subscription"
      );
      return {
        success: false,
        error: result.error || "Failed to add metered prices"
      };
    }
    logger.info(
      {
        userId,
        projectId,
        addedPrices: result.data?.addedPrices,
        skippedPrices: result.data?.skippedPrices
      },
      "Added Convex metered prices to user subscription"
    );
    return { success: true };
  } catch (error) {
    logger.error(
      {
        userId,
        projectId,
        error: error instanceof Error ? error.message : String(error)
      },
      "Error calling billing service to add metered prices"
    );
    return { success: true };
  }
}
var SHIPPER_CLOUD_APPROVAL = {
  YES: "Yes, deploy to Shipper Cloud",
  NO: "No, cancel deployment"
};
var SHIPPER_CLOUD_TOOL_NAME = "deployToShipperCloud";
async function processShipperCloudConfirmation(messages, _writer, projectId, userId) {
  const logger2 = createProjectLogger(projectId, {
    service: "ShipperCloudHITL"
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
  let resultMessage;
  const processedParts = await Promise.all(
    parts.map(async (part) => {
      const partType = part.type || "";
      const isToolPart = isToolUIPart(part) || partType.startsWith("tool-");
      if (!isToolPart) {
        return part;
      }
      let toolName;
      if (partType.startsWith("tool-") && partType !== "tool-invocation") {
        toolName = partType.replace("tool-", "");
      } else if (isToolUIPart(part)) {
        toolName = getToolName(part);
      } else {
        toolName = part.toolName || "";
      }
      const toolPart = part;
      logger2.debug({ toolName, state: toolPart.state, partType }, "Found tool");
      if (toolName !== SHIPPER_CLOUD_TOOL_NAME) {
        return part;
      }
      const hasResult = toolPart.state === "output-available" || toolPart.state === "result" || toolPart.output && typeof toolPart.output === "string";
      if (!hasResult) {
        logger2.debug({ state: toolPart.state }, "Tool has no result yet");
        return part;
      }
      const toolInput = toolPart.input || toolPart.args;
      const toolCallIdResolved = toolPart.toolCallId || toolPart.toolInvocationId;
      logger2.debug(
        {
          output: toolPart.output?.substring?.(0, 50),
          hasInput: !!toolInput,
          toolCallId: toolCallIdResolved,
          inputSource: toolPart.input ? "input" : toolPart.args ? "args" : "none"
        },
        "deployToShipperCloud output-available"
      );
      if (!toolInput) {
        logger2.debug("No input found, skipping");
        return part;
      }
      if (toolPart.output !== SHIPPER_CLOUD_APPROVAL.YES && toolPart.output !== SHIPPER_CLOUD_APPROVAL.NO) {
        logger2.debug(
          { output: toolPart.output?.substring?.(0, 30) },
          "Output is not approval value, skipping"
        );
        return part;
      }
      let result;
      if (toolPart.output === SHIPPER_CLOUD_APPROVAL.YES) {
        logger2.info(
          { projectName: toolInput.projectName },
          "User confirmed deployment"
        );
        try {
          const deploymentResult = await executeShipperCloudDeploymentWithFiles(
            projectId,
            userId,
            toolInput.projectName
          );
          result = formatDeploymentSuccess(deploymentResult);
          resultMessage = result;
          wasProcessed = true;
        } catch (error) {
          logger2.error({ error }, "Deployment failed");
          result = formatDeploymentError(error);
          resultMessage = result;
          wasProcessed = true;
        }
      } else if (toolPart.output === SHIPPER_CLOUD_APPROVAL.NO) {
        logger2.info(
          { projectName: toolInput.projectName },
          "User declined deployment"
        );
        result = "Error: User denied access to Shipper Cloud deployment";
        resultMessage = result;
        wasProcessed = true;
      } else {
        return part;
      }
      return {
        ...part,
        state: "result",
        output: result
      };
    })
  );
  const processedMessages = [
    ...messages.slice(0, -1),
    { ...lastMessage, parts: processedParts }
  ];
  if (wasProcessed && lastMessage.id) {
    try {
      await prisma.v2Message.update({
        where: { id: lastMessage.id },
        data: {
          content: JSON.stringify(processedParts)
        }
      });
      logger2.info(
        { messageId: lastMessage.id },
        "Updated message with deployment result"
      );
    } catch (error) {
      logger2.error(
        { error },
        "Failed to persist deployment result to database"
      );
    }
  }
  return { messages: processedMessages, wasProcessed, resultMessage };
}
async function executeShipperCloudDeploymentWithFiles(projectId, userId, projectName) {
  const logger2 = createProjectLogger(projectId, {
    service: "ShipperCloudHITL"
  });
  logger2.info({ projectName }, "Starting full deployment");
  const baseResult = await executeShipperCloudDeployment(
    projectId,
    userId,
    projectName
  );
  if (!baseResult.success) {
    return baseResult;
  }
  if (baseResult.isExisting && !baseResult.needsSetup) {
    logger2.info("Existing deployment with setup complete - skipping setup steps");
    const deploymentUrl2 = baseResult.deploymentUrl;
    const siteUrl2 = deploymentUrl2.replace(".convex.cloud", ".convex.site");
    return {
      success: true,
      deploymentUrl: deploymentUrl2,
      deploymentName: baseResult.deploymentName,
      siteUrl: siteUrl2,
      isExisting: true,
      filesCreated: [],
      packagesInstalled: true,
      packagesInstalledList: [],
      convexDeployed: true,
      envVarsSet: true,
      authClientPath: "src/lib/auth-client.ts"
    };
  }
  const sandboxInfo = await getSandbox(projectId);
  if (!sandboxInfo) {
    return {
      ...baseResult,
      success: false,
      error: "No active sandbox found. Please ensure the project has a running sandbox."
    };
  }
  const deploymentUrl = baseResult.deploymentUrl;
  const deploymentName = baseResult.deploymentName;
  const siteUrl = deploymentUrl.replace(".convex.cloud", ".convex.site");
  const filesToCreate = [
    // Main convex files
    { path: "convex/convex.config.ts", content: generateConvexConfigTs() },
    { path: "convex/auth.config.ts", content: generateAuthConfigTs() },
    { path: "convex/auth.ts", content: generateAuthTs() },
    // Uses local schema
    { path: "convex/http.ts", content: generateHttpTs() },
    { path: "convex/schema.ts", content: generateBasicSchemaTs() },
    { path: "convex/tsconfig.json", content: generateConvexTsConfig() },
    // Local install files for admin plugin
    {
      path: "convex/betterAuth/convex.config.ts",
      content: generateBetterAuthComponentConfig()
    },
    {
      path: "convex/betterAuth/auth.ts",
      content: generateBetterAuthStaticExport()
    },
    {
      path: "convex/betterAuth/schema.ts",
      content: generateBetterAuthSchema()
    },
    // Manual schema
    {
      path: "convex/betterAuth/adapter.ts",
      content: generateBetterAuthAdapter()
    },
    // Client-side auth
    { path: "src/lib/auth-client.ts", content: generateAuthClientTs() }
  ];
  await executeCommand(
    sandboxInfo.sandboxId,
    "mkdir -p convex/betterAuth src/lib"
  );
  const writeResults = [];
  for (const file of filesToCreate) {
    try {
      await writeFile(sandboxInfo.sandboxId, file.path, file.content);
      writeResults.push(`\u2713 Created ${file.path}`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      writeResults.push(`\u2717 Failed to create ${file.path}: ${errMsg}`);
    }
  }
  const packages = getRequiredPackages();
  const installCmd = `bun add convex@1.30.0 ${packages.join(" ")}`;
  logger2.info({ installCmd }, "Installing packages");
  const installResult = await executeCommand(
    sandboxInfo.sandboxId,
    installCmd,
    {
      timeoutMs: 12e4
      // 2 minute timeout
    }
  );
  const installSuccess = installResult.exitCode === 0;
  let envVarsSet = false;
  try {
    const betterAuthSecret = generateBetterAuthSecret();
    logger2.info("Generated secret for Better Auth");
    let deployKeyEncrypted;
    let convexDeploymentUrl;
    if (baseResult.deployment?.deployKeyEncrypted) {
      deployKeyEncrypted = baseResult.deployment.deployKeyEncrypted;
      convexDeploymentUrl = baseResult.deployment.convexDeploymentUrl;
    } else {
      const existingDeployment = await prisma.convexDeployment.findUnique({
        where: { projectId },
        select: { deployKeyEncrypted: true, convexDeploymentUrl: true }
      });
      if (!existingDeployment) {
        logger2.error("No deployment found - cannot set environment variables");
        throw new Error("Deployment not found");
      }
      deployKeyEncrypted = existingDeployment.deployKeyEncrypted;
      convexDeploymentUrl = existingDeployment.convexDeploymentUrl;
    }
    const deployKey = decryptDeployKey(deployKeyEncrypted);
    const deploymentApi = new ConvexDeploymentAPI(
      convexDeploymentUrl,
      deployKey
    );
    const envResult = await deploymentApi.setEnvironmentVariables({
      BETTER_AUTH_SECRET: betterAuthSecret,
      SITE_URL: "http://localhost:5173"
      // Will be updated when deployed to production
    });
    logger2.info(
      {
        success: envResult.success,
        error: envResult.error
      },
      "Better Auth environment variables set via API"
    );
    envVarsSet = envResult.success;
    if (!envResult.success) {
      logger2.error(
        { error: envResult.error },
        "Failed to set Better Auth env vars via API"
      );
    }
  } catch (envError) {
    logger2.error({ error: envError }, "Failed to set Better Auth env vars");
  }
  logger2.info("Deploying auth files to Convex...");
  let convexDeploySuccess = false;
  try {
    await executeCommand(
      sandboxInfo.sandboxId,
      "rm -rf .convex node_modules/.convex convex/_generated"
    );
    const deployResult = await executeCommand(
      sandboxInfo.sandboxId,
      "bunx convex deploy --yes",
      { timeoutMs: 12e4 }
      // 2 minute timeout
    );
    convexDeploySuccess = deployResult.exitCode === 0;
    if (convexDeploySuccess) {
      logger2.info("Convex auth files deployed successfully");
    } else {
      logger2.warn(
        {
          stdout: deployResult.stdout?.slice(-500),
          stderr: deployResult.stderr?.slice(-500)
        },
        "Convex deploy had issues - auth may require manual deployment"
      );
    }
  } catch (deployError) {
    logger2.warn(
      { error: deployError },
      "Failed to deploy Convex auth files - auth may require manual deployment"
    );
  }
  try {
    logger2.info("Restarting dev server...");
    await executeCommand(sandboxInfo.sandboxId, "pkill -9 -f vite || true");
    await executeCommand(
      sandboxInfo.sandboxId,
      "rm -rf node_modules/.vite node_modules/.tmp"
    );
    await new Promise((resolve) => setTimeout(resolve, 1e3));
    await startDevServer(sandboxInfo.sandboxId, projectId, 5173);
  } catch (restartError) {
    logger2.warn({ error: restartError }, "Dev server restart warning");
  }
  try {
    await prisma.convexDeployment.update({
      where: { projectId },
      data: {
        setupComplete: true,
        setupCompletedAt: /* @__PURE__ */ new Date()
      }
    });
    logger2.info("Setup marked as complete");
  } catch (updateError) {
    logger2.error({ error: updateError }, "Failed to mark setup as complete");
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
    authClientPath: "src/lib/auth-client.ts"
  };
}
async function executeShipperCloudDeployment(projectId, _userId, projectName) {
  const logger2 = createProjectLogger(projectId, {
    service: "ShipperCloudHITL"
  });
  const existingDeployment = await prisma.convexDeployment.findUnique({
    where: { projectId }
  });
  if (existingDeployment) {
    await injectDeployKeyIntoSandbox(
      projectId,
      existingDeployment.deployKeyEncrypted,
      existingDeployment.convexDeploymentUrl
    );
    const needsSetup = !existingDeployment.setupComplete;
    if (needsSetup) {
      logger2.info("Existing deployment found but setup incomplete - will re-run setup");
    }
    return {
      success: true,
      deploymentUrl: existingDeployment.convexDeploymentUrl,
      deploymentName: existingDeployment.convexDeploymentName,
      isExisting: true,
      needsSetup
    };
  }
  const deploymentService = new ShipperCloudDeploymentService();
  const isDev = process.env.NODE_ENV === "development";
  const convexProjectName = isDev ? `dev-${projectName}` : projectName;
  const result = await deploymentService.provisionBackend(
    projectId,
    convexProjectName
  );
  if (!result.success || !result.deployment) {
    return {
      success: false,
      error: result.error || "Failed to provision Shipper Cloud backend"
    };
  }
  const billingWebhookUrl = process.env.BILLING_WEBHOOK_URL;
  let webhookSecretEncrypted;
  if (billingWebhookUrl) {
    const deployKey = decryptDeployKey(result.deployment.deployKeyEncrypted);
    const deploymentApi = new ConvexDeploymentAPI(
      result.deployment.convexDeploymentUrl,
      deployKey
    );
    const webhookResult = await deploymentApi.createWebhookLogStream({
      url: billingWebhookUrl,
      format: "json"
    });
    logger2.info({ webhookResult }, "Webhook log stream creation result");
    if (!webhookResult.success || !webhookResult.webhookSecret) {
      logger2.error(
        { error: webhookResult.error },
        "Failed to configure webhook for usage tracking - rolling back deployment"
      );
      try {
        await deploymentApi.deleteLogStream("webhook");
      } catch (deleteError) {
        logger2.warn(
          { error: deleteError },
          "Failed to cleanup webhook during rollback"
        );
      }
      return {
        success: false,
        error: `Failed to configure usage tracking webhook: ${webhookResult.error || "No webhook secret returned"}. Deployment was not saved.`
      };
    }
    webhookSecretEncrypted = encryptDeployKey(webhookResult.webhookSecret);
    logger2.info("Webhook configured for usage tracking");
  }
  await prisma.$transaction([
    prisma.convexDeployment.create({
      data: {
        projectId,
        convexProjectId: String(result.deployment.convexProjectId),
        convexDeploymentName: result.deployment.convexDeploymentName,
        convexDeploymentUrl: result.deployment.convexDeploymentUrl,
        deployKeyEncrypted: result.deployment.deployKeyEncrypted,
        status: "ACTIVE",
        ...webhookSecretEncrypted && {
          webhookSecretEncrypted,
          webhookConfiguredAt: /* @__PURE__ */ new Date()
        }
      }
    }),
    prisma.project.update({
      where: { id: projectId },
      data: { shipperCloudEnabled: true }
    })
  ]);
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        teamId: true,
        userId: true,
        // For user-level projects
        team: {
          select: {
            members: {
              where: { role: "OWNER" },
              select: { userId: true },
              take: 1
            }
          }
        }
      }
    });
    const userToCredit = project?.team?.members[0]?.userId || project?.userId;
    if (userToCredit) {
      const billingResult = await addConvexMeteredPricesToUserSubscription(
        userToCredit,
        projectId
      );
      if (!billingResult.success) {
        logger2.warn(
          { projectId, userId: userToCredit, error: billingResult.error },
          "Failed to add metered prices - usage will be tracked but not billed until prices are added"
        );
      }
    } else {
      logger2.warn(
        { projectId },
        "No user found for project - skipping billing setup"
      );
    }
  } catch (billingError) {
    logger2.warn(
      {
        projectId,
        error: billingError instanceof Error ? billingError.message : String(billingError)
      },
      "Error during billing setup - deployment succeeded but billing may need manual setup"
    );
  }
  await injectDeployKeyIntoSandbox(
    projectId,
    result.deployment.deployKeyEncrypted,
    result.deployment.convexDeploymentUrl
  );
  return {
    success: true,
    deploymentUrl: result.deploymentUrl,
    deploymentName: result.deploymentName,
    deployment: result.deployment
  };
}
async function injectDeployKeyIntoSandbox(projectId, encryptedDeployKey, deploymentUrl, options = {}) {
  const { throwOnError = false } = options;
  const logger2 = createProjectLogger(projectId, {
    service: "ShipperCloudHITL"
  });
  try {
    const deployKey = decryptDeployKey(encryptedDeployKey);
    const sandboxInfo = await getSandbox(projectId);
    if (!sandboxInfo) {
      const message = "No sandbox found for project";
      logger2.warn(`Cannot inject deploy key: ${message}`);
      if (throwOnError) {
        throw new Error(message);
      }
      return { success: false, message, error: message };
    }
    if (sandboxInfo.sandboxExpiresAt && /* @__PURE__ */ new Date() > sandboxInfo.sandboxExpiresAt) {
      const message = "Sandbox has expired. Please restart the sandbox first.";
      logger2.warn(`Cannot inject deploy key: ${message}`);
      if (throwOnError) {
        throw new Error(message);
      }
      return { success: false, message, error: message };
    }
    if (sandboxInfo.status !== "running") {
      const message = `Sandbox is not running (status: ${sandboxInfo.status}). Please restart the sandbox first.`;
      logger2.warn(`Cannot inject deploy key: ${message}`);
      if (throwOnError) {
        throw new Error(message);
      }
      return { success: false, message, error: message };
    }
    const siteUrl = deploymentUrl.replace(".convex.cloud", ".convex.site");
    const envCommand = `sh -c '
      touch /workspace/.env.local &&       grep -v "^CONVEX_DEPLOY_KEY=\\|^VITE_CONVEX_URL=\\|^VITE_CONVEX_SITE_URL=\\|^SITE_URL=" /workspace/.env.local > /workspace/.env.local.tmp 2>/dev/null || true &&       mv /workspace/.env.local.tmp /workspace/.env.local &&       echo "CONVEX_DEPLOY_KEY=${deployKey}" >> /workspace/.env.local &&       echo "VITE_CONVEX_URL=${deploymentUrl}" >> /workspace/.env.local &&       echo "VITE_CONVEX_SITE_URL=${siteUrl}" >> /workspace/.env.local &&       echo "SITE_URL=http://localhost:5173" >> /workspace/.env.local
    '`;
    await executeCommand(sandboxInfo.sandboxId, envCommand);
    logger2.info("Deploy key and URL injected into sandbox");
    return { success: true, message: "Credentials injected successfully" };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const isSandboxCompleted = errorMsg.includes("has already completed");
    const isSandboxExpired = errorMsg.includes("expired") || isSandboxCompleted;
    const userMessage = isSandboxExpired ? "Sandbox is no longer active. Please restart the sandbox first." : `Failed to inject credentials: ${errorMsg}`;
    logger2.error({ error }, "Failed to inject deploy key");
    if (throwOnError) {
      throw new Error(userMessage);
    }
    return { success: false, message: userMessage, error: errorMsg };
  }
}
function formatDeploymentSuccess(result) {
  const response = {
    success: true,
    message: result.isExisting ? "Shipper Cloud deployment already exists. Better Auth files have been set up." : "Successfully provisioned Shipper Cloud backend with Better Auth!",
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
      "\u26A0\uFE0F STOP! Follow this EXACT order:",
      result.convexDeployed ? "\u2705 Base auth already deployed - CORS is configured for Modal URLs" : "\u26A0\uFE0F Auth deployment may have failed - run deployConvex if you see CORS errors",
      "1. IMMEDIATELY call scaffoldConvexSchema tool with your table definitions",
      "2. THEN call deployConvex tool to sync your schema and generate types",
      "3. ONLY AFTER deployConvex succeeds: Update src/main.tsx with ConvexBetterAuthProvider (see mainTsxExample below)",
      "4. Create /signin and /signup routes with REAL forms using signInWithEmail/signUpWithEmail from src/lib/auth-client.ts",
      "5. Use the GENERATED function names: api.queries.listTodos, api.mutations.createTodo, etc.",
      "6. Always use todo._id (not todo.id) when calling mutations - _id is typed as Id<'todos'>",
      "7. \u26A0\uFE0F Update mutations use FLAT args - see mutationExamples below!",
      "8. \u26A0\uFE0F NEVER redirect from __root.tsx! Only redirect in PROTECTED routes",
      "9. Home page (/) should show content for unauth users, NOT just redirect to signin!",
      "\u{1F6A8}\u{1F6A8}\u{1F6A8} CRITICAL: NEVER use AuthLoading/Authenticated/Unauthenticated from 'convex/react' - see authComponentWarning below!",
      "\u{1F6A8}\u{1F6A8}\u{1F6A8} CRITICAL: Auth-required queries THROW 'Unauthenticated' if called without session - use 'skip' pattern! See queryExamples below!"
    ],
    mainTsxExample: `import { ConvexReactClient } from 'convex/react'
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react'
import { authClient } from '@/lib/auth-client'

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL)

// CRITICAL: authClient prop is REQUIRED!
<ConvexBetterAuthProvider client={convex} authClient={authClient}>
  {/* your app */}
</ConvexBetterAuthProvider>`,
    criticalWarning: "\u{1F6AB} DO NOT create React components yet! Call scaffoldConvexSchema THEN deployConvex FIRST!",
    mutationExamples: {
      description: "\u26A0\uFE0F\u26A0\uFE0F\u26A0\uFE0F CRITICAL: Update mutations use FLAT args, NOT nested 'updates' object!",
      correct: [
        "// \u2705 CORRECT - flat args at top level:",
        "await updateTodo({ id: todo._id, title: 'New title', completed: true });",
        "await updateTodo({ id: todo._id, completed: !todo.completed });",
        "await deleteTodo({ id: todo._id });"
      ],
      wrong: [
        "// \u{1F6AB} WRONG - 'updates' property does not exist:",
        "await updateTodo({ id: todo._id, updates: { title: 'New' } }); // \u274C ERROR!",
        "// \u{1F6AB} WRONG - using 'id' instead of '_id':",
        "await updateTodo({ id: todo.id, title: 'New' }); // \u274C 'id' doesn't exist, use '_id'!",
        "// \u{1F6AB} WRONG - converting _id to string:",
        "await deleteTodo({ id: String(todo._id) }); // \u274C string is not Id<'todos'>!"
      ],
      note: "The scaffolded updateTodo mutation accepts: { id: Id<'todos'>, title?: string, completed?: boolean, ... } - all fields are FLAT at the args level, not nested in an 'updates' object!"
    },
    queryExamples: {
      title: "\u{1F6A8}\u{1F6A8}\u{1F6A8} CRITICAL: Auth-Required Queries THROW if Called Without Session! \u{1F6A8}\u{1F6A8}\u{1F6A8}",
      problem: "Convex queries that use getAuthUser(ctx) will throw 'Unauthenticated' error if called before the user has a valid session. You MUST use the 'skip' pattern to conditionally skip queries.",
      errorYouWillSee: "Uncaught Error: Unauthenticated at getAuthUser",
      correct: [
        "// \u2705 CORRECT - Check session FIRST, then conditionally execute query:",
        "function TodoList() {",
        "  const { data: session, isPending } = useSession();",
        "  // Pass 'skip' as second arg when no session - this prevents the query from running!",
        "  const todos = useQuery(api.queries.listTodos, session ? {} : 'skip');",
        "",
        "  if (isPending) return <LoadingSpinner />;",
        "  if (!session) return <Navigate to='/signin' />;",
        "",
        "  return <div>{todos?.map(todo => <TodoItem key={todo._id} todo={todo} />)}</div>;",
        "}"
      ],
      wrong: [
        "// \u{1F6AB} WRONG - Query runs immediately before session check!",
        "function TodoList() {",
        "  const todos = useQuery(api.queries.listTodos);  // \u274C THROWS 'Unauthenticated'!",
        "  const { data: session } = useSession();",
        "  // ...",
        "}",
        "",
        "// \u{1F6AB} WRONG - No skip pattern, query runs even when not authenticated!",
        "function TodoList() {",
        "  const { data: session } = useSession();",
        "  const todos = useQuery(api.queries.listTodos);  // \u274C Still runs without session!",
        "  if (!session) return <Navigate to='/signin' />;",
        "  // ...",
        "}"
      ],
      keyRules: [
        "1. ALWAYS call useSession() BEFORE any useQuery that requires auth",
        "2. ALWAYS use the 'skip' pattern: useQuery(api.queries.foo, session ? {} : 'skip')",
        "3. The 'skip' string tells Convex to NOT execute the query at all",
        "4. For queries with args: useQuery(api.queries.foo, session ? { userId: session.user.id } : 'skip')",
        "5. NEVER assume the query will wait for auth - it runs immediately on mount!"
      ],
      fullExample: `// \u2705 COMPLETE PATTERN for protected pages with auth-required queries:
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
}`
    },
    importantReminders: [
      "\u26A0\uFE0F ConvexBetterAuthProvider REQUIRES both client AND authClient props!",
      "Import authClient from src/lib/auth-client.ts and pass it: <ConvexBetterAuthProvider client={convex} authClient={authClient}>",
      "Better Auth client exports: useSession, signIn, signUp, signOut from src/lib/auth-client.ts",
      "Use signInWithEmail(email, password) for typed error handling (returns { success, error })",
      "\u{1F6A8} Use todo._id for mutations, NOT todo.id (which doesn't exist) - _id is typed as Id<'todos'>",
      "\u{1F6A8} Update mutations use FLAT args: updateTodo({ id: todo._id, completed: true }) NOT updateTodo({ id, updates: {...} })",
      "Don't create custom Todo interfaces - use Doc<'todos'> from convex/_generated/dataModel",
      "\u{1F6A8}\u{1F6A8}\u{1F6A8} Auth queries THROW 'Unauthenticated' - ALWAYS use: useQuery(api.queries.foo, session ? {} : 'skip')",
      "\u{1F6A8} Call useSession() BEFORE useQuery in components - queries run immediately on mount, they don't wait for auth!"
    ],
    // CRITICAL WARNING: convex/react auth components are NOT compatible with Better Auth
    authComponentWarning: {
      title: "\u{1F6A8}\u{1F6A8}\u{1F6A8} CRITICAL: DO NOT USE convex/react AUTH COMPONENTS! \u{1F6A8}\u{1F6A8}\u{1F6A8}",
      problem: "Shipper Cloud uses Better Auth, NOT Convex Auth. The following components from 'convex/react' require ConvexProviderWithAuth (which we don't use) and WILL CRASH YOUR APP:",
      forbiddenImports: [
        "import { AuthLoading } from 'convex/react'     // \u274C WILL CRASH",
        "import { Authenticated } from 'convex/react'   // \u274C WILL CRASH",
        "import { Unauthenticated } from 'convex/react' // \u274C WILL CRASH"
      ],
      errorYouWillSee: "Could not find `ConvexProviderWithAuth` (or `ConvexProviderWithClerk` or `ConvexProviderWithAuth0`) as an ancestor component.",
      correctAlternatives: {
        description: "Use Better Auth's useSession hook instead for ALL auth state handling:",
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
          "if (!session) return <Navigate to='/signin' />;"
        ],
        fullExample: `// \u2705 CORRECT Pattern with Better Auth:
import { useSession } from '@/lib/auth-client';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Navigate } from '@tanstack/react-router';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  // 1. FIRST: Get session state
  const { data: session, isPending } = useSession();

  // 2. SECOND: Conditionally run auth-required queries with 'skip' pattern
  // \u26A0\uFE0F CRITICAL: Without 'skip', query throws 'Unauthenticated' error!
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
}`
      },
      recovery: {
        title: "If you see the ConvexProviderWithAuth error:",
        steps: [
          "1. Search your codebase for: AuthLoading, Authenticated, Unauthenticated",
          "2. Remove ALL imports of these from 'convex/react'",
          "3. Replace with useSession from '@/lib/auth-client'",
          "4. Update your components to use session.isPending and session.data",
          "5. Restart your dev server"
        ]
      },
      unauthenticatedRecovery: {
        title: "If you see 'Uncaught Error: Unauthenticated at getAuthUser':",
        problem: "A Convex query using getAuthUser is being called before the user is authenticated.",
        steps: [
          "1. Find the component that's calling the failing query",
          "2. Add useSession() BEFORE the useQuery call",
          "3. Add the 'skip' pattern: useQuery(api.queries.foo, session ? {} : 'skip')",
          "4. Ensure the component handles isPending and !session states before rendering",
          "5. The order MUST be: useSession \u2192 useQuery with skip \u2192 isPending check \u2192 !session check \u2192 render"
        ],
        example: "const { data: session } = useSession();\nconst data = useQuery(api.queries.myQuery, session ? {} : 'skip');"
      }
    }
  };
  return JSON.stringify(response);
}
function formatDeploymentError(error) {
  const message = error instanceof Error ? error.message : String(error);
  const response = {
    success: false,
    error: message,
    message: `Failed to deploy to Shipper Cloud: ${message}`,
    troubleshooting: [
      "Check if the Convex configuration is correct",
      "Verify the convex/ directory contains valid schema and functions",
      "Try again or contact support if the issue persists"
    ]
  };
  return JSON.stringify(response);
}
function hasPendingShipperCloudConfirmation(messages) {
  if (messages.length === 0) return false;
  const lastMessage = messages[messages.length - 1];
  const parts = lastMessage.parts;
  if (!parts || !Array.isArray(parts)) return false;
  return parts.some((part) => {
    if (!isToolUIPart(part)) return false;
    const toolName = getToolName(part);
    return toolName === SHIPPER_CLOUD_TOOL_NAME && part.state === "input-available";
  });
}

export {
  SHIPPER_CLOUD_APPROVAL,
  SHIPPER_CLOUD_TOOL_NAME,
  processShipperCloudConfirmation,
  executeShipperCloudDeploymentWithFiles,
  executeShipperCloudDeployment,
  injectDeployKeyIntoSandbox,
  formatDeploymentSuccess,
  formatDeploymentError,
  hasPendingShipperCloudConfirmation
};
