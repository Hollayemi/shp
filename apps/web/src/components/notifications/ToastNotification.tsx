"use client";

import Image from "next/image";
import { Heart } from "lucide-react";

export default function ToastNotification({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  // UI-only: auto-dismiss timing is handled by `showToastAtom` (Jotai), not here.
  return (
    <div className="fixed right-4 top-4 z-[60] w-[min(420px,calc(100vw-2rem))]">
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/70 p-3 text-white shadow-lg backdrop-blur animate-in fade-in slide-in-from-top-2">
        <div className="shrink-0">
          <Image
            src="/favicon_shipper.png"
            alt="shipper.now"
            width={36}
            height={36}
            priority
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{title}</div>
          <div className="truncate text-sm text-white/70">{message}</div>
        </div>

        {/* <div className="shrink-0">
          <div className="rounded-full border border-white/10 bg-gradient-to-br from-pink-500 to-orange-400 p-2">
            <Heart className="h-4 w-4 text-white" fill="currentColor" />
          </div>
        </div> */}
      </div>
    </div>
  );
}
