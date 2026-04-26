/**
 * Centralized helper for building public booking links.
 *
 * Every booking link the app generates or sends out (profile API, /api/booking/link,
 * "share my booking link" SMS, invoice email/SMS, campaign suggestions, post-job
 * follow-ups, etc.) must use the same `account.gigaid.ai` host so customers see
 * a consistent URL regardless of which environment generated it.
 *
 * The base URL is sourced from FRONTEND_URL with `https://account.gigaid.ai` as
 * the production default. Always go through these helpers — never concatenate
 * `gigaid.ai/book/...` by hand.
 */

const DEFAULT_BOOKING_BASE_URL = "https://account.gigaid.ai";

export function getBookingBaseUrl(): string {
  const raw = (process.env.FRONTEND_URL || "").trim();
  if (!raw) return DEFAULT_BOOKING_BASE_URL;
  return raw.replace(/\/+$/, "");
}

export function buildBookingLink(slug: string): string {
  return `${getBookingBaseUrl()}/book/${slug}`;
}
