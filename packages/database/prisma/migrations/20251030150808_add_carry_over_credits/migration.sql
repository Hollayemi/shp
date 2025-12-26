-- AlterTable
ALTER TABLE "users" ADD COLUMN     "basePlanCredits" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "carryOverCredits" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "carryOverExpiresAt" TIMESTAMP(3);
