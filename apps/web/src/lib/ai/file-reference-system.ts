/**
 * File Reference System
 * Manages file operations without storing full content in messages
 */

export interface FileReference {
  path: string;
  action: "created" | "updated" | "deleted";
  size: number;
  hash?: string;
  timestamp: number;
  description?: string;
}

export interface FileOperationResult {
  success: boolean;
  files: FileReference[];
  summary: string;
  error?: string;
}

export class FileReferenceManager {
  /**
   * Create a file reference from a file operation
   */
  static createFileReference(
    path: string,
    content: string,
    action: "created" | "updated",
    description?: string,
  ): FileReference {
    return {
      path,
      action,
      size: content.length,
      hash: this.generateContentHash(content),
      timestamp: Date.now(),
      description,
    };
  }

  /**
   * Generate a simple hash for content comparison
   */
  private static generateContentHash(content: string): string {
    let hash = 0;
    if (content.length === 0) return hash.toString(36);

    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(36);
  }

  /**
   * Create a summary of file operations for display
   */
  static createOperationSummary(references: FileReference[]): string {
    if (references.length === 0) return "No files modified";

    const created = references.filter((f) => f.action === "created").length;
    const updated = references.filter((f) => f.action === "updated").length;
    const deleted = references.filter((f) => f.action === "deleted").length;

    const parts: string[] = [];
    if (created > 0) parts.push(`${created} created`);
    if (updated > 0) parts.push(`${updated} updated`);
    if (deleted > 0) parts.push(`${deleted} deleted`);

    return `Files: ${parts.join(", ")}`;
  }

  /**
   * Create a detailed summary with file names for UI display
   */
  static createDetailedSummary(references: FileReference[]): string {
    if (references.length === 0) return "No files modified";

    const groups = {
      created: references.filter((f) => f.action === "created"),
      updated: references.filter((f) => f.action === "updated"),
      deleted: references.filter((f) => f.action === "deleted"),
    };

    const lines: string[] = [];

    if (groups.created.length > 0) {
      lines.push(`**Created ${groups.created.length} files:**`);
      groups.created.forEach((f) => {
        const desc = f.description ? ` - ${f.description}` : "";
        lines.push(`  • \`${f.path}\` (${this.formatFileSize(f.size)})${desc}`);
      });
    }

    if (groups.updated.length > 0) {
      lines.push(`**Updated ${groups.updated.length} files:**`);
      groups.updated.forEach((f) => {
        const desc = f.description ? ` - ${f.description}` : "";
        lines.push(`  • \`${f.path}\` (${this.formatFileSize(f.size)})${desc}`);
      });
    }

    if (groups.deleted.length > 0) {
      lines.push(`**Deleted ${groups.deleted.length} files:**`);
      groups.deleted.forEach((f) => {
        lines.push(`  • \`${f.path}\``);
      });
    }

    return lines.join("\n");
  }

  /**
   * Format file size for human reading
   */
  private static formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }

  /**
   * Get file extension for icon/type detection
   */
  static getFileType(path: string): string {
    const ext = path.split(".").pop()?.toLowerCase() || "";

    if (["tsx", "jsx"].includes(ext)) return "component";
    if (["ts", "js"].includes(ext)) return "script";
    if (["css", "scss", "sass"].includes(ext)) return "style";
    if (["json"].includes(ext)) return "config";
    if (["md", "mdx"].includes(ext)) return "documentation";
    if (["html"].includes(ext)) return "markup";
    if (["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(ext))
      return "image";

    return "file";
  }

  /**
   * Check if two file references represent the same content
   */
  static isSameContent(ref1: FileReference, ref2: FileReference): boolean {
    return (
      ref1.path === ref2.path &&
      ref1.size === ref2.size &&
      ref1.hash === ref2.hash
    );
  }

  /**
   * Merge multiple file operations into a single result
   */
  static mergeOperations(operations: FileReference[]): FileOperationResult {
    // Remove duplicates and keep latest operation for each path
    const latestOps = new Map<string, FileReference>();

    operations.forEach((op) => {
      const existing = latestOps.get(op.path);
      if (!existing || op.timestamp > existing.timestamp) {
        latestOps.set(op.path, op);
      }
    });

    const files = Array.from(latestOps.values());

    return {
      success: true,
      files,
      summary: this.createOperationSummary(files),
    };
  }
}
