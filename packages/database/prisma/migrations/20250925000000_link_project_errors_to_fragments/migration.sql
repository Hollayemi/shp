-- Add fragment tracking to ProjectError table
ALTER TABLE "project_errors" ADD COLUMN "fragmentId" TEXT;

-- Add foreign key constraint
ALTER TABLE "project_errors" ADD CONSTRAINT "project_errors_fragmentId_fkey" 
  FOREIGN KEY ("fragmentId") REFERENCES "V2Fragment"("id") ON DELETE CASCADE;

-- Create index for fragment-based queries
CREATE INDEX "project_errors_fragmentId_idx" ON "project_errors"("fragmentId");

-- Create index for severity-based filtering
CREATE INDEX "project_errors_severity_status_idx" ON "project_errors"("severity", "status");
