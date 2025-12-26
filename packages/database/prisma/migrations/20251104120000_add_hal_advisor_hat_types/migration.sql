-- AlterTable
ALTER TABLE "hal_chat_messages" ADD COLUMN "hatType" TEXT NOT NULL DEFAULT 'generalist';

-- AlterTable
ALTER TABLE "hal_suggestions" ADD COLUMN "hatType" TEXT NOT NULL DEFAULT 'generalist';

-- CreateIndex
CREATE INDEX "hal_chat_messages_projectId_hatType_createdAt_idx" ON "hal_chat_messages"("projectId", "hatType", "createdAt");

