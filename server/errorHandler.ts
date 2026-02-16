import type { Request, Response, NextFunction } from "express";
import * as Sentry from "@sentry/node";
import { logger } from "./lib/logger";

export function centralErrorHandler(err: any, req: Request, res: Response, _next: NextFunction): void {
  const status = err.status || err.statusCode || 500;

  Sentry.captureException(err);

  if (status >= 500) {
    logger.error(`[error] ${req.method} ${req.originalUrl} ${status}: ${err.message || err}`);
  }

  if (res.headersSent) {
    return;
  }

  if (status >= 500) {
    res.status(status).json({ error: "Internal server error" });
  } else {
    res.status(status).json({ error: err.message || "Request failed" });
  }
}
