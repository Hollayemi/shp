# Modal Snapshot System Guide

## Overview

The Modal Snapshot system allows you to pre-build template environments as filesystem snapshots, avoiding the need to clone from Git every time a sandbox is created. This provides:

- **Faster sandbox creation** - No git cloning required
- **More reliable** - Avoids git credential issues
- **Consistent environments** - Same template every time
- **Cost effective** - Less compute time per sandbox

## Architecture

### Files

1. **`apps/api/scripts/create-modal-snapshot.ts`** - Script to create snapshots
2. **`apps/api/src/services/modal-snapshots.ts`** - Snapshot image ID registry
3. **`apps/api/src/services/modal-sandbox-manager.ts`** - Uses snapshots when available

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                  Sandbox Creation Flow                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────┐
│ User requests   │
│ new sandbox     │
└────────┬────────┘
         │
         v
┌─────────────────────────┐
│ Check if snapshot       │
│ exists for template?    │
└──────┬──────────────┬───┘
       │              │
    YES│              │NO
       v              v
┌──────────────┐  ┌──────────────────┐
│ Use snapshot │  │ Use base image   │
│ (FAST)       │  │ + clone from Git │
│              │  │ (SLOWER)         │
└──────┬───────┘  └─────┬────────────┘
       │                │
       └────────┬───────┘
                v
        ┌───────────────┐
        │ Sandbox ready │
        └───────────────┘
```

## Creating Snapshots

### Prerequisites

1. **Modal credentials** in your `.env`:

   ```bash
   MODAL_TOKEN_ID=tk-xxxxxx
   MODAL_TOKEN_SECRET=ts-xxxxxx
   ```

2. **GitHub App credentials** in your `.env`:

   ```bash
   GITHUB_APP_ID=123456
   GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
   ```

3. **Get credentials**:
   - Modal: https://modal.com/settings/tokens
   - GitHub App: Your organization's GitHub App settings

### Usage

#### Interactive Mode (Recommended)

```bash
# Run from project root
pnpm --filter api create-modal-snapshot
```

This will:

1. **Authenticate with GitHub App** to access the private repository
2. **Fetch all available branches** from the repository via GitHub API
3. Show you a list of available templates dynamically
4. Let you select one interactively
5. Create the snapshot
6. Display the Image ID to add to `modal-snapshots.ts`

**Note:** The script uses GitHub App authentication with installation tokens to access the private vite-template repository.

#### Command Line Mode

```bash
# Specific template
pnpm --filter api create-modal-snapshot --branch=database-vite-todo-template

# With version
pnpm --filter api create-modal-snapshot --branch=calculator-template --version=v2

# Custom base image
pnpm --filter api create-modal-snapshot --branch=main --base-image=node:22-bookworm

# Different repository
pnpm --filter api create-modal-snapshot --repo=https://github.com/org/repo --branch=main
```

### Options

| Option         | Description                   | Default                                            |
| -------------- | ----------------------------- | -------------------------------------------------- |
| `--branch`     | Template branch to clone      | Interactive menu                                   |
| `--name`       | Custom snapshot name          | Auto-generated from branch                         |
| `--version`    | Version suffix (e.g., v1, v2) | None                                               |
| `--repo`       | Repository URL                | `https://github.com/Shipper-dot-now/vite-template` |
| `--base-image` | Base container image          | `node:20-bookworm`                                 |

## Registering Snapshots

After creating a snapshot, register it in `apps/api/src/services/modal-snapshots.ts`:

```typescript
export const MODAL_SNAPSHOTS: Record<string, SnapshotInfo> = {
  database: {
    imageId: "im-ABC123XYZ", // <-- Copy from create-modal-snapshot output
    description: "Database todo template with Turso",
    createdAt: "2025-01-29",
    version: "v1",
  },

  calculator: {
    imageId: "im-DEF456UVW",
    description: "Simple calculator application",
    createdAt: "2025-01-29",
    version: "v1",
  },
};
```

### Snapshot Name Mapping

The template name used in code (e.g., `createSandbox(projectId, null, "database")`) must match the key in `MODAL_SNAPSHOTS`.

**Common mappings:**

- `"database-vite-todo-template"` branch → `"database"` key
- `"calculator-template"` branch → `"calculator"` key
- `"content-sharing-template"` branch → `"content-sharing"` key

## Using Snapshots

### Automatic Usage

Once a snapshot is registered, it's automatically used:

```typescript
// In API code
const sandboxInfo = await createSandbox(
  projectId,
  null,
  "database", // Uses snapshot if available, git clone if not
);
```

### Fallback Behavior

If no snapshot exists for a template:

1. System logs: `[Modal] No snapshot available for {template}`
2. Falls back to base image + git clone
3. Works as before (but slower)

## Snapshot Contents

Each snapshot includes:

1. **Cloned template repository** in `/workspace`
2. **Git repository initialized** (fresh, no history)
3. **Dependencies installed** (`npm install` run)
4. **Git installed** in the container
5. **Initial git commit** with "Initial commit from template"

## Maintenance

### Updating Snapshots

When a template is updated:

```bash
# Create new version
pnpm --filter api create-modal-snapshot --branch=database-vite-todo-template --version=v2

# Update modal-snapshots.ts with new imageId
# Optionally remove old version or keep for rollback
```

### Versioning Strategy

**Recommended approach:**

- Keep current version in production
- Create new version for updates
- Test new version thoroughly
- Update `modal-snapshots.ts` to switch versions
- Keep 1-2 old versions for quick rollback

```typescript
export const MODAL_SNAPSHOTS: Record<string, SnapshotInfo> = {
  database: {
    imageId: "im-NEW123", // Current
    version: "v2",
    createdAt: "2025-02-01",
    // ...
  },

  // Keep for rollback
  "database-v1": {
    imageId: "im-OLD123",
    version: "v1",
    createdAt: "2025-01-29",
    // ...
  },
};
```

## Comparison: Daytona vs Modal Snapshots

| Feature               | Daytona                           | Modal                               |
| --------------------- | --------------------------------- | ----------------------------------- |
| **Snapshot Creation** | SDK built-in                      | Custom script required              |
| **Snapshot Type**     | Workspace snapshots               | Filesystem images                   |
| **Template Source**   | Pre-built in image                | Clone at runtime or use snapshot    |
| **Git History**       | Preserved from template           | Fresh repo, no history              |
| **Usage**             | Automatic (SDK handles)           | Opt-in (register in code)           |
| **Speed**             | Very fast (persistent workspaces) | Fast with snapshots, slower without |

## Troubleshooting

### Error: "Cannot find module 'modal'"

**Solution:** Run script from API app context:

```bash
pnpm --filter api create-modal-snapshot
```

### Error: "Missing MODAL_TOKEN_ID" or "Missing GITHUB_APP_ID"

**Solution:** Add all required credentials to `.env`:

```bash
# Modal credentials
MODAL_TOKEN_ID=tk-xxxxxx
MODAL_TOKEN_SECRET=ts-xxxxxx

# GitHub App credentials
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
```

### Error: "Failed to get installation" or "Failed to get branches"

**Causes:**

1. Invalid GitHub App credentials
2. GitHub App not installed on the repository
3. GitHub App doesn't have read access to repository contents

**Solutions:**

1. Verify GitHub App is installed on the `Shipper-dot-now` organization
2. Check GitHub App has `Contents: Read` permission
3. Ensure private key is correctly formatted (use `\n` for newlines in `.env`)
4. Use command-line mode with `--branch` to skip API call:
   ```bash
   pnpm --filter api create-modal-snapshot --branch=database-vite-todo-template
   ```

### Git Clone Fails During Snapshot Creation

**Causes:**

1. Invalid branch name
2. Repository doesn't exist
3. Branch is private (requires auth)

**Solution:**

```bash
# Check branch exists
git ls-remote https://github.com/Shipper-dot-now/vite-template

# For private repos, use SSH-based approach or add authentication
```

### Snapshot Not Being Used

**Check:**

1. Is template name registered in `modal-snapshots.ts`?
2. Does the template name match exactly?
3. Rebuild API after updating `modal-snapshots.ts`:
   ```bash
   turbo build --filter=api
   ```

## Best Practices

1. **Name snapshots clearly** - Use descriptive keys like `"database"`, `"calculator"`
2. **Version snapshots** - Append version to name for major updates
3. **Test before registering** - Create sandbox manually first to verify
4. **Document changes** - Update `description` field when creating new versions
5. **Clean up old snapshots** - Remove unused entries to reduce confusion
6. **Keep git cloning working** - Always maintain fallback for templates without snapshots

## Performance Benefits

**Without Snapshot (Git Clone):**

- Sandbox creation: ~15-30 seconds
- Git install: ~5-10 seconds
- Repository clone: ~5-10 seconds
- Dependency install: ~10-20 seconds

**With Snapshot:**

- Sandbox creation: ~3-5 seconds (everything pre-built)
- **Improvement: 5-10x faster** ⚡

## Future Enhancements

Potential improvements to the snapshot system:

1. **Automatic snapshot updates** - CI/CD pipeline to rebuild snapshots when templates change
2. **Snapshot versioning** - Automatic version tracking and management
3. **Multi-region snapshots** - Replicate snapshots across Modal regions for lower latency
4. **Snapshot metrics** - Track usage and performance of different snapshots
5. **Lazy loading** - Load additional dependencies only when needed

## Questions?

For more information:

- Modal Docs: https://modal.com/docs
- Shipper Architecture: See `/docs/DAYTONA_API_MIGRATION.md`
