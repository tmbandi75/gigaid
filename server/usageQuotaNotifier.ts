import { db } from "./db";
import { capabilityUsage } from "@shared/schema";
import { and, eq, isNull } from "drizzle-orm";
import { storage } from "./storage";
import { getLimit } from "@shared/capabilities/canPerform";
import type { Plan, Capability } from "@shared/capabilities/plans";
import { CAPABILITY_DISPLAY_NAMES } from "@shared/capabilities/capabilityRules";
import { sendEmail } from "./sendgrid";
import { logger } from "./lib/logger";

const UPGRADE_URL_BASE = process.env.FRONTEND_URL || "https://account.gigaid.ai";

type Threshold = 80 | 100;

interface CapabilityCopy {
  noun: string;
  blockedNote: string;
  benefit: string;
}

const CAPABILITY_COPY: Partial<Record<Capability, CapabilityCopy>> = {
  'jobs.create': {
    noun: 'jobs',
    blockedNote: "New jobs are paused until your quota resets",
    benefit: "unlimited job creation",
  },
  'sms.two_way': {
    noun: 'SMS replies',
    blockedNote: "New SMS replies are paused until your quota resets",
    benefit: "unlimited two-way messaging",
  },
  'sms.auto_followups': {
    noun: 'auto follow-ups',
    blockedNote: "Automatic follow-ups are paused until your quota resets",
    benefit: "unlimited automatic follow-ups",
  },
  'deposit.enforce': {
    noun: 'enforced deposits',
    blockedNote: "You won't be able to enforce more deposits until your quota resets",
    benefit: "unlimited deposit enforcement",
  },
  'price.confirmation': {
    noun: 'price confirmations',
    blockedNote: "New price confirmations are paused until your quota resets",
    benefit: "unlimited price confirmations",
  },
  'offline.photos': {
    noun: 'offline photos',
    blockedNote: "Offline photo uploads are paused until your quota resets",
    benefit: "unlimited offline photo uploads",
  },
};

function getCopy(capability: Capability): CapabilityCopy {
  const preset = CAPABILITY_COPY[capability];
  if (preset) return preset;
  const label = (CAPABILITY_DISPLAY_NAMES[capability] || capability).toLowerCase();
  return {
    noun: label,
    blockedNote: `New ${label} are paused until your quota resets`,
    benefit: `unlimited ${label}`,
  };
}

function buildEmailContent(
  capability: Capability,
  threshold: Threshold,
  current: number,
  limit: number,
  firstName: string | null,
) {
  const { noun, blockedNote, benefit } = getCopy(capability);
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  const upgradeUrl = `${UPGRADE_URL_BASE}/upgrade?from=quota_${threshold}&capability=${encodeURIComponent(capability)}`;

  if (threshold === 100) {
    const subject = `You've used all ${limit} ${noun} on the Free plan this month`;
    const text = `${greeting}

You've reached your Free plan limit of ${limit} ${noun} this month (${current}/${limit}). ${blockedNote}.

Upgrade to Pro for ${benefit} and keep your business moving:
${upgradeUrl}

— GigAid`;
    const html = `<p>${greeting}</p>
<p>You've reached your Free plan limit of <strong>${limit} ${noun}</strong> this month (${current}/${limit}). ${blockedNote}.</p>
<p><a href="${upgradeUrl}" style="display:inline-block;padding:10px 16px;background:#0f172a;color:#fff;border-radius:6px;text-decoration:none">Upgrade to Pro</a></p>
<p>Pro gives you ${benefit} and keeps your business moving without interruptions.</p>
<p>— GigAid</p>`;
    return { subject, text, html };
  }

  const subject = `You're at 80% of your monthly ${noun} on the Free plan`;
  const text = `${greeting}

Heads up — you've used ${current} of your ${limit} monthly ${noun} on the Free plan. Once you hit ${limit}, ${blockedNote.charAt(0).toLowerCase()}${blockedNote.slice(1)}.

Upgrade to Pro for ${benefit}:
${upgradeUrl}

— GigAid`;
  const html = `<p>${greeting}</p>
<p>Heads up — you've used <strong>${current} of your ${limit}</strong> monthly ${noun} on the Free plan. Once you hit ${limit}, ${blockedNote.charAt(0).toLowerCase()}${blockedNote.slice(1)}.</p>
<p><a href="${upgradeUrl}" style="display:inline-block;padding:10px 16px;background:#0f172a;color:#fff;border-radius:6px;text-decoration:none">Upgrade to Pro</a></p>
<p>— GigAid</p>`;
  return { subject, text, html };
}

async function markAlertSent(
  userId: string,
  capability: string,
  threshold: Threshold,
  windowStart: string | null,
): Promise<boolean> {
  const now = new Date().toISOString();

  // Conditional update — only set if not already set within the same window.
  // This guards against races (two concurrent increments both crossing the
  // threshold) so we never send duplicate emails.
  const setClause =
    threshold === 80
      ? { alert80SentAt: now, updatedAt: now }
      : { alert100SentAt: now, updatedAt: now };

  const conds = [
    eq(capabilityUsage.userId, userId),
    eq(capabilityUsage.capability, capability),
    threshold === 80
      ? isNull(capabilityUsage.alert80SentAt)
      : isNull(capabilityUsage.alert100SentAt),
  ];
  if (windowStart) conds.push(eq(capabilityUsage.windowStart, windowStart));

  const updated = await db
    .update(capabilityUsage)
    .set(setClause)
    .where(and(...conds))
    .returning({ id: capabilityUsage.id });

  return updated.length > 0;
}

/**
 * If the just-incremented usage crosses the 80% or 100% threshold for a
 * capacity-limited capability, send the user an email (once per window).
 * Safe to call after every increment; cheap no-op for unlimited plans or
 * when alerts have already been sent for the current window.
 */
export async function maybeSendQuotaAlert(
  userId: string,
  plan: Plan,
  capability: Capability,
  newCount: number,
): Promise<void> {
  try {
    // Email copy is Free-plan upsell language ("Upgrade to Pro"). Other plans
    // get their own warning treatment elsewhere; gate centrally so every
    // call site (jobs, sms, photos, deposits, follow-ups, price confirms)
    // is automatically safe.
    if (plan !== 'free') return;

    const limit = getLimit(plan, capability);
    if (!limit || limit <= 0) return; // unlimited or unmetered

    // Warn threshold = whichever is *smaller* of "ceil(80% of limit)" and
    // "one below the hard cap". This ensures a real pre-limit warning fires
    // even when the limit is tiny (e.g. price.confirmation=3 -> warn at 2,
    // offline.photos=3 -> warn at 2). For limit=1 no early warning is
    // possible, so only the 100% email fires.
    const warnAt = limit > 1 ? Math.min(Math.ceil(limit * 0.8), limit - 1) : limit;
    const reached100 = newCount >= limit;
    const reached80 = newCount >= warnAt;
    if (!reached80 && !reached100) return;

    const usage = await storage.getCapabilityUsage(userId, capability);
    if (!usage) return;

    const needs100 = reached100 && !usage.alert100SentAt;
    const needs80 = reached80 && !needs100 && !usage.alert80SentAt;
    if (!needs80 && !needs100) return;

    const user = await storage.getUser(userId);
    if (!user || !user.email) return;
    if (user.notifyByEmail === false) return;

    const threshold: Threshold = needs100 ? 100 : 80;

    // Reserve the slot atomically before sending so concurrent increments
    // don't double-send.
    const reserved = await markAlertSent(
      userId,
      capability,
      threshold,
      usage.windowStart ?? null,
    );
    if (!reserved) return;

    const firstName = user.firstName || user.name?.split(" ")[0] || null;
    const { subject, text, html } = buildEmailContent(
      capability,
      threshold,
      newCount,
      limit,
      firstName,
    );

    const ok = await sendEmail({ to: user.email, subject, text, html });
    if (!ok) {
      // Roll the reservation back so the next increment in this window
      // gets another shot at delivering the alert instead of silently
      // dropping it.
      await db
        .update(capabilityUsage)
        .set(
          threshold === 80
            ? { alert80SentAt: null }
            : { alert100SentAt: null },
        )
        .where(
          and(
            eq(capabilityUsage.userId, userId),
            eq(capabilityUsage.capability, capability),
          ),
        );
      logger.warn("[QuotaNotifier] Email send returned false; reservation rolled back", {
        userId,
        capability,
        threshold,
      });
    } else {
      logger.info("[QuotaNotifier] Sent quota alert", {
        userId,
        capability,
        threshold,
        current: newCount,
        limit,
      });
    }
  } catch (err) {
    logger.error("[QuotaNotifier] Failed to send quota alert", err);
  }
}
