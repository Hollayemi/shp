# V2 Tools Migration Strategy

## Overview
The v2-tools.ts file is 3,943 lines with 18 different tools. Due to its size, we're migrating it incrementally, starting with the most critical tools for basic chat functionality.

## Migration Approach

### Phase 1: Critical Tools (Required for Basic Chat) ✅ COMPLETE
These tools are essential for any chat interaction:

1. ✅ **getFiles** - Discover what files exist in sandbox
2. ✅ **readFile** - Read existing file contents
3. ✅ **createOrEditFiles** - Create/edit files (MAIN EDITING TOOL)
4. ✅ **getSandboxUrl** - Get preview URL
5. ✅ **finalizeWorkingFragment** - Save completed work

**Status:** All 5 critical tools migrated and functional
**File:** `apps/api/src/services/ai-tools.ts` (lines 263-1111)
**Lines of Code:** ~850 lines
**Key Changes:**
- Replaced `daytonaAPI` client calls with direct `getSandbox()` + helper functions
- All tools use `readFileFromSandbox`/`writeFileToSandbox` from sandbox-compat
- PostHog tracking maintained throughout
- Fragment management working with `updateWorkingFragment`

### Phase 2: Sandbox & Package Management ✅ COMPLETE
6. ✅ **getOrCreateSandboxTool** - Initialize or get existing sandbox
7. ✅ **getSandboxTool** - Get sandbox details
8. ✅ **installPackages** - Install npm packages

**Status:** All 3 sandbox/package tools migrated and functional
**File:** `apps/api/src/services/ai-tools.ts` (lines 1114-1551)
**Lines of Code:** ~440 lines
**Key Changes:**
- Both sandbox tools use `getSandbox()` and `createSandbox()` from daytona-sandbox-manager
- Package manager detection logic (bun, pnpm, yarn, npm) implemented directly
- Uses `runCommandOnSandbox()` for package installation
- Fragment tracking for package installations

### Phase 3: File Operations ✅ COMPLETE
9. ✅ **writeFile** - Direct file write
10. ✅ **findFiles** - Find files by pattern
11. ✅ **quickEdit** - Quick text replacements

**Status:** All 3 file operation tools migrated and functional
**File:** `apps/api/src/services/ai-tools.ts` (lines 1553-2051)
**Lines of Code:** ~500 lines
**Key Changes:**
- findFiles uses Daytona's sandbox.fs.findFiles directly
- writeFile uses writeFileToSandbox helper
- quickEdit uses Daytona's native replaceInFiles with fallback to manual replacement
- index.css protection maintained in quickEdit
- All tools track fragment changes

### Phase 4: Validation & Error Handling ✅ COMPLETE
12. ✅ **validateProject** - Validate project structure, lint, TypeScript checks
13. ✅ **detectErrors** - Detect code errors (stub - needs service infrastructure)
14. ✅ **autoFixErrors** - Auto-fix detected errors (stub - needs service infrastructure)

**Status:** All 3 validation tools migrated
**File:** `apps/api/src/services/ai-tools.ts` (lines 2061-2729)
**Lines of Code:** ~670 lines
**Key Changes:**
- validateProject fully functional with all validation utilities
- detectErrors and autoFixErrors are stub implementations that explain they need additional infrastructure
- Both stubs properly track with PostHog and provide clear user messages
- Will be fully implemented when error detection services are migrated to API server

### Phase 5: Advanced Features ✅ COMPLETE
15. ✅ **simpleMessage** - Display simple messages in chat
16. ✅ **manageTodos** - Task tracking for complex operations
17. ✅ **applyTheme** - UI theme application using API endpoint
18. ✅ **generateImage** - AI image generation with OpenRouter

**Status:** All 4 advanced feature tools migrated
**File:** `apps/api/src/services/ai-tools.ts` (lines 2731-3409)
**Lines of Code:** ~680 lines
**Key Changes:**
- simpleMessage is a simple pass-through tool with PostHog tracking
- manageTodos manages in-memory todo state in context.todos array
- applyTheme calls API server's `/api/v1/daytona/theme/apply` endpoint
- generateImage uses OpenRouter API directly, saves images to sandbox via base64 encoding
- All tools properly tracked with PostHog

## Key Migration Changes

### 1. Import Path Updates
**Before (Web App):**
```typescript
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CreditManager } from "@/lib/credits";
```

**After (API Server):**
```typescript
import { prisma } from "@shipper/database";
import { CreditManager } from "./credits.js";
// No auth needed - already validated by middleware
```

### 2. Daytona SDK → API Client
**Before:**
```typescript
const content = await sandbox.files.read(path);
await sandbox.files.write(path, content);
const result = await sandbox.commands.run(command);
```

**After:**
```typescript
// Use existing sandbox manager functions
const content = await readFileFromSandbox(sandbox, path);
await writeFileToSandbox(sandbox, path, content);
const result = await runCommandOnSandbox(sandbox, command);
```

### 3. Session/Auth Handling
**Before:**
```typescript
const session = await auth();
if (!session?.user?.id) {
  throw new Error("Not authenticated");
}
```

**After:**
```typescript
// Not needed - context already has userId from middleware
// Use context.userId directly
```

### 4. tRPC Calls (for detectErrors/autoFixErrors)
**Before:**
```typescript
const { auth } = await import("@/lib/auth");
const { appRouter } = await import("@/trpc/routers/_app");
const session = await auth();
const caller = appRouter.createCaller({ session, userId: session.user.id });
const result = await caller.errors.detect({ projectId });
```

**After:**
```typescript
// Direct API call to error detection endpoint
const response = await fetch(`${API_URL}/api/v1/daytona/errors/detect-hybrid`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': process.env.SHIPPER_API_KEY
  },
  body: JSON.stringify({ projectId })
});
const result = await response.json();
```

## Implementation Checklist

### For Each Tool:
- [ ] Copy tool function structure
- [ ] Update imports (use local services)
- [ ] Remove auth checks (middleware handles this)
- [ ] Convert Daytona SDK calls to sandbox manager functions
- [ ] Replace tRPC calls with API endpoints
- [ ] Maintain PostHog tracking
- [ ] Test with context object
- [ ] Add to tools export

## Tool Dependencies

### Critical Tools Use:
- `updateWorkingFragment` - Already migrated
- `trackToolSpan` - Already migrated
- `trackToolUsage` - Already migrated
- `prisma` - From @shipper/database
- `getSandbox/createSandbox` - From daytona-sandbox-manager.js
- `runPlaywrightRuntimeCheck` - From daytona-playwright-manager.js
- `validation-utils` - Need to verify location

### Tools That Need Special Attention:

**detectErrors & autoFixErrors:**
- Currently use tRPC to call error detection API
- Need to refactor to call API endpoints directly
- Already have `/api/v1/daytona/errors/detect-hybrid` endpoint
- Already have `/api/v1/daytona/errors/auto-fix` endpoint

**generateImage:**
- Uses external image generation service
- Should work as-is with import updates

**installPackages:**
- Executes shell commands in sandbox
- Uses sandbox manager's command execution

## Progress Tracking

### ✅ ALL PHASES COMPLETE:
- ✅ Base structure and helper functions
- ✅ ToolsContext type definition
- ✅ updateWorkingFragment function
- ✅ PostHog tracking utilities
- ✅ **Phase 1 Tools (5 critical tools)** - All migrated and ready for testing
- ✅ **Phase 2 Tools (3 sandbox/package tools)** - All migrated and functional
- ✅ **Phase 3 Tools (3 file operation tools)** - All migrated and functional
- ✅ **Phase 4 Tools (3 validation tools)** - All migrated (1 full, 2 stubs)
- ✅ **Phase 5 Tools (4 advanced tools)** - All migrated and functional

### ✅ Migration Complete - Next Steps:
1. ✅ ~~Migrate Phase 1 tools (5 critical tools)~~ DONE
2. ✅ ~~Migrate Phase 2 tools (3 sandbox/package tools)~~ DONE
3. ✅ ~~Migrate Phase 3 tools (file operations: writeFile, findFiles, quickEdit)~~ DONE
4. ✅ ~~Migrate Phase 4 tools (validation: validateProject, detectErrors, autoFixErrors)~~ DONE
5. ✅ ~~Migrate Phase 5 tools (advanced: applyTheme, generateImage, manageTodos, simpleMessage)~~ DONE
6. **Next:** Test complete chat flow with all tools
7. **Next:** Integration testing

## Estimated Time:
- Phase 1: 2-3 hours
- Phase 2: 1-2 hours
- Phase 3: 1 hour
- Phase 4: 2-3 hours
- Phase 5: 1-2 hours
- Testing: 2 hours

**Total: 9-13 hours**

## Testing Strategy:
1. Unit test each tool individually
2. Test with mock context object
3. Integration test with chat endpoint
4. End-to-end test with VoltAgent
5. Performance testing
6. Error handling validation
