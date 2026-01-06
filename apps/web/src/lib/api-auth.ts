import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import type { Session } from 'next-auth';
import { prisma } from '@/lib/db';

export interface AuthenticatedRequest extends NextRequest {
  user: Session['user'];
  session: Session;
}

/**
 * Middleware to protect API routes with authentication
 * Returns the session if authenticated, or an error response if not
 */
export function withAuth(
  handler: (request: AuthenticatedRequest, ...args: any[]) => Promise<Response>
) {
  return async (request: NextRequest, ...args: any[]): Promise<Response> => {
    try {
      const session = await auth();

      if (!session || !session.user) {
        return NextResponse.json(
          { 
            error: 'Authentication required',
            message: 'You must be signed in to access this resource'
          },
          { status: 401 }
        );
      }

      // Add session info to request object
      const authenticatedRequest = request as AuthenticatedRequest;
      authenticatedRequest.user = session.user;
      authenticatedRequest.session = session;

      return await handler(authenticatedRequest, ...args);
    } catch (error) {
      console.error('Auth middleware error:', error);
      return NextResponse.json(
        { 
          error: 'Authentication error',
          message: 'Failed to verify authentication'
        },
        { status: 500 }
      );
    }
  };
}

/**
 * Middleware to protect API routes with admin role requirement
 */
export async function withAdminAuth<T extends (...args: any[]) => any>(
  handler: (request: AuthenticatedRequest, ...args: any[]) => ReturnType<T>
) {
  return withAuth(async (request: AuthenticatedRequest, ...args: any[]) => {
    if (request.user.role !== 'ADMIN') {
      return NextResponse.json(
        { 
          error: 'Admin access required',
          message: 'You must be an admin to access this resource'
        },
        { status: 403 }
      );
    }

    return handler(request, ...args);
  });
}

/**
 * Utility to verify project ownership
 */
export async function verifyProjectOwnership(
  projectId: string, 
  userId: string
): Promise<boolean> {
  try {
    
    const project = await prisma.project.findUnique({
      where: { 
        id: projectId,
        userId: userId
      }
    });

    return !!project;
  } catch (error) {
    console.error('Project ownership verification error:', error);
    return false;
  }
} 