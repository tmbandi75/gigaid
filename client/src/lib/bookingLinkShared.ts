const STORAGE_KEY_PREFIX = "gigaid:hasSharedBookingLink";

function storageKey(userId?: string): string {
  return userId ? `${STORAGE_KEY_PREFIX}:${userId}` : STORAGE_KEY_PREFIX;
}

export function markBookingLinkShared(userId?: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(userId), "1");
  } catch {
    // localStorage might be unavailable (privacy mode, quota, etc.) — best effort only
  }
}

export function hasSharedBookingLinkLocally(userId?: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(storageKey(userId)) === "1";
  } catch {
    return false;
  }
}
