# Custom Domain Testing Guide

This guide walks you through testing the complete custom domain workflow in Shipper.

## Prerequisites

Before testing, you'll need:

1. **A domain you own** (or can configure DNS for)
   - Can be a real domain from any registrar (GoDaddy, Namecheap, Cloudflare, etc.)
   - Or use a test domain if you have access to one

2. **Access to your domain's DNS settings**
   - You'll need to add CNAME and TXT records

3. **A deployed Shipper project**
   - Create a project and ensure it's deployed
   - Note the project's shipper.now subdomain

## Testing Workflow

### Step 1: Navigate to Domain Settings

1. Open your project in Shipper
2. Click the **Settings** icon in the sidebar
3. Select the **Domains** tab
4. You should see the domain management interface

**What to verify:**
- ✅ Domains tab is visible in settings
- ✅ Empty state shows if no domains connected
- ✅ "Connect Domain" or "Buy Domain" options are available

---

### Step 2: Connect a Custom Domain

1. Click **"Connect Domain"** button
2. Enter your domain name (e.g., `myapp.example.com` or `example.com`)
3. Click **"Connect"**

**What to verify:**
- ✅ Domain is added to the list with **"Pending"** status
- ✅ Yellow badge shows "Pending Validation"
- ✅ DNS instructions appear below the domain

---

### Step 3: Review DNS Instructions

The interface should show:

1. **Registrar selector tabs** (Cloudflare, GoDaddy, Namecheap, etc.)
2. **Two DNS records to add:**
   - **CNAME record**: Points your domain to Shipper's servers
   - **TXT record**: Proves you own the domain

**What to verify:**
- ✅ Both CNAME and TXT records are displayed
- ✅ Copy buttons work for each field
- ✅ Registrar-specific field names are shown (e.g., "Host" vs "Name")
- ✅ Explanation text clarifies why both records are needed

---

### Step 4: Add DNS Records

1. Open your domain registrar's DNS management panel
2. Add the **CNAME record**:
   - Type: `CNAME`
   - Name/Host: `@` (or your subdomain)
   - Value/Target: (copy from Shipper interface)
   - TTL: Automatic or 3600

3. Add the **TXT record**:
   - Type: `TXT`
   - Name/Host: (copy from Shipper interface)
   - Value: (copy from Shipper interface)
   - TTL: Automatic or 3600

4. Save your DNS changes

**Important Notes:**
- DNS propagation can take 5 minutes to 48 hours
- Most registrars propagate within 5-15 minutes
- You can check DNS propagation at: https://dnschecker.org

---

### Step 5: Check Domain Status

Back in Shipper:

1. Click the **"Check Status"** button (refresh icon)
2. Wait for the status check to complete

**What to verify:**
- ✅ Loading spinner appears during check
- ✅ Status updates automatically
- ✅ Auto-polling checks every 30 seconds for pending domains

**Possible outcomes:**

#### ✅ Success - Domain Active
- Green badge shows **"Active"**
- Success banner appears with:
  - ✓ Confirmation message
  - Direct link to your custom domain
  - SSL status indicator
  - **"Test Domain"** button
- Toast notification confirms activation

#### ⏳ Still Pending
- Yellow badge remains **"Pending"**
- DNS records may still be propagating
- Wait a few minutes and check again

#### ❌ Failed
- Red badge shows **"Failed"**
- Error message explains the issue
- Collapsible troubleshooting steps appear
- **"Retry Configuration"** button available

---

### Step 6: Set as Primary Domain

If you have multiple domains:

1. Find the domain you want to use as primary
2. Click **"Use this domain for this project"** button
3. Confirm the action

**What to verify:**
- ✅ Purple "Primary" badge appears on the domain
- ✅ Other domains lose the primary badge
- ✅ Toast notification confirms the change
- ✅ Project deployment URL updates automatically

---

### Step 7: Verify Integration Points

#### A. Project Header
- ✅ Custom domain indicator appears in header (desktop only)
- ✅ Shows globe icon + domain name
- ✅ Clicking opens domain in new tab
- ✅ Purple styling distinguishes it from other elements

#### B. Deployment Settings Tab
1. Go to Settings → Deployment
2. Scroll to "Your app's web address" section

**What to verify:**
- ✅ Custom domains section appears below subdomain input
- ✅ Shows all connected domains with status badges
- ✅ Primary domain is highlighted
- ✅ Quick test button for active domains
- ✅ Helpful message about primary domain usage

#### C. Domain List
- ✅ All domains show correct status
- ✅ Primary domain clearly marked
- ✅ Active domains have test button
- ✅ Failed domains show troubleshooting

---

### Step 8: Test the Custom Domain

1. Click the **"Test Domain"** button
2. Or manually visit `https://yourdomain.com`

**What to verify:**
- ✅ Domain loads your Shipper project
- ✅ SSL certificate is valid (🔒 in browser)
- ✅ All assets load correctly
- ✅ No mixed content warnings
- ✅ App functions normally

---

### Step 9: Test Multiple Domains (Optional)

1. Connect a second domain
2. Follow steps 2-5 for the new domain
3. Set one as primary

**What to verify:**
- ✅ Both domains work independently
- ✅ Only one can be primary at a time
- ✅ Setting new primary updates deployment URL
- ✅ Both domains serve the same content

---

### Step 10: Delete a Domain (Optional)

1. Click the trash icon on a domain
2. Confirm deletion

**What to verify:**
- ✅ Confirmation dialog appears
- ✅ Domain is removed from list
- ✅ If primary domain deleted, deployment URL reverts to shipper.now

---

## Edge Cases to Test

### 1. DNS Not Configured
- Connect domain but don't add DNS records
- Check status after 5 minutes
- Should show "Failed" with helpful error

### 2. Incorrect DNS Records
- Add CNAME but wrong TXT value
- Should fail with specific error about TXT validation

### 3. Domain Already in Use
- Try connecting a domain already used by another project
- Should show error message

### 4. Subdomain vs Root Domain
- Test both `example.com` and `app.example.com`
- Both should work with appropriate DNS setup

### 5. Auto-Polling
- Connect domain, add DNS records
- Don't click "Check Status"
- Verify it auto-updates within 30 seconds

### 6. Mobile View
- Test on mobile device
- Domain indicator should be hidden in header
- Domain settings should be fully functional

---

## Troubleshooting Common Issues

### Domain Shows "Pending" Forever

**Possible causes:**
1. DNS records not added correctly
2. DNS not propagated yet
3. Wrong CNAME or TXT values

**How to fix:**
1. Verify DNS records at https://dnschecker.org
2. Check for typos in record values
3. Wait 24 hours for full propagation
4. Click "Retry Configuration"

### Domain Shows "Failed"

**Check the error message:**
- Expand troubleshooting steps
- Follow the specific guidance
- Verify both CNAME and TXT records exist
- Ensure no conflicting A/AAAA records

### SSL Certificate Issues

**If you see SSL warnings:**
1. Wait 5-10 minutes for certificate provisioning
2. Check SSL status badge (should show "SSL Active")
3. Try in incognito mode (clear cache)
4. Contact support if persists after 1 hour

### Domain Works But Shows Old Content

**Cache issue:**
1. Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
2. Clear browser cache
3. Try incognito/private mode
4. Check if deployment is actually updated

---

## Success Criteria

Your domain workflow is working correctly if:

- ✅ Can connect custom domain
- ✅ DNS instructions are clear and accurate
- ✅ Status updates automatically (polling)
- ✅ Active domains show success banner
- ✅ Can set primary domain
- ✅ Deployment URL updates when primary changes
- ✅ Domain appears in project header
- ✅ Domain shows in deployment settings
- ✅ Test button opens domain in new tab
- ✅ SSL certificate is active
- ✅ Failed domains show troubleshooting
- ✅ Can delete domains
- ✅ Toast notifications work
- ✅ All UI elements are responsive

---

## Quick Test Checklist

Use this for rapid testing:

- [ ] Connect domain → shows pending
- [ ] Add DNS records
- [ ] Check status → becomes active
- [ ] Success banner appears
- [ ] Set as primary → deployment URL updates
- [ ] Domain shows in header
- [ ] Domain shows in deployment settings
- [ ] Test button works
- [ ] SSL is active
- [ ] Visit domain → app loads
- [ ] Delete domain → removed from list

---

## Demo Mode (For Testing Without Real Domain)

If you don't have a domain to test with, you can:

1. **Use localhost testing** (requires local DNS override)
2. **Use a free subdomain service** like:
   - FreeDNS (https://freedns.afraid.org)
   - No-IP (https://www.noip.com)
3. **Request a test domain** from your team

---

## Reporting Issues

If you find bugs, please report:

1. **What you were doing** (step-by-step)
2. **What you expected** to happen
3. **What actually happened**
4. **Screenshots** of the issue
5. **Browser console errors** (F12 → Console tab)
6. **Domain name** (if not sensitive)
7. **DNS records** you added

---

## Additional Resources

- **DNS Checker**: https://dnschecker.org
- **Cloudflare SaaS Docs**: https://developers.cloudflare.com/cloudflare-for-platforms/
- **Shipper Domain Docs**: See `CLOUDFLARE_SAAS_SETUP.md`
- **Troubleshooting**: See `DOMAIN_WORKFLOW_ANALYSIS.md`
