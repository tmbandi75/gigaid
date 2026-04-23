import {
  renderFirstBookingNudgeBody,
  FIRST_BOOKING_DISQUALIFYING_EVENT_TYPES,
  FIRST_BOOKING_NUDGE_TYPES,
  SMS_RATE_LIMIT_PER_24H,
  isSmsRateLimited,
} from "../../server/postJobMomentum";
import {
  resolveOptOutUserId,
  maskPhone,
  type OptOutResolverDeps,
} from "../../server/optOutResolver";

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
      expect(tenMin.endsWith("— Your partners at GigAid")).toBe(true);
      expect(oneDay.endsWith("— Your partners at GigAid")).toBe(true);
    });

    it("includes the brand 'GigAid' in the body itself, not just the signature", () => {
      const tenMin = renderFirstBookingNudgeBody("first_booking_nudge_10m", null);
      const oneDay = renderFirstBookingNudgeBody("first_booking_nudge_24h", null);
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

// ============================================================================
// Task #48 safeguards — exercise the real exported production functions.
// ============================================================================

describe("Task #48 AC #1: ambiguity-safe STOP resolution (real resolveOptOutUserId)", () => {
  function makeDeps(
    phoneMatches: string[],
    outboundUserIds: string[],
  ): OptOutResolverDeps {
    return {
      findUsersByPhoneE164: jest.fn(async () => phoneMatches.map((id) => ({ id }))),
      findRecentOutboundUserIds: jest.fn(async () => outboundUserIds),
    };
  }

  it("returns the user when exactly one phone_e164 match exists", async () => {
    const deps = makeDeps(["u-1"], []);
    await expect(resolveOptOutUserId("+15551110000", deps)).resolves.toBe("u-1");
    expect(deps.findUsersByPhoneE164).toHaveBeenCalledWith("+15551110000");
    // Outbound history should NOT have been consulted when phone match is unambiguous.
    expect(deps.findRecentOutboundUserIds).not.toHaveBeenCalled();
  });

  it("refuses (returns null) when 2+ users share the same phone_e164", async () => {
    const deps = makeDeps(["u-1", "u-2"], ["u-7"]);
    await expect(resolveOptOutUserId("+15551110000", deps)).resolves.toBeNull();
    // Must not fall through to the outbound history pass.
    expect(deps.findRecentOutboundUserIds).not.toHaveBeenCalled();
  });

  it("falls back to outbound history and returns the single distinct userId", async () => {
    const deps = makeDeps([], ["u-3", "u-3", "u-3"]);
    await expect(resolveOptOutUserId("+15551110000", deps)).resolves.toBe("u-3");
    expect(deps.findRecentOutboundUserIds).toHaveBeenCalledWith("+15551110000");
  });

  it("refuses when outbound history yields multiple distinct userIds", async () => {
    const deps = makeDeps([], ["u-1", "u-2"]);
    await expect(resolveOptOutUserId("+15551110000", deps)).resolves.toBeNull();
  });

  it("returns null when no user can be identified at all", async () => {
    const deps = makeDeps([], []);
    await expect(resolveOptOutUserId("+15551110000", deps)).resolves.toBeNull();
  });

  it("phone_e164 single match wins even when outbound history would be ambiguous", async () => {
    const deps = makeDeps(["u-winner"], ["u-x", "u-y"]);
    await expect(resolveOptOutUserId("+15551110000", deps)).resolves.toBe("u-winner");
    expect(deps.findRecentOutboundUserIds).not.toHaveBeenCalled();
  });

  it("filters out empty/null userIds from outbound history before counting distinctness", async () => {
    const deps = makeDeps([], ["u-only", "", "u-only"] as any);
    await expect(resolveOptOutUserId("+15551110000", deps)).resolves.toBe("u-only");
  });

  it("masks phone numbers in the log-format helper used by resolver warnings", () => {
    expect(maskPhone("+15551234567")).toBe("+15***4567");
    expect(maskPhone(null)).toBe("unknown");
    expect(maskPhone("+1234")).toBe("***");
  });
});

describe("Task #48 AC #3: per-user 24h SMS cap (real isSmsRateLimited)", () => {
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
    [99, true],
  ])(
    "drives the real isSmsRateLimited: count=%i in the last 24h -> rate-limited=%s",
    async (sentCount, expected) => {
      const fakeCounter = jest.fn(async () => sentCount);
      const limited = await isSmsRateLimited("user-X", fakeCounter);
      expect(limited).toBe(expected);
      expect(fakeCounter).toHaveBeenCalledWith("user-X");
      expect(fakeCounter).toHaveBeenCalledTimes(1);
    },
  );

  it("invokes the counter with the userId passed in", async () => {
    const fakeCounter = jest.fn(async () => 0);
    await isSmsRateLimited("specific-user-id-42", fakeCounter);
    expect(fakeCounter).toHaveBeenCalledWith("specific-user-id-42");
  });
});

// ----------------------------------------------------------------------------
// Task #48 AC #2: sent-is-terminal — DB-backed integration test against the
// BEFORE UPDATE trigger installed by createOutboundMessagesSentTerminalTrigger.
// Skipped when DATABASE_URL is unavailable so unit-test runs don't fail.
// ----------------------------------------------------------------------------

const dbDescribe = process.env.DATABASE_URL ? describe : describe.skip;

dbDescribe("Task #48 AC #2: sent-is-terminal trigger blocks demotion (DB-backed)", () => {
  // Cold pool connect + ensure-trigger-exists can exceed Jest's default 5s on
  // the first run. 30s is plenty for both DB tests in this block.
  jest.setTimeout(30000);

  it("rejects an UPDATE that tries to move a row out of status='sent'", async () => {
    const { pool } = await import("../../server/db");
    const { createOutboundMessagesSentTerminalTrigger } = await import(
      "../../server/dbEnforcement"
    );
    // Make sure the trigger exists even if this suite runs against a DB
    // where the server hasn't started yet.
    await createOutboundMessagesSentTerminalTrigger();

    const client = await pool.connect();
    try {
      const userId = `task48-test-user-${Date.now()}`;
      const ins = await client.query(
        `INSERT INTO outbound_messages
           (user_id, channel, to_address, type, status,
            scheduled_for, sent_at, created_at)
         VALUES ($1, 'sms', '+15550000000', 'task48_trigger_demo', 'sent',
            now()::text, now()::text, now()::text)
         RETURNING id`,
        [userId],
      );
      const id = ins.rows[0].id as string;

      try {
        let raised: Error | null = null;
        try {
          await client.query(
            `UPDATE outbound_messages SET status = 'canceled' WHERE id = $1`,
            [id],
          );
        } catch (e: any) {
          raised = e;
        }
        expect(raised).not.toBeNull();
        expect(String(raised?.message)).toMatch(/SENT_IS_TERMINAL/);

        // Confirm the row is still 'sent'.
        const after = await client.query(
          `SELECT status FROM outbound_messages WHERE id = $1`,
          [id],
        );
        expect(after.rows[0].status).toBe("sent");
      } finally {
        await client.query(`DELETE FROM outbound_messages WHERE id = $1`, [id]);
      }
    } finally {
      client.release();
    }
  });

  it("permits a no-op UPDATE that keeps status='sent' (e.g. metadata edits)", async () => {
    const { pool } = await import("../../server/db");
    const client = await pool.connect();
    try {
      const userId = `task48-test-user-noop-${Date.now()}`;
      const ins = await client.query(
        `INSERT INTO outbound_messages
           (user_id, channel, to_address, type, status,
            scheduled_for, sent_at, created_at)
         VALUES ($1, 'sms', '+15550000000', 'task48_trigger_demo', 'sent',
            now()::text, now()::text, now()::text)
         RETURNING id`,
        [userId],
      );
      const id = ins.rows[0].id as string;

      try {
        // Updating a non-status column on a sent row must succeed.
        await expect(
          client.query(
            `UPDATE outbound_messages SET updated_at = now()::text WHERE id = $1`,
            [id],
          ),
        ).resolves.toBeDefined();
      } finally {
        await client.query(`DELETE FROM outbound_messages WHERE id = $1`, [id]);
      }
    } finally {
      client.release();
    }
  });
});
