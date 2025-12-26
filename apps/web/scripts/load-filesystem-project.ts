#!/usr/bin/env tsx

/**
 * Script to load a filesystem project into the Shipper system
 * Usage: npx tsx scripts/load-filesystem-project.ts your-email@example.com sandbox-templates/neil-test/simple-1
 */

import { prisma } from "../src/lib/db";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";
import {
  createSandbox,
  restoreFilesInSandbox,
} from "../src/lib/daytona-sandbox-manager";

interface ProjectFiles {
  [path: string]: string;
}

async function loadFilesystemProject(email: string, projectPath: string) {
  try {
    console.log(`🔍 Looking for user with email: ${email}`);
    console.log(`📁 Loading project from: ${projectPath}`);

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        creditBalance: true,
      },
    });

    if (!user) {
      console.error(`❌ User with email ${email} not found`);
      return;
    }

    console.log(`👤 Found user: ${user.name} (${user.email})`);
    console.log(`💰 Current balance: ${user.creditBalance} credits`);

    // Check if user has enough credits
    if (user.creditBalance < 1) {
      console.error(
        `❌ Insufficient credits. Need at least 1 credit to create a project.`
      );
      return;
    }

    // Read all files from the project directory
    const files = await readProjectFiles(projectPath);
    console.log(`📄 Found ${Object.keys(files).length} files in project`);

    // Get or create personal team
    let team = await prisma.team.findFirst({
      where: {
        isPersonal: true,
        members: {
          some: {
            userId: user.id,
            role: "OWNER",
          },
        },
      },
    });

    if (!team) {
      console.log(`👥 Creating personal team for user`);
      const teamSlug = `personal-${user.id.slice(-8)}`;
      team = await prisma.team.create({
        data: {
          name: `${user.name || user.email}'s Team`,
          description: `Personal workspace for ${user.name || user.email}`,
          slug: teamSlug,
          isPersonal: true,
          members: {
            create: {
              userId: user.id,
              role: "OWNER",
            },
          },
        },
      });
    }

    console.log(`👥 Using team: ${team.name} (${team.id})`);

    // Create project
    const project = await prisma.$transaction(async (tx) => {
      // Create project
      const newProject = await tx.project.create({
        data: {
          name: `Filesystem Project - ${new Date().toLocaleString()}`,
          userId: user.id, // Set userId so it appears in homepage
          teamId: team!.id,
          messagingVersion: 2, // Use V2 messaging
        },
      });

      // Deduct 1 credit
      await tx.user.update({
        where: { id: user.id },
        data: { creditBalance: { decrement: 1 } },
      });

      // Log credit transaction
      await tx.creditTransaction.create({
        data: {
          userId: user.id,
          amount: -1,
          type: "AI_GENERATION",
          description: "Project creation from filesystem",
          metadata: {
            source: "filesystem-loader",
            projectId: newProject.id,
            fileCount: Object.keys(files).length,
          },
        },
      });

      return newProject;
    });

    console.log(`✅ Created project: ${project.name} (${project.id})`);

    // Create V2Fragment with all files
    const fragment = await prisma.v2Fragment.create({
      data: {
        title: "Initial Project Files",
        files: files,
        projectId: project.id,
      },
    });

    console.log(`✅ Created V2Fragment: ${fragment.title} (${fragment.id})`);

    // Create Daytona sandbox and upload files
    console.log(`🏗️  Creating Daytona sandbox...`);
    const sandboxInfo = await createSandbox(project.id, fragment.id);
    console.log(`✅ Created sandbox: ${sandboxInfo.sandbox.id}`);

    // Upload files to sandbox
    console.log(
      `📤 Uploading ${Object.keys(files).length} files to sandbox...`
    );
    const uploadedCount = await restoreFilesInSandbox(
      sandboxInfo.sandbox,
      files
    );
    console.log(`✅ Uploaded ${uploadedCount} files to sandbox`);

    // Update project with active fragment
    await prisma.project.update({
      where: { id: project.id },
      data: {
        activeFragmentId: fragment.id,
      },
    });

    // Create initial user message with proper parts format
    const userMessage = await prisma.v2Message.create({
      data: {
        projectId: project.id,
        role: "user",
        content: JSON.stringify([
          { type: "text", text: "Load filesystem project for testing" },
        ]),
      },
    });

    // Create assistant message with proper parts format
    const assistantMessage = await prisma.v2Message.create({
      data: {
        projectId: project.id,
        role: "assistant",
        content: JSON.stringify([
          {
            type: "text",
            text: `Successfully loaded filesystem project with ${
              Object.keys(files).length
            } files. The project is now ready for development and testing.`,
          },
        ]),
      },
    });

    console.log(`✅ Created initial messages`);

    // Get updated user balance
    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { creditBalance: true },
    });

    console.log(`\n🎉 Project loaded successfully!`);
    console.log(`📊 Summary:`);
    console.log(`   Project ID: ${project.id}`);
    console.log(`   Fragment ID: ${fragment.id}`);
    console.log(`   Sandbox ID: ${sandboxInfo.sandbox.id}`);
    console.log(`   Sandbox URL: ${sandboxInfo.sandboxUrl}`);
    console.log(`   Files loaded: ${Object.keys(files).length}`);
    console.log(`   Files uploaded: ${uploadedCount}`);
    console.log(`   User balance: ${updatedUser?.creditBalance} credits`);
    console.log(`\n🌐 Access your project at: /projects/${project.id}`);

    // List some of the files that were loaded
    console.log(`\n📄 Files loaded:`);
    Object.keys(files)
      .slice(0, 10)
      .forEach((filePath) => {
        const content = files[filePath];
        console.log(`   ${filePath} (${content.length} chars)`);
      });
    if (Object.keys(files).length > 10) {
      console.log(`   ... and ${Object.keys(files).length - 10} more files`);
    }
  } catch (error) {
    console.error("❌ Error loading filesystem project:", error);
  } finally {
    await prisma.$disconnect();
  }
}

async function readProjectFiles(projectPath: string): Promise<ProjectFiles> {
  const files: ProjectFiles = {};

  function readDirectory(dirPath: string, basePath: string = projectPath) {
    const items = readdirSync(dirPath);

    for (const item of items) {
      const fullPath = join(dirPath, item);
      const relativePath = relative(basePath, fullPath);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        // Skip common directories that shouldn't be included
        if (
          !["node_modules", ".git", ".next", "dist", "build"].includes(item)
        ) {
          readDirectory(fullPath, basePath);
        }
      } else if (stat.isFile()) {
        try {
          const content = readFileSync(fullPath, "utf-8");
          files[relativePath] = content;
        } catch (error) {
          console.warn(`⚠️  Could not read file ${relativePath}: ${error}`);
        }
      }
    }
  }

  readDirectory(projectPath);
  return files;
}

// Parse command line arguments
const email = process.argv[2];
const projectPath = process.argv[3];

if (!email || !projectPath) {
  console.error(
    "❌ Usage: npx tsx scripts/load-filesystem-project.ts your-email@example.com path/to/project"
  );
  console.error(
    "   Example: npx tsx scripts/load-filesystem-project.ts neil@example.com sandbox-templates/neil-test/simple-1"
  );
  process.exit(1);
}

console.log(`🚀 Loading filesystem project for ${email} from ${projectPath}`);
loadFilesystemProject(email, projectPath);
