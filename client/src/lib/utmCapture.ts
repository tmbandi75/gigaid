import { logger } from "@/lib/logger";

const UTM_STORAGE_KEY = "gigaid_utm_data";
const UTM_TTL_DAYS = 14;

export interface UtmData {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  landingPath?: string;
  source?: string;
  referrerCode?: string;
  capturedAt: string;
}

export function captureUtmParams(): UtmData | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const data: UtmData = {
      capturedAt: new Date().toISOString(),
      landingPath: window.location.pathname,
    };

    let hasData = false;

    const utmSource = params.get("utm_source");
    const utmMedium = params.get("utm_medium");
    const utmCampaign = params.get("utm_campaign");
    const utmContent = params.get("utm_content");
    const utmTerm = params.get("utm_term");
    const ref = params.get("ref");
    const source = params.get("source");

    if (utmSource) { data.utmSource = utmSource; hasData = true; }
    if (utmMedium) { data.utmMedium = utmMedium; hasData = true; }
    if (utmCampaign) { data.utmCampaign = utmCampaign; hasData = true; }
    if (utmContent) { data.utmContent = utmContent; hasData = true; }
    if (utmTerm) { data.utmTerm = utmTerm; hasData = true; }
    if (ref) { data.referrerCode = ref; hasData = true; }
    if (source) { data.source = source; hasData = true; }

    if (!hasData && !window.location.pathname.startsWith("/book/") && !window.location.pathname.startsWith("/free-setup")) {
      return null;
    }

    if (!data.source) {
      if (window.location.pathname.startsWith("/book/")) {
        data.source = "booking_page";
      } else if (window.location.pathname === "/free-setup") {
        data.source = "free_setup";
      } else if (window.location.pathname === "/") {
        data.source = "homepage";
      }
    }

    localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(data));
    return data;
  } catch {
    return null;
  }
}

export function getStoredUtmData(): UtmData | null {
  try {
    const raw = localStorage.getItem(UTM_STORAGE_KEY);
    if (!raw) return null;

    const data: UtmData = JSON.parse(raw);

    const capturedAt = new Date(data.capturedAt);
    const now = new Date();
    const diffDays = (now.getTime() - capturedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > UTM_TTL_DAYS) {
      localStorage.removeItem(UTM_STORAGE_KEY);
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

export function clearStoredUtmData(): void {
  try {
    localStorage.removeItem(UTM_STORAGE_KEY);
  } catch {}
}

export async function sendAttributionToServer(): Promise<void> {
  const data = getStoredUtmData();
  if (!data) return;

  try {
    const { getAuthToken } = await import("./authToken");
    const token = getAuthToken();
    if (!token) return;

    const res = await fetch("/api/attribution/track", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      credentials: "include",
      body: JSON.stringify({
        landingPath: data.landingPath,
        source: data.source,
        utmSource: data.utmSource,
        utmMedium: data.utmMedium,
        utmCampaign: data.utmCampaign,
        utmContent: data.utmContent,
        utmTerm: data.utmTerm,
        referrerCode: data.referrerCode,
      }),
    });

    if (res.ok) {
      clearStoredUtmData();
    }
  } catch (err) {
    logger.error("[UTM] Failed to send attribution:", err);
  }
}
