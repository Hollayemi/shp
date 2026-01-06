/**
 * Stripe Billing Credits Service
 *
 * Manages Stripe Credit Grants for unified Shipper Cloud credits.
 * Credit Grants are prepaid monetary credits that automatically apply
 * to metered usage invoices.
 *
 * @see https://docs.stripe.com/billing/subscriptions/usage-based/billing-credits
 */

import { prisma } from "@shipper/database";
import { stripe } from "../config/stripe.js";
import { logger } from "../config/logger.js";

/**
 * Shipper Cloud Credit pricing configuration
 *
 * Simple pricing: 1 credit = 1 cent ($0.01)
 * - $1 = 100 credits
 * - $5 = 500 credits
 * - $10 = 1000 credits
 * - etc.
 *
 * This makes it easy for users to understand their balance and usage costs.
 */
export const CREDIT_PRICING = {
  /** Cents per credit - 1 cent = 1 credit */
  CENTS_PER_CREDIT: 1,
  /** Credits per dollar - $1 = 100 credits */
  CREDITS_PER_DOLLAR: 100,
  /** Minimum credits for a purchase (100 credits = $1) */
  MIN_CREDITS: 100,
  /** Maximum credits per single purchase (100,000 credits = $1,000) */
  MAX_CREDITS: 100000,
  /** Bonus credits given on first Shipper Cloud deployment ($1 = 100 credits) */
  FIRST_DEPLOYMENT_BONUS: 100,
} as const;

/**
 * Convert credits to cents (USD)
 */
export function creditsToCents(credits: number): number {
  return credits * CREDIT_PRICING.CENTS_PER_CREDIT;
}

/**
 * Convert cents (USD) to credits
 */
export function centsToCredits(cents: number): number {
  return Math.floor(cents / CREDIT_PRICING.CENTS_PER_CREDIT);
}

export interface CreateCreditGrantOptions {
  /** User ID in our database */
  userId: string;
  /** Number of Shipper credits to grant */
  credits: number;
  /** Category: 'paid' for purchases, 'promotional' for bonuses */
  category: "paid" | "promotional";
  /** Optional name for the credit grant */
  name?: string;
  /** Optional expiration date */
  expiresAt?: Date;
  /** Optional metadata */
  metadata?: Record<string, string>;
}

export interface CreditGrantResult {
  success: boolean;
  creditGrantId?: string;
  credits?: number;
  amountCents?: number;
  error?: string;
}

/**
 * Create a Stripe Credit Grant for a user
 *
 * This creates prepaid credits that will automatically be applied
 * to the user's metered usage invoices.
 */
export async function createCreditGrant(
  options: CreateCreditGrantOptions
): Promise<CreditGrantResult> {
  if (!stripe) {
    return { success: false, error: "Stripe not configured" };
  }

  const { userId, credits, category, name, expiresAt, metadata } = options;

  // Validate credits amount
  if (credits < CREDIT_PRICING.MIN_CREDITS) {
    return {
      success: false,
      error: `Minimum credits is ${CREDIT_PRICING.MIN_CREDITS}`,
    };
  }

  if (credits > CREDIT_PRICING.MAX_CREDITS) {
    return {
      success: false,
      error: `Maximum credits is ${CREDIT_PRICING.MAX_CREDITS}`,
    };
  }

  try {
    // Get or create Stripe customer for user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        stripeCustomerId: true,
      },
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    let stripeCustomerId = user.stripeCustomerId;

    // Create Stripe customer if doesn't exist
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name ?? undefined,
        metadata: {
          userId: user.id,
          source: "shipper-billing",
        },
      });

      stripeCustomerId = customer.id;

      // Update user with Stripe customer ID
      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId },
      });

      logger.info({ userId, stripeCustomerId }, "Created Stripe customer for user");
    }

    const amountCents = creditsToCents(credits);
    const grantName = name ?? `Shipper Cloud Credits - ${credits} credits`;

    // Create the Credit Grant in Stripe
    const creditGrant = await stripe.billing.creditGrants.create({
      customer: stripeCustomerId,
      name: grantName,
      applicability_config: {
        scope: {
          price_type: "metered", // Only applies to metered prices (Convex usage)
        },
      },
      category,
      amount: {
        type: "monetary",
        monetary: {
          value: amountCents,
          currency: "usd",
        },
      },
      ...(expiresAt && { expires_at: Math.floor(expiresAt.getTime() / 1000) }),
      metadata: {
        userId,
        credits: credits.toString(),
        source: "shipper-cloud",
        ...metadata,
      },
    });

    logger.info(
      {
        userId,
        stripeCustomerId,
        creditGrantId: creditGrant.id,
        credits,
        amountCents,
        category,
      },
      "Created Stripe credit grant"
    );

    return {
      success: true,
      creditGrantId: creditGrant.id,
      credits,
      amountCents,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error, userId, credits }, "Failed to create credit grant");
    return { success: false, error: errorMessage };
  }
}

export interface CreditBalanceResult {
  success: boolean;
  /** Available credits (converted from monetary balance) */
  availableCredits?: number;
  /** Available balance in cents */
  availableBalanceCents?: number;
  /** Ledger balance in cents */
  ledgerBalanceCents?: number;
  error?: string;
}

/**
 * Get a user's available Stripe credit balance
 *
 * This returns the balance that will be automatically applied
 * to their next metered usage invoice.
 */
export async function getCreditBalance(userId: string): Promise<CreditBalanceResult> {
  if (!stripe) {
    return { success: false, error: "Stripe not configured" };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });

    if (!user?.stripeCustomerId) {
      return {
        success: true,
        availableCredits: 0,
        availableBalanceCents: 0,
        ledgerBalanceCents: 0,
      };
    }

    const creditBalanceSummary = await stripe.billing.creditBalanceSummary.retrieve({
      customer: user.stripeCustomerId,
      filter: {
        type: "applicability_scope",
        applicability_scope: {
          price_type: "metered",
        },
      },
    });

    // Extract monetary balance (assuming USD)
    // The balances array contains objects with monetary information
    const balances = creditBalanceSummary.balances as Array<{
      type?: string;
      monetary?: {
        currency?: string;
        available?: { value?: number };
        ledger?: { value?: number };
      };
    }>;
    let availableBalanceCents = 0;
    let ledgerBalanceCents = 0;

    for (const balance of balances) {
      if (balance.type === "monetary" && balance.monetary?.currency === "usd") {
        availableBalanceCents = balance.monetary.available?.value ?? 0;
        ledgerBalanceCents = balance.monetary.ledger?.value ?? 0;
      }
    }

    const availableCredits = centsToCredits(availableBalanceCents);

    return {
      success: true,
      availableCredits,
      availableBalanceCents,
      ledgerBalanceCents,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error, userId }, "Failed to get credit balance");
    return { success: false, error: errorMessage };
  }
}

export interface CreditGrant {
  id: string;
  name: string;
  category: string;
  amountCents: number;
  credits: number;
  appliedCents: number;
  appliedCredits: number;
  remainingCents: number;
  remainingCredits: number;
  effectiveAt: Date | null;
  expiresAt: Date | null;
  voidedAt: Date | null;
}

export interface ListCreditGrantsResult {
  success: boolean;
  grants?: CreditGrant[];
  error?: string;
}

/**
 * List all credit grants for a user
 */
export async function listCreditGrants(userId: string): Promise<ListCreditGrantsResult> {
  if (!stripe) {
    return { success: false, error: "Stripe not configured" };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });

    if (!user?.stripeCustomerId) {
      return { success: true, grants: [] };
    }

    const creditGrants = await stripe.billing.creditGrants.list({
      customer: user.stripeCustomerId,
      limit: 100,
    });

    const grants: CreditGrant[] = creditGrants.data.map((grant) => {
      // Extract monetary amounts
      let amountCents = 0;
      let appliedCents = 0;

      if (grant.amount.type === "monetary" && grant.amount.monetary) {
        amountCents = grant.amount.monetary.value;
      }

      // Applied amount from balance transactions would need separate API call
      // For now, we calculate remaining from the grant's current state
      const remainingCents = amountCents - appliedCents;

      return {
        id: grant.id,
        name: grant.name ?? "Credit Grant",
        category: grant.category,
        amountCents,
        credits: centsToCredits(amountCents),
        appliedCents,
        appliedCredits: centsToCredits(appliedCents),
        remainingCents,
        remainingCredits: centsToCredits(remainingCents),
        effectiveAt: grant.effective_at ? new Date(grant.effective_at * 1000) : null,
        expiresAt: grant.expires_at ? new Date(grant.expires_at * 1000) : null,
        voidedAt: grant.voided_at ? new Date(grant.voided_at * 1000) : null,
      };
    });

    return { success: true, grants };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error, userId }, "Failed to list credit grants");
    return { success: false, error: errorMessage };
  }
}

/**
 * Void a credit grant (before it's applied to any invoice)
 */
export async function voidCreditGrant(
  userId: string,
  creditGrantId: string
): Promise<{ success: boolean; error?: string }> {
  if (!stripe) {
    return { success: false, error: "Stripe not configured" };
  }

  try {
    // Verify the grant belongs to this user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });

    if (!user?.stripeCustomerId) {
      return { success: false, error: "User has no Stripe customer" };
    }

    const grant = await stripe.billing.creditGrants.retrieve(creditGrantId);

    if (grant.customer !== user.stripeCustomerId) {
      return { success: false, error: "Credit grant does not belong to user" };
    }

    // Use bracket notation to access 'void' as it's a reserved keyword in TypeScript
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (stripe.billing.creditGrants as any)["void"](creditGrantId);

    logger.info({ userId, creditGrantId }, "Voided credit grant");

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error, userId, creditGrantId }, "Failed to void credit grant");
    return { success: false, error: errorMessage };
  }
}

/**
 * Sync Stripe credit balance to local database
 *
 * Call this after credit purchases, usage, or invoice events
 * to keep the local creditBalance in sync with Stripe.
 */
export async function syncCreditBalanceToDatabase(userId: string): Promise<{
  success: boolean;
  localBalance?: number;
  stripeBalance?: number;
  error?: string;
}> {
  try {
    const balanceResult = await getCreditBalance(userId);

    if (!balanceResult.success) {
      return { success: false, error: balanceResult.error };
    }

    const stripeCredits = balanceResult.availableCredits ?? 0;

    // Update local database
    const user = await prisma.user.update({
      where: { id: userId },
      data: { creditBalance: stripeCredits },
      select: { creditBalance: true },
    });

    logger.info(
      { userId, localBalance: user.creditBalance, stripeBalance: stripeCredits },
      "Synced credit balance from Stripe"
    );

    return {
      success: true,
      localBalance: user.creditBalance,
      stripeBalance: stripeCredits,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error, userId }, "Failed to sync credit balance");
    return { success: false, error: errorMessage };
  }
}

/**
 * Create a credit grant from a successful payment
 *
 * Call this after a successful Stripe payment to grant credits.
 */
export async function createCreditGrantFromPayment(
  userId: string,
  credits: number,
  paymentIntentId: string
): Promise<CreditGrantResult> {
  return createCreditGrant({
    userId,
    credits,
    category: "paid",
    name: `Credit Purchase - ${credits} credits`,
    metadata: {
      paymentIntentId,
      purchaseType: "one_time",
    },
  });
}

/**
 * Create a promotional credit grant (for bonuses, refunds, etc.)
 */
export async function createPromotionalCredits(
  userId: string,
  credits: number,
  reason: string,
  expiresAt?: Date
): Promise<CreditGrantResult> {
  return createCreditGrant({
    userId,
    credits,
    category: "promotional",
    name: `Promotional Credits - ${reason}`,
    expiresAt,
    metadata: {
      reason,
      grantType: "promotional",
    },
  });
}

/**
 * Grant $1 bonus Cloud credits on first Shipper Cloud deployment
 *
 * This gives users 100 credits (= $1) to try out Shipper Cloud features
 * like databases, AI in deployed apps, etc.
 *
 * Returns:
 * - { success: true, granted: true } if bonus was granted
 * - { success: true, granted: false } if user already received bonus
 * - { success: false, error } on failure
 */
export async function grantFirstDeploymentBonus(
  userId: string,
  projectId: string
): Promise<{ success: boolean; granted: boolean; credits?: number; error?: string }> {
  try {
    // Check if user already received the bonus
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { cloudFirstDeploymentBonus: true },
    });

    if (!user) {
      return { success: false, granted: false, error: "User not found" };
    }

    if (user.cloudFirstDeploymentBonus) {
      logger.info({ userId, projectId }, "User already received first deployment bonus");
      return { success: true, granted: false };
    }

    const bonusCredits = CREDIT_PRICING.FIRST_DEPLOYMENT_BONUS; // 100 credits = $1

    // Create Stripe Credit Grant for the bonus
    const grantResult = await createCreditGrant({
      userId,
      credits: bonusCredits,
      category: "promotional",
      name: "Shipper Cloud Welcome Bonus",
      metadata: {
        reason: "first_deployment_bonus",
        projectId,
        grantType: "first_deployment",
      },
    });

    if (!grantResult.success) {
      logger.error(
        { userId, projectId, error: grantResult.error },
        "Failed to create Stripe credit grant for first deployment bonus"
      );
      return { success: false, granted: false, error: grantResult.error };
    }

    // Update user: mark bonus as received and add to local balance
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          cloudFirstDeploymentBonus: true,
          cloudCreditBalance: { increment: bonusCredits },
        },
      }),
      prisma.cloudCreditTransaction.create({
        data: {
          userId,
          amount: bonusCredits,
          type: "FIRST_DEPLOY_BONUS",
          description: `$1 welcome bonus for first Shipper Cloud deployment`,
          metadata: {
            projectId,
            creditGrantId: grantResult.creditGrantId,
          },
        },
      }),
    ]);

    logger.info(
      { userId, projectId, credits: bonusCredits, creditGrantId: grantResult.creditGrantId },
      "Granted first deployment bonus Cloud credits"
    );

    return { success: true, granted: true, credits: bonusCredits };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error, userId, projectId }, "Failed to grant first deployment bonus");
    return { success: false, granted: false, error: errorMessage };
  }
}
