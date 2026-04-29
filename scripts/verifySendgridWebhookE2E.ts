/**
 * End-to-end verification harness for the SendGrid event-webhook pipeline
 * (Task #208). Drives the real handler against a real Postgres database with
 * synthetic-but-shape-accurate SendGrid event payloads.
 *
 * What this proves:
 *   - The handler in `server/sendgridWebhookRoutes.ts` correctly persists
 *     `delivered`, `open`, and `click` events to `outbound_message_events`,
 *     attributed to the originating `outbound_messages` row.
 *   - Both attribution paths work:
 *       (a) `customArgs.outbound_message_id` round-trips on send.
 *       (b) `sg_message_id` fallback via `outbound_messages.provider_message_id`
 *           when the webhook payload arrived stripped of customArgs.
 *   - The admin SQL behind `GET /api/admin/analytics/first-booking-emails`
 *     aggregates those events into the expected sent / opens / clicks counts.
 *
 * What this does NOT prove (still requires manual ops — see
 * `docs/runbooks/sendgrid-event-webhook-verification.md`):
 *   - That SendGrid's "Event Webhook" is enabled in production and pointed
 *     at our host.
 *   - That `SENDGRID_WEBHOOK_VERIFICATION_KEY` is set in production.
 *   - That a real send through SendGrid actually generates the events in
 *     the first place (vs synthetic payloads we POST ourselves).
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/verifySendgridWebhookE2E.ts
 *
 * The script is idempotent: it cleans up its test rows before and after so
 * it can be run repeatedly without polluting the database.
 */

import { db, pool } from "../server/db";
import {
  outboundMessages,
  outboundMessageEvents,
} from "../shared/schema";
import { handleSendGridEvents } from "../server/sendgridWebhookRoutes";
import { eq, sql, and, inArray } from "drizzle-orm";
import type { Request, Response } from "express";

const TEST_USER_ID = "e2e-verify-sg-webhook-user";
const TEST_MSG_ID_VIA_CUSTOMARGS = "e2e-verify-sg-webhook-msg-customargs";
const TEST_MSG_ID_VIA_FALLBACK = "e2e-verify-sg-webhook-msg-fallback";
const TEST_PROVIDER_MSG_ID = "e2e-verify-sg-fallback-provider-id";

interface TestStepResult {
  name: string;
  passed: boolean;
  detail: string;
}

const results: TestStepResult[] = [];

function record(name: string, passed: boolean, detail: string) {
  results.push({ name, passed, detail });
  const icon = passed ? "PASS" : "FAIL";
  console.log(`  [${icon}] ${name}${detail ? ` — ${detail}` : ""}`);
}

async function ensureSchemaPresent(): Promise<void> {
  // Verify the columns / tables this script depends on actually exist. Bail
  // with a helpful message if the dev DB hasn't been synced — this is the
  // exact blocker the production environment also has today.
  const colCheck = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'outbound_messages'
         AND column_name = 'provider_message_id'
     ) AS exists`,
  );
  if (!colCheck.rows[0]?.exists) {
    throw new Error(
      "outbound_messages.provider_message_id column missing. Run `npm run db:push --force` (development) or apply the schema sync (production) first.",
    );
  }
  const tableCheck = await pool.query<{ regclass: string | null }>(
    `SELECT to_regclass('public.outbound_message_events') AS regclass`,
  );
  if (!tableCheck.rows[0]?.regclass) {
    throw new Error(
      "outbound_message_events table missing. Run `npm run db:push --force` (development) or apply the schema sync (production) first.",
    );
  }
}

async function cleanup(): Promise<void> {
  await db
    .delete(outboundMessageEvents)
    .where(
      inArray(outboundMessageEvents.outboundMessageId, [
        TEST_MSG_ID_VIA_CUSTOMARGS,
        TEST_MSG_ID_VIA_FALLBACK,
      ]),
    );
  await db
    .delete(outboundMessages)
    .where(
      inArray(outboundMessages.id, [
        TEST_MSG_ID_VIA_CUSTOMARGS,
        TEST_MSG_ID_VIA_FALLBACK,
      ]),
    );
}

async function seed(): Promise<void> {
  const now = new Date().toISOString();
  // outbound_messages.user_id is a varchar with no FK constraint, so we don't
  // need to seed a real users row. (We did at one point, but the dev DB user
  // schema drifts faster than we can keep this script in sync.)
  await db.insert(outboundMessages).values([
    {
      id: TEST_MSG_ID_VIA_CUSTOMARGS,
      userId: TEST_USER_ID,
      channel: "email",
      toAddress: "e2e-verify@example.com",
      type: "first_booking_email_2h",
      status: "sent",
      scheduledFor: now,
      sentAt: now,
      createdAt: now,
      updatedAt: now,
      providerMessageId: null,
    },
    {
      id: TEST_MSG_ID_VIA_FALLBACK,
      userId: TEST_USER_ID,
      channel: "email",
      toAddress: "e2e-verify@example.com",
      type: "first_booking_email_48h",
      status: "sent",
      scheduledFor: now,
      sentAt: now,
      createdAt: now,
      updatedAt: now,
      providerMessageId: TEST_PROVIDER_MSG_ID,
    },
  ]);
}

function buildSendGridEvents() {
  const tsNow = Math.floor(Date.now() / 1000);
  // Path A: events carry our customArgs (the round-tripping happens via the
  // SendGrid Mail API send, so attribution is direct).
  const customArgsEvents = [
    {
      email: "e2e-verify@example.com",
      timestamp: tsNow,
      event: "delivered",
      sg_event_id: `e2e-customargs-delivered-${tsNow}`,
      sg_message_id: "fake-sg-msg-A.0",
      outbound_message_id: TEST_MSG_ID_VIA_CUSTOMARGS,
      message_type: "first_booking_email_2h",
      user_id: TEST_USER_ID,
    },
    {
      email: "e2e-verify@example.com",
      timestamp: tsNow + 5,
      event: "open",
      useragent: "Mozilla/5.0 (Verification)",
      ip: "203.0.113.10",
      sg_event_id: `e2e-customargs-open-${tsNow}`,
      sg_message_id: "fake-sg-msg-A.0",
      outbound_message_id: TEST_MSG_ID_VIA_CUSTOMARGS,
      message_type: "first_booking_email_2h",
      user_id: TEST_USER_ID,
    },
    {
      email: "e2e-verify@example.com",
      timestamp: tsNow + 10,
      event: "click",
      url: "https://example.test/booking-link",
      useragent: "Mozilla/5.0 (Verification)",
      ip: "203.0.113.10",
      sg_event_id: `e2e-customargs-click-${tsNow}`,
      sg_message_id: "fake-sg-msg-A.0",
      outbound_message_id: TEST_MSG_ID_VIA_CUSTOMARGS,
      message_type: "first_booking_email_2h",
      user_id: TEST_USER_ID,
    },
  ];
  // Path B: events arrive WITHOUT customArgs (some bounce/dropped events do
  // this in real SendGrid traffic). The handler must fall back to looking up
  // outbound_messages.provider_message_id by sg_message_id (after stripping
  // the .<recipient_index> suffix).
  const fallbackEvents = [
    {
      email: "e2e-verify@example.com",
      timestamp: tsNow + 20,
      event: "delivered",
      sg_event_id: `e2e-fallback-delivered-${tsNow}`,
      sg_message_id: `${TEST_PROVIDER_MSG_ID}.0`,
    },
    {
      email: "e2e-verify@example.com",
      timestamp: tsNow + 25,
      event: "open",
      sg_event_id: `e2e-fallback-open-${tsNow}`,
      sg_message_id: `${TEST_PROVIDER_MSG_ID}.0`,
    },
    {
      email: "e2e-verify@example.com",
      timestamp: tsNow + 30,
      event: "click",
      url: "https://example.test/fallback-link",
      sg_event_id: `e2e-fallback-click-${tsNow}`,
      sg_message_id: `${TEST_PROVIDER_MSG_ID}.0`,
    },
  ];
  return [...customArgsEvents, ...fallbackEvents];
}

async function postEventsThroughHandler(events: unknown[]): Promise<{
  status: number;
  body: unknown;
}> {
  const rawBody = Buffer.from(JSON.stringify(events));
  const req = {
    body: rawBody,
    rawBody,
    header: (_name: string) => undefined,
  } as unknown as Request;
  const captured: { status?: number; body?: unknown } = {};
  const res = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(body: unknown) {
      captured.body = body;
      return this;
    },
  } as unknown as Response;
  await handleSendGridEvents(req, res);
  return { status: captured.status ?? 0, body: captured.body };
}

async function fetchEventCounts(messageId: string) {
  const rows = await db
    .select({
      eventType: outboundMessageEvents.eventType,
      messageType: outboundMessageEvents.messageType,
    })
    .from(outboundMessageEvents)
    .where(eq(outboundMessageEvents.outboundMessageId, messageId));
  const byEvent: Record<string, number> = {};
  for (const r of rows) byEvent[r.eventType] = (byEvent[r.eventType] ?? 0) + 1;
  return { total: rows.length, byEvent, sample: rows[0] };
}

async function runAdminMetricsQuery(): Promise<unknown[]> {
  // Mirrors the SQL inside server/admin/analyticsRoutes.ts → the
  // `/first-booking-emails` handler. We run it directly here rather than
  // standing up the whole Express app + admin auth.
  const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const result = await db.execute(sql`
    WITH sent_touches AS (
      SELECT om.id AS message_id, om.user_id, om.type AS touch_type, om.sent_at
      FROM outbound_messages om
      WHERE om.channel = 'email'
        AND om.type IN ('first_booking_email_2h', 'first_booking_email_48h')
        AND om.status = 'sent'
        AND om.sent_at IS NOT NULL
        AND om.sent_at >= ${sinceIso}
        AND om.id IN (${sql.raw(
          [TEST_MSG_ID_VIA_CUSTOMARGS, TEST_MSG_ID_VIA_FALLBACK]
            .map((id) => `'${id}'`)
            .join(", "),
        )})
    ),
    event_counts AS (
      SELECT
        ome.outbound_message_id,
        ome.message_type,
        COUNT(*) FILTER (WHERE ome.event_type = 'open')      AS opens,
        COUNT(*) FILTER (WHERE ome.event_type = 'click')     AS clicks,
        COUNT(*) FILTER (WHERE ome.event_type = 'delivered') AS delivereds
      FROM outbound_message_events ome
      WHERE ome.message_type IN ('first_booking_email_2h', 'first_booking_email_48h')
      GROUP BY ome.outbound_message_id, ome.message_type
    )
    SELECT
      s.touch_type,
      COUNT(*)::int                                     AS sent,
      COALESCE(SUM(ec.delivereds), 0)::int              AS delivereds,
      COALESCE(SUM(ec.opens), 0)::int                   AS opens,
      COALESCE(SUM(ec.clicks), 0)::int                  AS clicks
    FROM sent_touches s
    LEFT JOIN event_counts ec ON ec.outbound_message_id = s.message_id
    GROUP BY s.touch_type
    ORDER BY s.touch_type
  `);
  return result.rows as unknown[];
}

async function main(): Promise<number> {
  console.log("== SendGrid event-webhook end-to-end verification (Task #208) ==");
  console.log(`DATABASE_URL host: ${(process.env.DATABASE_URL || "").split("@")[1]?.split("/")[0] || "?"}`);

  await ensureSchemaPresent();
  await cleanup();
  await seed();

  console.log("\n[1/4] Posting synthetic SendGrid events through the real handler...");
  const events = buildSendGridEvents();
  const handlerResponse = await postEventsThroughHandler(events);
  console.log(`  handler responded: status=${handlerResponse.status} body=${JSON.stringify(handlerResponse.body)}`);
  record(
    "Handler returned 200 OK",
    handlerResponse.status === 200,
    `status=${handlerResponse.status}`,
  );
  const okBody = handlerResponse.body as { ok?: boolean; processed?: number; skipped?: number } | undefined;
  record(
    "Handler reported processed=6 skipped=0",
    okBody?.ok === true && okBody?.processed === 6 && okBody?.skipped === 0,
    `processed=${okBody?.processed} skipped=${okBody?.skipped}`,
  );

  console.log("\n[2/4] Verifying customArgs-attributed events landed in DB...");
  const aCounts = await fetchEventCounts(TEST_MSG_ID_VIA_CUSTOMARGS);
  console.log(`  events for customArgs row: total=${aCounts.total} byEvent=${JSON.stringify(aCounts.byEvent)}`);
  record(
    "customArgs row has 1 delivered, 1 open, 1 click",
    aCounts.byEvent.delivered === 1 && aCounts.byEvent.open === 1 && aCounts.byEvent.click === 1,
    JSON.stringify(aCounts.byEvent),
  );
  record(
    "customArgs events tagged with message_type=first_booking_email_2h",
    aCounts.sample?.messageType === "first_booking_email_2h",
    `messageType=${aCounts.sample?.messageType}`,
  );

  console.log("\n[3/4] Verifying provider_message_id fallback events landed in DB...");
  const bCounts = await fetchEventCounts(TEST_MSG_ID_VIA_FALLBACK);
  console.log(`  events for fallback row: total=${bCounts.total} byEvent=${JSON.stringify(bCounts.byEvent)}`);
  record(
    "fallback row has 1 delivered, 1 open, 1 click",
    bCounts.byEvent.delivered === 1 && bCounts.byEvent.open === 1 && bCounts.byEvent.click === 1,
    JSON.stringify(bCounts.byEvent),
  );
  record(
    "fallback events tagged with message_type=first_booking_email_48h (backfilled from parent)",
    bCounts.sample?.messageType === "first_booking_email_48h",
    `messageType=${bCounts.sample?.messageType}`,
  );

  console.log("\n[4/4] Verifying admin metrics SQL aggregates the events...");
  const adminRows = (await runAdminMetricsQuery()) as Array<{
    touch_type: string;
    sent: number;
    delivereds: number;
    opens: number;
    clicks: number;
  }>;
  console.log(`  admin metrics rows: ${JSON.stringify(adminRows)}`);
  const t2h = adminRows.find((r) => r.touch_type === "first_booking_email_2h");
  const t48h = adminRows.find((r) => r.touch_type === "first_booking_email_48h");
  record(
    "first_booking_email_2h reports sent=1, delivered=1, opens=1, clicks=1",
    !!t2h && Number(t2h.sent) === 1 && Number(t2h.delivereds) === 1 && Number(t2h.opens) === 1 && Number(t2h.clicks) === 1,
    JSON.stringify(t2h),
  );
  record(
    "first_booking_email_48h reports sent=1, delivered=1, opens=1, clicks=1",
    !!t48h && Number(t48h.sent) === 1 && Number(t48h.delivereds) === 1 && Number(t48h.opens) === 1 && Number(t48h.clicks) === 1,
    JSON.stringify(t48h),
  );

  console.log("\n[idempotency] Re-posting the same events to confirm sg_event_id dedupe...");
  const replay = await postEventsThroughHandler(events);
  console.log(`  replay responded: status=${replay.status} body=${JSON.stringify(replay.body)}`);
  const replayBody = replay.body as { processed?: number; skipped?: number } | undefined;
  record(
    "Replay processed 0 new rows (all 6 deduped on sg_event_id)",
    replayBody?.processed === 0 && replayBody?.skipped === 6,
    `processed=${replayBody?.processed} skipped=${replayBody?.skipped}`,
  );

  await cleanup();

  const failures = results.filter((r) => !r.passed);
  console.log("\n== Summary ==");
  console.log(`  passed: ${results.length - failures.length} / ${results.length}`);
  if (failures.length > 0) {
    console.log("  FAILURES:");
    for (const f of failures) console.log(`    - ${f.name}: ${f.detail}`);
    return 1;
  }
  console.log("  All checks passed.");
  return 0;
}

main()
  .then((code) => {
    pool.end().finally(() => process.exit(code));
  })
  .catch((err) => {
    console.error("VERIFICATION ERROR:", err);
    pool.end().finally(() => process.exit(1));
  });
