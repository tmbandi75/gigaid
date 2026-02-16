import posthog from "posthog-js";
import { isIOSNative, requestATTIfAllowed, type AnalyticsProfile } from "@/lib/att/attManager";
import { getAuthToken } from "@/lib/authToken";

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_API_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com";

let analyticsInitialized = false;

export async function persistAnalyticsPreferences(prefs: Partial<AnalyticsProfile>): Promise<void> {
  try {
    const token = getAuthToken();
    if (!token) return;
    await fetch("/api/profile/analytics-preferences", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(prefs),
    });
  } catch (err) {
    console.warn("[Analytics] Failed to persist preferences:", err);
  }
}

function doInit(): void {
  if (analyticsInitialized || !POSTHOG_KEY) return;
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    person_profiles: "identified_only",
    capture_pageview: true,
    capture_pageleave: true,
    disable_surveys: true,
  });
  posthog.opt_in_capturing();
  analyticsInitialized = true;
  console.log("[Analytics] Initialized successfully");
}

export async function initAnalyticsSafely(profile: AnalyticsProfile): Promise<boolean> {
  if (analyticsInitialized) return true;

  if (profile.analyticsEnabled !== true) {
    console.log("[Analytics] analytics_enabled=false — skipping");
    return false;
  }

  if (!POSTHOG_KEY) {
    console.log("[Analytics] No PostHog API key — skipping");
    return false;
  }

  if (isIOSNative()) {
    if (profile.attStatus === "authorized") {
      doInit();
      return true;
    }

    if (profile.attStatus === "denied" || profile.attStatus === "restricted") {
      console.log("[Analytics] ATT previously", profile.attStatus, "— not prompting, analytics disabled");
      return false;
    }

    if (profile.attStatus === "unknown" || profile.attStatus === "not_determined") {
      const result = await requestATTIfAllowed(profile);
      const now = new Date().toISOString();

      if (result === "authorized") {
        await persistAnalyticsPreferences({
          attStatus: "authorized",
          attPromptedAt: now,
          analyticsDisabledReason: null,
        });
        doInit();
        return true;
      }

      const reason = result === "denied" ? "att_denied" : result === "restricted" ? "restricted" : "not_supported";
      await persistAnalyticsPreferences({
        attStatus: result === "unavailable" ? "unavailable" : result,
        attPromptedAt: now,
        analyticsEnabled: false,
        analyticsDisabledReason: reason,
      });
      console.log("[Analytics] ATT result:", result, "— analytics disabled, reason:", reason);
      return false;
    }

    console.log("[Analytics] Unhandled ATT state for iOS — fail closed");
    return false;
  }

  doInit();
  return true;
}

export function disableAnalytics(): void {
  if (analyticsInitialized && POSTHOG_KEY) {
    posthog.opt_out_capturing();
    console.log("[Analytics] Opted out of capturing");
  }
  analyticsInitialized = false;
}

export function isAnalyticsInitialized(): boolean {
  return analyticsInitialized;
}
