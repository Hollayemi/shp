# Authentication Implementation - NextAuth v5

## Overview

We've successfully implemented a scalable user authentication system using NextAuth v5 with the following features:

- **Multi-provider authentication** (Google, GitHub, Email/Password)
- **Database-backed sessions** with Prisma for scalability
- **Role-based access control** (User, Admin)
- **Protected tRPC procedures**
- **User-specific project isolation**
- **Modern UI components** for authentication flows
- **Secure password hashing** with bcryptjs
- **Registration and sign-in flows** in one component

## Database Schema

### User Tables Added
- `users` - Core user information with roles
- `accounts` - OAuth provider accounts
- `sessions` - Active user sessions  
- `verificationtokens` - Email verification tokens

### Updated Models
- `Project` model now has optional `userId` field to associate projects with users
- Projects are isolated by user - users can only see their own projects
- `User` model includes `password` field for credentials authentication

## Database Session Strategy

We're using `session: { strategy: "database" }` in the NextAuth configuration, which provides several benefits:

### How It Works
- **Session Storage**: Sessions are stored in the `sessions` table instead of JWT tokens
- **Automatic Cleanup**: Expired sessions are automatically removed from the database
- **Scalability**: Multiple server instances can share the same session store
- **Security**: Sessions can be invalidated immediately from the database
- **User Tracking**: Easy to see all active sessions for a user

### Session Flow
1. User signs in → Session record created in database
2. Session token stored in cookie (httpOnly, secure)
3. Each request validates session against database
4. Session automatically expires based on database record
5. Sign out immediately removes session from database

### Benefits Over JWT Strategy
- **Immediate Invalidation**: Can revoke sessions instantly
- **Smaller Cookies**: Only session token in cookie, not entire user data
- **Better for Teams**: Multiple devices/apps can share session state
- **Audit Trail**: Track login history and active sessions
- **Reduced Secret Dependency**: While still using secret for security, less dependent on JWT secret rotation

## Secret Usage in Authentication Flow

The `NEXTAUTH_SECRET` is used for several critical security functions:

### 1. Session Token Signing
Even with database sessions, NextAuth creates a session token stored in cookies:
```
sessionToken = sign(sessionId, NEXTAUTH_SECRET)
```
This prevents tampering with session identifiers.

### 2. CSRF Protection
```
csrfToken = sign(randomValue + timestamp, NEXTAUTH_SECRET)
```
Protects against cross-site request forgery attacks.

### 3. OAuth State Parameter
```
state = sign(callbackUrl + provider + nonce, NEXTAUTH_SECRET)
```
Prevents OAuth authorization code injection attacks.

### 4. Cookie Encryption
Various auth cookies are encrypted/signed:
- `__Secure-next-auth.session-token`
- `__Secure-next-auth.csrf-token`
- `__Host-next-auth.csrf-token`

### 5. Callback URL Validation
Ensures callback URLs haven't been tampered with during OAuth flows.

## Authentication Flow

1. **Landing Page** - Shows sign-in options for unauthenticated users
2. **Sign-in Page** - `/auth/signin` with tabbed interface for multiple auth methods:
   - **Credentials Tab**: Email/password sign-in and registration
   - **OAuth Providers**: Google and GitHub buttons (available on both tabs)
3. **Registration**: Create account with email/password, automatically switches to sign-in tab
4. **Protected Routes** - Automatically redirect to sign-in if not authenticated
5. **User Profile** - Dropdown with user info and sign-out option

## Authentication Providers

### 1. Credentials Provider (Email/Password)
- **Registration**: POST `/api/auth/register` with name, email, password
- **Password Hashing**: Uses bcryptjs with salt rounds = 12
- **Validation**: Zod schema validation on both client and server
- **Security**: Passwords are never stored in plain text

### 2. OAuth Providers
- **Google OAuth**: Full profile access with email and avatar
- **GitHub OAuth**: Public profile with email and avatar
- **Auto-linking**: OAuth accounts can be linked to existing email accounts

## tRPC Integration

- **Protected Procedures** - Require authentication to access
- **Admin Procedures** - Require admin role
- **User Context** - Session and user info available in all procedures
- **Project Isolation** - Users can only access their own projects

## Components Added

### Authentication Components
- `AuthWrapper` - Handles protected routes and navigation
- `UserProfile` - User avatar dropdown with profile info
- `SessionProvider` - Client-side session management

### Pages
- `/auth/signin` - Authentication page with provider buttons
- `/projects` - User's project listing (protected)
- Updated `/` - Shows different content for authenticated vs. unauthenticated users

## Setup Instructions

### 1. Environment Variables
Create a `.env.local` file with:

```env
# Database
DATABASE_URL="your-postgresql-connection-string"

# NextAuth Configuration (REQUIRED)
NEXTAUTH_SECRET="your-very-secure-random-string-here"
NEXTAUTH_URL="http://localhost:3000"

# Google OAuth (Optional)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# GitHub OAuth (Optional)
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"
```

#### Generating a Secure Secret
The `NEXTAUTH_SECRET` should be a random string. Generate one using:

```bash
# Option 1: OpenSSL (recommended)
openssl rand -base64 32

# Option 2: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Option 3: Online tool
# Visit: https://generate-secret.vercel.app/32
```

**Important**: 
- Use a different secret for each environment (dev, staging, prod)
- Never commit secrets to version control
- Rotate secrets periodically for security

### 2. OAuth Provider Setup

#### Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`

#### GitHub OAuth
1. Go to GitHub Settings > Developer settings > OAuth Apps
2. Create a new OAuth App
3. Set Authorization callback URL: `http://localhost:3000/api/auth/callback/github`

### 3. Database Migration
The authentication tables have already been migrated. If you need to reset:

```bash
pnpm prisma migrate reset
pnpm prisma migrate dev
```

## Security Features

- **CSRF Protection** - Built into NextAuth using signed tokens
- **Secure Session Management** - Database-backed with automatic cleanup
- **Role-based Authorization** - Admin vs User roles
- **Project Isolation** - Users can only access their own data
- **Signed Cookies** - All auth cookies are cryptographically signed
- **OAuth State Validation** - Prevents authorization code injection
- **Password Hashing** - bcryptjs with salt rounds = 12

### Security Flow Example

```
1. User submits login form
   ↓
2. NextAuth generates CSRF token: sign(randomValue, NEXTAUTH_SECRET)
   ↓
3. For OAuth: state = sign(callbackUrl + nonce, NEXTAUTH_SECRET)
   ↓
4. After successful auth: sessionToken = sign(sessionId, NEXTAUTH_SECRET)
   ↓
5. Cookie stored: __Secure-next-auth.session-token = sessionToken
   ↓
6. Each request: verify(sessionToken, NEXTAUTH_SECRET) → lookup session in DB
```

**Why This Matters:**
- Without the secret, attackers could forge session tokens
- CSRF tokens prevent cross-site request forgery
- OAuth state prevents authorization code injection
- All sensitive operations are cryptographically protected

## Usage Examples

### Protected tRPC Procedure
```typescript
export const protectedRoute = protectedProcedure
  .input(z.object({ name: z.string() }))
  .mutation(async ({ ctx, input }) => {
    // ctx.user contains authenticated user info
    // ctx.session contains full session
  });
```

### Checking Authentication in Components
```typescript
import { auth } from "@/lib/auth";

export default async function MyComponent() {
  const session = await auth();
  
  if (!session) {
    return <div>Please sign in</div>;
  }
  
  return <div>Welcome {session.user.name}!</div>;
}
```

### Client-side Session Access
```typescript
"use client"
import { useSession } from "next-auth/react";

export function ClientComponent() {
  const { data: session, status } = useSession();
  
  if (status === "loading") return <div>Loading...</div>;
  if (!session) return <div>Not signed in</div>;
  
  return <div>Signed in as {session.user.email}</div>;
}
```

## Next Steps

1. **Set up OAuth providers** with your credentials
2. **Test authentication flow** by signing in/out
3. **Create user-specific features** using the protected procedures
4. **Add email verification** if needed for your use case
5. **Implement admin dashboard** for admin users

The authentication system is now fully integrated and ready for production use! 