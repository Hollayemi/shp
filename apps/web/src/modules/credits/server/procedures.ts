import { protectedProcedure, createTRPCRouter } from "@/trpc/init";
import { prisma } from "@/lib/db";
import { CreditManager } from "@/lib/credits";
import { z } from "zod";
import { stripe } from "@/lib/stripe";

export const creditsRouter = createTRPCRouter({
  // Get current user's credit information
  getMyCredits: protectedProcedure.query(async ({ ctx }) => {
    const user = await prisma.user.findUnique({
      where: { id: ctx.user.id },
      select: {
        creditBalance: true,
        basePlanCredits: true,
        carryOverCredits: true,
        carryOverExpiresAt: true,
        name: true,
        email: true,
        membershipTier: true,
        membershipExpiresAt: true,
        monthlyCreditsUsed: true,
        lifetimeCreditsUsed: true,
        stripeSubscriptionId: true,
      },
    });

    // 📊 Get ORIGINAL subscription tier from Stripe metadata
    let originalSubscriptionTier = 0;
    if (user?.stripeSubscriptionId) {
      try {
        const stripeSubscription = await stripe.subscriptions.retrieve(
          user.stripeSubscriptionId,
        );
        originalSubscriptionTier = parseInt(
          stripeSubscription.metadata.monthlyCredits || "0",
        );
      } catch (error) {
        console.error(
          "Failed to fetch Stripe subscription for credit display:",
          error,
        );
        // Fallback to basePlanCredits (not ideal but better than nothing)
        originalSubscriptionTier = user.basePlanCredits || 0;
      }
    }

    // 🔧 SELF-HEALING: Initialize basePlanCredits if missing (for existing users)
    let basePlanCredits = user?.basePlanCredits || 0;
    let carryOverCredits = user?.carryOverCredits || 0;
    let carryOverExpiresAt = user?.carryOverExpiresAt;

    // 🔒 AUTO-EXPIRE: Check if carry-over credits have expired
    const now = new Date();
    const carryOverExpired =
      carryOverExpiresAt && new Date(carryOverExpiresAt) <= now;

    if (carryOverExpired && carryOverCredits > 0) {
      console.log(
        `⏰ Carry-over credits expired for user ${ctx.user.id}, auto-clearing in display`,
      );

      // Clear expired carry-over in database (fire and forget)
      prisma.user
        .update({
          where: { id: ctx.user.id },
          data: {
            carryOverCredits: 0,
            carryOverExpiresAt: null,
            creditBalance: { decrement: carryOverCredits },
          },
        })
        .catch((err) =>
          console.error("Failed to clear expired carry-over:", err),
        );

      // Clear for display
      carryOverCredits = 0;
      carryOverExpiresAt = null;
    }

    if (
      basePlanCredits === 0 &&
      (user?.creditBalance || 0) > 0 &&
      user?.membershipTier !== "FREE"
    ) {
      // Auto-fix: set basePlanCredits to current balance for existing users
      // Only do this for paid tiers (not FREE) to avoid self-healing issues
      basePlanCredits = user?.creditBalance || 0;
      carryOverCredits = 0;

      // Update in database (fire and forget - don't block the response)
      prisma.user
        .update({
          where: { id: ctx.user.id },
          data: {
            basePlanCredits: basePlanCredits,
            carryOverCredits: 0,
          },
        })
        .catch((err) =>
          console.error("Failed to auto-fix basePlanCredits:", err),
        );
    }

    return {
      user: {
        id: ctx.user.id,
        name: user?.name,
        email: user?.email,
        creditBalance: user?.creditBalance || 0,
        basePlanCredits: basePlanCredits,
        carryOverCredits: carryOverCredits,
        carryOverExpiresAt: carryOverExpiresAt,
        membershipTier: user?.membershipTier,
        membershipExpiresAt: user?.membershipExpiresAt,
        monthlyCreditsUsed: user?.monthlyCreditsUsed || 0,
        lifetimeCreditsUsed: user?.lifetimeCreditsUsed || 0,
        originalSubscriptionTier: originalSubscriptionTier, // ORIGINAL tier from Stripe
      },
      minimumBalance: CreditManager.getMinimumBalance(),
      timestamp: new Date().toISOString(),
    };
  }),

  // Get detailed credit information with recent activity
  getDetailedCredits: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;

    // Get current balance
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        creditBalance: true,
        basePlanCredits: true,
        carryOverCredits: true,
        carryOverExpiresAt: true,
        name: true,
        email: true,
        membershipTier: true,
        membershipExpiresAt: true,
        monthlyCreditsUsed: true,
        lifetimeCreditsUsed: true,
      },
    });

    // Get recent transactions
    const recentTransactions = await prisma.creditTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        amount: true,
        type: true,
        description: true,
        createdAt: true,
        metadata: true,
      },
    });

    // Get recent purchases
    const recentPurchases = await prisma.creditPurchase.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        credits: true,
        amountPaid: true,
        status: true,
        createdAt: true,
        stripePaymentId: true,
      },
    });

    return {
      user: {
        id: userId,
        name: user?.name,
        email: user?.email,
        creditBalance: user?.creditBalance || 0,
        basePlanCredits: user?.basePlanCredits || 0,
        carryOverCredits: user?.carryOverCredits || 0,
        carryOverExpiresAt: user?.carryOverExpiresAt,
        membershipTier: user?.membershipTier,
        membershipExpiresAt: user?.membershipExpiresAt,
        monthlyCreditsUsed: user?.monthlyCreditsUsed || 0,
        lifetimeCreditsUsed: user?.lifetimeCreditsUsed || 0,
      },
      recentActivity: {
        transactions: recentTransactions,
        purchases: recentPurchases,
      },
      minimumBalance: CreditManager.getMinimumBalance(),
      timestamp: new Date().toISOString(),
    };
  }),

  // Add test credits (for testing purposes)
  addTestCredits: protectedProcedure
    .input(
      z.object({
        credits: z.number().min(1).max(1000).default(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { credits } = input;
      const userId = ctx.user.id;

      // Get current balance
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          creditBalance: true,
          name: true,
          email: true,
        },
      });

      if (!currentUser) {
        throw new Error("User not found");
      }

      // Add credits and log transaction
      await prisma.$transaction([
        // Add credits to user
        prisma.user.update({
          where: { id: userId },
          data: { creditBalance: { increment: credits } },
        }),

        // Log transaction
        prisma.creditTransaction.create({
          data: {
            userId,
            amount: credits,
            type: "PURCHASE",
            description: `TEST: Added ${credits} credits`,
            metadata: { source: "test-endpoint" },
          },
        }),
      ]);

      // Get updated balance
      const updatedUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { creditBalance: true },
      });

      return {
        success: true,
        creditsAdded: credits,
        previousBalance: currentUser.creditBalance || 0,
        newBalance: updatedUser?.creditBalance || 0,
        user: currentUser,
      };
    }),

  // Get transaction history with pagination
  getTransactionHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, offset } = input;
      const userId = ctx.user.id;

      const transactions = await prisma.creditTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          amount: true,
          type: true,
          description: true,
          metadata: true,
          createdAt: true,
        },
      });

      const totalCount = await prisma.creditTransaction.count({
        where: { userId },
      });

      return {
        transactions,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: totalCount > offset + limit,
        },
      };
    }),

  // Get purchase history with pagination
  getPurchaseHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(10),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, offset } = input;
      const userId = ctx.user.id;

      const purchases = await prisma.creditPurchase.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
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

      const totalCount = await prisma.creditPurchase.count({
        where: { userId },
      });

      return {
        purchases,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: totalCount > offset + limit,
        },
      };
    }),

  // Check if user can afford an operation
  canAfford: protectedProcedure
    .input(
      z.object({
        amount: z.number().min(0.01),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { amount } = input;
      const userId = ctx.user.id;

      const affordabilityCheck = await CreditManager.canAffordOperation(
        userId,
        amount,
      );

      return {
        ...affordabilityCheck,
        minimumBalance: CreditManager.getMinimumBalance(),
        requestedAmount: amount,
      };
    }),

  // Check if user has never paid (for CTA targeting)
  hasNeverPaid: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        membershipTier: true,
        lifetimeCreditsUsed: true,
        creditTransactions: {
          where: {
            type: {
              in: ["PURCHASE", "MONTHLY_ALLOCATION"],
            },
          },
          take: 1,
        },
      },
    });

    if (!user) {
      return { hasNeverPaid: false };
    }

    const hasNeverPaid =
      user.membershipTier === "FREE" &&
      // user.lifetimeCreditsUsed === 0 &&
      user.creditTransactions.length === 0;

    return {
      hasNeverPaid,
      membershipTier: user.membershipTier,
      lifetimeCreditsUsed: user.lifetimeCreditsUsed,
      hasPurchaseTransactions: user.creditTransactions.length > 0,
    };
  }),

  // ==========================================
  // Shipper Cloud Credits (separate from Builder credits)
  // 1 credit = 1 cent ($0.01)
  // ==========================================

  /**
   * Get Cloud credit balance and recent top-up history
   */
  getCloudCredits: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        cloudCreditBalance: true,
        cloudLifetimeCreditsUsed: true,
        cloudFirstDeploymentBonus: true,
      },
    });

    // Get recent Cloud credit purchases (top-ups)
    const purchases = await prisma.cloudCreditPurchase.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        credits: true,
        amountCents: true,
        status: true,
        createdAt: true,
      },
    });

    return {
      balance: user?.cloudCreditBalance ?? 0,
      lifetimeUsed: user?.cloudLifetimeCreditsUsed ?? 0,
      hasReceivedBonus: user?.cloudFirstDeploymentBonus ?? false,
      purchases: purchases.map((p) => ({
        id: p.id,
        credits: p.credits,
        amountCents: p.amountCents,
        status: p.status,
        createdAt: p.createdAt.toISOString(),
      })),
    };
  }),

  /**
   * Get Cloud credit transaction history
   */
  getCloudCreditHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, offset } = input;
      const userId = ctx.user.id;

      const transactions = await prisma.cloudCreditTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          amount: true,
          type: true,
          description: true,
          createdAt: true,
        },
      });

      const totalCount = await prisma.cloudCreditTransaction.count({
        where: { userId },
      });

      return {
        transactions: transactions.map((t) => ({
          id: t.id,
          amount: t.amount,
          type: t.type,
          description: t.description,
          createdAt: t.createdAt.toISOString(),
        })),
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: totalCount > offset + limit,
        },
      };
    }),

  /**
   * Get Cloud credit usage breakdown per project
   * Shows how much each project has consumed (AI usage + Convex usage)
   */
  getCloudCreditsPerProject: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;

    // Get current billing period (this month)
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );

    // Get AI usage from CloudCreditTransaction (grouped by projectId in metadata)
    const aiTransactions = await prisma.cloudCreditTransaction.findMany({
      where: {
        userId,
        type: "USAGE",
        createdAt: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
      select: {
        amount: true,
        metadata: true,
      },
    });

    // Aggregate AI usage per project
    const projectCredits = new Map<
      string,
      {
        projectId: string;
        projectName: string;
        aiCredits: number;
        convexCredits: number;
      }
    >();

    for (const tx of aiTransactions) {
      const metadata = tx.metadata as { projectId?: string } | null;
      const projectId = metadata?.projectId;
      if (!projectId) continue;

      const credits = Math.abs(tx.amount); // amount is negative for usage

      const existing = projectCredits.get(projectId);
      if (existing) {
        existing.aiCredits += credits;
      } else {
        // Get project name
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          select: { name: true },
        });
        projectCredits.set(projectId, {
          projectId,
          projectName: project?.name || "Unknown Project",
          aiCredits: credits,
          convexCredits: 0,
        });
      }
    }

    // Get all teams the user owns for Convex usage
    const ownedTeams = await prisma.teamMember.findMany({
      where: { userId, role: "OWNER" },
      select: { teamId: true },
    });
    const teamIds = ownedTeams.map((t) => t.teamId);

    // Add Convex deployment usage
    if (teamIds.length > 0) {
      const deployments = await prisma.convexDeployment.findMany({
        where: {
          project: { teamId: { in: teamIds } },
          status: "ACTIVE",
        },
        select: {
          creditsUsedThisPeriod: true,
          currentPeriodStart: true,
          project: { select: { id: true, name: true } },
        },
      });

      for (const deployment of deployments) {
        const isCurrentPeriod =
          deployment.currentPeriodStart &&
          deployment.currentPeriodStart.getTime() === periodStart.getTime();
        const credits = isCurrentPeriod ? deployment.creditsUsedThisPeriod : 0;

        const existing = projectCredits.get(deployment.project.id);
        if (existing) {
          existing.convexCredits += credits;
        } else {
          projectCredits.set(deployment.project.id, {
            projectId: deployment.project.id,
            projectName: deployment.project.name,
            aiCredits: 0,
            convexCredits: credits,
          });
        }
      }
    }

    const projects = Array.from(projectCredits.values())
      .map((p) => ({
        projectId: p.projectId,
        projectName: p.projectName,
        credits: p.aiCredits + p.convexCredits,
        aiCredits: p.aiCredits,
        convexCredits: p.convexCredits,
      }))
      .sort((a, b) => b.credits - a.credits);

    const totalCredits = projects.reduce((sum, p) => sum + p.credits, 0);

    return {
      projects,
      totalCredits,
      billingPeriod: {
        start: periodStart.toISOString(),
        end: periodEnd.toISOString(),
      },
    };
  }),
});
