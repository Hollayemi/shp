-- Migration to add activeStreamStartedAt column to Project table safely
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "activeStreamStartedAt" TIMESTAMP;
