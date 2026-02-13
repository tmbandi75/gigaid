import * as Sentry from "@sentry/node";

const isProduction = process.env.NODE_ENV === "production";
let sentryInitialized = false;

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    if (isProduction) {
      console.warn("[sentry] WARNING: SENTRY_DSN not set in production. Error tracking disabled.");
    } else {
      console.log("[sentry] SENTRY_DSN not set. Skipping Sentry initialization (development).");
    }
    return;
  }

  Sentry.init({
    dsn,
    environment: isProduction ? "production" : "development",
    tracesSampleRate: isProduction ? 0.2 : 1.0,
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers["authorization"];
        delete event.request.headers["cookie"];
      }
      return event;
    },
  });

  sentryInitialized = true;
  console.log(`[sentry] Initialized (environment: ${isProduction ? "production" : "development"})`);
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
    console.error("[process] Unhandled rejection:", err.message);
    captureError(err, { type: "unhandledRejection" });
  });

  process.on("uncaughtException", (err) => {
    console.error("[process] Uncaught exception:", err.message);
    captureError(err, { type: "uncaughtException" });
    if (sentryInitialized) {
      Sentry.flush(2000).finally(() => {
        process.exit(1);
      });
    } else {
      process.exit(1);
    }
  });

  console.log("[sentry] Process-level error handlers registered.");
}
