# Entri Integration Checklist

## 🎯 Setup Checklist

### Immediate (To Test Feature)
- [ ] Sign up at https://www.entri.com/
- [ ] Create an Entri application
- [ ] Copy your Application ID
- [ ] Update `NEXT_PUBLIC_ENTRI_APP_ID` in `.env`
- [ ] Run `pnpm dev`
- [ ] Open Settings → Domains tab
- [ ] Click "Buy Custom Domain" to test

### Optional (For Full Testing)
- [ ] Purchase one test domain from Ionos (~$1)
- [ ] Test domain purchase flow in debug mode
- [ ] Verify Entri modal opens correctly
- [ ] Test domain search functionality

---

## 🚧 Backend Implementation Checklist

### Database
- [ ] Add `domains` table to schema
- [ ] Add indexes for performance
- [ ] Run database migration
- [ ] Test database queries

### API Endpoints
- [ ] `POST /api/projects/:projectId/domains` - Save domain
- [ ] `GET /api/projects/:projectId/domains` - List domains
- [ ] `POST /api/projects/:projectId/domains/:domainId/configure` - Configure DNS
- [ ] `POST /api/projects/:projectId/domains/:domainId/verify` - Verify domain
- [ ] `DELETE /api/projects/:projectId/domains/:domainId` - Remove domain

### DNS Configuration
- [ ] Implement DNS record generation
- [ ] Add DNS verification logic
- [ ] Create user instructions for DNS setup
- [ ] Test DNS propagation checking

### Domain Verification
- [ ] Implement domain ownership verification
- [ ] Add SSL certificate provisioning
- [ ] Create status monitoring
- [ ] Add error handling

### Deployment Integration
- [ ] Integrate with hosting platform (Vercel/etc.)
- [ ] Add domain to deployment
- [ ] Configure SSL
- [ ] Test custom domain access

### Frontend Updates
- [ ] Update `onSuccess` callback to save domain
- [ ] Add domain list component
- [ ] Show domain status indicators
- [ ] Add domain management UI
- [ ] Display DNS configuration instructions
- [ ] Add error handling and toasts

### Testing
- [ ] Test domain purchase flow
- [ ] Test domain saving to database
- [ ] Test DNS configuration
- [ ] Test domain verification
- [ ] Test SSL provisioning
- [ ] Test multiple domains per project
- [ ] Test error scenarios
- [ ] Test domain removal

### Monitoring
- [ ] Add background job for status checks
- [ ] Monitor DNS propagation
- [ ] Track SSL certificate status
- [ ] Alert on domain expiration
- [ ] Log domain-related errors

---

## 📋 Documentation Checklist

- [x] Setup guide created
- [x] Integration docs written
- [x] Backend TODO documented
- [x] Type definitions added
- [x] Quick reference created
- [x] Feature summary written
- [ ] Update main README with domain feature
- [ ] Add user-facing documentation
- [ ] Create troubleshooting guide
- [ ] Document DNS configuration steps

---

## ✅ Completed

- [x] Frontend UI component
- [x] Entri SDK integration
- [x] Settings modal integration
- [x] Debug mode configuration
- [x] Custom branding
- [x] TypeScript types
- [x] Environment variables
- [x] Documentation

---

## 🎯 Current Status

**Frontend**: ✅ Complete  
**Backend**: ⏳ Pending  
**Testing**: ⏳ Needs Entri App ID  
**Documentation**: ✅ Complete  

---

## 📝 Notes

- Debug mode is automatically enabled in development
- Ionos is configured as the registrar
- Brand color (#0D9488) is applied
- All TypeScript types are defined
- No compilation errors

---

## 🚀 Next Action

**→ Add your Entri Application ID to `.env` and test the feature!**

See `START_HERE.md` for quick start instructions.
