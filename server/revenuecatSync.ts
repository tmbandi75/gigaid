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

const PLAN_ORDER = ["free", "pro", "pro_plus", "business"] as const;

function planRank(p: string): number {
  const i = PLAN_ORDER.indexOf(p as (typeof PLAN_ORDER)[number]);
  return i === -1 ? 0 : i;
}

function higherPlan(
  a: (typeof PLAN_ORDER)[number],
  b: (typeof PLAN_ORDER)[number],
): (typeof PLAN_ORDER)[number] {
  return planRank(a) >= planRank(b) ? a : b;
}

function inferPlanFromIdentifier(identifier: string | null | undefined):
  | "pro"
  | "pro_plus"
  | "business"
  | null {
  if (!identifier) return null;
  const id = identifier.toLowerCase();
  if (id.includes("business")) return "business";
  if (id.includes("pro_plus") || id.includes("proplus") || id.includes("pro-plus")) {
    return "pro_plus";
  }
  // Keep this check last so pro_plus does not get treated as pro.
  if (/(^|[._-])pro([._-]|$)/.test(id)) return "pro";
  return null;
}

/**
 * Store product IDs → GigAid plan. Used when entitlements all point at one tier but the user upgraded
 * in the subscription group (Apple/Google product id is the ground truth).
 * Override via REVENUECAT_PRODUCT_PLAN_JSON='{"com.example.pro":"pro",...}' if IDs differ.
 */
function storeProductToPlanMap(): Record<string, "pro" | "pro_plus" | "business"> {
  const defaults: Record<string, "pro" | "pro_plus" | "business"> = {
    "com.gigaid.app.pro.monthly": "pro",
    "com.gigaid.app.pro_plus.monthly": "pro_plus",
    "com.gigaid.app.business.monthly": "business",
  };
  const raw = process.env.REVENUECAT_PRODUCT_PLAN_JSON;
  if (!raw?.trim()) return defaults;
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    const out = { ...defaults };
    for (const [pid, plan] of Object.entries(parsed)) {
      if (plan === "pro" || plan === "pro_plus" || plan === "business") {
        out[pid] = plan;
      }
    }
    return out;
  } catch {
    return defaults;
  }
}

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
  let best: {
    plan: "pro" | "pro_plus" | "business";
    productId: string | null;
    expiresAt: string | null;
  } | null = null;

  for (const [entitlementId, entitlement] of Object.entries(entitlements)) {
    if (!isEntitlementActive(entitlement.expires_date ?? null)) continue;
    const inferred =
      inferPlanFromIdentifier(entitlementId) ??
      inferPlanFromIdentifier(entitlement.product_identifier ?? null);
    if (!inferred) continue;
    if (!best || planRank(inferred) > planRank(best.plan)) {
      best = {
        plan: inferred,
        productId: entitlement.product_identifier || null,
        expiresAt: entitlement.expires_date ?? null,
      };
    }
  }

  for (const entId of ENTITLEMENT_PRIORITY) {
    const e = entitlements[entId];
    if (!e) continue;
    if (!isEntitlementActive(e.expires_date ?? null)) continue;
    const pid = e.product_identifier || null;
    const inferred = inferPlanFromIdentifier(entId) ?? inferPlanFromIdentifier(pid);
    if (!inferred) continue;
    if (!best || planRank(inferred) > planRank(best.plan)) {
      best = { plan: inferred, productId: pid, expiresAt: e.expires_date ?? null };
    }
  }

  if (best) {
    return {
      plan: best.plan,
      productId: best.productId,
      expiresAt: best.expiresAt,
    };
  }
  return { plan: "free", productId: null, expiresAt: null };
}

/** Highest tier among active auto-renewing subscriptions, using store product ids (upgrade truth). */
function pickHighestPlanFromActiveSubscriptions(
  subscriptions: Record<string, RcSubscription> | undefined,
  productToPlan: Record<string, "pro" | "pro_plus" | "business">,
): {
  plan: "free" | "pro" | "pro_plus" | "business";
  productId: string | null;
  expiresAt: string | null;
} {
  if (!subscriptions) {
    return { plan: "free", productId: null, expiresAt: null };
  }
  let best: {
    plan: "pro" | "pro_plus" | "business";
    productId: string;
    expiresAt: string | null;
  } | null = null;
  for (const [productId, sub] of Object.entries(subscriptions)) {
    if (!isEntitlementActive(sub.expires_date ?? null)) continue;
    const plan = productToPlan[productId] ?? inferPlanFromIdentifier(productId);
    if (!plan) continue;
    if (!best || planRank(plan) > planRank(best.plan)) {
      best = { plan, productId, expiresAt: sub.expires_date ?? null };
    }
  }
  if (!best) {
    return { plan: "free", productId: null, expiresAt: null };
  }
  return { plan: best.plan, productId: best.productId, expiresAt: best.expiresAt };
}

function mergeRcSubscriberPayloads(
  a: RcSubscriberRoot | undefined,
  b: RcSubscriberRoot | undefined,
): RcSubscriberRoot {
  const ae = a?.subscriber?.entitlements ?? {};
  const be = b?.subscriber?.entitlements ?? {};
  const as = a?.subscriber?.subscriptions ?? {};
  const bs = b?.subscriber?.subscriptions ?? {};
  return {
    subscriber: {
      entitlements: { ...ae, ...be },
      subscriptions: { ...as, ...bs },
    },
  };
}

async function fetchRevenueCatSubscriberMerged(
  secret: string,
  appUserId: string,
): Promise<{ ok: true; body: RcSubscriberRoot } | { ok: false; status: number; text: string }> {
  const url = `${RC_API}/subscribers/${encodeURIComponent(appUserId)}`;
  const base = {
    Authorization: `Bearer ${secret}`,
    "Content-Type": "application/json",
  } as const;

  const resProd = await fetch(url, { headers: { ...base } });
  if (!resProd.ok) {
    const text = await resProd.text();
    return { ok: false, status: resProd.status, text };
  }
  const bodyProd = (await resProd.json()) as RcSubscriberRoot;

  const resSandbox = await fetch(url, {
    headers: { ...base, "X-Is-Sandbox": "true" },
  });
  if (!resSandbox.ok) {
    logger.debug(
      `[RevenueCat] Sandbox subscriber GET ${resSandbox.status} — using production payload only (${appUserId})`,
    );
    return { ok: true, body: bodyProd };
  }
  const bodySandbox = (await resSandbox.json()) as RcSubscriberRoot;
  return { ok: true, body: mergeRcSubscriberPayloads(bodyProd, bodySandbox) };
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

  const fetched = await fetchRevenueCatSubscriberMerged(secret, appUserId);
  if (!fetched.ok) {
    logger.error(
      `[RevenueCat] GET subscribers failed ${fetched.status}: ${fetched.text.slice(0, 500)}`,
    );
    return { ok: false, error: `revenuecat_http_${fetched.status}` };
  }

  const body = fetched.body;
  const entitlements = body.subscriber?.entitlements;
  const subscriptions = body.subscriber?.subscriptions;

  const fromEnt = pickHighestActivePlan(entitlements);
  const productMap = storeProductToPlanMap();
  const fromSub = pickHighestPlanFromActiveSubscriptions(subscriptions, productMap);
  const mergedPlan = higherPlan(fromEnt.plan, fromSub.plan);

  if (fromEnt.plan !== fromSub.plan && fromSub.plan !== "free" && fromEnt.plan !== "free") {
    logger.info(
      `[RevenueCat] Plan sources differ for ${appUserId}: entitlements=${fromEnt.plan} storeProducts=${fromSub.plan} → merged=${mergedPlan}`,
    );
  }

  let canonicalProductId: string | null = null;
  let expiresFallback: string | null = null;
  if (mergedPlan !== "free") {
    if (mergedPlan === fromSub.plan && fromSub.productId) {
      canonicalProductId = fromSub.productId;
      expiresFallback = fromSub.expiresAt;
    } else if (mergedPlan === fromEnt.plan && fromEnt.productId) {
      canonicalProductId = fromEnt.productId;
      expiresFallback = fromEnt.expiresAt;
    } else {
      canonicalProductId = fromSub.productId ?? fromEnt.productId;
      expiresFallback = fromSub.expiresAt ?? fromEnt.expiresAt;
    }
  }

  let store: "app_store" | "play_store" | null = null;
  let cancelAtEnd = false;
  let expiresForRow: string | null = null;

  if (mergedPlan !== "free" && canonicalProductId && subscriptions?.[canonicalProductId]) {
    const sub = subscriptions[canonicalProductId]!;
    store = subscriptionStoreFromRc(sub.store);
    const subStillActive = isEntitlementActive(sub.expires_date ?? null);
    cancelAtEnd = deriveCancelAtPeriodEnd(sub, subStillActive);
    expiresForRow = sub.expires_date ?? expiresFallback;
  } else if (mergedPlan !== "free") {
    expiresForRow = expiresFallback;
  }

  const oldPlan = user.plan;

  // Emit the canonical event BEFORE persisting any user state. If the
  // insert fails we return ok:false (the webhook caller turns it into
  // a 500), `user.plan` and `revenuecatLastProcessedEventId` stay
  // untouched, so RevenueCat's retry will re-evaluate the transition
  // and re-emit `user_became_paying` on success.
  if (mergedPlan !== "free" && oldPlan !== mergedPlan) {
    try {
      await emitCanonicalEvent(
        {
          eventName: "user_became_paying",
          userId: appUserId,
          context: {
            oldPlan,
            newPlan: mergedPlan,
            source: "revenuecat",
            reason: options.reason,
          },
          source: "system",
        },
        { throwOnInsertFailure: true },
      );
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error(
        `[RevenueCat] Failed to emit user_became_paying for ${appUserId}`,
        {
          eventName: "user_became_paying",
          userId: appUserId,
          source: "revenuecat",
          reason: options.reason,
          error: errMsg,
        },
      );
      return { ok: false, error: `canonical_event_insert_failed:${errMsg}` };
    }
  }

  const updates: Partial<User> = {
    plan: mergedPlan,
    isPro: mergedPlan !== "free",
    subscriptionStore: mergedPlan === "free" ? null : store,
    storeSubscriptionExpiresAt: mergedPlan === "free" ? null : expiresForRow,
    storeSubscriptionCancelAtPeriodEnd:
      mergedPlan === "free" ? false : cancelAtEnd,
  };

  if (options.eventId) {
    updates.revenuecatLastProcessedEventId = options.eventId;
  }

  await storage.updateUser(appUserId, updates);

  logger.info(
    `[RevenueCat] Synced user ${appUserId} plan=${mergedPlan} store=${store ?? "n/a"} (${options.reason})`,
  );

  return { ok: true, plan: mergedPlan };
}
