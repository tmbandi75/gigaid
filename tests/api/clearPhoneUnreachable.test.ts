// End-to-end coverage for the manual auto-pause clear endpoint:
//   POST /api/admin/sms/users/:userId/clear-unreachable
//
// This is the only mechanism (besides the user successfully resuming
// from Settings) that re-enables outbound SMS for a number we previously
// concluded was unreachable. A regression here would either leave users
// silently auto-paused, leave the user-row state inconsistent, or skip
// the audit entry that records who flipped the flag.
//
// Verifies:
//   1. Missing reason returns 400 and leaves all four state fields
//      untouched on the user row.
//   2. With a reason the four state fields the streak tracker writes
//      (smsConfirmationFailureCount, smsConfirmationFirstFailureAt,
//      phoneUnreachable, phoneUnreachableAt) are all reset.
//   3. An admin_action_audit row with actionKey
//      "sms_clear_phone_unreachable" is written, and its payload column
//      preserves the previous values of those four fields so the change
//      is forensically reversible.

import { TEST_BASE_URL } from "../utils/env";

const BASE_URL = TEST_BASE_URL;

const dbDescribe =
  process.env.DATABASE_URL && process.env.APP_JWT_SECRET ? describe : describe.skip;

dbDescribe("POST /api/admin/sms/users/:userId/clear-unreachable", () => {
  jest.setTimeout(30000);

  const usernameSeed = `clear-unreachable-${Date.now()}`;
  const SEED_FAILURE_COUNT = 5;
  const SEED_FIRST_FAILURE_AT = new Date(
    Date.now() - 3 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const SEED_UNREACHABLE_AT = new Date(
    Date.now() - 1 * 24 * 60 * 60 * 1000,
  ).toISOString();

  let adminToken: string;
  let userDbId: string;

  beforeAll(async () => {
    const { signAppJwt } = await import("../../server/appJwt");
    const { db } = await import("../../server/db");
    const { users, adminActionAudit } = await import("@shared/schema");
    const { eq, and } = await import("drizzle-orm");

    // Bootstrap admin id default is "demo-user" (see ADMIN_USER_IDS in
    // server/copilot/adminMiddleware.ts). The JWT only needs sub to match
    // — the bootstrap check does not require a real users row.
    adminToken = signAppJwt({ sub: "demo-user", provider: "replit" });

    // Seed a real user row through storage to get all required columns,
    // then patch the four streak/auto-pause fields directly. The streak
    // tracker writes those fields from the resume-confirmation failure
    // pipeline; we don't need to drive the full pipeline here, just put
    // the row in the auto-paused state the admin endpoint clears.
    const { storage } = await import("../../server/storage");
    const created = await storage.createUser({
      username: usernameSeed,
      password: `clear-unreachable-test-${Date.now()}`,
    });
    userDbId = created.id;

    await db
      .update(users)
      .set({
        smsConfirmationFailureCount: SEED_FAILURE_COUNT,
        smsConfirmationFirstFailureAt: SEED_FIRST_FAILURE_AT,
        phoneUnreachable: true,
        phoneUnreachableAt: SEED_UNREACHABLE_AT,
      })
      .where(eq(users.id, userDbId));

    // Defensive cleanup of any leftover audit rows from prior runs.
    await db
      .delete(adminActionAudit)
      .where(
        and(
          eq(adminActionAudit.targetUserId, userDbId),
          eq(adminActionAudit.actionKey, "sms_clear_phone_unreachable"),
        ),
      );
  });

  afterAll(async () => {
    const { db } = await import("../../server/db");
    const { users, adminActionAudit } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");

    await db
      .delete(adminActionAudit)
      .where(eq(adminActionAudit.targetUserId, userDbId));
    await db.delete(users).where(eq(users.id, userDbId));
  });

  it("rejects the request with 400 when reason is missing and leaves all four fields untouched", async () => {
    const res = await fetch(
      `${BASE_URL}/api/admin/sms/users/${userDbId}/clear-unreachable`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({}),
      },
    );
    expect(res.status).toBe(400);
    const body = await res.json().catch(() => ({}));
    expect(body.error).toMatch(/reason/i);

    // None of the four fields may be touched on a rejected request.
    const { db } = await import("../../server/db");
    const { users, adminActionAudit } = await import("@shared/schema");
    const { eq, and } = await import("drizzle-orm");
    const [row] = await db
      .select({
        smsConfirmationFailureCount: users.smsConfirmationFailureCount,
        smsConfirmationFirstFailureAt: users.smsConfirmationFirstFailureAt,
        phoneUnreachable: users.phoneUnreachable,
        phoneUnreachableAt: users.phoneUnreachableAt,
      })
      .from(users)
      .where(eq(users.id, userDbId));
    expect(row?.smsConfirmationFailureCount).toBe(SEED_FAILURE_COUNT);
    expect(row?.smsConfirmationFirstFailureAt).toBe(SEED_FIRST_FAILURE_AT);
    expect(row?.phoneUnreachable).toBe(true);
    expect(row?.phoneUnreachableAt).toBe(SEED_UNREACHABLE_AT);

    // And no audit row may have been written for the rejected attempt.
    const auditRows = await db
      .select({ id: adminActionAudit.id })
      .from(adminActionAudit)
      .where(
        and(
          eq(adminActionAudit.targetUserId, userDbId),
          eq(adminActionAudit.actionKey, "sms_clear_phone_unreachable"),
        ),
      );
    expect(auditRows.length).toBe(0);
  });

  it("resets all four fields and writes an audit row whose payload preserves the previous values", async () => {
    const reason = "clear-unreachable-test-cleanup";
    const clearRes = await fetch(
      `${BASE_URL}/api/admin/sms/users/${userDbId}/clear-unreachable`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ reason }),
      },
    );
    expect(clearRes.status).toBe(200);
    const clearBody = await clearRes.json();
    expect(clearBody.success).toBe(true);
    expect(clearBody.userId).toBe(userDbId);
    // The route returns the previous values it just reset for caller
    // confirmation; assert the same shape lands in the response body.
    expect(clearBody.previous).toBeDefined();
    expect(clearBody.previous.smsConfirmationFailureCount).toBe(SEED_FAILURE_COUNT);
    expect(clearBody.previous.smsConfirmationFirstFailureAt).toBe(SEED_FIRST_FAILURE_AT);
    expect(clearBody.previous.phoneUnreachable).toBe(true);
    expect(clearBody.previous.phoneUnreachableAt).toBe(SEED_UNREACHABLE_AT);

    const { db } = await import("../../server/db");
    const { users, adminActionAudit } = await import("@shared/schema");
    const { eq, and, desc } = await import("drizzle-orm");

    // All four state fields must be reset to their "healthy" values.
    const [row] = await db
      .select({
        smsConfirmationFailureCount: users.smsConfirmationFailureCount,
        smsConfirmationFirstFailureAt: users.smsConfirmationFirstFailureAt,
        phoneUnreachable: users.phoneUnreachable,
        phoneUnreachableAt: users.phoneUnreachableAt,
      })
      .from(users)
      .where(eq(users.id, userDbId));
    expect(row?.smsConfirmationFailureCount).toBe(0);
    expect(row?.smsConfirmationFirstFailureAt).toBeNull();
    expect(row?.phoneUnreachable).toBe(false);
    expect(row?.phoneUnreachableAt).toBeNull();

    // An audit row was written with the locked actionKey + reason.
    const auditRows = await db
      .select({
        actionKey: adminActionAudit.actionKey,
        targetUserId: adminActionAudit.targetUserId,
        reason: adminActionAudit.reason,
        payload: adminActionAudit.payload,
        source: adminActionAudit.source,
      })
      .from(adminActionAudit)
      .where(
        and(
          eq(adminActionAudit.targetUserId, userDbId),
          eq(adminActionAudit.actionKey, "sms_clear_phone_unreachable"),
        ),
      )
      .orderBy(desc(adminActionAudit.createdAt))
      .limit(1);
    expect(auditRows.length).toBe(1);
    expect(auditRows[0].reason).toBe(reason);
    expect(auditRows[0].source).toBe("admin_ui");

    // Payload preserves the previous values of all four reset fields so
    // the destructive change is reversible from the audit log alone.
    const payload = JSON.parse(auditRows[0].payload || "{}");
    expect(payload.smsConfirmationFailureCount).toBe(SEED_FAILURE_COUNT);
    expect(payload.smsConfirmationFirstFailureAt).toBe(SEED_FIRST_FAILURE_AT);
    expect(payload.phoneUnreachable).toBe(true);
    expect(payload.phoneUnreachableAt).toBe(SEED_UNREACHABLE_AT);
  });
});
