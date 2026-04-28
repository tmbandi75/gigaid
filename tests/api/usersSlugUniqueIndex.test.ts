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
 * Skipped automatically when DATABASE_URL is not set so the rest of the
 * suite stays runnable on a clean local checkout.
 */

const HAS_DB = !!process.env.DATABASE_URL;
const d = HAS_DB ? describe : describe.skip;

d("users.public_profile_slug partial unique index (DB-bound)", () => {
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
          `${suiteId}-null-a`,
          `${suiteId}-null-b`,
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

  it("allows multiple users to share NULL slug (partial index)", async () => {
    await db.insert(schema.users).values({
      username: `${suiteId}-null-a`,
      password: "x",
      publicProfileSlug: null,
    } as any);
    await db.insert(schema.users).values({
      username: `${suiteId}-null-b`,
      password: "x",
      publicProfileSlug: null,
    } as any);

    // No throw === partial index honored.
    expect(true).toBe(true);
  });
});
