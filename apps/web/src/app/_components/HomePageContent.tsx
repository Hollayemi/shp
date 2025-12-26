"use client";

import { useState, useEffect, Suspense } from "react";
import { Session } from "next-auth";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useRouter } from "nextjs-toploader/app";
import { GenerativeChatInput } from "./GenerativeChatInput";
import OptimizedProjectsGrid from "./OptimizedProjectsGrid";
import { PricingSection } from "@/components/PricingSection";
import heroLandingBg from "../../../public/hero-bg-new.png";
import { CtaSection } from "./CtaSection";
import { TemplatesSection } from "@/modules/templates/components";

interface Project {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    messages: number;
    v2Messages?: number;
  };
  subtitle?: string;
  logo?: string;
}

interface HomePageContentProps {
  session: Session | null;
  initialProjects: Project[] | null;
  initialCredits: { creditBalance: number } | null;
  initialPaymentStatus: { hasNeverPaid: boolean } | null;
  initialSubscriptionStatus: { hasActiveSubscription: boolean } | null;
  isAdmin: boolean;
}

function SearchParamsWrapper({
  session,
  initialProjects,
  initialCredits,
  initialPaymentStatus,
  initialSubscriptionStatus,
  isAdmin,
}: HomePageContentProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [initialName, setInitialName] = useState<string>("");

  useEffect(() => {
    const nameParam = searchParams.get("name");
    const errorParam = searchParams.get("error");

    if (nameParam) {
      setInitialName(nameParam);
    }

    // Clean URL by removing both name and error parameters
    if (nameParam || errorParam) {
      const newSearchParams = new URLSearchParams(searchParams.toString());
      newSearchParams.delete("name");
      newSearchParams.delete("error");
      const newUrl = newSearchParams.toString()
        ? `${window.location.pathname}?${newSearchParams.toString()}`
        : window.location.pathname;
      router.replace(newUrl);
    }
  }, [searchParams, router]);

  return (
    <HomePageContentInner
      session={session}
      initialProjects={initialProjects}
      initialCredits={initialCredits}
      initialPaymentStatus={initialPaymentStatus}
      initialSubscriptionStatus={initialSubscriptionStatus}
      isAdmin={isAdmin}
      initialName={initialName}
    />
  );
}

function HomePageContentInner({
  session,
  initialProjects,
  initialCredits,
  initialPaymentStatus,
  initialSubscriptionStatus,
  isAdmin,
  initialName,
}: HomePageContentProps & { initialName: string }) {
  return (
    <div className="min-h-screen bg-transparent">
      {/* Hero Section */}
      <div className="relative flex min-h-[80vh] w-full flex-col items-center justify-center px-4 text-center md:min-h-[90vh] md:px-6 pb-8 bg-transparent overflow-hidden rounded-3xl dark:border-[3px] dark:border-[#313C38]">
        {/* Optimized background image */}
        <Image
          src={heroLandingBg}
          alt="Hero background"
          fill
          priority
          className="z-0 w-full object-cover object-top"
          sizes="100vw"
        />
        {/* Dark overlay for better text contrast in dark mode only */}
        <div className="absolute inset-0 z-10 pointer-events-none bg-transparent dark:bg-[#0A0E0D99]" />
        <div className="text-foreground relative z-20 mt-[155px] w-full max-w-5xl mx-auto px-2 md:px-4">
          <h1 className="mb-2 text-3xl leading-tight font-medium tracking-tight text-gray-900 sm:text-4xl md:text-5xl dark:text-white">
            Chat it into{" "}
            <span className="font-playfair italic">existence </span>
          </h1>
          <div className="text-base text-gray-900 dark:text-white">
            Turn your ideas into applications, in minutes.
          </div>
          <div className="mb-8 text-sm text-gray-900 sm:text-base md:mb-13 dark:text-white">
            Create a revenue-ready product by chatting with AI.
          </div>
          <div className="space-y-6">
            <GenerativeChatInput
              initialCredits={initialCredits}
              initialDescription={initialName}
            />
          </div>
        </div>
      </div>

      {/* Projects Section - Only show if user is logged in and has projects */}
      {session && initialProjects && (
        <OptimizedProjectsGrid
          session={session}
          initialProjects={initialProjects}
          hasActiveSubscription={
            initialSubscriptionStatus?.hasActiveSubscription ?? false
          }
          isAdmin={isAdmin}
        />
      )}
      {/* Templates Section - Always visible to all users */}
      {/* <div className="container mx-auto px-4">
        <TemplatesSection variant="landing" limit={8} showCategories={false} />
      </div> */}
      {/* Pricing Section */}
      <PricingSection />
      {/* Special CTA for users who never paid */}
      {(!session?.user || initialPaymentStatus?.hasNeverPaid) && <CtaSection />}
    </div>
  );
}

export function HomePageContent(props: HomePageContentProps) {
  return (
    <Suspense fallback={<HomePageContentInner {...props} initialName="" />}>
      <SearchParamsWrapper {...props} />
    </Suspense>
  );
}
