import type { Request, Response, NextFunction } from "express";
import { captureError } from "./sentry";

export function centralErrorHandler(err: any, req: Request, res: Response, _next: NextFunction): void {
  const status = err.status || err.statusCode || 500;

  captureError(err instanceof Error ? err : new Error(String(err)), {
    method: req.method,
    url: req.originalUrl,
    statusCode: status,
  });

  if (status >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl} ${status}: ${err.message || err}`);
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
