import {
  createTestUser,
  createSuiteUsers,
  resetTestData,
} from "./setup";
import { TEST_BASE_URL } from "../utils/env";
import { ns } from "../utils/testNamespace";

/**
 * Task #62: Twilio inbound STOP handler audits *every* delivery to
 * `sms_optout_events` — matched, unmatched, ambiguous — so admin SMS
 * Health can surface unattributed opt-outs without grepping logs.
 *
 * These tests POST to the live /api/twilio/inbound endpoint and assert
 * the row that lands in `sms_optout_events` has the right resolution
 * and identifying fields (masked phone, userId, body, twilioSid).
 *
 * Runtime requirements (enforced loudly in beforeAll, never silently
 * skipped — see tests/README.md "SMS opt-out suite runtime requirements"):
 *   - process.env.DATABASE_URL must be set
 *   - The dev server must be reachable at TEST_BASE_URL
 */
async function assertRuntime(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "[smsOptOutEventsAudit] DATABASE_URL is not set. This suite reads/writes " +
        "the users + sms_optout_events tables. Configure DATABASE_URL before " +
        "running --selectProjects api.",
    );
  }
  try {
    const res = await fetch(`${TEST_BASE_URL}/api/health`, { method: "GET" });
    if (!res.ok) {
      throw new Error(`status ${res.status}`);
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(
      `[smsOptOutEventsAudit] Dev server not reachable at ${TEST_BASE_URL}/api/health ` +
        `(${reason}). Start the 'Start application' workflow before running this suite.`,
    );
  }
}

async function postTwilioInbound(body: Record<string, string>) {
  const form = new URLSearchParams(body);
  const res = await fetch(`${TEST_BASE_URL}/api/twilio/inbound`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const text = await res.text();
  return { status: res.status, text };
}

async function resolveRealUserId(username: string): Promise<string> {
  const { db } = await import("../../server/db");
  const { users } = await import("@shared/schema");
  const { eq } = await import("drizzle-orm");
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  if (!rows[0]) throw new Error(`Test user not found by username: ${username}`);
  return rows[0].id;
}

async function setUserPhoneE164(userId: string, phone: string | null) {
  const { db } = await import("../../server/db");
  const { users } = await import("@shared/schema");
  const { eq } = await import("drizzle-orm");
  await db.update(users).set({ phoneE164: phone }).where(eq(users.id, userId));
}

interface OptOutEventRow {
  id: string;
  fromPhoneMasked: string;
  fromPhoneRaw: string;
  userId: string | null;
  resolution: string;
  body: string | null;
  twilioSid: string | null;
}

async function findOptOutEventByTwilioSid(twilioSid: string): Promise<OptOutEventRow | null> {
  const { db } = await import("../../server/db");
  const { smsOptOutEvents } = await import("@shared/schema");
  const { eq } = await import("drizzle-orm");
  const rows = await db
    .select({
      id: smsOptOutEvents.id,
      fromPhoneMasked: smsOptOutEvents.fromPhoneMasked,
      fromPhoneRaw: smsOptOutEvents.fromPhoneRaw,
      userId: smsOptOutEvents.userId,
      resolution: smsOptOutEvents.resolution,
      body: smsOptOutEvents.body,
      twilioSid: smsOptOutEvents.twilioSid,
    })
    .from(smsOptOutEvents)
    .where(eq(smsOptOutEvents.twilioSid, twilioSid))
    .limit(1);
  return (rows[0] as OptOutEventRow | undefined) ?? null;
}

async function deleteOptOutEventsByPhone(phone: string): Promise<void> {
  const { db } = await import("../../server/db");
  const { smsOptOutEvents } = await import("@shared/schema");
  const { eq } = await import("drizzle-orm");
  await db.delete(smsOptOutEvents).where(eq(smsOptOutEvents.fromPhoneRaw, phone));
}

/** Derive a stable but namespace-unique +1555XXXXXXX phone from a label. */
function namespacedPhone(label: string): string {
  const seed = ns(label);
  const hash = Math.abs(
    seed.split("").reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0),
  )
    .toString()
    .padStart(7, "0")
    .slice(0, 7);
  return `+1555${hash}`;
}

describe("Task #62: STOP audit table records every delivery", () => {
  jest.setTimeout(30000);

  const { userA, userB } = createSuiteUsers("smsoptoutaudit");
  const matchedPhone = namespacedPhone("matched");
  const unmatchedPhone = namespacedPhone("unmatched");
  const ambiguousPhone = namespacedPhone("ambiguous");
  let userAId: string;
  let userBId: string;

  beforeAll(async () => {
    await assertRuntime();
    await createTestUser(userA);
    await createTestUser(userB);
    userAId = await resolveRealUserId(userA.id);
    userBId = await resolveRealUserId(userB.id);
  });

  afterAll(async () => {
    if (userAId) await setUserPhoneE164(userAId, null);
    if (userBId) await setUserPhoneE164(userBId, null);
    await deleteOptOutEventsByPhone(matchedPhone);
    await deleteOptOutEventsByPhone(unmatchedPhone);
    await deleteOptOutEventsByPhone(ambiguousPhone);
    if (process.env.DATABASE_URL) {
      await resetTestData(userA.id);
      await resetTestData(userB.id);
    }
  });

  beforeEach(async () => {
    await deleteOptOutEventsByPhone(matchedPhone);
    await deleteOptOutEventsByPhone(unmatchedPhone);
    await deleteOptOutEventsByPhone(ambiguousPhone);
    // Default state: only userA owns matchedPhone, neither user owns the others.
    await setUserPhoneE164(userAId, matchedPhone);
    await setUserPhoneE164(userBId, null);
  });

  it("matched: STOP from a uniquely-owned phone records resolution=matched with userId", async () => {
    const sid = `SM_audit_matched_${Date.now()}`;
    const { status, text } = await postTwilioInbound({
      From: matchedPhone,
      Body: "STOP",
      MessageSid: sid,
    });
    expect(status).toBe(200);
    expect(text).toContain("<Response>");

    const row = await findOptOutEventByTwilioSid(sid);
    expect(row).not.toBeNull();
    expect(row!.resolution).toBe("matched");
    expect(row!.userId).toBe(userAId);
    expect(row!.fromPhoneRaw).toBe(matchedPhone);
    // Masked rendering must NOT contain the middle digits in the clear.
    expect(row!.fromPhoneMasked).toMatch(/\*\*\*/);
    expect(row!.fromPhoneMasked).not.toBe(matchedPhone);
    expect(row!.body).toBe("STOP");
    expect(row!.twilioSid).toBe(sid);
  });

  it("unmatched: STOP from a phone no user owns still records a row with resolution=unmatched", async () => {
    const sid = `SM_audit_unmatched_${Date.now()}`;
    const { status } = await postTwilioInbound({
      From: unmatchedPhone,
      Body: "STOP",
      MessageSid: sid,
    });
    expect(status).toBe(200);

    const row = await findOptOutEventByTwilioSid(sid);
    expect(row).not.toBeNull();
    expect(row!.resolution).toBe("unmatched");
    expect(row!.userId).toBeNull();
    expect(row!.fromPhoneRaw).toBe(unmatchedPhone);
    expect(row!.fromPhoneMasked).toMatch(/\*\*\*/);
    expect(row!.body).toBe("STOP");
    expect(row!.twilioSid).toBe(sid);
  });

  it("ambiguous: STOP from a phone shared by 2+ users records resolution=ambiguous and userId=null", async () => {
    // Force a phone collision between userA and userB on phone_e164.
    await setUserPhoneE164(userAId, ambiguousPhone);
    await setUserPhoneE164(userBId, ambiguousPhone);

    const sid = `SM_audit_ambiguous_${Date.now()}`;
    const { status } = await postTwilioInbound({
      From: ambiguousPhone,
      Body: "STOP",
      MessageSid: sid,
    });
    expect(status).toBe(200);

    const row = await findOptOutEventByTwilioSid(sid);
    expect(row).not.toBeNull();
    expect(row!.resolution).toBe("ambiguous");
    // Critical: ambiguity must NEVER silently pin one user.
    expect(row!.userId).toBeNull();
    expect(row!.fromPhoneRaw).toBe(ambiguousPhone);
    expect(row!.body).toBe("STOP");
    expect(row!.twilioSid).toBe(sid);
  });

  it("captures the keyword variant in body so operators can tell STOPALL/UNSUBSCRIBE/CANCEL apart", async () => {
    const sid = `SM_audit_variant_${Date.now()}`;
    await postTwilioInbound({
      From: matchedPhone,
      Body: "UNSUBSCRIBE",
      MessageSid: sid,
    });
    const row = await findOptOutEventByTwilioSid(sid);
    expect(row).not.toBeNull();
    expect(row!.body).toBe("UNSUBSCRIBE");
    expect(row!.resolution).toBe("matched");
  });

  it("trims surrounding whitespace and stores the canonical body for case-mixed STOPs", async () => {
    const sid = `SM_audit_trim_${Date.now()}`;
    // Twilio rarely sends padded keywords, but the handler is documented to
    // tolerate them. The audit row should not record the leading/trailing
    // whitespace either, so SMS Health can group identical opt-outs.
    await postTwilioInbound({
      From: matchedPhone,
      Body: "  stop  ",
      MessageSid: sid,
    });
    const row = await findOptOutEventByTwilioSid(sid);
    expect(row).not.toBeNull();
    expect(row!.body).not.toBeNull();
    expect(row!.body!.startsWith(" ")).toBe(false);
    expect(row!.body!.endsWith(" ")).toBe(false);
    expect(row!.body!.length).toBeLessThanOrEqual(30);
    expect(row!.resolution).toBe("matched");
  });
});
