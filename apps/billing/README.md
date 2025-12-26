# Billing Service

Standalone service for Convex usage tracking and Stripe metered billing per team.

## Overview

This service:
1. Receives Convex log stream events via webhook
2. Tracks usage per team (function calls, compute, bandwidth, storage)
3. Aggregates usage for billing periods
4. Reports usage to Stripe via Billing Meters API

**Note:** This service uses Stripe's new Billing Meters API (not the legacy usage records API).

Meter events are sent to Stripe in real-time as usage occurs for accurate billing.

## Endpoints

### Webhook

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/webhook/convex` | Receive Convex log stream events |
| GET | `/webhook/status` | Check webhook configuration status |

### Team Billing

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/teams/billing/enable` | Enable billing for a team |
| POST | `/teams/billing/disable` | Disable billing for a team |
| GET | `/teams/:teamId/usage` | Get current usage summary |
| GET | `/teams/:teamId/billing-status` | Get billing status |
| POST | `/teams/:teamId/report-usage` | Manually trigger usage reporting |

## Setup

### 1. Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Required
DATABASE_URL=postgresql://...
SHIPPER_API_KEY=your-api-key
CONVEX_DEPLOY_KEY_ENCRYPTION_SECRET=your-encryption-secret  # Same as API server

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...

# Stripe Meter IDs (create in Stripe Dashboard > Billing > Meters)
STRIPE_METER_FUNCTION_CALLS_ID=mtr_xxx
STRIPE_METER_ACTION_COMPUTE_ID=mtr_xxx
STRIPE_METER_DB_BANDWIDTH_ID=mtr_xxx
STRIPE_METER_DB_STORAGE_ID=mtr_xxx
STRIPE_METER_FILE_BANDWIDTH_ID=mtr_xxx
STRIPE_METER_FILE_STORAGE_ID=mtr_xxx
STRIPE_METER_VECTOR_BANDWIDTH_ID=mtr_xxx
STRIPE_METER_VECTOR_STORAGE_ID=mtr_xxx

# Stripe Price IDs (run setup-stripe.ts to generate these)
STRIPE_CONVEX_FUNCTION_CALLS_PRICE_ID=price_xxx
STRIPE_CONVEX_ACTION_COMPUTE_PRICE_ID=price_xxx
STRIPE_CONVEX_DB_BANDWIDTH_PRICE_ID=price_xxx
STRIPE_CONVEX_DB_STORAGE_PRICE_ID=price_xxx
STRIPE_CONVEX_FILE_BANDWIDTH_PRICE_ID=price_xxx
STRIPE_CONVEX_FILE_STORAGE_PRICE_ID=price_xxx
STRIPE_CONVEX_VECTOR_BANDWIDTH_PRICE_ID=price_xxx
STRIPE_CONVEX_VECTOR_STORAGE_PRICE_ID=price_xxx
```

### 2. Stripe Setup (Automated)

Run the setup script to create all Stripe resources:

```bash
cd apps/billing
pnpm tsx scripts/setup-stripe.ts
```

This creates:
- 8 billing meters (one per usage type)
- 8 products (Function Calls, Action Compute, etc.)
- 8 prices linked to their meters

Copy the output environment variables to your `.env` file.

#### Manual Setup (Alternative)

If you prefer manual setup, create these resources in Stripe Dashboard:

| Product Name | Event Name | Aggregation | Price per Unit |
|-------------|------------|-------------|----------------|
| Function Calls | `convex_function_calls` | sum | $0.003 |
| Action Compute | `convex_action_compute` | sum | $0.00000045 |
| Database Bandwidth | `convex_database_bandwidth` | sum | $0.00029 |
| Database Storage | `convex_database_storage` | max | $0.00029 |
| File Bandwidth | `convex_file_bandwidth` | sum | $0.00044 |
| File Storage | `convex_file_storage` | max | $0.000044 |
| Vector Bandwidth | `convex_vector_bandwidth` | sum | $0.00015 |
| Vector Storage | `convex_vector_storage` | max | $0.00073 |

For each meter, configure:
- **Customer mapping**: `by_id` with `event_payload_key: "stripe_customer_id"`
- **Value settings**: `event_payload_key: "value"`

### 3. Test the Setup

```bash
pnpm tsx scripts/test-meters.ts --test
```

This runs a full end-to-end test: creates a customer, subscription, sends meter events, and generates an invoice.

#### API Reference

- [Stripe Billing Meters](https://docs.stripe.com/api/billing/meter)
- [Meter Events](https://docs.stripe.com/api/billing/meter-event)
- [Usage-Based Billing Guide](https://docs.stripe.com/billing/subscriptions/usage-based)

### 4. Convex Log Stream

The webhook log stream is configured programmatically when provisioning a Convex project:

```typescript
import { ConvexDeploymentAPI, encryptDeployKey } from "@shipper/convex";

const api = new ConvexDeploymentAPI(deploymentUrl, deployKey);
const result = await api.createWebhookLogStream({
  url: "https://billing.shipper.app/webhook/convex",
  format: "json"
});

// Store encrypted secret in ConvexDeployment.webhookSecretEncrypted
await prisma.convexDeployment.update({
  where: { id: deploymentId },
  data: {
    webhookSecretEncrypted: encryptDeployKey(result.webhookSecret),
    webhookConfiguredAt: new Date(),
  },
});
```

The billing service looks up the webhook secret by `deployment_name` from the incoming event and verifies the HMAC signature.

## Development

```bash
# Install dependencies
pnpm install

# Development mode
pnpm dev:billing

# Build
pnpm build:billing

# Start production
pnpm start:billing
```

## Shipper Cloud Pricing (50% margin over Convex)

| Resource | Convex Rate | Shipper Rate |
|----------|-------------|--------------|
| Function calls | $2/million | $3/million |
| Action compute | $0.30/GB-hour | $0.45/GB-hour |
| Database storage | $0.20/GB/month | $0.30/GB/month |
| Database bandwidth | $0.20/GB | $0.30/GB |
| File storage | $0.03/GB/month | $0.045/GB/month |
| File bandwidth | $0.30/GB | $0.45/GB |
| Vector storage | $0.50/GB/month | $0.75/GB/month |
| Vector bandwidth | $0.10/GB | $0.15/GB |

## Database Models

- `ConvexUsageRecord` - Individual usage events
- `ConvexUsagePeriod` - Aggregated usage per billing period per team
- `Team` - Extended with billing fields (stripeCustomerId, stripeSubscriptionId, billingEnabled)

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────┐
│  Convex Cloud   │────▶│ Billing Service  │────▶│     Stripe     │
│  (Log Stream)   │     │   (This app)     │     │ (Metered API)  │
└─────────────────┘     └──────────────────┘     └────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │    PostgreSQL    │
                        │ (Usage Records)  │
                        └──────────────────┘
```

## Security

- Webhook requests are verified using HMAC-SHA256 signatures
- Team management endpoints require API key authentication
- Timestamps are validated to prevent replay attacks
