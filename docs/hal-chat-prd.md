# HAL Chat & Suggestions System – Product Requirements Document (PRD)

## Overview

This document describes the requirements and architecture for the HAL Chat and Suggestions system in Shipper-webapp. The goal is to provide users with contextual AI-generated suggestions after code generation, as well as a dedicated HAL chat interface for freeform AI conversations. Suggestions and HAL chat are independent, and both are chronologically ordered and tied to the project context.

---

## Goals

- Enable users to receive actionable AI-generated suggestions after each code generation.
- Allow users to interact with HAL (AI assistant) in a dedicated chat panel for freeform questions and guidance.
- Ensure suggestions and HAL chat messages are independent, ordered by creation time, and persistently stored.
- Provide a clear, intuitive UI for accessing suggestions and HAL chat, with appropriate indicators for new content.

---

## User Stories

1. **As a user, I want to see AI-generated suggestions after code generation, so I can quickly take next steps.**
2. **As a user, I want to chat with HAL about any topic (e.g., SEO, tech stack), not just suggestions, so I can get expert advice.**
3. **As a user, I want suggestions and HAL chat messages to be saved and ordered chronologically, so I can review my project history.**
4. **As a user, I want to be notified (via icon indicator) when new suggestions are available, so I don’t miss important updates.**
5. **As a user, I want to send suggestions to the main chat, not HAL chat, so my project workflow remains consistent.**

---

## Functional Requirements

### Suggestions

- Generated after each AI code generation.
- Displayed as a list, ordered by creation time.
- Clicking a suggestion sends it as a message to the main chat.
- Suggestions are stored in the database, tied to the project.

### HAL Chat

- Accessible via a dedicated panel (opened by clicking the HAL icon).
- HAL icon displays an indicator when new suggestions are available.
- Users can ask any question; HAL responds in a streaming fashion.
- HAL chat messages are stored in the database, tied to the project.
- HAL chat is independent of suggestions (not grouped or linked).

### Ordering & Persistence

- Suggestions and HAL chat messages are both ordered by creation time.
- Both are tied to the current project context.
- UI displays suggestions and HAL chat in separate panels or sections.

### Endpoints

- **Suggestions Endpoint:** Existing endpoint for generating and retrieving suggestions.
- **HAL Chat Endpoint:** New endpoint for streaming HAL chat messages, modeled after `/api/chat/route.ts`.

---

## Non-Functional Requirements

- **Performance:** Streaming responses for HAL chat must be fast and responsive.
- **Security:** All endpoints require authentication and project access checks.
- **Scalability:** System must support multiple concurrent users and projects.
- **Reliability:** Suggestions and chat messages must be persistently stored and retrievable.

---

## Data Model

### Prisma Schema

```prisma
model Suggestion {
  id            String   @id @default(uuid())
  projectId     String
  suggestionText String
  createdAt     DateTime @default(now())
  order         Int
}

model HalChatMessage {
  id           String   @id @default(uuid())
  projectId    String
  role         String   // 'user' or 'assistant'
  content      String
  createdAt    DateTime @default(now())
  order        Int
}
```

---

## API Design

### HAL Chat Endpoint (`/api/hal-chat/route.ts`)

- **POST**: Accepts a user message, projectId.
- Authenticates user and checks project access.
- Deducts credits if required.
- Streams HAL assistant response (SSE).
- Saves user and assistant messages to `HalChatMessage` table.

### Suggestions Endpoint

- Existing endpoint for generating and retrieving suggestions.
- Suggestions are saved to `Suggestion` table.

---

## UI/UX Requirements

- **HAL Icon:** Shows indicator when new suggestions are available.
- **Suggestions Panel:** Chronologically ordered list of suggestions.
- **HAL Chat Panel:** Chronologically ordered list of HAL chat messages.
- **Main Chat:** Receives suggestion messages when clicked.
- **Separation:** Suggestions and HAL chat are visually and functionally distinct.

---

## Edge Cases & Considerations

- HAL chat messages are not tied to suggestions; users can ask anything.
- Multiple suggestions may be generated per code generation.
- Suggestions and HAL chat messages must not be lost if the user navigates away.
- Proper error handling for authentication, credit deduction, and streaming failures.

---

## Success Metrics

- Users engage with suggestions and HAL chat.
- Suggestions are acted upon (sent to main chat).
- HAL chat is used for freeform questions.
- No loss of data or ordering issues in suggestions or chat history.
- UI indicators correctly notify users of new suggestions.

---

## Future Extensions

- Grouping HAL chat messages by topic or session.
- Analytics on suggestion usage and HAL chat engagement.
- Enhanced suggestion generation based on project context and user history.

---

## Developer Notes

- HAL chat endpoint: `/api/hal-chat/route.ts` (streaming, credit, persistence)
- Suggestions endpoints: `/api/hal-suggestions/`, `/api/hal-suggestions/messages`, `/api/hal-suggestions/track`, `/api/hal-suggestions/click`
- Project context (`projectId`) must be passed in all API calls.
- Prisma models: `HalChatMessage`, `HalSuggestion`
- Error handling: All endpoints return clear error responses; UI shows actionable toasts.
- UI tests: See `src/components/__tests__/HalAssistant.test.tsx` and `src/components/__tests__/HalSuggestionsChat.test.tsx`

## User Guide

- After code generation, HAL will suggest next steps. Click the HAL icon to view suggestions.
- Suggestions can be sent to the main chat by clicking them.
- You can chat with HAL about any topic; responses stream in real time.
- If you run out of credits, you’ll see a notification and can purchase more.
- All chat and suggestion history is saved per project.

## Appendix

- Reference: `/src/app/api/chat/route.ts` for streaming chat implementation.
- All new endpoints and models must follow existing authentication and credit management patterns.

---

## Tasks & Implementation Plan

### 1. **Backend**

- [x] **Design Prisma schema** for `Suggestion` and `HalChatMessage` models.
- [x] **Create migration** for new tables.
- [x] **Implement HAL chat endpoint** (`/api/hal-chat/route.ts`):
  - Auth check
  - Credit deduction logic
  - Streaming response (SSE)
  - Save messages to DB
- [x] **Update suggestions endpoint** (if needed) to ensure ordering and persistence.
- [x] **Write unit/integration tests** for new endpoints and DB logic.

### 2. **Frontend**

- [x] **Update UI to show HAL icon indicator** when new suggestions are available.
- [x] **Implement suggestions panel** (chronological order, click to send to main chat).
- [x] **Implement HAL chat panel** (chronological order, streaming responses).
- [x] **Ensure separation of suggestions and HAL chat in the UI.**
- [x] **Handle error states** (auth, streaming, credit, etc.).
- [x] **Write UI tests** for new components and flows.

### 3. **Integration**

- [x] **Connect frontend to new HAL chat endpoint** (streaming, message persistence).
- [x] **Connect frontend to suggestions endpoint** (ordering, click-to-main-chat).
- [x] **Ensure project context is passed correctly to both endpoints.**

### 4. **QA & Validation**

- [x] **Test suggestion generation and ordering.**
- [x] **Test HAL chat streaming and message persistence.**
- [x] **Test UI indicator for new suggestions.**
- [x] **Test sending suggestions to main chat.**
- [x] **Test edge cases** (navigation, multiple users, credit errors).

### 5. **Documentation**

- [x] **Update developer docs** for new endpoints and data models.
- [x] **Update user docs/help** for new HAL chat and suggestions features.
