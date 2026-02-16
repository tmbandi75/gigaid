import posthog from "posthog-js";
import { hasConsentedToAnalytics } from "@/lib/consent/analyticsConsent";
import { isIOS, isNativePlatform } from "@/lib/platform";
import { requestATT } from "@/lib/att/requestATT";

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_API_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com";

let analyticsInitialized = false;

export async function initAnalytics(): Promise<boolean> {
  if (analyticsInitialized) return true;

  if (!hasConsentedToAnalytics()) {
    console.log("[Analytics] No consent — skipping initialization");
    return false;
  }

  if (isNativePlatform() && isIOS()) {
    const attStatus = await requestATT();
    if (attStatus !== "authorized" && attStatus !== "not_required") {
      console.log("[Analytics] ATT not authorized:", attStatus, "— skipping initialization");
      return false;
    }
  }

  if (!POSTHOG_KEY) {
    console.log("[Analytics] No PostHog API key — skipping initialization");
    return false;
  }

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
  return true;
}

export function shutdownAnalytics(): void {
  if (analyticsInitialized && POSTHOG_KEY) {
    posthog.opt_out_capturing();
    console.log("[Analytics] Opted out of capturing");
  }
  analyticsInitialized = false;
}

export function isAnalyticsInitialized(): boolean {
  return analyticsInitialized;
}
