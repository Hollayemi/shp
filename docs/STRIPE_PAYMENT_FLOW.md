# Stripe Payment Flow & Credit Management

This document explains how Stripe payments, subscriptions, and credit management work in the Shipper platform.

---

## Table of Contents

1. [Overview](#overview)
2. [Subscription Flow](#subscription-flow)
3. [Credit Management System](#credit-management-system)
4. [Webhook Events](#webhook-events)
5. [Credit Rollover Logic](#credit-rollover-logic)
6. [Upgrade & Downgrade Flow](#upgrade--downgrade-flow)
7. [Edge Cases & Safety Mechanisms](#edge-cases--safety-mechanisms)

---

## Overview

Shipper uses Stripe for subscription management with a credit-based system. Users subscribe to monthly plans (Pro 100, Pro 400, Pro 800, etc.) and receive a monthly credit allocation that can be used for AI-powered development features.

### Key Concepts

- **Base Plan Credits**: Monthly credit allocation for the current subscription tier
- **Carry-Over Credits**: Unused credits from previous cycles that roll over for 1 month
- **Credit Balance**: Total available credits (Base Plan + Carry-Over)
- **Credit Rollover**: Unused base plan credits automatically roll over to the next month

---

## Subscription Flow

### 1. User Initiates Subscription

**Frontend**: `PricingModal.tsx` or `PricingSection.tsx`

```typescript
// User selects a plan and clicks "Get Started" or "Upgrade Plan"
const response = await fetch("/api/stripe/subscribe", {
  method: "POST",
  body: JSON.stringify({ 
    tierId: "pro-400",  // e.g., pro-100, pro-400, pro-800
    returnUrl: window.location.href 
  }),
});
```

**Backend**: `/api/stripe/subscribe/route.ts`

1. Validates tier information
2. Checks if user already has a subscription
3. **Restriction**: Blocks same-tier or lower-tier subscriptions (forces upgrades only)
4. Creates Stripe Checkout Session
5. Redirects user to Stripe payment page

```typescript
// Validation logic
if (user?.stripeSubscriptionId && user.membershipTier !== 'FREE') {
  const currentCredits = user.basePlanCredits || 0;
  const requestedCredits = tierInfo.monthlyCredits;
  
  if (requestedCredits <= currentCredits) {
    // Block same or lower tier
    return error("You can only upgrade to a higher credit tier");
  }
}
```

---

### 2. Stripe Checkout

User completes payment on Stripe's hosted checkout page. Stripe handles:
- Payment processing
- Card validation
- 3D Secure authentication
- Subscription creation

---

### 3. Webhook Events

After successful payment, Stripe sends webhook events to `/api/webhooks/stripe`:

**Key Events:**
- `checkout.session.completed` - Payment successful
- `customer.subscription.created` - New subscription created
- `customer.subscription.updated` - Subscription modified (upgrade/downgrade)
- `invoice.payment_succeeded` - Monthly renewal payment successful

---

## Credit Management System

### Database Schema

```prisma
model User {
  creditBalance       Int       // Total available credits
  basePlanCredits     Int       // Current month's plan allocation
  carryOverCredits    Int       // Rolled over from previous month
  carryOverExpiresAt  DateTime? // When carry-over expires
  membershipTier      String    // FREE, PRO, ENTERPRISE
  stripeSubscriptionId String?  // Stripe subscription ID
}
```

### Credit Types

1. **Base Plan Credits**
   - Monthly allocation based on subscription tier
   - Resets every billing cycle
   - Unused portion rolls over for 1 month

2. **Carry-Over Credits**
   - Unused credits from previous billing cycle
   - Automatically expire at next renewal
   - Can come from:
     - Unused base plan credits (rolled over)
     - Purchased one-time credits (preserved until first renewal)
     - Upgrade leftovers (expire at next renewal)

3. **Total Credit Balance**
   - `creditBalance = basePlanCredits + carryOverCredits`
   - This is what users see and spend

---

## Webhook Events

### Event 1: `customer.subscription.created`

**Triggered**: When a new subscription is created (first-time subscription or upgrade)

**Handler**: `handleSubscriptionChange()` in `stripe-handlers.ts`

**Logic**:
- Determines if it's a first subscription or upgrade
- Calls appropriate handler:
  - `handleSubscriptionActivation()` for first-time subscriptions
  - `handleSubscriptionUpgrade()` for mid-cycle upgrades

---

### Event 2: `invoice.payment_succeeded`

**Triggered**: When a subscription payment succeeds (renewals)

**Handler**: `handlePaymentSuccess()` in `stripe-handlers.ts`

**Logic**:
- **Skips first invoice** (`billing_reason === "subscription_create"`) to avoid double allocation
- Handles monthly renewals
- Implements credit rollover logic

---

## Credit Rollover Logic

### The Rule

> **Any cycle's unused credits roll over for 1 month. Carry-over always expires at the next renewal.**

### How It Works

#### Scenario 1: Normal Renewal (No Upgrade)

```
Oct 1 (Start Pro 400):
  basePlanCredits: 400
  carryOverCredits: 0
  creditBalance: 400

Oct 1 - Nov 1:
  User spends 200 credits
  creditBalance: 200 (remaining)

Nov 1 (Renewal):
  1. Old carryOverCredits (0) → EXPIRE
  2. Calculate unused: 200 - 0 = 200
  3. Unused becomes NEW carryOverCredits: 200
  4. Add new basePlanCredits: 400
  
  Result:
  basePlanCredits: 400
  carryOverCredits: 200 (expires Dec 1)
  creditBalance: 600

Nov 1 - Dec 1:
  User spends 300 credits
  creditBalance: 300 (100 from carryOver + 200 from base)

Dec 1 (Renewal):
  1. Old carryOverCredits (100) → EXPIRE
  2. Calculate unused: 300 - 100 = 200
  3. Unused becomes NEW carryOverCredits: 200
  4. Add new basePlanCredits: 400
  
  Result:
  basePlanCredits: 400
  carryOverCredits: 200 (expires Jan 1)
  creditBalance: 600
```

**Code Implementation**:

```typescript
// At renewal in handlePaymentSuccess()
const currentBalance = user.creditBalance;
const currentCarryOver = user.carryOverCredits;

// Calculate unused from base plan (excluding old carry-over)
const unusedFromBasePlan = Math.max(0, currentBalance - currentCarryOver);

// Unused becomes new carry-over
const newCarryOver = unusedFromBasePlan;
const newBasePlan = tierInfo.monthlyCredits;
const newTotalBalance = newCarryOver + newBasePlan;

await prisma.user.update({
  data: {
    basePlanCredits: newBasePlan,
    carryOverCredits: newCarryOver,
    carryOverExpiresAt: newPeriodEnd, // Next renewal date
    creditBalance: newTotalBalance,
  }
});
```

---

#### Scenario 2: Mid-Cycle Upgrade

```
Oct 1 (Start Pro 100):
  basePlanCredits: 100
  carryOverCredits: 0
  creditBalance: 100

Oct 15 (Upgrade to Pro 400):
  Old balance: 50 (leftover from Pro 100)
  New basePlanCredits: 400
  
  Result:
  basePlanCredits: 400
  carryOverCredits: 50 (from old plan, expires Nov 1)
  creditBalance: 450

Oct 15 - Nov 1:
  User spends 250 credits
  creditBalance: 200 (150 from base + 50 from carryOver)

Nov 1 (Renewal):
  1. Old carryOverCredits (50) → EXPIRE
  2. Calculate unused: 200 - 50 = 150
  3. Unused becomes NEW carryOverCredits: 150
  4. Add new basePlanCredits: 400
  
  Result:
  basePlanCredits: 400
  carryOverCredits: 150 (expires Dec 1)
  creditBalance: 550
```

**Key Point**: Mid-cycle upgrade credits run until the **next scheduled renewal**, not a full month from upgrade date.

---

#### Scenario 3: First Subscription with Purchased Credits

```
FREE User (with 50 purchased credits):
  creditBalance: 50
  basePlanCredits: 0
  carryOverCredits: 0

Subscribe to Pro 400:
  Preserve existing credits as carryOver
  
  Result:
  basePlanCredits: 400
  carryOverCredits: 50 (purchased credits, expire at first renewal)
  creditBalance: 450

Nov 1 (First Renewal):
  1. Old carryOverCredits (50) → EXPIRE
  2. Calculate unused: 200 - 50 = 150
  3. Unused becomes NEW carryOverCredits: 150
  4. Add new basePlanCredits: 400
  
  Result:
  basePlanCredits: 400
  carryOverCredits: 150
  creditBalance: 550
```

---

## Upgrade & Downgrade Flow

### Upgrade Restrictions

**Users can ONLY upgrade to higher tiers** (Lovable model):

```typescript
// Backend validation in /api/stripe/subscribe/route.ts
const currentCredits = user.basePlanCredits || 0;
const requestedCredits = tierInfo.monthlyCredits;

if (requestedCredits <= currentCredits) {
  return error("You can only upgrade to a higher credit tier");
}
```

**Frontend filtering**:
- Dropdown only shows tiers with MORE credits than current plan
- Button text changes to "Upgrade Plan" for subscribed users
- Message: "Upgrading will preserve your unused credits"

### Upgrade Process

1. User selects higher tier in `PricingModal`
2. Backend validates upgrade is to higher tier
3. Stripe creates new checkout session
4. User completes payment
5. Webhook `customer.subscription.updated` fires
6. `handleSubscriptionUpgrade()` executes:
   - Preserves all current credits as carryOver
   - Adds new base plan credits
   - Sets carryOverExpiresAt to next renewal

### No Downgrades

Users cannot downgrade or purchase same-tier subscriptions. They must:
- Wait for current subscription to expire
- Or cancel and resubscribe (loses credits)

---

## Edge Cases & Safety Mechanisms

### 1. Double Allocation Prevention

**Problem**: Webhook events can fire multiple times or race conditions can occur.

**Solution**: Multiple safety checks

```typescript
// Check 1: Skip first invoice in payment success handler
if (invoice.billing_reason === "subscription_create") {
  console.log("Skipping first invoice - already handled by subscription.created");
  return;
}

// Check 2: Check for existing transaction
const existingTransaction = await prisma.creditTransaction.findFirst({
  where: {
    userId,
    type: "MONTHLY_ALLOCATION",
    metadata: { subscriptionId }
  }
});

if (existingTransaction) {
  console.log("Credits already allocated - skipping");
  return;
}
```

### 2. Self-Healing Logic

**Problem**: Users might have missing `basePlanCredits` from old system.

**Solution**: Auto-fix on credit fetch

```typescript
// In credits/server/procedures.ts
if (basePlanCredits === 0 && creditBalance > 0 && membershipTier !== 'FREE') {
  // Auto-fix: set basePlanCredits to current balance
  basePlanCredits = creditBalance;
  carryOverCredits = 0;
  
  // Update database (fire and forget)
  prisma.user.update({
    where: { id: userId },
    data: { basePlanCredits, carryOverCredits: 0 }
  });
}
```

### 3. Carry-Over Expiration

**Problem**: Carry-over credits should auto-expire at renewal.

**Solution**: Check expiration on every credit fetch

```typescript
const now = new Date();
const carryOverExpired = carryOverExpiresAt && new Date(carryOverExpiresAt) <= now;

if (carryOverExpired && carryOverCredits > 0) {
  // Clear expired carry-over
  await prisma.user.update({
    data: {
      carryOverCredits: 0,
      carryOverExpiresAt: null,
      creditBalance: { decrement: carryOverCredits }
    }
  });
}
```

### 4. Admin Subscription Cancellation

**Problem**: Admin cancels subscription, what happens to credits?

**Solution**: Reset everything to FREE tier

```typescript
// In admin/server/procedures.ts - cancelSubscription
await prisma.user.update({
  data: {
    membershipTier: "FREE",
    stripeSubscriptionId: null,
    creditBalance: 0,
    basePlanCredits: 0,
    carryOverCredits: 0,
    carryOverExpiresAt: null,
  }
});
```

---

## Credit Transaction Logging

Every credit change is logged in `CreditTransaction` table:

```typescript
await prisma.creditTransaction.create({
  data: {
    userId,
    amount: tierInfo.monthlyCredits,
    type: "MONTHLY_ALLOCATION", // or "PURCHASE", "REFUND", "USAGE"
    description: "Monthly renewal: Pro 400 - 400 new credits + 200 rolled over",
    metadata: {
      subscriptionId,
      invoiceId,
      isRenewal: true,
      oldCarryOverExpired: 50,
      unusedFromBasePlan: 200,
      newCarryOver: 200,
      totalCredits: 600,
    }
  }
});
```

This provides full audit trail for debugging and support.

---

## Summary

### Key Principles

1. **Rollover Rule**: Unused base plan credits roll over for 1 month
2. **Carry-Over Expiration**: All carry-over expires at next renewal
3. **Upgrade Only**: Users can only upgrade to higher tiers
4. **Credit Preservation**: Upgrades preserve all existing credits
5. **No Proration**: Users pay full price on upgrade, get full credits immediately

### Credit Flow

```
Month 1: Get 400 credits → Use 200 → 200 remain
Month 2: 200 rolled + 400 new = 600 total → Use 300 → 300 remain
Month 3: 300 - 200 (expired) = 100 rolled + 400 new = 500 total
```

### Files Reference

- **Subscription API**: `/apps/web/src/app/api/stripe/subscribe/route.ts`
- **Webhook Handler**: `/apps/web/src/app/api/webhooks/stripe/route.ts`
- **Stripe Handlers**: `/apps/web/src/inngest/stripe-handlers.ts`
- **Credit Procedures**: `/apps/web/src/modules/credits/server/procedures.ts`
- **Frontend Components**: 
  - `/apps/web/src/components/PricingModal.tsx`
  - `/apps/web/src/components/PricingSection.tsx`
  - `/apps/web/src/components/CreditsDisplay.tsx`

---

## Testing

Run the comprehensive test script:

```bash
npx tsx scripts/test-credit-rollover.ts
```

This tests all scenarios:
- First subscription (with/without existing credits)
- Normal renewals with rollover
- Mid-cycle upgrades
- Multiple renewal cycles
- Full usage (no rollover)
- No usage (full rollover)
