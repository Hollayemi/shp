/**
 * Cloud Credit Manager Service
 *
 * Manages Shipper Cloud credits for teams/workspaces.
 *
 * 🏢 WORKSPACE-CENTRIC: All operations use team.cloudCreditBalance directly.
 * This is the source of truth for cloud credits.
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

export const CloudCreditManager = {
  /**
   * Get cloud credit balance for a team/workspace
   * 🏢 WORKSPACE-CENTRIC: Uses team.cloudCreditBalance directly
   */
  async getBalance(teamId: string): Promise<number> {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { cloudCreditBalance: true },
    });

    if (!team) {
      logger.warn({ teamId }, "Team not found for credit balance lookup");
      return 0;
    }

    return team.cloudCreditBalance ?? 0;
  },

  /**
   * Get transaction history for a team/workspace
   * 🏢 WORKSPACE-CENTRIC: Queries by teamId
   */
  async getTransactionHistory(
    teamId: string,
    options: TransactionHistoryOptions = {},
  ): Promise<TransactionRecord[]> {
    const { limit = 50, offset = 0, type } = options;

    const transactions = await prisma.cloudCreditTransaction.findMany({
      where: {
        teamId,
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
   * 🏢 WORKSPACE-CENTRIC: Adds to team.cloudCreditBalance
   */
  async addCredits(
    teamId: string,
    amount: number,
    type: "TOP_UP" | "PROMOTIONAL" | "REFUND" | "AUTO_TOP_UP",
    description: string,
    metadata?: Record<string, unknown>,
    userId?: string,
  ): Promise<{ success: boolean; newBalance: number }> {
    // Verify team exists
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true },
    });

    if (!team) {
      throw new Error(`Team not found: ${teamId}`);
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
      // Create transaction record (linked to team)
      await tx.cloudCreditTransaction.create({
        data: {
          teamId,
          userId, // Track who triggered the addition (optional)
          amount: credits,
          type: creditType,
          description,
          metadata: (metadata as Prisma.InputJsonValue) ?? undefined,
        },
      });

      // Update team balance
      const updatedTeam = await tx.team.update({
        where: { id: teamId },
        data: {
          cloudCreditBalance: { increment: credits },
        },
        select: { cloudCreditBalance: true },
      });

      return updatedTeam.cloudCreditBalance;
    });

    logger.info({
      msg: "Cloud credits added to workspace",
      teamId,
      userId,
      amountUSD: amount,
      credits,
      type: creditType,
      newBalance: result,
    });

    return { success: true, newBalance: result };
  },

  /**
   * Deduct credits from a team's balance
   * 🏢 WORKSPACE-CENTRIC: Deducts from team.cloudCreditBalance
   * @param teamId - The workspace/team ID
   * @param credits - Amount of credits to deduct
   * @param description - Description of the transaction
   * @param userId - Optional user ID who triggered this deduction (for per-user tracking)
   * @param metadata - Optional metadata
   */
  async deductCredits(
    teamId: string,
    credits: number,
    description: string,
    userId?: string,
    metadata?: Record<string, unknown>,
  ): Promise<{ success: boolean; newBalance: number }> {
    // Check team exists and has sufficient balance
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { cloudCreditBalance: true },
    });

    if (!team) {
      throw new Error(`Team not found: ${teamId}`);
    }

    if ((team.cloudCreditBalance ?? 0) < credits) {
      throw new Error("Insufficient cloud credits");
    }

    // Use a transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Create transaction record (negative amount for deduction)
      await tx.cloudCreditTransaction.create({
        data: {
          teamId,
          userId, // Track who triggered the deduction
          amount: -credits,
          type: "USAGE",
          description,
          metadata: (metadata as Prisma.InputJsonValue) ?? undefined,
        },
      });

      // Update team balance
      const updatedTeam = await tx.team.update({
        where: { id: teamId },
        data: {
          cloudCreditBalance: { decrement: credits },
          cloudLifetimeCreditsUsed: { increment: credits },
        },
        select: { cloudCreditBalance: true },
      });

      return updatedTeam.cloudCreditBalance;
    });

    logger.info({
      msg: "Cloud credits deducted from workspace",
      teamId,
      userId,
      credits,
      newBalance: result,
    });

    return { success: true, newBalance: result };
  },
};
