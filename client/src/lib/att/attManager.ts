import { isIOS, isNativePlatform } from "@/lib/platform";
import { logger } from "@/lib/logger";

export type ATTStatus = "authorized" | "denied" | "restricted" | "not_determined" | "unavailable" | "unknown";

export interface AnalyticsProfile {
  analyticsEnabled: boolean;
  attStatus: string;
  attPromptedAt: string | null;
  analyticsDisabledReason: string | null;
}

export function isIOSNative(): boolean {
  return isNativePlatform() && isIOS();
}

export function normalizeATTStatus(status: string | null | undefined): ATTStatus {
  switch (status) {
    case "authorized": return "authorized";
    case "denied": return "denied";
    case "restricted": return "restricted";
    case "not_determined": return "not_determined";
    case "notDetermined": return "not_determined";
    case "unknown": return "unknown";
    default: return "unavailable";
  }
}

export async function getATTStatus(): Promise<ATTStatus> {
  if (!isIOSNative()) {
    return "unavailable";
  }

  try {
    const mod = await import(
      /* @vite-ignore */
      "capacitor-plugin-app-tracking-transparency"
    );
    const AppTrackingTransparency = mod.AppTrackingTransparency;
    const { status } = await AppTrackingTransparency.getStatus();
    return normalizeATTStatus(status);
  } catch (err) {
    logger.warn("[ATT] Plugin not available:", err);
    return "unavailable";
  }
}

export async function requestATT(): Promise<ATTStatus> {
  if (!isIOSNative()) {
    return "unavailable";
  }

  const current = await getATTStatus();
  if (current === "denied" || current === "restricted" || current === "authorized") {
    return current;
  }
  if (current !== "unknown" && current !== "not_determined") {
    return current;
  }

  try {
    const mod = await import(
      /* @vite-ignore */
      "capacitor-plugin-app-tracking-transparency"
    );
    const AppTrackingTransparency = mod.AppTrackingTransparency;
    const { status } = await AppTrackingTransparency.requestPermission();
    return normalizeATTStatus(status);
  } catch (err) {
    logger.warn("[ATT] Plugin not available or error:", err);
    return "unavailable";
  }
}

export function shouldAutoRequestATT(profile: AnalyticsProfile): boolean {
  if (!isIOSNative()) return false;
  if (profile.analyticsEnabled !== true) return false;
  if (profile.attStatus === "denied" || profile.attStatus === "restricted") return false;
  if (profile.attStatus === "authorized") return false;
  if (profile.attPromptedAt !== null && profile.attStatus !== "not_determined" && profile.attStatus !== "unknown") return false;
  return profile.attStatus === "unknown" || profile.attStatus === "not_determined";
}

export async function requestATTIfAllowed(profile: AnalyticsProfile): Promise<ATTStatus> {
  if (!shouldAutoRequestATT(profile)) {
    if (!isIOSNative()) return "unavailable";
    return getATTStatus();
  }
  return requestATT();
}

export function canUserInitiatedRePrompt(profile: AnalyticsProfile): boolean {
  if (!isIOSNative()) return false;
  return profile.attStatus === "unknown" || profile.attStatus === "not_determined";
}

export async function requestATTUserInitiated(profile: AnalyticsProfile): Promise<ATTStatus> {
  if (!isIOSNative()) return "unavailable";
  const liveStatus = await getATTStatus();
  if (liveStatus === "denied" || liveStatus === "restricted" || liveStatus === "authorized") {
    return liveStatus;
  }
  if (liveStatus === "unknown" || liveStatus === "not_determined") {
    return requestATT();
  }
  if (profile.attStatus === "denied" || profile.attStatus === "restricted") {
    return normalizeATTStatus(profile.attStatus);
  }
  return liveStatus;
}
