import { NextResponse } from 'next/server'
import { CREDIT_PACKAGES } from '@/lib/pricing'
import { stripe } from '@/lib/stripe'
import { withAuth, type AuthenticatedRequest } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

// src/app/api/stripe/buy-credits/route.ts
export const POST = withAuth(async (req: AuthenticatedRequest) => {
    const { packageIndex, returnUrl } = await req.json()
    
    const creditPackage = CREDIT_PACKAGES[packageIndex]
    if (!creditPackage) {
      return NextResponse.json({ error: 'Invalid package' }, { status: 400 })
    }

    // Dynamically determine the base URL from the request
    const host = req.headers.get('host') || 'localhost:3000'
    const protocol = req.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https')
    const fullBaseUrl = `${protocol}://${host}`
    
    // Determine where to redirect on cancel - use returnUrl, fallback to referer, then to home
    const referer = req.headers.get('referer')
    const cancelUrl = returnUrl || referer || `${fullBaseUrl}/`
    
    // Get user's stripe customer ID from database
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { stripeCustomerId: true }
    })
    
    const session = await stripe.checkout.sessions.create({
      customer: user?.stripeCustomerId || undefined,
      allow_promotion_codes: true,
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${creditPackage.credits} Credits`,
            description: `Add ${creditPackage.credits} credits to your account`,
          },
          unit_amount: creditPackage.price * 100,
        },
        quantity: 1,
      }],
      mode: 'payment', // One-time payment, not subscription
      success_url: `${fullBaseUrl}/checkout/process?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      metadata: {
        userId: req.user.id,
        credits: creditPackage.credits.toString(),
        type: 'credit_purchase'
      }
    })
    
    // 🚨 DEBUG: Log session creation details
    console.log('💳 Created checkout session:', {
      sessionId: session.id,
      sessionType: session.id.includes('test') ? 'TEST' : session.id.includes('live') ? 'LIVE' : 'UNKNOWN',
      mode: session.mode,
      amount: creditPackage.price * 100,
      userId: req.user.id
    })
    
    return NextResponse.json({ url: session.url })
  })