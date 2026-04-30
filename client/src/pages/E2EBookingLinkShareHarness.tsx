import { useEffect, useState } from "react";

import { BookingLinkShare } from "@/components/booking-link";
import { FirstActionOverlay } from "@/components/booking-link/FirstActionOverlay";
import { SharesAwayBanner } from "@/components/booking-link/SharesAwayBanner";
import { FollowUpCard } from "@/components/booking-link/FollowUpCard";
import { useBookingZoneToast } from "@/lib/useBookingZoneToast";
import type { BookingShareProgress } from "@shared/bookingLink";

type Variant =
  | "primary"
  | "inline"
  | "compact"
  | "hero"
  | "funnel"
  | "booking-zone";

function readParam<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  const search = typeof window !== "undefined" ? window.location.search : "";
  const params = new URLSearchParams(search);
  const raw = params.get(key);
  return (allowed as readonly string[]).includes(raw ?? "") ? (raw as T) : fallback;
}

function readNumberParam(key: string, fallback: number): number {
  const search = typeof window !== "undefined" ? window.location.search : "";
  const raw = new URLSearchParams(search).get(key);
  if (raw === null) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const VARIANTS = [
  "primary",
  "inline",
  "compact",
  "hero",
  "funnel",
  "booking-zone",
] as const;

/**
 * E2E-only harness that mounts the standalone BookingLinkShare card so a
 * Playwright spec can drive its primary/secondary share + copy flow without
 * needing to log in or render the full dashboard. Mounted only when
 * import.meta.env.DEV; the spec stubs /api/booking/link, /api/profile, and
 * /api/auth/user the same way the NBA harness spec does.
 *
 * The "funnel" variant mounts the three dismissable conversion-funnel
 * surfaces (FirstActionOverlay / SharesAwayBanner / FollowUpCard) so a
 * Playwright spec can verify their sessionStorage dismissal flags
 * (`gigaid:booking-overlay-skipped`, `gigaid:booking-banner-dismissed`,
 * `gigaid:booking-followup-dismissed`) actually persist across reloads
 * within a session — the contract Task #310 locks for the conversion
 * funnel.
 *
 * The "booking-zone" variant mounts the page-level booking-zone
 * celebration toast hook (`useBookingZoneToast`) with a controllable
 * share count so a Playwright spec can drive the live <3 → ≥3
 * transition (the only path that fires the toast) and assert that the
 * toast actually renders in the DOM AND that the page itself writes the
 * `gigaid:booking-zone-toast-fired` sessionStorage flag — the gap left
 * by the jsdom integration test in tests/client/todaysGamePlanFunnel.test.tsx.
 */
export default function E2EBookingLinkShareHarness() {
  const variant = readParam<Variant>("variant", VARIANTS, "primary");

  return (
    <div
      className="min-h-screen bg-background p-4"
      data-testid="page-e2e-booking-link-share-harness"
    >
      <div
        className="max-w-2xl mx-auto space-y-4"
        data-testid={`harness-booking-link-${variant}`}
      >
        {variant === "funnel" ? (
          <FunnelHarness />
        ) : variant === "booking-zone" ? (
          <BookingZoneToastHarness />
        ) : (
          <BookingLinkShare variant={variant} context="plan" />
        )}
      </div>
    </div>
  );
}

/**
 * Mounts the three dismissable funnel surfaces in their open state so an
 * e2e spec can drive their dismiss buttons and reload the page to verify
 * the sessionStorage keys persist. The local closed-state booleans
 * mirror what TodaysGamePlanPage does — once dismissed, the surface
 * disappears for the rest of the page mount, but the sessionStorage
 * write is what enforces persistence across reloads.
 */
function FunnelHarness() {
  const [overlayOpen, setOverlayOpen] = useState(true);
  const [bannerOpen, setBannerOpen] = useState(true);
  const [followUpOpen, setFollowUpOpen] = useState(true);

  return (
    <>
      <FirstActionOverlay
        open={overlayOpen}
        onSendLink={() => setOverlayOpen(false)}
        onSkip={() => setOverlayOpen(false)}
      />
      <SharesAwayBanner
        open={bannerOpen}
        todayShareCount={0}
        stickyCtaActive={false}
        onSendLink={() => setBannerOpen(false)}
        onDismiss={() => setBannerOpen(false)}
      />
      <FollowUpCard
        open={followUpOpen}
        onSendFollowUp={() => setFollowUpOpen(false)}
        onDismiss={() => setFollowUpOpen(false)}
      />
    </>
  );
}

/**
 * Mounts the live `useBookingZoneToast` hook with a controllable share
 * count so an e2e spec can drive the <3 → ≥3 transition that fires the
 * celebratory toast. The initial count is read from `?count=` so the
 * "reload at the same count" assertion can re-enter the page already
 * sitting at ≥3 (which must NOT re-fire the toast).
 *
 * The harness exposes a single window helper, `__setBookingZoneCount`,
 * so the test can drive the in-session transition without needing to
 * roundtrip through a real share endpoint.
 */
function BookingZoneToastHarness() {
  const initialCount = readNumberParam("count", 0);
  const [count, setCount] = useState<number>(initialCount);
  const shareProgress: BookingShareProgress = { count, target: 5 };

  useBookingZoneToast(shareProgress);

  useEffect(() => {
    const w = window as unknown as {
      __setBookingZoneCount?: (n: number) => void;
    };
    w.__setBookingZoneCount = (n: number) => setCount(n);
    return () => {
      delete w.__setBookingZoneCount;
    };
  }, []);

  return (
    <div data-testid="harness-booking-zone-state">
      <span data-testid="harness-booking-zone-count">{count}</span>
    </div>
  );
}
