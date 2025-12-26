import { protectedProcedure, createTRPCRouter } from "@/trpc/init";
import { prisma } from "@/lib/db";
import { z } from "zod";

export const usersRouter = createTRPCRouter({
  getCurrentUser: protectedProcedure.query(async ({ ctx }) => {
    return {
      id: ctx.user.id,
      name: ctx.user.name,
      email: ctx.user.email,
      role: ctx.user.role,
      isNewUser: ctx.user.isNewUser,
    };
  }),

  completeOnboarding: protectedProcedure.mutation(async ({ ctx }) => {
    const updatedUser = await prisma.user.update({
      where: { id: ctx.user.id },
      data: { isNewUser: false },
    });

    return {
      success: true,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        isNewUser: updatedUser.isNewUser,
      },
    };
  }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updatedUser = await prisma.user.update({
        where: { id: ctx.user.id },
        data: { name: input.name },
      });

      return {
        success: true,
        user: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
          isNewUser: updatedUser.isNewUser,
        },
      };
    }),
}); 