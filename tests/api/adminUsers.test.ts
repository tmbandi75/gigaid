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

// openid-client is ESM-only; replitAuth imports it at module top but only uses
// it inside setupAuth, which the tests never call.
jest.mock("openid-client", () => ({ discovery: jest.fn() }), { virtual: true });
jest.mock("openid-client/passport", () => ({ Strategy: class {} }), { virtual: true });

// Avoid touching real Stripe credentials at module load time.
jest.mock("../../server/stripeClient", () => ({
  getUncachableStripeClient: jest.fn(async () => ({
    subscriptions: {
      retrieve: jest.fn(),
      update: jest.fn(),
      cancel: jest.fn(),
    },
  })),
}));

import express from "express";
import request from "supertest";
import { isAdminUser, clearAdminCache } from "../../server/copilot/adminMiddleware";
import { signAppJwt } from "../../server/appJwt";
import { adminActionKeys } from "../../shared/schema";
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
