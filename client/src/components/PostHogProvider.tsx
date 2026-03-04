import { useEffect, useState } from "react";
import posthog from "posthog-js";
import { useQuery } from "@tanstack/react-query";
import { getAnalyticsConsent } from "@/lib/consent/analyticsConsent";
import { initAnalyticsSafely, isAnalyticsInitialized } from "@/lib/analytics/initAnalytics";
import { AnalyticsConsentModal } from "@/components/AnalyticsConsentModal";
import type { AnalyticsProfile } from "@/lib/att/attManager";
import { getQueryFn } from "@/lib/queryClient";

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_API_KEY;

const PII_BLOCKED_KEYS = [
  "email", "phone", "mobile", "address", "token", "uid",
  "authorization", "bearer", "firebase", "zipcode", "ssn",
  "password", "secret", "personalphone", "clientphone", "clientemail",
];

function stripPII(properties?: Record<string, unknown>): Record<string, unknown> {
  if (!properties) return {};
  const clean: Record<string, unknown> = {};
  for (const k in properties) {
    if (!PII_BLOCKED_KEYS.some(b => k.toLowerCase().includes(b))) {
      clean[k] = properties[k];
    }
  }
  return clean;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const [showConsent, setShowConsent] = useState(false);

  const profileQuery = useQuery<any>({
    queryKey: ["/api/profile"],
    queryFn: getQueryFn({ on401: "returnNull" }),
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
    posthog.identify(userId, stripPII(properties));
  }
}

export function trackEvent(eventName: string, properties?: Record<string, unknown>) {
  if (POSTHOG_KEY && isAnalyticsInitialized()) {
    posthog.capture(eventName, stripPII(properties));
  }
}

export { posthog };
