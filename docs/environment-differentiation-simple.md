# Environment Differentiation - Simple Setup

## Overview

Environment differentiation is now implemented for PostHog analytics, allowing you to separate development and production chat sessions with just two simple properties.

## Properties Added

Every PostHog event now includes:

```typescript
{
  environment: string,    // 'development', 'production', or 'test'
  vercel_env?: string     // 'production' or 'preview' (when on Vercel)
}
```

## Environment Examples

| Scenario          | environment   | vercel_env   |
| ----------------- | ------------- | ------------ |
| Local Development | `development` | `undefined`  |
| Production Server | `production`  | `undefined`  |
| Vercel Preview    | `production`  | `preview`    |
| Vercel Production | `production`  | `production` |

## PostHog Dashboard Filtering

### Basic Filtering

```
environment = 'development'    # Local development
environment = 'production'     # Production deployments
environment = 'test'           # Testing
```

### Vercel Filtering

```
vercel_env = 'production'      # Vercel production
vercel_env = 'preview'         # Vercel preview
vercel_env exists              # Any Vercel deployment
```

## Common Use Cases

1. **Filter out dev noise**: `environment = 'production'`
2. **Development activity**: `environment = 'development'`
3. **Vercel deployments**: `vercel_env exists`
4. **Compare environments**: Breakdown by `environment`

## Implementation

The environment properties are automatically added to all PostHog events:

- AI generations (complexity analysis, context analyzer, full-stack developer)
- AI traces (chat sessions)
- AI spans (tool usage, credit deduction)

## Testing

Run tests to verify implementation:

```bash
pnpm test:posthog        # Main integration test
pnpm test:environment    # Environment demo
```

All events will include the appropriate environment properties based on your current NODE_ENV and VERCEL_ENV settings.
