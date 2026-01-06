# 🏛️ Complete Stripe Integration & Admin Dashboard Guide

> **A comprehensive guide to our production-ready Stripe integration with credit system, subscriptions, and admin management tools.**

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [User Features](#user-features)
- [Admin Dashboard](#admin-dashboard)
- [API Endpoints](#api-endpoints)
- [Database Schema](#database-schema)
- [Webhook System](#webhook-system)
- [Subscription Logic](#subscription-logic)
- [Pricing Components](#pricing-components)
- [Testing Guide](#testing-guide)
- [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

We've built a **complete Stripe-powered billing system** with:

- **💰 Credit System** - Users buy credits for platform usage
- **🔄 Multi-tier Subscriptions** - Free, Pro, Enterprise tiers with variants
- **🏛️ Admin Dashboard** - Full user management and billing control
- **🔗 Real-time Webhooks** - Automatic credit allocation and subscription sync
- **⚡ Usage-Based Deduction** - Credits automatically deducted for platform usage
- **🔧 Debug Tools** - Testing and troubleshooting utilities

This system handles everything from one-time credit purchases to recurring subscriptions, with automatic credit deduction for platform usage and a powerful admin interface for customer support and business operations.

---

## ✨ Features

### 🛒 **Credit Purchase System**
- One-time credit packages (100, 250, 500, 1000, 2500 credits)
- Secure Stripe Checkout integration
- Automatic credit allocation via webhooks
- Purchase history and transaction logging

### 🔄 **Enhanced Subscription System**
- **Pro Tier**: Dynamic credit options with dropdown selection (100-5000 credits)
- **Enterprise Tier**: Contact-based custom solutions
- **Smart Upgrade Logic**: Prorated credit allocation for mid-cycle upgrades
- **Renewal Management**: Automatic monthly credit allocation with safety checks
- **Cancellation Handling**: Immediate credit removal and tier downgrade
- Monthly credit allocations for Pro users with usage tracking
- Automatic subscription management with server-side validation

### 🏛️ **Admin Dashboard**
- **User Management**: View all users with credits, tiers, subscription status
- **Multi-Page Interface**: Clickable user rows open detailed user pages
- **Credit Operations**: Add credits, reset to exact amounts
- **Subscription Control**: Fix broken subscriptions, cancel memberships
- **Tier Management**: Manually upgrade/downgrade users
- **Invoice Generation**: Create downloadable Stripe invoices for custom billing
- **Transaction History**: Detailed view of all user transactions
- **Transaction-Based Invoicing**: Generate invoices based on specific transactions
- **Real-time Stats**: User counts, credit totals, subscription metrics
- **Audit Trail**: All admin actions logged with timestamps

### 🎨 **Modern Pricing Components**
- **PricingSection**: Full-page pricing display with dropdown credit selection
- **PricingModal**: Popup pricing interface accessible from anywhere
- **Dynamic Pricing**: Real-time price updates based on credit selection
- **Server-side Validation**: Prevents client-side price tampering
- **Responsive Design**: Mobile and desktop optimized layouts

### 🔗 **Webhook Integration**
- **Real-time Processing**: Credit purchases, subscription changes, renewals
- **Smart Allocation**: Prevents double credit allocation with safety checks
- **Upgrade Detection**: Automatic prorated credit calculation for upgrades
- **Renewal Management**: Monthly credit allocation with invoice tracking
- **Cancellation Logic**: Immediate credit removal and tier reset
- **Payment Failure Handling**: Grace period and retry logic
- **Event Deduplication**: Prevents duplicate processing of same events

### ⚡ **Usage-Based Credit System**
- **Project Creation**: 1 credit automatically deducted when creating new projects
- **Message Generation**: 1 credit deducted per message sent in projects
- **Real-time Balance Updates**: Credit balance refreshes immediately after usage
- **Insufficient Credits Protection**: Users blocked from actions when credits insufficient
- **Helpful Error Messages**: Clear guidance to purchase more credits when needed
- **Transaction Logging**: All credit usage tracked with detailed audit trail
- **UI Integration**: Credit balance displayed throughout the application interface

---

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend UI   │    │   API Routes    │    │   Database      │
│                 │    │                 │    │                 │
│ • Test Pages    │───▶│ • Credit APIs   │───▶│ • Users         │
│ • Admin Panel   │    │ • Subscription  │    │ • Transactions  │
│ • Dashboards    │    │ • Admin Ops     │    │ • Subscriptions │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       ▲
         │                       │                       │
         ▼                       ▼                       │
┌─────────────────┐    ┌─────────────────┐              │
│     Stripe      │    │    Inngest      │              │
│                 │    │                 │              │
│ • Checkout      │───▶│ • Webhooks      │──────────────┘
│ • Subscriptions │    │ • Credit Alloc  │
│ • Payments      │    │ • Error Handling│
└─────────────────┘    └─────────────────┘
```

### 🔧 **Tech Stack**
- **Frontend**: Next.js 14, React, TailwindCSS, shadcn/ui
- **Backend**: Next.js API Routes, tRPC, Prisma ORM
- **Database**: PostgreSQL with Prisma
- **Payments**: Stripe (Checkout, Subscriptions, Webhooks)
- **Event Processing**: Inngest for webhook handling
- **Authentication**: NextAuth.js
- **Type Safety**: End-to-end TypeScript with tRPC

---

## 🚀 Getting Started

### 1. **Environment Setup**
```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Database
DATABASE_URL=postgresql://...

# Auth
NEXTAUTH_SECRET=your-secret
NEXTAUTH_URL=http://localhost:3000

# App Configuration
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### 2. **Database Migration**
```bash
npx prisma migrate deploy
npx prisma generate
```

### 3. **Stripe CLI Setup**
```bash
# Install Stripe CLI
stripe login

# Forward webhooks to local development
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

### 4. **Development Server**
```bash
npm run dev
# Visit http://localhost:3000
```

---

## 👤 User Features

### 💳 **Credit Purchase Flow**

1. **Access**: Navigate to `/test-checkout`
2. **Select Package**: Choose from available credit packages
3. **Stripe Checkout**: Secure payment processing
4. **Webhook Processing**: Automatic credit allocation
5. **Confirmation**: Credits added to user balance

**Available Packages:**
- 100 credits - $10
- 250 credits - $20  
- 500 credits - $35
- 1000 credits - $60
- 2500 credits - $120

### 🔄 **Subscription Management**

1. **Access**: Navigate to `/test-subscription`
2. **Choose Tier**: Select from enhanced membership options
3. **Stripe Checkout**: Monthly subscription setup
4. **Activation**: Immediate credit allocation + monthly renewals

### 💰 **Credit Purchase for Subscribers**

1. **Access**: Click "Buy More" on any credit display when you have a subscription
2. **Modal Opens**: Beautiful popup with credit packages
3. **Purchase**: Credits added **on top** of current balance
4. **Renewal Logic**: Subscription renewals still reset to monthly allocation
5. **Separate Business Logic**: Purchased credits are independent of subscription tiers

**Example Flow:**
- User has Pro 400 subscription (400 credits/month)
- User has 150 credits remaining mid-month
- User purchases 500 additional credits → **650 total credits**
- Next renewal: Reset to exactly 400 credits (purchased credits consumed)

### 📄 **Invoice Generation**

1. **Admin Access**: Available in `/admin/dashboard`
2. **Generate Invoice**: Click 📄 button for any user
3. **Enter Details**: Amount, description, optional due date
4. **Download Options**: Hosted Stripe page or direct PDF download
5. **Customer Access**: Users receive shareable invoice link

### 👤 **User Detail Pages**

1. **Access**: Click any user row in main admin dashboard
2. **User Overview**: Complete user stats, credit balance, membership info
3. **Transaction History**: Last 50 transactions with full details
4. **Purchase History**: Complete Stripe purchase records
5. **Transaction-Based Invoicing**: Generate invoices based on specific transactions
6. **Custom Invoicing**: Create custom invoices not tied to transactions
7. **Smart Suggestions**: Auto-suggested amounts based on transaction values

**Subscription Tiers:**

| Tier | Credits/Month | Price/Month | Features |
|------|---------------|-------------|----------|
| Pro | 100 | $25 | Advanced AI, unlimited projects, priority support |
| Pro | 200 | $50 | API access, team collaboration |
| Pro | 400 | $100 | ⭐ **Popular** - Custom domains, advanced templates |
| Pro | 800 | $200 | Enhanced features and priority |
| Pro | 1,200 | $294 | High-volume usage |
| Pro | 2,000 | $480 | Professional teams |
| Pro | 3,000 | $705 | Large organizations |
| Pro | 4,000 | $920 | Enterprise-level usage |
| Pro | 5,000 | $1,125 | Maximum credits |
| Enterprise | Custom | Contact Sales | Dedicated support, SSO, custom integrations, on-premise |

---

## 🏛️ Admin Dashboard

### 🎯 **Access**
- **URL**: `/admin/dashboard`
- **Auth**: Admin-only (configurable email whitelist)
- **Security**: All actions logged with admin email

### 📊 **Dashboard Overview**
- **User Statistics**: Total users, tier distribution, credit totals
- **User Table**: Complete user list with key metrics
- **Real-time Data**: Auto-refresh capabilities
- **Action Buttons**: Per-user management controls

### 🛠️ **Admin Operations**

| Button | Function | Description |
|--------|----------|-------------|
| 💰 | **Add Credits** | Add credits on top of current balance |
| ⚡ | **Reset Credits** | Set credits to exact amount (can reduce) |
| 🔧 | **Fix Subscription** | Repair broken Stripe subscription data |
| ❌ | **Cancel Subscription** | Cancel at Stripe + remove subscription |
| 🔄 | **Change Tier** | Manually upgrade/downgrade membership |
| 📄 | **Generate Invoice** | Create downloadable Stripe invoice |

### 🔍 **User Information Display**
- **Name & Email**: Primary identification
- **Credit Balance**: Current available credits
- **Membership Tier**: Current subscription level
- **Subscription Status**: Active/Inactive with expiration dates
- **User ID**: Shortened ID for reference

### 📈 **Statistics Panel**
- **Total Users**: Complete user count
- **Pro Users**: Users on any Pro tier
- **Enterprise Users**: Users on Enterprise tiers  
- **Total Credits**: System-wide credit balance

---

## 🔌 API Endpoints

### 💰 **Credit Management**

#### `POST /api/stripe/buy-credits`
Purchase credits via Stripe Checkout
```json
{
  "packageIndex": 0  // Index from CREDIT_PACKAGES array
}
```

#### `POST /api/user/credits`
Get user credit balance
```json
{
  "credits": 500,
  "transactions": [...],
  "purchases": [...]
}
```

### 🔄 **Subscription Management**

#### `POST /api/stripe/subscribe`
Create subscription checkout session
```json
{
  "tierId": "pro-400"  // Credit-based tier ID (pro-{credits})
}
```

#### `POST /api/fix-subscription`
Fix user's subscription issues
```json
{
  "success": true,
  "tierInfo": { "monthlyCredits": 300 },
  "before": { "creditBalance": 200 },
  "after": { "creditBalance": 500 }
}
```

### 📡 **tRPC Endpoints**

Our system now uses tRPC for type-safe API communication with automatic TypeScript generation.

#### **Admin Router** (`trpc.admin.*`)
- `getAllUsers()` - Fetch all users with statistics
- `getUserDetails(userId)` - Get detailed user information
- `addCredits(userId, credits)` - Add credits to user balance
- `resetCredits(userId, credits)` - Set exact credit amount
- `cancelSubscription(userId)` - Cancel user subscription
- `changeTier(userId, tier)` - Change membership tier
- `generateInvoice(userId, amount, description)` - Create Stripe invoice

#### **Credits Router** (`trpc.credits.*`)
- `getMyCredits()` - Get current user's credit balance
- `getDetailedCredits()` - Enhanced credit info with recent activity
- `getTransactionHistory()` - Paginated transaction data
- `getPurchaseHistory()` - Paginated purchase data

### 🏛️ **Legacy API Operations** (Still Available)

#### `GET /api/admin/users`
Fetch all users with admin data
```json
{
  "users": [...],
  "total": 25,
  "stats": {
    "totalCredits": 12500,
    "proUsers": 8,
    "enterpriseUsers": 3
  }
}
```

#### `POST /api/admin/add-credits`
Admin add credits to user
```json
{
  "userId": "user_id",
  "credits": 100
}
```

#### `POST /api/admin/reset-credits`
Admin set exact credit amount
```json
{
  "userId": "user_id", 
  "credits": 500
}
```

#### `POST /api/admin/cancel-subscription`
Admin cancel user subscription
```json
{
  "userId": "user_id"
}
```

#### `POST /api/admin/change-tier`
Admin change user membership
```json
{
  "userId": "user_id",
  "tier": "PRO"
}
```

#### `POST /api/admin/generate-invoice`
Admin generate downloadable invoice
```json
{
  "userId": "user_id",
  "amount": 50.00,
  "description": "Custom service fee",
  "dueDate": "2024-08-15"
}
```

#### `GET /api/admin/user/[userId]`
Fetch detailed user information for admin
```json
{
  "user": { "id": "...", "email": "...", "creditBalance": 500 },
  "transactions": [...],
  "purchases": [...],
  "subscription": { ... },
  "stats": {
    "transactions": { "totalTransactions": 25, "creditsPurchased": 1000 },
    "purchases": { "totalPurchases": 5, "totalSpent": 12000 }
  }
}
```

### 🔗 **Webhook Endpoints**

#### `POST /api/stripe/webhook`
Stripe webhook processor
- Handles `checkout.session.completed`
- Processes `customer.subscription.created/updated/deleted`
- Manages `invoice.payment_succeeded/failed`

#### `POST /api/inngest`
Inngest event processor
- Credit allocation workflows
- Subscription management
- Error handling and retries

---

## 🗄️ Database Schema

### 👤 **User Model**
```prisma
model User {
  id                    String            @id @default(cuid())
  email                 String            @unique
  name                  String?
  creditBalance         Int               @default(50)
  membershipTier        MembershipTier    @default(FREE)
  membershipExpiresAt   DateTime?
  stripeCustomerId      String?
  stripeSubscriptionId  String?
  lastCreditReset       DateTime?
  monthlyCreditsUsed    Int               @default(0)
  
  // Relations
  creditTransactions    CreditTransaction[]
  creditPurchases       CreditPurchase[]
  subscriptions         Subscription[]
}
```

### 💰 **Credit System**
```prisma
model CreditTransaction {
  id          String      @id @default(cuid())
  userId      String
  amount      Int         // Positive = added, Negative = used
  type        CreditType  // PURCHASE, MONTHLY_ALLOCATION, etc.
  description String
  metadata    Json?
  createdAt   DateTime    @default(now())
}

model CreditPurchase {
  id              String        @id @default(cuid())
  userId          String
  credits         Int
  amountPaid      Int          // In cents
  stripePaymentId String       @unique
  status          PurchaseStatus
  metadata        Json?
  createdAt       DateTime     @default(now())
}
```

### 🔄 **Subscription System**
```prisma
model Subscription {
  id                      String             @id @default(cuid())
  userId                  String
  stripeSubscriptionId    String             @unique
  stripePriceId           String
  stripeCurrentPeriodEnd  DateTime
  stripeCancelAtPeriodEnd Boolean            @default(false)
  status                  SubscriptionStatus
  createdAt               DateTime           @default(now())
  updatedAt               DateTime           @updatedAt
}
```

### 📊 **Enums**
```prisma
enum MembershipTier {
  FREE
  PRO
  ENTERPRISE
}

enum CreditType {
  PURCHASE
  MONTHLY_ALLOCATION
  AI_GENERATION
  SANDBOX_USAGE
  DEPLOYMENT
  TEAM_COLLABORATION
  BONUS
  REFUND
}

enum PurchaseStatus {
  PENDING
  COMPLETED
  FAILED
  REFUNDED
}
```

---

## 🔗 Webhook System

### 🎯 **Event Processing Flow**

```
Stripe Event → Webhook → Inngest → Database Update
```

### 📥 **Handled Events**

#### `checkout.session.completed`
- **Credit Purchases**: Immediate credit allocation (additive to current balance)
- **Subscriptions**: Membership activation + initial credits
- **Subscriber Credit Purchases**: Added on top of current balance via modal purchases

#### `customer.subscription.created/updated`
- **Activation**: Set membership tier + allocate monthly credits
- **Changes**: Update tier and credit allocations

#### `customer.subscription.deleted`
- **Cancellation**: Remove subscription (no downgrade as free tier removed)
- **Cleanup**: Remove subscription references

#### `invoice.payment_succeeded`
- **Monthly Billing**: Allocate monthly credits
- **Renewal**: Reset monthly usage counters

#### `invoice.payment_failed`
- **Grace Period**: Maintain access temporarily
- **Notifications**: Log failed payment attempts

### 🔄 **Retry Logic**
- **Inngest Integration**: Automatic retry on failures
- **Error Logging**: Comprehensive error tracking
- **Fallback Handling**: Graceful degradation

---

## 🔄 Subscription Logic

### 🎯 **Subscription Lifecycle Management**

Our subscription system handles complex scenarios with intelligent business logic:

#### **New Subscriptions**
- **Initial Allocation**: User gets full monthly credit allocation immediately
- **Billing Cycle**: 30-day recurring billing cycle starts
- **Safety Check**: Prevents double allocation if webhook fires multiple times

#### **Subscription Upgrades**
When a user upgrades from Pro 400 → Pro 3000 mid-cycle:

**Smart Prorated Logic:**
```
Days Remaining = (Billing Period End - Current Date) / 30 days
Credit Difference = New Tier Credits - Current Balance  
Prorated Credits = Credit Difference × (Days Remaining / 30)
```

**Example:**
- User has Pro 400 (400 credits/month) on day 1
- Upgrades to Pro 3000 on day 15 (15 days remaining = 50%)
- Credit difference: 3000 - 400 = 2600
- **Prorated allocation**: 2600 × 50% = **1300 credits**
- **Next renewal**: Full 3000 credits

#### **Subscription Renewals**
- **Credit Reset**: Users' credits reset to exact monthly tier allocation (not additive)
- **Usage Reset**: Monthly usage counters reset to 0
- **Safety Check**: Prevents double allocation using invoice ID tracking
- **Period Extension**: Subscription period extended automatically

#### **Subscription Cancellations**
- **Immediate Effect**: All credits removed immediately
- **Tier Downgrade**: User downgraded to FREE tier
- **Access Removal**: No grace period - prevents platform abuse
- **Audit Trail**: Cancellation logged with credit removal details

#### **Subscription Downgrades**
- **No Credit Addition**: User keeps existing balance (fair approach)
- **Tier Update**: Membership tier updated to new level
- **Next Renewal**: New tier allocation starts next billing cycle

### 🛡️ **Safety Mechanisms**

#### **Double Allocation Prevention**
```typescript
// Example safety check
const existingTransaction = await prisma.creditTransaction.findFirst({
  where: {
    userId: userId,
    type: 'MONTHLY_ALLOCATION',
    metadata: {
      path: ['subscriptionId'],
      equals: subscriptionId
    }
  }
})

if (existingTransaction) {
  console.log('⚠️ Credits already allocated - skipping')
  return
}
```

#### **Upgrade Detection Logic**
```typescript
const isUpgrade = existingUser.stripeSubscriptionId && 
                 existingUser.stripeSubscriptionId !== subscription.id &&
                 existingUser.membershipTier !== 'FREE'
```

#### **Prorated Calculation**
```typescript
const daysRemaining = Math.max(0, Math.ceil(
  (billingPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
))
const proratedRatio = daysRemaining / 30
const proratedCredits = Math.max(0, Math.floor(creditDifference * proratedRatio))
```

### 📊 **Webhook Event Flow**

```
Checkout Completed → Logs completion (no credits)
                  ↓
Subscription Created → Allocates full credits
                    ↓
Monthly Renewal → Invoice Payment Success → Allocates monthly credits
                                         ↓
Subscription Updated → Upgrade Detection → Prorated credit allocation
                                        ↓
Subscription Deleted → Credit Removal → Tier Downgrade
```

---

## 🎨 Pricing Components

### 📋 **Available Components**

#### `<PricingSection />`
Full-page pricing section for your main page
```tsx
import { PricingSection } from '@/components/PricingSection';

<PricingSection className="bg-gray-50" />
```

#### `<PricingModal />`
Modal popup for quick pricing access
```tsx
import { PricingModal } from '@/components/PricingModal';

const [showPricing, setShowPricing] = useState(false);

<PricingModal 
  isOpen={showPricing} 
  onClose={() => setShowPricing(false)} 
/>
```

### ⚙️ **Features**

- **Dynamic Credit Selection**: Dropdown with all Pro credit options
- **Real-time Price Updates**: Price changes as user selects credits
- **Popular Option Highlighting**: Visual emphasis on recommended plans
- **Responsive Design**: Works on mobile and desktop
- **Theme Support**: Dark/light mode compatibility
- **Stripe Integration**: Direct connection to subscription creation
- **Server-side Security**: Credit options validated server-side

### 🎯 **Usage Examples**

```tsx
// Main page with pricing section
export default function HomePage() {
  return (
    <div>
      <HeroSection />
      <PricingSection />
      <Footer />
    </div>
  );
}

// Navigation with pricing modal
export default function Navigation() {
  const [showPricing, setShowPricing] = useState(false);
  
  return (
    <nav>
      <button onClick={() => setShowPricing(true)}>
        Pricing
      </button>
      <PricingModal 
        isOpen={showPricing} 
        onClose={() => setShowPricing(false)} 
      />
    </nav>
  );
}
```

---

## 🧪 Testing Guide

### 🎯 **Test Pages**

#### `/test-checkout` - Credit Purchase Testing
1. **Check Current Balance**: View current credits
2. **Select Package**: Choose credit amount
3. **Stripe Test Card**: Use `4242 4242 4242 4242`
4. **Verify Webhook**: Check terminal logs
5. **Confirm Credits**: Balance should update

#### `/test-subscription` - Subscription Testing  
1. **Choose Tier**: Select membership level
2. **Complete Checkout**: Process subscription
3. **Verify Activation**: Check membership status
4. **Confirm Credits**: Monthly allocation added

#### `/test-modal` - Credit Purchase Modal Testing
1. **Sign In**: Must be authenticated to test
2. **Credit Display**: Test different variants (default, compact, warning)
3. **Modal Behavior**: 
   - **Subscription users**: Modal opens on "Buy More" click
   - **Free users**: Redirected to `/test-checkout`
4. **Purchase Flow**: Test credit packages add to current balance
5. **UI States**: Test loading, success, error scenarios

#### `/test-renewal` - Subscription Renewal Testing
1. **Sign In**: Must be authenticated (admin or specific user)
2. **Current Status**: View credit balance, tier, and membership details
3. **Renewal Simulation**: 
   - **Test Button**: Simulates subscription renewal with exact logic
   - **Credit Reset**: Verifies credits reset to monthly allocation (not additive)
   - **Before/After**: Shows detailed comparison of renewal effects
4. **Live Updates**: Credit display refreshes to show new balance
5. **Transaction Logging**: Full audit trail with metadata

#### `/admin/dashboard` - Admin Testing
1. **User Management**: View all users
2. **Credit Operations**: Test add/reset credits
3. **Subscription Control**: Test fix/cancel operations
4. **Tier Changes**: Test membership upgrades
5. **Invoice Generation**: Create downloadable invoices for users

#### `/admin/dashboard/[userId]` - User Detail Testing
1. **Navigation**: Click any user row to open detail page
2. **User Stats**: View comprehensive user analytics
3. **Transaction History**: Browse detailed transaction logs
4. **Transaction Invoicing**: Generate invoices based on specific transactions
5. **Custom Invoicing**: Create custom invoices for the user
6. **Metadata Viewing**: Expand transaction metadata for debugging

#### **Usage-Based Credit System Testing**
1. **Test Credit Deduction**: Click "⚡ Test Deduct 1 Credit" in `/test-checkout`
2. **Project Creation**: Create new projects and verify 1 credit deducted each time
3. **Message Generation**: Send messages in projects and verify 1 credit per message
4. **Insufficient Credits Flow**: 
   - Reduce credits to 0 using admin tools
   - Try creating projects/messages to test error handling
   - Verify "Buy Credits" links appear in error messages
5. **Real-time Balance Updates**: Verify credit balance updates immediately in UI
6. **Credit Display Integration**: Check credit display in:
   - Home page (project creation form)
   - Project pages (message form)
   - User profile dropdown
   - Project headers

### 🔧 **Debug Tools**

#### Test Buttons Available:
- **🧪 Test Add Credits**: Bypass Stripe, add credits directly
- **⚡ Test Deduct Credits**: Simulate credit usage
- **🔄 Refresh Data**: Reload user information
- **🔧 Fix Subscription**: Repair subscription issues
- **👀 Debug Panel**: View transactions and purchases

### 🧪 **Advanced Testing Methods**

#### **Subscription Renewal Testing**
Test monthly renewal cycles using Stripe CLI event simulation:

```bash
# Method 1: Trigger generic renewal event
stripe trigger invoice.payment_succeeded

# Method 2: Create custom test endpoint (development only)
# Create /api/debug/test-renewal endpoint that sends:
# - event: 'stripe/webhook'  
# - type: 'invoice.payment_succeeded'
# - data: subscription renewal payload
```

**What to Verify:**
- ✅ Credits added match tier monthly allocation
- ✅ Subscription period extended by 30 days
- ✅ Monthly usage counter reset to 0
- ✅ Transaction logged with `isRenewal: true`
- ✅ No double allocation if run twice

#### **Subscription Upgrade Testing**
Test prorated credit calculation for mid-cycle upgrades:

```bash
# Method 1: Use actual Stripe subscription modification
# 1. Go to Stripe Dashboard → Subscriptions
# 2. Find test subscription → Modify subscription
# 3. Change to higher tier → Webhook fires automatically

# Method 2: Create custom test endpoint (development only)
# Create /api/debug/test-upgrade endpoint that sends:
# - event: 'stripe/webhook'
# - type: 'customer.subscription.updated'  
# - data: subscription with new tier metadata

# Method 3: Stripe CLI event trigger
stripe trigger customer.subscription.updated
```

**What to Verify:**
- ✅ Credits calculated as: `(new_tier - current_balance) × (days_remaining / 30)`
- ✅ Old subscription marked as `CANCELED`
- ✅ New subscription becomes active
- ✅ Transaction logged with `isUpgrade: true`
- ✅ Downgrade adds 0 additional credits

#### **Expected Terminal Logs**

**Successful Renewal:**
```
💰 Processing payment success: in_test_1752060302220
🔄 Processing renewal for user kberkeyilmaz@gmail.com
💰 Allocating 400 credits for renewal
✅ Renewal processed for user kberkeyilmaz@gmail.com
💰 Added 400 credits
📅 Extended until: [new date]
```

**Successful Upgrade:**
```
🔄 Detected subscription upgrade for user cmcuax9l00000rstnjfttgpxp
📊 Upgrade calculation:
  📅 Days remaining in period: 15/30
  📈 New tier credits: 3000/month
  💰 Current balance: 400
  ⚖️ Prorated credits to add: 1300
✅ Successfully upgraded to Pro 3000 for user cmcuax9l00000rstnjfttgpxp
💰 Added 1300 prorated credits (15 days remaining)
```

### 💳 **Stripe Test Cards**
```
Success: 4242 4242 4242 4242
Decline: 4000 0000 0000 0002
Insufficient: 4000 0000 0000 9995
Expired: 4000 0000 0000 0069
```

### 🔍 **Webhook Testing**
```bash
# Start webhook forwarding
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Monitor logs
# Watch terminal for webhook events
# Check database for updates
# Verify credit allocations
```

---

## 🚨 Troubleshooting

### ❌ **Common Issues**

#### **Webhook Not Receiving Events**
```bash
# Check Stripe CLI connection
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Verify webhook secret in .env
STRIPE_WEBHOOK_SECRET=whsec_...
```

#### **Credits Not Added After Purchase**
1. Check webhook logs in terminal
2. Verify Stripe payment was successful
3. Use "🔄 Refresh Data" button
4. Check `/api/debug/webhooks` for transaction history

#### **Double Credit Allocation**
**Fixed in latest version** - Previous bug where both `checkout.session.completed` and `customer.subscription.created` added credits.

**Current Behavior:**
- ✅ `checkout.session.completed`: Only logs completion
- ✅ `customer.subscription.created`: Allocates credits with safety check

#### **Subscription Upgrades Getting Full Credits**
**Fixed in latest version** - Previous bug where upgrades gave full monthly allocation instead of prorated amount.

**Current Behavior:**
- ✅ New subscriptions: Full monthly allocation
- ✅ Upgrades: Prorated credits based on remaining days
- ✅ Downgrades: No additional credits (keeps existing balance)

#### **Subscription Renewals Not Working**
**Fixed in latest version** - Monthly renewals now properly allocate credits and reset usage counters.

**Current Behavior:**
- ✅ Invoice payment success: Allocates monthly credits
- ✅ Usage counters: Reset to 0 each renewal
- ✅ Safety checks: Prevents double allocation

#### **Credits Not Removed on Cancellation**
**Fixed in latest version** - Subscription cancellations now immediately zero credits.

**Current Behavior:**
- ✅ Cancellation: All credits removed immediately
- ✅ Tier downgrade: User set to FREE tier
- ✅ Audit trail: Cancellation logged with details

#### **Subscription Not Activating**
1. Verify webhook processing logs
2. Use "🔧 Fix Subscription" button
3. Check Stripe dashboard for subscription status
4. Verify metadata is properly set (tierId, tierName, monthlyCredits)

#### **Prisma Database Errors**
```bash
# Reset database
npx prisma migrate reset

# Regenerate client
npx prisma generate

# Deploy migrations
npx prisma migrate deploy
```

### 🔧 **Admin Fixes**

#### **Broken User Subscription**
1. Go to Admin Dashboard
2. Find user in table
3. Click "🔧" Fix Subscription button
4. Verify credits and tier updated

#### **Credit Balance Issues**
1. Use "⚡" Reset Credits button
2. Set exact credit amount
3. All changes are logged for audit

#### **Tier Problems**
1. Use "🔄" Change Tier button
2. Select correct membership level
3. Expiration dates auto-calculated

---

## 🎉 Summary

We've built a **production-ready Stripe integration** that includes:

### 🎯 **Core Features**
✅ **Complete Credit System** - Purchase, allocation, tracking with audit trail  
✅ **Usage-Based Deduction** - Automatic credit deduction for projects & messages  
✅ **Dynamic Pro Subscriptions** - Flexible credit options with dropdown selection  
✅ **Enterprise Contact Sales** - Custom solutions for large organizations  
✅ **tRPC Integration** - End-to-end type safety with automatic TypeScript generation  
✅ **Modern Pricing Components** - Beautiful, responsive pricing displays  
✅ **Admin Dashboard** - Full user management with detailed analytics  

### 🧠 **Smart Business Logic**
✅ **Prorated Upgrades** - Fair credit allocation for mid-cycle plan changes  
✅ **Intelligent Renewals** - Automatic monthly credit allocation with safety checks  
✅ **Instant Cancellations** - Immediate credit removal and tier downgrade  
✅ **Double-Allocation Protection** - Prevents duplicate credit allocation  
✅ **Upgrade Detection** - Automatically detects and handles subscription changes  

### 🔧 **Technical Excellence**
✅ **Real-time Webhooks** - Reliable event processing with retry logic  
✅ **Server-side Validation** - Prevents client-side price tampering  
✅ **Advanced Testing** - Debug endpoints for renewals and upgrades  
✅ **Comprehensive Logging** - Complete operation audit trail  
✅ **Error Handling** - Graceful failure recovery with fallbacks  
✅ **Event Deduplication** - Prevents duplicate webhook processing  

### 💼 **Business-Ready**
This system handles complex subscription scenarios that most SaaS businesses encounter:
- **Mid-cycle upgrades/downgrades** with fair billing
- **Multiple subscription tiers** with different credit allocations  
- **Enterprise custom billing** with manual invoice generation
- **Customer support tools** for credit management and troubleshooting
- **Audit compliance** with complete transaction logging

**Perfect for scaling from startup to enterprise** with a modern tech stack and powerful admin tools for customer support and business operations.

---

## 📞 Support

For issues or questions:
1. Check this documentation
2. Review webhook logs
3. Use admin dashboard tools
4. Check Stripe dashboard
5. Review database logs

**Built with ❤️ using Next.js, Stripe, and Prisma**

---

## 📝 **Recent Updates**

**Latest Version (January 2025):**
- ✅ Fixed double credit allocation bug
- ✅ Implemented prorated subscription upgrades  
- ✅ Added intelligent renewal management
- ✅ Enhanced cancellation logic with immediate credit removal
- ✅ Added comprehensive safety checks and event deduplication
- ✅ Created advanced testing endpoints for renewals and upgrades
- ✅ Improved subscription lifecycle management 