-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "activeSandboxId" TEXT,
ADD COLUMN     "sandboxCreatedAt" TIMESTAMP(3),
ADD COLUMN     "sandboxLastUsedAt" TIMESTAMP(3);
