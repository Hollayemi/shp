import { protectedProcedure, createTRPCRouter } from "@/trpc/init";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

export const checkoutRouter = createTRPCRouter({
  // Verify Stripe checkout session
  verifySession: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().min(1, "Session ID is required"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        console.log(`🔍 Verifying checkout session: ${input.sessionId}`);

        // Retrieve the checkout session from Stripe
        const checkoutSession = await stripe.checkout.sessions.retrieve(
          input.sessionId,
          {
            expand: ["payment_intent", "subscription"],
          },
        );

        console.log(`✅ Session retrieved:`, {
          id: checkoutSession.id,
          payment_status: checkoutSession.payment_status,
          status: checkoutSession.status,
          customer: checkoutSession.customer,
          mode: checkoutSession.mode,
        });

        // Verify the session belongs to the current user
        const sessionUserId = checkoutSession.metadata?.userId;
        if (sessionUserId !== ctx.user.id) {
          console.error(
            `❌ Session user ID mismatch: ${sessionUserId} !== ${ctx.user.id}`,
          );
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Session does not belong to current user",
          });
        }

        // Check if payment was successful
        if (checkoutSession.payment_status !== "paid") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Payment not completed. Status: ${checkoutSession.payment_status}`,
          });
        }

        // Extract payment details based on type
        const metadata = checkoutSession.metadata || {};
        const isSubscription = checkoutSession.mode === "subscription";
        const isCreditPurchase = metadata.type === "credit_purchase";

        const paymentData: any = {
          isValid: true,
          isProcessed: false, // Will be checked separately
          session: {
            id: checkoutSession.id,
            amount_total: checkoutSession.amount_total,
            currency: checkoutSession.currency,
            payment_status: checkoutSession.payment_status,
            created: checkoutSession.created,
          },
          paymentIntent: checkoutSession.payment_intent,
          type: isSubscription ? "subscription" : "credit_purchase",
          amount: checkoutSession.amount_total,
        };

        if (isSubscription) {
          paymentData.tier = metadata.tierId;
          paymentData.credits = parseInt(metadata.monthlyCredits || "0");

          console.log(`📋 Subscription verified:`, {
            tierId: metadata.tierId,
            tierName: metadata.tierName,
            monthlyCredits: metadata.monthlyCredits,
          });
        } else if (isCreditPurchase) {
          paymentData.credits = parseInt(metadata.credits || "0");

          console.log(`💰 Credit purchase verified:`, {
            credits: metadata.credits,
          });
        }

        return paymentData;
      } catch (error: any) {
        console.error("❌ Session verification error:", error);

        if (error instanceof TRPCError) {
          throw error;
        }

        if (error.code === "resource_missing") {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Checkout session not found",
          });
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to verify payment session",
        });
      }
    }),

  // Check if webhook processing has completed
  checkProcessingStatus: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().min(1, "Session ID is required"),
        paymentIntentId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        console.log(
          `🔍 Checking processing status for session: ${input.sessionId}`,
        );

        const userId = ctx.user.id;

        // Check for credit purchases
        if (input.paymentIntentId) {
          const creditPurchase = await prisma.creditPurchase.findFirst({
            where: {
              userId,
              stripePaymentId: input.paymentIntentId,
              status: "COMPLETED",
            },
          });

          if (creditPurchase) {
            console.log(`✅ Credit purchase found and completed:`, {
              credits: creditPurchase.credits,
              amount: creditPurchase.amountPaid,
            });

            return {
              processed: true,
              type: "credit_purchase",
              details: {
                credits: creditPurchase.credits,
                amount: creditPurchase.amountPaid,
              },
            };
          }
        }

        // Check for subscription creation/activation
        // We'll look for recent transactions with the session ID in metadata
        const recentTransaction = await prisma.creditTransaction.findFirst({
          where: {
            userId,
            metadata: {
              path: ["sessionId"],
              equals: input.sessionId,
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        });

        if (recentTransaction) {
          console.log(`✅ Subscription transaction found:`, {
            amount: recentTransaction.amount,
            type: recentTransaction.type,
            description: recentTransaction.description,
          });

          return {
            processed: true,
            type: "subscription",
            details: {
              credits: recentTransaction.amount,
              description: recentTransaction.description,
            },
          };
        }

        // Check if user has an active subscription (for subscription payments)
        const userWithSubscription = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            stripeSubscriptionId: true,
            membershipTier: true,
            creditBalance: true,
          },
        });

        // For subscription cases, also check if the user now has a subscription
        if (
          userWithSubscription?.stripeSubscriptionId &&
          userWithSubscription.membershipTier !== "FREE"
        ) {
          // Check if this is a recent subscription (within last 5 minutes)
          const recentSubscriptionTransaction =
            await prisma.creditTransaction.findFirst({
              where: {
                userId,
                type: "MONTHLY_ALLOCATION",
                createdAt: {
                  gte: new Date(Date.now() - 5 * 60 * 1000), // Last 5 minutes
                },
              },
              orderBy: {
                createdAt: "desc",
              },
            });

          if (recentSubscriptionTransaction) {
            console.log(`✅ Recent subscription allocation found:`, {
              tier: userWithSubscription.membershipTier,
              credits: recentSubscriptionTransaction.amount,
            });

            return {
              processed: true,
              type: "subscription",
              details: {
                tier: userWithSubscription.membershipTier,
                credits: recentSubscriptionTransaction.amount,
              },
            };
          }
        }

        // Not processed yet
        console.log(
          `⏳ Processing not yet complete for session: ${input.sessionId}`,
        );

        return {
          processed: false,
          message: "Payment verified but processing not yet complete",
        };
      } catch (error: any) {
        console.error("❌ Status check error:", error);

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to check processing status",
        });
      }
    }),

  // Create customer portal session
  createPortalSession: protectedProcedure
    .input(
      z.object({
        returnUrl: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Get user's stripe customer ID from database
        const user = await prisma.user.findUnique({
          where: { id: ctx.user.id },
          select: { stripeCustomerId: true },
        });

        if (!user?.stripeCustomerId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No active subscription found",
          });
        }

        // Create portal session for the customer
        const session = await stripe.billingPortal.sessions.create({
          customer: user.stripeCustomerId,
          return_url:
            input.returnUrl ||
            process.env.NEXTAUTH_URL ||
            "http://localhost:3000",
        });

        console.log("🔄 Created portal session:", {
          sessionId: session.id,
          customerId: user.stripeCustomerId,
          userId: ctx.user.id,
          returnUrl: input.returnUrl,
        });

        return { url: session.url };
      } catch (error: any) {
        console.error("Stripe portal session error:", error);

        if (error instanceof TRPCError) {
          throw error;
        }

        // Check for Stripe configuration errors
        if (
          error.type === "StripeInvalidRequestError" &&
          error.message?.includes("No configuration provided")
        ) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message:
              "Stripe customer portal is not configured. Please contact support or configure it at https://dashboard.stripe.com/test/settings/billing/portal",
          });
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create portal session",
        });
      }
    }),
});
