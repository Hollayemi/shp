# Turborepo Monorepo Setup

This project has been configured as a Turborepo monorepo with multiple apps and shared packages.

## Structure

```
shipper-webapp/
├── apps/
│   ├── web/          # Next.js webapp (your existing application)
│   └── api/          # Standalone Node.js/Express API
├── packages/
│   ├── shared/       # Shared types, utilities, and Zod schemas
│   ├── database/     # Prisma client and database utilities
│   └── config/       # Shared ESLint and TypeScript configs
├── turbo.json        # Turborepo configuration
├── pnpm-workspace.yaml
└── package.json      # Root package.json
```

## Quick Start

### Install Dependencies

```bash
pnpm install
```

### Development

Run all apps in parallel:

```bash
pnpm dev
```

Run specific apps:

```bash
pnpm dev:web  # Run only the Next.js webapp
pnpm dev:api  # Run only the API server
```

### Build

Build all apps:

```bash
pnpm build
```

### Other Commands

```bash
pnpm lint        # Lint all apps
pnpm typecheck   # Type check all apps
pnpm format      # Format code with Prettier
```

## Apps

### Web (`apps/web`)

The main Next.js webapp running on `http://localhost:3000`. This is your existing Shipper application with all the UI, authentication, and main features.

**Tech Stack:**

- Next.js 15
- React 19
- Prisma
- NextAuth.js
- TailwindCSS
- tRPC

### API (`apps/api`)

Standalone Node.js/Express API running on `http://localhost:4000`. This provides a separate API server that can be deployed independently.

**Tech Stack:**

- Express
- TypeScript
- Prisma (via `@shipper/database`)
- Shared types (via `@shipper/shared`)

## Packages

### `@shipper/shared`

Shared TypeScript types, Zod schemas, and utility functions used across apps.

**Exports:**

- Type definitions (`Project`, `User`, etc.)
- Zod schemas for validation
- Utility functions (`formatDate`, `generateId`, etc.)
- API response types

### `@shipper/database`

Shared Prisma client configuration. Both apps can import the same Prisma instance.

**Exports:**

- `prisma` - Configured Prisma client
- All Prisma types

### `@shipper/config`

Shared configuration files for ESLint, TypeScript, and Prettier.

## Using Shared Packages

Import shared packages in any app:

```typescript
// In apps/api or apps/web
import { prisma } from "@shipper/database";
import { formatDate, type ApiResponse } from "@shipper/shared";

// Use shared utilities
const projects = await prisma.project.findMany();
const response: ApiResponse = {
  success: true,
  data: projects.map((p) => ({
    ...p,
    createdAt: formatDate(p.createdAt),
  })),
};
```

## Database Management

The database is managed from the `@shipper/database` package:

**Location**: `packages/database/prisma/schema.prisma`

```bash
# Generate Prisma client
pnpm db:generate

# Run migrations (development)
pnpm --filter @shipper/database db:migrate

# Deploy migrations (production)
pnpm --filter @shipper/database db:deploy

# Open Prisma Studio
pnpm --filter @shipper/database db:studio
```

The Prisma schema is located in `packages/database/prisma/` (not in the root).

## Adding New Packages

To add a new shared package:

1. Create directory: `packages/new-package/`
2. Add `package.json` with name `@shipper/new-package`
3. Build your package
4. Import in apps: `import { something } from '@shipper/new-package'`
5. Add to workspace: Already configured in `pnpm-workspace.yaml`

## Deployment

### Web App

Deploy to Vercel as usual. The workspace configuration is automatically detected.

### API

Deploy separately to any Node.js hosting:

- Railway
- Render
- Fly.io
- AWS/GCP/Azure

The API is completely independent and can be deployed on its own.

## Benefits

✅ **Code Sharing** - Share types, utilities, and database client across apps
✅ **Independent Deployment** - Deploy web and API separately
✅ **Type Safety** - End-to-end type safety with shared TypeScript types
✅ **Fast Builds** - Turborepo caching speeds up builds dramatically
✅ **Task Orchestration** - Run tasks across all packages with proper dependency management
✅ **Scalability** - Easy to add more apps or packages as you grow

## Migration Notes

- Your existing webapp code is still in the root `src/` directory
- The `apps/web/` directory contains configuration that references the root source
- No code was moved - this maintains compatibility with your existing setup
- You can gradually migrate code to the monorepo structure as needed

## Learn More

- [Turborepo Documentation](https://turbo.build/repo)
- [PNPM Workspaces](https://pnpm.io/workspaces)
