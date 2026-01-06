# Modal Sandbox Testing Guide

## Quick Start

Test Modal sandbox creation with automatic project creation:

```bash
cd apps/api

# Simple test - creates a test project automatically
npx tsx scripts/test-modal-create-sandbox.ts

# With specific template
npx tsx scripts/test-modal-create-sandbox.ts --template=calculator-template

# Using existing project
npx tsx scripts/test-modal-create-sandbox.ts --project-id=YOUR_PROJECT_ID

# With specific user
npx tsx scripts/test-modal-create-sandbox.ts --user-id=YOUR_USER_ID
```

## What the Script Does

1. **Creates a test project** (unless `--project-id` is provided)
   - Finds a test user or uses the first available user
   - Creates a new V2 project with messaging version 2

2. **Creates a Modal sandbox**
   - Calls the API endpoint `/api/v1/modal/sandbox`
   - Uses the specified template (default: `vite-template`)
   - Generates startup script dynamically
   - Starts dev server on port 5173

3. **Shows results**
   - Sandbox ID
   - Tunnel URL (for accessing the dev server)
   - Next steps with curl commands

4. **Cleanup on error**
   - Automatically deletes test project if creation fails
   - Disconnects from database

## Environment Variables Required

```bash
SHIPPER_API_KEY=your-api-key          # For API authentication
MODAL_TOKEN_ID=your-modal-token       # Modal credentials
MODAL_TOKEN_SECRET=your-modal-secret  # Modal credentials
DATABASE_URL=your-database-url        # Prisma database connection
```

## Example Output

```
🧪 Testing Modal Sandbox Creation
================================

API URL: http://localhost:4000
Template: vite-template

📝 Creating test project in database...
   Using user: test@example.com
✅ Test project created: clx123abc456

📤 Sending request to create sandbox...

✅ Sandbox created successfully!

📋 Sandbox Details:
──────────────────────────────────────────────────
Sandbox ID: sb-abc123def456
Sandbox URL: https://xyz.modal.run
Expires At: Not set
──────────────────────────────────────────────────

💡 Next Steps:
1. Test executing a command:
   curl -X POST http://localhost:4000/api/v1/modal/command/execute \
     -H "Content-Type: application/json" \
     -H "x-api-key: YOUR_API_KEY" \
     -d '{"sandboxId": "sb-abc123def456", "command": "ls -la"}'

2. Test reading a file:
   curl -X POST http://localhost:4000/api/v1/modal/file/read \
     -H "Content-Type: application/json" \
     -H "x-api-key: YOUR_API_KEY" \
     -d '{"sandboxId": "sb-abc123def456", "path": "package.json"}'

3. Clean up when done:
   curl -X DELETE http://localhost:4000/api/v1/modal/sandbox/sb-abc123def456 \
     -H "x-api-key: YOUR_API_KEY"

4. Delete test project:
   Project ID: clx123abc456
   (Project will remain in database for inspection)
```

## Testing Other Endpoints

Once you have a sandbox ID, you can test other Modal endpoints:

### Execute Command

```bash
curl -X POST http://localhost:4000/api/v1/modal/command/execute \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "sandboxId": "YOUR_SANDBOX_ID",
    "command": "bun --version"
  }'
```

### Read File

```bash
curl -X POST http://localhost:4000/api/v1/modal/file/read \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "sandboxId": "YOUR_SANDBOX_ID",
    "path": "package.json"
  }'
```

### Write File

```bash
curl -X POST http://localhost:4000/api/v1/modal/file/write \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "sandboxId": "YOUR_SANDBOX_ID",
    "path": "test.txt",
    "content": "Hello from Modal!"
  }'
```

### List Files

```bash
curl -X POST http://localhost:4000/api/v1/modal/files/list \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "sandboxId": "YOUR_SANDBOX_ID"
  }'
```

### Delete Sandbox

```bash
curl -X DELETE http://localhost:4000/api/v1/modal/sandbox/YOUR_SANDBOX_ID \
  -H "x-api-key: YOUR_API_KEY"
```

## Troubleshooting

### Error: "No users found in database"

Create a user first or specify a user ID:

```bash
npx tsx scripts/test-modal-create-sandbox.ts --user-id=YOUR_USER_ID
```

### Error: "SHIPPER_API_KEY environment variable is required"

Set your API key:

```bash
export SHIPPER_API_KEY=your-key-here
```

### Error: "Failed to create sandbox"

Check that:

- Modal credentials are correctly set
- API server is running (`pnpm dev:api`)
- Template name is valid (exists in modal-snapshots.ts)

## Related Files

- **Test Script**: `apps/api/scripts/test-modal-create-sandbox.ts`
- **Sandbox Manager**: `apps/api/src/services/modal-sandbox-manager.ts`
- **API Routes**: `apps/api/src/routes/modal.ts`
- **Snapshots**: `apps/api/src/services/modal-snapshots.ts`
- **Snapshot Creator**: `apps/api/scripts/create-modal-snapshot.ts`
