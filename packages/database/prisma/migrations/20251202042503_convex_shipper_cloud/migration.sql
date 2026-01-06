-- CreateEnum
CREATE TYPE "ConvexDeploymentStatus" AS ENUM ('ACTIVE', 'DEPLOYING', 'ERROR', 'DELETED');

-- DropForeignKey (IF EXISTS to handle migration from branches with different history)
ALTER TABLE "public"."uploads" DROP CONSTRAINT IF EXISTS "uploads_teamId_fkey";

-- DropIndex (IF EXISTS to handle migration from branches with different history)
DROP INDEX IF EXISTS "public"."uploads_uploadType_idx";

-- DropIndex (IF EXISTS to handle migration from branches with different history)
DROP INDEX IF EXISTS "public"."uploads_userId_idx";

-- AlterTable
ALTER TABLE "uploads" ALTER COLUMN "tags" DROP DEFAULT,
ALTER COLUMN "usedInProjects" DROP DEFAULT;

-- CreateTable
CREATE TABLE "convex_deployments" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "convexProjectId" TEXT NOT NULL,
    "convexDeploymentName" TEXT NOT NULL,
    "convexDeploymentUrl" TEXT NOT NULL,
    "deployKeyEncrypted" TEXT NOT NULL,
    "status" "ConvexDeploymentStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastDeployedAt" TIMESTAMP(3),
    "lastDeployError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "convex_deployments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "convex_deployments_projectId_key" ON "convex_deployments"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "convex_deployments_convexDeploymentName_key" ON "convex_deployments"("convexDeploymentName");

-- CreateIndex
CREATE INDEX "convex_deployments_status_idx" ON "convex_deployments"("status");

-- CreateIndex
CREATE INDEX "convex_deployments_convexDeploymentName_idx" ON "convex_deployments"("convexDeploymentName");

-- CreateIndex (IF NOT EXISTS to handle migration from branches with different history)
CREATE INDEX IF NOT EXISTS "uploads_userId_uploadType_idx" ON "uploads"("userId", "uploadType");

-- CreateIndex (IF NOT EXISTS to handle migration from branches with different history)
CREATE INDEX IF NOT EXISTS "uploads_tags_idx" ON "uploads"("tags");

-- AddForeignKey
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "convex_deployments" ADD CONSTRAINT "convex_deployments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
