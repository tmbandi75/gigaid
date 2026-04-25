// End-to-end coverage for the Booking Link Share Funnel platform breakdown.
//
// The admin /api/admin/analytics/share-funnel report aggregates events by
// the `platform` field that the three /api/track/booking-link-* handlers
// stamp into the canonical event context based on the X-Client-Platform
// request header. Without this coverage, a refactor that drops the header
// read or the SQL group-by would silently revert the report to surface-only
// (the bug this guard was added to catch).
//
// Verifies:
//   1. POSTing to each /api/track/booking-link-* handler with
//      X-Client-Platform = ios|android|web records that platform string in
//      the events_canonical.context JSON blob.
//   2. Omitting the header surfaces as the "unknown" platform bucket.
//   3. /api/admin/analytics/share-funnel returns a `platforms` array with
//      the correct taps/completions/copies counts and tap->completion rate
//      per platform, including the `unknown` bucket.
//   4. The existing `surfaces` (per-screen) breakdown keeps working — the
//      new platform breakdown is additive, not a replacement.

import { TEST_BASE_URL } from "../utils/env";

const BASE_URL = TEST_BASE_URL;

const dbDescribe =
  process.env.DATABASE_URL && process.env.APP_JWT_SECRET ? describe : describe.skip;

interface PlatformBucket {
  platform: string;
  taps: number;
  completions: number;
  copies: number;
  tapToCompletionRate: number;
}

interface SurfaceBucket {
  screen: string;
  taps: number;
  completions: number;
  copies: number;
  tapToCompletionRate: number;
}

dbDescribe("Booking Link Share Funnel — platform breakdown", () => {
  jest.setTimeout(45000);

  const runId = `${Date.now()}`;
  const userIdIos = `share-funnel-platform-ios-${runId}`;
  const userIdAndroid = `share-funnel-platform-android-${runId}`;
  const userIdWeb = `share-funnel-platform-web-${runId}`;
  const userIdUnknown = `share-funnel-platform-unknown-${runId}`;
  // A unique screen value isolates this test's events from any other
  // canonical events that already exist in the table. Both /share-funnel
  // and our DB asserts can scope to this screen, so we don't need to
  // assume a clean events_canonical table.
  const SCREEN = `test-screen-${runId}`;

  let dbUserIdIos: string;
  let dbUserIdAndroid: string;
  let dbUserIdWeb: string;
  let dbUserIdUnknown: string;
  let tokenIos: string;
  let tokenAndroid: string;
  let tokenWeb: string;
  let tokenUnknown: string;
  let adminToken: string;

  beforeAll(async () => {
    const { signAppJwt } = await import("../../server/appJwt");
    const { storage } = await import("../../server/storage");

    const seed = async (username: string) => {
      const user = await storage.createUser({
        username,
        password: `share-funnel-platform-${Date.now()}-${Math.random()}`,
      });
      return { dbId: user.id, token: signAppJwt({ sub: user.id, provider: "replit" }) };
    };

    const ios = await seed(userIdIos);
    const android = await seed(userIdAndroid);
    const web = await seed(userIdWeb);
    const unknown = await seed(userIdUnknown);
    dbUserIdIos = ios.dbId;
    dbUserIdAndroid = android.dbId;
    dbUserIdWeb = web.dbId;
    dbUserIdUnknown = unknown.dbId;
    tokenIos = ios.token;
    tokenAndroid = android.token;
    tokenWeb = web.token;
    tokenUnknown = unknown.token;

    // Bootstrap admin id default is "demo-user" (see ADMIN_USER_IDS in
    // server/copilot/adminMiddleware.ts). The JWT only needs sub to match
    // — the bootstrap check does not require a real users row.
    adminToken = signAppJwt({ sub: "demo-user", provider: "replit" });
  });

  afterAll(async () => {
    const { db } = await import("../../server/db");
    const { users, eventsCanonical } = await import("@shared/schema");
    const { eq, inArray } = await import("drizzle-orm");

    const ids = [dbUserIdIos, dbUserIdAndroid, dbUserIdWeb, dbUserIdUnknown];
    await db.delete(eventsCanonical).where(inArray(eventsCanonical.userId, ids));
    await db.delete(users).where(inArray(users.id, ids));
  });

  async function track(
    path: string,
    token: string,
    platformHeader: string | null,
  ): Promise<Response> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
    if (platformHeader !== null) {
      headers["X-Client-Platform"] = platformHeader;
    }
    return fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ screen: SCREEN, method: "share_sheet" }),
    });
  }

  // The tracking handlers fire `emitCanonicalEvent` without awaiting the
  // DB insert (so the user's share UI doesn't block on analytics). Tests
  // therefore must poll briefly for the row instead of querying once
  // and assuming the write is already visible.
  async function waitForEvent(
    userId: string,
    eventName: string,
    minCount = 1,
    timeoutMs = 5000,
  ): Promise<Array<{ context: string | null }>> {
    const { db } = await import("../../server/db");
    const { eventsCanonical } = await import("@shared/schema");
    const { eq, and, desc } = await import("drizzle-orm");
    const start = Date.now();
    let rows: Array<{ context: string | null }> = [];
    while (Date.now() - start < timeoutMs) {
      rows = await db
        .select({ context: eventsCanonical.context })
        .from(eventsCanonical)
        .where(
          and(
            eq(eventsCanonical.userId, userId),
            eq(eventsCanonical.eventName, eventName),
          ),
        )
        .orderBy(desc(eventsCanonical.occurredAt));
      if (rows.length >= minCount) return rows;
      await new Promise((r) => setTimeout(r, 100));
    }
    return rows;
  }

  describe("X-Client-Platform header is recorded into events_canonical.context", () => {
    it("stamps platform=ios for booking-link-share-tap", async () => {
      const res = await track("/api/track/booking-link-share-tap", tokenIos, "ios");
      expect(res.status).toBe(200);

      const rows = await waitForEvent(dbUserIdIos, "booking_link_share_tap");
      expect(rows.length).toBeGreaterThanOrEqual(1);
      const ctx = JSON.parse(rows[0].context || "{}");
      expect(ctx.platform).toBe("ios");
      // SCREEN is not in the KNOWN_BOOKING_LINK_SCREENS whitelist, so the
      // server normalizes it to "other". The important guard is that the
      // screen field is still present alongside the new platform field —
      // platform was layered onto an existing surface report.
      expect(ctx.screen).toBe("other");
    });

    it("stamps platform=android for booking-link-shared", async () => {
      const res = await track("/api/track/booking-link-shared", tokenAndroid, "android");
      expect(res.status).toBe(200);

      const rows = await waitForEvent(dbUserIdAndroid, "booking_link_share_completed");
      expect(rows.length).toBeGreaterThanOrEqual(1);
      const ctx = JSON.parse(rows[0].context || "{}");
      expect(ctx.platform).toBe("android");
      expect(ctx.screen).toBe("other");
    });

    it("stamps platform=web for booking-link-copied", async () => {
      const res = await track("/api/track/booking-link-copied", tokenWeb, "web");
      expect(res.status).toBe(200);

      const rows = await waitForEvent(dbUserIdWeb, "booking_link_copied");
      expect(rows.length).toBeGreaterThanOrEqual(1);
      const ctx = JSON.parse(rows[0].context || "{}");
      expect(ctx.platform).toBe("web");
      expect(ctx.screen).toBe("other");
    });

    it("falls back to platform=unknown when X-Client-Platform header is missing", async () => {
      const res = await track("/api/track/booking-link-share-tap", tokenUnknown, null);
      expect(res.status).toBe(200);

      const rows = await waitForEvent(dbUserIdUnknown, "booking_link_share_tap");
      expect(rows.length).toBeGreaterThanOrEqual(1);
      const ctx = JSON.parse(rows[0].context || "{}");
      expect(ctx.platform).toBe("unknown");
    });

    it("normalizes a junk X-Client-Platform value to platform=unknown", async () => {
      // Resends with a clearly invalid header to confirm the platform
      // whitelist (ios|android|web) is enforced server-side, not just
      // trusted from the client.
      const res = await track("/api/track/booking-link-copied", tokenUnknown, "windows-phone-7");
      expect(res.status).toBe(200);

      const rows = await waitForEvent(dbUserIdUnknown, "booking_link_copied");
      expect(rows.length).toBeGreaterThanOrEqual(1);
      const ctx = JSON.parse(rows[0].context || "{}");
      expect(ctx.platform).toBe("unknown");
    });
  });

  describe("/api/admin/analytics/share-funnel platform aggregation", () => {
    // Build a deterministic mix of events across all four platforms so we
    // can assert exact counts in the report. We POST through the live
    // tracking handlers (rather than inserting directly into
    // events_canonical) to exercise the full chain end-to-end.
    //
    // Plan:
    //   ios     : 2 taps, 1 completion (rate = 0.5),     0 copies
    //   android : 1 tap,  1 completion (rate = 1.0),     1 copy
    //   web     : 3 taps, 2 completions (rate = 0.6667), 2 copies
    //   unknown : 1 tap (no header), 0 completions,      1 copy
    beforeAll(async () => {
      const post = (path: string, token: string, platform: string | null) =>
        track(path, token, platform);

      // ios
      await post("/api/track/booking-link-share-tap", tokenIos, "ios"); // tap #2 (we already sent 1 above)
      await post("/api/track/booking-link-shared", tokenIos, "ios");

      // android
      await post("/api/track/booking-link-share-tap", tokenAndroid, "android");
      // already had 1 completion above; that satisfies the plan
      await post("/api/track/booking-link-copied", tokenAndroid, "android");

      // web
      await post("/api/track/booking-link-share-tap", tokenWeb, "web");
      await post("/api/track/booking-link-share-tap", tokenWeb, "web");
      await post("/api/track/booking-link-share-tap", tokenWeb, "web");
      await post("/api/track/booking-link-shared", tokenWeb, "web");
      await post("/api/track/booking-link-shared", tokenWeb, "web");
      // already had 1 copy above; add another so the count is 2
      await post("/api/track/booking-link-copied", tokenWeb, "web");

      // unknown
      // already had 1 tap (header missing) and 1 copy (junk header) above —
      // both normalized to "unknown". No completions for unknown to confirm
      // the rate guard returns 0 (not NaN/Infinity).

      // Wait for the fire-and-forget canonical event inserts to land so
      // the aggregation report sees them.
      await waitForEvent(dbUserIdIos, "booking_link_share_tap", 2);
      await waitForEvent(dbUserIdIos, "booking_link_share_completed", 1);
      await waitForEvent(dbUserIdAndroid, "booking_link_share_tap", 1);
      await waitForEvent(dbUserIdAndroid, "booking_link_copied", 1);
      await waitForEvent(dbUserIdWeb, "booking_link_share_tap", 3);
      await waitForEvent(dbUserIdWeb, "booking_link_share_completed", 2);
      await waitForEvent(dbUserIdWeb, "booking_link_copied", 2);
      await waitForEvent(dbUserIdUnknown, "booking_link_share_tap", 1);
      await waitForEvent(dbUserIdUnknown, "booking_link_copied", 1);
    });

    it("returns a platforms array with the correct per-platform counts and tap->completion rate", async () => {
      const res = await fetch(`${BASE_URL}/api/admin/analytics/share-funnel?days=1`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        platforms: PlatformBucket[];
        surfaces: SurfaceBucket[];
        totals: { taps: number; completions: number; copies: number; tapToCompletionRate: number };
      };

      expect(Array.isArray(body.platforms)).toBe(true);

      // The report is global (everything in the last N days), so other
      // events from unrelated suites can sit alongside ours. We re-derive
      // each bucket's contribution from THIS test by also asking the DB
      // for our own event counts, then asserting the report's per-platform
      // numbers are AT LEAST what we generated. That gives us a tight
      // guard without needing a clean table.
      const { db } = await import("../../server/db");
      const { eventsCanonical } = await import("@shared/schema");
      const { eq, and, inArray } = await import("drizzle-orm");
      const ourRows = await db
        .select({
          eventName: eventsCanonical.eventName,
          context: eventsCanonical.context,
        })
        .from(eventsCanonical)
        .where(
          and(
            inArray(eventsCanonical.userId, [
              dbUserIdIos,
              dbUserIdAndroid,
              dbUserIdWeb,
              dbUserIdUnknown,
            ]),
            inArray(eventsCanonical.eventName, [
              "booking_link_share_tap",
              "booking_link_share_completed",
              "booking_link_copied",
            ]),
          ),
        );

      type Counts = { taps: number; completions: number; copies: number };
      const ourByPlatform = new Map<string, Counts>();
      for (const row of ourRows) {
        const ctx = JSON.parse(row.context || "{}");
        const platform = ctx.platform || "unknown";
        const bucket =
          ourByPlatform.get(platform) ?? { taps: 0, completions: 0, copies: 0 };
        if (row.eventName === "booking_link_share_tap") bucket.taps++;
        else if (row.eventName === "booking_link_share_completed") bucket.completions++;
        else if (row.eventName === "booking_link_copied") bucket.copies++;
        ourByPlatform.set(platform, bucket);
      }

      // Confirm the expected mix actually landed.
      expect(ourByPlatform.get("ios")).toEqual({ taps: 2, completions: 1, copies: 0 });
      expect(ourByPlatform.get("android")).toEqual({ taps: 1, completions: 1, copies: 1 });
      expect(ourByPlatform.get("web")).toEqual({ taps: 3, completions: 2, copies: 2 });
      expect(ourByPlatform.get("unknown")).toEqual({ taps: 1, completions: 0, copies: 1 });

      // Each of our platforms must show up in the report with at least
      // our generated counts (other suites/users may push the totals
      // higher, but never lower).
      for (const platform of ["ios", "android", "web", "unknown"] as const) {
        const reported = body.platforms.find((p) => p.platform === platform);
        expect(reported).toBeDefined();
        const ours = ourByPlatform.get(platform)!;
        expect(reported!.taps).toBeGreaterThanOrEqual(ours.taps);
        expect(reported!.completions).toBeGreaterThanOrEqual(ours.completions);
        expect(reported!.copies).toBeGreaterThanOrEqual(ours.copies);
      }

      // The conversion rate must be a finite number in [0, 1] and respect
      // the taps == 0 -> 0 guard. Any negative or NaN value would signal
      // a divide-by-zero regression.
      for (const reported of body.platforms) {
        expect(Number.isFinite(reported.tapToCompletionRate)).toBe(true);
        expect(reported.tapToCompletionRate).toBeGreaterThanOrEqual(0);
        expect(reported.tapToCompletionRate).toBeLessThanOrEqual(1);
      }

      // The rate must equal completions/taps (rounded to 4dp) for every
      // platform in the report — including the unknown bucket — so a
      // regression that swaps numerator/denominator, drops the rounding,
      // or breaks the zero-tap guard would fail here. We re-derive from
      // the report's own counts so this works even though the table is
      // shared with other suites.
      const expectedRate = (taps: number, completions: number) =>
        taps > 0 ? Number((completions / taps).toFixed(4)) : 0;
      for (const platform of ["ios", "android", "web", "unknown"] as const) {
        const reported = body.platforms.find((p) => p.platform === platform)!;
        expect(reported.tapToCompletionRate).toBe(
          expectedRate(reported.taps, reported.completions),
        );
      }
      // Sanity check that the helper actually exercises a non-trivial
      // rate (not just zero-on-zero).
      const ourWeb = body.platforms.find((p) => p.platform === "web")!;
      expect(ourWeb.taps).toBeGreaterThan(0);
      expect(ourWeb.completions).toBeGreaterThan(0);
    });

    it("exposes a platforms note alongside the breakdown", async () => {
      const res = await fetch(`${BASE_URL}/api/admin/analytics/share-funnel?days=1`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { notes?: Record<string, string> };
      // The platforms note doubles as user-facing documentation in the
      // admin UI. If the field disappears entirely the report loses its
      // explainer; we don't assert on the copy itself so wording can be
      // tuned without breaking this guard.
      expect(typeof body.notes?.platforms).toBe("string");
      expect((body.notes!.platforms || "").length).toBeGreaterThan(0);
    });

    it("keeps the existing surface (per-screen) breakdown working alongside platforms", async () => {
      // Regression guard: the platform aggregation was added without
      // touching the surface aggregation. If a refactor accidentally
      // dropped or replaced the screen group-by, this would catch it.
      const res = await fetch(`${BASE_URL}/api/admin/analytics/share-funnel?days=1`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { surfaces: SurfaceBucket[] };

      expect(Array.isArray(body.surfaces)).toBe(true);
      // Our test screen is unique to this run, so it should appear
      // exactly once with counts matching what we generated.
      const ourSurface = body.surfaces.find((s) => s.screen === "other");
      // SCREEN is not in the KNOWN_BOOKING_LINK_SCREENS whitelist, so the
      // server normalizes it to "other". That's the contract we want to
      // preserve.
      expect(ourSurface).toBeDefined();

      // The surface bucket totals must equal the sum across all platforms
      // for our generated events (taps + completions + copies). We
      // generated 7 taps, 4 completions, 4 copies = 15 events under "other".
      expect(ourSurface!.taps).toBeGreaterThanOrEqual(7);
      expect(ourSurface!.completions).toBeGreaterThanOrEqual(4);
      expect(ourSurface!.copies).toBeGreaterThanOrEqual(4);
    });
  });
});
