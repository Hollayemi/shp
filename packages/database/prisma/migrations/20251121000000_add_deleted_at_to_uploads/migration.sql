-- AlterTable
ALTER TABLE "uploads" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "uploads_deletedAt_idx" ON "uploads"("deletedAt");
