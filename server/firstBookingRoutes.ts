import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { storage } from "./storage";
import { db } from "./db";
import { users, bookingPages, bookingPageEvents, outboundMessages, otpCodes, bookingPageEventTypes, unclaimedHeadlineVariants } from "@shared/schema";
import { and, desc, eq, inArray, isNull, isNotNull, or, sql } from "drizzle-orm";
import { signAppJwt, verifyAppJwt, isAppJwtConfigured } from "./appJwt";
import { isAuthenticated } from "./replit_integrations/auth/replitAuth";
import { FIRST_BOOKING_DISQUALIFYING_EVENT_TYPES } from "./postJobMomentum";
import { buildBookingLink, getBookingBaseUrl } from "./lib/bookingLinkUrl";
import { generateBookingSlug, writeUserSlugWithRetry } from "./lib/bookingSlug";
import { logger } from "./lib/logger";
import { randomUUID, randomInt } from "crypto";
import { verifyFirebaseIdToken, isFirebaseConfigured } from "./firebaseAdmin";
import { sendSMS } from "./twilio";
import { sendEmail } from "./sendgrid";

const router = Router();

const claimSchema = z.object({
  pageId: z.string().min(1),
  name: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(32).optional(),
  serviceType: z.string().trim().max(120).optional(),
  // Variant is REQUIRED on claim: the headline A/B test cannot pick a
  // winner if conversions arrive without a variant tag. The frontend
  // (client/src/pages/UnclaimedBookingPage.tsx) always selects and
  // persists a variant before it can submit the form, so requiring it
  // here is safe and prevents silent attribution loss.
  variant: z.enum(unclaimedHeadlineVariants),
});

function sanitizeVariant(input: unknown): string | undefined {
  if (typeof input !== "string") return undefined;
  return (unclaimedHeadlineVariants as readonly string[]).includes(input) ? input : undefined;
}

// Event types whose entire purpose is to feed the headline A/B test report
// at /api/admin/analytics/booking-page-variants. If a write of one of these
// arrives without a recognised variant the data point is useless — surface
// it loudly so the bug gets caught instead of silently inflating the
// `unassigned` bucket.
const VARIANT_REQUIRED_EVENT_TYPES = new Set<string>([
  "page_viewed",
  "page_claimed",
]);

function normalizePhone(phone?: string | null): string | undefined {
  if (!phone) return undefined;
  const trimmed = phone.replace(/[^\d+]/g, "");
  return trimmed || undefined;
}

function getUserIdFromBearer(req: Request): string | null {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;
  return verifyAppJwt(token)?.sub ?? null;
}

// Session-auth fallback so the in-app dashboard banner (which uses Replit
// session cookies, not the claim-flow bearer JWT) can record link_copied
// events on the same endpoint.
function getUserIdFromSession(req: Request): string | null {
  const sessionUser = (req as any).user;
  const isAuthFn = (req as any).isAuthenticated;
  if (typeof isAuthFn !== "function" || !isAuthFn.call(req)) return null;
  return sessionUser?.claims?.sub ?? null;
}

function getCallerUserId(req: Request): string | null {
  return getUserIdFromBearer(req) ?? getUserIdFromSession(req);
}

router.get("/booking-pages/:pageId", async (req: Request, res: Response) => {
  try {
    const page = await storage.getBookingPage(req.params.pageId);
    if (!page) return res.status(404).json({ error: "Not found" });
    const callerId = getUserIdFromBearer(req);
    const isOwner = !!page.claimedByUserId && !!callerId && callerId === page.claimedByUserId;
    return res.json({ page: { id: page.id, claimed: page.claimed, isOwner } });
  } catch (err: any) {
    logger.error("[FirstBooking] getBookingPage error:", err?.message);
    return res.status(500).json({ error: "Lookup failed" });
  }
});

router.post("/booking-pages/:pageId/events", async (req: Request, res: Response) => {
  try {
    const pageId = req.params.pageId;
    const type = req.body?.type;
    if (!bookingPageEventTypes.includes(type)) {
      return res.status(400).json({ error: "Invalid event type" });
    }
    const page = await storage.getBookingPage(pageId);
    if (!page) return res.status(404).json({ error: "Not found" });

    const requiresOwner = type === "link_copied" || type === "link_shared" || type === "first_booking_viewed";
    if (requiresOwner) {
      const userId = getCallerUserId(req);
      if (!userId || !page.claimedByUserId || userId !== page.claimedByUserId) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    const variant = sanitizeVariant(req.body?.variant);
    if (VARIANT_REQUIRED_EVENT_TYPES.has(type) && !variant) {
      // Reject A/B-critical events that arrive without a recognised variant.
      // The frontend always selects and persists a headline variant before
      // firing these events, so a missing/invalid variant indicates a bug
      // and we refuse to corrupt the report by writing a NULL row.
      logger.warn(
        `[FirstBooking] ${type} event for page ${pageId} rejected — missing/invalid variant ` +
          `(received: ${JSON.stringify(req.body?.variant)}).`,
      );
      return res.status(400).json({ error: "Missing or invalid headline variant" });
    }
    await storage.trackBookingPageEvent(pageId, type, { variant });
    // Only cancel nudges when the owner has actually taken a completion action
    // (copied or shared the link). Just viewing the page should not cancel them.
    const completesNudge = type === "link_copied" || type === "link_shared";
    if (completesNudge) await storage.cancelBookingPageNudges(pageId);
    return res.json({ ok: true });
  } catch (err: any) {
    logger.error("[FirstBooking] trackEvent error:", err?.message);
    return res.status(500).json({ error: "Track failed" });
  }
});

router.post("/claim-page", async (req: Request, res: Response) => {
  try {
    const parsed = claimSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid claim payload" });
    const { pageId, name, serviceType, variant } = parsed.data;

    if (!isAppJwtConfigured()) {
      return res.status(503).json({ error: "Authentication is not fully configured." });
    }

    const page = await storage.getBookingPage(pageId);
    if (!page) return res.status(404).json({ error: "Page not found" });
    if (page.claimed) return res.status(400).json({ error: "Page already claimed" });

    // Nudge SMS destination is the server-side prospect phone only — body phone
    // is unverified caller input and must not control who we text.
    const phone = normalizePhone(page.phone);

    let userId: string;
    // Tracks the slug the claim flow asked for vs. the one we actually
    // wrote. They diverge when a concurrent writer takes the requested
    // slug first and `writeUserSlugWithRetry` advances to a suffixed
    // candidate. The confirmation screen reads these in the response to
    // show a non-blocking "we adjusted your link" notice.
    let requestedSlug: string | null = null;
    let finalSlug: string | null = null;

    try {
      // Prefer a name-based slug (e.g. `larry-payne`) over the legacy
      // `user-<hex>` placeholder so the share link the new claimer gets is
      // brand-friendly from the very first send. The DB enforces slug
      // uniqueness (see `users_public_profile_slug_unique_idx`), so we
      // wrap the whole transaction in `writeUserSlugWithRetry` — if a
      // concurrent writer takes our chosen slug first, the entire
      // transaction is retried with the next-available suffix. Re-running
      // the transaction is safe because nothing outside it is mutated yet.
      const newId = randomUUID();
      const fallbackSlug = `user-${newId.slice(0, 8).toLowerCase()}`;
      const baseSlugCandidate = name?.trim() ? generateBookingSlug({ name }) : null;
      const baseSlug = baseSlugCandidate && baseSlugCandidate !== "pro"
        ? baseSlugCandidate
        : fallbackSlug;

      const tx = await writeUserSlugWithRetry(
        baseSlug,
        async (publicProfileSlug) => db.transaction(async (trx) => {
          const nowIso = new Date().toISOString();
          const [created] = await trx.insert(users).values({
            id: newId,
            username: `claim-${newId.slice(0, 8)}`,
            password: randomUUID(),
            name: name ?? null,
            publicProfileEnabled: false,
            publicProfileSlug,
            onboardingCompleted: false,
            authProvider: "claim",
            defaultServiceType: serviceType ?? page.category ?? null,
            createdAt: nowIso,
          }).returning();

          const [claimed] = await trx.update(bookingPages)
            .set({ claimed: true, claimedAt: nowIso, claimedByUserId: created.id, updatedAt: nowIso })
            .where(and(eq(bookingPages.id, pageId), eq(bookingPages.claimed, false)))
            .returning();

          if (!claimed) throw new Error("ALREADY_CLAIMED");
          return { userId: created.id };
        }),
        { checkExists: (s) => storage.slugExists(s) },
      );
      userId = tx.result.userId;
      // Captured for the response below so the confirmation screen can
      // surface a non-blocking "we adjusted your link" notice when a
      // concurrent claim forced us to pick a suffixed slug.
      finalSlug = tx.slug;
      requestedSlug = baseSlug;
    } catch (err: any) {
      if (err?.message === "ALREADY_CLAIMED") {
        return res.status(409).json({ error: "Page was just claimed by another session" });
      }
      throw err;
    }

    // `variant` is required by claimSchema, so it is always present here.
    await storage.trackBookingPageEvent(pageId, "page_claimed", { variant });

    {
      // Schedule the 5-touch first-booking conversion sequence. Locked-spec
      // bodies are rendered at SEND TIME inside attemptSendMessage; here we
      // only enqueue rows. SMS rows require a phone; email rows require an
      // email — each is skipped independently.
      const now = new Date();
      const bookingUrl = buildBookingLink(pageId);
      const metadata = JSON.stringify({ pageId, bookingUrl, source: "first_booking" });
      const nowIso = now.toISOString();

      // Email window: spec says "2-4 hours after claim". Pick a uniform random
      // offset in [120, 240] minutes so we don't burst-send to SendGrid when
      // many claims land at once.
      const emailTwoHourOffsetMinutes = 120 + Math.floor(Math.random() * 121);

      type Touch = {
        type: string;
        channel: "sms" | "email";
        toAddress: string | null;
        offsetMinutes: number;
      };

      // The claim flow doesn't capture an email today, so we enqueue email
      // touches with a sentinel `to_address` (the column is NOT NULL). The
      // real destination is resolved at SEND TIME inside `attemptSendMessage`
      // by re-reading `users.email`, so any email the provider adds during
      // onboarding before the touch fires is honored. If still no email at
      // send time, the touch is canceled with `user_not_found`.
      const EMAIL_PENDING_SENTINEL = "pending@first-booking.local";
      const userEmail = (await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1))[0]?.email ?? null;
      const emailToAddress = userEmail ?? EMAIL_PENDING_SENTINEL;

      const touches: Touch[] = [
        { type: "first_booking_nudge_10m", channel: "sms", toAddress: phone ?? null, offsetMinutes: 10 },
        { type: "first_booking_email_2h", channel: "email", toAddress: emailToAddress, offsetMinutes: emailTwoHourOffsetMinutes },
        { type: "first_booking_nudge_24h", channel: "sms", toAddress: phone ?? null, offsetMinutes: 60 * 24 },
        { type: "first_booking_email_48h", channel: "email", toAddress: emailToAddress, offsetMinutes: 60 * 48 },
        { type: "first_booking_nudge_72h", channel: "sms", toAddress: phone ?? null, offsetMinutes: 60 * 72 },
      ];

      const rows = touches
        .filter((t) => !!t.toAddress)
        .map((t) => ({
          userId,
          jobId: null,
          bookingPageId: pageId,
          channel: t.channel,
          toAddress: t.toAddress as string,
          type: t.type,
          status: "scheduled" as const,
          scheduledFor: new Date(now.getTime() + t.offsetMinutes * 60 * 1000).toISOString(),
          templateRendered: "",
          metadata,
          createdAt: nowIso,
        }));

      if (rows.length > 0) {
        try {
          await db.insert(outboundMessages).values(rows);
        } catch (err: any) {
          logger.error("[FirstBooking] Failed to schedule first-booking touches:", err?.message);
        }
      }
    }

    const token = signAppJwt({ sub: userId, provider: "claim" });
    // `slugAdjusted` is non-null only when the slug the DB actually
    // accepted differs from the one we asked for (a concurrent claim
    // raced past us and forced a `-2` suffix). The client uses this to
    // surface a small notice on the confirmation screen so the new pro
    // realises their link isn't the bare name version.
    const slugAdjusted =
      requestedSlug && finalSlug && requestedSlug !== finalSlug
        ? { requested: requestedSlug, final: finalSlug }
        : null;
    return res.json({
      ok: true,
      pageId,
      redirect: `/first-booking/${pageId}`,
      token,
      user: { id: userId },
      slugAdjusted,
    });
  } catch (err: any) {
    logger.error("[FirstBooking] claim error:", err?.message, err?.stack);
    return res.status(500).json({ error: "Claim failed" });
  }
});

// Powers the in-app dashboard banner (Touch 2 of the 5-touch first-booking
// system). Returns the most-recently-claimed booking page for the caller and
// hides the banner the moment a `link_copied` / `link_shared` event lands —
// matching the same eligibility predicate used by the send-time policy chain.
router.get("/first-booking/banner-state", isAuthenticated, async (req: Request, res: Response) => {
  const userId = (req as any).userId as string | undefined;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const [page] = await db
      .select()
      .from(bookingPages)
      .where(and(eq(bookingPages.claimedByUserId, userId), eq(bookingPages.claimed, true)))
      .orderBy(desc(bookingPages.claimedAt))
      .limit(1);

    if (!page) {
      return res.json({ shouldShow: false, pageId: null, bookingUrl: null });
    }

    const [{ n: disq } = { n: 0 }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(bookingPageEvents)
      .where(and(
        eq(bookingPageEvents.pageId, page.id),
        inArray(
          bookingPageEvents.type,
          Array.from(FIRST_BOOKING_DISQUALIFYING_EVENT_TYPES),
        ),
      ));

    if ((disq ?? 0) > 0) {
      return res.json({ shouldShow: false, pageId: page.id, bookingUrl: null });
    }

    const bookingUrl = buildBookingLink(page.id);
    return res.json({ shouldShow: true, pageId: page.id, bookingUrl });
  } catch (err: any) {
    logger.error("[FirstBooking] banner-state error:", err?.message);
    return res.status(500).json({ error: "Lookup failed" });
  }
});

// =====================================================================
// "Secure your account" flow for users who claimed a booking page.
// A claim creates a lightweight account with no email, no password, and
// no verified phone — just a JWT in localStorage. If the browser is
// cleared the user loses access permanently. These endpoints let the
// first-booking screen attach a recoverable identity to that account:
//   * link a Firebase identity (email+password / Google / Apple)
//   * verify the user's phone via SMS code (recorded as phoneVerifiedAt
//     so future claim flows can safely merge by phone)
// All endpoints require the caller's claim JWT. They refuse to operate
// on accounts that already have a Firebase identity, on the assumption
// that those users went through the regular Firebase exchange flow.
// =====================================================================

const SECURE_OTP_TTL_MINUTES = 10;
const SECURE_OTP_MIN_RESEND_SECONDS = 30;

function normalizePhoneE164(input?: string | null): string | null {
  if (!input) return null;
  const digits = String(input).replace(/\D/g, "");
  if (!digits) return null;
  // Default to US country code when caller omits it (matches the
  // formatting Twilio applies inside sendSMS).
  const withCc = digits.length === 10 ? `1${digits}` : digits;
  return `+${withCc}`;
}

function escapeEmailHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&#39;";
      default: return ch;
    }
  });
}

// Sends the "your account is secured" confirmation after a successful
// Firebase link. The link the email surfaces points at the standard
// /login splash so the recipient can sign back in with whatever provider
// they just attached (email+password, Google, or Apple). Failures are
// logged but never bubble up — the link operation itself already
// succeeded by the time we get here.
export async function sendAccountSecuredEmail(
  toEmail: string,
  name: string | null | undefined,
): Promise<boolean> {
  const signInUrl = `${getBookingBaseUrl()}/login`;
  const firstName = (name ?? "").trim().split(/\s+/)[0] ?? "";
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  const subject = "Your GigAid account is secured";
  const text =
`${greeting}

You've successfully secured your GigAid account. You can now sign back in any time using ${toEmail}.

Sign in: ${signInUrl}

Keep this email handy in case you ever need to find your way back.

— Your partners at GigAid`;
  const safeUrl = escapeEmailHtml(signInUrl);
  const safeEmail = escapeEmailHtml(toEmail);
  const html =
`<p>${escapeEmailHtml(greeting)}</p>
<p>You've successfully secured your GigAid account. You can now sign back in any time using <strong>${safeEmail}</strong>.</p>
<p><a href="${safeUrl}" style="display:inline-block;padding:12px 20px;background:#4f46e5;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600">Sign In</a></p>
<p style="color:#64748b;font-size:13px;margin-top:8px">${safeUrl}</p>
<p>Keep this email handy in case you ever need to find your way back.</p>
<p>— Your partners at GigAid</p>`;
  // sendEmail catches its own errors and returns a boolean. Returning the
  // result lets the caller log a route-local warning when the send is
  // refused, instead of relying solely on the generic SendGrid error line.
  return await sendEmail({ to: toEmail, subject, text, html });
}

// Sends the "your account is secured" email when a profile-settings PATCH
// adds (or replaces) the user's email AND the account is otherwise eligible
// — phone-OTP-verified, no Firebase identity, no prior welcome send.
//
// This mirrors the atomic-claim pattern used by /api/secure-account/verify-otp
// and /api/secure-account/link-firebase: a conditional UPDATE that only
// succeeds when securedEmailSentAt IS NULL (and the other eligibility
// predicates hold) guarantees exactly-once delivery even if a concurrent
// request also tries to claim the slot. Returns { sent } so the caller can
// log a route-local warning when the send is refused.
export async function maybeSendProfileSecuredEmail(
  userId: string,
): Promise<{ claimed: boolean; sent: boolean }> {
  const now = new Date().toISOString();
  const claimed = await db
    .update(users)
    .set({ securedEmailSentAt: now })
    .where(and(
      eq(users.id, userId),
      isNotNull(users.email),
      isNotNull(users.phoneVerifiedAt),
      isNull(users.firebaseUid),
      isNull(users.securedEmailSentAt),
    ))
    .returning({ email: users.email, name: users.name });
  if (claimed.length === 0 || !claimed[0].email) {
    return { claimed: false, sent: false };
  }
  const sent = await sendAccountSecuredEmail(claimed[0].email, claimed[0].name);
  if (!sent) {
    logger.warn(
      "[Profile] secure-account welcome email did not send (sendEmail returned false)",
    );
  }
  return { claimed: true, sent };
}

async function requireClaimUser(
  req: Request,
  res: Response,
): Promise<{ id: string } | null> {
  const userId = getUserIdFromBearer(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  const [user] = await db
    .select({
      id: users.id,
      firebaseUid: users.firebaseUid,
      authProvider: users.authProvider,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return { id: user.id };
}

router.get("/secure-account/status", async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromBearer(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        phone: users.phone,
        phoneE164: users.phoneE164,
        firebaseUid: users.firebaseUid,
        authProvider: users.authProvider,
        phoneVerifiedAt: users.phoneVerifiedAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    return res.json({
      hasRecoverableIdentity: !!user.firebaseUid,
      hasVerifiedPhone: !!user.phoneVerifiedAt,
      email: user.email ?? null,
      phone: user.phoneE164 ?? user.phone ?? null,
      authProvider: user.authProvider ?? null,
    });
  } catch (err: any) {
    logger.error("[FirstBooking] secure-account status error:", err?.message);
    return res.status(500).json({ error: "Lookup failed" });
  }
});

const linkFirebaseSchema = z.object({
  idToken: z.string().min(10),
});

router.post("/secure-account/link-firebase", async (req: Request, res: Response) => {
  try {
    const caller = await requireClaimUser(req, res);
    if (!caller) return;

    if (!isAppJwtConfigured()) {
      return res.status(503).json({ error: "Authentication is not fully configured." });
    }
    if (!isFirebaseConfigured()) {
      return res.status(503).json({ error: "Firebase authentication is not configured." });
    }

    const parsed = linkFirebaseSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "idToken is required" });

    const decoded = await verifyFirebaseIdToken(parsed.data.idToken);
    if (!decoded) return res.status(401).json({ error: "Invalid Firebase token" });

    const firebaseUid = decoded.uid;
    const email = decoded.email;
    const emailNormalized = email ? email.toLowerCase().trim() : undefined;
    const phoneFromToken = decoded.phone_number;
    const name = decoded.name;
    const photo = decoded.picture;

    // Refuse to silently steal a Firebase identity that another user is
    // already using. The owner of that identity should sign in normally
    // (POST /api/auth/web/firebase) instead, and we can decide later
    // whether to merge.
    const conflictClauses = [eq(users.firebaseUid, firebaseUid)];
    if (emailNormalized) conflictClauses.push(eq(users.emailNormalized, emailNormalized));
    if (phoneFromToken) conflictClauses.push(eq(users.phoneE164, phoneFromToken));
    const conflictRows = await db
      .select({ id: users.id })
      .from(users)
      .where(and(
        sql`${users.id} <> ${caller.id}`,
        or(...conflictClauses),
      ));
    if (conflictRows.length > 0) {
      return res.status(409).json({
        error: "This identity is already linked to a different account. Sign in with it instead.",
        code: "identity_in_use",
      });
    }

    // Snapshot the caller's existing email/name/securedEmailSentAt BEFORE
    // the update so the welcome email send below can fall back to whatever
    // was already on file when the Firebase token didn't include an email
    // or display name (e.g. Apple sign-in after the first authorization).
    const [existingUser] = await db
      .select({ email: users.email, name: users.name, securedEmailSentAt: users.securedEmailSentAt })
      .from(users)
      .where(eq(users.id, caller.id))
      .limit(1);

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = {
      firebaseUid,
      authProvider: "firebase",
      updatedAt: now,
    };
    if (email) updates.email = email;
    if (emailNormalized) updates.emailNormalized = emailNormalized;
    if (phoneFromToken) {
      updates.phone = phoneFromToken;
      updates.phoneE164 = phoneFromToken;
      // Firebase only issues a phone provider sign-in after it has itself
      // verified the SMS code, so trust this as a verified phone too.
      updates.phoneVerifiedAt = now;
    }
    if (name) updates.name = name;
    if (photo) updates.photo = photo;

    await db.update(users).set(updates).where(eq(users.id, caller.id));

    // Send a "your account is secured" confirmation email so the user has
    // a record of which address to sign in with and a direct link back.
    // We deliberately skip the send when no email is on file (e.g. the
    // user only verified their phone via Firebase phone-auth, which has
    // no email claim) — the task spec is explicit about not emailing
    // phone-only secures.
    //
    // Exactly-once guarantee: we atomically claim the send slot by
    // updating securedEmailSentAt in a conditional UPDATE that only
    // succeeds when it is still NULL. If the OTP path already set it, the
    // claim returns 0 rows and we skip the send entirely.
    const welcomeRecipient = email ?? existingUser?.email ?? null;
    const welcomeName = name ?? existingUser?.name ?? null;
    if (welcomeRecipient) {
      try {
        const claimed = await db
          .update(users)
          .set({ securedEmailSentAt: now })
          .where(and(eq(users.id, caller.id), isNull(users.securedEmailSentAt)))
          .returning({ id: users.id });
        if (claimed.length > 0) {
          const sent = await sendAccountSecuredEmail(welcomeRecipient, welcomeName);
          if (!sent) {
            // sendEmail swallows SendGrid errors and returns false. Log a
            // route-local warning so this endpoint's logs surface delivery
            // issues without having to grep the generic SendGrid line.
            logger.warn(
              "[FirstBooking] secure-account welcome email did not send (sendEmail returned false)",
            );
          }
        }
      } catch (emailErr: any) {
        // Never fail the link request because of an email hiccup — the
        // identity is already attached and the user's session is valid.
        logger.warn(
          "[FirstBooking] secure-account welcome email send failed:",
          emailErr?.message,
        );
      }
    }

    const newToken = signAppJwt({
      sub: caller.id,
      provider: "firebase",
      email_normalized: emailNormalized,
      firebase_uid: firebaseUid,
    });

    return res.json({
      ok: true,
      token: newToken,
      user: {
        id: caller.id,
        email: email ?? null,
        phone: phoneFromToken ?? null,
        authProvider: "firebase",
      },
    });
  } catch (err: any) {
    logger.error("[FirstBooking] link-firebase error:", err?.message);
    return res.status(500).json({ error: "Link failed" });
  }
});

const sendOtpSchema = z.object({
  phone: z.string().trim().min(7).max(32),
});

router.post("/secure-account/send-otp", async (req: Request, res: Response) => {
  try {
    const caller = await requireClaimUser(req, res);
    if (!caller) return;

    const parsed = sendOtpSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Phone is required" });
    const phoneE164 = normalizePhoneE164(parsed.data.phone);
    if (!phoneE164) return res.status(400).json({ error: "Invalid phone number" });

    // Cheap resend-throttle to keep a hostile or buggy client from billing
    // us for repeated SMS sends to the same number. We look at the most
    // recent OTP for this phone and refuse if it was issued less than
    // SECURE_OTP_MIN_RESEND_SECONDS ago.
    const [latest] = await db
      .select()
      .from(otpCodes)
      .where(eq(otpCodes.identifier, phoneE164))
      .orderBy(desc(otpCodes.createdAt))
      .limit(1);
    if (latest) {
      const createdAt = new Date(latest.createdAt as string).getTime();
      const ageSec = (Date.now() - createdAt) / 1000;
      if (Number.isFinite(ageSec) && ageSec < SECURE_OTP_MIN_RESEND_SECONDS) {
        return res.status(429).json({
          error: "Please wait a few seconds before requesting another code.",
          retryAfterSeconds: Math.ceil(SECURE_OTP_MIN_RESEND_SECONDS - ageSec),
        });
      }
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const expiresAt = new Date(Date.now() + SECURE_OTP_TTL_MINUTES * 60 * 1000).toISOString();

    await storage.createOtp({
      identifier: phoneE164,
      code,
      type: "phone",
      expiresAt,
    });

    const body = `Your GigAid verification code is ${code}. It expires in ${SECURE_OTP_TTL_MINUTES} minutes.`;
    const result = await sendSMS(phoneE164, body);
    if (!result.success) {
      logger.warn("[FirstBooking] secure-account OTP send failed:", result.errorCode, result.errorMessage);
      return res.status(502).json({
        error: result.errorMessage || "Failed to send verification code.",
        code: result.errorCode || "SEND_FAILED",
      });
    }
    return res.json({ ok: true, expiresInSeconds: SECURE_OTP_TTL_MINUTES * 60 });
  } catch (err: any) {
    logger.error("[FirstBooking] secure-account send-otp error:", err?.message);
    return res.status(500).json({ error: "Failed to send code" });
  }
});

const verifyOtpSchema = z.object({
  phone: z.string().trim().min(7).max(32),
  code: z.string().trim().regex(/^\d{6}$/, "Code must be 6 digits"),
});

router.post("/secure-account/verify-otp", async (req: Request, res: Response) => {
  try {
    const caller = await requireClaimUser(req, res);
    if (!caller) return;

    const parsed = verifyOtpSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Phone and 6-digit code are required" });
    const phoneE164 = normalizePhoneE164(parsed.data.phone);
    if (!phoneE164) return res.status(400).json({ error: "Invalid phone number" });

    const otp = await storage.getOtp(phoneE164, parsed.data.code);
    if (!otp) return res.status(400).json({ error: "Invalid code" });
    if (otp.verified) return res.status(400).json({ error: "Code already used" });
    const exp = new Date(otp.expiresAt).getTime();
    if (!Number.isFinite(exp) || Date.now() > exp) {
      return res.status(400).json({ error: "Code has expired. Send a new one." });
    }

    // Refuse to attach this phone to multiple users. If the verified
    // number already belongs to a different real account, surface that
    // so the user can sign in there instead of creating a duplicate.
    const phoneOwners = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.phoneE164, phoneE164), sql`${users.id} <> ${caller.id}`));
    if (phoneOwners.length > 0) {
      return res.status(409).json({
        error: "This phone number is already in use on another account.",
        code: "phone_in_use",
      });
    }

    await storage.verifyOtp(otp.id);

    const now = new Date().toISOString();
    await db.update(users).set({
      phone: phoneE164,
      phoneE164,
      phoneVerifiedAt: now,
      updatedAt: now,
    }).where(eq(users.id, caller.id));

    // If the user already has an email on file and we haven't sent the
    // secured-account email yet (via the Firebase-link path), send it now
    // so phone-OTP users get the same confirmation.
    //
    // Exactly-once guarantee: we atomically claim the send slot by
    // performing a conditional UPDATE that only succeeds when email IS NOT
    // NULL and securedEmailSentAt IS NULL. Concurrent requests (or a
    // later link-firebase call that already set the flag) will see 0 rows
    // updated and skip the send entirely.
    try {
      const claimed = await db
        .update(users)
        .set({ securedEmailSentAt: now })
        .where(and(
          eq(users.id, caller.id),
          isNotNull(users.email),
          isNull(users.securedEmailSentAt),
        ))
        .returning({ email: users.email, name: users.name });
      if (claimed.length > 0 && claimed[0].email) {
        const sent = await sendAccountSecuredEmail(claimed[0].email, claimed[0].name);
        if (!sent) {
          logger.warn(
            "[FirstBooking] secure-account OTP welcome email did not send (sendEmail returned false)",
          );
        }
      }
    } catch (emailErr: any) {
      // Never fail the verify-otp request because of an email hiccup.
      logger.warn(
        "[FirstBooking] secure-account OTP welcome email send failed:",
        emailErr?.message,
      );
    }

    return res.json({ ok: true, phone: phoneE164, phoneVerifiedAt: now });
  } catch (err: any) {
    logger.error("[FirstBooking] secure-account verify-otp error:", err?.message);
    return res.status(500).json({ error: "Failed to verify code" });
  }
});

export default router;
