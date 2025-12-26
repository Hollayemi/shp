#!/usr/bin/env tsx

/**
 * Script to view all ProjectError records for a project
 * Usage: npx tsx scripts/view-project-errors.ts project-id
 */

import { prisma } from "../src/lib/db";

async function viewProjectErrors(projectId: string) {
  try {
    console.log(`🔍 Looking for errors in project: ${projectId}`);

    // Get project info
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
    });

    if (!project) {
      console.error(`❌ Project with ID ${projectId} not found`);
      return;
    }

    console.log(`📁 Project: ${project.name} (${project.id})`);
    console.log(`📅 Created: ${project.createdAt.toISOString()}`);
    console.log("");

    // Get ALL project errors (not just recent ones)
    const errors = await prisma.projectError.findMany({
      where: {
        projectId,
      },
      orderBy: {
        detectedAt: "desc",
      },
    });

    if (errors.length === 0) {
      console.log("✅ No errors found for this project");
      return;
    }

    console.log(`🚨 Found ${errors.length} error(s):`);
    console.log("");

    // Group errors by status
    const errorsByStatus = errors.reduce((acc, error) => {
      if (!acc[error.status]) {
        acc[error.status] = [];
      }
      acc[error.status].push(error);
      return acc;
    }, {} as Record<string, typeof errors>);

    // Display errors grouped by status
    (Object.entries(errorsByStatus) as [string, typeof errors][]).forEach(([status, statusErrors]) => {
      console.log(`📊 ${status} (${statusErrors.length}):`);
      console.log("─".repeat(50));

      statusErrors.forEach((error, index) => {
        console.log(`${index + 1}. [${error.errorType}] ${error.severity}`);
        console.log(`   ID: ${error.id}`);
        console.log(`   Detected: ${error.detectedAt.toISOString()}`);
        if (error.resolvedAt) {
          console.log(`   Resolved: ${error.resolvedAt.toISOString()}`);
        }
        console.log(`   Auto-fixable: ${error.autoFixable ? "✅" : "❌"}`);
        console.log(`   Fix attempts: ${error.fixAttempts}`);
        if (error.fixStrategy) {
          console.log(`   Fix strategy: ${error.fixStrategy}`);
        }

        // Show error details
        const details = error.errorDetails as any;
        if (details?.message) {
          console.log(`   Message: ${details.message}`);
        }
        if (details?.file) {
          console.log(`   File: ${details.file}`);
        }
        if (details?.line) {
          console.log(`   Line: ${details.line}`);
        }
        if (details?.column) {
          console.log(`   Column: ${details.column}`);
        }

        console.log("");
      });
    });

    // Summary statistics
    console.log("📈 Summary:");
    console.log("─".repeat(30));
    console.log(`Total errors: ${errors.length}`);
    console.log(`Auto-fixable: ${errors.filter((e) => e.autoFixable).length}`);
    console.log(
      `Resolved: ${errors.filter((e) => e.status === "RESOLVED").length}`
    );
    console.log(
      `Failed: ${errors.filter((e) => e.status === "FAILED").length}`
    );
    console.log(
      `Ignored: ${errors.filter((e) => e.status === "IGNORED").length}`
    );
    console.log(
      `Still active: ${errors.filter((e) => e.status === "DETECTED").length}`
    );

    // Error types breakdown
    const errorTypes = errors.reduce((acc, error) => {
      acc[error.errorType] = (acc[error.errorType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log("");
    console.log("🔍 Error types:");
    Object.entries(errorTypes).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
  } catch (error) {
    console.error("❌ Error viewing project errors:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Parse command line arguments
const projectId = process.argv[2];

if (!projectId) {
  console.error("❌ Please provide a project ID");
  console.log("Usage: npx tsx scripts/view-project-errors.ts project-id");
  console.log("");
  console.log("💡 To find project IDs, you can:");
  console.log("  1. Check the URL when viewing a project");
  console.log("  2. Run: npx tsx scripts/list-projects.ts");
  process.exit(1);
}

// Validate project ID format (should be UUID)
const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!uuidRegex.test(projectId)) {
  console.error("❌ Please provide a valid project ID (UUID format)");
  process.exit(1);
}

viewProjectErrors(projectId);
