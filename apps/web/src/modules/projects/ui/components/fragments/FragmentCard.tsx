"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoaderIcon, Loader2, Zap } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface FragmentCardProps {
    title: string;
    createdAt: Date | string;
    isCurrentVersion: boolean;
    isActive: boolean;
    isTransitioning: boolean;
    isDisabled: boolean;
    isLoading: boolean;
    versionLabel: string;
    onRestore?: () => void;
    onView?: () => void;
    onDownload?: () => void;
    // Snapshot metadata
    hasSnapshot?: boolean;
    snapshotCreatedAt?: Date | string | null;
    snapshotProvider?: string | null;
}

export function FragmentCard({
    title,
    createdAt,
    isCurrentVersion,
    isActive,
    isTransitioning,
    isDisabled,
    isLoading,
    versionLabel,
    onRestore,
    onView,
    onDownload,
    hasSnapshot = false,
    snapshotCreatedAt,
    snapshotProvider,
}: FragmentCardProps) {
    return (
        <div
            className={`bg-[#F3F3EE] dark:bg-prj-bg-secondary rounded-xl border border-[#E7E9E9] dark:border-[#3A3A52] p-2 transition-all [box-shadow:0px_0px_0px_2px_#FFFFFF_inset] dark:[box-shadow:0px_0px_0px_2px_#1A2421_inset] ${isActive
                ? "border-green-500 dark:border-green-600 [box-shadow:0px_1px_3px_0px_#0000000D_inset]"
                : isTransitioning
                    ? "border-yellow-500 dark:border-yellow-600 opacity-75"
                    : ""
                } ${isDisabled ? "opacity-50" : ""}`}
        >
            <div className="flex items-start justify-between p-2">
                <h3 className="text-base font-medium text-[#14201F] dark:text-[#F5F9F7]">
                    {versionLabel}
                </h3>
                <div className="flex items-center gap-2">
                    {hasSnapshot && (
                        <Badge
                            className="bg-blue-100 dark:bg-blue-900/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-medium py-[2px] px-2 rounded-full w-fit flex items-center gap-1"
                            title={`Snapshot available - Fast restore (~5-10s)\nCreated: ${snapshotCreatedAt ? format(new Date(snapshotCreatedAt), "MMM d, yyyy HH:mm") : "Unknown"}\nProvider: ${snapshotProvider || "Unknown"}`}
                        >
                            <Zap className="h-3 w-3" />
                            <span>Snapshot</span>
                        </Badge>
                    )}
                    {isActive && (
                        <Badge className="bg-[#D5FAF1] dark:bg-[#1E9A80] hover:bg-[#D5FAF1] dark:hover:bg-[#1E9A80] text-[#254D4A] dark:text-[#F0F6FF] text-xs font-medium py-[2px] px-2 rounded-full w-fit">
                            LIVE
                        </Badge>
                    )}
                </div>
            </div>
            <div className="bg-white dark:bg-[#1A2421] p-4 rounded-lg">
                <div className="space-y-4">
                    <div>
                        <p className="text-sm text-[#666E6D] dark:text-[#B8C9C3] mb-1">
                            History Details
                        </p>
                        <p className="text-sm text-[#14201F] dark:text-[#F5F9F7]">{title}</p>
                    </div>

                    <div>
                        <p className="text-sm text-[#666E6D] dark:text-[#B8C9C3] mb-1">
                            Saved Date and time
                        </p>
                        <p className="text-sm text-[#14201F] dark:text-[#F5F9F7]">
                            {formatDistanceToNow(new Date(createdAt), {
                                addSuffix: true,
                            })}{" "}
                            • {format(new Date(createdAt), "MMMM d, yyyy")}
                        </p>
                    </div>

                    {hasSnapshot && (
                        <div>
                            <p className="text-sm text-[#666E6D] dark:text-[#B8C9C3] mb-1">
                                Restore Speed
                            </p>
                            <p className="text-sm text-blue-700 dark:text-blue-300 flex items-center gap-1">
                                <Zap className="h-3 w-3" />
                                Fast restore available (5-10 seconds)
                            </p>
                            <p className="text-xs text-[#666E6D] dark:text-[#B8C9C3] mt-1">
                                Complete filesystem snapshot preserved for instant restoration
                            </p>
                        </div>
                    )}

                    <div className="flex gap-2">
                        {onRestore && (
                            <Button
                                size="sm"
                                className="flex-1 bg-[#F3F3EE] dark:bg-prj-bg-secondary text-[#1C1C1C] dark:text-[#F5F9F7] rounded-md hover:bg-[#E7E9E9] dark:hover:bg-[#3A3A52]"
                                onClick={onRestore}
                                disabled={isDisabled}
                            >
                                {isLoading ? (
                                    <LoaderIcon className="h-4 w-4 animate-spin" />
                                ) : (
                                    "Restore"
                                )}
                            </Button>
                        )}
                        {/* <Button
                            size="sm"
                            className="flex-1 bg-[#F3F3EE] text-[#1C1C1C] rounded-md"
                            onClick={onView}
                        >
                            View
                        </Button>
                        <Button
                            size="sm"
                            className="bg-[#1E9A80] text-[#F0F6FF] flex-1"
                            onClick={onDownload}
                        >
                            Download
                        </Button> */}
                    </div>
                </div>
            </div>
        </div>
    );
}
