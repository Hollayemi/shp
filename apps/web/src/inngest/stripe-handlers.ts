import { inngest } from "@/inngest/client";
import { prisma } from "@shipper/database";
import { MembershipTier } from "@shipper/database";
import { isAdminEmail } from "@/lib/admin";
import { getTierById } from "@/lib/pricing";
import { stripe } from "@/lib/stripe";

/**
 * Credit pricing configuration for Stripe Credit Grants
 *
 * Builder Credits: $25 = 100 credits, so $0.25 per credit = 25 cents per credit
 * Cloud Credits: 1 credit = 1 cent ($0.01) - used for Convex metered billing
 */
const CREDIT_PRICING = {
  BUILDER_CENTS_PER_CREDIT: 25,
  CLOUD_CENTS_PER_CREDIT: 1,
} as const;

/**
 * Create a Stripe Credit Grant for a user
 * This allows credits to be automatically applied to metered usage invoices
 *
 * Note: Only used for Cloud credits (Shipper Cloud / Convex metered billing)
 * Builder credits do not use Stripe Credit Grants
 */
async function createStripeCreditGrant(options: {
  stripeCustomerId: string;
  userId: string;
  credits: number;
  category: "paid" | "promotional";
  name: string;
  creditType: "cloud"; // Only cloud credits use Stripe Credit Grants
  metadata?: Record<string, string>;
}): Promise<{ success: boolean; creditGrantId?: string; error?: string }> {
  const { stripeCustomerId, userId, credits, category, name, creditType, metadata } = options;

  try {
    // Cloud credits: 1 credit = 1 cent
    const centsPerCredit = creditType === "cloud"
      ? CREDIT_PRICING.CLOUD_CENTS_PER_CREDIT
      : CREDIT_PRICING.BUILDER_CENTS_PER_CREDIT;
    const amountCents = credits * centsPerCredit;

    const creditGrant = await stripe.billing.creditGrants.create({
      customer: stripeCustomerId,
      name,
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
      metadata: {
        userId,
        credits: credits.toString(),
        source: "shipper-cloud",
        ...metadata,
      },
    });

    console.log(`✅ Created Stripe Credit Grant: ${creditGrant.id} for ${credits} credits`);

    // Track the credit grant in our database
    await prisma.stripeCreditGrant.create({
      data: {
        userId,
        stripeCreditGrantId: creditGrant.id,
        stripeCustomerId,
        name,
        category,
        amountCents,
        credits,
        status: "ACTIVE",
        metadata: metadata ?? {},
      },
    });

    return { success: true, creditGrantId: creditGrant.id };
  } catch (error) {
    console.error("❌ Failed to create Stripe Credit Grant:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export const processStripeWebhook = inngest.createFunction(
  {
    id: "process-stripe-webhook",
    retries: 3,
  },
  { event: "stripe/webhook" },
  async ({ event, step }) => {
    console.log(`🔄 Processing webhook: ${event.data.type}`);
    console.log(`📦 Webhook data:`, JSON.stringify(event.data, null, 2));

    const { type, data } = event.data;

    switch (type) {
      case "checkout.session.completed":
        await step.run("handle-checkout-completed", async () => {
          console.log("💳 Handling checkout.session.completed");
          return await handleCheckoutCompleted(data);
        });
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
        await step.run("handle-subscription-change", async () => {
          console.log("📋 Handling subscription change:", type);
          return await handleSubscriptionChange(data);
        });
        break;

      case "customer.subscription.deleted":
        await step.run("handle-subscription-canceled", async () => {
          console.log("❌ Handling subscription cancellation");
          return await handleSubscriptionCanceled(data);
        });
        break;

      case "invoice.payment_succeeded":
        await step.run("handle-payment-success", async () => {
          console.log("💰 Handling invoice.payment_succeeded");
          return await handlePaymentSuccess(data);
        });
        break;

      case "invoice.payment_failed":
        await step.run("handle-payment-failed", async () => {
          console.log("❌ Handling invoice.payment_failed");
          return await handlePaymentFailed(data);
        });
        break;

      default:
        console.log(`🤷‍♂️ Unhandled webhook type: ${type}`);
    }
  },
);

async function handleCheckoutCompleted(session: any) {
  console.log("💳 Processing checkout completion:", session.id);
  console.log("📦 Session metadata:", session.metadata);

  const userId = session.metadata?.userId;
  if (!userId) {
    console.error("❌ No userId in session metadata");
    return;
  }

  console.log("👤 Processing for user:", userId);

  // Handle credit purchase (one-time payment)
  if (session.metadata?.type === "credit_purchase") {
    console.log("💰 Processing credit purchase");
    const credits = parseInt(session.metadata.credits);

    console.log(`💳 Adding ${credits} credits to user ${userId}`);
    console.log(
      `💰 Payment info: amount=${session.amount_total}, payment_intent=${session.payment_intent}`,
    );

    try {
      console.log("🔄 Starting database transaction...");

      // Check current user state first
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { creditBalance: true, name: true, email: true, stripeCustomerId: true },
      });

      console.log("👤 Current user state:", currentUser);

      // Handle case where payment_intent is null (e.g., 100% discount coupon used)
      // Use session.id as fallback since stripePaymentId must be unique and non-null
      const stripePaymentId = session.payment_intent || `free_${session.id}`;

      const result = await prisma.$transaction([
        // Add credits to user
        prisma.user.update({
          where: { id: userId },
          data: { creditBalance: { increment: credits } },
        }),

        // Log purchase
        prisma.creditPurchase.create({
          data: {
            userId,
            credits,
            amountPaid: session.amount_total || 0,
            stripePaymentId,
            status: "COMPLETED",
          },
        }),

        // Log transaction
        prisma.creditTransaction.create({
          data: {
            userId,
            amount: credits,
            type: "PURCHASE",
            description: `Purchased ${credits} credits`,
            metadata: { sessionId: session.id },
          },
        }),
      ]);

      console.log(`✅ Database transaction completed successfully`);
      console.log(
        "📊 Transaction results:",
        result.map((r) => ({
          id: r.id,
          ...("creditBalance" in r ? { creditBalance: r.creditBalance } : {}),
        })),
      );

      // Verify the update
      const updatedUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { creditBalance: true },
      });

      console.log(`💰 Updated user balance: ${updatedUser?.creditBalance}`);
      console.log(`✅ Successfully added ${credits} credits to user ${userId}`);

      // NOTE: Stripe Credit Grants are NOT created for Builder credits
      // They are only used for Cloud credits (Shipper Cloud / Convex metered billing)
    } catch (error) {
      console.error("❌ Failed to add credits:", error);
      console.error("❌ Error details:", {
        name: error instanceof Error ? error.name : "Unknown",
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : "No stack trace",
      });
      throw error;
    }
  }

  // Handle CLOUD credit purchase (separate from Builder credits)
  // 1 credit = 1 cent ($0.01)
  if (session.metadata?.type === "cloud_credit_purchase") {
    console.log("☁️ Processing Cloud credit purchase");
    const credits = parseInt(session.metadata.credits);

    console.log(`☁️ Adding ${credits} Cloud credits to user ${userId}`);

    try {
      // Check current user state
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          cloudCreditBalance: true,
          stripeCustomerId: true,
          email: true,
        },
      });

      console.log("👤 Current Cloud balance:", currentUser?.cloudCreditBalance);

      // Handle case where payment_intent is null (e.g., 100% discount coupon used)
      // Use session.id as fallback since stripePaymentId must be unique and non-null
      const stripePaymentId = session.payment_intent || `free_${session.id}`;

      const result = await prisma.$transaction([
        // Add Cloud credits to user
        prisma.user.update({
          where: { id: userId },
          data: { cloudCreditBalance: { increment: credits } },
        }),

        // Log Cloud credit purchase
        prisma.cloudCreditPurchase.create({
          data: {
            userId,
            credits,
            amountCents: session.amount_total || 0,
            stripePaymentId,
            status: "COMPLETED",
          },
        }),

        // Log Cloud credit transaction
        prisma.cloudCreditTransaction.create({
          data: {
            userId,
            amount: credits,
            type: "PURCHASE",
            description: `Purchased ${credits} Cloud credits ($${((session.amount_total || 0) / 100).toFixed(2)})`,
            metadata: { sessionId: session.id, paymentIntentId: session.payment_intent },
          },
        }),
      ]);

      console.log(`✅ Cloud credits database transaction completed`);

      // Create Stripe Credit Grant for Cloud metered billing
      if (currentUser?.stripeCustomerId) {
        console.log("🎫 Creating Stripe Credit Grant for Cloud metered billing...");
        const grantResult = await createStripeCreditGrant({
          stripeCustomerId: currentUser.stripeCustomerId,
          userId,
          credits,
          category: "paid",
          name: `Shipper Cloud Credits - ${credits} credits`,
          creditType: "cloud",
          metadata: {
            paymentIntentId: session.payment_intent,
            sessionId: session.id,
            purchaseType: "cloud_credits",
          },
        });

        if (grantResult.success) {
          console.log(`✅ Cloud Credit Grant created: ${grantResult.creditGrantId}`);
        } else {
          console.error(`⚠️ Failed to create Cloud Credit Grant: ${grantResult.error}`);
        }
      }

      // Verify update
      const updatedUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { cloudCreditBalance: true },
      });

      console.log(`☁️ Updated Cloud balance: ${updatedUser?.cloudCreditBalance}`);
      console.log(`✅ Successfully added ${credits} Cloud credits to user ${userId}`);
    } catch (error) {
      console.error("❌ Failed to add Cloud credits:", error);
      throw error;
    }
  }

  // Handle subscription checkout completion - NO CREDIT ALLOCATION HERE
  if (
    session.metadata?.type === "membership_subscription" &&
    session.subscription
  ) {
    console.log(
      "🔄 Subscription checkout completed - credits will be allocated when subscription.created fires",
    );
    console.log(`💡 Subscription ID: ${session.subscription}`);
    console.log(
      `💡 Tier: ${session.metadata.tierId} (${session.metadata.monthlyCredits} credits)`,
    );

    // Store the session ID in the subscription metadata for later reference
    try {
      await stripe.subscriptions.update(session.subscription, {
        metadata: {
          ...session.metadata,
          sessionId: session.id,
        },
      });
      console.log(
        `✅ Updated subscription ${session.subscription} with sessionId ${session.id}`,
      );
    } catch (error) {
      console.error("❌ Failed to update subscription metadata:", error);
    }

    // NOTE: Credits are allocated in handleSubscriptionChange() when customer.subscription.created fires
    // This prevents double allocation of credits
  }
}

async function handleSubscriptionChange(subscription: any) {
  console.log("📋 Processing subscription change:", subscription.id);
  console.log("🔍 Subscription metadata:", subscription.metadata);

  const userId = subscription.metadata?.userId;
  const tierId = subscription.metadata?.tierId; // New tier ID format
  const tierName = subscription.metadata?.tierName; // Base tier name (pro, enterprise)

  console.log("🆔 Extracted data:", { userId, tierId, tierName });

  if (!userId || !tierId) {
    console.error("❌ Missing userId or tierId in subscription metadata", {
      userId,
      tierId,
      metadata: subscription.metadata,
    });
    return;
  }

  // 🔍 Check if this is an upgrade vs new subscription
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      membershipTier: true,
      stripeSubscriptionId: true,
      creditBalance: true,
      membershipExpiresAt: true,
      basePlanCredits: true,
      carryOverCredits: true,
    },
  });

  if (!existingUser) {
    console.error(`❌ User ${userId} not found`);
    return;
  }

  // 🔄 Check if this is a renewal (same subscription ID, already on a paid tier)
  // Renewals should be handled by invoice.payment_succeeded, not here
  const isSameSubscription = existingUser.stripeSubscriptionId === subscription.id;
  const isRenewal = isSameSubscription && existingUser.membershipTier !== "FREE";

  if (isRenewal) {
    console.log(`🔄 Subscription ${subscription.id} is a renewal for user ${userId}`);
    console.log(`💡 Credits will be handled by invoice.payment_succeeded event - skipping here`);
    return;
  }

  // 🔧 SELF-HEALING: Initialize basePlanCredits if missing (for existing users before migration)
  if (existingUser.basePlanCredits === 0 && existingUser.creditBalance > 0) {
    console.log(
      `🔧 Auto-fixing basePlanCredits for user ${userId}: ${existingUser.creditBalance} credits`,
    );
    await prisma.user.update({
      where: { id: userId },
      data: {
        basePlanCredits: existingUser.creditBalance,
        carryOverCredits: 0,
      },
    });
    // Update the local object for subsequent logic
    existingUser.basePlanCredits = existingUser.creditBalance;
    existingUser.carryOverCredits = 0;
  }

  const isUpgrade =
    existingUser.stripeSubscriptionId &&
    existingUser.stripeSubscriptionId !== subscription.id &&
    existingUser.membershipTier !== "FREE";

  if (isUpgrade) {
    console.log(`🔄 Detected subscription upgrade for user ${userId}`);
    await handleSubscriptionUpgrade(
      userId,
      tierId,
      tierName,
      subscription.id,
      existingUser,
    );
  } else {
    console.log(`🆕 Detected new subscription for user ${userId}`);
    await handleSubscriptionActivation(
      userId,
      tierId,
      tierName,
      subscription.id,
    );
  }
}

async function handleSubscriptionActivation(
  userId: string,
  tierId: string,
  tierName: string,
  subscriptionId: string,
) {
  console.log(`🔄 Activating subscription: ${tierId} for user ${userId}`);

  // 🛡️ SAFETY CHECK: Prevent double allocation for same subscription
  // Use a more robust check that includes recent transactions and potential race conditions
  const existingTransactions = await prisma.creditTransaction.findMany({
    where: {
      userId: userId,
      type: "MONTHLY_ALLOCATION",
      OR: [
        {
          metadata: {
            path: ["subscriptionId"],
            equals: subscriptionId,
          },
        },
        {
          // Also check for recent transactions in the last 2 minutes to catch race conditions
          createdAt: {
            gte: new Date(Date.now() - 2 * 60 * 1000),
          },
          metadata: {
            path: ["tierId"],
            equals: tierId,
          },
        },
      ],
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (existingTransactions.length > 0) {
    console.log(
      `⚠️ Credits already allocated - skipping to prevent double allocation`,
    );
    console.log(
      `📊 Found ${existingTransactions.length} existing transactions:`,
    );
    existingTransactions.forEach((tx) => {
      console.log(
        `  - ${tx.id}: ${tx.amount} credits (${tx.createdAt.toISOString()})`,
      );
    });
    return;
  }

  // Map tierName to MembershipTier enum
  const tierMapping: Record<string, MembershipTier> = {
    free: MembershipTier.FREE,
    pro: MembershipTier.PRO,
    enterprise: MembershipTier.ENTERPRISE,
  };

  const membershipTier = tierMapping[tierName];
  if (!membershipTier) {
    console.error("❌ Invalid tier name:", tierName);
    return;
  }

  // Get tier information to get credit amount
  const tierInfo = getTierById(tierId);
  if (!tierInfo) {
    console.error("❌ Could not find tier info for:", tierId);
    return;
  }

  console.log(
    `📦 Tier info: ${tierInfo.name} - ${tierInfo.monthlyCredits} credits for $${tierInfo.monthlyPrice}/month`,
  );

  // 💰 Get user's current credit balance to preserve purchased credits
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { creditBalance: true, membershipTier: true },
  });

  const existingCredits = existingUser?.creditBalance || 0;
  const isComingFromFree = existingUser?.membershipTier === "FREE";

  console.log(`💰 User's existing credits: ${existingCredits}`);
  console.log(`🆓 Coming from FREE tier: ${isComingFromFree}`);

  // Get the full subscription data from Stripe to get proper dates and customer info
  let stripeSubscription;
  let stripeCustomerId = null;
  let stripeCurrentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Fallback: 30 days

  try {
    stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["latest_invoice", "customer"], // Expand to get more details
    });
    stripeCustomerId =
      typeof stripeSubscription.customer === "string"
        ? stripeSubscription.customer
        : (stripeSubscription.customer as any)?.id;

    console.log(
      `🆔 Extracted customer ID: ${stripeCustomerId} (type: ${typeof stripeSubscription.customer})`,
    );

    // Handle current_period_end safely
    const periodEndTimestamp = (stripeSubscription as any).current_period_end;
    if (periodEndTimestamp && typeof periodEndTimestamp === "number") {
      stripeCurrentPeriodEnd = new Date(periodEndTimestamp * 1000);
      console.log(
        `📅 Subscription period: ${stripeCurrentPeriodEnd.toISOString()}`,
      );
    } else {
      // Fallback: set to 1 month from now
      stripeCurrentPeriodEnd = new Date();
      stripeCurrentPeriodEnd.setMonth(stripeCurrentPeriodEnd.getMonth() + 1);
      console.log(
        "⚠️ No valid current_period_end from Stripe, using 1 month fallback",
      );
    }

    console.log(`👤 Customer ID: ${stripeCustomerId}`);
    console.log("📦 Subscription details:", {
      id: stripeSubscription.id,
      status: (stripeSubscription as any).status,
      current_period_start: (stripeSubscription as any).current_period_start,
      current_period_end: (stripeSubscription as any).current_period_end,
      created: (stripeSubscription as any).created,
    });
  } catch (error) {
    console.error("⚠️ Could not retrieve subscription from Stripe:", error);
  }

  try {
    const result = await prisma.$transaction([
      // Update user membership with proper Stripe data
      prisma.user.update({
        where: { id: userId },
        data: {
          membershipTier,
          membershipExpiresAt: stripeCurrentPeriodEnd,
          stripeSubscriptionId: subscriptionId,
          stripeCustomerId: stripeCustomerId,
          lastCreditReset: new Date(),
          monthlyCreditsUsed: 0,
          // 🎯 Preserve existing purchased credits + add new plan credits
          creditBalance: existingCredits + tierInfo.monthlyCredits,
          // 📦 Track base plan credits separately
          basePlanCredits: tierInfo.monthlyCredits,
          // 🎁 Existing credits become carry-over (if any)
          carryOverCredits: existingCredits,
          carryOverExpiresAt:
            existingCredits > 0 ? stripeCurrentPeriodEnd : null,
        },
      }),

      // Create or update subscription record with proper data
      prisma.subscription.upsert({
        where: { stripeSubscriptionId: subscriptionId },
        create: {
          userId,
          stripeSubscriptionId: subscriptionId,
          stripePriceId:
            stripeSubscription?.items?.data[0]?.price?.id || "dynamic_price",
          stripeCurrentPeriodEnd: stripeCurrentPeriodEnd,
          stripeCancelAtPeriodEnd: false,
          status: "ACTIVE" as any,
        },
        update: {
          status: "ACTIVE" as any,
          stripeCurrentPeriodEnd: stripeCurrentPeriodEnd,
          stripePriceId:
            stripeSubscription?.items?.data[0]?.price?.id || "dynamic_price",
          stripeCancelAtPeriodEnd: false,
        },
      }),

      // Re-publish all user's deployments (make live projects public again)
      prisma.deployment.updateMany({
        where: { userId: userId },
        data: { published: true },
      }),

      // Log the monthly credit allocation
      prisma.creditTransaction.create({
        data: {
          userId,
          amount: tierInfo.monthlyCredits,
          type: "MONTHLY_ALLOCATION",
          description:
            existingCredits > 0
              ? `${tierInfo.name} subscription: ${tierInfo.monthlyCredits} base credits + ${existingCredits} existing credits preserved as carry-over`
              : `${tierInfo.name} subscription: ${tierInfo.monthlyCredits} credits`,
          metadata: {
            subscriptionId,
            tierId,
            tierName,
            isInitialAllocation: true,
            existingCreditsPreserved: existingCredits,
            basePlanCredits: tierInfo.monthlyCredits,
            totalCredits: existingCredits + tierInfo.monthlyCredits,
            // Try to get sessionId from subscription metadata
            sessionId: stripeSubscription?.metadata?.sessionId || null,
          },
        },
      }),
    ]);

    // Count re-published deployments
    const publishedCount = await prisma.deployment.count({
      where: { userId: userId, published: true },
    });

    console.log(
      `✅ Successfully activated ${tierInfo.name} membership for user ${userId}`,
    );
    console.log(`💰 Added ${tierInfo.monthlyCredits} credits to user account`);
    console.log(
      `📊 Subscription details: ${tierInfo.monthlyCredits} credits/month, $${tierInfo.monthlyPrice}/month`,
    );
    console.log(`📅 Next billing: ${stripeCurrentPeriodEnd.toISOString()}`);
    console.log(`🚀 Re-published ${publishedCount} deployment(s)`);

    // NOTE: Stripe Credit Grants are NOT created for Builder subscription credits
    // They are only used for Cloud credits (Shipper Cloud / Convex metered billing)

    return result;
  } catch (error) {
    console.error("❌ Failed to activate subscription:", error);
    throw error;
  }
}

async function handleSubscriptionCanceled(subscription: any) {
  console.log("❌ Processing subscription cancellation:", subscription.id);

  // First get the user to see how many credits they have
  const user = await prisma.user.findFirst({
    where: { stripeSubscriptionId: subscription.id },
    select: { id: true, email: true, creditBalance: true },
  });

  if (!user) {
    console.log("⚠️ No user found for subscription:", subscription.id);
    return;
  }

  const creditsToRemove = user.creditBalance;
  console.log(
    `👤 User ${user.email} has ${creditsToRemove} credits - removing all`,
  );

  await prisma.$transaction([
    // Update user to free tier and ZERO credits
    prisma.user.updateMany({
      where: { stripeSubscriptionId: subscription.id },
      data: {
        membershipTier: MembershipTier.FREE,
        stripeSubscriptionId: null,
        membershipExpiresAt: null,
        creditBalance: 0, // 🔥 ZERO credits when subscription cancelled
      },
    }),

    // Update subscription status
    prisma.subscription.updateMany({
      where: { stripeSubscriptionId: subscription.id },
      data: { status: "CANCELED" },
    }),

    // Unpublish all user's deployments (make live projects private)
    // Exception: Skip unpublishing for admins only
    ...(!isAdminEmail(user.email)
      ? [
          prisma.deployment.updateMany({
            where: { userId: user.id },
            data: { published: false },
          }),
        ]
      : []),

    // Log the credit removal
    prisma.creditTransaction.create({
      data: {
        userId: user.id,
        amount: -creditsToRemove, // Remove all credits
        type: "REFUND",
        description: `Subscription cancelled via webhook - removed ${creditsToRemove} credits and downgraded to FREE tier`,
        metadata: {
          reason: "Webhook subscription cancellation",
          stripeSubscriptionId: subscription.id,
          originalCredits: creditsToRemove,
        },
      },
    }),
  ]);

  // Count unpublished deployments (only if we actually unpublished them)
  const shouldUnpublish = !isAdminEmail(user.email);
  const unpublishedCount = shouldUnpublish
    ? await prisma.deployment.count({
        where: { userId: user.id, published: false },
      })
    : 0;

  const unpublishMessage = shouldUnpublish
    ? `, and unpublished ${unpublishedCount} deployment(s)`
    : ` (deployments kept published - admin user)`;

  console.log(
    `✅ Canceled subscription ${subscription.id}, removed ${creditsToRemove} credits${unpublishMessage}`,
  );
}

async function handleSubscriptionUpgrade(
  userId: string,
  tierId: string,
  tierName: string,
  subscriptionId: string,
  existingUser: any,
) {
  console.log(
    `🔄 Processing mid-term subscription upgrade: ${tierId} for user ${userId}`,
  );

  // 🛡️ SAFETY CHECK: Prevent double processing of same upgrade
  const existingUpgradeTransactions = await prisma.creditTransaction.findMany({
    where: {
      userId: userId,
      type: "MONTHLY_ALLOCATION",
      OR: [
        {
          metadata: {
            path: ["subscriptionId"],
            equals: subscriptionId,
          },
        },
        {
          // Check for recent upgrade to same tier (last 2 minutes)
          createdAt: {
            gte: new Date(Date.now() - 2 * 60 * 1000),
          },
          AND: [
            {
              metadata: {
                path: ["tierId"],
                equals: tierId,
              },
            },
            {
              metadata: {
                path: ["isUpgrade"],
                equals: true,
              },
            },
          ],
        },
      ],
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (existingUpgradeTransactions.length > 0) {
    console.log(
      `⚠️ Upgrade already processed - skipping to prevent double processing`,
    );
    console.log(
      `📊 Found ${existingUpgradeTransactions.length} existing upgrade transactions:`,
    );
    existingUpgradeTransactions.forEach((tx) => {
      console.log(
        `  - ${tx.id}: ${tx.amount} credits (${tx.createdAt.toISOString()})`,
      );
    });
    return;
  }

  // Get new tier information
  const newTierInfo = getTierById(tierId);
  if (!newTierInfo) {
    console.error("❌ Could not find new tier info for:", tierId);
    return;
  }

  // Get the full subscription data from Stripe
  let stripeSubscription;
  let stripeCurrentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  try {
    stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["latest_invoice", "customer"],
    });

    const periodEndTimestamp = (stripeSubscription as any).current_period_end;
    if (periodEndTimestamp && typeof periodEndTimestamp === "number") {
      stripeCurrentPeriodEnd = new Date(periodEndTimestamp * 1000);
    }

    console.log("📦 New subscription details:", {
      id: stripeSubscription.id,
      status: (stripeSubscription as any).status,
      current_period_start: (stripeSubscription as any).current_period_start,
      current_period_end: (stripeSubscription as any).current_period_end,
    });
  } catch (error) {
    console.error("⚠️ Could not retrieve new subscription from Stripe:", error);
  }

  // 💡 NEW LOGIC: Calculate carry-over credits (leftover from old plan)
  const currentBalance = existingUser.creditBalance || 0;
  const currentBasePlan = existingUser.basePlanCredits || 0;
  const currentCarryOver = existingUser.carryOverCredits || 0;
  const isFirstSubscription = existingUser.membershipTier === "FREE";

  // Leftover = current balance ONLY if upgrading from a paid plan
  // For first subscription (FREE → PRO), there's no carry-over
  const leftoverCredits = isFirstSubscription ? 0 : Math.max(0, currentBalance);

  // New plan's full quota (instant quota bump - no proration)
  const newBasePlanCredits = newTierInfo.monthlyCredits;

  // New total: leftover + new plan's full quota
  const newTotalCredits = leftoverCredits + newBasePlanCredits;

  // Set carry-over expiration (1 month from now - at next billing date)
  const carryOverExpiresAt = new Date(stripeCurrentPeriodEnd);

  console.log(`📊 Subscription change calculation:`);
  console.log(`  💰 Current balance: ${currentBalance}`);
  console.log(`  📦 Current base plan: ${currentBasePlan}`);
  console.log(`  🎁 Current carry-over: ${currentCarryOver}`);
  console.log(`  🆕 Is first subscription: ${isFirstSubscription}`);
  console.log(`  ✨ Leftover credits to carry over: ${leftoverCredits}`);
  console.log(`  📈 New plan base credits: ${newBasePlanCredits}`);
  console.log(`  🎯 New total credits: ${newTotalCredits}`);
  console.log(`  ⏰ Carry-over expires: ${carryOverExpiresAt.toISOString()}`);

  // 🛡️ SAFETY CHECK: Prevent double allocation for same subscription
  const existingTransaction = await prisma.creditTransaction.findFirst({
    where: {
      userId,
      type: "MONTHLY_ALLOCATION",
      metadata: {
        path: ["subscriptionId"],
        equals: subscriptionId,
      },
    },
  });

  if (existingTransaction) {
    console.log(
      `⚠️ Credits already allocated for subscription ${subscriptionId} - skipping`,
    );
    return;
  }

  // Map tierName to MembershipTier enum
  const tierMapping: Record<string, MembershipTier> = {
    free: MembershipTier.FREE,
    pro: MembershipTier.PRO,
    enterprise: MembershipTier.ENTERPRISE,
  };

  const membershipTier = tierMapping[tierName];
  if (!membershipTier) {
    console.error("❌ Invalid tier name:", tierName);
    return;
  }

  try {
    // 🔥 CRITICAL: Cancel ALL old subscriptions in Stripe BEFORE creating database records
    // This prevents the user from being charged for multiple subscriptions
    // We need to check both the stored subscription ID AND query Stripe for any other active subscriptions

    // Get customer ID from the new subscription to query all their subscriptions
    let stripeCustomerId: string | null = null;
    try {
      const newSubscription = await stripe.subscriptions.retrieve(subscriptionId);
      stripeCustomerId = typeof newSubscription.customer === "string"
        ? newSubscription.customer
        : newSubscription.customer?.id ?? null;
    } catch (error) {
      console.error(`⚠️ Could not retrieve new subscription to get customer ID:`, error);
    }

    // Track all subscription IDs we need to cancel
    const subscriptionsToCancel: string[] = [];

    // Add the stored subscription ID if it's different from the new one
    if (existingUser.stripeSubscriptionId && existingUser.stripeSubscriptionId !== subscriptionId) {
      subscriptionsToCancel.push(existingUser.stripeSubscriptionId);
    }

    // 🔍 Query Stripe for ALL active subscriptions for this customer
    if (stripeCustomerId) {
      try {
        console.log(`🔍 Checking for other active subscriptions for customer: ${stripeCustomerId}`);
        const customerSubscriptions = await stripe.subscriptions.list({
          customer: stripeCustomerId,
          status: "active",
          limit: 100,
        });

        // Add any active subscriptions that aren't the new one
        for (const sub of customerSubscriptions.data) {
          if (sub.id !== subscriptionId && !subscriptionsToCancel.includes(sub.id)) {
            console.log(`📋 Found additional active subscription to cancel: ${sub.id}`);
            subscriptionsToCancel.push(sub.id);
          }
        }

        console.log(`📊 Total subscriptions to cancel: ${subscriptionsToCancel.length}`);
      } catch (listError) {
        console.error(`⚠️ Could not list customer subscriptions:`, listError);
        // Continue with just the stored subscription ID
      }
    }

    // Cancel all old subscriptions
    for (const oldSubId of subscriptionsToCancel) {
      try {
        console.log(`🔥 Canceling old Stripe subscription: ${oldSubId}`);
        await stripe.subscriptions.cancel(oldSubId);
        console.log(`✅ Old subscription ${oldSubId} canceled successfully`);
      } catch (cancelError: unknown) {
        // Only ignore "resource_missing" errors - re-throw all others to leverage
        // Inngest's retry mechanism and prevent double-billing from transient failures
        const code =
          cancelError && typeof cancelError === "object" && "code" in cancelError
            ? (cancelError as { code: string }).code
            : undefined;
        const message = cancelError instanceof Error ? cancelError.message : "";

        if (code === "resource_missing" || message.includes("No such subscription")) {
          console.log(`⚠️ Subscription ${oldSubId} not found in Stripe (already canceled or doesn't exist)`);
        } else {
          console.error(`❌ Failed to cancel subscription ${oldSubId} in Stripe. Retrying...`, cancelError);
          // Re-throw to allow Inngest to retry - critical for preventing double-billing
          throw cancelError;
        }
      }
    }

    const result = await prisma.$transaction([
      // Clean up ALL old subscription records in database
      ...(subscriptionsToCancel.length > 0
        ? [
            prisma.subscription.updateMany({
              where: {
                stripeSubscriptionId: { in: subscriptionsToCancel },
              },
              data: { status: "CANCELED" },
            }),
          ]
        : []),

      // Update user with new plan + carry-over
      prisma.user.update({
        where: { id: userId },
        data: {
          membershipTier,
          membershipExpiresAt: stripeCurrentPeriodEnd,
          stripeSubscriptionId: subscriptionId,
          monthlyCreditsUsed: 0, // Reset usage counter
          lastCreditReset: new Date(),

          // 📦 Set base plan and carry-over separately
          basePlanCredits: newBasePlanCredits,
          carryOverCredits: leftoverCredits,
          carryOverExpiresAt: carryOverExpiresAt,

          // Set total balance (leftover + new plan)
          creditBalance: newTotalCredits,
        },
      }),

      // Update subscription record
      prisma.subscription.upsert({
        where: { stripeSubscriptionId: subscriptionId },
        create: {
          userId,
          stripeSubscriptionId: subscriptionId,
          stripePriceId:
            stripeSubscription?.items?.data[0]?.price?.id || "dynamic_price",
          stripeCurrentPeriodEnd: stripeCurrentPeriodEnd,
          stripeCancelAtPeriodEnd: false,
          status: "ACTIVE" as any,
        },
        update: {
          status: "ACTIVE" as any,
          stripeCurrentPeriodEnd: stripeCurrentPeriodEnd,
          stripePriceId:
            stripeSubscription?.items?.data[0]?.price?.id || "dynamic_price",
          stripeCancelAtPeriodEnd: false,
        },
      }),

      // Log the upgrade transaction
      prisma.creditTransaction.create({
        data: {
          userId,
          amount: newBasePlanCredits, // Only log the new plan's credits
          type: "MONTHLY_ALLOCATION",
          description: `Subscription upgrade: ${newTierInfo.name} - ${newBasePlanCredits} base credits + ${leftoverCredits} carry-over credits`,
          metadata: {
            subscriptionId,
            tierId,
            tierName,
            isUpgrade: true,
            isCarryOver: true,
            carryOverAmount: leftoverCredits,
            basePlanCredits: newBasePlanCredits,
            totalCredits: newTotalCredits,
            carryOverExpiresAt: carryOverExpiresAt.toISOString(),
            previousBalance: currentBalance,
            sessionId: stripeSubscription?.metadata?.sessionId || null,
            canceledSubscriptions: subscriptionsToCancel,
          },
        },
      }),
    ]);

    console.log(
      `✅ Successfully upgraded to ${newTierInfo.name} for user ${userId}`,
    );
    console.log(`💰 Base plan: ${newBasePlanCredits} credits/month`);
    console.log(
      `🎁 Carry-over: +${leftoverCredits} credits (expires ${carryOverExpiresAt.toISOString()})`,
    );
    console.log(`🎯 Total credits: ${newTotalCredits}`);

    // NOTE: Stripe Credit Grants are NOT created for Builder subscription upgrades
    // They are only used for Cloud credits (Shipper Cloud / Convex metered billing)

    return result;
  } catch (error) {
    console.error("❌ Failed to process subscription upgrade:", error);
    throw error;
  }
}

async function handlePaymentSuccess(invoice: any) {
  console.log("💰 Processing payment success:", invoice.id);
  console.log(`📋 Invoice billing_reason: ${invoice.billing_reason}`);

  // Handle recurring subscription payments (renewals)
  // Support both old format (invoice.subscription) and new format (invoice.parent.subscription_details.subscription)
  const rawSubscriptionId =
    invoice.subscription ||
    invoice.parent?.subscription_details?.subscription;

  console.log(
    `🔍 Subscription ID source: ${invoice.subscription ? "invoice.subscription" : invoice.parent?.subscription_details?.subscription ? "invoice.parent.subscription_details" : "not found"}`,
  );

  if (rawSubscriptionId) {
    // Handle case where subscription might be an object (expanded) or string
    const subscriptionId =
      typeof rawSubscriptionId === "string"
        ? rawSubscriptionId
        : rawSubscriptionId?.id;

    console.log(`🔍 Looking up subscription: ${subscriptionId}`);

    let subscription = await prisma.subscription.findUnique({
      where: { stripeSubscriptionId: subscriptionId },
      include: { user: true },
    });

    // 🔧 Fallback: Try to find by customer ID if subscription lookup fails
    if (!subscription && invoice.customer) {
      const customerId =
        typeof invoice.customer === "string"
          ? invoice.customer
          : invoice.customer?.id;

      console.log(
        `⚠️ Subscription not found by ID, trying customer lookup: ${customerId}`,
      );

      // Try to find user by Stripe customer ID
      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: customerId },
      });

      if (user) {
        // Find the user's active subscription
        const userSubscription = await prisma.subscription.findFirst({
          where: { userId: user.id, status: "ACTIVE" },
          include: { user: true },
        });

        if (userSubscription) {
          subscription = userSubscription;
          console.log(
            `✅ Found subscription via customer lookup for user: ${user.email}`,
          );
        }
      }
    }

    // 🚨 CRITICAL: Log and handle missing subscription/user
    if (!subscription) {
      console.error(
        `❌ RENEWAL FAILED: Could not find subscription for invoice`,
        {
          invoiceId: invoice.id,
          subscriptionId: subscriptionId,
          customerId: invoice.customer,
          billingReason: invoice.billing_reason,
        },
      );
      // Don't silently fail - this needs investigation
      return;
    }

    if (!subscription.user) {
      console.error(
        `❌ RENEWAL FAILED: Subscription ${subscriptionId} has no associated user`,
        {
          invoiceId: invoice.id,
          subscriptionId: subscriptionId,
          customerId: invoice.customer,
          billingReason: invoice.billing_reason,
        },
      );
      return;
    }

    const newPeriodEnd = new Date(invoice.period_end * 1000);
    const userId = subscription.user.id;

    // 🛡️ CRITICAL: Skip first invoice - credits already allocated by subscription.created event
    // First invoice has billing_reason = "subscription_create"
    if (invoice.billing_reason === "subscription_create") {
      console.log(
        `⏭️ Skipping first invoice ${invoice.id} - credits already allocated by subscription.created event`,
      );
      return;
    }

    console.log(`🔄 Processing renewal for user ${subscription.user.email}`);
    console.log(`📅 New period end: ${newPeriodEnd.toISOString()}`);

    // Get subscription from Stripe to extract tier info
    try {
      const stripeSubscription =
        await stripe.subscriptions.retrieve(subscriptionId);
      const metadata = stripeSubscription.metadata;
      const tierId = metadata?.tierId;
      const tierName = metadata?.tierName;

      if (tierId) {
        // Get tier information for credit allocation
        const tierInfo = getTierById(tierId);
        if (tierInfo) {
          console.log(
            `💰 Resetting to ${tierInfo.monthlyCredits} credits for renewal`,
          );

          // 🛡️ SAFETY CHECK: Prevent double allocation for same billing period
          const existingRenewalTransaction =
            await prisma.creditTransaction.findFirst({
              where: {
                userId: userId,
                type: "MONTHLY_ALLOCATION",
                metadata: {
                  path: ["invoiceId"],
                  equals: invoice.id,
                },
              },
            });

          if (existingRenewalTransaction) {
            console.log(
              `⚠️ Credits already allocated for invoice ${invoice.id} - skipping`,
            );
            return;
          }

          // 💡 Get current credit state to calculate rollover
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
              creditBalance: true,
              carryOverCredits: true,
              carryOverExpiresAt: true,
              basePlanCredits: true,
            },
          });

          const currentBalance = user?.creditBalance || 0;
          const currentCarryOver = user?.carryOverCredits || 0;
          const currentBasePlan = user?.basePlanCredits || 0;

          // 🔄 Calculate unused credits from current base plan (not including old carry-over)
          // Unused = total balance - old carry-over
          const unusedFromBasePlan = Math.max(
            0,
            currentBalance - currentCarryOver,
          );

          // 🎁 This unused amount becomes the NEW carry-over (expires at next renewal)
          const newCarryOver = unusedFromBasePlan;
          const newBasePlan = tierInfo.monthlyCredits;
          const newTotalBalance = newCarryOver + newBasePlan;

          console.log(`📊 Renewal for user ${subscription.user.email}:`, {
            currentBalance,
            currentBasePlan,
            currentCarryOver,
            unusedFromBasePlan,
            newCarryOver,
            newBasePlan,
            newTotalBalance,
          });

          // Roll over unused base plan credits
          await prisma.$transaction([
            // Update subscription period
            prisma.subscription.update({
              where: { id: subscription.id },
              data: { stripeCurrentPeriodEnd: newPeriodEnd },
            }),

            // Roll over unused base plan credits
            prisma.user.update({
              where: { id: userId },
              data: {
                membershipExpiresAt: newPeriodEnd,
                lastCreditReset: new Date(),
                monthlyCreditsUsed: 0,

                // 🔄 Roll over unused base plan credits
                basePlanCredits: newBasePlan,
                carryOverCredits: newCarryOver, // Unused from previous base plan
                carryOverExpiresAt: newPeriodEnd, // Expires at next renewal
                creditBalance: newTotalBalance, // Rolled + new base
              },
            }),

            // Log the renewal transaction
            prisma.creditTransaction.create({
              data: {
                userId,
                amount: tierInfo.monthlyCredits,
                type: "MONTHLY_ALLOCATION",
                description:
                  newCarryOver > 0
                    ? `Monthly renewal: ${tierInfo.name} - ${tierInfo.monthlyCredits} new credits + ${newCarryOver} rolled over from previous cycle`
                    : `Monthly renewal: ${tierInfo.name} - ${tierInfo.monthlyCredits} credits`,
                metadata: {
                  subscriptionId: subscriptionId,
                  invoiceId: invoice.id,
                  tierId,
                  tierName,
                  isRenewal: true,
                  oldCarryOverExpired: currentCarryOver,
                  unusedFromBasePlan: unusedFromBasePlan,
                  newCarryOver: newCarryOver,
                  newBasePlan: newBasePlan,
                  totalCredits: newTotalBalance,
                  previousCarryOver: user?.carryOverCredits || 0,
                  billingPeriodStart: new Date(
                    invoice.period_start * 1000,
                  ).toISOString(),
                  billingPeriodEnd: newPeriodEnd.toISOString(),
                },
              },
            }),
          ]);

          console.log(`✅ Renewal processed for user`, {
            email: subscription.user.email,
            newCredits: tierInfo.monthlyCredits,
            extendedTo: newPeriodEnd.toISOString(),
          });

          // NOTE: Stripe Credit Grants are NOT created for Builder subscription renewals
          // They are only used for Cloud credits (Shipper Cloud / Convex metered billing)
        } else {
          console.error(`❌ Could not find tier info for: ${tierId}`);
        }
      } else {
        console.error(
          `❌ No tierId in subscription metadata for: ${subscriptionId}`,
        );
      }
    } catch (error) {
      console.error(`❌ Failed to process renewal:`, error);

      // Fallback: just extend the subscription without credits
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { stripeCurrentPeriodEnd: newPeriodEnd },
      });

      console.log(
        `⚠️ Extended subscription period as fallback for user ${subscription.userId}`,
      );
    }
  }
}

async function handlePaymentFailed(invoice: any) {
  console.log("❌ Processing payment failure:", invoice.id);

  if (invoice.subscription) {
    await prisma.subscription.updateMany({
      where: { stripeSubscriptionId: invoice.subscription },
      data: { status: "PAST_DUE" },
    });

    console.log(`⚠️ Marked subscription as past due: ${invoice.subscription}`);
  }
}
