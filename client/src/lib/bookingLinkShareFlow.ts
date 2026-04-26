import { apiFetch } from "@/lib/apiFetch";
import { copyTextToClipboard } from "@/lib/clipboard";
import { shareContent } from "@/lib/share";
import { markBookingLinkShared } from "@/lib/bookingLinkShared";

export type BookingLinkShareMethod = "copy" | "share";

export interface RecordBookingLinkSharedOptions {
  method: BookingLinkShareMethod;
  userId: string | undefined;
  /**
   * Normalized share target the user picked (e.g. "messages",
   * "mail", "whatsapp"). For the "copy" method the server treats
   * this as "copy" automatically, but it can be set explicitly
   * for clarity.
   */
  target?: string;
  onLocalMark?: () => void;
  onApiSuccess?: () => void;
}

export async function recordBookingLinkShared(
  opts: RecordBookingLinkSharedOptions,
): Promise<{ apiOk: boolean }> {
  markBookingLinkShared(opts.userId);
  opts.onLocalMark?.();
  try {
    await apiFetch("/api/track/booking-link-shared", {
      method: "POST",
      body: JSON.stringify({ method: opts.method, target: opts.target }),
    });
    opts.onApiSuccess?.();
    return { apiOk: true };
  } catch {
    // best effort — local flag already flipped the NBA state
    return { apiOk: false };
  }
}

export interface AttemptShareBookingLinkOptions {
  bookingLink: string;
  shareTitle: string;
  shareText: string;
  dialogTitle: string;
  userId: string | undefined;
  onLocalMark?: () => void;
  onApiSuccess?: () => void;
}

export interface AttemptShareBookingLinkResult {
  shared: boolean;
  /**
   * Normalized share target the OS reported (e.g. "messages",
   * "whatsapp"). Available on iOS and Android; undefined on platforms
   * that don't expose it or when the user dismissed the share sheet.
   */
  target?: string;
}

/**
 * Attempts to share the booking link via the native/web share sheet.
 * Only records the share (locally + via API) when the share sheet returns
 * success. If the user dismisses or cancels the share sheet, no state
 * is mutated — preventing the NBA from incorrectly advancing past
 * NEW_USER (regression fixed in Task #89).
 *
 * Returns the chosen share target (e.g. "messages", "mail") when the
 * platform exposes it. Forwarded to `/api/track/booking-link-shared`
 * so the admin share funnel can break completions down by destination.
 */
export async function attemptShareBookingLink(
  opts: AttemptShareBookingLinkOptions,
): Promise<AttemptShareBookingLinkResult> {
  const { shared, target } = await shareContent({
    title: opts.shareTitle,
    text: opts.shareText,
    url: opts.bookingLink,
    dialogTitle: opts.dialogTitle,
  });
  if (!shared) {
    return { shared: false };
  }
  await recordBookingLinkShared({
    method: "share",
    target,
    userId: opts.userId,
    onLocalMark: opts.onLocalMark,
    onApiSuccess: opts.onApiSuccess,
  });
  return { shared: true, target };
}

export interface CopyBookingLinkOptions {
  bookingLink: string;
  userId: string | undefined;
  onLocalMark?: () => void;
  onApiSuccess?: () => void;
}

/**
 * Copies the booking link to the clipboard. On success the share is
 * always recorded with method "copy" — copy is treated as an
 * intentional, completed share action.
 */
export async function copyBookingLinkToClipboard(
  opts: CopyBookingLinkOptions,
): Promise<{ copied: boolean }> {
  const ok = await copyTextToClipboard(opts.bookingLink);
  if (!ok) return { copied: false };
  await recordBookingLinkShared({
    method: "copy",
    target: "copy",
    userId: opts.userId,
    onLocalMark: opts.onLocalMark,
    onApiSuccess: opts.onApiSuccess,
  });
  return { copied: true };
}
