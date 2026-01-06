/**
 * Chat Stream Abort Registry
 *
 * Manages abort controllers for active chat streams with automatic cleanup
 * and memory leak prevention. Stores controllers in globalThis to survive
 * module reloads during development.
 */

import { prisma } from "@shipper/database";
import { redisFileStreamPublisher } from "./redis-file-events.js";
import { logger } from "../config/logger.js";
import type { ToolsContext } from "./ai-tools.js";

// Global abort registry for active chat streams, keyed by streamId
// Stored on globalThis to survive module reloads in dev
export interface ChatAbortRegistry {
  controllers: Map<string, AbortController>;
  timestamps: Map<string, number>;
}

declare global {
  // eslint-disable-next-line no-var
  var __chat_abort_registry__: ChatAbortRegistry | undefined;
}

// Configuration
const STALE_CONTROLLER_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const MAX_CONTROLLERS_WARNING = 100;

function getChatAbortRegistry(): ChatAbortRegistry {
  if (!globalThis.__chat_abort_registry__) {
    globalThis.__chat_abort_registry__ = {
      controllers: new Map<string, AbortController>(),
      timestamps: new Map<string, number>(),
    };
  }
  return globalThis.__chat_abort_registry__;
}

export function registerChatAbort(
  streamId: string,
  controller: AbortController,
): void {
  const registry = getChatAbortRegistry();
  registry.controllers.set(streamId, controller);
  registry.timestamps.set(streamId, Date.now());

  // Warn if registry is growing too large
  if (registry.controllers.size > MAX_CONTROLLERS_WARNING) {
    logger?.warn({
      msg: "Chat abort registry has grown large",
      size: registry.controllers.size,
      hint: "Check for memory leaks or stuck streams",
    });
  }
}

export function abortChat(streamId: string): boolean {
  const registry = getChatAbortRegistry();
  const ctrl = registry.controllers.get(streamId);

  if (!ctrl) return false;

  // Remove from registry first to prevent duplicate abort attempts
  registry.controllers.delete(streamId);
  registry.timestamps.delete(streamId);

  try {
    ctrl.abort();
    return true;
  } catch (error) {
    // AbortController.abort() rarely throws, but handle it just in case
    logger?.warn({
      msg: "Failed to abort chat stream",
      streamId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

export function clearChatAbort(streamId: string): void {
  const registry = getChatAbortRegistry();
  registry.controllers.delete(streamId);
  registry.timestamps.delete(streamId);
}

export function abortAllChats(): number {
  const registry = getChatAbortRegistry();
  const count = registry.controllers.size;

  registry.controllers.forEach((ctrl, streamId) => {
    try {
      ctrl.abort();
    } catch (error) {
      logger?.warn({
        msg: "Failed to abort chat during cleanup",
        streamId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  registry.controllers.clear();
  registry.timestamps.clear();

  if (count > 0) {
    logger?.info({
      msg: "Aborted all chat streams",
      count,
    });
  }

  return count;
}

export function cleanupStaleControllers(): number {
  const registry = getChatAbortRegistry();
  const now = Date.now();
  const staleIds: string[] = [];

  registry.timestamps.forEach((timestamp, streamId) => {
    if (now - timestamp > STALE_CONTROLLER_TIMEOUT) {
      staleIds.push(streamId);
    }
  });

  staleIds.forEach((streamId) => {
    const ctrl = registry.controllers.get(streamId);
    if (ctrl) {
      try {
        ctrl.abort();
      } catch (error) {
        // Ignore errors during stale cleanup
      }
    }
    registry.controllers.delete(streamId);
    registry.timestamps.delete(streamId);
  });

  if (staleIds.length > 0) {
    logger?.info({
      msg: "Cleaned up stale abort controllers",
      count: staleIds.length,
      streamIds: staleIds,
    });
  }

  return staleIds.length;
}

export function getRegistryStats(): {
  activeStreams: number;
  oldestStreamAge: number | null;
} {
  const registry = getChatAbortRegistry();
  const now = Date.now();
  let oldestTimestamp: number | null = null;

  registry.timestamps.forEach((timestamp) => {
    if (oldestTimestamp === null || timestamp < oldestTimestamp) {
      oldestTimestamp = timestamp;
    }
  });

  return {
    activeStreams: registry.controllers.size,
    oldestStreamAge: oldestTimestamp ? now - oldestTimestamp : null,
  };
}

// Cleanup helpers to avoid repetition
export async function safeClearActiveStream(projectId: string): Promise<void> {
  try {
    await prisma.project.update({
      where: { id: projectId },
      data: { activeStreamId: null, activeStreamStartedAt: null },
    });
  } catch (error) {
    // ignore DB errors during cleanup
    logger?.warn({
      msg: "Failed to clear active stream",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function safeClearAbort(streamId: string): void {
  try {
    clearChatAbort(streamId);
  } catch (error) {
    // ignore cleanup errors
    logger?.warn({
      msg: "Failed to clear abort signal",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function finalizeOnAbort(
  projectId: string,
  streamId: string,
  toolsContext?: ToolsContext,
): Promise<void> {
  // Save any in-progress work before aborting to prevent data loss
  if (toolsContext?.fragmentFiles && toolsContext.fragmentFiles.size > 0) {
    try {
      logger?.info({
        msg: "Saving in-progress fragment files before abort",
        fileCount: toolsContext.fragmentFiles.size,
        fragmentId: toolsContext.currentFragmentId,
      });

      const { updateWorkingFragment } = await import("./ai-tools.js");
      await updateWorkingFragment(toolsContext, "aborted - saving progress");

      logger?.info({
        msg: "Fragment files saved successfully on abort",
        fragmentId: toolsContext.currentFragmentId,
      });
    } catch (error) {
      logger?.error({
        msg: "Failed to save fragment on abort",
        error: error instanceof Error ? error.message : String(error),
      });
      // Continue with cleanup even if save fails
    }
  }

  await safeClearActiveStream(projectId);
  safeClearAbort(streamId);
}

export async function finalizeOnFinish(
  projectId: string,
  streamId: string,
): Promise<void> {
  await safeClearActiveStream(projectId);
  safeClearAbort(streamId);
  try {
    await redisFileStreamPublisher.emitStreamComplete(projectId);
  } catch (error) {
    // best-effort; log will happen in caller if needed
    logger?.warn({
      msg: "Failed to emit stream complete signal",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// Set up periodic cleanup (call this once at application startup)
export function startPeriodicCleanup(
  intervalMs: number = 5 * 60 * 1000,
): ReturnType<typeof setInterval> {
  logger?.info({
    msg: "Starting periodic chat abort registry cleanup",
    intervalMs,
  });
  return setInterval(() => {
    cleanupStaleControllers();
  }, intervalMs);
}
