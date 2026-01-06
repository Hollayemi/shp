# Project-Scoped Logging in API Server

This document describes how to use project-scoped logging in the API server to filter logs by project ID.

## Overview

The API server now includes automatic project-scoped logging that attaches `projectId` to all log entries. This makes it easy to filter logs for specific projects during debugging and monitoring.

**Routes with project logging enabled:**

- `/api/v1/modal/*` - All Modal sandbox operations
- `/api/v1/chat` - AI chat with streaming responses
- `/api/v1/daytona/errors/*` - Error detection and auto-fix

## How It Works

### Middleware

The `projectContextMiddleware` automatically extracts `projectId` from:

1. URL parameters (e.g., `/api/v1/modal/sandbox/:projectId`)
2. Request body (e.g., `{ projectId: "..." }`)
3. Query parameters (e.g., `?projectId=...`)

When a `projectId` is found, the middleware creates a child logger with the project context and attaches it to `req.logger`.

### Automatic Inclusion

Once the middleware is applied, every log entry will automatically include the `projectId` field:

```typescript
// In your route handler
req.logger?.info("Creating sandbox");

// Output:
// {"level":"info","projectId":"project-123","msg":"Creating sandbox"}
```

## Usage in Routes

### Basic Logging

```typescript
router.post("/sandbox", async (req: Request, res: Response) => {
  const { projectId } = req.body;

  // Info log - automatically includes projectId
  req.logger?.info("Creating Modal sandbox");

  // Log with additional context
  req.logger?.info({
    msg: "Sandbox created successfully",
    sandboxId: "sandbox-456",
  });

  // Warning log
  req.logger?.warn("Sandbox not found");

  // Error log
  req.logger?.error({
    msg: "Failed to create sandbox",
    error: error.message,
  });
});
```

### Example Output

**Modal endpoint:**

```json
{
  "level": "info",
  "projectId": "project-abc123",
  "msg": "Creating Modal sandbox",
  "time": 1234567890
}
```

**Chat endpoint:**

```json
{
  "level": "info",
  "projectId": "project-abc123",
  "msg": "Starting chat session",
  "requestId": "req-xyz789",
  "userId": "user-456",
  "userEmail": "user@example.com",
  "time": 1234567890
}
```

**Error detection:**

```json
{
  "level": "info",
  "projectId": "project-abc123",
  "msg": "Error detection complete",
  "totalErrors": 5,
  "analysisType": "hybrid",
  "time": 1234567890
}
```

## Filtering Logs by Project

### Development (with pino-pretty)

During development, logs are human-readable:

```
[10:30:45] INFO (projectId: project-123): Creating Modal sandbox
[10:30:46] INFO (projectId: project-123): Sandbox created successfully
    sandboxId: "sandbox-456"
```

### Production (JSON format)

In production, logs are in JSON format. Filter by project using standard tools:

```bash
# Filter by specific project
cat api.log | grep '"projectId":"project-123"'

# Using jq for better filtering
cat api.log | jq 'select(.projectId == "project-123")'

# Filter by project and level
cat api.log | jq 'select(.projectId == "project-123" and .level == "error")'
```

## Creating Project-Scoped Loggers Manually

If you need to create a logger manually (e.g., in a service that doesn't have access to `req`):

```typescript
import { createProjectLogger } from "../config/logger.js";

const projectLogger = createProjectLogger("project-123", {
  service: "modal-sandbox",
});

projectLogger.info("Processing sandbox operation");
// Output: {"projectId":"project-123","service":"modal-sandbox","msg":"Processing sandbox operation"}
```

## Best Practices

1. **Always use `req.logger`** in route handlers - it automatically includes project context
2. **Use structured logging** with objects for additional context:
   ```typescript
   req.logger?.info({
     msg: "Operation completed",
     duration: "120ms",
     recordsProcessed: 42,
   });
   ```
3. **Choose appropriate log levels**:
   - `info` - Normal operations
   - `warn` - Unexpected but handled situations
   - `error` - Errors that need attention
4. **Include relevant context** in error logs:
   ```typescript
   req.logger?.error({
     msg: "Database query failed",
     query: "SELECT * FROM ...",
     error: error.message,
   });
   ```

## Log Levels

The logger respects the `LOG_LEVEL` environment variable:

- `debug` - Detailed debugging info
- `info` - General informational messages (default)
- `warn` - Warning messages
- `error` - Error messages
- `fatal` - Fatal errors (process should exit)

Set in your `.env`:

```
LOG_LEVEL=info
```

## Rate Limiting (Production)

In production, the logger is throttled to 500 logs/second to prevent overwhelming the log system during high-traffic scenarios.

## TypeScript Types

The Express Request object is extended with:

```typescript
interface Request {
  logger?: Logger; // Pino logger instance with project context
  projectId?: string; // Extracted project ID
}
```

Both are optional and will be undefined if:

- No projectId is found in the request
- The middleware hasn't run yet
