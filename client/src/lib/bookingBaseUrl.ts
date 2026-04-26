/**
 * Public booking-link host for any client-side code that has to construct
 * a `/book/<slug>` URL without an API round-trip (e.g. the FirstBookingPage
 * which only knows the booking-page id, or the Settings slug-edit preview
 * before the new slug has been saved).
 *
 * Anything that already has the link from the server (the bookingLink field
 * on /api/profile or /api/booking/link) should use that value directly so
 * the host stays consistent across environments.
 */
const DEFAULT_BOOKING_BASE_URL = "https://account.gigaid.ai";

export function getBookingBaseUrl(): string {
  const fromEnv = (import.meta.env.VITE_BOOKING_BASE_URL as string | undefined)?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  return DEFAULT_BOOKING_BASE_URL;
}

export function buildBookingLink(slug: string): string {
  return `${getBookingBaseUrl()}/book/${slug}`;
}

export const BOOKING_LINK_HOST_DISPLAY = "account.gigaid.ai";
