// src/services/credits.ts
import { prisma, CreditType, MembershipTier } from "@shipper/database";

const MINIMUM_CREDIT_BALANCE = 0.5;

export class CreditManager {
  static async getUserCredits(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        creditBalance: true,
        membershipTier: true,
        membershipExpiresAt: true,
        lastCreditReset: true,
        monthlyCreditsUsed: true,
      },
    });

    if (!user) throw new Error("User not found");

    // Check if monthly credits need to be allocated
    await this.allocateMonthlyCredits(userId, user);

    return user.creditBalance;
  }

  static async deductCredits(
    userId: string,
    amount: number,
    type: CreditType,
    description: string,
    metadata?: any,
  ) {
    // Guard clause: Don't process 0 credit deductions
    if (amount === 0) {
      console.warn(
        `[CreditManager] Attempted to deduct 0 credits for user ${userId}. Skipping deduction.`,
      );
      return true;
    }
    if (amount < 0) {
      throw new Error(
        `[CreditManager] Attempted to deduct a negative amount (${amount}) for user ${userId}. This is not allowed.`,
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        creditBalance: true,
        carryOverCredits: true,
        basePlanCredits: true,
        carryOverExpiresAt: true,
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // 🔒 AUTO-EXPIRE: Check if carry-over credits have expired
    const now = new Date();
    const carryOverExpired =
      user.carryOverExpiresAt && new Date(user.carryOverExpiresAt) <= now;

    if (carryOverExpired && user.carryOverCredits > 0) {
      console.log(
        `⏰ Carry-over credits expired for user ${userId}, auto-clearing ${user.carryOverCredits} credits`,
      );

      const expiredAmount = user.carryOverCredits;

      // Auto-clear expired carry-over credits
      await prisma.user.update({
        where: { id: userId },
        data: {
          carryOverCredits: 0,
          carryOverExpiresAt: null,
          creditBalance: { decrement: expiredAmount },
        },
      });

      // Update local user object
      user.carryOverCredits = 0;
      user.creditBalance -= expiredAmount;
    }

    if (user.creditBalance < amount) {
      throw new Error("Insufficient credits");
    }

    // Check if deduction would leave user below minimum balance
    const balanceAfterDeduction = user.creditBalance - amount;
    if (balanceAfterDeduction < MINIMUM_CREDIT_BALANCE) {
      throw new Error(
        `Insufficient credits. Minimum balance of ${MINIMUM_CREDIT_BALANCE} credits must be maintained`,
      );
    }

    // 💡 SMART DEDUCTION: Deduct carry-over credits first, then base plan credits
    const currentCarryOver = user.carryOverCredits || 0;
    const currentBasePlan = user.basePlanCredits || 0;

    let carryOverDeducted = 0;
    let basePlanDeducted = 0;

    if (currentCarryOver > 0) {
      // Deduct from carry-over first
      carryOverDeducted = Math.min(amount, currentCarryOver);
      const remaining = amount - carryOverDeducted;

      if (remaining > 0) {
        // If still need more, deduct from base plan
        basePlanDeducted = remaining;
      }
    } else {
      // No carry-over, deduct from base plan
      basePlanDeducted = amount;
    }

    const newCarryOver = currentCarryOver - carryOverDeducted;
    const newBasePlan = currentBasePlan - basePlanDeducted;

    console.log(`💳 Credit deduction for user ${userId}:`);
    console.log(`  Amount: ${amount}`);
    console.log(`  From carry-over: ${carryOverDeducted}`);
    console.log(`  From base plan: ${basePlanDeducted}`);
    console.log(`  New carry-over: ${newCarryOver}`);
    console.log(`  New base plan: ${newBasePlan}`);

    await prisma.$transaction([
      // Deduct credits with smart allocation
      prisma.user.update({
        where: { id: userId },
        data: {
          creditBalance: { decrement: amount },
          carryOverCredits: newCarryOver,
          basePlanCredits: newBasePlan,
          lifetimeCreditsUsed: { increment: amount },
          monthlyCreditsUsed: { increment: amount },
        },
      }),

      // Log transaction with breakdown
      prisma.creditTransaction.create({
        data: {
          userId,
          amount: -amount,
          type,
          description,
          metadata: {
            ...metadata,
            carryOverDeducted,
            basePlanDeducted,
            newCarryOver,
            newBasePlan,
          },
        },
      }),
    ]);

    return true;
  }

  static async canAffordOperation(userId: string, amount: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { creditBalance: true },
    });

    if (!user) {
      return { canAfford: false, reason: "User not found" };
    }

    if (user.creditBalance < amount) {
      return {
        canAfford: false,
        reason: "Insufficient credits",
        currentBalance: user.creditBalance,
      };
    }

    const balanceAfterDeduction = user.creditBalance - amount;
    if (balanceAfterDeduction < MINIMUM_CREDIT_BALANCE) {
      return {
        canAfford: false,
        reason: `Minimum balance of ${MINIMUM_CREDIT_BALANCE} credits must be maintained`,
        currentBalance: user.creditBalance,
        requiredAmount: amount,
        minimumBalance: MINIMUM_CREDIT_BALANCE,
      };
    }

    return {
      canAfford: true,
      currentBalance: user.creditBalance,
      balanceAfterOperation: balanceAfterDeduction,
    };
  }

  static getMinimumBalance(): number {
    return MINIMUM_CREDIT_BALANCE;
  }

  static async addCredits(
    userId: string,
    amount: number,
    type: CreditType,
    description: string,
    metadata?: any,
  ) {
    // WORKSPACE-CENTRIC: Check if user has a personal workspace
    const personalWorkspace = await prisma.team.findFirst({
      where: {
        isPersonal: true,
        members: { some: { userId, role: "OWNER" } },
      },
      select: { id: true, creditBalance: true },
    });

    if (personalWorkspace) {
      // Add credits to personal workspace
      await prisma.$transaction([
        prisma.team.update({
          where: { id: personalWorkspace.id },
          data: { creditBalance: { increment: amount } },
        }),
        prisma.creditTransaction.create({
          data: {
            teamId: personalWorkspace.id,
            userId,
            amount,
            type,
            description,
            metadata: {
              ...metadata,
              targetType: "workspace",
              workspaceId: personalWorkspace.id,
            },
          },
        }),
      ]);
    } else {
      // Legacy: Add to user-level credits (for users without workspaces)
      await prisma.$transaction([
        prisma.user.update({
          where: { id: userId },
          data: { creditBalance: { increment: amount } },
        }),
        prisma.creditTransaction.create({
          data: {
            userId,
            amount,
            type,
            description,
            metadata: {
              ...metadata,
              targetType: "user-legacy",
            },
          },
        }),
      ]);
    }
  }

  private static async allocateMonthlyCredits(userId: string, user: any) {
    const now = new Date();
    const lastReset = user.lastCreditReset
      ? new Date(user.lastCreditReset)
      : null;

    // Check if a month has passed since last reset
    const shouldReset =
      !lastReset ||
      now.getMonth() !== lastReset.getMonth() ||
      now.getFullYear() !== lastReset.getFullYear();

    if (
      shouldReset &&
      user.membershipExpiresAt &&
      new Date(user.membershipExpiresAt) > now
    ) {
      // Only Pro users get monthly credits now (no free tier)
      if (user.membershipTier === "PRO") {
        // For Pro users, we'll use a default credit allocation
        // In a production system, you'd want to store the subscription details
        // or fetch them from Stripe metadata
        const defaultProCredits = 400; // Default to the popular option

        await this.addCredits(
          userId,
          defaultProCredits,
          "MONTHLY_ALLOCATION",
          `Monthly Pro credit allocation (${defaultProCredits} credits)`,
        );

        // WORKSPACE-CENTRIC: Update workspace if exists, otherwise user
        const personalWorkspace = await prisma.team.findFirst({
          where: {
            isPersonal: true,
            members: { some: { userId, role: "OWNER" } },
          },
          select: { id: true },
        });

        if (personalWorkspace) {
          await prisma.team.update({
            where: { id: personalWorkspace.id },
            data: {
              lastCreditReset: now,
              monthlyCreditsUsed: 0, // Reset monthly usage
            },
          });
        } else {
          await prisma.user.update({
            where: { id: userId },
            data: {
              lastCreditReset: now,
              monthlyCreditsUsed: 0, // Reset monthly usage
            },
          });
        }
      }
      // Enterprise users get custom credit allocations handled separately
      // No automatic allocation for them since it's contact-based
    }
  }

  // ============================================
  // WORKSPACE-LEVEL CREDIT METHODS (New System)
  // ============================================

  /**
   * Get workspace credits by teamId
   */
  static async getWorkspaceCredits(teamId: string) {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: {
        creditBalance: true,
        membershipTier: true,
        membershipExpiresAt: true,
        lastCreditReset: true,
        monthlyCreditsUsed: true,
        basePlanCredits: true,
        carryOverCredits: true,
      },
    });

    if (!team) throw new Error("Workspace not found");

    return team.creditBalance;
  }

  /**
   * Deduct credits from a workspace (team)
   * This is the new workspace-centric deduction method
   * @param teamId - The workspace/team ID
   * @param amount - Amount of credits to deduct
   * @param type - Type of credit transaction
   * @param description - Description of the transaction
   * @param userId - Optional user ID who triggered this deduction (for per-user tracking)
   * @param metadata - Optional metadata
   */
  static async deductWorkspaceCredits(
    teamId: string,
    amount: number,
    type: CreditType,
    description: string,
    userId?: string,
    metadata?: any,
  ) {
    // Guard clause: Don't process 0 credit deductions
    if (amount === 0) {
      console.warn(
        `[CreditManager] Attempted to deduct 0 credits for workspace ${teamId}. Skipping deduction.`,
      );
      return true;
    }
    if (amount < 0) {
      throw new Error(
        `[CreditManager] Attempted to deduct a negative amount (${amount}) for workspace ${teamId}. This is not allowed.`,
      );
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: {
        creditBalance: true,
        carryOverCredits: true,
        basePlanCredits: true,
        carryOverExpiresAt: true,
      },
    });

    if (!team) {
      throw new Error("Workspace not found");
    }

    // 🔒 AUTO-EXPIRE: Check if carry-over credits have expired
    const now = new Date();
    const carryOverExpired =
      team.carryOverExpiresAt && new Date(team.carryOverExpiresAt) <= now;

    if (carryOverExpired && team.carryOverCredits > 0) {
      console.log(
        `⏰ Carry-over credits expired for workspace ${teamId}, auto-clearing ${team.carryOverCredits} credits`,
      );

      const expiredAmount = team.carryOverCredits;

      // Auto-clear expired carry-over credits
      await prisma.team.update({
        where: { id: teamId },
        data: {
          carryOverCredits: 0,
          carryOverExpiresAt: null,
          creditBalance: { decrement: expiredAmount },
        },
      });

      // Update local team object
      team.carryOverCredits = 0;
      team.creditBalance -= expiredAmount;
    }

    if (team.creditBalance < amount) {
      throw new Error("Insufficient workspace credits");
    }

    // Check if deduction would leave workspace below minimum balance
    const balanceAfterDeduction = team.creditBalance - amount;
    if (balanceAfterDeduction < MINIMUM_CREDIT_BALANCE) {
      throw new Error(
        `Insufficient workspace credits. Minimum balance of ${MINIMUM_CREDIT_BALANCE} credits must be maintained`,
      );
    }

    // 💡 SMART DEDUCTION: Deduct carry-over first, then base plan, then bonus (overflow)
    const currentCarryOver = team.carryOverCredits || 0;
    const currentBasePlan = team.basePlanCredits || 0;
    // Bonus credits = total balance minus tracked buckets (derived, not stored)
    const currentBonus = Math.max(
      0,
      team.creditBalance - currentCarryOver - currentBasePlan,
    );

    let carryOverDeducted = 0;
    let basePlanDeducted = 0;
    let bonusDeducted = 0;
    let remaining = amount;

    // 1. Deduct from carry-over first
    if (remaining > 0 && currentCarryOver > 0) {
      carryOverDeducted = Math.min(remaining, currentCarryOver);
      remaining -= carryOverDeducted;
    }

    // 2. Deduct from base plan second
    if (remaining > 0 && currentBasePlan > 0) {
      basePlanDeducted = Math.min(remaining, currentBasePlan);
      remaining -= basePlanDeducted;
    }

    // 3. Deduct from bonus (overflow) last
    if (remaining > 0 && currentBonus > 0) {
      bonusDeducted = Math.min(remaining, currentBonus);
      remaining -= bonusDeducted;
    }

    const newCarryOver = currentCarryOver - carryOverDeducted;
    const newBasePlan = currentBasePlan - basePlanDeducted;
    const newBonus = currentBonus - bonusDeducted;

    console.log(`💳 Credit deduction for workspace ${teamId}:`);
    console.log(`  Amount: ${amount}`);
    console.log(
      `  From carry-over: ${carryOverDeducted} (was ${currentCarryOver}, now ${newCarryOver})`,
    );
    console.log(
      `  From base plan: ${basePlanDeducted} (was ${currentBasePlan}, now ${newBasePlan})`,
    );
    console.log(
      `  From bonus: ${bonusDeducted} (was ${currentBonus}, now ${newBonus})`,
    );

    await prisma.$transaction([
      // Deduct credits with smart allocation
      prisma.team.update({
        where: { id: teamId },
        data: {
          creditBalance: { decrement: amount },
          carryOverCredits: newCarryOver,
          basePlanCredits: newBasePlan,
          // Note: bonus is derived, not stored - it's the overflow in creditBalance
          lifetimeCreditsUsed: { increment: amount },
          monthlyCreditsUsed: { increment: amount },
        },
      }),

      // Log transaction with breakdown (linked to team and user)
      prisma.creditTransaction.create({
        data: {
          teamId,
          userId, // Track which user triggered this deduction
          amount: -amount,
          type,
          description,
          metadata: {
            ...metadata,
            carryOverDeducted,
            basePlanDeducted,
            bonusDeducted,
            newCarryOver,
            newBasePlan,
            newBonus,
          },
        },
      }),
    ]);

    return true;
  }

  /**
   * Check if workspace can afford an operation
   */
  static async canWorkspaceAffordOperation(teamId: string, amount: number) {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { creditBalance: true },
    });

    if (!team) {
      return { canAfford: false, reason: "Workspace not found" };
    }

    if (team.creditBalance < amount) {
      return {
        canAfford: false,
        reason: "Insufficient workspace credits",
        currentBalance: team.creditBalance,
      };
    }

    const balanceAfterDeduction = team.creditBalance - amount;
    if (balanceAfterDeduction < MINIMUM_CREDIT_BALANCE) {
      return {
        canAfford: false,
        reason: `Minimum balance of ${MINIMUM_CREDIT_BALANCE} credits must be maintained`,
        currentBalance: team.creditBalance,
        requiredAmount: amount,
        minimumBalance: MINIMUM_CREDIT_BALANCE,
      };
    }

    return {
      canAfford: true,
      currentBalance: team.creditBalance,
      balanceAfterOperation: balanceAfterDeduction,
    };
  }

  /**
   * Add credits to a workspace
   */
  static async addWorkspaceCredits(
    teamId: string,
    amount: number,
    type: CreditType,
    description: string,
    metadata?: any,
  ) {
    await prisma.$transaction([
      prisma.team.update({
        where: { id: teamId },
        data: { creditBalance: { increment: amount } },
      }),

      prisma.creditTransaction.create({
        data: {
          teamId,
          amount,
          type,
          description,
          metadata,
        },
      }),
    ]);
  }

  /**
   * Get workspace ID from project ID
   * Helper method to find which workspace a project belongs to
   */
  static async getWorkspaceIdFromProject(
    projectId: string,
  ): Promise<string | null> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { teamId: true, userId: true },
    });

    if (!project) return null;

    // If project has a teamId, use it
    if (project.teamId) {
      return project.teamId;
    }

    // If project only has userId (legacy), find user's personal workspace
    if (project.userId) {
      const personalWorkspace = await prisma.team.findFirst({
        where: {
          isPersonal: true,
          members: {
            some: {
              userId: project.userId,
              role: "OWNER",
            },
          },
        },
        select: { id: true },
      });
      return personalWorkspace?.id || null;
    }

    return null;
  }
}
