# Advisor Multi-Hat Tab System Implementation

## Overview
Implemented a comprehensive tab system for the Advisor section that allows users to open multiple specialized advisor "hats", each with independent conversation histories and specialized prompts.

## Implementation Date
November 4, 2025

## Architecture

### 1. Database Schema (`packages/database/prisma/schema.prisma`)
- **Added `hatType` field** to `HalChatMessage` model with default value `'generalist'`
- **Added `hatType` field** to `HalSuggestion` model with default value `'generalist'`
- **Added index** on `[projectId, hatType, createdAt]` for efficient filtering
- **Backward compatible**: All existing messages default to 'generalist' hat

### 2. Hat Definitions (`apps/web/src/lib/advisor-hats.ts`)
Created comprehensive hat system with 10 specialized advisors:
- **Generalist Advisor**: Broad strategic guidance (default)
- **Design Advisor**: UI/UX design and visual improvements
- **Code Advisor**: Technical implementation and architecture
- **Product Advisor**: Product strategy and roadmap
- **Analytics Advisor**: Data analysis and insights
- **Security Advisor**: Security best practices and audits
- **Performance Advisor**: Speed and optimization
- **Marketing Advisor**: Marketing strategy and growth
- **SEO Advisor**: Search engine optimization
- **Accessibility Advisor**: Accessibility and inclusive design

Each hat includes:
- Unique icon (Lucide React)
- Color scheme
- Description
- Specialized system prompt addition

### 3. State Management (`apps/web/src/lib/hal-assistant-state.ts`)
Added Jotai atoms for tab management:
- `advisorActiveTabsAtom`: Array of open tabs (persisted to localStorage)
- `advisorCurrentTabAtom`: Currently selected tab (not persisted)
- `advisorPinnedHatsAtom`: Array of pinned hats for mini popup (persisted to localStorage)

All atoms persist across browser sessions using `atomWithStorage`.

### 4. Backend API Updates

#### `/api/hal-chat/route.ts`
- **Accepts `hatType` parameter** in request body (defaults to 'generalist')
- **Filters messages** by `projectId` and `hatType` for context loading
- **Injects specialized system prompt** based on hat configuration
- **Saves messages** with `hatType` for proper conversation separation

#### `/api/hal-chat/suggestions/route.ts`
- **Accepts `hatType` parameter** in request body
- **Generates hat-specific suggestions** using specialized prompts
- **Saves suggestions** with `hatType` for filtering

#### `/api/hal-chat/messages/route.ts`
- **Accepts optional `hatType` query parameter** for filtering
- **Returns chronological timeline** filtered by hat type
- **Backward compatible**: Works without hatType for legacy usage

### 5. UI Components

#### `AdvisorTabBar.tsx`
- **Uses shadcn Tabs component** (`TabsList` and `TabsTrigger`) for accessibility
- Displays active tabs with icons and names
- Close buttons for tabs (minimum 1 tab required)
- "+" button to open hat selector modal
- Tooltip on hover showing hat description
- Horizontal scrolling for many tabs
- Styled with Tailwind CSS

#### `AdvisorHatSelector.tsx`
- Modal dialog for choosing new advisor hats
- Grid layout showing all available hats
- Shows "Open" indicator for already-active hats
- Prevents opening duplicate tabs
- Displays hat icon, name, and description

#### `HalSuggestionsChat.tsx` (Major Updates)
- **Uses shadcn Tabs component** as wrapper when `showTabs` is true
- **New Props**:
  - `hatType?: AdvisorHatType` - For mini popup (pinned hats)
  - `showTabs?: boolean` - Show tab bar (false for mini popup)
- **Tab Management**:
  - Uses Jotai atoms for active tabs and current tab
  - Handlers for tab change, close, and add
  - Reloads messages when switching tabs
  - `Tabs` component wraps content with `value={currentTab}` for state sync
- **Hat-Specific Requests**:
  - Passes `hatType` to all API calls
  - Filters messages by effective hat type
  - Uses `effectiveHatType` (currentTab for full panel, hatType prop for mini popup)
- **Tab Bar Integration**:
  - Renders `AdvisorTabBar` in full panel mode
  - Renders `AdvisorHatSelector` modal
  - Updates header title based on selected hat

#### `HalAssistant.tsx` (Mini Popup Updates)
- **Pinned Hats Support**:
  - Reads `pinnedHats` from Jotai atom
  - Maintains `selectedPinnedHat` state
  - Renders mini tab bar when multiple hats are pinned
- **Passes Props**:
  - `hatType={selectedPinnedHat}` to HalSuggestionsChat
  - `showTabs={false}` to hide full tab bar in popup

### 6. User Experience

#### Full Panel (ResizablePanel)
- **Tab Bar** at the top showing all open advisor hats
- **"+" Button** to open hat selector and add new specialized advisors
- **Independent Conversations**: Each hat maintains its own chat history
- **Persistent State**: Open tabs and their order saved to localStorage
- **No Limit**: Users can open unlimited tabs
- **Close Tabs**: Click X on any tab (except when it's the last one)

#### Mini Popup (DropdownMenu)
- **Pinned Hats Tabs**: Small tab bar showing pinned advisors
- **Quick Switching**: Click tabs to switch between pinned hats
- **Independent**: Doesn't affect full panel tab state
- **Generalist Default**: Always includes generalist hat

### 7. Key Features

✅ **Independent Conversations**: Each hat has completely separate chat history
✅ **Persistent Tabs**: Open tabs and order saved across browser sessions  
✅ **Specialized Prompts**: Each hat uses domain-specific system prompts
✅ **Specialized Suggestions**: AI generates suggestions relevant to each hat's expertise
✅ **No Tab Limit**: Users can open as many hats as needed
✅ **Mini Popup for Pinned**: Quick access to favorite hats via mini popup
✅ **Backward Compatible**: Existing conversations continue to work as "generalist"
✅ **Real-time Switching**: Instant tab switching with proper message loading

### 8. Files Modified

**Created:**
- `/apps/web/src/lib/advisor-hats.ts`
- `/apps/web/src/components/AdvisorTabBar.tsx`
- `/apps/web/src/components/AdvisorHatSelector.tsx`

**Modified:**
- `/packages/database/prisma/schema.prisma`
- `/apps/web/src/lib/hal-assistant-state.ts`
- `/apps/web/src/app/api/hal-chat/route.ts`
- `/apps/web/src/app/api/hal-chat/suggestions/route.ts`
- `/apps/web/src/app/api/hal-chat/messages/route.ts`
- `/apps/web/src/components/HalSuggestionsChat.tsx`
- `/apps/web/src/components/HalAssistant.tsx`

### 9. Migration Notes

**Database Migration Required:**
```bash
cd packages/database
npx prisma migrate dev --name add_hat_type_backward_compatible
```

The migration adds:
- `hatType` column to `hal_chat_messages` with default 'generalist'
- `hatType` column to `hal_suggestions` with default 'generalist'
- Index on `(projectId, hatType, createdAt)` for performance

**Data Migration:**
All existing messages automatically default to 'generalist' hat type, ensuring backward compatibility.

### 10. Testing Checklist

- [ ] Open full Advisor panel and verify tab bar appears
- [ ] Click "+" button and select different advisor hats
- [ ] Verify each hat maintains independent conversation history
- [ ] Close tabs and verify at least one tab always remains
- [ ] Refresh browser and verify tabs persist
- [ ] Open mini popup and verify pinned hats tabs appear
- [ ] Switch between pinned hats in mini popup
- [ ] Send messages in different hats and verify they're saved with correct hatType
- [ ] Generate suggestions for different hats and verify specialization
- [ ] Verify existing conversations still work (defaulting to generalist)

### 11. Future Enhancements

Possible future improvements:
- **Pin/Unpin Management**: UI to add/remove hats from pinned list
- **Custom Hat Colors**: User-customizable color schemes per hat
- **Hat-Specific Tools**: Different tool access based on hat type
- **Conversation Export**: Export conversations per hat
- **Keyboard Shortcuts**: Quick switching between hats (Cmd+1, Cmd+2, etc.)
- **Hat Templates**: Save custom hat configurations
- **Collaborative Hats**: Share specific hat conversations with team members

### 12. Technical Considerations

**Performance:**
- Messages are filtered by `hatType` at the database level (indexed)
- Only current hat's messages are loaded into context
- Tab state changes trigger efficient message reloading

**Scalability:**
- No limit on number of open tabs (UI handles horizontal scrolling)
- Each hat's conversation is independent and bounded by API limits
- LocalStorage used for persistence (minimal overhead)

**UX:**
- Smooth tab switching with loading states
- Clear visual distinction between active and inactive tabs
- Tooltips provide context for each hat's purpose
- Modal selector prevents accidental duplicate tabs

## Summary

This implementation transforms the Advisor from a single general-purpose assistant into a multi-faceted advisory system where users can consult specialized experts for different aspects of their project. Each "hat" maintains its own context and expertise, providing more focused and relevant guidance while preserving conversation history independently.

