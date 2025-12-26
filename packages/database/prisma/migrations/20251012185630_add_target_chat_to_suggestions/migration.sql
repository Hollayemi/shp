-- DropForeignKey
ALTER TABLE "project_errors" DROP CONSTRAINT "project_errors_fragmentId_fkey";

-- AlterTable
ALTER TABLE "hal_suggestions" ADD COLUMN     "targetChat" TEXT NOT NULL DEFAULT 'builder';

-- AddForeignKey
ALTER TABLE "project_errors" ADD CONSTRAINT "project_errors_fragmentId_fkey" FOREIGN KEY ("fragmentId") REFERENCES "V2Fragment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
