import { toast } from "sonner";
import React from "react";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { X } from "lucide-react";
import Link from "next/link";

/**
 * Toast notification utilities for insufficient credits
 */

interface CreditErrorOptions {
  /**
   * Callback when user clicks the upgrade/buy credits button
   */
  onUpgrade: () => void;
  /**
   * Custom duration in milliseconds. Use Infinity for persistent toasts
   */
  duration?: number;
  /**
   * Custom title for the toast
   */
  title?: string;
  /**
   * Custom description for the toast
   */
  description?: string;
}

/**
 * Custom toast content component for insufficient credits
 */
function InsufficientCreditsContent({
  title,
  description,
  actionLabel,
  onAction,
  onClose,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex items-start gap-3 w-full">
      {/* Icon placeholder - user will add icon later */}
      <Image src="/error-icon.svg" alt="Alert" width={40} height={40} priority />
      {/* Content */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium text-gray-950 dark:text-foreground">
          {title}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-4 whitespace-pre-line">
          {description}
        </p>
        <Button
          onClick={(e) => {
            e.preventDefault();
            onAction();
          }}
          className="rounded-[8px] relative overflow-hidden h-[32px] w-[140px] font-medium text-sm shadow-xs text-white dark:text-background bg-gray-950 bg-radial-[at_50%_0%] from-white/30 to-white/0 to-70% dark:bg-foreground hover:opacity-90"
        >
          {actionLabel}
        </Button>

      </div>
      <button
        onClick={onClose}
        className="text-gray-500 dark:text-muted-foreground hover:text-gray-900 dark:hover:text-foreground transition-colors p-1 hover:bg-gray-100 dark:hover:bg-accent rounded-md"
        aria-label="Close"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

/**
 * Custom toast content component with rich text support (for links, etc.)
 */
function NeedPaidPlanContent({
  title,
  description,
  actionLabel,
  onAction,
  onClose,
}: {
  title: string;
  description: React.ReactNode;
  actionLabel: string;
  onAction: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex items-start gap-3 w-full">
      {/* Icon placeholder - user will add icon later */}
      <Image src="/error-icon.svg" alt="Alert" width={40} height={40} priority />
      {/* Content */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium text-gray-950 dark:text-foreground">
          {title}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-4 whitespace-pre-line">
          {description}
        </p>
        <Button
          onClick={(e) => {
            e.preventDefault();
            onAction();
          }}
          className="rounded-[8px] relative overflow-hidden h-[32px] w-[140px] font-medium text-sm shadow-xs text-white dark:text-background bg-gray-950 bg-radial-[at_50%_0%] from-white/30 to-white/0 to-70% dark:bg-foreground hover:opacity-90"
        >
          {actionLabel}
        </Button>

      </div>
      <button
        onClick={onClose}
        className="text-gray-500 dark:text-muted-foreground hover:text-gray-900 dark:hover:text-foreground transition-colors p-1 hover:bg-gray-100 dark:hover:bg-accent rounded-md"
        aria-label="Close"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

/**
 * Show a persistent, user-friendly notification when credits are insufficient (for paid users)
 */
export function showInsufficientCreditsToast(options: CreditErrorOptions) {
  const { 
    onUpgrade, 
    duration = Infinity,
    title = "Insufficient Credits",
    description = "You've run out of credits.\nUpgrade your plan or purchase more credits to continue\nbuilding amazing projects."
  } = options;

  toast.custom(
    (t) => (
      <div className="relative lg:min-w-[545px] max-w-[545px] w-full bg-white dark:bg-card border border-border/50 rounded-2xl shadow-lg p-4">
        <InsufficientCreditsContent
          title={title}
          description={description}
          actionLabel="Upgrade Now"
          onAction={() => {
            onUpgrade();
            toast.dismiss(t);
          }}
          onClose={() => toast.dismiss(t)}
        />
      </div>
    ),
    {
      duration,
      dismissible: true,
    }
  );
}

/**
 * Show a notification for free plan users who need to upgrade to a paid plan
 */
export function showNeedPaidPlanToast(options: CreditErrorOptions) {
  const { 
    onUpgrade, 
    duration = Infinity,
    title = "You need a paid plan"
  } = options;

  toast.custom(
    (t) => {
      const description = (
        <span>
          You currently have no credits.{" "}
       
          Upgrade to a paid plan to start using Shipper. Not convinced?{" "}
          <Link
            href="/demo"
            className="underline hover:text-gray-900 dark:hover:text-foreground font-medium"
            onClick={() => toast.dismiss(t)}
          >
            See our playable demo here
          </Link>
        </span>
      );

      return (
        <div className="relative lg:min-w-[545px] max-w-[545px] w-full bg-white dark:bg-card border border-border/50 rounded-2xl shadow-lg p-4">
          <NeedPaidPlanContent
            title={title}
            description={description}
            actionLabel="Upgrade Now"
            onAction={() => {
              onUpgrade();
              toast.dismiss(t);
            }}
            onClose={() => toast.dismiss(t)}
          />
        </div>
      );
    },
    {
      duration,
      dismissible: true,
    }
  );
}