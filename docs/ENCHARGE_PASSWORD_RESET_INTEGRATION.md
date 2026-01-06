# Encharge Password Reset & Forgot Password Integration

This document outlines the complete integration of forgot password and reset password flows with Encharge for email automation.

## Overview

The password reset flow now sends user events to Encharge, which can trigger automated email workflows:
1. **Password Reset Requested** - Triggered when user requests a password reset
2. **Password Reset Completed** - Triggered when user successfully resets their password

This follows the same pattern as the existing user registration flow.

## Implementation Details

### Encharge Methods Added

#### 1. `trackPasswordResetRequested(user, resetUrl)`
**Purpose:** Tracks when a user requests a password reset
**Location:** `/apps/web/src/lib/encharge.ts`

```typescript
async trackPasswordResetRequested(user: {
  id: string;
  name?: string;
  email: string;
}, resetUrl: string): Promise<boolean>
```

**Parameters:**
- `user.id` - User's unique ID
- `user.name` - User's name (optional, split into firstName/lastName)
- `user.email` - User's email address
- `resetUrl` - The password reset URL to include in automation

**Event Name:** `"Password reset requested"`
**Properties Sent:**
- `resetUrl` - Direct link to password reset page

**Integration Point:** `/apps/web/src/app/api/auth/forgot-password/route.ts`

#### 2. `trackPasswordResetCompleted(user)`
**Purpose:** Tracks when a user successfully completes a password reset
**Location:** `/apps/web/src/lib/encharge.ts`

```typescript
async trackPasswordResetCompleted(user: {
  id: string;
  name?: string;
  email: string;
}): Promise<boolean>
```

**Parameters:**
- `user.id` - User's unique ID
- `user.name` - User's name (optional, split into firstName/lastName)
- `user.email` - User's email address

**Event Name:** `"Password reset completed"`
**Properties Sent:**
- `timestamp` - ISO timestamp of completion

**Integration Point:** `/apps/web/src/app/api/auth/reset-password/route.ts`

### API Routes Updated

#### Forgot Password Route
**File:** `/apps/web/src/app/api/auth/forgot-password/route.ts`

**Changes:**
- Imports `encharge` and uses `trackPasswordResetRequested()` instead of generic `trackEvent()`
- Sends reset URL to Encharge for automation
- Falls back to SMTP if Encharge fails
- Returns success message for security (prevents email enumeration)

**Flow:**
1. User enters email
2. Check if user exists
3. Generate reset token with 1-hour expiration
4. Track event: `Password reset requested` with `resetUrl`
5. Encharge can send email via automation
6. Fallback to SMTP if Encharge unavailable
7. Return generic success message

#### Reset Password Route
**File:** `/apps/web/src/app/api/auth/reset-password/route.ts`

**Changes:**
- Imports `encharge` and calls `trackPasswordResetCompleted()` after successful password update
- Async tracking (non-blocking)

**Flow:**
1. Validate reset token
2. Verify token hasn't expired
3. Find user from token
4. Hash new password
5. Update user password in database
6. Delete used token
7. **Track event:** `Password reset completed` ✨ (NEW)
8. Return success message

## Configuration

### Environment Variables Required

```env
# Encharge API key for write operations
ENCHARGE_WRITE_KEY=your_write_key_here

# App URL for generating reset links
NEXT_PUBLIC_APP_URL=https://yourapp.com

# For development: shows reset URL in response
NODE_ENV=development
```

### Encharge Setup

In your Encharge account, create automations for:

1. **"Password reset requested" Event**
   - Trigger: When event `"Password reset requested"` is received
   - Action: Send email with reset link
   - Can use `{{properties.resetUrl}}` for dynamic link
   - Can include user details: `{{user.firstName}}`, `{{user.lastName}}`, `{{user.email}}`

2. **"Password reset completed" Event** (Optional)
   - Trigger: When event `"Password reset completed"` is received
   - Action: Send confirmation email
   - Can use `{{properties.timestamp}}` for completion time

## Event Data Structure

### Password Reset Requested

```json
{
  "name": "Password reset requested",
  "user": {
    "email": "user@example.com",
    "userId": "user-123",
    "firstName": "John",
    "lastName": "Doe"
  },
  "properties": {
    "resetUrl": "https://yourapp.com/auth/reset-password?token=abc123xyz"
  }
}
```

### Password Reset Completed

```json
{
  "name": "Password reset completed",
  "user": {
    "email": "user@example.com",
    "userId": "user-123",
    "firstName": "John",
    "lastName": "Doe"
  },
  "properties": {
    "timestamp": "2024-11-19T10:30:00.000Z"
  }
}
```

## Testing the Integration

### Manual Testing

#### 1. Test Forgot Password Flow
```bash
# 1. Request password reset
curl -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'

# Expected Response:
# {
#   "message": "If an account with that email exists, a password reset link has been sent.",
#   "resetUrl": "https://localhost:3000/auth/reset-password?token=..." (dev only)
# }

# 2. Check Encharge logs for "Password reset requested" event
# 3. Verify reset email is sent (Encharge or SMTP fallback)
# 4. Copy reset token from email or development response
```

#### 2. Test Reset Password Flow
```bash
# 1. Use the reset token from above
curl -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "your-reset-token",
    "password": "NewPassword123"
  }'

# Expected Response:
# {
#   "message": "Password reset successfully"
# }

# 2. Check Encharge logs for "Password reset completed" event
# 3. Verify confirmation email is sent (if automation configured)
# 4. Try signing in with new password
```

### Development Mode Testing

When `NODE_ENV=development`:
- Forgot password endpoint returns the reset URL directly in response
- Useful for testing without email access
- Remove this in production for security

### Verification Checklist

- ✅ ENCHARGE_WRITE_KEY is set in environment
- ✅ Forgot password page loads at `/auth/forgot-password`
- ✅ Reset password page loads at `/auth/reset-password?token=...`
- ✅ Events appear in Encharge dashboard
- ✅ Encharge automations trigger correctly
- ✅ Fallback email sent if Encharge unavailable
- ✅ Password successfully resets in database
- ✅ Used tokens are deleted after reset
- ✅ Expired tokens are rejected

## Logging & Debugging

All Encharge operations include detailed console logging:

### Password Reset Request Log
```
🔄 Tracking password reset request for: user@example.com
📦 Password reset payload: {...}
📡 Response Status: 200
✅ Password reset request tracked: user@example.com
```

### Password Reset Completion Log
```
✅ Tracking password reset completion for: user@example.com
📦 Password reset completion payload: {...}
📡 Response Status: 200
✅ Password reset completion tracked: user@example.com
```

### Error Handling
- If Encharge key not configured: Warning logged, event skipped
- If Encharge API fails: Error logged, SMTP fallback triggered
- If SMTP fails: Error logged, but request still succeeds (doesn't block user flow)

## Security Considerations

1. **Email Enumeration Prevention:** Always return generic success message
2. **Token Expiration:** Reset tokens expire after 1 hour
3. **Token One-Time Use:** Used tokens are immediately deleted
4. **Password Hashing:** New passwords are hashed with bcrypt before storage
5. **HTTPS Only:** Reset URLs should only work over HTTPS in production
6. **No Debug Info in Production:** Reset URLs only shown in development mode

## Comparison with Registration Flow

| Feature | Registration | Password Reset |
|---------|--------------|-----------------|
| Event Name | "Registered user" | "Password reset requested" + "Password reset completed" |
| Trigger Method | `trackUserRegistration()` | `trackPasswordResetRequested()` + `trackPasswordResetCompleted()` |
| Fallback | Encharge → Undefined | Encharge → SMTP |
| API File | `/api/auth/register` | `/api/auth/forgot-password` + `/api/auth/reset-password` |
| Properties | None | resetUrl + timestamp |

## Files Modified

1. **`/apps/web/src/lib/encharge.ts`**
   - Added `trackPasswordResetRequested()` method
   - Added `trackPasswordResetCompleted()` method

2. **`/apps/web/src/app/api/auth/forgot-password/route.ts`**
   - Updated to use `trackPasswordResetRequested()`

3. **`/apps/web/src/app/api/auth/reset-password/route.ts`**
   - Added `trackPasswordResetCompleted()` call

4. **`/apps/web/src/app/auth/forgot-password/page.tsx`**
   - No changes (already integrated)

5. **`/apps/web/src/app/auth/reset-password/page.tsx`**
   - No changes (already integrated)

## Next Steps

1. **Set up Encharge automations** in the Encharge dashboard
2. **Test the complete flow** in development
3. **Verify emails are sent** through Encharge
4. **Monitor Encharge dashboard** for event delivery
5. **Deploy to production** with security considerations

## Support & Troubleshooting

### Events Not Appearing in Encharge

1. Check `ENCHARGE_WRITE_KEY` is set correctly
2. Check server logs for error messages
3. Verify event name matches Encharge automation trigger
4. Check Encharge dashboard for received events
5. Verify user email is correct

### Emails Not Being Sent

1. Check Encharge automation is enabled and configured
2. Verify email template has correct placeholders
3. Check SMTP fallback is working (if Encharge fails)
4. Verify `NEXT_PUBLIC_APP_URL` is set correctly
5. Check spam/junk folder

### Token Errors

1. Ensure token matches exactly (case-sensitive)
2. Check token hasn't expired (1 hour limit)
3. Verify token format is correct
4. Check token wasn't already used

