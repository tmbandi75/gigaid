/**
 * Verifies the partial unique index on outbound_messages prevents duplicate
 * first-booking nudges for the same (booking_page_id, type) while a row is
 * still scheduled, queued, or sent. This is the database-level guarantee
 * behind the "sent is terminal" property of the send-time policy chain.
 *
 * Skipped automatically when DATABASE_URL is not set (e.g. on a clean local
 * checkout) so the rest of the unit suite stays runnable without infra.
 */

const HAS_DB = !!process.env.DATABASE_URL;
const d = HAS_DB ? describe : describe.skip;

d("outbound_messages partial unique index (DB-bound)", () => {
  let db: typeof import("../../server/db")["db"];
  let pool: typeof import("../../server/db")["pool"];
  let schema: typeof import("../../shared/schema");
  let eq: typeof import("drizzle-orm")["eq"];
  let inArray: typeof import("drizzle-orm")["inArray"];
  let suiteId: string;

  beforeAll(async () => {
    ({ db, pool } = await import("../../server/db"));
    schema = await import("../../shared/schema");
    ({ eq, inArray } = await import("drizzle-orm"));
    suiteId = `unique-idx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  });

  afterAll(async () => {
    if (!HAS_DB) return;
    await db
      .delete(schema.outboundMessages)
      .where(eq(schema.outboundMessages.userId, suiteId));
    await db.delete(schema.bookingPages).where(eq(schema.bookingPages.id, `${suiteId}-page`));
    await pool.end().catch(() => undefined);
  });

  it("blocks a second insert with the same (booking_page_id, type) while the first is sent", async () => {
    const userId = suiteId;
    const bookingPageId = `${suiteId}-page`;
    const now = new Date().toISOString();

    // Seed a booking page so the FK-style relationship is realistic.
    await db.insert(schema.bookingPages).values({
      id: bookingPageId,
      claimed: true,
      claimedAt: now,
      claimedByUserId: userId,
      source: "test",
    } as any);

    // First insert: a SENT first-booking 10m nudge for this page.
    await db.insert(schema.outboundMessages).values({
      userId,
      bookingPageId,
      channel: "sms",
      toAddress: "+15555550100",
      type: "first_booking_nudge_10m",
      status: "sent",
      scheduledFor: now,
      sentAt: now,
      createdAt: now,
    });

    // Second insert with the same (booking_page_id, type) MUST throw.
    let rejected: unknown = null;
    try {
      await db.insert(schema.outboundMessages).values({
        userId,
        bookingPageId,
        channel: "sms",
        toAddress: "+15555550100",
        type: "first_booking_nudge_10m",
        status: "scheduled",
        scheduledFor: now,
        createdAt: now,
      });
    } catch (err) {
      rejected = err;
    }

    expect(rejected).not.toBeNull();
    // Postgres unique-violation error code is "23505". Surface a useful
    // message either way so a regression here points straight at the index.
    const msg = rejected instanceof Error ? rejected.message : String(rejected);
    expect(/duplicate key|unique|23505/i.test(msg)).toBe(true);

    // Sanity check: the table should still hold exactly one row for this page+type.
    const rows = await db
      .select()
      .from(schema.outboundMessages)
      .where(
        eq(schema.outboundMessages.bookingPageId, bookingPageId),
      );
    expect(rows.length).toBe(1);
    expect(rows[0].type).toBe("first_booking_nudge_10m");
    expect(rows[0].status).toBe("sent");
  });

  it("allows a different nudge type for the same booking page (24h alongside 10m)", async () => {
    const userId = suiteId;
    const bookingPageId = `${suiteId}-page`;
    const now = new Date().toISOString();

    // 10m nudge already exists from the previous test (sent). Inserting a
    // 24h nudge for the same page MUST be allowed because the unique
    // predicate is (booking_page_id, type), not just booking_page_id.
    await db.insert(schema.outboundMessages).values({
      userId,
      bookingPageId,
      channel: "sms",
      toAddress: "+15555550100",
      type: "first_booking_nudge_24h",
      status: "scheduled",
      scheduledFor: now,
      createdAt: now,
    });

    const rows = await db
      .select()
      .from(schema.outboundMessages)
      .where(eq(schema.outboundMessages.bookingPageId, bookingPageId));
    const types = rows.map((r) => r.type).sort();
    expect(types).toEqual(["first_booking_nudge_10m", "first_booking_nudge_24h"]);
  });
});
