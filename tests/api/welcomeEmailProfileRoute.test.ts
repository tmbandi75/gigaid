/**
 * End-to-end coverage for PATCH /api/profile's "your account is secured"
 * email send branch (the third send path covered by Task #299, alongside
 * the in-process tests for verify-otp and link-firebase in
 * `welcomeEmailSendPaths.test.ts`).
 *
 * The PATCH /api/profile route is registered inline inside the giant
 * `registerRoutes()` function, so mounting it via supertest in isolation
 * isn't realistic — `setupAuth` transitively pulls in `openid-client` (an
 * ESM-only package ts-jest can't parse), and the route depends on
 * dozens of other modules. Instead, we hit the actual running server
 * over the network and verify the contract via DB side effects:
 *
 *   - The atomic UPDATE on `users.secured_email_sent_at` is observable
 *     directly: a stamp appearing means the route's welcome-email branch
 *     ran and successfully claimed the send slot; a stamp NOT appearing
 *     means the eligibility predicate or the route guard skipped it.
 *   - `sendEmail` (server/sendgrid.ts) wraps every error in a try/catch
 *     and returns false, so even if SendGrid rejects the `.test`
 *     addresses we use here the route still returns 200 and the DB
 *     state we observe is unaffected.
 *
 * Cases (as required by the task spec):
 *   1. PATCH with an `email` field on an otherwise eligible user
 *      (phone_verified_at present, firebase_uid null, securedEmailSentAt
 *      null) → securedEmailSentAt is stamped.
 *   2. A second PATCH with `email` on the same user → stamp unchanged
 *      (atomic claim is exactly-once).
 *   3. PATCH WITHOUT an `email` field on an eligible user (e.g. only
 *      `name` changes) → securedEmailSentAt remains null. This is the
 *      "PATCH /api/profile exercised AND without email field" leg of
 *      the task spec.
 *   4. PATCH with `email` on a user with firebase_uid already set
 *      → no stamp (link-firebase path owns the welcome).
 *   5. PATCH with `email` on a user with no phone_verified_at → no
 *      stamp (phone OTP must precede the welcome).
 *
 * Skipped automatically when DATABASE_URL or APP_JWT_SECRET is missing,
 * matching the gate used by other live-server tests in this directory.
 */

import { TEST_BASE_URL } from "../utils/env";

const BASE_URL = TEST_BASE_URL;
const HAS_DB = !!process.env.DATABASE_URL && !!process.env.APP_JWT_SECRET;
const dbDescribe = HAS_DB ? describe : describe.skip;

dbDescribe("PATCH /api/profile — secure-account welcome email (route-level)", () => {
  jest.setTimeout(60000);

  let db: typeof import("../../server/db").db;
  let pool: typeof import("../../server/db").pool;
  let schema: typeof import("../../shared/schema");
  let signAppJwt: typeof import("../../server/appJwt").signAppJwt;

  const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    db = (await import("../../server/db")).db;
    pool = (await import("../../server/db")).pool;
    schema = await import("../../shared/schema");
    signAppJwt = (await import("../../server/appJwt")).signAppJwt;

    // Wait briefly for the live server to be reachable. Other live-server
    // tests in this suite assume the workflow is already running, so a
    // single readiness probe with a short retry budget keeps the test
    // file robust without slowing the suite when the server is up.
    const deadline = Date.now() + 30_000;
    let lastErr: unknown = null;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`${BASE_URL}/api/health`, {
          signal: AbortSignal.timeout(2_000),
        });
        if (res.ok || res.status === 404) break;
      } catch (err) {
        lastErr = err;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    if (Date.now() >= deadline) {
      throw new Error(
        `Live server at ${BASE_URL} did not become reachable in 30s: ${String(lastErr)}`,
      );
    }
  });

  afterAll(async () => {
    if (!HAS_DB) return;
    const { inArray } = await import("drizzle-orm");
    if (createdUserIds.length > 0) {
      await db
        .delete(schema.users)
        .where(inArray(schema.users.id, createdUserIds));
    }
    await pool.end().catch(() => undefined);
  });

  // --------- helpers ----------------------------------------------------

  type SeedOpts = Partial<{
    email: string | null;
    phoneVerifiedAt: string | null;
    firebaseUid: string | null;
    securedEmailSentAt: string | null;
    name: string | null;
  }>;

  // Seeds a user directly in Postgres (bypassing /api/test/create-user
  // because we need to set fields that helper doesn't expose, like
  // phoneVerifiedAt and firebaseUid). The user's id is also their JWT
  // subject — the live `isAuthenticated` middleware reads `req.userId`
  // from the App-JWT we mint below.
  async function seedUser(label: string, opts: SeedOpts = {}): Promise<string> {
    const { randomUUID } = await import("crypto");
    const id = `welcome-route-${label}-${runId}-${randomUUID().slice(0, 8)}`;
    createdUserIds.push(id);
    const nowIso = new Date().toISOString();
    const insert: typeof schema.users.$inferInsert = {
      id,
      username: `${id}-uname`,
      password: "x",
      authProvider: "claim",
      publicProfileSlug: `slug-${id}`,
      name: opts.name === undefined ? "Profile Route Tester" : opts.name,
      email: opts.email === undefined ? null : opts.email,
      phoneVerifiedAt:
        opts.phoneVerifiedAt === undefined ? null : opts.phoneVerifiedAt,
      firebaseUid: opts.firebaseUid === undefined ? null : opts.firebaseUid,
      securedEmailSentAt:
        opts.securedEmailSentAt === undefined ? null : opts.securedEmailSentAt,
      createdAt: nowIso,
    };
    await db.insert(schema.users).values(insert);
    return id;
  }

  async function getSecuredEmailSentAt(userId: string): Promise<string | null> {
    const { eq } = await import("drizzle-orm");
    const [row] = await db
      .select({ securedEmailSentAt: schema.users.securedEmailSentAt })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);
    return row?.securedEmailSentAt ?? null;
  }

  async function patchProfile(
    userId: string,
    body: Record<string, unknown>,
  ): Promise<{ status: number; data: any }> {
    const token = signAppJwt({ sub: userId, provider: "claim" });
    const res = await fetch(`${BASE_URL}/api/profile`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  }

  // ====================================================================

  it("stamps securedEmailSentAt when an eligible user PATCHes their email for the first time", async () => {
    const userId = await seedUser("happy", {
      email: null,
      phoneVerifiedAt: new Date().toISOString(),
    });
    expect(await getSecuredEmailSentAt(userId)).toBeNull();

    const newEmail = `discard-${runId}-happy@example.test`;
    const { status } = await patchProfile(userId, { email: newEmail });

    // The route returns 200 even if SendGrid rejects the `.test`
    // address — the welcome-email branch is in a try/catch and never
    // fails the profile update.
    expect(status).toBe(200);
    const stamp = await getSecuredEmailSentAt(userId);
    expect(stamp).toBeTruthy();
  });

  it("does not re-stamp on a second qualifying PATCH (atomic claim is exactly-once via the route)", async () => {
    const userId = await seedUser("twice", {
      email: null,
      phoneVerifiedAt: new Date().toISOString(),
    });

    const email = `discard-${runId}-twice@example.test`;
    const first = await patchProfile(userId, { email });
    expect(first.status).toBe(200);
    const stampAfterFirst = await getSecuredEmailSentAt(userId);
    expect(stampAfterFirst).toBeTruthy();

    // Same payload again. The conditional UPDATE inside the helper now
    // matches 0 rows because securedEmailSentAt IS NULL is no longer
    // true, so the stamp must remain unchanged.
    const second = await patchProfile(userId, { email });
    expect(second.status).toBe(200);
    const stampAfterSecond = await getSecuredEmailSentAt(userId);
    expect(stampAfterSecond).toBe(stampAfterFirst);
  });

  it("does not stamp when PATCH omits the email field (e.g. a name-only update on an eligible user)", async () => {
    const seededEmail = `discard-${runId}-noemail@example.test`;
    const userId = await seedUser("noemail-field", {
      // User already has every eligibility predicate satisfied EXCEPT
      // securedEmailSentAt — so if the route ignored the email guard
      // and called the helper anyway, the claim WOULD succeed and the
      // stamp WOULD appear. Verifying it stays null pins the guard.
      email: seededEmail,
      phoneVerifiedAt: new Date().toISOString(),
    });
    expect(await getSecuredEmailSentAt(userId)).toBeNull();

    const { status } = await patchProfile(userId, { name: "Name-Only Update" });
    expect(status).toBe(200);

    expect(await getSecuredEmailSentAt(userId)).toBeNull();
  });

  it("does not stamp when an empty-string email is sent (the guard requires a non-empty email)", async () => {
    const seededEmail = `discard-${runId}-empty@example.test`;
    const userId = await seedUser("empty-email", {
      email: seededEmail,
      phoneVerifiedAt: new Date().toISOString(),
    });

    const { status } = await patchProfile(userId, { email: "   " });
    expect(status).toBe(200);

    // The route's predicate is `email !== undefined && typeof email ===
    // "string" && email.trim()` — a whitespace-only payload must NOT
    // trigger the welcome branch.
    expect(await getSecuredEmailSentAt(userId)).toBeNull();
  });

  it("does not stamp when the user already has a firebase_uid (link-firebase owns the welcome)", async () => {
    const userId = await seedUser("has-firebase", {
      email: null,
      phoneVerifiedAt: new Date().toISOString(),
      firebaseUid: `fbuid-${runId}-${Math.random().toString(36).slice(2, 8)}`,
    });

    const { status } = await patchProfile(userId, {
      email: `discard-${runId}-fb@example.test`,
    });
    expect(status).toBe(200);

    expect(await getSecuredEmailSentAt(userId)).toBeNull();
  });

  it("does not stamp when the user has no phone_verified_at (eligibility requires a verified phone)", async () => {
    const userId = await seedUser("no-phone-verified", {
      email: null,
      phoneVerifiedAt: null,
    });

    const { status } = await patchProfile(userId, {
      email: `discard-${runId}-nopv@example.test`,
    });
    expect(status).toBe(200);

    expect(await getSecuredEmailSentAt(userId)).toBeNull();
  });
});
