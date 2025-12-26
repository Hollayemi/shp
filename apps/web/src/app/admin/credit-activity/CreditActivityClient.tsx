"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Loader2,
  Search,
  Calendar,
  TrendingUp,
  TrendingDown,
  Activity,
} from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import type { CreditType, MembershipTier } from "@/lib/db";

interface CreditTransaction {
  id: string;
  userId: string;
  amount: number;
  type: CreditType;
  description: string;
  metadata: any;
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string;
    membershipTier: MembershipTier;
  };
}

interface TypeBreakdown {
  type: CreditType;
  count: number;
  totalAmount: number;
}

const creditTypeColors: Record<CreditType, string> = {
  PURCHASE: "bg-green-100 text-green-800 border-green-200",
  MONTHLY_ALLOCATION: "bg-blue-100 text-blue-800 border-blue-200",
  AI_GENERATION: "bg-purple-100 text-purple-800 border-purple-200",
  SANDBOX_USAGE: "bg-orange-100 text-orange-800 border-orange-200",
  DEPLOYMENT: "bg-indigo-100 text-indigo-800 border-indigo-200",
  TEAM_COLLABORATION: "bg-pink-100 text-pink-800 border-pink-200",
  BONUS: "bg-emerald-100 text-emerald-800 border-emerald-200",
  REFUND: "bg-red-100 text-red-800 border-red-200",
};

const creditTypeLabels: Record<CreditType, string> = {
  PURCHASE: "Purchase",
  MONTHLY_ALLOCATION: "Monthly Allocation",
  AI_GENERATION: "AI Generation",
  SANDBOX_USAGE: "Sandbox Usage",
  DEPLOYMENT: "Deployment",
  TEAM_COLLABORATION: "Team Collaboration",
  BONUS: "Admin Bonus",
  REFUND: "Refund",
};

export default function CreditActivityClient() {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const trpc = useTRPC();

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1); // Reset to first page when search changes
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [typeFilter, startDate, endDate]);

  // Fetch credit activity data
  const {
    data: activityData,
    isLoading,
    error,
  } = useQuery(
    trpc.admin.getAllCreditActivity.queryOptions({
      page: currentPage,
      limit: 20,
      search: debouncedSearch || undefined,
      typeFilter: typeFilter as any,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    }),
  );

  const formatAmount = (amount: number) => {
    const absAmount = Math.abs(amount);
    return amount >= 0 ? `+${absAmount}` : `-${absAmount}`;
  };

  const getAmountColor = (amount: number) => {
    return amount >= 0 ? "text-green-600" : "text-red-600";
  };

  const clearFilters = () => {
    setSearchQuery("");
    setDebouncedSearch("");
    setTypeFilter("ALL");
    setStartDate("");
    setEndDate("");
    setCurrentPage(1);
  };

  if (error) {
    return (
      <div className="p-8">
        <div className="text-red-600">
          ❌ Error loading credit activity: {error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold">Credit Activity</h1>
            <p className="text-gray-600 mt-1">
              Monitor all credit transactions across the platform
            </p>
          </div>
          <Link href="/admin/dashboard">
            <Button variant="outline">← Back to Dashboard</Button>
          </Link>
        </div>

        {/* Statistics Cards */}
        {activityData && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Total Transactions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {activityData.stats.totalTransactions.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">In current view</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  {activityData.stats.totalAmount >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-600" />
                  )}
                  Net Credits
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${getAmountColor(activityData.stats.totalAmount)}`}
                >
                  {formatAmount(activityData.stats.totalAmount)}
                </div>
                <p className="text-xs text-muted-foreground">In current view</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Transaction Types
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {activityData.stats.typeBreakdown.length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Different types active
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Filters</CardTitle>
            <CardDescription>Filter and search credit activity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <Label htmlFor="search">Search</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="User name, email, or description..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="type-filter">Transaction Type</Label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Types</SelectItem>
                    <SelectItem value="PURCHASE">Purchase</SelectItem>
                    <SelectItem value="MONTHLY_ALLOCATION">
                      Monthly Allocation
                    </SelectItem>
                    <SelectItem value="AI_GENERATION">AI Generation</SelectItem>
                    <SelectItem value="SANDBOX_USAGE">Sandbox Usage</SelectItem>
                    <SelectItem value="DEPLOYMENT">Deployment</SelectItem>
                    <SelectItem value="TEAM_COLLABORATION">
                      Team Collaboration
                    </SelectItem>
                    <SelectItem value="BONUS">Admin Bonus</SelectItem>
                    <SelectItem value="REFUND">Refund</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>

              <div className="flex items-end">
                <Button
                  onClick={clearFilters}
                  variant="outline"
                  className="w-full"
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Credit Activity Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Credit Transactions</CardTitle>
              <CardDescription>
                {activityData?.pagination
                  ? `Showing ${(activityData.pagination.currentPage - 1) * activityData.pagination.limit + 1}-${Math.min(activityData.pagination.currentPage * activityData.pagination.limit, activityData.pagination.totalCount)} of ${activityData.pagination.totalCount} transactions`
                  : "Loading transactions..."}
              </CardDescription>
            </div>
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading credit activity...
            </div>
          ) : activityData?.transactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No credit transactions found for the current filters.
            </div>
          ) : (
            <>
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Membership</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activityData?.transactions.map(
                      (transaction: CreditTransaction) => (
                        <TableRow key={transaction.id}>
                          <TableCell className="font-mono text-sm">
                            {format(
                              transaction.createdAt,
                              "MMM dd, yyyy HH:mm",
                            )}
                          </TableCell>
                          <TableCell>
                            <div>
                              <Link
                                href={`/admin/dashboard/${transaction.userId}`}
                                className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                              >
                                {transaction.user.name || "Unknown User"}
                              </Link>
                              <div className="text-sm text-gray-500">
                                {transaction.user.email}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                creditTypeColors[transaction.type] || ""
                              }
                            >
                              {creditTypeLabels[transaction.type] ||
                                transaction.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-md">
                            <div
                              className="truncate"
                              title={transaction.description}
                            >
                              {transaction.description}
                            </div>
                          </TableCell>
                          <TableCell
                            className={`text-right font-mono font-medium ${getAmountColor(transaction.amount)}`}
                          >
                            {formatAmount(transaction.amount)} credits
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {transaction.user.membershipTier}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ),
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {activityData?.pagination &&
                activityData.pagination.totalPages > 1 && (
                  <div className="flex items-center justify-center mt-6">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() =>
                              setCurrentPage((prev) => Math.max(1, prev - 1))
                            }
                            className={
                              !activityData.pagination.hasPrev
                                ? "pointer-events-none opacity-50"
                                : "cursor-pointer"
                            }
                          />
                        </PaginationItem>

                        {/* Page numbers */}
                        {Array.from(
                          {
                            length: Math.min(
                              5,
                              activityData.pagination.totalPages,
                            ),
                          },
                          (_, i) => {
                            let pageNum;
                            if (activityData.pagination.totalPages <= 5) {
                              pageNum = i + 1;
                            } else if (
                              activityData.pagination.currentPage <= 3
                            ) {
                              pageNum = i + 1;
                            } else if (
                              activityData.pagination.currentPage >=
                              activityData.pagination.totalPages - 2
                            ) {
                              pageNum =
                                activityData.pagination.totalPages - 4 + i;
                            } else {
                              pageNum =
                                activityData.pagination.currentPage - 2 + i;
                            }

                            return (
                              <PaginationItem key={pageNum}>
                                <PaginationLink
                                  onClick={() => setCurrentPage(pageNum)}
                                  isActive={
                                    pageNum ===
                                    activityData.pagination.currentPage
                                  }
                                  className="cursor-pointer"
                                >
                                  {pageNum}
                                </PaginationLink>
                              </PaginationItem>
                            );
                          },
                        )}

                        {activityData.pagination.totalPages > 5 &&
                          activityData.pagination.currentPage <
                            activityData.pagination.totalPages - 2 && (
                            <PaginationItem>
                              <PaginationEllipsis />
                            </PaginationItem>
                          )}

                        <PaginationItem>
                          <PaginationNext
                            onClick={() =>
                              setCurrentPage((prev) =>
                                Math.min(
                                  activityData.pagination.totalPages,
                                  prev + 1,
                                ),
                              )
                            }
                            className={
                              !activityData.pagination.hasNext
                                ? "pointer-events-none opacity-50"
                                : "cursor-pointer"
                            }
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
