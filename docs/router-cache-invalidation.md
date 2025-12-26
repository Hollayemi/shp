# Router Cache Invalidation - Server Action Implementation

## Overview

When a new chat/project completes its first generation, we need to invalidate Next.js's router cache to ensure client-side navigation works correctly. This is done via a server action that calls `revalidatePath()`.

## Implementation

### 1. Server Action (`src/app/actions.ts`)

```typescript
"use server";

import { revalidatePath } from "next/cache";

export async function invalidateRouterCache() {
  /*
   * note: this path does not exist, but it will
   * trigger a client-side reload.
   */
  revalidatePath("/just-trigger-client-reload");
  await Promise.resolve();
}
```

**Why this works:**

- `'use server'` directive marks this as a server action (can be called from client components)
- `revalidatePath()` on a non-existent path triggers cache invalidation for the entire router
- This is safer than revalidating all paths and more efficient

### 2. Chat Component Integration (`src/modules/projects/ui/components/Chat.tsx`)

**Import:**

```typescript
import { invalidateRouterCache } from "@/app/actions";
```

**Usage in onFinish callback:**

```typescript
onFinish: async () => {
  // ... refresh fragments and project data ...

  // Invalidate router cache to trigger client-side navigation revalidation
  await invalidateRouterCache();
};
```

## When It's Called

The `invalidateRouterCache()` is called after the AI generation completes in the `onFinish` callback of the `useChat` hook. This ensures:

1. All fragments and project data have been refreshed
2. HAL suggestions have been triggered
3. Router cache is cleared so navigation works correctly

## Benefits

✅ **Proper SSR**: Client-side navigation to the same project page will trigger SSR correctly
✅ **Clean Implementation**: Uses Next.js built-in server actions
✅ **Non-intrusive**: Doesn't require complex routing logic
✅ **Efficient**: Only invalidates when needed (after generation completes)

## Related Files

- `/src/app/actions.ts` - Server action definition
- `/src/modules/projects/ui/components/Chat.tsx` - Usage in onFinish callback (line 433)
- `/src/modules/projects/ui/view/v3-project-view.tsx` - Project view component
