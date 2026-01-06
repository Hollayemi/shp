# Shipper API

Standalone Express API server for Shipper, powered by Bun.

## Getting Started

### Development

**Important:** This API is part of a monorepo with workspace dependencies. You must use **pnpm** from the monorepo root:

```bash
# From the root of the monorepo
pnpm install

# Run the API in development mode
pnpm dev:api
```

The API will start on `http://localhost:4000` by default.

**Note:** Running `bun install` directly in `apps/api` will fail because workspace dependencies (`@shipper/database`, `@shipper/shared`) must be resolved from the monorepo root. Railway handles this automatically during deployment.

### Build

```bash
# From monorepo root
pnpm build --filter=api

# Start production server
pnpm --filter=api start
```

## Environment Variables

The API automatically uses the root `.env` file. DATABASE_URL should be defined there.

Alternatively, create a `.env` file in this directory:

```env
PORT=4000
NODE_ENV=development
DATABASE_URL="your-database-url"
```

## API Endpoints

### Health Check

- **GET** `/health` - Returns API health status and database connection

### Example Endpoints

- **GET** `/api/hello` - Simple hello world endpoint
- **GET** `/api/v1/projects` - Projects endpoint (example)

## Shared Packages

This API uses shared packages from the monorepo:

- `@shipper/database` - Prisma client and database utilities
- `@shipper/shared` - Shared types, schemas, and utilities

## Tech Stack

- **Bun** - Fast JavaScript runtime with native TypeScript support
- **Express** - Web framework
- **TypeScript** - Type safety
- **Prisma** - Database ORM (shared from `@shipper/database`)
- **Zod** - Schema validation (from `@shipper/shared`)

## Deployment

### Railway

This API is configured for deployment on Railway using Bun runtime.

**Configuration files:**

- `railway.json` - Railway deployment settings with monorepo support

**Required Environment Variables:**

- `DATABASE_URL` - Database connection string
- `NEXTAUTH_SECRET` - Authentication secret
- `NEXTAUTH_URL` - Authentication URL
- `PORT` - Auto-provided by Railway

**Deployment steps:**

1. **Import from GitHub**: When creating a new project on Railway, import your repository
   - Railway will automatically detect this is a monorepo and may stage services for each package
2. **Service Configuration** (if not auto-detected):
   - Create a new service
   - **Set the root directory to `apps/api`** in Service Settings
3. **Add Environment Variables** in the Variables tab

4. **Watch Paths** (configured in `railway.json`):
   - Set to `apps/api/**` and `packages/**` to only rebuild when relevant files change

**How it works:**

- Railway detects this is a shared monorepo with workspace dependencies
- The `railway.json` configures a custom build command that navigates to the monorepo root (`cd ../..`)
- Dependencies are installed from the root, allowing Bun to resolve workspace packages (`@shipper/database`, `@shipper/shared`)
- Watch paths prevent unnecessary rebuilds when other apps change
- The start command runs TypeScript directly, leveraging Bun's native TS support

The API runs TypeScript directly in production without requiring a separate build step.
