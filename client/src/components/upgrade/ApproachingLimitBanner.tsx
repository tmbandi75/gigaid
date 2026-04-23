import { useEffect, useState } from "react";
import { AlertTriangle, TrendingUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useApproachingLimit } from "@/hooks/useApproachingLimit";
import type { NewCapability } from "@/hooks/useCapability";
import { trackEvent } from "@/components/PostHogProvider";

interface ApproachingLimitBannerProps {
  capability: NewCapability;
  className?: string;
  compact?: boolean;
  source?: string;
}

const DISMISS_KEY_PREFIX = "gigaid:limit-banner-dismissed";

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function getDismissKey(capability: NewCapability, tier: string) {
  return `${DISMISS_KEY_PREFIX}:${capability}:${tier}:${currentMonthKey()}`;
}

function pruneStaleDismissKeys() {
  if (typeof window === "undefined") return;
  try {
    const keep = `:${currentMonthKey()}`;
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(DISMISS_KEY_PREFIX) && !key.endsWith(keep)) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // ignore
  }
}

export function ApproachingLimitBanner({
  capability,
  className = "",
  compact = false,
  source,
}: ApproachingLimitBannerProps) {
  const [, navigate] = useLocation();
  const { isApproaching, isAtLimit, tier, message, loading, percentage } =
    useApproachingLimit(capability);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!tier) {
      setDismissed(false);
      return;
    }
    if (typeof window === "undefined") return;
    try {
      pruneStaleDismissKeys();
      setDismissed(window.localStorage.getItem(getDismissKey(capability, tier)) === "1");
    } catch {
      setDismissed(false);
    }
  }, [capability, tier]);

  if (loading || (!isApproaching && !isAtLimit) || !tier) {
    return null;
  }

  if (dismissed) {
    return null;
  }

  const fromParam = `quota_${tier === "limit" ? 100 : 80}`;
  const sourceQs = source ? `&source=${encodeURIComponent(source)}` : "";
  const upgradeHref = `/pricing?from=${fromParam}&capability=${encodeURIComponent(
    capability,
  )}${sourceQs}`;

  const handleUpgrade = () => {
    trackEvent("approaching_limit_clicked", {
      capability,
      tier,
      source: source ?? null,
    });
    navigate(upgradeHref);
  };

  const handleDismiss = () => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(getDismissKey(capability, tier), "1");
      } catch {
        // ignore storage failure
      }
    }
    setDismissed(true);
    trackEvent("approaching_limit_dismissed", {
      capability,
      tier,
      source: source ?? null,
    });
  };

  const testIdSuffix = capability.replace(/\./g, "-");

  if (compact) {
    return (
      <div
        className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-md ${
          isAtLimit
            ? "bg-destructive/10 text-destructive"
            : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
        } ${className}`}
        data-testid={`banner-limit-${testIdSuffix}`}
        role="status"
      >
        {isAtLimit ? (
          <AlertTriangle className="h-3 w-3 shrink-0" />
        ) : (
          <TrendingUp className="h-3 w-3 shrink-0" />
        )}
        <span className="flex-1">{message}</span>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs"
          onClick={handleUpgrade}
          data-testid={`button-upgrade-limit-${testIdSuffix}`}
        >
          Upgrade
        </Button>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="text-current opacity-70 hover:opacity-100"
          data-testid={`button-dismiss-limit-${testIdSuffix}`}
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-md border ${
        isAtLimit
          ? "bg-destructive/5 border-destructive/20"
          : "bg-amber-500/5 border-amber-500/20"
      } ${className}`}
      data-testid={`banner-limit-${testIdSuffix}`}
      role="status"
    >
      <div
        className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
          isAtLimit ? "bg-destructive/10" : "bg-amber-500/10"
        }`}
      >
        {isAtLimit ? (
          <AlertTriangle className="h-4 w-4 text-destructive" />
        ) : (
          <TrendingUp className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium ${
            isAtLimit ? "text-destructive" : "text-foreground"
          }`}
          data-testid={`text-limit-message-${testIdSuffix}`}
        >
          {message}
        </p>
        {!isAtLimit && (
          <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all"
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          size="sm"
          onClick={handleUpgrade}
          data-testid={`button-upgrade-limit-${testIdSuffix}`}
        >
          Upgrade
        </Button>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
          data-testid={`button-dismiss-limit-${testIdSuffix}`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
