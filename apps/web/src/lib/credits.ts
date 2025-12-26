// src/lib/credits.ts
import { prisma } from "@/lib/db";
import { CREDIT_COSTS, getProCreditOption } from "@/lib/pricing";
import { CreditType, MembershipTier } from "@/lib/db";

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
      throw new Error(`[CreditManager] Attempted to deduct a negative amount (${amount}) for user ${userId}. This is not allowed.`);
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
    const carryOverExpired = user.carryOverExpiresAt && new Date(user.carryOverExpiresAt) <= now;
    
    if (carryOverExpired && user.carryOverCredits > 0) {
      console.log(`⏰ Carry-over credits expired for user ${userId}, auto-clearing ${user.carryOverCredits} credits`);
      
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
      return { canAfford: false, reason: "Insufficient credits" };
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
          metadata,
        },
      }),
    ]);
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
      if (user.membershipTier === MembershipTier.PRO) {
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

        await prisma.user.update({
          where: { id: userId },
          data: {
            lastCreditReset: now,
            monthlyCreditsUsed: 0, // Reset monthly usage
          },
        });
      }
      // Enterprise users get custom credit allocations handled separately
      // No automatic allocation for them since it's contact-based
    }
  }
}
