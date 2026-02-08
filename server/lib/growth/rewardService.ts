import { db } from "../../db";
import { growthReferrals, referralRewards, users } from "@shared/schema";
import { eq, and, sql, count } from "drizzle-orm";
import { trackServerEvent } from "./analytics";

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

  const [referredUser] = await db
    .select({ firstQuoteSentAt: users.firstQuoteSentAt, firstPaymentReceivedAt: users.firstPaymentReceivedAt, email: users.email })
    .from(users)
    .where(eq(users.id, referredId))
    .limit(1);

  if (referredUser && !referredUser.firstQuoteSentAt && !referredUser.firstPaymentReceivedAt) {
    return { success: false, reason: "referred_user_no_quote_or_payment" };
  }

  if (referredUser?.email) {
    const referredDomain = referredUser.email.split("@")[1]?.toLowerCase();
    if (referredDomain) {
      const [referrerUser] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, referrerId))
        .limit(1);
      if (referrerUser?.email) {
        const referrerDomain = referrerUser.email.split("@")[1]?.toLowerCase();
        const publicDomains = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com", "aol.com", "protonmail.com", "mail.com"];
        if (referredDomain === referrerDomain && !publicDomains.includes(referredDomain)) {
          const sameDomainsResult = await db
            .select({ count: count() })
            .from(referralRewards)
            .innerJoin(users, eq(users.id, referralRewards.referredUserId))
            .where(
              and(
                eq(referralRewards.referrerUserId, referrerId),
                sql`LOWER(SPLIT_PART(${users.email}, '@', 2)) = ${referredDomain}`
              )
            );
          const sameDomainCount = sameDomainsResult[0]?.count ?? 0;
          if (sameDomainCount >= 3) {
            return { success: false, reason: "email_domain_spam_threshold" };
          }
        }
      }
    }
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

    trackServerEvent("referral_reward_applied", referrerId, {
      referrer_user_id: referrerId,
      referred_user_id: referredId,
      reward_type: DEFAULT_REWARD_TYPE,
      reward_value: DEFAULT_REWARD_VALUE,
      source: "referral",
      trigger_surface: "activation",
      landing_path: null,
      utm_campaign: null,
      plan: referrer?.plan || null,
    });

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
