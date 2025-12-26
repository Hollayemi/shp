import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { auth } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    
    if (!session || !session.user) {
      return NextResponse.json({ 
        success: false, 
        error: 'Authentication required' 
      }, { status: 401 })
    }

    const { sessionId } = await req.json()
    
    if (!sessionId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Session ID is required' 
      }, { status: 400 })
    }

    console.log(`🔍 Verifying checkout session: ${sessionId}`)

    // Retrieve the checkout session from Stripe
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent', 'subscription']
    })

    console.log(`✅ Session retrieved:`, {
      id: checkoutSession.id,
      payment_status: checkoutSession.payment_status,
      status: checkoutSession.status,
      customer: checkoutSession.customer,
      mode: checkoutSession.mode
    })

    // Verify the session belongs to the current user
    const sessionUserId = checkoutSession.metadata?.userId
    if (sessionUserId !== session.user.id) {
      console.error(`❌ Session user ID mismatch: ${sessionUserId} !== ${session.user.id}`)
      return NextResponse.json({ 
        success: false, 
        error: 'Session does not belong to current user' 
      }, { status: 403 })
    }

    // Check if payment was successful
    if (checkoutSession.payment_status !== 'paid') {
      return NextResponse.json({ 
        success: false, 
        error: `Payment not completed. Status: ${checkoutSession.payment_status}` 
      }, { status: 400 })
    }

    // Extract payment details based on type
    const metadata = checkoutSession.metadata || {}
    const isSubscription = checkoutSession.mode === 'subscription'
    const isCreditPurchase = metadata.type === 'credit_purchase'
    const isCloudCreditPurchase = metadata.type === 'cloud_credit_purchase'

    // Determine the purchase type
    let purchaseType: 'subscription' | 'credit_purchase' | 'cloud_credit_purchase' = 'credit_purchase'
    if (isSubscription) {
      purchaseType = 'subscription'
    } else if (isCloudCreditPurchase) {
      purchaseType = 'cloud_credit_purchase'
    }

    const paymentData: {
      isValid: boolean;
      isProcessed: boolean;
      session: {
        id: string;
        amount_total: number | null;
        currency: string | null;
        payment_status: string;
        created: number;
      };
      paymentIntent: unknown;
      type: 'subscription' | 'credit_purchase' | 'cloud_credit_purchase';
      amount: number | null;
      tier?: string;
      credits?: number;
      returnUrl?: string;
    } = {
      isValid: true,
      isProcessed: false, // Will be checked separately
      session: {
        id: checkoutSession.id,
        amount_total: checkoutSession.amount_total,
        currency: checkoutSession.currency,
        payment_status: checkoutSession.payment_status,
        created: checkoutSession.created
      },
      paymentIntent: checkoutSession.payment_intent,
      type: purchaseType,
      amount: checkoutSession.amount_total
    }

    if (isSubscription) {
      paymentData.tier = metadata.tierId
      paymentData.credits = parseInt(metadata.monthlyCredits || '0')

      console.log(`📋 Subscription verified:`, {
        tierId: metadata.tierId,
        tierName: metadata.tierName,
        monthlyCredits: metadata.monthlyCredits
      })
    } else if (isCreditPurchase) {
      paymentData.credits = parseInt(metadata.credits || '0')

      console.log(`💰 Credit purchase verified:`, {
        credits: metadata.credits
      })
    } else if (isCloudCreditPurchase) {
      paymentData.credits = parseInt(metadata.credits || '0')
      paymentData.returnUrl = metadata.returnUrl || ''

      console.log(`☁️ Cloud credit purchase verified:`, {
        credits: metadata.credits,
        returnUrl: metadata.returnUrl
      })
    }

    return NextResponse.json({
      success: true,
      data: paymentData
    })

  } catch (error: any) {
    console.error('❌ Session verification error:', error)
    
    if (error.code === 'resource_missing') {
      return NextResponse.json({ 
        success: false, 
        error: 'Checkout session not found' 
      }, { status: 404 })
    }
    
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to verify payment session',
      details: error.message 
    }, { status: 500 })
  }
} 