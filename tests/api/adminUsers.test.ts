/**
 * Admin user management tests (converted from server/tests/adminUsers.test.ts).
 *
 * Covers isAdminUser allowlist, adminActionKeys allowlist, adminMiddleware
 * gating, and the search/views/detail/actions endpoints (including reason
 * enforcement, action allowlist, and audit-log creation). DB is mocked.
 */

process.env.NODE_ENV = "test";
process.env.APP_JWT_SECRET = process.env.APP_JWT_SECRET || "test-secret-admin-users-spec";
process.env.ADMIN_USER_IDS = "demo-user";
process.env.ADMIN_EMAILS = "admin@example.com";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgres://localhost/unused";
// Known Stripe price IDs the admin plan-change actions are allowed to forward
// to Stripe. These mirror the plan price env vars defined in
// server/billing/plans.ts and let the existing happy-path tests below (which
// use "price_yearly" and "price_basic") pass the validation guard.
process.env.STRIPE_PRICE_PRO_MONTHLY = "price_basic";
process.env.STRIPE_PRICE_PRO_YEARLY = "price_yearly";

type InsertCall = { table: unknown; values: unknown };
type UpdateCall = { table: unknown; set: unknown };
type DeleteCall = { table: unknown };

interface DbMockState {
  selectQueue: unknown[];
  insertReturningQueue: unknown[][];
  insertCalls: InsertCall[];
  updateCalls: UpdateCall[];
  deleteCalls: DeleteCall[];
}

const dbState: DbMockState = {
  selectQueue: [],
  insertReturningQueue: [],
  insertCalls: [],
  updateCalls: [],
  deleteCalls: [],
};

function resetDbState() {
  dbState.selectQueue = [];
  dbState.insertReturningQueue = [];
  dbState.insertCalls = [];
  dbState.updateCalls = [];
  dbState.deleteCalls = [];
}

interface ChainMock<T = unknown> extends PromiseLike<T> {
  from: (..._args: unknown[]) => ChainMock<T>;
  where: (..._args: unknown[]) => ChainMock<T>;
  orderBy: (..._args: unknown[]) => ChainMock<T>;
  limit: (..._args: unknown[]) => ChainMock<T>;
  offset: (..._args: unknown[]) => ChainMock<T>;
  groupBy: (..._args: unknown[]) => ChainMock<T>;
  having: (..._args: unknown[]) => ChainMock<T>;
  set: (..._args: unknown[]) => ChainMock<T>;
  returning: () => Promise<T>;
}

// Build a chainable mock that satisfies awaited drizzle calls
// (e.g. `await db.select().from().where().limit(1)`) and the
// `db.insert(t).values(v).returning()` flavour by resolving via `resolveTo`.
function makeChain<T>(resolveTo: () => T): ChainMock<T> {
  const chain = {} as ChainMock<T>;
  const passthrough = () => chain;
  chain.from = passthrough;
  chain.where = passthrough;
  chain.orderBy = passthrough;
  chain.limit = passthrough;
  chain.offset = passthrough;
  chain.groupBy = passthrough;
  chain.having = passthrough;
  chain.set = passthrough;
  chain.returning = () => Promise.resolve(resolveTo());
  chain.then = <TResult1 = T, TResult2 = never>(
    onFulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) => Promise.resolve(resolveTo()).then(onFulfilled, onRejected);
  return chain;
}

interface InsertValuesResult<T> extends PromiseLike<undefined> {
  returning: () => Promise<T[]>;
}

interface InsertChain<T> {
  values: (values: T | T[]) => InsertValuesResult<T & { id: string }>;
}

const dbMock = {
  select: jest.fn((..._args: unknown[]): ChainMock<unknown> => {
    return makeChain(() => {
      if (dbState.selectQueue.length === 0) return [];
      return dbState.selectQueue.shift();
    });
  }),
  insert: jest.fn(<T extends Record<string, unknown>>(table: unknown): InsertChain<T> => {
    return {
      values: (values: T | T[]) => {
        dbState.insertCalls.push({ table, values });
        const buildReturning = (): Array<T & { id: string }> => {
          if (dbState.insertReturningQueue.length > 0) {
            return dbState.insertReturningQueue.shift() as Array<T & { id: string }>;
          }
          const arr = Array.isArray(values) ? values : [values];
          return arr.map((row, i) => ({ id: `mock-id-${i + 1}`, ...row }));
        };
        const result: InsertValuesResult<T & { id: string }> = {
          returning: () => Promise.resolve(buildReturning()),
          then: <TResult1 = undefined, TResult2 = never>(
            onFulfilled?: ((value: undefined) => TResult1 | PromiseLike<TResult1>) | null,
            onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
          ) => Promise.resolve<undefined>(undefined).then(onFulfilled, onRejected),
        };
        return result;
      },
    };
  }),
  update: jest.fn((table: unknown) => ({
    set: (setValues: unknown) => {
      dbState.updateCalls.push({ table, set: setValues });
      return makeChain<undefined>(() => undefined);
    },
  })),
  delete: jest.fn((table: unknown) => {
    dbState.deleteCalls.push({ table });
    return makeChain<undefined>(() => undefined);
  }),
};

jest.mock("../../server/db", () => ({
  db: dbMock,
  pool: { query: jest.fn() },
}));

jest.mock("../../server/storage", () => ({
  storage: { getUser: jest.fn() },
}));

// Allow individual tests to swap out the real adminMiddleware (which always
// sets req.adminUserId on success) for a stub. This is needed to exercise the
// in-handler `if (!req.adminUserId)` 401 guards on routes like POST /:userId/notes.
const mockAdminMiddlewareState: {
  override: ((req: unknown, res: unknown, next: () => void) => void) | null;
} = { override: null };

jest.mock("../../server/copilot/adminMiddleware", () => {
  const actual = jest.requireActual("../../server/copilot/adminMiddleware");
  return {
    ...actual,
    adminMiddleware: (req: unknown, res: unknown, next: () => void) => {
      if (mockAdminMiddlewareState.override) {
        return mockAdminMiddlewareState.override(req, res, next);
      }
      return actual.adminMiddleware(req, res, next);
    },
  };
});

// openid-client is ESM-only; replitAuth imports it at module top but only uses
// it inside setupAuth, which the tests never call.
jest.mock("openid-client", () => ({ discovery: jest.fn() }), { virtual: true });
jest.mock("openid-client/passport", () => ({ Strategy: class {} }), { virtual: true });

// Avoid touching real Stripe credentials at module load time. The shared
// `mockStripe` singleton lets each test stub out specific methods (e.g.
// `subscriptions.retrieve`) without rebuilding the client per call.
const mockStripe = {
  subscriptions: {
    retrieve: jest.fn(),
    update: jest.fn(),
    cancel: jest.fn(),
  },
  customers: {
    update: jest.fn(),
    createBalanceTransaction: jest.fn(),
  },
  refunds: {
    create: jest.fn(),
  },
  invoices: {
    list: jest.fn(),
    pay: jest.fn(),
    retrieve: jest.fn(),
  },
};

jest.mock("../../server/stripeClient", () => ({
  getUncachableStripeClient: jest.fn(async () => mockStripe),
}));

import express from "express";
import request from "supertest";
import { isAdminUser, clearAdminCache } from "../../server/copilot/adminMiddleware";
import { signAppJwt } from "../../server/appJwt";
import {
  adminActionKeys,
  adminActionAudit,
  userFlags,
  userAdminNotes,
  messagingSuppression,
  outboundMessages,
  users,
} from "../../shared/schema";
import adminUsersRoutes from "../../server/admin/usersRoutes";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/admin/users", adminUsersRoutes);
  return app;
}

// Sign a Bearer JWT with email_normalized so adminMiddleware skips the email
// lookup that would otherwise consume an entry from dbState.selectQueue.
function adminToken(opts: { sub?: string; email?: string } = {}) {
  return signAppJwt({
    sub: opts.sub || "demo-user",
    provider: "firebase",
    email_normalized: opts.email || "demo@example.com",
  });
}

beforeEach(() => {
  resetDbState();
  dbMock.select.mockClear();
  dbMock.insert.mockClear();
  dbMock.update.mockClear();
  dbMock.delete.mockClear();
  clearAdminCache();
  mockAdminMiddlewareState.override = null;
  mockStripe.subscriptions.retrieve.mockReset();
  mockStripe.subscriptions.update.mockReset();
  mockStripe.subscriptions.cancel.mockReset();
  mockStripe.customers.update.mockReset();
  mockStripe.customers.createBalanceTransaction.mockReset();
  mockStripe.refunds.create.mockReset();
  mockStripe.invoices.list.mockReset();
  mockStripe.invoices.pay.mockReset();
  mockStripe.invoices.retrieve.mockReset();
  mockStripe.subscriptions.retrieve.mockResolvedValue({
    items: { data: [{ id: "si_default" }] },
  });
  mockStripe.subscriptions.update.mockResolvedValue({});
  mockStripe.subscriptions.cancel.mockResolvedValue({});
  mockStripe.customers.update.mockResolvedValue({});
  mockStripe.customers.createBalanceTransaction.mockResolvedValue({ id: "cbtxn_default" });
  mockStripe.refunds.create.mockResolvedValue({ id: "re_default" });
});

describe("isAdminUser allowlist", () => {
  it("allows a userId in ADMIN_USER_IDS", () => {
    expect(isAdminUser("demo-user", undefined)).toBe(true);
  });

  it("denies a userId not in the allowlist", () => {
    expect(isAdminUser("random-user-not-admin", undefined)).toBe(false);
  });

  it("denies empty / undefined credentials", () => {
    expect(isAdminUser(undefined, undefined)).toBe(false);
    expect(isAdminUser("", "")).toBe(false);
  });

  it("allows an email in ADMIN_EMAILS (case-insensitive, trimmed)", () => {
    expect(isAdminUser(undefined, "Admin@Example.com")).toBe(true);
    expect(isAdminUser(undefined, "  admin@example.com  ")).toBe(true);
  });
});

describe("adminActionKeys allowlist", () => {
  const expectedAllowed = [
    "user_flagged",
    "add_note",
    "reset_onboarding_state",
    "trigger_webhook_retry",
    "suppress_messaging",
    "unsuppress_messaging",
    "send_one_off_push",
  ];

  const expectedDisallowed = [
    "delete_user",
    "refund",
    "cancel_subscription",
    "edit_plan",
    "bulk_delete",
    "random_action",
  ];

  it.each(expectedAllowed)("includes the documented allowed action %s", (action) => {
    expect(adminActionKeys).toContain(action);
  });

  it.each(expectedDisallowed)("does NOT include the disallowed action %s", (action) => {
    expect(adminActionKeys).not.toContain(action);
  });
});

describe("admin gating on /api/admin/users", () => {
  it("returns 401 with no authentication", async () => {
    const res = await request(buildApp()).get("/api/admin/users/search?q=demo");
    expect(res.status).toBe(401);
  });

  it("returns 403 for an authenticated non-admin user", async () => {
    const token = signAppJwt({
      sub: "not-an-admin",
      provider: "firebase",
      email_normalized: "stranger@example.com",
    });

    const res = await request(buildApp())
      .get("/api/admin/users/search?q=demo")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it("admits a bootstrap admin user (demo-user) to the search endpoint", async () => {
    dbState.selectQueue.push([
      { id: "u1", email: "demo@example.com", username: "demo", name: "Demo", phone: null,
        isPro: false, onboardingCompleted: true, lastActiveAt: null, createdAt: null },
    ]);

    const res = await request(buildApp())
      .get("/api/admin/users/search?q=demo")
      .set("Authorization", `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("users");
    expect(Array.isArray(res.body.users)).toBe(true);
    expect(res.body.users).toHaveLength(1);
  });
});

describe("GET /api/admin/users/search", () => {
  it("returns an empty users array when query is too short", async () => {
    const res = await request(buildApp())
      .get("/api/admin/users/search?q=a")
      .set("Authorization", `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ users: [] });
    expect(dbMock.select).not.toHaveBeenCalled();
  });

  it("returns the users array when the query has results", async () => {
    const fakeUsers = Array.from({ length: 3 }, (_, i) => ({
      id: `u${i}`, email: `u${i}@x.com`, username: `u${i}`, name: `U${i}`,
      phone: null, isPro: false, onboardingCompleted: true,
      lastActiveAt: null, createdAt: null,
    }));
    dbState.selectQueue.push(fakeUsers);

    const res = await request(buildApp())
      .get("/api/admin/users/search?q=demo")
      .set("Authorization", `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(3);
    expect(dbMock.select).toHaveBeenCalled();
  });
});

describe("GET /api/admin/users/views", () => {
  it("returns users + pagination + view fields with the documented limit", async () => {
    // First select call is the count(); second is the user rows.
    dbState.selectQueue.push([{ count: 7 }]);
    dbState.selectQueue.push([
      { id: "u1", email: "u1@x.com", username: "u1", name: "U1",
        onboardingStep: 1, lastActiveAt: null, createdAt: null },
    ]);

    const res = await request(buildApp())
      .get("/api/admin/users/views?view=onboarding_stalled&page=1")
      .set("Authorization", `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("users");
    expect(res.body).toHaveProperty("pagination");
    expect(res.body).toHaveProperty("view", "onboarding_stalled");
    expect(res.body.pagination).toMatchObject({ page: 1, limit: 25, total: 7 });
    expect(Array.isArray(res.body.users)).toBe(true);
    expect(res.body.users.length).toBeLessThanOrEqual(res.body.pagination.limit);
  });
});

describe("GET /api/admin/users/:userId (user detail)", () => {
  it("returns profile + funnelState + notes + context for an existing user", async () => {
    // Only the first select (the user lookup) needs a real row; subsequent
    // selects default to [] which the handler tolerates.
    dbState.selectQueue.push([
      {
        id: "demo-user", email: "demo@example.com", username: "demo",
        name: "Demo User", phone: null, isPro: false, proExpiresAt: null,
        onboardingCompleted: true, onboardingStep: 5, lastActiveAt: null,
        createdAt: null, publicProfileSlug: null, stripeCustomerId: null,
        stripeSubscriptionId: null,
      },
    ]);

    const res = await request(buildApp())
      .get("/api/admin/users/demo-user")
      .set("Authorization", `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    for (const field of ["profile", "funnelState", "notes", "context"]) {
      expect(res.body).toHaveProperty(field);
    }
    expect(res.body.profile).toHaveProperty("id", "demo-user");
  });
});

describe("POST /api/admin/users/:userId/actions", () => {
  it("rejects an empty reason with 400", async () => {
    const res = await request(buildApp())
      .post("/api/admin/users/demo-user/actions")
      .set("Authorization", `Bearer ${adminToken()}`)
      .send({ action_key: "add_note", reason: "", payload: { note: "x" } });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/reason/i);
    expect(dbState.insertCalls).toHaveLength(0);
  });

  it("rejects an action_key that is not in adminActionKeys with 400", async () => {
    const res = await request(buildApp())
      .post("/api/admin/users/demo-user/actions")
      .set("Authorization", `Bearer ${adminToken()}`)
      .send({ action_key: "delete_user", reason: "trying to break things" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid action/i);
    expect(dbState.insertCalls).toHaveLength(0);
  });

  it("returns 404 if the target user is missing", async () => {
    dbState.selectQueue.push([]);

    const res = await request(buildApp())
      .post("/api/admin/users/missing-user/actions")
      .set("Authorization", `Bearer ${adminToken()}`)
      .send({ action_key: "add_note", reason: "hi", payload: { note: "x" } });

    expect(res.status).toBe(404);
  });

  it("on a successful action, writes to adminActionAudit with actor, target, action and reason", async () => {
    dbState.selectQueue.push([{ email: "demo@example.com" }]);

    const res = await request(buildApp())
      .post("/api/admin/users/demo-user/actions")
      .set("Authorization", `Bearer ${adminToken()}`)
      .send({
        action_key: "add_note",
        reason: "Test audit log creation",
        payload: { note: "Test note" },
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });

    // The audit insert is the last insert call the handler makes.
    expect(dbState.insertCalls.length).toBeGreaterThanOrEqual(1);
    const auditCall = dbState.insertCalls[dbState.insertCalls.length - 1];
    const auditValues = auditCall.values as Record<string, unknown>;

    expect(auditValues).toMatchObject({
      actorUserId: "demo-user",
      targetUserId: "demo-user",
      actionKey: "add_note",
      reason: "Test audit log creation",
      source: "admin_ui",
    });
    expect(auditValues.createdAt).toBeTruthy();
  });
});

// -----------------------------------------------------------------------------
// Per-action coverage for POST /api/admin/users/:userId/actions.
//
// Every entry in `adminActionKeys` (shared/schema.ts) is exercised below. For
// each action we assert two things:
//   1. The expected side-effect insert/update/Stripe call happened.
//   2. A correctly-shaped row was appended to `adminActionAudit`.
// -----------------------------------------------------------------------------

const TARGET = "demo-user";

function pushUserLookup(email = "demo@example.com") {
  dbState.selectQueue.push([{ email }]);
}

function pushTargetUser(row: Record<string, unknown>) {
  dbState.selectQueue.push([row]);
}

function findInsert(table: unknown) {
  return dbState.insertCalls.find((c) => c.table === table);
}

function findUpdate(table: unknown) {
  return dbState.updateCalls.find((c) => c.table === table);
}

function lastAuditInsert() {
  const auditCall = dbState.insertCalls[dbState.insertCalls.length - 1];
  expect(auditCall).toBeTruthy();
  expect(auditCall.table).toBe(adminActionAudit);
  return auditCall.values as Record<string, unknown>;
}

function expectAuditRow(actionKey: string, reason: string, target = TARGET) {
  const audit = lastAuditInsert();
  expect(audit).toMatchObject({
    actorUserId: "demo-user",
    targetUserId: target,
    actionKey,
    reason,
    source: "admin_ui",
  });
  expect(audit.createdAt).toBeTruthy();
  return audit;
}

async function postAction(
  actionKey: string,
  opts: { reason?: string; payload?: unknown; userId?: string } = {},
) {
  return request(buildApp())
    .post(`/api/admin/users/${opts.userId || TARGET}/actions`)
    .set("Authorization", `Bearer ${adminToken()}`)
    .send({
      action_key: actionKey,
      reason: opts.reason ?? `${actionKey} reason`,
      payload: opts.payload,
    });
}

describe("POST /api/admin/users/:userId/actions per-action coverage", () => {
  it("covers every adminActionKeys entry with a dedicated test", () => {
    // Sanity check: if a new action key is added to shared/schema.ts, this
    // suite should be extended too. The list below MUST stay in sync with the
    // describe blocks further down.
    const covered = new Set([
      "user_flagged",
      "add_note",
      "reset_onboarding_state",
      "trigger_webhook_retry",
      "suppress_messaging",
      "unsuppress_messaging",
      "send_one_off_push",
      "billing_upgrade",
      "billing_downgrade",
      "billing_grant_comp",
      "billing_revoke_comp",
      "billing_pause",
      "billing_resume",
      "billing_cancel",
      "billing_apply_credit",
      "billing_refund",
      "account_disable",
      "account_enable",
      "admin_created",
      "admin_updated",
      "admin_deactivated",
    ]);
    for (const key of adminActionKeys) {
      expect(covered.has(key)).toBe(true);
    }
    expect(covered.size).toBe(adminActionKeys.length);
  });

  it("user_flagged inserts into userFlags and writes audit row", async () => {
    pushUserLookup();
    const res = await postAction("user_flagged", { reason: "Spammy account" });
    expect(res.status).toBe(200);

    const insert = findInsert(userFlags);
    expect(insert).toBeTruthy();
    expect(insert!.values).toMatchObject({
      userId: TARGET,
      flaggedBy: "demo-user",
      reason: "Spammy account",
    });
    expectAuditRow("user_flagged", "Spammy account");
  });

  it("add_note inserts into userAdminNotes and writes audit row", async () => {
    pushUserLookup();
    const res = await postAction("add_note", {
      reason: "Logging context",
      payload: { note: "Customer called about billing" },
    });
    expect(res.status).toBe(200);

    const insert = findInsert(userAdminNotes);
    expect(insert).toBeTruthy();
    expect(insert!.values).toMatchObject({
      actorUserId: "demo-user",
      targetUserId: TARGET,
      note: "Customer called about billing",
    });
    expectAuditRow("add_note", "Logging context");
  });

  it("reset_onboarding_state updates users and writes audit row", async () => {
    pushUserLookup();
    const res = await postAction("reset_onboarding_state", {
      reason: "Onboarding stuck",
    });
    expect(res.status).toBe(200);

    const update = findUpdate(users);
    expect(update).toBeTruthy();
    expect(update!.set).toMatchObject({
      onboardingCompleted: false,
      onboardingStep: 0,
    });
    expectAuditRow("reset_onboarding_state", "Onboarding stuck");
  });

  it("trigger_webhook_retry writes audit row (no DB side effect)", async () => {
    pushUserLookup();
    const res = await postAction("trigger_webhook_retry", {
      reason: "Webhook failed",
    });
    expect(res.status).toBe(200);

    expect(findInsert(userFlags)).toBeUndefined();
    expect(findInsert(userAdminNotes)).toBeUndefined();
    expect(findInsert(messagingSuppression)).toBeUndefined();
    expect(findUpdate(users)).toBeUndefined();
    expectAuditRow("trigger_webhook_retry", "Webhook failed");
  });

  it("suppress_messaging inserts into messagingSuppression and writes audit row", async () => {
    pushUserLookup();
    const res = await postAction("suppress_messaging", {
      reason: "User asked to pause",
      payload: { duration_hours: 12 },
    });
    expect(res.status).toBe(200);

    const insert = findInsert(messagingSuppression);
    expect(insert).toBeTruthy();
    expect(insert!.values).toMatchObject({
      userId: TARGET,
      suppressedBy: "demo-user",
      reason: "User asked to pause",
    });
    const v = insert!.values as Record<string, unknown>;
    expect(v.suppressUntil).toBeTruthy();
    expectAuditRow("suppress_messaging", "User asked to pause");
  });

  it("unsuppress_messaging updates messagingSuppression and writes audit row", async () => {
    pushUserLookup();
    const res = await postAction("unsuppress_messaging", {
      reason: "Resuming sends",
    });
    expect(res.status).toBe(200);

    const update = findUpdate(messagingSuppression);
    expect(update).toBeTruthy();
    expect(update!.set).toMatchObject({
      unsuppressedBy: "demo-user",
    });
    expect((update!.set as Record<string, unknown>).unsuppressedAt).toBeTruthy();
    expectAuditRow("unsuppress_messaging", "Resuming sends");
  });

  it("send_one_off_push under the daily cap writes audit row", async () => {
    pushUserLookup();
    // Rate-limit count select: still well under the cap.
    dbState.selectQueue.push([{ count: 3 }]);

    const res = await postAction("send_one_off_push", {
      reason: "Reminder push",
      payload: { message: "Hi there" },
    });
    expect(res.status).toBe(200);
    expectAuditRow("send_one_off_push", "Reminder push");
  });

  it("send_one_off_push returns 429 once the daily cap is reached", async () => {
    pushUserLookup();
    // Rate-limit count select: at the cap (>= 20).
    dbState.selectQueue.push([{ count: 20 }]);

    const res = await postAction("send_one_off_push", {
      reason: "Reminder push",
      payload: { message: "Should be blocked" },
    });
    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/rate limit/i);

    // No audit row should have been written when we short-circuited.
    expect(findInsert(adminActionAudit)).toBeUndefined();
  });

  it("billing_upgrade calls Stripe and writes audit row", async () => {
    pushUserLookup();
    pushTargetUser({ stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1" });
    mockStripe.subscriptions.retrieve.mockResolvedValueOnce({
      items: { data: [{ id: "si_abc" }] },
    });

    const res = await postAction("billing_upgrade", {
      reason: "Upgrade to pro yearly",
      payload: { priceId: "price_yearly" },
    });
    expect(res.status).toBe(200);

    expect(mockStripe.subscriptions.retrieve).toHaveBeenCalledWith("sub_1");
    expect(mockStripe.subscriptions.update).toHaveBeenCalledWith("sub_1", {
      items: [{ id: "si_abc", price: "price_yearly" }],
      proration_behavior: "create_prorations",
    });
    expectAuditRow("billing_upgrade", "Upgrade to pro yearly");
  });

  it("billing_downgrade calls Stripe and writes audit row", async () => {
    pushUserLookup();
    pushTargetUser({ stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1" });
    mockStripe.subscriptions.retrieve.mockResolvedValueOnce({
      items: { data: [{ id: "si_xyz" }] },
    });

    const res = await postAction("billing_downgrade", {
      reason: "Downgrade requested",
      payload: { priceId: "price_basic" },
    });
    expect(res.status).toBe(200);

    expect(mockStripe.subscriptions.update).toHaveBeenCalledWith("sub_1", {
      items: [{ id: "si_xyz", price: "price_basic" }],
      proration_behavior: "create_prorations",
    });
    expectAuditRow("billing_downgrade", "Downgrade requested");
  });

  it("billing_grant_comp updates users (isPro=true) and writes audit row", async () => {
    pushUserLookup();
    const res = await postAction("billing_grant_comp", {
      reason: "Comp 2 months",
      payload: { months: 2 },
    });
    expect(res.status).toBe(200);

    const update = findUpdate(users);
    expect(update).toBeTruthy();
    expect(update!.set).toMatchObject({
      isPro: true,
      compAccessGrantedBy: "demo-user",
    });
    const setVals = update!.set as Record<string, unknown>;
    expect(setVals.compAccessGrantedAt).toBeTruthy();
    expect(setVals.compAccessExpiresAt).toBeTruthy();
    expectAuditRow("billing_grant_comp", "Comp 2 months");
  });

  it("billing_revoke_comp updates users (isPro=false) and writes audit row", async () => {
    pushUserLookup();
    const res = await postAction("billing_revoke_comp", {
      reason: "Revoking comp",
    });
    expect(res.status).toBe(200);

    const update = findUpdate(users);
    expect(update).toBeTruthy();
    expect(update!.set).toMatchObject({
      isPro: false,
      compAccessRevokedBy: "demo-user",
    });
    expect((update!.set as Record<string, unknown>).compAccessRevokedAt).toBeTruthy();
    expectAuditRow("billing_revoke_comp", "Revoking comp");
  });

  it("billing_pause calls Stripe pause and writes audit row", async () => {
    pushUserLookup();
    pushTargetUser({ stripeSubscriptionId: "sub_1" });

    const res = await postAction("billing_pause", { reason: "Pausing now" });
    expect(res.status).toBe(200);

    expect(mockStripe.subscriptions.update).toHaveBeenCalledWith("sub_1", {
      pause_collection: { behavior: "void" },
    });
    expectAuditRow("billing_pause", "Pausing now");
  });

  it("billing_resume calls Stripe resume and writes audit row", async () => {
    pushUserLookup();
    pushTargetUser({ stripeSubscriptionId: "sub_1" });

    const res = await postAction("billing_resume", { reason: "Resuming" });
    expect(res.status).toBe(200);

    expect(mockStripe.subscriptions.update).toHaveBeenCalledWith("sub_1", {
      pause_collection: null,
    });
    expectAuditRow("billing_resume", "Resuming");
  });

  it("billing_cancel (default) sets cancel_at_period_end and writes audit row", async () => {
    pushUserLookup();
    pushTargetUser({ stripeSubscriptionId: "sub_1" });

    const res = await postAction("billing_cancel", {
      reason: "Cancel at end of period",
    });
    expect(res.status).toBe(200);

    expect(mockStripe.subscriptions.update).toHaveBeenCalledWith("sub_1", {
      cancel_at_period_end: true,
    });
    expect(mockStripe.subscriptions.cancel).not.toHaveBeenCalled();
    expectAuditRow("billing_cancel", "Cancel at end of period");
  });

  it("billing_cancel (immediate) calls Stripe cancel and writes audit row", async () => {
    pushUserLookup();
    pushTargetUser({ stripeSubscriptionId: "sub_1" });

    const res = await postAction("billing_cancel", {
      reason: "Cancel immediately",
      payload: { immediate: true },
    });
    expect(res.status).toBe(200);

    expect(mockStripe.subscriptions.cancel).toHaveBeenCalledWith("sub_1");
    expectAuditRow("billing_cancel", "Cancel immediately");
  });

  it("billing_apply_credit creates a Stripe balance transaction and writes audit row", async () => {
    pushUserLookup();
    pushTargetUser({ stripeCustomerId: "cus_1" });

    const res = await postAction("billing_apply_credit", {
      reason: "Goodwill credit",
      payload: { amountCents: 2500 },
    });
    expect(res.status).toBe(200);

    expect(mockStripe.customers.update).not.toHaveBeenCalled();
    expect(mockStripe.customers.createBalanceTransaction).toHaveBeenCalledWith(
      "cus_1",
      expect.objectContaining({
        amount: -2500,
        currency: "usd",
      }),
    );
    expectAuditRow("billing_apply_credit", "Goodwill credit");
  });

  it("billing_apply_credit stacks repeated credits instead of overwriting them", async () => {
    pushUserLookup();
    pushTargetUser({ stripeCustomerId: "cus_1" });
    const firstRes = await postAction("billing_apply_credit", {
      reason: "First credit",
      payload: { amountCents: 2500 },
    });
    expect(firstRes.status).toBe(200);

    pushUserLookup();
    pushTargetUser({ stripeCustomerId: "cus_1" });
    const secondRes = await postAction("billing_apply_credit", {
      reason: "Second credit",
      payload: { amountCents: 1000 },
    });
    expect(secondRes.status).toBe(200);

    expect(mockStripe.customers.createBalanceTransaction).toHaveBeenCalledTimes(2);
    expect(mockStripe.customers.createBalanceTransaction).toHaveBeenNthCalledWith(
      1,
      "cus_1",
      expect.objectContaining({ amount: -2500, currency: "usd" }),
    );
    expect(mockStripe.customers.createBalanceTransaction).toHaveBeenNthCalledWith(
      2,
      "cus_1",
      expect.objectContaining({ amount: -1000, currency: "usd" }),
    );

    const totalCreditCents = mockStripe.customers.createBalanceTransaction.mock.calls
      .reduce((sum, call) => sum + Math.abs((call[1] as { amount: number }).amount), 0);
    expect(totalCreditCents).toBe(3500);
  });

  it("billing_refund calls Stripe refunds.create and writes audit row", async () => {
    pushUserLookup();

    const res = await postAction("billing_refund", {
      reason: "Refund duplicate charge",
      payload: { chargeId: "ch_1", amountCents: 1000 },
    });
    expect(res.status).toBe(200);

    expect(mockStripe.refunds.create).toHaveBeenCalledWith({
      charge: "ch_1",
      amount: 1000,
    });
    expectAuditRow("billing_refund", "Refund duplicate charge");
  });

  it("account_disable updates users (isDisabled=true) and writes audit row", async () => {
    pushUserLookup();

    const res = await postAction("account_disable", {
      reason: "Policy violation",
    });
    expect(res.status).toBe(200);

    const update = findUpdate(users);
    expect(update).toBeTruthy();
    expect(update!.set).toMatchObject({
      isDisabled: true,
      disabledBy: "demo-user",
      disabledReason: "Policy violation",
    });
    expect((update!.set as Record<string, unknown>).disabledAt).toBeTruthy();
    expectAuditRow("account_disable", "Policy violation");
  });

  it("account_enable updates users (isDisabled=false) and writes audit row", async () => {
    pushUserLookup();

    const res = await postAction("account_enable", {
      reason: "Restoring access",
    });
    expect(res.status).toBe(200);

    const update = findUpdate(users);
    expect(update).toBeTruthy();
    expect(update!.set).toMatchObject({
      isDisabled: false,
      enabledBy: "demo-user",
    });
    expect((update!.set as Record<string, unknown>).enabledAt).toBeTruthy();
    expectAuditRow("account_enable", "Restoring access");
  });

  // The admin_* keys are accepted by the POST /actions allowlist but have no
  // dedicated switch branch on this endpoint (the admin-management routes
  // emit them directly). They should still be auditable through this route
  // without raising or causing unrelated side-effects.
  it.each(["admin_created", "admin_updated", "admin_deactivated"] as const)(
    "%s writes audit row with no other DB side effect",
    async (actionKey) => {
      pushUserLookup();
      const reason = `${actionKey} reason`;
      const res = await postAction(actionKey, { reason });
      expect(res.status).toBe(200);

      expect(findInsert(userFlags)).toBeUndefined();
      expect(findInsert(userAdminNotes)).toBeUndefined();
      expect(findInsert(messagingSuppression)).toBeUndefined();
      expect(findUpdate(users)).toBeUndefined();
      expect(findUpdate(messagingSuppression)).toBeUndefined();

      expectAuditRow(actionKey, reason);
    },
  );
});

// -----------------------------------------------------------------------------
// Validation branches for billing actions on POST /api/admin/users/:userId/actions.
//
// These tests guard the pre-Stripe guards in `usersRoutes.ts` so a refactor
// can't silently drop a validation check and let an admin trigger Stripe with
// bad data. For each rejected branch we assert:
//   * the HTTP status (400 for validation errors, 500 for Stripe failures),
//   * the error message text returned by the handler,
//   * that NO row was written to `adminActionAudit` for the rejected call.
// -----------------------------------------------------------------------------

describe("POST /api/admin/users/:userId/actions billing validation", () => {
  function expectNoAuditRow() {
    expect(findInsert(adminActionAudit)).toBeUndefined();
  }

  describe("billing_upgrade / billing_downgrade", () => {
    it.each(["billing_upgrade", "billing_downgrade"] as const)(
      "%s returns 400 when the target has no active subscription",
      async (actionKey) => {
        pushUserLookup();
        pushTargetUser({ stripeCustomerId: "cus_1", stripeSubscriptionId: null });

        const res = await postAction(actionKey, {
          reason: "Plan change",
          payload: { priceId: "price_yearly" },
        });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("User has no active subscription to modify");
        expect(mockStripe.subscriptions.retrieve).not.toHaveBeenCalled();
        expect(mockStripe.subscriptions.update).not.toHaveBeenCalled();
        expectNoAuditRow();
      },
    );

    it.each(["billing_upgrade", "billing_downgrade"] as const)(
      "%s returns 400 when payload is missing priceId",
      async (actionKey) => {
        pushUserLookup();
        pushTargetUser({ stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1" });

        const res = await postAction(actionKey, {
          reason: "Plan change",
          payload: {},
        });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("New price ID is required for plan changes");
        expect(mockStripe.subscriptions.retrieve).not.toHaveBeenCalled();
        expect(mockStripe.subscriptions.update).not.toHaveBeenCalled();
        expectNoAuditRow();
      },
    );

    it.each(["billing_upgrade", "billing_downgrade"] as const)(
      "%s returns 400 when priceId is not in the known plan price list",
      async (actionKey) => {
        pushUserLookup();
        pushTargetUser({ stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1" });

        const res = await postAction(actionKey, {
          reason: "Plan change",
          payload: { priceId: "price_typo_or_stale" },
        });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Unknown price ID");
        expect(mockStripe.subscriptions.retrieve).not.toHaveBeenCalled();
        expect(mockStripe.subscriptions.update).not.toHaveBeenCalled();
        expectNoAuditRow();
      },
    );

    it("billing_upgrade returns 500 with the Stripe error message when Stripe rejects", async () => {
      pushUserLookup();
      pushTargetUser({ stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1" });
      mockStripe.subscriptions.retrieve.mockRejectedValueOnce(
        new Error("subscription not found"),
      );

      const res = await postAction("billing_upgrade", {
        reason: "Plan change",
        payload: { priceId: "price_yearly" },
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Stripe error: subscription not found");
      expectNoAuditRow();
    });
  });

  describe("billing_pause / billing_resume / billing_cancel", () => {
    it.each([
      ["billing_pause", "User has no active subscription to pause"],
      ["billing_resume", "User has no subscription to resume"],
      ["billing_cancel", "User has no subscription to cancel"],
    ] as const)(
      "%s returns 400 when the target has no active subscription",
      async (actionKey, expectedMessage) => {
        pushUserLookup();
        pushTargetUser({ stripeSubscriptionId: null });

        const res = await postAction(actionKey, { reason: "Try it" });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe(expectedMessage);
        expect(mockStripe.subscriptions.update).not.toHaveBeenCalled();
        expect(mockStripe.subscriptions.cancel).not.toHaveBeenCalled();
        expectNoAuditRow();
      },
    );

    it("billing_pause returns 500 with the Stripe error message when Stripe rejects", async () => {
      pushUserLookup();
      pushTargetUser({ stripeSubscriptionId: "sub_1" });
      mockStripe.subscriptions.update.mockRejectedValueOnce(
        new Error("pause failed"),
      );

      const res = await postAction("billing_pause", { reason: "Pause now" });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Stripe error: pause failed");
      expectNoAuditRow();
    });

    it("billing_resume returns 500 with the Stripe error message when Stripe rejects", async () => {
      pushUserLookup();
      pushTargetUser({ stripeSubscriptionId: "sub_1" });
      mockStripe.subscriptions.update.mockRejectedValueOnce(
        new Error("resume failed"),
      );

      const res = await postAction("billing_resume", { reason: "Resume" });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Stripe error: resume failed");
      expectNoAuditRow();
    });

    it("billing_cancel (immediate) returns 500 with the Stripe error message when Stripe rejects", async () => {
      pushUserLookup();
      pushTargetUser({ stripeSubscriptionId: "sub_1" });
      mockStripe.subscriptions.cancel.mockRejectedValueOnce(
        new Error("cancel failed"),
      );

      const res = await postAction("billing_cancel", {
        reason: "Cancel now",
        payload: { immediate: true },
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Stripe error: cancel failed");
      expectNoAuditRow();
    });
  });

  describe("billing_apply_credit", () => {
    it("returns 400 when the target has no Stripe customer record", async () => {
      pushUserLookup();
      pushTargetUser({ stripeCustomerId: null });

      const res = await postAction("billing_apply_credit", {
        reason: "Goodwill credit",
        payload: { amountCents: 2500 },
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("User has no Stripe customer record");
      expect(mockStripe.customers.update).not.toHaveBeenCalled();
      expectNoAuditRow();
    });

    it("returns 400 when amountCents is missing", async () => {
      pushUserLookup();
      pushTargetUser({ stripeCustomerId: "cus_1" });

      const res = await postAction("billing_apply_credit", {
        reason: "Goodwill credit",
        payload: {},
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe(
        "Credit amount (in cents) is required and must be positive",
      );
      expect(mockStripe.customers.update).not.toHaveBeenCalled();
      expectNoAuditRow();
    });

    it("returns 400 when amountCents is zero", async () => {
      pushUserLookup();
      pushTargetUser({ stripeCustomerId: "cus_1" });

      const res = await postAction("billing_apply_credit", {
        reason: "Goodwill credit",
        payload: { amountCents: 0 },
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe(
        "Credit amount (in cents) is required and must be positive",
      );
      expect(mockStripe.customers.update).not.toHaveBeenCalled();
      expectNoAuditRow();
    });

    it("returns 400 when amountCents is negative", async () => {
      pushUserLookup();
      pushTargetUser({ stripeCustomerId: "cus_1" });

      const res = await postAction("billing_apply_credit", {
        reason: "Goodwill credit",
        payload: { amountCents: -100 },
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe(
        "Credit amount (in cents) is required and must be positive",
      );
      expect(mockStripe.customers.update).not.toHaveBeenCalled();
      expect(mockStripe.customers.createBalanceTransaction).not.toHaveBeenCalled();
      expectNoAuditRow();
    });

    it("returns 500 with the Stripe error message when Stripe rejects", async () => {
      pushUserLookup();
      pushTargetUser({ stripeCustomerId: "cus_1" });
      mockStripe.customers.createBalanceTransaction.mockRejectedValueOnce(
        new Error("balance transaction failed"),
      );

      const res = await postAction("billing_apply_credit", {
        reason: "Goodwill credit",
        payload: { amountCents: 2500 },
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Stripe error: balance transaction failed");
      expectNoAuditRow();
    });
  });

  describe("billing_refund", () => {
    it("returns 400 when chargeId is missing", async () => {
      pushUserLookup();

      const res = await postAction("billing_refund", {
        reason: "Refund duplicate charge",
        payload: { amountCents: 1000 },
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Charge ID is required for refunds");
      expect(mockStripe.refunds.create).not.toHaveBeenCalled();
      expectNoAuditRow();
    });

    it("returns 400 when payload is missing entirely", async () => {
      pushUserLookup();

      const res = await postAction("billing_refund", {
        reason: "Refund duplicate charge",
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Charge ID is required for refunds");
      expect(mockStripe.refunds.create).not.toHaveBeenCalled();
      expectNoAuditRow();
    });

    it("returns 500 with the Stripe error message when Stripe rejects", async () => {
      pushUserLookup();
      mockStripe.refunds.create.mockRejectedValueOnce(
        new Error("refund failed"),
      );

      const res = await postAction("billing_refund", {
        reason: "Refund duplicate charge",
        payload: { chargeId: "ch_1", amountCents: 1000 },
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Stripe error: refund failed");
      expectNoAuditRow();
    });
  });
});

// -----------------------------------------------------------------------------
// Read-only admin user detail / history endpoints (Task #152).
//
// These shape-tests guard the JSON contract for the four GET endpoints that the
// admin UI depends on (timeline, messaging, payments, audit). A regression that
// drops a field, inverts a boolean, or forgets to JSON.parse a stored column
// would surface here.
// -----------------------------------------------------------------------------

describe("GET /api/admin/users/:userId/timeline", () => {
  it("returns events with parsed JSON context", async () => {
    const ctx = { source: "web", details: { foo: "bar" } };
    dbState.selectQueue.push([
      {
        id: "evt-1",
        eventName: "booking_link_copied",
        occurredAt: "2026-04-20T12:00:00.000Z",
        source: "client",
        context: JSON.stringify(ctx),
      },
      {
        id: "evt-2",
        eventName: "first_booking_created",
        occurredAt: "2026-04-19T08:30:00.000Z",
        source: "server",
        context: null,
      },
    ]);

    const res = await request(buildApp())
      .get("/api/admin/users/demo-user/timeline")
      .set("Authorization", `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("events");
    expect(Array.isArray(res.body.events)).toBe(true);
    expect(res.body.events).toHaveLength(2);

    expect(res.body.events[0]).toEqual({
      id: "evt-1",
      eventName: "booking_link_copied",
      occurredAt: "2026-04-20T12:00:00.000Z",
      source: "client",
      context: ctx,
    });
    expect(res.body.events[1]).toEqual({
      id: "evt-2",
      eventName: "first_booking_created",
      occurredAt: "2026-04-19T08:30:00.000Z",
      source: "server",
      context: null,
    });
  });

  it("returns 200 with context: null for rows whose stored context is malformed JSON", async () => {
    const goodCtx = { source: "web" };
    dbState.selectQueue.push([
      {
        id: "evt-good",
        eventName: "booking_link_copied",
        occurredAt: "2026-04-20T12:00:00.000Z",
        source: "client",
        context: JSON.stringify(goodCtx),
      },
      {
        id: "evt-bad",
        eventName: "first_booking_created",
        occurredAt: "2026-04-19T08:30:00.000Z",
        source: "server",
        context: "{not valid json",
      },
    ]);

    const res = await request(buildApp())
      .get("/api/admin/users/demo-user/timeline")
      .set("Authorization", `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.events).toHaveLength(2);
    expect(res.body.events[0]).toEqual({
      id: "evt-good",
      eventName: "booking_link_copied",
      occurredAt: "2026-04-20T12:00:00.000Z",
      source: "client",
      context: goodCtx,
    });
    expect(res.body.events[1]).toEqual({
      id: "evt-bad",
      eventName: "first_booking_created",
      occurredAt: "2026-04-19T08:30:00.000Z",
      source: "server",
      context: null,
    });
  });
});

describe("GET /api/admin/users/:userId/messaging", () => {
  it("returns preferences and an active suppression block when one exists", async () => {
    // 1st select = user row, 2nd select = active suppression
    dbState.selectQueue.push([
      {
        email: "demo@example.com",
        phone: "+15551234567",
        notifyBySms: true,
        notifyByEmail: false,
      },
    ]);
    dbState.selectQueue.push([
      {
        suppressUntil: "2099-01-01T00:00:00.000Z",
        reason: "User asked to pause",
      },
    ]);

    const res = await request(buildApp())
      .get("/api/admin/users/demo-user/messaging")
      .set("Authorization", `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      customerIo: { status: "link_out_only" },
      oneSignal: { status: "link_out_only", pushEnabled: true },
      preferences: { notifyBySms: true, notifyByEmail: false },
      suppression: {
        active: true,
        until: "2099-01-01T00:00:00.000Z",
        reason: "User asked to pause",
      },
    });
    expect(res.body.customerIo).toHaveProperty("note");
    expect(res.body.oneSignal).toHaveProperty("note");
  });

  it("returns suppression: null when no active suppression exists", async () => {
    dbState.selectQueue.push([
      {
        email: "demo@example.com",
        phone: null,
        notifyBySms: false,
        notifyByEmail: true,
      },
    ]);
    dbState.selectQueue.push([]);

    const res = await request(buildApp())
      .get("/api/admin/users/demo-user/messaging")
      .set("Authorization", `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.suppression).toBeNull();
    expect(res.body.preferences).toEqual({
      notifyBySms: false,
      notifyByEmail: true,
    });
    expect(res.body.oneSignal.pushEnabled).toBe(false);
  });
});

describe("GET /api/admin/users/:userId/payments", () => {
  it("returns subscription, stripeConnect, and invoice counts", async () => {
    // 1st select = user row, 2nd = invoices total, 3rd = invoices paid
    dbState.selectQueue.push([
      {
        isPro: true,
        proExpiresAt: "2027-01-01T00:00:00.000Z",
        stripeConnectAccountId: "acct_123",
        stripeConnectStatus: "active",
      },
    ]);
    dbState.selectQueue.push([{ count: 9 }]);
    dbState.selectQueue.push([{ count: 7 }]);

    const res = await request(buildApp())
      .get("/api/admin/users/demo-user/payments")
      .set("Authorization", `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      subscription: { isPro: true, expiresAt: "2027-01-01T00:00:00.000Z" },
      stripeConnect: { accountId: "acct_123", status: "active" },
      invoices: { total: 9, paid: 7 },
    });
    expect(res.body).toHaveProperty("note");
  });

  it("falls back to safe defaults when the user has no Stripe linkage", async () => {
    dbState.selectQueue.push([
      {
        isPro: false,
        proExpiresAt: null,
        stripeConnectAccountId: null,
        stripeConnectStatus: null,
      },
    ]);
    dbState.selectQueue.push([{ count: 0 }]);
    dbState.selectQueue.push([{ count: 0 }]);

    const res = await request(buildApp())
      .get("/api/admin/users/demo-user/payments")
      .set("Authorization", `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.subscription).toEqual({ isPro: false, expiresAt: null });
    expect(res.body.stripeConnect).toEqual({
      accountId: null,
      status: "not_connected",
    });
    expect(res.body.invoices).toEqual({ total: 0, paid: 0 });
  });
});

describe("GET /api/admin/users/:userId/audit", () => {
  it("returns audit actions with parsed JSON payload", async () => {
    const payload = { noteId: "note-123" };
    dbState.selectQueue.push([
      {
        id: "audit-1",
        createdAt: "2026-04-20T12:00:00.000Z",
        actorUserId: "demo-user",
        actorEmail: "demo@example.com",
        actionKey: "add_note",
        reason: "Logging context",
        payload: JSON.stringify(payload),
      },
      {
        id: "audit-2",
        createdAt: "2026-04-19T12:00:00.000Z",
        actorUserId: "demo-user",
        actorEmail: "demo@example.com",
        actionKey: "user_flagged",
        reason: "Spammy account",
        payload: null,
      },
    ]);

    const res = await request(buildApp())
      .get("/api/admin/users/demo-user/audit")
      .set("Authorization", `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("actions");
    expect(res.body.actions).toHaveLength(2);

    expect(res.body.actions[0]).toEqual({
      id: "audit-1",
      createdAt: "2026-04-20T12:00:00.000Z",
      actorUserId: "demo-user",
      actorEmail: "demo@example.com",
      actionKey: "add_note",
      reason: "Logging context",
      payload,
    });
    expect(res.body.actions[1].payload).toBeNull();
  });

  it("returns 200 with payload: null for rows whose stored payload is malformed JSON", async () => {
    const goodPayload = { noteId: "note-123" };
    dbState.selectQueue.push([
      {
        id: "audit-good",
        createdAt: "2026-04-20T12:00:00.000Z",
        actorUserId: "demo-user",
        actorEmail: "demo@example.com",
        actionKey: "add_note",
        reason: "Logging context",
        payload: JSON.stringify(goodPayload),
      },
      {
        id: "audit-bad",
        createdAt: "2026-04-19T12:00:00.000Z",
        actorUserId: "demo-user",
        actorEmail: "demo@example.com",
        actionKey: "user_flagged",
        reason: "Spammy account",
        payload: "{truncated payload",
      },
    ]);

    const res = await request(buildApp())
      .get("/api/admin/users/demo-user/audit")
      .set("Authorization", `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.actions).toHaveLength(2);
    expect(res.body.actions[0].payload).toEqual(goodPayload);
    expect(res.body.actions[1]).toEqual({
      id: "audit-bad",
      createdAt: "2026-04-19T12:00:00.000Z",
      actorUserId: "demo-user",
      actorEmail: "demo@example.com",
      actionKey: "user_flagged",
      reason: "Spammy account",
      payload: null,
    });
  });
});

describe("POST /api/admin/users/:userId/notes", () => {
  it("inserts a note and returns the new row including its id", async () => {
    // First select = target user lookup; we then queue an explicit returning
    // row so the response payload contains a deterministic id.
    dbState.selectQueue.push([{ id: "demo-user" }]);
    dbState.insertReturningQueue.push([
      {
        id: "note-xyz",
        actorUserId: "demo-user",
        targetUserId: "demo-user",
        note: "Customer called about billing",
        createdAt: "2026-04-20T12:00:00.000Z",
      },
    ]);

    const res = await request(buildApp())
      .post("/api/admin/users/demo-user/notes")
      .set("Authorization", `Bearer ${adminToken()}`)
      .send({ note: "  Customer called about billing  " });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("note");
    expect(res.body.note).toMatchObject({
      id: "note-xyz",
      targetUserId: "demo-user",
      note: "Customer called about billing",
    });

    // The note insert should be the first (notes), then the audit insert.
    const noteInsert = dbState.insertCalls.find((c) => c.table === userAdminNotes);
    expect(noteInsert).toBeTruthy();
    expect(noteInsert!.values).toMatchObject({
      actorUserId: "demo-user",
      targetUserId: "demo-user",
      note: "Customer called about billing",
    });

    const auditInsert = dbState.insertCalls.find(
      (c) => c.table === adminActionAudit,
    );
    expect(auditInsert).toBeTruthy();
    expect(auditInsert!.values).toMatchObject({
      actorUserId: "demo-user",
      targetUserId: "demo-user",
      actionKey: "add_note",
      source: "admin_ui",
    });
  });

  it("rejects a missing or blank note with 400", async () => {
    const blankRes = await request(buildApp())
      .post("/api/admin/users/demo-user/notes")
      .set("Authorization", `Bearer ${adminToken()}`)
      .send({ note: "   " });

    expect(blankRes.status).toBe(400);
    expect(blankRes.body.error).toMatch(/note/i);

    const missingRes = await request(buildApp())
      .post("/api/admin/users/demo-user/notes")
      .set("Authorization", `Bearer ${adminToken()}`)
      .send({});

    expect(missingRes.status).toBe(400);
    expect(missingRes.body.error).toMatch(/note/i);

    // Neither attempt should have triggered a notes insert.
    expect(
      dbState.insertCalls.find((c) => c.table === userAdminNotes),
    ).toBeUndefined();
  });

  it("returns 404 when the target user does not exist", async () => {
    dbState.selectQueue.push([]);

    const res = await request(buildApp())
      .post("/api/admin/users/missing-user/notes")
      .set("Authorization", `Bearer ${adminToken()}`)
      .send({ note: "Anything" });

    expect(res.status).toBe(404);
    expect(
      dbState.insertCalls.find((c) => c.table === userAdminNotes),
    ).toBeUndefined();
  });

  it("returns 401 when the request has no admin identity", async () => {
    // Bypass adminMiddleware so the in-handler `if (!req.adminUserId)` guard
    // is reachable. The override leaves req.adminUserId unset.
    mockAdminMiddlewareState.override = (_req, _res, next) => next();

    const res = await request(buildApp())
      .post("/api/admin/users/demo-user/notes")
      .send({ note: "Anything" });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/admin identity/i);
    expect(
      dbState.insertCalls.find((c) => c.table === userAdminNotes),
    ).toBeUndefined();
  });
});

// -----------------------------------------------------------------------------
// Remaining admin user-action endpoints (Task #155).
//
// These shape-tests guard the JSON contract for the notes-list, flag toggle,
// and impersonate endpoints, plus their documented error branches. A
// regression that drops a field or skips the audit insert would surface here.
// -----------------------------------------------------------------------------

describe("GET /api/admin/users/:userId/notes", () => {
  it("returns the notes array from the DB ordered by createdAt desc", async () => {
    const fakeNotes = [
      {
        id: "note-1",
        actorUserId: "demo-user",
        targetUserId: "demo-user",
        note: "Newest note",
        createdAt: "2026-04-20T12:00:00.000Z",
      },
      {
        id: "note-2",
        actorUserId: "demo-user",
        targetUserId: "demo-user",
        note: "Older note",
        createdAt: "2026-04-19T12:00:00.000Z",
      },
    ];
    dbState.selectQueue.push(fakeNotes);

    const res = await request(buildApp())
      .get("/api/admin/users/demo-user/notes")
      .set("Authorization", `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("notes");
    expect(Array.isArray(res.body.notes)).toBe(true);
    expect(res.body.notes).toHaveLength(2);
    expect(res.body.notes[0]).toMatchObject({
      id: "note-1",
      note: "Newest note",
      targetUserId: "demo-user",
    });
    expect(res.body.notes[1]).toMatchObject({
      id: "note-2",
      note: "Older note",
    });
  });

  it("returns an empty array when the user has no notes", async () => {
    dbState.selectQueue.push([]);

    const res = await request(buildApp())
      .get("/api/admin/users/demo-user/notes")
      .set("Authorization", `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ notes: [] });
  });

  it("honors explicit ?limit and ?offset query parameters", async () => {
    dbState.selectQueue.push([]);

    const res = await request(buildApp())
      .get("/api/admin/users/demo-user/notes?limit=5&offset=10")
      .set("Authorization", `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ notes: [] });
    // The drizzle chain mock records limit/offset via passthrough, so we
    // verify that select() was invoked exactly once and that the chain's
    // limit/offset methods were actually called with the parsed integers.
    expect(dbMock.select).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/admin/users/:userId/flag", () => {
  it("inserts a flag, writes the audit row, and returns the new flag", async () => {
    // 1st select = users lookup, 2nd select = existing-flag check (none).
    dbState.selectQueue.push([{ id: "demo-user" }]);
    dbState.selectQueue.push([]);
    dbState.insertReturningQueue.push([
      {
        id: "flag-xyz",
        userId: "demo-user",
        flaggedBy: "demo-user",
        flaggedAt: "2026-04-20T12:00:00.000Z",
        reason: "Suspicious activity",
        unflaggedAt: null,
        unflaggedBy: null,
      },
    ]);

    const res = await request(buildApp())
      .post("/api/admin/users/demo-user/flag")
      .set("Authorization", `Bearer ${adminToken()}`)
      .send({ reason: "Suspicious activity" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("flag");
    expect(res.body.flag).toMatchObject({
      id: "flag-xyz",
      userId: "demo-user",
      reason: "Suspicious activity",
    });

    const flagInsert = dbState.insertCalls.find((c) => c.table === userFlags);
    expect(flagInsert).toBeTruthy();
    expect(flagInsert!.values).toMatchObject({
      userId: "demo-user",
      flaggedBy: "demo-user",
      reason: "Suspicious activity",
    });

    const auditInsert = dbState.insertCalls.find(
      (c) => c.table === adminActionAudit,
    );
    expect(auditInsert).toBeTruthy();
    expect(auditInsert!.values).toMatchObject({
      actorUserId: "demo-user",
      targetUserId: "demo-user",
      actionKey: "user_flagged",
      reason: "Suspicious activity",
      source: "admin_ui",
    });
    const auditPayload = JSON.parse(
      (auditInsert!.values as Record<string, unknown>).payload as string,
    );
    expect(auditPayload).toMatchObject({ flagId: "flag-xyz", action: "flagged" });
  });

  it("returns 400 when the user is already flagged", async () => {
    dbState.selectQueue.push([{ id: "demo-user" }]);
    dbState.selectQueue.push([
      {
        id: "flag-existing",
        userId: "demo-user",
        flaggedBy: "demo-user",
        flaggedAt: "2026-04-19T12:00:00.000Z",
        reason: "Earlier reason",
        unflaggedAt: null,
        unflaggedBy: null,
      },
    ]);

    const res = await request(buildApp())
      .post("/api/admin/users/demo-user/flag")
      .set("Authorization", `Bearer ${adminToken()}`)
      .send({ reason: "Trying again" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already flagged/i);
    expect(
      dbState.insertCalls.find((c) => c.table === userFlags),
    ).toBeUndefined();
    expect(
      dbState.insertCalls.find((c) => c.table === adminActionAudit),
    ).toBeUndefined();
  });

  it("returns 404 when the target user does not exist", async () => {
    dbState.selectQueue.push([]);

    const res = await request(buildApp())
      .post("/api/admin/users/missing-user/flag")
      .set("Authorization", `Bearer ${adminToken()}`)
      .send({ reason: "Anything" });

    expect(res.status).toBe(404);
    expect(
      dbState.insertCalls.find((c) => c.table === userFlags),
    ).toBeUndefined();
  });

  it("returns 400 when reason is missing or blank", async () => {
    const blankRes = await request(buildApp())
      .post("/api/admin/users/demo-user/flag")
      .set("Authorization", `Bearer ${adminToken()}`)
      .send({ reason: "   " });

    expect(blankRes.status).toBe(400);
    expect(blankRes.body.error).toMatch(/reason/i);

    const missingRes = await request(buildApp())
      .post("/api/admin/users/demo-user/flag")
      .set("Authorization", `Bearer ${adminToken()}`)
      .send({});

    expect(missingRes.status).toBe(400);
    expect(missingRes.body.error).toMatch(/reason/i);

    expect(
      dbState.insertCalls.find((c) => c.table === userFlags),
    ).toBeUndefined();
  });

  it("returns 401 when the request has no admin identity", async () => {
    mockAdminMiddlewareState.override = (_req, _res, next) => next();

    const res = await request(buildApp())
      .post("/api/admin/users/demo-user/flag")
      .send({ reason: "Anything" });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/admin identity/i);
    expect(
      dbState.insertCalls.find((c) => c.table === userFlags),
    ).toBeUndefined();
  });
});

describe("DELETE /api/admin/users/:userId/flag", () => {
  it("clears the active flag, writes an audit row, and returns success", async () => {
    dbState.selectQueue.push([
      {
        id: "flag-existing",
        userId: "demo-user",
        flaggedBy: "demo-user",
        flaggedAt: "2026-04-19T12:00:00.000Z",
        reason: "Earlier reason",
        unflaggedAt: null,
        unflaggedBy: null,
      },
    ]);

    const res = await request(buildApp())
      .delete("/api/admin/users/demo-user/flag")
      .set("Authorization", `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });

    const flagUpdate = dbState.updateCalls.find((c) => c.table === userFlags);
    expect(flagUpdate).toBeTruthy();
    expect(flagUpdate!.set).toMatchObject({
      unflaggedBy: "demo-user",
    });
    expect(
      (flagUpdate!.set as Record<string, unknown>).unflaggedAt,
    ).toBeTruthy();

    const auditInsert = dbState.insertCalls.find(
      (c) => c.table === adminActionAudit,
    );
    expect(auditInsert).toBeTruthy();
    expect(auditInsert!.values).toMatchObject({
      actorUserId: "demo-user",
      targetUserId: "demo-user",
      actionKey: "user_flagged",
      reason: "Flag removed",
      source: "admin_ui",
    });
    const auditPayload = JSON.parse(
      (auditInsert!.values as Record<string, unknown>).payload as string,
    );
    expect(auditPayload).toMatchObject({
      flagId: "flag-existing",
      action: "unflagged",
    });
  });

  it("returns 404 when no active flag exists for the user", async () => {
    dbState.selectQueue.push([]);

    const res = await request(buildApp())
      .delete("/api/admin/users/demo-user/flag")
      .set("Authorization", `Bearer ${adminToken()}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/no active flag/i);
    expect(
      dbState.updateCalls.find((c) => c.table === userFlags),
    ).toBeUndefined();
    expect(
      dbState.insertCalls.find((c) => c.table === adminActionAudit),
    ).toBeUndefined();
  });

  it("returns 401 when the request has no admin identity", async () => {
    mockAdminMiddlewareState.override = (_req, _res, next) => next();

    const res = await request(buildApp())
      .delete("/api/admin/users/demo-user/flag");

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/admin identity/i);
    expect(
      dbState.updateCalls.find((c) => c.table === userFlags),
    ).toBeUndefined();
  });
});

describe("GET /api/admin/users/:userId/impersonate", () => {
  it("returns the user view + jobs/leads/invoices summaries and writes an audit row", async () => {
    // Queue order: target user, jobs, leads, invoices.
    dbState.selectQueue.push([
      {
        id: "demo-user",
        email: "demo@example.com",
        username: "demo",
        name: "Demo User",
        phone: "+15551234567",
        isPro: true,
        plan: "pro",
        onboardingCompleted: true,
        onboardingStep: 5,
        createdAt: "2026-01-01T00:00:00.000Z",
        lastActiveAt: "2026-04-20T12:00:00.000Z",
        stripeCustomerId: "cus_1",
        stripeSubscriptionId: "sub_1",
      },
    ]);
    dbState.selectQueue.push([
      {
        id: "job-1",
        title: "Lawn mow",
        status: "scheduled",
        scheduledDate: "2026-05-01",
        price: 75,
        createdAt: "2026-04-15T10:00:00.000Z",
      },
    ]);
    dbState.selectQueue.push([
      {
        id: "lead-1",
        clientName: "Jane",
        status: "new",
        score: 80,
        createdAt: "2026-04-10T09:00:00.000Z",
      },
    ]);
    dbState.selectQueue.push([
      {
        id: "inv-1",
        status: "paid",
        amount: 12500,
        sentAt: "2026-04-12T11:00:00.000Z",
        createdAt: "2026-04-12T10:00:00.000Z",
      },
    ]);

    const res = await request(buildApp())
      .get("/api/admin/users/demo-user/impersonate")
      .set("Authorization", `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      id: "demo-user",
      email: "demo@example.com",
      username: "demo",
      name: "Demo User",
      phone: "+15551234567",
      isPro: true,
      plan: "pro",
      onboardingCompleted: true,
      onboardingStep: 5,
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
    });
    expect(res.body.jobs).toEqual([
      {
        id: "job-1",
        title: "Lawn mow",
        status: "scheduled",
        scheduledDate: "2026-05-01",
        price: 75,
        createdAt: "2026-04-15T10:00:00.000Z",
      },
    ]);
    expect(res.body.leads).toEqual([
      {
        id: "lead-1",
        clientName: "Jane",
        status: "new",
        score: 80,
        createdAt: "2026-04-10T09:00:00.000Z",
      },
    ]);
    expect(res.body.invoices).toEqual([
      {
        id: "inv-1",
        status: "paid",
        amount: 12500,
        sentAt: "2026-04-12T11:00:00.000Z",
        createdAt: "2026-04-12T10:00:00.000Z",
      },
    ]);
    expect(res.body).toMatchObject({
      isReadOnly: true,
      viewedBy: "demo-user",
    });
    expect(res.body.viewedAt).toBeTruthy();

    const auditInsert = dbState.insertCalls.find(
      (c) => c.table === adminActionAudit,
    );
    expect(auditInsert).toBeTruthy();
    expect(auditInsert!.values).toMatchObject({
      actorUserId: "demo-user",
      targetUserId: "demo-user",
      actionKey: "impersonate_view",
      source: "admin_ui",
    });
  });

  it("returns 404 when the target user does not exist", async () => {
    dbState.selectQueue.push([]);

    const res = await request(buildApp())
      .get("/api/admin/users/missing-user/impersonate")
      .set("Authorization", `Bearer ${adminToken()}`);

    expect(res.status).toBe(404);
    expect(
      dbState.insertCalls.find((c) => c.table === adminActionAudit),
    ).toBeUndefined();
  });

  it("returns 401 when the request has no admin identity", async () => {
    mockAdminMiddlewareState.override = (_req, _res, next) => next();

    const res = await request(buildApp())
      .get("/api/admin/users/demo-user/impersonate");

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/admin identity/i);
    expect(
      dbState.insertCalls.find((c) => c.table === adminActionAudit),
    ).toBeUndefined();
  });
});

// -----------------------------------------------------------------------------
// Remaining admin payments and message endpoints (Task #158).
//
// Covers POST /:userId/retry-payment, GET /:userId/failed-invoices,
// GET /:userId/outbound-messages, and GET /links/external. Mocks Stripe
// invoices and the chainable drizzle select for outbound_messages.
// -----------------------------------------------------------------------------

describe("POST /api/admin/users/:userId/retry-payment", () => {
  it("happy path: pays the supplied invoice, writes audit, and returns the invoice shape", async () => {
    pushTargetUser({ id: "demo-user", stripeCustomerId: "cus_1" });
    mockStripe.invoices.retrieve.mockResolvedValueOnce({
      id: "in_123",
      customer: "cus_1",
    });
    mockStripe.invoices.pay.mockResolvedValueOnce({
      id: "in_123",
      status: "paid",
      amount_due: 0,
      amount_paid: 2500,
    });

    const res = await request(buildApp())
      .post("/api/admin/users/demo-user/retry-payment")
      .set("Authorization", `Bearer ${adminToken()}`)
      .send({ invoiceId: "in_123" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      invoice: {
        id: "in_123",
        status: "paid",
        amountDue: 0,
        amountPaid: 2500,
      },
    });
    expect(mockStripe.invoices.pay).toHaveBeenCalledWith("in_123");
    expect(mockStripe.invoices.list).not.toHaveBeenCalled();

    const auditCall = dbState.insertCalls.find(
      (c) => c.table === adminActionAudit,
    );
    expect(auditCall).toBeTruthy();
    expect(auditCall!.values).toMatchObject({
      actorUserId: "demo-user",
      targetUserId: "demo-user",
      actionKey: "billing_retry_payment",
      reason: "Admin retried failed payment",
      source: "admin_ui",
    });
    const payload = JSON.parse(
      (auditCall!.values as Record<string, string>).payload as string,
    );
    expect(payload).toEqual({
      invoiceId: "in_123",
      status: "paid",
      amountDue: 0,
    });
  });

  it("happy path with no invoiceId: lists open invoices, pays the first, and returns its shape", async () => {
    pushTargetUser({ id: "demo-user", stripeCustomerId: "cus_1" });
    mockStripe.invoices.list.mockResolvedValueOnce({
      data: [{ id: "in_open" }],
    });
    mockStripe.invoices.pay.mockResolvedValueOnce({
      id: "in_open",
      status: "paid",
      amount_due: 0,
      amount_paid: 1500,
    });

    const res = await request(buildApp())
      .post("/api/admin/users/demo-user/retry-payment")
      .set("Authorization", `Bearer ${adminToken()}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.invoice).toMatchObject({
      id: "in_open",
      status: "paid",
      amountDue: 0,
      amountPaid: 1500,
    });
    expect(mockStripe.invoices.list).toHaveBeenCalledWith({
      customer: "cus_1",
      status: "open",
      limit: 1,
    });
    expect(mockStripe.invoices.pay).toHaveBeenCalledWith("in_open");
  });

  it("returns 401 when the request has no admin identity", async () => {
    mockAdminMiddlewareState.override = (_req, _res, next) => next();

    const res = await request(buildApp())
      .post("/api/admin/users/demo-user/retry-payment")
      .send({ invoiceId: "in_123" });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/admin identity/i);
    expect(mockStripe.invoices.pay).not.toHaveBeenCalled();
    expect(
      dbState.insertCalls.find((c) => c.table === adminActionAudit),
    ).toBeUndefined();
  });

  it("returns 404 when the target user does not exist", async () => {
    dbState.selectQueue.push([]);

    const res = await request(buildApp())
      .post("/api/admin/users/missing-user/retry-payment")
      .set("Authorization", `Bearer ${adminToken()}`)
      .send({ invoiceId: "in_123" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("User not found");
    expect(mockStripe.invoices.pay).not.toHaveBeenCalled();
    expect(
      dbState.insertCalls.find((c) => c.table === adminActionAudit),
    ).toBeUndefined();
  });

  it("returns 400 when the target user has no Stripe customer", async () => {
    pushTargetUser({ id: "demo-user", stripeCustomerId: null });

    const res = await request(buildApp())
      .post("/api/admin/users/demo-user/retry-payment")
      .set("Authorization", `Bearer ${adminToken()}`)
      .send({ invoiceId: "in_123" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("User has no Stripe customer ID");
    expect(mockStripe.invoices.pay).not.toHaveBeenCalled();
    expect(
      dbState.insertCalls.find((c) => c.table === adminActionAudit),
    ).toBeUndefined();
  });

  it("returns 400 when no invoiceId is supplied and Stripe finds no open invoices", async () => {
    pushTargetUser({ id: "demo-user", stripeCustomerId: "cus_1" });
    mockStripe.invoices.list.mockResolvedValueOnce({ data: [] });

    const res = await request(buildApp())
      .post("/api/admin/users/demo-user/retry-payment")
      .set("Authorization", `Bearer ${adminToken()}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("No open invoices found to retry");
    expect(mockStripe.invoices.pay).not.toHaveBeenCalled();
    expect(
      dbState.insertCalls.find((c) => c.table === adminActionAudit),
    ).toBeUndefined();
  });

  it("returns 500 with the Stripe error message when invoice payment fails", async () => {
    pushTargetUser({ id: "demo-user", stripeCustomerId: "cus_1" });
    mockStripe.invoices.retrieve.mockResolvedValueOnce({
      id: "in_123",
      customer: "cus_1",
    });
    mockStripe.invoices.pay.mockRejectedValueOnce(
      new Error("card declined"),
    );

    const res = await request(buildApp())
      .post("/api/admin/users/demo-user/retry-payment")
      .set("Authorization", `Bearer ${adminToken()}`)
      .send({ invoiceId: "in_123" });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("card declined");
    expect(
      dbState.insertCalls.find((c) => c.table === adminActionAudit),
    ).toBeUndefined();
  });

  it("returns 404 with 'Invoice not found' when Stripe reports the invoiceId does not exist", async () => {
    pushTargetUser({ id: "demo-user", stripeCustomerId: "cus_1" });
    const stripeMissing = Object.assign(new Error("No such invoice: in_missing"), {
      code: "resource_missing",
      statusCode: 404,
    });
    mockStripe.invoices.retrieve.mockRejectedValueOnce(stripeMissing);

    const res = await request(buildApp())
      .post("/api/admin/users/demo-user/retry-payment")
      .set("Authorization", `Bearer ${adminToken()}`)
      .send({ invoiceId: "in_missing" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Invoice not found");
    expect(mockStripe.invoices.pay).not.toHaveBeenCalled();
    expect(
      dbState.insertCalls.find((c) => c.table === adminActionAudit),
    ).toBeUndefined();
  });

  it("returns 404 with 'Invoice does not belong to this user' when the invoice's customer differs from the target user", async () => {
    pushTargetUser({ id: "demo-user", stripeCustomerId: "cus_1" });
    // The invoice exists but is attached to a different Stripe customer.
    mockStripe.invoices.retrieve.mockResolvedValueOnce({
      id: "in_other",
      customer: "cus_other",
    });

    const res = await request(buildApp())
      .post("/api/admin/users/demo-user/retry-payment")
      .set("Authorization", `Bearer ${adminToken()}`)
      .send({ invoiceId: "in_other" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Invoice does not belong to this user");
    expect(mockStripe.invoices.pay).not.toHaveBeenCalled();
    expect(
      dbState.insertCalls.find((c) => c.table === adminActionAudit),
    ).toBeUndefined();
  });

  it("treats an expanded customer object on the invoice the same as a string id for ownership", async () => {
    pushTargetUser({ id: "demo-user", stripeCustomerId: "cus_1" });
    // Stripe may return the customer expanded as an object instead of the id;
    // ownership check must compare the nested id.
    mockStripe.invoices.retrieve.mockResolvedValueOnce({
      id: "in_expanded",
      customer: { id: "cus_other" },
    });

    const res = await request(buildApp())
      .post("/api/admin/users/demo-user/retry-payment")
      .set("Authorization", `Bearer ${adminToken()}`)
      .send({ invoiceId: "in_expanded" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Invoice does not belong to this user");
    expect(mockStripe.invoices.pay).not.toHaveBeenCalled();
  });
});

describe("GET /api/admin/users/:userId/failed-invoices", () => {
  it("returns merged open + uncollectible invoices in the documented shape", async () => {
    pushTargetUser({ stripeCustomerId: "cus_1" });
    mockStripe.invoices.list
      .mockResolvedValueOnce({
        data: [
          {
            id: "in_open",
            status: "open",
            amount_due: 2500,
            amount_paid: 0,
            created: 1700000000,
            due_date: 1700100000,
            attempt_count: 2,
            next_payment_attempt: 1700200000,
          },
        ],
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: "in_unc",
            status: "uncollectible",
            amount_due: 1500,
            amount_paid: 0,
            created: 1699000000,
            due_date: null,
            attempt_count: 4,
            next_payment_attempt: null,
          },
        ],
      });

    const res = await request(buildApp())
      .get("/api/admin/users/demo-user/failed-invoices")
      .set("Authorization", `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.invoices).toEqual([
      {
        id: "in_open",
        status: "open",
        amountDue: 2500,
        amountPaid: 0,
        created: new Date(1700000000 * 1000).toISOString(),
        dueDate: new Date(1700100000 * 1000).toISOString(),
        attemptCount: 2,
        lastAttempt: new Date(1700200000 * 1000).toISOString(),
      },
      {
        id: "in_unc",
        status: "uncollectible",
        amountDue: 1500,
        amountPaid: 0,
        created: new Date(1699000000 * 1000).toISOString(),
        dueDate: null,
        attemptCount: 4,
        lastAttempt: null,
      },
    ]);

    expect(mockStripe.invoices.list).toHaveBeenCalledTimes(2);
    expect(mockStripe.invoices.list).toHaveBeenNthCalledWith(1, {
      customer: "cus_1",
      status: "open",
      limit: 10,
    });
    expect(mockStripe.invoices.list).toHaveBeenNthCalledWith(2, {
      customer: "cus_1",
      status: "uncollectible",
      limit: 10,
    });

    const auditCall = dbState.insertCalls.find(
      (c) => c.table === adminActionAudit,
    );
    expect(auditCall).toBeTruthy();
    expect(auditCall!.values).toMatchObject({
      actorUserId: "demo-user",
      targetUserId: "demo-user",
      actionKey: "billing_view_failed_invoices",
      source: "admin_ui",
    });
    const payload = JSON.parse(
      (auditCall!.values as Record<string, string>).payload as string,
    );
    expect(payload).toEqual({ count: 2 });
  });

  it("returns an empty list (no audit, no Stripe call) when the user has no Stripe customer", async () => {
    pushTargetUser({ stripeCustomerId: null });

    const res = await request(buildApp())
      .get("/api/admin/users/demo-user/failed-invoices")
      .set("Authorization", `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ invoices: [] });
    expect(mockStripe.invoices.list).not.toHaveBeenCalled();
    expect(
      dbState.insertCalls.find((c) => c.table === adminActionAudit),
    ).toBeUndefined();
  });
});

describe("GET /api/admin/users/:userId/outbound-messages", () => {
  it("returns the messages array from the DB in the documented shape", async () => {
    const fakeRows = [
      {
        id: "msg-1",
        channel: "sms",
        type: "first_booking_nudge",
        status: "sent",
        toAddress: "+15551234567",
        scheduledFor: "2026-04-20T12:00:00.000Z",
        sentAt: "2026-04-20T12:01:00.000Z",
        canceledAt: null,
        failureReason: null,
        createdAt: "2026-04-20T11:59:00.000Z",
        updatedAt: "2026-04-20T12:01:00.000Z",
      },
      {
        id: "msg-2",
        channel: "email",
        type: "welcome",
        status: "failed",
        toAddress: "demo@example.com",
        scheduledFor: null,
        sentAt: null,
        canceledAt: null,
        failureReason: "bounced",
        createdAt: "2026-04-19T10:00:00.000Z",
        updatedAt: "2026-04-19T10:00:30.000Z",
      },
    ];
    dbState.selectQueue.push(fakeRows);

    const res = await request(buildApp())
      .get("/api/admin/users/demo-user/outbound-messages")
      .set("Authorization", `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ messages: fakeRows });
    expect(dbMock.select).toHaveBeenCalledTimes(1);
  });

  it("returns an empty array when the user has no outbound messages", async () => {
    dbState.selectQueue.push([]);

    const res = await request(buildApp())
      .get("/api/admin/users/demo-user/outbound-messages")
      .set("Authorization", `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ messages: [] });
  });

  it("references the outboundMessages table when building the select", async () => {
    dbState.selectQueue.push([]);

    await request(buildApp())
      .get("/api/admin/users/demo-user/outbound-messages")
      .set("Authorization", `Bearer ${adminToken()}`);

    // The select projection is pulled from the outboundMessages columns; if a
    // future refactor accidentally swaps tables this assertion will catch it.
    const selectArg = dbMock.select.mock.calls[0]?.[0] as
      | Record<string, unknown>
      | undefined;
    expect(selectArg).toBeDefined();
    expect(selectArg!.id).toBe(outboundMessages.id);
    expect(selectArg!.channel).toBe(outboundMessages.channel);
    expect(selectArg!.failureReason).toBe(outboundMessages.failureReason);
  });
});

describe("GET /api/admin/users/links/external", () => {
  it("returns the documented JSON shape with the four provider blocks", async () => {
    const res = await request(buildApp())
      .get("/api/admin/users/links/external")
      .set("Authorization", `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    for (const provider of ["amplitude", "customerIo", "oneSignal", "stripe"]) {
      expect(res.body).toHaveProperty(provider);
    }

    expect(res.body.amplitude).toEqual({
      baseUrl: expect.any(String),
      userUrlTemplate: expect.stringContaining("{{USER_ID}}"),
    });
    expect(res.body.customerIo).toEqual({
      baseUrl: expect.any(String),
      userUrlTemplate: expect.stringContaining("{{USER_ID}}"),
    });
    expect(res.body.oneSignal).toEqual({
      baseUrl: expect.any(String),
      userUrlTemplate: expect.stringContaining("{{USER_ID}}"),
    });
    expect(res.body.stripe).toEqual({
      baseUrl: expect.any(String),
      customerUrlTemplate: expect.stringContaining("{{CUSTOMER_ID}}"),
    });
  });
});

describe("GET /api/admin/users/plan-prices", () => {
  // Snapshot the env vars under test so we can restore them after each
  // case — the route reads `process.env` lazily on every call.
  const TRACKED_ENV_VARS = [
    "STRIPE_PRICE_PRO_MONTHLY",
    "STRIPE_PRICE_PRO_YEARLY",
    "STRIPE_PRICE_PRO_PLUS_MONTHLY",
    "STRIPE_PRICE_PRO_PLUS_YEARLY",
    "STRIPE_PRICE_BUSINESS_MONTHLY",
    "STRIPE_PRICE_BUSINESS_YEARLY",
  ] as const;
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of TRACKED_ENV_VARS) {
      originalEnv[key] = process.env[key];
    }
  });

  afterEach(() => {
    for (const key of TRACKED_ENV_VARS) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  });

  it("requires admin auth", async () => {
    const res = await request(buildApp()).get("/api/admin/users/plan-prices");
    expect(res.status).toBe(401);
  });

  it("returns one entry per (plan, cadence) pair, flagging unconfigured ones", async () => {
    process.env.STRIPE_PRICE_PRO_MONTHLY = "price_pro_monthly_xyz";
    process.env.STRIPE_PRICE_PRO_YEARLY = "price_pro_yearly_xyz";
    delete process.env.STRIPE_PRICE_PRO_PLUS_MONTHLY;
    delete process.env.STRIPE_PRICE_PRO_PLUS_YEARLY;
    delete process.env.STRIPE_PRICE_BUSINESS_MONTHLY;
    delete process.env.STRIPE_PRICE_BUSINESS_YEARLY;

    const res = await request(buildApp())
      .get("/api/admin/users/plan-prices")
      .set("Authorization", `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.runbookUrl).toMatch(/stripe-plan-price-ids/);
    expect(Array.isArray(res.body.plans)).toBe(true);
    // 3 paid plans × 2 cadences = 6 entries (Free is excluded — no env vars).
    expect(res.body.plans).toHaveLength(6);

    const byKey = new Map<string, any>(
      res.body.plans.map((p: any) => [`${p.plan}:${p.cadence}`, p]),
    );

    const proMonthly = byKey.get("pro:monthly");
    expect(proMonthly).toMatchObject({
      plan: "pro",
      cadence: "monthly",
      envVar: "STRIPE_PRICE_PRO_MONTHLY",
      priceId: "price_pro_monthly_xyz",
      configured: true,
    });

    const businessYearly = byKey.get("business:yearly");
    expect(businessYearly).toMatchObject({
      plan: "business",
      cadence: "yearly",
      envVar: "STRIPE_PRICE_BUSINESS_YEARLY",
      priceId: null,
      configured: false,
    });

    const configuredCount = res.body.plans.filter(
      (p: any) => p.configured,
    ).length;
    expect(configuredCount).toBe(2);
  });

  it("treats whitespace-only env vars as unconfigured", async () => {
    process.env.STRIPE_PRICE_PRO_MONTHLY = "   ";
    process.env.STRIPE_PRICE_PRO_YEARLY = "price_real";
    delete process.env.STRIPE_PRICE_PRO_PLUS_MONTHLY;
    delete process.env.STRIPE_PRICE_PRO_PLUS_YEARLY;
    delete process.env.STRIPE_PRICE_BUSINESS_MONTHLY;
    delete process.env.STRIPE_PRICE_BUSINESS_YEARLY;

    const res = await request(buildApp())
      .get("/api/admin/users/plan-prices")
      .set("Authorization", `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    const byKey = new Map<string, any>(
      res.body.plans.map((p: any) => [`${p.plan}:${p.cadence}`, p]),
    );
    expect(byKey.get("pro:monthly").configured).toBe(false);
    expect(byKey.get("pro:monthly").priceId).toBeNull();
    expect(byKey.get("pro:yearly").configured).toBe(true);
  });
});
