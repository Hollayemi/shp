// src/lib/mem0-memory.ts
import { MemoryClient } from "mem0ai";
import type { Message } from "mem0ai";

// Initialize mem0 client with configuration
// Supports optional organizationId and projectId for multi-tenant setups
const mem0 = new MemoryClient({
  apiKey: process.env.MEM0_API_KEY || "",
  // host: 'https://api.mem0.ai', // Optional: custom host
  // organizationId: 'org-id',    // Optional: for organization-level scoping
  // projectId: 'project-id'      // Optional: for project-level scoping
});

/**
 * Mem0-based memory manager for AI conversations
 * Provides conversational memory that learns and remembers context
 */
export class Mem0MemoryManager {
  /**
   * Add a memory/conversation to mem0
   *
   * @example
   * ```typescript
   * await Mem0MemoryManager.addMemory({
   *   userId: "user123",
   *   projectId: "proj456",
   *   messages: [
   *     { role: "user", content: "I love pizza" },
   *     { role: "assistant", content: "Great! I'll remember that." }
   *   ],
   *   metadata: { category: "food_preferences" }
   * });
   * ```
   */
  static async addMemory({
    userId,
    projectId,
    messages,
    metadata = {},
  }: {
    userId: string;
    projectId: string;
    messages: Message[];
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      // Add conversation to mem0 with project context
      // Using app_id to scope memories to specific projects
      await mem0.add(messages, {
        user_id: userId,
        app_id: projectId, // Projects are scoped as "apps" in mem0
        metadata: {
          projectId,
          timestamp: new Date().toISOString(),
          ...metadata,
        },
      });

      console.log(
        `[Mem0] Added ${messages.length} messages to memory for user ${userId}, project ${projectId}`,
      );
    } catch (error) {
      console.error("[Mem0] Failed to add memory:", error);
      // Don't throw - memory failure shouldn't break the app
    }
  }

  /**
   * Search and retrieve relevant memories using semantic search
   *
   * @example
   * ```typescript
   * const memories = await Mem0MemoryManager.searchMemories({
   *   userId: "user123",
   *   projectId: "proj456",
   *   query: "What are my food preferences?",
   *   limit: 5
   * });
   * ```
   * @returns Array of memories with relevance scores (0-1)
   */
  static async searchMemories({
    userId,
    projectId,
    query,
    limit = 10,
  }: {
    userId: string;
    projectId: string;
    query: string;
    limit?: number;
  }): Promise<Array<{ memory: string; score: number }>> {
    try {
      const results = await mem0.search(query, {
        user_id: userId,
        app_id: projectId,
        limit,
      });

      console.log(
        `[Mem0] Found ${results.length} relevant memories for query: "${query}..."`,
      );

      // Map results to a consistent format
      return results.map((result: any) => ({
        memory: result.memory || result.text || "",
        score: result.score || 0, // Relevance score between 0 and 1
      }));
    } catch (error) {
      console.error("[Mem0] Failed to search memories:", error);
      return [];
    }
  }

  /**
   * Get all memories for a user/project
   */
  static async getAllMemories({
    userId,
    projectId,
  }: {
    userId: string;
    projectId: string;
  }): Promise<Array<{ id: string; memory: string; metadata: any }>> {
    try {
      const memories = await mem0.getAll({
        user_id: userId,
        app_id: projectId,
      });

      console.log(
        `[Mem0] Retrieved ${memories.length} total memories for user ${userId}, project ${projectId}`,
      );

      return memories.map((m: any) => ({
        id: m.id || "",
        memory: m.memory || m.text || "",
        metadata: m.metadata || {},
      }));
    } catch (error) {
      console.error("[Mem0] Failed to get all memories:", error);
      return [];
    }
  }

  /**
   * Build context for AI by retrieving relevant memories
   */
  static async buildContextForAI({
    userId,
    projectId,
    currentMessage,
    hideMemoryAnnotations = false,
  }: {
    userId: string;
    projectId: string;
    currentMessage: string;
    hideMemoryAnnotations?: boolean;
  }): Promise<string> {
    try {
      // Search for relevant memories based on current message
      const relevantMemories = await this.searchMemories({
        userId,
        projectId,
        query: currentMessage,
        limit: 5,
      });

      if (relevantMemories.length === 0) {
        return "";
      }

      // Build context string from relevant memories
      let contextParts: string[];
      let warningNote = "";

      if (hideMemoryAnnotations) {
        // Clean format without technical annotations
        contextParts = relevantMemories.map((mem) => mem.memory);
        warningNote = `\n\n---\n\nNote: Use this context naturally in your responses. Do not reference "memory numbers" or mention that information came from memory.`;
      } else {
        // Original format with memory numbers and relevance scores
        contextParts = relevantMemories.map(
          (mem, idx) =>
            `[Memory ${idx + 1}] (relevance: ${Math.round(mem.score * 100)}%)\n${mem.memory}`,
        );
      }

      const context = `## Relevant Context from Previous Conversations:\n\n${contextParts.join("\n\n")}\n\n---${warningNote}`;

      console.log(
        `[Mem0] Built context with ${relevantMemories.length} relevant memories`,
      );

      return context;
    } catch (error) {
      console.error("[Mem0] Failed to build AI context:", error);
      return "";
    }
  }

  /**
   * Delete specific memory
   */
  static async deleteMemory(memoryId: string): Promise<void> {
    try {
      await mem0.delete(memoryId);
      console.log(`[Mem0] Deleted memory ${memoryId}`);
    } catch (error) {
      console.error(`[Mem0] Failed to delete memory ${memoryId}:`, error);
    }
  }

  /**
   * Delete all memories for a user/project
   */
  static async deleteAllMemories({
    userId,
    projectId,
  }: {
    userId: string;
    projectId: string;
  }): Promise<void> {
    try {
      await mem0.deleteAll({
        user_id: userId,
        app_id: projectId,
      });

      console.log(
        `[Mem0] Deleted all memories for user ${userId}, project ${projectId}`,
      );
    } catch (error) {
      console.error("[Mem0] Failed to delete all memories:", error);
    }
  }

  /**
   * Update user/project metadata in memory
   */
  static async updateMemory({
    memoryId,
    data,
  }: {
    memoryId: string;
    data: string;
  }): Promise<void> {
    try {
      await mem0.update(memoryId, data);
      console.log(`[Mem0] Updated memory ${memoryId}`);
    } catch (error) {
      console.error(`[Mem0] Failed to update memory ${memoryId}:`, error);
    }
  }

  /**
   * Get memory history/conversation flow for a project
   */
  static async getMemoryHistory({
    userId,
    projectId,
  }: {
    userId: string;
    projectId: string;
  }): Promise<string> {
    try {
      const allMemories = await this.getAllMemories({ userId, projectId });

      if (allMemories.length === 0) {
        return "No previous conversation history for this project.";
      }

      // Format memories chronologically
      const history = allMemories
        .map((mem, idx) => `[${idx + 1}] ${mem.memory}`)
        .join("\n\n");

      return `## Conversation History:\n\n${history}`;
    } catch (error) {
      console.error("[Mem0] Failed to get memory history:", error);
      return "";
    }
  }
}

// Export for backwards compatibility
export const AgentMemoryManager = Mem0MemoryManager;

// Export types for external use
export type { Message };
