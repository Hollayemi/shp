-- CreateTable
CREATE TABLE IF NOT EXISTS "auto_top_up_configs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "thresholdCredits" INTEGER NOT NULL DEFAULT 100,
    "topUpCredits" INTEGER NOT NULL DEFAULT 400,
    "stripePaymentMethodId" TEXT,
    "maxMonthlyTopUps" INTEGER NOT NULL DEFAULT 5,
    "topUpsThisMonth" INTEGER NOT NULL DEFAULT 0,
    "monthlyResetAt" TIMESTAMP(3),
    "lastTopUpAt" TIMESTAMP(3),
    "lastTopUpAmount" INTEGER,
    "lastTopUpError" TEXT,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auto_top_up_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "auto_top_up_configs_userId_key" ON "auto_top_up_configs"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "auto_top_up_configs_enabled_idx" ON "auto_top_up_configs"("enabled");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "auto_top_up_configs_lastTopUpAt_idx" ON "auto_top_up_configs"("lastTopUpAt");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "auto_top_up_configs" ADD CONSTRAINT "auto_top_up_configs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
