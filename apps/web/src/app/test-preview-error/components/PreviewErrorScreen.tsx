import React from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

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
        if (onContactSupport) {
            onContactSupport();
        } else {
            console.log("Contact support requested");
        }
    };

    return (
        <div className=" h-full w-full">
            <div className="relative flex h-full w-full flex-col items-center justify-center bg-white p-6 text-center dark:bg-[#1A2421]">
                {/* Refreshing overlay */}
                {isRefreshing && (
                    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/95 dark:bg-[#1A2421]/95 backdrop-blur-sm">
                        <Loader2 className="h-16 w-16 animate-spin text-emerald-600 mb-4" />
                        <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                            Refreshing Preview
                        </h3>
                        <p className="text-gray-600 dark:text-gray-300 max-w-md">
                            Please wait while we restart your sandbox and reload the preview...
                        </p>
                    </div>
                )}
                <Image
                    src='/assets/info-icon-gold.png'
                    alt="Info"
                    width={96}
                    height={96}
                    className="h-24 w-24 object-contain mb-4"
                />

                <h3 className="mb-2 w-1/2 text-lg font-semibold text-gray-900 dark:text-white">
                    Your app preview is loading
                </h3>

                <p className="mb-4 w-13/25 max-w-md text-sm text-gray-600 dark:text-gray-300 px-6">
                    Sometimes our preview generation takes a little extra time. Here&apos;s what
                    you can do:
                </p>

                <div
                    className="mb-4 w-full max-w-md rounded-[10px] p-3 text-left bg-[#FEF3C7] dark:bg-amber-950/30 dark:border dark:border-amber-900/50"
                >
                    <div className="flex items-start gap-4">
                        {/* <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-amber-400 to-amber-600 shadow-sm"> */}
                        <Image
                            src="/assets/light-bulb.png"
                            alt="Lightbulb"
                            width={32}
                            height={32}
                            className="h-8 w-8 object-contain"
                        />
                        {/* </div> */}
                        <div className="flex-1 flex flex-col gap-0.5 text-sm">
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

                        className="flex-1 gap-2 shadow-none rounded-[10px]"
                        onClick={handleContactSupport}

                    >
                        Contact Support
                    </Button>
                    <Button
                        className="flex-1 gap-2 rounded-[10px] bg-[#1E9A80] hover:bg-[#1E9A80]/80 text-white"
                        onClick={onRefresh}
                        disabled={isRefreshing}
                    >
                        {isRefreshing ? "Refreshing..." : "Refresh Preview"}
                    </Button>
                </div>
                <div className="w-2/5">
                    <p className="text-muted-foreground mt-4 text-sm">
                        <span className="font-semibold">Pro tip:</span> Try refreshing first -
                        it often resolves preview issues instantly.
                    </p>
                </div>
            </div>
        </div>
    );
};
