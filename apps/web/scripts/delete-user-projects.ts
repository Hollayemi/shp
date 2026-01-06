#!/usr/bin/env tsx

/**
 * Script to delete all projects for a specific user by email
 * Usage: pnpm tsx scripts/delete-user-projects.ts
 */

import { prisma } from "@/lib/db";

const USER_EMAIL = "neil@bleepsystems.com";

async function deleteUserProjects() {
  try {
    console.log(`🔍 Looking for user with email: ${USER_EMAIL}`);

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: USER_EMAIL },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    if (!user) {
      console.error(`❌ User with email ${USER_EMAIL} not found`);
      return;
    }

    console.log(`👤 Found user: ${user.name} (${user.email})`);

    // Get all teams the user is a member of
    const userTeams = await prisma.teamMember.findMany({
      where: { userId: user.id },
      select: {
        teamId: true,
        team: {
          select: {
            id: true,
            name: true,
            slug: true,
            isPersonal: true,
          },
        },
      },
    });

    console.log(`👥 User is member of ${userTeams.length} teams`);

    // Get all projects the user has access to (personal + team projects)
    const projects = await prisma.project.findMany({
      where: {
        OR: [
          // Legacy personal projects
          { userId: user.id },
          // Team projects
          { teamId: { in: userTeams.map((tm) => tm.teamId) } },
        ],
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        userId: true,
        teamId: true,
        team: {
          select: {
            name: true,
            slug: true,
          },
        },
        _count: {
          select: {
            messages: true,
            v2Messages: true,
            v2Fragments: true,
            gitFragments: true,
            chatStreams: true,
            projectErrors: true,
            autoFixSessions: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    console.log(`📁 Found ${projects.length} projects to delete`);

    if (projects.length === 0) {
      console.log(`✅ No projects found for user ${USER_EMAIL}`);
      return;
    }

    // Display projects that will be deleted
    console.log(`\n📋 Projects to be deleted:`);
    projects.forEach((project, index) => {
      const projectType = project.userId ? "Personal" : "Team";
      const teamName = project.team?.name || "N/A";
      console.log(`${index + 1}. ${project.name} (${projectType})`);
      console.log(`   ID: ${project.id}`);
      console.log(`   Created: ${project.createdAt.toISOString()}`);
      console.log(`   Team: ${teamName}`);
      console.log(
        `   Messages: ${project._count.messages + project._count.v2Messages}`
      );
      console.log(
        `   Fragments: ${
          project._count.v2Fragments + project._count.gitFragments
        }`
      );
      console.log(`   Chat Streams: ${project._count.chatStreams}`);
      console.log(`   Errors: ${project._count.projectErrors}`);
      console.log(`   Auto-fix Sessions: ${project._count.autoFixSessions}`);
      console.log("");
    });

    // Confirmation prompt
    console.log(
      `⚠️  WARNING: This will permanently delete ${projects.length} projects and all associated data!`
    );
    console.log(`This action cannot be undone.`);

    // For safety, require manual confirmation
    const readline = require("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise<string>((resolve) => {
      rl.question('Type "DELETE" to confirm deletion: ', resolve);
    });

    rl.close();

    if (answer !== "DELETE") {
      console.log("❌ Deletion cancelled");
      return;
    }

    console.log(`\n🗑️  Starting deletion of ${projects.length} projects...`);

    let deletedCount = 0;
    let errorCount = 0;

    // Delete projects one by one to handle errors gracefully
    for (const project of projects) {
      try {
        console.log(`🗑️  Deleting project: ${project.name} (${project.id})`);

        // Delete the project (cascade will handle related data)
        await prisma.project.delete({
          where: { id: project.id },
        });

        deletedCount++;
        console.log(`✅ Deleted: ${project.name}`);
      } catch (error) {
        errorCount++;
        console.error(`❌ Failed to delete ${project.name}:`, error);
      }
    }

    console.log(`\n📊 Deletion Summary:`);
    console.log(`✅ Successfully deleted: ${deletedCount} projects`);
    console.log(`❌ Failed to delete: ${errorCount} projects`);
    console.log(`📁 Total projects: ${projects.length}`);

    if (deletedCount > 0) {
      console.log(
        `\n🎉 Successfully deleted ${deletedCount} projects for user ${USER_EMAIL}`
      );
    }

    if (errorCount > 0) {
      console.log(
        `\n⚠️  ${errorCount} projects could not be deleted. Check the errors above.`
      );
    }
  } catch (error) {
    console.error("❌ Script failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
deleteUserProjects().catch((error) => {
  console.error("❌ Unhandled error:", error);
  process.exit(1);
});
