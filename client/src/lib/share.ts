import { registerPlugin } from "@capacitor/core";
import { isAndroid, isNativePlatform } from "@/lib/platform";

// Custom Capacitor plugin (android/app/src/main/java/com/gigaid/app/
// sharetarget/ShareTargetPlugin.java) that reliably surfaces Android's
// chosen-component package name. Used in place of @capacitor/share on
// Android only; iOS and web continue using the upstream paths below.
interface ShareTargetPluginShape {
  share(options: {
    title?: string;
    text?: string;
    url?: string;
    dialogTitle?: string;
  }): Promise<{ shared: boolean; activityType?: string }>;
}
const ShareTarget = registerPlugin<ShareTargetPluginShape>("ShareTarget");

interface ShareOptions {
  title?: string;
  text?: string;
  url?: string;
  dialogTitle?: string;
}

export interface ShareResult {
  shared: boolean;
  /**
   * Normalized share target the user picked (e.g. "messages", "mail",
   * "whatsapp"). Available on iOS, Android, and some iOS Safari builds;
   * undefined when the platform doesn't expose it or the user dismissed
   * the share sheet.
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

// Maps Android package names (returned by Intent.EXTRA_CHOSEN_COMPONENT)
// to the same short tokens used for iOS. Multiple package variants for
// the same app (regional builds, business editions, etc.) intentionally
// map to one token so the admin breakdown groups them together.
const ANDROID_PACKAGE_TARGETS: Record<string, string> = {
  // Messaging / SMS
  "com.google.android.apps.messaging": "messages",
  "com.android.mms": "messages",
  "com.samsung.android.messaging": "messages",
  // Mail
  "com.google.android.gm": "gmail",
  "com.google.android.gm.lite": "gmail",
  "com.microsoft.office.outlook": "outlook",
  "com.yahoo.mobile.client.android.mail": "yahoo_mail",
  "com.samsung.android.email.provider": "samsung_email",
  // Chat apps
  "com.whatsapp": "whatsapp",
  "com.whatsapp.w4b": "whatsapp_business",
  "org.telegram.messenger": "telegram",
  "org.telegram.messenger.web": "telegram",
  "org.thoughtcrime.securesms": "signal",
  "com.facebook.orca": "facebook_messenger",
  "com.facebook.mlite": "facebook_messenger",
  "com.discord": "discord",
  "com.viber.voip": "viber",
  "jp.naver.line.android": "line",
  "com.tencent.mm": "wechat",
  "com.kakao.talk": "kakao_talk",
  // Social
  "com.facebook.katana": "facebook",
  "com.instagram.android": "instagram",
  "com.snapchat.android": "snapchat",
  "com.twitter.android": "twitter",
  "com.zhiliaoapp.musically": "tiktok",
  "com.ss.android.ugc.trill": "tiktok",
  "com.linkedin.android": "linkedin",
  "com.reddit.frontpage": "reddit",
  "com.pinterest": "pinterest",
  // Workplace
  "com.Slack": "slack",
  "com.microsoft.teams": "teams",
  // Google
  "com.google.android.apps.docs": "google_drive",
  "com.google.android.keep": "google_keep",
  "com.google.android.apps.tasks": "google_tasks",
  "com.google.android.apps.maps": "google_maps",
  // Notes
  "com.evernote": "evernote",
  "com.notion.id": "notion",
  // System / generic
  "android": "system",
  "com.google.android.apps.nbu.paisa.user": "google_pay",
  "com.android.bluetooth": "bluetooth",
};

// Reverse-DNS shape that Android package names follow but Apple
// UIActivity strings (already matched explicitly above) also share.
function looksLikeAndroidPackage(raw: string): boolean {
  return /^[a-z][a-z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(raw);
}

/**
 * Maps a raw platform-provided share target identifier to a short
 * lowercase token for analytics. Recognises iOS UIActivity.ActivityType
 * strings and Android package names; unmapped reverse-DNS strings are
 * collapsed to their vendor segment so vendor variants group together.
 * Anything else is returned truncated to 64 chars.
 */
export function normalizeShareTarget(raw: unknown): string | undefined {
  if (typeof raw !== "string" || raw.length === 0) return undefined;
  const apple = APPLE_ACTIVITY_TARGETS[raw];
  if (apple) return apple;
  const android = ANDROID_PACKAGE_TARGETS[raw];
  if (android) return android;
  if (looksLikeAndroidPackage(raw)) {
    const parts = raw.split(".");
    if (parts.length >= 2 && parts[1].length > 0) {
      return parts[1].toLowerCase().slice(0, 64);
    }
  }
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
      // Android: use the custom plugin to capture the chosen package;
      // fall back to @capacitor/share if the bridge fails so the user
      // can still share even without telemetry.
      if (isAndroid()) {
        try {
          const result = await ShareTarget.share({
            title: options.title,
            text: options.text,
            url: options.url,
            dialogTitle: options.dialogTitle,
          });
          const target = normalizeShareTarget(result?.activityType);
          return { shared: !!result?.shared, target };
        } catch {
          // fall through to upstream plugin
        }
      }
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
