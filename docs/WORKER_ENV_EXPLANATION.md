# Why the Worker Now Uses Environment Variables

## 🔴 The Problem with Hardcoded Values

### Before (Hardcoded):
```javascript
const API_BASE_URL = 'https://api.shipper.now';
const API_KEY = '[HARDCODED_SECRET_KEY]';  // ❌ BAD: Secret in code!
const DEPLOYMENT_PLANE_URL = 'https://deploy.shipper.now';
```

**Issues:**
1. ❌ Can't change values without redeploying worker code
2. ❌ API key is visible in the code
3. ❌ Can't have different values for dev/staging/production
4. ❌ Security risk if code is shared or leaked

---

## ✅ The Solution: Environment Variables

### After (Environment Variables):
```javascript
async function handleRequest(request, env) {
  // Get configuration from environment
  const API_BASE_URL = env.API_BASE_URL || 'https://api.shipper.now';
  const API_KEY = env.API_KEY;
  const DEPLOYMENT_PLANE_URL = env.DEPLOYMENT_PLANE_URL || 'https://deploy.shipper.now';
  
  // ... rest of code
}
```

**Benefits:**
1. ✅ Change values in Cloudflare dashboard without redeploying
2. ✅ API key stored as secret (not in code)
3. ✅ Can have different environments (dev/prod)
4. ✅ More secure - secrets not in source code

---

## 📋 How It Works

### 1. Environment Variables are Set in Two Places:

#### A. `wrangler.toml` (Non-sensitive values)
```toml
[vars]
API_BASE_URL = "https://api.shipper.now"
DEPLOYMENT_PLANE_URL = "https://deploy.shipper.now"
```

#### B. Wrangler Secrets (Sensitive values)
```bash
wrangler secret put API_KEY
# Prompts you to enter the key securely
```

### 2. Cloudflare Injects Them at Runtime

When your worker runs, Cloudflare automatically provides these values in the `env` object:

```javascript
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request, event.env))
  //                                              ^^^^^^^^
  //                                              This contains your env vars!
})
```

### 3. Worker Accesses Them

```javascript
async function handleRequest(request, env) {
  const API_KEY = env.API_KEY;  // ← Gets value from Cloudflare
  // Use it...
}
```

---

## 🔧 Configuration Files

### `wrangler.toml` - Worker Configuration
```toml
name = "domain-router"
main = "domain-router.js"
compatibility_date = "2024-01-01"

# Public environment variables
[vars]
API_BASE_URL = "https://api.shipper.now"
DEPLOYMENT_PLANE_URL = "https://deploy.shipper.now"

# Routes
routes = [
  { pattern = "shipper.now/*", zone_name = "shipper.now" }
]
```

**What goes here:**
- ✅ Non-sensitive configuration
- ✅ URLs, domains, public settings
- ❌ NOT API keys or secrets

### Wrangler Secrets - Sensitive Values
```bash
# Set via command line
wrangler secret put API_KEY
```

**What goes here:**
- ✅ API keys
- ✅ Passwords
- ✅ Tokens
- ✅ Any sensitive data

---

## 🔄 How to Update Values

### Update Non-Sensitive Values:
1. Edit `wrangler.toml`
2. Run `wrangler deploy`
3. Done!

### Update Secrets:
```bash
wrangler secret put API_KEY
# Enter new value when prompted
```

No need to redeploy - takes effect immediately!

---

## 🎯 Best Practices

### ✅ DO:
- Store API keys as secrets
- Use environment variables for all configuration
- Have different values for dev/staging/prod
- Document what each variable does

### ❌ DON'T:
- Hardcode API keys in source code
- Commit secrets to git
- Use the same keys across environments
- Share production keys in documentation

---

## 📊 Comparison

| Aspect | Hardcoded | Environment Variables |
|--------|-----------|----------------------|
| Security | ❌ Poor | ✅ Good |
| Flexibility | ❌ Low | ✅ High |
| Deployment | ❌ Requires redeploy | ✅ Update instantly |
| Multi-env | ❌ Difficult | ✅ Easy |
| Best Practice | ❌ No | ✅ Yes |

---

## 🚀 Deployment Steps

### 1. Set Public Variables (Already Done)
`wrangler.toml` already has:
```toml
[vars]
API_BASE_URL = "https://api.shipper.now"
DEPLOYMENT_PLANE_URL = "https://deploy.shipper.now"
```

### 2. Set Secret (You Need to Do)
```bash
cd cloudflare-worker
wrangler secret put API_KEY
# When prompted, paste your generated WORKER_API_KEY (generate with: openssl rand -hex 32)
```

### 3. Deploy
```bash
wrangler deploy
```

---

## 🔍 Verification

### Check if secrets are set:
```bash
wrangler secret list
```

Should show:
```
API_KEY
```

### Test the worker:
```bash
curl https://shipper.now/
```

Should return worker response (not connection error)

---

## 💡 Why This Matters for Railway

Your Railway backend also uses environment variables for the same reasons:

**Railway Backend:**
```bash
WORKER_API_KEY="[YOUR_GENERATED_KEY]"
CLOUDFLARE_API_TOKEN="..."
DATABASE_URL="..."
```

**Cloudflare Worker:**
```bash
API_KEY="[YOUR_GENERATED_KEY]"  # Must match WORKER_API_KEY
API_BASE_URL="https://api.shipper.now"
```

Both systems use the same pattern:
1. Configuration stored separately from code
2. Secrets managed securely
3. Easy to update without code changes
4. Different values per environment

---

## 📝 Summary

**Before:** Worker had hardcoded values that were insecure and inflexible

**After:** Worker uses environment variables that are:
- ✅ Secure (secrets not in code)
- ✅ Flexible (change without redeploying)
- ✅ Best practice (industry standard)
- ✅ Multi-environment ready

**Action Required:**
1. Run `wrangler secret put API_KEY` to set the secret
2. Deploy with `wrangler deploy`
3. Verify with `wrangler secret list`

---

Generated: December 4, 2024
