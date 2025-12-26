"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Cloud, Plus, History, Loader2, RefreshCw, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";

/**
 * Cloud Credit packages available for purchase
 * 1 credit = 1 cent ($0.01)
 * Kept simple for easy understanding
 */
const CLOUD_CREDIT_PACKAGES = [
  { credits: 500, price: 5, label: "$5", popular: false },
  { credits: 1000, price: 10, label: "$10", popular: true },
  { credits: 2500, price: 25, label: "$25", popular: false },
  { credits: 5000, price: 50, label: "$50", popular: false },
  { credits: 10000, price: 100, label: "$100", popular: false },
] as const;

interface CloudCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Cloud Credits Modal - OpenRouter-inspired simple billing UI
 *
 * Features:
 * - Current Cloud credit balance display
 * - Quick top-up buttons (Stripe checkout)
 * - Transaction history (top-ups only)
 */
export function CloudCreditsModal({ isOpen, onClose }: CloudCreditsModalProps) {
  const { data: session } = useSession();
  const trpc = useTRPC();
  const [loadingPackage, setLoadingPackage] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "usage">("overview");

  // Fetch Cloud credit balance and history
  const { data: cloudCreditsData, isLoading, refetch } = useQuery({
    ...trpc.credits.getCloudCredits.queryOptions(),
    enabled: isOpen,
    refetchOnWindowFocus: false,
  });

  // Fetch per-project usage
  const { data: projectUsageData, isLoading: isLoadingUsage } = useQuery({
    ...trpc.credits.getCloudCreditsPerProject.queryOptions(),
    enabled: isOpen && activeTab === "usage",
    refetchOnWindowFocus: false,
  });

  const balance = cloudCreditsData?.balance ?? 0;
  const purchases = cloudCreditsData?.purchases ?? [];

  // Convert credits to dollars for display
  const balanceInDollars = (balance / 100).toFixed(2);

  const handlePurchase = async (packageIndex: number) => {
    if (!session) {
      alert("Please sign in to purchase Cloud credits");
      return;
    }

    const pkg = CLOUD_CREDIT_PACKAGES[packageIndex];
    if (!pkg) return;

    setLoadingPackage(packageIndex);

    try {
      const response = await fetch("/api/stripe/buy-cloud-credits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          credits: pkg.credits,
          returnUrl: window.location.href,
        }),
      });

      const result = await response.json();

      if (response.ok && result.url) {
        window.location.href = result.url;
      } else {
        alert(`Error: ${result.error || "Failed to create checkout session"}`);
      }
    } catch (error) {
      console.error("Purchase error:", error);
      alert("Failed to initiate purchase. Please try again.");
    } finally {
      setLoadingPackage(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose} modal={true}>
      <DialogContent
        className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Header */}
        <DialogHeader className="pb-4 border-b">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Cloud className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold">
                Shipper Cloud Credits
              </DialogTitle>
              <DialogDescription className="text-sm">
                For databases, AI, storage in your deployed apps
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Tab Navigation */}
        <div className="flex gap-1 border-b pb-2">
          <Button
            variant={activeTab === "overview" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("overview")}
            className="flex-1"
          >
            <Cloud className="w-4 h-4 mr-1" />
            Overview
          </Button>
          <Button
            variant={activeTab === "usage" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("usage")}
            className="flex-1"
          >
            <BarChart3 className="w-4 h-4 mr-1" />
            Usage by Project
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto space-y-6 py-4">
          {activeTab === "overview" ? (
            <>
              {/* Balance Section */}
              <div className="text-center p-6 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20">
                <div className="text-sm text-muted-foreground mb-1">
                  Current Balance
                </div>
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-muted-foreground">Loading...</span>
                  </div>
                ) : (
                  <>
                    <div className="text-4xl font-bold text-primary">
                      ${balanceInDollars}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {balance.toLocaleString()} credits
                    </div>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={() => refetch()}
                  disabled={isLoading}
                >
                  <RefreshCw className={cn("w-3 h-3 mr-1", isLoading && "animate-spin")} />
                  Refresh
                </Button>
              </div>

              {/* Top-up Section */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Plus className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Add Credits</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CLOUD_CREDIT_PACKAGES.map((pkg, index) => (
                    <Button
                      key={index}
                      variant={pkg.popular ? "default" : "outline"}
                      className={cn(
                        "h-auto py-3 flex flex-col items-center gap-1",
                        pkg.popular && "ring-2 ring-primary ring-offset-2"
                      )}
                      onClick={() => handlePurchase(index)}
                      disabled={loadingPackage !== null}
                    >
                      {loadingPackage === index ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <span className="font-bold">{pkg.label}</span>
                          <span className="text-xs opacity-70">
                            {pkg.credits.toLocaleString()} credits
                          </span>
                        </>
                      )}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  1 credit = 1 cent • Secure payment via Stripe
                </p>
              </div>

              {/* History Section */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <History className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Top-up History</span>
                </div>
                {isLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    <span className="text-sm text-muted-foreground">Loading history...</span>
                  </div>
                ) : purchases.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm border rounded-lg">
                    No top-ups yet. Add credits to get started!
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {purchases.map((purchase) => (
                      <div
                        key={purchase.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card"
                      >
                        <div>
                          <div className="font-medium text-sm">
                            +{purchase.credits.toLocaleString()} credits
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(purchase.createdAt), {
                              addSuffix: true,
                            })}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-sm text-green-600">
                            ${(purchase.amountCents / 100).toFixed(2)}
                          </div>
                          <div
                            className={cn(
                              "text-xs",
                              purchase.status === "COMPLETED"
                                ? "text-green-600"
                                : purchase.status === "PENDING"
                                ? "text-yellow-600"
                                : "text-red-600"
                            )}
                          >
                            {purchase.status.toLowerCase()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Usage by Project Tab */
            <div className="space-y-4">
              {/* Billing Period Info */}
              {projectUsageData?.billingPeriod && (
                <div className="text-center text-sm text-muted-foreground">
                  Current billing period: {format(new Date(projectUsageData.billingPeriod.start), "MMM d")} - {format(new Date(projectUsageData.billingPeriod.end), "MMM d, yyyy")}
                </div>
              )}

              {/* Total Usage Summary */}
              <div className="text-center p-4 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20">
                <div className="text-sm text-muted-foreground mb-1">
                  Total Usage This Period
                </div>
                {isLoadingUsage ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-muted-foreground">Loading...</span>
                  </div>
                ) : (
                  <>
                    <div className="text-3xl font-bold text-primary">
                      ${((projectUsageData?.totalCredits ?? 0) / 100).toFixed(2)}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {(projectUsageData?.totalCredits ?? 0).toLocaleString()} credits used
                    </div>
                  </>
                )}
              </div>

              {/* Per-Project Breakdown */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Usage by Project</span>
                </div>
                {isLoadingUsage ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    <span className="text-sm text-muted-foreground">Loading project usage...</span>
                  </div>
                ) : !projectUsageData?.projects || projectUsageData.projects.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm border rounded-lg">
                    No Shipper Cloud usage this period.
                    <br />
                    <span className="text-xs">Enable Shipper Cloud on a project to track usage.</span>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {projectUsageData.projects.map((project) => (
                      <div
                        key={project.projectId}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {project.projectName}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {project.credits.toLocaleString()} credits
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <div className="font-medium text-sm">
                            ${(project.credits / 100).toFixed(2)}
                          </div>
                          {projectUsageData.totalCredits > 0 && (
                            <div className="text-xs text-muted-foreground">
                              {((project.credits / projectUsageData.totalCredits) * 100).toFixed(0)}%
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground text-center">
            Cloud credits are used for deployed app resources (databases, storage, AI).
            <br />
            Separate from Builder credits used for app development.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CloudCreditsModal;
