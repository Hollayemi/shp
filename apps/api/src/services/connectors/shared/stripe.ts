/**
 * Stripe Shared Connector
 * 
 * Configures Stripe payment processing for generated apps.
 * Team admins provide API keys once, then AI can generate payment features.
 * 
 * @see https://stripe.com/docs/api
 */

import type {
    SharedConnectorDefinition,
    SharedConnectorCredentials,
} from "../types.js";

export const stripeConnector: SharedConnectorDefinition = {
    id: "STRIPE",
    name: "Stripe",
    description: "Accept payments, manage subscriptions, and handle billing in your apps",
    icon: "/icons/stripe.svg",

    requiredCredentials: [
        {
            key: "publishableKey",
            label: "Publishable Key",
            placeholder: "pk_test_...",
            pattern: /^pk_(test|live)_[A-Za-z0-9]+$/,
            helpUrl: "https://dashboard.stripe.com/apikeys",
        },
        {
            key: "secretKey",
            label: "Secret Key",
            placeholder: "sk_test_...",
            pattern: /^sk_(test|live)_[A-Za-z0-9]+$/,
            helpUrl: "https://dashboard.stripe.com/apikeys",
        },
        {
            key: "webhookSecret",
            label: "Webhook Signing Secret (Optional)",
            placeholder: "whsec_...",
            pattern: /^whsec_[A-Za-z0-9]+$/,
            helpUrl: "https://dashboard.stripe.com/webhooks",
        },
    ],

    capabilities: [
        "payments",
        "subscriptions",
        "invoices",
        "customers",
        "payment-links",
        "checkout-sessions",
    ],

    /**
     * Validate Stripe API keys by making a test request
     */
    async validateCredentials(
        credentials: SharedConnectorCredentials,
    ): Promise<{
        valid: boolean;
        error?: string;
        metadata?: Record<string, unknown>;
    }> {
        const { secretKey } = credentials;

        if (!secretKey) {
            return { valid: false, error: "Secret key is required" };
        }

        try {
            // Test the secret key by retrieving account information
            const response = await fetch("https://api.stripe.com/v1/account", {
                headers: {
                    Authorization: `Bearer ${secretKey}`,
                },
            });

            if (!response.ok) {
                const error = await response.json() as { error?: { message?: string } };
                return {
                    valid: false,
                    error: error.error?.message || "Invalid Stripe secret key",
                };
            }

            const account = await response.json() as {
                id: string;
                business_profile?: {
                    name?: string;
                };
                country: string;
                default_currency: string;
            };

            return {
                valid: true,
                metadata: {
                    accountId: account.id,
                    businessName: account.business_profile?.name,
                    country: account.country,
                    currency: account.default_currency,
                    mode: secretKey.startsWith("sk_test_") ? "test" : "live",
                },
            };
        } catch (error) {
            return {
                valid: false,
                error: error instanceof Error ? error.message : "Failed to validate credentials",
            };
        }
    },

    /**
     * Get setup instructions for integrating Stripe into user's app
     */
    getSetupInstructions(credentials: SharedConnectorCredentials): {
        envVars?: Record<string, string>;
        packages?: string[];
        codeTemplates?: { path: string; content: string }[];
    } {
        return {
            // Environment variables to inject into Convex/app
            envVars: {
                STRIPE_PUBLISHABLE_KEY: credentials.publishableKey,
                STRIPE_SECRET_KEY: credentials.secretKey,
                ...(credentials.webhookSecret && {
                    STRIPE_WEBHOOK_SECRET: credentials.webhookSecret,
                }),
            },

            // NPM packages to install
            packages: ["stripe@^14.0.0"],

            // Code templates for common Stripe operations
            codeTemplates: [
                {
                    path: "convex/stripe.ts",
                    content: `/**
 * Stripe Integration
 * 
 * Server-side Stripe operations for payments and subscriptions.
 */

import Stripe from "stripe";
import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

/**
 * Create a Stripe Checkout Session
 */
export const createCheckoutSession = action({
  args: {
    priceId: v.string(),
    successUrl: v.string(),
    cancelUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price: args.priceId,
          quantity: 1,
        },
      ],
      success_url: args.successUrl,
      cancel_url: args.cancelUrl,
    });

    return { sessionId: session.id, url: session.url };
  },
});

/**
 * Create a Stripe Customer
 */
export const createCustomer = action({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const customer = await stripe.customers.create({
      email: args.email,
      name: args.name,
    });

    return { customerId: customer.id };
  },
});

/**
 * Create a Subscription
 */
export const createSubscription = action({
  args: {
    customerId: v.string(),
    priceId: v.string(),
  },
  handler: async (ctx, args) => {
    const subscription = await stripe.subscriptions.create({
      customer: args.customerId,
      items: [{ price: args.priceId }],
    });

    return {
      subscriptionId: subscription.id,
      status: subscription.status,
    };
  },
});

/**
 * Handle Stripe Webhooks
 */
export const handleWebhook = action({
  args: {
    body: v.string(),
    signature: v.string(),
  },
  handler: async (ctx, args) => {
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        args.body,
        args.signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err) {
      throw new Error(\`Webhook signature verification failed\`);
    }

    // Handle the event
    switch (event.type) {
      case "checkout.session.completed":
        const session = event.data.object as Stripe.Checkout.Session;
        // Handle successful payment
        console.log("Payment succeeded:", session.id);
        break;

      case "customer.subscription.created":
        const subscription = event.data.object as Stripe.Subscription;
        // Handle new subscription
        console.log("Subscription created:", subscription.id);
        break;

      case "customer.subscription.deleted":
        const deletedSub = event.data.object as Stripe.Subscription;
        // Handle cancelled subscription
        console.log("Subscription cancelled:", deletedSub.id);
        break;

      default:
        console.log(\`Unhandled event type: \${event.type}\`);
    }

    return { received: true };
  },
});
`,
                },
                {
                    path: "src/components/CheckoutButton.tsx",
                    content: `/**
 * Stripe Checkout Button Component
 * 
 * Client-side component to initiate Stripe Checkout.
 */

import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { loadStripe } from "@stripe/stripe-js";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

export function CheckoutButton({ priceId }: { priceId: string }) {
  const createCheckout = useMutation(api.stripe.createCheckoutSession);

  const handleCheckout = async () => {
    const stripe = await stripePromise;
    if (!stripe) return;

    const { sessionId } = await createCheckout({
      priceId,
      successUrl: window.location.origin + "/success",
      cancelUrl: window.location.origin + "/cancel",
    });

    await stripe.redirectToCheckout({ sessionId });
  };

  return (
    <button
      onClick={handleCheckout}
      className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
    >
      Checkout with Stripe
    </button>
  );
}
`,
                },
            ],
        };
    },
};