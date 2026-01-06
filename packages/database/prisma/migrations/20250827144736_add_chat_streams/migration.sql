/*
  Warnings:

  - You are about to drop the column `streams` on the `Project` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Project" DROP COLUMN "streams";

-- CreateTable
CREATE TABLE "ChatStream" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "streamId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatStream_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ChatStream" ADD CONSTRAINT "ChatStream_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
