import posthog from "posthog-js";
import { isIOSNative, requestATTIfAllowed, type AnalyticsProfile } from "@/lib/att/attManager";
import { getAuthToken } from "@/lib/authToken";

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_API_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com";

let analyticsInitialized = false;

const PII_BLOCKED_KEYS = [
  "email", "phone", "mobile", "address", "token", "uid",
  "authorization", "bearer", "firebase", "zipcode", "ssn",
  "personalphone", "clientphone", "clientemail", "phonee164",
  "emailnormalized", "firebaseuid", "password", "secret",
];

function sanitizeProperties(props: Record<string, any>): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const k in props) {
    if (!PII_BLOCKED_KEYS.some(b => k.toLowerCase().includes(b))) {
      clean[k] = props[k];
    }
  }
  return clean;
}

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
  } catch {
    // pii-safe
  }
}

function doInit(): void {
  if (analyticsInitialized || !POSTHOG_KEY) return;
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    person_profiles: "identified_only",

    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    disable_session_recording: true,
    disable_surveys: true,

    mask_all_text: true,
    mask_all_element_attributes: true,

    sanitize_properties: sanitizeProperties,
  });
  posthog.opt_in_capturing();
  analyticsInitialized = true;
}

export async function initAnalyticsSafely(profile: AnalyticsProfile): Promise<boolean> {
  if (analyticsInitialized) return true;

  if (profile.analyticsEnabled !== true) {
    return false;
  }

  if (!POSTHOG_KEY) {
    return false;
  }

  if (isIOSNative()) {
    if (profile.attStatus === "authorized") {
      doInit();
      return true;
    }

    if (profile.attStatus === "denied" || profile.attStatus === "restricted") {
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
      return false;
    }

    return false;
  }

  doInit();
  return true;
}

export function disableAnalytics(): void {
  if (analyticsInitialized && POSTHOG_KEY) {
    posthog.opt_out_capturing();
  }
  analyticsInitialized = false;
}

export function isAnalyticsInitialized(): boolean {
  return analyticsInitialized;
}
