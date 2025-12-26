# Visual Editing Feature - Implementation Plan

## Overview
Add visual editing mode to the Shipper platform that allows users to hover over and select elements in their preview, then either describe changes or directly edit styles with live updates.

## Implementation Status

**Current Progress:** Phase 4 Complete ✅

- ✅ **Phase 1:** Vite Template Monitor Script - COMPLETED (Nov 7, 2025)
- ✅ **Phase 2:** Webapp TypeScript Types - COMPLETED (Nov 7, 2025)
- ✅ **Phase 3:** Webapp UI Components - COMPLETED (Nov 7, 2025)
- ✅ **Phase 4:** Builder Integration - COMPLETED (Nov 7, 2025)
- ⏳ **Phase 5:** Polish & Refinements - TODO

**Last Updated:** November 7, 2025

## Architecture Overview

### Simple Integration with Existing Monitor Script
The visual editing overlay will be added **directly to the existing `.shipper/monitor.js` file** in the vite template. This means:
1. **No injection needed** - The visual editor code already exists in the template
2. **Toggle on/off via postMessage** - Enable/disable from webapp without re-injection
3. **Lives alongside monitoring** - Both features in the same script
4. **Simple implementation** - Just update one file in the vite template

### Communication Flow
```
Chat Component (Webapp)
    ↓ (send ENABLE_VISUAL_EDIT message via postMessage)
Monitor.js (already loaded in template)
    ↓ (activate visual editor overlay)
User's App (running in sandbox)
    ↓ (overlay hover & selection via postMessage)
Webapp Chat (receive element selections & changes)
```

---

## Phase 1: Update Vite Template Monitor Script

### 1.1 Add Visual Editor to monitor.js
**Location:** `shipper-vite-template/.shipper/monitor.js`

Add visual editing functionality to the existing monitor script:

```javascript
// At the top of the file, add to CONFIG
const CONFIG = {
  ALLOWED_ORIGINS: ["http://localhost:3000", "https://app.shipper.now"],
  DEBOUNCE_DELAY: 250,
  MAX_STRING_LENGTH: 10000,
  // Visual editor config
  HIGHLIGHT_COLOR: '#3b82f6',
  VISUAL_EDIT_ENABLED: false, // Initially disabled
};

// Add after the existing monitoring functions, before init()

// ===== VISUAL EDITOR =====
let visualEditorState = {
  enabled: false,
  selectedElement: null,
  highlightOverlay: null,
  hoverOverlay: null,
};

// Create overlay elements for visual editing
function createVisualEditorOverlays() {
  // Hover overlay (blue outline when hovering)
  visualEditorState.hoverOverlay = document.createElement('div');
  visualEditorState.hoverOverlay.id = 'shipper-visual-editor-hover';
  visualEditorState.hoverOverlay.style.cssText = `
    position: absolute;
    pointer-events: none;
    border: 2px dashed ${CONFIG.HIGHLIGHT_COLOR};
    background: rgba(59, 130, 246, 0.1);
    z-index: 999999;
    transition: all 0.1s ease;
    display: none;
  `;
  document.body.appendChild(visualEditorState.hoverOverlay);

  // Selection overlay (solid blue when selected)
  visualEditorState.highlightOverlay = document.createElement('div');
  visualEditorState.highlightOverlay.id = 'shipper-visual-editor-selection';
  visualEditorState.highlightOverlay.style.cssText = `
    position: absolute;
    pointer-events: none;
    border: 2px solid ${CONFIG.HIGHLIGHT_COLOR};
    background: rgba(59, 130, 246, 0.15);
    z-index: 999998;
    display: none;
  `;
  document.body.appendChild(visualEditorState.highlightOverlay);
}

// Get element position
function getElementPosition(element) {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left + window.scrollX,
    y: rect.top + window.scrollY,
    width: rect.width,
    height: rect.height,
  };
}

// Update overlay position
function updateOverlay(overlay, element) {
  const pos = getElementPosition(element);
  overlay.style.left = pos.x + 'px';
  overlay.style.top = pos.y + 'px';
  overlay.style.width = pos.width + 'px';
  overlay.style.height = pos.height + 'px';
  overlay.style.display = 'block';
}

// Generate CSS selector for element
function getSelector(element) {
  if (element.id) return '#' + element.id;

  const path = [];
  let current = element;
  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();
    if (current.className && typeof current.className === 'string') {
      const classes = current.className.trim().split(/\s+/).filter(c => c);
      if (classes.length > 0) {
        selector += '.' + classes.slice(0, 3).join('.');
      }
    }
    path.unshift(selector);
    current = current.parentElement;
  }
  return path.join(' > ');
}

// Generate XPath for element
function getXPath(element) {
  if (element.id) return `//*[@id="${element.id}"]`;

  const parts = [];
  let current = element;
  while (current && current !== document.body) {
    let index = 0;
    let sibling = current.previousSibling;
    while (sibling) {
      if (sibling.nodeType === 1 && sibling.tagName === current.tagName) {
        index++;
      }
      sibling = sibling.previousSibling;
    }
    const tagName = current.tagName.toLowerCase();
    parts.unshift(`${tagName}[${index + 1}]`);
    current = current.parentElement;
  }
  return '/' + parts.join('/');
}

// Extract Tailwind classes
function getTailwindClasses(element) {
  if (!element.className || typeof element.className !== 'string') return [];

  const classes = element.className.trim().split(/\s+/).filter(c => c);
  // Basic heuristic: Tailwind classes often have patterns like bg-, text-, flex-, etc.
  return classes.filter(c =>
    /^(bg|text|border|rounded|p|m|w|h|flex|grid|gap|space|shadow|opacity|transition|hover|focus|active|disabled|cursor|overflow|absolute|relative|fixed|sticky|z|top|bottom|left|right|inset|transform|scale|rotate|translate|skew|origin)-/.test(c) ||
    /^(sm|md|lg|xl|2xl):/.test(c)
  );
}

// Get computed styles (serializable)
function getComputedStyles(element) {
  const computed = window.getComputedStyle(element);
  const styles = {};
  const importantProps = [
    'backgroundColor', 'color', 'borderRadius', 'opacity',
    'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
    'width', 'height', 'display', 'position', 'fontSize', 'fontWeight',
    'border', 'borderWidth', 'borderColor', 'borderStyle',
  ];

  importantProps.forEach(prop => {
    styles[prop] = computed[prop];
  });

  return styles;
}

// Get inline styles
function getInlineStyles(element) {
  const styles = {};
  if (element.style && element.style.length > 0) {
    for (let i = 0; i < element.style.length; i++) {
      const prop = element.style[i];
      styles[prop] = element.style[prop];
    }
  }
  return styles;
}

// Extract element info
function getElementInfo(element) {
  const attributes = {};
  Array.from(element.attributes).forEach(attr => {
    attributes[attr.name] = attr.value;
  });

  return {
    selector: getSelector(element),
    xpath: getXPath(element),
    componentName: element.dataset?.component || element.tagName.toLowerCase(),
    currentStyles: {
      computed: getComputedStyles(element),
      tailwindClasses: getTailwindClasses(element),
      inlineStyles: getInlineStyles(element),
    },
    position: getElementPosition(element),
    textContent: element.textContent?.slice(0, 100),
    attributes,
  };
}

// Handle element hover
function handleVisualEditorMouseMove(event) {
  if (!visualEditorState.enabled) return;

  const target = event.target;
  if (target === visualEditorState.hoverOverlay || target === visualEditorState.highlightOverlay) return;

  // Skip overlays and visual editor elements
  if (target.id?.startsWith('shipper-visual-editor')) return;

  updateOverlay(visualEditorState.hoverOverlay, target);
}

// Handle element click
function handleVisualEditorClick(event) {
  if (!visualEditorState.enabled) return;

  event.preventDefault();
  event.stopPropagation();

  const target = event.target;
  if (target === visualEditorState.hoverOverlay || target === visualEditorState.highlightOverlay) return;
  if (target.id?.startsWith('shipper-visual-editor')) return;

  visualEditorState.selectedElement = target;
  updateOverlay(visualEditorState.highlightOverlay, target);

  // Send element info to parent
  const elementInfo = getElementInfo(target);
  postToParent({
    type: 'ELEMENT_SELECTED',
    payload: elementInfo,
  });
}

// Apply style changes
function applyVisualEditorStyle(styleUpdate) {
  const { selector, changes } = styleUpdate;
  const element = document.querySelector(selector);

  if (!element) {
    console.warn('Element not found for selector:', selector);
    return;
  }

  Object.entries(changes).forEach(([prop, value]) => {
    element.style[prop] = value;
  });

  // Update highlight if this is the selected element
  if (element === visualEditorState.selectedElement) {
    updateOverlay(visualEditorState.highlightOverlay, element);
  }
}

// Enable visual editing mode
function enableVisualEditor() {
  if (visualEditorState.enabled) return;

  visualEditorState.enabled = true;

  // Create overlays if they don't exist
  if (!visualEditorState.hoverOverlay) {
    createVisualEditorOverlays();
  }

  // Add event listeners
  document.addEventListener('mousemove', handleVisualEditorMouseMove);
  document.addEventListener('click', handleVisualEditorClick, true);

  // Notify parent that visual editor is ready
  postToParent({
    type: 'VISUAL_EDIT_READY',
    data: { url: window.location.href },
  });

  console.log('[Shipper Visual Editor] Enabled');
}

// Disable visual editing mode
function disableVisualEditor() {
  if (!visualEditorState.enabled) return;

  visualEditorState.enabled = false;

  // Hide overlays
  if (visualEditorState.hoverOverlay) {
    visualEditorState.hoverOverlay.style.display = 'none';
  }
  if (visualEditorState.highlightOverlay) {
    visualEditorState.highlightOverlay.style.display = 'none';
  }

  // Remove event listeners
  document.removeEventListener('mousemove', handleVisualEditorMouseMove);
  document.removeEventListener('click', handleVisualEditorClick, true);

  visualEditorState.selectedElement = null;

  console.log('[Shipper Visual Editor] Disabled');
}

// Listen for visual editor commands from parent
window.addEventListener('message', (event) => {
  // Validate origin
  if (!CONFIG.ALLOWED_ORIGINS.includes(event.origin)) return;

  const { type, payload } = event.data;

  if (type === 'ENABLE_VISUAL_EDIT') {
    enableVisualEditor();
  } else if (type === 'DISABLE_VISUAL_EDIT') {
    disableVisualEditor();
  } else if (type === 'APPLY_STYLE') {
    applyVisualEditorStyle(payload);
  }
});
```

---

## Phase 2: Webapp TypeScript Types

### 2.1 Visual Editor Types
**Location:** `apps/web/src/lib/visual-editor/types.ts` (new file)

```typescript
export type VisualEditingMessage =
  | { type: 'ENABLE_VISUAL_EDIT' }
  | { type: 'DISABLE_VISUAL_EDIT' }
  | { type: 'VISUAL_EDIT_READY'; data: { url: string } }
  | { type: 'ELEMENT_SELECTED'; payload: ElementInfo }
  | { type: 'APPLY_STYLE'; payload: StyleUpdate };

export interface ElementInfo {
  selector: string;
  xpath: string;
  componentName?: string;
  currentStyles: {
    computed: Record<string, string>;
    tailwindClasses: string[];
    inlineStyles: Record<string, string>;
  };
  position: { x: number; y: number; width: number; height: number };
  textContent?: string;
  attributes: Record<string, string>;
}

export interface StyleChangeRequest {
  elementInfo: ElementInfo;
  changes: Record<string, string>;
  isLive: boolean;
}

export interface TextChangeRequest {
  elementInfo: ElementInfo;
  prompt: string;
}

export interface StyleUpdate {
  selector: string;
  changes: Record<string, string>;
}
```

### 2.2 Visual Editor State
**Location:** `apps/web/src/lib/visual-editor/state.ts` (new file)

```typescript
import { atom } from 'jotai';
import { ElementInfo } from './types';

export const visualEditingModeAtom = atom<boolean>(false);
export const selectedElementAtom = atom<ElementInfo | null>(null);
```

---

## Phase 3: Webapp UI Components

### 3.1 Visual Editing Toggle in Chat
**Location:** `apps/web/src/modules/projects/ui/components/Chat.tsx`

Add toggle button to enable/disable visual editing:

```tsx
import { visualEditingModeAtom } from '@/lib/visual-editor/state';
import { useAtom } from 'jotai';
import { Paintbrush } from 'lucide-react';

// Inside Chat component
const [visualEditingMode, setVisualEditingMode] = useAtom(visualEditingModeAtom);
const previewIframeRef = useRef<HTMLIFrameElement | null>(null); // Get ref to preview iframe

// Add button to toolbar (around line 1240, near the prompt input)
<Button
  onClick={() => {
    const newMode = !visualEditingMode;
    setVisualEditingMode(newMode);

    // Get the preview iframe
    const iframe = document.querySelector('iframe[title="Project Preview"]') as HTMLIFrameElement;
    if (iframe?.contentWindow) {
      // Send message to toggle visual editor
      iframe.contentWindow.postMessage(
        { type: newMode ? 'ENABLE_VISUAL_EDIT' : 'DISABLE_VISUAL_EDIT' },
        '*'
      );
    }
  }}
  variant="outline"
  size="sm"
  disabled={!sandboxReady || isGenerating}
  className={cn(
    "flex items-center gap-2",
    visualEditingMode && "bg-blue-500 text-white hover:bg-blue-600"
  )}
>
  <Paintbrush className="w-4 h-4" />
  {visualEditingMode ? 'Exit Visual Edit' : 'Visual Edit'}
</Button>
```

### 3.2 Visual Editing Panel
**Location:** `apps/web/src/modules/projects/ui/components/VisualEditingPanel.tsx` (new file)

```tsx
'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { X } from 'lucide-react';
import { ElementInfo, StyleChangeRequest, TextChangeRequest } from '@/lib/visual-editor/types';

interface VisualEditingPanelProps {
  element: ElementInfo;
  onClose: () => void;
  onStyleChange: (change: StyleChangeRequest) => void;
  onTextPrompt: (prompt: TextChangeRequest) => void;
}

export function VisualEditingPanel({
  element,
  onClose,
  onStyleChange,
  onTextPrompt
}: VisualEditingPanelProps) {
  const [styles, setStyles] = useState({
    backgroundColor: element.currentStyles.computed.backgroundColor || '#ffffff',
    borderRadius: element.currentStyles.computed.borderRadius || '0px',
    opacity: element.currentStyles.computed.opacity || '1',
    padding: element.currentStyles.computed.padding || '0px',
    margin: element.currentStyles.computed.margin || '0px',
  });
  const [promptText, setPromptText] = useState('');

  const handleStyleChange = (property: string, value: string) => {
    const newStyles = { ...styles, [property]: value };
    setStyles(newStyles);

    // Send live update
    onStyleChange({
      elementInfo: element,
      changes: newStyles,
      isLive: true
    });
  };

  const handleFinalize = () => {
    onStyleChange({
      elementInfo: element,
      changes: styles,
      isLive: false
    });
    onClose();
  };

  const handleTextPromptSubmit = () => {
    onTextPrompt({
      elementInfo: element,
      prompt: promptText
    });
    onClose();
  };

  return (
    <div className="fixed right-4 top-20 z-[9999] w-96 rounded-lg border border-gray-200 bg-white p-4 shadow-2xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Edit Element</h3>
          <p className="text-xs text-gray-500 mt-1 truncate">{element.selector}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Tabs defaultValue="describe" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="describe">Describe Changes</TabsTrigger>
          <TabsTrigger value="direct">Direct Edit</TabsTrigger>
        </TabsList>

        <TabsContent value="describe" className="space-y-4 mt-4">
          <div>
            <Label htmlFor="prompt-text">What would you like to change?</Label>
            <Textarea
              id="prompt-text"
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="e.g., Make this button larger and change the color to blue"
              rows={4}
              className="mt-2"
            />
          </div>
          <Button
            onClick={handleTextPromptSubmit}
            className="w-full"
            disabled={!promptText.trim()}
          >
            Send to Builder
          </Button>
        </TabsContent>

        <TabsContent value="direct" className="space-y-4 mt-4 max-h-[500px] overflow-y-auto">
          <div>
            <Label htmlFor="bg-color">Background Color</Label>
            <div className="flex gap-2 mt-2">
              <Input
                id="bg-color"
                type="color"
                value={styles.backgroundColor}
                onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
                className="w-16 h-10"
              />
              <Input
                value={styles.backgroundColor}
                onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
                placeholder="#ffffff"
                className="flex-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="border-radius">Border Radius</Label>
            <Input
              id="border-radius"
              type="range"
              min="0"
              max="50"
              value={parseInt(styles.borderRadius) || 0}
              onChange={(e) => handleStyleChange('borderRadius', `${e.target.value}px`)}
              className="mt-2"
            />
            <span className="text-sm text-gray-500">{styles.borderRadius}</span>
          </div>

          <div>
            <Label htmlFor="opacity">Opacity</Label>
            <Input
              id="opacity"
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={parseFloat(styles.opacity) || 1}
              onChange={(e) => handleStyleChange('opacity', e.target.value)}
              className="mt-2"
            />
            <span className="text-sm text-gray-500">{(parseFloat(styles.opacity) * 100).toFixed(0)}%</span>
          </div>

          <div>
            <Label htmlFor="padding">Padding</Label>
            <Input
              id="padding"
              value={styles.padding}
              onChange={(e) => handleStyleChange('padding', e.target.value)}
              placeholder="e.g., 16px or 1rem"
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="margin">Margin</Label>
            <Input
              id="margin"
              value={styles.margin}
              onChange={(e) => handleStyleChange('margin', e.target.value)}
              placeholder="e.g., 16px or 1rem"
              className="mt-2"
            />
          </div>

          <div>
            <Label>Tailwind Classes</Label>
            <div className="flex flex-wrap gap-1 mt-2 p-2 border rounded text-xs max-h-32 overflow-y-auto">
              {element.currentStyles.tailwindClasses.length > 0 ? (
                element.currentStyles.tailwindClasses.map((cls, i) => (
                  <span key={i} className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    {cls}
                  </span>
                ))
              ) : (
                <span className="text-gray-400">No Tailwind classes detected</span>
              )}
            </div>
          </div>

          <Button onClick={handleFinalize} className="w-full">
            Apply Changes
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

### 3.3 Message Listener in Project View
**Location:** `apps/web/src/modules/projects/ui/view/v3-project-view.tsx`

Add postMessage listener to receive visual editing events:

```tsx
import { useAtom } from 'jotai';
import { selectedElementAtom, visualEditingModeAtom } from '@/lib/visual-editor/state';
import { VisualEditingPanel } from '../components/VisualEditingPanel';
import { StyleChangeRequest, TextChangeRequest } from '@/lib/visual-editor/types';

// Inside ProjectViewV3 component
const [selectedElement, setSelectedElement] = useAtom(selectedElementAtom);
const [visualEditingMode] = useAtom(visualEditingModeAtom);

useEffect(() => {
  const handleMessage = (event: MessageEvent) => {
    const { type, payload, data } = event.data;

    if (type === 'VISUAL_EDIT_READY') {
      console.log('[Visual Editor] Ready');
      toast.success('Visual editing mode enabled');
    } else if (type === 'ELEMENT_SELECTED') {
      setSelectedElement(payload);
    }
  };

  window.addEventListener('message', handleMessage);
  return () => window.removeEventListener('message', handleMessage);
}, [setSelectedElement]);

const handleStyleChange = (styleChange: StyleChangeRequest) => {
  if (styleChange.isLive) {
    // Send live update to iframe
    const iframe = document.querySelector('iframe[title="Project Preview"]') as HTMLIFrameElement;
    iframe?.contentWindow?.postMessage(
      {
        type: 'APPLY_STYLE',
        payload: {
          selector: styleChange.elementInfo.selector,
          changes: styleChange.changes
        }
      },
      '*'
    );
  } else {
    // Send finalized changes to builder chat
    const modificationPrompt = `Update the element at ${styleChange.elementInfo.selector} with these styles:
${Object.entries(styleChange.changes).map(([key, value]) => `- ${key}: ${value}`).join('\n')}

Please update the appropriate component file with these changes.`;

    // Use the sendMessage function from Chat component
    // You'll need to pass this down as a prop or use a callback
    sendMessageToChat(modificationPrompt);
  }
};

const handleTextPrompt = (textChange: TextChangeRequest) => {
  const contextMessage = `[Visual Edit Request]
Element: ${textChange.elementInfo.componentName || textChange.elementInfo.selector}
Location: ${textChange.elementInfo.xpath}

Current Styles:
${Object.entries(textChange.elementInfo.currentStyles.computed)
  .map(([key, value]) => `- ${key}: ${value}`)
  .join('\n')}

Tailwind Classes: ${textChange.elementInfo.currentStyles.tailwindClasses.join(' ') || 'None'}

User Request: ${textChange.prompt}`;

  sendMessageToChat(contextMessage);
};

// Render the visual editing panel if an element is selected
{visualEditingMode && selectedElement && (
  <VisualEditingPanel
    element={selectedElement}
    onClose={() => setSelectedElement(null)}
    onStyleChange={handleStyleChange}
    onTextPrompt={handleTextPrompt}
  />
)}
```

---

## Implementation Checklist

### Phase 1: Update Vite Template ✅ COMPLETED
- [x] Add visual editor functions to `.shipper/monitor.js`
- [x] Test visual editor in local vite template
- [x] Commit and push changes to vite template repo

**Completed:** November 7, 2025
**Location:** `/home/browe/dev/shipper-vite-template/.shipper/monitor.js`
**Commit:** `c769a53 - feat: add visual editing mode to monitor script`
**Changes:** Added 286 lines of visual editor code (492 → 778 lines total)

**Implementation includes:**
- Visual editor configuration (HIGHLIGHT_COLOR, VISUAL_EDIT_ENABLED)
- Hover and selection overlay system with blue highlights
- Element info extraction (CSS selector, XPath, computed styles, Tailwind classes)
- PostMessage handlers: ENABLE_VISUAL_EDIT, DISABLE_VISUAL_EDIT, APPLY_STYLE
- PostMessage events: VISUAL_EDIT_READY, ELEMENT_SELECTED
- Live style preview updates support

### Phase 2: Webapp Types ✅ COMPLETED
- [x] Create `apps/web/src/lib/visual-editor/types.ts`
- [x] Create `apps/web/src/lib/visual-editor/state.ts`

**Completed:** November 7, 2025
**Location:** `apps/web/src/lib/visual-editor/`

**Files created:**
- `types.ts` - Complete TypeScript type definitions (90 lines)
  - `VisualEditingMessage` - Union type for all postMessage events
  - `ElementInfo` - Element information structure (selector, xpath, styles, position, etc.)
  - `StyleChangeRequest` - Direct style editing requests with live preview support
  - `TextChangeRequest` - Natural language change requests
  - `StyleUpdate` - Style updates to apply in iframe
- `state.ts` - Jotai state management atoms (25 lines)
  - `visualEditingModeAtom` - Boolean flag for visual editing mode
  - `selectedElementAtom` - Currently selected ElementInfo or null

**Verification:**
- ✅ Types match monitor.js implementation exactly
- ✅ Message types align with postMessage handlers
- ✅ ElementInfo structure matches getElementInfo() output
- ✅ StyleUpdate matches applyVisualEditorStyle() expectations

### Phase 3: Webapp UI ✅ COMPLETED
- [x] Add visual editing toggle button in Chat component
- [x] Create `VisualEditingPanel` component
- [x] Add postMessage listener in project view
- [x] Wire up state management with Jotai
- [ ] Test element selection and highlighting (ready for manual testing)

**Completed:** November 7, 2025
**Locations:**
- `apps/web/src/modules/projects/ui/components/Chat.tsx` - Visual editing toggle button
- `apps/web/src/modules/projects/ui/components/VisualEditingPanel.tsx` - Element editing panel (new file)
- `apps/web/src/modules/projects/ui/view/v3-project-view.tsx` - PostMessage handlers and panel integration

**Implementation details:**

**Chat Component Updates:**
- Added `Paintbrush` icon import from lucide-react
- Added `visualEditingModeAtom` import and state management
- Created `toggleVisualEditingMode` callback that:
  - Toggles the visual editing mode state
  - Sends ENABLE_VISUAL_EDIT/DISABLE_VISUAL_EDIT message to preview iframe
- Added toggle button in PromptInputTools section:
  - Disabled when sandbox not ready or generation in progress
  - Shows blue background when active
  - Changes label between "Visual Edit" and "Exit Visual Edit"

**VisualEditingPanel Component (230 lines):**
- Fixed floating panel (right-4, top-20, z-[9999])
- Two-tab interface:
  - "Describe Changes" - Natural language input for AI modifications
  - "Direct Edit" - Live style editing with instant preview
- Direct edit controls:
  - Background color (color picker + hex input)
  - Border radius (range slider 0-50px)
  - Opacity (range slider 0-1)
  - Padding (text input)
  - Margin (text input)
  - Tailwind classes display (read-only, shows detected classes)
- Live preview: Sends APPLY_STYLE messages on every change
- Finalize: Sends style changes to AI chat for code modification
- Close button and onClose callback

**Project View Updates:**
- Added imports: `VisualEditingPanel`, visual editor types, state atoms, `toast`
- Added state:
  - `selectedElement` from `selectedElementAtom`
  - `visualEditingMode` from `visualEditingModeAtom`
- Added ref: `sendMessageToChatRef` to store Chat's sendMessage function
- Updated `handleChatSendMessageReady` to capture sendMessage function
- Added `handleStyleChange` callback:
  - Live updates: Sends APPLY_STYLE to iframe
  - Finalized: Sends modification prompt to AI chat
- Added `handleTextPrompt` callback:
  - Formats visual edit request with element context
  - Sends to AI chat for code modification
- Added postMessage listener useEffect:
  - Listens for VISUAL_EDIT_READY (shows success toast)
  - Listens for ELEMENT_SELECTED (updates selectedElement state)
- Renders `VisualEditingPanel` when both `visualEditingMode` and `selectedElement` are truthy

**Integration flow:**
1. User clicks "Visual Edit" button in Chat component
2. Chat sends ENABLE_VISUAL_EDIT message to preview iframe
3. Monitor.js enables visual editor overlays and event listeners
4. Monitor.js sends VISUAL_EDIT_READY back to webapp (shows toast)
5. User hovers over elements → blue dashed outline appears
6. User clicks element → solid blue outline, ELEMENT_SELECTED message sent
7. ProjectView receives ELEMENT_SELECTED, sets selectedElement state
8. VisualEditingPanel renders with element info
9. User either:
   - Describes changes → sends prompt to AI chat
   - Edits styles directly → live preview via APPLY_STYLE messages
   - Finalizes changes → sends modification prompt to AI chat

### Phase 4: Builder Integration ✅ COMPLETED
- [x] Format visual edit prompts for AI context
- [x] Handle text-based change requests
- [x] Convert direct style changes to code modifications
- [x] Add Tailwind class conversion guidance
- [ ] Test end-to-end flow (ready for manual testing)

**Completed:** November 7, 2025
**Locations:**
- `apps/web/src/modules/projects/ui/view/v3-project-view.tsx` - Enhanced `handleStyleChange` and `handleTextPrompt`
- `apps/web/src/modules/projects/ui/components/VisualEditingPanel.tsx` - Added helpful user guidance

**Implementation details:**

**Enhanced handleStyleChange (Direct Style Editing):**
- Comprehensive element identification (selector, component name, ID, classes)
- Current Tailwind classes detection and display
- Detailed style change listing
- Step-by-step AI instructions
- Tailwind conversion guide for common properties:
  - backgroundColor → bg-[color] classes
  - borderRadius → rounded-[size] classes
  - opacity → opacity-[value] classes
  - padding → p-[size] classes
  - margin → m-[size] classes
- Live preview support via APPLY_STYLE messages
- Finalized changes sent to AI builder with rich context

**Enhanced handleTextPrompt (Natural Language Editing):**
- Complete element context:
  - Selector, component name, XPath
  - Element ID and text content preview
  - Current Tailwind classes
  - Inline styles (if any)
  - Key computed styles (display, position, colors, sizing, spacing)
- User's natural language request prominently featured
- Clear AI instructions for translating request to code changes
- Guidance to preserve structure and use Tailwind utility-first approach

**VisualEditingPanel UI Improvements:**
- Added helper text on "Describe Changes" tab explaining AI will update code
- Added helper text on "Direct Edit" tab explaining live preview and Apply Changes
- Clear call-to-action buttons with appropriate labels
- Improved user understanding of workflow

### Phase 5: Polish
- [ ] Add keyboard shortcuts (Esc to exit visual edit)
- [ ] Improve element selection UX
- [ ] Add loading states
- [ ] Handle edge cases

---

## Technical Considerations

### Security
- postMessage origin validation already implemented in monitor script
- Sanitize user input for styles in webapp
- Visual editor only activates on explicit user action

### Performance
- Debounce live style updates (already handled by React state)
- Use requestAnimationFrame for smooth highlighting (can add if needed)
- Visual editor code only activates when enabled via message

### Browser Compatibility
- Test in Chrome, Firefox, Safari
- Ensure iframe communication works across browsers

### Template Updates
- When vite template is updated, all new projects get visual editor automatically
- Existing projects need sandbox restart to get updated monitor.js
- No special deployment needed

---

## Future Enhancements

1. **Multi-element selection** - Select and edit multiple elements at once
2. **Component detection** - Better React component identification using fiber
3. **Responsive editing** - Edit styles for different breakpoints
4. **Animation editor** - Add transition and animation controls
5. **Layout editor** - Drag-and-drop positioning
6. **Undo/Redo** - Track and revert live changes
7. **Color picker with palette** - Show existing colors from design system
8. **Typography controls** - Font size, weight, line height, etc.
9. **Spacing presets** - Quick access to common spacing values
10. **Export changes** - Download style changes as CSS

---

## Notes

- Visual editor code lives in the vite template (not injected)
- Toggle on/off via postMessage (no re-injection needed)
- Works immediately when user clicks "Visual Edit" button
- No API calls needed - pure client-side communication
- Extremely simple architecture - just update one file in template
