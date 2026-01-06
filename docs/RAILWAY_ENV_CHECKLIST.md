# Railway Environment Variables Checklist

## 🎯 Purpose
This document lists ALL environment variables that should be set in your Railway backend for the custom domain feature to work.

---

## 📋 REQUIRED FOR CUSTOM DOMAINS

### 1. Database
```bash
DATABASE_URL="postgresql://..."
```
**Purpose:** PostgreSQL connection string for storing domain mappings
**Where to get:** From your Neon/Railway Postgres instance

---

### 2. Cloudflare for SaaS Credentials
```bash
CLOUDFLARE_API_TOKEN="your_api_token"
CLOUDFLARE_ZONE_ID="your_zone_id"
CLOUDFLARE_ACCOUNT_ID="your_account_id"
CLOUDFLARE_FALLBACK_ORIGIN="cname.shipper.now"
```

**Purpose:** 
- Create custom hostnames in Cloudflare
- Manage SSL certificates
- Verify domain ownership

**Where to get:**
- API Token: Cloudflare Dashboard → My Profile → API Tokens
- Zone ID: Cloudflare Dashboard → Select domain → Overview (scroll down)
- Account ID: Same location as Zone ID
- Fallback Origin: Your main domain where the worker runs

---

### 3. Worker Authentication
```bash
WORKER_API_KEY="[GENERATE_WITH_openssl_rand_-hex_32]"
```

**Purpose:** Authenticate requests from Cloudflare Worker to your backend API

**Security:** This key allows the worker to call `/api/v1/domains/lookup`

**⚠️ CRITICAL SECURITY ISSUE:** Currently the lookup endpoint has NO validation. You MUST add:
```typescript
// In apps/api/src/routes/domains.ts
router.get('/lookup', async (req: Request, res: Response) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.WORKER_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  // ... rest of code
});
```

---

### 4. Deployment Configuration
```bash
DEPLOYMENT_PLANE_URL="https://deploy.shipper.now"
```

**Purpose:** Where your deployed projects are hosted

**Used by:** 
- Deployment flow to know where to deploy projects
- Fallback if project doesn't have a specific deploymentUrl

---

### 5. API Configuration
```bash
NEXT_PUBLIC_API_URL="https://shipper-api-staging.up.railway.app"  # Your Railway backend URL
SHIPPER_API_KEY="your-internal-api-key-here"
```

**Purpose:**
- `NEXT_PUBLIC_API_URL`: Your Railway backend URL (public)
- `SHIPPER_API_KEY`: Internal API authentication between services

**Note:** These should already be set for your app to work

---

## 📊 COMPLETE RAILWAY ENV LIST

Here's the complete list to copy-paste into Railway:

```bash
# ============================================
# DATABASE (REQUIRED)
# ============================================
DATABASE_URL="postgresql://..."

# ============================================
# API CONFIGURATION (REQUIRED)
# ============================================
NEXT_PUBLIC_API_URL="https://shipper-api-staging.up.railway.app"  # Your Railway backend URL
SHIPPER_API_KEY="your-internal-api-key-here"
DEPLOYMENT_PLANE_URL="https://deploy.shipper.now"  # Your deployment plane URL

# ============================================
# CLOUDFLARE FOR SAAS (REQUIRED FOR DOMAINS)
# ============================================
CLOUDFLARE_API_TOKEN="[GET_FROM_CLOUDFLARE_DASHBOARD]"
CLOUDFLARE_ZONE_ID="[GET_FROM_CLOUDFLARE_DASHBOARD]"
CLOUDFLARE_ACCOUNT_ID="[GET_FROM_CLOUDFLARE_DASHBOARD]"
CLOUDFLARE_FALLBACK_ORIGIN="cname.shipper.now"

# ============================================
# WORKER AUTHENTICATION (REQUIRED FOR DOMAINS)
# ============================================
WORKER_API_KEY="[GENERATE_WITH_openssl_rand_-hex_32]"

# ============================================
# AUTHENTICATION (REQUIRED)
# ============================================
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="https://your-app.com"

# ============================================
# AI PROVIDERS (AT LEAST ONE REQUIRED)
# ============================================
OPENROUTER_API_KEY="..."
# OR
ANTHROPIC_API_KEY="..."
# OR
OPENAI_API_KEY="..."

# ============================================
# SANDBOX PROVIDER (REQUIRED)
# ============================================
MODAL_TOKEN_ID="..."
MODAL_TOKEN_SECRET="..."
```

---

## 🔍 HOW TO VERIFY

### Check if variables are set:
```bash
# In Railway dashboard
1. Go to your API service
2. Click "Variables" tab
3. Search for each variable above
```

### Test the API:
```bash
# Test domain lookup endpoint
curl -H "x-api-key: YOUR_WORKER_API_KEY" \
  "https://api.shipper.now/api/v1/domains/lookup?domain=test.com"

# Should return JSON (even if domain not found)
```

---

## ⚠️ COMMON ISSUES

### Issue: "Missing Cloudflare configuration"
**Solution:** Make sure all 4 Cloudflare variables are set:
- CLOUDFLARE_API_TOKEN
- CLOUDFLARE_ZONE_ID
- CLOUDFLARE_ACCOUNT_ID
- CLOUDFLARE_FALLBACK_ORIGIN

### Issue: Worker can't reach API
**Solution:** 
- Verify `NEXT_PUBLIC_API_URL` matches your Railway public domain
- Check Railway service is running
- Test API endpoint directly with curl

### Issue: Domains not routing
**Solution:**
- Verify `DEPLOYMENT_PLANE_URL` is correct
- Check projects have `deploymentUrl` set in database
- Verify worker is deployed and route is active

---

## 🔐 SECURITY BEST PRACTICES

1. **Never commit .env files** to git
2. **Use Railway's secret management** for sensitive values
3. **Rotate API keys** periodically
4. **Add API key validation** to the lookup endpoint
5. **Use different keys** for dev/staging/production

---

## 📝 DEPLOYMENT CHECKLIST

Before deploying to Railway:

- [ ] All required environment variables are set
- [ ] Database connection works
- [ ] Cloudflare credentials are valid
- [ ] WORKER_API_KEY matches between Railway and Worker
- [ ] API_URL matches your Railway public domain
- [ ] DEPLOYMENT_PLANE_URL is accessible
- [ ] Test the lookup endpoint with curl

---

## 🚀 AFTER DEPLOYMENT

1. **Redeploy the service** after adding new env vars
2. **Check logs** for any "Missing configuration" errors
3. **Test domain creation** in the UI
4. **Verify Cloudflare API** is being called successfully

---

Generated: December 4, 2024
