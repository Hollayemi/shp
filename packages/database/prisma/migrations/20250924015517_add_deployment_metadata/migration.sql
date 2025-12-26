-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "deployedAt" TIMESTAMP(3),
ADD COLUMN     "deployedRef" TEXT,
ADD COLUMN     "deploymentUrl" TEXT;
