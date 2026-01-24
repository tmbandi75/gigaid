import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Lock } from "lucide-react";

interface ExploreGatePromptProps {
  title: string;
  description: string;
  actionLabel?: string;
  targetStep?: number;
  onSetup?: () => void;
}

export function ExploreGatePrompt({
  title,
  description,
  actionLabel = "Quick setup (30 sec)",
  targetStep,
  onSetup,
}: ExploreGatePromptProps) {
  const [, navigate] = useLocation();

  const handleSetup = () => {
    if (onSetup) {
      onSetup();
    } else {
      navigate(`/onboarding${targetStep ? `?step=${targetStep}` : ""}`);
    }
  };

  return (
    <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
      <CardContent className="p-4 flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Lock className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 space-y-2">
          <p className="font-medium text-foreground">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
          <Button
            size="sm"
            className="mt-2"
            onClick={handleSetup}
            data-testid="button-explore-gate-setup"
          >
            {actionLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function useExploreMode() {
  return {
    isExploreMode: (onboardingState?: string | null) => 
      onboardingState === "skipped_explore",
    isMoneyProtectionReady: (user?: {
      defaultServiceType?: string | null;
      defaultPrice?: number | null;
      depositPolicySet?: boolean | null;
    }) => !!(
      user?.defaultServiceType &&
      typeof user?.defaultPrice === "number" && user.defaultPrice > 0 &&
      user?.depositPolicySet
    ),
  };
}
