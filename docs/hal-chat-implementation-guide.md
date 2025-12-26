# HAL Chat Implementation Guide

Complete guide to the HAL Chat tool-based suggestions system with closure pattern.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Migration History](#migration-history)
4. [Current Implementation](#current-implementation)
5. [Testing](#testing)
6. [Troubleshooting](#troubleshooting)

---

## Overview

The HAL Chat system uses AI SDK's tool-based approach to generate personalized project suggestions. The `generateSuggestions` tool uses a closure pattern to capture the `projectId` from the handler scope, eliminating the need for the AI to pass it as a parameter.

### Key Features

- ✅ **Unified Route**: Single `/api/hal-chat` endpoint handles both chat and suggestions
- ✅ **Tool-Based**: Suggestions generated via AI SDK tool system
- ✅ **Closure Pattern**: ProjectId captured in tool factory function scope
- ✅ **Explicit-Only Usage**: Tool only called when user explicitly requests suggestions
- ✅ **Visual Interface**: Greeting + 4 clickable suggestion buttons in 2x2 grid
- ✅ **Debug Logging**: Comprehensive server and client-side logging

---

## Architecture

### Server Side

**Route:** `apps/web/src/app/api/hal-chat/route.ts`

#### Tool Factory Function (Lines 339-731)

```typescript
// Factory function that captures projectId in closure
const createTools = (projectId: string) => ({
  webSearch: exaWebSearchTool,
  generateSuggestions: tool({
    description: "Generate personalized project suggestions based on current project state.",
    inputSchema: z.object({}), // No parameters needed!
    execute: async () => {
      // projectId is available from closure
      console.log("[HAL Suggestions] Tool called for project:", projectId);

      // Get session
      const session = await auth();
      if (!session) throw new Error("Unauthorized");

      // Verify project access (user-owned OR team member)
      const project = await prisma.project.findFirst({
        where: {
          id: projectId,
          OR: [
            { userId: session.user.id },
            {
              team: {
                members: {
                  some: { userId: session.user.id }
                }
              }
            }
          ]
        }
      });

      if (!project) {
        throw new Error("Project not found or access denied");
      }

      // Analyze project files, generate suggestions with AI
      // ...

      return {
        greeting: "Warm, contextual greeting",
        suggestions: [/* 4 suggestions */]
      };
    },
  }),
});
```

#### Handler Usage (Lines 937-938)

```typescript
// Create tools with projectId in closure
const tools = createTools(projectId);

const stream = createUIMessageStream({
  execute: async (context) => {
    const writer = context.writer;
    const halStream = streamText({
      model: openrouter(HAL_CHAT_MODEL),
      messages: convertToModelMessages(finalMessages),
      tools, // Tools with projectId captured
      // ...
    });
  }
});
```

#### System Prompt (Lines 896-906)

```typescript
## When to Generate Suggestions:
**ONLY** use the generateSuggestions tool when the user **explicitly requests** suggestions with phrases like:
- "what should I build next?"
- "generate suggestions"
- "give me some ideas"
- "what features should I add?"
- "show me suggestions"

**DO NOT** automatically generate suggestions during normal conversation. The user has a manual button to request suggestions when they want them.

The tool will analyze their current project and generate 4 tailored suggestions with both builder (code) and advisor (research/strategy) options.
```

### Client Side

**Component:** `apps/web/src/components/HalSuggestionsChat.tsx`

#### Visual Interface Rendering (Lines 1071-1131)

```typescript
console.log("[HAL UI] Processing tool:", { toolName, state: part.state, hasOutput: !!part.output });

// Special handling for generateSuggestions tool - render as visual interface
if (toolName === "generateSuggestions" && part.state === "output-available") {
  const output = part.output as any;
  console.log("[HAL UI] Rendering generateSuggestions visual interface:", output);
  const greeting = output?.greeting || "Here are some suggestions:";
  const suggestions = output?.suggestions || [];
  console.log("[HAL UI] Extracted data:", { greeting, suggestionCount: suggestions.length });

  return (
    <div key={`tool-${id}-${groupIndex}-${i}`} className="space-y-3">
      <div className="text-sm text-[#000000] dark:text-[#B8C9C3]">
        <Response>{greeting}</Response>
      </div>
      {suggestions.length > 0 && (
        <TooltipProvider delayDuration={300}>
          <div className="grid grid-cols-2 gap-2">
            {suggestions.map((suggestion: any) => {
              const IconComponent = iconMap[suggestion.icon as keyof typeof iconMap] || Sparkles;
              return (
                <Tooltip key={suggestion.id}>
                  <TooltipTrigger asChild>
                    <SuggestionButton
                      onClick={() => handleSuggestionClick({
                        id: suggestion.id,
                        title: suggestion.title,
                        description: suggestion.description,
                        icon: IconComponent,
                        color: suggestion.color,
                        prompt: suggestion.prompt,
                        targetChat: suggestion.targetChat,
                        category: "general",
                      })}
                    >
                      <span>{suggestion.title}</span>
                    </SuggestionButton>
                  </TooltipTrigger>
                  <TooltipContent>← Add to chat</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>
      )}
    </div>
  );
}
```

---

## Migration History

### Phase 1: Initial Migration (Tool-Based Approach)

**What Changed:**
- Combined `/api/hal-chat/route.ts` and `/api/hal-chat/suggestions/route.ts` into one route
- Moved suggestions logic into a `generateSuggestions` tool
- Removed `useObject` hook from client
- Added visual interface rendering for tool results

**Issues Encountered:**
- Turbopack parsing errors with destructured async arrow functions
- Fixed by removing destructuring: `async (context) => { const writer = context.writer; }`

### Phase 2: Project Access Fix

**Problems:**
- TypeScript type conversion warnings
- "Project not found or access denied" errors
- AI not passing projectId parameter correctly

**Fixes:**
- Added `unknown` intermediary type for legacy message conversion
- Enhanced system prompt with projectId instructions
- Fixed database query to check both user-owned and team-owned projects

### Phase 3: Closure Refactor (Current)

**User Feedback:** "Shouldn't the projectId just be passed directly in the tool definition"

**Solution:** Refactored to use closure pattern

**Changes:**
1. Converted `tools` to factory function: `createTools(projectId)`
2. Tool has no parameters: `inputSchema: z.object({})`
3. ProjectId captured in closure and automatically available
4. Simplified system prompt (removed manual projectId passing)
5. Restricted tool usage to explicit-only (not automatic during chat)
6. Added comprehensive debug logging

---

## Current Implementation

### How It Works

```
┌─────────────────────────────────────┐
│ Handler (has projectId)             │
│                                     │
│  const tools = createTools(projectId)  ← Captures projectId in closure
│                     │                │
│                     ▼                │
│  ┌───────────────────────────────┐  │
│  │ generateSuggestions tool      │  │
│  │                               │  │
│  │ execute: async () => {        │  │
│  │   // projectId available here │  │  ← Closure magic!
│  │   console.log(projectId);     │  │
│  │ }                             │  │
│  └───────────────────────────────┘  │
│                                     │
│  streamText({ tools, ... })         │
└─────────────────────────────────────┘
```

### User Flow

1. **User Triggers Suggestions**
   - Clicks refresh button (manual trigger), OR
   - Types explicit request: "What should I build next?"

2. **Message Sent to AI**
   ```typescript
   sendMessage({
     parts: [{ type: "text", text: "Please generate some suggestions for what I should work on next." }]
   });
   ```

3. **AI Calls Tool**
   - AI recognizes explicit request
   - Calls `generateSuggestions()` with no parameters
   - ProjectId automatically available from closure

4. **Tool Executes**
   - Fetches project files from sandbox
   - Analyzes structure, features, purpose
   - Retrieves conversation history from Mem0
   - Generates 4 personalized suggestions using AI
   - Saves to database
   - Returns `{ greeting, suggestions }`

5. **Client Renders**
   - Detects `tool-generateSuggestions` in message parts
   - Renders visual interface:
     - Greeting message
     - 4 clickable suggestion buttons (2x2 grid)
   - Each button routes to builder or advisor chat

### Benefits

| Aspect | Before (Parameter) | After (Closure + Explicit) |
|--------|-------------------|---------------------------|
| **AI Complexity** | Must pass projectId | No parameters needed |
| **System Prompt** | Complex projectId instructions | Clear "only when requested" rule |
| **Reliability** | Can fail if AI forgets parameter | Always works - projectId guaranteed |
| **Tool Usage** | AI decides when helpful | Only when user explicitly requests |
| **Code** | More validation | Less code |
| **Type Safety** | Parameter level | Handler level |
| **Debugging** | No UI logging | Comprehensive logs |
| **Maintenance** | More error handling | Simpler logic |

---

## Testing

### Starting the Server

```bash
pnpm dev:web
```

### Test Scenarios

#### 1. Manual Button Click ✅
1. Open Advisor chat
2. Click the refresh button (circular arrows icon)
3. Tool should be called
4. Visual interface should render (greeting + 4 buttons)

#### 2. Explicit Chat Request ✅
1. Type "What should I build next?" in chat
2. Tool should be called
3. Visual interface should render

#### 3. Normal Conversation ❌ (Should NOT call tool)
1. Type "How do I add authentication?" in chat
2. AI should respond normally
3. Tool should NOT be called
4. No suggestions should appear

### Expected Console Output

#### Server-side (Terminal)

```
[HAL Suggestions] Tool called for project: abc-123-def-456
[HAL Suggestions] Session check: { hasSession: true, userId: "..." }
[HAL Suggestions] Looking for project: { projectId: "abc-123-def-456", userId: "..." }
[HAL Suggestions] Project found: { found: true, projectName: "My Cool App" }
[HAL Suggestions] Fetching project files from sandbox
[HAL Suggestions] Successfully generated suggestions
```

#### Client-side (Browser Console)

```
[HAL UI] Processing tool: { toolName: "generateSuggestions", state: "output-available", hasOutput: true }
[HAL UI] Rendering generateSuggestions visual interface: { greeting: "Hey! Your project is looking great...", suggestions: [...] }
[HAL UI] Extracted data: { greeting: "Hey! Your project is looking great...", suggestionCount: 4 }
```

### Visual Verification

If you see the above logs, the visual interface should render with:
- ✅ Greeting message (e.g., "Hey! Your project is looking great...")
- ✅ 4 clickable suggestion buttons in 2x2 grid
- ✅ Each button displays suggestion title
- ✅ Tooltip shows "← Add to chat"
- ✅ Clicking routes to builder or advisor chat appropriately

---

## Troubleshooting

### Issue: Tool Not Being Called

**Check:**
1. Did you click the refresh button OR type an explicit request?
2. Check browser network tab - is a POST to `/api/hal-chat` being made?
3. Check server logs - is the handler being invoked?

**Fix:**
- Make sure request includes explicit trigger phrase
- System prompt must include the "When to Generate Suggestions" section

### Issue: "Project not found or access denied"

**Check:**
1. Is user authenticated? Check session
2. Does user own the project OR belong to the project's team?
3. Check server logs for the actual `projectId` and `userId`

**Fix:**
```typescript
// Verify query checks both user-owned and team membership
const project = await prisma.project.findFirst({
  where: {
    id: projectId,
    OR: [
      { userId: session.user.id },
      {
        team: {
          members: {
            some: { userId: session.user.id }
          }
        }
      }
    ]
  }
});
```

### Issue: Visual Interface Not Rendering

**Check browser console for:**

```
[HAL UI] Processing tool: { toolName: "...", state: "...", hasOutput: ... }
```

**Diagnosis:**

1. **No `[HAL UI]` logs at all**
   - Tool result not in message parts
   - Check if tool actually executed successfully
   - Check network response for tool output

2. **Log shows wrong `toolName`**
   - Tool name mismatch
   - Should be exactly `"generateSuggestions"`

3. **Log shows wrong `state`**
   - Should be `"output-available"`
   - If `"output-error"`, check error logs
   - If `"input-streaming"`, tool is still running

4. **Log shows `hasOutput: false`**
   - Tool returned undefined or null
   - Check server logs for tool execution errors
   - Verify tool returns `{ greeting, suggestions }`

5. **Log shows rendering but no visual UI**
   - React rendering issue
   - Check for console errors
   - Verify component re-renders when tool completes
   - Check that `part.output` has correct structure

**Fix:**
```typescript
// Add more granular logging
console.log("[HAL UI] Full part data:", JSON.stringify(part, null, 2));
```

### Issue: Tool Called During Normal Chat

**Check:**
- System prompt includes "DO NOT automatically generate suggestions"
- User's message doesn't include trigger phrases

**Fix:**
- Update system prompt at `apps/web/src/app/api/hal-chat/route.ts:896-906`
- Make trigger phrases more specific
- Consider adding negative examples to system prompt

### Issue: TypeScript Errors

**Common Issues:**

1. **Type conversion warnings**
   ```typescript
   // Fix with unknown intermediary
   const halMsg = message as unknown as HalMessage;
   ```

2. **Tool type inference errors**
   ```typescript
   // Create sample tools for type exports
   const sampleTools = createTools("sample-id");
   export type ChatTools = InferUITools<typeof sampleTools>;
   ```

---

## Files Reference

### Server

1. **`apps/web/src/app/api/hal-chat/route.ts`**
   - Line 339-731: Tool factory function with closure
   - Line 896-906: System prompt (explicit-only usage)
   - Line 937-938: Tools created with projectId in handler

### Client

2. **`apps/web/src/components/HalSuggestionsChat.tsx`**
   - Line 1071: Tool processing debug log
   - Line 1074-1077: Visual rendering debug logs
   - Line 1079-1130: Visual interface rendering logic

### Documentation

3. **`docs/hal-chat-implementation-guide.md`** - This document (comprehensive guide)
4. **`docs/hal-chat-prd.md`** - Product requirements
5. **`docs/mem0-integration.md`** - Conversational memory
6. **`docs/exa-integration.md`** - Web search integration

---

## Related Patterns

This closure pattern can be used for any contextual data:

```typescript
// Example: Multiple context values
const createTools = (
  userId: string,
  projectId: string,
  sessionData: SessionData
) => ({
  myTool: tool({
    inputSchema: z.object({}),
    execute: async () => {
      // All context available from closure
      console.log("User:", userId);
      console.log("Project:", projectId);
      console.log("Session:", sessionData);
    },
  }),
});
```

**When to use closure pattern:**
- Data is already available in handler scope
- Data doesn't change during tool execution
- Reduces AI complexity (no need to pass parameters)
- Type-safe at compile time

**When NOT to use closure pattern:**
- Data is dynamic (user input for the tool)
- Data varies between tool calls
- Need validation/transformation of user input

---

## Summary

### What We Built

1. **Closure Pattern** ✅
   - ProjectId no longer passed as parameter
   - Captured in tool factory function scope
   - Guaranteed to always be available

2. **Explicit-Only Tool Usage** ✅
   - AI only calls tool when user explicitly requests it
   - Manual button trigger works
   - Normal chat doesn't auto-generate suggestions

3. **Debug Logging** ✅
   - Server-side logs show tool execution
   - Client-side logs show UI rendering
   - Easy to diagnose visual interface issues

4. **Team Access Support** ✅
   - Supports both user-owned and team-owned projects
   - OR query checks team membership
   - Proper authorization validation

### Non-Breaking Changes

- API stays the same externally
- Client component props unchanged
- Tool behavior improved (explicit-only)
- More reliable internally with better debugging

---

**Last Updated:** 2025-01-XX
**Pattern:** Closure-based tool context + Explicit-only usage + Debug logging
**Status:** ✅ Production-ready
