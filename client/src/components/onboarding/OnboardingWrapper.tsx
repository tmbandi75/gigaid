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

function isAllowedRoute(path: string): boolean {
  return ALLOWED_ROUTES_FOR_INCOMPLETE.some(route => path.startsWith(route));
}

export function OnboardingWrapper({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();

  const { data: onboarding, isLoading } = useQuery<OnboardingStatus>({
    queryKey: ["/api/onboarding"],
  });

  useEffect(() => {
    // Skip if still loading onboarding status
    if (isLoading) return;
    // Skip if on an allowed route
    if (isAllowedRoute(location)) return;
    
    // Redirect incomplete users to onboarding
    if (onboarding && !onboarding.completed) {
      navigate("/onboarding");
    }
  }, [isLoading, onboarding, location, navigate]);

  // Show loading while checking onboarding status
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Block rendering for incomplete users not on allowed routes (redirect is pending)
  if (onboarding && !onboarding.completed && !isAllowedRoute(location)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return <>{children}</>;
}
