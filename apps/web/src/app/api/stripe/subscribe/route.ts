import { NextResponse } from 'next/server'
import { getTierById, isValidCreditOption } from '@/lib/pricing'
import { stripe } from '@/lib/stripe'
import { withAuth, type AuthenticatedRequest } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  const { tierId, returnUrl } = await req.json() // e.g., 'pro-400', 'pro-1200', 'enterprise-custom'
  
  // Get tier information by ID
  const tierInfo = getTierById(tierId)
  if (!tierInfo) {
    return NextResponse.json({ error: 'Invalid membership tier' }, { status: 400 })
  }

  // Handle enterprise contact-based tiers
  if (tierInfo.isContactBased) {
    return NextResponse.json({ error: 'Enterprise tiers require direct contact' }, { status: 400 })
  }

  // Validate pro credit options for additional security
  if (tierId.startsWith('pro-')) {
    const credits = parseInt(tierId.replace('pro-', ''))
    if (!isValidCreditOption(credits)) {
      return NextResponse.json({ error: 'Invalid credit option' }, { status: 400 })
    }
  }

  // Dynamically determine the base URL from the request
  const host = req.headers.get('host') || 'localhost:3000'
  const protocol = req.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https')
  const fullBaseUrl = `${protocol}://${host}`
  
  // Determine where to redirect on cancel - use returnUrl, fallback to referer, then to home
  const referer = req.headers.get('referer')
  const cancelUrl = returnUrl || referer || `${fullBaseUrl}/`

  try {
    // Get user's stripe customer ID and current subscription from database
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { 
        stripeCustomerId: true,
        membershipTier: true,
        stripeSubscriptionId: true
      }
    })
    
    // 🚫 RESTRICTION: Block users from buying the same or lower credit tier
    // Force them to upgrade to a higher tier only
    if (user?.stripeSubscriptionId && user.membershipTier !== 'FREE') {
      // Get user's current subscription to check the ORIGINAL tier (not decremented basePlanCredits)
      const currentSubscription = await prisma.subscription.findUnique({
        where: { stripeSubscriptionId: user.stripeSubscriptionId },
        select: { stripePriceId: true }
      })
      
      // Fetch the subscription from Stripe to get metadata with original monthlyCredits
      let currentTierCredits = 0
      
      if (currentSubscription) {
        try {
          const stripeSubscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId)
          const metadata = stripeSubscription.metadata
          currentTierCredits = parseInt(metadata.monthlyCredits || '0')
          
          console.log(`📊 Current subscription tier: ${currentTierCredits} credits (from Stripe metadata)`)
        } catch (error) {
          console.error('Failed to fetch Stripe subscription:', error)
          // Fallback: use basePlanCredits but this is not ideal since it decrements
          const userWithCredits = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { basePlanCredits: true }
          })
          currentTierCredits = userWithCredits?.basePlanCredits || 0
          console.warn(`⚠️ Using basePlanCredits as fallback: ${currentTierCredits}`)
        }
      }
      
      const requestedCredits = tierInfo.monthlyCredits
      
      if (requestedCredits <= currentTierCredits) {
        // Same or lower tier - block it
        return NextResponse.json({ 
          error: 'You can only upgrade to a higher credit tier. To manage your current subscription, use the billing portal in your profile menu.',
          code: 'ALREADY_SUBSCRIBED',
          currentTier: currentTierCredits,
          requestedTier: requestedCredits
        }, { status: 400 })
      }
      
      // Higher tier - allow the upgrade
      console.log(`✅ User ${req.user.id} upgrading from ${currentTierCredits} to ${requestedCredits} credits`)
    }
    
    const session = await stripe.checkout.sessions.create({
      customer: user?.stripeCustomerId || undefined,
      allow_promotion_codes: true,
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${tierInfo.name} Membership`,
            description: `${tierInfo.monthlyCredits.toLocaleString()} credits per month + ${tierInfo.features.slice(0, 3).join(', ')}${tierInfo.features.length > 3 ? '...' : ''}`,
          },
          unit_amount: tierInfo.monthlyPrice * 100,
          recurring: {
            interval: 'month',
          },
        },
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: `${fullBaseUrl}/checkout/process?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      metadata: {
        userId: req.user.id,
        tierId,
        tierName: tierInfo.tierName, // 'pro', 'enterprise', etc.
        monthlyCredits: tierInfo.monthlyCredits.toString(),
        type: 'membership_subscription'
      },
      subscription_data: {
        metadata: {
          userId: req.user.id,
          tierId,
          tierName: tierInfo.tierName,
          monthlyCredits: tierInfo.monthlyCredits.toString(),
        }
      }
    })
    
    // 🚨 DEBUG: Log session creation details
    console.log('🔄 Created subscription session:', {
      sessionId: session.id,
      sessionType: session.id.includes('test') ? 'TEST' : session.id.includes('live') ? 'LIVE' : 'UNKNOWN',
      mode: session.mode,
      tierInfo: {
        tierId,
        tierName: tierInfo.tierName,
        monthlyCredits: tierInfo.monthlyCredits,
        monthlyPrice: tierInfo.monthlyPrice
      },
      userId: req.user.id
    })
    
    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Stripe subscription error:', error)
    return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 })
  }
}) 