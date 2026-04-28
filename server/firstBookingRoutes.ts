import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { storage } from "./storage";
import { db } from "./db";
import { users, bookingPages, bookingPageEvents, outboundMessages, bookingPageEventTypes, unclaimedHeadlineVariants } from "@shared/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { signAppJwt, verifyAppJwt, isAppJwtConfigured } from "./appJwt";
import { isAuthenticated } from "./replit_integrations/auth/replitAuth";
import { FIRST_BOOKING_DISQUALIFYING_EVENT_TYPES } from "./postJobMomentum";
import { buildBookingLink } from "./lib/bookingLinkUrl";
import { generateBookingSlug, writeUserSlugWithRetry } from "./lib/bookingSlug";
import { logger } from "./lib/logger";
import { randomUUID } from "crypto";

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
    return res.json({ ok: true, pageId, redirect: `/first-booking/${pageId}`, token, user: { id: userId } });
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

export default router;
