// Unit coverage for the phone-change security notifier (Task #250).
//
// The notifier is fire-and-forget — failures must NEVER throw out — so the
// behaviour we pin here is:
//
//   1) On a happy path with both an email and an old phone on file, BOTH
//      channels are attempted, the email body carries masked old/new
//      numbers + a "this wasn't me" support link, and the SMS body warns
//      the previous number that the swap is happening.
//   2) Missing email skips the email send (does NOT throw, does NOT log
//      an error) — only the SMS heads-up fires.
//   3) Missing previous phone (e.g. brand-new account) skips the SMS
//      heads-up — only the email fires.
//   4) When the old and new phone are identical (defensive guard against
//      callers passing the same number) the SMS is suppressed so we
//      don't text the new number a "you're being replaced" warning.
//   5) When sendEmail / sendSMS throw, the notifier swallows the error
//      and still resolves cleanly — the underlying phone-change response
//      must not be broken by a flaky provider.

import {
  buildPhoneChangeEmail,
  buildPreChangeSmsBody,
  notifyPhoneChange,
} from "../../server/phoneChangeNotifier";

describe("buildPhoneChangeEmail", () => {
  const baseInput = {
    to: "user@example.com",
    firstName: "Jordan" as string | null,
    oldPhone: "+15551234567" as string | null,
    newPhone: "+15559998888",
    changedAt: new Date("2026-04-29T12:34:56Z"),
    supportUrl:
      "https://account.gigaid.ai/support?reason=phone_change_not_me&userId=u1",
  };

  it("masks both phone numbers in subject/text/html", () => {
    const out = buildPhoneChangeEmail(baseInput);
    expect(out.subject).toContain("phone number");
    // Masked previous: +15***4567
    expect(out.text).toContain("+15***4567");
    expect(out.html).toContain("+15***4567");
    // Masked new: +15***8888
    expect(out.text).toContain("+15***8888");
    expect(out.html).toContain("+15***8888");
    // Raw numbers must NOT leak.
    expect(out.text).not.toContain("5551234567");
    expect(out.html).not.toContain("5551234567");
    expect(out.text).not.toContain("5559998888");
    expect(out.html).not.toContain("5559998888");
  });

  it("includes the change timestamp and the wasn't-me support link", () => {
    const out = buildPhoneChangeEmail(baseInput);
    expect(out.text).toContain("2026"); // UTC year shows up
    expect(out.html).toContain(baseInput.supportUrl);
    expect(out.text).toContain(baseInput.supportUrl);
    // Visible CTA copy in the HTML body.
    expect(out.html).toContain("This wasn't me");
  });

  it("falls back to a neutral greeting when firstName is null", () => {
    const out = buildPhoneChangeEmail({ ...baseInput, firstName: null });
    expect(out.text.startsWith("Hi,")).toBe(true);
    expect(out.html.startsWith("<p>Hi,</p>")).toBe(true);
  });

  it("renders a placeholder when no previous phone is on file", () => {
    const out = buildPhoneChangeEmail({ ...baseInput, oldPhone: null });
    // maskPhone returns "unknown" for a missing number — the email must
    // still be sendable, just without a stale "previous number" claim.
    expect(out.text).toContain("Previous number: unknown");
    expect(out.html).toContain("unknown");
  });
});

describe("buildPreChangeSmsBody", () => {
  it("masks the new phone and includes a date stamp", () => {
    const body = buildPreChangeSmsBody(
      "+15559998888",
      new Date("2026-04-29T12:34:56Z"),
    );
    expect(body).toContain("+15***8888");
    expect(body).toContain("2026-04-29");
    expect(body).not.toContain("5559998888");
    // Must hint at the recovery path without forcing a URL into the SMS.
    expect(body.toLowerCase()).toContain("email");
  });
});

describe("notifyPhoneChange", () => {
  const newPhone = "+15559998888";
  const oldPhone = "+15551234567";
  const changedAt = new Date("2026-04-29T12:34:56Z");

  function makeDeps(overrides: {
    emailReturn?: any;
    emailThrow?: Error;
    smsReturn?: any;
    smsThrow?: Error;
  } = {}) {
    const emailCalls: any[] = [];
    const smsCalls: any[] = [];
    const sendEmail: any = jest.fn(async (opts: any) => {
      emailCalls.push(opts);
      if (overrides.emailThrow) throw overrides.emailThrow;
      return overrides.emailReturn ?? true;
    });
    const sendSMS: any = jest.fn(async (to: string, body: string) => {
      smsCalls.push({ to, body });
      if (overrides.smsThrow) throw overrides.smsThrow;
      return overrides.smsReturn ?? { success: true };
    });
    return { sendEmail, sendSMS, emailCalls, smsCalls };
  }

  it("sends both the email and the heads-up SMS on the happy path", async () => {
    const deps = makeDeps();
    const result = await notifyPhoneChange({
      userId: "u1",
      email: "user@example.com",
      firstName: "Jordan",
      oldPhone,
      newPhone,
      changedAt,
      deps,
    });

    expect(result).toEqual({
      emailAttempted: true,
      emailSent: true,
      smsAttempted: true,
      smsSent: true,
    });
    expect(deps.emailCalls).toHaveLength(1);
    expect(deps.emailCalls[0].to).toBe("user@example.com");
    expect(deps.emailCalls[0].subject).toMatch(/phone number/i);
    expect(deps.emailCalls[0].text).toContain("+15***8888");
    expect(deps.emailCalls[0].text).toContain("+15***4567");

    expect(deps.smsCalls).toHaveLength(1);
    expect(deps.smsCalls[0].to).toBe(oldPhone);
    expect(deps.smsCalls[0].body).toContain("+15***8888");
  });

  it("skips the email send when no email is on file", async () => {
    const deps = makeDeps();
    const result = await notifyPhoneChange({
      userId: "u1",
      email: null,
      firstName: null,
      oldPhone,
      newPhone,
      changedAt,
      deps,
    });

    expect(result.emailAttempted).toBe(false);
    expect(result.emailSent).toBe(false);
    expect(deps.emailCalls).toHaveLength(0);
    // SMS heads-up still fires.
    expect(result.smsAttempted).toBe(true);
    expect(deps.smsCalls).toHaveLength(1);
  });

  it("skips the SMS heads-up when no previous phone is on file", async () => {
    const deps = makeDeps();
    const result = await notifyPhoneChange({
      userId: "u1",
      email: "user@example.com",
      firstName: "Jordan",
      oldPhone: null,
      newPhone,
      changedAt,
      deps,
    });

    expect(result.smsAttempted).toBe(false);
    expect(result.smsSent).toBe(false);
    expect(deps.smsCalls).toHaveLength(0);
    // Email still fires.
    expect(result.emailAttempted).toBe(true);
    expect(deps.emailCalls).toHaveLength(1);
  });

  it("does not text the new number when old equals new (defensive)", async () => {
    const deps = makeDeps();
    const result = await notifyPhoneChange({
      userId: "u1",
      email: "user@example.com",
      firstName: "Jordan",
      oldPhone: newPhone,
      newPhone,
      changedAt,
      deps,
    });

    expect(result.smsAttempted).toBe(false);
    expect(deps.smsCalls).toHaveLength(0);
  });

  it("swallows email send errors and still attempts the SMS", async () => {
    const deps = makeDeps({ emailThrow: new Error("boom") });
    const result = await notifyPhoneChange({
      userId: "u1",
      email: "user@example.com",
      firstName: "Jordan",
      oldPhone,
      newPhone,
      changedAt,
      deps,
    });

    expect(result.emailAttempted).toBe(true);
    expect(result.emailSent).toBe(false);
    expect(result.smsAttempted).toBe(true);
    expect(result.smsSent).toBe(true);
    expect(deps.smsCalls).toHaveLength(1);
  });

  it("swallows SMS send errors and reports email status", async () => {
    const deps = makeDeps({ smsThrow: new Error("twilio down") });
    const result = await notifyPhoneChange({
      userId: "u1",
      email: "user@example.com",
      firstName: "Jordan",
      oldPhone,
      newPhone,
      changedAt,
      deps,
    });

    expect(result.emailSent).toBe(true);
    expect(result.smsAttempted).toBe(true);
    expect(result.smsSent).toBe(false);
  });

  it("reports emailSent=false when sendEmail returns falsy without throwing", async () => {
    const deps = makeDeps({ emailReturn: false, smsReturn: { success: false, errorCode: "INVALID_PHONE" } });
    const result = await notifyPhoneChange({
      userId: "u1",
      email: "user@example.com",
      firstName: "Jordan",
      oldPhone,
      newPhone,
      changedAt,
      deps,
    });

    expect(result.emailAttempted).toBe(true);
    expect(result.emailSent).toBe(false);
    expect(result.smsAttempted).toBe(true);
    expect(result.smsSent).toBe(false);
  });
});
