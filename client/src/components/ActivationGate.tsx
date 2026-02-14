import { useLocation } from "wouter";
import { useEffect } from "react";
import { useActivationState } from "@/hooks/useActivationState";
import { getActivationRoute } from "@/lib/isActivated";

export function ActivationGate({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { state, loading } = useActivationState();

  const routeInfo = state ? getActivationRoute(state) : null;

  useEffect(() => {
    if (loading || !state || !routeInfo) return;

    if (routeInfo.route === "onboarding" && !location.startsWith("/onboarding")) {
      setLocation("/onboarding");
    } else if (routeInfo.route === "payday-onboarding" && !location.startsWith("/payday-onboarding")) {
      const url = routeInfo.step != null
        ? `/payday-onboarding?startStep=${routeInfo.step}`
        : "/payday-onboarding";
      setLocation(url);
    }
  }, [loading, state, routeInfo, location, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (routeInfo && routeInfo.route === "onboarding" && !location.startsWith("/onboarding")) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (routeInfo && routeInfo.route === "payday-onboarding" && !location.startsWith("/payday-onboarding")) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return <>{children}</>;
}
