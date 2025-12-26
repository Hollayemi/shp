# API Quick Start

This is a standalone Node.js/Express API that can be deployed independently of the web app.

## Installation

```bash
# From the root of the monorepo
pnpm install
```

## Development

```bash
# Start the API in development mode (with hot reload)
pnpm dev:api

# Or from this directory
cd apps/api
pnpm dev
```

The API will start on `http://localhost:4000`.

## Environment Setup

Create `.env` in this directory:

```env
PORT=4000
NODE_ENV=development
DATABASE_URL="your-database-url"
```

## Test the API

Once running, test the endpoints:

```bash
# Health check
curl http://localhost:4000/health

# Hello endpoint
curl http://localhost:4000/api/hello

# Projects endpoint
curl http://localhost:4000/api/v1/projects
```

## Build for Production

```bash
pnpm build
pnpm start
```

## Deploy

This API can be deployed to:

- **Railway**: `railway up`
- **Render**: Connect your repo and set build command to `pnpm build` and start command to `pnpm start`
- **Fly.io**: `fly deploy`
- **Vercel**: Works with Vercel serverless
- **AWS/GCP/Azure**: Standard Node.js deployment

## Using Shared Packages

The API automatically has access to shared packages:

```typescript
import { prisma } from "@shipper/database";
import { formatDate, type ApiResponse } from "@shipper/shared";
```

See `src/index.ts` for examples.
