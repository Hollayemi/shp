import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthenticatedRequest } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const userId = req.user.id

    // Get current balance
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { creditBalance: true, name: true, email: true }
    })

    // Get recent transactions
    const recentTransactions = await prisma.creditTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: {
        amount: true,
        type: true,
        description: true,
        createdAt: true
      }
    })

    // Get recent purchases
    const recentPurchases = await prisma.creditPurchase.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: {
        credits: true,
        amountPaid: true,
        status: true,
        createdAt: true
      }
    })

    return NextResponse.json({
      user: {
        id: userId,
        name: user?.name,
        email: user?.email,
        creditBalance: user?.creditBalance || 0
      },
      recentActivity: {
        transactions: recentTransactions,
        purchases: recentPurchases
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Failed to check credits:', error)
    return NextResponse.json({ 
      error: 'Failed to check credits',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}) 