import { createRequire } from 'module';const require = createRequire(import.meta.url);
import {
  init_esm_shims
} from "./chunk-IXOW5DJO.js";

// src/config/logger.ts
init_esm_shims();
import pino from "pino";
var LogQueue = class {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.RATE_LIMIT_MS = 2;
    // 2ms between logs = 500 logs/second
    this.MAX_QUEUE_SIZE = 1e4;
    // Prevent memory overflow
    this.droppedCount = 0;
  }
  write(data) {
    if (this.queue.length >= this.MAX_QUEUE_SIZE) {
      this.droppedCount++;
      if (this.droppedCount % 100 === 0) {
        process.stdout.write(
          JSON.stringify({
            level: 40,
            // warn
            time: Date.now(),
            msg: `WARNING: Log queue full, dropped ${this.droppedCount} logs`
          }) + "\n"
        );
      }
      return;
    }
    this.queue.push(data);
    if (!this.isProcessing) {
      this.processQueue();
    }
  }
  async processQueue() {
    this.isProcessing = true;
    while (this.queue.length > 0) {
      const log = this.queue.shift();
      if (log) {
        process.stdout.write(log);
        if (this.queue.length > 0) {
          await this.sleep(this.RATE_LIMIT_MS);
        }
      }
    }
    this.isProcessing = false;
  }
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
};
var createLogger = () => {
  const isDevelopment = process.env.NODE_ENV !== "production";
  const pinoOptions = {
    level: process.env.LOG_LEVEL || "info",
    ...isDevelopment && {
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss Z",
          ignore: "pid,hostname",
          singleLine: false
        }
      }
    }
  };
  if (!isDevelopment) {
    const logQueue = new LogQueue();
    return pino(pinoOptions, {
      write: (msg) => {
        logQueue.write(msg);
      }
    });
  }
  return pino(pinoOptions);
};
var logger = createLogger();
var createProjectLogger = (projectId, additionalContext) => {
  return logger.child({ projectId, ...additionalContext });
};
var logger_default = logger;

export {
  logger,
  createProjectLogger,
  logger_default
};
