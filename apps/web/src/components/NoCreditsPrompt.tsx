"use client";

import { Button } from "@/components/ui/button";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import PricingModal from "@/components/PricingModal";

interface NoCreditsPromptProps {
  title?: string;
  description?: string;
  showBackButton?: boolean;
  variant?: "page" | "section";
}

export function NoCreditsPrompt({
  title = "Subscription Required",
  description = "Please renew your subscription to view and access your projects.",
  showBackButton = false,
  variant = "section",
}: NoCreditsPromptProps) {
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);

  const containerClasses =
    variant === "page"
      ? "min-h-screen bg-prj-bg-primary flex items-center justify-center p-4"
      : "space-y-6 mt-4 px-4 md:px-16";

  return (
    <>
      <div className={containerClasses}>
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="max-w-md text-center space-y-4">
            {/* Lock Icon */}
            <div className="w-16 h-16 md:w-20 md:h-20 mx-auto bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/20 dark:to-orange-800/20 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 md:w-10 md:h-10 text-orange-600 dark:text-orange-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>

            {/* Title and Description */}
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {title}
              </h2>
              <p className="text-gray-600 dark:text-gray-400">{description}</p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
              <Button
                size="lg"
                className="w-full sm:w-auto"
                onClick={() => setIsPricingModalOpen(true)}
              >
                Renew Subscription
              </Button>
              {showBackButton && (
                <Link href="/">
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full sm:w-auto"
                  >
                    <ArrowLeftIcon className="w-4 h-4 mr-2" />
                    Back to Home
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Modal */}
      <PricingModal
        isOpen={isPricingModalOpen}
        onClose={() => setIsPricingModalOpen(false)}
      />
    </>
  );
}
