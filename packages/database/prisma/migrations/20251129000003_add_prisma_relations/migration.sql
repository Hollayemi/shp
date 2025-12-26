-- This migration adds Prisma relation fields to the schema
-- No actual database changes are needed as the foreign key columns already exist
-- This is purely for Prisma's type system and relational query capabilities

-- The following relations are now defined in the Prisma schema:
-- 1. CustomDomain.project -> Project (via projectId)
-- 2. project_secrets.project -> Project (via projectId)
-- 3. Project.customDomains -> CustomDomain[]
-- 4. Project.secrets -> project_secrets[]

-- No SQL changes required - this migration is a no-op for the database
-- but ensures Prisma's migration history is in sync with the schema
