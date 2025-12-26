-- CreateEnum (IF NOT EXISTS for safety)
DO $$ BEGIN
    CREATE TYPE "CloudCreditType" AS ENUM ('PURCHASE', 'FIRST_DEPLOY_BONUS', 'PROMOTIONAL', 'USAGE', 'REFUND', 'AUTO_TOP_UP');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum (IF NOT EXISTS for safety)
DO $$ BEGIN
    CREATE TYPE "CloudCreditPurchaseStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable - Add Cloud Credit fields to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "cloudCreditBalance" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "cloudFirstDeploymentBonus" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "cloudLifetimeCreditsUsed" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE IF NOT EXISTS "cloud_credit_transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" "CloudCreditType" NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cloud_credit_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "cloud_credit_purchases" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripePaymentId" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" "CloudCreditPurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cloud_credit_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS "cloud_credit_transactions_userId_createdAt_idx" ON "cloud_credit_transactions"("userId", "createdAt");

-- CreateIndex (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS "cloud_credit_transactions_type_idx" ON "cloud_credit_transactions"("type");

-- CreateIndex (IF NOT EXISTS)
CREATE UNIQUE INDEX IF NOT EXISTS "cloud_credit_purchases_stripePaymentId_key" ON "cloud_credit_purchases"("stripePaymentId");

-- CreateIndex (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS "cloud_credit_purchases_userId_createdAt_idx" ON "cloud_credit_purchases"("userId", "createdAt");

-- AddForeignKey (safe approach - drop first if exists)
DO $$ BEGIN
    ALTER TABLE "cloud_credit_transactions" ADD CONSTRAINT "cloud_credit_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey (safe approach - drop first if exists)
DO $$ BEGIN
    ALTER TABLE "cloud_credit_purchases" ADD CONSTRAINT "cloud_credit_purchases_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
