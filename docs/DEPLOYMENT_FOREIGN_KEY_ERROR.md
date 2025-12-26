# Deployment Foreign Key Error Fix

## Error Message
```
Foreign key constraint violated on the constraint: `deployments_projectId_fkey`
```

## What This Means

The deployment system is trying to create a deployment record in the database, but the `projectId` it's using doesn't exist in the `projects` table. This violates the foreign key constraint that ensures every deployment belongs to a valid project.

## Why This Happens

1. **Environment Mismatch**: The project exists in your local/dev database but not in the staging database
2. **Deleted Project**: The project was deleted from staging but you're still trying to deploy it
3. **Stale Project ID**: You're using a project ID from a different environment
4. **Database Not Synced**: Migrations haven't been run on staging

## Schema Details

From `schema.prisma`:
```prisma
model Deployment {
  projectId String @unique  // Required, must reference existing project
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  // ...
}
```

The constraint was made strict in migration `20250925010807`:
- `projectId` changed from nullable to required
- Added unique constraint on `projectId`
- Changed `ON DELETE SET NULL` to `ON DELETE CASCADE`

## How to Fix

### Option 1: Create a New Project (Recommended)
1. Go to the staging environment home page
2. Create a fresh project
3. This ensures the project exists in the staging database
4. Deploy the new project

### Option 2: Verify Project Exists
1. Get the project ID from your deployment attempt
2. Check if it exists in staging database:
   ```sql
   SELECT id, name, "userId", "createdAt" 
   FROM "Project" 
   WHERE id = 'your-project-id';
   ```
3. If it doesn't exist, create a new project (Option 1)

### Option 3: Check Database Migrations
If this affects ALL projects:
1. Verify migrations have been run on staging:
   ```bash
   cd packages/database
   npx prisma migrate status
   ```
2. If migrations are pending:
   ```bash
   npx prisma migrate deploy
   ```

### Option 4: Sync Project from Local to Staging
If you need to preserve a specific project:
1. Export the project data from local
2. Import it to staging (ensure user IDs match)
3. This is complex and not recommended for most cases

## Prevention

1. **Always create projects in the target environment** before deploying
2. **Don't share project IDs across environments** (local, staging, production)
3. **Run migrations on all environments** when schema changes
4. **Use environment-specific databases** to avoid confusion

## Technical Details

The foreign key constraint ensures referential integrity:
- Every deployment MUST have a valid project
- If a project is deleted, its deployments are automatically deleted (CASCADE)
- The `projectId` must be unique (one deployment per project)

This is by design to maintain data consistency and prevent orphaned deployments.
