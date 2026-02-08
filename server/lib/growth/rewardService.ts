import { db } from "../../db";
import { growthReferrals, referralRewards, users } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const DEFAULT_REWARD_TYPE = "pro_days" as const;
const DEFAULT_REWARD_VALUE = 30;

export async function applyReferralReward(
  referrerId: string,
  referredId: string
): Promise<{ success: boolean; reason?: string }> {
  if (referrerId === referredId) {
    return { success: false, reason: "self_referral" };
  }

  const [existingReward] = await db
    .select()
    .from(referralRewards)
    .where(
      and(
        eq(referralRewards.referrerUserId, referrerId),
        eq(referralRewards.referredUserId, referredId)
      )
    )
    .limit(1);

  if (existingReward) {
    return { success: false, reason: "already_rewarded" };
  }

  const [referral] = await db
    .select()
    .from(growthReferrals)
    .where(
      and(
        eq(growthReferrals.referrerUserId, referrerId),
        eq(growthReferrals.referredUserId, referredId),
        eq(growthReferrals.status, "activated")
      )
    )
    .limit(1);

  if (!referral) {
    return { success: false, reason: "referral_not_activated" };
  }

  const now = new Date().toISOString();

  try {
    const [referrer] = await db
      .select({ proExpiresAt: users.proExpiresAt, plan: users.plan })
      .from(users)
      .where(eq(users.id, referrerId))
      .limit(1);

    if (referrer) {
      const currentExpiry = referrer.proExpiresAt
        ? new Date(referrer.proExpiresAt)
        : new Date();
      if (currentExpiry < new Date()) currentExpiry.setTime(Date.now());
      currentExpiry.setDate(currentExpiry.getDate() + DEFAULT_REWARD_VALUE);

      await db
        .update(users)
        .set({
          isPro: true,
          plan: referrer.plan === "free" ? "pro" : referrer.plan,
          proExpiresAt: currentExpiry.toISOString(),
        })
        .where(eq(users.id, referrerId));
    }

    const [referred] = await db
      .select({ proExpiresAt: users.proExpiresAt, plan: users.plan })
      .from(users)
      .where(eq(users.id, referredId))
      .limit(1);

    if (referred) {
      const currentExpiry = referred.proExpiresAt
        ? new Date(referred.proExpiresAt)
        : new Date();
      if (currentExpiry < new Date()) currentExpiry.setTime(Date.now());
      currentExpiry.setDate(currentExpiry.getDate() + DEFAULT_REWARD_VALUE);

      await db
        .update(users)
        .set({
          isPro: true,
          plan: referred.plan === "free" ? "pro" : referred.plan,
          proExpiresAt: currentExpiry.toISOString(),
        })
        .where(eq(users.id, referredId));
    }

    await db.insert(referralRewards).values({
      referrerUserId: referrerId,
      referredUserId: referredId,
      rewardType: DEFAULT_REWARD_TYPE,
      rewardValue: DEFAULT_REWARD_VALUE,
      appliedAt: now,
      status: "applied",
    });

    await db.insert(referralRewards).values({
      referrerUserId: referredId,
      referredUserId: referrerId,
      rewardType: DEFAULT_REWARD_TYPE,
      rewardValue: DEFAULT_REWARD_VALUE,
      appliedAt: now,
      status: "applied",
    });

    await db
      .update(growthReferrals)
      .set({ status: "rewarded", rewardedAt: now })
      .where(eq(growthReferrals.id, referral.id));

    return { success: true };
  } catch (err: any) {
    await db.insert(referralRewards).values({
      referrerUserId: referrerId,
      referredUserId: referredId,
      rewardType: DEFAULT_REWARD_TYPE,
      rewardValue: DEFAULT_REWARD_VALUE,
      status: "failed",
      failureReason: err.message || "Unknown error",
    });

    return { success: false, reason: err.message };
  }
}

export async function getRewardsForUser(userId: string) {
  return db
    .select()
    .from(referralRewards)
    .where(eq(referralRewards.referrerUserId, userId));
}
