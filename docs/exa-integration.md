# Exa.ai Integration for HAL Chat

## Overview

This document describes the integration of Exa.ai web search capabilities into the HAL Chat (Advisor) feature. The Advisor acts as a cofounder who strategically uses real-time web search to provide value beyond what users would get from copy-pasting into ChatGPT.

## The Cofounder Advantage

Unlike generic AI assistants, the Advisor:

- **Stays in context** across the entire project journey
- **Actually researches** - both technical (API patterns, breaking changes) and business (market data, competitors, pricing)
- **Thinks strategically** about what to build next and potential blockers
- **Challenges assumptions** when something doesn't make sense for their use case
- **Focuses on shipping** rather than theoretical best practices

The Exa integration is key to this value proposition - it allows the Advisor to verify information, find real implementations, research competitors, analyze markets, and provide answers based on current reality rather than training data.

## Implementation Details

### 1. Package Installation

Added `exa-js` (v1.10.2) to the project dependencies:

```bash
pnpm add exa-js
```

### 2. Exa Tool Creation

Created `/src/lib/exa-tool.ts` which exports `exaWebSearchTool` - a tool that wraps Exa's `searchAndContents` API using the AI SDK's `tool()` function.

**Key Features:**

- **Semantic Search**: Uses Exa's AI-powered semantic search for relevant results
- **Live Crawling**: Always uses `livecrawl: "always"` for most up-to-date information
- **Content Extraction**: Retrieves up to 1000 characters of text content from each result
- **Structured Output**: Returns formatted results with title, URL, content, published date, and relevance score
- **Error Handling**: Gracefully handles API failures and returns error information

**Tool Configuration:**

- **Input Schema**: Single parameter `query` (string, 1-200 characters)
- **Results**: Returns up to 3 search results by default
- **Description**: Covers both technical research (APIs, errors, patterns) and business research (competitors, pricing, market trends)

### 3. HAL Chat Route Integration

Modified `/src/app/api/hal-chat/route.ts` to integrate the Exa tool:

**Changes Made:**

1. Imported `exaWebSearchTool` from `/src/lib/exa-tool`
2. Added `tools` parameter to `streamText()` configuration:
   ```typescript
   tools: {
     webSearch: exaWebSearchTool,
   }
   ```
3. Completely redesigned system prompt to position Advisor as a cofounder
4. Emphasized strategic research over documentation lookup

**System Prompt Philosophy:**

- Acts as a cofounder, not a documentation bot
- Uses web search for both technical and business/market research
- Focuses on shipping and strategic product decisions
- Honest about uncertainty - researches instead of hallucinating
- Conversational and direct - skips AI assistant fluff

### 4. Environment Configuration

Updated `/README.md` to document the new environment variable:

```bash
EXA_API_KEY="your_exa_api_key"  # For Exa.ai web search in HAL Chat
```

## How It Works

### Regular Chat Mode (with Web Search)

1. **User Query**: User discusses their project, asks questions, or mentions being stuck
2. **Strategic Decision**: The Advisor (as a cofounder) decides if research would add value
3. **Tool Execution**: If needed, searches for current patterns, real solutions, or verifies assumptions
4. **Result Processing**: Exa returns relevant, up-to-date information
5. **Cofounder Response**: Synthesizes findings into strategic advice, not just documentation quotes
6. **Natural Integration**: No "I searched and found..." - just direct, confident answers backed by research

### Suggestions Mode (Quick Wins)

The Advisor also generates structured project suggestions in a separate mode:

- **Automatic generation**: Triggered after completing code changes
- **Manual generation**: Users can click "Generate Project Suggestions"
- **No web search in suggestions**: Suggestions are based on project analysis and conversation memory
- **Encourages chat**: Suggestions prompt users to chat with the Advisor for research-backed advice

Users can then chat with the Advisor about any suggestion to get deeper insights, market research, or competitor analysis.

## Use Cases

The Advisor strategically researches:

**Technical:**

- **Version-specific APIs**: "They mentioned Next.js 15 - let me verify the current auth pattern"
- **Real error solutions**: "This error - let me find what actually worked for others"
- **Breaking changes**: "Is this pattern still valid or did things change?"
- **Implementation reality**: "What are people actually using, not what was trendy in 2023?"
- **Stack-specific patterns**: "How does this work with their exact setup?"

**Business/Market:**

- **Competitor analysis**: "What features do similar products have?"
- **Pricing research**: "What do competitors charge and how do they structure it?"
- **Market demand**: "Is there actual demand for this feature?"
- **User expectations**: "What do users expect from this type of product?"
- **Positioning**: "How are successful products in this space marketing themselves?"

**Not for:**

- Generic "what is React?" questions
- Concepts the user clearly understands
- Situations where training data is sufficient
- Documentation that hasn't changed in years

## Configuration

### Required Environment Variable

Set the Exa API key in your environment:

```bash
EXA_API_KEY="your_api_key_here"
```

Get your API key from: [https://exa.ai](https://exa.ai)

### Tool Settings

The tool is configured with the following defaults:

- **Max Results**: 3 per search
- **Live Crawl**: Always enabled
- **Content Length**: 1000 characters per result
- **Search Type**: Automatic (Exa determines best search method)

## Technical Notes

### AI SDK Integration

The tool uses the AI SDK's `tool()` function with the following structure:

```typescript
tool({
  description: string,  // Detailed description for the AI
  inputSchema: z.object({...}),  // Zod schema for parameters
  execute: async ({ query }) => {...}  // Async execution function
})
```

### Error Handling

The tool gracefully handles errors by:

1. Catching all exceptions in the execute function
2. Logging errors to console with `[Exa Tool]` prefix
3. Returning a structured error response with `success: false`
4. Allowing the AI to continue without web search if the tool fails

### Security

- API key is stored as an environment variable
- No user data is sent to Exa (only search queries)
- Results are processed server-side only
- Tool execution happens within authenticated routes

## Future Enhancements

Potential improvements:

1. Add caching for frequently searched queries
2. Track search usage for analytics
3. Allow users to control search preferences
4. Add more search parameters (domain filtering, date ranges)
5. Implement search result citations in responses
6. Add PostHog tracking for search tool usage

## Testing

To test the integration:

1. Ensure `EXA_API_KEY` is set in your environment
2. Start the development server: `pnpm dev`
3. Open HAL Chat (The Advisor) for any project
4. Have a real conversation about the project:

   **Technical questions:**
   - "I'm getting this error with Next.js 15 auth..."
   - "Should we use server actions or API routes for this?"
   - "What's the current way to handle file uploads in React?"

   **Business/market questions (triggers web search):**
   - "What are competitors charging for this type of product?"
   - "What features do similar apps have?"
   - "Is there demand for [feature]? What are people saying about it?"

   **Suggestion generation:**
   - Click "Generate Project Suggestions" to get structured improvement ideas
   - Suggestions are based on project analysis (no web search)
   - Chat with the Advisor about suggestions to get research-backed advice

The Advisor should act like a cofounder - staying in context, researching when needed (both technical and market), and providing strategic advice that goes beyond what you'd get from copy-pasting into ChatGPT.

**What "Good" Looks Like:**

- Advisor remembers what you built in previous messages
- Uses web search for both technical patterns AND market/competitor research in chat mode
- Generates focused suggestions based on project state
- Challenges your assumptions constructively
- Focuses on shipping, not perfect architecture
- Talks like a cofounder, not an AI assistant

## References

- [Exa.ai Documentation](https://docs.exa.ai)
- [Exa JavaScript SDK](https://docs.exa.ai/sdks/typescript-sdk-specification)
- [Vercel AI SDK - Tool Calling](https://sdk.vercel.ai/docs/ai-sdk-core/tools-and-tool-calling)
- [AI SDK Integration Example](https://docs.exa.ai/reference/vercel)
