/**
 * Shared metadata service for project metadata retrieval
 */

import { prisma } from '@shipper/database';

export interface ProjectMetadata {
  title: string;
  description: string;
  iconUrl: string | null;
  shareImageUrl: string | null;
  ogTitle: string;
  ogDescription: string;
  ogImage: string | null;
  twitterTitle: string;
  twitterDescription: string;
  twitterImage: string | null;
}

export interface ProjectMetadataResponse {
  success: boolean;
  projectId: string;
  projectName: string;
  deploymentUrl: string | null;
  metadata: ProjectMetadata;
}

export async function getProjectMetadata(projectId: string): Promise<ProjectMetadataResponse | null> {
  // Get project with sandbox information
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      subtitle: true,
      deploymentUrl: true,
      sandboxId: true,
      daytonaSandboxId: true,
      sandboxProvider: true,
    },
  });

  if (!project) {
    return null;
  }

  // Default fallback metadata
  let title = project.name || 'Shipper App';
  let description = project.subtitle || `${project.name} - Built with Shipper`;
  let iconUrl: string | null = null;
  let shareImageUrl: string | null = null;

  // Try to get dynamic metadata from sandbox if available
  const provider = (project.sandboxProvider as "modal" | "daytona" | null) || "modal";
  const sandboxId = provider === "modal" ? project.sandboxId : project.daytonaSandboxId;

  if (sandboxId) {
    try {
      // Import sandbox APIs dynamically
      const { daytonaAPI } = await import("@/lib/api/daytona-client");
      const { modalAPI } = await import("@/lib/api/modal-client");
      
      const api = provider === "modal" ? modalAPI : daytonaAPI;

      // Read index.html from sandbox
      const htmlContent = await api.readFile(sandboxId, "index.html");

      // Parse metadata from HTML
      const titleMatch = htmlContent.match(/<title>(.*?)<\/title>/);
      const iconMatch = htmlContent.match(
        /<link[^>]*rel=["']icon["'][^>]*href=["']([^"']*)["']/,
      );
      const descriptionMatch = htmlContent.match(
        /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/,
      );
      const ogImageMatch = htmlContent.match(
        /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["']/,
      );

      // Update metadata with parsed values
      if (titleMatch && titleMatch[1]) {
        title = titleMatch[1];
      }
      if (descriptionMatch && descriptionMatch[1]) {
        description = descriptionMatch[1];
      }

      // Try to get icon as data URL if it exists
      if (iconMatch && iconMatch[1]) {
        const iconPath = iconMatch[1].replace(/^\//, ""); // Remove leading slash
        if (iconPath && iconPath.startsWith("favicon.")) {
          try {
            const result = await api.getMetadataImage(projectId, "icon");
            iconUrl = result.dataUrl;
          } catch (error) {
            console.warn("[Metadata] Failed to read icon from sandbox:", error);
          }
        }
      }

      // Try to get share image as data URL if it exists
      if (ogImageMatch && ogImageMatch[1]) {
        const imagePath = ogImageMatch[1].replace(/^\//, ""); // Remove leading slash
        if (imagePath && imagePath.startsWith("images/")) {
          try {
            const result = await api.getMetadataImage(projectId, "shareImage");
            shareImageUrl = result.dataUrl;
          } catch (error) {
            console.warn("[Metadata] Failed to read share image from sandbox:", error);
          }
        }
      }
    } catch (error) {
      console.warn("[Metadata] Failed to read metadata from sandbox:", error);
      // Continue with fallback metadata
    }
  }

  return {
    success: true,
    projectId: project.id,
    projectName: project.name,
    deploymentUrl: project.deploymentUrl,
    metadata: {
      title,
      description,
      iconUrl,
      shareImageUrl,
      // Additional SEO metadata
      ogTitle: title,
      ogDescription: description,
      ogImage: shareImageUrl,
      twitterTitle: title,
      twitterDescription: description,
      twitterImage: shareImageUrl,
    },
  };
}