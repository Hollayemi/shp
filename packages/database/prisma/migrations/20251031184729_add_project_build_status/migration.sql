-- CreateEnum
CREATE TYPE "ProjectBuildStatus" AS ENUM ('IDLE', 'GENERATING', 'BUILDING', 'READY', 'ERROR');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "buildError" TEXT,
ADD COLUMN     "buildStatus" "ProjectBuildStatus" NOT NULL DEFAULT 'IDLE',
ADD COLUMN     "buildStatusUpdatedAt" TIMESTAMP(3);
