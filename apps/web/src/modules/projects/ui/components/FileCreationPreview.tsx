"use client";

import { FileCode, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";
import { PreviewLoadingAnimation } from "./PreviewLoadingAnimation";
import { FileEvent, QueuedFile } from "@/hooks/useFileCycling";
import { Button } from "@/components/ui/button";

type FileCreationPreviewProps = {
  projectId: string;
  onStreamingStart?: () => void;
  onStreamingEnd?: () => void;
  // Cycling state from parent
  queuedFiles: QueuedFile[];
  displayedFile: FileEvent | null;
  displayedHtml: string | null;
  onAddFileToQueue: (
    fileEvent: FileEvent,
    renderPromise: Promise<string | null>,
  ) => void;
  // UI state for dynamic messaging
  uiState?: string;
  // Navigation functions
  onGoToNext?: () => void;
  onGoToPrevious?: () => void;
  onGoToIndex?: (index: number) => void;
};

// Define animation styles once to be reused across all return statements
const PulseAnimation = () => (
  <style>{`
    @keyframes pulse-scale {
      0%, 100% {
        transform: scale(1.4);
        opacity: 1;
      }
      50% {
        transform: scale(0.5);
        opacity: 0.6;
      }
    }
    .pulse-dot {
      animation: pulse-scale 2.5s ease-in-out infinite;
    }
  `}</style>
);

export const FileCreationPreview = ({
  projectId,
  queuedFiles,
  displayedFile,
  displayedHtml,
  uiState = "newProject",
  onGoToNext,
  onGoToPrevious,
  onGoToIndex,
}: FileCreationPreviewProps) => {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionHtml, setTransitionHtml] = useState<string | null>(null);

  console.log(
    "[FileCreationPreview] Component rendered for project:",
    projectId,
    "at",
    new Date().toISOString(),
  );

  // Get dynamic message based on uiState
  const getDynamicMessage = () => {
    switch (uiState) {
      case "loadingPreview":
        return "Loading the latest version of your app into the sandbox for preview...";
      case "recovering":
        return "Your sandbox has expired. Automatically creating a new one and restoring your latest code...";
      case "loadingFragment":
        return "Setting up your app and loading the preview...";
      case "generating":
        return "The AI is currently generating code and building your app. Preview will be ready once generation completes...";
      case "checkingHealth":
        return "Verifying that your sandbox is running...";
      case "needsRefresh":
        return "Your sandbox has expired and needs to be recovered. This will happen automatically...";
      case "needsInitialization":
        return "The sandbox needs to be initialized. This will happen automatically when you start a conversation.";
      case "sandboxNotReady":
        return "The sandbox is starting up. This may take a moment...";
      case "newProject":
        return "Your app preview will appear here once the AI finishes building your first version.";
      case "noPreview":
        return "Start a conversation to create your application and see the preview here.";
      case "refreshing":
        return "Refreshing your app preview...";
      default:
        return "The AI will start creating your components shortly...";
    }
  };

  // Handle fade transition when displayedHtml changes
  useEffect(() => {
    if (displayedHtml && displayedHtml !== transitionHtml) {
      setIsTransitioning(true);

      // Quick fade out (150ms)
      const fadeOutTimeout = setTimeout(() => {
        setTransitionHtml(displayedHtml);
        setIsTransitioning(false);
      }, 150);

      return () => clearTimeout(fadeOutTimeout);
    }
  }, [displayedHtml, transitionHtml]);

  // Show loading state if no files are queued yet
  if (queuedFiles.length === 0) {
    return (
      <>
        <PulseAnimation />
        <div className="bg-prj-bg-primary flex h-full flex-col rounded-lg shadow-[0px_1px_1.5px_rgba(44,54,53,0.03)] dark:bg-[#0A0E0D]">
          {/* Jade Green Header Bar */}
          <div className="flex flex-shrink-0 items-center gap-3 rounded-t-lg bg-[#1E9A80] px-4 py-3 text-white">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20">
              <div className="pulse-dot h-3 w-3 rounded-full bg-white"></div>
            </div>
            <span className="text-left text-sm font-medium [text-wrap:pretty]">
              SNEAK PEEK: An army of AI agents is building your project, Watch
              as components pop up below, 1 by 1. Hang tight for the final
              version!
            </span>
          </div>

          {/* Loading Section */}
          <div className="flex-1">
            <PreviewLoadingAnimation
              title="Waiting for components..."
              subtitle={getDynamicMessage()}
            />
          </div>
        </div>
      </>
    );
  }

  // Show loading state if no file is displayed yet
  if (!displayedFile || !displayedHtml) {
    return (
      <>
        <PulseAnimation />
        <div className="bg-prj-bg-primary flex h-full flex-col rounded-lg shadow-[0px_1px_1.5px_rgba(44,54,53,0.03)] dark:bg-[#0A0E0D]">
          {/* Jade Green Header Bar */}
          <div className="flex flex-shrink-0 items-center gap-3 rounded-t-lg bg-[#1E9A80] px-4 py-3 text-white">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20">
              <div className="pulse-dot h-3 w-3 rounded-full bg-white"></div>
            </div>
            <span className="text-left text-sm font-medium [text-wrap:pretty]">
              SNEAK PEEK: An army of AI agents is building your project, Watch
              as components pop up below, 1 by 1. Hang tight for the final
              version!
            </span>
          </div>

          {/* Loading Section */}
          <div className="flex-1">
            <PreviewLoadingAnimation
              title="Rendering components..."
              subtitle={`Rendering ${queuedFiles.length} component${queuedFiles.length !== 1 ? "s" : ""}...`}
            />
          </div>
        </div>
      </>
    );
  }

  // Get rendered files count for navigation
  const renderedFiles = queuedFiles.filter(
    (qf) => qf.hasRendered && qf.renderedHtml,
  );
  const currentIndex = renderedFiles.findIndex(
    (rf) => rf.fileEvent.filePath === displayedFile?.filePath,
  );
  const showNavigation = renderedFiles.length > 1;

  return (
    <>
      <PulseAnimation />
      <div className="bg-prj-bg-primary flex h-full flex-col dark:bg-[#0A0E0D]">
        {/* Jade Green Header Bar */}
        <div className="flex flex-shrink-0 items-center gap-3 rounded-t-lg bg-[#1E9A80] px-4 py-3 text-white">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20">
            <div className="pulse-dot h-3 w-3 rounded-full bg-white"></div>
          </div>
          <span className="text-left text-sm font-medium [text-wrap:pretty]">
            SNEAK PEEK: An army of AI agents is building your project, Watch as
            components pop up below, 1 by 1. Hang tight for the final version!
          </span>
        </div>

        {/* Preview Section - Takes remaining height */}
        <div className="bg-prj-bg-primary relative flex-1 overflow-hidden rounded-b-lg border border-t-0 border-[#E7E5E4] shadow-[0px_1px_1.5px_rgba(44,54,53,0.03)] dark:border-[#26263D] dark:bg-[#0A0E0D]">
          {transitionHtml ? (
            <iframe
              srcDoc={transitionHtml}
              className={`h-full w-full rounded-b-lg border-0 transition-opacity duration-150 ${
                isTransitioning ? "opacity-0" : "opacity-100"
              }`}
              sandbox="allow-same-origin allow-scripts"
              allow="clipboard-read; clipboard-write"
              title="Component Preview"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center rounded-b-lg p-8 text-center">
              <Eye className="mb-2 h-8 w-8 text-[#717784] dark:text-[#B8C9C3]" />
              <p className="text-sm text-[#717784] dark:text-[#B8C9C3]">
                Cannot render this content
              </p>
              <p className="mt-1 text-xs text-[#898F8F] dark:text-[#8F8F8F]">
                The component may contain unsupported features or syntax errors.
              </p>
            </div>
          )}

          {/* Navigation Controls */}
          {showNavigation && (
            <div className="absolute inset-x-0 bottom-4 flex items-center justify-center gap-3 px-4">
              <div className="flex items-center gap-2 rounded-full border border-gray-200/60 bg-transparent px-3 py-2 shadow-lg backdrop-blur-md dark:border-[#2A3833]/60">
                {/* Previous Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onGoToPrevious}
                  className="h-8 w-8 rounded-full p-0 hover:bg-gray-100/50 dark:hover:bg-[#2A3833]/50"
                  title="Previous component"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                {/* Pagination Dots */}
                <div className="flex items-center gap-1.5 px-2">
                  {renderedFiles.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => onGoToIndex?.(index)}
                      className={`h-2 w-2 rounded-full transition-all duration-200 ${
                        index === currentIndex
                          ? "w-6 bg-[#1E9A80]/70"
                          : "bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500"
                      }`}
                      title={`Go to component ${index + 1}`}
                    />
                  ))}
                </div>

                {/* Next Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onGoToNext}
                  className="h-8 w-8 rounded-full p-0 hover:bg-gray-100/50 dark:hover:bg-[#2A3833]/50"
                  title="Next component"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>

                {/* Component counter */}
                <div className="ml-1 text-xs font-medium text-gray-600 dark:text-gray-400">
                  {currentIndex + 1}/{renderedFiles.length}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
