"use client";

import { useEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { usePathname } from "next/navigation";

import OptInNotification from "@/components/notifications/OptInNotification";
import {
  showOptInAtom,
  dismissOptInAtom,
  notificationPermissionAtom,
  projectIsBuildingAtom,
  triggerOptInAtom,
} from "@/lib/state/notificationAtoms";

export function NotificationsRoot() {
  const pathname = usePathname();
  // Opt-in prompt should only appear in the project flow (not on home).
  const shouldShowOptIn = pathname.startsWith("/projects");

  // Only trigger the opt-in prompt while a project is actively building.
  const isProjectBuilding = useAtomValue(projectIsBuildingAtom);
  const shouldTriggerOptIn = shouldShowOptIn && isProjectBuilding;

  // Read whether the popup should be visible and the dismiss action.
  const isOptInVisible = useAtomValue(showOptInAtom);
  const dismissOptIn = useSetAtom(dismissOptInAtom);
  const triggerOptIn = useSetAtom(triggerOptInAtom);

  // Keep permission atom in sync after user grants/denies (used by showToastAtom).
  const setPermission = useSetAtom(notificationPermissionAtom);

  // Trigger opt-in check when navigating to a project page.
  useEffect(() => {
    if (shouldTriggerOptIn) {
      triggerOptIn();
    }
  }, [shouldTriggerOptIn, triggerOptIn]);

  const handleDismiss = (granted: boolean) => {
    // If user clicked "Enable", sync the new permission to the atom.
    if (granted && typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
    }
    dismissOptIn();
  };

  return (
    <>
      {shouldShowOptIn && isOptInVisible && (
        <OptInNotification onDismiss={handleDismiss} />
      )}
    </>
  );
}
