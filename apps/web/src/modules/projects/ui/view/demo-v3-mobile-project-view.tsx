"use client";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Button } from "@/components/ui/button";
import {
  EyeIcon,
  MessageCircleIcon,
} from "lucide-react";
import {
  Suspense,
  useState,
  useCallback,
  useMemo,
} from "react";

import DemoChat from "@/modules/projects/ui/components/DemoChat";
import { DemoPreview } from "@/components/demo-preview/DemoPreview";
import { UIMessage } from "ai";
import Image from "next/image";

interface MobileProjectViewV3Props {
  seed?: string;
  demoStep?: number;
  previewStep?: number;
  onDemoStepChange?: (step: number) => void;
  displayedMessages?: UIMessage[];
  allMessages?: UIMessage[];
  isSimulating?: boolean;
  simulateUserInteraction?: (step: number) => void;
  demoType?: string;
  demoTypeSelect: (demoType: string) => void;
  showDemo?: boolean;
  handleStartBuilding?: () => void;
}

export const MobileDemoProjectViewV3 = ({
  demoStep: propDemoStep,
  demoType,
  demoTypeSelect,
  showDemo,
  handleStartBuilding,
  previewStep,
  onDemoStepChange,
  displayedMessages,
  allMessages,
  isSimulating,
}: MobileProjectViewV3Props) => {
  const [demoStep, setDemoStep] = useState(propDemoStep || 0);
  const [showPreview, setShowPreview] = useState(false);

  // Calculate current fragment index (inverted relationship)
  const calculateFragmentIndex = useCallback((messageStep: number, totalFragments: number = 6) => {
    if (messageStep === 0) return 0;
    return Math.max(0, totalFragments - messageStep);
  }, []);

  const currentFragmentIndex = useMemo(() => {
    const stepToUse = previewStep ?? propDemoStep ?? demoStep;
    const fragmentIndex = calculateFragmentIndex(stepToUse);
    return fragmentIndex;
  }, [previewStep, propDemoStep, demoStep, calculateFragmentIndex]);

  const getDemoTitle = () => {
    if (demoType === "TODO_APP") return "To do list app";
    if (demoType === "AIRBNB_CLONE") return "Real estate app";
    if (demoType === "SPOTIFY_CLONE") return "Music streaming app";
    if (demoType === "VACATION_APP") return "Internal app: employee vacation tracker";
    return "Click a demo to start";
  };

  return (
    <div className="h-[90vh] md:h-screen flex flex-col">
      {/* Header with title and toggle button */}
      <div className="flex items-center justify-between p-4 border-b bg-sidebar">
        <div className="flex items-center gap-x-2">
          <Image
            src="/shipper_logo.png"
            alt="ShipperAI"
            width={18}
            height={18}
          />
          <span className="text-sm font-medium truncate">
            {getDemoTitle()}
          </span>
        </div>
        
        <Button
          variant="outline"
          onClick={() => setShowPreview(!showPreview)}
          className="flex items-center gap-x-2 px-4 py-3"
        >
          {showPreview ? (
            <>
              <MessageCircleIcon className="h-4 w-4" />
              <span>Chat</span>
            </>
          ) : (
            <>
              <EyeIcon className="h-4 w-4" />
              <span>Preview</span>
            </>
          )}
        </Button>
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 relative">
        {/* Preview Mode - Always rendered but hidden/shown with CSS */}
        <div className={`absolute inset-0 ${showPreview ? 'block' : 'hidden'}`}>
          <DemoPreview
            demoStep={previewStep ?? propDemoStep ?? demoStep}
            currentFragmentIndex={currentFragmentIndex}
            key={`preview-${currentFragmentIndex}`}
            type={demoType}
          />
        </div>

        {/* Chat Mode - Always rendered but hidden/shown with CSS */}
        <div className={`absolute inset-0 flex flex-col ${!showPreview ? 'block' : 'hidden'}`}>
          {/* Fragments section */}
          {/* <div className="border-b bg-sidebar px-4 py-3">
            <div className="text-sm text-muted-foreground">
              Fragments
            </div>
          </div> */}

          {/* Chat */}
          <div className="flex-1 min-h-0">
            <Suspense fallback={<LoadingSpinner />}>
              <DemoChat
                projectId=""
                demoStep={propDemoStep || demoStep}
                demoType={demoType}
                demoTypeSelect={demoTypeSelect}
                handleStartBuilding={handleStartBuilding}
                showDemo={showDemo}
                onDemoStepChange={useCallback((newStep: number) => {
                  console.log("🔄 DEMO STEP CHANGE TRIGGERED");
                  console.log("  Previous step:", propDemoStep || demoStep);
                  console.log("  New step:", newStep);
                  
                  setDemoStep(newStep);
                  if (onDemoStepChange) {
                    onDemoStepChange(newStep);
                  }
                }, [propDemoStep, demoStep, onDemoStepChange, setDemoStep])}
                initialMessages={displayedMessages}
                allMessages={allMessages}
                isSimulating={isSimulating}
              />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
};
