import {
  safePrice,
  safePriceCents,
  safePriceCentsExact,
  safePriceExact,
  safePriceRange,
} from "./safePrice";

/**
 * Customer-facing fallback copy used when an outbound SMS / email body
 * needs to reference a price but the underlying value is missing,
 * non-finite, or non-positive. Reads naturally inside a sentence
 * ("Your invoice for water heater repair is amount to be confirmed.")
 * — unlike the dense `--` admin-table placeholder which scans as broken
 * to a customer.
 *
 * Locked string. Tests pin this exact value so a future refactor cannot
 * silently regress to `"--"` inside an outbound message body.
 */
export const NOTIFICATION_PRICE_MISSING_COPY = "amount to be confirmed";

type NotificationPriceOpts = {
  /** Override the missing-price copy (rare — defaults to the locked string). */
  placeholder?: string;
};

/**
 * Wrappers around the `safePrice*` helpers that swap in customer-friendly
 * copy when the price is missing / invalid. Use these — never the raw
 * `safePrice*` helpers — when building the body of an outbound SMS or
 * email so a missing value never ships as the literal `"--"` placeholder.
 *
 * Each wrapper preserves the formatting of its underlying helper for
 * valid inputs (whole dollars, two-decimal exact, cent-based, range,
 * etc.) and only diverges in what it returns when the input is missing.
 */
export function notificationPrice(value: unknown, opts: NotificationPriceOpts = {}): string {
  return safePrice(value, { placeholder: opts.placeholder ?? NOTIFICATION_PRICE_MISSING_COPY });
}

export function notificationPriceExact(value: unknown, opts: NotificationPriceOpts = {}): string {
  return safePriceExact(value, { placeholder: opts.placeholder ?? NOTIFICATION_PRICE_MISSING_COPY });
}

export function notificationPriceCents(value: unknown, opts: NotificationPriceOpts = {}): string {
  return safePriceCents(value, { placeholder: opts.placeholder ?? NOTIFICATION_PRICE_MISSING_COPY });
}

export function notificationPriceCentsExact(value: unknown, opts: NotificationPriceOpts = {}): string {
  return safePriceCentsExact(value, { placeholder: opts.placeholder ?? NOTIFICATION_PRICE_MISSING_COPY });
}

export function notificationPriceRange(
  low: unknown,
  high: unknown,
  opts: NotificationPriceOpts = {},
): string {
  return safePriceRange(low, high, {
    placeholder: opts.placeholder ?? NOTIFICATION_PRICE_MISSING_COPY,
  });
}
