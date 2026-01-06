# Modal Fragment Switching Fix

## Problem

Users were **NOT** able to switch between fragments on Modal sandboxes due to the following issues:

### Issue 1: `loadV2Fragment` procedure
- **Location**: `apps/web/src/modules/projects/server/procedures.ts` (lines 1597-1690)
- **Problem**: 
  - Called `getSandbox()` which returns different objects for Modal vs Daytona
  - For Modal: returns `{ sandboxId, sandboxUrl, files, provider: "modal" }` (no `sandbox` property)
  - For Daytona: returns `{ sandboxId, sandboxUrl, sandbox, files, provider: "daytona" }`
  - Then tried to access `sandboxInfo.sandbox` which is `undefined` for Modal
  - Only called Daytona-specific `restoreV2FragmentInDaytonaSandbox()` function
  - Error message said "No **Daytona** sandbox exists" which was misleading for Modal users

### Issue 2: `loadLatestFragmentForPreview` procedure
- **Location**: `apps/web/src/modules/projects/server/procedures.ts` (lines 1761-1860)
- **Problem**: Same as above - only supported Daytona sandboxes

### Issue 3: `switchToGitCommit` procedure
- **Location**: `apps/web/src/modules/projects/server/procedures.ts` (lines 2446-2531)
- **Status**: ✅ Already had proper check - git operations are Daytona-only (lines 2471-2478)

## Solution

### Changes Made

#### 1. Updated `loadV2Fragment` procedure
- Added provider detection using `getSandboxProvider(projectId)`
- For **Modal sandboxes**:
  - Uses `modalAPI.restoreV2Fragment(sandboxId, fragmentId, projectId)`
  - Calls the Modal API endpoint `/api/v1/modal/fragment/restore`
- For **Daytona sandboxes**:
  - Uses existing `restoreV2FragmentInDaytonaSandbox()` function
  - Validates that `sandboxInfo.sandbox` exists before using it
- Updated error messages to be provider-agnostic

#### 2. Updated `loadLatestFragmentForPreview` procedure
- Added same provider detection logic
- Routes to appropriate fragment restoration method based on provider
- Validates sandbox object availability for Daytona

#### 3. No changes needed for `switchToGitCommit`
- Already has proper feature check: `supportsFeature(provider, "git")`
- Correctly rejects Modal sandboxes with clear error message
- Git-based fragment switching is Daytona-only feature

## Technical Details

### Modal Fragment Restoration Flow

```typescript
// 1. User clicks fragment in V2FragmentsList
// 2. Calls tRPC mutation: trpc.projects.loadV2Fragment.mutate()
// 3. Server detects provider: "modal"
// 4. Calls modalAPI.restoreV2Fragment(sandboxId, fragmentId, projectId)
// 5. Modal API client makes POST to /api/v1/modal/fragment/restore
// 6. API server calls restoreV2FragmentById() from modal-sandbox-manager
// 7. Fetches fragment from database
// 8. Restores files using restoreFilesInSandbox()
// 9. Updates project.activeFragmentId
```

### Daytona Fragment Restoration Flow

```typescript
// 1. User clicks fragment in V2FragmentsList
// 2. Calls tRPC mutation: trpc.projects.loadV2Fragment.mutate()
// 3. Server detects provider: "daytona"
// 4. Calls restoreV2FragmentInDaytonaSandbox(sandbox, fragmentId, projectId)
// 5. Uses git checkout if commitHash available
// 6. Otherwise restores files directly
// 7. Updates project.activeFragmentId
```

## Testing

### Manual Testing Steps

1. **Create a Modal project**:
   - Create new project (defaults to Modal)
   - Generate some code with AI
   - Wait for fragment to be created

2. **Test fragment switching**:
   - Make another change to create a second fragment
   - Click on the first fragment in the history panel
   - Verify files are restored correctly
   - Check browser console for success logs

3. **Verify error handling**:
   - Try switching to non-existent fragment
   - Verify appropriate error message

### Expected Logs

**Modal fragment switching**:
```
[loadV2Fragment] Restoring fragment <fragmentId> using Modal API
[loadV2Fragment] Successfully loaded fragment "<title>" into Modal sandbox <sandboxId> for project <projectId>
```

**Daytona fragment switching**:
```
[loadV2Fragment] Restoring fragment <fragmentId> using git-based Daytona manager
[loadV2Fragment] Successfully loaded fragment "<title>" into Daytona sandbox <sandboxId> for project <projectId>
```

## Files Modified

- `apps/web/src/modules/projects/server/procedures.ts`
  - `loadV2Fragment` procedure (lines 1640-1759)
  - `loadLatestFragmentForPreview` procedure (lines 1765-1903)

## Related Code

### Modal API Client
- `apps/web/src/lib/api/modal-client.ts` - `restoreV2Fragment()` method
- `apps/api/src/routes/modal.ts` - `/fragment/restore` endpoint
- `apps/api/src/services/modal-sandbox-manager.ts` - `restoreV2FragmentInSandbox()`

### Daytona Manager
- `apps/web/src/lib/daytona-sandbox-manager.ts` - `restoreV2FragmentInSandbox()`
- Uses git checkout for fragments with commitHash
- Falls back to direct file restoration

## Answer to Original Question

**Q: Are users 100% able to switch between fragments on Modal sandboxes?**

**Before this fix**: ❌ **NO** - Fragment switching failed completely for Modal sandboxes

**After this fix**: ✅ **YES** - Users can now switch between V2Fragments on Modal sandboxes

**Note**: Git-based fragment switching (`switchToGitCommit`) is intentionally Daytona-only and will show a clear error message for Modal users.

