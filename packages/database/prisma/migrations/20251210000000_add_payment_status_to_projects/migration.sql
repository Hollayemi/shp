-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('ACTIVE', 'GRACE_PERIOD', 'SUSPENDED');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Project" ADD COLUMN "gracePeriodEnds" TIMESTAMP(3);