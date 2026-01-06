# Sandbox Monitoring System

The Sandbox Monitoring System provides real-time visibility into the runtime behavior of user projects running in Daytona sandboxes. It captures errors, network requests, console output, and other events to help debug issues and improve the user experience.

## Overview

### What It Does

The monitoring system **injects a client-side script** into the sandbox's `index.html` file. This script:

1. **Captures Runtime Errors** - JavaScript errors, unhandled promise rejections, and blank screen detection
2. **Monitors Network Requests** - Intercepts `fetch()` calls to track API requests and responses
3. **Captures Console Output** - Intercepts `console.log/warn/error` for debugging
4. **Tracks Navigation** - Monitors URL changes within the SPA
5. **Communicates via postMessage** - Sends all events to the parent window (Shipper UI)

### Architecture

```
┌─────────────────────────────────────────────────────┐
│  Shipper Web App (Parent Window)                   │
│  ┌───────────────────────────────────────────────┐ │
│  │  SandboxMonitor Component                     │ │
│  │  - Receives postMessage events                │ │
│  │  - Processes monitoring data                  │ │
│  │  - Displays debug UI (optional)               │ │
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
                      ▲
                      │ postMessage API
                      │
┌─────────────────────────────────────────────────────┐
│  Sandbox Preview (iframe/window)                    │
│  ┌───────────────────────────────────────────────┐ │
│  │  index.html (with injected monitoring script) │ │
│  │  ┌─────────────────────────────────────────┐ │ │
│  │  │  Monitoring Script                      │ │ │
│  │  │  - Error listeners                      │ │ │
│  │  │  - fetch() interception                 │ │ │
│  │  │  - console.* interception               │ │ │
│  │  │  - MutationObserver for navigation      │ │ │
│  │  └─────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

## Files and Components

### Core Files

1. **`src/lib/sandbox-monitor.ts`** - Core monitoring script generator and types
2. **`src/lib/sandbox-monitor-injection.ts`** - Utilities for injecting into Daytona sandboxes
3. **`src/components/ai-elements/SandboxMonitor.tsx`** - React component for receiving events

### Key Functions

#### `generateMonitorScript(allowedOrigins: string[]): string`

Generates the JavaScript code to be injected into the sandbox. The script:
- Sets up error tracking
- Intercepts `fetch()` for network monitoring
- Captures console output with debouncing
- Tracks URL changes with MutationObserver
- Sends events via `postMessage` to allowed origins only

#### `injectMonitoringScript(html: string, allowedOrigins: string[]): string`

Takes an HTML string and injects the monitoring script into it. Tries to inject:
1. Before `</head>` tag (preferred)
2. After `<body>` tag (fallback)
3. At the beginning of the HTML (last resort)

#### `injectMonitoringIntoSandbox(sandboxManager, sandboxId, options): Promise<Result>`

Reads the sandbox's `index.html`, injects the monitoring script, and writes it back. This is the main function to use when setting up monitoring for a sandbox.

## Usage

### 1. Injecting Monitoring into a Sandbox

```typescript
import { DaytonaSandboxManager } from "@/lib/daytona-sandbox-manager";
import { setupSandboxMonitoring } from "@/lib/sandbox-monitor-injection";

// After creating a sandbox and starting the dev server
const sandboxManager = new DaytonaSandboxManager();
const sandboxId = "abc123";
const projectId = "proj_xyz";

// Setup monitoring (non-blocking, won't throw if it fails)
await setupSandboxMonitoring(sandboxManager, sandboxId, projectId);
```

### 2. Receiving Monitoring Events in the UI

```typescript
import { SandboxMonitor } from "@/components/ai-elements/SandboxMonitor";

function ProjectPreview() {
  const handleError = (error) => {
    console.error("Sandbox error detected:", error);
    // Show error toast, log to analytics, etc.
  };

  const handleNetworkRequest = (request) => {
    console.log("Network request:", request);
    // Track API calls, monitor performance, etc.
  };

  const handleConsoleOutput = (output) => {
    console.log("Console output:", output);
    // Display in developer console UI
  };

  return (
    <div>
      <iframe src={sandboxUrl} />

      <SandboxMonitor
        onError={handleError}
        onNetworkRequest={handleNetworkRequest}
        onConsoleOutput={handleConsoleOutput}
        onUrlChange={(url) => console.log("URL changed:", url)}
        showDebugUI={true} // Enable debug panel
      />
    </div>
  );
}
```

### 3. Re-injecting After Dev Server Restart

If the dev server rebuilds `index.html`, you may need to re-inject:

```typescript
import { reinjectMonitoring } from "@/lib/sandbox-monitor-injection";

// After dev server restart
await reinjectMonitoring(sandboxManager, sandboxId);
```

## Event Types

### Runtime Error

```typescript
{
  type: "RUNTIME_ERROR",
  timestamp: "2025-10-22T10:30:00.000Z",
  data: {
    message: "Uncaught TypeError: Cannot read property 'x' of undefined",
    filename: "https://preview--5173-abc123.shipper.now/src/App.tsx",
    lineno: 42,
    colno: 15,
    stack: "Error: ...",
    blankScreen: false
  }
}
```

### Network Request

```typescript
{
  type: "NETWORK_REQUEST",
  timestamp: "2025-10-22T10:30:00.000Z",
  data: {
    url: "https://api.example.com/users",
    method: "GET",
    status: 200,
    statusText: "OK",
    requestBody: undefined,
    responseBody: "{\"users\":[...]}",
    duration: 342, // milliseconds
    timestamp: "2025-10-22T10:30:00.000Z"
  }
}
```

### Console Output

```typescript
{
  type: "CONSOLE_OUTPUT",
  timestamp: "2025-10-22T10:30:00.000Z",
  data: {
    messages: [
      {
        level: "info",
        message: "User logged in",
        logged_at: "2025-10-22T10:30:00.000Z",
        raw: ["User logged in", { userId: 123 }]
      }
    ]
  }
}
```

### URL Changed

```typescript
{
  type: "URL_CHANGED",
  timestamp: "2025-10-22T10:30:00.000Z",
  data: {
    url: "https://preview--5173-abc123.shipper.now/dashboard"
  }
}
```

## Configuration

### Allowed Origins

The monitoring script only sends messages to allowed origins for security. Configure these in `MONITOR_CONFIG`:

```typescript
export const MONITOR_CONFIG = {
  ALLOWED_ORIGINS: [
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    "https://shipper.app",
  ],
  // ...
};
```

### Debouncing

Console output is debounced to avoid overwhelming the parent window:

```typescript
DEBOUNCE_DELAY: 250, // milliseconds
```

### Serialization Limits

To prevent massive payloads:

```typescript
MAX_STRING_LENGTH: 10000,    // Max characters in strings
MAX_DEPTH: 5,                // Max object nesting depth
MAX_ARRAY_LENGTH: 100,       // Max array items to serialize
MAX_OBJECT_KEYS: 100,        // Max object keys to serialize
```

## Integration Points

### 1. Sandbox Creation

Add monitoring setup to the sandbox creation flow:

```typescript
// In your sandbox creation code
const sandbox = await sandboxManager.createDaytonaSandbox(/* ... */);

// After dev server starts
await setupSandboxMonitoring(sandboxManager, sandbox.id, projectId);
```

### 2. Error Detection UI

Use the monitoring data to show helpful error messages:

```typescript
const [hasErrors, setHasErrors] = useState(false);

<SandboxMonitor
  onError={(error) => {
    setHasErrors(true);
    if (error.blankScreen) {
      showNotification({
        type: "error",
        title: "App Failed to Load",
        message: error.message,
      });
    }
  }}
/>

{hasErrors && (
  <ErrorBanner>
    Your app has errors. Check the console for details.
  </ErrorBanner>
)}
```

### 3. Analytics

Track common errors and patterns:

```typescript
<SandboxMonitor
  onError={(error) => {
    analytics.track("sandbox_error", {
      message: error.message,
      file: error.filename,
      blankScreen: error.blankScreen,
    });
  }}
  onNetworkRequest={(request) => {
    if (request.status >= 400) {
      analytics.track("sandbox_api_error", {
        url: request.url,
        status: request.status,
      });
    }
  }}
/>
```

## Security Considerations

1. **Origin Validation** - The monitoring script only sends messages to allowed origins
2. **Data Sanitization** - Large objects are truncated to prevent memory issues
3. **No Credentials** - The script avoids capturing sensitive data like auth tokens
4. **Circular Reference Prevention** - The serializer detects and handles circular references

## Debugging

### Enable Debug UI

Set `showDebugUI={true}` on the `SandboxMonitor` component to see a real-time event panel:

```typescript
<SandboxMonitor showDebugUI={true} />
```

This displays:
- Connection status (green/red indicator)
- Error count
- Real-time event log with syntax highlighting
- Timestamps for each event

### Check Console

The monitoring script logs key events to the console:

```
[SandboxMonitor] Monitoring initialized
[SandboxMonitor] Runtime error: { message: "...", ... }
```

## Performance

The monitoring system is designed to be lightweight:

1. **Debounced Console** - Console output is batched every 250ms
2. **Lazy Serialization** - Objects are only serialized when needed
3. **Truncation** - Large strings and objects are truncated
4. **WeakMap for Circular Detection** - Efficient memory usage for cycle detection

## Future Enhancements

Potential improvements:

1. **Performance Metrics** - Track Core Web Vitals (LCP, FID, CLS)
2. **User Interactions** - Record click paths and user flows
3. **Screenshot on Error** - Capture visual state when errors occur
4. **Replay Sessions** - Record and replay user sessions
5. **Smart Filtering** - Filter out noisy errors (e.g., browser extensions)

## Comparison with Example Code

The code you provided from other app builders does similar things:

| Feature | Their Implementation | Our Implementation |
|---------|---------------------|-------------------|
| Error Tracking | ✅ `window.addEventListener('error')` | ✅ Same approach |
| Network Monitoring | ✅ `window.fetch` interception | ✅ Same approach |
| Console Capture | ✅ Override `console.*` | ✅ Same approach |
| Navigation Tracking | ✅ MutationObserver | ✅ Same approach |
| Communication | ✅ postMessage API | ✅ Same approach |
| Serialization | ✅ Custom serializer | ✅ Enhanced serializer with type preservation |
| Origin Validation | ✅ ALLOWED_ORIGINS | ✅ Same approach |
| Blank Screen Detection | ✅ Check root element | ✅ Same approach |

Our implementation adds:
- TypeScript types for all events
- React component for receiving events
- Integration with Daytona sandbox manager
- Configurable allowed origins from environment
- Better error handling and fallbacks

## Troubleshooting

### Monitoring Not Working

1. **Check allowed origins** - Ensure parent window origin is in `ALLOWED_ORIGINS`
2. **Verify injection** - Check that `index.html` contains the monitoring script
3. **Check browser console** - Look for postMessage errors
4. **Verify iframe** - Ensure preview is loaded in an iframe or window that can postMessage

### Events Not Received

1. **Check event listeners** - Ensure `SandboxMonitor` component is mounted
2. **Verify origin** - Check browser console for postMessage origin errors
3. **Test with debug UI** - Enable `showDebugUI` to see raw events

### Performance Issues

1. **Reduce console logging** - Lower `DEBOUNCE_DELAY` or filter console events
2. **Limit serialization depth** - Reduce `MAX_DEPTH` or `MAX_OBJECT_KEYS`
3. **Filter network requests** - Only track specific API calls

## Examples

See the test files for complete examples:

- `scripts/test-sandbox-monitoring.ts` - Example script to test monitoring
- `app/projects/[projectId]/preview` - Integration with project preview page

---

**Last Updated:** 2025-10-22
**Version:** 1.0.0
**Maintainer:** Shipper Engineering Team
