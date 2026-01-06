import { createTRPCRouter } from "../init";
import {
  improvedProjectsRouter,
  messagesRouter,
  usersRouter,
  teamsRouter,
  adminRouter,
  creditsRouter,
  checkoutRouter,
  promptsRouter,
  templatesRouter,
  codeImportRouter,
  connectorsRouter,
} from "@/modules";
import { errorsRouter } from "@/modules/errors/server/procedures";

export const appRouter = createTRPCRouter({
  messages: messagesRouter,
  projects: improvedProjectsRouter,
  users: usersRouter,
  teams: teamsRouter,
  admin: adminRouter,
  credits: creditsRouter,
  checkout: checkoutRouter,
  errors: errorsRouter,
  prompts: promptsRouter,
  templates: templatesRouter,
  codeImport: codeImportRouter,
  connectors: connectorsRouter,
});
// export type definition of API
export type AppRouter = typeof appRouter;
