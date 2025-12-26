import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isAdminEmail, ADMIN_ACCESS_DENIED_MESSAGE } from '@/lib/admin'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await auth()
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Lightning-fast admin access check
    if (!isAdminEmail(session.user.email)) {
      return NextResponse.json({ error: ADMIN_ACCESS_DENIED_MESSAGE }, { status: 403 })
    }

    const { userId } = await params

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        creditBalance: true,
        membershipTier: true,
        membershipExpiresAt: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        lastCreditReset: true,
        monthlyCreditsUsed: true,
        lifetimeCreditsUsed: true,
        createdAt: true,
        updatedAt: true,
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get recent transactions (last 50)
    const transactions = await prisma.creditTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        amount: true,
        type: true,
        description: true,
        metadata: true,
        createdAt: true,
      }
    })

    // Get recent purchases (last 20)
    const purchases = await prisma.creditPurchase.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        credits: true,
        amountPaid: true,
        stripePaymentId: true,
        status: true,
        metadata: true,
        createdAt: true,
      }
    })

    // Get subscription details if exists
    let subscription = null
    if (user.stripeSubscriptionId) {
      subscription = await prisma.subscription.findUnique({
        where: { stripeSubscriptionId: user.stripeSubscriptionId },
        select: {
          id: true,
          stripeSubscriptionId: true,
          stripePriceId: true,
          stripeCurrentPeriodEnd: true,
          stripeCancelAtPeriodEnd: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        }
      })
    }

    // Calculate transaction statistics
    const transactionStats = {
      totalTransactions: transactions.length,
      creditsPurchased: transactions
        .filter(t => t.type === 'PURCHASE')
        .reduce((sum, t) => sum + t.amount, 0),
      creditsUsed: transactions
        .filter(t => t.amount < 0)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0),
      monthlyAllocations: transactions
        .filter(t => t.type === 'MONTHLY_ALLOCATION')
        .reduce((sum, t) => sum + t.amount, 0),
      adminAdjustments: transactions
        .filter(t => t.type === 'BONUS' || t.type === 'REFUND')
        .reduce((sum, t) => sum + t.amount, 0),
    }

    // Purchase statistics
    const purchaseStats = {
      totalPurchases: purchases.length,
      totalSpent: purchases
        .filter(p => p.status === 'COMPLETED')
        .reduce((sum, p) => sum + p.amountPaid, 0),
      totalCreditsPurchased: purchases
        .filter(p => p.status === 'COMPLETED')
        .reduce((sum, p) => sum + p.credits, 0),
    }

    return NextResponse.json({
      user,
      transactions,
      purchases,
      subscription,
      stats: {
        transactions: transactionStats,
        purchases: purchaseStats,
      }
    })

  } catch (error) {
    console.error('❌ Failed to fetch user details:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch user details',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 