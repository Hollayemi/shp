# Cloudflare for SaaS Worker Routes Fix

## The Problem
Custom domains created with Cloudflare for SaaS were not routing to the Worker, showing generic "is functioning normally" pages instead of project content.

## Root Cause
**Worker routes defined in `wrangler.toml` do NOT work for Cloudflare for SaaS traffic.**

This is a critical limitation: routes in `wrangler.toml` only apply to direct traffic to your zone, but custom hostnames from Cloudflare for SaaS bypass these routes.

## The Solution
You MUST add Worker Routes through the Cloudflare Dashboard:

### Steps:
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select your zone: `shipper.now`
3. Navigate to: **Workers & Pages** → **Overview** → **Worker Routes**
4. Click **"Add route"**
5. Configure:
   - **Route pattern**: `*/*` (catches ALL traffic including custom hostnames)
   - **Worker**: `domain-router` (your worker name)
   - **Zone**: `shipper.now`
6. Click **Save**

### Why `*/*` Pattern Works:
- ✅ Catches custom hostnames (like `oinkbot.xyz`)
- ✅ Catches regular subdomains (like `cname.shipper.now`)
- ✅ Routes everything to your worker for proper handling

## Technical Details

### Before (Broken):
```toml
# wrangler.toml - DOESN'T WORK for SaaS
routes = [
  { pattern = "*shipper.now/*", zone_id = "..." }
]
```

### After (Working):
- Dashboard route: `*/*` → `domain-router`
- wrangler.toml routes: commented out/removed

### Why This Happens:
1. Custom hostname traffic arrives at your zone via Cloudflare for SaaS
2. wrangler.toml routes only apply to direct zone traffic
3. Dashboard routes work at the zone level for ALL incoming requests
4. This is a documented Cloudflare for SaaS requirement

## Verification
After adding the dashboard route:
1. Custom domains should route to your worker
2. Worker logs will show custom domain requests
3. Projects will load correctly on custom domains

## References
- [Cloudflare Community: Worker Routes for SaaS](https://community.cloudflare.com/)
- [Cloudflare for SaaS Documentation](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/)

## Status
- ✅ Worker deployed with proper logic
- ✅ Custom hostnames created without `custom_origin_server`
- ✅ Database has correct HTTPS URLs
- 🔄 **NEXT**: Add dashboard Worker Route `*/*` → `domain-router`