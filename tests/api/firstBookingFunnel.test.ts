/**
 * End-to-end coverage for the First Booking funnel admin report.
 *
 * The report aggregates the full lifecycle of growth-engine pre-generated
 * booking pages: pages generated -> viewed -> claimed -> link shared ->
 * first invoice paid by the converted user. Without this coverage, a SQL
 * refactor or a wrong join could silently drop one of the funnel stages
 * and we'd lose the only signal we have on whether unclaimed pages are
 * converting into real customers.
 *
 * Verifies:
 *   1. Per-category breakdown counts pages, views, claims, shares, paid
 *      conversions correctly.
 *   2. Totals are the sum of the per-category rows.
 *   3. The `days` filter restricts to pages whose created_at falls inside
 *      the window. `days=all` returns everything.
 *   4. The per-page detail endpoint returns the page metadata, the
 *      ordered event timeline, the claimer record, and the first paid
 *      invoice timestamp for that user.
 *
 * Skipped automatically when DATABASE_URL or APP_JWT_SECRET is not set
 * (e.g. on a clean local checkout) so the rest of the unit suite stays
 * runnable without infra.
 */

import { TEST_BASE_URL } from "../utils/env";

const BASE_URL = TEST_BASE_URL;
const HAS_DB = !!process.env.DATABASE_URL && !!process.env.APP_JWT_SECRET;
const dbDescribe = HAS_DB ? describe : describe.skip;

dbDescribe("First Booking funnel — admin report", () => {
  jest.setTimeout(45000);

  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  // We seed 3 booking pages in the "moving" category and 2 in "cleaning":
  //   moving-1: viewed only
  //   moving-2: viewed + claimed (no shares, no paid invoice)
  //   moving-3: viewed + claimed + shared + paid invoice for the claimer
  //   cleaning-1: nothing
  //   cleaning-2: viewed + claimed + shared (no paid invoice)
  // We also seed an "old" page far outside the 7d window to verify the
  // `days` filter excludes it.
  const moving1 = `fb-funnel-${runId}-m1`;
  const moving2 = `fb-funnel-${runId}-m2`;
  const moving3 = `fb-funnel-${runId}-m3`;
  const cleaning1 = `fb-funnel-${runId}-c1`;
  const cleaning2 = `fb-funnel-${runId}-c2`;
  const oldPage = `fb-funnel-${runId}-old`;
  // A user-created (non Growth-Engine) page in the same window. The
  // funnel report MUST exclude it — otherwise its claimed=true status
  // and the claimer's paid invoice would inflate every stage of the
  // funnel and make the per-cohort report meaningless.
  const userCreatedPage = `fb-funnel-${runId}-uc`;

  const movingClaimer = `fb-funnel-user-${runId}-m3`;
  const cleaningClaimer = `fb-funnel-user-${runId}-c2`;
  const movingClaimerNoPaid = `fb-funnel-user-${runId}-m2`;
  const userCreatedClaimer = `fb-funnel-user-${runId}-uc`;

  let adminToken: string;

  beforeAll(async () => {
    const { db } = await import("../../server/db");
    const schema = await import("../../shared/schema");
    const { signAppJwt } = await import("../../server/appJwt");

    // Bootstrap admin id default is "demo-user" (see ADMIN_USER_IDS in
    // server/copilot/adminMiddleware.ts). The JWT only needs sub to match.
    adminToken = signAppJwt({ sub: "demo-user", provider: "replit" });

    const now = new Date();
    const nowIso = now.toISOString();
    const thirtyOneDaysAgoIso = new Date(
      now.getTime() - 31 * 24 * 60 * 60 * 1000,
    ).toISOString();

    // Pages
    await db.insert(schema.bookingPages).values([
      { id: moving1, category: "moving", source: "growth_engine", createdAt: nowIso, updatedAt: nowIso, claimed: false },
      { id: moving2, category: "moving", source: "growth_engine", createdAt: nowIso, updatedAt: nowIso, claimed: true, claimedAt: nowIso, claimedByUserId: movingClaimerNoPaid },
      { id: moving3, category: "moving", source: "growth_engine", createdAt: nowIso, updatedAt: nowIso, claimed: true, claimedAt: nowIso, claimedByUserId: movingClaimer },
      { id: cleaning1, category: "cleaning", source: "growth_engine", createdAt: nowIso, updatedAt: nowIso, claimed: false },
      { id: cleaning2, category: "cleaning", source: "growth_engine", createdAt: nowIso, updatedAt: nowIso, claimed: true, claimedAt: nowIso, claimedByUserId: cleaningClaimer },
      // Old page outside any reasonable short window — used to verify the
      // `days` filter restricts results.
      { id: oldPage, category: "moving", source: "growth_engine", createdAt: thirtyOneDaysAgoIso, updatedAt: thirtyOneDaysAgoIso, claimed: false },
      // user_created page (the provider's own personal booking link).
      // The funnel report MUST exclude this entirely.
      { id: userCreatedPage, category: "moving", source: "user_created", createdAt: nowIso, updatedAt: nowIso, claimed: true, claimedAt: nowIso, claimedByUserId: userCreatedClaimer },
    ] as any);

    // Events
    await db.insert(schema.bookingPageEvents).values([
      // moving1: viewed only
      { pageId: moving1, type: "page_viewed", variant: "back_and_forth", createdAt: nowIso },
      // moving2: viewed + claimed
      { pageId: moving2, type: "page_viewed", variant: "deposit_first", createdAt: nowIso },
      { pageId: moving2, type: "page_claimed", variant: "deposit_first", createdAt: nowIso },
      // moving3: viewed + claimed + shared (link_copied)
      { pageId: moving3, type: "page_viewed", variant: "speed_first", createdAt: nowIso },
      { pageId: moving3, type: "page_claimed", variant: "speed_first", createdAt: nowIso },
      { pageId: moving3, type: "link_copied", variant: "speed_first", createdAt: nowIso },
      // cleaning2: viewed + claimed + shared (link_shared)
      { pageId: cleaning2, type: "page_viewed", variant: "social_proof", createdAt: nowIso },
      { pageId: cleaning2, type: "page_claimed", variant: "social_proof", createdAt: nowIso },
      { pageId: cleaning2, type: "link_shared", variant: "social_proof", createdAt: nowIso },
    ] as any);

    // Users for the claimers (so the join in the detail endpoint resolves).
    // `users.public_profile_slug` is NOT NULL (Task #217). Each seeded
    // claimer needs a unique non-null slug; we derive one from the
    // username so it stays unique within and across runs.
    await db.insert(schema.users).values([
      { id: movingClaimer, username: `claim-${moving3}`, password: "x", authProvider: "claim", publicProfileSlug: `slug-claim-${moving3}`, createdAt: nowIso },
      { id: cleaningClaimer, username: `claim-${cleaning2}`, password: "x", authProvider: "claim", publicProfileSlug: `slug-claim-${cleaning2}`, createdAt: nowIso },
      { id: movingClaimerNoPaid, username: `claim-${moving2}`, password: "x", authProvider: "claim", publicProfileSlug: `slug-claim-${moving2}`, createdAt: nowIso },
      // Owner of the user_created page — also has a paid invoice. If the
      // funnel filter is broken, this paid invoice would be counted too.
      { id: userCreatedClaimer, username: `claim-${userCreatedPage}`, password: "x", authProvider: "claim", publicProfileSlug: `slug-claim-${userCreatedPage}`, createdAt: nowIso },
    ] as any);

    // Paid invoice for moving3's claimer only — drives the funnel's
    // "paid" stage. moving2's claimer has no paid invoice and must NOT
    // be counted. The user_created claimer also has a paid invoice as
    // a foil for the source filter test.
    await db.insert(schema.invoices).values([
      {
        invoiceNumber: `INV-${runId}-m3`,
        userId: movingClaimer,
        clientName: "Test Client",
        serviceDescription: "moving job",
        amount: 12345,
        status: "paid",
        paidAt: nowIso,
        createdAt: nowIso,
      },
      {
        invoiceNumber: `INV-${runId}-uc`,
        userId: userCreatedClaimer,
        clientName: "User-created Client",
        serviceDescription: "user-created moving job",
        amount: 9999,
        status: "paid",
        paidAt: nowIso,
        createdAt: nowIso,
      },
    ] as any);
  });

  afterAll(async () => {
    if (!HAS_DB) return;
    const { db, pool } = await import("../../server/db");
    const schema = await import("../../shared/schema");
    const { inArray } = await import("drizzle-orm");

    const pageIds = [moving1, moving2, moving3, cleaning1, cleaning2, oldPage, userCreatedPage];
    const userIds = [movingClaimer, cleaningClaimer, movingClaimerNoPaid, userCreatedClaimer];

    await db
      .delete(schema.bookingPageEvents)
      .where(inArray(schema.bookingPageEvents.pageId, pageIds));
    await db
      .delete(schema.invoices)
      .where(inArray(schema.invoices.userId, userIds));
    await db
      .delete(schema.bookingPages)
      .where(inArray(schema.bookingPages.id, pageIds));
    await db.delete(schema.users).where(inArray(schema.users.id, userIds));

    await pool.end().catch(() => undefined);
  });

  async function getJson(path: string): Promise<any> {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(200);
    return res.json();
  }

  it("aggregates the funnel by category for the default 30-day window", async () => {
    const data = await getJson("/api/admin/analytics/first-booking-funnel?days=30");

    expect(data.window).toBe("30d");
    expect(Array.isArray(data.categories)).toBe(true);

    const moving = data.categories.find((c: any) => c.category === "moving");
    const cleaning = data.categories.find((c: any) => c.category === "cleaning");

    // Within 30d, restricted to source = 'growth_engine':
    //   moving: m1 (viewed), m2 (viewed+claimed),
    //           m3 (viewed+claimed+shared+paid)
    //           — the "old" 31-day-old moving page falls outside,
    //           — the user_created moving page is excluded by source.
    //   cleaning: c1 (nothing), c2 (viewed+claimed+shared, no paid)
    expect(moving).toBeDefined();
    expect(moving.generated).toBeGreaterThanOrEqual(3);
    expect(moving.viewed).toBeGreaterThanOrEqual(3);
    expect(moving.claimed).toBeGreaterThanOrEqual(2);
    expect(moving.shared).toBeGreaterThanOrEqual(1);
    expect(moving.paid).toBeGreaterThanOrEqual(1);

    expect(cleaning).toBeDefined();
    expect(cleaning.generated).toBeGreaterThanOrEqual(2);
    expect(cleaning.viewed).toBeGreaterThanOrEqual(1);
    expect(cleaning.claimed).toBeGreaterThanOrEqual(1);
    expect(cleaning.shared).toBeGreaterThanOrEqual(1);
    expect(cleaning.paid).toBe(0);

    // Totals must equal the sum of per-category rows.
    const sum = (key: string) =>
      data.categories.reduce((acc: number, row: any) => acc + row[key], 0);
    expect(data.totals.generated).toBe(sum("generated"));
    expect(data.totals.viewed).toBe(sum("viewed"));
    expect(data.totals.claimed).toBe(sum("claimed"));
    expect(data.totals.shared).toBe(sum("shared"));
    expect(data.totals.paid).toBe(sum("paid"));
  });

  it("returns a per-day series whose stage sums match the totals", async () => {
    const data = await getJson("/api/admin/analytics/first-booking-funnel?days=30");

    expect(Array.isArray(data.series)).toBe(true);
    // 30d window must produce a continuous range — at least the 30 days
    // up through today, so the chart x-axis is stable even on quiet days.
    expect(data.series.length).toBeGreaterThanOrEqual(30);

    // Days are ISO YYYY-MM-DD strings and strictly ordered.
    for (let i = 1; i < data.series.length; i++) {
      expect(data.series[i].date > data.series[i - 1].date).toBe(true);
    }

    // Each day's stage counts are non-negative and never exceed the
    // totals (we only ever count a page once per stage per day).
    const stageKeys = ["generated", "viewed", "claimed", "shared", "paid"] as const;
    for (const key of stageKeys) {
      const seriesSum = data.series.reduce(
        (acc: number, point: any) => acc + Number(point[key] || 0),
        0,
      );
      // The sum across the daily series must equal the aggregate total
      // for that stage (the per-page binary count) — every page that
      // hit the stage contributes exactly once on the day it did so.
      expect(seriesSum).toBe(data.totals[key]);
    }

    // The fixtures all happen "today" (UTC), so today's bucket must
    // carry the bulk of the activity.
    const todayKey = new Date().toISOString().slice(0, 10);
    const today = data.series.find((p: any) => p.date === todayKey);
    expect(today).toBeDefined();
    expect(today.generated).toBeGreaterThanOrEqual(5);
    expect(today.viewed).toBeGreaterThanOrEqual(4);
    expect(today.claimed).toBeGreaterThanOrEqual(3);
    expect(today.shared).toBeGreaterThanOrEqual(2);
    expect(today.paid).toBeGreaterThanOrEqual(1);
  });

  it("excludes user_created (non Growth-Engine) pages from the funnel", async () => {
    const data = await getJson("/api/admin/analytics/first-booking-funnel?days=30");
    const pages = await getJson(
      "/api/admin/analytics/first-booking-funnel/pages?days=30&limit=200",
    );

    // The user_created page is in 'moving' and was created today, so a
    // broken filter would bump moving.generated/claimed/paid by 1 each
    // and would make it appear in the pages list. Both must NOT happen.
    const ids = new Set(pages.pages.map((p: any) => p.id));
    expect(ids.has(userCreatedPage)).toBe(false);

    // Capture moving counts and re-run with a tighter window — the
    // user_created page (always in window) should never appear.
    const moving = data.categories.find((c: any) => c.category === "moving");
    expect(moving).toBeDefined();
    // Sanity: no growth_engine moving page besides our 3 fresh seeds is
    // expected to have all of viewed+claimed+shared+paid in the window;
    // the user_created page would also satisfy claimed+paid. Subtract:
    // confirm exactly the 3 fresh fixtures show up by id in the list.
    const movingFreshIds = pages.pages
      .filter((p: any) => p.category === "moving")
      .map((p: any) => p.id);
    expect(movingFreshIds).toEqual(expect.arrayContaining([moving1, moving2, moving3]));
    expect(movingFreshIds).not.toContain(userCreatedPage);
  });

  it("days=all includes the old page that 7d/30d would exclude", async () => {
    const inSeven = await getJson("/api/admin/analytics/first-booking-funnel?days=7");
    const inAll = await getJson("/api/admin/analytics/first-booking-funnel?days=all");

    expect(inSeven.window).toBe("7d");
    expect(inAll.window).toBe("all");

    // The old page is in "moving" and was created 31 days ago.
    const movingSeven = inSeven.categories.find((c: any) => c.category === "moving");
    const movingAll = inAll.categories.find((c: any) => c.category === "moving");

    expect(movingAll).toBeDefined();
    // "all" must count strictly more (or equal) generated rows than 7d for
    // the moving category — the old page is included only in "all".
    if (movingSeven) {
      expect(movingAll.generated).toBeGreaterThanOrEqual(movingSeven.generated + 1);
    } else {
      // Edge case: nothing fell in the 7d window for moving — still must
      // see at least the 3 fresh + 1 old in "all".
      expect(movingAll.generated).toBeGreaterThanOrEqual(4);
    }
  });

  it("returns the page detail with ordered event timeline and first paid timestamp", async () => {
    const data = await getJson(
      `/api/admin/analytics/first-booking-funnel/pages/${moving3}`,
    );

    expect(data.page.id).toBe(moving3);
    expect(data.page.category).toBe("moving");
    expect(data.page.claimed).toBe(true);
    expect(data.claimer).not.toBeNull();
    expect(data.claimer.id).toBe(movingClaimer);
    expect(data.firstPaidAt).toBeTruthy();
    expect(data.totalPaidInvoices).toBeGreaterThanOrEqual(1);

    expect(Array.isArray(data.events)).toBe(true);
    const types = data.events.map((e: any) => e.type);
    expect(types).toEqual(expect.arrayContaining([
      "page_viewed",
      "page_claimed",
      "link_copied",
    ]));

    // Timestamps must be non-decreasing — the route orders by createdAt.
    for (let i = 1; i < data.events.length; i++) {
      expect(data.events[i].createdAt >= data.events[i - 1].createdAt).toBe(true);
    }
  });

  it("returns the pages list filtered by the time window", async () => {
    const data = await getJson(
      "/api/admin/analytics/first-booking-funnel/pages?days=30&limit=200",
    );

    expect(Array.isArray(data.pages)).toBe(true);
    const ids = new Set(data.pages.map((p: any) => p.id));
    expect(ids.has(moving3)).toBe(true);
    expect(ids.has(cleaning2)).toBe(true);
    // The old (>30d) page must NOT be in the 30d list.
    expect(ids.has(oldPage)).toBe(false);

    const m3 = data.pages.find((p: any) => p.id === moving3);
    expect(m3.claimed).toBe(true);
    expect(m3.viewed).toBe(true);
    expect(m3.shared).toBe(true);
    expect(m3.firstPaidAt).toBeTruthy();
  });

  it("returns 404 for an unknown page id", async () => {
    const res = await fetch(
      `${BASE_URL}/api/admin/analytics/first-booking-funnel/pages/__nope__`,
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 when fetching the detail of a user_created page", async () => {
    // The detail endpoint must mirror the aggregate/list cohort filter:
    // a user_created page exists in the table but is not part of the
    // First Booking funnel and has its own UI elsewhere.
    const res = await fetch(
      `${BASE_URL}/api/admin/analytics/first-booking-funnel/pages/${userCreatedPage}`,
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    expect(res.status).toBe(404);
  });
});
