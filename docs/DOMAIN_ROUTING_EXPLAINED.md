# Domain Routing Explained

## How Custom Domains Work

### Overview
When a user connects a custom domain (e.g., `myapp.com`) to their Shipper project, the following flow happens:

```
User visits myapp.com
    ↓
DNS resolves to Cloudflare (via CNAME)
    ↓
Cloudflare for SaaS proxies to shipper.now
    ↓
Cloudflare Worker looks up domain in database
    ↓
Worker proxies to project's deployment URL
    ↓
User sees their project at myapp.com
```

### DNS Configuration

Users must add two DNS records:

1. **CNAME Record** (for routing)
   - Name: `@` (or domain root)
   - Target: `cname.shipper.now`
   - Purpose: Routes traffic through Cloudflare

2. **TXT Record** (for ownership verification)
   - Name: `_cf-custom-hostname.myapp.com`
   - Value: Unique verification token
   - Purpose: Proves domain ownership to Cloudflare

### Domain Identification

**Q: How do we know which domain belongs to which user if they all use the same CNAME?**

**A:** The identification happens at the Cloudflare Worker level:

1. **CNAME is the same for all domains** (`cname.shipper.now`)
   - This is just the routing target
   - All custom domains point here

2. **Worker identifies the domain by hostname**
   - When a request comes in, the worker reads `request.hostname`
   - Example: User visits `myapp.com` → hostname is `myapp.com`

3. **Database lookup**
   - Worker calls `/api/v1/domains/lookup?domain=myapp.com`
   - API queries database for domain `myapp.com`
   - Returns associated project info

4. **Routing to project**
   - Worker proxies request to project's `deploymentUrl`
   - User sees their project content

### Example Flow

```javascript
// 1. User visits myapp.com
const hostname = request.hostname // "myapp.com"

// 2. Worker looks up domain
const domainInfo = await lookupDomain("myapp.com")
// Returns: { project: { id: "abc123", deploymentUrl: "project-abc123.shipper.now" } }

// 3. Worker proxies to deployment
const targetUrl = `https://project-abc123.shipper.now${request.pathname}`
return fetch(targetUrl)
```

### SSL/TLS Certificates

**Q: How does SSL verification work?**

**A:** Cloudflare handles SSL automatically:

1. User adds CNAME + TXT records
2. Cloudflare verifies ownership via TXT record
3. Cloudflare automatically provisions SSL certificate
4. Certificate is issued within minutes
5. Domain status updates: `PENDING` → `ACTIVE`

No manual SSL configuration needed!

### Deployment States

#### 1. Domain Connected, Not Deployed
- Domain is in database with `isPrimary: true`
- Project has no `deploymentUrl`
- Worker shows "Coming Soon" placeholder page
- User sees: "This project is being prepared for launch"

#### 2. Domain Connected, Deployed
- Domain is in database with `isPrimary: true`
- Project has `deploymentUrl`
- Worker proxies to actual deployment
- User sees their live project

#### 3. Domain Not Connected
- Domain not in database
- Worker shows "Domain Not Found" error
- User sees: "This domain is not connected to any project"

### Database Schema

```prisma
model CustomDomain {
  id                   String
  projectId            String
  domain               String        @unique
  isPrimary            Boolean       @default(false)
  status               DomainStatus  // PENDING_VALIDATION, ACTIVE, FAILED
  sslStatus            DomainSSLStatus // PENDING, ACTIVE, FAILED
  cloudflareHostnameId String?
  cnameTarget          String?       // "cname.shipper.now"
  txtName              String?       // "_cf-custom-hostname.domain.com"
  txtValue             String?       // Verification token
  verificationErrors   Json?
  createdAt            DateTime
  verifiedAt           DateTime?
}
```

### Deletion Flow

When a user deletes a domain:

1. **Frontend** calls `/api/domains/:domainId` (DELETE)
2. **Backend** deletes from Cloudflare:
   ```typescript
   await cloudflare.deleteCustomHostname(domain.cloudflareHostnameId)
   ```
3. **Backend** deletes from database:
   ```typescript
   await prisma.customDomain.delete({ where: { id: domainId } })
   ```
4. **Result**: Domain is removed from both Cloudflare and database
5. **Effect**: Domain no longer routes to project (shows "Domain Not Found")

### Security

- **API Key Authentication**: Worker authenticates with backend using `WORKER_API_KEY`
- **Domain Ownership**: TXT record proves user owns the domain
- **SSL/TLS**: All traffic is encrypted via Cloudflare SSL
- **Isolation**: Each project's deployment is isolated

### Troubleshooting

#### Domain shows "Domain Not Found"
- Check if domain is in database
- Verify `isPrimary: true` for the domain
- Check domain status is `ACTIVE`

#### Domain shows "Coming Soon"
- Project hasn't been deployed yet
- Check if project has `deploymentUrl` set
- Deploy the project to fix

#### SSL not working
- Wait 5-10 minutes for certificate provisioning
- Check `sslStatus` in database
- Verify TXT record is correct

### Performance

- **Caching**: Domain lookups are cached for 60 seconds
- **Edge Computing**: Worker runs at Cloudflare edge (low latency)
- **Global**: Works worldwide via Cloudflare's global network
