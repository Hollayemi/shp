# 🚀 Deployment Checklist for Lead Devs

## Overview
This PR adds custom domain support using Cloudflare for SaaS. When you push to staging, the code will deploy automatically, but **custom domains won't work** until environment variables are configured.

---

## ⚠️ CRITICAL: What Will Break Without Config

### Without these env vars, users will see:
- ❌ "Missing Cloudflare configuration" error when adding domains
- ❌ Custom domains won't route (404 errors)
- ❌ DNS instructions won't be generated

### What will still work:
- ✅ Everything else (AI chat, projects, deployments, etc.)
- ✅ App will deploy and run normally
- ✅ Only the "Domains" tab in Settings will be affected

---

## 📋 REQUIRED: Add These Environment Variables

### 🔴 PRIORITY 1: Cloudflare for SaaS (Required for domain feature)

Add these to **Railway** (backend API service):

```bash
# Get from Cloudflare Dashboard → Select Zone → Overview (scroll down)
CLOUDFLARE_API_TOKEN=""
CLOUDFLARE_ZONE_ID=""
CLOUDFLARE_ACCOUNT_ID=""
CLOUDFLARE_FALLBACK_ORIGIN="cname.shipper.now"
```

**Where to get these:**
1. Log in to Cloudflare Dashboard
2. Select your `shipper.now` zone
3. Scroll down on Overview page
4. Copy Zone ID and Account ID
5. API Token: My Profile → API Tokens → Create Token
   - Permissions needed:
     - Zone - SSL and Certificates - Edit
     - Zone - Custom Hostnames - Edit

---

### 🔴 PRIORITY 2: Worker Authentication

Add to **Railway** (backend API service):

```bash
# This authenticates the Cloudflare Worker when it calls the backend
WORKER_API_KEY=""
```

**Note:** This is a NEW key specifically for the worker. It's different from `SHIPPER_API_KEY`.

---

### 🔴 PRIORITY 3: Deployment Configuration

Add to **Railway** (backend API service):

```bash
# Where deployed projects are hosted
DEPLOYMENT_PLANE_URL="https://deploy.shipper.now"

# API key for deployment plane (if you have one)
DEPLOYMENT_PLANE_API_KEY=""
```

**Note:** If `DEPLOYMENT_PLANE_URL` is already set, just verify it's correct.

---

### 🟡 OPTIONAL: Add to Vercel (Frontend)

These are already in Vercel staging, but verify:

```bash
# Should already be set
NEXT_PUBLIC_API_URL="https://shipper-api-staging.up.railway.app"  # Your Railway backend URL
SHIPPER_API_KEY="your-internal-api-key-here"
NEXT_PUBLIC_SHIPPER_API_KEY="your-internal-api-key-here"  # Must match SHIPPER_API_KEY
```

---

## 🔧 AFTER ADDING ENV VARS

### 1. Redeploy Railway Service
```bash
# In Railway dashboard:
1. Go to your API service
2. Click "Deploy" or wait for auto-deploy
3. Check logs for "Cloudflare Service initialized"
```

### 2. Test the API Endpoint
```bash
# Should return JSON (not 500 error)
curl "https://api.shipper.now/api/v1/domains/lookup?domain=test.com"

# Expected response (domain not found is OK):
{"error":"Domain not found or not active","domain":"test.com"}
```

### 3. Test in UI
1. Go to any project
2. Click Settings → Domains tab
3. Try to add a domain
4. Should see DNS instructions (not error message)

---

## 🚨 WHAT TO WATCH FOR

### Check Railway Logs After Deploy:

**✅ Good signs:**
```
[Cloudflare] Service initialized with zone: 
[Domains] Created custom domain example.com for project abc123
```

**❌ Bad signs:**
```
Missing Cloudflare configuration: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID
Error: CLOUDFLARE_API_TOKEN is not defined
```

### If you see errors:
1. Double-check all 4 Cloudflare env vars are set
2. Verify no typos in variable names
3. Redeploy the service
4. Check logs again

---

## 🔐 SECURITY NOTES

### These keys are sensitive:
- `CLOUDFLARE_API_TOKEN` - Can manage your Cloudflare zone
- `WORKER_API_KEY` - Authenticates worker requests
- `DEPLOYMENT_PLANE_API_KEY` - Authenticates deployment requests

### Best practices:
- ✅ Set them in Railway dashboard (not in code)
- ✅ Use different keys for staging vs production
- ✅ Rotate keys periodically
- ❌ Never commit them to git
- ❌ Never share in Slack/Discord

---

## 📊 DEPLOYMENT PHASES

### Phase 1: Backend Config (Do This First)
- [ ] Add Cloudflare env vars to Railway
- [ ] Add WORKER_API_KEY to Railway
- [ ] Verify DEPLOYMENT_PLANE_URL is set
- [ ] Redeploy Railway service
- [ ] Check logs for "Cloudflare Service initialized"

### Phase 2: Test Backend
- [ ] Test `/api/v1/domains/lookup` endpoint
- [ ] Try adding a domain in UI
- [ ] Verify DNS instructions appear

### Phase 3: Deploy Cloudflare Worker (Later)
- [ ] Update `cloudflare-worker/wrangler.toml` with account_id
- [ ] Set API_KEY secret: `wrangler secret put API_KEY`
- [ ] Deploy: `wrangler deploy`
- [ ] Add route: `shipper.now/*`

**Note:** Phase 3 can wait. The app will work without the worker deployed - domains just won't route yet.

---

## 🎯 MINIMUM TO DEPLOY NOW

To deploy to staging without breaking anything:

**Required:**
1. Add 4 Cloudflare env vars to Railway
2. Add WORKER_API_KEY to Railway
3. Redeploy

**Optional (can do later):**
- Deploy Cloudflare Worker
- Test with real custom domain

---

## 📞 IF SOMETHING BREAKS

### App won't start:
- Check Railway logs for missing env vars
- Verify DATABASE_URL is still set
- Check for typos in new env var names

### Domain feature doesn't work:
- Check logs for "Missing Cloudflare configuration"
- Verify all 4 Cloudflare vars are set
- Test the lookup endpoint with curl

### Everything else broken:
- This PR only adds domain feature
- Shouldn't affect existing functionality
- Check if any existing env vars were accidentally removed

---

## 📝 QUICK COPY-PASTE FOR RAILWAY

```bash
# Cloudflare for SaaS
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ZONE_ID=
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_FALLBACK_ORIGIN=shipper.now

# Worker Authentication
WORKER_API_KEY=

# Deployment (verify these are correct)
DEPLOYMENT_PLANE_URL=https://deploy.shipper.now
DEPLOYMENT_PLANE_API_KEY=
```

---

## 🎉 SUCCESS CRITERIA

You'll know it's working when:
- ✅ Railway deploys without errors
- ✅ Logs show "Cloudflare Service initialized"
- ✅ Can add a domain in Settings → Domains
- ✅ DNS instructions appear with CNAME target
- ✅ Domain status shows "Pending Validation"

---

## 📚 DOCUMENTATION

For more details, see:
- `RAILWAY_ENV_CHECKLIST.md` - Complete env var guide
- `CUSTOM_DOMAIN_DEPLOYMENT_CHECKLIST.md` - Full deployment steps
- `WORKER_ENV_EXPLANATION.md` - Why we use env vars
- `.env.example` - All env vars with descriptions

---

## 🤝 NEED HELP?

If you run into issues:
1. Check Railway logs first
2. Test the lookup endpoint
3. Verify all env vars are set
4. Check for typos in variable names
5. Ping me if still stuck

---

**TL;DR:** Add 6 env vars to Railway, redeploy, check logs. Domain feature won't work without them, but nothing else will break.

Generated: December 4, 2024
