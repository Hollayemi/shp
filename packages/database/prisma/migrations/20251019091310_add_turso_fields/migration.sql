-- CreateTursoFields
ALTER TABLE "Project" ADD COLUMN "tursoDatabaseName" TEXT;
ALTER TABLE "Project" ADD COLUMN "tursoDatabaseUrl" TEXT;
ALTER TABLE "Project" ADD COLUMN "tursoDatabaseToken" TEXT;
ALTER TABLE "Project" ADD COLUMN "tursoCreatedAt" TIMESTAMP(3);
