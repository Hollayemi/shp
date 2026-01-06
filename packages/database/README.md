# @shipper/database

Prisma ORM package for the Shipper monorepo.

## Structure

```
database/
├── prisma/
│   └── schema.prisma      # Prisma schema definition
├── generated/             # Generated Prisma Client (gitignored)
│   └── prisma/
├── src/
│   └── index.ts          # Exports Prisma client instance
└── package.json
```

## Usage

Import the Prisma client in any app:

```typescript
import { prisma } from "@shipper/database";

// Query your database
const users = await prisma.user.findMany();
```

## Commands

```bash
# Generate Prisma Client
pnpm db:generate

# Run migrations (development)
pnpm db:migrate

# Deploy migrations (production)
pnpm db:deploy

# Push schema changes without migration
pnpm db:push

# Open Prisma Studio
pnpm db:studio
```

## Modifying the Schema

1. Edit `prisma/schema.prisma`
2. Run `pnpm db:migrate` to create and apply a migration
3. The Prisma Client will be regenerated automatically

## How It Works

Following [Prisma's official Turborepo guide](https://www.prisma.io/docs/guides/turborepo):

- **Schema Location**: `packages/database/prisma/schema.prisma`
- **Generated Client**: `packages/database/generated/prisma/`
- **Export Path**: Uses "exports" field in package.json for Just-in-Time packaging
- **Dependencies**: Both `prisma` (CLI) and `@prisma/client` installed in this package

The custom output path (`../generated/prisma`) ensures the generated types resolve correctly across all package managers (npm, yarn, pnpm).

## Environment Variables

Requires `DATABASE_URL` environment variable. This should be defined in:

- Root `.env` file (for local development)
- Environment variables in your deployment platform

## Troubleshooting

If you see type errors after schema changes:

```bash
# Regenerate the client
pnpm db:generate

# Or from the root
pnpm db:generate
```

If Prisma can't find your database:

```bash
# Make sure DATABASE_URL is set
echo $DATABASE_URL

# Check the .env file exists in the root
cat ../../.env
```
