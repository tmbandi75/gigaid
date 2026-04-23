import {
  apiRequest,
  createTestUser,
  createSuiteUsers,
  getAuthToken,
  resetTestData,
} from "./setup";
import { TEST_BASE_URL } from "../utils/env";
import { ns } from "../utils/testNamespace";

const STOP_REPLY_BODY =
  "You're unsubscribed from GigAid messages. No more texts will be sent.";
const START_REPLY_BODY =
  "You're re-subscribed to GigAid messages. Reply STOP at any time to opt out.";

const STOP_KEYWORDS = ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL"] as const;
const START_KEYWORDS = ["START", "UNSTOP"] as const;

/**
 * Runtime requirements (enforced in beforeAll, not silently skipped):
 *   - process.env.DATABASE_URL must be set (suite reads/writes the users table)
 *   - The dev server must be reachable at TEST_BASE_URL (suite POSTs to
 *     /api/twilio/inbound and /api/profile/sms/resume)
 *
 * Previously this suite used `describe.skip` when DATABASE_URL was missing,
 * which silently no-op'd the regression net on CI. We now fail loudly so a
 * misconfigured CI run surfaces as a red build instead of a green "0 tests".
 *
 * See tests/README.md "SMS opt-out suite runtime requirements".
 */
async function assertSmsOptOutRuntime(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "[smsOptOut] DATABASE_URL is not set. This suite requires a Postgres " +
        "connection to read/write the users table. Configure DATABASE_URL in " +
        "the CI environment before running --selectProjects api.",
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
      `[smsOptOut] Dev server not reachable at ${TEST_BASE_URL}/api/health ` +
        `(${reason}). Start the 'Start application' workflow (npm run dev) ` +
        `before running this suite, or set TEST_BASE_URL to point at a ` +
        `running instance.`,
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

async function setUserSmsOptOut(userId: string, optOut: boolean) {
  const { db } = await import("../../server/db");
  const { users } = await import("@shared/schema");
  const { eq } = await import("drizzle-orm");
  await db
    .update(users)
    .set({
      smsOptOut: optOut,
      smsOptOutAt: optOut ? new Date().toISOString() : null,
      notifyBySms: !optOut,
    })
    .where(eq(users.id, userId));
}

async function readUserOptOutState(userId: string) {
  const { db } = await import("../../server/db");
  const { users } = await import("@shared/schema");
  const { eq } = await import("drizzle-orm");
  const rows = await db
    .select({
      smsOptOut: users.smsOptOut,
      smsOptOutAt: users.smsOptOutAt,
      notifyBySms: users.notifyBySms,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0];
}

async function countInboundSmsMessagesForUser(userId: string) {
  const { db } = await import("../../server/db");
  const { smsMessages } = await import("@shared/schema");
  const { eq, and } = await import("drizzle-orm");
  const rows = await db
    .select({ id: smsMessages.id, body: smsMessages.body })
    .from(smsMessages)
    .where(
      and(eq(smsMessages.userId, userId), eq(smsMessages.direction, "inbound")),
    );
  return rows;
}

describe("Task #51: STOP/START opt-out webhook + resume endpoint", () => {
  jest.setTimeout(30000);

  const { userA } = createSuiteUsers("smsoptout");
  // Use a phone unique per test-run namespace so concurrent runs don't collide.
  const phone = `+1555${Math.abs(
    ns("phone").split("").reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0),
  )
    .toString()
    .padStart(7, "0")
    .slice(0, 7)}`;
  let token: string;
  let realUserId: string;

  beforeAll(async () => {
    await assertSmsOptOutRuntime();
    await createTestUser(userA);
    token = await getAuthToken(userA.id);
    realUserId = await resolveRealUserId(userA.id);
    await setUserPhoneE164(realUserId, phone);
  });

  afterAll(async () => {
    // Guard against beforeAll having failed before realUserId was resolved
    // (e.g. when assertSmsOptOutRuntime() throws on a misconfigured CI run).
    if (realUserId) {
      await setUserPhoneE164(realUserId, null);
    }
    if (process.env.DATABASE_URL) {
      await resetTestData(userA.id);
    }
  });

  beforeEach(async () => {
    await resetTestData(userA.id);
    await setUserPhoneE164(realUserId, phone);
    await setUserSmsOptOut(realUserId, false);
  });

  describe("STOP keywords flip smsOptOut and reply with TwiML confirmation", () => {
    it.each(STOP_KEYWORDS)(
      "%s: sets smsOptOut=true, notifyBySms=false, returns STOP TwiML",
      async (keyword) => {
        const { status, text } = await postTwilioInbound({
          From: phone,
          Body: keyword,
          MessageSid: `SM_test_${keyword}_${Date.now()}`,
        });
        expect(status).toBe(200);
        expect(text).toContain("<?xml");
        expect(text).toContain("<Response>");
        expect(text).toContain("<Message>");
        expect(text).toContain(STOP_REPLY_BODY);

        const state = await readUserOptOutState(realUserId);
        expect(state.smsOptOut).toBe(true);
        expect(state.smsOptOutAt).not.toBeNull();
        expect(state.notifyBySms).toBe(false);
      },
    );

    it("is case-insensitive and tolerates whitespace ('  stop  ')", async () => {
      const { status, text } = await postTwilioInbound({
        From: phone,
        Body: "  stop  ",
        MessageSid: `SM_test_lower_${Date.now()}`,
      });
      expect(status).toBe(200);
      expect(text).toContain(STOP_REPLY_BODY);
      const state = await readUserOptOutState(realUserId);
      expect(state.smsOptOut).toBe(true);
    });

    it("does NOT persist the STOP reply as an inbound sms_messages row", async () => {
      await postTwilioInbound({
        From: phone,
        Body: "STOP",
        MessageSid: `SM_test_no_store_${Date.now()}`,
      });
      const rows = await countInboundSmsMessagesForUser(realUserId);
      expect(rows).toHaveLength(0);
    });
  });

  describe("START keywords clear smsOptOut and reply with TwiML re-subscribe", () => {
    beforeEach(async () => {
      await setUserSmsOptOut(realUserId, true);
    });

    it.each(START_KEYWORDS)(
      "%s: clears smsOptOut + smsOptOutAt, restores notifyBySms, returns START TwiML",
      async (keyword) => {
        const { status, text } = await postTwilioInbound({
          From: phone,
          Body: keyword,
          MessageSid: `SM_test_start_${keyword}_${Date.now()}`,
        });
        expect(status).toBe(200);
        expect(text).toContain(START_REPLY_BODY);

        const state = await readUserOptOutState(realUserId);
        expect(state.smsOptOut).toBe(false);
        expect(state.smsOptOutAt).toBeNull();
        expect(state.notifyBySms).toBe(true);
      },
    );

    it("does NOT persist the START reply as an inbound sms_messages row", async () => {
      await postTwilioInbound({
        From: phone,
        Body: "START",
        MessageSid: `SM_test_start_no_store_${Date.now()}`,
      });
      const rows = await countInboundSmsMessagesForUser(realUserId);
      expect(rows).toHaveLength(0);
    });
  });

  describe("START when user is NOT opted out falls through to normal routing", () => {
    it("does not emit the START TwiML body when there's nothing to re-subscribe", async () => {
      // smsOptOut already false from beforeEach.
      const { status, text } = await postTwilioInbound({
        From: phone,
        Body: "START",
        MessageSid: `SM_test_start_noop_${Date.now()}`,
      });
      expect(status).toBe(200);
      expect(text).not.toContain(START_REPLY_BODY);
      const state = await readUserOptOutState(realUserId);
      expect(state.smsOptOut).toBe(false);
    });
  });

  describe("POST /api/profile/sms/resume", () => {
    it("clears smsOptOut and smsOptOutAt for an opted-out user (happy path)", async () => {
      await setUserSmsOptOut(realUserId, true);

      const { status, data } = await apiRequest(
        "POST",
        "/api/profile/sms/resume",
        {},
        token,
      );
      expect(status).toBe(200);
      expect(data).toMatchObject({
        success: true,
        smsOptOut: false,
        smsOptOutAt: null,
      });

      const state = await readUserOptOutState(realUserId);
      expect(state.smsOptOut).toBe(false);
      expect(state.smsOptOutAt).toBeNull();
      expect(state.notifyBySms).toBe(true);
    });

    it("is a no-op when the user is already subscribed (no DB changes, still 200)", async () => {
      // Already not opted out. Capture pre-state.
      const before = await readUserOptOutState(realUserId);
      expect(before.smsOptOut).toBe(false);

      const { status, data } = await apiRequest(
        "POST",
        "/api/profile/sms/resume",
        {},
        token,
      );
      expect(status).toBe(200);
      expect(data).toMatchObject({
        success: true,
        smsOptOut: false,
        smsOptOutAt: null,
      });

      const after = await readUserOptOutState(realUserId);
      expect(after.smsOptOut).toBe(false);
      expect(after.smsOptOutAt).toBeNull();
    });

    it("requires authentication", async () => {
      const { status } = await apiRequest("POST", "/api/profile/sms/resume", {});
      expect(status).toBe(401);
    });
  });
});
