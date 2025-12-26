import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { 
        creditBalance: true,
        membershipTier: true,
        membershipExpiresAt: true 
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ 
      credits: user.creditBalance,
      membershipTier: user.membershipTier,
      membershipExpiresAt: user.membershipExpiresAt
    })

  } catch (error) {
    console.error('Failed to fetch user credits:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch credits',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 