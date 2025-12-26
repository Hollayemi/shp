import { Request, Response, NextFunction } from "express";
import { logger } from "../config/logger.js";

/**
 * Express middleware for logging HTTP requests (development only)
 */
export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const isDevelopment = process.env.NODE_ENV !== "production";

  // Skip request logging in production
  if (!isDevelopment) {
    next();
    return;
  }

  const startTime = Date.now();

  // Log request
  logger.info({
    type: "request",
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get("user-agent"),
  });

  // Log response when finished
  res.on("finish", () => {
    const duration = Date.now() - startTime;
    const logLevel = res.statusCode >= 400 ? "error" : "info";

    logger[logLevel]({
      type: "response",
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    });
  });

  next();
};
