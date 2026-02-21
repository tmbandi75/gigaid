import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { useLocation } from "wouter";
import { Target, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isScreenshotMode } from "@/lib/screenshotMode";

const LS_KEY_DISMISSED_AT = "activation_nudge_dismissed_at";
const LS_KEY_DISMISSED_PROGRESS = "activation_nudge_dismissed_progress";
const DISMISS_DURATION_MS = 24 * 60 * 60 * 1000;

function readDismissState(): { dismissedAt: number | null; dismissedProgress: number | null } {
  try {
    const at = localStorage.getItem(LS_KEY_DISMISSED_AT);
    const progress = localStorage.getItem(LS_KEY_DISMISSED_PROGRESS);
    return {
      dismissedAt: at ? Number(at) : null,
      dismissedProgress: progress ? Number(progress) : null,
    };
  } catch {
    return { dismissedAt: null, dismissedProgress: null };
  }
}

function writeDismissState(percentComplete: number) {
  try {
    localStorage.setItem(LS_KEY_DISMISSED_AT, String(Date.now()));
    localStorage.setItem(LS_KEY_DISMISSED_PROGRESS, String(percentComplete));
  } catch {
  }
}

function clearDismissState() {
  try {
    localStorage.removeItem(LS_KEY_DISMISSED_AT);
    localStorage.removeItem(LS_KEY_DISMISSED_PROGRESS);
  } catch {
  }
}

interface ActivationStatus {
  servicesDone: boolean;
  pricingDone: boolean;
  paymentsDone: boolean;
  linkDone: boolean;
  quoteDone: boolean;
  completedAt: string | null;
  completedSteps: number;
  totalSteps: number;
  percentComplete: number;
  isFullyActivated: boolean;
  disabled?: boolean;
}

export function FirstDollarBanner() {
  const [location, navigate] = useLocation();
  const [dismissed, setDismissed] = useState(false);

  if (isScreenshotMode) return null;

  const { data: activation, isLoading } = useQuery<ActivationStatus>({
    queryKey: QUERY_KEYS.activation(),
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (!activation) return;

    const { dismissedAt, dismissedProgress } = readDismissState();

    if (dismissedAt === null) {
      setDismissed(false);
      return;
    }

    if (dismissedProgress !== null && activation.percentComplete > dismissedProgress) {
      clearDismissState();
      setDismissed(false);
      return;
    }

    const elapsed = Date.now() - dismissedAt;
    if (elapsed < DISMISS_DURATION_MS) {
      setDismissed(true);
    } else {
      clearDismissState();
      setDismissed(false);
    }
  }, [activation?.percentComplete]);

  const handleDismiss = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (activation) {
        writeDismissState(activation.percentComplete);
      }
      setDismissed(true);
    },
    [activation],
  );

  if (isLoading || !activation) return null;
  if (activation.disabled) return null;
  if (location === "/onboarding") return null;

  if (activation.isFullyActivated) {
    const completedAt = activation.completedAt
      ? new Date(activation.completedAt)
      : null;
    const showCompletedBanner =
      completedAt &&
      Date.now() - completedAt.getTime() < 7 * 24 * 60 * 60 * 1000;

    if (!showCompletedBanner) return null;

    if (dismissed) return null;

    return (
      <div
        className="relative flex items-center justify-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-sm"
        data-testid="banner-activation-complete"
      >
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span className="font-medium">You're Live — Start Getting Paid</span>
        <Button
          size="icon"
          variant="ghost"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 text-emerald-600 dark:text-emerald-400"
          onClick={handleDismiss}
          aria-label="Dismiss activation banner"
          data-testid="button-dismiss-activation-complete"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  if (dismissed) return null;

  return (
    <div className="relative" data-testid="banner-first-dollar-wrapper">
      <button
        onClick={() => navigate("/")}
        className="flex items-center justify-center gap-2 w-full px-4 pr-10 py-2 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 text-sm hover-elevate"
        data-testid="banner-first-dollar"
      >
        <Target className="h-4 w-4 shrink-0" />
        <span className="font-medium">
          Get Your First Paid Booking in 24 Hours
        </span>
        <span className="hidden sm:inline text-blue-500 dark:text-blue-400">
          — Complete setup to unlock clients
        </span>
      </button>
      <Button
        size="icon"
        variant="ghost"
        className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 text-blue-600 dark:text-blue-400"
        onClick={handleDismiss}
        aria-label="Dismiss activation banner"
        data-testid="button-dismiss-first-dollar"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
