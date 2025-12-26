"use client";
import { useState, useEffect, useMemo } from "react";
import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Activity, RocketIcon, FolderOpen, FileText, CloudCog, ListTodo, Cloud, ChevronDown, CreditCard, Settings } from "lucide-react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface User {
  id: string;
  name: string | null;
  email: string;
  creditBalance: number;
  cloudCreditBalance: number;
  membershipTier: string;
  membershipExpiresAt: Date | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  createdAt: Date;
}

export default function AdminDashboardClient() {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [membershipFilter, setMembershipFilter] = useState("ALL");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1); // Reset to first page when search changes
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset to first page when membership filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [membershipFilter]);

  // Fetch all users using tRPC with pagination
  const {
    data: usersData,
    refetch: fetchUsers,
    isLoading,
    error,
  } = useQuery(
    trpc.admin.getAllUsers.queryOptions({
      page: currentPage,
      limit: 20,
      search: debouncedSearch || undefined,
      membershipFilter: membershipFilter as
        | "ALL"
        | "FREE"
        | "NON_FREE"
        | "PRO"
        | "ENTERPRISE",
    }),
  );

  // Fetch stats separately for faster user list loading
  const {
    data: statsData,
    refetch: fetchStats,
    isLoading: statsLoading,
  } = useQuery(trpc.admin.getStats.queryOptions());

  // Define mutations for admin actions - MUST be called before any conditional returns
  const addCreditsMutation = useMutation(
    trpc.admin.addCredits.mutationOptions({
      onSuccess: () => {
        fetchUsers();
        fetchStats(); // Refresh stats after credit changes
        setActionLoading(null);
      },
      onError: (error) => {
        alert(`❌ Error: ${error.message}`);
        setActionLoading(null);
      },
    }),
  );

  const resetCreditsMutation = useMutation(
    trpc.admin.resetCredits.mutationOptions({
      onSuccess: () => {
        fetchUsers();
        fetchStats(); // Refresh stats after credit changes
        setActionLoading(null);
      },
      onError: (error) => {
        alert(`❌ Error: ${error.message}`);
        setActionLoading(null);
      },
    }),
  );

  const fixSubscriptionMutation = useMutation(
    trpc.admin.fixSubscription.mutationOptions({
      onSuccess: (result) => {
        alert(
          `✅ Fixed subscription! Added ${result.tierInfo.monthlyCredits} credits.`,
        );
        fetchUsers();
        fetchStats(); // Refresh stats after subscription changes
        setActionLoading(null);
      },
      onError: (error) => {
        alert(`❌ Fix failed: ${error.message}`);
        setActionLoading(null);
      },
    }),
  );

  const cancelSubscriptionMutation = useMutation(
    trpc.admin.cancelSubscription.mutationOptions({
      onSuccess: (result) => {
        alert(`✅ Cancelled subscription! ${result.message}`);
        fetchUsers();
        fetchStats(); // Refresh stats after subscription changes
        setActionLoading(null);
      },
      onError: (error) => {
        alert(`❌ Failed: ${error.message}`);
        setActionLoading(null);
      },
    }),
  );

  const changeTierMutation = useMutation(
    trpc.admin.changeTier.mutationOptions({
      onSuccess: (result) => {
        alert(`✅ Changed tier to ${result.newTier}!`);
        fetchUsers();
        fetchStats(); // Refresh stats after tier changes
        setActionLoading(null);
      },
      onError: (error) => {
        alert(`❌ Failed: ${error.message}`);
        setActionLoading(null);
      },
    }),
  );

  const generateInvoiceMutation = useMutation(
    trpc.admin.generateInvoice.mutationOptions({
      onSuccess: (result) => {
        const message = `✅ Invoice generated!\n\nAmount: $${
          result.amount
        }\nInvoice ID: ${result.invoiceId}\nStatus: ${
          result.status
        }\n\nDownload options:\n• Hosted page: ${result.invoiceUrl}\n• PDF: ${
          result.invoicePdf || "Available in hosted page"
        }`;

        if (
          confirm(`${message}\n\nOpen invoice page now?`) &&
          result.invoiceUrl
        ) {
          window.open(result.invoiceUrl, "_blank");
        }

        fetchUsers();
        setActionLoading(null);
      },
      onError: (error) => {
        alert(`❌ Failed: ${error.message}`);
        setActionLoading(null);
      },
    }),
  );

  const addCloudCreditsMutation = useMutation(
    trpc.admin.addCloudCredits.mutationOptions({
      onSuccess: () => {
        fetchUsers();
        fetchStats();
        setActionLoading(null);
      },
      onError: (error) => {
        alert(`❌ Error: ${error.message}`);
        setActionLoading(null);
      },
    }),
  );

  const resetCloudCreditsMutation = useMutation(
    trpc.admin.resetCloudCredits.mutationOptions({
      onSuccess: () => {
        fetchUsers();
        fetchStats();
        setActionLoading(null);
      },
      onError: (error) => {
        alert(`❌ Error: ${error.message}`);
        setActionLoading(null);
      },
    }),
  );

  // Handle error state - AFTER all hooks are defined
  if (error) {
    return (
      <div className="mx-auto max-w-7xl p-8">
        <div className="text-center text-red-600">
          <div className="mb-4 text-xl font-semibold">
            ❌ Error loading dashboard
          </div>
          <div className="text-sm">{error.message}</div>
          <button
            onClick={() => fetchUsers()}
            className="mt-4 rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
          >
            🔄 Retry
          </button>
        </div>
      </div>
    );
  }

  // Extract user data - AFTER all hooks are defined
  const users = (usersData?.users || []) as User[];
  const stats = statsData;

  // Admin action handlers
  const handleAddCredits = async (userId: string) => {
    const credits = prompt("How many credits to add?");
    if (!credits || isNaN(Number(credits))) return;

    setActionLoading(`credits-${userId}`);
    addCreditsMutation.mutate({ userId, credits: Number(credits) });
  };

  const handleResetCredits = async (userId: string) => {
    const credits = prompt("Set credits to exact amount:");
    if (!credits || isNaN(Number(credits))) return;

    setActionLoading(`reset-${userId}`);
    resetCreditsMutation.mutate({ userId, credits: Number(credits) });
  };

  const handleFixSubscription = async (userId: string) => {
    setActionLoading(`fix-${userId}`);
    fixSubscriptionMutation.mutate({ userId });
  };

  const handleCancelSubscription = async (userId: string) => {
    if (
      !confirm("⚠️ Are you sure you want to cancel this user's subscription?")
    )
      return;

    setActionLoading(`cancel-${userId}`);
    cancelSubscriptionMutation.mutate({ userId });
  };

  const handleChangeTier = async (userId: string) => {
    const newTier = prompt(
      "Enter new membership tier (FREE, PRO, ENTERPRISE):",
    );
    if (
      !newTier ||
      !["FREE", "PRO", "ENTERPRISE"].includes(newTier.toUpperCase())
    ) {
      alert("❌ Invalid tier. Must be: FREE, PRO, or ENTERPRISE");
      return;
    }

    setActionLoading(`tier-${userId}`);
    changeTierMutation.mutate({
      userId,
      tier: newTier.toUpperCase() as "FREE" | "PRO" | "ENTERPRISE",
    });
  };

  const handleGenerateInvoice = async (userId: string) => {
    const amount = prompt("Enter invoice amount (USD):");
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      alert("❌ Please enter a valid amount greater than 0");
      return;
    }

    const description = prompt("Enter invoice description:");
    if (!description || description.trim() === "") {
      alert("❌ Please enter a description");
      return;
    }

    const dueDate = prompt(
      "Enter due date (YYYY-MM-DD) or leave empty for 30 days from now:",
    );

    setActionLoading(`invoice-${userId}`);

    const requestData: {
      userId: string;
      amount: number;
      description: string;
      dueDate?: string;
    } = {
      userId,
      amount: Number(amount),
      description: description.trim(),
    };

    if (dueDate && dueDate.trim() !== "") {
      requestData.dueDate = dueDate.trim();
    }

    generateInvoiceMutation.mutate(requestData);
  };

  const handleAddCloudCredits = async (userId: string) => {
    const credits = prompt("How many cloud credits to add? (1 credit = $0.01)");
    if (!credits || isNaN(Number(credits))) return;

    setActionLoading(`cloud-credits-${userId}`);
    addCloudCreditsMutation.mutate({ userId, credits: Number(credits) });
  };

  const handleResetCloudCredits = async (userId: string) => {
    const credits = prompt("Set cloud credits to exact amount:");
    if (!credits || isNaN(Number(credits))) return;

    setActionLoading(`cloud-reset-${userId}`);
    resetCloudCreditsMutation.mutate({ userId, credits: Number(credits) });
  };

  return (
    <div className="mx-auto max-w-7xl p-8">
      <div className="mb-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="mb-2 text-3xl font-bold">🏛️ Admin Dashboard</h1>
            <p className="text-gray-600">
              Manage users, subscriptions, and credits
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/projects">
              <Button variant="outline" className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                Projects
              </Button>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Billing
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href="/admin/credit-activity" className="flex items-center gap-2 cursor-pointer">
                    <Activity className="h-4 w-4" />
                    Credit Activity
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/admin/billing" className="flex items-center gap-2 cursor-pointer">
                    <CloudCog className="h-4 w-4" />
                    Cloud Billing
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Tools
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href="/admin/shipper-cloud" className="flex items-center gap-2 cursor-pointer">
                    <Cloud className="h-4 w-4" />
                    Shipper Cloud
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/admin/deployments" className="flex items-center gap-2 cursor-pointer">
                    <RocketIcon className="h-4 w-4" />
                    Deployments
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/admin/templates" className="flex items-center gap-2 cursor-pointer">
                    <FileText className="h-4 w-4" />
                    Templates
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/admin/queue" className="flex items-center gap-2 cursor-pointer">
                    <ListTodo className="h-4 w-4" />
                    Queue
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="min-w-[300px] flex-1">
            <Input
              type="text"
              placeholder="Search users by name, email, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="min-w-[180px]">
            <Select
              value={membershipFilter}
              onValueChange={setMembershipFilter}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter by membership" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Users</SelectItem>
                <SelectItem value="FREE">Free Only</SelectItem>
                <SelectItem value="NON_FREE">Non-Free Only</SelectItem>
                <SelectItem value="PRO">Pro Only</SelectItem>
                <SelectItem value="ENTERPRISE">Enterprise Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <button
            onClick={() => {
              fetchUsers();
              fetchStats();
            }}
            className="rounded bg-blue-500 px-4 py-2 text-sm text-black hover:bg-blue-600"
          >
            🔄 Refresh Data
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
        <div className="rounded-lg bg-blue-50 p-4">
          <h3 className="font-semibold text-blue-800">Total Users</h3>
          <div className="text-2xl font-bold text-blue-600">
            {statsLoading ? (
              <div className="h-8 w-16 animate-pulse rounded bg-blue-200"></div>
            ) : (
              stats?.totalUsers || 0
            )}
          </div>
        </div>
        <div className="rounded-lg bg-green-50 p-4">
          <h3 className="font-semibold text-green-800">Pro Users</h3>
          <div className="text-2xl font-bold text-green-600">
            {statsLoading ? (
              <div className="h-8 w-16 animate-pulse rounded bg-green-200"></div>
            ) : (
              stats?.proUsers || 0
            )}
          </div>
        </div>
        <div className="rounded-lg bg-purple-50 p-4">
          <h3 className="font-semibold text-purple-800">Enterprise</h3>
          <div className="text-2xl font-bold text-purple-600">
            {statsLoading ? (
              <div className="h-8 w-16 animate-pulse rounded bg-purple-200"></div>
            ) : (
              stats?.enterpriseUsers || 0
            )}
          </div>
        </div>
        <div className="rounded-lg bg-orange-50 p-4">
          <h3 className="font-semibold text-orange-800">Subscriptions</h3>
          <div className="text-2xl font-bold text-orange-600">
            {statsLoading ? (
              <div className="h-8 w-16 animate-pulse rounded bg-orange-200"></div>
            ) : (
              stats?.withSubscriptions || 0
            )}
          </div>
        </div>
        <div className="rounded-lg bg-yellow-50 p-4">
          <h3 className="font-semibold text-yellow-800">Total Credits</h3>
          <div className="text-2xl font-bold text-yellow-600">
            {statsLoading ? (
              <div className="h-8 w-16 animate-pulse rounded bg-yellow-200"></div>
            ) : (
              stats?.totalCredits || 0
            )}
          </div>
        </div>
      </div>

      {/* Action Legend */}
      <div className="mb-6 rounded-lg bg-gray-50 p-4">
        <h3 className="mb-2 font-semibold text-gray-800">🎮 Action Legend</h3>
        <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4 lg:grid-cols-8">
          <div className="flex items-center gap-2">
            <span className="rounded bg-green-500 px-2 py-1 text-xs text-black">
              💰
            </span>
            <span className="text-black">Add Credits</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-yellow-500 px-2 py-1 text-xs text-black">
              ⚡
            </span>
            <span className="text-black">Reset Credits</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-cyan-500 px-2 py-1 text-xs text-black">
              ☁️
            </span>
            <span className="text-black">Add Cloud Credits</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-teal-500 px-2 py-1 text-xs text-black">
              🌥️
            </span>
            <span className="text-black">Reset Cloud Credits</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-purple-500 px-2 py-1 text-xs text-black">
              🔧
            </span>
            <span className="text-black">Fix Subscription</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-red-500 px-2 py-1 text-xs text-black">
              ❌
            </span>
            <span className="text-black">Cancel Subscription</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-blue-500 px-2 py-1 text-xs text-black">
              🔄
            </span>
            <span className="text-black">Change Tier</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-orange-500 px-2 py-1 text-xs text-black">
              📄
            </span>
            <span className="text-black">Generate Invoice</span>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="overflow-hidden rounded-lg bg-white shadow">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500"></div>
            <p className="text-gray-600">Loading users...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    User
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Builder Credits
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Cloud Credits
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Membership
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Subscription
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <div className="text-gray-500">
                        <div className="mb-2 text-lg font-medium">
                          No users found
                        </div>
                        <div className="text-sm">
                          {debouncedSearch || membershipFilter !== "ALL"
                            ? `No users match the current filters${
                                debouncedSearch
                                  ? ` (search: "${debouncedSearch}")`
                                  : ""
                              }${
                                membershipFilter !== "ALL"
                                  ? ` (membership: ${membershipFilter.toLowerCase().replace("_", "-")})`
                                  : ""
                              }`
                            : "No users in the system yet"}
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  users.map((user: User) => (
                    <tr
                      key={user.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() =>
                        window.open(`/admin/dashboard/${user.id}`, "_blank")
                      }
                    >
                      <td className="px-4 py-3">
                        <div>
                          <div className="flex items-center gap-2 font-medium text-gray-900">
                            {user.name}
                            <span className="text-xs text-blue-600">
                              ↗️ Click to view details
                            </span>
                          </div>
                          <div className="text-sm text-gray-500">
                            {user.email}
                          </div>
                          <div className="text-xs text-gray-400">
                            ID: {user.id.slice(-8)}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-lg font-semibold text-green-600">
                          {user.creditBalance}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-lg font-semibold text-cyan-600">
                          {user.cloudCreditBalance ?? 0}
                        </div>
                        <div className="text-xs text-gray-500">
                          ${((user.cloudCreditBalance ?? 0) / 100).toFixed(2)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                            user.membershipTier === "PRO"
                              ? "bg-blue-100 text-blue-800"
                              : user.membershipTier === "ENTERPRISE"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {user.membershipTier}
                        </span>
                        {user.membershipExpiresAt && (
                          <div className="mt-1 text-xs text-gray-500">
                            Expires:{" "}
                            {
                              new Date(user.membershipExpiresAt)
                                .toISOString()
                                .split("T")[0]
                            }
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          {user.stripeSubscriptionId ? (
                            <div>
                              <span className="text-green-600">✅ Active</span>
                              <div className="text-xs text-gray-500">
                                {user.stripeSubscriptionId.slice(-8)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-500">
                              No subscription
                            </span>
                          )}
                        </div>
                      </td>
                      <td
                        className="px-4 py-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex flex-wrap gap-1">
                          {/* Credit Actions */}
                          <button
                            onClick={() => handleAddCredits(user.id)}
                            disabled={actionLoading === `credits-${user.id}`}
                            className="rounded bg-green-500 px-2 py-1 text-xs text-black hover:bg-green-600 disabled:bg-green-300"
                            title="Add credits"
                          >
                            {actionLoading === `credits-${user.id}`
                              ? "⏳"
                              : "💰"}
                          </button>

                          <button
                            onClick={() => handleResetCredits(user.id)}
                            disabled={actionLoading === `reset-${user.id}`}
                            className="rounded bg-yellow-500 px-2 py-1 text-xs text-black hover:bg-yellow-600 disabled:bg-yellow-300"
                            title="Set credits to exact amount"
                          >
                            {actionLoading === `reset-${user.id}` ? "⏳" : "⚡"}
                          </button>

                          {/* Cloud Credit Actions */}
                          <button
                            onClick={() => handleAddCloudCredits(user.id)}
                            disabled={actionLoading === `cloud-credits-${user.id}`}
                            className="rounded bg-cyan-500 px-2 py-1 text-xs text-black hover:bg-cyan-600 disabled:bg-cyan-300"
                            title="Add cloud credits"
                          >
                            {actionLoading === `cloud-credits-${user.id}`
                              ? "⏳"
                              : "☁️"}
                          </button>

                          <button
                            onClick={() => handleResetCloudCredits(user.id)}
                            disabled={actionLoading === `cloud-reset-${user.id}`}
                            className="rounded bg-teal-500 px-2 py-1 text-xs text-black hover:bg-teal-600 disabled:bg-teal-300"
                            title="Set cloud credits to exact amount"
                          >
                            {actionLoading === `cloud-reset-${user.id}` ? "⏳" : "🌥️"}
                          </button>

                          {/* Subscription Actions */}
                          {user.stripeSubscriptionId && (
                            <>
                              <button
                                onClick={() => handleFixSubscription(user.id)}
                                disabled={actionLoading === `fix-${user.id}`}
                                className="rounded bg-purple-500 px-2 py-1 text-xs text-black hover:bg-purple-600 disabled:bg-purple-300"
                                title="Fix subscription issues"
                              >
                                {actionLoading === `fix-${user.id}`
                                  ? "⏳"
                                  : "🔧"}
                              </button>

                              <button
                                onClick={() =>
                                  handleCancelSubscription(user.id)
                                }
                                disabled={actionLoading === `cancel-${user.id}`}
                                className="rounded bg-red-500 px-2 py-1 text-xs text-black hover:bg-red-600 disabled:bg-red-300"
                                title="Cancel subscription (tRPC)"
                              >
                                {actionLoading === `cancel-${user.id}`
                                  ? "⏳"
                                  : "❌"}
                              </button>
                            </>
                          )}

                          {/* Tier Management */}
                          <button
                            onClick={() => handleChangeTier(user.id)}
                            disabled={actionLoading === `tier-${user.id}`}
                            className="rounded bg-blue-500 px-2 py-1 text-xs text-black hover:bg-blue-600 disabled:bg-blue-300"
                            title="Change membership tier"
                          >
                            {actionLoading === `tier-${user.id}` ? "⏳" : "🔄"}
                          </button>

                          {/* Invoice Generation */}
                          <button
                            onClick={() => handleGenerateInvoice(user.id)}
                            disabled={actionLoading === `invoice-${user.id}`}
                            className="rounded bg-orange-500 px-2 py-1 text-xs text-black hover:bg-orange-600 disabled:bg-orange-300"
                            title="Generate downloadable invoice"
                          >
                            {actionLoading === `invoice-${user.id}`
                              ? "⏳"
                              : "📄"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {!isLoading && usersData && usersData.totalPages > 1 && (
          <div className="border-t border-gray-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="text-sm text-gray-600">
                Showing {(currentPage - 1) * 20 + 1} to{" "}
                {Math.min(currentPage * 20, usersData.total)} of{" "}
                {usersData.total} users
                {(debouncedSearch || membershipFilter !== "ALL") && (
                  <span className="ml-2 text-blue-600">
                    {debouncedSearch && `(search: "${debouncedSearch}")`}
                    {debouncedSearch && membershipFilter !== "ALL" && " "}
                    {membershipFilter !== "ALL" &&
                      `(membership: ${membershipFilter.toLowerCase().replace("_", "-")})`}
                  </span>
                )}
              </div>
              <Pagination>
                <PaginationContent>
                  {usersData.hasPreviousPage && (
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setCurrentPage(currentPage - 1);
                        }}
                      />
                    </PaginationItem>
                  )}

                  {/* Page numbers */}
                  {Array.from(
                    { length: Math.min(5, usersData.totalPages) },
                    (_, i) => {
                      let pageNumber;
                      if (usersData.totalPages <= 5) {
                        pageNumber = i + 1;
                      } else {
                        // Smart pagination logic
                        if (currentPage <= 3) {
                          pageNumber = i + 1;
                        } else if (currentPage >= usersData.totalPages - 2) {
                          pageNumber = usersData.totalPages - 4 + i;
                        } else {
                          pageNumber = currentPage - 2 + i;
                        }
                      }

                      return (
                        <PaginationItem key={pageNumber}>
                          <PaginationLink
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              setCurrentPage(pageNumber);
                            }}
                            isActive={currentPage === pageNumber}
                          >
                            {pageNumber}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    },
                  )}

                  {usersData.totalPages > 5 &&
                    currentPage < usersData.totalPages - 2 && (
                      <>
                        <PaginationItem>
                          <PaginationEllipsis />
                        </PaginationItem>
                        <PaginationItem>
                          <PaginationLink
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              setCurrentPage(usersData.totalPages);
                            }}
                          >
                            {usersData.totalPages}
                          </PaginationLink>
                        </PaginationItem>
                      </>
                    )}

                  {usersData.hasNextPage && (
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setCurrentPage(currentPage + 1);
                        }}
                      />
                    </PaginationItem>
                  )}
                </PaginationContent>
              </Pagination>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
