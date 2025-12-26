"use client";

import { Badge } from "@/components/ui/badge";
import { CheckCircleIcon } from "./icons/CheckCircleIcon";

interface BuildModeTooltipProps {
    mode: "build" | "deep";
}

interface TooltipHeaderProps {
    title: string;
    description: string;
}

interface TooltipContentProps {
    badgeText: string;
    children: React.ReactNode;
}

function TooltipHeader({ title, description }: TooltipHeaderProps) {
    return (
        <div className="flex items-start p-2 w-full rounded-lg">
            <div className="flex flex-col items-start gap-0.5 text-left flex-1">
                <h2 className="font-semibold text-[#F5F9F7] text-sm tracking-[-0.14px] leading-5">
                    {title}
                </h2>
                <p className="font-normal text-[#B8C9C3] text-xs tracking-[-0.12px] leading-[18px]">
                    {description}
                </p>
            </div>
        </div>
    );
}

function TooltipContentCard({ badgeText, children }: TooltipContentProps) {
    return (
        <div className="bg-[#1a2421] rounded-xl border-0 w-full text-left min-h-fit">
            <div className="flex flex-col items-start gap-1.5 p-2 h-fit">
                <Badge className="inline-flex items-center justify-center pl-0.5 pr-1 py-0.5 bg-[#1E9A8026] rounded-[90px] hover:bg-[#1E9A8026] border-0">
                    <span className="px-1 font-medium text-[#1E9A80] text-[11px] tracking-[0.11px] leading-4">
                        {badgeText}
                    </span>
                    <CheckCircleIcon size={12} />
                </Badge>
                {children}
            </div>
        </div>
    );
}

export function BuildModeTooltip({ mode }: BuildModeTooltipProps) {
    if (mode === "build") {
        return (
            <div className="flex flex-col w-[310px] items-start px-2 pb-2 bg-[#0a0e0d] rounded-2xl">
                <TooltipHeader
                    title="Build"
                    description="Build apps with Shipper by chatting to AI"
                />
                <div className="w-full">
                    <TooltipContentCard badgeText="Agentic mode - Enabled">
                        <p className="font-light text-[#b8c9c3cc] text-xs tracking-[-0.12px] leading-[16.8px]">
                            Shipper Agentic mode: AI that thinks, adapts, and acts: you build smarter + faster. Up to 91% fewer bugs, thanks to self-fixing
                        </p>
                    </TooltipContentCard>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col w-[300px] items-start px-2 pb-2 bg-[#0a0e0d] rounded-2xl">
            <TooltipHeader
                title="Deep build"
                description="Multiple agents: takes longer, builds more complex apps"
            />
            <div className="w-full">
                <TooltipContentCard badgeText="Multi-agentic mode - Enabled">
                    <p className="font-normal text-[#b8c9c3] text-xs tracking-[-0.12px] leading-[18px]">
                        Start with a Plan phase, before building starts. Then, multi-agentic mode builds more checkpoints at the same time. Takes longer (10m+), delivers more complex results in one go
                    </p>
                    <p className="font-light text-[#b8c9c3b2] text-[11px] tracking-[-0.11px] leading-[15.4px]">
                        Uses more credits
                    </p>
                </TooltipContentCard>
            </div>
        </div>
    );
}
