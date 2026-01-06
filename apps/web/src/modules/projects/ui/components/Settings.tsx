"use client";

import { useState, useMemo, useCallback } from "react";
import { useAtom } from "jotai";
import {
  Loader2,
  Database,
  AlertCircle,
  RocketIcon,
  ChevronDown as ChevronDownIcon,
  ChevronRight as ChevronRightIcon,
  Cloud,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { TableViewer } from "./TableViewer";
import { ConvexDashboardTabs } from "./ConvexDashboardTabs";
import { ConvexUserViewer } from "./ConvexUserViewer";
import { DatabaseIcon } from "@/components/icons/DatabaseIcon";
import { DeploymentSettingsTab } from "./DeploymentSettingsTab";
import { DomainSettingsTab } from "./DomainSettingsTab";
import { ShipperCloudBillingTab } from "./ShipperCloudBillingTab";
import { useSandboxStateV3 } from "@/hooks/useSandboxStateV3";
import { activeSettingsTabAtom, type SettingsTab } from "@/lib/atoms/settings";
import {
  CodeBlock,
  CodeBlockCopyButton,
} from "@/components/ai-elements/code-block";

interface SettingsProps {
  onClose?: () => void;
}

export function Settings({ onClose }: SettingsProps) {
  const params = useParams();
  const projectId = params?.projectId as string;
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [selectedCategory, setSelectedCategory] = useAtom(activeSettingsTabAtom);
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentResult, setDeploymentResult] = useState<{
    success: boolean;
    deploymentUrl?: string;
    error?: string;
    logs?: string;
    buildFailed?: boolean;
  } | null>(null);
  const [isDeploymentOpen, setIsDeploymentOpen] = useState(true);

  // Get sandbox state for sandboxReady
  const sandbox = useSandboxStateV3({
    projectId,
  });

  // Get project data for deployment info
  const { data: projectData } = useQuery({
    ...trpc.projects.getOne.queryOptions({ projectId }),
    enabled: !!projectId,
  });

  // Deployment mutation
  const deployAppMutation = useMutation(
    trpc.projects.deployApp.mutationOptions({
      onMutate: () => {
        setIsDeploying(true);
        setDeploymentResult(null);
      },
      onSuccess: (result: any) => {
        console.log("[Settings] Deployment result:", result);
        if (result.success) {
          setDeploymentResult({
            success: true,
            deploymentUrl: result.deploymentUrl,
            logs: result.logs,
          });
          // Update project cache to reflect deployed state
          queryClient.setQueryData(
            trpc.projects.getOne.queryKey({ projectId }),
            (old: any) => {
              if (!old) return old;
              return {
                ...old,
                deploymentUrl: result.deploymentUrl,
                deployedAt: new Date().toISOString(),
              };
            },
          );
          queryClient.invalidateQueries({
            queryKey: trpc.projects.getOne.queryKey({ projectId }),
          });
        } else {
          setDeploymentResult({
            success: false,
            error: result.error || "Deployment failed",
            logs: result.logs,
            buildFailed: result.buildFailed,
          });
        }
        setIsDeploying(false);
      },
      onError: (error: any) => {
        console.error("[Settings] Deployment error:", error);
        setDeploymentResult({
          success: false,
          error: error.message || "Failed to deploy app",
        });
        setIsDeploying(false);
      },
    }),
  );

  // Handle deployment
  const handleDeploy = useCallback(
    (subdomain?: string) => {
      if (!projectId) return;
      console.log("[Settings] handleDeploy called with subdomain:", subdomain);
      deployAppMutation.mutate({
        projectId,
        subdomain,
        appName: projectData?.name || undefined,
      });
    },
    [projectId, projectData?.name, deployAppMutation],
  );

  // Compute deployment state
  const deploymentUrl = projectData?.deploymentUrl || undefined;
  const deployedAt = projectData?.deployedAt
    ? new Date(projectData.deployedAt)
    : undefined;
  const isDeployed = !!deploymentUrl;

  // Check if update is needed (simplified - could check git commit hash in real implementation)
  const needsUpdate = false; // Could be computed based on gitCommitHash comparison

  // Compute sandboxReady
  const sandboxReady = useMemo(
    () => Boolean(sandbox.sandboxUrl && sandbox.isHealthy),
    [sandbox.sandboxUrl, sandbox.isHealthy],
  );

  // Fetch database info
  const {
    data: dbInfo,
    isLoading: isLoadingInfo,
    error: infoError,
  } = useQuery({
    ...trpc.projects.getTursoDatabaseInfo.queryOptions({ projectId }),
    enabled: !!projectId,
  });

  // Fetch database usage/activity
  const { data: dbUsage, isLoading: isLoadingUsage } = useQuery({
    ...trpc.projects.getTursoDatabaseUsage.queryOptions({ projectId }),
    enabled: !!projectId && dbInfo?.hasDatabase === true,
  });

  // Fetch database tables list (metadata only)
  const {
    data: dbTables,
    isLoading: isLoadingTables,
    error: tablesError,
  } = useQuery({
    ...trpc.projects.getTursoDatabaseTablesList.queryOptions({ projectId }),
    enabled: !!projectId && dbInfo?.hasDatabase === true,
  });

  // Fetch Convex deployment info
  const { data: convexInfo } = useQuery({
    ...trpc.projects.getConvexDeploymentInfo.queryOptions({ projectId }),
    enabled: !!projectId,
  });

  // Fetch Convex dashboard credentials (only when any Convex tab is selected)
  const isConvexTabSelected = selectedCategory.startsWith("convex-");
  const {
    data: convexDashboardCredentials,
    isLoading: isLoadingDashboardCredentials,
  } = useQuery({
    ...trpc.projects.getConvexDashboardCredentials.queryOptions({ projectId }),
    enabled:
      !!projectId &&
      convexInfo?.hasConvex === true &&
      isConvexTabSelected,
  });

  const toggleTable = (tableName: string) => {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(tableName)) {
        next.delete(tableName);
      } else {
        next.add(tableName);
      }
      return next;
    });
  };

  const handleTabChange = (value: string) => {
    const validCategories: SettingsTab[] = [
      "overview",
      "database",
      "domains",
      "convex-data",
      "convex-files",
      "convex-functions",
      "convex-logs",
      "convex-health",
      "convex-env",
      "convex-auth",
      "shipper-cloud-billing",
    ];
    if (validCategories.includes(value as SettingsTab)) {
      setSelectedCategory(value as SettingsTab);
    }
  };

  // Build dynamic categories based on what's available
  const categories = useMemo(() => {
    const cats: { id: SettingsTab; label: string }[] = [
      { id: "overview", label: "Overview" },
    ];

    // Add Convex tabs if Convex is enabled (and hide database tab)
    if (convexInfo?.hasConvex) {
      cats.push({ id: "convex-data", label: "Data" });
      cats.push({ id: "convex-files", label: "Files" });
      cats.push({ id: "convex-functions", label: "Functions" });
      cats.push({ id: "convex-logs", label: "Logs" });
      cats.push({ id: "convex-health", label: "Health" });
      cats.push({ id: "convex-env", label: "Environment" });
      cats.push({ id: "convex-auth", label: "Users" });
      cats.push({ id: "shipper-cloud-billing", label: "Billing" });
    } else if (dbInfo?.hasDatabase) {
      // Only add database tab if NOT using Convex
      cats.push({ id: "database", label: "Database" });
    }

    // Always add Domains tab (available for all projects)
    cats.push({ id: "domains", label: "Domains" });

    return cats;
  }, [dbInfo?.hasDatabase, convexInfo?.hasConvex]);

  // Helper function to format bytes to KB
  const formatBytes = (bytes: number) => {
    return (bytes / 1024).toFixed(2);
  };

  return (
    <div className="flex flex-col gap-4 px-4 pt-4 pb-6">
      <div className="flex items-start justify-center gap-8">
        {/* Vertical Tabs Sidebar */}
        <div className="flex w-[131px] flex-col gap-6 pt-1">
          <Tabs
            value={selectedCategory}
            onValueChange={handleTabChange}
            orientation="vertical"
            className="w-full"
          >
            <TabsList className="flex h-fit w-full flex-col gap-2 bg-transparent p-0">
              {categories.map((category) => (
                <TabsTrigger
                  key={category.id}
                  value={category.id}
                  className={cn(
                    "flex w-full items-center justify-start gap-2 rounded-lg px-3 py-2 transition-colors",
                    "data-[state=active]:bg-[#F3F3EE] data-[state=active]:text-sm data-[state=active]:font-medium data-[state=active]:text-[#0D9488] dark:data-[state=active]:bg-[#1A2421] dark:data-[state=active]:text-[#1E9A80]",
                    "text-sm font-normal text-[#717784] hover:bg-[#F5F5F0] data-[state=active]:shadow-none dark:text-[#B8C9C3] dark:hover:bg-[#1A2421]",
                  )}
                >
                  <div className="flex-1 text-left">{category.label}</div>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* Main Content */}
        <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-[#E7E5E4] shadow-[0px_1px_1.5px_0px_rgba(20,20,20,0.07)] dark:border-[#26263D]">
          {/* Header */}
          <div className="flex h-20 items-center justify-between overflow-hidden border-b border-[#E7E5E4] bg-white pl-4 dark:border-[#26263D] dark:bg-[#1a2421]">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <h1 className="text-lg leading-5 font-semibold text-[#141414] dark:text-[#F5F9F7]">
                  {selectedCategory === "overview" && "Overview"}
                  {selectedCategory === "database" && "Database Tables"}
                  {selectedCategory === "domains" && "Custom Domains"}
                  {selectedCategory === "convex-data" && "Convex Data"}
                  {selectedCategory === "convex-files" && "Convex Files"}
                  {selectedCategory === "convex-functions" && "Convex Functions"}
                  {selectedCategory === "convex-logs" && "Convex Logs"}
                  {selectedCategory === "convex-health" && "Convex Health"}
                  {selectedCategory === "convex-env" && "Environment Variables"}
                  {selectedCategory === "convex-auth" && "Users"}
                  {selectedCategory === "shipper-cloud-billing" && "Billing"}
                </h1>
              </div>
              <p className="text-sm leading-5 text-[#727272] dark:text-[#B8C9C3]">
                {selectedCategory === "database" &&
                  "View and manage all Turso database tables"}
                {selectedCategory === "domains" &&
                  "Connect custom domains to your project"}
                {selectedCategory === "convex-data" &&
                  "Browse and manage your Convex data"}
                {selectedCategory === "convex-files" &&
                  "View stored files in Convex"}
                {selectedCategory === "convex-functions" &&
                  "Manage your Convex functions"}
                {selectedCategory === "convex-logs" &&
                  "View function execution logs"}
                {selectedCategory === "convex-health" &&
                  "Monitor deployment health and status"}
                {selectedCategory === "convex-env" &&
                  "Configure environment variables"}
                {selectedCategory === "convex-auth" &&
                  "View and manage authenticated users"}
                {selectedCategory === "shipper-cloud-billing" &&
                  "View usage and billing breakdown"}
              </p>
            </div>
            <div className="relative h-[144px] w-[144px] overflow-hidden">
              {/* Background image */}
              <Image
                src="/togglecontainer.png"
                alt="Database Tables"
                fill
                className="object-contain dark:hidden"
                priority
                unoptimized
              />

              {/* Dark mode image */}
              <Image
                src="/togglecontainerdark.png"
                alt="Database Tables"
                fill
                className="hidden object-contain dark:block"
                priority
                unoptimized
              />
              {/* Dynamic centered icon */}
              <div className="absolute inset-0 flex items-center justify-center">
                <DatabaseIcon category={selectedCategory} />
              </div>
            </div>
          </div>

          {/* Tables Content */}
          <div className="flex flex-col gap-4 overflow-auto p-4">
            {/* Database Info Loading/Error State */}
            {isLoadingInfo && (
              <div className="flex flex-col items-center justify-center gap-3 py-12">
                <Loader2 className="h-8 w-8 animate-spin text-[#1E9A80]" />
                <p className="text-sm text-[#727272] dark:text-[#B8C9C3]">
                  Loading database information...
                </p>
              </div>
            )}

            {/* Database Info Error State */}
            {infoError && !isLoadingInfo && (
              <div className="flex flex-col items-center justify-center gap-3 py-12">
                <AlertCircle className="h-8 w-8 text-red-500" />
                <p className="text-sm text-[#727272] dark:text-[#B8C9C3]">
                  Failed to load database information
                </p>
              </div>
            )}

            {/* No Database State - only show if NOT using Convex and no Turso database */}
            {!isLoadingInfo &&
              !infoError &&
              dbInfo &&
              !dbInfo.hasDatabase &&
              !convexInfo?.hasConvex && (
                <div className="flex flex-col items-center justify-center gap-4 py-12">
                  <Database className="h-12 w-12 text-[#8A9A94]" />
                  <div className="text-center">
                    <h3 className="mb-1 text-sm font-semibold text-[#141414] dark:text-[#F5F9F7]">
                      No Backend Connected
                    </h3>
                    <p className="text-sm text-[#727272] dark:text-[#B8C9C3]">
                      Enable Shipper Cloud to add authentication, database, and more
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      const chatInput = document.querySelector(
                        "[data-chat-input]",
                      ) as HTMLTextAreaElement;
                      if (chatInput) {
                        const message = "Enable Shipper Cloud for this project";
                        const nativeInputValueSetter =
                          Object.getOwnPropertyDescriptor(
                            window.HTMLTextAreaElement.prototype,
                            "value",
                          )?.set;
                        if (nativeInputValueSetter) {
                          nativeInputValueSetter.call(chatInput, message);
                        }
                        const inputEvent = new Event("input", { bubbles: true });
                        chatInput.dispatchEvent(inputEvent);
                        onClose?.();
                        chatInput.focus();
                        setTimeout(() => {
                          const form = chatInput.closest("form");
                          if (form) {
                            const submitButton = form.querySelector(
                              'button[type="submit"]',
                            );
                            if (submitButton instanceof HTMLButtonElement) {
                              submitButton.click();
                            }
                          }
                        }, 200);
                      }
                    }}
                  >
                    <Cloud className="mr-2 h-4 w-4" />
                    Enable Shipper Cloud
                  </Button>
                </div>
              )}

            {/* Content */}
            <Tabs
              value={selectedCategory}
              onValueChange={handleTabChange}
              className="w-full"
            >
              {/* Overview Tab - Activity Stats */}
              {(dbInfo?.hasDatabase || convexInfo?.hasConvex) && (
                <TabsContent value="overview" className="mt-0">
                  <Collapsible
                    open={isDeploymentOpen}
                    onOpenChange={setIsDeploymentOpen}
                  >
                    <div className="my-3 rounded-2xl bg-[#F3F3EE] px-2 dark:bg-[#0F1613]">
                      <CollapsibleTrigger asChild>
                        <button className="mb-2 flex w-full items-center justify-between rounded-xl px-2 py-3 text-left dark:bg-[#0F1613]">
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-[#141414] dark:text-[#F5F9F7]">
                              Project Settings
                            </span>
                            <span className="mt-1 text-xs text-[#727272] dark:text-[#B8C9C3]">
                              Make your project go live and track performance
                            </span>
                          </div>
                          {isDeploymentOpen ? (
                            <ChevronDownIcon className="h-4 w-4 text-[#727272] dark:text-[#8A9A94]" />
                          ) : (
                            <ChevronRightIcon className="h-4 w-4 text-[#727272] dark:text-[#8A9A94]" />
                          )}
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="p-2">
                        {/* Deployment Result Notification (moved from Deployment tab) */}
                        {deploymentResult && (
                          <div
                            className={`mb-4 rounded-lg border p-3 ${
                              deploymentResult.success
                                ? "bg-prj-bg-success border-prj-border-success text-prj-text-success"
                                : "bg-prj-bg-error border-prj-border-error text-prj-text-error"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                {deploymentResult.success ? (
                                  <RocketIcon className="mr-2 h-4 w-4" />
                                ) : (
                                  <span className="mr-2">⚠️</span>
                                )}
                                <span className="font-medium">
                                  {deploymentResult.success
                                    ? "Deployment Successful!"
                                    : "Deployment Failed"}
                                </span>
                              </div>
                              <button
                                onClick={() => setDeploymentResult(null)}
                                className="text-sm opacity-70 hover:opacity-100"
                              >
                                ✕
                              </button>
                            </div>
                            {deploymentResult.success &&
                              deploymentResult.deploymentUrl && (
                                <div className="mt-2">
                                  <a
                                    href={deploymentResult.deploymentUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm underline hover:no-underline"
                                  >
                                    View deployed app:{" "}
                                    {deploymentResult.deploymentUrl}
                                  </a>
                                </div>
                              )}
                            {!deploymentResult.success &&
                              deploymentResult.error && (
                                <>
                                  <div className="mt-2 text-sm">
                                    {deploymentResult.buildFailed &&
                                    deploymentResult.error.length > 200
                                      ? "Build failed with errors. See details below."
                                      : deploymentResult.error}
                                  </div>
                                  {deploymentResult.buildFailed &&
                                    deploymentResult.logs && (
                                      <div className="mt-3">
                                        <details
                                          className="text-xs"
                                          open={
                                            deploymentResult.error.length > 200
                                          }
                                        >
                                          <summary className="cursor-pointer hover:underline">
                                            {deploymentResult.error.length > 200
                                              ? "View build errors and logs"
                                              : "View build logs"}
                                          </summary>
                                          <div className="mt-2 max-h-60 overflow-y-auto">
                                            <CodeBlock
                                              code={deploymentResult.logs}
                                              language="bash"
                                              className="text-xs"
                                            >
                                              <CodeBlockCopyButton />
                                            </CodeBlock>
                                          </div>
                                        </details>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="mt-2 h-7 text-xs"
                                          onClick={() => {
                                            const chatInput =
                                              document.querySelector(
                                                "[data-chat-input]",
                                              ) as HTMLTextAreaElement;
                                            if (chatInput) {
                                              const errorMessage = `The deployment failed with build errors. Can you help fix these TypeScript errors?\n\n\`\`\`\n${deploymentResult.logs}\n\`\`\``;
                                              const nativeInputValueSetter =
                                                Object.getOwnPropertyDescriptor(
                                                  window.HTMLTextAreaElement
                                                    .prototype,
                                                  "value",
                                                )?.set;
                                              if (nativeInputValueSetter) {
                                                nativeInputValueSetter.call(
                                                  chatInput,
                                                  errorMessage,
                                                );
                                              }
                                              const inputEvent = new Event(
                                                "input",
                                                {
                                                  bubbles: true,
                                                },
                                              );
                                              chatInput.dispatchEvent(
                                                inputEvent,
                                              );
                                              setDeploymentResult(null);
                                              onClose?.();
                                              chatInput.focus();
                                              setTimeout(() => {
                                                const form =
                                                  chatInput.closest("form");
                                                if (form) {
                                                  const submitButton =
                                                    form.querySelector(
                                                      'button[type="submit"]',
                                                    );
                                                  if (
                                                    submitButton instanceof
                                                    HTMLButtonElement
                                                  ) {
                                                    submitButton.click();
                                                  }
                                                }
                                              }, 200);
                                            }
                                          }}
                                        >
                                          Send error to AI for help
                                        </Button>
                                      </div>
                                    )}
                                </>
                              )}
                          </div>
                        )}

                        <DeploymentSettingsTab
                          projectId={projectId}
                          deploymentUrl={deploymentUrl}
                          isDeploying={isDeploying}
                          isDeployed={isDeployed}
                          needsUpdate={needsUpdate}
                          onDeploy={handleDeploy}
                          sandboxReady={sandboxReady}
                          deployedAt={deployedAt}
                        />
                      </CollapsibleContent>
                    </div>
                  </Collapsible>

                  {/* Turso Database Usage - only show for Turso databases */}
                  {dbInfo?.hasDatabase && (
                    <>
                      {isLoadingUsage ? (
                        <div className="flex flex-col items-center justify-center gap-3 py-12">
                          <Loader2 className="h-8 w-8 animate-spin text-[#1E9A80]" />
                          <p className="text-sm text-[#727272] dark:text-[#B8C9C3]">
                            Loading database usage...
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* Activity Section */}
                          <div>
                            <h3 className="mb-3 px-2 text-sm font-semibold text-[#141414] dark:text-[#F5F9F7]">
                              Activity
                            </h3>
                            <div className="grid grid-cols-4 gap-4">
                              <div className="rounded-2xl bg-[#F3F3EE] p-4 dark:bg-[#1A2421]">
                                <p className="mb-1 text-xs text-[#727272] dark:text-[#8A9A94]">
                                  Rows Read
                                </p>
                                <p className="text-2xl font-semibold text-[#141414] dark:text-[#F5F9F7]">
                                  {dbUsage?.usage?.rows_read?.toLocaleString() ||
                                    "0"}
                                </p>
                              </div>
                              <div className="rounded-2xl bg-[#F3F3EE] p-4 dark:bg-[#1A2421]">
                                <p className="mb-1 text-xs text-[#727272] dark:text-[#8A9A94]">
                                  Rows Written
                                </p>
                                <p className="text-2xl font-semibold text-[#141414] dark:text-[#F5F9F7]">
                                  {dbUsage?.usage?.rows_written?.toLocaleString() ||
                                    "0"}
                                </p>
                              </div>
                              <div className="rounded-2xl bg-[#F3F3EE] p-4 dark:bg-[#1A2421]">
                                <p className="mb-1 text-xs text-[#727272] dark:text-[#8A9A94]">
                                  Storage
                                </p>
                                <p className="text-2xl font-semibold text-[#141414] dark:text-[#F5F9F7]">
                                  {dbUsage?.usage?.storage_bytes
                                    ? formatBytes(dbUsage.usage.storage_bytes)
                                    : "0.00"}{" "}
                                  KB
                                </p>
                              </div>
                              <div className="rounded-2xl bg-[#F3F3EE] p-4 dark:bg-[#1A2421]">
                                <p className="mb-1 text-xs text-[#727272] dark:text-[#8A9A94]">
                                  Embedded Syncs
                                </p>
                                <p className="text-2xl font-semibold text-[#141414] dark:text-[#F5F9F7]">
                                  {dbUsage?.usage?.embedded_replicas?.toLocaleString() ||
                                    "0"}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Database Info */}
                          {dbInfo.info && (
                            <div className="rounded-2xl bg-[#F3F3EE] p-4 dark:bg-[#1A2421]">
                              <h3 className="mb-3 text-sm font-semibold text-[#141414] dark:text-[#F5F9F7]">
                                Database Information
                              </h3>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <p className="text-xs text-[#727272] dark:text-[#8A9A94]">
                                    Name
                                  </p>
                                  <p className="text-sm font-medium text-[#141414] dark:text-[#F5F9F7]">
                                    {dbInfo.info.Name}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-[#727272] dark:text-[#8A9A94]">
                                    Region
                                  </p>
                                  <p className="text-sm font-medium text-[#141414] dark:text-[#F5F9F7]">
                                    {dbInfo.info.primaryRegion}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-[#727272] dark:text-[#8A9A94]">
                                    Status
                                  </p>
                                  <div className="mt-1 flex gap-2">
                                    <Badge
                                      variant="outline"
                                      className="h-6 border-green-200 bg-green-50 px-2 text-xs text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300"
                                    >
                                      {dbInfo.info.block_reads
                                        ? "Reads Blocked"
                                        : "Reads Active"}
                                    </Badge>
                                    <Badge
                                      variant="outline"
                                      className="h-6 border-green-200 bg-green-50 px-2 text-xs text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300"
                                    >
                                      {dbInfo.info.block_writes
                                        ? "Writes Blocked"
                                        : "Writes Active"}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </TabsContent>
              )}

              {/* Database Tab - Tables List */}
              {dbInfo?.hasDatabase && (
                <TabsContent value="database" className="mt-0">
                  {/* Tables Loading State */}
                  {isLoadingTables ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-[#1E9A80]" />
                      <p className="text-sm text-[#727272] dark:text-[#B8C9C3]">
                        Loading database tables...
                      </p>
                    </div>
                  ) : tablesError ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-12">
                      <AlertCircle className="h-8 w-8 text-red-500" />
                      <p className="text-sm text-[#727272] dark:text-[#B8C9C3]">
                        Failed to load database tables
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {dbTables?.tables && dbTables.tables.length > 0 ? (
                        dbTables.tables.map((table) => (
                          <TableViewer
                            key={table.name}
                            projectId={projectId}
                            tableName={table.name}
                            rowCount={table.rowCount}
                            isExpanded={expandedTables.has(table.name)}
                            onToggle={() => toggleTable(table.name)}
                          />
                        ))
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-3 py-12">
                          <Database className="h-12 w-12 text-[#8A9A94]" />
                          <div className="text-center">
                            <h3 className="mb-1 text-sm font-semibold text-[#141414] dark:text-[#F5F9F7]">
                              No Tables Yet
                            </h3>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>
              )}

              {/* Domains Tab */}
              <TabsContent value="domains" className="mt-0">
                <DomainSettingsTab
                  projectId={projectId}
                  deploymentUrl={deploymentUrl}
                />
              </TabsContent>

              {/* Convex Dashboard Tabs - Single instance with preloaded iframes */}
              {convexInfo?.hasConvex && (
                <div
                  className={cn(
                    "mt-0 h-[500px]",
                    !["convex-data", "convex-files", "convex-functions", "convex-logs", "convex-health", "convex-env"].includes(selectedCategory) && "hidden"
                  )}
                >
                  {isLoadingDashboardCredentials ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-[#1E9A80]" />
                      <p className="text-sm text-[#727272] dark:text-[#B8C9C3]">
                        Loading Convex Dashboard...
                      </p>
                    </div>
                  ) : convexDashboardCredentials ? (
                    <ConvexDashboardTabs
                      deploymentUrl={convexDashboardCredentials.deploymentUrl}
                      deploymentName={convexDashboardCredentials.deploymentName}
                      deployKey={convexDashboardCredentials.adminKey}
                      activePage={
                        selectedCategory === "convex-data" ? "data" :
                        selectedCategory === "convex-files" ? "files" :
                        selectedCategory === "convex-functions" ? "functions" :
                        selectedCategory === "convex-logs" ? "logs" :
                        selectedCategory === "convex-health" ? "health" :
                        selectedCategory === "convex-env" ? "settings" :
                        "data"
                      }
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-3 py-12">
                      <AlertCircle className="h-8 w-8 text-red-500" />
                      <p className="text-sm text-[#727272] dark:text-[#B8C9C3]">
                        Failed to load dashboard credentials
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Convex Users/Auth Tab */}
              {convexInfo?.hasConvex && (
                <TabsContent value="convex-auth" className="mt-0">
                  <ConvexUserViewer projectId={projectId} />
                </TabsContent>
              )}

              {/* Shipper Cloud Billing Tab */}
              {convexInfo?.hasConvex && (
                <TabsContent value="shipper-cloud-billing" className="mt-0">
                  <ShipperCloudBillingTab projectId={projectId} />
                </TabsContent>
              )}
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
