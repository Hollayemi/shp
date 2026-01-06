-- AlterTable: Change creditsUsedThisPeriod from Int to Float for accurate credit tracking
-- This prevents overcharging customers due to rounding on each individual event
ALTER TABLE "convex_deployments" ALTER COLUMN "creditsUsedThisPeriod" TYPE DOUBLE PRECISION;
