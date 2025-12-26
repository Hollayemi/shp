"use client";

import { useState } from "react";
import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { format } from "date-fns";
import {
  CloudIcon,
  SearchIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Loader2Icon,
  CheckCircleIcon,
  XCircleIcon,
  AlertTriangleIcon,
  WrenchIcon,
  ExternalLinkIcon,
  RefreshCwIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AdminShipperCloudPage() {
  const trpc = useTRPC();

  // State
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "ACTIVE" | "ERROR" | "INCOMPLETE_SETUP"
  >("ALL");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null
  );

  // Query for deployments list
  const { data, isLoading, refetch } = useQuery({
    ...trpc.admin.getShipperCloudDeployments.queryOptions({
      page,
      limit: 20,
      search,
      statusFilter,
    }),
  });

  // Query for deployment details (when selected)
  const { data: details, isLoading: detailsLoading } = useQuery({
    ...trpc.admin.getShipperCloudDeploymentDetails.queryOptions({
      projectId: selectedProjectId!,
    }),
    enabled: !!selectedProjectId,
  });

  // Mutations
  const fixCredentialsMutation = useMutation(
    trpc.admin.fixShipperCloudCredentials.mutationOptions({
      onSuccess: (result) => {
        toast.success(result.message);
        refetch();
      },
      onError: (error) => {
        toast.error(error.message || "Failed to fix credentials");
      },
    })
  );

  const markSetupCompleteMutation = useMutation(
    trpc.admin.markShipperCloudSetupComplete.mutationOptions({
      onSuccess: (result) => {
        toast.success(result.message);
        refetch();
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update setup status");
      },
    })
  );

  const deployments = data?.deployments || [];
  const pagination = data?.pagination;

  // Stats
  const totalDeployments = pagination?.total || 0;
  const incompleteSetup = deployments.filter((d) => !d.setupComplete).length;
  const withErrors = deployments.filter((d) => d.status === "ERROR").length;
  const noSandbox = deployments.filter((d) => !d.hasSandbox).length;

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/admin/dashboard"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ChevronLeftIcon className="h-4 w-4 mr-1" />
          Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <CloudIcon className="h-8 w-8" />
          Shipper Cloud Management
        </h1>
        <p className="text-muted-foreground mt-2">
          Diagnose and fix Shipper Cloud (Convex) deployment issues
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Deployments</CardDescription>
            <CardTitle className="text-2xl">{totalDeployments}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Incomplete Setup</CardDescription>
            <CardTitle className="text-2xl text-yellow-600">
              {incompleteSetup}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>With Errors</CardDescription>
            <CardTitle className="text-2xl text-red-600">{withErrors}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>No Sandbox</CardDescription>
            <CardTitle className="text-2xl text-gray-500">{noSandbox}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by deployment name, project ID, or user..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-10"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(value: typeof statusFilter) => {
            setStatusFilter(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Deployments</SelectItem>
            <SelectItem value="ACTIVE">Active & Complete</SelectItem>
            <SelectItem value="INCOMPLETE_SETUP">Incomplete Setup</SelectItem>
            <SelectItem value="ERROR">With Errors</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCwIcon className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Deployments Table */}
      <div className="bg-card rounded-lg border">
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2Icon className="h-8 w-8 animate-spin" />
          </div>
        ) : deployments.length === 0 ? (
          <div className="p-8 text-center">
            <CloudIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No deployments found</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Deployment</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Setup</TableHead>
                <TableHead>Sandbox</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deployments.map((deployment) => (
                <TableRow key={deployment.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {deployment.convexDeploymentName}
                      </div>
                      <a
                        href={deployment.convexDeploymentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:underline flex items-center gap-1"
                      >
                        {deployment.convexDeploymentUrl.replace(
                          "https://",
                          ""
                        )}
                        <ExternalLinkIcon className="h-3 w-3" />
                      </a>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/admin/projects/${deployment.projectId}`}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      {deployment.projectName || "Untitled"}
                    </Link>
                    <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                      {deployment.projectId}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{deployment.userName || "-"}</div>
                    <div className="text-xs text-muted-foreground">
                      {deployment.userEmail}
                    </div>
                  </TableCell>
                  <TableCell>
                    {deployment.status === "ACTIVE" ? (
                      <Badge variant="default" className="bg-green-500">
                        <CheckCircleIcon className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    ) : deployment.status === "ERROR" ? (
                      <Badge variant="destructive">
                        <XCircleIcon className="h-3 w-3 mr-1" />
                        Error
                      </Badge>
                    ) : (
                      <Badge variant="secondary">{deployment.status}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {deployment.setupComplete ? (
                      <Badge variant="outline" className="text-green-600">
                        <CheckCircleIcon className="h-3 w-3 mr-1" />
                        Complete
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-yellow-600">
                        <AlertTriangleIcon className="h-3 w-3 mr-1" />
                        Incomplete
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {deployment.hasSandbox ? (
                      <span className="text-green-600 text-sm">Yes</span>
                    ) : (
                      <span className="text-gray-400 text-sm">No</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {format(new Date(deployment.createdAt), "MMM d, yyyy")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(deployment.createdAt), "h:mm a")}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setSelectedProjectId(deployment.projectId)
                        }
                      >
                        Details
                      </Button>
                      {deployment.hasSandbox && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            fixCredentialsMutation.mutate({
                              projectId: deployment.projectId,
                            })
                          }
                          disabled={fixCredentialsMutation.isPending}
                          title="Fix credentials"
                        >
                          <WrenchIcon className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <div className="text-sm text-muted-foreground">
            Showing {(page - 1) * 20 + 1} to{" "}
            {Math.min(page * 20, pagination.total)} of {pagination.total}{" "}
            deployments
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
            >
              <ChevronLeftIcon className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <div className="text-sm">
              Page {page} of {pagination.totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={page >= pagination.totalPages}
            >
              Next
              <ChevronRightIcon className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Details Dialog */}
      <Dialog
        open={!!selectedProjectId}
        onOpenChange={() => setSelectedProjectId(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Shipper Cloud Deployment Details</DialogTitle>
            <DialogDescription>
              Detailed status and diagnostics for this deployment
            </DialogDescription>
          </DialogHeader>

          {detailsLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2Icon className="h-8 w-8 animate-spin" />
            </div>
          ) : details ? (
            <div className="space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">
                    Deployment Name
                  </div>
                  <div className="font-medium">
                    {details.convexDeploymentName}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">
                    Convex Project ID
                  </div>
                  <div className="font-mono text-sm">
                    {details.convexProjectId}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Status</div>
                  <Badge
                    variant={
                      details.status === "ACTIVE" ? "default" : "destructive"
                    }
                  >
                    {details.status}
                  </Badge>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">
                    Setup Complete
                  </div>
                  <Badge
                    variant={details.setupComplete ? "default" : "secondary"}
                  >
                    {details.setupComplete ? "Yes" : "No"}
                  </Badge>
                </div>
              </div>

              {/* Credential Status (from database - always available) */}
              {details.credentialStatus && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      Credential Status (Database)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        {details.credentialStatus.hasDeployKey ? (
                          <CheckCircleIcon className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircleIcon className="h-4 w-4 text-red-500" />
                        )}
                        Deploy Key Stored
                      </div>
                      <div className="flex items-center gap-2">
                        {details.credentialStatus.hasDeploymentUrl ? (
                          <CheckCircleIcon className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircleIcon className="h-4 w-4 text-red-500" />
                        )}
                        Deployment URL
                      </div>
                      <div className="flex items-center gap-2">
                        {details.credentialStatus.hasWebhookSecret ? (
                          <CheckCircleIcon className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircleIcon className="h-4 w-4 text-red-500" />
                        )}
                        Webhook Secret
                      </div>
                      <div className="flex items-center gap-2">
                        {details.credentialStatus.setupComplete ? (
                          <CheckCircleIcon className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircleIcon className="h-4 w-4 text-red-500" />
                        )}
                        Setup Complete
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Webhook Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">
                    Webhook Configured
                  </div>
                  <Badge variant={details.webhookConfigured ? "default" : "secondary"}>
                    {details.webhookConfigured ? "Yes" : "No"}
                  </Badge>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">
                    Credits Used
                  </div>
                  <div className="font-medium">
                    {details.creditsUsedThisPeriod.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Error */}
              {details.lastDeployError && (
                <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                  <div className="text-sm font-medium text-red-600">
                    Last Deploy Error
                  </div>
                  <div className="text-sm text-red-500 mt-1">
                    {details.lastDeployError}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          <DialogFooter className="gap-2">
            {details?.hasSandbox && (
              <Button
                variant="outline"
                onClick={() =>
                  fixCredentialsMutation.mutate({
                    projectId: selectedProjectId!,
                  })
                }
                disabled={fixCredentialsMutation.isPending}
              >
                <WrenchIcon className="h-4 w-4 mr-2" />
                Fix Credentials
              </Button>
            )}
            {details && !details.setupComplete && (
              <Button
                variant="outline"
                onClick={() =>
                  markSetupCompleteMutation.mutate({
                    projectId: selectedProjectId!,
                    complete: true,
                  })
                }
                disabled={markSetupCompleteMutation.isPending}
              >
                Mark Setup Complete
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() => setSelectedProjectId(null)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
