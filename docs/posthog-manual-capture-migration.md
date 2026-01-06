# PostHog Manual Capture Migration

This document summarizes the migration from PostHog SDK client to manual API calls for LLM analytics tracking.

## Overview

We've successfully migrated from using the PostHog SDK client (`posthog-node`) to making direct API calls to PostHog's capture endpoint. This approach provides better control over event delivery, reduced dependencies, and full compatibility with PostHog's LLM analytics dashboard.

## Key Changes

### 1. New Manual Capture Utility (`src/lib/posthog-capture.ts`)

Created a comprehensive utility class that handles manual PostHog event capture:

- **PostHogManualCapture class**: Manages direct API calls to PostHog
- **Specialized methods**: `captureAIGeneration()`, `captureAITrace()`, `captureAISpan()`, `capture()`
- **Type-safe interfaces**: Full TypeScript support for event properties
- **Error handling**: Graceful failure with console logging
- **Environment detection**: Automatic configuration based on environment variables

#### Key Features:

- No external dependencies beyond standard `fetch`
- Immediate event sending (no batching delays)
- Full control over event structure and timing
- Compatible with PostHog's official event schema

### 2. Updated Chat API (`src/app/api/chat/route.ts`)

Replaced all PostHog SDK client calls with manual capture:

- **Trace tracking**: Session start, completion, and error states
- **Generation tracking**: Context analyzer and full-stack developer LLM calls
- **Span tracking**: Credit deduction, context updates
- **Generation tracking**: Complexity analysis (uses Google Gemini 2.5 Flash model)
- **Accurate timing**: Real-time latency calculation using `Date.now()`
- **Proper event classification**: Complexity analysis tracked as AI generation (not span)
- **Enhanced properties**: Added environment, userRole, and feature-specific metadata

#### Migration Details:

- Removed `getPostHogClient()` function and `phClient` variable
- Updated all `capture()` calls to use specialized methods
- Added proper async/await handling for manual capture
- Removed unnecessary flush/shutdown logic (not needed for manual capture)

### 3. Updated AI Tools (`src/lib/ai/v2-tools.ts`)

Migrated tool usage and span tracking:

- **Tool span tracking**: Updated `trackToolSpan()` to use `captureAISpan()`
- **Tool usage tracking**: Updated `trackToolUsage()` to use custom event capture
- **Removed SDK dependency**: No longer imports `posthog-node`
- **Improved error handling**: Better error logging with PostHog prefix

### 4. Updated Test Script (now removed)

Completely rewrote test script for manual capture:

- **Removed SDK client**: No longer uses `PostHog` class or `withTracing`
- **Direct testing**: Tests manual capture methods directly
- **Comprehensive coverage**: Tests generation, trace, span, and custom events
- **Batch testing**: Validates performance of multiple concurrent requests
- **Configuration validation**: Checks environment setup without requiring API keys

## Event Schema Compliance

All events follow PostHog's official LLM analytics schema:

### AI Generation Events (`$ai_generation`)

```typescript
{
  distinct_id: string,
  $ai_trace_id: string,
  $ai_model: string,
  $ai_provider: string,
  $ai_input: any[],
  $ai_output_choices: any[],
  $ai_latency: number,
  // ... other official properties
}
```

### AI Trace Events (`$ai_trace`)

```typescript
{
  distinct_id: string,
  $ai_trace_id: string,
  $ai_input_state: any,
  $ai_output_state: any,
  $ai_latency: number,
  // ... other official properties
}
```

### AI Span Events (`$ai_span`)

```typescript
{
  distinct_id: string,
  $ai_trace_id: string,
  $ai_span_name: string,
  $ai_input_state: any,
  $ai_output_state: any,
  $ai_latency: number,
  // ... other official properties
}
```

## Benefits of Manual Capture

### 1. **Full Control**

- Direct control over event timing and structure
- No SDK abstractions or hidden behaviors
- Explicit error handling and logging

### 2. **Reduced Dependencies**

- Removed `posthog-node` dependency
- Smaller bundle size
- Fewer potential security vulnerabilities

### 3. **Better Performance**

- Events sent immediately via HTTP requests
- No internal batching or queueing delays
- Async operation doesn't block main thread

### 4. **Enhanced Debugging**

- Clear error messages with PostHog prefix
- Easy to trace event delivery issues
- Simple to test and validate locally

### 5. **Schema Compliance**

- Perfect alignment with PostHog's official event schema
- No SDK interpretation or modification of events
- Direct compatibility with PostHog dashboard features

## Environment Variables

The following environment variables are used:

```bash
# Primary API key (server-side)
POSTHOG_PROJECT_API_KEY=your_api_key_here

# Fallback API key (client-side, used if server key not available)
NEXT_PUBLIC_POSTHOG_KEY=your_public_key_here

# PostHog host (optional, defaults to EU instance)
POSTHOG_HOST=https://eu.i.posthog.com
NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
```

## Testing

### Running Tests

```bash
pnpm test:posthog
```

### Test Coverage

- ✅ PostHog configuration validation
- ✅ AI generation event tracking (including complexity analysis)
- ✅ AI trace event tracking
- ✅ AI span event tracking
- ✅ Custom event tracking
- ✅ Batch event performance
- ✅ Error handling and fallbacks

### Expected Results

All tests should pass with 100% success rate when properly configured.

## Migration Checklist

- [x] Created `PostHogManualCapture` utility class
- [x] Updated chat API to use manual capture
- [x] Updated AI tools to use manual capture
- [x] Updated test script for manual capture
- [x] Removed old SDK client references
- [x] Verified event schema compliance
- [x] Tested integration end-to-end
- [x] Validated build and linting
- [x] Updated documentation

## Dashboard Verification

After deployment, verify events in PostHog dashboard:

1. **Generations Tab**: Should show `$ai_generation` events including:
   - Context analyzer (Azure OpenAI gpt-4o-mini)
   - Full-stack developer (OpenRouter model)
   - Complexity analysis (Google Gemini 2.5 Flash)
2. **AI Analytics**: Should display traces, spans, and generation metrics
3. **Custom Events**: Should show tool usage and fragment events
4. **Real-time Activity**: Should show immediate event delivery

## Troubleshooting

### Common Issues

1. **Events not appearing**: Check API key configuration and network connectivity
2. **Schema validation errors**: Ensure event properties match PostHog requirements
3. **Performance issues**: Monitor HTTP request timing and error rates

### Debug Tips

1. Enable development logging to see event capture attempts
2. Check browser network tab for HTTP requests to PostHog
3. Verify event structure matches expected schema
4. Test with PostHog's event validation tools

## Future Considerations

1. **Rate Limiting**: Monitor for API rate limits on high-traffic deployments
2. **Error Recovery**: Consider implementing retry logic for failed requests
3. **Event Queuing**: Add local queuing for offline scenarios if needed
4. **Analytics Enhancement**: Add more custom properties for richer insights

## Conclusion

The migration to PostHog manual capture is complete and provides a robust, performant, and maintainable solution for LLM analytics tracking. The implementation follows best practices, maintains full compatibility with PostHog's dashboard features, and provides better control over event delivery.
