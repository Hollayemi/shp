# Quick Convex Setup - Get Your Credentials

## ✅ What's Already Done

- ✓ Encryption secret generated (see your `.env` files)
- ✓ Added to both `.env` files (apps/web and apps/api)

## 🔑 What You Need to Do

### 1. Get Team Access Token

1. Open: https://dashboard.convex.dev/settings/team
2. Look for **"Access Tokens"** or **"API Keys"** section
3. Click **"Create Access Token"** or similar button
4. Give it a name like "Shipper Development"
5. Copy the token (looks like: `prod:team-xxx|xxxxxxxxxx`)

### 2. Get Team ID

On the same page (https://dashboard.convex.dev/settings/team):
- Look for **"Team ID"** (usually at the top or in a settings section)
- It's a short string like: `team-abc123` or similar
- Copy it

### 3. Update Your .env Files

Open **both** of these files:
- `Shipper-webapp/apps/web/.env`
- `Shipper-webapp/apps/api/.env`

Find these lines and fill in your values:

```bash
CONVEX_TEAM_ACCESS_TOKEN=""  # ← Paste your token here
CONVEX_TEAM_ID=""            # ← Paste your team ID here
```

Should look like:

```bash
CONVEX_TEAM_ACCESS_TOKEN="prod:team-xxx|your-actual-token-here"
CONVEX_TEAM_ID="team-abc123"
```

### 4. Restart Dev Server

The dev server is currently running as a background process. Restart it:

```bash
# In your terminal, run:
pnpm dev
```

Or if you want to stop the background process first:
```bash
# Find the process
ps aux | grep "pnpm dev"

# Kill it (replace PID with actual process ID)
kill <PID>

# Then start fresh
pnpm dev
```

## ✅ Verification

After restarting, try:

1. Open http://localhost:3000 (or your ngrok URL)
2. Create a new project with "Deploy to Shipper Cloud" enabled
3. You should see:
   - ✅ No "CONVEX_TEAM_ACCESS_TOKEN" error
   - ✅ Project overview page loads
   - ✅ Convex deployment created

## 🆘 Need Help?

If you can't find the credentials:

1. **No Convex account?** 
   - Sign up at https://www.convex.dev/
   - Create a team
   - Then follow steps above

2. **Can't find Team Settings?**
   - Click your profile/avatar in Convex dashboard
   - Look for "Team Settings" or "Settings"
   - Should see "Access Tokens" section

3. **Token not working?**
   - Make sure it's a **team-level** token (not deployment-level)
   - Check it has **admin** permissions
   - Verify you copied the entire token (no spaces)

## 📝 Current Status

```bash
# ✅ Already configured:
CONVEX_URL="https://your-convex-deployment.convex.cloud"
CONVEX_DEPLOY_KEY="dev:your-deployment|..."
CONVEX_DEPLOY_KEY_ENCRYPTION_SECRET="your_32_byte_hex_secret_here"

# ⏳ Waiting for you to add:
CONVEX_TEAM_ACCESS_TOKEN=""  # ← Add this
CONVEX_TEAM_ID=""            # ← Add this
```

Once you add these two values and restart, you're all set! 🚀
