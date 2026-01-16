import { useQuery } from "@tanstack/react-query";
import { OnboardingFlow } from "./OnboardingFlow";
import { useState } from "react";

interface OnboardingStatus {
  completed: boolean;
  step: number;
}

export function OnboardingWrapper({ children }: { children: React.ReactNode }) {
  const [dismissed, setDismissed] = useState(false);

  const { data: onboarding, isLoading } = useQuery<OnboardingStatus>({
    queryKey: ["/api/onboarding"],
  });

  if (isLoading) {
    return <>{children}</>;
  }

  if (!onboarding || onboarding.completed || dismissed) {
    return <>{children}</>;
  }

  return <OnboardingFlow onComplete={() => setDismissed(true)} />;
}
