# Notifications System (Opt-in + Task Finished Toast)

This document describes the in-app notification UX that was added to the web app:

1. A one-time **opt-in prompt** (bottom-left) asking the user to enable browser notifications.
2. A **"task finished" toast** (top-right) that auto-dismisses after 5 seconds.

The implementation uses **Jotai** for state and `atomWithStorage` for persistence.

---

## UX Requirements Implemented

### 1) Opt-in prompt (bottom-left)
- Shows only once per user (persisted in `localStorage`).
- Shown on `/projects/*` pages (not on the home page).
- Has two actions:
  - **Enable notifications**: calls `Notification.requestPermission()` (when available) and then dismisses.
  - **Later**: dismisses.
- If the user already has a non-`default` notification permission (`granted` or `denied`), the prompt auto-dismisses.

### 2) Task finished toast (top-right)
- Shows a toast titled:
  - `Finished working on shipper.now`
- With message:
  - `Your changes are done.`
- Auto-dismisses after **5 seconds**.
- Triggers on **every AI generation completion**.

---

## Where the Code Lives

### Global state (Jotai atoms)
File: `apps/web/src/lib/state/notificationAtoms.js`

- `optInAtom`
  - `atomWithStorage('shipper_hasSeenOptIn', false)`
  - `false` means: the opt-in prompt has NOT been seen yet.
  - When dismissed, it is set to `true` and persisted.

- `toastAtom`
  - Holds either `null` or `{ title, message }`.

- `showToastAtom` (write-only)
  - Sets `toastAtom` to the new payload.
  - Clears it after 5 seconds.
  - If called again before the 5 seconds elapse, it resets the timer (so repeated triggers behave correctly).

### Global UI renderer
File: `apps/web/src/components/notifications/NotificationsRoot.tsx`

This component is mounted globally (in the app layout) and is responsible for:
- Rendering the opt-in prompt when `optInAtom === false`.
- Rendering the toast when `toastAtom` is non-null.

### Opt-in prompt UI
File: `apps/web/src/components/notifications/OptInNotification.tsx`

- UI-only component used by `NotificationsRoot`.
- The container uses a `ResizeObserver` to mirror the width/position of the project chat panel (`#chat-panel`). When that panel is missing (e.g. on routes outside the project view) the prompt falls back to stretching between `1rem` side gutters.
- All tokens (radii, colors, spacing) match the exported Figma prompt while remaining responsive on narrow viewports.

### Toast UI
File: `apps/web/src/components/notifications/ToastNotification.tsx`

UI-only toast (top-right). The timing/auto-dismiss is handled by the atom, not the component.

### Layout integration
File: `apps/web/src/app/layout.tsx`

`<NotificationsRoot />` is rendered at the layout level so it is available everywhere.

---

## Triggering the Toast

### Triggered automatically on generation complete
File: `apps/web/src/modules/projects/ui/view/v3-project-view.tsx`

Inside `handleGenerationComplete`, the code calls:

```ts
showToast({
  title: "Finished working on shipper.now",
  message: "Your changes are done.",
});
```

Because `Chat` invokes `onGenerationComplete` in its `onFinish` handler, this runs when generation finishes.

### Triggering from any other component
Option A (recommended inside React components):

```ts
import { useSetAtom } from "jotai";
import { showToastAtom } from "@/lib/state/notificationAtoms";

const showToast = useSetAtom(showToastAtom);
showToast({ title: "...", message: "..." });
```

Option B (outside React, e.g. utility code):
- A helper exists in `apps/web/src/components/notifications/TaskFinishedToast.tsx` that writes to the default Jotai store.

---

## Notes / Limitations

- The opt-in prompt only requests permission; it does not schedule browser notifications by itself.
- If `Notification` is not available in the user’s browser environment, the opt-in prompt will simply dismiss without requesting.
