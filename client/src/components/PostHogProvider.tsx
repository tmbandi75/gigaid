import { useEffect, useState } from "react";
import posthog from "posthog-js";
import { useQuery } from "@tanstack/react-query";
import { getAnalyticsConsent } from "@/lib/consent/analyticsConsent";
import { initAnalyticsSafely, isAnalyticsInitialized } from "@/lib/analytics/initAnalytics";
import { AnalyticsConsentModal } from "@/components/AnalyticsConsentModal";
import type { AnalyticsProfile } from "@/lib/att/attManager";

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_API_KEY;

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const [showConsent, setShowConsent] = useState(false);

  const profileQuery = useQuery<any>({
    queryKey: ["/api/profile"],
    retry: false,
    staleTime: 60_000,
  });

  useEffect(() => {
    const consent = getAnalyticsConsent();
    if (consent === null) {
      setShowConsent(true);
      return;
    }

    if (consent !== "granted") return;
    if (!profileQuery.data) return;

    const profile: AnalyticsProfile = {
      analyticsEnabled: profileQuery.data.analyticsEnabled ?? false,
      attStatus: profileQuery.data.attStatus ?? "unknown",
      attPromptedAt: profileQuery.data.attPromptedAt ?? null,
      analyticsDisabledReason: profileQuery.data.analyticsDisabledReason ?? null,
    };

    initAnalyticsSafely(profile);
  }, [profileQuery.data]);

  const handleConsentChoice = async (granted: boolean) => {
    setShowConsent(false);
    if (!granted) return;

    if (!profileQuery.data) return;

    const profile: AnalyticsProfile = {
      analyticsEnabled: profileQuery.data.analyticsEnabled ?? false,
      attStatus: profileQuery.data.attStatus ?? "unknown",
      attPromptedAt: profileQuery.data.attPromptedAt ?? null,
      analyticsDisabledReason: profileQuery.data.analyticsDisabledReason ?? null,
    };

    await initAnalyticsSafely(profile);
  };

  return (
    <>
      {showConsent && <AnalyticsConsentModal onChoice={handleConsentChoice} />}
      {children}
    </>
  );
}

export function identifyUser(userId: string, properties?: Record<string, unknown>) {
  if (POSTHOG_KEY && isAnalyticsInitialized()) {
    posthog.identify(userId, properties);
  }
}

export function trackEvent(eventName: string, properties?: Record<string, unknown>) {
  if (POSTHOG_KEY && isAnalyticsInitialized()) {
    posthog.capture(eventName, properties);
  }
}

export { posthog };
