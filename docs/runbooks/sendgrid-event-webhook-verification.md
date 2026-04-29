# Runbook: Verify the SendGrid Event Webhook end-to-end

## TL;DR

Unit tests cover `handleSendGridEvents` against a mocked DB and a mocked
SendGrid response. They prove the parser/attribution logic works in
isolation. The end-to-end harness `scripts/verifySendgridWebhookE2E.ts`
additionally proves the handler + admin metrics SQL work end-to-end against
a real Postgres database (not mocks) — see
`docs/runbooks/evidence/sendgrid-webhook-e2e-2026-04-29.log` for a passing
run on the dev DB.

What none of those automated checks prove (and what this runbook covers):

1. SendGrid's "Event Webhook" is enabled and pointed at our production host.
2. `SENDGRID_WEBHOOK_VERIFICATION_KEY` is set in production (or that we
   intentionally left signature verification off).
3. A real first-booking email actually generates `delivered`, `open`, and
   `click` events that arrive at `POST /api/webhooks/sendgrid/events` and get
   attributed to the originating `outbound_messages` row via either the
   `outbound_message_id` customArg or the `provider_message_id` (a.k.a.
   `sg_message_id`) fallback.
4. The `/api/admin/analytics/first-booking-emails` endpoint reflects those
   events.

This runbook walks an operator through that real-send verification. It is a
manual checklist by design — there is no production-inbox automation we can
run from CI.

## 0. Prerequisites (one-time, do these first)

These prereqs were checked from the dev environment on 2026-04-29 and were
**all unmet at the time of writing**. Re-check before proceeding.

- [ ] Latest webhook code is deployed to production. (Verify by hitting
      `GET https://<prod-host>/api/webhooks/sendgrid/events` — it should
      return `404 Not Found` for GET, not 404 for the path itself. A 404
      response body containing the route means the route is registered.)
- [ ] Production database has the `outbound_message_events` table and the
      `outbound_messages.provider_message_id` column. Run the pending
      schema sync (`npm run db:push --force`) against production if not.
      Quick check (read-only against prod):
      ```sql
      SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name='outbound_messages'
        AND column_name='provider_message_id';
      SELECT to_regclass('public.outbound_message_events');
      ```
      Both must return a row / a non-null value.
- [ ] `SENDGRID_WEBHOOK_VERIFICATION_KEY` is decided. Either:
      - **Option A (recommended):** copy the public key from SendGrid →
        Settings → Mail Settings → Event Webhook → "Signed Event Webhook
        Requests" and store it as a production secret named
        `SENDGRID_WEBHOOK_VERIFICATION_KEY`, **or**
      - **Option B:** intentionally leave it unset for now and file a
        follow-up to enable signature verification later. With no key set,
        `verifySendGridSignature()` returns `true` for every payload — the
        endpoint accepts anything that looks like JSON.

## 1. Configure the SendGrid Event Webhook

In the production SendGrid account UI:

1. **Settings → Mail Settings → Event Webhook**.
2. Set **HTTP POST URL** to
   `https://<prod-host>/api/webhooks/sendgrid/events`.
3. Tick **all** event types: `delivered`, `open`, `click`, `bounce`,
   `dropped`, `spamreport`, `unsubscribe`, `deferred`, `processed`, `group_unsubscribe`,
   `group_resubscribe`. (Our handler silently ignores any event type that
   isn't in `outboundMessageEventTypes` from `shared/schema.ts`, but enabling
   them all means we don't miss future additions.)
4. If you chose Option A above, toggle **Signed Event Webhook Requests** ON
   and copy the public key into the
   `SENDGRID_WEBHOOK_VERIFICATION_KEY` production secret (already done in
   prereqs).
5. Click **Test Your Integration** and confirm SendGrid reports `2xx`. The
   server logs should show
   `[SendGridWebhook] ... processed: 0` (the test payload's
   `single_send_id` events are not tracked).

## 2. Trigger a real first-booking email

The first-booking email send branch lives in
`server/postJobMomentum.ts` (lines ~1070-1110). It only fires for users with
no jobs yet whose `first_booking_email_2h`/`_48h` rows are picked up by the
scheduler.

The simplest reproducible way to trigger one:

1. Pick (or create) a test account whose email address you control. Make
   sure it has **zero** completed jobs (otherwise the first-booking
   scheduler skips it).
2. From an admin shell against production, insert / advance the row so the
   scheduler picks it up immediately. The exact admin endpoint is up to the
   operator — the important thing is that an `outbound_messages` row with
   `type='first_booking_email_2h'`, `channel='email'`,
   `status='scheduled'`, and `to_address=<your test inbox>` exists with
   `scheduled_for <= now()`.
3. Watch the Replit deployment logs. You should see
   `Email sent successfully to <masked>` from `server/sendgrid.ts`.
4. Note the `outbound_message_id` (the row's primary key) — you'll cross-
   reference it in step 4.

## 3. Open the email and click a link

1. Open the email in your real inbox. SendGrid open tracking fires when
   the embedded 1×1 pixel loads — most modern clients (Gmail web, Apple
   Mail with image loading on) do this automatically.
2. Click the booking link in the email body. SendGrid click tracking
   rewrites every `<a href>` to a tracking URL, so any click on a real
   anchor counts.
3. Wait ~30-60 seconds. SendGrid batches event pushes.

## 4. Confirm the events landed in `outbound_message_events`

Run these read-only queries against production. Replace
`<your_outbound_message_id>` with the row id from step 2.4.

```sql
-- Did the row pick up a provider_message_id from the SendGrid send?
SELECT id, type, status, sent_at, provider_message_id
FROM outbound_messages
WHERE id = '<your_outbound_message_id>';

-- All events attributed to this row, oldest first.
SELECT event_type, occurred_at, sg_message_id, sg_event_id, url
FROM outbound_message_events
WHERE outbound_message_id = '<your_outbound_message_id>'
ORDER BY occurred_at ASC;
```

You expect, in order:

- `processed` (immediately after send), `delivered` (within seconds).
- `open` after you opened the inbox.
- `click` after you clicked a link.

Each row's `sg_message_id` should match the `provider_message_id` on the
parent row (modulo the `.<recipient_index>` suffix SendGrid appends —
`sendgridWebhookRoutes.ts` strips that before lookup).

If the `outbound_message_id` column on the events is populated even when
events arrived without our `customArgs` (e.g. a `bounce` payload), that
proves the `provider_message_id` fallback is working.

## 5. Confirm the admin metrics endpoint reflects the send

Hit the admin metrics endpoint (admin auth required):

```
GET https://<prod-host>/api/admin/analytics/first-booking-emails?days=1
```

In the JSON response, the row with `touchType: "first_booking_email_2h"`
should show:

```json
{
  "touchType": "first_booking_email_2h",
  "sent": 1,
  "delivered": 1,
  "opens": 1,
  "clicks": 1,
  "uniqueOpens": 1,
  "uniqueClicks": 1,
  "openRate": 100,
  "clickRate": 100,
  "...": "..."
}
```

(`sent` may be higher than 1 if other test sends ran in the same window;
the important thing is that opens/clicks ≥ 1 for the touch type you sent.)

## 6. If something doesn't land

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `delivered` event present but `open`/`click` missing | Inbox blocking remote images / link clicked through inbox preview that doesn't follow the SendGrid redirect | Open in a real client with images on, click an actual link in the body |
| Event arrives at the endpoint but `outbound_message_events` stays empty | `customArgs` stripped + no matching `provider_message_id` row | Confirm the send branch in `postJobMomentum.ts` actually persisted `provider_message_id` after the send. The DB update happens only when SendGrid returns a non-null `X-Message-Id` header. |
| All POSTs returning `401 invalid_signature` | `SENDGRID_WEBHOOK_VERIFICATION_KEY` is set but does not match the key shown in the SendGrid UI | Re-copy the key, taking care to preserve the full base64 SPKI payload. The handler reformats it into PEM at runtime. |
| All POSTs returning `200 {ok:false}` | Unhandled exception in `handleSendGridEvents` | Check Replit deployment logs for `[SendGridWebhook] Unhandled error processing events:` |
| SendGrid UI shows webhook is firing but our endpoint never sees a request | URL/path typo in SendGrid config; HTTPS cert issue on the host | Recheck the URL exactly matches `/api/webhooks/sendgrid/events`. |

## 7. Mark verification complete

When all of section 4 and 5 pass for a real send, this verification is
done. Record the `outbound_message_id` you used and the date in your ops
log so future reviewers can re-check the historical row if anything
regresses.
