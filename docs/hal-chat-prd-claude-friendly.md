# HAL Chat & Suggestions System – Claude Code Friendly PRD

## Current State Analysis & User Flow Requirements

**Desired User Flow:**
1. User starts new project → AI generates code → AI completion triggers suggestions generation + HAL panel opens
2. User sees generated suggestions, can click them to send to main chat
3. User can also chat directly with HAL in the same panel (separate from suggestions)
4. User starts another generation in main chat → AI completion triggers NEW suggestions generation
5. **Key requirement:** New suggestions appear BELOW previous HAL conversation chronologically

**Current Implementation Issues:**

✅ **Backend Complete:**
- HAL Chat API endpoint (`/api/hal-chat/route.ts`) - streaming, authentication, credit deduction, PostHog analytics
- Database models (`HalChatMessage`, `HalSuggestion`) in Prisma schema
- Messages retrieval endpoint (`/api/hal-chat/messages/route.ts`)

❌ **Frontend Architecture Problems:**
- `HalAssistant.tsx` - Only handles suggestions in a modal (not the desired flow)
- `HalSuggestionsChat.tsx` - Designed for chronological flow but not integrated properly
- Missing proper chronological ordering of suggestions + chat messages
- No integration with main project view to trigger on AI completion

## What Needs to be Done

### 1. Component Architecture Fix

**Problem:** Need to merge best parts of both components into a single chronological interface.

**Solution:**
- [ ] Use `HalAssistant.tsx` as the trigger (HAL icon with indicator)
- [ ] Refactor `HalSuggestionsChat.tsx` to be the main panel interface
- [ ] Implement chronological message + suggestion display
- [ ] Connect both components to work together

### 2. Chronological Ordering Implementation

**Problem:** Need suggestions and chat messages to appear in chronological order.

**Tasks:**
- [ ] Modify database queries to fetch both `HalChatMessage` and `HalSuggestion` ordered by `createdAt`
- [ ] Create unified message type that handles both chat and suggestions
- [ ] Update UI to render suggestions and chat messages in single chronological stream
- [ ] Ensure new suggestions appear below existing conversation

### 3. Integration with Main Project Flow

**Problem:** HAL needs to trigger automatically after AI code generation.

**Tasks:**
- [ ] Find where AI code generation completes in main project
- [ ] Add trigger to generate suggestions and open HAL panel
- [ ] Ensure HAL icon shows indicator when new suggestions available
- [ ] Connect suggestion clicks to main chat interface

## Simplified Implementation Plan

### Phase 1: Fix Chronological Message Display (Priority 1)
```typescript
// Goal: Single panel showing chat messages + suggestions chronologically
1. Create unified data fetching for HalChatMessage + HalSuggestion tables
2. Update HalSuggestionsChat.tsx to display both types chronologically  
3. Implement proper message types and UI rendering
4. Connect to existing /api/hal-chat/route.ts for chat functionality
```

### Phase 2: Connect Components (Priority 2)
```typescript
// Goal: HalAssistant.tsx triggers HalSuggestionsChat.tsx panel
1. Modify HalAssistant.tsx to open HalSuggestionsChat as main interface
2. Remove old suggestions modal from HalAssistant.tsx
3. Pass proper props between components for state management
4. Ensure HAL icon shows indicators correctly
```

### Phase 3: AI Generation Integration (Priority 3)
```typescript
// Goal: Auto-trigger suggestions after AI code generation
1. Find AI completion hooks in main project interface
2. Add automatic suggestion generation trigger
3. Add automatic HAL panel opening with new suggestions
4. Connect suggestion clicks to main chat (onSuggestionClick prop)
```

### Phase 4: Polish & Data Flow (Priority 4)
```typescript
// Goal: Production ready with proper data persistence
1. Ensure suggestions are saved to HalSuggestion table correctly
2. Test chronological ordering works across sessions
3. Add error handling and loading states
4. Test the full user flow end-to-end
```

## Technical Implementation Details

### Required File Changes

**Main Files to Modify:**
1. `src/components/HalSuggestionsChat.tsx` - Main chronological interface (Priority 1)
2. `src/components/HalAssistant.tsx` - Trigger component, remove modal (Priority 2)  
3. `src/modules/projects/ui/view/v2-project-view.tsx` - Integration point (Priority 3)
4. **New API needed**: Unified endpoint to fetch both messages and suggestions chronologically

### Required New API Endpoint
```typescript
// New endpoint needed: /api/hal-chat/messages/route.ts (or extend existing)
GET /api/hal-chat/messages?projectId=xxx
- Returns: Unified array of { type: 'message' | 'suggestions', data: {...}, createdAt }
- Ordered by createdAt DESC for chronological display

// Existing endpoints to keep using:
POST /api/hal-chat/route.ts - For streaming chat
POST /api/hal-suggestions/ - For generating suggestions  
POST /api/hal-suggestions/track - For tracking clicks
```

### Database Models (Already Exist)
```prisma
model HalChatMessage {
  id        String   @id @default(uuid())
  projectId String
  userId    String
  role      String   // 'user' | 'assistant'
  content   String
  createdAt DateTime @default(now())
  // Relations exist
}

model HalSuggestion {
  id           String   @id @default(uuid())
  projectId    String
  userId       String
  title        String
  description  String
  prompt       String
  category     String?
  clicked      Boolean  @default(false)
  createdAt    DateTime @default(now())
  // Relations exist
}
```

## Success Criteria (Based on Your User Flow)

### Must Have (MVP)
- [ ] HAL icon triggers panel (like current HalAssistant.tsx)
- [ ] Panel shows suggestions + chat messages in chronological order
- [ ] User can chat with HAL using `/api/hal-chat/route.ts`
- [ ] Suggestion clicks send message to main chat via `onSuggestionClick` prop

### Should Have (V1) 
- [ ] AI code generation automatically triggers suggestion generation
- [ ] New suggestions appear BELOW previous HAL conversation
- [ ] HAL icon shows indicator when new suggestions available
- [ ] Proper persistence across browser sessions

### Could Have (Future)
- [ ] Manual suggestion regeneration
- [ ] HAL memory reset functionality  
- [ ] Enhanced suggestion categories
- [ ] Analytics on suggestion usage patterns

## Implementation Notes for Claude Code

1. **Key Insight:** `HalSuggestionsChat.tsx` is designed for your chronological flow but needs completion
2. **Architecture:** Use `HalAssistant.tsx` as trigger + `HalSuggestionsChat.tsx` as main interface
3. **Database Ready:** Use existing `HalChatMessage` and `HalSuggestion` models, no migrations needed
4. **Backend Works:** HAL chat streaming endpoint at `/api/hal-chat/route.ts` is fully functional
5. **Missing Piece:** Unified data fetching to show messages + suggestions chronologically

## Implementation Order

**Phase 1 (Core Fix):**
1. Create unified API to fetch both `HalChatMessage` and `HalSuggestion` by `projectId` ordered by `createdAt`  
2. Update `HalSuggestionsChat.tsx` to use this unified data and display chronologically
3. Ensure chat functionality works with existing `/api/hal-chat/route.ts`

**Phase 2 (Component Integration):**
4. Modify `HalAssistant.tsx` to open `HalSuggestionsChat.tsx` instead of its own modal
5. Pass proper props for state management and suggestion click handling

**Phase 3 (User Flow Integration):** 
6. Find where AI generation completes in project view and add HAL triggers
7. Test the full user flow: generation → suggestions → chat → new generation → new suggestions below chat

## Critical Requirements

- **Chronological Order:** New suggestions must appear below existing HAL conversation
- **Persistence:** Messages and suggestions must persist across browser sessions  
- **Integration:** Suggestion clicks must send to main chat via `onSuggestionClick`
- **Automatic Triggering:** HAL should open automatically after AI code generation

This PRD is now aligned with your actual desired user flow and existing codebase architecture.