-- CreateEnum
CREATE TYPE "PersonalConnectorProvider" AS ENUM ('NOTION', 'LINEAR', 'ATLASSIAN', 'MIRO', 'N8N', 'FIGMA', 'CUSTOM');

-- CreateEnum
CREATE TYPE "SharedConnectorType" AS ENUM ('STRIPE', 'SUPABASE', 'SHOPIFY', 'FIREBASE', 'CLERK', 'RESEND', 'TWILIO', 'PERPLEXITY', 'ELEVENLABS', 'FIRECRAWL');

-- CreateEnum
CREATE TYPE "ConnectorStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'ERROR', 'REVOKED', 'PENDING');

-- CreateTable
CREATE TABLE "personal_connectors" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "PersonalConnectorProvider" NOT NULL,
    "customName" TEXT,
    "customUrl" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB,
    "status" "ConnectorStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastUsedAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personal_connectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shared_connectors" (
    "id" TEXT NOT NULL,
    "teamId" TEXT,
    "projectId" TEXT,
    "connectorType" "SharedConnectorType" NOT NULL,
    "name" TEXT,
    "credentials" TEXT NOT NULL,
    "config" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "status" "ConnectorStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastUsedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "shared_connectors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "personal_connectors_userId_idx" ON "personal_connectors"("userId");

-- CreateIndex
CREATE INDEX "personal_connectors_provider_idx" ON "personal_connectors"("provider");

-- CreateIndex
CREATE INDEX "personal_connectors_status_idx" ON "personal_connectors"("status");

-- CreateIndex
CREATE UNIQUE INDEX "personal_connectors_userId_provider_customUrl_key" ON "personal_connectors"("userId", "provider", "customUrl");

-- CreateIndex
CREATE INDEX "shared_connectors_teamId_idx" ON "shared_connectors"("teamId");

-- CreateIndex
CREATE INDEX "shared_connectors_projectId_idx" ON "shared_connectors"("projectId");

-- CreateIndex
CREATE INDEX "shared_connectors_connectorType_idx" ON "shared_connectors"("connectorType");

-- CreateIndex
CREATE INDEX "shared_connectors_status_idx" ON "shared_connectors"("status");

-- CreateIndex
CREATE UNIQUE INDEX "shared_connectors_teamId_connectorType_key" ON "shared_connectors"("teamId", "connectorType");

-- CreateIndex
CREATE UNIQUE INDEX "shared_connectors_projectId_connectorType_key" ON "shared_connectors"("projectId", "connectorType");

-- AddForeignKey
ALTER TABLE "personal_connectors" ADD CONSTRAINT "personal_connectors_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_connectors" ADD CONSTRAINT "shared_connectors_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_connectors" ADD CONSTRAINT "shared_connectors_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_connectors" ADD CONSTRAINT "shared_connectors_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
