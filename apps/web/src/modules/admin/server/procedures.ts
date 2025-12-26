import { protectedProcedure, createTRPCRouter } from "@/trpc/init";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { getTierById } from "@/lib/pricing";
import { isAdminEmail, ADMIN_ACCESS_DENIED_MESSAGE } from "@/lib/admin";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

// Lightning-fast admin procedure using environment-based admin access control
const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!isAdminEmail(ctx.user.email)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: ADMIN_ACCESS_DENIED_MESSAGE,
    });
  }
  return next({
    ctx: {
      ...ctx,
      adminEmail: ctx.user.email!,
    },
  });
});

/**
 * Helper function to ensure a Modal sandbox exists for a project
 * Creates one if it doesn't exist
 */
async function ensureModalSandbox(projectId: string): Promise<string> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      sandboxId: true, // Modal uses sandboxId
      daytonaSandboxId: true, // Daytona uses daytonaSandboxId
      sandboxProvider: true,
      activeFragmentId: true,
    },
  });

  if (!project) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Project not found",
    });
  }

  const provider = project.sandboxProvider || "modal";

  // For Daytona projects
  if (provider !== "modal") {
    if (!project.daytonaSandboxId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No sandbox found for this project",
      });
    }
    return project.daytonaSandboxId;
  }

  // For Modal projects - check sandboxId field
  if (project.sandboxId) {
    return project.sandboxId;
  }

  // Create new Modal sandbox
  console.log("[Admin] Auto-creating Modal sandbox for project:", projectId);

  const { modalAPI } = await import("@/lib/api/modal-client");

  try {
    const sandboxInfo = await modalAPI.createSandbox(
      projectId,
      project.activeFragmentId,
      "vite",
    );

    console.log("[Admin] Modal sandbox created:", sandboxInfo.sandboxId);
    return sandboxInfo.sandboxId;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[Admin] Failed to create Modal sandbox:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to create sandbox: ${errorMsg}`,
    });
  }
}

export const adminRouter = createTRPCRouter({
  // Get all users with stats (paginated)
  getAllUsers: adminProcedure
    .input(
      z
        .object({
          page: z.number().min(1).default(1),
          limit: z.number().min(1).max(100).default(20),
          search: z.string().optional(),
          membershipFilter: z
            .enum(["ALL", "FREE", "NON_FREE", "PRO", "ENTERPRISE"])
            .default("ALL"),
        })
        .optional()
        .default({
          page: 1,
          limit: 20,
          membershipFilter: "ALL" as const,
        }),
    )
    .query(async ({ input }) => {
      const { page = 1, limit = 20, search, membershipFilter = "ALL" } = input;
      const skip = (page - 1) * limit;

      // Build where clause for search and membership filter
      const where: any = {};

      // Add search conditions
      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
          { id: { contains: search, mode: "insensitive" as const } },
        ];
      }

      // Add membership filter conditions
      if (membershipFilter === "FREE") {
        where.membershipTier = "FREE";
      } else if (membershipFilter === "NON_FREE") {
        where.membershipTier = {
          in: ["PRO", "ENTERPRISE"],
        };
      } else if (membershipFilter === "PRO") {
        where.membershipTier = "PRO";
      } else if (membershipFilter === "ENTERPRISE") {
        where.membershipTier = "ENTERPRISE";
      }
      // If "ALL", no additional filter is applied

      // Get total count for pagination
      const totalCount = await prisma.user.count({ where });

      // Get paginated users
      const users = await prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          creditBalance: true,
          cloudCreditBalance: true,
          membershipTier: true,
          membershipExpiresAt: true,
          stripeCustomerId: true,
          stripeSubscriptionId: true,
          createdAt: true,
          lastCreditReset: true,
          monthlyCreditsUsed: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
      });

      const totalPages = Math.ceil(totalCount / limit);

      return {
        users,
        total: totalCount,
        totalPages,
        currentPage: page,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      };
    }),

  // Get admin dashboard stats
  getStats: adminProcedure.query(async () => {
    const [
      totalUsersCount,
      totalCreditsResult,
      proUsersCount,
      enterpriseUsersCount,
      withSubscriptionsCount,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.aggregate({
        _sum: {
          creditBalance: true,
        },
      }),
      prisma.user.count({
        where: {
          membershipTier: "PRO",
        },
      }),
      prisma.user.count({
        where: {
          membershipTier: "ENTERPRISE",
        },
      }),
      prisma.user.count({
        where: {
          stripeSubscriptionId: {
            not: null,
          },
        },
      }),
    ]);

    return {
      totalUsers: totalUsersCount,
      totalCredits: totalCreditsResult._sum.creditBalance || 0,
      proUsers: proUsersCount,
      enterpriseUsers: enterpriseUsersCount,
      withSubscriptions: withSubscriptionsCount,
    };
  }),

  // Get detailed user information
  getUserDetails: adminProcedure
    .input(
      z.object({
        userId: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const { userId } = input;

      // Get user details
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          creditBalance: true,
          cloudCreditBalance: true,
          membershipTier: true,
          membershipExpiresAt: true,
          stripeCustomerId: true,
          stripeSubscriptionId: true,
          lastCreditReset: true,
          monthlyCreditsUsed: true,
          lifetimeCreditsUsed: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      // Get recent transactions (last 50)
      const transactions = await prisma.creditTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          amount: true,
          type: true,
          description: true,
          metadata: true,
          createdAt: true,
        },
      });

      // Get recent purchases (last 20)
      const purchases = await prisma.creditPurchase.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          credits: true,
          amountPaid: true,
          stripePaymentId: true,
          status: true,
          metadata: true,
          createdAt: true,
        },
      });

      // Get subscription details if exists
      let subscription = null;
      if (user.stripeSubscriptionId) {
        subscription = await prisma.subscription.findUnique({
          where: { stripeSubscriptionId: user.stripeSubscriptionId },
          select: {
            id: true,
            stripeSubscriptionId: true,
            stripePriceId: true,
            stripeCurrentPeriodEnd: true,
            stripeCancelAtPeriodEnd: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        });
      }

      // Calculate transaction statistics
      const transactionStats = {
        totalTransactions: transactions.length,
        creditsPurchased: transactions
          .filter((t) => t.type === "PURCHASE")
          .reduce((sum, t) => sum + t.amount, 0),
        creditsUsed: transactions
          .filter((t) => t.amount < 0)
          .reduce((sum, t) => sum + Math.abs(t.amount), 0),
        monthlyAllocations: transactions
          .filter((t) => t.type === "MONTHLY_ALLOCATION")
          .reduce((sum, t) => sum + t.amount, 0),
        adminAdjustments: transactions
          .filter((t) => t.type === "BONUS" || t.type === "REFUND")
          .reduce((sum, t) => sum + t.amount, 0),
      };

      // Purchase statistics
      const purchaseStats = {
        totalPurchases: purchases.length,
        totalSpent: purchases
          .filter((p) => p.status === "COMPLETED")
          .reduce((sum, p) => sum + p.amountPaid, 0),
        totalCreditsPurchased: purchases
          .filter((p) => p.status === "COMPLETED")
          .reduce((sum, p) => sum + p.credits, 0),
      };

      // Aggregate credits used per project for this user from metadata.projectId
      const projectUsage = new Map<string, number>();
      for (const tx of transactions) {
        if (tx.amount >= 0) continue; // only usage
        const projectId = (tx.metadata as any)?.projectId as string | undefined;
        if (!projectId) continue;
        projectUsage.set(
          projectId,
          (projectUsage.get(projectId) || 0) + Math.abs(tx.amount),
        );
      }

      // Get user's projects with message counts
      const projects = await prisma.project.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              messages: true,
              v2Messages: true,
              halChatMessages: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 10, // Get last 10 projects
      });

      // Combine message counts for display
      const projectsWithCombinedCounts = projects.map((project) => ({
        ...project,
        _count: {
          messages: project._count.messages + project._count.v2Messages,
          halChatMessages: project._count.halChatMessages,
        },
        stats: {
          transactions: {
            creditsUsed: projectUsage.get(project.id) || 0,
          },
        },
      }));

      return {
        user,
        transactions,
        purchases,
        subscription,
        projects: projectsWithCombinedCounts,
        stats: {
          transactions: transactionStats,
          purchases: purchaseStats,
        },
      };
    }),

  /**
   * Get Shipper Cloud projects for a user with billing breakdown (paginated)
   */
  getUserShipperCloudProjects: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(20).default(5),
      }),
    )
    .query(async ({ input }) => {
      const { userId, page, limit } = input;
      const offset = (page - 1) * limit;

      // Shipper Cloud pricing rates (in credits, where 1 credit = $0.01)
      const SHIPPER_RATES = {
        functionCallsPerMillion: 300, // $3.00 per million
        actionComputePerGBHour: 45, // $0.45 per GB-hour
        databaseBandwidthPerGB: 30, // $0.30 per GB
        fileBandwidthPerGB: 45, // $0.45 per GB
        vectorBandwidthPerGB: 15, // $0.15 per GB
      };

      const BYTES_PER_GB = 1024 * 1024 * 1024;
      const MS_PER_HOUR = 3600000;
      const MB_PER_GB = 1024;
      const MEMORY_MB = 128;

      // Get total count for pagination
      const totalCount = await prisma.project.count({
        where: {
          userId,
          shipperCloudEnabled: true,
          convexDeployment: { isNot: null },
        },
      });

      // Get paginated projects for this user that have Shipper Cloud enabled
      const projects = await prisma.project.findMany({
        where: {
          userId,
          shipperCloudEnabled: true,
        },
        select: {
          id: true,
          name: true,
          convexDeployment: {
            select: {
              id: true,
              status: true,
              currentPeriodStart: true,
              currentPeriodEnd: true,
              creditsUsedThisPeriod: true,
              totalFunctionCalls: true,
              totalActionComputeMs: true,
              totalDatabaseBandwidthBytes: true,
              totalFileBandwidthBytes: true,
              totalVectorBandwidthBytes: true,
              documentStorageBytes: true,
              indexStorageBytes: true,
              fileStorageBytes: true,
              vectorStorageBytes: true,
              backupStorageBytes: true,
              lastUsageAt: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        skip: offset,
        take: limit,
      });

      // Get all projects for total credits calculation (summary)
      const allProjects = await prisma.project.findMany({
        where: {
          userId,
          shipperCloudEnabled: true,
        },
        select: {
          convexDeployment: {
            select: {
              creditsUsedThisPeriod: true,
            },
          },
        },
      });

      const totalCredits = allProjects
        .filter((p) => p.convexDeployment)
        .reduce((sum, p) => sum + (p.convexDeployment?.creditsUsedThisPeriod ?? 0), 0);

      // Process each project with billing breakdown
      const projectsWithBilling = projects
        .filter((p) => p.convexDeployment)
        .map((project) => {
          const d = project.convexDeployment!;

          const functionCalls = Number(d.totalFunctionCalls);
          const actionComputeMs = Number(d.totalActionComputeMs);
          const databaseBandwidth = Number(d.totalDatabaseBandwidthBytes);
          const fileBandwidth = Number(d.totalFileBandwidthBytes);
          const vectorBandwidth = Number(d.totalVectorBandwidthBytes);

          // Calculate credits for each meter
          const functionCallsCredits =
            (functionCalls / 1_000_000) * SHIPPER_RATES.functionCallsPerMillion;
          const actionComputeCredits =
            (MEMORY_MB / MB_PER_GB) *
            (actionComputeMs / MS_PER_HOUR) *
            SHIPPER_RATES.actionComputePerGBHour;
          const databaseBandwidthCredits =
            (databaseBandwidth / BYTES_PER_GB) * SHIPPER_RATES.databaseBandwidthPerGB;
          const fileBandwidthCredits =
            (fileBandwidth / BYTES_PER_GB) * SHIPPER_RATES.fileBandwidthPerGB;
          const vectorBandwidthCredits =
            (vectorBandwidth / BYTES_PER_GB) * SHIPPER_RATES.vectorBandwidthPerGB;

          return {
            projectId: project.id,
            projectName: project.name,
            deploymentId: d.id,
            status: d.status,
            periodStart: d.currentPeriodStart?.toISOString() ?? null,
            periodEnd: d.currentPeriodEnd?.toISOString() ?? null,
            lastUsageAt: d.lastUsageAt?.toISOString() ?? null,
            totalCredits: d.creditsUsedThisPeriod,
            totalUsd: (d.creditsUsedThisPeriod / 100).toFixed(2),
            breakdown: {
              functionCalls: {
                usage: functionCalls,
                usageFormatted:
                  functionCalls < 1000
                    ? `${functionCalls} calls`
                    : functionCalls < 1_000_000
                      ? `${(functionCalls / 1000).toFixed(1)}K`
                      : `${(functionCalls / 1_000_000).toFixed(3)}M`,
                credits: functionCallsCredits,
              },
              actionCompute: {
                usage: actionComputeMs,
                usageFormatted: `${((MEMORY_MB / MB_PER_GB) * (actionComputeMs / MS_PER_HOUR)).toFixed(4)} GB-hrs`,
                credits: actionComputeCredits,
              },
              databaseBandwidth: {
                usage: databaseBandwidth,
                usageFormatted: `${(databaseBandwidth / BYTES_PER_GB).toFixed(4)} GB`,
                credits: databaseBandwidthCredits,
              },
              fileBandwidth: {
                usage: fileBandwidth,
                usageFormatted: `${(fileBandwidth / BYTES_PER_GB).toFixed(4)} GB`,
                credits: fileBandwidthCredits,
              },
              vectorBandwidth: {
                usage: vectorBandwidth,
                usageFormatted: `${(vectorBandwidth / BYTES_PER_GB).toFixed(4)} GB`,
                credits: vectorBandwidthCredits,
              },
            },
            storage: {
              document: Number(d.documentStorageBytes),
              index: Number(d.indexStorageBytes),
              file: Number(d.fileStorageBytes),
              vector: Number(d.vectorStorageBytes),
              backup: Number(d.backupStorageBytes),
            },
          };
        });

      const totalPages = Math.ceil(totalCount / limit);

      return {
        projects: projectsWithBilling,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
        summary: {
          totalProjects: totalCount,
          totalCredits,
          totalUsd: (totalCredits / 100).toFixed(2),
        },
      };
    }),

  getMessagesByIds: adminProcedure
    .input(z.object({ messageIds: z.array(z.string().min(1)).min(1) }))
    .query(async ({ input }) => {
      const uniqueIds = Array.from(new Set(input.messageIds));

      const [messages, v2Messages, halMessages] = await prisma.$transaction([
        prisma.message.findMany({
          where: { id: { in: uniqueIds } },
          select: {
            id: true,
            content: true,
            role: true,
            projectId: true,
            createdAt: true,
          },
        }),
        prisma.v2Message.findMany({
          where: { id: { in: uniqueIds } },
          select: {
            id: true,
            content: true,
            role: true,
            projectId: true,
            createdAt: true,
          },
        }),
        prisma.halChatMessage.findMany({
          where: { id: { in: uniqueIds } },
          select: {
            id: true,
            content: true,
            parts: true,
            role: true,
            projectId: true,
            createdAt: true,
          },
        }),
      ]);

      const result: Record<
        string,
        {
          content: string;
          role?: string | null;
          projectId?: string | null;
          createdAt?: string;
          previousUserMessage?: {
            id: string;
            content: string;
            createdAt?: string;
          } | null;
        }
      > = {};

      const appendPreviousUser = async (
        key: string,
        data: {
          content: string;
          role?: string | null;
          projectId?: string | null;
          createdAt?: Date;
        },
        finder: () => Promise<{ id: string; content: string; createdAt: Date } | null>,
      ) => {
        const previousUserMessage = await finder();

        result[key] = {
          content: data.content,
          role: data.role,
          projectId: data.projectId,
          createdAt: data.createdAt?.toISOString(),
          previousUserMessage: previousUserMessage
            ? {
              id: previousUserMessage.id,
              content: previousUserMessage.content,
              createdAt: previousUserMessage.createdAt.toISOString(),
            }
            : null,
        };
      };

      await Promise.all(
        messages.map((msg) =>
          appendPreviousUser(
            msg.id,
            msg,
            async () => {
              if (!msg.projectId) return null;
              return prisma.message.findFirst({
                where: {
                  projectId: msg.projectId,
                  role: "USER",
                  createdAt: { lt: msg.createdAt },
                },
                orderBy: { createdAt: "desc" },
                select: { id: true, content: true, createdAt: true },
              });
            },
          ),
        ),
      );

      await Promise.all(
        v2Messages.map((msg) =>
          appendPreviousUser(
            msg.id,
            msg,
            async () => {
              if (!msg.projectId) return null;
              return prisma.v2Message.findFirst({
                where: {
                  projectId: msg.projectId,
                  role: "USER",
                  createdAt: { lt: msg.createdAt },
                },
                orderBy: { createdAt: "desc" },
                select: { id: true, content: true, createdAt: true },
              });
            },
          ),
        ),
      );

      await Promise.all(
        halMessages.map((msg) => {
          const contentFromParts = () => {
            if (msg.content) return msg.content;
            if (!Array.isArray(msg.parts) || msg.parts.length === 0) return "";
            return (msg.parts as any[])
              .map((part) => (typeof part === "string" ? part : (part as any)?.text || ""))
              .filter(Boolean)
              .join("\n");
          };

          return appendPreviousUser(
            msg.id,
            {
              ...msg,
              content: contentFromParts(),
            },
            async () => {
              if (!msg.projectId) return null;
              return prisma.halChatMessage.findFirst({
                where: {
                  projectId: msg.projectId,
                  role: "user",
                  createdAt: { lt: msg.createdAt },
                },
                orderBy: { createdAt: "desc" },
                select: { id: true, content: true, createdAt: true },
              });
            },
          );
        }),
      );

      return result;
    }),

  // Aggregate credit usage by project from transaction metadata
  getProjectCreditUsage: adminProcedure
    .input(
      z
        .object({
          maxTransactions: z.number().min(100).max(10000).default(2000),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const maxTransactions = input?.maxTransactions ?? 2000;

      const transactions = await prisma.creditTransaction.findMany({
        where: { amount: { lt: 0 } },
        select: { amount: true, metadata: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: maxTransactions,
      });

      const usageByProject = new Map<
        string,
        { creditsUsed: number; lastUsedAt: Date; txCount: number }
      >();

      for (const tx of transactions) {
        const projectId = (tx.metadata as any)?.projectId as string | undefined;
        if (!projectId) continue;

        const current =
          usageByProject.get(projectId) ||
          ({ creditsUsed: 0, lastUsedAt: tx.createdAt, txCount: 0 } as const);

        usageByProject.set(projectId, {
          creditsUsed: current.creditsUsed + Math.abs(tx.amount),
          lastUsedAt:
            tx.createdAt > current.lastUsedAt ? tx.createdAt : current.lastUsedAt,
          txCount: current.txCount + 1,
        });
      }

      return Array.from(usageByProject.entries()).map(([projectId, data]) => ({
        projectId,
        creditsUsed: data.creditsUsed,
        lastUsedAt: data.lastUsedAt,
        transactionCount: data.txCount,
      }));
    }),

  // Add credits to user
  addCredits: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        credits: z.number().min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { userId, credits } = input;

      // Get target user
      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          creditBalance: true,
        },
      });

      if (!targetUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      // Add credits using a transaction
      await prisma.$transaction([
        // Update user credit balance
        prisma.user.update({
          where: { id: userId },
          data: {
            creditBalance: { increment: credits },
          },
        }),

        // Log the transaction
        prisma.creditTransaction.create({
          data: {
            userId,
            amount: credits,
            type: "BONUS",
            description: `Admin manually added ${credits} credits`,
            metadata: {
              adminEmail: ctx.adminEmail,
              reason: "Manual admin adjustment",
              originalBalance: targetUser.creditBalance,
            },
          },
        }),
      ]);

      const newBalance = targetUser.creditBalance + credits;

      return {
        success: true,
        message: `Added ${credits} credits to ${targetUser.email}`,
        targetUser: targetUser.email,
        creditsAdded: credits,
        previousBalance: targetUser.creditBalance,
        newBalance: newBalance,
        adminEmail: ctx.adminEmail,
      };
    }),

  // Reset credits to exact amount
  resetCredits: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        credits: z.number().min(0),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { userId, credits } = input;

      // Get target user
      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          creditBalance: true,
        },
      });

      if (!targetUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      const difference = credits - targetUser.creditBalance;

      // Reset credits using a transaction
      await prisma.$transaction([
        // Set user credit balance to exact amount
        prisma.user.update({
          where: { id: userId },
          data: {
            creditBalance: credits,
          },
        }),

        // Log the transaction
        prisma.creditTransaction.create({
          data: {
            userId,
            amount: difference, // This will be positive or negative
            type: difference >= 0 ? "BONUS" : "REFUND",
            description: `Admin reset credits from ${targetUser.creditBalance
              } to ${credits} (${difference >= 0 ? "+" : ""}${difference})`,
            metadata: {
              adminEmail: ctx.adminEmail,
              reason: "Admin credit reset",
              originalBalance: targetUser.creditBalance,
              newBalance: credits,
              difference: difference,
            },
          },
        }),
      ]);

      return {
        success: true,
        message: `Reset credits to ${credits} for ${targetUser.email}`,
        targetUser: targetUser.email,
        previousBalance: targetUser.creditBalance,
        newBalance: credits,
        difference: difference,
        adminEmail: ctx.adminEmail,
      };
    }),

  // Add cloud credits to user
  addCloudCredits: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        credits: z.number().min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { userId, credits } = input;

      // Get target user
      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          cloudCreditBalance: true,
        },
      });

      if (!targetUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      // Add cloud credits using a transaction
      await prisma.$transaction([
        // Update user cloud credit balance
        prisma.user.update({
          where: { id: userId },
          data: {
            cloudCreditBalance: { increment: credits },
          },
        }),

        // Log the transaction
        prisma.cloudCreditTransaction.create({
          data: {
            userId,
            amount: credits,
            type: "PROMOTIONAL",
            description: `Admin manually added ${credits} cloud credits`,
            metadata: {
              adminEmail: ctx.adminEmail,
              reason: "Manual admin adjustment",
              originalBalance: targetUser.cloudCreditBalance,
            },
          },
        }),
      ]);

      const newBalance = targetUser.cloudCreditBalance + credits;

      return {
        success: true,
        message: `Added ${credits} cloud credits to ${targetUser.email}`,
        targetUser: targetUser.email,
        creditsAdded: credits,
        previousBalance: targetUser.cloudCreditBalance,
        newBalance: newBalance,
        adminEmail: ctx.adminEmail,
      };
    }),

  // Reset cloud credits to exact amount
  resetCloudCredits: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        credits: z.number().min(0),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { userId, credits } = input;

      // Get target user
      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          cloudCreditBalance: true,
        },
      });

      if (!targetUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      const difference = credits - targetUser.cloudCreditBalance;

      // Reset cloud credits using a transaction
      await prisma.$transaction([
        // Set user cloud credit balance to exact amount
        prisma.user.update({
          where: { id: userId },
          data: {
            cloudCreditBalance: credits,
          },
        }),

        // Log the transaction
        prisma.cloudCreditTransaction.create({
          data: {
            userId,
            amount: difference, // This will be positive or negative
            type: difference >= 0 ? "PROMOTIONAL" : "REFUND",
            description: `Admin reset cloud credits from ${targetUser.cloudCreditBalance} to ${credits} (${difference >= 0 ? "+" : ""}${difference})`,
            metadata: {
              adminEmail: ctx.adminEmail,
              reason: "Admin cloud credit reset",
              originalBalance: targetUser.cloudCreditBalance,
              newBalance: credits,
              difference: difference,
            },
          },
        }),
      ]);

      return {
        success: true,
        message: `Reset cloud credits to ${credits} for ${targetUser.email}`,
        targetUser: targetUser.email,
        previousBalance: targetUser.cloudCreditBalance,
        newBalance: credits,
        difference: difference,
        adminEmail: ctx.adminEmail,
      };
    }),

  // Get all deployments
  getAllDeployments: adminProcedure
    .input(
      z
        .object({
          page: z.number().min(1).default(1),
          limit: z.number().min(1).max(100).default(20),
          search: z.string().optional(),
          publishedFilter: z
            .enum(["ALL", "PUBLISHED", "UNPUBLISHED"])
            .default("ALL"),
        })
        .optional()
        .default({
          page: 1,
          limit: 20,
          publishedFilter: "ALL" as const,
        }),
    )
    .query(async ({ input }) => {
      const { page = 1, limit = 20, search, publishedFilter = "ALL" } = input;
      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = {};

      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { appId: { contains: search, mode: "insensitive" } },
          { projectId: { contains: search, mode: "insensitive" } },
          { url: { contains: search, mode: "insensitive" } },
        ];
      }

      if (publishedFilter !== "ALL") {
        where.published = publishedFilter === "PUBLISHED";
      }

      // Get deployments with pagination
      const [deployments, totalCount] = await Promise.all([
        prisma.deployment.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            project: {
              select: {
                id: true,
                name: true,
              },
            },
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        }),
        prisma.deployment.count({ where }),
      ]);

      const totalPages = Math.ceil(totalCount / limit);

      return {
        deployments,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      };
    }),

  // Toggle deployment published status
  toggleDeploymentPublished: adminProcedure
    .input(
      z.object({
        deploymentId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { deploymentId } = input;

      const deployment = await prisma.deployment.findUnique({
        where: { id: deploymentId },
      });

      if (!deployment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Deployment not found",
        });
      }

      const updated = await prisma.deployment.update({
        where: { id: deploymentId },
        data: { published: !deployment.published },
      });

      console.log(
        `[Admin] ${ctx.adminEmail} ${updated.published ? "published" : "unpublished"} deployment ${deploymentId}`,
      );

      return {
        success: true,
        message: `Deployment ${updated.published ? "published" : "unpublished"} successfully`,
        deployment: updated,
      };
    }),

  // Delete deployment
  deleteDeployment: adminProcedure
    .input(
      z.object({
        deploymentId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { deploymentId } = input;

      const deployment = await prisma.deployment.findUnique({
        where: { id: deploymentId },
      });

      if (!deployment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Deployment not found",
        });
      }

      await prisma.deployment.delete({
        where: { id: deploymentId },
      });

      console.log(
        `[Admin] ${ctx.adminEmail} deleted deployment ${deploymentId} (${deployment.name})`,
      );

      return {
        success: true,
        message: `Deployment ${deployment.name} deleted successfully`,
      };
    }),

  // Get deployment details
  getDeploymentDetails: adminProcedure
    .input(
      z.object({
        deploymentId: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const { deploymentId } = input;

      const deployment = await prisma.deployment.findUnique({
        where: { id: deploymentId },
        include: {
          project: true,
          user: true,
        },
      });

      if (!deployment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Deployment not found",
        });
      }

      // Calculate file stats
      const files = deployment.files as any[];
      const fileStats = {
        totalFiles: files?.length || 0,
        totalSize:
          files?.reduce((acc, file) => {
            // Estimate size based on content length
            const size = file.content ? file.content.length : 0;
            return acc + size;
          }, 0) || 0,
      };

      return {
        ...deployment,
        fileStats,
      };
    }),

  // Cancel user subscription
  cancelSubscription: adminProcedure
    .input(
      z.object({
        userId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { userId } = input;
      console.log(
        `❌ [tRPC] Admin ${ctx.adminEmail} cancelling subscription for user: ${userId}`,
      );

      // Get target user
      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          stripeSubscriptionId: true,
          stripeCustomerId: true,
          membershipTier: true,
          creditBalance: true,
        },
      });

      if (!targetUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      if (!targetUser.stripeSubscriptionId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "User does not have an active subscription",
        });
      }

      // Cancel subscription at Stripe
      let cancelledSubscription;
      let subscriptionNotFound = false;

      try {
        console.log(
          `🔥 [tRPC] Attempting to cancel Stripe subscription: ${targetUser.stripeSubscriptionId}`,
        );
        cancelledSubscription = await stripe.subscriptions.cancel(
          targetUser.stripeSubscriptionId,
        );
        console.log(
          `✅ [tRPC] Stripe subscription cancelled:`,
          cancelledSubscription.status,
        );
      } catch (error: any) {
        console.error(`❌ [tRPC] Failed to cancel Stripe subscription:`, error);

        // Check if the subscription doesn't exist in Stripe
        if (
          error?.code === "resource_missing" ||
          error?.message?.includes("No such subscription")
        ) {
          console.log(
            `⚠️ [tRPC] Subscription not found in Stripe, will clean up local database`,
          );
          subscriptionNotFound = true;
          // Create a mock cancelled subscription object for consistency
          cancelledSubscription = {
            status: "canceled",
            id: targetUser.stripeSubscriptionId,
          };
        } else {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to cancel subscription at Stripe: ${error instanceof Error ? error.message : "Unknown error"
              }`,
          });
        }
      }

      // Calculate credits to remove (all remaining credits)
      const creditsToRemove = targetUser.creditBalance;
      console.log(`💰 [tRPC] Credits to remove: ${creditsToRemove}`);

      // Update local database
      console.log(
        `📊 [tRPC] Starting database transaction for user: ${targetUser.email}`,
      );
      try {
        await prisma.$transaction([
          // Update user - remove subscription info, set to FREE tier, and ZERO credits
          prisma.user.update({
            where: { id: userId },
            data: {
              membershipTier: "FREE",
              stripeSubscriptionId: null,
              membershipExpiresAt: null,
              lastCreditReset: new Date(),
              monthlyCreditsUsed: 0,
              creditBalance: 0, // 🔥 ZERO credits when subscription cancelled
              basePlanCredits: 0, // 🔥 Reset base plan credits
              carryOverCredits: 0, // 🔥 Reset carry-over credits
              carryOverExpiresAt: null, // 🔥 Clear expiration date
            },
          }),

          // Update subscription record if it exists
          prisma.subscription.updateMany({
            where: { stripeSubscriptionId: targetUser.stripeSubscriptionId },
            data: {
              status: "CANCELED" as any,
            },
          }),

          // Unpublish all user's deployments (make live projects private)
          // Exception: Skip unpublishing for admins only
          ...(!isAdminEmail(targetUser.email)
            ? [
              prisma.deployment.updateMany({
                where: { userId },
                data: { published: false },
              }),
            ]
            : []),

          // Log the cancellation and credit removal
          prisma.creditTransaction.create({
            data: {
              userId,
              amount: -creditsToRemove, // Remove all credits
              type: "REFUND",
              description: subscriptionNotFound
                ? `Admin cleaned up invalid subscription reference - removed ${creditsToRemove} credits and downgraded to FREE tier`
                : `Admin cancelled subscription - removed ${creditsToRemove} credits and downgraded to FREE tier`,
              metadata: {
                adminEmail: ctx.adminEmail,
                reason: subscriptionNotFound
                  ? "Admin subscription cleanup"
                  : "Admin subscription cancellation",
                originalTier: targetUser.membershipTier,
                originalCredits: creditsToRemove,
                stripeSubscriptionId: targetUser.stripeSubscriptionId,
                stripeStatus: cancelledSubscription.status,
                wasCleanup: subscriptionNotFound,
              },
            },
          }),
        ]);
        console.log(`✅ [tRPC] Database transaction completed successfully`);
      } catch (dbError) {
        console.error(`❌ [tRPC] Database transaction failed:`, dbError);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Database transaction failed: ${dbError instanceof Error ? dbError.message : "Unknown error"
            }`,
        });
      }

      // Count unpublished deployments (only if we actually unpublished them)
      const shouldUnpublish = !isAdminEmail(targetUser.email);
      const unpublishedCount = shouldUnpublish
        ? await prisma.deployment.count({
          where: { userId, published: false },
        })
        : 0;

      const unpublishMessage = shouldUnpublish
        ? `unpublished ${unpublishedCount} deployment(s), and`
        : `kept deployments published (admin user), and`;

      const message = subscriptionNotFound
        ? `Cleaned up invalid subscription reference, removed ${creditsToRemove} credits, ${unpublishMessage} downgraded user to FREE tier`
        : `Cancelled subscription, removed ${creditsToRemove} credits, ${unpublishMessage} downgraded user to FREE tier`;

      return {
        success: true,
        message,
        targetUser: targetUser.email,
        previousTier: targetUser.membershipTier,
        newTier: "FREE",
        creditsRemoved: creditsToRemove,
        newCreditBalance: 0,
        stripeStatus: cancelledSubscription.status,
        adminEmail: ctx.adminEmail,
        wasCleanup: subscriptionNotFound,
      };
    }),

  // Change user membership tier
  changeTier: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        tier: z.enum(["FREE", "PRO", "ENTERPRISE"]),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { userId, tier } = input;

      // Get target user
      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          membershipTier: true,
          creditBalance: true,
        },
      });

      if (!targetUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      if (targetUser.membershipTier === tier) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `User is already on ${tier} tier`,
        });
      }

      // Determine expiration date based on tier
      let membershipExpiresAt = null;
      if (tier !== "FREE") {
        // Set expiration to 1 month from now for paid tiers
        membershipExpiresAt = new Date();
        membershipExpiresAt.setMonth(membershipExpiresAt.getMonth() + 1);
      }

      // Update user tier using a transaction
      await prisma.$transaction([
        // Update user tier
        prisma.user.update({
          where: { id: userId },
          data: {
            membershipTier: tier as any,
            membershipExpiresAt: membershipExpiresAt,
            lastCreditReset: new Date(),
            monthlyCreditsUsed: 0,
          },
        }),

        // Log the tier change
        prisma.creditTransaction.create({
          data: {
            userId,
            amount: 0, // No immediate credit change
            type: "BONUS", // Using BONUS as closest match for admin actions
            description: `Admin changed membership tier from ${targetUser.membershipTier} to ${tier}`,
            metadata: {
              adminEmail: ctx.adminEmail,
              reason: "Admin tier change",
              originalTier: targetUser.membershipTier,
              newTier: tier,
              membershipExpiresAt: membershipExpiresAt?.toISOString(),
            },
          },
        }),
      ]);

      return {
        success: true,
        message: `Changed membership tier from ${targetUser.membershipTier} to ${tier}`,
        targetUser: targetUser.email,
        previousTier: targetUser.membershipTier,
        newTier: tier,
        membershipExpiresAt: membershipExpiresAt?.toISOString(),
        adminEmail: ctx.adminEmail,
      };
    }),

  // Fix subscription issues
  fixSubscription: adminProcedure
    .input(
      z.object({
        userId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { userId } = input;

      // Get target user data
      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          creditBalance: true,
          membershipTier: true,
          stripeSubscriptionId: true,
          stripeCustomerId: true,
          membershipExpiresAt: true,
        },
      });

      if (!targetUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      if (!targetUser.stripeSubscriptionId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No subscription found to fix",
        });
      }

      // Get subscription from Stripe
      let stripeSubscription;
      try {
        stripeSubscription = await stripe.subscriptions.retrieve(
          targetUser.stripeSubscriptionId,
          {
            expand: ["latest_invoice", "customer"],
          },
        );
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not retrieve subscription from Stripe",
        });
      }

      // Get tier information from subscription metadata
      const subscriptionMetadata = (stripeSubscription as any).metadata;
      let tierId = subscriptionMetadata?.tierId;

      // If no tierId in metadata, try to infer from current membership
      if (!tierId) {
        const tierMapping = {
          PRO: "pro-standard",
          ENTERPRISE: "enterprise-growth",
          FREE: "free",
        };
        tierId =
          tierMapping[targetUser.membershipTier as keyof typeof tierMapping] ||
          "pro-standard";
      }

      const tierInfo = getTierById(tierId);
      if (!tierInfo) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Could not find tier info for: ${tierId}`,
        });
      }

      // Calculate missing data
      const stripeCustomerId =
        typeof stripeSubscription.customer === "string"
          ? stripeSubscription.customer
          : (stripeSubscription.customer as any)?.id;

      // Handle current_period_end safely
      let stripeCurrentPeriodEnd: Date;
      const periodEndTimestamp = (stripeSubscription as any).current_period_end;

      if (periodEndTimestamp && typeof periodEndTimestamp === "number") {
        stripeCurrentPeriodEnd = new Date(periodEndTimestamp * 1000);
      } else {
        // Fallback: set to 1 month from now
        stripeCurrentPeriodEnd = new Date();
        stripeCurrentPeriodEnd.setMonth(stripeCurrentPeriodEnd.getMonth() + 1);
      }

      const creditsToAdd = tierInfo.monthlyCredits; // Add full monthly allocation

      // Update user data and add missing credits
      await prisma.$transaction([
        // Update user with missing Stripe data and add credits
        prisma.user.update({
          where: { id: userId },
          data: {
            stripeCustomerId: stripeCustomerId,
            membershipExpiresAt: stripeCurrentPeriodEnd,
            lastCreditReset: new Date(),
            monthlyCreditsUsed: 0,
            creditBalance: { increment: creditsToAdd },
          },
        }),

        // Update subscription record
        prisma.subscription.upsert({
          where: { stripeSubscriptionId: targetUser.stripeSubscriptionId },
          create: {
            userId,
            stripeSubscriptionId: targetUser.stripeSubscriptionId,
            stripePriceId:
              (stripeSubscription as any).items?.data[0]?.price?.id ||
              "dynamic_price",
            stripeCurrentPeriodEnd: stripeCurrentPeriodEnd,
            stripeCancelAtPeriodEnd: false,
            status: "ACTIVE" as any,
          },
          update: {
            stripePriceId:
              (stripeSubscription as any).items?.data[0]?.price?.id ||
              "dynamic_price",
            stripeCurrentPeriodEnd: stripeCurrentPeriodEnd,
            stripeCancelAtPeriodEnd: false,
            status: "ACTIVE" as any,
          },
        }),

        // Log the credit allocation
        prisma.creditTransaction.create({
          data: {
            userId,
            amount: creditsToAdd,
            type: "MONTHLY_ALLOCATION",
            description: `ADMIN FIX: ${tierInfo.name} monthly credit allocation (${creditsToAdd} credits)`,
            metadata: {
              subscriptionId: targetUser.stripeSubscriptionId,
              tierId,
              isRetroactiveFix: true,
              adminEmail: ctx.adminEmail,
            },
          },
        }),
      ]);

      // Get updated user data
      const updatedUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          creditBalance: true,
          membershipTier: true,
          stripeCustomerId: true,
          membershipExpiresAt: true,
        },
      });

      return {
        success: true,
        message: `Fixed subscription and added ${creditsToAdd} credits`,
        targetUser: targetUser.email,
        before: {
          creditBalance: targetUser.creditBalance,
          stripeCustomerId: targetUser.stripeCustomerId,
          membershipExpiresAt: targetUser.membershipExpiresAt,
        },
        after: {
          creditBalance: updatedUser?.creditBalance,
          stripeCustomerId: updatedUser?.stripeCustomerId,
          membershipExpiresAt: updatedUser?.membershipExpiresAt,
        },
        tierInfo: {
          tierId,
          name: tierInfo.name,
          monthlyCredits: tierInfo.monthlyCredits,
          monthlyPrice: tierInfo.monthlyPrice,
        },
      };
    }),

  // Generate invoice for user
  generateInvoice: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        amount: z.number().min(0.01),
        description: z.string().min(1),
        dueDate: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { userId, amount, description, dueDate } = input;

      // Get target user
      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          stripeCustomerId: true,
          creditBalance: true,
        },
      });

      if (!targetUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      // Ensure user has a Stripe customer ID
      let stripeCustomerId = targetUser.stripeCustomerId;
      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: targetUser.email,
          name: targetUser.name || undefined,
          metadata: {
            userId: targetUser.id,
          },
        });

        stripeCustomerId = customer.id;

        // Update user with Stripe customer ID
        await prisma.user.update({
          where: { id: userId },
          data: { stripeCustomerId },
        });
      }

      // Calculate due date (default to 30 days from now if not provided)
      let invoiceDueDate: number | undefined;
      if (dueDate) {
        invoiceDueDate = Math.floor(new Date(dueDate).getTime() / 1000);
      } else {
        const defaultDueDate = new Date();
        defaultDueDate.setDate(defaultDueDate.getDate() + 30); // 30 days from now
        invoiceDueDate = Math.floor(defaultDueDate.getTime() / 1000);
      }

      // Create invoice item
      await stripe.invoiceItems.create({
        customer: stripeCustomerId,
        amount: Math.round(amount * 100), // Convert to cents
        currency: "usd",
        description: description,
        metadata: {
          adminEmail: ctx.adminEmail,
          userId: targetUser.id,
          invoiceType: "admin_manual",
        },
      });

      // Create invoice (without auto-sending)
      const invoice = await stripe.invoices.create({
        customer: stripeCustomerId,
        auto_advance: false, // Don't auto-charge, let customer pay manually
        collection_method: "send_invoice",
        days_until_due: Math.ceil(
          (invoiceDueDate - Date.now() / 1000) / (24 * 60 * 60),
        ),
        metadata: {
          adminEmail: ctx.adminEmail,
          userId: targetUser.id,
          invoiceType: "admin_manual",
          originalDescription: description,
        },
      });

      // Finalize the invoice to generate the downloadable version
      if (!invoice.id) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create invoice - no invoice ID returned",
        });
      }

      const finalizedInvoice = await stripe.invoices.finalizeInvoice(
        invoice.id,
      );

      // Log the invoice in database
      await prisma.creditTransaction.create({
        data: {
          userId,
          amount: 0, // No immediate credit change
          type: "BONUS", // Using BONUS as closest match for admin actions
          description: `Admin generated invoice: $${amount} - ${description}`,
          metadata: {
            adminEmail: ctx.adminEmail,
            reason: "Admin invoice generated",
            stripeInvoiceId: finalizedInvoice.id,
            invoiceAmount: amount,
            invoiceDescription: description,
            invoiceUrl: finalizedInvoice.hosted_invoice_url,
            dueDate: new Date(invoiceDueDate * 1000).toISOString(),
          },
        },
      });

      return {
        success: true,
        message: `Invoice generated for ${targetUser.email}`,
        targetUser: targetUser.email,
        invoiceId: finalizedInvoice.id,
        invoiceUrl: finalizedInvoice.hosted_invoice_url,
        invoicePdf: finalizedInvoice.invoice_pdf,
        amount: amount,
        description: description,
        dueDate: new Date(invoiceDueDate * 1000).toISOString(),
        status: finalizedInvoice.status,
        adminEmail: ctx.adminEmail,
      };
    }),

  // Get all credit activity with pagination
  getAllCreditActivity: adminProcedure
    .input(
      z
        .object({
          page: z.number().min(1).default(1),
          limit: z.number().min(1).max(100).default(20),
          search: z.string().optional(),
          typeFilter: z
            .enum([
              "ALL",
              "PURCHASE",
              "MONTHLY_ALLOCATION",
              "AI_GENERATION",
              "SANDBOX_USAGE",
              "DEPLOYMENT",
              "TEAM_COLLABORATION",
              "BONUS",
              "REFUND",
            ])
            .default("ALL"),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
        })
        .optional()
        .default({
          page: 1,
          limit: 20,
          typeFilter: "ALL" as const,
        }),
    )
    .query(async ({ input }) => {
      const {
        page = 1,
        limit = 20,
        search,
        typeFilter = "ALL",
        startDate,
        endDate,
      } = input;
      const skip = (page - 1) * limit;

      // Build where clause for search, type filter, and date range
      const where: any = {};

      // Add search conditions (search by user name, email, or transaction description)
      if (search) {
        where.OR = [
          {
            user: {
              name: { contains: search, mode: "insensitive" as const },
            },
          },
          {
            user: {
              email: { contains: search, mode: "insensitive" as const },
            },
          },
          {
            description: { contains: search, mode: "insensitive" as const },
          },
        ];
      }

      // Add type filter conditions
      if (typeFilter !== "ALL") {
        where.type = typeFilter;
      }

      // Add date range filter
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
          where.createdAt.gte = new Date(startDate);
        }
        if (endDate) {
          where.createdAt.lte = new Date(endDate);
        }
      }

      // Get total count for pagination
      const totalCount = await prisma.creditTransaction.count({ where });

      // Get paginated credit transactions
      const transactions = await prisma.creditTransaction.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              membershipTier: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
      });

      const totalPages = Math.ceil(totalCount / limit);

      // Calculate summary statistics for current filtered results
      const summaryStats = await prisma.creditTransaction.aggregate({
        where,
        _sum: {
          amount: true,
        },
        _count: {
          _all: true,
        },
      });

      // Get type breakdown for current filtered results
      const typeBreakdown = await prisma.creditTransaction.groupBy({
        by: ["type"],
        where,
        _sum: {
          amount: true,
        },
        _count: {
          _all: true,
        },
      });

      return {
        transactions,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          limit,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
        stats: {
          totalAmount: summaryStats._sum.amount || 0,
          totalTransactions: summaryStats._count._all,
          typeBreakdown: typeBreakdown.map((item) => ({
            type: item.type,
            count: item._count._all,
            totalAmount: item._sum.amount || 0,
          })),
        },
      };
    }),

  // Get all projects with pagination
  getAllProjects: adminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        search: z.string().optional(),
        sortBy: z.enum(["recent", "messages", "advisor"]).default("recent"),
      }),
    )
    .query(async ({ input }) => {
      const { page = 1, limit = 20, search, sortBy = "recent" } = input;
      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = {};

      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" as const } },
          { id: { contains: search, mode: "insensitive" as const } },
          {
            user: {
              OR: [
                { name: { contains: search, mode: "insensitive" as const } },
                { email: { contains: search, mode: "insensitive" as const } },
              ],
            },
          },
        ];
      }

      // Determine order by
      let orderBy: any = { updatedAt: "desc" };
      if (sortBy === "messages") {
        orderBy = { messages: { _count: "desc" } };
      } else if (sortBy === "advisor") {
        orderBy = { halChatMessages: { _count: "desc" } };
      }

      // Get total count
      const totalCount = await prisma.project.count({ where });

      // Get projects with counts
      const projects = await prisma.project.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: {
              messages: true,
              v2Messages: true,
              halChatMessages: true,
            },
          },
          messages: {
            take: 1,
            orderBy: { createdAt: "desc" },
            select: {
              content: true,
              createdAt: true,
            },
          },
          v2Messages: {
            take: 1,
            orderBy: { createdAt: "desc" },
            select: {
              content: true,
              createdAt: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      });

      const projectIds = projects.map((p) => p.id);
      const projectUsageMap = new Map<string, number>();

      if (projectIds.length > 0) {
        const usageTransactions = await prisma.creditTransaction.findMany({
          where: {
            amount: { lt: 0 },
            OR: projectIds.map((id) => ({
              metadata: {
                path: ["projectId"],
                equals: id,
              },
            })),
          },
          select: {
            amount: true,
            metadata: true,
          },
        });

        for (const tx of usageTransactions) {
          const projectId = (tx.metadata as any)?.projectId as string | undefined;
          if (!projectId) continue;
          projectUsageMap.set(
            projectId,
            (projectUsageMap.get(projectId) || 0) + Math.abs(tx.amount),
          );
        }
      }

      const totalPages = Math.ceil(totalCount / limit);

      return {
        projects: projects.map((p) => {
          // Get the most recent message from either legacy or v2
          const latestLegacy = p.messages[0];
          const latestV2 = p.v2Messages[0];

          let latestMessage = null;
          if (latestLegacy && latestV2) {
            latestMessage =
              latestLegacy.createdAt > latestV2.createdAt
                ? latestLegacy
                : latestV2;
          } else {
            latestMessage = latestLegacy || latestV2 || null;
          }

          return {
            ...p,
            _count: {
              messages: (p._count.messages || 0) + (p._count.v2Messages || 0), // Combined count
              halChatMessages: p._count.halChatMessages,
            },
            latestMessage,
            messages: undefined,
            v2Messages: undefined,
            stats: {
              transactions: {
                creditsUsed: projectUsageMap.get(p.id) || 0,
              },
            },
          };
        }),
        total: totalCount,
        totalPages,
        currentPage: page,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      };
    }),

  // Get project stats
  getProjectStats: adminProcedure.query(async () => {
    const [
      totalProjects,
      totalLegacyMessages,
      totalV2Messages,
      totalHalMessages,
      totalSuggestions,
    ] = await Promise.all([
      prisma.project.count(),
      prisma.message.count(),
      prisma.v2Message.count(),
      prisma.halChatMessage.count(),
      prisma.halSuggestion.count(),
    ]);

    return {
      totalProjects,
      totalMessages: totalLegacyMessages + totalV2Messages, // Combined count
      totalHalMessages,
      totalSuggestions,
    };
  }),

  // Get detailed project information
  getProjectDetails: adminProcedure
    .input(
      z.object({
        projectId: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const { projectId } = input;

      // Get project with all related data
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              membershipTier: true,
            },
          },
          messages: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              content: true,
              role: true,
              type: true,
              createdAt: true,
            },
          },
          v2Messages: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              content: true,
              role: true,
              createdAt: true,
            },
          },
          halChatMessages: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              role: true,
              content: true,
              parts: true,
              createdAt: true,
            },
          },
          convexDeployment: {
            select: {
              id: true,
              status: true,
              currentPeriodStart: true,
              currentPeriodEnd: true,
              creditsUsedThisPeriod: true,
              totalFunctionCalls: true,
              totalActionComputeMs: true,
              totalDatabaseBandwidthBytes: true,
              totalFileBandwidthBytes: true,
              totalVectorBandwidthBytes: true,
              documentStorageBytes: true,
              indexStorageBytes: true,
              fileStorageBytes: true,
              vectorStorageBytes: true,
              backupStorageBytes: true,
              lastUsageAt: true,
            },
          },
        },
      });

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      if (!project.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Project owner not set",
        });
      }

      const creditTransactions = await prisma.creditTransaction.findMany({
        where: {
          userId: project.userId,
          amount: { lt: 0 },
        },
        select: {
          amount: true,
          metadata: true,
        },
      });

      const creditsByMessageId = new Map<string, number>();
      for (const tx of creditTransactions) {
        const metadata = tx.metadata as any;
        const messageId = metadata?.messageId as string | undefined;
        if (!messageId) continue;
        const current = creditsByMessageId.get(messageId) ?? 0;
        creditsByMessageId.set(messageId, current + Math.abs(tx.amount));
      }

      // Combine legacy messages and v2 messages, converting to a common format
      const allMessages = [
        // Legacy messages
        ...project.messages.map((msg) => ({
          id: msg.id,
          content: msg.content,
          role: msg.role,
          type: msg.type,
          createdAt: msg.createdAt,
          creditsUsed: creditsByMessageId.get(msg.id) ?? 0,
          version: 1,
        })),
        // V2 messages (convert role format to match legacy)
        ...project.v2Messages.map((msg) => ({
          id: msg.id,
          content: msg.content,
          role: msg.role.toUpperCase() as "USER" | "ASSISTANT", // Convert 'user' -> 'USER', 'assistant' -> 'ASSISTANT'
          type: "RESULT" as const,
          createdAt: msg.createdAt,
          creditsUsed: creditsByMessageId.get(msg.id) ?? 0,
          version: 2,
        })),
      ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()); // Sort by time

      console.log("[Admin] getProjectDetails:", {
        projectId,
        projectName: project.name,
        legacyMessagesCount: project.messages?.length || 0,
        v2MessagesCount: project.v2Messages?.length || 0,
        totalMessagesCount: allMessages.length,
        halMessagesCount: project.halChatMessages?.length || 0,
        messagingVersion: project.messagingVersion,
      });

      // Get all suggestions for this project
      const suggestions = await prisma.halSuggestion.findMany({
        where: {
          message: {
            projectId,
          },
        },
        orderBy: { createdAt: "desc" },
      });

      console.log("[Admin] Suggestions found:", suggestions.length);

      // Calculate Shipper Cloud billing breakdown if enabled
      let shipperCloudBilling = null;
      if (project.shipperCloudEnabled && project.convexDeployment) {
        const d = project.convexDeployment;

        // Shipper Cloud pricing rates (in credits, where 1 credit = $0.01)
        const SHIPPER_RATES = {
          functionCallsPerMillion: 300, // $3.00 per million
          actionComputePerGBHour: 45, // $0.45 per GB-hour
          databaseBandwidthPerGB: 30, // $0.30 per GB
          fileBandwidthPerGB: 45, // $0.45 per GB
          vectorBandwidthPerGB: 15, // $0.15 per GB
        };

        const BYTES_PER_GB = 1024 * 1024 * 1024;
        const MS_PER_HOUR = 3600000;
        const MB_PER_GB = 1024;
        const MEMORY_MB = 128;

        const functionCalls = Number(d.totalFunctionCalls);
        const actionComputeMs = Number(d.totalActionComputeMs);
        const databaseBandwidth = Number(d.totalDatabaseBandwidthBytes);
        const fileBandwidth = Number(d.totalFileBandwidthBytes);
        const vectorBandwidth = Number(d.totalVectorBandwidthBytes);

        const functionCallsCredits =
          (functionCalls / 1_000_000) * SHIPPER_RATES.functionCallsPerMillion;
        const actionComputeCredits =
          (MEMORY_MB / MB_PER_GB) *
          (actionComputeMs / MS_PER_HOUR) *
          SHIPPER_RATES.actionComputePerGBHour;
        const databaseBandwidthCredits =
          (databaseBandwidth / BYTES_PER_GB) * SHIPPER_RATES.databaseBandwidthPerGB;
        const fileBandwidthCredits =
          (fileBandwidth / BYTES_PER_GB) * SHIPPER_RATES.fileBandwidthPerGB;
        const vectorBandwidthCredits =
          (vectorBandwidth / BYTES_PER_GB) * SHIPPER_RATES.vectorBandwidthPerGB;

        shipperCloudBilling = {
          status: d.status,
          periodStart: d.currentPeriodStart?.toISOString() ?? null,
          periodEnd: d.currentPeriodEnd?.toISOString() ?? null,
          lastUsageAt: d.lastUsageAt?.toISOString() ?? null,
          totalCredits: d.creditsUsedThisPeriod,
          totalUsd: (d.creditsUsedThisPeriod / 100).toFixed(2),
          breakdown: {
            functionCalls: {
              usage: functionCalls,
              usageFormatted:
                functionCalls < 1000
                  ? `${functionCalls} calls`
                  : functionCalls < 1_000_000
                    ? `${(functionCalls / 1000).toFixed(1)}K`
                    : `${(functionCalls / 1_000_000).toFixed(3)}M`,
              credits: functionCallsCredits,
              usd: (functionCallsCredits / 100).toFixed(4),
            },
            actionCompute: {
              usage: actionComputeMs,
              usageFormatted: `${((MEMORY_MB / MB_PER_GB) * (actionComputeMs / MS_PER_HOUR)).toFixed(4)} GB-hrs`,
              credits: actionComputeCredits,
              usd: (actionComputeCredits / 100).toFixed(4),
            },
            databaseBandwidth: {
              usage: databaseBandwidth,
              usageFormatted: `${(databaseBandwidth / BYTES_PER_GB).toFixed(4)} GB`,
              credits: databaseBandwidthCredits,
              usd: (databaseBandwidthCredits / 100).toFixed(4),
            },
            fileBandwidth: {
              usage: fileBandwidth,
              usageFormatted: `${(fileBandwidth / BYTES_PER_GB).toFixed(4)} GB`,
              credits: fileBandwidthCredits,
              usd: (fileBandwidthCredits / 100).toFixed(4),
            },
            vectorBandwidth: {
              usage: vectorBandwidth,
              usageFormatted: `${(vectorBandwidth / BYTES_PER_GB).toFixed(4)} GB`,
              credits: vectorBandwidthCredits,
              usd: (vectorBandwidthCredits / 100).toFixed(4),
            },
          },
          storage: {
            document: `${(Number(d.documentStorageBytes) / BYTES_PER_GB).toFixed(4)} GB`,
            index: `${(Number(d.indexStorageBytes) / BYTES_PER_GB).toFixed(4)} GB`,
            file: `${(Number(d.fileStorageBytes) / BYTES_PER_GB).toFixed(4)} GB`,
            vector: `${(Number(d.vectorStorageBytes) / BYTES_PER_GB).toFixed(4)} GB`,
            backup: `${(Number(d.backupStorageBytes) / BYTES_PER_GB).toFixed(4)} GB`,
          },
        };
      }

      return {
        project,
        messages: allMessages, // Return combined messages
        halChatMessages: project.halChatMessages,
        suggestions,
        shipperCloudBilling,
      };
    }),

  // Get sandbox status for a project
  getProjectSandbox: adminProcedure
    .input(
      z.object({
        projectId: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const { projectId } = input;

      // Get project with sandbox info
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          name: true,
          activeFragmentId: true,
          sandboxId: true, // Modal uses this
          daytonaSandboxId: true, // Daytona uses this
          sandboxCreatedAt: true,
          sandboxProvider: true,
          sandboxUrl: true,
        },
      });

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      const provider = project.sandboxProvider || "modal";

      // Get the correct sandbox ID based on provider
      const sandboxId =
        provider === "modal" ? project.sandboxId : project.daytonaSandboxId;

      // Actually verify the sandbox is running by checking with the provider
      // Use read-only status check that does NOT trigger recovery
      let isActive = false;
      let sandboxStatus: string | null = null;

      if (sandboxId) {
        try {
          if (provider === "modal") {
            const { modalAPI } = await import("@/lib/api/modal-client");
            // Use getSandboxStatus (read-only) instead of getSandbox (triggers recovery)
            const status = await modalAPI.getSandboxStatus(projectId);
            isActive = status.isActive;
            sandboxStatus = status.status;

            // If sandbox is not found or terminated, clear stale data
            if (
              status.status === "not_found" ||
              status.status === "terminated"
            ) {
              console.log(
                `[Admin] Clearing stale Modal sandbox data for project ${projectId}`,
              );
              await prisma.project.update({
                where: { id: projectId },
                data: {
                  sandboxId: null,
                  sandboxUrl: null,
                  sandboxCreatedAt: null,
                  sandboxExpiresAt: null,
                },
              });
            }
          } else {
            // Daytona
            const { daytonaAPI } = await import("@/lib/api/daytona-client");
            const sandboxInfo = await daytonaAPI.getSandbox(projectId);
            isActive = !!sandboxInfo?.sandboxId;
            sandboxStatus = sandboxInfo ? "running" : "not_found";

            // If sandbox not found, clear stale data
            if (!sandboxInfo) {
              console.log(
                `[Admin] Clearing stale Daytona sandbox data for project ${projectId}`,
              );
              await prisma.project.update({
                where: { id: projectId },
                data: {
                  daytonaSandboxId: null,
                  sandboxUrl: null,
                  sandboxCreatedAt: null,
                },
              });
            }
          }
        } catch (error) {
          // Sandbox doesn't exist or is terminated
          console.log(
            `[Admin] Error checking sandbox ${sandboxId}:`,
            error instanceof Error ? error.message : String(error),
          );
          isActive = false;
          sandboxStatus = "terminated";

          // Clear stale sandbox data from database
          await prisma.project.update({
            where: { id: projectId },
            data:
              provider === "modal"
                ? {
                  sandboxId: null,
                  sandboxUrl: null,
                  sandboxCreatedAt: null,
                  sandboxExpiresAt: null,
                }
                : {
                  daytonaSandboxId: null,
                  sandboxUrl: null,
                  sandboxCreatedAt: null,
                },
          });
        }
      }

      return {
        projectId: project.id,
        projectName: project.name,
        sandboxId: sandboxId,
        sandboxCreatedAt: project.sandboxCreatedAt,
        sandboxLastUsedAt: null, // Not tracking at user level anymore
        activeFragmentId: project.activeFragmentId,
        isActive,
        sandboxStatus,
        sandboxProvider: provider,
        sandboxUrl: project.sandboxUrl,
      };
    }),

  // Start/wake up existing sandbox for a project
  startProjectSandbox: adminProcedure
    .input(
      z.object({
        projectId: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const { projectId } = input;

      // Get project to verify it exists and get sandbox info
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          name: true,
          sandboxId: true, // Modal uses this
          daytonaSandboxId: true, // Daytona uses this
          sandboxProvider: true,
          activeFragmentId: true,
        },
      });

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      const provider = project.sandboxProvider || "modal";

      // Get the correct sandbox ID based on provider
      let sandboxId =
        provider === "modal" ? project.sandboxId : project.daytonaSandboxId;

      // For Modal sandboxes, check if existing sandbox is actually running
      let sandboxCreated = false;
      if (provider === "modal") {
        const { modalAPI } = await import("@/lib/api/modal-client");

        // If we have a sandboxId, verify it's actually running
        if (sandboxId) {
          console.log(
            "[Admin] Checking if existing Modal sandbox is running:",
            sandboxId,
          );

          try {
            const status = await modalAPI.getSandboxStatus(projectId);

            if (
              !status.isActive ||
              status.status === "terminated" ||
              status.status === "not_found"
            ) {
              console.log(
                `[Admin] Existing sandbox is ${status.status}, deleting and creating new one`,
              );

              // Delete the terminated sandbox
              try {
                await modalAPI.deleteSandbox(sandboxId);
                console.log("[Admin] Deleted terminated sandbox:", sandboxId);
              } catch (deleteError) {
                console.warn(
                  "[Admin] Failed to delete terminated sandbox (may already be gone):",
                  deleteError,
                );
              }

              // Clear the sandboxId so we create a new one
              sandboxId = null;
            } else {
              console.log(
                "[Admin] Existing sandbox is running, reusing it:",
                sandboxId,
              );
            }
          } catch (error) {
            console.warn(
              "[Admin] Error checking sandbox status, will try to create new one:",
              error,
            );
            sandboxId = null;
          }
        }

        // If no sandbox exists (or we just deleted a terminated one), create a new one
        if (!sandboxId) {
          console.log(
            "[Admin] Creating new Modal sandbox for project:",
            projectId,
          );

          try {
            // Create sandbox with vite template (or from active fragment if exists)
            // Note: createSandbox already starts the dev server automatically
            const sandboxInfo = await modalAPI.createSandbox(
              projectId,
              project.activeFragmentId,
              "vite",
            );

            sandboxId = sandboxInfo.sandboxId;
            sandboxCreated = true;

            console.log(
              "[Admin] Modal sandbox created with dev server:",
              sandboxId,
            );
          } catch (error) {
            const errorMsg =
              error instanceof Error ? error.message : String(error);
            console.error("[Admin] Failed to create Modal sandbox:", error);
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: `Failed to create sandbox: ${errorMsg}`,
            });
          }
        }
      } else if (!sandboxId) {
        // Daytona or other provider without a sandbox
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "No sandbox found for this project. The project needs to be opened by the user first to create a sandbox.",
        });
      }

      if (provider === "modal") {
        // For Modal sandboxes, the dev server is already running
        // (started automatically during sandbox creation)
        // Just get the sandbox URL from the database
        const updatedProject = await prisma.project.findUnique({
          where: { id: projectId },
          select: { sandboxUrl: true },
        });

        console.log(
          `[Admin] Modal sandbox ${sandboxCreated ? "created" : "already exists"}:`,
          sandboxId,
        );

        return {
          success: true,
          message: sandboxCreated
            ? "Sandbox created with dev server running"
            : "Sandbox already running with dev server",
          sandboxId,
          devServerStarted: true,
          devServerError: null,
          devServerUrl: updatedProject?.sandboxUrl || null,
        };
      } else {
        // Daytona sandbox
        const { startSandbox, startDevServer } = await import(
          "@/lib/daytona-sandbox-manager"
        );

        // Start the sandbox (this is idempotent - won't fail if already running)
        const sandbox = await startSandbox(sandboxId);

        if (!sandbox) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to start Daytona sandbox",
          });
        }

        console.log(
          "[Admin] Daytona sandbox started successfully, now starting dev server",
        );

        // Start the dev server
        let devServerStarted = false;
        let devServerError = null;

        try {
          await startDevServer(sandbox, projectId);
          devServerStarted = true;
          console.log("[Admin] Dev server started successfully");
        } catch (error) {
          devServerError =
            error instanceof Error ? error.message : String(error);
          console.error("[Admin] Failed to start dev server:", error);
        }

        return {
          success: true,
          message: devServerStarted
            ? "Sandbox and dev server started successfully"
            : `Sandbox started, but dev server failed: ${devServerError}`,
          sandboxId,
          devServerStarted,
          devServerError,
        };
      }
    }),

  // Start dev server only (deprecated - use startProjectSandbox instead which starts both)
  startProjectDevServer: adminProcedure
    .input(
      z.object({
        projectId: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const { projectId } = input;

      // Import daytonaAPI dynamically to avoid issues
      const { daytonaAPI } = await import("@/lib/api/daytona-client");

      // Get project sandbox info
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          name: true,
          daytonaSandboxId: true,
        },
      });

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      // Check if sandbox exists for this project
      const sandboxId = project.daytonaSandboxId;

      if (!sandboxId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No sandbox found for this project",
        });
      }

      // Start dev server using Daytona API
      await daytonaAPI.startDevServer(projectId, sandboxId);

      return {
        success: true,
        message: "Dev server started successfully",
        sandboxId,
      };
    }),

  // Get dev server logs
  getProjectDevLogs: adminProcedure
    .input(
      z.object({
        projectId: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const { projectId } = input;

      // Try to ensure sandbox exists (auto-create for Modal if needed)
      let sandboxId: string | null = null;
      try {
        sandboxId = await ensureModalSandbox(projectId);
      } catch (error) {
        // If sandbox creation fails, return empty logs
        return {
          logs: [],
          sandboxId: null,
          hasActiveSandbox: false,
        };
      }

      // Get provider info
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
          sandboxProvider: true,
        },
      });

      const provider = project?.sandboxProvider || "modal";

      if (provider === "modal") {
        // For Modal sandboxes, logs aren't stored in sessions
        // We can try to read log files or execute a command to get logs
        try {
          const { modalAPI } = await import("@/lib/api/modal-client");

          // Try to read common log locations
          const logPaths = [
            ".shipper/dev-server.log",
            "dev-server.log",
            ".vite/dev.log",
          ];

          for (const logPath of logPaths) {
            try {
              const logContent = await modalAPI.readFile(sandboxId, logPath);
              if (logContent) {
                const logs = logContent
                  .split("\n")
                  .filter((line) => line.trim())
                  .slice(-100); // Last 100 lines

                return {
                  logs:
                    logs.length > 0 ? logs : ["Dev server log file is empty."],
                  sandboxId,
                  hasActiveSandbox: true,
                };
              }
            } catch {
              // File doesn't exist, try next path
              continue;
            }
          }

          // If no log files found, return a message
          return {
            logs: [
              "No dev server logs found. Logs may not be available for Modal sandboxes yet.",
            ],
            sandboxId,
            hasActiveSandbox: true,
            error: "No logs available",
          };
        } catch (error) {
          console.error("[Admin] Error getting Modal dev server logs:", error);
          return {
            logs: [
              `Error: ${error instanceof Error ? error.message : String(error)}`,
            ],
            sandboxId,
            hasActiveSandbox: true,
            error: `Error getting logs: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      } else {
        // Daytona sandbox
        try {
          const Daytona = (await import("@daytonaio/sdk")).Daytona;
          const daytona = new Daytona({
            apiKey: process.env.DAYTONA_API_KEY!,
            target: "us",
          });

          const sandbox = await daytona.findOne({ id: sandboxId });

          if (!sandbox) {
            return {
              logs: [],
              sandboxId,
              hasActiveSandbox: false,
              error: "Sandbox not found",
            };
          }

          const devServerSessionId = `dev-server-${projectId}`;
          console.log(
            "[Admin] Fetching dev server logs for session:",
            devServerSessionId,
          );

          let devSession: any = null;
          try {
            devSession = await sandbox.process.getSession(devServerSessionId);
          } catch {
            const sessions = await sandbox.process.listSessions();
            devSession = sessions.find(
              (s: any) =>
                s.id === devServerSessionId || s === devServerSessionId,
            );
          }

          if (!devSession) {
            return {
              logs: [
                "No dev server session found. The dev server may not be running.",
              ],
              sandboxId,
              hasActiveSandbox: true,
              error: "Dev server not running",
            };
          }

          const commands: any[] = devSession.commands || [];

          if (commands.length === 0) {
            return {
              logs: ["Dev server session exists but no commands found."],
              sandboxId,
              hasActiveSandbox: true,
              error: "No commands in session",
            };
          }

          const latestCommand = commands[commands.length - 1];
          const commandId =
            latestCommand.id || latestCommand.cmdId || latestCommand;

          const processLogs = await sandbox.process.getSessionCommandLogs(
            devServerSessionId,
            commandId,
          );

          const allOutput: string[] = [];

          if (processLogs.stdout) {
            allOutput.push(...processLogs.stdout.split("\n"));
          }
          if (processLogs.stderr) {
            allOutput.push(...processLogs.stderr.split("\n"));
          }
          if (processLogs.output) {
            allOutput.push(...processLogs.output.split("\n"));
          }

          const logs = allOutput.filter((line) => line.trim()).slice(-100);

          return {
            logs:
              logs.length > 0
                ? logs
                : ["Dev server is running but no output yet."],
            sandboxId,
            hasActiveSandbox: true,
          };
        } catch (error) {
          console.error(
            "[Admin] Error getting Daytona dev server logs:",
            error,
          );
          return {
            logs: [
              `Error: ${error instanceof Error ? error.message : String(error)}`,
            ],
            sandboxId,
            hasActiveSandbox: true,
            error: `Error getting logs: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      }
    }),

  // Execute command in project sandbox
  executeProjectCommand: adminProcedure
    .input(
      z.object({
        projectId: z.string(),
        command: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const { projectId, command } = input;

      // Ensure sandbox exists (auto-create for Modal if needed)
      const sandboxId = await ensureModalSandbox(projectId);

      // Get provider info
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
          sandboxProvider: true,
        },
      });

      const provider = project?.sandboxProvider || "modal";

      if (provider === "modal") {
        // Use Modal API
        const { modalAPI } = await import("@/lib/api/modal-client");
        const result = await modalAPI.executeCommand(sandboxId, command, {
          timeoutMs: 60000,
        });

        return {
          success: true,
          result: result.stdout || "",
          stderr: result.stderr || "",
          exitCode: result.exitCode,
        };
      } else {
        // Use Daytona API
        const { daytonaAPI } = await import("@/lib/api/daytona-client");
        const result = await daytonaAPI.executeCommand(sandboxId, command, {
          timeoutMs: 60000,
        });

        return {
          success: true,
          result: result.output || result.stdout || "",
          stderr: result.stderr || "",
          exitCode: result.exitCode,
        };
      }
    }),

  // List all files in project sandbox
  listProjectFiles: adminProcedure
    .input(
      z.object({
        projectId: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const { projectId } = input;

      // Ensure sandbox exists (auto-create for Modal if needed)
      const sandboxId = await ensureModalSandbox(projectId);

      // Get provider info
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
          sandboxProvider: true,
        },
      });

      const provider = project?.sandboxProvider || "modal";

      try {
        if (provider === "modal") {
          const { modalAPI } = await import("@/lib/api/modal-client");
          const files = await modalAPI.listFiles(sandboxId);

          // Convert to array format with path and metadata
          const fileList = Object.entries(files).map(([path, metadata]) => ({
            path,
            size: metadata.size,
            modified: metadata.modified,
          }));

          return {
            success: true,
            files: fileList,
            sandboxId,
          };
        } else {
          // For Daytona, use unified sandbox manager
          const { getSandbox } = await import("@/lib/sandbox-manager");
          const sandboxInfo = await getSandbox(projectId);

          if (!sandboxInfo) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Sandbox not found",
            });
          }

          const fileList = Array.from(sandboxInfo.files.entries()).map(
            ([path, metadata]) => ({
              path,
              size: metadata.size,
              modified: metadata.modified,
            }),
          );

          return {
            success: true,
            files: fileList,
            sandboxId,
          };
        }
      } catch (error) {
        console.error("[Admin] Error listing files:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to list files: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }),

  // Get V2Fragments for a project (admin version)
  getProjectFragments: adminProcedure
    .input(
      z.object({
        projectId: z.string(),
        limit: z.number().optional().default(20),
      }),
    )
    .query(async ({ input }) => {
      const { projectId, limit } = input;

      const fragments = await prisma.v2Fragment.findMany({
        where: {
          projectId,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: limit,
        select: {
          id: true,
          title: true,
          createdAt: true,
          updatedAt: true,
          snapshotImageId: true,
          snapshotCreatedAt: true,
          snapshotProvider: true,
          files: true, // Include files JSON
        },
      });

      return fragments;
    }),

  // Get files from a specific fragment (admin version)
  getFragmentFiles: adminProcedure
    .input(
      z.object({
        fragmentId: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const { fragmentId } = input;

      const fragment = await prisma.v2Fragment.findUnique({
        where: { id: fragmentId },
        select: {
          id: true,
          title: true,
          files: true,
        },
      });

      if (!fragment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Fragment not found",
        });
      }

      // Parse files JSON
      const files = fragment.files as any;

      return {
        fragmentId: fragment.id,
        title: fragment.title,
        files: files || {},
      };
    }),

  // Load a specific fragment (admin version)
  loadProjectFragment: adminProcedure
    .input(
      z.object({
        projectId: z.string(),
        fragmentId: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const { projectId, fragmentId } = input;

      // Get the fragment
      const fragment = await prisma.v2Fragment.findUnique({
        where: { id: fragmentId },
      });

      if (!fragment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Fragment not found",
        });
      }

      // Get project sandbox info
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          sandboxId: true, // Modal uses this
          daytonaSandboxId: true, // Daytona uses this
          sandboxProvider: true,
        },
      });

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      const provider = project.sandboxProvider || "modal";

      // Get the correct sandbox ID based on provider
      const sandboxId =
        provider === "modal" ? project.sandboxId : project.daytonaSandboxId;

      if (!sandboxId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No sandbox found for this project. Please start the sandbox first.",
        });
      }

      try {
        if (provider === "modal") {
          const { modalAPI } = await import("@/lib/api/modal-client");
          await modalAPI.restoreV2Fragment(sandboxId, fragmentId, projectId);
        } else {
          const { restoreV2FragmentInSandbox, getSandbox } = await import(
            "@/lib/daytona-sandbox-manager"
          );
          const sandboxInfo = await getSandbox(projectId);
          if (!sandboxInfo) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Sandbox not found",
            });
          }
          await restoreV2FragmentInSandbox(
            sandboxInfo.sandbox,
            fragmentId,
            projectId,
          );
        }

        // Update the project to track the active fragment
        await prisma.project.update({
          where: { id: projectId },
          data: { activeFragmentId: fragmentId },
        });

        return {
          success: true,
          fragment: {
            id: fragment.id,
            title: fragment.title,
            files: fragment.files,
            createdAt: fragment.createdAt,
          },
          message: `Fragment "${fragment.title}" loaded successfully`,
        };
      } catch (error) {
        console.error("[Admin] Error loading fragment:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to load fragment: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }),

  // Read a file from project sandbox
  readProjectFile: adminProcedure
    .input(
      z.object({
        projectId: z.string(),
        filePath: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const { projectId, filePath } = input;

      // Ensure sandbox exists (auto-create for Modal if needed)
      const sandboxId = await ensureModalSandbox(projectId);

      // Get provider info
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
          sandboxProvider: true,
        },
      });

      const provider = project?.sandboxProvider || "modal";

      try {
        if (provider === "modal") {
          const { modalAPI } = await import("@/lib/api/modal-client");
          const content = await modalAPI.readFile(sandboxId, filePath);

          return {
            success: true,
            content,
            filePath,
            sandboxId,
          };
        } else {
          // For Daytona, use the daytonaAPI
          const { daytonaAPI } = await import("@/lib/api/daytona-client");
          const content = await daytonaAPI.readFile(sandboxId, filePath);

          return {
            success: true,
            content,
            filePath,
            sandboxId,
          };
        }
      } catch (error) {
        console.error("[Admin] Error reading file:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }),

  // Inject monitor script into sandbox HTML
  injectMonitorScript: adminProcedure
    .input(
      z.object({
        projectId: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const { projectId } = input;

      // Generate monitor script using the shared package function
      const { generateMonitorScript } = await import("@shipper/shared");
      const allowedOrigins = [
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "https://app.shipper.now",
      ];
      const monitorScript = generateMonitorScript(allowedOrigins);

      // Ensure sandbox exists (auto-create for Modal if needed)
      const sandboxId = await ensureModalSandbox(projectId);

      // Get provider info
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
          sandboxProvider: true,
        },
      });

      const provider = project?.sandboxProvider || "modal";

      try {
        // Modal API automatically prepends /workspace/ to paths
        // So "index.html" becomes "/workspace/index.html"
        const indexHtmlPath = "index.html";

        // Read the current index.html
        let indexHtmlContent: string;
        if (provider === "modal") {
          const { modalAPI } = await import("@/lib/api/modal-client");
          indexHtmlContent = await modalAPI.readFile(sandboxId, indexHtmlPath);
        } else {
          const { daytonaAPI } = await import("@/lib/api/daytona-client");
          indexHtmlContent = await daytonaAPI.readFile(sandboxId, indexHtmlPath);
        }

        // Check if monitor script is already injected
        if (indexHtmlContent.includes("MONITOR_INITIALIZED") ||
          indexHtmlContent.includes("setupErrorTracking")) {
          return {
            success: true,
            message: "Monitor script is already injected",
            alreadyInjected: true,
          };
        }

        // Inject the monitor script before </head> or </body>
        let updatedHtml: string;
        const scriptTag = `\n<!-- Shipper Monitor Script -->\n<script>\n${monitorScript}\n</script>\n`;

        if (indexHtmlContent.includes("</head>")) {
          updatedHtml = indexHtmlContent.replace("</head>", `${scriptTag}</head>`);
        } else if (indexHtmlContent.includes("</body>")) {
          updatedHtml = indexHtmlContent.replace("</body>", `${scriptTag}</body>`);
        } else {
          // If neither tag exists, append at the end
          updatedHtml = indexHtmlContent + scriptTag;
        }

        // Write the updated index.html back
        if (provider === "modal") {
          const { modalAPI } = await import("@/lib/api/modal-client");
          await modalAPI.writeFile(sandboxId, indexHtmlPath, updatedHtml);
        } else {
          const { daytonaAPI } = await import("@/lib/api/daytona-client");
          await daytonaAPI.writeFile(sandboxId, indexHtmlPath, updatedHtml);
        }

        return {
          success: true,
          message: "Monitor script injected successfully! The dev server may need to be restarted.",
          alreadyInjected: false,
        };
      } catch (error) {
        console.error("[Admin] Error injecting monitor script:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to inject monitor script: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }),

  // ==========================================
  // Shipper Cloud Billing Admin
  // ==========================================

  /**
   * Get billing overview stats for Shipper Cloud
   */
  getBillingOverview: adminProcedure
    .input(
      z.object({
        days: z.number().min(1).max(365).default(30),
      })
    )
    .query(async ({ input }) => {
      const { days } = input;

      // Get current billing period
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

      // Get all deployments with usage in the current billing period
      const deployments = await prisma.convexDeployment.findMany({
        where: {
          status: "ACTIVE",
          currentPeriodStart: periodStart,
        },
        select: {
          id: true,
          convexDeploymentName: true,
          creditsUsedThisPeriod: true,
          totalFunctionCalls: true,
          totalActionComputeMs: true,
          totalDatabaseBandwidthBytes: true,
          totalFileBandwidthBytes: true,
          totalVectorBandwidthBytes: true,
          lastUsageAt: true,
          project: {
            select: {
              id: true,
              name: true,
              teamId: true,
              team: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      // Calculate totals
      let totalCreditsUsed = 0;
      let totalFunctionCalls = BigInt(0);
      let totalActionComputeMs = BigInt(0);
      let totalDatabaseBandwidth = BigInt(0);
      let totalFileBandwidth = BigInt(0);
      let totalVectorBandwidth = BigInt(0);
      const activeTeams = new Set<string>();

      for (const d of deployments) {
        totalCreditsUsed += d.creditsUsedThisPeriod;
        totalFunctionCalls += d.totalFunctionCalls;
        totalActionComputeMs += d.totalActionComputeMs;
        totalDatabaseBandwidth += d.totalDatabaseBandwidthBytes;
        totalFileBandwidth += d.totalFileBandwidthBytes;
        totalVectorBandwidth += d.totalVectorBandwidthBytes;
        if (d.project?.teamId) {
          activeTeams.add(d.project.teamId);
        }
      }

      // Calculate credits breakdown using the same rates as the billing service
      const RATES = {
        functionCallsPerMillion: 300,
        actionComputePerGBHour: 45,
        databaseBandwidthPerGB: 30,
        fileBandwidthPerGB: 45,
        vectorBandwidthPerGB: 15,
      };
      const BYTES_PER_GB = 1024 * 1024 * 1024;
      const MS_PER_HOUR = 3600000;
      const MB_PER_GB = 1024;
      const MEMORY_MB = 128;

      const functionCallsCredits = Math.round(
        (Number(totalFunctionCalls) / 1_000_000) * RATES.functionCallsPerMillion
      );
      const actionComputeCredits = Math.round(
        ((MEMORY_MB / MB_PER_GB) * (Number(totalActionComputeMs) / MS_PER_HOUR)) *
          RATES.actionComputePerGBHour
      );
      const databaseBandwidthCredits = Math.round(
        (Number(totalDatabaseBandwidth) / BYTES_PER_GB) * RATES.databaseBandwidthPerGB
      );
      const fileBandwidthCredits = Math.round(
        (Number(totalFileBandwidth) / BYTES_PER_GB) * RATES.fileBandwidthPerGB
      );
      const vectorBandwidthCredits = Math.round(
        (Number(totalVectorBandwidth) / BYTES_PER_GB) * RATES.vectorBandwidthPerGB
      );

      // Get top projects by usage
      const topProjects = deployments
        .filter((d) => d.creditsUsedThisPeriod > 0)
        .sort((a, b) => b.creditsUsedThisPeriod - a.creditsUsedThisPeriod)
        .slice(0, 10)
        .map((d) => ({
          projectId: d.project?.id ?? "",
          projectName: d.project?.name ?? "Unknown",
          teamName: d.project?.team?.name ?? "Unknown",
          credits: d.creditsUsedThisPeriod,
          functionCalls: Number(d.totalFunctionCalls),
        }));

      return {
        totalCreditsUsed,
        activeDeployments: deployments.filter(
          (d) => d.creditsUsedThisPeriod > 0 || d.lastUsageAt
        ).length,
        totalFunctionCalls: Number(totalFunctionCalls),
        activeTeams: activeTeams.size,
        breakdown: {
          functionCalls: functionCallsCredits,
          actionCompute: actionComputeCredits,
          databaseBandwidth: databaseBandwidthCredits,
          fileBandwidth: fileBandwidthCredits,
          vectorBandwidth: vectorBandwidthCredits,
        },
        topProjects,
        periodStart: periodStart.toISOString(),
        periodEnd: now.toISOString(),
      };
    }),

  /**
   * Get project usage stats with pagination and meter breakdown
   */
  getProjectUsageStats: adminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        search: z.string().optional(),
        days: z.number().min(1).max(365).default(30),
      })
    )
    .query(async ({ input }) => {
      const { page, limit, search } = input;
      const offset = (page - 1) * limit;

      // Get current billing period
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Convex pricing (their cost to us)
      const CONVEX_RATES = {
        functionCallsPerMillion: 200, // $2.00 per million
        actionComputePerGBHour: 30,   // $0.30 per GB-hour
        databaseBandwidthPerGB: 20,   // $0.20 per GB
        fileBandwidthPerGB: 30,       // $0.30 per GB
        vectorBandwidthPerGB: 10,     // $0.10 per GB
      };

      // Shipper Cloud pricing (what we charge - 50% margin)
      const SHIPPER_RATES = {
        functionCallsPerMillion: 300, // $3.00 per million
        actionComputePerGBHour: 45,   // $0.45 per GB-hour
        databaseBandwidthPerGB: 30,   // $0.30 per GB
        fileBandwidthPerGB: 45,       // $0.45 per GB
        vectorBandwidthPerGB: 15,     // $0.15 per GB
      };

      const BYTES_PER_GB = 1024 * 1024 * 1024;
      const MS_PER_HOUR = 3600000;
      const MB_PER_GB = 1024;
      const MEMORY_MB = 128;

      // Get total count (only active deployments)
      const baseWhere = { status: "ACTIVE" as const };

      // Get deployments with usage data
      const deployments = await prisma.convexDeployment.findMany({
        where: search
          ? {
              ...baseWhere,
              OR: [
                { project: { name: { contains: search, mode: "insensitive" as const } } },
                { project: { team: { name: { contains: search, mode: "insensitive" as const } } } },
                { convexDeploymentName: { contains: search, mode: "insensitive" as const } },
              ],
            }
          : baseWhere,
        orderBy: { creditsUsedThisPeriod: "desc" },
        skip: offset,
        take: limit,
        include: {
          project: {
            select: {
              id: true,
              name: true,
              team: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });

      // Get total count
      const totalCount = await prisma.convexDeployment.count({
        where: search
          ? {
              ...baseWhere,
              OR: [
                { project: { name: { contains: search, mode: "insensitive" as const } } },
                { project: { team: { name: { contains: search, mode: "insensitive" as const } } } },
                { convexDeploymentName: { contains: search, mode: "insensitive" as const } },
              ],
            }
          : baseWhere,
      });

      // Return only basic info - detailed breakdown fetched on demand
      const projects = deployments.map((d) => ({
        id: d.project?.id ?? d.id,
        name: d.project?.name ?? "Unknown Project",
        teamName: d.project?.team?.name ?? "No Team",
        deploymentName: d.convexDeploymentName,
        deploymentId: d.id,
        credits: d.creditsUsedThisPeriod,
        lastUsageAt: d.lastUsageAt?.toISOString() ?? null,
        status: d.status,
      }));

      return {
        projects,
        pagination: {
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
          currentPage: page,
          limit,
          hasPrev: page > 1,
          hasNext: page < Math.ceil(totalCount / limit),
        },
      };
    }),

  /**
   * Get detailed billing breakdown for a single deployment (fetched on accordion expand)
   */
  getProjectBillingDetails: adminProcedure
    .input(
      z.object({
        deploymentId: z.string(),
      })
    )
    .query(async ({ input }) => {
      const { deploymentId } = input;

      // Convex pricing (their cost to us)
      const CONVEX_RATES = {
        functionCallsPerMillion: 200,
        actionComputePerGBHour: 30,
        databaseBandwidthPerGB: 20,
        fileBandwidthPerGB: 30,
        vectorBandwidthPerGB: 10,
      };

      // Shipper Cloud pricing (what we charge - 50% margin)
      const SHIPPER_RATES = {
        functionCallsPerMillion: 300,
        actionComputePerGBHour: 45,
        databaseBandwidthPerGB: 30,
        fileBandwidthPerGB: 45,
        vectorBandwidthPerGB: 15,
      };

      const BYTES_PER_GB = 1024 * 1024 * 1024;
      const MS_PER_HOUR = 3600000;
      const MB_PER_GB = 1024;
      const MEMORY_MB = 128;

      const deployment = await prisma.convexDeployment.findUnique({
        where: { id: deploymentId },
      });

      if (!deployment) {
        throw new Error("Deployment not found");
      }

      const functionCalls = Number(deployment.totalFunctionCalls);
      const actionComputeMs = Number(deployment.totalActionComputeMs);
      const databaseBandwidth = Number(deployment.totalDatabaseBandwidthBytes);
      const fileBandwidth = Number(deployment.totalFileBandwidthBytes);
      const vectorBandwidth = Number(deployment.totalVectorBandwidthBytes);

      const documentStorage = Number(deployment.documentStorageBytes);
      const indexStorage = Number(deployment.indexStorageBytes);
      const fileStorage = Number(deployment.fileStorageBytes);
      const vectorStorage = Number(deployment.vectorStorageBytes);
      const backupStorage = Number(deployment.backupStorageBytes);

      const totalStoredCredits = deployment.creditsUsedThisPeriod;

      // Shipper pricing (what we charge) - keep as floats
      const functionCallsShipper = (functionCalls / 1_000_000) * SHIPPER_RATES.functionCallsPerMillion;
      const actionComputeShipper = ((MEMORY_MB / MB_PER_GB) * (actionComputeMs / MS_PER_HOUR)) * SHIPPER_RATES.actionComputePerGBHour;
      const databaseBandwidthShipper = (databaseBandwidth / BYTES_PER_GB) * SHIPPER_RATES.databaseBandwidthPerGB;
      const fileBandwidthShipper = (fileBandwidth / BYTES_PER_GB) * SHIPPER_RATES.fileBandwidthPerGB;
      const vectorBandwidthShipper = (vectorBandwidth / BYTES_PER_GB) * SHIPPER_RATES.vectorBandwidthPerGB;

      // Convex pricing (our cost) - keep as floats
      const functionCallsConvex = (functionCalls / 1_000_000) * CONVEX_RATES.functionCallsPerMillion;
      const actionComputeConvex = ((MEMORY_MB / MB_PER_GB) * (actionComputeMs / MS_PER_HOUR)) * CONVEX_RATES.actionComputePerGBHour;
      const databaseBandwidthConvex = (databaseBandwidth / BYTES_PER_GB) * CONVEX_RATES.databaseBandwidthPerGB;
      const fileBandwidthConvex = (fileBandwidth / BYTES_PER_GB) * CONVEX_RATES.fileBandwidthPerGB;
      const vectorBandwidthConvex = (vectorBandwidth / BYTES_PER_GB) * CONVEX_RATES.vectorBandwidthPerGB;

      // Calculate totals
      const calculatedShipperTotal = functionCallsShipper + actionComputeShipper + databaseBandwidthShipper + fileBandwidthShipper + vectorBandwidthShipper;
      const calculatedConvexTotal = functionCallsConvex + actionComputeConvex + databaseBandwidthConvex + fileBandwidthConvex + vectorBandwidthConvex;

      const totalShipperRevenue = totalStoredCredits;
      const totalConvexCost = calculatedShipperTotal > 0
        ? (calculatedConvexTotal / calculatedShipperTotal) * totalStoredCredits
        : 0;
      const totalMargin = totalShipperRevenue - totalConvexCost;

      const formatPrices = (cents: number) => ({
        display: `$${(cents / 100).toFixed(2)}`,
        raw: `$${(cents / 100).toFixed(6)}`,
      });

      return {
        deploymentId,
        meterBreakdown: {
          functionCalls: {
            usage: functionCalls,
            usageFormatted: functionCalls < 1000
              ? `${functionCalls} calls`
              : functionCalls < 1_000_000
                ? `${(functionCalls / 1000).toFixed(1)}K calls`
                : `${(functionCalls / 1_000_000).toFixed(3)}M calls`,
            convexCost: formatPrices(functionCallsConvex),
            shipperPrice: formatPrices(functionCallsShipper),
            margin: formatPrices(functionCallsShipper - functionCallsConvex),
          },
          actionCompute: {
            usage: actionComputeMs,
            usageFormatted: `${(actionComputeMs / MS_PER_HOUR).toFixed(4)} GB-hrs`,
            convexCost: formatPrices(actionComputeConvex),
            shipperPrice: formatPrices(actionComputeShipper),
            margin: formatPrices(actionComputeShipper - actionComputeConvex),
          },
          databaseBandwidth: {
            usage: databaseBandwidth,
            usageFormatted: `${(databaseBandwidth / BYTES_PER_GB).toFixed(4)} GB`,
            convexCost: formatPrices(databaseBandwidthConvex),
            shipperPrice: formatPrices(databaseBandwidthShipper),
            margin: formatPrices(databaseBandwidthShipper - databaseBandwidthConvex),
          },
          fileBandwidth: {
            usage: fileBandwidth,
            usageFormatted: `${(fileBandwidth / BYTES_PER_GB).toFixed(4)} GB`,
            convexCost: formatPrices(fileBandwidthConvex),
            shipperPrice: formatPrices(fileBandwidthShipper),
            margin: formatPrices(fileBandwidthShipper - fileBandwidthConvex),
          },
          vectorBandwidth: {
            usage: vectorBandwidth,
            usageFormatted: `${(vectorBandwidth / BYTES_PER_GB).toFixed(4)} GB`,
            convexCost: formatPrices(vectorBandwidthConvex),
            shipperPrice: formatPrices(vectorBandwidthShipper),
            margin: formatPrices(vectorBandwidthShipper - vectorBandwidthConvex),
          },
          totals: {
            convexCost: formatPrices(totalConvexCost),
            shipperRevenue: formatPrices(totalShipperRevenue),
            margin: formatPrices(totalMargin),
            marginPercent: totalConvexCost > 0 ? `${((totalMargin / totalConvexCost) * 100).toFixed(0)}%` : "50%",
          },
        },
        storageSnapshot: {
          documentStorage: {
            bytes: documentStorage,
            formatted: `${(documentStorage / BYTES_PER_GB).toFixed(4)} GB`,
          },
          indexStorage: {
            bytes: indexStorage,
            formatted: `${(indexStorage / BYTES_PER_GB).toFixed(4)} GB`,
          },
          fileStorage: {
            bytes: fileStorage,
            formatted: `${(fileStorage / BYTES_PER_GB).toFixed(4)} GB`,
          },
          vectorStorage: {
            bytes: vectorStorage,
            formatted: `${(vectorStorage / BYTES_PER_GB).toFixed(4)} GB`,
          },
          backupStorage: {
            bytes: backupStorage,
            formatted: `${(backupStorage / BYTES_PER_GB).toFixed(4)} GB`,
          },
          lastUpdated: deployment.lastStorageUpdateAt?.toISOString() ?? null,
        },
      };
    }),

  /**
   * Get usage time series data for charts
   */
  getUsageTimeSeries: adminProcedure
    .input(
      z.object({
        days: z.number().min(1).max(365).default(30),
      })
    )
    .query(async ({ input }) => {
      const { days } = input;

      // For time series, we need to aggregate from ConvexUsagePeriod
      // or generate synthetic data based on current deployment stats
      // Since we removed individual records, we'll show current period summary

      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Get all deployments with usage
      const deployments = await prisma.convexDeployment.findMany({
        where: {
          status: "ACTIVE",
          currentPeriodStart: periodStart,
          creditsUsedThisPeriod: { gt: 0 },
        },
        select: {
          creditsUsedThisPeriod: true,
          totalFunctionCalls: true,
          totalActionComputeMs: true,
          totalDatabaseBandwidthBytes: true,
          totalFileBandwidthBytes: true,
          totalVectorBandwidthBytes: true,
          lastUsageAt: true,
        },
      });

      // Calculate totals
      let totalCredits = 0;
      let totalFunctionCalls = BigInt(0);
      let totalActionCompute = BigInt(0);
      let totalDbBandwidth = BigInt(0);
      let totalFileBandwidth = BigInt(0);
      let totalVectorBandwidth = BigInt(0);

      for (const d of deployments) {
        totalCredits += d.creditsUsedThisPeriod;
        totalFunctionCalls += d.totalFunctionCalls;
        totalActionCompute += d.totalActionComputeMs;
        totalDbBandwidth += d.totalDatabaseBandwidthBytes;
        totalFileBandwidth += d.totalFileBandwidthBytes;
        totalVectorBandwidth += d.totalVectorBandwidthBytes;
      }

      // Generate daily data points (synthetic - evenly distributed over the period)
      const daysInPeriod = Math.min(days, Math.ceil((now.getTime() - periodStart.getTime()) / (24 * 60 * 60 * 1000)) + 1);
      const dailyCredits = Math.round(totalCredits / Math.max(1, daysInPeriod));
      const dailyFunctionCalls = Math.round(Number(totalFunctionCalls) / Math.max(1, daysInPeriod));

      const daily = [];
      for (let i = 0; i < daysInPeriod; i++) {
        const date = new Date(periodStart);
        date.setDate(date.getDate() + i);
        daily.push({
          date: date.toISOString(),
          credits: dailyCredits,
          functionCalls: dailyFunctionCalls,
        });
      }

      // Calculate breakdown for pie chart
      const RATES = {
        functionCallsPerMillion: 300,
        actionComputePerGBHour: 45,
        databaseBandwidthPerGB: 30,
        fileBandwidthPerGB: 45,
        vectorBandwidthPerGB: 15,
      };
      const BYTES_PER_GB = 1024 * 1024 * 1024;
      const MS_PER_HOUR = 3600000;
      const MB_PER_GB = 1024;
      const MEMORY_MB = 128;

      const breakdown = [
        {
          name: "Function Calls",
          value: Math.round(
            (Number(totalFunctionCalls) / 1_000_000) * RATES.functionCallsPerMillion
          ),
        },
        {
          name: "Action Compute",
          value: Math.round(
            ((MEMORY_MB / MB_PER_GB) * (Number(totalActionCompute) / MS_PER_HOUR)) *
              RATES.actionComputePerGBHour
          ),
        },
        {
          name: "Database Bandwidth",
          value: Math.round(
            (Number(totalDbBandwidth) / BYTES_PER_GB) * RATES.databaseBandwidthPerGB
          ),
        },
        {
          name: "File Bandwidth",
          value: Math.round(
            (Number(totalFileBandwidth) / BYTES_PER_GB) * RATES.fileBandwidthPerGB
          ),
        },
        {
          name: "Vector Bandwidth",
          value: Math.round(
            (Number(totalVectorBandwidth) / BYTES_PER_GB) * RATES.vectorBandwidthPerGB
          ),
        },
      ].filter((b) => b.value > 0);

      return {
        daily,
        breakdown,
        summary: {
          totalCredits,
          totalFunctionCalls: Number(totalFunctionCalls),
          periodStart: periodStart.toISOString(),
          periodEnd: now.toISOString(),
        },
      };
    }),

  // ==========================================
  // Queue / Background Job Dashboard Procedures
  // ==========================================

  /**
   * Get BullMQ queue stats from billing service
   * Fetches from the billing service's /queue/stats endpoint
   */
  getQueueStats: adminProcedure.query(async () => {
    const billingServiceUrl = process.env.BILLING_SERVICE_URL || "http://localhost:4004";

    try {
      const response = await fetch(`${billingServiceUrl}/queue/stats`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Billing service returned ${response.status}`);
      }

      const data = await response.json();

      return {
        success: true,
        meterEvents: data.data?.meterEvents || null,
        scheduledJobs: data.data?.scheduledJobs || null,
        billingServiceUrl,
      };
    } catch (error) {
      console.error("[Admin] Failed to fetch queue stats:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to connect to billing service",
        meterEvents: null,
        scheduledJobs: null,
        billingServiceUrl,
      };
    }
  }),

  /**
   * Get Cloud credit transaction activity (for Shipper Cloud usage tracking)
   */
  getCloudCreditActivity: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const { limit, offset } = input;

      const [transactions, total, purchases, totalPurchases] = await Promise.all([
        prisma.cloudCreditTransaction.findMany({
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
          include: {
            user: {
              select: { email: true, name: true },
            },
          },
        }),
        prisma.cloudCreditTransaction.count(),
        prisma.cloudCreditPurchase.findMany({
          orderBy: { createdAt: "desc" },
          take: 10,
          include: {
            user: {
              select: { email: true, name: true },
            },
          },
        }),
        prisma.cloudCreditPurchase.count(),
      ]);

      return {
        transactions: transactions.map((t) => ({
          id: t.id,
          type: t.type,
          amount: t.amount,
          description: t.description,
          userEmail: t.user.email,
          userName: t.user.name,
          createdAt: t.createdAt.toISOString(),
        })),
        purchases: purchases.map((p) => ({
          id: p.id,
          credits: p.credits,
          amountCents: p.amountCents,
          status: p.status,
          userEmail: p.user.email,
          userName: p.user.name,
          createdAt: p.createdAt.toISOString(),
        })),
        pagination: {
          total,
          totalPurchases,
          limit,
          offset,
          hasMore: total > offset + limit,
        },
      };
    }),

  // ==========================================
  // Shipper Cloud (Convex) Admin Tools
  // ==========================================

  // Get all Shipper Cloud deployments with status
  getShipperCloudDeployments: adminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        search: z.string().optional(),
        statusFilter: z
          .enum(["ALL", "ACTIVE", "ERROR", "INCOMPLETE_SETUP"])
          .default("ALL"),
      }),
    )
    .query(async ({ input }) => {
      const { page, limit, search, statusFilter } = input;
      const skip = (page - 1) * limit;

      // Build where clause
      const where: {
        OR?: Array<{
          convexDeploymentName?: { contains: string; mode: "insensitive" };
          projectId?: { contains: string; mode: "insensitive" };
          project?: { name?: { contains: string; mode: "insensitive" } };
        }>;
        status?: "ACTIVE" | "ERROR";
        setupComplete?: boolean;
      } = {};

      if (search) {
        where.OR = [
          { convexDeploymentName: { contains: search, mode: "insensitive" } },
          { projectId: { contains: search, mode: "insensitive" } },
          { project: { name: { contains: search, mode: "insensitive" } } },
        ];
      }

      if (statusFilter === "ACTIVE") {
        where.status = "ACTIVE";
        where.setupComplete = true;
      } else if (statusFilter === "ERROR") {
        where.status = "ERROR";
      } else if (statusFilter === "INCOMPLETE_SETUP") {
        where.setupComplete = false;
      }

      const [deployments, total] = await Promise.all([
        prisma.convexDeployment.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            project: {
              select: {
                id: true,
                name: true,
                sandboxId: true,
                userId: true,
                user: { select: { email: true, name: true } },
              },
            },
          },
        }),
        prisma.convexDeployment.count({ where }),
      ]);

      return {
        deployments: deployments.map((d) => ({
          id: d.id,
          projectId: d.projectId,
          projectName: d.project.name,
          convexDeploymentName: d.convexDeploymentName,
          convexDeploymentUrl: d.convexDeploymentUrl,
          status: d.status,
          setupComplete: d.setupComplete,
          setupCompletedAt: d.setupCompletedAt?.toISOString() ?? null,
          webhookConfigured: !!d.webhookSecretEncrypted,
          webhookConfiguredAt: d.webhookConfiguredAt?.toISOString() ?? null,
          hasSandbox: !!d.project.sandboxId,
          sandboxId: d.project.sandboxId,
          userEmail: d.project.user?.email ?? null,
          userName: d.project.user?.name ?? null,
          createdAt: d.createdAt.toISOString(),
          lastDeployedAt: d.lastDeployedAt?.toISOString() ?? null,
          lastDeployError: d.lastDeployError,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }),

  // Get detailed Shipper Cloud deployment info
  // Uses database for credential status (doesn't require live sandbox)
  getShipperCloudDeploymentDetails: adminProcedure
    .input(z.object({
      projectId: z.string(),
    }))
    .query(async ({ input }) => {
      const { projectId } = input;

      const deployment = await prisma.convexDeployment.findUnique({
        where: { projectId },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              sandboxId: true,
              sandboxProvider: true,
              userId: true,
              user: { select: { email: true, name: true } },
            },
          },
        },
      });

      if (!deployment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Shipper Cloud deployment not found for this project",
        });
      }

      // Database-based credential status (always available, doesn't need sandbox)
      const credentialStatus = {
        hasDeployKey: !!deployment.deployKeyEncrypted,
        hasDeploymentUrl: !!deployment.convexDeploymentUrl,
        hasWebhookSecret: !!deployment.webhookSecretEncrypted,
        setupComplete: deployment.setupComplete,
      };

      return {
        id: deployment.id,
        projectId: deployment.projectId,
        projectName: deployment.project.name,
        convexDeploymentName: deployment.convexDeploymentName,
        convexDeploymentUrl: deployment.convexDeploymentUrl,
        convexProjectId: deployment.convexProjectId,
        status: deployment.status,
        setupComplete: deployment.setupComplete,
        setupCompletedAt: deployment.setupCompletedAt?.toISOString() ?? null,
        webhookConfigured: !!deployment.webhookSecretEncrypted,
        webhookConfiguredAt:
          deployment.webhookConfiguredAt?.toISOString() ?? null,
        hasSandbox: !!deployment.project.sandboxId,
        sandboxId: deployment.project.sandboxId,
        sandboxProvider: deployment.project.sandboxProvider,
        // Credential status from database (always available)
        credentialStatus,
        userEmail: deployment.project.user?.email ?? null,
        userName: deployment.project.user?.name ?? null,
        createdAt: deployment.createdAt.toISOString(),
        lastDeployedAt: deployment.lastDeployedAt?.toISOString() ?? null,
        lastDeployError: deployment.lastDeployError,
        // Usage stats
        creditsUsedThisPeriod: deployment.creditsUsedThisPeriod,
        totalFunctionCalls: deployment.totalFunctionCalls.toString(),
      };
    }),

  // Fix Shipper Cloud credentials - inject into sandbox
  fixShipperCloudCredentials: adminProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ input }) => {
      const { projectId } = input;

      const deployment = await prisma.convexDeployment.findUnique({
        where: { projectId },
        include: {
          project: {
            select: { sandboxId: true },
          },
        },
      });

      if (!deployment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Shipper Cloud deployment not found",
        });
      }

      if (!deployment.project.sandboxId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No sandbox found for this project",
        });
      }

      // Call the API server to inject credentials
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const apiKey = process.env.SHIPPER_API_KEY;

      const response = await fetch(
        `${apiUrl}/api/v1/shipper-cloud/inject-credentials`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(apiKey && { "x-api-key": apiKey }),
          },
          body: JSON.stringify({
            projectId,
            deployKeyEncrypted: deployment.deployKeyEncrypted,
            deploymentUrl: deployment.convexDeploymentUrl,
          }),
        },
      );

      if (!response.ok) {
        const error = await response.text();
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to inject credentials: ${error}`,
        });
      }

      return {
        success: true,
        message: `Credentials injected into sandbox for ${deployment.convexDeploymentName}`,
      };
    }),

  // Mark Shipper Cloud setup as complete
  markShipperCloudSetupComplete: adminProcedure
    .input(
      z.object({
        projectId: z.string(),
        complete: z.boolean().default(true),
      }),
    )
    .mutation(async ({ input }) => {
      const { projectId, complete } = input;

      const deployment = await prisma.convexDeployment.update({
        where: { projectId },
        data: {
          setupComplete: complete,
          setupCompletedAt: complete ? new Date() : null,
        },
      });

      return {
        success: true,
        message: complete
          ? `Setup marked as complete for ${deployment.convexDeploymentName}`
          : `Setup marked as incomplete for ${deployment.convexDeploymentName}`,
      };
    }),

  // Create a new template category
  createCategory: adminProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required"),
        slug: z.string().optional(),
        description: z.string().optional(),
        icon: z.string().optional(),
        order: z.number().int().default(0),
      }),
    )
    .mutation(async ({ input }) => {
      // Generate slug from name if not provided
      const slug =
        input.slug ||
        input.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");

      // Check if category with same name or slug already exists
      const existing = await prisma.templateCategory.findFirst({
        where: {
          OR: [{ name: input.name }, { slug }],
        },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Category with ${existing.name === input.name ? "name" : "slug"} "${existing.name === input.name ? input.name : slug}" already exists`,
        });
      }

      const category = await prisma.templateCategory.create({
        data: {
          name: input.name,
          slug,
          description: input.description,
          icon: input.icon,
          order: input.order,
        },
      });

      return {
        success: true,
        category,
        message: `Category "${category.name}" created successfully`,
      };
    }),

  // Update an existing template category
  updateCategory: adminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1, "Name is required"),
        slug: z.string().optional(),
        description: z.string().optional(),
        icon: z.string().optional(),
        order: z.number().int().default(0),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...updateData } = input;

      // Get the existing category
      const existing = await prisma.templateCategory.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              templates: true,
            },
          },
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Category not found",
        });
      }

      // Generate slug from name if not provided
      const slug =
        updateData.slug ||
        updateData.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");

      // Check if another category with same name or slug exists
      const duplicate = await prisma.templateCategory.findFirst({
        where: {
          id: { not: id },
          OR: [{ name: updateData.name }, { slug }],
        },
      });

      if (duplicate) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Category with ${duplicate.name === updateData.name ? "name" : "slug"} "${duplicate.name === updateData.name ? updateData.name : slug}" already exists`,
        });
      }

      const category = await prisma.templateCategory.update({
        where: { id },
        data: {
          name: updateData.name,
          slug,
          description: updateData.description,
          icon: updateData.icon,
          order: updateData.order,
        },
      });

      return {
        success: true,
        category,
        templateCount: existing._count.templates,
        message: `Category "${category.name}" updated successfully`,
      };
    }),

  // Delete a template category
  deleteCategory: adminProcedure
    .input(
      z.object({
        id: z.string(),
        reassignToCategoryId: z.string().optional(), // Optional: reassign templates to another category
      }),
    )
    .mutation(async ({ input }) => {
      const { id, reassignToCategoryId } = input;

      // Get the category with template count
      const category = await prisma.templateCategory.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              templates: true,
            },
          },
        },
      });

      if (!category) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Category not found",
        });
      }

      // If templates exist, require reassignment
      if (category._count.templates > 0) {
        if (!reassignToCategoryId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Cannot delete category with ${category._count.templates} template(s). Please reassign templates to another category first.`,
          });
        }

        // Verify target category exists
        const targetCategory = await prisma.templateCategory.findUnique({
          where: { id: reassignToCategoryId },
        });

        if (!targetCategory) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Target category for reassignment not found",
          });
        }

        // Reassign all templates to the new category
        await prisma.communityTemplate.updateMany({
          where: { categoryId: id },
          data: { categoryId: reassignToCategoryId },
        });
      }

      // Delete the category
      await prisma.templateCategory.delete({
        where: { id },
      });

      return {
        success: true,
        message: category._count.templates > 0
          ? `Category "${category.name}" deleted and ${category._count.templates} template(s) reassigned`
          : `Category "${category.name}" deleted successfully`,
        templateCount: category._count.templates,
      };
    }),
});
