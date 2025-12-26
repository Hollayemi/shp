"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  Cloud,
  Check,
  X,
  Loader2,
  Database,
  Users,
  Shield,
  Zap,
  CreditCard,
} from "lucide-react";
import { useState } from "react";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";

interface ShipperCloudConfirmationProps {
  /** Requested features to show (e.g., ["authentication", "database"]) */
  requestedFeatures?: string[];
  /** Called when user approves the deployment */
  onConfirm: () => Promise<void>;
  /** Called when user denies the deployment */
  onDeny: () => Promise<void>;
  /** Whether an action is currently in progress */
  isLoading?: boolean;
  /** Whether Shipper Cloud is already enabled for this project */
  isAlreadyEnabled?: boolean;
  /** Callback to open the Cloud Credits modal */
  onOpenCloudCreditsModal?: () => void;
}

/**
 * Confirmation dialog for Shipper Cloud (Convex) deployment
 *
 * This component is displayed when the AI calls the deployToShipperCloud tool.
 * It follows the Human-in-the-Loop pattern where user confirmation is required
 * before executing the deployment.
 */
export function ShipperCloudConfirmation({
  requestedFeatures = [],
  onConfirm,
  onDeny,
  isLoading = false,
  isAlreadyEnabled = false,
  onOpenCloudCreditsModal,
}: ShipperCloudConfirmationProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDenying, setIsDenying] = useState(false);

  // Query cloud credits directly to avoid memoization issues with prop drilling
  const trpc = useTRPC();
  const { data: cloudCreditsData, status: cloudCreditsStatus } = useQuery({
    ...trpc.credits.getCloudCredits.queryOptions(),
    refetchOnWindowFocus: false,
  });

  const cloudCreditBalance = cloudCreditsData?.balance ?? 0;
  const isLoadingCloudCredits = cloudCreditsStatus === "pending";

  // Check if user has sufficient credits (at least some balance)
  // Only consider credits loaded when not in loading state
  const hasCredits = !isLoadingCloudCredits && cloudCreditBalance > 0;

  const handleConfirm = async () => {
    // If no credits, open the Cloud Credits modal instead (or just return if modal callback is not available)
    if (!hasCredits) {
      if (onOpenCloudCreditsModal) {
        onOpenCloudCreditsModal();
      }
      return;
    }

    setIsConfirming(true);
    try {
      await onConfirm();
    } finally {
      setIsConfirming(false);
    }
  };

  const handleDeny = async () => {
    setIsDenying(true);
    try {
      await onDeny();
    } finally {
      setIsDenying(false);
    }
  };

  const isDisabled = isLoading || isConfirming || isDenying || isLoadingCloudCredits;

  // If already enabled, show a different state
  if (isAlreadyEnabled) {
    return (
      <Card className="border-green-500/20 bg-green-500/5 max-w-md border py-0 shadow-lg">
        <CardContent className="space-y-2 px-4 pt-3 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="bg-green-500/10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
              <Check className="text-green-500 h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-green-700 dark:text-green-400">
                Shipper Cloud Already Enabled
              </h3>
              <p className="text-muted-foreground text-xs">
                Backend features are already active for this project
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const features = [
    {
      icon: Users,
      title: "Multi-User Auth",
      description: "Email signup & login",
    },
    {
      icon: Database,
      title: "Secure Database",
      description: "Store your app data",
    },
    {
      icon: Shield,
      title: "Data Isolation",
      description: "Per-user security",
    },
    {
      icon: Zap,
      title: "Real-Time Sync",
      description: "Live data updates",
    },
  ];

  return (
    <Card className="border-border/50 bg-card/95 max-w-md border py-0 shadow-lg">
      <CardContent className="space-y-2 px-4 pt-3 pb-2">
        {/* Header */}
        <div className="flex items-center gap-2.5">
          <div className="bg-primary/10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
            <Cloud className="text-primary h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Enable Shipper Cloud</h3>
            <p className="text-muted-foreground text-xs">
              Add backend features to your app
            </p>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-2 gap-1.5">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="bg-muted/30 flex items-center gap-2 rounded-md p-2"
            >
              <feature.icon className="text-primary h-3.5 w-3.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs leading-tight font-medium">
                  {feature.title}
                </p>
                <p className="text-muted-foreground truncate text-[11px]">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Requested Features */}
        {requestedFeatures.length > 0 && (
          <p className="text-muted-foreground text-xs">
            Requested features:{" "}
            <span className="text-foreground font-medium">
              {requestedFeatures.join(", ")}
            </span>
          </p>
        )}

        {/* Note - show different message based on credit status */}
        {isLoadingCloudCredits ? (
          <p className="text-muted-foreground text-[11px] flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
            Checking cloud credit balance...
          </p>
        ) : hasCredits ? (
          <p className="text-muted-foreground text-[11px]">
            Note: This can&apos;t be undone once enabled. Cloud credits will be used for usage.
          </p>
        ) : (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md p-2">
            <p className="text-amber-800 dark:text-amber-200 text-[11px] flex items-center gap-1.5">
              <CreditCard className="h-3 w-3 shrink-0" />
              Cloud credits required. Add credits to enable Shipper Cloud.
            </p>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex gap-2 px-4 pt-0 pb-3">
        <Button
          onClick={handleConfirm}
          disabled={isDisabled}
          className="flex-1"
        >
          {isConfirming ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Enabling...
            </>
          ) : isLoadingCloudCredits ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Checking credits...
            </>
          ) : hasCredits ? (
            <>
              <Cloud className="mr-2 h-4 w-4" />
              Enable Shipper Cloud and submit
            </>
          ) : (
            <>
              <CreditCard className="mr-2 h-4 w-4" />
              Add Cloud Credits
            </>
          )}
        </Button>
        <Button variant="secondary" onClick={handleDeny} disabled={isDisabled}>
          {isDenying ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <X className="mr-2 h-4 w-4" />
              Skip
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

/**
 * Shown after deployment is approved and being processed
 */
export function ShipperCloudDeploying({
  projectName,
}: {
  projectName: string;
}) {
  return (
    <Card className="border-primary/20 from-primary/5 to-primary/10 border-2 bg-gradient-to-br">
      <CardContent className="flex items-center gap-4">
        <div className="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-full">
          <Loader2 className="text-primary h-6 w-6 animate-spin" />
        </div>
        <div>
          <p className="font-medium">Deploying to Shipper Cloud</p>
          <p className="text-muted-foreground text-sm">
            Setting up backend for {projectName}...
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Shown after deployment succeeds
 */
export function ShipperCloudSuccess({
  projectName,
  deploymentUrl,
}: {
  projectName: string;
  deploymentUrl?: string;
}) {
  return (
    <Card className="border-2 border-green-500/20 bg-gradient-to-br from-green-500/5 to-green-500/10">
      <CardContent className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
          <Check className="h-6 w-6 text-green-500" />
        </div>
        <div>
          <p className="font-medium text-green-700 dark:text-green-400">
            Shipper Cloud Deployed!
          </p>
          <p className="text-muted-foreground text-sm">
            {projectName} backend is ready
          </p>
          {deploymentUrl && (
            <p className="text-muted-foreground mt-1 font-mono text-xs">
              {deploymentUrl}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Shown when user denies the deployment
 */
export function ShipperCloudDenied() {
  return (
    <Card className="border-muted bg-muted/30 border">
      <CardContent className="flex items-center gap-4 py-4">
        <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-full">
          <X className="text-muted-foreground h-5 w-5" />
        </div>
        <div>
          <p className="text-muted-foreground text-sm">
            Shipper Cloud deployment cancelled
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Approval constants for HITL - must match backend
 * @see apps/api/src/services/shipper-cloud-hitl.ts
 */
export const SHIPPER_CLOUD_APPROVAL = {
  YES: "Yes, deploy to Shipper Cloud",
  NO: "No, cancel deployment",
} as const;

/**
 * Tool name constant for identifying Shipper Cloud tool invocations
 */
export const SHIPPER_CLOUD_TOOL_NAME = "deployToShipperCloud";
