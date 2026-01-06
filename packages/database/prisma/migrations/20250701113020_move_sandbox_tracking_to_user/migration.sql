/*
  Warnings:

  - You are about to drop the column `activeSandboxId` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `sandboxCreatedAt` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `sandboxLastUsedAt` on the `Project` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Project" DROP COLUMN "activeSandboxId",
DROP COLUMN "sandboxCreatedAt",
DROP COLUMN "sandboxLastUsedAt";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "activeProjectId" TEXT,
ADD COLUMN     "activeSandboxId" TEXT,
ADD COLUMN     "sandboxCreatedAt" TIMESTAMP(3),
ADD COLUMN     "sandboxLastUsedAt" TIMESTAMP(3);
