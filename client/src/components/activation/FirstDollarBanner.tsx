import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { useLocation } from "wouter";
import { Target, CheckCircle2 } from "lucide-react";

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

  const { data: activation, isLoading } = useQuery<ActivationStatus>({
    queryKey: QUERY_KEYS.activation(),
    refetchInterval: 30000,
  });

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

    return (
      <div
        className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-sm"
        data-testid="banner-activation-complete"
      >
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span className="font-medium">You're Live — Start Getting Paid</span>
      </div>
    );
  }

  return (
    <button
      onClick={() => navigate("/")}
      className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 text-sm hover-elevate"
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
  );
}
