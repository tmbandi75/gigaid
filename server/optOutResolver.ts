import { logger } from "./lib/logger";

/**
 * Mask a phone like +15551234567 -> +15***4567 for safe logging.
 * Re-exported so consumers don't have to duplicate it.
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "unknown";
  if (phone.length <= 6) return "***";
  return `${phone.slice(0, 3)}***${phone.slice(-4)}`;
}

/**
 * Dependencies for resolveOptOutUserId. Extracted so the resolver can be
 * unit-tested against fake data without instantiating the database layer.
 */
export interface OptOutResolverDeps {
  /** Returns up to N matching users for an exact users.phone_e164 match. */
  findUsersByPhoneE164: (phone: string) => Promise<{ id: string }[]>;
  /**
   * Returns the userIds of the most recent outbound SMS rows addressed to
   * the given phone (limit ~50). Order does not matter for ambiguity check.
   */
  findRecentOutboundUserIds: (phone: string) => Promise<string[]>;
}

/** Why the resolver returned the userId (or didn't). */
export type OptOutResolution = "matched" | "unmatched" | "ambiguous";

/**
 * Like `resolveOptOutUserId` but also reports *why* the resolver landed
 * where it did, so the audit trail can distinguish "no user at all" from
 * "we deliberately refused due to ambiguity". Pure wrapper — keeps the
 * existing log lines and ambiguity guards intact.
 */
export async function resolveOptOutWithReason(
  fromPhone: string,
  deps: OptOutResolverDeps,
): Promise<{ userId: string | null; resolution: OptOutResolution }> {
  const phoneMatches = await deps.findUsersByPhoneE164(fromPhone);
  if (phoneMatches.length === 1) {
    return { userId: phoneMatches[0].id, resolution: "matched" };
  }
  if (phoneMatches.length > 1) {
    logger.warn(
      `[Twilio STOP] Ambiguous: ${phoneMatches.length}+ users share phone ${maskPhone(fromPhone)}; refusing opt-out, manual review required`,
    );
    return { userId: null, resolution: "ambiguous" };
  }

  const recentUserIds = await deps.findRecentOutboundUserIds(fromPhone);
  const distinct = Array.from(new Set(recentUserIds.filter(Boolean)));
  if (distinct.length === 1) {
    return { userId: distinct[0], resolution: "matched" };
  }
  if (distinct.length > 1) {
    logger.warn(
      `[Twilio STOP] Ambiguous outbound history: ${distinct.length} distinct users have texted ${maskPhone(fromPhone)} recently; refusing opt-out, manual review required`,
    );
    return { userId: null, resolution: "ambiguous" };
  }

  logger.info(`[Twilio STOP] No matching user for ${maskPhone(fromPhone)}; ignoring`);
  return { userId: null, resolution: "unmatched" };
}

/**
 * STOP-only phone -> userId resolution. Ambiguity-safe per spec:
 *   1. Strict users.phone_e164 match wins only on exactly one row.
 *   2. Otherwise outbound SMS history must yield exactly one distinct
 *      userId. Ambiguity (2+ matches) refuses with a structured warning.
 * Returns null whenever no safe match can be made — callers must not
 * flip any opt-out flags in that case.
 */
export async function resolveOptOutUserId(
  fromPhone: string,
  deps: OptOutResolverDeps,
): Promise<string | null> {
  // Pass 1: strict users.phone_e164 match.
  const phoneMatches = await deps.findUsersByPhoneE164(fromPhone);
  if (phoneMatches.length === 1) {
    return phoneMatches[0].id;
  }
  if (phoneMatches.length > 1) {
    logger.warn(
      `[Twilio STOP] Ambiguous: ${phoneMatches.length}+ users share phone ${maskPhone(fromPhone)}; refusing opt-out, manual review required`,
    );
    return null;
  }

  // Pass 2: outbound history. Require exactly one distinct userId.
  const recentUserIds = await deps.findRecentOutboundUserIds(fromPhone);
  const distinct = Array.from(new Set(recentUserIds.filter(Boolean)));
  if (distinct.length === 1) {
    return distinct[0];
  }
  if (distinct.length > 1) {
    logger.warn(
      `[Twilio STOP] Ambiguous outbound history: ${distinct.length} distinct users have texted ${maskPhone(fromPhone)} recently; refusing opt-out, manual review required`,
    );
    return null;
  }

  logger.info(`[Twilio STOP] No matching user for ${maskPhone(fromPhone)}; ignoring`);
  return null;
}

/**
 * Build the production OptOutResolverDeps wired against the real DB.
 * Lazy-imports db / schema so the resolver itself remains importable in
 * unit tests without triggering db module init.
 */
export async function buildDefaultOptOutResolverDeps(): Promise<OptOutResolverDeps> {
  const { users: usersTable, outboundMessages } = await import("@shared/schema");
  const { db } = await import("./db");
  const { eq, and, desc } = await import("drizzle-orm");

  return {
    findUsersByPhoneE164: async (phone) => {
      // Bounded fetch (cap at 10) so the ambiguity warning can report the
      // real count instead of just "2+". Phone collisions on users are
      // rare; ten is plenty for ops reporting.
      return await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.phoneE164, phone))
        .limit(10);
    },
    findRecentOutboundUserIds: async (phone) => {
      const rows = await db
        .select({ userId: outboundMessages.userId })
        .from(outboundMessages)
        .where(and(
          eq(outboundMessages.channel, "sms"),
          eq(outboundMessages.toAddress, phone),
        ))
        .orderBy(desc(outboundMessages.createdAt))
        .limit(50);
      return rows.map((r) => r.userId).filter((id): id is string => Boolean(id));
    },
  };
}
