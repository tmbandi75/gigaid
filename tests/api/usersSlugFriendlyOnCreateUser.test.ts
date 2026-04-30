/**
 * Application-layer regression for the booking-link safety net (Task #297).
 *
 * Sister test to `tests/api/usersSlugDefault.test.ts`, which only proves the
 * Postgres column DEFAULT (`'user-' || substring(gen_random_uuid()::text,1,8)`)
 * fires when an insert omits `public_profile_slug`. That DB-level safety net
 * is real, but it would happily mask a regression in the *application* path
 * — `db-storage.ts#createUser` derives a friendly, name-/email-based slug
 * via `computeBaseSlugForNewUser` BEFORE the row ever reaches Postgres, so
 * the DB DEFAULT is never exercised on the happy signup path.
 *
 * If `computeBaseSlugForNewUser` (or `generateBookingSlug` underneath it)
 * silently returned an empty string, every new account would still come back
 * with a non-null slug — but it would be a generic `user-xxxxxxxx` placeholder
 * instead of `larry-payne` / `larrys-auto`. Booking pages would technically
 * work, share funnel would technically have a URL, but the "this looks like
 * MY business" promise would quietly break. This test asserts that the
 * application layer produces the friendly slug we promise users.
 *
 * Skipped automatically when DATABASE_URL is not set so the suite stays
 * runnable on a clean local checkout without a live database.
 */

const HAS_DB = !!process.env.DATABASE_URL;
const d = HAS_DB ? describe : describe.skip;

d("createUser derives a friendly booking slug (application-layer safety net)", () => {
  let db: typeof import("../../server/db")["db"];
  let pool: typeof import("../../server/db")["pool"];
  let schema: typeof import("../../shared/schema");
  let dbStorage: typeof import("../../server/db-storage")["dbStorage"];
  let inArray: typeof import("drizzle-orm")["inArray"];
  let suiteId: string;
  const createdUsernames: string[] = [];

  beforeAll(async () => {
    ({ db, pool } = await import("../../server/db"));
    schema = await import("../../shared/schema");
    ({ dbStorage } = await import("../../server/db-storage"));
    ({ inArray } = await import("drizzle-orm"));
    suiteId = `slug-friendly-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  });

  afterAll(async () => {
    if (!HAS_DB) return;
    if (createdUsernames.length > 0) {
      await db
        .delete(schema.users)
        .where(inArray(schema.users.username, createdUsernames));
    }
    await pool.end().catch(() => undefined);
  });

  // The placeholder we explicitly DO NOT want createUser to hand back when
  // any friendly identifier (name / businessName / email) is available.
  const LEGACY_PLACEHOLDER = /^user-[a-f0-9]{8}$/;

  it("derives the slug from `name` when provided", async () => {
    const username = `${suiteId}-name`;
    createdUsernames.push(username);

    const user = await dbStorage.createUser({
      username,
      password: "x",
      name: "Larry Payne",
    } as any);

    expect(user.publicProfileSlug).not.toBeNull();
    expect(user.publicProfileSlug).not.toMatch(LEGACY_PLACEHOLDER);
    // Allow a `-N` suffix in case a previous test run on the same DB already
    // claimed the bare slug — uniqueness is the retry helper's job, not this
    // test's. The friendliness contract is the prefix.
    expect(user.publicProfileSlug).toMatch(/^larry-payne(-\d+)?$/);
  });

  it("prefers `businessName` over `name` when both are provided", async () => {
    const username = `${suiteId}-biz`;
    createdUsernames.push(username);

    const user = await dbStorage.createUser({
      username,
      password: "x",
      name: "Larry Payne",
      businessName: "Larry's Auto Shop",
    } as any);

    expect(user.publicProfileSlug).not.toBeNull();
    expect(user.publicProfileSlug).not.toMatch(LEGACY_PLACEHOLDER);
    expect(user.publicProfileSlug).toMatch(/^larrys-auto-shop(-\d+)?$/);
  });

  it("derives a friendly slug from `username` when no name/businessName is set (phone-OTP signup shape)", async () => {
    // Phone-OTP signups land in `createUser` with no name/businessName/email
    // — just an auto-generated `phone-<digits>` username. The application
    // layer must STILL produce a non-placeholder slug from that username so
    // these accounts don't ship with `user-xxxxxxxx` while waiting for the
    // user to fill in profile details.
    const username = `tina-${suiteId}`;
    createdUsernames.push(username);

    const user = await dbStorage.createUser({
      username,
      password: "x",
    } as any);

    expect(user.publicProfileSlug).not.toBeNull();
    expect(user.publicProfileSlug).not.toMatch(LEGACY_PLACEHOLDER);
    // The username already contains the suite id, so a prefix match is
    // both friendly AND collision-free across runs.
    expect(user.publicProfileSlug).toMatch(
      new RegExp(`^tina-${suiteId}(-\\d+)?$`),
    );
  });
});
