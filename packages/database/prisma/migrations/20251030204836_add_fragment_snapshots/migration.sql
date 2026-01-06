-- AlterTable
ALTER TABLE "V2Fragment" ADD COLUMN     "snapshotCreatedAt" TIMESTAMP(3),
ADD COLUMN     "snapshotImageId" TEXT,
ADD COLUMN     "snapshotProvider" TEXT;

-- CreateIndex
CREATE INDEX "V2Fragment_snapshotImageId_idx" ON "V2Fragment"("snapshotImageId");
