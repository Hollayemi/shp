# Abort Signal Implementation

## Overview

This document explains how abort signals are handled in the chat API to properly cancel streaming responses when users stop generation or disconnect.

## Implementation Details

### 1. Client-Side Cancellation

**Submit Button Behavior:**

The submit button dynamically changes based on generation status:

```typescript
// Button is ENABLED during streaming to allow stopping
disabled={
  status === "submitted" || status === "streaming"
    ? false  // Always enabled when generating
    : !input || hasInsufficientCredits || isOverLimit
}
```

Icons change based on status:

- **Ready**: Arrow up icon (send)
- **Submitted**: Loading spinner
- **Streaming**: Square stop icon ⏹️
- **Error**: X icon

The client uses the `useChat` hook from `@ai-sdk/react` with a `stop()` function:

```typescript
// In Chat.tsx
const { sendMessage, messages, status, stop } = useChat({
  // ... config
});

// User can stop generation by clicking the submit button while streaming
if (status === "submitted" || status === "streaming") {
  // Call stop() to abort client-side stream
  stop();

  // Also send DELETE request to notify server to cancel the stream
  fetch(`/api/chat/${projectId}/stream`, {
    method: "DELETE",
  }).catch((error) => {
    console.error("[Chat] Failed to send stop signal to server:", error);
  });

  return;
}
```

**Two-part cancellation approach:**

1. **`stop()` function**: Aborts the client-side fetch request immediately
2. **DELETE request**: Explicitly notifies the server to cancel the stream

This dual approach ensures:

- Immediate UI feedback (client stops waiting for data)
- Server cleanup (releases resources and stops AI generation)
- Redundancy (if one method fails, the other still works)

### 2. Server-Side Abort Handling

#### Main Chat Route (`/api/chat/route.ts`)

**AbortController Creation:**

```typescript
// Combines Next.js request signal with manual abort control
const abortController = new AbortController();

// Listen to request signal for client disconnections
if (req.signal) {
  req.signal.addEventListener("abort", () => {
    console.log("[Chat API] Client disconnected, aborting stream");
    abortController.abort();
  });
}
```

**Stream Setup with Abort Signal:**

```typescript
const fsdStream = streamText({
  model: openrouter(modelToUse, {
    /* ... */
  }),
  abortSignal: abortController.signal,

  // Periodically check if user cancelled via DELETE request
  onChunk: throttle(async () => {
    const project = await prisma.project.findFirst({
      where: { id: projectId },
      select: { activeStreamId: true },
    });

    // If activeStreamId is null or doesn't match, user cancelled
    if (!project?.activeStreamId || project.activeStreamId !== streamId) {
      console.log("[Chat API] Stream cancelled by user, aborting");
      abortController.abort();
    }
  }, 1000),

  // Cleanup on abort
  onAbort: () => {
    console.log("[Chat API] Stream aborted for project:", projectId);
    prisma.project
      .update({
        where: { id: projectId },
        data: { activeStreamId: null },
      })
      .catch((err) =>
        console.error(
          "[Chat API] Failed to clear activeStreamId on abort:",
          err,
        ),
      );
  },
});
```

**Execute-Level Cleanup:**

```typescript
abortController.signal.addEventListener("abort", () => {
  console.log("[Chat API] Abort signal received, cleaning up");
  prisma.project
    .update({
      where: { id: projectId },
      data: { activeStreamId: null },
    })
    .catch((err) =>
      console.error("[Chat API] Failed to clear activeStreamId on abort:", err),
    );
});
```

#### Stream DELETE Route (`/api/chat/[id]/stream/route.ts`)

Handles explicit cancellation requests from the client:

```typescript
export async function DELETE(request: Request, { params }) {
  // Auth checks...

  // Clear the active stream ID to signal cancellation
  await prisma.project.update({
    where: { id: projectId },
    data: { activeStreamId: null },
  });

  return new Response(null, { status: 200 });
}
```

## Cancellation Flow

### User-Initiated Stop

1. User clicks stop button while generation is active
2. Client calls `stop()` from `useChat` hook (aborts fetch immediately)
3. Client sends explicit DELETE request to `/api/chat/[id]/stream`
4. DELETE route clears `project.activeStreamId` in database
5. Next `onChunk` callback (runs every 1 second) detects `activeStreamId` is null
6. Server calls `abortController.abort()`
7. `onAbort` callback executes and clears `activeStreamId` again (redundant safety)
8. Stream terminates and all cleanup handlers run

**Why two cancellation methods?**

- **`stop()` alone**: Only stops client-side, server might keep running
- **DELETE alone**: Server stops but client keeps waiting
- **Both together**: Immediate client feedback + proper server cleanup ✅

### Client Disconnection

1. User closes tab/navigates away during streaming
2. Next.js detects client disconnection
3. `req.signal` fires "abort" event
4. `abortController.abort()` is called
5. Stream terminates and cleanup runs

## Key Benefits

✅ **No Database Schema Changes**: Uses existing `activeStreamId` field instead of non-existent `canceledAt`

✅ **Proper Request Signal Integration**: Leverages Next.js native `req.signal` for client disconnections

✅ **Graceful Cleanup**: Multiple cleanup handlers ensure resources are released

✅ **Race Condition Prevention**: Checks stream ID match to prevent cancelling wrong stream

✅ **Error Handling**: Try-catch blocks prevent cleanup failures from affecting other operations

## Testing Cancellation

### Manual Testing

1. **Stop Button Test:**
   - Start a chat generation
   - Click the submit button (acts as stop while streaming)
   - Verify stream stops and UI updates

2. **Tab Close Test:**
   - Start a chat generation
   - Close the browser tab
   - Check server logs for "Client disconnected" message

3. **Network Disconnect Test:**
   - Start a chat generation
   - Disable network
   - Verify stream eventually times out and cleanup runs

### Monitoring

Check server logs for these messages:

- `[Chat API] Client disconnected, aborting stream`
- `[Chat API] Stream cancelled by user, aborting`
- `[Chat API] Stream aborted for project: <projectId>`
- `[Stream DELETE] Canceling stream for project: <projectId>`

## Best Practices

1. **Always combine signals**: Use both `req.signal` and manual `AbortController` for comprehensive coverage
2. **Throttle database checks**: The `onChunk` callback is throttled to 1 second to avoid excessive DB queries
3. **Fail gracefully**: All cleanup operations use `.catch()` to prevent cascading failures
4. **Clean up thoroughly**: Multiple abort listeners ensure cleanup runs regardless of how cancellation occurs
5. **Log clearly**: Descriptive logs help debug cancellation issues

## References

- [Vercel AI SDK - Abort Signals](https://sdk.vercel.ai/docs/ai-sdk-core/cancellation)
- [MDN - AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)
- [Next.js - Request API](https://nextjs.org/docs/app/api-reference/functions/request)
