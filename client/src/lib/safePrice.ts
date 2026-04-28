// Safe-price helpers live in `shared/` so the same guarantees apply on
// both the client (UI) and the server (emails, SMS, PDF invoices, etc.).
// This module re-exports them so existing `@/lib/safePrice` imports keep
// working unchanged.
export {
  safePrice,
  safePriceCents,
  safePriceRange,
  safePriceExact,
  safePriceCentsExact,
  safePriceCentsLocale,
  safePriceLocale,
  isFinitePositiveNumber,
  isFiniteNumber,
  safePriceRangeString,
} from "@shared/safePrice";
