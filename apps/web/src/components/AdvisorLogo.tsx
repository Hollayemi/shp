"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";

export interface AdvisorLogoProps {
    className?: string;
}

export function AdvisorLogo({ className }: AdvisorLogoProps) {
    return (

        <Image
            src="/advisor-logo.png"
            alt="Advisor Logo"
            unoptimized
            className={cn("mt-1", className)}
            height={20}
            width={20}
        />

    );
}
