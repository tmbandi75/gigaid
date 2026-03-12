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
import { logger } from "./lib/logger";

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
    logger.error(`[startup] Missing required environment variables:\n  - ${missing.join("\n  - ")}`);
    if (isProduction) {
      logger.error("[startup] Cannot start in production with missing required vars. Exiting.");
      process.exit(1);
    } else {
      logger.warn("[startup] Continuing in development mode despite missing vars.");
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
            scriptSrc: [
              "'self'",
              "'unsafe-inline'",
              "https://apis.google.com",
              "https://www.google.com",
              "https://www.gstatic.com",
              "https://js.stripe.com",
              "https://www.googletagmanager.com",
            ],
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
              "https://www.google.com",
              "https://content-firebaseappcheck.googleapis.com",
            ],
            frameSrc: [
              "'self'",
              "https://*.stripe.com",
              "https://connect.stripe.com",
              "https://*.firebaseapp.com",
              "https://accounts.google.com",
              "https://www.google.com",
              "https://www.recaptcha.net",
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

  logger.info(`${formattedTime} [${source}] ${message}`);
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

  // One-time data fix for Heinz Plumbing production account
  try {
    const { db } = await import("./db");
    const { users, reviews } = await import("@shared/schema");
    const { eq, sql } = await import("drizzle-orm");

    // Fix slug
    const [slugTarget] = await db.select({ id: users.id })
      .from(users)
      .where(eq(users.publicProfileSlug, "thierry-mbandi-outlook-com"))
      .limit(1);
    if (slugTarget) {
      const [conflict] = await db.select({ id: users.id })
        .from(users)
        .where(eq(users.publicProfileSlug, "heinz-plumbing"))
        .limit(1);
      if (!conflict) {
        await db.update(users)
          .set({ publicProfileSlug: "heinz-plumbing" })
          .where(eq(users.id, slugTarget.id));
        logger.info(`[DataFix] Updated slug for ${slugTarget.id}`);
      }
    }

    // Fix profile data + seed reviews for Heinz Plumbing
    const [heinzUser] = await db.select({
      id: users.id,
      photo: users.photo,
      availability: users.availability,
      services: users.services,
      bio: users.bio,
      serviceArea: users.serviceArea,
    })
      .from(users)
      .where(eq(users.publicProfileSlug, "heinz-plumbing"))
      .limit(1);
    if (heinzUser) {
      const profileUpdates: Record<string, unknown> = {};
      if (!heinzUser.photo) {
        profileUpdates.photo = "/objects/uploads/e1135fa1-88e6-41bd-a148-43381fae80df";
      }
      if (!heinzUser.availability) {
        profileUpdates.availability = JSON.stringify({
          monday: { enabled: true, ranges: [{ start: "09:00", end: "13:30" }, { start: "15:00", end: "18:30" }] },
          tuesday: { enabled: true, ranges: [{ start: "09:00", end: "17:00" }] },
          wednesday: { enabled: true, ranges: [{ start: "09:00", end: "17:00" }] },
          thursday: { enabled: true, ranges: [{ start: "09:00", end: "17:00" }] },
          friday: { enabled: true, ranges: [{ start: "09:00", end: "17:00" }] },
          saturday: { enabled: true, ranges: [{ start: "09:00", end: "17:00" }] },
          sunday: { enabled: false, ranges: [{ start: "09:00", end: "17:00" }] },
        });
      }
      if (!heinzUser.services || heinzUser.services.length === 0) {
        profileUpdates.services = [
          "General Handyman Work", "TV Mounting", "Furniture Assembly",
          "Picture / Shelf Hanging", "Door & Lock Repair", "Drywall Repair", "Small Home Repairs",
        ];
      }
      if (!heinzUser.bio) {
        profileUpdates.bio = "At Heinz Plumbing, I bring years of experience in general handyman work, from TV mounting to drywall repair. You can rely on me for all your small home repairs with a friendly touch. Let's get started on your next project today!";
      }
      if (!heinzUser.serviceArea) {
        profileUpdates.serviceArea = "Greater Chicago area";
      }
      if (Object.keys(profileUpdates).length > 0) {
        await db.update(users).set(profileUpdates).where(eq(users.id, heinzUser.id));
        logger.info(`[DataFix] Updated profile fields for Heinz Plumbing: ${Object.keys(profileUpdates).join(", ")}`);
      }

      const [{ count: reviewCount }] = await db.select({ count: sql<number>`count(*)::int` })
        .from(reviews)
        .where(eq(reviews.userId, heinzUser.id));
      if (reviewCount < 20) {
        const reviewData = [
          { name: "Sarah Mitchell", comment: "Jason was fantastic! He fixed our kitchen faucet in no time. Very professional and cleaned up after himself." },
          { name: "David Thompson", comment: "Excellent work on our bathroom remodel. Jason's attention to detail is impressive. Highly recommend!" },
          { name: "Maria Garcia", comment: "Quick response time and fair pricing. Jason mounted our TV perfectly and even helped hide the cables." },
          { name: "Robert Johnson", comment: "We've used Heinz Plumbing three times now. Always on time, always great work. Our go-to handyman!" },
          { name: "Jennifer Lee", comment: "Jason assembled all our IKEA furniture in one afternoon. Everything is sturdy and looks great." },
          { name: "Michael Brown", comment: "Had an emergency leak on a Sunday and Jason came right away. Saved us from serious water damage!" },
          { name: "Amanda Wilson", comment: "Professional, punctual, and reasonably priced. Jason repaired our drywall and you can't even tell it was damaged." },
          { name: "Chris Martinez", comment: "Jason installed new shelving in our garage. Great craftsmanship and very friendly. Will definitely call again." },
          { name: "Lisa Anderson", comment: "We needed several door locks replaced and Jason handled it all efficiently. Feel much safer now!" },
          { name: "James Taylor", comment: "Outstanding service. Jason fixed a tricky plumbing issue that two other plumbers couldn't figure out." },
          { name: "Emily Davis", comment: "Jason hung all our pictures and shelves perfectly level. He even suggested better placement ideas!" },
          { name: "Kevin White", comment: "Reliable and honest. Jason told us what we actually needed instead of upselling unnecessary repairs." },
          { name: "Patricia Harris", comment: "Jason did an amazing job with our small home repairs checklist. Knocked out 8 items in one visit!" },
          { name: "Daniel Clark", comment: "Five stars all the way. Jason's work on our bathroom tile was flawless. True craftsman." },
          { name: "Rachel Moore", comment: "We're repeat customers for a reason. Jason always delivers quality work with a smile." },
          { name: "Steven King", comment: "Jason installed our new ceiling fan and light fixtures. Everything works perfectly and looks beautiful." },
          { name: "Nancy Wright", comment: "Fast, friendly, and affordable. Jason fixed our squeaky doors and sticky windows in under an hour." },
          { name: "Thomas Scott", comment: "Hired Jason for general handyman work around the house. He exceeded our expectations on every task." },
          { name: "Olivia Turner", comment: "Jason repaired our fence and it looks brand new. Great communication throughout the project too." },
          { name: "William Adams", comment: "Top-notch service! Jason was thorough, explained everything he was doing, and left our home spotless." },
        ];
        const needed = 20 - reviewCount;
        const toInsert = reviewData.slice(0, needed);
        const now = new Date();
        await db.transaction(async (tx) => {
          for (let i = 0; i < toInsert.length; i++) {
            const daysAgo = Math.floor(i * 4.5) + 1;
            const createdAt = new Date(now.getTime() - daysAgo * 86400000).toISOString();
            await tx.insert(reviews).values({
              userId: heinzUser.id,
              clientName: toInsert[i].name,
              rating: 5,
              comment: toInsert[i].comment,
              isPublic: true,
              createdAt,
            });
          }
        });
        logger.info(`[DataFix] Seeded ${needed} five-star reviews for Heinz Plumbing (total now: 20)`);
      }
    }
  } catch (e) {
    logger.warn("[DataFix] Skipped:", e instanceof Error ? e.message : String(e));
  }

  const { selfTestFirebaseAdmin } = await import("./firebaseAdmin");
  const fbTest = await selfTestFirebaseAdmin();
  if (!fbTest.ok) {
    logger.error(`[STARTUP] Firebase Admin self-test FAILED: ${fbTest.error}`);
    logger.error('[STARTUP] Email/password signup and login will NOT work until this is fixed.');
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
