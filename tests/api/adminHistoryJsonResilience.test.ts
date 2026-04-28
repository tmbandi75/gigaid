/**
 * Task #157 — Admin history endpoints must survive bad JSON columns.
 *
 * Several admin history endpoints used to call JSON.parse on stored
 * string columns inside .map() with no try/catch. A single bad row
 * would 500 the whole response. These tests pin down the contract
 * that each endpoint returns 200 and falls back to null for the
 * bad row's parsed field while keeping the good rows intact.
 *
 * Endpoints covered:
 *   - GET  /api/admin/customerio/backfill/:userId  (event.context — POST in prod)
 *   - GET  /api/admin/analytics/user/:userId/timeline (r.extra)
 *   - GET  /api/admin/sms/clear-phone-audit (r.payload)
 *   - GET  /api/admin/audit-logs/:logId (log.payload)
 */

process.env.NODE_ENV = "test";
process.env.APP_JWT_SECRET =
  process.env.APP_JWT_SECRET || "test-secret-admin-history-json-spec";
process.env.ADMIN_USER_IDS = "demo-user";
process.env.ADMIN_EMAILS = "admin@example.com";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgres://localhost/unused";
process.env.CUSTOMERIO_SITE_ID = "test-site";
process.env.CUSTOMERIO_API_KEY = "test-key";

interface InsertCall {
  table: unknown;
  values: unknown;
}

interface DbMockState {
  selectQueue: unknown[];
  executeQueue: unknown[];
  insertCalls: InsertCall[];
}

const dbState: DbMockState = {
  selectQueue: [],
  executeQueue: [],
  insertCalls: [],
};

function resetDbState() {
  dbState.selectQueue = [];
  dbState.executeQueue = [];
  dbState.insertCalls = [];
}

interface ChainMock<T> extends PromiseLike<T> {
  from: (..._args: unknown[]) => ChainMock<T>;
  leftJoin: (..._args: unknown[]) => ChainMock<T>;
  where: (..._args: unknown[]) => ChainMock<T>;
  orderBy: (..._args: unknown[]) => ChainMock<T>;
  limit: (..._args: unknown[]) => ChainMock<T>;
  offset: (..._args: unknown[]) => ChainMock<T>;
  groupBy: (..._args: unknown[]) => ChainMock<T>;
  having: (..._args: unknown[]) => ChainMock<T>;
  set: (..._args: unknown[]) => ChainMock<T>;
  returning: () => Promise<T>;
}

function makeChain<T>(resolveTo: () => T): ChainMock<T> {
  const chain = {} as ChainMock<T>;
  const passthrough = () => chain;
  chain.from = passthrough;
  chain.leftJoin = passthrough;
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

const dbMock = {
  select: jest.fn((..._args: unknown[]): ChainMock<unknown> => {
    return makeChain(() => {
      if (dbState.selectQueue.length === 0) return [];
      return dbState.selectQueue.shift();
    });
  }),
  selectDistinct: jest.fn((..._args: unknown[]): ChainMock<unknown> => {
    return makeChain(() => {
      if (dbState.selectQueue.length === 0) return [];
      return dbState.selectQueue.shift();
    });
  }),
  insert: jest.fn((table: unknown) => ({
    values: (values: unknown) => {
      dbState.insertCalls.push({ table, values });
      const result = {
        returning: () => Promise.resolve([{ id: "mock-id" }]),
        then: <TResult1 = undefined, TResult2 = never>(
          onFulfilled?: ((value: undefined) => TResult1 | PromiseLike<TResult1>) | null,
          onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
        ) => Promise.resolve<undefined>(undefined).then(onFulfilled, onRejected),
      };
      return result;
    },
  })),
  update: jest.fn((_table: unknown) => ({
    set: () => makeChain<undefined>(() => undefined),
  })),
  delete: jest.fn((_table: unknown) => makeChain<undefined>(() => undefined)),
  execute: jest.fn(async (..._args: unknown[]) => {
    if (dbState.executeQueue.length === 0) return { rows: [] };
    return { rows: dbState.executeQueue.shift() };
  }),
};

jest.mock("../../server/db", () => ({
  db: dbMock,
  pool: { query: jest.fn() },
}));

jest.mock("../../server/storage", () => ({
  storage: { getUser: jest.fn() },
}));

jest.mock("openid-client", () => ({ discovery: jest.fn() }), { virtual: true });
jest.mock("openid-client/passport", () => ({ Strategy: class {} }), {
  virtual: true,
});

// Mock global fetch for customer.io HTTP calls in the backfill loop.
const fetchMock = jest.fn(async () =>
  new Response(null, {
    status: 204,
    headers: { "content-type": "application/json" },
  }),
);
(global as any).fetch = fetchMock;

import express from "express";
import request from "supertest";
import { signAppJwt } from "../../server/appJwt";
import { clearAdminCache } from "../../server/copilot/adminMiddleware";
import adminCustomerioRoutes from "../../server/admin/customerioRoutes";
import adminAnalyticsRoutes from "../../server/admin/analyticsRoutes";
import adminSmsHealthRoutes from "../../server/admin/smsHealthRoutes";
import adminAuditLogRoutes from "../../server/admin/auditLogRoutes";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/admin/customerio", adminCustomerioRoutes);
  app.use("/api/admin/analytics", adminAnalyticsRoutes);
  app.use("/api/admin/sms", adminSmsHealthRoutes);
  app.use("/api/admin/audit-logs", adminAuditLogRoutes);
  return app;
}

function adminToken() {
  return signAppJwt({
    sub: "demo-user",
    provider: "firebase",
    email_normalized: "admin@example.com",
  });
}

beforeEach(() => {
  resetDbState();
  dbMock.select.mockClear();
  dbMock.selectDistinct.mockClear();
  dbMock.insert.mockClear();
  dbMock.update.mockClear();
  dbMock.delete.mockClear();
  dbMock.execute.mockClear();
  fetchMock.mockClear();
  clearAdminCache();
});

describe("POST /api/admin/customerio/backfill/:userId — bad event.context", () => {
  it("returns 200 and still syncs the good event when one event has malformed context JSON", async () => {
    const goodCtx = { plan: "pro" };
    // 1st db.select() = events list for the user.
    dbState.selectQueue.push([
      {
        id: "evt-good",
        eventName: "first_booking_created",
        occurredAt: new Date().toISOString(),
        context: JSON.stringify(goodCtx),
      },
      {
        id: "evt-bad",
        eventName: "booking_link_copied",
        occurredAt: new Date().toISOString(),
        context: "{not valid json",
      },
    ]);

    const res = await request(buildApp())
      .post("/api/admin/customerio/backfill/demo-user")
      .set("Authorization", `Bearer ${adminToken()}`)
      .send({ since: new Date(0).toISOString() });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, synced: 2, failed: 0 });

    // Two POSTs to Customer.io's track API should have fired — the bad
    // row falls back to data: {} instead of throwing.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const goodCall = fetchMock.mock.calls.find((c) => {
      const body = JSON.parse((c[1] as RequestInit).body as string);
      return body.name === "first_booking_created";
    });
    const badCall = fetchMock.mock.calls.find((c) => {
      const body = JSON.parse((c[1] as RequestInit).body as string);
      return body.name === "booking_link_copied";
    });
    expect(goodCall).toBeDefined();
    expect(badCall).toBeDefined();
    expect(JSON.parse((goodCall![1] as RequestInit).body as string).data).toEqual(goodCtx);
    expect(JSON.parse((badCall![1] as RequestInit).body as string).data).toEqual({});
  });
});

describe("GET /api/admin/analytics/user/:userId/timeline — bad r.extra", () => {
  it("returns 200 with context: null for the row whose stored extra is malformed JSON", async () => {
    const goodExtra = { source: "web" };
    dbState.executeQueue.push([
      {
        type: "event",
        timestamp: "2026-04-20T12:00:00.000Z",
        name: "booking_link_copied",
        source: "client",
        extra: JSON.stringify(goodExtra),
        actor_id: null,
      },
      {
        type: "admin_action",
        timestamp: "2026-04-19T08:30:00.000Z",
        name: "add_note",
        source: "admin",
        extra: "{truncated payload",
        actor_id: "demo-user",
      },
    ]);

    const res = await request(buildApp())
      .get("/api/admin/analytics/user/demo-user/timeline")
      .set("Authorization", `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("timeline");
    expect(res.body.timeline).toHaveLength(2);
    expect(res.body.timeline[0]).toEqual({
      type: "event",
      timestamp: "2026-04-20T12:00:00.000Z",
      name: "booking_link_copied",
      source: "client",
      actorId: null,
      context: goodExtra,
    });
    expect(res.body.timeline[1]).toEqual({
      type: "admin_action",
      timestamp: "2026-04-19T08:30:00.000Z",
      name: "add_note",
      source: "admin",
      actorId: "demo-user",
      context: null,
    });
  });
});

describe("GET /api/admin/sms/clear-phone-audit — bad r.payload", () => {
  it("returns 200 with previousPhoneE164: null for rows whose stored payload is malformed JSON", async () => {
    // 1st select: total count.
    dbState.selectQueue.push([{ c: 2 }]);
    // 2nd select: rows.
    dbState.selectQueue.push([
      {
        id: "audit-good",
        createdAt: "2026-04-20T12:00:00.000Z",
        actorUserId: "demo-user",
        actorEmail: "admin@example.com",
        targetUserId: "user-1",
        reason: "Cleared duplicate phone",
        payload: JSON.stringify({ previousPhoneE164: "+15551234567" }),
        source: "admin_ui",
        targetUser: { id: "user-1", email: "u1@example.com", username: "u1", name: "User One" },
      },
      {
        id: "audit-bad",
        createdAt: "2026-04-19T08:30:00.000Z",
        actorUserId: "demo-user",
        actorEmail: "admin@example.com",
        targetUserId: "user-2",
        reason: "Cleared duplicate phone",
        payload: "{partial",
        source: "admin_ui",
        targetUser: { id: "user-2", email: "u2@example.com", username: "u2", name: "User Two" },
      },
    ]);

    const res = await request(buildApp())
      .get("/api/admin/sms/clear-phone-audit")
      .set("Authorization", `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("events");
    expect(res.body.events).toHaveLength(2);
    expect(res.body.events[0]).toMatchObject({
      id: "audit-good",
      previousPhoneE164: "+15551234567",
    });
    expect(res.body.events[1]).toMatchObject({
      id: "audit-bad",
      previousPhoneE164: null,
    });
    expect(res.body.pagination).toEqual({ total: 2, limit: 25, offset: 0 });
  });
});

describe("GET /api/admin/audit-logs/:logId — bad log.payload", () => {
  it("returns 200 with payloadParsed: null when the stored payload is malformed JSON", async () => {
    // 1st select: the audit log row itself.
    dbState.selectQueue.push([
      {
        id: "log-bad",
        createdAt: "2026-04-19T08:30:00.000Z",
        actorUserId: "demo-user",
        actorEmail: "admin@example.com",
        targetUserId: "user-2",
        actionKey: "user_flagged",
        reason: "Spammy account",
        payload: "{truncated",
        source: "admin_ui",
      },
    ]);
    // 2nd select: actor user enrichment.
    dbState.selectQueue.push([
      { id: "demo-user", email: "admin@example.com", name: "Admin" },
    ]);
    // 3rd select: target user enrichment.
    dbState.selectQueue.push([
      { id: "user-2", email: "u2@example.com", name: "User Two" },
    ]);

    const res = await request(buildApp())
      .get("/api/admin/audit-logs/log-bad")
      .set("Authorization", `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: "log-bad",
      actionKey: "user_flagged",
      reason: "Spammy account",
      payloadParsed: null,
      actor: { id: "demo-user", email: "admin@example.com", name: "Admin" },
      target: { id: "user-2", email: "u2@example.com", name: "User Two" },
    });
    // The original payload string is preserved alongside the parsed view.
    expect(res.body.payload).toBe("{truncated");
  });

  it("returns 200 with parsed payload for a well-formed row alongside the previous bad-row case", async () => {
    const payload = { noteId: "note-123" };
    dbState.selectQueue.push([
      {
        id: "log-good",
        createdAt: "2026-04-20T12:00:00.000Z",
        actorUserId: "demo-user",
        actorEmail: "admin@example.com",
        targetUserId: null,
        actionKey: "add_note",
        reason: "Logging context",
        payload: JSON.stringify(payload),
        source: "admin_ui",
      },
    ]);
    dbState.selectQueue.push([
      { id: "demo-user", email: "admin@example.com", name: "Admin" },
    ]);

    const res = await request(buildApp())
      .get("/api/admin/audit-logs/log-good")
      .set("Authorization", `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.payloadParsed).toEqual(payload);
    expect(res.body.target).toBeNull();
  });
});
