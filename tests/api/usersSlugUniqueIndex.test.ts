/**
 * Verifies the partial unique index on `users.public_profile_slug`
 * (`users_public_profile_slug_unique_idx`) actually rejects duplicate
 * non-null slugs at the database level, AND that the column itself is
 * NOT NULL so any code path that bypasses Drizzle (raw SQL, future writers,
 * ad-hoc seed scripts) can't smuggle a NULL slug back in.
 *
 * This is the DB-side half of the slug-uniqueness contract — the
 * application-side retry helper (`writeUserSlugWithRetry`) is exercised in
 * `tests/utils/writeUserSlugWithRetry.unit.test.ts`. Without this index in
 * place the helper would have nothing to retry against.
 *
 * History: an earlier version of this suite tried to assert the NOT NULL
 * behaviour through Drizzle's insert builder, but Drizzle strips explicit
 * `null`s for columns that have a DEFAULT (Task #291 added one), so the
 * insert silently succeeded with the DEFAULT-generated slug and the
 * assertion failed every run. The new NOT NULL test below uses a raw
 * `pool.query` that bypasses the DEFAULT, which is exactly the bypass path
 * we want to harden against.
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
          `${suiteId}-null`,
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

  // Bypasses Drizzle entirely (and thereby the column's DEFAULT expression)
  // by using a raw `pool.query`, so we're really asserting the SQL-level
  // NOT NULL constraint is in place — not just Drizzle's TS-level type.
  it("rejects a raw INSERT with public_profile_slug = NULL (NOT NULL, 23502)", async () => {
    await expect(
      pool.query(
        "INSERT INTO users (username, password, public_profile_slug) VALUES ($1, $2, NULL)",
        [`${suiteId}-null`, "x"],
      ),
    ).rejects.toMatchObject({ code: "23502" });
  });
});
