import { apiFetch } from "@/lib/apiFetch";
import { copyTextToClipboard } from "@/lib/clipboard";
import { shareContent } from "@/lib/share";
import { markBookingLinkShared } from "@/lib/bookingLinkShared";

export type BookingLinkShareMethod = "copy" | "share";

export interface RecordBookingLinkSharedOptions {
  method: BookingLinkShareMethod;
  userId: string | undefined;
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
      body: JSON.stringify({ method: opts.method }),
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

/**
 * Attempts to share the booking link via the native/web share sheet.
 * Only records the share (locally + via API) when the share sheet returns
 * success. If the user dismisses or cancels the share sheet, no state
 * is mutated — preventing the NBA from incorrectly advancing past
 * NEW_USER (regression fixed in Task #89).
 */
export async function attemptShareBookingLink(
  opts: AttemptShareBookingLinkOptions,
): Promise<{ shared: boolean }> {
  const sharedOk = await shareContent({
    title: opts.shareTitle,
    text: opts.shareText,
    url: opts.bookingLink,
    dialogTitle: opts.dialogTitle,
  });
  if (!sharedOk) {
    return { shared: false };
  }
  await recordBookingLinkShared({
    method: "share",
    userId: opts.userId,
    onLocalMark: opts.onLocalMark,
    onApiSuccess: opts.onApiSuccess,
  });
  return { shared: true };
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
    userId: opts.userId,
    onLocalMark: opts.onLocalMark,
    onApiSuccess: opts.onApiSuccess,
  });
  return { copied: true };
}
