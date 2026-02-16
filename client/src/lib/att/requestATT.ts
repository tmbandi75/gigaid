import { isIOS, isNativePlatform } from "@/lib/platform";

export type ATTStatus = "authorized" | "denied" | "restricted" | "not_determined" | "not_required";

export async function requestATT(): Promise<ATTStatus> {
  if (!isNativePlatform() || !isIOS()) {
    return "not_required";
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = await import(
      /* @vite-ignore */
      "capacitor-plugin-app-tracking-transparency"
    );
    const AppTrackingTransparency = mod.AppTrackingTransparency;

    const { status: currentStatus } = await AppTrackingTransparency.getStatus();

    if (currentStatus === "authorized") return "authorized";
    if (currentStatus === "denied") return "denied";
    if (currentStatus === "restricted") return "restricted";

    const { status: newStatus } = await AppTrackingTransparency.requestPermission();

    if (newStatus === "authorized") return "authorized";
    if (newStatus === "denied") return "denied";
    if (newStatus === "restricted") return "restricted";

    return "not_determined";
  } catch (err) {
    console.warn("[ATT] Plugin not available or error:", err);
    return "not_required";
  }
}
