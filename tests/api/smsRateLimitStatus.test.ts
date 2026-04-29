/**
 * End-to-end coverage for GET /api/sms/rate-limit-status — the endpoint
 * that powers the "X of Y SMS sent today" disclosure surfaced inside the
 * Auto Follow-Ups screen and Settings → SMS activity panel
 * (SmsRateLimitStatus.tsx).
 *
 * What this guards:
 *   1. Auth required — anonymous callers cannot peek at usage.
 *   2. The reported `cap` mirrors what `resolveSmsRateLimit` returns for
 *      the user's plan. A free user sees the free-tier cap; a Business
 *      user sees `unlimited: true` with `cap: null`.
 *   3. A per-user override on userAutomationSettings.sms_rate_limit_per_24h_override
 *      beats the plan default (positive value = explicit cap, <=0 = unlimited).
 *   4. The reported `used` count reflects the sent-SMS rows in the rolling
 *      24h window — and is scoped to the caller (no cross-tenant leakage).
 *      Older "sent" rows or sent rows from other users do not bleed in.
 *
 * Gated on DATABASE_URL + the dev server like the other smsRateLimited*
 * suites. Skips cleanly when either is unavailable.
 */

import { apiRequest, createTestUser, getAuthToken } from "./setup";
import { ns } from "../utils/testNamespace";
import { SMS_RATE_LIMIT_PER_24H } from "../../server/postJobMomentum";

const HAS_DB = !!process.env.DATABASE_URL;
const d = HAS_DB ? describe : describe.skip;

interface StatusResponse {
  used: number;
  cap: number | null;
  unlimited: boolean;
}

d("GET /api/sms/rate-limit-status (Auto Follow-Ups daily limit disclosure)", () => {
  jest.setTimeout(45000);

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const userFree = {
    id: ns(`sms-rl-status-free-${suffix}`),
    name: "SMS RL Status Free",
    email: ns(`sms-rl-status-free-${suffix}@gigaid.test`),
    plan: "free",
  };
  const userBusiness = {
    id: ns(`sms-rl-status-biz-${suffix}`),
    name: "SMS RL Status Business",
    email: ns(`sms-rl-status-biz-${suffix}@gigaid.test`),
    plan: "business",
  };
  const userOverride = {
    id: ns(`sms-rl-status-over-${suffix}`),
    name: "SMS RL Status Override",
    email: ns(`sms-rl-status-over-${suffix}@gigaid.test`),
    plan: "free",
  };
  const userOther = {
    id: ns(`sms-rl-status-other-${suffix}`),
    name: "SMS RL Status Other",
    email: ns(`sms-rl-status-other-${suffix}@gigaid.test`),
    plan: "free",
  };

  let tokenFree: string;
  let tokenBusiness: string;
  let tokenOverride: string;
  let userFreeId: string;
  let userOverrideId: string;
  let userOtherId: string;
  let pool: typeof import("../../server/db")["pool"];

  const insertedMessageIds: string[] = [];

  beforeAll(async () => {
    ({ pool } = await import("../../server/db"));

    userFreeId = (await createTestUser(userFree)).userId;
    await createTestUser(userBusiness);
    userOverrideId = (await createTestUser(userOverride)).userId;
    userOtherId = (await createTestUser(userOther)).userId;

    tokenFree = await getAuthToken(userFree.id);
    tokenBusiness = await getAuthToken(userBusiness.id);
    tokenOverride = await getAuthToken(userOverride.id);
  });

  afterAll(async () => {
    if (!HAS_DB) return;
    const client = await pool.connect();
    try {
      if (insertedMessageIds.length > 0) {
        await client.query(
          `DELETE FROM outbound_messages WHERE id = ANY($1::text[])`,
          [insertedMessageIds],
        );
      }
      // Clean up the override row we set so the test is repeatable.
      await client.query(
        `DELETE FROM user_automation_settings WHERE user_id = $1`,
        [userOverrideId],
      );
    } finally {
      client.release();
    }
  });

  async function insertSentSms(opts: {
    userId: string;
    sentAt: string;
    toAddress: string;
  }): Promise<string> {
    const client = await pool.connect();
    try {
      const ins = await client.query(
        `INSERT INTO outbound_messages
           (user_id, channel, to_address, type, status,
            scheduled_for, sent_at, created_at)
         VALUES ($1, 'sms', $2, 'followup', 'sent',
                 $3, $3, now()::text)
         RETURNING id`,
        [opts.userId, opts.toAddress, opts.sentAt],
      );
      const id = ins.rows[0].id as string;
      insertedMessageIds.push(id);
      return id;
    } finally {
      client.release();
    }
  }

  async function setOverride(userId: string, override: number | null) {
    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO user_automation_settings (user_id, sms_rate_limit_per_24h_override)
         VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE
           SET sms_rate_limit_per_24h_override = EXCLUDED.sms_rate_limit_per_24h_override`,
        [userId, override],
      );
    } finally {
      client.release();
    }
  }

  it("requires authentication", async () => {
    const { status } = await apiRequest("GET", "/api/sms/rate-limit-status");
    expect(status).toBe(401);
  });

  it("free-plan user sees the free-tier cap and a usage count scoped to them", async () => {
    const now = Date.now();
    const iso = (offsetMs: number) => new Date(now - offsetMs).toISOString();

    // Two recent (within 24h) SMS for the caller — should both count.
    await insertSentSms({
      userId: userFreeId,
      sentAt: iso(60 * 60 * 1000),
      toAddress: "+15551112201",
    });
    await insertSentSms({
      userId: userFreeId,
      sentAt: iso(2 * 60 * 60 * 1000),
      toAddress: "+15551112202",
    });

    // One stale SMS (>24h) — must NOT count toward the rolling window.
    await insertSentSms({
      userId: userFreeId,
      sentAt: iso(48 * 60 * 60 * 1000),
      toAddress: "+15551112203",
    });

    // One recent SMS belonging to a DIFFERENT user — must NOT leak in.
    await insertSentSms({
      userId: userOtherId,
      sentAt: iso(30 * 60 * 1000),
      toAddress: "+15551112204",
    });

    const { status, data } = await apiRequest(
      "GET",
      "/api/sms/rate-limit-status",
      undefined,
      tokenFree,
    );

    expect(status).toBe(200);
    const body = data as StatusResponse;
    expect(body.unlimited).toBe(false);
    expect(body.cap).toBe(SMS_RATE_LIMIT_PER_24H);
    expect(body.used).toBe(2);
  });

  it("business-plan user is reported as unlimited (cap: null, unlimited: true)", async () => {
    const { status, data } = await apiRequest(
      "GET",
      "/api/sms/rate-limit-status",
      undefined,
      tokenBusiness,
    );

    expect(status).toBe(200);
    const body = data as StatusResponse;
    expect(body.unlimited).toBe(true);
    expect(body.cap).toBeNull();
    expect(typeof body.used).toBe("number");
    expect(body.used).toBeGreaterThanOrEqual(0);
  });

  it("per-user override beats the plan default in the reported cap", async () => {
    // Free plan would default to SMS_RATE_LIMIT_PER_24H. Override raises to 25.
    await setOverride(userOverrideId, 25);

    const raised = await apiRequest(
      "GET",
      "/api/sms/rate-limit-status",
      undefined,
      tokenOverride,
    );
    expect(raised.status).toBe(200);
    expect((raised.data as StatusResponse).cap).toBe(25);
    expect((raised.data as StatusResponse).unlimited).toBe(false);

    // Override of 0 means "no cap" — surfaces as unlimited.
    await setOverride(userOverrideId, 0);
    const unlimited = await apiRequest(
      "GET",
      "/api/sms/rate-limit-status",
      undefined,
      tokenOverride,
    );
    expect(unlimited.status).toBe(200);
    expect((unlimited.data as StatusResponse).unlimited).toBe(true);
    expect((unlimited.data as StatusResponse).cap).toBeNull();
  });
});
