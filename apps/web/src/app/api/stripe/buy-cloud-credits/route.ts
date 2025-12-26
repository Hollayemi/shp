import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { withAuth, type AuthenticatedRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

/**
 * Shipper Cloud Credits pricing
 * 1 credit = 1 cent ($0.01)
 * Simple and easy to understand!
 */
const CLOUD_CREDIT_PACKAGES = [
  { credits: 500, priceInCents: 500 }, // $5
  { credits: 1000, priceInCents: 1000 }, // $10
  { credits: 2500, priceInCents: 2500 }, // $25
  { credits: 5000, priceInCents: 5000 }, // $50
  { credits: 10000, priceInCents: 10000 }, // $100
] as const;

const requestSchema = z.object({
  credits: z.number().min(100).max(100000),
  returnUrl: z.string().optional(),
});

/**
 * POST /api/stripe/buy-cloud-credits
 *
 * Creates a Stripe Checkout session for purchasing Shipper Cloud credits.
 * These credits are separate from Builder credits and used for deployed app resources.
 */
export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const body = await req.json();
    const validation = requestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 }
      );
    }

    const { credits, returnUrl } = validation.data;

    // Calculate price (1 credit = 1 cent)
    const priceInCents = credits;

    // Dynamically determine the base URL from the request
    const host = req.headers.get("host") || "localhost:3000";
    const protocol =
      req.headers.get("x-forwarded-proto") ||
      (host.includes("localhost") ? "http" : "https");
    const fullBaseUrl = `${protocol}://${host}`;

    // Determine where to redirect on cancel
    const referer = req.headers.get("referer");
    const cancelUrl = returnUrl || referer || `${fullBaseUrl}/`;

    // Get user's stripe customer ID from database
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { stripeCustomerId: true, email: true },
    });

    if (!user?.email) {
      return NextResponse.json(
        { error: "User email not found" },
        { status: 400 }
      );
    }

    // Create or use existing Stripe customer
    // Always use customer ID for proper credit grant association
    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          userId: req.user.id,
          source: "shipper-cloud-credits",
        },
      });
      stripeCustomerId = customer.id;

      // Update user with Stripe customer ID
      await prisma.user.update({
        where: { id: req.user.id },
        data: { stripeCustomerId },
      });
    }

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId, // Always use customer ID for credit grant association
      saved_payment_method_options: {
        payment_method_save: "enabled", // Allow saving new payment methods
      },
      payment_method_options: {
        card: {
          setup_future_usage: "off_session", // Save card for future purchases
        },
      },
      allow_promotion_codes: true,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Shipper Cloud Credits",
              description: `${credits.toLocaleString()} Cloud credits for databases, AI, storage in your deployed apps`,
            },
            unit_amount: priceInCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${fullBaseUrl}/checkout/cloud-credits/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      metadata: {
        userId: req.user.id,
        credits: credits.toString(),
        type: "cloud_credit_purchase",
        returnUrl: returnUrl || referer || "",
      },
    });

    console.log("Created Cloud credits checkout session:", {
      sessionId: session.id,
      credits,
      priceInCents,
      userId: req.user.id,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Error creating Cloud credits checkout:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create checkout" },
      { status: 500 }
    );
  }
});
