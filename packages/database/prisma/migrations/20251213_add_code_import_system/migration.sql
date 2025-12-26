-- CreateEnum
CREATE TYPE "CodeImportSource" AS ENUM ('GITHUB', 'ZIP_UPLOAD', 'FOLDER_UPLOAD');

-- CreateEnum
CREATE TYPE "CodeImportStatus" AS ENUM ('QUEUED', 'FETCHING', 'ANALYZING', 'CREATING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- Add AWAITING_SANDBOX to ProjectBuildStatus
ALTER TYPE "ProjectBuildStatus" ADD VALUE 'AWAITING_SANDBOX';

-- CreateTable
CREATE TABLE "code_imports" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    
    -- Source information
    "source" "CodeImportSource" NOT NULL,
    "sourceUrl" TEXT,
    "sourceName" TEXT NOT NULL,
    "sourceBranch" TEXT,
    
    -- User who initiated the import
    "userId" TEXT NOT NULL,
    
    -- Import status tracking
    "status" "CodeImportStatus" NOT NULL DEFAULT 'QUEUED',
    "statusMessage" TEXT,
    "errorMessage" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    
    -- Analysis results
    "detectedFramework" TEXT,
    "detectedLanguage" TEXT,
    "fileCount" INTEGER,
    "totalSizeBytes" INTEGER,
    
    -- Link to created project (after successful import)
    "projectId" TEXT,
    
    CONSTRAINT "code_imports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "code_imports_projectId_key" ON "code_imports"("projectId");

-- CreateIndex
CREATE INDEX "code_imports_userId_idx" ON "code_imports"("userId");

-- CreateIndex
CREATE INDEX "code_imports_status_idx" ON "code_imports"("status");

-- CreateIndex
CREATE INDEX "code_imports_source_idx" ON "code_imports"("source");

-- CreateIndex
CREATE INDEX "code_imports_createdAt_idx" ON "code_imports"("createdAt" DESC);

-- AddForeignKey
ALTER TABLE "code_imports" ADD CONSTRAINT "code_imports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_imports" ADD CONSTRAINT "code_imports_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;


