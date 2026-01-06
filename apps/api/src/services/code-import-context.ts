/**
 * Code Import Context Generator
 *
 * Generates context messages for the AI when working with imported projects.
 * This helps the AI understand the existing codebase structure and follow
 * appropriate patterns rather than assuming a fresh template.
 */

import type { UIMessage } from "ai";

interface CodeImport {
  id: string;
  source: string;
  sourceName: string;
  sourceBranch?: string | null;
  detectedFramework?: string | null;
  detectedLanguage?: string | null;
  fileCount?: number | null;
  totalSizeBytes?: number | null;
  importedFrom?: string | null;
}

type BackendMigrationStatus =
  | "NOT_NEEDED"
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "SKIPPED"
  | "FAILED";

type ImportedFromPlatform =
  | "LOVABLE"
  | "BASE44"
  | "BOLT"
  | "V0"
  | "GENERIC_VITE"
  | "OTHER";

interface ProjectWithCodeImport {
  id: string;
  name: string;
  codeImport?: CodeImport | null;
  importedFrom?: ImportedFromPlatform | null;
  backendMigrationStatus?: BackendMigrationStatus | null;
}

/**
 * Get framework-specific guidelines for the AI
 */
function getFrameworkGuidelines(framework: string): string {
  const guidelines: Record<string, string> = {
    vite: `This is a Vite project. Key guidelines:
- Use import.meta.env for environment variables
- Static assets go in the public/ directory
- Check vite.config.ts/js for existing plugins and configuration
- HMR is available for fast development feedback`,

    unknown: `Framework not detected. Key guidelines:
- Explore the file structure to understand the architecture
- Check package.json for dependencies and scripts
- Follow existing patterns and conventions`,
  };

  return guidelines[framework.toLowerCase()] || guidelines.unknown;
}

/**
 * Get platform-specific migration instructions
 */
function getMigrationInstructions(platform: ImportedFromPlatform): string {
  const instructions: Record<ImportedFromPlatform, string> = {
    LOVABLE: `### Lovable (Supabase) Migration - ONLY MIGRATE WHAT WAS DETECTED

This project was built with Lovable and uses Supabase for backend.

## 🚫 NEVER DO THESE (Common Mistakes):
- ❌ Migrate features that weren't detected in Step 1
- ❌ Delete the entire convex/ directory and recreate it
- ❌ Keep both old Supabase code AND new Convex code for the same feature
- ❌ Skip the detection step and assume what features exist

## Migration Steps

#### Step 1: CALL getFiles() FIRST (MANDATORY)
**You MUST call getFiles() before ANY file modifications.** The system will block your edits if you skip this.

Then scan the codebase and LIST what you find. Only migrate what you detect:
- **Auth**: \`supabase.auth\`, \`AuthContext\`, \`useAuth\`, \`signIn\`, \`signOut\`, \`session\`
- **Database**: \`.from('table_name')\`, \`supabase.from\`, SQL queries
- **Edge Functions**: \`supabase/functions/\` directory
- **Stripe**: \`stripe\`, \`@stripe/stripe-js\`, \`checkout\`, \`subscription\`, \`payment\`
- **AI/LLM**: \`openai\`, \`anthropic\`, \`gpt\`, \`claude\`, \`generateText\`, \`chat\`, \`completion\`
- **Email**: \`sendEmail\`, \`resend\`, \`nodemailer\`

**After scanning, state: "Detected: [list features found]. Will migrate: [same list]. Will NOT migrate: [features not found]."**

#### Step 2: Auth Migration (if auth detected)
- Follow the "🚀 SHIPPER CLOUD" section - use deployToShipperCloud tool first, then scaffoldConvexSchema

#### Step 3: Database Migration (if database detected)
- Follow the "🚀 SHIPPER CLOUD" section - use scaffoldConvexSchema tool to create tables

#### Step 4: Stripe Integration (ONLY if Stripe detected)
- Skip if not detected in Step 1
- Follow the "## 💳 STRIPE INTEGRATION (Payments)" section

#### Step 5: AI/LLM Integration (ONLY if AI detected)
- Skip if not detected in Step 1
- Follow the "🤖 AI INTEGRATION" section - use enableAI tool

#### Step 6: Cleanup (DO THIS LAST)
- Remove @supabase/supabase-js from package.json
- Delete supabase/ directory if it exists
- Remove unused Supabase imports
- Do NOT remove anything that wasn't migrated

**CRITICAL**: Only migrate features you detected in Step 1. Do NOT migrate features that don't exist in the codebase.`,

    BASE44: `### Base44 Migration - ONLY MIGRATE WHAT WAS DETECTED

This project was built with Base44 and uses the @base44/sdk.

## ⚠️ CRITICAL: Location-Based Language Rules
\`\`\`
src/           → JavaScript ONLY (.js, .jsx) - NEVER change these to TypeScript
convex/        → TypeScript ONLY (.ts) - Convex REQUIRES this
config files   → Keep original extension (usually .js)
\`\`\`

## 🚫 NEVER DO THESE (Common Mistakes That Break Everything):
- ❌ Create \`convex/schema.js\` - ONLY \`convex/schema.ts\` is valid
- ❌ Keep both schema.js AND schema.ts - delete the .js, keep .ts
- ❌ Convert src/ files to TypeScript - they MUST stay .js/.jsx
- ❌ Add TypeScript syntax (types, interfaces) to .js files
- ❌ Delete and recreate the entire convex/ directory
- ❌ Change file extensions to "fix" errors
- ❌ Migrate features that weren't detected in Step 1
- ❌ Import \`Id\` or \`Doc\` from \`convex/_generated/dataModel\` in .js/.jsx files - THESE ARE TYPESCRIPT TYPES AND DON'T EXIST IN JS

## 🛑🛑🛑 CRITICAL: DO NOT CREATE src/api/entities.js 🛑🛑🛑

**THIS IS THE #1 CAUSE OF BROKEN BASE44 MIGRATIONS!**

The AI keeps making this mistake:
\`\`\`javascript
// ❌ WRONG - src/api/entities.js with bare import (WILL BREAK!)
import { api } from "convex/_generated/api";  // ERROR: Cannot resolve bare specifier
\`\`\`

**THE FIX IS SIMPLE: DO NOT CREATE THIS FILE AT ALL!**

- DELETE \`src/api/entities.js\` entirely - do NOT replace it
- DELETE \`src/api/base44Client.js\` entirely - do NOT replace it  
- Components import Convex DIRECTLY where they need it (see below)

## ✅ CORRECT Convex Import Pattern for JavaScript:

**In src/pages/*.jsx or src/components/*.jsx (2 levels deep):**
\`\`\`javascript
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";  // ✅ RELATIVE PATH with correct depth!

function MyComponent() {
  const posts = useQuery(api.posts.list);
  const createPost = useMutation(api.posts.create);
}
\`\`\`

**In src/App.jsx (1 level deep):**
\`\`\`javascript
import { api } from "../convex/_generated/api";  // ✅ One less ../
\`\`\`

**IMPORT PATH RULES:**
- \`src/App.jsx\` → \`"../convex/_generated/api"\` (1 level up)
- \`src/pages/*.jsx\` → \`"../../convex/_generated/api"\` (2 levels up)
- \`src/components/*.jsx\` → \`"../../convex/_generated/api"\` (2 levels up)
- \`src/components/ui/*.jsx\` → \`"../../../convex/_generated/api"\` (3 levels up)

**NEVER use bare specifier \`"convex/_generated/api"\`** - it only works in TypeScript projects with proper tsconfig paths!

## Migration Steps

#### Step 1: CALL getFiles() FIRST (MANDATORY)
**You MUST call getFiles() before ANY file modifications.** The system will block your edits if you skip this.

Then scan the codebase and LIST what you find. Only migrate what you detect:
- **Auth**: \`base44.auth\`, \`auth.me()\`, \`logout()\`, \`updateMe()\`, \`useAuth\`
- **Entities**: \`src/api/entities.js\`, \`entities.\`, \`.create(\`, \`.update(\`, \`.delete(\`, \`.list(\`
- **AI/LLM**: \`InvokeLLM\`, \`invokeLLM\`, \`generateText\`, \`chat\`, \`completion\`
- **Email**: \`SendEmail\`, \`sendEmail\`
- **File Upload**: \`UploadFile\`, \`uploadFile\`
- **Image Gen**: \`GenerateImage\`, \`generateImage\`
- **Stripe**: \`stripe\`, \`payment\`, \`checkout\`, \`subscription\`

**After scanning, state: "Detected: [list features found]. Will migrate: [same list]. Will NOT migrate: [features not found]."**

#### Step 2: Auth Migration (if auth detected)
- Follow the "� SHIPPER CLOUD" section - use deployToShipperCloud tool first, then scaffoldConvexSchema

#### Step 3: Entity/Database Migration (if entities detected)
- Follow the "� SHIPPER CLOUD" section - use scaffoldConvexSchema tool to create tables
- convex/ files MUST be .ts (TypeScript) - this is required by Convex
- src/ files MUST stay .js/.jsx - do NOT convert them
- **🛑 DELETE \`src/api/entities.js\` and \`src/api/base44Client.js\` - DO NOT REPLACE THEM!**
- Update each component file to import Convex directly with RELATIVE path:
  \`import { api } from "../../convex/_generated/api";\` (adjust ../ count based on file depth)

#### Step 4: AI/LLM Integration (ONLY if InvokeLLM detected)
- Skip if not detected in Step 1
- Follow the "🤖 AI INTEGRATION" section - use enableAI tool

#### Step 5: Stripe Integration (ONLY if payments detected)
- Skip if not detected in Step 1
- Follow the "## 💳 STRIPE INTEGRATION (Payments)" section

#### Step 6: File Upload (ONLY if UploadFile detected)
- Skip if not detected in Step 1
- Use Convex file storage

#### Step 7: Cleanup (DO THIS LAST)
- Remove @base44/sdk from package.json
- Delete src/api/base44Client.js if no longer needed
- Remove unused Base44 imports
- Do NOT remove anything that wasn't migrated

**CRITICAL**: Only migrate features you detected in Step 1. Do NOT migrate features that don't exist in the codebase.`,

    BOLT: `### Bolt Migration - ONLY MIGRATE WHAT WAS DETECTED

This project was built with Bolt. Analyze the codebase to identify backend integrations.

## 🚫 NEVER DO THESE (Common Mistakes):
- ❌ Migrate features that weren't detected in Step 1
- ❌ Delete the entire convex/ directory and recreate it
- ❌ Skip the detection step and assume what features exist

## Migration Steps

#### Step 1: SCAN & DETECT (REQUIRED FIRST - DO NOT SKIP)
Scan the codebase and LIST what you find. Only migrate what you detect:
- **Auth**: Authentication patterns, session management
- **Database**: Data fetching, storage patterns
- **Stripe**: \`stripe\`, \`@stripe/stripe-js\`, \`checkout\`, \`subscription\`, \`payment\`
- **AI/LLM**: \`openai\`, \`anthropic\`, \`generateText\`, \`chat\`, \`completion\`

**After scanning, state: "Detected: [list features found]. Will migrate: [same list]. Will NOT migrate: [features not found]."**

Then follow the corresponding system prompt sections for each detected feature.

**CRITICAL**: Only migrate features you detected in Step 1. Do NOT migrate features that don't exist in the codebase.`,

    V0: `### V0 Migration - ONLY MIGRATE WHAT WAS DETECTED

This project was built with V0. V0 projects are typically frontend-only UI components.

## 🚫 NEVER DO THESE (Common Mistakes):
- ❌ Migrate features that weren't detected in Step 1
- ❌ Assume backend features exist when they don't
- ❌ Skip the detection step

## Migration Steps

#### Step 1: SCAN & DETECT (REQUIRED FIRST - DO NOT SKIP)
Scan the codebase and LIST what you find. V0 projects often have minimal backend:
- **Auth**: Check for any authentication patterns
- **Database**: Check for any data persistence
- **API calls**: Check for external API integrations

**After scanning, state: "Detected: [list features found]. Will migrate: [same list]. Will NOT migrate: [features not found]."**

If no backend features detected, no migration is needed - just integrate with Shipper's backend as needed.

**CRITICAL**: Only migrate features you detected in Step 1. Do NOT migrate features that don't exist in the codebase.`,

    GENERIC_VITE: `No backend migration needed - this is a standard Vite/React project.`,
    OTHER: `Backend structure unknown. Analyze the codebase to determine if migration is needed.`,
  };

  return instructions[platform] || instructions.OTHER;
}

/**
 * Generate context messages for an imported project
 */
export function getCodeImportContext(
  project: ProjectWithCodeImport,
): UIMessage[] {
  if (!project.codeImport) {
    return [];
  }

  const { codeImport } = project;
  const framework = codeImport.detectedFramework || "unknown";
  const language = codeImport.detectedLanguage || "unknown";
  const fileCount = codeImport.fileCount || 0;
  const importedFrom = project.importedFrom;
  const migrationStatus = project.backendMigrationStatus;

  // Build the base context message
  let contextMessage = `## IMPORTED PROJECT CONTEXT

This project was imported from an existing codebase. Important guidelines:

### Source Information
- **Source**: ${codeImport.source} (${codeImport.sourceName})${codeImport.sourceBranch ? ` - Branch: ${codeImport.sourceBranch}` : ""}
- **Framework**: ${framework}
- **Language**: ${language}
- **Files**: ${fileCount} files imported
- **Original Platform**: ${importedFrom || "Unknown"}
- **Backend Migration Status**: ${migrationStatus || "Unknown"}
${importedFrom === "BASE44" ? `\n### ⚠️ JAVASCRIPT PROJECT WITH TYPESCRIPT BACKEND\n**CRITICAL**: This Base44 project uses JavaScript for frontend, but Convex REQUIRES TypeScript.\n\n**LOCATION-BASED RULES (NEVER BREAK THESE):**\n- \`src/\` directory → JavaScript ONLY (.js, .jsx) - NEVER change to .ts/.tsx\n- \`convex/\` directory → TypeScript ONLY (.ts) - This is a Convex requirement\n- Config files (vite.config.js, etc.) → Keep as JavaScript\n- NEVER mix .js and .ts files in the same directory\n\n**This is normal and works fine** - Convex compiles separately from your app.\n\n### 🚫 NEVER DO THESE (Common Mistakes):\n- ❌ Create \`convex/schema.js\` - ONLY \`convex/schema.ts\` is valid\n- ❌ Keep both schema.js AND schema.ts - pick ONE (the .ts version)\n- ❌ Convert src/ files to TypeScript - they MUST stay .js/.jsx\n- ❌ Add TypeScript syntax to .js files (no type annotations, interfaces, generics)\n- ❌ Delete and recreate the entire convex/ directory\n- ❌ Change file extensions to "fix" TypeScript errors\n- ❌ Create placeholder files like "actual schema in schema.js"\n- ❌ Migrate features that weren't detected in the scan\n` : ""}
### Critical Instructions

1. **EXPLORE FIRST**: Before making any changes, you MUST call getFiles() to understand the existing project structure. This is mandatory for imported projects.

2. **RESPECT EXISTING ARCHITECTURE**: This is not a fresh template. The project has an established:
   - File structure and organization
   - Naming conventions
   - Component patterns
   - State management approach
   - Routing configuration

3. **PRESERVE ROUTING LIBRARY - NEVER CHANGE IT**
   - **NEVER** import from \`@tanstack/react-router\` unless the project already uses it
   - **NEVER** change \`useNavigate\` imports to a different router
   - If project uses \`react-router-dom\` → keep using \`react-router-dom\`
   - If project uses \`wouter\` → keep using \`wouter\`
   - Call \`analyzeMigration()\` to detect which router the project uses

4. **⚠️ CONVEX IMPORT PATHS - COUNT THE DIRECTORY DEPTH ⚠️**
   When writing imports from \`convex/_generated/api\`, you MUST count the exact directory depth:
   
   **Formula**: Count folders after \`src/\` + 1 = number of \`../\` needed
   
   - \`src/App.tsx\` → 1 level → \`import { api } from "../convex/_generated/api"\`
   - \`src/components/Header.tsx\` → 2 levels → \`import { api } from "../../convex/_generated/api"\`
   - \`src/components/landing/Header.jsx\` → 3 levels → \`import { api } from "../../../convex/_generated/api"\`
   - \`src/components/ui/buttons/Submit.tsx\` → 4 levels → \`import { api } from "../../../../convex/_generated/api"\`
   
   **VERIFY BEFORE WRITING**: Count the slashes in the file path after \`src/\`, add 1, that's your \`../\` count.

5. **FOLLOW EXISTING PATTERNS**: When adding new features:
   - Match the existing code style
   - Use the same libraries and patterns already in use
   - Place new files in appropriate existing directories
   - Follow the established naming conventions

6. **DO NOT ASSUME TEMPLATE STRUCTURE**: This project may have a completely different structure than the default Shipper template. Do not assume:
   - Default file locations
   - Default dependencies
   - Default configuration
   - Default routing library (TanStack Router is ONLY for Shipper templates!)

### Framework Guidelines
${getFrameworkGuidelines(framework)}

### Before Any Modifications
1. Call getFiles() to see the complete file structure
2. Read key configuration files (package.json, config files)
3. Understand the existing component/module organization
4. Identify the entry points and routing structure`;

  // Add migration instructions to system prompt for imported projects that need migration
  // This is always included so the AI knows what to do when user triggers migration
  if (
    importedFrom &&
    (importedFrom === "LOVABLE" || importedFrom === "BASE44") &&
    (migrationStatus === "PENDING" || migrationStatus === "IN_PROGRESS")
  ) {
    const platformName =
      importedFrom === "LOVABLE" ? "Lovable (Supabase)" : "Base44";

    contextMessage += `

---

## 🔄 BACKEND MIGRATION AVAILABLE

This project was imported from **${platformName}** and may need backend migration to work with Shipper's backend (Convex + Better Auth).

${getMigrationInstructions(importedFrom)}

### When user says "Start migration" or similar:

**Step 1: CALL analyzeMigration() (MANDATORY)**
Call the \`analyzeMigration\` tool FIRST. This tool will:
- Scan the entire codebase automatically
- Detect auth, database, Stripe, AI, email, and file upload patterns
- Return a structured analysis with exactly what needs migration
- Provide recommended steps in order

**DO NOT manually search for patterns - the tool does this for you!**

**Step 2: REPORT THE ANALYSIS (BRIEFLY)**
After calling analyzeMigration(), briefly report:
"Detected: [list features where detected is true]. Migrating in order: [analysis.recommendedSteps]"
Do NOT mention routing library preservation - just silently respect it.

**Step 3: MIGRATE ONLY DETECTED FEATURES**
Follow the recommendedSteps from the analysis in order:
- Auth (if detected): Use deployToShipperCloud tool, then scaffoldConvexSchema
- Database/Entities (if detected): Use scaffoldConvexSchema tool to create tables
- Stripe (if detected): Follow "## 💳 STRIPE INTEGRATION (Payments)" section
- AI/LLM (if detected): Use enableAI tool (see "🤖 AI INTEGRATION" section)
- Email (if detected): Call requestApiKeys({ provider: "resend" })
- **SKIP features where analysis.detected.[feature] is false**

**Step 4: CLEANUP**
- Remove old SDK imports and dependencies
- Only clean up what was migrated

## 🚫 NEVER DO THESE:
- ❌ Skip calling analyzeMigration() and manually search for patterns
- ❌ Create convex/schema.js (only .ts is valid)
- ❌ Keep both .js and .ts versions of the same file
- ❌ Convert src/ files from .js to .ts
- ❌ Migrate features where analysis.detected.[feature] is false
- ❌ Delete the entire convex/ directory and recreate it
- ❌ **CHANGE THE ROUTING LIBRARY** - Use the SAME router the project already uses!
- ❌ Import from \`@tanstack/react-router\` if the project uses \`react-router-dom\`
- ❌ Add TanStack Router imports to imported projects

**CRITICAL**: Only migrate what analyzeMigration() detected. Do NOT invent features to migrate.
**CRITICAL**: PRESERVE the routing library! Check \`analysis.routingLibrary\` and use THAT router.`;
  }

  return [
    {
      id: "code-import-context",
      role: "system",
      parts: [{ type: "text", text: contextMessage }],
      createdAt: new Date(),
    } as UIMessage,
  ];
}

/**
 * Check if a project is imported
 */
export function isImportedProject(project: ProjectWithCodeImport): boolean {
  return !!project.codeImport;
}
