-- CreateEnum
CREATE TYPE "ImportedFromPlatform" AS ENUM ('LOVABLE', 'BASE44', 'BOLT', 'V0', 'GENERIC_VITE', 'OTHER');

-- AlterTable: Add importedFrom to code_imports
ALTER TABLE "code_imports" ADD COLUMN "importedFrom" "ImportedFromPlatform" NOT NULL DEFAULT 'OTHER';

-- AlterTable: Add importedFrom to Project
ALTER TABLE "Project" ADD COLUMN "importedFrom" "ImportedFromPlatform";

-- CreateIndex
CREATE INDEX "code_imports_importedFrom_idx" ON "code_imports"("importedFrom");
