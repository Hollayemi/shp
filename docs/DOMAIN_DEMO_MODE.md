# Domain Connection - Demo Mode Guide

## 🎭 What is Demo Mode?

Demo Mode allows you to test the complete domain connection flow **without needing Cloudflare credentials**. It simulates the entire process so you can see how it works before setting up the real integration.

## ✅ How to Use Demo Mode

### Step 1: Verify Demo Mode is Active

When you start the API server, you should see:
```
[Domains] 🎭 Running in DEMO/MOCK mode - Cloudflare credentials not configured
[Domains] 💡 Domains will simulate verification after 10 seconds
```

### Step 2: Test the Flow

1. **Open your browser** to http://localhost:3000
2. **Navigate to any project**
3. **Click Settings** (gear icon)
4. **Go to the "Domains" tab**
5. You'll see a blue **"Demo Mode Active"** banner

### Step 3: Connect a Test Domain

1. **Expand "Connect a Domain You Already Own"**
2. **Enter any domain** (e.g., `myapp.com`, `test.example.com`)
   - The domain format must be valid (e.g., `domain.com`)
   - It doesn't need to be a real domain you own
3. **Click "Connect Domain"**

### Step 4: See the Simulated Flow

**Immediately after connecting:**
- ✅ Domain appears in the "Connected Domains" list
- 🟡 Status shows as "Pending"
- 🟡 SSL shows as "Pending"
- 📋 DNS instructions are displayed with a mock CNAME target
- 💡 You'll see: "Add this CNAME record to your DNS provider"

**After 10 seconds:**
1. **Click the refresh button** (circular arrow icon) on the domain
2. Watch the status change:
   - 🟡 "Pending" → 🟢 "Active"
   - 🟡 "SSL Pending" → 🟢 "SSL Active"
3. The domain is now "verified" (simulated)

### Step 5: Test Other Features

**Refresh Status:**
- Click the refresh icon to check verification status
- In demo mode, domains become active after 10 seconds

**Delete Domain:**
- Click the trash icon to remove a domain
- Confirms before deleting

**Multiple Domains:**
- Add multiple test domains to see the list grow
- Each domain has its own 10-second timer

## 🎬 Complete Demo Flow Example

```
1. Enter domain: "myawesomeapp.com"
2. Click "Connect Domain"
3. See: Status = Pending, SSL = Pending
4. See DNS instructions: CNAME → myawesomeapp.com.cdn.cloudflare.net
5. Wait 10 seconds
6. Click refresh button
7. See: Status = Active ✓, SSL = Active ✓
8. Domain is now "connected" (simulated)
```

## 🔄 What's Being Simulated?

### Mock Cloudflare Service
- Creates fake custom hostnames
- Generates mock CNAME targets
- Simulates DNS verification (10-second delay)
- Simulates SSL provisioning

### Database Operations
- Real database records are created
- Domains are stored with mock Cloudflare IDs
- Status updates are persisted
- You can see actual data in your database

### UI Behavior
- All UI components work exactly as they would in production
- Status badges update correctly
- DNS instructions display properly
- Error handling works

## 🚀 Switching to Real Cloudflare

When you're ready to use real Cloudflare:

1. **Set up Cloudflare for SaaS** (see `CLOUDFLARE_SAAS_SETUP.md`)

2. **Add credentials to `.env`:**
   ```bash
   CLOUDFLARE_API_TOKEN="your_real_token"
   CLOUDFLARE_ZONE_ID="your_real_zone_id"
   CLOUDFLARE_ACCOUNT_ID="your_real_account_id"
   ```

3. **Restart the API server**

4. **Demo mode will automatically disable**
   - You'll see: "Running with real Cloudflare integration"
   - The blue demo banner will disappear
   - Real domains will be created in Cloudflare

## 📊 Demo Mode vs Real Mode

| Feature | Demo Mode | Real Mode |
|---------|-----------|-----------|
| Cloudflare API calls | ❌ Simulated | ✅ Real |
| DNS verification | ⏱️ 10 seconds | ⏱️ Minutes to hours |
| SSL provisioning | ⏱️ 10 seconds | ⏱️ Minutes to hours |
| CNAME targets | 🎭 Mock | ✅ Real Cloudflare |
| Database records | ✅ Real | ✅ Real |
| UI behavior | ✅ Identical | ✅ Identical |
| Cost | 💰 Free | 💰 Cloudflare pricing |

## 🐛 Troubleshooting Demo Mode

### Demo mode not activating?
- Check that Cloudflare env vars are NOT set
- Restart the API server
- Look for the demo mode message in logs

### Domains not becoming active?
- Wait the full 10 seconds
- Click the refresh button
- Check browser console for errors

### Can't connect domains?
- Verify API key is set: `NEXT_PUBLIC_SHIPPER_API_KEY`
- Check that both servers are running
- Verify domain format is valid (e.g., `domain.com`)

## 💡 Tips

1. **Use realistic domain names** to better visualize the flow
2. **Test multiple domains** to see the list management
3. **Try deleting and re-adding** domains
4. **Watch the 10-second timer** to understand verification timing
5. **Check the database** to see actual records being created

## 🎯 What You're Testing

This demo mode lets you validate:
- ✅ UI/UX flow for domain connection
- ✅ DNS instruction display
- ✅ Status badge updates
- ✅ Domain list management
- ✅ Error handling
- ✅ Database integration
- ✅ API endpoint functionality

Everything works exactly as it would in production, just without the real Cloudflare infrastructure!
