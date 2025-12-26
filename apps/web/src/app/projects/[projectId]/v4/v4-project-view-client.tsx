"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { Session } from "next-auth";
import Chat from "@/modules/projects/ui/components/Chat";
import { NoCreditsPrompt } from "@/components/NoCreditsPrompt";

interface V4ProjectViewClientProps {
  projectId: string;
  session: Session;
  isAdmin: boolean;
}

export function V4ProjectViewClient({
  projectId,
  session,
  isAdmin,
}: V4ProjectViewClientProps) {
  const trpc = useTRPC();

  // Use suspense query since data is prefetched on server
  const { data: subscriptionStatus } = useSuspenseQuery(
    trpc.projects.hasActiveSubscription.queryOptions(),
  );

  // Get user credits
  const { data: creditsData } = useSuspenseQuery(
    trpc.projects.getUserCredits.queryOptions(),
  );

  // Get messages for Chat component
  const { data: initialMessages } = useSuspenseQuery(
    trpc.messages.getManyV2.queryOptions({ projectId }),
  );

  // Get project data to check if there's an active stream
  const { data: projectData } = useSuspenseQuery(
    trpc.projects.getOne.queryOptions({ projectId }),
  );

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

  return (
    <div className="flex h-screen w-full">
      <div className="flex flex-1 flex-col">
        <Chat
          key={`chat-${projectId}`}
          id={projectId}
          projectId={projectId}
          userId={session.user.id}
          initialMessages={initialMessages}
          shouldResume={shouldResume}
        />
      </div>
    </div>
  );
}
