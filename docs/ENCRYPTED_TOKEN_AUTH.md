# Encrypted Token Authentication for Direct API Access

## Overview

Successfully implemented **encrypted token authentication** to enable direct browser → API server communication without cross-origin cookie limitations!

## The Problem

Cross-origin cookies don't work between different ports/domains:
- NextAuth sets cookies on `localhost:3000` (web app)
- Cookies won't be sent to `localhost:4000` (API server)
- Browser security prevents cross-origin cookie sharing

## The Solution

**Encrypted tokens that can only be decrypted by the API server:**

1. Browser requests an encrypted token from `/api/get-chat-token` (same-origin, has cookies)
2. Next.js API route reads session cookie and creates an encrypted token
3. Browser sends encrypted token in `x-chat-token` header to API server
4. API server decrypts token with shared secret key
5. API server validates session from decrypted data

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (localhost:3000)                                       │
│                                                                 │
│  1. User signs in → NextAuth sets HTTP-only cookie             │
│  2. Chat starts → Fetch /api/get-chat-token                    │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  Next.js API Route (/api/get-chat-token)              │   │
│  │  - Reads session cookie (same-origin, allowed)        │   │
│  │  - Creates encrypted token with AES-256-GCM           │   │
│  │  - Returns: { token: "encrypted_data" }               │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                 │
│  3. Send chat request with x-chat-token header                 │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ POST /api/v1/chat
                                │ Headers: { "x-chat-token": "..." }
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  API Server (localhost:4000)                                    │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  Session Middleware                                    │   │
│  │  - Reads x-chat-token header                           │   │
│  │  - Decrypts with shared CHAT_TOKEN_SECRET              │   │
│  │  - Extracts: sessionToken, userId, email               │   │
│  │  - Validates session in database                       │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                 │
│  4. Process request with AI, tools, streaming, etc.            │
└─────────────────────────────────────────────────────────────────┘
```

## Implementation Details

### 1. Shared Encryption Library (`packages/shared/src/lib/chat-token.ts`)

**Algorithm:** AES-256-GCM with PBKDF2 key derivation

**Token Structure:**
```typescript
interface ChatTokenPayload {
  sessionToken: string;  // NextAuth session token
  userId: string;        // User ID
  email: string;         // User email
  expiresAt: number;     // Unix timestamp (1 hour from creation)
}
```

**Encryption Process:**
1. Generate random salt (64 bytes)
2. Derive 256-bit key from secret using PBKDF2 (100,000 iterations)
3. Generate random IV (16 bytes)
4. Encrypt JSON payload with AES-256-GCM
5. Combine: `salt + iv + authTag + encrypted` → base64url

**Security Features:**
- ✅ Unique salt per token (prevents rainbow table attacks)
- ✅ PBKDF2 key derivation (slows brute force)
- ✅ GCM authentication tag (prevents tampering)
- ✅ 1-hour expiration (limits exposure window)
- ✅ Base64url encoding (URL-safe)

### 2. Token Generation Endpoint (`apps/web/src/app/api/get-chat-token/route.ts`)

**Route:** `GET /api/get-chat-token`

**Process:**
1. Validates NextAuth session (same-origin, can read cookies)
2. Reads session token from HTTP-only cookie
3. Creates encrypted token with session data
4. Returns token to browser (safe because it's encrypted)

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "encrypted_base64url_token"
  }
}
```

**Error Codes:**
- `401` - Not authenticated
- `500` - Token generation failed

### 3. Session Middleware Update (`apps/api/src/middleware/session-auth.ts`)

**Supports 3 authentication methods** (in priority order):

1. **x-chat-token header** (encrypted token) - Preferred for direct browser calls
2. **Cookie header** (session cookie) - For same-origin requests
3. **Authorization header** (Bearer token) - For proxy/internal requests

**Decryption Process:**
```typescript
const chatToken = req.headers["x-chat-token"];
if (chatToken) {
  const payload = decryptChatToken(chatToken, CHAT_TOKEN_SECRET);
  if (payload) {
    sessionToken = payload.sessionToken;
    userId = payload.userId;
    userEmail = payload.email;
  }
}
```

**Validation:**
- Checks token expiration (1 hour)
- Validates session exists in database
- Attaches user data to request

### 4. Chat Component Update (`apps/web/src/modules/projects/ui/components/Chat.tsx`)

**Updated fetch to include encrypted token:**

```typescript
transport: new DefaultChatTransport({
  api: (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000") + "/api/v1/chat",

  fetch: async (input, init) => {
    // Fetch encrypted chat token
    const tokenResponse = await fetch("/api/get-chat-token");
    const tokenData = await tokenResponse.json();

    if (!tokenData.success || !tokenData.data?.token) {
      throw new Error("Failed to get chat token");
    }

    // Include token in x-chat-token header
    return fetch(input, {
      ...init,
      headers: {
        ...init?.headers,
        "x-chat-token": tokenData.data.token,
      },
    });
  },
}),
```

**Flow:**
1. Before each chat request, fetch fresh token from `/api/get-chat-token`
2. Include token in `x-chat-token` header
3. Send request directly to API server (no proxy!)

### 5. CORS Configuration (`apps/api/src/index.ts`)

**Added `x-chat-token` to allowed headers:**

```typescript
cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization", "x-api-key", "x-chat-token"],
})
```

## Environment Variables

### Both Apps Need Shared Secret

**Web App** (`apps/web/.env.local`):
```bash
# Shared secret for token encryption (must match API server)
CHAT_TOKEN_SECRET=your-very-long-random-secret-key-here

# Or uses NEXTAUTH_SECRET if CHAT_TOKEN_SECRET not set
NEXTAUTH_SECRET=your-nextauth-secret

# API server URL
NEXT_PUBLIC_API_URL=http://localhost:4000  # Dev
# NEXT_PUBLIC_API_URL=https://api.shipper.app  # Production
```

**API Server** (`apps/api/.env`):
```bash
# Shared secret for token decryption (must match web app)
CHAT_TOKEN_SECRET=your-very-long-random-secret-key-here

# Or uses NEXTAUTH_SECRET if CHAT_TOKEN_SECRET not set
NEXTAUTH_SECRET=your-nextauth-secret

# Web app origin for CORS
WEB_APP_URL=http://localhost:3000  # Dev
# WEB_APP_URL=https://shipper.app  # Production
```

**⚠️ CRITICAL:** Both apps must use the **exact same** `CHAT_TOKEN_SECRET` value!

## Security Considerations

### Why This Is Secure

1. **Token is encrypted** - Even if intercepted, attacker cannot read or modify it
2. **Only API server can decrypt** - Requires shared secret key
3. **Short expiration** - Token valid for 1 hour only
4. **No client-side secret** - Browser never has the encryption key
5. **Tamper-proof** - GCM authentication tag prevents modification
6. **Unique per token** - Random salt prevents pattern analysis

### Attack Scenarios

**Scenario: Attacker steals encrypted token from network**
- ❌ Cannot decrypt it (no secret key)
- ❌ Cannot modify it (auth tag verification fails)
- ✅ Token expires in 1 hour (limited damage window)

**Scenario: Attacker tries to forge token**
- ❌ Cannot encrypt without secret key
- ❌ Random attempts fail auth tag verification
- ❌ Brute force prevented by PBKDF2 (100,000 iterations)

**Scenario: Attacker compromises web app**
- ⚠️ Can request tokens for authenticated users
- ✅ But cannot decrypt them (no key in browser)
- ✅ Cannot use for other users (session bound)

**Scenario: Attacker compromises API server**
- ⚠️ Has secret key, can decrypt tokens
- ⚠️ Has database access, can validate sessions
- ✅ Same risk as any server compromise

### Best Practices

1. **Use strong secret key:**
   ```bash
   # Generate with:
   openssl rand -base64 64
   ```

2. **Rotate secret periodically:**
   - Update `CHAT_TOKEN_SECRET` every 90 days
   - Old tokens become invalid (expected)
   - Users re-authenticate automatically

3. **Use HTTPS in production:**
   - Encrypted tokens + encrypted transport
   - Prevents man-in-the-middle attacks

4. **Monitor token usage:**
   - Log decryption failures
   - Alert on unusual patterns
   - Rate limit token generation endpoint

## Testing

### Development Setup

**Terminal 1 - API Server:**
```bash
cd apps/api
pnpm dev
# Listening on http://localhost:4000
```

**Terminal 2 - Web App:**
```bash
cd apps/web
pnpm dev
# Listening on http://localhost:3000
```

### Verify Token Authentication

1. **Sign in to web app** at http://localhost:3000
2. **Open DevTools** → Network tab
3. **Send a chat message**
4. **Check requests:**

**Request to `/api/get-chat-token`:**
```
GET http://localhost:3000/api/get-chat-token
Response:
{
  "success": true,
  "data": {
    "token": "encrypted_base64url_string"
  }
}
```

**Request to API server:**
```
POST http://localhost:4000/api/v1/chat
Headers:
  x-chat-token: encrypted_base64url_string
  Content-Type: application/json
```

**Check API server logs:**
```
[SessionAuth] Using encrypted chat token for user: user@example.com
[Chat] Starting chat session for user user@example.com, project abc-123
```

### Manual Testing

**Generate a token:**
```bash
# Sign in, then:
curl http://localhost:3000/api/get-chat-token \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \
  -v
```

**Use token with API server:**
```bash
curl http://localhost:4000/api/v1/chat \
  -H "x-chat-token: ENCRYPTED_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":{"role":"user","content":"test"},"projectId":"abc"}' \
  -v
```

## Benefits Over Other Approaches

### vs. Cross-Origin Cookies
- ✅ Works across different ports/domains
- ✅ No SameSite restrictions
- ✅ No __Secure- cookie requirements

### vs. Proxy Route
- ✅ No Next.js streaming timeout limits
- ✅ Direct connection (better performance)
- ✅ Independent API server scaling

### vs. Plain JWT
- ✅ Encrypted payload (not just signed)
- ✅ Short-lived (1 hour)
- ✅ Bound to session (can be revoked)

### vs. API Keys
- ✅ User-specific (tied to session)
- ✅ Automatic expiration
- ✅ No long-lived credentials in browser

## Production Deployment

### Web App
1. Set `CHAT_TOKEN_SECRET` (same as API server)
2. Set `NEXT_PUBLIC_API_URL=https://api.shipper.app`
3. Deploy to Vercel/similar
4. Ensure HTTPS enabled

### API Server
1. Set `CHAT_TOKEN_SECRET` (same as web app)
2. Set `WEB_APP_URL=https://shipper.app`
3. Deploy to Railway/Render/AWS/etc
4. Ensure HTTPS enabled
5. Configure CORS to allow production web app URL

### Secret Key Management

**Development:**
```bash
# .env.local (both apps)
CHAT_TOKEN_SECRET=dev-secret-key-12345
```

**Production:**
- Store in environment variables (Vercel, Railway, etc.)
- Use secrets manager (AWS Secrets Manager, HashiCorp Vault)
- Never commit to git
- Different secret for each environment

## Troubleshooting

### "Failed to get chat token"

**Cause:** Web app can't generate token

**Fixes:**
1. Check user is signed in
2. Check session cookie exists
3. Check `/api/get-chat-token` endpoint logs
4. Verify `CHAT_TOKEN_SECRET` or `NEXTAUTH_SECRET` is set

### "Missing session token"

**Cause:** API server can't decrypt token

**Fixes:**
1. Check `CHAT_TOKEN_SECRET` matches on both apps
2. Check `x-chat-token` header is included
3. Check CORS allows `x-chat-token` header
4. Check token hasn't expired (1 hour)

### Decryption fails

**Cause:** Secret mismatch or corrupted token

**Fixes:**
1. Verify both apps use exact same `CHAT_TOKEN_SECRET`
2. Check for trailing spaces in environment variable
3. Regenerate token (refresh page, sign in again)
4. Check logs for decryption errors

### CORS errors

**Cause:** Origin not allowed

**Fixes:**
1. Set `WEB_APP_URL` in API server
2. Check origin matches exactly (protocol, domain, port)
3. Check `x-chat-token` in `allowedHeaders`
4. Check browser console for specific CORS error

## Summary

**What We Built:**
- ✅ Encrypted token system with AES-256-GCM
- ✅ Token generation endpoint in Next.js
- ✅ Token decryption in API server middleware
- ✅ Direct browser → API server communication
- ✅ No cross-origin cookie issues

**Security:**
- ✅ Encrypted with shared secret
- ✅ 1-hour expiration
- ✅ Tamper-proof (GCM auth tag)
- ✅ Session-bound (can be revoked)

**Performance:**
- ✅ Direct connection (no proxy)
- ✅ No timeout limits
- ✅ Minimal overhead (one extra request per chat)

**Result:** Secure, direct API access without cross-origin cookie limitations! 🎉

---

**Status:** ✅ **COMPLETE**

**Implementation Time:** ~45 minutes

**Files Created:**
- `packages/shared/src/lib/chat-token.ts` - Encryption library
- `apps/web/src/app/api/get-chat-token/route.ts` - Token generation

**Files Modified:**
- `packages/shared/src/index.ts` - Export chat-token
- `apps/api/src/middleware/session-auth.ts` - Support encrypted tokens
- `apps/api/src/index.ts` - Allow x-chat-token header
- `apps/web/src/modules/projects/ui/components/Chat.tsx` - Use encrypted tokens
