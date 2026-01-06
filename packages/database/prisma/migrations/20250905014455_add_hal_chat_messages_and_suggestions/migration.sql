-- CreateTable
CREATE TABLE "hal_chat_messages" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hal_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hal_suggestions" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "suggestionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "clicked" BOOLEAN NOT NULL DEFAULT false,
    "clickedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hal_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hal_chat_messages_projectId_createdAt_idx" ON "hal_chat_messages"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "hal_chat_messages_userId_idx" ON "hal_chat_messages"("userId");

-- CreateIndex
CREATE INDEX "hal_suggestions_messageId_idx" ON "hal_suggestions"("messageId");

-- CreateIndex
CREATE INDEX "hal_suggestions_clicked_idx" ON "hal_suggestions"("clicked");

-- AddForeignKey
ALTER TABLE "hal_chat_messages" ADD CONSTRAINT "hal_chat_messages_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hal_chat_messages" ADD CONSTRAINT "hal_chat_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hal_suggestions" ADD CONSTRAINT "hal_suggestions_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "hal_chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
