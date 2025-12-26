# Mem0 Integration Guide

## Overview

We've integrated **mem0** as our conversational memory system for the AI Advisor chat. This replaces the previous static project analysis approach with an intelligent, context-aware memory system that:

- **Remembers conversations** across sessions
- **Learns from interactions** to provide better context
- **Anticipates user needs** by understanding their project journey
- **Focuses on empathy** rather than metrics

## Why Mem0?

### Previous Approach (Removed)
- **Static Project Analysis** (`project-analyzer.ts`) - analyzed code metrics upfront
- Generated reports on code quality, complexity, test coverage, etc.
- Token-heavy and not conversational
- Focused on technical metrics users don't care about

### New Approach (Mem0)
- **Conversational Memory** - learns from actual conversations
- Retrieves relevant context on-demand
- Lightweight and empathetic
- Focuses on user goals and project journey

## Setup

### 1. Install Dependencies

```bash
pnpm add mem0ai
```

### 2. Environment Variables

Add your Mem0 API key to `.env`:

```bash
MEM0_API_KEY=your_mem0_api_key_here
```

Get your API key from [mem0.ai](https://mem0.ai)

### 3. Usage

The integration is automatic! Mem0 is used in:

- **HAL Advisor Chat** (`/api/hal-chat`) - conversational memory for project advice

## How It Works

### Adding Memories

Conversations are automatically saved to mem0 after each AI response:

```typescript
await Mem0MemoryManager.addMemory({
  userId: session.user.id,
  projectId,
  messages: [
    { role: "user", content: "How do I add authentication?" },
    { role: "assistant", content: "I can help you set up authentication..." },
  ],
  metadata: {
    projectName: "My Project",
    timestamp: new Date().toISOString(),
  },
});
```

### Retrieving Context

Before generating a response, mem0 searches for relevant memories:

```typescript
const mem0Context = await Mem0MemoryManager.buildContextForAI({
  userId: session.user.id,
  projectId,
  currentMessage: "What should I work on next?",
});
```

This context is injected into the system prompt so the AI "remembers" previous conversations.

### Memory Operations

```typescript
// Search memories
const memories = await Mem0MemoryManager.searchMemories({
  userId,
  projectId,
  query: "authentication",
  limit: 5,
});

// Get all memories
const allMemories = await Mem0MemoryManager.getAllMemories({
  userId,
  projectId,
});

// Delete memories
await Mem0MemoryManager.deleteMemory(memoryId);

// Delete all memories for a project
await Mem0MemoryManager.deleteAllMemories({
  userId,
  projectId,
});
```

## Benefits

### User Experience
- **Feels like a mentor** who remembers your journey
- **Anticipates next steps** instead of just answering questions
- **References past work** naturally in conversation
- **Avoids repetition** by understanding context

### Technical Benefits
- **Token-efficient** - only retrieves relevant context
- **Scalable** - works across long project timelines
- **Privacy-aware** - memories are scoped to user+project
- **Non-blocking** - memory operations don't slow down responses

## Enhanced System Prompt

The AI advisor now has an empathetic, forward-thinking personality:

```
You are Shipper Advisor, an empathetic AI mentor who helps users build their web projects.

## Your Personality:
- Empathetic: You remember the conversation and understand what they're building
- Forward-thinking: Anticipate the next logical step
- Conversational: Talk like a mentor, not a code generator
- Context-aware: Reference what they've built and where they're headed

## Your Approach:
1. Remember the journey - what worked, what didn't
2. Think ahead - suggest next steps before they ask
3. Be practical - focus on features and goals, not metrics
4. Ask clarifying questions instead of assuming
```

## Migration Notes

### Removed Files
- `src/lib/hal/project-analyzer.ts` - static code analysis
- `src/lib/hal/suggestion-generator.ts` - template-based suggestions

### Modified Files
- `src/app/api/hal-chat/route.ts` - now uses mem0 for context
- `src/lib/agent-memory.ts` - can be deprecated (replaced by `mem0-memory.ts`)

### New Files
- `src/lib/mem0-memory.ts` - mem0 integration wrapper

## Future Enhancements

- **Project state tracking** - remember what features are built
- **Code exploration memory** - remember which files were discussed
- **Learning preferences** - adapt to user's communication style
- **Cross-project insights** - learn patterns across user's projects

## Troubleshooting

### Memory not persisting
- Check `MEM0_API_KEY` is set correctly
- Verify network connectivity to mem0.ai
- Check console logs for mem0 errors

### Context not appearing
- Ensure conversations are being saved (check logs)
- Verify `userId` and `projectId` are consistent
- Try with a fresh conversation to test

### API Rate Limits
- Mem0 has usage limits based on your plan
- Implement caching if needed
- Consider batching memory operations

## Resources

- [Mem0 Documentation](https://docs.mem0.ai)
- [Mem0 Dashboard](https://app.mem0.ai)
- [Mem0 GitHub](https://github.com/mem0ai/mem0)
