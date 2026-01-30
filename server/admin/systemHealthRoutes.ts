import { Router } from "express";
import { db } from "../db";
import { users, jobs, leads, invoices, eventsCanonical } from "@shared/schema";
import { eq, gte, count, sql } from "drizzle-orm";
import { adminMiddleware } from "../copilot/adminMiddleware";
import { getUncachableStripeClient } from "../stripeClient";

const router = Router();

router.use(adminMiddleware);

// System health status
router.get("/status", async (req, res) => {
  try {
    const now = new Date();
    const checks: Record<string, { status: "healthy" | "degraded" | "down"; message?: string; latencyMs?: number }> = {};

    // Database check
    const dbStart = Date.now();
    try {
      await db.select({ count: count() }).from(users).limit(1);
      checks.database = { status: "healthy", latencyMs: Date.now() - dbStart };
    } catch (error: any) {
      checks.database = { status: "down", message: error.message };
    }

    // Stripe check
    const stripeStart = Date.now();
    try {
      const stripe = await getUncachableStripeClient();
      await stripe.balance.retrieve();
      checks.stripe = { status: "healthy", latencyMs: Date.now() - stripeStart };
    } catch (error: any) {
      if (error.message?.includes("No Stripe")) {
        checks.stripe = { status: "degraded", message: "Stripe not configured" };
      } else {
        checks.stripe = { status: "down", message: error.message };
      }
    }

    // Firebase check (check if env vars exist)
    const firebaseConfigured = !!(
      process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
    );
    checks.firebase = firebaseConfigured 
      ? { status: "healthy" }
      : { status: "degraded", message: "Firebase not fully configured" };

    // Background jobs check (check scheduler markers)
    const schedulerMarkers = {
      copilot: global.copilotSchedulerRunning,
      campaign: global.campaignSchedulerRunning,
      reminder: global.reminderSchedulerRunning,
    };
    const jobsRunning = Object.values(schedulerMarkers).some(Boolean);
    checks.backgroundJobs = jobsRunning 
      ? { status: "healthy", message: `Active: ${Object.entries(schedulerMarkers).filter(([_, v]) => v).map(([k]) => k).join(", ")}` }
      : { status: "degraded", message: "No scheduler markers found (may be running)" };

    // Overall status
    const allHealthy = Object.values(checks).every(c => c.status === "healthy");
    const anyDown = Object.values(checks).some(c => c.status === "down");

    res.json({
      overall: anyDown ? "down" : allHealthy ? "healthy" : "degraded",
      timestamp: now.toISOString(),
      checks,
    });
  } catch (error) {
    console.error("[System Health] Error:", error);
    res.status(500).json({ error: "Failed to check system health" });
  }
});

// Background job status
router.get("/jobs", async (req, res) => {
  try {
    // Get recent events to check job activity
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [hourlyEvents] = await db.select({ count: count() })
      .from(eventsCanonical)
      .where(gte(eventsCanonical.occurredAt, oneHourAgo));

    const [dailyEvents] = await db.select({ count: count() })
      .from(eventsCanonical)
      .where(gte(eventsCanonical.occurredAt, oneDayAgo));

    const schedulers = [
      { name: "CoPilot Scheduler", interval: "hourly", marker: "copilotSchedulerRunning" },
      { name: "Campaign Suggestions", interval: "6 hours", marker: "campaignSchedulerRunning" },
      { name: "Post-Job Momentum", interval: "1 minute", marker: "postJobMomentumRunning" },
      { name: "Auto-Reminder", interval: "5 minutes", marker: "reminderSchedulerRunning" },
      { name: "Deposit Auto-Release", interval: "5 minutes", marker: "autoReleaseRunning" },
      { name: "Weekly Summary", interval: "weekly (Mon 8am)", marker: "weeklySummaryRunning" },
      { name: "No Silent Completion", interval: "hourly", marker: "noSilentCompletionRunning" },
      { name: "Next Best Action", interval: "15 minutes", marker: "nextBestActionRunning" },
      { name: "Intent Detection", interval: "5 minutes", marker: "intentDetectionRunning" },
      { name: "Intent Follow-Up", interval: "5 minutes", marker: "intentFollowUpRunning" },
    ];

    res.json({
      schedulers: schedulers.map(s => ({
        name: s.name,
        interval: s.interval,
        isRunning: (global as any)[s.marker] || false,
      })),
      eventActivity: {
        lastHour: hourlyEvents?.count || 0,
        lastDay: dailyEvents?.count || 0,
      },
    });
  } catch (error) {
    console.error("[System Health] Jobs error:", error);
    res.status(500).json({ error: "Failed to get job status" });
  }
});

// API error rate (from recent events)
router.get("/errors", async (req, res) => {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Count error events
    const [hourlyErrors] = await db.select({ count: count() })
      .from(eventsCanonical)
      .where(sql`${eventsCanonical.occurredAt} >= ${oneHourAgo} AND ${eventsCanonical.eventName} LIKE '%error%'`);

    const [dailyErrors] = await db.select({ count: count() })
      .from(eventsCanonical)
      .where(sql`${eventsCanonical.occurredAt} >= ${oneDayAgo} AND ${eventsCanonical.eventName} LIKE '%error%'`);

    const [totalHourly] = await db.select({ count: count() })
      .from(eventsCanonical)
      .where(gte(eventsCanonical.occurredAt, oneHourAgo));

    const [totalDaily] = await db.select({ count: count() })
      .from(eventsCanonical)
      .where(gte(eventsCanonical.occurredAt, oneDayAgo));

    res.json({
      hourly: {
        errors: hourlyErrors?.count || 0,
        total: totalHourly?.count || 0,
        rate: totalHourly?.count ? ((hourlyErrors?.count || 0) / totalHourly.count * 100).toFixed(2) + "%" : "0%",
      },
      daily: {
        errors: dailyErrors?.count || 0,
        total: totalDaily?.count || 0,
        rate: totalDaily?.count ? ((dailyErrors?.count || 0) / totalDaily.count * 100).toFixed(2) + "%" : "0%",
      },
    });
  } catch (error) {
    console.error("[System Health] Errors check failed:", error);
    res.status(500).json({ error: "Failed to get error rates" });
  }
});

export default router;

// Declare global markers (set by schedulers)
declare global {
  var copilotSchedulerRunning: boolean | undefined;
  var campaignSchedulerRunning: boolean | undefined;
  var postJobMomentumRunning: boolean | undefined;
  var reminderSchedulerRunning: boolean | undefined;
  var autoReleaseRunning: boolean | undefined;
  var weeklySummaryRunning: boolean | undefined;
  var noSilentCompletionRunning: boolean | undefined;
  var nextBestActionRunning: boolean | undefined;
  var intentDetectionRunning: boolean | undefined;
  var intentFollowUpRunning: boolean | undefined;
}
