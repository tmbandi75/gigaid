import * as Sentry from "@sentry/node";
import * as fs from "fs";
import * as path from "path";
import { logger } from "./lib/logger";

const isProduction = process.env.NODE_ENV === "production";
let sentryInitialized = false;

function detectRelease(): string | undefined {
  try {
    const pkgPath = path.resolve(process.cwd(), "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    return pkg.version ? `gigaid@${pkg.version}` : undefined;
  } catch {
    return undefined;
  }
}

function scrubSensitiveData(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9\-_\.]+/gi, "Bearer [REDACTED]")
    .replace(/sk_(?:live|test)_[A-Za-z0-9]+/g, "[STRIPE_KEY_REDACTED]")
    .replace(/whsec_[A-Za-z0-9]+/g, "[STRIPE_WEBHOOK_SECRET_REDACTED]")
    .replace(/eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]*/g, "[JWT_REDACTED]");
}

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    if (isProduction) {
      logger.warn("[sentry] WARNING: SENTRY_DSN not set in production. Error tracking disabled.");
    } else {
      logger.info("[sentry] SENTRY_DSN not set. Skipping Sentry initialization (development).");
    }
    return;
  }

  Sentry.init({
    dsn,
    environment: isProduction ? "production" : "development",
    release: detectRelease(),
    tracesSampleRate: isProduction ? 0.2 : 1.0,
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers["authorization"];
        delete event.request.headers["cookie"];
        for (const key of Object.keys(event.request.headers)) {
          const val = event.request.headers[key];
          if (typeof val === "string") {
            event.request.headers[key] = scrubSensitiveData(val);
          }
        }
      }

      if (event.request?.query_string && typeof event.request.query_string === "string") {
        event.request.query_string = scrubSensitiveData(event.request.query_string);
      }

      if (event.request?.data && typeof event.request.data === "string") {
        event.request.data = scrubSensitiveData(event.request.data);
      }

      return event;
    },
  });

  sentryInitialized = true;
  logger.info(`[sentry] Initialized (environment: ${isProduction ? "production" : "development"})`);
}

export function captureError(err: Error, context?: Record<string, any>): void {
  if (!sentryInitialized) return;

  if (context) {
    Sentry.withScope((scope) => {
      scope.setExtras(context);
      Sentry.captureException(err);
    });
  } else {
    Sentry.captureException(err);
  }
}

export function setupProcessHandlers(): void {
  process.on("unhandledRejection", (reason) => {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    logger.error("[process] Unhandled rejection:", err.message);
    captureError(err, { type: "unhandledRejection" });
  });

  process.on("uncaughtException", (err) => {
    logger.error("[process] Uncaught exception:", err.message);
    captureError(err, { type: "uncaughtException" });
    if (sentryInitialized) {
      Sentry.flush(2000).finally(() => {
        process.exit(1);
      });
    } else {
      process.exit(1);
    }
  });

  logger.info("[sentry] Process-level error handlers registered.");
}
