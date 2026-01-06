# API Authentication Guide

## Overview

The Shipper API server is now protected with API key authentication. All endpoints (except `/health`) require a valid API key.

## Security Implementation

**Authentication Method**: Shared secret API key
**Header**: `x-api-key`
**Environment Variable**: `SHIPPER_API_KEY`

## Setup

### 1. Generate API Secret Key

Generate a secure random string for your API key:

```bash
# Option 1: Using OpenSSL (recommended)
openssl rand -base64 32

# Option 2: Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 2. Configure Environment Variables

Add `SHIPPER_API_KEY` to both the API server and webapp:

**API Server** (`apps/api/.env`):
```env
SHIPPER_API_KEY=your_generated_secret_key_here
DAYTONA_API_KEY=your_daytona_key
PORT=4000
DATABASE_URL=your_database_url
```

**Webapp** (`apps/web/.env.local`):
```env
SHIPPER_API_KEY=your_generated_secret_key_here
NEXT_PUBLIC_API_URL=http://localhost:4000
DATABASE_URL=your_database_url
```

**Important**: Use the SAME value for `SHIPPER_API_KEY` in both files!

### 3. Start Services

```bash
# Terminal 1: Start API server
pnpm dev:api

# Terminal 2: Start webapp
pnpm dev:web
```

## Testing Authentication

### Test 1: Health Check (No Auth Required)

```bash
curl http://localhost:4000/health
```

Expected: `200 OK` with health status (no API key needed)

### Test 2: Protected Endpoint Without API Key

```bash
curl http://localhost:4000/api/v1/projects
```

Expected: `401 Unauthorized` with error message:
```json
{
  "success": false,
  "error": "Missing API key. Include 'x-api-key' header."
}
```

### Test 3: Protected Endpoint With Valid API Key

```bash
curl http://localhost:4000/api/v1/projects \
  -H "x-api-key: your_api_secret_key"
```

Expected: `200 OK` with data

### Test 4: Protected Endpoint With Invalid API Key

```bash
curl http://localhost:4000/api/v1/projects \
  -H "x-api-key: wrong_key"
```

Expected: `401 Unauthorized` with error:
```json
{
  "success": false,
  "error": "Invalid API key"
}
```

## Implementation Details

### Middleware

Location: `apps/api/src/middleware/auth.ts`

The middleware:
- Checks for `x-api-key` header on all requests
- Excludes `/health` endpoint from authentication
- Validates key against `SHIPPER_API_KEY` environment variable
- Returns 401 if key is missing or invalid

### API Client

Location: `apps/web/src/lib/api/daytona-client.ts`

The client:
- Automatically includes `x-api-key` header in all requests
- Reads key from `SHIPPER_API_KEY` environment variable
- Throws error if environment variable is not set

### Flow

```
Webapp Request
    ↓
DaytonaAPIClient (adds x-api-key header)
    ↓
API Server
    ↓
validateApiKey Middleware
    ↓
- ✅ Valid key → Continue to route handler
- ❌ Invalid/missing key → Return 401
```

## Security Best Practices

1. **Never commit API keys to version control**
   - Add `.env` and `.env.local` to `.gitignore`
   - Use `.env.example` files without actual keys

2. **Use different keys for different environments**
   - Development: One key
   - Staging: Different key
   - Production: Different key

3. **Rotate keys periodically**
   - Generate new keys every 90 days
   - Update in both API server and webapp simultaneously

4. **Keep keys secure**
   - Store in environment variables only
   - Never log the actual key value
   - Use secret management services in production (AWS Secrets Manager, etc.)

## Future Enhancements

Consider implementing:
- **Rate limiting**: Prevent abuse with request throttling
- **JWT tokens**: User-specific authentication from NextAuth
- **Project-level authorization**: Verify user has access to requested projects
- **API key rotation**: Support multiple active keys for zero-downtime rotation
- **Request logging**: Track API usage by key/user

## Troubleshooting

### Error: "SHIPPER_API_KEY environment variable is not set"

**Cause**: Missing environment variable in webapp
**Solution**: Add `SHIPPER_API_KEY` to `apps/web/.env.local`

### Error: "Missing API key. Include 'x-api-key' header."

**Cause**: API request without authentication header
**Solution**: Ensure `SHIPPER_API_KEY` is set in webapp environment

### Error: "Invalid API key"

**Cause**: Mismatch between webapp and API server keys
**Solution**: Verify both environments use the SAME `SHIPPER_API_KEY` value

### Error: "Server configuration error"

**Cause**: `SHIPPER_API_KEY` not set in API server
**Solution**: Add `SHIPPER_API_KEY` to `apps/api/.env`

## Production Deployment

### Environment Variables

**Vercel (Webapp)**:
1. Go to Project Settings → Environment Variables
2. Add `SHIPPER_API_KEY` with your production key
3. Add to Production, Preview, and Development environments

**Railway/Render/etc (API Server)**:
1. Go to Environment Variables section
2. Add `SHIPPER_API_KEY` with the SAME production key
3. Restart the service

### CORS Configuration

If webapp and API are on different domains in production, update CORS settings:

```typescript
// apps/api/src/index.ts
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true,
}));
```

Then set `ALLOWED_ORIGINS` environment variable:
```env
ALLOWED_ORIGINS=https://yourapp.com,https://www.yourapp.com
```

## Related Documentation

- `CLAUDE.md` - Environment variables section
- `docs/DAYTONA_API_MIGRATION.md` - API architecture
- `apps/api/src/middleware/auth.ts` - Authentication implementation
