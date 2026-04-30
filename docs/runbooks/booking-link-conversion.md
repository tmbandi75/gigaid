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
`plan_banner`, `plan_legacy`, `leads`, `jobs`, `bookings`. The
dashboard uses the previous 7-day window as the comparison baseline
("Compare to" → "Previous period") so the release week sits next to
the prior week for an at-a-glance lift read. `plan_overlay` and
`plan_banner` are the conversion-funnel surfaces added with the
first-action overlay / shares-away banner — pin both insights next
to `plan_hero` so the home-screen funnel reads top-to-bottom.

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
3. Pin all six insights to the dashboard. Add a markdown tile that
   links back to this runbook.

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
