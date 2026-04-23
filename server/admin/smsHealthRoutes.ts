import { Router } from "express";
import { db } from "../db";
import { outboundMessages, users } from "@shared/schema";
import { and, desc, eq, gte, isNotNull, sql, count } from "drizzle-orm";
import { adminMiddleware } from "../copilot/adminMiddleware";
import { logger } from "../lib/logger";

const router = Router();

router.use(adminMiddleware);

// Known structured guard reasons. Anything else is bucketed under "other".
const KNOWN_REASONS = [
  "user_opted_out",
  "rate_limited",
  "action_taken",
  "missing_booking_page",
  "user_not_found",
] as const;

router.get("/summary", async (_req, res) => {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Cancellations in the last 7d grouped by failureReason.
    const canceledRows = await db
      .select({
        failureReason: outboundMessages.failureReason,
        c: count(),
      })
      .from(outboundMessages)
      .where(
        and(
          eq(outboundMessages.channel, "sms"),
          eq(outboundMessages.status, "canceled"),
          gte(outboundMessages.updatedAt, sevenDaysAgo),
        ),
      )
      .groupBy(outboundMessages.failureReason);

    const canceledByReason: Record<string, number> = {};
    let canceledTotal = 0;
    for (const row of canceledRows) {
      const raw = (row.failureReason || "unknown").trim();
      const bucket = (KNOWN_REASONS as readonly string[]).includes(raw) ? raw : "other";
      canceledByReason[bucket] = (canceledByReason[bucket] || 0) + Number(row.c);
      canceledTotal += Number(row.c);
    }

    // Failed sends in the last 7d grouped by failureReason (signal alongside cancels).
    const failedRows = await db
      .select({
        failureReason: outboundMessages.failureReason,
        c: count(),
      })
      .from(outboundMessages)
      .where(
        and(
          eq(outboundMessages.channel, "sms"),
          eq(outboundMessages.status, "failed"),
          gte(outboundMessages.updatedAt, sevenDaysAgo),
        ),
      )
      .groupBy(outboundMessages.failureReason);

    const failedByReason: Record<string, number> = {};
    let failedTotal = 0;
    for (const row of failedRows) {
      const raw = (row.failureReason || "unknown").trim();
      failedByReason[raw] = (failedByReason[raw] || 0) + Number(row.c);
      failedTotal += Number(row.c);
    }

    // Opt-out totals + recent opt-out timestamps.
    const [optOutCountRow] = await db
      .select({ c: count() })
      .from(users)
      .where(eq(users.smsOptOut, true));

    const [optOutRecentCountRow] = await db
      .select({ c: count() })
      .from(users)
      .where(and(eq(users.smsOptOut, true), gte(users.smsOptOutAt, sevenDaysAgo)));

    const recentOptOuts = await db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        name: users.name,
        smsOptOutAt: users.smsOptOutAt,
      })
      .from(users)
      .where(and(eq(users.smsOptOut, true), isNotNull(users.smsOptOutAt)))
      .orderBy(desc(users.smsOptOutAt))
      .limit(10);

    // Resume-confirmation bounce signal: users whose most recent
    // POST /api/profile/sms/resume confirmation text failed to send. Captured
    // on the user record so we can flag bad numbers without scanning logs.
    const [confirmFailureCountRow] = await db
      .select({ c: count() })
      .from(users)
      .where(isNotNull(users.smsConfirmationLastFailureAt));

    const recentConfirmFailures = await db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        name: users.name,
        phone: users.phone,
        smsConfirmationLastFailureAt: users.smsConfirmationLastFailureAt,
        smsConfirmationLastFailureCode: users.smsConfirmationLastFailureCode,
        smsConfirmationLastFailureMessage: users.smsConfirmationLastFailureMessage,
      })
      .from(users)
      .where(isNotNull(users.smsConfirmationLastFailureAt))
      .orderBy(desc(users.smsConfirmationLastFailureAt))
      .limit(10);

    res.json({
      windowDays: 7,
      canceled: {
        total: canceledTotal,
        byReason: canceledByReason,
      },
      failed: {
        total: failedTotal,
        byReason: failedByReason,
      },
      optOuts: {
        total: Number(optOutCountRow?.c || 0),
        last7d: Number(optOutRecentCountRow?.c || 0),
        recent: recentOptOuts,
      },
      confirmationFailures: {
        total: Number(confirmFailureCountRow?.c || 0),
        recent: recentConfirmFailures,
      },
    });
  } catch (error) {
    logger.error("[Admin SMS Health] summary error:", error);
    res.status(500).json({ error: "Failed to load SMS health summary" });
  }
});

router.get("/opt-outs", async (req, res) => {
  try {
    const limit = Math.min(parseInt((req.query.limit as string) || "50", 10) || 50, 200);

    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        name: users.name,
        phone: users.phone,
        smsOptOutAt: users.smsOptOutAt,
      })
      .from(users)
      .where(eq(users.smsOptOut, true))
      .orderBy(sql`${users.smsOptOutAt} DESC NULLS LAST`)
      .limit(limit);

    res.json({ users: rows });
  } catch (error) {
    logger.error("[Admin SMS Health] opt-outs error:", error);
    res.status(500).json({ error: "Failed to load opt-out list" });
  }
});

export default router;
