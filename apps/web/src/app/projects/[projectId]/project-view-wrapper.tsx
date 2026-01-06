"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { Session } from "next-auth";
import { ProjectViewV3 } from "@/modules/projects/ui/view/v3-project-view";
import { NoCreditsPrompt } from "@/components/NoCreditsPrompt";

interface ProjectViewWrapperProps {
  projectId: string;
  session: Session;
  isAdmin: boolean;
  initialPrompt?: string;
}

export function ProjectViewWrapper({
  projectId,
  session,
  isAdmin,
  initialPrompt,
}: ProjectViewWrapperProps) {
  const trpc = useTRPC();

  // Use suspense query since data is prefetched on server
  const { data: subscriptionStatus } = useSuspenseQuery(
    trpc.projects.hasActiveSubscription.queryOptions(),
  );

  // Get user credits
  const { data: creditsData } = useSuspenseQuery(
    trpc.projects.getUserCredits.queryOptions(),
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

  // Render the actual project view
  return (
    <ProjectViewV3
      projectId={projectId}
      session={session}
      initialPrompt={initialPrompt}
    />
  );
}
