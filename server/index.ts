import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { startReminderScheduler } from "./reminderScheduler";
import { startAutoReleaseScheduler } from "./depositAutoRelease";
import { startWeeklySummaryScheduler } from "./weeklyEmailSummary";
import { startNoSilentCompletionScheduler } from "./noSilentCompletionEnforcer";
import { initializeDbEnforcement } from "./dbEnforcement";
import { startNextBestActionEngine } from "./nextBestActionEngine";
import { startIntentDetectionEngine } from "./intentDetectionEngine";
import { startIntentFollowUpScheduler } from "./intentFollowUpScheduler";
import { startAccountDeletionScheduler } from "./accountDeletionScheduler";
import { startChurnScheduler } from "./churn/churnScheduler";
import { initSentry, setupProcessHandlers } from "./sentry";
import { centralErrorHandler } from "./errorHandler";

const isProduction = process.env.NODE_ENV === "production";

function validateRequiredEnv(): void {
  const required: Array<{ key: string; label: string }> = [
    { key: "DATABASE_URL", label: "Database connection" },
    { key: "APP_JWT_SECRET", label: "JWT signing secret" },
  ];

  const productionRequired: Array<{ key: string; label: string }> = [
    { key: "SENTRY_DSN", label: "Sentry error tracking" },
  ];

  const missing: string[] = [];

  for (const { key, label } of required) {
    if (!process.env[key]) {
      missing.push(`${key} (${label})`);
    }
  }

  if (isProduction) {
    for (const { key, label } of productionRequired) {
      if (!process.env[key]) {
        missing.push(`${key} (${label})`);
      }
    }
  }

  if (missing.length > 0) {
    console.error(`[startup] Missing required environment variables:\n  - ${missing.join("\n  - ")}`);
    if (isProduction) {
      console.error("[startup] Cannot start in production with missing required vars. Exiting.");
      process.exit(1);
    } else {
      console.warn("[startup] Continuing in development mode despite missing vars.");
    }
  }
}

validateRequiredEnv();
initSentry();
setupProcessHandlers();

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  helmet({
    contentSecurityPolicy: isProduction
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://apis.google.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            connectSrc: [
              "'self'",
              "https://*.sentry.io",
              "https://*.stripe.com",
              "https://connect.stripe.com",
              "https://api.stripe.com",
              "https://maps.googleapis.com",
              "https://identitytoolkit.googleapis.com",
              "https://securetoken.googleapis.com",
              "https://www.googleapis.com",
              "https://*.firebaseio.com",
              "https://*.firebaseapp.com",
              "https://firebase.googleapis.com",
              "https://apis.google.com",
              "https://accounts.google.com",
            ],
            frameSrc: [
              "'self'",
              "https://*.stripe.com",
              "https://connect.stripe.com",
              "https://*.firebaseapp.com",
              "https://accounts.google.com",
            ],
            formAction: [
              "'self'",
              "https://connect.stripe.com",
              "https://api.stripe.com",
            ],
          },
        }
      : false,
    crossOriginEmbedderPolicy: false,
    frameguard: isProduction ? undefined : false,
  }),
);

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize database enforcement (triggers + data repair) BEFORE routes
  // CRITICAL: This ensures no job can be completed without resolution
  await initializeDbEnforcement();
  
  const { selfTestFirebaseAdmin } = await import("./firebaseAdmin");
  const fbTest = await selfTestFirebaseAdmin();
  if (!fbTest.ok) {
    console.error(`[STARTUP] Firebase Admin self-test FAILED: ${fbTest.error}`);
    console.error('[STARTUP] Email/password signup and login will NOT work until this is fixed.');
  }

  await registerRoutes(httpServer, app);

  app.use(centralErrorHandler);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
      startReminderScheduler();
      startAutoReleaseScheduler();
      const baseUrl = process.env.FRONTEND_URL || `http://localhost:${port}`;
      startWeeklySummaryScheduler(baseUrl);
      startNoSilentCompletionScheduler();
      startNextBestActionEngine(15); // Run every 15 minutes
      startIntentDetectionEngine(5); // Run every 5 minutes for intent processing
      startIntentFollowUpScheduler(); // Check for unpaid invoices and send follow-ups
      startAccountDeletionScheduler(); // Daily check for accounts to delete
      startChurnScheduler(); // Nightly churn scoring + retention actions
    },
  );
})();
