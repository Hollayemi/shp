import {
  createAgent,
  createTool,
  createNetwork,
  createState,
} from "@inngest/agent-kit";
import { z } from "zod";
import { createAzureOpenAIModel } from "@/helpers/createAzureOpenAIModel";
import { MultiAgentState } from "@/inngest/multi-agent-workflow";
import Sandbox from "@e2b/code-interpreter";
import { SandboxManager } from "@/lib/sandbox-manager";

export const validatorAgent = createAgent<MultiAgentState>({
  name: "project-validator",
  description:
    "Validates project for import errors, icon context, and functionality",
  system: `You are a strict project validator. Your job is to catch and fix critical issues.

🚨 **CRITICAL VALIDATION CHECKS**:

1. **IMPORT VALIDATION**:
- Scan ALL component files for imports (especially @/lib/store, @/lib/types)
- Scan ALL component files for React hooks (useState, useEffect, useNavigate)
- Scan ALL component files for event handlers (onClick, onChange, onSubmit)
- ALL imports must resolve correctly (no "Module not found" errors)
- **CRITICAL**: @/lib/store is commonly missing - ensure it exists

2. **ICON CONTEXT VALIDATION**:
- Music/Audio apps should use: Music, Play, Pause, Volume2, Headphones, Radio
- E-commerce apps should use: ShoppingCart, Package, CreditCard, Heart, Star
- Todo/Productivity apps should use: CheckSquare, Calendar, Clock, Target
- Social apps should use: MessageCircle, Users, Bell, Share2, Heart
- NO MISMATCHED ICONS: Never ShoppingCart in music apps, Music in todo apps

3. **BUILD ERROR VALIDATION**:
- Use 'npx tsc --noEmit --skipLibCheck' to catch TypeScript compilation errors (dev server safe)
- Fix any TypeScript errors immediately
- Fix any missing import errors
- Fix any path resolution errors (@/lib/store, @/components/ui/*)

4. **TAILWIND CSS VALIDATION**:
- Check if Tailwind classes are applying correctly
- Ensure src/index.css has EXACT structure: @import "tailwindcss"; :root and .dark; @theme inline;
- Verify CSS variables are defined correctly
- Fix any styling issues where classes don't work
- Consider sandbox refresh if styles aren't applying (may be timing issue)

5. **IMPORT VALIDATION**:
- Scan ALL files for forbidden imports: framer-motion, react-spring, @radix-ui/*, uuid, nanoid, lodash
- Only allow: next/*, react, lucide-react, @/components/ui/*, next-themes
- If forbidden imports found, remove them and use alternatives
- Replace uuid with: crypto.randomUUID() or Math.random().toString(36)
- Use terminal to check which packages are actually available

6. **NAVIGATION VALIDATION**:
- Scan Header.tsx and Sidebar.tsx for ALL Link href attributes
- For every href="/example" found, ensure app/example/page.tsx exists
- Create missing page files for ALL navigation links
- Test that clicking navigation doesn't result in 404 errors

**VALIDATION PROCESS**:
1. FIRST: Scan ALL files for missing imports and create missing files
2. If import "@/lib/store" fails → Create src/lib/store.ts with jotai atoms
3. If import "@/lib/api" fails → Create src/lib/api.ts with axios helpers
4. Fix all missing file imports BEFORE validation
5. Use terminal tool to run 'npx tsc --noEmit --skipLibCheck' for type checking (safe with running dev server)
6. If type check fails, analyze errors and auto-fix with createOrEditFiles or install dependencies using terminal tool.
7. Check icon usage for context appropriateness
8. Re-run type check until it passes
9. **ITERATIVE FIXING**: Keep fixing and re-validating until clean

**AUTO-FIX PATTERNS**:
- File imports "@/lib/store" → Ensure src/lib/store.ts exists with proper exports (tasksAtom, etc.)
- File imports "@/lib/types" → Ensure src/lib/types.ts exists with proper exports
- File imports "@/components/ui/*" → Ensure shadcn components are properly installed
- Missing src/lib/store.ts → Create with jotai atoms (tasksAtom, filtersAtom, etc.)
- Missing src/lib/types.ts → Create with TypeScript interfaces
- Missing src/lib/utils.ts → Create with cn utility function

**AVAILABLE TOOLS**:
- terminal: Run type checking/validation commands (use 'npx tsc --noEmit --skipLibCheck' instead of 'npm run build')
- createOrEditFiles: Fix validation issues

**CRITICAL**: Only complete validation if 'npx tsc --noEmit --skipLibCheck' passes without errors!

To finish your task, call "markVerifyComplete" tool or we will loop and people will die! AFTER YOUR TASK IS DONE, CALL "markVerifyComplete" TO FINISH YOUR TASK OR YOU WILL BE FAILED.
`,
  model: createAzureOpenAIModel("gpt-4.1"),
  tools: [
    createTool({
      name: "terminal",
      description:
        "Execute terminal commands in the sandbox (use 'npx tsc --noEmit --skipLibCheck' for validation instead of 'npm run build')",
      parameters: z.object({
        command: z.string(),
      }),
      handler: async ({ command }, { network }) => {
        try {
          console.log(`[project-validator] Executing command: ${command}`);
          const sandbox = await Sandbox.connect(network.state.data.sandboxId);
          const result = await sandbox.commands.run(command);
          return result.stdout || result.stderr || "Command executed";
        } catch (error: any) {
          console.error(`[project-validator] Terminal command failed:`, error);

          // Check if this is a 404 error indicating the sandbox no longer exists
          const is404Error =
            error.message?.includes("404") ||
            error.message?.includes("doesn't exist") ||
            error.message?.includes("not found");

          if (is404Error) {
            console.log(
              `[project-validator] 🔄 Sandbox ${network.state.data.sandboxId} no longer exists`,
            );
            return `Sandbox no longer exists and needs recreation. Command: ${command}`;
          }

          return `Command failed: ${error}`;
        }
      },
    }),
    createTool({
      name: "createOrEditFiles",
      description: "Fix validation issues by editing a file",
      parameters: z.object({
        path: z.string(),
        content: z.string(),
        description: z.string().optional(),
      }),
      handler: async ({ path, content, description }, { network }) => {
        try {
          // Update state with new file
          network.state.data.files[path] = content;
          console.log(`[Validator] Fixed file: ${path}`);

          // Use SandboxManager to update files (same as fullstack-builder)
          const filesToUpdate = { [path]: content };

          console.log(
            `[Validator] Calling SandboxManager.updateSandboxFiles...`,
          );
          const result = await SandboxManager.updateSandboxFiles(
            network.state.data.sandboxId,
            filesToUpdate,
          );

          console.log(`[Validator] SandboxManager result:`, result);

          if (!result.success) {
            throw new Error(
              `Failed to update file in sandbox: ${JSON.stringify(result)}`,
            );
          }

          return `✅ Fixed file to resolve validation issues: ${path}${description ? ` - ${description}` : ""}`;
        } catch (error: unknown) {
          if (error instanceof Error) {
            console.error(`[Validator] File fix error: ${error.message}`);
            return `Error: ${error.message}`;
          } else {
            console.error(`[Validator] File fix error: ${String(error)}`);
            return `Error: ${String(error)}`;
          }
        }
      },
    }),
    createTool({
      name: "safeInstallPackages",
      description:
        "Safely install packages by stopping dev server, installing, then restarting",
      parameters: z.object({
        packages: z.array(z.string()),
      }),
      handler: async ({ packages }, { network }) => {
        try {
          console.log(
            `[project-validator] Installing packages safely: ${packages.join(
              ", ",
            )}`,
          );
          const sandbox = await Sandbox.connect(network.state.data.sandboxId);

          // Stop dev server
          await sandbox.commands.run("pkill -f 'npm run dev' || true");
          await sandbox.commands.run("pkill -f 'vite' || true");
          await sandbox.commands.run("pkill -f 'node.*vite' || true");

          // Wait for processes to stop
          await new Promise((resolve) => setTimeout(resolve, 2000));

          // Install packages
          const installCmd = `npm install ${packages.join(
            " ",
          )} --no-fund --no-audit`;
          const result = await sandbox.commands.run(installCmd);

          // Restart dev server
          await sandbox.commands.run(
            "nohup npm run dev -- --host 0.0.0.0 --port 3000 > /dev/null 2>&1 &",
          );

          // Wait for server to start
          await new Promise((resolve) => setTimeout(resolve, 3000));

          return `✅ Packages installed safely: ${packages.join(
            ", ",
          )}. Dev server restarted.`;
        } catch (error: any) {
          console.error(
            `[project-validator] Safe package installation failed:`,
            error,
          );

          // Try to restart dev server even if installation failed
          try {
            const sandbox = await Sandbox.connect(network.state.data.sandboxId);
            await sandbox.commands.run(
              "nohup npm run dev -- --host 0.0.0.0 --port 3000 > /dev/null 2>&1 &",
            );
          } catch (restartError) {
            console.error(
              `[project-validator] Failed to restart dev server:`,
              restartError,
            );
          }

          return `❌ Package installation failed: ${error.message || error}`;
        }
      },
    }),
    createTool({
      name: "markVerifyComplete",
      description: "Mark verification as complete - MANDATORY to call",
      parameters: z.object({
        summary: z.string(),
        buildPassed: z.boolean(),
      }),
      handler: async ({ summary, buildPassed }, { network }) => {
        network.state.data.verifyComplete = true;
        console.log(
          `[Verifier] ✅ VERIFY COMPLETE - Build: ${
            buildPassed ? "PASSED" : "FAILED"
          }`,
        );
        return `✅ Verification complete: ${summary}`;
      },
    }),
  ],
});
