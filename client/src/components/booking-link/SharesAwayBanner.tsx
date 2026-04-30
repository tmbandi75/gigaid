import { Send, X } from "lucide-react";

import { Button } from "@/components/ui/button";

export const SHARES_AWAY_BANNER_DISMISSED_KEY = "gigaid:booking-banner-dismissed";

const FIRST_BOOKING_TARGET = 3;

export interface SharesAwayBannerProps {
  open: boolean;
  todayShareCount: number;
  /** When true, the existing sticky CTA is rendered just below the banner. */
  stickyCtaActive: boolean;
  onSendLink: () => void;
  onDismiss: () => void;
}

export function SharesAwayBanner({
  open,
  todayShareCount,
  stickyCtaActive,
  onSendLink,
  onDismiss,
}: SharesAwayBannerProps) {
  if (!open) return null;

  const remaining = Math.max(0, FIRST_BOOKING_TARGET - todayShareCount);
  if (remaining <= 0) return null;
  const sharesLabel = remaining === 1 ? "share" : "shares";

  // The existing sticky CTA wrapper sits at `bottom: calc(4rem + safe-area)`
  // and is roughly 4.5rem tall (p-3 + h-12 button). Stack the banner just
  // above it so neither covers the other; when there is no sticky CTA, the
  // banner takes its slot.
  const bottom = stickyCtaActive
    ? "calc(8.5rem + var(--safe-area-inset-bottom))"
    : "calc(4rem + var(--safe-area-inset-bottom))";

  const handleSend = () => {
    // Analytics for booking_link_share_opened + recordShareTap fire from
    // BookingLinkShareSheet's open effect with screen="plan_banner" so we
    // don't double-fire here.
    onSendLink();
  };

  const handleDismiss = () => {
    try {
      window.sessionStorage.setItem(SHARES_AWAY_BANNER_DISMISSED_KEY, "1");
    } catch {
      // sessionStorage may be unavailable — onDismiss still hides the
      // banner for the rest of this mount; it returns on the next page
      // load if the share count is still under the threshold.
    }
    onDismiss();
  };

  return (
    <div
      className="fixed left-0 right-0 px-3 z-50"
      style={{ bottom }}
      data-testid="banner-shares-away"
    >
      <div className="max-w-lg mx-auto rounded-xl border bg-primary/10 dark:bg-primary/15 backdrop-blur-sm shadow-md flex items-center gap-2 px-3 py-2">
        <p
          className="flex-1 text-sm font-medium text-foreground"
          data-testid="text-banner-message"
        >
          You're {remaining} {sharesLabel} away from your first booking
        </p>
        <Button
          size="sm"
          className="shrink-0 h-9"
          onClick={handleSend}
          data-testid="button-banner-send-link"
        >
          <Send className="h-4 w-4 mr-1" />
          Send Link Now
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 h-9 w-9 text-muted-foreground"
          onClick={handleDismiss}
          aria-label="Dismiss reminder"
          data-testid="button-banner-dismiss"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
