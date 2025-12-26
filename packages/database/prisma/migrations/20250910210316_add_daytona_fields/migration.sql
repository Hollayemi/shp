-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "currentBranch" TEXT DEFAULT 'main',
ADD COLUMN     "daytonaSandboxId" TEXT,
ADD COLUMN     "gitCommitHash" TEXT,
ADD COLUMN     "gitRepositoryUrl" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "daytonaActiveSandboxId" TEXT;

-- CreateTable
CREATE TABLE "GitFragment" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "commitHash" TEXT NOT NULL,
    "branch" TEXT NOT NULL DEFAULT 'main',
    "message" TEXT,
    "authorEmail" TEXT,
    "authorName" TEXT,
    "projectId" TEXT NOT NULL,
    "parentFragmentId" TEXT,

    CONSTRAINT "GitFragment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GitFragment_projectId_idx" ON "GitFragment"("projectId");

-- CreateIndex
CREATE INDEX "GitFragment_commitHash_idx" ON "GitFragment"("commitHash");

-- CreateIndex
CREATE INDEX "GitFragment_branch_idx" ON "GitFragment"("branch");

-- CreateIndex
CREATE INDEX "GitFragment_createdAt_idx" ON "GitFragment"("createdAt" DESC);

-- AddForeignKey
ALTER TABLE "GitFragment" ADD CONSTRAINT "GitFragment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GitFragment" ADD CONSTRAINT "GitFragment_parentFragmentId_fkey" FOREIGN KEY ("parentFragmentId") REFERENCES "GitFragment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
