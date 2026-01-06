# Modal Sandbox Setup

This document explains how Modal sandboxes work in the Shipper API.

## Overview

Modal is a serverless cloud platform for running code in containers. Unlike Daytona which uses custom snapshots, Modal uses **base images from Docker Hub** and sets up projects dynamically when sandboxes are created.

## How It Works

### 1. Base Images

We use pre-built Docker images from Docker Hub:

- **Node.js projects**: `node:20-slim`
- **Python projects**: `python:3.11-slim`
- **Bun projects**: `oven/bun:1`

These images are pulled directly from Docker Hub by Modal - no custom image building required.

### 2. Sandbox Creation Flow

When creating a sandbox for a project:

```typescript
const sandbox = await modalClient.sandboxes.create(app, image, {
  timeoutMs: 3600000, // 1 hour
  idleTimeoutMs: 1800000, // 30 min idle
  workdir: "/workspace",
  env: {
    NODE_ENV: "development",
    PROJECT_ID: projectId,
  },
  memoryMiB: 2048,
  cpu: 1,
});
```

### 3. Template System (Git Branches)

Templates are stored as **branches** in the `vite-template` repository:

- `main` → Basic Vite template
- `calculator-template` → Calculator app
- `content-sharing-template` → Content sharing app
- etc.

When creating a sandbox with a template:

```typescript
await cloneTemplateInSandbox(sandbox, "calculator");
```

This:

1. Clones the specific branch: `git clone --branch calculator-template --single-branch`
2. Moves files to workspace root
3. Removes old .git history: `rm -rf .git`
4. Initializes fresh git repo: `git init && git add . && git commit`
5. Auto-detects package manager (bun/pnpm/yarn/npm)
6. Installs dependencies automatically

**Template Name Mapping:**

- `"vite"`, `"default"`, or `"node"` → clones `main` branch
- `"calculator"` → clones `calculator-template` branch
- `"content-sharing"` → clones `content-sharing-template` branch
- Names ending in `-template` are used as-is
- Other names get `-template` suffix appended

**Repository:** https://github.com/Shipper-dot-now/vite-template

### 4. Project Files Restoration

Alternatively, you can restore files from a V2Fragment using `restoreFilesInSandbox()`:

```typescript
// Restore files from V2Fragment
const files = { "src/App.tsx": "...", "package.json": "..." };
await restoreFilesInSandbox(sandbox, files);
```

This:

- Creates all necessary directories
- Writes each file to the sandbox
- Sets proper permissions

### 5. Dependency Installation

For manual dependency installation (when not using templates):

```typescript
await sandbox.exec(["npm", "install"]);
```

Note: Templates automatically install dependencies during the cloning process.

## Why Not Custom Images?

Unlike Daytona's snapshot approach, Modal's **JavaScript SDK has limitations**:

- ❌ No `.apt_install()`, `.run_commands()`, `.pip_install()` like Python SDK
- ❌ Limited `.dockerfileCommands()` support
- ❌ No build log streaming
- ❌ Truncated error messages

The **Python SDK** is much more powerful for image building, but we're using JavaScript/TypeScript.

## Benefits of This Approach

✅ **Simpler** - No complex image building process
✅ **Faster iteration** - No waiting for images to build
✅ **More flexible** - Different projects can use different base images
✅ **Reliable** - Uses official Docker Hub images
✅ **Debuggable** - Errors are clear and actionable

## Modal SDK vs Daytona SDK

| Feature                 | Daytona                           | Modal                                  |
| ----------------------- | --------------------------------- | -------------------------------------- |
| Base Images             | Custom snapshots                  | Docker Hub images                      |
| Templates               | Branches → Pre-built snapshots    | Branches → Cloned at runtime           |
| Setup                   | Pre-baked in snapshot             | Cloned + installed when sandbox starts |
| Build Time              | Long (5-10 min snapshot creation) | Fast (git clone + npm install)         |
| Iteration Speed         | Slow (rebuild snapshot needed)    | Fast (just restart sandbox)            |
| SDK Maturity            | Full-featured                     | Limited (JS SDK)                       |
| File Operations         | Native API                        | Via `sandbox.open()`                   |
| Command Execution       | Native API                        | Via `sandbox.exec()`                   |
| Dependency Installation | Pre-installed in snapshot         | Installed at sandbox creation          |

## Environment Variables Required

```bash
MODAL_TOKEN_ID=your_token_id
MODAL_TOKEN_SECRET=your_token_secret
```

Get these from https://modal.com/settings

## Usage in Code

See `src/services/modal-sandbox-manager.ts` for the full implementation.

### Create Sandbox with Template

```typescript
import { createSandbox } from "./services/modal-sandbox-manager";

// Create sandbox from Git template branch
const sandboxInfo = await createSandbox(
  projectId,
  null, // no fragmentId
  "calculator", // template: vite, calculator, content-sharing, etc
);
```

This will:

1. Clone the `calculator-template` branch from `vite-template` repo
2. Initialize fresh git history
3. Auto-install dependencies

### Create Sandbox with Fragment

```typescript
// Restore from existing V2Fragment
const sandboxInfo = await createSandbox(
  projectId,
  fragmentId, // restore this fragment
  "vite", // base image only
);
```

### Execute Commands

```typescript
import { executeCommand } from "./services/modal-sandbox-manager";

const result = await executeCommand(sandboxId, "npm run build", {
  timeoutMs: 60000,
});

console.log(result.stdout);
console.log(result.exitCode);
```

### Read/Write Files

```typescript
import { readFile, writeFile } from "./services/modal-sandbox-manager";

const content = await readFile(sandboxId, "src/App.tsx");
await writeFile(sandboxId, "src/App.tsx", updatedContent);
```

## Troubleshooting

### Sandbox Creation Fails

- Check Modal credentials are set correctly
- Verify you have credits/quota on Modal
- Check Modal's status page: https://status.modal.com

### File Operations Slow

- Modal sandboxes are serverless and may have cold start latency
- Consider keeping sandboxes warm for better performance

### Command Execution Timeout

- Increase `timeoutMs` for long-running commands
- Default is 2 minutes, max is 10 minutes per command

## Future Improvements

If Modal's JavaScript SDK improves, we could:

1. Build custom images with pre-installed dependencies
2. Use `sandbox.snapshotFilesystem()` to create reusable images
3. Implement caching for faster cold starts
4. Add support for more complex build pipelines

For now, the dynamic setup approach works well and is maintainable.
