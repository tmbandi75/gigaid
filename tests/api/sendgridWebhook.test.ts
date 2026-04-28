/**
 * SendGrid event-webhook handler tests (Task #81).
 *
 * Verifies that:
 *   - open / click / delivered / bounce events tagged with our customArgs
 *     get persisted to outbound_message_events.
 *   - events without an outbound_message_id but with a known sg_message_id
 *     fall back to the providerMessageId lookup on outbound_messages.
 *   - events for unknown messages or unknown event types are silently dropped.
 *   - duplicate sg_event_ids hit the unique-index conflict path.
 *
 * The DB is mocked: we capture insert calls and feed scripted select results
 * to assert behavior without touching Postgres.
 */

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgres://localhost/unused";

interface InsertCall {
  table: unknown;
  values: unknown;
}

interface DbMockState {
  selectQueue: unknown[][];
  insertReturningQueue: Array<Array<{ id: string }>>;
  insertCalls: InsertCall[];
  updateCalls: Array<{ table: unknown; set: unknown }>;
}

const dbState: DbMockState = {
  selectQueue: [],
  insertReturningQueue: [],
  insertCalls: [],
  updateCalls: [],
};

function resetDbState() {
  dbState.selectQueue = [];
  dbState.insertReturningQueue = [];
  dbState.insertCalls = [];
  dbState.updateCalls = [];
}

interface Chain<T> extends PromiseLike<T> {
  from: (..._args: unknown[]) => Chain<T>;
  where: (..._args: unknown[]) => Chain<T>;
  limit: (..._args: unknown[]) => Chain<T>;
  set: (..._args: unknown[]) => Chain<T>;
  returning: (..._args: unknown[]) => Promise<T>;
  onConflictDoNothing: (..._args: unknown[]) => Chain<T>;
}

function makeChain<T>(resolveTo: () => T): Chain<T> {
  const chain = {} as Chain<T>;
  const passthrough = () => chain;
  chain.from = passthrough;
  chain.where = passthrough;
  chain.limit = passthrough;
  chain.set = passthrough;
  chain.onConflictDoNothing = passthrough;
  chain.returning = () => Promise.resolve(resolveTo());
  chain.then = <TResult1 = T, TResult2 = never>(
    onFulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) => Promise.resolve(resolveTo()).then(onFulfilled, onRejected);
  return chain;
}

const dbMock = {
  select: jest.fn(() =>
    makeChain(() => {
      if (dbState.selectQueue.length === 0) return [];
      return dbState.selectQueue.shift() as unknown[];
    }),
  ),
  insert: jest.fn((table: unknown) => ({
    values: (values: unknown) => {
      dbState.insertCalls.push({ table, values });
      const result: Chain<Array<{ id: string }>> = makeChain(() => {
        if (dbState.insertReturningQueue.length > 0) {
          return dbState.insertReturningQueue.shift() as Array<{ id: string }>;
        }
        return [{ id: `mock-id-${dbState.insertCalls.length}` }];
      });
      return result;
    },
  })),
  update: jest.fn((table: unknown) => ({
    set: (set: unknown) => {
      dbState.updateCalls.push({ table, set });
      return makeChain<undefined>(() => undefined);
    },
  })),
};

jest.mock("../../server/db", () => ({
  db: dbMock,
  pool: {},
}));

jest.mock("../../server/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import type { Request, Response } from "express";
import { handleSendGridEvents } from "../../server/sendgridWebhookRoutes";

function makeReq(events: unknown, headers: Record<string, string> = {}): Request {
  const body = Buffer.from(JSON.stringify(events));
  return {
    body,
    header: (name: string) => headers[name] ?? headers[name.toLowerCase()],
  } as unknown as Request;
}

function makeRes(): { res: Response; statusMock: jest.Mock; jsonMock: jest.Mock } {
  const jsonMock = jest.fn();
  const statusMock = jest.fn(() => ({ json: jsonMock }));
  const res = { status: statusMock, json: jsonMock } as unknown as Response;
  return { res, statusMock, jsonMock };
}

describe("SendGrid event webhook", () => {
  beforeEach(() => {
    resetDbState();
    jest.clearAllMocks();
    delete process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY;
  });

  it("inserts an event row with messageType from customArgs", async () => {
    const events = [
      {
        event: "open",
        timestamp: 1714000000,
        sg_event_id: "evt-open-1",
        sg_message_id: "msg-1",
        outbound_message_id: "om-123",
        message_type: "first_booking_email_2h",
        useragent: "TestAgent/1",
        ip: "1.2.3.4",
      },
    ];
    const { res, statusMock, jsonMock } = makeRes();
    await handleSendGridEvents(makeReq(events), res);

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({ ok: true, processed: 1, skipped: 0 });
    expect(dbState.insertCalls).toHaveLength(1);
    const inserted = dbState.insertCalls[0].values as Record<string, unknown>;
    expect(inserted.outboundMessageId).toBe("om-123");
    expect(inserted.messageType).toBe("first_booking_email_2h");
    expect(inserted.eventType).toBe("open");
    expect(inserted.sgEventId).toBe("evt-open-1");
    expect(inserted.userAgent).toBe("TestAgent/1");
    expect(inserted.ip).toBe("1.2.3.4");
    expect(inserted.occurredAt).toBe(new Date(1714000000 * 1000).toISOString());
  });

  it("captures the click URL on click events", async () => {
    const events = [
      {
        event: "click",
        timestamp: 1714000005,
        sg_event_id: "evt-click-1",
        sg_message_id: "msg-2",
        outbound_message_id: "om-200",
        message_type: "first_booking_email_48h",
        url: "https://gigaid.app/book/abc?x=1",
      },
    ];
    const { res } = makeRes();
    await handleSendGridEvents(makeReq(events), res);

    expect(dbState.insertCalls).toHaveLength(1);
    const inserted = dbState.insertCalls[0].values as Record<string, unknown>;
    expect(inserted.eventType).toBe("click");
    expect(inserted.url).toBe("https://gigaid.app/book/abc?x=1");
  });

  it("falls back to providerMessageId lookup when customArgs are missing", async () => {
    // First select call: lookup outbound_messages by providerMessageId
    dbState.selectQueue.push([
      { id: "om-fallback", type: "first_booking_email_2h", providerMessageId: "msg-fallback" },
    ]);
    const events = [
      {
        event: "bounce",
        timestamp: 1714000010,
        sg_event_id: "evt-bounce-1",
        sg_message_id: "msg-fallback.0", // SendGrid often suffixes per-recipient
      },
    ];
    const { res } = makeRes();
    await handleSendGridEvents(makeReq(events), res);

    expect(dbState.insertCalls).toHaveLength(1);
    const inserted = dbState.insertCalls[0].values as Record<string, unknown>;
    expect(inserted.outboundMessageId).toBe("om-fallback");
    expect(inserted.messageType).toBe("first_booking_email_2h");
    expect(inserted.eventType).toBe("bounce");
  });

  it("skips events without any way to resolve the outbound message", async () => {
    // No customArgs and no providerMessageId match.
    dbState.selectQueue.push([]); // fallback lookup returns nothing
    const events = [
      {
        event: "open",
        timestamp: 1714000020,
        sg_event_id: "evt-orphan-1",
        sg_message_id: "msg-unknown",
      },
    ];
    const { res, jsonMock } = makeRes();
    await handleSendGridEvents(makeReq(events), res);

    expect(dbState.insertCalls).toHaveLength(0);
    expect(jsonMock).toHaveBeenCalledWith({ ok: true, processed: 0, skipped: 1 });
  });

  it("skips events whose type is not tracked", async () => {
    const events = [
      {
        event: "completely_made_up_event",
        timestamp: 1714000030,
        sg_event_id: "evt-weird-1",
        sg_message_id: "msg-3",
        outbound_message_id: "om-300",
        message_type: "first_booking_email_2h",
      },
    ];
    const { res, jsonMock } = makeRes();
    await handleSendGridEvents(makeReq(events), res);

    expect(dbState.insertCalls).toHaveLength(0);
    expect(jsonMock).toHaveBeenCalledWith({ ok: true, processed: 0, skipped: 1 });
  });

  it("counts duplicate sg_event_id inserts as skipped (onConflictDoNothing)", async () => {
    // Simulate the insert path returning an empty .returning() — the unique
    // index suppressed the row.
    dbState.insertReturningQueue.push([]);
    const events = [
      {
        event: "open",
        timestamp: 1714000040,
        sg_event_id: "evt-dup-1",
        sg_message_id: "msg-4",
        outbound_message_id: "om-400",
        message_type: "first_booking_email_2h",
      },
    ];
    const { res, jsonMock } = makeRes();
    await handleSendGridEvents(makeReq(events), res);

    expect(dbState.insertCalls).toHaveLength(1);
    expect(jsonMock).toHaveBeenCalledWith({ ok: true, processed: 0, skipped: 1 });
  });

  it("rejects payloads when verification key is configured but signature is missing", async () => {
    process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE";
    const { res, statusMock, jsonMock } = makeRes();
    await handleSendGridEvents(makeReq([]), res);
    expect(statusMock).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith({ error: "invalid_signature" });
  });

  it("returns 200/processed:0 for empty event arrays", async () => {
    const { res, statusMock, jsonMock } = makeRes();
    await handleSendGridEvents(makeReq([]), res);
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({ ok: true, processed: 0 });
  });
});
