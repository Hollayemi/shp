"use client";

import { Button } from "@/components/ui/button";
import Image from "next/image";
import { X } from "lucide-react";

interface OptInNotificationProps {
  /** Called when popup is dismissed. `granted` is true if user clicked "Enable". */
  onDismiss: (granted: boolean) => void;
}

export default function OptInNotification({
  onDismiss,
}: OptInNotificationProps) {
  return (
    <div className="fixed inset-x-4 bottom-55 z-[60] md:inset-x-auto md:bottom-40 md:left-4">
      <div className="relative mx-auto w-full rounded-[10px] border border-[#E1E1D6] bg-white p-3 text-[#1C1C1C] shadow-[0px_10px_10px_rgba(18,18,18,0.08)] md:mx-0 md:min-w-[200px] lg:min-w-[320px] xl:min-w-[423px] dark:border-[#2A2A2A] dark:bg-[#0A0E0D] dark:text-[#F5F9F7] dark:shadow-[0px_10px_10px_rgba(0,0,0,0.35)]">
        <Button
          type="button"
          className="absolute top-2 right-2 size-6 min-h-0 min-w-0 rounded-[5px] bg-[#F3F3EE] p-0 text-[#8B8B8B] shadow-none ring-[0.2px] hover:bg-[#E1E1D6] focus-visible:ring-0 dark:bg-[#1A2421] dark:text-[#B8C9C3] dark:ring-[0.2px] dark:ring-[#2A2A2A] dark:hover:bg-[#22302B]"
          variant="ghost"
          aria-label="Dismiss notification"
          onClick={() => onDismiss(false)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>

        <div className="flex flex-col gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center">
              <Image
                src="/assets/notification.svg"
                alt=""
                width={40}
                height={38}
                priority
              />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm leading-5 font-medium">
                App is building...
              </p>
              <p className="mt-1 text-xs text-[#8B8B8B] dark:text-[#B8C9C3]">
                Get notified when it&apos;s ready?
              </p>
            </div>
          </div>

          <div className="flex w-full items-end justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 rounded-[6px] bg-[#F3F3EE] px-3 text-[13px] text-[#8B8B8B] hover:bg-[#E1E1D6] focus-visible:ring-0 sm:min-w-[64px] dark:bg-[#1A2421] dark:text-[#B8C9C3] dark:hover:bg-[#22302B]"
              onClick={() => onDismiss(false)}
            >
              Later
            </Button>

            <Button
              type="button"
              size="sm"
              className="h-7 rounded-[6px] bg-[#1E9A80] px-3 text-[13px] text-white hover:bg-[#17695f] focus-visible:ring-0 sm:min-w-[132px] dark:hover:bg-[#17695f]"
              onClick={async () => {
                let granted = false;
                try {
                  if (
                    typeof window !== "undefined" &&
                    "Notification" in window
                  ) {
                    const result =
                      await window.Notification.requestPermission();
                    granted = result === "granted";
                  }
                } finally {
                  onDismiss(granted);
                }
              }}
            >
              Enable Notifications
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
