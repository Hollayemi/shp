-- CreateEnum
CREATE TYPE "ErrorType" AS ENUM ('COMPILATION', 'RUNTIME', 'IMPORT', 'NAVIGATION', 'BUILD', 'TYPE_SCRIPT', 'ESLINT', 'DEPENDENCY', 'OTHER');

-- CreateEnum
CREATE TYPE "ErrorSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ErrorStatus" AS ENUM ('DETECTED', 'FIXING', 'RESOLVED', 'FAILED', 'IGNORED');

-- CreateEnum
CREATE TYPE "AutoFixStatus" AS ENUM ('STARTED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "project_errors" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "errorType" "ErrorType" NOT NULL,
    "errorDetails" JSONB NOT NULL,
    "severity" "ErrorSeverity" NOT NULL,
    "autoFixable" BOOLEAN NOT NULL DEFAULT true,
    "status" "ErrorStatus" NOT NULL DEFAULT 'DETECTED',
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "fixAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastFixAttempt" TIMESTAMP(3),
    "fixStrategy" TEXT,

    CONSTRAINT "project_errors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auto_fix_sessions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "errorsDetected" JSONB NOT NULL,
    "fixesApplied" JSONB NOT NULL,
    "successRate" DOUBLE PRECISION,
    "status" "AutoFixStatus" NOT NULL DEFAULT 'STARTED',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "totalErrors" INTEGER NOT NULL DEFAULT 0,
    "successfulFixes" INTEGER NOT NULL DEFAULT 0,
    "failedFixes" INTEGER NOT NULL DEFAULT 0,
    "skippedFixes" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "auto_fix_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_AutoFixSessionToProjectError" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AutoFixSessionToProjectError_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "project_errors_projectId_idx" ON "project_errors"("projectId");

-- CreateIndex
CREATE INDEX "project_errors_errorType_idx" ON "project_errors"("errorType");

-- CreateIndex
CREATE INDEX "project_errors_severity_idx" ON "project_errors"("severity");

-- CreateIndex
CREATE INDEX "project_errors_status_idx" ON "project_errors"("status");

-- CreateIndex
CREATE INDEX "project_errors_detectedAt_idx" ON "project_errors"("detectedAt");

-- CreateIndex
CREATE INDEX "auto_fix_sessions_projectId_idx" ON "auto_fix_sessions"("projectId");

-- CreateIndex
CREATE INDEX "auto_fix_sessions_userId_idx" ON "auto_fix_sessions"("userId");

-- CreateIndex
CREATE INDEX "auto_fix_sessions_status_idx" ON "auto_fix_sessions"("status");

-- CreateIndex
CREATE INDEX "auto_fix_sessions_startedAt_idx" ON "auto_fix_sessions"("startedAt");

-- CreateIndex
CREATE INDEX "_AutoFixSessionToProjectError_B_index" ON "_AutoFixSessionToProjectError"("B");

-- AddForeignKey
ALTER TABLE "project_errors" ADD CONSTRAINT "project_errors_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auto_fix_sessions" ADD CONSTRAINT "auto_fix_sessions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auto_fix_sessions" ADD CONSTRAINT "auto_fix_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AutoFixSessionToProjectError" ADD CONSTRAINT "_AutoFixSessionToProjectError_A_fkey" FOREIGN KEY ("A") REFERENCES "auto_fix_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AutoFixSessionToProjectError" ADD CONSTRAINT "_AutoFixSessionToProjectError_B_fkey" FOREIGN KEY ("B") REFERENCES "project_errors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
