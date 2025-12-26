# Chat API Setup Guide

This guide explains how to set up and use the standalone Chat API server with the web application.

## Architecture Overview

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│                 │      │                  │      │                 │
│   Chat UI       │─────▶│  Chat Proxy      │─────▶│  API Server     │
│   Component     │      │  (Next.js)       │      │  (Express)      │
│                 │      │                  │      │                 │
└─────────────────┘      └──────────────────┘      └─────────────────┘
      Browser              /api/chat-proxy          /api/v1/chat
                          (adds auth token)         (processes request)
```

### Components

1. **Chat UI Component** (`apps/web/src/modules/projects/ui/components/Chat.tsx`)
   - React component using Vercel AI SDK's `useChat` hook
   - Sends requests to `/api/chat-proxy`
   - Handles streaming responses, tool calls, and UI updates

2. **Chat Proxy** (`apps/web/src/app/api/chat-proxy/route.ts`)
   - Next.js API route that proxies requests
   - Extracts NextAuth session token from HTTP-only cookies
   - Forwards authenticated requests to API server
   - Streams responses back to the client

3. **API Server** (`apps/api/src/routes/chat.ts`)
   - Standalone Express server handling chat processing
   - Validates session tokens
   - Manages AI streaming with all 18 tools
   - Handles fragments, sandbox, credits, and analytics

## Environment Variables

### Web App (`apps/web/.env.local`)

```bash
# API Server URL - Where the chat proxy forwards requests
API_SERVER_URL=http://localhost:4000
NEXT_PUBLIC_API_URL=http://localhost:4000

# NextAuth Configuration (existing)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here

# Database (shared between web and API)
DATABASE_URL=postgresql://...

# OpenRouter API Key (needed for AI models)
OPENROUTER_API_KEY=your-openrouter-key
```

### API Server (`apps/api/.env`)

```bash
# Database Connection
DATABASE_URL=postgresql://...

# OpenRouter API Key (for AI models)
OPENROUTER_API_KEY=your-openrouter-key

# Daytona Configuration
DAYTONA_API_KEY=your-daytona-key
DAYTONA_API_URL=https://api.daytona.io  # Optional, uses default if not set

# Server Configuration
PORT=4000
NODE_ENV=development

# Optional: PostHog Analytics
POSTHOG_PROJECT_API_KEY=your-posthog-key
POSTHOG_HOST=https://app.posthog.com

# Optional: Shared API Key (for additional security)
SHIPPER_API_KEY=your-shared-secret
```

## Development Setup

### 1. Start the API Server

```bash
cd apps/api
pnpm install
pnpm dev
```

The API server will start on `http://localhost:4000`.

### 2. Start the Web App

```bash
cd apps/web
pnpm install
pnpm dev
```

The web app will start on `http://localhost:3000`.

### 3. Verify Setup

Check that both services are running:

```bash
# Check API server health
curl http://localhost:4000/health

# Check chat API health
curl http://localhost:4000/api/v1/chat/health

# Check proxy health (requires authentication)
curl http://localhost:3000/api/chat-proxy
```

## How It Works

### 1. User Sends Message

```typescript
// In Chat.tsx
const { sendMessage } = useChat({
  transport: new DefaultChatTransport({
    api: "/api/chat-proxy",  // ← Goes to Next.js proxy
    prepareSendMessagesRequest: ({ messages }) => {
      const lastMessage = messages[messages.length - 1];
      return {
        body: {
          message: lastMessage,
          projectId,
        },
      };
    },
  }),
});
```

### 2. Proxy Adds Authentication

```typescript
// In /api/chat-proxy/route.ts
const sessionToken = cookieStore.get("next-auth.session-token")?.value;

const response = await fetch(`${API_SERVER_URL}/api/v1/chat`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${sessionToken}`,  // ← Session token added
  },
  body: JSON.stringify(body),
});
```

### 3. API Server Processes Request

```typescript
// In apps/api/src/routes/chat.ts
1. Validate session token
2. Load project and check access
3. Analyze complexity and deduct credits
4. Load chat history and fragment files
5. Initialize sandbox
6. Stream AI response with tools
7. Save messages and update fragments
```

### 4. Response Streams Back

```
API Server → SSE Events → Proxy → Client

Events:
- text-delta: AI response chunks
- tool-call: Tool invocations
- tool-result: Tool results
- finish: Completion with usage stats
- error: Error messages
```

## Testing

### Test Proxy Connection

```typescript
// In browser console or test file
fetch('/api/chat-proxy', {
  method: 'GET',
  credentials: 'include',
})
  .then(r => r.json())
  .then(console.log);
```

Expected response:
```json
{
  "success": true,
  "message": "Chat proxy is healthy",
  "apiServer": "http://localhost:4000",
  "apiHealth": {
    "status": "ok",
    "timestamp": "2025-01-15T12:00:00.000Z",
    "service": "chat"
  }
}
```

### Test Chat Flow

1. Sign in to the web app
2. Create a new project
3. Send a message in the chat
4. Verify streaming works
5. Check tool calls execute
6. Confirm messages are saved

### Debug Logs

The system provides comprehensive logging:

```bash
# API Server logs
[Chat] Starting chat session for user user@example.com, project abc-123
[Chat] Analyzing prompt complexity
[Chat] Deducted 10 credits for moderate task
[Chat] Loading active fragment xyz-789
[Chat] Using model: @preset/full-stack-devloper
[Tool Start] readFile - call-123
[Tool Finish] readFile - call-123
[Chat] Session completed for project abc-123

# Web App logs
[Chat] Initial messages updated: { count: 5 }
[Chat] AI generation finished - refreshing fragments
[Tool Start] createOrEditFiles - call-456
```

## Troubleshooting

### Error: "Authentication required"

**Cause:** Session token not found or invalid

**Fix:**
1. Ensure user is signed in
2. Check NextAuth configuration
3. Verify DATABASE_URL is correct
4. Clear cookies and sign in again

### Error: "API server not healthy"

**Cause:** API server not running or not reachable

**Fix:**
1. Start API server: `pnpm dev:api`
2. Check API_SERVER_URL in web app `.env.local`
3. Verify API server is listening on correct port
4. Check firewall/network settings

### Error: "Insufficient credits"

**Cause:** User has insufficient credit balance

**Fix:**
1. Add credits to user account in database
2. Purchase credits through the app
3. Check credit deduction logic in complexity analyzer

### Streaming Not Working

**Cause:** Response not being streamed properly

**Fix:**
1. Check that proxy returns `text/event-stream` content type
2. Verify API server SSE implementation
3. Check browser console for connection errors
4. Ensure no middleware is buffering the response

### Tools Not Executing

**Cause:** Tools not properly integrated or context missing

**Fix:**
1. Verify all 18 tools are exported in `ai-tools.ts`
2. Check tools context has required fields (sandbox, projectId, etc.)
3. Review tool execution logs in API server
4. Ensure Daytona sandbox is created and accessible

## Production Deployment

### Environment Configuration

1. **Web App:**
   - Set `API_SERVER_URL` to production API server URL
   - Use HTTPS for all URLs
   - Set `NODE_ENV=production`

2. **API Server:**
   - Set `NODE_ENV=production`
   - Use production database
   - Configure CORS for webapp domain
   - Set up rate limiting
   - Enable API monitoring

### Security Considerations

1. **Session Security:**
   - Use secure cookies (`__Secure-` prefix)
   - Set `sameSite: "strict"` or `"lax"`
   - Enable HTTPS only
   - Set appropriate cookie expiration

2. **API Security:**
   - Validate all session tokens
   - Implement rate limiting
   - Add request timeouts
   - Monitor for abuse

3. **CORS Configuration:**
   - Restrict to webapp domain only
   - Don't use wildcard origins
   - Include credentials in CORS policy

### Monitoring

Monitor these metrics:

1. **Performance:**
   - Request latency
   - Streaming throughput
   - Tool execution time
   - Database query performance

2. **Errors:**
   - Authentication failures
   - API server errors
   - Tool execution failures
   - Timeout errors

3. **Usage:**
   - Messages per user
   - Credits consumed
   - Tool usage distribution
   - Peak load times

## Migration from Old System

If migrating from the old in-webapp chat API:

1. **Code Changes:**
   - Update chat component to use `/api/chat-proxy`
   - No other client code changes needed

2. **Database:**
   - No schema changes required
   - Existing messages and fragments work as-is

3. **Testing:**
   - Test all 18 tools work correctly
   - Verify fragment management
   - Confirm credit deduction
   - Check sandbox integration

4. **Rollback:**
   - Change `/api/chat-proxy` back to `/api/chat`
   - Old system continues to work

## Additional Resources

- [API Server Documentation](../api/README.md)
- [Daytona Migration Guide](./DAYTONA_MIGRATION_COMPLETE.md)
- [Migration Progress](./MIGRATION_PROGRESS.md)
- [V2 Tools Documentation](./V2_TOOLS_MIGRATION_STRATEGY.md)
