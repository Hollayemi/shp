import { getQueryClient, trpc } from "@/trpc/server";
import { AuthWrapper } from "@/components/AuthWrapper";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Suspense } from "react";
import LoadingSpinner from "@/components/LoadingSpinner";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ProjectViewWrapper } from "./project-view-wrapper";
import { isAdminEmail } from "@/lib/admin";

interface ProjectPageProps {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ prompt?: string }>;
}

const ProjectPage = async ({ params, searchParams }: ProjectPageProps) => {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const queryClient = getQueryClient();

  // Get session for server-side prefetching and passing to components
  const session = await auth();

  if (!session) {
    redirect("/auth/signin");
  }

  // Only prefetch essential data - no blocking sandbox operations
  await queryClient.prefetchQuery(
    trpc.projects.getOne.queryOptions({
      projectId: resolvedParams.projectId,
    }),
  );

  await queryClient.prefetchQuery(
    trpc.messages.getManyV2.queryOptions({
      projectId: resolvedParams.projectId,
    }),
  );

  // Prefetch subscription status for access control
  await queryClient.prefetchQuery(
    trpc.projects.hasActiveSubscription.queryOptions(),
  );

  // Check if user is admin (server-side)
  const isAdmin = isAdminEmail(session.user.email);

  // Note: getProjectWithSandbox and fragments now load client-side to avoid blocking on sandbox operations

  const dehydratedState = dehydrate(queryClient);

  return (
    <AuthWrapper requireAuth>
      <HydrationBoundary state={dehydratedState}>
        <Suspense fallback={<LoadingSpinner />}>
          <ProjectViewWrapper
            projectId={resolvedParams.projectId}
            session={session}
            isAdmin={isAdmin}
            initialPrompt={resolvedSearchParams.prompt}
          />
        </Suspense>
      </HydrationBoundary>
    </AuthWrapper>
  );
};

export default ProjectPage;
