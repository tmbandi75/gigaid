# Booking-link share conversion tracking

This runbook documents the PostHog events that power the
hero-vs-legacy booking-link conversion comparison and explains how the
funnel dashboard and the regression alert are wired up.

## Why we track this

The mobile redesign added two new entry points to the booking-link
share flow on the home screen:

- The **hero card** at the top of `TodaysGamePlanPage`
  (`button-hero-copy-send-booking-link`, `button-hero-copy-only`).
- The **empty-state CTA** that replaces the active-jobs list when a
  user has no jobs yet (`button-empty-state-send-booking-link`).

Both surfaces share code paths with the older "Your Booking Link"
card that still renders in other plan contexts (`MoneyPlanPage`,
`GamePlanDesktopView`, `MoneyPlanDesktopView`). Without per-surface
labels, every share/copy event from the plan section reports
`screen: "plan"`, so we cannot tell whether the hero card actually
lifts share rate vs. the legacy card.

## Event shape

All four events flow through `trackEvent(...)` in
`client/src/components/PostHogProvider.tsx` and are emitted from
`useBookingLinkShareAction` (`client/src/lib/useBookingLinkShareAction.ts`).

| Event                          | When it fires                                                                 | Properties                                            |
| ------------------------------ | ----------------------------------------------------------------------------- | ----------------------------------------------------- |
| `booking_link_share_opened`    | User taps a Share/Send CTA — fires on tap, before the share sheet resolves.   | `screen`                                              |
| `booking_link_shared`          | OS share sheet returned success, OR copy fallback succeeded when share is N/A. | `screen`, `method` (`"share"` \| `"copy"`), `target` (when method=share) |
| `booking_link_copied`          | User taps a Copy CTA and the link landed on the clipboard.                    | `screen`                                              |
| `booking_link_share_tap`       | Server-mirrored counterpart of `booking_link_share_opened`.                   | `screen` (server-normalized), `platform`              |

### `screen` values

`screen` is the **per-surface** label, derived from the variant +
context combo inside `BookingLinkShare`:

| Surface                                                      | `screen` value  |
| ------------------------------------------------------------ | --------------- |
| Mobile home-screen hero card (`variant="hero"`)              | `plan_hero`     |
| Mobile home-screen empty-state CTA                           | `plan_empty`    |
| Mobile/tablet first-action overlay (zero shares today, once per session) | `plan_overlay`  |
| Mobile/tablet shares-away banner above the sticky CTA (under 3 shares today, dismissable per session) | `plan_banner`   |
| Mobile/tablet "send a follow-up" card between hero and Up Next (>=2 shares today, dismissable per session) | `plan_followup` |
| Legacy "Your Booking Link" card on plan surfaces (`variant="primary"` + `context="plan"`) — desktop game/money plan + `MoneyPlanPage` | `plan_legacy`   |
| Leads page card (`variant="inline"` + `context="leads"`)     | `leads`         |
| Jobs page card (`variant="compact"` + `context="jobs"`)      | `jobs`          |
| Bookings page card (`variant="inline"` + `context="bookings"`) | `bookings`     |
| NBA card share action                                        | `nba`           |

Older clients (pre-Apr 2026) emitted `screen: "plan"` for both the
hero and the legacy card, so historical PostHog data lumps the two
surfaces together. The split takes effect from the release that
included this change forward.

### Server-side counterpart

The server `/api/track/booking-link-*` endpoints record the same taps
against `bookingLinkShareEvents` for the in-app admin funnel. They
receive **`context`** (one of `plan`, `leads`, `jobs`, `bookings`),
not the per-surface `screen`, on purpose: the admin report keeps
context-level granularity and the per-surface breakdown lives in
PostHog. If you need the per-surface server breakdown later, extend
`KNOWN_BOOKING_LINK_SCREENS` in `server/routes.ts` and update the
client to forward `screen` instead of `context` to
`recordShareTap` / `recordCopy` in
`client/src/lib/bookingLinkAnalytics.ts`.

## PostHog funnel dashboard

The dashboard lives at:
**Dashboards → "Booking Link Share — Surface Conversion"** in PostHog.

It contains one funnel insight per surface, each with two steps and
a 14-day rolling window:

1. `booking_link_share_opened` where `screen` equals the surface label.
2. `booking_link_shared` where `screen` equals the surface label.

Surfaces tracked: `plan_hero`, `plan_empty`, `plan_overlay`,
`plan_banner`, `plan_followup`, `plan_legacy`, `leads`, `jobs`,
`bookings`. The dashboard uses the previous 7-day window as the
comparison baseline ("Compare to" → "Previous period") so the
release week sits next to the prior week for an at-a-glance lift
read. `plan_overlay`, `plan_banner`, and `plan_followup` are the
conversion-funnel surfaces added with the first-action overlay,
shares-away banner, and follow-up card respectively — pin all
three insights next to `plan_hero` so the home-screen funnel
reads top-to-bottom. `plan_followup` is also the only surface
that pre-fills a non-default share message via `messageOverride`
("Just checking in — let me know if you need help. Here's my
booking link again: <link>"); the editable textarea inside the
share sheet still lets the pro tweak it before sending.

The dashboard also pins one **outcome** funnel directly under the
`plan_followup` tile — "Follow-up card — shown vs shared vs
dismissed" — that splits **shown → auto_hidden** vs.
**shown → dismissed** for the follow-up nudge specifically. That
funnel is documented in
`docs/runbooks/follow-up-card-conversion.md`.

### Recreating the dashboard

If the dashboard is missing (e.g. PostHog reset, new workspace):

1. PostHog → **+ New dashboard**, name it
   `Booking Link Share — Surface Conversion`.
2. For each surface label, **+ Add insight → Funnel** with:
   - Step 1: event `booking_link_share_opened`, filter
     `screen = <surface>`.
   - Step 2: event `booking_link_shared`, filter `screen = <surface>`.
   - Date range: **Last 14 days**, **Compare to previous period**.
   - Conversion window: **1 hour** (matches the existing share-sheet
     timing).
3. Pin one insight per surface to the dashboard. The full surface
   list lives in the table under "`screen` values" above — currently
   nine: `plan_hero`, `plan_empty`, `plan_overlay`, `plan_banner`,
   `plan_followup`, `plan_legacy`, `leads`, `jobs`, `bookings`. The
   `nba` surface is intentionally excluded from this dashboard
   because it isn't part of the booking-link share comparison. Add a
   markdown tile to the dashboard that links back to this runbook.

### Live links (fill in after first creation)

> **TODO (operator):** replace the placeholders below with the real
> URLs/screenshots once the dashboard and alert exist. Until then this
> section is the only gap between the runbook and reality — please
> close it the same day you stand the dashboard up.

- Dashboard URL: `<TODO: paste PostHog dashboard URL here>`
- `Hero share completion — WoW` insight URL:
  `<TODO: paste PostHog insight URL here>`
- Alert/subscription URL:
  `<TODO: paste PostHog subscription URL here>`
- Screenshots (commit under `docs/runbooks/screenshots/booking-link-conversion/`):
  - `dashboard-overview.png` — full dashboard with all nine funnels
    visible, "Compare to previous period" toggled on.
  - `hero-funnel-detail.png` — `plan_hero` funnel insight expanded so
    the absolute counts are legible.
  - `wow-alert-config.png` — the alert configuration screen showing
    the 20% drop threshold, weekly cadence, and the
    `#growth-alerts` + `growth@gigaid.test` recipients.

## Conversion regression alert

PostHog → **Insights → "Hero share completion — WoW"** powers the
alert. It is a Trends insight on `booking_link_shared` filtered by
`screen = plan_hero`, formula `A / B` where `A` is the rolling 7-day
completion count and `B` is the rolling 7-day count from the prior
week (use the **Compare to previous period** option).

The alert (Subscriptions → Alerts on that insight) is configured to
trigger when the value **drops more than 20% week-over-week**. It
posts to the `#growth-alerts` Slack channel and emails
`growth@gigaid.test`. Owner: growth team.

### Recreating the alert

1. Open the `Hero share completion — WoW` insight (or recreate as
   above).
2. Click **Subscribe → New alert**.
3. **Condition:** value decreases by more than **20%** vs. previous
   period.
4. **Cadence:** weekly.
5. **Notify:** `#growth-alerts` Slack channel + `growth@gigaid.test`.
6. Save. Verify the test notification fires.

## Operator setup playbook (PostHog API)

Use this section if you'd rather create everything via the PostHog
REST API instead of clicking through the UI — faster and reproducible
across workspaces (staging, prod, recovery from a wipe).

### Prerequisites

- A **Personal API key** with `insight:write`, `dashboard:write`, and
  `subscription:write` scopes (PostHog → Account settings → Personal
  API keys → "Create personal API key").
- The numeric **project ID** (PostHog → Project settings → top of the
  page; it is the integer in URLs like `/project/12345/dashboard`).
- The PostHog host (`https://app.posthog.com` for US cloud,
  `https://eu.posthog.com` for EU, or your self-hosted base URL).
- For Slack: the `#growth-alerts` channel must already be authorized
  in PostHog → **Project settings → Integrations → Slack** (one-time
  OAuth). Grab the resulting Slack integration's numeric `id` from
  PostHog → **Project settings → Integrations** (the "Edit" link's
  URL contains it) — call this `SLACK_INTEGRATION_ID`.

Export these once at the top of your shell so the snippets below
don't repeat them:

```bash
export POSTHOG_HOST="https://app.posthog.com"
export POSTHOG_PROJECT_ID="<numeric project id>"
export POSTHOG_API_KEY="<personal api key starting with phx_>"
export SLACK_INTEGRATION_ID="<numeric slack integration id>"
```

### 1. Create the dashboard

```bash
curl -sS -X POST \
  "$POSTHOG_HOST/api/projects/$POSTHOG_PROJECT_ID/dashboards/" \
  -H "Authorization: Bearer $POSTHOG_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Booking Link Share — Surface Conversion",
    "description": "Per-surface share-open → share-completed funnels. See docs/runbooks/booking-link-conversion.md.",
    "pinned": true
  }'
```

Capture the returned `id` as `DASHBOARD_ID` — the next step pins
insights onto it:

```bash
export DASHBOARD_ID="<id from previous response>"
```

### 2. Create one funnel insight per surface

The funnel insight payload is identical for every surface; only the
`screen` filter value and the insight name change. Loop over the nine
surfaces:

```bash
for SURFACE in plan_hero plan_empty plan_overlay plan_banner plan_followup plan_legacy leads jobs bookings; do
  curl -sS -X POST \
    "$POSTHOG_HOST/api/projects/$POSTHOG_PROJECT_ID/insights/" \
    -H "Authorization: Bearer $POSTHOG_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$(cat <<JSON
{
  "name": "${SURFACE} — share open → completed",
  "description": "Funnel for booking-link share on the ${SURFACE} surface. Step 1 = booking_link_share_opened, Step 2 = booking_link_shared, both filtered by screen=${SURFACE}. 14d window, compared to previous 7d.",
  "dashboards": [${DASHBOARD_ID}],
  "filters": {
    "insight": "FUNNELS",
    "events": [
      {
        "id": "booking_link_share_opened",
        "name": "booking_link_share_opened",
        "type": "events",
        "order": 0,
        "properties": [
          {"key": "screen", "value": "${SURFACE}", "operator": "exact", "type": "event"}
        ]
      },
      {
        "id": "booking_link_shared",
        "name": "booking_link_shared",
        "type": "events",
        "order": 1,
        "properties": [
          {"key": "screen", "value": "${SURFACE}", "operator": "exact", "type": "event"}
        ]
      }
    ],
    "date_from": "-14d",
    "compare": true,
    "funnel_window_interval": 1,
    "funnel_window_interval_unit": "hour",
    "funnel_viz_type": "steps",
    "layout": "horizontal"
  }
}
JSON
)"
done
```

After running, confirm in the UI that all nine insights are pinned to
the dashboard, ordered with the home-screen surfaces first
(`plan_hero`, `plan_empty`, `plan_overlay`, `plan_banner`,
`plan_followup`), then the legacy + per-context surfaces
(`plan_legacy`, `leads`, `jobs`, `bookings`).

### 3. Create the WoW Trends insight

```bash
WOW_INSIGHT=$(curl -sS -X POST \
  "$POSTHOG_HOST/api/projects/$POSTHOG_PROJECT_ID/insights/" \
  -H "Authorization: Bearer $POSTHOG_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Hero share completion — WoW",
    "description": "Powers the Slack/email alert: rolling 7d count of booking_link_shared on the plan_hero surface, compared to the previous 7d. Alert trips when the value drops more than 20% WoW.",
    "filters": {
      "insight": "TRENDS",
      "events": [
        {
          "id": "booking_link_shared",
          "name": "booking_link_shared",
          "type": "events",
          "order": 0,
          "math": "total",
          "properties": [
            {"key": "screen", "value": "plan_hero", "operator": "exact", "type": "event"}
          ]
        }
      ],
      "date_from": "-7d",
      "compare": true,
      "interval": "day",
      "display": "ActionsLineGraph"
    }
  }')
export WOW_INSIGHT_ID=$(echo "$WOW_INSIGHT" | jq -r '.id')
echo "WoW insight ID: $WOW_INSIGHT_ID"
```

### 4. Create the Slack + email subscription / alert

PostHog's UI calls this an "alert"; the API resource is
`subscriptions/`. The payload below wires both targets in one shot.

```bash
curl -sS -X POST \
  "$POSTHOG_HOST/api/projects/$POSTHOG_PROJECT_ID/subscriptions/" \
  -H "Authorization: Bearer $POSTHOG_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"insight\": ${WOW_INSIGHT_ID},
    \"title\": \"Hero share completion — WoW\",
    \"target_type\": \"slack\",
    \"target_value\": \"${SLACK_INTEGRATION_ID}:#growth-alerts\",
    \"frequency\": \"weekly\",
    \"interval\": 1,
    \"byweekday\": [\"monday\"],
    \"start_date\": \"2026-05-04T15:00:00Z\"
  }"

curl -sS -X POST \
  "$POSTHOG_HOST/api/projects/$POSTHOG_PROJECT_ID/subscriptions/" \
  -H "Authorization: Bearer $POSTHOG_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"insight\": ${WOW_INSIGHT_ID},
    \"title\": \"Hero share completion — WoW (email)\",
    \"target_type\": \"email\",
    \"target_value\": \"growth@gigaid.test\",
    \"frequency\": \"weekly\",
    \"interval\": 1,
    \"byweekday\": [\"monday\"],
    \"start_date\": \"2026-05-04T15:00:00Z\"
  }"
```

Then in the UI open the WoW insight → **Alerts** tab → **New alert**
and configure the *threshold* portion (the API does not yet expose
this on the free tier):

- **Condition:** "Value changes" → "decreases by" → **20%** vs.
  previous period.
- **Calculation window:** 7 days.
- **Notification channel:** the two subscriptions you just created
  will appear as available targets — tick both.
- **Save.**

### 5. Verify

```bash
# Smoke-test the alert by sending yourself a test notification.
curl -sS -X POST \
  "$POSTHOG_HOST/api/projects/$POSTHOG_PROJECT_ID/subscriptions/<subscription_id>/test/" \
  -H "Authorization: Bearer $POSTHOG_API_KEY"
```

Expected: a Slack message in `#growth-alerts` and an email to
`growth@gigaid.test` within ~1 minute, both linking back to the WoW
insight.

Once everything is live:

1. Paste the dashboard, insight, and subscription URLs into the
   **Live links** section above.
2. Capture the three screenshots listed there and commit them to
   `docs/runbooks/screenshots/booking-link-conversion/`.
3. Post the dashboard link in `#growth-alerts` so the team knows
   where to find it.

## Local verification

1. Sign in as a worker with at least one service, so the hero card
   renders.
2. Open Chrome devtools → **Application → Local storage** → confirm
   PostHog is enabled (`analytics_consent === "granted"` and
   `posthog` instance is present on `window`).
3. Tap "Copy & Send My Booking Link" — confirm a
   `booking_link_share_opened` event with `screen: "plan_hero"` in
   the PostHog "Activity" tab. Completing the share sheet should
   add `booking_link_shared` with the same `screen`.
4. Repeat for the empty-state CTA (delete or hide all jobs first to
   reach it) — expect `screen: "plan_empty"`.
5. Open `MoneyPlanPage` (which still mounts the legacy primary card)
   and confirm the share/copy events report `screen: "plan_legacy"`.

The Playwright spec `e2e/booking-link-share.spec.ts` covers the
primary/legacy label automatically; hero/empty-state labels are
covered manually until a dedicated harness lands.

## Related files

- `client/src/components/booking-link/BookingLinkShare.tsx` — variant
  → `screen` mapping.
- `client/src/lib/useBookingLinkShareAction.ts` — the
  `BookingLinkShareScreen` type and the PostHog/server emission.
- `client/src/components/PostHogProvider.tsx` — `trackEvent` helper.
- `client/src/lib/bookingLinkAnalytics.ts` — server-side recording
  fetcher (uses `context`, not the per-surface `screen`).
- `server/routes.ts` — `/api/track/booking-link-*` endpoints and
  `normalizeBookingLinkScreen`.
