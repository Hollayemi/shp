import { Daytona } from "@daytonaio/sdk";
import * as fs from "fs";
import * as path from "path";
import { config } from "dotenv";

// Load environment variables from .env file
config();

/**
 * Test script to download all files from a Daytona snapshot
 * Usage: pnpm tsx scripts/test-snapshot-download.ts
 */

const SNAPSHOT_NAME = "vite-todo-template-v3";
const DOWNLOAD_PATH = "./downloaded-snapshot";

async function downloadAllFilesRecursive(
  sandbox: any,
  remotePath: string,
  localPath: string,
): Promise<void> {
  try {
    // List files in the current directory
    const files = await sandbox.fs.listFiles(remotePath);

    // Create local directory if it doesn't exist
    if (!fs.existsSync(localPath)) {
      fs.mkdirSync(localPath, { recursive: true });
    }

    for (const fileInfo of files) {
      const remoteFilePath = path.join(remotePath, fileInfo.name);
      const localFilePath = path.join(localPath, fileInfo.name);

      if (fileInfo.isDir) {
        // Recursively download subdirectory
        console.log(`📁 Creating directory: ${localFilePath}`);
        await downloadAllFilesRecursive(sandbox, remoteFilePath, localFilePath);
      } else {
        // Download individual file
        console.log(`📄 Downloading: ${remoteFilePath} -> ${localFilePath}`);
        await sandbox.fs.downloadFile(remoteFilePath, localFilePath);
      }
    }
  } catch (error) {
    console.error(`❌ Error processing ${remotePath}:`, error);
    throw error;
  }
}

async function downloadSnapshotFiles(): Promise<void> {
  console.log(`🚀 Starting download from snapshot: ${SNAPSHOT_NAME}`);

  // Validate environment
  if (!process.env.DAYTONA_API_KEY) {
    throw new Error("DAYTONA_API_KEY environment variable is required");
  }

  let sandbox: any = null;

  try {
    // Initialize Daytona client
    const daytona = new Daytona({
      apiKey: process.env.DAYTONA_API_KEY!,
    });

    console.log("✅ Daytona client initialized");

    // Create sandbox from snapshot
    console.log(`📦 Creating sandbox from snapshot: ${SNAPSHOT_NAME}`);
    sandbox = await daytona.create({
      snapshot: SNAPSHOT_NAME,
    });

    console.log(`✅ Sandbox created: ${sandbox.id}`);
    console.log(`📊 Sandbox state: ${sandbox.state || "running"}`);

    // Clean up existing download directory
    if (fs.existsSync(DOWNLOAD_PATH)) {
      console.log(
        `🗑️  Cleaning up existing download directory: ${DOWNLOAD_PATH}`,
      );
      fs.rmSync(DOWNLOAD_PATH, { recursive: true, force: true });
    }

    // Download only files from src/ directory
    console.log(`📥 Starting download of src/ directory to: ${DOWNLOAD_PATH}`);
    await downloadAllFilesRecursive(sandbox, "src", DOWNLOAD_PATH);

    // List downloaded files
    console.log("\n📋 Downloaded files:");
    const listFilesRecursive = (dir: string, prefix: string = "") => {
      const files = fs.readdirSync(dir);
      files.forEach((file) => {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);
        if (stats.isDirectory()) {
          console.log(`${prefix}📁 ${file}/`);
          listFilesRecursive(filePath, prefix + "  ");
        } else {
          console.log(`${prefix}📄 ${file} (${stats.size} bytes)`);
        }
      });
    };
    listFilesRecursive(DOWNLOAD_PATH);

    console.log(
      `\n🎉 Successfully downloaded all files from snapshot '${SNAPSHOT_NAME}' to '${DOWNLOAD_PATH}'`,
    );
  } catch (error) {
    console.error("❌ Failed to download snapshot files:", error);
    throw error;
  } finally {
    // Clean up sandbox
    if (sandbox) {
      console.log("🧹 Cleaning up sandbox...");
      try {
        await sandbox.delete();
        console.log("✅ Sandbox deleted");
      } catch (cleanupError) {
        console.error("⚠️  Warning: Failed to delete sandbox:", cleanupError);
      }
    }
  }
}

// Run the test
if (require.main === module) {
  downloadSnapshotFiles()
    .then(() => {
      console.log("✨ Script completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Script failed:", error);
      process.exit(1);
    });
}

export { downloadSnapshotFiles, SNAPSHOT_NAME, DOWNLOAD_PATH };
