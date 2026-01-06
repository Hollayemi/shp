# Domain Workflow Analysis - UI/UX Gaps

## Current Implementation Status

### ✅ What's Working
1. **Settings Tab Integration** - Domains tab added to Settings
2. **Domain Connection** - Users can connect custom domains
3. **Domain Purchase** - Entri integration for buying domains
4. **DNS Instructions** - Clear, registrar-specific DNS setup guide
5. **Status Checking** - Refresh button to check domain status
6. **Domain List** - Shows all connected domains with status badges
7. **Primary Domain** - Users can set a primary domain
8. **Domain Deletion** - Remove domains with confirmation
9. **Auto-sync Deployment URL** - Deployment URL updates when domain becomes active (using TRPC)
10. **Auto-polling** - Pending domains checked every 30 seconds
11. **Test Domain Button** - Quick link to test active domains
12. **Error Recovery** - Collapsible troubleshooting steps with retry button
13. **Success Banners** - Enhanced feedback when domain becomes active
14. **Toast Notifications** - User-friendly notifications for domain actions
15. **Deployment Integration** - Custom domains shown in DeploymentSettingsTab
16. **Project Header Indicator** - Primary domain displayed in project header with quick link

### ❌ Critical Missing UI/UX Elements

## 1. **Deployment URL Not Updated When Domain Becomes Active**

**Problem**: When a custom domain becomes ACTIVE, the project's `deploymentUrl` field doesn't automatically update to use the custom domain.

**Current State**:
- Project has `deploymentUrl: "https://myapp.shipper.now"`
- User connects `customdomain.com` → becomes ACTIVE
- `deploymentUrl` still shows `myapp.shipper.now`

**What's Needed**:
```typescript
// In DomainList.tsx or domain status check
if (domain.status === 'ACTIVE' && domain.isPrimary) {
  // Update project.deploymentUrl to use custom domain
  await updateProjectDeploymentUrl(projectId, `https://${domain.domain}`);
}
```

**UI Impact**:
- Preview URL in project header should show custom domain
- Share links should use custom domain
- Deployment settings should reflect custom domain

---

## 2. **No Visual Indicator in Project Header**

**Problem**: Users can't see their custom domain in the main project view.

**What's Needed**:
- Badge or indicator in project header showing custom domain
- Quick link to open custom domain
- Visual distinction between shipper.now subdomain and custom domain

**Suggested UI**:
```tsx
{project.customDomain && (
  <div className="flex items-center gap-2">
    <Globe className="h-4 w-4" />
    <a href={`https://${project.customDomain}`} target="_blank">
      {project.customDomain}
    </a>
    <Badge>Custom</Badge>
  </div>
)}
```

---

## 3. **No Deployment Status for Custom Domains**

**Problem**: Users don't know if their app is actually deployed and accessible via the custom domain.

**What's Needed**:
- "Test Domain" button to verify the domain is serving content
- Health check indicator showing if domain is reachable
- SSL certificate status (separate from DNS validation)

**Suggested UI**:
```tsx
<Button onClick={() => window.open(`https://${domain.domain}`, '_blank')}>
  <ExternalLink className="h-4 w-4 mr-2" />
  Test Domain
</Button>
```

---

## 4. **No Guidance for "What's Next" After Domain is Active**

**Problem**: Domain shows as ACTIVE, but users don't know:
- Is my app deployed there?
- Do I need to redeploy?
- Is SSL working?

**What's Needed**:
- Success message with next steps
- Automatic deployment trigger when domain becomes active
- Clear indication of what "ACTIVE" means

**Suggested UI**:
```tsx
{domain.status === 'ACTIVE' && (
  <div className="success-banner">
    <h4>✓ Domain is Active!</h4>
    <p>Your domain is configured. Your app is now accessible at:</p>
    <a href={`https://${domain.domain}`}>{domain.domain}</a>
    <p className="text-xs">SSL certificate: {domain.sslStatus}</p>
  </div>
)}
```

---

## 5. **No Handling of Multiple Domains**

**Problem**: Users can connect multiple domains, but:
- No clear indication which one is "primary"
- No explanation of what "primary" means
- No automatic redirect from secondary domains to primary

**What's Needed**:
- Clear explanation: "Primary domain is used for sharing and previews"
- Visual hierarchy showing primary vs secondary domains
- Option to redirect secondary domains to primary

---

## 6. **No Error Recovery Guidance**

**Problem**: When domain status is FAILED, users don't know how to fix it.

**What's Needed**:
- Specific error messages (not just "FAILED")
- Troubleshooting steps based on error type
- "Try Again" or "Reconfigure" button

**Suggested UI**:
```tsx
{domain.status === 'FAILED' && (
  <div className="error-panel">
    <h4>Domain Configuration Failed</h4>
    <p>{domain.errorMessage}</p>
    <details>
      <summary>Troubleshooting Steps</summary>
      <ol>
        <li>Verify DNS records are correct</li>
        <li>Wait 24 hours for DNS propagation</li>
        <li>Check domain registrar settings</li>
      </ol>
    </details>
    <Button onClick={() => handleRetry(domain.id)}>
      Retry Configuration
    </Button>
  </div>
)}
```

---

## 7. **No Integration with Deployment Flow**

**Problem**: Deployment settings don't show custom domains.

**What's Needed in DeploymentSettingsTab**:
- Show connected custom domains
- Option to deploy to custom domain
- Indicate which URL will be used for deployment

**Suggested Addition**:
```tsx
// In DeploymentSettingsTab.tsx
{customDomains.length > 0 && (
  <div className="custom-domains-section">
    <h4>Custom Domains</h4>
    {customDomains.map(domain => (
      <div key={domain.id}>
        <span>{domain.domain}</span>
        {domain.isPrimary && <Badge>Primary</Badge>}
        {domain.status === 'ACTIVE' && <Badge>Active</Badge>}
      </div>
    ))}
  </div>
)}
```

---

## 8. **No Loading States During DNS Propagation**

**Problem**: Users click "Check Status" and nothing happens for several seconds.

**What's Needed**:
- Loading spinner during status check
- Progress indicator showing what's being checked
- Estimated time remaining

---

## 9. **No Notification When Domain Becomes Active**

**Problem**: Users have to manually refresh to see when domain is ready.

**What's Needed**:
- Polling mechanism to auto-check status every 30 seconds
- Toast notification when domain becomes ACTIVE
- Email notification (optional)

**Suggested Implementation**:
```typescript
useEffect(() => {
  if (domain.status === 'PENDING_VALIDATION') {
    const interval = setInterval(() => {
      checkDomainStatus(domain.id);
    }, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }
}, [domain.status]);
```

---

## 10. **No Preview/Share URL Update**

**Problem**: When sharing project, users still get shipper.now URL even with custom domain.

**What's Needed**:
- Update all share URLs to use custom domain if active
- Update preview iframe URL
- Update any generated links

---

## Implementation Priority

### ✅ Completed (feat/new-feature branch)
1. ✅ Update deploymentUrl when domain becomes active - **DONE** (refactored with TRPC client)
2. ✅ Test domain button - **DONE** (already implemented)
3. ✅ Error recovery guidance - **DONE** (collapsible troubleshooting)
4. ✅ Loading states - **DONE** (already implemented)
5. ✅ Visual indicator in project header - **DONE** (shows primary domain with link)
6. ✅ Auto-polling for status updates - **DONE** (30-second intervals)
7. ✅ Integration with deployment flow - **DONE** (DeploymentSettingsTab shows domains)
8. ✅ Multiple domain handling - **DONE** (primary badge, status indicators)
9. ✅ Toast notifications - **DONE** (using sonner for better UX)

### 🟢 Future Enhancements (Nice to Have)
- Email notifications when domain becomes active
- Advanced troubleshooting tools
- Automatic redirect from secondary domains to primary
- Domain analytics and usage tracking

---

## Database Schema Considerations

**Current Schema**:
```prisma
model CustomDomain {
  id String @id
  domain String
  projectId String
  status DomainStatus
  sslStatus SSLStatus
  isPrimary Boolean
  // ...
}

model Project {
  deploymentUrl String?
  customDomains CustomDomain[]
  // ...
}
```

**Potential Issues**:
- `deploymentUrl` is a single string, but project can have multiple domains
- No automatic sync between `isPrimary` domain and `deploymentUrl`
- No field to track "last successful deployment to custom domain"

**Suggested Schema Updates**:
```prisma
model Project {
  deploymentUrl String? // Keep for backward compatibility
  primaryDomainId String? // Reference to primary custom domain
  lastDeployedToDomain String? // Track which domain was last deployed to
  // ...
}
```

---

## Testing Checklist

### Core Functionality
- [ ] Connect domain → shows pending status
- [ ] Add DNS records → status updates to active
- [ ] Set as primary → deploymentUrl updates (via TRPC)
- [ ] Deploy app → accessible via custom domain
- [ ] SSL certificate → shows as active
- [ ] Multiple domains → primary is clearly marked
- [ ] Delete domain → removes from list
- [ ] Failed domain → shows error message with troubleshooting
- [ ] Refresh status → updates in real-time
- [ ] Test domain button → opens in new tab

### UI/UX Integration
- [ ] Project header → shows primary domain with clickable link
- [ ] DeploymentSettingsTab → displays all custom domains with status
- [ ] Toast notifications → appear for domain actions (set primary, activation)
- [ ] Auto-polling → pending domains checked every 30 seconds
- [ ] Success banner → shows when domain becomes active with SSL status
- [ ] Error recovery → retry button works for failed configurations
- [ ] Cache invalidation → project query updates when deployment URL changes

### Edge Cases
- [ ] No custom domains → appropriate empty state
- [ ] Domain becomes active while user is on page → auto-updates
- [ ] Multiple domains → only primary shown in header
- [ ] Mobile view → domain indicator hidden in header (space optimization)
- [ ] Network errors → graceful error handling with toast messages

