import {
  isStopReply,
  maskPhone,
  resolveOptOutUserIdPure,
  STOP_KEYWORDS,
  STOP_REPLY_BODY,
  STOP_ACK_TWIML,
  EMPTY_TWIML,
} from "../../server/twilioStopOptOut";

describe("Twilio STOP webhook helpers", () => {
  describe("isStopReply (case-insensitive, trimmed)", () => {
    it("matches every locked keyword in any case with surrounding whitespace", () => {
      const cases = [
        "STOP",
        "stop",
        " Stop ",
        "STOPALL",
        " stopall ",
        "Unsubscribe",
        "UNSUBSCRIBE",
        "cancel",
        "CANCEL",
      ];
      for (const c of cases) {
        expect(isStopReply(c)).toBe(true);
      }
    });

    it("does NOT match phrases that contain a keyword as a substring", () => {
      ["please stop calling", "I want to cancel my appointment", "stop now please"].forEach((s) => {
        expect(isStopReply(s)).toBe(false);
      });
    });

    it("does not match unrelated replies", () => {
      ["yes", "help", "info", "hi", ""].forEach((s) => {
        expect(isStopReply(s)).toBe(false);
      });
    });

    it("treats null/undefined as not-a-STOP", () => {
      expect(isStopReply(null)).toBe(false);
      expect(isStopReply(undefined)).toBe(false);
    });

    it("exposes exactly the four locked keywords", () => {
      expect([...STOP_KEYWORDS].sort()).toEqual(["CANCEL", "STOP", "STOPALL", "UNSUBSCRIBE"]);
    });
  });

  describe("locked TwiML payloads", () => {
    it("renders the STOP acknowledgment TwiML with the locked confirmation copy verbatim", () => {
      expect(STOP_REPLY_BODY).toBe(
        "You're unsubscribed from GigAid messages. No more texts will be sent.",
      );
      expect(STOP_ACK_TWIML).toBe(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${STOP_REPLY_BODY}</Message></Response>`,
      );
    });

    it("renders the empty TwiML response verbatim", () => {
      expect(EMPTY_TWIML).toBe('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    });
  });

  describe("maskPhone (PII-safe logging)", () => {
    it("masks an E.164 phone to first 3 + *** + last 4", () => {
      expect(maskPhone("+15551234567")).toBe("+15***4567");
    });

    it("returns 'unknown' for null/undefined", () => {
      expect(maskPhone(null)).toBe("unknown");
      expect(maskPhone(undefined)).toBe("unknown");
    });

    it("returns *** for very short input (still PII-safe)", () => {
      expect(maskPhone("+15")).toBe("***");
    });
  });

  describe("resolveOptOutUserIdPure (ambiguity-safe phone resolution)", () => {
    it("matches the single user when exactly one user owns the phone", () => {
      const decision = resolveOptOutUserIdPure({
        phoneMatches: [{ id: "user-A" }],
        lastOutboundUserId: "user-Z",
      });
      expect(decision).toEqual({ kind: "matched", userId: "user-A", via: "phone_e164" });
    });

    it("returns ambiguous (and never silently picks one) when 2+ users share the phone", () => {
      const decision = resolveOptOutUserIdPure({
        phoneMatches: [{ id: "user-A" }, { id: "user-B" }],
        lastOutboundUserId: "user-Z",
      });
      expect(decision).toEqual({ kind: "ambiguous", reason: "multiple_users_share_phone" });
    });

    it("falls back to last-outbound recipient when no user owns the phone directly", () => {
      const decision = resolveOptOutUserIdPure({
        phoneMatches: [],
        lastOutboundUserId: "user-Z",
      });
      expect(decision).toEqual({ kind: "matched", userId: "user-Z", via: "last_outbound" });
    });

    it("returns unrecognized when no phone match and no recent outbound recipient exists", () => {
      const decision = resolveOptOutUserIdPure({
        phoneMatches: [],
        lastOutboundUserId: null,
      });
      expect(decision).toEqual({ kind: "unrecognized" });

      const decision2 = resolveOptOutUserIdPure({
        phoneMatches: [],
        lastOutboundUserId: undefined,
      });
      expect(decision2).toEqual({ kind: "unrecognized" });
    });
  });
});
