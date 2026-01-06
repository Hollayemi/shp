import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { stripeConfig } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    
    if (!session || !session.user) {
      return NextResponse.json({ 
        success: false, 
        error: 'Authentication required' 
      }, { status: 401 })
    }

    const { sessionId, paymentIntentId } = await req.json()
    
    if (!sessionId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Session ID is required' 
      }, { status: 400 })
    }

    console.log(`🔍 Checking processing status for session: ${sessionId}`)
    
    // 🚨 ENVIRONMENT DEBUGGING
    const isTestSession = sessionId.includes('test')
    const isLiveSession = sessionId.includes('live')
    const expectedEnvironment = stripeConfig.keyType
    
    console.log(`🎯 Environment Debug:`, {
      sessionId,
      isTestSession,
      isLiveSession,
      stripeKeyType: expectedEnvironment,
      nodeEnv: process.env.NODE_ENV,
      environmentMatch: (isTestSession && expectedEnvironment === 'test') || (isLiveSession && expectedEnvironment === 'live')
    })
    
    if ((isTestSession && expectedEnvironment === 'live') || (isLiveSession && expectedEnvironment === 'test')) {
      console.warn(`⚠️ ENVIRONMENT MISMATCH DETECTED:`)
      console.warn(`  Session type: ${isTestSession ? 'TEST' : 'LIVE'}`)
      console.warn(`  Stripe config: ${expectedEnvironment.toUpperCase()}`)
      console.warn(`  This may cause processing issues!`)
    }

    const userId = session.user.id

    // Check for cloud credit purchases first (if paymentIntentId is provided)
    if (paymentIntentId) {
      // Check for cloud credit purchases
      const cloudCreditPurchase = await prisma.cloudCreditPurchase.findFirst({
        where: {
          userId,
          stripePaymentId: paymentIntentId,
          status: 'COMPLETED'
        }
      })

      if (cloudCreditPurchase) {
        console.log(`☁️ Cloud credit purchase found and completed:`, {
          credits: cloudCreditPurchase.credits,
          amount: cloudCreditPurchase.amountCents
        })

        return NextResponse.json({
          success: true,
          processed: true,
          type: 'cloud_credit_purchase',
          details: {
            credits: cloudCreditPurchase.credits,
            amount: cloudCreditPurchase.amountCents
          }
        })
      }

      // Check for regular (Builder) credit purchases
      const creditPurchase = await prisma.creditPurchase.findFirst({
        where: {
          userId,
          stripePaymentId: paymentIntentId,
          status: 'COMPLETED'
        }
      })

      if (creditPurchase) {
        console.log(`✅ Credit purchase found and completed:`, {
          credits: creditPurchase.credits,
          amount: creditPurchase.amountPaid
        })

        return NextResponse.json({
          success: true,
          processed: true,
          type: 'credit_purchase',
          details: {
            credits: creditPurchase.credits,
            amount: creditPurchase.amountPaid
          }
        })
      }
    }

    // Also check by sessionId for cloud credit purchases (webhook may use session_id)
    const cloudCreditPurchaseBySession = await prisma.cloudCreditPurchase.findFirst({
      where: {
        userId,
        stripePaymentId: sessionId,
        status: 'COMPLETED'
      }
    })

    if (cloudCreditPurchaseBySession) {
      console.log(`☁️ Cloud credit purchase found by sessionId:`, {
        credits: cloudCreditPurchaseBySession.credits,
        amount: cloudCreditPurchaseBySession.amountCents
      })

      return NextResponse.json({
        success: true,
        processed: true,
        type: 'cloud_credit_purchase',
        details: {
          credits: cloudCreditPurchaseBySession.credits,
          amount: cloudCreditPurchaseBySession.amountCents
        }
      })
    }

    // Check CloudCreditTransaction by sessionId in metadata (most reliable)
    const cloudCreditTransaction = await prisma.cloudCreditTransaction.findFirst({
      where: {
        userId,
        type: 'PURCHASE',
        metadata: {
          path: ['sessionId'],
          equals: sessionId
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    if (cloudCreditTransaction) {
      console.log(`☁️ Cloud credit transaction found by sessionId in metadata:`, {
        amount: cloudCreditTransaction.amount,
        description: cloudCreditTransaction.description
      })

      return NextResponse.json({
        success: true,
        processed: true,
        type: 'cloud_credit_purchase',
        details: {
          credits: cloudCreditTransaction.amount,
          description: cloudCreditTransaction.description
        }
      })
    }

    // Check for subscription creation/activation
    // First try to find by session ID
    let recentTransaction = await prisma.creditTransaction.findFirst({
      where: {
        userId,
        metadata: {
          path: ['sessionId'],
          equals: sessionId
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // If not found by sessionId, try to find recent subscription allocation
    // (fallback for cases where sessionId isn't stored yet)
    if (!recentTransaction) {
      recentTransaction = await prisma.creditTransaction.findFirst({
        where: {
          userId,
          type: 'MONTHLY_ALLOCATION',
          createdAt: {
            gte: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
    }

    if (recentTransaction) {
      console.log(`✅ Subscription transaction found:`, {
        amount: recentTransaction.amount,
        type: recentTransaction.type,
        description: recentTransaction.description,
        foundBy: (recentTransaction.metadata as any)?.sessionId === sessionId ? 'sessionId' : 'recentAllocation'
      })
      
      return NextResponse.json({
        success: true,
        processed: true,
        type: 'subscription',
        details: {
          credits: recentTransaction.amount,
          description: recentTransaction.description
        }
      })
    }

    // Check if user has an active subscription (for subscription payments)
    const userWithSubscription = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        stripeSubscriptionId: true,
        membershipTier: true,
        creditBalance: true
      }
    })

    // For subscription cases, also check if the user now has a subscription
    if (userWithSubscription?.stripeSubscriptionId && userWithSubscription.membershipTier !== 'FREE') {
      // Check if this is a recent subscription (within last 5 minutes)
      const recentSubscriptionTransaction = await prisma.creditTransaction.findFirst({
        where: {
          userId,
          type: 'MONTHLY_ALLOCATION',
          createdAt: {
            gte: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      if (recentSubscriptionTransaction) {
        console.log(`✅ Recent subscription allocation found:`, {
          tier: userWithSubscription.membershipTier,
          credits: recentSubscriptionTransaction.amount
        })
        
        return NextResponse.json({
          success: true,
          processed: true,
          type: 'subscription',
          details: {
            tier: userWithSubscription.membershipTier,
            credits: recentSubscriptionTransaction.amount
          }
        })
      }
    }

    // Not processed yet
    console.log(`⏳ Processing not yet complete for session: ${sessionId}`)
    
    return NextResponse.json({
      success: true,
      processed: false,
      message: 'Payment verified but processing not yet complete'
    })

  } catch (error: any) {
    console.error('❌ Status check error:', error)
    
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to check processing status',
      details: error.message 
    }, { status: 500 })
  }
} 