import React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { PlayIcon } from "lucide-react";

export type SandboxStatus = "ready" | "building" | "needs-attention" | "failed" | "draft";

interface SandboxStatusCardProps {
    status: SandboxStatus;
    className?: string;
    text?: string;
}

type StatusConfig = {
    text: string;
    badgeClass: string;
    dotClass: string;
    icon?: React.ComponentType<{ className?: string }>;
    iconClass?: string;
};

const statusConfig: Record<SandboxStatus, StatusConfig> = {
    ready: {
        text: "Preview ready",
        badgeClass: "bg-prj-bg-status-ready text-prj-text-status-ready border-transparent",
        dotClass: "bg-prj-accent-status-ready",
        icon: PlayIcon,
        iconClass: "h-3 w-3 text-prj-text-status-ready",
    },
    building: {
        text: "Building...",
        badgeClass: "bg-prj-bg-status-building text-prj-text-status-building border-transparent dark:bg-[#E1E7FD] dark:text-[#14201F] dark:text-[#302E7C]",
        dotClass: "bg-prj-accent-status-building",
    },
    "needs-attention": {
        text: "Needs attention",
        badgeClass: "bg-prj-bg-status-attention text-prj-text-status-attention border-transparent",
        dotClass: "bg-prj-accent-status-attention",
    },
    failed: {
        text: "Build failed",
        badgeClass: "bg-prj-bg-status-failed text-prj-text-status-failed border-transparent",
        dotClass: "bg-prj-accent-status-failed",
    },
    draft: {
        text: "Draft",
        badgeClass: "bg-muted/50 text-muted-foreground border-border",
        dotClass: "bg-muted-foreground",
    },
};

export const SandboxStatusCard: React.FC<SandboxStatusCardProps> = ({ status, className, text }) => {
    const config = statusConfig[status];
    const showDot = status !== "ready";
    const label = text ?? config.text;
    const Icon = config.icon;

    return (
        <Badge
            variant="secondary"
            className={cn(
                "gap-1 xs:gap-1.5 rounded-full px-2 xs:px-3 py-1 xs:py-[6px] text-sm font-medium leading-none border",
                config.badgeClass,
                className
            )}
        >
            {Icon && (
                <Icon className={cn("h-2.5 w-2.5 xs:h-3 xs:w-3", config.iconClass)} />
            )}
            {showDot && (
                <span className={cn("h-1 w-1 xs:h-1.5 xs:w-1.5 rounded-full", config.dotClass)} />
            )}
            <span className="text-sm">{label}</span>
        </Badge>
    );
};
