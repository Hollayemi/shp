"use client";

// NOTE: Legacy implementation.
// The app now uses the Jotai-driven notification system via:
// - `apps/web/src/lib/state/notificationAtoms.js`
// - `apps/web/src/components/notifications/NotificationsRoot.tsx`
// This component is kept for reference but is not the active path.

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

const STORAGE_KEY = "shipper.notifications.optin.v1";

type OptInState = {
  dismissed: boolean;
  permission?: NotificationPermission;
};

function safeReadOptInState(): OptInState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OptInState;
  } catch {
    return null;
  }
}

function safeWriteOptInState(state: OptInState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function EnableNotificationsPrompt() {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const canRequest = useMemo(() => {
    if (typeof window === "undefined") return false;
    return "Notification" in window;
  }, []);

  useEffect(() => {
    setMounted(true);

    const stored = safeReadOptInState();
    if (stored?.dismissed) return;

    if (!canRequest) return;

    // If the user already made a browser-level choice, don't show the opt-in.
    if (window.Notification.permission !== "default") {
      safeWriteOptInState({
        dismissed: true,
        permission: window.Notification.permission,
      });
      return;
    }

    setIsOpen(true);
  }, [canRequest]);

  if (!mounted || !isOpen) return null;

  const dismiss = (permission?: NotificationPermission) => {
    safeWriteOptInState({ dismissed: true, permission });
    setIsOpen(false);
  };

  return (
    <div className="fixed bottom-4 left-4 z-[60] w-[min(420px,calc(100vw-2rem))]">
      <div className="rounded-xl border border-gray-200 bg-white p-4 text-gray-900 shadow-lg">
        <div className="mb-3">
          <div className="text-sm font-semibold">Enable notifications</div>
          <div className="mt-1 text-sm text-gray-600">
            Get notified when shipper.now completes a task.
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            className="h-9 rounded-md bg-gray-100 px-3 text-gray-900 hover:bg-gray-200"
            onClick={() => dismiss(window.Notification?.permission)}
          >
            Later
          </Button>

          <Button
            type="button"
            className="h-9 rounded-md bg-blue-600 px-3 text-white hover:bg-blue-700"
            onClick={async () => {
              if (!canRequest) {
                dismiss();
                return;
              }

              try {
                const permission = await window.Notification.requestPermission();
                dismiss(permission);
              } catch {
                dismiss(window.Notification?.permission);
              }
            }}
          >
            Enable notifications
          </Button>
        </div>
      </div>
    </div>
  );
}
