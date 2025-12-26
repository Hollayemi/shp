"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { GenerativeChatInput } from "./GenerativeChatInput";
import { UserProfile } from "@/components/UserProfile";
import { ThemeButton } from "./ThemeButton";
import ProjectsGrid from "./ProjectsGrid";
import { PricingSection } from "@/components/PricingSection";
import Link from "next/link";
import { Session } from "next-auth";
import blurLandingBg from "../../../public/blur_landing.png";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Coins } from "lucide-react";

interface HomePageClientProps {
  session: Session | null;
}

export function HomePageClient({ session }: HomePageClientProps) {
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const trpc = useTRPC();
  
  // Get user's credit balance if logged in
  const { data: credits } = useQuery({
    ...trpc.credits.getMyCredits.queryOptions(),
    enabled: !!session, // Only run query if user is logged in
  });

  return (
    <div className="min-h-screen px-4">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-center space-x-8">
          <h1 className="text-xl font-bold text-black dark:text-white">Shipper.now</h1>
          <div className="hidden md:flex space-x-6">
            <a
              href="#"
              className="text-black dark:text-white/90 hover:text-black dark:hover:text-white "
            >
              Discord
            </a>
            <button
              onClick={() => {
                const pricingSection = document.getElementById('pricing');
                if (pricingSection) {
                  pricingSection.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              className="text-black dark:text-white/90 hover:text-black dark:hover:text-white "
            >
              Pricing
            </button>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {session ? (
            <>
              {/* Credit indicator - show when low on credits */}
              {credits && credits.user.creditBalance <= 2 && (
                <div className="flex items-center space-x-1 px-2 py-1 bg-orange-500/10 border border-orange-500/20 rounded-full text-orange-600 text-sm">
                  <Coins className="w-3 h-3" />
                  <span>{credits.user.creditBalance}</span>
                </div>
              )}
              <UserProfile session={session} />
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                className="text-black dark:text-white/90 hover:text-white hover:bg-white/10"
                asChild
              >
                <Link href="/auth/signin">Log in</Link>
              </Button>

              <Button
                variant="default"
                className=" backdrop-blur-sm rounded-fll text-white dark:text-black  border-white/20 "
                asChild
              >
                <Link href="/auth/signin">Get started</Link>
              </Button>
            </>
          )}
          <ThemeButton />
        </div>
      </nav>

      {/* Hero Section */}
      <div 
        className="flex flex-col items-center justify-center min-h-[90vh] px-6 text-center w-full rounded-lg hero-bg"
        style={{
          backgroundImage: `url('${blurLandingBg.src}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'top',
          backgroundRepeat: 'no-repeat'
        }}
      >
        <div className="max-w-4xl">
          <h1 className="text-5xl md:text-5xl font-semibold text-black dark:text-white mb-2 drop-shadow-lg">
            Chat it into existence
          </h1>
          <div className="text-lg  text-black dark:text-white drop-shadow-md">
            Turn your ideas into applications, in minutes.
          </div>
          <div className="text-lg  text-black dark:text-white mb-12 drop-shadow-md">
            Create a revenue-ready product by chatting with AI.
          </div>
          <div className="space-y-6">
            <GenerativeChatInput />
            {/* <div className="flex items-center justify-center gap-4">
              <Button 
                variant="outline" 
                onClick={() => setIsPricingModalOpen(true)}
                className="backdrop-blur-sm bg-white/10 border-white/20 text-black dark:text-white hover:bg-white/20"
              >
                View Pricing
              </Button>
            </div> */}
          </div>
        </div>
      </div>
      
      {session && session.user && <ProjectsGrid />}
      
      {/* Pricing Section */}
      <PricingSection />
      
    </div>
  );
} 