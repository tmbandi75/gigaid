import { isNativePlatform } from "@/lib/platform";

interface ShareOptions {
  title?: string;
  text?: string;
  url?: string;
  dialogTitle?: string;
}

export interface ShareResult {
  shared: boolean;
  /**
   * Normalized identifier of the share target the user picked
   * (e.g. "messages", "mail", "whatsapp", "copy"). Only available
   * when the underlying platform exposes the activity type — iOS
   * Capacitor and (in some versions) iOS Safari. Always undefined
   * on Android and most desktop browsers.
   */
  target?: string;
}

const APPLE_ACTIVITY_TARGETS: Record<string, string> = {
  "com.apple.UIKit.activity.Message": "messages",
  "com.apple.UIKit.activity.Mail": "mail",
  "com.apple.UIKit.activity.CopyToPasteboard": "copy",
  "com.apple.UIKit.activity.AirDrop": "airdrop",
  "com.apple.UIKit.activity.PostToFacebook": "facebook",
  "com.apple.UIKit.activity.PostToTwitter": "twitter",
  "com.apple.UIKit.activity.PostToWeibo": "weibo",
  "com.apple.UIKit.activity.PostToVimeo": "vimeo",
  "com.apple.UIKit.activity.PostToFlickr": "flickr",
  "com.apple.UIKit.activity.PostToTencentWeibo": "tencent_weibo",
  "com.apple.UIKit.activity.AssignToContact": "assign_to_contact",
  "com.apple.UIKit.activity.SaveToCameraRoll": "save_to_camera_roll",
  "com.apple.UIKit.activity.AddToReadingList": "reading_list",
  "com.apple.UIKit.activity.OpenInIBooks": "ibooks",
  "com.apple.UIKit.activity.MarkupAsPDF": "markup_pdf",
  "com.apple.UIKit.activity.Print": "print",
  "com.apple.mobilenotes.SharingExtension": "notes",
  "com.apple.reminders.RemindersEditorExtension": "reminders",
  "net.whatsapp.WhatsApp.ShareExtension": "whatsapp",
  "com.burbn.instagram.shareextension": "instagram",
  "com.facebook.Messenger.ShareExtension": "facebook_messenger",
  "com.toyopagroup.picaboo.share": "snapchat",
  "com.tinyspeck.chatlyio.share": "slack",
  "com.google.Gmail.ShareExtension": "gmail",
  "com.google.GoogleMobile.ShareExtension": "google",
  "com.linkedin.LinkedIn.ShareExtension": "linkedin",
  "com.atebits.Tweetie2.ShareExtension": "twitter",
  "com.hammerandchisel.discord.Share": "discord",
  "ph.telegra.Telegraph.Share": "telegram",
};

/**
 * Maps a raw platform-provided share target identifier (typically an
 * iOS UIActivity.ActivityType reverse-DNS string) to a short, stable
 * lowercase token suitable for analytics breakdowns. Unknown values are
 * truncated and returned as-is so we can still surface the long-tail
 * in the admin report.
 */
export function normalizeShareTarget(raw: unknown): string | undefined {
  if (typeof raw !== "string" || raw.length === 0) return undefined;
  const mapped = APPLE_ACTIVITY_TARGETS[raw];
  if (mapped) return mapped;
  return raw.slice(0, 64);
}

export function canShareContent(): boolean {
  if (isNativePlatform()) {
    return true;
  }
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

export async function shareContent(options: ShareOptions): Promise<ShareResult> {
  try {
    if (isNativePlatform()) {
      const { Share } = await import("@capacitor/share");
      const result = await Share.share({
        title: options.title,
        text: options.text,
        url: options.url,
        dialogTitle: options.dialogTitle,
      });
      const target = normalizeShareTarget(
        (result as { activityType?: string } | undefined)?.activityType,
      );
      return { shared: true, target };
    }

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      // navigator.share is typed as Promise<void> but iOS Safari has been
      // observed to resolve with an object exposing `activityType` on
      // some builds. Defensively read it without relying on the type.
      const sharePromise = (
        navigator.share as unknown as (data: ShareData) => Promise<unknown>
      )({
        title: options.title,
        text: options.text,
        url: options.url,
      });
      const result = await sharePromise;
      const target = normalizeShareTarget(
        (result as { activityType?: string } | null | undefined)?.activityType,
      );
      return { shared: true, target };
    }
  } catch {
    return { shared: false };
  }

  return { shared: false };
}
