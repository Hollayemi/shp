# Shipper - AI-Powered Full-Stack Development Platform

An AI-powered full-stack development platform built with Next.js 15, featuring intelligent code generation, multi-provider sandbox environments, comprehensive LLM analytics, and real-time collaboration.

**🚀 Turborepo Monorepo Architecture** - See [TURBOREPO_SETUP.md](./TURBOREPO_SETUP.md) for details.

## Features

### 🤖 AI-Powered Development

- **Multi-Model Support**: OpenRouter, Azure OpenAI, Anthropic Claude, and OpenAI
- **Intelligent Code Generation**: Full-stack applications with automatic dependency management
- **Context-Aware AI**: Mem0 integration for conversational memory and project understanding
- **Web-Enhanced AI**: Exa.ai integration for real-time web search and context enrichment

### 🔧 Sandbox Environments

- **Modal**: Primary serverless sandbox provider with Git template cloning and automatic dependency installation
- **Daytona**: Legacy support for backward compatibility with existing projects

### 📊 Comprehensive Analytics & Observability

- **PostHog AI**: LLM analytics, token tracking, cost monitoring, and user behavior insights
- **Real-time Monitoring**: Sandbox health checks, performance metrics, and error tracking

### 🎯 Project Management

- **Fragment-based Architecture**: Version-controlled project states with working fragments
- **Team Collaboration**: Multi-user projects with role-based access control (Owner/Admin/Member/Viewer)
- **Credit System**: Tiered membership with usage-based billing and Stripe integration
- **Modal Sandboxes**: Fast, serverless development environments with automatic dependency installation

### 🚀 Developer Experience

- **Vercel AI SDK v5**: Unified interface for all AI models and streaming
- **Inngest**: Background jobs and Stripe webhook processing
- **tRPC v11**: Type-safe API with modular routers
- **React 19**: Latest React with Server Components
- **Tailwind CSS v4**: Modern styling with shadcn/ui components

## Getting Started

### Prerequisites

**Required:**

- Node.js 20+
- pnpm 10.17.0 or higher
- PostgreSQL database
- Modal account (primary sandbox provider)

### Environment Variables

Create a `.env` file in the project root with the following variables:

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/shipper"

# Authentication
NEXTAUTH_SECRET="your_nextauth_secret_key"
NEXTAUTH_URL="http://localhost:3000"

# AI Model Providers (at least one required)
OPENROUTER_API_KEY="your_openrouter_api_key"
ANTHROPIC_API_KEY="your_anthropic_api_key"         # Optional
OPENAI_API_KEY="your_openai_api_key"               # Optional

# Azure OpenAI (Optional)
AZURE_OPENAI_API_KEY="your_azure_openai_key"
AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com"
AZURE_OPENAI_DEPLOYMENT_NAME="your_deployment_name"

# Sandbox Provider (Modal - Required)
MODAL_TOKEN_ID="your_modal_token_id"
MODAL_TOKEN_SECRET="your_modal_token_secret"

# Legacy Sandbox Support (Optional - for backward compatibility)
DAYTONA_API_KEY="your_daytona_api_key"

# AI Features
EXA_API_KEY="your_exa_api_key"                      # For web search in HAL Chat
MEM0_API_KEY="your_mem0_api_key"                    # For conversational memory

# Analytics & Observability
POSTHOG_PROJECT_API_KEY="your_posthog_project_key"
POSTHOG_HOST="https://app.posthog.com"
NEXT_PUBLIC_POSTHOG_KEY="your_public_posthog_key"

# Stripe (for payments)
STRIPE_SECRET_KEY="your_stripe_secret_key"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="your_stripe_publishable_key"
STRIPE_WEBHOOK_SECRET="your_stripe_webhook_secret"

# Inngest (for background jobs and Stripe webhooks)
INNGEST_EVENT_KEY="your_inngest_event_key"
INNGEST_SIGNING_KEY="your_inngest_signing_key"

# API Configuration
NEXT_PUBLIC_API_URL="http://localhost:4000"         # Standalone API URL
SHIPPER_API_KEY="your_shipper_api_key"              # API authentication
```

### Installation

1. **Clone the repository:**

```bash
git clone https://github.com/your-org/Shipper-webapp.git
cd Shipper-webapp
```

2. **Install dependencies:**

```bash
pnpm install
```

3. **Set up the database:**

```bash
pnpm db:migrate:dev
pnpm db:generate
```

4. **Configure environment variables:**

Copy `.env.example` to `.env` and fill in your values (see [Environment Variables](#environment-variables) section).

5. **Run the development server:**

```bash
pnpm dev
```

The webapp will be available at [http://localhost:3000](http://localhost:3000) and the API at [http://localhost:4000](http://localhost:4000).

## Available Scripts

### Development

- `pnpm dev` - Start all apps in development mode (webapp + API)
- `pnpm dev:web` - Start only the Next.js webapp (port 3000)
- `pnpm dev:api` - Start only the standalone API server (port 4000)

### Build & Production

- `pnpm build` - Build all apps for production
- `pnpm build:web` - Build only the webapp
- `pnpm build:api` - Build only the API server
- `pnpm start` - Start all apps in production mode
- `pnpm start:web` - Start webapp in production mode
- `pnpm start:api` - Start API server in production mode

### Code Quality

- `pnpm lint` - Lint all apps
- `pnpm typecheck` - Type check all apps
- `pnpm format` - Format all code with Prettier
- `pnpm format:check` - Check code formatting

### Database (Prisma)

- `pnpm db:generate` - Generate Prisma client (required after schema changes)
- `pnpm db:migrate:dev` - Create and run migrations in development
- `pnpm db:migrate:deploy` - Deploy migrations to production
- `pnpm --filter @shipper/database db:studio` - Open Prisma Studio

## Architecture

### Monorepo Structure

```
Shipper-webapp/
├── apps/
│   ├── web/              # Next.js 15 webapp (main application)
│   │   ├── src/
│   │   │   ├── app/      # Next.js App Router pages
│   │   │   ├── lib/      # Core libraries and utilities
│   │   │   ├── modules/  # Feature modules (projects, teams, etc.)
│   │   │   └── inngest/  # Inngest workflow functions
│   │   └── package.json
│   │
│   └── api/              # Standalone Express API server
│       ├── src/
│       │   ├── routes/   # API routes
│       │   ├── services/ # Business logic (AI tools, sandboxes, credits)
│       │   └── prompts/  # AI system prompts
│       └── package.json
│
├── packages/
│   ├── database/         # Prisma schema and client
│   │   ├── prisma/       # Database schema
│   │   └── src/          # Generated Prisma client exports
│   │
│   ├── shared/           # Shared types, schemas, and utilities
│   │   └── src/          # Zod schemas, types, constants
│   │
│   └── config/           # Shared ESLint and TypeScript configs
│
├── docs/                 # Documentation
├── sandbox-templates/    # Sandbox template configurations
└── turbo.json           # Turborepo configuration
```

### Tech Stack

**Frontend:**

- Next.js 15 (App Router + Turbopack)
- React 19 (with Server Components)
- Tailwind CSS v4 + shadcn/ui
- Jotai (state management)
- Tanstack Query (data fetching)

**Backend:**

- tRPC v11 (type-safe API)
- Express (standalone API server)
- Prisma 6 (ORM)
- PostgreSQL (database)

**AI & ML:**

- Vercel AI SDK v5 (unified AI interface)
- OpenRouter / Azure OpenAI / Anthropic (LLM providers)
- Mem0 (conversational memory)
- Exa.ai (web search)

**Sandbox:**

- Modal (primary serverless sandbox provider)
- Daytona SDK (legacy support for existing projects)

**Analytics & Monitoring:**

- PostHog AI (LLM analytics & user tracking)

**Infrastructure:**

- NextAuth v5 (authentication)
- Stripe (payments & subscriptions)
- Inngest (background jobs, Stripe webhook handling)
- Turborepo (monorepo tooling)

### Sandbox Providers

| Feature          | Modal                                                                               | Daytona (Legacy)               |
| ---------------- | ----------------------------------------------------------------------------------- | ------------------------------ |
| **Status**       | ✅ Primary                                                                          | ⚠️ Backward compatibility only |
| **Type**         | Serverless                                                                          | Persistent workspaces          |
| **Best For**     | All new projects                                                                    | Existing projects only         |
| **Git Support**  | Template cloning                                                                    | Full Git workflow              |
| **Auto Install** | Yes (automatic)                                                                     | No (manual)                    |
| **Persistence**  | Session-based                                                                       | Workspace-based                |
| **Templates**    | Git branches from [vite-template](https://github.com/Shipper-dot-now/vite-template) | Pre-built snapshots            |
| **Setup Time**   | Fast (~30s)                                                                         | Slower (~2-5 min)              |

**Available Templates (Modal):**

- `database` - Full-stack app with database (default)
- `vite` - Basic Vite + React template
- `calculator` - Calculator demo app
- `content-sharing` - Content sharing app

See [apps/api/MODAL_SETUP.md](./apps/api/MODAL_SETUP.md) for detailed documentation.

## Analytics & Monitoring

### PostHog LLM Analytics

Comprehensive tracking for:

- **LLM Generation Events**: Model usage, token consumption, and costs
- **AI Tool Usage**: File editing, sandbox management, validation operations
- **User Interactions**: Project creation, fragment management, team collaboration
- **Performance Metrics**: Latency, success rates, error tracking

See [docs/posthog-integration.md](./docs/posthog-integration.md) for setup and usage.

## Key Features

### AI Agent System

Built with Vercel AI SDK v5 streaming and specialized AI agents:

- **Context Analyzer**: Analyzes user prompts and determines project requirements
- **Full-Stack Builder**: Generates complete applications with proper architecture using tool execution
- **Conversational Agent**: Handles chat interactions with memory persistence via Mem0
- **Project Validator**: Validates TypeScript, imports, dependencies, and file structure

All agents use the Vercel AI SDK for unified model access, streaming responses, and tool execution.

### Fragment-Based Architecture

Projects are managed through "fragments" - version-controlled snapshots:

- Each fragment represents a complete project state
- Files are stored as JSON in the database
- Working fragments allow iterative development
- Automatic validation before finalization

### Team Collaboration

- **Team Creation**: Users can create and manage teams
- **Role-Based Access**: Owner, Admin, Member, Viewer roles
- **Shared Projects**: Projects belong to teams, not individual users
- **Invitation System**: Email-based team invitations

### Credit System

Usage-based billing with tiered plans:

- **Free Tier**: Limited credits for exploration
- **Pro/Enterprise**: Higher limits and advanced features
- **Credit Tracking**: Real-time usage monitoring
- **Stripe Integration**: Automated subscription management via Inngest webhook handlers

## Documentation

### Setup & Configuration

- [TURBOREPO_SETUP.md](./TURBOREPO_SETUP.md) - Monorepo setup and usage guide
- [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md) - Vercel deployment instructions
- [docs/AUTHENTICATION_SETUP.md](./docs/AUTHENTICATION_SETUP.md) - NextAuth configuration
- [docs/STRIPE_INTEGRATION_GUIDE.md](./docs/STRIPE_INTEGRATION_GUIDE.md) - Payment system setup

### Features & Integrations

- [docs/posthog-integration.md](./docs/posthog-integration.md) - PostHog analytics setup
- [docs/mem0-integration.md](./docs/mem0-integration.md) - Conversational memory
- [docs/exa-integration.md](./docs/exa-integration.md) - Web search integration
- [docs/hal-chat-prd.md](./docs/hal-chat-prd.md) - HAL Chat feature documentation

### Technical Documentation

- [CLAUDE.md](./CLAUDE.md) - Development guidelines and architecture overview
- [apps/api/MODAL_SETUP.md](./apps/api/MODAL_SETUP.md) - Modal sandbox integration
- [apps/api/README.md](./apps/api/README.md) - API server documentation
- [packages/database/README.md](./packages/database/README.md) - Database schema

## Environment-Specific Configuration

The application supports different configurations for development and production:

- **Development**: Uses development-specific AI models and relaxed timeouts
- **Production**: Optimized models, stricter validation, and enhanced monitoring

See [docs/environment-differentiation.md](./docs/environment-differentiation.md) for details.

## Contributing

We welcome contributions! Please see:

- [CLAUDE.md](./CLAUDE.md) for development guidelines and coding standards
- Architecture documentation for understanding the system
- Open issues for tasks and improvements

## License

Proprietary - All rights reserved

## Support

For questions and support:

- Create an issue in this repository
- Contact the development team
- Check the `/docs` directory for detailed documentation
# shp
