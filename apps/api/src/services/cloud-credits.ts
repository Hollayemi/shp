/**
 * Cloud Credit Manager Service
 *
 * Manages Shipper Cloud credits for teams.
 *
 * Note: The current database schema stores cloud credits at the user level,
 * not the team level. This service uses the team owner's credits as the
 * team's credit balance. A future migration should add team-level cloud
 * credit fields for proper team billing.
 *
 * 1 credit = 1 cent ($0.01)
 */

import { prisma, CloudCreditType, Prisma } from "@shipper/database";
import { logger } from "../config/logger.js";

interface TransactionHistoryOptions {
  limit?: number;
  offset?: number;
  type?: CloudCreditType;
}

interface TransactionRecord {
  id: string;
  amount: number;
  type: CloudCreditType;
  description: string;
  metadata: unknown;
  createdAt: Date;
}

/**
 * Get the team owner's user ID for credit operations
 */
async function getTeamOwnerId(teamId: string): Promise<string | null> {
  const owner = await prisma.teamMember.findFirst({
    where: {
      teamId,
      role: "OWNER",
    },
    select: { userId: true },
  });

  return owner?.userId ?? null;
}

export const CloudCreditManager = {
  /**
   * Get cloud credit balance for a team
   * Uses the team owner's cloud credit balance
   */
  async getBalance(teamId: string): Promise<number> {
    const ownerId = await getTeamOwnerId(teamId);

    if (!ownerId) {
      logger.warn({ teamId }, "No team owner found for credit balance lookup");
      return 0;
    }

    const user = await prisma.user.findUnique({
      where: { id: ownerId },
      select: { cloudCreditBalance: true },
    });

    return user?.cloudCreditBalance ?? 0;
  },

  /**
   * Get transaction history for a team
   * Uses the team owner's transaction history
   */
  async getTransactionHistory(
    teamId: string,
    options: TransactionHistoryOptions = {}
  ): Promise<TransactionRecord[]> {
    const { limit = 50, offset = 0, type } = options;

    const ownerId = await getTeamOwnerId(teamId);

    if (!ownerId) {
      logger.warn({ teamId }, "No team owner found for transaction history");
      return [];
    }

    const transactions = await prisma.cloudCreditTransaction.findMany({
      where: {
        userId: ownerId,
        ...(type ? { type } : {}),
      },
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

    return transactions;
  },

  /**
   * Add credits to a team's balance
   * Adds credits to the team owner's account
   */
  async addCredits(
    teamId: string,
    amount: number,
    type: "TOP_UP" | "PROMOTIONAL" | "REFUND" | "AUTO_TOP_UP",
    description: string,
    metadata?: Record<string, unknown>
  ): Promise<{ success: boolean; newBalance: number }> {
    const ownerId = await getTeamOwnerId(teamId);

    if (!ownerId) {
      throw new Error(`No team owner found for team ${teamId}`);
    }

    // Convert credits: $1 = 100 credits (1 credit = 1 cent)
    const credits = Math.round(amount * 100);

    // Map route type to schema type
    const creditType: CloudCreditType =
      type === "TOP_UP"
        ? "PURCHASE"
        : type === "AUTO_TOP_UP"
          ? "AUTO_TOP_UP"
          : type === "REFUND"
            ? "REFUND"
            : "PROMOTIONAL";

    // Use a transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Create transaction record
      await tx.cloudCreditTransaction.create({
        data: {
          userId: ownerId,
          amount: credits,
          type: creditType,
          description,
          metadata: (metadata as Prisma.InputJsonValue) ?? undefined,
        },
      });

      // Update user balance
      const updatedUser = await tx.user.update({
        where: { id: ownerId },
        data: {
          cloudCreditBalance: { increment: credits },
        },
        select: { cloudCreditBalance: true },
      });

      return updatedUser.cloudCreditBalance;
    });

    logger.info({
      msg: "Cloud credits added to team",
      teamId,
      ownerId,
      amountUSD: amount,
      credits,
      type: creditType,
      newBalance: result,
    });

    return { success: true, newBalance: result };
  },

  /**
   * Deduct credits from a team's balance
   * Deducts from the team owner's account
   */
  async deductCredits(
    teamId: string,
    credits: number,
    description: string,
    metadata?: Record<string, unknown>
  ): Promise<{ success: boolean; newBalance: number }> {
    const ownerId = await getTeamOwnerId(teamId);

    if (!ownerId) {
      throw new Error(`No team owner found for team ${teamId}`);
    }

    // Check balance first
    const user = await prisma.user.findUnique({
      where: { id: ownerId },
      select: { cloudCreditBalance: true },
    });

    if (!user || user.cloudCreditBalance < credits) {
      throw new Error("Insufficient cloud credits");
    }

    // Use a transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Create transaction record (negative amount for deduction)
      await tx.cloudCreditTransaction.create({
        data: {
          userId: ownerId,
          amount: -credits,
          type: "USAGE",
          description,
          metadata: (metadata as Prisma.InputJsonValue) ?? undefined,
        },
      });

      // Update user balance
      const updatedUser = await tx.user.update({
        where: { id: ownerId },
        data: {
          cloudCreditBalance: { decrement: credits },
          cloudLifetimeCreditsUsed: { increment: credits },
        },
        select: { cloudCreditBalance: true },
      });

      return updatedUser.cloudCreditBalance;
    });

    logger.info({
      msg: "Cloud credits deducted from team",
      teamId,
      ownerId,
      credits,
      newBalance: result,
    });

    return { success: true, newBalance: result };
  },
};
