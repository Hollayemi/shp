/**
 * Context Manager for Chat API
 * Handles message truncation, context pruning, and response size management
 */

import { UIMessage } from "ai";

export interface ContextLimits {
  maxMessageLength: number;
  maxContextMessages: number;
  maxFragmentFileSize: number;
  maxTotalFragmentSize: number;
  maxResponseLength: number;
}

export const DEFAULT_CONTEXT_LIMITS: ContextLimits = {
  maxMessageLength: 8000, // Max chars per message
  maxContextMessages: 15, // Max messages to keep in context
  maxFragmentFileSize: 10000, // Max chars per fragment file
  maxTotalFragmentSize: 50000, // Max total fragment content
  maxResponseLength: 15000, // Max response length
};

export class ContextManager {
  public limits: ContextLimits;

  constructor(limits: ContextLimits = DEFAULT_CONTEXT_LIMITS) {
    this.limits = limits;
  }

  /**
   * Truncate a message if it exceeds limits
   */
  truncateMessage(content: string): string {
    if (content.length <= this.limits.maxMessageLength) {
      return content;
    }

    const truncated = content.substring(0, this.limits.maxMessageLength - 100);
    return `${truncated}...\n\n[Message truncated - ${content.length - truncated.length} characters omitted]`;
  }

  /**
   * Extract text content from UIMessage safely
   */
  getMessageContent(message: UIMessage): string {
    // First, try the parts array (new UI message structure)
    const parts = (message as any).parts;
    if (Array.isArray(parts)) {
      return parts
        .filter((item: any) => item.type === "text")
        .map((item: any) => item.text)
        .join(" ");
    }

    // Fallback to content field (legacy structure)
    const content = (message as any).content;
    if (typeof content === "string") {
      return content;
    } else if (Array.isArray(content)) {
      return content
        .filter((item: any) => item.type === "text")
        .map((item: any) => item.text)
        .join(" ");
    }
    return JSON.stringify(content || "");
  }

  /**
   * Prune conversation to keep only the most recent messages
   */
  pruneConversation(messages: UIMessage[]): UIMessage[] {
    if (messages.length <= this.limits.maxContextMessages) {
      return messages;
    }

    // Always keep the first message (system/initial context) if present
    const firstMessage = messages[0];
    const recentMessages = messages.slice(-this.limits.maxContextMessages + 1);

    // If first message is system/assistant, keep it
    if (
      firstMessage?.role === "system" ||
      (firstMessage?.role === "assistant" &&
        messages.length > this.limits.maxContextMessages)
    ) {
      return [firstMessage, ...recentMessages];
    }

    return recentMessages;
  }

  /**
   * Optimize fragment files for context
   */
  optimizeFragmentFiles(files: Record<string, string>): Record<string, string> {
    const optimized: Record<string, string> = {};
    let totalSize = 0;

    // Sort files by importance (prioritize main files)
    const fileEntries = Object.entries(files).sort(([pathA], [pathB]) => {
      const importanceA = this.getFileImportance(pathA);
      const importanceB = this.getFileImportance(pathB);
      return importanceB - importanceA;
    });

    for (const [path, content] of fileEntries) {
      if (totalSize >= this.limits.maxTotalFragmentSize) {
        console.log(
          `[ContextManager] Fragment size limit reached, omitting ${Object.keys(files).length - Object.keys(optimized).length} files`,
        );
        break;
      }

      let optimizedContent = content;

      // Truncate individual files if too large
      if (content.length > this.limits.maxFragmentFileSize) {
        optimizedContent = this.truncateFile(path, content);
      }

      optimized[path] = optimizedContent;
      totalSize += optimizedContent.length;
    }

    return optimized;
  }

  /**
   * Get file importance score for prioritization
   */
  private getFileImportance(path: string): number {
    const filename = path.toLowerCase();

    // High importance files
    if (filename.includes("app.tsx") || filename.includes("app.jsx"))
      return 100;
    if (filename.includes("main.tsx") || filename.includes("main.jsx"))
      return 90;
    if (filename.includes("index.html")) return 85;
    if (filename.includes("package.json")) return 80;

    // Medium importance
    if (filename.includes("component")) return 60;
    if (filename.endsWith(".tsx") || filename.endsWith(".jsx")) return 50;
    if (filename.endsWith(".ts") || filename.endsWith(".js")) return 40;
    if (filename.endsWith(".css") || filename.endsWith(".scss")) return 30;

    // Lower importance
    if (filename.includes("test") || filename.includes("spec")) return 10;
    if (filename.includes(".d.ts")) return 5;

    return 20; // Default importance
  }

  /**
   * Truncate file content intelligently
   */
  private truncateFile(path: string, content: string): string {
    const maxSize = this.limits.maxFragmentFileSize;

    if (content.length <= maxSize) {
      return content;
    }

    // Try to preserve important parts based on file type
    if (path.endsWith(".json")) {
      return this.truncateJSON(content, maxSize);
    } else if (
      path.endsWith(".tsx") ||
      path.endsWith(".jsx") ||
      path.endsWith(".ts") ||
      path.endsWith(".js")
    ) {
      return this.truncateCode(content, maxSize);
    } else {
      // Generic truncation
      const truncated = content.substring(0, maxSize - 200);
      return `${truncated}\n\n/* File truncated - ${content.length - truncated.length} characters omitted */`;
    }
  }

  /**
   * Truncate JSON while trying to keep structure
   */
  private truncateJSON(content: string, maxSize: number): string {
    try {
      const parsed = JSON.parse(content);
      const truncated = JSON.stringify(parsed, null, 2).substring(
        0,
        maxSize - 100,
      );
      return `${truncated}\n/* JSON truncated */`;
    } catch {
      return (
        content.substring(0, maxSize - 100) + "\n/* Invalid JSON truncated */"
      );
    }
  }

  /**
   * Truncate code while preserving imports and key functions
   */
  private truncateCode(content: string, maxSize: number): string {
    const lines = content.split("\n");
    const importLines = lines.filter((line) =>
      line.trim().startsWith("import"),
    );
    const exportLines = lines.filter((line) =>
      line.trim().startsWith("export"),
    );

    // Calculate space for content after imports/exports
    const headerFooterSize = [...importLines, ...exportLines].join("\n").length;
    const availableSize = maxSize - headerFooterSize - 200;

    if (availableSize > 0) {
      const otherLines = lines.filter(
        (line) =>
          !line.trim().startsWith("import") &&
          !line.trim().startsWith("export"),
      );

      const truncatedContent = otherLines
        .join("\n")
        .substring(0, availableSize);

      return [
        ...importLines,
        "",
        truncatedContent,
        "",
        "/* Code truncated */",
        "",
        ...exportLines.slice(0, 3), // Keep some key exports
      ].join("\n");
    }

    return content.substring(0, maxSize - 100) + "\n/* Code truncated */";
  }

  /**
   * Chunk response if too large
   */
  chunkResponse(content: string): string[] {
    if (content.length <= this.limits.maxResponseLength) {
      return [content];
    }

    const chunks: string[] = [];
    let currentChunk = "";
    const lines = content.split("\n");

    for (const line of lines) {
      if (
        currentChunk.length + line.length + 1 >
        this.limits.maxResponseLength
      ) {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
          currentChunk = line;
        } else {
          // Single line too long, force split
          chunks.push(
            line.substring(0, this.limits.maxResponseLength - 50) + "...",
          );
          currentChunk = line.substring(this.limits.maxResponseLength - 50);
        }
      } else {
        currentChunk += (currentChunk ? "\n" : "") + line;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Get context summary for debugging
   */
  getContextSummary(
    messages: UIMessage[],
    fragmentFiles: Record<string, string>,
  ): object {
    const totalMessageChars = messages.reduce(
      (sum, msg) => sum + this.getMessageContent(msg).length,
      0,
    );
    const totalFragmentChars = Object.values(fragmentFiles).reduce(
      (sum, content) => sum + content.length,
      0,
    );

    return {
      messageCount: messages.length,
      totalMessageChars,
      fragmentFileCount: Object.keys(fragmentFiles).length,
      totalFragmentChars,
      limits: this.limits,
      withinLimits: {
        messages: messages.length <= this.limits.maxContextMessages,
        messageSize:
          totalMessageChars <= this.limits.maxMessageLength * messages.length,
        fragmentSize: totalFragmentChars <= this.limits.maxTotalFragmentSize,
      },
    };
  }
}
