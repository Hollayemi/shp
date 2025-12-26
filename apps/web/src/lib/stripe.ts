import Stripe from "stripe";

// Environment-aware Stripe configuration
const isProduction = process.env.NODE_ENV === "production";
const stripeSecretKey = isProduction
  ? process.env.STRIPE_SECRET_KEY_LIVE || process.env.STRIPE_SECRET_KEY
  : process.env.STRIPE_SECRET_KEY_TEST || process.env.STRIPE_SECRET_KEY;

const stripePublishableKey = isProduction
  ? process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE ||
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  : process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST ||
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

// Avoid throwing at module import time (which breaks Next.js build/static analysis).
// Instead create the Stripe instance lazily and export a proxy that will only
// throw when a method is actually used at runtime.
let _stripeInstance: Stripe | undefined;
if (stripeSecretKey) {
  _stripeInstance = new Stripe(stripeSecretKey, {
    apiVersion: "2025-06-30.basil",
    typescript: true,
  });
  console.log(
    `🔧 Stripe configured for: ${isProduction ? "PRODUCTION" : "DEVELOPMENT"} mode`,
  );
  console.log(
    `🔑 Using key type: ${stripeSecretKey.startsWith("sk_live") ? "LIVE" : "TEST"}`,
  );
} else {
  console.warn(
    `⚠️ Stripe secret key not provided. Stripe client will throw if used at runtime.`,
  );
}

// Export a proxy that forwards to the real Stripe instance when available,
// otherwise raises a clear runtime error when a method is accessed.
export const stripe = new Proxy(
  {},
  {
    get(_, prop: string) {
      if (!_stripeInstance) {
        throw new Error(
          `Stripe is not configured. Set STRIPE secret key in environment before calling Stripe methods. Accessed property: ${String(prop)}`,
        );
      }
      // Forward to real stripe instance at runtime (runtime-typed)
      return (_stripeInstance as any)[prop];
    },
    apply(_, __, args: any[]) {
      if (!_stripeInstance) {
        throw new Error(`Stripe is not configured.`);
      }
      // Delegate apply to runtime stripe instance
      return (_stripeInstance as any).apply(_, args);
    },
  },
) as unknown as Stripe;

// For client-side
import { loadStripe } from "@stripe/stripe-js";
export const stripePromise = stripePublishableKey
  ? loadStripe(stripePublishableKey)
  : Promise.resolve(null as unknown as ReturnType<typeof loadStripe>);

// Export environment info for debugging
export const stripeConfig = {
  isProduction,
  keyType: stripeSecretKey?.startsWith("sk_live") ? "live" : "test",
  hasValidKey: !!stripeSecretKey,
};
