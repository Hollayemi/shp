-- Migration: Aggregate usage directly on ConvexDeployment instead of separate records
-- This removes the ConvexUsageRecord table and adds aggregate fields to ConvexDeployment

-- DropForeignKey
ALTER TABLE "public"."convex_usage_records" DROP CONSTRAINT IF EXISTS "convex_usage_records_teamId_fkey";

-- AlterTable - Add usage aggregate fields to ConvexDeployment
ALTER TABLE "convex_deployments" ADD COLUMN IF NOT EXISTS "backupStorageBytes" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "creditsUsedThisPeriod" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "currentPeriodEnd" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "currentPeriodStart" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "documentStorageBytes" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "fileStorageBytes" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "indexStorageBytes" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "lastStorageUpdateAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "lastUsageAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "totalActionComputeMs" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "totalDatabaseBandwidthBytes" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "totalFileBandwidthBytes" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "totalFunctionCalls" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "totalVectorBandwidthBytes" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "vectorStorageBytes" BIGINT NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE IF EXISTS "public"."convex_usage_records";

-- DropEnum
DROP TYPE IF EXISTS "public"."ConvexUsageEventType";
