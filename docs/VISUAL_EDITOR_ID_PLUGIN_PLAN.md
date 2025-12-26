# Visual Editor Auto-ID Plugin Plan

## Overview

Implement a Vite plugin that automatically adds unique `data-shipper-id` attributes to all JSX/TSX elements during development builds. This will enable reliable element matching for the visual editor without manual intervention.

## Problem Statement

**Current Issue:**
- Visual editor captures runtime DOM classes (which may include dynamic/state-based classes)
- Source code only has static classes
- Matching elements by className is unreliable and causes wrong elements to be edited
- Example: `"bg-card p-6 hover-active"` (runtime) vs `"bg-card p-6"` (source)

**Solution:**
- Automatically inject stable, unique IDs into every element during dev builds
- Use these IDs for guaranteed accurate element matching
- IDs are deterministic based on source location, so they persist across hot reloads

## Architecture

### 1. Vite Plugin (`vite-plugin-shipper-ids`)

**Location:** `/plugins/vite-plugin-shipper-ids.ts`

**Functionality:**
- Hooks into Vite's transform phase
- Parses JSX/TSX files using Babel or similar
- Adds `data-shipper-id` to all JSX elements with className
- Only runs in development mode
- Generates stable IDs based on: `${filename}:${line}:${col}`

**Example Transformation:**

```tsx
// Input (source code):
<div className="bg-card p-6">
  <button className="btn-primary">Click</button>
</div>

// Output (dev build):
<div className="bg-card p-6" data-shipper-id="App.tsx:42:4">
  <button className="btn-primary" data-shipper-id="App.tsx:43:6">Click</button>
</div>
```

### 2. Monitor Script Updates

**File:** `.shipper/monitor.js`

**Changes:**
- Capture `data-shipper-id` in `getElementInfo()`
- Include it in `ELEMENT_SELECTED` message payload
- Update selector generation to prioritize `data-shipper-id` if present

### 3. Backend Matching Logic

**File:** `apps/web/src/lib/visual-editor/tailwind-updater.ts`

**Changes:**
- Add `data-shipper-id` to `elementInfo` type
- Update `updateFileWithTailwind()` to:
  1. First try matching by `data-shipper-id` (if present)
  2. Fall back to className matching (for elements without IDs)
- Regex pattern: `data-shipper-id=["']${id}["']`

## Implementation Steps

### Phase 1: Vite Plugin Development

**Files to Create:**
- `/plugins/vite-plugin-shipper-ids.ts` - Main plugin code
- `/plugins/vite-plugin-shipper-ids.test.ts` - Unit tests

**Plugin Implementation:**

```typescript
import { Plugin } from 'vite';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';

export function shipperIdsPlugin(): Plugin {
  return {
    name: 'vite-plugin-shipper-ids',
    enforce: 'pre',

    transform(code, id) {
      // Only process in dev mode
      if (process.env.NODE_ENV !== 'development') {
        return null;
      }

      // Only process JSX/TSX files
      if (!/\.[jt]sx$/.test(id)) {
        return null;
      }

      // Parse and transform
      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });

      let hasChanges = false;

      traverse(ast, {
        JSXElement(path) {
          const { openingElement } = path.node;

          // Only add ID if element has className
          const hasClassName = openingElement.attributes.some(
            attr => attr.type === 'JSXAttribute' && attr.name.name === 'className'
          );

          if (!hasClassName) return;

          // Check if already has data-shipper-id
          const hasId = openingElement.attributes.some(
            attr => attr.type === 'JSXAttribute' && attr.name.name === 'data-shipper-id'
          );

          if (hasId) return;

          // Generate stable ID based on location
          const loc = openingElement.loc;
          const filename = id.split('/').pop();
          const shipperId = `${filename}:${loc.start.line}:${loc.start.column}`;

          // Add attribute
          openingElement.attributes.push({
            type: 'JSXAttribute',
            name: { type: 'JSXIdentifier', name: 'data-shipper-id' },
            value: { type: 'StringLiteral', value: shipperId },
          });

          hasChanges = true;
        }
      });

      if (!hasChanges) return null;

      const output = generate(ast, {}, code);
      return {
        code: output.code,
        map: output.map,
      };
    }
  };
}
```

**Install Dependencies:**
```bash
npm install -D @babel/parser @babel/traverse @babel/generator @babel/types
```

**Add to vite.config.ts:**
```typescript
import { shipperIdsPlugin } from './plugins/vite-plugin-shipper-ids';

export default defineConfig({
  plugins: [
    react(),
    shipperIdsPlugin(), // Add before react plugin
  ],
});
```

### Phase 2: Monitor Script Updates

**File:** `.shipper/monitor.js`

**Update `getElementInfo()` function:**

```javascript
function getElementInfo(element) {
  const attributes = {};
  Array.from(element.attributes).forEach((attr) => {
    attributes[attr.name] = attr.value;
  });

  return {
    selector: getSelector(element),
    xpath: getXPath(element),
    shipperId: element.getAttribute('data-shipper-id') || null, // NEW
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
```

### Phase 3: Backend Type Updates

**File:** `apps/web/src/lib/visual-editor/types.ts`

**Update `ElementInfo` interface:**

```typescript
export interface ElementInfo {
  selector: string;
  xpath: string;
  shipperId?: string; // NEW: Auto-generated unique ID from Vite plugin
  componentName?: string;
  currentStyles: {
    computed: Record<string, string>;
    tailwindClasses: string[];
    inlineStyles: Record<string, string>;
  };
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  textContent?: string;
  attributes: Record<string, string>;
}
```

### Phase 4: Matching Logic Updates

**File:** `apps/web/src/lib/visual-editor/tailwind-updater.ts`

**Update `updateFileWithTailwind()` function:**

```typescript
export function updateFileWithTailwind(
  fileContent: string,
  selector: string,
  elementInfo: {
    componentName?: string;
    textContent?: string;
    currentClasses: string[];
    shipperId?: string; // NEW
  },
  styleChanges: Record<string, string>
): string {
  const { classesToAdd, classesToRemove } = convertStylesToTailwind(styleChanges);

  // STRATEGY 1: Match by data-shipper-id (most reliable)
  if (elementInfo.shipperId) {
    console.log('[updateFileWithTailwind] Using shipper ID:', elementInfo.shipperId);

    const idPattern = new RegExp(
      `data-shipper-id=["']${escapeRegex(elementInfo.shipperId)}["']`,
      'g'
    );

    if (idPattern.test(fileContent)) {
      // Find the className attribute on the same line or within a few lines
      const lines = fileContent.split('\n');

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(elementInfo.shipperId)) {
          // Found the line with our ID
          // Now find and update className on this element
          // ... (implementation to update className near this ID)
          return updatedContent;
        }
      }
    }
  }

  // STRATEGY 2: Fall back to class matching for elements without IDs
  // (Keep existing logic)
  ...
}
```

### Phase 5: tRPC Procedure Updates

**File:** `apps/web/src/modules/projects/server/procedures.ts`

**Update `applyDirectVisualEdit` input schema:**

```typescript
applyDirectVisualEdit: protectedProcedure
  .input(
    z.object({
      projectId: z.string(),
      filePath: z.string(),
      selector: z.string(),
      elementInfo: z.object({
        componentName: z.string().optional(),
        textContent: z.string().optional(),
        currentClasses: z.array(z.string()),
        shipperId: z.string().optional(), // NEW
      }),
      styleChanges: z.record(z.string(), z.string()),
    })
  )
  .mutation(async ({ ctx, input }) => {
    // Pass shipperId to updateFileWithTailwind
    ...
  })
```

## Benefits

### Reliability
- **100% accurate element matching** - No ambiguity with similar elements
- **No false positives** - Won't accidentally edit wrong elements
- **Handles dynamic classes** - Runtime classes don't affect matching

### Developer Experience
- **Zero manual work** - Automatic on all elements
- **Persistent across hot reloads** - IDs based on source location
- **Works immediately** - No setup needed when visual editor opens
- **No production impact** - Only runs in dev mode

### Future Enhancements
- Can track element edit history per ID
- Can show visual indicators for "previously edited" elements
- Can support multi-element selection with stable IDs

## Considerations

### Performance
- Plugin runs during Vite transform phase (already optimized)
- Minimal overhead - just AST traversal and attribute injection
- Only processes JSX/TSX files
- Vite's caching handles incremental builds

### Edge Cases
- **Elements without className**: Don't add IDs (not editable via visual editor anyway)
- **Dynamic elements**: IDs remain stable as long as source location doesn't change
- **Code formatting**: Line/column numbers change if code is reformatted
  - Solution: Could use hash of element structure instead
  - Or: Make IDs optional, fall back to class matching

### Production Builds
- Plugin completely disabled in production
- No `data-shipper-id` attributes in production builds
- Zero bundle size impact

## Testing Strategy

### Unit Tests
- Test plugin transforms JSX correctly
- Test ID generation is deterministic
- Test skips non-JSX files
- Test skips elements without className
- Test doesn't duplicate existing IDs

### Integration Tests
- Test full flow: select element → edit → apply
- Test with dynamic components
- Test with nested elements
- Test error cases (element not found, etc.)

### Manual Testing
- Verify IDs appear in dev build DOM
- Verify hot reload preserves IDs
- Verify production build has no IDs
- Test visual editor matching accuracy

## Rollout Plan

### Phase 1: shipper-vite-template
1. Implement and test Vite plugin
2. Update monitor.js to capture shipper IDs
3. Test in local development

### Phase 2: Backend Integration
1. Update types to include shipperId
2. Update matching logic with ID-first strategy
3. Add logging/debugging for ID matching

### Phase 3: Testing & Refinement
1. Test with real projects
2. Monitor error rates
3. Refine matching logic if needed
4. Handle edge cases

### Phase 4: Documentation
1. Document how the system works
2. Add troubleshooting guide
3. Update developer docs

## Alternative Approaches Considered

### 1. Runtime Injection (Rejected)
- Inject IDs via monitor.js at runtime
- **Problem:** IDs don't exist in source code, so we still can't match reliably

### 2. AST Parsing in Backend (Rejected)
- Parse file and find element by AST traversal
- **Problem:** Complex, slow, error-prone with dynamic code

### 3. Manual Data Attributes (Rejected)
- Require developers to add IDs manually
- **Problem:** Too much friction, won't be adopted

### 4. Hash-based IDs (Alternative)
- Generate IDs based on element structure hash instead of location
- **Benefit:** Survives reformatting
- **Drawback:** Less human-readable, may have collisions
- **Decision:** Could implement as enhancement later

## Success Metrics

- **Element matching accuracy**: 100% (vs current ~70%)
- **False positive rate**: 0% (vs current unknown)
- **Dev build time impact**: < 50ms per file
- **User reports of wrong elements edited**: 0

## Timeline Estimate

- **Phase 1 (Vite Plugin):** 4-6 hours
- **Phase 2 (Monitor Updates):** 2 hours
- **Phase 3 (Backend Updates):** 3-4 hours
- **Phase 4 (Testing):** 4-6 hours
- **Phase 5 (Documentation):** 2 hours

**Total:** ~2-3 days of focused development

## Next Steps

1. Review and approve this plan
2. Set up development environment
3. Implement Vite plugin with tests
4. Integrate with monitor.js
5. Update backend matching logic
6. Test end-to-end flow
7. Deploy to staging
8. Monitor and refine
