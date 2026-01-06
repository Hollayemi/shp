import { auth } from "@/lib/auth";
import { HomePageContent } from "./_components/HomePageContent";
import { HomePageNavigation } from "./_components/HomePageNavigation";
import { createCallerFactory, createTRPCContext } from "@/trpc/init";
import { appRouter } from "@/trpc/routers/_app";
import { handleWebflowRedirect } from "@/lib/webflow-redirect";
import { isAdminEmail } from "@/lib/admin";

interface HomeProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const session = await auth();

  await handleWebflowRedirect(params, session);

  // Server-side fetch using tRPC procedures
  let projects = null;
  let credits = null;
  let paymentStatus = null;
  let subscriptionStatus = null;
  let isAdmin = false;

  if (session?.user?.id) {
    try {
      const ctx = await createTRPCContext();
      const caller = createCallerFactory(appRouter)(ctx);

      // Use tRPC procedures for server-side data fetching
      const [projectsData, creditsData, paymentStatusData, subscriptionData] =
        await Promise.all([
          caller.projects.getInitial(),
          caller.projects.getUserCredits(),
          caller.credits.hasNeverPaid(),
          caller.projects.hasActiveSubscription(),
        ]);

      // Transform projects data: convert null to undefined for subtitle and logo
      // to match the Project interface which expects string | undefined
      projects =
        projectsData?.map((project) => ({
          ...project,
          subtitle: project.subtitle ?? undefined,
          logo: project.logo ?? undefined,
        })) ?? null;
      credits = creditsData;
      paymentStatus = paymentStatusData;
      subscriptionStatus = subscriptionData;
      isAdmin = isAdminEmail(session.user.email);
    } catch (error) {
      console.error("Failed to fetch user data:", error);
    }
  }

  return (
    <div className="relative min-h-screen flex flex-col gap-3 pt-4 px-4 md:px-5 bg-[#F8F6F3] dark:bg-[#313C38]">
      <HomePageNavigation session={session} credits={credits} />
      <HomePageContent
        session={session}
        initialProjects={projects}
        initialCredits={credits}
        initialPaymentStatus={paymentStatus}
        initialSubscriptionStatus={subscriptionStatus}
        isAdmin={isAdmin}
      />
    </div>
  );
}
