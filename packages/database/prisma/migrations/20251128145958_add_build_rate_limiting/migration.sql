-- AlterTable
ALTER TABLE "users" ADD COLUMN     "activeSandboxBuilds" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "buildRateLimitResetAt" TIMESTAMP(3),
ADD COLUMN     "buildsThisHour" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastBuildStartedAt" TIMESTAMP(3),
ADD COLUMN     "maxConcurrentBuilds" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "teams" ADD COLUMN     "activeSandboxBuilds" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "buildRateLimitResetAt" TIMESTAMP(3),
ADD COLUMN     "buildsThisHour" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "maxConcurrentBuilds" INTEGER NOT NULL DEFAULT 3;
