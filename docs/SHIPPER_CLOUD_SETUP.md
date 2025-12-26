# Shipper Cloud (Convex) Setup Guide

## Overview

Shipper Cloud allows users to deploy their projects with a managed Convex backend. This requires two levels of Convex credentials:

1. **Deploy Key** (already configured) - For accessing existing deployments
2. **Team Access Token** (optional) - For creating new deployments

## Current Status

✅ **Deploy Key configured** - You can read from the existing Convex deployment
❌ **Team Access Token missing** - You cannot create new Convex deployments for users

## Error You're Seeing

```
Shipper Cloud deployment failed: {
  "success": false,
  "error": "CONVEX_TEAM_ACCESS_TOKEN environment variable is required"
}
```

This happens when a user tries to "Deploy to Shipper Cloud" but the admin credentials aren't configured.

## Solution Options

### Option 1: Skip Shipper Cloud (Recommended for Testing)

If you're testing the **domain workflow**, you don't need Shipper Cloud:

1. **Create projects without Shipper Cloud**
   - Don't check "Enable Shipper Cloud" when creating projects
   - Projects will work fine without it

2. **Test domains on regular projects**
   - The domain workflow is independent of Shipper Cloud
   - You can test custom domains on any project

### Option 2: Configure Convex Team Credentials

If you need the "Deploy to Shipper Cloud" feature:

1. **Get your Convex team credentials**:
   - Go to https://dashboard.convex.dev/settings/team
   - Create a **Team Access Token** (admin level)
   - Copy your **Team ID**
   - Generate a random encryption secret: `openssl rand -hex 32`

2. **Add to `.env` files** (both `apps/web/.env` and `apps/api/.env`):
   ```bash
   # Convex Team Credentials (for creating new deployments)
   CONVEX_TEAM_ACCESS_TOKEN="your_team_access_token_here"
   CONVEX_TEAM_ID="your_team_id_here"
   CONVEX_DEPLOY_KEY_ENCRYPTION_SECRET="your_random_32_byte_hex_here"
   ```

3. **Restart the dev server**:
   ```bash
   pnpm dev
   ```

## What Each Credential Does

| Credential | Purpose | Required For |
|------------|---------|--------------|
| `CONVEX_URL` | Deployment URL | Reading data from existing deployment |
| `CONVEX_DEPLOY_KEY` | Deploy key | Accessing existing deployment |
| `CONVEX_TEAM_ACCESS_TOKEN` | Team admin token | Creating new deployments for users |
| `CONVEX_TEAM_ID` | Team identifier | Creating new deployments for users |
| `CONVEX_DEPLOY_KEY_ENCRYPTION_SECRET` | Encryption key | Securely storing deploy keys in database |

## Testing Without Shipper Cloud

You can fully test Shipper including the domain workflow without Shipper Cloud:

1. ✅ Create projects
2. ✅ Edit code in sandbox
3. ✅ Deploy to Modal sandboxes
4. ✅ Connect custom domains
5. ✅ Test domain DNS configuration
6. ✅ Set primary domains
7. ✅ View projects on custom domains

The only feature you'll miss is "Deploy to Shipper Cloud" (Convex backend).

## Current Configuration

Your `.env` files now have placeholders for the team credentials:

```bash
# For reading from existing deployment (data access)
CONVEX_URL="https://coordinated-rooster-760.convex.cloud"
CONVEX_DEPLOY_KEY="dev:coordinated-rooster-760|..."

# For creating new deployments (admin operations) - OPTIONAL
# CONVEX_TEAM_ACCESS_TOKEN=""
# CONVEX_TEAM_ID=""
# CONVEX_DEPLOY_KEY_ENCRYPTION_SECRET=""
```

Uncomment and fill in the values if you need the deployment feature.

## Recommendation

**For testing the domain workflow**: Skip Shipper Cloud and test with regular projects. The domain features work independently of Convex.

**For production**: Configure the team credentials so users can deploy to Shipper Cloud.
