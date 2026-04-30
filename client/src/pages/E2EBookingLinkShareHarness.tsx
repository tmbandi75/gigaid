import { useState } from "react";

import { BookingLinkShare } from "@/components/booking-link";
import { FirstActionOverlay } from "@/components/booking-link/FirstActionOverlay";
import { SharesAwayBanner } from "@/components/booking-link/SharesAwayBanner";
import { FollowUpCard } from "@/components/booking-link/FollowUpCard";

type Variant = "primary" | "inline" | "compact" | "hero" | "funnel";

function readParam<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  const search = typeof window !== "undefined" ? window.location.search : "";
  const params = new URLSearchParams(search);
  const raw = params.get(key);
  return (allowed as readonly string[]).includes(raw ?? "") ? (raw as T) : fallback;
}

const VARIANTS = ["primary", "inline", "compact", "hero", "funnel"] as const;

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
