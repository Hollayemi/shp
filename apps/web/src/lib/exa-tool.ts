import { tool } from "ai";
import { z } from "zod";
import Exa from "exa-js";

/**
 * Exa Web Search Tool for HAL Chat
 *
 * Provides real-time web search capabilities using Exa.ai's semantic search engine.
 * This tool enables the Advisor to research technical information, market data, competitor analysis,
 * and more to provide better assistance to users as a cofounder.
 */

// Initialize Exa client
const getExaClient = () => {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) {
    throw new Error("EXA_API_KEY environment variable is not set");
  }
  return new Exa(apiKey);
};

export const exaWebSearchTool = tool({
  description: `Look up current, real-world information on the web. Use this for both technical AND business questions:
    
    TECHNICAL:
    - Current API patterns and breaking changes for specific library versions
    - Real solutions to specific errors (from GitHub issues, Stack Overflow, recent discussions)
    - What's actually being used now (not what was trendy in 2023)
    - Implementation examples for the exact stack they're using
    - Whether your technical suggestion is still valid or if things have changed
    
    MARKET/PRODUCT:
    - Competitor features and positioning ("what are other [product type] apps doing?")
    - Pricing research ("what do similar products charge?")
    - Market trends and demand signals
    - User expectations and behavior patterns in their space
    - Marketing messaging and positioning strategies
    
    Don't guess or rely on training data when you can search for the real answer.
    The user expects you to actually research things as a cofounder would.`,

  inputSchema: z.object({
    query: z
      .string()
      .min(1)
      .max(500)
      .describe(
        "A single search query string. MUST be a string, NOT an array. If you need to search multiple topics, make separate tool calls. Can be technical (API patterns, errors) or business/market focused (competitor features, pricing, user research).",
      ),
  }),

  execute: async ({ query }) => {
    try {
      // Normalize query to string (handle both string and array input)
      const searchQuery = Array.isArray(query) ? query[0] : query;

      console.log("[Exa Tool] Executing search for query:", searchQuery);
      const exa = getExaClient();

      // Use searchAndContents to get both links and text content
      const { results } = await exa.searchAndContents(searchQuery, {
        livecrawl: "always", // Always use live crawling for most up-to-date results
        numResults: 3,
        text: {
          maxCharacters: 5000, // Get first 5000 characters of each result
        },
      });

      // Format results for the AI
      const formattedResults = results.map((result, index) => ({
        position: index + 1,
        title: result.title,
        url: result.url,
        content: result.text || "No content available",
        publishedDate: result.publishedDate || "Unknown",
        score: result.score || 0,
      }));

      console.log("[Exa Tool] Search results:", formattedResults);

      return {
        success: true,
        query: searchQuery,
        totalResults: results.length,
        results: formattedResults,
      };
    } catch (error) {
      console.error("[Exa Tool] Search failed:", error);
      const searchQuery = Array.isArray(query) ? query[0] : query;
      return {
        success: false,
        error: error instanceof Error ? error.message : "Search failed",
        query: searchQuery,
        results: [],
      };
    }
  },
});
