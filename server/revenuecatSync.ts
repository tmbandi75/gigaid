import type { IStorage } from "./storage";
import type { User } from "@shared/schema";
import { logger } from "./lib/logger";
import { emitCanonicalEvent } from "./copilot/canonicalEvents";

const RC_API = "https://api.revenuecat.com/v1";

/** True when the DB row reflects an active App Store / Play subscription synced from RevenueCat. */
export function isStoreSubscriptionActiveInDb(user: {
  subscriptionStore: string | null;
  plan: string | null;
  storeSubscriptionExpiresAt: string | null;
}): boolean {
  if (!user.subscriptionStore || !user.plan || user.plan === "free") return false;
  if (!user.storeSubscriptionExpiresAt) return true;
  const t = new Date(user.storeSubscriptionExpiresAt).getTime();
  if (Number.isNaN(t)) return true;
  return t > Date.now();
}

/** Entitlement identifiers configured in RevenueCat — map to GigAid plan names. */
const ENTITLEMENT_PRIORITY = ["business", "pro_plus", "pro"] as const;

export type RevenueCatSyncResult =
  | { ok: true; skipped?: string; plan?: string }
  | { ok: false; error: string };

function parseRcDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isEntitlementActive(expiresDate: string | null | undefined): boolean {
  if (expiresDate == null || expiresDate === "") return true;
  const exp = parseRcDate(expiresDate);
  if (!exp) return false;
  return exp.getTime() > Date.now();
}

type RcEntitlement = {
  expires_date?: string | null;
  product_identifier?: string;
};

type RcSubscription = {
  expires_date?: string | null;
  store?: string;
  unsubscribe_detected_at?: string | null;
};

type RcSubscriberRoot = {
  subscriber?: {
    entitlements?: Record<string, RcEntitlement>;
    subscriptions?: Record<string, RcSubscription>;
  };
};

function pickHighestActivePlan(entitlements: Record<string, RcEntitlement> | undefined): {
  plan: "free" | "pro" | "pro_plus" | "business";
  productId: string | null;
  expiresAt: string | null;
} {
  if (!entitlements) {
    return { plan: "free", productId: null, expiresAt: null };
  }
  for (const entId of ENTITLEMENT_PRIORITY) {
    const e = entitlements[entId];
    if (!e) continue;
    if (!isEntitlementActive(e.expires_date ?? null)) continue;
    const pid = e.product_identifier || null;
    return {
      plan: entId as "pro" | "pro_plus" | "business",
      productId: pid,
      expiresAt: e.expires_date ?? null,
    };
  }
  return { plan: "free", productId: null, expiresAt: null };
}

function subscriptionStoreFromRc(
  store: string | undefined,
): "app_store" | "play_store" | null {
  if (store === "app_store" || store === "mac_app_store") return "app_store";
  if (store === "play_store") return "play_store";
  return null;
}

function deriveCancelAtPeriodEnd(
  sub: RcSubscription | undefined,
  stillActive: boolean,
): boolean {
  if (!sub || !stillActive) return false;
  return Boolean(sub.unsubscribe_detected_at);
}

/**
 * Fetches canonical subscriber state from RevenueCat and updates the user row.
 * When the user still has a Stripe subscription id, plan fields are not overwritten (Stripe is source of truth).
 */
export async function syncSubscriberFromRevenueCat(
  storage: IStorage,
  appUserId: string,
  options: { eventId?: string | null; reason: string },
): Promise<RevenueCatSyncResult> {
  const secret = process.env.REVENUECAT_SECRET_API_KEY;
  if (!secret) {
    logger.error("[RevenueCat] REVENUECAT_SECRET_API_KEY is not set");
    return { ok: false, error: "server_misconfigured" };
  }

  const user = await storage.getUser(appUserId);
  if (!user) {
    logger.warn(`[RevenueCat] No user for app_user_id=${appUserId} (${options.reason})`);
    return { ok: true, skipped: "user_not_found" };
  }

  if (options.eventId && user.revenuecatLastProcessedEventId === options.eventId) {
    logger.info(`[RevenueCat] Duplicate event ${options.eventId}, skipping`);
    return { ok: true, skipped: "duplicate_event" };
  }

  // Stripe takes precedence while we still hold an active Stripe subscription reference.
  if (user.stripeSubscriptionId) {
    logger.info(
      `[RevenueCat] User ${appUserId} has stripeSubscriptionId; skipping plan overwrite (${options.reason})`,
    );
    if (options.eventId) {
      await storage.updateUser(appUserId, {
        revenuecatLastProcessedEventId: options.eventId,
      });
    }
    return { ok: true, skipped: "stripe_precedence" };
  }

  const url = `${RC_API}/subscribers/${encodeURIComponent(appUserId)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error(`[RevenueCat] GET subscribers failed ${res.status}: ${text.slice(0, 500)}`);
    return { ok: false, error: `revenuecat_http_${res.status}` };
  }

  const body = (await res.json()) as RcSubscriberRoot;
  const entitlements = body.subscriber?.entitlements;
  const subscriptions = body.subscriber?.subscriptions;

  const picked = pickHighestActivePlan(entitlements);
  let store: "app_store" | "play_store" | null = null;
  let cancelAtEnd = false;
  let expiresForRow: string | null = null;

  if (picked.plan !== "free" && picked.productId && subscriptions?.[picked.productId]) {
    const sub = subscriptions[picked.productId]!;
    store = subscriptionStoreFromRc(sub.store);
    const subStillActive = isEntitlementActive(sub.expires_date ?? null);
    cancelAtEnd = deriveCancelAtPeriodEnd(sub, subStillActive);
    expiresForRow = sub.expires_date ?? picked.expiresAt;
  } else if (picked.plan !== "free") {
    expiresForRow = picked.expiresAt;
  }

  const oldPlan = user.plan;
  const updates: Partial<User> = {
    plan: picked.plan,
    isPro: picked.plan !== "free",
    subscriptionStore: picked.plan === "free" ? null : store,
    storeSubscriptionExpiresAt: picked.plan === "free" ? null : expiresForRow,
    storeSubscriptionCancelAtPeriodEnd:
      picked.plan === "free" ? false : cancelAtEnd,
  };

  if (options.eventId) {
    updates.revenuecatLastProcessedEventId = options.eventId;
  }

  await storage.updateUser(appUserId, updates);

  if (picked.plan !== "free" && oldPlan !== picked.plan) {
    emitCanonicalEvent({
      eventName: "user_became_paying",
      userId: appUserId,
      context: {
        oldPlan,
        newPlan: picked.plan,
        source: "revenuecat",
        reason: options.reason,
      },
      source: "system",
    });
  }

  logger.info(
    `[RevenueCat] Synced user ${appUserId} plan=${picked.plan} store=${store ?? "n/a"} (${options.reason})`,
  );

  return { ok: true, plan: picked.plan };
}
