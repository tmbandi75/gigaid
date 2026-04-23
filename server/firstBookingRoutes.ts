import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { storage } from "./storage";
import { db } from "./db";
import { users, bookingPages, outboundMessages, bookingPageEventTypes, unclaimedHeadlineVariants } from "@shared/schema";
import { and, eq } from "drizzle-orm";
import { signAppJwt, verifyAppJwt, isAppJwtConfigured } from "./appJwt";
import { logger } from "./lib/logger";
import { randomUUID } from "crypto";

const router = Router();

const claimSchema = z.object({
  pageId: z.string().min(1),
  name: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(32).optional(),
  serviceType: z.string().trim().max(120).optional(),
  variant: z.enum(unclaimedHeadlineVariants).optional(),
});

function sanitizeVariant(input: unknown): string | undefined {
  if (typeof input !== "string") return undefined;
  return (unclaimedHeadlineVariants as readonly string[]).includes(input) ? input : undefined;
}

function publicOriginFromReq(req: Request): string {
  const proto = (req.headers["x-forwarded-proto"] as string)?.split(",")[0] || req.protocol || "https";
  const host = req.get("host") || "gigaid.ai";
  return `${proto}://${host}`;
}

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

    const isOwnerAction = type === "link_copied" || type === "link_shared";
    if (isOwnerAction) {
      const userId = getUserIdFromBearer(req);
      if (!userId || !page.claimedByUserId || userId !== page.claimedByUserId) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    const variant = sanitizeVariant(req.body?.variant);
    await storage.trackBookingPageEvent(pageId, type, { variant });
    if (isOwnerAction) await storage.cancelBookingPageNudges(pageId);
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
      const tx = await db.transaction(async (trx) => {
        const newId = randomUUID();
        const nowIso = new Date().toISOString();

        const [created] = await trx.insert(users).values({
          id: newId,
          username: `claim-${newId.slice(0, 8)}`,
          password: randomUUID(),
          name: name ?? null,
          publicProfileEnabled: false,
          publicProfileSlug: `user-${newId.slice(0, 8).toLowerCase()}`,
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
      });
      userId = tx.userId;
    } catch (err: any) {
      if (err?.message === "ALREADY_CLAIMED") {
        return res.status(409).json({ error: "Page was just claimed by another session" });
      }
      throw err;
    }

    await storage.trackBookingPageEvent(pageId, "page_claimed", { variant });

    if (phone) {
      const now = new Date();
      const bookingUrl = `${publicOriginFromReq(req)}/book/${pageId}`;
      const nudges = [
        { minutes: 10, type: "first_booking_nudge_10m", body: `Send your booking link to your next customer — it saves a ton of back and forth: ${bookingUrl}` },
        { minutes: 60 * 24, type: "first_booking_nudge_24h", body: `Most people get their first booking within a day after sharing their link: ${bookingUrl}` },
      ];
      try {
        await db.insert(outboundMessages).values(nudges.map((n) => ({
          userId,
          jobId: null,
          bookingPageId: pageId,
          channel: "sms",
          toAddress: phone,
          type: n.type,
          status: "scheduled" as const,
          scheduledFor: new Date(now.getTime() + n.minutes * 60 * 1000).toISOString(),
          templateRendered: n.body,
          metadata: JSON.stringify({ pageId, source: "first_booking" }),
          createdAt: now.toISOString(),
        })));
      } catch (err: any) {
        logger.error("[FirstBooking] Failed to schedule nudges:", err?.message);
      }
    }

    const token = signAppJwt({ sub: userId, provider: "claim" });
    return res.json({ ok: true, pageId, redirect: `/first-booking/${pageId}`, token, user: { id: userId } });
  } catch (err: any) {
    logger.error("[FirstBooking] claim error:", err?.message, err?.stack);
    return res.status(500).json({ error: "Claim failed" });
  }
});

export default router;
