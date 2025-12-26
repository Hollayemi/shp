import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { encharge } from '@/lib/encharge';

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedFields = resetPasswordSchema.safeParse(body);

    if (!validatedFields.success) {
      return NextResponse.json(
        { error: 'Invalid input data', details: validatedFields.error.format() },
        { status: 400 }
      );
    }

    const { token, password } = validatedFields.data;

    // Find the reset token
    const resetToken = await prisma.verificationToken.findFirst({
      where: {
        token,
        identifier: {
          startsWith: 'reset-'
        },
        expires: {
          gt: new Date()
        }
      }
    });

    if (!resetToken) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    // Extract user ID from identifier
    const userId = resetToken.identifier.replace('reset-', '');

    // Find the user
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update user password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    // Delete the used token
    await prisma.verificationToken.delete({
      where: {
        identifier_token: {
          identifier: resetToken.identifier,
          token: resetToken.token
        }
      }
    });

    // Track password reset completion in Encharge (async, don't wait for completion)
    encharge.trackPasswordResetCompleted({
      id: user.id,
      name: user.name || undefined,
      email: user.email,
    }).catch(error => {
      console.error('Failed to track password reset completion in Encharge:', error);
      // Don't fail the reset if Encharge tracking fails
    });

    return NextResponse.json(
      { message: 'Password reset successfully' },
      { status: 200 }
    );

  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

