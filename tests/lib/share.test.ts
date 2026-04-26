// Coverage for normalizeShareTarget plus the Android capture path that
// routes shareContent through the custom ShareTarget Capacitor plugin.

const shareTargetShareMock = jest.fn();
jest.mock("@capacitor/core", () => ({
  registerPlugin: jest.fn(() => ({
    share: (...args: unknown[]) => shareTargetShareMock(...args),
  })),
  Capacitor: { isNativePlatform: () => true, getPlatform: () => "android" },
}));
const isNativeMock = jest.fn(() => true);
const isAndroidMock = jest.fn(() => true);
jest.mock("@/lib/platform", () => ({
  isNativePlatform: () => isNativeMock(),
  isAndroid: () => isAndroidMock(),
  isIOS: () => false,
  isWeb: () => false,
  getPlatform: () => "android",
}));
const upstreamShareMock = jest.fn();
jest.mock("@capacitor/share", () => ({
  Share: { share: (...args: unknown[]) => upstreamShareMock(...args) },
}));

import { normalizeShareTarget, shareContent } from "@/lib/share";

describe("normalizeShareTarget", () => {
  describe("invalid input", () => {
    it.each([undefined, null, 0, false, {}, [], ""])(
      "returns undefined for %p",
      (value) => {
        expect(normalizeShareTarget(value)).toBeUndefined();
      },
    );
  });

  describe("iOS UIActivity.ActivityType strings", () => {
    it("maps the Apple Messages activity type to 'messages'", () => {
      expect(
        normalizeShareTarget("com.apple.UIKit.activity.Message"),
      ).toBe("messages");
    });

    it("maps the Apple Mail activity type to 'mail'", () => {
      expect(normalizeShareTarget("com.apple.UIKit.activity.Mail")).toBe(
        "mail",
      );
    });

    it("maps WhatsApp's iOS share extension to 'whatsapp'", () => {
      expect(
        normalizeShareTarget("net.whatsapp.WhatsApp.ShareExtension"),
      ).toBe("whatsapp");
    });
  });

  describe("Android package names (Task #119)", () => {
    it("maps the WhatsApp Android package to 'whatsapp'", () => {
      expect(normalizeShareTarget("com.whatsapp")).toBe("whatsapp");
    });

    it("maps the Gmail Android package to 'gmail'", () => {
      expect(normalizeShareTarget("com.google.android.gm")).toBe("gmail");
    });

    it("maps the stock Android Messages package to 'messages'", () => {
      expect(
        normalizeShareTarget("com.google.android.apps.messaging"),
      ).toBe("messages");
    });

    it("buckets multiple Telegram package variants under 'telegram'", () => {
      expect(normalizeShareTarget("org.telegram.messenger")).toBe(
        "telegram",
      );
      expect(normalizeShareTarget("org.telegram.messenger.web")).toBe(
        "telegram",
      );
    });

    it("maps Slack's Android package (capitalised) to 'slack'", () => {
      // The Slack Android package literally publishes as "com.Slack" with
      // a capital S; verify the explicit mapping preserves that exact key
      // so it produces the same "slack" bucket as the iOS extension.
      expect(normalizeShareTarget("com.Slack")).toBe("slack");
    });

    it("buckets unmapped Android packages by their second-level segment", () => {
      // Long-tail Android packages we don't enumerate fall back to the
      // vendor segment so variants of the same vendor (com.acme.beta,
      // com.acme.regional) collapse into one "acme" row in the admin
      // breakdown instead of scattering across dozens of full package
      // strings.
      expect(
        normalizeShareTarget("com.acme.somerandomshareextension"),
      ).toBe("acme");
    });

    it("returns the same Android-token regardless of which platform sent it", () => {
      // The whole point of Task #119: iOS and Android shares to WhatsApp
      // collapse into the *same* bucket so the report is platform-unified.
      expect(normalizeShareTarget("com.whatsapp")).toBe(
        normalizeShareTarget("net.whatsapp.WhatsApp.ShareExtension"),
      );
    });
  });

  describe("unknown / fallback values", () => {
    it("preserves arbitrary short strings as-is", () => {
      expect(normalizeShareTarget("custom_target")).toBe("custom_target");
    });

    it("truncates very long unknown values to 64 chars", () => {
      const long = "x".repeat(200);
      const out = normalizeShareTarget(long);
      expect(out).toHaveLength(64);
      expect(out).toBe("x".repeat(64));
    });
  });
});

describe("shareContent — Android capture path (Task #119)", () => {
  beforeEach(() => {
    shareTargetShareMock.mockReset();
    upstreamShareMock.mockReset();
    isNativeMock.mockReturnValue(true);
    isAndroidMock.mockReturnValue(true);
  });

  it("routes Android shares through the custom ShareTarget plugin", async () => {
    shareTargetShareMock.mockResolvedValueOnce({
      shared: true,
      activityType: "com.whatsapp",
    });

    const result = await shareContent({
      title: "Book me",
      text: "Check this out",
      url: "https://example.com/u/123",
      dialogTitle: "Share booking link",
    });

    expect(shareTargetShareMock).toHaveBeenCalledTimes(1);
    expect(upstreamShareMock).not.toHaveBeenCalled();
    expect(shareTargetShareMock).toHaveBeenCalledWith({
      title: "Book me",
      text: "Check this out",
      url: "https://example.com/u/123",
      dialogTitle: "Share booking link",
    });
    expect(result).toEqual({ shared: true, target: "whatsapp" });
  });

  it("normalizes a late-arriving package name (out-of-order broadcast)", async () => {
    // Simulates the Android race the plugin handles: the chooser
    // activity returns first, then the chosen-component broadcast
    // arrives during the grace window. The bridge resolves with
    // shared:true + the late package name; the JS layer must normalize
    // it just like the synchronous case.
    shareTargetShareMock.mockResolvedValueOnce({
      shared: true,
      activityType: "com.google.android.gm",
    });
    const result = await shareContent({ url: "https://example.com" });
    expect(result).toEqual({ shared: true, target: "gmail" });
  });

  it("falls back to @capacitor/share when the custom plugin throws", async () => {
    shareTargetShareMock.mockRejectedValueOnce(new Error("bridge error"));
    upstreamShareMock.mockResolvedValueOnce({ activityType: "com.google.android.gm" });

    const result = await shareContent({ url: "https://example.com" });

    expect(shareTargetShareMock).toHaveBeenCalledTimes(1);
    expect(upstreamShareMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ shared: true, target: "gmail" });
  });

  it("propagates a user-dismissed Android share as not shared", async () => {
    shareTargetShareMock.mockResolvedValueOnce({ shared: false });

    const result = await shareContent({ url: "https://example.com" });

    expect(result.shared).toBe(false);
    expect(result.target).toBeUndefined();
    expect(upstreamShareMock).not.toHaveBeenCalled();
  });

  it("does not invoke the custom plugin on iOS", async () => {
    isAndroidMock.mockReturnValue(false);
    upstreamShareMock.mockResolvedValueOnce({
      activityType: "net.whatsapp.WhatsApp.ShareExtension",
    });

    const result = await shareContent({ url: "https://example.com" });

    expect(shareTargetShareMock).not.toHaveBeenCalled();
    expect(upstreamShareMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ shared: true, target: "whatsapp" });
  });
});
