// src/modules/messages/server/procedures.ts (Enhanced with SSE)
import { protectedProcedure, createTRPCRouter } from "@/trpc/init";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { inngest } from "@/inngest/client";
import { TRPCError } from "@trpc/server";
import { CreditManager } from "@/lib/credits";
import { checkProjectAccess } from "@/helpers/checkProjectAccess";
import { loadChat } from "@/lib/db/actions";

export const messagesRouter = createTRPCRouter({
  getMany: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1, { message: "Project ID is required" }),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Check if user has access to this project (legacy personal or team project)
      const hasAccess = await checkProjectAccess(input.projectId, ctx.user.id);

      if (!hasAccess) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found or access denied",
        });
      }

      const messages = await prisma.message.findMany({
        where: {
          projectId: input.projectId,
        },
        orderBy: {
          updatedAt: "asc",
        },
        include: {
          fragment: true,
        },
      });
      return messages;
    }),

  getManyV2: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1, { message: "Project ID is required" }),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Check if user has access to this project
      const hasAccess = await checkProjectAccess(input.projectId, ctx.user.id);

      if (!hasAccess) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found or access denied",
        });
      }

      // Get v2 messages
      const messages = await loadChat(input.projectId);

      return messages;
    }),

  // New polling endpoint - check for new assistant messages
  pollStatus: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1, { message: "Project ID is required" }),
        lastMessageTime: z.string().optional(), // ISO timestamp of last known message
      }),
    )
    .query(async ({ ctx, input }) => {
      // Check if user has access to this project
      const hasAccess = await checkProjectAccess(input.projectId, ctx.user.id);

      if (!hasAccess) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found or access denied",
        });
      }

      // Get the latest assistant message
      const latestAssistantMessage = await prisma.message.findFirst({
        where: {
          projectId: input.projectId,
          role: "ASSISTANT",
          ...(input.lastMessageTime
            ? {
                createdAt: {
                  gt: new Date(input.lastMessageTime),
                },
              }
            : {}),
        },
        orderBy: {
          createdAt: "desc",
        },
        include: {
          fragment: true,
        },
      });

      // Check if there's any ongoing generation (user message without assistant response)
      const latestUserMessage = await prisma.message.findFirst({
        where: {
          projectId: input.projectId,
          role: "USER",
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      // More robust generation check
      let isGenerating = false;

      if (latestUserMessage) {
        // If there's no assistant message, we're generating
        if (!latestAssistantMessage) {
          isGenerating = true;
        } else {
          // If user message is newer than assistant message, we're generating
          const userTime = latestUserMessage.createdAt.getTime();
          const assistantTime = latestAssistantMessage.createdAt.getTime();

          // Add a small buffer (5 minutes) to account for processing time
          const timeDifferenceMs = userTime - assistantTime;
          const maxGenerationTime = 5 * 60 * 1000; // 5 minutes

          isGenerating =
            userTime > assistantTime && timeDifferenceMs < maxGenerationTime;
        }
      }

      // Fix hasNewMessage logic - only true if message is actually newer than last known time
      let hasNewMessage = false;
      if (latestAssistantMessage) {
        if (!input.lastMessageTime) {
          // First poll - any assistant message is "new"
          hasNewMessage = true;
        } else {
          // Check if assistant message is newer than last known time
          const lastKnownTime = new Date(input.lastMessageTime);
          hasNewMessage = latestAssistantMessage.createdAt > lastKnownTime;
        }
      }

      return {
        latestMessage: latestAssistantMessage,
        isGenerating: !!isGenerating,
        hasNewMessage,
        timestamp: new Date().toISOString(),
      };
    }),

  create: protectedProcedure
    .input(
      z.object({
        content: z
          .string()
          .min(1, {
            message: "Content is required",
          })
          .max(10000, { message: "Content is too long" }),
        projectId: z.string().min(1, { message: "Project ID is required" }),
        role: z.enum(["USER", "ASSISTANT"]).default("USER"),
        type: z.enum(["RESULT", "ERROR"]).default("RESULT"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user has access to this project (legacy personal or team project)
      const hasAccess = await checkProjectAccess(input.projectId, ctx.user.id, [
        "OWNER",
        "ADMIN",
        "MEMBER",
      ]); // Viewers can't create messages

      if (!hasAccess) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found or access denied",
        });
      }

      // Check and deduct credits for user messages (1 credit per message)
      if (input.role === "USER") {
        const creditCost = 1;
        try {
          await CreditManager.deductCredits(
            ctx.user.id,
            creditCost,
            "AI_GENERATION",
            `Message generation for project ${input.projectId}`,
            {
              projectId: input.projectId,
              messageContent: input.content.substring(0, 100),
            },
          );
        } catch (error) {
          throw new TRPCError({
            code: "PAYMENT_REQUIRED",
            message:
              "Insufficient credits. Please purchase credits to continue using the AI generation.",
          });
        }
      }

      // Create the message
      const message = await prisma.message.create({
        data: {
          content: input.content,
          role: input.role,
          type: input.type,
          projectId: input.projectId,
        },
        include: {
          fragment: true,
        },
      });

      return message;
    }),

  // New procedure to get generation status
  getGenerationStatus: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      const hasAccess = await checkProjectAccess(input.projectId, ctx.user.id);

      if (!hasAccess) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found or access denied",
        });
      }

      // Check if there's an ongoing generation
      const lastMessage = await prisma.message.findFirst({
        where: { projectId: input.projectId },
        orderBy: { createdAt: "desc" },
      });

      const isGenerating = lastMessage?.role === "USER";

      return {
        isGenerating,
        lastMessageId: lastMessage?.id,
        lastMessageRole: lastMessage?.role,
        lastMessageCreatedAt: lastMessage?.createdAt,
      };
    }),

  // Procedure to manually retry generation
  retryGeneration: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
        messageId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const hasAccess = await checkProjectAccess(input.projectId, ctx.user.id, [
        "OWNER",
        "ADMIN",
        "MEMBER",
      ]);

      if (!hasAccess) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found or access denied",
        });
      }

      // Get the message to retry
      const message = await prisma.message.findUnique({
        where: { id: input.messageId },
      });

      if (!message || message.projectId !== input.projectId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Message not found",
        });
      }

      return { success: true };
    }),

  // Get latest fragment for a project
  getLatestFragment: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1, { message: "Project ID is required" }),
      }),
    )
    .query(async ({ ctx, input }) => {
      const hasAccess = await checkProjectAccess(input.projectId, ctx.user.id);

      if (!hasAccess) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found or access denied",
        });
      }

      // Get latest message with fragment
      const latestMessageWithFragment = await prisma.message.findFirst({
        where: {
          projectId: input.projectId,
          fragment: { isNot: null },
        },
        orderBy: { createdAt: "desc" },
        include: { fragment: true },
      });

      if (!latestMessageWithFragment?.fragment) {
        return null;
      }

      return {
        id: latestMessageWithFragment.fragment.id,
        messageId: latestMessageWithFragment.id,
        sandboxUrl: latestMessageWithFragment.fragment.sandboxUrl,
        title: latestMessageWithFragment.fragment.title,
        files: latestMessageWithFragment.fragment.files,
        createdAt: latestMessageWithFragment.fragment.createdAt,
      };
    }),
});
