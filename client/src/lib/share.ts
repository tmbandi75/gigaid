import { isNativePlatform } from "@/lib/platform";

interface ShareOptions {
  title?: string;
  text?: string;
  url?: string;
  dialogTitle?: string;
}

export function canShareContent(): boolean {
  if (isNativePlatform()) {
    return true;
  }
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

export async function shareContent(options: ShareOptions): Promise<boolean> {
  try {
    if (isNativePlatform()) {
      const { Share } = await import("@capacitor/share");
      await Share.share({
        title: options.title,
        text: options.text,
        url: options.url,
        dialogTitle: options.dialogTitle,
      });
      return true;
    }

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      await navigator.share({
        title: options.title,
        text: options.text,
        url: options.url,
      });
      return true;
    }
  } catch {
    return false;
  }

  return false;
}
