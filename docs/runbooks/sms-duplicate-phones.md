# Runbook: STOP-blocked accounts with duplicate `phone_e164`

## TL;DR

If two or more `users` rows share the same `phone_e164`, the inbound STOP
webhook (`server/twilioStopOptOut.ts` + `server/optOutResolver.ts`) refuses
to opt anyone out from that number. That is the safe behavior — we don't
want to silently unsubscribe the wrong account — but it also means
those users **cannot opt out by texting STOP** until support cleans the
collision. This runbook covers how to find and resolve them.

## Symptoms

- A user reports they texted STOP but still receives GigAid SMS.
- Server logs contain
  `[Twilio STOP] Ambiguous: N+ users share phone +15***1234; refusing opt-out, manual review required`.

## 1. Find the collisions

```
GET /api/admin/sms/duplicate-phones
```

(Admin auth required — same gating as the rest of `/api/admin/sms/*`.)

Response shape:

```json
{
  "groupCount": 3,
  "affectedUserCount": 7,
  "groups": [
    {
      "phoneE164": "+15551234567",
      "userCount": 2,
      "users": [
        { "id": "user-A", "email": "...", "username": "...", "name": "...",
          "lastActiveAt": "2026-04-15T18:22:00.000Z" },
        { "id": "user-B", "email": "...", "username": "...", "name": "...",
          "lastActiveAt": "2024-09-02T00:11:00.000Z" }
      ]
    }
  ]
}
```

Within each group, users are ordered by `lastActiveAt` DESC (nulls last)
so the most-recently-active account — typically the "real" owner — is
always first.

## 2. Decide which account keeps the phone

Ask: which account does the phone number actually belong to today? Use
`lastActiveAt`, recent jobs/invoices, the user's own report, etc. If you
can't tell, escalate before touching anything — clearing the wrong row
will break STOP for the wrong person.

## 3. Clear the wrong account's phone

For every user in the group **except** the rightful owner:

```
POST /api/admin/sms/users/:userId/clear-phone
Content-Type: application/json

{ "reason": "Duplicate phone +15551234567 — keeping <owner-user-id>; ticket #1234" }
```

A `reason` is required. The endpoint:

- Sets that user's `phone_e164` to `NULL`.
- Writes an `admin_action_audit` row with `actionKey = "sms_clear_phone_e164"`
  and the previous value in `payload`.
- Returns `{ success, userId, previousPhoneE164 }`.

If two accounts genuinely belong to the same person, link/merge them
through the existing user-merge tooling instead of clearing — that's out
of scope for this runbook.

## 4. Verify

1. Re-call `GET /api/admin/sms/duplicate-phones` — the phone should no
   longer appear (or the `userCount` should be 1, which also drops it
   from the response).
2. Have the affected user retry `STOP` (or simulate it: post a Twilio
   inbound webhook from that number with body `STOP`). The server log
   should now show `[Twilio STOP] Opted out user <userId> via +15***1234`
   and `users.smsOptOut = true` for the right account.

## Why we don't auto-merge

Auto-picking "the most recent user" feels tempting, but a duplicate phone
usually means data corruption (re-signup with the same number, manual
import, etc.) and the correct fix differs case by case. Forcing a human
decision keeps this safe.
