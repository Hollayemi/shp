# Cloudflare Worker: Custom Domain Router

This Worker enables custom domain routing for Shipper projects using Cloudflare for SaaS.

## How It Works

1. **User visits custom domain** (e.g., `myapp.com`)
2. **Cloudflare for SaaS routes** to fallback origin (`cname.shipper.now`)
3. **Worker intercepts** via dashboard route (`*/*`)
4. **Worker looks up** which project owns the domain
5. **Worker proxies** to the correct deployment URL
6. **User sees their project** at their custom domain

## Deployment

### Prerequisites

- Cloudflare account with zone access
- Wrangler CLI installed: `npm install -g wrangler`
- Authenticated with Cloudflare: `wrangler auth login`

### Environment Setup

1. **Configure wrangler.toml**:
   ```toml
   # Update for your environment
   account_id = "your-cloudflare-account-id"
   
   [vars]
   API_BASE_URL = "https://api.shipper.now"  # Production API URL
   ```

2. **Set API Key Secret**:
   ```bash
   wrangler secret put API_KEY
   # Enter the WORKER_API_KEY value from your backend .env
   ```

### Deploy

```bash
# Deploy to Cloudflare
wrangler deploy

# Verify deployment
curl https://cname.shipper.now/worker-test
```

### Dashboard Configuration

**CRITICAL**: After deployment, add Worker Routes in Cloudflare Dashboard:

1. Go to **Cloudflare Dashboard** → Your zone (`shipper.now`)
2. Navigate to **Workers & Pages** → **Overview** → **Worker Routes**
3. Click **"Add route"**
4. Configure:
   - **Route pattern**: `*/*` (catches ALL traffic including custom hostnames)
   - **Worker**: `domain-router`
   - **Zone**: `shipper.now`
5. **Save**

> **Why Dashboard Routes?** wrangler.toml routes don't work for Cloudflare for SaaS traffic. Dashboard routes are required to intercept custom hostname requests.

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `API_BASE_URL` | Backend API URL | `https://api.shipper.now` |
| `API_KEY` | Worker authentication key | Set via `wrangler secret put API_KEY` |
| `DEBUG` | Enable verbose logging | `"false"` (production), `"true"` (debugging) |

## Testing

### Test Worker Functionality
```bash
# Test worker is responding
curl https://cname.shipper.now/worker-test

# Test custom domain (after setup)
curl https://your-custom-domain.com/worker-test
```

### Test Custom Domain Flow
```bash
# Should return project content
curl https://your-custom-domain.com/

# Check logs
wrangler tail --format pretty
```

## Production vs Staging

| Environment | API_BASE_URL | Deployment URLs |
|-------------|--------------|-----------------|
| **Staging** | `https://shipper-api-staging.up.railway.app` | `*.deploy-staging.shipper.now` |
| **Production** | `https://api.shipper.now` | `*.deploy.shipper.now` |

The Worker automatically routes to the correct deployment based on the `deploymentUrl` returned by your API.

## Troubleshooting

### Common Issues

1. **404 on custom domain**:
   - Verify dashboard route `*/*` is configured
   - Check custom hostname status in Cloudflare
   - Ensure DNS CNAME points to `cname.shipper.now`

2. **"Domain Not Found" error**:
   - Check API_KEY is set correctly
   - Verify domain exists in database with `isPrimary: true`
   - Check API_BASE_URL points to correct environment

3. **Worker not receiving requests**:
   - Verify dashboard Worker Route is configured
   - Check custom hostname doesn't use `custom_origin_server`

### Debug Commands

```bash
# Check secrets
wrangler secret list

# View logs
wrangler tail --format pretty

# Test API directly
curl -H "x-api-key: YOUR_API_KEY" \
  "https://api.shipper.now/api/v1/domains/lookup?domain=example.com"
```

## Architecture

```
Custom Domain (myapp.com)
    ↓ (CNAME to cname.shipper.now)
Cloudflare for SaaS
    ↓ (Routes to fallback origin)
Cloudflare Zone (shipper.now)
    ↓ (Dashboard route */* catches request)
Worker (domain-router)
    ↓ (Looks up domain in API)
Backend API (/api/v1/domains/lookup)
    ↓ (Returns project deployment URL)
Worker (proxies to deployment)
    ↓
Project Deployment (project-123.deploy.shipper.now)
```

## Security

- API authentication via `x-api-key` header
- Secrets managed via Wrangler (not in code)
- HTTPS enforced for all requests
- Timeout protection (8 seconds)

## Monitoring

- Worker logs available via `wrangler tail`
- Cloudflare Analytics in dashboard
- Custom domain status via API endpoints