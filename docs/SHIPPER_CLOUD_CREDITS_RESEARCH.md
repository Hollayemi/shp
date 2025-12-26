# Shipper Cloud Credits System Research

## Implementation Status

**Completed:**

1. **Stripe Billing Credits Service** (`apps/billing/src/services/stripe-credits.ts`)
   - `createCreditGrant()` - Create Stripe Credit Grants for users
   - `getCreditBalance()` - Get available credit balance from Stripe
   - `listCreditGrants()` - List all credit grants for a user
   - `voidCreditGrant()` - Void an unused credit grant
   - `syncCreditBalanceToDatabase()` - Sync Stripe balance to local DB
   - `createPromotionalCredits()` - Create bonus/promotional credits

2. **Auto Top-Up Service** (`apps/billing/src/services/auto-top-up.ts`)
   - `configureAutoTopUp()` - Set up auto top-up preferences
   - `processAutoTopUp()` - Process top-up for a single user
   - `checkAndProcessAutoTopUps()` - Batch check all eligible users
   - Monthly limit tracking with automatic reset
   - Consecutive failure tracking with auto-disable

3. **Database Models** (`packages/database/prisma/schema.prisma`)
   - `AutoTopUpConfig` - User auto top-up preferences
   - `StripeCreditGrant` - Track credit grants synced from Stripe

4. **API Routes** (`apps/billing/src/routes/credits.ts`)
   - `GET /credits/:userId/balance` - Get credit balance
   - `POST /credits/:userId/sync` - Sync balance from Stripe
   - `GET /credits/:userId/grants` - List credit grants
   - `POST /credits/:userId/grants` - Create credit grant
   - `POST /credits/:userId/promotional` - Create promotional credits
   - `DELETE /credits/:userId/grants/:grantId` - Void grant
   - `GET /credits/:userId/auto-top-up` - Get auto top-up config
   - `POST /credits/:userId/auto-top-up` - Configure auto top-up
   - `DELETE /credits/:userId/auto-top-up` - Disable auto top-up
   - `POST /credits/:userId/auto-top-up/trigger` - Manual trigger
   - `POST /credits/auto-top-up/check-all` - Check all users

5. **Inngest Webhook Handlers** (`apps/web/src/inngest/stripe-handlers.ts`)
   - Credit purchases now create Stripe Credit Grants
   - Subscription activations create Credit Grants
   - Subscription renewals create Credit Grants
   - Subscription upgrades create Credit Grants

6. **BullMQ Scheduled Cron Job** (`apps/billing/src/services/meter-event-queue.ts`)
   - `startScheduledJobsWorker()` - Worker for cron jobs
   - `setupAutoTopUpCron()` - Sets up every-5-minute auto top-up check
   - Automatically started when billing service starts

**Pending:**
- Run database migration (`pnpm db:migrate:dev add_credit_grants_and_auto_topup`)
- Add UI for auto top-up configuration
- Add email notifications for low balance/top-up events

---

## Current State Analysis

### Existing Architecture

Your billing system has two separate credit/billing mechanisms:

1. **Shipper Credits System** (`apps/web/src/lib/credits.ts`)
   - User-level credit balance stored in `User.creditBalance`
   - Supports credit purchases, monthly allocations, and deductions
   - Used for AI generation, sandbox usage, deployments
   - Simple integer-based credits (e.g., 100 credits = $25)

2. **Convex Usage Metered Billing** (`apps/billing/`)
   - Uses Stripe Billing Meters for real-time usage tracking
   - Bills team owners directly via Stripe subscriptions
   - 8 separate meters: function calls, action compute, database bandwidth/storage, file bandwidth/storage, vector bandwidth/storage
   - Each usage event sends meter events to Stripe in real-time

### Current Problem

Right now, Convex usage is billed **separately** from Shipper credits:
- Users pay a subscription for Shipper credits
- Convex usage is metered and charged **on top** via Stripe invoices
- This creates confusion and unpredictable bills for users

## Recommended Solution: Unified Shipper Cloud Credits

### Option 1: Use Stripe's New Billing Credits (Recommended)

Stripe's new [Billing Credits](https://docs.stripe.com/billing/subscriptions/usage-based/billing-credits) system is purpose-built for this:

**How it works:**
1. User purchases Shipper Cloud credits (prepaid)
2. Create a Stripe Credit Grant for the customer
3. Convex usage continues to report to Stripe meters
4. At invoice time, Stripe automatically deducts from Credit Grant balance
5. When credits run low, auto top-up kicks in

**Key Benefits:**
- Stripe handles all the accounting
- Immutable ledger for all transactions
- Native integration with existing meters
- Credit expiration support
- Priority ordering (promotional vs. paid credits)

**Implementation Steps:**

```typescript
// 1. Create a Credit Grant when user purchases credits
const creditGrant = await stripe.billing.creditGrants.create({
  customer: stripeCustomerId,
  name: `Shipper Cloud Credits - ${credits} credits`,
  applicability_config: {
    scope: {
      price_type: 'metered', // Only applies to metered prices
    },
  },
  category: 'paid', // or 'promotional' for bonuses
  amount: {
    type: 'monetary',
    monetary: {
      value: amountInCents, // $100 = 10000
      currency: 'usd',
    },
  },
});

// 2. Check credit balance
const creditBalanceSummary = await stripe.billing.creditBalanceSummary.retrieve({
  customer: stripeCustomerId,
  filter: {
    type: 'applicability_scope',
    applicability_scope: {
      price_type: 'metered',
    },
  },
});

// 3. Existing meter events continue as-is
// Convex usage automatically deducts from credit balance at invoice time
```

### Option 2: Self-Managed Credit System

Keep your existing `creditBalance` in the database and manually deduct:

**How it works:**
1. Convert Convex usage to Shipper credits internally
2. Instead of sending meter events to Stripe, deduct from user's balance
3. When balance is low, prompt for top-up

**Implementation:**

```typescript
// In apps/billing/src/services/convex-usage.ts
// Instead of sending meter events, deduct credits:

async function deductCreditsForConvexUsage(
  userId: string,
  metrics: ConvexUsageMetrics
): Promise<void> {
  // Convert usage to credit cost using pricing rates
  const cost = calculateShipperCloudCredits(metrics);

  // Deduct from user's credit balance
  await prisma.user.update({
    where: { id: userId },
    data: {
      creditBalance: { decrement: cost },
      lifetimeCreditsUsed: { increment: cost },
    },
  });

  // Log the transaction
  await prisma.creditTransaction.create({
    data: {
      userId,
      amount: -cost,
      type: 'CONVEX_USAGE', // Need to add this to CreditType enum
      description: 'Shipper Cloud usage',
      metadata: metrics,
    },
  });
}
```

### Recommendation: Hybrid Approach

Use **Stripe Billing Credits** but sync with your internal system:

1. **Credit Purchase Flow:**
   - User purchases credits via Stripe Checkout
   - Create Credit Grant in Stripe
   - Update local `creditBalance` for UI display

2. **Usage Flow:**
   - Convex usage continues to send meter events to Stripe
   - Stripe automatically applies Credit Grants at invoice time
   - Sync balance back to local DB via webhook

3. **Auto Top-Up:**
   - Use Stripe Billing Thresholds or custom webhooks
   - When balance falls below threshold, trigger auto-purchase

## Auto Top-Up Implementation

### Option A: Stripe Billing Thresholds + Alerts

```typescript
// Set up billing threshold to invoice when usage exceeds credit balance
const subscription = await stripe.subscriptions.update(subscriptionId, {
  billing_thresholds: {
    amount_gte: 5000, // Invoice when $50 in usage accrues
  },
});

// Set up usage alert for low credits
// (Currently in preview - request access from Stripe)
const alert = await stripe.billing.alerts.create({
  alert_type: 'usage_threshold',
  title: 'Low Shipper Cloud Credits',
  filter: {
    customer: stripeCustomerId,
    subscription_item: subscriptionItemId,
  },
  usage_threshold: {
    gte: 8000, // Alert when 80% of credits used
    meter: meterId,
    recurrence: 'one_time',
  },
});
```

### Option B: Custom Auto Top-Up System (Recommended)

Create a scheduled job to check balances and auto-purchase:

**Database Schema Addition:**

```prisma
model AutoTopUpConfig {
  id                String   @id @default(cuid())
  userId            String   @unique
  user              User     @relation(fields: [userId], references: [id])

  enabled           Boolean  @default(false)
  threshold         Int      @default(100)  // Credit amount to trigger top-up
  topUpAmount       Int      @default(400)  // Credits to purchase
  topUpPriceId      String?                 // Stripe Price ID for the amount
  maxMonthlyTopUps  Int      @default(5)    // Prevent runaway charges
  topUpsThisMonth   Int      @default(0)
  lastTopUpAt       DateTime?

  // Payment method
  stripePaymentMethodId String?

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@map("auto_top_up_configs")
}
```

**Service Implementation:**

```typescript
// apps/billing/src/services/auto-top-up.ts

import { stripe } from "../config/stripe.js";
import { prisma } from "@shipper/database";
import { logger } from "../config/logger.js";

export async function checkAndProcessAutoTopUps(): Promise<void> {
  // Find users with low balances and auto top-up enabled
  const usersNeedingTopUp = await prisma.user.findMany({
    where: {
      autoTopUpConfig: {
        enabled: true,
        topUpsThisMonth: { lt: prisma.autoTopUpConfig.fields.maxMonthlyTopUps },
      },
      creditBalance: { lte: prisma.autoTopUpConfig.fields.threshold },
    },
    include: {
      autoTopUpConfig: true,
    },
  });

  for (const user of usersNeedingTopUp) {
    await processAutoTopUp(user);
  }
}

async function processAutoTopUp(user: UserWithConfig): Promise<void> {
  const config = user.autoTopUpConfig!;

  try {
    // Create a payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: getAmountForCredits(config.topUpAmount), // e.g., 400 credits = $100
      currency: 'usd',
      customer: user.stripeCustomerId!,
      payment_method: config.stripePaymentMethodId!,
      confirm: true,
      off_session: true,
      metadata: {
        userId: user.id,
        type: 'auto_top_up',
        credits: config.topUpAmount,
      },
    });

    if (paymentIntent.status === 'succeeded') {
      // Add credits to user
      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: {
            creditBalance: { increment: config.topUpAmount },
          },
        }),
        prisma.autoTopUpConfig.update({
          where: { userId: user.id },
          data: {
            topUpsThisMonth: { increment: 1 },
            lastTopUpAt: new Date(),
          },
        }),
        prisma.creditTransaction.create({
          data: {
            userId: user.id,
            amount: config.topUpAmount,
            type: 'PURCHASE',
            description: `Auto top-up: ${config.topUpAmount} credits`,
            metadata: {
              paymentIntentId: paymentIntent.id,
              autoTopUp: true,
            },
          },
        }),
      ]);

      // If using Stripe Billing Credits, also create a Credit Grant
      if (user.stripeCustomerId) {
        await stripe.billing.creditGrants.create({
          customer: user.stripeCustomerId,
          name: `Auto Top-Up - ${config.topUpAmount} credits`,
          applicability_config: {
            scope: { price_type: 'metered' },
          },
          category: 'paid',
          amount: {
            type: 'monetary',
            monetary: {
              value: getAmountForCredits(config.topUpAmount),
              currency: 'usd',
            },
          },
        });
      }

      logger.info({ userId: user.id, credits: config.topUpAmount }, 'Auto top-up successful');
    }
  } catch (error) {
    logger.error({ error, userId: user.id }, 'Auto top-up failed');
    // TODO: Send notification to user about failed auto top-up
  }
}

// Credit to USD conversion (from your pricing.ts)
function getAmountForCredits(credits: number): number {
  // $25 = 100 credits, so $1 = 4 credits
  // credits * 0.25 = USD amount
  // * 100 for cents
  return Math.round(credits * 25); // $0.25 per credit in cents
}
```

## Unified Pricing Strategy

### Converting Convex Usage to Shipper Credits

Your current Convex rates (from `stripe.ts`):
- Function calls: $3.00 per million
- Action compute: $0.45 per GB-hour
- Database storage: $0.30/GB/month
- Database bandwidth: $0.30/GB
- File storage: $0.045/GB/month
- File bandwidth: $0.45/GB
- Vector storage: $0.75/GB/month
- Vector bandwidth: $0.15/GB

Credit conversion (at $0.25 per credit):
- Function calls: 12 credits per million
- Action compute: 1.8 credits per GB-hour
- Database storage: 1.2 credits per GB/month
- etc.

```typescript
// apps/billing/src/services/credit-conversion.ts

export const CONVEX_TO_CREDITS = {
  functionCallsPerMillion: 12,      // $3.00 / $0.25 = 12 credits
  actionComputePerGBHour: 1.8,      // $0.45 / $0.25 = 1.8 credits
  databaseStoragePerGB: 1.2,        // $0.30 / $0.25 = 1.2 credits
  databaseBandwidthPerGB: 1.2,      // $0.30 / $0.25 = 1.2 credits
  fileStoragePerGB: 0.18,           // $0.045 / $0.25 = 0.18 credits
  fileBandwidthPerGB: 1.8,          // $0.45 / $0.25 = 1.8 credits
  vectorStoragePerGB: 3,            // $0.75 / $0.25 = 3 credits
  vectorBandwidthPerGB: 0.6,        // $0.15 / $0.25 = 0.6 credits
};

export function calculateConvexUsageCredits(metrics: ConvexUsageMetrics): number {
  const GB = 1024 * 1024 * 1024;
  const MS_PER_HOUR = 3600000;
  const MB_PER_GB = 1024;
  const MEMORY_MB = 128;

  let totalCredits = 0;

  // Function calls
  totalCredits += (Number(metrics.functionCalls) / 1_000_000) * CONVEX_TO_CREDITS.functionCallsPerMillion;

  // Action compute (convert ms to GB-hours)
  const gbHours = (MEMORY_MB / MB_PER_GB) * (Number(metrics.actionComputeMs) / MS_PER_HOUR);
  totalCredits += gbHours * CONVEX_TO_CREDITS.actionComputePerGBHour;

  // Bandwidth
  totalCredits += (Number(metrics.databaseBandwidthBytes) / GB) * CONVEX_TO_CREDITS.databaseBandwidthPerGB;
  totalCredits += (Number(metrics.fileBandwidthBytes) / GB) * CONVEX_TO_CREDITS.fileBandwidthPerGB;
  totalCredits += (Number(metrics.vectorBandwidthBytes) / GB) * CONVEX_TO_CREDITS.vectorBandwidthPerGB;

  // Storage (peak)
  totalCredits += (Number(metrics.databaseStorageBytes) / GB) * CONVEX_TO_CREDITS.databaseStoragePerGB;
  totalCredits += (Number(metrics.fileStorageBytes) / GB) * CONVEX_TO_CREDITS.fileStoragePerGB;
  totalCredits += (Number(metrics.vectorStorageBytes) / GB) * CONVEX_TO_CREDITS.vectorStoragePerGB;

  return Math.ceil(totalCredits);
}
```

## Implementation Roadmap

### Phase 1: Add Stripe Billing Credits Support

1. Create Credit Grant when user purchases credits
2. Add `CreditGrant` tracking to database (optional - Stripe is source of truth)
3. Update checkout flow to create Credit Grants

### Phase 2: Unify Billing

1. Keep existing Stripe meters (they're already set up)
2. At invoice time, Stripe automatically applies Credit Grants
3. Add webhook handler for `invoice.created` and `invoice.paid`
4. Sync credit balance back to local database

### Phase 3: Auto Top-Up

1. Add `AutoTopUpConfig` model to schema
2. Create settings UI for auto top-up preferences
3. Implement scheduled job to check balances
4. Add webhook for payment failures

### Phase 4: Dashboard & Notifications

1. Add credit usage dashboard showing:
   - Current balance
   - Usage breakdown by category
   - Projected usage
2. Email notifications for:
   - Low balance warnings
   - Auto top-up confirmations
   - Auto top-up failures

## API Endpoints to Add

```
POST /users/:userId/credit-grants       - Create manual credit grant
GET  /users/:userId/credit-balance      - Get current credit balance
POST /users/:userId/auto-top-up         - Configure auto top-up
GET  /users/:userId/usage-summary       - Get usage breakdown
POST /webhook/stripe                    - Handle Stripe events
```

## Sources

- [Billing Credits Documentation](https://docs.stripe.com/billing/subscriptions/usage-based/billing-credits)
- [Set up Billing Credits](https://docs.stripe.com/billing/subscriptions/usage-based/billing-credits/implementation-guide)
- [Credit-Based Pricing Model](https://docs.stripe.com/billing/subscriptions/usage-based/use-cases/credits-based-pricing-model)
- [Alerts and Thresholds](https://docs.stripe.com/billing/subscriptions/usage-based/alerts-and-thresholds)
- [Customer Balance](https://docs.stripe.com/billing/customer/balance)
- [Stripe Blog: Introducing Credits](https://stripe.com/blog/introducing-credits-for-usage-based-billing)
