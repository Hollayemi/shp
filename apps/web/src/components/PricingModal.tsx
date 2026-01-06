"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, ArrowRight, Star } from "lucide-react";
import Link from "next/link";
import {
  PRO_CREDIT_OPTIONS,
  PRICING_TIERS,
  getDefaultCreditOption,
} from "@/lib/pricing";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PricingModal({ isOpen, onClose }: PricingModalProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const trpc = useTRPC();
  const [loading, setLoading] = useState(false);
  const [selectedCredits, setSelectedCredits] = useState<number>(
    getDefaultCreditOption().credits,
  );

  // Get user's current subscription info
  const { data: creditsData } = useQuery({
    ...trpc.credits.getMyCredits.queryOptions(),
    enabled: !!session,
  });

  const currentTier = creditsData?.user?.membershipTier || "FREE";
  const hasActiveSubscription = currentTier !== "FREE";
  // Use originalSubscriptionTier instead of basePlanCredits (which decrements on usage)
  const currentCredits = creditsData?.user?.originalSubscriptionTier || 0;

  // Filter options: show only higher tiers for subscribed users
  const availableOptions = hasActiveSubscription
    ? PRO_CREDIT_OPTIONS.filter((option) => option.credits > currentCredits)
    : PRO_CREDIT_OPTIONS;

  const selectedOption = availableOptions.find(
    (option) => option.credits === selectedCredits,
  );

  // Auto-select first available option if current selection is not available
  if (hasActiveSubscription && !selectedOption && availableOptions.length > 0) {
    setSelectedCredits(availableOptions[0].credits);
  }

  const handleSubscribe = async () => {
    // Wait for session to load
    if (status === "loading") {
      return;
    }

    if (!session) {
      router.push("/auth/signin");
      onClose();
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
          returnUrl: window.location.href,
        }),
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));
        console.error("Stripe API error:", errorData);

        // Handle specific error for already subscribed users
        if (errorData.code === "ALREADY_SUBSCRIBED") {
          alert(
            'You already have this subscription tier. To change your credit allowance, please use the "Manage Subscription" option in your profile menu.',
          );
          onClose();
          return;
        }

        throw new Error(
          errorData.message ||
            errorData.error ||
            "Failed to create checkout session",
        );
      }

      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error("Subscription error:", error);
      alert("Failed to start subscription. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleContactSales = () => {
    window.open("mailto:sales@shipper.now", "_blank");
    onClose();
  };

  const features = [
    "Launching in hours instead of weeks",
    "Having an MVP before your ☕ gets cold",
    "Keeping momentum alive",
    "Going from 💡 to live build in Hero's timeline",
    "Launching, instead of being a wantrepreneur",
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose} modal={true}>
      <DialogContent
        className="max-h-[90vh] min-w-fit overflow-y-auto"
        onPointerDownOutside={(e) => {
          e.preventDefault();
        }}
        onInteractOutside={(e) => {
          e.preventDefault();
        }}
      >
        <DialogHeader className="space-y-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-3xl font-bold text-gray-900 dark:text-white">
              Choose Your Plan
            </DialogTitle>
            {/* <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button> */}
          </div>

          <p className="text-lg text-gray-600 dark:text-gray-300">
            What&apos;s the price of:
          </p>

          {/* Value propositions */}
          <div className="mx-auto flex max-w-4xl flex-wrap justify-center gap-3">
            {features.map((feature, index) => (
              <div
                key={index}
                className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-1 dark:bg-green-900/20"
              >
                <Check className="h-3 w-3 flex-shrink-0 text-green-500" />
                <span className="text-xs text-gray-700 dark:text-gray-300">
                  {feature}
                </span>
              </div>
            ))}
          </div>
        </DialogHeader>

        {/* Pricing Cards */}
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {/* Pro Tier with Dropdown */}
          <div className="relative rounded-xl border-2 border-blue-500 bg-white p-6 shadow-xl dark:bg-gray-800">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 transform">
              <Badge className="flex items-center gap-1 bg-blue-500 px-3 py-1 text-xs text-white">
                <Star className="h-3 w-3" />
                POPULAR
              </Badge>
            </div>

            <div className="mb-6 text-center">
              <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
                {PRICING_TIERS.pro.name}
              </h3>
              <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                {PRICING_TIERS.pro.description}
              </p>

              <div className="mb-4">
                <span className="text-3xl font-bold text-gray-900 dark:text-white">
                  ${selectedOption?.price}
                </span>
                <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                  / month
                </span>
              </div>

              {/* Credit Selection Dropdown */}
              <div className="mb-4">
                {availableOptions.length > 0 ? (
                  <Select
                    value={selectedCredits.toString()}
                    onValueChange={(value) =>
                      setSelectedCredits(parseInt(value))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent
                      className="max-h-[300px]"
                      onCloseAutoFocus={(e) => {
                        e.preventDefault();
                      }}
                    >
                      {availableOptions.map((option) => (
                        <SelectItem
                          key={option.credits}
                          value={option.credits.toString()}
                        >
                          <div className="flex w-full items-center justify-between">
                            <span className="text-sm">
                              {option.credits.toLocaleString()} credits / month
                            </span>
                            {option.popular && (
                              <Badge
                                variant="secondary"
                                className="ml-2 text-xs"
                              >
                                Popular
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="rounded-lg bg-gray-50 px-3 py-4 text-center dark:bg-gray-700">
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      You&apos;re on the highest Pro tier! 🎉
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Contact sales for Enterprise options
                    </p>
                  </div>
                )}
              </div>

              {/* {selectedOption && selectedOption.credits > 100 && (
                <Badge variant="secondary" className="mb-4 text-xs">
                  Save {Math.round(((selectedOption.credits * 0.1 - selectedOption.price) / (selectedOption.credits * 0.1)) * 100)}%
                </Badge>
              )} */}
            </div>

            <div className="mb-6 space-y-3">
              <p className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                Everything you need:
              </p>
              {PRICING_TIERS.pro.features.map((feature, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Check className="h-4 w-4 flex-shrink-0 text-blue-500" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {feature}
                  </span>
                </div>
              ))}
            </div>

            <Button
              size="sm"
              className="w-full bg-blue-500 text-white hover:bg-blue-600"
              onClick={handleSubscribe}
              disabled={loading || availableOptions.length === 0}
            >
              {loading
                ? "Processing..."
                : hasActiveSubscription
                  ? "Upgrade Plan"
                  : "Get Started"}
              {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>

            {hasActiveSubscription && (
              <p className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">
                Upgrading will preserve your unused credits
              </p>
            )}
          </div>

          {/* Enterprise Tier */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-lg dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-6 text-center">
              <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
                {PRICING_TIERS.enterprise.name}
              </h3>
              <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                {PRICING_TIERS.enterprise.description}
              </p>

              <div className="mb-4">
                <span className="text-3xl font-bold text-gray-900 dark:text-white">
                  Custom
                </span>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Tailored to your needs
                </p>
              </div>
            </div>

            <div className="mb-6 space-y-3">
              <p className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                Enterprise features:
              </p>
              {PRICING_TIERS.enterprise.features.map((feature, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Check className="h-4 w-4 flex-shrink-0 text-purple-500" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {feature}
                  </span>
                </div>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full border-purple-500 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20"
              asChild
            >
              <Link
                href="https://tally.so/r/wzB9L1"
                target="_blank"
                rel="noopener noreferrer"
              >
                Contact Sales
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-6 text-center">
          <div className="rounded-xl bg-gradient-to-r from-blue-50 to-purple-50 p-6 dark:from-blue-900/20 dark:to-purple-900/20">
            <h3 className="mb-3 text-lg font-bold text-gray-900 dark:text-white">
              Start building today
            </h3>
            <div className="mb-4 flex flex-wrap justify-center gap-3">
              <span className="flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                <Check className="h-3 w-3 text-green-500" />
                No setup fees
              </span>
              <span className="flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                <Check className="h-3 w-3 text-green-500" />
                Cancel anytime
              </span>
              <span className="flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                <Check className="h-3 w-3 text-green-500" />
                24/7 support
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
