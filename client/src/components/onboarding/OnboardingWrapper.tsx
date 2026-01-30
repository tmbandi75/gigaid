import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect } from "react";

interface OnboardingStatus {
  completed: boolean;
  step: number;
  state?: string;
}

// Routes that incomplete onboarding users can still access
const ALLOWED_ROUTES_FOR_INCOMPLETE = [
  "/onboarding",
  "/login",
  "/logout",
  "/pricing",
  "/downloads",
];

// States that indicate onboarding is effectively complete
const COMPLETED_STATES = ["completed", "skipped_explore"];

function isAllowedRoute(path: string): boolean {
  return ALLOWED_ROUTES_FOR_INCOMPLETE.some(route => path.startsWith(route));
}

// Check if onboarding should be considered complete
// Either the completed flag is true, or the user has a completion state
function isOnboardingComplete(onboarding: OnboardingStatus | undefined): boolean {
  if (!onboarding) return false;
  if (onboarding.completed) return true;
  if (onboarding.state && COMPLETED_STATES.includes(onboarding.state)) return true;
  return false;
}

export function OnboardingWrapper({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();

  const { data: onboarding, isLoading } = useQuery<OnboardingStatus>({
    queryKey: ["/api/onboarding"],
  });

  const onboardingComplete = isOnboardingComplete(onboarding);

  useEffect(() => {
    // Skip if still loading onboarding status
    if (isLoading) return;
    // Skip if on an allowed route
    if (isAllowedRoute(location)) return;
    
    // Redirect incomplete users to onboarding
    if (onboarding && !onboardingComplete) {
      navigate("/onboarding");
    }
  }, [isLoading, onboarding, onboardingComplete, location, navigate]);

  // Show loading while checking onboarding status
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Block rendering for incomplete users not on allowed routes (redirect is pending)
  if (onboarding && !onboardingComplete && !isAllowedRoute(location)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return <>{children}</>;
}
