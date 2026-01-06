import { atom } from "jotai";

// ─────────────────────────────────────────────────────────────────────────────
// 1) notificationPermissionAtom
//    Holds the browser's Notification.permission status.
//    Initialized to the current value if in a browser environment.
// ─────────────────────────────────────────────────────────────────────────────
const getInitialPermission = () => {
  if (typeof window !== "undefined" && "Notification" in window) {
    return Notification.permission; // 'granted' | 'denied' | 'default'
  }
  return "default";
};

export const notificationPermissionAtom = atom(getInitialPermission());

// ─────────────────────────────────────────────────────────────────────────────
// Project build state (used to decide when to prompt for notifications)
//
// We only *trigger* the opt-in prompt when a project is actively building.
// Once the prompt is shown, it can remain visible until dismissed.
// ─────────────────────────────────────────────────────────────────────────────
export const projectIsBuildingAtom = atom(false);

// ─────────────────────────────────────────────────────────────────────────────
// 2) showOptInAtom (opt-in visibility)
//    Simple boolean controlling whether the opt-in popup is visible.
//    Starts hidden; we trigger it manually via triggerOptInAtom.
// ─────────────────────────────────────────────────────────────────────────────
export const showOptInAtom = atom(false);

// ─────────────────────────────────────────────────────────────────────────────
// 3) triggerOptInAtom (write-only)
//    When invoked, checks localStorage for 'shipper_hasSeenOptIn'.
//    If key is missing or false, sets showOptInAtom to true so the popup shows.
// ─────────────────────────────────────────────────────────────────────────────
const STORAGE_KEY = "shipper_hasSeenOptIn";

export const triggerOptInAtom = atom(null, (get, set) => {
  if (typeof window === "undefined") return;

  const stored = window.localStorage.getItem(STORAGE_KEY);
  const hasSeen = stored === "true";

  if (!hasSeen) {
    set(showOptInAtom, true);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4) dismissOptInAtom (write-only helper)
//    Hides the popup and persists that the user has seen it.
// ─────────────────────────────────────────────────────────────────────────────
export const dismissOptInAtom = atom(null, (get, set) => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, "true");
  }
  set(showOptInAtom, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// 5) showToastAtom (write-only)
//    Triggers a native browser Notification if permission is 'granted'.
//    Expects { title, body }.
// ─────────────────────────────────────────────────────────────────────────────
export const showToastAtom = atom(null, (get, set, payload) => {
  if (typeof window === "undefined" || !("Notification" in window)) return;

  const permission = get(notificationPermissionAtom);

  if (permission === "granted" && payload && payload.title) {
    new Notification(payload.title, {
      body: payload.body || "",
      icon: "/favicon_shipper.png",
    });
  }
});
