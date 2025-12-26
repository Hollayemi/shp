# PR Preview Environments

This document describes the automated preview environment system for pull requests.

## Overview

When a PR is opened against `main` or `staging`, the system automatically creates:
- **Neon database branch** - Isolated database copy with 14-day expiration
- **Railway API preview** - Isolated API instance
- **Railway Billing preview** - Isolated billing service (when `apps/billing` exists)
- **Vercel frontend preview** - Built with correct API URLs

## Architecture

```
PR Opened/Synced
     │
     ▼
[1] Create Neon Branch (preview/pr-{number}-{branch})
     │
     ▼  DATABASE_URL captured
[2] Railway auto-creates PR environments:
    - shipper-api (port 4000)
    - shipper-billing (port 4004) [optional]
     │
     ▼  RAILWAY_API_URL + RAILWAY_BILLING_URL captured
[3] Run Database Migrations against Neon branch
     │
     ▼
[4] Vercel Deploy (NEXT_PUBLIC_API_URL=railway-api-url)
     │
     ▼
[5] Post PR Comment with all URLs
```

## Preview URLs

Each PR gets direct URLs from each service:

| Service | URL Pattern |
|---------|-------------|
| Frontend | `https://{vercel-deployment-url}` |
| API | `https://shipper-api-shipper-webapp-pr-{PR_NUMBER}.up.railway.app` |
| Billing | `https://shipper-billing-staging-shipper-webapp-pr-{PR_NUMBER}.up.railway.app` |
| Database | Neon branch: `preview/pr-{PR_NUMBER}-{branch}` |

## Files Changed

### Shipper-webapp

**`.github/workflows/preview-environments.yml`** (NEW)
- Complete GitHub Actions workflow
- Triggers on PR open/sync/close to main or staging
- Orchestrates all preview services

**`apps/api/src/index.ts`** (MODIFIED)
- Added CORS for `*.up.railway.app` (Railway previews)
- Added CORS for `*.vercel.app` (Vercel previews)

**`apps/web/vercel.json`** (MODIFIED)
- Disabled automatic Vercel PR previews (only deploys from `main`/`staging`)
- Our workflow handles PR previews with correct environment variables

## Setup Instructions

### 1. Install Neon GitHub Integration (Recommended)

The easiest setup is using Neon's native GitHub integration:

1. Go to [Neon Console](https://console.neon.tech) → Your Project → Integrations
2. Find the **GitHub** card and click **Add**
3. Click **Install GitHub App**
4. Select the `Shipper-webapp` repository and click **Connect**

This automatically:
- Creates `NEON_API_KEY` secret in your repository
- Creates `NEON_PROJECT_ID` variable in your repository
- No manual secret/variable setup needed for Neon!

**Alternative**: If you prefer manual setup, add `NEON_API_KEY` secret and `NEON_PROJECT_ID` variable manually.

### 2. Configure Railway PR Environments

For **shipper-api** service:
1. Go to Railway Dashboard → shipper-api → Settings
2. Enable "PR Deployments"
3. Ensure these env vars are set (inherited from staging):
   - `SHIPPER_API_KEY`
   - `STRIPE_SECRET_KEY` (test key)
   - Other non-DB secrets

For **shipper-billing** service (when available):
1. Go to Railway Dashboard → shipper-billing → Settings
2. Enable "PR Deployments"
3. Ensure these env vars are set:
   - `SHIPPER_API_KEY`
   - `STRIPE_SECRET_KEY` (test key - `sk_test_*`)
   - `STRIPE_SHIPPER_CLOUD_CREDITS_METER_ID`
   - `REDIS_URL`

**Note:** `DATABASE_URL` is injected by the workflow from the Neon branch.

### 3. Add GitHub Repository Secrets

Go to GitHub → Repository → Settings → Secrets and variables → Actions

**Required Secrets:**
```
VERCEL_TOKEN              # Vercel → Account Settings → Tokens
VERCEL_ORG_ID             # Vercel project settings → General
VERCEL_PROJECT_ID         # Vercel project settings → General
SHIPPER_API_KEY           # Existing shared secret
```

**Only if NOT using Neon GitHub Integration:**
```
NEON_API_KEY              # Neon dashboard → Account → API Keys
```

### 4. Add GitHub Repository Variables

Go to GitHub → Repository → Settings → Secrets and variables → Actions → Variables

**Only if NOT using Neon GitHub Integration:**
```
NEON_PROJECT_ID           # Your Neon project ID (from Neon dashboard)
```

## How It Works

### On PR Open/Sync

1. **Setup Job**
   - Gets branch name using `tj-actions/branch-names`

2. **Neon Branch Creation**
   - Uses `neondatabase/create-branch-action@v6`
   - Creates branch named `preview/pr-{number}-{branch}` with 14-day expiration
   - Outputs `db_url_with_pooler` for the branch

3. **Railway Detection**
   - Checks if `apps/billing` directory exists
   - Constructs predictable Railway preview URLs
   - Railway auto-creates environments when PR deployments are enabled

4. **Database Migrations**
   - Runs `pnpm db:migrate:deploy` against Neon branch
   - Uses the branch's `DATABASE_URL`

5. **Vercel Deployment**
   - Pulls Vercel environment
   - Builds with custom `NEXT_PUBLIC_API_URL` pointing to Railway preview
   - Deploys prebuilt artifacts

6. **PR Comment**
   - Creates/updates comment with all preview URLs

### On PR Close

1. **Neon Branch Deletion**
   - Uses `neondatabase/delete-branch-action@v3`
   - Removes the branch (or it auto-expires after 14 days)

2. **Railway Cleanup**
   - Railway automatically cleans up PR environments

3. **Vercel Cleanup**
   - Vercel automatically cleans up preview deployments

## Billing Service (Optional)

The billing service is optional. The workflow:
- Checks if `apps/billing` directory exists
- Only includes billing URLs if present
- Conditionally shows billing in PR comment

This allows the workflow to work on `main` (no billing) and automatically include billing once merged from `staging`.

## Troubleshooting

### Preview not loading
1. Check Railway dashboard for deployment status
2. Verify Neon branch was created in Neon console
3. Check GitHub Actions logs for errors

### Database connection issues
1. Verify Neon branch exists
2. Check if migrations ran successfully
3. Ensure `DATABASE_URL` is being passed correctly

### CORS errors
1. Verify `apps/api/src/index.ts` has Railway domain patterns
2. Check browser console for specific CORS error
3. Ensure origin matches allowed patterns

## Cost Considerations

- **Neon**: Branch storage is billed, but minimal for short-lived PR branches. 14-day auto-expiration helps cleanup.
- **Railway**: PR environments consume compute hours
- **Vercel**: Preview deployments count toward your plan limits
