# Modal Integration - Database Schema Update Required

## Overview

Modal sandbox manager has been integrated into the AI tools service (`apps/api/src/services/ai-tools.ts`). The system now supports both Modal and Daytona sandbox providers.

## Required Database Schema Change

Add a `sandboxProvider` field to the `Project` model to track which sandbox provider each project uses.

### Prisma Schema Update

Add to `packages/database/prisma/schema.prisma`:

```prisma
model Project {
  // ... existing fields ...

  sandboxProvider String? @default("modal") // "modal" or "daytona"

  // ... rest of fields ...
}
```

### Migration Command

```bash
cd packages/database
pnpm prisma migrate dev --name add_sandbox_provider_to_project
pnpm db:generate
```

## Implementation Details

### Default Behavior

- **New projects**: Default to Modal with `database-template` branch
- **Existing projects**: Auto-detect based on existing sandbox type, default to Modal if none

### Template System

Modal uses Git branches from `https://github.com/Shipper-dot-now/vite-template`:

- `database-template` → Database app (default)
- `main` → Basic Vite template
- `calculator-template` → Calculator app
- `content-sharing-template` → Content sharing app

### Compatibility Layer

The AI tools service includes a compatibility layer that automatically detects the provider and calls the appropriate functions:

- `getSandbox(projectId)` - Works with both providers
- `createSandbox(projectId, fragmentId, templateName, provider)` - Defaults to Modal with database-template
- `getFilesFromSandbox(sandbox, provider)` - Provider-aware file listing
- `readFileFromSandbox(sandbox, path, provider)` - Provider-aware file reading
- `writeFileToSandbox(sandbox, path, content, provider)` - Provider-aware file writing

### Context Updates

The `ToolsContext` type now includes:

```typescript
sandboxProvider?: "modal" | "daytona"; // Which sandbox provider to use
```

## Environment Variables

Modal requires these environment variables:

```bash
# Modal Configuration
MODAL_TOKEN_ID=your_modal_token_id
MODAL_TOKEN_SECRET=your_modal_token_secret

# Get these from https://modal.com/settings
```

## Files Modified

1. `apps/api/src/services/ai-tools.ts`
   - Added Modal imports
   - Added compatibility layer functions
   - Updated tools to work with both providers
   - Default template: `database`

2. `apps/api/src/services/modal-sandbox-manager.ts`
   - Implements Git branch cloning
   - Auto-installs dependencies
   - Initializes fresh git history

3. `apps/api/MODAL_SETUP.md`
   - Complete documentation of Modal workflow

## Testing

After running the migration:

1. Create a new project - should use Modal with database-template
2. Verify sandbox creation logs show: `Creating Modal sandbox with template: database`
3. Check that template files are cloned from the database-template branch
4. Verify dependencies are auto-installed

## Rollback

If needed to rollback to Daytona only:

1. Set default provider in `getSandboxProvider()` to `"daytona"`
2. Or explicitly pass `provider: "daytona"` when creating sandboxes
