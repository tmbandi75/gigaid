import { db } from "../../db";
import { growthReferrals, users } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
import { trackServerEvent } from "./analytics";

export function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "GA-";
  for (let i = 0; i < 6; i++) {
    code += chars[crypto.randomInt(chars.length)];
  }
  return code;
}

export async function ensureUserReferralCode(userId: string): Promise<string> {
  const [user] = await db
    .select({ id: users.id, referralCode: users.referralCode })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) throw new Error("User not found");

  if (user.referralCode) return user.referralCode;

  let code: string;
  let attempts = 0;
  do {
    code = generateReferralCode();
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.referralCode, code))
      .limit(1);
    if (!existing) break;
    attempts++;
  } while (attempts < 10);

  await db
    .update(users)
    .set({ referralCode: code })
    .where(eq(users.id, userId));

  return code;
}

export async function trackReferralClick(referralCode: string): Promise<void> {
  const [referrer] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.referralCode, referralCode))
    .limit(1);

  if (!referrer) return;

  const [existing] = await db
    .select()
    .from(growthReferrals)
    .where(
      and(
        eq(growthReferrals.referralCode, referralCode),
        eq(growthReferrals.status, "clicked")
      )
    )
    .limit(1);

  if (existing) return;

  await db.insert(growthReferrals).values({
    referrerUserId: referrer.id,
    referralCode,
    status: "clicked",
    clickedAt: new Date().toISOString(),
  });
}

export async function linkReferralSignup(
  referralCode: string,
  referredUserId: string
): Promise<boolean> {
  const [referrer] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.referralCode, referralCode))
    .limit(1);

  if (!referrer) return false;

  if (referrer.id === referredUserId) return false;

  const [existingReward] = await db
    .select()
    .from(growthReferrals)
    .where(eq(growthReferrals.referredUserId, referredUserId))
    .limit(1);
  if (existingReward) return false;

  const [clickedRecord] = await db
    .select()
    .from(growthReferrals)
    .where(
      and(
        eq(growthReferrals.referralCode, referralCode),
        eq(growthReferrals.status, "clicked")
      )
    )
    .limit(1);

  if (clickedRecord) {
    await db
      .update(growthReferrals)
      .set({
        referredUserId,
        status: "signed_up",
        signedUpAt: new Date().toISOString(),
      })
      .where(eq(growthReferrals.id, clickedRecord.id));
  } else {
    await db.insert(growthReferrals).values({
      referrerUserId: referrer.id,
      referredUserId,
      referralCode,
      status: "signed_up",
      clickedAt: new Date().toISOString(),
      signedUpAt: new Date().toISOString(),
    });
  }

  trackServerEvent("referral_signed_up", referredUserId, {
    referrer_user_id: referrer.id,
    referral_code: referralCode,
    source: "referral",
    trigger_surface: "signup",
  });

  return true;
}

export async function markReferralActivated(referredUserId: string): Promise<boolean> {
  const [record] = await db
    .select()
    .from(growthReferrals)
    .where(
      and(
        eq(growthReferrals.referredUserId, referredUserId),
        eq(growthReferrals.status, "signed_up")
      )
    )
    .limit(1);

  if (!record) return false;

  await db
    .update(growthReferrals)
    .set({
      status: "activated",
      activatedAt: new Date().toISOString(),
    })
    .where(eq(growthReferrals.id, record.id));

  trackServerEvent("referral_activated", referredUserId, {
    referrer_user_id: record.referrerUserId,
    referral_code: record.referralCode,
    source: "referral",
    trigger_surface: "activation",
  });

  return true;
}

export async function getReferralsForUser(userId: string) {
  return db
    .select()
    .from(growthReferrals)
    .where(eq(growthReferrals.referrerUserId, userId));
}

export async function getReferralByCode(code: string) {
  const [record] = await db
    .select()
    .from(growthReferrals)
    .where(eq(growthReferrals.referralCode, code))
    .limit(1);
  return record || null;
}
