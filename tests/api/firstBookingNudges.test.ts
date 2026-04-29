import {
  renderFirstBookingNudgeBody,
  renderFirstBookingEmail,
  FIRST_BOOKING_DISQUALIFYING_EVENT_TYPES,
  FIRST_BOOKING_NUDGE_TYPES,
  FIRST_BOOKING_EMAIL_TYPES,
  isFirstBookingTouchType,
  SMS_RATE_LIMIT_PER_24H,
  isSmsRateLimited,
} from "../../server/postJobMomentum";
import {
  resolveOptOutUserId,
  resolveOptOutWithReason,
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

  describe("Task #74: 72h SMS nudge body", () => {
    it("renders the 72-hour body verbatim with first_name prefix", () => {
      expect(renderFirstBookingNudgeBody("first_booking_nudge_72h", "Riley")).toBe(
        "Riley, still haven't shared your GigAid link? Your next customer could book in seconds.\n\n— Your partners at GigAid",
      );
    });

    it("renders the 72-hour body without prefix when first_name is missing", () => {
      const body = renderFirstBookingNudgeBody("first_booking_nudge_72h", null);
      expect(body.startsWith("still haven't shared your GigAid link?")).toBe(true);
      expect(body.endsWith("— Your partners at GigAid")).toBe(true);
      expect(body).not.toContain("Reply STOP");
      expect(body).not.toContain("there,");
    });

    it("isFirstBookingTouchType covers all SMS + email types", () => {
      for (const t of FIRST_BOOKING_NUDGE_TYPES) expect(isFirstBookingTouchType(t)).toBe(true);
      for (const t of FIRST_BOOKING_EMAIL_TYPES) expect(isFirstBookingTouchType(t)).toBe(true);
      expect(isFirstBookingTouchType("followup")).toBe(false);
    });
  });

  describe("Task #74: renderFirstBookingEmail", () => {
    const URL = "https://gigaid.app/book/page-xyz";

    it("first_booking_email_2h: subject + first line + signature + CTA URL all present (with first_name)", () => {
      const out = renderFirstBookingEmail("first_booking_email_2h", "Sam", URL);
      expect(out.subject).toBe(
        "Your GigAid page is ready — here's how to get your first booking",
      );
      expect(out.text.split("\n")[0]).toBe(
        "Sam, your GigAid page is ready — here's how to get your first booking",
      );
      expect(out.text.trim().endsWith("— Your partners at GigAid")).toBe(true);
      expect(out.text).toContain(URL);
      expect(out.html).toContain(URL);
      expect(out.html).toContain("Copy My Booking Link");
      expect(out.html.length).toBeGreaterThan(out.text.length / 2);
    });

    it("first_booking_email_2h: omits prefix when first_name is null", () => {
      const out = renderFirstBookingEmail("first_booking_email_2h", null, URL);
      expect(out.text.split("\n")[0]).toBe(
        "your GigAid page is ready — here's how to get your first booking",
      );
      expect(out.text).not.toContain("there,");
      expect(out.text).not.toContain("undefined");
    });

    it("first_booking_email_48h: subject + first line + signature + CTA URL all present (with first_name)", () => {
      const out = renderFirstBookingEmail("first_booking_email_48h", "Jordan", URL);
      expect(out.subject).toBe("Don't miss your first booking");
      expect(out.text.split("\n")[0]).toBe("Jordan, don't miss your first booking");
      expect(out.text.trim().endsWith("— Your partners at GigAid")).toBe(true);
      expect(out.text).toContain("It takes 10 seconds to send.");
      expect(out.text).toContain(URL);
      expect(out.html).toContain("Send My Booking Link");
      expect(out.html).toContain(URL);
    });

    it("first_booking_email_48h: omits prefix when first_name is empty/whitespace", () => {
      const out = renderFirstBookingEmail("first_booking_email_48h", "   ", URL);
      expect(out.text.split("\n")[0]).toBe("don't miss your first booking");
    });

    it("HTML escaping: a hostile bookingUrl is escaped, not injected as raw HTML", () => {
      const hostile = "https://x.test/?q=<script>alert(1)</script>&y=1";
      const out = renderFirstBookingEmail("first_booking_email_2h", "Sam", hostile);
      expect(out.html).not.toContain("<script>alert(1)</script>");
      expect(out.html).toContain("&lt;script&gt;");
      expect(out.html).toContain("&amp;y=1");
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
    const deps = makeDeps([], ["u-only", "", "u-only"]);
    await expect(resolveOptOutUserId("+15551110000", deps)).resolves.toBe("u-only");
  });

  it("masks phone numbers in the log-format helper used by resolver warnings", () => {
    expect(maskPhone("+15551234567")).toBe("+15***4567");
    expect(maskPhone(null)).toBe("unknown");
    expect(maskPhone("+1234")).toBe("***");
  });
});

// ============================================================================
// Task #62: resolveOptOutWithReason — same dispatch as resolveOptOutUserId
// but also classifies the outcome as matched / unmatched / ambiguous so the
// audit row in sms_optout_events records *why* a STOP went unattributed.
// ============================================================================

describe("Task #62: resolveOptOutWithReason classifies STOP audit reasons", () => {
  function makeDeps(
    phoneMatches: string[],
    outboundUserIds: string[],
  ): OptOutResolverDeps {
    return {
      findUsersByPhoneE164: jest.fn(async () => phoneMatches.map((id) => ({ id }))),
      findRecentOutboundUserIds: jest.fn(async () => outboundUserIds),
    };
  }

  it("returns matched + the userId when exactly one phone_e164 row exists", async () => {
    const deps = makeDeps(["u-1"], []);
    await expect(resolveOptOutWithReason("+15551110000", deps)).resolves.toEqual({
      userId: "u-1",
      resolution: "matched",
    });
    expect(deps.findUsersByPhoneE164).toHaveBeenCalledWith("+15551110000");
    // Outbound history must NOT be consulted when the phone match is unambiguous.
    expect(deps.findRecentOutboundUserIds).not.toHaveBeenCalled();
  });

  it("returns ambiguous (userId=null) when 2+ users share the same phone_e164", async () => {
    const deps = makeDeps(["u-1", "u-2"], ["u-7"]);
    await expect(resolveOptOutWithReason("+15551110000", deps)).resolves.toEqual({
      userId: null,
      resolution: "ambiguous",
    });
    // Must not fall through to the outbound history pass.
    expect(deps.findRecentOutboundUserIds).not.toHaveBeenCalled();
  });

  it("returns matched via outbound history when exactly one distinct userId is found", async () => {
    const deps = makeDeps([], ["u-3", "u-3", "u-3"]);
    await expect(resolveOptOutWithReason("+15551110000", deps)).resolves.toEqual({
      userId: "u-3",
      resolution: "matched",
    });
    expect(deps.findRecentOutboundUserIds).toHaveBeenCalledWith("+15551110000");
  });

  it("returns ambiguous when outbound history yields multiple distinct userIds", async () => {
    const deps = makeDeps([], ["u-1", "u-2"]);
    await expect(resolveOptOutWithReason("+15551110000", deps)).resolves.toEqual({
      userId: null,
      resolution: "ambiguous",
    });
  });

  it("returns unmatched (userId=null) when no user can be identified at all", async () => {
    const deps = makeDeps([], []);
    await expect(resolveOptOutWithReason("+15551110000", deps)).resolves.toEqual({
      userId: null,
      resolution: "unmatched",
    });
  });

  it("phone_e164 single match wins over an ambiguous outbound history", async () => {
    const deps = makeDeps(["u-winner"], ["u-x", "u-y"]);
    await expect(resolveOptOutWithReason("+15551110000", deps)).resolves.toEqual({
      userId: "u-winner",
      resolution: "matched",
    });
    expect(deps.findRecentOutboundUserIds).not.toHaveBeenCalled();
  });

  it("filters empty/null outbound userIds before deciding distinctness (still matched)", async () => {
    const deps = makeDeps([], ["u-only", "", "u-only"]);
    await expect(resolveOptOutWithReason("+15551110000", deps)).resolves.toEqual({
      userId: "u-only",
      resolution: "matched",
    });
  });

  it("matches resolveOptOutUserId on the resolved userId for every reason class", async () => {
    // Cross-check the two helpers can never disagree on who the user is —
    // resolveOptOutWithReason must be a strict superset of resolveOptOutUserId.
    const cases: { phone: string[]; outbound: string[] }[] = [
      { phone: ["u-1"], outbound: [] },
      { phone: ["u-1", "u-2"], outbound: ["u-7"] },
      { phone: [], outbound: ["u-3", "u-3"] },
      { phone: [], outbound: ["u-1", "u-2"] },
      { phone: [], outbound: [] },
      { phone: ["u-w"], outbound: ["u-x", "u-y"] },
    ];
    for (const c of cases) {
      const deps1 = makeDeps(c.phone, c.outbound);
      const deps2 = makeDeps(c.phone, c.outbound);
      const idOnly = await resolveOptOutUserId("+15551110000", deps1);
      const withReason = await resolveOptOutWithReason("+15551110000", deps2);
      expect(withReason.userId).toBe(idOnly);
      expect(["matched", "unmatched", "ambiguous"]).toContain(withReason.resolution);
    }
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

dbDescribe("Task #74 AC #7: worker round-trip cancels new touches when link_copied event exists", () => {
  jest.setTimeout(45000);

  const newTouchTypes: Array<{ type: string; channel: "sms" | "email"; toAddress: string }> = [
    { type: "first_booking_email_2h", channel: "email", toAddress: "round-trip@example.com" },
    { type: "first_booking_email_48h", channel: "email", toAddress: "round-trip@example.com" },
    { type: "first_booking_nudge_72h", channel: "sms", toAddress: "+15550000074" },
  ];

  for (const touch of newTouchTypes) {
    it(`cancels ${touch.type} when link_copied event exists at dequeue time`, async () => {
      const { pool, db } = await import("../../server/db");
      const { processScheduledMessages } = await import("../../server/postJobMomentum");
      const { outboundMessages, bookingPages, bookingPageEvents, users } = await import(
        "../../shared/schema"
      );
      const { eq } = await import("drizzle-orm");

      const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
      const userId = `task74-rt-user-${suffix}`;
      const client = await pool.connect();

      try {
        await client.query(
          `INSERT INTO users (id, username, password, email, phone, notify_by_email, notify_by_sms, sms_opt_out)
           VALUES ($1, $2, 'unused', $3, $4, true, true, false)`,
          [userId, `task74-rt-${suffix}`, "round-trip@example.com", "+15550000074"],
        );

        const pageIns = await client.query(
          `INSERT INTO booking_pages (claimed, claimed_by_user_id) VALUES (true, $1) RETURNING id`,
          [userId],
        );
        const pageId = pageIns.rows[0].id as string;

        await client.query(
          `INSERT INTO booking_page_events (page_id, type) VALUES ($1, 'link_copied')`,
          [pageId],
        );

        const past = new Date(Date.now() - 60_000).toISOString();
        const msgIns = await client.query(
          `INSERT INTO outbound_messages
             (user_id, channel, to_address, type, status, scheduled_for, created_at,
              booking_page_id, metadata)
           VALUES ($1, $2, $3, $4, 'scheduled', $5, now()::text, $6, $7)
           RETURNING id`,
          [
            userId,
            touch.channel,
            touch.toAddress,
            touch.type,
            past,
            pageId,
            JSON.stringify({ pageId, bookingUrl: `https://example.com/book/${pageId}`, source: "first_booking" }),
          ],
        );
        const msgId = msgIns.rows[0].id as string;

        try {
          await processScheduledMessages();

          const after = await client.query(
            `SELECT status, failure_reason FROM outbound_messages WHERE id = $1`,
            [msgId],
          );
          expect(after.rows[0].status).toBe("canceled");
          expect(String(after.rows[0].failure_reason || "")).toMatch(/action_taken/);
        } finally {
          await client.query(`DELETE FROM outbound_messages WHERE id = $1`, [msgId]);
          await client.query(`DELETE FROM booking_page_events WHERE page_id = $1`, [pageId]);
          await client.query(`DELETE FROM booking_pages WHERE id = $1`, [pageId]);
          await client.query(`DELETE FROM users WHERE id = $1`, [userId]);
        }
      } finally {
        client.release();
      }
    });
  }
});

// ============================================================================
// Task #22: scheduler picks up first-booking nudges with job_id IS NULL and
// dispatches first_booking_nudge_10m / first_booking_nudge_24h via Twilio.
// The pre-existing post-job-momentum scheduler was originally written for job
// rows; this proves the same query also drains the new booking-page rows that
// have NULL job_id, runs them through the policy chain, and either marks them
// `sent` (real Twilio) or leaves them `queued` with a deferred-no_provider
// log line (dev / stubbed Twilio). Either outcome means the row is no longer
// stuck on the `scheduled` queue, which is the bug this task guards against.
// ============================================================================
dbDescribe("Task #22: scheduler dispatches job_id=NULL first-booking nudges", () => {
  jest.setTimeout(45000);

  const dispatchedNudgeTypes: Array<{
    type: "first_booking_nudge_10m" | "first_booking_nudge_24h";
  }> = [
    { type: "first_booking_nudge_10m" },
    { type: "first_booking_nudge_24h" },
  ];

  for (const nudge of dispatchedNudgeTypes) {
    it(`dispatches ${nudge.type} when job_id IS NULL and no disqualifying event exists`, async () => {
      const { pool } = await import("../../server/db");
      const { processScheduledMessages } = await import(
        "../../server/postJobMomentum"
      );

      const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
      const userId = `task22-rt-user-${suffix}`;
      const phone = "+15550000022";
      const client = await pool.connect();

      try {
        await client.query(
          `INSERT INTO users (id, username, password, first_name, phone, notify_by_sms, sms_opt_out)
           VALUES ($1, $2, 'unused', 'Casey', $3, true, false)`,
          [userId, `task22-rt-${suffix}`, phone],
        );

        const pageIns = await client.query(
          `INSERT INTO booking_pages (claimed, claimed_by_user_id) VALUES (true, $1) RETURNING id`,
          [userId],
        );
        const pageId = pageIns.rows[0].id as string;

        // Past scheduled_for so the message is due immediately. Crucially we
        // do NOT set job_id — the scheduler must drain rows where job_id IS
        // NULL exactly the same as job-bound rows.
        const past = new Date(Date.now() - 60_000).toISOString();
        const msgIns = await client.query(
          `INSERT INTO outbound_messages
             (user_id, channel, to_address, type, status, scheduled_for, created_at,
              booking_page_id, metadata, template_rendered)
           VALUES ($1, 'sms', $2, $3, 'scheduled', $4, now()::text, $5, $6, '')
           RETURNING id, job_id`,
          [
            userId,
            phone,
            nudge.type,
            past,
            pageId,
            JSON.stringify({
              pageId,
              bookingUrl: `https://example.com/book/${pageId}`,
              source: "first_booking",
            }),
          ],
        );
        const msgId = msgIns.rows[0].id as string;
        // Sanity: confirm the inserted row really has job_id IS NULL — this
        // is the precondition that this whole task is verifying.
        expect(msgIns.rows[0].job_id).toBeNull();

        try {
          await processScheduledMessages();

          const after = await client.query(
            `SELECT status, failure_reason FROM outbound_messages WHERE id = $1`,
            [msgId],
          );
          // The scheduler must have picked the row up and moved it off
          // `scheduled`. Acceptable terminal-or-in-flight states:
          //   - `sent`     -> Twilio actually delivered (rare in CI)
          //   - `queued`   -> dispatched, deferred for "no provider" — the
          //                   stubbed-dev path with a clear log line.
          // Anything else (still `scheduled`, `failed`, `canceled`) means the
          // dispatch path is broken for job_id=NULL rows.
          expect(["sent", "queued"]).toContain(after.rows[0].status);
        } finally {
          await client.query(
            `DELETE FROM outbound_messages WHERE id = $1`,
            [msgId],
          );
          await client.query(`DELETE FROM booking_pages WHERE id = $1`, [pageId]);
          await client.query(`DELETE FROM users WHERE id = $1`, [userId]);
        }
      } finally {
        client.release();
      }
    });
  }

  // Task #194: a row that has been deferred (left as `queued`) for longer
  // than DEFERRED_QUEUED_MAX_AGE_MS must be marked `failed` with a structured
  // failure_reason, so a misconfigured / down SMS provider in production
  // doesn't grow the queue forever silently.
  //
  // The cap keys off the time the row entered `queued` (updated_at), NOT off
  // scheduled_for, so a very-overdue row that was JUST deferred (scheduler
  // came up after a long downtime) does not get incorrectly capped on its
  // first deferral tick.
  it("Task #194: caps long-deferred queued rows, leaves recent ones AND newly-deferred-but-overdue rows alone", async () => {
    const { pool } = await import("../../server/db");
    const {
      processScheduledMessages,
      DEFERRED_QUEUED_MAX_AGE_MS,
      PROVIDER_UNAVAILABLE_TIMEOUT_REASON,
    } = await import("../../server/postJobMomentum");

    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const userId = `task194-user-${suffix}`;
    const phone = "+15550000194";
    const client = await pool.connect();

    try {
      await client.query(
        `INSERT INTO users (id, username, password, first_name, phone, notify_by_sms, sms_opt_out)
         VALUES ($1, $2, 'unused', 'Sky', $3, true, false)`,
        [userId, `task194-${suffix}`, phone],
      );
      const pageIns = await client.query(
        `INSERT INTO booking_pages (claimed, claimed_by_user_id) VALUES (true, $1) RETURNING id`,
        [userId],
      );
      const pageId = pageIns.rows[0].id as string;

      // Stuck row: status='queued', updated_at older than the cap (i.e. the
      // row first went to queued more than 7 days ago and has been sitting
      // there). Simulates the production scenario where Twilio kept returning
      // NO_FROM_NUMBER tick after tick for over 7 days.
      const stuckTs = new Date(
        Date.now() - DEFERRED_QUEUED_MAX_AGE_MS - 60_000,
      ).toISOString();
      const stuckIns = await client.query(
        `INSERT INTO outbound_messages
           (user_id, channel, to_address, type, status, scheduled_for, created_at,
            updated_at, booking_page_id, template_rendered)
         VALUES ($1, 'sms', $2, 'first_booking_nudge_10m', 'queued', $3, $3, $3, $4, '')
         RETURNING id`,
        [userId, phone, stuckTs, pageId],
      );
      const stuckId = stuckIns.rows[0].id as string;

      // Recent row: queued and updated recently. Must be left alone.
      const recentTs = new Date(Date.now() - 60_000).toISOString();
      const recentIns = await client.query(
        `INSERT INTO outbound_messages
           (user_id, channel, to_address, type, status, scheduled_for, created_at,
            updated_at, template_rendered)
         VALUES ($1, 'sms', $2, 'followup', 'queued', $3, $3, $3, '')
         RETURNING id`,
        [userId, phone, recentTs],
      );
      const recentId = recentIns.rows[0].id as string;

      // Regression: scheduled_for is very old (e.g. scheduler was down for
      // weeks), but the row JUST transitioned to queued (updated_at is now).
      // Must NOT be capped — it has not actually been deferred long.
      const overdueScheduledFor = new Date(
        Date.now() - DEFERRED_QUEUED_MAX_AGE_MS - 5 * 60_000,
      ).toISOString();
      const overdueIns = await client.query(
        `INSERT INTO outbound_messages
           (user_id, channel, to_address, type, status, scheduled_for, created_at,
            updated_at, template_rendered)
         VALUES ($1, 'sms', $2, 'followup', 'queued', $3, $4, $5, '')
         RETURNING id`,
        [
          userId,
          phone,
          overdueScheduledFor,
          overdueScheduledFor, // created long ago
          new Date().toISOString(), // but updated_at = now (just deferred)
        ],
      );
      const overdueId = overdueIns.rows[0].id as string;

      try {
        await processScheduledMessages();

        const stuckAfter = await client.query(
          `SELECT status, failure_reason FROM outbound_messages WHERE id = $1`,
          [stuckId],
        );
        expect(stuckAfter.rows[0].status).toBe("failed");
        expect(stuckAfter.rows[0].failure_reason).toBe(
          PROVIDER_UNAVAILABLE_TIMEOUT_REASON,
        );
        // Sanity: matches the locked string admin dashboards pattern-match.
        expect(PROVIDER_UNAVAILABLE_TIMEOUT_REASON).toBe(
          "provider_unavailable_timeout",
        );

        const recentAfter = await client.query(
          `SELECT status, failure_reason FROM outbound_messages WHERE id = $1`,
          [recentId],
        );
        expect(recentAfter.rows[0].status).toBe("queued");
        expect(recentAfter.rows[0].failure_reason).toBeNull();

        const overdueAfter = await client.query(
          `SELECT status, failure_reason FROM outbound_messages WHERE id = $1`,
          [overdueId],
        );
        expect(overdueAfter.rows[0].status).toBe("queued");
        expect(overdueAfter.rows[0].failure_reason).toBeNull();
      } finally {
        await client.query(
          `DELETE FROM outbound_messages WHERE id = ANY($1::text[])`,
          [[stuckId, recentId, overdueId]],
        );
        await client.query(`DELETE FROM booking_pages WHERE id = $1`, [pageId]);
        await client.query(`DELETE FROM users WHERE id = $1`, [userId]);
      }
    } finally {
      client.release();
    }
  });

  it("renders the locked first_booking_nudge_10m body when dispatching (no template_rendered fallback)", async () => {
    const { pool } = await import("../../server/db");
    const { processScheduledMessages } = await import(
      "../../server/postJobMomentum"
    );

    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const userId = `task22-render-user-${suffix}`;
    const phone = "+15550000023";
    const client = await pool.connect();

    try {
      await client.query(
        `INSERT INTO users (id, username, password, first_name, phone, notify_by_sms, sms_opt_out)
         VALUES ($1, $2, 'unused', 'Riley', $3, true, false)`,
        [userId, `task22-render-${suffix}`, phone],
      );
      const pageIns = await client.query(
        `INSERT INTO booking_pages (claimed, claimed_by_user_id) VALUES (true, $1) RETURNING id`,
        [userId],
      );
      const pageId = pageIns.rows[0].id as string;
      const past = new Date(Date.now() - 60_000).toISOString();
      const msgIns = await client.query(
        `INSERT INTO outbound_messages
           (user_id, channel, to_address, type, status, scheduled_for, created_at,
            booking_page_id, template_rendered)
         VALUES ($1, 'sms', $2, 'first_booking_nudge_10m', 'scheduled', $3, now()::text, $4, '')
         RETURNING id`,
        [userId, phone, past, pageId],
      );
      const msgId = msgIns.rows[0].id as string;

      try {
        // The dispatch path renders the locked spec body at SEND time. We
        // can't directly observe the body when Twilio is stubbed, but we
        // can confirm the row's empty `template_rendered` did not block
        // dispatch — i.e. it was not left as `failed` due to an empty body.
        await processScheduledMessages();
        const after = await client.query(
          `SELECT status FROM outbound_messages WHERE id = $1`,
          [msgId],
        );
        expect(["sent", "queued"]).toContain(after.rows[0].status);
      } finally {
        await client.query(
          `DELETE FROM outbound_messages WHERE id = $1`,
          [msgId],
        );
        await client.query(`DELETE FROM booking_pages WHERE id = $1`, [pageId]);
        await client.query(`DELETE FROM users WHERE id = $1`, [userId]);
      }
    } finally {
      client.release();
    }
  });
});
