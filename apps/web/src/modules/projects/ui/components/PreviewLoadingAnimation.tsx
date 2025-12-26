"use client";

import { motion } from "framer-motion";
import { FolderOpen, Settings, Package, Cog, Hammer } from "lucide-react";
import React, { useMemo } from "react";
import { TypewriterText } from "./TypewriterText";
import Image from "next/image";
import IniitializeIcon from "@/components/icons/InitializeIcon";
import BuildingIcon from "@/components/icons/BuildingIcon";
import ConfigurationIcon from "@/components/icons/ConfigurationIcon";
import AssemblyIcon from "@/components/icons/AssemblyIcon";
import DeviceDesktopIcon from "@/components/icons/DeviceDesktop";

const ITEM_HEIGHT = 60;
const ANIMATION_DURATION = 15;

const features = [
  {
    icon: <IniitializeIcon />,
    text: "Initializing workspace",
  },
  {
    icon: <DeviceDesktopIcon />,
    text: "Setting up environment",
  },
  {
    icon: <AssemblyIcon />,
    text: "Loading dependencies",
  },
  {
    icon: <ConfigurationIcon />,
    text: "Configuring environment",
  },
  {
    icon: <BuildingIcon />,
    text: "Building project",
  },
] as const;

// Pre-calculate values
const TOTAL_HEIGHT = features.length * ITEM_HEIGHT;

const LoadingListItem = React.memo(
  ({ icon, text }: { icon: React.ReactNode; text: string }) => (
    <div className="flex items-center space-x-4 rounded-lg">
      <div className="bg-prj-bg-secondary flex h-[29px] w-[29px] flex-shrink-0 items-center justify-center rounded-md">
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-prj-text-primary text-sm dark:text-[#B8C9C3]">
          {text}
        </p>
      </div>
    </div>
  ),
);

LoadingListItem.displayName = "LoadingListItem";

export const PreviewLoadingAnimation = React.memo(
  ({
    title,
    subtitle,
    isRefreshButtonActive = false,
    buildStatus,
    hasCompletedFirstGeneration = false,
  }: {
    title?: React.ReactNode;
    subtitle?: React.ReactNode;
    isRefreshButtonActive?: boolean;
    buildStatus?:
      | "IDLE"
      | "INITIALIZING"
      | "GENERATING"
      | "BUILDING"
      | "READY"
      | "ERROR";
    hasCompletedFirstGeneration?: boolean;
  }) => {
    // Generate unique key to force TypewriterText remount on every change
    const animationKey = useMemo(() => {
      return `${isRefreshButtonActive ? "refresh" : "normal"}-${buildStatus}-${Date.now()}`;
    }, [isRefreshButtonActive, buildStatus]);

    // Compute title and subtitle based on props
    const computedTitle = useMemo(() => {
      if (title) return title; // Use provided title if available

      if (isRefreshButtonActive) {
        return "Reloading your app";
      }

      if (buildStatus === "INITIALIZING") {
        return "Initializing Sandbox";
      }

      if (buildStatus === "BUILDING") {
        return "Building Application";
      }

      // Show different text for first generation vs subsequent updates
      if (hasCompletedFirstGeneration) {
        return "Adding your latest updates";
      }

      return "Creating your app";
    }, [
      title,
      isRefreshButtonActive,
      buildStatus,
      hasCompletedFirstGeneration,
    ]);

    const computedSubtitle = useMemo(() => {
      if (subtitle) return subtitle; // Use provided subtitle if available

      if (isRefreshButtonActive) {
        return "Reloading your preview to show the latest changes. This should only take a moment...";
      }

      if (buildStatus === "INITIALIZING") {
        return "Setting up your development environment. This takes about 15-30 seconds...";
      }

      if (buildStatus === "BUILDING") {
        return "Running build commands and compiling your app. This may take a moment...";
      }

      // Show different subtitle for subsequent updates
      if (hasCompletedFirstGeneration) {
        return "Applying your changes and refreshing the preview. This should only take a moment...";
      }

      return "Waiting for your app to fully load and render. This ensures HMR is complete and React is ready...";
    }, [
      subtitle,
      isRefreshButtonActive,
      buildStatus,
      hasCompletedFirstGeneration,
    ]);

    // Memoize the marquee items to prevent recreation on every render
    const marqueeItems = useMemo(() => {
      return [...features, ...features];
    }, []);

    // Memoize the animation configuration
    const animationConfig = useMemo(
      () => ({
        y: [0, -TOTAL_HEIGHT],
      }),
      [],
    );

    const transitionConfig = useMemo(
      () => ({
        duration: ANIMATION_DURATION,
        ease: "linear" as const,
        repeat: Infinity,
        repeatType: "loop" as const,
      }),
      [],
    );

    return (
      <div className="bg-prj-bg-primary flex h-full w-full flex-col items-center justify-center dark:bg-[#0A0E0D]">
        <Image
          src="/preloading-image.png"
          alt="preview image"
          width={180}
          height={180}
          quality={100}
          priority
        />
        <div className="text-prj-text-primary max-w-lg text-center">
          <h3 className="pt-[9px] text-[16px] font-semibold">
            {computedTitle}
          </h3>
          <div className="mt-[7px] mb-[24px] flex min-h-[40px] items-center justify-center">
            {computedSubtitle && (
              <p className="px-4 text-center">
                {typeof computedSubtitle === "string" ? (
                  <>
                    {console.log(
                      "[PreviewLoadingAnimation] Rendering TypewriterText with key:",
                      animationKey,
                      "text:",
                      computedSubtitle,
                    )}
                    <TypewriterText
                      key={animationKey}
                      text={computedSubtitle}
                      speed={30}
                      className="text-sm dark:text-[#B8C9C3]"
                    />
                  </>
                ) : (
                  computedSubtitle
                )}
              </p>
            )}
          </div>
        </div>

        <div className="text-muted-foreground relative mx-auto flex h-[241px] w-full max-w-lg items-center justify-center overflow-hidden">
          {/* Infinite scrolling marquee background */}
          <div className="absolute inset-0 flex flex-col items-center">
            <motion.div
              className="flex flex-col"
              animate={animationConfig}
              transition={transitionConfig}
              style={{
                willChange: "transform",
                transform: "translateZ(0)", // Force hardware acceleration
                backfaceVisibility: "hidden", // Prevent flickering
              }}
            >
              {marqueeItems.map((feature, index) => (
                <div
                  key={`${feature.text}-${index}`} // More stable key
                  className="flex items-center gap-6 py-3"
                  style={{ height: ITEM_HEIGHT }}
                >
                  <LoadingListItem icon={feature.icon} text={feature.text} />
                </div>
              ))}
            </motion.div>
          </div>

          {/* Static gradient overlays for fade effect - no animation needed */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-20 bg-gradient-to-b from-[#FCFCF9] to-transparent opacity-90 dark:from-[#0A0E0D] dark:to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-20 bg-gradient-to-t from-[#FCFCF9] to-transparent opacity-90 dark:from-[#0A0E0D] dark:to-transparent" />
        </div>
      </div>
    );
  },
);

PreviewLoadingAnimation.displayName = "PreviewLoadingAnimation";
