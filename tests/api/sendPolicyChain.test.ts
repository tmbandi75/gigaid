import {
  evaluateSendPolicy,
  CANCEL_REASONS,
  SMS_RATE_LIMIT_PER_24H,
  renderFirstBookingEmail,
  renderFirstBookingNudgeBody,
  FIRST_BOOKING_EMAIL_TYPES,
  FIRST_BOOKING_NUDGE_TYPES,
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

  describe("Task #74: first-booking emails go through the same eligibility gate", () => {
    const okEmailUser = { smsOptOut: false, notifyBySms: true, notifyByEmail: true };

    it.each(FIRST_BOOKING_EMAIL_TYPES)(
      "%s -> cancel action_taken when a link_copied/link_shared event has been recorded",
      (type) => {
        const decision = evaluateSendPolicy({
          channel: "email",
          type,
          bookingPageId: "page-abc",
          user: okEmailUser,
          bookingPageClaimed: true,
          disqualifyingEventCount: 1,
        });
        expect(decision).toEqual({ kind: "cancel", reason: "action_taken" });
      },
    );

    it.each(FIRST_BOOKING_EMAIL_TYPES)(
      "%s -> cancel user_opted_out when notifyByEmail === false",
      (type) => {
        const decision = evaluateSendPolicy({
          channel: "email",
          type,
          bookingPageId: "page-abc",
          user: { smsOptOut: false, notifyBySms: true, notifyByEmail: false },
          bookingPageClaimed: true,
          disqualifyingEventCount: 0,
        });
        expect(decision).toEqual({ kind: "cancel", reason: "user_opted_out" });
      },
    );

    it.each(FIRST_BOOKING_EMAIL_TYPES)(
      "%s -> NOT canceled by smsOptOut (SMS opt-out flag does not gate emails)",
      (type) => {
        const decision = evaluateSendPolicy({
          channel: "email",
          type,
          bookingPageId: "page-abc",
          user: { smsOptOut: true, notifyBySms: false, notifyByEmail: true },
          bookingPageClaimed: true,
          disqualifyingEventCount: 0,
        });
        expect(decision).toEqual({ kind: "allow" });
      },
    );

    it.each(FIRST_BOOKING_EMAIL_TYPES)(
      "%s -> cancel missing_booking_page when bookingPageId is null",
      (type) => {
        const decision = evaluateSendPolicy({
          channel: "email",
          type,
          bookingPageId: null,
          user: okEmailUser,
        });
        expect(decision).toEqual({ kind: "cancel", reason: "missing_booking_page" });
      },
    );

    it("first_booking_nudge_72h SMS still gated by smsOptOut and action_taken", () => {
      // smsOptOut wins
      expect(
        evaluateSendPolicy({
          channel: "sms",
          type: "first_booking_nudge_72h",
          bookingPageId: "page-abc",
          user: { smsOptOut: true, notifyBySms: true, notifyByEmail: true },
          bookingPageClaimed: true,
          disqualifyingEventCount: 0,
        }),
      ).toEqual({ kind: "cancel", reason: "user_opted_out" });

      // action_taken when an event has been recorded
      expect(
        evaluateSendPolicy({
          channel: "sms",
          type: "first_booking_nudge_72h",
          bookingPageId: "page-abc",
          user: okEmailUser,
          bookingPageClaimed: true,
          disqualifyingEventCount: 2,
        }),
      ).toEqual({ kind: "cancel", reason: "action_taken" });

      // happy path
      expect(
        evaluateSendPolicy({
          channel: "sms",
          type: "first_booking_nudge_72h",
          bookingPageId: "page-abc",
          user: okEmailUser,
          bookingPageClaimed: true,
          disqualifyingEventCount: 0,
        }),
      ).toEqual({ kind: "allow" });
    });

    it("non-first-booking email types are unaffected by notifyByEmail (back-compat)", () => {
      // Legacy invoice / review reminders never consulted notifyByEmail before
      // Task #74; keep that behavior intact so we don't regress them.
      const decision = evaluateSendPolicy({
        channel: "email",
        type: "payment_reminder",
        bookingPageId: null,
        user: { smsOptOut: false, notifyBySms: true, notifyByEmail: false },
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
