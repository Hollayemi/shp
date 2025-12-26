# Complexity-Based Model Selection

## Overview

Updated the chat API route to use complexity-based model selection instead of just checking if it's the initial build.

## Previous Behavior

- **First user message**: Used `INITIAL_FULL_STACK_DEVELOPER_MODEL` (more powerful model)
- **All subsequent messages**: Used `FULL_STACK_DEVELOPER_MODEL` (smaller, faster model)

## New Behavior

The system now selects the model based on task complexity:

### Complex Model (INITIAL_FULL_STACK_DEVELOPER_MODEL)

Used when:

1. **First build** (always) - ensures quality initial setup
2. **Complex tasks** - complexity category is "complex"
3. **Advanced tasks** - complexity category is "advanced"

### Fast Model (FULL_STACK_DEVELOPER_MODEL)

Used when:

- Follow-up messages with **simple** or **moderate** complexity

## Complexity Categories

From `complexity-analyzer.ts`:

- **Simple** (0-2): Basic styling, text changes, simple component modifications
- **Moderate** (3-5): Component creation, basic functionality, simple integrations
- **Complex** (6-8): Full pages, system integrations, advanced components
- **Advanced** (9-10): Complete applications, complex algorithms, multiple system integration

## Benefits

1. **Better resource allocation**: Uses powerful model only when needed
2. **Cost optimization**: Reduces costs for simple follow-up tasks
3. **Quality assurance**: Complex tasks always get the best model regardless of conversation position
4. **Smarter selection**: Based on actual task complexity rather than arbitrary position in conversation

## Changes Made

### 1. Store Complexity Analysis

```typescript
// Store complexity analysis for model selection
let complexityAnalysis: ComplexityAnalysis | undefined;
```

### 2. Updated Model Selection Logic

```typescript
// Use complex model for:
// 1. First build (always)
// 2. Complex or advanced tasks (regardless of build number)
const shouldUseComplexModel =
  isFirstUserMessage ||
  complexityAnalysis?.category === "complex" ||
  complexityAnalysis?.category === "advanced";

const modelToUse = shouldUseComplexModel
  ? INITIAL_FULL_STACK_DEVELOPER_MODEL
  : FULL_STACK_DEVELOPER_MODEL;
```

### 3. Enhanced Logging

Added detailed logging that shows:

- Whether it's the first user message
- The complexity category
- Whether the complex model is being used
- The reason for model selection

### 4. PostHog Analytics

Updated PostHog tracking to include:

- `shouldUseComplexModel`: Boolean flag
- `taskComplexity`: The complexity category (simple/moderate/complex/advanced)

## Example Scenarios

### Scenario 1: Initial Build

- **Message**: "Create a landing page with hero section"
- **Model**: Complex model (first build)
- **Reason**: Always use complex model for initial builds

### Scenario 2: Simple Follow-up

- **Message**: "Make the button blue"
- **Complexity**: Simple
- **Model**: Fast model
- **Reason**: Simple task doesn't need complex model

### Scenario 3: Complex Follow-up

- **Message**: "Add authentication with OAuth providers"
- **Complexity**: Complex
- **Model**: Complex model
- **Reason**: Complex task needs powerful model even on follow-up

### Scenario 4: Advanced Follow-up

- **Message**: "Integrate payment processing with Stripe and subscription management"
- **Complexity**: Advanced
- **Model**: Complex model
- **Reason**: Advanced task needs most powerful model

## Monitoring

You can monitor model selection in PostHog with the new properties:

- Filter by `shouldUseComplexModel` to see when complex model is used
- Group by `taskComplexity` to see distribution of task complexities
- Compare costs and performance between model types
