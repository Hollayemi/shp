# PostHog LLM Analytics Integration

This document describes the PostHog integration for tracking LLM operations and AI tool usage in the Shipper webapp.

## Overview

PostHog is integrated to provide comprehensive analytics for:

- LLM generation events (context analysis, full-stack development)
- AI tool usage tracking
- User interaction patterns with AI features
- Performance metrics and error tracking

## Configuration

### Environment Variables

Add the following environment variables to your `.env` file:

```bash
# PostHog Configuration
POSTHOG_PROJECT_API_KEY=your_posthog_project_api_key
POSTHOG_HOST=https://app.posthog.com
NEXT_PUBLIC_POSTHOG_KEY=your_public_posthog_key
```

### Getting PostHog API Keys

1. Sign up at [PostHog](https://posthog.com)
2. Create a new project
3. Get your API keys from Project Settings:
   - **Project API Key**: Used for server-side tracking (POSTHOG_PROJECT_API_KEY)
   - **Public API Key**: Used for client-side tracking (NEXT_PUBLIC_POSTHOG_KEY)

## Integration Points

### 1. LLM Generation Tracking

The chat API route (`src/app/api/chat/route.ts`) tracks LLM operations using the `@posthog/ai` SDK:

#### Context Analyzer

- Tracks prompt analysis operations
- Captures input/output tokens and costs
- Associates with user sessions and projects

#### Full-Stack Developer

- Tracks code generation operations
- Monitors tool usage within AI workflows
- Records performance metrics

### 2. AI Tool Usage Tracking

Individual AI tools in `src/lib/ai/v2-tools.ts` are instrumented to track:

#### Tracked Tools

- `getOrCreateSandbox`: Sandbox creation and management
- `readFile`/`writeFile`: File operations
- `createOrEditFiles`: Code editing operations
- `quickEdit`: AST-based code modifications
- `applyTheme`: Theme application
- `validateProject`: Project validation
- `finalizeWorkingFragment`: Fragment completion

#### Event Properties

Each tool usage event includes:

- Tool name and operation type
- User ID and project ID
- Input parameters and output results
- Success/failure status
- Execution metadata

### 3. Event Schema

#### LLM Generation Events (`$ai_generation`)

Automatically captured by the Vercel AI SDK integration:

```typescript
{
  $ai_model: string,           // Model used (e.g., "gpt-4o-mini")
  $ai_latency: number,         // Latency in seconds
  $ai_tools: string[],         // Available tools
  $ai_input: object[],         // Input messages
  $ai_input_tokens: number,    // Input token count
  $ai_output_choices: object[], // Response choices
  $ai_output_tokens: number,   // Output token count
  $ai_total_cost_usd: number,  // Total cost in USD
  conversationId: string,      // Stream ID
  projectId: string,          // Project identifier
  feature: string,            // "context-analyzer" | "full-stack-developer"
  userRole: string            // User role
}
```

#### Tool Usage Events (`$ai_tool_usage`)

Custom events for individual tool operations:

```typescript
{
  $ai_tool_name: string,      // Tool name
  $ai_tool_input: object,     // Tool input parameters
  $ai_tool_output: object,    // Tool output/result
  $ai_tool_success: boolean,  // Success status
  projectId: string,          // Project identifier
  timestamp: string,          // ISO timestamp
  action?: string            // Specific action type
}
```

## Usage Analytics

### Key Metrics to Track

1. **LLM Performance**
   - Token usage and costs per operation
   - Latency and response times
   - Model selection effectiveness

2. **Tool Usage Patterns**
   - Most frequently used tools
   - Success/failure rates
   - User workflow patterns

3. **Project Development**
   - Time to completion
   - Code generation efficiency
   - Error rates and recovery

### Dashboard Insights

Create PostHog dashboards to monitor:

- Daily active users and AI interactions
- Cost analysis and optimization opportunities
- Feature adoption and usage patterns
- Error tracking and debugging metrics

## Privacy and Security

### Data Handling

- User IDs are used as distinct identifiers
- Project-specific data is compartmentalized
- Sensitive code content is not tracked in analytics

### Privacy Mode

PostHog privacy mode is disabled by default to capture full analytics. To enable privacy mode:

```typescript
posthogPrivacyMode: true; // In withTracing() calls
```

### GDPR Compliance

PostHog provides built-in GDPR compliance features:

- Data retention controls
- User data deletion
- Consent management

## Development and Testing

### Local Development

- PostHog events are sent in development mode with `debug: true`
- Use PostHog's development environment for testing
- Check browser console for debug information

### Production Deployment

- Ensure environment variables are set in production
- Monitor PostHog dashboard for event delivery
- Set up alerts for critical metrics

## Troubleshooting

### Common Issues

1. **Events Not Appearing**
   - Check API keys are correctly set
   - Verify network connectivity to PostHog
   - Check browser console for errors

2. **Missing Tool Events**
   - Ensure `trackToolUsage()` calls are not failing silently
   - Check server logs for PostHog warnings
   - Verify tool execution paths

3. **Performance Impact**
   - PostHog events are sent asynchronously
   - Failures are logged but don't interrupt operations
   - Use `flushAt: 1` for immediate sending in production

### Debug Mode

Enable PostHog debug mode in development:

```typescript
debug: process.env.NODE_ENV === "development";
```

## Best Practices

1. **Event Naming**: Use consistent event names with the `$ai_` prefix
2. **Property Structure**: Keep property names consistent across events
3. **Error Handling**: Always wrap PostHog calls in try-catch blocks
4. **Performance**: Use async tracking to avoid blocking operations
5. **Data Quality**: Validate important properties before sending

## Future Enhancements

Potential improvements:

- User journey tracking across AI workflows
- A/B testing for different AI models
- Custom metrics for code quality assessment
- Integration with other analytics platforms
