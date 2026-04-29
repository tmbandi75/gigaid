import { Router } from "express";
import { db } from "../db";
import { outboundMessages, smsOptOutEvents, users, adminActionAudit } from "@shared/schema";
import { and, asc, desc, eq, gte, ilike, isNotNull, lte, ne, or, sql, count } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { adminMiddleware, type AdminRequest } from "../copilot/adminMiddleware";
import { logger } from "../lib/logger";
import { SMS_RESUME_CONFIRM_BODY } from "../lib/smsResumeConfirm";
import { loadDuplicatePhoneGroups } from "./duplicatePhones";
import { safeParseJsonColumn } from "./jsonColumn";

const router = Router();

router.use(adminMiddleware);

// Known structured guard reasons. Anything else is bucketed under "other".
const KNOWN_REASONS = [
  "user_opted_out",
  "phone_unreachable",
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
        smsConfirmationFailureCount: users.smsConfirmationFailureCount,
        smsConfirmationFirstFailureAt: users.smsConfirmationFirstFailureAt,
        phoneUnreachable: users.phoneUnreachable,
        phoneUnreachableAt: users.phoneUnreachableAt,
      })
      .from(users)
      .where(isNotNull(users.smsConfirmationLastFailureAt))
      .orderBy(desc(users.smsConfirmationLastFailureAt))
      .limit(25);

    // Distinguish one-off bounces from chronically bad numbers. A user is
    // "chronic" once smsConfirmationFailureCount has crossed the auto-pause
    // threshold (mirrored by phoneUnreachable=true on the user row).
    const [unreachableCountRow] = await db
      .select({ c: count() })
      .from(users)
      .where(eq(users.phoneUnreachable, true));

    // Inbound STOP audit: count + recent unmatched/ambiguous events. We
    // surface these so operators can spot opt-outs that didn't pin to any
    // user (e.g. a customer texts STOP to a number we never sent to).
    const [unmatchedRow] = await db
      .select({ c: count() })
      .from(smsOptOutEvents)
      .where(
        and(
          ne(smsOptOutEvents.resolution, "matched"),
          gte(smsOptOutEvents.createdAt, sevenDaysAgo),
        ),
      );

    const recentUnmatched = await db
      .select({
        id: smsOptOutEvents.id,
        fromPhoneMasked: smsOptOutEvents.fromPhoneMasked,
        resolution: smsOptOutEvents.resolution,
        body: smsOptOutEvents.body,
        createdAt: smsOptOutEvents.createdAt,
      })
      .from(smsOptOutEvents)
      .where(ne(smsOptOutEvents.resolution, "matched"))
      .orderBy(desc(smsOptOutEvents.createdAt))
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
        unreachable: Number(unreachableCountRow?.c || 0),
        recent: recentConfirmFailures,
      },
      unmatchedOptOuts: {
        last7d: Number(unmatchedRow?.c || 0),
        recent: recentUnmatched,
      },
    });
  } catch (error) {
    logger.error("[Admin SMS Health] summary error:", error);
    res.status(500).json({ error: "Failed to load SMS health summary" });
  }
});

// Allow-list of sort options exposed via the `sort` query param. Each value
// maps to one or more ORDER BY expressions. We always tie-break on users.id
// so pagination is stable across page boundaries.
const OPT_OUT_SORT_OPTIONS = {
  optOutAt_desc: [sql`${users.smsOptOutAt} DESC NULLS LAST`, desc(users.id)],
  optOutAt_asc: [sql`${users.smsOptOutAt} ASC NULLS LAST`, asc(users.id)],
  name_asc: [sql`${users.name} ASC NULLS LAST`, asc(users.id)],
  name_desc: [sql`${users.name} DESC NULLS LAST`, desc(users.id)],
  email_asc: [sql`${users.email} ASC NULLS LAST`, asc(users.id)],
  email_desc: [sql`${users.email} DESC NULLS LAST`, desc(users.id)],
} as const satisfies Record<string, SQL[]>;

export type OptOutSortKey = keyof typeof OPT_OUT_SORT_OPTIONS;

const DEFAULT_OPT_OUT_SORT: OptOutSortKey = "optOutAt_desc";

function parseOptOutSort(query: Record<string, any>): OptOutSortKey {
  const raw = typeof query.sort === "string" ? query.sort.trim() : "";
  if (raw && raw in OPT_OUT_SORT_OPTIONS) {
    return raw as OptOutSortKey;
  }
  return DEFAULT_OPT_OUT_SORT;
}

function buildOptOutFilters(query: Record<string, any>) {
  const conditions = [eq(users.smsOptOut, true)];

  const since = typeof query.since === "string" ? query.since.trim() : "";
  const until = typeof query.until === "string" ? query.until.trim() : "";
  const q = typeof query.q === "string" ? query.q.trim() : "";

  if (since) conditions.push(gte(users.smsOptOutAt, since));
  if (until) conditions.push(lte(users.smsOptOutAt, until));

  if (q) {
    const like = `%${q}%`;
    const searchExpr = or(
      ilike(users.email, like),
      ilike(users.username, like),
      ilike(users.name, like),
      ilike(users.phone, like),
    );
    if (searchExpr) conditions.push(searchExpr);
  }

  return and(...conditions);
}

router.get("/opt-outs", async (req, res) => {
  try {
    const limit = Math.min(
      parseInt((req.query.limit as string) || "50", 10) || 50,
      200,
    );
    const offset = Math.max(parseInt((req.query.offset as string) || "0", 10) || 0, 0);
    const where = buildOptOutFilters(req.query as Record<string, any>);
    const sortKey = parseOptOutSort(req.query as Record<string, any>);
    const orderBy = OPT_OUT_SORT_OPTIONS[sortKey];

    const [totalRow] = await db
      .select({ c: count() })
      .from(users)
      .where(where);

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
      .where(where)
      .orderBy(...orderBy)
      .limit(limit)
      .offset(offset);

    res.json({
      users: rows,
      sort: sortKey,
      pagination: {
        total: Number(totalRow?.c || 0),
        limit,
        offset,
      },
    });
  } catch (error) {
    logger.error("[Admin SMS Health] opt-outs error:", error);
    res.status(500).json({ error: "Failed to load opt-out list" });
  }
});

// ----------------------------------------------------------------------------
// Duplicate phone diagnostics + repair tool.
// ----------------------------------------------------------------------------
// Background: the STOP webhook refuses to opt anyone out when 2+ user rows
// share the same users.phone_e164 (see server/twilioStopOptOut.ts and
// server/optOutResolver.ts). That safety means the affected users CANNOT
// opt out by texting STOP until the duplicate is resolved.
//
// These two endpoints give support the visibility + repair tool described
// in docs/runbooks/sms-duplicate-phones.md.
// ----------------------------------------------------------------------------

router.get("/duplicate-phones", async (_req, res) => {
  try {
    const groups = await loadDuplicatePhoneGroups();
    res.json({
      groupCount: groups.length,
      affectedUserCount: groups.reduce((sum, g) => sum + g.userCount, 0),
      groups,
    });
  } catch (error) {
    logger.error("[Admin SMS Health] duplicate-phones error:", error);
    res.status(500).json({ error: "Failed to load duplicate phone numbers" });
  }
});

// Manual trigger for the duplicate-phone alert notifier. Useful for support to
// force a re-check after cleaning up data, or to verify SUPPORT_EMAIL routing.
router.post("/duplicate-phones/run-alerts", async (_req, res) => {
  try {
    const { runDuplicatePhoneAlertJob } = await import("./duplicatePhoneAlertJob");
    const result = await runDuplicatePhoneAlertJob({ triggeredBy: "manual" });
    res.json(result);
  } catch (error) {
    logger.error("[Admin SMS Health] duplicate-phones run-alerts error:", error);
    res.status(500).json({ error: "Failed to run duplicate phone alert job" });
  }
});

router.post("/users/:userId/clear-phone", async (req: AdminRequest, res) => {
  try {
    const { userId } = req.params;
    if (!req.adminUserId) {
      return res.status(401).json({ error: "Admin identity required" });
    }
    const reason = ((req.body && req.body.reason) || "").toString().trim();
    if (!reason) {
      // Force a written reason so the audit log is meaningful — clearing
      // a phone affects which account future STOP texts opt out.
      return res.status(400).json({ error: "reason is required" });
    }

    const [target] = await db
      .select({ id: users.id, phoneE164: users.phoneE164 })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!target) {
      return res.status(404).json({ error: "User not found" });
    }

    const previousPhone = target.phoneE164;

    // Transactional so we never end up with a cleared phone but no audit
    // row (or vice-versa). The audit trail is the only forensic record of
    // who touched STOP-routing data.
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ phoneE164: null })
        .where(eq(users.id, userId));

      await tx.insert(adminActionAudit).values({
        createdAt: new Date().toISOString(),
        actorUserId: req.adminUserId!,
        actorEmail: req.userEmail || null,
        targetUserId: userId,
        actionKey: "sms_clear_phone_e164",
        reason,
        payload: JSON.stringify({ previousPhoneE164: previousPhone }),
        source: "admin_ui",
      });
    });

    logger.info(
      `[Admin SMS Health] Cleared phone_e164 for user ${userId} (actor=${req.adminUserId})`,
    );

    res.json({ success: true, userId, previousPhoneE164: previousPhone });
  } catch (error) {
    logger.error("[Admin SMS Health] clear-phone error:", error);
    res.status(500).json({ error: "Failed to clear phone_e164" });
  }
});

// Manually re-enable SMS for a user who is currently opted out. Mirrors
// the user-initiated "Resume SMS" action in Settings (POST
// /api/profile/sms/resume) so support can flip a roster row from
// /admin/sms without drilling into the user detail page. Clears
// smsOptOut + smsOptOutAt, restores notifyBySms=true (the legacy
// preference toggled off when STOP arrives — see twilioStopOptOut.ts),
// records a structured audit row, and sends the same resume
// confirmation SMS the in-app flow uses.
router.post("/users/:userId/re-enable", async (req: AdminRequest, res) => {
  try {
    const { userId } = req.params;
    if (!req.adminUserId) {
      return res.status(401).json({ error: "Admin identity required" });
    }
    const reason = ((req.body && req.body.reason) || "").toString().trim();
    if (!reason) {
      // Force a written reason so the audit log is meaningful — manually
      // re-enabling SMS bypasses the user's STOP signal, so we want a
      // record of why support did it (e.g. "User emailed support
      // asking to resume").
      return res.status(400).json({ error: "reason is required" });
    }

    const [target] = await db
      .select({
        id: users.id,
        phone: users.phone,
        smsOptOut: users.smsOptOut,
        smsOptOutAt: users.smsOptOutAt,
        notifyBySms: users.notifyBySms,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!target) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!target.smsOptOut) {
      // Idempotent: nothing to flip. Avoid writing a misleading audit
      // row for a no-op.
      return res
        .status(409)
        .json({ error: "User is not currently opted out" });
    }

    const previous = {
      smsOptOut: target.smsOptOut ?? false,
      smsOptOutAt: target.smsOptOutAt,
      notifyBySms: target.notifyBySms ?? null,
    };

    // Transactional so the user-row update and the audit entry land
    // together — the audit trail is the only forensic record of who
    // re-enabled SMS for a previously-opted-out account.
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({
          smsOptOut: false,
          smsOptOutAt: null,
          notifyBySms: true,
        })
        .where(eq(users.id, userId));

      await tx.insert(adminActionAudit).values({
        createdAt: new Date().toISOString(),
        actorUserId: req.adminUserId!,
        actorEmail: req.userEmail || null,
        targetUserId: userId,
        actionKey: "sms_re_enable_opt_out",
        reason,
        payload: JSON.stringify(previous),
        source: "admin_ui",
      });
    });

    logger.info(
      `[Admin SMS Health] Re-enabled SMS for user ${userId} (actor=${req.adminUserId})`,
    );

    // Send the same confirmation SMS used by the in-app /sms/resume
    // flow. We don't fail the action if the text bounces — the opt-out
    // flag has already been cleared at this point — but we report
    // delivery status back to the UI so the operator knows whether
    // the user was notified.
    let confirmationSent = false;
    let confirmationWarning: string | undefined;
    let confirmationFailureCode: string | undefined;
    const phone = target.phone;
    if (!phone) {
      confirmationWarning = "No phone number on file for confirmation text.";
      confirmationFailureCode = "NO_PHONE";
    } else {
      try {
        const { sendSMS } = await import("../twilio");
        const result = await sendSMS(phone, SMS_RESUME_CONFIRM_BODY);
        if (result.success) {
          confirmationSent = true;
        } else {
          confirmationWarning =
            result.errorMessage || "Couldn't send confirmation text.";
          confirmationFailureCode = result.errorCode || "SEND_FAILED";
          logger.warn(
            `[Admin SMS Health] Re-enable confirmation SMS failed for user ${userId}: ${confirmationFailureCode}`,
          );
        }
      } catch (smsErr) {
        confirmationWarning = "Couldn't send confirmation text.";
        confirmationFailureCode = "SEND_THREW";
        logger.error(
          `[Admin SMS Health] Re-enable confirmation SMS threw for user ${userId}:`,
          smsErr,
        );
      }
    }

    res.json({
      success: true,
      userId,
      previous,
      confirmationSent,
      confirmationWarning,
      confirmationFailureCode,
    });
  } catch (error) {
    logger.error("[Admin SMS Health] re-enable error:", error);
    res.status(500).json({ error: "Failed to re-enable SMS" });
  }
});

// Manual reset for the auto-pause flag set by the resume-confirmation
// failure streak. When the streak crosses PHONE_UNREACHABLE_THRESHOLD we
// flip phoneUnreachable=true so further outbound SMS is suppressed; this
// endpoint lets an admin clear that state when they know the number was
// fixed (or want to re-test) without waiting for the user to resume from
// Settings. Resets the four state fields the streak tracker writes:
// smsConfirmationFailureCount, smsConfirmationFirstFailureAt,
// phoneUnreachable, phoneUnreachableAt. The diagnostic last-failure code
// / message / timestamp are intentionally left intact so the admin row
// still shows what most recently bounced.
router.post("/users/:userId/clear-unreachable", async (req: AdminRequest, res) => {
  try {
    const { userId } = req.params;
    if (!req.adminUserId) {
      return res.status(401).json({ error: "Admin identity required" });
    }
    const reason = ((req.body && req.body.reason) || "").toString().trim();
    if (!reason) {
      // Force a written reason so the audit log is meaningful — clearing
      // the auto-pause flag re-enables outbound SMS to a number we
      // previously concluded was unreachable.
      return res.status(400).json({ error: "reason is required" });
    }

    const [target] = await db
      .select({
        id: users.id,
        smsConfirmationFailureCount: users.smsConfirmationFailureCount,
        smsConfirmationFirstFailureAt: users.smsConfirmationFirstFailureAt,
        phoneUnreachable: users.phoneUnreachable,
        phoneUnreachableAt: users.phoneUnreachableAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!target) {
      return res.status(404).json({ error: "User not found" });
    }

    const previous = {
      smsConfirmationFailureCount: target.smsConfirmationFailureCount ?? 0,
      smsConfirmationFirstFailureAt: target.smsConfirmationFirstFailureAt,
      phoneUnreachable: target.phoneUnreachable ?? false,
      phoneUnreachableAt: target.phoneUnreachableAt,
    };

    // Transactional so the user-row reset and the audit entry land
    // together — the audit trail is the only forensic record of who
    // re-enabled outbound SMS.
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({
          smsConfirmationFailureCount: 0,
          smsConfirmationFirstFailureAt: null,
          phoneUnreachable: false,
          phoneUnreachableAt: null,
        })
        .where(eq(users.id, userId));

      await tx.insert(adminActionAudit).values({
        createdAt: new Date().toISOString(),
        actorUserId: req.adminUserId!,
        actorEmail: req.userEmail || null,
        targetUserId: userId,
        actionKey: "sms_clear_phone_unreachable",
        reason,
        payload: JSON.stringify(previous),
        source: "admin_ui",
      });
    });

    logger.info(
      `[Admin SMS Health] Cleared phone_unreachable for user ${userId} (actor=${req.adminUserId}, prevCount=${previous.smsConfirmationFailureCount}, prevUnreachable=${previous.phoneUnreachable})`,
    );

    res.json({ success: true, userId, previous });
  } catch (error) {
    logger.error("[Admin SMS Health] clear-unreachable error:", error);
    res.status(500).json({ error: "Failed to clear phone unreachable flag" });
  }
});

// Recent clear-phone audit rows. Surfaces the last N
// `sms_clear_phone_e164` actions (actor, target, reason, timestamp,
// previous phone) on the duplicate-phone diagnostic so support doesn't
// have to query admin_action_audit directly to confirm a repair.
router.get("/clear-phone-audit", async (req, res) => {
  try {
    const limit = Math.min(
      parseInt((req.query.limit as string) || "25", 10) || 25,
      100,
    );
    const offset = Math.max(parseInt((req.query.offset as string) || "0", 10) || 0, 0);

    const where = eq(adminActionAudit.actionKey, "sms_clear_phone_e164");

    const [totalRow] = await db
      .select({ c: count() })
      .from(adminActionAudit)
      .where(where);

    const targetUser = {
      id: users.id,
      email: users.email,
      username: users.username,
      name: users.name,
    } as const;

    const rows = await db
      .select({
        id: adminActionAudit.id,
        createdAt: adminActionAudit.createdAt,
        actorUserId: adminActionAudit.actorUserId,
        actorEmail: adminActionAudit.actorEmail,
        targetUserId: adminActionAudit.targetUserId,
        reason: adminActionAudit.reason,
        payload: adminActionAudit.payload,
        source: adminActionAudit.source,
        targetUser,
      })
      .from(adminActionAudit)
      .leftJoin(users, eq(users.id, adminActionAudit.targetUserId))
      .where(where)
      .orderBy(desc(adminActionAudit.createdAt))
      .limit(limit)
      .offset(offset);

    const events = rows.map((r) => {
      let previousPhoneE164: string | null = null;
      const parsed = safeParseJsonColumn(r.payload, {
        endpoint: "sms_clear_phone_audit",
        rowId: r.id,
        column: "payload",
      });
      if (
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed) &&
        typeof (parsed as Record<string, unknown>).previousPhoneE164 === "string"
      ) {
        previousPhoneE164 = (parsed as Record<string, string>).previousPhoneE164;
      }
      return {
        id: r.id,
        createdAt: r.createdAt,
        actorUserId: r.actorUserId,
        actorEmail: r.actorEmail,
        targetUserId: r.targetUserId,
        targetUser: r.targetUser?.id ? r.targetUser : null,
        reason: r.reason,
        source: r.source,
        previousPhoneE164,
      };
    });

    res.json({
      events,
      pagination: {
        total: Number(totalRow?.c || 0),
        limit,
        offset,
      },
    });
  } catch (error) {
    logger.error("[Admin SMS Health] clear-phone-audit error:", error);
    res.status(500).json({ error: "Failed to load clear-phone audit log" });
  }
});

// Drill-down list of unmatched/ambiguous STOP events. Returns the raw
// From phone (admin-only audit) so operators can investigate. Defaults to
// only non-matched rows; pass ?include=all to see everything.
router.get("/opt-out-events", async (req, res) => {
  try {
    const limit = Math.min(parseInt((req.query.limit as string) || "50", 10) || 50, 200);
    const include = (req.query.include as string) || "unmatched";

    const where = include === "all"
      ? undefined
      : ne(smsOptOutEvents.resolution, "matched");

    const baseQuery = db
      .select({
        id: smsOptOutEvents.id,
        fromPhoneMasked: smsOptOutEvents.fromPhoneMasked,
        fromPhoneRaw: smsOptOutEvents.fromPhoneRaw,
        userId: smsOptOutEvents.userId,
        resolution: smsOptOutEvents.resolution,
        body: smsOptOutEvents.body,
        twilioSid: smsOptOutEvents.twilioSid,
        createdAt: smsOptOutEvents.createdAt,
      })
      .from(smsOptOutEvents);

    const rows = await (where ? baseQuery.where(where) : baseQuery)
      .orderBy(desc(smsOptOutEvents.createdAt))
      .limit(limit);

    res.json({ events: rows });
  } catch (error) {
    logger.error("[Admin SMS Health] opt-out-events error:", error);
    res.status(500).json({ error: "Failed to load opt-out events" });
  }
});

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  let str = String(value);
  // Neutralize CSV/spreadsheet formula injection. If the cell starts with
  // a character that Excel/Sheets/Numbers treat as a formula trigger
  // (=, +, -, @, tab, CR), prefix a single quote so it is rendered as
  // literal text rather than evaluated.
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

router.get("/opt-outs/export", async (req, res) => {
  try {
    const where = buildOptOutFilters(req.query as Record<string, any>);
    const sortKey = parseOptOutSort(req.query as Record<string, any>);
    const orderBy = OPT_OUT_SORT_OPTIONS[sortKey];

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="sms-opt-outs-${new Date().toISOString().split("T")[0]}.csv"`,
    );

    const header = ["id", "name", "username", "email", "phone", "sms_opt_out_at"]
      .map(csvEscape)
      .join(",");
    res.write(header + "\n");

    const pageSize = 500;
    let offset = 0;

    // Stream the entire filtered set; CSV exports power compliance
    // reviews so we deliberately do not cap the row count here.
    // eslint-disable-next-line no-constant-condition
    while (true) {
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
        .where(where)
        .orderBy(...orderBy)
        .limit(pageSize)
        .offset(offset);

      if (rows.length === 0) break;

      for (const r of rows) {
        const line = [
          r.id,
          r.name,
          r.username,
          r.email,
          r.phone,
          r.smsOptOutAt,
        ]
          .map(csvEscape)
          .join(",");
        res.write(line + "\n");
      }

      if (rows.length < pageSize) break;
      offset += pageSize;
    }

    res.end();
  } catch (error) {
    logger.error("[Admin SMS Health] opt-outs export error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to export opt-out list" });
    } else {
      res.end();
    }
  }
});

export default router;
