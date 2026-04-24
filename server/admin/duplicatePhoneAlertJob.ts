// ============================================================================
// Scheduled notifier: emails support when a NEW duplicate-phone group appears
// (or an existing group grows). Companion to server/admin/duplicatePhones.ts.
//
// Why: support only learns about duplicates by opening /admin/sms-health,
// but duplicates silently break STOP routing. This job pushes the signal so
// it can be cleared before the next STOP attempt.
//
// De-dup strategy: we persist a row per phone number in duplicate_phone_alerts.
// We re-alert only when a phone is brand new OR when its colliding-user-count
// has grown since the last alert (a new user joined the collision).
// ============================================================================

import { logger } from "../lib/logger";
import type { DuplicatePhoneGroup } from "./duplicatePhones";

export interface AlertHistoryRow {
  phoneE164: string;
  lastUserCount: number;
}

export interface AlertDecision {
  groupsToAlert: DuplicatePhoneGroup[];
  reasons: Record<string, "new" | "grew">;
}

/**
 * Pure decision: which groups should we alert on, given the current
 * duplicate groups and the previously alerted history?
 *
 * - "new"  -> phone has never been alerted on
 * - "grew" -> phone was alerted on but now has more colliding users
 *
 * Groups whose userCount is unchanged or shrunk are skipped (no re-spam).
 */
export function decideAlerts(
  currentGroups: DuplicatePhoneGroup[],
  history: AlertHistoryRow[],
): AlertDecision {
  const lastCountByPhone = new Map<string, number>();
  for (const h of history) lastCountByPhone.set(h.phoneE164, h.lastUserCount);

  const groupsToAlert: DuplicatePhoneGroup[] = [];
  const reasons: Record<string, "new" | "grew"> = {};

  for (const g of currentGroups) {
    const prev = lastCountByPhone.get(g.phoneE164);
    if (prev === undefined) {
      groupsToAlert.push(g);
      reasons[g.phoneE164] = "new";
    } else if (g.userCount > prev) {
      groupsToAlert.push(g);
      reasons[g.phoneE164] = "grew";
    }
  }

  return { groupsToAlert, reasons };
}

/** Mask all but the last 4 digits of an E.164 phone for log/email display. */
export function maskPhoneE164(phone: string): string {
  if (!phone) return phone;
  if (phone.length <= 4) return phone;
  return phone.slice(0, phone.length - 4).replace(/\d/g, "*") + phone.slice(-4);
}

function adminLinkBase(): string {
  return (
    process.env.PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.REPLIT_DOMAINS?.split(",")[0]?.trim() ||
    ""
  ).replace(/\/+$/, "");
}

function supportRecipients(): string[] {
  const raw = process.env.SUPPORT_EMAIL || process.env.ADMIN_EMAILS || "";
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export function buildAlertEmail(
  groupsToAlert: DuplicatePhoneGroup[],
  reasons: Record<string, "new" | "grew">,
): { subject: string; text: string; html: string } {
  const base = adminLinkBase();
  const link = base
    ? `${base.startsWith("http") ? base : "https://" + base}/admin/sms-health`
    : "/admin/sms-health";

  const newCount = Object.values(reasons).filter((r) => r === "new").length;
  const grewCount = Object.values(reasons).filter((r) => r === "grew").length;

  const subject =
    `[SMS Health] ${groupsToAlert.length} duplicate phone ` +
    `group${groupsToAlert.length === 1 ? "" : "s"} need attention` +
    (grewCount > 0 ? ` (${newCount} new, ${grewCount} grew)` : "");

  const lines: string[] = [];
  lines.push("Duplicate phone numbers are blocking STOP opt-out for affected users.");
  lines.push("");
  lines.push(`Resolve at: ${link}`);
  lines.push("");
  for (const g of groupsToAlert) {
    const reason = reasons[g.phoneE164];
    lines.push(
      `- ${maskPhoneE164(g.phoneE164)} (${g.userCount} users, ${reason}):`,
    );
    for (const u of g.users) {
      lines.push(`    * ${u.id}${u.email ? ` <${u.email}>` : ""}`);
    }
  }
  const text = lines.join("\n");

  const htmlGroups = groupsToAlert
    .map((g) => {
      const reason = reasons[g.phoneE164];
      const userItems = g.users
        .map(
          (u) =>
            `<li><code>${u.id}</code>${
              u.email ? ` &lt;${u.email}&gt;` : ""
            }</li>`,
        )
        .join("");
      return `<li><strong>${maskPhoneE164(
        g.phoneE164,
      )}</strong> — ${g.userCount} users (${reason})<ul>${userItems}</ul></li>`;
    })
    .join("");
  const html =
    `<p>Duplicate phone numbers are blocking STOP opt-out for affected users.</p>` +
    `<p><a href="${link}">Open SMS Health dashboard</a></p>` +
    `<ul>${htmlGroups}</ul>`;

  return { subject, text, html };
}

/**
 * Run one notifier cycle. Loads current dup groups, compares against the
 * persisted alert history, emails support about new/grown groups, and
 * upserts the history rows so we don't re-notify next run.
 */
export async function runDuplicatePhoneAlertJob(options: {
  triggeredBy?: "scheduled" | "manual";
} = {}): Promise<{
  groupsTotal: number;
  alertsSent: number;
  emailed: boolean;
  reasons: Record<string, "new" | "grew">;
}> {
  const triggeredBy = options.triggeredBy || "scheduled";
  const { loadDuplicatePhoneGroups } = await import("./duplicatePhones");
  const { db } = await import("../db");
  const { duplicatePhoneAlerts } = await import("@shared/schema");
  const { inArray } = await import("drizzle-orm");

  const groups = await loadDuplicatePhoneGroups();

  if (groups.length === 0) {
    logger.info(
      `[DuplicatePhoneAlertJob] No duplicate phone groups (triggeredBy=${triggeredBy})`,
    );
    return { groupsTotal: 0, alertsSent: 0, emailed: false, reasons: {} };
  }

  const phones = groups.map((g) => g.phoneE164);
  const history = await db
    .select({
      phoneE164: duplicatePhoneAlerts.phoneE164,
      lastUserCount: duplicatePhoneAlerts.lastUserCount,
      alertCount: duplicatePhoneAlerts.alertCount,
      firstAlertedAt: duplicatePhoneAlerts.firstAlertedAt,
    })
    .from(duplicatePhoneAlerts)
    .where(inArray(duplicatePhoneAlerts.phoneE164, phones));

  const { groupsToAlert, reasons } = decideAlerts(
    groups,
    history.map((h) => ({
      phoneE164: h.phoneE164,
      lastUserCount: h.lastUserCount,
    })),
  );

  if (groupsToAlert.length === 0) {
    logger.info(
      `[DuplicatePhoneAlertJob] ${groups.length} duplicate group(s), nothing new since last alert`,
    );
    return {
      groupsTotal: groups.length,
      alertsSent: 0,
      emailed: false,
      reasons,
    };
  }

  const recipients = supportRecipients();
  let emailed = false;
  if (recipients.length === 0) {
    // Don't record history when we couldn't actually notify anyone — otherwise
    // we'd permanently silence these groups even though support never heard
    // about them. Surface the misconfiguration and bail.
    logger.error(
      "[DuplicatePhoneAlertJob] No SUPPORT_EMAIL/ADMIN_EMAILS configured; cannot notify support. Skipping history write so a future run can deliver.",
    );
    return {
      groupsTotal: groups.length,
      alertsSent: 0,
      emailed: false,
      reasons,
    };
  }

  try {
    const { sendEmail } = await import("../sendgrid");
    const { subject, text, html } = buildAlertEmail(groupsToAlert, reasons);
    // Send sequentially so a single bad address doesn't tank the others.
    for (const to of recipients) {
      const ok = await sendEmail({ to, subject, text, html });
      if (ok) emailed = true;
    }
  } catch (error) {
    logger.error("[DuplicatePhoneAlertJob] Failed to send alert email:", error);
  }

  if (!emailed) {
    // Every recipient failed (sendgrid down, all addresses invalid, etc).
    // Don't mark these groups as alerted — the next run should retry so
    // support eventually learns about the duplicates.
    logger.error(
      `[DuplicatePhoneAlertJob] Alert email failed for all ${recipients.length} recipient(s); leaving history untouched so the next run can retry`,
    );
    return {
      groupsTotal: groups.length,
      alertsSent: 0,
      emailed: false,
      reasons,
    };
  }

  // Upsert history rows so we don't re-alert next run. Only reached when
  // at least one recipient was successfully emailed.
  const now = new Date().toISOString();
  const existingByPhone = new Map(history.map((h) => [h.phoneE164, h]));
  for (const g of groupsToAlert) {
    const prev = existingByPhone.get(g.phoneE164);
    const userIds = JSON.stringify(g.users.map((u) => u.id).sort());
    await db
      .insert(duplicatePhoneAlerts)
      .values({
        phoneE164: g.phoneE164,
        lastUserCount: g.userCount,
        lastUserIds: userIds,
        firstAlertedAt: prev?.firstAlertedAt || now,
        lastAlertedAt: now,
        alertCount: (prev?.alertCount || 0) + 1,
      })
      .onConflictDoUpdate({
        target: duplicatePhoneAlerts.phoneE164,
        set: {
          lastUserCount: g.userCount,
          lastUserIds: userIds,
          lastAlertedAt: now,
          alertCount: (prev?.alertCount || 0) + 1,
        },
      });
  }

  logger.info(
    `[DuplicatePhoneAlertJob] Alerted on ${groupsToAlert.length}/${groups.length} duplicate group(s) (emailed=${emailed}, triggeredBy=${triggeredBy})`,
  );

  return {
    groupsTotal: groups.length,
    alertsSent: groupsToAlert.length,
    emailed,
    reasons,
  };
}

const ONE_HOUR_MS = 60 * 60 * 1000;
const RUN_INTERVAL_MS = 24 * ONE_HOUR_MS; // daily

export function startDuplicatePhoneAlertScheduler() {
  logger.info(
    "[DuplicatePhoneAlertJob] Starting scheduler (runs every 24h)",
  );

  setInterval(async () => {
    try {
      await runDuplicatePhoneAlertJob({ triggeredBy: "scheduled" });
    } catch (error) {
      logger.error("[DuplicatePhoneAlertJob] Scheduler error:", error);
    }
  }, RUN_INTERVAL_MS);

  // Light initial delay so it doesn't fight startup; matches rebookingScheduler pattern.
  setTimeout(() => {
    runDuplicatePhoneAlertJob({ triggeredBy: "scheduled" }).catch((err) =>
      logger.error("[DuplicatePhoneAlertJob] Initial run failed:", err),
    );
  }, 60_000);
}
