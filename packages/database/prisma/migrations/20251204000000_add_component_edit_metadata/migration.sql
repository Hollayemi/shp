-- CreateTable
CREATE TABLE "ComponentEditMetadata" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fragmentId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "shipperId" TEXT,
    "selector" TEXT NOT NULL,
    "componentName" TEXT,
    "isRepeated" BOOLEAN NOT NULL DEFAULT false,
    "instanceIndex" INTEGER,
    "totalInstances" INTEGER,
    "changeType" TEXT NOT NULL,
    "beforeSnapshot" TEXT NOT NULL,
    "afterSnapshot" TEXT NOT NULL,
    "styleChanges" JSONB,
    "textChanges" TEXT,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "ComponentEditMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ComponentEditMetadata_fragmentId_idx" ON "ComponentEditMetadata"("fragmentId");

-- CreateIndex
CREATE INDEX "ComponentEditMetadata_projectId_idx" ON "ComponentEditMetadata"("projectId");

-- CreateIndex
CREATE INDEX "ComponentEditMetadata_filePath_idx" ON "ComponentEditMetadata"("filePath");

-- CreateIndex
CREATE INDEX "ComponentEditMetadata_shipperId_idx" ON "ComponentEditMetadata"("shipperId");

-- CreateIndex
CREATE INDEX "ComponentEditMetadata_createdAt_idx" ON "ComponentEditMetadata"("createdAt" DESC);

-- AddForeignKey
ALTER TABLE "ComponentEditMetadata" ADD CONSTRAINT "ComponentEditMetadata_fragmentId_fkey" FOREIGN KEY ("fragmentId") REFERENCES "V2Fragment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComponentEditMetadata" ADD CONSTRAINT "ComponentEditMetadata_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
