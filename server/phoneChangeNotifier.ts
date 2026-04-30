// Sends user-facing notifications when a verified phone number is replaced
// from the Settings page (POST /api/profile/phone/verify-otp). Two channels:
//
//   1) Email to the user's verified email address — confirmation for the
//      legitimate user, alert (with a "this wasn't me" support link) if
//      someone else swapped the number.
//   2) Optional SMS heads-up to the previous phone number, sent best-effort
//      so a hijacker can't quietly swap the number without the original
//      owner getting a ping on the old line.
//
// Both sends are fire-and-forget: failures are logged but never block the
// underlying phone-change request.

import { sendEmail } from "./sendgrid";
import { sendSMS } from "./twilio";
import { maskPhone } from "./twilioStopOptOut";
import { maskEmail } from "./lib/safeLogger";
import { logger } from "./lib/logger";

const SUPPORT_URL_BASE =
  process.env.FRONTEND_URL || "https://account.gigaid.ai";

function buildSupportUrl(userId: string): string {
  // Deep-link to the in-app support page with a reason flag so support agents
  // (and any future automation) can identify "phone change wasn't me" reports
  // without the user having to remember the context.
  const params = new URLSearchParams({
    reason: "phone_change_not_me",
    userId,
  });
  return `${SUPPORT_URL_BASE}/support?${params.toString()}`;
}

function formatChangeDate(when: Date): string {
  // Locale-agnostic UTC stamp keeps email copy stable across mail clients
  // (and avoids server-locale surprises in tests / staging).
  return when.toUTCString();
}

interface PhoneChangeEmailInputs {
  to: string;
  firstName: string | null;
  oldPhone: string | null;
  newPhone: string;
  changedAt: Date;
  supportUrl: string;
}

export function buildPhoneChangeEmail(input: PhoneChangeEmailInputs): {
  subject: string;
  text: string;
  html: string;
} {
  const greeting = input.firstName ? `Hi ${input.firstName},` : "Hi,";
  const oldMasked = maskPhone(input.oldPhone);
  const newMasked = maskPhone(input.newPhone);
  const when = formatChangeDate(input.changedAt);
  const subject = "Your GigAid phone number was changed";

  const text = `${greeting}

The phone number on your GigAid account was just changed.

When: ${when}
Previous number: ${oldMasked}
New number: ${newMasked}

If this was you, no action is needed — this email is just a confirmation.

If you did NOT make this change, your account may be at risk. Please contact us right away so we can help you secure it:
${input.supportUrl}

— GigAid`;

  const html = `<p>${greeting}</p>
<p>The phone number on your GigAid account was just changed.</p>
<table cellpadding="6" style="border-collapse:collapse;font-size:14px;margin:12px 0">
  <tr><td style="color:#64748b">When</td><td><strong>${when}</strong></td></tr>
  <tr><td style="color:#64748b">Previous number</td><td><strong>${oldMasked}</strong></td></tr>
  <tr><td style="color:#64748b">New number</td><td><strong>${newMasked}</strong></td></tr>
</table>
<p>If this was you, no action is needed — this email is just a confirmation.</p>
<p>If you did <strong>not</strong> make this change, your account may be at risk. Please contact us right away so we can help you secure it:</p>
<p><a href="${input.supportUrl}" style="display:inline-block;padding:10px 16px;background:#b91c1c;color:#fff;border-radius:6px;text-decoration:none">This wasn't me</a></p>
<p style="color:#64748b;font-size:12px">— GigAid</p>`;

  return { subject, text, html };
}

export function buildPreChangeSmsBody(newPhone: string, changedAt: Date): string {
  // Short body fits a single SMS segment. Don't include the support URL —
  // the email carries the actionable link; this SMS is just a heads-up to
  // the old number that it's about to be replaced.
  const newMasked = maskPhone(newPhone);
  const when = changedAt.toISOString().slice(0, 10);
  return `GigAid: the phone number on your account is being changed to ${newMasked} on ${when}. If this wasn't you, check your email for a "this wasn't me" link.`;
}

export interface NotifyPhoneChangeArgs {
  userId: string;
  email: string | null | undefined;
  firstName: string | null | undefined;
  oldPhone: string | null | undefined;
  newPhone: string;
  changedAt?: Date;
  // Test seam — defaults to the real sendEmail / sendSMS implementations.
  deps?: {
    sendEmail?: typeof sendEmail;
    sendSMS?: typeof sendSMS;
  };
}

/**
 * Fire the heads-up SMS to the previous number, BEFORE the DB swap.
 *
 * The task spec requires the warning to land on the old line "before it is
 * replaced" so a hijacker can't quietly take ownership. The send itself
 * still goes through Twilio's HTTP API independent of our DB state, but we
 * call this helper at the pre-commit point so the network attempt starts
 * (and any synchronous validation errors surface) before the row is
 * mutated. Best-effort: errors are logged, never re-thrown.
 *
 * Returns a promise the caller may ignore (fire-and-forget) or await in
 * tests.
 */
export async function sendPhoneChangeHeadsUpSms(
  args: Pick<NotifyPhoneChangeArgs, "userId" | "oldPhone" | "newPhone" | "changedAt" | "deps">,
): Promise<{ attempted: boolean; sent: boolean }> {
  const sendSMSFn = args.deps?.sendSMS ?? sendSMS;
  const changedAt = args.changedAt ?? new Date();
  const oldPhone = (args.oldPhone || "").trim();

  if (!oldPhone || oldPhone === args.newPhone) {
    return { attempted: false, sent: false };
  }

  try {
    const body = buildPreChangeSmsBody(args.newPhone, changedAt);
    const result = await sendSMSFn(oldPhone, body);
    const sent = !!result?.success;
    if (!sent) {
      logger.warn(
        `[PhoneChangeNotifier] heads-up SMS to old number ${maskPhone(oldPhone)} failed for user ${args.userId}: ${result?.errorCode || "unknown"}`,
      );
    } else {
      logger.info(
        `[PhoneChangeNotifier] sent heads-up SMS to old number ${maskPhone(oldPhone)} for user ${args.userId}`,
      );
    }
    return { attempted: true, sent };
  } catch (err: any) {
    logger.error(
      `[PhoneChangeNotifier] heads-up SMS threw for user ${args.userId}:`,
      err?.message || err,
    );
    return { attempted: true, sent: false };
  }
}

/**
 * Send the post-change confirmation/alert email to the user.
 *
 * Called AFTER the DB swap commits — the email is a record of an action
 * that already happened. Skipped silently when no email is on file (the
 * phone change still proceeded). Best-effort: errors are logged, never
 * re-thrown.
 */
export async function sendPhoneChangeEmail(
  args: Pick<NotifyPhoneChangeArgs, "userId" | "email" | "firstName" | "oldPhone" | "newPhone" | "changedAt" | "deps">,
): Promise<{ attempted: boolean; sent: boolean }> {
  const sendEmailFn = args.deps?.sendEmail ?? sendEmail;
  const changedAt = args.changedAt ?? new Date();
  const emailTo = (args.email || "").trim();

  if (!emailTo) {
    logger.info(
      `[PhoneChangeNotifier] no email on file for user ${args.userId}, skipping email notification`,
    );
    return { attempted: false, sent: false };
  }

  try {
    const { subject, text, html } = buildPhoneChangeEmail({
      to: emailTo,
      firstName: args.firstName ?? null,
      oldPhone: args.oldPhone ?? null,
      newPhone: args.newPhone,
      changedAt,
      supportUrl: buildSupportUrl(args.userId),
    });
    const ok = await sendEmailFn({ to: emailTo, subject, text, html });
    const sent = !!ok;
    if (!sent) {
      logger.warn(
        `[PhoneChangeNotifier] email send returned falsy for user ${args.userId} (${maskEmail(emailTo)})`,
      );
    } else {
      logger.info(
        `[PhoneChangeNotifier] sent change-notification email to ${maskEmail(emailTo)} for user ${args.userId}`,
      );
    }
    return { attempted: true, sent };
  } catch (err: any) {
    logger.error(
      `[PhoneChangeNotifier] email send threw for user ${args.userId}:`,
      err?.message || err,
    );
    return { attempted: true, sent: false };
  }
}

/**
 * Convenience wrapper that fires both channels back-to-back. Kept for
 * callers (and tests) that don't need to interleave the SMS with their
 * own DB write. Real route code should prefer calling
 * `sendPhoneChangeHeadsUpSms` BEFORE the DB swap and
 * `sendPhoneChangeEmail` AFTER, so the SMS heads-up lands strictly before
 * the number is replaced (per the security spec).
 */
export async function notifyPhoneChange(args: NotifyPhoneChangeArgs): Promise<{
  emailAttempted: boolean;
  emailSent: boolean;
  smsAttempted: boolean;
  smsSent: boolean;
}> {
  const email = await sendPhoneChangeEmail(args);
  const sms = await sendPhoneChangeHeadsUpSms(args);
  return {
    emailAttempted: email.attempted,
    emailSent: email.sent,
    smsAttempted: sms.attempted,
    smsSent: sms.sent,
  };
}
