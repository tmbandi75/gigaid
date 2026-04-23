import {
  renderFirstBookingNudgeBody,
  FIRST_BOOKING_DISQUALIFYING_EVENT_TYPES,
  FIRST_BOOKING_NUDGE_TYPES,
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
});
