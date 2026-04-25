// Integration coverage for the booking-link share-funnel pipeline.
//
// This file exercises:
//   1. POST /api/track/booking-link-share-tap
//   2. POST /api/track/booking-link-shared       (writes the milestone +
//      a per-completion event)
//   3. POST /api/track/booking-link-copied
//   4. The shared `screen` allowlist normalization (unknown values bucket
//      to "other"; non-strings/empty bucket to "unknown")
//   5. GET  /api/admin/analytics/share-funnel    (totals, per-surface
//      breakdown, and tap → completion rate)
//
// The pure handlers live in `server/routes.ts` and the admin aggregation
// lives in `server/admin/analyticsRoutes.ts`. Together they back the
// admin "Share Funnel" report, so a UI refactor that drops one of the
// three client emissions would silently break the report. These tests
// guard against that by asserting each endpoint writes the expected row
// to events_canonical and that the admin endpoint sums them correctly.

import { TEST_BASE_URL } from "../utils/env";

const BASE_URL = TEST_BASE_URL;

const dbDescribe =
  process.env.DATABASE_URL && process.env.APP_JWT_SECRET ? describe : describe.skip;

const SUITE = `bl-share-funnel-${Date.now()}`;
const userIdA = `${SUITE}-user-a`;
const userIdB = `${SUITE}-user-b`;
const SEED_USER_ID = `${SUITE}-seed`;

dbDescribe("Booking link share-funnel tracking", () => {
  jest.setTimeout(30000);

  let userToken: string;
  let adminToken: string;
  let userARowId: string;
  let userBRowId: string;
  // Captured at the start of the suite so the cleanup step can scope
  // deletes to events emitted while this test was running. Avoids
  // touching unrelated rows even though we also filter by user_id.
  let suiteStartIso: string;

  beforeAll(async () => {
    suiteStartIso = new Date(Date.now() - 1000).toISOString();

    const { signAppJwt } = await import("../../server/appJwt");
    const { storage } = await import("../../server/storage");

    // Bootstrap admin id default is "demo-user" (see ADMIN_USER_IDS in
    // server/copilot/adminMiddleware.ts). The JWT only needs `sub` to
    // match — the bootstrap check does not require a real users row.
    adminToken = signAppJwt({ sub: "demo-user", provider: "replit" });

    // Seed real user rows so isAuthenticated's "deleted user" check
    // passes for the tracking endpoints. We use storage so all required
    // columns are populated.
    const createdA = await storage.createUser({
      username: userIdA,
      password: `bl-share-test-${Date.now()}`,
    });
    const createdB = await storage.createUser({
      username: userIdB,
      password: `bl-share-test-${Date.now() + 1}`,
    });
    userARowId = createdA.id;
    userBRowId = createdB.id;

    userToken = signAppJwt({ sub: userARowId, provider: "replit" });
  });

  afterAll(async () => {
    const { db } = await import("../../server/db");
    const { users, eventsCanonical } = await import("@shared/schema");
    const { inArray, gte, and } = await import("drizzle-orm");

    // Clean up every events_canonical row this suite emitted (real
    // tracking writes for users A/B and the directly-seeded admin rows
    // attributed to SEED_USER_ID).
    await db
      .delete(eventsCanonical)
      .where(
        and(
          inArray(eventsCanonical.userId, [userARowId, userBRowId, SEED_USER_ID]),
          gte(eventsCanonical.occurredAt, suiteStartIso),
        ),
      );

    await db.delete(users).where(inArray(users.id, [userARowId, userBRowId]));
  });

  // ----- helpers ---------------------------------------------------------

  async function trackTap(token: string, body: Record<string, any>) {
    return fetch(`${BASE_URL}/api/track/booking-link-share-tap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  }

  async function trackShared(token: string, body: Record<string, any>) {
    return fetch(`${BASE_URL}/api/track/booking-link-shared`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  }

  async function trackCopied(token: string, body: Record<string, any>) {
    return fetch(`${BASE_URL}/api/track/booking-link-copied`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  }

  async function readEventsForUser(userId: string, eventNames: string[]) {
    const { db } = await import("../../server/db");
    const { eventsCanonical } = await import("@shared/schema");
    const { and, eq, inArray, gte } = await import("drizzle-orm");

    const rows = await db
      .select({
        eventName: eventsCanonical.eventName,
        context: eventsCanonical.context,
        source: eventsCanonical.source,
        userId: eventsCanonical.userId,
        occurredAt: eventsCanonical.occurredAt,
      })
      .from(eventsCanonical)
      .where(
        and(
          eq(eventsCanonical.userId, userId),
          inArray(eventsCanonical.eventName, eventNames),
          gte(eventsCanonical.occurredAt, suiteStartIso),
        ),
      );

    return rows.map((r) => ({
      ...r,
      context: r.context ? JSON.parse(r.context) : null,
    }));
  }

  // The tracking endpoints kick off `emitCanonicalEvent` without
  // awaiting it (the response returns immediately). Poll the events
  // table briefly until the predicate matches so the assertions don't
  // race the fire-and-forget insert.
  async function waitForEvent(
    userId: string,
    eventNames: string[],
    predicate: (rows: Array<{ eventName: string; context: any; source: string; userId: string | null; occurredAt: string }>) => boolean,
    timeoutMs = 5000,
  ) {
    const start = Date.now();
    let lastRows: Awaited<ReturnType<typeof readEventsForUser>> = [];
    while (Date.now() - start < timeoutMs) {
      lastRows = await readEventsForUser(userId, eventNames);
      if (predicate(lastRows)) return lastRows;
      await new Promise((r) => setTimeout(r, 100));
    }
    return lastRows;
  }

  // ----- POST /api/track/booking-link-share-tap --------------------------

  describe("POST /api/track/booking-link-share-tap", () => {
    it("requires authentication", async () => {
      const res = await fetch(`${BASE_URL}/api/track/booking-link-share-tap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ screen: "plan" }),
      });
      expect(res.status).toBe(401);
    });

    it("writes a booking_link_share_tap event with the normalized screen", async () => {
      const res = await trackTap(userToken, { screen: "plan" });
      expect(res.status).toBe(200);
      expect((await res.json()).success).toBe(true);

      // The endpoint emits the event without awaiting the DB insert, so
      // poll briefly until the row appears.
      const rows = await waitForEvent(userARowId, ["booking_link_share_tap"], (r) =>
        r.some((row) => row.context?.screen === "plan"),
      );
      const planRow = rows.find((r) => r.context?.screen === "plan");
      expect(planRow).toBeDefined();
      expect(planRow!.eventName).toBe("booking_link_share_tap");
      expect(planRow!.source).toBe("web");
      expect(planRow!.userId).toBe(userARowId);
    });

    it("buckets unknown screens to 'other' and missing screens to 'unknown'", async () => {
      const r1 = await trackTap(userToken, { screen: "this-is-not-a-known-screen" });
      expect(r1.status).toBe(200);
      const r2 = await trackTap(userToken, {});
      expect(r2.status).toBe(200);
      const r3 = await trackTap(userToken, { screen: 12345 });
      expect(r3.status).toBe(200);

      const rows = await waitForEvent(userARowId, ["booking_link_share_tap"], (r) => {
        const screens = r.map((x) => x.context?.screen);
        return screens.includes("other") && screens.includes("unknown");
      });
      const screens = rows.map((r) => r.context?.screen);
      expect(screens).toContain("other");
      expect(screens).toContain("unknown");
    });
  });

  // ----- POST /api/track/booking-link-shared (completion + milestone) ----

  describe("POST /api/track/booking-link-shared", () => {
    it("emits the milestone + a per-completion row on the first call, only the completion on subsequent calls", async () => {
      // User B starts with no shared milestone — fresh user. Use a
      // fresh token so the milestone path runs against a user we know
      // hasn't shared yet.
      const { signAppJwt } = await import("../../server/appJwt");
      const tokenB = signAppJwt({ sub: userBRowId, provider: "replit" });

      const ok1 = await trackShared(tokenB, { method: "share_sheet", screen: "leads" });
      expect(ok1.status).toBe(200);

      const afterFirst = await waitForEvent(
        userBRowId,
        ["booking_link_shared", "booking_link_share_completed"],
        (r) => {
          const milestone = r.filter((x) => x.eventName === "booking_link_shared").length >= 1;
          const completion = r.filter((x) => x.eventName === "booking_link_share_completed").length >= 1;
          return milestone && completion;
        },
      );
      const milestoneRows = afterFirst.filter((r) => r.eventName === "booking_link_shared");
      const completionRows = afterFirst.filter((r) => r.eventName === "booking_link_share_completed");

      expect(milestoneRows.length).toBe(1);
      expect(milestoneRows[0].context).toMatchObject({
        method: "share_sheet",
        screen: "leads",
      });
      expect(milestoneRows[0].source).toBe("web");

      expect(completionRows.length).toBe(1);
      expect(completionRows[0].context).toMatchObject({
        method: "share_sheet",
        screen: "leads",
      });

      // The second completion should NOT add another milestone.
      const ok2 = await trackShared(tokenB, { method: "copy", screen: "nba" });
      expect(ok2.status).toBe(200);

      const afterSecond = await waitForEvent(
        userBRowId,
        ["booking_link_shared", "booking_link_share_completed"],
        (r) => r.filter((x) => x.eventName === "booking_link_share_completed").length >= 2,
      );
      const milestoneRows2 = afterSecond.filter((r) => r.eventName === "booking_link_shared");
      const completionRows2 = afterSecond.filter((r) => r.eventName === "booking_link_share_completed");
      expect(milestoneRows2.length).toBe(1);
      expect(completionRows2.length).toBe(2);

      // The user's bookingLinkSharedAt milestone should now be set.
      const { storage } = await import("../../server/storage");
      const refreshed = await storage.getUser(userBRowId);
      expect(refreshed?.bookingLinkSharedAt).toBeTruthy();
    });

    it("defaults method to 'unknown' when missing and normalizes the screen", async () => {
      const { signAppJwt } = await import("../../server/appJwt");
      const tokenB = signAppJwt({ sub: userBRowId, provider: "replit" });

      const res = await trackShared(tokenB, { screen: "definitely-not-a-known-screen" });
      expect(res.status).toBe(200);

      const rows = await waitForEvent(userBRowId, ["booking_link_share_completed"], (r) =>
        r.some((x) => x.context?.screen === "other" && x.context?.method === "unknown"),
      );
      const otherRow = rows.find(
        (r) => r.context?.screen === "other" && r.context?.method === "unknown",
      );
      expect(otherRow).toBeDefined();
    });

    // Task #108: capture the share target the OS told us the user picked.
    // This lets the admin share funnel break completions down by destination
    // (Messages, Mail, WhatsApp, etc.).
    it("persists the `target` field on the per-completion event when provided", async () => {
      const { signAppJwt } = await import("../../server/appJwt");
      const tokenB = signAppJwt({ sub: userBRowId, provider: "replit" });

      const res = await trackShared(tokenB, {
        method: "share",
        screen: "plan",
        target: "messages",
      });
      expect(res.status).toBe(200);

      const rows = await waitForEvent(
        userBRowId,
        ["booking_link_share_completed"],
        (r) => r.some((x) => x.context?.target === "messages"),
      );
      const messagesRow = rows.find((r) => r.context?.target === "messages");
      expect(messagesRow).toBeDefined();
      expect(messagesRow!.context).toMatchObject({
        method: "share",
        screen: "plan",
        target: "messages",
      });
    });

    it("defaults the target to 'copy' for method=copy when no target is provided", async () => {
      const { signAppJwt } = await import("../../server/appJwt");
      const tokenB = signAppJwt({ sub: userBRowId, provider: "replit" });

      const res = await trackShared(tokenB, { method: "copy", screen: "leads" });
      expect(res.status).toBe(200);

      const rows = await waitForEvent(
        userBRowId,
        ["booking_link_share_completed"],
        (r) =>
          r.some(
            (x) =>
              x.context?.method === "copy" &&
              x.context?.screen === "leads" &&
              x.context?.target === "copy",
          ),
      );
      const copyRow = rows.find(
        (r) =>
          r.context?.method === "copy" &&
          r.context?.screen === "leads" &&
          r.context?.target === "copy",
      );
      expect(copyRow).toBeDefined();
    });

    it("defaults the target to 'unknown' for method=share when no target is provided", async () => {
      const { signAppJwt } = await import("../../server/appJwt");
      const tokenB = signAppJwt({ sub: userBRowId, provider: "replit" });

      const res = await trackShared(tokenB, { method: "share", screen: "bookings" });
      expect(res.status).toBe(200);

      const rows = await waitForEvent(
        userBRowId,
        ["booking_link_share_completed"],
        (r) =>
          r.some(
            (x) =>
              x.context?.method === "share" &&
              x.context?.screen === "bookings" &&
              x.context?.target === "unknown",
          ),
      );
      const unknownRow = rows.find(
        (r) =>
          r.context?.method === "share" &&
          r.context?.screen === "bookings" &&
          r.context?.target === "unknown",
      );
      expect(unknownRow).toBeDefined();
    });
  });

  // ----- POST /api/track/booking-link-copied -----------------------------

  describe("POST /api/track/booking-link-copied", () => {
    it("writes a booking_link_copied event with the normalized screen", async () => {
      const res = await trackCopied(userToken, { screen: "nba" });
      expect(res.status).toBe(200);

      const rows = await waitForEvent(userARowId, ["booking_link_copied"], (r) =>
        r.some((x) => x.context?.screen === "nba"),
      );
      const nbaRow = rows.find((r) => r.context?.screen === "nba");
      expect(nbaRow).toBeDefined();
      expect(nbaRow!.eventName).toBe("booking_link_copied");
      expect(nbaRow!.source).toBe("web");
    });
  });

  // ----- GET /api/admin/analytics/share-funnel ---------------------------

  describe("GET /api/admin/analytics/share-funnel", () => {
    // We seed events_canonical directly so the totals are deterministic
    // even if other tests (or background jobs) emit booking_link_*
    // events while this suite is running. The endpoint groups by screen,
    // so the unique SEED_USER_ID + the unique screen names ("test_seed_*")
    // won't collide with other live data — and the assertions below only
    // look at those specific surfaces.
    const SEED_SURFACE_A = "test_seed_a";
    const SEED_SURFACE_B = "test_seed_b";

    beforeAll(async () => {
      const { db } = await import("../../server/db");
      const { eventsCanonical } = await import("@shared/schema");

      const now = new Date().toISOString();
      const rows: Array<{
        occurredAt: string;
        userId: string;
        eventName: string;
        context: string;
        source: string;
        version: number;
      }> = [];

      const push = (
        eventName: string,
        screen: string,
        count: number,
        target?: string,
      ) => {
        for (let i = 0; i < count; i++) {
          rows.push({
            occurredAt: now,
            userId: SEED_USER_ID,
            eventName,
            context: JSON.stringify({
              screen,
              method: "share_sheet",
              ...(target ? { target } : {}),
            }),
            source: "web",
            version: 1,
          });
        }
      };

      // Surface A: 4 taps, 2 completions (1 messages + 1 mail), 1 copy → 50% conversion.
      push("booking_link_share_tap", SEED_SURFACE_A, 4);
      push("booking_link_share_completed", SEED_SURFACE_A, 1, "messages");
      push("booking_link_share_completed", SEED_SURFACE_A, 1, "mail");
      push("booking_link_copied", SEED_SURFACE_A, 1, "copy");

      // Surface B: 2 taps, 2 completions (both messages), 0 copies → 100% conversion.
      push("booking_link_share_tap", SEED_SURFACE_B, 2);
      push("booking_link_share_completed", SEED_SURFACE_B, 2, "messages");

      await db.insert(eventsCanonical).values(rows);
    });

    it("requires admin auth", async () => {
      const res = await fetch(`${BASE_URL}/api/admin/analytics/share-funnel`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      // Either 401 (no auth) or 403 (auth but not admin) — both prove
      // the endpoint is gated. Without any auth we get 401.
      expect([401, 403]).toContain(res.status);
    });

    it("returns per-surface totals and tap→completion rate for the seeded surfaces", async () => {
      const res = await fetch(`${BASE_URL}/api/admin/analytics/share-funnel?days=1`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
      });
      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body).toHaveProperty("totals");
      expect(body).toHaveProperty("surfaces");
      expect(Array.isArray(body.surfaces)).toBe(true);

      const surfaceA = body.surfaces.find((s: any) => s.screen === SEED_SURFACE_A);
      const surfaceB = body.surfaces.find((s: any) => s.screen === SEED_SURFACE_B);

      expect(surfaceA).toBeDefined();
      expect(surfaceA.taps).toBe(4);
      expect(surfaceA.completions).toBe(2);
      expect(surfaceA.copies).toBe(1);
      expect(surfaceA.tapToCompletionRate).toBe(0.5);

      expect(surfaceB).toBeDefined();
      expect(surfaceB.taps).toBe(2);
      expect(surfaceB.completions).toBe(2);
      expect(surfaceB.copies).toBe(0);
      expect(surfaceB.tapToCompletionRate).toBe(1);

      // Totals for the report must include at least the rows we seeded.
      // (Other tests in this suite also emit live events, so we can only
      // assert >=, not exact equality, against the global totals.)
      expect(body.totals.taps).toBeGreaterThanOrEqual(6);
      expect(body.totals.completions).toBeGreaterThanOrEqual(4);
      expect(body.totals.copies).toBeGreaterThanOrEqual(1);
      expect(body.totals.tapToCompletionRate).toBeGreaterThan(0);
      expect(body.totals.tapToCompletionRate).toBeLessThanOrEqual(1);
    });

    // Task #108: the report should now break completions/copies down by
    // share destination so we can see whether Messages, Mail, etc. is
    // driving the most first jobs.
    it("returns a per-destination breakdown sourced from the `target` field", async () => {
      const res = await fetch(`${BASE_URL}/api/admin/analytics/share-funnel?days=1`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
      });
      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body).toHaveProperty("targets");
      expect(Array.isArray(body.targets)).toBe(true);

      const messages = body.targets.find((t: any) => t.target === "messages");
      const mail = body.targets.find((t: any) => t.target === "mail");
      const copy = body.targets.find((t: any) => t.target === "copy");

      expect(messages).toBeDefined();
      // 1 (surface A) + 2 (surface B) seeded completions.
      expect(messages.completions).toBeGreaterThanOrEqual(3);
      expect(messages.shareOfCompletions).toBeGreaterThan(0);
      expect(messages.shareOfCompletions).toBeLessThanOrEqual(1);

      expect(mail).toBeDefined();
      expect(mail.completions).toBeGreaterThanOrEqual(1);

      expect(copy).toBeDefined();
      // The seeded copy event uses the booking_link_copied event name and
      // should be tallied under the `copies` column for target=copy.
      expect(copy.copies).toBeGreaterThanOrEqual(1);
    });
  });
});
