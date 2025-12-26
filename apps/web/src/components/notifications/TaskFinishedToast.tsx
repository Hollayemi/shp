import { getDefaultStore } from "jotai";

import { showToastAtom } from "@/lib/state/notificationAtoms";

export function showTaskFinishedToast() {
  // Allows triggering from anywhere (even outside React components)
  // while keeping UI driven by Jotai state in <NotificationsRoot />.
  getDefaultStore().set(showToastAtom, {
    title: "Finished working on shipper.now",
    message: "Your changes are done.",
  });
}
