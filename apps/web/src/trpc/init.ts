import { initTRPC, TRPCError } from '@trpc/server';
import { cache } from 'react';
import superjson from 'superjson';
import { auth } from '@/lib/auth';
import { isAdminEmail, ADMIN_ACCESS_DENIED_MESSAGE } from '@/lib/admin';
import type { Session } from 'next-auth';

export const createTRPCContext = cache(async () => {
  /**
   * @see: https://trpc.io/docs/server/context
   */
  const session = await auth();
  return { 
    session,
    userId: session?.user?.id || null 
  };
});

type Context = Awaited<ReturnType<typeof createTRPCContext>>;

// Avoid exporting the entire t-object
// since it's not very descriptive.
// For instance, the use of a t variable
// is common in i18n libraries.
const t = initTRPC.context<Context>().create({
  /**
   * @see https://trpc.io/docs/server/data-transformers
   */
    transformer: superjson,
});
// Base router and procedure helpers
export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const baseProcedure = t.procedure;

// Protected procedure that requires authentication
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session || !ctx.session.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to access this resource',
    });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
      user: ctx.session.user,
    },
  });
});

// Admin-only procedure - uses email-based admin check for consistency
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!isAdminEmail(ctx.user.email)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: ADMIN_ACCESS_DENIED_MESSAGE,
    });
  }
  return next({
    ctx: {
      ...ctx,
      adminEmail: ctx.user.email!,
    },
  });
});