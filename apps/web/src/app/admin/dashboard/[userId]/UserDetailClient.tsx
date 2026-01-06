"use client";
import { useState, Suspense, useMemo } from "react";
import Link from "next/link";
import { useTRPC } from "@/trpc/client";
import {
  useSuspenseQuery,
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Gem, MessageSquare, Sparkles, Cloud, ChevronDown, ChevronRight, ChevronLeft } from "lucide-react";

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
  lastCreditReset: Date | null;
  monthlyCreditsUsed: number;
  lifetimeCreditsUsed: number;
  createdAt: Date;
  updatedAt: Date;
}

interface Transaction {
  id: string;
  amount: number;
  type: string;
  description: string;
  metadata: any;
  createdAt: Date;
}

interface Purchase {
  id: string;
  credits: number;
  amountPaid: number;
  stripePaymentId: string;
  status: string;
  metadata: any;
  createdAt: Date;
}

interface UserData {
  user: User;
  transactions: Transaction[];
  purchases: Purchase[];
  subscription: any;
  projects: Array<{
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    _count: {
      messages: number;
      halChatMessages: number;
    };
    stats: {
      transactions: {
        creditsUsed: number;
      };
    };
  }>;
  stats: {
    transactions: {
      totalTransactions: number;
      creditsPurchased: number;
      creditsUsed: number;
      monthlyAllocations: number;
      adminAdjustments: number;
    };
    purchases: {
      totalPurchases: number;
      totalSpent: number;
      totalCreditsPurchased: number;
    };
  };
}

function UserDetailContent({ userId }: { userId: string }) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedShipperCloudProjects, setExpandedShipperCloudProjects] = useState<Set<string>>(new Set());
  const [shipperCloudPage, setShipperCloudPage] = useState(1);
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const truncate = (text: string | null, max = 100) => {
    const safeText = text ?? "";
    return safeText.length > max ? `${safeText.slice(0, max)}…` : safeText;
  };

  const toReadableText = (raw: any): string | null => {
    if (!raw) return null;

    const ensureString = (val: any) => {
      if (val === null || val === undefined) return "";
      return typeof val === "string" ? val : String(val);
    };

    // If it's already a short string, return directly
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        // If parsed is array of content parts
        if (Array.isArray(parsed)) {
          const textParts = parsed
            .map((part) => {
              if (typeof part === "string") return part;
              if (part?.type === "text")
                return ensureString(part.text || part.content);
              if (part?.type === "user" || part?.type === "assistant")
                return ensureString(part.content || part.text);
              return "";
            })
            .filter(Boolean);
          if (textParts.length) return textParts.join(" ");
        }

        if (parsed && typeof parsed === "object") {
          if ((parsed as any).text) return ensureString((parsed as any).text);
          if ((parsed as any).content)
            return ensureString((parsed as any).content);
        }
      } catch {
        // not JSON, fall through
      }
      return raw;
    }

    // If it's an array of parts
    if (Array.isArray(raw)) {
      const textParts = raw
        .map((part) => {
          if (typeof part === "string") return part;
          if (part?.type === "text")
            return ensureString(part.text || part.content);
          if (part?.type === "user" || part?.type === "assistant")
            return ensureString(part.content || part.text);
          return "";
        })
        .filter(Boolean);
      if (textParts.length) return textParts.join(" ");
    }

    // If it's an object with common fields
    if (typeof raw === "object") {
      if ((raw as any).text) return ensureString((raw as any).text);
      if ((raw as any).content) return ensureString((raw as any).content);
      if ((raw as any).message) return ensureString((raw as any).message);
    }

    return ensureString(raw);
  };

  const getTransactionMessage = (transaction: Transaction) => {
    const meta = transaction.metadata as any;
    const candidate =
      meta?.input ||
      meta?.messageContent ||
      meta?.message?.content ||
      meta?.message?.text ||
      meta?.userMessage ||
      meta?.message ||
      meta?.prompt ||
      meta?.content ||
      meta?.text;

    if (!candidate) return null;

    const readable = toReadableText(candidate);
    if (readable && readable.trim()) return readable;

    // Fallback to stringified object
    if (typeof candidate === "object") {
      try {
        return JSON.stringify(candidate);
      } catch (error) {
        console.error(
          "Failed to stringify transaction message candidate",
          error,
        );
        return String(candidate);
      }
    }

    return String(candidate);
  };

  const formatLabel = (value: string) =>
    value
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (match) => match.toUpperCase());

  const getDisplayType = (transaction: Transaction) => {
    const meta = transaction.metadata as any;
    const feature = (meta?.feature as string | undefined)?.toLowerCase();

    if (feature) {
      if (feature.includes("advisor")) return "ADVISOR_CHAT";
    }

    return "BUILDER";
  };

  const getTransactionTypeLabel = (transaction: Transaction) => {
    const meta = transaction.metadata as any;
    const rawDetail =
      meta?.operation ||
      meta?.category ||
      meta?.source ||
      meta?.mode ||
      meta?.feature ||
      meta?.reason ||
      meta?.type;

    if (!rawDetail) return transaction.type;

    const detail = Array.isArray(rawDetail) ? rawDetail[0] : rawDetail;
    const formattedDetail =
      typeof detail === "string" ? formatLabel(detail) : String(detail);

    return `${transaction.type} · ${formattedDetail}`;
  };

  // Fetch user data using tRPC with suspense
  const { data } = useSuspenseQuery(
    trpc.admin.getUserDetails.queryOptions({ userId }),
  );

  const userData = data as UserData;

  // Fetch Shipper Cloud projects for this user (paginated)
  const { data: shipperCloudData, isFetching: isShipperCloudFetching } = useQuery({
    ...trpc.admin.getUserShipperCloudProjects.queryOptions({
      userId,
      page: shipperCloudPage,
      limit: 5,
    }),
    placeholderData: keepPreviousData,
  });

  const toggleShipperCloudProject = (projectId: string) => {
    setExpandedShipperCloudProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const { user, transactions, purchases, subscription, projects } = userData;

  const projectNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    projects?.forEach((project) => {
      map[project.id] = project.name;
    });
    return map;
  }, [projects]);

  const transactionsNeedingLookup = Array.from(
    new Set(
      transactions
        .map((tx) => (tx.metadata as any)?.messageId as string | undefined)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  );

  const { data: messageLookup = {} } = useQuery({
    ...trpc.admin.getMessagesByIds.queryOptions({
      messageIds: transactionsNeedingLookup,
    }),
    enabled: transactionsNeedingLookup.length > 0,
  });

  const getTransactionDescription = (
    transaction: Transaction,
    message?: string | null,
  ) => {
    const meta = transaction.metadata as any;
    const projectId = (meta?.projectId as string | undefined) || undefined;
    const projectName =
      (projectId && projectNameMap[projectId]) ||
      (meta?.projectName as string | undefined);
    const messageId = meta?.messageId as string | undefined;
    const lookupEntry = messageId
      ? (messageLookup as Record<string, any> | undefined)?.[messageId]
      : undefined;

    const lookupContent =
      typeof lookupEntry === "string" ? lookupEntry : lookupEntry?.content;
    const lookupPreviousUser =
      typeof lookupEntry === "string"
        ? null
        : lookupEntry?.previousUserMessage?.content;

    const resolvedMessage =
      lookupPreviousUser ??
      lookupContent ??
      message ??
      getTransactionMessage(transaction);
    const readableMessage = resolvedMessage
      ? toReadableText(resolvedMessage)
      : null;

    const withProjectName = (text: string | null) => {
      if (!projectName) return text;
      if (text && text.trim()) return `${projectName} — ${text}`;
      return projectName;
    };

    if (readableMessage && readableMessage.trim())
      return truncate(withProjectName(readableMessage), 205);

    const fallbackRaw =
      meta?.description ||
      meta?.reason ||
      meta?.details ||
      transaction.description;
    const fallbackReadable = fallbackRaw ? toReadableText(fallbackRaw) : null;

    if (fallbackReadable && fallbackReadable.trim())
      return truncate(withProjectName(fallbackReadable), 100);
    if (fallbackRaw) return truncate(withProjectName(String(fallbackRaw)), 100);

    return null;
  };

  // Define mutations for admin actions
  const addCreditsMutation = useMutation(
    trpc.admin.addCredits.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries();
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
        queryClient.invalidateQueries();
        setActionLoading(null);
      },
      onError: (error) => {
        alert(`❌ Error: ${error.message}`);
        setActionLoading(null);
      },
    }),
  );

  const changeTierMutation = useMutation(
    trpc.admin.changeTier.mutationOptions({
      onSuccess: (result) => {
        alert(`✅ Changed tier to ${result.newTier}!`);
        queryClient.invalidateQueries();
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
        const message = `✅ Invoice generated!\n\nAmount: $${result.amount}\nInvoice ID: ${result.invoiceId}\nStatus: ${result.status}\n\nDownload options:\n• Hosted page: ${result.invoiceUrl}\n• PDF: ${result.invoicePdf || "Available in hosted page"}`;

        if (
          confirm(`${message}\n\nOpen invoice page now?`) &&
          result.invoiceUrl
        ) {
          window.open(result.invoiceUrl, "_blank");
        }

        queryClient.invalidateQueries();
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
        queryClient.invalidateQueries();
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
        queryClient.invalidateQueries();
        setActionLoading(null);
      },
      onError: (error) => {
        alert(`❌ Error: ${error.message}`);
        setActionLoading(null);
      },
    }),
  );

  // Generate invoice based on transaction
  const handleGenerateInvoiceFromTransaction = async (
    transaction: Transaction,
  ) => {
    // For negative amounts (usage), convert to positive for invoice
    const invoiceAmount = Math.abs(transaction.amount);

    // Determine if this is a credit usage or purchase
    const isUsage = transaction.amount < 0;
    const defaultDescription = isUsage
      ? `Service usage: ${transaction.description} (${Math.abs(transaction.amount)} credits used)`
      : `Credit transaction: ${transaction.description}`;

    const amount = prompt(
      `Enter invoice amount (USD) [suggested: $${(invoiceAmount * 0.1).toFixed(2)}]:`,
      (invoiceAmount * 0.1).toFixed(2),
    );
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      alert("❌ Please enter a valid amount greater than 0");
      return;
    }

    const description = prompt(
      "Enter invoice description:",
      defaultDescription,
    );
    if (!description || description.trim() === "") {
      alert("❌ Please enter a description");
      return;
    }

    const dueDate = prompt(
      "Enter due date (YYYY-MM-DD) or leave empty for 30 days from now:",
    );

    setActionLoading(`invoice-${transaction.id}`);

    const requestData: any = {
      userId,
      amount: Number(amount),
      description: description.trim(),
    };

    if (dueDate && dueDate.trim() !== "") {
      requestData.dueDate = dueDate.trim();
    }

    generateInvoiceMutation.mutate(requestData);
  };

  // Get transaction type styling
  const getTransactionTypeStyle = (type: string) => {
    switch (type) {
      case "ADVISOR_CHAT":
        return "bg-[#22c55e] text-white";
      case "BUILDER":
        return "bg-[#e0f2fe] text-blue-800";
      case "PURCHASE":
        return "bg-green-100 text-green-800";
      case "MONTHLY_ALLOCATION":
        return "bg-blue-100 text-blue-800";
      case "AI_GENERATION":
      case "SANDBOX_USAGE":
      case "DEPLOYMENT":
        return "bg-red-100 text-red-800";
      case "BONUS":
        return "bg-purple-100 text-purple-800";
      case "REFUND":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Action handlers
  const handleAddCredits = async () => {
    const credits = prompt("How many credits to add?");
    if (!credits || isNaN(Number(credits))) return;

    setActionLoading("add-credits");
    addCreditsMutation.mutate({ userId, credits: Number(credits) });
  };

  const handleResetCredits = async () => {
    const credits = prompt("Set credits to exact amount:");
    if (!credits || isNaN(Number(credits))) return;

    setActionLoading("reset-credits");
    resetCreditsMutation.mutate({ userId, credits: Number(credits) });
  };

  const handleAddCloudCredits = async () => {
    const credits = prompt("How many cloud credits to add? (1 credit = $0.01)");
    if (!credits || isNaN(Number(credits))) return;

    setActionLoading("add-cloud-credits");
    addCloudCreditsMutation.mutate({ userId, credits: Number(credits) });
  };

  const handleResetCloudCredits = async () => {
    const credits = prompt("Set cloud credits to exact amount:");
    if (!credits || isNaN(Number(credits))) return;

    setActionLoading("reset-cloud-credits");
    resetCloudCreditsMutation.mutate({ userId, credits: Number(credits) });
  };

  const handleChangeTier = async () => {
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

    setActionLoading("change-tier");
    changeTierMutation.mutate({
      userId,
      tier: newTier.toUpperCase() as "FREE" | "PRO" | "ENTERPRISE",
    });
  };

  const handleGenerateCustomInvoice = async () => {
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

    setActionLoading("custom-invoice");

    const requestData: any = {
      userId,
      amount: Number(amount),
      description: description.trim(),
    };

    if (dueDate && dueDate.trim() !== "") {
      requestData.dueDate = dueDate.trim();
    }

    generateInvoiceMutation.mutate(requestData);
  };

  console.log("projects de:", projects);
  return (
    <div className="mx-auto max-w-7xl p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="mb-4 flex items-center gap-4">
          <Link
            href="/admin/dashboard"
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            ← Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold">👤 User Details</h1>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{user.name}</h2>
            <p className="text-gray-600">{user.email}</p>
            <p className="text-sm text-gray-500">ID: {user.id}</p>
          </div>

          <button
            onClick={handleGenerateCustomInvoice}
            disabled={actionLoading === "custom-invoice"}
            className="flex items-center gap-2 rounded bg-orange-500 px-4 py-2 text-white hover:bg-orange-600 disabled:bg-orange-300"
          >
            {actionLoading === "custom-invoice" ? "⏳" : "📄"} Generate Custom
            Invoice
          </button>
        </div>
      </div>

      {/* User Stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-5">
        <div className="rounded-lg bg-green-50 p-4">
          <h3 className="font-semibold text-green-800">Builder Credits</h3>
          <div className="text-2xl font-bold text-green-600">
            {user.creditBalance}
          </div>
          <div className="text-sm text-green-700">Current balance</div>
        </div>

        <div className="rounded-lg bg-cyan-50 p-4">
          <h3 className="font-semibold text-cyan-800">Cloud Credits</h3>
          <div className="text-2xl font-bold text-cyan-600">
            {user.cloudCreditBalance ?? 0}
          </div>
          <div className="text-sm text-cyan-700">
            ${((user.cloudCreditBalance ?? 0) / 100).toFixed(2)} value
          </div>
        </div>

        <div className="rounded-lg bg-blue-50 p-4">
          <h3 className="font-semibold text-blue-800">Membership</h3>
          <div className="text-xl font-bold text-blue-600">
            {user.membershipTier}
          </div>
          {user.membershipExpiresAt && (
            <div className="text-sm text-blue-700">
              Expires:{" "}
              {new Date(user.membershipExpiresAt).toISOString().split("T")[0]}
            </div>
          )}
        </div>

        <div className="rounded-lg bg-purple-50 p-4">
          <h3 className="font-semibold text-purple-800">Lifetime Used</h3>
          <div className="text-2xl font-bold text-purple-600">
            {user.lifetimeCreditsUsed || 0}
          </div>
          <div className="text-sm text-purple-700">Total credits used</div>
        </div>

        <div className="rounded-lg bg-yellow-50 p-4">
          <h3 className="font-semibold text-yellow-800">Monthly Used</h3>
          <div className="text-2xl font-bold text-yellow-600">
            {user.monthlyCreditsUsed || 0}
          </div>
          <div className="text-sm text-yellow-700">This month</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-6 rounded-lg bg-white p-6 shadow">
        <h3 className="mb-4 text-lg font-semibold">🎮 Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleAddCredits}
            disabled={actionLoading === "add-credits"}
            className="flex items-center gap-2 rounded bg-green-500 px-4 py-2 text-white hover:bg-green-600 disabled:bg-green-300"
          >
            {actionLoading === "add-credits" ? "⏳" : "💰"} Add Builder Credits
          </button>

          <button
            onClick={handleResetCredits}
            disabled={actionLoading === "reset-credits"}
            className="flex items-center gap-2 rounded bg-yellow-500 px-4 py-2 text-white hover:bg-yellow-600 disabled:bg-yellow-300"
          >
            {actionLoading === "reset-credits" ? "⏳" : "⚡"} Reset Builder Credits
          </button>

          <button
            onClick={handleAddCloudCredits}
            disabled={actionLoading === "add-cloud-credits"}
            className="flex items-center gap-2 rounded bg-cyan-500 px-4 py-2 text-white hover:bg-cyan-600 disabled:bg-cyan-300"
          >
            {actionLoading === "add-cloud-credits" ? "⏳" : "☁️"} Add Cloud Credits
          </button>

          <button
            onClick={handleResetCloudCredits}
            disabled={actionLoading === "reset-cloud-credits"}
            className="flex items-center gap-2 rounded bg-teal-500 px-4 py-2 text-white hover:bg-teal-600 disabled:bg-teal-300"
          >
            {actionLoading === "reset-cloud-credits" ? "⏳" : "🌥️"} Reset Cloud Credits
          </button>

          <button
            onClick={handleChangeTier}
            disabled={actionLoading === "change-tier"}
            className="flex items-center gap-2 rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:bg-blue-300"
          >
            {actionLoading === "change-tier" ? "⏳" : "🔄"} Change Tier
          </button>
        </div>
      </div>

      {/* User Projects */}
      {projects && projects.length > 0 && (
        <div className="mb-6 rounded-lg bg-white shadow">
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                📁 Projects
              </h3>
              <p className="text-sm text-gray-500">
                Recent projects by this user
              </p>
            </div>
            <Link
              href={`/admin/projects?search=${encodeURIComponent(user.email)}`}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              View All →
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Project Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Credits
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Messages
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Advisor Chats
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Last Updated
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {projects.map((project) => (
                  <tr key={project.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {project.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        ID: {project.id.slice(-8)}
                      </div>
                    </td>
                    {/* credits */}
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <Badge
                        variant="outline"
                        className="flex w-fit items-center gap-1"
                      >
                        <Gem className="h-3 w-3" />{" "}
                        {project?.stats?.transactions?.creditsUsed || 0}
                      </Badge>
                    </td>

                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className="flex w-fit items-center gap-1"
                      >
                        <MessageSquare className="h-3 w-3" />
                        {project._count.messages}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className="flex w-fit items-center gap-1"
                      >
                        <Sparkles className="h-3 w-3" />
                        {project._count.halChatMessages}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(project.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/projects/${project.id}?from=user&userId=${encodeURIComponent(userId)}`}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        View Details →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Shipper Cloud Projects */}
      {shipperCloudData && shipperCloudData.projects.length > 0 && (
        <div className={`mb-6 rounded-lg bg-white shadow transition-opacity ${isShipperCloudFetching ? "opacity-60" : ""}`}>
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <div className="flex items-center gap-3">
              <Cloud className="h-5 w-5 text-cyan-600" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Shipper Cloud Projects
                </h3>
                <p className="text-sm text-gray-500">
                  {shipperCloudData.summary.totalProjects} project{shipperCloudData.summary.totalProjects !== 1 ? 's' : ''} using Shipper Cloud
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-cyan-600">
                ${shipperCloudData.summary.totalUsd}
              </div>
              <div className="text-sm text-gray-500">
                {shipperCloudData.summary.totalCredits.toFixed(2)} credits
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-100">
            {shipperCloudData.projects.map((project) => {
              const isExpanded = expandedShipperCloudProjects.has(project.projectId);
              return (
                <div key={project.projectId} className="px-6 py-4">
                  <button
                    onClick={() => toggleShipperCloudProject(project.projectId)}
                    className="flex w-full items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      )}
                      <div>
                        <span className="font-medium text-gray-900">
                          {project.projectName}
                        </span>
                        <span
                          className={`ml-2 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                            project.status === "ACTIVE"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {project.status}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-gray-900">
                        ${project.totalUsd}
                      </div>
                      <div className="text-xs text-gray-500">
                        {project.totalCredits.toFixed(2)} credits
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="ml-7 mt-4 space-y-4">
                      {/* Billing Period */}
                      {project.periodStart && project.periodEnd && (
                        <div className="text-sm text-gray-500">
                          Billing Period:{" "}
                          {new Date(project.periodStart).toLocaleDateString()} -{" "}
                          {new Date(project.periodEnd).toLocaleDateString()}
                        </div>
                      )}

                      {/* Usage Breakdown */}
                      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
                        <div className="rounded-lg bg-gray-50 p-3">
                          <div className="text-xs text-gray-500">Function Calls</div>
                          <div className="font-medium text-gray-900">
                            {project.breakdown.functionCalls.usageFormatted}
                          </div>
                          <div className="text-xs text-cyan-600">
                            ${(project.breakdown.functionCalls.credits / 100).toFixed(4)}
                          </div>
                        </div>
                        <div className="rounded-lg bg-gray-50 p-3">
                          <div className="text-xs text-gray-500">Action Compute</div>
                          <div className="font-medium text-gray-900">
                            {project.breakdown.actionCompute.usageFormatted}
                          </div>
                          <div className="text-xs text-cyan-600">
                            ${(project.breakdown.actionCompute.credits / 100).toFixed(4)}
                          </div>
                        </div>
                        <div className="rounded-lg bg-gray-50 p-3">
                          <div className="text-xs text-gray-500">DB Bandwidth</div>
                          <div className="font-medium text-gray-900">
                            {project.breakdown.databaseBandwidth.usageFormatted}
                          </div>
                          <div className="text-xs text-cyan-600">
                            ${(project.breakdown.databaseBandwidth.credits / 100).toFixed(4)}
                          </div>
                        </div>
                        <div className="rounded-lg bg-gray-50 p-3">
                          <div className="text-xs text-gray-500">File Bandwidth</div>
                          <div className="font-medium text-gray-900">
                            {project.breakdown.fileBandwidth.usageFormatted}
                          </div>
                          <div className="text-xs text-cyan-600">
                            ${(project.breakdown.fileBandwidth.credits / 100).toFixed(4)}
                          </div>
                        </div>
                        <div className="rounded-lg bg-gray-50 p-3">
                          <div className="text-xs text-gray-500">Vector Bandwidth</div>
                          <div className="font-medium text-gray-900">
                            {project.breakdown.vectorBandwidth.usageFormatted}
                          </div>
                          <div className="text-xs text-cyan-600">
                            ${(project.breakdown.vectorBandwidth.credits / 100).toFixed(4)}
                          </div>
                        </div>
                      </div>

                      {/* View Project Link */}
                      <div className="flex justify-end">
                        <Link
                          href={`/admin/projects/${project.projectId}?from=user&userId=${encodeURIComponent(userId)}`}
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          View Project Details →
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {shipperCloudData.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
              <div className="text-sm text-gray-500">
                Showing {((shipperCloudData.pagination.page - 1) * shipperCloudData.pagination.limit) + 1} to{" "}
                {Math.min(shipperCloudData.pagination.page * shipperCloudData.pagination.limit, shipperCloudData.pagination.totalCount)} of{" "}
                {shipperCloudData.pagination.totalCount} projects
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShipperCloudPage((p) => Math.max(1, p - 1))}
                  disabled={!shipperCloudData.pagination.hasPrevPage || isShipperCloudFetching}
                  className="flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>
                <span className="text-sm text-gray-600">
                  Page {shipperCloudData.pagination.page} of {shipperCloudData.pagination.totalPages}
                  {isShipperCloudFetching && " ..."}
                </span>
                <button
                  onClick={() => setShipperCloudPage((p) => Math.min(shipperCloudData.pagination.totalPages, p + 1))}
                  disabled={!shipperCloudData.pagination.hasNextPage || isShipperCloudFetching}
                  className="flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Transaction Statistics */}
      <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-lg bg-white p-6 shadow">
          <h3 className="mb-4 text-lg font-semibold text-black">
            📊 Transaction Stats
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-black">Total Transactions:</span>
              <span className="font-semibold">
                {userData.stats.transactions.totalTransactions}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-black">Credits Purchased:</span>
              <span className="font-semibold text-green-600">
                +{userData.stats.transactions.creditsPurchased}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-black">Credits Used:</span>
              <span className="font-semibold text-red-600">
                -{userData.stats.transactions.creditsUsed}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-black">Monthly Allocations:</span>
              <span className="font-semibold text-blue-600">
                +{userData.stats.transactions.monthlyAllocations}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-black">Admin Adjustments:</span>
              <span className="font-semibold text-purple-600">
                {userData.stats.transactions.adminAdjustments >= 0 ? "+" : ""}
                {userData.stats.transactions.adminAdjustments}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <h3 className="mb-4 text-lg font-semibold text-black">
            💳 Purchase Stats
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-black">Total Purchases:</span>
              <span className="font-semibold">
                {userData.stats.purchases.totalPurchases}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-black">Total Spent:</span>
              <span className="font-semibold text-green-600">
                ${(userData.stats.purchases.totalSpent / 100).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-black">Credits Purchased:</span>
              <span className="font-semibold text-blue-600">
                {userData.stats.purchases.totalCreditsPurchased}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-black">Avg. Per Purchase:</span>
              <span className="font-semibold">
                $
                {userData.stats.purchases.totalPurchases > 0
                  ? (
                      userData.stats.purchases.totalSpent /
                      100 /
                      userData.stats.purchases.totalPurchases
                    ).toFixed(2)
                  : "0.00"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Subscription Info */}
      {subscription && (
        <div className="mb-6 rounded-lg bg-white p-6 shadow">
          <h3 className="mb-4 text-lg font-semibold">
            💳 Subscription Details
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p>
                <strong>Status:</strong> {subscription.status}
              </p>
              <p>
                <strong>Plan:</strong> {subscription.planName || "N/A"}
              </p>
              <p>
                <strong>Created:</strong>{" "}
                {new Date(subscription.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p>
                <strong>Current Period End:</strong>{" "}
                {subscription.currentPeriodEnd
                  ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
                  : "N/A"}
              </p>
              <p>
                <strong>Cancel At Period End:</strong>{" "}
                {subscription.cancelAtPeriodEnd ? "Yes" : "No"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Transactions Table */}
      <div className="mb-6 overflow-hidden rounded-lg bg-white shadow">
        <div className="border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">
            🧾 Recent Transactions
          </h3>
          <p className="text-sm text-gray-600">
            Click &apos;📄&apos; to generate invoice based on transaction
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="min-w-[150px] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Date
                </th>
                <th className="min-w-[150px] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Type
                </th>
                <th className="min-w-[150px] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Amount
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Description
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {transactions.map((transaction) => {
                const message = getTransactionMessage(transaction);

                const descriptionText = getTransactionDescription(
                  transaction,
                  message,
                );

                return (
                  <tr key={transaction.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(transaction.createdAt).toLocaleDateString()}
                      <div className="text-xs text-gray-500">
                        {new Date(transaction.createdAt).toLocaleTimeString()}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getTransactionTypeStyle(getDisplayType(transaction))}`}
                      >
                        {getDisplayType(transaction)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-semibold ${transaction.amount >= 0 ? "text-green-600" : "text-red-600"}`}
                      >
                        {transaction.amount > 0 ? "+" : ""}
                        {transaction.amount}
                      </span>
                      <div className="text-xs text-gray-500">credits</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {descriptionText ? (
                        (() => {
                          const meta = transaction.metadata as any;
                          const projectId = meta?.projectId as
                            | string
                            | undefined;
                          const assistantMessageId = meta?.messageId as
                            | string
                            | undefined;

                          // Get the previous user message ID from the lookup
                          const lookupEntry = assistantMessageId
                            ? (
                                messageLookup as Record<string, any> | undefined
                              )?.[assistantMessageId]
                            : undefined;
                          const userMessageId =
                            typeof lookupEntry === "object"
                              ? lookupEntry?.previousUserMessage?.id
                              : undefined;

                          // Use the user message ID if available, otherwise fall back to assistant message ID
                          const targetMessageId =
                            userMessageId || assistantMessageId;

                          // If we have projectId, make it a clickable link
                          if (projectId) {
                            const href = targetMessageId
                              ? `/admin/projects/${projectId}?messageId=${encodeURIComponent(targetMessageId)}&from=user&userId=${encodeURIComponent(userId)}`
                              : `/admin/projects/${projectId}?from=user&userId=${encodeURIComponent(userId)}`;

                            return (
                              <Link
                                href={href}
                                className="group -m-1 block rounded p-1 transition-colors hover:bg-blue-50"
                                title="Click to view full user message in project details"
                              >
                                <div className="text-xs text-gray-700 group-hover:text-blue-700">
                                  <span className="font-semibold text-gray-700 group-hover:text-blue-800">
                                    User Prompt:
                                  </span>{" "}
                                  {descriptionText}
                                  <span className="ml-1 text-blue-500 opacity-0 transition-opacity group-hover:opacity-100">
                                    →
                                  </span>
                                </div>
                              </Link>
                            );
                          }

                          // No projectId, just display text
                          return (
                            <div className="text-xs text-gray-700">
                              <span className="font-semibold text-gray-700">
                                User Prompt:
                              </span>{" "}
                              {descriptionText}
                            </div>
                          );
                        })()
                      ) : (
                        <span className="text-xs text-gray-500">
                          No description
                        </span>
                      )}
                      {transaction.metadata &&
                        Object.keys(transaction.metadata).length > 0 && (
                          <div className="mt-1 text-xs text-gray-500">
                            <details className="cursor-pointer">
                              <summary>View metadata</summary>
                              <pre className="mt-1 max-h-32 overflow-auto rounded bg-gray-50 p-2 text-xs">
                                {JSON.stringify(transaction.metadata, null, 2)}
                              </pre>
                            </details>
                          </div>
                        )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() =>
                          handleGenerateInvoiceFromTransaction(transaction)
                        }
                        disabled={actionLoading === `invoice-${transaction.id}`}
                        className="rounded bg-orange-500 px-2 py-1 text-xs text-white hover:bg-orange-600 disabled:bg-orange-300"
                        title="Generate invoice based on this transaction"
                      >
                        {actionLoading === `invoice-${transaction.id}`
                          ? "⏳"
                          : "📄"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Purchases Table */}
      {purchases.length > 0 && (
        <div className="overflow-hidden rounded-lg bg-white shadow">
          <div className="border-b border-gray-200 px-6 py-4">
            <h3 className="text-lg font-semibold text-gray-900">
              💳 Recent Purchases
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Credits
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Amount Paid
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Payment ID
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {purchases.map((purchase) => (
                  <tr key={purchase.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(purchase.createdAt).toLocaleDateString()}
                      <div className="text-xs text-gray-500">
                        {new Date(purchase.createdAt).toLocaleTimeString()}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-green-600">
                        {purchase.credits}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold">
                        ${(purchase.amountPaid / 100).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                          purchase.status === "COMPLETED"
                            ? "bg-green-100 text-green-800"
                            : purchase.status === "PENDING"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                        }`}
                      >
                        {purchase.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-gray-500">
                      {purchase.stripePaymentId?.slice(-12) || "N/A"}...
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function UserDetailClient({ userId }: { userId: string }) {
  return (
    <Suspense fallback={<div className="p-8">Loading user details...</div>}>
      <UserDetailContent userId={userId} />
    </Suspense>
  );
}
