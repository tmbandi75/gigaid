import { AlertTriangle, TrendingUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import type { NewCapability } from "@/hooks/useCapability";
import type { UpgradeVariant, UpgradeThresholdLevel } from "./upgradeTypes";
import { getCopy } from "./upgradeCopy";
import { isDismissed, setDismissed } from "./upgradeState";
import { useState } from "react";
import { trackEvent } from "@/components/PostHogProvider";
import type { SubscriptionPlan } from "@/lib/stripeCheckout";

interface UpgradeBannerProps {
  capabilityKey: NewCapability;
  remaining: number | undefined;
  limit: number | undefined;
  current: number;
  variant: UpgradeVariant;
  thresholdLevel: UpgradeThresholdLevel;
  surface: string;
  plan: string;
  recommendedPlan: SubscriptionPlan;
  userId?: string;
}

export function UpgradeBanner({
  capabilityKey,
  remaining,
  limit,
  current,
  variant,
  thresholdLevel,
  surface,
  plan,
  recommendedPlan,
  userId = "default",
}: UpgradeBannerProps) {
  const [, navigate] = useLocation();
  const [dismissed, setLocalDismissed] = useState(() => isDismissed(userId, capabilityKey));

  if (dismissed) return null;

  const copy = getCopy(capabilityKey, variant, "approaching_limit");
  const percentUsed = limit && limit > 0 ? Math.round((current / limit) * 100) : 0;

  const isWarn = thresholdLevel === "warn" || thresholdLevel === "critical";

  const handleDismiss = () => {
    setDismissed(userId, capabilityKey);
    setLocalDismissed(true);
    trackEvent("upgrade_prompt_dismissed", {
      triggerType: "approaching_limit",
      capabilityKey,
      variant,
      surface,
      plan,
      remaining,
      limit,
      percentUsed,
      thresholdLevel,
    });
  };

  const handleUpgrade = () => {
    trackEvent("upgrade_cta_clicked", {
      triggerType: "approaching_limit",
      capabilityKey,
      variant,
      surface,
      plan,
      remaining,
      limit,
      percentUsed,
      recommendedPlan,
    });
    navigate(`/pricing?recommended=${recommendedPlan}`);
  };

  return (
    <div
      className={`relative flex items-center gap-3 p-3 rounded-md border ${
        isWarn
          ? "bg-amber-500/5 border-amber-500/20"
          : "bg-blue-500/5 border-blue-500/20"
      }`}
      data-testid={`upgrade-banner-${capabilityKey.replace(/\./g, "-")}`}
    >
      <div className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
        isWarn ? "bg-amber-500/10" : "bg-blue-500/10"
      }`}>
        {isWarn ? (
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        ) : (
          <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{copy.subtitle}</p>
        {limit !== undefined && limit > 0 && (
          <div className="mt-1.5">
            <div className="flex justify-between text-xs text-muted-foreground mb-0.5">
              <span>{current} / {limit} used</span>
              {remaining !== undefined && <span>{remaining} left</span>}
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  percentUsed >= 95 ? "bg-destructive" : percentUsed >= 80 ? "bg-amber-500" : "bg-blue-500"
                }`}
                style={{ width: `${Math.min(percentUsed, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>
      <Button
        size="sm"
        onClick={handleUpgrade}
        data-testid={`button-upgrade-banner-${capabilityKey.replace(/\./g, "-")}`}
      >
        {copy.primaryCta}
      </Button>
      <button
        onClick={handleDismiss}
        className="absolute top-1 right-1 p-1 rounded-md text-muted-foreground/60 hover-elevate"
        data-testid={`button-dismiss-banner-${capabilityKey.replace(/\./g, "-")}`}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
