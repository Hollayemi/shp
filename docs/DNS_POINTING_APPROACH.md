# DNS Pointing Approach for Custom Domains

## Overview
Instead of using Cloudflare for SaaS (enterprise feature), we use a simpler DNS pointing approach where users configure their DNS records to point to our servers.

## How It Works

### Traditional Approach (Cloudflare for SaaS)
```
User adds domain → API tells Cloudflare → Cloudflare auto-provisions SSL
❌ Requires paid enterprise feature
```

### DNS Pointing Approach
```
User adds domain → Show DNS instructions → User updates DNS → Verify → Done
✅ Works with free tier
✅ User has full control
✅ No vendor lock-in
```

## Implementation

### 1. User Flow

1. **User enters domain:** `store.theirdomain.com`
2. **We show DNS instructions:**
   ```
   Add this CNAME record at your DNS provider:
   
   Type: CNAME
   Name: store
   Value: app.shipper.now
   TTL: 3600
   ```
3. **User configures DNS** at their registrar (GoDaddy, Namecheap, etc.)
4. **User clicks "Verify"**
5. **We check DNS** to confirm it's pointing to us
6. **Domain is active!**

### 2. DNS Records

Users can use either:

**Option A: CNAME Record** (Recommended for subdomains)
```
Type: CNAME
Name: store
Value: app.shipper.now
```

**Option B: A Record** (For apex domains)
```
Type: A
Name: @
Value: 192.0.2.1  # Your server IP
```

### 3. DNS Verification

```typescript
import dns from 'dns/promises';

async function verifyDomain(customDomain: string, targetHost: string) {
  try {
    // Check CNAME
    const cnameRecords = await dns.resolveCname(customDomain);
    if (cnameRecords.includes(targetHost)) {
      return { verified: true, type: 'CNAME' };
    }
  } catch (error) {
    // CNAME not found, try A record
  }

  try {
    // Check A record
    const aRecords = await dns.resolve4(customDomain);
    const targetIPs = await dns.resolve4(targetHost);
    
    if (aRecords.some(ip => targetIPs.includes(ip))) {
      return { verified: true, type: 'A' };
    }
  } catch (error) {
    return { 
      verified: false, 
      error: 'DNS not configured or not propagated yet' 
    };
  }

  return { verified: false, error: 'Domain not pointing to our servers' };
}
```

### 4. SSL Certificates

**Option 1: Let's Encrypt (Recommended)**
- Free, automated SSL certificates
- Use Certbot or similar tools
- Auto-renews every 90 days

**Option 2: Cloudflare Proxy (Free)**
- User adds domain to Cloudflare (free account)
- Cloudflare provides SSL
- Proxies traffic through their network

**Option 3: Wildcard Certificate**
- Only works for subdomains: `*.shipper.now`
- Users get: `user1.shipper.now`, `user2.shipper.now`
- Single cert covers all users

### 5. Web Server Configuration

Your web server needs to recognize custom domains:

**Nginx Example:**
```nginx
server {
    listen 443 ssl;
    server_name ~^(?<subdomain>.+)\.shipper\.now$ ~^(?<custom>.+)$;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        # Route based on domain
        proxy_pass http://backend;
        proxy_set_header Host $host;
    }
}
```

**Node.js/Express Example:**
```javascript
app.use((req, res, next) => {
  const hostname = req.hostname;
  
  // Look up which project this domain belongs to
  const project = await getProjectByDomain(hostname);
  
  if (project) {
    req.project = project;
    next();
  } else {
    res.status(404).send('Domain not found');
  }
});
```

## Database Schema

```sql
CREATE TABLE custom_domains (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  domain TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL, -- 'pending', 'verified', 'active', 'failed'
  dns_type TEXT, -- 'CNAME' or 'A'
  verified_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);
```

## API Endpoints

### Add Domain
```typescript
POST /api/v1/domains
{
  "projectId": "proj_123",
  "domain": "store.example.com"
}

Response:
{
  "success": true,
  "domain": {
    "id": "dom_456",
    "domain": "store.example.com",
    "status": "pending",
    "dnsInstructions": {
      "type": "CNAME",
      "name": "store",
      "value": "app.shipper.now",
      "ttl": 3600
    }
  }
}
```

### Verify Domain
```typescript
POST /api/v1/domains/:domainId/verify

Response:
{
  "success": true,
  "verified": true,
  "dnsType": "CNAME"
}
```

### Get Domain Status
```typescript
GET /api/v1/domains/:domainId

Response:
{
  "id": "dom_456",
  "domain": "store.example.com",
  "status": "verified",
  "dnsType": "CNAME",
  "verifiedAt": "2024-01-15T10:30:00Z"
}
```

## UI Components

### DNS Instructions Display
```tsx
<div className="bg-blue-50 p-4 rounded-lg">
  <h3 className="font-semibold mb-2">Configure DNS</h3>
  <p className="text-sm mb-4">
    Add this record at your DNS provider (GoDaddy, Namecheap, etc.):
  </p>
  
  <div className="bg-white p-3 rounded border font-mono text-sm">
    <div>Type: <strong>CNAME</strong></div>
    <div>Name: <strong>store</strong></div>
    <div>Value: <strong>app.shipper.now</strong></div>
    <div>TTL: <strong>3600</strong></div>
  </div>
  
  <button onClick={verifyDomain} className="mt-4">
    Verify DNS Configuration
  </button>
</div>
```

## Advantages

✅ **Simple** - No complex API integrations
✅ **Free** - No enterprise features required
✅ **Transparent** - Users see exactly what's happening
✅ **Flexible** - Works with any DNS provider
✅ **No vendor lock-in** - Standard DNS records

## Disadvantages

❌ **Manual setup** - Users must configure DNS themselves
❌ **Propagation delay** - Can take minutes to hours
❌ **SSL complexity** - Need to handle certificates
❌ **Support burden** - Users may need help with DNS

## Comparison

| Feature | Cloudflare for SaaS | DNS Pointing |
|---------|-------------------|--------------|
| Cost | $$ Enterprise | Free |
| Setup | Automatic | Manual |
| SSL | Auto-provisioned | Self-managed |
| Propagation | Instant | 5min - 48hrs |
| User Control | Limited | Full |
| Complexity | High | Low |

## Recommendation

Use **DNS Pointing** for:
- MVP/early stage
- Budget-conscious projects
- Technical users
- Full control needed

Use **Cloudflare for SaaS** for:
- Enterprise customers
- Non-technical users
- Instant setup required
- Budget available

## Next Steps

1. Implement DNS verification endpoint
2. Create UI for DNS instructions
3. Set up Let's Encrypt for SSL
4. Configure web server for custom domains
5. Add domain status monitoring
