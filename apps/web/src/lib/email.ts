import nodemailer from 'nodemailer';
import { Resend } from 'resend';

// Initialize Resend client if API key is provided
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Create reusable transporter object using SMTP transport (fallback)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail({ to, subject, html, text }: EmailOptions) {
  // Prefer Resend if configured
  if (resend) {
    try {
      const { data, error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || process.env.SMTP_FROM_EMAIL || 'noreply@shipper.now',
        to: [to],
        subject,
        html,
        text,
      });

      if (error) {
        console.error('Failed to send email via Resend:', error);
        // Fall through to next provider
      } else {
        console.log('Email sent successfully via Resend:', data.id);
        return { success: true, provider: 'resend', messageId: data.id };
      }
    } catch (error) {
      console.error('Failed to send email via Resend:', error);
      // Fall through to next provider
    }
  }

  // Fallback to SMTP transport
  try {
    const info = await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || 'Shipper'}" <${process.env.SMTP_FROM_EMAIL}>`,
      to,
      subject,
      html,
      text,
    });

    console.log('Email sent successfully via SMTP:', info.messageId);
    return { success: true, provider: 'smtp', messageId: info.messageId };
  } catch (error) {
    console.error('Failed to send email via SMTP:', error);
    throw error;
  }
}

export function generatePasswordResetEmail(resetUrl: string, userName?: string) {
  const subject = 'Reset your Shipper password';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset your password</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      
      <div style="background-color: #f8fafc; padding: 30px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="color: #1f2937; margin-top: 0;">Reset your password</h2>

        <p>Hello${userName ? ` ${userName}` : ''},</p>

        <p>You requested to reset your password for your Shipper account. Click the button below to set a new password:</p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            Reset Password
          </a>
        </div>

        <p style="color: #6b7280; font-size: 14px;">
          This link will expire in 1 hour for security reasons.
        </p>

        <p style="color: #6b7280; font-size: 14px;">
          If you didn't request this password reset, please ignore this email. Your password will remain unchanged.
        </p>
      </div>

      <div style="text-align: center; color: #6b7280; font-size: 12px;">
        <p>If the button doesn't work, copy and paste this link into your browser:</p>
        <p style="word-break: break-all;">${resetUrl}</p>
      </div>

      <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">
        <p>© 2025 Shipper. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;

  const text = `
    Reset your Shipper password

    Hello${userName ? ` ${userName}` : ''},

    You requested to reset your password for your Shipper account.

    Click this link to set a new password: ${resetUrl}

    This link will expire in 1 hour for security reasons.

    If you didn't request this password reset, please ignore this email. Your password will remain unchanged.

    © 2025 Shipper. All rights reserved.
  `;

  return { subject, html, text };
}
