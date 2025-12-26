import type { Logger } from "pino";

declare global {
  namespace Express {
    interface Request {
      logger?: Logger;
      projectId?: string;
    }
  }
}

export {};
