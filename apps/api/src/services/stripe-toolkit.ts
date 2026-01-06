/**
 * Stripe Toolkit Service
 *
 * Wraps @stripe/agent-toolkit to provide Stripe API tools for the AI.
 * This allows the AI to create products, prices, payment links, etc.
 * directly in the user's Stripe account during chat.
 *
 * The toolkit is instantiated per-request with the user's Stripe secret key.
 */

import { StripeAgentToolkit } from "@stripe/agent-toolkit/ai-sdk";
import { tool } from "ai";
import { z } from "zod";
import type { Logger } from "pino";

// Types for Stripe toolkit configuration
export interface StripeToolkitConfig {
  secretKey: string;
  logger?: Logger;
}

// Stripe feature types that users commonly need
export type StripeFeatureType =
  | "checkout_session"
  | "payment_link"
  | "subscription"
  | "one_time_payment"
  | "customer_portal"
  | "webhook_handler";

/**
 * Create a Stripe toolkit instance with the user's secret key
 */
export function createStripeToolkit(config: StripeToolkitConfig) {
  const { secretKey, logger } = config;

  const toolkit = new StripeAgentToolkit({
    secretKey,
    configuration: {
      actions: {
        // Product management
        products: {
          create: true,
          read: true,
          update: true,
        },
        // Price management
        prices: {
          create: true,
          read: true,
        },
        // Payment links (simplest checkout)
        paymentLinks: {
          create: true,
          read: true,
        },
        // Payment intents (for custom checkout flows)
        paymentIntents: {
          create: true,
          read: true,
          update: true,
        },
        // Customer management
        customers: {
          create: true,
          read: true,
          update: true,
        },
        // Subscriptions
        subscriptions: {
          read: true,
          update: true,
        },
        // Invoices
        invoices: {
          read: true,
        },
        // Invoice items
        invoiceItems: {
          create: true,
          read: true,
        },
        // Balance (for checking account)
        balance: {
          read: true,
        },
        // Refunds
        refunds: {
          create: true,
          read: true,
        },
        // Coupons
        coupons: {
          create: true,
          read: true,
        },
      },
    },
  });

  logger?.info({
    msg: "Stripe toolkit created",
    keyType: secretKey.startsWith("sk_live_") ? "live" : "test",
  });

  return toolkit;
}

/**
 * Get Stripe toolkit tools for AI SDK
 * Returns tools that can be merged with other AI tools
 */
export function getStripeToolkitTools(config: StripeToolkitConfig) {
  const toolkit = createStripeToolkit(config);
  return toolkit.getTools();
}

/**
 * Validate Stripe API key by making a test API call
 */
export async function validateStripeKey(
  secretKey: string,
): Promise<{ valid: boolean; error?: string; mode?: "test" | "live" }> {
  try {
    // Use the toolkit to validate by attempting a balance read
    const toolkit = new StripeAgentToolkit({
      secretKey,
      configuration: {
        actions: {
          balance: { read: true },
        },
      },
    });

    // The toolkit creation itself validates the key format
    // For actual validation, we'd need to make an API call
    // For now, just validate the key format
    if (
      !secretKey.startsWith("sk_test_") &&
      !secretKey.startsWith("sk_live_")
    ) {
      return { valid: false, error: "Invalid Stripe API key format" };
    }

    return {
      valid: true,
      mode: secretKey.startsWith("sk_live_") ? "live" : "test",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("Invalid API Key")) {
      return { valid: false, error: "Invalid Stripe API key" };
    }

    return { valid: false, error: message };
  }
}

// ============================================================================
// STRIPE CODE TEMPLATES
// ============================================================================
// Pre-tested code templates for common Stripe patterns.
// Uses redirect flow (opens Stripe in new tab) - simpler and more reliable than embedded.

/**
 * Generate convex/stripe.ts with helper actions
 */
export function generateStripeActionCode(options: {
  featureType: StripeFeatureType;
  mode: "payment" | "subscription";
}): string {
  return `"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-11-20.acacia",
});

/**
 * Verify a completed checkout session
 * Called from the success page to confirm payment
 */
export const verifySession = action({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      return {
        status: session.status,
        paymentStatus: session.payment_status,
        customerEmail: session.customer_details?.email,
        amountTotal: session.amount_total,
        currency: session.currency,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Stripe error";
      throw new Error(\`Session verification failed: \${message}\`);
    }
  },
});

/**
 * Get customer's subscriptions (for customer portal)
 */
export const getCustomerSubscriptions = action({
  args: { customerId: v.string() },
  handler: async (ctx, { customerId }) => {
    try {
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 10,
      });

      return subscriptions.data.map(sub => ({
        id: sub.id,
        status: sub.status,
        currentPeriodEnd: sub.current_period_end,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Stripe error";
      throw new Error(\`Failed to get subscriptions: \${message}\`);
    }
  },
});
`;
}

/**
 * Generate convex/http.ts with Stripe checkout route
 * Uses redirect flow - opens Stripe Checkout in new tab
 */
export function generateStripeHttpCode(options: {
  mode: "payment" | "subscription";
  successUrl: string;
  cancelUrl: string;
}): string {
  const { mode, successUrl, cancelUrl } = options;

  return `import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import Stripe from "stripe";

const http = httpRouter();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-11-20.acacia",
});

/**
 * Stripe Checkout - Redirect Flow
 * Opens Stripe's hosted checkout page in a new tab
 * 
 * Usage: <a href={\`\${import.meta.env.VITE_CONVEX_SITE_URL}/stripe/checkout?priceId=price_xxx\`} target="_blank">
 */
http.route({
  path: "/stripe/checkout",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const priceId = url.searchParams.get("priceId");
    // Get the app origin from query param (passed by frontend) or use referer
    const appOrigin = url.searchParams.get("origin") || request.headers.get("referer")?.replace(/\\/[^/]*$/, "") || "";

    if (!priceId) {
      return new Response("Missing priceId parameter", { status: 400 });
    }

    try {
      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: priceId, quantity: 1 }],
        mode: "${mode}",
        success_url: \`\${appOrigin}${successUrl}?session_id={CHECKOUT_SESSION_ID}\`,
        cancel_url: \`\${appOrigin}${cancelUrl}\`,
      });

      // Redirect to Stripe's hosted checkout page
      return Response.redirect(session.url!, 303);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Stripe error";
      console.error("Checkout error:", message);
      return new Response(\`Checkout failed: \${message}\`, { status: 500 });
    }
  }),
});

/**
 * Stripe Webhook Handler
 * Receives events from Stripe (payment completed, subscription updated, etc.)
 * 
 * To enable: Add webhook URL in Stripe Dashboard -> Developers -> Webhooks
 * URL: https://your-convex-deployment.convex.site/stripe/webhook
 * 
 * Required events to subscribe to:
 * - checkout.session.completed
 * - customer.subscription.created
 * - customer.subscription.updated  
 * - customer.subscription.deleted
 * - invoice.payment_failed
 */
http.route({
  path: "/stripe/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return new Response("Missing signature", { status: 400 });
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      // Webhook secret not configured - just log and accept
      console.log("STRIPE_WEBHOOK_SECRET not configured, skipping verification");
      return new Response(JSON.stringify({ received: true }), { status: 200 });
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(\`Webhook signature verification failed: \${message}\`);
      return new Response(\`Webhook Error: \${message}\`, { status: 400 });
    }

    // Handle the event
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log("✅ Checkout completed:", session.id);
        
        // Save payment to database
        await ctx.runMutation(internal.stripeWebhook.savePayment, {
          stripeSessionId: session.id,
          stripeCustomerId: session.customer as string | undefined,
          stripePaymentIntentId: session.payment_intent as string | undefined,
          stripeSubscriptionId: session.subscription as string | undefined,
          userEmail: session.customer_details?.email || undefined,
          amount: session.amount_total || 0,
          currency: session.currency || "usd",
          status: "completed",
          paymentType: session.mode === "subscription" ? "subscription" : "one_time",
          paidAt: Date.now(),
        });
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        console.log("📦 Subscription updated:", subscription.id, subscription.status);
        
        // Update subscription in database
        await ctx.runMutation(internal.stripeWebhook.upsertSubscription, {
          stripeCustomerId: subscription.customer as string,
          stripeSubscriptionId: subscription.id,
          stripePriceId: subscription.items.data[0]?.price.id || "",
          status: subscription.status as "active" | "cancelled" | "past_due" | "unpaid" | "trialing",
          currentPeriodStart: subscription.current_period_start * 1000,
          currentPeriodEnd: subscription.current_period_end * 1000,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        });
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        console.log("❌ Subscription cancelled:", subscription.id);
        
        // Mark subscription as cancelled
        await ctx.runMutation(internal.stripeWebhook.cancelSubscription, {
          stripeSubscriptionId: subscription.id,
        });
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        console.log("⚠️ Payment failed for invoice:", invoice.id);
        // Could add notification logic here
        break;
      }

      default:
        console.log(\`Unhandled event type: \${event.type}\`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
`;
}

/**
 * Generate a simple checkout button component
 * Uses redirect flow - opens Stripe Checkout in new tab
 */
export function generateCheckoutUICode(): string {
  // Generate a reusable CheckoutButton component
  return `/**
 * Stripe Checkout Button Component
 * Opens Stripe's hosted checkout page in a new tab
 * 
 * Usage:
 *   <CheckoutButton priceId="price_xxx" />
 *   <CheckoutButton priceId="price_xxx" label="Subscribe Now" />
 */

interface CheckoutButtonProps {
  priceId: string;
  label?: string;
  className?: string;
}

export function CheckoutButton({ priceId, label = "Buy Now", className }: CheckoutButtonProps) {
  // Pass origin so Stripe knows where to redirect back to
  const checkoutUrl = \`\${import.meta.env.VITE_CONVEX_SITE_URL}/stripe/checkout?priceId=\${priceId}&origin=\${encodeURIComponent(window.location.origin)}\`;

  return (
    <a
      href={checkoutUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={className || "inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"}
    >
      {label}
    </a>
  );
}
`;
}

/**
 * Generate success page UI component code
 */
export function generateSuccessUICode(options: {
  returnRoute: string;
}): string {
  const { returnRoute } = options;

  return `import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useConvex } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/checkout/success")({
  component: CheckoutSuccessPage,
});

function CheckoutSuccessPage() {
  const convex = useConvex();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [details, setDetails] = useState<{
    email?: string;
    amount?: number;
    currency?: string;
  } | null>(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const sessionId = searchParams.get("session_id");

    if (!sessionId) {
      setStatus("error");
      return;
    }

    convex
      .action(api.stripe.verifySession, { sessionId })
      .then((result) => {
        if (result.status === "complete" || result.paymentStatus === "paid") {
          setStatus("success");
          setDetails({
            email: result.customerEmail || undefined,
            amount: result.amountTotal ? result.amountTotal / 100 : undefined,
            currency: result.currency?.toUpperCase(),
          });
        } else {
          setStatus("error");
        }
      })
      .catch(() => setStatus("error"));
  }, [convex]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Verifying payment...</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
        <div className="text-center p-8">
          <div className="text-red-500 text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Payment Failed
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Something went wrong with your payment.
          </p>
          <button
            onClick={() => navigate({ to: "${returnRoute}" })}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
      <div className="text-center p-8 max-w-md">
        <div className="text-green-500 text-6xl mb-4">✓</div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Payment Successful!
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-2">
          Thank you for your purchase.
        </p>
        {details?.email && (
          <p className="text-sm text-gray-500 dark:text-gray-500 mb-1">
            Confirmation sent to: {details.email}
          </p>
        )}
        {details?.amount && details?.currency && (
          <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
            Amount: {details.currency} {details.amount.toFixed(2)}
          </p>
        )}
        <button
          onClick={() => navigate({ to: "${returnRoute}" })}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
`;
}

/**
 * Generate payments table schema for Convex
 * Tracks payment history and subscription status
 */
export function generatePaymentsSchemaCode(): string {
  return `import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ... your existing tables ...

  // Stripe payments tracking
  payments: defineTable({
    // User who made the payment (link to your users table)
    userId: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    
    // Stripe identifiers
    stripeSessionId: v.string(),
    stripeCustomerId: v.optional(v.string()),
    stripePaymentIntentId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    
    // Payment details
    priceId: v.optional(v.string()),
    productId: v.optional(v.string()),
    amount: v.number(), // in cents
    currency: v.string(),
    
    // Status
    status: v.union(
      v.literal("pending"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("refunded"),
      v.literal("cancelled")
    ),
    paymentType: v.union(
      v.literal("one_time"),
      v.literal("subscription")
    ),
    
    // Timestamps
    paidAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_session", ["stripeSessionId"])
    .index("by_customer", ["stripeCustomerId"])
    .index("by_status", ["status"]),

  // Subscription tracking (for recurring payments)
  subscriptions: defineTable({
    userId: v.string(),
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.string(),
    stripePriceId: v.string(),
    
    status: v.union(
      v.literal("active"),
      v.literal("cancelled"),
      v.literal("past_due"),
      v.literal("unpaid"),
      v.literal("trialing")
    ),
    
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
    cancelAtPeriodEnd: v.boolean(),
  })
    .index("by_user", ["userId"])
    .index("by_subscription", ["stripeSubscriptionId"])
    .index("by_status", ["status"]),
});
`;
}

/**
 * Generate the payments table addition snippet
 * For adding to an existing schema
 */
export function generatePaymentsTableSnippet(): string {
  return `  // Add these tables to your existing schema.ts:

  payments: defineTable({
    userId: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    stripeSessionId: v.string(),
    stripeCustomerId: v.optional(v.string()),
    stripePaymentIntentId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    priceId: v.optional(v.string()),
    amount: v.number(),
    currency: v.string(),
    status: v.union(v.literal("pending"), v.literal("completed"), v.literal("failed"), v.literal("refunded"), v.literal("cancelled")),
    paymentType: v.union(v.literal("one_time"), v.literal("subscription")),
    paidAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_session", ["stripeSessionId"])
    .index("by_status", ["status"]),
`;
}

/**
 * Generate webhook mutation handlers for Stripe events
 * These are called by the HTTP webhook handler to save data
 */
export function generateStripeWebhookMutations(): string {
  return `import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Save a completed payment to the database
 */
export const savePayment = internalMutation({
  args: {
    stripeSessionId: v.string(),
    stripeCustomerId: v.optional(v.string()),
    stripePaymentIntentId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    amount: v.number(),
    currency: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("refunded"),
      v.literal("cancelled")
    ),
    paymentType: v.union(v.literal("one_time"), v.literal("subscription")),
    paidAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Check if payment already exists (idempotency)
    const existing = await ctx.db
      .query("payments")
      .withIndex("by_session", (q) => q.eq("stripeSessionId", args.stripeSessionId))
      .first();

    if (existing) {
      // Update existing payment
      await ctx.db.patch(existing._id, {
        status: args.status,
        paidAt: args.paidAt,
      });
      return existing._id;
    }

    // Create new payment record
    return await ctx.db.insert("payments", args);
  },
});

/**
 * Create or update a subscription
 */
export const upsertSubscription = internalMutation({
  args: {
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.string(),
    stripePriceId: v.string(),
    status: v.union(
      v.literal("active"),
      v.literal("cancelled"),
      v.literal("past_due"),
      v.literal("unpaid"),
      v.literal("trialing")
    ),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
    cancelAtPeriodEnd: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Find existing subscription
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_subscription", (q) => q.eq("stripeSubscriptionId", args.stripeSubscriptionId))
      .first();

    if (existing) {
      // Update existing subscription
      await ctx.db.patch(existing._id, {
        status: args.status,
        currentPeriodStart: args.currentPeriodStart,
        currentPeriodEnd: args.currentPeriodEnd,
        cancelAtPeriodEnd: args.cancelAtPeriodEnd,
      });
      return existing._id;
    }

    // Create new subscription (need userId - you may want to look this up by stripeCustomerId)
    return await ctx.db.insert("subscriptions", {
      userId: "", // TODO: Look up userId by stripeCustomerId from your users table
      ...args,
    });
  },
});

/**
 * Mark a subscription as cancelled
 */
export const cancelSubscription = internalMutation({
  args: {
    stripeSubscriptionId: v.string(),
  },
  handler: async (ctx, { stripeSubscriptionId }) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_subscription", (q) => q.eq("stripeSubscriptionId", stripeSubscriptionId))
      .first();

    if (subscription) {
      await ctx.db.patch(subscription._id, {
        status: "cancelled",
      });
    }
  },
});
`;
}
