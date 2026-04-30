# Follow-up card conversion tracking

This runbook documents the PostHog events that power the follow-up
card conversion funnel on `TodaysGamePlanPage` and explains how the
funnel insight and dashboard tile are wired up.

It is the sibling of `docs/runbooks/booking-link-conversion.md`, but
for the follow-up nudge specifically — different events, different
funnel, same overall pattern.

## Why we track this

Once a pro has shared their booking link **2+ times today** the home
screen renders a small follow-up card between the hero and Up Next:

> Increase your chances — send a follow-up
> A second nudge to people you've already messaged often makes the
> difference.

The card is dismissable per session via either:

- The × button (the pro opted out for the rest of the session), **or**
- A successful share through its share sheet (the pro followed
  through; the card auto-hides so we don't keep nagging them).

Without dedicated telemetry we cannot tell those two outcomes apart
from the existing `booking_link_shared` stream — every share at this
surface already reports `screen: "plan_followup"`, but we have no
denominator for "how many pros saw the card in the first place" and
no signal for "saw the card and tapped × instead of sharing".

The events below close that gap so growth can chart **shown → shared**
vs. **shown → dismissed** and decide whether the nudge is actually
worth the screen real estate.

## Event shape

All three events flow through `trackEvent(...)` in
`client/src/components/PostHogProvider.tsx`. The `_shown` and
`_auto_hidden` events fire from `client/src/pages/TodaysGamePlanPage.tsx`;
`_dismissed` fires from `client/src/components/booking-link/FollowUpCard.tsx`.

| Event                          | When it fires                                                                                                                                                    | Properties                                                  |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `follow_up_card_shown`         | One-shot per browser session, the first time the card is eligible to render (mobile/tablet + booking link + `todayShareCount >= 2` + not already dismissed/sent). | `todayShareCount`                                           |
| `follow_up_card_auto_hidden`   | The pro opens the card's share sheet and the share resolves successfully — the card hides itself for the rest of the session.                                    | `todayShareCount` (pre-share snapshot), `method` (`"share"` \| `"copy"`) |
| `follow_up_card_dismissed`     | The pro taps the × on the card.                                                                                                                                  | `todayShareCount` (or `null` if the prop was not forwarded) |

`todayShareCount` is captured at the moment the card was shown / the
event fired — i.e. the **pre-share** count for `_auto_hidden`. That
keeps every cohort bucket (`2`, `3`, `4`, `5`) representing the
audience that actually saw the card, not the post-share count.

Note: the `booking_link_shared` event with `screen: "plan_followup"`
is the same event the rest of the surface-conversion funnels use — it
fires from `BookingLinkShareSheet` via
`useBookingLinkShareAction` and is the canonical "share confirmation"
for this surface. `follow_up_card_auto_hidden` is intentionally a
**second**, narrower event so the funnel can be built without a
share-method join, but the two should always agree 1:1 on this
surface (the auto-hide handler runs from the same `onShared` callback
that emits `booking_link_shared`).

## PostHog funnel + dashboard tile

The insight lives at:
**Insights → "Follow-up card — shown vs shared vs dismissed"** and is
pinned to:
**Dashboards → "Booking Link Share — Surface Conversion"**, directly
under the existing `plan_followup` surface funnel so the home-screen
funnel reads top-to-bottom (hero → empty → overlay → banner →
follow-up → follow-up outcome).

The insight is a **two-funnel side-by-side comparison** with a
14-day rolling window and `todayShareCount` as the breakdown:

- **Funnel A — Shown → Shared (auto-hidden)**
  1. `follow_up_card_shown`
  2. `follow_up_card_auto_hidden`

- **Funnel B — Shown → Dismissed**
  1. `follow_up_card_shown`
  2. `follow_up_card_dismissed`

Both funnels are broken down by `todayShareCount` (cohorts `2`, `3`,
`4`, `5`) so growth can see where the nudge actually lifts behavior
vs. where pros just dismiss it.

We deliberately don't union the two outcome events into a single
"either" step — the goal is to read the two completion rates against
the **same** denominator (`follow_up_card_shown`), which is what the
side-by-side layout gives us.

### Cross-check with `booking_link_shared`

Funnel A's completion count should match the count of
`booking_link_shared` events with `screen = "plan_followup"` over the
same window. If they diverge by more than ~5%, something is wrong
with the `onShared` wiring — open the runbook section "Local
verification" below and re-run.

### Recreating the insight + dashboard tile

If the insight is missing (e.g. PostHog reset, new workspace):

1. PostHog → **+ New insight → Funnel**, name it
   `Follow-up card — shown vs shared vs dismissed`.
2. Add the **shown → auto_hidden** funnel:
   - Step 1: event `follow_up_card_shown`.
   - Step 2: event `follow_up_card_auto_hidden`.
3. Click **+ Add funnel** (graph series) and add the
   **shown → dismissed** funnel as a sibling series:
   - Step 1: event `follow_up_card_shown`.
   - Step 2: event `follow_up_card_dismissed`.
4. **Breakdown:** event property `todayShareCount`. Limit to values
   `2`, `3`, `4`, `5`.
5. **Date range:** Last 14 days. **Compare to:** previous period.
6. **Conversion window:** 1 hour (matches the share-sheet timing
   used by the surface-conversion funnels).
7. Save. Pin to the
   **Booking Link Share — Surface Conversion** dashboard, directly
   under the `plan_followup` tile.
8. Edit the dashboard's markdown header tile to add a link to this
   runbook (`docs/runbooks/follow-up-card-conversion.md`).

## Local verification

1. Sign in as a worker with a booking link configured.
2. Open Chrome devtools → **Application → Local storage** → confirm
   PostHog is enabled (`analytics_consent === "granted"` and the
   `posthog` instance is on `window`).
3. Manually bump `todayShareCount` to `>= 2` (share twice through
   any surface, or seed via the dev tools / DB) and reload the home
   screen on a mobile/tablet viewport. Expect a single
   `follow_up_card_shown` event with the matching `todayShareCount`
   in the PostHog "Activity" tab. Reloading again should **not**
   re-fire it (sessionStorage guard
   `gigaid:booking-followup-shown-tracked`).
4. Tap **Send Follow-Up** and complete the share sheet. Expect:
   - `booking_link_shared` with `screen: "plan_followup"`, **and**
   - `follow_up_card_auto_hidden` with the same `todayShareCount`
     and the matching `method` (`"share"` or `"copy"`).
   The card should disappear and stay gone for the rest of the
   session.
5. In a fresh session (clear sessionStorage), get back to the
   eligible state and tap the **×** instead. Expect
   `follow_up_card_dismissed` with the matching `todayShareCount`,
   and the card should disappear and stay gone for the rest of the
   session.

## Related files

- `client/src/pages/TodaysGamePlanPage.tsx` — fires
  `follow_up_card_shown` (one-shot effect, lines ~370–404) and
  `follow_up_card_auto_hidden` (inside the share sheet's `onShared`,
  lines ~855–886).
- `client/src/components/booking-link/FollowUpCard.tsx` — fires
  `follow_up_card_dismissed` from the × handler.
- `client/src/components/booking-link/BookingLinkShareSheet.tsx` —
  the share sheet whose success path emits
  `booking_link_shared` with `screen: "plan_followup"`.
- `client/src/components/PostHogProvider.tsx` — `trackEvent` helper.
- `docs/runbooks/booking-link-conversion.md` — sibling runbook for
  the per-surface share funnels (including the upstream
  `plan_followup` share funnel that this runbook's outcome funnel
  cross-checks against).
