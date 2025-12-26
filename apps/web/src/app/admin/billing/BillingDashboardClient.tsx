"use client";

import { useState, useEffect, Fragment } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  Search,
  DollarSign,
  TrendingUp,
  Cloud,
  Server,
  Activity,
  RefreshCw,
  BarChart3,
  Users,
  ChevronDown,
  ChevronRight,
  Database,
  HardDrive,
  Cpu,
  Zap,
} from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import Link from "next/link";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const COLORS = [
  "#8884d8",
  "#82ca9d",
  "#ffc658",
  "#ff7300",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#0088FE",
];

// Component to fetch and display billing details on demand
function ProjectBillingDetails({ deploymentId }: { deploymentId: string }) {
  const trpc = useTRPC();
  const { data, isLoading, error } = useQuery(
    trpc.admin.getProjectBillingDetails.queryOptions({ deploymentId })
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading billing details...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-red-500 py-4">
        Failed to load billing details
      </div>
    );
  }

  const { meterBreakdown, storageSnapshot } = data;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Meter Breakdown with Pricing */}
      <div>
        <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <Zap className="h-4 w-4 text-yellow-600" />
          Usage Meters (Billing Period)
        </h4>
        {/* Header row */}
        <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground mb-2 px-2">
          <div>Meter</div>
          <div className="text-right">Convex Cost</div>
          <div className="text-right">Shipper Price</div>
          <div className="text-right">Margin</div>
        </div>
        <div className="space-y-2">
          <div className="grid grid-cols-4 gap-2 items-center p-2 bg-background rounded border">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-500" />
              <div>
                <span className="text-sm">Function Calls</span>
                <div className="text-xs text-muted-foreground">
                  {meterBreakdown.functionCalls.usageFormatted}
                </div>
              </div>
            </div>
            <div className="text-right font-mono text-red-500">
              <div className="text-sm">{meterBreakdown.functionCalls.convexCost.display}</div>
              <div className="text-xs text-red-400">{meterBreakdown.functionCalls.convexCost.raw}</div>
            </div>
            <div className="text-right font-mono text-blue-500">
              <div className="text-sm">{meterBreakdown.functionCalls.shipperPrice.display}</div>
              <div className="text-xs text-blue-400">{meterBreakdown.functionCalls.shipperPrice.raw}</div>
            </div>
            <div className="text-right font-mono text-green-500">
              <div className="text-sm">{meterBreakdown.functionCalls.margin.display}</div>
              <div className="text-xs text-green-400">{meterBreakdown.functionCalls.margin.raw}</div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 items-center p-2 bg-background rounded border">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-purple-500" />
              <div>
                <span className="text-sm">Action Compute</span>
                <div className="text-xs text-muted-foreground">
                  {meterBreakdown.actionCompute.usageFormatted}
                </div>
              </div>
            </div>
            <div className="text-right font-mono text-red-500">
              <div className="text-sm">{meterBreakdown.actionCompute.convexCost.display}</div>
              <div className="text-xs text-red-400">{meterBreakdown.actionCompute.convexCost.raw}</div>
            </div>
            <div className="text-right font-mono text-blue-500">
              <div className="text-sm">{meterBreakdown.actionCompute.shipperPrice.display}</div>
              <div className="text-xs text-blue-400">{meterBreakdown.actionCompute.shipperPrice.raw}</div>
            </div>
            <div className="text-right font-mono text-green-500">
              <div className="text-sm">{meterBreakdown.actionCompute.margin.display}</div>
              <div className="text-xs text-green-400">{meterBreakdown.actionCompute.margin.raw}</div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 items-center p-2 bg-background rounded border">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-green-500" />
              <div>
                <span className="text-sm">DB Bandwidth</span>
                <div className="text-xs text-muted-foreground">
                  {meterBreakdown.databaseBandwidth.usageFormatted}
                </div>
              </div>
            </div>
            <div className="text-right font-mono text-red-500">
              <div className="text-sm">{meterBreakdown.databaseBandwidth.convexCost.display}</div>
              <div className="text-xs text-red-400">{meterBreakdown.databaseBandwidth.convexCost.raw}</div>
            </div>
            <div className="text-right font-mono text-blue-500">
              <div className="text-sm">{meterBreakdown.databaseBandwidth.shipperPrice.display}</div>
              <div className="text-xs text-blue-400">{meterBreakdown.databaseBandwidth.shipperPrice.raw}</div>
            </div>
            <div className="text-right font-mono text-green-500">
              <div className="text-sm">{meterBreakdown.databaseBandwidth.margin.display}</div>
              <div className="text-xs text-green-400">{meterBreakdown.databaseBandwidth.margin.raw}</div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 items-center p-2 bg-background rounded border">
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-orange-500" />
              <div>
                <span className="text-sm">File Bandwidth</span>
                <div className="text-xs text-muted-foreground">
                  {meterBreakdown.fileBandwidth.usageFormatted}
                </div>
              </div>
            </div>
            <div className="text-right font-mono text-red-500">
              <div className="text-sm">{meterBreakdown.fileBandwidth.convexCost.display}</div>
              <div className="text-xs text-red-400">{meterBreakdown.fileBandwidth.convexCost.raw}</div>
            </div>
            <div className="text-right font-mono text-blue-500">
              <div className="text-sm">{meterBreakdown.fileBandwidth.shipperPrice.display}</div>
              <div className="text-xs text-blue-400">{meterBreakdown.fileBandwidth.shipperPrice.raw}</div>
            </div>
            <div className="text-right font-mono text-green-500">
              <div className="text-sm">{meterBreakdown.fileBandwidth.margin.display}</div>
              <div className="text-xs text-green-400">{meterBreakdown.fileBandwidth.margin.raw}</div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 items-center p-2 bg-background rounded border">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-pink-500" />
              <div>
                <span className="text-sm">Vector Bandwidth</span>
                <div className="text-xs text-muted-foreground">
                  {meterBreakdown.vectorBandwidth.usageFormatted}
                </div>
              </div>
            </div>
            <div className="text-right font-mono text-red-500">
              <div className="text-sm">{meterBreakdown.vectorBandwidth.convexCost.display}</div>
              <div className="text-xs text-red-400">{meterBreakdown.vectorBandwidth.convexCost.raw}</div>
            </div>
            <div className="text-right font-mono text-blue-500">
              <div className="text-sm">{meterBreakdown.vectorBandwidth.shipperPrice.display}</div>
              <div className="text-xs text-blue-400">{meterBreakdown.vectorBandwidth.shipperPrice.raw}</div>
            </div>
            <div className="text-right font-mono text-green-500">
              <div className="text-sm">{meterBreakdown.vectorBandwidth.margin.display}</div>
              <div className="text-xs text-green-400">{meterBreakdown.vectorBandwidth.margin.raw}</div>
            </div>
          </div>

          {/* Totals row */}
          <div className="grid grid-cols-4 gap-2 items-center p-2 bg-muted rounded border border-primary/20 font-semibold">
            <div className="text-sm">Total</div>
            <div className="text-right font-mono text-red-500">
              <div className="text-sm">{meterBreakdown.totals.convexCost.display}</div>
              <div className="text-xs text-red-400 font-normal">{meterBreakdown.totals.convexCost.raw}</div>
            </div>
            <div className="text-right font-mono text-blue-500">
              <div className="text-sm">{meterBreakdown.totals.shipperRevenue.display}</div>
              <div className="text-xs text-blue-400 font-normal">{meterBreakdown.totals.shipperRevenue.raw}</div>
            </div>
            <div className="text-right font-mono text-green-500">
              <div className="text-sm">
                {meterBreakdown.totals.margin.display}
                <span className="text-xs ml-1">({meterBreakdown.totals.marginPercent})</span>
              </div>
              <div className="text-xs text-green-400 font-normal">{meterBreakdown.totals.margin.raw}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Storage Snapshot */}
      {storageSnapshot && (
        <div>
          <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-blue-600" />
            Storage Snapshot
            {storageSnapshot.lastUpdated && (
              <span className="text-xs text-muted-foreground font-normal">
                (as of {format(new Date(storageSnapshot.lastUpdated), "MMM d, HH:mm")})
              </span>
            )}
          </h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 bg-background rounded border">
              <span className="text-sm">Documents</span>
              <span className="font-mono text-sm">
                {storageSnapshot.documentStorage.formatted}
              </span>
            </div>
            <div className="flex items-center justify-between p-2 bg-background rounded border">
              <span className="text-sm">Indexes</span>
              <span className="font-mono text-sm">
                {storageSnapshot.indexStorage.formatted}
              </span>
            </div>
            <div className="flex items-center justify-between p-2 bg-background rounded border">
              <span className="text-sm">File Storage</span>
              <span className="font-mono text-sm">
                {storageSnapshot.fileStorage.formatted}
              </span>
            </div>
            <div className="flex items-center justify-between p-2 bg-background rounded border">
              <span className="text-sm">Vector Storage</span>
              <span className="font-mono text-sm">
                {storageSnapshot.vectorStorage.formatted}
              </span>
            </div>
            <div className="flex items-center justify-between p-2 bg-background rounded border">
              <span className="text-sm">Backups</span>
              <span className="font-mono text-sm">
                {storageSnapshot.backupStorage.formatted}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BillingDashboardClient() {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateRange, setDateRange] = useState("30"); // days
  const [activeTab, setActiveTab] = useState("overview");
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const trpc = useTRPC();

  const toggleProjectExpanded = (projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch billing overview stats
  const {
    data: overviewData,
    isLoading: isLoadingOverview,
    refetch: refetchOverview,
  } = useQuery(
    trpc.admin.getBillingOverview.queryOptions({
      days: parseInt(dateRange),
    })
  );

  // Fetch usage by project (for table)
  const {
    data: projectUsageData,
    isLoading: isLoadingProjects,
    refetch: refetchProjects,
  } = useQuery(
    trpc.admin.getProjectUsageStats.queryOptions({
      page: currentPage,
      limit: 20,
      search: debouncedSearch || undefined,
      days: parseInt(dateRange),
    })
  );

  // Fetch usage over time (for charts)
  const { data: timeSeriesData, isLoading: isLoadingTimeSeries } = useQuery(
    trpc.admin.getUsageTimeSeries.queryOptions({
      days: parseInt(dateRange),
    })
  );

  const formatCredits = (credits: number) => {
    return credits.toLocaleString();
  };

  const formatDollars = (credits: number) => {
    return `$${(credits / 100).toFixed(2)}`;
  };

  const handleRefresh = () => {
    refetchOverview();
    refetchProjects();
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Cloud className="h-8 w-8 text-primary" />
              Shipper Cloud Billing Dashboard
            </h1>
            <p className="text-gray-600 mt-1">
              Monitor Cloud credit usage and billing across all projects
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoadingOverview || isLoadingProjects}
            >
              <RefreshCw
                className={`h-4 w-4 mr-1 ${isLoadingOverview ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <Link href="/admin/dashboard">
              <Button variant="outline">← Back to Dashboard</Button>
            </Link>
          </div>
        </div>

        {/* Date Range Filter */}
        <div className="flex items-center gap-4 mb-6">
          <Label>Time Period:</Label>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="60">Last 60 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="charts">Charts</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Stats Cards */}
          {isLoadingOverview ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading overview...
            </div>
          ) : overviewData ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      Total Credits Used
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCredits(overviewData.totalCreditsUsed)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDollars(overviewData.totalCreditsUsed)} equivalent
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Server className="h-4 w-4 text-blue-600" />
                      Active Deployments
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {overviewData.activeDeployments}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      With usage this period
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Activity className="h-4 w-4 text-purple-600" />
                      Function Calls
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {overviewData.totalFunctionCalls.toLocaleString()}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Total this period
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Users className="h-4 w-4 text-orange-600" />
                      Active Teams
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {overviewData.activeTeams}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      With Cloud usage
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Usage Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Usage Breakdown</CardTitle>
                    <CardDescription>
                      Credits by resource type
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Function Calls</span>
                        <span className="font-mono">
                          {formatCredits(overviewData.breakdown.functionCalls)} credits
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Action Compute</span>
                        <span className="font-mono">
                          {formatCredits(overviewData.breakdown.actionCompute)} credits
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Database Bandwidth</span>
                        <span className="font-mono">
                          {formatCredits(overviewData.breakdown.databaseBandwidth)} credits
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">File Bandwidth</span>
                        <span className="font-mono">
                          {formatCredits(overviewData.breakdown.fileBandwidth)} credits
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Vector Bandwidth</span>
                        <span className="font-mono">
                          {formatCredits(overviewData.breakdown.vectorBandwidth)} credits
                        </span>
                      </div>
                      <div className="border-t pt-4 flex justify-between items-center font-bold">
                        <span>Total</span>
                        <span className="font-mono text-green-600">
                          {formatDollars(overviewData.totalCreditsUsed)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Top Projects</CardTitle>
                    <CardDescription>
                      Highest usage this period
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {overviewData.topProjects.length === 0 ? (
                      <p className="text-muted-foreground text-sm">
                        No project usage data yet
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {overviewData.topProjects.map((project, index) => (
                          <div
                            key={project.projectId}
                            className="flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="w-6 h-6 p-0 flex items-center justify-center">
                                {index + 1}
                              </Badge>
                              <div>
                                <Link
                                  href={`/admin/projects/${project.projectId}`}
                                  className="text-sm font-medium text-blue-600 hover:underline"
                                >
                                  {project.projectName}
                                </Link>
                                <p className="text-xs text-muted-foreground">
                                  {project.teamName}
                                </p>
                              </div>
                            </div>
                            <span className="font-mono text-sm">
                              {formatDollars(project.credits)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}
        </TabsContent>

        {/* Charts Tab */}
        <TabsContent value="charts" className="space-y-6">
          {isLoadingTimeSeries ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading charts...
            </div>
          ) : timeSeriesData ? (
            <>
              {/* Credits Over Time */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Credits Usage Over Time
                  </CardTitle>
                  <CardDescription>
                    Daily credit consumption across all projects
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={timeSeriesData.daily}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(date) => format(new Date(date), "MMM d")}
                        />
                        <YAxis tickFormatter={(v) => `$${(v / 100).toFixed(0)}`} />
                        <Tooltip
                          labelFormatter={(date) => format(new Date(date), "MMM d, yyyy")}
                          formatter={(value: number) => [
                            `${formatCredits(value)} credits (${formatDollars(value)})`,
                            "Usage",
                          ]}
                        />
                        <Legend />
                        <Area
                          type="monotone"
                          dataKey="credits"
                          stroke="#8884d8"
                          fill="#8884d8"
                          fillOpacity={0.3}
                          name="Credits"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Function Calls Over Time */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Function Calls Over Time
                  </CardTitle>
                  <CardDescription>
                    Daily function execution counts
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={timeSeriesData.daily}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(date) => format(new Date(date), "MMM d")}
                        />
                        <YAxis tickFormatter={(v) => v.toLocaleString()} />
                        <Tooltip
                          labelFormatter={(date) => format(new Date(date), "MMM d, yyyy")}
                          formatter={(value: number) => [
                            value.toLocaleString(),
                            "Function Calls",
                          ]}
                        />
                        <Legend />
                        <Bar
                          dataKey="functionCalls"
                          fill="#82ca9d"
                          name="Function Calls"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Usage by Category Pie Chart */}
              {timeSeriesData.breakdown && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Usage Distribution
                    </CardTitle>
                    <CardDescription>
                      Credits by resource category
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={timeSeriesData.breakdown}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) =>
                              `${name}: ${((percent as number) * 100).toFixed(0)}%`
                            }
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {timeSeriesData.breakdown.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={COLORS[index % COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: number) => [
                              `${formatCredits(value)} credits`,
                              "Usage",
                            ]}
                          />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No usage data available for the selected period
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Projects Tab */}
        <TabsContent value="projects" className="space-y-6">
          {/* Search */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Search Projects</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by project or team name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </CardContent>
          </Card>

          {/* Projects Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Project Usage</CardTitle>
                  <CardDescription>
                    {projectUsageData?.pagination
                      ? `Showing ${(projectUsageData.pagination.currentPage - 1) * projectUsageData.pagination.limit + 1}-${Math.min(projectUsageData.pagination.currentPage * projectUsageData.pagination.limit, projectUsageData.pagination.totalCount)} of ${projectUsageData.pagination.totalCount} projects. Click a row to see meter breakdown.`
                      : "Loading..."}
                  </CardDescription>
                </div>
                {isLoadingProjects && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingProjects ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  Loading projects...
                </div>
              ) : projectUsageData?.projects.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No projects found with Cloud usage.
                </div>
              ) : (
                <>
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8"></TableHead>
                          <TableHead>Project</TableHead>
                          <TableHead>Team</TableHead>
                          <TableHead>Deployment</TableHead>
                          <TableHead className="text-right">Total Credits</TableHead>
                          <TableHead>Last Activity</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {projectUsageData?.projects.map((project) => {
                          const isExpanded = expandedProjects.has(project.id);
                          return (
                            <>
                              <TableRow
                                key={project.id}
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => toggleProjectExpanded(project.id)}
                              >
                                <TableCell className="w-8">
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Link
                                    href={`/admin/projects/${project.id}`}
                                    className="font-medium text-blue-600 hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {project.name}
                                  </Link>
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {project.teamName}
                                </TableCell>
                                <TableCell className="font-mono text-xs">
                                  {project.deploymentName}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  <div>{formatCredits(project.credits)}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {formatDollars(project.credits)}
                                  </div>
                                </TableCell>
                                <TableCell className="text-sm">
                                  {project.lastUsageAt
                                    ? format(new Date(project.lastUsageAt), "MMM d, HH:mm")
                                    : "Never"}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant={
                                      project.status === "ACTIVE"
                                        ? "default"
                                        : "secondary"
                                    }
                                  >
                                    {project.status}
                                  </Badge>
                                </TableCell>
                              </TableRow>

                              {/* Expanded meter breakdown row - lazy loaded */}
                              {isExpanded && (
                                <TableRow key={`${project.id}-breakdown`} className="bg-muted/30">
                                  <TableCell colSpan={7} className="p-4">
                                    <ProjectBillingDetails deploymentId={project.deploymentId} />
                                  </TableCell>
                                </TableRow>
                              )}
                            </>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  {projectUsageData?.pagination &&
                    projectUsageData.pagination.totalPages > 1 && (
                      <div className="flex items-center justify-center mt-6">
                        <Pagination>
                          <PaginationContent>
                            <PaginationItem>
                              <PaginationPrevious
                                onClick={() =>
                                  setCurrentPage((prev) => Math.max(1, prev - 1))
                                }
                                className={
                                  !projectUsageData.pagination.hasPrev
                                    ? "pointer-events-none opacity-50"
                                    : "cursor-pointer"
                                }
                              />
                            </PaginationItem>

                            {Array.from(
                              {
                                length: Math.min(
                                  5,
                                  projectUsageData.pagination.totalPages
                                ),
                              },
                              (_, i) => {
                                let pageNum;
                                if (projectUsageData.pagination.totalPages <= 5) {
                                  pageNum = i + 1;
                                } else if (
                                  projectUsageData.pagination.currentPage <= 3
                                ) {
                                  pageNum = i + 1;
                                } else if (
                                  projectUsageData.pagination.currentPage >=
                                  projectUsageData.pagination.totalPages - 2
                                ) {
                                  pageNum =
                                    projectUsageData.pagination.totalPages - 4 + i;
                                } else {
                                  pageNum =
                                    projectUsageData.pagination.currentPage - 2 + i;
                                }

                                return (
                                  <PaginationItem key={pageNum}>
                                    <PaginationLink
                                      onClick={() => setCurrentPage(pageNum)}
                                      isActive={
                                        pageNum ===
                                        projectUsageData.pagination.currentPage
                                      }
                                      className="cursor-pointer"
                                    >
                                      {pageNum}
                                    </PaginationLink>
                                  </PaginationItem>
                                );
                              }
                            )}

                            {projectUsageData.pagination.totalPages > 5 &&
                              projectUsageData.pagination.currentPage <
                                projectUsageData.pagination.totalPages - 2 && (
                                <PaginationItem>
                                  <PaginationEllipsis />
                                </PaginationItem>
                              )}

                            <PaginationItem>
                              <PaginationNext
                                onClick={() =>
                                  setCurrentPage((prev) =>
                                    Math.min(
                                      projectUsageData.pagination.totalPages,
                                      prev + 1
                                    )
                                  )
                                }
                                className={
                                  !projectUsageData.pagination.hasNext
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
