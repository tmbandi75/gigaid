import { Capacitor } from "@capacitor/core";
import { openExternalUrl } from "@/lib/openExternalUrl";
import { logger } from "@/lib/logger";

/** Matches Capacitor `appId` so Google Play filters to this app’s subscriptions. */
const ANDROID_PACKAGE_ID = "com.gigaid.app";

const APPLE_MANAGE_SUBSCRIPTIONS_URL = "https://apps.apple.com/account/subscriptions";

function googlePlaySubscriptionsUrl(): string {
  return `https://play.google.com/store/account/subscriptions?package=${encodeURIComponent(ANDROID_PACKAGE_ID)}`;
}

async function openStoreSubscriptionsViaUrl(): Promise<void> {
  const platform = Capacitor.getPlatform();
  const url =
    platform === "ios" ? APPLE_MANAGE_SUBSCRIPTIONS_URL : googlePlaySubscriptionsUrl();
  await openExternalUrl(url);
}

/**
 * Opens the system subscription management UI (StoreKit / Play Billing sheet), not the in-app browser.
 * Falls back to store URLs if the native plugin is unavailable or errors.
 */
export async function openNativeStoreSubscriptionSettings(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { NativePurchases } = await import("@capgo/native-purchases");
    await NativePurchases.manageSubscriptions();
  } catch (e) {
    logger.warn("[storeSubscriptionSettings] manageSubscriptions failed, using URL fallback:", e);
    await openStoreSubscriptionsViaUrl();
  }
}
