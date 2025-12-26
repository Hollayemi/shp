# Tailwind CSS Cache Fix for Sandbox Recreation

**Date**: 2025-01-17  
**Status**: ✅ Fixed

## Problem

When a sandbox times out and is recreated from a snapshot/fragment, Tailwind CSS styles would sometimes appear stale or revert to default styles (e.g., icons changing from blue back to black). This occurred even though the source files were correctly restored.

### Root Cause

The issue was caused by Vite's build cache (`node_modules/.vite`) being cleared on dev server startup, but **Tailwind CSS v4's internal cache not being properly invalidated**. Here's what was happening:

1. User makes style changes (e.g., blue icons)
2. Sandbox times out after inactivity
3. New sandbox is created and fragment files are restored
4. Dev server starts with `rm -rf node_modules/.vite` to prevent "Outdated Optimize Dep" errors
5. **Vite cache is cleared, but Tailwind CSS doesn't detect file changes**
6. Tailwind CSS serves stale/cached styles instead of regenerating from the restored files

### Why This Happens

Tailwind CSS v4 uses the `@tailwindcss/vite` plugin which processes CSS at build time. When files are restored but their modification times aren't updated, Tailwind may not detect that it needs to rebuild the CSS. The cache clearing only affected Vite's dependency optimization cache, not Tailwind's CSS generation.

## Solution

Force Tailwind CSS to rebuild by **touching the main CSS file** (`src/index.css` or `src/App.css`) before starting the dev server. This updates the file's modification time, triggering Tailwind to rescan all source files and regenerate the CSS.

### Implementation

Updated dev server startup in both Modal and Daytona sandbox managers:

**Before:**
```bash
rm -rf node_modules/.vite && bun vite --host 0.0.0.0 --port 5173
```

**After:**
```bash
rm -rf node_modules/.vite && \
touch src/index.css 2>/dev/null || touch src/App.css 2>/dev/null || true && \
bun vite --host 0.0.0.0 --port 5173
```

### Files Modified

1. **apps/api/src/services/modal-sandbox-manager.ts**
   - Line ~808: Dev server startup in `createSandbox()`
   - Line ~2026: Dev server startup in `startDevServer()`

2. **apps/api/src/services/daytona-sandbox-manager.ts**
   - Line ~609: Dev server startup in `createSandbox()`
   - Line ~1810: Dev server startup in `startDevServer()`

3. **apps/web/src/lib/daytona-sandbox-manager.ts**
   - Line ~624: Dev server startup in `createSandbox()`
   - Line ~1798: Dev server startup in `startDevServer()`

## Technical Details

### Tailwind CSS v4 Architecture

- Uses `@tailwindcss/vite` plugin for seamless Vite integration
- CSS-first configuration with `@import "tailwindcss";` in CSS files
- Zero-configuration content detection (automatically finds template files)
- Built-in Lightning CSS for processing

### Why `touch` Works

The `touch` command updates the file's modification time without changing its content. This triggers:

1. Vite's file watcher to detect a change
2. Tailwind CSS plugin to invalidate its cache
3. Full CSS regeneration by scanning all source files
4. Proper style application in the browser

### Fallback Strategy

The command uses fallback logic to handle different project structures:

```bash
touch src/index.css 2>/dev/null || touch src/App.css 2>/dev/null || true
```

- First tries `src/index.css` (most common)
- Falls back to `src/App.css` (alternative location)
- `|| true` ensures the command doesn't fail if neither file exists

## Testing

To verify the fix:

1. Create a project with custom Tailwind styles (e.g., blue icons)
2. Wait for sandbox to timeout or manually terminate it
3. Return to the project (triggers sandbox recreation)
4. Verify that custom styles are correctly applied (icons should be blue, not default black)

## Related Issues

- Vite "Outdated Optimize Dep" errors (already fixed with cache clearing)
- Fragment restoration and file state management
- Sandbox health monitoring and automatic recovery

## Future Improvements

Consider:

1. Adding explicit Tailwind cache directory clearing if needed
2. Monitoring Tailwind build logs for cache-related warnings
3. Implementing a more robust cache invalidation strategy for all build tools

