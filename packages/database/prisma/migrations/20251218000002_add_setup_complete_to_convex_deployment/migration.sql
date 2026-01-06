-- AlterTable
ALTER TABLE "convex_deployments" ADD COLUMN "setupComplete" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "convex_deployments" ADD COLUMN "setupCompletedAt" TIMESTAMP(3);

-- Update existing deployments to mark setup as complete (they were created before this tracking existed)
UPDATE "convex_deployments" SET "setupComplete" = true WHERE "setupComplete" = false;
