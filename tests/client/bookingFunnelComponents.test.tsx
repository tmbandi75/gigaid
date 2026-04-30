/**
 * @jest-environment jsdom
 *
 * Component-level coverage for the four conversion-funnel surfaces added
 * to the mobile/tablet Today's Game Plan in Tasks #308 and #309:
 *
 *   - FirstActionOverlay      (zero-shares full-screen nudge)
 *   - SharesAwayBanner        (<3 shares persistent reminder)
 *   - SegmentedShareProgress  (segmented bar + status label)
 *   - FollowUpCard            (>=2 shares follow-up nudge)
 *
 * Why this exists: Task #310 — these surfaces drive the booking-link
 * conversion funnel and currently have zero automated test coverage.
 * The page-level gating (booking link present, isBelowDesktop, share
 * count threshold, sessionStorage flag) is exercised by
 * todaysGamePlanFunnel.test.tsx; this file locks the *component*
 * contract: the `open` prop gate, the dismissal sessionStorage writes,
 * and the SegmentedShareProgress fill / status-label transitions at
 * counts 0, 2, and 4 (the boundaries that drive the spec copy).
 *
 * A regression in any of these is invisible at compile time and would
 * silently break the funnel without anything failing in CI — exactly
 * the scenario Task #310 was filed against.
 */

import * as React from "react";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";

import {
  FirstActionOverlay,
  FIRST_ACTION_OVERLAY_SKIP_KEY,
} from "@/components/booking-link/FirstActionOverlay";
import {
  SharesAwayBanner,
  SHARES_AWAY_BANNER_DISMISSED_KEY,
} from "@/components/booking-link/SharesAwayBanner";
import { SegmentedShareProgress } from "@/components/booking-link/SegmentedShareProgress";
import {
  FollowUpCard,
  FOLLOW_UP_DISMISSED_KEY,
} from "@/components/booking-link/FollowUpCard";

afterEach(() => {
  cleanup();
  try {
    window.sessionStorage.clear();
  } catch {
    // sessionStorage is provided by jsdom; clear() should never throw,
    // but guard so a single bad test doesn't poison the suite.
  }
});

// ---------------------------------------------------------------------------
// FirstActionOverlay
// ---------------------------------------------------------------------------

describe("FirstActionOverlay", () => {
  it("does not render anything when open=false", () => {
    const onSendLink = jest.fn();
    const onSkip = jest.fn();

    render(
      <FirstActionOverlay open={false} onSendLink={onSendLink} onSkip={onSkip} />,
    );

    // The `open` prop is the component's only render gate — when false it
    // must return null so the overlay can never appear on top of the
    // share sheet that opens after a "Send My Booking Link" click.
    expect(screen.queryByTestId("overlay-first-action")).toBeNull();
  });

  it("renders the overlay shell + title + CTAs when open=true", () => {
    render(
      <FirstActionOverlay
        open
        onSendLink={() => {}}
        onSkip={() => {}}
      />,
    );

    const overlay = screen.getByTestId("overlay-first-action");
    expect(overlay).toBeTruthy();
    expect(screen.getByTestId("text-overlay-title").textContent).toContain(
      "Get Your First Paid Job Today",
    );
    expect(screen.getByTestId("button-overlay-send-link")).toBeTruthy();
    expect(screen.getByTestId("button-overlay-skip")).toBeTruthy();
    expect(screen.getByTestId("button-overlay-close")).toBeTruthy();
  });

  it("invokes onSendLink (without persisting the skip flag) when the primary CTA is pressed", () => {
    const onSendLink = jest.fn();
    const onSkip = jest.fn();

    render(
      <FirstActionOverlay open onSendLink={onSendLink} onSkip={onSkip} />,
    );

    fireEvent.click(screen.getByTestId("button-overlay-send-link"));

    // The page-level handler is responsible for setting the skip flag
    // when handing off to the share sheet (so the overlay can re-open
    // on a future zero-shares session if the share is cancelled). The
    // component itself MUST NOT write the skip flag from the primary
    // CTA, only from the dismissal paths.
    expect(onSendLink).toHaveBeenCalledTimes(1);
    expect(onSkip).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(FIRST_ACTION_OVERLAY_SKIP_KEY)).toBeNull();
  });

  it("persists the skip flag and calls onSkip when 'I'll do this later' is pressed", () => {
    const onSkip = jest.fn();

    render(<FirstActionOverlay open onSendLink={() => {}} onSkip={onSkip} />);

    fireEvent.click(screen.getByTestId("button-overlay-skip"));

    expect(window.sessionStorage.getItem(FIRST_ACTION_OVERLAY_SKIP_KEY)).toBe("1");
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("persists the skip flag and calls onSkip when the close (×) button is pressed", () => {
    const onSkip = jest.fn();

    render(<FirstActionOverlay open onSendLink={() => {}} onSkip={onSkip} />);

    fireEvent.click(screen.getByTestId("button-overlay-close"));

    expect(window.sessionStorage.getItem(FIRST_ACTION_OVERLAY_SKIP_KEY)).toBe("1");
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("persists the skip flag and calls onSkip when Escape is pressed while open", () => {
    const onSkip = jest.fn();

    render(<FirstActionOverlay open onSendLink={() => {}} onSkip={onSkip} />);

    // Escape MUST dismiss with the same semantics as the close button —
    // otherwise keyboard users would re-see the overlay on the next
    // render after closing it via Escape.
    fireEvent.keyDown(document, { key: "Escape" });

    expect(window.sessionStorage.getItem(FIRST_ACTION_OVERLAY_SKIP_KEY)).toBe("1");
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// SharesAwayBanner
// ---------------------------------------------------------------------------

describe("SharesAwayBanner", () => {
  it("does not render when open=false", () => {
    render(
      <SharesAwayBanner
        open={false}
        todayShareCount={0}
        stickyCtaActive={false}
        onSendLink={() => {}}
        onDismiss={() => {}}
      />,
    );

    expect(screen.queryByTestId("banner-shares-away")).toBeNull();
  });

  it("does not render when the share count has already reached the 3-share threshold", () => {
    // The component carries its own count gate as a defence-in-depth
    // against a stale `open` prop (e.g. stale React state on the page
    // race). Even with open=true it must hide itself once the user
    // crosses into the booking zone.
    render(
      <SharesAwayBanner
        open
        todayShareCount={3}
        stickyCtaActive={false}
        onSendLink={() => {}}
        onDismiss={() => {}}
      />,
    );

    expect(screen.queryByTestId("banner-shares-away")).toBeNull();
  });

  it("renders the singular 'share' wording when one share remains", () => {
    render(
      <SharesAwayBanner
        open
        todayShareCount={2}
        stickyCtaActive={false}
        onSendLink={() => {}}
        onDismiss={() => {}}
      />,
    );

    const message = screen.getByTestId("text-banner-message");
    // Singular form is the spec copy at remaining = 1; plural would
    // read awkwardly ("1 shares away").
    expect(message.textContent).toContain("1 share away");
    expect(message.textContent).not.toContain("1 shares");
  });

  it("renders the plural 'shares' wording when more than one share remains", () => {
    render(
      <SharesAwayBanner
        open
        todayShareCount={0}
        stickyCtaActive={false}
        onSendLink={() => {}}
        onDismiss={() => {}}
      />,
    );

    expect(screen.getByTestId("text-banner-message").textContent).toContain(
      "3 shares away",
    );
  });

  it("invokes onSendLink (without persisting the dismiss flag) when the Send Link Now CTA is pressed", () => {
    const onSendLink = jest.fn();
    const onDismiss = jest.fn();

    render(
      <SharesAwayBanner
        open
        todayShareCount={1}
        stickyCtaActive={false}
        onSendLink={onSendLink}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.click(screen.getByTestId("button-banner-send-link"));

    expect(onSendLink).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
    // Dismiss flag is reserved for the explicit × button — sending the
    // link should not silently dismiss the banner for the rest of the
    // session (otherwise the user wouldn't see it return after a
    // cancelled share).
    expect(
      window.sessionStorage.getItem(SHARES_AWAY_BANNER_DISMISSED_KEY),
    ).toBeNull();
  });

  it("persists the dismissed flag and calls onDismiss when the × button is pressed", () => {
    const onDismiss = jest.fn();

    render(
      <SharesAwayBanner
        open
        todayShareCount={1}
        stickyCtaActive={false}
        onSendLink={() => {}}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.click(screen.getByTestId("button-banner-dismiss"));

    expect(
      window.sessionStorage.getItem(SHARES_AWAY_BANNER_DISMISSED_KEY),
    ).toBe("1");
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("stacks above the sticky CTA when stickyCtaActive=true and takes its slot otherwise", () => {
    // The bottom inset is the only positional contract we make to the
    // page: the banner must sit above the sticky CTA when one exists,
    // and slide into the CTA's slot when there is none. Asserting on
    // the inline `bottom` style locks both branches without depending
    // on screenshot regressions.
    const { rerender } = render(
      <SharesAwayBanner
        open
        todayShareCount={0}
        stickyCtaActive
        onSendLink={() => {}}
        onDismiss={() => {}}
      />,
    );

    let banner = screen.getByTestId("banner-shares-away");
    expect(banner.getAttribute("style") ?? "").toContain("8.5rem");

    rerender(
      <SharesAwayBanner
        open
        todayShareCount={0}
        stickyCtaActive={false}
        onSendLink={() => {}}
        onDismiss={() => {}}
      />,
    );

    banner = screen.getByTestId("banner-shares-away");
    const style = banner.getAttribute("style") ?? "";
    expect(style).toContain("4rem");
    expect(style).not.toContain("8.5rem");
  });
});

// ---------------------------------------------------------------------------
// SegmentedShareProgress
// ---------------------------------------------------------------------------

describe("SegmentedShareProgress", () => {
  it("renders 'target' segments with none filled at count 0 and shows the 'Getting started' status", () => {
    render(<SegmentedShareProgress count={0} target={5} />);

    const bar = screen.getByTestId("progress-bar-shares");
    expect(bar.getAttribute("aria-valuenow")).toBe("0");
    expect(bar.getAttribute("aria-valuemax")).toBe("5");

    // All five segments should be present; the inner fill `<div>` is
    // marked aria-hidden but its width class is the visual fill state.
    for (let i = 0; i < 5; i += 1) {
      const segment = screen.getByTestId(`progress-segment-${i}`);
      const inner = segment.firstElementChild as HTMLElement | null;
      expect(inner).not.toBeNull();
      expect(inner!.className).toContain("w-0");
      expect(inner!.className).not.toContain("w-full");
    }

    expect(screen.getByTestId("text-progress-status").textContent).toBe(
      "Getting started",
    );
    // The flame icon only appears in the booking zone (count >= 4).
    expect(screen.queryByTestId("icon-progress-status-flame")).toBeNull();
  });

  it("fills two segments at count 2 and shows the 'Momentum building' status", () => {
    render(<SegmentedShareProgress count={2} target={5} />);

    const bar = screen.getByTestId("progress-bar-shares");
    expect(bar.getAttribute("aria-valuenow")).toBe("2");

    for (let i = 0; i < 5; i += 1) {
      const segment = screen.getByTestId(`progress-segment-${i}`);
      const inner = segment.firstElementChild as HTMLElement | null;
      expect(inner).not.toBeNull();
      if (i < 2) {
        expect(inner!.className).toContain("w-full");
        expect(inner!.className).not.toContain("w-0");
      } else {
        expect(inner!.className).toContain("w-0");
        expect(inner!.className).not.toContain("w-full");
      }
    }

    expect(screen.getByTestId("text-progress-status").textContent).toBe(
      "Momentum building",
    );
    expect(screen.queryByTestId("icon-progress-status-flame")).toBeNull();
  });

  it("fills four segments at count 4 and shows the 'Booking zone' status with the flame icon", () => {
    render(<SegmentedShareProgress count={4} target={5} />);

    const bar = screen.getByTestId("progress-bar-shares");
    expect(bar.getAttribute("aria-valuenow")).toBe("4");

    for (let i = 0; i < 5; i += 1) {
      const segment = screen.getByTestId(`progress-segment-${i}`);
      const inner = segment.firstElementChild as HTMLElement | null;
      expect(inner).not.toBeNull();
      if (i < 4) {
        expect(inner!.className).toContain("w-full");
      } else {
        expect(inner!.className).toContain("w-0");
      }
    }

    expect(screen.getByTestId("text-progress-status").textContent).toBe(
      "Booking zone",
    );
    // The flame is the visual cue that the user is in the high-conversion
    // zone — rendering it ONLY at count >= 4 is the behaviour Task #310
    // is locking.
    expect(screen.getByTestId("icon-progress-status-flame")).toBeTruthy();
  });

  it("clamps the visible count to the target when an over-target value is provided and keeps the celebratory treatment", () => {
    // Defends the segment loop against a future bug where the share
    // count could briefly exceed the target (e.g. an in-flight share
    // resolving after the target is already met). The bar should max
    // out at `target` rather than render extra segments, and the
    // celebratory state from Task #305 must persist instead of looking
    // broken (e.g. flipping back to the "Booking zone" status).
    render(<SegmentedShareProgress count={9} target={5} />);

    const bar = screen.getByTestId("progress-bar-shares");
    expect(bar.getAttribute("aria-valuenow")).toBe("5");
    // Only the 5 segments dictated by `target` should exist.
    expect(screen.queryByTestId("progress-segment-5")).toBeNull();
    for (let i = 0; i < 5; i += 1) {
      const segment = screen.getByTestId(`progress-segment-${i}`);
      const inner = segment.firstElementChild as HTMLElement | null;
      expect(inner!.className).toContain("w-full");
    }
    // Task #319 — once the count exceeds the target the celebratory
    // line escalates past the at-target copy. At bonus = 4 (9 − 5) the
    // tier copy is the "Crushing it" variant.
    expect(screen.getByTestId("text-progress-status").textContent).toBe(
      "Crushing it — every share is more pipeline",
    );
    expect(screen.getByTestId("hero-share-progress-celebrated")).toBeTruthy();
    expect(screen.getByTestId("icon-progress-status-check")).toBeTruthy();
    // The flame from the booking-zone state must yield to the green
    // check once the goal is reached.
    expect(screen.queryByTestId("icon-progress-status-flame")).toBeNull();
    // The bonus pill must surface the over-target delta so the user
    // sees a concrete acknowledgement of every extra share.
    const bonusPill = screen.getByTestId("hero-share-progress-bonus");
    expect(bonusPill.getAttribute("data-bonus-count")).toBe("4");
    expect(bonusPill.textContent).toBe("+4 bonus shares today");
  });

  it("renders the static subtext that anchors the progress bar to the 5-shares spec copy while below target", () => {
    render(<SegmentedShareProgress count={1} target={5} />);

    expect(screen.getByTestId("text-progress-subtext").textContent).toBe(
      "Send to 5 people — most users get booked here",
    );
  });

  it("swaps the muted status line for the celebratory variant when the count reaches the target", () => {
    // Task #305 — when the live count from /api/booking/share-progress
    // hits the daily target, the hero replaces the muted "Booking zone"
    // status with a green check and the celebratory acknowledgement.
    // The "Send to 5 people" subtext is moot at that point and is
    // dropped so the celebratory line is the single source of truth.
    render(<SegmentedShareProgress count={5} target={5} />);

    expect(screen.getByTestId("hero-share-progress-celebrated")).toBeTruthy();
    expect(screen.getByTestId("text-progress-status").textContent).toBe(
      "You've hit today's goal — keep the momentum",
    );
    expect(screen.getByTestId("icon-progress-status-check")).toBeTruthy();
    expect(screen.queryByTestId("icon-progress-status-flame")).toBeNull();
    expect(screen.queryByTestId("text-progress-subtext")).toBeNull();
    // The bonus pill (Task #319) must NOT appear when the count is
    // exactly at target — it's the over-target acknowledgement only.
    expect(screen.queryByTestId("hero-share-progress-bonus")).toBeNull();
    // All five fill segments should be rendered as completed (full
    // width) to match the celebratory acknowledgement above.
    for (let i = 0; i < 5; i += 1) {
      const segment = screen.getByTestId(`progress-segment-${i}`);
      const inner = segment.firstElementChild as HTMLElement | null;
      expect(inner!.className).toContain("w-full");
    }
  });

  it("does not render the celebratory variant while still below the target", () => {
    // Locks the inverse of the Task #305 behaviour so a future tweak
    // to the threshold can't silently start celebrating early.
    render(<SegmentedShareProgress count={4} target={5} />);

    expect(screen.queryByTestId("hero-share-progress-celebrated")).toBeNull();
    expect(screen.queryByTestId("icon-progress-status-check")).toBeNull();
  });

  it("animates the celebration on the render that crosses the target, not on a refetch that lands already at target", () => {
    // Task #305 — the celebratory swap must animate in the moment the
    // count flips to target, but background refetches that keep the
    // count at/above target must NOT replay the animation. We expose
    // the one-shot gate as `data-animate-celebration` on the
    // celebratory container so this test can lock the behaviour
    // without peeking into framer-motion internals.

    // (1) Initial mount already at target → celebratory variant is on
    // screen, but animation is OFF (the user landed here from a fresh
    // page load / focus refetch, not a live transition).
    const { rerender, unmount } = render(
      <SegmentedShareProgress count={5} target={5} />,
    );
    let celebrated = screen.getByTestId("hero-share-progress-celebrated");
    expect(celebrated.getAttribute("data-animate-celebration")).toBe("false");

    // (2) A subsequent focus-refetch render that keeps us at target
    // must also leave the animation OFF — no flashing on every 30s
    // staleTime refetch.
    rerender(<SegmentedShareProgress count={5} target={5} />);
    celebrated = screen.getByTestId("hero-share-progress-celebrated");
    expect(celebrated.getAttribute("data-animate-celebration")).toBe("false");

    unmount();

    // (3) Mount below target, then rerender at target. The transition
    // render itself must enable the entrance animation — this is the
    // failure mode flagged in the Task #305 review (an effect-driven
    // gate would only flip AFTER the celebratory <motion.div> mounts,
    // missing the transition render entirely).
    const { rerender: rerenderCross } = render(
      <SegmentedShareProgress count={4} target={5} />,
    );
    expect(screen.queryByTestId("hero-share-progress-celebrated")).toBeNull();

    rerenderCross(<SegmentedShareProgress count={5} target={5} />);
    celebrated = screen.getByTestId("hero-share-progress-celebrated");
    expect(celebrated.getAttribute("data-animate-celebration")).toBe("true");

    // (4) Yet another refetch render at the same at-target count must
    // turn the animation gate back OFF — the celebration is one-shot.
    rerenderCross(<SegmentedShareProgress count={5} target={5} />);
    celebrated = screen.getByTestId("hero-share-progress-celebrated");
    expect(celebrated.getAttribute("data-animate-celebration")).toBe("false");
  });

  it("re-arms the celebration animation if the count drops below target and then crosses again", () => {
    // Defends the one-shot gate against the rare case where the count
    // drops back below target (e.g. a share is invalidated or the day
    // resets mid-session) and then climbs back. The next crossing
    // should animate again — the gate is per-crossing, not per-mount.
    const { rerender } = render(
      <SegmentedShareProgress count={5} target={5} />,
    );
    let celebrated = screen.getByTestId("hero-share-progress-celebrated");
    expect(celebrated.getAttribute("data-animate-celebration")).toBe("false");

    rerender(<SegmentedShareProgress count={3} target={5} />);
    expect(screen.queryByTestId("hero-share-progress-celebrated")).toBeNull();

    rerender(<SegmentedShareProgress count={5} target={5} />);
    celebrated = screen.getByTestId("hero-share-progress-celebrated");
    expect(celebrated.getAttribute("data-animate-celebration")).toBe("true");
  });

  it("escalates the celebratory copy as the bonus count grows past the target", () => {
    // Task #319 — the at-target line ("keep the momentum") only fires
    // at exactly target. As the user keeps tapping share past the goal
    // the line escalates through tiered copy so every extra share
    // feels like a concrete acknowledgement, not the same flat
    // celebration. The thresholds are bonus 1–2, 3–4, and 5+.
    const { rerender } = render(
      <SegmentedShareProgress count={5} target={5} />,
    );
    expect(screen.getByTestId("text-progress-status").textContent).toBe(
      "You've hit today's goal — keep the momentum",
    );

    rerender(<SegmentedShareProgress count={6} target={5} />);
    expect(screen.getByTestId("text-progress-status").textContent).toBe(
      "On a roll — keep them coming",
    );

    rerender(<SegmentedShareProgress count={7} target={5} />);
    expect(screen.getByTestId("text-progress-status").textContent).toBe(
      "On a roll — keep them coming",
    );

    rerender(<SegmentedShareProgress count={8} target={5} />);
    expect(screen.getByTestId("text-progress-status").textContent).toBe(
      "Crushing it — every share is more pipeline",
    );

    rerender(<SegmentedShareProgress count={10} target={5} />);
    expect(screen.getByTestId("text-progress-status").textContent).toBe(
      "Unstoppable — you're on fire today",
    );
  });

  it("renders a singular bonus pill at +1 and pluralises past that", () => {
    // Task #319 — the pill is the visual anchor for the over-target
    // delta. We lock both the singular/plural copy and the data-bonus
    // attribute so a future tweak to the wording can't silently break
    // the spec ("+1 bonus share today" vs "+N bonus shares today").
    const { rerender } = render(
      <SegmentedShareProgress count={6} target={5} />,
    );
    let pill = screen.getByTestId("hero-share-progress-bonus");
    expect(pill.getAttribute("data-bonus-count")).toBe("1");
    expect(pill.textContent).toBe("+1 bonus share today");

    rerender(<SegmentedShareProgress count={7} target={5} />);
    pill = screen.getByTestId("hero-share-progress-bonus");
    expect(pill.getAttribute("data-bonus-count")).toBe("2");
    expect(pill.textContent).toBe("+2 bonus shares today");
  });

  it("animates the bonus pill on the render where bonus increases, not on a refetch that lands at the same bonus value", () => {
    // Task #319 — same one-shot gate as the celebratory line: the pill
    // entrance animates only when `bonus` actually grows (the user
    // just tapped share past the goal). Background refetches that
    // report the same over-target count must NOT replay the entrance
    // animation, otherwise the pill would flash on every focus /
    // 30s staleTime refetch while the count sits at e.g. 7/5.

    // (1) Initial mount already at +2 — pill is visible but the
    // animation gate is OFF (the user landed here, didn't transition).
    const { rerender, unmount } = render(
      <SegmentedShareProgress count={7} target={5} />,
    );
    let pill = screen.getByTestId("hero-share-progress-bonus");
    expect(pill.getAttribute("data-animate-bonus")).toBe("false");
    expect(pill.getAttribute("data-bonus-count")).toBe("2");

    // (2) A subsequent refetch render that keeps bonus at 2 must
    // leave the gate OFF.
    rerender(<SegmentedShareProgress count={7} target={5} />);
    pill = screen.getByTestId("hero-share-progress-bonus");
    expect(pill.getAttribute("data-animate-bonus")).toBe("false");

    unmount();

    // (3) Mount at exactly target (bonus=0, no pill), then bump to
    // 6/5 — the pill appears AND the animation gate is ON because the
    // user just tapped share past the goal.
    const { rerender: rerenderGrow } = render(
      <SegmentedShareProgress count={5} target={5} />,
    );
    expect(screen.queryByTestId("hero-share-progress-bonus")).toBeNull();

    rerenderGrow(<SegmentedShareProgress count={6} target={5} />);
    pill = screen.getByTestId("hero-share-progress-bonus");
    expect(pill.getAttribute("data-bonus-count")).toBe("1");
    expect(pill.getAttribute("data-animate-bonus")).toBe("true");

    // (4) Another refetch render that keeps bonus at 1 must turn the
    // gate back OFF — the pill animation is per-increment, not
    // per-render.
    rerenderGrow(<SegmentedShareProgress count={6} target={5} />);
    pill = screen.getByTestId("hero-share-progress-bonus");
    expect(pill.getAttribute("data-animate-bonus")).toBe("false");

    // (5) The next genuine increment (6 → 7) must re-arm the gate.
    rerenderGrow(<SegmentedShareProgress count={7} target={5} />);
    pill = screen.getByTestId("hero-share-progress-bonus");
    expect(pill.getAttribute("data-bonus-count")).toBe("2");
    expect(pill.getAttribute("data-animate-bonus")).toBe("true");
  });

  it("degrades cleanly at very high counts without layout breakage or extra segments", () => {
    // Task #319 — the celebration treatment must hold up at extreme
    // counts (e.g. 20/5). The bar still caps at `target` segments, the
    // top-tier copy is shown, and the bonus pill renders the literal
    // delta with the truncate guard so the hero can't overflow.
    render(<SegmentedShareProgress count={20} target={5} />);

    // Bar still caps at the target — no rogue extra segments.
    expect(screen.queryByTestId("progress-segment-5")).toBeNull();
    const bar = screen.getByTestId("progress-bar-shares");
    expect(bar.getAttribute("aria-valuenow")).toBe("5");

    // Top tier copy is the "Unstoppable" line.
    expect(screen.getByTestId("text-progress-status").textContent).toBe(
      "Unstoppable — you're on fire today",
    );

    // Pill renders the full delta and stays within the layout via
    // the truncate guard on the inner span.
    const pill = screen.getByTestId("hero-share-progress-bonus");
    expect(pill.getAttribute("data-bonus-count")).toBe("15");
    expect(pill.textContent).toBe("+15 bonus shares today");
    const inner = pill.firstElementChild as HTMLElement | null;
    expect(inner).not.toBeNull();
    expect(inner!.className).toContain("truncate");
    // The pill's container caps its width to prevent overflow.
    expect(pill.className).toContain("max-w-full");
  });
});

// ---------------------------------------------------------------------------
// FollowUpCard
// ---------------------------------------------------------------------------

describe("FollowUpCard", () => {
  it("does not render when open=false", () => {
    render(
      <FollowUpCard
        open={false}
        onSendFollowUp={() => {}}
        onDismiss={() => {}}
      />,
    );

    expect(screen.queryByTestId("card-follow-up")).toBeNull();
  });

  it("renders the title, subtitle, and Send Follow-Up CTA when open=true", () => {
    render(
      <FollowUpCard open onSendFollowUp={() => {}} onDismiss={() => {}} />,
    );

    const card = screen.getByTestId("card-follow-up");
    expect(card).toBeTruthy();
    expect(within(card).getByTestId("text-follow-up-title").textContent).toContain(
      "send a follow-up",
    );
    expect(within(card).getByTestId("text-follow-up-subtitle")).toBeTruthy();
    expect(within(card).getByTestId("button-follow-up-send")).toBeTruthy();
    expect(within(card).getByTestId("button-follow-up-dismiss")).toBeTruthy();
  });

  it("invokes onSendFollowUp (without persisting the dismiss flag) when the Send Follow-Up CTA is pressed", () => {
    const onSendFollowUp = jest.fn();
    const onDismiss = jest.fn();

    render(
      <FollowUpCard
        open
        onSendFollowUp={onSendFollowUp}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.click(screen.getByTestId("button-follow-up-send"));

    expect(onSendFollowUp).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
    // Pressing the CTA must NOT persist the dismiss flag — the page
    // hides the card naturally once the share goes through (share
    // count increments and the >=2-shares branch keeps the card open
    // until the user explicitly dismisses).
    expect(window.sessionStorage.getItem(FOLLOW_UP_DISMISSED_KEY)).toBeNull();
  });

  it("persists the dismissed flag and calls onDismiss when the × button is pressed", () => {
    const onDismiss = jest.fn();

    render(
      <FollowUpCard
        open
        onSendFollowUp={() => {}}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.click(screen.getByTestId("button-follow-up-dismiss"));

    expect(window.sessionStorage.getItem(FOLLOW_UP_DISMISSED_KEY)).toBe("1");
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
