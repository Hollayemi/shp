/**
 * HAL Chat Context Manager
 * Specialized context management for advisor conversations
 * Focuses on maintaining conversation flow and recent context
 */

import { UIMessage } from "ai";

export interface HalContextLimits {
  maxMessageLength: number;
  maxContextMessages: number;
}

export const DEFAULT_HAL_CONTEXT_LIMITS: HalContextLimits = {
  maxMessageLength: 10000, // Max chars per message (advisor messages can be longer)
  maxContextMessages: 20, // Keep more messages for advisor conversations (need more context)
};

/**
 * Prune HAL chat conversation to keep recent, relevant messages
 * Tailored for advisor conversations where context continuity matters
 */
export function pruneHalConversation(
  messages: UIMessage[],
  limits: HalContextLimits = DEFAULT_HAL_CONTEXT_LIMITS,
): UIMessage[] {
  if (messages.length <= limits.maxContextMessages) {
    return messages;
  }

  // For advisor chat, keep the most recent messages
  // We prioritize recent conversation flow over old history
  const recentMessages = messages.slice(-limits.maxContextMessages);

  console.log(
    `[HAL Context] Pruned ${messages.length} messages to ${recentMessages.length}`,
  );

  return recentMessages;
}

/**
 * Truncate a message if it exceeds limits
 * Preserves beginning and end of message for context
 */
export function truncateHalMessage(
  content: string,
  limits: HalContextLimits = DEFAULT_HAL_CONTEXT_LIMITS,
): string {
  if (content.length <= limits.maxMessageLength) {
    return content;
  }

  // Keep first 60% and last 20% of message
  const keepStart = Math.floor(limits.maxMessageLength * 0.6);
  const keepEnd = Math.floor(limits.maxMessageLength * 0.2);

  const start = content.substring(0, keepStart);
  const end = content.substring(content.length - keepEnd);
  const omitted = content.length - keepStart - keepEnd;

  return `${start}\n\n[... ${omitted} characters omitted ...]\n\n${end}`;
}

/**
 * Extract text content from UIMessage safely
 */
export function getHalMessageContent(message: UIMessage): string {
  const parts = (message as any).parts;
  if (Array.isArray(parts)) {
    return parts
      .filter((item: any) => item.type === "text")
      .map((item: any) => item.text)
      .join(" ");
  }

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
