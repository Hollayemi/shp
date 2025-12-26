-- CreateEnum
CREATE TYPE "DomainStatus" AS ENUM ('PENDING_VALIDATION', 'ACTIVE', 'FAILED', 'DELETED');

-- CreateEnum
CREATE TYPE "DomainSSLStatus" AS ENUM ('PENDING', 'ACTIVE', 'FAILED');

-- CreateTable
CREATE TABLE "custom_domains" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "cloudflareHostnameId" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "status" "DomainStatus" NOT NULL DEFAULT 'PENDING_VALIDATION',
    "sslStatus" "DomainSSLStatus" NOT NULL DEFAULT 'PENDING',
    "verificationErrors" JSONB,
    "cnameTarget" TEXT,
    "txtName" TEXT,
    "txtValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),

    CONSTRAINT "custom_domains_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "custom_domains_domain_key" ON "custom_domains"("domain");

-- CreateIndex
CREATE INDEX "custom_domains_projectId_idx" ON "custom_domains"("projectId");

-- CreateIndex
CREATE INDEX "custom_domains_status_idx" ON "custom_domains"("status");

-- CreateIndex
CREATE INDEX "custom_domains_domain_idx" ON "custom_domains"("domain");

-- CreateIndex
CREATE INDEX "custom_domains_projectId_isPrimary_idx" ON "custom_domains"("projectId", "isPrimary");
