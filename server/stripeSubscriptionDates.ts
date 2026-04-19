import type Stripe from "stripe";

type SubscriptionItemWithPeriod = Stripe.SubscriptionItem & {
  current_period_end?: number;
  current_period_start?: number;
};

/**
 * Newer Stripe API shapes may omit top-level period fields; read from the first line item when needed.
 */
export function subscriptionCurrentPeriodEndSeconds(sub: Stripe.Subscription): number | null {
  const top = sub.current_period_end;
  if (typeof top === "number" && Number.isFinite(top)) {
    return top;
  }
  const item = sub.items?.data?.[0] as SubscriptionItemWithPeriod | undefined;
  const v = item?.current_period_end;
  if (typeof v === "number" && Number.isFinite(v)) {
    return v;
  }
  return null;
}

export function subscriptionCurrentPeriodStartSeconds(sub: Stripe.Subscription): number | null {
  const top = sub.current_period_start;
  if (typeof top === "number" && Number.isFinite(top)) {
    return top;
  }
  const item = sub.items?.data?.[0] as SubscriptionItemWithPeriod | undefined;
  const v = item?.current_period_start;
  if (typeof v === "number" && Number.isFinite(v)) {
    return v;
  }
  return null;
}

/**
 * Avoids RangeError from Date.prototype.toISOString when Stripe omits or sends a non-finite unix timestamp.
 */
export function stripeSecondsToIso(seconds: number | null | undefined): string | null {
  if (seconds == null || typeof seconds !== "number" || !Number.isFinite(seconds)) {
    return null;
  }
  const d = new Date(seconds * 1000);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
