# Monitor Script Injection Feature

## Overview

This feature allows admins to inject comprehensive monitoring and visual editing capabilities into any sandbox project via the admin panel. The monitoring script is the same one used in the shipper-vite-template and includes full Visual Editor support.

## Purpose

The monitor script provides:

### Monitoring Features
- **Runtime Error Tracking**: Captures JavaScript errors and unhandled promise rejections
- **Resource Load Error Detection**: Detects failed script, image, and stylesheet loads
- **Network Monitoring**: Tracks all fetch requests with timing and response data
- **Console Output Capture**: Captures console.log, console.warn, and console.error calls
- **Navigation Tracking**: Monitors URL changes in single-page applications
- **Content Load Detection**: Detects when React content is loaded and rendered
- **Blank Screen Detection**: Identifies when the app fails to render

### Visual Editor Features
- **Element Selection**: Click to select any element with visual highlighting
- **Repeated Element Support**: Automatically detects and highlights all instances of repeated elements (e.g., from .map())
- **Style Inspection**: View computed styles, Tailwind classes, and inline styles
- **Real-time Style Editing**: Apply style changes that update instantly in the preview
- **Text Content Editing**: Modify text content directly through the visual editor
- **Smart Element Identification**: Uses data-shipper-id, XPath, and CSS selectors for robust element targeting

## How to Use

### Via Admin Panel

1. Navigate to `/admin/projects`
2. Click on a project to view details
3. Go to the "Sandbox & Dev Server" tab
4. Ensure the sandbox is active (start it if needed)
5. Click the "Inject Monitor Script" button in the "Monitor Script Injection" card

### What Happens

The system will:
1. Generate the monitor script using `generateMonitorScript()` from `@shipper/shared`
2. Check if the script is already injected (prevents duplicates)
3. Read the sandbox's `/workspace/index.html` file
4. Inject the script before the `</head>` or `</body>` tag
5. Write the updated HTML back to the sandbox

### After Injection

- The monitoring script will be active on the next page load
- You may need to restart the dev server for changes to take effect
- The script will automatically initialize and start tracking events
- Events are sent to the parent window via `postMessage` API
- Visual editor can be enabled/disabled via postMessage commands

## Technical Details

### Source of Truth

**Template Location**: `/home/browe/dev/shipper-vite-template/.shipper/monitor.js`

**Shared Package**: `packages/shared/src/lib/sandbox-monitor.ts`

The monitor script in the shared package is kept in sync with the template version to ensure consistency across all sandboxes.

### Backend API

**Procedure**: `admin.injectMonitorScript`

**Location**: `apps/web/src/modules/admin/server/procedures.ts:2654`

**Input**:
```typescript
{
  projectId: string
}
```

**Output**:
```typescript
{
  success: boolean
  message: string
  alreadyInjected: boolean
}
```

**Supports**: Both Modal and Daytona sandbox providers

### Frontend UI

**Component**: `AdminProjectDetailClient`

**Location**: `apps/web/src/app/admin/projects/[projectId]/AdminProjectDetailClient.tsx`

**Mutation Hook**: `injectMonitorMutation`

**Handler**: `handleInjectMonitor()`

### Monitor Script Functions

**Generator Function**: `generateMonitorScript(allowedOrigins: string[])`

**Helper Functions**:
- `createMonitorScriptTag()` - Wraps script in a script tag
- `injectMonitoringScript()` - Injects script into HTML content

**Configuration**:
- Allowed origins: `NEXT_PUBLIC_APP_URL` and `https://app.shipper.now`
- Debounce delay: 250ms
- Max string length: 10000 characters
- Highlight color: #3b82f6 (blue)
- Visual edit enabled by default: false (can be enabled via postMessage)

## Event Types

The monitor script emits the following event types via `postMessage`:

### Monitoring Events
1. **MONITOR_INITIALIZED**: Sent when the script is loaded and active
2. **RUNTIME_ERROR**: JavaScript errors with stack traces
3. **RESOURCE_LOAD_ERROR**: Failed resource loads (scripts, images, CSS)
4. **UNHANDLED_PROMISE_REJECTION**: Unhandled promise rejections
5. **NETWORK_REQUEST**: Fetch requests with timing and response data
6. **CONSOLE_OUTPUT**: Batched console.log/warn/error messages
7. **URL_CHANGED**: Navigation events in SPAs
8. **CONTENT_LOADED**: When React content successfully renders
9. **BLANK_SCREEN_DETECTED**: When the app fails to render content

### Visual Editor Events
10. **VISUAL_EDIT_READY**: Sent when visual editor is enabled and ready
11. **ELEMENT_SELECTED**: Sent when user clicks an element (includes full element info)

## Visual Editor Commands

The monitor script listens for these postMessage commands:

1. **ENABLE_VISUAL_EDIT**: Activates visual editing mode
2. **DISABLE_VISUAL_EDIT**: Deactivates visual editing mode
3. **APPLY_STYLE**: Applies style changes to selected element
4. **APPLY_TEXT**: Updates text content of selected element

## Related Files

- **Template**: `/home/browe/dev/shipper-vite-template/.shipper/monitor.js` - Original monitor script
- **Shared Package**: `packages/shared/src/lib/sandbox-monitor.ts` - Single source of truth for generated script
- **Web App**: 
  - `apps/web/src/modules/admin/server/procedures.ts` - Backend injection logic
  - `apps/web/src/app/admin/projects/[projectId]/AdminProjectDetailClient.tsx` - UI controls
  - `apps/web/src/components/ai-elements/SandboxMonitor.tsx` - Monitor event handler component
- **API**:
  - `apps/api/src/services/modal-sandbox-manager.ts` - Uses monitor script for Modal sandboxes
  - `apps/api/src/services/sandbox-monitor-injection.ts` - Monitor injection utilities

## Migration to Shared Package

The monitor script was previously duplicated in:
- `apps/web/src/lib/sandbox-monitor.ts` (deleted)
- `apps/api/src/services/sandbox-monitoring.ts` (deleted)

It is now centralized in `packages/shared/src/lib/sandbox-monitor.ts` and imported as:

```typescript
import { generateMonitorScript } from "@shipper/shared";
```

### Keeping in Sync

The shared package version is updated from the template at:
`/home/browe/dev/shipper-vite-template/.shipper/monitor.js`

When updating the monitor script:
1. Edit the template version first
2. Copy the updated script to `packages/shared/src/lib/sandbox-monitor.ts`
3. Ensure the `generateMonitorScript()` function outputs the exact same code
4. Run typechecks to verify: `pnpm typecheck`

## Benefits

1. **Single Source of Truth**: Monitor script matches the template exactly
2. **Consistency**: Both web and API use the exact same script
3. **Full Feature Set**: Includes both monitoring and visual editing capabilities
4. **Easy Maintenance**: Updates in one place affect all apps
5. **Better Organization**: Shared utilities in shared package
6. **Visual Editor**: Enables real-time visual editing of sandbox apps
7. **Robust Element Targeting**: Multiple identification methods (shipperId, XPath, CSS selector)
8. **Repeated Element Support**: Automatically handles elements from loops/maps

## Implementation Notes

- The script is generated at runtime from TypeScript, not read from a file
- Reloading a fragment will remove the injected script (HTML is overwritten)
- The script only runs in the browser (sandbox preview), not on the server
- Already injected scripts are detected and skipped to prevent duplicates
- Works with both Modal and Daytona sandbox providers
- Visual editor requires explicit activation via postMessage
- Visual editor commands are origin-validated for security
