import { useEffect } from "react";
import posthog from "posthog-js";
import { useQuery } from "@tanstack/react-query";
import { getAnalyticsConsent, setAnalyticsConsent } from "@/lib/consent/analyticsConsent";
import { disableAnalytics, initAnalyticsSafely, isAnalyticsInitialized, persistAnalyticsPreferences } from "@/lib/analytics/initAnalytics";
import { getATTStatus, requestATT, isIOSNative, type AnalyticsProfile } from "@/lib/att/attManager";
import { getQueryFn } from "@/lib/queryClient";
import { logger } from "@/lib/logger";

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
  const profileQuery = useQuery<any>({
    queryKey: ["/api/profile"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!profileQuery.data) return;

    const runHomeConsent = async () => {
      const profile: AnalyticsProfile = {
        analyticsEnabled: profileQuery.data.analyticsEnabled ?? false,
        attStatus: profileQuery.data.attStatus ?? "unknown",
        attPromptedAt: profileQuery.data.attPromptedAt ?? null,
        analyticsDisabledReason: profileQuery.data.analyticsDisabledReason ?? null,
      };

      // Android/web: no ATT. Use in-app preference and backend profile only.
      if (!isIOSNative()) {
        if (getAnalyticsConsent() === null) {
          setAnalyticsConsent(profile.analyticsEnabled ? "granted" : "denied");
        }
        if (!profile.analyticsEnabled || getAnalyticsConsent() !== "granted") {
          disableAnalytics();
          return;
        }
        await initAnalyticsSafely(profile);
        return;
      }

      // iOS: in-app analytics toggle is the master switch. If the user turned it off in
      // Settings, do not re-enable analytics just because ATT is still authorized on device.
      if (!profile.analyticsEnabled) {
        if (getAnalyticsConsent() === null) {
          setAnalyticsConsent("denied");
        }
        disableAnalytics();
        return;
      }

      const liveStatus = await getATTStatus();
      const now = new Date().toISOString();
      logger.info("[ATT][Home] Live ATT status:", liveStatus);

      if (liveStatus === "not_determined" || liveStatus === "unknown") {
        logger.info("[ATT][Home] Requesting ATT permission dialog");
        const result = await requestATT();
        logger.info("[ATT][Home] ATT request result:", result);
        if (result === "authorized") {
          setAnalyticsConsent("granted");
          await persistAnalyticsPreferences({
            analyticsEnabled: true,
            attStatus: "authorized",
            attPromptedAt: now,
            analyticsDisabledReason: null,
          });
          await initAnalyticsSafely({
            ...profile,
            analyticsEnabled: true,
            attStatus: "authorized",
            attPromptedAt: now,
            analyticsDisabledReason: null,
          });
          return;
        }

        setAnalyticsConsent("denied");
        disableAnalytics();
        await persistAnalyticsPreferences({
          analyticsEnabled: false,
          attStatus: result === "unavailable" ? "unavailable" : result,
          attPromptedAt: now,
          analyticsDisabledReason:
            result === "denied" ? "att_denied" :
            result === "restricted" ? "restricted" : "not_supported",
        });
        return;
      }

      if (liveStatus === "authorized") {
        logger.info("[ATT][Home] ATT already authorized");
        setAnalyticsConsent("granted");
        await persistAnalyticsPreferences({
          analyticsEnabled: true,
          attStatus: "authorized",
          analyticsDisabledReason: null,
        });
        await initAnalyticsSafely({
          ...profile,
          analyticsEnabled: true,
          attStatus: "authorized",
          analyticsDisabledReason: null,
        });
        return;
      }

      setAnalyticsConsent("denied");
      disableAnalytics();
      logger.info("[ATT][Home] ATT not authorized path:", liveStatus);
      await persistAnalyticsPreferences({
        analyticsEnabled: false,
        attStatus: liveStatus,
        analyticsDisabledReason: liveStatus === "restricted" ? "restricted" : "att_denied",
      });
    };

    void runHomeConsent();
  }, [profileQuery.data]);

  return <>{children}</>;
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
