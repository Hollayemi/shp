import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { stripeConfig } from '@/lib/stripe'
import { inngest } from '@/inngest/client' // Your Inngest client

export async function POST(req: NextRequest) {
  console.log('🔔 Webhook received!')

  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  console.log('📝 Webhook signature present:', !!sig)
  console.log('📝 Webhook secret configured:', !!process.env.STRIPE_WEBHOOK_SECRET)
  console.log('🎯 Stripe environment:', stripeConfig.keyType.toUpperCase())

  if (!sig) {
    console.error('❌ No Stripe signature found')
    return NextResponse.json({ error: 'No signature' }, { status: 400 })
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('❌ STRIPE_WEBHOOK_SECRET not configured')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  try {
    const event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)

    console.log('✅ Webhook verified successfully')
    console.log('📦 Event type:', event.type)
    console.log('📦 Event data keys:', Object.keys(event.data.object))

    // 🚨 ENVIRONMENT DEBUGGING for checkout sessions
    if (event.type === 'checkout.session.completed') {
      const sessionData = event.data.object as any
      const sessionId = sessionData.id
      const isTestSession = sessionId.includes('test')
      const isLiveSession = sessionId.includes('live')

      console.log('🎯 Webhook Session Debug:', {
        sessionId,
        isTestSession,
        isLiveSession,
        stripeKeyType: stripeConfig.keyType,
        environmentMatch: (isTestSession && stripeConfig.keyType === 'test') || (isLiveSession && stripeConfig.keyType === 'live')
      })

      if ((isTestSession && stripeConfig.keyType === 'live') || (isLiveSession && stripeConfig.keyType === 'test')) {
        console.warn(`⚠️ WEBHOOK ENVIRONMENT MISMATCH:`)
        console.warn(`  Webhook session: ${isTestSession ? 'TEST' : 'LIVE'}`)
        console.warn(`  Stripe config: ${stripeConfig.keyType.toUpperCase()}`)
      }
    }

    // Send to Inngest for background processing
    const inngestResult = await inngest.send({
      name: 'stripe/webhook',
      data: {
        type: event.type,
        data: event.data.object
      }
    })

    // console.log('📤 Sent to Inngest:', inngestResult)

    return NextResponse.json({ received: true, eventType: event.type })
  } catch (error) {
    console.error('❌ Webhook error:', error)
    return NextResponse.json({
      error: 'Webhook error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 400 })
  }
}