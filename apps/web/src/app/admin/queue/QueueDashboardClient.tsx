"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  RefreshCw,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  Zap,
  Calendar,
} from "lucide-react";
import Link from "next/link";

export default function QueueDashboardClient() {
  const trpc = useTRPC();

  // Fetch BullMQ queue stats from billing service
  const { data: queueStats, isLoading: queueLoading, refetch: refetchQueue } = useQuery(
    trpc.admin.getQueueStats.queryOptions()
  );

  // Fetch cloud credit activity
  const { data: cloudData, isLoading: cloudLoading, refetch: refetchCloud } = useQuery(
    trpc.admin.getCloudCreditActivity.queryOptions({
      limit: 50,
      offset: 0,
    })
  );

  const handleRefresh = () => {
    refetchQueue();
    refetchCloud();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case "TOP_UP":
        return "bg-green-100 text-green-800";
      case "USAGE":
        return "bg-blue-100 text-blue-800";
      case "BONUS":
        return "bg-purple-100 text-purple-800";
      case "REFUND":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const meterEvents = queueStats?.meterEvents;
  const scheduledJobs = queueStats?.scheduledJobs;

  return (
    <div className="mx-auto max-w-7xl p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/dashboard">
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Queue Dashboard</h1>
              <p className="text-gray-600">
                Monitor BullMQ queues for Stripe meter events and scheduled jobs
              </p>
            </div>
          </div>
          <Button onClick={handleRefresh} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Connection Status */}
      {queueStats && !queueStats.success && (
        <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            <span className="font-semibold">Billing Service Unavailable</span>
          </div>
          <p className="mt-1 text-sm">
            {queueStats.error || "Could not connect to billing service"}
          </p>
          <p className="mt-1 text-xs text-red-600">
            URL: {queueStats.billingServiceUrl}
          </p>
        </div>
      )}

      {/* Queue Stats Overview */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
        {/* Meter Events Queue */}
        <div className="col-span-2 rounded-lg bg-blue-50 p-4 md:col-span-4 lg:col-span-3">
          <div className="mb-3 flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-blue-800">Stripe Meter Events Queue</h3>
          </div>
          {queueLoading ? (
            <div className="flex items-center gap-2 text-blue-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          ) : meterEvents ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
              <div>
                <div className="text-2xl font-bold text-orange-600">{meterEvents.waiting}</div>
                <div className="flex items-center gap-1 text-xs text-gray-600">
                  <Clock className="h-3 w-3" />
                  Waiting
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">{meterEvents.active}</div>
                <div className="flex items-center gap-1 text-xs text-gray-600">
                  <Loader2 className="h-3 w-3" />
                  Active
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{meterEvents.completed}</div>
                <div className="flex items-center gap-1 text-xs text-gray-600">
                  <CheckCircle className="h-3 w-3" />
                  Completed
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">{meterEvents.failed}</div>
                <div className="flex items-center gap-1 text-xs text-gray-600">
                  <XCircle className="h-3 w-3" />
                  Failed
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">{meterEvents.delayed}</div>
                <div className="flex items-center gap-1 text-xs text-gray-600">
                  <Clock className="h-3 w-3" />
                  Delayed
                </div>
              </div>
            </div>
          ) : (
            <div className="text-gray-500">No data available</div>
          )}
          {meterEvents && (
            <div className="mt-3 flex items-center gap-4 border-t pt-3 text-sm text-gray-600">
              <span>
                Mode: <strong className={meterEvents.mode === "live" ? "text-green-600" : "text-orange-600"}>
                  {meterEvents.mode?.toUpperCase()}
                </strong>
              </span>
              <span>
                Rate Limit: <strong>{meterEvents.rateLimit}/sec</strong>
              </span>
            </div>
          )}
        </div>

        {/* Scheduled Jobs Queue */}
        <div className="col-span-2 rounded-lg bg-purple-50 p-4 lg:col-span-3">
          <div className="mb-3 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-purple-600" />
            <h3 className="font-semibold text-purple-800">Scheduled Jobs Queue</h3>
          </div>
          {queueLoading ? (
            <div className="flex items-center gap-2 text-purple-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          ) : scheduledJobs ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <div>
                <div className="text-2xl font-bold text-orange-600">{scheduledJobs.waiting}</div>
                <div className="flex items-center gap-1 text-xs text-gray-600">
                  <Clock className="h-3 w-3" />
                  Waiting
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">{scheduledJobs.active}</div>
                <div className="flex items-center gap-1 text-xs text-gray-600">
                  <Loader2 className="h-3 w-3" />
                  Active
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{scheduledJobs.completed}</div>
                <div className="flex items-center gap-1 text-xs text-gray-600">
                  <CheckCircle className="h-3 w-3" />
                  Completed
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">{scheduledJobs.failed}</div>
                <div className="flex items-center gap-1 text-xs text-gray-600">
                  <XCircle className="h-3 w-3" />
                  Failed
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">{scheduledJobs.delayed}</div>
                <div className="flex items-center gap-1 text-xs text-gray-600">
                  <Clock className="h-3 w-3" />
                  Delayed
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-indigo-600">{scheduledJobs.repeatableJobs}</div>
                <div className="flex items-center gap-1 text-xs text-gray-600">
                  <Activity className="h-3 w-3" />
                  Cron Jobs
                </div>
              </div>
            </div>
          ) : (
            <div className="text-gray-500">No data available</div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="cloud" className="space-y-4">
        <TabsList>
          <TabsTrigger value="cloud">Cloud Credits Activity</TabsTrigger>
          <TabsTrigger value="info">Queue Info</TabsTrigger>
        </TabsList>

        {/* Cloud Credits Tab */}
        <TabsContent value="cloud" className="space-y-4">
          <h3 className="text-lg font-semibold">Shipper Cloud Credit Activity</h3>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Cloud Credit Transactions */}
            <div className="rounded-lg bg-white shadow">
              <div className="border-b px-4 py-3">
                <h4 className="font-medium">Cloud Credit Transactions</h4>
                <p className="text-sm text-gray-500">
                  {cloudData?.pagination.total || 0} total transactions
                </p>
              </div>
              {cloudLoading ? (
                <div className="p-8 text-center">
                  <div className="mx-auto h-6 w-6 animate-spin rounded-full border-b-2 border-blue-500" />
                </div>
              ) : (
                <div className="max-h-[400px] divide-y overflow-y-auto">
                  {cloudData?.transactions.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      No cloud credit transactions
                    </div>
                  ) : (
                    cloudData?.transactions.map((tx) => (
                      <div key={tx.id} className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{tx.userName || "Unknown"}</div>
                            <div className="text-sm text-gray-500">{tx.userEmail}</div>
                          </div>
                          <span
                            className={
                              tx.amount > 0
                                ? "font-semibold text-green-600"
                                : "font-semibold text-red-600"
                            }
                          >
                            {tx.amount > 0 ? "+" : ""}
                            {tx.amount} credits
                          </span>
                        </div>
                        <div className="mt-1 text-sm text-gray-600">{tx.description}</div>
                        <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                          <span
                            className={`rounded-full px-2 py-1 ${getEventTypeColor(tx.type)}`}
                          >
                            {tx.type}
                          </span>
                          <span>{formatDate(tx.createdAt)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Cloud Credit Purchases */}
            <div className="rounded-lg bg-white shadow">
              <div className="border-b px-4 py-3">
                <h4 className="font-medium">Cloud Credit Purchases</h4>
                <p className="text-sm text-gray-500">
                  {cloudData?.pagination.totalPurchases || 0} total purchases
                </p>
              </div>
              {cloudLoading ? (
                <div className="p-8 text-center">
                  <div className="mx-auto h-6 w-6 animate-spin rounded-full border-b-2 border-blue-500" />
                </div>
              ) : (
                <div className="max-h-[400px] divide-y overflow-y-auto">
                  {cloudData?.purchases.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      No cloud credit purchases
                    </div>
                  ) : (
                    cloudData?.purchases.map((purchase) => (
                      <div key={purchase.id} className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{purchase.userName || "Unknown"}</div>
                            <div className="text-sm text-gray-500">{purchase.userEmail}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-green-600">
                              +{purchase.credits} credits
                            </div>
                            <div className="text-sm text-gray-500">
                              ${((purchase.amountCents || 0) / 100).toFixed(2)}
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                          <span
                            className={`rounded-full px-2 py-1 ${
                              purchase.status === "COMPLETED"
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {purchase.status}
                          </span>
                          <span>{formatDate(purchase.createdAt)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Queue Info Tab */}
        <TabsContent value="info" className="space-y-4">
          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="mb-4 text-lg font-semibold">Queue Configuration</h3>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h4 className="mb-2 font-medium text-blue-800">Stripe Meter Events Queue</h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li><strong>Queue Name:</strong> stripe-meter-events</li>
                  <li><strong>Purpose:</strong> Rate-limited Stripe billing meter events</li>
                  <li><strong>Rate Limit (Live):</strong> 1000 events/second</li>
                  <li><strong>Rate Limit (Test):</strong> 10 events/second</li>
                  <li><strong>Retry Strategy:</strong> Exponential backoff (1s, 2s, 4s, 8s, 16s)</li>
                  <li><strong>Max Attempts:</strong> 5</li>
                  <li><strong>Completed Job Retention:</strong> 1 hour or 1000 jobs</li>
                  <li><strong>Failed Job Retention:</strong> 24 hours</li>
                </ul>
              </div>

              <div>
                <h4 className="mb-2 font-medium text-purple-800">Scheduled Jobs Queue</h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li><strong>Queue Name:</strong> billing-scheduled-jobs</li>
                  <li><strong>Purpose:</strong> Cron jobs for auto top-up and billing tasks</li>
                  <li><strong>Auto Top-Up Schedule:</strong> Every 5 minutes</li>
                  <li><strong>Retry Strategy:</strong> Exponential backoff (5s start)</li>
                  <li><strong>Max Attempts:</strong> 3</li>
                  <li><strong>Completed Job Retention:</strong> 24 hours or 100 jobs</li>
                  <li><strong>Failed Job Retention:</strong> 7 days</li>
                  <li><strong>Concurrency:</strong> 1 (sequential processing)</li>
                </ul>
              </div>
            </div>

            <div className="mt-6 border-t pt-4">
              <h4 className="mb-2 font-medium">Billing Service Connection</h4>
              <p className="text-sm text-gray-600">
                <strong>URL:</strong> {queueStats?.billingServiceUrl || "http://localhost:4004"}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Status:</strong>{" "}
                {queueStats?.success ? (
                  <span className="text-green-600">Connected</span>
                ) : (
                  <span className="text-red-600">Disconnected</span>
                )}
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
