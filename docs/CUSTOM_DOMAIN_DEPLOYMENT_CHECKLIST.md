# Custom Domain Deployment Checklist

## ✅ COMPLETED BY KIRO

### 1. Generated API Key
```
[YOUR_GENERATED_WORKER_API_KEY]
```
Generate with: `openssl rand -hex 32`

### 2. Updated Worker Configuration
**File:** `cloudflare-worker/domain-router.js`
- ✅ API_KEY set to generated key
- ✅ API_BASE_URL set to `[Base_URL]`
- ✅ DEPLOYMENT_PLANE_URL already correct: [DEPLOYMENT_BASE_SECRET]

### 3. Added WORKER_API_KEY to .env
**File:** `.env`
- ✅ Added `WORKER_API_KEY="[YOUR_GENERATED_WORKER_API_KEY]"`

### 4. Checked Wrangler Configuration
**File:** `cloudflare-worker/wrangler.toml`
- ✅ Worker name: `domain-router`
- ✅ Route configured: `shipper.now/*`
- ❌ **MISSING:** `account_id` (needs to be added)
- ❌ **MISSING:** API_KEY as secret (needs to be set via wrangler)

---

## 🔴 REQUIRES YOUR ACTION

### PHASE 1: Verify Railway Backend URL

**Question:** What is your Railway backend URL?

**To check:**
1. Go to your Railway dashboard
2. Find your API service
3. Check the public domain (e.g., `https://shipper-api-staging.up.railway.app`)

**Update this URL in:**
- `cloudflare-worker/wrangler.toml` - Set `API_BASE_URL` variable
- Railway environment variables - Set `NEXT_PUBLIC_API_URL` to match

---

### PHASE 2: Add to Railway Environment Variables

In your Railway backend, add this environment variable:

```bash
WORKER_API_KEY=[YOUR_GENERATED_WORKER_API_KEY]
```
Generate with: `openssl rand -hex 32`

**Steps:**
1. Go to Railway dashboard
2. Select your API service
3. Go to Variables tab
4. Add new variable: `WORKER_API_KEY`
5. Paste the value above
6. Redeploy the service

---

### PHASE 3: Configure Wrangler for Deployment

#### Step 1: Get Cloudflare Account ID

1. Log in to Cloudflare Dashboard
2. Go to any domain
3. Scroll down on Overview page
4. Copy your **Account ID**

#### Step 2: Update wrangler.toml

Add this line at the top of `cloudflare-worker/wrangler.toml`:

```toml
account_id = "YOUR_ACCOUNT_ID_HERE"
```

**Full file should look like:**
```toml
account_id = "84f7853af597f6a286f73adf2e0b1cfe"  # Your actual account ID
name = "domain-router"
main = "domain-router.js"
compatibility_date = "2024-01-01"

routes = [
  { pattern = "shipper.now/*", zone_name = "shipper.now" }
]

[vars]
API_BASE_URL = "https://api.shipper.now"
DEPLOYMENT_PLANE_URL = "https://deploy.shipper.now"
```

#### Step 3: Set API Key as Secret

```bash
cd cloudflare-worker
wrangler secret put API_KEY
# When prompted, paste your generated WORKER_API_KEY
```

---

### PHASE 4: Deploy the Worker

```bash
cd cloudflare-worker
wrangler login  # If not already logged in
wrangler deploy
```

**Expected output:**
```
✨ Built successfully
✨ Uploaded domain-router
✨ Deployed domain-router
   https://domain-router.YOUR-SUBDOMAIN.workers.dev
```

---

### PHASE 5: Verify Worker Route

1. Go to Cloudflare Dashboard
2. Navigate to: **Workers & Pages** → **domain-router**
3. Click **Settings** → **Triggers**
4. Verify route exists: `shipper.now/*`
5. If not, click **Add Route**:
   - Route: `shipper.now/*`
   - Zone: `shipper.now`

---

### PHASE 6: Test the Setup

#### Test 1: Check if worker is deployed
```bash
curl https://shipper.now/
```
Should return the worker's 404 page (not a connection error)

#### Test 2: Test lookup endpoint
```bash
curl "https://api.shipper.now/api/v1/domains/lookup?domain=test.com"
```
Should return JSON (even if domain not found)

#### Test 3: Add a test domain
1. Deploy a project in your app
2. Go to Settings → Domains
3. Add a domain you own
4. Point DNS to the CNAME provided
5. Wait for DNS propagation (5-60 minutes)
6. Visit your custom domain

---

## 📋 VERIFICATION CHECKLIST

Before testing with a real domain:

- [ ] Railway backend has `WORKER_API_KEY` environment variable
- [ ] Railway backend is accessible at `https://api.shipper.now`
- [ ] `wrangler.toml` has correct `account_id`
- [ ] API_KEY secret is set in Cloudflare Worker
- [ ] Worker is deployed successfully
- [ ] Worker route `shipper.now/*` is active
- [ ] Cloudflare for SaaS is enabled on `shipper.now` zone
- [ ] Fallback Origin is set to `shipper.now` in Cloudflare dashboard
- [ ] At least one project is deployed (has `deploymentUrl` set)

---

## 🔍 TROUBLESHOOTING

### Worker deployment fails
- Check `account_id` is correct in `wrangler.toml`
- Run `wrangler login` to authenticate
- Check you have permissions on the Cloudflare account

### Domain lookup returns 404
- Verify Railway backend is running
- Check `WORKER_API_KEY` is set in Railway
- Test the endpoint directly: `curl https://api.shipper.now/api/v1/domains/lookup?domain=test.com`

### Custom domain doesn't route
- Check domain status is "ACTIVE" in database
- Verify DNS is pointing to correct CNAME
- Check worker logs in Cloudflare dashboard
- Verify project has `deploymentUrl` set

### SSL certificate pending
- SSL can take up to 24 hours to provision
- Check Cloudflare dashboard for SSL status
- Ensure domain DNS is verified first

---

## 📞 NEXT STEPS

1. **Verify Railway URL** - Confirm `https://api.shipper.now` is correct
2. **Add WORKER_API_KEY to Railway** - Add the environment variable
3. **Get Cloudflare Account ID** - From Cloudflare dashboard
4. **Update wrangler.toml** - Add account_id
5. **Set API_KEY secret** - Run `wrangler secret put API_KEY`
6. **Deploy worker** - Run `wrangler deploy`
7. **Test** - Follow Phase 6 testing steps

---

## 🔐 SECURITY NOTES

- The WORKER_API_KEY should be stored in:
  - Wrangler secret (recommended)
  - Railway env var
  - Local .env file (never commit!)

- **Recommendation:** Add API key validation to `/api/v1/domains/lookup` endpoint
- **Never commit** `.env` files to git
- **Rotate keys** periodically for security
- **Generate strong keys** with `openssl rand -hex 32`

---

Generated: December 4, 2024
