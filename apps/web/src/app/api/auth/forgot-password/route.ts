import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { nanoid } from 'nanoid';
import { sendEmail, generatePasswordResetEmail } from '@/lib/email';
import { encharge } from '@/lib/encharge';

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = forgotPasswordSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    const { email } = validated.data;

    // Find user (no enumeration)
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return NextResponse.json(
        { message: 'If an account with that email exists, a password reset link has been sent.' },
        { status: 200 }
      );
    }

    // Generate reset token
    const resetToken = nanoid(32);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    // Store token
    await prisma.verificationToken.create({
      data: {
        identifier: `reset-${user.id}`,
        token: resetToken,
        expires: expiresAt,
      },
    });

    // Build reset URL
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password?token=${resetToken}`;

    // Extract first name safely
    const [firstName] = (user.name || '').trim().split(' ');
    const safeFirstName = firstName || 'there';

    // -----------------------------
    // 🔵 Encharge — single event
    // -----------------------------
    let enchargeHandled = false;

    if (process.env.ENCHARGE_WRITE_KEY) {
      try {
        const tracked = await encharge.trackEvent({
          name: 'Password reset requested',
          user: {
            email: user.email,
            firstName: safeFirstName,
          },
          properties: {
            resetUrl
          },
        });

        if (tracked) {
          console.log('Password reset event sent to Encharge.');
          enchargeHandled = true;
        }
      } catch (err) {
        console.error('Failed to send Encharge event', err);
      }
    }

    // -----------------------------
    // 🔵 Fallback: SMTP / Resend
    // -----------------------------
    if (!enchargeHandled) {
      try {
        const emailContent = generatePasswordResetEmail(resetUrl, safeFirstName);
        await sendEmail({
          to: user.email,
          ...emailContent,
        });
      } catch (err) {
        console.error('SMTP Email send failed:', err);
      }
    }

    return NextResponse.json(
      {
        message: 'If an account with that email exists, a password reset link has been sent.',
        resetUrl: process.env.NODE_ENV === 'development' ? resetUrl : undefined,
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
