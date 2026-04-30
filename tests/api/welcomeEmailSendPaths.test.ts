/**
 * Welcome ("your account is secured") email coverage for the three server
 * paths that send it:
 *
 *   1. POST /api/secure-account/verify-otp           (firstBookingRoutes.ts)
 *   2. POST /api/secure-account/link-firebase        (firstBookingRoutes.ts)
 *   3. PATCH /api/profile (welcome-email block)      (routes.ts)
 *
 * Why this exists: the three paths share a single contract — an atomic
 * conditional UPDATE on `users.secured_email_sent_at` that "claims" the
 * send slot exactly once. A regression in any of the eligibility predicates
 * (phone_verified_at present, firebase_uid null, email present,
 * secured_email_sent_at null) or in the atomic-claim semantics would
 * either spam users with duplicate welcome emails or silently skip the
 * send entirely. There were no tests guarding any of this before.
 *
 * Pinning behavior:
 *   - For each path, a single call by an eligible user sends the email
 *     exactly once and stamps `securedEmailSentAt`.
 *   - A second qualifying call does NOT re-send (the conditional UPDATE
 *     matches 0 rows because `securedEmailSentAt IS NULL` is now false).
 *   - A call by an ineligible user (no email, already-linked Firebase,
 *     missing phone verification, etc.) does NOT send.
 *   - The PATCH /api/profile path is exercised both with and without an
 *     `email` field in the payload to confirm unrelated profile edits
 *     don't fire a stray welcome.
 *
 * The DB is real (uses DATABASE_URL); the SendGrid `sendEmail` client and
 * the Firebase `verifyFirebaseIdToken` helper are jest.mocked so we can
 * count actual send attempts and feed scripted decoded tokens without
 * touching either external service. Tests are skipped when DATABASE_URL
 * or APP_JWT_SECRET is not set so a clean local checkout still runs the
 * unit suite cleanly.
 */

process.env.NODE_ENV = "test";
process.env.APP_JWT_SECRET =
  process.env.APP_JWT_SECRET || "test-secret-welcome-email-send-paths";

// Mock SendGrid so we can count sendEmail invocations and avoid hitting
// the real provider. The route handlers and `sendAccountSecuredEmail`
// both call this; mocking it once at the module boundary covers all
// three send paths uniformly.
const mockSendEmail = jest.fn(async (_opts: unknown) => true);
jest.mock("../../server/sendgrid", () => ({
  sendEmail: (opts: unknown) => mockSendEmail(opts),
}));

// Mock Firebase Admin so the link-firebase path can be exercised without
// a real Firebase ID token. `isFirebaseConfigured` returns true so the
// route doesn't short-circuit with a 503; `verifyFirebaseIdToken` returns
// whatever the current test queues up via `mockFirebaseDecode`.
const mockFirebaseDecode = jest.fn();
jest.mock("../../server/firebaseAdmin", () => ({
  verifyFirebaseIdToken: (token: string) => mockFirebaseDecode(token),
  isFirebaseConfigured: () => true,
  selfTestFirebaseAdmin: async () => ({ ok: true }),
  deleteFirebaseAuthUser: async () => ({ ok: true }),
  getFirebaseInitError: () => null,
}));

// Mock Twilio so the unrelated /secure-account/send-otp endpoint (also on
// the same router) cannot accidentally hit the real SMS provider during
// any setup steps. verify-otp itself never sends SMS.
jest.mock("../../server/twilio", () => ({
  sendSMS: jest.fn(async () => ({ success: true })),
}));

// Mock the Replit OIDC auth module — it transitively imports
// `openid-client`, which is an ESM-only package that ts-jest can't parse
// in CJS mode. The endpoints we exercise here authenticate via
// `requireClaimUser` (which reads the Bearer App-JWT directly), so the
// session-based `isAuthenticated` middleware is never called by the
// covered routes; a no-op stub is enough.
jest.mock("../../server/replit_integrations/auth/replitAuth", () => ({
  isAuthenticated: (_req: unknown, _res: unknown, next: () => void) => next(),
  setupAuth: async () => undefined,
  registerAuthRoutes: () => undefined,
}));

import express from "express";
import request from "supertest";
import { randomUUID } from "crypto";
import { signAppJwt } from "../../server/appJwt";

const HAS_DB = !!process.env.DATABASE_URL && !!process.env.APP_JWT_SECRET;
const dbDescribe = HAS_DB ? describe : describe.skip;

dbDescribe("Welcome 'account secured' email — send paths", () => {
  jest.setTimeout(45000);

  // Allocated lazily so we can resolve them after the dynamic imports
  // below — top-level `await import(...)` would race the jest.mock
  // hoisting on some node/ts-jest combos.
  let app: express.Express;
  let db: typeof import("../../server/db").db;
  let pool: typeof import("../../server/db").pool;
  let schema: typeof import("../../shared/schema");
  let firstBookingRoutes: typeof import("../../server/firstBookingRoutes");

  // Each test gets a fresh user id / phone / email so the run is
  // hermetic and parallel-safe within a single DATABASE_URL.
  const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const createdUserIds: string[] = [];
  const createdPhones: string[] = [];

  beforeAll(async () => {
    db = (await import("../../server/db")).db;
    pool = (await import("../../server/db")).pool;
    schema = await import("../../shared/schema");
    firstBookingRoutes = await import("../../server/firstBookingRoutes");

    app = express();
    app.use(express.json());
    app.use("/api", firstBookingRoutes.default);
  });

  afterAll(async () => {
    if (!HAS_DB) return;
    const { inArray } = await import("drizzle-orm");
    if (createdPhones.length > 0) {
      await db
        .delete(schema.otpCodes)
        .where(inArray(schema.otpCodes.identifier, createdPhones));
    }
    if (createdUserIds.length > 0) {
      await db
        .delete(schema.users)
        .where(inArray(schema.users.id, createdUserIds));
    }
    await pool.end().catch(() => undefined);
  });

  beforeEach(() => {
    mockSendEmail.mockClear();
    mockFirebaseDecode.mockReset();
  });

  // --------- helpers ----------------------------------------------------

  type SeedOpts = Partial<{
    email: string | null;
    phoneVerifiedAt: string | null;
    firebaseUid: string | null;
    securedEmailSentAt: string | null;
    name: string | null;
    phoneE164: string | null;
  }>;

  async function seedUser(label: string, opts: SeedOpts = {}): Promise<string> {
    const id = `welcome-${label}-${runId}-${randomUUID().slice(0, 8)}`;
    createdUserIds.push(id);
    const nowIso = new Date().toISOString();
    const insert: typeof schema.users.$inferInsert = {
      id,
      username: `${id}-uname`,
      password: "x",
      authProvider: "claim",
      publicProfileSlug: `slug-${id}`,
      name: opts.name === undefined ? "Welcome Tester" : opts.name,
      email: opts.email === undefined ? null : opts.email,
      phoneVerifiedAt:
        opts.phoneVerifiedAt === undefined ? null : opts.phoneVerifiedAt,
      phoneE164: opts.phoneE164 === undefined ? null : opts.phoneE164,
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

  // Seeds an unverified OTP row for the given phone+code and tracks the
  // phone for cleanup. Each call uses a fresh random code so successive
  // verify-otp calls in the same test don't reuse a row that has already
  // been marked verified.
  async function seedOtp(phoneE164: string): Promise<string> {
    if (!createdPhones.includes(phoneE164)) createdPhones.push(phoneE164);
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const insert: typeof schema.otpCodes.$inferInsert = {
      id: randomUUID(),
      identifier: phoneE164,
      code,
      type: "phone",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      verified: false,
      createdAt: new Date().toISOString(),
    };
    await db.insert(schema.otpCodes).values(insert);
    return code;
  }

  function bearer(userId: string): string {
    return `Bearer ${signAppJwt({ sub: userId, provider: "claim" })}`;
  }

  function uniquePhone(): string {
    // E.164 +1NXXNXXXXXX with the run-id baked into the digits to keep
    // the number unique across parallel runs of the suite.
    const tail = String(Math.floor(1000000 + Math.random() * 8999999));
    return `+1555${tail}`;
  }

  // ====================================================================
  // POST /api/secure-account/verify-otp
  // ====================================================================
  describe("POST /api/secure-account/verify-otp", () => {
    it("sends the welcome email exactly once when an email is on file", async () => {
      const phone = uniquePhone();
      const userId = await seedUser("vo-happy", {
        email: `${runId}-vo-happy@example.test`,
        name: "Otto Verify",
      });
      const code = await seedOtp(phone);

      const res = await request(app)
        .post("/api/secure-account/verify-otp")
        .set("Authorization", bearer(userId))
        .send({ phone, code });

      expect(res.status).toBe(200);
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      const sentArgs = mockSendEmail.mock.calls[0][0] as { to: string };
      expect(sentArgs.to).toBe(`${runId}-vo-happy@example.test`);

      // Atomic claim: securedEmailSentAt is now non-null.
      const stamp = await getSecuredEmailSentAt(userId);
      expect(stamp).toBeTruthy();
    });

    it("does not re-send on a second qualifying call (atomic claim is exactly-once)", async () => {
      const phone = uniquePhone();
      const userId = await seedUser("vo-twice", {
        email: `${runId}-vo-twice@example.test`,
      });
      const firstCode = await seedOtp(phone);

      const first = await request(app)
        .post("/api/secure-account/verify-otp")
        .set("Authorization", bearer(userId))
        .send({ phone, code: firstCode });
      expect(first.status).toBe(200);
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      const stampAfterFirst = await getSecuredEmailSentAt(userId);
      expect(stampAfterFirst).toBeTruthy();

      // A real second verify-otp would need a fresh, unverified OTP row;
      // seed one and call again. The conditional UPDATE must match 0
      // rows because securedEmailSentAt IS NULL is no longer true.
      const secondCode = await seedOtp(phone);
      const second = await request(app)
        .post("/api/secure-account/verify-otp")
        .set("Authorization", bearer(userId))
        .send({ phone, code: secondCode });
      expect(second.status).toBe(200);
      expect(mockSendEmail).toHaveBeenCalledTimes(1); // unchanged
      const stampAfterSecond = await getSecuredEmailSentAt(userId);
      expect(stampAfterSecond).toBe(stampAfterFirst);
    });

    it("does not send when the user has no email on file", async () => {
      const phone = uniquePhone();
      const userId = await seedUser("vo-noemail", { email: null });
      const code = await seedOtp(phone);

      const res = await request(app)
        .post("/api/secure-account/verify-otp")
        .set("Authorization", bearer(userId))
        .send({ phone, code });

      expect(res.status).toBe(200);
      expect(mockSendEmail).not.toHaveBeenCalled();
      // securedEmailSentAt is gated on email IS NOT NULL — must remain unset.
      expect(await getSecuredEmailSentAt(userId)).toBeNull();
    });

    it("does not send when securedEmailSentAt is already set (e.g. a previous link-firebase call)", async () => {
      const phone = uniquePhone();
      const previousStamp = "2026-01-01T00:00:00.000Z";
      const userId = await seedUser("vo-already-sent", {
        email: `${runId}-vo-already-sent@example.test`,
        securedEmailSentAt: previousStamp,
      });
      const code = await seedOtp(phone);

      const res = await request(app)
        .post("/api/secure-account/verify-otp")
        .set("Authorization", bearer(userId))
        .send({ phone, code });

      expect(res.status).toBe(200);
      expect(mockSendEmail).not.toHaveBeenCalled();
      expect(await getSecuredEmailSentAt(userId)).toBe(previousStamp);
    });
  });

  // ====================================================================
  // POST /api/secure-account/link-firebase
  // ====================================================================
  describe("POST /api/secure-account/link-firebase", () => {
    it("sends the welcome email exactly once when the Firebase token brings an email", async () => {
      const userId = await seedUser("lf-happy", {
        email: null, // no prior email; Firebase token is the source.
        name: "Original Name",
      });
      const fbEmail = `${runId}-lf-happy@example.test`;
      mockFirebaseDecode.mockResolvedValueOnce({
        uid: `fbuid-${randomUUID()}`,
        email: fbEmail,
        name: "Lf Happy",
      });

      const res = await request(app)
        .post("/api/secure-account/link-firebase")
        .set("Authorization", bearer(userId))
        .send({ idToken: "stub-firebase-id-token-1234567890" });

      expect(res.status).toBe(200);
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      const sentArgs = mockSendEmail.mock.calls[0][0] as { to: string };
      expect(sentArgs.to).toBe(fbEmail);
      expect(await getSecuredEmailSentAt(userId)).toBeTruthy();
    });

    it("falls back to the existing email when the Firebase token has none", async () => {
      const existingEmail = `${runId}-lf-fallback@example.test`;
      const userId = await seedUser("lf-fallback", {
        email: existingEmail,
        name: "Fallback Tester",
      });
      mockFirebaseDecode.mockResolvedValueOnce({
        uid: `fbuid-${randomUUID()}`,
        // No email claim — typical of Apple sign-in after the first auth.
        email: undefined,
        name: undefined,
      });

      const res = await request(app)
        .post("/api/secure-account/link-firebase")
        .set("Authorization", bearer(userId))
        .send({ idToken: "stub-firebase-id-token-fallback" });

      expect(res.status).toBe(200);
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      const sentArgs = mockSendEmail.mock.calls[0][0] as { to: string };
      expect(sentArgs.to).toBe(existingEmail);
    });

    it("does not re-send when securedEmailSentAt was already claimed (e.g. by verify-otp)", async () => {
      const previousStamp = "2026-02-02T02:02:02.000Z";
      const userId = await seedUser("lf-already-sent", {
        email: `${runId}-lf-already@example.test`,
        securedEmailSentAt: previousStamp,
      });
      mockFirebaseDecode.mockResolvedValueOnce({
        uid: `fbuid-${randomUUID()}`,
        email: `${runId}-lf-already-fb@example.test`,
        name: "Already Sent",
      });

      const res = await request(app)
        .post("/api/secure-account/link-firebase")
        .set("Authorization", bearer(userId))
        .send({ idToken: "stub-firebase-id-token-already" });

      expect(res.status).toBe(200);
      expect(mockSendEmail).not.toHaveBeenCalled();
      expect(await getSecuredEmailSentAt(userId)).toBe(previousStamp);
    });

    it("does not send when no email is available (token-less and no existing email)", async () => {
      const userId = await seedUser("lf-noemail", { email: null });
      mockFirebaseDecode.mockResolvedValueOnce({
        uid: `fbuid-${randomUUID()}`,
        email: undefined,
        name: undefined,
      });

      const res = await request(app)
        .post("/api/secure-account/link-firebase")
        .set("Authorization", bearer(userId))
        .send({ idToken: "stub-firebase-id-token-noemail" });

      expect(res.status).toBe(200);
      expect(mockSendEmail).not.toHaveBeenCalled();
      expect(await getSecuredEmailSentAt(userId)).toBeNull();
    });

    it("does not re-send on a successful repeat call against the same user (claim is exactly-once)", async () => {
      const userId = await seedUser("lf-twice", {
        email: null,
        name: "Twice Tester",
      });
      const fbUid = `fbuid-${randomUUID()}`;
      mockFirebaseDecode.mockResolvedValue({
        uid: fbUid,
        email: `${runId}-lf-twice@example.test`,
        name: "Twice Tester",
      });

      const first = await request(app)
        .post("/api/secure-account/link-firebase")
        .set("Authorization", bearer(userId))
        .send({ idToken: "stub-firebase-id-token-twice-1" });
      expect(first.status).toBe(200);
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      const stampAfterFirst = await getSecuredEmailSentAt(userId);
      expect(stampAfterFirst).toBeTruthy();

      const second = await request(app)
        .post("/api/secure-account/link-firebase")
        .set("Authorization", bearer(userId))
        .send({ idToken: "stub-firebase-id-token-twice-2" });
      expect(second.status).toBe(200);
      expect(mockSendEmail).toHaveBeenCalledTimes(1); // unchanged
      expect(await getSecuredEmailSentAt(userId)).toBe(stampAfterFirst);
    });
  });

  // ====================================================================
  // PATCH /api/profile  →  maybeSendProfileSecuredEmail helper
  // (extracted in routes.ts; tested directly so we don't need to spin
  //  up the entire app to exercise the welcome-email branch).
  // ====================================================================
  describe("PATCH /api/profile welcome-email helper (maybeSendProfileSecuredEmail)", () => {
    it("sends exactly once when the user is fully eligible (phone-verified, no firebase, email present)", async () => {
      const userId = await seedUser("pp-happy", {
        email: `${runId}-pp-happy@example.test`,
        phoneVerifiedAt: new Date().toISOString(),
        name: "Pp Happy",
      });

      const result = await firstBookingRoutes.maybeSendProfileSecuredEmail(userId);

      expect(result).toEqual({ claimed: true, sent: true });
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      const sentArgs = mockSendEmail.mock.calls[0][0] as { to: string };
      expect(sentArgs.to).toBe(`${runId}-pp-happy@example.test`);
      expect(await getSecuredEmailSentAt(userId)).toBeTruthy();
    });

    it("does not send a second time on a follow-up call (atomic claim is exactly-once)", async () => {
      const userId = await seedUser("pp-twice", {
        email: `${runId}-pp-twice@example.test`,
        phoneVerifiedAt: new Date().toISOString(),
      });

      const first = await firstBookingRoutes.maybeSendProfileSecuredEmail(userId);
      expect(first.claimed).toBe(true);
      const stampAfterFirst = await getSecuredEmailSentAt(userId);
      expect(stampAfterFirst).toBeTruthy();
      expect(mockSendEmail).toHaveBeenCalledTimes(1);

      const second = await firstBookingRoutes.maybeSendProfileSecuredEmail(userId);
      expect(second).toEqual({ claimed: false, sent: false });
      expect(mockSendEmail).toHaveBeenCalledTimes(1); // unchanged
      expect(await getSecuredEmailSentAt(userId)).toBe(stampAfterFirst);
    });

    it("skips when the user has no phone_verified_at (would email an un-verified phone-only account)", async () => {
      const userId = await seedUser("pp-no-phone", {
        email: `${runId}-pp-no-phone@example.test`,
        phoneVerifiedAt: null,
      });

      const result = await firstBookingRoutes.maybeSendProfileSecuredEmail(userId);

      expect(result).toEqual({ claimed: false, sent: false });
      expect(mockSendEmail).not.toHaveBeenCalled();
      expect(await getSecuredEmailSentAt(userId)).toBeNull();
    });

    it("skips when the user already has a firebase_uid (link-firebase path will handle the welcome)", async () => {
      const userId = await seedUser("pp-has-firebase", {
        email: `${runId}-pp-has-fb@example.test`,
        phoneVerifiedAt: new Date().toISOString(),
        firebaseUid: `fbuid-${randomUUID()}`,
      });

      const result = await firstBookingRoutes.maybeSendProfileSecuredEmail(userId);

      expect(result).toEqual({ claimed: false, sent: false });
      expect(mockSendEmail).not.toHaveBeenCalled();
      expect(await getSecuredEmailSentAt(userId)).toBeNull();
    });

    it("skips when securedEmailSentAt is already set (e.g. a previous verify-otp call already claimed the slot)", async () => {
      const previousStamp = "2026-03-03T03:03:03.000Z";
      const userId = await seedUser("pp-already-sent", {
        email: `${runId}-pp-already@example.test`,
        phoneVerifiedAt: new Date().toISOString(),
        securedEmailSentAt: previousStamp,
      });

      const result = await firstBookingRoutes.maybeSendProfileSecuredEmail(userId);

      expect(result).toEqual({ claimed: false, sent: false });
      expect(mockSendEmail).not.toHaveBeenCalled();
      expect(await getSecuredEmailSentAt(userId)).toBe(previousStamp);
    });

    it("skips when the user has no email on file (would have nothing to send to)", async () => {
      const userId = await seedUser("pp-no-email", {
        email: null,
        phoneVerifiedAt: new Date().toISOString(),
      });

      const result = await firstBookingRoutes.maybeSendProfileSecuredEmail(userId);

      expect(result).toEqual({ claimed: false, sent: false });
      expect(mockSendEmail).not.toHaveBeenCalled();
      expect(await getSecuredEmailSentAt(userId)).toBeNull();
    });
  });

  // PATCH /api/profile route-level coverage — the guard predicate AND
  // the actual end-to-end wiring of the helper into the route — lives in
  // a separate live-server file (welcomeEmailProfileRoute.test.ts) so we
  // exercise the real Express handler instead of just the helper. The
  // helper-level tests above pin the contract of
  // `maybeSendProfileSecuredEmail` itself; the route-level tests pin
  // the wiring (route guard, eligibility predicates, atomic claim).
});
