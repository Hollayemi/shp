-- Add Team billing fields
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT;
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "billingEmail" TEXT;
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "billingEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Create unique indexes for Team billing
CREATE UNIQUE INDEX IF NOT EXISTS "teams_stripeCustomerId_key" ON "teams"("stripeCustomerId");
CREATE UNIQUE INDEX IF NOT EXISTS "teams_stripeSubscriptionId_key" ON "teams"("stripeSubscriptionId");
CREATE INDEX IF NOT EXISTS "teams_stripeCustomerId_idx" ON "teams"("stripeCustomerId");

-- Add webhook fields to convex_deployments
ALTER TABLE "convex_deployments" ADD COLUMN IF NOT EXISTS "webhookSecretEncrypted" TEXT;
ALTER TABLE "convex_deployments" ADD COLUMN IF NOT EXISTS "webhookConfiguredAt" TIMESTAMP(3);

-- Create ConvexUsageEventType enum
DO $$ BEGIN
    CREATE TYPE "ConvexUsageEventType" AS ENUM ('FUNCTION_EXECUTION', 'STORAGE_SNAPSHOT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create ConvexBillingStatus enum
DO $$ BEGIN
    CREATE TYPE "ConvexBillingStatus" AS ENUM ('PENDING', 'CALCULATED', 'REPORTED', 'BILLED', 'PAID');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create convex_usage_records table
CREATE TABLE IF NOT EXISTS "convex_usage_records" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "convexDeploymentName" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "functionCalls" INTEGER NOT NULL DEFAULT 0,
    "actionComputeMs" INTEGER NOT NULL DEFAULT 0,
    "databaseReadBytes" BIGINT NOT NULL DEFAULT 0,
    "databaseWriteBytes" BIGINT NOT NULL DEFAULT 0,
    "fileStorageReadBytes" BIGINT NOT NULL DEFAULT 0,
    "fileStorageWriteBytes" BIGINT NOT NULL DEFAULT 0,
    "vectorStorageReadBytes" BIGINT NOT NULL DEFAULT 0,
    "vectorStorageWriteBytes" BIGINT NOT NULL DEFAULT 0,
    "totalDocumentSizeBytes" BIGINT,
    "totalIndexSizeBytes" BIGINT,
    "totalFileStorageBytes" BIGINT,
    "totalVectorStorageBytes" BIGINT,
    "totalBackupStorageBytes" BIGINT,
    "eventType" "ConvexUsageEventType" NOT NULL,
    "rawEvent" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "convex_usage_records_pkey" PRIMARY KEY ("id")
);

-- Create convex_usage_periods table
CREATE TABLE IF NOT EXISTS "convex_usage_periods" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "totalFunctionCalls" BIGINT NOT NULL DEFAULT 0,
    "totalActionComputeMs" BIGINT NOT NULL DEFAULT 0,
    "totalDatabaseBandwidthBytes" BIGINT NOT NULL DEFAULT 0,
    "totalFileBandwidthBytes" BIGINT NOT NULL DEFAULT 0,
    "totalVectorBandwidthBytes" BIGINT NOT NULL DEFAULT 0,
    "peakDatabaseStorageBytes" BIGINT NOT NULL DEFAULT 0,
    "peakFileStorageBytes" BIGINT NOT NULL DEFAULT 0,
    "peakVectorStorageBytes" BIGINT NOT NULL DEFAULT 0,
    "functionCallsCost" INTEGER NOT NULL DEFAULT 0,
    "actionComputeCost" INTEGER NOT NULL DEFAULT 0,
    "databaseBandwidthCost" INTEGER NOT NULL DEFAULT 0,
    "databaseStorageCost" INTEGER NOT NULL DEFAULT 0,
    "fileBandwidthCost" INTEGER NOT NULL DEFAULT 0,
    "fileStorageCost" INTEGER NOT NULL DEFAULT 0,
    "vectorBandwidthCost" INTEGER NOT NULL DEFAULT 0,
    "vectorStorageCost" INTEGER NOT NULL DEFAULT 0,
    "totalCost" INTEGER NOT NULL DEFAULT 0,
    "stripeUsageRecordId" TEXT,
    "reportedToStripeAt" TIMESTAMP(3),
    "status" "ConvexBillingStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "convex_usage_periods_pkey" PRIMARY KEY ("id")
);

-- Create indexes for convex_usage_records
CREATE INDEX IF NOT EXISTS "convex_usage_records_teamId_timestamp_idx" ON "convex_usage_records"("teamId", "timestamp");
CREATE INDEX IF NOT EXISTS "convex_usage_records_convexDeploymentName_idx" ON "convex_usage_records"("convexDeploymentName");
CREATE INDEX IF NOT EXISTS "convex_usage_records_eventType_idx" ON "convex_usage_records"("eventType");
CREATE INDEX IF NOT EXISTS "convex_usage_records_timestamp_idx" ON "convex_usage_records"("timestamp");

-- Create indexes for convex_usage_periods
CREATE UNIQUE INDEX IF NOT EXISTS "convex_usage_periods_teamId_periodStart_periodEnd_key" ON "convex_usage_periods"("teamId", "periodStart", "periodEnd");
CREATE INDEX IF NOT EXISTS "convex_usage_periods_teamId_idx" ON "convex_usage_periods"("teamId");
CREATE INDEX IF NOT EXISTS "convex_usage_periods_periodStart_periodEnd_idx" ON "convex_usage_periods"("periodStart", "periodEnd");
CREATE INDEX IF NOT EXISTS "convex_usage_periods_status_idx" ON "convex_usage_periods"("status");

-- Add foreign keys
ALTER TABLE "convex_usage_records" DROP CONSTRAINT IF EXISTS "convex_usage_records_teamId_fkey";
ALTER TABLE "convex_usage_records" ADD CONSTRAINT "convex_usage_records_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "convex_usage_periods" DROP CONSTRAINT IF EXISTS "convex_usage_periods_teamId_fkey";
ALTER TABLE "convex_usage_periods" ADD CONSTRAINT "convex_usage_periods_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
