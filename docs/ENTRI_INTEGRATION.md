# Entri Domain Purchasing Integration

This document describes the integration of Entri's domain purchasing feature into the Shipper web app.

## Overview

Entri Sell allows users to purchase and connect custom domains (e.g., mycompany.com) directly from within the app. We've chosen **Ionos** as the domain registrar.

## Features

- **Domain Search & Purchase**: Users can search for available domains and purchase them through Ionos
- **Debug Mode**: Test the flow without making actual purchases (requires a previously purchased Ionos domain)
- **Custom Branding**: The Entri modal uses our brand colors (#0D9488 - teal)
- **Seamless Integration**: Integrated into the Settings modal under the "Domains" tab

## Setup

### 1. Get Entri Application ID

1. Sign up at [Entri](https://www.entri.com/)
2. Create a new application
3. Get your Application ID from the dashboard

### 2. Configure Environment Variables

Add your Entri Application ID to `.env`:

```bash
NEXT_PUBLIC_ENTRI_APP_ID="your_entri_application_id_here"
```

### 3. Testing with Debug Mode

To test the domain purchase flow without actually buying domains:

1. Purchase a test domain through Ionos (one-time setup)
2. Debug mode is automatically enabled in development (`NODE_ENV === "development"`)
3. The Entri SDK will simulate purchases using your test domain

From Entri's documentation:
> In order to test the Sell flow without purchasing numerous domains, you can apply the following parameter to the global entri variable: "debugMode": true. This will allow you to avoid purchasing unnecessary domains while testing it. Keep in mind that you have to use a domain that was previously purchased via Ionos to use the DebugMode.

## Usage

### Accessing the Feature

1. Open any project
2. Click the Settings button
3. Navigate to the "Domains" tab
4. Click "Buy Custom Domain"

### User Flow

1. User clicks "Buy Custom Domain"
2. Entri modal opens with domain search
3. User searches for available domains
4. User selects a domain and completes purchase through Ionos
5. On success, the domain is associated with the project
6. User can then connect the domain to their deployment

## Implementation Details

### Components

- **DomainSettingsTab**: Main component for domain management
  - Location: `apps/web/src/modules/projects/ui/components/DomainSettingsTab.tsx`
  - Handles Entri SDK initialization and configuration
  - Displays current deployment URL and connected domains

### Configuration

The Entri SDK is configured with:

```typescript
{
  applicationId: process.env.NEXT_PUBLIC_ENTRI_APP_ID,
  registrar: "ionos",
  debugMode: process.env.NODE_ENV === "development",
  branding: {
    primaryColor: "#0D9488", // Shipper brand teal
    buttonText: "Buy Domain",
  },
  onSuccess: (data) => {
    // Handle successful domain purchase
    // TODO: Save domain to database
  },
  onError: (error) => {
    // Handle purchase errors
  },
  onClose: () => {
    // Handle modal close
  }
}
```

### Type Definitions

TypeScript definitions for the Entri SDK are located at:
- `apps/web/src/types/entri.d.ts`

## Next Steps

### Backend Integration (TODO)

1. **Database Schema**: Add a `domains` table to store purchased domains
   ```sql
   CREATE TABLE domains (
     id TEXT PRIMARY KEY,
     project_id TEXT NOT NULL,
     domain TEXT NOT NULL,
     registrar TEXT NOT NULL,
     order_id TEXT,
     status TEXT NOT NULL,
     purchased_at TIMESTAMP NOT NULL,
     FOREIGN KEY (project_id) REFERENCES projects(id)
   );
   ```

2. **API Endpoints**: Create endpoints to:
   - Save purchased domains
   - List domains for a project
   - Connect/disconnect domains from deployments
   - Verify domain ownership

3. **DNS Configuration**: Implement DNS record management
   - Add CNAME records pointing to deployment URL
   - Verify DNS propagation
   - Handle SSL certificate provisioning

4. **Domain Connection**: Update deployment configuration
   - Configure custom domain in hosting platform (Vercel/etc.)
   - Update project metadata with custom domain
   - Handle domain verification

### UI Enhancements (TODO)

1. **Domain List**: Display connected domains with status indicators
2. **Domain Management**: Add/remove/configure domains
3. **DNS Instructions**: Show users how to configure DNS if needed
4. **Status Monitoring**: Display domain connection status and SSL status

## Resources

- [Entri Documentation](https://docs.entri.com/)
- [Entri Sell Guide](https://docs.entri.com/sell)
- [Ionos Domain API](https://www.ionos.com/help/domains/)

## Support

For issues with:
- **Entri SDK**: Contact Entri support or check their documentation
- **Domain purchases**: Contact Ionos support
- **Integration issues**: Check the browser console for errors and verify environment variables
