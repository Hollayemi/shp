# Cloudflare for SaaS Setup Guide

This guide will help you set up Cloudflare for SaaS to enable custom domains for your Shipper projects.

## What We Built

✅ **Backend (Complete)**
- Database schema for custom domains
- Cloudflare API integration service
- REST API endpoints for domain management
- Domain verification and status checking

✅ **Frontend (Complete)**
- Domain connection UI in Settings → Domains tab
- Domain list with status badges
- DNS instructions display
- Real-time status refresh

## Prerequisites

1. **Cloudflare Account** with a domain
2. **Cloudflare for SaaS** enabled (requires Enterprise plan or contact Cloudflare sales)
3. **Deployment Plane** - Where your projects are hosted

## Setup Steps

### 1. Enable Cloudflare for SaaS

1. Log in to your Cloudflare dashboard
2. Select your zone (domain)
3. Go to **SSL/TLS** → **Custom Hostnames**
4. Enable Cloudflare for SaaS
5. Set your **Fallback Origin** (where projects are deployed)

### 2. Get API Credentials

1. Go to **My Profile** → **API Tokens**
2. Create a new token with these permissions:
   - Zone - SSL and Certificates - Edit
   - Zone - Custom Hostnames - Edit
3. Copy the API token

### 3. Get Zone and Account IDs

1. In your Cloudflare dashboard, select your zone
2. Scroll down on the Overview page
3. Copy your **Zone ID** and **Account ID**

### 4. Configure Environment Variables

Add these to your `.env` file:

```bash
# Cloudflare for SaaS (Custom Domains)
CLOUDFLARE_API_TOKEN="your_api_token_here"
CLOUDFLARE_ZONE_ID="your_zone_id_here"
CLOUDFLARE_ACCOUNT_ID="your_account_id_here"
CLOUDFLARE_FALLBACK_ORIGIN="your-deployment-domain.com"
```

### 5. Set Fallback Origin

The fallback origin is where Cloudflare will proxy requests to. This should be:
- Your deployment plane domain (e.g., `apps.shipper.com`)
- Or your Vercel/Netlify domain
- Or wherever your projects are deployed

**Example:**
```bash
CLOUDFLARE_FALLBACK_ORIGIN="apps.shipper.com"
```

### 6. Configure Fallback Origin in Cloudflare

1. Go to **SSL/TLS** → **Custom Hostnames**
2. Click **Fallback Origin**
3. Enter your deployment domain
4. Save

## How It Works

### User Flow

1. **User connects domain**
   - User enters `example.com` in Settings → Domains
   - Backend creates custom hostname in Cloudflare
   - User receives DNS instructions

2. **User configures DNS**
   - User adds CNAME record to their DNS provider:
     ```
     Type: CNAME
     Name: @
     Value: [provided by Cloudflare]
     ```

3. **Verification**
   - Cloudflare automatically verifies DNS
   - SSL certificate is provisioned
   - Domain becomes active (usually within minutes to 24 hours)

4. **Traffic Flow**
   ```
   User's Domain (example.com)
       ↓ CNAME points to
   Cloudflare Custom Hostname
       ↓ Proxies to
   Fallback Origin (apps.shipper.com)
       ↓ Routes to
   User's Project
   ```

## API Endpoints

### Create Custom Domain
```bash
POST /api/v1/domains
Content-Type: application/json
x-api-key: your_api_key

{
  "projectId": "project_123",
  "domain": "example.com"
}
```

### List Domains
```bash
GET /api/v1/domains/:projectId
x-api-key: your_api_key
```

### Check Status
```bash
GET /api/v1/domains/status/:domainId
x-api-key: your_api_key
```

### Delete Domain
```bash
DELETE /api/v1/domains/:domainId
x-api-key: your_api_key
```

## Testing

### 1. Start the servers
```bash
pnpm dev
```

### 2. Open a project
Navigate to any project and go to Settings → Domains

### 3. Connect a test domain
- Enter a domain you own
- Click "Connect Domain"
- You should see DNS instructions

### 4. Configure DNS
Add the CNAME record to your DNS provider

### 5. Wait for verification
- Click the refresh button to check status
- Status will change from "Pending" to "Active" once verified

## Troubleshooting

### "Missing Cloudflare configuration" error
- Make sure all environment variables are set
- Restart the API server after adding env vars

### Domain shows "Failed" status
- Check DNS configuration is correct
- Verify CNAME record is pointing to the right target
- Check Cloudflare dashboard for specific errors

### SSL shows "Pending" for too long
- SSL provisioning can take up to 24 hours
- Check Cloudflare dashboard for SSL status
- Ensure domain is verified first

### Domain not routing to project
- Verify fallback origin is configured correctly
- Check that your deployment plane is accessible
- Ensure project has a valid deployment URL

## Database Schema

```prisma
model CustomDomain {
  id                    String    @id @default(cuid())
  projectId             String
  domain                String    @unique
  cloudflareHostnameId  String?
  status                DomainStatus
  sslStatus             DomainSSLStatus
  cnameTarget           String?
  verificationErrors    Json?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  verifiedAt            DateTime?
  lastCheckedAt         DateTime?
  
  project               Project   @relation(fields: [projectId], references: [id])
}

enum DomainStatus {
  PENDING_VALIDATION
  ACTIVE
  FAILED
  DELETED
}

enum DomainSSLStatus {
  PENDING
  ACTIVE
  FAILED
}
```

## Next Steps

### Production Deployment

1. **Set up Cloudflare for SaaS** in production account
2. **Configure environment variables** in production
3. **Test with a real domain** before going live
4. **Monitor domain verification** rates and errors

### Future Enhancements

- [ ] Webhook handler for Cloudflare status updates
- [ ] Automatic DNS verification polling
- [ ] Support for apex domains (A records)
- [ ] Support for wildcard domains
- [ ] Domain transfer support
- [ ] Custom SSL certificate upload
- [ ] Domain analytics and metrics

## Resources

- [Cloudflare for SaaS Documentation](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/)
- [Custom Hostnames API](https://developers.cloudflare.com/api/operations/custom-hostnames-for-a-zone-create-custom-hostname)
- [SSL for SaaS](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/security/certificate-management/)

## Support

For issues:
1. Check Cloudflare dashboard for errors
2. Review API logs in the backend
3. Check browser console for frontend errors
4. Verify all environment variables are set correctly
