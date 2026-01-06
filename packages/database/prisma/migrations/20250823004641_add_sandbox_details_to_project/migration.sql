-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "sandboxCreatedAt" TIMESTAMP(3),
ADD COLUMN     "sandboxExpiresAt" TIMESTAMP(3),
ADD COLUMN     "sandboxId" TEXT,
ADD COLUMN     "sandboxUrl" TEXT;
