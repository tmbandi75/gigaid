import { db } from "../../db";
import { acquisitionAttribution, users } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

export interface TrackAttributionInput {
  userId: string;
  landingPath?: string;
  source?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  referrerCode?: string;
}

export async function trackAttribution(input: TrackAttributionInput) {
  const now = new Date().toISOString();

  let referrerUserId: string | null = null;
  if (input.referrerCode) {
    const [referrer] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.referralCode, input.referrerCode))
      .limit(1);
    if (referrer) {
      if (referrer.id === input.userId) {
        referrerUserId = null;
      } else {
        referrerUserId = referrer.id;
      }
    }
  }

  const [existing] = await db
    .select()
    .from(acquisitionAttribution)
    .where(eq(acquisitionAttribution.userId, input.userId))
    .limit(1);

  if (existing) {
    const MAX_DAILY_TOUCHES = 20;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    if (
      existing.lastTouchAt &&
      new Date(existing.lastTouchAt) >= todayStart &&
      existing.touchCount >= MAX_DAILY_TOUCHES
    ) {
      return { ...existing, rateLimited: true };
    }

    const [updated] = await db
      .update(acquisitionAttribution)
      .set({
        lastTouchAt: now,
        touchCount: existing.touchCount + 1,
        ...(referrerUserId && !existing.referrerUserId
          ? { referrerUserId }
          : {}),
      })
      .where(eq(acquisitionAttribution.userId, input.userId))
      .returning();

    return { ...updated, rateLimited: false };
  }

  const [created] = await db
    .insert(acquisitionAttribution)
    .values({
      userId: input.userId,
      source: input.source || null,
      landingPath: input.landingPath || null,
      referrerUserId,
      utmSource: input.utmSource || null,
      utmMedium: input.utmMedium || null,
      utmCampaign: input.utmCampaign || null,
      utmContent: input.utmContent || null,
      utmTerm: input.utmTerm || null,
      firstTouchAt: now,
      lastTouchAt: now,
      touchCount: 1,
    })
    .returning();

  return { ...created, rateLimited: false };
}

export async function getAttributionForUser(userId: string) {
  const [attr] = await db
    .select()
    .from(acquisitionAttribution)
    .where(eq(acquisitionAttribution.userId, userId))
    .limit(1);
  return attr || null;
}
