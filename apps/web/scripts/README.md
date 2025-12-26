# Scripts

This directory contains utility scripts for managing the Shipper application.

## Daytona Snapshot Setup

### `create-daytona-snapshot.ts`

Creates a pre-built Daytona snapshot with the vite-template repository and all dependencies installed. This snapshot is used for creating sandboxes quickly without rebuilding the entire environment each time.

**Prerequisites:**

- `DAYTONA_API_KEY` environment variable
- `GITHUB_APP_ID` environment variable
- `GITHUB_APP_PRIVATE_KEY` environment variable

**Usage:**

```bash
# Run the setup script
npm run setup:daytona-snapshot

# Or run directly with tsx
npx tsx scripts/create-daytona-snapshot.ts
```

**What it does:**

1. Creates a Docker image based on `node:22-slim`
2. Installs git, npm, and pnpm
3. Sets up proper user permissions for the `daytona` user
4. Clones the vite-template repository
5. Installs all dependencies with pnpm
6. Creates a Daytona snapshot named `vite-template`

**Note:** This script only needs to be run once to set up the snapshot. After that, sandbox creation will be much faster since it uses the pre-built snapshot instead of building from scratch each time.

If you need to update the snapshot (e.g., after changes to the template repository or dependencies), you'll need to delete the existing snapshot first and then re-run this script.
