/**
 * Regression test for the database-level DEFAULT on `users.public_profile_slug`.
 *
 * Task #291 added:
 *   text("public_profile_slug")
 *     .notNull()
 *     .default(sql`'user-' || substring(gen_random_uuid()::text, 1, 8)`)
 *
 * This test inserts a row WITHOUT supplying a slug and verifies that Postgres
 * automatically fills one in. If a future migration removes or nullifies the
 * DEFAULT expression the test will fail with a clear assertion error, catching
 * the regression before it reaches production.
 *
 * Skipped automatically when DATABASE_URL is not set so the suite stays
 * runnable on a clean local checkout without a live database.
 */

const HAS_DB = !!process.env.DATABASE_URL;
const d = HAS_DB ? describe : describe.skip;

d("users.public_profile_slug DB DEFAULT (regression)", () => {
  let db: typeof import("../../server/db")["db"];
  let pool: typeof import("../../server/db")["pool"];
  let schema: typeof import("../../shared/schema");
  let suiteId: string;

  beforeAll(async () => {
    ({ db, pool } = await import("../../server/db"));
    schema = await import("../../shared/schema");
    suiteId = `slug-default-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  });

  afterAll(async () => {
    if (!HAS_DB) return;
    await db
      .delete(schema.users)
      .where(
        (await import("drizzle-orm")).eq(
          schema.users.username,
          `${suiteId}-no-slug`,
        ),
      );
    await pool.end().catch(() => undefined);
  });

  it(
    "auto-fills public_profile_slug when the insert omits it",
    async () => {
      // Deliberately omit publicProfileSlug — the DB DEFAULT must supply it.
      type UserInsert = typeof schema.users.$inferInsert;
      const payload: UserInsert = {
        username: `${suiteId}-no-slug`,
        password: "x",
      };
      const [inserted] = await db
        .insert(schema.users)
        .values(payload)
        .returning({ slug: schema.users.publicProfileSlug });

      // The column is NOT NULL, so the value must come back as a string.
      expect(typeof inserted.slug).toBe("string");
      expect(inserted.slug).not.toBeNull();

      // Shape: 'user-' followed by exactly 8 hex characters derived from a UUID.
      // Example: user-550e8400
      expect(inserted.slug).toMatch(/^user-[a-f0-9]{8}$/);
    },
  );
});
