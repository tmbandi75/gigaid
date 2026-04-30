/**
 * Verifies the partial unique index on `users.public_profile_slug`
 * (`users_public_profile_slug_unique_idx`) actually rejects duplicate
 * non-null slugs at the database level.
 *
 * This is the DB-side half of the slug-uniqueness contract — the
 * application-side retry helper (`writeUserSlugWithRetry`) is exercised in
 * `tests/utils/writeUserSlugWithRetry.unit.test.ts`. Without this index in
 * place the helper would have nothing to retry against.
 *
 * Note: this suite used to also assert that inserting `publicProfileSlug:
 * null` was rejected with a NOT NULL violation (SQLSTATE 23502). That
 * assertion predates Task #291, which added a DB-level DEFAULT to the column
 * (`'user-' || substring(gen_random_uuid()::text, 1, 8)`). Drizzle's insert
 * builder strips explicit `null`s for columns with a default, so the row
 * went through, the DEFAULT fired, and the assertion failed on every run —
 * dead code that produced a confusing failure right next to the genuinely
 * passing slug tests. The "every account always has a booking link"
 * invariant is now covered by the DEFAULT, regression-tested in
 * `tests/api/usersSlugDefault.test.ts`.
 *
 * Skipped automatically when DATABASE_URL is not set so the rest of the
 * suite stays runnable on a clean local checkout.
 */

const HAS_DB = !!process.env.DATABASE_URL;
const d = HAS_DB ? describe : describe.skip;

d("users.public_profile_slug unique index (DB-bound)", () => {
  let db: typeof import("../../server/db")["db"];
  let pool: typeof import("../../server/db")["pool"];
  let schema: typeof import("../../shared/schema");
  let inArray: typeof import("drizzle-orm")["inArray"];
  let suiteId: string;

  beforeAll(async () => {
    ({ db, pool } = await import("../../server/db"));
    schema = await import("../../shared/schema");
    ({ inArray } = await import("drizzle-orm"));
    suiteId = `slug-uniq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  });

  afterAll(async () => {
    if (!HAS_DB) return;
    await db
      .delete(schema.users)
      .where(
        inArray(schema.users.username, [
          `${suiteId}-a`,
          `${suiteId}-b`,
        ]),
      );
    await pool.end().catch(() => undefined);
  });

  it("rejects a second insert with the same non-null slug", async () => {
    const slug = `${suiteId}-shared-slug`;
    await db.insert(schema.users).values({
      username: `${suiteId}-a`,
      password: "x",
      publicProfileSlug: slug,
    } as any);

    await expect(
      db.insert(schema.users).values({
        username: `${suiteId}-b`,
        password: "x",
        publicProfileSlug: slug,
      } as any),
    ).rejects.toMatchObject({ code: "23505" });
  });
});
