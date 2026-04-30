import { useEffect, useRef } from "react";
import { Share2, X } from "lucide-react";

import { Button } from "@/components/ui/button";

export const FIRST_ACTION_OVERLAY_SKIP_KEY = "gigaid:booking-overlay-skipped";

export interface FirstActionOverlayProps {
  open: boolean;
  onSendLink: () => void;
  onSkip: () => void;
}

export function FirstActionOverlay({ open, onSendLink, onSkip }: FirstActionOverlayProps) {
  const primaryButtonRef = useRef<HTMLButtonElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Persist the session-skip key from every dismissal path (Escape key,
  // backdrop close button, "I'll do this later"). We expose this through
  // a ref so the keydown handler stays mounted across renders without
  // re-running its effect just because handleSkip's identity changed.
  const skipRef = useRef<() => void>(() => {});

  const handleSkip = () => {
    try {
      window.sessionStorage.setItem(FIRST_ACTION_OVERLAY_SKIP_KEY, "1");
    } catch {
      // sessionStorage may be unavailable (private mode etc.) — onSkip
      // still closes the overlay; on the next mount the in-memory
      // overlayOpen flag stays false until the page reloads.
    }
    onSkip();
  };
  skipRef.current = handleSkip;

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => {
      primaryButtonRef.current?.focus();
    }, 0);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        // Route through skipRef so Escape persists the sessionStorage
        // flag — same dismissal semantics as the close button and the
        // "I'll do this later" CTA.
        skipRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const root = containerRef.current;
      if (!root) return;
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("disabled"));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const handlePrimary = () => {
    // Analytics for booking_link_share_opened + recordShareTap fire from
    // BookingLinkShareSheet's open effect with screen="plan_overlay" so we
    // don't double-fire here.
    onSendLink();
  };

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-action-overlay-title"
      aria-describedby="first-action-overlay-subtitle"
      className="fixed inset-0 z-[1000] flex flex-col items-stretch bg-background/95 backdrop-blur-sm"
      style={{
        paddingTop: "var(--safe-area-inset-top)",
        paddingBottom: "var(--safe-area-inset-bottom)",
      }}
      data-testid="overlay-first-action"
    >
      <div className="flex justify-end p-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSkip}
          aria-label="Close overlay"
          data-testid="button-overlay-close"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="h-16 w-16 rounded-2xl bg-primary/15 flex items-center justify-center mb-6">
          <Share2 className="h-8 w-8 text-primary" />
        </div>
        <h2
          id="first-action-overlay-title"
          className="text-2xl font-bold text-foreground mb-3"
          data-testid="text-overlay-title"
        >
          Get Your First Paid Job Today
        </h2>
        <p
          id="first-action-overlay-subtitle"
          className="text-sm text-muted-foreground max-w-sm"
          data-testid="text-overlay-subtitle"
        >
          Most users get booked after sending their link to 3–5 people.
        </p>
      </div>

      <div className="px-5 pb-6 space-y-2">
        <Button
          ref={primaryButtonRef}
          size="lg"
          className="w-full h-12 text-base font-semibold"
          onClick={handlePrimary}
          data-testid="button-overlay-send-link"
        >
          <Share2 className="h-5 w-5 mr-2" />
          Send My Booking Link
        </Button>
        <Button
          variant="ghost"
          size="lg"
          className="w-full h-12 text-base text-muted-foreground"
          onClick={handleSkip}
          data-testid="button-overlay-skip"
        >
          I'll do this later
        </Button>
      </div>
    </div>
  );
}
