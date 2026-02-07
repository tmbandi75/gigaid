import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TrendingUp, Zap, Users } from "lucide-react";
import { useLocation } from "wouter";
import { trackEvent } from "@/components/PostHogProvider";
import type { UpgradeVariant, UpgradeTriggerType, UpgradeSurface } from "./upgradeTypes";
import type { NewCapability } from "@/hooks/useCapability";
import type { SubscriptionPlan } from "@/lib/stripeCheckout";

interface UpgradeNudgeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle: string;
  bullets: string[];
  primaryCta: string;
  secondaryCta: string;
  variant: UpgradeVariant;
  triggerType: UpgradeTriggerType;
  capabilityKey: NewCapability;
  surface: UpgradeSurface;
  plan: string;
  current?: number;
  limit?: number;
  remaining?: number;
  recommendedPlan: SubscriptionPlan;
}

const VARIANT_ICONS: Record<UpgradeVariant, typeof TrendingUp> = {
  roi: TrendingUp,
  time: Zap,
  social: Users,
};

export function UpgradeNudgeModal({
  open,
  onOpenChange,
  title,
  subtitle,
  bullets,
  primaryCta,
  secondaryCta,
  variant,
  triggerType,
  capabilityKey,
  surface,
  plan,
  current,
  limit,
  remaining,
  recommendedPlan,
}: UpgradeNudgeModalProps) {
  const [, navigate] = useLocation();
  const Icon = VARIANT_ICONS[variant];
  const percentUsed = limit && limit > 0 ? Math.round(((current || 0) / limit) * 100) : 0;

  const trackProps = {
    triggerType,
    capabilityKey,
    variant,
    surface,
    plan,
    remaining,
    limit,
    percentUsed,
    recommendedPlan,
  };

  const handleUpgrade = () => {
    trackEvent("upgrade_cta_clicked", trackProps);
    trackEvent("upgrade_checkout_started", trackProps);
    onOpenChange(false);
    navigate(`/pricing?recommended=${recommendedPlan}`);
  };

  const handleDismiss = () => {
    trackEvent("upgrade_prompt_dismissed", trackProps);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" data-testid={`upgrade-nudge-modal-${triggerType}`}>
        <DialogHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center" data-testid="text-upgrade-nudge-title">
            {title}
          </DialogTitle>
          <DialogDescription className="text-center" data-testid="text-upgrade-nudge-subtitle">
            {subtitle}
          </DialogDescription>
        </DialogHeader>

        {bullets.length > 0 && (
          <ul className="space-y-2 my-2 px-1" data-testid="list-upgrade-bullets">
            {bullets.map((bullet, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <div className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        )}

        {limit !== undefined && limit > 0 && (
          <div className="my-2 px-1">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>{current || 0} / {limit} used</span>
              {remaining !== undefined && <span>{remaining} left</span>}
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  percentUsed >= 95 ? "bg-destructive" : percentUsed >= 80 ? "bg-amber-500" : "bg-primary"
                }`}
                style={{ width: `${Math.min(percentUsed, 100)}%` }}
              />
            </div>
          </div>
        )}

        <DialogFooter className="flex flex-col gap-2 sm:flex-col">
          <Button
            onClick={handleUpgrade}
            className="w-full"
            data-testid="button-upgrade-nudge-cta"
          >
            {primaryCta}
          </Button>
          <Button
            variant="ghost"
            onClick={handleDismiss}
            className="w-full"
            data-testid="button-upgrade-nudge-dismiss"
          >
            {secondaryCta}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
