import { useEffect, useState } from "react";
import posthog from "posthog-js";
import { getAnalyticsConsent } from "@/lib/consent/analyticsConsent";
import { initAnalytics } from "@/lib/analytics/initAnalytics";
import { AnalyticsConsentModal } from "@/components/AnalyticsConsentModal";

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_API_KEY;

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const [showConsent, setShowConsent] = useState(false);

  useEffect(() => {
    const consent = getAnalyticsConsent();
    if (consent === null) {
      setShowConsent(true);
    } else if (consent === "granted") {
      initAnalytics();
    }
  }, []);

  const handleConsentChoice = (granted: boolean) => {
    setShowConsent(false);
    if (granted) {
      initAnalytics();
    }
  };

  return (
    <>
      {showConsent && <AnalyticsConsentModal onChoice={handleConsentChoice} />}
      {children}
    </>
  );
}

export function identifyUser(userId: string, properties?: Record<string, unknown>) {
  if (POSTHOG_KEY && getAnalyticsConsent() === "granted") {
    posthog.identify(userId, properties);
  }
}

export function trackEvent(eventName: string, properties?: Record<string, unknown>) {
  if (POSTHOG_KEY && getAnalyticsConsent() === "granted") {
    posthog.capture(eventName, properties);
  }
}

export { posthog };
