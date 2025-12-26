# Environment Differentiation for PostHog Analytics

This document describes the environment differentiation system implemented for PostHog LLM analytics tracking, allowing you to separate and analyze development vs production chat sessions.

## Overview

The environment differentiation system adds consistent environment metadata to all PostHog events, enabling you to:

- **Separate dev and prod analytics** - Filter out development noise from production insights
- **Monitor deployment-specific performance** - Track how different deployment environments perform
- **Analyze environment-specific error rates** - Identify issues specific to certain environments
- **Optimize features based on real usage** - Distinguish between test usage and real user behavior

## Implementation

### Environment Properties

Every PostHog event now includes these standardized environment properties:

```typescript
interface EnvironmentProperties {
  environment: string; // Node.js environment (development, production, test)
  deployment_env: string; // Vercel-aware environment (development, production, preview)
  session_type: string; // Descriptive identifier (e.g., "production_chat_session")
  is_production: boolean; // Simple production flag for easy filtering
  vercel_env?: string; // Vercel-specific environment when applicable
}
```

### Environment Property Examples

| Scenario          | environment   | deployment_env | session_type               | is_production | vercel_env   |
| ----------------- | ------------- | -------------- | -------------------------- | ------------- | ------------ |
| Local Development | `development` | `development`  | `development_chat_session` | `false`       | `undefined`  |
| Production Server | `production`  | `production`   | `production_chat_session`  | `true`        | `undefined`  |
| Vercel Preview    | `production`  | `preview`      | `production_chat_session`  | `true`        | `preview`    |
| Vercel Production | `production`  | `production`   | `production_chat_session`  | `true`        | `production` |
| Test Environment  | `test`        | `test`         | `test_chat_session`        | `false`       | `undefined`  |

## Usage in Code

### Utility Function

The `getEnvironmentProperties()` utility function generates consistent environment metadata:

```typescript
import { getEnvironmentProperties } from "@/lib/posthog-capture";

// Get environment properties
const envProps = getEnvironmentProperties();

// Use in PostHog events
await postHog.captureAITrace({
  distinct_id: userId,
  $ai_trace_id: traceId,
  // ... other properties
  ...envProps, // Spreads all environment properties
});
```

### Implementation Locations

Environment differentiation is implemented across all tracking locations:

1. **Chat API** (`src/app/api/chat/route.ts`)
   - AI trace events (session start/end)
   - AI generation events (context analyzer, full-stack developer)
   - AI span events (credit deduction, context updates)

2. **Complexity Analyzer** (`src/lib/complexity-analyzer.ts`)
   - AI generation events for complexity analysis
   - Error tracking with environment context

3. **AI Tools** (`src/lib/ai/v2-tools.ts`)
   - Tool span tracking
   - Tool usage events

## PostHog Dashboard Filtering

### Basic Environment Filtering

Filter events by primary environment:

```
environment = 'development'    # Local development
environment = 'production'     # Production deployments
environment = 'test'           # Testing environments
```

### Advanced Deployment Filtering

Filter by deployment-specific environments:

```
deployment_env = 'development'  # Local development
deployment_env = 'production'   # Live production
deployment_env = 'preview'      # Vercel preview deployments
```

### Session Type Filtering

Filter by descriptive session types:

```
session_type = 'development_chat_session'
session_type = 'production_chat_session'
session_type = 'test_chat_session'
```

### Production vs Non-Production

Simple boolean filtering:

```
is_production = true     # Production only
is_production = false    # Development, test, preview
```

### Vercel-Specific Filtering

Filter Vercel deployments:

```
vercel_env = 'production'  # Vercel production
vercel_env = 'preview'     # Vercel preview
vercel_env exists          # Any Vercel deployment
```

## Example Analytics Queries

### 1. Production Chat Volume

Track real user activity vs development activity:

```
Filter: is_production = true
Event: $ai_trace
Chart: Count over time
```

### 2. Development vs Production Complexity

Compare task complexity between environments:

```
Filter: event = '$ai_generation' AND feature = 'complexity-analysis'
Breakdown: environment
Chart: Average complexity score by environment
```

### 3. Vercel Deployment Performance

Monitor performance across Vercel environments:

```
Filter: vercel_env exists
Breakdown: deployment_env
Chart: Average $ai_latency by deployment environment
```

### 4. Error Rates by Environment

Track error patterns across environments:

```
Filter: $ai_is_error = true
Breakdown: session_type
Chart: Error rate percentage by environment
```

### 5. Token Usage by Environment

Monitor AI costs across environments:

```
Filter: event = '$ai_generation'
Breakdown: is_production
Chart: Sum of $ai_input_tokens + $ai_output_tokens
```

## Recommended Dashboards

### Production Health Dashboard

Focus on live user activity:

```
Filter: is_production = true
Widgets:
- Chat session volume
- Generation success rate
- Average response latency
- Error rate trends
- Token usage and costs
```

### Development Activity Dashboard

Track development and testing:

```
Filter: environment = 'development'
Widgets:
- Feature testing activity
- Development error patterns
- Complexity analysis usage
- Tool usage patterns
```

### Cross-Environment Comparison

Compare performance across all environments:

```
Filter: All events
Breakdown: environment
Widgets:
- Latency comparison
- Error rate comparison
- Feature usage patterns
- Cost analysis
```

### Vercel Deployment Monitoring

Monitor Vercel-specific metrics:

```
Filter: vercel_env exists
Breakdown: vercel_env
Widgets:
- Preview vs production performance
- Deployment-specific error rates
- Feature rollout monitoring
```

## Testing

### Test Scripts

Three test scripts validate environment differentiation:

1. **PostHog Integration Test** - `pnpm test:posthog`
   - Tests basic environment properties in events
   - Validates test environment properties

2. **Complexity Analyzer Test** - `pnpm test:complexity`
   - Tests environment tracking in complexity analysis
   - Validates real API usage with environment context

3. **Environment Tracking Demo** - `pnpm test:environment`
   - Demonstrates all environment scenarios
   - Shows property generation for each environment type
   - Provides dashboard filtering examples

### Test Environment Properties

All test scripts use consistent test environment properties:

```typescript
{
  environment: "test",
  deployment_env: "test",
  session_type: "test_chat_session",
  is_production: false,
  vercel_env: "test"
}
```

## Environment Variables

The system automatically detects environment based on these variables:

```bash
# Primary environment detection
NODE_ENV=development|production|test

# Vercel-specific detection
VERCEL_ENV=development|preview|production
```

## Benefits

### Analytics Clarity

- **Noise Reduction**: Filter out development activity from production insights
- **Real User Focus**: Analyze actual user behavior without test data contamination
- **Environment Comparison**: Compare performance and usage across environments

### Operational Insights

- **Production Monitoring**: Set up alerts specifically for production issues
- **Deployment Validation**: Monitor new deployments with environment-specific dashboards
- **Performance Optimization**: Identify environment-specific performance patterns

### Cost Management

- **Production Costs**: Track real AI usage costs vs development costs
- **Environment Budgeting**: Allocate AI usage budgets by environment
- **Optimization Targeting**: Focus cost optimization on production usage

### Development Workflow

- **Feature Testing**: Track feature adoption in development vs production
- **Error Debugging**: Identify environment-specific issues
- **Performance Validation**: Ensure features perform well across all environments

## Implementation Files

The environment differentiation system is implemented across these files:

- `src/lib/posthog-capture.ts` - Core utility function and types
- `src/app/api/chat/route.ts` - Chat API event tracking
- `src/lib/complexity-analyzer.ts` - Complexity analysis tracking
- `src/lib/ai/v2-tools.ts` - AI tools tracking
- `scripts/test-*.ts` - Test scripts with environment validation

## Migration Notes

This feature was added as an enhancement to existing PostHog tracking. All existing events now include environment properties without breaking changes. The implementation uses the spread operator to add environment properties to all events consistently.

## Future Enhancements

Potential future improvements:

1. **Dynamic Environment Detection** - Detect staging environments automatically
2. **Environment-Specific Sampling** - Different sampling rates for different environments
3. **Environment Alerts** - Automated alerts for production-specific issues
4. **Cost Tracking** - Environment-specific cost allocation and budgeting
5. **A/B Testing** - Environment-aware feature flag and A/B testing integration

## Conclusion

The environment differentiation system provides comprehensive analytics separation between development, testing, and production environments. This enables more accurate insights, better operational monitoring, and clearer cost management for the AI-powered chat system.
