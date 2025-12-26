"use client";

import { Loader2, Activity, Database, HardDrive, Zap, Cloud } from "lucide-react";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface ShipperCloudBillingTabProps {
  projectId: string;
}

interface MeterRowProps {
  label: string;
  icon: React.ReactNode;
  usage: string;
  credits: string;
  usd: string;
  rate: string;
}

function MeterRow({ label, icon, usage, credits, usd, rate }: MeterRowProps) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-[#F3F3EE] p-4 dark:bg-[#1A2421]">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white dark:bg-[#0F1613]">
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium text-[#141414] dark:text-[#F5F9F7]">
            {label}
          </p>
          <p className="text-xs text-[#727272] dark:text-[#8A9A94]">{rate}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium text-[#141414] dark:text-[#F5F9F7]">
          {usage}
        </p>
        <p className="text-xs text-[#727272] dark:text-[#8A9A94]">
          {usd} ({credits})
        </p>
      </div>
    </div>
  );
}

interface StorageRowProps {
  label: string;
  value: string;
}

function StorageRow({ label, value }: StorageRowProps) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-[#727272] dark:text-[#8A9A94]">{label}</span>
      <span className="text-sm font-medium text-[#141414] dark:text-[#F5F9F7]">
        {value}
      </span>
    </div>
  );
}

export function ShipperCloudBillingTab({ projectId }: ShipperCloudBillingTabProps) {
  const trpc = useTRPC();

  const { data, isLoading, error } = useQuery({
    ...trpc.projects.getShipperCloudBilling.queryOptions({ projectId }),
    enabled: !!projectId,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[#1E9A80]" />
        <p className="text-sm text-[#727272] dark:text-[#B8C9C3]">
          Loading billing information...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <Cloud className="h-12 w-12 text-red-500" />
        <p className="text-sm text-[#727272] dark:text-[#B8C9C3]">
          Failed to load billing information
        </p>
      </div>
    );
  }

  if (!data?.hasShipperCloud || !data.billing) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <Cloud className="h-12 w-12 text-[#8A9A94]" />
        <div className="text-center">
          <h3 className="mb-1 text-sm font-semibold text-[#141414] dark:text-[#F5F9F7]">
            Shipper Cloud Not Enabled
          </h3>
          <p className="text-sm text-[#727272] dark:text-[#B8C9C3]">
            Enable Shipper Cloud to see billing information
          </p>
        </div>
      </div>
    );
  }

  const { billing } = data;
  const { breakdown, storage, totalCreditsUsed } = billing;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      {/* Total Credits Summary */}
      <div className="rounded-2xl bg-gradient-to-br from-[#1E9A80]/10 to-[#1E9A80]/5 p-6 dark:from-[#1E9A80]/20 dark:to-[#1E9A80]/10">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-[#727272] dark:text-[#8A9A94]">
              Current Period Usage
            </p>
            <p className="mt-1 text-3xl font-bold text-[#141414] dark:text-[#F5F9F7]">
              {totalCreditsUsed.usd}
            </p>
            <p className="text-sm text-[#727272] dark:text-[#8A9A94]">
              {totalCreditsUsed.display}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-[#727272] dark:text-[#8A9A94]">
              Billing Period
            </p>
            <p className="mt-1 text-sm font-medium text-[#141414] dark:text-[#F5F9F7]">
              {formatDate(billing.periodStart)} - {formatDate(billing.periodEnd)}
            </p>
            {billing.lastUsageAt && (
              <p className="mt-1 text-xs text-[#727272] dark:text-[#8A9A94]">
                Last activity: {formatDate(billing.lastUsageAt)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Usage Breakdown */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-[#141414] dark:text-[#F5F9F7]">
          Usage Breakdown
        </h3>
        <div className="space-y-2">
          <MeterRow
            label="Function Calls"
            icon={<Zap className="h-4 w-4 text-[#1E9A80]" />}
            usage={breakdown.functionCalls.usageFormatted}
            credits={breakdown.functionCalls.credits.display}
            usd={breakdown.functionCalls.credits.usd}
            rate={breakdown.functionCalls.rate}
          />
          <MeterRow
            label="Action Compute"
            icon={<Activity className="h-4 w-4 text-[#1E9A80]" />}
            usage={breakdown.actionCompute.usageFormatted}
            credits={breakdown.actionCompute.credits.display}
            usd={breakdown.actionCompute.credits.usd}
            rate={breakdown.actionCompute.rate}
          />
          <MeterRow
            label="Database Bandwidth"
            icon={<Database className="h-4 w-4 text-[#1E9A80]" />}
            usage={breakdown.databaseBandwidth.usageFormatted}
            credits={breakdown.databaseBandwidth.credits.display}
            usd={breakdown.databaseBandwidth.credits.usd}
            rate={breakdown.databaseBandwidth.rate}
          />
          <MeterRow
            label="File Bandwidth"
            icon={<HardDrive className="h-4 w-4 text-[#1E9A80]" />}
            usage={breakdown.fileBandwidth.usageFormatted}
            credits={breakdown.fileBandwidth.credits.display}
            usd={breakdown.fileBandwidth.credits.usd}
            rate={breakdown.fileBandwidth.rate}
          />
          <MeterRow
            label="Vector Bandwidth"
            icon={<Cloud className="h-4 w-4 text-[#1E9A80]" />}
            usage={breakdown.vectorBandwidth.usageFormatted}
            credits={breakdown.vectorBandwidth.credits.display}
            usd={breakdown.vectorBandwidth.credits.usd}
            rate={breakdown.vectorBandwidth.rate}
          />
        </div>
      </div>

      {/* Storage Snapshot */}
      <div className="rounded-2xl bg-[#F3F3EE] p-4 dark:bg-[#1A2421]">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#141414] dark:text-[#F5F9F7]">
            Storage Snapshot
          </h3>
          {storage.lastUpdated && (
            <span className="text-xs text-[#727272] dark:text-[#8A9A94]">
              Last updated: {formatDate(storage.lastUpdated)}
            </span>
          )}
        </div>
        <div className="divide-y divide-[#E7E5E4] dark:divide-[#26263D]">
          <StorageRow label="Document Storage" value={storage.document.formatted} />
          <StorageRow label="Index Storage" value={storage.index.formatted} />
          <StorageRow label="File Storage" value={storage.file.formatted} />
          <StorageRow label="Vector Storage" value={storage.vector.formatted} />
          <StorageRow label="Backup Storage" value={storage.backup.formatted} />
        </div>
      </div>

      {/* Pricing Note */}
      <p className="text-center text-xs text-[#727272] dark:text-[#8A9A94]">
        1 credit = $0.01 USD. Usage is calculated in real-time and billed at the end of
        each billing period.
      </p>
    </div>
  );
}
