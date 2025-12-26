#!/usr/bin/env tsx

/**
 * Script to list all projects with their IDs
 * Usage: npx tsx scripts/list-projects.ts
 */

import { prisma } from "../src/lib/db";

async function listProjects() {
  try {
    console.log("📁 All Projects:");
    console.log("─".repeat(80));

    const projects = await prisma.project.findMany({
      select: {
        id: true,
        name: true,
        createdAt: true,
        userId: true,
        teamId: true,
        _count: {
          select: {
            projectErrors: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (projects.length === 0) {
      console.log("No projects found");
      return;
    }

    projects.forEach((project, index) => {
      console.log(`${index + 1}. ${project.name}`);
      console.log(`   ID: ${project.id}`);
      console.log(`   Created: ${project.createdAt.toISOString()}`);
      console.log(`   Owner: ${project.userId ? "Personal" : "Team"}`);
      console.log(`   Errors: ${project._count.projectErrors}`);
      console.log("");
    });

    console.log(`📊 Total: ${projects.length} projects`);
  } catch (error) {
    console.error("❌ Error listing projects:", error);
  } finally {
    await prisma.$disconnect();
  }
}

listProjects();
