-- CreateTable
CREATE TABLE "public"."deployments" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "files" JSONB NOT NULL,
    "entryPoint" TEXT NOT NULL DEFAULT 'index.html',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastAccessed" TIMESTAMP(3),
    "projectId" TEXT,
    "userId" TEXT,

    CONSTRAINT "deployments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "deployments_appId_key" ON "public"."deployments"("appId");

-- CreateIndex
CREATE INDEX "deployments_appId_idx" ON "public"."deployments"("appId");

-- CreateIndex
CREATE INDEX "deployments_createdAt_idx" ON "public"."deployments"("createdAt");

-- CreateIndex
CREATE INDEX "deployments_userId_idx" ON "public"."deployments"("userId");

-- CreateIndex
CREATE INDEX "deployments_projectId_idx" ON "public"."deployments"("projectId");

-- AddForeignKey
ALTER TABLE "public"."deployments" ADD CONSTRAINT "deployments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."deployments" ADD CONSTRAINT "deployments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
