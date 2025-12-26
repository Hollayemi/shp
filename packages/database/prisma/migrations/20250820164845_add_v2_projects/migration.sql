-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "messagingVersion" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "Chat" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "V2Message" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "V2Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessagePart" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "text_text" TEXT,
    "reasoning_text" TEXT,
    "file_mediaType" TEXT,
    "file_filename" TEXT,
    "file_url" TEXT,
    "source_url_sourceId" TEXT,
    "source_url_url" TEXT,
    "source_url_title" TEXT,
    "source_document_sourceId" TEXT,
    "source_document_mediaType" TEXT,
    "source_document_title" TEXT,
    "source_document_filename" TEXT,
    "tool_toolCallId" TEXT,
    "tool_state" TEXT,
    "tool_errorText" TEXT,
    "tool_getOrCreateSandbox_input" JSONB,
    "tool_getOrCreateSandbox_output" JSONB,
    "providerMetadata" JSONB,

    CONSTRAINT "MessagePart_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "V2Message_chatId_idx" ON "V2Message"("chatId");

-- CreateIndex
CREATE INDEX "V2Message_projectId_idx" ON "V2Message"("projectId");

-- CreateIndex
CREATE INDEX "V2Message_createdAt_idx" ON "V2Message"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "MessagePart_messageId_idx" ON "MessagePart"("messageId");

-- CreateIndex
CREATE INDEX "MessagePart_messageId_order_idx" ON "MessagePart"("messageId", "order");

-- AddForeignKey
ALTER TABLE "V2Message" ADD CONSTRAINT "V2Message_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "V2Message" ADD CONSTRAINT "V2Message_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessagePart" ADD CONSTRAINT "MessagePart_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "V2Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
