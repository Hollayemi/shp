import pino from "pino";

/**
 * Rate-limited log queue for production
 * Buffers logs and writes them at a controlled rate (500 logs/second)
 * Unlike throttling, this queues logs instead of dropping them
 */
class LogQueue {
  private queue: string[] = [];
  private isProcessing = false;
  private readonly RATE_LIMIT_MS = 2; // 2ms between logs = 500 logs/second
  private readonly MAX_QUEUE_SIZE = 10000; // Prevent memory overflow
  private droppedCount = 0;

  write(data: string): void {
    // If queue is full, drop the log and track it
    if (this.queue.length >= this.MAX_QUEUE_SIZE) {
      this.droppedCount++;
      // Emit a warning every 100 dropped logs
      if (this.droppedCount % 100 === 0) {
        process.stdout.write(
          JSON.stringify({
            level: 40, // warn
            time: Date.now(),
            msg: `WARNING: Log queue full, dropped ${this.droppedCount} logs`,
          }) + "\n",
        );
      }
      return;
    }

    this.queue.push(data);

    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const log = this.queue.shift();
      if (log) {
        process.stdout.write(log);

        // If there are more logs in the queue, wait before processing the next one
        if (this.queue.length > 0) {
          await this.sleep(this.RATE_LIMIT_MS);
        }
      }
    }

    this.isProcessing = false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create Pino logger with rate-limited queue in production
 * and pretty printing in development
 */
const createLogger = () => {
  const isDevelopment = process.env.NODE_ENV !== "production";

  const pinoOptions: pino.LoggerOptions = {
    level: process.env.LOG_LEVEL || "info",
    ...(isDevelopment && {
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss Z",
          ignore: "pid,hostname",
          singleLine: false,
        },
      },
    }),
  };

  // In production, use rate-limited queue
  if (!isDevelopment) {
    const logQueue = new LogQueue();
    return pino(pinoOptions, {
      write: (msg: string) => {
        logQueue.write(msg);
      },
    });
  }

  // In development, pino-pretty handles the stream
  return pino(pinoOptions);
};

export const logger = createLogger();

/**
 * Create a child logger with additional context
 */
export const createChildLogger = (context: Record<string, unknown>) => {
  return logger.child(context);
};

/**
 * Create a project-scoped logger
 * Convenience function for creating a logger with projectId context
 *
 * @param projectId - The project ID to include in all log entries
 * @param additionalContext - Optional additional context to include
 * @returns Logger instance with projectId context
 *
 * @example
 * const projectLogger = createProjectLogger("project-123");
 * projectLogger.info("Processing sandbox creation");
 * // Output: {"projectId":"project-123","msg":"Processing sandbox creation"}
 */
export const createProjectLogger = (
  projectId: string,
  additionalContext?: Record<string, unknown>,
) => {
  return logger.child({ projectId, ...additionalContext });
};

export default logger;
