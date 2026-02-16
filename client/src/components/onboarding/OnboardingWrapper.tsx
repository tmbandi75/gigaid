import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { logger } from "@/lib/logger";

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
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const { isTokenReady, tokenPending } = useAuth();

  // Only enable query when token is ready - prevents 401 errors
  const { data: onboarding, isLoading, isError } = useQuery<OnboardingStatus>({
    queryKey: QUERY_KEYS.onboarding(),
    retry: 1,
    enabled: isTokenReady,
  });

  // Timeout to prevent indefinite loading state
  // Only start timeout if token is pending (auth in progress)
  useEffect(() => {
    if ((isLoading || tokenPending) && !loadingTimeout) {
      const timer = setTimeout(() => {
        logger.debug("[OnboardingWrapper] Loading timeout reached - proceeding without onboarding check");
        setLoadingTimeout(true);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isLoading, tokenPending, loadingTimeout]);

  const onboardingComplete = isOnboardingComplete(onboarding);
  
  // Consider "effectively loaded" if:
  // 1. Query completed (loaded or errored), OR
  // 2. Timeout reached (prevents indefinite block), OR
  // 3. Token not ready but timeout passed (auth issues - let user see app)
  const effectivelyLoaded = (!isLoading && isTokenReady) || loadingTimeout || isError;

  useEffect(() => {
    // Skip if still loading onboarding status
    if (!effectivelyLoaded) return;
    // Skip if on an allowed route
    if (isAllowedRoute(location)) return;
    
    // Redirect incomplete users to onboarding (only if we got valid data)
    if (onboarding && !onboardingComplete) {
      navigate("/onboarding");
    }
  }, [effectivelyLoaded, onboarding, onboardingComplete, location, navigate]);

  // Show loading while checking onboarding status (with timeout protection)
  if (!effectivelyLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Block rendering for incomplete users not on allowed routes (redirect is pending)
  // Only block if we have valid data and haven't timed out
  if (onboarding && !onboardingComplete && !isAllowedRoute(location) && !loadingTimeout) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return <>{children}</>;
}
