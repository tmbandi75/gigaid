import { apiFetch } from "./apiFetch";

export type BookingLinkScreen =
  | "plan"
  | "leads"
  | "leads_empty"
  | "jobs"
  | "bookings"
  | "nba"
  | "other";

export async function recordShareTap(screen: BookingLinkScreen): Promise<void> {
  try {
    await apiFetch("/api/track/booking-link-share-tap", {
      method: "POST",
      body: JSON.stringify({ screen }),
    });
  } catch {
    // best effort — PostHog event still captures the tap on the client
  }
}

export async function recordCopy(screen: BookingLinkScreen): Promise<void> {
  try {
    await apiFetch("/api/track/booking-link-copied", {
      method: "POST",
      body: JSON.stringify({ screen }),
    });
  } catch {
    // best effort — PostHog event still captures the copy on the client
  }
}
