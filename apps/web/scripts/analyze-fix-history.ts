#!/usr/bin/env npx tsx

import { prisma } from "../src/lib/db";

interface FileChange {
  fragmentId: string;
  fragmentTitle: string;
  createdAt: Date;
  filePath: string;
  contentLength: number;
  contentPreview: string;
  hasDefaultExport: boolean;
  isAutoFixed: boolean;
}

async function analyzeFixHistory(projectId: string) {
  console.log(`🔍 Analyzing fix history for project: ${projectId}\n`);

  try {
    // Get all fragments for this project ordered by creation time
    const fragments = await prisma.v2Fragment.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        title: true,
        createdAt: true,
        files: true,
      },
    });

    if (fragments.length === 0) {
      console.log("❌ No fragments found for this project");
      return;
    }

    console.log(`📄 Found ${fragments.length} fragments\n`);

    // Get project info
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        activeFragmentId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    console.log(`🔍 Project Info:`);
    console.log(`   ID: ${project?.id}`);
    console.log(`   Active Fragment: ${project?.activeFragmentId}`);
    console.log(`   Created: ${project?.createdAt}`);
    console.log(`   Updated: ${project?.updatedAt}\n`);

    // Track file changes across fragments
    const fileHistory = new Map<string, FileChange[]>();

    // Analyze each fragment
    for (const fragment of fragments) {
      const files = fragment.files as Record<string, string> | null;

      if (!files) {
        console.log(`⚠️  Fragment ${fragment.id} has no files`);
        continue;
      }

      const isAutoFixed = fragment.title.includes("Auto-fixed");

      console.log(
        `📋 Fragment ${fragment.id} (${fragment.createdAt.toISOString()})`
      );
      console.log(`   Title: ${fragment.title}`);
      console.log(`   Auto-fixed: ${isAutoFixed ? "✅" : "❌"}`);
      console.log(`   Files: ${Object.keys(files).length}`);

      // Analyze each file in this fragment
      for (const [filePath, content] of Object.entries(files)) {
        if (!fileHistory.has(filePath)) {
          fileHistory.set(filePath, []);
        }

        const hasDefaultExport = content.includes("export default");
        const hasMarkdownWrapper = content.trim().startsWith("```");

        const change: FileChange = {
          fragmentId: fragment.id,
          fragmentTitle: fragment.title,
          createdAt: fragment.createdAt,
          filePath,
          contentLength: content.length,
          contentPreview: content.substring(0, 100).replace(/\n/g, "\\n"),
          hasDefaultExport,
          isAutoFixed,
        };

        fileHistory.get(filePath)!.push(change);

        // Special analysis for App.tsx
        if (filePath.includes("App.tsx")) {
          console.log(`   📝 ${filePath}:`);
          console.log(`      Length: ${content.length} chars`);
          console.log(
            `      Default Export: ${hasDefaultExport ? "✅" : "❌"}`
          );
          console.log(
            `      Markdown Wrapper: ${hasMarkdownWrapper ? "❌" : "✅"}`
          );

          if (hasMarkdownWrapper) {
            console.log(`      ⚠️  CORRUPTED: Contains markdown wrapper!`);
          }

          // Show end of file to see export
          const lines = content.split("\n");
          console.log(`      Last 3 lines:`);
          lines.slice(-3).forEach((line, idx) => {
            const lineNum = lines.length - 3 + idx + 1;
            console.log(`        ${lineNum}: ${line}`);
          });
        }
      }
      console.log("");
    }

    // Show file evolution summary
    console.log(`📊 File Evolution Summary:\n`);

    for (const [filePath, changes] of fileHistory) {
      if (!filePath.includes("App.tsx")) continue; // Focus on App.tsx for this analysis

      console.log(`🗂️  ${filePath}:`);
      console.log(`   Total versions: ${changes.length}`);

      changes.forEach((change, index) => {
        const isActive = change.fragmentId === project?.activeFragmentId;
        const status = [];

        if (isActive) status.push("ACTIVE");
        if (change.isAutoFixed) status.push("AUTO-FIXED");
        if (change.hasDefaultExport) status.push("HAS_EXPORT");

        console.log(
          `   ${index + 1}. ${change.createdAt.toISOString()} - ${
            change.contentLength
          } chars ${status.length > 0 ? `[${status.join(", ")}]` : ""}`
        );
        console.log(`      Fragment: ${change.fragmentTitle}`);
        console.log(`      Preview: ${change.contentPreview}...`);
      });
      console.log("");
    }

    // Get recent errors for this project
    const recentErrors = await prisma.projectError.findMany({
      where: { projectId },
      orderBy: { detectedAt: "desc" },
      take: 10,
      select: {
        id: true,
        errorType: true,
        severity: true,
        status: true,
        fragmentId: true,
        detectedAt: true,
        errorDetails: true,
      },
    });

    console.log(`🚨 Recent Errors (${recentErrors.length}):\n`);
    recentErrors.forEach((error, index) => {
      const details =
        typeof error.errorDetails === "object" &&
        error.errorDetails !== null &&
        !Array.isArray(error.errorDetails)
          ? (error.errorDetails as { message?: string; file?: string })
          : {};
      console.log(
        `   ${index + 1}. ${error.errorType} (${error.severity}) - ${
          error.status
        }`
      );
      console.log(`      Message: ${details.message || "No message"}`);
      console.log(`      File: ${details.file || "Unknown"}`);
      console.log(`      Fragment: ${error.fragmentId}`);
      console.log(`      Detected: ${error.detectedAt.toISOString()}`);
      console.log("");
    });

    await prisma.$disconnect();
  } catch (error) {
    console.error("❌ Error analyzing fix history:", error);
    await prisma.$disconnect();
  }
}

// Run the analysis
const projectId = process.argv[2] || "4314e519-09c7-4bf4-a289-fe655193859a";
analyzeFixHistory(projectId);
