import { Capacitor } from "@capacitor/core";
import { Purchases, LOG_LEVEL } from "@revenuecat/purchases-capacitor";
import { isNativePlatform } from "@/lib/platform";
import { apiFetch } from "@/lib/apiFetch";
import { logger } from "@/lib/logger";

/** Paid tiers available as store subscriptions — matches Stripe plan keys and RevenueCat entitlements. */
export type StoreSubscriptionPlan = "pro" | "pro_plus" | "business";

/**
 * RevenueCat native calls must not overlap: parallel configure/logIn/getCustomerInfo causes
 * "instance already set", 429s, and flaky purchase completion. Every mutating path uses this queue.
 */
let rcSerialChain: Promise<unknown> = Promise.resolve();

function runRevenueCatExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const next = rcSerialChain.then(() => fn());
  rcSerialChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

/** Last app user id we successfully ran ensure for — skips repeat work on refetch/HMR when the bridge is already warm. */
let lastBoundAppUserId: string | null = null;

function publicApiKeyForPlatform(): string | undefined {
  if (!isNativePlatform()) return undefined;
  const p = Capacitor.getPlatform();
  if (p === "ios") return import.meta.env.VITE_REVENUECAT_API_KEY_IOS as string | undefined;
  if (p === "android") return import.meta.env.VITE_REVENUECAT_API_KEY_ANDROID as string | undefined;
  return undefined;
}

/** RevenueCat Capacitor returns `{ isConfigured }`, not a bare boolean — unwrap everywhere. */
async function purchasesNativeReady(): Promise<boolean> {
  try {
    const r = await Purchases.isConfigured();
    return r.isConfigured === true;
  } catch {
    return false;
  }
}

/** Logs Current offering + all offerings + package → store product ids (Xcode / Safari console). */
function logRevenueCatOfferingsSnapshot(
  purchasesOfferings: Record<string, unknown>,
  context: string,
): void {
  try {
    const all = purchasesOfferings.all as Record<string, { identifier?: string }> | undefined;
    const offeringKeys = all ? Object.keys(all) : [];
    const current = purchasesOfferings.current as
      | {
          identifier?: string;
          serverDescription?: string;
          availablePackages?: Array<{
            identifier?: string;
            product?: { identifier?: string; title?: string };
          }>;
        }
      | null
      | undefined;
    const packages =
      current?.availablePackages?.map((p) => ({
        packageIdentifier: p.identifier ?? "?",
        storeProductId: p.product?.identifier ?? "(missing)",
        title: p.product?.title ?? "",
      })) ?? [];
    logger.info(`[RevenueCat][${context}] offerings snapshot`, {
      platform: Capacitor.getPlatform(),
      allOfferingKeys: offeringKeys,
      currentOfferingId: current?.identifier ?? null,
      currentServerDescription: current?.serverDescription ?? null,
      packageCount: packages.length,
      packages,
    });
  } catch (e) {
    logger.warn(`[RevenueCat][${context}] offerings snapshot failed`, e);
  }
}

/**
 * Call from dev tools or a temporary button to print offerings to the device log without starting checkout.
 */
export async function debugLogRevenueCatCatalog(): Promise<void> {
  if (!isNativePlatform()) {
    logger.info("[RevenueCat][debug] skip — not native");
    return;
  }
  if (!(await purchasesNativeReady())) {
    logger.warn("[RevenueCat][debug] Purchases not configured yet — sign in first");
    return;
  }
  const o = (await Purchases.getOfferings()) as unknown as Record<string, unknown>;
  logRevenueCatOfferingsSnapshot(o, "debug_manual");
}

/** Capacitor can report isConfigured before the native Purchases SDK is actually ready — poll after configure/logIn. */
async function waitUntilPurchasesConfigured(timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if (await purchasesNativeReady()) return true;
    } catch {
      /* treat as not ready */
    }
    await new Promise((r) => setTimeout(r, 75));
  }
  return false;
}

/**
 * Ensures configure or logIn has completed and the native bridge reports ready before getOfferings / purchase.
 * Call only from inside runRevenueCatExclusive so configure never races another caller.
 */
async function ensurePurchasesReadyCore(apiKey: string, appUserId: string): Promise<void> {
  let reportedConfigured = await purchasesNativeReady();

  if (!reportedConfigured) {
    await Purchases.configure({ apiKey, appUserID: appUserId });
  } else {
    try {
      await Purchases.logIn({ appUserID: appUserId });
    } catch (e: unknown) {
      const blob = typeof e === "object" && e !== null ? JSON.stringify(e) : String(e);
      const fromError = e instanceof Error ? e.message : "";
      if (
        blob.includes("must be configured") ||
        blob.includes("configured before") ||
        fromError.includes("must be configured")
      ) {
        await Purchases.configure({ apiKey, appUserID: appUserId });
      } else {
        throw e;
      }
    }
  }

  const ok = await waitUntilPurchasesConfigured(12000);
  if (!ok) {
    throw new Error(
      "RevenueCat did not become ready on device after configure. Rebuild the iOS app (cap sync), verify VITE_REVENUECAT_API_KEY_IOS, and try again.",
    );
  }
}

/** RevenueCat package identifiers — match the Offering in the RevenueCat dashboard (defaults to plan keys). */
function packageIdentifierForPlan(plan: StoreSubscriptionPlan): string {
  const envMap: Record<StoreSubscriptionPlan, string | undefined> = {
    pro: import.meta.env.VITE_REVENUECAT_PACKAGE_PRO as string | undefined,
    pro_plus: import.meta.env.VITE_REVENUECAT_PACKAGE_PRO_PLUS as string | undefined,
    business: import.meta.env.VITE_REVENUECAT_PACKAGE_BUSINESS as string | undefined,
  };
  return envMap[plan] ?? plan;
}

/**
 * Binds the native SDK to the backend user id so webhooks and REST use the same app_user_id as users.id.
 */
export async function bindRevenueCatToUser(userId: string | null): Promise<void> {
  if (!isNativePlatform()) return;

  const apiKey = publicApiKeyForPlatform();
  if (!apiKey) {
    logger.warn("[RevenueCat] No VITE_REVENUECAT_API_KEY_* for this platform — IAP disabled until configured");
    return;
  }

  try {
    await runRevenueCatExclusive(async () => {
      if (!userId) {
        lastBoundAppUserId = null;
        if (await purchasesNativeReady()) {
          await Purchases.logOut();
        }
        return;
      }

      if (userId === lastBoundAppUserId && (await purchasesNativeReady())) {
        logger.debug("[RevenueCat] skip bind — same user and Purchases already ready");
        return;
      }

      if (import.meta.env.DEV) {
        await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });
      }

      await ensurePurchasesReadyCore(apiKey, userId);
      lastBoundAppUserId = userId;

      try {
        const { customerInfo } = await Purchases.getCustomerInfo();
        logger.debug("[RevenueCat] bind complete", {
          activeEntitlements: Object.keys(customerInfo.entitlements.active ?? {}),
        });
      } catch {
        /* non-fatal */
      }

      if (import.meta.env.DEV) {
        try {
          const o = (await Purchases.getOfferings()) as unknown as Record<string, unknown>;
          logRevenueCatOfferingsSnapshot(o, "after_bind");
        } catch {
          /* non-fatal */
        }
      }
    });
  } catch (e) {
    logger.error("[RevenueCat] bindRevenueCatToUser failed:", e);
  }
}

export async function logOutRevenueCat(): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    await runRevenueCatExclusive(async () => {
      lastBoundAppUserId = null;
      if (await purchasesNativeReady()) {
        await Purchases.logOut();
      }
    });
  } catch (e) {
    logger.warn("[RevenueCat] logOut failed (non-fatal):", e);
  }
}

export async function syncStoreSubscriptionWithBackend(): Promise<void> {
  await apiFetch<{ ok?: boolean }>("/api/subscription/sync-store", { method: "POST" });
}

/**
 * Restores App Store / Play purchases with the store, then asks the server to pull subscriber state from RevenueCat.
 */
export async function restoreNativePurchasesThenServer(): Promise<void> {
  if (!isNativePlatform()) return;
  const apiKey = publicApiKeyForPlatform();
  if (!apiKey) return;
  try {
    await runRevenueCatExclusive(async () => {
      if (await purchasesNativeReady()) {
        await Purchases.restorePurchases();
      }
    });
  } catch (e) {
    logger.warn("[RevenueCat] restorePurchases:", e);
  }
}

export interface NativePurchaseResult {
  success: boolean;
  error?: string;
}

/** Pulls a useful string from RevenueCat / Capacitor purchase errors for support and toasts. */
function formatPurchaseError(e: unknown): string {
  if (e == null) return "Unknown error.";
  if (typeof e === "string") return e;
  const err = e as Record<string, unknown>;
  const msg = typeof err.message === "string" ? err.message : "";
  const code = typeof err.code === "string" ? err.code : String(err.code ?? "");
  const ui = err.userInfo as Record<string, unknown> | undefined;
  const readable =
    typeof ui?.readableErrorCode === "string" ? ui.readableErrorCode : "";
  const localized =
    typeof ui?.NSLocalizedDescription === "string" ? ui.NSLocalizedDescription : "";
  const underlying =
    typeof ui?.NSUnderlyingError === "object" && ui.NSUnderlyingError != null
      ? String((ui.NSUnderlyingError as { localizedDescription?: string }).localizedDescription ?? "")
      : "";
  const parts = [readable, code, localized, underlying, msg].filter(Boolean);
  const joined = parts.filter((v, i) => parts.indexOf(v) === i).join(" — ");
  const blob = `${joined} ${msg}`.toLowerCase();

  if (
    readable === "STORE_PROBLEM" ||
    code === "2" ||
    blob.includes("problem with the app store") ||
    blob.includes("storekiterror")
  ) {
    return "The App Store did not finish this purchase (StoreKit often does this in sandbox). Wait a minute, confirm you are signed into a Sandbox Apple ID, avoid tapping Buy twice, then try again.";
  }
  if (blob.includes("missing transaction") || blob.includes("did not return a transaction")) {
    return "The store charged the flow but did not return transaction details to the app. Wait a minute, tap Restore purchases in Settings, or check RevenueCat for the subscriber — your plan may still update.";
  }

  return joined || "Purchase failed. Check App Store sandbox sign-in and RevenueCat offering.";
}

export async function purchaseSubscriptionOnNative(
  plan: StoreSubscriptionPlan,
  opts?: { appUserId?: string },
): Promise<NativePurchaseResult> {
  if (!isNativePlatform()) {
    return { success: false, error: "Not a native app" };
  }

  const apiKey = publicApiKeyForPlatform();
  if (!apiKey) {
    return {
      success: false,
      error: "Subscriptions on this device are not configured yet. Please use the web app or contact support.",
    };
  }

  if (!opts?.appUserId) {
    return {
      success: false,
      error:
        "Purchase system was not ready. Sign in to Gig Aid, then try again so subscriptions can link to your account.",
    };
  }

  try {
    return await runRevenueCatExclusive(async () => {
      await ensurePurchasesReadyCore(apiKey, opts.appUserId!);
      lastBoundAppUserId = opts.appUserId!;

      const purchasesOfferings = await Purchases.getOfferings();
      logRevenueCatOfferingsSnapshot(
        purchasesOfferings as unknown as Record<string, unknown>,
        "before_purchase",
      );
      const current = purchasesOfferings.current ?? null;
      if (!current) {
        return {
          success: false,
          error: "No subscription products are available yet. Mark an offering as Current in RevenueCat and attach iOS products.",
        };
      }

      const wantId = packageIdentifierForPlan(plan);
      const pkg = current.availablePackages.find(
        (p: { identifier: string }) => p.identifier === wantId,
      );

      if (!pkg) {
        logger.error("[RevenueCat] No package for plan", {
          plan,
          wantId,
          available: current.availablePackages.map((p: { identifier: string }) => p.identifier),
        });
        return {
          success: false,
          error: `Product package "${wantId}" was not found. Confirm RevenueCat offering packages match your plan keys.`,
        };
      }

      await Purchases.purchasePackage({ aPackage: pkg });
      await Purchases.syncPurchases();
      try {
        await syncStoreSubscriptionWithBackend();
      } catch (e) {
        logger.warn("[RevenueCat] sync-store after purchase failed; webhook may still apply:", e);
      }
      return { success: true };
    });
  } catch (e: unknown) {
    const anyE = e as { code?: string; userInfo?: { readableErrorCode?: string } };
    const code = anyE?.code ?? anyE?.userInfo?.readableErrorCode ?? "";
    if (
      code === "PURCHASE_CANCELLED_ERROR" ||
      code === "1" ||
      (typeof (e as Error)?.message === "string" && (e as Error).message.toLowerCase().includes("cancel"))
    ) {
      return { success: false, error: "Purchase was cancelled." };
    }
    logger.error("[RevenueCat] purchase failed:", e);
    return {
      success: false,
      error: formatPurchaseError(e),
    };
  }
}
