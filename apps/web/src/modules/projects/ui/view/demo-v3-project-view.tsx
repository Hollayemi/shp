"use client";
import LoadingSpinner from "@/components/LoadingSpinner";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  CodeIcon,
  EyeIcon,
  Play,
} from "lucide-react";
import {
  Suspense,
  useState,
  useCallback,
  useMemo,
} from "react";

import DemoChat from "@/modules/projects/ui/components/DemoChat";

import { DemoFileExplorer } from "@/components/code-view/DemoFileExplorer";
import { DemoPreview } from "@/components/demo-preview/DemoPreview";
import { MobileDemoProjectViewV3 } from "./demo-v3-mobile-project-view";
import { UIMessage } from "ai";
import { ChevronDown } from "lucide-react";
import Image from "next/image";

interface ProjectViewV3Props {
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

const DesktopDemoProjectViewV3 = ({
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
}: ProjectViewV3Props) => {
  const [demoStep, setDemoStep] = useState(propDemoStep || 0);
  const [tabState, setTabState] = useState<"preview" | "code">("preview");
  // Use direct property access to avoid destructuring errors

  // Calculate current fragment index (inverted relationship)
  // Message 1 -> Last Fragment (5), Message 2 -> Fragment 4, etc.
  const calculateFragmentIndex = useCallback((messageStep: number, totalFragments: number = 6) => {
    // If messageStep is 0 (initial state), return 0
    if (messageStep === 0) return 0;
    // Message 1 = Last fragment, Message 2 = Second to last, etc.
    return Math.max(0, totalFragments - messageStep);
  }, []);

  const currentFragmentIndex = useMemo(() => {
    const stepToUse = previewStep ?? propDemoStep ?? demoStep;
    const fragmentIndex = calculateFragmentIndex(stepToUse);
    return fragmentIndex;
  }, [previewStep, propDemoStep, demoStep, calculateFragmentIndex]);



  return (
    <div className="h-screen">
      <ResizablePanelGroup direction="horizontal" id="project-view-v3-panels">
        <ResizablePanel
          defaultSize={30}
          minSize={20}
          className="flex flex-col min-h-0"
        >
          <div
            className="w-full flex items-center bg-sidebar justify-start gap-x-2 pl-2 px-4 py-3"
          >
            <Image
              src="/shipper_logo.png"
              alt="ShipperAI"
              width={18}
              height={18}
            />
            <span className="text-sm font-medium">{
              demoType === "TODO_APP" && "To do list app" ||
              demoType === "AIRBNB_CLONE" && "Real estate app" ||
              demoType === "SPOTIFY_CLONE" && "Music streaming app" ||
              demoType === "VACATION_APP" && "Internal app: employee vacation tracker" ||
              "Click a demo to start"
            }</span>
          </div>
          {/* Combined Fragments Lists - moved above chat */}
          {/* <div className="border-b bg-sidebar px-2 py-3 overflow-visible">
            <div className="space-y-3">
              Fragments
            </div>
          </div> */}

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

                const newFragmentIndex = calculateFragmentIndex(newStep);
                console.log("  New fragment index:", newFragmentIndex);

                // Call the original callback
                if (onDemoStepChange) {
                  onDemoStepChange(newStep);
                } else {
                  setDemoStep(newStep);
                }
              }, [onDemoStepChange, propDemoStep, demoStep, calculateFragmentIndex])}
              isSimulating={isSimulating}
              initialMessages={displayedMessages}
              allMessages={allMessages}
            />
          </Suspense>
        </ResizablePanel>
        <ResizableHandle className="bg-transparent hover:bg-foreground/10 transition-colors duration-300" />
        <ResizablePanel
          defaultSize={70}
          minSize={50}
          className="flex flex-col min-h-0"
        >
          <Tabs
            defaultValue="preview"
            className="gap-y-0 h-full flex flex-col"
            value={tabState}
            onValueChange={(value) => {
              setTabState(value as "code" | "preview");
            }}
          >
            <div className="px-2 items-center flex gap-x-2 border-b py-2">
              <TabsList className="h-8 p-0 border rounded-md">
                <TabsTrigger className="rounded-md" value="preview">
                  <EyeIcon />
                  <span>Preview</span>
                </TabsTrigger>

                <TabsTrigger className="rounded-md" value="code">
                  <CodeIcon />
                  <span>Code</span>
                </TabsTrigger>
              </TabsList>

              <div className="flex-1"></div>

              {!demoType && (
                <Button 
                  onClick={() => {
                    // Handle demo start logic here
                    console.log('Starting demo...');
                  }}
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Click a demo to start
                </Button>
              )}
            </div>

            <TabsContent value="preview" className="flex-1 m-0 p-0 min-h-0">
              <DemoPreview
                demoStep={previewStep ?? propDemoStep ?? demoStep}
                currentFragmentIndex={currentFragmentIndex}
                key={`preview-${currentFragmentIndex}`}
                type={demoType}
              />
            </TabsContent>

            <TabsContent value="code" className="flex-1 m-0 p-0 min-h-0">
              <div className="h-full flex flex-col">
                <div className="border-b bg-sidebar px-4 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CodeIcon className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      Files
                    </span>
                  </div>
                </div>
                <div className="flex-1 min-h-0">
                  <DemoFileExplorer
                    demoStep={currentFragmentIndex}
                    key={`files-${currentFragmentIndex}`}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

// Main responsive component
export const DemoProjectViewV3 = (props: ProjectViewV3Props) => {
  return (
    <>
      {/* Mobile View - hidden on desktop */}
      <div className="block md:hidden">
        <MobileDemoProjectViewV3 {...props} />
      </div>
      
      {/* Desktop View - hidden on mobile */}
      <div className="hidden md:block">
        <DesktopDemoProjectViewV3 {...props} />
      </div>
    </>
  );
};
