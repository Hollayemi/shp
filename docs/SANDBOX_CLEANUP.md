# Single-Sandbox-Per-User System

This document describes the **single-sandbox-per-user** architecture for managing E2B sandboxes, where each user has only one active sandbox that switches between projects.

## Overview

The app now implements a **single active sandbox per user** model that:

1. **One sandbox per user** (not per project)
2. **Project switching** automatically kills old sandbox and creates new one
3. **State restoration** from stored `Fragment.files` when switching projects  
4. **Seamless experience** - users can access any project with preserved state

## Architecture

### Database Schema
```sql
-- User model now tracks sandbox at user level
User {
  activeProjectId     String?   // Which project is currently active
  activeFragmentId    String?   // Which specific fragment is currently active
  activeSandboxId     String?   // Current active sandbox ID  
  sandboxCreatedAt    DateTime? // When sandbox was created
  sandboxLastUsedAt   DateTime? // Last time sandbox was used
}

-- Project model simplified (no sandbox tracking)
Project {
  // No sandbox fields anymore
}

-- Fragment stores project files for restoration
Fragment {
  files Json // Complete project state for recreation
}
```

### Core Functions

#### 1. `switchUserToFragment(userId, projectId, fragmentId?)`
The main function that handles fragment switching:

```typescript
import { switchUserToFragment } from "@/inngest/utils";

// Switch to specific fragment
const result = await switchUserToFragment(userId, projectId, fragmentId);

// Switch to latest fragment in project (if fragmentId omitted)
const result = await switchUserToFragment(userId, projectId);

// Returns: { sandboxId, sandboxUrl, restoredFiles }
```

**What it does:**
1. Kills any existing user sandbox
2. Gets **specific fragment's files** (or latest if no fragmentId provided)
3. Creates new sandbox with 1-hour timeout
4. Restores the exact fragment files to the sandbox
5. Updates user's active project tracking

**Note:** A compatibility function `switchUserToProject(userId, projectId)` is also available which calls `switchUserToFragment(userId, projectId)` without a fragmentId (loads latest fragment).

#### 1b. `getUserActiveFragment(userId)`
Get the current active fragment for a user:

```typescript
import { getUserActiveFragment } from "@/inngest/utils";

const activeInfo = await getUserActiveFragment(userId);
// Returns: { projectId, fragmentId, fragment? } | null
```

#### 2. `killUserActiveSandbox(userId)`
Kills the user's current active sandbox:

```typescript
import { killUserActiveSandbox } from "@/inngest/utils";

const result = await killUserActiveSandbox(userId);
// Returns: { killed: boolean, sandboxId: string | null }
```

#### 3. `getUserIdForProject(projectId)`
Gets the responsible user for a project:

```typescript
import { getUserIdForProject } from "@/inngest/utils";

const userId = await getUserIdForProject(projectId);
```

## API Endpoints

### POST `/api/switch-project`
Switch user to a specific fragment or latest project files with sandbox recreation.

**Request (specific fragment):**
```bash
curl -X POST /api/switch-project \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"projectId": "project-123", "fragmentId": "fragment-456"}'
```

**Request (latest fragment):**
```bash
curl -X POST /api/switch-project \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"projectId": "project-123"}'
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully switched to fragment fragment-456",
  "result": {
    "sandboxId": "sandbox-abc123",
    "sandboxUrl": "https://sandbox-abc123.e2b.dev",
    "restoredFiles": 15,
    "hasRestoredFiles": true,
    "fragmentId": "fragment-456",
    "activeProjectId": "project-123",
    "activeFragmentId": "fragment-456"
  }
}
```

### POST `/api/cleanup-sandboxes`
Kill user's active sandbox.

**Response:**
```json
{
  "success": true,
  "message": "Sandbox cleanup completed for user abc123",
  "results": {
    "totalProjects": 1,
    "killed": 1,
    "failed": 0,
    "killedSandboxes": ["sandbox-abc123"],
    "failedSandboxes": []
  }
}
```

### GET `/api/cleanup-sandboxes`
Check user's current sandbox status.

**Response:**
```json
{
  "userId": "user-abc123",
  "activeSandboxes": 1,
  "currentSandbox": {
    "sandboxId": "sandbox-abc123",
    "projectId": "project-456",
    "projectName": "My Airbnb Clone",
    "createdAt": "2024-01-01T00:00:00Z",
    "lastUsedAt": "2024-01-01T12:00:00Z"
  }
}
```

## Updated AI Agent Flow

The `codeAgent` function now uses the new flow:

```typescript
// OLD: Per-project sandbox management
const sandboxId = await step.run("get-or-create-sandbox", async () => {
  // Complex per-project logic...
});

// NEW: Single-sandbox-per-user with project switching
const { sandboxId, sandboxUrl } = await step.run("switch-user-to-project", async () => {
  const userId = await getUserIdForProject(projectId);
  return await switchUserToProject(userId, projectId);
});
```

## CLI Management

### Usage Examples

```bash
# List all users with active sandboxes
pnpm tsx scripts/cleanup-user-sandboxes.ts --list

# Clean up specific user's sandbox
pnpm tsx scripts/cleanup-user-sandboxes.ts user-abc123

# Clean up ALL users' sandboxes
pnpm tsx scripts/cleanup-user-sandboxes.ts --all
```

### Sample Output

```
📊 Found 3 users with active sandboxes:
================================================================================

👤 John Doe (john@example.com)
   User ID: user-abc123
   Active sandbox: sandbox-def456
   Active project: project-789
   Created: 2024-01-01T10:00:00.000Z
   Last used: 2024-01-01T12:30:00.000Z
```

## Benefits

### 🚀 **Performance Benefits**
- **Reduced Resource Usage**: Only 1 sandbox per user vs N sandboxes per user
- **Faster Switching**: Immediate project access after initial restoration
- **Cost Effective**: Minimal E2B sandbox consumption

### 🔄 **User Experience Benefits** 
- **Seamless Project Navigation**: Switch between projects instantly
- **State Preservation**: Full project state restored from stored files
- **No Context Loss**: Complete development environment recreated

### 🛠️ **Developer Benefits**
- **Simplified Architecture**: Single source of truth for user sandboxes
- **Easier Debugging**: Clear user→sandbox relationship
- **Better Monitoring**: Track exactly which project each user is working on

## Migration Notes

### Database Changes
- **Moved** sandbox tracking from `Project` to `User` model
- **Added** `activeProjectId` to track current user project
- **Preserved** `Fragment.files` for project state restoration

### API Changes
- **New** `/api/switch-project` endpoint for project switching
- **Updated** `/api/cleanup-sandboxes` for single-sandbox model
- **Enhanced** logging and monitoring capabilities

### Backward Compatibility
- **Legacy** `killAllUserSandboxes()` function maintained for existing scripts
- **Graceful** handling of projects without stored files
- **Safe** migration with data preservation

## Error Handling

The system handles various scenarios gracefully:

1. **Dead Sandboxes**: Automatically cleaned up and recreated
2. **Missing Files**: Projects without fragments handled safely  
3. **Permission Errors**: Proper access control for team projects
4. **Network Issues**: Resilient retry logic for E2B operations

## Future Enhancements

- **Sandbox Templates**: Different templates per project type
- **Resource Limits**: Per-user sandbox quotas and monitoring
- **Auto-Cleanup**: Time-based sandbox expiration
- **Collaboration**: Real-time multi-user project sharing 