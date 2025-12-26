import React from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { openCrispChat } from "@/lib/crisp";

interface PreviewErrorScreenProps {
  onRefresh: () => void;
  onContactSupport?: () => void;
  isRefreshing?: boolean;
}

export const PreviewErrorScreen: React.FC<PreviewErrorScreenProps> = ({
  onRefresh,
  onContactSupport,
  isRefreshing = false,
}) => {
  const handleContactSupport = () => {
    // Open Crisp live chat
    openCrispChat();
    
    // Call the optional callback if provided
    if (onContactSupport) {
      onContactSupport();
    }
  };

  return (
    <div className="h-full w-full">
      <div className="relative flex h-full w-full flex-col items-center justify-center bg-white p-6 text-center dark:bg-[#1A2421]">
        {/* Refreshing overlay */}
        {isRefreshing && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/95 backdrop-blur-sm dark:bg-[#1A2421]/95">
            <Loader2 className="mb-4 h-16 w-16 animate-spin text-emerald-600" />
            <h3 className="mb-2 text-2xl font-semibold text-gray-900 dark:text-white">
              Refreshing Preview
            </h3>
            <p className="max-w-md text-gray-600 dark:text-gray-300">
              Please wait while we restart your sandbox and reload the
              preview...
            </p>
          </div>
        )}
        <Image
          src="/assets/info-icon-gold.png"
          alt="Info"
          width={96}
          height={96}
          className="mb-4 object-contain"
        />

        <h3 className="mb-2 w-1/2 text-lg font-semibold text-gray-900 dark:text-white">
          Your app preview is loading
        </h3>

        <p className="mb-4 w-13/25 max-w-md px-6 text-sm text-gray-600 dark:text-gray-300">
          Sometimes our preview generation takes a little extra time.
          Here&apos;s what you can do:
        </p>

        <div className="mb-4 w-full max-w-md rounded-[10px] bg-[#FEF3C7] p-3 text-left dark:border dark:border-amber-900/50 dark:bg-amber-950/30">
          <div className="flex items-start gap-4">
            {/* <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-amber-400 to-amber-600 shadow-sm"> */}
            <Image
              src="/assets/light-bulb.png"
              alt="Lightbulb"
              width={32}
              height={32}
              className="object-contain"
            />
            {/* </div> */}
            <div className="flex flex-1 flex-col gap-0.5 text-sm">
              <div>
                <span className="font-bold text-[#404040] dark:text-gray-200">
                  Normal wait:
                </span>{" "}
                <span className="text-[#404040] dark:text-gray-300">
                  30-60 seconds
                </span>
              </div>
              <div>
                <span className="font-bold text-[#404040] dark:text-gray-200">
                  Extended wait:
                </span>{" "}
                <span className="text-[#404040] dark:text-gray-300">
                  Up to 2 minutes
                </span>
              </div>
              <div>
                <span className="font-bold text-[#404040] dark:text-gray-200">
                  Too long?
                </span>{" "}
                <span className="text-[#404040] dark:text-gray-300">
                  2+ minutes means we should investigate
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex w-full max-w-md gap-3 rounded-[10px]">
          <Button
            variant="outline"
            className="flex-1 gap-2 rounded-[10px] shadow-none"
            onClick={handleContactSupport}
          >
            Contact Support
          </Button>
          <Button
            className="flex-1 gap-2 rounded-[10px] bg-[#1E9A80] text-white hover:bg-[#1E9A80]/80"
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? "Refreshing..." : "Refresh Preview"}
          </Button>
        </div>
        <div className="w-2/5">
          <p className="text-muted-foreground mt-4 text-sm">
            <span className="font-semibold">Pro tip:</span> Try refreshing first
            - it often resolves preview issues instantly.
          </p>
        </div>
      </div>
    </div>
  );
};
