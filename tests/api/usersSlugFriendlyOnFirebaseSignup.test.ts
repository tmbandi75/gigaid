/**
 * Application-layer regression for the booking-link safety net on the
 * Firebase signup paths (Task #303).
 *
 * Sister test to `usersSlugFriendlyOnCreateUser.test.ts`, which only covers
 * the password-based `db-storage.ts#createUser` route. Mobile and web
 * Firebase signup handlers in `server/mobileAuthRoutes.ts` deliberately
 * bypass `createUser` and derive the slug themselves via the parallel
 * helper `deriveBaseSlugForFirebaseSignup`, then insert the user inline
 * with `writeUserSlugWithRetry`. That helper is otherwise untested, so a
 * regression there (e.g. swapping the priority order or accidentally
 * returning the legacy `user-<hex>` placeholder when a friendly identifier
 * IS available) would silently ship generic booking links to every
 * Google/Apple/email Firebase signup without anything failing.
 *
 * This test invokes `deriveBaseSlugForFirebaseSignup` and then runs the
 * exact same `writeUserSlugWithRetry` + `db.insert(users)` flow the route
 * uses (see `mobileAuthRoutes.ts` lines ~311 and ~586). It asserts the
 * created account ends up with a friendly, name-/email-derived slug — not
 * the `user-<hex>` fallback.
 *
 * Skipped automatically when DATABASE_URL is not set so the suite stays
 * runnable on a clean local checkout without a live database.
 */

const HAS_DB = !!process.env.DATABASE_URL;
const d = HAS_DB ? describe : describe.skip;

d("Firebase signup derives a friendly booking slug (application-layer safety net)", () => {
  let db: typeof import("../../server/db")["db"];
  let pool: typeof import("../../server/db")["pool"];
  let schema: typeof import("../../shared/schema");
  let storage: typeof import("../../server/storage")["storage"];
  let deriveBaseSlugForFirebaseSignup: typeof import("../../server/mobileAuthRoutes")["deriveBaseSlugForFirebaseSignup"];
  let writeUserSlugWithRetry: typeof import("../../server/lib/bookingSlug")["writeUserSlugWithRetry"];
  let inArray: typeof import("drizzle-orm")["inArray"];
  let suiteId: string;
  const createdUsernames: string[] = [];

  beforeAll(async () => {
    ({ db, pool } = await import("../../server/db"));
    schema = await import("../../shared/schema");
    ({ storage } = await import("../../server/storage"));
    ({ deriveBaseSlugForFirebaseSignup } = await import(
      "../../server/mobileAuthRoutes"
    ));
    ({ writeUserSlugWithRetry } = await import("../../server/lib/bookingSlug"));
    ({ inArray } = await import("drizzle-orm"));
    suiteId = `slug-fbsignup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

  // The placeholder we explicitly DO NOT want the Firebase signup path to
  // hand back when any friendly identifier (name / email) is available.
  const LEGACY_PLACEHOLDER = /^user-[a-f0-9]{8}$/;

  // Mirrors the route insert in `mobileAuthRoutes.ts` so the test exercises
  // the same code path a real /mobile/firebase or /web/firebase signup hits
  // — minus the Firebase token verification, which is irrelevant to the
  // slug-friendliness contract under test.
  async function simulateFirebaseSignup(args: {
    name?: string | null;
    email?: string | null;
    firebaseUid: string;
  }) {
    const username = args.email
      ? args.email.toLowerCase().trim()
      : `firebase_${args.firebaseUid}`;
    createdUsernames.push(username);

    const baseSlug = deriveBaseSlugForFirebaseSignup({
      name: args.name,
      email: args.email,
      username,
      fallbackId: args.firebaseUid,
    });

    const now = new Date().toISOString();
    const { result: row } = await writeUserSlugWithRetry(
      baseSlug,
      async (publicProfileSlug) => {
        const [inserted] = await db
          .insert(schema.users)
          .values({
            username,
            password: "",
            email: args.email ?? undefined,
            emailNormalized: args.email
              ? args.email.toLowerCase().trim()
              : undefined,
            name: args.name ?? undefined,
            firebaseUid: args.firebaseUid,
            authProvider: "firebase",
            publicProfileSlug,
            createdAt: now,
            updatedAt: now,
            onboardingState: "not_started",
          })
          .returning();
        return inserted;
      },
      { checkExists: (s) => storage.slugExists(s) },
    );

    return row;
  }

  it("derives the slug from `name` for a Google/Apple-style Firebase signup", async () => {
    const user = await simulateFirebaseSignup({
      name: "Larry Payne",
      email: `${suiteId}-name@gigaid.test`,
      firebaseUid: `${suiteId}-name-uid`,
    });

    expect(user.publicProfileSlug).not.toBeNull();
    expect(user.publicProfileSlug).not.toMatch(LEGACY_PLACEHOLDER);
    // Allow a `-N` suffix in case a previous test run on the same DB
    // already claimed the bare slug — uniqueness is the retry helper's
    // job, not this test's. The friendliness contract is the prefix.
    expect(user.publicProfileSlug).toMatch(/^larry-payne(-\d+)?$/);
  });

  it("derives a friendly slug from the email local-part when `name` is missing (Apple anonymous-relay shape)", async () => {
    // Apple "Hide My Email" signups arrive with no display name — only an
    // email. The route MUST still produce a friendly slug derived from the
    // email rather than falling back to `user-<hex>`. Note: the route sets
    // `username = emailNormalized`, so `generateBookingSlug` slugifies the
    // full email (local-part + domain, truncated to 48 chars). That's still
    // friendly — what matters is the slug starts with the user's
    // recognizable local-part, not the legacy placeholder.
    const localPart = `tina-${suiteId}`;
    const user = await simulateFirebaseSignup({
      name: null,
      email: `${localPart}@gigaid.test`,
      firebaseUid: `${suiteId}-email-uid`,
    });

    expect(user.publicProfileSlug).not.toBeNull();
    expect(user.publicProfileSlug).not.toMatch(LEGACY_PLACEHOLDER);
    // Prefix match: the slug must start with the email local-part. Anything
    // after that (the slugified domain, optional `-N` uniqueness suffix) is
    // implementation detail not covered by the friendliness contract.
    expect(user.publicProfileSlug).toMatch(new RegExp(`^${localPart}`));
  });
});
