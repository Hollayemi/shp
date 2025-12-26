import { getQueryClient, trpc } from "@/trpc/server";
import { AuthWrapper } from "@/components/AuthWrapper";
import {
  dehydrate,
  HydrationBoundary,
} from "@tanstack/react-query";
import { Suspense } from "react";
import LoadingSpinner from "@/components/LoadingSpinner";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { V4ProjectViewClient } from "./v4-project-view-client";
import { isAdminEmail } from "@/lib/admin";

interface V4ProjectPageProps {
  params: Promise<{ projectId: string }>;
}

const V4ProjectPage = async ({ params }: V4ProjectPageProps) => {
  const resolvedParams = await params;
  const queryClient = getQueryClient();

  // Get session for server-side prefetching and passing to components
  const session = await auth();

  if (!session) {
    redirect("/auth/signin");
  }

  // Prefetch messages for Chat component
  await queryClient.prefetchQuery(
    trpc.messages.getManyV2.queryOptions({
      projectId: resolvedParams.projectId,
    }),
  );

  // Prefetch project data
  await queryClient.prefetchQuery(
    trpc.projects.getOne.queryOptions({
      projectId: resolvedParams.projectId,
    }),
  );

  // Prefetch subscription status for access control
  await queryClient.prefetchQuery(
    trpc.projects.hasActiveSubscription.queryOptions(),
  );

  // Check if user is admin (server-side)
  const isAdmin = isAdminEmail(session.user.email);

  const dehydratedState = dehydrate(queryClient);

  return (
    <AuthWrapper requireAuth>
      <HydrationBoundary state={dehydratedState}>
        <Suspense fallback={<LoadingSpinner />}>
          <V4ProjectViewClient
            projectId={resolvedParams.projectId}
            session={session}
            isAdmin={isAdmin}
          />
        </Suspense>
      </HydrationBoundary>
    </AuthWrapper>
  );
};

export default V4ProjectPage;
