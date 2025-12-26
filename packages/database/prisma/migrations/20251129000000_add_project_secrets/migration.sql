-- CreateTable
CREATE TABLE "project_secrets" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_secrets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_secrets_projectId_idx" ON "project_secrets"("projectId");

-- CreateIndex
CREATE INDEX "project_secrets_key_idx" ON "project_secrets"("key");

-- CreateIndex
CREATE UNIQUE INDEX "project_secrets_projectId_key_key" ON "project_secrets"("projectId", "key");
