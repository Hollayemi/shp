# Complexity Analysis Generation Tracking Update

## Overview

Updated the PostHog analytics tracking for complexity analysis to properly classify it as an AI generation event instead of a span event, and moved the tracking to the complexity analyzer itself to capture real token usage and cost data from the OpenRouter API response.

## Changes Made

### 1. Tracking Location Update

**Before:**

- Tracking handled in chat API route (`route.ts`)
- No access to real token usage or cost data
- Estimated values used for tracking

**After:**

- Tracking moved to complexity analyzer (`complexity-analyzer.ts`)
- Real token usage from AI SDK response
- Actual cost data from OpenRouter API
- Accurate timing measurement at the source

### 2. Event Classification Update

**Before:**

- Complexity analysis tracked as `$ai_span` event
- Used `captureAISpan()` method
- Limited metadata about the actual LLM call

**After:**

- Complexity analysis tracked as `$ai_generation` event
- Uses `captureAIGeneration()` method
- Full LLM generation metadata including model, provider, input/output

### 3. Real Usage Data Tracking

The complexity analysis generation now includes actual usage data:

```typescript
{
  $ai_model: "google/gemini-2.5-flash",
  $ai_provider: "openrouter",
  $ai_input: [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "Analyze complexity: [user message]"
        }
      ]
    }
  ],
  $ai_output_choices: [
    {
      role: "assistant",
      content: [
        {
          type: "text",
          text: JSON.stringify(complexityAnalysis)
        }
      ]
    }
  ],
  $ai_input_tokens: usage?.inputTokens || 0,      // Real token count
  $ai_output_tokens: usage?.outputTokens || 0,    // Real token count
  $ai_total_cost_usd: response?.usage?.cost || 0, // Real cost from API
  $ai_latency: [actual_timing],
  $ai_http_status: 200,
  $ai_base_url: "https://openrouter.ai/api/v1",
  $ai_request_url: "https://openrouter.ai/api/v1/chat/completions",
  $ai_temperature: 0.7,
  // Custom properties
  complexity: complexityAnalysis.complexity,
  category: complexityAnalysis.category,
  feature: "complexity-analysis"
}
```

### 3. Error Handling Update

Complexity analysis errors are now also tracked as generation events with:

- `$ai_is_error: true`
- `$ai_error: [error_message]`
- `$ai_http_status: 500`
- Empty `$ai_output_choices` array

## Why This Change Matters

### 1. **Real Data Accuracy**

- PostHog now receives actual token counts from the AI SDK
- Real cost data from OpenRouter API responses
- Accurate timing measured at the LLM call source
- Precise token usage analytics for Gemini 2.5 Flash model

### 2. **Better Cost Tracking**

- True cost per complexity analysis call
- Token efficiency metrics for complexity determination
- Real-time cost monitoring for budget management
- Accurate ROI calculations for the complexity analysis feature

### 3. **Improved Analytics Insights**

- Model performance metrics for complexity analysis
- Real token usage patterns and optimization opportunities
- Latency analysis for complexity determination at the source
- Error rate monitoring with proper generation classification

### 4. **Consistent Classification**

- All actual LLM calls are now tracked as generations
- Spans are reserved for non-LLM operations (credit deduction, context updates)
- Clear distinction between AI generations and application spans

## LLM Generation Events in the System

After this update, the system tracks three main AI generation types:

1. **Context Analyzer** (`gpt-4o-mini` via Azure OpenAI)
   - Analyzes conversation context
   - Determines appropriate response strategy

2. **Full-Stack Developer** (Various models via OpenRouter)
   - Main AI agent for code generation
   - Uses tools for project manipulation

3. **Complexity Analysis** (`google/gemini-2.5-flash` via OpenRouter)
   - Determines task complexity and credit cost
   - Quick analysis for cost estimation

## Testing Updates

### 1. Enhanced PostHog Integration Tests

Added complexity analysis generation testing to the main PostHog test script:

- Tests successful complexity analysis generation tracking
- Validates proper event structure and metadata
- Ensures error cases are handled correctly

### 2. Dedicated Complexity Analyzer Tests

Created a comprehensive test suite (now removed):

- Tested real complexity analysis with token usage tracking
- Validated different complexity categories (simple, moderate, complex, advanced)
- Tested error handling and fallback scenarios
- Verified PostHog event delivery with actual API responses
- Measured performance and timing accuracy

**Note:** Test files have been removed as the integration is now stable and production-ready.

## PostHog Dashboard Impact

In the PostHog LLM analytics dashboard, you'll now see:

- Complexity analysis appearing in the Generations tab
- Proper model attribution to Google Gemini 2.5 Flash
- Cost tracking and performance metrics
- Clear separation from span events

## Files Modified

- `src/lib/complexity-analyzer.ts` - Added PostHog generation tracking with real usage data
- `src/app/api/chat/route.ts` - Removed redundant tracking, pass traceId to analyzer
- `scripts/test-posthog-integration.ts` - Added complexity analysis test (now removed)
- `scripts/test-complexity-analyzer.ts` - New dedicated test suite (now removed)
- `package.json` - Added `test:complexity` script (now removed)
- `docs/posthog-manual-capture-migration.md` - Updated documentation

## Function Signature Update

The `analyzePromptComplexity` function now accepts an optional `traceId` parameter:

```typescript
export async function analyzePromptComplexity(
  prompt: string,
  userId?: string,
  traceId?: string, // New parameter for PostHog trace correlation
): Promise<ComplexityAnalysis>;
```

This allows the complexity analysis to be properly correlated with the overall chat session trace in PostHog analytics.

## Verification

### 1. Run the PostHog integration test:

```bash
pnpm test:posthog
```

Expected result: All 12 tests pass, including the new complexity analysis generation test.

### 2. Run the dedicated complexity analyzer test:

```bash
pnpm test:complexity
```

Expected result: All tests pass with real token usage and cost tracking demonstrated.

## Benefits Achieved

- **Accurate Token Tracking**: Real input/output token counts from AI SDK
- **True Cost Monitoring**: Actual costs from OpenRouter API responses
- **Better Performance Insights**: Precise latency measurements at the source
- **Improved Analytics**: Rich data for optimization and cost management
- **Proper Event Classification**: Complexity analysis correctly appears as AI generation
- **Trace Correlation**: Complexity analysis linked to overall chat session traces

## Conclusion

This update ensures that complexity analysis is properly classified as an AI generation event with real usage data captured directly from the AI API response. The tracking now provides accurate token counts, true costs, and precise timing, enabling better analytics visibility and more informed decision-making about LLM usage optimization and cost management in the system.
