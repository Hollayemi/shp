# Visual Editing Undo/Redo Analysis

## Current Visual Editing Flow

### 1. **User Interaction**
- User clicks "Visual Edit" button in Chat.tsx
- `visualEditingModeAtom` is set to `true`
- PostMessage sent to iframe to enable visual editor overlay
- User can hover and click elements in the preview

### 2. **Element Selection**
- When user clicks an element, `monitor.js` (in iframe) extracts:
  - `selector`: CSS selector
  - `xpath`: XPath for unique identification
  - `shipperId`: Auto-generated ID from Vite plugin (e.g., "App.tsx:42:4")
  - `componentName`: Component name or tag
  - `currentStyles`: Computed styles, Tailwind classes, inline styles
  - `position`: x, y, width, height
  - `textContent`: Element text (truncated to 100 chars)
  - `isRepeated`: Whether element appears multiple times
  - `instanceIndex`: Index in repeated set
  - `attributes`: All HTML attributes

### 3. **Style Changes**
- User can:
  - **Direct style edit**: Change styles via UI controls
  - **Text edit**: Modify text content directly
  - **AI description**: Describe changes in natural language

### 4. **Applying Changes** (`applyDirectVisualEdit` procedure)
1. Validates project access
2. Gets sandbox info
3. Reads current file content from Modal API
4. Updates Tailwind classes using AST manipulation (`updateFileWithTailwindAST`)
5. Updates text content if provided (`updateFileWithTextAST`)
6. Validates JSX content
7. Writes updated file back to sandbox
8. **Creates a snapshot V2Fragment** with:
   - Title: `"Visual edit snapshot - {timestamp}"`
   - All project files (copied from current active fragment)
   - Updated file with changes
9. Updates project's `activeFragmentId` to new fragment

## Current Fragment System

### Fragment Structure
```typescript
{
  id: string
  title: string
  files: Record<string, string>  // filepath -> content
  projectId: string
  createdAt: Date
}
```

### Fragment History
- Every visual edit creates a NEW fragment
- Fragments are stored in chronological order
- User can view fragment history in sidebar
- User can restore previous fragments via `loadV2Fragment`
- Active fragment is tracked via `project.activeFragmentId`

## Problem: No Component-Level Undo

### Current Limitation
- **Entire project state** is saved per fragment
- No way to undo a SINGLE component change
- User must restore entire previous fragment to undo
- This reverts ALL changes since that fragment, not just one component

### Example Scenario
1. User edits Button component (Fragment A created)
2. User edits Header component (Fragment B created)
3. User edits Footer component (Fragment C created)
4. User wants to undo Footer change only
5. **Current behavior**: Must restore Fragment B (loses Footer change but keeps Button + Header)
6. **Desired behavior**: Undo only Footer change, keep Button + Header changes

## Proposed Solution: Component-Level Undo/Redo

### Option 1: Per-Component History Stack
Store a history stack for each component that was edited:

```typescript
interface ComponentEdit {
  id: string
  componentPath: string  // e.g., "src/App.tsx"
  shipperId: string      // e.g., "App.tsx:42:4"
  selector: string
  timestamp: Date
  beforeContent: string  // File content before edit
  afterContent: string   // File content after edit
  fragmentId: string     // Fragment that was created
  changeType: 'style' | 'text' | 'combined'
  changes: {
    styles?: Record<string, string>
    text?: string
  }
}

interface ComponentHistory {
  projectId: string
  edits: ComponentEdit[]  // Chronological order
  currentIndex: number    // Current position in history
}
```

**Pros:**
- Granular undo/redo per component
- Can undo specific component without affecting others
- Maintains full edit history

**Cons:**
- More complex state management
- Need to track which components were edited
- Potential conflicts if same file edited multiple times

### Option 2: Fragment Diff System
Store diffs between fragments instead of full snapshots:

```typescript
interface FragmentDiff {
  fragmentId: string
  previousFragmentId: string
  changes: {
    filePath: string
    componentId: string
    diff: string  // Unified diff format
  }[]
}
```

**Pros:**
- Smaller storage footprint
- Can reconstruct any state
- Works with existing fragment system

**Cons:**
- Complex diff calculation
- Harder to implement selective undo
- Performance concerns with large files

### Option 3: Hybrid Approach (RECOMMENDED)
Combine fragments with component-level metadata:

```typescript
interface VisualEditMetadata {
  fragmentId: string
  editedComponents: {
    filePath: string
    shipperId: string
    selector: string
    changeType: 'style' | 'text' | 'combined'
    beforeSnapshot: string  // Just the component code
    afterSnapshot: string   // Just the component code
  }[]
}
```

**Implementation:**
1. Keep existing fragment system (full project snapshots)
2. Add metadata table to track which components were edited in each fragment
3. When user clicks "Undo" on a component:
   - Find the last fragment where this component was edited
   - Extract the "before" state from metadata
   - Apply only that component's changes to current state
   - Create new fragment with reverted component

**Pros:**
- Works with existing fragment system
- Granular undo per component
- Simpler than full diff system
- Can show "Undo" button per component in UI

**Cons:**
- Additional storage for metadata
- Need to extract component code snippets

## UI/UX Considerations

### Where to Show Undo Button
1. **In Visual Edit Panel** (when component is selected)
   - Show "Undo Last Change" button
   - Show edit history for this component
   - Allow reverting to any previous state

2. **In Fragment History Sidebar**
   - Show which components were edited in each fragment
   - Allow undoing specific component changes
   - Visual indicator of edited components

3. **Hover Overlay** (in preview iframe)
   - Show "Undo" icon when hovering edited component
   - Quick access to revert recent changes

### Undo/Redo Controls
- **Undo**: Revert last change to selected component
- **Redo**: Reapply undone change
- **History**: Show list of all changes to component
- **Restore**: Jump to specific point in component history

## Next Steps

1. **Design database schema** for component edit metadata
2. **Update `applyDirectVisualEdit`** to store component metadata
3. **Create undo/redo procedures** in tRPC
4. **Add UI controls** for undo/redo in visual edit panel
5. **Test with repeated components** (ensure correct instance is reverted)
6. **Add keyboard shortcuts** (Cmd+Z / Ctrl+Z for undo)

## Technical Challenges

### 1. Repeated Components
- Same component rendered multiple times
- Need to track which instance was edited
- Use `instanceIndex` from ElementInfo

### 2. File-Level vs Component-Level
- Visual edits modify entire files
- Need to extract/apply changes to specific components
- AST manipulation required

### 3. Conflict Resolution
- What if component was edited in multiple fragments?
- How to merge changes from different edits?
- Need clear conflict resolution strategy

### 4. Performance
- Storing component snapshots increases storage
- Need efficient diff/patch algorithms
- Consider compression for large components

## Files to Modify

1. **Database Schema** (`packages/database/prisma/schema.prisma`)
   - Add `VisualEditMetadata` model

2. **Procedures** (`apps/web/src/modules/projects/server/procedures.ts`)
   - Update `applyDirectVisualEdit` to store metadata
   - Add `undoComponentEdit` procedure
   - Add `redoComponentEdit` procedure
   - Add `getComponentEditHistory` procedure

3. **Types** (`apps/web/src/lib/visual-editor/types.ts`)
   - Add metadata types

4. **UI Components**
   - Update visual edit panel with undo/redo controls
   - Add component history viewer
   - Add undo button to hover overlay

5. **State Management** (`apps/web/src/lib/visual-editor/state.ts`)
   - Add undo/redo state atoms
   - Track component edit history
