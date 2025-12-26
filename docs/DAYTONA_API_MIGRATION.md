# Daytona API Migration Guide

This document describes the migration of Daytona functionality from the webapp to the standalone API server.

## Overview

All Daytona SDK functionality has been migrated to the API server (`apps/api`). The webapp now communicates with Daytona through REST API endpoints instead of using the SDK directly.

## Architecture

### Before Migration
```
Webapp (apps/web)
  └─> @daytonaio/sdk (direct SDK usage)
      └─> Daytona Cloud
```

### After Migration
```
Webapp (apps/web)
  └─> API Client (HTTP)
      └─> API Server (apps/api)
          └─> @daytonaio/sdk
              └─> Daytona Cloud
```

## Benefits

1. **Separation of Concerns**: Sandbox management logic is centralized in the API
2. **Better Security**: Daytona API keys only needed on the API server
3. **Easier Testing**: API endpoints can be tested independently
4. **Scalability**: API can be deployed separately and scaled independently
5. **Reusability**: Other clients can use the same API endpoints

## API Endpoints

All endpoints are prefixed with `/api/v1/daytona`:

### Sandbox Management

- `GET /sandbox/:projectId` - Get sandbox information for a project
- `POST /sandbox` - Create a new sandbox
  ```json
  {
    "projectId": "string",
    "fragmentId": "string?",
    "templateName": "string?"
  }
  ```
- `POST /sandbox/start` - Start a sandbox
  ```json
  { "sandboxId": "string" }
  ```
- `POST /sandbox/dev-server` - Start dev server in sandbox
  ```json
  {
    "projectId": "string",
    "sandboxId": "string"
  }
  ```
- `DELETE /sandbox/:sandboxId` - Delete a sandbox

### Fragment & Git Operations

- `POST /fragment/restore` - Restore a V2 fragment in sandbox
  ```json
  {
    "sandboxId": "string",
    "fragmentId": "string",
    "projectId": "string"
  }
  ```
- `POST /git/commit` - Create a git commit
  ```json
  {
    "sandboxId": "string",
    "projectId": "string",
    "message": "string",
    "email": "string",
    "name": "string"
  }
  ```
- `POST /git/switch` - Switch to a git commit
  ```json
  {
    "sandboxId": "string",
    "projectId": "string",
    "commitHash": "string"
  }
  ```
- `POST /files/restore` - Restore files in sandbox
  ```json
  {
    "sandboxId": "string",
    "files": { "path": "content" }
  }
  ```

### File Operations

- `POST /command/execute` - Execute a command in sandbox
  ```json
  {
    "sandboxId": "string",
    "command": "string",
    "timeoutMs": "number?"
  }
  ```
- `POST /file/read` - Read a file from sandbox
  ```json
  {
    "sandboxId": "string",
    "path": "string"
  }
  ```
- `POST /file/write` - Write a file to sandbox
  ```json
  {
    "sandboxId": "string",
    "path": "string",
    "content": "string"
  }
  ```

### Playwright Operations

- `POST /playwright/check` - Run Playwright runtime check
  ```json
  {
    "targetUrl": "string",
    "sandboxId": "string?",
    "maxRetries": "number?"
  }
  ```
- `DELETE /playwright/cleanup` - Cleanup Playwright sandbox
- `GET /playwright/status` - Get Playwright sandbox status

## Using the API Client

### Import

```typescript
import { daytonaAPI } from "@/lib/api/daytona-client";
```

### Examples

#### Get Sandbox
```typescript
const sandboxInfo = await daytonaAPI.getSandbox(projectId);
if (sandboxInfo) {
  console.log(`Sandbox URL: ${sandboxInfo.sandboxUrl}`);
}
```

#### Create Sandbox
```typescript
const sandboxInfo = await daytonaAPI.createSandbox(
  projectId,
  fragmentId,
  "vite-template-v4"
);
```

#### Execute Command
```typescript
const result = await daytonaAPI.executeCommand(
  sandboxId,
  "npm run build",
  { timeoutMs: 60000 }
);
console.log(result.stdout);
```

#### File Operations
```typescript
// Read file
const content = await daytonaAPI.readFile(sandboxId, "src/App.tsx");

// Write file
await daytonaAPI.writeFile(sandboxId, "src/App.tsx", newContent);
```

#### Run Playwright Check
```typescript
const errors = await daytonaAPI.runPlaywrightCheck(
  "https://preview-url.shipper.now"
);
console.log(`Found ${errors.totalErrors} runtime errors`);
```

## Migration Checklist

To complete the migration in the webapp, update these files:

- [ ] `apps/web/src/modules/projects/server/procedures.ts` - Update tRPC procedures
- [ ] `apps/web/src/modules/errors/server/procedures.ts` - Update error detection
- [ ] `apps/web/src/app/api/errors/auto-fix/route.ts` - Update auto-fix route
- [ ] `apps/web/src/app/api/errors/detect/[projectId]/route.ts` - Update detect route
- [ ] `apps/web/src/app/api/chat/route.ts` - Update chat route
- [ ] `apps/web/src/app/api/hal-chat/suggestions/route.ts` - Update HAL chat
- [ ] `apps/web/src/lib/ai/v2-tools.ts` - Update AI tools

After updating all files:

- [ ] Remove `@daytonaio/sdk` from webapp dependencies
- [ ] Delete Daytona files from webapp:
  - `apps/web/src/lib/daytona.ts`
  - `apps/web/src/lib/daytona-sandbox-manager.ts`
  - `apps/web/src/lib/ai/daytona-playwright-manager.ts`
  - `apps/web/src/lib/ai/sandbox-compat.ts`
  - `apps/web/src/lib/ai/validation-utils.ts`

## Environment Variables

### API Server
- `DAYTONA_API_KEY` - Daytona API key (required)
- `DAYTONA_API_URL` - Custom Daytona API URL (optional, defaults to https://api.daytona.io)

### Webapp
- `NEXT_PUBLIC_API_URL` - URL of the API server (e.g., http://localhost:4000)

## Testing

1. Start the API server: `pnpm dev:api`
2. Start the webapp: `pnpm dev:web`
3. Test sandbox operations through the webapp UI
4. Verify all Daytona functionality works through the API

## Rollback Plan

If issues arise during migration:

1. The original Daytona files are still present in the webapp
2. Simply revert the import changes in the affected files
3. The API server changes are additive and don't affect the webapp

## Files Migrated to API

### Service Layer (`apps/api/src/services/`)
- `daytona.ts` - Daytona client configuration
- `daytona-sandbox-manager.ts` - Main sandbox management (90KB)
- `sandbox-compat.ts` - Compatibility layer for command execution
- `daytona-playwright-manager.ts` - Playwright integration (14KB)
- `validation-utils.ts` - Project validation utilities
- `types.ts` - Shared TypeScript types

### Routes (`apps/api/src/routes/`)
- `daytona.ts` - REST API endpoints for all Daytona operations

### Client (`apps/web/src/lib/api/`)
- `daytona-client.ts` - HTTP client for communicating with API

## Performance Considerations

- **Network Latency**: API calls add HTTP overhead. Consider batching operations where possible.
- **Error Handling**: API client includes proper error handling and retries can be added if needed.
- **Caching**: Consider implementing caching for frequently accessed sandbox information.

## Future Improvements

1. Add WebSocket support for streaming command output
2. Implement request batching for multiple operations
3. Add API authentication/authorization
4. Implement rate limiting
5. Add comprehensive API documentation (OpenAPI/Swagger)
6. Add API versioning strategy
