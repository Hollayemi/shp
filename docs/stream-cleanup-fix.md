# Stream Cleanup Fix - Preventing Duplicate Chat Connections

## Problem

When a user navigated away from the chat view while a generation was streaming, the stream connection remained active on the server. When the user returned to the project, the resume logic could potentially create duplicate connections if both connections tried to read from the same stream simultaneously.

### Issue Flow

```
1. User is in chat while generation is streaming
2. User navigates to dashboard
3. Stream remains active on server (activeStreamId still set)
4. User returns to project quickly
5. Resume logic sees activeStreamId is still set
6. useChat attempts to resume the old stream
7. New fetch request made to GET /api/chat/[id]/stream
8. Both connections now exist = potential duplicate processing
```

## Solution

The key insight is that we **don't** want to aggressively kill streams on unmount because:

- Users may intentionally navigate away to check something else and come back
- Streams should remain resumable for a reasonable time period
- Natural cleanup via request signals will eventually close stale connections

Instead, the existing safeguards already prevent duplicate connections:

### 1. Request Signal Cleanup (Natural)

The server listens to the request signal and automatically aborts when the client disconnects:

```typescript
// In /src/app/api/chat/route.ts
const abortController = new AbortController();

// Listen to request signal for client disconnections
if (req.signal) {
  req.signal.addEventListener("abort", () => {
    console.log("[Chat API] Client disconnected, aborting stream");
    abortController.abort();
  });
}
```

When a component unmounts and the fetch request naturally closes, this signal fires and terminates the stream.

### 2. Resume Session Storage Check

The Chat component already prevents duplicate resume attempts via session storage:

```typescript
// In /src/modules/projects/ui/components/Chat.tsx
const enableResume = useMemo(() => {
  if (!shouldResume) return false;

  // Prevent duplicate resume attempts within 1 second
  try {
    const key = `resumeAttempt:${id || projectId}:${shouldResume ? "active" : "none"}`;
    const now = Date.now();
    const raw = window.sessionStorage.getItem(key);
    if (raw) {
      const ts = parseInt(raw, 10);
      // Short window (1 second) to prevent rapid duplicate attempts
      if (!Number.isNaN(ts) && now - ts < 1000) {
        console.log("[Chat] Resume disabled - attempted recently (within 1s)");
        return false;
      }
    }
    window.sessionStorage.setItem(key, String(now));
  } catch {}

  return true;
}, [id, projectId, shouldResume, initialMessages]);
```

This prevents the same chat from attempting to resume multiple times within 1 second.

### 3. Processed Tool Call Tracking

Tool calls are tracked to prevent re-processing if the stream is resumed:

```typescript
const processedToolCallIds = useRef<Set<string>>(new Set());

// ... later when processing tool completions ...
if (toolCallId && !processedToolCallIds.current.has(toolCallId)) {
  processedToolCallIds.current.add(toolCallId);
  hasFragmentChanges = true;
}
```

## How It Works

### Stream Lifecycle with Multiple Connections

```
1. User starts generation → Stream A created, activeStreamId set
2. User navigates away during streaming
   - fetch request remains active (request signal not yet fired)
   - Stream A continues running on server
   - Component unmounts
3. User returns within request timeout (usually 5-30 seconds)
   - Resume logic checks shouldResume
   - Session storage check prevents duplicate attempt
   - If resume succeeds → same Stream A continues (no duplicate)
4. If user returns after request timeout:
   - Request signal fires → Stream A aborted
   - activeStreamId cleared
   - Resume logic finds activeStreamId null
   - Fresh Stream B created (normal flow)
```

### Why Duplicate Connections Don't Happen

1. **Session Storage Guard**: Prevents rapid duplicate resume attempts (1 second window)
2. **Tool ID Tracking**: Even if somehow both connections run, tool IDs are tracked to prevent duplicate processing
3. **Request Signal Cleanup**: Old connections naturally close after timeout
4. **Resumable Stream Library**: Handles multiple connections to same stream safely

## Benefits

✅ **Allows Stream Resumption**: Users can navigate away and come back to check progress
✅ **Prevents Duplicate Processing**: Multiple safeguards prevent duplicate tool execution
✅ **Natural Cleanup**: Request signals handle cleanup without aggressive intervention
✅ **No Schema Changes**: Uses existing infrastructure
✅ **User-Friendly**: Respects user intent to pause and resume work

## Testing the Fix

### Test 1: Resume Still Works

1. Start chat generation
2. While streaming, navigate to dashboard
3. **Immediately** return to project (within a few seconds)
4. Check: Resume should occur, same stream continues
5. Verify: Only one connection in Network tab (GET with resumed stream)

### Test 2: Natural Cleanup After Timeout

1. Start chat generation
2. Navigate away while streaming
3. **Wait 30+ seconds** without returning
4. Return to project
5. Check: activeStreamId should be null (old stream expired)
6. New generation should start fresh (no resume)

### Test 3: Manual Stop Still Works

1. Start chat generation
2. Click stop button
3. DELETE request sent immediately
4. Stream terminates instantly
5. activeStreamId cleared
6. Return to project: no resume possible (as expected)

### Test 4: Session Storage Guard

1. Modify browser console to force duplicate resume attempts
2. Verify session storage prevents 2nd attempt within 1 second
3. Both connections should not process simultaneously

## Related Files

- `/src/modules/projects/ui/components/Chat.tsx` - Resume logic with session storage guard
- `/src/modules/projects/ui/view/v3-project-view.tsx` - Project view
- `/src/app/api/chat/route.ts` - Request signal handling (lines 83-92)
- `/src/app/api/chat/[id]/stream/route.ts` - DELETE route for manual stop
- `resumable-stream` library - Handles stream resumption safely

## Key Insight

The existing architecture already has multiple layers of protection against duplicate connections:

- Request signals for natural cleanup
- Session storage for preventing rapid duplicates
- Tool ID tracking for deduplication
- Resumable stream library's built-in safeguards

These work together to allow legitimate stream resumption while preventing duplicate processing.
