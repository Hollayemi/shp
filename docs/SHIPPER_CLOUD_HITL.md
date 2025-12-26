# Shipper Cloud Human-in-the-Loop (HITL) Implementation

This document describes how the `deployToShipperCloud` tool implements human-in-the-loop confirmation in an Anthropic-compatible way.

## Overview

The Shipper Cloud deployment tool requires user confirmation before provisioning a Convex backend.

**IMPORTANT: Anthropic Compatibility**

Anthropic's Claude requires that every `tool_use` block be immediately followed by a `tool_result` block. This means we CANNOT use the standard AI SDK v5 HITL pattern (tools without execute functions), as it would leave `tool_use` without a corresponding `tool_result`.

Instead, we use an **Anthropic-compatible HITL pattern**:

1. Tool has an `execute` function that returns `{status: "pending_confirmation"}`
2. Frontend detects this status and shows confirmation dialog
3. User confirms/denies by sending a new message
4. AI calls the tool again with `confirmed: true`
5. Tool executes the actual deployment

## Architecture

### Anthropic-Compatible HITL Pattern

```
AI calls tool (confirmed=false)
            ↓
Execute returns {status: "pending_confirmation", projectName, reason}
            ↓
Frontend shows ShipperCloudConfirmation dialog
            ↓
User clicks "Yes" or "No"
            ↓
Frontend sends NEW user message:
  - Yes: "Yes, please proceed with deploying X to Shipper Cloud"
  - No: "No, I don't want to deploy..."
            ↓
AI sees user confirmation and calls tool again with confirmed=true
            ↓
Execute runs the actual deployment
            ↓
Tool returns success/error result
```

### Key Files

- `apps/api/src/services/ai-tools.ts` - Tool definition with execute function that checks `confirmed` parameter
- `apps/api/src/services/shipper-cloud-hitl.ts` - Deployment execution logic (`executeShipperCloudDeploymentWithFiles`)
- `apps/web/src/modules/projects/ui/components/ChatMessage.tsx` - Frontend confirmation UI (detects `pending_confirmation` status)
- `apps/web/src/components/ShipperCloudConfirmation.tsx` - Confirmation dialog component

## Implementation Details

### 1. Tool Definition

The `deployToShipperCloud` tool HAS an execute function that checks the `confirmed` parameter:

```typescript
// apps/api/src/services/ai-tools.ts
export const deployToShipperCloud = (context: ToolsContext) =>
  tool({
    description: `Enable Shipper Cloud (Convex backend) for this project...`,
    inputSchema: z.object({
      projectName: z.string(),
      reason: z.string(),
      confirmed: z.boolean().optional(), // Key parameter for HITL
    }),
    execute: async ({ projectName, reason, confirmed }) => {
      // If not confirmed, return pending status
      if (!confirmed) {
        return {
          status: "pending_confirmation",
          message: "Awaiting user confirmation",
          projectName,
          reason,
        };
      }

      // User confirmed - execute deployment
      const result = await executeShipperCloudDeploymentWithFiles(...);
      return { status: "success", ...result };
    },
  });
```

### 2. Frontend Detection

The frontend checks for `status: "pending_confirmation"` in the tool result:

```typescript
// apps/web/src/modules/projects/ui/components/ChatMessage.tsx
if (toolName === SHIPPER_CLOUD_TOOL_NAME) {
  const result = part.result || part.output;
  const parsedResult = typeof result === "string" ? JSON.parse(result) : result;

  // Show confirmation when tool returns pending_confirmation
  if (parsedResult?.status === "pending_confirmation") {
    return (
      <ShipperCloudConfirmation
        projectName={parsedResult.projectName}
        reason={parsedResult.reason}
        onConfirm={() => {
          // Send new user message - AI will call tool again with confirmed=true
          onSendMessage(`Yes, please proceed with deploying "${projectName}" to Shipper Cloud.`);
        }}
        onDeny={() => {
          onSendMessage(`No, I don't want to deploy to Shipper Cloud right now.`);
        }}
      />
    );
  }
}
```

### 3. User Confirmation Flow

When the user confirms:
1. Frontend sends a new user message: "Yes, please proceed..."
2. AI receives this message and understands the user confirmed
3. AI calls `deployToShipperCloud` again, this time with `confirmed: true`
4. Tool executes the actual deployment
5. AI receives success/error result

## Tool Result Statuses

| Status | Description | Frontend Action |
|--------|-------------|-----------------|
| `pending_confirmation` | Tool needs user confirmation | Show confirmation dialog |
| `success` | Deployment completed successfully | Show success state |
| `error` | Deployment failed | Show error state |

## Why Not Use AI SDK v5 HITL Pattern?

The standard AI SDK v5 HITL pattern uses tools WITHOUT execute functions:
- Tool enters `call` state
- Frontend uses `addToolOutput()` to provide result
- Server processes with `processShipperCloudConfirmation()`

**Problem:** Anthropic requires every `tool_use` to have a corresponding `tool_result` immediately after. Tools without execute functions leave `tool_use` without `tool_result`, causing:

```
Error: messages.2: `tool_use` ids were found without `tool_result` blocks
immediately after: toolu_xxx. Each `tool_use` block must have a corresponding
`tool_result` block in the next message.
```

Our solution: Tool ALWAYS returns a result. The `pending_confirmation` status acts as the "waiting for user" signal while still satisfying Anthropic's message format requirements.

## Message Format for Anthropic

The tool result is returned as JSON for proper Anthropic parsing:

```json
{
  "success": true,
  "message": "Successfully provisioned Shipper Cloud backend with Better Auth!",
  "deploymentUrl": "https://xxx.convex.cloud",
  "siteUrl": "https://xxx.convex.site",
  "deploymentName": "xxx",
  "filesCreated": ["convex/schema.ts", "..."],
  "packagesInstalled": true,
  "nextSteps": ["Call deployConvex tool", "..."],
  "criticalWarning": "DO NOT create React components yet!"
}
```

## Approval Constants

```typescript
export const SHIPPER_CLOUD_APPROVAL = {
  YES: "Yes, deploy to Shipper Cloud",
  NO: "No, cancel deployment",
} as const;

export const SHIPPER_CLOUD_TOOL_NAME = "deployToShipperCloud";
```

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              AI Request                                  │
│   "I need to add a database to store user data"                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                         AI calls deployToShipperCloud                    │
│   { projectName: "my-app", reason: "Store user data" }                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    Tool enters "call" state (no execute)                 │
│   Streamed to frontend with state: "call"                               │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    Frontend: ShipperCloudConfirmation                    │
│   ┌─────────────────────────────────────────────┐                       │
│   │  Deploy to Shipper Cloud?                    │                       │
│   │  Project: my-app                             │                       │
│   │  Reason: Store user data                     │                       │
│   │  [Yes, Deploy]  [No, Cancel]                 │                       │
│   └─────────────────────────────────────────────┘                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
                        User clicks "Yes, Deploy"
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                         addToolOutput() called                           │
│   { tool: "deployToShipperCloud", toolCallId: "...",                    │
│     output: "Yes, deploy to Shipper Cloud" }                            │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                       New request sent to server                         │
│   Message now has tool part with state: "output-available"              │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                  processShipperCloudConfirmation()                       │
│   1. Finds deployToShipperCloud with state: "output-available"          │
│   2. Checks output === SHIPPER_CLOUD_APPROVAL.YES                       │
│   3. Calls executeShipperCloudDeploymentWithFiles()                     │
│   4. Updates tool part with result (state: "result")                    │
│   5. Persists updated message to database                               │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                      AI receives tool result                             │
│   { success: true, deploymentUrl: "...", nextSteps: [...] }             │
│   AI continues: "Great! The backend is ready. Now calling deployConvex" │
└─────────────────────────────────────────────────────────────────────────┘
```

## Troubleshooting

### Tool never shows confirmation dialog

1. Check that `deployToShipperCloud` tool does NOT have an `execute` function
2. Verify the tool part state is `call` or `input-available` in the message
3. Ensure the message filtering in `chat.ts` preserves `tool-invocation` parts

### Confirmation not processed

1. Check server logs for `[ShipperCloudHITL]` entries
2. Verify `processShipperCloudConfirmation` is called in chat route
3. Ensure the tool output matches `SHIPPER_CLOUD_APPROVAL.YES` or `NO`

### AI doesn't see deployment result

1. Check the tool result is formatted as JSON
2. Verify the tool part state is updated to `result`
3. Ensure the message is persisted to the database with updated parts

## References

- [AI SDK HITL Cookbook](https://ai-sdk.dev/cookbook/next/human-in-the-loop)
- [AI SDK Tool Usage](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage)
- [Convex Shipper Cloud Plan](./CONVEX_SHIPPER_CLOUD_PLAN.md)
