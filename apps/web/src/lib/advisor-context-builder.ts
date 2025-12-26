/**
 * Advisor Context Builder
 * Creates flowing, integrated context for HAL Advisor
 */

import type { AdvisorHatType } from "@/lib/advisor-hats";

export interface AdvisorContextOptions {
  projectName: string;
  hatType: AdvisorHatType;
  conversationLength: number;
  mem0Memories?: string;
  projectFiles?: Record<string, string>;
  recentActivity?: string;
  builderActivity?: string; // Recent Builder chat activity
}

export class AdvisorContextBuilder {
  // Cache for project insights (keyed by file count + hat type)
  private static insightsCache = new Map<string, string>();
  private static readonly MAX_CONTEXT_SIZE = 8000; // Max chars for context

  /**
   * Build a unified, flowing context narrative
   * Instead of isolated sections, weave everything together
   * OPTIMIZED: Uses array join and caching
   */
  static buildUnifiedContext(options: AdvisorContextOptions): string {
    const {
      projectName,
      hatType,
      conversationLength,
      mem0Memories,
      projectFiles,
      recentActivity,
      builderActivity,
    } = options;

    // Use array for efficient string building
    const parts: string[] = [];

    // Start with the core narrative
    parts.push(`You're working with the user on **${projectName}**.`);

    // Add conversation continuity naturally
    if (conversationLength === 0) {
      parts.push(` This is your first conversation about this project.`);
    } else if (conversationLength < 5) {
      parts.push(
        ` You've had ${conversationLength} ${conversationLength === 1 ? "exchange" : "exchanges"} so far.`,
      );
    } else {
      parts.push(
        ` You've been working together through ${conversationLength} messages.`,
      );
    }

    // Weave in memories naturally (not as separate section)
    if (mem0Memories && mem0Memories.trim()) {
      const memories = this.extractKeyMemories(mem0Memories);
      if (memories.length > 0) {
        parts.push(
          `\n\nFrom your previous conversations, you know:\n${memories.map((m) => `- ${m}`).join("\n")}`,
        );
      }
    }

    // Add project insights naturally (cached for performance)
    if (projectFiles && Object.keys(projectFiles).length > 0) {
      const insights = this.extractProjectInsights(projectFiles, hatType);
      if (insights) {
        parts.push(`\n\n${insights}`);
      }
    }

    // Add Builder activity (what they've been building)
    if (builderActivity && builderActivity.trim()) {
      parts.push(`\n\n${builderActivity}`);
    }

    // Add recent activity if relevant
    if (recentActivity && recentActivity.trim()) {
      parts.push(`\n\n${recentActivity}`);
    }

    // Close with natural transition to conversation
    parts.push(
      `\n\nThe user's message below continues this conversation. Respond naturally based on everything above.`,
    );

    // Join all parts efficiently
    let context = parts.join("");

    // Truncate if too large
    if (context.length > this.MAX_CONTEXT_SIZE) {
      context = context.substring(0, this.MAX_CONTEXT_SIZE);
      context += "\n\n[Context truncated for length]";
    }

    return context;
  }

  /**
   * Extract key memories and format them naturally
   */
  private static extractKeyMemories(mem0Context: string): string[] {
    const memories: string[] = [];

    // Parse mem0 context (it's usually formatted with bullets or sections)
    const lines = mem0Context.split("\n").filter((line) => line.trim());

    for (const line of lines) {
      // Skip section headers
      if (
        line.startsWith("#") ||
        line.startsWith("##") ||
        line.toLowerCase().includes("memory") ||
        line.toLowerCase().includes("context")
      ) {
        continue;
      }

      // Extract bullet points or meaningful lines
      const cleaned = line
        .replace(/^[-*•]\s*/, "") // Remove bullet markers
        .replace(/^\d+\.\s*/, "") // Remove numbered lists
        .trim();

      if (cleaned.length > 20 && cleaned.length < 200) {
        // Reasonable memory length
        memories.push(cleaned);
      }
    }

    // Limit to most relevant 5 memories
    return memories.slice(0, 5);
  }

  /**
   * Extract project insights based on hat type
   * OPTIMIZED: Uses caching to avoid reanalyzing files
   */
  private static extractProjectInsights(
    projectFiles: Record<string, string>,
    hatType: AdvisorHatType,
  ): string {
    const fileCount = Object.keys(projectFiles).length;

    if (fileCount === 0) {
      return "";
    }

    // Create cache key from file count and hat type
    const cacheKey = `${fileCount}-${hatType}`;

    // Check cache first
    if (this.insightsCache.has(cacheKey)) {
      return this.insightsCache.get(cacheKey)!;
    }

    // Analyze based on hat type
    let insights: string;
    switch (hatType) {
      case "code":
      case "security":
      case "performance":
        insights = this.getTechnicalInsights(projectFiles);
        break;

      case "design":
        insights = this.getDesignInsights(projectFiles);
        break;

      case "product":
      case "generalist":
      case "analytics":
        insights = this.getProductInsights(projectFiles);
        break;

      case "marketing":
      case "sales":
        insights = this.getMarketInsights(projectFiles);
        break;

      default:
        insights = this.getGeneralInsights(projectFiles);
    }

    // Cache the result
    this.insightsCache.set(cacheKey, insights);

    // Limit cache size to prevent memory leaks
    if (this.insightsCache.size > 50) {
      const firstKey = this.insightsCache.keys().next().value;
      if (firstKey !== undefined) {
        this.insightsCache.delete(firstKey);
      }
    }

    return insights;
  }

  private static getTechnicalInsights(files: Record<string, string>): string {
    const fileKeys = Object.keys(files);
    const hasPackageJson = "package.json" in files;
    const hasTsConfig = "tsconfig.json" in files;

    // Count components efficiently (single loop)
    let componentCount = 0;
    for (const f of fileKeys) {
      if (f.includes("component") || f.endsWith(".tsx") || f.endsWith(".jsx")) {
        componentCount++;
      }
    }

    if (!hasPackageJson) {
      return "The project structure is still being set up.";
    }

    const parts = [
      `The project has ${componentCount} component${componentCount !== 1 ? "s" : ""}`,
    ];

    if (hasTsConfig) {
      parts.push(" and uses TypeScript");
    }

    return parts.join("") + ".";
  }

  private static getDesignInsights(files: Record<string, string>): string {
    const fileKeys = Object.keys(files);

    // Check for CSS files first (faster than scanning content)
    const hasCSS = fileKeys.some((f) => f.endsWith(".css"));

    // Only scan content if we have CSS files
    if (hasCSS) {
      // Check package.json or config files for tailwind (faster than scanning all files)
      const packageJson = files["package.json"];
      if (packageJson && packageJson.includes("tailwind")) {
        return "The project uses Tailwind CSS for styling.";
      }

      return "The project uses custom CSS for styling.";
    }

    return "The project's design system is being developed.";
  }

  private static getProductInsights(files: Record<string, string>): string {
    const hasReadme = "README.md" in files;
    const pageCount = Object.keys(files).filter(
      (f) => f.includes("page") || f.includes("route") || f.includes("app/"),
    ).length;

    if (hasReadme) {
      const readme = files["README.md"];
      const firstLine = readme
        .split("\n")
        .find((line) => line.trim().length > 0);
      if (firstLine && firstLine.length < 100) {
        return `The project is: ${firstLine.replace(/^#\s*/, "")}`;
      }
    }

    if (pageCount > 0) {
      return `The project has ${pageCount} page${pageCount !== 1 ? "s" : ""} or route${pageCount !== 1 ? "s" : ""}.`;
    }

    return "The project is in early development.";
  }

  private static getMarketInsights(files: Record<string, string>): string {
    // Look for landing page, pricing, or marketing-related files
    const hasLanding = Object.keys(files).some(
      (f) => f.includes("landing") || f.includes("home") || f.includes("index"),
    );
    const hasPricing = Object.keys(files).some((f) => f.includes("pricing"));

    if (hasPricing) {
      return "The project has a pricing page, indicating it's a commercial product.";
    } else if (hasLanding) {
      return "The project has a landing page for user acquisition.";
    }

    return "The project is building its market presence.";
  }

  private static getGeneralInsights(files: Record<string, string>): string {
    const fileCount = Object.keys(files).length;
    return `The project currently has ${fileCount} file${fileCount !== 1 ? "s" : ""}.`;
  }

  /**
   * Extract Builder activity from recent messages
   */
  static extractBuilderActivity(
    builderMessages: Array<{ role: string; content: string; createdAt: Date }>,
  ): string {
    if (builderMessages.length === 0) {
      return "";
    }

    // Parse recent messages to see the full conversation (user requests + builder responses)
    const conversationPairs: Array<{ user: string; assistant: string }> = [];

    // Reverse to process chronologically
    const chronological = [...builderMessages].reverse();

    for (let i = 0; i < chronological.length; i++) {
      const msg = chronological[i];

      if (msg.role === "USER") {
        try {
          const content = JSON.parse(msg.content);
          const userText = content
            .filter((p: any) => p.type === "text")
            .map((p: any) => p.text)
            .join(" ")
            .substring(0, 150)
            .trim();

          if (userText.length > 0) {
            // Look for the next assistant message
            let assistantText = "";
            for (let j = i + 1; j < chronological.length; j++) {
              if (chronological[j].role === "ASSISTANT") {
                try {
                  const assistantContent = JSON.parse(chronological[j].content);
                  assistantText = assistantContent
                    .filter((p: any) => p.type === "text")
                    .map((p: any) => p.text)
                    .join(" ")
                    .substring(0, 200)
                    .trim();
                  break;
                } catch {
                  continue;
                }
              }
            }

            conversationPairs.push({
              user: userText,
              assistant: assistantText || "(Builder is working on this...)",
            });
          }
        } catch {
          continue;
        }
      }
    }

    if (conversationPairs.length === 0) {
      return "";
    }

    // Take last 3 conversation pairs (most recent)
    const recentPairs = conversationPairs.slice(-3);

    return `Recent Builder Activity:\n${recentPairs
      .map(
        (pair, i) =>
          `${i + 1}. User: "${pair.user}..."\n   Builder: "${pair.assistant}..."`,
      )
      .join("\n\n")}`;
  }

  /**
   * Build progressive context that evolves with conversation
   */
  static buildProgressiveContext(baseContext: string): string {
    const progressive = baseContext;

    return progressive;
  }
}
