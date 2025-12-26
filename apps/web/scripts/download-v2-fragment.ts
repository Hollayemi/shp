#!/usr/bin/env tsx

/**
 * Script to download both V2Fragment and Daytona sandbox files from a project
 * Downloads to two folders: v2fragment/ and daytona/ for comparison
 *
 * Usage: npx tsx scripts/download-v2-fragment.ts <project-id> [output-path]
 *
 * Examples:
 *   # Download to auto-generated path (downloads entire sandbox root, excludes .git and node_modules)
 *   npx tsx scripts/download-v2-fragment.ts abc-123
 *
 *   # Download to specific path
 *   npx tsx scripts/download-v2-fragment.ts abc-123 ~/Downloads/my-project
 *
 *   # Download only src/ directory from sandbox
 *   SANDBOX_PATH=src npx tsx scripts/download-v2-fragment.ts abc-123
 *
 * Note: Automatically excludes .git and node_modules directories from Daytona downloads
 */

import { prisma } from "../src/lib/db";
import { writeFileSync, mkdirSync, existsSync, rmSync } from "fs";
import { join, dirname } from "path";
import * as dotenv from "dotenv";
import { Daytona } from "@daytonaio/sdk";
import * as path from "path";

dotenv.config();

type ProjectFiles = {
  [path: string]: string;
};

const EXCLUDED_DIRS = [".git", "node_modules"];

const downloadAllFilesRecursive = async (
  sandbox: any,
  remotePath: string,
  localPath: string,
): Promise<number> => {
  let count = 0;
  try {
    const files = await sandbox.fs.listFiles(remotePath);

    if (!existsSync(localPath)) {
      mkdirSync(localPath, { recursive: true });
    }

    for (const fileInfo of files) {
      if (EXCLUDED_DIRS.includes(fileInfo.name)) {
        console.log(`  ⏭️  Skipping ${fileInfo.name}/`);
        continue;
      }

      const remoteFilePath = path.join(remotePath, fileInfo.name);
      const localFilePath = path.join(localPath, fileInfo.name);

      if (fileInfo.isDir) {
        const subCount = await downloadAllFilesRecursive(
          sandbox,
          remoteFilePath,
          localFilePath,
        );
        count += subCount;
      } else {
        await sandbox.fs.downloadFile(remoteFilePath, localFilePath);
        console.log(`  ✓ ${remoteFilePath}`);
        count++;
      }
    }
  } catch (error) {
    console.error(`❌ Error processing ${remotePath}:`, error);
  }
  return count;
};

const downloadProjectFiles = async (projectId: string, outputPath?: string) => {
  let daytonaSandbox: any = null;

  try {
    console.log(`🔍 Looking for project: ${projectId}`);

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        activeFragmentId: true,
        daytonaSandboxId: true,
      },
    });

    if (!project) {
      console.error(`❌ Project with ID ${projectId} not found`);
      return;
    }

    console.log(`✅ Found project: ${project.name}`);

    const baseDownloadPath =
      outputPath ||
      join(
        process.env.HOME || "/tmp",
        `shipper-project-${projectId}-${Date.now()}`,
      );

    console.log(`📁 Base download path: ${baseDownloadPath}`);

    console.log(`\n${"=".repeat(60)}`);
    console.log(`📦 DOWNLOADING V2FRAGMENT FILES`);
    console.log(`${"=".repeat(60)}\n`);

    const fragment = await prisma.v2Fragment.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });

    const v2FragmentPath = join(baseDownloadPath, "v2fragment");
    let v2DownloadedCount = 0;

    if (!fragment) {
      console.warn(`⚠️  No V2Fragment found for project ${projectId}`);
    } else {
      console.log(`✅ Found fragment: ${fragment.title}`);
      console.log(`📅 Created: ${fragment.createdAt.toLocaleString()}`);

      const files = fragment.files as ProjectFiles;
      const fileCount = Object.keys(files).length;

      console.log(`📄 Fragment contains ${fileCount} files`);
      console.log(`📁 Downloading to: ${v2FragmentPath}\n`);

      for (const [filePath, content] of Object.entries(files)) {
        try {
          const fullPath = join(v2FragmentPath, filePath);
          const fileDir = dirname(fullPath);

          if (!existsSync(fileDir)) {
            mkdirSync(fileDir, { recursive: true });
          }

          writeFileSync(fullPath, content, "utf-8");
          console.log(`  ✓ ${filePath}`);
          v2DownloadedCount++;
        } catch (error) {
          console.error(`  ❌ Failed to write file ${filePath}:`, error);
        }
      }

      console.log(
        `\n✅ Downloaded ${v2DownloadedCount}/${fileCount} files from V2Fragment`,
      );
    }

    console.log(`\n${"=".repeat(60)}`);
    console.log(`🚀 DOWNLOADING DAYTONA SANDBOX FILES`);
    console.log(`${"=".repeat(60)}\n`);

    if (!project.daytonaSandboxId) {
      console.warn(`⚠️  No Daytona sandbox found for project ${projectId}`);
      console.log(`💡 This project may not have an active Daytona sandbox yet`);
    } else {
      console.log(`✅ Found sandbox ID: ${project.daytonaSandboxId}`);

      if (!process.env.DAYTONA_API_KEY) {
        console.error(
          `❌ DAYTONA_API_KEY environment variable is required to download sandbox files`,
        );
      } else {
        const daytona = new Daytona({
          apiKey: process.env.DAYTONA_API_KEY,
        });

        console.log(`📡 Connecting to sandbox...`);

        try {
          daytonaSandbox = await daytona.findOne({
            id: project.daytonaSandboxId,
          });

          if (!daytonaSandbox) {
            console.error(
              `❌ Sandbox ${project.daytonaSandboxId} not found at Daytona`,
            );
          } else {
            console.log(`✅ Connected to sandbox: ${daytonaSandbox.id}`);

            const daytonaPath = join(baseDownloadPath, "daytona");
            const sandboxRemotePath = process.env.SANDBOX_PATH || ".";
            console.log(`📁 Downloading to: ${daytonaPath}`);
            console.log(`📂 Remote path: ${sandboxRemotePath}\n`);

            const daytonaDownloadedCount = await downloadAllFilesRecursive(
              daytonaSandbox,
              sandboxRemotePath,
              daytonaPath,
            );

            console.log(
              `\n✅ Downloaded ${daytonaDownloadedCount} files from Daytona sandbox`,
            );
          }
        } catch (sandboxError) {
          console.error(
            `❌ Failed to connect to Daytona sandbox:`,
            sandboxError,
          );
        }
      }
    }

    console.log(`\n${"=".repeat(60)}`);
    console.log(`📊 SUMMARY`);
    console.log(`${"=".repeat(60)}\n`);
    console.log(`   Project ID: ${project.id}`);
    console.log(`   Project Name: ${project.name}`);
    console.log(`   Base Path: ${baseDownloadPath}`);
    console.log(`   V2Fragment Files: ${v2DownloadedCount}`);
    console.log(
      `   Daytona Files: ${daytonaSandbox ? "Downloaded" : "Not available"}`,
    );
    console.log(`\n📂 You can now compare the files in:`);
    console.log(`   ${v2FragmentPath}`);
    if (daytonaSandbox) {
      console.log(`   ${join(baseDownloadPath, "daytona")}`);
    }
  } catch (error) {
    console.error("❌ Error downloading project files:", error);
    throw error;
  } finally {
    if (daytonaSandbox) {
      console.log(
        "\n🧹 Note: Daytona sandbox was NOT deleted (kept for comparison)",
      );
    }
    await prisma.$disconnect();
  }
};

const projectId = process.argv[2];
const outputPath = process.argv[3];

if (!projectId) {
  console.error(
    "❌ Usage: npx tsx scripts/download-v2-fragment.ts <project-id> [output-path]",
  );
  console.error("   Example: npx tsx scripts/download-v2-fragment.ts abc-123");
  console.error(
    "   Example: npx tsx scripts/download-v2-fragment.ts abc-123 ~/Downloads/my-project",
  );
  console.log("\nℹ️  This script downloads both:");
  console.log("   1. V2Fragment files to v2fragment/ subfolder");
  console.log(
    "   2. Daytona sandbox files to daytona/ subfolder (entire root by default)",
  );
  console.log("\n💡 Environment variables:");
  console.log(
    "   SANDBOX_PATH=<path> - Download specific path from sandbox (default: '.')",
  );
  console.log(
    "   Example: SANDBOX_PATH=src npx tsx scripts/download-v2-fragment.ts abc-123",
  );
  process.exit(1);
}

console.log(`🚀 Downloading project files for: ${projectId}`);
if (outputPath) {
  console.log(`📁 Output path: ${outputPath}`);
}

downloadProjectFiles(projectId, outputPath);
