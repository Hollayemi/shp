# Environment Variables for Vercel Deployment

This document lists all the environment variables required for deploying your Turborepo to Vercel.

## Required Environment Variables

### Database

- `DATABASE_URL` - Your database connection string (PostgreSQL, MySQL, etc.)

### Authentication (NextAuth.js)

- `NEXTAUTH_SECRET` - Secret key for NextAuth.js (generate with `openssl rand -base64 32`)
- `NEXTAUTH_URL` - Your application URL (e.g., `https://your-app.vercel.app`)

### Application

- `NEXT_PUBLIC_APP_URL` - Public URL of your application
- `NODE_ENV` - Environment (automatically set by Vercel)

### Payment Processing (Stripe)

- `STRIPE_SECRET_KEY` - Your Stripe secret key
- `STRIPE_PUBLISHABLE_KEY` - Your Stripe publishable key
- `STRIPE_WEBHOOK_SECRET` - Your Stripe webhook secret

### AI Services

- `OPENAI_API_KEY` - OpenAI API key
- `ANTHROPIC_API_KEY` - Anthropic API key
- `AZURE_OPENAI_API_KEY` - Azure OpenAI API key
- `AZURE_OPENAI_ENDPOINT` - Azure OpenAI endpoint URL
- `AZURE_OPENAI_DEPLOYMENT_NAME` - Azure OpenAI deployment name

### Analytics & Monitoring

- `POSTHOG_KEY` - PostHog project key
- `POSTHOG_HOST` - PostHog host URL
- `LANGFUSE_PUBLIC_KEY` - Langfuse public key
- `LANGFUSE_SECRET_KEY` - Langfuse secret key
- `LANGFUSE_HOST` - Langfuse host URL

### Cloud Storage (AWS S3)

- `AWS_ACCESS_KEY_ID` - AWS access key ID
- `AWS_SECRET_ACCESS_KEY` - AWS secret access key
- `AWS_REGION` - AWS region (e.g., `us-east-1`)
- `AWS_S3_BUCKET_NAME` - S3 bucket name

### Background Jobs (Inngest)

- `INNGEST_EVENT_KEY` - Inngest event key
- `INNGEST_SIGNING_KEY` - Inngest signing key

### Additional Services

- `MEM0_API_KEY` - Mem0 API key
- `EXA_API_KEY` - Exa API key
- `DAYTONA_API_KEY` - Daytona API key
- `E2B_API_KEY` - E2B API key

## Vercel-Specific Variables (Auto-set)

These are automatically set by Vercel and don't need to be configured:

- `VERCEL` - Always `1` on Vercel
- `VERCEL_ENV` - Environment (`production`, `preview`, `development`)
- `VERCEL_URL` - Deployment URL
- `VERCEL_REGION` - Deployment region

## Setting Environment Variables in Vercel

1. Go to your project dashboard on Vercel
2. Navigate to Settings → Environment Variables
3. Add each variable with the appropriate value
4. Set the environment scope (Production, Preview, Development) as needed

## Security Notes

- Never commit `.env` files to version control
- Use Vercel's environment variable interface for sensitive data
- Consider using Vercel's secret management for highly sensitive keys
- Rotate API keys regularly
- Use different keys for different environments (production vs development)

## Database Migration

For production deployments, ensure your database migrations are run. You may need to:

1. Set up a separate deployment for database migrations
2. Use Vercel's build command to run migrations before the build
3. Consider using a database migration service

## Troubleshooting

If you encounter issues:

1. Check that all required environment variables are set
2. Verify the values are correct (no typos, proper URLs)
3. Ensure database connectivity from Vercel's edge functions
4. Check Vercel's function logs for detailed error messages
