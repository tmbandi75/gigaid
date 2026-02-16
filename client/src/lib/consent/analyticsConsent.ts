const CONSENT_KEY = "gigaid_analytics_consent";

export type AnalyticsConsentValue = "granted" | "denied" | null;

export function getAnalyticsConsent(): AnalyticsConsentValue {
  const value = localStorage.getItem(CONSENT_KEY);
  if (value === "granted" || value === "denied") return value;
  return null;
}

export function setAnalyticsConsent(value: "granted" | "denied"): void {
  localStorage.setItem(CONSENT_KEY, value);
}

export function hasConsentedToAnalytics(): boolean {
  return getAnalyticsConsent() === "granted";
}
