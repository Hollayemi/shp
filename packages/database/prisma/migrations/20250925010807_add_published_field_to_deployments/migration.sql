/*
  Warnings:

  - A unique constraint covering the columns `[projectId]` on the table `deployments` will be added. If there are existing duplicate values, this will fail.
  - Made the column `projectId` on table `deployments` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "deployments" DROP CONSTRAINT "deployments_projectId_fkey";

-- AlterTable
ALTER TABLE "deployments" ADD COLUMN     "published" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "projectId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "deployments_projectId_key" ON "deployments"("projectId");

-- CreateIndex
CREATE INDEX "deployments_name_idx" ON "deployments"("name");

-- CreateIndex
CREATE INDEX "deployments_published_idx" ON "deployments"("published");

-- AddForeignKey
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
