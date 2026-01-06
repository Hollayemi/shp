# Entri Debug Mode Guide

## 🎭 What is Debug Mode?

Debug mode allows you to test the Entri domain purchasing flow **without actually buying domains**. This is perfect for:
- Testing the UI/UX flow
- Verifying domain auto-connection works
- Training your team
- Demo purposes

## 🔧 Configuration

### Enable Debug Mode (Default)

In your `.env`:
```bash
NEXT_PUBLIC_ENTRI_DEBUG_MODE="true"
```

### Disable Debug Mode (Live Purchases)

For production or real purchases:
```bash
NEXT_PUBLIC_ENTRI_DEBUG_MODE="false"
```

## 📋 How to Use Debug Mode

### Prerequisites

You need **one domain previously purchased through Ionos** to use debug mode. This is a one-time setup.

### Testing Flow

1. **Open your app** → Settings → Domains
2. **Click "Buy a New Domain"**
3. **You'll see:** 🎭 Debug Mode indicator
4. **In the Entri modal:**
   - Search for your previously purchased Ionos domain
   - Select it
   - Complete the "purchase" flow
5. **No charge is made** - it's simulated
6. **Domain is automatically connected** to your project
7. **Appears in domain list** with DNS instructions

### What Happens in Debug Mode

```
User clicks "Buy Custom Domain"
    ↓
Entri modal opens (debug mode enabled)
    ↓
User searches for previously purchased domain
    ↓
User "purchases" domain (no charge)
    ↓
Entri returns success
    ↓
Domain is automatically connected via Cloudflare
    ↓
Domain appears in list ✨
```

## 🎯 Testing Checklist

- [ ] Debug mode indicator shows in UI
- [ ] Can search for domains
- [ ] Can select previously purchased domain
- [ ] "Purchase" completes without charge
- [ ] Domain automatically appears in list
- [ ] DNS instructions are shown
- [ ] Can set domain as primary
- [ ] Can delete domain

## 🚀 Production Setup

When ready for real purchases:

1. **Update `.env`:**
   ```bash
   NEXT_PUBLIC_ENTRI_DEBUG_MODE="false"
   ```

2. **Restart frontend:**
   ```bash
   pnpm --filter web dev
   ```

3. **Verify:**
   - Debug mode indicator should NOT show
   - Purchases will be real and charged

## 🔄 Switching Between Modes

### Development → Production
```bash
# In .env
NEXT_PUBLIC_ENTRI_DEBUG_MODE="false"

# Restart
pnpm --filter web dev
```

### Production → Development
```bash
# In .env
NEXT_PUBLIC_ENTRI_DEBUG_MODE="true"

# Restart
pnpm --filter web dev
```

## 💡 Best Practices

### For Development
- Keep debug mode **ON** (`true`)
- Use a cheap test domain for testing
- Test the full flow regularly

### For Staging
- Use debug mode **ON** (`true`)
- Prevents accidental purchases during testing

### For Production
- Set debug mode **OFF** (`false`)
- Monitor purchases in Entri dashboard
- Set up alerts for failed purchases

## 🐛 Troubleshooting

### "No domains found" in debug mode
- **Issue:** You don't have a previously purchased Ionos domain
- **Fix:** Purchase one cheap domain through Ionos first (one-time)

### Debug mode not working
- **Issue:** Env variable not set correctly
- **Fix:** Check `.env` has `NEXT_PUBLIC_ENTRI_DEBUG_MODE="true"`
- **Fix:** Restart frontend server

### Still getting charged in debug mode
- **Issue:** Debug mode not enabled in Entri
- **Fix:** Verify env variable is set
- **Fix:** Check browser console for debug mode log
- **Fix:** Contact Entri support

### Domain not auto-connecting after purchase
- **Issue:** Cloudflare credentials not set
- **Fix:** Check Cloudflare API token, zone ID, account ID
- **Fix:** Check API logs for errors

## 📊 Monitoring

### Check Debug Mode Status

In browser console:
```javascript
console.log('Debug Mode:', process.env.NEXT_PUBLIC_ENTRI_DEBUG_MODE)
```

### Check Entri Config

When purchasing, look for:
```
[Entri] Config: { ..., debugMode: true }
[Entri] 🎭 DEBUG MODE ENABLED - Use a previously purchased Ionos domain to test
```

## 🔒 Security Notes

- Debug mode only affects Entri purchases
- Cloudflare domain connections are always real
- API calls are still made (domain connection)
- Database records are created normally

## 📚 Related Docs

- [Entri Integration Guide](./ENTRI_INTEGRATION.md)
- [Cloudflare Setup](./CLOUDFLARE_SAAS_SETUP.md)
- [Domain Demo Mode](./DOMAIN_DEMO_MODE.md)

## 🎓 Training Your Team

Use debug mode to train team members:

1. Enable debug mode
2. Walk through purchase flow
3. Show domain auto-connection
4. Demonstrate DNS setup
5. Test primary domain selection
6. Practice domain management

No costs incurred during training!
