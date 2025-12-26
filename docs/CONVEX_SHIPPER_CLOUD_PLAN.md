# Shipper Cloud (Convex Integration) Implementation Plan

## Overview

Integrate Convex as "Shipper Cloud" - a backend-as-a-service for generated apps. This replaces the existing Turso database system with native Convex queries, mutations, and schema definitions.

## Key Decisions

- **Trigger**: User opt-in via explicit tool call
- **Integration**: Native Convex code generation (schema, queries, mutations)
- **Approval**: Human-in-the-loop confirmation only for deployment creation
- **Database**: Replaces Turso as the primary database option
- **Location**: New `@shipper/convex` package in `packages/`

---

## Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Flow                                │
├─────────────────────────────────────────────────────────────────┤
│  1. User asks for backend/database functionality                 │
│  2. AI generates native Convex code (schema, queries, mutations) │
│  3. AI calls `deployToShipperCloud` tool                        │
│  4. HITL confirmation dialog appears in Chat UI                  │
│  5. User approves → Convex deployment created via Management API │
│  6. Deploy key returned → CLI deploys code to Convex             │
│  7. App receives CONVEX_URL environment variable                 │
└─────────────────────────────────────────────────────────────────┘
```

### Package Structure

```
packages/convex/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                    # Main exports
│   ├── management-api.ts           # Convex Management API client
│   ├── deploy-key-manager.ts       # Deploy key creation/storage
│   ├── deployment-service.ts       # High-level deployment orchestration
│   └── types.ts                    # TypeScript types
```

---

## Implementation Steps

### Phase 1: Package Setup & Management API Client

**Files to create:**

1. **`packages/convex/package.json`**
   ```json
   {
     "name": "@shipper/convex",
     "version": "0.1.0",
     "main": "dist/index.js",
     "types": "dist/index.d.ts",
     "scripts": {
       "build": "tsc",
       "dev": "tsc --watch"
     },
     "dependencies": {
       "zod": "^3.22.0"
     }
   }
   ```

2. **`packages/convex/src/management-api.ts`**
   - Convex Management API client
   - Methods:
     - `createProject(teamId, projectName, deploymentType)` → Creates project, returns deploymentName, URL
     - `createDeployKey(deploymentName, keyName)` → Returns deploy key for CLI
     - `listProjects(teamId)` → List all projects
     - `deleteProject(projectId)` → Delete project
   - Authentication: Bearer token from `CONVEX_TEAM_ACCESS_TOKEN`

3. **`packages/convex/src/deployment-service.ts`**
   - High-level orchestration
   - `provisionBackend(projectId, projectName)` → Full flow: create project + deploy key
   - `deployCode(deployKey, cwd)` → Execute `npx convex deploy` with deploy key
   - Stores deployment info in database (new `ConvexDeployment` model)

4. **`packages/convex/src/types.ts`**
   ```typescript
   export interface ConvexProject {
     projectId: string;
     deploymentName: string;
     deploymentUrl: string;
   }

   export interface ConvexDeployKey {
     deployKey: string;
     name: string;
   }

   export interface ShipperCloudDeployment {
     shipperProjectId: string;
     convexProjectId: string;
     convexDeploymentName: string;
     convexDeploymentUrl: string;
     deployKey: string; // Encrypted
     createdAt: Date;
   }
   ```

### Phase 2: Database Schema Updates

**File: `packages/database/prisma/schema.prisma`**

Add new model:

```prisma
model ConvexDeployment {
  id                    String   @id @default(cuid())
  projectId             String   @unique
  project               Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  convexProjectId       String
  convexDeploymentName  String   @unique
  convexDeploymentUrl   String
  deployKeyEncrypted    String   // Encrypted deploy key

  status                String   @default("active") // active, deleted, error

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}
```

### Phase 3: AI Tool with Human-in-the-Loop

**File: `apps/api/src/services/ai-tools.ts`**

Add new tool using AI SDK's HITL pattern:

```typescript
// Using AI SDK 5 pattern (current stable)
const deployToShipperCloud = tool({
  description: `Deploy the current project to Shipper Cloud (Convex backend).
    This creates a production-ready backend with real-time database, functions, and file storage.
    Use this when the user wants to deploy their app or needs a persistent backend.
    REQUIRES USER CONFIRMATION before executing.`,
  parameters: z.object({
    projectName: z.string().describe("Name for the Shipper Cloud project"),
    reason: z.string().describe("Why deployment is needed (shown to user)"),
  }),
  // No execute function - enables HITL pattern
});
```

**File: `apps/web/src/modules/projects/ui/components/Chat.tsx`**

Add confirmation UI for Shipper Cloud deployment:

```typescript
// Handle tool confirmation for Shipper Cloud deployment
if (part.type === 'tool-invocation' &&
    part.toolName === 'deployToShipperCloud' &&
    part.state === 'input-available') {
  return (
    <ShipperCloudConfirmation
      projectName={part.input.projectName}
      reason={part.input.reason}
      onConfirm={async () => {
        await addToolOutput({
          toolCallId: part.toolCallId,
          tool: 'deployToShipperCloud',
          output: JSON.stringify({ approved: true }),
        });
        sendMessage();
      }}
      onDeny={async () => {
        await addToolOutput({
          toolCallId: part.toolCallId,
          tool: 'deployToShipperCloud',
          output: JSON.stringify({ approved: false, reason: 'User declined' }),
        });
        sendMessage();
      }}
    />
  );
}
```

### Phase 4: Backend Confirmation Handler

**File: `apps/api/src/routes/chat.ts`** (or equivalent)

Process the confirmation response:

```typescript
// When tool output is received for deployToShipperCloud
if (part.toolName === 'deployToShipperCloud' && part.state === 'output-available') {
  const response = JSON.parse(part.output);

  if (response.approved) {
    // Execute the deployment
    const deployment = await convexDeploymentService.provisionBackend(
      projectId,
      part.input.projectName
    );

    // Set environment variable in sandbox
    await sandbox.setEnvVar('VITE_CONVEX_URL', deployment.convexDeploymentUrl);

    // Return success to AI
    return {
      success: true,
      deploymentUrl: deployment.convexDeploymentUrl,
      message: 'Shipper Cloud backend deployed successfully'
    };
  } else {
    return {
      success: false,
      message: 'User declined deployment'
    };
  }
}
```

### Phase 5: Update Fullstack Prompt

**File: `apps/api/src/prompts/v2-full-stack-prompt.ts`**

Replace Turso database section with Convex:

```typescript
export function getShipperCloudPrompt(): string {
  return stripIndents`
🚀 SHIPPER CLOUD (Convex Backend)

Shipper Cloud provides a production-ready backend powered by Convex. It includes:
- Real-time database with automatic sync
- Type-safe queries and mutations
- File storage
- Scheduled functions (cron jobs)
- Authentication helpers

WHEN TO USE SHIPPER CLOUD:
- User mentions: database, backend, save data, persist, users, auth, real-time
- Any CRUD operations that need to persist beyond the session
- Multi-user features or authentication
- Real-time updates or collaboration features

DEPLOYMENT FLOW:
1. Generate Convex schema and functions in \`convex/\` directory
2. Call \`deployToShipperCloud\` tool (requires user confirmation)
3. After confirmation, backend is provisioned automatically
4. Use \`VITE_CONVEX_URL\` environment variable in the app

FILE STRUCTURE:
\`\`\`
convex/
├── schema.ts          # Database schema definition
├── _generated/        # Auto-generated types (don't edit)
├── queries/           # Read operations
│   └── products.ts
├── mutations/         # Write operations
│   └── products.ts
└── lib/               # Shared utilities
\`\`\`

SCHEMA DEFINITION (convex/schema.ts):
\`\`\`typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  products: defineTable({
    name: v.string(),
    price: v.number(),
    category: v.string(),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    inStock: v.boolean(),
  }).index("by_category", ["category"]),

  users: defineTable({
    name: v.string(),
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("user")),
  }).index("by_email", ["email"]),
});
\`\`\`

QUERY EXAMPLE (convex/queries/products.ts):
\`\`\`typescript
import { query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("products").collect();
  },
});

export const getByCategory = query({
  args: { category: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("products")
      .withIndex("by_category", (q) => q.eq("category", args.category))
      .collect();
  },
});
\`\`\`

MUTATION EXAMPLE (convex/mutations/products.ts):
\`\`\`typescript
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    name: v.string(),
    price: v.number(),
    category: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("products", {
      ...args,
      inStock: true,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("products"),
    name: v.optional(v.string()),
    price: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id("products") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
\`\`\`

REACT USAGE:
\`\`\`typescript
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

function ProductList() {
  // Real-time query - automatically updates when data changes
  const products = useQuery(api.queries.products.list);
  const createProduct = useMutation(api.mutations.products.create);

  const handleCreate = async () => {
    await createProduct({
      name: "New Product",
      price: 29.99,
      category: "electronics",
    });
    // No need to refetch - UI updates automatically!
  };

  if (products === undefined) return <div>Loading...</div>;

  return (
    <div>
      <button onClick={handleCreate}>Add Product</button>
      {products.map(product => (
        <div key={product._id}>{product.name}</div>
      ))}
    </div>
  );
}
\`\`\`

CONVEX PROVIDER SETUP (main.tsx):
\`\`\`typescript
import { ConvexProvider, ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ConvexProvider client={convex}>
    <App />
  </ConvexProvider>
);
\`\`\`

RULES:
✅ DO:
- Define schema first in convex/schema.ts
- Use typed queries and mutations
- Leverage indexes for efficient queries
- Use real-time queries (useQuery) for automatic updates
- Call deployToShipperCloud when backend persistence is needed

❌ DON'T:
- Don't use localStorage/sessionStorage for persistent data
- Don't create REST API endpoints (use Convex functions instead)
- Don't manually fetch/refetch data (Convex handles this)
- Don't deploy without user confirmation (tool requires approval)
`;
}
```

### Phase 6: Confirmation UI Component

**File: `apps/web/src/components/ShipperCloudConfirmation.tsx`**

```typescript
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Cloud, Check, X } from "lucide-react";

interface ShipperCloudConfirmationProps {
  projectName: string;
  reason: string;
  onConfirm: () => void;
  onDeny: () => void;
  isLoading?: boolean;
}

export function ShipperCloudConfirmation({
  projectName,
  reason,
  onConfirm,
  onDeny,
  isLoading = false,
}: ShipperCloudConfirmationProps) {
  return (
    <Card className="border-2 border-primary/20 bg-primary/5">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Cloud className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Deploy to Shipper Cloud?</CardTitle>
        </div>
        <CardDescription>
          This will create a production backend for your app
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <span className="text-sm font-medium">Project:</span>
          <span className="ml-2 text-sm">{projectName}</span>
        </div>
        <div>
          <span className="text-sm font-medium">Reason:</span>
          <p className="text-sm text-muted-foreground mt-1">{reason}</p>
        </div>
        <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
          This will provision a Convex backend with real-time database,
          type-safe functions, and automatic scaling.
        </div>
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button
          onClick={onConfirm}
          disabled={isLoading}
          className="flex-1"
        >
          <Check className="h-4 w-4 mr-2" />
          Deploy
        </Button>
        <Button
          variant="outline"
          onClick={onDeny}
          disabled={isLoading}
        >
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>
      </CardFooter>
    </Card>
  );
}
```

### Phase 7: Environment Variables

**Required environment variables:**

```bash
# Convex Team Access Token (from dashboard.convex.dev/team/settings)
CONVEX_TEAM_ACCESS_TOKEN=ey...
CONVEX_TEAM_ID=41

# Encryption key for storing deploy keys
CONVEX_DEPLOY_KEY_ENCRYPTION_SECRET=...
```

---

## Migration Strategy

### For Existing Projects (Turso)
- Existing projects continue to use Turso
- No automatic migration required
- Users can opt-in to Shipper Cloud for new features

### For New Projects
- Default to Shipper Cloud when user requests database functionality
- AI generates Convex code instead of Turso entity system
- HITL confirmation before provisioning backend

---

## Testing Plan

1. **Unit Tests**
   - Management API client methods
   - Deploy key encryption/decryption
   - Deployment service orchestration

2. **Integration Tests**
   - Full deployment flow (mock Convex API)
   - HITL confirmation flow in Chat

3. **E2E Tests**
   - Complete user flow: request → confirm → deploy → use

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Convex API changes (Beta) | Pin to specific API version, monitor changelog |
| Deploy key security | Encrypt at rest, rotate periodically |
| Rate limits on Management API | Implement retry with backoff, cache project info |
| Cost per deployment | Track deployments per user, implement limits |

---

## Timeline Estimate

- Phase 1 (Package Setup): 1-2 days
- Phase 2 (Database Schema): 0.5 days
- Phase 3 (AI Tool + HITL): 2-3 days
- Phase 4 (Backend Handler): 1 day
- Phase 5 (Prompt Update): 1 day
- Phase 6 (UI Component): 0.5 days
- Phase 7 (Testing): 2-3 days

**Total: ~8-11 days**

---

## Open Questions

1. Should we support preview deployments for branch-based development?
2. How to handle deployment cleanup when projects are deleted?
3. Should users be able to see/manage their Convex deployments directly?
4. Rate limiting strategy for deployment creation?
