# Using Shipper with ngrok

## The Problem
When accessing Shipper through ngrok (e.g., `https://freddie-uninnate-aylin.ngrok-free.dev`), the frontend tries to call the API at `http://localhost:4000`, which fails because localhost isn't accessible from the ngrok URL.

## Solution Options

### Option 1: Expose Both Web and API through ngrok (Recommended)

1. **Create ngrok.yml** (already created in this repo):
   ```yaml
   version: "3"
   agent:
     authtoken: YOUR_NGROK_TOKEN
   
   tunnels:
     web:
       addr: 3000
       proto: http
       domain: your-web-domain.ngrok-free.dev
     api:
       addr: 4000
       proto: http
       domain: your-api-domain.ngrok-free.dev  # Get a second domain
   ```

2. **Update .env** to use the ngrok API URL:
   ```bash
   NEXT_PUBLIC_API_URL="https://YOUR_API_DOMAIN.ngrok-free.dev"
   ```

3. **Start ngrok**:
   ```bash
   ngrok start --all --config=ngrok.yml
   ```

4. **Restart the dev server** (so it picks up the new env var):
   ```bash
   pnpm dev
   ```

### Option 2: Use ngrok for web only + API proxy (Simpler but slower)

If you only have one ngrok domain, you can proxy API requests through Next.js:

1. **Add to `apps/web/next.config.ts`**:
   ```typescript
   async rewrites() {
     return [
       // Existing PostHog rewrites...
       {
         source: '/api/v1/:path*',
         destination: 'http://localhost:4000/api/v1/:path*',
       },
     ];
   },
   ```

2. **Update .env** to use relative API URL:
   ```bash
   NEXT_PUBLIC_API_URL=""  # Empty = use same domain
   ```

3. **Restart dev server**

### Option 3: Temporary env override (Quick test)

For quick testing without restarting:

```bash
NEXT_PUBLIC_API_URL="https://YOUR_API_DOMAIN.ngrok-free.dev" pnpm dev
```

## Current Setup

Your ngrok URL: `https://your-web-domain.ngrok-free.dev`

You need to either:
1. Get a second ngrok domain for the API
2. Use Option 2 (API proxy through Next.js)
3. Test locally without ngrok first

## Testing Locally First

Before dealing with ngrok, test the domain workflow locally:

1. Access http://localhost:3000
2. Create or open a project
3. Go to Settings → Domains
4. Test the domain connection flow

Once it works locally, then configure ngrok for external access.
