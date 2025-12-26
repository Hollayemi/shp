import { createRequire } from 'module';const require = createRequire(import.meta.url);
import {
  prisma
} from "./chunk-YCW3NRDP.js";
import {
  init_esm_shims,
  logger,
  stripe
} from "./chunk-BUABXYJD.js";

// src/services/auto-top-up.ts
init_esm_shims();

// src/services/stripe-credits.ts
init_esm_shims();
var CREDIT_PRICING = {
  /** Cents per credit - 1 cent = 1 credit */
  CENTS_PER_CREDIT: 1,
  /** Credits per dollar - $1 = 100 credits */
  CREDITS_PER_DOLLAR: 100,
  /** Minimum credits for a purchase (100 credits = $1) */
  MIN_CREDITS: 100,
  /** Maximum credits per single purchase (100,000 credits = $1,000) */
  MAX_CREDITS: 1e5,
  /** Bonus credits given on first Shipper Cloud deployment ($1 = 100 credits) */
  FIRST_DEPLOYMENT_BONUS: 100
};
function creditsToCents(credits) {
  return credits * CREDIT_PRICING.CENTS_PER_CREDIT;
}
function centsToCredits(cents) {
  return Math.floor(cents / CREDIT_PRICING.CENTS_PER_CREDIT);
}
async function createCreditGrant(options) {
  if (!stripe) {
    return { success: false, error: "Stripe not configured" };
  }
  const { userId, credits, category, name, expiresAt, metadata } = options;
  if (credits < CREDIT_PRICING.MIN_CREDITS) {
    return {
      success: false,
      error: `Minimum credits is ${CREDIT_PRICING.MIN_CREDITS}`
    };
  }
  if (credits > CREDIT_PRICING.MAX_CREDITS) {
    return {
      success: false,
      error: `Maximum credits is ${CREDIT_PRICING.MAX_CREDITS}`
    };
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        stripeCustomerId: true
      }
    });
    if (!user) {
      return { success: false, error: "User not found" };
    }
    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name ?? void 0,
        metadata: {
          userId: user.id,
          source: "shipper-billing"
        }
      });
      stripeCustomerId = customer.id;
      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId }
      });
      logger.info({ userId, stripeCustomerId }, "Created Stripe customer for user");
    }
    const amountCents = creditsToCents(credits);
    const grantName = name ?? `Shipper Cloud Credits - ${credits} credits`;
    const creditGrant = await stripe.billing.creditGrants.create({
      customer: stripeCustomerId,
      name: grantName,
      applicability_config: {
        scope: {
          price_type: "metered"
          // Only applies to metered prices (Convex usage)
        }
      },
      category,
      amount: {
        type: "monetary",
        monetary: {
          value: amountCents,
          currency: "usd"
        }
      },
      ...expiresAt && { expires_at: Math.floor(expiresAt.getTime() / 1e3) },
      metadata: {
        userId,
        credits: credits.toString(),
        source: "shipper-cloud",
        ...metadata
      }
    });
    logger.info(
      {
        userId,
        stripeCustomerId,
        creditGrantId: creditGrant.id,
        credits,
        amountCents,
        category
      },
      "Created Stripe credit grant"
    );
    return {
      success: true,
      creditGrantId: creditGrant.id,
      credits,
      amountCents
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error, userId, credits }, "Failed to create credit grant");
    return { success: false, error: errorMessage };
  }
}
async function getCreditBalance(userId) {
  if (!stripe) {
    return { success: false, error: "Stripe not configured" };
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true }
    });
    if (!user?.stripeCustomerId) {
      return {
        success: true,
        availableCredits: 0,
        availableBalanceCents: 0,
        ledgerBalanceCents: 0
      };
    }
    const creditBalanceSummary = await stripe.billing.creditBalanceSummary.retrieve({
      customer: user.stripeCustomerId,
      filter: {
        type: "applicability_scope",
        applicability_scope: {
          price_type: "metered"
        }
      }
    });
    const balances = creditBalanceSummary.balances;
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
      ledgerBalanceCents
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error, userId }, "Failed to get credit balance");
    return { success: false, error: errorMessage };
  }
}
async function listCreditGrants(userId) {
  if (!stripe) {
    return { success: false, error: "Stripe not configured" };
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true }
    });
    if (!user?.stripeCustomerId) {
      return { success: true, grants: [] };
    }
    const creditGrants = await stripe.billing.creditGrants.list({
      customer: user.stripeCustomerId,
      limit: 100
    });
    const grants = creditGrants.data.map((grant) => {
      let amountCents = 0;
      let appliedCents = 0;
      if (grant.amount.type === "monetary" && grant.amount.monetary) {
        amountCents = grant.amount.monetary.value;
      }
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
        effectiveAt: grant.effective_at ? new Date(grant.effective_at * 1e3) : null,
        expiresAt: grant.expires_at ? new Date(grant.expires_at * 1e3) : null,
        voidedAt: grant.voided_at ? new Date(grant.voided_at * 1e3) : null
      };
    });
    return { success: true, grants };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error, userId }, "Failed to list credit grants");
    return { success: false, error: errorMessage };
  }
}
async function voidCreditGrant(userId, creditGrantId) {
  if (!stripe) {
    return { success: false, error: "Stripe not configured" };
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true }
    });
    if (!user?.stripeCustomerId) {
      return { success: false, error: "User has no Stripe customer" };
    }
    const grant = await stripe.billing.creditGrants.retrieve(creditGrantId);
    if (grant.customer !== user.stripeCustomerId) {
      return { success: false, error: "Credit grant does not belong to user" };
    }
    await stripe.billing.creditGrants["void"](creditGrantId);
    logger.info({ userId, creditGrantId }, "Voided credit grant");
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error, userId, creditGrantId }, "Failed to void credit grant");
    return { success: false, error: errorMessage };
  }
}
async function syncCreditBalanceToDatabase(userId) {
  try {
    const balanceResult = await getCreditBalance(userId);
    if (!balanceResult.success) {
      return { success: false, error: balanceResult.error };
    }
    const stripeCredits = balanceResult.availableCredits ?? 0;
    const user = await prisma.user.update({
      where: { id: userId },
      data: { creditBalance: stripeCredits },
      select: { creditBalance: true }
    });
    logger.info(
      { userId, localBalance: user.creditBalance, stripeBalance: stripeCredits },
      "Synced credit balance from Stripe"
    );
    return {
      success: true,
      localBalance: user.creditBalance,
      stripeBalance: stripeCredits
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error, userId }, "Failed to sync credit balance");
    return { success: false, error: errorMessage };
  }
}
async function createPromotionalCredits(userId, credits, reason, expiresAt) {
  return createCreditGrant({
    userId,
    credits,
    category: "promotional",
    name: `Promotional Credits - ${reason}`,
    expiresAt,
    metadata: {
      reason,
      grantType: "promotional"
    }
  });
}
async function grantFirstDeploymentBonus(userId, projectId) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { cloudFirstDeploymentBonus: true }
    });
    if (!user) {
      return { success: false, granted: false, error: "User not found" };
    }
    if (user.cloudFirstDeploymentBonus) {
      logger.info({ userId, projectId }, "User already received first deployment bonus");
      return { success: true, granted: false };
    }
    const bonusCredits = CREDIT_PRICING.FIRST_DEPLOYMENT_BONUS;
    const grantResult = await createCreditGrant({
      userId,
      credits: bonusCredits,
      category: "promotional",
      name: "Shipper Cloud Welcome Bonus",
      metadata: {
        reason: "first_deployment_bonus",
        projectId,
        grantType: "first_deployment"
      }
    });
    if (!grantResult.success) {
      logger.error(
        { userId, projectId, error: grantResult.error },
        "Failed to create Stripe credit grant for first deployment bonus"
      );
      return { success: false, granted: false, error: grantResult.error };
    }
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          cloudFirstDeploymentBonus: true,
          cloudCreditBalance: { increment: bonusCredits }
        }
      }),
      prisma.cloudCreditTransaction.create({
        data: {
          userId,
          amount: bonusCredits,
          type: "FIRST_DEPLOY_BONUS",
          description: `$1 welcome bonus for first Shipper Cloud deployment`,
          metadata: {
            projectId,
            creditGrantId: grantResult.creditGrantId
          }
        }
      })
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

// src/services/auto-top-up.ts
var MAX_CONSECUTIVE_FAILURES = 3;
async function processAutoTopUp(userId) {
  if (!stripe) {
    return { success: false, userId, error: "Stripe not configured" };
  }
  try {
    const config = await prisma.autoTopUpConfig.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            stripeCustomerId: true,
            email: true,
            name: true
          }
        }
      }
    });
    if (!config) {
      return {
        success: false,
        userId,
        skipped: true,
        skipReason: "No auto top-up config found"
      };
    }
    if (!config.enabled) {
      return {
        success: false,
        userId,
        skipped: true,
        skipReason: "Auto top-up disabled"
      };
    }
    if (!config.stripePaymentMethodId) {
      return {
        success: false,
        userId,
        skipped: true,
        skipReason: "No payment method configured"
      };
    }
    if (!config.user.stripeCustomerId) {
      return {
        success: false,
        userId,
        skipped: true,
        skipReason: "No Stripe customer"
      };
    }
    if (config.topUpsThisMonth >= config.maxMonthlyTopUps) {
      return {
        success: false,
        userId,
        skipped: true,
        skipReason: `Monthly limit reached (${config.topUpsThisMonth}/${config.maxMonthlyTopUps})`
      };
    }
    if (config.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      return {
        success: false,
        userId,
        skipped: true,
        skipReason: `Too many consecutive failures (${config.consecutiveFailures})`
      };
    }
    const balanceResult = await getCreditBalance(userId);
    if (!balanceResult.success) {
      return {
        success: false,
        userId,
        error: `Failed to get balance: ${balanceResult.error}`
      };
    }
    const currentCredits = balanceResult.availableCredits ?? 0;
    if (currentCredits >= config.thresholdCredits) {
      return {
        success: false,
        userId,
        skipped: true,
        skipReason: `Balance (${currentCredits}) above threshold (${config.thresholdCredits})`
      };
    }
    logger.info(
      {
        userId,
        currentCredits,
        threshold: config.thresholdCredits,
        topUpAmount: config.topUpCredits
      },
      "Processing auto top-up"
    );
    const amountCents = creditsToCents(config.topUpCredits);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      customer: config.user.stripeCustomerId,
      payment_method: config.stripePaymentMethodId,
      confirm: true,
      off_session: true,
      description: `Shipper Cloud Auto Top-Up: ${config.topUpCredits} credits`,
      metadata: {
        userId,
        type: "auto_top_up",
        credits: config.topUpCredits.toString()
      }
    });
    if (paymentIntent.status !== "succeeded") {
      const error = `Payment status: ${paymentIntent.status}`;
      await prisma.autoTopUpConfig.update({
        where: { userId },
        data: {
          consecutiveFailures: { increment: 1 },
          lastTopUpError: error
        }
      });
      logger.warn({ userId, paymentIntentId: paymentIntent.id, status: paymentIntent.status }, error);
      return {
        success: false,
        userId,
        paymentIntentId: paymentIntent.id,
        error
      };
    }
    const grantResult = await createCreditGrant({
      userId,
      credits: config.topUpCredits,
      category: "paid",
      name: `Auto Top-Up - ${config.topUpCredits} credits`,
      metadata: {
        paymentIntentId: paymentIntent.id,
        autoTopUp: "true"
      }
    });
    if (!grantResult.success) {
      logger.error(
        {
          userId,
          paymentIntentId: paymentIntent.id,
          credits: config.topUpCredits,
          error: grantResult.error
        },
        "CRITICAL: Auto top-up payment succeeded but credit grant failed - requires manual intervention"
      );
      await prisma.autoTopUpConfig.update({
        where: { userId },
        data: {
          lastTopUpError: `Payment succeeded (${paymentIntent.id}) but credit grant failed: ${grantResult.error}. Manual intervention required.`
          // Don't increment topUpsThisMonth since credits weren't granted
          // Don't reset consecutiveFailures - this is a failure state
        }
      });
      await prisma.creditTransaction.create({
        data: {
          userId,
          amount: 0,
          // No credits were actually granted
          type: "PURCHASE",
          description: `FAILED Auto top-up: Payment succeeded but credit grant failed`,
          metadata: {
            paymentIntentId: paymentIntent.id,
            intendedCredits: config.topUpCredits,
            error: grantResult.error,
            requiresManualIntervention: true,
            autoTopUp: true
          }
        }
      });
      return {
        success: false,
        userId,
        paymentIntentId: paymentIntent.id,
        amountCents,
        error: `Payment succeeded but credit grant failed: ${grantResult.error}. Manual intervention required.`
      };
    }
    await prisma.autoTopUpConfig.update({
      where: { userId },
      data: {
        topUpsThisMonth: { increment: 1 },
        lastTopUpAt: /* @__PURE__ */ new Date(),
        lastTopUpAmount: config.topUpCredits,
        lastTopUpError: null,
        consecutiveFailures: 0
      }
    });
    await prisma.creditTransaction.create({
      data: {
        userId,
        amount: config.topUpCredits,
        type: "PURCHASE",
        description: `Auto top-up: ${config.topUpCredits} credits`,
        metadata: {
          paymentIntentId: paymentIntent.id,
          creditGrantId: grantResult.creditGrantId,
          autoTopUp: true
        }
      }
    });
    if (grantResult.creditGrantId) {
      await prisma.stripeCreditGrant.create({
        data: {
          userId,
          stripeCreditGrantId: grantResult.creditGrantId,
          stripeCustomerId: config.user.stripeCustomerId,
          name: `Auto Top-Up - ${config.topUpCredits} credits`,
          category: "paid",
          amountCents,
          credits: config.topUpCredits,
          status: "ACTIVE",
          metadata: {
            paymentIntentId: paymentIntent.id,
            autoTopUp: true
          }
        }
      });
    }
    logger.info(
      {
        userId,
        credits: config.topUpCredits,
        amountCents,
        paymentIntentId: paymentIntent.id,
        creditGrantId: grantResult.creditGrantId
      },
      "Auto top-up successful"
    );
    return {
      success: true,
      userId,
      credits: config.topUpCredits,
      amountCents,
      paymentIntentId: paymentIntent.id,
      creditGrantId: grantResult.creditGrantId
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await prisma.autoTopUpConfig.update({
      where: { userId },
      data: {
        consecutiveFailures: { increment: 1 },
        lastTopUpError: errorMessage
      }
    });
    logger.error({ error, userId }, "Auto top-up failed");
    return {
      success: false,
      userId,
      error: errorMessage
    };
  }
}
async function checkAndProcessAutoTopUps() {
  const results = [];
  let successful = 0;
  let failed = 0;
  let skipped = 0;
  try {
    await resetMonthlyCounters();
    const configs = await prisma.autoTopUpConfig.findMany({
      where: {
        enabled: true,
        stripePaymentMethodId: { not: null },
        consecutiveFailures: { lt: MAX_CONSECUTIVE_FAILURES }
      },
      select: {
        userId: true,
        topUpsThisMonth: true,
        maxMonthlyTopUps: true
      }
    });
    const eligibleUsers = configs.filter(
      (c) => c.topUpsThisMonth < c.maxMonthlyTopUps
    );
    logger.info(
      { totalConfigs: configs.length, eligible: eligibleUsers.length },
      "Checking auto top-ups"
    );
    for (const config of eligibleUsers) {
      const result = await processAutoTopUp(config.userId);
      results.push(result);
      if (result.success) {
        successful++;
      } else if (result.skipped) {
        skipped++;
      } else {
        failed++;
      }
    }
    logger.info(
      { processed: results.length, successful, failed, skipped },
      "Auto top-up check complete"
    );
    return {
      processed: results.length,
      successful,
      failed,
      skipped,
      results
    };
  } catch (error) {
    logger.error({ error }, "Failed to check auto top-ups");
    throw error;
  }
}
async function resetMonthlyCounters() {
  const now = /* @__PURE__ */ new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const configsToReset = await prisma.autoTopUpConfig.findMany({
    where: {
      OR: [
        { monthlyResetAt: null },
        { monthlyResetAt: { lt: firstOfMonth } }
      ],
      topUpsThisMonth: { gt: 0 }
    }
  });
  if (configsToReset.length > 0) {
    await prisma.autoTopUpConfig.updateMany({
      where: {
        id: { in: configsToReset.map((c) => c.id) }
      },
      data: {
        topUpsThisMonth: 0,
        monthlyResetAt: now
      }
    });
    logger.info(
      { count: configsToReset.length },
      "Reset monthly auto top-up counters"
    );
  }
}
async function configureAutoTopUp(options) {
  const {
    userId,
    enabled,
    thresholdCredits,
    topUpCredits,
    stripePaymentMethodId,
    maxMonthlyTopUps
  } = options;
  try {
    if (topUpCredits !== void 0 && topUpCredits < CREDIT_PRICING.MIN_CREDITS) {
      return {
        success: false,
        error: `Minimum top-up amount is ${CREDIT_PRICING.MIN_CREDITS} credits`
      };
    }
    if (thresholdCredits !== void 0 && thresholdCredits < 0) {
      return {
        success: false,
        error: "Threshold must be non-negative"
      };
    }
    const config = await prisma.autoTopUpConfig.upsert({
      where: { userId },
      create: {
        userId,
        enabled,
        thresholdCredits: thresholdCredits ?? 100,
        topUpCredits: topUpCredits ?? 400,
        stripePaymentMethodId,
        maxMonthlyTopUps: maxMonthlyTopUps ?? 5
      },
      update: {
        enabled,
        ...thresholdCredits !== void 0 && { thresholdCredits },
        ...topUpCredits !== void 0 && { topUpCredits },
        ...stripePaymentMethodId !== void 0 && { stripePaymentMethodId },
        ...maxMonthlyTopUps !== void 0 && { maxMonthlyTopUps },
        // Reset consecutive failures when re-enabling
        ...enabled && { consecutiveFailures: 0, lastTopUpError: null }
      }
    });
    logger.info({ userId, enabled, config }, "Configured auto top-up");
    return { success: true, config: formatConfig(config) };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error, userId }, "Failed to configure auto top-up");
    return { success: false, error: errorMessage };
  }
}
async function getAutoTopUpConfig(userId) {
  const config = await prisma.autoTopUpConfig.findUnique({
    where: { userId }
  });
  if (!config) {
    return null;
  }
  return formatConfig(config);
}
function formatConfig(config) {
  return {
    enabled: config.enabled,
    thresholdCredits: config.thresholdCredits,
    topUpCredits: config.topUpCredits,
    hasPaymentMethod: !!config.stripePaymentMethodId,
    maxMonthlyTopUps: config.maxMonthlyTopUps,
    topUpsThisMonth: config.topUpsThisMonth,
    remainingTopUps: config.maxMonthlyTopUps - config.topUpsThisMonth,
    lastTopUpAt: config.lastTopUpAt,
    lastTopUpAmount: config.lastTopUpAmount,
    lastTopUpError: config.lastTopUpError,
    consecutiveFailures: config.consecutiveFailures,
    isDisabledDueToFailures: config.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES
  };
}
async function disableAutoTopUp(userId) {
  try {
    await prisma.autoTopUpConfig.update({
      where: { userId },
      data: { enabled: false }
    });
    logger.info({ userId }, "Disabled auto top-up");
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error, userId }, "Failed to disable auto top-up");
    return { success: false, error: errorMessage };
  }
}

export {
  CREDIT_PRICING,
  createCreditGrant,
  getCreditBalance,
  listCreditGrants,
  voidCreditGrant,
  syncCreditBalanceToDatabase,
  createPromotionalCredits,
  grantFirstDeploymentBonus,
  processAutoTopUp,
  checkAndProcessAutoTopUps,
  configureAutoTopUp,
  getAutoTopUpConfig,
  disableAutoTopUp
};
