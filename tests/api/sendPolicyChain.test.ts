import {
  evaluateSendPolicy,
  CANCEL_REASONS,
  SMS_RATE_LIMIT_PER_24H,
} from "../../server/postJobMomentum";

const RATE_CAP = SMS_RATE_LIMIT_PER_24H;

const okUser = { smsOptOut: false, notifyBySms: true };

describe("Send-time policy chain (evaluateSendPolicy)", () => {
  describe("opt-out guard", () => {
    it("cancels with user_opted_out when smsOptOut === true", () => {
      const decision = evaluateSendPolicy({
        channel: "sms",
        type: "followup",
        bookingPageId: null,
        user: { smsOptOut: true, notifyBySms: true },
      });
      expect(decision).toEqual({ kind: "cancel", reason: CANCEL_REASONS.USER_OPTED_OUT });
      expect(decision.kind === "cancel" && decision.reason).toBe("user_opted_out");
    });

    it("cancels with user_opted_out when notifyBySms === false (legacy preference)", () => {
      const decision = evaluateSendPolicy({
        channel: "sms",
        type: "followup",
        bookingPageId: null,
        user: { smsOptOut: false, notifyBySms: false },
      });
      expect(decision).toEqual({ kind: "cancel", reason: "user_opted_out" });
    });

    it("cancels with user_not_found when the user record is missing", () => {
      const decision = evaluateSendPolicy({
        channel: "sms",
        type: "followup",
        bookingPageId: null,
        user: null,
      });
      expect(decision).toEqual({ kind: "cancel", reason: "user_not_found" });
    });
  });

  describe("rate limit guard", () => {
    it("cancels with rate_limited when recent sends >= cap", () => {
      const decision = evaluateSendPolicy({
        channel: "sms",
        type: "followup",
        bookingPageId: null,
        user: okUser,
        recentSmsSentCount: RATE_CAP,
        maxSmsPerWindow: RATE_CAP,
      });
      expect(decision).toEqual({ kind: "cancel", reason: "rate_limited" });
    });

    it("allows when recent sends are just under the cap", () => {
      const decision = evaluateSendPolicy({
        channel: "sms",
        type: "followup",
        bookingPageId: null,
        user: okUser,
        recentSmsSentCount: RATE_CAP - 1,
        maxSmsPerWindow: RATE_CAP,
      });
      expect(decision).toEqual({ kind: "allow" });
    });

    it("opt-out beats rate limit (a STOPped user is reported as user_opted_out, not rate_limited)", () => {
      const decision = evaluateSendPolicy({
        channel: "sms",
        type: "followup",
        bookingPageId: null,
        user: { smsOptOut: true, notifyBySms: true },
        recentSmsSentCount: 9999,
        maxSmsPerWindow: RATE_CAP,
      });
      expect(decision).toEqual({ kind: "cancel", reason: "user_opted_out" });
    });

    it("does not enforce rate limit when no max is provided", () => {
      const decision = evaluateSendPolicy({
        channel: "sms",
        type: "followup",
        bookingPageId: null,
        user: okUser,
        recentSmsSentCount: 9999,
      });
      expect(decision).toEqual({ kind: "allow" });
    });
  });

  describe("first-booking eligibility guard", () => {
    it("cancels with missing_booking_page when a nudge has no bookingPageId", () => {
      const decision = evaluateSendPolicy({
        channel: "sms",
        type: "first_booking_nudge_10m",
        bookingPageId: null,
        user: okUser,
      });
      expect(decision).toEqual({ kind: "cancel", reason: "missing_booking_page" });
    });

    it("cancels with action_taken when the booking page is unclaimed", () => {
      const decision = evaluateSendPolicy({
        channel: "sms",
        type: "first_booking_nudge_10m",
        bookingPageId: "page-123",
        user: okUser,
        bookingPageClaimed: false,
        disqualifyingEventCount: 0,
      });
      expect(decision).toEqual({ kind: "cancel", reason: "action_taken" });
    });

    it("cancels with action_taken when there is at least one disqualifying booking_page_event", () => {
      const decision = evaluateSendPolicy({
        channel: "sms",
        type: "first_booking_nudge_10m",
        bookingPageId: "page-123",
        user: okUser,
        bookingPageClaimed: true,
        disqualifyingEventCount: 1,
      });
      expect(decision).toEqual({ kind: "cancel", reason: "action_taken" });
    });

    it("allows a claimed page with no disqualifying events", () => {
      const decision = evaluateSendPolicy({
        channel: "sms",
        type: "first_booking_nudge_24h",
        bookingPageId: "page-123",
        user: okUser,
        bookingPageClaimed: true,
        disqualifyingEventCount: 0,
      });
      expect(decision).toEqual({ kind: "allow" });
    });

    it("does not run first-booking checks for non-nudge SMS types (e.g. followup)", () => {
      const decision = evaluateSendPolicy({
        channel: "sms",
        type: "followup",
        // No bookingPageId, no claimed flag, but followups don't care:
        bookingPageId: null,
        user: okUser,
        bookingPageClaimed: false,
        disqualifyingEventCount: 5,
      });
      expect(decision).toEqual({ kind: "allow" });
    });
  });

  describe("email channel skips SMS-only guards", () => {
    it("allows email even when smsOptOut is true", () => {
      const decision = evaluateSendPolicy({
        channel: "email",
        type: "followup",
        bookingPageId: null,
        user: { smsOptOut: true, notifyBySms: false },
      });
      expect(decision).toEqual({ kind: "allow" });
    });

    it("allows email even when the user is over the SMS rate limit", () => {
      const decision = evaluateSendPolicy({
        channel: "email",
        type: "followup",
        bookingPageId: null,
        user: okUser,
        recentSmsSentCount: 9999,
        maxSmsPerWindow: RATE_CAP,
      });
      expect(decision).toEqual({ kind: "allow" });
    });
  });

  describe("guard ordering", () => {
    it("opt-out beats first-booking eligibility (a STOPped user is reported as user_opted_out, not action_taken)", () => {
      const decision = evaluateSendPolicy({
        channel: "sms",
        type: "first_booking_nudge_10m",
        bookingPageId: "page-123",
        user: { smsOptOut: true, notifyBySms: true },
        bookingPageClaimed: false,
        disqualifyingEventCount: 5,
      });
      expect(decision).toEqual({ kind: "cancel", reason: "user_opted_out" });
    });

    it("rate limit beats first-booking eligibility", () => {
      const decision = evaluateSendPolicy({
        channel: "sms",
        type: "first_booking_nudge_10m",
        bookingPageId: "page-123",
        user: okUser,
        recentSmsSentCount: RATE_CAP,
        maxSmsPerWindow: RATE_CAP,
        bookingPageClaimed: false,
        disqualifyingEventCount: 5,
      });
      expect(decision).toEqual({ kind: "cancel", reason: "rate_limited" });
    });
  });
});
