# Staging Migration Issue

## Problem
The staging database has migrations applied that don't exist in the codebase:
- `20251129000000_add_project_secrets`
- `20251129000001_add_custom_domains`  
- `20251129000002_add_autofill_metadata_fields`

## Impact
- Custom domains feature shows "Failed to list domains" error
- Database schema drift detected
- Cannot create new migrations until resolved

## Solution Needed
Someone needs to:
1. Export the missing migration SQL from the database
2. Create the migration files locally
3. Commit them to the repository

OR

1. Reset the staging database
2. Re-apply all migrations from the codebase

## Temporary Workaround
The autofill feature works independently and doesn't require these migrations.
The domains feature is affected by the missing `custom_domains` table migration.
