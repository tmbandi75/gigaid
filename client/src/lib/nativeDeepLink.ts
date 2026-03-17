import { Capacitor } from "@capacitor/core";
import { logger } from "@/lib/logger";

const APP_LINK_HOST = "gigaid.ai";

/**
 * Extracts in-app path + search from a deep link URL (HTTPS Universal/App Link).
 * - https://gigaid.ai/pricing?subscription=success -> /pricing?subscription=success
 */
export function parseDeepLinkPath(url: string): string | null {
  if (!url || typeof url !== "string") return null;
  try {
    const parsed = new URL(url);
    const path = parsed.pathname || "/";
    const search = parsed.search || "";
    const fullPath = path === "/" ? "/pricing" : path;
    const pathAndSearch = fullPath + search;

    if (parsed.protocol === "https:" && parsed.hostname === APP_LINK_HOST) return pathAndSearch;
    return null;
  } catch {
    return null;
  }
}

/**
 * Registers native deep link handling for Stripe return URLs.
 * Handles Universal Links (iOS) / App Links (Android): https://gigaid.ai/...
 * When the app is opened after Stripe redirect, we navigate to the path and close the in-app browser.
 * Only runs on native (iOS/Android); no-op on web.
 */
export function registerNativeDeepLinkHandler(navigate: (path: string) => void): () => void {
  if (!Capacitor.isNativePlatform()) return () => {};

  let listener: { remove: () => Promise<void> } | null = null;

  const handleUrl = async (url: string) => {
    const path = parseDeepLinkPath(url);
    if (!path) return;
    logger.info("[DeepLink] Handling return URL", { url, path });
    navigate(path);
    try {
      const { Browser } = await import("@capacitor/browser");
      await Browser.close();
    } catch (e) {
      logger.warn("[DeepLink] Browser.close failed", e);
    }
  };

  (async () => {
    const { App } = await import("@capacitor/app");
    listener = await App.addListener("appUrlOpen", (event) => {
      handleUrl(event.url);
    });
    const launch = await App.getLaunchUrl();
    if (launch?.url) await handleUrl(launch.url);
  })();

  return () => {
    listener?.remove?.();
  };
}
