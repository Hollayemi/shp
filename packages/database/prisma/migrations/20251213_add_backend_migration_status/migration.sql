-- CreateEnum
CREATE TYPE "BackendMigrationStatus" AS ENUM ('NOT_NEEDED', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'FAILED');

-- AlterTable: Add backend migration fields to Project
ALTER TABLE "Project" ADD COLUMN "backendMigrationStatus" "BackendMigrationStatus";
ALTER TABLE "Project" ADD COLUMN "backendMigrationStartedAt" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN "backendMigrationCompletedAt" TIMESTAMP(3);
