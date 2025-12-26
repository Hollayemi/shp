-- AlterTable
ALTER TABLE "Project" ADD COLUMN "aiProxyToken" TEXT,
ADD COLUMN "aiProxyTokenCreatedAt" TIMESTAMP(3),
ADD COLUMN "aiEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "Project_aiProxyToken_key" ON "Project"("aiProxyToken");
