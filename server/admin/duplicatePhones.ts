// ============================================================================
// Duplicate-phone diagnostics for the STOP opt-out flow.
// ----------------------------------------------------------------------------
// The STOP webhook (server/twilioStopOptOut.ts -> resolveOptOutUserIdPure)
// refuses to opt anyone out when 2+ users share the same users.phone_e164,
// so we don't silently unsubscribe the wrong account. That safety means
// affected users CANNOT opt out by texting STOP until support cleans the
// duplicate.
//
// This module powers the admin diagnostic that surfaces those duplicates,
// plus the support tool to clear the wrong account's phone_e164. The pure
// grouper is split out so it can be unit-tested without the database.
// ============================================================================

import { logger } from "../lib/logger";

export interface DuplicatePhoneUserRow {
  id: string;
  phoneE164: string | null;
  email?: string | null;
  username?: string | null;
  name?: string | null;
  lastActiveAt?: string | null;
}

export interface DuplicatePhoneGroup {
  phoneE164: string;
  userCount: number;
  users: DuplicatePhoneUserRow[];
}

/**
 * Pure grouper: given user rows with a phoneE164, return one group per
 * phone number that is shared by 2+ users. Within each group, users are
 * ordered by lastActiveAt DESC (most recent first; nulls last) so support
 * can quickly tell which account is the "real" one. Groups are ordered
 * by userCount DESC so the worst offenders bubble to the top.
 *
 * Empty / null phoneE164 values are ignored — they aren't shared, they're
 * just unset.
 */
export function groupDuplicatePhones(
  rows: DuplicatePhoneUserRow[],
): DuplicatePhoneGroup[] {
  const byPhone = new Map<string, DuplicatePhoneUserRow[]>();
  for (const row of rows) {
    const phone = (row.phoneE164 || "").trim();
    if (!phone) continue;
    const bucket = byPhone.get(phone);
    if (bucket) {
      bucket.push(row);
    } else {
      byPhone.set(phone, [row]);
    }
  }

  const groups: DuplicatePhoneGroup[] = [];
  for (const [phone, users] of Array.from(byPhone.entries())) {
    if (users.length < 2) continue;
    const sorted = [...users].sort((a, b) => {
      const aT = a.lastActiveAt || "";
      const bT = b.lastActiveAt || "";
      if (aT === bT) return a.id.localeCompare(b.id);
      // Empty strings sort last (oldest/unknown).
      if (!aT) return 1;
      if (!bT) return -1;
      return bT.localeCompare(aT);
    });
    groups.push({ phoneE164: phone, userCount: sorted.length, users: sorted });
  }

  groups.sort((a, b) => {
    if (b.userCount !== a.userCount) return b.userCount - a.userCount;
    return a.phoneE164.localeCompare(b.phoneE164);
  });

  return groups;
}

/**
 * Live DB query that returns every users row whose phone_e164 collides
 * with at least one other user. Bounded fetch (cap 500 phone groups) so
 * a runaway query can't blow up the admin dashboard.
 */
export async function loadDuplicatePhoneGroups(): Promise<DuplicatePhoneGroup[]> {
  const { users } = await import("@shared/schema");
  const { db } = await import("../db");
  const { sql, inArray } = await import("drizzle-orm");

  // Step 1: find phone numbers shared by 2+ users.
  const dupPhoneRows = await db
    .select({
      phoneE164: users.phoneE164,
      c: sql<number>`count(*)::int`,
    })
    .from(users)
    .where(sql`${users.phoneE164} IS NOT NULL AND ${users.phoneE164} <> ''`)
    .groupBy(users.phoneE164)
    .having(sql`count(*) > 1`)
    .limit(500);

  if (dupPhoneRows.length === 0) return [];

  const phones = dupPhoneRows.map((r) => r.phoneE164!).filter(Boolean);

  // Step 2: hydrate user rows for those phones.
  const userRows = await db
    .select({
      id: users.id,
      phoneE164: users.phoneE164,
      email: users.email,
      username: users.username,
      name: users.name,
      lastActiveAt: users.lastActiveAt,
    })
    .from(users)
    .where(inArray(users.phoneE164, phones));

  logger.info(
    `[Admin SMS Duplicate Phones] ${dupPhoneRows.length} colliding phone(s) covering ${userRows.length} user row(s)`,
  );

  return groupDuplicatePhones(userRows);
}
