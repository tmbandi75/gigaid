import { BookingLinkShare } from "@/components/booking-link";

type Variant = "primary" | "inline" | "compact" | "hero";

function readParam<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  const search = typeof window !== "undefined" ? window.location.search : "";
  const params = new URLSearchParams(search);
  const raw = params.get(key);
  return (allowed as readonly string[]).includes(raw ?? "") ? (raw as T) : fallback;
}

const VARIANTS = ["primary", "inline", "compact", "hero"] as const;

/**
 * E2E-only harness that mounts the standalone BookingLinkShare card so a
 * Playwright spec can drive its primary/secondary share + copy flow without
 * needing to log in or render the full dashboard. Mounted only when
 * import.meta.env.DEV; the spec stubs /api/booking/link, /api/profile, and
 * /api/auth/user the same way the NBA harness spec does.
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
        <BookingLinkShare variant={variant} context="plan" />
      </div>
    </div>
  );
}
