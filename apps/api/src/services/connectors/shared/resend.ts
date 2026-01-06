/**
 * Resend Shared Connector
 * 
 * Configures Resend email service for generated apps.
 * Send transactional emails, newsletters, and notifications.
 * 
 * @see https://resend.com/docs
 */

import type {
    SharedConnectorDefinition,
    SharedConnectorCredentials,
} from "../types.js";

export const resendConnector: SharedConnectorDefinition = {
    id: "RESEND",
    name: "Resend",
    description: "Modern email API for developers - send transactional emails",
    icon: "/icons/resend.svg",

    requiredCredentials: [
        {
            key: "apiKey",
            label: "API Key",
            placeholder: "re_...",
            pattern: /^re_[A-Za-z0-9_]+$/,
            helpUrl: "https://resend.com/api-keys",
        },
        {
            key: "fromEmail",
            label: "From Email Address",
            placeholder: "noreply@yourdomain.com",
            pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            helpUrl: "https://resend.com/domains",
        },
        {
            key: "fromName",
            label: "From Name",
            placeholder: "Your App Name",
            helpUrl: "https://resend.com/docs",
        },
    ],

    capabilities: ["transactional-email", "bulk-email", "email-templates"],

    /**
     * Validate Resend API key
     */
    async validateCredentials(
        credentials: SharedConnectorCredentials,
    ): Promise<{
        valid: boolean;
        error?: string;
        metadata?: Record<string, unknown>;
    }> {
        const { apiKey } = credentials;

        if (!apiKey) {
            return { valid: false, error: "API key is required" };
        }

        try {
            // Test API key by listing domains
            const response = await fetch("https://api.resend.com/domains", {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                },
            });

            if (!response.ok) {
                const error = await response.json() as { message?: string };
                return {
                    valid: false,
                    error: error.message || "Invalid Resend API key",
                };
            }

            const data = await response.json() as {
                data: Array<{
                    id: string;
                    name: string;
                    status: string;
                }>;
            };

            return {
                valid: true,
                metadata: {
                    domains: data.data.map((d) => ({
                        id: d.id,
                        name: d.name,
                        status: d.status,
                    })),
                },
            };
        } catch (error) {
            return {
                valid: false,
                error: error instanceof Error ? error.message : "Failed to validate credentials",
            };
        }
    },

    /**
     * Get setup instructions for integrating Resend
     */
    getSetupInstructions(credentials: SharedConnectorCredentials): {
        envVars?: Record<string, string>;
        packages?: string[];
        codeTemplates?: { path: string; content: string }[];
    } {
        return {
            envVars: {
                RESEND_API_KEY: credentials.apiKey,
                RESEND_FROM_EMAIL: credentials.fromEmail,
                RESEND_FROM_NAME: credentials.fromName || "App",
            },

            packages: ["resend@^3.0.0"],

            codeTemplates: [
                {
                    path: "convex/email.ts",
                    content: `/**
 * Resend Email Integration
 * 
 * Server-side email operations using Resend.
 */

import { Resend } from "resend";
import { v } from "convex/values";
import { action } from "./_generated/server";

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send a transactional email
 */
export const sendEmail = action({
  args: {
    to: v.string(),
    subject: v.string(),
    html: v.string(),
    text: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      const data = await resend.emails.send({
        from: \`\${process.env.RESEND_FROM_NAME} <\${process.env.RESEND_FROM_EMAIL}>\`,
        to: [args.to],
        subject: args.subject,
        html: args.html,
        text: args.text,
      });

      return { success: true, emailId: data.id };
    } catch (error) {
      console.error("Failed to send email:", error);
      throw new Error("Failed to send email");
    }
  },
});

/**
 * Send welcome email
 */
export const sendWelcomeEmail = action({
  args: {
    to: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const html = \`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .button { 
              display: inline-block; 
              padding: 12px 24px; 
              background: #4F46E5; 
              color: white; 
              text-decoration: none; 
              border-radius: 5px; 
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to Our App!</h1>
            </div>
            <div class="content">
              <p>Hi \${args.name},</p>
              <p>Thanks for signing up! We're excited to have you on board.</p>
              <p>
                <a href="https://yourapp.com/dashboard" class="button">
                  Get Started
                </a>
              </p>
              <p>If you have any questions, feel free to reach out.</p>
            </div>
          </div>
        </body>
      </html>
    \`;

    return await ctx.runAction(api.email.sendEmail, {
      to: args.to,
      subject: "Welcome to Our App!",
      html,
    });
  },
});

/**
 * Send password reset email
 */
export const sendPasswordResetEmail = action({
  args: {
    to: v.string(),
    resetToken: v.string(),
  },
  handler: async (ctx, args) => {
    const resetUrl = \`https://yourapp.com/reset-password?token=\${args.resetToken}\`;
    
    const html = \`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .button { 
              display: inline-block; 
              padding: 12px 24px; 
              background: #EF4444; 
              color: white; 
              text-decoration: none; 
              border-radius: 5px; 
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Password Reset Request</h2>
            <p>You requested to reset your password. Click the button below to continue:</p>
            <p>
              <a href="\${resetUrl}" class="button">
                Reset Password
              </a>
            </p>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request this, please ignore this email.</p>
          </div>
        </body>
      </html>
    \`;

    return await ctx.runAction(api.email.sendEmail, {
      to: args.to,
      subject: "Password Reset Request",
      html,
    });
  },
});

/**
 * Send notification email
 */
export const sendNotificationEmail = action({
  args: {
    to: v.string(),
    title: v.string(),
    message: v.string(),
    actionUrl: v.optional(v.string()),
    actionText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const html = \`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .notification { 
              background: #F3F4F6; 
              border-left: 4px solid #4F46E5; 
              padding: 20px; 
              margin: 20px 0; 
            }
            .button { 
              display: inline-block; 
              padding: 12px 24px; 
              background: #4F46E5; 
              color: white; 
              text-decoration: none; 
              border-radius: 5px; 
              margin-top: 10px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="notification">
              <h2>\${args.title}</h2>
              <p>\${args.message}</p>
              \${args.actionUrl ? \`
                <a href="\${args.actionUrl}" class="button">
                  \${args.actionText || 'View Details'}
                </a>
              \` : ''}
            </div>
          </div>
        </body>
      </html>
    \`;

    return await ctx.runAction(api.email.sendEmail, {
      to: args.to,
      subject: args.title,
      html,
    });
  },
});
`,
                },
                {
                    path: "src/components/ContactForm.tsx",
                    content: `/**
 * Contact Form Component with Email Integration
 */

import { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';

export function ContactForm() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  
  const sendEmail = useMutation(api.email.sendEmail);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');

    try {
      await sendEmail({
        to: 'support@yourapp.com',
        subject: \`Contact Form: \${email}\`,
        html: \`
          <p><strong>From:</strong> \${email}</p>
          <p><strong>Message:</strong></p>
          <p>\${message}</p>
        \`,
      });

      setStatus('sent');
      setEmail('');
      setMessage('');
      
      setTimeout(() => setStatus('idle'), 3000);
    } catch (error) {
      setStatus('error');
      console.error('Failed to send email:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">Contact Us</h2>
      
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-2 border rounded-lg"
          required
        />
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Message</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full px-4 py-2 border rounded-lg h-32"
          required
        />
      </div>

      <button
        type="submit"
        disabled={status === 'sending'}
        className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {status === 'sending' ? 'Sending...' : 'Send Message'}
      </button>

      {status === 'sent' && (
        <p className="mt-4 text-green-600">Message sent successfully!</p>
      )}
      {status === 'error' && (
        <p className="mt-4 text-red-600">Failed to send message. Please try again.</p>
      )}
    </form>
  );
}
`,
                },
            ],
        };
    },
};