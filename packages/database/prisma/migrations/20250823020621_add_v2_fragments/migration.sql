-- CreateTable
CREATE TABLE "V2Fragment" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "files" JSONB NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "V2Fragment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "V2Fragment_projectId_idx" ON "V2Fragment"("projectId");

-- CreateIndex
CREATE INDEX "V2Fragment_createdAt_idx" ON "V2Fragment"("createdAt" DESC);

-- AddForeignKey
ALTER TABLE "V2Fragment" ADD CONSTRAINT "V2Fragment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
