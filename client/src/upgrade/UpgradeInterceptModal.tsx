import { useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lock, Check } from "lucide-react";
import { useLocation } from "wouter";
import { trackEvent } from "@/components/PostHogProvider";
import { emitChurnEvent } from "@/lib/churnEvents";
import { getInterceptInfo } from "./upgradeInterceptConfig";
import type { NewCapability } from "@/hooks/useCapability";

interface UpgradeInterceptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureKey: NewCapability;
  featureName?: string;
}

export function UpgradeInterceptModal({
  open,
  onOpenChange,
  featureKey,
  featureName,
}: UpgradeInterceptModalProps) {
  const [, navigate] = useLocation();
  const info = getInterceptInfo(featureKey);
  const displayName = featureName || info.title;

  const handleUpgrade = useCallback(() => {
    trackEvent("upgrade_intercept_cta_clicked", {
      featureKey,
      featureName: displayName,
      recommendedPlan: info.recommendedPlan,
    });
    onOpenChange(false);
    navigate(`/pricing?recommended=${info.recommendedPlan}`);
  }, [featureKey, displayName, info.recommendedPlan, onOpenChange, navigate]);

  const handleDismiss = useCallback(() => {
    trackEvent("upgrade_intercept_dismissed", {
      featureKey,
      featureName: displayName,
    });
    emitChurnEvent("paywall_dismiss", { capability: featureKey });
    onOpenChange(false);
  }, [featureKey, displayName, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-sm"
        data-testid={`upgrade-intercept-modal-${featureKey}`}
      >
        <DialogHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center" data-testid="text-upgrade-intercept-title">
            {displayName}
          </DialogTitle>
          <DialogDescription className="text-center" data-testid="text-upgrade-intercept-description">
            {info.description}
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2.5 my-3 px-1" data-testid="list-upgrade-intercept-benefits">
          {info.benefits.map((benefit, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm">
              <div className="mt-0.5 h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Check className="h-3 w-3 text-primary" />
              </div>
              <span className="text-foreground">{benefit}</span>
            </li>
          ))}
        </ul>

        <DialogFooter className="flex flex-col gap-2 sm:flex-col">
          <Button
            onClick={handleUpgrade}
            className="w-full"
            data-testid="button-upgrade-intercept-cta"
          >
            Upgrade to Unlock
          </Button>
          <Button
            variant="ghost"
            onClick={handleDismiss}
            className="w-full"
            data-testid="button-upgrade-intercept-dismiss"
          >
            Not now
          </Button>
          <p className="text-[10px] text-muted-foreground text-center mt-1" data-testid="text-upgrade-intercept-disclosure">
            Payment is for business management tools, processed via Stripe.
            Manage billing at{" "}
            <a href="https://gigaid.ai/account" target="_blank" rel="noopener noreferrer" className="underline">gigaid.ai/account</a>.
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
