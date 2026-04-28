/**
 * End-to-end coverage for GET /api/sms/rate-limited-recent — the endpoint
 * that powers the "SMS activity" panel in Settings (SmsActivityPanel.tsx)
 * which surfaces texts we held back because the user hit the 24h SMS cap.
 *
 * What this guards:
 *   1. Only outbound_messages rows that are simultaneously
 *        channel='sms' AND status='canceled' AND failure_reason='rate_limited'
 *      are returned. Drop any of those filters and the panel stops being
 *      a "held back" view (see server/routes.ts, GET /api/sms/rate-limited-recent).
 *   2. Only rows whose canceled_at falls within the trailing 7 days.
 *   3. Only rows belonging to the authenticated user — no cross-tenant leakage.
 *   4. Newest first (ORDER BY canceled_at DESC).
 *   5. The select projection still includes the fields the React component
 *      reads (id, type, channel, toAddress, scheduledFor, canceledAt). If
 *      one is dropped server-side the panel silently breaks; this test
 *      catches that.
 *
 * The route requires an authenticated request AND DB access to seed
 * outbound_messages directly, so this suite is gated on both DATABASE_URL
 * and the dev server being reachable. When either is unavailable Jest
 * skips the suite (matching the pattern in firstBookingNudges /
 * outboundMessagesUniqueIndex).
 */

import { apiRequest, createTestUser, getAuthToken } from "./setup";
import { ns } from "../utils/testNamespace";

const HAS_DB = !!process.env.DATABASE_URL;
const d = HAS_DB ? describe : describe.skip;

interface RateLimitedRow {
  id: string;
  type: string;
  channel: string;
  toAddress: string;
  scheduledFor: string | null;
  canceledAt: string | null;
}

d("GET /api/sms/rate-limited-recent (Settings SMS activity panel)", () => {
  jest.setTimeout(45000);

  // Two users so we can assert tenant scoping. Suffix keeps the suite
  // re-runnable without colliding with previous DB rows.
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const userA = {
    id: ns(`sms-rl-recent-a-${suffix}`),
    name: "SMS RL Recent A",
    email: ns(`sms-rl-recent-a-${suffix}@gigaid.test`),
    plan: "free",
  };
  const userB = {
    id: ns(`sms-rl-recent-b-${suffix}`),
    name: "SMS RL Recent B",
    email: ns(`sms-rl-recent-b-${suffix}@gigaid.test`),
    plan: "free",
  };

  let tokenA: string;
  let userAId: string;
  let userBId: string;
  let pool: typeof import("../../server/db")["pool"];

  // Track every outbound_messages row we insert so the test cleans up
  // after itself even if assertions fail mid-flight.
  const insertedMessageIds: string[] = [];

  beforeAll(async () => {
    ({ pool } = await import("../../server/db"));

    const created = await createTestUser(userA);
    userAId = created.userId;
    const createdB = await createTestUser(userB);
    userBId = createdB.userId;

    tokenA = await getAuthToken(userA.id);
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
    } finally {
      client.release();
    }
  });

  async function insertOutboundMessage(opts: {
    userId: string;
    channel: "sms" | "email";
    status: string;
    failureReason: string | null;
    canceledAt: string | null;
    scheduledFor: string;
    type: string;
    toAddress: string;
  }): Promise<string> {
    const client = await pool.connect();
    try {
      const ins = await client.query(
        `INSERT INTO outbound_messages
           (user_id, channel, to_address, type, status,
            scheduled_for, canceled_at, failure_reason, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now()::text)
         RETURNING id`,
        [
          opts.userId,
          opts.channel,
          opts.toAddress,
          opts.type,
          opts.status,
          opts.scheduledFor,
          opts.canceledAt,
          opts.failureReason,
        ],
      );
      const id = ins.rows[0].id as string;
      insertedMessageIds.push(id);
      return id;
    } finally {
      client.release();
    }
  }

  it("requires authentication", async () => {
    const { status } = await apiRequest("GET", "/api/sms/rate-limited-recent");
    expect(status).toBe(401);
  });

  it(
    "returns only sms+canceled+rate_limited rows from the last 7 days, " +
      "scoped to the caller, newest first, with the projection the panel needs",
    async () => {
      const now = Date.now();
      const iso = (offsetMs: number) => new Date(now - offsetMs).toISOString();

      // (1) Caller, sms+canceled+rate_limited, 1 hour ago — IN.
      const includeNewerId = await insertOutboundMessage({
        userId: userAId,
        channel: "sms",
        status: "canceled",
        failureReason: "rate_limited",
        canceledAt: iso(60 * 60 * 1000),
        scheduledFor: iso(60 * 60 * 1000 + 5_000),
        type: "followup",
        toAddress: "+15551110001",
      });

      // (2) Caller, sms+canceled+rate_limited, 6 days ago — IN (just inside window).
      const includeOlderInWindowId = await insertOutboundMessage({
        userId: userAId,
        channel: "sms",
        status: "canceled",
        failureReason: "rate_limited",
        canceledAt: iso(6 * 24 * 60 * 60 * 1000),
        scheduledFor: iso(6 * 24 * 60 * 60 * 1000 + 5_000),
        type: "first_booking_nudge_10m",
        toAddress: "+15551110002",
      });

      // (3) Caller, sms+canceled+rate_limited, 8 days ago — OUT (older than 7 days).
      await insertOutboundMessage({
        userId: userAId,
        channel: "sms",
        status: "canceled",
        failureReason: "rate_limited",
        canceledAt: iso(8 * 24 * 60 * 60 * 1000),
        scheduledFor: iso(8 * 24 * 60 * 60 * 1000 + 5_000),
        type: "followup",
        toAddress: "+15551110003",
      });

      // (4) Caller, sms+canceled but a different failure_reason — OUT.
      // (e.g. action_taken / opted_out / no_provider — none of these are
      // "we held it back because you hit your daily safety limit".)
      await insertOutboundMessage({
        userId: userAId,
        channel: "sms",
        status: "canceled",
        failureReason: "action_taken",
        canceledAt: iso(2 * 60 * 60 * 1000),
        scheduledFor: iso(2 * 60 * 60 * 1000 + 5_000),
        type: "first_booking_nudge_10m",
        toAddress: "+15551110004",
      });

      // (5) Caller, sms but status='sent' (rate_limited would be nonsensical
      // here, but it asserts the status filter is real) — OUT.
      await insertOutboundMessage({
        userId: userAId,
        channel: "sms",
        status: "sent",
        failureReason: null,
        canceledAt: null,
        scheduledFor: iso(60 * 60 * 1000),
        type: "followup",
        toAddress: "+15551110005",
      });

      // (6) Caller, email channel + canceled + rate_limited — OUT
      // (panel is scoped to SMS; email can't hit the SMS cap).
      await insertOutboundMessage({
        userId: userAId,
        channel: "email",
        status: "canceled",
        failureReason: "rate_limited",
        canceledAt: iso(30 * 60 * 1000),
        scheduledFor: iso(30 * 60 * 1000 + 5_000),
        type: "first_booking_email_2h",
        toAddress: "rl-recent@example.com",
      });

      // (7) DIFFERENT user, sms+canceled+rate_limited, 1 hour ago — OUT
      // (must not leak across the userId scope).
      await insertOutboundMessage({
        userId: userBId,
        channel: "sms",
        status: "canceled",
        failureReason: "rate_limited",
        canceledAt: iso(60 * 60 * 1000),
        scheduledFor: iso(60 * 60 * 1000 + 5_000),
        type: "followup",
        toAddress: "+15552220001",
      });

      const { status, data } = await apiRequest(
        "GET",
        "/api/sms/rate-limited-recent",
        undefined,
        tokenA,
      );

      expect(status).toBe(200);
      expect(data).toHaveProperty("messages");
      expect(Array.isArray(data.messages)).toBe(true);

      const rows = data.messages as RateLimitedRow[];
      const ids = rows.map((r) => r.id);

      // Both eligible rows are present.
      expect(ids).toContain(includeNewerId);
      expect(ids).toContain(includeOlderInWindowId);

      // None of the excluded rows are present (filtering on the IDs we
      // know we just seeded so we don't fight with whatever else might
      // already exist in the table for these test users).
      const seededIds = new Set(insertedMessageIds);
      const ourReturnedRows = rows.filter((r) => seededIds.has(r.id));
      expect(ourReturnedRows.map((r) => r.id).sort()).toEqual(
        [includeNewerId, includeOlderInWindowId].sort(),
      );

      // Newest first: the 1-hour-ago row must precede the 6-day-old row
      // among the rows we seeded. We compare positions in the unfiltered
      // result because that's the order the API returned.
      const idxNewer = ids.indexOf(includeNewerId);
      const idxOlder = ids.indexOf(includeOlderInWindowId);
      expect(idxNewer).toBeGreaterThanOrEqual(0);
      expect(idxOlder).toBeGreaterThanOrEqual(0);
      expect(idxNewer).toBeLessThan(idxOlder);

      // The select projection must still carry every field the React
      // panel reads. Drop one server-side and the panel silently breaks.
      const sample = ourReturnedRows[0];
      expect(sample).toHaveProperty("id");
      expect(sample).toHaveProperty("type");
      expect(sample).toHaveProperty("channel");
      expect(sample).toHaveProperty("toAddress");
      expect(sample).toHaveProperty("scheduledFor");
      expect(sample).toHaveProperty("canceledAt");
      expect(sample.channel).toBe("sms");

      // canceledAt is what the panel sorts/displays by; it must be a
      // non-null ISO-ish string (the DB stores text but the route
      // returns the column verbatim).
      for (const r of ourReturnedRows) {
        expect(typeof r.canceledAt).toBe("string");
        expect(r.canceledAt!.length).toBeGreaterThan(0);
      }
    },
  );

  it("returns an empty messages array when the user has no held-back SMS", async () => {
    // userB has zero rate_limited rows (the one we seeded for tenant
    // isolation belongs to userA's perspective: from userB's perspective
    // we only inserted that one row, but it would already be excluded by
    // failure_reason / channel for userA. From userB's perspective, the
    // row IS sms+canceled+rate_limited+recent — so for the empty-state
    // test we use a brand new third user instead.
    const userC = {
      id: ns(`sms-rl-recent-c-${suffix}`),
      name: "SMS RL Recent C",
      email: ns(`sms-rl-recent-c-${suffix}@gigaid.test`),
      plan: "free",
    };
    await createTestUser(userC);
    const tokenC = await getAuthToken(userC.id);

    const { status, data } = await apiRequest(
      "GET",
      "/api/sms/rate-limited-recent",
      undefined,
      tokenC,
    );

    expect(status).toBe(200);
    expect(data).toEqual({ messages: [] });
  });
});
