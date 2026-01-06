/*
  Warnings:

  - A unique constraint covering the columns `[streamId]` on the table `ChatStream` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "ChatStream" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active';

-- CreateIndex
CREATE UNIQUE INDEX "ChatStream_streamId_key" ON "ChatStream"("streamId");

-- CreateIndex
CREATE INDEX "ChatStream_projectId_idx" ON "ChatStream"("projectId");

-- CreateIndex
CREATE INDEX "ChatStream_streamId_idx" ON "ChatStream"("streamId");

-- CreateIndex
CREATE INDEX "ChatStream_status_idx" ON "ChatStream"("status");
