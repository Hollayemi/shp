"use client";

import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";

interface SandboxLoadingBannerProps {
  status:
    | "initializing"
    | "building"
    | "recovering"
    | "generating"
    | "coding-complete";
  isExistingProject: boolean;
  show: boolean;
}

export function SandboxLoadingBanner({
  status,
  isExistingProject,
  show,
}: SandboxLoadingBannerProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [internalShow, setInternalShow] = useState(false);
  const hasShownInitializingRef = useRef(false);

  // Track when we've shown the "initializing" state to persist it
  useEffect(() => {
    if (show && status === "initializing" && isExistingProject) {
      hasShownInitializingRef.current = true;
    }
  }, [show, status, isExistingProject]);

  // Determine if we should actually show the banner
  // For "initializing" status, persist until parent explicitly hides it
  useEffect(() => {
    if (status === "coding-complete") {
      // Always respect coding-complete state immediately
      setInternalShow(show);
      hasShownInitializingRef.current = false;
    } else if (status === "initializing" && hasShownInitializingRef.current) {
      // Once we've shown "initializing", keep showing it until parent says to hide
      setInternalShow(show);
      if (!show) {
        // Parent has signaled content is ready, reset the flag
        hasShownInitializingRef.current = false;
      }
    } else {
      // For other statuses, follow parent's show prop
      setInternalShow(show);
    }
  }, [show, status]);

  // Handle visibility with smooth transitions
  useEffect(() => {
    if (internalShow && isExistingProject) {
      setShouldRender(true);
      // Slight delay for smooth fade-in
      setTimeout(() => setIsVisible(true), 10);
    } else {
      setIsVisible(false);
      // Wait for fade-out animation before unmounting
      const timeout = setTimeout(() => setShouldRender(false), 200);
      return () => clearTimeout(timeout);
    }
  }, [internalShow, isExistingProject]);

  // Don't render at all if not needed
  if (!shouldRender) return null;

  // Get contextual message based on status
  const getMessage = () => {
    switch (status) {
      case "initializing":
        return {
          title: "Your project is waking up",
          subtitle: "This may take a few minutes.",
          badge: "Waking up",
        };
      case "building":
        return {
          title: "Building your application",
          subtitle: "Compiling and preparing your preview...",
          badge: "Building",
        };
      case "recovering":
        return {
          title: "Restoring your session",
          subtitle: "Getting everything back up and running...",
          badge: "Restoring",
        };
      case "generating":
        return {
          title: "Setting up environment",
          subtitle: "Preparing your development workspace...",
          badge: "Setting up",
        };
      case "coding-complete":
        return {
          title: "Coding is done!",
          subtitle: "Just building your project link now...",
          badge: "Building",
        };
      default:
        return {
          title: "Loading",
          subtitle: "Please wait...",
          badge: "Loading",
        };
    }
  };

  const { title, subtitle, badge } = getMessage();

  return (
    <div
      className={cn(
        "relative z-0 mx-[18px] mb-0 w-auto transition-opacity duration-200 ease-in-out",
        isVisible ? "opacity-100" : "pointer-events-none opacity-0",
      )}
      role="status"
      aria-live="polite"
      aria-label={`${title}. ${subtitle}`}
    >
      <div className="flex items-center justify-between gap-3 rounded-t-[16px] border-x border-t border-[#1E9A80]/20 bg-[#1E9A80] px-4 py-3 pb-8 dark:border-[#1E9A80]/30 dark:bg-[#1E9A80]">
        {/* Text */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-normal text-white dark:text-white">
            {title}
          </p>
          <p className="mt-0.5 text-xs text-white/90 dark:text-white/90">
            {subtitle}
          </p>
        </div>

        {/* Badge with spinner */}
        <div className="flex items-center gap-2 rounded-full bg-white/20 px-3 py-1.5 dark:bg-white/20">
          <svg
            className="h-3 w-3 animate-spin text-white dark:text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="text-xs font-medium text-white dark:text-white">
            {badge}
          </span>
        </div>
      </div>
    </div>
  );
}
