-- Fix the failed subdomain migration
-- This migration handles the cleanup and reapplication

-- Step 1: Add subdomain column if it doesn't exist (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'Project' 
        AND column_name = 'subdomain'
    ) THEN
        ALTER TABLE "Project" ADD COLUMN "subdomain" TEXT;
    END IF;
END $$;

-- Step 2: Backfill subdomain for existing projects (idempotent - only updates NULL values)
UPDATE "Project" 
SET "subdomain" = LOWER(
  REGEXP_REPLACE(
    REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '-', 'g'),
    '^-+|-+$', '', 'g'
  )
)
WHERE "subdomain" IS NULL;
