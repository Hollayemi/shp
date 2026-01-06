import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isAdminEmail, ADMIN_ACCESS_DENIED_MESSAGE } from '@/lib/admin'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Lightning-fast admin access check
    if (!isAdminEmail(session.user.email)) {
      return NextResponse.json({ error: ADMIN_ACCESS_DENIED_MESSAGE }, { status: 403 })
    }

    // Fetch all users with essential info
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        creditBalance: true,
        membershipTier: true,
        membershipExpiresAt: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        createdAt: true,
        lastCreditReset: true,
        monthlyCreditsUsed: true,
      },
      orderBy: {
        createdAt: 'desc' // Most recent users first
      }
    })

    return NextResponse.json({ 
      users,
      total: users.length,
      stats: {
        totalCredits: users.reduce((sum, user) => sum + user.creditBalance, 0),
        proUsers: users.filter(u => u.membershipTier === 'PRO').length,
        enterpriseUsers: users.filter(u => u.membershipTier === 'ENTERPRISE').length,
        withSubscriptions: users.filter(u => u.stripeSubscriptionId).length,
      }
    })

  } catch (error) {
    console.error('❌ Failed to fetch users:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch users',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 