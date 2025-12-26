/**
 * Server-Sent Events (SSE) Streaming Utilities
 *
 * Provides utilities for streaming AI responses to the client using Server-Sent Events.
 * Compatible with Vercel AI SDK's streaming protocol.
 */

import { Response } from "express";

export interface StreamMetadata {
  requestId: string;
  userId: string;
  projectId: string;
  startTime: number;
}

/**
 * Initialize SSE response headers
 */
export function initializeSSE(res: Response, metadata: StreamMetadata): void {
  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering

  // Additional metadata headers
  res.setHeader("X-Request-Id", metadata.requestId);
  res.setHeader("X-Stream-Start", metadata.startTime.toString());

  // Flush headers immediately
  res.flushHeaders();

  console.log(
    `[SSE] Initialized stream for user ${metadata.userId}, project ${metadata.projectId}, request ${metadata.requestId}`
  );
}

/**
 * Send an SSE event
 */
export function sendSSEEvent(
  res: Response,
  event: string,
  data: any,
  id?: string
): void {
  try {
    // Format: event: <event>\ndata: <data>\nid: <id>\n\n
    if (id) {
      res.write(`id: ${id}\n`);
    }
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  } catch (error) {
    console.error("[SSE] Failed to send event:", error);
  }
}

/**
 * Send a comment (for keeping connection alive)
 */
export function sendSSEComment(res: Response, comment: string): void {
  res.write(`: ${comment}\n\n`);
}

/**
 * Send a text delta event (for streaming text generation)
 */
export function sendTextDelta(res: Response, delta: string, id?: string): void {
  sendSSEEvent(res, "text-delta", { textDelta: delta }, id);
}

/**
 * Send a tool call event
 */
export function sendToolCall(
  res: Response,
  toolCall: {
    toolCallId: string;
    toolName: string;
    args: any;
  },
  id?: string
): void {
  sendSSEEvent(res, "tool-call", toolCall, id);
}

/**
 * Send a tool result event
 */
export function sendToolResult(
  res: Response,
  toolResult: {
    toolCallId: string;
    toolName: string;
    result: any;
  },
  id?: string
): void {
  sendSSEEvent(res, "tool-result", toolResult, id);
}

/**
 * Send an error event
 */
export function sendError(
  res: Response,
  error: {
    message: string;
    code?: string;
    details?: any;
  },
  id?: string
): void {
  sendSSEEvent(res, "error", error, id);
}

/**
 * Send a finish event
 */
export function sendFinish(
  res: Response,
  data: {
    finishReason: string;
    usage?: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    };
  },
  id?: string
): void {
  sendSSEEvent(res, "finish", data, id);
}

/**
 * End the SSE stream
 */
export function endSSE(res: Response): void {
  try {
    res.write("event: done\ndata: {}\n\n");
    res.end();
    console.log("[SSE] Stream ended");
  } catch (error) {
    console.error("[SSE] Error ending stream:", error);
  }
}

/**
 * Keep-alive function to prevent connection timeout
 * Returns a function to stop the keep-alive
 */
export function setupKeepAlive(
  res: Response,
  intervalMs: number = 30000
): () => void {
  const intervalId = setInterval(() => {
    sendSSEComment(res, `keep-alive ${Date.now()}`);
  }, intervalMs);

  return () => {
    clearInterval(intervalId);
  };
}

/**
 * Handle stream abortion
 */
export function handleStreamAbort(
  res: Response,
  cleanup: () => void | Promise<void>
): void {
  res.on("close", async () => {
    console.log("[SSE] Client closed connection");
    try {
      await cleanup();
    } catch (error) {
      console.error("[SSE] Error during cleanup:", error);
    }
  });
}

/**
 * Wrapper class for managing SSE streams
 */
export class SSEStream {
  private res: Response;
  private metadata: StreamMetadata;
  private keepAliveHandle?: () => void;
  private closed: boolean = false;

  constructor(res: Response, metadata: StreamMetadata) {
    this.res = res;
    this.metadata = metadata;
    initializeSSE(res, metadata);
  }

  /**
   * Start keep-alive pings
   */
  startKeepAlive(intervalMs: number = 30000): void {
    this.keepAliveHandle = setupKeepAlive(this.res, intervalMs);
  }

  /**
   * Send text delta
   */
  sendText(delta: string, id?: string): void {
    if (!this.closed) {
      sendTextDelta(this.res, delta, id);
    }
  }

  /**
   * Send tool call
   */
  sendToolCall(toolCall: {
    toolCallId: string;
    toolName: string;
    args: any;
  }, id?: string): void {
    if (!this.closed) {
      sendToolCall(this.res, toolCall, id);
    }
  }

  /**
   * Send tool result
   */
  sendToolResult(toolResult: {
    toolCallId: string;
    toolName: string;
    result: any;
  }, id?: string): void {
    if (!this.closed) {
      sendToolResult(this.res, toolResult, id);
    }
  }

  /**
   * Send error
   */
  sendError(error: {
    message: string;
    code?: string;
    details?: any;
  }, id?: string): void {
    if (!this.closed) {
      sendError(this.res, error, id);
    }
  }

  /**
   * Send finish event
   */
  sendFinish(data: {
    finishReason: string;
    usage?: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    };
  }, id?: string): void {
    if (!this.closed) {
      sendFinish(this.res, data, id);
    }
  }

  /**
   * Send custom event
   */
  sendEvent(event: string, data: any, id?: string): void {
    if (!this.closed) {
      sendSSEEvent(this.res, event, data, id);
    }
  }

  /**
   * End the stream
   */
  end(): void {
    if (!this.closed) {
      this.closed = true;
      if (this.keepAliveHandle) {
        this.keepAliveHandle();
      }
      endSSE(this.res);
    }
  }

  /**
   * Check if stream is closed
   */
  isClosed(): boolean {
    return this.closed;
  }

  /**
   * Set up cleanup handler for client disconnection
   */
  onAbort(cleanup: () => void | Promise<void>): void {
    handleStreamAbort(this.res, cleanup);
  }
}
