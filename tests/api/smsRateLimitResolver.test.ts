import {
  resolveSmsRateLimit,
  SMS_RATE_LIMIT_PER_24H,
  evaluateSendPolicy,
  CANCEL_REASONS,
} from "../../server/postJobMomentum";

describe("resolveSmsRateLimit (per-plan + per-user override)", () => {
  describe("plan defaults", () => {
    it("free plan uses the locked free-tier cap (matches SMS_RATE_LIMIT_PER_24H)", () => {
      expect(resolveSmsRateLimit("free")).toBe(SMS_RATE_LIMIT_PER_24H);
      expect(resolveSmsRateLimit("free")).toBe(3);
    });

    it("pro plan gets a higher numeric cap than free", () => {
      const cap = resolveSmsRateLimit("pro");
      expect(typeof cap).toBe("number");
      expect(cap as number).toBeGreaterThan(SMS_RATE_LIMIT_PER_24H);
    });

    it("pro_plus plan gets a higher numeric cap than pro", () => {
      const proCap = resolveSmsRateLimit("pro") as number;
      const proPlusCap = resolveSmsRateLimit("pro_plus") as number;
      expect(proPlusCap).toBeGreaterThan(proCap);
    });

    it("business plan is unlimited (no cap)", () => {
      expect(resolveSmsRateLimit("business")).toBeUndefined();
    });

    it("missing plan falls back to the free-tier default", () => {
      expect(resolveSmsRateLimit(null)).toBe(SMS_RATE_LIMIT_PER_24H);
      expect(resolveSmsRateLimit(undefined)).toBe(SMS_RATE_LIMIT_PER_24H);
    });
  });

  describe("per-user override beats plan default", () => {
    it("positive override replaces a free-plan cap", () => {
      expect(resolveSmsRateLimit("free", 25)).toBe(25);
    });

    it("positive override replaces a paid-plan cap (even when smaller)", () => {
      expect(resolveSmsRateLimit("pro", 5)).toBe(5);
      expect(resolveSmsRateLimit("pro_plus", 7)).toBe(7);
    });

    it("override of 0 or negative means unlimited (uncapped)", () => {
      expect(resolveSmsRateLimit("free", 0)).toBeUndefined();
      expect(resolveSmsRateLimit("free", -1)).toBeUndefined();
    });

    it("null / undefined override defers to the plan default", () => {
      expect(resolveSmsRateLimit("free", null)).toBe(SMS_RATE_LIMIT_PER_24H);
      expect(resolveSmsRateLimit("pro", undefined)).toBe(
        resolveSmsRateLimit("pro"),
      );
    });

    it("override on a Business plan can RE-IMPOSE a cap that the plan removed", () => {
      expect(resolveSmsRateLimit("business")).toBeUndefined();
      expect(resolveSmsRateLimit("business", 100)).toBe(100);
    });
  });

  describe("integration with evaluateSendPolicy", () => {
    const okUser = { smsOptOut: false, notifyBySms: true };

    it("free user is capped at the free-tier number", () => {
      const cap = resolveSmsRateLimit("free")!;
      const decision = evaluateSendPolicy({
        channel: "sms",
        type: "followup",
        bookingPageId: null,
        user: okUser,
        recentSmsSentCount: cap,
        maxSmsPerWindow: cap,
      });
      expect(decision).toEqual({
        kind: "cancel",
        reason: CANCEL_REASONS.RATE_LIMITED,
      });
    });

    it("pro user can send well past the free-tier cap", () => {
      const proCap = resolveSmsRateLimit("pro")!;
      const decision = evaluateSendPolicy({
        channel: "sms",
        type: "followup",
        bookingPageId: null,
        user: okUser,
        // Just above free-tier cap, well below pro cap.
        recentSmsSentCount: SMS_RATE_LIMIT_PER_24H + 1,
        maxSmsPerWindow: proCap,
      });
      expect(decision).toEqual({ kind: "allow" });
    });

    it("business user is never rate-limited (undefined cap skips guard)", () => {
      const cap = resolveSmsRateLimit("business");
      expect(cap).toBeUndefined();
      const decision = evaluateSendPolicy({
        channel: "sms",
        type: "followup",
        bookingPageId: null,
        user: okUser,
        recentSmsSentCount: 100000,
        maxSmsPerWindow: cap,
      });
      expect(decision).toEqual({ kind: "allow" });
    });

    it("per-user override beats plan default at the policy chain", () => {
      // Free plan would cap at SMS_RATE_LIMIT_PER_24H, override raises to 50.
      const cap = resolveSmsRateLimit("free", 50);
      expect(cap).toBe(50);
      const allow = evaluateSendPolicy({
        channel: "sms",
        type: "followup",
        bookingPageId: null,
        user: okUser,
        recentSmsSentCount: 49,
        maxSmsPerWindow: cap,
      });
      expect(allow).toEqual({ kind: "allow" });

      const block = evaluateSendPolicy({
        channel: "sms",
        type: "followup",
        bookingPageId: null,
        user: okUser,
        recentSmsSentCount: 50,
        maxSmsPerWindow: cap,
      });
      expect(block).toEqual({
        kind: "cancel",
        reason: CANCEL_REASONS.RATE_LIMITED,
      });
    });

    it("override can also lower a paid plan cap", () => {
      // Pro plan default is high; override clamps to 4.
      const cap = resolveSmsRateLimit("pro", 4);
      expect(cap).toBe(4);
      const decision = evaluateSendPolicy({
        channel: "sms",
        type: "followup",
        bookingPageId: null,
        user: okUser,
        recentSmsSentCount: 4,
        maxSmsPerWindow: cap,
      });
      expect(decision).toEqual({
        kind: "cancel",
        reason: CANCEL_REASONS.RATE_LIMITED,
      });
    });
  });
});
