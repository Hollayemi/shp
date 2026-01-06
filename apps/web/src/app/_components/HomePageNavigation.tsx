"use client";

import { Session } from "next-auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { UserProfile } from "@/components/UserProfile";
import { Coins, Menu, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface HomePageNavigationProps {
  session: Session | null;
  credits: { creditBalance: number } | null;
}

export function HomePageNavigation({
  session,
  credits,
}: HomePageNavigationProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const mobileButtonRef = useRef<HTMLButtonElement>(null);

  // Handle outside click to close mobile menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(event.target as Node) &&
        mobileButtonRef.current &&
        !mobileButtonRef.current.contains(event.target as Node)
      ) {
        setIsMobileMenuOpen(false);
      }
    }

    if (isMobileMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMobileMenuOpen]);

  return (
    <div className="sticky top-[16px] z-50 mx-0">
      <nav
        className="bg-white dark:bg-background text-nav-text mx-auto rounded-[20px] px-4 py-4"
        style={{ boxShadow: "0px 4px 8px -1px rgba(13, 13, 18, 0.02)" }}
      >
        <div className="mx-[12px] flex max-w-[1280px] items-center sm:mx-[22px] md:mx-[44.5px] xl:mx-auto">
          <div className="flex flex-1 items-center">
            <h1 className="text-nav-text font-playfair p-[6px] text-[30px] font-extrabold">
              Shipper
            </h1>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden flex-shrink-0 items-center space-x-8 md:flex">
            {/* <Link
              href="/templates"
              className="text-nav-text hover:text-primary transition-colors"
            >
              Templates
            </Link> */}
            <a
              href="https://shipper.now/blog/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-nav-text hover:text-nav-text/80 hover:bg-nav-text/10 px-3 py-2 rounded-md transition-colors"
            >
              Blog
            </a>
            <a
              href="https://discord.com/invite/ggQywDXCTT"
              target="_blank"
              rel="noopener noreferrer"
              className="text-nav-text hover:text-nav-text/80 hover:bg-nav-text/10 px-3 py-2 rounded-md transition-colors"
            >
              Community
            </a>
            <button
              onClick={() => {
                requestAnimationFrame(() => {
                  const pricingSection = document.getElementById("pricing");
                  pricingSection?.scrollIntoView({ behavior: "smooth" });
                });
              }}
              className="text-nav-text hover:text-nav-text/80 hover:bg-nav-text/10 px-3 py-2 rounded-md transition-colors"
            >
              Pricing
            </button>
          </div>

          {/* Desktop Auth Section */}
          <div className="hidden flex-1 items-center justify-end space-x-5 md:flex">
            {session ? (
              <>
                {/* Credit indicator - show when low on credits */}
                {credits && credits.creditBalance <= 2 && (
                  <div className="flex items-center space-x-1 rounded-full border border-orange-500/20 bg-orange-500/10 px-2 py-1 text-sm text-orange-600">
                    <Coins className="h-3 w-3" />
                    <span>{credits.creditBalance}</span>
                  </div>
                )}
                <UserProfile session={session} />
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  className="text-nav-text hover:text-nav-text/80 hover:bg-nav-text/10"
                  asChild
                >
                  <Link href="/auth/signin">Login</Link>
                </Button>

                <Button
                  variant="default"
                  className="bg-[#1E9A80] hover:bg-[#1E9A80]/90 border-none shadow-nav-button-sm hover:shadow-nav-button-md text-white dark:text-white rounded-[12px] transition-all"
                  asChild
                >
                  <Link href="/auth/signin">Get Started</Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center space-x-3 md:hidden">
            <Button
              ref={mobileButtonRef}
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-nav-text hover:text-nav-text/80"
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>

          {/* Mobile Menu */}
          {isMobileMenuOpen && (
            <div
              className="bg-background absolute top-full right-0 left-0 z-50 border-t shadow-lg md:hidden"
              ref={mobileMenuRef}
            >
              <div className="flex flex-col space-y-4 p-4">
                {/* Mobile Navigation Links */}
                {/* <Link
                  href="/templates"
                  className="text-nav-text hover:text-nav-text/80 py-2"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Templates
                </Link> */}
                <a
                  href="https://shipper.now/blog/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-nav-text hover:text-nav-text/80 py-2"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Blog
                </a>
                <a
                  href="https://discord.com/invite/ggQywDXCTT"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-nav-text hover:text-nav-text/80 py-2"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Community
                </a>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    requestAnimationFrame(() => {
                      const pricingSection = document.getElementById("pricing");
                      pricingSection?.scrollIntoView({ behavior: "smooth" });
                    });
                  }}
                  className="text-nav-text hover:text-nav-text/80 py-2 text-left"
                >
                  Pricing
                </button>

                {/* Mobile Auth Section */}
                <div className="space-y-3 border-t pt-4">
                  {session ? (
                    <>
                      {credits && credits.creditBalance <= 2 && (
                        <div className="flex w-fit items-center space-x-1 rounded-full border border-orange-500/20 bg-orange-500/10 px-2 py-1 text-sm text-orange-600">
                          <Coins className="h-3 w-3" />
                          <span>{credits.creditBalance}</span>
                        </div>
                      )}
                      <UserProfile session={session} />
                    </>
                  ) : (
                    <div className="flex flex-col space-y-3">
                      <Button
                        variant="ghost"
                        className="text-nav-text hover:text-nav-text/80 hover:bg-nav-text/10 justify-start"
                        asChild
                      >
                        <Link href="/auth/signin">Login</Link>
                      </Button>
                      <Button
                        variant="default"
                        className="bg-[#1E9A80] hover:bg-[#1E9A80]/90 border-none shadow-nav-button-sm hover:shadow-nav-button-md text-white dark:text-white rounded-[12px] transition-all w-fit"
                        asChild
                      >
                        <Link href="/auth/signin">Get started</Link>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>
    </div>
  );
}
