"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, CreditCard } from "lucide-react";
import Link from "next/link";
import { PRO_CREDIT_OPTIONS, PRICING_TIERS, getDefaultCreditOption } from "@/lib/pricing";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";

interface PricingSectionProps {
  className?: string;
}

export function PricingSection({ className }: PricingSectionProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const trpc = useTRPC();
  const [loading, setLoading] = useState(false);
  const [selectedCredits, setSelectedCredits] = useState<number>(getDefaultCreditOption().credits);

  // Get user's current subscription info
  const { data: creditsData } = useQuery({
    ...trpc.credits.getMyCredits.queryOptions(),
    enabled: !!session,
  });

  const currentTier = creditsData?.user?.membershipTier || 'FREE';
  const hasActiveSubscription = currentTier !== 'FREE';
  // Use originalSubscriptionTier instead of basePlanCredits (which decrements on usage)
  const currentCredits = creditsData?.user?.originalSubscriptionTier || 0;

  // Filter options: show only higher tiers for subscribed users
  const availableOptions = hasActiveSubscription
    ? PRO_CREDIT_OPTIONS.filter(option => option.credits > currentCredits)
    : PRO_CREDIT_OPTIONS;

  const selectedOption = availableOptions.find(option => option.credits === selectedCredits);

  // Auto-select first available option if current selection is not available
  if (hasActiveSubscription && !selectedOption && availableOptions.length > 0) {
    setSelectedCredits(availableOptions[0].credits);
  }

  const handleSubscribe = async () => {
    if (!session) {
      router.push('/auth/signin');
      return;
    }

    if (!selectedOption) return;

    setLoading(true);
    try {
      const response = await fetch("/api/stripe/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tierId: `pro-${selectedOption.credits}`,
          returnUrl: window.location.href
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Stripe API error:', errorData);

        // Handle specific error for already subscribed users
        if (errorData.code === 'ALREADY_SUBSCRIBED') {
          alert('You already have this subscription tier. To change your credit allowance, please use the "Manage Subscription" option in your profile menu.');
          return;
        }

        throw new Error(errorData.message || errorData.error || 'Failed to create checkout session');
      }

      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error('Subscription error:', error);
      alert('Failed to start subscription. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleContactSales = () => {
    // You can replace this with your actual contact method
    window.open('mailto:sales@shipper.now', '_blank');
  };

  const valueProps = [
    "Launching in minutes while others are still drafting plans",
    "Shipping apps so fast people wonder how you do it",
    "Coming up with a working MVP before your ☕️ gets cold",
    "Making apps with 0 lines of code (unless you prefer to write it)",
    "Bringing old business ideas to reality",
  ];

  const proFeatures = [
    `Up to ${(selectedOption?.credits ?? getDefaultCreditOption().credits).toLocaleString()} credits / month`,
    "Remove the Shipper badge",
    "SOON: Teammates",
  ];

  const enterpriseFeatures = [
    "Dedicated support",
    "Custom integrations",
    "SSO",
    "Opt out of data training",
  ];

  return (
    <section
      className={`mt-3 py-12 px-6 bg-white dark:bg-background rounded-3xl ${className}`}
      id="pricing"
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14 space-y-4">
          <p className="inline-flex items-center justify-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-200 border border-[#232D29] dark:border-gray-700 dark:bg-[#313C38] w-20 h-7 rounded-md">
            <CreditCard className="w-3.5 h-3.5" />
            Pricing
          </p>
          <h2 className="text-4xl md:text-5xl font-medium text-gray-900 dark:text-white">
            Great apps start with vision
          </h2>
          <p className="text-base text-[#666D80] dark:text-gray-300">What&apos;s the price of:</p>
          <div className="flex flex-col items-center space-y-3 text-[#666D80] dark:text-[#C7C7C7]">
            {valueProps.map((item) => (
              <div key={item} className="flex items-center gap-2">
                <div className="h-5 w-5 rounded-full border border-[#1E9A80] dark:border-[#008000] bg-white dark:bg-transparent flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 text-[#1E9A80] dark:text-[#008000]" />
                </div>
                <span className="text-[16px] text-[#666D80] dark:text-[#C7C7C7]">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-center gap-[28px] max-w-4xl mx-auto">
          {/* Pro card */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border-2 border-[#020202] dark:border-gray-200/70 p-7 w-full md:w-[386px] md:h-[608px] shadow-[0_0_3px_6px_rgba(213,250,241,0.5)] dark:shadow-[0_0_3px_6px_#1E9A8066] flex flex-col ring-4 ring-[#DCFCE7] dark:ring-emerald-400/50 ring-offset-0 dark:ring-offset-gray-950">
            <h3 className="text-[20px] font-medium leading-[140%] text-gray-900 dark:text-white mb-8">Pro Plan</h3>
            <div className="text-4xl font-bold text-gray-900 dark:text-white leading-tight mb-1">
              ${selectedOption?.price ?? 0}
            </div>
            <p className="text-[16px] font-normal leading-[28px] text-[#717784] dark:text-gray-400 mb-8">
              Per user/month, billed monthly
            </p>

            <div className="mb-8">
              <p className="text-sm text-[#717784] dark:text-gray-300 mb-2">For more projects and usage</p>
              <Select
                value={selectedCredits.toString()}
                onValueChange={(value) => setSelectedCredits(parseInt(value))}
              >
                <SelectTrigger className="w-full h-[52px] min-h-[52px] py-3 text-sm shadow-none focus:ring-0 focus:ring-offset-0 rounded-[12px] bg-white dark:bg-gray-900 hover:bg-white dark:hover:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100">
                  {availableOptions.map((option) => (
                    <SelectItem
                      key={option.credits}
                      value={option.credits.toString()}
                      className="h-11 py-2 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 focus:bg-gray-100 dark:focus:bg-gray-800 focus:text-gray-900 dark:focus:text-gray-100"
                    >
                      {option.credits.toLocaleString()} credits / month
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="mb-8">
              <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Everything in Free, plus:
              </p>
              <div className="space-y-4">
                {proFeatures.map((feature) => (
                  <div key={feature} className="flex items-center gap-2 text-sm text-[#717784] dark:text-gray-200">
                    <Check className="w-4 h-4 text-[#0D0D12] dark:text-emerald-300 shrink-0" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            <Button
              className="w-full bg-[#1E9A80] hover:bg-[#17806b] dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white text-sm h-12 rounded-[12px] mt-auto"
              onClick={handleSubscribe}
              disabled={loading}
            >
              {loading ? "Processing..." : hasActiveSubscription ? "Upgrade Plan" : "Get Started"}
            </Button>
          </div>

          {/* Enterprise card */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-none p-7 w-full md:w-[386px] md:h-[476px] self-center flex flex-col">
            <h3 className="text-[20px] font-medium leading-[140%] text-gray-900 dark:text-white mb-8">Enterprise</h3>
            <div className="text-4xl font-bold text-gray-900 dark:text-white leading-tight mb-8">
              Custom
            </div>

            <div className="mb-8">
              <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Everything in Pro, plus:
              </p>
              <div className="space-y-2">
                {enterpriseFeatures.map((feature) => (
                  <div key={feature} className="flex items-center gap-2 text-sm text-[#717784] dark:text-gray-200">
                    <Check className="w-4 h-4 text-[#0D0D12] dark:text-emerald-300 shrink-0" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-auto">
              <span className="block text-sm text-[#717784] dark:text-gray-200 mb-2">
                For custom needs
              </span>
              <Button
                className="w-full bg-[#1E9A80] hover:bg-[#17806b] dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white text-sm h-12 rounded-[12px]"
                asChild
              >
                <Link href="https://tally.so/r/wzB9L1" target="_blank" rel="noopener noreferrer">
                  Contact Us
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
} 