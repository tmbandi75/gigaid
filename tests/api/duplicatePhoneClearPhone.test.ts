// End-to-end coverage for the duplicate-phone repair endpoint:
//   POST /api/admin/sms/users/:userId/clear-phone
//
// The pure grouping helper has its own unit suite
// (tests/utils/duplicatePhones.test.ts). This file exercises the live
// route + the chain that depends on it: after support clears one of the
// duplicate rows, a STOP webhook from that phone must opt out the
// surviving user instead of being blocked by the ambiguity guard.
//
// Verifies:
//   1. Missing reason returns 400.
//   2. With a reason the row's phone_e164 is nulled.
//   3. An admin_action_audit row with actionKey "sms_clear_phone_e164"
//      is written (so the destructive change is auditable).
//   4. A follow-up STOP webhook from the same phone now opts out the
//      remaining account that still owns the number.

import { TEST_BASE_URL } from "../utils/env";

const BASE_URL = TEST_BASE_URL;

const dbDescribe =
  process.env.DATABASE_URL && process.env.APP_JWT_SECRET ? describe : describe.skip;

dbDescribe("POST /api/admin/sms/users/:userId/clear-phone (duplicate phone repair)", () => {
  jest.setTimeout(30000);

  const SHARED_PHONE = `+1555${Date.now().toString().slice(-7)}`;
  const userIdToClear = `dup-phone-clear-${Date.now()}`;
  const userIdSurvivor = `dup-phone-survivor-${Date.now()}`;

  let adminToken: string;
  let clearedDbId: string;
  let survivorDbId: string;

  beforeAll(async () => {
    const { signAppJwt } = await import("../../server/appJwt");
    const { db } = await import("../../server/db");
    const { users, adminActionAudit, outboundMessages } = await import("@shared/schema");
    const { eq, and } = await import("drizzle-orm");

    // Bootstrap admin id default is "demo-user" (see ADMIN_USER_IDS in
    // server/copilot/adminMiddleware.ts). The JWT only needs sub to match
    // — the bootstrap check does not require a real users row.
    adminToken = signAppJwt({ sub: "demo-user", provider: "replit" });

    // Seed two real user rows that share the same phone_e164. We go
    // through storage so we get all required columns; then patch
    // phone_e164 directly because the test create-user endpoint doesn't
    // expose it.
    const { storage } = await import("../../server/storage");
    const created1 = await storage.createUser({
      username: userIdToClear,
      password: `dup-phone-test-${Date.now()}`,
    });
    const created2 = await storage.createUser({
      username: userIdSurvivor,
      password: `dup-phone-test-${Date.now() + 1}`,
    });
    clearedDbId = created1.id;
    survivorDbId = created2.id;

    await db
      .update(users)
      .set({ phoneE164: SHARED_PHONE, smsOptOut: false, smsOptOutAt: null, notifyBySms: true })
      .where(eq(users.id, clearedDbId));
    await db
      .update(users)
      .set({ phoneE164: SHARED_PHONE, smsOptOut: false, smsOptOutAt: null, notifyBySms: true })
      .where(eq(users.id, survivorDbId));

    // Sanity check: with both users sharing the phone, the STOP resolver
    // would refuse — that's the bug this endpoint exists to fix.
    const sharedRows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.phoneE164, SHARED_PHONE));
    expect(sharedRows.length).toBe(2);

    // Defensive cleanup of any leftover audit rows from prior runs.
    await db
      .delete(adminActionAudit)
      .where(
        and(
          eq(adminActionAudit.targetUserId, clearedDbId),
          eq(adminActionAudit.actionKey, "sms_clear_phone_e164"),
        ),
      );
    await db
      .delete(outboundMessages)
      .where(eq(outboundMessages.toAddress, SHARED_PHONE));
  });

  afterAll(async () => {
    const { db } = await import("../../server/db");
    const { users, adminActionAudit, outboundMessages } = await import("@shared/schema");
    const { eq, inArray } = await import("drizzle-orm");

    await db
      .delete(adminActionAudit)
      .where(inArray(adminActionAudit.targetUserId, [clearedDbId, survivorDbId]));
    await db
      .delete(outboundMessages)
      .where(eq(outboundMessages.toAddress, SHARED_PHONE));
    await db
      .delete(users)
      .where(inArray(users.id, [clearedDbId, survivorDbId]));
  });

  it("rejects the request with 400 when reason is missing", async () => {
    const res = await fetch(
      `${BASE_URL}/api/admin/sms/users/${clearedDbId}/clear-phone`,
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

    // Phone must NOT be cleared on a rejected request.
    const { db } = await import("../../server/db");
    const { users } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const [row] = await db
      .select({ phoneE164: users.phoneE164 })
      .from(users)
      .where(eq(users.id, clearedDbId));
    expect(row?.phoneE164).toBe(SHARED_PHONE);
  });

  it("clears the phone, writes an audit row, and lets a STOP webhook opt out the surviving user", async () => {
    // Step 1: clear the phone via the live admin route.
    const reason = "duplicate-phone-test-cleanup";
    const clearRes = await fetch(
      `${BASE_URL}/api/admin/sms/users/${clearedDbId}/clear-phone`,
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
    expect(clearBody.userId).toBe(clearedDbId);
    expect(clearBody.previousPhoneE164).toBe(SHARED_PHONE);

    const { db } = await import("../../server/db");
    const { users, adminActionAudit } = await import("@shared/schema");
    const { eq, and, desc } = await import("drizzle-orm");

    // Step 2: phone_e164 is now null on the cleared row.
    const [clearedRow] = await db
      .select({ phoneE164: users.phoneE164 })
      .from(users)
      .where(eq(users.id, clearedDbId));
    expect(clearedRow?.phoneE164).toBeNull();

    // Survivor still owns the phone.
    const [survivorRow] = await db
      .select({ phoneE164: users.phoneE164, smsOptOut: users.smsOptOut })
      .from(users)
      .where(eq(users.id, survivorDbId));
    expect(survivorRow?.phoneE164).toBe(SHARED_PHONE);
    expect(survivorRow?.smsOptOut).toBe(false);

    // Step 3: an audit row was written with the locked actionKey + reason.
    const auditRows = await db
      .select({
        actionKey: adminActionAudit.actionKey,
        targetUserId: adminActionAudit.targetUserId,
        reason: adminActionAudit.reason,
        payload: adminActionAudit.payload,
      })
      .from(adminActionAudit)
      .where(
        and(
          eq(adminActionAudit.targetUserId, clearedDbId),
          eq(adminActionAudit.actionKey, "sms_clear_phone_e164"),
        ),
      )
      .orderBy(desc(adminActionAudit.createdAt))
      .limit(1);
    expect(auditRows.length).toBe(1);
    expect(auditRows[0].reason).toBe(reason);
    // Payload preserves the previous phone so the change is reversible.
    const payload = JSON.parse(auditRows[0].payload || "{}");
    expect(payload.previousPhoneE164).toBe(SHARED_PHONE);

    // Step 4: a STOP webhook from that phone now opts out the survivor.
    // (Before the clear, the resolver would refuse because two users
    // shared the number — that ambiguity is exactly what the repair tool
    // resolves.)
    const stopRes = await fetch(`${BASE_URL}/api/twilio/sms`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        From: SHARED_PHONE,
        Body: "STOP",
        MessageSid: `SM-test-${Date.now()}`,
      }).toString(),
    });
    expect(stopRes.status).toBe(200);

    const [survivorAfter] = await db
      .select({ smsOptOut: users.smsOptOut, notifyBySms: users.notifyBySms })
      .from(users)
      .where(eq(users.id, survivorDbId));
    expect(survivorAfter?.smsOptOut).toBe(true);
    expect(survivorAfter?.notifyBySms).toBe(false);

    // The cleared user must NOT have been opted out — its phone is gone.
    const [clearedAfter] = await db
      .select({ smsOptOut: users.smsOptOut })
      .from(users)
      .where(eq(users.id, clearedDbId));
    expect(clearedAfter?.smsOptOut).toBe(false);
  });
});
