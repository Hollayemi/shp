# Code Quality Fixes - Visual Editing System

This document summarizes the code quality improvements made to address feedback from the Gemini code assist bot.

## Changes Made

### 1. Extracted Magic Number to Shared Constant
**File:** `apps/web/src/modules/projects/server/procedures.ts`

**Issue:** The value `20` for `contextLines` was hardcoded in multiple places (both in `applyDirectVisualEdit` and `undoComponentEdit` procedures).

**Fix:** 
- Created a shared constant `COMPONENT_SNAPSHOT_CONTEXT_LINES = 20` at the top of the file
- Replaced all hardcoded `20` values with this constant
- Improves maintainability and ensures consistency across procedures

### 2. Improved Type Safety for Where Clause
**File:** `apps/web/src/modules/projects/server/procedures.ts`

**Issue:** The `where` clause in `getComponentEditHistory` was typed as `any`, bypassing TypeScript's type safety.

**Fix:**
- Imported `Prisma` from `@/lib/db`
- Changed type from `any` to `Prisma.ComponentEditMetadataWhereInput`
- Provides better autocompletion and prevents potential runtime errors

### 3. Standardized Timestamp Format
**File:** `apps/web/src/modules/projects/server/procedures.ts`

**Issue:** Using `new Date().toLocaleString()` for timestamps can lead to inconsistencies as output depends on server locale.

**Fix:**
- Replaced all `toLocaleString()` calls with `toISOString()` in:
  - `applyDirectVisualEdit` procedure (snapshot fragment creation)
  - `undoComponentEdit` procedure (reverted fragment creation)
  - `applyBatchedVisualEdits` procedure (batch snapshot creation)
- Ensures consistent, standardized ISO 8601 format timestamps

### 4. Fixed File Path Resolution in Edit History Query
**File:** `apps/web/src/modules/projects/ui/components/VisualEditingPanel.tsx`

**Issue:** The `filePath` parameter was being set to `element.selector` (a CSS selector), not an actual file path. This caused the query to fail.

**Fix:**
- Added state to track resolved file path: `const [filePath, setFilePath] = useState<string | null>(null)`
- Added `useEffect` to asynchronously resolve the file path using the provided `resolveFilePath` prop
- Modified the query to use the resolved `filePath` and only enable when available: `enabled: !!filePath`
- Ensures the backend receives a valid file path for database queries

### 5. Improved Date Display Consistency
**File:** `apps/web/src/modules/projects/ui/components/VisualEditingPanel.tsx`

**Issue:** Using `toLocaleString()` for displaying dates can result in different formats depending on user locale.

**Fix:**
- Replaced `toLocaleString()` with `toLocaleDateString()` with specific formatting options
- Format: `{ month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }`
- Provides more consistent and predictable UI display (e.g., "Dec 4, 02:30 PM")

### 6. Replaced Fragile setTimeout with Proper Refresh Logic
**File:** `apps/web/src/modules/projects/ui/view/v3-project-view.tsx`

**Issue:** Using a fixed `setTimeout(1000)` to refresh preview after undo is fragile - delay might be too short on slow systems or too long on fast ones.

**Fix:**
- Replaced `setTimeout` with call to `refreshPreview({ skipHealthCheck: true })`
- Uses existing robust refresh mechanism that handles sandbox state and recovery
- The `skipHealthCheck` option ensures quick refresh without unnecessary loading states
- More reliable and responsive user experience

## Benefits

1. **Better Maintainability:** Shared constants and proper types make code easier to maintain
2. **Type Safety:** Proper TypeScript types catch errors at compile time
3. **Consistency:** Standardized timestamps and date formats across the application
4. **Reliability:** Proper async handling and state-aware refresh logic
5. **User Experience:** More predictable behavior and consistent UI display

## Testing Recommendations

1. Test visual editing undo/redo functionality
2. Verify edit history displays correctly with proper file paths
3. Check that timestamps are consistent across different locales
4. Ensure preview refresh works reliably after undo operations
5. Validate that all TypeScript types compile without errors
