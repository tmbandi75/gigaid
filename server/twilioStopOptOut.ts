// ============================================================================
// Twilio STOP-keyword opt-out helpers.
// ----------------------------------------------------------------------------
// Pulled out of routes.ts so the keyword set, TwiML strings, and ambiguity-
// safe phone resolution can be unit-tested without spinning up Express.
// The HTTP handler in routes.ts still owns request/response wiring; this
// module owns the rules that govern *what* it does.
// ============================================================================

// Locked STOP-keyword set. Spec contract — do not extend without product
// signoff (carrier compliance and the inbound webhook tests both depend on
// this exact list).
export const STOP_KEYWORDS = ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL"] as const;
const STOP_KEYWORD_SET = new Set<string>(STOP_KEYWORDS);

// Locked confirmation copy for the auto-reply. Tests assert on this string.
export const STOP_REPLY_BODY =
  "You're unsubscribed from GigAid messages. No more texts will be sent.";

export const STOP_ACK_TWIML = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${STOP_REPLY_BODY}</Message></Response>`;
export const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

/**
 * Pure STOP-keyword check. Case-insensitive, whitespace-trimmed, and only
 * matches exact keywords (so "please stop calling" is NOT an opt-out).
 */
export function isStopReply(body: string | null | undefined): boolean {
  if (!body) return false;
  return STOP_KEYWORD_SET.has(body.trim().toUpperCase());
}

// Mask a phone like +15551234567 -> +15***4567 for safe logging.
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "unknown";
  if (phone.length <= 6) return "***";
  return `${phone.slice(0, 3)}***${phone.slice(-4)}`;
}

export type ResolveOptOutResult =
  | { kind: "matched"; userId: string; via: "phone_e164" | "last_outbound" }
  | { kind: "ambiguous"; reason: "multiple_users_share_phone" }
  | { kind: "unrecognized" };

/**
 * Pure phone -> userId resolution for STOP webhooks. Spec:
 *   - exactly 1 user with users.phone_e164 == From  -> match
 *   - 2+ users share the phone (data integrity hole) -> ambiguous, do nothing
 *   - 0 phone matches but a recent outbound to that number -> match its owner
 *   - 0 of either -> unrecognized
 *
 * Keeping ambiguity in its own bucket (instead of silently picking the first)
 * is the load-bearing safety property: we never opt the WRONG user out.
 */
export function resolveOptOutUserIdPure(input: {
  phoneMatches: Array<{ id: string }>;
  lastOutboundUserId: string | null | undefined;
}): ResolveOptOutResult {
  if (input.phoneMatches.length >= 2) {
    return { kind: "ambiguous", reason: "multiple_users_share_phone" };
  }
  if (input.phoneMatches.length === 1) {
    return { kind: "matched", userId: input.phoneMatches[0].id, via: "phone_e164" };
  }
  if (input.lastOutboundUserId) {
    return { kind: "matched", userId: input.lastOutboundUserId, via: "last_outbound" };
  }
  return { kind: "unrecognized" };
}
