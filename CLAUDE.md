# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo Structure (Turborepo)

This project is a **Turborepo monorepo** with the following structure:

- **apps/web** - Next.js 15 webapp (main application, source in `apps/web/src/`)
- **apps/api** - Standalone Node.js/Express API server
- **packages/database** - Shared Prisma client (`@shipper/database`)
- **packages/shared** - Shared types, Zod schemas, utilities (`@shipper/shared`)
- **packages/config** - Shared ESLint and TypeScript configs

The webapp source code is located in `apps/web/src/` NOT in the root `src/` directory.

## Development Commands

### Monorepo Commands

**Development:**
- `pnpm dev` - Start all apps in development mode
- `pnpm dev:web` - Start only the Next.js webapp (port 3000)
- `pnpm dev:api` - Start only the API server (port 4000)

**Build & Deploy:**
- `pnpm build` - Build all apps
- `pnpm build:web` - Build only the webapp
- `pnpm build:api` - Build only the API server
- `pnpm start` - Start all apps in production mode

**Quality:**
- `pnpm lint` - Lint all apps
- `pnpm typecheck` - Type check all apps
- `pnpm format` - Format code with Prettier
- `pnpm format:check` - Check code formatting

### Database (Prisma)

**Location:** `packages/database/prisma/schema.prisma`

**Commands:**
- `pnpm db:generate` - Generate Prisma client (required after schema changes)
- `pnpm db:migrate:dev` - Create and apply migrations in development
- `pnpm db:migrate:deploy` - Deploy migrations to production
- `pnpm --filter @shipper/database db:studio` - Open Prisma Studio

**IMPORTANT:** When making database schema changes:
1. Edit `packages/database/prisma/schema.prisma`
2. Run `pnpm db:migrate:dev name_of_migration` to create migration
3. Run `pnpm db:generate` to update Prisma client and auto-generate exports

**Note:** `pnpm db:generate` automatically runs `scripts/generate-exports.js` to create explicit exports from the Prisma client, avoiding Next.js CommonJS module warnings. The generated `src/index.ts` should not be edited manually.

### Testing Scripts

Test scripts are located in `scripts/` directory and use `tsx` for execution:

- `tsx scripts/test-azure-openai.ts` - Test Azure OpenAI integration
- `tsx scripts/test-inngest-workflow.ts` - Test Inngest workflow
- `tsx scripts/test-sandbox-manager.ts` - Test sandbox manager
- `tsx scripts/test-azure-model-direct.ts` - Test Azure model direct
- `tsx scripts/test-agent-with-workflow-prompt.ts` - Test agent with workflow prompt

All scripts use `#!/usr/bin/env tsx` shebang and can be run directly if executable.

## Architecture Overview

### Core Technologies

- **Next.js 15** with App Router and Turbopack for fast development
- **React 19** with RSC (React Server Components)
- **tRPC v11** for type-safe API with modular routers
- **Prisma 6** with PostgreSQL for data persistence
- **NextAuth v5** for authentication (Google, GitHub, credentials)
- **Stripe** for payments and credit system
- **Inngest** for background workflows and AI agent orchestration
- **E2B Code Interpreter** for sandbox environments
- **Daytona SDK** for alternative sandbox environments
- **Anthropic/OpenAI/Azure OpenAI** for AI capabilities
- **PostHog** for LLM analytics and AI tool usage tracking
- **Mem0** for conversational memory in AI Advisor
- **Exa.ai** for web search in HAL Chat
- **Tailwind CSS v4** with shadcn/ui components
- **Turborepo** for monorepo management

### Key Systems

#### Authentication & Authorization

- **NextAuth v5** with database session strategy (not JWT)
- Multi-provider auth: Google, GitHub, Email/Password
- Role-based access: `USER` | `ADMIN` (system-wide roles)
- Team-based access: `OWNER` | `ADMIN` | `MEMBER` | `VIEWER` (team roles)
- Protected tRPC procedures with session validation
- User-specific project isolation (legacy personal projects)
- Team-based project organization (current approach)

See [docs/AUTHENTICATION_SETUP.md](docs/AUTHENTICATION_SETUP.md) for details.

#### AI Agent Architecture

**Inngest-powered agent workflows:**
- Context analyzer agent (`apps/web/src/inngest/agents/context-analyser.ts`)
- Conversational agent (`apps/web/src/inngest/agents/conversational-agent.ts`)
- Full-stack builder agent (`apps/web/src/inngest/agents/fullstack-builder.ts`)
- Project validator agent (`apps/web/src/inngest/agents/project-validator.ts`)

**AI Tools System:**
- V2 tools architecture (`apps/web/src/lib/ai/v2-tools.ts`)
- Tools include: `createOrEditFiles`, `executeCommand`, `readFiles`, `listFiles`, etc.
- Fragment-based project state management
- Comprehensive validation (file structure, imports, TypeScript, dependencies)

**Memory Systems:**
- **Mem0** for conversational memory in AI Advisor (replaces static project analysis)
- User/project-scoped memories for context-aware responses
- Environment variable: `MEM0_API_KEY`

**Model Integration:**
- Azure OpenAI with `gpt-4o-mini` deployment
- Anthropic Claude models
- OpenRouter integration for additional models
- PostHog LLM tracking for all AI operations

#### Sandbox Management

**Current System:**
- Single active sandbox per user (tracked in User model)
- E2B Code Interpreter with `shipper-vite-13` template
- Daytona SDK integration (alternative sandbox provider)
- Sandbox managers:
  - `apps/web/src/lib/sandbox-manager.ts` - E2B sandbox manager
  - `apps/web/src/lib/daytona-sandbox-manager.ts` - Daytona sandbox manager

**User Tracking Fields:**
```prisma
activeProjectId     String?   // Which project has the active sandbox
activeFragmentId    String?   // Which fragment is currently active
activeSandboxId     String?   // Current active sandbox ID
sandboxCreatedAt    DateTime?
sandboxLastUsedAt   DateTime?
```

**Key Features:**
- Automatic sandbox cleanup and health monitoring
- Fragment-based file restoration
- Comprehensive file change tracking during command execution
- Health checks and recovery with automatic recreation
- Sandbox expiration tracking

#### Daytona Integration Architecture

**Current State (Dual Mode):**

Daytona functionality is available through two paths:

1. **API Server** (`apps/api`) - **NEW & RECOMMENDED**
   - Standalone API with all Daytona SDK functionality
   - 15 REST endpoints at `/api/v1/daytona/*`
   - Independent deployment and scaling
   - Environment: `DAYTONA_API_KEY` (server-side only)

2. **Direct SDK** (`apps/web`) - **LEGACY**
   - Currently still used by ErrorDetector and VoltAgentService
   - Deep integration with existing libraries
   - Will be phased out incrementally

**API Server Components:**

Location: `apps/api/src/services/`
- `daytona.ts` - Client configuration
- `daytona-sandbox-manager.ts` - Main sandbox operations (90KB)
- `sandbox-compat.ts` - Command execution compatibility
- `daytona-playwright-manager.ts` - Playwright integration (14KB)
- `validation-utils.ts` - Project validation utilities
- `types.ts` - Shared TypeScript types

**API Endpoints:** `/api/v1/daytona/*`

Sandbox Management:
- `GET /sandbox/:projectId` - Get sandbox info
- `POST /sandbox` - Create new sandbox
- `POST /sandbox/start` - Start sandbox
- `POST /sandbox/dev-server` - Start dev server
- `DELETE /sandbox/:sandboxId` - Delete sandbox

Fragment & Git:
- `POST /fragment/restore` - Restore V2 fragment
- `POST /git/commit` - Create git commit
- `POST /git/switch` - Switch to commit
- `POST /files/restore` - Restore files

File Operations:
- `POST /command/execute` - Execute command
- `POST /file/read` - Read file
- `POST /file/write` - Write file

Playwright:
- `POST /playwright/check` - Runtime error check
- `DELETE /playwright/cleanup` - Cleanup sandbox
- `GET /playwright/status` - Get status

**Using the API Client:**

```typescript
import { daytonaAPI } from "@/lib/api/daytona-client";

// Get sandbox
const sandboxInfo = await daytonaAPI.getSandbox(projectId);

// Create sandbox
const info = await daytonaAPI.createSandbox(projectId, fragmentId, "vite-template-v4");

// Execute command
const result = await daytonaAPI.executeCommand(sandboxId, "npm run build", { timeoutMs: 60000 });

// File operations
const content = await daytonaAPI.readFile(sandboxId, "src/App.tsx");
await daytonaAPI.writeFile(sandboxId, "src/App.tsx", newContent);

// Playwright check
const errors = await daytonaAPI.runPlaywrightCheck("https://preview-url.shipper.now");
```

**Environment Variables:**
- API Server: `DAYTONA_API_KEY`, `DAYTONA_API_URL` (optional), `SHIPPER_API_KEY`
- Webapp: `NEXT_PUBLIC_API_URL` (e.g., http://localhost:4000), `SHIPPER_API_KEY`

**Security:**
- API endpoints protected with API key authentication
- All requests require `x-api-key` header with matching `SHIPPER_API_KEY`
- Health check endpoint (`/health`) excluded from authentication
- DAYTONA_API_KEY isolated to API server only

**Migration Status:**

✅ Complete:
- API infrastructure (15 endpoints)
- API client library
- Service layer migration
- Comprehensive documentation

⏳ Pending:
- ErrorDetector refactoring to use API
- VoltAgentService refactoring to use API
- Webapp route updates
- SDK removal from webapp

**Documentation:**
- `DAYTONA_MIGRATION_COMPLETE.md` - Full analysis and recommendations
- `docs/DAYTONA_API_MIGRATION.md` - API documentation
- `DAYTONA_MIGRATION_QUICK_REF.md` - Code migration guide

**Development Commands:**

```bash
pnpm dev:api    # Development mode on port 4000
pnpm build:api  # Build for production
pnpm start:api  # Start production server

# Test API health
curl http://localhost:4000/health
curl http://localhost:4000/api/v1/daytona/sandbox/PROJECT_ID
```

**Future Plans:**
1. Short-term: Create high-level API endpoints for complex operations
2. Medium-term: Migrate ErrorDetector and VoltAgentService to API
3. Long-term: Remove Daytona SDK from webapp entirely

#### Fragment System (Project State Management)

**V2Fragment** (current system):
- Stores complete project file state
- Working fragment support (draft state)
- Fragment finalization with `finalizeWorkingFragment` tool
- Replaces legacy message-based fragments
- Tracked at project level with `activeFragmentId`

**Legacy Fragment** (v1):
- Attached to messages
- Maintained for backward compatibility
- New projects use `messagingVersion: 2`

#### Credit System & Billing

- **Membership Tiers:** `FREE` | `PRO` | `ENTERPRISE`
- **Credit Operations:** `AI_GENERATION`, `SANDBOX_USAGE`, etc.
- **Stripe Integration:** One-time credit purchases and subscriptions
- **Credit Tracking:**
  - `creditBalance` - Current available credits
  - `lifetimeCreditsUsed` - Total credits used ever
  - `monthlyCreditsUsed` - Resets monthly
  - `CreditTransaction` model for all operations

See [docs/STRIPE_INTEGRATION_GUIDE.md](docs/STRIPE_INTEGRATION_GUIDE.md) for complete details.

### tRPC Architecture

**Router Structure** (`apps/web/src/modules/`):
- `projects` - Project management and sandbox operations
- `messages` - V2 messaging system for conversations
- `users` - User management and profile
- `teams` - Team management and membership
- `admin` - Admin dashboard operations (user/project management)
- `credits` - Credit operations and transactions
- `checkout` - Stripe checkout and payments
- `prompt-presets` - Reusable AI prompts

**tRPC Client Usage:**

```typescript
import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation } from "@tanstack/react-query";

// In components
const trpc = useTRPC();

// Queries
const { data, isLoading, error } = useQuery({
  ...trpc.projects.getSandboxStatus.queryOptions(),
  enabled: !!projectId, // Conditional execution
});

// Mutations
const mutation = useMutation(
  trpc.projects.recoverV2ProjectSandbox.mutationOptions({
    onSuccess: (result) => { /* ... */ },
    onError: (error) => { /* ... */ },
  })
);

// Direct calls (non-reactive)
const result = await trpc.projects.getSandboxFileContent.query({ projectId, filePath });
```

### Database Schema Highlights

**User Model:**
- Single-sandbox-per-user tracking fields
- Credit balance and usage tracking
- Team memberships via `TeamMember` relation
- Personal projects (legacy) and team projects (current)

**Project Model:**
- Can belong to User (legacy) or Team (current approach)
- Tracks `activeFragmentId` for current state
- `messagingVersion: 1 | 2` determines fragment system

**Team System:**
- Teams with multiple members
- Role-based permissions (`OWNER`, `ADMIN`, `MEMBER`, `VIEWER`)
- Team-owned projects

**Fragment Systems:**
- `V2Fragment` - Current fragment system with working fragments
- `Fragment` (legacy) - Attached to messages

**Credit System:**
- `CreditPurchase` - One-time credit purchases
- `CreditTransaction` - All credit operations
- `Subscription` - Stripe subscription tracking

### PostHog Analytics Integration

**LLM Generation Tracking:**
- `@posthog/ai` SDK integration for all AI operations
- Tracks tokens, costs, latency, success/failure
- Model usage analytics across Azure OpenAI, Anthropic, OpenRouter

**AI Tool Usage Tracking:**
- All v2-tools operations tracked
- Tool-specific analytics with parameters and outcomes
- Success/failure rates and performance metrics

**Event Categories:**
- LLM generation events (context analysis, code generation)
- AI tool usage (file editing, command execution, validation)
- Project lifecycle (creation, fragment switching, deployment)
- Sandbox management (creation, recovery, health checks)

**Environment Variables:**
- `POSTHOG_PROJECT_API_KEY` - Server-side tracking
- `POSTHOG_HOST` - PostHog instance URL
- `NEXT_PUBLIC_POSTHOG_KEY` - Client-side tracking

See [docs/posthog-integration.md](docs/posthog-integration.md) for complete setup.

### HAL Chat & AI Advisor

**HAL Chat Features:**
- Conversational AI assistant for project guidance
- Mem0 integration for conversational memory
- Exa.ai integration for web search capabilities
- Empathetic responses focused on user goals (not metrics)

**Key Components:**
- Chat API route: `apps/web/src/app/api/hal-chat/route.ts`
- Memory management: `apps/web/src/lib/mem0-memory.ts`
- Web search tool: `apps/web/src/lib/exa-tool.ts`

See [docs/mem0-integration.md](docs/mem0-integration.md) and [docs/exa-integration.md](docs/exa-integration.md).

## Project Structure

```
apps/web/src/
├── app/              # Next.js 15 App Router pages
├── components/       # Reusable UI components (shadcn/ui)
├── modules/          # tRPC routers and business logic
├── lib/              # Core utilities (auth, db, sandbox, credits)
├── inngest/          # Background job functions and AI agents
├── trpc/             # tRPC client setup
├── hooks/            # React hooks
├── helpers/          # Helper functions
└── data/             # Static data

packages/
├── database/         # Prisma schema, migrations, client
├── shared/           # Shared types, Zod schemas, utilities
└── config/           # ESLint, TypeScript configs

scripts/              # Development and testing utilities
docs/                 # Comprehensive documentation
```

## Important Development Notes

### Database Schema Changes

**Always create migrations, never edit migration files directly:**

```bash
# 1. Edit packages/database/prisma/schema.prisma
# 2. Create migration
pnpm db:migrate:dev descriptive_migration_name
# 3. Regenerate Prisma client
pnpm db:generate
```

### Shared Packages Usage

Import shared packages using workspace aliases:

```typescript
import { prisma } from "@shipper/database";
import { formatDate, type ApiResponse } from "@shipper/shared";
```

### V2 Messaging System

New projects use `messagingVersion: 2`:
- Fragment system for project state (not message-based)
- Working fragments require finalization
- Use `finalizeWorkingFragment` tool to complete work sessions

### Sandbox Management

- Only one active sandbox per user at a time
- Automatic cleanup on project switching
- Health monitoring with automatic recovery
- Fragment restoration on sandbox creation

### AI Agent Tools

**Use correct tool names:**
- `createOrEditFiles` - Single file creation/editing (correct)
- ~~`createOrUpdateFiles`~~ - Old name (incorrect)

**Available tools:**
- File operations: `createOrEditFiles`, `readFiles`, `listFiles`
- Command execution: `executeCommand`
- Project management: `finalizeWorkingFragment`
- Validation: Project structure, imports, TypeScript, dependencies

### Environment Variables Required

See `turbo.json` for complete list. Key variables:

**Core:**
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET`, `NEXTAUTH_URL` - Authentication
- `NEXT_PUBLIC_APP_URL` - App URL

**AI Providers:**
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`
- `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT_NAME`
- `OPENROUTER_API_KEY` - OpenRouter integration
- `MEM0_API_KEY` - Mem0 conversational memory
- `EXA_API_KEY` - Exa.ai web search

**Sandbox:**
- `E2B_API_KEY` - E2B Code Interpreter
- `DAYTONA_API_KEY` - Daytona sandbox (API server only)
- `DAYTONA_API_URL` - Custom Daytona API URL (optional)
- `NEXT_PUBLIC_API_URL` - API server URL (e.g., http://localhost:4000)
- `SHIPPER_API_KEY` - Shared secret for Shipper API authentication (required for both webapp and API server)

**Billing:**
- `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`

**Analytics:**
- `POSTHOG_PROJECT_API_KEY`, `POSTHOG_HOST`, `NEXT_PUBLIC_POSTHOG_KEY`
- `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_HOST` (optional)

**Inngest:**
- `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`

**AWS (S3):**
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET_NAME`

## Documentation

Comprehensive documentation in `/docs`:

- [TURBOREPO_SETUP.md](TURBOREPO_SETUP.md) - Monorepo setup and usage
- [docs/AUTHENTICATION_SETUP.md](docs/AUTHENTICATION_SETUP.md) - Auth system details
- [docs/STRIPE_INTEGRATION_GUIDE.md](docs/STRIPE_INTEGRATION_GUIDE.md) - Payment system
- [docs/posthog-integration.md](docs/posthog-integration.md) - LLM analytics
- [docs/mem0-integration.md](docs/mem0-integration.md) - Conversational memory
- [docs/exa-integration.md](docs/exa-integration.md) - Web search integration
- [docs/SANDBOX_CLEANUP.md](docs/SANDBOX_CLEANUP.md) - Sandbox management
- [docs/ADMIN_PROJECTS_DASHBOARD.md](docs/ADMIN_PROJECTS_DASHBOARD.md) - Admin features
- [docs/DAYTONA_API_MIGRATION.md](docs/DAYTONA_API_MIGRATION.md) - Daytona API migration guide
- [docs/API_AUTHENTICATION.md](docs/API_AUTHENTICATION.md) - API authentication setup and testing
- [DAYTONA_MIGRATION_COMPLETE.md](DAYTONA_MIGRATION_COMPLETE.md) - Daytona migration analysis
- [DAYTONA_MIGRATION_QUICK_REF.md](DAYTONA_MIGRATION_QUICK_REF.md) - Quick reference for code migration
- Various other technical documentation and session summaries

## Recent Major Improvements

### Monorepo Migration
- Converted to Turborepo for better code sharing and deployment flexibility
- Shared Prisma client across apps
- Independent web and API deployments

### V2 Systems
- **V2 AI Tools** - Improved tool definitions and context management
- **V2 Fragment System** - Better project state management with working fragments
- **V2 Messaging** - Enhanced conversation system (default for new projects)
- **V2 Sandbox Manager** - Improved creation, recovery, and fragment restoration

### Analytics & Memory
- **PostHog LLM Analytics** - Complete tracking of AI operations and tool usage
- **Mem0 Integration** - Conversational memory replaces static project analysis
- **Intelligent Context** - AI remembers user journey and past conversations

### Admin & Billing
- **Admin Dashboard Pagination** - Server-side pagination with search and filtering
- **Separate Stats Loading** - Optimized queries for large user bases
- **Enhanced Stripe Integration** - Complete credit system with subscriptions

### Sandbox Improvements
- **Health Monitoring** - Automatic health checks with intelligent cooldown
- **Smart Recovery** - Automatic sandbox recreation when needed
- **Visibility-based Checks** - Health checks trigger when user returns
- **Fragment Restoration** - Automatic restoration of project state in new sandboxes

### Daytona API Migration
- **API Server Architecture** - Moved Daytona SDK to standalone API server
- **15 REST Endpoints** - Complete API for sandbox operations at `/api/v1/daytona/*`
- **Independent Deployment** - API and webapp can scale independently
- **API Client Library** - Type-safe client for webapp integration
- **Dual Mode Support** - Legacy SDK integration maintained during transition
- Always remember if a variable is not reassigned then use const
- NEVER USE ANY, DON"T BE LAZY
- If you write a markdown file, put it in the docs folder