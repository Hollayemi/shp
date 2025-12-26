"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { Session } from "next-auth";
import Chat from "@/modules/projects/ui/components/Chat";
import { NoCreditsPrompt } from "@/components/NoCreditsPrompt";
import { RefreshableWebPreview } from "@/components/ai-elements/RefreshableWebPreview";
import { WebPreviewBody } from "@/components/ai-elements/web-preview";
import { useSandboxStateV3 } from "@/hooks/useSandboxStateV3";
import { useAtomValue } from "jotai";
import { sandboxPreviewUrlAtom } from "@/lib/sandbox-preview-state";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

interface ProjectViewClientProps {
  projectId: string;
  session: Session;
  isAdmin: boolean;
}

export function ProjectViewClient({
  projectId,
  session,
  isAdmin,
}: ProjectViewClientProps) {
  const trpc = useTRPC();

  // Use suspense query since data is prefetched on server
  const subscriptionQuery = trpc.projects.hasActiveSubscription.queryOptions();
  const { data: subscriptionStatus } = useSuspenseQuery({
    ...subscriptionQuery,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Get user credits
  const creditsQuery = trpc.projects.getUserCredits.queryOptions();
  const { data: creditsData } = useSuspenseQuery({
    ...creditsQuery,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Get messages for Chat component
  const initialMessagesQuery = trpc.messages.getManyV2.queryOptions({
    projectId,
  });
  const { data: initialMessages } = useSuspenseQuery({
    ...initialMessagesQuery,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Get project data to check if there's an active stream
  const projectQuery = trpc.projects.getOne.queryOptions({ projectId });
  const { data: projectData } = useSuspenseQuery({
    ...projectQuery,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Get sandbox state
  const sandbox = useSandboxStateV3({
    projectId,
    onStateChange: (state) => {
      console.log("[ProjectViewClient] Sandbox state change:", state);
    },
  });

  // Get sandbox preview URL from atom (set by Chat component)
  const sandboxPreviewUrlFromAtom = useAtomValue(sandboxPreviewUrlAtom);

  // Check if user has credit balance
  const hasCreditBalance = (creditsData?.creditBalance ?? 0) > 0;

  // Show subscription required message if user has no active subscription
  // Exception: Admins and users with credit balance can still access
  if (
    !subscriptionStatus?.hasActiveSubscription &&
    !isAdmin &&
    !hasCreditBalance
  ) {
    return (
      <NoCreditsPrompt
        variant="page"
        description="Please renew your subscription to access this project and continue building."
        showBackButton={true}
      />
    );
  }

  // Check if there's an active generation stream
  const shouldResume = projectData?.activeStreamId ? true : false;

  // Determine which URL to use for preview
  const previewUrl =
    sandboxPreviewUrlFromAtom?.url ||
    sandboxPreviewUrlFromAtom?.authenticatedUrl ||
    (sandbox.isHealthy ? sandbox.sandboxUrl : "");

  return (
    <div className="flex h-screen w-full">
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel defaultSize={40} minSize={30}>
          <div className="flex h-full flex-1 flex-col">
            <Chat
              key={`chat-${projectId}`}
              id={projectId}
              projectId={projectId}
              userId={session.user.id}
              initialMessages={initialMessages}
              shouldResume={shouldResume}
            />
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={60} minSize={40}>
          <div className="bg-prj-bg-secondary h-full w-full">
            {previewUrl ? (
              <RefreshableWebPreview defaultUrl={previewUrl} className="h-full">
                <WebPreviewBody />
              </RefreshableWebPreview>
            ) : (
              <div className="text-muted-foreground flex h-full items-center justify-center">
                {sandbox.state.status === "initializing" &&
                  "Initializing sandbox..."}
                {sandbox.state.status === "recovering" &&
                  "Recovering sandbox..."}
                {sandbox.state.status === "unhealthy" && "Sandbox unavailable"}
                {sandbox.state.status === "failed" && "Sandbox failed to start"}
                {sandbox.isExpired && "Sandbox expired"}
                {sandbox.isHealthy && !previewUrl && "Waiting for preview..."}
              </div>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
