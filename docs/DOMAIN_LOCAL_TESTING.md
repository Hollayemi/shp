# Local Domain Testing Guide

This guide shows you how to test the custom domain workflow on your local development environment without needing a real domain.

## Option 1: Mock Domain Testing (Recommended for UI Testing)

This approach lets you test the UI and workflow without actual DNS configuration.

### Setup

1. **Start your local dev server**:
   ```bash
   cd Shipper-webapp
   pnpm dev:web
   ```

2. **Access the domain settings**:
   - Open http://localhost:3000
   - Create or open a project
   - Go to Settings → Domains tab

### What You Can Test Locally

✅ **UI Components**:
- Domain connection form
- Domain list display
- Status badges (Pending, Active, Failed)
- DNS instructions with registrar tabs
- Copy buttons
- Primary domain selection
- Delete domain functionality
- Success/error banners
- Toast notifications

✅ **Integration Points**:
- Domain display in project header
- Domain display in deployment settings
- Auto-polling behavior (visual feedback)
- Loading states
- Error states

❌ **What Won't Work Without Real DNS**:
- Actual domain verification
- SSL certificate provisioning
- Domain status changing from Pending to Active
- Testing the actual domain URL

### Testing the UI Flow

1. **Connect a fake domain**:
   ```
   Enter: test.example.com
   ```
   - Should show "Pending" status
   - DNS instructions should appear
   - Copy buttons should work

2. **Test multiple domains**:
   ```
   Add: app.example.com
   Add: demo.example.com
   ```
   - All should appear in the list
   - Each should have its own DNS instructions

3. **Test primary domain selection**:
   - Click "Use this domain for this project" on any domain
   - Should show purple "Primary" badge
   - Check if it appears in project header
   - Check if it appears in deployment settings

4. **Test delete**:
   - Click trash icon
   - Confirm deletion
   - Domain should be removed

---

## Option 2: Local DNS Override (Full Testing)

This approach lets you test the complete flow including domain resolution.

### Prerequisites

- A test domain you control (or use a free subdomain service)
- Or use `/etc/hosts` file to simulate domain resolution

### Method A: Using /etc/hosts (Simplest)

1. **Edit your hosts file**:
   ```bash
   sudo nano /etc/hosts
   ```

2. **Add test domain entries**:
   ```
   127.0.0.1   myapp.local
   127.0.0.1   test.myapp.local
   ```

3. **Save and exit** (Ctrl+X, Y, Enter)

4. **Flush DNS cache**:
   ```bash
   # macOS
   sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
   
   # Linux
   sudo systemd-resolve --flush-caches
   
   # Windows (run as admin)
   ipconfig /flushdns
   ```

5. **Test domain resolution**:
   ```bash
   ping myapp.local
   # Should resolve to 127.0.0.1
   ```

6. **Access your local app**:
   - Open http://myapp.local:3000
   - Should load your local Shipper instance

**Limitations**:
- Still won't verify DNS records (no real DNS server)
- Won't provision SSL certificates
- But you can test the domain routing logic

---

### Method B: Using ngrok (Real Domain Testing)

This gives you a real public URL to test with actual DNS.

1. **Install ngrok**:
   ```bash
   brew install ngrok  # macOS
   # or download from https://ngrok.com/download
   ```

2. **Sign up for ngrok** (free):
   - Go to https://dashboard.ngrok.com/signup
   - Get your auth token

3. **Configure ngrok**:
   ```bash
   ngrok config add-authtoken YOUR_AUTH_TOKEN
   ```

4. **Start your local server**:
   ```bash
   pnpm dev:web
   # Running on http://localhost:3000
   ```

5. **Create ngrok tunnel**:
   ```bash
   ngrok http 3000
   ```

6. **You'll get a public URL**:
   ```
   Forwarding: https://abc123.ngrok-free.app -> http://localhost:3000
   ```

7. **Use this URL for testing**:
   - You can now add DNS records pointing to this ngrok URL
   - Test the full domain verification flow
   - Note: Free ngrok URLs change on restart

**Advantages**:
- Real public URL
- Can test actual DNS verification
- Can test SSL (ngrok provides SSL)
- Can share with team for testing

**Limitations**:
- URL changes on restart (unless you have paid ngrok)
- Rate limits on free tier

---

## Option 3: Local Mock API (For Development)

Create a mock mode that simulates domain verification without real DNS.

### Implementation

1. **Add a demo mode flag** to your `.env.local`:
   ```bash
   NEXT_PUBLIC_DOMAIN_DEMO_MODE=true
   ```

2. **Check if demo mode exists**:
   ```bash
   grep -r "DOMAIN_DEMO_MODE" Shipper-webapp/
   ```

3. **If it exists, enable it**:
   - Set the env variable
   - Restart your dev server
   - Domain status will auto-change to "Active" after a few seconds

4. **If it doesn't exist**, you can test the UI flow with mock data:
   - Connect domains (they'll stay pending)
   - Test all UI interactions
   - Verify visual feedback works

---

## Quick Local Testing Checklist

Use this to verify the UI works correctly:

### Basic UI Tests (No DNS Required)

- [ ] **Navigate to Domains tab**
  - Settings → Domains
  - Tab is visible and clickable

- [ ] **Connect domain form**
  - Input field accepts domain names
  - Validation works (rejects invalid domains)
  - Submit button works

- [ ] **Domain list display**
  - Domain appears after connection
  - Shows "Pending" status badge
  - Shows creation date

- [ ] **DNS instructions**
  - CNAME record displayed
  - TXT record displayed
  - Registrar tabs work (Cloudflare, GoDaddy, etc.)
  - Copy buttons work for all fields
  - "Copy All" buttons work

- [ ] **Status checking**
  - Refresh button appears
  - Loading spinner shows during check
  - Status updates after check

- [ ] **Auto-polling**
  - Pending domains auto-check every 30 seconds
  - Visual feedback during polling

- [ ] **Primary domain**
  - "Use this domain" button appears
  - Clicking sets domain as primary
  - Purple "Primary" badge appears
  - Only one domain can be primary

- [ ] **Project header integration**
  - Primary domain appears in header (desktop)
  - Shows globe icon + domain name
  - Clickable link (opens in new tab)
  - Hidden on mobile

- [ ] **Deployment settings integration**
  - Domains section appears
  - Shows all connected domains
  - Status badges correct
  - Test button for active domains

- [ ] **Delete domain**
  - Trash icon appears
  - Confirmation dialog shows
  - Domain removed after confirmation

- [ ] **Toast notifications**
  - Show when domain connected
  - Show when set as primary
  - Show on errors

- [ ] **Error handling**
  - Invalid domain names rejected
  - Network errors handled gracefully
  - Error messages are clear

---

## Testing with Real DNS (Optional)

If you want to test the complete flow with real DNS verification:

### Option A: Use a Free Subdomain Service

1. **Sign up for a free subdomain**:
   - FreeDNS: https://freedns.afraid.org
   - No-IP: https://www.noip.com
   - DuckDNS: https://www.duckdns.org

2. **Point it to your ngrok URL**:
   - Create CNAME record → your-ngrok-url.ngrok-free.app
   - Add TXT record from Shipper

3. **Test the full flow**:
   - Connect domain in Shipper
   - Add DNS records
   - Wait for verification
   - Should change to "Active"

### Option B: Use a Test Domain You Own

1. **Use a subdomain of a domain you own**:
   ```
   Example: test.yourdomain.com
   ```

2. **Point it to ngrok or your staging server**

3. **Follow the normal testing flow**

---

## Debugging Tips

### Check if domain API is working

```bash
# Test domain connection endpoint
curl -X POST http://localhost:3000/api/domains \
  -H "Content-Type: application/json" \
  -d '{"projectId":"your-project-id","domain":"test.example.com"}'
```

### Check if domain list is loading

```bash
# Test domain list endpoint
curl http://localhost:3000/api/domains/list/your-project-id
```

### Check browser console

1. Open DevTools (F12)
2. Go to Console tab
3. Look for errors related to:
   - Domain API calls
   - TRPC mutations
   - Toast notifications

### Check network requests

1. Open DevTools (F12)
2. Go to Network tab
3. Filter by "domains"
4. Check request/response for:
   - `/api/domains` (POST) - Connect domain
   - `/api/domains/list/:projectId` (GET) - List domains
   - `/api/domains/status/:domainId` (GET) - Check status
   - `/api/domains/:domainId/set-primary` (POST) - Set primary
   - `/api/domains/:domainId` (DELETE) - Delete domain

---

## Mock Data for Testing

If you want to test with mock data, you can temporarily modify the API to return fake domains:

### Example Mock Response

```typescript
// In apps/web/src/lib/api/domains.ts
// Temporarily add this for testing:

export async function listCustomDomains(projectId: string) {
  // Mock data for local testing
  if (process.env.NODE_ENV === 'development') {
    return {
      success: true,
      domains: [
        {
          id: 'mock-1',
          domain: 'app.example.com',
          isPrimary: true,
          status: 'ACTIVE' as const,
          sslStatus: 'ACTIVE' as const,
          cnameTarget: 'cname.shipper.now',
          txtName: '_shipper-verify.app.example.com',
          txtValue: 'shipper-verify-abc123',
          verificationErrors: null,
          createdAt: new Date().toISOString(),
          verifiedAt: new Date().toISOString(),
          lastCheckedAt: new Date().toISOString(),
        },
        {
          id: 'mock-2',
          domain: 'demo.example.com',
          isPrimary: false,
          status: 'PENDING_VALIDATION' as const,
          sslStatus: 'PENDING' as const,
          cnameTarget: 'cname.shipper.now',
          txtName: '_shipper-verify.demo.example.com',
          txtValue: 'shipper-verify-xyz789',
          verificationErrors: null,
          createdAt: new Date().toISOString(),
          verifiedAt: null,
          lastCheckedAt: new Date().toISOString(),
        },
      ],
    };
  }
  
  // Real API call for production
  // ... existing code
}
```

**Remember to remove mock data before committing!**

---

## What to Focus On During Local Testing

### 1. UI/UX Flow
- Is the workflow intuitive?
- Are instructions clear?
- Do all buttons work?
- Are loading states visible?
- Are error messages helpful?

### 2. Visual Design
- Do status badges look correct?
- Is the layout responsive?
- Do colors match the design system?
- Are icons properly aligned?
- Does it work on mobile?

### 3. Integration
- Does domain appear in header?
- Does domain appear in deployment settings?
- Does primary domain update deployment URL?
- Do toast notifications appear?

### 4. Edge Cases
- What happens with invalid domain names?
- What happens with very long domain names?
- What happens when API fails?
- What happens with no domains?
- What happens with many domains?

---

## Summary

**For UI Testing** (Recommended):
- Just run `pnpm dev:web`
- Test all UI components and interactions
- Use mock domains like `test.example.com`
- Focus on visual feedback and user experience

**For Full Flow Testing** (Optional):
- Use ngrok to get a public URL
- Use a free subdomain service
- Add real DNS records
- Test complete verification flow

**Most Important**:
- Test that all UI components render correctly
- Test that user interactions work smoothly
- Test that error states are handled gracefully
- Test that success states show appropriate feedback

You don't need real DNS to verify that the domain workflow UI is working correctly!
