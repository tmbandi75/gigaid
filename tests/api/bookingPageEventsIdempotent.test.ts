/**
 * Verifies that the `first_booking_viewed` booking-page event is recorded
 * at most once per page. The frontend ref-guards within a single mount,
 * but reloads and revisits used to record a fresh row each time, inflating
 * view counts and corrupting "viewed -> copied" / "viewed -> shared" funnel
 * math. The fix has two layers:
 *   1. `trackBookingPageEvent` does a check-then-insert for this event
 *      type and swallows a unique-violation as the race tiebreaker.
 *   2. A partial unique index on (page_id) WHERE
 *      type = 'first_booking_viewed' enforces this at the DB level.
 *
 * Skipped automatically when DATABASE_URL is not set so the rest of the
 * unit suite stays runnable without infra.
 */

const HAS_DB = !!process.env.DATABASE_URL;
const d = HAS_DB ? describe : describe.skip;

d("booking_page_events first_booking_viewed idempotency (DB-bound)", () => {
  let db: typeof import("../../server/db")["db"];
  let pool: typeof import("../../server/db")["pool"];
  let schema: typeof import("../../shared/schema");
  let dbStorage: typeof import("../../server/db-storage")["dbStorage"];
  let eq: typeof import("drizzle-orm")["eq"];
  let suiteId: string;

  beforeAll(async () => {
    ({ db, pool } = await import("../../server/db"));
    schema = await import("../../shared/schema");
    ({ dbStorage } = await import("../../server/db-storage"));
    ({ eq } = await import("drizzle-orm"));
    suiteId = `viewed-idem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  });

  afterAll(async () => {
    if (!HAS_DB) return;
    await db
      .delete(schema.bookingPageEvents)
      .where(eq(schema.bookingPageEvents.pageId, `${suiteId}-page`));
    await db
      .delete(schema.bookingPages)
      .where(eq(schema.bookingPages.id, `${suiteId}-page`));
    await pool.end().catch(() => undefined);
  });

  it("records first_booking_viewed only once across repeated calls", async () => {
    const pageId = `${suiteId}-page`;
    const now = new Date().toISOString();

    await db.insert(schema.bookingPages).values({
      id: pageId,
      claimed: true,
      claimedAt: now,
      claimedByUserId: `${suiteId}-user`,
      source: "test",
    });

    // Simulate three reloads / revisits of the first-booking page. The
    // server-side handler should accept all three calls but only the first
    // should produce a row.
    await dbStorage.trackBookingPageEvent(pageId, "first_booking_viewed");
    await dbStorage.trackBookingPageEvent(pageId, "first_booking_viewed");
    await dbStorage.trackBookingPageEvent(pageId, "first_booking_viewed");

    const viewedRows = await db
      .select()
      .from(schema.bookingPageEvents)
      .where(eq(schema.bookingPageEvents.pageId, pageId));

    const firstViewed = viewedRows.filter((r) => r.type === "first_booking_viewed");
    expect(firstViewed.length).toBe(1);
  });

  it("still records every page_viewed / link_copied / link_shared call (other types unaffected)", async () => {
    const pageId = `${suiteId}-page`;

    // Record one of each non-idempotent type twice; the partial unique
    // index predicate (`type = 'first_booking_viewed'`) excludes them, so
    // both inserts must succeed.
    await dbStorage.trackBookingPageEvent(pageId, "page_viewed", { variant: "speed_first" });
    await dbStorage.trackBookingPageEvent(pageId, "page_viewed", { variant: "speed_first" });
    await dbStorage.trackBookingPageEvent(pageId, "link_copied");
    await dbStorage.trackBookingPageEvent(pageId, "link_copied");
    await dbStorage.trackBookingPageEvent(pageId, "link_shared");
    await dbStorage.trackBookingPageEvent(pageId, "link_shared");

    const rows = await db
      .select()
      .from(schema.bookingPageEvents)
      .where(eq(schema.bookingPageEvents.pageId, pageId));

    const counts = rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.type] = (acc[r.type] ?? 0) + 1;
      return acc;
    }, {});

    expect(counts["page_viewed"]).toBe(2);
    expect(counts["link_copied"]).toBe(2);
    expect(counts["link_shared"]).toBe(2);
    // first_booking_viewed from the previous test still capped at 1.
    expect(counts["first_booking_viewed"]).toBe(1);
  });

  it("enforces the partial unique index at the database level", async () => {
    const pageId = `${suiteId}-page`;

    // Bypass the storage helper and try to insert a duplicate row directly.
    // The partial unique index must reject it with a 23505 unique-violation.
    let rejected: unknown = null;
    try {
      await db.insert(schema.bookingPageEvents).values({
        pageId,
        type: "first_booking_viewed",
      });
    } catch (err) {
      rejected = err;
    }
    expect(rejected).not.toBeNull();
    const msg = rejected instanceof Error ? rejected.message : String(rejected);
    expect(/duplicate key|unique|23505/i.test(msg)).toBe(true);
  });
});
