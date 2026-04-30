import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Send, X } from "lucide-react";
import { trackEvent } from "@/components/PostHogProvider";

export const FOLLOW_UP_DISMISSED_KEY = "gigaid:booking-followup-dismissed";
// Set when the pro actually completes a share via the follow-up card's
// share sheet (any of SMS / WhatsApp / Copy). Distinct from the dismiss
// key so we can tell "user opted out" from "user followed through" in
// analytics / future logic, but functionally either flag hides the card
// for the rest of the browser session.
export const FOLLOW_UP_SENT_KEY = "gigaid:booking-followup-sent";

interface FollowUpCardProps {
  open: boolean;
  onSendFollowUp: () => void;
  onDismiss: () => void;
  // Snapshot of the pro's share count for "today" at the time the card
  // is rendered. Forwarded into the follow_up_card_dismissed PostHog
  // event so we can compare dismiss-vs-share conversion across the
  // 2/3/4/5-shares cohorts that actually see the card.
  todayShareCount?: number;
}

export function FollowUpCard({
  open,
  onSendFollowUp,
  onDismiss,
  todayShareCount,
}: FollowUpCardProps) {
  if (!open) return null;

  const handleDismiss = () => {
    try {
      window.sessionStorage.setItem(FOLLOW_UP_DISMISSED_KEY, "1");
    } catch {
      // sessionStorage unavailable: still flip the in-memory flag below
      // so the card stays closed for this mount.
    }
    // Telemetry counterpart to the FOLLOW_UP_SENT_KEY-driven
    // follow_up_card_auto_hidden event fired from TodaysGamePlanPage's
    // share-sheet onShared handler. Together they let us chart
    // shown -> dismissed vs shown -> shared in PostHog.
    trackEvent("follow_up_card_dismissed", {
      todayShareCount: todayShareCount ?? null,
    });
    onDismiss();
  };

  return (
    <Card
      className="border border-primary/15 bg-primary/5 dark:bg-primary/10 shadow-sm relative"
      data-testid="card-follow-up"
    >
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute top-2 right-2 h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background/60 transition-colors"
        aria-label="Dismiss follow-up suggestion"
        data-testid="button-follow-up-dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <CardContent className="p-4 pr-10">
        <p
          className="font-semibold text-foreground text-sm"
          data-testid="text-follow-up-title"
        >
          Increase your chances — send a follow-up
        </p>
        <p
          className="text-xs text-muted-foreground mt-1"
          data-testid="text-follow-up-subtitle"
        >
          A second nudge to people you've already messaged often makes the difference.
        </p>
        <Button
          size="sm"
          className="mt-3"
          onClick={onSendFollowUp}
          data-testid="button-follow-up-send"
        >
          <Send className="h-3.5 w-3.5 mr-1.5" />
          Send Follow-Up
        </Button>
      </CardContent>
    </Card>
  );
}
