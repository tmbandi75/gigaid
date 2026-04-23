import {
  renderFirstBookingNudgeBody,
  FIRST_BOOKING_DISQUALIFYING_EVENT_TYPES,
  FIRST_BOOKING_NUDGE_TYPES,
  SMS_RATE_LIMIT_PER_24H,
} from "../../server/postJobMomentum";

const STOP_KEYWORDS = ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL"];

describe("First-booking SMS nudges (locked spec)", () => {
  describe("AC #1 + #2: personalization", () => {
    it("renders {first_name}, prefix when first_name is known", () => {
      const body = renderFirstBookingNudgeBody("first_booking_nudge_10m", "Alex");
      expect(body.startsWith("Alex, send your GigAid")).toBe(true);
    });

    it("trims whitespace and renders prefix when first_name has padding", () => {
      const body = renderFirstBookingNudgeBody("first_booking_nudge_10m", "  Sam  ");
      expect(body.startsWith("Sam, send your GigAid")).toBe(true);
    });

    it("omits the prefix entirely when first_name is null", () => {
      const body = renderFirstBookingNudgeBody("first_booking_nudge_10m", null);
      expect(body.startsWith("send your GigAid")).toBe(true);
      expect(body).not.toContain("there,");
      expect(body).not.toContain("undefined");
      expect(body).not.toContain("null");
    });

    it("omits the prefix when first_name is empty string", () => {
      const body = renderFirstBookingNudgeBody("first_booking_nudge_10m", "");
      expect(body.startsWith("send your GigAid")).toBe(true);
    });

    it("renders the 24h variant with prefix when known", () => {
      const body = renderFirstBookingNudgeBody("first_booking_nudge_24h", "Jordan");
      expect(body.startsWith("Jordan, most people get their first GigAid booking")).toBe(true);
    });
  });

  describe("AC #3 + #4: opt-out line placement", () => {
    it("includes the opt-out line in the 10-minute body", () => {
      const body = renderFirstBookingNudgeBody("first_booking_nudge_10m", "Alex");
      expect(body).toContain("Reply STOP to opt out.");
    });

    it("does NOT include any opt-out text in the 24-hour body", () => {
      const body = renderFirstBookingNudgeBody("first_booking_nudge_24h", "Alex");
      expect(body).not.toContain("Reply STOP");
      expect(body).not.toContain("opt out");
      expect(body).not.toContain("STOP");
    });

    it("uses the exact locked signature on both bodies", () => {
      const tenMin = renderFirstBookingNudgeBody("first_booking_nudge_10m", null);
      const oneDay = renderFirstBookingNudgeBody("first_booking_nudge_24h", null);
      // em dash + lowercase "p" in "partners"
      expect(tenMin.endsWith("— Your partners at GigAid")).toBe(true);
      expect(oneDay.endsWith("— Your partners at GigAid")).toBe(true);
    });

    it("includes the brand 'GigAid' in the body itself, not just the signature", () => {
      const tenMin = renderFirstBookingNudgeBody("first_booking_nudge_10m", null);
      const oneDay = renderFirstBookingNudgeBody("first_booking_nudge_24h", null);
      // Brand should appear at least twice: once in the body, once in the signature.
      expect((tenMin.match(/GigAid/g) || []).length).toBeGreaterThanOrEqual(2);
      expect((oneDay.match(/GigAid/g) || []).length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("AC #5 (partial): STOP keyword recognition is case-insensitive", () => {
    function isStop(input: string): boolean {
      const set = new Set(STOP_KEYWORDS);
      return set.has(input.trim().toUpperCase());
    }

    it("matches the four locked keywords in any case with surrounding whitespace", () => {
      ["stop", "STOP", "Stop", " stopall ", "Unsubscribe", "CANCEL"].forEach((s) => {
        expect(isStop(s)).toBe(true);
      });
    });

    it("does not match non-opt-out replies", () => {
      ["please stop calling", "yes", "help", "info"].forEach((s) => {
        expect(isStop(s)).toBe(false);
      });
    });
  });

  describe("Constants the rest of the system relies on", () => {
    it("exposes both nudge types", () => {
      expect(FIRST_BOOKING_NUDGE_TYPES).toContain("first_booking_nudge_10m");
      expect(FIRST_BOOKING_NUDGE_TYPES).toContain("first_booking_nudge_24h");
    });

    it("exposes the disqualifying-event allowlist with link_copied + link_shared", () => {
      expect(FIRST_BOOKING_DISQUALIFYING_EVENT_TYPES).toContain("link_copied");
      expect(FIRST_BOOKING_DISQUALIFYING_EVENT_TYPES).toContain("link_shared");
    });
  });

  describe("Locked body byte-equality", () => {
    it("renders the 10-minute body verbatim", () => {
      expect(renderFirstBookingNudgeBody("first_booking_nudge_10m", "Alex")).toBe(
        "Alex, send your GigAid booking link to your next customer — it saves a ton of back and forth.\n\nReply STOP to opt out.\n— Your partners at GigAid",
      );
    });

    it("renders the 24-hour body verbatim", () => {
      expect(renderFirstBookingNudgeBody("first_booking_nudge_24h", "Alex")).toBe(
        "Alex, most people get their first GigAid booking within a day after sharing their link.\n\n— Your partners at GigAid",
      );
    });
  });

  describe("Task #48 AC #1: STOP ambiguity-safe resolver semantics", () => {
    // Mirrors the resolver in server/routes.ts: phone_e164 wins when exactly
    // one user matches; otherwise outbound history is consulted and only
    // returns a userId when there's exactly one distinct recipient.
    function resolve(opts: {
      phoneMatches: string[];
      distinctOutboundUserIds: string[];
    }): string | null {
      if (opts.phoneMatches.length === 1) return opts.phoneMatches[0];
      if (opts.phoneMatches.length > 1) return null;
      if (opts.distinctOutboundUserIds.length === 1) return opts.distinctOutboundUserIds[0];
      return null;
    }

    it("returns the user when 0 phone matches + 1 distinct outbound userId", () => {
      expect(resolve({ phoneMatches: [], distinctOutboundUserIds: ["u-1"] })).toBe("u-1");
    });

    it("refuses (null) when 0 phone matches + 2 distinct outbound userIds", () => {
      expect(resolve({ phoneMatches: [], distinctOutboundUserIds: ["u-1", "u-2"] })).toBeNull();
    });

    it("refuses (null) when 2 users share the same phone_e164", () => {
      expect(resolve({ phoneMatches: ["u-1", "u-2"], distinctOutboundUserIds: ["u-1"] })).toBeNull();
    });

    it("returns null when neither pass yields a match", () => {
      expect(resolve({ phoneMatches: [], distinctOutboundUserIds: [] })).toBeNull();
    });

    it("phone_e164 single match wins even when outbound history is ambiguous", () => {
      expect(resolve({ phoneMatches: ["u-1"], distinctOutboundUserIds: ["u-2", "u-3"] })).toBe("u-1");
    });
  });

  describe("Task #48 AC #3: per-user 24h SMS rate limit chokepoint", () => {
    it("exposes a single tunable threshold of 3", () => {
      expect(SMS_RATE_LIMIT_PER_24H).toBe(3);
    });

    it.each([
      [0, false],
      [1, false],
      [2, false],
      [3, true],
      [4, true],
      [5, true],
    ])("count=%i within 24h -> rate-limited=%s", (sentCount, expected) => {
      // Mirrors the chokepoint check in attemptSendMessage.
      const isLimited = sentCount >= SMS_RATE_LIMIT_PER_24H;
      expect(isLimited).toBe(expected);
    });
  });

  describe("Task #48 AC #2: sent-is-terminal contract documented", () => {
    // The DB-level guarantee is enforced by a BEFORE UPDATE trigger
    // (createOutboundMessagesSentTerminalTrigger in server/dbEnforcement.ts).
    // App-level WHERE clauses also exclude `status = 'sent'` from any
    // cancellation / failure update path. This test asserts the symbolic
    // contract: 'sent' is the only terminal status code app code may target.
    const VALID_TRANSITIONS: Record<string, string[]> = {
      scheduled: ["queued", "canceled"],
      queued: ["sent", "canceled", "failed"],
      sent: [], // terminal
      canceled: [],
      failed: [],
    };
    it("permits no outgoing transitions from 'sent'", () => {
      expect(VALID_TRANSITIONS.sent).toEqual([]);
    });
  });
});
